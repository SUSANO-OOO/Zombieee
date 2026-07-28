import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMPAIGN_SAVE_SCHEMA_VERSION,
  CAMPAIGN_UNIT_IDS,
  campaignEquipmentQuantity,
  createDefaultCampaignSave,
  deserializeCampaignSave,
  enhanceCampaignEquipment,
  getFormationPresetEquipmentSnapshot,
  migrateCampaignSave,
  purchaseCampaignEquipment,
  serializeCampaignSave,
  setFormationPersonalEquipmentSlot,
  setFormationPresetUnits,
  setFormationTacticalEquipmentSlot,
} from "../app/campaign.js";
import {
  EQUIPMENT_CATALOG,
  EQUIPMENT_MAX_ENHANCEMENT,
  EQUIPMENT_SLOT_TYPES,
  EQUIPMENT_SOURCES,
  aggregateEquipmentEffects,
  equipmentEffectSummary,
  equipmentEnhancementCost,
} from "../app/equipment.js";
import {
  createSurvivalRun,
  normalizeSurvivalRun,
} from "../app/survival.js";

const PRESET_1 = "formation-preset-1";
const PRESET_2 = "formation-preset-2";
const UNIT_1 = CAMPAIGN_UNIT_IDS.PAISEN;
const UNIT_2 = CAMPAIGN_UNIT_IDS.HACHI;
const UNIT_3 = CAMPAIGN_UNIT_IDS.MIZUCHI;

function saveWithInventory(entries, caps = 20_000) {
  return migrateCampaignSave({
    ...createDefaultCampaignSave(),
    caps,
    supplies: caps,
    equipmentInventory: entries,
  });
}

test("catalog fixes twenty stable equipment records without random attributes", () => {
  assert.equal(EQUIPMENT_CATALOG.length, 20);
  assert.equal(new Set(EQUIPMENT_CATALOG.map(({ id }) => id)).size, 20);
  assert.equal(new Set(EQUIPMENT_CATALOG.map(({ displayName }) => displayName)).size, 20);
  assert.equal(new Set(EQUIPMENT_CATALOG.map(({ iconKey }) => iconKey)).size, 20);
  assert.equal(EQUIPMENT_CATALOG.filter(({ source }) => source === EQUIPMENT_SOURCES.BOSS).length, 5);
  assert.equal(EQUIPMENT_CATALOG.filter(({ source, slotType }) => (
    source !== EQUIPMENT_SOURCES.BOSS && slotType === EQUIPMENT_SLOT_TYPES.PERSONAL
  )).length, 10);
  assert.equal(EQUIPMENT_CATALOG.filter(({ source, slotType }) => (
    source !== EQUIPMENT_SOURCES.BOSS && slotType === EQUIPMENT_SLOT_TYPES.TACTICAL
  )).length, 5);
  assert.deepEqual(new Set(EQUIPMENT_CATALOG.map(({ category }) => category)), new Set([
    "weapon",
    "armor",
    "medical",
    "communications",
    "biological",
  ]));
  for (const entry of EQUIPMENT_CATALOG) {
    assert.equal(entry.iconKey, entry.id);
    assert.ok(entry.enhancementBaseCaps > 0);
    assert.ok(Object.keys(entry.effect).length > 0);
    assert.equal("randomOptions" in entry, false);
    assert.equal("rarity" in entry, false);
    for (const tuning of Object.values(entry.effect)) {
      assert.equal(Number.isFinite(tuning.base), true);
      assert.equal(Number.isFinite(tuning.perEnhancement), true);
    }
    if (entry.source === EQUIPMENT_SOURCES.SUPPLY_SHOP) assert.ok(entry.purchaseCaps > 0);
    else assert.equal(entry.purchaseCaps, null);
  }
});

test("fixed effects are deterministic, bounded, and same-ID buffs never stack", () => {
  const levels = { "field-machete": 3, "tactical-field-radio": 5 };
  const first = aggregateEquipmentEffects([
    "field-machete",
    "field-machete",
    "tactical-field-radio",
  ], levels);
  const second = aggregateEquipmentEffects([
    "field-machete",
    "tactical-field-radio",
  ], levels);
  assert.deepEqual(first, second);
  assert.equal(first.damageMultiplier, 1.095);
  assert.equal(first.redeployMultiplier, .91);
  assert.match(equipmentEffectSummary("field-machete", 3), /攻撃 10%/u);
  assert.equal(equipmentEnhancementCost("field-machete", EQUIPMENT_MAX_ENHANCEMENT), null);
});

