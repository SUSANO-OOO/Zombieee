// Version 0.9.6 PWA bulk download session.
//
// Drives the first-install download and every later differential update. The
// session is deliberately free of DOM and Cache Storage details: callers inject
// `fetchAsset`, `digest`, and `store`, so the same logic runs under node:test
// and in the browser.
//
// Guarantees required by Issue #114:
// - pause, resume, retry, and cancel without losing completed work;
// - every stored asset is hash-verified before it counts as complete;
// - a failed asset never blocks the rest of the queue;
// - retry re-attempts only failed or still-pending assets;
// - no full-page reload is ever used as a recovery path.

import { distinctDownloadBytes, sortManifestAssets } from "./pwaAssetManifest.js";

export const DOWNLOAD_STATES = Object.freeze([
  "idle",
  "running",
  "paused",
  "cancelled",
  "complete",
  "failed",
]);

/** Mobile networks behave far better with a small, fixed request window. */
export const DEFAULT_DOWNLOAD_CONCURRENCY = 3;
export const DEFAULT_ASSET_TIMEOUT_MS = 30000;
export const DEFAULT_MAX_ATTEMPTS = 3;

function hex(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

/** Default digest uses Web Crypto; tests inject a deterministic substitute. */
async function subtleDigest(bytes) {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  // Copy into a plain ArrayBuffer so callers may pass views over pooled buffers.
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
 * Creates a resumable, verifiable download session over a manifest slice.
 *
 * @param {object} options
 * @param {Array} options.assets manifest entries to fetch
 * @param {(asset: object, context: {signal: AbortSignal}) => Promise<{ok: boolean, status?: number, body?: Uint8Array}>} options.fetchAsset
 * @param {{put: Function, has?: Function}} options.store cache-backed asset store
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
  now = () => Date.now(),
} = {}) {
  const queue = sortManifestAssets(Array.isArray(assets) ? assets : []);
  const totalCount = queue.length;
  const totalBytes = distinctDownloadBytes(queue);

  const completedPaths = new Set();
  const failures = new Map(); // path -> { reason, status, attempts }
  // A hash completed once in this session satisfies any later path sharing it,
  // so duplicate content never travels the network twice.
  const completedHashes = new Set();

  let state = "idle";
  let completedBytes = 0;
  let activeCategory = null;
  let pauseGate = null;
  let controller = null;
  let runPromise = null;
  let cancelled = false;

  function snapshot() {
    return {
      state,
      totalCount,
      totalBytes,
      completedCount: completedPaths.size,
      completedBytes,
      remainingCount: totalCount - completedPaths.size,
      remainingBytes: Math.max(0, totalBytes - completedBytes),
      failedCount: failures.size,
      failedPaths: [...failures.keys()],
      activeCategory,
      ratio: totalBytes > 0 ? Math.min(1, completedBytes / totalBytes) : (totalCount === 0 ? 1 : 0),
    };
  }

  function publish() {
    onProgress(snapshot());
  }

  function setState(next) {
    if (state === next) return;
    state = next;
    publish();
  }

  async function waitWhilePaused() {
    while (pauseGate && !cancelled) await pauseGate.promise;
  }

  async function processOne(asset) {
    await waitWhilePaused();
    if (cancelled) return;

    activeCategory = asset.category;

    // Content already present locally (previous session or shared hash).
    if (completedHashes.has(asset.hash) || (store.has && await store.has(asset))) {
      completedPaths.add(asset.path);
      if (!completedHashes.has(asset.hash)) {
        completedHashes.add(asset.hash);
        completedBytes += asset.bytes;
      }
      failures.delete(asset.path);
      publish();
      return;
    }

    let attempt = 0;
    let lastReason = "unknown";
    let lastStatus = 0;

    while (attempt < maxAttempts && !cancelled) {
      attempt += 1;
      await waitWhilePaused();
      if (cancelled) return;

      const abort = new AbortController();
      const outerSignal = controller?.signal;
      const relay = () => abort.abort();
      outerSignal?.addEventListener("abort", relay, { once: true });
      const timer = setTimeout(() => abort.abort(), timeoutMs);

      try {
        const response = await fetchAsset(asset, { signal: abort.signal });
        if (!response?.ok) {
          lastReason = "http";
          lastStatus = response?.status ?? 0;
          continue;
        }
        const body = response.body;
        const size = byteLengthOf(body);
        if (size !== asset.bytes) {
          lastReason = "size-mismatch";
          lastStatus = response.status ?? 200;
          continue;
        }
        const actual = await digest(body);
        if (actual !== asset.hash) {
          lastReason = "hash-mismatch";
          lastStatus = response.status ?? 200;
          continue;
        }
        await store.put(asset, body);

        completedPaths.add(asset.path);
        if (!completedHashes.has(asset.hash)) {
          completedHashes.add(asset.hash);
          completedBytes += asset.bytes;
        }
        failures.delete(asset.path);
        publish();
        return;
      } catch (error) {
        if (cancelled) return;
        lastReason = error?.name === "AbortError" ? "timeout" : "network";
        lastStatus = 0;
      } finally {
        clearTimeout(timer);
        outerSignal?.removeEventListener("abort", relay);
      }
    }

    if (cancelled) return;
    // One asset failing must never stall the queue; record and move on.
    failures.set(asset.path, { reason: lastReason, status: lastStatus, attempts: attempt, at: now() });
    publish();
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
    setState("running");
    try {
      await drain(targets);
    } finally {
      controller = null;
    }
    if (cancelled) {
      setState("cancelled");
      return snapshot();
    }
    activeCategory = null;
    setState(failures.size === 0 ? "complete" : "failed");
    return snapshot();
  }

  return {
    getSnapshot: snapshot,
    getFailures: () => [...failures.entries()].map(([path, detail]) => ({ path, ...detail })),

    /** Starts, or rejoins an in-flight run. Never starts two runs at once. */
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

    /**
     * Cancels the run. Completed and verified assets stay in the store, so a
     * later start() resumes rather than restarting from zero.
     */
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

    /** Re-attempts only failed and still-pending assets. */
    retryFailed() {
      const targets = queue.filter((asset) => !completedPaths.has(asset.path));
      if (targets.length === 0) {
        setState("complete");
        return Promise.resolve(snapshot());
      }
      for (const asset of targets) failures.delete(asset.path);
      runPromise = run(targets);
      return runPromise;
    },
  };
}
