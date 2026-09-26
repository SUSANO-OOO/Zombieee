import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { chromium, webkit } from "playwright";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { createDefaultV100Save, serializeV100Save, V100_PRIMARY_STORAGE_KEY as key } from "../app/v100Save.js";
import { V100_BOSSES, V100_STAGE_IDS, V100_UNITS } from "../app/v100Registry.js";
import { UNIT_CARDS } from "../app/gameRules.js";

const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(["127.0.0.1", "localhost"].includes(origin.hostname));
const out = path.resolve(process.env.V100_COMBAT_LEVEL_EVIDENCE_DIR ?? "outputs/v100-combat-level-runtime");
await fs.mkdir(out, { recursive: false });
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const report = { host: process.platform, node: process.version, build: await productionBuildIdentity(), fullAcceptance: false,
  scope: "Disclosed all-owned isolated V1 saves, no equipment,2000 CAPS, exact TAKUYA receipt, vehicleLv5. StoryStage3Lv5/OutbreakLv30/SurvivalLv15. Ordinary input and actual deployed fighters/Nao healing; audio disabled. Not natural progression, balance, native audio or physical-device acceptance.", cases: [] };
report.sources = await Promise.all(["app/v100Progression.js", "app/v100Registry.js", "app/AshfallGame.tsx", "app/v100Survival.js", "app/v100BattleAdapter.js", "scripts/v100-combat-level-browser-smoke.mjs"].map(async file => ({ file, sha256: sha(await fs.readFile(file)) })));
const ready = page => page.waitForFunction(() => document.querySelector(".v100-shell") && document.documentElement.dataset.pwaSaveMutationPending === "false");
const saved = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
async function action(page, fn) { await ready(page); const before = (await saved(page)).revision; await fn(); await page.waitForFunction(({ key, before }) => JSON.parse(localStorage.getItem(key)).revision > before && document.documentElement.dataset.pwaSaveMutationPending === "false", { key, before }); }
async function arrive(page) { const writes = await page.evaluate(() => window.__LEVEL_LEGACY_WRITES__ ?? []); assert.deepEqual(writes, []); await page.goto(new URL("/v100", origin).href, { waitUntil: "domcontentloaded" }); await page.waitForFunction(() => document.querySelector(".v100-shell") || document.querySelector('[role=dialog][aria-label="ゲームデータの準備"] button')); const offer = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true }); if (await offer.isVisible()) await offer.click(); await ready(page); }
async function shot(page, record, label) { const file = path.join(out, `${record.name}-${label}.png`), bytes = await page.screenshot({ path: file, animations: "disabled", timeout: 45000 }); record.images.push({ file, sha256: sha(bytes), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }); }
const engineNames = (process.env.V100_COMBAT_LEVEL_ENGINES ?? "chromium,webkit").split(",");
assert.ok(engineNames.length && engineNames.every(name => ["chromium", "webkit"].includes(name)));
try {
  for (const engine of engineNames) {
    const browser = await ({ chromium, webkit }[engine]).launch();
    try {
      for (const [mode, level, viewport] of [["story", 5, { width: 1280, height: 720 }], ["outbreak", 30, { width: 844, height: 390 }], ["survival", 15, { width: 844, height: 340 }]]) {
        const record = { name: `${engine}-${mode}-${viewport.width}x${viewport.height}`, engine, version: browser.version(), mode, level, viewport, status: "running", images: [], errors: [], fighters: [] }; report.cases.push(record);
        const seed = createDefaultV100Save({ playerName: "育成監査", settings: { bgmEnabled: false, sfxEnabled: false, autoSkipReadStory: true } });
        seed.campaignStarted = true; seed.caps = 2000; seed.flowState = { ...seed.flowState, phase: "map", destination: "map" };
        seed.receipts = [V100_BOSSES[0].firstDefeatReceipt]; seed.completedStageIds = V100_STAGE_IDS.slice(0, 3); seed.availableStageIds = V100_STAGE_IDS.slice(0, 4);
        seed.ownedUnitIds = V100_UNITS.map(unit => unit.id); seed.registeredUnitIds = [...seed.ownedUnitIds]; seed.unitLevels = Object.fromEntries(seed.ownedUnitIds.map(id => [id, level])); seed.levelCap = 30;
        seed.vehicle.upgradeLevel = 5; seed.vehicle.maxHp = 1080;
        seed.formationSlots = ["unit-paisen", "unit-nao", "unit-paisen", "unit-nao", "unit-paisen", "unit-nao", "unit-paisen"];
        const context = await browser.newContext({ viewport, hasTouch: mode !== "story" });
        await context.addInitScript(({ key, seed, origin }) => {
          if (location.origin !== origin) return;
          if (!localStorage.getItem(key)) localStorage.setItem(key, seed);
          window.__LEVEL_LEGACY_WRITES__ = [];
          for (const method of ["setItem", "removeItem"]) { const original = Storage.prototype[method]; Storage.prototype[method] = function (id) { if (String(id).startsWith("nishijin-campaign-v1") && !String(id).startsWith(key)) window.__LEVEL_LEGACY_WRITES__.push({ store: "local", method, key: id }); return Reflect.apply(original, this, arguments); }; }
          for (const method of ["put", "add", "delete", "clear"]) { const original = IDBObjectStore.prototype[method]; IDBObjectStore.prototype[method] = function () { if (this.transaction.db.name === "nishijin-campaign-backup") window.__LEVEL_LEGACY_WRITES__.push({ store: "indexeddb", method }); return Reflect.apply(original, this, arguments); }; }
        }, { key, seed: serializeV100Save(seed), origin: origin.origin });
        const page = await context.newPage(); page.setDefaultTimeout(45000);
        page.on("console", message => { if (message.type() === "error") record.errors.push({ type: "console", message: message.text() }); });
        page.on("pageerror", error => record.errors.push({ type: "page", message: String(error) }));
        page.on("requestfailed", request => record.errors.push({ type: "request", url: request.url(), failure: request.failure() }));
        page.on("response", response => { if (response.status() >= 400) record.errors.push({ type: "http", status: response.status(), url: response.url() }); });
        try {
          await arrive(page); const persisted = await saved(page); await arrive(page); assert.deepEqual(await saved(page), persisted);
          if (mode === "story") {
            await page.getByRole("button", { name: "西新防衛線・TAKUYA 制圧済み", exact: true }).click();
            await action(page, () => page.getByRole("button", { name: "再出撃", exact: true }).click());
            for (let n = 0; n < 40; n++) { await ready(page); if (await page.locator(".v100-formation-panel").isVisible()) break; const skip = page.getByRole("button", { name: "スキップ", exact: true }); await action(page, () => skip.isVisible().then(visible => visible ? skip.click() : page.locator(".v100-event-actions .v100-primary").click())); }
            await action(page, () => page.getByRole("button", { name: "戦闘へ", exact: true }).click());
          } else {
            await page.getByRole("button", { name: "異常発生・記録", exact: true }).click();
            if (mode === "survival") { await page.getByRole("button", { name: "サバイバル", exact: true }).click(); await action(page, () => page.getByRole("button", { name: "防衛継続作戦へ出撃", exact: true }).click()); }
            else await action(page, () => page.getByRole("button", { name: "この異常個体と再戦", exact: true }).click());
          }
          await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getPhaseGCombatSnapshot().running);
          record.stageId = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getPhaseGCombatSnapshot().stageId);
          assert.equal(record.stageId, V100_STAGE_IDS[mode === "survival" ? 0 : 2]);
          for (const kind of ["brawler", "medic"]) {
            const button = page.locator(`.unit-card[data-kind="${kind}"]:not([disabled]):not([aria-disabled="true"])`).first(); await button.waitFor(); await button.click();
            await page.waitForFunction(kind => window.__ASHFALL_BATTLE_QA__.getPhaseGCombatSnapshot().fighters.some(f => f.kind === kind && f.side === "human"), kind);
            await page.getByRole("button", { name: "一時停止", exact: true }).click();
            const actual = await page.evaluate(kind => { const f = window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(f => f.kind === kind && f.side === "human"); return Object.fromEntries(["kind", "progressionLevel", "maxHp", "damage", "speed", "laneSpeed", "range", "attackEvery", "defense", "healingMultiplier", "trapDurationMultiplier"].map(key => [key, f[key]])); }, kind);
            record.fighters.push(actual); const card = UNIT_CARDS.find(c => c.kind === kind);
            assert.equal(actual.progressionLevel, level); assert.equal(actual.maxHp, Math.round(card.hp * (1 + .025 * (level - 1)))); assert.equal(actual.damage, Math.round(card.damage * (1 + .02 * (level - 1))));
            for (const field of ["speed", "laneSpeed", "range", "attackEvery"]) assert.equal(actual[field], card[field], field);
            assert.equal(actual.defense, 0); assert.equal(actual.healingMultiplier, 1); assert.equal(actual.trapDurationMultiplier, 1);
            await shot(page, record, kind); await page.getByRole("button", { name: "作戦を再開", exact: true }).click();
          }
          const deadline = Date.now() + 90000;
          while (Date.now() < deadline) {
            const observed = await page.evaluate(() => { const s = window.__ASHFALL_BATTLE_QA__.getSnapshot(); return { time: s.time, over: s.over, naoHealing: s.roleMetrics.naoHealing, living: s.fighters.filter(f => f.side === "human" && f.hp > 0).map(f => f.kind) }; });
            record.healing = observed;
            if (observed.naoHealing > 0 || observed.over) break;
            for (const kind of ["brawler", "medic"]) if (!observed.living.includes(kind)) { const button = page.locator(`.unit-card[data-kind="${kind}"]:not([disabled]):not([aria-disabled="true"])`).first(); if (await button.isVisible()) await button.click(); }
            await page.waitForTimeout(1000);
          }
          assert.ok(record.healing.naoHealing > 0, "actual Nao healing required within90s");
          await page.getByRole("button", { name: "一時停止", exact: true }).click(); await shot(page, record, "healing");
          record.legacyWrites = await page.evaluate(() => window.__LEVEL_LEGACY_WRITES__); assert.deepEqual(record.legacyWrites, []); assert.deepEqual(record.errors, []);
          record.status = "passed-production-level-binding-audio-disabled"; console.log(JSON.stringify({ name: record.name, status: record.status, healing: record.healing.naoHealing }));
        } catch (error) { record.status = "failed"; record.error = String(error); record.stack = error.stack;
          record.failure = await page.evaluate(() => { const s = window.__ASHFALL_BATTLE_QA__?.getSnapshot(); return s ? { time: s.time, over: s.over, won: s.won, baseHp: s.baseHp, roleMetrics: s.roleMetrics, fighters: s.fighters.map(f => ({ id: f.id, kind: f.kind, side: f.side, hp: f.hp, maxHp: f.maxHp, x: f.x, y: f.y, combatReady: f.combatReady })) } : null; }).catch(() => null);
          await shot(page, record, "failure").catch(() => {}); throw error; }
        finally { await context.close(); await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); }
      }
    } finally { await browser.close(); }
  }
} finally { await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); }
