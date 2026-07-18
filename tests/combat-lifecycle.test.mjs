import test from "node:test";
import assert from "node:assert/strict";

import {
  ALLY_DEATH_CONFIG,
  COMBAT_GEOMETRY,
  ENEMY_DEATH_CONFIG,
  advanceAllyLifecycle,
  advanceCombatLifecycleRuntime,
  advanceEnemyLifecycle,
  allyInfectionWarning,
  applyCombatLifecycleBoundary,
  beginAllyDeath,
  beginEnemyDeath,
  canAcquireCombatTarget,
  canNormalAttackTarget,
  combatHitboxesOverlap,
  createAllyLifecycle,
  createAttackTransaction,
  createCombatLifecycleRuntime,
  createEnemyLifecycle,
  createGenericZombieSpawn,
  enforceEnemyCorpseCaps,
  fireAreaContainsLifecycle,
  hasAdjacentLaneLineOfSight,
  igniteAllyCorpsesInFire,
  isCombatBlocking,
  isCombatTargetable,
  selectCombatTarget,
  supportCohesion,
} from "../app/combatLifecycle.js";

const closeTo = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

function fighter(overrides = {}) {
  return {
    id: 1,
    side: "human",
    kind: "brawler",
    lane: 1,
    x: 300,
    y: COMBAT_GEOMETRY.laneY[1],
    range: 30,
    bodyRadius: 12,
    hp: 100,
    combatReady: true,
    ...overrides,
  };
}

test("keeps three lanes while widening the effective objective distance by 20-30 percent", () => {
  assert.equal(COMBAT_GEOMETRY.laneCount, 3);
  assert.equal(COMBAT_GEOMETRY.laneY.length, 3);
  assert.ok(COMBAT_GEOMETRY.distanceExpansion >= 1.2);
  assert.ok(COMBAT_GEOMETRY.distanceExpansion <= 1.3);
  closeTo(COMBAT_GEOMETRY.enemyObjectiveX - COMBAT_GEOMETRY.friendlyObjectiveX, COMBAT_GEOMETRY.effectiveCombatDistance);
  assert.ok(COMBAT_GEOMETRY.friendlyBaseBounds.x < 0);
  assert.ok(COMBAT_GEOMETRY.enemyBaseBounds.x >= 0);
  assert.ok(COMBAT_GEOMETRY.enemyBaseBounds.x + COMBAT_GEOMETRY.enemyBaseBounds.width <= COMBAT_GEOMETRY.canvasWidth);
  assert.ok(COMBAT_GEOMETRY.enemyObjectiveX >= COMBAT_GEOMETRY.enemyBaseBounds.x);
  assert.ok(COMBAT_GEOMETRY.enemyObjectiveX <= COMBAT_GEOMETRY.enemyBaseBounds.x + COMBAT_GEOMETRY.enemyBaseBounds.width);
  assert.ok(COMBAT_GEOMETRY.friendlyDeploymentX > COMBAT_GEOMETRY.friendlyObjectiveX);
  assert.ok(COMBAT_GEOMETRY.enemyCombatStartX < COMBAT_GEOMETRY.enemyObjectiveX);
});

test("allows melee attacks only against close targets in the same lane", () => {
  const attacker = fighter();
  const closeSameLane = fighter({ id: 2, side: "zombie", x: 336 });
  const closerAdjacent = fighter({ id: 3, side: "zombie", lane: 0, x: 302, y: COMBAT_GEOMETRY.laneY[0] });
  const farSameLane = fighter({ id: 4, side: "zombie", x: 350 });

  assert.equal(canNormalAttackTarget({ attacker, target: closeSameLane }), true);
  assert.equal(canNormalAttackTarget({ attacker, target: closerAdjacent }), false);
  assert.equal(canNormalAttackTarget({ attacker, target: farSameLane }), false);
  assert.equal(selectCombatTarget({ attacker, candidates: [closerAdjacent, closeSameLane] }), closeSameLane);
});

