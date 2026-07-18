import assert from "node:assert/strict";
import test from "node:test";
import {
  STATION_MISSION_TUNING,
  STATION_MISSION_TYPES,
  advanceStationMissionRuntime,
  createStationMissionRuntime,
  currentPowerNode,
  escortCartX,
  stationHumanMoveSpeed,
  stationMissionObjective,
  stationMissionOutcome,
} from "../app/stationStageMechanics.js";

test("escort requires an active escort, stalls for threats, and preserves its input", () => {
  const initial = createStationMissionRuntime(STATION_MISSION_TYPES.ESCORT);
  const idle = advanceStationMissionRuntime({ runtime: initial, seconds: 10, humanCount: 0 });
  const remote = advanceStationMissionRuntime({
    runtime: initial,
    seconds: 10,
    humanCount: 3,
    escortCount: 0,
  });
  const threatened = advanceStationMissionRuntime({
    runtime: initial,
    seconds: 10,
    humanCount: 3,
    escortCount: 3,
    nearbyThreats: 2,
  });

  assert.equal(initial.progress, 0);
  assert.equal(idle.progress, 0);
  assert.equal(idle.failed, false);
  assert.equal(idle.stalled, true);
  assert.equal(remote.progress, 0);
  assert.equal(remote.failed, false);
  assert.equal(threatened.progress, 0);
  assert.equal(threatened.integrity, initial.integrity - 120);
  assert.equal(Object.isFrozen(threatened), true);
});

test("an empty field can recover through normal redeployment before mission failure", () => {
  const escortInitial = createStationMissionRuntime(STATION_MISSION_TYPES.ESCORT);
  const escortEmpty = advanceStationMissionRuntime({
    runtime: escortInitial,
    seconds: 5,
    humanCount: 0,
    escortCount: 0,
  });
  const escortRedeployed = advanceStationMissionRuntime({
    runtime: escortEmpty,
    seconds: 10,
    humanCount: 1,
    escortCount: 1,
  });
  assert.equal(escortEmpty.failed, false);
  assert.equal(escortRedeployed.failed, false);
  assert.ok(escortRedeployed.progress > 0);

  const sealInitial = createStationMissionRuntime(STATION_MISSION_TYPES.SEQUENTIAL_SEAL);
  const sealEmpty = advanceStationMissionRuntime({
    runtime: sealInitial,
    seconds: 5,
    battleElapsedSeconds: 30,
    humanCount: 0,
    powerOperatorCount: 0,
  });
  const sealRedeployed = advanceStationMissionRuntime({
    runtime: sealEmpty,
    seconds: 6,
    battleElapsedSeconds: 36,
    humanCount: 1,
    powerOperatorCount: 1,
  });
  assert.equal(sealEmpty.failed, false);
  assert.equal(sealRedeployed.failed, false);
  assert.equal(sealRedeployed.powerActivated, 1);
});

test("escort contamination starts a canonical twenty-second repair and can fail", () => {
  const initial = createStationMissionRuntime(STATION_MISSION_TYPES.ESCORT);
  const contaminated = advanceStationMissionRuntime({
    runtime: initial,
    seconds: 4,
    humanCount: 3,
    escortCount: 3,
    contaminated: true,
  });
  assert.equal(contaminated.repairRemaining, 20);
  assert.equal(contaminated.transitions.at(-1), "escort-contaminated");
  assert.match(stationMissionObjective(contaminated), /床汚染/);

  const clearing = advanceStationMissionRuntime({
    runtime: contaminated,
    seconds: 8,
    humanCount: 3,
    escortCount: 3,
    contaminated: false,
  });
  assert.equal(clearing.repairRemaining, 12);
  assert.match(stationMissionObjective(clearing), /12秒/);

  const destroyed = advanceStationMissionRuntime({
    runtime: initial,
    seconds: 50,
    humanCount: 3,
    escortCount: 3,
    nearbyThreats: 2,
  });
  assert.equal(destroyed.integrity, 0);
  assert.equal(stationMissionOutcome({ runtime: destroyed }), "lost");
});

