import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { chromium, webkit } from "playwright";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { legacyQaUrl } from "./legacy-qa-url.mjs";
import { RELEASE_TITLE } from "../app/releaseIdentity.js";
import { createDefaultCampaignSave, serializeCampaignSave } from "../app/campaign.js";
import { createDefaultV100Save, serializeV100Save, V100_PRIMARY_STORAGE_KEY as key } from "../app/v100Save.js";
import { V100_LEGACY_GIFT } from "../app/v100Registry.js";

const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL); assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
const out = path.resolve(process.env.V100_ROOT_ENTRY_EVIDENCE_DIR ?? "outputs/v100-root-entry"); await fs.mkdir(out, { recursive: false });
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const oldKey = "nishijin-campaign-v1";
const legacyKeys = [oldKey, `${oldKey}::last-known-good`, `${oldKey}::pre-migration`];
assert.ok(legacyKeys.includes(oldKey));
for (const v1Key of [key, `${key}:mirror`, `${key}:last-known-good`]) assert.equal(legacyKeys.includes(v1Key), false);
const old = createDefaultCampaignSave(); old.campaignStarted = true; old.caps = 777; old.settings = { ...old.settings, bgmEnabled: false, sfxEnabled: false };
const oldBytes = serializeCampaignSave(old);
const current = createDefaultV100Save({ playerName: "入口再開", settings: { bgmEnabled: false, sfxEnabled: false } }); current.campaignStarted = true; current.flowState.phase = "map"; current.flowState.destination = "map"; current.caps = 37;
const report = { host: process.platform, node: process.version, build: await productionBuildIdentity(), fullAcceptance: false, scope: "Production root entry and local legacy QA routing. Old/current saves are disclosed fixtures. Fresh uses real default settings; no native audio, full campaign, installed PWA or physical-device acceptance.", cases: [], sources: [] };
for (const file of ["app/page.tsx", "app/GameEntry.tsx", "app/gameEntryPolicy.js", "app/V100Campaign.tsx", "scripts/legacy-qa-url.mjs", "scripts/v100-root-entry-browser-smoke.mjs"]) report.sources.push({ file, sha256: sha(await fs.readFile(file)) });
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const ready = page => page.waitForFunction(() => document.querySelector(".v100-shell") && document.documentElement.dataset.pwaSaveMutationPending === "false");
async function shot(page, record, label) { const file = path.join(out, `${record.name}-${label}.png`), bytes = await page.screenshot({ path: file, animations: "disabled" }); record.images.push({ file, sha256: sha(bytes), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }); }
async function open(page, url, reload = false) {
  if (reload) await page.reload({ waitUntil: "domcontentloaded" }); else await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector('.v100-shell, .game-shell, [role=dialog][aria-label="ゲームデータの準備"] button'));
  const offer = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true }); if (await offer.isVisible()) await offer.click();
}
try {
  for (const [engine, type] of Object.entries({ chromium, webkit })) {
    const browser = await type.launch();
    try {
      const cases = [{ profile: "fresh", width: 1280, height: 720 }, { profile: "old-played", width: 844, height: 390 }, { profile: "v1-existing", width: 844, height: 340 }, { profile: "legacy", width: 844, height: 390 }, { profile: "legacy-flow", width: 844, height: 340 }];
      for (const fixture of cases) {
        const { profile, width, height } = fixture, isLegacy = profile.startsWith("legacy");
        const record = { name: `${engine}-${profile}-${width}x${height}`, engine, version: browser.version(), fixture, status: "running", errors: [], images: [], legacyWrites: [] }; report.cases.push(record);
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1000 });
        await context.addInitScript(({ key, oldKey, oldBytes, currentBytes, profile, legacyKeys }) => {
          if (!sessionStorage.getItem("v1-root-fixture-initialized")) {
            if (profile === "old-played") localStorage.setItem(oldKey, oldBytes);
            if (profile === "v1-existing") localStorage.setItem(key, currentBytes);
            sessionStorage.setItem("v1-root-fixture-initialized", "yes");
          }
          window.__ROOT_LEGACY_WRITES__ = [];
          for (const method of ["setItem", "removeItem", "clear"]) { const native = Storage.prototype[method]; Storage.prototype[method] = function (...args) { if (this === localStorage && (method === "clear" || legacyKeys.includes(String(args[0])))) window.__ROOT_LEGACY_WRITES__.push({ store: "local", method, key: args[0] }); return native.apply(this, args); }; }
          for (const method of ["put", "add", "delete", "clear"]) { const native = IDBObjectStore.prototype[method]; IDBObjectStore.prototype[method] = function (...args) { if (this.transaction.db.name === "nishijin-campaign-backup") window.__ROOT_LEGACY_WRITES__.push({ store: "indexed", method }); return native.apply(this, args); }; }
        }, { key, oldKey, oldBytes, currentBytes: serializeV100Save(current), profile, legacyKeys });
        const page = await context.newPage(); page.setDefaultTimeout(45000);
        page.on("console", m => { if (m.type() === "error") record.errors.push({ type: "console", message: m.text() }); }); page.on("pageerror", e => record.errors.push({ type: "page", message: String(e) })); page.on("requestfailed", r => record.errors.push({ type: "request", url: r.url(), failure: r.failure() })); page.on("response", r => { if (r.status() >= 400) record.errors.push({ type: "http", url: r.url(), status: r.status() }); });
        try {
          const url = profile === "legacy" ? legacyQaUrl(origin) : profile === "legacy-flow" ? new URL("?qa=flow&screen=map", origin).href : origin.href;
          await open(page, url); assert.equal(await page.title(), RELEASE_TITLE);
          if (isLegacy) {
            await page.locator(profile === "legacy" ? ".title-screen-v060" : ".map-screen").waitFor();
            assert.equal(await page.locator(".v100-shell").count(), 0); assert.equal(await saved(page), null);
            await shot(page, record, "legacy-owner"); record.status = "passed-explicit-local-legacy-no-v1-save";
          } else {
            await ready(page); assert.equal(await page.locator(".title-screen-v060").count(), 0);
            if (profile === "old-played") {
              const gift = page.getByRole("dialog", { name: "新しい作戦記録を開始しました", exact: true }); await gift.waitFor(); await shot(page, record, "gift"); await gift.getByRole("button", { name: "確認する", exact: true }).click(); await ready(page);
            }
            record.initial = await saved(page);
            assert.equal(record.initial.caps, profile === "old-played" ? 180 : profile === "v1-existing" ? 37 : 0);
            assert.equal(record.initial.completedStageIds.length, 0);
            if (profile === "v1-existing") { assert.equal(record.initial.playerName, current.playerName); await page.locator(".v100-map-layout").waitFor(); }
            else { await page.locator("#v100-player-name").fill("入口確認"); await page.getByRole("button", { name: "この名前で作戦を始める", exact: true }).click(); await page.locator('[data-v100-event-id="v100:event:prologue"]').waitFor(); await ready(page); }
            await shot(page, record, "entered"); record.beforeReload = await saved(page); record.legacyWrites.push(...await page.evaluate(() => window.__ROOT_LEGACY_WRITES__));
            await open(page, url, true); await ready(page); record.afterReload = await saved(page); record.legacyWrites.push(...await page.evaluate(() => window.__ROOT_LEGACY_WRITES__));
            assert.deepEqual(record.afterReload.flowState, record.beforeReload.flowState); assert.equal(record.afterReload.playerName, record.beforeReload.playerName); assert.equal(record.afterReload.caps, record.beforeReload.caps); assert.deepEqual(record.afterReload.receipts, record.beforeReload.receipts);
            assert.deepEqual(record.legacyWrites, []); assert.equal(await page.evaluate(k => localStorage.getItem(k), oldKey), profile === "old-played" ? oldBytes : null);
            if (profile === "old-played") { assert.equal(record.afterReload.receipts.filter(id => id === V100_LEGACY_GIFT.entitlementReceipt).length, 1); assert.equal(record.afterReload.legacy.popupAcknowledged, true); assert.equal(await page.getByRole("dialog", { name: "新しい作戦記録を開始しました", exact: true }).count(), 0); }
            await shot(page, record, "reloaded"); record.status = "passed-v1-root-entry-and-reload";
          }
          assert.deepEqual(record.errors, []); console.log(JSON.stringify({ name: record.name, status: record.status, images: record.images.length }));
        } catch (error) { record.status = "failed"; record.error = String(error); record.stack = error.stack; await shot(page, record, "failure").catch(() => {}); throw error; }
        finally { await context.close(); await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); }
      }
    } finally { await browser.close(); }
  }
} finally { await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); }
