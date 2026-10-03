import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

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