test("pursuit and firing share lifecycle, side, lane, role, and line-of-sight rules", () => {
  const farSameLane = fighter({
    id: 2,
    side: "zombie",
    lane: 0,
    x: 520,
    y: COMBAT_GEOMETRY.laneY[0],
  });
  const adjacent = fighter({
    id: 3,
    side: "zombie",
    lane: 1,
    x: 318,
    y: COMBAT_GEOMETRY.laneY[1],
  });
  const ranger = fighter({
    kind: "ranger",
    lane: 0,
    y: COMBAT_GEOMETRY.laneY[0],
    range: 145,
    attackType: "ranged",
  });
  const nao = { ...ranger, kind: "medic", role: "medic" };

  assert.equal(canAcquireCombatTarget({ attacker: ranger, target: farSameLane }), true);
  assert.equal(canNormalAttackTarget({ attacker: ranger, target: farSameLane }), false, "range is the only pursuit/fire difference");
  assert.equal(canAcquireCombatTarget({ attacker: ranger, target: adjacent, hasLineOfSight: true }), true);
  assert.equal(canNormalAttackTarget({ attacker: ranger, target: adjacent, hasLineOfSight: true }), true);
  assert.equal(canAcquireCombatTarget({ attacker: ranger, target: adjacent, hasLineOfSight: false }), false);
  assert.equal(canNormalAttackTarget({ attacker: ranger, target: adjacent, hasLineOfSight: false }), false);
  assert.equal(canAcquireCombatTarget({ attacker: nao, target: adjacent, hasLineOfSight: true }), false, "Nao searches only lanes he can actually shoot");
  assert.equal(canNormalAttackTarget({ attacker: nao, target: adjacent, hasLineOfSight: true }), false);
});

test("combat hitbox overlap uses the same two-dimensional body geometry as targeting", () => {
  const left = fighter({ x: 300, y: 250, bodyRadius: 14 });
  const touching = fighter({ id: 2, side: "zombie", x: 322, y: 250, bodyRadius: 8 });
  const ySeparated = fighter({ id: 3, side: "zombie", x: 300, y: 273, bodyRadius: 8 });

  assert.equal(combatHitboxesOverlap({ left, right: touching }), true);
  assert.equal(combatHitboxesOverlap({ left, right: ySeparated }), false);
});

test("physical overlap during a mobile lane transition outranks the logical melee lane gate", () => {
  const attacker = fighter({ lane: 0, x: 300, y: 255, range: 30, bodyRadius: 12 });
  const takuya = fighter({
    id: 2,
    side: "zombie",
    kind: "takuya",
    lane: 1,
    x: 300,
    y: 285,
    range: 36,
    bodyRadius: 28,
    hp: 300,
  });

  assert.equal(combatHitboxesOverlap({ left: attacker, right: takuya }), true);
  assert.equal(canAcquireCombatTarget({ attacker, target: takuya }), true);
  assert.equal(canNormalAttackTarget({ attacker, target: takuya }), true);
  const transaction = createAttackTransaction({ attacker, candidates: [takuya] });
  assert.equal(transaction?.targetId, takuya.id);
});

