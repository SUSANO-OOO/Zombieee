import assert from "node:assert/strict";
import test from "node:test";

import { createAssetDownloadSession } from "../app/pwaDownloadSession.js";

const hashOf = (seed) => `sha256-${String(seed).repeat(64).slice(0, 64)}`;

const asset = (path, seed, overrides = {}) => ({
  path,
  bytes: 4,
  hash: hashOf(seed),
  pack: "units",
  category: "unit",
  criticality: "critical",
  ...overrides,
});

/** Deterministic digest: the fixture body carries its own seed. */
const digest = async (body) => hashOf(new TextDecoder().decode(body).trim());

const bodyFor = (seed) => new TextEncoder().encode(String(seed).padEnd(4, " "));

function createStore() {
  const entries = new Map();
  return {
    entries,
    has: async (a) => entries.has(a.path),
    put: async (a, body) => { entries.set(a.path, body); },
  };
}

/** Fetcher that serves correct bodies unless a path is scripted to misbehave. */
function createFetcher(seedByPath, { failures = new Map(), onFetch, delayMs = 0 } = {}) {
  const calls = [];
  return {
    calls,
    fetchAsset: async (a, { signal }) => {
      calls.push(a.path);
      onFetch?.(a, signal);
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      const scripted = failures.get(a.path);
      if (scripted) {
        const remaining = scripted.times ?? Infinity;
        if (remaining > 0) {
          scripted.times = remaining - 1;
          if (scripted.mode === "http") return { ok: false, status: scripted.status ?? 503 };
          if (scripted.mode === "throw") throw new Error("network down");
          if (scripted.mode === "hash") return { ok: true, status: 200, body: bodyFor("z") };
          if (scripted.mode === "size") return { ok: true, status: 200, body: new Uint8Array(2) };
        }
      }
      return { ok: true, status: 200, body: bodyFor(seedByPath.get(a.path)) };
    },
  };
}

test("a clean run verifies and stores every asset", async () => {
  const assets = [asset("/a.webp", 1), asset("/b.webp", 2), asset("/c.webp", 3)];
  const seeds = new Map([["/a.webp", 1], ["/b.webp", 2], ["/c.webp", 3]]);
  const store = createStore();
  const { fetchAsset } = createFetcher(seeds);

  const session = createAssetDownloadSession({ assets, fetchAsset, store, digest });
  const final = await session.start();

  assert.equal(final.state, "complete");
  assert.equal(final.completedCount, 3);
  assert.equal(final.completedBytes, 12);
  assert.equal(final.remainingBytes, 0);
  assert.equal(final.ratio, 1);
  assert.equal(store.entries.size, 3);
});

test("progress reports counts, bytes, and the active category", async () => {
  const assets = [
    asset("/unit.webp", 1),
    asset("/bgm.ogg", 2, { category: "audio", pack: "audio", audioChannel: "bgm" }),
  ];
  const seeds = new Map([["/unit.webp", 1], ["/bgm.ogg", 2]]);
  const { fetchAsset } = createFetcher(seeds);
  const seen = [];

  const session = createAssetDownloadSession({
    assets,
    fetchAsset,
    store: createStore(),
    digest,
    concurrency: 1,
    onProgress: (snapshot) => seen.push(snapshot),
  });
  const final = await session.start();

  assert.ok(seen.some((snapshot) => snapshot.activeCategory === "audio"));
  assert.ok(seen.some((snapshot) => snapshot.completedCount === 1 && snapshot.completedBytes === 4));
  assert.equal(final.completedCount, 2);
  assert.equal(final.metrics.length, 2);
  assert.ok(final.metrics.every((metric) => metric.status === "complete"));
  assert.ok(final.metrics.every((metric) => metric.attempts === 1));
  assert.ok(final.metrics.every((metric) => typeof metric.queueWaitMs === "number"));
  assert.ok(final.metrics.every((metric) => typeof metric.networkMs === "number"));
});

test("priority queue starts shell and first-play work before deferred work", async () => {
  const assets = [
    asset("/optional.webp", 1, { installTier: "optional", installPriority: 80 }),
    asset("/shell.webp", 2, { installTier: "shell", installPriority: 0 }),
    asset("/first-play.webp", 3, { installTier: "first-play", installPriority: 10 }),
  ];
  const seeds = new Map([["/optional.webp", 1], ["/shell.webp", 2], ["/first-play.webp", 3]]);
  const { fetchAsset, calls } = createFetcher(seeds);
  const session = createAssetDownloadSession({
    assets,
    fetchAsset,
    store: createStore(),
    digest,
    concurrency: 1,
  });

  await session.start();
  assert.deepEqual(calls, ["/shell.webp", "/first-play.webp", "/optional.webp"]);
});

