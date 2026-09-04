import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { chromium, webkit } from "playwright";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { createDefaultV100Save, serializeV100Save, V100_PRIMARY_STORAGE_KEY } from "../app/v100Save.js";
import { v100LevelCost } from "../app/v100Registry.js";

const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL ?? "http://127.0.0.1:4177");
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname), "Isolated localhost QA only");
const out = path.resolve(process.env.V100_LIFECYCLE_EVIDENCE_DIR ?? "outputs/v100-campaign-lifecycle");
await fs.mkdir(out, { recursive: false });
const engines = (process.env.V100_LIFECYCLE_ENGINES ?? "chromium,webkit").split(",");
assert.ok(engines.length > 0 && engines.every(e => ["chromium", "webkit"].includes(e)));
const viewports = [{ width: 1280, height: 720 }, { width: 844, height: 390 }, { width: 844, height: 340 }];
const report = { build: await productionBuildIdentity(), scope: "production campaign lifecycle; isolated fixtures disclosed per case", cases: [], error: null };
const key = V100_PRIMARY_STORAGE_KEY;
const saveAt = page => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
const phase = (page, expected) => page.locator(`.v100-shell[data-v100-phase="${expected}"]`).waitFor({ state: "visible" });
const sha = b => crypto.createHash("sha256").update(b).digest("hex");

async function shot(page, record, label) {
  const file = path.join(out, `${record.name}-${label}.png`);
  const bytes = await page.screenshot({ path: file, timeout: 45000 });
  record.images.push({ label, file, sha256: sha(bytes), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });
}
async function acknowledgeBrowserOffer(page) {
  await page.waitForFunction(() => document.querySelector(".v100-shell") || document.querySelector("[role=dialog][aria-label='ゲームデータの準備'] button"));
  const offer = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true });
  if (await offer.isVisible()) await offer.click();
}
async function enter(page) {
  await page.goto(new URL("/v100", origin).href, { waitUntil: "domcontentloaded" });
  await acknowledgeBrowserOffer(page);
}
async function eventTo(page, selector, limit) {
  for (let step = 0; step < limit; step++) {
    if (await page.locator(selector).isVisible()) return;
    const skip = page.getByRole("button", { name: "スキップ", exact: true });
    if (await skip.isVisible()) await skip.click();
    else await page.locator(".v100-event-actions .v100-primary").click();
  }
  throw new Error(`Story did not reach ${selector}`);
}
async function stage(page) {
  await page.getByRole("button", { name: "この作戦を編成", exact: true }).click();
  await eventTo(page, ".v100-formation-panel", 40);
}
async function battle(page) {
  await page.getByRole("button", { name: "戦闘へ", exact: true }).click();
  await phase(page, "battle");
  await page.waitForFunction(() => window.__ASHFALL_ASSET_QA__?.getBattleMountState?.().battleMounted === true);
  await page.getByRole("button", { name: "一時停止", exact: true }).waitFor({ state: "visible" });
}
async function pauseAction(page, label) {
  await page.getByRole("button", { name: "一時停止", exact: true }).click();
  await page.getByRole("button", { name: label, exact: true }).click();
}
async function confirm(page) { await page.getByRole("button", { name: "実行する", exact: true }).click(); }
async function fault(page, enabled) { await page.evaluate(flag => { window.__V100_LIFECYCLE_WRITE_FAILURE__ = flag; }, enabled); }

async function withCase(browser, engine, viewport, name, fixture, run) {
  const record = { name: `${engine}-${viewport.width}x${viewport.height}-${name}`, engine, viewport, fixture, status: "running", images: [], errors: [], navigationAborts: [] };
  report.cases.push(record);
  const context = await browser.newContext({ viewport });
  await context.addInitScript(({ seed, key }) => {
    if (seed && !localStorage.getItem(key)) localStorage.setItem(key, seed);
    // Explicit local fault fixture, never part of production code or user data.
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (this === localStorage && window.__V100_LIFECYCLE_WRITE_FAILURE__ && name.startsWith("nishijin-campaign-v100")) throw new DOMException("Isolated QA write failure", "QuotaExceededError");
      return original.call(this, name, value);
    };
  }, { seed: fixture?.serialized ?? null, key });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  page.on("console", m => { if (m.type() === "error") record.errors.push({ type: "console", message: m.text() }); });
  page.on("pageerror", e => record.errors.push({ type: "page", message: String(e) }));
  page.on("requestfailed", r => {
    const entry = { url: r.url(), error: r.failure()?.errorText };
    if (record.navigationActive && /aborted|cancelled/i.test(entry.error ?? "")) record.navigationAborts.push(entry);
    else record.errors.push({ type: "request", ...entry });
  });
  page.on("response", r => { if (r.status() >= 400) record.errors.push({ type: "http", url: r.url(), status: r.status() }); });
  record.reload = async () => {
    record.navigationActive = true;
    try { await page.reload({ waitUntil: "networkidle" }); await acknowledgeBrowserOffer(page); } finally { record.navigationActive = false; }
  };
  try {
    await enter(page); await run(page, record);
    assert.deepEqual(record.errors, []); record.status = "passed";
  } catch (error) {
    record.status = "failed"; record.error = String(error);
    await shot(page, record, "failure").catch(e => { record.screenshotError = String(e); });
    throw error;
  } finally {
    delete record.reload;
    await context.close();
    await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  }
}

