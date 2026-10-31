import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { chromium, webkit } from "playwright";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { enterV100FromTitle, seedV100BrowserSaveOnce } from "./v100-title-qa-entry.mjs";
import { dismissInstallOffer } from "./pwa-gate-qa.mjs";
import { normalizeV100Save, serializeV100Save, validateV100SavePayload, V100_PRIMARY_STORAGE_KEY } from "../app/v100Save.js";
import { V100_STAGE_IDS } from "../app/v100Registry.js";
import { V100_STORY_SCRIPT_VERSION, v100StoryEventIdsForStage } from "../app/v100StoryEvents.js";
import { v100StoryFlowCheckpoint } from "../app/v100StoryFlow.js";
import { createV100BattleResult, collectV100ReadReplayReward } from "../app/v100Transactions.js";

const url = new URL(process.env.QUALITY_MERITS_URL), out = path.resolve(process.env.QUALITY_MERITS_OUT);
const engine = process.env.QUALITY_MERITS_ENGINE ?? "chromium", baseline = process.env.QUALITY_MERITS_BASELINE === "1";
const root = path.resolve(process.env.QUALITY_MERITS_BUILD_ROOT ?? "."), sourceRef = process.env.QUALITY_MERITS_SOURCE_REF ?? null;
assert.ok(["localhost", "127.0.0.1"].includes(url.hostname)); assert.ok(["chromium", "webkit"].includes(engine));
if (baseline) assert.equal(sourceRef, "4b6d065a7977555ab2e693072cffc8cd19ee30f9");
await mkdir(out, { recursive: false });
const build = await productionBuildIdentity(root);
if (sourceRef) { const snapshot = JSON.parse(await readFile(path.join(root, "snapshot.json"), "utf8")); assert.equal(snapshot.sourceHead, sourceRef); assert.equal(snapshot.combinedSha256, build.combinedSha256); }
const fixturePath = "tests/fixtures/quality-earned-replay-result-s01-e412.json", fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const measured = { wave: 5, kills: 23, units: [
  { unitId: "unit-hachi", damage: 1000, damageTaken: 160, healing: 0 },
  { unitId: "unit-kumaverson", damage: 400, damageTaken: 84, healing: 44 },
] };
function prepared({ stage = 1, deaths = 2, time = 70, previous = {}, missing = false, won = true, ties = false } = {}) {
  const save = structuredClone(fixture.save), stageId = V100_STAGE_IDS[stage - 1];
  save.completedStageIds = V100_STAGE_IDS.slice(0, stage); save.availableStageIds = V100_STAGE_IDS.slice(0, Math.min(30, stage + 1));
  const value = { ...createV100BattleResult({ stageId, battleRunId: "prepared-current-" + stage, won, objectiveComplete: won, bossDefeated: won,
    vehicleHp: won ? 68 : 0, vehicleMaxHp: 680, unitDeaths: deaths, elapsedSeconds: time, battleReport: ties
      ? { ...measured, units: ["unit-hachi", "unit-kumaverson", "unit-babayaga"].map(unitId => ({ unitId, damage: 25, damageTaken: 10, healing: 10 })) } : measured }) };
  assert.equal(value.stageId, stageId);
  save.lastResult = previous === null ? null : createV100BattleResult({ stageId, battleRunId: "prepared-previous-" + stage, won: true,
    objectiveComplete: true, bossDefeated: true, vehicleHp: 68, vehicleMaxHp: 680, unitDeaths: 4, elapsedSeconds: 100, ...previous });
  if (missing) for (const key of ["unitDeaths", "elapsedSeconds", "battleReport"]) delete value[key];
  save.pendingResult = won ? value : null;
  if (!won) save.lastResult = value;
  save.flowState = { phase: "result", eventId: null, stageId, stageNumber: stage, nodeIndex: 0, firstClear: false, finalized: false, scriptVersion: V100_STORY_SCRIPT_VERSION };
  save.eventCursor = null;
  const post = v100StoryEventIdsForStage(stage).filter(id => !id.endsWith(":pre"));
  save.readStoryEventIds = [...new Set([...save.readStoryEventIds, ...post])];
  save.readStoryVersions = { ...save.readStoryVersions, ...Object.fromEntries(post.map(id => [id, V100_STORY_SCRIPT_VERSION])) };
  return normalizeV100Save(save);
}
const scenarios = [
  { id: "earned-s01", seed: () => structuredClone(fixture.save), expected: ["damage", "healing"], labels: ["攻撃を支えた ババヤガ", "回復で支えた クマバーソン"], amounts: ["2,226 ダメージ", "46 HP回復（自分への回復も含む）"], allSizes: true, video: true, collect: true, earned: true },
  { id: "one-star-no-down", seed: () => prepared({ deaths: 0 }), expected: ["no-down", "faster-clear", "damage", "healing"], labels: ["戦闘不能なし", "前回より速く突破"], allSizes: true, video: true },
  { id: "fewer-downs", seed: () => prepared(), expected: ["fewer-downs", "faster-clear", "damage", "healing"], labels: ["戦闘不能を減らした", "前回4回 → 今回2回"] },
  { id: "slower-clear", seed: () => prepared({ time: 120 }), expected: ["fewer-downs", "damage", "healing"] },
  { id: "previous-other-stage", seed: () => prepared({ previous: { stageId: V100_STAGE_IDS[1] } }), expected: ["damage", "healing"] },
  { id: "missing-legacy-metrics", seed: () => prepared({ missing: true }), expected: [] },
  { id: "defeat-no-merits", seed: () => prepared({ won: false, deaths: 0 }), expected: [] },
  { id: "joint-contributors", seed: () => prepared({ previous: null, ties: true }), expected: ["damage", "healing"], labels: ["攻撃を支えた 3人", "回復で支えた 3人"] },
  { id: "s22-objective", seed: () => prepared({ stage: 22, previous: null, deaths: 0 }), expected: ["no-down", "damage", "healing"], labels: ["戦闘不能なし", "収容室43室の開放完了"] },
  { id: "s30-no-repeat-comparison", seed: () => prepared({ stage: 30, deaths: 0, previous: { stageId: V100_STAGE_IDS[28] } }), expected: ["no-down", "damage", "healing"] },
].filter(s => !baseline || s.earned);
const hash = data => createHash("sha256").update(data).digest("hex"), source = {};
for (const file of ["app/V100Campaign.tsx", "app/v100BattleReport.js", "app/v100CommandPolish.css"])
  source[file] = hash(sourceRef ? execFileSync("git", ["show", sourceRef + ":" + file], { maxBuffer: 4 * 1024 * 1024 }) : await readFile(file));
