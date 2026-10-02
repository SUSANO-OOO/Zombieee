import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultV100Save } from "../app/v100Save.js";
import { V100_UNITS } from "../app/v100Registry.js";
import { formatV100Number, v100UnitPresentation } from "../app/v100UnitPresentation.js";

const nearly = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} differs from ${expected}`);
const fixture = () => {
  const save = createDefaultV100Save({ now: "2026-10-01T00:00:00.000Z" });
  save.ownedUnitIds = [...save.ownedUnitIds, "unit-nao"];
  save.registeredUnitIds = [...save.registeredUnitIds, "unit-nao"];
  return save;
};

test("unarmed level quote uses battle HP, damage, defense, timing and command resources", () => {
  const quote = v100UnitPresentation(fixture(), "unit-hachi");
  assert.equal(quote.level, 1);
  assert.equal(quote.nextLevel, 2);
  assert.equal(quote.levelCap, 5);
  assert.equal(quote.upgradeCost, 30);
  assert.equal(quote.commandCost, 25);
  assert.equal(quote.redeploySeconds, 8);
  assert.equal(quote.current.hp, 80);
  assert.equal(quote.next.hp, 82);
  assert.equal(quote.current.damage, 11);
  nearly(quote.current.defense, .02);
  nearly(quote.next.defense, .0215);
  assert.equal(quote.current.speed, 27);
  assert.equal(quote.current.attackEvery, .62);
});

test("vest quote includes the same rounded HP in current and next permanent levels", () => {
  const save = fixture();
  save.equipment = { inventory: { "reinforced-vest": 1 }, personalByUnit: { "unit-hachi": ["reinforced-vest", null] }, tacticalIds: [], enhancementLevels: {} };
  assert.equal(v100UnitPresentation(save, "unit-hachi").current.hp, 86);
  save.unitLevels["unit-hachi"] = 4;
  const quote = v100UnitPresentation(save, "unit-hachi");
  assert.equal(quote.current.hp, 93);
  assert.equal(quote.next.hp, 95);
  assert.equal(quote.upgradeCost, 55);
  assert.equal(formatV100Number(quote.current.defense * 100, 2), "2.45");
  assert.equal(formatV100Number(quote.next.defense * 100, 2), "2.6");
  assert.equal(formatV100Number((quote.next.defense - quote.current.defense) * 100, 2), "0.15");
  assert.deepEqual(quote.nextOutputGrowth, { stat: "damage", level: 8, value: 13, withinCap: false });
  save.levelCap = 10;
  assert.equal(v100UnitPresentation(save, "unit-hachi").nextOutputGrowth.withinCap, true);
  save.unitLevels["unit-hachi"] = 30;
  assert.equal(v100UnitPresentation(save, "unit-hachi").nextOutputGrowth, null);
});

test("Nao treatment starts at 22 and applies level growth before enhanced rescue equipment", () => {
  const save = fixture();
  assert.equal(v100UnitPresentation(save, "unit-nao").current.healing, 22);
  save.unitLevels["unit-nao"] = 4;
  save.equipment = {
    inventory: { "reinforced-vest": 1, "rescue-pouch": 1 },
    personalByUnit: { "unit-nao": ["reinforced-vest", "rescue-pouch"] },
    tacticalIds: [], enhancementLevels: { "rescue-pouch": 2 },
  };
  const quote = v100UnitPresentation(save, "unit-nao");
  assert.equal(quote.current.hp, 79);
  assert.equal(quote.next.hp, 81);
  nearly(quote.current.healing, 25.99);
  nearly(quote.next.healing, 27.12);
  assert.deepEqual(quote.treatmentProtection, { reduction: .18, seconds: 2.5 });
  assert.equal(quote.equipmentNames.length, 2);
});

test("tactical equipment affects every quote and leaves nonhealers without treatment", () => {
  const save = fixture();
  save.equipment = {
    inventory: { "tactical-field-radio": 1, "tactical-trauma-station": 1 },
    personalByUnit: {}, tacticalIds: ["tactical-field-radio", "tactical-trauma-station"],
    enhancementLevels: { "tactical-field-radio": 2 },
  };
  nearly(v100UnitPresentation(save, "unit-hachi").redeploySeconds, 7.52);
  nearly(v100UnitPresentation(save, "unit-nao").current.healing, 23.32);
  assert.equal(v100UnitPresentation(save, "unit-hachi").current.healing, 0);
  assert.equal(v100UnitPresentation(save, "unit-hachi").treatmentProtection, null);
});

test("level cap and recruitment quote never offer an upgrade to a nonowned unit", () => {
  const save = fixture();
  save.unitLevels["unit-hachi"] = 5;
  const capped = v100UnitPresentation(save, "unit-hachi");
  assert.equal(capped.nextLevel, null);
  assert.equal(capped.next, null);
  assert.equal(capped.upgradeCost, 0);
  const locked = v100UnitPresentation(save, "unit-mizuchi");
  assert.equal(locked.owned, false);
  assert.equal(locked.registered, false);
  assert.equal(locked.next, null);
  assert.equal(locked.registrationCost, 155);
  save.registeredUnitIds.push("unit-mizuchi");
  assert.equal(v100UnitPresentation(save, "unit-mizuchi").registered, true);
});

test("normalization rejects unowned gear allocation without changing the save", () => {
  const save = fixture();
  save.equipment = {
    inventory: {}, personalByUnit: { "unit-hachi": ["reinforced-vest", "rescue-pouch"] },
    tacticalIds: ["tactical-field-radio"], enhancementLevels: { "reinforced-vest": 3 },
  };
  const before = structuredClone(save);
  const quote = v100UnitPresentation(save, "unit-hachi");
  assert.equal(quote.current.hp, 80);
  assert.equal(quote.redeploySeconds, 8);
  assert.deepEqual(quote.equipmentNames, []);
  assert.deepEqual(save, before);
  assert.ok(Object.isFrozen(quote));
  assert.ok(Object.isFrozen(quote.current));
});

test("all canonical characters expose their own ability and unknown identities are rejected", () => {
  const save = fixture();
  const skillNames = new Set();
  for (const unit of V100_UNITS) {
    const quote = v100UnitPresentation(save, unit.id);
    assert.equal(quote.unitId, unit.id);
    assert.equal(quote.displayName, unit.displayName);
    assert.ok(quote.skill?.name);
    assert.ok(quote.skill?.summary);
    assert.ok(quote.skill.cooldownSeconds > 0);
    skillNames.add(quote.skill.name);
  }
  assert.equal(skillNames.size, V100_UNITS.length);
  assert.equal(v100UnitPresentation(save, "unit-not-canonical"), null);
});
