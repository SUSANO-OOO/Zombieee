const CRAZY_KING_TIERS = Object.freeze([
  Object.freeze({ tier: 0, minimumHits: 0, radius: 54, cadenceMultiplier: 1 }),
  Object.freeze({ tier: 1, minimumHits: 3, radius: 60, cadenceMultiplier: 0.92 }),
  Object.freeze({ tier: 2, minimumHits: 6, radius: 66, cadenceMultiplier: 0.84 }),
  Object.freeze({ tier: 3, minimumHits: 9, radius: 72, cadenceMultiplier: 0.78 }),
]);

/**
 * Version 0.7.0 role tuning. Product decisions define the role boundaries while
 * these conservative initial values remain centralized for deterministic tests
 * and later balance passes.
 */
export const UNIT_ROLE_TUNING = Object.freeze({
  nao: Object.freeze({
    healRange: 118,
    baseHealing: 22,
    concurrentHealDecay: 0.65,
    minimumConcurrentHealMultiplier: 0.3,
    damageReduction: 0.18,
    damageReductionSeconds: 2.5,
  }),
  crazyKing: Object.freeze({
    comboWindowSeconds: 1.7,
    tiers: CRAZY_KING_TIERS,
  }),
  raider: Object.freeze({
    lineRange: 168,
    penetrationLimit: 5,
    suppressionPerHit: 1,
    maximumSuppressionStacks: 4,
    slowPerStack: 0.06,
    minimumSpeedMultiplier: 0.76,
    suppressionSeconds: 2.2,
    heatPerShot: 14,
    overheatThreshold: 100,
    coolingPerSecond: 24,
    resumeHeat: 35,
  }),
  tatara: Object.freeze({
    normalMultiplier: 1,
    heavyMultiplier: 1.45,
    armoredMultiplier: 1.55,
    infectedBaseMultiplier: 1.75,
    splashRadius: 0,
    maximumTargets: 1,
  }),
  gantetsu: Object.freeze({
    interceptRange: 84,
    interceptRatio: 0.4,
    maximumInterceptPerHit: 28,
    steadfastDurationSeconds: 3,
    steadfastMinimumHp: 1,
  }),
  monkey: Object.freeze({
    placementIntervalSeconds: 12,
    rearOffset: 72,
    triggerRadius: 28,
    stopSeconds: 2.2,
    maximumUnusedTrapsPerOwner: 1,
  }),
});

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegative(value) {
  return Math.max(0, finiteNumber(value));
}

function nonNegativeDistance(value) {
  const number = Number(value);
  if (number === Infinity) return Infinity;
  return Number.isFinite(number) ? Math.max(0, number) : Infinity;
}

function stableId(entity) {
  if (entity?.id === undefined || entity?.id === null) return "";
  return String(entity.id);
}

function defaultDistance(first, second) {
  const firstX = Number(first?.x);
  const secondX = Number(second?.x);
  if (!Number.isFinite(firstX) || !Number.isFinite(secondX)) return Infinity;
  const firstY = Number(first?.y);
  const secondY = Number(second?.y);
  if (Number.isFinite(firstY) && Number.isFinite(secondY)) {
    return Math.hypot(firstX - secondX, firstY - secondY);
  }
  return Math.abs(firstX - secondX);
}

function sameSide(first, second) {
  if (first?.side === undefined || second?.side === undefined) return true;
  return first.side === second.side;
}

function knownSameSide(first, second) {
  return first?.side !== undefined
    && second?.side !== undefined
    && first.side === second.side;
}

function sameEntity(first, second) {
  if (first === second) return true;
  if (first?.id === undefined || first?.id === null || second?.id === undefined || second?.id === null) {
    return false;
  }
  return String(first.id) === String(second.id);
}

export function unitHpRatio(unit) {
  const maxHp = finiteNumber(unit?.maxHp);
  if (maxHp <= 0) return Infinity;
  return Math.max(0, finiteNumber(unit?.hp)) / maxHp;
}

/**
 * Selects one living, injured ally by HP ratio. Ties are resolved by missing HP,
 * distance, then stable id so selection does not depend on array order.
 */
