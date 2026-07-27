import { bossCampaignEntry, bossDefinitionForEnemyKind } from "./bossFoundation.js";
import { deepFreeze } from "./content/freeze.js";

export const OUTBREAK_PROGRESS_SCHEMA_VERSION = 1;

export const OUTBREAK_MISSION_IDS = deepFreeze({
  MOTHER_BROOD_VAULT: "outbreak-mother-brood-vault",
  OOGUCHI_DRAINAGE_RUN: "outbreak-ooguchi-drainage-run",
  KUROME_BLIND_SECTOR: "outbreak-kurome-blind-sector",
  GAIREN_BREAKER_DECK: "outbreak-gairen-breaker-deck",
  FUTAGO_SHELTER_SEAM: "outbreak-futago-shelter-seam",
});

const encounter = ({
  id,
  displayName,
  location,
  prerequisiteStageId,
  bossKind,
  backgroundId,
  objective,
  waves,
  baseRewardCaps,
}) => deepFreeze({
  id,
  operationCategory: "outbreak",
  displayName,
  location,
  prerequisiteStageId,
  missionType: "boss-assault",
  objectivePattern: "boss-gated-assault",
  objective,
  objectiveConfig: {
    target: "infected-base",
    spawnProfile: "right-edge-outside-boss",
    outbreakMissionId: id,
  },
  theme: {
    id: `theme-${id}`,
    backgroundId,
    tags: ["異常発生", location, bossKind],
  },
  enemyKinds: [...new Set(waves.flatMap((wave) => (
    Array.isArray(wave.units)
      ? wave.units
      : (wave.groups ?? []).map(({ kind }) => kind)
  )))],
  waves,
  boss: bossCampaignEntry(bossKind, {
    encounterId: `encounter-${id}`,
    entranceEventId: null,
  }),
  baseHp: 620,
  baseRewardCaps,
  firstClearEquipmentGrant: bossDefinitionForEnemyKind(bossKind)?.reward ?? null,
});

