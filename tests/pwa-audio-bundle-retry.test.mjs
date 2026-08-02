import assert from "node:assert/strict";
import test from "node:test";

import { createAssetDownloadSession } from "../app/pwaDownloadSession.js";
import { createAssetFetcher } from "../app/pwaRuntime.js";

const hashOf = (seed) => `sha256-${String(seed).repeat(64).slice(0, 64)}`;
const digest = async (body) => hashOf(body[0]);
const bundlePath = "/pwa-bundles/audio-v1.bin";

const audioAssets = () => [
  {
    path: "/audio/a.mp3", bytes: 2, hash: hashOf(1), pack: "audio", category: "audio", criticality: "optional",
    audioChannel: "se", bundlePath, bundleOffset: 0, bundleBytes: 2, bundleLength: 4,
  },
  {
    path: "/audio/b.mp3", bytes: 2, hash: hashOf(2), pack: "audio", category: "audio", criticality: "optional",
    audioChannel: "se", bundlePath, bundleOffset: 2, bundleBytes: 2, bundleLength: 4,
  },
];

function memoryStore() {
  const entries = new Map();
  return {
    entries,
    has: async (asset) => entries.has(asset.hash),
    put: async (asset, body) => { entries.set(asset.hash, body); },
  };
}

function response(body, { status = 200, contentType = "application/octet-stream" } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => contentType },
    arrayBuffer: async () => body.slice().buffer,
  };
}

function sessionFor(sequence, { maxAttempts = 2, concurrency = 2 } = {}) {
  const requests = [];
  const store = memoryStore();
  const fetcher = createAssetFetcher({
    baseUrl: "https://example.test/Zombieee/",
    fetchImpl: async (url) => {
      requests.push(url);
      const next = sequence.shift();
      if (next instanceof Error) throw next;
      return next;
    },
  });
  const session = createAssetDownloadSession({
    assets: audioAssets(), fetchAsset: fetcher, store, digest, maxAttempts, concurrency,
  });
  return { session, store, requests };
}

test("audio bundle HTTP 503 is evicted, retried once for its round, and saves every verified slice", async () => {
  const { session, store, requests } = sessionFor([
    response(new Uint8Array(), { status: 503 }),
    response(new Uint8Array([1, 1, 2, 2])),
  ]);

  const final = await session.start();
  assert.equal(final.state, "complete");
  assert.equal(store.entries.size, 2);
  assert.equal(requests.length, 2, "one failed and one retry transport request only");
  assert.equal(final.requestCount, 2);
});

test("a corrupt bundle body is evicted after slice hash mismatch and the retry saves all slices", async () => {
  const { session, store, requests } = sessionFor([
    response(new Uint8Array([1, 1, 9, 9])),
    response(new Uint8Array([1, 1, 2, 2])),
  ]);

  const final = await session.start();
  assert.equal(final.state, "complete");
  assert.equal(store.entries.size, 2);
  assert.equal(requests.length, 2);
  assert.equal(final.metrics.find((metric) => metric.path === "/audio/a.mp3")?.attempts, 1);
  assert.equal(final.metrics.find((metric) => metric.path === "/audio/b.mp3")?.attempts, 2);
});

test("a malformed bundle length is evicted before any slice is accepted", async () => {
  const { session, store, requests } = sessionFor([
    response(new Uint8Array([1, 1, 2])),
    response(new Uint8Array([1, 1, 2, 2])),
  ]);

  const final = await session.start();
  assert.equal(final.state, "complete");
  assert.equal(store.entries.size, 2);
  assert.equal(requests.length, 2);
});

test("a bundle read exception is evicted so the retry reaches the network again", async () => {
  const { session, store, requests } = sessionFor([
    new Error("synthetic body read failure"),
    response(new Uint8Array([1, 1, 2, 2])),
  ]);

  const final = await session.start();
  assert.equal(final.state, "complete");
  assert.equal(store.entries.size, 2);
  assert.equal(requests.length, 2);
});

test("a repeated slice hash mismatch remains failed with its verification reason", async () => {
  const { session, store, requests } = sessionFor([
    response(new Uint8Array([1, 1, 9, 9])),
    response(new Uint8Array([1, 1, 9, 9])),
  ]);

  const final = await session.start();
  assert.equal(final.state, "failed");
  assert.equal(store.entries.size, 1, "only the independently verified slice is retained");
  assert.deepEqual(final.failedPaths, ["/audio/b.mp3"]);
  assert.equal(final.failures[0].reason, "hash-mismatch");
  assert.equal(requests.length, 2);
});

test("manual retry never re-fetches audio slices that already verified and stored", async () => {
  const { session, store, requests } = sessionFor([
    response(new Uint8Array([1, 1, 9, 9])),
    response(new Uint8Array([1, 1, 2, 2])),
  ], { maxAttempts: 1 });

  const first = await session.start();
  assert.equal(first.state, "failed");
  assert.equal(store.entries.size, 1);
  const retried = await session.retryFailed();
  assert.equal(retried.state, "complete");
  assert.equal(store.entries.size, 2);
  assert.equal(requests.length, 2, "the retry fetched a bundle only for the unresolved slice");
});

test("concurrent retry callers join one retry round and never duplicate the bundle request", async () => {
  const { session, requests } = sessionFor([
    response(new Uint8Array(), { status: 503 }),
    response(new Uint8Array([1, 1, 2, 2])),
  ], { maxAttempts: 1 });

  const first = await session.start();
  assert.equal(first.state, "failed");
  const [left, right] = await Promise.all([session.retryFailed(), session.retryFailed()]);
  assert.equal(left.state, "complete");
  assert.equal(right.state, "complete");
  assert.equal(requests.length, 2, "one initial and one shared retry request");
});