test("three unrelated escort compositions can complete without a required person", () => {
  const formations = [
    ["paisen", "hachi", "mizuchi"],
    ["nao", "kumaverson", "babayaga"],
    ["crazy-king", "tatara", "raider"],
  ];
  for (const formation of formations) {
    let runtime = createStationMissionRuntime(STATION_MISSION_TYPES.ESCORT);
    for (let tick = 0; tick < 200 && !runtime.completed; tick += 1) {
      runtime = advanceStationMissionRuntime({
        runtime,
        seconds: 1,
        humanCount: formation.length,
        escortCount: formation.length,
        baseHp: 1000,
      });
    }
    assert.equal(runtime.completed, true, formation.join(","));
    assert.equal(stationMissionOutcome({ runtime, baseHp: 1000 }), "won");
  }
  const shared = formations.reduce((intersection, formation) => intersection.filter((unit) => formation.includes(unit)));
  assert.deepEqual(shared, []);
});

test("escort cart stays on its bounded logical route", () => {
  const initial = createStationMissionRuntime(STATION_MISSION_TYPES.ESCORT);
  const complete = { ...initial, progress: 1 };
  assert.equal(escortCartX(initial), STATION_MISSION_TUNING.escort.startX);
  assert.equal(escortCartX(complete), STATION_MISSION_TUNING.escort.endX);
  assert.equal(escortCartX({ ...initial, progress: 2 }), STATION_MISSION_TUNING.escort.endX);
});

test("power nodes activate only in the canonical order after their readiness gates", () => {
  let runtime = createStationMissionRuntime(STATION_MISSION_TYPES.SEQUENTIAL_SEAL);
  assert.deepEqual(currentPowerNode(runtime), {
    index: 0,
    number: 1,
    lane: 0,
    x: 410,
    radiusX: 84,
    radiusY: 42,
    readyAtSeconds: 24,
  });

  runtime = advanceStationMissionRuntime({
    runtime,
    seconds: 20,
    battleElapsedSeconds: 20,
    humanCount: 3,
    powerOperatorCount: 3,
    powerLaneThreats: 0,
  });
  assert.equal(runtime.powerActivated, 0);
  assert.equal(runtime.powerHold, 0);

  for (const [elapsed, expected] of [[30, 1], [68, 2], [110, 3]]) {
    runtime = advanceStationMissionRuntime({
      runtime,
      seconds: 6,
      battleElapsedSeconds: elapsed,
      humanCount: 3,
      powerOperatorCount: 3,
      powerLaneThreats: 0,
    });
    assert.equal(runtime.powerActivated, expected);
    assert.equal(runtime.transitions.at(-1), `power-${expected}-activated`);
  }
  assert.equal(currentPowerNode(runtime), null);
});

test("power hold decays under a lane threat and cannot be skipped", () => {
  let runtime = createStationMissionRuntime(STATION_MISSION_TYPES.SEQUENTIAL_SEAL);
  runtime = advanceStationMissionRuntime({
    runtime,
    seconds: 4,
    battleElapsedSeconds: 30,
    humanCount: 2,
    powerOperatorCount: 2,
    powerLaneThreats: 0,
  });
  assert.equal(runtime.powerHold, 4);
  runtime = advanceStationMissionRuntime({
    runtime,
    seconds: 2,
    battleElapsedSeconds: 32,
    humanCount: 2,
    powerOperatorCount: 2,
    powerLaneThreats: 1,
  });
  assert.equal(runtime.powerHold, 3);
  assert.equal(runtime.powerActivated, 0);
});

test("remote units cannot activate a power node", () => {
  const runtime = advanceStationMissionRuntime({
    runtime: createStationMissionRuntime(STATION_MISSION_TYPES.SEQUENTIAL_SEAL),
    seconds: 6,
    battleElapsedSeconds: 30,
    humanCount: 3,
    powerOperatorCount: 0,
    powerLaneThreats: 0,
  });
  assert.equal(runtime.powerHold, 0);
  assert.equal(runtime.powerActivated, 0);
  assert.equal(runtime.failed, false);
});

