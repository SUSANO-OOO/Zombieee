export const ALLY_AI_INTENTS = Object.freeze({
  HOLD_POSITION: "hold-position",
  HOLD_DEFENSE: "hold-defense",
  RETURN_TO_DEFENSE: "return-to-defense",
  INTERCEPT_ENEMY: "intercept-enemy",
  HOLD_RANGE: "hold-range",
  ADVANCE_OBJECTIVE: "advance-objective",
  ATTACK_OBJECTIVE: "attack-objective",
});

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const nonNegative = (value, fallback = 0) => Math.max(0, finite(value, fallback));

function claimCount(claims, targetId) {
  if (claims instanceof Map) return nonNegative(claims.get(targetId));
  if (claims && typeof claims === "object") return nonNegative(claims[targetId]);
  return 0;
}

function defenseAnchorFor(defenseAnchor, lane, fallback) {
  if (Number.isFinite(defenseAnchor)) return defenseAnchor;
  if (defenseAnchor instanceof Map) return finite(defenseAnchor.get(lane), fallback);
  if (defenseAnchor && typeof defenseAnchor === "object") return finite(defenseAnchor[lane], fallback);
  return fallback;
}

function laneMatches(unitLane, targetLane) {
  return unitLane === undefined || targetLane === undefined || unitLane === targetLane;
}

function validLane(value) {
  return Number.isInteger(value) && value >= 0 && value <= 2;
}

function assignedLaneFor(unit, assignedLane) {
  for (const candidate of [assignedLane, unit?.assignedLane, unit?.anchorLane, unit?.lane]) {
    if (validLane(candidate)) return candidate;
  }
  return 1;
}

export function destinationWithinRange({
  fromX,
  targetX,
  attackRange = 0,
  contactRange = 24,
  rangePadding = 10,
  ranged,
  meleeThreshold = 64,
} = {}) {
  const origin = finite(fromX);
  const target = finite(targetX, origin);
  const range = nonNegative(attackRange);
  const contact = nonNegative(contactRange, 24);
  const isRanged = typeof ranged === "boolean" ? ranged : range > meleeThreshold;
  const standOff = isRanged ? Math.max(contact, range - nonNegative(rangePadding, 10)) : contact;
  if (Math.abs(target - origin) <= standOff) return origin;
  const direction = Math.sign(target - origin) || 1;
  return target - direction * standOff;
}

function movementWithDeadband({ currentX, desiredX, previousIntent, deadband }) {
  const delta = desiredX - currentX;
  const band = nonNegative(deadband, 8);
  if (Math.abs(delta) <= band) {
    return { destinationX: currentX, desiredX, moveDirection: 0, reached: true, deadbandHeld: true };
  }
  const direction = Math.sign(delta);
  const previousDirection = finite(previousIntent?.moveDirection);
  const previousDestination = finite(previousIntent?.desiredX ?? previousIntent?.destinationX, desiredX);
  const smallReversal = previousDirection !== 0
    && direction !== previousDirection
    && Math.abs(desiredX - previousDestination) <= band * 2;
  if (smallReversal) {
    return { destinationX: currentX, desiredX, moveDirection: 0, reached: false, deadbandHeld: true };
  }
  return { destinationX: desiredX, desiredX, moveDirection: direction, reached: false, deadbandHeld: false };
}

function resultForDestination({
  intent,
  reachedIntent,
  reason,
  unitX,
  desiredX,
  previousIntent,
  deadband,
  target = null,
  assignedLane,
  destinationLane = assignedLane,
  claimGranted = false,
  takuyaDefeated = false,
}) {
  const movement = movementWithDeadband({ currentX: unitX, desiredX, previousIntent, deadband });
  const targetId = target?.id ?? null;
  const previousTargetId = previousIntent?.targetId ?? null;
  return Object.freeze({
    intent: movement.reached ? reachedIntent : intent,
    reason,
    targetId,
    destinationX: movement.destinationX,
    desiredX: movement.desiredX,
    assignedLane,
    destinationLane: validLane(destinationLane) ? destinationLane : assignedLane,
    moveDirection: movement.moveDirection,
    reached: movement.reached,
    deadbandHeld: movement.deadbandHeld,
    claimGranted,
    releaseTarget: Boolean(previousTargetId && previousTargetId !== targetId),
    reassess: Boolean(takuyaDefeated && previousTargetId),
  });
}

function liveEnemies(enemies) {
  return (Array.isArray(enemies) ? enemies : []).filter((enemy) => enemy
    && enemy.id !== undefined
    && Number.isFinite(enemy.x)
    && enemy.alive !== false
    && !(Number.isFinite(enemy.hp) && enemy.hp <= 0));
}

