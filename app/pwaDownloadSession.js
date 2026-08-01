// Version 0.9.8.2 resumable, staged PWA download session.
//
// The session deliberately knows nothing about DOM or Cache Storage. Callers
// inject fetch, digest, and storage operations, which keeps the same queue and
// diagnostics testable in node:test and in a real browser.

import { distinctDownloadBytes, sortDownloadAssets } from "./pwaAssetManifest.js";

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

class Deferred {
  constructor() {
    this.promise = new Promise((resolve) => { this.resolve = resolve; });
  }
}

/**
 * @param {object} options
 * @param {Array} options.assets manifest entries to fetch
 * @param {(asset: object, context: {signal: AbortSignal}) => Promise<{ok: boolean, status?: number, body?: Uint8Array}>} options.fetchAsset
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
  const queue = sortDownloadAssets(Array.isArray(assets) ? assets : []);
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
      category: asset.category ?? null,
      criticality: asset.criticality ?? null,
      pack: asset.pack ?? null,
      installTier: asset.installTier ?? null,
      attempts: 0,
      status: "queued",
      reason: null,
      httpStatus: 0,
      fetchedBytes: 0,
      retryFetchedBytes: 0,
      queueWaitMs: null,
      networkMs: 0,
      verifyMs: 0,
      cacheWriteMs: 0,
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
      maxObservedConcurrency,
      // Per-asset timing is intentionally PII-free and is the evidence needed
      // to distinguish a network stall from hash or Cache Storage work.
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

  function completeAsset(asset, metric, source = "network") {
    completedPaths.add(asset.path);
    metric.status = source === "cache" ? "cache-hit" : "complete";
    metric.completedAt = now();
    if (metric.queueWaitMs == null && metric.startedAt != null) {
      metric.queueWaitMs = Math.max(0, metric.startedAt - (startedAt ?? metric.startedAt));
    }
    if (!completedHashes.has(asset.hash)) {
      completedHashes.add(asset.hash);
      completedBytes += asset.bytes;
    }
    failures.delete(asset.path);
    markProgress();
    publish();
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
      // path without a second request.
      if (completedHashes.has(asset.hash) || (store.has && await store.has(asset))) {
        completeAsset(asset, metric, "cache");
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
          response = await fetchAsset(asset, { signal: abort.signal });
        } catch (error) {
          if (cancelled) return;
          lastReason = error?.name === "AbortError" ? "timeout" : "network";
          lastStatus = 0;
        } finally {
          clearTimeout(timer);
          outerSignal?.removeEventListener("abort", relay);
          metric.networkMs += Math.max(0, now() - networkStarted);
        }
        if (!response) continue;

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
          lastReason = "http";
          publish();
          continue;
        }
        if (size !== asset.bytes) {
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
          metric.verifyMs += Math.max(0, now() - verifyStarted);
        }
        if (actual !== asset.hash) {
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
          metric.cacheWriteMs += Math.max(0, now() - cacheStarted);
          lastReason = "cache-write";
          publish();
          continue;
        }
        metric.cacheWriteMs += Math.max(0, now() - cacheStarted);
        completeAsset(asset, metric);
        return;
      }

      if (cancelled) return;
      metric.status = "failed";
      metric.reason = lastReason;
      metric.httpStatus = lastStatus;
      failures.set(asset.path, {
        reason: lastReason,
        status: lastStatus,
        attempts: metric.attempts,
        at: now(),
        category: asset.category ?? null,
        installTier: asset.installTier ?? null,
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
    const pending = targets.filter((asset) => !completedPaths.has(asset.path));
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
      runPromise = run(queue);
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
      const targets = queue.filter((asset) => !completedPaths.has(asset.path));
      if (targets.length === 0) {
        setState("complete");
        return Promise.resolve(snapshot());
      }
      for (const asset of targets) {
        failures.delete(asset.path);
        const metric = metrics.get(asset.path);
        if (metric) {
          metric.attempts = 0;
          metric.status = "queued";
          metric.reason = null;
          metric.httpStatus = 0;
        }
      }
      runPromise = run(targets);
      return runPromise;
    },
  };
}
