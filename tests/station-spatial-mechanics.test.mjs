import assert from "node:assert/strict";
import test from "node:test";

import {
  createResearchContainerRuntime,
  enforceGateEaterContainmentInvariant,
  relocateStationHazards,
  resolveContainmentStrike,
  stationSpatialSnapshot,
} from "../app/stationSpatialMechanics.js";
import {
  STATION_MISSION_TYPES,
  advanceStationMissionRuntime,
  createStationMissionRuntime,
} from "../app/stationStageMechanics.js";
import { advanceLeakMudHazards } from "../app/stationEnemyMechanics.js";

const lanes = [100, 180, 260];

test("escort progress inputs count only units and threats inside the cart ellipse", () => {
  const config = {
    startX: 250,
    endX: 750,
    cartLane: 1,
    escortRadiusX: 100,
    escortRadiusY: 40,
    threatRadiusX: 80,
    threatRadiusY: 45,
  };
  const runtime = {
    ...createStationMissionRuntime(STATION_MISSION_TYPES.ESCORT, config),
    progress: .5,
  };
  const snapshot = stationSpatialSnapshot({
    missionType: STATION_MISSION_TYPES.ESCORT,
    missionRuntime: runtime,
    config,
    laneCenters: lanes,
    fighters: [
      { side: "human", hp: 10, combatReady: true, x: 500, y: 180, lane: 1 },
      { side: "human", hp: 10, combatReady: true, x: 280, y: 180, lane: 1 },
      { side: "zombie", hp: 10, combatReady: true, x: 520, y: 180, lane: 1 },
      { side: "zombie", hp: 10, combatReady: true, x: 500, y: 260, lane: 2 },
    ],
    hazards: [
      { active: true, lane: 2, centerX: 500, centerY: 260, radiusX: 80, radiusY: 25 },
    ],
  });
  assert.equal(snapshot.escortCount, 1);
  assert.equal(snapshot.nearbyThreats, 1);
  assert.equal(snapshot.contaminated, false);
});

test("cart contamination requires the same lane and overlapping ellipse", () => {
  const config = { startX: 500, endX: 500, cartLane: 1 };
  const runtime = createStationMissionRuntime(STATION_MISSION_TYPES.ESCORT, config);
  assert.equal(stationSpatialSnapshot({
    missionType: STATION_MISSION_TYPES.ESCORT,
    missionRuntime: runtime,
    config,
    laneCenters: lanes,
    hazards: [{ active: true, lane: 1, centerX: 500, centerY: 180, radiusX: 50, radiusY: 20 }],
  }).contaminated, true);
  assert.equal(stationSpatialSnapshot({
    missionType: STATION_MISSION_TYPES.ESCORT,
    missionRuntime: runtime,
    config,
    laneCenters: lanes,
    hazards: [{ active: true, lane: 1, centerX: 500, centerY: 260, radiusX: 50, radiusY: 20 }],
  }).contaminated, false);

  const expired = advanceLeakMudHazards({
    hazards: [{
      id: "mud",
      ownerSide: "zombie",
      active: true,
      lane: 1,
      centerX: 500,
      centerY: 180,
      radiusX: 50,
      radiusY: 20,
      remainingSeconds: .1,
      tickAccumulator: 0,
    }],
    elapsedSeconds: 1,
  });
  assert.equal(stationSpatialSnapshot({
    missionType: STATION_MISSION_TYPES.ESCORT,
    missionRuntime: runtime,
    config,
    laneCenters: lanes,
    hazards: expired.zones,
  }).contaminated, false);
});

test("power and return counts are derived from their actual objective zones", () => {
  const config = {
    powerXs: [400, 580, 740],
    powerLanes: [0, 2, 1],
    powerRadiusX: 80,
    powerRadiusY: 40,
    returnX: 205,
    returnRadiusX: 90,
    returnRadiusY: 45,
  };
  const runtime = createStationMissionRuntime(STATION_MISSION_TYPES.SEQUENTIAL_SEAL, config);
  const snapshot = stationSpatialSnapshot({
    missionType: STATION_MISSION_TYPES.SEQUENTIAL_SEAL,
    missionRuntime: runtime,
    config,
    laneCenters: lanes,
    fighters: [
      { id: "power", side: "human", hp: 10, combatReady: true, x: 400, y: 100, lane: 0 },
      { id: "returned", side: "human", hp: 10, combatReady: true, x: 205, y: 260, lane: 2 },
      { id: "remote", side: "human", hp: 10, combatReady: true, x: 700, y: 180, lane: 1 },
      { side: "zombie", hp: 10, combatReady: true, x: 405, y: 100, lane: 0 },
      { side: "zombie", hp: 10, combatReady: true, x: 210, y: 180, lane: 1 },
    ],
  });
  assert.equal(snapshot.powerOperatorCount, 1);
  assert.equal(snapshot.powerLaneThreats, 1);
  assert.equal(snapshot.returnedCount, 1);
  assert.equal(snapshot.returnTargetCount, 3);
  assert.deepEqual(snapshot.activeUnitIds, ["power", "returned", "remote"]);
  assert.deepEqual(snapshot.returnedUnitIds, ["returned"]);
  assert.equal(snapshot.escapeRouteThreats, 1);
});

