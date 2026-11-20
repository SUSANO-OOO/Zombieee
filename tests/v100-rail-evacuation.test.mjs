import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { requiredBattleAssetPlan } from "../app/battleAssetPlan.js";
import { battleOutcomeFor, objectiveForBattle } from "../app/battleDefinitions.js";
import { advanceStationMissionRuntime, createStationMissionRuntime, currentPowerNode } from "../app/stationStageMechanics.js";
import { stationSpatialSnapshot } from "../app/stationSpatialMechanics.js";
import { v100BattleDefinitionFor, V100_ENEMY_PACKS } from "../app/v100BattleAdapter.js";
import { v100BattleReportFor, v100DeviceResultText } from "../app/v100BattleReport.js";
import { v100MissionBriefingFor } from "../app/v100MissionBriefing.js";
import { drawV100RailEvacuation, railEvacuationReadout, V100_RAIL_EVACUATION_ART, V100_RAIL_EVACUATION_STAGE } from "../app/v100RailEvacuation.js";
import { V100_BOSS_BY_ID, V100_STAGE_IDS } from "../app/v100Registry.js";

const stageId = V100_RAIL_EVACUATION_STAGE;
const definition = v100BattleDefinitionFor(stageId);
const { missionType, missionConfig: config } = definition;
const initialRuntime = () => createStationMissionRuntime(missionType, config);

test("the freight-yard script, fight, and offline art agree on the evacuation", () => {
  assert.equal(stageId, V100_STAGE_IDS[13]);
  assert.deepEqual(V100_STAGE_IDS.filter(id => v100BattleDefinitionFor(id).missionConfig.railEvacuation), [stageId]);
  assert.match(definition.objective, /レバーを3つ引いて民間車両を逃がし、オオグチを倒す/u);
  assert.equal(v100MissionBriefingFor(stageId).count, 3);
  assert.equal(definition.enemyBaseMode, "scenery");
  assert.equal(definition.bossUnlocksEnemyBase, false);
  assert.equal(definition.timeline.length, 4);
  assert.ok(definition.timeline.slice(1).every(group => group.clearDelaySeconds > 0));
  assert.deepEqual(new Set(definition.timeline.slice(0, 3).flatMap(group => group.units)), new Set(V100_ENEMY_PACKS.C));
  assert.deepEqual(definition.timeline.at(-1).units, ["ooguchi"]);
  assert.equal(definition.timeline.at(-1).waitForPriorWaveClear, true);
  assert.equal(V100_BOSS_BY_ID["boss-ooguchi"].hp, 3400);
  const plan = requiredBattleAssetPlan({ stageId });
  assert.ok(plan.paths.includes(V100_RAIL_EVACUATION_ART.path));
  const manifest = JSON.parse(readFileSync("public/asset-manifest.json", "utf8"));
  assert.ok(manifest.assets.some(asset => asset.path === V100_RAIL_EVACUATION_ART.path && asset.criticality === "critical"));
  assert.ok(plan.stageObjects.some(asset => asset.id === V100_RAIL_EVACUATION_ART.id && !asset.optional));
  assert.ok(!plan.stageObjects.some(asset => asset.id.startsWith("v100-assault-")));
  assert.ok(!requiredBattleAssetPlan({ stageId: V100_STAGE_IDS[12] }).paths.includes(V100_RAIL_EVACUATION_ART.path));
});

