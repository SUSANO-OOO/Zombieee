import test from "node:test";
import assert from "node:assert/strict";
import { v100BattleDefinitionFor } from "../app/v100BattleAdapter.js";
import { v100MissionBriefingFor } from "../app/v100MissionBriefing.js";
import { objectiveForBattle, battleOutcomeFor } from "../app/battleDefinitions.js";
import { createStationMissionRuntime } from "../app/stationStageMechanics.js";
import { advanceEstuaryFloodgate, beginEstuaryFloodgateClosure, drawEstuaryFloodgate,
  floodgateClosureProgress, floodgateIngressDisposition, FLOODGATE_CLOSE_SECONDS,
  hasEstuaryFloodgate, V100_FLOODGATE_STAGE } from "../app/v100EstuaryFloodgate.js";

const definition = v100BattleDefinitionFor(V100_FLOODGATE_STAGE);
const initial = () => createStationMissionRuntime(definition.missionType, definition.missionConfig);
const outcome = (stageMission, extra = {}) => battleOutcomeFor(definition, {
  stageMission, bossDefeated: true, wavesResolved: true, baseHp: 840, ...extra,
});

test("campaign Stage 20 ends at the floodgate, with the real Gairen defeat and resolved enemies", () => {
  assert.equal(definition.enemyBaseMode, "scenery");
  assert.equal(definition.bossUnlocksEnemyBase, false);
  assert.equal(definition.bossEnemyKind, "gairen");
  assert.equal(v100MissionBriefingFor(definition.stageId).target, "防潮門");
  const locked = initial();
  assert.equal(beginEstuaryFloodgateClosure(locked, false), locked);
  assert.strictEqual(advanceEstuaryFloodgate(locked, 20, false), locked);
  assert.match(objectiveForBattle(definition, { stageMission: locked, bossDefeated: true }), /閉鎖盤/);
  assert.equal(outcome(locked, { barricadeHp: 0, barricadeVulnerable: true }), null);
  const moving = beginEstuaryFloodgateClosure(locked, true);
  assert.equal(beginEstuaryFloodgateClosure(moving, true), moving);
  const lowered = advanceEstuaryFloodgate(moving, FLOODGATE_CLOSE_SECONDS, true);
  assert.equal(floodgateClosureProgress(lowered), 1);
  assert.equal(outcome(lowered), null);
  const sealed = advanceEstuaryFloodgate(lowered, .851, true);
  assert.equal(outcome(sealed, { wavesResolved: false }), null);
  assert.equal(outcome(sealed, { bossDefeatPending: true }), null);
  assert.equal(outcome(sealed, { bossDefeated: false }), null);
  assert.equal(outcome(sealed, { baseHp: 0 }), "lost");
  assert.equal(outcome(sealed), "won");
  assert.equal(hasEstuaryFloodgate("boss-assault", {}), false);
});

test("delaying closure admits one final group, while tapping the control stops it before it enters", () => {
  const waiting = initial();
  assert.equal(floodgateIngressDisposition(waiting), "hold");
  assert.equal(floodgateIngressDisposition(advanceEstuaryFloodgate(waiting, 8.99, true)), "hold");
  const late = advanceEstuaryFloodgate(waiting, 9, true);
  assert.equal(floodgateIngressDisposition(late), "enter");
  assert.equal(floodgateIngressDisposition(beginEstuaryFloodgateClosure(late, true)), "blocked");
  assert.equal(definition.timeline.filter(wave => wave.requiresOpenFloodgate).length, 1);
  assert.ok(definition.timeline.at(-1).requiresOpenFloodgate);
  assert.ok(definition.timeline.at(-1).units.length > 0);
});

test("the two shutters descend into their existing painted apertures and reuse the same offline plate", () => {
  const source = { complete: true, naturalWidth: 1600, naturalHeight: 900 };
  const calls = [];
  const ctx = { drawImage: (...args) => calls.push(args) };
  drawEstuaryFloodgate(ctx, source, 0, 960, 540);
  assert.equal(calls.length, 0);
  drawEstuaryFloodgate(ctx, source, .5, 960, 540);
  drawEstuaryFloodgate(ctx, source, 1, 960, 540);
  assert.equal(calls.length, 4);
  for (let i = 0; i < 2; i++) {
    assert.equal(calls[i][0], source);
    assert.equal(calls[i][5], calls[i + 2][5]);
    assert.equal(calls[i][6], calls[i + 2][6]);
    assert.equal(calls[i][8] * 2, calls[i + 2][8]);
    assert.ok(calls[i][2] > calls[i + 2][2]);
  }
});
