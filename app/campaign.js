import { STORY_SCRIPT_VERSION } from "./storyEvents.js";
import { V075_VISUAL_PROFILES } from "./visualProfiles.js";
import {
  EVENT_FOUNDATION_REGISTRY,
  createEventFoundationProgress,
  eventDisplayView,
  finishEventRun,
  normalizeEventFoundationProgress,
  startEventRun,
} from "./eventFoundation.js";
import {
  legacyRankToLevel,
  normalizeUnitLevels,
  normalizeUnitRanks,
  unitLevelCapForHighestStage,
  unitLevelFor,
  unitLevelUpgradeQuote,
} from "./unitProgression.js";
import {
  V090_CAPS_MIGRATION_BASE,
  V090_CAPS_MIGRATION_ID,
  capsMigrationNotice,
  reorganizeLegacyCaps,
} from "./campaignEconomy.js";
import {
  SURVIVAL_END_REASONS,
  createDefaultSurvivalProgress,
  normalizeSurvivalRun,
  normalizeSurvivalProgress,
  saveSurvivalCheckpoint,
  settleSurvivalRun,
} from "./survival.js";
import {
  EQUIPMENT_MAX_ENHANCEMENT,
  EQUIPMENT_SLOT_TYPES,
  EQUIPMENT_SOURCES,
  PERSONAL_EQUIPMENT_SLOTS,
  TACTICAL_EQUIPMENT_SLOTS,
  equipmentDefinition,
  equipmentEnhancementCost,
  equipmentEnhancementLevel,
  normalizeEquipmentEnhancementLevels,
} from "./equipment.js";
import { bossCampaignEntry } from "./bossFoundation.js";
import {
  createDefaultOutbreakProgress,
  isOutbreakMissionUnlocked,
  normalizeOutbreakProgress,
  resolveOutbreakProgress,
} from "./outbreakMissions.js";
import {
  createDefaultCampaignRecords,
  normalizeCampaignRecords,
  recordCampaignOperation,
} from "./campaignRecords.js";

/**
 * Pure, data-driven campaign progression for the 0.7.0 unit-collection release.
 *
 * Player-facing names deliberately live beside, rather than inside, stable IDs.
 * That lets later copy, character, and map revisions migrate without rewriting
 * previously stored progress.
 */

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function uniqueStrings(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry) => typeof entry === "string" && entry.length > 0))];
}

function clampInteger(value, minimum, maximum, fallback = minimum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(numeric)));
}

function clampNumber(value, minimum, maximum, fallback) {
  const numeric = Number(value);
  const candidate = Number.isFinite(numeric) ? numeric : fallback;
  return Math.max(minimum, Math.min(maximum, candidate));
}

export const CAMPAIGN_CHAPTER_ID = "chapter-prologue";

export const CAMPAIGN_STAGE_IDS = deepFreeze({
  NISHIJIN_SHOPPING_STREET: "stage-nishijin-shopping-street",
  SAWARA_WARD_OFFICE: "stage-sawara-ward-office",
  NISHIJIN_DEFENSE_LINE: "stage-nishijin-defense-line-takuya",
  NISHIJIN_STATION_GATE: "stage-nishijin-station-gate",
  NISHIJIN_STATION_PLATFORM: "stage-nishijin-station-platform",
  NISHIJIN_STATION_TUNNEL: "stage-nishijin-station-tunnel-seal",
  UNIVERSITY_HOSPITAL_APPROACH: "stage-university-hospital-approach",
  HOSPITAL_EMERGENCY_WARD: "stage-hospital-emergency-ward",
  HOSPITAL_EVACUATION_ROUTE: "stage-hospital-evacuation-route",
  RESEARCH_ACCESS: "stage-research-access",
  RESEARCH_CONTAINMENT: "stage-research-containment",
  RESEARCH_FREIGHT_PASSAGE: "stage-research-freight-passage",
  LOGISTICS_RELAY: "stage-logistics-relay",
  EVACUATION_FREIGHT_YARD: "stage-evacuation-freight-yard",
  T_PLAN_OUTER_CORE: "stage-t-plan-outer-core",
  T_PLAN_CENTRAL_SEAL: "stage-t-plan-central-seal",
  BAY_TOWER_SERVICE: "stage-bay-tower-service",
  CIVIC_ARCHIVE_ROUTE: "stage-civic-archive-route",
  COASTAL_LINK_BRIDGE: "stage-coastal-link-bridge",
  ESTUARY_FLOODGATE_SEAL: "stage-estuary-floodgate-seal",
});

export const CAMPAIGN_REGION_IDS = deepFreeze({
  NISHIJIN: "region-nishijin",
  UNIVERSITY_HOSPITAL: "region-university-hospital",
  UNDERGROUND_RESEARCH: "region-underground-research",
  LOGISTICS_LINE: "region-logistics-line",
  T_PLAN_CORE: "region-t-plan-core",
  BAY_QUARANTINE: "region-bay-quarantine",
});

export const CAMPAIGN_REGIONS = deepFreeze([
  {
    id: CAMPAIGN_REGION_IDS.NISHIJIN,
    shortLabel: "西新",
    displayName: "西新・早良区",
    description: "発生から四十三日。移動拠点が確保した最初の作戦区域。",
  },
  {
    id: CAMPAIGN_REGION_IDS.UNIVERSITY_HOSPITAL,
    shortLabel: "病院",
    displayName: "大学病院区域",
    description: "救急棟と搬送路を確保し、地下研究区画への入口を探す。",
  },
  {
    id: CAMPAIGN_REGION_IDS.UNDERGROUND_RESEARCH,
    shortLabel: "研究区",
    displayName: "地下研究区画",
    description: "隔離設備が残る研究区画。閉鎖系の感染源を切り離す。",
  },
  {
    id: CAMPAIGN_REGION_IDS.LOGISTICS_LINE,
    shortLabel: "物流線",
    displayName: "避難・物流線",
    description: "物資と避難経路が交差する地上線。補給網を奪還する。",
  },
  {
    id: CAMPAIGN_REGION_IDS.T_PLAN_CORE,
    shortLabel: "T計画",
    displayName: "T計画中枢",
    description: "地下最深部の封鎖区域。感染流出を止める最終作戦。",
  },
  {
    id: CAMPAIGN_REGION_IDS.BAY_QUARANTINE,
    shortLabel: "湾岸",
    displayName: "湾岸封鎖区",
    description: "T計画中枢から地上へ流出した異形群を追い、海側の防潮線を再封鎖する。",
  },
]);

export const STAGE_VISUAL_SIGNATURES = deepFreeze({
  [CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET]: {
    kind: "shopping-arcade",
    background: "shuttered-storefronts",
    landmark: "covered-arcade",
    environment: ["abandoned-delivery-van", "fallen-bicycle"],
    lighting: "damaged-warm-pendants",
    battleScars: ["burned-pavement", "broken-shop-sign"],
  },
  [CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE]: {
    kind: "evacuation-civic-center",
    background: "ward-office-facade",
    landmark: "ambulance-and-relief-tents",
    environment: ["traffic-cones", "sandbag-line"],
    lighting: "cold-floodlights-and-emergency-beacons",
    battleScars: ["abandoned-evacuation-route"],
  },
  [CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE]: {
    kind: "infected-industrial-line",
    background: "industrial-towers",
    landmark: "barbed-defense-line",
    environment: ["anti-vehicle-obstacles", "red-infection-smoke"],
    lighting: "red-fire-glow",
    battleScars: ["shell-craters", "scorched-concrete"],
  },
  [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE]: {
    kind: "subway-ticket-gate",
    background: "station-concourse",
    landmark: "infected-relay-at-ticket-gates",
    environment: ["closed-shutters", "evacuation-stretcher"],
    lighting: "failing-concourse-lamps",
    battleScars: ["torn-wayfinding", "infected-cable-growth"],
  },
  [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM]: {
    kind: "subway-platform-escort",
    background: "platform-and-track",
    landmark: "maintenance-cart",
    environment: ["platform-columns", "signal-lights"],
    lighting: "red-emergency-lamps",
    battleScars: ["leaking-ceiling", "contaminated-floor"],
  },
  [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL]: {
    kind: "maintenance-tunnel-seal",
    background: "maintenance-tunnel",
    landmark: "three-power-panels-and-seal-door",
    environment: ["service-cables", "research-container"],
    lighting: "sequential-power-lamps",
    battleScars: ["bent-ticket-gates", "infected-door-frame"],
  },
  [CAMPAIGN_STAGE_IDS.UNIVERSITY_HOSPITAL_APPROACH]: {
    kind: "hospital-emergency-courtyard",
    background: "university-hospital-emergency-wing",
    landmark: "triage-canopy",
    environment: ["ambulance-bay", "collapsed-wayfinding"],
    lighting: "rainy-dawn-emergency-lights",
    battleScars: ["cracked-dropoff-lane", "infected-barricade"],
  },
  [CAMPAIGN_STAGE_IDS.HOSPITAL_EMERGENCY_WARD]: {
    kind: "hospital-emergency-interior",
    background: "shattered-emergency-ward",
    landmark: "infected-medical-relay",
    environment: ["privacy-curtains", "overturned-gurneys"],
    lighting: "cold-clinical-flicker",
    battleScars: ["flooded-floor", "ruptured-oxygen-line"],
  },
  [CAMPAIGN_STAGE_IDS.HOSPITAL_EVACUATION_ROUTE]: {
    kind: "hospital-service-route",
    background: "covered-ambulance-ramp",
    landmark: "mobile-diagnostic-rig",
    environment: ["service-shutters", "evacuation-markers"],
    lighting: "amber-route-beacons",
    battleScars: ["burned-service-van", "broken-drainage"],
  },
  [CAMPAIGN_STAGE_IDS.RESEARCH_ACCESS]: {
    kind: "research-access-lock",
    background: "underground-decontamination-gate",
    landmark: "infected-command-node",
    environment: ["airlock-frames", "sealed-lab-windows"],
    lighting: "cyan-decontamination-lamps",
    battleScars: ["buckled-security-door", "chemical-residue"],
  },
  [CAMPAIGN_STAGE_IDS.RESEARCH_CONTAINMENT]: {
    kind: "research-containment-ring",
    background: "specimen-containment-gallery",
    landmark: "containment-control-dais",
    environment: ["armored-glass", "hazard-cables"],
    lighting: "red-containment-pulse",
    battleScars: ["burst-specimen-tank", "scorched-floor-grid"],
  },
  [CAMPAIGN_STAGE_IDS.RESEARCH_FREIGHT_PASSAGE]: {
    kind: "research-freight-tunnel",
    background: "sublevel-freight-passage",
    landmark: "sealed-sample-carrier",
    environment: ["ceiling-cranes", "cargo-locks"],
    lighting: "moving-service-lamps",
    battleScars: ["derailed-carrier", "ripped-cable-trays"],
  },
  [CAMPAIGN_STAGE_IDS.LOGISTICS_RELAY]: {
    kind: "logistics-relay-yard",
    background: "container-relay-yard",
    landmark: "infected-logistics-relay",
    environment: ["stacked-containers", "gantry-signals"],
    lighting: "storm-night-worklights",
    battleScars: ["forklift-wreck", "split-fuel-line"],
  },
  [CAMPAIGN_STAGE_IDS.EVACUATION_FREIGHT_YARD]: {
    kind: "evacuation-freight-line",
    background: "rail-freight-evacuation-yard",
    landmark: "civilian-transfer-lane",
    environment: ["freight-wagons", "signal-bridge"],
    lighting: "sunset-smoke-and-beacons",
    battleScars: ["torn-track-bed", "burned-relief-crates"],
  },
  [CAMPAIGN_STAGE_IDS.T_PLAN_OUTER_CORE]: {
    kind: "t-plan-outer-core",
    background: "deep-core-security-ring",
    landmark: "outer-core-command-node",
    environment: ["blast-doors", "coolant-columns"],
    lighting: "violet-reactor-glow",
    battleScars: ["fractured-reactor-shield", "infected-coolant"],
  },
  [CAMPAIGN_STAGE_IDS.T_PLAN_CENTRAL_SEAL]: {
    kind: "t-plan-central-seal",
    background: "central-containment-vault",
    landmark: "three-seal-nodes",
    environment: ["containment-arches", "research-container"],
    lighting: "white-seal-lamps-and-red-core",
    battleScars: ["collapsed-observation-deck", "open-infection-fissure"],
  },
  [CAMPAIGN_STAGE_IDS.BAY_TOWER_SERVICE]: {
    kind: "bay-tower-service-plaza",
    background: "storm-damaged-bay-tower",
    landmark: "sunken-emergency-service-ramp",
    environment: ["mobile-base-approach", "ruptured-ventilation-throat"],
    lighting: "cold-late-afternoon-floodlights",
    battleScars: ["salt-wet-plaza", "organic-vent-breach"],
  },
  [CAMPAIGN_STAGE_IDS.CIVIC_ARCHIVE_ROUTE]: {
    kind: "civic-archive-transfer-yard",
    background: "shattered-coastal-library",
    landmark: "covered-casualty-transfer-ramp",
    environment: ["collapsed-archive-shelves", "freight-aperture"],
    lighting: "cold-rain-and-amber-backup-lamps",
    battleScars: ["paper-drift", "infected-storage-breach"],
  },
  [CAMPAIGN_STAGE_IDS.COASTAL_LINK_BRIDGE]: {
    kind: "storm-coastal-link-bridge",
    background: "damaged-waterfront-bridge",
    landmark: "armored-evacuation-carrier",
    environment: ["marina-silhouette", "organic-skin-canopy-breach"],
    lighting: "storm-dusk-emergency-beacons",
    battleScars: ["exposed-expansion-joints", "torn-bridge-end"],
  },
  [CAMPAIGN_STAGE_IDS.ESTUARY_FLOODGATE_SEAL]: {
    kind: "estuary-storm-surge-floodgate",
    background: "three-tower-floodgate-complex",
    landmark: "jammed-central-tidal-gate",
    environment: ["seal-control-pylons", "maintenance-return-lane"],
    lighting: "pre-dawn-searchlights-and-lightning",
    battleScars: ["deep-earth-infection-fissure", "ruptured-concrete-throat"],
  },
});

export const CAMPAIGN_UNIT_IDS = deepFreeze({
  PAISEN: "unit-paisen",
  HACHI: "unit-hachi",
  MIZUCHI: "unit-mizuchi",
  NAO: "unit-nao",
  TATARA: "unit-tatara",
  CRAZY_KING: "unit-crazy-king",
  KUMAVERSON: "unit-kumaverson",
  BABAYAGA: "unit-babayaga",
  RAIDER: "unit-raider",
  GANTETSU: "unit-gantetsu",
  MONKEY: "unit-monkey",
  ZAKIMIYA: "unit-zakimiya",
  TKY: "unit-tky",
  MRS_CHIHA: "unit-mrs-chiha",
  MIYAMOTO_MUSASHI: "unit-miyamoto-musashi",
  MAYO_CHAN: "unit-mayo-chan",
  // Deprecated property names remain import-compatible. Their values are the
  // canonical 0.7.0 IDs; old names are never player-facing.
  TACHIBANA_JIN: "unit-hachi",
  KUROKI_RIN: "unit-mizuchi",
  SHIRAISHI_NAOTO: "unit-nao",
  OBA_GO: "unit-tatara",
  MAKABE_REINA: "unit-raider",
});

export const CAMPAIGN_GUIDE_ID = "guide-ikura";

export const DEFAULT_STAR_THRESHOLDS = deepFreeze({
  1: 0.01,
  2: 0.7,
  3: 0.9,
});

export const DEFAULT_REPLAY_REWARD_MULTIPLIERS = deepFreeze({
  1: 1,
  2: 1.25,
  3: 1.5,
});

// PROVISIONAL BALANCE (0.7.0): these supply values are explicit starting
// points for playtesting, not final economy decisions. Star milestone rewards
// below intentionally begin at one half of each stage's provisional base.
export const PROVISIONAL_BASE_REWARDS = deepFreeze({
  [CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET]: 100,
  [CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE]: 140,
  [CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE]: 200,
  [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE]: 240,
  [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM]: 280,
  [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL]: 360,
  [CAMPAIGN_STAGE_IDS.UNIVERSITY_HOSPITAL_APPROACH]: 420,
  [CAMPAIGN_STAGE_IDS.HOSPITAL_EMERGENCY_WARD]: 460,
  [CAMPAIGN_STAGE_IDS.HOSPITAL_EVACUATION_ROUTE]: 500,
  [CAMPAIGN_STAGE_IDS.RESEARCH_ACCESS]: 540,
  [CAMPAIGN_STAGE_IDS.RESEARCH_CONTAINMENT]: 580,
  [CAMPAIGN_STAGE_IDS.RESEARCH_FREIGHT_PASSAGE]: 620,
  [CAMPAIGN_STAGE_IDS.LOGISTICS_RELAY]: 660,
  [CAMPAIGN_STAGE_IDS.EVACUATION_FREIGHT_YARD]: 700,
  [CAMPAIGN_STAGE_IDS.T_PLAN_OUTER_CORE]: 750,
  [CAMPAIGN_STAGE_IDS.T_PLAN_CENTRAL_SEAL]: 820,
  [CAMPAIGN_STAGE_IDS.BAY_TOWER_SERVICE]: 900,
  [CAMPAIGN_STAGE_IDS.CIVIC_ARCHIVE_ROUTE]: 960,
  [CAMPAIGN_STAGE_IDS.COASTAL_LINK_BRIDGE]: 1040,
  [CAMPAIGN_STAGE_IDS.ESTUARY_FLOODGATE_SEAL]: 1200,
});

function firstStarRewards(baseReward) {
  const reward = Math.round(baseReward * 0.5);
  return deepFreeze({ 1: reward, 2: reward, 3: reward });
}

const nishijinBaseReward = PROVISIONAL_BASE_REWARDS[CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET];
const sawaraBaseReward = PROVISIONAL_BASE_REWARDS[CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE];
const takuyaBaseReward = PROVISIONAL_BASE_REWARDS[CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE];
const stationGateBaseReward = PROVISIONAL_BASE_REWARDS[CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE];
const stationPlatformBaseReward = PROVISIONAL_BASE_REWARDS[CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM];
const stationTunnelBaseReward = PROVISIONAL_BASE_REWARDS[CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL];

function operationStage({
  id,
  stageNumber,
  displayName,
  regionId,
  mapPosition,
  previousStageId,
  nextStageId,
  missionType,
  objectivePattern,
  objective,
  objectiveConfig,
  theme,
  enemyKinds,
  waves,
  baseHp,
  boss = null,
  mapSignalIds = [],
}) {
  const baseReward = PROVISIONAL_BASE_REWARDS[id];
  return {
    id,
    stageNumber,
    displayName,
    chapterId: CAMPAIGN_CHAPTER_ID,
    regionId,
    mapPosition,
    unlockRequirements: [{ type: "stage-stars", stageId: previousStageId, minimumStars: 1 }],
    prerequisiteStageIds: [previousStageId],
    missionType,
    objectivePattern,
    objective,
    objectiveConfig,
    theme,
    enemyKinds,
    waves,
    boss,
    baseHp,
    starThresholds: DEFAULT_STAR_THRESHOLDS,
    baseReward,
    firstTimeStarRewards: firstStarRewards(baseReward),
    replayRewardMultipliers: DEFAULT_REPLAY_REWARD_MULTIPLIERS,
    preBattleEventId: null,
    postBattleEventId: null,
    nextUnlocks: {
      stageIds: nextStageId ? [nextStageId] : [],
      unitIds: [],
      discoveredUnitIds: [],
      recruitableUnitIds: [],
      mapSignalIds,
    },
  };
}

