import { campaignUnitIdToCombatKind } from "./campaign.js";
import { unitContentFor } from "./content/unitCatalog.js";
import { aggregateEquipmentEffects, EQUIPMENT_BY_ID } from "./equipment.js";
import { MANUAL_ABILITY_REGISTRY } from "./manualAbilities.js";
import { UNIT_ROLE_TUNING } from "./unitRoleMechanics.js";
import { applyUnitEquipmentEffects } from "./unitEquipmentStats.js";
import { v100EquipmentSnapshot } from "./v100Equipment.js";
import { applyV100UnitLevelProgression, v100UnitLevelFor } from "./v100Progression.js";
import { V100_UNIT_BY_ID, v100BossForStage, v100LevelCost, v100UnitStatAtLevel } from "./v100Registry.js";
import { v100RoleLabelFor } from "./v100Terminology.js";

export function formatV100Number(value, digits = 2) {
  return Number(value).toFixed(digits).replace(/(\.\d*?[1-9])0+$|\.0+$/u, "$1");
}

/** A read-only quote from the same level, allocation and equipment formula as battle. */
export function v100UnitPresentation(save, unitId) {
  const unit = V100_UNIT_BY_ID[unitId];
  const kind = campaignUnitIdToCombatKind(unitId);
  const base = unitContentFor(kind);
  if (!unit || !base) return null;
  const snapshot = v100EquipmentSnapshot(save);
  const equipmentIds = [...(snapshot.personalEquipmentByUnit[unitId] ?? []), ...snapshot.tacticalEquipmentIds].filter(Boolean);
  const effects = aggregateEquipmentEffects(equipmentIds, snapshot.equipmentEnhancementLevels);
  const level = v100UnitLevelFor(save?.unitLevels, unitId);
  const levelCap = Math.max(1, Math.min(30, Number(save?.levelCap) || 5));
  const owned = (save?.ownedUnitIds ?? []).includes(unitId);
  const registered = (save?.registeredUnitIds ?? []).includes(unitId);
  const nextLevel = owned && level < levelCap ? level + 1 : null;
  const statsAt = (atLevel) => {
    const equipped = applyUnitEquipmentEffects(applyV100UnitLevelProgression(base, atLevel), effects);
    return Object.freeze({
      ...equipped,
      healing: kind === "medic"
        ? v100UnitStatAtLevel(UNIT_ROLE_TUNING.nao.baseHealing, atLevel, "healing") * equipped.healingMultiplier
        : 0,
    });
  };
  const current = statsAt(level);
  const next = nextLevel === null ? null : statsAt(nextLevel);
  const outputStat = kind === "medic" ? "healing" : "damage";
  let nextOutputGrowth = null;
  if (owned) for (let futureLevel = level + 1; futureLevel <= 30; futureLevel += 1) {
    const value = statsAt(futureLevel)[outputStat];
    if (value > current[outputStat]) {
      nextOutputGrowth = Object.freeze({ stat: outputStat, level: futureLevel, value, withinCap: futureLevel <= levelCap });
      break;
    }
  }
  const ability = MANUAL_ABILITY_REGISTRY[kind];
  return Object.freeze({
    unitId, kind, displayName: unit.displayName, role: unit.role,
    roleLabel: v100RoleLabelFor(unit.role), description: base.desc,
    owned, registered, level, levelCap, nextLevel,
    status: owned ? "配備登録済" : registered ? "配備登録可" : "未解放",
    registrationCost: unit.registrationCostCaps,
    upgradeCost: nextLevel === null ? 0 : v100LevelCost(nextLevel),
    commandCost: base.cost, redeploySeconds: current.deployCooldown,
    attackType: base.range >= 80 ? "ranged" : "melee",
    current, next, nextOutputGrowth,
    equipmentNames: Object.freeze(equipmentIds.map((id) => EQUIPMENT_BY_ID[id]?.displayName).filter(Boolean)),
    skill: ability ? Object.freeze({ name: ability.displayName, summary: ability.unitId === "unit-nao" ? "HPの減った味方を回復。4秒間、受けるダメージを28%軽減。" : ability.summary, detail: ability.summary, cooldownSeconds: ability.cooldownSeconds }) : null,
    treatmentProtection: kind === "medic" ? Object.freeze({
      reduction: UNIT_ROLE_TUNING.nao.damageReduction,
      seconds: UNIT_ROLE_TUNING.nao.damageReductionSeconds,
    }) : null,
  });
}

export function v100TacticalHintFor(stage) {
  if (!stage) return "前衛で敵を止め、射撃と回復を組み合わせる。";
  if (v100BossForStage(stage.number)?.id === "boss-kurome") return "クロメの照準が付いた隊員をタップで回避。";
  if (stage.missionType === "boss") return "大技の予告を確認。守備の固有技と回復支援で持ちこたえる。";
  if (stage.missionType === "escort") return "前衛と足止め役で、護衛対象へ近づく敵を止める。";
  if (stage.missionType === "timed-defense") return "前衛・射撃・回復を組み合わせ、防衛線を維持する。";
  if (Number(stage.number) >= 21) return "盾持ちには重装兵、射撃兵には遊撃兵。固有技で敵を足止め。";
  return "前衛で敵を止め、射撃と回復で部隊を支える。";
}

export function v100SupportPurposeFor(supportId) {
  if (supportId === "support-healing") return "味方を回復し、前線を維持。";
  if (supportId === "support-incendiary-drum") return "炎上する範囲で敵を継続して攻撃。";
  return "普通のドラム缶。遮蔽物として敵の進路を妨げる。";
}
