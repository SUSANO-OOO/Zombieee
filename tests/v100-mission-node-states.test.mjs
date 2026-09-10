import assert from "node:assert/strict";
import test from "node:test";
import { v100BattleDefinitionFor } from "../app/v100BattleAdapter.js";
import { V100_NODE_PROFILES, v100NodeState, v100NodeFrame, drawV100MissionNode } from "../app/v100MissionNodes.js";
import { advanceStationMissionRuntime, createStationMissionRuntime, stationMissionObjective, stationPowerNodes } from "../app/stationStageMechanics.js";

for (const [stageId, profile] of Object.entries(V100_NODE_PROFILES)) {
  test(`${stageId}: every actual node connects, operates, interrupts and completes with the correct physical state`, () => {
    const definition = v100BattleDefinitionFor(stageId), config = definition.missionConfig;
    const nodes = stationPowerNodes(config), initialState = profile.shutdown ? "on" : "off";
    let runtime = createStationMissionRuntime(definition.missionType, config);
    const assertRenderedState = (index, elapsed, expected) => {
      let rendered;
      const context = new Proxy({}, { get: (_target, key) => key === "drawImage"
        ? (_image, x) => { rendered = x; } : () => {} });
      drawV100MissionNode(context, { definition, stageMission: runtime, time: elapsed + definition.prepSeconds },
        { "v100-mission-node-states": { complete: true, naturalWidth: 1983 } }, index, 400, 250);
      assert.equal(rendered, v100NodeFrame(profile.shape, expected).x,
        "real drawing and mission advancement must share the clock after preparation");
    };
    const step = (elapsed, seconds, threats = 0) => {
      runtime = advanceStationMissionRuntime({ runtime, missionType: definition.missionType, config,
        battleElapsedSeconds: elapsed, seconds, baseHp: 680, humanCount: 1,
        powerOperatorCount: 1, powerLaneThreats: threats, wavesResolved: false });
    };
    let clock = 0;
    for (const node of nodes) {
      // Readiness is a lower bound, not a fresh clock for each operation.
      // V1 nodes now start ready; their actual sequence still moves forward.
      const index = node.number - 1, elapsed = Math.max(clock, node.readyAtSeconds);
      assert.equal(v100NodeState(runtime, index, elapsed, profile), initialState);
      step(elapsed, .1);
      assert.equal(v100NodeState(runtime, index, elapsed, profile), "connection");
      assertRenderedState(index, elapsed, "connection");
      step(elapsed + 1, 1);
      assert.equal(v100NodeState(runtime, index, elapsed + 1, profile), "engaged");
      step(elapsed + 1.2, .2, 1);
      assert.equal(v100NodeState(runtime, index, elapsed + 1.2, profile), "disconnection");
      assertRenderedState(index, elapsed + 1.2, "disconnection");
      assert.equal(runtime.powerActivated, index, "an interrupted node is never credited as completed");
      step(elapsed + 2, .8, 1);
      assert.equal(v100NodeState(runtime, index, elapsed + 2, profile), initialState);
      step(elapsed + 2.2, .2);
      step(elapsed + 8.2, 6);
      assert.equal(runtime.powerActivated, index + 1);
      assert.equal(v100NodeState(runtime, index, elapsed + 8.2, profile), profile.shutdown ? "disconnection" : "connection");
      assertRenderedState(index, elapsed + 8.2, profile.shutdown ? "disconnection" : "connection");
      assert.equal(v100NodeState(runtime, index, elapsed + 9, profile), profile.shutdown ? "off" : "on");
      assert.equal(runtime.completed, false, "nodes alone cannot skip wave clearance and the required return");
      clock = elapsed + 10;
    }
    assert.equal(nodes.length, profile.shutdown ? 4 : 3);
    if (profile.shutdown) {
      assert.match(definition.objective, /4基.*物理停止/u);
      assert.doesNotMatch(definition.phaseSchedule.map((phase) => phase.label).join(" "), /起動/u);
      assert.match(stationMissionObjective(createStationMissionRuntime(definition.missionType, config), config), /散布装置1を停止/u);
    }
  });
}