export const CAMPAIGN_STAGES = deepFreeze([
  {
    id: CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET,
    stageNumber: 1,
    displayName: "西新商店街",
    chapterId: CAMPAIGN_CHAPTER_ID,
    regionId: CAMPAIGN_REGION_IDS.NISHIJIN,
    mapPosition: { x: 23, y: 62, unit: "percent" },
    unlockRequirements: [{ type: "campaign-start" }],
    prerequisiteStageIds: [],
    missionType: "assault",
    objective: "感染拠点を破壊",
    objectiveConfig: { target: "infected-base" },
    theme: {
      id: "theme-nishijin-shopping-street",
      backgroundId: "background-nishijin-shopping-street-v1",
      tags: ["商店街", "放置車両", "戦闘跡"],
    },
    enemyKinds: ["walker", "runner", "spitter", "crusher"],
    waves: [
      { id: "nishijin-wave-01", atSeconds: 4, groups: [{ kind: "walker", count: 4 }] },
      { id: "nishijin-wave-02", atSeconds: 21, groups: [{ kind: "runner", count: 4 }, { kind: "walker", count: 3 }] },
      { id: "nishijin-wave-03", atSeconds: 39, groups: [{ kind: "spitter", count: 3 }, { kind: "walker", count: 3 }] },
      { id: "nishijin-wave-04", atSeconds: 58, groups: [{ kind: "crusher", count: 2 }, { kind: "runner", count: 4 }] },
      { id: "nishijin-wave-05", atSeconds: 76, groups: [{ kind: "spitter", count: 2 }, { kind: "runner", count: 3 }] },
    ],
    boss: null,
    baseHp: 1000,
    starThresholds: DEFAULT_STAR_THRESHOLDS,
    baseReward: nishijinBaseReward,
    firstTimeStarRewards: firstStarRewards(nishijinBaseReward),
    replayRewardMultipliers: DEFAULT_REPLAY_REWARD_MULTIPLIERS,
    preBattleEventId: "stage-nishijin-pre-v070",
    postBattleEventId: "stage-nishijin-post-v070",
    nextUnlocks: {
      stageIds: [CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE],
      unitIds: [CAMPAIGN_UNIT_IDS.CRAZY_KING],
      discoveredUnitIds: [CAMPAIGN_UNIT_IDS.CRAZY_KING, CAMPAIGN_UNIT_IDS.TATARA],
      recruitableUnitIds: [CAMPAIGN_UNIT_IDS.TATARA],
      mapSignalIds: [],
    },
  },
  {
    id: CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE,
    stageNumber: 2,
    displayName: "早良区役所",
    chapterId: CAMPAIGN_CHAPTER_ID,
    regionId: CAMPAIGN_REGION_IDS.NISHIJIN,
    mapPosition: { x: 49, y: 43, unit: "percent" },
    unlockRequirements: [{ type: "stage-stars", stageId: CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET, minimumStars: 1 }],
    prerequisiteStageIds: [CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET],
    missionType: "timed-defense",
    objective: "救援部隊の撤収完了まで180秒防衛",
    objectiveConfig: { target: "rescue-convoy", durationSeconds: 180 },
    theme: {
      id: "theme-sawara-ward-office",
      backgroundId: "background-sawara-ward-office-v1",
      tags: ["区役所", "救援車両", "避難線"],
    },
    enemyKinds: ["walker", "runner", "spitter", "crusher", "abomination"],
    waves: [
      { id: "sawara-wave-01", atSeconds: 6, groups: [{ kind: "walker", count: 6 }] },
      { id: "sawara-wave-02", atSeconds: 31, groups: [{ kind: "runner", count: 5 }, { kind: "spitter", count: 3 }] },
      { id: "sawara-wave-03", atSeconds: 56, groups: [{ kind: "crusher", count: 2 }, { kind: "walker", count: 5 }] },
      { id: "sawara-wave-04", atSeconds: 82, groups: [{ kind: "runner", count: 5 }, { kind: "spitter", count: 3 }] },
      { id: "sawara-wave-05", atSeconds: 109, groups: [{ kind: "abomination", count: 1 }, { kind: "crusher", count: 3 }, { kind: "walker", count: 3 }] },
      { id: "sawara-wave-06", atSeconds: 136, groups: [{ kind: "runner", count: 6 }, { kind: "spitter", count: 3 }] },
      { id: "sawara-wave-07", atSeconds: 162, groups: [{ kind: "crusher", count: 3 }, { kind: "spitter", count: 2 }, { kind: "runner", count: 3 }] },
    ],
    boss: null,
    baseHp: 1000,
    starThresholds: DEFAULT_STAR_THRESHOLDS,
    baseReward: sawaraBaseReward,
    firstTimeStarRewards: firstStarRewards(sawaraBaseReward),
    replayRewardMultipliers: DEFAULT_REPLAY_REWARD_MULTIPLIERS,
    preBattleEventId: "stage-sawara-pre-v070",
    postBattleEventId: "stage-sawara-post-v070",
    nextUnlocks: {
      stageIds: [CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE],
      unitIds: [],
      discoveredUnitIds: [CAMPAIGN_UNIT_IDS.RAIDER],
      recruitableUnitIds: [CAMPAIGN_UNIT_IDS.RAIDER],
      mapSignalIds: [],
    },
  },
  {
    id: CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE,
    stageNumber: 3,
    displayName: "西新防衛線・TAKUYA",
    chapterId: CAMPAIGN_CHAPTER_ID,
    regionId: CAMPAIGN_REGION_IDS.NISHIJIN,
    mapPosition: { x: 69, y: 61, unit: "percent" },
    unlockRequirements: [{ type: "stage-stars", stageId: CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE, minimumStars: 1 }],
    prerequisiteStageIds: [CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE],
    missionType: "boss-assault",
    objective: "TAKUYAを撃破し、感染拠点を破壊",
    objectiveConfig: { targetsInOrder: ["takuya", "infected-base"] },
    theme: {
      id: "theme-nishijin-defense-line",
      backgroundId: "background-nishijin-defense-line-v1",
      tags: ["西新防衛線", "バリケード", "異常感染者"],
    },
    enemyKinds: ["walker", "runner", "spitter", "crusher", "shade", "abomination", "takuya"],
    waves: [
      { id: "takuya-wave-01", atSeconds: 0, waveNumber: 1, label: "第1波 — 接敵", units: ["walker", "walker", "walker"] },
      { id: "takuya-wave-02", atSeconds: 12, waveNumber: 2, label: "第2波 — 分散攻撃", units: ["walker", "runner", "spitter", "walker", "runner", "walker"] },
      { id: "takuya-wave-03", atSeconds: 30, waveNumber: 3, label: "第3波 — 圧力上昇", units: ["runner", "walker", "runner", "spitter", "runner", "walker"] },
      { id: "takuya-wave-04", atSeconds: 47, waveNumber: 4, label: "精鋭出現 — 影走り", units: ["shade", "runner", "walker", "spitter", "runner", "spitter"] },
      { id: "takuya-wave-05", atSeconds: 65, waveNumber: 5, label: "第5波 — 重装感染体", units: ["crusher", "walker", "spitter", "runner", "crusher", "walker", "runner"] },
      { id: "takuya-wave-06", atSeconds: 84, waveNumber: 6, label: "第6波 — 戦場全域警戒", units: ["runner", "spitter", "walker", "crusher", "runner", "spitter", "walker"] },
      { id: "takuya-wave-07", atSeconds: 103, waveNumber: 7, label: "最終防衛線 — 維持", units: ["crusher", "runner", "abomination", "walker", "spitter", "crusher", "runner"] },
      { id: "takuya-warning", atSeconds: 120, waveNumber: 7, label: "警告 — 巨大反応", units: [] },
      { id: "takuya-wave-boss", atSeconds: 126, waveNumber: 8, label: "異常感染者 — TAKUYA / 鉄の審判", units: ["walker", "spitter", "takuya", "runner", "crusher", "runner"] },
      { id: "takuya-wave-09", atSeconds: 147, waveNumber: 9, label: "感染体増援", units: ["runner", "spitter", "spitter", "runner", "walker"] },
      { id: "takuya-wave-10", atSeconds: 169, waveNumber: 10, label: "TAKUYA — 激昂", bossOnly: true, units: ["crusher", "runner", "runner", "crusher", "spitter"] },
      { id: "takuya-wave-final", atSeconds: 196, waveNumber: 11, label: "最終機会 — 感染拠点を破壊", units: ["runner", "spitter", "runner", "crusher", "walker", "runner", "spitter"] },
    ],
    boss: bossCampaignEntry("takuya", {
      entranceEventId: "event-prologue-takuya-entrance",
    }),
    baseHp: 520,
    starThresholds: DEFAULT_STAR_THRESHOLDS,
    baseReward: takuyaBaseReward,
    firstTimeStarRewards: firstStarRewards(takuyaBaseReward),
    replayRewardMultipliers: DEFAULT_REPLAY_REWARD_MULTIPLIERS,
    preBattleEventId: "stage-takuya-pre-v070",
    postBattleEventId: "stage-takuya-post-v070",
    nextUnlocks: {
      stageIds: [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE],
      unitIds: [],
      discoveredUnitIds: [],
      recruitableUnitIds: [],
      mapSignalIds: ["map-signal-nishijin-station"],
    },
  },
  {
    id: CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE,
    stageNumber: 4,
    displayName: "西新駅・改札区域",
    chapterId: CAMPAIGN_CHAPTER_ID,
    regionId: CAMPAIGN_REGION_IDS.NISHIJIN,
    mapPosition: { x: 78, y: 34, unit: "percent" },
    unlockRequirements: [{ type: "stage-stars", stageId: CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE, minimumStars: 1 }],
    prerequisiteStageIds: [CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE],
    missionType: "assault",
    objective: "感染中継点を破壊し、生存者の退路を確保",
    objectiveConfig: { target: "infected-relay", rescueCount: 7, rescueMode: "automatic-on-objective-destroyed" },
    theme: {
      id: "theme-nishijin-station-gate",
      backgroundId: "background-nishijin-station-gate-v1",
      tags: ["西新駅", "改札区域", "感染中継点"],
    },
    enemyKinds: ["walker", "runner", "spitter", "crusher", "grappler"],
    waves: [
      { id: "station-gate-wave-01", atSeconds: 4, groups: [{ kind: "walker", count: 5 }] },
      { id: "station-gate-wave-02", atSeconds: 22, groups: [{ kind: "grappler", count: 2 }, { kind: "runner", count: 3 }] },
      { id: "station-gate-wave-03", atSeconds: 41, groups: [{ kind: "spitter", count: 3 }, { kind: "walker", count: 4 }] },
      { id: "station-gate-wave-04", atSeconds: 62, groups: [{ kind: "grappler", count: 3 }, { kind: "crusher", count: 1 }] },
      { id: "station-gate-wave-05", atSeconds: 84, groups: [{ kind: "runner", count: 5 }, { kind: "spitter", count: 2 }] },
      { id: "station-gate-wave-06", atSeconds: 108, groups: [{ kind: "grappler", count: 2 }, { kind: "crusher", count: 2 }, { kind: "walker", count: 3 }] },
      { id: "station-gate-wave-07", atSeconds: 132, groups: [{ kind: "grappler", count: 2 }, { kind: "runner", count: 4 }, { kind: "spitter", count: 2 }] },
    ],
    boss: null,
    baseHp: 850,
    starThresholds: DEFAULT_STAR_THRESHOLDS,
    baseReward: stationGateBaseReward,
    firstTimeStarRewards: firstStarRewards(stationGateBaseReward),
    replayRewardMultipliers: DEFAULT_REPLAY_REWARD_MULTIPLIERS,
    preBattleEventId: "stage-station-gate-pre-v070",
    postBattleEventId: "stage-station-gate-post-v070",
    nextUnlocks: {
      stageIds: [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM],
      unitIds: [CAMPAIGN_UNIT_IDS.GANTETSU],
      discoveredUnitIds: [CAMPAIGN_UNIT_IDS.GANTETSU],
      recruitableUnitIds: [],
      mapSignalIds: [],
    },
  },
  {
    id: CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM,
    stageNumber: 5,
    displayName: "西新駅・ホーム／線路区域",
    chapterId: CAMPAIGN_CHAPTER_ID,
    regionId: CAMPAIGN_REGION_IDS.NISHIJIN,
    mapPosition: { x: 87, y: 51, unit: "percent" },
    unlockRequirements: [{ type: "stage-stars", stageId: CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE, minimumStars: 1 }],
    prerequisiteStageIds: [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE],
    missionType: "assault",
    objective: "ホームを制圧し、感染拠点を破壊",
    objectiveConfig: {
      target: "infection-base",
      rescueCount: 5,
      rescueMode: "automatic-on-objective-destroyed",
    },
    theme: {
      id: "theme-nishijin-station-platform",
      backgroundId: "background-nishijin-station-platform-v1",
      tags: ["ホーム", "線路", "保守台車"],
    },
    enemyKinds: ["walker", "runner", "spitter", "crusher", "ooze", "sprinter"],
    waves: [
      { id: "station-platform-wave-01", atSeconds: 3, groups: [{ kind: "walker", count: 5 }] },
      { id: "station-platform-wave-02", atSeconds: 19, groups: [{ kind: "ooze", count: 2 }, { kind: "runner", count: 3 }] },
      { id: "station-platform-wave-03", atSeconds: 38, groups: [{ kind: "sprinter", count: 3 }, { kind: "spitter", count: 2 }] },
      { id: "station-platform-wave-04", atSeconds: 58, groups: [{ kind: "ooze", count: 3 }, { kind: "crusher", count: 1 }] },
      { id: "station-platform-wave-05", atSeconds: 80, groups: [{ kind: "sprinter", count: 4 }, { kind: "walker", count: 4 }] },
      { id: "station-platform-wave-06", atSeconds: 104, groups: [{ kind: "ooze", count: 2 }, { kind: "spitter", count: 3 }, { kind: "runner", count: 3 }] },
      { id: "station-platform-wave-07", atSeconds: 130, groups: [{ kind: "sprinter", count: 4 }, { kind: "crusher", count: 2 }] },
      { id: "station-platform-wave-08", atSeconds: 158, groups: [{ kind: "ooze", count: 2 }, { kind: "sprinter", count: 4 }, { kind: "walker", count: 3 }] },
    ],
    boss: null,
    baseHp: 760,
    starThresholds: DEFAULT_STAR_THRESHOLDS,
    baseReward: stationPlatformBaseReward,
    firstTimeStarRewards: firstStarRewards(stationPlatformBaseReward),
    replayRewardMultipliers: DEFAULT_REPLAY_REWARD_MULTIPLIERS,
    preBattleEventId: "stage-station-platform-pre-v070",
    postBattleEventId: "stage-station-platform-post-v070",
    nextUnlocks: {
      stageIds: [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL],
      unitIds: [],
      discoveredUnitIds: [CAMPAIGN_UNIT_IDS.MONKEY],
      recruitableUnitIds: [],
      mapSignalIds: [],
    },
  },
  {
    id: CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL,
    stageNumber: 6,
    displayName: "西新駅・保守トンネル／封鎖区域",
    chapterId: CAMPAIGN_CHAPTER_ID,
    regionId: CAMPAIGN_REGION_IDS.NISHIJIN,
    mapPosition: { x: 92, y: 72, unit: "percent" },
    unlockRequirements: [{ type: "stage-stars", stageId: CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM, minimumStars: 1 }],
    prerequisiteStageIds: [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM],
    missionType: "sequential-seal",
    objective: "三つの電源を起動し、感染流出路を封鎖",
    objectiveConfig: {
      targetsInOrder: [
        "power-1",
        "power-2",
        "power-3",
        "gate-eater-defeat",
        "research-container",
        "seal-door",
        "return-route",
      ],
      powerHoldSeconds: 6,
      powerReadyAtSeconds: [24, 62, 104],
      powerYs: [212, 352, 282],
      powerXs: [410, 584, 744],
      powerRadiusX: 84,
      powerRadiusY: 42,
      sealDoorX: 867,
      sealY: 282,
      researchContainerStartX: 708,
      researchContainerY: 282,
      returnX: 205,
      returnRadiusX: 96,
      returnRadiusY: 48,
      escapeSeconds: 45,
    },
    theme: {
      id: "theme-nishijin-station-tunnel",
      backgroundId: "background-nishijin-station-tunnel-v1",
      tags: ["保守トンネル", "三電源", "封鎖扉"],
    },
    enemyKinds: ["walker", "runner", "spitter", "crusher", "grappler", "ooze", "sprinter", "gate-eater"],
    waves: [
      { id: "station-tunnel-wave-01", atSeconds: 0, groups: [{ kind: "walker", count: 5 }] },
      { id: "station-tunnel-wave-02", atSeconds: 18, groups: [{ kind: "grappler", count: 2 }, { kind: "runner", count: 3 }] },
      { id: "station-tunnel-wave-03", atSeconds: 42, groups: [{ kind: "ooze", count: 2 }, { kind: "spitter", count: 2 }] },
      { id: "station-tunnel-wave-04", atSeconds: 66, groups: [{ kind: "sprinter", count: 4 }, { kind: "crusher", count: 1 }] },
      { id: "station-tunnel-wave-05", atSeconds: 92, groups: [{ kind: "grappler", count: 2 }, { kind: "ooze", count: 2 }, { kind: "walker", count: 3 }] },
      { id: "station-tunnel-warning", atSeconds: 112, waveNumber: 6, label: "大型特殊個体反応", units: [] },
      { id: "station-tunnel-gate-eater", atSeconds: 120, waveNumber: 7, label: "改札喰い // 封鎖対象", units: ["gate-eater", "sprinter", "sprinter", "spitter", "spitter"] },
      { id: "station-tunnel-wave-08", atSeconds: 146, groups: [{ kind: "grappler", count: 2 }, { kind: "runner", count: 4 }] },
      { id: "station-tunnel-wave-09", atSeconds: 172, groups: [{ kind: "ooze", count: 3 }, { kind: "crusher", count: 2 }] },
      { id: "station-tunnel-wave-10", atSeconds: 198, groups: [{ kind: "sprinter", count: 4 }, { kind: "grappler", count: 2 }, { kind: "walker", count: 3 }] },
    ],
    boss: bossCampaignEntry("gate-eater", {
      entranceEventId: "stage-station-tunnel-gate-eater-v070",
    }),
    baseHp: 720,
    starThresholds: DEFAULT_STAR_THRESHOLDS,
    baseReward: stationTunnelBaseReward,
    firstTimeStarRewards: firstStarRewards(stationTunnelBaseReward),
    replayRewardMultipliers: DEFAULT_REPLAY_REWARD_MULTIPLIERS,
    preBattleEventId: "stage-station-tunnel-pre-v070",
    postBattleEventId: "stage-station-tunnel-post-v070",
    nextUnlocks: {
      stageIds: [CAMPAIGN_STAGE_IDS.UNIVERSITY_HOSPITAL_APPROACH],
      unitIds: [CAMPAIGN_UNIT_IDS.MONKEY],
      discoveredUnitIds: [CAMPAIGN_UNIT_IDS.MONKEY],
      recruitableUnitIds: [],
      mapSignalIds: ["map-signal-university-hospital"],
    },
  },
  operationStage({
    id: CAMPAIGN_STAGE_IDS.UNIVERSITY_HOSPITAL_APPROACH,
    stageNumber: 7,
    displayName: "大学病院・救急搬入口",
    regionId: CAMPAIGN_REGION_IDS.UNIVERSITY_HOSPITAL,
    mapPosition: { x: 18, y: 64, unit: "percent" },
    previousStageId: CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL,
    nextStageId: CAMPAIGN_STAGE_IDS.HOSPITAL_EMERGENCY_WARD,
    missionType: "timed-defense",
    objectivePattern: "perimeter-hold",
    objective: "救急搬入口を150秒確保し、地下への侵入経路を開く",
    objectiveConfig: {
      target: "hospital-access",
      targetLabel: "救急搬入口",
      hudLabel: "救急搬入口の確保",
      durationSeconds: 150,
    },
    theme: {
      id: "theme-university-hospital-approach",
      backgroundId: "background-university-hospital-approach-v1",
      tags: ["大学病院", "救急搬入口", "雨天"],
    },
    enemyKinds: ["walker", "runner", "spitter", "crusher", "grappler"],
    waves: [
      { id: "hospital-approach-wave-01", atSeconds: 4, groups: [{ kind: "walker", count: 6 }] },
      { id: "hospital-approach-wave-02", atSeconds: 23, groups: [{ kind: "runner", count: 4 }, { kind: "walker", count: 3 }] },
      { id: "hospital-approach-wave-03", atSeconds: 43, groups: [{ kind: "spitter", count: 3 }, { kind: "grappler", count: 2 }] },
      { id: "hospital-approach-wave-04", atSeconds: 65, groups: [{ kind: "crusher", count: 2 }, { kind: "runner", count: 4 }] },
      { id: "hospital-approach-wave-05", atSeconds: 88, groups: [{ kind: "grappler", count: 3 }, { kind: "walker", count: 4 }] },
      { id: "hospital-approach-wave-06", atSeconds: 113, groups: [{ kind: "spitter", count: 3 }, { kind: "crusher", count: 2 }, { kind: "runner", count: 3 }] },
      { id: "hospital-approach-wave-07", atSeconds: 137, groups: [{ kind: "grappler", count: 3 }, { kind: "runner", count: 5 }, { kind: "spitter", count: 2 }] },
    ],
    baseHp: 900,
  }),
  operationStage({
    id: CAMPAIGN_STAGE_IDS.HOSPITAL_EMERGENCY_WARD,
    stageNumber: 8,
    displayName: "大学病院・救急病棟",
    regionId: CAMPAIGN_REGION_IDS.UNIVERSITY_HOSPITAL,
    mapPosition: { x: 50, y: 38, unit: "percent" },
    previousStageId: CAMPAIGN_STAGE_IDS.UNIVERSITY_HOSPITAL_APPROACH,
    nextStageId: CAMPAIGN_STAGE_IDS.HOSPITAL_EVACUATION_ROUTE,
    missionType: "assault",
    objectivePattern: "relay-destruction",
    objective: "救急病棟を侵食する感染中継点を破壊",
    objectiveConfig: { target: "infected-relay" },
    theme: {
      id: "theme-hospital-emergency-ward",
      backgroundId: "background-hospital-emergency-ward-v1",
      tags: ["救急病棟", "感染中継点", "浸水床"],
    },
    enemyKinds: ["walker", "runner", "spitter", "crusher", "ooze", "sprinter"],
    waves: [
      { id: "hospital-ward-wave-01", atSeconds: 3, groups: [{ kind: "walker", count: 5 }, { kind: "ooze", count: 1 }] },
      { id: "hospital-ward-wave-02", atSeconds: 19, groups: [{ kind: "sprinter", count: 3 }, { kind: "runner", count: 3 }] },
      { id: "hospital-ward-wave-03", atSeconds: 38, groups: [{ kind: "spitter", count: 3 }, { kind: "ooze", count: 2 }] },
      { id: "hospital-ward-wave-04", atSeconds: 58, groups: [{ kind: "sprinter", count: 4 }, { kind: "walker", count: 4 }] },
      { id: "hospital-ward-wave-05", atSeconds: 80, groups: [{ kind: "ooze", count: 3 }, { kind: "runner", count: 4 }] },
      { id: "hospital-ward-wave-06", atSeconds: 104, groups: [{ kind: "spitter", count: 3 }, { kind: "sprinter", count: 4 }] },
      { id: "hospital-ward-wave-07", atSeconds: 129, groups: [{ kind: "ooze", count: 3 }, { kind: "crusher", count: 2 }, { kind: "runner", count: 3 }] },
      { id: "hospital-ward-wave-08", atSeconds: 155, groups: [{ kind: "sprinter", count: 4 }, { kind: "spitter", count: 3 }, { kind: "walker", count: 3 }] },
    ],
    baseHp: 860,
  }),
  operationStage({
    id: CAMPAIGN_STAGE_IDS.HOSPITAL_EVACUATION_ROUTE,
    stageNumber: 9,
    displayName: "大学病院・搬送連絡路",
    regionId: CAMPAIGN_REGION_IDS.UNIVERSITY_HOSPITAL,
    mapPosition: { x: 82, y: 62, unit: "percent" },
    previousStageId: CAMPAIGN_STAGE_IDS.HOSPITAL_EMERGENCY_WARD,
    nextStageId: CAMPAIGN_STAGE_IDS.RESEARCH_ACCESS,
    missionType: "escort",
    objectivePattern: "mobile-objective-escort",
    objective: "移動診断装置を地下研究区画の入口まで護送",
    objectiveConfig: {
      target: "diagnostic-rig",
      targetLabel: "移動診断装置",
      durationSeconds: 125,
      maxIntegrity: 560,
      repairSeconds: 16,
      startX: 258,
      endX: 776,
      cartLane: 1,
    },
    theme: {
      id: "theme-hospital-evacuation-route",
      backgroundId: "background-hospital-evacuation-route-v1",
      tags: ["搬送連絡路", "移動診断装置", "避難灯"],
    },
    enemyKinds: ["walker", "runner", "spitter", "crusher", "grappler", "ooze"],
    waves: [
      { id: "hospital-route-wave-01", atSeconds: 2, groups: [{ kind: "walker", count: 5 }] },
      { id: "hospital-route-wave-02", atSeconds: 20, groups: [{ kind: "grappler", count: 2 }, { kind: "runner", count: 3 }] },
      { id: "hospital-route-wave-03", atSeconds: 40, groups: [{ kind: "ooze", count: 2 }, { kind: "spitter", count: 3 }] },
      { id: "hospital-route-wave-04", atSeconds: 62, groups: [{ kind: "crusher", count: 2 }, { kind: "walker", count: 4 }] },
      { id: "hospital-route-wave-05", atSeconds: 85, groups: [{ kind: "grappler", count: 3 }, { kind: "runner", count: 4 }] },
      { id: "hospital-route-wave-06", atSeconds: 109, groups: [{ kind: "ooze", count: 2 }, { kind: "spitter", count: 3 }, { kind: "crusher", count: 1 }] },
      { id: "hospital-route-wave-07", atSeconds: 133, groups: [{ kind: "grappler", count: 3 }, { kind: "runner", count: 5 }, { kind: "walker", count: 3 }] },
      { id: "hospital-route-wave-08", atSeconds: 158, groups: [{ kind: "ooze", count: 3 }, { kind: "crusher", count: 2 }, { kind: "spitter", count: 3 }] },
    ],
    baseHp: 840,
    mapSignalIds: ["map-signal-underground-research"],
  }),
  operationStage({
    id: CAMPAIGN_STAGE_IDS.RESEARCH_ACCESS,
    stageNumber: 10,
    displayName: "地下研究区画・除染ゲート",
    regionId: CAMPAIGN_REGION_IDS.UNDERGROUND_RESEARCH,
    mapPosition: { x: 18, y: 64, unit: "percent" },
    previousStageId: CAMPAIGN_STAGE_IDS.HOSPITAL_EVACUATION_ROUTE,
    nextStageId: CAMPAIGN_STAGE_IDS.RESEARCH_CONTAINMENT,
    missionType: "assault",
    objectivePattern: "command-node-destruction",
    objective: "除染ゲートを閉鎖する感染指令核を破壊",
    objectiveConfig: { target: "infected-base" },
    theme: {
      id: "theme-research-access",
      backgroundId: "background-research-access-v1",
      tags: ["除染ゲート", "指令核", "隔離扉"],
    },
    enemyKinds: ["walker", "runner", "spitter", "crusher", "shade", "grappler"],
    waves: [
      { id: "research-access-wave-01", atSeconds: 3, groups: [{ kind: "walker", count: 5 }, { kind: "shade", count: 1 }] },
      { id: "research-access-wave-02", atSeconds: 18, groups: [{ kind: "runner", count: 4 }, { kind: "grappler", count: 2 }] },
      { id: "research-access-wave-03", atSeconds: 36, groups: [{ kind: "spitter", count: 3 }, { kind: "shade", count: 2 }] },
      { id: "research-access-wave-04", atSeconds: 56, groups: [{ kind: "crusher", count: 2 }, { kind: "walker", count: 4 }] },
      { id: "research-access-wave-05", atSeconds: 78, groups: [{ kind: "grappler", count: 3 }, { kind: "shade", count: 2 }, { kind: "runner", count: 3 }] },
      { id: "research-access-wave-06", atSeconds: 101, groups: [{ kind: "spitter", count: 3 }, { kind: "crusher", count: 2 }] },
      { id: "research-access-wave-07", atSeconds: 126, groups: [{ kind: "shade", count: 3 }, { kind: "runner", count: 5 }, { kind: "grappler", count: 2 }] },
      { id: "research-access-wave-08", atSeconds: 152, groups: [{ kind: "crusher", count: 3 }, { kind: "spitter", count: 3 }, { kind: "walker", count: 3 }] },
    ],
    baseHp: 820,
  }),
  operationStage({
    id: CAMPAIGN_STAGE_IDS.RESEARCH_CONTAINMENT,
    stageNumber: 11,
    displayName: "地下研究区画・検体隔離環",
    regionId: CAMPAIGN_REGION_IDS.UNDERGROUND_RESEARCH,
    mapPosition: { x: 50, y: 38, unit: "percent" },
    previousStageId: CAMPAIGN_STAGE_IDS.RESEARCH_ACCESS,
    nextStageId: CAMPAIGN_STAGE_IDS.RESEARCH_FREIGHT_PASSAGE,
    missionType: "timed-defense",
    objectivePattern: "perimeter-hold",
    objective: "隔離制御の再起動まで165秒防衛",
    objectiveConfig: {
      target: "containment-control",
      targetLabel: "隔離制御",
      hudLabel: "隔離制御の再起動",
      durationSeconds: 165,
    },
    theme: {
      id: "theme-research-containment",
      backgroundId: "background-research-containment-v1",
      tags: ["検体隔離環", "制御卓", "赤色警報"],
    },
    enemyKinds: ["walker", "runner", "spitter", "crusher", "shade", "abomination", "ooze"],
    waves: [
      { id: "research-containment-wave-01", atSeconds: 3, groups: [{ kind: "walker", count: 6 }] },
      { id: "research-containment-wave-02", atSeconds: 21, groups: [{ kind: "shade", count: 2 }, { kind: "runner", count: 4 }] },
      { id: "research-containment-wave-03", atSeconds: 41, groups: [{ kind: "ooze", count: 2 }, { kind: "spitter", count: 3 }] },
      { id: "research-containment-wave-04", atSeconds: 62, groups: [{ kind: "crusher", count: 2 }, { kind: "walker", count: 4 }] },
      { id: "research-containment-wave-05", atSeconds: 84, groups: [{ kind: "shade", count: 3 }, { kind: "runner", count: 4 }] },
      { id: "research-containment-wave-06", atSeconds: 107, groups: [{ kind: "abomination", count: 1 }, { kind: "spitter", count: 3 }, { kind: "ooze", count: 2 }] },
      { id: "research-containment-wave-07", atSeconds: 132, groups: [{ kind: "crusher", count: 3 }, { kind: "shade", count: 2 }, { kind: "runner", count: 3 }] },
      { id: "research-containment-wave-08", atSeconds: 155, groups: [{ kind: "abomination", count: 1 }, { kind: "ooze", count: 3 }, { kind: "spitter", count: 3 }] },
    ],
    baseHp: 800,
  }),
  operationStage({
    id: CAMPAIGN_STAGE_IDS.RESEARCH_FREIGHT_PASSAGE,
    stageNumber: 12,
    displayName: "地下研究区画・搬送坑道",
    regionId: CAMPAIGN_REGION_IDS.UNDERGROUND_RESEARCH,
    mapPosition: { x: 82, y: 62, unit: "percent" },
    previousStageId: CAMPAIGN_STAGE_IDS.RESEARCH_CONTAINMENT,
    nextStageId: CAMPAIGN_STAGE_IDS.LOGISTICS_RELAY,
    missionType: "escort",
    objectivePattern: "mobile-objective-escort",
    objective: "封印検体キャリアを地上搬出口まで護送",
    objectiveConfig: {
      target: "sealed-sample-carrier",
      targetLabel: "封印検体キャリア",
      durationSeconds: 145,
      maxIntegrity: 620,
      repairSeconds: 18,
      startX: 248,
      endX: 790,
      cartLane: 1,
    },
    theme: {
      id: "theme-research-freight-passage",
      backgroundId: "background-research-freight-passage-v1",
      tags: ["搬送坑道", "検体キャリア", "天井クレーン"],
    },
    enemyKinds: ["walker", "runner", "spitter", "crusher", "grappler", "ooze", "sprinter"],
    waves: [
      { id: "research-freight-wave-01", atSeconds: 2, groups: [{ kind: "walker", count: 5 }, { kind: "sprinter", count: 2 }] },
      { id: "research-freight-wave-02", atSeconds: 18, groups: [{ kind: "grappler", count: 2 }, { kind: "runner", count: 4 }] },
      { id: "research-freight-wave-03", atSeconds: 37, groups: [{ kind: "ooze", count: 2 }, { kind: "spitter", count: 3 }] },
      { id: "research-freight-wave-04", atSeconds: 57, groups: [{ kind: "crusher", count: 2 }, { kind: "sprinter", count: 3 }] },
      { id: "research-freight-wave-05", atSeconds: 79, groups: [{ kind: "grappler", count: 3 }, { kind: "runner", count: 4 }] },
      { id: "research-freight-wave-06", atSeconds: 102, groups: [{ kind: "ooze", count: 3 }, { kind: "spitter", count: 3 }, { kind: "walker", count: 3 }] },
      { id: "research-freight-wave-07", atSeconds: 126, groups: [{ kind: "crusher", count: 3 }, { kind: "sprinter", count: 4 }] },
      { id: "research-freight-wave-08", atSeconds: 151, groups: [{ kind: "grappler", count: 3 }, { kind: "ooze", count: 3 }, { kind: "runner", count: 4 }] },
      { id: "research-freight-wave-09", atSeconds: 178, groups: [{ kind: "crusher", count: 3 }, { kind: "spitter", count: 3 }, { kind: "sprinter", count: 4 }] },
    ],
    baseHp: 780,
    mapSignalIds: ["map-signal-logistics-line"],
  }),
  operationStage({
    id: CAMPAIGN_STAGE_IDS.LOGISTICS_RELAY,
    stageNumber: 13,
    displayName: "避難物流線・中継ヤード",
    regionId: CAMPAIGN_REGION_IDS.LOGISTICS_LINE,
    mapPosition: { x: 28, y: 62, unit: "percent" },
    previousStageId: CAMPAIGN_STAGE_IDS.RESEARCH_FREIGHT_PASSAGE,
    nextStageId: CAMPAIGN_STAGE_IDS.EVACUATION_FREIGHT_YARD,
    missionType: "assault",
    objectivePattern: "relay-destruction",
    objective: "物流網を乗っ取る感染中継点を破壊",
    objectiveConfig: { target: "infected-relay" },
    theme: {
      id: "theme-logistics-relay",
      backgroundId: "background-logistics-relay-v1",
      tags: ["物流ヤード", "感染中継点", "コンテナ"],
    },
    enemyKinds: ["walker", "runner", "spitter", "crusher", "shade", "grappler", "sprinter"],
    waves: [
      { id: "logistics-relay-wave-01", atSeconds: 2, groups: [{ kind: "walker", count: 5 }, { kind: "runner", count: 3 }] },
      { id: "logistics-relay-wave-02", atSeconds: 17, groups: [{ kind: "sprinter", count: 3 }, { kind: "grappler", count: 2 }] },
      { id: "logistics-relay-wave-03", atSeconds: 35, groups: [{ kind: "shade", count: 2 }, { kind: "spitter", count: 3 }] },
      { id: "logistics-relay-wave-04", atSeconds: 54, groups: [{ kind: "crusher", count: 2 }, { kind: "runner", count: 4 }] },
      { id: "logistics-relay-wave-05", atSeconds: 75, groups: [{ kind: "grappler", count: 3 }, { kind: "sprinter", count: 4 }] },
      { id: "logistics-relay-wave-06", atSeconds: 98, groups: [{ kind: "shade", count: 3 }, { kind: "spitter", count: 3 }, { kind: "walker", count: 3 }] },
      { id: "logistics-relay-wave-07", atSeconds: 122, groups: [{ kind: "crusher", count: 3 }, { kind: "runner", count: 4 }, { kind: "grappler", count: 2 }] },
      { id: "logistics-relay-wave-08", atSeconds: 147, groups: [{ kind: "sprinter", count: 5 }, { kind: "shade", count: 2 }, { kind: "spitter", count: 3 }] },
      { id: "logistics-relay-wave-09", atSeconds: 173, groups: [{ kind: "crusher", count: 3 }, { kind: "grappler", count: 3 }, { kind: "runner", count: 4 }] },
    ],
    baseHp: 760,
  }),
  operationStage({
    id: CAMPAIGN_STAGE_IDS.EVACUATION_FREIGHT_YARD,
    stageNumber: 14,
    displayName: "避難物流線・貨物退避場",
    regionId: CAMPAIGN_REGION_IDS.LOGISTICS_LINE,
    mapPosition: { x: 72, y: 40, unit: "percent" },
    previousStageId: CAMPAIGN_STAGE_IDS.LOGISTICS_RELAY,
    nextStageId: CAMPAIGN_STAGE_IDS.T_PLAN_OUTER_CORE,
    missionType: "timed-defense",
    objectivePattern: "perimeter-hold",
    objective: "最後の避難貨物列を180秒防衛",
    objectiveConfig: {
      target: "evacuation-freight",
      targetLabel: "避難貨物列",
      hudLabel: "避難貨物列の防衛完了",
      durationSeconds: 180,
    },
    theme: {
      id: "theme-evacuation-freight-yard",
      backgroundId: "background-evacuation-freight-yard-v1",
      tags: ["貨物退避場", "避難列", "信号橋"],
    },
    enemyKinds: ["walker", "runner", "spitter", "crusher", "shade", "abomination", "grappler", "sprinter"],
    waves: [
      { id: "freight-yard-wave-01", atSeconds: 3, groups: [{ kind: "walker", count: 6 }, { kind: "runner", count: 2 }] },
      { id: "freight-yard-wave-02", atSeconds: 21, groups: [{ kind: "sprinter", count: 3 }, { kind: "grappler", count: 2 }] },
      { id: "freight-yard-wave-03", atSeconds: 40, groups: [{ kind: "shade", count: 2 }, { kind: "spitter", count: 3 }] },
      { id: "freight-yard-wave-04", atSeconds: 60, groups: [{ kind: "crusher", count: 2 }, { kind: "runner", count: 4 }] },
      { id: "freight-yard-wave-05", atSeconds: 81, groups: [{ kind: "grappler", count: 3 }, { kind: "sprinter", count: 4 }] },
      { id: "freight-yard-wave-06", atSeconds: 103, groups: [{ kind: "abomination", count: 1 }, { kind: "spitter", count: 3 }, { kind: "walker", count: 3 }] },
      { id: "freight-yard-wave-07", atSeconds: 127, groups: [{ kind: "crusher", count: 3 }, { kind: "shade", count: 2 }, { kind: "runner", count: 4 }] },
      { id: "freight-yard-wave-08", atSeconds: 151, groups: [{ kind: "grappler", count: 3 }, { kind: "sprinter", count: 4 }, { kind: "spitter", count: 3 }] },
      { id: "freight-yard-wave-09", atSeconds: 174, groups: [{ kind: "abomination", count: 1 }, { kind: "crusher", count: 3 }, { kind: "shade", count: 3 }, { kind: "runner", count: 4 }] },
    ],
    baseHp: 740,
    mapSignalIds: ["map-signal-t-plan-core"],
  }),
  operationStage({
    id: CAMPAIGN_STAGE_IDS.T_PLAN_OUTER_CORE,
    stageNumber: 15,
    displayName: "T計画中枢・外郭制御環",
    regionId: CAMPAIGN_REGION_IDS.T_PLAN_CORE,
    mapPosition: { x: 28, y: 62, unit: "percent" },
    previousStageId: CAMPAIGN_STAGE_IDS.EVACUATION_FREIGHT_YARD,
    nextStageId: CAMPAIGN_STAGE_IDS.T_PLAN_CENTRAL_SEAL,
    missionType: "assault",
    objectivePattern: "command-node-destruction",
    objective: "中枢を守る外郭感染指令核を破壊",
    objectiveConfig: { target: "infected-base" },
    theme: {
      id: "theme-t-plan-outer-core",
      backgroundId: "background-t-plan-outer-core-v1",
      tags: ["T計画", "外郭制御環", "冷却柱"],
    },
    enemyKinds: ["walker", "runner", "spitter", "crusher", "shade", "abomination", "grappler", "ooze", "sprinter"],
    waves: [
      { id: "t-plan-outer-wave-01", atSeconds: 2, groups: [{ kind: "walker", count: 5 }, { kind: "shade", count: 2 }] },
      { id: "t-plan-outer-wave-02", atSeconds: 16, groups: [{ kind: "sprinter", count: 4 }, { kind: "grappler", count: 2 }] },
      { id: "t-plan-outer-wave-03", atSeconds: 33, groups: [{ kind: "ooze", count: 2 }, { kind: "spitter", count: 3 }] },
      { id: "t-plan-outer-wave-04", atSeconds: 51, groups: [{ kind: "crusher", count: 2 }, { kind: "runner", count: 4 }] },
      { id: "t-plan-outer-wave-05", atSeconds: 71, groups: [{ kind: "shade", count: 3 }, { kind: "grappler", count: 3 }, { kind: "sprinter", count: 3 }] },
      { id: "t-plan-outer-wave-06", atSeconds: 92, groups: [{ kind: "abomination", count: 1 }, { kind: "ooze", count: 3 }, { kind: "spitter", count: 3 }] },
      { id: "t-plan-outer-wave-07", atSeconds: 114, groups: [{ kind: "crusher", count: 3 }, { kind: "runner", count: 4 }, { kind: "shade", count: 2 }] },
      { id: "t-plan-outer-wave-08", atSeconds: 138, groups: [{ kind: "grappler", count: 3 }, { kind: "sprinter", count: 5 }, { kind: "spitter", count: 3 }] },
      { id: "t-plan-outer-wave-09", atSeconds: 163, groups: [{ kind: "abomination", count: 1 }, { kind: "crusher", count: 3 }, { kind: "ooze", count: 3 }, { kind: "shade", count: 3 }] },
      { id: "t-plan-outer-wave-10", atSeconds: 190, groups: [{ kind: "grappler", count: 4 }, { kind: "sprinter", count: 5 }, { kind: "spitter", count: 4 }] },
    ],
    baseHp: 720,
  }),
  operationStage({
    id: CAMPAIGN_STAGE_IDS.T_PLAN_CENTRAL_SEAL,
    stageNumber: 16,
    displayName: "T計画中枢・中央封鎖核",
    regionId: CAMPAIGN_REGION_IDS.T_PLAN_CORE,
    mapPosition: { x: 72, y: 40, unit: "percent" },
    previousStageId: CAMPAIGN_STAGE_IDS.T_PLAN_OUTER_CORE,
    nextStageId: CAMPAIGN_STAGE_IDS.BAY_TOWER_SERVICE,
    missionType: "sequential-seal",
    objectivePattern: "sequential-containment",
    objective: "三つの封鎖端末を起動し、中央感染裂孔を完全封鎖",
    objectiveConfig: {
      targetsInOrder: [
        "power-1",
        "power-2",
        "power-3",
        "gate-eater-defeat",
        "research-container",
        "seal-door",
        "return-route",
      ],
      powerHoldSeconds: 7,
      powerReadyAtSeconds: [28, 72, 118],
      powerYs: [212, 352, 282],
      powerXs: [392, 574, 758],
      powerRadiusX: 78,
      powerRadiusY: 40,
      sealDoorX: 872,
      sealY: 282,
      researchContainerStartX: 720,
      researchContainerY: 282,
      returnX: 205,
      returnRadiusX: 96,
      returnRadiusY: 48,
      escapeSeconds: 42,
    },
    theme: {
      id: "theme-t-plan-central-seal",
      backgroundId: "background-t-plan-central-seal-v1",
      tags: ["中央封鎖核", "三端末", "感染裂孔"],
    },
    enemyKinds: ["walker", "runner", "spitter", "crusher", "shade", "abomination", "grappler", "ooze", "sprinter", "gate-eater"],
    waves: [
      { id: "t-plan-seal-wave-01", atSeconds: 0, groups: [{ kind: "walker", count: 6 }, { kind: "runner", count: 3 }] },
      { id: "t-plan-seal-wave-02", atSeconds: 17, groups: [{ kind: "grappler", count: 3 }, { kind: "sprinter", count: 3 }] },
      { id: "t-plan-seal-wave-03", atSeconds: 36, groups: [{ kind: "ooze", count: 3 }, { kind: "spitter", count: 3 }] },
      { id: "t-plan-seal-wave-04", atSeconds: 56, groups: [{ kind: "crusher", count: 3 }, { kind: "shade", count: 2 }] },
      { id: "t-plan-seal-wave-05", atSeconds: 78, groups: [{ kind: "grappler", count: 3 }, { kind: "runner", count: 4 }, { kind: "sprinter", count: 3 }] },
      { id: "t-plan-seal-wave-06", atSeconds: 101, groups: [{ kind: "abomination", count: 1 }, { kind: "ooze", count: 3 }, { kind: "spitter", count: 3 }] },
      { id: "t-plan-seal-warning", atSeconds: 124, waveNumber: 7, label: "中央裂孔 // 大型反応", units: [] },
      { id: "t-plan-seal-gate-eater", atSeconds: 132, waveNumber: 8, label: "改札喰い再活性 // 封鎖対象", units: ["gate-eater", "sprinter", "sprinter", "shade", "spitter"] },
      { id: "t-plan-seal-wave-09", atSeconds: 157, groups: [{ kind: "crusher", count: 3 }, { kind: "grappler", count: 3 }, { kind: "runner", count: 4 }] },
      { id: "t-plan-seal-wave-10", atSeconds: 183, groups: [{ kind: "ooze", count: 3 }, { kind: "shade", count: 3 }, { kind: "spitter", count: 4 }] },
      { id: "t-plan-seal-wave-11", atSeconds: 210, groups: [{ kind: "abomination", count: 1 }, { kind: "crusher", count: 3 }, { kind: "sprinter", count: 5 }] },
      { id: "t-plan-seal-wave-12", atSeconds: 238, groups: [{ kind: "grappler", count: 4 }, { kind: "shade", count: 3 }, { kind: "runner", count: 5 }, { kind: "spitter", count: 3 }] },
    ],
    boss: bossCampaignEntry("gate-eater", {
      encounterId: "boss-gate-eater-central",
      displayName: "改札喰い・再活性体",
      classification: "中央感染裂孔に再接続した大型特殊個体",
      entranceEventId: null,
    }),
    baseHp: 700,
  }),
  operationStage({
    id: CAMPAIGN_STAGE_IDS.BAY_TOWER_SERVICE,
    stageNumber: 17,
    displayName: "湾岸タワー・非常回廊",
    regionId: CAMPAIGN_REGION_IDS.BAY_QUARANTINE,
    mapPosition: { x: 16, y: 62, unit: "percent" },
    previousStageId: CAMPAIGN_STAGE_IDS.T_PLAN_CENTRAL_SEAL,
    nextStageId: CAMPAIGN_STAGE_IDS.CIVIC_ARCHIVE_ROUTE,
    missionType: "assault",
    objectivePattern: "relay-destruction",
    objective: "非常回廊を塞ぐ感染中継点を破壊",
    objectiveConfig: { target: "infected-relay" },
    theme: {
      id: "theme-bay-tower-service",
      backgroundId: "background-bay-tower-service-v1",
      tags: ["湾岸タワー", "非常回廊", "暴風雨"],
    },
    enemyKinds: ["walker", "runner", "spitter", "crusher", "resonator", "cagewalker"],
    waves: [
      { id: "bay-tower-wave-01", atSeconds: 2, groups: [{ kind: "resonator", count: 1 }, { kind: "walker", count: 5 }] },
      { id: "bay-tower-wave-02", atSeconds: 18, groups: [{ kind: "cagewalker", count: 1 }, { kind: "runner", count: 4 }] },
      { id: "bay-tower-wave-03", atSeconds: 37, groups: [{ kind: "spitter", count: 3 }, { kind: "runner", count: 4 }] },
      { id: "bay-tower-wave-04", atSeconds: 57, groups: [{ kind: "cagewalker", count: 1 }, { kind: "walker", count: 5 }] },
      { id: "bay-tower-wave-05", atSeconds: 79, groups: [{ kind: "resonator", count: 2 }, { kind: "runner", count: 4 }] },
      { id: "bay-tower-wave-06", atSeconds: 102, groups: [{ kind: "crusher", count: 2 }, { kind: "cagewalker", count: 1 }, { kind: "spitter", count: 3 }] },
      { id: "bay-tower-wave-07", atSeconds: 126, groups: [{ kind: "resonator", count: 2 }, { kind: "runner", count: 5 }, { kind: "walker", count: 3 }] },
      { id: "bay-tower-wave-08", atSeconds: 151, groups: [{ kind: "cagewalker", count: 2 }, { kind: "crusher", count: 2 }, { kind: "spitter", count: 3 }] },
      { id: "bay-tower-wave-09", atSeconds: 178, groups: [{ kind: "resonator", count: 3 }, { kind: "cagewalker", count: 2 }, { kind: "runner", count: 5 }] },
    ],
    baseHp: 680,
  }),
  operationStage({
    id: CAMPAIGN_STAGE_IDS.CIVIC_ARCHIVE_ROUTE,
    stageNumber: 18,
    displayName: "市民資料館・搬送路",
    regionId: CAMPAIGN_REGION_IDS.BAY_QUARANTINE,
    mapPosition: { x: 38, y: 38, unit: "percent" },
    previousStageId: CAMPAIGN_STAGE_IDS.BAY_TOWER_SERVICE,
    nextStageId: CAMPAIGN_STAGE_IDS.COASTAL_LINK_BRIDGE,
    missionType: "timed-defense",
    objectivePattern: "perimeter-hold",
    objective: "避難記録搬送班を210秒防衛",
    objectiveConfig: {
      target: "archive-transfer-team",
      targetLabel: "記録搬送班",
      hudLabel: "記録搬送完了",
      durationSeconds: 210,
    },
    theme: {
      id: "theme-civic-archive-route",
      backgroundId: "background-civic-archive-route-v1",
      tags: ["市民資料館", "搬送車列", "浸水路"],
    },
    enemyKinds: ["walker", "runner", "spitter", "resonator", "cagewalker", "spindle", "choir-knot"],
    waves: [
      { id: "archive-route-wave-01", atSeconds: 3, groups: [{ kind: "spindle", count: 2 }, { kind: "walker", count: 5 }] },
      { id: "archive-route-wave-02", atSeconds: 21, groups: [{ kind: "choir-knot", count: 1 }, { kind: "runner", count: 4 }] },
      { id: "archive-route-wave-03", atSeconds: 41, groups: [{ kind: "resonator", count: 2 }, { kind: "spitter", count: 3 }] },
      { id: "archive-route-wave-04", atSeconds: 62, groups: [{ kind: "choir-knot", count: 1 }, { kind: "walker", count: 5 }] },
      { id: "archive-route-wave-05", atSeconds: 84, groups: [{ kind: "cagewalker", count: 2 }, { kind: "spindle", count: 3 }] },
      { id: "archive-route-wave-06", atSeconds: 107, groups: [{ kind: "resonator", count: 2 }, { kind: "choir-knot", count: 2 }, { kind: "runner", count: 4 }] },
      { id: "archive-route-wave-07", atSeconds: 131, groups: [{ kind: "spindle", count: 4 }, { kind: "spitter", count: 3 }] },
      { id: "archive-route-wave-08", atSeconds: 156, groups: [{ kind: "cagewalker", count: 2 }, { kind: "choir-knot", count: 2 }, { kind: "walker", count: 4 }] },
      { id: "archive-route-wave-09", atSeconds: 181, groups: [{ kind: "resonator", count: 3 }, { kind: "spindle", count: 4 }, { kind: "runner", count: 4 }] },
      { id: "archive-route-wave-10", atSeconds: 204, groups: [{ kind: "cagewalker", count: 3 }, { kind: "choir-knot", count: 3 }, { kind: "spitter", count: 4 }] },
    ],
    baseHp: 660,
  }),
  operationStage({
    id: CAMPAIGN_STAGE_IDS.COASTAL_LINK_BRIDGE,
    stageNumber: 19,
    displayName: "海浜連絡橋",
    regionId: CAMPAIGN_REGION_IDS.BAY_QUARANTINE,
    mapPosition: { x: 63, y: 61, unit: "percent" },
    previousStageId: CAMPAIGN_STAGE_IDS.CIVIC_ARCHIVE_ROUTE,
    nextStageId: CAMPAIGN_STAGE_IDS.ESTUARY_FLOODGATE_SEAL,
    missionType: "escort",
    objectivePattern: "mobile-objective-escort",
    objective: "防潮門用の非常電源車を対岸まで護送",
    objectiveConfig: {
      target: "floodgate-power-rig",
      targetLabel: "非常電源車",
      durationSeconds: 195,
      maxIntegrity: 760,
      repairSeconds: 20,
      startX: 242,
      endX: 798,
      cartLane: 1,
    },
    theme: {
      id: "theme-coastal-link-bridge",
      backgroundId: "background-coastal-link-bridge-v1",
      tags: ["海浜連絡橋", "非常電源車", "横殴りの雨"],
    },
    enemyKinds: ["runner", "spitter", "crusher", "resonator", "cagewalker", "spindle", "choir-knot", "pall-manta"],
    waves: [
      { id: "coastal-bridge-wave-01", atSeconds: 2, groups: [{ kind: "pall-manta", count: 1 }, { kind: "runner", count: 5 }] },
      { id: "coastal-bridge-wave-02", atSeconds: 19, groups: [{ kind: "pall-manta", count: 1 }, { kind: "spitter", count: 3 }] },
      { id: "coastal-bridge-wave-03", atSeconds: 39, groups: [{ kind: "cagewalker", count: 2 }, { kind: "runner", count: 4 }] },
      { id: "coastal-bridge-wave-04", atSeconds: 60, groups: [{ kind: "resonator", count: 2 }, { kind: "pall-manta", count: 2 }] },
      { id: "coastal-bridge-wave-05", atSeconds: 82, groups: [{ kind: "choir-knot", count: 2 }, { kind: "spindle", count: 4 }] },
      { id: "coastal-bridge-wave-06", atSeconds: 105, groups: [{ kind: "crusher", count: 2 }, { kind: "pall-manta", count: 2 }, { kind: "spitter", count: 3 }] },
      { id: "coastal-bridge-wave-07", atSeconds: 129, groups: [{ kind: "resonator", count: 3 }, { kind: "cagewalker", count: 2 }, { kind: "runner", count: 4 }] },
      { id: "coastal-bridge-wave-08", atSeconds: 154, groups: [{ kind: "pall-manta", count: 3 }, { kind: "choir-knot", count: 2 }, { kind: "spindle", count: 4 }] },
      { id: "coastal-bridge-wave-09", atSeconds: 180, groups: [{ kind: "cagewalker", count: 3 }, { kind: "resonator", count: 3 }, { kind: "spitter", count: 4 }] },
      { id: "coastal-bridge-wave-10", atSeconds: 207, groups: [{ kind: "pall-manta", count: 3 }, { kind: "choir-knot", count: 3 }, { kind: "runner", count: 5 }] },
    ],
    baseHp: 640,
  }),
  operationStage({
    id: CAMPAIGN_STAGE_IDS.ESTUARY_FLOODGATE_SEAL,
    stageNumber: 20,
    displayName: "河口防潮門・最終封鎖",
    regionId: CAMPAIGN_REGION_IDS.BAY_QUARANTINE,
    mapPosition: { x: 87, y: 38, unit: "percent" },
    previousStageId: CAMPAIGN_STAGE_IDS.COASTAL_LINK_BRIDGE,
    nextStageId: null,
    missionType: "boss-assault",
    objectivePattern: "boss-gated-assault",
    objective: "クロメを撃破し、防潮門の感染核を破壊",
    objectiveConfig: { target: "infected-base" },
    theme: {
      id: "theme-estuary-floodgate-seal",
      backgroundId: "background-estuary-floodgate-seal-v1",
      tags: ["河口防潮門", "感染核", "高潮"],
    },
    enemyKinds: [
      "resonator",
      "cagewalker",
      "spindle",
      "choir-knot",
      "pall-manta",
      "anchor-bloom",
      "kurome",
    ],
    waves: [
      { id: "floodgate-seal-wave-01", atSeconds: 0, groups: [{ kind: "anchor-bloom", count: 1 }, { kind: "spindle", count: 3 }, { kind: "resonator", count: 2 }] },
      { id: "floodgate-seal-wave-02", atSeconds: 17, groups: [{ kind: "cagewalker", count: 2 }, { kind: "choir-knot", count: 1 }] },
      { id: "floodgate-seal-wave-03", atSeconds: 36, groups: [{ kind: "pall-manta", count: 2 }, { kind: "spindle", count: 3 }] },
      { id: "floodgate-seal-wave-04", atSeconds: 56, groups: [{ kind: "anchor-bloom", count: 1 }, { kind: "resonator", count: 2 }] },
      { id: "floodgate-seal-wave-05", atSeconds: 77, groups: [{ kind: "cagewalker", count: 2 }, { kind: "choir-knot", count: 2 }, { kind: "spindle", count: 3 }] },
      { id: "floodgate-seal-wave-06", atSeconds: 99, groups: [{ kind: "pall-manta", count: 2 }, { kind: "anchor-bloom", count: 2 }] },
      { id: "floodgate-seal-wave-07", atSeconds: 122, groups: [{ kind: "resonator", count: 3 }, { kind: "spindle", count: 4 }, { kind: "choir-knot", count: 2 }] },
      { id: "floodgate-seal-warning", atSeconds: 145, waveNumber: 8, label: "河口側水路 // 超大型反応", units: [] },
      { id: "floodgate-seal-kurome", atSeconds: 154, waveNumber: 9, label: "クロメ // 防潮門へ侵入", units: ["kurome", "anchor-bloom", "pall-manta"] },
      { id: "floodgate-seal-wave-10", atSeconds: 179, groups: [{ kind: "cagewalker", count: 3 }, { kind: "resonator", count: 3 }] },
      { id: "floodgate-seal-wave-11", atSeconds: 205, groups: [{ kind: "anchor-bloom", count: 2 }, { kind: "choir-knot", count: 3 }, { kind: "spindle", count: 4 }] },
      { id: "floodgate-seal-wave-12", atSeconds: 232, groups: [{ kind: "pall-manta", count: 3 }, { kind: "cagewalker", count: 3 }, { kind: "resonator", count: 4 }] },
      { id: "floodgate-seal-wave-13", atSeconds: 260, groups: [{ kind: "anchor-bloom", count: 3 }, { kind: "choir-knot", count: 3 }, { kind: "spindle", count: 5 }] },
    ],
    boss: bossCampaignEntry("kurome", {
      encounterId: "boss-kurome-floodgate",
      displayName: "クロメ",
      classification: "河口防潮門を覆う超大型感染中枢",
      entranceEventId: null,
    }),
    baseHp: 620,
  }),
]);

