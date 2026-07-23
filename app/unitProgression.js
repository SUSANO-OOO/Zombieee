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
  const roleMilestoneActive = safeRank >= 2;
  const hpMultiplier = 1 + safeRank * .03;
  const damageMultiplier = (1 + safeRank * .03) * (roleMilestoneActive ? role.damageMultiplier ?? 1 : 1);
  const speedMultiplier = (1 + safeRank * .015) * (safeRank >= 2 ? role.speedMultiplier ?? 1 : 1);
  const attackEveryMultiplier = (1 - safeRank * .02 - (safeRank >= 4 ? .04 : 0))
    * (roleMilestoneActive ? role.attackEveryMultiplier ?? 1 : 1);
  const defense = safeRank * .015 + (roleMilestoneActive ? role.defenseBonus ?? 0 : 0);
  return Object.freeze({
    ...card,
    progressionRank: safeRank,
    hp: Math.round(card.hp * hpMultiplier),
    damage: Math.round(card.damage * damageMultiplier * 10) / 10,
    speed: Math.round(card.speed * speedMultiplier * 100) / 100,
    laneSpeed: Math.round(card.laneSpeed * speedMultiplier * 100) / 100,
    range: card.range,
    attackEvery: Math.round(card.attackEvery * attackEveryMultiplier * 1000) / 1000,
    defense: Math.round(defense * 10000) / 10000,
    healingMultiplier: roleMilestoneActive ? role.healingMultiplier ?? 1 : 1,
    trapDurationMultiplier: roleMilestoneActive ? role.trapDurationMultiplier ?? 1 : 1,
    milestones: unitProgressionMilestones(card.aiProfile, safeRank),
  });
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
