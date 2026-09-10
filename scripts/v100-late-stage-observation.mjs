// Bounded late-stage observation from an earned prior-stage save. This is an observation
// harness only: it does not seed resources, alter formation, or force results.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { V100_STAGES } from "../app/v100Registry.js";
import { v100FormationCombatKinds } from "../app/v100BattleAdapter.js";
import { createBattleDefinition } from "../app/battleDefinitions.js";
import { normalTacticalInput } from "./v100-normal-tactical-input.mjs";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const targetStageNumber = Number(process.env.V100_LATE_STAGE_NUMBER ?? "27");
assert.ok([24, 27].includes(targetStageNumber), "V100_LATE_STAGE_NUMBER must be 24 or 27");
const defaultSourcePath = targetStageNumber === 24
  ? "outputs/v100-earned-tactical-roster-s23-r2/save-after-23.json"
  : "outputs/v100-earned-tactical-roster-s23-r2/save-after-26.json";
const sourceOverride = targetStageNumber === 27
  ? process.env.V100_S27_SAVE
  : process.env.V100_S24_SAVE;
const sourcePath = path.resolve(sourceOverride ?? defaultSourcePath);
const defaultOutput = targetStageNumber === 24
  ? "outputs/v100-late-stage-observation-s24-r1"
  : "outputs/v100-late-stage-observation-s27-r1";
const legacyOutput = targetStageNumber === 27 ? process.env.V100_S27_OBSERVATION_OUT : undefined;
const output = path.resolve(process.env.V100_LATE_STAGE_OUT ?? legacyOutput ?? defaultOutput);
const targetStage = V100_STAGES.find(stage => stage.number === targetStageNumber);
assert.ok(targetStage, `Stage ${targetStageNumber} must exist in the V100 registry`);
const targetDefinition = createBattleDefinition(targetStage.id, { v100: true });
const expectedBossKind = targetDefinition.bossEnemyKind;
const expectedEnemyKinds = [...new Set(targetDefinition.timeline.flatMap(event => event.units))];
assert.ok(expectedEnemyKinds.length > 0, `Stage ${targetStageNumber} must have a registered enemy timeline`);
const sourceBytes = await readFile(sourcePath);
const seed = JSON.parse(sourceBytes);
const priorStageNumber = targetStageNumber - 1;
assert.equal(seed.completedStageIds.length, priorStageNumber);
assert.equal(seed.flowState.stageNumber, priorStageNumber);
assert.ok(seed.availableStageIds.includes(targetStage.id), `Earned S${priorStageNumber} save must unlock Stage ${targetStageNumber}`);
assert.ok(!seed.completedStageIds.includes(targetStage.id), `Stage ${targetStageNumber} must remain unfinished`);
assert.ok(Array.isArray(seed.formationSlots) && seed.formationSlots.length === 7);
const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");

const report = {
  status: "running",
  scope: `Bounded Stage ${targetStageNumber} natural-play observation from exact earned S${priorStageNumber} save; ordinary UI only, no QA setters, no clock/HP/result mutation. Not campaign or balance acceptance.`,
  sourcePath: path.relative(process.cwd(), sourcePath),
  sourceSha256,
  targetStage: { number: targetStage.number, id: targetStage.id, expectedBossKind, expectedEnemyKinds, bossSource: expectedBossKind ? "createBattleDefinition.bossEnemyKind" : "createBattleDefinition.bossEnemyKind=null; timeline enemy pack recorded" },
  build: await productionBuildIdentity(),
  sourceContract: { completedStages: seed.completedStageIds.length, caps: seed.caps, ownedUnitIds: seed.ownedUnitIds, registeredUnitIds: seed.registeredUnitIds, formationSlots: seed.formationSlots },
  formationPolicy: "preserve saved formation; battle inputs may deploy only saved formation kinds and never rewrite formationSlots",
  controls: { maxWallSeconds: 240, sampleIntervalSeconds: 1, maxSamples: 300, maxMilestonePngs: 8 },
  samples: [], milestones: {}, inputs: [], errors: [], idleGaps: [], humanLosses: [], statusReason: null,
};
const persist = () => writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
const phase = page => page.locator(".v100-shell").getAttribute("data-v100-phase");
const ready = async page => {
  await page.waitForFunction(() => !document.querySelector(".v100-shell[aria-busy=\"true\"]"));
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
};
const uiClick = async (page, locator) => { await ready(page); await locator.click(); await ready(page); };
const savedUnitIds = seed.formationSlots.filter(Boolean);
const savedKinds = new Set(v100FormationCombatKinds(savedUnitIds));
assert.equal(savedUnitIds.length, 7, `S${targetStageNumber} save must contain seven non-null formation ids`);
assert.equal(savedKinds.size, 5, `S${targetStageNumber} formation id mapping must resolve to five combat kinds`);
assert.deepEqual(v100FormationCombatKinds(savedUnitIds), ["guardian", "mrs-chiha", "medic", "ranger", "babayaga", "guardian", "medic"]);
report.sourceContract.formationCombatKinds = [...savedKinds].sort();

