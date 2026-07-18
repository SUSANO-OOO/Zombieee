import assert from "node:assert/strict";
import test from "node:test";

import {
  UNIT_ROLE_TUNING,
  advanceCrazyKingMomentum,
  advanceGantetsuSteadfast,
  advanceNaoProtection,
  advanceRaiderSuppression,
  applyRaiderShots,
  applyRaiderSuppression,
  canGantetsuIntercept,
  canTriggerMonkeyTrap,
  coolRaiderHeat,
  crazyKingAttackInterval,
  crazyKingProfileForHits,
  createMonkeyTrap,
  createRaiderHeatState,
  monkeyTrapPlacementReady,
  naoConcurrentHealMultiplier,
  naoDamageAfterProtection,
  raiderCanFire,
  raiderSuppressionProfile,
  resolveGantetsuInterception,
  resolveGantetsuSteadfastDamage,
  resolveNaoHealing,
  resolveTataraStrikeDamage,
  selectNaoHealTarget,
  selectRaiderLineTargets,
  tataraStrikeProfile,
  tataraTargetSpecialty,
  triggerMonkeyTrap,
  unitHpRatio,
} from "../app/unitRoleMechanics.js";

test("role tuning and nested Crazy King tiers are frozen", () => {
  assert.equal(Object.isFrozen(UNIT_ROLE_TUNING), true);
  for (const tuning of Object.values(UNIT_ROLE_TUNING)) assert.equal(Object.isFrozen(tuning), true);
  assert.equal(Object.isFrozen(UNIT_ROLE_TUNING.crazyKing.tiers), true);
  assert.ok(UNIT_ROLE_TUNING.crazyKing.tiers.every(Object.isFrozen));
});

test("Nao selects the lowest living injured HP ratio independent of array order", () => {
  const healer = { id: "nao", side: "human", x: 100, y: 100 };
  const allies = [
    { id: "half", side: "human", hp: 50, maxHp: 100, x: 110, y: 100 },
    { id: "critical", side: "human", hp: 20, maxHp: 100, x: 115, y: 100 },
    { id: "healthy", side: "human", hp: 100, maxHp: 100, x: 101, y: 100 },
    { id: "dead", side: "human", hp: 0, maxHp: 100, x: 100, y: 100 },
  ];
  assert.equal(selectNaoHealTarget({ healer, allies }).id, "critical");
  assert.equal(selectNaoHealTarget({ healer, allies: [...allies].reverse() }).id, "critical");
  assert.equal(unitHpRatio(allies[1]), 0.2);
});

test("Nao tie breaks by missing HP, distance, then stable id", () => {
  const healer = { id: "nao", side: "human", x: 0, y: 0 };
  const largerPool = { id: "z", side: "human", hp: 100, maxHp: 200, x: 50, y: 0 };
  const smallerPool = { id: "a", side: "human", hp: 50, maxHp: 100, x: 1, y: 0 };
  assert.equal(selectNaoHealTarget({ healer, allies: [smallerPool, largerPool] }).id, "z");

  const equalA = { id: "a", side: "human", hp: 50, maxHp: 100, x: 10, y: 0 };
  const equalB = { id: "b", side: "human", hp: 50, maxHp: 100, x: 20, y: 0 };
  assert.equal(selectNaoHealTarget({ healer, allies: [equalB, equalA] }).id, "a");
});

test("Nao range and side gates force deterministic reacquisition", () => {
  const healer = { id: "nao", side: "human", x: 0, y: 0 };
  const outOfRange = { id: "critical", side: "human", hp: 1, maxHp: 100, x: 119, y: 0 };
  const inRange = { id: "wounded", side: "human", hp: 40, maxHp: 100, x: 118, y: 0 };
  const enemy = { id: "enemy", side: "zombie", hp: 1, maxHp: 100, x: 1, y: 0 };
  assert.equal(selectNaoHealTarget({
    healer,
    allies: [outOfRange, enemy, inRange],
    maxRange: UNIT_ROLE_TUNING.nao.healRange,
  }).id, "wounded");
  assert.equal(selectNaoHealTarget({ healer, allies: [outOfRange], maxRange: 118 }), null);
});

