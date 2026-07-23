import { enemyContentFor } from "./content/enemyCatalog.js";
import { WORLD_GEOMETRY } from "./gameRules.js";
import {
  STAGE_VIEWPORT_IDS,
  clampToWalkable,
  nearestLogicalLane,
  stageGeometryFor,
} from "./stageGeometry.js";

const TAU = Math.PI * 2;
const SEARCH_ANGLE_COUNT = 24;
const SEARCH_STEP = 12;
const SEARCH_MAX_DISTANCE = 216;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function nonNegative(value, fallback = 0) {
  return Math.max(0, finite(value, fallback));
}

function rectangle({ minX, maxX, minY, maxY, id = null, reason = null }) {
  return {
    id,
    reason,
    minX: Math.min(minX, maxX),
    maxX: Math.max(minX, maxX),
    minY: Math.min(minY, maxY),
    maxY: Math.max(minY, maxY),
  };
}

function circleIntersectsRectangle(point, radius, area) {
  const closestX = Math.max(area.minX, Math.min(area.maxX, point.x));
  const closestY = Math.max(area.minY, Math.min(area.maxY, point.y));
  return Math.hypot(point.x - closestX, point.y - closestY) <= radius;
}

function normalizedStageForbiddenAreas(geometry) {
  return geometry.forbiddenAreas
    .filter(({ id }) => !["upper-wall", "left-scenery", "right-scenery"].includes(id))
    .map((area) => rectangle({
      ...area,
      reason: area.id === "platform-track" ? "線路上には配置できません" : "進行上の禁止領域です",
    }));
}

function enemyPortalPoints(geometry) {
  const { corridor } = geometry.floor;
  const base = WORLD_GEOMETRY.enemyBase;
  const top = corridor.minY + 30;
  const bottom = corridor.maxY - 30;
  const fractions = [.08, .29, .5, .71, .92];
  return fractions.map((fraction, index) => ({
    id: `enemy-portal-${index + 1}`,
    hidden: {
      x: base.drawX + base.width * (.2 + (index % 3) * .18),
      y: top + (bottom - top) * fraction,
    },
    entry: {
      x: base.drawX + 10,
      y: top + (bottom - top) * fraction,
    },
  }));
}

export function battleSpaceFor(stageId, viewport = STAGE_VIEWPORT_IDS.STANDARD) {
  const geometry = stageGeometryFor(stageId, viewport);
  const { corridor } = geometry.floor;
  const friendlyDoorY = geometry.spawns.friendly.muster.y;
  const crawlerSafeArea = rectangle({
    id: "crawler-door-safe-area",
    reason: "CRAWLER出入口の安全域です",
    minX: corridor.minX,
    maxX: WORLD_GEOMETRY.crawler.exitX + 18,
    minY: friendlyDoorY - 58,
    maxY: friendlyDoorY + 28,
  });
  const space = {
    stageId,
    viewportId: geometry.viewport.id,
    world: geometry.world,
    playerFacingLaneCount: 0,
    walkableArea: rectangle({ id: "walkable-area", ...corridor }),
    supportArea: rectangle({
      id: "support-area",
      minX: WORLD_GEOMETRY.supportMinX,
      maxX: WORLD_GEOMETRY.supportMaxX,
      minY: corridor.minY,
      maxY: corridor.maxY,
    }),
    crawler: {
      body: rectangle({
        id: "crawler-body",
        minX: WORLD_GEOMETRY.crawler.x,
        maxX: WORLD_GEOMETRY.crawler.x + WORLD_GEOMETRY.crawler.width,
        minY: WORLD_GEOMETRY.crawler.y,
        maxY: WORLD_GEOMETRY.crawler.y + WORLD_GEOMETRY.crawler.height,
      }),
      door: {
        x: WORLD_GEOMETRY.crawler.doorX,
        y: friendlyDoorY - 30,
      },
      rampFoot: {
        x: WORLD_GEOMETRY.crawler.rampFootX,
        y: friendlyDoorY,
      },
      safeArea: crawlerSafeArea,
    },
    enemyBase: {
      body: rectangle({
        id: "enemy-base-body",
        minX: WORLD_GEOMETRY.enemyBase.drawX,
        maxX: WORLD_GEOMETRY.enemyBase.drawX + WORLD_GEOMETRY.enemyBase.width,
        minY: WORLD_GEOMETRY.enemyBase.drawY,
        maxY: WORLD_GEOMETRY.enemyBase.drawY + WORLD_GEOMETRY.enemyBase.height,
      }),
      attackX: WORLD_GEOMETRY.enemyBase.attackX,
    },
    forbiddenAreas: [
      crawlerSafeArea,
      ...normalizedStageForbiddenAreas(geometry),
    ],
    spawnPortals: {
      friendly: [{
        id: "crawler-door",
        hidden: {
          x: WORLD_GEOMETRY.crawler.doorX,
          y: friendlyDoorY - 30,
        },
        rampFoot: {
          x: WORLD_GEOMETRY.crawler.rampFootX,
          y: friendlyDoorY,
        },
        entry: {
          x: WORLD_GEOMETRY.musterX + 18,
          y: friendlyDoorY,
        },
      }],
      enemy: enemyPortalPoints(geometry),
    },
    routeHints: geometry.lanes.map(({ index, y }) => ({
      id: `internal-route-${index + 1}`,
      index,
      y,
      visibility: "internal",
    })),
  };
  return deepFreeze(space);
}

