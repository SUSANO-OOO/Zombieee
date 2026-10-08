// Native installed-pack regression for repairs during an active game.
// The map save and missing optional portrait belong to this isolated fixture.
// Safety-bridge race cases are synthetic; the battle and retreat use real UI.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, lstat, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { pwaBrowserType } from "./pwa-browser-runtime.mjs";
import { orderedNativePointer } from "./ordered-native-pointer.mjs";

const root = path.resolve(process.env.PWA_ACTIVE_REPAIR_ROOT ?? "_site");
const out = path.resolve(process.env.PWA_ACTIVE_REPAIR_OUT ?? "outputs/v100-native-pwa/active-repair");
const expectedSha = process.env.PWA_ACTIVE_REPAIR_EXPECTED_SHA;
assert.match(expectedSha ?? "", /^[a-f0-9]{40}$/u);
const baseline = process.env.PWA_ACTIVE_REPAIR_BASELINE === "1";
const engine = process.env.PWA_ACTIVE_REPAIR_ENGINE ?? "chromium";
const manifestBytes = await readFile(path.join(root, "asset-manifest.json"));
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.releaseSha, expectedSha);
const missing = manifest.assets.find(asset => asset.criticality === "optional" && asset.category === "portrait" && asset.path.includes("crazy-king-portrait"));
assert.ok(missing, "The missing portrait must be an optional asset outside Stage 1");
assert.ok(manifest.assets.filter(asset => asset.hash === missing.hash).every(asset => asset.criticality === "optional"));
await mkdir(out, { recursive: false });
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const git = (...args) => execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
const report = {
  status: "running", acceptance: !baseline, engine, releaseSha: expectedSha,
  scope: "Native installed PWA with one missing optional portrait; real battle and voluntary retreat, stale enabled-notice safety-bridge fixtures, safe same-generation repair. No natural-victory, physical-device or speaker claim.",
  staticRoot: root, manifestSha256: sha256(manifestBytes), driverSha256: sha256(await readFile(import.meta.filename)),
  sourceHead: git("rev-parse", "HEAD"), trackedDiffSha256: sha256(git("diff", "--", "app/PwaGate.tsx")),
  missing, checks: [], errors: [], screenshots: [], navigation: [],
};
// Bind the actual served program, including the service worker and dynamic
// chunks. A working-tree diff alone cannot identify a frozen baseline's bytes.
report.servedCode = [];
for (const name of (await readdir(root, { recursive: true })).sort()) {
  if (!/\.(?:html|js|css)$/u.test(name)) continue;
  const bytes = await readFile(path.join(root, name));
  report.servedCode.push({ path: name.replaceAll(path.sep, "/"), bytes: bytes.length, sha256: sha256(bytes) });
}
const seed = normalizeV100Save({
  ...createDefaultV100Save({ playerName: "修復確認" }), campaignStarted: true,
  readStoryEventIds: ["v100:event:prologue"],
  flowState: { phase: "map", eventId: null, stageId: null, stageNumber: null, destination: "map", nodeIndex: 0, firstClear: false, finalized: false },
});
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".bin": "application/octet-stream", ".ico": "image/x-icon" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    if (!pathname.startsWith("/Zombieee/")) { response.writeHead(404).end(); return; }
    let file = path.resolve(root, pathname.slice("/Zombieee/".length) || "index.html");
    assert.ok(file.startsWith(root + path.sep));
    let info = await lstat(file).catch(() => null);
    if (info?.isDirectory()) { file = path.join(file, "index.html"); info = await lstat(file).catch(() => null); }
    if (!info?.isFile() || info.isSymbolicLink()) { response.writeHead(404).end(); return; }
    const headers = { "content-type": mime[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-cache", "accept-ranges": "bytes" };
    let start = 0, end = info.size - 1, status = 200;
    const range = /^bytes=(\d*)-(\d*)$/u.exec(request.headers.range ?? "");
    if (range && (range[1] || range[2])) {
      if (range[1]) { start = Number(range[1]); end = range[2] ? Math.min(end, Number(range[2])) : end; }
      else start = Math.max(0, info.size - Number(range[2]));
      if (!Number.isSafeInteger(start) || start > end || start >= info.size) { response.writeHead(416, { ...headers, "content-range": `bytes */${info.size}` }).end(); return; }
      headers["content-range"] = `bytes ${start}-${end}/${info.size}`; status = 206;
    }
    headers["content-length"] = String(end - start + 1);
    response.writeHead(status, headers);
    if (request.method === "HEAD") response.end();
    else createReadStream(file, { start, end }).on("error", () => response.destroy()).pipe(response);
  } catch (error) { report.errors.push({ kind: "server", message: String(error) }); if (!response.headersSent) response.writeHead(500); response.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
report.origin = origin;
const type = await pwaBrowserType(engine);
let context, page;
const record = (name, details) => { report.checks.push({ name, passed: true, ...details }); console.log(JSON.stringify({ passed: name })); };
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("nishijin-campaign-v100")));
const button = name => page.getByRole("button", { name, exact: true });
async function ready() {
  await page.waitForFunction(() => document.querySelector(".v100-shell") && document.documentElement.dataset.pwaSaveMutationPending === "false" && !document.querySelector('.v100-shell[aria-busy="true"]'));
}
async function shot(name) {
  const file = name + ".png"; await page.screenshot({ path: path.join(out, file) });
  report.screenshots.push({ file, sha256: sha256(await readFile(path.join(out, file))) });
}
async function visibleNativeTap(locator) {
  const point = await locator.evaluate(element => {
    const r = element.getBoundingClientRect();
    for (const fy of [.5, .25, .75]) for (const fx of [.5, .9, .1]) {
      const x = r.x + r.width * fx, y = r.y + r.height * fy;
      if (x >= 0 && y >= 0 && x < innerWidth && y < innerHeight && document.elementFromPoint(x, y)?.closest('button') === element) return { x, y };
    }
    return null;
  });
  assert.ok(point, 'An ordinary visible part of the UI control must receive the tap');
  await orderedNativePointer(page, point);
}
try {
  // Deep evidence paths can exceed the Windows native IndexedDB path limit.
  // Keep the real persistent browser profile short and retain it for diagnosis.
  report.ownedProfile = await mkdtemp(path.join(os.tmpdir(), "v100-active-repair-"));
  context = await type.launchPersistentContext(report.ownedProfile, {
    headless: true, viewport: { width: 844, height: 390 }, hasTouch: true, ...(engine === "chromium" ? { args: ["--mute-audio"] } : {}),
    ...(engine === "chromium" && process.env.PWA_ACTIVE_REPAIR_CHROMIUM_CHANNEL ? { channel: process.env.PWA_ACTIVE_REPAIR_CHROMIUM_CHANNEL } : {}),
  });
  report.browserVersion = context.browser().version(); report.speakerOutput = engine === "chromium" ? "muted" : "headless runner; speaker not evaluated";
  await context.addInitScript(({ origin, serialized }) => {
    Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    if (location.origin === origin && !localStorage.getItem("nishijin-campaign-v100")) {
      for (const key of ["nishijin-campaign-v100", "nishijin-campaign-v100:mirror", "nishijin-campaign-v100:last-known-good"]) localStorage.setItem(key, serialized);
    }
  }, { origin, serialized: serializeV100Save(seed) });
  page = await context.newPage(); page.setDefaultTimeout(20000);
  // Keep native initial-navigation evidence if the runner never reaches the
  // installed-pack scenario. No navigation deadline or product behavior changes.
  let observingNavigation = true;
  page.on("request", request => { if (observingNavigation) report.navigation.push({ event: "request", type: request.resourceType(), url: request.url(), at: Date.now() }); });
  page.on("response", response => { if (observingNavigation) report.navigation.push({ event: "response", status: response.status(), url: response.url(), at: Date.now() }); });
  page.on("domcontentloaded", () => { if (observingNavigation) report.navigation.push({ event: "domcontentloaded", at: Date.now() }); });
  page.on("console", message => { if (message.type() === "error") report.errors.push({ kind: "console", message: message.text() }); });
  page.on("pageerror", error => report.errors.push({ kind: "page", message: String(error) }));
  page.on("requestfailed", request => report.errors.push({ kind: "request", url: request.url(), message: request.failure()?.errorText }));
  page.on("response", response => { if (response.status() >= 400) report.errors.push({ kind: "http", url: response.url(), status: response.status() }); });
  await page.goto(origin + "/Zombieee/v100/", { waitUntil: "domcontentloaded" });
  observingNavigation = false;
  assert.equal(await page.locator('meta[name="github-pages-release"]').getAttribute("content"), expectedSha);
  await button("ダウンロードを開始").click({ timeout: 45000 });
  await button("ゲームを始める").waitFor({ state: "visible", timeout: 300000 });
  // Session completion precedes the durable manifest acknowledgement. Corrupt
  // only an installed pack, never a candidate still undergoing verification.
  const commitDeadline = Date.now() + 60000;
  do {
    // waitForFunction polls synchronous truthiness; an async predicate would
    // accept the Promise before the native worker response proved the commit.
    report.installedState = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration('/Zombieee/');
      if (!registration?.active) return { type: 'no-active-worker' };
      const state = await new Promise(resolve => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => { channel.port1.close(); resolve({ type: 'state-timeout' }); }, 1000);
        channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data); };
        registration.active.postMessage({ type: 'pwa:get-state' }, [channel.port2]);
      });
      return { type: state.type, releaseSha: state.active?.releaseSha, assets: state.active?.assets?.length, hashes: state.storedHashes?.length };
    });
    if (report.installedState.releaseSha === expectedSha) break;
    await page.waitForTimeout(250);
  } while (Date.now() < commitDeadline);
  assert.equal(report.installedState.releaseSha, expectedSha);
  report.cacheBefore = await page.evaluate(async hash => {
    const cache = await caches.open("zombieee-assets-v1"), key = new URL("__pwa-asset__/" + hash, new URL("/Zombieee/", location.href));
    if (!await cache.match(key)) throw new Error("Optional portrait was not installed");
    const count = (await cache.keys()).length, removed = await cache.delete(key);
    return { count, removed, missing: !await cache.match(key) };
  }, missing.hash);
  assert.ok(report.cacheBefore.count >= new Set(manifest.assets.map(asset => asset.hash)).size);
  assert.equal(report.cacheBefore.removed, true); assert.equal(report.cacheBefore.missing, true);
  // No game/audio has mounted yet; reload makes the real gate rescan the cache.
  await page.waitForLoadState("networkidle"); await page.reload({ waitUntil: "domcontentloaded" });
  await ready();
  const repair = button("不足分だけ再取得");
  await repair.waitFor({ state: "visible" }); assert.equal(await repair.isEnabled(), true);
  assert.equal(await page.locator(".v100-shell").getAttribute("data-v100-phase"), "map");
  record("missing optional portrait permits play and safe repair", report.cacheBefore);

  if (!baseline) {
    for (const bridge of [{ screen: "result", resultSaving: "true" }, { screen: "map", saveMutationPending: "true" }]) {
      const before = await saved();
      await repair.evaluate((element, bridge) => {
        const data = document.documentElement.dataset;
        window.__repairSafetyRestore = { pwaScreen: data.pwaScreen, pwaBattleActive: data.pwaBattleActive, pwaResultSaving: data.pwaResultSaving, pwaSaveMutationPending: data.pwaSaveMutationPending };
        data.pwaScreen = bridge.screen;
        if (bridge.resultSaving) data.pwaResultSaving = bridge.resultSaving;
        if (bridge.saveMutationPending) data.pwaSaveMutationPending = bridge.saveMutationPending;
        element.click(); // The previously enabled notice fires before React's next render.
      }, bridge);
      await page.waitForTimeout(300);
      assert.equal(await repair.isVisible(), false);
      assert.equal(await page.locator(".v100-shell").getAttribute("data-v100-phase"), "map");
      assert.deepEqual(await saved(), before);
      record("stale enabled action cannot bypass current safety", { bridge, syntheticSafetyBridge: true });
      await page.evaluate(() => { Object.assign(document.documentElement.dataset, window.__repairSafetyRestore); });
      await repair.waitFor({ state: 'visible' });
    }
  }
  await visibleNativeTap(button("この作戦を編成"));
  await page.waitForFunction(() => ['event', 'formation'].includes(document.querySelector('.v100-shell')?.dataset.v100Phase));
  while (await page.locator(".v100-shell").getAttribute("data-v100-phase") === "event") {
    const primary = page.locator(".v100-event-actions .v100-primary");
    const before = await page.locator("section[data-v100-node-index]").getAttribute("data-v100-node-index");
    await primary.tap();
    await page.waitForFunction(before => document.querySelector(".v100-shell")?.dataset.v100Phase !== "event" || document.querySelector("section[data-v100-node-index]")?.dataset.v100NodeIndex !== before, before);
  }
  await visibleNativeTap(button("戦闘へ")); await ready();
  await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.()?.running === true);
  const battle = await page.evaluate(() => { const s = window.__ASHFALL_BATTLE_QA__.getSnapshot(); return { time: s.time, baseHp: s.baseHp }; });
  const beforeBattle = await saved();
  await repair.waitFor({ state: baseline ? "visible" : "hidden" });
  assert.equal(await repair.isVisible(), baseline, "The repair notice must wait until the live battle ends");
  await shot("battle-repair");
  if (baseline) {
    await visibleNativeTap(repair);
    await page.locator(".v100-shell").waitFor({ state: "hidden" });
    report.status = "reproduced-battle-interruption";
    report.lostLiveBattle = battle; report.saveAfterInterruptedBattle = await saved();
    await shot("interrupted-battle");
  } else {
    await page.waitForTimeout(1200);
    assert.equal(await page.locator(".v100-shell").getAttribute("data-v100-phase"), "battle");
    const after = await page.evaluate(() => { const s = window.__ASHFALL_BATTLE_QA__.getSnapshot(); return { time: s.time, running: s.running }; });
    assert.equal(after.running, true); assert.ok(after.time > battle.time);
    assert.deepEqual(await saved(), beforeBattle);
    record("deferred repair notice preserves the running battle, controls and save", { before: battle, after });
    await button("一時停止").tap();
    await page.getByRole("dialog", { name: "一時停止メニュー", exact: true }).waitFor();
    assert.equal(await repair.isVisible(), false);
    await button("作戦地図へ撤退").tap();
    await page.getByRole("alertdialog").getByRole("button", { name: "実行する", exact: true }).tap();
    await page.locator('.v100-shell[data-v100-phase="map"]').waitFor(); await ready();
    const beforeRepair = await saved();
    for (const key of ["caps", "receipts", "completedStageIds", "ownedUnitIds", "unitLevels"]) assert.deepEqual(beforeRepair[key], beforeBattle[key]);
    await repair.waitFor({ state: 'visible' });
    assert.equal(await repair.isEnabled(), true);
    await button('今はしない').tap();
    assert.equal(await repair.count(), 0);
    await button('メニュー').tap();
    await page.getByRole('dialog', { name: 'メニュー', exact: true }).getByRole('button', { name: 'データ管理', exact: true }).tap();
    await page.getByRole('region', { name: 'アプリのデータ管理', exact: true }).waitFor();
    await repair.tap();
    await button("ゲームを始める").waitFor({ state: "visible", timeout: 60000 });
    await button("ゲームを始める").tap(); await ready();
    assert.deepEqual(await saved(), beforeRepair, "Safe repair must preserve the complete save");
    report.repairedAsset = await page.evaluate(async hash => {
      const cache = await caches.open("zombieee-assets-v1");
      const response = await cache.match(new URL("__pwa-asset__/" + hash, new URL("/Zombieee/", location.href)));
      if (!response?.ok) return null;
      const bytes = await response.arrayBuffer();
      return { bytes: bytes.byteLength, hash: "sha256-" + [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(n => n.toString(16).padStart(2, "0")).join("") };
    }, missing.hash);
    assert.deepEqual(report.repairedAsset, { bytes: missing.bytes, hash: missing.hash });
    assert.equal(await repair.count(), 0);
    record("voluntary retreat allows one verified repair with the exact save retained", report.repairedAsset);
    await shot("repaired-map"); report.status = "passed";
  }
  await page.waitForLoadState("networkidle", { timeout: 45000 });
  await page.waitForFunction(() => [window.__ASHFALL_AUDIO_QA__, window.__V100_EVENT_AUDIO_QA__].filter(Boolean).every(q => { const d = q.getDiagnostics(); return d.activePreloads === 0 && d.queuedPreloads === 0; }), null, { timeout: 45000 });
  assert.deepEqual(report.errors, []);
} catch (error) { report.status = "failed"; report.error = String(error); process.exitCode = 1; if (page) await shot("failure").catch(() => {}); }
finally {
  if (page) {
    report.finalSave = await saved().catch(() => null);
    if (report.status === "failed") report.failureDocument = await page.evaluate(() => ({ readyState: document.readyState, url: location.href, body: document.body?.innerText, phase: document.querySelector('.v100-shell')?.dataset.v100Phase, resources: performance.getEntriesByType('resource').map(entry => ({ name: entry.name, duration: entry.duration, bytes: entry.transferSize })) })).catch(() => null);
  }
  if (context) await context.close();
  await new Promise(resolve => server.close(resolve));
  if (report.errors.length) { report.status = "failed"; process.exitCode = 1; }
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, errors: report.errors.length, error: report.error }));
}