test("seal requires all powers plus both the Gate Eater and research container", () => {
  let runtime = createStationMissionRuntime(STATION_MISSION_TYPES.SEQUENTIAL_SEAL);
  for (const elapsed of [30, 68, 110]) {
    runtime = advanceStationMissionRuntime({
      runtime,
      seconds: 6,
      battleElapsedSeconds: elapsed,
      humanCount: 3,
      powerOperatorCount: 3,
      powerLaneThreats: 0,
      gateEaterSeen: elapsed >= 68,
    });
  }
  assert.equal(runtime.powerActivated, 3);
  assert.equal(runtime.sealed, false);
  assert.match(stationMissionObjective(runtime), /改札喰い/);

  runtime = advanceStationMissionRuntime({
    runtime,
    seconds: 0,
    battleElapsedSeconds: 112,
    humanCount: 3,
    gateEaterSeen: true,
    gateEaterContained: true,
    researchContainerExposed: true,
    researchContainerContained: false,
    returnTargetCount: 3,
  });
  assert.equal(runtime.gateEaterContained, true);
  assert.equal(runtime.researchContainerExposed, true);
  assert.equal(runtime.sealed, false);
  assert.match(stationMissionObjective(runtime), /研究容器/);

  runtime = advanceStationMissionRuntime({
    runtime,
    seconds: 0,
    battleElapsedSeconds: 112,
    humanCount: 3,
    gateEaterContained: false,
    researchContainerExposed: false,
    researchContainerContained: true,
    returnTargetCount: 3,
  });
  assert.equal(runtime.sealed, false);
  assert.match(stationMissionObjective(runtime), /残存感染体/);

  runtime = advanceStationMissionRuntime({
    runtime,
    seconds: 0,
    battleElapsedSeconds: 112,
    humanCount: 3,
    returnTargetCount: 3,
    wavesResolved: true,
  });
  assert.equal(runtime.sealed, true);
  assert.equal(runtime.escapeRemaining, 45);
  assert.equal(runtime.returnTargetCount, 3);
  assert.equal(runtime.gateEaterContained, true);
  assert.equal(runtime.researchContainerContained, true);
  assert.equal(stationMissionOutcome({ runtime }), null);

  const partialReturn = advanceStationMissionRuntime({
    runtime,
    seconds: 10,
    humanCount: 3,
    returnedCount: 2,
    returnTargetCount: 1,
    escapeRouteThreats: 0,
  });
  assert.equal(partialReturn.escapeRemaining, 35);
  assert.equal(partialReturn.returnTargetCount, 3);
  assert.match(stationMissionObjective(partialReturn), /2\/3/);

  const blocked = advanceStationMissionRuntime({
    runtime: partialReturn,
    seconds: 10,
    humanCount: 3,
    returnedCount: 3,
    escapeRouteThreats: 1,
  });
  assert.equal(blocked.escapeRemaining, 25);
  assert.equal(blocked.completed, false);

  const returned = advanceStationMissionRuntime({
    runtime: blocked,
    seconds: 1,
    humanCount: 3,
    returnedCount: 3,
    escapeRouteThreats: 0,
    baseHp: 500,
  });
  assert.equal(returned.completed, true);
  assert.equal(returned.escapeRemaining, 24);
  assert.equal(stationMissionOutcome({ runtime: returned, baseHp: 500 }), "won");
  assert.equal(stationMissionObjective(returned), "全員帰還");
});

test("the 45-second return window is a deadline and times out before a partial squad returns", () => {
  const sealed = {
    ...createStationMissionRuntime(STATION_MISSION_TYPES.SEQUENTIAL_SEAL),
    powerActivated: 3,
    gateEaterContained: true,
    researchContainerExposed: true,
    researchContainerContained: true,
  };
  const opened = advanceStationMissionRuntime({
    runtime: sealed,
    seconds: 0,
    humanCount: 3,
    returnedCount: 0,
    returnTargetCount: 3,
    wavesResolved: true,
  });
  assert.equal(opened.escapeRemaining, 45);
  const almost = advanceStationMissionRuntime({
    runtime: opened,
    seconds: 44.999,
    humanCount: 3,
    returnedCount: 2,
  });
  assert.equal(almost.failed, false);
  assert.ok(almost.escapeRemaining > 0);
  const timedOut = advanceStationMissionRuntime({
    runtime: almost,
    seconds: 0.001,
    humanCount: 3,
    returnedCount: 2,
  });
  assert.equal(timedOut.escapeRemaining, 0);
  assert.equal(timedOut.completed, false);
  assert.equal(timedOut.failed, true);
  assert.equal(timedOut.transitions.at(-1), "return-timeout");
});

