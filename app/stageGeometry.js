import { CAMPAIGN_STAGE_BY_ID, CAMPAIGN_STAGE_IDS } from "./campaign.js";
import {
  ENEMY_GATE_SPAWN,
  LANE_Y,
  MOBILE_LANDSCAPE_LANE_Y,
  WORLD_GEOMETRY,
} from "./gameRules.js";

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;
const FLOOR_MIN_X = WORLD_GEOMETRY.baseX - 2;
const FLOOR_MAX_X = WORLD_GEOMETRY.enemyBase.attackX + 33;
const LANE_EDGE_MARGIN = 36;
const BODY_ANCHOR_TOLERANCE = 4;

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

function coverTransform(width, height) {
  const scale = Math.max(width / WORLD_WIDTH, height / WORLD_HEIGHT);
  const offsetX = (width - WORLD_WIDTH * scale) / 2;
  const offsetY = (height - WORLD_HEIGHT * scale) / 2;
  return {
    scale,
    offsetX,
    offsetY,
    visibleWorld: {
      minX: -offsetX / scale,
      maxX: (width - offsetX) / scale,
      minY: -offsetY / scale,
      maxY: (height - offsetY) / scale,
    },
  };
}

export const STAGE_VIEWPORT_IDS = deepFreeze({
  STANDARD: "standard",
  MOBILE_844_390: "844x390",
  MOBILE_844_340: "844x340",
});

const VIEWPORT_INPUTS = [
  { id: STAGE_VIEWPORT_IDS.STANDARD, width: WORLD_WIDTH, height: WORLD_HEIGHT, laneCenters: LANE_Y },
  { id: STAGE_VIEWPORT_IDS.MOBILE_844_390, width: 844, height: 390, laneCenters: MOBILE_LANDSCAPE_LANE_Y },
  { id: STAGE_VIEWPORT_IDS.MOBILE_844_340, width: 844, height: 340, laneCenters: MOBILE_LANDSCAPE_LANE_Y },
];

export const STAGE_VIEWPORT_PROFILES = deepFreeze(Object.fromEntries(VIEWPORT_INPUTS.map((input) => {
  const transform = coverTransform(input.width, input.height);
  return [input.id, {
    ...input,
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    laneCenters: [...input.laneCenters],
    coverTransform: {
      scale: transform.scale,
      offsetX: transform.offsetX,
      offsetY: transform.offsetY,
    },
    visibleWorld: transform.visibleWorld,
  }];
})));

const STAGE_LAYOUTS = deepFreeze([
  { id: CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET, stageNumber: 1, floorKind: "shopping-arcade" },
  { id: CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE, stageNumber: 2, floorKind: "civic-evacuation-line" },
  { id: CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE, stageNumber: 3, floorKind: "defense-line" },
  { id: CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE, stageNumber: 4, floorKind: "station-concourse" },
  { id: CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM, stageNumber: 5, floorKind: "station-platform" },
  { id: CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL, stageNumber: 6, floorKind: "maintenance-tunnel" },
]);

export const STAGE_GEOMETRY_STAGE_IDS = deepFreeze(STAGE_LAYOUTS.map(({ id }) => id));

function lanePoint(laneCenters, lane, x, extra = {}) {
  return { x, y: laneCenters[lane], lane, ...extra };
}

function sharedLaneObjective(id, x, laneCenters, extra = {}) {
  return {
    id,
    kind: "shared-lane-objective",
    points: laneCenters.map((_, lane) => lanePoint(laneCenters, lane, x)),
    ...extra,
  };
}