test("position snapshots drive power activation and the 45-second all-return deadline", () => {
  const config = {
    powerXs: [400, 580, 740],
    powerLanes: [0, 2, 1],
    powerReadyAtSeconds: [0, 0, 0],
    powerHoldSeconds: 1,
    returnX: 205,
    returnRadiusX: 90,
    returnRadiusY: 45,
  };
  let runtime = createStationMissionRuntime(STATION_MISSION_TYPES.SEQUENTIAL_SEAL, config);
  const remote = stationSpatialSnapshot({
    missionType: STATION_MISSION_TYPES.SEQUENTIAL_SEAL,
    missionRuntime: runtime,
    config,
    laneCenters: lanes,
    fighters: [{ id: "a", side: "human", hp: 10, combatReady: true, x: 700, y: 180, lane: 1 }],
  });
  runtime = advanceStationMissionRuntime({
    runtime,
    missionType: STATION_MISSION_TYPES.SEQUENTIAL_SEAL,
    config,
    seconds: 1,
    battleElapsedSeconds: 1,
    ...remote,
  });
  assert.equal(runtime.powerActivated, 0);

  const operating = stationSpatialSnapshot({
    missionType: STATION_MISSION_TYPES.SEQUENTIAL_SEAL,
    missionRuntime: runtime,
    config,
    laneCenters: lanes,
    fighters: [{ id: "a", side: "human", hp: 10, combatReady: true, x: 400, y: 100, lane: 0 }],
  });
  runtime = advanceStationMissionRuntime({
    runtime,
    missionType: STATION_MISSION_TYPES.SEQUENTIAL_SEAL,
    config,
    seconds: 1,
    battleElapsedSeconds: 2,
    ...operating,
  });
  assert.equal(runtime.powerActivated, 1);

  runtime = {
    ...runtime,
    powerActivated: 3,
    gateEaterDefeated: true,
    gateEaterContained: true,
    researchContainerExposed: true,
    researchContainerContained: true,
  };
  const partial = stationSpatialSnapshot({
    missionType: STATION_MISSION_TYPES.SEQUENTIAL_SEAL,
    missionRuntime: runtime,
    config,
    laneCenters: lanes,
    fighters: [
      { id: "a", side: "human", hp: 10, combatReady: true, x: 205, y: 100, lane: 0 },
      { id: "b", side: "human", hp: 10, combatReady: true, x: 600, y: 180, lane: 1 },
    ],
  });
  runtime = advanceStationMissionRuntime({
    runtime,
    missionType: STATION_MISSION_TYPES.SEQUENTIAL_SEAL,
    config,
    seconds: 0,
    battleElapsedSeconds: 3,
    ...partial,
  });
  assert.deepEqual(runtime.returnTargetIds, ["a", "b"]);
  runtime = advanceStationMissionRuntime({
    runtime,
    missionType: STATION_MISSION_TYPES.SEQUENTIAL_SEAL,
    config,
    seconds: 10,
    battleElapsedSeconds: 13,
    ...partial,
  });
  assert.equal(runtime.escapeRemaining, 35);
  assert.equal(runtime.completed, false);

  const allReturned = stationSpatialSnapshot({
    missionType: STATION_MISSION_TYPES.SEQUENTIAL_SEAL,
    missionRuntime: runtime,
    config,
    laneCenters: lanes,
    fighters: [
      { id: "a", side: "human", hp: 10, combatReady: true, x: 205, y: 100, lane: 0 },
      { id: "b", side: "human", hp: 10, combatReady: true, x: 205, y: 180, lane: 1 },
    ],
  });
  runtime = advanceStationMissionRuntime({
    runtime,
    missionType: STATION_MISSION_TYPES.SEQUENTIAL_SEAL,
    config,
    seconds: 1,
    battleElapsedSeconds: 14,
    ...allReturned,
  });
  assert.equal(runtime.completed, true);
  assert.equal(runtime.escapeRemaining, 34);
});