test("schema 10 Level/economy saves migrate once to schema 13 without a second caps grant", () => {
  const schema10 = {
    ...createDefaultCampaignSave(),
    schemaVersion: 10,
    revision: 9,
    updatedAt: "2026-07-26T00:00:00.000Z",
    caps: 613,
    supplies: 613,
    processedMigrationIds: [],
    unitLevels: {
      ...createDefaultCampaignSave().unitLevels,
      [UNIT_1]: 5,
    },
    unitRanks: {
      ...createDefaultCampaignSave().unitRanks,
      [UNIT_1]: 4,
    },
    equipmentInventory: [
      { equipmentId: "field-machete", quantity: 1 },
      { equipmentId: "field-machete", quantity: 2 },
      { equipmentId: "future-preserved-id", quantity: 4 },
    ],
  };
  const migrated = migrateCampaignSave(schema10);
  assert.equal(CAMPAIGN_SAVE_SCHEMA_VERSION, 13);
  assert.equal(migrated.schemaVersion, 13);
  assert.equal(migrated.revision, 10);
  assert.equal(migrated.caps, 613);
  assert.equal(migrated.unitLevels[UNIT_1], 5);
  assert.deepEqual(migrated.processedMigrationIds, []);
  assert.deepEqual(migrated.equipmentInventory, [
    { equipmentId: "field-machete", quantity: 3 },
    { equipmentId: "future-preserved-id", quantity: 4 },
  ]);
  assert.deepEqual(migrated.equipmentEnhancementLevels, {});
  assert.deepEqual(migrateCampaignSave(migrated), migrated);
});

test("shop purchase is quantity-preserving, caps-backed, and receipt-idempotent", () => {
  const initial = createDefaultCampaignSave();
  const purchased = purchaseCampaignEquipment(initial, {
    equipmentId: "field-machete",
    transactionId: "equipment:purchase:field-machete:1",
  });
  assert.equal(purchased.result.applied, true);
  assert.equal(purchased.result.spentCaps, 240);
  assert.equal(purchased.save.caps, initial.caps - 240);
  assert.equal(campaignEquipmentQuantity(purchased.save, "field-machete"), 1);
  assert.equal(purchased.save.revision, initial.revision + 1);

  const duplicate = purchaseCampaignEquipment(purchased.save, {
    equipmentId: "field-machete",
    transactionId: "equipment:purchase:field-machete:1",
  });
  assert.equal(duplicate.result.alreadyProcessed, true);
  assert.deepEqual(duplicate.save, purchased.save);

  const locked = purchaseCampaignEquipment(purchased.save, {
    equipmentId: "survival-field-kit",
    transactionId: "equipment:purchase:locked",
  });
  assert.equal(locked.result.reason, "not-purchasable");
  assert.deepEqual(locked.save, purchased.save);

  const unknown = purchaseCampaignEquipment(purchased.save, {
    equipmentId: "attacker-controlled",
    transactionId: "equipment:purchase:unknown",
  });
  assert.equal(unknown.result.reason, "unknown-equipment");
  assert.deepEqual(unknown.save, purchased.save);

  const underfunded = purchaseCampaignEquipment({
    ...purchased.save,
    caps: 0,
    supplies: 0,
  }, {
    equipmentId: "field-machete",
    transactionId: "equipment:purchase:underfunded",
  });
  assert.equal(underfunded.result.reason, "insufficient-caps");
  assert.equal(underfunded.save.caps, 0);
});

test("type-wide enhancement buys exactly five fixed stages and cannot partially spend", () => {
  let save = saveWithInventory([{ equipmentId: "field-machete", quantity: 2 }]);
  const costs = [];
  for (let nextLevel = 1; nextLevel <= EQUIPMENT_MAX_ENHANCEMENT; nextLevel += 1) {
    const transactionId = `equipment:enhance:field-machete:${nextLevel}`;
    const enhanced = enhanceCampaignEquipment(save, {
      equipmentId: "field-machete",
      transactionId,
    });
    assert.equal(enhanced.result.applied, true);
    assert.equal(enhanced.result.nextLevel, nextLevel);
    costs.push(enhanced.result.spentCaps);
    save = enhanced.save;
    const duplicate = enhanceCampaignEquipment(save, {
      equipmentId: "field-machete",
      transactionId,
    });
    assert.equal(duplicate.result.alreadyProcessed, true);
    assert.deepEqual(duplicate.save, save);
  }
  assert.deepEqual(costs, [100, 155, 210, 265, 320]);
  assert.equal(save.equipmentEnhancementLevels["field-machete"], 5);
  const capped = enhanceCampaignEquipment(save, {
    equipmentId: "field-machete",
    transactionId: "equipment:enhance:field-machete:6",
  });
  assert.equal(capped.result.reason, "max-enhancement");
  assert.deepEqual(capped.save, save);

  const notOwned = enhanceCampaignEquipment(createDefaultCampaignSave(), {
    equipmentId: "field-machete",
    transactionId: "equipment:enhance:not-owned",
  });
  assert.equal(notOwned.result.reason, "not-owned");
  assert.equal(notOwned.save.caps, createDefaultCampaignSave().caps);
});

