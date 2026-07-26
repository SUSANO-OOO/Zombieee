import { deepFreeze } from "./content/freeze.js";

export const UNIT_LEVEL_MIN = 1;
export const UNIT_LEVEL_MAX = 50;
export const UNIT_LEVEL_PUBLIC_CAP = 25;
export const UNIT_PROGRESSION_MAX_RANK = 4;

export const UNIT_PROGRESSION_RANKS = deepFreeze([
  { rank: 0, displayName: "基礎装備", costCaps: 0 },
  { rank: 1, displayName: "現地改修", costCaps: 60 },
  { rank: 2, displayName: "役割熟練", costCaps: 120 },
  { rank: 3, displayName: "精密調整", costCaps: 200 },
  { rank: 4, displayName: "実戦完成", costCaps: 320 },
]);

export const UNIT_LEVEL_CAP_MILESTONES = deepFreeze([
  { clearedStage: 0, levelCap: 5 },
  { clearedStage: 5, levelCap: 10 },
  { clearedStage: 10, levelCap: 15 },
  { clearedStage: 15, levelCap: 20 },
  { clearedStage: 20, levelCap: 25 },
  { clearedStage: 25, levelCap: 30 },
  { clearedStage: 30, levelCap: 35 },
  { clearedStage: 35, levelCap: 40 },
  { clearedStage: 40, levelCap: 45 },
  { clearedStage: 50, levelCap: 50 },
]);

const ROLE_MILESTONES = deepFreeze({
  frontline: { rank2: "前線装甲", defenseBonus: .03 },
  heavy: { rank2: "重装装甲", defenseBonus: .03 },
  skirmisher: { rank2: "高速展開", speedMultiplier: 1.06 },
  marksman: { rank2: "精密火力", damageMultiplier: 1.05 },
  suppression: { rank2: "制圧連射", attackEveryMultiplier: .95 },
  support: { rank2: "応急熟練", healingMultiplier: 1.06 },
  engineer: { rank2: "拘束強化", trapDurationMultiplier: 1.08 },
});

function integer(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.floor(numeric)));
}

export function unitRankFor(ranks, unitId) {
  return integer(ranks?.[unitId], 0, UNIT_PROGRESSION_MAX_RANK);
}

export function legacyRankToLevel(rank) {
  return unitRankFor({ legacy: rank }, "legacy") + 1;
}

export function unitLevelFor(levels, unitId) {
  return integer(levels?.[unitId], UNIT_LEVEL_MIN, UNIT_LEVEL_MAX);
}

export function normalizeUnitLevels(levels, unitIds = []) {
  return Object.freeze(Object.fromEntries(
    unitIds.map((unitId) => [unitId, unitLevelFor(levels, unitId)]),
  ));
}

export function normalizeUnitRanks(ranks, unitIds = []) {
  return Object.freeze(Object.fromEntries(
    unitIds.map((unitId) => [unitId, unitRankFor(ranks, unitId)]),
  ));
}

export function highestCompletedStageNumber(stageNumbers = []) {
  return stageNumbers.reduce((highest, value) => Math.max(highest, integer(value)), 0);
}

export function unitLevelCapForHighestStage(highestStageNumber = 0) {
  const highest = integer(highestStageNumber);
  return UNIT_LEVEL_CAP_MILESTONES.reduce(
    (cap, milestone) => highest >= milestone.clearedStage ? milestone.levelCap : cap,
    UNIT_LEVEL_MIN,
  );
}

export function unitLevelCost(nextLevel) {
  const level = integer(nextLevel, UNIT_LEVEL_MIN, UNIT_LEVEL_MAX);
  if (level <= 1) return 0;
  if (level <= 5) return UNIT_PROGRESSION_RANKS[level - 1].costCaps;
  const raw = 320 + (level - 5) * 55 + Math.floor((level - 1) / 5) * 35;
  return Math.round(raw / 10) * 10;
}

export const UNIT_LEVEL_COSTS = deepFreeze(Array.from(
  { length: UNIT_LEVEL_MAX },
  (_, index) => ({ level: index + 1, costCaps: unitLevelCost(index + 1) }),
));

