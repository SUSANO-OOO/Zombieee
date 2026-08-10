// Version 0.9.9.0 resumable full-pack download session.
//
// The session deliberately knows nothing about DOM or Cache Storage. Callers
// inject fetch, digest, and storage operations, which keeps the same full-pack
// queue and diagnostics testable in node:test and in a real browser.

import { distinctDownloadBytes, sortManifestAssets } from "./pwaAssetManifest.js";

export const DOWNLOAD_STATES = Object.freeze([
  "idle",
  "running",
  "paused",
  "cancelled",
  "complete",
  "failed",
]);

export const DOWNLOAD_PHASES = Object.freeze(["queue", "network", "verify", "cache"]);
export const DEFAULT_DOWNLOAD_CONCURRENCY = 3;
export const DEFAULT_ASSET_TIMEOUT_MS = 30000;
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_HEARTBEAT_MS = 1000;

function hex(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

async function subtleDigest(bytes) {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  const digested = await crypto.subtle.digest("SHA-256", copy.buffer);
  return `sha256-${hex(digested)}`;
}

function byteLengthOf(payload) {
  if (!payload) return 0;
  if (payload instanceof Uint8Array) return payload.byteLength;
  if (payload instanceof ArrayBuffer) return payload.byteLength;
  if (typeof payload.byteLength === "number") return payload.byteLength;
  return 0;
}

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

class Deferred {
  constructor() {
    this.promise = new Promise((resolve) => { this.resolve = resolve; });
  }
}

/**
 * @param {object} options
 * @param {Array} options.assets manifest entries to fetch as one full pack
 * @param {(asset: object, context: {signal: AbortSignal, sessionSignal?: AbortSignal}) => Promise<{ok: boolean, status?: number, body?: Uint8Array}>} options.fetchAsset
 * @param {{put: Function, has?: Function}} options.store
 * @param {(bytes: Uint8Array) => Promise<string>} [options.digest]
 * @param {(snapshot: object) => void} [options.onProgress]
 */
export function createAssetDownloadSession({
  assets,
  fetchAsset,
  store,
  digest = subtleDigest,
  onProgress = () => {},
  concurrency = DEFAULT_DOWNLOAD_CONCURRENCY,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  timeoutMs = DEFAULT_ASSET_TIMEOUT_MS,
  heartbeatMs = DEFAULT_HEARTBEAT_MS,
  now = () => Date.now(),
} = {}) {
  const queue = sortManifestAssets(Array.isArray(assets) ? assets : []);
  const membersByHash = new Map();
  const workQueue = [];
  for (const asset of queue) {
    const key = asset.hash ?? asset.path;
    const members = membersByHash.get(key);
    if (members) {
      members.push(asset);
    } else {
      membersByHash.set(key, [asset]);
      workQueue.push(asset);
    }
  }

  const totalCount = queue.length;
  const totalBytes = distinctDownloadBytes(queue);

  const completedPaths = new Set();
  const failures = new Map();
  const completedHashes = new Set();
  const metrics = new Map();

  let state = "idle";
  let completedBytes = 0;
  let active = null;
  let activeCount = 0;
  let maxObservedConcurrency = 0;
  let totalFetchedBytes = 0;
  let retryFetchedBytes = 0;
  let requestCount = 0;
  let transportRetryCount = 0;
  let retryCount = 0;
  let timeoutCount = 0;
  let cacheHitCount = 0;
  let dedupeCount = 0;
  let networkMs = 0;
  let requestWaitMs = 0;
  let transferMs = 0;
  let verifyMs = 0;
  let cacheWriteMs = 0;
  let startedAt = null;
  let endedAt = null;
  let lastProgressAt = null;
  let pauseGate = null;
  let controller = null;
  let runPromise = null;
  let heartbeatTimer = null;
  let cancelled = false;

  function metricFor(asset) {
    const existing = metrics.get(asset.path);
    if (existing) return existing;
    const metric = {
      path: asset.path,
      bytes: asset.bytes ?? 0,
      hash: asset.hash ?? null,
      transportPath: asset.bundlePath ?? asset.sourcePath ?? asset.path,
      category: asset.category ?? null,
      criticality: asset.criticality ?? null,
      pack: asset.pack ?? null,
      attempts: 0,
      status: "queued",
      reason: null,
      httpStatus: 0,
      fetchedBytes: 0,
      retryFetchedBytes: 0,
      queueWaitMs: null,
      requestWaitMs: 0,
      transferMs: 0,
      networkMs: 0,
      verifyMs: 0,
      cacheWriteMs: 0,
      deduplicatedFrom: null,
      startedAt: null,
      completedAt: null,
    };
    metrics.set(asset.path, metric);
    return metric;
  }

  function snapshot() {
    const currentTime = now();
    const activeElapsed = active?.startedAt == null ? 0 : Math.max(0, currentTime - active.startedAt);
    const activeSpeedBps = active && activeElapsed > 0
      ? Math.round((active.bytesReceived * 1000) / activeElapsed)
      : null;
    const elapsedMs = startedAt == null ? null : Math.max(0, currentTime - startedAt);
    const overallSpeedBps = elapsedMs && elapsedMs > 0
      ? Math.round((completedBytes * 1000) / elapsedMs)
      : null;
    const etaMs = overallSpeedBps && overallSpeedBps > 0
      ? Math.round((Math.max(0, totalBytes - completedBytes) / overallSpeedBps) * 1000)
      : null;
    return {
      state,
      totalCount,
      totalBytes,
      completedCount: completedPaths.size,
      completedBytes,
      remainingCount: Math.max(0, totalCount - completedPaths.size),
      remainingBytes: Math.max(0, totalBytes - completedBytes),
      failedCount: failures.size,
      failedPaths: [...failures.keys()],
      failures: [...failures.entries()].map(([path, failure]) => ({ path, ...failure })),
      activeCategory: active?.asset.category ?? null,
      activePath: active?.asset.path ?? null,
      activePhase: active?.phase ?? null,
      activeAttempt: active?.attempt ?? 0,
      activeBytes: active?.bytesReceived ?? 0,
      activeTotalBytes: active?.asset.bytes ?? 0,
      activeSpeedBps,
      activeStalledForMs: active?.lastProgressAt == null ? 0 : Math.max(0, currentTime - active.lastProgressAt),
      overallSpeedBps,
      etaMs,
      elapsedMs,
      startedAt,
      endedAt,
      lastProgressAt,
      lastProgressAgeMs: lastProgressAt == null ? null : Math.max(0, currentTime - lastProgressAt),
      totalFetchedBytes,
      retryFetchedBytes,
      requestCount,
      transportRetryCount,
      retryCount,
      timeoutCount,
      cacheHitCount,
      dedupeCount,
      networkMs,
      requestWaitMs,
      transferMs,
      verifyMs,
      cacheWriteMs,
      maxObservedConcurrency,
      // Per-asset timing is intentionally PII-free and is the evidence needed
      // to distinguish request wait, transfer, hash, and Cache Storage work.
      metrics: [...metrics.values()].map((metric) => ({ ...metric })),
      ratio: totalBytes > 0 ? Math.min(1, completedBytes / totalBytes) : (totalCount === 0 ? 1 : 0),
    };
  }

  function publish() {
    onProgress(snapshot());
  }

  function markProgress() {
    lastProgressAt = now();
  }

  function setState(next) {
    if (state === next) return;
    state = next;
    publish();
  }

  async function waitWhilePaused() {
    while (pauseGate && !cancelled) await pauseGate.promise;
  }

  function completeHash(asset, source = "network") {
    const members = membersByHash.get(asset.hash ?? asset.path) ?? [asset];
    const firstCompletion = !completedHashes.has(asset.hash ?? asset.path);
    if (firstCompletion) {
      completedHashes.add(asset.hash ?? asset.path);
      completedBytes += asset.bytes;
    }

    for (const member of members) {
      if (completedPaths.has(member.path)) continue;
      const metric = metricFor(member);
      const isPrimary = member.path === asset.path;
      completedPaths.add(member.path);
      metric.status = isPrimary
        ? (source === "cache" ? "cache-hit" : "complete")
        : "deduped";
      if (!isPrimary) {
        metric.deduplicatedFrom = asset.path;
        dedupeCount += 1;
      }
      metric.completedAt = now();
      if (metric.queueWaitMs == null && metric.startedAt != null) {
        metric.queueWaitMs = Math.max(0, metric.startedAt - (startedAt ?? metric.startedAt));
      }
      failures.delete(member.path);
    }
    if (source === "cache") cacheHitCount += 1;
    markProgress();
    publish();
  }

  function failHash(asset, detail) {
    const members = membersByHash.get(asset.hash ?? asset.path) ?? [asset];
    for (const member of members) {
      const metric = metricFor(member);
      metric.status = "failed";
      metric.reason = detail.reason;
      metric.httpStatus = detail.status ?? 0;
      failures.set(member.path, {
        ...detail,
        deduplicatedFrom: member.path === asset.path ? null : asset.path,
      });
    }
  }

  async function processOne(asset) {
    await waitWhilePaused();
    if (cancelled) return;

    const metric = metricFor(asset);
    metric.status = "running";
    metric.startedAt ??= now();
    const job = {
      asset,
      phase: "queue",
      attempt: metric.attempts,
      bytesReceived: 0,
      startedAt: now(),
      lastProgressAt: now(),
    };
    active = job;
    activeCount += 1;
    maxObservedConcurrency = Math.max(maxObservedConcurrency, activeCount);
    metric.queueWaitMs = Math.max(0, job.startedAt - (startedAt ?? job.startedAt));
    publish();

    try {
      // A content hash completed by an earlier worker or session satisfies the
      // path without a second request. Work items are hash-unique, and the
      // explicit groups above also close the concurrent duplicate race.
      if (completedHashes.has(asset.hash) || (store.has && await store.has(asset))) {
        completeHash(asset, "cache");
        return;
      }

      let lastReason = "unknown";
      let lastStatus = 0;
      while (metric.attempts < maxAttempts && !cancelled) {
        metric.attempts += 1;
        job.attempt = metric.attempts;
        job.phase = "network";
        job.bytesReceived = 0;
        job.startedAt = now();
        job.lastProgressAt = now();
        metric.status = "network";
        if (metric.attempts > 1) retryCount += 1;
        markProgress();
        publish();

        const abort = new AbortController();
        const outerSignal = controller?.signal;
        const relay = () => abort.abort();
        outerSignal?.addEventListener("abort", relay, { once: true });
        const timer = setTimeout(() => abort.abort(), timeoutMs);
        const networkStarted = now();
        let response = null;
        try {
          response = await fetchAsset(asset, {
            signal: abort.signal,
            sessionSignal: outerSignal,
          });
        } catch (error) {
          if (cancelled) return;
          lastReason = error?.reason === "stall"
            ? "stall"
            : (error?.name === "AbortError" || error?.name === "TimeoutError" || error?.reason === "request"
              ? "timeout"
              : "network");
          lastStatus = 0;
          if (lastReason === "timeout" || lastReason === "stall") timeoutCount += 1;
        } finally {
          clearTimeout(timer);
          outerSignal?.removeEventListener("abort", relay);
          const elapsed = Math.max(0, now() - networkStarted);
          metric.networkMs += elapsed;
          networkMs += elapsed;
        }
        if (!response) {
          requestCount += 1;
          continue;
        }

        const actualNetworkMs = Number.isFinite(Number(response.networkMs))
          ? Math.max(0, Number(response.networkMs))
          : null;
        if (actualNetworkMs !== null) {
          const measuredElapsed = Math.max(0, now() - networkStarted);
          metric.networkMs += actualNetworkMs - measuredElapsed;
          networkMs += actualNetworkMs - measuredElapsed;
        }
        const networkRequestCount = Number.isFinite(Number(response.networkRequestCount))
          ? Math.max(0, Number(response.networkRequestCount))
          : 1;
        requestCount += networkRequestCount;
        if (metric.attempts > 1) transportRetryCount += networkRequestCount;

        const responseRequestWaitMs = finiteNumber(response.requestWaitMs);
        const responseTransferMs = finiteNumber(response.transferMs);
        metric.requestWaitMs += responseRequestWaitMs;
        metric.transferMs += responseTransferMs;
        requestWaitMs += responseRequestWaitMs;
        transferMs += responseTransferMs;

        const body = response.body;
        const size = byteLengthOf(body);
        job.bytesReceived = size;
        job.lastProgressAt = now();
        metric.fetchedBytes += size;
        totalFetchedBytes += size;
        if (metric.attempts > 1) {
          metric.retryFetchedBytes += size;
          retryFetchedBytes += size;
        }
        lastStatus = response.status ?? 0;
        if (!response.ok) {
          lastReason = response.reason ?? "http";
          publish();
          continue;
        }
        if (size !== asset.bytes) {
          fetchAsset.invalidateBundle?.(asset, "size-mismatch");
          lastReason = "size-mismatch";
          publish();
          continue;
        }

        job.phase = "verify";
        metric.status = "verify";
        const verifyStarted = now();
        let actual = null;
        try {
          actual = await digest(body);
        } catch {
          lastReason = "hash-mismatch";
        } finally {
          const elapsed = Math.max(0, now() - verifyStarted);
          metric.verifyMs += elapsed;
          verifyMs += elapsed;
        }
        if (actual !== asset.hash) {
          fetchAsset.invalidateBundle?.(asset, "hash-mismatch");
          lastReason = "hash-mismatch";
          publish();
          continue;
        }

        job.phase = "cache";
        metric.status = "cache";
        const cacheStarted = now();
        try {
          await store.put(asset, body);
        } catch {
          const elapsed = Math.max(0, now() - cacheStarted);
          metric.cacheWriteMs += elapsed;
          cacheWriteMs += elapsed;
          lastReason = "cache-write";
          publish();
          continue;
        }
        const elapsed = Math.max(0, now() - cacheStarted);
        metric.cacheWriteMs += elapsed;
        cacheWriteMs += elapsed;
        completeHash(asset);
        return;
      }

      if (cancelled) return;
      failHash(asset, {
        reason: lastReason,
        status: lastStatus,
        attempts: metric.attempts,
        at: now(),
        category: asset.category ?? null,
        phase: job.phase ?? "network",
      });
      markProgress();
      publish();
    } finally {
      activeCount = Math.max(0, activeCount - 1);
      if (active === job) active = null;
    }
  }

  async function drain(targets) {
    const pending = [];
    const seenHashes = new Set();
    for (const target of targets) {
      const members = membersByHash.get(target.hash ?? target.path) ?? [target];
      const primary = members[0];
      if (completedPaths.has(primary.path)) continue;
      const key = primary.hash ?? primary.path;
      if (seenHashes.has(key)) continue;
      seenHashes.add(key);
      pending.push(primary);
    }
    let cursor = 0;
    const workers = Array.from({ length: Math.max(1, Math.min(concurrency, pending.length || 1)) }, async () => {
      while (cursor < pending.length && !cancelled) {
        const asset = pending[cursor];
        cursor += 1;
        await processOne(asset);
      }
    });
    await Promise.all(workers);
  }

  async function run(targets) {
    controller = new AbortController();
    cancelled = false;
    startedAt ??= now();
    endedAt = null;
    setState("running");
    heartbeatTimer = setInterval(publish, Math.max(250, heartbeatMs));
    try {
      await drain(targets);
    } finally {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      controller = null;
    }
    if (cancelled) {
      endedAt = now();
      setState("cancelled");
      return snapshot();
    }
    active = null;
    endedAt = now();
    setState(failures.size === 0 ? "complete" : "failed");
    return snapshot();
  }

  return {
    getSnapshot: snapshot,
    getFailures: () => [...failures.entries()].map(([path, detail]) => ({ path, ...detail })),

    start() {
      if (state === "running") return runPromise;
      if (state === "paused") {
        this.resume();
        return runPromise;
      }
      runPromise = run(workQueue);
      return runPromise;
    },

    pause() {
      if (state !== "running") return false;
      pauseGate = new Deferred();
      setState("paused");
      return true;
    },

    resume() {
      if (state !== "paused") return false;
      const gate = pauseGate;
      pauseGate = null;
      setState("running");
      gate?.resolve();
      return true;
    },

    cancel() {
      if (state !== "running" && state !== "paused") return false;
      cancelled = true;
      controller?.abort();
      const gate = pauseGate;
      pauseGate = null;
      gate?.resolve();
      setState("cancelled");
      return true;
    },

    retryFailed() {
      // A second tap while a retry round is already draining must join that
      // round. Starting another set of workers here would duplicate bundle
      // transport and could make the same slice race into Cache Storage.
      if (state === "running" || state === "paused") return runPromise;
      const targets = workQueue.filter((asset) => !completedPaths.has(asset.path));
      if (targets.length === 0) {
        setState("complete");
        return Promise.resolve(snapshot());
      }
      for (const asset of targets) {
        const members = membersByHash.get(asset.hash ?? asset.path) ?? [asset];
        for (const member of members) {
          failures.delete(member.path);
          const metric = metrics.get(member.path);
          if (metric) {
            metric.attempts = 0;
            metric.status = "queued";
            metric.reason = null;
            metric.httpStatus = 0;
          }
        }
      }
      runPromise = run(targets);
      return runPromise;
    },
  };
}