function objectivesForStage(stageId, laneCenters) {
  const objectiveConfig = CAMPAIGN_STAGE_BY_ID[stageId]?.objectiveConfig ?? {};
  switch (stageId) {
    case CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET:
      return [sharedLaneObjective("infected-base", WORLD_GEOMETRY.enemyBase.attackX, laneCenters)];
    case CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE:
      return [sharedLaneObjective("rescue-convoy", WORLD_GEOMETRY.baseX, laneCenters, { defend: true })];
    case CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE:
      return [
        {
          id: "takuya",
          kind: "dynamic-boss-objective",
          dynamic: true,
          points: [lanePoint(laneCenters, 1, ENEMY_GATE_SPAWN.revealX - 49)],
        },
        sharedLaneObjective("infected-base", WORLD_GEOMETRY.enemyBase.attackX, laneCenters),
      ];
    case CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE:
      return [sharedLaneObjective("infected-relay", WORLD_GEOMETRY.enemyBase.attackX, laneCenters)];
    case CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM:
      return [sharedLaneObjective("infected-base", WORLD_GEOMETRY.enemyBase.attackX, laneCenters)];
    case CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL: {
      const powers = objectiveConfig.powerXs.map((x, index) => ({
        id: `power-${index + 1}`,
        kind: "hold-point",
        ...lanePoint(laneCenters, objectiveConfig.powerLanes[index], x),
        sequence: index + 1,
        radiusX: objectiveConfig.powerRadiusX,
        radiusY: objectiveConfig.powerRadiusY,
      }));
      return [
        ...powers,
        {
          id: "gate-eater",
          kind: "dynamic-boss-objective",
          dynamic: true,
          points: [lanePoint(laneCenters, 1, ENEMY_GATE_SPAWN.revealX - 49)],
          sequence: 4,
        },
        {
          id: "research-container",
          kind: "containment-objective",
          ...lanePoint(
            laneCenters,
            objectiveConfig.researchContainerLane,
            objectiveConfig.researchContainerStartX,
          ),
          sequence: 5,
        },
        {
          id: "seal-door",
          kind: "seal",
          ...lanePoint(laneCenters, objectiveConfig.sealLane, objectiveConfig.sealDoorX),
          sequence: 6,
        },
        {
          id: "return-route",
          kind: "shared-lane-return",
          points: laneCenters.map((_, lane) => lanePoint(laneCenters, lane, objectiveConfig.returnX)),
          radiusX: objectiveConfig.returnRadiusX,
          radiusY: objectiveConfig.returnRadiusY,
          sequence: 7,
        },
      ];
    }
    default:
      return [];
  }
}

function spawnGeometry(laneCenters) {
  const floorMinY = laneCenters[0] - LANE_EDGE_MARGIN;
  const floorMaxY = laneCenters[2] + LANE_EDGE_MARGIN;
  const enemyHiddenMaxX = Math.max(...ENEMY_GATE_SPAWN.interiorX);
  return {
    friendly: {
      muster: lanePoint(laneCenters, 2, WORLD_GEOMETRY.musterX),
      laneAnchors: laneCenters.map((_, lane) => lanePoint(laneCenters, lane, WORLD_GEOMETRY.musterX)),
      combatEntry: {
        minX: WORLD_GEOMETRY.crawler.exitX - 56,
        maxX: WORLD_GEOMETRY.musterX + 8,
        minY: floorMinY,
        maxY: floorMaxY,
      },
    },
    enemy: {
      hiddenGate: {
        minX: WORLD_GEOMETRY.enemyBase.enemySpawnMinX,
        maxX: enemyHiddenMaxX,
        minY: floorMinY,
        maxY: floorMaxY,
      },
      combatEntry: {
        minX: ENEMY_GATE_SPAWN.revealX - 49,
        maxX: ENEMY_GATE_SPAWN.revealX,
        minY: floorMinY,
        maxY: floorMaxY,
      },
      laneAnchors: laneCenters.map((_, lane) => lanePoint(laneCenters, lane, ENEMY_GATE_SPAWN.revealX - 31)),
    },
  };
}

function objectiveDebugPrimitives(objectives) {
  const primitives = [];
  for (const objective of objectives) {
    if (objective.kind === "escort-route") {
      primitives.push({
        id: `objective-${objective.id}`,
        kind: "line",
        role: "objective-route",
        x1: objective.start.x,
        y1: objective.start.y,
        x2: objective.end.x,
        y2: objective.end.y,
        lane: objective.lane,
      });
      continue;
    }
    const points = objective.points ?? [objective];
    for (const [index, point] of points.entries()) {
      primitives.push({
        id: `objective-${objective.id}-${index}`,
        kind: "circle",
        role: "objective-anchor",
        x: point.x,
        y: point.y,
        radius: 8,
        lane: point.lane,
        dynamic: objective.dynamic === true,
      });
    }
  }
  return primitives;
}