test("return completion tracks the sealed squad by identity and rejects replacement or death", () => {
  const ready = {
    ...createStationMissionRuntime(STATION_MISSION_TYPES.SEQUENTIAL_SEAL),
    powerActivated: 3,
    gateEaterContained: true,
    researchContainerExposed: true,
    researchContainerContained: true,
  };
  const opened = advanceStationMissionRuntime({
    runtime: ready,
    seconds: 0,
    humanCount: 3,
    activeUnitIds: ["a", "b", "c"],
    returnedUnitIds: [],
    returnedCount: 0,
    returnTargetCount: 3,
    wavesResolved: true,
  });
  assert.deepEqual(opened.returnTargetIds, ["a", "b", "c"]);

  const replacement = advanceStationMissionRuntime({
    runtime: opened,
    seconds: 1,
    humanCount: 3,
    activeUnitIds: ["a", "b", "replacement"],
    returnedUnitIds: ["a", "b", "replacement"],
    returnedCount: 3,
  });
  assert.equal(replacement.completed, false);
  assert.equal(replacement.failed, true);
  assert.equal(replacement.transitions.at(-1), "return-unit-lost");

  const returned = advanceStationMissionRuntime({
    runtime: opened,
    seconds: 1,
    humanCount: 3,
    activeUnitIds: ["a", "b", "c", "replacement"],
    returnedUnitIds: ["a", "b", "c"],
    returnedCount: 3,
  });
  assert.equal(returned.completed, true);
  assert.equal(returned.failed, false);

  const latched = advanceStationMissionRuntime({
    runtime: returned,
    seconds: 40,
    humanCount: 3,
    activeUnitIds: ["a", "b", "c"],
    returnedUnitIds: [],
    returnedCount: 0,
    escapeRouteThreats: 1,
  });
  assert.equal(latched.completed, true);
  assert.equal(latched.failed, false);
  assert.equal(latched.escapeRemaining, returned.escapeRemaining);
});

test("the slowest squad member can physically retreat from the seal door inside 45 seconds", () => {
  const runtime = {
    ...createStationMissionRuntime(STATION_MISSION_TYPES.SEQUENTIAL_SEAL),
    sealed: true,
  };
  const guardianSpeed = stationHumanMoveSpeed({
    baseSpeed: 11,
    runtime,
  });
  const containmentX = 892;
  const returnX = 205;
  assert.equal(guardianSpeed, 19.8);
  assert.ok((containmentX - returnX) / guardianSpeed < STATION_MISSION_TUNING.seal.escapeSeconds);
  assert.ok(Math.abs(stationHumanMoveSpeed({
    baseSpeed: 11,
    slowMultiplier: .62,
    runtime,
  }) - 12.276) < 1e-9);
  assert.ok(Math.abs(stationHumanMoveSpeed({
    baseSpeed: 11,
    slowMultiplier: .62,
    runtime: createStationMissionRuntime(STATION_MISSION_TYPES.ESCORT),
  }) - 6.82) < 1e-9);
  assert.equal(stationHumanMoveSpeed({
    baseSpeed: 11,
    slowMultiplier: 1,
    runtime: createStationMissionRuntime(STATION_MISSION_TYPES.ESCORT),
  }), 11);
  assert.equal(stationHumanMoveSpeed({
    baseSpeed: 11,
    runtime: { ...runtime, completed: true },
  }), 11);
});

test("a Crawler loss overrides an otherwise completed mission", () => {
  const completed = {
    ...createStationMissionRuntime(STATION_MISSION_TYPES.SEQUENTIAL_SEAL),
    completed: true,
  };
  assert.equal(stationMissionOutcome({ runtime: completed, baseHp: 0 }), "lost");
});
