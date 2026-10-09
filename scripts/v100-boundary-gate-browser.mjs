import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const useCurrentWebKit = process.env.NEW_V100_NATIVE_CURRENT_WEBKIT === "1";
const { chromium, webkit } = await import(useCurrentWebKit ? "./pwa-native-runtime/node_modules/playwright/index.mjs" : "playwright");
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { V100_INITIAL_UNIT_IDS, V100_STAGE_IDS, V100_VEHICLE } from "../app/v100Registry.js";
import { createBattleDefinition } from "../app/battleDefinitions.js";
import { drawV100AssaultObject, v100AssaultObjectState } from "../app/v100AssaultObjects.js";
import { battleSpaceFor } from "../app/battleSpace.js";
import { isCombatTargetable } from "../app/combatLifecycle.js";
import { STAGE_VIEWPORT_IDS } from "../app/stageGeometry.js";
import { normalTacticalInput } from "./v100-normal-tactical-input.mjs";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const engineName = process.env.V100_BOUNDARY_GATE_ENGINE ?? "chromium";
const output = process.env.V100_BOUNDARY_GATE_OUT ?? "outputs/v100-boundary-gate-browser-r1";
const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(["chromium", "webkit"].includes(engineName));
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
const viewports = [{ width: 1280, height: 720 }, { width: 844, height: 390 }, { width: 844, height: 340 }];
const sourcePath = "/art/v100/mission-objects/boundary-gate-states-r1.webp";
const sourceFile = new URL(`../public${sourcePath}`, import.meta.url);
const sourceHash = "091a1c3ff4300e3399750ca8f0148680432dbc3aecd24dba12cc2e3a605f2813";
const columns = [0, 466, 882, 1260, 1672];
const oldBoundarySourcePaths = new Set([
  "/art/v075/enemy-base/enemy-stronghold-intact-v2.png",
  "/art/v070/stages/objects/station-gate-objects-v1.png",
]);

function boundaryState(hp, maxHp) { const ratio = Math.max(0, hp) / Math.max(1, maxHp); return ratio <= 0 ? 3 : ratio <= .35 ? 2 : ratio <= .7 ? 1 : 0; }
function runBoundaryControls() {
  const calls = [];
  const context = { save() {}, restore() {}, beginPath() {}, ellipse() {}, fill() {}, drawImage(...args) { calls.push(args); } };
  const image = { complete: true, naturalWidth: 2090, naturalHeight: 941 };
  const stageObjects = { "v100-assault-stronghold": image };
  const laneCenters = [180, 340, 500];
  for (const barricadeHp of [1000, 700, 350, 0]) {
    const game = { definition: { stageId: V100_STAGE_IDS[0], missionConfig: { v100StageNumber: 1 } }, barricadeHp, barricadeMaxHp: 1000, barricadeHitFlash: 0 };
    assert.equal(drawV100AssaultObject(context, game, stageObjects, { attackX: 800 }, laneCenters), true);
  }
  assert.deepEqual(calls.map(call => call.slice(1, 5)), [[0, 0, 466, 941], [466, 0, 416, 941], [882, 0, 378, 941], [1260, 0, 412, 941]]);
  assert.deepEqual(calls.map(call => call[1]), [0, 466, 882, 1260]);
  assert.deepEqual([1000, 700, 350, 0].map(hp => boundaryState(hp, 1000)), [0, 1, 2, 3]);
  assert.deepEqual([1000, 700, 350, 0].map(hp => v100AssaultObjectState({ barricadeHp: hp, barricadeMaxHp: 1000 })), [0, 1, 2, 3]);
  assert.ok(calls.every(call => call[5] > 0 && call[6] > 0 && Number.isFinite(call[7]) && Number.isFinite(call[8])));
  return { passed: true, checks: ["drawV100AssaultObject source contract", "four authored source columns", "state thresholds", "finite destination geometry"] };
}