function normalizedExtraAreas(space, areas) {
  return (Array.isArray(areas) ? areas : [])
    .filter((area) => area && typeof area === "object")
    .map((area, index) => {
      const lane = Number.isInteger(area.lane) ? space.routeHints[area.lane] : null;
      const minY = Number.isFinite(area.minY) ? area.minY : lane ? lane.y - 32 : space.supportArea.minY;
      const maxY = Number.isFinite(area.maxY) ? area.maxY : lane ? lane.y + 32 : space.supportArea.maxY;
      return rectangle({
        id: area.id ?? `extra-forbidden-${index + 1}`,
        reason: area.reason ?? "進行上の禁止領域です",
        minX: finite(area.minX, space.supportArea.minX),
        maxX: finite(area.maxX, space.supportArea.maxX),
        minY,
        maxY,
      });
    });
}

function candidateBlocker(space, point, {
  radius,
  clearance,
  obstacles,
  forbiddenAreas,
}) {
  const support = space.supportArea;
  if (
    point.x - radius < support.minX
    || point.x + radius > support.maxX
    || point.y - radius < support.minY
    || point.y + radius > support.maxY
  ) {
    return { type: "outside-support", reason: "配置可能範囲外です" };
  }
  for (const area of [...space.forbiddenAreas, ...forbiddenAreas]) {
    if (circleIntersectsRectangle(point, radius, area)) {
      return { type: area.id, reason: area.reason ?? "進行上の禁止領域です" };
    }
  }
  for (const obstacle of obstacles) {
    if (!Number.isFinite(obstacle?.x) || !Number.isFinite(obstacle?.y)) continue;
    const requiredDistance = Math.max(clearance, nonNegative(obstacle.clearance ?? obstacle.placementClearance));
    if (Math.hypot(point.x - obstacle.x, point.y - obstacle.y) < requiredDistance) {
      return { type: "occupied", reason: "既存物資に近すぎます" };
    }
  }
  return null;
}

function candidateSeries(space, requested, radius) {
  const clamped = clampToWalkable(space.stageId, {
    x: Math.max(space.supportArea.minX + radius, Math.min(space.supportArea.maxX - radius, requested.x)),
    y: Math.max(space.supportArea.minY + radius, Math.min(space.supportArea.maxY - radius, requested.y)),
    radius,
  }, space.viewportId);
  const center = { x: clamped.x, y: clamped.y };
  const candidates = [center];
  for (let distance = SEARCH_STEP; distance <= SEARCH_MAX_DISTANCE; distance += SEARCH_STEP) {
    for (let index = 0; index < SEARCH_ANGLE_COUNT; index += 1) {
      const angle = index / SEARCH_ANGLE_COUNT * TAU;
      candidates.push({
        x: center.x + Math.cos(angle) * distance,
        y: center.y + Math.sin(angle) * distance,
      });
    }
  }
  return candidates;
}

export function nearestValidBattlefieldPlacement({
  stageId,
  viewport = STAGE_VIEWPORT_IDS.STANDARD,
  requested,
  radius = 0,
  clearance = 0,
  obstacles = [],
  forbiddenAreas = [],
} = {}) {
  const space = battleSpaceFor(stageId, viewport);
  const point = {
    x: finite(requested?.x, (space.supportArea.minX + space.supportArea.maxX) / 2),
    y: finite(requested?.y, (space.supportArea.minY + space.supportArea.maxY) / 2),
  };
  const safeRadius = nonNegative(radius);
  const safeClearance = nonNegative(clearance);
  const activeObstacles = Array.isArray(obstacles) ? obstacles : [];
  const activeForbiddenAreas = normalizedExtraAreas(space, forbiddenAreas);
  const requestedBlocker = candidateBlocker(space, point, {
    radius: safeRadius,
    clearance: safeClearance,
    obstacles: activeObstacles,
    forbiddenAreas: activeForbiddenAreas,
  });
  for (const candidate of candidateSeries(space, point, safeRadius)) {
    const blocker = candidateBlocker(space, candidate, {
      radius: safeRadius,
      clearance: safeClearance,
      obstacles: activeObstacles,
      forbiddenAreas: activeForbiddenAreas,
    });
    if (blocker) continue;
    const adjusted = Math.hypot(candidate.x - point.x, candidate.y - point.y) > .01;
    const internalRoute = nearestLogicalLane(stageId, candidate.y, space.viewportId);
    return deepFreeze({
      ok: true,
      adjusted,
      reason: adjusted ? "最寄りの配置可能地点へ補正" : "配置できます",
      requested: point,
      position: candidate,
      internalRouteId: `internal-route-${internalRoute.index + 1}`,
      legacyLane: internalRoute.index,
      initialBlocker: requestedBlocker,
    });
  }
  return deepFreeze({
    ok: false,
    adjusted: false,
    reason: requestedBlocker?.reason ?? "配置可能地点がありません",
    requested: point,
    position: null,
    internalRouteId: null,
    legacyLane: null,
    initialBlocker: requestedBlocker,
  });
}