test("attended levers release in order and rescue, boss and surviving vehicle independently gate the win", () => {
  let runtime = initialRuntime(), time = 0;
  const laneCenters = [208, 268, 328];
  const fighterAt = node => ({ id: 1, side: "human", x: node.x, y: laneCenters[node.lane], hp: 100, combatReady: true });
  const state = { baseHp: 500, baseMaxHp: 680, barricadeHp: 0, bossDefeated: true, wavesResolved: true };
  const step = (seconds, fighters = []) => {
    time += seconds;
    const spatial = stationSpatialSnapshot({ missionType, missionRuntime: runtime, config, laneCenters, fighters });
    runtime = advanceStationMissionRuntime({ missionType, config, runtime, battleElapsedSeconds: time, seconds,
      baseHp: state.baseHp, ...spatial });
  };
  const now = () => ({ ...state, stageMission: runtime });
  const outcome = overrides => battleOutcomeFor(definition, { ...now(), ...overrides });

  const first = currentPowerNode(runtime, config);
  const ally = fighterAt(first);
  const enemy = { ...ally, id: 2, side: "zombie" };
  assert.match(objectiveForBattle(definition, now()), /レバー1まで味方を送る/u);
  step(3, [{ ...ally, x: config.powerXs[1] }]);
  step(3, [{ ...ally, gateEntering: true }]);
  step(3, [{ ...ally, stunned: 1 }]);
  assert.equal(runtime.powerHold, 0);
  step(1, [ally]);
  assert.match(objectiveForBattle(definition, now()), /レバー1を操作中/u);
  step(1, [ally, enemy]);
  assert.equal(runtime.powerHold, .5);
  assert.match(objectiveForBattle(definition, now()), /周囲の敵を倒す/u);
  for (let index = 0; index < 3; index++) {
    const node = currentPowerNode(runtime, config);
    assert.equal(node.number, index + 1);
    step(config.powerHoldSeconds, [fighterAt(node)]);
    assert.equal(runtime.powerActivated, index + 1);
    assert.equal(runtime.evacuationProgress, 0);
    assert.equal(outcome(), null);
  }
  assert.equal(currentPowerNode(runtime, config), null);
  assert.match(objectiveForBattle(definition, now()), /民間車両が退避中/u);
  step(config.evacuationSeconds * .5);
  assert.equal(runtime.evacuationProgress, .5);
  assert.equal(runtime.completed, false);
  assert.equal(outcome(), null);
  step(config.evacuationSeconds * .5);
  assert.equal(runtime.evacuationProgress, 1);
  assert.equal(runtime.completed, true);
  assert.equal(runtime.transitions.at(-1), "civilian-car-evacuated");
  const finished = runtime;
  step(20);
  assert.equal(runtime, finished);
  assert.equal(outcome({ wavesResolved: false }), null);
  assert.equal(outcome({ bossDefeated: false }), null);
  assert.equal(outcome({ bossDefeatPending: true }), null);
  assert.equal(outcome({ baseHp: 0 }), "lost");
  assert.equal(outcome({ barricadeHp: 350 }), "won");
});

test("the draw moves the actual passenger car before removing it and rotates only operated handles", () => {
  const draw = mission => {
    const draws = [], turns = [], labels = [];
    const context = {
      save() {}, restore() {}, translate() {}, strokeText() {},
      drawImage(...values) { draws.push(values.slice(1)); },
      rotate(value) { turns.push(value); },
      fillText(label) { labels.push(label); },
    };
    drawV100RailEvacuation(context, mission, { [V100_RAIL_EVACUATION_ART.id]: { complete: true, naturalWidth: 680 } }, y => y, 175);
    return { draws, turns, labels };
  };
  const before = draw(initialRuntime());
  const midway = draw({ powerActivated: 3, evacuationProgress: .5 });
  const after = draw({ powerActivated: 3, evacuationProgress: 1, completed: true });
  assert.equal(before.draws.length, 7);
  assert.ok(midway.draws[0][4] < before.draws[0][4]);
  assert.ok(midway.turns[0] > before.turns[0]);
  assert.equal(after.draws.length, 6);
  assert.deepEqual(after.labels, ["1 解除済", "2 解除済", "3 解除済"]);
  assert.equal(railEvacuationReadout(initialRuntime()).status, "0/3 解除");
  assert.equal(railEvacuationReadout({ powerActivated: 3, evacuationProgress: .5 }).progress, .5);
  assert.equal(railEvacuationReadout({ powerActivated: 3, completed: true }).status, "退避済み");
});

test("current-fight receipts differentiate lever count from a completed departure", () => {
  const reportFor = missionRuntime => v100BattleReportFor({
    stageId, wave: 4, kills: 14, missionRuntime,
    unitStats: { damageByUnit: {}, damageTakenByUnit: {}, healingByUnit: {} },
  });
  const result = (...args) => v100DeviceResultText({ stageId, won: false, battleReport: reportFor(...args) });
  assert.equal(result({ ...initialRuntime(), powerActivated: 2 }).progress, "連結器 2/3 解除");
  assert.equal(result({ ...initialRuntime(), powerActivated: 3 }).progress, "連結器 3/3 解除");
  assert.equal(result({ ...initialRuntime(), powerActivated: 3, completed: true }).progress, "民間車両 退避完了");
  assert.equal(result({ ...initialRuntime(), powerActivated: 2, completed: true }), null);
});