test("ranged targeting prioritizes its lane and gates adjacent lanes by role, range, and line of sight", () => {
  const attacker = fighter({ kind: "ranger", lane: 0, y: COMBAT_GEOMETRY.laneY[0], range: 145, attackType: "ranged" });
  const sameLane = fighter({ id: 2, side: "zombie", lane: 0, y: COMBAT_GEOMETRY.laneY[0], x: 420 });
  const adjacent = fighter({ id: 3, side: "zombie", lane: 1, x: 318, y: COMBAT_GEOMETRY.laneY[1] });
  const twoLanesAway = fighter({ id: 4, side: "zombie", lane: 2, x: 302, y: COMBAT_GEOMETRY.laneY[2] });

  assert.equal(selectCombatTarget({ attacker, candidates: [adjacent, sameLane], hasLineOfSight: true }), sameLane);
  assert.equal(selectCombatTarget({ attacker, candidates: [adjacent] }), null, "adjacent lane requires explicit line of sight");
  assert.equal(selectCombatTarget({ attacker, candidates: [adjacent], hasLineOfSight: false }), null);
  assert.equal(selectCombatTarget({ attacker, candidates: [adjacent], hasLineOfSight: true }), adjacent);
  assert.equal(selectCombatTarget({ attacker, candidates: [twoLanesAway], hasLineOfSight: true }), null);

  const medic = { ...attacker, kind: "medic" };
  assert.equal(selectCombatTarget({ attacker: medic, candidates: [adjacent], hasLineOfSight: true }), null, "role must allow adjacent fire");
});

test("Babayaga can acquire and fire at an unobstructed adjacent-lane special target", () => {
  const attacker = fighter({
    kind: "babayaga",
    lane: 0,
    y: COMBAT_GEOMETRY.laneY[0],
    x: 300,
    range: 158,
    damage: 31,
  });
  const adjacentSpecial = fighter({
    id: 2,
    side: "zombie",
    kind: "spitter",
    lane: 1,
    y: COMBAT_GEOMETRY.laneY[1],
    x: 320,
  });
  assert.equal(canNormalAttackTarget({ attacker, target: adjacentSpecial, hasLineOfSight: true }), true);
  const transaction = createAttackTransaction({
    attacker,
    candidates: [adjacentSpecial],
    hasLineOfSight: true,
  });
  assert.equal(transaction?.targetId, adjacentSpecial.id);
  assert.equal(transaction?.damage.amount, attacker.damage);
  assert.equal(createAttackTransaction({ attacker, candidates: [adjacentSpecial], hasLineOfSight: false }), null);
});

test("adjacent-lane fire uses a real unobstructed segment", () => {
  const attacker = fighter({ kind: "ranger", lane: 0, y: COMBAT_GEOMETRY.laneY[0], range: 160 });
  const target = fighter({ id: 2, side: "zombie", lane: 1, x: 380, y: COMBAT_GEOMETRY.laneY[1] });
  const onSegment = fighter({ id: 3, side: "human", x: 340, y: (attacker.y + target.y) / 2, bodyRadius: 18 });
  const outsideSegment = fighter({ id: 4, side: "human", x: 340, y: COMBAT_GEOMETRY.laneY[2], bodyRadius: 18 });
  assert.equal(hasAdjacentLaneLineOfSight({ attacker, target, blockers: [outsideSegment] }), true);
  assert.equal(hasAdjacentLaneLineOfSight({ attacker, target, blockers: [onSegment] }), false);
});

test("binds projectile and damage payloads to the exact selected target identity", () => {
  const attacker = fighter({ kind: "ranger", range: 160, attackType: "ranged", damage: 23 });
  const adjacent = fighter({ id: 8, side: "zombie", lane: 0, x: 310, y: COMBAT_GEOMETRY.laneY[0] });
  const sameLane = fighter({ id: 9, side: "zombie", x: 430 });
  const transaction = createAttackTransaction({ attacker, candidates: [adjacent, sameLane], hasLineOfSight: true });

  assert.equal(transaction.target, sameLane);
  assert.equal(transaction.targetId, sameLane.id);
  assert.equal(transaction.projectile.targetId, sameLane.id);
  assert.equal(transaction.damage.targetId, sameLane.id);
  assert.equal(transaction.damage.amount, 23);
  assert.notEqual(transaction.projectile.targetId, adjacent.id);
});

