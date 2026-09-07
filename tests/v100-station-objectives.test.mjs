import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { V100_STAGES } from "../app/v100Registry.js";
import { v100BattleDefinitionFor } from "../app/v100BattleAdapter.js";
import { advanceStationMissionRuntime as advanceStationMission, createStationMissionRuntime, currentPowerNode, stationMissionObjective, stationMissionOutcome, stationPowerNodes, STATION_MISSION_TYPES } from "../app/stationStageMechanics.js";
import { stationSpatialSnapshot } from "../app/stationSpatialMechanics.js";

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
  const draw = vm.runInNewContext(code, { STATION_MISSION_TYPES, stationPowerNodes, activeYForContentY: y => y, activeLaneCenters: [212, 282, 352] });
  for (const number of [9, 28]) {
    const definition = v100BattleDefinitionFor(V100_STAGES[number - 1].id), panels = stationPowerNodes(definition.missionConfig);
    const draws = [], positions = [];
    const gradient = () => ({ addColorStop() {} });
    const context = new Proxy({ drawImage: (...args) => draws.push(args), translate: (x, y) => positions.push([x, y]), createRadialGradient: gradient, createLinearGradient: gradient }, {
      get: (target, key) => target[key] ?? (() => {}),
    });
    draw(context, { definition, stageMission: { powerActivated: panels.length - 1 }, time: 1, researchContainer: null }, { "station-tunnel-mission-art-source": { complete: true, naturalWidth: 1672 } });
    assert.equal(draws.length, number === 28 ? 4 : 3);
    assert.deepEqual(positions, panels.map(panel => [panel.x, panel.y - 8]));
    assert.ok(draws.every(args => args.slice(1).every(Number.isFinite)), "every crop and destination is valid");
  }
});
