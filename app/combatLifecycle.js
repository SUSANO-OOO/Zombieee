import { LANE_Y, UNIT_CARDS, WORLD_GEOMETRY, pointInGroundEffectEllipse } from "./gameRules.js";

const freeze = (value) => Object.freeze(value);

const LEGACY_COMBAT_DISTANCE = 800 - 188;
const EFFECTIVE_COMBAT_DISTANCE = WORLD_GEOMETRY.enemyBase.attackX - WORLD_GEOMETRY.baseX;

/**
 * Shared three-lane battlefield geometry for the 0.6.0 combat pass.
 *
 * The objective contact points are 25% farther apart than the 0.5.0 baseline,
 * while deployment remains inside the objectives so a wider field does not
 * turn into dead walking time. The Crawler may remain partly outside the left
 * edge, while the enemy objective stays fully visible inside the 960px canvas.
 */
export const COMBAT_GEOMETRY = freeze({
  canvasWidth: 960,
  canvasHeight: 540,
  laneCount: 3,
  laneY: freeze([...LANE_Y]),
  legacyCombatDistance: LEGACY_COMBAT_DISTANCE,
  effectiveCombatDistance: EFFECTIVE_COMBAT_DISTANCE,
  distanceExpansion: EFFECTIVE_COMBAT_DISTANCE / LEGACY_COMBAT_DISTANCE,
  friendlyObjectiveX: WORLD_GEOMETRY.baseX,
  enemyObjectiveX: WORLD_GEOMETRY.enemyBase.attackX,
  friendlyDeploymentX: WORLD_GEOMETRY.musterX,
  enemyCombatStartX: WORLD_GEOMETRY.enemyBase.enemySpawnMinX,
  friendlyBaseBounds: freeze({ x: WORLD_GEOMETRY.crawler.x, width: WORLD_GEOMETRY.crawler.width }),
  enemyBaseBounds: freeze({ x: WORLD_GEOMETRY.enemyBase.drawX, width: WORLD_GEOMETRY.enemyBase.width }),
});

export const COMBAT_CONFIG = freeze({
  geometry: COMBAT_GEOMETRY,
  movement: freeze({
    speedMultiplier: 1,
    spawnGraceSeconds: 0.95,
    supportMaxSeparation: 150,
    supportTrailingDistance: 38,
  }),
  ranges: freeze(Object.fromEntries(UNIT_CARDS.map(({ kind, range }) => [kind, range]))),
});

export const COMBAT_ROLE_RULES = freeze({
  scout: freeze({ attackType: "melee", allowAdjacentLaneTargets: false }),
  brute: freeze({ attackType: "melee", allowAdjacentLaneTargets: false }),
  brawler: freeze({ attackType: "melee", allowAdjacentLaneTargets: false }),
  walker: freeze({ attackType: "melee", allowAdjacentLaneTargets: false }),
  runner: freeze({ attackType: "melee", allowAdjacentLaneTargets: false }),
  crusher: freeze({ attackType: "melee", allowAdjacentLaneTargets: false }),
  abomination: freeze({ attackType: "melee", allowAdjacentLaneTargets: false }),
  shade: freeze({ attackType: "melee", allowAdjacentLaneTargets: false }),
  takuya: freeze({ attackType: "melee", allowAdjacentLaneTargets: false }),
  turned: freeze({ attackType: "melee", allowAdjacentLaneTargets: false }),
  ranger: freeze({ attackType: "ranged", allowAdjacentLaneTargets: true }),
  gunner: freeze({ attackType: "ranged", allowAdjacentLaneTargets: true }),
  medic: freeze({ attackType: "ranged", allowAdjacentLaneTargets: false }),
  spitter: freeze({ attackType: "ranged", allowAdjacentLaneTargets: true }),
  "crazy-king": freeze({ attackType: "melee", allowAdjacentLaneTargets: false }),
  kumaverson: freeze({ attackType: "melee", allowAdjacentLaneTargets: false }),
  babayaga: freeze({ attackType: "ranged", allowAdjacentLaneTargets: true }),
});

