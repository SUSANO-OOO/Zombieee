import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

test("metadata keeps the live response when storage fails and uses the last copy only when offline", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const scope = "https://example.test/Zombieee/";
  const request = new Request(new URL("asset-manifest.json", scope));
  const offline = new Error("network unavailable");
  const unavailable = new Error("storage unavailable");
  let storageFailure, live = Response.json({ version: "current" });
  let stored = Response.json({ version: "previous" });
  let onFetch;
  const cache = {
    async put(key, value) {
      assert.equal(key.url, request.url);
      if (storageFailure === "put") throw unavailable;
      stored = value;
    },
  };
  runInNewContext(source, {
    self: { registration: { scope }, addEventListener(type, listener) { if (type === "fetch") onFetch = listener; } },
    caches: {
      async open(name) {
        assert.equal(name, "zombieee-meta-v1");
        if (storageFailure === "open") throw unavailable;
        return cache;
      },
      async match(key, { cacheName }) {
        assert.equal(cacheName, "zombieee-meta-v1");
        assert.equal(key.url, request.url);
        if (storageFailure === "open") throw unavailable;
        return stored?.clone();
      },
    },
    async fetch() {
      if (!live) throw offline;
      return live.clone();
    },
    URL, Request, Response,
  });
  function get() {
    let result;
    onFetch({ request, respondWith(work) { result = work; } });
    return result;
  }
  for (storageFailure of ["put", "open"]) {
    assert.equal((await (await get()).json()).version, "current");
    assert.equal((await stored.clone().json()).version, "previous");
  }
  storageFailure = null;
  assert.equal((await (await get()).json()).version, "current");
  live = new Response("maintenance", { status: 503 });
  assert.equal((await get()).status, 503);
  live = new Response("<html>fallback</html>", { headers: { "content-type": "text/html" } });
  assert.equal(await (await get()).text(), "<html>fallback</html>");
  live = null;
  assert.equal((await (await get()).json()).version, "current");
  stored = null;
  await assert.rejects(get(), error => error === offline);
  storageFailure = "open";
  await assert.rejects(get(), error => error === offline);
});

test("state confirmation waits for an earlier asset clear rather than exposing the old pack", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const scope = "https://example.test/Zombieee/";
  const hash = `sha256-${"a".repeat(64)}`;
  const buckets = new Map([["zombieee-assets-v1", new Map([[`${scope}__pwa-asset__/${hash}`, new Response("x")]])]]);
  const listeners = new Map();
  let releaseDelete, deleteStarted = false;
  const deleteHeld = new Promise(resolve => { releaseDelete = resolve; });
  const caches = {
    async open(name) {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const entries = buckets.get(name);
      return {
        async keys() { return [...entries.keys()].map(url => ({ url })); },
        async match(key) { return entries.get(String(key?.url ?? key))?.clone(); },
      };
    },
    async delete(name) { deleteStarted = true; await deleteHeld; return buckets.delete(name); },
  };
  runInNewContext(source, {
    self: { registration: { scope }, addEventListener: (type, listener) => listeners.set(type, listener) },
    caches, URL, Response, Request, AbortController, setTimeout, clearTimeout,
  });
  function send(type) {
    const record = { reply: null, work: null };
    listeners.get("message")({ data: { type }, ports: [{ postMessage: value => { record.reply = value; } }], waitUntil: work => { record.work = work; } });
    return record;
  }
  const clear = send("pwa:clear-assets");
  const read = send("pwa:get-state");
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(deleteStarted, true);
  assert.equal(read.reply, null, "a read must not acknowledge the old cache while clearing is unresolved");
  releaseDelete();
  await Promise.all([clear.work, read.work]);
  assert.equal(clear.reply.type, "pwa:assets-cleared");
  assert.equal(read.reply.type, "pwa:state");
  assert.equal(read.reply.storedHashes.length, 0);
  assert.equal(read.reply.active, null);
});


