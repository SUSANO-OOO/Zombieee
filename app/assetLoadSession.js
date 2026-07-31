// Budgets for preparing battle assets.
//
// These exist to guarantee a terminal state: Issue #113 was an asset session
// that could wait forever, so every session must finish, succeed or fail, and
// offer a retry. The budget only has to be generous enough that a healthy
// connection is not mistaken for a broken one.
//
// The original 12s whole-session budget was measured on a LAN candidate. It is
// far too small for the published origin: the eleven critical unit sheets are
// 14.1MB, and at the concurrency below they took 28.5s to transfer from
// GitHub Pages on an ordinary home connection, with a single 1.75MB sheet
// taking 11.5s on its own. The public site therefore reported "戦闘アセットの
// 準備に失敗" and left the deploy button disabled on a perfectly good network.
//
// The session budget must also exceed the per-image timeout in
// boundedImageLoader.js, or the session gives up before any one image is even
// allowed to time out. `tests/asset-load-session.test.mjs` enforces that.
//
// Concurrency deliberately stays at 2. It bounds decode memory on phones, which
// is what Issue #113 was about, and raising it is not a change to make without
// device evidence.
export const ASSET_LOAD_SESSION_DEADLINE_MS = 90_000;
export const OPTIONAL_ASSET_LOAD_DEADLINE_MS = 20_000;
export const ASSET_LOAD_MAX_CONCURRENCY = 2;

function normalizedJobs(jobs) {
  const byPath = new Map();
  for (const job of Array.isArray(jobs) ? jobs : []) {
    if (!job || typeof job.path !== "string" || typeof job.run !== "function") continue;
    const previous = byPath.get(job.path);
    if (!previous) {
      byPath.set(job.path, job);
      continue;
    }
    byPath.set(job.path, {
      ...previous,
      run: async (signal) => {
        const result = await previous.run(signal);
        await job.run(signal);
        return result;
      },
    });
  }
  return [...byPath.values()];
}

export function selectRetryAssetJobs(jobs, paths) {
  const retryPaths = new Set(Array.isArray(paths) ? paths : paths instanceof Set ? paths : []);
  return normalizedJobs(jobs).filter((job) => retryPaths.has(job.path));
}

export function assetFailureReason(error) {
  if (error?.name === "TimeoutError") return "timeout";
  if (error?.name === "AbortError") return "cancelled";
  if (error?.name === "ImageDecodeError") return "decode";
  if (error?.name === "ImageLoadError") return "http";
  return "unknown";
}

export async function runAssetLoadSession({
  jobs,
  generation,
  reason,
  signal,
  abort,
  deadlineMs = ASSET_LOAD_SESSION_DEADLINE_MS,
  concurrency = ASSET_LOAD_MAX_CONCURRENCY,
  onProgress = () => {},
  now = Date.now,
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
} = {}) {
  const queue = normalizedJobs(jobs);
  const startedAt = now();
  const boundedConcurrency = Math.max(1, Math.min(4, Math.floor(concurrency) || 1));
  const completed = new Set();
  const failures = new Map();
  let cursor = 0;
  let deadlineReached = false;
  let deadlineTimer = null;

  const snapshot = (active = null) => ({
    generation,
    reason,
    total: queue.length,
    completed: completed.size,
    failed: failures.size,
    pending: queue.length - completed.size,
    activeCategory: active?.category ?? null,
    pendingPaths: queue.filter((job) => !completed.has(job.path)).map((job) => job.path),
    elapsedMs: Math.max(0, now() - startedAt),
  });
  const publish = (active = null) => onProgress(Object.freeze(snapshot(active)));
  publish();

  if (queue.length === 0) {
    return Object.freeze({
      ...snapshot(),
      status: "ready",
      failures: [],
      deadlineReached: false,
    });
  }

  let settleDeadline;
  const deadline = new Promise((resolve) => { settleDeadline = resolve; });
  deadlineTimer = setTimer(() => {
    deadlineReached = true;
    settleDeadline("deadline");
  }, Math.max(1, Math.floor(deadlineMs) || ASSET_LOAD_SESSION_DEADLINE_MS));

  const worker = async () => {
    while (!deadlineReached && !signal?.aborted) {
      const index = cursor;
      cursor += 1;
      if (index >= queue.length) return;
      const job = queue[index];
      publish(job);
      try {
        await job.run(signal);
      } catch (error) {
        failures.set(job.path, {
          path: job.path,
          category: job.category ?? "asset",
          reason: assetFailureReason(error),
        });
      } finally {
        completed.add(job.path);
        publish();
      }
    }
  };
  const workers = Array.from(
    { length: Math.min(boundedConcurrency, queue.length) },
    () => worker(),
  );
  const workersDone = Promise.allSettled(workers);
  await Promise.race([workersDone, deadline]);

  if (deadlineReached) {
    abort?.();
    for (const job of queue) {
      if (completed.has(job.path)) continue;
      failures.set(job.path, {
        path: job.path,
        category: job.category ?? "asset",
        reason: "timeout",
      });
      completed.add(job.path);
    }
  } else if (deadlineTimer !== null) {
    clearTimer(deadlineTimer);
  }
  publish();

  return Object.freeze({
    ...snapshot(),
    status: failures.size > 0 ? "error" : "ready",
    failures: [...failures.values()].map((failure) => Object.freeze({ ...failure })),
    deadlineReached,
  });
}