function installBoundaryAudit({ save, sourcePath, oldSourcePaths = [] }) {
  for (const key of ["nishijin-campaign-v100", "nishijin-campaign-v100:mirror", "nishijin-campaign-v100:last-known-good"]) localStorage.setItem(key, save);
  const audit = { draws: [], totalDraws: 0, oldSourceDraws: 0, firstByState: {}, entryObservations: {}, entryObservationCount: 0, entryViolationCount: 0, entryViolations: [], stateTransitions: [], lastState: null, contractErrors: [], captureOrder: {}, active: true }; window.__V100_BOUNDARY_GATE__ = audit;
  const original = CanvasRenderingContext2D.prototype.drawImage; const lineage = new WeakMap();
  const sizeOf = image => ({ width: image?.naturalWidth || image?.width || 0, height: image?.naturalHeight || image?.height || 0 });
  const rectFor = (image, args) => args.length === 4 ? [0, 0, sizeOf(image).width, sizeOf(image).height, ...args] : args.length === 8 ? args : null;
  CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
    const source = image?.currentSrc || image?.src || ""; const rect = rectFor(image, args); const production = document.querySelector(".game-shell canvas");
    const isOldTower = oldSourcePaths.some(path => source.includes(path)) && source.includes("/art/v075/enemy-base/enemy-stronghold-intact-v2.png"); const isOldRelay = oldSourcePaths.some(path => source.includes(path)) && source.includes("/art/v070/stages/objects/station-gate-objects-v1.png") && rect?.[0] === 1080 && rect?.[1] === 210 && rect?.[2] === 360 && rect?.[3] === 540;
    const direct = rect && source.includes(sourcePath) ? { type: "boundary", path: sourcePath, sourceRect: rect.slice(0, 4) } : rect && (isOldTower || isOldRelay) ? { type: "legacy", path: source, sourceRect: rect.slice(0, 4) } : null;
    const prior = image instanceof HTMLCanvasElement && image !== production ? lineage.get(image) : null;
    const derived = direct || prior;
    if (derived && rect && this.canvas !== production) lineage.set(this.canvas, derived); else if (!derived) lineage.delete(this.canvas);
    if (audit.active && derived && rect && this.canvas === production && derived.type === "legacy") { audit.oldSourceDraws += 1; return original.call(this, image, ...args); }
    if (audit.active && derived && rect && this.canvas === production && derived.type === "boundary") {
      const m = this.getTransform(); const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.(); const hp = snapshot?.barricadeHp; const maxHp = snapshot?.barricadeMaxHp; if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || !snapshot?.geometry) { audit.contractErrors.push({ type: "snapshot-contract", hp, maxHp, geometry: Boolean(snapshot?.geometry) }); return original.call(this, image, ...args); } const state = hp <= 0 ? 3 : hp / Math.max(1, maxHp) <= .35 ? 2 : hp / Math.max(1, maxHp) <= .7 ? 1 : 0; const expectedColumn = [0, 466, 882, 1260][state]; if (derived.sourceRect[0] !== expectedColumn) audit.contractErrors.push({ type: "state-source-mismatch", state, sourceX: derived.sourceRect[0], expectedColumn }); const record = { sourcePath: derived.path, sourceRect: derived.sourceRect, destination: rect.slice(4, 8), transform: { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f }, canvas: { width: this.canvas.width, height: this.canvas.height }, state, barricadeHp: hp, barricadeMaxHp: maxHp, geometry: snapshot.geometry, rAFSnapshot: true };
      audit.totalDraws += 1; if (audit.draws.length >= 256) audit.draws.shift(); audit.draws.push(record);
      if (audit.lastState !== state) { audit.stateTransitions.push(state); audit.lastState = state; }
      for (const fighter of snapshot?.fighters ?? []) if (fighter.side === "zombie") { const prior = audit.entryObservations[fighter.id] ?? { samples: [] }; const observation = { time: snapshot.time, id: fighter.id, kind: fighter.kind, x: fighter.x, y: fighter.y, gateEntering: fighter.gateEntering, combatReady: fighter.combatReady, combatReadyX: fighter.combatReadyX, targetable: fighter.targetable, spawnEntryMode: fighter.spawnEntryMode, abilityWindup: fighter.abilityWindup, attack: fighter.attack, attackWindup: fighter.attackWindup, targetId: fighter.targetId, clip: fighter.animationPresentation?.state }; if (fighter.gateEntering) { audit.entryObservationCount += 1; const violation = observation.attack !== 0 || observation.attackWindup !== 0 || observation.abilityWindup !== 0 || observation.targetId !== null || observation.combatReady !== false; if (violation) { audit.entryViolationCount += 1; if (audit.entryViolations.length < 32) audit.entryViolations.push(observation); } if (prior.samples.length < 64) prior.samples.push(observation); } audit.entryObservations[fighter.id] = { samples: prior.samples, firstEntry: prior.firstEntry ?? (fighter.gateEntering ? observation : null), firstReady: prior.firstReady ?? (fighter.combatReady ? observation : null) }; }
      if (audit.firstByState[state] === undefined) { audit.firstByState[state] = record; requestAnimationFrame(() => { if (audit.captures[state]) return; if (production.__lastOriginalDrawn !== undefined) audit.captureOrder[state] = production.__lastOriginalDrawn; const copy = document.createElement("canvas"); copy.width = production.width; copy.height = production.height; copy.getContext("2d")?.drawImage(production, 0, 0); audit.captures[state] = copy; }); }
    }
    return original.call(this, image, ...args);
  };
  audit.captures = {};
}

