import assert from "node:assert/strict";
import test from "node:test";

import { CAMPAIGN_STAGE_BY_ID, CAMPAIGN_STAGE_IDS } from "../app/campaign.js";
import { LANE_Y, MOBILE_LANDSCAPE_LANE_Y } from "../app/gameRules.js";
import {
  STAGE_GEOMETRY_STAGE_IDS,
  STAGE_VIEWPORT_IDS,
  STAGE_VIEWPORT_PROFILES,
  bodyCircleGrounding,
  clampToWalkable,
  combatReadyGroundingAudit,
  hitboxGrounding,
  isWalkable,
  nearestLogicalLane,
  resolveStageViewportProfile,
  stageDebugPrimitives,
  stageGeometryFor,
} from "../app/stageGeometry.js";

const ALL_STAGE_IDS = [
  CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET,
  CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE,
  CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE,
  CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE,
  CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM,
  CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL,
];

const ALL_VIEWPORT_IDS = Object.values(STAGE_VIEWPORT_IDS);

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

function projectedContentPoint(geometry, x, y) {
  const lane = LANE_Y.reduce((nearest, routeY, index) => (
    Math.abs(y - routeY) < Math.abs(y - LANE_Y[nearest]) ? index : nearest
  ), 1);
  return {
    x,
    y: geometry.lanes[lane].y + y - LANE_Y[lane],
    lane,
  };
}

test("defines deterministic geometry for every Stage 1-6 viewport profile", () => {
  assert.deepEqual(STAGE_GEOMETRY_STAGE_IDS, ALL_STAGE_IDS);
  for (const [stageIndex, stageId] of ALL_STAGE_IDS.entries()) {
    for (const viewportId of ALL_VIEWPORT_IDS) {
      const geometry = stageGeometryFor(stageId, viewportId);
      assert.equal(geometry.stageNumber, stageIndex + 1);
      assert.equal(geometry.stageId, stageId);
      assert.equal(geometry.viewport.id, viewportId);
      assert.deepEqual(geometry.lanes.map(({ index }) => index), [0, 1, 2]);
      assert.equal(Object.isFrozen(geometry), true);
      assert.equal(Object.isFrozen(geometry.floor.corridor), true);
      assert.equal(stageGeometryFor(stageId, viewportId), geometry, "geometry is stable and reusable");
    }
  }
  assert.throws(() => stageGeometryFor("stage-missing"), /Unknown campaign stage geometry/);
});

test("uses the fixed world with standard and exact 844x390/844x340 cover transforms", () => {
  const standard = STAGE_VIEWPORT_PROFILES[STAGE_VIEWPORT_IDS.STANDARD];
  const mobile390 = STAGE_VIEWPORT_PROFILES[STAGE_VIEWPORT_IDS.MOBILE_844_390];
  const mobile340 = STAGE_VIEWPORT_PROFILES[STAGE_VIEWPORT_IDS.MOBILE_844_340];
  assert.deepEqual(standard.laneCenters, LANE_Y);
  assert.deepEqual(mobile390.laneCenters, MOBILE_LANDSCAPE_LANE_Y);
  assert.deepEqual(mobile340.laneCenters, MOBILE_LANDSCAPE_LANE_Y);
  assert.deepEqual({ width: mobile390.width, height: mobile390.height }, { width: 844, height: 390 });
  assert.deepEqual({ width: mobile340.width, height: mobile340.height }, { width: 844, height: 340 });
  close(mobile390.coverTransform.scale, 844 / 960);
  close(mobile340.coverTransform.scale, 844 / 960);
  close(mobile390.coverTransform.offsetY, (390 - 540 * (844 / 960)) / 2);
  close(mobile340.coverTransform.offsetY, (340 - 540 * (844 / 960)) / 2);
  assert.equal(resolveStageViewportProfile({ width: 844, height: 390 }), mobile390);
  assert.equal(resolveStageViewportProfile({ width: 844, height: 340 }), mobile340);
  assert.equal(resolveStageViewportProfile({ width: 1280, height: 720 }), standard);
});

