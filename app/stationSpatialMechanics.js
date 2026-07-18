import { STATION_MISSION_TYPES, currentPowerNode, escortCartX } from "./stationStageMechanics.js";

const DEFAULT_LANE_CENTERS = Object.freeze([286, 366, 446]);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positive(value, fallback) {
  const number = finite(value, fallback);
  return number > 0 ? number : fallback;
}

function integer(value, fallback = 0) {
  return Math.max(0, Math.trunc(finite(value, fallback)));
}

function frozen(value) {
  return Object.freeze(value);
}

function living(entity) {
  return entity?.hp > 0;
}

function combatHuman(entity) {
  return living(entity) && entity.side === "human" && entity.combatReady !== false;
}

function unresolvedEnemy(entity) {
  return living(entity)
    && entity.side === "zombie"
    && !(entity.kind === "gate-eater" && entity.contained === true);
}

function entityId(entity) {
  if (entity?.id === null || entity?.id === undefined) return null;
  return String(entity.id);
}

function pointInEllipse(point, centerX, centerY, radiusX, radiusY) {
  const safeRadiusX = positive(radiusX, 1);
  const safeRadiusY = positive(radiusY, 1);
  const dx = (finite(point?.x, Number.NaN) - centerX) / safeRadiusX;
  const dy = (finite(point?.y, Number.NaN) - centerY) / safeRadiusY;
  return Number.isFinite(dx) && Number.isFinite(dy) && dx ** 2 + dy ** 2 <= 1;
}

function nearestLaneY(entity, laneCenters) {
  const lane = Number.isInteger(entity?.lane) && entity.lane >= 0 && entity.lane < laneCenters.length
    ? entity.lane
    : laneCenters.reduce((choice, _, index) => (
      Math.abs(finite(entity?.y) - laneCenters[index]) < Math.abs(finite(entity?.y) - laneCenters[choice])
        ? index
        : choice
    ), 1);
  return laneCenters[lane];
}

function inSharedLaneReturnZone(entity, config, laneCenters) {
  return pointInEllipse(
    entity,
    finite(config.returnX, 205),
    nearestLaneY(entity, laneCenters),
    positive(config.returnRadiusX, 96),
    positive(config.returnRadiusY, 48),
  );
}

export function createResearchContainerRuntime(config = {}) {
  return frozen({
    x: finite(config.researchContainerStartX, 708),
    lane: [0, 1, 2].includes(config.researchContainerLane)
      ? config.researchContainerLane
      : 1,
    exposed: false,
    contained: false,
  });
}

export function relocateStationHazards({
  hazards = [],
  previousLaneCenters = DEFAULT_LANE_CENTERS,
  nextLaneCenters = DEFAULT_LANE_CENTERS,
} = {}) {
  const previous = Array.isArray(previousLaneCenters) && previousLaneCenters.length === 3
    ? previousLaneCenters
    : DEFAULT_LANE_CENTERS;
  const next = Array.isArray(nextLaneCenters) && nextLaneCenters.length === 3
    ? nextLaneCenters
    : DEFAULT_LANE_CENTERS;
  return frozen((Array.isArray(hazards) ? hazards : []).map((hazard) => {
    const lane = [0, 1, 2].includes(hazard?.lane) ? hazard.lane : 1;
    return frozen({
      ...hazard,
      centerY: finite(hazard?.centerY) + finite(next[lane]) - finite(previous[lane]),
    });
  }));
}

export function enforceGateEaterContainmentInvariant(boss) {
  const original = { ...(boss ?? {}) };
  if (original.kind !== "gate-eater") return frozen(original);
  const suppressionFloor = Math.max(1, Math.ceil(positive(original.maxHp, 1) * 28 / 100));
  const contained = original.contained === true;
  return frozen({
    ...original,
    hp: Math.max(suppressionFloor, finite(original.hp, suppressionFloor)),
    combatReady: contained ? false : original.combatReady,
    gateEntering: contained ? false : original.gateEntering,
    targetId: contained ? null : original.targetId,
    targetObjectId: contained ? null : original.targetObjectId,
  });
}

export function resolveContainmentStrike({
  boss,
  researchContainer,
  attackDamage = 0,
  powerActivated = 0,
  sealDoorX = 867,
} = {}) {
  const originalBoss = { ...(boss ?? {}) };
  const originalContainer = {
    ...createResearchContainerRuntime(),
    ...(researchContainer ?? {}),
  };
  const damage = Math.max(0, finite(attackDamage));
  const powered = integer(powerActivated) >= 3;
  const exposed = originalContainer.exposed === true
    || (powered && living(originalBoss));
  const suppressionFloor = Math.max(1, Math.ceil(positive(originalBoss.maxHp, 1) * 28 / 100));
  const hp = Math.max(suppressionFloor, finite(originalBoss.hp, suppressionFloor) - damage);
  const bossPush = powered ? Math.min(18, 3 + damage * .055) : 0;
  const containerPush = powered && exposed ? Math.min(18, 5 + damage * .1) : 0;
  const nextBossX = finite(originalBoss.x) + bossPush;
  const nextContainerX = finite(originalContainer.x, 708) + containerPush;
  const bossAtSeal = nextBossX >= finite(sealDoorX, 867) + positive(originalBoss.bodyRadius, 25);
  const containerAtSeal = nextContainerX >= finite(sealDoorX, 867) + 18;
  const containmentComplete = bossAtSeal && containerAtSeal;

  return frozen({
    boss: enforceGateEaterContainmentInvariant({
      ...originalBoss,
      x: nextBossX,
      hp,
      contained: containmentComplete,
      combatReady: containmentComplete ? false : originalBoss.combatReady,
      gateEntering: containmentComplete ? false : originalBoss.gateEntering,
      targetId: containmentComplete ? null : originalBoss.targetId,
      targetObjectId: containmentComplete ? null : originalBoss.targetObjectId,
    }),
    researchContainer: frozen({
      ...originalContainer,
      x: nextContainerX,
      exposed,
      contained: containerAtSeal,
    }),
    suppressionFloor,
    bossAtSeal,
    containerAtSeal,
    containmentComplete,
  });
}

