import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright";
import { createDefaultCampaignSave, computeCampaignSaveIntegrity, serializeCampaignSave } from "../app/campaign.js";
import { createDefaultV100Save, serializeV100Save, isEligibleV100LegacyHistory, V100_PRIMARY_STORAGE_KEY as key } from "../app/v100Save.js";
import { V100_STAGE_IDS, V100_LEGACY_GIFT } from "../app/v100Registry.js";
import { releaseTitleForVersion } from "../app/releaseIdentity.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const publicUrl = process.env.GITHUB_PAGES_PUBLIC_URL?.trim();
const expectedVersion = process.env.GITHUB_PAGES_EXPECTED_VERSION?.trim();
const expectedReleaseSha = process.env.GITHUB_PAGES_EXPECTED_RELEASE_SHA?.trim();
const expectedRequestId = process.env.GITHUB_PAGES_EXPECTED_REQUEST_ID?.trim();
const expectedIssueNumber = process.env.GITHUB_PAGES_EXPECTED_ISSUE_NUMBER?.trim();
const localRehearsal = process.env.GITHUB_PAGES_LOCAL_REHEARSAL === "1";
assert.ok(publicUrl, "GITHUB_PAGES_PUBLIC_URL is required");
const base = new URL(publicUrl);
if (localRehearsal) { assert.ok(["localhost", "127.0.0.1"].includes(base.hostname)); assert.equal(base.protocol, "http:"); }
else assert.equal(base.href, "https://susano-ooo.github.io/Zombieee/", "Public QA is bound to the official URL");
assert.match(expectedVersion ?? "", /^[1-9]\d*\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u);
assert.match(expectedReleaseSha ?? "", /^[0-9a-f]{40}$/u);
assert.match(expectedRequestId ?? "", /^[0-9A-Za-z][0-9A-Za-z._-]{7,127}$/u);
assert.match(expectedIssueNumber ?? "", /^[1-9]\d*$/u);
const evidenceDir = path.resolve(process.env.GITHUB_PAGES_EVIDENCE_DIR ?? "pages-evidence-public"); await mkdir(evidenceDir, { recursive: false });
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const oldKey = "nishijin-campaign-v1", legacyKeys = [oldKey, `${oldKey}::last-known-good`, `${oldKey}::pre-migration`];
const legacy = createDefaultCampaignSave(); legacy.campaignStarted = true; legacy.caps = 777; legacy.revision = 955; legacy.updatedAt = "2026-08-08T00:00:00.000Z"; legacy.settings = { ...legacy.settings, bgmEnabled: false, sfxEnabled: false };
const historical = { ...legacy, survival: { ...legacy.survival }, schemaVersion: 13, revision: 900, updatedAt: "2026-07-29T00:00:00.000Z" };
delete historical.employmentNoticeReceipts; delete historical.seenEmploymentNoticeIds; delete historical.survival.highestReachedWave; historical.integrity = computeCampaignSaveIntegrity(historical);
const legacyBytes = serializeCampaignSave(legacy), historicalBytes = JSON.stringify(historical);
assert.ok(isEligibleV100LegacyHistory(legacyBytes)); assert.ok(isEligibleV100LegacyHistory(historicalBytes));
const current = createDefaultV100Save({ playerName: "公開再開確認", settings: { bgmEnabled: false, sfxEnabled: false } });
current.campaignStarted = true; current.caps = 37; current.completedStageIds = [V100_STAGE_IDS[0]]; current.availableStageIds = V100_STAGE_IDS.slice(0, 2); current.bestStars = { [V100_STAGE_IDS[0]]: 2 }; current.flowState.phase = "map"; current.flowState.destination = "map";
const fixtures = [
  { profile: "fresh", scenario: "normal", width: 1280, height: 720 },
  { profile: "v0.9.0-schema13", scenario: "normal", width: 844, height: 390 },
  { profile: "v0.9.9.5", scenario: "normal", width: 844, height: 340 },
  { profile: "v1-existing", scenario: "normal", width: 844, height: 390 },
  ...["idb-delay", "idb-blocked", "decode-hang", "slow-network", "critical-image-hold"].map(scenario => ({ profile: "v0.9.9.5", scenario, width: 844, height: 390 })),
];
const report = { localRehearsal, url: publicUrl, expectedVersion, expectedReleaseSha, expectedRequestId, expectedIssueNumber,
  scope: "Anonymous network-origin V1 root/save/Stage entry. Disclosed save and fault fixtures; service workers blocked. Not installed-PWA, natural campaign, native audio or physical-device acceptance.", sources: [], results: [], build: localRehearsal ? await productionBuildIdentity() : null };