export function selectNaoHealTarget({
  healer = null,
  allies = [],
  maxRange = Infinity,
  distanceBetween = defaultDistance,
} = {}) {
  const safeRange = Number.isFinite(Number(maxRange))
    ? Math.max(0, Number(maxRange))
    : Infinity;
  return (Array.isArray(allies) ? allies : [])
    .filter((ally) => {
      const hp = finiteNumber(ally?.hp);
      const maxHp = finiteNumber(ally?.maxHp);
      if (!ally || hp <= 0 || maxHp <= 0 || hp >= maxHp || ally.combatReady === false) return false;
      if (healer && !sameSide(healer, ally)) return false;
      if (!healer || safeRange === Infinity) return true;
      return nonNegativeDistance(distanceBetween(healer, ally)) <= safeRange;
    })
    .map((ally) => ({
      ally,
      ratio: unitHpRatio(ally),
      missingHp: Math.max(0, finiteNumber(ally.maxHp) - finiteNumber(ally.hp)),
      distance: healer ? nonNegativeDistance(distanceBetween(healer, ally)) : 0,
    }))
    .sort((first, second) => (
      first.ratio - second.ratio
      || second.missingHp - first.missingHp
      || first.distance - second.distance
      || stableId(first.ally).localeCompare(stableId(second.ally))
    ))[0]?.ally ?? null;
}

/**
 * `healerNumber` is one-based: the first Nao heals at full value.
 */
export function naoConcurrentHealMultiplier(healerNumber = 1) {
  const ordinal = Math.max(1, Math.floor(finiteNumber(healerNumber, 1)));
  return Math.max(
    UNIT_ROLE_TUNING.nao.minimumConcurrentHealMultiplier,
    UNIT_ROLE_TUNING.nao.concurrentHealDecay ** (ordinal - 1),
  );
}

export function resolveNaoHealing({
  target,
  baseHealing = UNIT_ROLE_TUNING.nao.baseHealing,
  healerNumber = 1,
  existingProtectionSeconds = 0,
} = {}) {
  const hp = nonNegative(target?.hp);
  const maxHp = Math.max(hp, nonNegative(target?.maxHp));
  const multiplier = naoConcurrentHealMultiplier(healerNumber);
  const amount = Math.min(Math.max(0, maxHp - hp), nonNegative(baseHealing) * multiplier);
  return Object.freeze({
    amount,
    hp: hp + amount,
    multiplier,
    damageReduction: amount > 0 ? UNIT_ROLE_TUNING.nao.damageReduction : 0,
    protectionSeconds: amount > 0
      ? Math.max(nonNegative(existingProtectionSeconds), UNIT_ROLE_TUNING.nao.damageReductionSeconds)
      : nonNegative(existingProtectionSeconds),
  });
}

export function naoDamageAfterProtection({
  damage,
  protectionSeconds = 0,
} = {}) {
  const incomingDamage = nonNegative(damage);
  const protectedHit = nonNegative(protectionSeconds) > 0;
  const reduction = protectedHit ? UNIT_ROLE_TUNING.nao.damageReduction : 0;
  return Object.freeze({
    damage: incomingDamage * (1 - reduction),
    prevented: incomingDamage * reduction,
    reduction,
  });
}

export function advanceNaoProtection(protectionSeconds, elapsedSeconds) {
  return Math.max(0, nonNegative(protectionSeconds) - nonNegative(elapsedSeconds));
}

export function crazyKingProfileForHits(hitCount = 0) {
  const hits = Math.max(0, Math.floor(finiteNumber(hitCount)));
  return [...UNIT_ROLE_TUNING.crazyKing.tiers]
    .reverse()
    .find((profile) => hits >= profile.minimumHits)
    ?? UNIT_ROLE_TUNING.crazyKing.tiers[0];
}

/**
 * A miss or an overlong gap breaks the chain. A landed hit after a timed-out
 * chain starts a fresh chain at one hit.
 */