test("wave resolution fails closed until waves, pending spawns, and every unresolved enemy are gone", () => {
  const common = {
    missionType: STATION_MISSION_TYPES.SEQUENTIAL_SEAL,
    eventIndex: 10,
    timelineLength: 10,
    pendingSpawnCount: 0,
  };
  const cases = [
    ["unissued event", { eventIndex: 9 }, [], false],
    ["pending spawn", { pendingSpawnCount: 1 }, [], false],
    ["living enemy", {}, [{ side: "zombie", kind: "walker", hp: 10, combatReady: true }], false],
    ["gate-entering enemy", {}, [{ side: "zombie", kind: "gate-eater", hp: 10, combatReady: false, gateEntering: true }], false],
    ["non-ready enemy", {}, [{ side: "zombie", kind: "walker", hp: 10, combatReady: false }], false],
    ["dead enemy", {}, [{ side: "zombie", kind: "walker", hp: 0, combatReady: true }], true],
    ["contained Gate Eater", {}, [{ side: "zombie", kind: "gate-eater", hp: 28, combatReady: false, contained: true }], true],
    ["mistagged contained normal enemy", {}, [{ side: "zombie", kind: "walker", hp: 10, contained: true }], false],
  ];
  for (const [label, overrides, fighters, expected] of cases) {
    assert.equal(stationSpatialSnapshot({
      ...common,
      ...overrides,
      fighters,
    }).wavesResolved, expected, label);
  }
});

test("frozen Leak Mud hazards relocate immutably across viewport lane layouts", () => {
  const hazard = Object.freeze({
    id: "mud",
    lane: 2,
    centerX: 500,
    centerY: 446,
    radiusX: 58,
    radiusY: 20,
    active: true,
  });
  const relocated = relocateStationHazards({
    hazards: Object.freeze([hazard]),
    previousLaneCenters: [286, 366, 446],
    nextLaneCenters: [170, 235, 300],
  });
  assert.equal(relocated[0].centerY, 300);
  assert.equal(hazard.centerY, 446);
  assert.notEqual(relocated[0], hazard);
  assert.equal(Object.isFrozen(relocated), true);
  assert.equal(Object.isFrozen(relocated[0]), true);
});

test("Gate Eater strikes pass the former 28 percent floor, reach zero, and secure the container", () => {
  const boss = {
    id: 7,
    kind: "gate-eater",
    side: "zombie",
    hp: 100,
    maxHp: 100,
    x: 850,
    bodyRadius: 25,
    combatReady: true,
    gateEntering: false,
    targetId: 1,
    targetObjectId: null,
  };
  const container = {
    ...createResearchContainerRuntime({ researchContainerStartX: 870 }),
    exposed: true,
  };
  const belowFormerFloor = resolveContainmentStrike({
    boss,
    researchContainer: container,
    attackDamage: 73,
    powerActivated: 2,
    sealDoorX: 867,
  });
  assert.equal(belowFormerFloor.boss.hp, 27);
  assert.equal(belowFormerFloor.boss.x, 850);
  assert.equal(belowFormerFloor.researchContainer.x, 870);
  assert.equal(belowFormerFloor.bossDefeated, false);

  const defeated = resolveContainmentStrike({
    boss: belowFormerFloor.boss,
    researchContainer: belowFormerFloor.researchContainer,
    attackDamage: 999,
    powerActivated: 3,
    sealDoorX: 867,
  });
  assert.equal(defeated.boss.hp, 0);
  assert.equal(defeated.boss.contained, true);
  assert.equal(defeated.boss.combatReady, false);
  assert.equal(defeated.bossDefeated, true);
  assert.equal(defeated.researchContainer.exposed, true);
  assert.equal(defeated.researchContainer.contained, true);
  assert.equal(defeated.containmentComplete, true);
});

test("the Gate Eater invariant preserves lethal damage from every channel and never resurrects the boss", () => {
  for (const [hp, expected] of [[504, 504], [503, 503], [3, 3], [0, 0], [-4, 0]]) {
    const boss = enforceGateEaterContainmentInvariant({
      id: "boss",
      kind: "gate-eater",
      maxHp: 1800,
      hp,
      combatReady: true,
      gateEntering: true,
      targetId: "human",
    });
    assert.equal(boss.hp, expected);
    assert.equal(boss.combatReady, expected > 0);
    assert.equal(Object.isFrozen(boss), true);
  }
  const contained = enforceGateEaterContainmentInvariant({
    kind: "gate-eater",
    maxHp: 100,
    hp: -999,
    contained: true,
    combatReady: true,
    gateEntering: true,
    targetId: "human",
    targetObjectId: "crawler",
  });
  assert.equal(contained.hp, 0);
  assert.equal(contained.combatReady, false);
  assert.equal(contained.gateEntering, false);
  assert.equal(contained.targetId, null);
  assert.equal(contained.targetObjectId, null);
});
