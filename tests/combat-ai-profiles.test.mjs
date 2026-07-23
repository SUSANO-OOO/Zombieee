import assert from "node:assert/strict";
import test from "node:test";
import {
  ALLY_AI_PROFILE_BY_KIND,
  ALLY_AI_PROFILE_IDS,
  ALLY_AI_PROFILES,
  ENEMY_AI_PROFILE_BY_KIND,
  ENEMY_AI_PROFILE_IDS,
  ENEMY_AI_PROFILES,
  advanceNavigationRecovery,
  allyAiProfileFor,
  chooseEnemyTargetForProfile,
  createNavigationRecoveryState,
  enemyAiProfileFor,
  retainedTargetDuringRetarget,
  shouldPrioritizeSupportObject,
} from "../app/combatAiProfiles.js";
import { canAcquireCombatTarget, createAttackTransaction } from "../app/combatLifecycle.js";
import { ENEMY_CONTENT } from "../app/content/enemyCatalog.js";
import { UNIT_CONTENT } from "../app/content/unitCatalog.js";

test("every canonical combatant owns one valid immutable AI profile", () => {
  assert.deepEqual(new Set(Object.keys(ALLY_AI_PROFILES)), new Set(ALLY_AI_PROFILE_IDS));
  assert.deepEqual(new Set(Object.keys(ENEMY_AI_PROFILES)), new Set(ENEMY_AI_PROFILE_IDS));
  assert.equal(new Set(Object.values(ENEMY_AI_PROFILE_BY_KIND)).size, ENEMY_AI_PROFILE_IDS.length);

  for (const unit of UNIT_CONTENT) {
    assert.equal(unit.aiProfile, ALLY_AI_PROFILE_BY_KIND[unit.kind]);
    assert.equal(allyAiProfileFor(unit.kind).id, unit.aiProfile);
    assert.equal(allyAiProfileFor(unit.aiProfile).id, unit.aiProfile);
    assert.equal(Object.isFrozen(allyAiProfileFor(unit.kind)), true);
  }
  for (const enemy of ENEMY_CONTENT) {
    assert.equal(enemy.aiProfile, ENEMY_AI_PROFILE_BY_KIND[enemy.id]);
    assert.equal(enemyAiProfileFor(enemy.id).id, enemy.aiProfile);
    assert.equal(enemyAiProfileFor(enemy.aiProfile).id, enemy.aiProfile);
    assert.equal(Object.isFrozen(enemyAiProfileFor(enemy.id)), true);
  }
});

test("ally profiles produce distinct preferred retarget and pursuit behavior", () => {
  const skirmisher = allyAiProfileFor("scout");
  const marksman = allyAiProfileFor("ranger");
  const heavy = allyAiProfileFor("guardian");
  const support = allyAiProfileFor("medic");
  assert.ok(skirmisher.retargetSeconds < heavy.retargetSeconds);
  assert.ok(marksman.localThreatRadius > support.localThreatRadius);
  assert.ok(heavy.maxPursuersPerEnemy > marksman.maxPursuersPerEnemy);
  assert.ok(support.rangePadding > heavy.rangePadding);
});

test("enemy profiles keep physical contact absolute while producing distinct targets", () => {
  const enemy = { x: 650, y: 220 };
  const front = {
    id: "front",
    kind: "guardian",
    x: 560,
    y: 220,
    hp: 220,
    maxHp: 240,
    distance: 90,
    blocksRoute: true,
    capacity: 4,
    nearbyAllies: 1,
  };
  const medic = {
    id: "medic",
    kind: "medic",
    x: 450,
    y: 220,
    hp: 55,
    maxHp: 68,
    distance: 200,
    capacity: 1,
    nearbyAllies: 3,
  };
  const wounded = {
    id: "wounded",
    kind: "brawler",
    x: 505,
    y: 220,
    hp: 12,
    maxHp: 135,
    distance: 145,
    capacity: 2,
    nearbyAllies: 0,
  };

  assert.equal(chooseEnemyTargetForProfile({
    kind: "shade",
    enemy,
    candidates: [front, medic],
  })?.id, "front", "a physical route blocker must not be bypassed");

  const unblockedFront = { ...front, blocksRoute: false };
  assert.equal(chooseEnemyTargetForProfile({
    kind: "shade",
    enemy,
    candidates: [unblockedFront, medic],
  })?.id, "medic");
  assert.equal(chooseEnemyTargetForProfile({
    kind: "sprinter",
    enemy,
    candidates: [unblockedFront, wounded],
  })?.id, "wounded");
  assert.equal(chooseEnemyTargetForProfile({
    kind: "runner",
    enemy,
    candidates: [unblockedFront, medic],
  }), null, "crawler-priority runners ignore non-contact humans");
});

test("ranged, grab, area, and support-object profiles expose their counterplay parameters", () => {
  assert.ok(enemyAiProfileFor("spitter").preferredRange > 0);
  assert.ok(enemyAiProfileFor("grappler").durableTargetBonus > 0);
  assert.ok(enemyAiProfileFor("abomination").clusterBonus > 0);
  assert.ok(enemyAiProfileFor("crusher").supportObjectPriority > 0);
  assert.equal(enemyAiProfileFor("crusher").humanPursuit, false);
});

test("target claims prevent dogpiles unless contact or a route block is present", () => {
  const candidate = {
    id: 7,
    kind: "medic",
    x: 520,
    y: 220,
    hp: 50,
    maxHp: 68,
    distance: 90,
    capacity: 1,
  };
  assert.equal(chooseEnemyTargetForProfile({
    kind: "shade",
    enemy: { x: 610, y: 220 },
    candidates: [candidate],
    claims: new Map([[7, 1]]),
  }), null);
  assert.equal(chooseEnemyTargetForProfile({
    kind: "shade",
    enemy: { x: 610, y: 220 },
    candidates: [{ ...candidate, inContact: true }],
    claims: new Map([[7, 8]]),
  })?.id, 7);
});

