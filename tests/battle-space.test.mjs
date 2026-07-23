import assert from "node:assert/strict";
import test from "node:test";
import { CAMPAIGN_STAGE_IDS, CAMPAIGN_STAGES } from "../app/campaign.js";
import {
  battleSpaceFor,
  battleSpaceLineOfSight,
  enemySpawnPortalPoint,
  friendlyDeploymentPoint,
  nearestValidBattlefieldPlacement,
} from "../app/battleSpace.js";
import {
  AIRSTRIKE_DEF,
  WORLD_GEOMETRY,
  createEmergencySupportRuntime,
  requestAirstrike,
  resolveAirstrikeImpact,
  resolveBattlefieldSupplyPlacement,
} from "../app/gameRules.js";
import { STAGE_VIEWPORT_IDS, isWalkable } from "../app/stageGeometry.js";

const VIEWPORTS = Object.values(STAGE_VIEWPORT_IDS);

test("Stage 1-6 expose continuous player-facing battle spaces at every required viewport", () => {
  for (const stage of CAMPAIGN_STAGES) {
    for (const viewport of VIEWPORTS) {
      const space = battleSpaceFor(stage.id, viewport);
      assert.equal(space.stageId, stage.id);
      assert.equal(space.playerFacingLaneCount, 0);
      assert.equal(space.routeHints.every(({ visibility }) => visibility === "internal"), true);
      assert.ok(space.supportArea.maxY - space.supportArea.minY > 100);
      assert.ok(space.supportArea.minX > space.walkableArea.minX);
      assert.ok(space.supportArea.maxX < space.walkableArea.maxX);
      assert.equal(Object.isFrozen(space), true);
    }
  }
});

test("continuous placement preserves arbitrary Y and corrects only invalid positions", () => {
  const stageId = CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET;
  const requested = { x: 520, y: 309.25 };
  const direct = nearestValidBattlefieldPlacement({ stageId, requested, radius: 18, clearance: 64 });
  assert.equal(direct.ok, true);
  assert.equal(direct.adjusted, false);
  assert.deepEqual(direct.position, requested);

  const crawlerBlocked = nearestValidBattlefieldPlacement({
    stageId,
    requested: { x: WORLD_GEOMETRY.supportMinX + 20, y: 352 },
    radius: 18,
    clearance: 64,
  });
  assert.equal(crawlerBlocked.ok, true);
  assert.equal(crawlerBlocked.adjusted, true);
  assert.equal(crawlerBlocked.initialBlocker.type, "crawler-door-safe-area");
  assert.ok(crawlerBlocked.position.x > WORLD_GEOMETRY.crawler.exitX + 18);

  const occupied = nearestValidBattlefieldPlacement({
    stageId,
    requested,
    radius: 18,
    clearance: 72,
    obstacles: [{ id: "existing-pod", x: requested.x, y: requested.y, clearance: 72 }],
  });
  assert.equal(occupied.ok, true);
  assert.equal(occupied.adjusted, true);
  assert.equal(occupied.initialBlocker.type, "occupied");
  assert.ok(Math.hypot(occupied.position.x - requested.x, occupied.position.y - requested.y) >= 72);
});

test("supplies and airstrikes resolve at exact Y coordinates while lanes remain internal hints", () => {
  const supply = resolveBattlefieldSupplyPlacement({
    running: true,
    paused: false,
    over: false,
    scrap: 100,
    supplyKind: "medical",
    x: 512,
    y: 307.5,
    supplies: [],
    areaEffects: [],
  });
  assert.equal(supply.ok, true);
  assert.equal(supply.supplies[0].y, 307.5);
  assert.equal(supply.areaEffects[0].y, 307.5);
  assert.equal(Number.isInteger(supply.supplies[0].lane), true);

  const request = requestAirstrike({
    running: true,
    paused: false,
    over: false,
    supportGauge: 100,
    x: 540,
    y: 307.5,
    runtime: createEmergencySupportRuntime(),
  });
  assert.equal(request.ok, true);
  assert.equal(request.runtime.targetY, 307.5);
  const impact = resolveAirstrikeImpact({
    runtime: { ...request.runtime, phase: "impact" },
    fighters: [
      { id: 1, side: "zombie", lane: 1, x: 540, y: 307.5, hp: 200, combatReady: true },
      { id: 2, side: "zombie", lane: 1, x: 540, y: 110, hp: 200, combatReady: true },
    ],
  });
  assert.deepEqual(impact.hits, [{ id: 1, damage: AIRSTRIKE_DEF.damage }]);
});