export function advanceCrazyKingMomentum({
  hitCount = 0,
  secondsSinceLastHit = Infinity,
  hitLanded = true,
} = {}) {
  const previousHits = Math.max(0, Math.floor(finiteNumber(hitCount)));
  const gap = nonNegativeDistance(secondsSinceLastHit);
  const interrupted = hitLanded !== true
    || (previousHits > 0 && gap > UNIT_ROLE_TUNING.crazyKing.comboWindowSeconds);
  const nextHits = hitLanded === true ? (interrupted ? 1 : previousHits + 1) : 0;
  const profile = crazyKingProfileForHits(nextHits);
  return Object.freeze({
    hitCount: nextHits,
    tier: profile.tier,
    radius: profile.radius,
    cadenceMultiplier: profile.cadenceMultiplier,
    reset: interrupted,
  });
}

export function crazyKingAttackInterval(baseAttackEvery, hitCount = 0) {
  return nonNegative(baseAttackEvery) * crazyKingProfileForHits(hitCount).cadenceMultiplier;
}

/**
 * Returns only living targets in the exact lane and forward firing line.
 * No adjacent-lane or radial candidates are admitted.
 */
export function selectRaiderLineTargets({
  attacker,
  enemies = [],
  range = UNIT_ROLE_TUNING.raider.lineRange,
  direction = 1,
  maximumTargets = UNIT_ROLE_TUNING.raider.penetrationLimit,
} = {}) {
  if (!attacker || !Number.isInteger(attacker.lane) || !Number.isFinite(Number(attacker.x))) {
    return Object.freeze([]);
  }
  const forward = direction < 0 ? -1 : 1;
  const safeRange = nonNegative(range);
  const limit = Math.max(0, Math.floor(finiteNumber(maximumTargets)));
  const originX = Number(attacker.x);
  return Object.freeze(
    (Array.isArray(enemies) ? enemies : [])
      .filter((enemy) => {
        if (!enemy || enemy.hp <= 0 || enemy.combatReady === false || enemy.lane !== attacker.lane) return false;
        if (knownSameSide(attacker, enemy)) return false;
        const projectedDistance = (finiteNumber(enemy.x, NaN) - originX) * forward;
        return Number.isFinite(projectedDistance) && projectedDistance >= 0 && projectedDistance <= safeRange;
      })
      .map((enemy) => ({ enemy, distance: (Number(enemy.x) - originX) * forward }))
      .sort((first, second) => (
        first.distance - second.distance
        || stableId(first.enemy).localeCompare(stableId(second.enemy))
      ))
      .slice(0, limit)
      .map(({ enemy }) => enemy),
  );
}

export function raiderSuppressionProfile(stacks = 0) {
  const normalizedStacks = Math.min(
    UNIT_ROLE_TUNING.raider.maximumSuppressionStacks,
    Math.max(0, Math.floor(finiteNumber(stacks))),
  );
  return Object.freeze({
    stacks: normalizedStacks,
    speedMultiplier: Math.max(
      UNIT_ROLE_TUNING.raider.minimumSpeedMultiplier,
      1 - normalizedStacks * UNIT_ROLE_TUNING.raider.slowPerStack,
    ),
    remainingSeconds: normalizedStacks > 0 ? UNIT_ROLE_TUNING.raider.suppressionSeconds : 0,
  });
}

export function applyRaiderSuppression(currentStacks = 0, hitCount = 1) {
  return raiderSuppressionProfile(
    Math.max(0, Math.floor(finiteNumber(currentStacks)))
      + Math.max(0, Math.floor(finiteNumber(hitCount))) * UNIT_ROLE_TUNING.raider.suppressionPerHit,
  );
}

export function advanceRaiderSuppression(state = {}, elapsedSeconds = 0) {
  const remainingSeconds = Math.max(
    0,
    nonNegative(state.remainingSeconds) - nonNegative(elapsedSeconds),
  );
  if (remainingSeconds <= 0) return raiderSuppressionProfile(0);
  const profile = raiderSuppressionProfile(state.stacks);
  return Object.freeze({ ...profile, remainingSeconds });
}

export function createRaiderHeatState() {
  return Object.freeze({ heat: 0, overheated: false });
}

export function raiderCanFire(state = {}) {
  return state.overheated !== true
    && nonNegative(state.heat) < UNIT_ROLE_TUNING.raider.overheatThreshold;
}

