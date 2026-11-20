import test from "node:test";
import assert from "node:assert/strict";
import { battleOutcomeFor, objectiveForBattle } from "../app/battleDefinitions.js";
import { requiredBattleAssetPlan } from "../app/battleAssetPlan.js";
import { advanceStationMissionRuntime, createStationMissionRuntime, escortCartX } from "../app/stationStageMechanics.js";
import { stationSpatialSnapshot } from "../app/stationSpatialMechanics.js";
import { v100BattleDefinitionFor } from "../app/v100BattleAdapter.js";
import { normalizeV100BattleReport, v100BattleReportFor, v100EscortResultText } from "../app/v100BattleReport.js";
import { BRIDGE_GATE_SECONDS, BRIDGE_HOLD_PROGRESS, BRIDGE_HOLD_X, BRIDGE_SHOT_FLASH,
  V100_BRIDGE_ART, V100_BRIDGE_STAGE, bridgeEscortReadout, openBridgeGate } from "../app/v100BridgeEscort.js";
import { drawBridgeEscort } from "../app/v100BridgeEscortRender.js";

const definition = v100BattleDefinitionFor(V100_BRIDGE_STAGE);
const config = definition.missionConfig;
const initial = () => createStationMissionRuntime("escort", config);
const tick = (runtime, seconds, condition = {}) => advanceStationMissionRuntime({
  runtime, config, seconds, baseHp: 840, escortCount: 2, bridgeCovered: true, bridgeApproachSecured: true, ...condition,
});
const hold = () => tick(initial(), 90);
const outcome = (stageMission, wavesResolved = true) => battleOutcomeFor(definition, { stageMission, baseHp: 840, wavesResolved });

test("the escort can reach the lowered bar, but only actual front cover allows opening it", () => {
  const unprotected = tick(initial(), 90, { bridgeCovered: false });
  assert.equal(unprotected.progress, BRIDGE_HOLD_PROGRESS);
  assert.equal(escortCartX(unprotected, config), BRIDGE_HOLD_X);
  assert.equal(unprotected.bridge.gateReady, false);
  assert.equal(openBridgeGate(unprotected), unprotected);
  assert.equal(outcome(unprotected), null);
  assert.ok(definition.timeline.slice(0, -1).every(wave => (wave.escortProgress ?? 0) < BRIDGE_HOLD_PROGRESS));
  assert.equal(definition.timeline.at(-1).escortProgress, 1);
  assert.ok(definition.timeline.slice(2).every(wave => wave.waitForPriorWaveClear));
  const enemy = { side: "zombie", hp: 200, x: BRIDGE_HOLD_X + 30, y: 282 };
  const ally = { side: "human", hp: 80, combatReady: true, x: BRIDGE_HOLD_X - 10, y: 282 };
  const spatial = (...fighters) => stationSpatialSnapshot({
    missionType: "escort", missionRuntime: unprotected, config, fighters, laneCenters: [212,282,352],
  });
  assert.equal(spatial(ally).bridgeCovered, false);
  assert.equal(spatial(ally, { ...ally, x: BRIDGE_HOLD_X + 55, gateEntering: true }).bridgeCovered, false);
  assert.equal(spatial(ally, { ...ally, x: BRIDGE_HOLD_X + 55, stunned: 1 }).bridgeCovered, false);
  assert.equal(spatial(ally, { ...ally, x: BRIDGE_HOLD_X + 55, y: 212 }).bridgeCovered, true);
  assert.equal(spatial(ally, { ...enemy, y: 322 }).nearbyThreats, 0);
  assert.equal(spatial(ally, enemy).nearbyThreats, 1);
  assert.equal(tick(unprotected, .1, { nearbyThreats: 1 }).bridge.gateReady, false);
  const convoyGuard = { ...ally, x: BRIDGE_HOLD_X + 27, y: 313 };
  const farBlocker = { side: "zombie", hp: 200, x: 805, y: 272 };
  const approach = (eventIndex, pendingSpawnCount, ...units) => stationSpatialSnapshot({
    missionType: "escort", missionRuntime: unprotected, config, fighters: [ally, convoyGuard, ...units],
    laneCenters: [250,292,334], eventIndex, timelineLength: 6, pendingSpawnCount,
  });
  assert.equal(approach(3, 0).bridgeApproachSecured, false);
  assert.equal(approach(5, 1).bridgeApproachSecured, false);
  const trial = approach(5, 0, farBlocker);
  assert.equal(trial.nearbyThreats, 0);
  assert.equal(trial.bridgeApproachSecured, false);
  assert.equal(tick(unprotected, .1, trial).bridge.gateReady, false);
  const ready = tick(unprotected, .1, approach(5, 0));
  assert.equal(ready.bridge.gateReady, true);
  assert.equal(bridgeEscortReadout(ready).phase, "ready");
});