function runSerializedBoundaryControl() {
  const originalCalls = []; const snapshots = [1000, 650, 300, 0]; let snapshotIndex = 0;
  class FakeCanvas { constructor() { this.width = 960; this.height = 540; } getContext() { return new FakeContext(this); } }
  class FakeContext { constructor(canvas) { this.canvas = canvas; this.globalAlpha = 1; } drawImage(...args) { originalCalls.push(args); if (this.canvas === production) production.__lastOriginalDrawn = true; } getTransform() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; } }
  const production = new FakeCanvas(); const cached = new FakeCanvas(); const source = { src: sourcePath, width: 2090, height: 941 }; const oldTower = { src: "/art/v075/enemy-base/enemy-stronghold-intact-v2.png", width: 800, height: 600 }; const oldRelay = { src: "/art/v070/stages/objects/station-gate-objects-v1.png", width: 1800, height: 900 }; const oldPerson = { src: "/art/v060/characters/legacy/infected-battle-gutter-v1.png", width: 2172, height: 724 }; const wrong = { src: "/art/v060/characters/station-relay.png", width: 2090, height: 941 };
  assert.equal(isCombatTargetable({ targetable: true, combatReady: false, hp: 100 }), false);
  assert.equal(isCombatTargetable({ targetable: true, combatReady: true, hp: 100 }), true);
  const rafQueue = []; let controlEntryCalls = 0; let violationMode = "all"; const fakeWindow = { __ASHFALL_BATTLE_QA__: { getSnapshot: () => { const entryCall = controlEntryCalls++; const invalid = entryCall >= 65; const violates = (mode) => invalid && (violationMode === "all" || violationMode === mode); return { barricadeHp: snapshots[Math.min(snapshotIndex++, snapshots.length - 1)], barricadeMaxHp: 1000, geometry: { viewportId: "control" }, fighters: [{ id: 7, side: "zombie", gateEntering: true, combatReady: violates("combatReady"), combatReadyX: 700, targetable: true, spawnEntryMode: "right-edge-outside", abilityWindup: violates("abilityWindup") ? .1 : 0, attack: violates("attack") ? 1 : 0, attackWindup: violates("attackWindup") ? .1 : 0, targetId: violates("targetId") ? "target" : null, animationPresentation: { state: "move" } }] }; } }, requestAnimationFrame: callback => rafQueue.push(callback) };
  const fakeDocument = { querySelector: () => production, createElement: () => new FakeCanvas() }; const fakeStorage = { setItem() {} };
  const serialized = Function("CanvasRenderingContext2D", "HTMLCanvasElement", "document", "localStorage", "window", "requestAnimationFrame", `return (${installBoundaryAudit.toString()})`)(FakeContext, FakeCanvas, fakeDocument, fakeStorage, fakeWindow, fakeWindow.requestAnimationFrame);
  serialized({ save: "fixture", sourcePath, oldSourcePaths: [...oldBoundarySourcePaths] }); const productionContext = new FakeContext(production); const cacheContext = new FakeContext(cached); const audit = fakeWindow.__V100_BOUNDARY_GATE__;
  productionContext.drawImage(oldTower, 0, 0, 800, 600, 0, 0, 100, 100); assert.equal(audit.oldSourceDraws, 1); cacheContext.drawImage(oldTower, 0, 0, 800, 600, 0, 0, 100, 100); assert.equal(audit.oldSourceDraws, 1); productionContext.drawImage(cached, 0, 0, 100, 100, 0, 0, 100, 100); assert.equal(audit.oldSourceDraws, 2);
  productionContext.drawImage(oldRelay, 1080, 210, 360, 540, 0, 0, 100, 100); assert.equal(audit.oldSourceDraws, 3); productionContext.drawImage(oldRelay, 0, 0, 360, 540, 0, 0, 100, 100); productionContext.drawImage(oldPerson, 0, 0, 544, 512, 0, 0, 100, 100); assert.equal(audit.oldSourceDraws, 3);
  for (let index = 0; index < 4; index += 1) { productionContext.drawImage(source, columns[index], 0, columns[index + 1] - columns[index], 941, 0, 0, 100, 100); while (rafQueue.length) rafQueue.shift()(); }
  const beforeWrong = audit.draws.length; productionContext.drawImage(wrong, 0, 0, 100, 100, 0, 0, 100, 100); assert.equal(audit.draws.length, beforeWrong);
  cacheContext.drawImage(source, columns[3], 0, columns[4] - columns[3], 941, 0, 0, 100, 100); productionContext.drawImage(cached, 0, 0, 100, 100, 0, 0, 100, 100); while (rafQueue.length) rafQueue.shift()(); assert.equal(audit.draws.at(-1)?.sourcePath, sourcePath);
  assert.deepEqual(Object.keys(audit.firstByState).sort(), ["0", "1", "2", "3"]); assert.equal(audit.draws.every(draw => draw.rAFSnapshot && draw.sourcePath === sourcePath), true); assert.equal(audit.oldSourceDraws, 3); assert.deepEqual(Object.values(audit.captureOrder), [true, true, true, true]); assert.deepEqual(audit.contractErrors, []);
  controlEntryCalls = 0; const beforeEntryCount = audit.entryObservationCount; const beforeViolationCount = audit.entryViolationCount; for (let index = 0; index < 66; index += 1) { productionContext.drawImage(source, columns[3], 0, columns[4] - columns[3], 941, 0, 0, 100, 100); while (rafQueue.length) rafQueue.shift()(); } assert.equal(audit.entryObservationCount - beforeEntryCount, 66); assert.equal(audit.entryViolationCount - beforeViolationCount, 1);
  const isolatedViolationModes = ["combatReady", "attack", "attackWindup", "abilityWindup", "targetId"]; for (const mode of isolatedViolationModes) { violationMode = mode; controlEntryCalls = 0; const beforeIsolated = audit.entryViolationCount; for (let index = 0; index < 66; index += 1) { productionContext.drawImage(source, columns[3], 0, columns[4] - columns[3], 941, 0, 0, 100, 100); while (rafQueue.length) rafQueue.shift()(); } assert.equal(audit.entryViolationCount - beforeIsolated, 1, `isolated ${mode} entry violation`); }
  return { passed: true, checks: ["serialized real hook", "four boundary states", "legacy direct/cache/region counting", "wrong path and legacy character rejection", "queued rAF after original draw", "65 valid entry observations then isolated combatReady/attack/attackWindup/abilityWindup/targetId violations"] };
}