const NON_TARGETABLE_STATES = new Set([
  "dying",
  "corpse",
  "ashing",
  "removed",
  "ally-corpse",
  "infection-warning",
  "burning",
  "ash",
]);

const REMOVABLE_ENEMY_STATES = new Set(["corpse", "ashing"]);
const BURNABLE_ALLY_STATES = new Set(["dying", "ally-corpse", "infection-warning"]);
const FIRE_KINDS = new Set(["fire", "burn", "incendiary"]);

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function nonNegativeSeconds(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError("seconds must be a finite non-negative number");
  return seconds;
}

function entityY(entity) {
  if (Number.isFinite(entity?.y)) return entity.y;
  const lane = Number.isInteger(entity?.lane) ? entity.lane : 1;
  return COMBAT_GEOMETRY.laneY[lane] ?? COMBAT_GEOMETRY.laneY[1];
}

export function combatDistance(left, right) {
  return Math.hypot(finiteNumber(left?.x) - finiteNumber(right?.x), entityY(left) - entityY(right));
}

export function isCombatTargetable(entity) {
  if (!entity || entity.targetable === false || entity.combatReady === false) return false;
  if (Number.isFinite(entity.hp) && entity.hp <= 0) return false;
  return !NON_TARGETABLE_STATES.has(entity.state);
}

export function isCombatBlocking(entity) {
  if (!entity || entity.blocking === false || entity.blocksMovement === false) return false;
  if (Number.isFinite(entity.hp) && entity.hp <= 0) return false;
  return !NON_TARGETABLE_STATES.has(entity.state);
}

function roleRuleFor(attacker, roleRules) {
  const role = attacker?.role ?? attacker?.kind;
  const configured = roleRules?.[role] ?? COMBAT_ROLE_RULES[role] ?? {};
  return {
    attackType: attacker?.attackType
      ?? configured.attackType
      ?? (attacker?.ranged === true ? "ranged" : "melee"),
    allowAdjacentLaneTargets: attacker?.allowAdjacentLaneTargets
      ?? attacker?.allowAdjacentLanes
      ?? configured.allowAdjacentLaneTargets
      ?? false,
  };
}

function lineOfSightResult(hasLineOfSight, attacker, target, required) {
  if (typeof hasLineOfSight === "function") return hasLineOfSight(attacker, target) === true;
  if (typeof hasLineOfSight === "boolean") return hasLineOfSight;
  return !required;
}

/**
 * Checks whether a target is legal for this attacker's normal-attack search.
 * Range is deliberately excluded so pursuit and firing share every other
 * eligibility rule: lifecycle, side, lane, role and line of sight.
 */
export function canAcquireCombatTarget({ attacker, target, roleRules, hasLineOfSight } = {}) {
  if (!attacker || !target || attacker.id === target.id || !isCombatTargetable(target)) return false;
  if (attacker.side && target.side && attacker.side === target.side) return false;

  // A lane index is a routing intent, not a license to walk through a body.
  // During lane transitions the rendered hitboxes can overlap before the
  // logical lane flips; physical hostile contact therefore outranks the lane
  // gate for both search and the eventual attack transaction.
  if (combatHitboxesOverlap({ left: attacker, right: target })) return true;
  if (!Number.isInteger(attacker.lane) || !Number.isInteger(target.lane)) return false;

  const laneDistance = Math.abs(attacker.lane - target.lane);
  if (laneDistance > 1) return false;

  const rule = roleRuleFor(attacker, roleRules);
  if (rule.attackType === "melee" && laneDistance !== 0) return false;
  if (rule.attackType === "ranged" && laneDistance === 1) {
    if (!rule.allowAdjacentLaneTargets) return false;
    if (!lineOfSightResult(hasLineOfSight, attacker, target, true)) return false;
  } else if (!lineOfSightResult(hasLineOfSight, attacker, target, false)) return false;

  return true;
}

/**
 * Checks normal-attack eligibility. Melee never changes lane. Ranged attacks
 * prefer the same lane and may use one adjacent lane only when both the role
 * and an explicit line-of-sight result allow it. Two-lane shots are rejected.
 */