test("multiple Nao healing decays by healer order and floors conservatively", () => {
  assert.equal(naoConcurrentHealMultiplier(1), 1);
  assert.equal(naoConcurrentHealMultiplier(2), 0.65);
  assert.equal(naoConcurrentHealMultiplier(3), 0.65 ** 2);
  assert.equal(naoConcurrentHealMultiplier(20), UNIT_ROLE_TUNING.nao.minimumConcurrentHealMultiplier);
});

test("Nao healing respects missing HP and only grants protection after actual healing", () => {
  const healed = resolveNaoHealing({
    target: { hp: 90, maxHp: 100 },
    baseHealing: 22,
    healerNumber: 1,
  });
  assert.deepEqual(healed, {
    amount: 10,
    hp: 100,
    multiplier: 1,
    damageReduction: 0.18,
    protectionSeconds: 2.5,
  });
  const full = resolveNaoHealing({
    target: { hp: 100, maxHp: 100 },
    existingProtectionSeconds: 1,
  });
  assert.equal(full.amount, 0);
  assert.equal(full.damageReduction, 0);
  assert.equal(full.protectionSeconds, 1);
});

test("Nao post-treatment reduction has exact active and expired boundaries", () => {
  assert.deepEqual(naoDamageAfterProtection({ damage: 100, protectionSeconds: 0.001 }), {
    damage: 82,
    prevented: 18,
    reduction: 0.18,
  });
  assert.deepEqual(naoDamageAfterProtection({ damage: 100, protectionSeconds: 0 }), {
    damage: 100,
    prevented: 0,
    reduction: 0,
  });
  assert.equal(advanceNaoProtection(2.5, 2.49), 0.009999999999999787);
  assert.equal(advanceNaoProtection(2.5, 2.5), 0);
  assert.equal(advanceNaoProtection(2.5, 20), 0);
});

test("Crazy King tiers increase melee radius and cadence only at hit thresholds", () => {
  assert.deepEqual(crazyKingProfileForHits(2), UNIT_ROLE_TUNING.crazyKing.tiers[0]);
  assert.deepEqual(crazyKingProfileForHits(3), UNIT_ROLE_TUNING.crazyKing.tiers[1]);
  assert.deepEqual(crazyKingProfileForHits(6), UNIT_ROLE_TUNING.crazyKing.tiers[2]);
  assert.deepEqual(crazyKingProfileForHits(9), UNIT_ROLE_TUNING.crazyKing.tiers[3]);
  assert.equal(crazyKingProfileForHits(999).radius, 72);
  assert.equal(crazyKingAttackInterval(1, 9), 0.78);
});

test("Crazy King continues at the combo-window boundary and resets above it", () => {
  const atBoundary = advanceCrazyKingMomentum({
    hitCount: 5,
    secondsSinceLastHit: UNIT_ROLE_TUNING.crazyKing.comboWindowSeconds,
    hitLanded: true,
  });
  assert.equal(atBoundary.hitCount, 6);
  assert.equal(atBoundary.tier, 2);
  assert.equal(atBoundary.reset, false);

  const timedOut = advanceCrazyKingMomentum({
    hitCount: 8,
    secondsSinceLastHit: UNIT_ROLE_TUNING.crazyKing.comboWindowSeconds + 0.001,
    hitLanded: true,
  });
  assert.equal(timedOut.hitCount, 1);
  assert.equal(timedOut.tier, 0);
  assert.equal(timedOut.reset, true);

  const noTimestamp = advanceCrazyKingMomentum({ hitCount: 8, hitLanded: true });
  assert.equal(noTimestamp.hitCount, 1);
  assert.equal(noTimestamp.reset, true);
});