function spawnClassGeometry(kind) {
  const enemy = enemyContentFor(kind);
  const spawnClass = enemy?.spawnClass ?? "normal";
  const clearance = spawnClass === "boss" ? 49 : spawnClass === "heavy" ? 43 : 31;
  const entrySpeed = spawnClass === "boss" ? 29
    : spawnClass === "heavy" ? 38
      : ["runner", "sprinter"].includes(kind) ? 62
        : 52;
  return { clearance, entrySpeed };
}

export function enemySpawnPortalPoint({
  stageId,
  entryId = 1,
  kind = "walker",
  viewport = STAGE_VIEWPORT_IDS.STANDARD,
} = {}) {
  const space = battleSpaceFor(stageId, viewport);
  const portals = space.spawnPortals.enemy;
  const slot = Math.abs(Math.trunc(finite(entryId, 1)) * 7 + kind.length * 3) % portals.length;
  const portal = portals[slot];
  const { clearance, entrySpeed } = spawnClassGeometry(kind);
  const internalRoute = nearestLogicalLane(stageId, portal.entry.y, space.viewportId);
  return deepFreeze({
    portalId: portal.id,
    routeId: `internal-route-${internalRoute.index + 1}`,
    legacyLane: internalRoute.index,
    x: portal.hidden.x,
    y: portal.hidden.y,
    combatReadyX: portal.entry.x - clearance,
    combatReadyY: portal.entry.y,
    entrySpeed,
  });
}

export function friendlyDeploymentPoint({
  stageId,
  viewport = STAGE_VIEWPORT_IDS.STANDARD,
} = {}) {
  const space = battleSpaceFor(stageId, viewport);
  const portal = space.spawnPortals.friendly[0];
  const internalRoute = nearestLogicalLane(stageId, portal.entry.y, space.viewportId);
  return deepFreeze({
    portalId: portal.id,
    routeId: `internal-route-${internalRoute.index + 1}`,
    legacyLane: internalRoute.index,
    x: portal.hidden.x,
    y: portal.hidden.y,
    rampFootX: portal.rampFoot.x,
    rampFootY: portal.rampFoot.y,
    combatReadyX: portal.entry.x,
    combatReadyY: portal.entry.y,
  });
}

function segmentIntersectsRectangle(start, end, area, padding = 0) {
  const expanded = {
    minX: area.minX - padding,
    maxX: area.maxX + padding,
    minY: area.minY - padding,
    maxY: area.maxY + padding,
  };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let minimum = 0;
  let maximum = 1;
  for (const [p, q] of [
    [-dx, start.x - expanded.minX],
    [dx, expanded.maxX - start.x],
    [-dy, start.y - expanded.minY],
    [dy, expanded.maxY - start.y],
  ]) {
    if (p === 0 && q < 0) return false;
    if (p === 0) continue;
    const ratio = q / p;
    if (p < 0) minimum = Math.max(minimum, ratio);
    else maximum = Math.min(maximum, ratio);
    if (minimum > maximum) return false;
  }
  return true;
}

export function battleSpaceLineOfSight({
  from,
  to,
  obstacles = [],
  padding = 0,
} = {}) {
  const start = { x: finite(from?.x, Number.NaN), y: finite(from?.y, Number.NaN) };
  const end = { x: finite(to?.x, Number.NaN), y: finite(to?.y, Number.NaN) };
  if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) {
    return deepFreeze({ clear: false, blockerId: "invalid-segment", distance: Number.POSITIVE_INFINITY });
  }
  const blocker = (Array.isArray(obstacles) ? obstacles : [])
    .find((area) => area && segmentIntersectsRectangle(start, end, area, nonNegative(padding)));
  return deepFreeze({
    clear: !blocker,
    blockerId: blocker?.id ?? null,
    distance: Math.hypot(end.x - start.x, end.y - start.y),
  });
}
