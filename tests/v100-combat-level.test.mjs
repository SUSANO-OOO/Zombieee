import test from "node:test";
import assert from "node:assert/strict";
import { UNIT_CONTENT } from "../app/content/unitCatalog.js";
import { applyV100UnitLevelProgression } from "../app/v100Progression.js";
import { v100UnitStatAtLevel } from "../app/v100Registry.js";
import { applyUnitLevelProgression } from "../app/unitProgression.js";
import { UNIT_ROLE_TUNING, resolveNaoHealing } from "../app/unitRoleMechanics.js";

for (const [level, hpMultiplier, damageMultiplier] of [[1, 1, 1], [5, 1.1, 1.08], [15, 1.35, 1.28], [30, 1.725, 1.58]]) {
  test(`all16 production cards use the locked V1 level${level} without cadence or role bonuses`, () => {
    assert.equal(UNIT_CONTENT.length, 16);
    for (const card of UNIT_CONTENT) {
      const next = applyV100UnitLevelProgression(card, level);
      assert.equal(next.hp, Math.round(card.hp * hpMultiplier));
      assert.equal(next.damage, Math.round(card.damage * damageMultiplier));
      assert.equal(next.progressionLevel, level); assert.equal(next.progressionRank, 0);
      for (const [key, value] of Object.entries(card)) if (!["hp", "damage"].includes(key)) assert.deepEqual(next[key], value, `${card.kind}:${key}`);
      for (const key of ["defense", "healingMultiplier", "trapDurationMultiplier", "milestones"]) assert.equal(next[key], card[key]);
      assert.ok(Object.isFrozen(next));
    }
  });
}

test("V1 clamps malformed and legacy-only levels; the original legacy curve remains distinct", () => {
  const card = UNIT_CONTENT.find(card => card.kind === "miyamoto-musashi");
  for (const level of [NaN, Infinity, -4, 0]) assert.equal(applyV100UnitLevelProgression(card, level).progressionLevel, 1);
  assert.equal(applyV100UnitLevelProgression(card, 3.8).progressionLevel, 3);
  assert.equal(applyV100UnitLevelProgression(card, 50).progressionLevel, 30);
  const old = applyUnitLevelProgression(card, 30), next = applyV100UnitLevelProgression(card, 30);
  assert.deepEqual([old.hp, old.damage, old.speed, old.attackEvery], [192, 44, 23.84, .526]);
  assert.deepEqual([next.hp, next.damage, next.speed, next.attackEvery], [233, 49, 21, .72]);
});

test("Nao healing rounds before equipment and respects actual missing HP and concurrent-healer caps", () => {
  assert.equal(UNIT_ROLE_TUNING.nao.baseHealing, 22);
  for (const [level, expected] of [[1, 22], [5, 24], [15, 28], [30, 35]]) {
    const baseHealing = v100UnitStatAtLevel(22, level, "healing"); assert.equal(baseHealing, expected);
    const first = resolveNaoHealing({ target: { hp: 100, maxHp: 300 }, baseHealing: baseHealing * 1.1, healerNumber: 1 });
    assert.equal(first.amount, expected * 1.1);
    const capped = resolveNaoHealing({ target: { hp: 298, maxHp: 300 }, baseHealing, healerNumber: 1 }); assert.equal(capped.amount, 2);
    const second = resolveNaoHealing({ target: { hp: 100, maxHp: 300 }, baseHealing, healerNumber: 2 }); assert.equal(second.amount, expected * .65);
  }
  assert.equal(v100UnitStatAtLevel(233 * .3, 30, "healing"), 110);
});