test("keeps corpses outside targeting/collision and gives support a stable formation anchor", () => {
  const corpse = { id: 20, state: "ally-corpse", hp: 100, targetable: true, blocking: true };
  assert.equal(isCombatTargetable(corpse), false);
  assert.equal(isCombatBlocking(corpse), false);

  const medic = fighter({ id: 30, kind: "medic", x: 100 });
  const allies = [
    fighter({ id: 31, x: 390 }),
    fighter({ id: 32, x: 420 }),
    fighter({ id: 33, x: 900 }),
    corpse,
  ];
  const cohesion = supportCohesion({ support: medic, allies });
  assert.equal(cohesion.anchorId, 32);
  assert.equal(cohesion.needsRegroup, true);
  assert.equal(cohesion.destination.x, 382);
  assert.equal(cohesion.anchor, allies[1]);
});

test("advances enemy alive-dying-corpse-ashing-removed with class-specific configurable timing", () => {
  const alive = createEnemyLifecycle({ id: 40, kind: "walker", lane: 1, x: 500 });
  const dying = beginEnemyDeath(alive);
  assert.equal(alive.state, "alive");
  assert.equal(dying.state, "dying");
  assert.equal(dying.targetable, false);
  assert.equal(dying.blocking, false);

  const timing = ENEMY_DEATH_CONFIG.timings.normal;
  const corpse = advanceEnemyLifecycle(dying, timing.dyingSeconds);
  assert.equal(corpse.state, "corpse");
  const ashing = advanceEnemyLifecycle(corpse, timing.corpseSeconds);
  assert.equal(ashing.state, "ashing");
  const removed = advanceEnemyLifecycle(ashing, timing.ashingSeconds);
  assert.equal(removed.state, "removed");

  const boss = beginEnemyDeath(createEnemyLifecycle({ id: 41, kind: "takuya", boss: true }));
  assert.equal(boss.deathClass, "boss");
  assert.equal(advanceEnemyLifecycle(boss, timing.dyingSeconds).state, "dying", "boss timing is longer than normal timing");
  assert.equal(createEnemyLifecycle({ id: 42, kind: "gate-eater" }).deathClass, "boss");
  assert.equal(createEnemyLifecycle({ id: 43, kind: "grappler" }).deathClass, "heavy");
  const custom = { normal: { dyingSeconds: 0.1, corpseSeconds: 0.2, ashingSeconds: 0.3 } };
  assert.equal(advanceEnemyLifecycle(dying, 0.6, { timings: custom }).state, "removed");
});

test("removes only safe enemy corpse visuals when offscreen or above configured caps", () => {
  const makeCorpse = (id, lane, x, deathAge) => ({
    ...advanceEnemyLifecycle(beginEnemyDeath(createEnemyLifecycle({ id, kind: "walker", lane, x })), ENEMY_DEATH_CONFIG.timings.normal.dyingSeconds),
    deathAge,
  });
  const offscreen = makeCorpse(50, 0, -100, 2);
  const old = makeCorpse(51, 1, 400, 8);
  const fresh = makeCorpse(52, 1, 410, 2);
  const dying = beginEnemyDeath(createEnemyLifecycle({ id: 53, kind: "walker", lane: 1, x: -100 }));
  const alive = createEnemyLifecycle({ id: 54, kind: "walker", lane: 1, x: -100 });
  const limited = enforceEnemyCorpseCaps([offscreen, old, fresh, dying, alive], { maxVisible: 1, maxPerLane: 1 });

  assert.equal(limited[0].state, "removed");
  assert.equal(limited[0].removalReason, "offscreen");
  assert.equal(limited[1].state, "removed");
  assert.equal(limited[1].removalReason, "lane-cap");
  assert.equal(limited[2].state, "corpse");
  assert.equal(limited[3].state, "dying", "death motion is not culled as a corpse");
  assert.equal(limited[4].state, "alive", "living combatants are never culled by corpse limits");
});