export const CAMPAIGN_STAGE_BY_ID = deepFreeze(Object.fromEntries(CAMPAIGN_STAGES.map((stage) => [stage.id, stage])));
export const STAGE_BY_ID = CAMPAIGN_STAGE_BY_ID;
export const INITIAL_STAGE_ID = CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET;

export const CAMPAIGN_UNITS = deepFreeze([
  {
    id: CAMPAIGN_UNIT_IDS.PAISEN,
    unitId: CAMPAIGN_UNIT_IDS.PAISEN,
    aliases: ["brawler", "パイセン"],
    combatKind: "brawler",
    displayName: "パイセン",
    primaryClassId: "class-frontline",
    roleTags: ["近接", "連撃", "押し返し", "低コスト"],
    roleName: "前衛",
    roleIcon: "拳",
    weaponName: "素手",
    attackMode: "連続打撃",
    rangeBand: "近距離",
    primaryTarget: "前線の感染者",
    deploymentHint: "先頭で敵を押し返す",
    description: "拳で前線を押し返す近接戦闘員",
    spritePath: "/brawler-sprites-v1.png",
    appearanceAudit: {
      presentation: "がっしりした男性的表現",
      weaponMatch: "武器を持たない素手の構え",
      result: "既存の名前・外見・素手・画像と整合",
    },
    unlock: { type: "initial" },
  },
  {
    id: CAMPAIGN_UNIT_IDS.HACHI,
    unitId: CAMPAIGN_UNIT_IDS.HACHI,
    aliases: ["scout", "橘迅", "橘 迅", "ハチ"],
    combatKind: "scout",
    displayName: "ハチ",
    primaryClassId: "class-skirmisher",
    roleTags: ["高機動", "近接", "縦横機動", "対高速"],
    roleName: "遊撃手",
    roleIcon: "速",
    weaponName: "バール",
    attackMode: "高速接近・打撃",
    rangeBand: "近距離",
    primaryTarget: "走行型・影走り",
    deploymentHint: "敵の薄い経路へ素早く投入",
    description: "機動力とバールで高速感染者を迎撃する",
    spritePath: "/art/v070/characters/scout-battle-v1.png",
    assetStatus: "approved",
    appearanceAudit: {
      presentation: "赤銅メッシュ、橙色レインシェル、青い配送装備を持つ細身で機動的な男性表現",
      weaponMatch: "青巻きのベル付き鉤形バールと高速近接役が一致",
      result: "承認済み0.7.0 portrait／battle atlasと整合",
    },
    unlock: { type: "initial" },
  },
  {
    id: CAMPAIGN_UNIT_IDS.MIZUCHI,
    unitId: CAMPAIGN_UNIT_IDS.MIZUCHI,
    aliases: ["ranger", "黒木凛", "黒木 凛", "ミズチ"],
    combatKind: "ranger",
    displayName: "ミズチ",
    primaryClassId: "class-marksman",
    roleTags: ["遠距離", "精密", "対特殊", "初弾強化"],
    roleName: "射撃手",
    roleIcon: "狙",
    weaponName: "自動小銃",
    attackMode: "遠距離精密射撃",
    rangeBand: "遠距離",
    primaryTarget: "吐瀉型・大型",
    deploymentHint: "後列から危険個体を狙う",
    description: "自動小銃で遠方の危険個体を優先排除する",
    spritePath: "/art/v070/characters/ranger-battle-v1.png",
    assetStatus: "approved",
    appearanceAudit: {
      presentation: "非対称の黒髪、深紫の絞ったfield jacket、片腕の硫黄色長手袋を持つ女性的表現",
      weaponMatch: "白布と赤帯を巻いた長い消音器付き半自動小銃と遠距離射撃役が一致",
      result: "producer-delegated品質ゲートを通過した0.7.0 portrait／battle atlasと整合",
    },
    storyRole: "序章の現場案内役",
    unlock: { type: "initial" },
  },
  {
    id: CAMPAIGN_UNIT_IDS.NAO,
    unitId: CAMPAIGN_UNIT_IDS.NAO,
    aliases: ["unit-sensei", "medic", "白石直人", "白石 直人", "センセイ", "ナオ"],
    combatKind: "medic",
    displayName: "ナオ",
    primaryClassId: "class-support",
    roleTags: ["低コスト回復", "援護射撃", "低HP優先", "救助", "損害抑制"],
    roleName: "救護支援",
    roleIcon: "救",
    weaponName: "短銃身カービン・救急バッグ",
    attackMode: "援護射撃・味方治療",
    rangeBand: "中距離",
    primaryTarget: "負傷した味方",
    deploymentHint: "味方の後方へ配備",
    description: "部隊に追従し、援護射撃と治療を行う",
    deploymentCost: 35,
    spritePath: "/art/v070/characters/medic-battle-v1.png",
    assetStatus: "approved",
    appearanceAudit: {
      presentation: "成人女性の救護装備表現を新規設計",
      weaponMatch: "短銃身カービン、救急バッグ、止血器具",
      result: "producer-delegated品質ゲートを通過した0.7.0 portrait／battle atlasと整合",
    },
    unlock: { type: "initial" },
  },
  {
    id: CAMPAIGN_UNIT_IDS.TATARA,
    unitId: CAMPAIGN_UNIT_IDS.TATARA,
    aliases: ["brute", "大庭豪", "大庭 豪", "タタラ"],
    combatKind: "brute",
    displayName: "タタラ",
    primaryClassId: "class-heavy",
    roleTags: ["破砕", "対装甲", "対拠点", "怯み"],
    roleName: "破砕兵",
    roleIcon: "砕",
    weaponName: "大型ハンマー",
    attackMode: "重打撃",
    rangeBand: "近距離",
    primaryTarget: "重装型・感染拠点",
    deploymentHint: "前線の要所へ配備",
    description: "大型ハンマーで重装個体と感染拠点を砕く",
    recruitmentCostCaps: 150,
    spritePath: "/art/v070/characters/brute-battle-v1.png",
    assetStatus: "approved",
    appearanceAudit: {
      presentation: "濃紺と黒の大型重装、波状の黒髪、低い開脚姿勢を持つ男性的表現",
      weaponMatch: "黄緑の二本線を持つ派手なcobalt／indigo両頭ハンマーと破砕役が一致",
      result: "producer-delegated品質ゲートを通過した0.7.0 portrait／battle atlasと整合",
    },
    unlock: {
      type: "recruitment",
      stageId: CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET,
      stageNumber: 1,
      costCaps: 150,
    },
  },
  {
    id: CAMPAIGN_UNIT_IDS.CRAZY_KING,
    unitId: CAMPAIGN_UNIT_IDS.CRAZY_KING,
    aliases: ["crazy-king", "クレイジーキング"],
    combatKind: "crazy-king",
    displayName: "クレイジーキング",
    primaryClassId: "class-berserker",
    roleTags: ["近接円形範囲", "対群体", "対拠点", "高リスク殲滅"],
    roleName: "狂戦士",
    roleIcon: "鋸",
    weaponName: "チェーンソー",
    attackMode: "範囲斬撃・押し返し",
    rangeBand: "近距離",
    primaryTarget: "密集群・感染拠点",
    deploymentHint: "密集した前線へ投入",
    description: "チェーンソーで密集群を切り開き、感染拠点へ圧力をかける",
    spritePath: "/art/v060/characters/crazy-king-battle-v1.png",
    appearanceAudit: {
      presentation: "黄色い筒状頭部、緑のパーカー、赤いブーツの表現",
      weaponMatch: "血痕の付いたチェーンソーと狂戦士役が一致",
      result: "正本の表示名・外見・武器・役割と整合",
    },
    unlock: {
      type: "story-join",
      stageId: CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET,
      stageNumber: 1,
      costCaps: 0,
    },
  },
  {
    id: CAMPAIGN_UNIT_IDS.KUMAVERSON,
    unitId: CAMPAIGN_UNIT_IDS.KUMAVERSON,
    aliases: ["kumaverson", "クマバーソン"],
    combatKind: "kumaverson",
    displayName: "クマバーソン",
    primaryClassId: "class-frontline",
    roleTags: ["近接", "足止め", "味方保護", "自己回復"],
    roleName: "前衛打撃",
    roleIcon: "鍋",
    weaponName: "フライパン",
    attackMode: "打撃・足止め",
    rangeBand: "近距離",
    primaryTarget: "重装型・前線の感染者",
    deploymentHint: "前線へ投入して敵を足止め",
    description: "フライパンの強打で前線を支え、敵の進行を止める",
    spritePath: "/art/v060/characters/kumaverson-battle-v1.png",
    appearanceAudit: {
      presentation: "黒髪、汚れた白いTシャツ、黒いパンツの男性的表現",
      weaponMatch: "フライパンと前衛打撃・足止め役が一致",
      result: "正本の表示名・外見・武器・役割と整合",
    },
    unlock: { type: "initial" },
  },
  {
    id: CAMPAIGN_UNIT_IDS.BABAYAGA,
    unitId: CAMPAIGN_UNIT_IDS.BABAYAGA,
    aliases: ["babayaga", "ババヤガ"],
    combatKind: "babayaga",
    displayName: "ババヤガ",
    primaryClassId: "class-marksman",
    roleTags: ["中遠距離", "精密", "特殊優先", "弱点攻撃"],
    roleName: "精密射手",
    roleIcon: "精",
    weaponName: "サプレッサー付き拳銃",
    attackMode: "精密射撃・特殊個体排除",
    rangeBand: "中～遠距離",
    primaryTarget: "特殊個体・危険個体",
    deploymentHint: "危険個体を狙える後列へ配備",
    description: "精密射撃と分析で特殊個体を優先排除する",
    spritePath: "/art/v060/characters/babayaga-battle-v1.png",
    appearanceAudit: {
      presentation: "黒髪、白いワイシャツ、ネクタイ、ショルダーホルスターの男性的表現",
      weaponMatch: "サプレッサー付き拳銃と精密射撃役が一致",
      result: "正本の表示名・外見・武器・役割と整合",
    },
    unlock: { type: "initial" },
  },
  {
    id: CAMPAIGN_UNIT_IDS.RAIDER,
    unitId: CAMPAIGN_UNIT_IDS.RAIDER,
    aliases: ["unit-rokka", "gunner", "真壁玲奈", "真壁 玲奈", "ロッカ", "レイダー"],
    combatKind: "gunner",
    displayName: "レイダー",
    primaryClassId: "class-marksman",
    roleTags: ["中遠距離", "射線上直線範囲", "連射", "制圧", "対群体"],
    roleName: "制圧射手",
    roleIcon: "制",
    weaponName: "軽機関銃",
    attackMode: "射線上制圧連射",
    rangeBand: "中～遠距離",
    primaryTarget: "大型・密集群",
    deploymentHint: "火線を通せる後列へ配備",
    description: "軽機関銃の連射で大型個体と密集群を制圧する",
    recruitmentCostCaps: 200,
    spritePath: "/art/v070/characters/gunner-battle-v1.png",
    assetStatus: "approved",
    appearanceAudit: {
      presentation: "弾帯を着用した女性的表現",
      weaponMatch: "軽機関銃と制圧射撃役が一致",
      result: "producer-delegated品質ゲートを通過した0.7.0 portrait／battle atlasと整合",
    },
    unlock: {
      type: "recruitment",
      stageId: CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE,
      stageNumber: 2,
      costCaps: 200,
    },
  },
  {
    id: CAMPAIGN_UNIT_IDS.GANTETSU,
    unitId: CAMPAIGN_UNIT_IDS.GANTETSU,
    aliases: ["guardian", "ガンテツ"],
    combatKind: "guardian",
    displayName: "ガンテツ",
    primaryClassId: "class-heavy",
    roleTags: ["盾", "防御", "味方保護", "足止め"],
    roleName: "防衛重装",
    roleIcon: "盾",
    weaponName: "大型防護盾",
    attackMode: "防御・足止め",
    rangeBand: "近距離",
    primaryTarget: "前線の感染者",
    deploymentHint: "守る味方の前へ配備",
    description: "大型盾で攻撃を受け止め、後方の味方を守る",
    deploymentCost: 48,
    spritePath: "/art/v070/characters/guardian-battle-v1.png",
    assetStatus: "approved",
    appearanceAudit: {
      presentation: "完全被覆helmet、深緑のロングコート、黒い巨大盾の防衛重装表現",
      weaponMatch: "全身を覆う大型防護盾。銃、警棒、副武器は画面に出さない",
      result: "producer-delegated品質ゲートを通過した0.7.0 portrait／battle atlasと整合",
    },
    unlock: { type: "story-join", stageNumber: 4, costCaps: 0 },
  },
  {
    id: CAMPAIGN_UNIT_IDS.MONKEY,
    unitId: CAMPAIGN_UNIT_IDS.MONKEY,
    aliases: ["engineer", "モンキー"],
    combatKind: "engineer",
    displayName: "モンキー",
    primaryClassId: "class-engineer",
    roleTags: ["設置", "妨害", "足止め", "対地形"],
    roleName: "罠師",
    roleIcon: "工",
    weaponName: "サプレッサー付きコンパクトカービン・罠装置",
    attackMode: "消音射撃・自動足止め装置",
    rangeBand: "中距離",
    primaryTarget: "高速型・侵入経路",
    deploymentHint: "守る戦線の後方へ配備",
    description: "コンパクトカービンと足止め装置で敵の進行を妨害する",
    spritePath: "/art/v080/characters/monkey-battle-r2.png",
    assetStatus: "approved",
    appearanceAudit: {
      presentation: "銀灰色の髪、黒とtanの軽装、俊敏な低姿勢の罠師表現",
      weaponMatch: "サプレッサー付きコンパクトカービン、腿の罠装置",
      result: "0.8.0 identity master／event／card／authored battle pose atlasで同一性を固定",
    },
    unlock: { type: "story-join", stageNumber: 6, costCaps: 0 },
  },
  {
    id: CAMPAIGN_UNIT_IDS.ZAKIMIYA,
    unitId: CAMPAIGN_UNIT_IDS.ZAKIMIYA,
    aliases: ["zakimiya", "ザキミヤ"],
    combatKind: "zakimiya",
    displayName: "ザキミヤ",
    primaryClassId: "class-frontline",
    roleTags: ["近接", "範囲炎上", "対密集", "継続損害"],
    roleName: "火酒使い",
    roleIcon: "酒",
    weaponName: "ウイスキーボトル",
    attackMode: "瓶打撃・火炎瓶投擲",
    rangeBand: "近距離",
    primaryTarget: "密集した感染者",
    deploymentHint: "敵が密集する前線へ配備",
    description: "割れない瓶で前線を支え、火酒投擲で密集群を焼く",
    recruitmentCostCaps: 240,
    spritePath: "/art/v090/characters/zakimiya-battle-r1.png",
    assetStatus: "approved",
    appearanceAudit: {
      presentation: "Producer承認済みidentity masterに基づく、痩身で疲労感のある中年男性表現",
      weaponMatch: "手持ちのウイスキーボトルと腰部の複数ボトルを通常攻撃・火酒投擲へ接続",
      result: "0.9.0正式identity masterから派生したportrait／card／battle atlasで同一性を固定",
    },
    unlock: {
      type: "recruitment",
      stageNumber: 17,
      costCaps: 240,
    },
  },
  {
    id: CAMPAIGN_UNIT_IDS.TKY,
    unitId: CAMPAIGN_UNIT_IDS.TKY,
    aliases: ["tky", "TKY"],
    combatKind: "tky",
    displayName: "TKY",
    primaryClassId: "class-skirmisher",
    roleTags: ["近接", "高速", "前方範囲", "押し戻し"],
    roleName: "光刃剣士",
    roleIcon: "光",
    weaponName: "プラズマブレード",
    attackMode: "高速連続斬撃・巨大光刃薙ぎ払い",
    rangeBand: "近～中距離",
    primaryTarget: "前方の小～中型群",
    deploymentHint: "敵群の向きを固定できる前線へ配備",
    description: "高速の光刃剣技で小集団を崩し、光刃解放で前方を薙ぎ払う",
    recruitmentCostCaps: 280,
    spritePath: "/art/v090/characters/tky-battle-r1.png",
    assetStatus: "approved",
    appearanceAudit: {
      presentation: "Producer承認済みidentity masterに基づく、黒髪で端正な30代男性と黒・暗赤の軽装表現",
      weaponMatch: "白い高輝度coreとpink〜magenta外縁を持つ片手用プラズマブレード",
      result: "0.9.0正式identity masterから派生したportrait／card／battle atlasで同一性を固定",
    },
    unlock: { type: "recruitment", stageNumber: 18, costCaps: 280 },
  },
  {
    id: CAMPAIGN_UNIT_IDS.MRS_CHIHA,
    unitId: CAMPAIGN_UNIT_IDS.MRS_CHIHA,
    aliases: ["mrs-chiha", "Mrs.チハ", "チハ"],
    combatKind: "mrs-chiha",
    displayName: "Mrs.チハ",
    primaryClassId: "class-marksman",
    roleTags: ["遠距離", "範囲爆発", "多地点", "押し戻し"],
    roleName: "制圧擲弾手",
    roleIcon: "榴",
    weaponName: "回転弾倉式グレネードランチャー",
    attackMode: "榴弾射撃・連続多地点爆撃",
    rangeBand: "中～遠距離",
    primaryTarget: "複数の敵密集地点",
    deploymentHint: "最低射程を保てる後列へ配備",
    description: "回転弾倉式ランチャーをスマートに運用し、全弾制圧で複数地点を爆撃する",
    recruitmentCostCaps: 300,
    spritePath: "/art/v090/characters/mrs-chiha-battle-r1.png",
    assetStatus: "approved",
    appearanceAudit: {
      presentation: "Producer承認済みidentity masterに基づく、知的な女性と黒の長衣・白いフリルブラウス表現",
      weaponMatch: "背面収納と両手射撃を使い分ける大型回転弾倉式グレネードランチャー",
      result: "0.9.0正式identity masterから派生したportrait／card／battle atlasで同一性を固定",
    },
    unlock: { type: "recruitment", stageNumber: 19, costCaps: 300 },
  },
  {
    id: CAMPAIGN_UNIT_IDS.MIYAMOTO_MUSASHI,
    unitId: CAMPAIGN_UNIT_IDS.MIYAMOTO_MUSASHI,
    aliases: ["miyamoto-musashi", "宮本武蔵", "武蔵"],
    combatKind: "miyamoto-musashi",
    displayName: "宮本武蔵",
    primaryClassId: "class-frontline",
    roleTags: ["近接", "二刀流", "受け流し", "対boss"],
    roleName: "二刀剣豪",
    roleIcon: "双",
    weaponName: "二刀",
    attackMode: "二刀連続斬り・受け流し反撃",
    rangeBand: "近距離",
    primaryTarget: "大型・boss",
    deploymentHint: "強敵の攻撃を受けられる前線へ配備",
    description: "二刀の技量で強敵を削り、二天一流・無空で近接攻撃を受け流す",
    recruitmentCostCaps: 340,
    spritePath: "/art/v090/characters/miyamoto-musashi-battle-r1.png",
    assetStatus: "approved",
    appearanceAudit: {
      presentation: "Producer承認済みidentity masterに基づく、髷・無精髭・古い和装と補修装備を持つ男性表現",
      weaponMatch: "常に識別可能な二本の日本刀と、技量重視の構え・交差斬り",
      result: "0.9.0正式identity masterから派生したportrait／card／battle atlasで同一性を固定",
    },
    unlock: { type: "recruitment", stageNumber: 20, costCaps: 340 },
  },
  {
    id: CAMPAIGN_UNIT_IDS.MAYO_CHAN,
    unitId: CAMPAIGN_UNIT_IDS.MAYO_CHAN,
    aliases: ["mayo-chan", "マヨちゃん", "マヨ"],
    combatKind: "mayo-chan",
    displayName: "マヨちゃん",
    primaryClassId: "class-skirmisher",
    roleTags: ["高速", "小型優先", "減速", "負傷退避"],
    roleName: "高速遊撃犬",
    roleIcon: "犬",
    weaponName: "噛みつき・タクティカル医療ハーネス",
    attackMode: "高速接近・足元噛みつき・短時間減速",
    rangeBand: "近距離",
    primaryTarget: "小型・高速感染体",
    deploymentHint: "高速敵が抜ける側面へ配備",
    description: "小さな体で敵の側面へ駆け込み、凶暴マヨで連続襲撃して負傷前に退避する",
    recruitmentCostCaps: 260,
    spritePath: "/art/v090/characters/mayo-chan-battle-r1.png",
    assetStatus: "approved",
    appearanceAudit: {
      presentation: "Producer承認済みidentity masterに基づく、長毛cream Chihuahuaの顔・耳・尾・小型体格を維持した愛犬表現",
      weaponMatch: "黄色bandana、黒いtactical medical harness、medical pouchとcanisterを通常・凶暴状態で維持",
      result: "0.9.0正式identity masterからportrait／card／通常・凶暴battle atlasを派生し、同一個体として固定",
    },
    unlock: { type: "recruitment", stageNumber: 20, costCaps: 260 },
  },
]);