export const OUTBREAK_MISSIONS = deepFreeze([
  encounter({
    id: OUTBREAK_MISSION_IDS.MOTHER_BROOD_VAULT,
    displayName: "異常発生 // マザー",
    location: "湾岸タワー・沈下搬入口",
    prerequisiteStageId: "stage-bay-tower-service",
    bossKind: "mother",
    backgroundId: "background-bay-tower-service-v1",
    objective: "増殖室を制圧し、マザーを撃破",
    baseRewardCaps: 420,
    waves: [
      { id: "mother-screen", atSeconds: 0, groups: [{ kind: "cagewalker", count: 2 }, { kind: "runner", count: 4 }] },
      { id: "mother-warning", atSeconds: 24, waveNumber: 2, label: "増殖室 // 多数の心拍", units: ["resonator", "spindle"] },
      { id: "mother-entry", atSeconds: 42, waveNumber: 3, label: "マザー // 増殖室離床", units: ["mother", "runner", "runner"] },
    ],
  }),
  encounter({
    id: OUTBREAK_MISSION_IDS.OOGUCHI_DRAINAGE_RUN,
    displayName: "異常発生 // オオグチ",
    location: "市民資料館・排水搬送路",
    prerequisiteStageId: "stage-civic-archive-route",
    bossKind: "ooguchi",
    backgroundId: "background-civic-archive-route-v1",
    objective: "突進経路を外し、オオグチを撃破",
    baseRewardCaps: 450,
    waves: [
      { id: "ooguchi-screen", atSeconds: 0, groups: [{ kind: "spindle", count: 4 }, { kind: "choir-knot", count: 2 }] },
      { id: "ooguchi-warning", atSeconds: 22, waveNumber: 2, label: "排水路 // 高速接近", units: ["runner", "runner"] },
      { id: "ooguchi-entry", atSeconds: 37, waveNumber: 3, label: "オオグチ // 搬送路突入", units: ["ooguchi", "spindle"] },
    ],
  }),
  encounter({
    id: OUTBREAK_MISSION_IDS.KUROME_BLIND_SECTOR,
    displayName: "異常発生 // クロメ",
    location: "河口防潮門・盲区画",
    prerequisiteStageId: "stage-estuary-floodgate-seal",
    bossKind: "kurome",
    backgroundId: "background-estuary-floodgate-seal-v1",
    objective: "追跡眼を回避し、再活性クロメを撃破",
    baseRewardCaps: 500,
    waves: [
      { id: "kurome-screen", atSeconds: 0, groups: [{ kind: "pall-manta", count: 2 }, { kind: "resonator", count: 2 }] },
      { id: "kurome-warning", atSeconds: 25, waveNumber: 2, label: "盲区画 // 視線反応", units: ["anchor-bloom"] },
      { id: "kurome-entry", atSeconds: 43, waveNumber: 3, label: "クロメ // 追跡再開", units: ["kurome", "pall-manta"] },
    ],
  }),
  encounter({
    id: OUTBREAK_MISSION_IDS.GAIREN_BREAKER_DECK,
    displayName: "異常発生 // ガイレン",
    location: "海浜連絡橋・遮断器甲板",
    prerequisiteStageId: "stage-coastal-link-bridge",
    bossKind: "gairen",
    backgroundId: "background-coastal-link-bridge-v1",
    objective: "外殻の開閉を見切り、ガイレンを撃破",
    baseRewardCaps: 480,
    waves: [
      { id: "gairen-screen", atSeconds: 0, groups: [{ kind: "cagewalker", count: 2 }, { kind: "pall-manta", count: 2 }] },
      { id: "gairen-warning", atSeconds: 24, waveNumber: 2, label: "遮断器甲板 // 装甲反応", units: ["anchor-bloom"] },
      { id: "gairen-entry", atSeconds: 41, waveNumber: 3, label: "ガイレン // 外殻展開", units: ["gairen", "cagewalker"] },
    ],
  }),
  encounter({
    id: OUTBREAK_MISSION_IDS.FUTAGO_SHELTER_SEAM,
    displayName: "異常発生 // フタゴ",
    location: "防潮門避難区・継ぎ目",
    prerequisiteStageId: "stage-estuary-floodgate-seal",
    bossKind: "futago",
    backgroundId: "background-estuary-floodgate-seal-v1",
    objective: "融合と分裂を突破し、フタゴを撃破",
    baseRewardCaps: 520,
    waves: [
      { id: "futago-screen", atSeconds: 0, groups: [{ kind: "choir-knot", count: 2 }, { kind: "resonator", count: 3 }] },
      { id: "futago-warning", atSeconds: 26, waveNumber: 2, label: "避難区 // 二重生体反応", units: ["spindle", "spindle"] },
      { id: "futago-entry", atSeconds: 44, waveNumber: 3, label: "フタゴ // 融合体侵入", units: ["futago", "choir-knot"] },
    ],
  }),
]);

export const OUTBREAK_MISSION_BY_ID = deepFreeze(Object.fromEntries(
  OUTBREAK_MISSIONS.map((mission) => [mission.id, mission]),
));

function uniqueStrings(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry) => typeof entry === "string" && entry.length > 0))];
}

function countRecord(value, allowedIds) {
  const allowed = new Set(allowedIds);
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([id]) => allowed.has(id))
    .map(([id, count]) => [id, Math.max(0, Math.floor(Number(count) || 0))])
    .filter(([, count]) => count > 0));
}

export function createDefaultOutbreakProgress() {
  return {
    schemaVersion: OUTBREAK_PROGRESS_SCHEMA_VERSION,
    encounteredBossKinds: [],
    clearedMissionIds: [],
    survivalBossKinds: ["takuya", "gate-eater"],
    bossDefeatCounts: {},
    processedResultIds: [],
    claimedRewardIds: [],
    lastResult: null,
  };
}