test("Crazy King miss resets immediately and never gains ranged behavior", () => {
  const missed = advanceCrazyKingMomentum({
    hitCount: 9,
    secondsSinceLastHit: 0.1,
    hitLanded: false,
  });
  assert.deepEqual(missed, {
    hitCount: 0,
    tier: 0,
    radius: 54,
    cadenceMultiplier: 1,
    reset: true,
  });
  assert.equal("range" in crazyKingProfileForHits(9), false);
  assert.equal("projectile" in crazyKingProfileForHits(9), false);
});

test("Raider selects an ordered same-lane forward penetration line", () => {
  const attacker = { id: "raider", side: "human", lane: 1, x: 100 };
  const enemies = [
    { id: "far", side: "zombie", lane: 1, x: 268, hp: 10 },
    { id: "near", side: "zombie", lane: 1, x: 120, hp: 10 },
    { id: "adjacent", side: "zombie", lane: 0, x: 110, hp: 10 },
    { id: "behind", side: "zombie", lane: 1, x: 99, hp: 10 },
    { id: "dead", side: "zombie", lane: 1, x: 101, hp: 0 },
    { id: "ally", side: "human", lane: 1, x: 105, hp: 10 },
  ];
  assert.deepEqual(
    selectRaiderLineTargets({ attacker, enemies }).map(({ id }) => id),
    ["near", "far"],
  );
});

test("Raider line range, direction, and penetration boundaries are exact", () => {
  const attacker = { id: "raider", side: "human", lane: 2, x: 200 };
  const enemies = Array.from({ length: 8 }, (_, index) => ({
    id: `e${index}`,
    side: "zombie",
    lane: 2,
    x: 200 - index * 10,
    hp: 10,
  }));
  const selected = selectRaiderLineTargets({
    attacker,
    enemies,
    range: 40,
    direction: -1,
    maximumTargets: 3,
  });
  assert.deepEqual(selected.map(({ id }) => id), ["e0", "e1", "e2"]);
  assert.equal(Object.isFrozen(selected), true);
});

test("Raider can consume runtime candidates that omit optional side metadata", () => {
  assert.deepEqual(
    selectRaiderLineTargets({
      attacker: { id: "raider", lane: 1, x: 100 },
      enemies: [{ id: "walker", lane: 1, x: 120, hp: 10 }],
    }).map(({ id }) => id),
    ["walker"],
  );
});

test("Raider suppression stacks slow to a floor and expires cleanly", () => {
  assert.deepEqual(raiderSuppressionProfile(0), {
    stacks: 0,
    speedMultiplier: 1,
    remainingSeconds: 0,
  });
  assert.deepEqual(applyRaiderSuppression(0, 2), {
    stacks: 2,
    speedMultiplier: 0.88,
    remainingSeconds: 2.2,
  });
  assert.deepEqual(applyRaiderSuppression(3, 20), {
    stacks: 4,
    speedMultiplier: 0.76,
    remainingSeconds: 2.2,
  });
  assert.equal(advanceRaiderSuppression({ stacks: 4, remainingSeconds: 1 }, 0.999).stacks, 4);
  assert.deepEqual(advanceRaiderSuppression({ stacks: 4, remainingSeconds: 1 }, 1), raiderSuppressionProfile(0));
});

test("Raider heat accepts shots until overheat and blocks further fire", () => {
  const cold = createRaiderHeatState();
  assert.equal(raiderCanFire(cold), true);
  const burst = applyRaiderShots(cold, 20);
  assert.deepEqual(burst, {
    heat: 100,
    overheated: true,
    acceptedShots: 8,
    rejectedShots: 12,
  });
  assert.equal(raiderCanFire(burst), false);
  assert.deepEqual(applyRaiderShots(burst, 3), {
    heat: 100,
    overheated: true,
    acceptedShots: 0,
    rejectedShots: 3,
  });
});