export const CAMPAIGN_GUIDE = deepFreeze({
  id: CAMPAIGN_GUIDE_ID,
  characterId: CAMPAIGN_GUIDE_ID,
  aliases: ["guide-noise", "guide-mizuki-nana", "水城奈々", "水城 奈々", "ノイズ", "いくらちゃん"],
  displayName: "いくらちゃん",
  roleName: "通信・地図・情報分析",
  combatant: false,
  location: "移動拠点",
  age: 18,
  portraitPath: V075_VISUAL_PROFILES.ikura.eventPortrait.path,
  assetStatus: "approved",
  appearanceAudit: {
    presentation: "鮮やかなpink space bunと長いtwin-tail、非常に豊かな胸部を支えるivory sweetheart bustier、短いteal bolero、上腿を大きく見せる極短tactical skortと低いthigh-highを持つ18歳の成人女性表現",
    equipmentMatch: "cream／teal headset、rugged tactical tablet、腰の小型radioと通信・地図・情報分析役が一致",
    result: "0.7.5基準デザイン確認済みidentity masterから派生したevent portraitと整合",
  },
});

export const CAMPAIGN_CHARACTERS = deepFreeze([...CAMPAIGN_UNITS, CAMPAIGN_GUIDE]);
export const CAMPAIGN_UNIT_BY_CANONICAL_ID = deepFreeze(Object.fromEntries(CAMPAIGN_UNITS.map((unit) => [unit.id, unit])));
export const CAMPAIGN_UNIT_BY_ID = deepFreeze(Object.fromEntries(CAMPAIGN_UNITS.flatMap((unit) => (
  [unit.id, unit.combatKind, ...unit.aliases].map((id) => [id, unit])
))));
export const UNIT_BY_ID = CAMPAIGN_UNIT_BY_ID;
export const INITIAL_UNIT_IDS = deepFreeze(CAMPAIGN_UNITS.filter((unit) => unit.unlock.type === "initial").map((unit) => unit.id));

