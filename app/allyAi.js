import {
  canAcquireCombatTarget,
  canNormalAttackTarget,
  combatHitboxesOverlap,
} from "./combatLifecycle.js";

export const ALLY_AI_INTENTS = Object.freeze({
  HOLD_POSITION: "hold-position",
  HOLD_DEFENSE: "hold-defense",
  RETURN_TO_DEFENSE: "return-to-defense",
  ADVANCE_DEFENSE_LINE: "advance-defense-line",
  HOLD_DEFENSE_LINE: "hold-defense-line",
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
  targetRadius = 0,
  verticalDistance = 0,
} = {}) {
  const origin = finite(fromX);
  const target = finite(targetX, origin);
  const range = nonNegative(attackRange);
  const contact = nonNegative(contactRange, 24);
  const isRanged = typeof ranged === "boolean" ? ranged : range > meleeThreshold;
  const padding = nonNegative(rangePadding, 10);
  const bufferedReach = Math.max(contact, range + nonNegative(targetRadius) - padding);
  const vertical = nonNegative(verticalDistance);
  const horizontalReach = vertical > 0
    ? Math.sqrt(Math.max(0, bufferedReach * bufferedReach - vertical * vertical))
    : bufferedReach;
  const standOff = isRanged ? horizontalReach : Math.min(contact, horizontalReach);
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
  attackable = false,
  overlapping = false,
  blocksPath = false,
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
    attackable,
    overlapping,
    blocksPath,
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

function normalizedCombatants(unit, enemy) {
  const attacker = {
    ...unit,
    side: unit.side ?? "human",
    range: unit.attackRange ?? unit.range,
    allowAdjacentLaneTargets: unit.allowAdjacentLaneTargets ?? unit.ranged === true,
  };
  const target = {
    ...enemy,
    side: enemy.side ?? "zombie",
  };
  if (!Number.isFinite(target.y)
    && Number.isFinite(attacker.y)
    && Number.isFinite(enemy.verticalDistance)) {
    target.y = attacker.y + nonNegative(enemy.verticalDistance);
  }
  return { attacker, target };
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
    const attackingCrawler = enemy.attackingCrawler === true || enemy.threatensBase === true;
    const sameLane = laneMatches(unit.lane, enemy.lane);
    const assignedLaneThreat = attackingCrawler
      && validLane(unit.assignedLane)
      && unit.assignedLane === enemy.lane;
    const { attacker, target } = normalizedCombatants(unit, enemy);
    const acquisitionAttacker = assignedLaneThreat && !sameLane
      ? { ...attacker, lane: unit.assignedLane }
      : attacker;
    const laneEligible = canAcquireCombatTarget({
      attacker: acquisitionAttacker,
      target,
      hasLineOfSight,
    });
    if (!laneEligible) continue;
    const distance = Math.abs(enemy.x - unit.x);
    const attackable = canNormalAttackTarget({ attacker, target, hasLineOfSight });
    const overlapping = enemy.hitboxOverlapping === true || combatHitboxesOverlap({
      left: attacker,
      right: target,
    });
    const contact = enemy.inContact === true
      || overlapping
      || (unit.ranged !== true && attackable);
    const blocksPath = enemy.blocksPath === true || enemy.pathBlocking === true;
    const local = sameLane && distance <= localThreatRadius;
    const claimed = claimCount(claims, enemy.id);
    const isPrevious = previousIntent?.targetId === enemy.id;
    const hardEngagement = attackingCrawler || contact || blocksPath || attackable;
    const claimAvailable = hardEngagement || local || isPrevious || claimed < maxPursuersPerEnemy;
    const threateningDefense = laneEligible
      && Math.min(distance, Math.abs(enemy.x - defenseAnchor)) <= defenseLeash;
    const eligible = missionType === "timed-defense"
      ? threateningDefense && claimAvailable
      : claimAvailable;
    if (!eligible) continue;
    candidates.push({
      enemy,
      local,
      sameLane,
      distance,
      claimed,
      isPrevious,
      attackingCrawler,
      attackable,
      overlapping,
      contact,
      blocksPath,
      baseThreatDistance: nonNegative(enemy.baseThreatDistance, enemy.x),
      priority: finite(enemy.priorityScore ?? enemy.priority),
    });
  }
  candidates.sort((left, right) => Number(right.attackingCrawler) - Number(left.attackingCrawler)
    || (left.attackingCrawler && right.attackingCrawler
      ? left.baseThreatDistance - right.baseThreatDistance
      : 0)
    || Number(right.overlapping) - Number(left.overlapping)
    || Number(right.contact) - Number(left.contact)
    || Number(right.blocksPath) - Number(left.blocksPath)
    || Number(right.attackable) - Number(left.attackable)
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
  forwardAnchor = null,
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
  const forward = defenseAnchorFor(forwardAnchor, deploymentLane, anchor);
  const normalizedClaimLimit = Math.max(1, Math.floor(nonNegative(maxPursuersPerEnemy, 2)));

  // TAKUYA's defeat invalidates the old lock, but it never suppresses living
  // stragglers or reinforcements. The next decision uses the current enemy set.
  const currentEnemies = liveEnemies(enemies);
  const urgentEnemies = currentEnemies.filter((enemy) => (
    enemy.attackingCrawler === true || enemy.threatensBase === true
  ));
  const candidateEnemies = laneTransitioning
    ? currentEnemies.filter((enemy) => {
      if (urgentEnemies.includes(enemy)) return true;
      const { attacker, target } = normalizedCombatants(unit, enemy);
      return enemy.hitboxOverlapping === true || combatHitboxesOverlap({ left: attacker, right: target });
    })
    : enemies;
  const selected = selectEnemy({
    enemies: candidateEnemies,
    unit: { ...unit, x: unitX, assignedLane: deploymentLane },
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
    const verticalDistance = Number.isFinite(selected.enemy.verticalDistance)
      ? selected.enemy.verticalDistance
      : Number.isFinite(unit.y) && Number.isFinite(selected.enemy.y)
        ? Math.abs(unit.y - selected.enemy.y)
        : 0;
    const desiredX = selected.attackable || selected.overlapping
      ? unitX
      : destinationWithinRange({
        fromX: unitX,
        targetX: selected.enemy.x,
        attackRange: unit.attackRange ?? unit.range,
        contactRange: unit.contactRange ?? contactRange,
        rangePadding,
        ranged: unit.ranged,
        targetRadius: selected.enemy.bodyRadius,
        verticalDistance,
      });
    return resultForDestination({
      intent: ALLY_AI_INTENTS.INTERCEPT_ENEMY,
      reachedIntent: ALLY_AI_INTENTS.HOLD_RANGE,
      reason: selected.attackingCrawler
        ? "crawler-under-attack"
        : selected.overlapping
          ? "hitbox-overlap"
          : selected.contact
            ? "contact-enemy"
            : selected.blocksPath
              ? "path-blocker"
              : selected.attackable
                ? "attackable-enemy"
        : selected.local
          ? "local-threat"
          : selected.isPrevious
            ? "retain-target"
            : "claim-available",
      unitX,
      desiredX,
      previousIntent,
      deadband,
      target: selected.enemy,
      assignedLane: deploymentLane,
      destinationLane: validLane(selected.enemy.lane) ? selected.enemy.lane : deploymentLane,
      claimGranted: !selected.local
        && !selected.isPrevious
        && !selected.attackingCrawler
        && !selected.contact
        && !selected.blocksPath
        && !selected.attackable,
      takuyaDefeated,
      attackable: selected.attackable,
      overlapping: selected.overlapping,
      blocksPath: selected.blocksPath,
    });
  }

  if (missionType === "timed-defense") {
    return resultForDestination({
      intent: forward > anchor ? ALLY_AI_INTENTS.ADVANCE_DEFENSE_LINE : ALLY_AI_INTENTS.RETURN_TO_DEFENSE,
      reachedIntent: forward > anchor ? ALLY_AI_INTENTS.HOLD_DEFENSE_LINE : ALLY_AI_INTENTS.HOLD_DEFENSE,
      reason: forward > anchor ? "front-clear" : "defense-anchor",
      unitX,
      desiredX: forward,
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
      reason: takuyaDefeated && !farEnemiesExist
        ? "takuya-defeated-objective"
        : farEnemiesExist
          ? takuyaDefeated
            ? "post-takuya-claim-limit"
            : "objective-after-claim-limit"
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
    attackable: false,
    overlapping: false,
    blocksPath: false,
    releaseTarget: Boolean(previousIntent?.targetId),
    reassess: Boolean(takuyaDefeated && previousIntent?.targetId),
  });
}