export function applyRaiderShots(state = {}, requestedShots = 1) {
  let heat = Math.min(
    UNIT_ROLE_TUNING.raider.overheatThreshold,
    nonNegative(state.heat),
  );
  if (state.overheated === true || heat >= UNIT_ROLE_TUNING.raider.overheatThreshold) {
    return Object.freeze({ heat, overheated: true, acceptedShots: 0, rejectedShots: Math.max(0, Math.floor(finiteNumber(requestedShots))) });
  }
  const requested = Math.max(0, Math.floor(finiteNumber(requestedShots)));
  let acceptedShots = 0;
  while (acceptedShots < requested && heat < UNIT_ROLE_TUNING.raider.overheatThreshold) {
    heat = Math.min(
      UNIT_ROLE_TUNING.raider.overheatThreshold,
      heat + UNIT_ROLE_TUNING.raider.heatPerShot,
    );
    acceptedShots += 1;
  }
  return Object.freeze({
    heat,
    overheated: heat >= UNIT_ROLE_TUNING.raider.overheatThreshold,
    acceptedShots,
    rejectedShots: requested - acceptedShots,
  });
}

export function coolRaiderHeat(state = {}, elapsedSeconds = 0) {
  const heat = Math.max(
    0,
    nonNegative(state.heat)
      - UNIT_ROLE_TUNING.raider.coolingPerSecond * nonNegative(elapsedSeconds),
  );
  const overheated = state.overheated === true
    && heat > UNIT_ROLE_TUNING.raider.resumeHeat;
  return Object.freeze({ heat, overheated });
}

const HEAVY_TARGET_KINDS = Object.freeze(["crusher", "abomination", "takuya", "grappler", "gate-eater"]);

function targetTags(target) {
  return Array.isArray(target?.tags) ? target.tags : [];
}

export function tataraTargetSpecialty(target = {}) {
  const tags = targetTags(target);
  const infectedBase = target.isInfectedBase === true
    || target.targetType === "infected-base"
    || target.targetType === "enemy-base"
    || target.kind === "infected-base"
    || target.kind === "infection-base"
    || target.kind === "enemy-base"
    || target.structureKind === "infected-base"
    || target.structureKind === "enemy-base"
    || tags.includes("infected-base");
  if (infectedBase) return "infected-base";
  const armored = target.armored === true
    || nonNegative(target.armor) > 0
    || target.armorClass === "armored"
    || tags.includes("armored")
    || tags.includes("front-armor");
  if (armored) return "armored";
  const heavy = target.heavy === true
    || target.weightClass === "heavy"
    || HEAVY_TARGET_KINDS.includes(target.kind)
    || tags.includes("heavy");
  return heavy ? "heavy" : "normal";
}

export function tataraStrikeProfile(target = {}) {
  const specialty = tataraTargetSpecialty(target);
  const multiplier = specialty === "infected-base"
    ? UNIT_ROLE_TUNING.tatara.infectedBaseMultiplier
    : specialty === "armored"
      ? UNIT_ROLE_TUNING.tatara.armoredMultiplier
      : specialty === "heavy"
        ? UNIT_ROLE_TUNING.tatara.heavyMultiplier
        : UNIT_ROLE_TUNING.tatara.normalMultiplier;
  return Object.freeze({
    specialty,
    multiplier,
    splashRadius: UNIT_ROLE_TUNING.tatara.splashRadius,
    maximumTargets: UNIT_ROLE_TUNING.tatara.maximumTargets,
  });
}

export function resolveTataraStrikeDamage(baseDamage, target = {}) {
  return nonNegative(baseDamage) * tataraStrikeProfile(target).multiplier;
}

function gantetsuInterceptionReason({
  guardian,
  target,
  attackKind,
  direction,
  range,
}) {
  if (!guardian || !target) return "missing-entity";
  if (guardian.hp <= 0 || guardian.combatReady === false) return "guardian-unavailable";
  if (sameEntity(guardian, target)) return "self-target";
  if (!sameSide(guardian, target)) return "not-an-ally";
  if (attackKind !== "melee") return "not-melee";
  if (target.hp <= 0 || target.combatReady === false) return "target-unavailable";
  if (Number.isInteger(guardian.lane) && Number.isInteger(target.lane) && guardian.lane !== target.lane) {
    return "different-lane";
  }
  if (!Number.isFinite(Number(guardian.x)) || !Number.isFinite(Number(target.x))) return "missing-position";
  const forward = direction < 0 ? -1 : 1;
  const rearDistance = (Number(guardian.x) - Number(target.x)) * forward;
  if (rearDistance < 0) return "target-not-behind";
  if (rearDistance > range || defaultDistance(guardian, target) > range) return "out-of-range";
  return null;
}