function debugPrimitivesFor(geometry) {
  const primitives = [
    {
      id: "visible-world",
      kind: "rect",
      role: "visible-world",
      ...geometry.viewport.visibleWorld,
    },
    {
      id: "walkable-floor",
      kind: "rect",
      role: "walkable-floor",
      ...geometry.floor.corridor,
    },
    ...geometry.lanes.map((lane) => ({
      id: `lane-${lane.index}`,
      kind: "line",
      role: "logical-lane",
      lane: lane.index,
      x1: geometry.floor.corridor.minX,
      y1: lane.y,
      x2: geometry.floor.corridor.maxX,
      y2: lane.y,
    })),
    {
      id: "friendly-muster",
      kind: "circle",
      role: "friendly-spawn",
      x: geometry.spawns.friendly.muster.x,
      y: geometry.spawns.friendly.muster.y,
      radius: 8,
      lane: geometry.spawns.friendly.muster.lane,
    },
    ...geometry.spawns.enemy.laneAnchors.map((point) => ({
      id: `enemy-entry-${point.lane}`,
      kind: "circle",
      role: "enemy-combat-entry",
      x: point.x,
      y: point.y,
      radius: 8,
      lane: point.lane,
    })),
    ...objectiveDebugPrimitives(geometry.objectives),
  ];
  for (const area of geometry.forbiddenAreas) {
    primitives.push({ ...area, id: `forbidden-${area.id}`, kind: "rect", role: "forbidden-floor" });
  }
  return primitives;
}

function createStageGeometry(layout, viewport) {
  const laneCenters = [...viewport.laneCenters];
  const corridor = {
    minX: FLOOR_MIN_X,
    maxX: FLOOR_MAX_X,
    minY: laneCenters[0] - LANE_EDGE_MARGIN,
    maxY: laneCenters[2] + LANE_EDGE_MARGIN,
  };
  const platformEdgeY = layout.stageNumber === 5 ? laneCenters[2] + 43 : null;
  const forbiddenAreas = [
    { id: "upper-wall", minX: 0, maxX: WORLD_WIDTH, minY: 0, maxY: corridor.minY },
    { id: "left-scenery", minX: 0, maxX: corridor.minX, minY: corridor.minY, maxY: corridor.maxY },
    { id: "right-scenery", minX: corridor.maxX, maxX: WORLD_WIDTH, minY: corridor.minY, maxY: corridor.maxY },
    ...(platformEdgeY === null ? [] : [{
      id: "platform-track",
      minX: 0,
      maxX: WORLD_WIDTH,
      minY: platformEdgeY,
      maxY: WORLD_HEIGHT,
    }]),
  ];
  const geometry = {
    stageId: layout.id,
    stageNumber: layout.stageNumber,
    floorKind: layout.floorKind,
    world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
    viewport,
    floor: {
      corridor,
      platformEdgeY,
    },
    lanes: laneCenters.map((y, index) => ({ index, y })),
    spawns: spawnGeometry(laneCenters),
    objectives: objectivesForStage(layout.id, laneCenters),
    forbiddenAreas,
  };
  geometry.debugPrimitives = debugPrimitivesFor(geometry);
  return deepFreeze(geometry);
}

const GEOMETRY_BY_STAGE_AND_VIEWPORT = deepFreeze(Object.fromEntries(STAGE_LAYOUTS.map((layout) => [
  layout.id,
  Object.fromEntries(Object.values(STAGE_VIEWPORT_PROFILES).map((viewport) => [
    viewport.id,
    createStageGeometry(layout, viewport),
  ])),
])));

