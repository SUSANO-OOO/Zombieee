import test from "node:test";
import assert from "node:assert/strict";
import { battleOutcomeFor, objectiveForBattle } from "../app/battleDefinitions.js";
import { requiredBattleAssetPlan } from "../app/battleAssetPlan.js";
import { advanceStationMissionRuntime, createStationMissionRuntime, currentPowerNode, stationPowerNodes } from "../app/stationStageMechanics.js";
import { stationSpatialSnapshot } from "../app/stationSpatialMechanics.js";
import { v100BasePresentationFor, V100_RETREAT_DOOR_ART } from "../app/v100BasePresentation.js";
import { v100BattleDefinitionFor, V100_ENEMY_PACKS } from "../app/v100BattleAdapter.js";
import { v100BattleReportFor, v100DeviceResultText } from "../app/v100BattleReport.js";
import { drawV100MissionNode, v100NodeFrame, V100_NODE_ART } from "../app/v100MissionNodes.js";
import { v100MissionBriefingFor } from "../app/v100MissionBriefing.js";
import { rescueControlReadout, V100_RESCUE_CONTROL_STAGE } from "../app/v100RescueControl.js";
import { V100_STAGE_IDS } from "../app/v100Registry.js";
import { campaignWaveReady, campaignWavePrompt, requestCampaignWave } from "../app/wavePacing.js";

const stageId = V100_RESCUE_CONTROL_STAGE;
const definition = v100BattleDefinitionFor(stageId);
const { missionType, missionConfig: config } = definition;

test("the authored control-room mission has three repairable panels and a surviving control room", () => {
  assert.equal(stageId, V100_STAGE_IDS[14]);
  assert.deepEqual(V100_STAGE_IDS.filter(id => v100BattleDefinitionFor(id).missionConfig.rescueControl), [stageId]);
  assert.equal(definition.objective, "救難回線を3か所復旧し、制御区を守る");
  assert.equal(definition.enemyBaseMode, "scenery");
  assert.equal(v100MissionBriefingFor(stageId).verb, "復旧して制御区を守る");
  assert.equal(v100BasePresentationFor(15).healthLabel, "制御区耐久");
  const plan = requiredBattleAssetPlan({ stageId, basePresentationStageNumber: 15 });
  assert.ok(plan.paths.includes(V100_NODE_ART));
  assert.ok(plan.persistent.some(asset => asset.key === "retreatDoor" && asset.path === V100_RETREAT_DOOR_ART));
  const nodes = stationPowerNodes(config);
  assert.equal(nodes.length, 3);
  assert.ok(nodes.every(node => node.x < config.securityX));
  assert.deepEqual(new Set(definition.timeline.flatMap(wave => wave.units)), new Set(V100_ENEMY_PACKS.C));
  assert.equal(definition.timeline.length, 4);
  assert.equal(definition.timeline[2].requiredPowerCount, 3);
  assert.ok(definition.timeline.slice(1).every(wave => wave.clearDelaySeconds > 0));
});

test("the defensive push waits for all three panels and cannot be requested early", () => {
  const mission = definition.timeline[2];
  const game = { definition, time: mission.at + 20, eventIndex: 2, enemySpawn: { pending: [] },
    fighters: [], corpses: [], stageMission: { powerActivated: 2 }, bannerTime: 0 };
  assert.equal(campaignWaveReady(game, mission), false);
  assert.equal(campaignWavePrompt(game), null);
  assert.equal(requestCampaignWave(game), false);
  game.stageMission.powerActivated = 3;
  assert.equal(campaignWaveReady(game, mission), false);
  game.time += mission.clearDelaySeconds;
  assert.equal(campaignWaveReady(game, mission), true);
  game.enemySpawn.pending.push({ kind: "sprinter" });
  assert.equal(campaignWaveReady(game, mission), false);
});