function normalizeAliasKey(value) {
  return typeof value === "string"
    ? value.trim().toLocaleLowerCase("ja-JP").replace(/[\s\u3000]+/gu, "")
    : "";
}

const CAMPAIGN_UNIT_ID_BY_ALIAS_KEY = deepFreeze(Object.fromEntries(CAMPAIGN_UNITS.flatMap((unit) => (
  [unit.id, unit.combatKind, unit.displayName, ...unit.aliases]
    .map((alias) => [normalizeAliasKey(alias), unit.id])
))));

const CAMPAIGN_CHARACTER_ID_BY_ALIAS_KEY = deepFreeze({
  ...CAMPAIGN_UNIT_ID_BY_ALIAS_KEY,
  ...Object.fromEntries([
    CAMPAIGN_GUIDE.id,
    CAMPAIGN_GUIDE.displayName,
    ...CAMPAIGN_GUIDE.aliases,
  ].map((alias) => [normalizeAliasKey(alias), CAMPAIGN_GUIDE.id])),
});

export function normalizeCampaignUnitId(value) {
  return CAMPAIGN_UNIT_ID_BY_ALIAS_KEY[normalizeAliasKey(value)] ?? null;
}

export const resolveCampaignUnitId = normalizeCampaignUnitId;

export function normalizeCampaignCharacterId(value) {
  return CAMPAIGN_CHARACTER_ID_BY_ALIAS_KEY[normalizeAliasKey(value)] ?? null;
}

export function campaignUnitIdToCombatKind(value) {
  const unitId = normalizeCampaignUnitId(value);
  return unitId ? CAMPAIGN_UNIT_BY_CANONICAL_ID[unitId]?.combatKind ?? null : null;
}

export function combatKindToCampaignUnitId(value) {
  return normalizeCampaignUnitId(value);
}

export const CAMPAIGN_RECRUITMENT_MILESTONES = deepFreeze({
  1: {
    storyJoinUnitIds: [CAMPAIGN_UNIT_IDS.CRAZY_KING],
    discoveredUnitIds: [CAMPAIGN_UNIT_IDS.CRAZY_KING, CAMPAIGN_UNIT_IDS.TATARA],
    recruitableUnitIds: [CAMPAIGN_UNIT_IDS.TATARA],
  },
  2: {
    storyJoinUnitIds: [],
    discoveredUnitIds: [CAMPAIGN_UNIT_IDS.RAIDER],
    recruitableUnitIds: [CAMPAIGN_UNIT_IDS.RAIDER],
  },
  4: {
    storyJoinUnitIds: [CAMPAIGN_UNIT_IDS.GANTETSU],
    discoveredUnitIds: [CAMPAIGN_UNIT_IDS.GANTETSU],
    recruitableUnitIds: [],
  },
  5: {
    storyJoinUnitIds: [],
    discoveredUnitIds: [CAMPAIGN_UNIT_IDS.MONKEY],
    recruitableUnitIds: [],
  },
  6: {
    storyJoinUnitIds: [CAMPAIGN_UNIT_IDS.MONKEY],
    discoveredUnitIds: [CAMPAIGN_UNIT_IDS.MONKEY],
    recruitableUnitIds: [],
  },
  17: {
    storyJoinUnitIds: [],
    discoveredUnitIds: [CAMPAIGN_UNIT_IDS.ZAKIMIYA],
    recruitableUnitIds: [CAMPAIGN_UNIT_IDS.ZAKIMIYA],
  },
  18: {
    storyJoinUnitIds: [],
    discoveredUnitIds: [CAMPAIGN_UNIT_IDS.TKY],
    recruitableUnitIds: [CAMPAIGN_UNIT_IDS.TKY],
  },
  19: {
    storyJoinUnitIds: [],
    discoveredUnitIds: [CAMPAIGN_UNIT_IDS.MRS_CHIHA],
    recruitableUnitIds: [CAMPAIGN_UNIT_IDS.MRS_CHIHA],
  },
  20: {
    storyJoinUnitIds: [],
    discoveredUnitIds: [CAMPAIGN_UNIT_IDS.MIYAMOTO_MUSASHI, CAMPAIGN_UNIT_IDS.MAYO_CHAN],
    recruitableUnitIds: [CAMPAIGN_UNIT_IDS.MIYAMOTO_MUSASHI, CAMPAIGN_UNIT_IDS.MAYO_CHAN],
  },
});

export const CAMPAIGN_RECRUITMENT_COSTS = deepFreeze({
  [CAMPAIGN_UNIT_IDS.TATARA]: 150,
  [CAMPAIGN_UNIT_IDS.RAIDER]: 200,
  [CAMPAIGN_UNIT_IDS.ZAKIMIYA]: 240,
  [CAMPAIGN_UNIT_IDS.TKY]: 280,
  [CAMPAIGN_UNIT_IDS.MRS_CHIHA]: 300,
  [CAMPAIGN_UNIT_IDS.MIYAMOTO_MUSASHI]: 340,
  [CAMPAIGN_UNIT_IDS.MAYO_CHAN]: 260,
});

/**
 * Stars depend only on victory and the surviving base-HP ratio.
 * Incidental battle data supplied by callers is intentionally ignored.
 */
export function calculateStageStars({
  won = false,
  baseHp = 0,
  baseMaxHp = 0,
  thresholds = DEFAULT_STAR_THRESHOLDS,
} = {}) {
  if (won !== true || !Number.isFinite(Number(baseHp)) || !Number.isFinite(Number(baseMaxHp)) || Number(baseMaxHp) <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, Number(baseHp) / Number(baseMaxHp)));
  const one = clampNumber(thresholds?.[1], 0, 1, DEFAULT_STAR_THRESHOLDS[1]);
  const two = clampNumber(thresholds?.[2], one, 1, DEFAULT_STAR_THRESHOLDS[2]);
  const three = clampNumber(thresholds?.[3], two, 1, DEFAULT_STAR_THRESHOLDS[3]);
  if (ratio >= three) return 3;
  if (ratio >= two) return 2;
  if (ratio >= one) return 1;
  return 0;
}

export const calculateStars = calculateStageStars;

function normalizeStarMilestones(value) {
  if (Number.isFinite(Number(value)) && !Array.isArray(value)) {
    const highest = clampInteger(value, 0, 3, 0);
    return Array.from({ length: highest }, (_, index) => index + 1);
  }
  if (isRecord(value)) {
    return [1, 2, 3].filter((star) => value[star] === true || value[String(star)] === true);
  }
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((star) => Number(star))
    .filter((star) => Number.isInteger(star) && star >= 1 && star <= 3))]
    .sort((a, b) => a - b);
}

export function calculateStageRewards({ stageId, stars = 0, claimedStarRewards = [] } = {}) {
  const stage = CAMPAIGN_STAGE_BY_ID[stageId];
  if (!stage) throw new RangeError(`Unknown campaign stage: ${String(stageId)}`);
  const earnedStars = clampInteger(stars, 0, 3, 0);
  const claimed = new Set(normalizeStarMilestones(claimedStarRewards));
  const replayMultiplier = earnedStars > 0 ? stage.replayRewardMultipliers[earnedStars] : 0;
  const replayReward = earnedStars > 0 ? Math.round(stage.baseReward * replayMultiplier) : 0;
  const newStarMilestones = Array.from({ length: earnedStars }, (_, index) => index + 1).filter((star) => !claimed.has(star));
  const firstTimeStarReward = newStarMilestones.reduce((total, star) => total + stage.firstTimeStarRewards[star], 0);
  return {
    currencyName: "キャップ",
    baseReward: stage.baseReward,
    replayMultiplier,
    replayReward,
    newStarMilestones,
    firstTimeStarReward,
    totalReward: replayReward + firstTimeStarReward,
  };
}

export const calculateBattleRewards = calculateStageRewards;

const V090_LEVEL_ECONOMY_SCHEMA_VERSION = 10;
export const CAMPAIGN_SAVE_SCHEMA_VERSION = 13;
export const SAVE_SCHEMA_VERSION = CAMPAIGN_SAVE_SCHEMA_VERSION;
const CAMPAIGN_INTEGRITY_REQUIRED_FROM_SCHEMA_VERSION = 5;

export const CAMPAIGN_FORMATION_MAX_SLOTS = 7;
export const CAMPAIGN_FORMATION_PRESET_IDS = deepFreeze({
  SQUAD_1: "formation-preset-1",
  SQUAD_2: "formation-preset-2",
  SQUAD_3: "formation-preset-3",
});

const CAMPAIGN_FORMATION_PRESET_LABELS = deepFreeze({
  [CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_1]: "部隊1",
  [CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_2]: "部隊2",
  [CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_3]: "部隊3",
});

const CAMPAIGN_FORMATION_PRESET_ORDER = deepFreeze(Object.values(CAMPAIGN_FORMATION_PRESET_IDS));

export const DEFAULT_CAMPAIGN_SETTINGS = deepFreeze({
  bgmEnabled: true,
  sfxEnabled: true,
  bgmVolume: 0.75,
  sfxVolume: 0.8,
  reducedMotion: false,
  battleEventMode: "first-time",
});

export function normalizeEquipmentInventory(value) {
  const quantities = new Map();
  const add = (equipmentId, quantity) => {
    const id = typeof equipmentId === "string" ? equipmentId.trim().slice(0, 160) : "";
    const numeric = Number(quantity);
    if (!id
      || id === "prototype"
      || Object.hasOwn(Object.prototype, id)
      || !Number.isFinite(numeric)
      || numeric <= 0) {
      return;
    }
    const normalizedQuantity = clampInteger(numeric, 1, Number.MAX_SAFE_INTEGER, 1);
    quantities.set(
      id,
      Math.min(Number.MAX_SAFE_INTEGER, (quantities.get(id) ?? 0) + normalizedQuantity),
    );
  };
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (isRecord(entry)) add(entry.equipmentId ?? entry.id, entry.quantity);
      else if (typeof entry === "string") add(entry, 1);
    }
  } else if (isRecord(value)) {
    for (const [equipmentId, quantity] of Object.entries(value)) add(equipmentId, quantity);
  }
  return [...quantities.entries()]
    .map(([equipmentId, quantity]) => ({ equipmentId, quantity }))
    .sort((left, right) => left.equipmentId.localeCompare(right.equipmentId));
}

function addEquipmentInventory(inventory, grants) {
  return normalizeEquipmentInventory([
    ...normalizeEquipmentInventory(inventory),
    ...normalizeEquipmentInventory(grants),
  ]);
}

function equipmentQuantityMap(inventory) {
  return new Map(normalizeEquipmentInventory(inventory)
    .map(({ equipmentId, quantity }) => [equipmentId, quantity]));
}

export function campaignEquipmentQuantity(save, equipmentId) {
  const current = migrateCampaignSave(save);
  return equipmentQuantityMap(current.equipmentInventory).get(equipmentId) ?? 0;
}

export function createDefaultCampaignSave() {
  const ownership = [...INITIAL_UNIT_IDS];
  const formationUnitIds = [...INITIAL_UNIT_IDS].slice(0, CAMPAIGN_FORMATION_MAX_SLOTS);
  const formationPresets = CAMPAIGN_FORMATION_PRESET_ORDER.map((id) => ({
    id,
    displayName: CAMPAIGN_FORMATION_PRESET_LABELS[id],
    unitIds: [...formationUnitIds],
    personalEquipmentByUnit: {},
    tacticalEquipmentIds: Array.from({ length: TACTICAL_EQUIPMENT_SLOTS }, () => null),
  }));
  return {
    schemaVersion: CAMPAIGN_SAVE_SCHEMA_VERSION,
    revision: 0,
    updatedAt: "",
    integrity: "",
    campaignStarted: false,
    storyScriptVersion: STORY_SCRIPT_VERSION,
    readStoryEventIds: [],
    autoSkipReadStory: false,
    processedResultIds: [],
    processedAcquisitionIds: [],
    processedUpgradeIds: [],
    processedEquipmentTransactionIds: [],
    processedMigrationIds: [],
    migrationNotices: [],
    eventFoundation: createEventFoundationProgress(),
    completedStageIds: [],
    bestStarsByStage: {},
    claimedStarRewardsByStage: {},
    caps: V090_CAPS_MIGRATION_BASE,
    // Deprecated 0.6.x currency field retained as a synchronized read alias.
    supplies: V090_CAPS_MIGRATION_BASE,
    equipmentInventory: [],
    equipmentEnhancementLevels: {},
    unlockedStageIds: [INITIAL_STAGE_ID],
    ownership,
    discovery: [...ownership],
    recruitable: [],
    unitLevels: normalizeUnitLevels({}, CAMPAIGN_UNITS.map((unit) => unit.id)),
    // Deprecated pre-0.9 progression alias. Values remain Level - 1.
    unitRanks: normalizeUnitRanks({}, CAMPAIGN_UNITS.map((unit) => unit.id)),
    // Deprecated 0.6.x roster field retained as a canonical-ID mirror.
    unlockedUnitIds: [...ownership],
    formationPresets,
    selectedFormationPresetId: CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_1,
    selectedPresetId: CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_1,
    lastSelectedStageId: INITIAL_STAGE_ID,
    survival: createDefaultSurvivalProgress(),
    outbreaks: createDefaultOutbreakProgress(),
    records: createDefaultCampaignRecords(),
    settings: { ...DEFAULT_CAMPAIGN_SETTINGS },
  };
}

function firstDefined(record, keys, fallback) {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return fallback;
}

function normalizeBestStars(value) {
  if (!isRecord(value)) return {};
  const normalized = {};
  for (const [stageId, stars] of Object.entries(value)) {
    if (stageId.length > 0 && Number.isFinite(Number(stars))) normalized[stageId] = clampInteger(stars, 0, 3, 0);
  }
  return normalized;
}

function normalizeClaimedRewards(value) {
  if (!isRecord(value)) return {};
  const normalized = {};
  for (const [stageId, milestones] of Object.entries(value)) {
    if (stageId.length === 0) continue;
    const claimed = normalizeStarMilestones(milestones);
    if (claimed.length > 0) normalized[stageId] = claimed;
  }
  return normalized;
}

function normalizeMigrationNotices(value) {
  if (!Array.isArray(value)) return [];
  const notices = [];
  const seen = new Set();
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const id = typeof entry.id === "string" ? entry.id.trim().slice(0, 160) : "";
    const title = typeof entry.title === "string" ? entry.title.trim().slice(0, 160) : "";
    const body = typeof entry.body === "string" ? entry.body.trim().slice(0, 1_200) : "";
    if (!id || !title || !body || seen.has(id) || Object.hasOwn(Object.prototype, id)) continue;
    seen.add(id);
    notices.push({
      id,
      title,
      body,
      previousCaps: clampInteger(entry.previousCaps, 0, Number.MAX_SAFE_INTEGER, 0),
      nextCaps: clampInteger(entry.nextCaps, 0, Number.MAX_SAFE_INTEGER, 0),
    });
  }
  return notices;
}

function normalizeSettings(value, { recoverLegacySilence = false } = {}) {
  const source = isRecord(value) ? value : {};
  const bgmLegacy = firstDefined(source, ["bgmEnabled", "bgm", "musicEnabled"], DEFAULT_CAMPAIGN_SETTINGS.bgmEnabled);
  const sfxLegacy = firstDefined(source, ["sfxEnabled", "sfx", "effectsEnabled"], DEFAULT_CAMPAIGN_SETTINGS.sfxEnabled);
  const normalized = {
    bgmEnabled: typeof bgmLegacy === "boolean" ? bgmLegacy : DEFAULT_CAMPAIGN_SETTINGS.bgmEnabled,
    sfxEnabled: typeof sfxLegacy === "boolean" ? sfxLegacy : DEFAULT_CAMPAIGN_SETTINGS.sfxEnabled,
    bgmVolume: clampNumber(source.bgmVolume, 0, 1, DEFAULT_CAMPAIGN_SETTINGS.bgmVolume),
    sfxVolume: clampNumber(source.sfxVolume, 0, 1, DEFAULT_CAMPAIGN_SETTINGS.sfxVolume),
    reducedMotion: typeof source.reducedMotion === "boolean" ? source.reducedMotion : DEFAULT_CAMPAIGN_SETTINGS.reducedMotion,
    battleEventMode: ["first-time", "compact", "all"].includes(source.battleEventMode)
      ? source.battleEventMode
      : DEFAULT_CAMPAIGN_SETTINGS.battleEventMode,
  };
  const fullySilent = (!normalized.bgmEnabled || normalized.bgmVolume <= 0)
    && (!normalized.sfxEnabled || normalized.sfxVolume <= 0);
  if (!recoverLegacySilence || !fullySilent) return normalized;
  return {
    ...normalized,
    bgmEnabled: true,
    sfxEnabled: true,
    bgmVolume: normalized.bgmVolume > 0 ? normalized.bgmVolume : DEFAULT_CAMPAIGN_SETTINGS.bgmVolume,
    sfxVolume: normalized.sfxVolume > 0 ? normalized.sfxVolume : DEFAULT_CAMPAIGN_SETTINGS.sfxVolume,
  };
}

function orderCampaignUnitIds(unitIds) {
  const ids = new Set(unitIds);
  const knownOrder = CAMPAIGN_UNITS.map((unit) => unit.id);
  const known = new Set(knownOrder);
  return [
    ...knownOrder.filter((id) => ids.has(id)),
    ...[...ids].filter((id) => !known.has(id)),
  ];
}

function normalizeRosterUnitIds(value) {
  let candidates = value;
  if (isRecord(value)) {
    candidates = firstDefined(value, [
      "unitIds",
      "ownedUnitIds",
      "discoveredUnitIds",
      "recruitableUnitIds",
      "ids",
    ], null);
    if (!Array.isArray(candidates)) {
      candidates = Object.entries(value)
        .filter(([, enabled]) => enabled === true)
        .map(([unitId]) => unitId);
    }
  }
  return orderCampaignUnitIds(uniqueStrings(candidates).map((candidate) => (
    normalizeCampaignUnitId(candidate) ?? candidate.trim()
  )));
}