test("runs the 12-second ally infection warnings and generic-zombie rise lock without inheriting the role", () => {
  const alive = createAllyLifecycle({ id: 60, kind: "ranger", role: "sniper", weapon: "rifle", special: "piercing-shot", lane: 1, x: 440 });
  const dying = beginAllyDeath(alive);
  const corpse = advanceAllyLifecycle(dying, ALLY_DEATH_CONFIG.dyingSeconds);
  assert.equal(corpse.state, "ally-corpse");
  assert.equal(corpse.targetable, false);
  assert.equal(corpse.blocking, false);

  const light = advanceAllyLifecycle(corpse, corpse.infectionRemaining - ALLY_DEATH_CONFIG.lightWarningRemaining);
  assert.equal(light.state, "infection-warning");
  assert.equal(allyInfectionWarning(light), "light");
  const strong = advanceAllyLifecycle(light, 3);
  assert.equal(strong.infectionRemaining, 3);
  assert.equal(strong.warningLevel, "strong");
  const risen = advanceAllyLifecycle(strong, 3);
  assert.equal(risen.state, "generic-zombie");
  assert.equal(risen.kind, "generic-zombie");
  assert.equal(risen.inheritedKind, "ranger");
  assert.equal(risen.canAct, false);
  const spawn = createGenericZombieSpawn(risen);
  assert.equal(spawn.kind, "generic-zombie");
  assert.equal(spawn.combatKit, "generic-zombie");
  assert.equal(spawn.sourceAllyId, alive.id);
  assert.equal(Object.hasOwn(spawn, "weapon"), false);
  assert.equal(Object.hasOwn(spawn, "special"), false);
  assert.equal(Object.hasOwn(spawn, "role"), false);
  const locked = advanceAllyLifecycle(risen, ALLY_DEATH_CONFIG.riseLockSeconds / 2);
  assert.equal(locked.canAct, false);
  const ready = advanceAllyLifecycle(locked, ALLY_DEATH_CONFIG.riseLockSeconds / 2);
  assert.equal(ready.canAct, true);
});

test("all three newcomers preserve authored death identity through infection and cremation", () => {
  for (const [index, kind] of ["crazy-king", "kumaverson", "babayaga"].entries()) {
    const alive = createAllyLifecycle({ id: 160 + index, kind, inheritedKind: kind, lane: index, x: 440 + index * 40, y: COMBAT_GEOMETRY.laneY[index] });
    const corpse = advanceAllyLifecycle(beginAllyDeath(alive), .7);
    assert.equal(corpse.state, "ally-corpse", `${kind} authored death pose`);
    assert.equal(corpse.kind, kind);

    const warning = advanceAllyLifecycle(beginAllyDeath(alive), 7.2);
    assert.equal(warning.state, "infection-warning", `${kind} infection warning`);
    assert.equal(warning.inheritedKind, kind);

    const fireAreas = [{ kind: "burn", phase: "active", remaining: 3, x: alive.x, y: alive.y, radius: 80 }];
    const burning = igniteAllyCorpsesInFire({ lifecycles: [corpse], fireAreas }).lifecycles[0];
    assert.equal(burning.state, "burning", `${kind} cremation starts`);
    const ash = advanceAllyLifecycle(burning, ALLY_DEATH_CONFIG.burningSeconds);
    assert.equal(ash.state, "ash", `${kind} cremation completes`);
    assert.equal(ash.infectionPrevented, true);
  }
});

test("fire-area contact immediately cancels infection and burns an ally corpse to ash in about two seconds", () => {
  const corpse = advanceAllyLifecycle(
    beginAllyDeath(createAllyLifecycle({ id: 70, kind: "brawler", lane: 1, x: 500, y: COMBAT_GEOMETRY.laneY[1] })),
    1,
  );
  const outside = advanceAllyLifecycle(
    beginAllyDeath(createAllyLifecycle({ id: 71, kind: "scout", lane: 1, x: 601, y: COMBAT_GEOMETRY.laneY[1] })),
    1,
  );
  const fireAreas = [{ kind: "burn", phase: "active", remaining: 3, x: 500, y: COMBAT_GEOMETRY.laneY[1], radius: 100 }];
  const contact = igniteAllyCorpsesInFire({ lifecycles: [corpse, outside], fireAreas });

  assert.deepEqual(contact.ignitedIds, [70]);
  assert.equal(contact.lifecycles[0].state, "burning");
  assert.equal(contact.lifecycles[0].infectionRemaining, null);
  assert.equal(contact.lifecycles[0].infectionPrevented, true);
  assert.equal(contact.lifecycles[1], outside);
  const ash = advanceAllyLifecycle(contact.lifecycles[0], ALLY_DEATH_CONFIG.burningSeconds);
  assert.equal(ash.state, "ash");
  assert.equal(advanceAllyLifecycle(ash, 30), ash);
});