test("Raider overheat cooldown resumes only at the configured threshold", () => {
  const overheated = { heat: 100, overheated: true };
  const aboveResume = coolRaiderHeat(overheated, (100 - 35.1) / 24);
  assert.equal(aboveResume.overheated, true);
  assert.equal(raiderCanFire(aboveResume), false);
  const atResume = coolRaiderHeat(overheated, (100 - 35) / 24);
  assert.equal(atResume.heat, 35);
  assert.equal(atResume.overheated, false);
  assert.equal(raiderCanFire(atResume), true);
  assert.deepEqual(coolRaiderHeat(atResume, 999), { heat: 0, overheated: false });
});

test("Tatara specializes in heavy, armored, and infected-base targets without stacking", () => {
  assert.equal(tataraTargetSpecialty({ kind: "walker" }), "normal");
  assert.equal(tataraTargetSpecialty({ kind: "crusher" }), "heavy");
  assert.equal(tataraTargetSpecialty({ kind: "grappler" }), "heavy");
  assert.equal(tataraTargetSpecialty({ armored: true, kind: "crusher" }), "armored");
  assert.equal(tataraTargetSpecialty({ isInfectedBase: true, armored: true }), "infected-base");
  assert.equal(resolveTataraStrikeDamage(100, { kind: "walker" }), 100);
  assert.equal(resolveTataraStrikeDamage(100, { kind: "crusher" }), 145);
  assert.equal(resolveTataraStrikeDamage(100, { kind: "grappler" }), 145);
  assert.equal(resolveTataraStrikeDamage(100, { armor: 1 }), 155);
  assert.equal(resolveTataraStrikeDamage(100, { targetType: "infected-base" }), 175);
  assert.equal(resolveTataraStrikeDamage(100, { kind: "enemy-base" }), 175);
});

test("Tatara role boundary is always one target with no ordinary crowd AoE", () => {
  for (const target of [
    { kind: "walker" },
    { heavy: true },
    { tags: ["front-armor"] },
    { tags: ["infected-base"] },
  ]) {
    const profile = tataraStrikeProfile(target);
    assert.equal(profile.splashRadius, 0);
    assert.equal(profile.maximumTargets, 1);
    assert.equal("secondaryTargets" in profile, false);
  }
});

test("Gantetsu intercepts part of a nearby rear ally melee hit with a per-hit cap", () => {
  const guardian = { id: "gantetsu", side: "human", hp: 200, lane: 1, x: 300, y: 100 };
  const target = { id: "nao", side: "human", hp: 60, lane: 1, x: 250, y: 100 };
  const regular = resolveGantetsuInterception({
    guardian,
    target,
    incomingDamage: 50,
    attackKind: "melee",
  });
  assert.equal(regular.eligible, true);
  assert.equal(regular.targetDamage, 30);
  assert.equal(regular.guardianDamage, 20);
  assert.equal(regular.guardianHp, 180);

  const capped = resolveGantetsuInterception({
    guardian,
    target,
    incomingDamage: 100,
    attackKind: "melee",
  });
  assert.equal(capped.guardianDamage, UNIT_ROLE_TUNING.gantetsu.maximumInterceptPerHit);
  assert.equal(capped.targetDamage, 72);
});