test("keeps all logical lanes, spawn anchors, and fixed objectives on walkable floor", () => {
  for (const stageId of ALL_STAGE_IDS) {
    for (const viewportId of ALL_VIEWPORT_IDS) {
      const geometry = stageGeometryFor(stageId, viewportId);
      for (const lane of geometry.lanes) {
        assert.equal(isWalkable(geometry, { x: 480, y: lane.y, bodyRadius: 32 }), true, `${stageId}/${viewportId}/lane-${lane.index}`);
      }
      assert.equal(isWalkable(geometry, { ...geometry.spawns.friendly.muster, bodyRadius: 12 }), true);
      for (const point of geometry.spawns.enemy.laneAnchors) {
        assert.equal(isWalkable(geometry, { ...point, bodyRadius: 32 }), true);
      }
      for (const objective of geometry.objectives) {
        const points = objective.kind === "escort-route"
          ? [objective.start, objective.end]
          : objective.points ?? [objective];
        for (const point of points) assert.equal(isWalkable(geometry, point), true, `${stageId}/${objective.id}`);
      }
    }
  }
});

test("Stage 5 base destruction and Stage 6 seal geometry follow their campaign missions", () => {
  const sealConfig = CAMPAIGN_STAGE_BY_ID[CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL].objectiveConfig;
  for (const viewportId of ALL_VIEWPORT_IDS) {
    const platform = stageGeometryFor(CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM, viewportId);
    assert.deepEqual(platform.objectives.map(({ id }) => id), ["infected-base"]);
    assert.ok(platform.floor.corridor.maxY < platform.floor.platformEdgeY);
    assert.equal(isWalkable(platform, { x: 500, y: platform.floor.platformEdgeY + 1 }), false, "track is not walkable");

    const seal = stageGeometryFor(CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL, viewportId);
    const powers = seal.objectives.filter(({ kind }) => kind === "hold-point");
    assert.deepEqual(
      powers.map(({ id, sequence, lane, x, y }) => ({ id, sequence, lane, x, y })),
      sealConfig.powerXs.map((x, index) => ({
        id: `power-${index + 1}`,
        sequence: index + 1,
        ...projectedContentPoint(seal, x, sealConfig.powerYs[index]),
      })),
    );
    assert.deepEqual(seal.objectives.map(({ id }) => id), [
      "power-1", "power-2", "power-3", "gate-eater", "research-container", "seal-door", "return-route",
    ]);
    assert.deepEqual(powers.map(({ radiusX, radiusY }) => ({ radiusX, radiusY })), [
      { radiusX: sealConfig.powerRadiusX, radiusY: sealConfig.powerRadiusY },
      { radiusX: sealConfig.powerRadiusX, radiusY: sealConfig.powerRadiusY },
      { radiusX: sealConfig.powerRadiusX, radiusY: sealConfig.powerRadiusY },
    ]);

    const researchContainer = seal.objectives.find(({ id }) => id === "research-container");
    const sealDoor = seal.objectives.find(({ id }) => id === "seal-door");
    const returnRoute = seal.objectives.find(({ id }) => id === "return-route");
    assert.deepEqual(
      { x: researchContainer.x, y: researchContainer.y, lane: researchContainer.lane },
      projectedContentPoint(seal, sealConfig.researchContainerStartX, sealConfig.researchContainerY),
    );
    assert.deepEqual(
      { x: sealDoor.x, y: sealDoor.y, lane: sealDoor.lane },
      projectedContentPoint(seal, sealConfig.sealDoorX, sealConfig.sealY),
    );
    assert.deepEqual(
      returnRoute.points.map(({ x, lane }) => ({ x, lane })),
      [0, 1, 2].map((lane) => ({ x: sealConfig.returnX, lane })),
    );
    assert.deepEqual(
      { radiusX: returnRoute.radiusX, radiusY: returnRoute.radiusY },
      { radiusX: sealConfig.returnRadiusX, radiusY: sealConfig.returnRadiusY },
    );

    for (const objective of [...powers, researchContainer, sealDoor, ...returnRoute.points]) {
      assert.equal(isWalkable(seal, objective), true, `${viewportId}/${objective.id ?? `return-${objective.lane}`}`);
    }
  }
});

test("walkability and clamping keep the complete body circle inside the floor corridor", () => {
  const geometry = stageGeometryFor(CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE, STAGE_VIEWPORT_IDS.MOBILE_844_340);
  const { corridor } = geometry.floor;
  assert.equal(isWalkable(geometry, { x: 480, y: corridor.minY - 1 }), false);
  assert.equal(isWalkable(geometry, { x: corridor.minX + 11, y: geometry.lanes[1].y, radius: 12 }), false);
  assert.equal(isWalkable(geometry, { x: corridor.minX + 12, y: geometry.lanes[1].y, radius: 12 }), true);

  const clamped = clampToWalkable(geometry, { x: -100, y: 999, bodyRadius: 32 });
  assert.deepEqual(clamped, {
    x: corridor.minX + 32,
    y: corridor.maxY - 32,
    radius: 32,
    clamped: true,
  });
  assert.equal(isWalkable(geometry, clamped), true);
  assert.equal(nearestLogicalLane(geometry, geometry.lanes[2].y - 2).index, 2);
});