test("concurrency never exceeds the configured mobile cap", async () => {
  const assets = Array.from({ length: 6 }, (_, index) => asset(`/a${index}.webp`, index));
  const seeds = new Map(assets.map((a, index) => [a.path, index]));
  let active = 0;
  let peak = 0;
  const { fetchAsset } = createFetcher(seeds, {
    onFetch: () => { active += 1; peak = Math.max(peak, active); },
  });
  const tracked = async (a, context) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return await fetchAsset(a, context);
    } finally {
      active -= 1;
    }
  };

  const session = createAssetDownloadSession({
    assets, fetchAsset: tracked, store: createStore(), digest, concurrency: 2,
  });
  await session.start();
  assert.ok(peak <= 2, `peak concurrency ${peak} exceeded the cap`);
});

test("pause halts new work and resume finishes the run", async () => {
  const assets = Array.from({ length: 6 }, (_, index) => asset(`/a${index}.webp`, index));
  const seeds = new Map(assets.map((a, index) => [a.path, index]));
  const store = createStore();
  const { fetchAsset, calls } = createFetcher(seeds, { delayMs: 4 });

  const session = createAssetDownloadSession({
    assets, fetchAsset, store, digest, concurrency: 1,
  });
  const running = session.start();

  await new Promise((resolve) => setTimeout(resolve, 6));
  session.pause();
  assert.equal(session.getSnapshot().state, "paused");
  await new Promise((resolve) => setTimeout(resolve, 10));
  const pausedCalls = calls.length;
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(calls.length, pausedCalls, "no new requests may start while paused");
  assert.ok(pausedCalls < 6, "the run must not have drained before pausing");

  session.resume();
  const final = await running;
  assert.equal(final.state, "complete");
  assert.equal(final.completedCount, 6);
});

test("cancel keeps verified assets so a later start resumes instead of restarting", async () => {
  const assets = Array.from({ length: 6 }, (_, index) => asset(`/a${index}.webp`, index));
  const seeds = new Map(assets.map((a, index) => [a.path, index]));
  const store = createStore();
  const first = createFetcher(seeds, { delayMs: 4 });

  const session = createAssetDownloadSession({
    assets, fetchAsset: first.fetchAsset, store, digest, concurrency: 1,
  });
  const running = session.start();
  await new Promise((resolve) => setTimeout(resolve, 10));
  session.cancel();
  const cancelled = await running;

  assert.equal(cancelled.state, "cancelled");
  assert.ok(store.entries.size >= 1, "verified assets survive cancellation");
  assert.ok(store.entries.size < 6);

  const alreadyStored = store.entries.size;
  const second = createFetcher(seeds);
  const resumed = createAssetDownloadSession({
    assets, fetchAsset: second.fetchAsset, store, digest, concurrency: 1,
  });
  const final = await resumed.start();

  assert.equal(final.state, "complete");
  assert.equal(store.entries.size, 6);
  assert.equal(second.calls.length, 6 - alreadyStored, "stored assets are not re-downloaded");
});

test("one failing asset does not block the rest of the queue", async () => {
  const assets = [asset("/a.webp", 1), asset("/bad.webp", 2), asset("/c.webp", 3)];
  const seeds = new Map([["/a.webp", 1], ["/bad.webp", 2], ["/c.webp", 3]]);
  const store = createStore();
  const { fetchAsset } = createFetcher(seeds, {
    failures: new Map([["/bad.webp", { mode: "http", status: 503 }]]),
  });

  const session = createAssetDownloadSession({
    assets, fetchAsset, store, digest, maxAttempts: 2,
  });
  const final = await session.start();

  assert.equal(final.state, "failed");
  assert.equal(final.completedCount, 2);
  assert.deepEqual(final.failedPaths, ["/bad.webp"]);
  assert.equal(store.entries.has("/a.webp"), true);
  assert.equal(store.entries.has("/c.webp"), true);
  assert.equal(session.getFailures()[0].reason, "http");
  assert.equal(session.getFailures()[0].status, 503);
});

test("a hash mismatch is rejected and never written to the store", async () => {
  const assets = [asset("/tampered.webp", 1)];
  const seeds = new Map([["/tampered.webp", 1]]);
  const store = createStore();
  const { fetchAsset } = createFetcher(seeds, {
    failures: new Map([["/tampered.webp", { mode: "hash" }]]),
  });

  const session = createAssetDownloadSession({
    assets, fetchAsset, store, digest, maxAttempts: 2,
  });
  const final = await session.start();

  assert.equal(final.state, "failed");
  assert.equal(store.entries.size, 0, "a mismatched body must not be stored");
  assert.equal(session.getFailures()[0].reason, "hash-mismatch");
});