export function stationSpatialSnapshot({
  missionType,
  missionRuntime = {},
  config = {},
  fighters = [],
  hazards = [],
  researchContainer = null,
  laneCenters = DEFAULT_LANE_CENTERS,
  eventIndex = 0,
  timelineLength = 0,
  pendingSpawnCount = 0,
} = {}) {
  const lanes = Array.isArray(laneCenters) && laneCenters.length === 3
    ? laneCenters.map((value, index) => finite(value, DEFAULT_LANE_CENTERS[index]))
    : [...DEFAULT_LANE_CENTERS];
  const humans = fighters.filter(combatHuman);
  const enemies = fighters.filter(unresolvedEnemy);
  const gateEaters = fighters.filter((fighter) => living(fighter) && fighter.kind === "gate-eater");
  const humanIds = humans.map(entityId).filter((id) => id !== null);
  const base = {
    humanCount: humans.length,
    unresolvedEnemyCount: enemies.length,
    wavesResolved: integer(eventIndex) >= integer(timelineLength)
      && integer(pendingSpawnCount) === 0
      && enemies.length === 0,
  };

  if (missionType === STATION_MISSION_TYPES.ESCORT) {
    const cartLane = [0, 1, 2].includes(config.cartLane) ? config.cartLane : 1;
    const cartX = escortCartX(missionRuntime, config);
    const cartY = lanes[cartLane];
    const escortRadiusX = positive(config.escortRadiusX, 110);
    const escortRadiusY = positive(config.escortRadiusY, 48);
    const threatRadiusX = positive(config.threatRadiusX, 90);
    const threatRadiusY = positive(config.threatRadiusY, 55);
    return frozen({
      ...base,
      cartX,
      escortCount: humans.filter((human) => pointInEllipse(
        human,
        cartX,
        cartY,
        escortRadiusX,
        escortRadiusY,
      )).length,
      nearbyThreats: enemies.filter((enemy) => pointInEllipse(
        enemy,
        cartX,
        cartY,
        threatRadiusX,
        threatRadiusY,
      )).length,
      contaminated: hazards.some((hazard) => hazard?.active === true
        && hazard.lane === cartLane
        && pointInEllipse(
          { x: cartX, y: cartY },
          finite(hazard.centerX),
          finite(hazard.centerY),
          positive(hazard.radiusX, 1) + 26,
          positive(hazard.radiusY, 1) + 20,
        )),
    });
  }

  if (missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL) {
    const node = currentPowerNode(missionRuntime, config);
    const powerOperatorCount = node
      ? humans.filter((human) => pointInEllipse(
        human,
        node.x,
        lanes[node.lane],
        node.radiusX,
        node.radiusY,
      )).length
      : 0;
    const powerLaneThreats = node
      ? enemies.filter((enemy) => pointInEllipse(
        enemy,
        node.x,
        lanes[node.lane],
        node.radiusX,
        node.radiusY,
      )).length
      : 0;
    const returnedHumans = humans.filter((human) => inSharedLaneReturnZone(human, config, lanes));
    const returnedUnitIds = returnedHumans.map(entityId).filter((id) => id !== null);
    const escapeRouteThreats = enemies.filter((enemy) => inSharedLaneReturnZone(enemy, config, lanes)).length;
    const gateEaterContained = missionRuntime.gateEaterContained === true
      || gateEaters.some((fighter) => fighter.contained === true);
    const container = researchContainer ?? createResearchContainerRuntime(config);
    return frozen({
      ...base,
      powerOperatorCount,
      powerLaneThreats,
      gateEaterSeen: missionRuntime.gateEaterSeen === true || gateEaters.length > 0,
      gateEaterContained,
      researchContainerExposed: missionRuntime.researchContainerExposed === true
        || container.exposed === true,
      researchContainerContained: missionRuntime.researchContainerContained === true
        || container.contained === true,
      activeUnitIds: frozen(humanIds),
      returnedUnitIds: frozen(returnedUnitIds),
      returnedCount: returnedHumans.length,
      returnTargetCount: humans.length,
      escapeRouteThreats,
    });
  }

  return frozen(base);
}
