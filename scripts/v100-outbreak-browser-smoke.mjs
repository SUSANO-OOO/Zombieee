import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { chromium, webkit } from "playwright";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { createDefaultV100Save, serializeV100Save, V100_PRIMARY_STORAGE_KEY as key } from "../app/v100Save.js";
import { V100_BOSSES, V100_UNITS, V100_STAGE_IDS, v100StageReward } from "../app/v100Registry.js";

const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
const out = path.resolve(process.env.V100_OUTBREAK_EVIDENCE_DIR ?? "outputs/v100-outbreak-runtime");
await fs.mkdir(out, { recursive: false });
const engines = (process.env.V100_OUTBREAK_ENGINES ?? "chromium,webkit").split(",");
assert.ok(engines.length > 0 && engines.every(engine => ["chromium", "webkit"].includes(engine)));
const lane = process.env.V100_OUTBREAK_LANE ?? "acceptance";
assert.ok(["acceptance", "diagnostic", "save-boundary-diagnostic", "result-boundary-diagnostic"].includes(lane));
if (lane === "diagnostic") assert.deepEqual(engines, ["chromium"]);
if (lane === "result-boundary-diagnostic") assert.deepEqual(engines, ["webkit"]);
const report = { host: process.platform, node: process.version, engines, build: await productionBuildIdentity(), fullAcceptance: false,
  scope: "Local disclosed fixtures: desktop unproved flags; mobile exact TAKUYA Story receipt, all units Lv30, vehicleLv5,2000 CAPS. Normal production input only; audio disabled. This is mode/storage QA, not balance, natural progression or audio acceptance.", cases: [] };
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
report.lane = lane;
report.sources = await Promise.all(["app/v100Outbreak.js", "app/v100Save.js", "app/v100Transactions.js", "app/V100ModesView.tsx", "app/V100Campaign.tsx", "app/v100Campaign.css", "app/v100BattleAdapter.js", "app/AshfallGame.tsx", "scripts/v100-outbreak-browser-smoke.mjs"]
  .map(async file => ({ file, sha256: sha(await fs.readFile(file)) })));
