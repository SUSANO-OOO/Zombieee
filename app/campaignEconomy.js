import { deepFreeze } from "./content/freeze.js";

export const V090_CAPS_MIGRATION_ID = "migration:0.9.0-caps-economy-v1";
export const V090_CAPS_MIGRATION_BASE = 800;
export const V090_CAPS_MIGRATION_BONUS_CAP = 2_200;
export const V090_STARTER_EQUIPMENT_BUDGET = 240;

function integer(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.floor(numeric)));
}

export function reorganizeLegacyCaps(value) {
  const previousCaps = integer(value);
  const scaledBonus = Math.round(Math.sqrt(previousCaps) * 25 / 10) * 10;
  const migrationBonus = Math.min(V090_CAPS_MIGRATION_BONUS_CAP, scaledBonus);
  return deepFreeze({
    migrationId: V090_CAPS_MIGRATION_ID,
    previousCaps,
    baseGrant: V090_CAPS_MIGRATION_BASE,
    migrationBonus,
    nextCaps: V090_CAPS_MIGRATION_BASE + migrationBonus,
  });
}

export function capsMigrationNotice(migration) {
  return deepFreeze({
    id: V090_CAPS_MIGRATION_ID,
    title: "Version 0.9.0 キャップ経済再編",
    body: `旧キャップ ${migration.previousCaps} を新経済の共通開始資金 ${migration.nextCaps} へ一度だけ再編しました。所有ユニット、Stage進行、星、既読、編成、設定、移行後Levelは維持されています。`,
    previousCaps: migration.previousCaps,
    nextCaps: migration.nextCaps,
  });
}

export function economyAffordabilitySnapshot({
  startingCaps,
  levelCosts = [],
  starterEquipmentCost = V090_STARTER_EQUIPMENT_BUDGET,
} = {}) {
  const budget = integer(startingCaps);
  const equipmentCost = integer(starterEquipmentCost);
  let remaining = Math.max(0, budget - equipmentCost);
  let affordableLevelUps = 0;
  for (const cost of levelCosts) {
    const normalizedCost = integer(cost);
    if (normalizedCost <= 0 || remaining < normalizedCost) break;
    remaining -= normalizedCost;
    affordableLevelUps += 1;
  }
  return deepFreeze({
    startingCaps: budget,
    starterEquipmentCost: equipmentCost,
    affordableLevelUps,
    remainingCaps: remaining,
  });
}