export function medianOwnedUnitLevel({ levels = {}, ownedUnitIds = [] } = {}) {
  const ordered = ownedUnitIds.map((unitId) => unitLevelFor(levels, unitId)).sort((left, right) => left - right);
  if (ordered.length === 0) return UNIT_LEVEL_MIN;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : Math.floor((ordered[middle - 1] + ordered[middle]) / 2);
}

export function unitLevelUpgradeQuote({
  unitId,
  levels = {},
  ownedUnitIds = [],
  completedStageCount = 0,
  levelCap = 5,
} = {}) {
  const currentLevel = unitLevelFor(levels, unitId);
  const safeCap = integer(levelCap, UNIT_LEVEL_MIN, UNIT_LEVEL_MAX);
  const nextLevel = currentLevel < Math.min(safeCap, UNIT_LEVEL_MAX) ? currentLevel + 1 : null;
  if (nextLevel === null) {
    return Object.freeze({
      currentLevel,
      nextLevel: null,
      levelCap: safeCap,
      baseCostCaps: 0,
      discountCaps: 0,
      costCaps: 0,
      catchUp: false,
      reason: currentLevel >= UNIT_LEVEL_MAX ? "max-level" : "level-cap",
    });
  }
  const baseCostCaps = unitLevelCost(nextLevel);
  const medianLevel = medianOwnedUnitLevel({ levels, ownedUnitIds });
  const catchUp = integer(completedStageCount) >= 3 && currentLevel < medianLevel;
  const discounted = catchUp ? Math.round(baseCostCaps * .7 / 5) * 5 : baseCostCaps;
  return Object.freeze({
    currentLevel,
    nextLevel,
    levelCap: safeCap,
    baseCostCaps,
    discountCaps: baseCostCaps - discounted,
    costCaps: discounted,
    catchUp,
    reason: "available",
  });
}

export function medianOwnedUnitRank({ ranks = {}, ownedUnitIds = [] } = {}) {
  const ordered = ownedUnitIds.map((unitId) => unitRankFor(ranks, unitId)).sort((left, right) => left - right);
  if (ordered.length === 0) return 0;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : Math.floor((ordered[middle - 1] + ordered[middle]) / 2);
}

export function unitUpgradeQuote({
  unitId,
  ranks = {},
  ownedUnitIds = [],
  completedStageCount = 0,
} = {}) {
  const currentRank = unitRankFor(ranks, unitId);
  const nextRank = Math.min(UNIT_PROGRESSION_MAX_RANK, currentRank + 1);
  if (currentRank >= UNIT_PROGRESSION_MAX_RANK) {
    return Object.freeze({ currentRank, nextRank: null, baseCostCaps: 0, discountCaps: 0, costCaps: 0, catchUp: false });
  }
  const baseCostCaps = UNIT_PROGRESSION_RANKS[nextRank].costCaps;
  const medianRank = medianOwnedUnitRank({ ranks, ownedUnitIds });
  const catchUp = integer(completedStageCount) >= 3 && currentRank < medianRank;
  const discounted = catchUp ? Math.round(baseCostCaps * .7 / 5) * 5 : baseCostCaps;
  return Object.freeze({
    currentRank,
    nextRank,
    baseCostCaps,
    discountCaps: baseCostCaps - discounted,
    costCaps: discounted,
    catchUp,
  });
}

export function unitProgressionMilestones(aiProfile, rank) {
  const safeRank = integer(rank, 0, UNIT_PROGRESSION_MAX_RANK);
  const role = ROLE_MILESTONES[aiProfile] ?? ROLE_MILESTONES.frontline;
  return Object.freeze([
    ...(safeRank >= 2 ? [role.rank2] : []),
    ...(safeRank >= 4 ? ["実戦連携"] : []),
  ]);
}

