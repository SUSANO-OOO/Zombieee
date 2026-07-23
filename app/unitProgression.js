import { deepFreeze } from "./content/freeze.js";

export const UNIT_PROGRESSION_MAX_RANK = 4;

export const UNIT_PROGRESSION_RANKS = deepFreeze([
  { rank: 0, displayName: "基礎装備", costCaps: 0 },
  { rank: 1, displayName: "現地改修", costCaps: 60 },
  { rank: 2, displayName: "役割熟練", costCaps: 120 },
  { rank: 3, displayName: "精密調整", costCaps: 200 },
  { rank: 4, displayName: "実戦完成", costCaps: 320 },
]);

const ROLE_MILESTONES = deepFreeze({
  frontline: { rank2: "前線耐久", hpMultiplier: 1.06 },
  heavy: { rank2: "重装耐久", hpMultiplier: 1.06 },
  skirmisher: { rank2: "高速展開", speedMultiplier: 1.06 },
  marksman: { rank2: "射線延伸", rangeMultiplier: 1.05 },
  suppression: { rank2: "制圧延伸", rangeMultiplier: 1.05 },
  support: { rank2: "支援延伸", rangeMultiplier: 1.06 },
  engineer: { rank2: "工兵延伸", rangeMultiplier: 1.06 },
});

function integer(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.floor(numeric)));
}

export function unitRankFor(ranks, unitId) {
  return integer(ranks?.[unitId], 0, UNIT_PROGRESSION_MAX_RANK);
}

export function normalizeUnitRanks(ranks, unitIds = []) {
  return Object.freeze(Object.fromEntries(
    unitIds.map((unitId) => [unitId, unitRankFor(ranks, unitId)]),
  ));
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

export function applyUnitProgression(card, rank) {
  const safeRank = integer(rank, 0, UNIT_PROGRESSION_MAX_RANK);
  const role = ROLE_MILESTONES[card?.aiProfile] ?? ROLE_MILESTONES.frontline;
  const hpMultiplier = (1 + safeRank * .04) * (safeRank >= 2 ? role.hpMultiplier ?? 1 : 1);
  const damageMultiplier = 1 + safeRank * .03;
  const speedMultiplier = (1 + safeRank * .015) * (safeRank >= 2 ? role.speedMultiplier ?? 1 : 1);
  const rangeMultiplier = (1 + safeRank * .01) * (safeRank >= 2 ? role.rangeMultiplier ?? 1 : 1);
  const attackEveryMultiplier = 1 - safeRank * .02 - (safeRank >= 4 ? .04 : 0);
  return Object.freeze({
    ...card,
    progressionRank: safeRank,
    hp: Math.round(card.hp * hpMultiplier),
    damage: Math.round(card.damage * damageMultiplier * 10) / 10,
    speed: Math.round(card.speed * speedMultiplier * 100) / 100,
    laneSpeed: Math.round(card.laneSpeed * speedMultiplier * 100) / 100,
    range: Math.round(card.range * rangeMultiplier * 10) / 10,
    attackEvery: Math.round(card.attackEvery * attackEveryMultiplier * 1000) / 1000,
    milestones: unitProgressionMilestones(card.aiProfile, safeRank),
  });
}

export function progressionPowerIndex(card, rank) {
  const progressed = applyUnitProgression(card, rank);
  return Object.freeze({
    durability: progressed.hp / card.hp,
    damagePerSecond: (progressed.damage / progressed.attackEvery) / (card.damage / card.attackEvery),
    mobility: progressed.speed / card.speed,
    reach: progressed.range / card.range,
  });
}
