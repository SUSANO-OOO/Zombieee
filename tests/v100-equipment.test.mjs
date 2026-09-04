import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultV100Save, serializeV100Save, deserializeV100Save, normalizeV100Save } from "../app/v100Save.js";
import { purchaseV100Equipment, upgradeV100Equipment, equipV100Equipment } from "../app/v100Transactions.js";
import { V100_EQUIPMENT_CATALOG, v100EquipmentFor, normalizeV100Equipment } from "../app/v100Equipment.js";
import { V100_UNITS, V100_STAGE_IDS } from "../app/v100Registry.js";
import { v100ProductionSessionFor } from "../app/v100BattleAdapter.js";
import { aggregateEquipmentEffects, equipmentEnhancementCost } from "../app/equipment.js";

const funded = () => ({ ...createDefaultV100Save(), caps: 20000, ownedUnitIds: V100_UNITS.map(unit => unit.id) });
const buy = (save, id) => purchaseV100Equipment(save, id, { expectedQuantity: save.equipment.inventory[id] ?? 0 });
const reload = save => { const result = deserializeV100Save(serializeV100Save(save)); assert.equal(result.ok, true); return result.save; };
const session = save => v100ProductionSessionFor({ save, stageId: V100_STAGE_IDS[0], resultId: "gear-proof" });

test("V1 catalog excludes conflicting vehicle HP and rejects prototype/legacy inventory", () => {
  assert.equal(V100_EQUIPMENT_CATALOG.length, 19);
  assert.equal(V100_EQUIPMENT_CATALOG.filter(item => item.source === "supply-shop").length, 12);
  for (const id of ["tactical-barricade-kit", "toString", "__proto__", "constructor", null]) {
    assert.equal(v100EquipmentFor(id), null);
    assert.equal(buy(funded(), id).applied, false);
  }
  const old = funded(); delete old.equipment;
  old.equipmentInventory = [{ equipmentId: "field-machete", quantity: 9 }];
  old.personalEquipmentByUnit = { [V100_UNITS[0].id]: ["field-machete"] };
  assert.deepEqual(reload(old).equipment, normalizeV100Equipment(null));
});

test("purchase and enhancement settle once across reload, with exact CAPS and receipts", () => {
  const before = funded(), bought = buy(before, "field-machete");
  assert.equal(bought.applied, true); assert.equal(bought.save.caps, 19760);
  assert.equal(before.caps, 20000); assert.deepEqual(before.equipment.inventory, {});
  let save = reload(bought.save);
  assert.equal(purchaseV100Equipment(save, "field-machete", { expectedQuantity: 0 }).applied, false);
  const next = buy(save, "field-machete"); assert.equal(next.save.caps, 19520);
  save = next.save;
  for (let level = 0; level < 5; level += 1) {
    const cost = equipmentEnhancementCost("field-machete", level), caps = save.caps;
    const upgraded = upgradeV100Equipment(save, "field-machete", { expectedLevel: level });
    assert.equal(upgraded.applied, true); save = reload(upgraded.save);
    assert.equal(save.caps, caps - cost); assert.equal(save.equipment.enhancementLevels["field-machete"], level + 1);
    assert.equal(upgradeV100Equipment(save, "field-machete", { expectedLevel: level }).applied, false);
  }
  assert.equal(upgradeV100Equipment(save, "field-machete", { expectedLevel: 5 }).reason, "upgrade-cap");
  assert.equal(new Set(save.receipts).size, 7);
});

test("unaffordable, unowned, stale and capped transactions preserve the normalized save", () => {
  const save = funded(); save.caps = 0;
  for (const action of [() => buy(save, "field-machete"), () => buy(save, "boss-muscle-fiber"),
    () => upgradeV100Equipment(save, "field-machete", { expectedLevel: 0 }),
    () => purchaseV100Equipment(save, "field-machete", {})]) {
    const result = action(); assert.equal(result.applied, false); assert.deepEqual(result.save, normalizeV100Save(save));
  }
  const capped = buy(funded(), "tactical-field-radio").save;
  assert.equal(buy(capped, "tactical-field-radio").reason, "equipment-cap");
  const staleReceipt = funded(); staleReceipt.receipts.push("v100:equipment:field-machete:purchase:1");
  assert.equal(buy(staleReceipt, "field-machete").reason, "stale-equipment");
});