export function unitLevelMilestones(aiProfile, level) {
  const safeLevel = integer(level, UNIT_LEVEL_MIN, UNIT_LEVEL_MAX);
  const role = ROLE_MILESTONES[aiProfile] ?? ROLE_MILESTONES.frontline;
  return Object.freeze([
    ...(safeLevel >= 3 ? [role.rank2] : []),
    ...(safeLevel >= 5 ? ["実戦連携"] : []),
    ...(safeLevel >= 10 ? ["熟練戦技 I"] : []),
    ...(safeLevel >= 20 ? ["熟練戦技 II"] : []),
    ...(safeLevel >= 30 ? ["熟練戦技 III"] : []),
    ...(safeLevel >= 40 ? ["熟練戦技 IV"] : []),
    ...(safeLevel >= 50 ? ["熟練戦技 V"] : []),
  ]);
}

export function applyUnitLevelProgression(card, level) {
  const safeLevel = integer(level, UNIT_LEVEL_MIN, UNIT_LEVEL_MAX);
  const legacyRank = Math.min(UNIT_PROGRESSION_MAX_RANK, safeLevel - 1);
  const role = ROLE_MILESTONES[card?.aiProfile] ?? ROLE_MILESTONES.frontline;
  const roleMilestoneActive = safeLevel >= 3;
  const postLegacyLevels = Math.max(0, safeLevel - 5);
  const hpMultiplier = 1 + legacyRank * .03 + postLegacyLevels * .012;
  const damageMultiplier = (1 + legacyRank * .03 + postLegacyLevels * .012)
    * (roleMilestoneActive ? role.damageMultiplier ?? 1 : 1);
  const speedMultiplier = (1 + legacyRank * .015 + Math.min(.12, postLegacyLevels * .003))
    * (roleMilestoneActive ? role.speedMultiplier ?? 1 : 1);
  const attackEveryMultiplier = Math.max(.68, 1 - legacyRank * .02 - (safeLevel >= 5 ? .04 : 0) - postLegacyLevels * .006)
    * (roleMilestoneActive ? role.attackEveryMultiplier ?? 1 : 1);
  const defense = Math.min(.22, legacyRank * .015 + postLegacyLevels * .0025
    + (roleMilestoneActive ? role.defenseBonus ?? 0 : 0));
  return Object.freeze({
    ...card,
    progressionLevel: safeLevel,
    progressionRank: legacyRank,
    hp: Math.round(card.hp * hpMultiplier),
    damage: Math.round(card.damage * damageMultiplier * 10) / 10,
    speed: Math.round(card.speed * speedMultiplier * 100) / 100,
    laneSpeed: Math.round(card.laneSpeed * speedMultiplier * 100) / 100,
    range: card.range,
    attackEvery: Math.round(card.attackEvery * attackEveryMultiplier * 1000) / 1000,
    defense: Math.round(defense * 10000) / 10000,
    healingMultiplier: roleMilestoneActive ? role.healingMultiplier ?? 1 : 1,
    trapDurationMultiplier: roleMilestoneActive ? role.trapDurationMultiplier ?? 1 : 1,
    milestones: unitLevelMilestones(card.aiProfile, safeLevel),
  });
}

export function applyUnitProgression(card, rank) {
  return applyUnitLevelProgression(card, legacyRankToLevel(rank));
}

export function damageAfterUnitDefense(damage, defense = 0) {
  const incoming = Math.max(0, Number.isFinite(Number(damage)) ? Number(damage) : 0);
  const reduction = Math.max(0, Math.min(.75, Number.isFinite(Number(defense)) ? Number(defense) : 0));
  return Object.freeze({
    damage: incoming * (1 - reduction),
    prevented: incoming * reduction,
    reduction,
  });
}

export function progressionPowerIndex(card, rank) {
  const progressed = applyUnitProgression(card, rank);
  return Object.freeze({
    durability: (progressed.hp / card.hp) / (1 - progressed.defense),
    damagePerSecond: (progressed.damage / progressed.attackEvery) / (card.damage / card.attackEvery),
    mobility: progressed.speed / card.speed,
    defense: progressed.defense,
  });
}

export function levelProgressionPowerIndex(card, level) {
  const progressed = applyUnitLevelProgression(card, level);
  return Object.freeze({
    durability: (progressed.hp / card.hp) / (1 - progressed.defense),
    damagePerSecond: (progressed.damage / progressed.attackEvery) / (card.damage / card.attackEvery),
    mobility: progressed.speed / card.speed,
    defense: progressed.defense,
  });
}