test("seven seconds pass once, with the return to a closed bar and the remaining waves governing victory", () => {
  const ready = hold();
  const opened = openBridgeGate(ready);
  assert.equal(openBridgeGate(opened), opened);
  assert.equal(bridgeEscortReadout(opened).remaining, 7);
  const moving = tick(opened, 1, { bridgeCovered: false, escortCount: 0 });
  assert.equal(moving.stalled, false);
  assert.ok(moving.progress > BRIDGE_HOLD_PROGRESS, "losing the side escort does not brake an accelerating truck");
  const crosses = tick(moving, 4.4);
  assert.equal(crosses.progress, 1);
  assert.equal(crosses.completed, false);
  assert.equal(bridgeEscortReadout(crosses).remaining, 2);
  assert.equal(outcome(crosses), null);
  const end = tick(crosses, 1.6);
  assert.equal(end.bridge.gateElapsed, BRIDGE_GATE_SECONDS);
  assert.equal(end.completed, true);
  assert.equal(outcome(end, false), null);
  assert.equal(outcome(end), "won");
  assert.match(objectiveForBattle(definition, { stageMission: end }), /対岸に到着/);
  assert.equal(openBridgeGate(end), end);
});

test("an unguarded convoy receives a warned shot and missing the opening gives a usable retry explanation", () => {
  let exposed = { ...hold(), integrity: 250 };
  exposed = tick(exposed, 3.7, { bridgeCovered: false });
  assert.equal(bridgeEscortReadout(exposed).phase, "aim");
  assert.equal(exposed.integrity, 250);
  const fired = tick(exposed, 1.3, { bridgeCovered: false });
  assert.equal(fired.bridge.shotFlash, BRIDGE_SHOT_FLASH);
  assert.equal(fired.integrity, 216);
  assert.equal(tick(exposed, 1.3).integrity, 250);
  const opened = openBridgeGate(hold());
  const late = tick(opened, BRIDGE_GATE_SECONDS, { nearbyThreats: 1 });
  assert.equal(late.gateTimedOut, true);
  assert.equal(outcome(late), "lost");
  const report = v100BattleReportFor({ stageId: V100_BRIDGE_STAGE, wave: 6, kills: 25,
    unitStats: { damageByUnit: {}, damageTakenByUnit: {}, healingByUnit: {} }, missionRuntime: late });
  assert.equal(report.escortProgress.gateTimedOut, true);
  assert.deepEqual(normalizeV100BattleReport(report), report);
  assert.match(v100EscortResultText({ stageId: V100_BRIDGE_STAGE, won: false, battleReport: report }).outcome, /取り残された/);
});

test("only the campaign bridge decodes its painted enemy and bar, which rotates during the release", () => {
  const stage = requiredBattleAssetPlan({ stageId: V100_BRIDGE_STAGE });
  assert.ok(stage.paths.includes(V100_BRIDGE_ART.path));
  assert.ok(!requiredBattleAssetPlan({ stageId: V100_BRIDGE_STAGE, operationId: "outbreak-gairen-breaker-deck" }).paths.includes(V100_BRIDGE_ART.path));
  const image = { complete: true, naturalWidth: 1536 };
  const draws = [];
  const angles = [];
  const ctx = { save() {}, restore() {}, translate() {}, rotate(value) { angles.push(value); }, drawImage(...args) { draws.push(args); } };
  const before = hold();
  const after = tick(openBridgeGate(before), 1.3);
  drawBridgeEscort(ctx, { [V100_BRIDGE_ART.id]: image }, before, BRIDGE_HOLD_X, 282, 212);
  drawBridgeEscort(ctx, { [V100_BRIDGE_ART.id]: image }, after, escortCartX(after, config), 282, 212);
  assert.equal(draws.length, 6);
  assert.equal(Math.abs(angles[0]), 0);
  assert.ok(angles[1] < -1.4);
  assert.notEqual(draws[0][5], draws[3][5]);
});