test("a truncated body is rejected on size before hashing", async () => {
  const assets = [asset("/short.webp", 1)];
  const store = createStore();
  const { fetchAsset } = createFetcher(new Map([["/short.webp", 1]]), {
    failures: new Map([["/short.webp", { mode: "size" }]]),
  });

  const session = createAssetDownloadSession({
    assets, fetchAsset, store, digest, maxAttempts: 1,
  });
  const final = await session.start();
  assert.equal(final.state, "failed");
  assert.equal(session.getFailures()[0].reason, "size-mismatch");
  assert.equal(store.entries.size, 0);
});

test("retry re-attempts only failed assets and can reach a complete run", async () => {
  const assets = [asset("/a.webp", 1), asset("/flaky.webp", 2)];
  const seeds = new Map([["/a.webp", 1], ["/flaky.webp", 2]]);
  const store = createStore();
  const failures = new Map([["/flaky.webp", { mode: "http", status: 503, times: 2 }]]);
  const { fetchAsset, calls } = createFetcher(seeds, { failures });

  const session = createAssetDownloadSession({
    assets, fetchAsset, store, digest, maxAttempts: 2,
  });
  const first = await session.start();
  assert.equal(first.state, "failed");
  assert.deepEqual(first.failedPaths, ["/flaky.webp"]);

  calls.length = 0;
  const retried = await session.retryFailed();

  assert.equal(retried.state, "complete");
  assert.equal(retried.failedCount, 0);
  assert.deepEqual(calls, ["/flaky.webp"], "only the failed asset is re-requested");
  assert.equal(store.entries.size, 2);
});

test("a transient network error recovers within the attempt budget", async () => {
  const assets = [asset("/a.webp", 1)];
  const store = createStore();
  const { fetchAsset, calls } = createFetcher(new Map([["/a.webp", 1]]), {
    failures: new Map([["/a.webp", { mode: "throw", times: 1 }]]),
  });

  const session = createAssetDownloadSession({
    assets, fetchAsset, store, digest, maxAttempts: 3,
  });
  const final = await session.start();

  assert.equal(final.state, "complete");
  assert.equal(calls.length, 2);
  assert.equal(store.entries.size, 1);
});

test("assets sharing one content hash are fetched once and counted once", async () => {
  const assets = [asset("/a.webp", 7), asset("/b.webp", 7)];
  const store = createStore();
  const { fetchAsset, calls } = createFetcher(new Map([["/a.webp", 7], ["/b.webp", 7]]));

  const session = createAssetDownloadSession({
    assets, fetchAsset, store, digest, concurrency: 1,
  });
  const final = await session.start();

  assert.equal(final.state, "complete");
  assert.equal(final.completedCount, 2);
  assert.equal(final.completedBytes, 4, "shared bytes are counted a single time");
  assert.equal(calls.length, 1, "shared bytes travel the network a single time");
});

test("an already-stored asset is skipped without any request", async () => {
  const assets = [asset("/a.webp", 1), asset("/b.webp", 2)];
  const store = createStore();
  await store.put(assets[0], bodyFor(1));
  const { fetchAsset, calls } = createFetcher(new Map([["/a.webp", 1], ["/b.webp", 2]]));

  const session = createAssetDownloadSession({ assets, fetchAsset, store, digest });
  const final = await session.start();

  assert.equal(final.state, "complete");
  assert.deepEqual(calls, ["/b.webp"]);
});

test("an empty queue completes immediately", async () => {
  const session = createAssetDownloadSession({
    assets: [], fetchAsset: async () => ({ ok: true, body: bodyFor(1) }), store: createStore(), digest,
  });
  const final = await session.start();
  assert.equal(final.state, "complete");
  assert.equal(final.ratio, 1);
  assert.equal(final.totalCount, 0);
});

test("pause, resume, and cancel are rejected from states that cannot honour them", async () => {
  const session = createAssetDownloadSession({
    assets: [asset("/a.webp", 1)],
    fetchAsset: async () => ({ ok: true, status: 200, body: bodyFor(1) }),
    store: createStore(),
    digest,
  });
  assert.equal(session.pause(), false, "an idle session cannot pause");
  assert.equal(session.resume(), false, "an idle session cannot resume");
  assert.equal(session.cancel(), false, "an idle session cannot cancel");
  await session.start();
  assert.equal(session.pause(), false, "a completed session cannot pause");
});