function selectEnemy({
  enemies,
  unit,
  missionType,
  claims,
  previousIntent,
  defenseAnchor,
  localThreatRadius,
  defenseLeash,
  maxPursuersPerEnemy,
  hasLineOfSight,
}) {
  const candidates = [];
  for (const enemy of liveEnemies(enemies)) {
    const sameLane = laneMatches(unit.lane, enemy.lane);
    const laneDistance = Number.isInteger(unit.lane) && Number.isInteger(enemy.lane)
      ? Math.abs(unit.lane - enemy.lane)
      : 0;
    const adjacentLaneVisible = unit.ranged === true
      && laneDistance === 1
      && (typeof hasLineOfSight === "function"
        ? hasLineOfSight(unit, enemy) === true
        : hasLineOfSight === true);
    const laneEligible = sameLane || adjacentLaneVisible;
    if (!laneEligible) continue;
    const distance = Math.abs(enemy.x - unit.x);
    const contact = unit.ranged !== true
      && sameLane
      && distance <= nonNegative(unit.contactRange, Math.max(48, nonNegative(unit.attackRange ?? unit.range) + 16));
    const local = sameLane && distance <= localThreatRadius;
    const claimed = claimCount(claims, enemy.id);
    const isPrevious = previousIntent?.targetId === enemy.id;
    const claimAvailable = local || isPrevious || claimed < maxPursuersPerEnemy;
    const threateningDefense = laneEligible
      && Math.min(distance, Math.abs(enemy.x - defenseAnchor)) <= defenseLeash;
    const eligible = missionType === "timed-defense"
      ? threateningDefense && claimAvailable
      : claimAvailable;
    if (!eligible) continue;
    candidates.push({
      enemy,
      contact,
      local,
      sameLane,
      distance,
      claimed,
      isPrevious,
      priority: finite(enemy.priorityScore ?? enemy.priority),
    });
  }
  candidates.sort((left, right) => Number(right.contact) - Number(left.contact)
    || Number(right.local) - Number(left.local)
    || Number(right.isPrevious) - Number(left.isPrevious)
    || right.priority - left.priority
    || Number(right.sameLane) - Number(left.sameLane)
    || left.distance - right.distance
    || String(left.enemy.id).localeCompare(String(right.enemy.id)));
  return candidates[0] ?? null;
}

export function decideAllyIntent({
  missionType = "assault",
  unit = {},
  enemies = [],
  objective = null,
  defenseAnchor = null,
  assignedLane,
  claims = {},
  previousIntent = null,
  laneTransitioning = false,
  takuyaDefeated = false,
  maxPursuersPerEnemy = 2,
  localThreatRadius = 150,
  defenseLeash = 220,
  deadband = 8,
  contactRange = 24,
  rangePadding = 10,
  hasLineOfSight,
} = {}) {
  const unitX = finite(unit.x);
  const objectiveX = Number.isFinite(objective) ? objective : finite(objective?.x, NaN);
  const objectiveActive = Number.isFinite(objectiveX) && objective?.active !== false;
  const deploymentLane = assignedLaneFor(unit, assignedLane);
  const anchor = defenseAnchorFor(defenseAnchor, deploymentLane, unitX);
  const normalizedClaimLimit = Math.max(1, Math.floor(nonNegative(maxPursuersPerEnemy, 2)));

  // TAKUYA's defeat is a hard phase boundary: stale enemy locks are released and
  // every ally reevaluates the now-vulnerable infection base as its objective.
  const forceObjective = Boolean(takuyaDefeated && objectiveActive);
  const selected = forceObjective || laneTransitioning ? null : selectEnemy({
    enemies,
    unit: { ...unit, x: unitX },
    missionType,
    claims,
    previousIntent,
    defenseAnchor: anchor,
    localThreatRadius: nonNegative(localThreatRadius, 150),
    defenseLeash: nonNegative(defenseLeash, 220),
    maxPursuersPerEnemy: normalizedClaimLimit,
    hasLineOfSight,
  });

  if (selected) {
    const desiredX = destinationWithinRange({
      fromX: unitX,
      targetX: selected.enemy.x,
      attackRange: unit.attackRange ?? unit.range,
      contactRange: unit.contactRange ?? contactRange,
      rangePadding,
      ranged: unit.ranged,
    });
    return resultForDestination({
      intent: ALLY_AI_INTENTS.INTERCEPT_ENEMY,
      reachedIntent: ALLY_AI_INTENTS.HOLD_RANGE,
      reason: selected.local ? "local-threat" : selected.isPrevious ? "retain-target" : "claim-available",
      unitX,
      desiredX,
      previousIntent,
      deadband,
      target: selected.enemy,
      assignedLane: deploymentLane,
      destinationLane: validLane(selected.enemy.lane) ? selected.enemy.lane : deploymentLane,
      claimGranted: !selected.local && !selected.isPrevious,
      takuyaDefeated,
    });
  }

  if (missionType === "timed-defense") {
    return resultForDestination({
      intent: ALLY_AI_INTENTS.RETURN_TO_DEFENSE,
      reachedIntent: ALLY_AI_INTENTS.HOLD_DEFENSE,
      reason: "defense-anchor",
      unitX,
      desiredX: anchor,
      previousIntent,
      deadband,
      assignedLane: deploymentLane,
      destinationLane: deploymentLane,
      takuyaDefeated,
    });
  }

  if (objectiveActive) {
    const desiredX = destinationWithinRange({
      fromX: unitX,
      targetX: objectiveX,
      attackRange: unit.attackRange ?? unit.range,
      contactRange: unit.contactRange ?? contactRange,
      rangePadding,
      ranged: unit.ranged,
    });
    const farEnemiesExist = liveEnemies(enemies).length > 0;
    return resultForDestination({
      intent: ALLY_AI_INTENTS.ADVANCE_OBJECTIVE,
      reachedIntent: ALLY_AI_INTENTS.ATTACK_OBJECTIVE,
      reason: forceObjective
        ? "takuya-defeated-objective"
        : farEnemiesExist
          ? "objective-after-claim-limit"
          : "objective-no-enemy",
      unitX,
      desiredX,
      previousIntent,
      deadband,
      assignedLane: deploymentLane,
      destinationLane: deploymentLane,
      takuyaDefeated,
    });
  }

  return Object.freeze({
    intent: ALLY_AI_INTENTS.HOLD_POSITION,
    reason: "no-valid-target",
    targetId: null,
    destinationX: unitX,
    desiredX: unitX,
    assignedLane: deploymentLane,
    destinationLane: deploymentLane,
    moveDirection: 0,
    reached: true,
    deadbandHeld: true,
    claimGranted: false,
    releaseTarget: Boolean(previousIntent?.targetId),
    reassess: Boolean(takuyaDefeated && previousIntent?.targetId),
  });
}