test("personal slots enforce quantities and reject duplicates without moving another unit's item", () => {
  const [first, second] = V100_UNITS;
  let save = buy(funded(), "field-machete").save;
  save = equipV100Equipment(save, { unitId: first.id, slot: 0, equipmentId: "field-machete" }).save;
  for (const args of [{ unitId: first.id, slot: 1 }, { unitId: second.id, slot: 0 }]) {
    const result = equipV100Equipment(save, { ...args, equipmentId: "field-machete" });
    assert.equal(result.reason, "equipment-in-use"); assert.deepEqual(result.save, normalizeV100Save(save));
  }
  save = buy(save, "field-machete").save;
  const secondEquipped = equipV100Equipment(save, { unitId: second.id, slot: 0, equipmentId: "field-machete" });
  assert.equal(secondEquipped.applied, true); save = reload(secondEquipped.save);
  assert.deepEqual(save.equipment.personalByUnit[first.id], ["field-machete", null]);
  assert.deepEqual(save.equipment.personalByUnit[second.id], ["field-machete", null]);
  for (const args of [{ unitId: first.id, slot: -1 }, { unitId: first.id, slot: 2 }, { unitId: "toString", slot: 0 }, { slot: 0 }]) {
    assert.equal(equipV100Equipment(save, { ...args, equipmentId: "field-machete" }).applied, false);
  }
  save = equipV100Equipment(save, { unitId: first.id, slot: 0 }).save;
  assert.equal(save.equipment.personalByUnit[first.id], undefined);
});

test("normalization removes invalid slot types, excess allocation and unowned enhancements deterministically", () => {
  const [first, second] = V100_UNITS;
  const equipment = normalizeV100Equipment({ inventory: JSON.parse('{"field-machete":1,"tactical-field-radio":99,"__proto__":999,"tactical-barricade-kit":1}'),
    personalByUnit: { [first.id]: ["field-machete", "field-machete"], [second.id]: ["field-machete", "tactical-field-radio"] },
    tacticalIds: ["tactical-field-radio", "tactical-field-radio"], enhancementLevels: { "field-machete": 999, "quick-loader": 5 } }, [first.id, second.id]);
  assert.deepEqual(equipment.inventory, { "field-machete": 1, "tactical-field-radio": 1 });
  assert.deepEqual(equipment.personalByUnit, { [first.id]: ["field-machete", null] });
  assert.deepEqual(equipment.tacticalIds, ["tactical-field-radio", null]);
  assert.deepEqual(equipment.enhancementLevels, { "field-machete": 5 });
});

test("production binds immutable V1 gear, shared character copies, opening support and canonical HP", () => {
  let save = funded(); const id = V100_UNITS[0].id;
  for (const equipmentId of ["field-machete", "tactical-flare-controller", "tactical-supply-cache"]) save = buy(save, equipmentId).save;
  save = equipV100Equipment(save, { unitId: id, slot: 0, equipmentId: "field-machete" }).save;
  save = equipV100Equipment(save, { slot: 0, equipmentId: "tactical-flare-controller" }).save;
  save = equipV100Equipment(save, { slot: 1, equipmentId: "tactical-supply-cache" }).save;
  save.formationSlots = Array(7).fill(id);
  let actual = session(reload(save));
  assert.equal(actual.formationKinds.length, 7); assert.equal(actual.initialSupportGauge, 92); assert.equal(actual.vehicleMaxHp, 680);
  assert.equal(aggregateEquipmentEffects(actual.equipmentSnapshot.personalEquipmentByUnit[id]).damageMultiplier, 1.05);
  assert.equal(aggregateEquipmentEffects(actual.equipmentSnapshot.tacticalEquipmentIds).startingEnergyFlat, 8);
  assert.throws(() => actual.equipmentSnapshot.personalEquipmentByUnit[id].push("quick-loader"), TypeError);
  for (let level = 0; level < 5; level++) save = upgradeV100Equipment(save, "tactical-flare-controller", { expectedLevel: level }).save;
  save.vehicle.upgradeLevel = 5;
  actual = session(reload(save)); assert.equal(actual.initialSupportGauge, 100); assert.equal(actual.vehicleMaxHp, 1080);
  assert.equal(session(createDefaultV100Save()).initialSupportGauge, 85);
});