export function canNormalAttackTarget({ attacker, target, roleRules, hasLineOfSight } = {}) {
  if (!canAcquireCombatTarget({ attacker, target, roleRules, hasLineOfSight })) return false;
  if (combatHitboxesOverlap({ left: attacker, right: target })) return true;
  const reach = Math.max(0, finiteNumber(attacker.range)) + Math.max(0, finiteNumber(target.bodyRadius));
  return combatDistance(attacker, target) <= reach;
}

/** True only while the two rendered combat body circles physically overlap. */
export function combatHitboxesOverlap({ left, right, padding = 0 } = {}) {
  if (!left || !right) return false;
  const combinedRadius = Math.max(0, finiteNumber(left.bodyRadius))
    + Math.max(0, finiteNumber(right.bodyRadius))
    + Math.max(0, finiteNumber(padding));
  return combinedRadius > 0 && combatDistance(left, right) <= combinedRadius;
}

export function hasAdjacentLaneLineOfSight({ attacker, target, blockers = [] } = {}) {
  if (!attacker || !target) return false;
  if (Math.abs(finiteNumber(attacker.lane) - finiteNumber(target.lane)) === 0) return true;
  const ax = finiteNumber(attacker.x);
  const ay = entityY(attacker);
  const tx = finiteNumber(target.x);
  const ty = entityY(target);
  const dx = tx - ax;
  const dy = ty - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0) return false;
  return !blockers.some((blocker) => {
    if (!blocker || blocker.id === attacker.id || blocker.id === target.id) return false;
    if (blocker.phase && !["active", "impact"].includes(blocker.phase)) return false;
    if (Number.isFinite(blocker.hp) && blocker.hp <= 0) return false;
    if (blocker.combatReady === false || blocker.targetable === false) return false;
    const bx = finiteNumber(blocker.x);
    const by = entityY(blocker);
    const projection = Math.max(0, Math.min(1, ((bx - ax) * dx + (by - ay) * dy) / lengthSquared));
    if (projection <= .04 || projection >= .96) return false;
    const closestX = ax + projection * dx;
    const closestY = ay + projection * dy;
    const clearance = Math.max(9, finiteNumber(blocker.bodyRadius, blocker.kind ? 16 : 22) * .72);
    return Math.hypot(bx - closestX, by - closestY) <= clearance;
  });
}

/**
 * Returns the actual chosen candidate (not a copy or only an id). Same-lane
 * targets always outrank adjacent-lane targets; callers can add a deterministic
 * role/threat score inside each lane tier with targetPriority.
 */
export function selectCombatTarget({
  attacker,
  candidates = [],
  roleRules,
  hasLineOfSight,
  targetPriority = () => 0,
} = {}) {
  const eligible = candidates.filter((target) => canNormalAttackTarget({
    attacker,
    target,
    roleRules,
    hasLineOfSight,
  }));

  eligible.sort((left, right) => {
    const leftLane = Math.abs(attacker.lane - left.lane);
    const rightLane = Math.abs(attacker.lane - right.lane);
    if (leftLane !== rightLane) return leftLane - rightLane;
    const priorityDifference = finiteNumber(targetPriority(left, attacker)) - finiteNumber(targetPriority(right, attacker));
    if (priorityDifference !== 0) return priorityDifference;
    const distanceDifference = combatDistance(attacker, left) - combatDistance(attacker, right);
    if (distanceDifference !== 0) return distanceDifference;
    const leftLocked = left.id === attacker.targetId ? 0 : 1;
    const rightLocked = right.id === attacker.targetId ? 0 : 1;
    if (leftLocked !== rightLocked) return leftLocked - rightLocked;
    return String(left.id).localeCompare(String(right.id));
  });

  return eligible[0] ?? null;
}

/**
 * Produces one immutable attack transaction from one selected target. Both the
 * projectile and damage payload carry that same id, preventing retargeting
 * between shot creation and damage application.
 */