test("Gantetsu rejects self, ranged, wrong lane, forward, and out-of-range targets", () => {
  const guardian = { id: "g", side: "human", hp: 100, lane: 1, x: 300, y: 100 };
  const rear = { id: "a", side: "human", hp: 50, lane: 1, x: 250, y: 100 };
  assert.equal(canGantetsuIntercept({ guardian, target: guardian, attackKind: "melee" }), false);
  assert.equal(canGantetsuIntercept({ guardian: { ...guardian, combatReady: false }, target: rear, attackKind: "melee" }), false);
  assert.equal(canGantetsuIntercept({ guardian, target: rear, attackKind: "ranged" }), false);
  assert.equal(canGantetsuIntercept({
    guardian,
    target: { ...rear, lane: 2 },
    attackKind: "melee",
  }), false);
  assert.equal(canGantetsuIntercept({
    guardian,
    target: { ...rear, x: 301 },
    attackKind: "melee",
  }), false);
  assert.equal(canGantetsuIntercept({
    guardian,
    target: { ...rear, x: 216, y: 100 },
    attackKind: "melee",
  }), true);
  assert.equal(canGantetsuIntercept({
    guardian,
    target: { ...rear, x: 215, y: 100 },
    attackKind: "melee",
  }), false);
});

test("Gantetsu steadfast is bounded, timed, and one-use per deployment", () => {
  const guardian = { id: "g", side: "human", hp: 10, lane: 0, x: 200, y: 50 };
  const target = { id: "ally", side: "human", hp: 100, lane: 0, x: 180, y: 50 };
  const triggered = resolveGantetsuInterception({
    guardian,
    target,
    incomingDamage: 100,
    attackKind: "melee",
  });
  assert.equal(triggered.guardianHp, 1);
  assert.deepEqual(triggered.steadfast, {
    remainingSeconds: 3,
    available: false,
    triggered: true,
  });

  const active = resolveGantetsuInterception({
    guardian: { ...guardian, hp: 1 },
    target,
    incomingDamage: 100,
    attackKind: "melee",
    steadfast: advanceGantetsuSteadfast(triggered.steadfast, 2.99),
  });
  assert.equal(active.guardianHp, 1);
  assert.equal(active.steadfast.triggered, false);

  const expired = advanceGantetsuSteadfast(active.steadfast, 0.01);
  const defeated = resolveGantetsuInterception({
    guardian: { ...guardian, hp: 1 },
    target,
    incomingDamage: 100,
    attackKind: "melee",
    steadfast: expired,
  });
  assert.equal(defeated.guardianHp, 0);
  assert.equal(defeated.steadfast.available, false);
});

test("Gantetsu steadfast also protects against direct lethal hits for the same bounded window", () => {
  const guardian = { id: "g", side: "human", hp: 10, lane: 0, x: 200, y: 50 };
  const triggered = resolveGantetsuSteadfastDamage({
    guardian,
    incomingDamage: 100,
  });
  assert.deepEqual(triggered, {
    hp: 1,
    damage: 9,
    steadfast: {
      remainingSeconds: 3,
      available: false,
      triggered: true,
    },
  });

  const active = resolveGantetsuSteadfastDamage({
    guardian: { ...guardian, hp: 1 },
    incomingDamage: 100,
    steadfast: advanceGantetsuSteadfast(triggered.steadfast, 2.99),
  });
  assert.equal(active.hp, 1);
  assert.equal(active.damage, 0);
  assert.equal(active.steadfast.triggered, false);

  const defeated = resolveGantetsuSteadfastDamage({
    guardian: { ...guardian, hp: 1 },
    incomingDamage: 100,
    steadfast: advanceGantetsuSteadfast(active.steadfast, 0.01),
  });
  assert.equal(defeated.hp, 0);
  assert.equal(defeated.damage, 1);
  assert.equal(defeated.steadfast.available, false);
});

test("ineligible Gantetsu interceptions leave the full hit on the ally", () => {
  const result = resolveGantetsuInterception({
    guardian: { id: "g", side: "human", hp: 100, lane: 0, x: 200 },
    target: { id: "a", side: "human", hp: 100, lane: 0, x: 180 },
    incomingDamage: 60,
    attackKind: "ranged",
  });
  assert.equal(result.eligible, false);
  assert.equal(result.reason, "not-melee");
  assert.equal(result.targetDamage, 60);
  assert.equal(result.guardianDamage, 0);
  assert.equal(result.guardianHp, 100);
});