const report = { engine, url: url.href, baseline, sourceRef, source, build, qaScriptSha256: hash(await readFile(new URL(import.meta.url))),
  scope: "Retained earned S01 pre-collection result for the real-data comparison. Other results are explicitly prepared isolated save states; no win, clock, fighters or currency injected into a running battle. No human original-speed, audio or physical acceptance.",
  earnedFixture: fixture._source, cases: [], errors: [] };
const seeds = new Map(scenarios.map(scenario => { const seed = scenario.seed(), checked = validateV100SavePayload(seed);
  assert.equal(checked.ok, true, scenario.id + ": " + JSON.stringify(checked)); return [scenario.id, seed]; }));
const browser = await ({ chromium, webkit }[engine]).launch({ headless: true, ...(engine === "chromium" ? { args: ["--mute-audio"] } : {}) });
let activePage;
const saveAt = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), V100_PRIMARY_STORAGE_KEY);
const business = save => { const s = structuredClone(save); delete s.revision; delete s.updatedAt; if (s.lastResult) delete s.lastResult.finalizedAt; return s; };
async function shot(page, file) { await page.waitForFunction(() => [...document.images].filter(i => i.getClientRects().length).every(i => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }); await page.screenshot({ path: path.join(out, file) }); }
async function ready(page) { await dismissInstallOffer(page, { timeout: 30000, readySelector: ".v100-start-screen", waitForFictionDismissal: true }); await enterV100FromTitle(page); await page.evaluate(() => document.fonts.ready); const notice = page.getByText("オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。", { exact: true }); if (await notice.isVisible()) await notice.locator("..").getByRole("button", { name: "閉じる", exact: true }).click(); }
try {
  for (const scenario of scenarios) {
    const seed = structuredClone(seeds.get(scenario.id));
    const record = { case: scenario.id, prepared: !scenario.earned, layouts: [] }; report.cases.push(record);
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, serviceWorkers: "block",
      ...(scenario.video ? { recordVideo: { dir: path.join(out, "videos"), size: { width: 844, height: 390 } } } : {}) });
    await context.addInitScript(seedV100BrowserSaveOnce, serializeV100Save(seed));
    const page = await context.newPage(); activePage = page; page.on("pageerror", e => report.errors.push(String(e)));
    try {
      await page.goto(url.href); await ready(page);
      const panel = page.locator('section[aria-label="戦闘結果"]'); await panel.waitFor();
      const before = await saveAt(page), merits = panel.locator("[data-v100-merit]");
      assert.deepEqual(await merits.evaluateAll(nodes => nodes.map(n => n.dataset.v100Merit)), baseline ? [] : scenario.expected);
      if (!baseline) {
        for (const label of [...(scenario.labels ?? []), ...(scenario.amounts ?? [])]) assert.ok((await panel.innerText()).includes(label), label);
        if (scenario.id === "one-star-no-down") assert.equal(before.pendingResult.stars, 1);
        if (scenario.id === "missing-legacy-metrics") assert.deepEqual(await panel.locator(".v100-result-extra-records dd").allTextContents(), ["記録なし", "記録なし"]);
      }
      for (const viewport of scenario.allSizes ? [{ width: 1280, height: 720 }, { width: 844, height: 390 }, { width: 844, height: 340 }] : [{ width: 844, height: 340 }]) {
        await page.setViewportSize(viewport); const scroll = panel.locator(".v100-result-scroll"); await scroll.evaluate(e => e.scrollTop = 0);
        const layout = { ...viewport, buttons: [] };
        for (const button of await panel.locator(".v100-result-actions button").all()) { const r = await button.boundingBox(); assert.ok(r && r.height >= 44 && r.y >= 0 && r.y + r.height <= viewport.height + 1 && r.x >= 0 && r.x + r.width <= viewport.width + 1, JSON.stringify(r)); layout.buttons.push(r); }
        if (!baseline && scenario.expected.length) {
          const lead = panel.locator(".v100-result-lead-merit"), r = await lead.boundingBox(), area = await scroll.boundingBox();
          assert.ok(r && area && r.y >= area.y - 1 && r.y + r.height <= area.y + area.height + 1, "Lead merit clipped: " + JSON.stringify({ r, area }));
          assert.equal(await lead.evaluate(e => e.scrollWidth <= e.clientWidth + 1), true); layout.lead = r;
        }
        if (scenario.allSizes) {
          const area = await scroll.boundingBox(); layout.core = [];
          for (const core of [panel.locator(".v100-result-highlight"), ...await panel.locator(".v100-result-records > div").all().then(nodes => nodes.slice(0, 2))]) {
            const r = await core.boundingBox(); assert.ok(r && area && r.y >= area.y - 1 && r.y + r.height <= area.y + area.height + 1, "Stars/HP/objective clipped: " + JSON.stringify({ r, area })); layout.core.push(r);
          }
        }
        await shot(page, scenario.id + "-" + viewport.width + "x" + viewport.height + ".png"); record.layouts.push(layout);
      }
      if (!baseline && scenario.expected.length > 1) {
        await merits.last().scrollIntoViewIfNeeded(); await shot(page, scenario.id + "-more-merits.png");
      }
      const details = panel.locator("details.v100-battle-report");
      if (await details.count()) { await details.locator("summary").click(); assert.equal(await details.getAttribute("open"), ""); await shot(page, scenario.id + "-unit-record.png"); await details.locator("summary").click(); }
      assert.deepEqual(await saveAt(page), before); record.readOnlySavePreserved = true;
      if (scenario.collect) {
        const expected = collectV100ReadReplayReward(before, before.pendingResult); assert.equal(expected.applied, true);
        await panel.getByRole("button", { name: /^報酬を受け取る/ }).click();
        await page.waitForFunction(() => document.querySelector("#v100-campaign")?.dataset.v100Phase === "map" && !document.querySelector('#v100-campaign[aria-busy="true"]'));
        const paid = await saveAt(page); assert.deepEqual(business(paid), business({ ...expected.save, ...v100StoryFlowCheckpoint(expected.flow) }));
        assert.equal(paid.caps, 127); record.caps = [before.caps, paid.caps]; record.collectionInputs = 1; await shot(page, scenario.id + "-map.png");
        await page.reload(); await ready(page); assert.deepEqual(business(await saveAt(page)), business(paid)); record.reloadPreserved = true;
      }
    } catch (error) { await page.screenshot({ path: path.join(out, scenario.id + "-failure.png") }).catch(() => {}); throw error; }
    finally { if (scenario.video) record.video = await page.video()?.path(); await context.close(); }
  }
  assert.equal(report.cases.length, baseline ? 1 : 10); assert.deepEqual(report.errors, []); report.status = "passed";
} catch (error) { report.status = "failed"; report.failure = String(error); if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: path.join(out, "failure.png") }).catch(() => {}); throw error; }
finally { await browser.close(); await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n"); }
console.log(JSON.stringify({ engine, status: report.status, cases: report.cases.length, out }));
