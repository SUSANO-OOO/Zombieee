import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  COMBAT_GEOMETRY,
  createAttackTransaction,
} from "../app/combatLifecycle.js";

import {
  BABAYAGA_PRIORITY_TARGET_KINDS,
  UNIT_BY_ID,
  UNIT_CARDS,
  UNIT_SPECIALS,
  advanceAttackCooldown,
  canDeploy,
  humanAttackMultiplier,
  isBabayagaPriorityTarget,
  newcomerAttackPayload,
  resolveNewcomerAttackEffects,
  roleEffectForAction,
  roleTargetBias,
  structureDamageMultiplier,
} from "../app/gameRules.js";

test("the eleven-card roster preserves keys 1-9 and adds PC keys for Gantetsu and Monkey", () => {
  assert.equal(UNIT_CARDS.length, 11);
  assert.deepEqual(UNIT_CARDS.map(({ key }) => key), ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-"]);
  assert.deepEqual(UNIT_CARDS.slice(6).map(({ kind }) => kind), ["crazy-king", "kumaverson", "babayaga", "guardian", "engineer"]);
  assert.equal(Object.keys(UNIT_BY_ID).length, 11);
  assert.equal(UNIT_BY_ID.medic.cost, 35);
  assert.equal(UNIT_BY_ID.guardian.cost, 48);
});

test("roster balance is data-driven and no card is a clone", () => {
  const signatures = UNIT_CARDS.map(({ cost, deployCooldown, hp, speed, damage, range, attackEvery }) =>
    JSON.stringify([cost, deployCooldown, hp, speed, damage, range, attackEvery]));
  assert.equal(new Set(signatures).size, UNIT_CARDS.length);
  assert.equal(Object.isFrozen(UNIT_SPECIALS), true);
});

test("Crazy King produces crowd damage, bleed and a light push", () => {
  const payload = newcomerAttackPayload({ unitKind: "crazy-king", targetKind: "walker", nearbyTargetIds: [4, 5, 5] });
  assert.equal(payload.effect, "crazy-king");
  assert.deepEqual(payload.secondaryTargetIds, [4, 5]);
  assert.ok(payload.secondaryMultiplier > 0 && payload.secondaryMultiplier < 1);
  assert.ok(payload.damageOverTime.damage > 0);
  assert.ok(payload.damageOverTime.seconds > 0);
  assert.ok(payload.push > 0 && payload.push < UNIT_SPECIALS.kumaverson.push);
});

test("Kumaverson produces knockback and a bounded stun", () => {
  const light = newcomerAttackPayload({ unitKind: "kumaverson", targetKind: "runner" });
  const heavy = newcomerAttackPayload({ unitKind: "kumaverson", targetKind: "crusher", targetIsHeavy: true });
  assert.equal(light.effect, "kumaverson");
  assert.ok(light.push > 0);
  assert.ok(light.stunSeconds > heavy.stunSeconds);
  assert.ok(heavy.stunSeconds > 0);
});

test("Babayaga prioritizes and marks special infected without boosting walkers", () => {
  const special = newcomerAttackPayload({ unitKind: "babayaga", targetKind: "spitter" });
  const normal = newcomerAttackPayload({ unitKind: "babayaga", targetKind: "walker" });
  assert.equal(special.effect, "babayaga");
  assert.ok(special.markSeconds > 0);
  assert.equal(normal.effect, null);
  assert.equal(normal.markSeconds, 0);
  assert.ok(roleTargetBias("babayaga", "takuya") < roleTargetBias("babayaga", "walker"));
  assert.ok(humanAttackMultiplier("babayaga", "spitter") > humanAttackMultiplier("babayaga", "walker"));
  assert.deepEqual(BABAYAGA_PRIORITY_TARGET_KINDS, ["spitter", "shade", "crusher", "abomination", "takuya"]);
  for (const targetKind of BABAYAGA_PRIORITY_TARGET_KINDS) {
    assert.equal(isBabayagaPriorityTarget(targetKind), true, targetKind);
    assert.equal(roleTargetBias("babayaga", targetKind), -48, `${targetKind} target priority`);
    assert.equal(roleEffectForAction({ unitKind: "babayaga", targetKind }), "babayaga", `${targetKind} role effect`);
    assert.equal(newcomerAttackPayload({ unitKind: "babayaga", targetKind }).effect, "babayaga", `${targetKind} mark payload`);
  }
  assert.equal(isBabayagaPriorityTarget("walker"), false);
});

test("new roles participate in role effects and structure tuning", () => {
  assert.equal(roleEffectForAction({ unitKind: "crazy-king", targetKind: "walker" }), "crazy-king");
  assert.equal(roleEffectForAction({ unitKind: "kumaverson", targetKind: "runner" }), "kumaverson");
  assert.equal(roleEffectForAction({ unitKind: "babayaga", targetKind: "takuya" }), "babayaga");
  assert.equal(roleEffectForAction({ unitKind: "babayaga", targetKind: "walker" }), null);
  assert.ok(structureDamageMultiplier("crazy-king") > structureDamageMultiplier("babayaga"));
});

test("each newcomer attacks only within its configured range and observes both cooldowns", () => {
  for (const card of UNIT_CARDS.slice(6)) {
    const attacker = {
      id: `${card.kind}-attacker`,
      side: "human",
      kind: card.kind,
      lane: 1,
      x: 300,
      y: COMBAT_GEOMETRY.laneY[1],
      range: card.range,
      damage: card.damage,
      bodyRadius: 12,
      hp: card.hp,
      combatReady: true,
    };
    const inRange = {
      id: `${card.kind}-near`,
      side: "zombie",
      kind: "walker",
      lane: 1,
      x: 300 + card.range + 11,
      y: COMBAT_GEOMETRY.laneY[1],
      range: 24,
      bodyRadius: 12,
      hp: 100,
      combatReady: true,
    };
    const outOfRange = { ...inRange, id: `${card.kind}-far`, x: 300 + card.range + 13 };
    const attack = createAttackTransaction({ attacker, candidates: [inRange], damage: card.damage });
    assert.equal(attack?.targetId, inRange.id, `${card.kind} in-range attack`);
    assert.equal(attack?.damage.amount, card.damage, `${card.kind} configured damage`);
    assert.equal(createAttackTransaction({ attacker, candidates: [outOfRange], damage: card.damage }), null, `${card.kind} range boundary`);
    assert.equal(advanceAttackCooldown(card.attackEvery, card.attackEvery / 2), card.attackEvery / 2, `${card.kind} attack cooldown advances`);
    assert.equal(advanceAttackCooldown(card.attackEvery / 2, card.attackEvery), 0, `${card.kind} attack cooldown becomes ready`);
    assert.equal(canDeploy({ running: true, paused: false, over: false, command: card.cost, cost: card.cost, cooldown: 0 }), true, `${card.kind} can deploy when ready`);
    assert.equal(canDeploy({ running: true, paused: false, over: false, command: card.cost, cost: card.cost, cooldown: card.deployCooldown }), false, `${card.kind} deploy cooldown blocks`);
  }
});

test("newcomer target priorities reach the actual attack transaction", () => {
  const cases = [
    ["crazy-king", "walker", "crusher"],
    ["kumaverson", "runner", "walker"],
    ["babayaga", "crusher", "walker"],
  ];
  for (const [kind, priorityKind, ordinaryKind] of cases) {
    const card = UNIT_BY_ID[kind];
    const attacker = {
      id: `${kind}-attacker`, side: "human", kind, lane: 1, x: 300, y: COMBAT_GEOMETRY.laneY[1],
      range: card.range, damage: card.damage, bodyRadius: 12, hp: card.hp, combatReady: true,
    };
    const priority = { id: `${kind}-priority`, side: "zombie", kind: priorityKind, lane: 1, x: 310, y: COMBAT_GEOMETRY.laneY[1], bodyRadius: 12, hp: 100, combatReady: true };
    const ordinary = { ...priority, id: `${kind}-ordinary`, kind: ordinaryKind };
    const transaction = createAttackTransaction({
      attacker,
      candidates: [ordinary, priority],
      targetPriority: (candidate) => roleTargetBias(kind, candidate.kind),
    });
    assert.equal(transaction?.targetId, priority.id, `${kind} priority target`);
  }
});

test("runtime newcomer effects apply crowd bleed, stun/knockback, and analysis marks", () => {
  const baseTarget = {
    id: 10, kind: "walker", hp: 100, flash: 0, knock: 0, stunned: 0, marked: 0,
    bleedRemaining: 0, bleedDamagePerSecond: 0,
  };
  const secondary = { ...baseTarget, id: 11 };
  const crazy = resolveNewcomerAttackEffects({
    unitKind: "crazy-king",
    target: baseTarget,
    nearbyTargets: [secondary],
    attackDamage: UNIT_BY_ID["crazy-king"].damage,
  });
  assert.ok(crazy.target.bleedRemaining > 0 && crazy.target.knock > 0);
  assert.ok(crazy.secondaryTargets[0].hp < secondary.hp);
  assert.ok(crazy.secondaryTargets[0].bleedDamagePerSecond > 0);

  const kuma = resolveNewcomerAttackEffects({ unitKind: "kumaverson", target: baseTarget, targetIsHeavy: false });
  assert.ok(kuma.target.knock > crazy.target.knock);
  assert.ok(kuma.target.stunned > 0);

  const baba = resolveNewcomerAttackEffects({ unitKind: "babayaga", target: { ...baseTarget, kind: "crusher" } });
  assert.ok(baba.target.marked > 0);
  assert.equal(baba.payload.effect, "babayaga");
});

test("the battle loop uses the tested newcomer effect and cooldown helpers", async () => {
  const source = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  assert.match(source, /f\.cooldown = advanceAttackCooldown\(f\.cooldown, dt\)/);
  assert.match(source, /const newcomerEffects = resolveNewcomerAttackEffects\(\{/);
  assert.match(source, /Object\.assign\(target, newcomerEffects\.target\)/);
  assert.match(source, /Object\.assign\(secondary, nextSecondary\)/);
  assert.match(source, /crazyKingAttackInterval\(f\.attackEvery, f\.comboHits\)/);
});