test("guarded restoration, cleared defending waves and control-room survival decide victory without a return phase", () => {
  let runtime = createStationMissionRuntime(missionType, config), time = 0;
  const centers = [208, 268, 328];
  const ally = node => ({ id: 1, side: "human", hp: 100, combatReady: true, x: node.x, y: centers[node.lane] });
  const step = (seconds, fighters, { resolved = false, baseHp = 840 } = {}) => {
    time += seconds;
    const spatial = stationSpatialSnapshot({ missionType, missionRuntime: runtime, config, laneCenters: centers, fighters });
    runtime = advanceStationMissionRuntime({
      ...spatial, runtime, missionType, config, seconds, battleElapsedSeconds: time, wavesResolved: resolved, baseHp,
    });
  };
  const state = () => ({ stageMission: runtime, baseHp: 840, baseMaxHp: 840, wavesResolved: runtime.completed });
  const first = currentPowerNode(runtime, config);
  const member = ally(first);
  step(4, [{ ...member, x: config.securityX }]);
  step(4, [{ ...member, stunned: 1 }]);
  step(4, [{ ...member, gateEntering: true }]);
  assert.equal(runtime.powerHold, 0);
  step(1, [member]);
  assert.match(objectiveForBattle(definition, state()), /復旧中/u);
  step(1, [member, { ...member, id: 2, side: "zombie" }]);
  assert.equal(runtime.powerHold, .5);
  assert.match(objectiveForBattle(definition, state()), /周囲の敵を倒す/u);
  for (let i = 1; i <= 3; i++) {
    step(config.powerHoldSeconds, [ally(currentPowerNode(runtime, config))]);
    assert.equal(runtime.powerActivated, i);
    assert.equal(runtime.completed, false);
    assert.equal(battleOutcomeFor(definition, state()), null);
  }
  assert.equal(currentPowerNode(runtime, config), null);
  assert.equal(rescueControlReadout(runtime).phase, "defending");
  assert.equal(objectiveForBattle(definition, state()), "回線復旧済み。制御区を守る");
  assert.equal(runtime.escapeRemaining, undefined);
  step(1, [member], { resolved: true });
  assert.equal(runtime.completed, true);
  assert.deepEqual(runtime.transitions, ["power-1-activated", "power-2-activated", "power-3-activated", "rescue-control-secured"]);
  assert.equal(battleOutcomeFor(definition, state()), "won");
  assert.equal(battleOutcomeFor(definition, { ...state(), baseHp: 0 }), "lost");
  step(1, [], { resolved: true, baseHp: 0 });
  assert.equal(battleOutcomeFor(definition, state()), "lost");
});

test("the energized security panel is physically distinct and the report keeps actual repair counts", () => {
  const runtime = createStationMissionRuntime(missionType, config);
  const labels = [], crops = [];
  const context = new Proxy({
    drawImage(_image, x) { crops.push(x); },
    fillText(label) { labels.push(label); },
  }, { get(target, key) { return target[key] ?? (() => {}); } });
  const objects = { "v100-mission-node-states": { complete: true, naturalWidth: 1983 } };
  const game = { definition, stageMission: runtime, time: definition.prepSeconds };
  for (let i = 0; i <= config.powerCount; i++) drawV100MissionNode(context, game, objects, i, 400, 250);
  assert.deepEqual(labels, ["制御盤1", "制御盤2", "制御盤3", "警備用・操作不可"]);
  const off = v100NodeFrame("cabinet", "off").x, on = v100NodeFrame("cabinet", "on").x;
  assert.deepEqual(crops, [off, off, off, on]);

  const raw = { stageId, wave: 3, kills: 9,
    unitStats: { damageByUnit: {}, damageTakenByUnit: {}, healingByUnit: {} } };
  const result = powerActivated => v100DeviceResultText({ stageId, won: false,
    battleReport: v100BattleReportFor({ ...raw, missionRuntime: { ...runtime, powerActivated } }),
  });
  assert.equal(result(1).progress, "救難回線 1/3 復旧");
  assert.equal(result(3).detail, '救難回線はすべて復旧した。');
  assert.equal(result(4), null);
});