if (process.env.V100_LATE_STAGE_PREFLIGHT_ONLY === "1") {
  console.log(JSON.stringify({
    stage: targetStageNumber,
    priorStage: priorStageNumber,
    sourcePath: path.relative(process.cwd(), sourcePath),
    sourceSha256,
    flowState: seed.flowState,
    completedStageIds: seed.completedStageIds,
    availableStageIds: seed.availableStageIds,
    ownedUnitIds: seed.ownedUnitIds,
    registeredUnitIds: seed.registeredUnitIds,
    formationSlots: seed.formationSlots,
    formationCombatKinds: v100FormationCombatKinds(savedUnitIds),
    expectedBossKind,
    expectedEnemyKinds,
    viewport: { width: 844, height: 340 },
  }));
  process.exit(0);
}

const origin = process.env.V100_CAMPAIGN_QA_BASE_URL ? new URL(process.env.V100_CAMPAIGN_QA_BASE_URL) : null;
assert.ok(origin, "V100_CAMPAIGN_QA_BASE_URL is required unless V100_LATE_STAGE_PREFLIGHT_ONLY=1");
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
await mkdir(output, { recursive: false });
await mkdir(path.join(output, "videos"), { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 844, height: 340 }, hasTouch: true, isMobile: true, recordVideo: { dir: path.join(output, "videos"), size: { width: 844, height: 340 } } });
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on("pageerror", error => report.errors.push({ kind: "page", message: String(error) }));
page.on("console", message => { if (message.type() === "error") report.errors.push({ kind: "console", message: message.text() }); });
page.on("requestfailed", request => report.errors.push({ kind: "request", url: request.url(), message: request.failure()?.errorText }));
page.on("response", response => { if (response.status() >= 400) report.errors.push({ kind: "http", url: response.url(), status: response.status() }); });