for (const file of ["scripts/github-pages-public-smoke.mjs", "app/campaign.js", "app/campaignStorage.js", "app/v100Save.js", "app/v100CampaignStorage.js", "app/AshfallGame.tsx", "app/globals.css"]) report.sources.push({ file, sha256: sha(await readFile(new URL(`../${file}`, import.meta.url))) });
const browser = await chromium.launch({ headless: true });
const ready = page => page.waitForFunction(() => document.querySelector(".v100-shell") && document.documentElement.dataset.pwaSaveMutationPending === "false", null, { timeout: 30000 });
const mirror = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
async function shot(page, record, label) { const file = path.join(evidenceDir, `${record.name}-${label}.png`), bytes = await page.screenshot({ path: file, animations: "disabled" }); record.images.push({ file, sha256: sha(bytes), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }); }
async function boot(page, url, reload = false) {
  const response = reload ? await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 }) : await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  assert.ok(response?.ok(), `Document HTTP ${response?.status()}`);
  await page.waitForFunction(() => document.querySelector('.v100-shell, [role=dialog][aria-label="ゲームデータの準備"] button'), null, { timeout: 30000 });
  const offer = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true }); if (await offer.isVisible()) await offer.click();
}
async function advance(page, selector, max) {
  for (let i = 0; i < max; i++) {
    await ready(page); if (await page.locator(selector).isVisible()) return;
    const skip = page.getByRole("button", { name: "スキップ", exact: true });
    await (await skip.isVisible() ? skip : page.locator(".v100-event-actions .v100-primary")).click();
  }
  throw new Error(`Did not reach ${selector} within ${max} ordinary story transitions`);
}
async function nativeSave(page) {
  return page.evaluate(key => new Promise((resolve, reject) => {
    const request = indexedDB.open(key); request.onerror = () => reject(request.error);
    request.onsuccess = () => { const db = request.result, tx = db.transaction("saves", "readonly"), get = tx.objectStore("saves").get("current"); let value;
      get.onsuccess = () => { value = get.result; }; tx.oncomplete = () => { db.close(); resolve({ origin: location.origin, database: db.name, record: value }); }; tx.onabort = () => reject(tx.error); };
  }), key);
}
try {
  for (const fixture of fixtures) {
    const { profile, scenario, width, height } = fixture, oldBytes = profile === "v0.9.0-schema13" ? historicalBytes : profile === "v0.9.9.5" ? legacyBytes : null;
    const record = { name: `${profile}-${scenario}-${width}x${height}`, fixture, status: "running", images: [], diagnostics: { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [], warnings: [] }, teardownDiagnostics: [], legacyWrites: [], criticalRequests: 0 }; report.results.push(record);
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1000, serviceWorkers: "block" });
    await context.addInitScript(({ key, oldKey, oldBytes, currentBytes, profile, scenario, legacyKeys }) => {
      if (!sessionStorage.getItem("v1-public-fixture")) { if (oldBytes) localStorage.setItem(oldKey, oldBytes); if (profile === "v1-existing") localStorage.setItem(key, currentBytes); sessionStorage.setItem("v1-public-fixture", "yes"); }
      window.__PUBLIC_LEGACY_WRITES__ = [];
      for (const method of ["setItem", "removeItem", "clear"]) { const native = Storage.prototype[method]; Storage.prototype[method] = function (...args) { if (this === localStorage && (method === "clear" || legacyKeys.includes(String(args[0])))) window.__PUBLIC_LEGACY_WRITES__.push({ store: "local", method, key: args[0] }); return native.apply(this, args); }; }
      for (const method of ["put", "add", "delete", "clear"]) { const native = IDBObjectStore.prototype[method]; IDBObjectStore.prototype[method] = function (...args) { if (this.transaction.db.name === "nishijin-campaign-backup") window.__PUBLIC_LEGACY_WRITES__.push({ store: "indexed", method }); return native.apply(this, args); }; }
      if ((scenario === "idb-delay" || scenario === "idb-blocked") && !sessionStorage.getItem("v1-public-idb-restored")) {
        const native = IDBFactory.prototype.open; window.__PUBLIC_IDB_OPEN_COUNT__ = 0;
        IDBFactory.prototype.open = function (...args) { if (args[0] !== key) return native.apply(this, args); window.__PUBLIC_IDB_OPEN_COUNT__++; const request = {}; if (scenario === "idb-blocked") queueMicrotask(() => request.onblocked?.()); return request; };
        window.__PUBLIC_RESTORE_IDB__ = () => { IDBFactory.prototype.open = native; sessionStorage.setItem("v1-public-idb-restored", "yes"); };
      }
      if (scenario === "decode-hang") { const native = HTMLImageElement.prototype.decode; window.__PUBLIC_DECODE_CALLS__ = 0; window.__PUBLIC_RESTORE_DECODE__ = () => { HTMLImageElement.prototype.decode = native; }; HTMLImageElement.prototype.decode = () => { window.__PUBLIC_DECODE_CALLS__++; return new Promise(() => {}); }; }
    }, { key, oldKey, oldBytes, currentBytes: serializeV100Save(current), profile, scenario, legacyKeys });
    const page = await context.newPage(); page.setDefaultTimeout(30000); await page.setExtraHTTPHeaders({ "cache-control": "no-cache" });
    let teardown = false, releaseCritical = null;
    const diagnostic = (type, value) => { if (teardown) record.teardownDiagnostics.push({ type, value }); else record.diagnostics[type].push(value); };
    page.on("console", m => { if (m.type() === "error") diagnostic("consoleErrors", m.text()); if (m.type() === "warning") diagnostic("warnings", m.text()); });
    page.on("pageerror", e => diagnostic("pageErrors", String(e))); page.on("requestfailed", r => diagnostic("requestFailures", { url: r.url(), failure: r.failure(), phase: record.phase ?? "initial-entry" })); page.on("response", r => { if (r.status() >= 400) diagnostic("httpErrors", { url: r.url(), status: r.status() }); });
    if (scenario === "slow-network") await page.route("**/*.{png,webp}", async route => { await new Promise(resolve => setTimeout(resolve, 350)); await route.continue(); });
    if (scenario === "critical-image-hold") { const hold = new Promise(resolve => { releaseCritical = resolve; }); await page.route("**/tactical-drop-pod-v1.png", async route => { record.criticalRequests++; await hold; await route.continue(); }); }
    try {
      const target = new URL(publicUrl); target.searchParams.set("qa_release", expectedReleaseSha); target.searchParams.set("qa_request", expectedRequestId); target.searchParams.set("qa_scenario", scenario);
      await boot(page, target.href);
      const pageTitle = await page.title(); assert.ok(pageTitle.includes(expectedVersion)); assert.equal(pageTitle, releaseTitleForVersion(expectedVersion));
      record.metadata = {};
      for (const [name, expected] of Object.entries({ "github-pages-version": expectedVersion, "github-pages-release": expectedReleaseSha, "github-pages-request-id": expectedRequestId, "github-pages-issue": expectedIssueNumber })) { const value = await page.locator(`meta[name="${name}"]`).getAttribute("content"); assert.equal(value, expected); record.metadata[name] = value; }
      if (scenario === "idb-delay" || scenario === "idb-blocked") {
        await page.getByRole("region", { name: "セーブの復旧", exact: true }).waitFor(); assert.equal(await mirror(page), null); assert.equal(await page.evaluate(k => localStorage.getItem(k), oldKey), oldBytes);
        record.blockedOpens = await page.evaluate(() => window.__PUBLIC_IDB_OPEN_COUNT__); assert.ok(record.blockedOpens > 0); await shot(page, record, "storage-blocked");
        await page.evaluate(() => window.__PUBLIC_RESTORE_IDB__()); await page.getByRole("button", { name: "もう一度確認する", exact: true }).click();
      }
      await ready(page);
      if (oldBytes) { const gift = page.getByRole("dialog", { name: "新しい作戦記録を開始しました", exact: true }); await gift.waitFor(); await shot(page, record, "gift"); await gift.getByRole("button", { name: "確認する", exact: true }).click(); await ready(page); }
      record.initial = await mirror(page); assert.equal(record.initial.caps, oldBytes ? 180 : profile === "v1-existing" ? 37 : 0);
      assert.deepEqual(record.initial.completedStageIds, profile === "v1-existing" ? current.completedStageIds : []);
      if (profile !== "v1-existing") { await page.locator("#v100-player-name").fill("公開確認"); await page.getByRole("button", { name: "この名前で作戦を始める", exact: true }).click(); }
      await advance(page, ".v100-map-layout", 220); await ready(page); record.beforeReload = await mirror(page); record.legacyWrites.push(...await page.evaluate(() => window.__PUBLIC_LEGACY_WRITES__));
      if (scenario === "slow-network") { record.phase = "slow-map-quiescence"; await page.waitForLoadState("networkidle", { timeout: 30000 }); }
      record.phase = "intentional-map-reload"; await boot(page, target.href, true); record.phase = "after-map-reload"; await ready(page); record.afterReload = await mirror(page); assert.equal(record.afterReload.caps, record.beforeReload.caps); assert.equal(record.afterReload.playerName, record.beforeReload.playerName); assert.deepEqual(record.afterReload.completedStageIds, record.beforeReload.completedStageIds); assert.deepEqual(record.afterReload.receipts, record.beforeReload.receipts);
      assert.equal(await page.getByRole("dialog", { name: "新しい作戦記録を開始しました", exact: true }).count(), 0);
      if (oldBytes) { assert.equal(record.afterReload.receipts.filter(id => id === V100_LEGACY_GIFT.entitlementReceipt).length, 1); assert.equal(record.afterReload.legacy.popupAcknowledged, true); }
      record.native = await nativeSave(page); assert.equal(record.native.origin, base.origin); assert.equal(record.native.database, key); assert.deepEqual(JSON.parse(record.native.record.serialized), record.afterReload);
      record.dimensions = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth })); assert.equal(record.dimensions.documentWidth, width); assert.equal(record.dimensions.bodyWidth, width); await shot(page, record, "map");
      const stageNumber = profile === "v1-existing" ? 2 : 1;
      if (stageNumber === 2) { const nodes = page.locator(".v100-map-node.available"); assert.equal(await nodes.count(), 2); await nodes.nth(1).click(); }
      await page.getByRole("button", { name: "この作戦を編成", exact: true }).click(); await advance(page, ".v100-formation-panel", 40); await shot(page, record, "formation");
      await page.getByRole("button", { name: "戦闘へ", exact: true }).click();
      if (scenario === "decode-hang") {
        await page.waitForFunction(() => document.documentElement.dataset.assetLoadState === "error", null, { timeout: 150000 });
        const recovery = page.getByRole("region", { name: "戦闘データの準備", exact: true }); await recovery.waitFor();
        assert.equal(await page.locator("canvas.battlefield.active").count(), 0); record.failedImages = Number(await page.locator(".game-shell").getAttribute("data-asset-failed")); assert.ok(record.failedImages > 0);
        await shot(page, record, "decode-blocked"); await page.evaluate(() => window.__PUBLIC_RESTORE_DECODE__()); await recovery.getByRole("button", { name: "失敗・待機中の画像を再読み込み", exact: true }).click();
      }
      if (scenario === "critical-image-hold") {
        await page.waitForFunction(() => document.documentElement.dataset.assetLoadState === "loading");
        const deadline = Date.now() + 30000; while (record.criticalRequests === 0 && Date.now() < deadline) await page.waitForTimeout(50);
        assert.ok(record.criticalRequests > 0); assert.notEqual(await page.evaluate(() => document.documentElement.dataset.assetLoadState), "ready"); assert.equal(await page.locator("canvas.battlefield.active").count(), 0); await page.getByRole("region", { name: "戦闘データの準備", exact: true }).waitFor(); await shot(page, record, "critical-held"); releaseCritical();
      }
      await page.waitForFunction(() => document.documentElement.dataset.assetLoadState === "ready", null, { timeout: 150000 });
      await page.locator('.game-shell[data-screen="battle"]').waitFor(); assert.equal(await page.locator(".v100-shell").getAttribute("data-v100-stage"), String(stageNumber));
      record.stageNumber = stageNumber; record.assetState = await page.evaluate(() => document.documentElement.dataset.assetLoadState); record.reachedBattle = true;
      if (scenario === "decode-hang") { record.decodeCalls = await page.evaluate(() => window.__PUBLIC_DECODE_CALLS__); assert.ok(record.decodeCalls > 0); }
      assert.equal(await page.evaluate(k => localStorage.getItem(k), oldKey), oldBytes); record.legacyWrites.push(...await page.evaluate(() => window.__PUBLIC_LEGACY_WRITES__)); assert.deepEqual(record.legacyWrites, []);
      await shot(page, record, "battle");
      for (const name of ["consoleErrors", "pageErrors", "requestFailures", "httpErrors"]) assert.deepEqual(record.diagnostics[name], [], name);
      assert.deepEqual(record.diagnostics.warnings.filter(w => !w.includes("was preloaded using link preload but not used") && !w.includes("Service Worker registration blocked by Playwright")), []);
      record.status = "passed"; console.log(JSON.stringify({ name: record.name, status: record.status, images: record.images.length }));
    } catch (error) { record.status = "failed"; record.error = String(error); record.stack = error.stack; await shot(page, record, "failure").catch(() => {}); throw error; }
    finally { teardown = true; releaseCritical?.(); await context.close(); await writeFile(path.join(evidenceDir, "summary.json"), JSON.stringify(report, null, 2)); }
  }
} finally { await browser.close(); await writeFile(path.join(evidenceDir, "summary.json"), JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ status: "passed", localRehearsal, cases: report.results.length, summary: path.join(evidenceDir, "summary.json") }));
