import { EQUIPMENT_CATALOG, EQUIPMENT_MAX_ENHANCEMENT, aggregateEquipmentEffects } from "./equipment.js";
import { V100_UNITS, V100_STAGE_IDS } from "./v100Registry.js";

// Vehicle HP has one V1 formula: canonical base plus permanent upgrades.
const purchaseGates = Object.freeze({ "quick-loader": 3, "survey-scope": 6, "recoil-brace": 9, "contamination-filter": 9, "tactical-field-radio": 6, "tactical-supply-cache": 9, "tactical-trauma-station": 12, "tactical-flare-controller": 15 });
export const V100_EQUIPMENT_CATALOG = Object.freeze(EQUIPMENT_CATALOG.filter(item => item.id !== "tactical-barricade-kit").map((item, artCell) => Object.freeze({ ...item, unlockStageNumber: purchaseGates[item.id] ?? 0, artCell })));
export const V100_INITIAL_SUPPORT_GAUGE = 85;
const catalog = new Map(V100_EQUIPMENT_CATALOG.map(item => [item.id, item]));
const record = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const bounded = (value, max) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(max, Math.floor(Number(value)))) : 0;

export function v100EquipmentFor(id) { return catalog.get(id) ?? null; }
export function v100EquipmentPurchaseUnlocked(save, id) {
  const item = v100EquipmentFor(id);
  if (!item || item.source !== "supply-shop") return false;
  // A later presentation/balance gate never revokes already earned ownership.
  return (save?.equipment?.inventory?.[id] ?? 0) > 0 || item.unlockStageNumber === 0
    || (save?.completedStageIds ?? []).includes(V100_STAGE_IDS[item.unlockStageNumber - 1]);
}
export function v100EquipmentQuantityCap(id) { return v100EquipmentFor(id)?.slotType === "personal" ? V100_UNITS.length : 1; }

export function normalizeV100Equipment(raw, ownedUnitIds = []) {
  const source = record(raw);
  const inventory = Object.fromEntries(Object.entries(record(source.inventory))
    .filter(([id]) => catalog.has(id))
    .map(([id, count]) => [id, bounded(count, v100EquipmentQuantityCap(id))]).filter(([, count]) => count > 0));
  const enhancementLevels = Object.fromEntries(Object.entries(record(source.enhancementLevels))
    .filter(([id]) => Object.hasOwn(inventory, id))
    .map(([id, level]) => [id, bounded(level, EQUIPMENT_MAX_ENHANCEMENT)]).filter(([, level]) => level > 0));
  const used = new Map();
  const slots = (value, type) => {
    const selected = new Set();
    return [0, 1].map(index => {
      const id = Array.isArray(value) ? value[index] : null;
      if (!catalog.has(id) || catalog.get(id).slotType !== type || selected.has(id)
        || (used.get(id) ?? 0) >= (inventory[id] ?? 0)) return null;
      selected.add(id); used.set(id, (used.get(id) ?? 0) + 1); return id;
    });
  };
  const personalByUnit = Object.fromEntries(V100_UNITS.filter(unit => ownedUnitIds.includes(unit.id))
    .map(unit => [unit.id, slots(record(source.personalByUnit)[unit.id], "personal")])
    .filter(([, assigned]) => assigned.some(Boolean)));
  return { inventory, personalByUnit, tacticalIds: slots(source.tacticalIds, "tactical"), enhancementLevels };
}

export function v100EquipmentSnapshot(save) {
  const equipment = normalizeV100Equipment(save?.equipment, save?.ownedUnitIds ?? []);
  return Object.freeze({
    personalEquipmentByUnit: Object.freeze(Object.fromEntries(Object.entries(equipment.personalByUnit)
      .map(([unitId, ids]) => [unitId, Object.freeze(ids)]))),
    tacticalEquipmentIds: Object.freeze(equipment.tacticalIds.filter(Boolean)),
    equipmentEnhancementLevels: Object.freeze(equipment.enhancementLevels),
  });
}

export function v100OpeningSupportGauge(snapshot) {
  const effects = aggregateEquipmentEffects(snapshot.tacticalEquipmentIds, snapshot.equipmentEnhancementLevels);
  return Math.min(100, V100_INITIAL_SUPPORT_GAUGE + effects.supportGaugeFlat);
}