test("Monkey places one unused trap behind itself in the assigned lane", () => {
  const engineer = {
    id: "monkey",
    side: "human",
    hp: 100,
    lane: 0,
    assignedLane: 2,
    x: 300,
  };
  const placement = createMonkeyTrap({
    id: "trap-1",
    engineer,
    elapsedSinceLastPlacement: Infinity,
  });
  assert.equal(placement.ok, true);
  assert.deepEqual(placement.trap, {
    id: "trap-1",
    ownerId: "monkey",
    ownerSide: "human",
    lane: 2,
    x: 228,
    active: true,
    used: false,
    triggerRadius: 28,
    stopSeconds: 2.2,
  });
  assert.equal(Object.isFrozen(placement.trap), true);
});

test("Monkey placement clamps to bounds and reverses rear direction correctly", () => {
  const engineer = { id: "monkey", side: "human", hp: 1, lane: 1, x: 40 };
  assert.equal(createMonkeyTrap({
    id: "left",
    engineer,
    minimumX: 20,
  }).trap.x, 20);
  assert.equal(createMonkeyTrap({
    id: "right",
    engineer,
    direction: -1,
    maximumX: 100,
  }).trap.x, 100);
});

test("Monkey cannot stack unused traps and respects the placement interval boundary", () => {
  const existingTraps = [{ ownerId: "monkey", active: true, used: false }];
  assert.equal(monkeyTrapPlacementReady({
    ownerId: "monkey",
    existingTraps,
    elapsedSinceLastPlacement: 999,
  }), false);
  assert.equal(monkeyTrapPlacementReady({
    ownerId: "monkey",
    existingTraps: [{ ownerId: "monkey", active: false, used: true }],
    elapsedSinceLastPlacement: 11.999,
  }), false);
  assert.equal(monkeyTrapPlacementReady({
    ownerId: "monkey",
    existingTraps: [{ ownerId: "monkey", active: false, used: true }],
    elapsedSinceLastPlacement: 12,
  }), true);
});

test("Monkey trap trigger requires a living enemy in its exact lane and radius", () => {
  const trap = createMonkeyTrap({
    id: "trap",
    engineer: { id: "monkey", side: "human", hp: 100, lane: 1, x: 300 },
  }).trap;
  assert.equal(canTriggerMonkeyTrap(trap, {
    id: "enemy",
    side: "zombie",
    hp: 10,
    lane: 1,
    x: trap.x + 28,
  }), true);
  assert.equal(canTriggerMonkeyTrap(trap, {
    id: "too-far",
    side: "zombie",
    hp: 10,
    lane: 1,
    x: trap.x + 28.001,
  }), false);
  assert.equal(canTriggerMonkeyTrap(trap, {
    id: "adjacent",
    side: "zombie",
    hp: 10,
    lane: 2,
    x: trap.x,
  }), false);
  assert.equal(canTriggerMonkeyTrap(trap, {
    id: "ally",
    side: "human",
    hp: 10,
    lane: 1,
    x: trap.x,
  }), false);
});

test("Monkey trap deterministically stops one target and cannot trigger twice", () => {
  const trap = createMonkeyTrap({
    id: "trap",
    engineer: { id: "monkey", side: "human", hp: 100, lane: 1, x: 300 },
  }).trap;
  const enemies = [
    { id: "b", side: "zombie", hp: 10, lane: 1, x: trap.x + 10 },
    { id: "a", side: "zombie", hp: 10, lane: 1, x: trap.x - 10 },
  ];
  const first = triggerMonkeyTrap(trap, enemies);
  assert.deepEqual(first, {
    triggered: true,
    targetId: "a",
    stopSeconds: 2.2,
    trap: { ...trap, active: false, used: true },
  });
  assert.deepEqual(triggerMonkeyTrap(first.trap, enemies), {
    triggered: false,
    targetId: null,
    stopSeconds: 0,
    trap: first.trap,
  });
});