const boss = V100_BOSSES[0];
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const ready = page => page.waitForFunction(() => document.querySelector(".v100-shell") && document.documentElement.dataset.pwaSaveMutationPending === "false");
async function action(page, click) { await ready(page); const before = (await saved(page)).revision; await click(); await page.waitForFunction(({ key, before }) => JSON.parse(localStorage.getItem(key)).revision > before && document.documentElement.dataset.pwaSaveMutationPending === "false", { key, before }); }
async function arrive(page) {
  const priorWrites = await page.evaluate(() => window.__OUTBREAK_LEGACY_WRITES__ ?? null);
  if (priorWrites) assert.deepEqual(priorWrites, [], "No legacy writes before a document is replaced");
  await page.goto(new URL("/v100", origin).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector(".v100-shell") || document.querySelector('[role=dialog][aria-label="ゲームデータの準備"] button'));
  const offer = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true }); if (await offer.isVisible()) await offer.click(); await ready(page);
}
async function shot(page, record, label) {
  const file = path.join(out, `${record.name}-${label}.png`), bytes = await page.screenshot({ path: file, timeout: 45000, animations: "disabled" });
  record.images.push({ file, sha256: sha(bytes), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });
}
async function modeIdentity(page) { return page.evaluate(() => ({ screen: document.documentElement.dataset.pwaScreen, battle: document.documentElement.dataset.pwaBattleActive, result: document.documentElement.dataset.pwaResultSaving })); }
async function combatObservation(page, full = false) {
  return page.evaluate(full => {
    const bridge = window.__ASHFALL_BATTLE_QA__; if (!bridge) return null;
    const s = full ? bridge.getSnapshot() : bridge.getPhaseGCombatSnapshot();
    return { at: Date.now(), stageId: s.stageId, resultId: s.resultId, time: s.time, running: s.running, paused: s.paused, over: s.over, won: s.won,
      bossDefeated: s.bossDefeated, bossDefeatPending: s.bossDefeatPending, baseHp: s.baseHp, baseMaxHp: s.baseMaxHp, barricadeHp: s.barricadeHp,
      barricadeVulnerable: s.barricadeVulnerable, wave: s.wave, eventIndex: s.eventIndex, timelineLength: s.timelineLength, pendingSpawnCount: s.pendingSpawnCount,
      resultPresented: s.resultPresented, saveBoundaryPending: s.saveBoundaryPending,
      enemies: s.fighters.filter(f => f.side === "zombie").map(f => ({ id: f.id, kind: f.kind, hp: f.hp })),
      presentation: s.battlePresentation, mode: document.documentElement.dataset.pwaScreen,
    };
  }, full);
}
try {
  for (const engine of engines) {
    const browser = await ({ chromium, webkit }[engine]).launch();
    try {
      for (const viewport of lane !== "acceptance" ? [{ width: 844, height: 390 }] : [{ width: 1280, height: 720 }, { width: 844, height: 390 }, { width: 844, height: 340 }]) {
        const locked = viewport.width === 1280, natural = viewport.height === 390;
        const record = { name: `${engine}-${viewport.width}x${viewport.height}`, engine, version: browser.version(), viewport, lane: locked ? "unproved-discovery" : natural ? "actual-win-abort-retry" : "reload-restart-loadout", status: "running", images: [], errors: [] }; report.cases.push(record);
        const seed = createDefaultV100Save({ playerName: "再戦監査", settings: { bgmEnabled: false, sfxEnabled: false, autoSkipReadStory: true } });
        seed.campaignStarted = true; seed.caps = 2000; seed.flowState = { ...seed.flowState, phase: "map", destination: "map" };
        seed.bosses.discoveredIds = V100_BOSSES.map(b => b.id);
        if (!locked) {
          seed.receipts = [boss.firstDefeatReceipt]; seed.completedStageIds = V100_STAGE_IDS.slice(0, 3); seed.availableStageIds = V100_STAGE_IDS.slice(0, 4);
          seed.ownedUnitIds = V100_UNITS.map(unit => unit.id); seed.registeredUnitIds = [...seed.ownedUnitIds]; seed.unitLevels = Object.fromEntries(seed.ownedUnitIds.map(id => [id, 30])); seed.levelCap = 30;
          seed.vehicle.upgradeLevel = 5; seed.vehicle.maxHp = 1080;
          seed.formationSlots = ["unit-miyamoto-musashi", "unit-kumaverson", "unit-paisen", "unit-hachi", "unit-miyamoto-musashi", "unit-kumaverson", "unit-paisen"];
        }
        const context = await browser.newContext({ viewport, hasTouch: !locked });
        await context.addInitScript(({ key, seed, origin }) => {
          if (location.origin !== origin) return;
          if (!localStorage.getItem(key)) localStorage.setItem(key, seed);
          window.__OUTBREAK_LEGACY_WRITES__ = [];
          window.__OUTBREAK_BOUNDARY_HISTORY__ = [];
          new MutationObserver(() => {
            const shell = document.querySelector('.v100-shell');
            const state = { pending: document.documentElement.dataset.pwaSaveMutationPending, busy: shell?.getAttribute('aria-busy'), screen: document.documentElement.dataset.pwaScreen };
            const entries = window.__OUTBREAK_BOUNDARY_HISTORY__;
            if (JSON.stringify(entries.at(-1)?.state) !== JSON.stringify(state)) { entries.push({ at: Date.now(), state }); if (entries.length > 100) entries.shift(); }
          }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-pwa-save-mutation-pending', 'data-pwa-screen', 'aria-busy'] });
          for (const method of ["setItem", "removeItem"]) {
            const original = Storage.prototype[method];
            Storage.prototype[method] = function (id) { if (String(id).startsWith("nishijin-campaign-v1") && !String(id).startsWith(key)) window.__OUTBREAK_LEGACY_WRITES__.push({ store: "local", method, key: id }); return Reflect.apply(original, this, arguments); };
          }
          for (const method of ["put", "add", "delete", "clear"]) {
            const original = IDBObjectStore.prototype[method];
            IDBObjectStore.prototype[method] = function () { if (this.transaction.db.name === "nishijin-campaign-backup") window.__OUTBREAK_LEGACY_WRITES__.push({ store: "indexeddb", method }); return Reflect.apply(original, this, arguments); };
          }
          const transaction = IDBDatabase.prototype.transaction;
          IDBDatabase.prototype.transaction = function (stores, mode) { const tx = Reflect.apply(transaction, this, arguments); if (this.name === key && mode === "readwrite" && window.__OUTBREAK_ABORT__) tx.abort(); return tx; };
        }, { key, seed: serializeV100Save(seed), origin: origin.origin });
        const page = await context.newPage(); page.setDefaultTimeout(45000);
        page.on("console", message => { if (message.type() === "error") record.errors.push({ type: "console", message: message.text() }); });
        page.on("pageerror", error => record.errors.push({ type: "page", message: String(error) }));
        page.on("requestfailed", request => record.errors.push({ type: "request", url: request.url(), error: request.failure() }));
        page.on("response", response => { if (response.status() >= 400) record.errors.push({ type: "http", status: response.status(), url: response.url() }); });
        try {
          await arrive(page); await page.getByRole("button", { name: "異常発生・記録", exact: true }).click();
          for (const tab of ["異常発生", "ボス図鑑", "戦績"]) {
            await page.getByRole("button", { name: tab, exact: true }).click();
            assert.equal(await page.locator("[data-outbreak-boss-id]").count(), locked ? 0 : 1);
            if (!locked) assert.equal(await page.locator("[data-outbreak-boss-id]").getAttribute("data-outbreak-boss-id"), boss.id);
          }
          await shot(page, record, "records");
          if (!locked) {
            await page.getByRole("button", { name: "異常発生", exact: true }).click();
            if (lane === "save-boundary-diagnostic") {
              const before = await saved(page);
              await page.evaluate(() => { window.__OUTBREAK_ABORT__ = true; });
              await page.getByRole("button", { name: "この異常個体と再戦", exact: true }).click();
              await page.getByText("セーブを書き込めませんでした。現在の画面と進行を保持します。", { exact: true }).waitFor();
              await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
              record.boundary = await page.evaluate(() => ({ pending: document.documentElement.dataset.pwaSaveMutationPending, busy: document.querySelector('.v100-shell').getAttribute('aria-busy'), screen: document.documentElement.dataset.pwaScreen }));
              assert.deepEqual(await saved(page), before);
              record.legacyWrites = await page.evaluate(() => window.__OUTBREAK_LEGACY_WRITES__);
              assert.deepEqual(record.legacyWrites, []); assert.deepEqual(record.errors, []);
              await shot(page, record, "save-boundary"); record.status = "diagnostic-observed";
              console.log(JSON.stringify({ name: record.name, status: record.status, boundary: record.boundary }));
              continue;
            }
            await action(page, () => page.getByRole("button", { name: "この異常個体と再戦", exact: true }).click());
            await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot().running);
            record.active = (await saved(page)).outbreak.active;
            assert.deepEqual(await modeIdentity(page), { screen: "battle", battle: "true", result: "false" });
            if (natural) {
              await page.evaluate(() => { window.__OUTBREAK_ABORT__ = true; });
              const until = Date.now() + 240000;
              let deploymentClicks = 0;
              record.combatSamples = [];
              let baseDestroyedAt = null;
              while (Date.now() < until && !await page.getByRole("alertdialog", { name: "異常発生の戦果保存", exact: true }).isVisible()) {
                if (lane === "diagnostic") {
                  const sample = await combatObservation(page); record.combatSamples.push(sample);
                  if (sample?.barricadeHp <= 0) {
                    baseDestroyedAt ??= Date.now();
                    if (Date.now() - baseDestroyedAt >= 3000) break;
                  }
                }
                const candidate = page.locator('.unit-card[data-kind]:not([disabled]):not([aria-disabled="true"])').first();
                if (await candidate.isVisible()) { await candidate.click(); deploymentClicks += 1; }
                await page.waitForTimeout(500);
              }
              if (lane === "diagnostic") {
                record.deploymentClicks = deploymentClicks; record.diagnostic = await combatObservation(page, true);
                await shot(page, record, "diagnostic"); record.status = "diagnostic-only";
                console.log(JSON.stringify({ name: record.name, status: record.status, samples: record.combatSamples.length, diagnostic: record.diagnostic }));
                continue;
              }
              await page.getByRole("alertdialog", { name: "異常発生の戦果保存", exact: true }).waitFor({ timeout: 1000 });
              record.deploymentClicks = deploymentClicks; record.failedSave = await saved(page);
              assert.equal(record.failedSave.caps, 2000); assert.equal(record.failedSave.bosses.defeatCounts[boss.id], 1); assert.deepEqual(record.failedSave.equipment.inventory, {});
              if (lane === "result-boundary-diagnostic") {
                await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                record.boundary = await page.evaluate(() => ({ pending: document.documentElement.dataset.pwaSaveMutationPending, busy: document.querySelector('.v100-shell').getAttribute('aria-busy'), history: window.__OUTBREAK_BOUNDARY_HISTORY__ }));
                record.legacyWrites = await page.evaluate(() => window.__OUTBREAK_LEGACY_WRITES__);
                assert.deepEqual(record.legacyWrites, []); assert.deepEqual(record.errors, []);
                await shot(page, record, "result-boundary"); record.status = "diagnostic-observed";
                console.log(JSON.stringify({ name: record.name, status: record.status, boundary: record.boundary }));
                continue;
              }
              await shot(page, record, "save-aborted"); await page.evaluate(() => { window.__OUTBREAK_ABORT__ = false; });
              await action(page, () => page.getByRole("button", { name: "戦果の保存を再試行", exact: true }).click());
              await page.getByRole("region", { name: "異常発生の戦果", exact: true }).waitFor();
              record.settled = await saved(page);
              assert.equal(record.settled.outbreak.lastResult.won, true); assert.equal(record.settled.caps, 2000 + v100StageReward(boss.stageNumber, "replay"));
              assert.equal(record.settled.bosses.defeatCounts[boss.id], 2); assert.equal(record.settled.outbreak.clearCounts[boss.id], 1); assert.equal(record.settled.equipment.inventory["boss-muscle-fiber"], 1);
              assert.deepEqual(record.settled.completedStageIds, seed.completedStageIds); assert.deepEqual(record.settled.availableStageIds, seed.availableStageIds);
              assert.deepEqual(await modeIdentity(page), { screen: "result", battle: "false", result: "true" });
              await shot(page, record, "settled"); await arrive(page); await page.getByRole("region", { name: "異常発生の戦果", exact: true }).waitFor();
              assert.deepEqual(await saved(page), record.settled);
              await action(page, () => page.getByRole("button", { name: "異常発生一覧へ", exact: true }).click());
            } else {
              await page.getByRole("button", { name: "一時停止", exact: true }).click();
              await shot(page, record, "paused"); await arrive(page); await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot().running);
              assert.deepEqual((await saved(page)).outbreak.active, record.active);
              await page.getByRole("button", { name: "一時停止", exact: true }).click();
              await page.getByRole("button", { name: "ステージを最初からやり直す", exact: true }).click();
              await action(page, () => page.getByRole("button", { name: "実行する", exact: true }).click());
              const restart = (await saved(page)).outbreak.active; assert.notEqual(restart.runId, record.active.runId);
              await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot().running);
              await page.getByRole("button", { name: "一時停止", exact: true }).click();
              await page.getByRole("button", { name: "編成画面へ戻る", exact: true }).click();
              await action(page, () => page.getByRole("button", { name: "実行する", exact: true }).click());
              const current = await saved(page); assert.equal(current.caps, 2000); assert.equal(current.outbreak.active, null); assert.equal(current.bosses.defeatCounts[boss.id], 1);
              await page.locator('[data-v100-surface="personnel"]').first().waitFor(); record.restarted = restart; record.withdrawn = current.outbreak;
            }
          }
          record.legacyWrites = await page.evaluate(() => window.__OUTBREAK_LEGACY_WRITES__);
          assert.deepEqual(record.legacyWrites, []);
          assert.deepEqual(record.errors, []); record.status = "passed-mode-storage-audio-disabled";
          console.log(JSON.stringify({ name: record.name, status: record.status, images: record.images.length }));
        } catch (error) { record.status = "failed"; record.error = String(error); record.stack = error.stack; record.failureCombat = await combatObservation(page, true).catch(() => null); record.failureBoundary = await page.evaluate(() => ({ pending: document.documentElement.dataset.pwaSaveMutationPending, busy: document.querySelector('.v100-shell')?.getAttribute('aria-busy') })).catch(() => null); await shot(page, record, "failure").catch(() => {}); throw error; }
        finally { await context.close(); await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); }
      }
    } finally { await browser.close(); }
  }
} finally { await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); }