export function canGantetsuIntercept({
  guardian,
  target,
  attackKind,
  direction = 1,
  range = UNIT_ROLE_TUNING.gantetsu.interceptRange,
} = {}) {
  return gantetsuInterceptionReason({
    guardian,
    target,
    attackKind,
    direction,
    range: nonNegative(range),
  }) === null;
}

/**
 * Resolves damage taken by Gantetsu himself. Steadfast is a one-use deployment
 * state that keeps him at one HP for a bounded duration regardless of whether
 * the lethal hit came from an interception or a direct attack.
 */
export function resolveGantetsuSteadfastDamage({
  guardian,
  incomingDamage,
  steadfast = { remainingSeconds: 0, available: true },
} = {}) {
  const damage = nonNegative(incomingDamage);
  const currentHp = nonNegative(guardian?.hp);
  let hp = Math.max(0, currentHp - damage);
  let remainingSeconds = nonNegative(steadfast?.remainingSeconds);
  let available = steadfast?.available !== false;
  let triggered = false;

  if (hp < UNIT_ROLE_TUNING.gantetsu.steadfastMinimumHp) {
    if (remainingSeconds > 0) {
      hp = UNIT_ROLE_TUNING.gantetsu.steadfastMinimumHp;
    } else if (available && currentHp > 0) {
      hp = UNIT_ROLE_TUNING.gantetsu.steadfastMinimumHp;
      remainingSeconds = UNIT_ROLE_TUNING.gantetsu.steadfastDurationSeconds;
      available = false;
      triggered = true;
    }
  }

  return Object.freeze({
    hp,
    damage: Math.max(0, currentHp - hp),
    steadfast: Object.freeze({ remainingSeconds, available, triggered }),
  });
}

/**
 * Steadfast is one-use per deployment. Pass the returned `steadfast` state into
 * later resolutions; once its timer expires and `available` is false, Gantetsu
 * can be reduced to zero normally.
 */
export function resolveGantetsuInterception({
  guardian,
  target,
  incomingDamage,
  attackKind,
  direction = 1,
  steadfast = { remainingSeconds: 0, available: true },
} = {}) {
  const damage = nonNegative(incomingDamage);
  const reason = gantetsuInterceptionReason({
    guardian,
    target,
    attackKind,
    direction,
    range: UNIT_ROLE_TUNING.gantetsu.interceptRange,
  });
  const currentSteadfast = {
    remainingSeconds: nonNegative(steadfast?.remainingSeconds),
    available: steadfast?.available !== false,
  };
  const currentHp = nonNegative(guardian?.hp);
  if (reason || damage <= 0) {
    return Object.freeze({
      eligible: false,
      reason: reason ?? "no-damage",
      targetDamage: damage,
      guardianDamage: 0,
      guardianHp: currentHp,
      steadfast: Object.freeze({ ...currentSteadfast, triggered: false }),
    });
  }

  const guardianDamage = Math.min(
    damage * UNIT_ROLE_TUNING.gantetsu.interceptRatio,
    UNIT_ROLE_TUNING.gantetsu.maximumInterceptPerHit,
  );
  const resolvedGuardian = resolveGantetsuSteadfastDamage({
    guardian,
    incomingDamage: guardianDamage,
    steadfast: currentSteadfast,
  });
  return Object.freeze({
    eligible: true,
    reason: null,
    targetDamage: damage - guardianDamage,
    guardianDamage,
    guardianHp: resolvedGuardian.hp,
    steadfast: resolvedGuardian.steadfast,
  });
}