try {
  for (const engine of engines) {
    const browser = await ({ chromium, webkit }[engine]).launch();
    try {
      for (const viewport of viewports) {
        await withCase(browser, engine, viewport, "natural-exits", null, async (page, record) => {
          await page.locator("#v100-player-name").fill("監査指揮官");
          await page.locator(".v100-name-card .v100-primary").click();
          await eventTo(page, ".v100-map-layout", 220);
          await stage(page); await battle(page);
          const before = await saveAt(page);
          record.hud = await page.locator(".icon-btn,.support-btn,.unit-card").evaluateAll(elements => {
            const rules = [];
            function visit(list) { for (const r of list) { if (r.selectorText?.includes(".v100-shell") && r.selectorText.includes("button")) rules.push(r.selectorText); if (r.cssRules) visit(r.cssRules); } }
            for (const sheet of document.styleSheets) { try { visit(sheet.cssRules); } catch { /* cross-origin styles do not own campaign controls */ } }
            return elements.map(e => ({ text: e.textContent, rect: e.getBoundingClientRect().toJSON(), minHeight: getComputedStyle(e).minHeight, matchedCampaignRules: rules.filter(s => e.matches(s)) }));
          });
          assert.ok(record.hud.length > 0);
          assert.ok(record.hud.every(c => c.matchedCampaignRules.length === 0));
          await shot(page, record, "battle-hud");
          await pauseAction(page, "ステージを最初からやり直す"); await confirm(page);
          await page.waitForFunction(({ key, revision }) => JSON.parse(localStorage.getItem(key)).revision > revision, { key, revision: before.revision });
          await page.waitForFunction(() => window.__ASHFALL_ASSET_QA__?.getBattleMountState?.().battleMounted === true);
          const restarted = await saveAt(page);
          assert.equal(restarted.flowState.phase, "battle");
          assert.ok(restarted.revision > before.revision);
          await pauseAction(page, "編成画面へ戻る"); await confirm(page); await phase(page, "formation");
          await shot(page, record, "loadout-return");
          await record.reload(); await phase(page, "formation");
          await battle(page); await pauseAction(page, "エリアマップへ撤退");
          const beforeFailure = await saveAt(page);
          await fault(page, true); await confirm(page);
          await page.getByRole("status").filter({ hasText: "セーブ" }).waitFor();
          await phase(page, "battle"); assert.deepEqual(await saveAt(page), beforeFailure);
          await shot(page, record, "withdraw-write-rejected");
          await fault(page, false); await confirm(page); await phase(page, "map");
          await record.reload(); await phase(page, "map");
          const after = await saveAt(page);
          for (const k of ["caps", "receipts", "bestStars", "completedStageIds", "availableStageIds"]) assert.deepEqual(after[k], before[k]);
          await shot(page, record, "withdraw-map-restored");
          record.savedRevisions = { before: before.revision, restarted: restarted.revision, after: after.revision };
          if (viewport.height === 340) {
            await stage(page); await battle(page); await fault(page, true);
            await page.getByRole("alertdialog", { name: "戦闘結果の保存" }).waitFor({ state: "visible", timeout: 120000 });
            await shot(page, record, "real-defeat-unsaved");
            await phase(page, "battle");
            await fault(page, false);
            await page.getByRole("button", { name: "結果の保存を再試行", exact: true }).click();
            await page.locator('[data-v100-surface="result-lose"]').waitFor();
            const lost = await saveAt(page); assert.equal(lost.lastResult.won, false);
            await record.reload(); await page.locator('[data-v100-surface="result-lose"]').waitFor();
            assert.ok(lost.lastResult.elapsedSeconds > 0);
            await shot(page, record, "real-defeat-restored");
            await page.getByRole("button", { name: "作戦地図へ", exact: true }).click(); await phase(page, "map");
            assert.equal((await saveAt(page)).caps, before.caps);
            record.defeat = lost.lastResult;
          }
        });
        const funded = { ...createDefaultV100Save({ playerName: "育成監査" }), campaignStarted: true, caps: 100, flowState: { phase: "map", destination: "map" } };
        await withCase(browser, engine, viewport, "funded-level-fixture", { label: "isolated 100 CAPS map save, not natural progression", serialized: serializeV100Save(funded) }, async (page, record) => {
          await page.getByRole("button", { name: "隊員を編成", exact: true }).click();
          const button = page.locator(".v100-personnel-focus .v100-primary");
          await fault(page, true); await button.click();
          await page.getByRole("status").filter({ hasText: "セーブ" }).waitFor();
          assert.equal((await saveAt(page)).caps, 100);
          await fault(page, false); await button.click();
          const upgraded = await saveAt(page), unitId = funded.ownedUnitIds[0];
          assert.equal(upgraded.unitLevels[unitId], 2);
          assert.equal(upgraded.caps, 100 - v100LevelCost(2));
          assert.equal(upgraded.receipts.filter(r => r === `v100:unit:${unitId}:level:2`).length, 1);
          assert.ok(!(await page.locator(".v100-personnel-focus").innerText()).includes("武器・射程・固有能力"));
          await shot(page, record, "level-up");
          await record.reload();
          await page.getByRole("button", { name: "隊員を編成", exact: true }).click();
          assert.ok((await page.locator(".v100-personnel-focus").innerText()).includes("Lv.2"));
          assert.equal((await saveAt(page)).caps, upgraded.caps);
          await shot(page, record, "level-restored");
        });
      }
    } finally { await browser.close(); }
  }
} catch (error) { report.error = String(error); process.exitCode = 1; }
report.buildAfter = await productionBuildIdentity();
assert.equal(report.build.combinedSha256, report.buildAfter.combinedSha256);
await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ cases: report.cases.map(({ name, status, error }) => ({ name, status, error })), error: report.error, build: report.build.combinedSha256 }));
