import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { createAssetDownloadSession } from "../app/pwaDownloadSession.js";
import { createAssetFetcher } from "../app/pwaRuntime.js";

const bundlePath = "/pwa-bundles/audio-v1.bin";

const sha256 = (bytes) => `sha256-${createHash("sha256").update(bytes).digest("hex")}`;

function bundleFixture() {
  const slices = [
    Uint8Array.from([1, 1]),
    Uint8Array.from([2, 2]),
    Uint8Array.from([3, 3]),
  ];
  const body = Uint8Array.from(slices.flatMap((slice) => [...slice]));
  const assets = slices.map((slice, index) => ({
    path: `/audio/slice-${index}.mp3`,
    bytes: slice.byteLength,
    hash: sha256(slice),
    pack: "audio",
    category: "audio",
    criticality: "optional",
    audioChannel: "se",
    bundlePath,
    bundleOffset: index * slice.byteLength,
    bundleBytes: slice.byteLength,
    bundleLength: body.byteLength,
  }));
  return { assets, body };
}

function responseFor(body, { signal, delayMs = 0, stream = false } = {}) {
  const delayed = (value) => new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The operation was aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => resolve(value), delayMs);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("The operation was aborted", "AbortError"));
    }, { once: true });
  });

  if (stream) {
    const chunks = [body.slice(0, 2), body.slice(2, 4), body.slice(4, 6)];
    let index = 0;
    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/octet-stream" },
      body: {
        getReader() {
          return {
            read: async () => {
              if (index >= chunks.length) return { done: true, value: undefined };
              const value = chunks[index++];
              await new Promise((resolve) => setTimeout(resolve, delayMs));
              return { done: false, value };
            },
            cancel: async () => {},
          };
        },
      },
      arrayBuffer: async () => (await delayed(body.slice().buffer)),
    };
  }

  return {
    ok: true,
    status: 200,
    headers: { get: () => "application/octet-stream" },
    arrayBuffer: async () => (await delayed(body.slice().buffer)),
  };
}

function memoryStore({ failFirstWriteFor = null } = {}) {
  const entries = new Map();
  let failed = false;
  return {
    entries,
    has: async (asset) => entries.has(asset.hash),
    put: async (asset, body) => {
      if (!failed && asset.path === failFirstWriteFor) {
        failed = true;
        throw new Error("synthetic Cache Storage write failure");
      }
      entries.set(asset.hash, body);
    },
  };
}

function createSession({ fetchImpl, assets, store = memoryStore(), timeoutMs = 30, maxAttempts = 2 } = {}) {
  const fetcher = createAssetFetcher({
    baseUrl: "https://example.test/Zombieee/",
    fetchImpl,
    bundleRequestTimeoutMs: 1000,
    bundleStallTimeoutMs: 30,
    bundleFallbackTimeoutMs: 5000,
  });
  const session = createAssetDownloadSession({
    assets,
    fetchAsset: fetcher,
    store,
    digest: async (body) => sha256(body),
    timeoutMs,
    maxAttempts,
    concurrency: 3,
  });
  return { session, store };
}

test("shared bundle transport is not aborted by an individual asset timeout", async () => {
  const { assets, body } = bundleFixture();
  const requests = [];
  const { session, store } = createSession({
    assets,
    timeoutMs: 10,
    fetchImpl: async (_url, { signal }) => {
      requests.push(signal);
      return responseFor(body, { signal, delayMs: 60 });
    },
  });

  const final = await session.start();

  assert.equal(final.state, "complete");
  assert.equal(final.completedCount, 3);
  assert.equal(final.failedCount, 0);
  assert.equal(final.requestCount, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].aborted, false);
  assert.equal(store.entries.size, 3);
});

test("a slow but continuously progressing bundle may exceed the worker timeout", async () => {
  const { assets, body } = bundleFixture();
  const { session, store } = createSession({
    assets,
    timeoutMs: 10,
    fetchImpl: async (_url, { signal }) => responseFor(body, { signal, delayMs: 20, stream: true }),
  });

  const final = await session.start();

  assert.equal(final.state, "complete");
  assert.equal(final.requestCount, 1);
  assert.equal(store.entries.size, 3);
});

test("a truly stalled bundle becomes an explicit retryable stall failure", async () => {
  const { assets } = bundleFixture();
  const { session, store } = createSession({
    assets,
    timeoutMs: 1000,
    maxAttempts: 1,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "application/octet-stream" },
      body: {
        getReader: () => ({
          read: () => new Promise(() => {}),
          cancel: async () => {},
        }),
      },
    }),
  });

  const final = await session.start();

  assert.equal(final.state, "failed");
  assert.deepEqual(final.failures.map((failure) => failure.reason), ["stall", "stall", "stall"]);
  assert.equal(store.entries.size, 0);
});

test("a failed bundle transport is retried once for the shared transport, not per slice", async () => {
  const { assets, body } = bundleFixture();
  let requests = 0;
  const { session, store } = createSession({
    assets,
    timeoutMs: 100,
    fetchImpl: async (_url, { signal }) => {
      requests += 1;
      if (requests === 1) throw new Error("synthetic bundle network failure");
      return responseFor(body, { signal, delayMs: 1 });
    },
  });

  const final = await session.start();

  assert.equal(final.state, "complete");
  assert.equal(final.requestCount, 2);
  assert.equal(final.transportRetryCount, 1);
  assert.equal(requests, 2);
  assert.equal(store.entries.size, 3);
});

test("a Cache Storage write failure keeps the verified bundle reusable", async () => {
  const { assets, body } = bundleFixture();
  let requests = 0;
  const store = memoryStore({ failFirstWriteFor: assets[0].path });
  const { session } = createSession({
    assets,
    store,
    timeoutMs: 100,
    fetchImpl: async (_url, { signal }) => {
      requests += 1;
      return responseFor(body, { signal, delayMs: 1 });
    },
  });

  const final = await session.start();

  assert.equal(final.state, "complete");
  assert.equal(final.requestCount, 1);
  assert.equal(requests, 1);
  assert.equal(store.entries.size, 3);
});

test("session cancellation aborts the shared transport without discarding stored assets", async () => {
  const { assets, body } = bundleFixture();
  let requestStarted;
  let transportAborted = false;
  const started = new Promise((resolve) => { requestStarted = resolve; });
  const { session, store } = createSession({
    assets,
    timeoutMs: 1000,
    maxAttempts: 1,
    fetchImpl: async (_url, { signal }) => {
      requestStarted();
      signal.addEventListener("abort", () => { transportAborted = true; }, { once: true });
      return responseFor(body, { signal, delayMs: 1000 });
    },
  });

  const running = session.start();
  await started;
  session.cancel();
  const final = await running;

  assert.equal(final.state, "cancelled");
  assert.equal(transportAborted, true);
  assert.equal(store.entries.size, 0);
});