test("enemy profiles reject targets that the combat transaction cannot acquire", () => {
  const shade = {
    id: 1,
    side: "zombie",
    kind: "shade",
    lane: 0,
    x: 650,
    y: 120,
    range: 27,
    bodyRadius: 11,
  };
  const remoteMedic = {
    id: 2,
    side: "human",
    kind: "medic",
    lane: 2,
    x: 500,
    y: 340,
    hp: 68,
    maxHp: 68,
    bodyRadius: 11,
  };
  const attackEligible = canAcquireCombatTarget({ attacker: shade, target: remoteMedic });
  assert.equal(attackEligible, false);
  assert.equal(chooseEnemyTargetForProfile({
    profile: "backline",
    enemy: shade,
    candidates: [{
      ...remoteMedic,
      distance: Math.hypot(shade.x - remoteMedic.x, shade.y - remoteMedic.y),
      attackEligible,
    }],
  }), null);
  assert.equal(createAttackTransaction({
    attacker: shade,
    candidates: [remoteMedic],
  }), null);
});

test("ally retarget windows retain a legal lock but yield to contact and CRAWLER emergencies", () => {
  const current = { id: 10, hp: 80, attackEligible: true };
  const ordinary = { id: 11, hp: 80, attackEligible: true };
  assert.equal(retainedTargetDuringRetarget({
    retargetIn: .4,
    currentTargetId: 10,
    candidates: [current, ordinary],
  })?.id, 10);
  assert.equal(retainedTargetDuringRetarget({
    retargetIn: .4,
    currentTargetId: 10,
    candidates: [current, { ...ordinary, inContact: true }],
  }), null);
  assert.equal(retainedTargetDuringRetarget({
    retargetIn: .4,
    currentTargetId: 10,
    candidates: [current, { ...ordinary, attackingCrawler: true }],
  }), null);
  assert.equal(retainedTargetDuringRetarget({
    retargetIn: 0,
    currentTargetId: 10,
    candidates: [current],
  }), null);
});

test("support-object priority is distance-aware and never overrides physical contact", () => {
  assert.equal(shouldPrioritizeSupportObject({
    profile: "support-object",
    targetDistance: 40,
    objectDistance: 120,
  }), true);
  assert.equal(shouldPrioritizeSupportObject({
    profile: "nearest",
    targetDistance: 40,
    objectDistance: 120,
  }), false);
  assert.equal(shouldPrioritizeSupportObject({
    profile: "support-object",
    targetDistance: 40,
    objectDistance: 20,
    hasPhysicalContact: true,
  }), false);
});

test("navigation recovery is deterministic, alternates its detour, and clears on engagement", () => {
  let state = createNavigationRecoveryState({ x: 600, y: 220, lane: 1 });
  for (let index = 0; index < 4; index += 1) {
    state = advanceNavigationRecovery({
      state,
      x: 600,
      y: 220,
      desiredX: 500,
      desiredY: 220,
      lane: 1,
      seed: 4,
      moving: true,
      seconds: .2,
    });
  }
  assert.equal(state.recoveryLane, 2);
  assert.equal(state.recoveryCount, 1);
  assert.ok(state.recoverySeconds > 0);

  const replay = Array.from({ length: 4 }).reduce((current) => advanceNavigationRecovery({
    state: current,
    x: 600,
    y: 220,
    desiredX: 500,
    desiredY: 220,
    lane: 1,
    seed: 4,
    moving: true,
    seconds: .2,
  }), createNavigationRecoveryState({ x: 600, y: 220, lane: 1 }));
  assert.deepEqual(replay, state);

  const cleared = advanceNavigationRecovery({
    state,
    x: 600,
    y: 220,
    desiredX: 500,
    desiredY: 220,
    lane: 1,
    seed: 4,
    moving: true,
    engaged: true,
    seconds: .1,
  });
  assert.equal(cleared.recoveryLane, null);
  assert.equal(cleared.stuckSeconds, 0);
});

test("real movement resets stuck accumulation and reaching a destination never detours", () => {
  const state = advanceNavigationRecovery({
    state: createNavigationRecoveryState({ x: 600, y: 220, lane: 1 }),
    x: 595,
    y: 220,
    desiredX: 500,
    desiredY: 220,
    lane: 1,
    moving: true,
    seconds: 1,
  });
  assert.equal(state.stuckSeconds, 0);
  assert.equal(state.recoveryLane, null);

  const reached = advanceNavigationRecovery({
    state,
    x: 501,
    y: 220,
    desiredX: 500,
    desiredY: 220,
    lane: 1,
    moving: true,
    seconds: 1,
  });
  assert.equal(reached.recoveryLane, null);
});

test("slow boss movement at 60 fps is progress rather than a false stuck signal", () => {
  let x = 700;
  let state = createNavigationRecoveryState({ x, y: 220, lane: 1 });
  for (let frame = 0; frame < 120; frame += 1) {
    x -= .11;
    state = advanceNavigationRecovery({
      state,
      x,
      y: 220,
      desiredX: 160,
      desiredY: 220,
      lane: 1,
      moving: true,
      seconds: 1 / 60,
    });
  }
  assert.equal(state.recoveryCount, 0);
  assert.equal(state.recoveryLane, null);
  assert.equal(state.stuckSeconds, 0);
});
