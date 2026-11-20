import assert from "node:assert/strict";
import test from "node:test";
import { requiredBattleAssetPlan } from "../app/battleAssetPlan.js";
import { battleOutcomeFor, objectiveForBattle } from "../app/battleDefinitions.js";
import { advanceStationMissionRuntime, createStationMissionRuntime, currentPowerNode } from "../app/stationStageMechanics.js";
import { stationSpatialSnapshot } from "../app/stationSpatialMechanics.js";
import { v100BattleDefinitionFor } from "../app/v100BattleAdapter.js";
import { v100BattleReportFor, v100DeviceResultText } from "../app/v100BattleReport.js";
import { v100MissionBriefingFor } from "../app/v100MissionBriefing.js";
import { V100_NODE_ART, V100_SUPPLY_VALVE_STAGE } from "../app/v100MissionNodes.js";
import { V100_STAGE_IDS } from "../app/v100Registry.js";
import { campaignWaveReady } from "../app/wavePacing.js";

const stageId = V100_SUPPLY_VALVE_STAGE;
const definition = v100BattleDefinitionFor(stageId);
const { missionType, missionConfig: config } = definition;
const createRuntime = () => createStationMissionRuntime(missionType, config);

test("the waiting room's supply valve is active and preloaded only for its own stage", () => {
  assert.equal(stageId, V100_STAGE_IDS[10]);
  const withValve = V100_STAGE_IDS.filter(id => v100BattleDefinitionFor(id).missionConfig.supplyValve);
  assert.deepEqual(withValve, [stageId]);
  assert.deepEqual(v100MissionBriefingFor(stageId), {
    mode: "advance", origin: "供給弁", target: "待機室", verb: "供給管を復旧",
  });
  const plan = requiredBattleAssetPlan({ stageId });
  assert.ok(plan.paths.includes(V100_NODE_ART));
  assert.equal(plan.stageObjects.filter(entry => entry.path === V100_NODE_ART).length, 1);
});

test("an active ally can restore an uncontested supply valve; boss, core and vehicle still decide the fight", () => {
  let runtime = createRuntime(), time = 0;
  const initial = runtime;
  const laneCenters = [208, 260, 312];
  const node = currentPowerNode(runtime, config);
  const ally = { id: 1, side: "human", hp: 100, combatReady: true, x: node.x, y: laneCenters[node.lane] };
  const enemy = { ...ally, id: 2, side: "zombie" };
  const state = {
    baseHp: 680, baseMaxHp: 680, barricadeHp: 0, barricadeVulnerable: true, bossDefeated: true,
  };
  const step = (seconds, fighters, baseHp = state.baseHp) => {
    time += seconds;
    const spatial = stationSpatialSnapshot({ missionType, missionRuntime: runtime, config, laneCenters, fighters });
    runtime = advanceStationMissionRuntime({ missionType, config, runtime, battleElapsedSeconds: time, seconds, baseHp, ...spatial });
  };
  const outcome = (overrides = {}) => battleOutcomeFor(definition, { ...state, stageMission: runtime, ...overrides });
  assert.match(objectiveForBattle(definition, { ...state, stageMission: runtime }), /味方を送る/u);
  assert.equal(outcome(), null);
  step(3, [{ ...ally, stunned: 1 }]);
  assert.equal(runtime.powerHold, 0);
  step(1.5, [ally]);
  assert.match(objectiveForBattle(definition, { ...state, stageMission: runtime }), /50%/u);
  step(1, [ally, enemy]);
  assert.equal(runtime.powerHold, 1);
  assert.match(objectiveForBattle(definition, { ...state, stageMission: runtime }), /迫る敵/u);
  step(2, [ally], 0);
  assert.equal(runtime.powerActivated, 0);
  assert.equal(outcome({ baseHp: 0 }), "lost");
  runtime = initial;
  step(3, [ally]);
  assert.equal(runtime.powerActivated, 1);
  assert.deepEqual(runtime.transitions, ["power-1-activated"]);
  assert.equal(runtime.completed, false);
  assert.equal(outcome({ bossDefeated: false }), null);
  assert.equal(outcome({ barricadeHp: 100 }), null);
  assert.equal(outcome(), "won");
});

test("the defeat readout reports only the supply progress measured in the current fight", () => {
  const raw = { stageId, wave: 3, kills: 7, unitStats: { damageByUnit: {}, damageTakenByUnit: {}, healingByUnit: {} } };
  const readout = missionRuntime => v100DeviceResultText({ stageId, won: false, battleReport: v100BattleReportFor({ ...raw, missionRuntime }) });
  assert.equal(readout(), null);
  assert.equal(readout({ missionType: "sequential-seal", powerActivated: 1 }), null);
  assert.equal(readout({ missionType, powerActivated: 2 }), null);
  assert.equal(readout(createRuntime()).progress, "供給管 未復旧");
  assert.equal(readout({ ...createRuntime(), powerActivated: 1 }).progress, "供給管 復旧済み");
});

test("MOTHER approach groups wait for the last enemy and still retain the original boss entrance", () => {
  const opening = definition.timeline[0];
  const boss = definition.timeline.at(-1);
  assert.equal(opening.clearDelaySeconds, undefined);
  assert.ok(definition.timeline.slice(1, -1).every(group => group.clearDelaySeconds === 2.5));
  assert.equal(boss.waitForPriorWaveClear, true);
  assert.equal(boss.clearDelaySeconds, undefined);
  assert.ok(boss.units.includes("mother"));
  const game = {
    definition, time: definition.timeline[1].at, eventIndex: 1,
    enemySpawn: { pending: [] }, fighters: [{ side: "zombie", hp: 1 }],
  };
  const next = definition.timeline[1];
  assert.equal(campaignWaveReady(game, next), false, "the due group waits for a living enemy");
  game.fighters = [];
  game.enemySpawn.pending.push({ kind: "turned" });
  game.time += 1;
  assert.equal(campaignWaveReady(game, next), false, "the due group waits for a queued enemy");
  game.enemySpawn.pending.length = 0;
  game.time += 1;
  assert.equal(campaignWaveReady(game, next), false);
  game.time += 2.5;
  assert.equal(campaignWaveReady(game, next), true);
});