test("each preset independently enforces personal and tactical quantities", () => {
  let save = saveWithInventory([
    { equipmentId: "field-machete", quantity: 2 },
    { equipmentId: "reinforced-vest", quantity: 1 },
    { equipmentId: "tactical-field-radio", quantity: 1 },
  ]);
  save = setFormationPresetUnits(save, PRESET_1, [UNIT_1, UNIT_2, UNIT_3]);
  save = setFormationPersonalEquipmentSlot(save, {
    presetId: PRESET_1,
    unitId: UNIT_1,
    slotIndex: 0,
    equipmentId: "field-machete",
  });
  save = setFormationPersonalEquipmentSlot(save, {
    presetId: PRESET_1,
    unitId: UNIT_2,
    slotIndex: 1,
    equipmentId: "field-machete",
  });
  assert.throws(() => setFormationPersonalEquipmentSlot(save, {
    presetId: PRESET_1,
    unitId: UNIT_3,
    slotIndex: 0,
    equipmentId: "field-machete",
  }), /quantity is already allocated/u);
  assert.throws(() => setFormationPersonalEquipmentSlot(save, {
    presetId: PRESET_1,
    unitId: UNIT_1,
    slotIndex: 1,
    equipmentId: "field-machete",
  }), /cannot equip duplicate/u);
  assert.throws(() => setFormationPersonalEquipmentSlot(save, {
    presetId: PRESET_1,
    unitId: UNIT_1,
    slotIndex: 1,
    equipmentId: "tactical-field-radio",
  }), /cannot be assigned/u);

  save = setFormationTacticalEquipmentSlot(save, {
    presetId: PRESET_1,
    slotIndex: 0,
    equipmentId: "tactical-field-radio",
  });
  assert.throws(() => setFormationTacticalEquipmentSlot(save, {
    presetId: PRESET_1,
    slotIndex: 1,
    equipmentId: "tactical-field-radio",
  }), /quantity is already allocated|cannot stack/u);

  save = setFormationPersonalEquipmentSlot(save, {
    presetId: PRESET_2,
    unitId: UNIT_1,
    slotIndex: 0,
    equipmentId: "field-machete",
  });
  save = setFormationTacticalEquipmentSlot(save, {
    presetId: PRESET_2,
    slotIndex: 0,
    equipmentId: "tactical-field-radio",
  });
  const restored = deserializeCampaignSave(serializeCampaignSave(save));
  assert.equal(restored.formationPresets[0].personalEquipmentByUnit[UNIT_2][1], "field-machete");
  assert.equal(restored.formationPresets[0].tacticalEquipmentIds[0], "tactical-field-radio");
  assert.equal(restored.formationPresets[1].personalEquipmentByUnit[UNIT_1][0], "field-machete");
  assert.equal(restored.formationPresets[1].tacticalEquipmentIds[0], "tactical-field-radio");
});

test("removing a unit clears hidden equipment and selected preset snapshots freeze Levels and enhancements", () => {
  let save = saveWithInventory([
    { equipmentId: "field-machete", quantity: 1 },
    { equipmentId: "tactical-field-radio", quantity: 1 },
  ]);
  save = setFormationPresetUnits(save, PRESET_1, [UNIT_1, UNIT_2]);
  save = setFormationPersonalEquipmentSlot(save, {
    presetId: PRESET_1,
    unitId: UNIT_2,
    slotIndex: 1,
    equipmentId: "field-machete",
  });
  save = setFormationTacticalEquipmentSlot(save, {
    presetId: PRESET_1,
    slotIndex: 0,
    equipmentId: "tactical-field-radio",
  });
  save = {
    ...save,
    unitLevels: { ...save.unitLevels, [UNIT_1]: 7 },
    unitRanks: { ...save.unitRanks, [UNIT_1]: 6 },
    equipmentEnhancementLevels: {
      "field-machete": 3,
      "tactical-field-radio": 2,
    },
  };
  const snapshot = getFormationPresetEquipmentSnapshot(save, PRESET_1);
  const run = createSurvivalRun({ runId: "equipment-snapshot", formation: snapshot });
  const normalized = normalizeSurvivalRun(run);
  assert.equal(normalized.formation.unitLevelsByUnit[UNIT_1], 7);
  assert.equal(normalized.formation.personalEquipmentByUnit[UNIT_2][0], "field-machete");
  assert.deepEqual(normalized.formation.tacticalEquipmentIds, ["tactical-field-radio"]);
  assert.deepEqual(normalized.formation.equipmentEnhancementLevels, {
    "field-machete": 3,
    "tactical-field-radio": 2,
  });

  const laterSave = {
    ...save,
    unitLevels: { ...save.unitLevels, [UNIT_1]: 20 },
    equipmentEnhancementLevels: { "field-machete": 5 },
  };
  assert.equal(normalizeSurvivalRun(run).formation.unitLevelsByUnit[UNIT_1], 7);
  assert.equal(normalizeSurvivalRun(run).formation.equipmentEnhancementLevels["field-machete"], 3);
  assert.equal(laterSave.unitLevels[UNIT_1], 20);

  const removed = setFormationPresetUnits(save, PRESET_1, [UNIT_1]);
  assert.equal(removed.formationPresets[0].personalEquipmentByUnit[UNIT_2], undefined);
});