export function createAttackTransaction({
  attacker,
  candidates = [],
  damage = attacker?.damage ?? 0,
  roleRules,
  hasLineOfSight,
  targetPriority,
} = {}) {
  const target = selectCombatTarget({ attacker, candidates, roleRules, hasLineOfSight, targetPriority });
  if (!target) return null;
  const targetId = target.id;
  const amount = Math.max(0, finiteNumber(typeof damage === "function" ? damage(attacker, target) : damage));
  return freeze({
    attackerId: attacker.id,
    target,
    targetId,
    projectile: freeze({
      sourceId: attacker.id,
      targetId,
      from: freeze({ x: finiteNumber(attacker.x), y: entityY(attacker) }),
      to: freeze({ x: finiteNumber(target.x), y: entityY(target) }),
    }),
    damage: freeze({ sourceId: attacker.id, targetId, amount }),
  });
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

/**
 * Gives support AI a stable, outlier-resistant group anchor and regroup point.
 * The returned anchor is an existing ally so support visuals and effects can
 * refer to the same identity.
 */
export function supportCohesion({
  support,
  allies = [],
  maxSeparation = COMBAT_CONFIG.movement.supportMaxSeparation,
  trailingDistance = COMBAT_CONFIG.movement.supportTrailingDistance,
  forwardDirection = support?.side === "zombie" ? -1 : 1,
} = {}) {
  if (!support) return null;
  const formation = allies.filter((ally) => ally.id !== support.id
    && (!support.side || !ally.side || ally.side === support.side)
    && isCombatTargetable(ally));
  if (formation.length === 0) return null;

  const center = { x: median(formation.map(({ x }) => finiteNumber(x))), y: median(formation.map(entityY)) };
  const anchor = [...formation].sort((left, right) => {
    const leftDistance = Math.hypot(finiteNumber(left.x) - center.x, entityY(left) - center.y);
    const rightDistance = Math.hypot(finiteNumber(right.x) - center.x, entityY(right) - center.y);
    return leftDistance - rightDistance || String(left.id).localeCompare(String(right.id));
  })[0];
  const separation = Math.hypot(finiteNumber(support.x) - center.x, entityY(support) - center.y);

  return freeze({
    anchor,
    anchorId: anchor.id,
    center: freeze(center),
    separation,
    needsRegroup: separation > maxSeparation,
    destination: freeze({
      x: center.x - forwardDirection * trailingDistance,
      y: center.y,
      lane: anchor.lane,
    }),
  });
}

export const ENEMY_DEATH_CONFIG = freeze({
  timings: freeze({
    normal: freeze({ dyingSeconds: 0.42, corpseSeconds: 4.8, ashingSeconds: 1.45 }),
    heavy: freeze({ dyingSeconds: 0.68, corpseSeconds: 6.2, ashingSeconds: 1.9 }),
    boss: freeze({ dyingSeconds: 1.15, corpseSeconds: 8, ashingSeconds: 2.5 }),
  }),
  caps: freeze({ maxVisible: 36, maxPerLane: 14, offscreenMargin: 80 }),
});

export function enemyDeathClassFor(enemy = {}) {
  if (enemy.deathClass && ENEMY_DEATH_CONFIG.timings[enemy.deathClass]) return enemy.deathClass;
  if (enemy.boss || enemy.kind === "takuya") return "boss";
  if (["crusher", "abomination", "heavy"].includes(enemy.kind)) return "heavy";
  return "normal";
}

export function createEnemyLifecycle(enemy = {}) {
  return {
    ...enemy,
    side: enemy.side ?? "zombie",
    state: "alive",
    deathClass: enemyDeathClassFor(enemy),
    phaseElapsed: 0,
    deathAge: 0,
    targetable: true,
    blocking: true,
    removalReason: null,
  };
}

export function beginEnemyDeath(lifecycle) {
  if (!lifecycle || lifecycle.state !== "alive") return lifecycle;
  return {
    ...lifecycle,
    state: "dying",
    phaseElapsed: 0,
    deathAge: 0,
    targetable: false,
    blocking: false,
    removalReason: null,
  };
}

function enemyTimingFor(lifecycle, timings) {
  return timings?.[lifecycle.deathClass]
    ?? ENEMY_DEATH_CONFIG.timings[lifecycle.deathClass]
    ?? ENEMY_DEATH_CONFIG.timings.normal;
}

function removeEnemyLifecycle(lifecycle, removalReason) {
  return {
    ...lifecycle,
    state: "removed",
    phaseElapsed: 0,
    targetable: false,
    blocking: false,
    removalReason,
  };
}

export function advanceEnemyLifecycle(lifecycle, seconds, { paused = false, offscreen = false, timings } = {}) {
  const delta = nonNegativeSeconds(seconds);
  if (!lifecycle || paused || delta === 0 || lifecycle.state === "alive" || lifecycle.state === "removed") return lifecycle;
  if (offscreen && REMOVABLE_ENEMY_STATES.has(lifecycle.state)) return removeEnemyLifecycle(lifecycle, "offscreen");

  const timing = enemyTimingFor(lifecycle, timings);
  const durations = {
    dying: Math.max(0, finiteNumber(timing.dyingSeconds)),
    corpse: Math.max(0, finiteNumber(timing.corpseSeconds)),
    ashing: Math.max(0, finiteNumber(timing.ashingSeconds)),
  };
  const following = { dying: "corpse", corpse: "ashing", ashing: "removed" };
  let remaining = delta;
  let next = { ...lifecycle, targetable: false, blocking: false };

  while (remaining > 0 && next.state !== "removed") {
    const duration = durations[next.state];
    if (duration === undefined) break;
    const untilTransition = Math.max(0, duration - finiteNumber(next.phaseElapsed));
    const elapsed = Math.min(remaining, untilTransition);
    next.phaseElapsed = finiteNumber(next.phaseElapsed) + elapsed;
    next.deathAge = finiteNumber(next.deathAge) + elapsed;
    remaining -= elapsed;
    if (next.phaseElapsed + 1e-9 < duration) break;
    const state = following[next.state];
    next = state === "removed"
      ? removeEnemyLifecycle(next, "elapsed")
      : { ...next, state, phaseElapsed: 0 };
    if (untilTransition === 0 && duration > 0) break;
  }

  return next;
}

function defaultOffscreen(enemy, margin) {
  return finiteNumber(enemy.x) < -margin || finiteNumber(enemy.x) > COMBAT_GEOMETRY.canvasWidth + margin;
}

/** Safely removes only already non-targetable corpse/ash visuals. */
export function enforceEnemyCorpseCaps(lifecycles = [], {
  maxVisible = ENEMY_DEATH_CONFIG.caps.maxVisible,
  maxPerLane = ENEMY_DEATH_CONFIG.caps.maxPerLane,
  offscreenMargin = ENEMY_DEATH_CONFIG.caps.offscreenMargin,
  isOffscreen = (enemy) => defaultOffscreen(enemy, offscreenMargin),
} = {}) {
  const result = lifecycles.map((lifecycle) => REMOVABLE_ENEMY_STATES.has(lifecycle.state) && isOffscreen(lifecycle)
    ? removeEnemyLifecycle(lifecycle, "offscreen")
    : lifecycle);
  const visible = () => result
    .map((lifecycle, index) => ({ lifecycle, index }))
    .filter(({ lifecycle }) => REMOVABLE_ENEMY_STATES.has(lifecycle.state));
  const oldestFirst = (left, right) => {
    const leftBoss = left.lifecycle.deathClass === "boss" ? 1 : 0;
    const rightBoss = right.lifecycle.deathClass === "boss" ? 1 : 0;
    return leftBoss - rightBoss
      || finiteNumber(right.lifecycle.deathAge) - finiteNumber(left.lifecycle.deathAge)
      || finiteNumber(left.lifecycle.sequence, left.index) - finiteNumber(right.lifecycle.sequence, right.index);
  };
  const removeOverflow = (entries, limit, reason) => {
    const overflow = Math.max(0, entries.length - Math.max(0, Math.floor(limit)));
    for (const { index } of [...entries].sort(oldestFirst).slice(0, overflow)) {
      result[index] = removeEnemyLifecycle(result[index], reason);
    }
  };

  for (let lane = 0; lane < COMBAT_GEOMETRY.laneCount; lane += 1) {
    removeOverflow(visible().filter(({ lifecycle }) => lifecycle.lane === lane), maxPerLane, "lane-cap");
  }
  removeOverflow(visible(), maxVisible, "total-cap");
  return result;
}

export function retainEnemyLifecycleVisuals(lifecycles = []) {
  return lifecycles.filter(({ state }) => state !== "removed");
}

export const ALLY_DEATH_CONFIG = freeze({
  dyingSeconds: 0.55,
  infectionSeconds: 12,
  lightWarningRemaining: 6,
  strongWarningRemaining: 3,
  riseLockSeconds: 0.75,
  burningSeconds: 2,
});

export function createAllyLifecycle(ally = {}) {
  return {
    ...ally,
    side: ally.side ?? "human",
    state: "alive",
    phaseElapsed: 0,
    deathAge: 0,
    infectionRemaining: null,
    infectionPrevented: false,
    warningLevel: "none",
    riseLockRemaining: 0,
    targetable: true,
    blocking: true,
    canAct: true,
  };
}

export function beginAllyDeath(lifecycle, config = ALLY_DEATH_CONFIG) {
  if (!lifecycle || lifecycle.state !== "alive") return lifecycle;
  return {
    ...lifecycle,
    state: "dying",
    phaseElapsed: 0,
    deathAge: 0,
    infectionRemaining: Math.max(0, finiteNumber(config.infectionSeconds, ALLY_DEATH_CONFIG.infectionSeconds)),
    infectionPrevented: false,
    warningLevel: "none",
    riseLockRemaining: 0,
    targetable: false,
    blocking: false,
    canAct: false,
  };
}

export function allyInfectionWarning(lifecycle, config = ALLY_DEATH_CONFIG) {
  if (!lifecycle || lifecycle.state !== "infection-warning") return "none";
  return lifecycle.infectionRemaining <= config.strongWarningRemaining ? "strong" : "light";
}

/**
 * Creates the deliberately minimal identity used when a fallen ally rises.
 * Callers merge this with generic-zombie stats; no weapon, special, role, or
 * other character-specific combat capability can leak through this payload.
 */
export function createGenericZombieSpawn(lifecycle) {
  if (!lifecycle || lifecycle.state !== "generic-zombie") return null;
  return {
    id: lifecycle.id,
    sourceAllyId: lifecycle.id,
    side: "zombie",
    kind: "generic-zombie",
    combatKit: "generic-zombie",
    lane: lifecycle.lane,
    x: lifecycle.x,
    y: entityY(lifecycle),
    variant: lifecycle.variant,
    riseLockRemaining: lifecycle.riseLockRemaining,
    targetable: true,
    blocking: true,
    canAct: lifecycle.canAct,
  };
}

export function igniteAllyCorpse(lifecycle) {
  if (!lifecycle || lifecycle.side !== "human" || !BURNABLE_ALLY_STATES.has(lifecycle.state)) return lifecycle;
  return {
    ...lifecycle,
    state: "burning",
    phaseElapsed: 0,
    infectionRemaining: null,
    infectionPrevented: true,
    warningLevel: "none",
    riseLockRemaining: 0,
    targetable: false,
    blocking: false,
    canAct: false,
  };
}

export function advanceAllyLifecycle(lifecycle, seconds, { paused = false, config = ALLY_DEATH_CONFIG } = {}) {
  const delta = nonNegativeSeconds(seconds);
  if (!lifecycle || paused || delta === 0 || lifecycle.state === "alive" || lifecycle.state === "ash") return lifecycle;

  if (lifecycle.state === "burning") {
    const phaseElapsed = finiteNumber(lifecycle.phaseElapsed) + delta;
    if (phaseElapsed + 1e-9 >= config.burningSeconds) {
      return {
        ...lifecycle,
        state: "ash",
        phaseElapsed: 0,
        infectionRemaining: null,
        infectionPrevented: true,
        warningLevel: "none",
        targetable: false,
        blocking: false,
        canAct: false,
      };
    }
    return { ...lifecycle, phaseElapsed };
  }

  if (lifecycle.state === "generic-zombie") {
    const riseLockRemaining = Math.max(0, finiteNumber(lifecycle.riseLockRemaining) - delta);
    return {
      ...lifecycle,
      phaseElapsed: finiteNumber(lifecycle.phaseElapsed) + delta,
      riseLockRemaining,
      targetable: true,
      blocking: true,
      canAct: riseLockRemaining <= 0,
    };
  }

  const infectionRemaining = Math.max(0, finiteNumber(lifecycle.infectionRemaining) - delta);
  const deathAge = finiteNumber(lifecycle.deathAge) + delta;
  if (infectionRemaining <= 0) {
    const timeAfterRise = Math.max(0, delta - finiteNumber(lifecycle.infectionRemaining));
    const riseLockRemaining = Math.max(0, config.riseLockSeconds - timeAfterRise);
    return {
      ...lifecycle,
      state: "generic-zombie",
      kind: "generic-zombie",
      inheritedKind: lifecycle.inheritedKind ?? lifecycle.kind,
      phaseElapsed: timeAfterRise,
      deathAge,
      infectionRemaining: 0,
      warningLevel: "none",
      riseLockRemaining,
      targetable: true,
      blocking: true,
      canAct: riseLockRemaining <= 0,
    };
  }

  if (deathAge < config.dyingSeconds) {
    return {
      ...lifecycle,
      state: "dying",
      phaseElapsed: deathAge,
      deathAge,
      infectionRemaining,
      targetable: false,
      blocking: false,
      canAct: false,
    };
  }

  if (infectionRemaining > config.lightWarningRemaining) {
    return {
      ...lifecycle,
      state: "ally-corpse",
      phaseElapsed: deathAge - config.dyingSeconds,
      deathAge,
      infectionRemaining,
      warningLevel: "none",
      targetable: false,
      blocking: false,
      canAct: false,
    };
  }

  const next = {
    ...lifecycle,
    state: "infection-warning",
    phaseElapsed: config.lightWarningRemaining - infectionRemaining,
    deathAge,
    infectionRemaining,
    targetable: false,
    blocking: false,
    canAct: false,
  };
  return { ...next, warningLevel: allyInfectionWarning(next, config) };
}

export function fireAreaContainsLifecycle(area, lifecycle) {
  if (!area || !lifecycle || !FIRE_KINDS.has(area.kind)) return false;
  if (area.phase === "expired" || area.active === false || (Number.isFinite(area.remaining) && area.remaining <= 0)) return false;
  return pointInGroundEffectEllipse(area, { x: finiteNumber(lifecycle.x), y: entityY(lifecycle) });
}

export function igniteAllyCorpsesInFire({ lifecycles = [], fireAreas = [], paused = false } = {}) {
  if (paused) return { lifecycles, ignitedIds: [] };
  const ignitedIds = [];
  const next = lifecycles.map((lifecycle) => {
    if (lifecycle.side !== "human"
      || !BURNABLE_ALLY_STATES.has(lifecycle.state)
      || !fireAreas.some((area) => fireAreaContainsLifecycle(area, lifecycle))) return lifecycle;
    ignitedIds.push(lifecycle.id);
    return igniteAllyCorpse(lifecycle);
  });
  return { lifecycles: next, ignitedIds };
}

export const COMBAT_LIFECYCLE_BOUNDARIES = freeze(["reset", "end", "battle-end", "map-return"]);

export function createCombatLifecycleRuntime() {
  return { enemies: [], allies: [] };
}

export function advanceCombatLifecycleRuntime(runtime, seconds, {
  paused = false,
  enemy = {},
  ally = {},
  caps = {},
} = {}) {
  const delta = nonNegativeSeconds(seconds);
  if (paused || delta === 0) return runtime;
  const enemies = enforceEnemyCorpseCaps(
    (runtime?.enemies ?? []).map((lifecycle) => advanceEnemyLifecycle(lifecycle, delta, enemy)),
    caps,
  );
  const allies = (runtime?.allies ?? []).map((lifecycle) => advanceAllyLifecycle(lifecycle, delta, ally));
  return { ...(runtime ?? {}), enemies, allies };
}

/** Battle-local death/infection state is discarded at every exit boundary. */
export function applyCombatLifecycleBoundary(runtime, boundary) {
  if (!COMBAT_LIFECYCLE_BOUNDARIES.includes(boundary)) return runtime;
  return createCombatLifecycleRuntime();
}
