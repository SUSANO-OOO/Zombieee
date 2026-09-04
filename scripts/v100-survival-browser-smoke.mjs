import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { chromium, webkit } from "playwright";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { createDefaultV100Save, serializeV100Save, V100_PRIMARY_STORAGE_KEY as key } from "../app/v100Save.js";
import { V100_BOSSES, V100_UNITS, V100_STAGE_IDS } from "../app/v100Registry.js";
import { beginV100Survival, checkpointV100Survival, selectV100SurvivalUpgrade } from "../app/v100SurvivalTransactions.js";
import { beginSurvivalWave, completeSurvivalWave, SURVIVAL_UPGRADE_BY_ID } from "../app/survival.js";
import { survivalWaveReward } from "../app/survivalBattleRuntime.js";

const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
const out = path.resolve(process.env.V100_SURVIVAL_EVIDENCE_DIR ?? "outputs/v100-survival-runtime");
await fs.mkdir(out, { recursive: false });
const engines = (process.env.V100_SURVIVAL_ENGINES ?? "chromium,webkit").split(",");
assert.ok(engines.length && engines.every(engine => ["chromium", "webkit"].includes(engine)));
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const report = { host: process.platform, node: process.version, build: await productionBuildIdentity(), engines, fullAcceptance: false,
  scope: "Advanced isolated fixtures: all units Lv30, vehicleLv5,2000 CAPS, exact TAKUYA Story receipt; ordered Paisen/Nao/Miyamoto/Babayaga roles with duplicate slots. Desktop has no receipt. 390px plays real waves1-5;340px starts from a disclosed synthetic paid checkpoint with570HP. Audio disabled. Not natural progression, balance, native audio or physical-device acceptance.", cases: [] };
report.sources = await Promise.all(["app/v100Survival.js", "app/v100SurvivalTransactions.js", "app/survival.js", "app/survivalBattleRuntime.js", "app/v100Save.js", "app/V100SurvivalView.tsx", "app/V100ModesView.tsx", "app/V100Campaign.tsx", "app/AshfallGame.tsx", "scripts/v100-survival-browser-smoke.mjs"].map(async file => ({ file, sha256: sha(await fs.readFile(file)) })));
const boss = V100_BOSSES[0];
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const ready = page => page.waitForFunction(() => document.querySelector(".v100-shell") && document.documentElement.dataset.pwaSaveMutationPending === "false");
async function action(page, input) { await ready(page); const before = (await saved(page)).revision; await input(); await page.waitForFunction(({ key, before }) => JSON.parse(localStorage.getItem(key)).revision > before && document.documentElement.dataset.pwaSaveMutationPending === "false", { key, before }); }
async function arrive(page) {
  const prior = await page.evaluate(() => window.__SURVIVAL_LEGACY_WRITES__ ?? null); if (prior) assert.deepEqual(prior, []);
  await page.goto(new URL("/v100", origin).href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector(".v100-shell") || document.querySelector('[role=dialog][aria-label="ゲームデータの準備"] button'));
  const offer = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true }); if (await offer.isVisible()) await offer.click(); await ready(page);
}
async function shot(page, record, label) { const file = path.join(out, `${record.name}-${label}.png`), bytes = await page.screenshot({ path: file, animations: "disabled", timeout: 45000 }); record.images.push({ file, sha256: sha(bytes), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }); }
const fault = (page, enabled) => page.evaluate(enabled => { window.__SURVIVAL_ABORT__ = enabled; }, enabled);
function fixture(short) {
  let seed = createDefaultV100Save({ playerName: "防衛監査", settings: { bgmEnabled: false, sfxEnabled: false, autoSkipReadStory: true } });
  seed.campaignStarted = true; seed.caps = 2000; seed.flowState = { ...seed.flowState, phase: "map", destination: "map" };
  seed.receipts = [boss.firstDefeatReceipt]; seed.completedStageIds = V100_STAGE_IDS.slice(0, 3); seed.availableStageIds = V100_STAGE_IDS.slice(0, 4);
  seed.ownedUnitIds = V100_UNITS.map(unit => unit.id); seed.registeredUnitIds = [...seed.ownedUnitIds]; seed.unitLevels = Object.fromEntries(seed.ownedUnitIds.map(id => [id, 30])); seed.levelCap = 30;
  seed.vehicle.upgradeLevel = 5; seed.vehicle.maxHp = 1080;
  seed.formationSlots = ["unit-paisen", "unit-nao", "unit-miyamoto-musashi", "unit-babayaga", "unit-paisen", "unit-nao", "unit-babayaga"];
  if (short) {
    seed = beginV100Survival(seed, { runId: "disclosed-checkpoint-fixture" }).save;
    let run = seed.survival.active.run;
    for (let wave = 1; wave <= 5; wave++) { run = beginSurvivalWave(run); if (wave === 5) run = { ...run, lastBossKind: "takuya" }; run = completeSurvivalWave(run, { kills: 3, bossKills: wave === 5 ? 1 : 0, crawlerHp: 570, battleSeconds: 10, enemyDefeatsByKind: wave === 5 ? { takuya: 1 } : { walker: 3 }, reward: survivalWaveReward(wave) }); }
    seed = checkpointV100Survival(seed, run).save;
    const id = seed.survival.active.run.pendingUpgradeChoices.find(id => SURVIVAL_UPGRADE_BY_ID[id].category !== "crawler-repair");
    seed = selectV100SurvivalUpgrade(seed, run.runId, id).save;
  }
  return seed;
}

