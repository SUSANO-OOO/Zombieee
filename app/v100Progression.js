import {
  V100_LEVEL_COSTS,
  V100_LEVEL_CAP_MILESTONES,
  v100LevelCapForStage,
  v100LevelCost,
  v100UnitFor,
  v100UnitStatAtLevel,
} from "./v100Registry.js";

export const V100_LEVEL_MIN = 1;
export const V100_LEVEL_MAX = 30;

export function v100UnitLevelFor(levels, unitId) {
  const value = Number(levels?.[unitId]);
  return Number.isFinite(value) ? Math.max(V100_LEVEL_MIN, Math.min(V100_LEVEL_MAX, Math.floor(value))) : V100_LEVEL_MIN;
}

export function normalizeV100UnitLevels(levels, unitIds) {
  return Object.freeze(Object.fromEntries((unitIds ?? []).map((unitId) => [unitId, v100UnitLevelFor(levels, unitId)])));
}

export function v100LevelQuote({ levels = {}, unitId, clearedStageNumber = 0, caps = 0 } = {}) {
  const currentLevel = v100UnitLevelFor(levels, unitId);
  const levelCap = v100LevelCapForStage(clearedStageNumber);
  const nextLevel = currentLevel < levelCap ? currentLevel + 1 : null;
  const costCaps = nextLevel === null ? 0 : v100LevelCost(nextLevel);
  return Object.freeze({
    unitId,
    currentLevel,
    nextLevel,
    levelCap,
    costCaps,
    affordable: nextLevel !== null && Number(caps) >= costCaps,
    reason: nextLevel === null ? "level-cap" : Number(caps) >= costCaps ? "available" : "insufficient-caps",
  });
}

export function applyV100LevelUpgrade({ levels = {}, unitId, clearedStageNumber = 0, caps = 0, receiptIds = [] } = {}) {
  const quote = v100LevelQuote({ levels, unitId, clearedStageNumber, caps });
  if (quote.nextLevel === null || !quote.affordable) return Object.freeze({ applied: false, reason: quote.reason, quote });
  const receipt = `v100:unit:${unitId}:level:${quote.nextLevel}`;
  if (receiptIds.includes(receipt)) return Object.freeze({ applied: false, duplicate: true, reason: "duplicate-receipt", quote });
  return Object.freeze({
    applied: true,
    receipt,
    quote,
    levels: Object.freeze({ ...levels, [unitId]: quote.nextLevel }),
    capsAfter: Math.max(0, Math.floor(Number(caps)) - quote.costCaps),
  });
}

export function v100LevelStats(base, level) {
  return Object.freeze({
    hp: v100UnitStatAtLevel(base?.hp ?? 0, level, "hp"),
    damage: v100UnitStatAtLevel(base?.damage ?? 0, level, "damage"),
    healing: v100UnitStatAtLevel(base?.healing ?? 0, level, "healing"),
    cooldown: base?.cooldown,
    range: base?.range,
    movement: base?.movement,
    animationDuration: base?.animationDuration,
    targetSelection: base?.targetSelection,
  });
}

export function v100UnitProgressionSnapshot({ unitId, level = 1, baseStats = {} } = {}) {
  const unit = v100UnitFor(unitId);
  const safeLevel = v100UnitLevelFor({ [unitId]: level }, unitId);
  return Object.freeze({
    unitId,
    displayName: unit?.displayName ?? unitId,
    role: unit?.role ?? "unknown",
    level: safeLevel,
    stats: v100LevelStats(baseStats, safeLevel),
  });
}

export function v100ProgressionContract() {
  return Object.freeze({
    levelMin: V100_LEVEL_MIN,
    levelMax: V100_LEVEL_MAX,
    levelCosts: V100_LEVEL_COSTS,
    levelCaps: V100_LEVEL_CAP_MILESTONES,
    statScaling: Object.freeze({ hp: 0.025, damage: 0.02, healing: 0.02 }),
    unscaled: Object.freeze(["cooldown", "range", "movement", "animationDuration", "targetSelection"]),
  });
}