export function normalizeOutbreakProgress(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const missionIds = OUTBREAK_MISSIONS.map(({ id }) => id);
  const bossKinds = OUTBREAK_MISSIONS.map(({ boss }) => boss.enemyKind);
  const clearedMissionIds = uniqueStrings(source.clearedMissionIds)
    .filter((id) => missionIds.includes(id));
  const unlockedFromClear = OUTBREAK_MISSIONS
    .filter(({ id }) => clearedMissionIds.includes(id))
    .map(({ boss }) => boss.enemyKind);
  return {
    schemaVersion: OUTBREAK_PROGRESS_SCHEMA_VERSION,
    encounteredBossKinds: uniqueStrings(source.encounteredBossKinds)
      .filter((kind) => bossKinds.includes(kind)),
    clearedMissionIds,
    survivalBossKinds: uniqueStrings([
      "takuya",
      "gate-eater",
      ...unlockedFromClear,
    ]).filter((kind) => ["takuya", "gate-eater", ...bossKinds].includes(kind)),
    bossDefeatCounts: countRecord(source.bossDefeatCounts, bossKinds),
    processedResultIds: uniqueStrings(source.processedResultIds),
    claimedRewardIds: uniqueStrings(source.claimedRewardIds),
    lastResult: source.lastResult && typeof source.lastResult === "object"
      ? { ...source.lastResult }
      : null,
  };
}

export function isOutbreakMissionUnlocked(progress, completedStageIds, missionId) {
  const mission = OUTBREAK_MISSION_BY_ID[missionId];
  if (!mission) return false;
  return uniqueStrings(completedStageIds).includes(mission.prerequisiteStageId)
    || normalizeOutbreakProgress(progress).clearedMissionIds.includes(missionId);
}

export function resolveOutbreakProgress(progress, {
  resultId,
  missionId,
  won = false,
  completedAt = new Date().toISOString(),
  stats = {},
} = {}) {
  const mission = OUTBREAK_MISSION_BY_ID[missionId];
  if (!mission) throw new RangeError(`Unknown outbreak mission: ${String(missionId)}`);
  const stableResultId = typeof resultId === "string" ? resultId.trim() : "";
  if (!stableResultId) throw new TypeError("A non-empty outbreak resultId is required");
  const current = normalizeOutbreakProgress(progress);
  if (current.processedResultIds.includes(stableResultId)) {
    return {
      progress: current,
      duplicate: true,
      reward: { caps: 0, equipmentGrants: [] },
    };
  }
  const bossKind = mission.boss.enemyKind;
  const firstClear = won === true && !current.clearedMissionIds.includes(mission.id);
  const rewardId = `outbreak:${mission.id}:first-clear`;
  const equipmentGrants = firstClear && mission.firstClearEquipmentGrant
    ? [{ ...mission.firstClearEquipmentGrant }]
    : [];
  const next = normalizeOutbreakProgress({
    ...current,
    encounteredBossKinds: [...current.encounteredBossKinds, bossKind],
    clearedMissionIds: won ? [...current.clearedMissionIds, mission.id] : current.clearedMissionIds,
    bossDefeatCounts: won
      ? {
        ...current.bossDefeatCounts,
        [bossKind]: (current.bossDefeatCounts[bossKind] ?? 0) + 1,
      }
      : current.bossDefeatCounts,
    processedResultIds: [...current.processedResultIds, stableResultId],
    claimedRewardIds: firstClear
      ? [...current.claimedRewardIds, rewardId]
      : current.claimedRewardIds,
    lastResult: {
      resultId: stableResultId,
      missionId: mission.id,
      bossKind,
      won: won === true,
      firstClear,
      completedAt,
      stats: {
        kills: Math.max(0, Math.floor(Number(stats.kills) || 0)),
        unitsLost: Math.max(0, Math.floor(Number(stats.unitsLost) || 0)),
        battleSeconds: Math.max(0, Number(stats.battleSeconds) || 0),
      },
      earnedCaps: won ? mission.baseRewardCaps : 0,
      equipmentGrants,
    },
  });
  return {
    progress: next,
    duplicate: false,
    reward: {
      caps: won ? mission.baseRewardCaps : 0,
      equipmentGrants,
    },
  };
}