function deriveStageUnlocks(completedStageIds, explicitStageIds = []) {
  const completed = new Set(completedStageIds);
  const knownStageOrder = CAMPAIGN_STAGES.map((stage) => stage.id);
  const knownStageIds = new Set(knownStageOrder);
  const stages = new Set([INITIAL_STAGE_ID, ...explicitStageIds, ...completedStageIds]);
  for (const stageId of completed) {
    const stage = CAMPAIGN_STAGE_BY_ID[stageId];
    if (!stage) continue;
    for (const unlockedStageId of stage.nextUnlocks.stageIds) stages.add(unlockedStageId);
  }
  const unlockedStageIds = [
    ...knownStageOrder.filter((id) => stages.has(id)),
    ...[...stages].filter((id) => !knownStageIds.has(id)),
  ];
  return { unlockedStageIds };
}

const LEGACY_STAGE_OWNERSHIP = deepFreeze({
  [CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET]: [
    CAMPAIGN_UNIT_IDS.TATARA,
    CAMPAIGN_UNIT_IDS.CRAZY_KING,
  ],
  [CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE]: [
    CAMPAIGN_UNIT_IDS.KUMAVERSON,
    CAMPAIGN_UNIT_IDS.BABAYAGA,
    CAMPAIGN_UNIT_IDS.RAIDER,
  ],
});

function stageNumberForId(stageId) {
  const explicit = Number(CAMPAIGN_STAGE_BY_ID[stageId]?.stageNumber);
  if (Number.isInteger(explicit) && explicit > 0) return explicit;
  const match = typeof stageId === "string" ? stageId.match(/(?:^|-)stage-?(\d+)(?:-|$)/i) : null;
  return match ? Number(match[1]) : null;
}

function deriveRoster({
  completedStageIds,
  explicitOwnership,
  explicitDiscovery,
  explicitRecruitable,
  sourceSchemaVersion,
  repairQaAllUnlockLeak = false,
}) {
  const ownership = new Set(INITIAL_UNIT_IDS);
  const discovery = new Set(INITIAL_UNIT_IDS);
  const recruitable = new Set();

  if (!repairQaAllUnlockLeak) {
    for (const unitId of explicitOwnership) ownership.add(unitId);
    for (const unitId of explicitDiscovery) discovery.add(unitId);
    for (const unitId of explicitRecruitable) {
      discovery.add(unitId);
      recruitable.add(unitId);
    }
  }

  if (!Number.isFinite(sourceSchemaVersion) || sourceSchemaVersion < V090_LEVEL_ECONOMY_SCHEMA_VERSION) {
    for (const stageId of completedStageIds) {
      for (const unitId of LEGACY_STAGE_OWNERSHIP[stageId] ?? []) ownership.add(unitId);
    }
  }

  for (const stageId of completedStageIds) {
    const milestone = CAMPAIGN_RECRUITMENT_MILESTONES[stageNumberForId(stageId)];
    if (!milestone) continue;
    for (const unitId of milestone.storyJoinUnitIds) ownership.add(unitId);
    for (const unitId of milestone.discoveredUnitIds) discovery.add(unitId);
    for (const unitId of milestone.recruitableUnitIds) recruitable.add(unitId);
  }

  for (const unitId of ownership) {
    discovery.add(unitId);
    recruitable.delete(unitId);
  }

  return {
    ownership: orderCampaignUnitIds(ownership),
    discovery: orderCampaignUnitIds(discovery),
    recruitable: orderCampaignUnitIds(recruitable),
  };
}

function normalizeFormationPresetId(value) {
  if (CAMPAIGN_FORMATION_PRESET_ORDER.includes(value)) return value;
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 3) {
    return CAMPAIGN_FORMATION_PRESET_ORDER[numeric - 1];
  }
  const normalized = normalizeAliasKey(value);
  const index = ["部隊1", "部隊2", "部隊3"].map(normalizeAliasKey).indexOf(normalized);
  return index >= 0 ? CAMPAIGN_FORMATION_PRESET_ORDER[index] : null;
}

function normalizeFormationUnitIds(value, ownership) {
  const owned = new Set(ownership);
  const candidates = normalizeRosterUnitIds(value)
    .filter((unitId) => CAMPAIGN_UNIT_BY_CANONICAL_ID[unitId] && owned.has(unitId));
  return candidates.slice(0, CAMPAIGN_FORMATION_MAX_SLOTS);
}

function normalizePresetEquipment(source, unitIds, inventory) {
  const available = equipmentQuantityMap(inventory);
  const usage = new Map();
  const reserve = (equipmentId, slotType, seen) => {
    const entry = equipmentDefinition(equipmentId);
    if (!entry || entry.slotType !== slotType || seen.has(equipmentId)) return false;
    const nextUsage = (usage.get(equipmentId) ?? 0) + 1;
    if (nextUsage > (available.get(equipmentId) ?? 0)) return false;
    usage.set(equipmentId, nextUsage);
    seen.add(equipmentId);
    return true;
  };
  const personalSource = isRecord(source)
    ? firstDefined(source, ["personalEquipmentByUnit", "personalEquipment", "unitEquipment"], {})
    : {};
  const personalEquipmentByUnit = {};
  if (isRecord(personalSource)) {
    for (const unitId of unitIds) {
      const seen = new Set();
      const equipmentIds = Array.isArray(personalSource[unitId]) ? personalSource[unitId] : [];
      const normalized = Array.from({ length: PERSONAL_EQUIPMENT_SLOTS }, () => null);
      for (let slotIndex = 0; slotIndex < PERSONAL_EQUIPMENT_SLOTS; slotIndex += 1) {
        const equipmentId = equipmentIds[slotIndex];
        if (typeof equipmentId !== "string") continue;
        if (reserve(equipmentId, EQUIPMENT_SLOT_TYPES.PERSONAL, seen)) {
          normalized[slotIndex] = equipmentId;
        }
      }
      if (normalized.some(Boolean)) personalEquipmentByUnit[unitId] = normalized;
    }
  }
  const tacticalSource = isRecord(source)
    ? firstDefined(source, ["tacticalEquipmentIds", "tacticalEquipment", "teamEquipmentIds"], [])
    : [];
  const tacticalEquipmentIds = Array.from({ length: TACTICAL_EQUIPMENT_SLOTS }, () => null);
  const tacticalSeen = new Set();
  for (let slotIndex = 0; slotIndex < TACTICAL_EQUIPMENT_SLOTS; slotIndex += 1) {
    const equipmentId = Array.isArray(tacticalSource) ? tacticalSource[slotIndex] : null;
    if (typeof equipmentId !== "string") continue;
    if (reserve(equipmentId, EQUIPMENT_SLOT_TYPES.TACTICAL, tacticalSeen)) {
      tacticalEquipmentIds[slotIndex] = equipmentId;
    }
  }
  return { personalEquipmentByUnit, tacticalEquipmentIds };
}

function normalizeFormationPresets(value, ownership, legacyFormation, equipmentInventory = []) {
  const ownedKnownIds = ownership.filter((unitId) => CAMPAIGN_UNIT_BY_CANONICAL_ID[unitId]);
  const defaultUnitIds = normalizeFormationUnitIds(
    Array.isArray(legacyFormation) && legacyFormation.length > 0 ? legacyFormation : ownedKnownIds,
    ownership,
  );
  const safeDefault = defaultUnitIds.length > 0 ? defaultUnitIds : [CAMPAIGN_UNIT_IDS.PAISEN];
  const sourceEntries = Array.isArray(value)
    ? value
    : isRecord(value)
      ? Object.entries(value).map(([id, preset]) => (
        Array.isArray(preset) ? { id, unitIds: preset } : { id, ...(isRecord(preset) ? preset : {}) }
      ))
      : [];

  return CAMPAIGN_FORMATION_PRESET_ORDER.map((id, index) => {
    const identifiedSource = sourceEntries.find((entry) => (
      normalizeFormationPresetId(entry?.id ?? entry?.presetId ?? entry?.name) === id
    ));
    const positionalSource = sourceEntries[index];
    const source = identifiedSource ?? (
      positionalSource
      && !normalizeFormationPresetId(positionalSource?.id ?? positionalSource?.presetId ?? positionalSource?.name)
        ? positionalSource
        : null
    );
    const requested = isRecord(source)
      ? firstDefined(source, ["unitIds", "units", "formationUnitIds", "formationKinds"], [])
      : [];
    const unitIds = normalizeFormationUnitIds(requested, ownership);
    const selectedUnitIds = unitIds.length > 0 ? unitIds : [...safeDefault];
    const equipment = normalizePresetEquipment(source, selectedUnitIds, equipmentInventory);
    return {
      id,
      displayName: CAMPAIGN_FORMATION_PRESET_LABELS[id],
      unitIds: selectedUnitIds,
      ...equipment,
    };
  });
}

/**
 * Normalizes current data and migrates schema-less/v0 aliases. Unknown fields
 * are ignored without invalidating recognized progress.
 */
export function migrateCampaignSave(
  rawSave,
  { eventRegistry = EVENT_FOUNDATION_REGISTRY } = {},
) {
  let source = rawSave;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return createDefaultCampaignSave();
    }
  }
  if (!isRecord(source)) return createDefaultCampaignSave();

  const bestStarsByStage = normalizeBestStars(firstDefined(source, ["bestStarsByStage", "stageStars", "bestStars"], {}));
  const explicitCompleted = uniqueStrings(firstDefined(source, ["completedStageIds", "completedStages", "clearedStages"], []));
  const completedStageIds = [...new Set([
    ...explicitCompleted,
    ...Object.entries(bestStarsByStage).filter(([, stars]) => stars > 0).map(([stageId]) => stageId),
  ])];
  const claimedStarRewardsByStage = normalizeClaimedRewards(firstDefined(
    source,
    ["claimedStarRewardsByStage", "claimedStarMilestones", "claimedStarRewards"],
    {},
  ));
  const explicitStageIds = uniqueStrings(firstDefined(source, ["unlockedStageIds", "unlockedStages"], []));
  const unlocks = deriveStageUnlocks(completedStageIds, explicitStageIds);
  const selectedCandidate = firstDefined(source, ["lastSelectedStageId", "lastSelectedStage", "lastStageId"], INITIAL_STAGE_ID);
  const lastSelectedStageId = typeof selectedCandidate === "string"
    && CAMPAIGN_STAGE_BY_ID[selectedCandidate]
    && unlocks.unlockedStageIds.includes(selectedCandidate)
    ? selectedCandidate
    : INITIAL_STAGE_ID;
  const rawSettings = firstDefined(source, ["settings", "options"], {});
  const hasLegacyProgress = completedStageIds.length > 0
    || Object.values(bestStarsByStage).some((stars) => stars > 0)
    || Object.keys(claimedStarRewardsByStage).length > 0
    || clampInteger(firstDefined(source, ["caps", "supplies", "supply", "currency"], 0), 0, Number.MAX_SAFE_INTEGER, 0) > 0
    || lastSelectedStageId !== INITIAL_STAGE_ID;
  const sourceSchemaVersion = Number(source.schemaVersion);
  const campaignStarted = typeof source.campaignStarted === "boolean"
    ? source.campaignStarted
    : Number.isFinite(sourceSchemaVersion) && sourceSchemaVersion >= 1
      ? true
      : hasLegacyProgress;
  // IDs are opaque receipts. Keep the full ledger so no old result can become
  // payable again after enough later battles.
  const processedResultIds = uniqueStrings(firstDefined(source, ["processedResultIds", "appliedResultIds"], []));
  const processedAcquisitionIds = uniqueStrings(firstDefined(
    source,
    ["processedAcquisitionIds", "processedRecruitmentIds", "appliedRecruitmentIds"],
    [],
  ));
  const processedUpgradeIds = uniqueStrings(firstDefined(
    source,
    ["processedUpgradeIds", "appliedUpgradeIds"],
    [],
  ));
  const processedEquipmentTransactionIds = uniqueStrings(firstDefined(
    source,
    ["processedEquipmentTransactionIds", "appliedEquipmentTransactionIds"],
    [],
  ));
  const sourceProcessedMigrationIds = uniqueStrings(firstDefined(
    source,
    ["processedMigrationIds", "migrationReceipts"],
    [],
  ));
  const sourceMigrationNotices = normalizeMigrationNotices(firstDefined(
    source,
    ["migrationNotices", "pendingMigrationNotices"],
    [],
  ));
  const eventFoundation = normalizeEventFoundationProgress(firstDefined(
    source,
    ["eventFoundation", "eventProgress"],
    null,
  ), { registry: eventRegistry });
  const sourceStoryScriptVersion = typeof source.storyScriptVersion === "string"
    ? source.storyScriptVersion.trim()
    : "";
  const storedReadStoryEventIds = uniqueStrings(firstDefined(
    source,
    ["readStoryEventIds", "readEventIds", "seenStoryEventIds"],
    [],
  ));
  const readStoryEventIds = sourceStoryScriptVersion && sourceStoryScriptVersion !== STORY_SCRIPT_VERSION
    ? []
    : storedReadStoryEventIds;
  const autoSkipCandidate = firstDefined(
    source,
    ["autoSkipReadStory", "autoSkipReadEvents"],
    isRecord(rawSettings) ? rawSettings.autoSkipReadStory : false,
  );
  const explicitOwnership = normalizeRosterUnitIds(firstDefined(
    source,
    ["ownership", "ownedUnitIds", "unlockedUnitIds", "unlockedUnits"],
    [],
  ));
  const explicitDiscovery = normalizeRosterUnitIds(firstDefined(
    source,
    ["discovery", "discoveredUnitIds", "knownUnitIds"],
    [],
  ));
  const explicitRecruitable = normalizeRosterUnitIds(firstDefined(
    source,
    ["recruitable", "recruitableUnitIds", "availableRecruitmentUnitIds"],
    [],
  ));
  const knownUnitIds = CAMPAIGN_UNITS.map((unit) => unit.id);
  const legacyQaAllUnitIds = [
    CAMPAIGN_UNIT_IDS.PAISEN,
    CAMPAIGN_UNIT_IDS.HACHI,
    CAMPAIGN_UNIT_IDS.MIZUCHI,
    CAMPAIGN_UNIT_IDS.NAO,
    CAMPAIGN_UNIT_IDS.TATARA,
    CAMPAIGN_UNIT_IDS.CRAZY_KING,
    CAMPAIGN_UNIT_IDS.KUMAVERSON,
    CAMPAIGN_UNIT_IDS.BABAYAGA,
    CAMPAIGN_UNIT_IDS.RAIDER,
  ];
  const qaHasExactlyAllKnownStages = explicitStageIds.length === CAMPAIGN_STAGES.length
    && CAMPAIGN_STAGES.every(({ id }) => explicitStageIds.includes(id));
  const qaHasExactlyCurrentRoster = explicitOwnership.length === knownUnitIds.length
    && knownUnitIds.every((unitId) => explicitOwnership.includes(unitId));
  const qaHasExactlyLegacyRoster = explicitOwnership.length === legacyQaAllUnitIds.length
    && legacyQaAllUnitIds.every((unitId) => explicitOwnership.includes(unitId));
  const repairQaAllUnlockLeak = completedStageIds.length === 0
    && (!Number.isFinite(sourceSchemaVersion) || sourceSchemaVersion < V090_LEVEL_ECONOMY_SCHEMA_VERSION)
    && !source.ownership
    && qaHasExactlyAllKnownStages
    && (qaHasExactlyCurrentRoster || qaHasExactlyLegacyRoster);
  const effectiveUnlocks = repairQaAllUnlockLeak
    ? deriveStageUnlocks(completedStageIds, [])
    : unlocks;
  const roster = deriveRoster({
    completedStageIds,
    explicitOwnership,
    explicitDiscovery,
    explicitRecruitable,
    sourceSchemaVersion,
    repairQaAllUnlockLeak,
  });
  const sourceProgression = Number.isFinite(sourceSchemaVersion)
    && sourceSchemaVersion >= V090_LEVEL_ECONOMY_SCHEMA_VERSION
    ? firstDefined(source, ["unitLevels", "unitRanks", "upgrades"], {})
    : firstDefined(source, ["unitRanks", "unitLevels", "upgrades"], {});
  const canonicalProgression = isRecord(sourceProgression)
    ? Object.fromEntries(Object.entries(sourceProgression).flatMap(([candidateId, value]) => {
      const canonicalId = normalizeCampaignUnitId(candidateId);
      if (!canonicalId) return [];
      const level = Number.isFinite(sourceSchemaVersion) && sourceSchemaVersion >= V090_LEVEL_ECONOMY_SCHEMA_VERSION
        ? value
        : legacyRankToLevel(value);
      return [[canonicalId, level]];
    }))
    : {};
  const unitLevels = normalizeUnitLevels(canonicalProgression, knownUnitIds);
  const unitRanks = Object.freeze(Object.fromEntries(
    knownUnitIds.map((unitId) => [unitId, unitLevels[unitId] - 1]),
  ));
  const legacyFormation = firstDefined(
    source,
    ["formationUnitIds", "formationKinds", "selectedUnitIds", "loadoutUnitIds"],
    [],
  );
  const equipmentInventory = normalizeEquipmentInventory(firstDefined(
    source,
    ["equipmentInventory", "equipment", "inventoryEquipment"],
    [],
  ));
  const equipmentEnhancementLevels = normalizeEquipmentEnhancementLevels(firstDefined(
    source,
    ["equipmentEnhancementLevels", "equipmentLevelsById", "equipmentUpgradeLevels"],
    {},
  ));
  const formationPresets = normalizeFormationPresets(
    firstDefined(source, ["formationPresets", "presets", "formations"], []),
    roster.ownership,
    legacyFormation,
    equipmentInventory,
  );
  const selectedFormationPresetId = normalizeFormationPresetId(firstDefined(
    source,
    ["selectedFormationPresetId", "selectedPresetId", "selectedFormationPreset", "selectedPreset"],
    CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_1,
  )) ?? CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_1;
  const sourceCaps = clampInteger(
    firstDefined(source, ["caps", "supplies", "supply", "currency"], 0),
    0,
    Number.MAX_SAFE_INTEGER,
    0,
  );
  const requiresEconomyMigration = (!Number.isFinite(sourceSchemaVersion)
      || sourceSchemaVersion < V090_LEVEL_ECONOMY_SCHEMA_VERSION)
    && !sourceProcessedMigrationIds.includes(V090_CAPS_MIGRATION_ID);
  const capsMigration = requiresEconomyMigration ? reorganizeLegacyCaps(sourceCaps) : null;
  const caps = capsMigration?.nextCaps ?? sourceCaps;
  const processedMigrationIds = capsMigration
    ? [...sourceProcessedMigrationIds, V090_CAPS_MIGRATION_ID]
    : sourceProcessedMigrationIds;
  const migrationNotices = capsMigration
    ? [
      ...sourceMigrationNotices.filter(({ id }) => id !== V090_CAPS_MIGRATION_ID),
      capsMigrationNotice(capsMigration),
    ]
    : sourceMigrationNotices;
  const migratesSchema = !Number.isFinite(sourceSchemaVersion)
    || sourceSchemaVersion < CAMPAIGN_SAVE_SCHEMA_VERSION;
  const sourceRevision = clampInteger(source.revision, 0, Number.MAX_SAFE_INTEGER, 0);
  const revision = migratesSchema
    ? Math.min(Number.MAX_SAFE_INTEGER, sourceRevision + 1)
    : sourceRevision;
  const sourceUpdatedAt = typeof source.updatedAt === "string" && Number.isFinite(Date.parse(source.updatedAt))
    ? new Date(source.updatedAt).toISOString()
    : "";
  const updatedAt = migratesSchema
    ? new Date((sourceUpdatedAt ? Date.parse(sourceUpdatedAt) : 0) + 1).toISOString()
    : sourceUpdatedAt;
  const survival = normalizeSurvivalProgress(firstDefined(
    source,
    ["survival", "survivalProgress"],
    null,
  ));
  const outbreaks = normalizeOutbreakProgress(firstDefined(
    source,
    ["outbreaks", "outbreakProgress"],
    null,
  ));
  const sourceRecords = firstDefined(source, ["records", "campaignRecords"], null);
  let records = normalizeCampaignRecords(sourceRecords);
  if (sourceSchemaVersion < CAMPAIGN_SAVE_SCHEMA_VERSION && !isRecord(sourceRecords)) {
    const legacyDefeatCountsByEnemy = { ...outbreaks.bossDefeatCounts };
    for (const stage of CAMPAIGN_STAGES) {
      const bossKind = stage.boss?.enemyKind;
      if (!bossKind || !completedStageIds.includes(stage.id)) continue;
      legacyDefeatCountsByEnemy[bossKind] = Math.min(
        Number.MAX_SAFE_INTEGER,
        (legacyDefeatCountsByEnemy[bossKind] ?? 0) + 1,
      );
    }
    const knownBossKills = Math.min(
      Number.MAX_SAFE_INTEGER,
      survival.totalBossKills
        + Object.values(legacyDefeatCountsByEnemy)
          .reduce((total, count) => total + Number(count || 0), 0),
    );
    records = normalizeCampaignRecords({
      ...records,
      defeatCountsByEnemy: legacyDefeatCountsByEnemy,
      totals: {
        ...records.totals,
        kills: survival.totalKills,
        bossKills: knownBossKills,
      },
    });
  }

  return {
    schemaVersion: CAMPAIGN_SAVE_SCHEMA_VERSION,
    revision,
    updatedAt,
    integrity: "",
    campaignStarted,
    storyScriptVersion: STORY_SCRIPT_VERSION,
    readStoryEventIds,
    autoSkipReadStory: typeof autoSkipCandidate === "boolean" ? autoSkipCandidate : false,
    processedResultIds,
    processedAcquisitionIds,
    processedUpgradeIds,
    processedEquipmentTransactionIds,
    processedMigrationIds,
    migrationNotices,
    eventFoundation,
    completedStageIds,
    bestStarsByStage,
    claimedStarRewardsByStage,
    caps,
    supplies: caps,
    equipmentInventory,
    equipmentEnhancementLevels,
    ...effectiveUnlocks,
    ...roster,
    unitLevels,
    unitRanks,
    unlockedUnitIds: [...roster.ownership],
    formationPresets,
    selectedFormationPresetId,
    selectedPresetId: selectedFormationPresetId,
    lastSelectedStageId,
    survival,
    outbreaks,
    records,
    settings: normalizeSettings(rawSettings, {
      recoverLegacySilence: !Number.isFinite(sourceSchemaVersion)
        || sourceSchemaVersion < 4,
    }),
  };
}

function normalizedTimestamp(value, fallback = "") {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return fallback;
  return new Date(value).toISOString();
}

export function reviseCampaignSave(
  save,
  {
    updatedAt = new Date().toISOString(),
    eventRegistry = EVENT_FOUNDATION_REGISTRY,
  } = {},
) {
  const current = migrateCampaignSave(save, { eventRegistry });
  return {
    ...current,
    revision: Math.min(Number.MAX_SAFE_INTEGER, current.revision + 1),
    updatedAt: normalizedTimestamp(updatedAt, new Date().toISOString()),
    integrity: "",
  };
}

export function campaignEventViews(
  save,
  {
    now = new Date().toISOString(),
    registry = EVENT_FOUNDATION_REGISTRY,
  } = {},
) {
  const current = migrateCampaignSave(save, { eventRegistry: registry });
  return registry.map((definition) => eventDisplayView(definition, {
    now,
    progress: current.eventFoundation,
    registry,
  }));
}

export function startCampaignEvent(save, eventId, input = {}) {
  const registry = input.registry ?? EVENT_FOUNDATION_REGISTRY;
  const current = migrateCampaignSave(save, { eventRegistry: registry });
  const result = startEventRun(current.eventFoundation, eventId, input);
  return {
    save: result.applied
      ? reviseCampaignSave(
        { ...current, eventFoundation: result.progress },
        { updatedAt: input.now, eventRegistry: registry },
      )
      : current,
    result,
  };
}

