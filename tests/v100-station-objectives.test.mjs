import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { V100_STAGES } from "../app/v100Registry.js";
import { v100BattleDefinitionFor } from "../app/v100BattleAdapter.js";
import { advanceStationMissionRuntime as advanceStationMission, createStationMissionRuntime, currentPowerNode, escortCartX, stationMissionObjective, stationMissionOutcome, stationPowerNodes, STATION_MISSION_TYPES } from "../app/stationStageMechanics.js";
import { CAMPAIGN_STAGE_IDS } from "../app/campaign.js";
import { stationSpatialSnapshot } from "../app/stationSpatialMechanics.js";
import { requiredBattleAssetPlan } from "../app/battleAssetPlan.js";
import { drawV100MissionVehicles, V100_MISSION_VEHICLE_ART } from "../app/v100MissionVehicles.js";
import { drawV100MissionNode, V100_NODE_PROFILES, v100NodeState, v100NodeFrame } from "../app/v100MissionNodes.js";
import { drawV100ClinicalControl } from "../app/v100ClinicalControl.js";

test("actual V1 adapter and station runtime complete all power/seal stages without absent legacy entities", () => {
  const stages = V100_STAGES.filter(stage => ["power", "seal"].includes(stage.missionType));
  assert.deepEqual(stages.map(stage => stage.number), [9, 15, 16, 28]);
  for (const stage of stages) {
    const definition = v100BattleDefinitionFor(stage.id), config = definition.missionConfig;
    let runtime = createStationMissionRuntime(definition.missionType, config);
    const human = { id: 1, side: "human", hp: 100, lane: 0, x: 0, y: 0 };
    const advance = (time, eventIndex = definition.timeline.length) => {
      const spatial = stationSpatialSnapshot({ missionType: definition.missionType, missionRuntime: runtime, config,
        fighters: [human], eventIndex, timelineLength: definition.timeline.length, pendingSpawnCount: 0 });
      runtime = advanceStationMission({ missionType: definition.missionType, runtime, config,
        seconds: 6, battleElapsedSeconds: time, baseHp: 680, ...spatial });
    };
    for (let i = 0; i < config.powerCount; i++) {
      const node = currentPowerNode(runtime, config);
      human.x = node.x; human.lane = node.lane; human.y = [286, 366, 446][node.lane];
      advance(node.readyAtSeconds, definition.timeline.length - 1);
      assert.equal(runtime.powerActivated, i + 1);
      assert.equal(runtime.completed, false);
      assert.equal(runtime.sealed, false, "future waves still prevent mission completion");
    }
    assert.doesNotMatch(stationMissionObjective(runtime, config), /改札喰い|研究容器/u);
    advance(200);
    assert.equal(runtime.sealed, true, `Stage ${stage.number} waits for an entity absent from its timeline`);
    assert.equal(runtime.completed, false, "living units still have to return");
    human.x = 205;
    advance(206);
    assert.equal(stationMissionOutcome({ runtime, baseHp: 680 }), "won");
    assert.equal(runtime.gateEaterDefeated, false, "do not fabricate a boss defeat receipt");
    assert.equal(runtime.researchContainerContained, false);
  }
});

test("legacy containment still requires its real boss and research container", () => {
  const type = "sequential-seal";
  let runtime = createStationMissionRuntime(type);
  for (const time of [24, 62, 104]) runtime = advanceStationMission({ missionType: type, runtime, seconds: 6,
    battleElapsedSeconds: time, baseHp: 680, humanCount: 1, powerOperatorCount: 1, wavesResolved: true });
  assert.equal(runtime.powerActivated, 3);
  assert.equal(runtime.sealed, false);
  assert.match(stationMissionObjective(runtime), /改札喰い/u);
  runtime = advanceStationMission({ missionType: type, runtime, seconds: 1, battleElapsedSeconds: 110,
    baseHp: 680, humanCount: 1, gateEaterDefeated: true, wavesResolved: true });
  assert.equal(runtime.sealed, false);
  assert.match(stationMissionObjective(runtime), /研究容器/u);
});

test("V1 escort profiles retain every wave and finish an unobstructed supported route below 150 seconds", () => {
  for (const stage of V100_STAGES.filter(stage => stage.missionType === "escort")) {
    const definition = v100BattleDefinitionFor(stage.id), config = definition.missionConfig;
    assert.equal(definition.timeline.length, 4);
    assert.deepEqual(definition.timeline.map(wave => wave.units.length), [2, 2, 3, 3]);
    assert.ok(definition.timeline.at(-1).at < config.durationSeconds);
    let runtime = createStationMissionRuntime(definition.missionType, config), elapsed = 17;
    while (!runtime.completed && elapsed < 180) {
      runtime = advanceStationMission({ missionType: definition.missionType, runtime, config,
        seconds: 1, battleElapsedSeconds: elapsed, humanCount: 7, escortCount: 2, baseHp: 680 });
      elapsed += 1;
    }
    assert.equal(runtime.completed, true);
    assert.ok(elapsed < 150, `Stage ${stage.number}: ${elapsed}s without any enemy obstruction`);
  }
});