try {
  await page.addInitScript(({ originValue, save }) => {
    if (location.origin === originValue && !localStorage.getItem("nishijin-campaign-v100")) localStorage.setItem("nishijin-campaign-v100", save);
  }, { originValue: origin.origin, save: sourceBytes.toString("utf8") });
  await page.goto(origin.href);
  await uiClick(page, page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true }));
  await page.waitForFunction(() => document.querySelector(".v100-shell[aria-busy=\"false\"]"));
  assert.equal(await phase(page), "map");
  await uiClick(page, page.getByRole("button", { name: "この作戦を編成", exact: true }));
  for (let step = 0; step < 100 && await phase(page) !== "formation"; step += 1) {
    const currentPhase = await phase(page);
    if (["event", "post", "first-clear-post"].includes(currentPhase)) await uiClick(page, page.locator(".v100-event-actions .v100-primary"));
    else if (currentPhase === "map") await uiClick(page, page.getByRole("button", { name: "この作戦を編成", exact: true }));
    else await page.waitForTimeout(100);
  }
  assert.equal(await phase(page), "formation", "S27 map/event flow must reach formation within bounded event steps");
  const selectedStage = await page.evaluate(() => JSON.parse(localStorage.getItem("nishijin-campaign-v100")).flowState);
  assert.equal(selectedStage.stageNumber, targetStageNumber, `Map selection must enter Stage ${targetStageNumber}`);
  assert.equal(selectedStage.stageId, targetStage.id, `Map selection must enter the registered Stage ${targetStageNumber} id`);
  const beforeFormation = await page.evaluate(() => JSON.parse(localStorage.getItem("nishijin-campaign-v100")).formationSlots);
  assert.deepEqual(beforeFormation, seed.formationSlots, `S${targetStageNumber} observation must preserve saved formation`);
  report.openingFormation = beforeFormation;
  await uiClick(page, page.getByRole("button", { name: "戦闘へ", exact: true }));
  for (let step = 0; step < 20 && await phase(page) !== "battle"; step += 1) {
    const currentPhase = await phase(page);
    if (["event", "post", "first-clear-post"].includes(currentPhase)) await uiClick(page, page.locator(".v100-event-actions .v100-primary"));
    else if (currentPhase === "formation") await uiClick(page, page.getByRole("button", { name: "戦闘へ", exact: true }));
    else if (currentPhase === "result") break;
    else await page.waitForTimeout(100);
  }
  await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
  const opening = await page.evaluate(() => JSON.parse(localStorage.getItem("nishijin-campaign-v100")));
  assert.deepEqual(opening.formationSlots, seed.formationSlots);
  report.openingSave = { revision: opening.revision, flowState: opening.flowState, formationSlots: opening.formationSlots, ownedUnitIds: opening.ownedUnitIds, unitLevels: opening.unitLevels, vehicle: opening.vehicle, caps: opening.caps };
  report.preBattleResourceCheck = { capsUnchanged: JSON.stringify(opening.caps) === JSON.stringify(seed.caps), ownedUnitIdsUnchanged: JSON.stringify(opening.ownedUnitIds) === JSON.stringify(seed.ownedUnitIds), unitLevelsUnchanged: JSON.stringify(opening.unitLevels) === JSON.stringify(seed.unitLevels), vehicleUnchanged: JSON.stringify(opening.vehicle) === JSON.stringify(seed.vehicle), formationUnchanged: JSON.stringify(opening.formationSlots) === JSON.stringify(seed.formationSlots) };
  assert.ok(Object.values(report.preBattleResourceCheck).every(Boolean), "Saved resources/formation changed before battle");

  const started = Date.now(); let lastSampleTime = -Infinity; let lastIdleStart = null; const seenHumanIds = new Map(); const tacticalRecord = { inputs: [], samples: [] }; let copiedInputs = 0; let lastSnapshot = null;
  while (Date.now() - started < 240000 && await phase(page) === "battle" && report.samples.length < 300) {
    const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null);
    if (!snapshot) break;
    lastSnapshot = snapshot;
    const now = Number(snapshot.time);
    if (now - lastSampleTime >= 1) {
      const enemies = (snapshot.fighters ?? []).filter(f => f.side === "zombie");
      const humans = (snapshot.fighters ?? []).filter(f => f.side === "human");
      const livingEnemies = enemies.filter(f => f.hp > 0);
      const enemyScheduling = { enemySpawn: snapshot.enemySpawn ?? null, enemyQueue: snapshot.enemyQueue ?? null, eventIndex: snapshot.eventIndex ?? null, wave: snapshot.wave };
      const phaseSnapshot = targetStageNumber === 24 ? await page.evaluate(() => window.__ASHFALL_BATTLE_QA__?.getPhaseGCombatSnapshot?.() ?? null) : null;
      const phaseBosses = phaseSnapshot?.fighters?.filter(f => f.kind === expectedBossKind) ?? [];
      const sample = { time: now, baseHp: snapshot.baseHp, baseMaxHp: snapshot.baseMaxHp, wave: snapshot.wave, objective: snapshot.objective ?? snapshot.missionObjective ?? null, bossKind: snapshot.bossKind ?? null, bossDefeated: snapshot.bossDefeated, bossDefeatPending: snapshot.bossDefeatPending, deployQueue: snapshot.deployQueue ?? [], enemyScheduling, ...(phaseSnapshot ? { phaseGCombat: { bossHp: phaseSnapshot.bossHp ?? null, bossMax: phaseSnapshot.bossMax ?? null, bossKind: phaseSnapshot.bossKind ?? null, bossPhase: phaseSnapshot.bossPhase ?? null, fighters: phaseBosses.map(f => ({ id: f.id, kind: f.kind, hp: f.hp, maxHp: f.maxHp, abilityWindup: f.abilityWindup, phase: f.stationAbility?.phase ?? null, x: f.x, y: f.y })) } } : {}), enemies: enemies.map(f => ({ id: f.id, kind: f.kind, hp: f.hp, maxHp: f.maxHp, x: f.x, y: f.y, attack: f.attack, attackWindup: f.attackWindup, abilityWindup: f.abilityWindup, phase: f.stationAbility?.phase ?? null })), humans: humans.map(f => ({ id: f.id, kind: f.kind, hp: f.hp, maxHp: f.maxHp, x: f.x, y: f.y })), corpses: (snapshot.corpses ?? []).map(f => ({ id: f.id, kind: f.kind, side: f.side ?? null })), roleMetrics: snapshot.roleMetrics ?? null };
      report.samples.push(sample);
      for (const fighter of humans) seenHumanIds.set(String(fighter.id), fighter.kind);
      for (const fighter of humans.filter(f => f.hp <= 0)) if (!report.humanLosses.some(loss => loss.id === fighter.id)) report.humanLosses.push({ time: now, id: fighter.id, kind: fighter.kind, evidence: "fighter.hp<=0" });
      for (const corpse of snapshot.corpses ?? []) if (seenHumanIds.has(String(corpse.id)) && !report.humanLosses.some(loss => loss.id === corpse.id)) report.humanLosses.push({ time: now, id: corpse.id, kind: corpse.kind ?? seenHumanIds.get(String(corpse.id)), evidence: "human corpse" });
      const idle = livingEnemies.length === 0;
      if (idle && lastIdleStart === null) lastIdleStart = now;
      if (!idle && lastIdleStart !== null) { report.idleGaps.push({ start: lastIdleStart, end: now, duration: now - lastIdleStart, basis: "no living enemies", enemySchedulingAtEnd: enemyScheduling }); lastIdleStart = null; }
      if (expectedBossKind && !report.milestones.firstBossSeen && livingEnemies.some(f => f.kind === expectedBossKind)) { report.milestones.firstBossSeen = sample; await page.screenshot({ path: path.join(output, "first-boss-seen.png") }); }
      if (!report.milestones.firstEnemyPackSeen && livingEnemies.some(f => expectedEnemyKinds.includes(f.kind))) { report.milestones.firstEnemyPackSeen = sample; await page.screenshot({ path: path.join(output, "first-enemy-pack-seen.png") }); }
      if (!report.milestones.midHp && Number.isFinite(sample.baseHp) && sample.baseHp <= sample.baseMaxHp * .5) { report.milestones.midHp = sample; await page.screenshot({ path: path.join(output, "mid-base-hp.png") }); }
      if (!report.milestones.lowBase && Number.isFinite(sample.baseHp) && sample.baseHp <= sample.baseMaxHp * .2) { report.milestones.lowBase = sample; await page.screenshot({ path: path.join(output, "low-base-hp.png") }); }
      lastSampleTime = now; await persist();
    }
    await normalTacticalInput(page, tacticalRecord);
    for (; copiedInputs < tacticalRecord.inputs.length; copiedInputs += 1) {
      const action = tacticalRecord.inputs[copiedInputs];
      if (action.kind && !savedKinds.has(action.kind)) throw new Error(`normalTacticalInput selected kind outside saved formation: ${action.kind}`);
      report.inputs.push({ ...action, source: "normalTacticalInput", savedFormationCompatible: true });
    }
    await page.waitForTimeout(180);
  }
  if (lastIdleStart !== null && report.samples.length) { const end = report.samples.at(-1).time; report.idleGaps.push({ start: lastIdleStart, end, duration: end - lastIdleStart, basis: "no living enemies", enemySchedulingAtEnd: report.samples.at(-1).enemyScheduling }); }
  report.largestIdleGap = report.idleGaps.reduce((best, gap) => gap.duration > (best?.duration ?? -1) ? gap : best, null);
  report.tacticalSamples = tacticalRecord.samples;
  if (await phase(page) === "result") {
    report.result = await page.evaluate(() => JSON.parse(localStorage.getItem("nishijin-campaign-v100")).pendingResult ?? JSON.parse(localStorage.getItem("nishijin-campaign-v100")).lastResult);
    await page.screenshot({ path: path.join(output, "result.png") }); report.milestones.result = report.result;
    report.terminalOutcome = typeof report.result?.won === "boolean" ? (report.result.won ? "win" : "loss") : "unknown";
  } else if (lastSnapshot?.over && typeof lastSnapshot.won === "boolean") report.terminalOutcome = lastSnapshot.won ? "win" : "loss";
  else report.terminalOutcome = Date.now() - started >= 240000 ? "timeout" : "unknown";
  report.status = "observed";
} catch (error) {
  report.status = "failed"; report.statusReason = String(error.stack ?? error); await page.screenshot({ path: path.join(output, "failure.png") }).catch(() => {}); process.exitCode = 1;
} finally {
  if (report.status === "observed" && report.errors.length) { report.status = "observation-error"; report.statusReason = `${report.errors.length} browser diagnostics recorded`; }
  await persist(); await context.storageState({ path: path.join(output, "browser-storage.json"), indexedDB: true }).catch(() => {}); await context.close().catch(() => {}); await browser.close();
  console.log(JSON.stringify({ status: report.status, error: report.statusReason, output }));
}