if (process.env.V100_BOUNDARY_GATE_CONTROL_ONLY === "1") {
  console.log(JSON.stringify({ static: runBoundaryControls(), serializedHook: runSerializedBoundaryControl() }));
  process.exit(0);
}

const bytes = await readFile(sourceFile); assert.equal(createHash("sha256").update(bytes).digest("hex"), sourceHash, "boundary gate source hash drifted");
const base = createDefaultV100Save({ playerName: "V1 boundary gate native" });
const stageId = V100_STAGE_IDS[0]; const initialUnits = [...V100_INITIAL_UNIT_IDS]; const save = serializeV100Save(normalizeV100Save({ ...base, campaignStarted: true, revision: 1, availableStageIds: V100_STAGE_IDS.slice(0, 1), completedStageIds: [], ownedUnitIds: initialUnits, registeredUnitIds: initialUnits, formationSlots: [...initialUnits, null, null, null], levelCap: 1, unitLevels: Object.fromEntries(initialUnits.map(id => [id, 1])), vehicle: { ...base.vehicle, upgradeLevel: V100_VEHICLE.maxUpgradeLevel, upgradeReceipts: ["v100:vehicle:1", "v100:vehicle:2", "v100:vehicle:3", "v100:vehicle:4", "v100:vehicle:5"] }, flowState: { phase: "formation", stageId, stageNumber: 1, destination: "formation", nodeIndex: 0, firstClear: false, finalized: true } }));
const timelineEnd = Math.max(...createBattleDefinition(stageId, { v100: true }).timeline.map(event => Number(event.at) || 0), 0);
const report = { status: "running", engine: engineName, build: await productionBuildIdentity(), sourcePath, sourceSha256: sourceHash, sourceColumns: columns, fixture: `V1 S1 default starter roster ${initialUnits.length} units Lv1, explicit vehicle Lv5; ordinary UI/normalTacticalInput only`, deadlineSeconds: timelineEnd + 120, controls: { static: runBoundaryControls(), serializedHook: runSerializedBoundaryControl() }, cases: [], scope: "Finite native boundary-gate presentation evidence; no victory, difficulty, balance, audio, or physical-device acceptance." };
await mkdir(output, { recursive: false });
const api = { chromium, webkit }[engineName];
try {
  for (const viewport of viewports) {
    const browser = await api.launch({ headless: true }); const context = await browser.newContext({ viewport, hasTouch: true, isMobile: viewport.width < 1000 }); const page = await context.newPage(); const item = { viewport, status: "running", errors: [], entries: {}, gateStates: {}, draws: [], samples: [] }; report.cases.push(item);
    page.on("pageerror", error => item.errors.push(String(error))); page.on("console", message => { if (message.type() === "error") item.errors.push(message.text()); }); page.on("requestfailed", request => item.errors.push(`${request.url()}: ${request.failure()?.errorText ?? "failed"}`)); page.on("response", response => { if (response.status() >= 400) item.errors.push(`${response.status()} ${response.url()}`); });
    try {
      await page.addInitScript(installBoundaryAudit, { save, sourcePath, oldSourcePaths: [...oldBoundarySourcePaths] }); await page.goto(new URL("v100", origin).href); const play = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true }); const start = page.getByRole("button", { name: "戦闘へ", exact: true }); await play.or(start).first().waitFor(); if (await play.isVisible().catch(() => false)) await play.click(); await start.click(); await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
      const record = { inputs: [], samples: [] }; const deadline = Date.now() + (timelineEnd + 120) * 1000; const seen = new Map();
      while (Date.now() < deadline) {
        const snapshot = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.());
        for (const fighter of snapshot?.fighters ?? []) if (fighter.side === "zombie") { const prior = seen.get(fighter.id) ?? {}; const next = { firstEntry: prior.firstEntry ?? (fighter.gateEntering ? { time: snapshot.time, ...fighter } : null), firstReady: prior.firstReady ?? (fighter.combatReady ? { time: snapshot.time, ...fighter } : null) }; seen.set(fighter.id, next); }
        item.entries = Object.fromEntries(seen); item.samples.push({ time: snapshot?.time, barricadeHp: snapshot?.barricadeHp, barricadeMaxHp: snapshot?.barricadeMaxHp, geometry: snapshot?.geometry, fighters: (snapshot?.fighters ?? []).filter(f => f.side === "zombie").map(f => ({ id: f.id, kind: f.kind, x: f.x, y: f.y, gateEntering: f.gateEntering, combatReady: f.combatReady, attack: f.attack, attackWindup: f.attackWindup, targetId: f.targetId, animationPresentation: f.animationPresentation })) });
        if (!snapshot?.running || snapshot?.over) break; await normalTacticalInput(page, record); await page.waitForTimeout(350);
      }
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); const observed = await page.evaluate(() => { const a = window.__V100_BOUNDARY_GATE__; return { draws: a.draws, totalDraws: a.totalDraws, oldSourceDraws: a.oldSourceDraws, firstByState: a.firstByState, stateTransitions: a.stateTransitions, contractErrors: a.contractErrors, entryObservationCount: a.entryObservationCount, entryViolationCount: a.entryViolationCount, captureStates: Object.keys(a.captures), captures: Object.fromEntries(Object.entries(a.captures).map(([state, canvas]) => [state, canvas.toDataURL("image/png")])), entries: a.entryObservations }; });
      const capturePngs = {}; for (const [state, dataUrl] of Object.entries(observed.captures)) { const capturePath = path.join(output, `${viewport.width}x${viewport.height}-state${state}.png`); await writeFile(capturePath, Buffer.from(dataUrl.split(",")[1], "base64")); capturePngs[state] = capturePath; }
      item.inputs = record.inputs; item.samples = item.samples.slice(-128); item.draws = observed.draws; item.totalDraws = observed.totalDraws; item.gateStates = observed.firstByState; item.captureStates = observed.captureStates; item.capturePngs = capturePngs; item.entries = observed.entries; item.entryObservationCount = observed.entryObservationCount; item.entryViolationCount = observed.entryViolationCount; item.sourceColumnsObserved = Object.values(observed.firstByState).map(draw => draw.sourceRect[0]); item.destinationGeometry = Object.fromEntries(Object.entries(observed.firstByState).map(([state, draw]) => [state, { sourceRect: draw.sourceRect, destination: draw.destination, transform: draw.transform, geometry: draw.geometry }])); item.stateSequence = observed.stateTransitions; item.oldStationRelayDraws = observed.oldSourceDraws; item.contractErrors = observed.contractErrors; item.sameIdEntryReady = Object.values(observed.entries).some(value => value.firstEntry && value.firstReady);
      const entryReady = Object.values(item.entries).find(value => value.firstEntry && value.firstReady); const viewportId = viewport.width === 1280 ? STAGE_VIEWPORT_IDS.STANDARD : viewport.height === 390 ? STAGE_VIEWPORT_IDS.MOBILE_844_390 : STAGE_VIEWPORT_IDS.MOBILE_844_340; const worldWidth = battleSpaceFor(stageId, viewportId).world.width; assert.deepEqual(item.sourceColumnsObserved.sort((a, b) => a - b), columns.slice(0, 4)); assert.equal(item.captureStates.length, 4); assert.deepEqual(item.stateSequence, [0, 1, 2, 3]); assert.equal(item.oldStationRelayDraws, 0); assert.ok(item.entryObservationCount > 0); assert.equal(item.entryViolationCount, 0); assert.deepEqual(item.contractErrors, []); assert.equal(item.sameIdEntryReady, true); assert.ok(entryReady?.firstEntry && entryReady.firstEntry.x > worldWidth, "same-ID entry must begin beyond the right world edge"); assert.equal(typeof entryReady.firstEntry.attack, "number"); assert.equal(typeof entryReady.firstEntry.attackWindup, "number"); assert.equal(typeof entryReady.firstEntry.abilityWindup, "number"); assert.equal(typeof entryReady.firstEntry.targetable, "boolean"); assert.equal(typeof entryReady.firstEntry.spawnEntryMode, "string"); assert.equal(typeof entryReady.firstEntry.combatReadyX, "number"); assert.equal(entryReady.firstEntry.attack, 0); assert.equal(entryReady.firstEntry.attackWindup, 0); assert.equal(entryReady.firstEntry.abilityWindup, 0); assert.equal(entryReady.firstEntry.targetId, null); assert.equal(entryReady.firstEntry.combatReady, false); assert.equal(isCombatTargetable(entryReady.firstEntry), false); assert.equal(entryReady.firstEntry.spawnEntryMode, "right-edge-outside"); assert.equal(typeof entryReady.firstEntry.clip, "string"); assert.equal(entryReady.firstReady.gateEntering, false); assert.ok(entryReady.firstReady.x <= entryReady.firstReady.combatReadyX); for (const value of Object.values(item.entries)) for (const sample of value.samples) { assert.equal(sample.attack, 0); assert.equal(sample.attackWindup, 0); assert.equal(sample.abilityWindup, 0); assert.equal(sample.targetId, null); assert.equal(sample.combatReady, false); assert.equal(isCombatTargetable(sample), false); } assert.deepEqual(item.errors, []); item.status = "passed";
    } catch (error) { item.status = "failed"; item.error = String(error.stack ?? error); await page.screenshot({ path: `${output}/${viewport.width}x${viewport.height}-failure.png` }).catch(() => {}); }
    finally { await context.close(); await browser.close(); await writeFile(`${output}/report.partial.json`, `${JSON.stringify(report, null, 2)}\n`); }
  }
  assert.ok(report.cases.every(item => item.status === "passed"), "one or more boundary gate viewport cases failed"); report.status = "passed";
} catch (error) { report.status = "failed"; report.error = String(error.stack ?? error); process.exitCode = 1; }
finally { await writeFile(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`); console.log(JSON.stringify({ status: report.status, cases: report.cases.length })); }
