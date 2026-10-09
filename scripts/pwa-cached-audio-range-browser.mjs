import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pwaBrowserType } from "./pwa-browser-runtime.mjs";
import { disconnectPwaOrigin } from "./pwa-offline-origin.mjs";
import { V100_ENDING_MUSIC_ADDITION as song } from "./v100-release-asset-contract.mjs";
import { serveNativeAudioQaBytes } from "./native-audio-qa-origin.mjs";

const engine = process.env.PWA_AUDIO_RANGE_ENGINE ?? "webkit";
const out = path.resolve(process.env.PWA_AUDIO_RANGE_OUT ?? "outputs/pwa-cached-audio-range");
await mkdir(out, { recursive: true });
const worker = await readFile(new URL("../public/sw.js", import.meta.url));
const store = await readFile(new URL("../app/pwaAssetStore.js", import.meta.url));
const songBytes = await readFile(new URL(`../public${song.path}`, import.meta.url));
assert.equal(songBytes.length, song.bytes);
assert.equal(`sha256-${createHash("sha256").update(songBytes).digest("hex")}`, song.hash);
const manifest = { version: "1.0.0", releaseSha: "native-audio-range-fixture", assets: [{ ...song, category: "audio", audioType: "audio/mpeg" }] };
const server = createServer((request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  const send = (status, type, body) => { response.writeHead(status, { "content-type": type === "text/html" ? "text/html; charset=utf-8" : type, "content-length": Buffer.byteLength(body), "cache-control": "no-store" }); response.end(body); };
  if (pathname === "/Zombieee/sw.js") return send(200, "application/javascript", worker);
  if (pathname === "/Zombieee/pwaAssetStore.js") return send(200, "application/javascript", store);
  if (pathname === `/Zombieee${song.path}` || pathname === "/Zombieee/network-control.mp3") return serveNativeAudioQaBytes(request, response, songBytes);
  if (pathname === "/Zombieee/pwa-shell.json") return send(200, "application/json", JSON.stringify({ files: ["assets/probe.js"] }));
  if (pathname === "/Zombieee/assets/probe.js") return send(200, "application/javascript", "window.nativeAudioFixture=true;");
  if (pathname === "/Zombieee/asset-manifest.json") return send(200, "application/json", JSON.stringify(manifest));
  if (["/Zombieee/release.json", "/Zombieee/manifest.webmanifest"].includes(pathname)) return send(200, "application/json", "{}");
  if (pathname === "/Zombieee/" || pathname === "/Zombieee/v100/") return send(200, "text/html", `<!doctype html><html><head><meta name="github-pages-release" content="${manifest.releaseSha}"></head><body><button id="play">音楽を再生</button><script src="/Zombieee/assets/probe.js"></script></body></html>`);
  return send(404, "text/plain", "fixture path missing");
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const scope = `http://127.0.0.1:${server.address().port}/Zombieee/`;
const browser = await (await pwaBrowserType(engine)).launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const report = { engine, status: "failed", evidenceKind: "native SW/Cache Storage and original MP3 transport fixture; seeks are explicit", workerSha256: createHash("sha256").update(worker).digest("hex"), song, mediaResponses: [], pageErrors: [], mediaAborts: [] };
page.on("requestfailed", request => {
  const entry = { request: request.url(), error: request.failure() };
  if ((request.url().includes(song.path) || request.url().endsWith("/network-control.mp3")) && /ERR_ABORTED|cancelled|canceled/iu.test(request.failure()?.errorText ?? "")) report.mediaAborts.push(entry);
  else report.pageErrors.push(entry);
});
page.on("pageerror", error => report.pageErrors.push(String(error)));
page.on("response", response => { if (response.url().includes("/credits/")) report.mediaResponses.push({ status: response.status(), range: response.request().headers().range ?? null, fromServiceWorker: response.fromServiceWorker() }); });
try {
  await page.goto(scope);
  report.networkControl = await page.evaluate(async scope => {
    const audio = document.createElement("audio"); audio.preload = "metadata"; audio.src = new URL("network-control.mp3", scope); document.body.append(audio);
    const support = audio.canPlayType("audio/mpeg");
    const state = await new Promise(resolve => { audio.onloadedmetadata = () => resolve({ readyState: audio.readyState, duration: audio.duration }); audio.onerror = () => resolve({ error: audio.error?.code }); setTimeout(() => resolve({ timeout: true, readyState: audio.readyState, networkState: audio.networkState, error: audio.error?.code }), 8000); });
    audio.removeAttribute("src"); audio.load(); audio.remove(); return { support, ...state };
  }, scope);
  assert.ok(report.networkControl.readyState > 0, JSON.stringify(report.networkControl));
  report.commit = await page.evaluate(async ({ scope, manifest }) => {
    await navigator.serviceWorker.register(new URL("sw.js", scope), { scope });
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    const { createAssetStore } = await import(new URL("pwaAssetStore.js", scope));
    const asset = manifest.assets[0], body = await (await fetch(new URL(asset.path.slice(1), scope))).arrayBuffer();
    const digest = "sha256-" + [...new Uint8Array(await crypto.subtle.digest("SHA-256", body))].map(byte => byte.toString(16).padStart(2, "0")).join("");
    if (body.byteLength !== asset.bytes || digest !== asset.hash) throw new Error("source verification failed");
    await createAssetStore({ caches, scope }).put(asset, body);
    return await new Promise((resolve, reject) => { const channel = new MessageChannel(), timer = setTimeout(() => reject(new Error("manifest commit timeout")), 20000); channel.port1.onmessage = event => { clearTimeout(timer); resolve(event.data); }; navigator.serviceWorker.controller.postMessage({ type: "pwa:commit-manifest", manifest }, [channel.port2]); });
  }, { scope, manifest });
  assert.equal(report.commit.type, "pwa:committed");
  report.onlineControl = await page.evaluate(async ({ scope, song }) => {
    const audio = document.createElement("audio"); audio.crossOrigin = "anonymous"; audio.preload = "metadata"; audio.src = new URL(song.path.slice(1), scope); document.body.append(audio);
    const state = await new Promise(resolve => { audio.onloadedmetadata = () => resolve({ readyState: audio.readyState, duration: audio.duration }); audio.onerror = () => resolve({ error: audio.error?.code }); setTimeout(() => resolve({ timeout: true, readyState: audio.readyState, networkState: audio.networkState, error: audio.error?.code }), 8000); });
    audio.removeAttribute("src"); audio.load(); audio.remove(); return state;
  }, { scope, song });
  const disconnected = await disconnectPwaOrigin(server);
  report.offline = disconnected.evidence;
  report.range = await page.evaluate(async ({ scope, song }) => {
    const response = await fetch(new URL(song.path.slice(1), scope), { headers: { Range: "bytes=1000-1999" } });
    const body = await response.arrayBuffer();
    const invalid = await fetch(new URL(song.path.slice(1), scope), { headers: { Range: `bytes=${song.bytes}-` } });
    return { status: response.status, bytes: body.byteLength, contentRange: response.headers.get("content-range"), digest: [...new Uint8Array(await crypto.subtle.digest("SHA-256", body))].map(byte => byte.toString(16).padStart(2, "0")).join(""), invalidStatus: invalid.status, invalidContentRange: invalid.headers.get("content-range") };
  }, { scope, song });
  assert.equal(report.range.status, 206); assert.equal(report.range.bytes, 1000);
  assert.equal(report.range.contentRange, `bytes 1000-1999/${song.bytes}`);
  assert.equal(report.range.digest, createHash("sha256").update(songBytes.subarray(1000, 2000)).digest("hex"));
  assert.equal(report.range.invalidStatus, 416); assert.equal(report.range.invalidContentRange, `bytes */${song.bytes}`);
  await page.evaluate(({ scope, song }) => {
    const audio = document.createElement("audio"); audio.id = "native-audio"; audio.crossOrigin = "anonymous"; audio.preload = "auto"; audio.src = new URL(song.path.slice(1) + "?offline-native=1", scope); document.body.append(audio);
    const proof = window.__offlineNativeMedia = { seeks: [], ended: [], events: [], samples: [], playErrors: [] };
    audio.addEventListener("seeking", event => proof.seeks.push({ time: audio.currentTime, rate: audio.playbackRate, trusted: event.isTrusted }));
    audio.addEventListener("ended", event => proof.ended.push({ trusted: event.isTrusted, time: audio.currentTime, rate: audio.playbackRate }));
    for (const type of ["playing", "waiting", "stalled", "pause", "seeking", "seeked", "ended", "error"]) audio.addEventListener(type, event => proof.events.push({ at: performance.now(), type, trusted: event.isTrusted, time: audio.currentTime, rate: audio.playbackRate, paused: audio.paused, seeking: audio.seeking, readyState: audio.readyState }));
    setInterval(() => proof.samples.push({ at: performance.now(), time: audio.currentTime, rate: audio.playbackRate, paused: audio.paused, seeking: audio.seeking, readyState: audio.readyState }), 250);
    // Seek while paused, then use a real gesture for uninterrupted rate-1
    // playback. Native cache decoding at accelerated rates is a different
    // workload from the game; do not require its remaining 166s within 15s.
    document.getElementById("play").onclick = () => { proof.playRequestedAt = performance.now(); void audio.play().catch(error => proof.playErrors.push(String(error))); };
  }, { scope, song });
  await page.waitForFunction(() => document.querySelector("audio").readyState >= 2, undefined, { timeout: 20000 });
  await page.locator("audio").evaluate(audio => { audio.currentTime = 150; });
  await page.waitForFunction(() => { const audio = document.querySelector("audio"); return audio.paused && !audio.seeking && Math.abs(audio.currentTime - 150) < .01 && audio.readyState >= 2; }, undefined, { timeout: 20000 });
  await page.getByRole("button", { name: "音楽を再生", exact: true }).click();
  await page.waitForFunction(() => { const a = document.querySelector("audio"); return !a.paused && a.currentTime > 150.2 && !a.error; }, undefined, { timeout: 15000 });
  report.offlinePlayback = await page.locator("audio").evaluate(audio => ({ time: audio.currentTime, duration: audio.duration, rate: audio.playbackRate, paused: audio.paused, seeking: audio.seeking, error: audio.error }));
  assert.equal(report.offlinePlayback.seeking, false);
  assert.equal(report.offlinePlayback.rate, 1);
  // Actual media time must reach its final second without any further seek.
  // Bound that 166s continuous-play setup, then keep the 15s EOF deadline.
  await page.waitForFunction(() => { const audio = document.querySelector("audio"); return audio.currentTime >= audio.duration - 1 && !audio.error; }, undefined, { timeout: 180000 });
  report.beforeNativeEof = await page.locator("audio").evaluate(audio => ({ time: audio.currentTime, duration: audio.duration, rate: audio.playbackRate, paused: audio.paused, seeking: audio.seeking, error: audio.error }));
  // The ended property can become true before its native event is delivered.
  // Wait for the event itself before reading its trusted timestamp.
  await page.waitForFunction(() => window.__offlineNativeMedia.ended.length === 1, undefined, { timeout: 15000 });
  report.nativeEnded = await page.locator("audio").evaluate(audio => ({ time: audio.currentTime, duration: audio.duration, rate: audio.playbackRate, ended: audio.ended, error: audio.error }));
  assert.equal(report.nativeEnded.ended, true);
  report.nativeMediaEvents = await page.evaluate(() => window.__offlineNativeMedia);
  report.continuousPlayback = { totalMs: report.nativeMediaEvents.events.find(event => event.type === "ended").at - report.nativeMediaEvents.playRequestedAt, rate: 1, totalLimitMs: 180000, tailArrivalLimitMs: 180000, nativeEofLimitMs: 15000 };
  assert.ok(report.continuousPlayback.totalMs <= report.continuousPlayback.totalLimitMs, JSON.stringify(report.continuousPlayback));
  assert.ok(report.nativeMediaEvents.samples.every(sample => sample.rate === 1));
  assert.ok(report.nativeMediaEvents.events.every(event => event.rate === 1));
  assert.equal(report.nativeMediaEvents.seeks.length, 1);
  assert.ok(Math.abs(report.nativeMediaEvents.seeks[0].time - 150) < 1);
  assert.equal(report.nativeMediaEvents.seeks[0].trusted, true);
  assert.deepEqual(report.nativeMediaEvents.playErrors, []);
  assert.equal(report.nativeMediaEvents.ended.length, 1);
  assert.equal(report.nativeMediaEvents.ended[0].trusted, true);
  assert.equal(report.nativeEnded.rate, 1);
  report.playbackEvidence = "native paused seek to 150 seconds, then uninterrupted rate-1 original cached media to trusted EOF with no further seek; 180s tail-arrival setup and 15s native EOF deadline";
  assert.equal(report.nativeEnded.error, null); assert.ok(report.nativeEnded.time > 315);
  report.cache = await page.evaluate(async ({ scope, song }) => { const cache = await caches.open("zombieee-assets-v1"), response = await cache.match(new URL(`__pwa-asset__/${song.hash}`, scope)); return { status: response.status, hash: response.headers.get("x-pwa-asset-hash"), bytes: (await response.arrayBuffer()).byteLength }; }, { scope, song });
  assert.deepEqual(report.cache, { status: 200, hash: song.hash, bytes: song.bytes });
  assert.deepEqual(report.pageErrors, []); report.status = "passed";
} catch (error) { report.error = String(error); report.nativeMediaEvents = await page.evaluate(() => window.__offlineNativeMedia ?? null).catch(() => null); report.failureAudio = await page.locator("audio").evaluate(audio => ({ time: audio.currentTime, duration: audio.duration, rate: audio.playbackRate, paused: audio.paused, seeking: audio.seeking, ended: audio.ended, readyState: audio.readyState, networkState: audio.networkState, src: audio.currentSrc, buffered: [...Array(audio.buffered.length)].map((_, index) => [audio.buffered.start(index), audio.buffered.end(index)]), error: audio.error && { code: audio.error.code, message: audio.error.message } })).catch(() => null); throw error; }
finally { await context.close(); await browser.close(); if (server.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ status: report.status, engine, report: path.join(out, "report.json") }));