export function resolveStageViewportProfile(viewport = STAGE_VIEWPORT_IDS.STANDARD) {
  if (typeof viewport === "string" && STAGE_VIEWPORT_PROFILES[viewport]) return STAGE_VIEWPORT_PROFILES[viewport];
  const width = finite(viewport?.width, WORLD_WIDTH);
  const height = finite(viewport?.height, WORLD_HEIGHT);
  if (width === 844 && height === 390) return STAGE_VIEWPORT_PROFILES[STAGE_VIEWPORT_IDS.MOBILE_844_390];
  if (width === 844 && height === 340) return STAGE_VIEWPORT_PROFILES[STAGE_VIEWPORT_IDS.MOBILE_844_340];
  const compact = width > height && height <= 430 && width / Math.max(1, height) > 16 / 9;
  return compact
    ? STAGE_VIEWPORT_PROFILES[height <= 365 ? STAGE_VIEWPORT_IDS.MOBILE_844_340 : STAGE_VIEWPORT_IDS.MOBILE_844_390]
    : STAGE_VIEWPORT_PROFILES[STAGE_VIEWPORT_IDS.STANDARD];
}

export function stageGeometryFor(stageId, viewport = STAGE_VIEWPORT_IDS.STANDARD) {
  const profile = resolveStageViewportProfile(viewport);
  const geometry = GEOMETRY_BY_STAGE_AND_VIEWPORT[stageId]?.[profile.id];
  if (!geometry) throw new RangeError(`Unknown campaign stage geometry: ${String(stageId)}`);
  return geometry;
}

function resolveGeometry(stageOrGeometry, viewport) {
  return typeof stageOrGeometry === "string"
    ? stageGeometryFor(stageOrGeometry, viewport)
    : stageOrGeometry;
}

export function isWalkable(stageOrGeometry, point, viewport = STAGE_VIEWPORT_IDS.STANDARD) {
  const geometry = resolveGeometry(stageOrGeometry, viewport);
  const corridor = geometry.floor.corridor;
  const radius = nonNegative(point?.radius ?? point?.bodyRadius);
  const x = finite(point?.x, Number.NaN);
  const y = finite(point?.y, Number.NaN);
  return Number.isFinite(x) && Number.isFinite(y)
    && x - radius >= corridor.minX
    && x + radius <= corridor.maxX
    && y - radius >= corridor.minY
    && y + radius <= corridor.maxY;
}

export function clampToWalkable(stageOrGeometry, point, viewport = STAGE_VIEWPORT_IDS.STANDARD) {
  const geometry = resolveGeometry(stageOrGeometry, viewport);
  const corridor = geometry.floor.corridor;
  const maximumRadius = Math.min(
    (corridor.maxX - corridor.minX) / 2,
    (corridor.maxY - corridor.minY) / 2,
  );
  const radius = Math.min(nonNegative(point?.radius ?? point?.bodyRadius), maximumRadius);
  const fallbackX = (corridor.minX + corridor.maxX) / 2;
  const fallbackY = geometry.lanes[1].y;
  const requestedX = finite(point?.x, fallbackX);
  const requestedY = finite(point?.y, fallbackY);
  const x = Math.max(corridor.minX + radius, Math.min(corridor.maxX - radius, requestedX));
  const y = Math.max(corridor.minY + radius, Math.min(corridor.maxY - radius, requestedY));
  return deepFreeze({
    x,
    y,
    radius,
    clamped: x !== requestedX || y !== requestedY,
  });
}

export function nearestLogicalLane(stageOrGeometry, y, viewport = STAGE_VIEWPORT_IDS.STANDARD) {
  const geometry = resolveGeometry(stageOrGeometry, viewport);
  return geometry.lanes.reduce((nearest, lane) => (
    Math.abs(finite(y, geometry.lanes[1].y) - lane.y) < Math.abs(finite(y, geometry.lanes[1].y) - nearest.y)
      ? lane
      : nearest
  ), geometry.lanes[1]);
}