test("fire-area contact never diverts an enemy death into the ally burning state", () => {
  const enemy = beginEnemyDeath(createEnemyLifecycle({
    id: 72,
    kind: "walker",
    lane: 1,
    x: 500,
    y: COMBAT_GEOMETRY.laneY[1],
  }));
  const fireAreas = [{ kind: "burn", phase: "active", remaining: 3, x: 500, y: COMBAT_GEOMETRY.laneY[1], radius: 100 }];
  const contact = igniteAllyCorpsesInFire({ lifecycles: [enemy], fireAreas });

  assert.deepEqual(contact.ignitedIds, []);
  assert.equal(contact.lifecycles[0], enemy);
  assert.equal(contact.lifecycles[0].side, "zombie");
  assert.equal(advanceEnemyLifecycle(contact.lifecycles[0], 30).state, "removed");
});

test("fire contact uses the same perspective ellipse as the rendered ground effect", () => {
  const area = { kind: "burn", phase: "active", remaining: 4, x: 400, y: COMBAT_GEOMETRY.laneY[1], radius: 88 };
  const sameLaneEdge = { x: 480, y: COMBAT_GEOMETRY.laneY[1], lane: 1 };
  const visuallyOutsideAdjacentLane = { x: 400, y: COMBAT_GEOMETRY.laneY[0], lane: 0 };
  assert.equal(fireAreaContainsLifecycle(area, sameLaneEdge), true);
  assert.equal(fireAreaContainsLifecycle(area, visuallyOutsideAdjacentLane), false);
});

test("pause freezes every lifecycle timer and fire contact", () => {
  const enemy = beginEnemyDeath(createEnemyLifecycle({ id: 80, kind: "walker", lane: 0, x: 300 }));
  const ally = beginAllyDeath(createAllyLifecycle({ id: 81, kind: "medic", lane: 0, x: 300, y: COMBAT_GEOMETRY.laneY[0] }));
  assert.equal(advanceEnemyLifecycle(enemy, 10, { paused: true }), enemy);
  assert.equal(advanceAllyLifecycle(ally, 10, { paused: true }), ally);

  const pausedFire = igniteAllyCorpsesInFire({
    lifecycles: [ally],
    fireAreas: [{ kind: "fire", x: 300, y: COMBAT_GEOMETRY.laneY[0], radius: 50 }],
    paused: true,
  });
  assert.equal(pausedFire.lifecycles[0], ally);
  assert.deepEqual(pausedFire.ignitedIds, []);

  const runtime = { enemies: [enemy], allies: [ally] };
  assert.equal(advanceCombatLifecycleRuntime(runtime, 10, { paused: true }), runtime);
});

test("reset, battle end, and map return always discard battle-local death and infection state", () => {
  const runtime = {
    enemies: [beginEnemyDeath(createEnemyLifecycle({ id: 90 }))],
    allies: [beginAllyDeath(createAllyLifecycle({ id: 91 }))],
  };
  for (const boundary of ["reset", "end", "battle-end", "map-return"]) {
    assert.deepEqual(applyCombatLifecycleBoundary(runtime, boundary), createCombatLifecycleRuntime());
  }
  assert.equal(applyCombatLifecycleBoundary(runtime, "pause"), runtime);
});