test("Stage 5 continuous placement never corrects onto the track", () => {
  const stageId = CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM;
  for (const viewport of VIEWPORTS) {
    const space = battleSpaceFor(stageId, viewport);
    const result = nearestValidBattlefieldPlacement({
      stageId,
      viewport,
      requested: { x: 520, y: 999 },
      radius: 20,
      clearance: 58,
    });
    assert.equal(result.ok, true);
    assert.ok(result.position.y + 20 <= space.supportArea.maxY);
    assert.equal(isWalkable(stageId, { ...result.position, radius: 20 }, viewport), true);
    const track = space.forbiddenAreas.find(({ id }) => id === "platform-track");
    assert.ok(track, "Stage 5 exposes the track as a forbidden placement area");
    const closestX = Math.max(track.minX, Math.min(track.maxX, result.position.x));
    const closestY = Math.max(track.minY, Math.min(track.maxY, result.position.y));
    assert.ok(
      Math.hypot(result.position.x - closestX, result.position.y - closestY) > 20,
      "corrected support circle does not intersect the platform track",
    );
  }
});

test("enemy spawns use deterministic internal portals across the base instead of visible lane slots", () => {
  for (const stage of CAMPAIGN_STAGES) {
    for (const viewport of VIEWPORTS) {
      const points = Array.from({ length: 20 }, (_, index) => enemySpawnPortalPoint({
        stageId: stage.id,
        viewport,
        entryId: index + 1,
        kind: index % 4 === 0 ? "crusher" : index % 3 === 0 ? "runner" : "walker",
      }));
      assert.ok(new Set(points.map(({ portalId }) => portalId)).size >= 5);
      assert.ok(new Set(points.map(({ y }) => y)).size >= 5);
      for (const point of points) {
        assert.match(point.routeId, /^internal-route-/u);
        assert.ok(point.x >= WORLD_GEOMETRY.enemyBase.drawX);
        assert.ok(point.x <= WORLD_GEOMETRY.enemyBase.drawX + WORLD_GEOMETRY.enemyBase.width);
        assert.ok(point.combatReadyX < WORLD_GEOMETRY.enemyBase.drawX);
      }
      assert.deepEqual(
        enemySpawnPortalPoint({ stageId: stage.id, viewport, entryId: 7, kind: "runner" }),
        enemySpawnPortalPoint({ stageId: stage.id, viewport, entryId: 7, kind: "runner" }),
      );
    }
  }
});

test("friendly deployment owns one lit CRAWLER door and a walkable run-out point", () => {
  for (const stage of CAMPAIGN_STAGES) {
    for (const viewport of VIEWPORTS) {
      const point = friendlyDeploymentPoint({ stageId: stage.id, viewport });
      const space = battleSpaceFor(stage.id, viewport);
      assert.equal(point.portalId, "crawler-door");
      assert.deepEqual(
        { x: point.x, y: point.y },
        space.crawler.door,
      );
      assert.ok(point.x < point.combatReadyX);
      assert.ok(point.x < point.rampFootX);
      assert.ok(point.rampFootX < point.combatReadyX);
      assert.ok(point.y < point.rampFootY);
      assert.equal(point.rampFootY, point.combatReadyY);
      assert.equal(isWalkable(stage.id, {
        x: point.combatReadyX,
        y: point.combatReadyY,
        radius: 11,
      }, viewport), true);
    }
  }
});

test("battle-space line of sight uses real segments and obstacle shapes", () => {
  const clear = battleSpaceLineOfSight({
    from: { x: 250, y: 260 },
    to: { x: 700, y: 320 },
    obstacles: [{ id: "off-path", minX: 400, maxX: 450, minY: 100, maxY: 150 }],
  });
  assert.equal(clear.clear, true);
  assert.ok(clear.distance > 450);

  const blocked = battleSpaceLineOfSight({
    from: { x: 250, y: 260 },
    to: { x: 700, y: 320 },
    obstacles: [{ id: "pod", minX: 430, maxX: 470, minY: 270, maxY: 310 }],
    padding: 5,
  });
  assert.deepEqual({ clear: blocked.clear, blockerId: blocked.blockerId }, { clear: false, blockerId: "pod" });
});