export function bodyCircleGrounding(stageOrGeometry, fighter, viewport = STAGE_VIEWPORT_IDS.STANDARD) {
  const geometry = resolveGeometry(stageOrGeometry, viewport);
  const radius = nonNegative(fighter?.bodyRadius ?? fighter?.radius);
  const anchor = { x: finite(fighter?.x, Number.NaN), y: finite(fighter?.y, Number.NaN) };
  const assignedLane = Number.isInteger(fighter?.lane) && fighter.lane >= 0 && fighter.lane < 3
    ? geometry.lanes[fighter.lane]
    : null;
  const nearestLane = nearestLogicalLane(geometry, anchor.y);
  const anchorWalkable = isWalkable(geometry, anchor);
  const hitboxWalkable = isWalkable(geometry, { ...anchor, radius });
  const laneDelta = assignedLane ? anchor.y - assignedLane.y : null;
  const reason = !anchorWalkable
    ? "anchor-outside-floor"
    : !hitboxWalkable
      ? "body-circle-outside-floor"
      : null;
  return deepFreeze({
    grounded: reason === null,
    reason,
    anchorWalkable,
    hitboxWalkable,
    radius,
    assignedLane: assignedLane?.index ?? null,
    nearestLane: nearestLane.index,
    laneDelta,
    anchorAligned: laneDelta !== null && Math.abs(laneDelta) <= BODY_ANCHOR_TOLERANCE,
  });
}

export function hitboxGrounding(stageOrGeometry, hitbox, viewport = STAGE_VIEWPORT_IDS.STANDARD) {
  const geometry = resolveGeometry(stageOrGeometry, viewport);
  if (hitbox?.kind === "rect") {
    const x = finite(hitbox.x, Number.NaN);
    const y = finite(hitbox.y, Number.NaN);
    const width = nonNegative(hitbox.width);
    const height = nonNegative(hitbox.height);
    const anchorX = finite(hitbox.anchorX, .5);
    const anchorY = finite(hitbox.anchorY, .5);
    const bounds = {
      minX: x - width * anchorX,
      maxX: x + width * (1 - anchorX),
      minY: y - height * anchorY,
      maxY: y + height * (1 - anchorY),
    };
    const corridor = geometry.floor.corridor;
    const anchorWalkable = isWalkable(geometry, { x, y });
    const hitboxWalkable = Number.isFinite(x) && Number.isFinite(y)
      && bounds.minX >= corridor.minX
      && bounds.maxX <= corridor.maxX
      && bounds.minY >= corridor.minY
      && bounds.maxY <= corridor.maxY;
    return deepFreeze({
      grounded: anchorWalkable && hitboxWalkable,
      reason: !anchorWalkable ? "anchor-outside-floor" : hitboxWalkable ? null : "hitbox-outside-floor",
      anchorWalkable,
      hitboxWalkable,
      bounds,
    });
  }
  return bodyCircleGrounding(geometry, {
    ...hitbox,
    bodyRadius: hitbox?.radius ?? hitbox?.bodyRadius,
  });
}

export function combatReadyGroundingAudit({
  stageId,
  geometry = null,
  viewport = STAGE_VIEWPORT_IDS.STANDARD,
  fighters = [],
} = {}) {
  const resolved = geometry ?? stageGeometryFor(stageId, viewport);
  const checked = [];
  const offFloor = [];
  for (const fighter of Array.isArray(fighters) ? fighters : []) {
    if (fighter?.combatReady !== true || finite(fighter?.hp, 0) <= 0) continue;
    const grounding = bodyCircleGrounding(resolved, fighter);
    const entry = deepFreeze({ id: fighter.id ?? null, side: fighter.side ?? null, grounding });
    checked.push(entry);
    if (!grounding.grounded) offFloor.push(entry);
  }
  return deepFreeze({
    stageId: resolved.stageId,
    viewportId: resolved.viewport.id,
    checkedCount: checked.length,
    offFloorCount: offFloor.length,
    checked,
    offFloor,
  });
}

export function stageDebugPrimitives(stageId, viewport = STAGE_VIEWPORT_IDS.STANDARD) {
  return stageGeometryFor(stageId, viewport).debugPrimitives;
}
