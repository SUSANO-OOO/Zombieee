import assert from "node:assert/strict";
import test from "node:test";
import { aggregateEquipmentEffects } from "../app/equipment.js";
import { unitContentFor } from "../app/content/unitCatalog.js";
import { applyV100UnitLevelProgression } from "../app/v100Progression.js";
import { applyUnitEquipmentEffects } from "../app/unitEquipmentStats.js";

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test("neutral equipment preserves canonical unit values and progression identity", () => {
  const card = Object.freeze(applyV100UnitLevelProgression(unitContentFor("scout"), 4));
  const effects = aggregateEquipmentEffects([]);
  const result = applyUnitEquipmentEffects(card, effects);
  assert.notEqual(result, card);
  for (const key of ["hp", "damage", "range", "speed", "laneSpeed", "attackEvery", "deployCooldown", "progressionLevel", "progressionRank", "kind", "cost"]) assert.equal(result[key], card[key]);
  close(result.defense, card.defense);
  assert.equal(result.healingMultiplier, 1);
});

test("Hachi vest rounds HP to 86 while a weapon keeps fractional damage", () => {
  const card = Object.freeze(applyV100UnitLevelProgression(unitContentFor("scout"), 1));
  const result = applyUnitEquipmentEffects(card, aggregateEquipmentEffects(["reinforced-vest", "field-machete"]));
  assert.equal(result.hp, 86);
  close(result.damage, 11.55);
  assert.equal(result.speed, 27);
  assert.equal(result.attackEvery, .62);
  assert.equal(card.hp, 80);
  assert.equal(card.damage, 11);
});

test("equipment and survival retain distinct attack, range, healing and defense multipliers", () => {
  const card = Object.freeze({ hp: 80, damage: 20, range: 100, speed: 20, laneSpeed: 60, attackEvery: 1, defense: .2, healingMultiplier: 1.1, deployCooldown: 10, identity: "unchanged" });
  const effects = Object.freeze({ ...aggregateEquipmentEffects([]), hpMultiplier: 1.08, damageMultiplier: 1.05, rangeMultiplier: 1.06, speedMultiplier: 1.06, attackEveryMultiplier: .95, defenseFlat: .025, healingMultiplier: 1.08, redeployMultiplier: .97 });
  const survival = Object.freeze({ attackMultiplier: 1.25, rangeMultiplier: 1.5, defenseMultiplier: .8, healingMultiplier: 1.4 });
  const result = applyUnitEquipmentEffects(card, effects, survival);
  assert.equal(result.hp, 86);
  close(result.damage, 26.25);
  close(result.range, 159);
  close(result.speed, 21.2);
  close(result.laneSpeed, 63.6);
  close(result.attackEvery, .95);
  close(result.defense, .38);
  close(result.healingMultiplier, 1.6632);
  close(result.deployCooldown, 9.7);
  assert.equal(result.identity, "unchanged");
  assert.equal(card.hp, 80);
  assert.equal(effects.defenseFlat, .025);
  assert.equal(survival.defenseMultiplier, .8);
});

test("defense is capped before survival mitigation and again after it", () => {
  const card = { hp: 1, damage: 1, range: 1, speed: 1, laneSpeed: 1, attackEvery: 1, deployCooldown: 1, defense: .7 };
  const effects = { ...aggregateEquipmentEffects([]), defenseFlat: .2 };
  close(applyUnitEquipmentEffects(card, effects, { defenseMultiplier: 1.2 }).defense, .7);
  assert.equal(applyUnitEquipmentEffects(card, effects, { defenseMultiplier: .5 }).defense, .75);
  assert.equal(applyUnitEquipmentEffects({ ...card, hp: 0 }, effects).hp, 1);
});