export function finishCampaignEvent(save, input = {}) {
  const registry = input.registry ?? EVENT_FOUNDATION_REGISTRY;
  const current = migrateCampaignSave(save, { eventRegistry: registry });
  const result = finishEventRun(current.eventFoundation, input);
  return {
    save: result.applied
      ? reviseCampaignSave(
        { ...current, eventFoundation: result.progress },
        { updatedAt: input.endedAt, eventRegistry: registry },
      )
      : current,
    result,
  };
}

export function activeCampaignEventBattleRequest(
  save,
  { registry = EVENT_FOUNDATION_REGISTRY } = {},
) {
  const current = migrateCampaignSave(save, { eventRegistry: registry });
  const activeRun = current.eventFoundation.activeRun;
  if (!activeRun) return null;
  return {
    engine: "standard-battle",
    eventId: activeRun.eventId,
    runId: activeRun.runId,
    occurrenceId: activeRun.occurrenceId,
    stageId: activeRun.stageId,
    difficultyId: activeRun.difficultyId,
  };
}

function campaignIntegrityPayload(save) {
  if (!isRecord(save)) throw new TypeError("Campaign integrity requires an object");
  const payload = { ...save };
  delete payload.integrity;
  return JSON.stringify(payload);
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function computeCampaignSaveIntegrity(
  save,
) {
  return `fnv1a32:${fnv1a32(campaignIntegrityPayload(save))}`;
}

export function withCampaignSaveIntegrity(
  save,
  { eventRegistry = EVENT_FOUNDATION_REGISTRY } = {},
) {
  const normalized = migrateCampaignSave(save, { eventRegistry });
  return {
    ...normalized,
    integrity: computeCampaignSaveIntegrity(normalized),
  };
}

export function checkpointSurvivalCampaignSave(
  save,
  run,
  {
    savedAt = new Date().toISOString(),
    eventRegistry = EVENT_FOUNDATION_REGISTRY,
  } = {},
) {
  const current = migrateCampaignSave(save, { eventRegistry });
  const survival = saveSurvivalCheckpoint(current.survival, run, savedAt);
  const currentCheckpointId = current.survival.activeCheckpoint?.checkpointId ?? null;
  const nextCheckpointId = survival.activeCheckpoint?.checkpointId ?? null;
  if (!nextCheckpointId || nextCheckpointId === currentCheckpointId) {
    return {
      save: withCampaignSaveIntegrity(current, { eventRegistry }),
      applied: false,
      checkpointId: nextCheckpointId,
    };
  }
  const revised = reviseCampaignSave(
    { ...current, survival },
    { updatedAt: savedAt, eventRegistry },
  );
  return {
    save: withCampaignSaveIntegrity(revised, { eventRegistry }),
    applied: true,
    checkpointId: nextCheckpointId,
  };
}

export function settleSurvivalCampaignSave(
  save,
  run,
  {
    endedAt = new Date().toISOString(),
    eventRegistry = EVENT_FOUNDATION_REGISTRY,
  } = {},
) {
  const current = migrateCampaignSave(save, { eventRegistry });
  const endedRun = normalizeSurvivalRun(run);
  const settlement = settleSurvivalRun(current.survival, run, { endedAt });
  if (settlement.duplicate) {
    return {
      save: withCampaignSaveIntegrity(current, { eventRegistry }),
      payout: settlement.payout,
      applied: false,
      duplicate: true,
    };
  }
  if (!settlement.progress.processedRunIds.includes(run?.runId)) {
    return {
      save: withCampaignSaveIntegrity(current, { eventRegistry }),
      payout: settlement.payout,
      applied: false,
      duplicate: false,
    };
  }
  const caps = Math.min(Number.MAX_SAFE_INTEGER, current.caps + settlement.payout.caps);
  const records = recordCampaignOperation(current.records, {
    resultId: endedRun.runId,
    operationId: `survival-wave-${endedRun.startWave}`,
    category: "survival",
    outcome: endedRun.endReason === SURVIVAL_END_REASONS.WITHDRAWAL ? "withdrawn" : "lost",
    battleSeconds: endedRun.stats.battleSeconds,
    kills: endedRun.stats.kills,
    bossKills: endedRun.stats.bossKills,
    reachedWave: endedRun.lastCompletedWave,
    capsEarned: settlement.payout.caps,
    encounteredEnemyKinds: endedRun.stats.encounteredEnemyKinds,
    enemyDefeatsByKind: endedRun.stats.enemyDefeatsByKind,
    unitStats: endedRun.stats,
    completedAt: endedAt,
  });
  const revised = reviseCampaignSave({
    ...current,
    caps,
    supplies: caps,
    equipmentInventory: addEquipmentInventory(
      current.equipmentInventory,
      settlement.payout.equipmentGrants,
    ),
    survival: settlement.progress,
    records,
  }, {
    updatedAt: endedAt,
    eventRegistry,
  });
  return {
    save: withCampaignSaveIntegrity(revised, { eventRegistry }),
    payout: settlement.payout,
    applied: true,
    duplicate: false,
  };
}

export async function persistSurvivalCampaignSettlement(
  save,
  run,
  {
    persist,
    endedAt = new Date().toISOString(),
    eventRegistry = EVENT_FOUNDATION_REGISTRY,
  } = {},
) {
  if (typeof persist !== "function") throw new TypeError("A campaign persistence function is required");
  const settlement = settleSurvivalCampaignSave(save, run, { endedAt, eventRegistry });
  if (!settlement.applied) {
    return {
      ...settlement,
      committed: settlement.duplicate,
      persistCalls: 0,
    };
  }
  try {
    const result = await persist(settlement.save);
    const durable = result === true || result?.durable === true;
    return {
      ...settlement,
      save: durable ? settlement.save : save,
      candidateSave: settlement.save,
      committed: durable,
      persistCalls: 1,
    };
  } catch (error) {
    return {
      ...settlement,
      save,
      candidateSave: settlement.save,
      committed: false,
      persistCalls: 1,
      error,
    };
  }
}

export function settleOutbreakCampaignSave(
  save,
  result,
  {
    completedAt = result?.completedAt ?? new Date().toISOString(),
    eventRegistry = EVENT_FOUNDATION_REGISTRY,
  } = {},
) {
  const current = migrateCampaignSave(save, { eventRegistry });
  if (!isOutbreakMissionUnlocked(
    current.outbreaks,
    current.completedStageIds,
    result?.missionId,
  )) {
    return {
      save: withCampaignSaveIntegrity(current, { eventRegistry }),
      payout: { caps: 0, equipmentGrants: [] },
      applied: false,
      duplicate: false,
      reason: "mission-locked",
    };
  }
  const settlement = resolveOutbreakProgress(current.outbreaks, {
    ...result,
    completedAt,
  });
  const resultId = typeof result?.resultId === "string" ? result.resultId.trim() : "";
  if (settlement.duplicate || current.processedResultIds.includes(resultId)) {
    return {
      save: withCampaignSaveIntegrity(current, { eventRegistry }),
      payout: { caps: 0, equipmentGrants: [] },
      applied: false,
      duplicate: true,
    };
  }
  const caps = Math.min(Number.MAX_SAFE_INTEGER, current.caps + settlement.reward.caps);
  const missionBossKind = settlement.progress.lastResult?.bossKind ?? "";
  const records = recordCampaignOperation(current.records, {
    resultId,
    operationId: result?.missionId,
    category: "outbreak",
    won: result?.won === true,
    battleSeconds: result?.stats?.battleSeconds,
    kills: result?.stats?.kills,
    unitsLost: result?.stats?.unitsLost,
    bossKills: result?.won === true ? 1 : 0,
    capsEarned: settlement.reward.caps,
    encounteredEnemyKinds: [
      ...(Array.isArray(result?.encounteredEnemyKinds) ? result.encounteredEnemyKinds : []),
      ...(missionBossKind ? [missionBossKind] : []),
    ],
    enemyDefeatsByKind: {
      ...(isRecord(result?.enemyDefeatsByKind) ? result.enemyDefeatsByKind : {}),
      ...(result?.won === true && missionBossKind
        ? { [missionBossKind]: Math.max(1, Number(result?.enemyDefeatsByKind?.[missionBossKind]) || 0) }
        : {}),
    },
    unitStats: result?.unitStats,
    completedAt,
  });
  const revised = reviseCampaignSave({
    ...current,
    processedResultIds: [...new Set([...current.processedResultIds, resultId])],
    caps,
    supplies: caps,
    equipmentInventory: addEquipmentInventory(
      current.equipmentInventory,
      settlement.reward.equipmentGrants,
    ),
    outbreaks: settlement.progress,
    records,
  }, {
    updatedAt: completedAt,
    eventRegistry,
  });
  return {
    save: withCampaignSaveIntegrity(revised, { eventRegistry }),
    payout: settlement.reward,
    applied: true,
    duplicate: false,
  };
}

export async function persistOutbreakCampaignSettlement(
  save,
  result,
  {
    persist,
    completedAt = result?.completedAt ?? new Date().toISOString(),
    eventRegistry = EVENT_FOUNDATION_REGISTRY,
  } = {},
) {
  if (typeof persist !== "function") throw new TypeError("A campaign persistence function is required");
  const settlement = settleOutbreakCampaignSave(save, result, {
    completedAt,
    eventRegistry,
  });
  if (!settlement.applied) {
    return {
      ...settlement,
      committed: settlement.duplicate,
      persistCalls: 0,
    };
  }
  try {
    const persisted = await persist(settlement.save);
    const durable = persisted === true || persisted?.durable === true;
    return {
      ...settlement,
      save: durable ? settlement.save : save,
      candidateSave: settlement.save,
      committed: durable,
      persistCalls: 1,
    };
  } catch (error) {
    return {
      ...settlement,
      save,
      candidateSave: settlement.save,
      committed: false,
      persistCalls: 1,
      error,
    };
  }
}

export function verifyCampaignSaveIntegrity(rawSave) {
  let source = rawSave;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return false;
    }
  }
  if (!isRecord(source) || typeof source.integrity !== "string" || source.integrity.length === 0) return false;
  return source.integrity === computeCampaignSaveIntegrity(source);
}

function hasTypedCampaignField(source, keys, predicate) {
  return keys.some((key) => (
    Object.prototype.hasOwnProperty.call(source, key)
    && predicate(source[key])
  ));
}

/**
 * Durable storage/import boundaries must not pass arbitrary JSON through the
 * intentionally forgiving migration function. Persisted older-schema saves
 * contained this complete campaign fingerprint; schema-less/v0 saves used the
 * same groups under aliases. A partial or foreign object is recovery material,
 * not a fresh campaign that may be replicated over another store.
 */
function isRecognizedLegacyCampaignSave(source, sourceSchemaVersion) {
  const hasCompletedStages = hasTypedCampaignField(
    source,
    ["completedStageIds", "completedStages", "clearedStages"],
    Array.isArray,
  );
  const hasBestStars = hasTypedCampaignField(
    source,
    ["bestStarsByStage", "stageStars", "bestStars"],
    isRecord,
  );
  const hasClaimedRewards = hasTypedCampaignField(
    source,
    ["claimedStarRewardsByStage", "claimedStarMilestones", "claimedStarRewards"],
    isRecord,
  );
  const hasEconomy = hasTypedCampaignField(
    source,
    ["caps", "supplies", "supply", "currency"],
    (value) => typeof value === "number" && Number.isFinite(value),
  );
  const hasUnlockedStages = hasTypedCampaignField(
    source,
    ["unlockedStageIds", "unlockedStages"],
    Array.isArray,
  );
  const hasRoster = hasTypedCampaignField(
    source,
    ["ownership", "ownedUnitIds", "unlockedUnitIds", "unlockedUnits"],
    Array.isArray,
  );
  const hasLastStage = hasTypedCampaignField(
    source,
    ["lastSelectedStageId", "lastSelectedStage", "lastStageId"],
    (value) => typeof value === "string",
  );
  const hasSettings = hasTypedCampaignField(
    source,
    ["settings", "options"],
    isRecord,
  );
  const hasCoreFingerprint = hasCompletedStages
    && hasBestStars
    && hasClaimedRewards
    && hasEconomy
    && hasUnlockedStages
    && hasRoster
    && hasLastStage
    && hasSettings;

  if (!hasCoreFingerprint) return false;
  if (sourceSchemaVersion === 0) {
    return !Object.prototype.hasOwnProperty.call(source, "version")
      || source.version === 0;
  }
  if (sourceSchemaVersion === 1) return true;
  return typeof source.campaignStarted === "boolean"
    && Array.isArray(source.processedResultIds);
}

export function inspectCampaignSaveCandidate(raw, { source = "unknown" } = {}) {
  const rawText = typeof raw === "string"
    ? raw
    : raw == null
      ? ""
      : JSON.stringify(raw);
  if (raw == null || (typeof raw === "string" && raw.trim().length === 0)) {
    return {
      status: "missing",
      source,
      raw: rawText,
      save: null,
      revision: 0,
      updatedAt: "",
      reason: "missing",
      sourceSchemaVersion: null,
    };
  }

  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        status: "corrupt",
        source,
        raw: rawText,
        save: null,
        revision: 0,
        updatedAt: "",
        reason: "invalid-json",
        sourceSchemaVersion: null,
      };
    }
  }
  if (!isRecord(parsed)) {
    return {
      status: "corrupt",
      source,
      raw: rawText,
      save: null,
      revision: 0,
      updatedAt: "",
      reason: "invalid-shape",
      sourceSchemaVersion: null,
    };
  }

  const hasSchemaVersion = Object.prototype.hasOwnProperty.call(parsed, "schemaVersion");
  if (hasSchemaVersion && (
    typeof parsed.schemaVersion !== "number"
    || !Number.isInteger(parsed.schemaVersion)
    || parsed.schemaVersion < 0
  )) {
    return {
      status: "corrupt",
      source,
      raw: rawText,
      save: null,
      revision: 0,
      updatedAt: "",
      reason: "invalid-schema",
      sourceSchemaVersion: null,
    };
  }
  const sourceSchemaVersion = hasSchemaVersion ? parsed.schemaVersion : 0;
  if (sourceSchemaVersion > CAMPAIGN_SAVE_SCHEMA_VERSION) {
    return {
      status: "corrupt",
      source,
      raw: rawText,
      save: null,
      revision: 0,
      updatedAt: "",
      reason: "unsupported-schema",
      sourceSchemaVersion,
    };
  }
  if (sourceSchemaVersion < CAMPAIGN_SAVE_SCHEMA_VERSION
    && !isRecognizedLegacyCampaignSave(parsed, sourceSchemaVersion)) {
    return {
      status: "corrupt",
      source,
      raw: rawText,
      save: null,
      revision: 0,
      updatedAt: "",
      reason: "unrecognized-legacy-shape",
      sourceSchemaVersion,
    };
  }
  if (sourceSchemaVersion >= CAMPAIGN_INTEGRITY_REQUIRED_FROM_SCHEMA_VERSION
    && !verifyCampaignSaveIntegrity(parsed)) {
    return {
      status: "corrupt",
      source,
      raw: rawText,
      save: null,
      revision: clampInteger(parsed.revision, 0, Number.MAX_SAFE_INTEGER, 0),
      updatedAt: normalizedTimestamp(parsed.updatedAt),
      reason: typeof parsed.integrity === "string" && parsed.integrity.length > 0
        ? "integrity-mismatch"
        : "missing-integrity",
      sourceSchemaVersion,
    };
  }

  let save;
  try {
    save = migrateCampaignSave(parsed);
  } catch {
    return {
      status: "corrupt",
      source,
      raw: rawText,
      save: null,
      revision: clampInteger(parsed.revision, 0, Number.MAX_SAFE_INTEGER, 0),
      updatedAt: normalizedTimestamp(parsed.updatedAt),
      reason: "migration-failed",
      sourceSchemaVersion,
    };
  }
  return {
    status: "valid",
    source,
    raw: rawText,
    save,
    revision: save.revision,
    updatedAt: save.updatedAt,
    reason: sourceSchemaVersion < CAMPAIGN_SAVE_SCHEMA_VERSION ? "migrated" : "verified",
    sourceSchemaVersion,
  };
}

export function serializeCampaignSave(
  save,
  { eventRegistry = EVENT_FOUNDATION_REGISTRY } = {},
) {
  try {
    return JSON.stringify(withCampaignSaveIntegrity(save, { eventRegistry }));
  } catch {
    return JSON.stringify(withCampaignSaveIntegrity(createDefaultCampaignSave()));
  }
}

export function deserializeCampaignSave(
  serialized,
  { eventRegistry = EVENT_FOUNDATION_REGISTRY } = {},
) {
  if (typeof serialized !== "string") return migrateCampaignSave(serialized, { eventRegistry });
  try {
    const parsed = JSON.parse(serialized);
    if (isRecord(parsed)
      && Number(parsed.schemaVersion) >= CAMPAIGN_INTEGRITY_REQUIRED_FROM_SCHEMA_VERSION
      && typeof parsed.integrity === "string"
      && parsed.integrity.length > 0
      && !verifyCampaignSaveIntegrity(parsed, { eventRegistry })) {
      return createDefaultCampaignSave();
    }
    return migrateCampaignSave(parsed, { eventRegistry });
  } catch {
    return createDefaultCampaignSave();
  }
}

export function isUnitOwned(save, unitId) {
  const canonicalId = normalizeCampaignUnitId(unitId);
  return Boolean(canonicalId && migrateCampaignSave(save).ownership.includes(canonicalId));
}

export function isUnitDiscovered(save, unitId) {
  const canonicalId = normalizeCampaignUnitId(unitId);
  return Boolean(canonicalId && migrateCampaignSave(save).discovery.includes(canonicalId));
}

export function isUnitRecruitable(save, unitId) {
  const canonicalId = normalizeCampaignUnitId(unitId);
  return Boolean(canonicalId && migrateCampaignSave(save).recruitable.includes(canonicalId));
}

export function formationUnitIdsToCombatKinds(unitIds) {
  if (!Array.isArray(unitIds)) return [];
  return unitIds
    .map((unitId) => campaignUnitIdToCombatKind(unitId))
    .filter((combatKind) => typeof combatKind === "string");
}

export function getSelectedFormationUnitIds(save) {
  const current = migrateCampaignSave(save);
  const selected = current.formationPresets.find(({ id }) => id === current.selectedFormationPresetId);
  return [...(selected?.unitIds ?? [])];
}

export function getSelectedFormationCombatKinds(save) {
  return formationUnitIdsToCombatKinds(getSelectedFormationUnitIds(save));
}

function requireFormationPresetId(value) {
  const presetId = normalizeFormationPresetId(value);
  if (!presetId) throw new RangeError(`Unknown formation preset: ${String(value)}`);
  return presetId;
}

export function selectFormationPreset(save, presetId) {
  const current = migrateCampaignSave(save);
  const selectedFormationPresetId = requireFormationPresetId(presetId);
  if (current.selectedFormationPresetId === selectedFormationPresetId) return current;
  return reviseCampaignSave({
    ...current,
    selectedFormationPresetId,
    selectedPresetId: selectedFormationPresetId,
  });
}

export function setFormationPresetUnits(save, presetId, unitIds) {
  const current = migrateCampaignSave(save);
  const normalizedPresetId = requireFormationPresetId(presetId);
  if (!Array.isArray(unitIds)) throw new TypeError("Formation unitIds must be an array");
  if (unitIds.length < 1 || unitIds.length > CAMPAIGN_FORMATION_MAX_SLOTS) {
    throw new RangeError(`Formation must contain 1-${CAMPAIGN_FORMATION_MAX_SLOTS} units`);
  }
  const canonicalUnitIds = unitIds.map((unitId) => {
    const canonicalId = normalizeCampaignUnitId(unitId);
    if (!canonicalId) throw new RangeError(`Unknown campaign unit: ${String(unitId)}`);
    return canonicalId;
  });
  if (new Set(canonicalUnitIds).size !== canonicalUnitIds.length) {
    throw new RangeError("Formation cannot contain duplicate unit cards");
  }
  const unavailable = canonicalUnitIds.find((unitId) => !current.ownership.includes(unitId));
  if (unavailable) throw new RangeError(`Formation unit is not owned: ${unavailable}`);

  const formationPresets = current.formationPresets.map((preset) => (
    preset.id === normalizedPresetId ? { ...preset, unitIds: canonicalUnitIds } : preset
  ));
  const existing = current.formationPresets.find(({ id }) => id === normalizedPresetId)?.unitIds ?? [];
  if (existing.length === canonicalUnitIds.length
    && existing.every((unitId, index) => unitId === canonicalUnitIds[index])) return current;
  return reviseCampaignSave({ ...current, formationPresets });
}

export function getFormationPresetEquipmentSnapshot(save, presetId = null) {
  const current = migrateCampaignSave(save);
  const normalizedPresetId = presetId === null
    ? current.selectedFormationPresetId
    : requireFormationPresetId(presetId);
  const preset = current.formationPresets.find(({ id }) => id === normalizedPresetId);
  if (!preset) throw new RangeError(`Unknown formation preset: ${String(normalizedPresetId)}`);
  return deepFreeze({
    presetId: preset.id,
    unitIds: [...preset.unitIds],
    unitLevelsByUnit: Object.fromEntries(preset.unitIds.map((unitId) => [
      unitId,
      current.unitLevels[unitId] ?? 1,
    ])),
    personalEquipmentByUnit: Object.fromEntries(Object.entries(preset.personalEquipmentByUnit)
      .map(([unitId, equipmentIds]) => [unitId, [...equipmentIds]])),
    tacticalEquipmentIds: [...preset.tacticalEquipmentIds],
    equipmentEnhancementLevels: { ...current.equipmentEnhancementLevels },
  });
}

function equipmentTransactionInput(equipmentIdOrInput, maybeInput) {
  if (isRecord(equipmentIdOrInput)) return equipmentIdOrInput;
  return {
    ...(isRecord(maybeInput) ? maybeInput : {}),
    equipmentId: equipmentIdOrInput,
  };
}

function equipmentTransactionId(input) {
  return typeof input.transactionId === "string"
    ? input.transactionId.trim()
    : typeof input.receiptId === "string"
      ? input.receiptId.trim()
      : "";
}

export function purchaseCampaignEquipment(save, equipmentIdOrInput, maybeInput) {
  const input = equipmentTransactionInput(equipmentIdOrInput, maybeInput);
  const equipmentId = typeof input.equipmentId === "string" ? input.equipmentId.trim() : "";
  const transactionId = equipmentTransactionId(input);
  if (!transactionId) throw new TypeError("A non-empty equipment transactionId is required");
  const current = migrateCampaignSave(save);
  const entry = equipmentDefinition(equipmentId);
  const costCaps = entry?.source === EQUIPMENT_SOURCES.SUPPLY_SHOP
    ? Number(entry.purchaseCaps)
    : 0;
  const baseResult = {
    transactionId,
    equipmentId,
    costCaps,
    spentCaps: 0,
    quantityAfter: campaignEquipmentQuantity(current, equipmentId),
    applied: false,
    alreadyProcessed: false,
    reason: "",
  };
  if (current.processedEquipmentTransactionIds.includes(transactionId)) {
    return {
      save: current,
      result: { ...baseResult, alreadyProcessed: true, reason: "already-processed" },
    };
  }
  if (!entry) return { save: current, result: { ...baseResult, reason: "unknown-equipment" } };
  if (entry.source !== EQUIPMENT_SOURCES.SUPPLY_SHOP || !Number.isFinite(entry.purchaseCaps)) {
    return { save: current, result: { ...baseResult, reason: "not-purchasable" } };
  }
  if (current.caps < costCaps) {
    return { save: current, result: { ...baseResult, reason: "insufficient-caps" } };
  }
  const caps = current.caps - costCaps;
  const equipmentInventory = addEquipmentInventory(current.equipmentInventory, [
    { equipmentId, quantity: 1 },
  ]);
  return {
    save: reviseCampaignSave({
      ...current,
      processedEquipmentTransactionIds: [
        ...current.processedEquipmentTransactionIds,
        transactionId,
      ],
      caps,
      supplies: caps,
      equipmentInventory,
    }),
    result: {
      ...baseResult,
      spentCaps: costCaps,
      quantityAfter: campaignEquipmentQuantity({ ...current, equipmentInventory }, equipmentId),
      applied: true,
      reason: "applied",
    },
  };
}