try {
  for (const engine of engines) {
    const browser = await ({ chromium, webkit }[engine]).launch();
    try {
      for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }, { width: 844, height: 340 }]) {
        const locked = viewport.width === 1280, short = viewport.height === 340;
        const record = { name: `${engine}-${viewport.width}x${viewport.height}`, engine, version: browser.version(), viewport, lane: locked ? "undiscovered" : short ? "synthetic-checkpoint-withdraw-abort" : "actual-wave5-checkpoint-upgrade-reload", status: "running", images: [], errors: [] }; report.cases.push(record);
        const seed = fixture(short); if (locked) { seed.receipts = []; seed.bosses.discoveredIds = V100_BOSSES.map(b => b.id); }
        const context = await browser.newContext({ viewport, hasTouch: !locked });
        await context.addInitScript(({ key, seed, origin }) => {
          if (location.origin !== origin) return;
          if (!localStorage.getItem(key)) localStorage.setItem(key, seed);
          window.__SURVIVAL_LEGACY_WRITES__ = [];
          for (const method of ["setItem", "removeItem"]) { const original = Storage.prototype[method]; Storage.prototype[method] = function (id) { if (String(id).startsWith("nishijin-campaign-v1") && !String(id).startsWith(key)) window.__SURVIVAL_LEGACY_WRITES__.push({ store: "local", method, key: id }); return Reflect.apply(original, this, arguments); }; }
          for (const method of ["put", "add", "delete", "clear"]) { const original = IDBObjectStore.prototype[method]; IDBObjectStore.prototype[method] = function () { if (this.transaction.db.name === "nishijin-campaign-backup") window.__SURVIVAL_LEGACY_WRITES__.push({ store: "indexeddb", method }); return Reflect.apply(original, this, arguments); }; }
          const original = IDBDatabase.prototype.transaction; IDBDatabase.prototype.transaction = function (stores, mode) { const tx = Reflect.apply(original, this, arguments); if (this.name === key && mode === "readwrite" && window.__SURVIVAL_ABORT__) tx.abort(); return tx; };
        }, { key, seed: serializeV100Save(seed), origin: origin.origin });
        const page = await context.newPage(); page.setDefaultTimeout(45000);
        page.on("console", message => { if (message.type() === "error") record.errors.push({ type: "console", message: message.text() }); });
        page.on("pageerror", error => record.errors.push({ type: "page", message: String(error) }));
        page.on("requestfailed", request => record.errors.push({ type: "request", url: request.url(), error: request.failure() }));
        page.on("response", response => { if (response.status() >= 400) record.errors.push({ type: "http", status: response.status(), url: response.url() }); });
        try {
          await arrive(page);
          if (!short) {
            await page.getByRole("button", { name: "異常発生・記録", exact: true }).click(); await page.getByRole("button", { name: "サバイバル", exact: true }).click();
            await shot(page, record, "hub");
            if (locked) { assert.equal(await page.getByRole("button", { name: "防衛継続作戦へ出撃", exact: true }).count(), 0); assert.equal(await page.locator("[data-outbreak-boss-id]").count(), 0); }
            else await action(page, () => page.getByRole("button", { name: "防衛継続作戦へ出撃", exact: true }).click());
          }
          if (!locked) {
            await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot().survivalRun?.modePolicy === "v100" && window.__ASHFALL_BATTLE_QA__.getSnapshot().running);
            record.initial = (await saved(page)).survival.active;
            assert.equal(record.initial.run.formation.unitIds.length, 7); assert.deepEqual(record.initial.run.bossPool, ["takuya"]);
            if (!short) {
              await fault(page, true); const until = Date.now() + 300000; let clicks = 0;
              const order = ["brawler", "medic", "miyamoto-musashi", "babayaga"];
              record.deploymentClicksByKind = {};
              while (Date.now() < until && !await page.locator(".survival-save-retry button").isVisible()) {
                const kind = order[clicks % order.length];
                const candidate = page.locator(`.unit-card[data-kind="${kind}"]:not([disabled]):not([aria-disabled="true"])`).first();
                if (await candidate.isVisible()) { await candidate.click(); clicks++; record.deploymentClicksByKind[kind] = (record.deploymentClicksByKind[kind] ?? 0) + 1; }
                await page.waitForTimeout(500);
              }
              await page.locator(".survival-save-retry button").waitFor({ timeout: 1000 }); record.deploymentClicks = clicks;
              assert.equal((await saved(page)).caps, 2000); assert.equal((await saved(page)).bosses.defeatCounts[boss.id], 1);
              await shot(page, record, "checkpoint-aborted"); await fault(page, false);
              await action(page, () => page.locator(".survival-save-retry button").click());
              record.checkpoint = await saved(page); assert.equal(record.checkpoint.caps, 2110); assert.equal(record.checkpoint.bosses.defeatCounts[boss.id], 2);
              assert.equal(record.checkpoint.survival.active.run.lastCompletedWave, 5); assert.equal(record.checkpoint.equipment.inventory["survival-field-kit"], 1);
              await shot(page, record, "checkpoint"); await arrive(page);
              await page.getByRole("dialog", { name: "ボス撃破強化選択", exact: true }).waitFor();
              assert.deepEqual(await saved(page), record.checkpoint);
              await fault(page, true); const choice = page.locator(".survival-upgrade-choices button").first(); await choice.click();
              await page.getByText("強化を保存できませんでした。もう一度、強化を選択してください。", { exact: true }).waitFor();
              assert.deepEqual(await saved(page), record.checkpoint); await shot(page, record, "upgrade-aborted"); await fault(page, false);
              await action(page, () => choice.click()); assert.equal((await saved(page)).survival.active.run.phase, "wave-ready");
            } else {
              const live = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot());
              assert.equal(live.baseHp, seed.survival.active.run.crawler.hp); assert.equal(live.baseMaxHp, 1080);
              assert.deepEqual((await saved(page)).survival.active.run.temporaryUpgradeStacks, seed.survival.active.run.temporaryUpgradeStacks);
            }
            await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getPhaseGCombatSnapshot().paused === false);
            await page.getByRole("button", { name: "一時停止", exact: true }).click(); await shot(page, record, "paused");
            if (short) await fault(page, true);
            await page.getByRole("button", { name: "エリアマップへ撤退", exact: true }).click();
            if (short) {
              const before = await saved(page); await page.getByRole("button", { name: "実行する", exact: true }).click();
              const retry = page.getByRole("button", { name: "一括保存を再試行", exact: true }); await retry.waitFor();
              assert.deepEqual(await saved(page), before); await shot(page, record, "settlement-aborted"); await fault(page, false);
              await action(page, () => retry.click());
            } else await action(page, () => page.getByRole("button", { name: "実行する", exact: true }).click());
            await page.getByRole("region", { name: "防衛継続作戦の戦果", exact: true }).waitFor(); record.result = await saved(page);
            assert.equal(record.result.survival.active, null); assert.equal(record.result.survival.totalRuns, 1); assert.equal(record.result.bosses.defeatCounts[boss.id], 2);
            assert.equal(record.result.caps, 2000 + record.result.survival.lastResult.totalCaps);
            assert.deepEqual(record.result.completedStageIds, seed.completedStageIds); assert.deepEqual(record.result.ownedUnitIds, seed.ownedUnitIds);
            assert.equal(await page.evaluate(() => document.documentElement.dataset.pwaResultSaving), "true");
            await shot(page, record, "result"); await arrive(page); await page.getByRole("region", { name: "防衛継続作戦の戦果", exact: true }).waitFor(); assert.deepEqual(await saved(page), record.result);
          }
          record.legacyWrites = await page.evaluate(() => window.__SURVIVAL_LEGACY_WRITES__); assert.deepEqual(record.legacyWrites, []); assert.deepEqual(record.errors, []);
          record.status = "passed-storage-runtime-audio-disabled"; console.log(JSON.stringify({ name: record.name, status: record.status, images: record.images.length }));
        } catch (error) {
          record.status = "failed"; record.error = String(error); record.stack = error.stack;
          record.failure = await page.evaluate(() => { const s = window.__ASHFALL_BATTLE_QA__?.getSnapshot(); return { pending: document.documentElement.dataset.pwaSaveMutationPending, busy: document.querySelector('.v100-shell')?.getAttribute('aria-busy'), run: s?.survivalRun, time: s?.time, stageId: s?.stageId, unitsLost: s?.unitsLost, naoHealing: s?.roleMetrics?.naoHealing, baseHp: s?.baseHp, paused: s?.paused, over: s?.over, running: s?.running, humans: s?.fighters?.filter(f => f.side === 'human' && f.hp > 0).map(f => ({ kind: f.kind, hp: f.hp, maxHp: f.maxHp, x: f.x, y: f.y, level: f.progressionLevel })), enemies: s?.fighters?.filter(f => f.side === 'zombie' && f.hp > 0).map(f => ({ kind: f.kind, hp: f.hp, x: f.x, y: f.y })) }; }).catch(() => null);
          await shot(page, record, "failure").catch(() => {}); throw error;
        } finally { await context.close(); await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); }
      }
    } finally { await browser.close(); }
  }
} finally { await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); }