export function advanceGantetsuSteadfast(steadfast = {}, elapsedSeconds = 0) {
  return Object.freeze({
    remainingSeconds: Math.max(
      0,
      nonNegative(steadfast.remainingSeconds) - nonNegative(elapsedSeconds),
    ),
    available: steadfast.available !== false,
    triggered: false,
  });
}

export function monkeyTrapPlacementReady({
  ownerId,
  existingTraps = [],
  elapsedSinceLastPlacement = Infinity,
} = {}) {
  const unusedCount = (Array.isArray(existingTraps) ? existingTraps : [])
    .filter((trap) => (
      trap
      && String(trap.ownerId ?? "") === String(ownerId ?? "")
      && trap.active !== false
      && trap.used !== true
    )).length;
  return unusedCount < UNIT_ROLE_TUNING.monkey.maximumUnusedTrapsPerOwner
    && finiteNumber(elapsedSinceLastPlacement, Infinity) >= UNIT_ROLE_TUNING.monkey.placementIntervalSeconds;
}

/**
 * Places an unused trap behind the engineer in their assigned lane.
 */
export function createMonkeyTrap({
  id,
  engineer,
  assignedLane = engineer?.assignedLane ?? engineer?.lane,
  existingTraps = [],
  elapsedSinceLastPlacement = Infinity,
  direction = 1,
  minimumX = 0,
  maximumX = Infinity,
} = {}) {
  if (!engineer || engineer.hp <= 0 || !Number.isFinite(Number(engineer.x))) {
    return Object.freeze({ ok: false, reason: "engineer-unavailable", trap: null });
  }
  if (!Number.isInteger(assignedLane) || assignedLane < 0 || assignedLane > 2) {
    return Object.freeze({ ok: false, reason: "invalid-assigned-lane", trap: null });
  }
  if (!monkeyTrapPlacementReady({
    ownerId: engineer.id,
    existingTraps,
    elapsedSinceLastPlacement,
  })) {
    return Object.freeze({ ok: false, reason: "placement-not-ready", trap: null });
  }
  const forward = direction < 0 ? -1 : 1;
  const minX = finiteNumber(minimumX);
  const maxX = Math.max(minX, finiteNumber(maximumX, Infinity));
  const x = Math.min(
    maxX,
    Math.max(minX, Number(engineer.x) - forward * UNIT_ROLE_TUNING.monkey.rearOffset),
  );
  return Object.freeze({
    ok: true,
    reason: null,
    trap: Object.freeze({
      id,
      ownerId: engineer.id,
      ownerSide: engineer.side,
      lane: assignedLane,
      x,
      active: true,
      used: false,
      triggerRadius: UNIT_ROLE_TUNING.monkey.triggerRadius,
      stopSeconds: UNIT_ROLE_TUNING.monkey.stopSeconds,
    }),
  });
}

export function canTriggerMonkeyTrap(trap, enemy) {
  if (!trap || !enemy || trap.active === false || trap.used === true) return false;
  if (enemy.hp <= 0 || enemy.combatReady === false || trap.lane !== enemy.lane) return false;
  if (trap.ownerSide !== undefined && enemy.side === trap.ownerSide) return false;
  if (!Number.isFinite(Number(trap.x)) || !Number.isFinite(Number(enemy.x))) return false;
  return Math.abs(Number(enemy.x) - Number(trap.x)) <= nonNegative(trap.triggerRadius);
}

export function triggerMonkeyTrap(trap, enemies = []) {
  const target = (Array.isArray(enemies) ? enemies : [])
    .filter((enemy) => canTriggerMonkeyTrap(trap, enemy))
    .map((enemy) => ({ enemy, distance: Math.abs(Number(enemy.x) - Number(trap.x)) }))
    .sort((first, second) => (
      first.distance - second.distance
      || stableId(first.enemy).localeCompare(stableId(second.enemy))
    ))[0]?.enemy;
  if (!target) {
    return Object.freeze({
      triggered: false,
      targetId: null,
      stopSeconds: 0,
      trap,
    });
  }
  return Object.freeze({
    triggered: true,
    targetId: target.id,
    stopSeconds: nonNegative(trap.stopSeconds),
    trap: Object.freeze({ ...trap, active: false, used: true }),
  });
}