export function enhanceCampaignEquipment(save, equipmentIdOrInput, maybeInput) {
  const input = equipmentTransactionInput(equipmentIdOrInput, maybeInput);
  const equipmentId = typeof input.equipmentId === "string" ? input.equipmentId.trim() : "";
  const transactionId = equipmentTransactionId(input);
  if (!transactionId) throw new TypeError("A non-empty equipment transactionId is required");
  const current = migrateCampaignSave(save);
  const entry = equipmentDefinition(equipmentId);
  const currentLevel = equipmentEnhancementLevel(current.equipmentEnhancementLevels, equipmentId);
  const costCaps = equipmentEnhancementCost(equipmentId, currentLevel) ?? 0;
  const baseResult = {
    transactionId,
    equipmentId,
    currentLevel,
    nextLevel: currentLevel >= EQUIPMENT_MAX_ENHANCEMENT ? null : currentLevel + 1,
    costCaps,
    spentCaps: 0,
    applied: false,
    alreadyProcessed: false,
    reason: "",
  };
  if (current.processedEquipmentTransactionIds.includes(transactionId)) {
    return {
      save: current,
      result: { ...baseResult, alreadyProcessed: true, reason: "already-processed" },
    };
  }
  if (!entry) return { save: current, result: { ...baseResult, reason: "unknown-equipment" } };
  if (campaignEquipmentQuantity(current, equipmentId) < 1) {
    return { save: current, result: { ...baseResult, reason: "not-owned" } };
  }
  if (baseResult.nextLevel === null) {
    return { save: current, result: { ...baseResult, reason: "max-enhancement" } };
  }
  if (current.caps < costCaps) {
    return { save: current, result: { ...baseResult, reason: "insufficient-caps" } };
  }
  const caps = current.caps - costCaps;
  return {
    save: reviseCampaignSave({
      ...current,
      processedEquipmentTransactionIds: [
        ...current.processedEquipmentTransactionIds,
        transactionId,
      ],
      caps,
      supplies: caps,
      equipmentEnhancementLevels: {
        ...current.equipmentEnhancementLevels,
        [equipmentId]: baseResult.nextLevel,
      },
    }),
    result: {
      ...baseResult,
      spentCaps: costCaps,
      applied: true,
      reason: "applied",
    },
  };
}

function setFormationEquipmentSlot(save, {
  presetId,
  unitId = null,
  slotIndex,
  equipmentId = null,
  slotType,
}) {
  const current = migrateCampaignSave(save);
  const normalizedPresetId = requireFormationPresetId(presetId);
  const maximumSlots = slotType === EQUIPMENT_SLOT_TYPES.PERSONAL
    ? PERSONAL_EQUIPMENT_SLOTS
    : TACTICAL_EQUIPMENT_SLOTS;
  const normalizedSlotIndex = Number(slotIndex);
  if (!Number.isInteger(normalizedSlotIndex)
    || normalizedSlotIndex < 0
    || normalizedSlotIndex >= maximumSlots) {
    throw new RangeError(`Equipment slot index must be 0-${maximumSlots - 1}`);
  }
  const preset = current.formationPresets.find(({ id }) => id === normalizedPresetId);
  if (!preset) throw new RangeError(`Unknown formation preset: ${String(presetId)}`);
  const canonicalEquipmentId = equipmentId === null || equipmentId === ""
    ? null
    : typeof equipmentId === "string" ? equipmentId.trim() : "";
  if (canonicalEquipmentId) {
    const entry = equipmentDefinition(canonicalEquipmentId);
    if (!entry) throw new RangeError(`Unknown equipment: ${String(equipmentId)}`);
    if (entry.slotType !== slotType) {
      throw new RangeError(`Equipment cannot be assigned to ${slotType}: ${canonicalEquipmentId}`);
    }
    const personalOccurrences = Object.entries(preset.personalEquipmentByUnit)
      .flatMap(([candidateUnitId, equipmentIds]) => equipmentIds.map((candidateEquipmentId, candidateSlotIndex) => ({
        unitId: candidateUnitId,
        slotIndex: candidateSlotIndex,
        equipmentId: candidateEquipmentId,
        slotType: EQUIPMENT_SLOT_TYPES.PERSONAL,
      })));
    const tacticalOccurrences = preset.tacticalEquipmentIds.map((candidateEquipmentId, candidateSlotIndex) => ({
      unitId: null,
      slotIndex: candidateSlotIndex,
      equipmentId: candidateEquipmentId,
      slotType: EQUIPMENT_SLOT_TYPES.TACTICAL,
    }));
    const occupiedElsewhere = [...personalOccurrences, ...tacticalOccurrences].filter((occurrence) => (
      occurrence.equipmentId === canonicalEquipmentId
      && !(occurrence.slotType === slotType
        && occurrence.slotIndex === normalizedSlotIndex
        && (slotType !== EQUIPMENT_SLOT_TYPES.PERSONAL
          || occurrence.unitId === normalizeCampaignUnitId(unitId)))
    ));
    if (slotType === EQUIPMENT_SLOT_TYPES.TACTICAL
      && occupiedElsewhere.some((occurrence) => occurrence.slotType === slotType)) {
      throw new RangeError(`Tactical equipment cannot stack with itself: ${canonicalEquipmentId}`);
    }
    if (slotType === EQUIPMENT_SLOT_TYPES.PERSONAL
      && occupiedElsewhere.some((occurrence) => (
        occurrence.slotType === slotType
        && occurrence.unitId === normalizeCampaignUnitId(unitId)
      ))) {
      throw new RangeError(`A unit cannot equip duplicate equipment: ${canonicalEquipmentId}`);
    }
    if (occupiedElsewhere.length >= campaignEquipmentQuantity(current, canonicalEquipmentId)) {
      throw new RangeError(`Equipment quantity is already allocated in preset: ${canonicalEquipmentId}`);
    }
  }
  let nextPreset;
  if (slotType === EQUIPMENT_SLOT_TYPES.PERSONAL) {
    const canonicalUnitId = normalizeCampaignUnitId(unitId);
    if (!canonicalUnitId || !preset.unitIds.includes(canonicalUnitId)) {
      throw new RangeError(`Unit is not deployed in formation preset: ${String(unitId)}`);
    }
    const slots = [...(preset.personalEquipmentByUnit[canonicalUnitId]
      ?? Array.from({ length: PERSONAL_EQUIPMENT_SLOTS }, () => null))];
    slots[normalizedSlotIndex] = canonicalEquipmentId;
    nextPreset = {
      ...preset,
      personalEquipmentByUnit: {
        ...preset.personalEquipmentByUnit,
        [canonicalUnitId]: slots,
      },
    };
  } else {
    const slots = [...preset.tacticalEquipmentIds];
    slots[normalizedSlotIndex] = canonicalEquipmentId;
    nextPreset = { ...preset, tacticalEquipmentIds: slots };
  }
  const normalizedPreset = normalizeFormationPresets(
    [nextPreset],
    current.ownership,
    [],
    current.equipmentInventory,
  ).find(({ id }) => id === normalizedPresetId);
  const requestedStillAssigned = canonicalEquipmentId === null
    || (slotType === EQUIPMENT_SLOT_TYPES.PERSONAL
      ? normalizedPreset?.personalEquipmentByUnit[normalizeCampaignUnitId(unitId)]?.[normalizedSlotIndex]
      : normalizedPreset?.tacticalEquipmentIds[normalizedSlotIndex]) === canonicalEquipmentId;
  if (!requestedStillAssigned) {
    throw new RangeError(`Equipment quantity is already allocated in preset: ${canonicalEquipmentId}`);
  }
  const formationPresets = current.formationPresets.map((candidate) => (
    candidate.id === normalizedPresetId ? normalizedPreset : candidate
  ));
  if (JSON.stringify(current.formationPresets) === JSON.stringify(formationPresets)) return current;
  return reviseCampaignSave({ ...current, formationPresets });
}

export function setFormationPersonalEquipmentSlot(save, input) {
  if (!isRecord(input)) throw new TypeError("Personal equipment assignment is required");
  return setFormationEquipmentSlot(save, {
    ...input,
    slotType: EQUIPMENT_SLOT_TYPES.PERSONAL,
  });
}

export function setFormationTacticalEquipmentSlot(save, input) {
  if (!isRecord(input)) throw new TypeError("Tactical equipment assignment is required");
  return setFormationEquipmentSlot(save, {
    ...input,
    slotType: EQUIPMENT_SLOT_TYPES.TACTICAL,
  });
}

function normalizeAcquisitionInput(unitIdOrInput, maybeInput) {
  if (isRecord(unitIdOrInput)) return unitIdOrInput;
  return {
    ...(isRecord(maybeInput) ? maybeInput : {}),
    unitId: unitIdOrInput,
  };
}

/**
 * Applies either a caps purchase or a free story join exactly once. Ownership
 * itself is also a guard, so a different receipt cannot charge for the same
 * person twice.
 */
export function resolveCampaignUnitAcquisition(save, unitIdOrInput, maybeInput) {
  const input = normalizeAcquisitionInput(unitIdOrInput, maybeInput);
  const unitId = normalizeCampaignUnitId(input.unitId);
  if (!unitId) throw new RangeError(`Unknown campaign unit: ${String(input.unitId)}`);
  const acquisitionId = typeof input.acquisitionId === "string"
    ? input.acquisitionId.trim()
    : typeof input.receiptId === "string"
      ? input.receiptId.trim()
      : "";
  if (!acquisitionId) throw new TypeError("A non-empty acquisitionId is required");
  const mode = input.mode === "story" ? "story" : "recruitment";
  const current = migrateCampaignSave(save);
  const costCaps = mode === "story" ? 0 : CAMPAIGN_RECRUITMENT_COSTS[unitId] ?? 0;

  const baseResult = {
    acquisitionId,
    unitId,
    mode,
    costCaps,
    spentCaps: 0,
    applied: false,
    alreadyProcessed: false,
    alreadyOwned: current.ownership.includes(unitId),
    reason: "",
  };
  if (current.processedAcquisitionIds.includes(acquisitionId)) {
    return {
      save: current,
      result: { ...baseResult, alreadyProcessed: true, reason: "already-processed" },
    };
  }
  if (baseResult.alreadyOwned) {
    return { save: current, result: { ...baseResult, reason: "already-owned" } };
  }
  if (mode === "recruitment" && !current.recruitable.includes(unitId)) {
    return { save: current, result: { ...baseResult, reason: "not-recruitable" } };
  }
  if (mode === "recruitment" && current.caps < costCaps) {
    return { save: current, result: { ...baseResult, reason: "insufficient-caps" } };
  }

  const ownership = orderCampaignUnitIds([...current.ownership, unitId]);
  const discovery = orderCampaignUnitIds([...current.discovery, unitId]);
  const recruitable = current.recruitable.filter((candidate) => candidate !== unitId);
  const caps = current.caps - costCaps;
  const nextSave = reviseCampaignSave({
    ...current,
    processedAcquisitionIds: [...current.processedAcquisitionIds, acquisitionId],
    caps,
    supplies: caps,
    ownership,
    discovery,
    recruitable,
    unlockedUnitIds: [...ownership],
  });
  return {
    save: nextSave,
    result: {
      ...baseResult,
      spentCaps: costCaps,
      applied: true,
      alreadyOwned: false,
      reason: "applied",
    },
  };
}

export function recruitCampaignUnit(save, unitIdOrInput, maybeInput) {
  const input = normalizeAcquisitionInput(unitIdOrInput, maybeInput);
  return resolveCampaignUnitAcquisition(save, { ...input, mode: "recruitment" });
}

export const purchaseCampaignUnit = recruitCampaignUnit;

export function grantStoryCampaignUnit(save, unitIdOrInput, maybeInput) {
  const input = normalizeAcquisitionInput(unitIdOrInput, maybeInput);
  return resolveCampaignUnitAcquisition(save, { ...input, mode: "story" });
}

export function getCampaignUnitRank(save, unitId) {
  return getCampaignUnitLevel(save, unitId) - 1;
}

export function getCampaignUnitLevel(save, unitId) {
  const canonicalId = normalizeCampaignUnitId(unitId);
  if (!canonicalId) throw new RangeError(`Unknown campaign unit: ${String(unitId)}`);
  return unitLevelFor(migrateCampaignSave(save).unitLevels, canonicalId);
}

export function getCampaignLevelCap(save) {
  const current = migrateCampaignSave(save);
  const highestStage = current.completedStageIds.reduce(
    (highest, stageId) => Math.max(highest, stageNumberForId(stageId) ?? 0),
    0,
  );
  return unitLevelCapForHighestStage(highestStage);
}

export function campaignUnitLevelUpgradeQuote(save, unitId) {
  const canonicalId = normalizeCampaignUnitId(unitId);
  if (!canonicalId) throw new RangeError(`Unknown campaign unit: ${String(unitId)}`);
  const current = migrateCampaignSave(save);
  return unitLevelUpgradeQuote({
    unitId: canonicalId,
    levels: current.unitLevels,
    ownedUnitIds: current.ownership,
    completedStageCount: current.completedStageIds.length,
    levelCap: getCampaignLevelCap(current),
  });
}

export function campaignUnitUpgradeQuote(save, unitId) {
  const quote = campaignUnitLevelUpgradeQuote(save, unitId);
  return Object.freeze({
    currentRank: quote.currentLevel - 1,
    nextRank: quote.nextLevel === null ? null : quote.nextLevel - 1,
    currentLevel: quote.currentLevel,
    nextLevel: quote.nextLevel,
    levelCap: quote.levelCap,
    baseCostCaps: quote.baseCostCaps,
    discountCaps: quote.discountCaps,
    costCaps: quote.costCaps,
    catchUp: quote.catchUp,
    reason: quote.reason,
  });
}

/**
 * Pays for exactly one Level on one stable campaign-unit ID. A Level-specific
 * receipt makes touch retries idempotent without blocking a later upgrade.
 */
export function upgradeCampaignUnit(save, unitIdOrInput, maybeInput) {
  const input = normalizeAcquisitionInput(unitIdOrInput, maybeInput);
  const unitId = normalizeCampaignUnitId(input.unitId);
  if (!unitId) throw new RangeError(`Unknown campaign unit: ${String(input.unitId)}`);
  const upgradeId = typeof input.upgradeId === "string"
    ? input.upgradeId.trim()
    : typeof input.receiptId === "string"
      ? input.receiptId.trim()
      : "";
  if (!upgradeId) throw new TypeError("A non-empty upgradeId is required");

  const current = migrateCampaignSave(save);
  const quote = unitLevelUpgradeQuote({
    unitId,
    levels: current.unitLevels,
    ownedUnitIds: current.ownership,
    completedStageCount: current.completedStageIds.length,
    levelCap: getCampaignLevelCap(current),
  });
  const baseResult = {
    upgradeId,
    unitId,
    currentLevel: quote.currentLevel,
    nextLevel: quote.nextLevel,
    levelCap: quote.levelCap,
    currentRank: quote.currentLevel - 1,
    nextRank: quote.nextLevel === null ? null : quote.nextLevel - 1,
    costCaps: quote.costCaps,
    baseCostCaps: quote.baseCostCaps,
    discountCaps: quote.discountCaps,
    catchUp: quote.catchUp,
    spentCaps: 0,
    applied: false,
    alreadyProcessed: false,
    reason: "",
  };
  if (current.processedUpgradeIds.includes(upgradeId)) {
    return {
      save: current,
      result: { ...baseResult, alreadyProcessed: true, reason: "already-processed" },
    };
  }
  if (!current.ownership.includes(unitId)) {
    return { save: current, result: { ...baseResult, reason: "not-owned" } };
  }
  if (quote.nextLevel === null) {
    return { save: current, result: { ...baseResult, reason: quote.reason } };
  }
  if (current.caps < quote.costCaps) {
    return { save: current, result: { ...baseResult, reason: "insufficient-caps" } };
  }

  const caps = current.caps - quote.costCaps;
  const nextSave = reviseCampaignSave({
    ...current,
    processedUpgradeIds: [...current.processedUpgradeIds, upgradeId],
    caps,
    supplies: caps,
    unitLevels: {
      ...current.unitLevels,
      [unitId]: quote.nextLevel,
    },
    unitRanks: {
      ...current.unitRanks,
      [unitId]: quote.nextLevel - 1,
    },
  });
  return {
    save: nextSave,
    result: {
      ...baseResult,
      spentCaps: quote.costCaps,
      applied: true,
      reason: "applied",
    },
  };
}

export function markStoryEventRead(save, eventId) {
  const current = migrateCampaignSave(save);
  const normalizedEventId = typeof eventId === "string" ? eventId.trim() : "";
  if (!normalizedEventId || current.readStoryEventIds.includes(normalizedEventId)) return current;
  return reviseCampaignSave({
    ...current,
    readStoryEventIds: [...current.readStoryEventIds, normalizedEventId],
  });
}

export function updateStoryPlaybackSettings(save, changes = {}) {
  const current = migrateCampaignSave(save);
  if (!isRecord(changes)) return current;
  const autoSkipReadStory = typeof changes.autoSkipReadStory === "boolean"
    ? changes.autoSkipReadStory
    : current.autoSkipReadStory;
  const battleEventMode = ["first-time", "compact", "all"].includes(changes.battleEventMode)
    ? changes.battleEventMode
    : current.settings.battleEventMode;
  if (autoSkipReadStory === current.autoSkipReadStory
    && battleEventMode === current.settings.battleEventMode) return current;
  return reviseCampaignSave({
    ...current,
    autoSkipReadStory,
    settings: { ...current.settings, battleEventMode },
  });
}

export function acknowledgeCampaignMigrationNotice(save, noticeId) {
  const current = migrateCampaignSave(save);
  const normalizedId = typeof noticeId === "string" ? noticeId.trim() : "";
  if (!normalizedId || !current.migrationNotices.some(({ id }) => id === normalizedId)) return current;
  return reviseCampaignSave({
    ...current,
    migrationNotices: current.migrationNotices.filter(({ id }) => id !== normalizedId),
  });
}

function normalizeStageResultInput(stageIdOrResult, maybeResult) {
  if (typeof stageIdOrResult === "string") return { ...(isRecord(maybeResult) ? maybeResult : {}), stageId: stageIdOrResult };
  return isRecord(stageIdOrResult) ? stageIdOrResult : {};
}

/**
 * Applies one battle result without mutating the supplied save. Supports both
 * resolveStageResult(save, { stageId, ... }) and
 * resolveStageResult(save, stageId, { ... }).
 */
export function resolveStageResult(save, stageIdOrResult, maybeResult) {
  const input = normalizeStageResultInput(stageIdOrResult, maybeResult);
  const stage = CAMPAIGN_STAGE_BY_ID[input.stageId];
  if (!stage) throw new RangeError(`Unknown campaign stage: ${String(input.stageId)}`);
  const resultId = typeof input.resultId === "string" ? input.resultId.trim() : "";
  if (!resultId) throw new TypeError("A non-empty resultId is required to apply a campaign result");
  const current = migrateCampaignSave(save);
  const won = input.won === true || input.victory === true || input.outcome === "won";
  const stars = calculateStageStars({
    won,
    baseHp: input.baseHp,
    baseMaxHp: input.baseMaxHp ?? stage.baseHp,
    thresholds: stage.starThresholds,
  });
  const previousBestStars = current.bestStarsByStage[stage.id] ?? 0;
  if (current.processedResultIds.includes(resultId)) {
    return {
      save: current,
      result: {
        resultId,
        stageId: stage.id,
        applied: false,
        alreadyProcessed: true,
        stars,
        previousBestStars,
        bestStars: previousBestStars,
        isNewBest: false,
        currencyName: "キャップ",
        baseReward: stage.baseReward,
        replayMultiplier: 0,
        replayReward: 0,
        newStarMilestones: [],
        firstTimeStarReward: 0,
        totalReward: 0,
        newlyUnlockedStageIds: [],
        newlyUnlockedUnitIds: [],
        newlyOwnedUnitIds: [],
        newlyDiscoveredUnitIds: [],
        newlyRecruitableUnitIds: [],
      },
    };
  }
  const bestStars = Math.max(previousBestStars, stars);
  const claimedBefore = current.claimedStarRewardsByStage[stage.id] ?? [];
  const rewards = calculateStageRewards({ stageId: stage.id, stars, claimedStarRewards: claimedBefore });
  const claimedAfter = [...new Set([...claimedBefore, ...rewards.newStarMilestones])].sort((a, b) => a - b);
  const completedStageIds = stars > 0
    ? [...new Set([...current.completedStageIds, stage.id])]
    : [...current.completedStageIds];
  const caps = current.caps + rewards.totalReward;
  const records = recordCampaignOperation(current.records, {
    resultId,
    operationId: stage.id,
    category: "campaign",
    won,
    battleSeconds: input.battleSeconds,
    kills: input.kills,
    unitsLost: input.unitsLost,
    bossKills: input.bossKills,
    capsEarned: rewards.totalReward,
    encounteredEnemyKinds: input.encounteredEnemyKinds,
    enemyDefeatsByKind: input.enemyDefeatsByKind,
    unitStats: input.unitStats,
    completedAt: input.completedAt,
  });
  const draftSave = migrateCampaignSave({
    ...current,
    campaignStarted: true,
    processedResultIds: [...current.processedResultIds, resultId],
    completedStageIds,
    bestStarsByStage: { ...current.bestStarsByStage, [stage.id]: bestStars },
    claimedStarRewardsByStage: { ...current.claimedStarRewardsByStage, [stage.id]: claimedAfter },
    caps,
    supplies: caps,
    lastSelectedStageId: stage.id,
    records,
  });
  const nextSave = reviseCampaignSave(draftSave);
  const newlyUnlockedStageIds = nextSave.unlockedStageIds.filter((id) => !current.unlockedStageIds.includes(id));
  const newlyOwnedUnitIds = nextSave.ownership.filter((id) => !current.ownership.includes(id));
  const newlyDiscoveredUnitIds = nextSave.discovery.filter((id) => !current.discovery.includes(id));
  const newlyRecruitableUnitIds = nextSave.recruitable.filter((id) => !current.recruitable.includes(id));

  return {
    save: nextSave,
    result: {
      resultId,
      stageId: stage.id,
      applied: true,
      alreadyProcessed: false,
      stars,
      previousBestStars,
      bestStars,
      isNewBest: stars > previousBestStars,
      newlyUnlockedStageIds,
      newlyUnlockedUnitIds: newlyOwnedUnitIds,
      newlyOwnedUnitIds,
      newlyDiscoveredUnitIds,
      newlyRecruitableUnitIds,
      ...rewards,
    },
  };
}

export function markCampaignStarted(save) {
  const current = migrateCampaignSave(save);
  return current.campaignStarted ? current : reviseCampaignSave({ ...current, campaignStarted: true });
}

export function applyStageResult(save, stageIdOrResult, maybeResult) {
  return resolveStageResult(save, stageIdOrResult, maybeResult).save;
}

export function isStageUnlocked(save, stageId) {
  return migrateCampaignSave(save).unlockedStageIds.includes(stageId);
}

export function isUnitUnlocked(save, unitId) {
  return isUnitOwned(save, unitId);
}

export function selectCampaignStage(save, stageId) {
  const current = migrateCampaignSave(save);
  if (!CAMPAIGN_STAGE_BY_ID[stageId] || !current.unlockedStageIds.includes(stageId)) return current;
  if (current.lastSelectedStageId === stageId) return current;
  return reviseCampaignSave({ ...current, lastSelectedStageId: stageId });
}

export function updateCampaignSettings(save, settingsPatch) {
  const current = migrateCampaignSave(save);
  const settings = normalizeSettings({ ...current.settings, ...(isRecord(settingsPatch) ? settingsPatch : {}) });
  if (JSON.stringify(settings) === JSON.stringify(current.settings)) return current;
  return reviseCampaignSave({
    ...current,
    settings,
  });
}