test("body-circle and rectangular hitbox grounding distinguish anchor, hitbox, and lane alignment", () => {
  for (const stageId of ALL_STAGE_IDS) {
    for (const viewportId of ALL_VIEWPORT_IDS) {
      const geometry = stageGeometryFor(stageId, viewportId);
      for (const lane of geometry.lanes) {
        const grounding = bodyCircleGrounding(geometry, {
          x: 480,
          y: lane.y + 3,
          lane: lane.index,
          bodyRadius: 32,
        });
        assert.equal(grounding.grounded, true);
        assert.equal(grounding.anchorAligned, true);
        assert.equal(grounding.nearestLane, lane.index);
      }
    }
  }

  const geometry = stageGeometryFor(CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM, STAGE_VIEWPORT_IDS.MOBILE_844_390);
  const edgeCircle = bodyCircleGrounding(geometry, {
    x: geometry.floor.corridor.minX + 8,
    y: geometry.lanes[1].y,
    lane: 1,
    bodyRadius: 12,
  });
  assert.equal(edgeCircle.anchorWalkable, true);
  assert.equal(edgeCircle.grounded, false);
  assert.equal(edgeCircle.reason, "body-circle-outside-floor");

  const rect = hitboxGrounding(geometry, {
    kind: "rect",
    x: 480,
    y: geometry.lanes[1].y,
    width: 40,
    height: 24,
  });
  assert.equal(rect.grounded, true);
  const trackRect = hitboxGrounding(geometry, {
    kind: "rect",
    x: 480,
    y: geometry.floor.corridor.maxY,
    width: 40,
    height: 24,
  });
  assert.equal(trackRect.grounded, false);
  assert.equal(trackRect.reason, "hitbox-outside-floor");
});

test("combat-ready audit reports only live active fighters whose body leaves the floor", () => {
  const geometry = stageGeometryFor(CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL, STAGE_VIEWPORT_IDS.MOBILE_844_340);
  const audit = combatReadyGroundingAudit({
    geometry,
    fighters: [
      { id: "ready-grounded", side: "human", hp: 100, combatReady: true, lane: 1, x: 480, y: geometry.lanes[1].y, bodyRadius: 12 },
      { id: "ready-off-floor", side: "zombie", hp: 100, combatReady: true, lane: 2, x: 480, y: geometry.floor.corridor.maxY + 1, bodyRadius: 12 },
      { id: "hidden-gate", side: "zombie", hp: 100, combatReady: false, lane: 1, x: 930, y: 20, bodyRadius: 32 },
      { id: "dead", side: "human", hp: 0, combatReady: true, lane: 1, x: 930, y: 20, bodyRadius: 12 },
    ],
  });
  assert.equal(audit.checkedCount, 2);
  assert.equal(audit.offFloorCount, 1);
  assert.equal(audit.offFloor[0].id, "ready-off-floor");
  assert.equal(audit.offFloor[0].grounding.reason, "anchor-outside-floor");
  assert.equal(Object.isFrozen(audit), true);
});

test("debug overlay primitives expose visible bounds, floor, lanes, spawns, objectives, and forbidden track", () => {
  const stageId = CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM;
  const first = stageDebugPrimitives(stageId, STAGE_VIEWPORT_IDS.MOBILE_844_340);
  const second = stageDebugPrimitives(stageId, STAGE_VIEWPORT_IDS.MOBILE_844_340);
  assert.equal(first, second, "debug primitives are stable");
  assert.equal(Object.isFrozen(first), true);
  assert.equal(first.filter(({ role }) => role === "logical-lane").length, 3);
  assert.equal(first.filter(({ role }) => role === "friendly-spawn").length, 1);
  assert.equal(first.filter(({ role }) => role === "enemy-combat-entry").length, 3);
  assert.equal(first.filter(({ role }) => role === "objective-anchor").length, 3);
  assert.ok(first.some(({ id, role }) => id === "walkable-floor" && role === "walkable-floor"));
  assert.ok(first.some(({ id }) => id === "visible-world"));
  assert.ok(first.some(({ id }) => id === "forbidden-platform-track"));
  assert.equal(new Set(first.map(({ id }) => id)).size, first.length, "primitive IDs remain unique");
});