test("a committed pack boots without enumerating the asset cache and reports genuinely missing files", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const scope = "https://example.test/Zombieee/";
  const key = hash => scope + "__pwa-asset__/" + hash;
  const [active, missing, previous, candidate, unrelated] = ["a", "b", "c", "d", "e"].map(letter => "sha256-" + letter.repeat(64));
  const metadata = {
    active: { version: "1.0.9", assets: [{ hash: active, bytes: 1 }, { hash: missing, bytes: 1 }] },
    previous: { version: "1.0.8", assets: [{ hash: previous, bytes: 1 }] },
  };
  const responses = new Map([active, previous, candidate, unrelated].map(hash => [key(hash), new Response("x")]));
  const listeners = new Map();
  let bulkReads = 0, allowBulk = false;
  const caches = {
    async open(name) {
      if (name === "zombieee-meta-v1") {
        return { async match(url) { return url === key("state.json") ? new Response(JSON.stringify(metadata)) : undefined; } };
      }
      assert.equal(name, "zombieee-assets-v1");
      return {
        async match(url) { return responses.get(url)?.clone(); },
        async keys() {
          bulkReads++;
          assert.ok(allowBulk, "a committed startup must not enumerate the whole cache");
          return [...responses.keys()].map(url => ({ url }));
        },
      };
    },
  };
  runInNewContext(source, {
    self: { registration: { scope }, addEventListener: (type, listener) => listeners.set(type, listener) },
    caches, URL, Response, Request, AbortController, setTimeout, clearTimeout,
  });
  function send(details) {
    let work, reply;
    listeners.get("message")({
      data: { type: "pwa:get-state", ...details },
      ports: [{ postMessage(value) { reply = value; } }],
      waitUntil(value) { work = value; },
    });
    return work.then(() => reply);
  }
  const state = await send({ checkManifestAssets: true });
  assert.equal(state.type, "pwa:state");
  assert.deepEqual([...state.storedHashes], [active, previous]);
  assert.equal(state.active.assets.length, 2);
  const update = await send({ checkManifestAssets: true, candidateHashes: [candidate, missing] });
  assert.deepEqual([...update.storedHashes], [active, previous, candidate]);
  assert.equal(bulkReads, 0);

  allowBulk = true;
  const full = await send({});
  assert.deepEqual([...full.storedHashes], [active, previous, candidate, unrelated]);
  assert.equal(bulkReads, 1);
});

test("a cold startup and a partially downloaded first install only read known asset keys", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const scope = "https://example.test/Zombieee/";
  const key = hash => scope + "__pwa-asset__/" + hash;
  const [downloaded, missing, unrelated] = ["a", "b", "c"].map(letter => "sha256-" + letter.repeat(64));
  const entries = new Map([downloaded, unrelated].map(hash => [key(hash), new Response("saved")]));
  const listeners = new Map();
  const matches = [];
  let opened = 0;
  const caches = {
    async open(name) {
      if (name === "zombieee-meta-v1") return { async match() { return undefined; } };
      assert.equal(name, "zombieee-assets-v1");
      opened++;
      return {
        async match(url) { matches.push(url); return entries.get(url)?.clone(); },
        async keys() { throw new Error("the cache inventory cannot be enumerated during this boot"); },
      };
    },
  };
  runInNewContext(source, {
    self: { registration: { scope }, addEventListener: (type, listener) => listeners.set(type, listener) },
    caches, URL, Response, Request, AbortController, setTimeout, clearTimeout,
  });
  function send({ candidateHashes } = {}) {
    let work, reply;
    listeners.get("message")({
      data: { type: "pwa:get-state", checkManifestAssets: true, candidateHashes },
      ports: [{ postMessage(value) { reply = value; } }],
      waitUntil(value) { work = value; },
    });
    return work.then(() => reply);
  }

  const boot = await send();
  assert.equal(boot.type, "pwa:state");
  assert.equal(boot.active, null);
  assert.deepEqual([...boot.storedHashes], []);
  assert.equal(opened, 0, "the first screen has no asset keys to read");

  const partial = await send({ candidateHashes: [downloaded, missing] });
  assert.equal(partial.type, "pwa:state");
  assert.equal(partial.active, null, "a partial download is not an installed pack");
  assert.deepEqual([...partial.storedHashes], [downloaded]);
  assert.deepEqual(matches, [key(downloaded), key(missing)]);
  assert.equal(opened, 1);
});