test("the actual mission renderer draws all four authored panels at their runtime positions", async () => {
  const source = await readFile("app/AshfallGame.tsx", "utf8");
  const ast = ts.createSourceFile("AshfallGame.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "drawStationMission");
  assert.ok(declaration);
  const code = ts.transpileModule(declaration.getText(ast) + "\ndrawStationMission;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const draw = vm.runInNewContext(code, { STATION_MISSION_TYPES, stationPowerNodes, drawV100MissionNode, drawV100ClinicalControl, activeYForContentY: y => y, activeLaneCenters: [212, 282, 352] });
  for (const number of [9, 28]) {
    const definition = v100BattleDefinitionFor(V100_STAGES[number - 1].id), panels = stationPowerNodes(definition.missionConfig);
    const draws = [], positions = [];
    const gradient = () => ({ addColorStop() {} });
    const context = new Proxy({ drawImage: (...args) => draws.push(args), translate: (x, y) => positions.push([x, y]), createRadialGradient: gradient, createLinearGradient: gradient }, {
      get: (target, key) => target[key] ?? (() => {}),
    });
    const runtime = { powerActivated: panels.length - 1 };
    const image = { complete: true, naturalWidth: 1983 };
    draw(context, { definition, stageMission: runtime, time: 1, researchContainer: null }, { "v100-mission-node-states": image });
    assert.equal(draws.length, number === 28 ? 4 : 3);
    assert.deepEqual(positions, [], "authored node anchors use actual world destinations");
    for (const [index, panel] of panels.entries()) {
      const profile = V100_NODE_PROFILES[definition.stageId];
      const frame = v100NodeFrame(profile.shape, v100NodeState(runtime, index, 1, profile));
      assert.equal(draws[index][0], image);
      assert.equal(draws[index][5] - (frame.x - frame.anchorX) * frame.scale, panel.x);
      assert.equal(draws[index][6] - (frame.y - frame.anchorY) * frame.scale, panel.y - 8);
    }
    assert.ok(draws.every(args => args.slice(1).every(Number.isFinite)), "every crop and destination is valid");
  }
});

test("the actual escort renderer uses decoded story vehicles while retaining the legacy cart", async () => {
  const source = await readFile("app/AshfallGame.tsx", "utf8");
  const ast = ts.createSourceFile("AshfallGame.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "drawStationMission");
  const code = ts.transpileModule(declaration.getText(ast) + "\ndrawStationMission;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const draw = vm.runInNewContext(code, { drawV100MissionVehicles, drawV100ClinicalControl, STATION_MISSION_TYPES, escortCartX, CAMPAIGN_STAGE_IDS, activeYForContentY:y=>y, activeLaneCenters:[212,282,352] });
  for (const [number,count,label] of [[6,0,"保守台車"],[12,1,"密閉搬送車"],[19,1,"証拠搬送車"],[26,3,"冷蔵車"]]) {
    const definition=v100BattleDefinitionFor(V100_STAGES[number-1].id);
    const runtime=createStationMissionRuntime(definition.missionType,definition.missionConfig);
    assert.match(definition.objective+stationMissionObjective(runtime,definition.missionConfig),new RegExp(label));
    const plan=requiredBattleAssetPlan({stageId:definition.stageId}), images={},draws=[];
    for(const object of plan.stageObjects) images[object.id]={complete:true,naturalWidth:1672,naturalHeight:941};
    const context=new Proxy({drawImage:(...args)=>draws.push(args),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})}, {get:(target,key)=>target[key]??(()=>{})});
    draw(context,{definition,stageMission:runtime,time:0},images);
    const authored=draws.filter(args=>args[0]===images["v100-mission-vehicle-intact"]);
    assert.equal(authored.length,count,`Stage ${number} vehicle count`);
    if(count) {
      assert.equal(draws.length,count,"legacy cart must not overlap the authored vehicles");
      for(const path of Object.values(V100_MISSION_VEHICLE_ART)) assert.ok(plan.paths.includes(path),"decode both damage states before entry");
      delete images["v100-mission-vehicle-intact"];
      assert.throws(()=>draw(context,{definition,stageMission:runtime,time:0},images),/decoded before battle/);
      const legacyPlan=requiredBattleAssetPlan({stageId:definition.stageId,includeV100Sprites:false});
      for(const path of Object.values(V100_MISSION_VEHICLE_ART)) assert.ok(!legacyPlan.paths.includes(path));
    }
  }
});

test("the cold convoy is intercepted and secured instead of described as escaping", () => {
  const definition=v100BattleDefinitionFor(V100_STAGES[25].id),config=definition.missionConfig;
  const runtime=createStationMissionRuntime(definition.missionType,config);
  assert.match(definition.objective,/3台.*封鎖地点.*停止・確保/);
  assert.match(stationMissionObjective({...runtime,completed:true},config),/3台.*停止.*確保/);
  assert.match(stationMissionObjective({...runtime,failed:true},config),/確保に失敗/);
  assert.doesNotMatch(definition.phaseSchedule.map(phase=>phase.label).join(" "),/護送|出口/);
});
