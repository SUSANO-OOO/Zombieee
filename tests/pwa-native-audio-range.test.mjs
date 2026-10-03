import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile("public/sw.js", "utf8");
const helper = source.slice(source.indexOf("async function cachedAudioResponse"), source.indexOf("async function respondForAsset"));
const cachedAudioResponse = vm.runInNewContext(`${helper}\ncachedAudioResponse`, { Response, Headers });
const whole = () => new Response(new Uint8Array([0, 1, 2, 3, 4, 5]), { headers: { "content-type": "audio/mpeg", "content-length": "6", "x-pwa-asset-hash": "verified-whole-hash" } });
const request = range => new Request("https://example.test/Zombieee/song.mp3", { headers: range ? { Range: range } : {} });

test("offline native audio serves exact bounded, open-ended and suffix ranges", async () => {
  for (const [range, contentRange, expected] of [["bytes=0-1", "bytes 0-1/6", [0, 1]], ["bytes=3-", "bytes 3-5/6", [3, 4, 5]], ["bytes=-2", "bytes 4-5/6", [4, 5]], ["bytes=4-99", "bytes 4-5/6", [4, 5]], ["bytes=-99", "bytes 0-5/6", [0, 1, 2, 3, 4, 5]]]) {
    const response = await cachedAudioResponse(request(range), whole());
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-range"), contentRange);
    assert.equal(response.headers.get("content-length"), String(expected.length));
    assert.equal(response.headers.get("accept-ranges"), "bytes");
    assert.equal(response.headers.get("content-type"), "audio/mpeg");
    assert.equal(response.headers.get("x-pwa-asset-hash"), null);
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], expected);
  }
});

test("unsatisfiable media ranges return 416 without a full-file body", async () => {
  for (const range of ["bytes=6-", "bytes=4-2", "bytes=-0", "bytes=999999999999999999999-"]) {
    const response = await cachedAudioResponse(request(range), whole());
    assert.equal(response.status, 416);
    assert.equal(response.headers.get("content-range"), "bytes */6");
    assert.equal((await response.arrayBuffer()).byteLength, 0);
  }
});

test("whole cache and its verified hash are preserved; unsupported multi-range is ignored", async () => {
  const original = whole();
  await cachedAudioResponse(request("bytes=0-1"), original.clone());
  const response = await cachedAudioResponse(request(), original);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-pwa-asset-hash"), "verified-whole-hash");
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [0, 1, 2, 3, 4, 5]);
  assert.equal((await cachedAudioResponse(request("bytes=0-1,4-5"), whole())).status, 200);
  assert.match(source, /asset\.category === "audio" \? cachedAudioResponse\(request, cached\)/u);
  const store = source.slice(source.indexOf("async function storeAsset"), source.indexOf("async function cachedAudioResponse"));
  assert.match(store, /response\.status !== 200/u);
  assert.ok(store.indexOf("sha256(buffer)") < store.indexOf("cache.put"));
});
