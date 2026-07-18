import { STORY_SCRIPT_VERSION } from "./storyEvents.js";

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
});

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

export const CAMPAIGN_STAGES = deepFreeze([
  {
    id: CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET,
    stageNumber: 1,
    displayName: "西新商店街",
    chapterId: CAMPAIGN_CHAPTER_ID,
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
      { id: "nishijin-wave-01", atSeconds: 4, groups: [{ kind: "walker", lanes: [0, 1, 2], count: 4 }] },
      { id: "nishijin-wave-02", atSeconds: 21, groups: [{ kind: "runner", lanes: [0, 2], count: 4 }, { kind: "walker", lanes: [0, 1, 2], count: 3 }] },
      { id: "nishijin-wave-03", atSeconds: 39, groups: [{ kind: "spitter", lanes: [0, 1, 2], count: 3 }, { kind: "walker", lanes: [0, 1, 2], count: 3 }] },
      { id: "nishijin-wave-04", atSeconds: 58, groups: [{ kind: "crusher", lanes: [0, 2], count: 2 }, { kind: "runner", lanes: [0, 1, 2], count: 4 }] },
      { id: "nishijin-wave-05", atSeconds: 76, groups: [{ kind: "spitter", lanes: [0, 2], count: 2 }, { kind: "runner", lanes: [0, 1, 2], count: 3 }] },
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
      { id: "sawara-wave-01", atSeconds: 6, groups: [{ kind: "walker", lanes: [0, 1, 2], count: 6 }] },
      { id: "sawara-wave-02", atSeconds: 31, groups: [{ kind: "runner", lanes: [0, 2], count: 5 }, { kind: "spitter", lanes: [1], count: 3 }] },
      { id: "sawara-wave-03", atSeconds: 56, groups: [{ kind: "crusher", lanes: [0, 2], count: 2 }, { kind: "walker", lanes: [0, 1, 2], count: 5 }] },
      { id: "sawara-wave-04", atSeconds: 82, groups: [{ kind: "runner", lanes: [0, 1, 2], count: 5 }, { kind: "spitter", lanes: [0, 2], count: 3 }] },
      { id: "sawara-wave-05", atSeconds: 109, groups: [{ kind: "abomination", lanes: [1], count: 1 }, { kind: "crusher", lanes: [0, 2], count: 3 }, { kind: "walker", lanes: [0, 1, 2], count: 3 }] },
      { id: "sawara-wave-06", atSeconds: 136, groups: [{ kind: "runner", lanes: [0, 2], count: 6 }, { kind: "spitter", lanes: [0, 1, 2], count: 3 }] },
      { id: "sawara-wave-07", atSeconds: 162, groups: [{ kind: "crusher", lanes: [0, 1, 2], count: 3 }, { kind: "spitter", lanes: [0, 2], count: 2 }, { kind: "runner", lanes: [0, 2], count: 3 }] },
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
      { id: "takuya-wave-01", atSeconds: 0, waveNumber: 1, label: "第1波 — 接敵", units: [["walker", 0], ["walker", 1], ["walker", 2]] },
      { id: "takuya-wave-02", atSeconds: 12, waveNumber: 2, label: "第2波 — 分散攻撃", units: [["walker", 0], ["runner", 0], ["spitter", 1], ["walker", 1], ["runner", 2], ["walker", 2]] },
      { id: "takuya-wave-03", atSeconds: 30, waveNumber: 3, label: "第3波 — 圧力上昇", units: [["runner", 0], ["walker", 0], ["runner", 1], ["spitter", 1], ["runner", 2], ["walker", 2]] },
      { id: "takuya-wave-04", atSeconds: 47, waveNumber: 4, label: "精鋭出現 — 影走り", units: [["shade", 0], ["runner", 0], ["walker", 1], ["spitter", 1], ["runner", 2], ["spitter", 2]] },
      { id: "takuya-wave-05", atSeconds: 65, waveNumber: 5, label: "第5波 — 重装感染体", units: [["crusher", 0], ["walker", 0], ["spitter", 1], ["runner", 1], ["crusher", 2], ["walker", 2], ["runner", 2]] },
      { id: "takuya-wave-06", atSeconds: 84, waveNumber: 6, label: "第6波 — 全レーン警戒", units: [["runner", 0], ["spitter", 0], ["walker", 1], ["crusher", 1], ["runner", 2], ["spitter", 2], ["walker", 2]] },
      { id: "takuya-wave-07", atSeconds: 103, waveNumber: 7, label: "最終防衛線 — 維持", units: [["crusher", 0], ["runner", 0], ["abomination", 1], ["walker", 1], ["spitter", 1], ["crusher", 2], ["runner", 2]] },
      { id: "takuya-warning", atSeconds: 120, waveNumber: 7, label: "警告 — 巨大反応", units: [] },
      { id: "takuya-wave-boss", atSeconds: 126, waveNumber: 8, label: "異常感染者 — TAKUYA / 鉄の審判", units: [["walker", 0], ["spitter", 0], ["takuya", 1], ["runner", 1], ["crusher", 2], ["runner", 2]] },
      { id: "takuya-wave-09", atSeconds: 147, waveNumber: 9, label: "感染体増援", units: [["runner", 0], ["spitter", 0], ["spitter", 1], ["runner", 2], ["walker", 2]] },
      { id: "takuya-wave-10", atSeconds: 169, waveNumber: 10, label: "TAKUYA — 激昂", bossOnly: true, units: [["crusher", 0], ["runner", 0], ["runner", 1], ["crusher", 2], ["spitter", 2]] },
      { id: "takuya-wave-final", atSeconds: 196, waveNumber: 11, label: "最終機会 — 感染拠点を破壊", units: [["runner", 0], ["spitter", 0], ["runner", 1], ["crusher", 1], ["walker", 1], ["runner", 2], ["spitter", 2]] },
    ],
    boss: {
      id: "boss-takuya",
      enemyKind: "takuya",
      displayName: "TAKUYA",
      classification: "正体不明の変異種・異常感染者",
      entranceEventId: "event-prologue-takuya-entrance",
    },
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
      { id: "station-gate-wave-01", atSeconds: 4, groups: [{ kind: "walker", lanes: [0, 1, 2], count: 5 }] },
      { id: "station-gate-wave-02", atSeconds: 22, groups: [{ kind: "grappler", lanes: [0, 2], count: 2 }, { kind: "runner", lanes: [0, 1, 2], count: 3 }] },
      { id: "station-gate-wave-03", atSeconds: 41, groups: [{ kind: "spitter", lanes: [0, 2], count: 3 }, { kind: "walker", lanes: [0, 1, 2], count: 4 }] },
      { id: "station-gate-wave-04", atSeconds: 62, groups: [{ kind: "grappler", lanes: [0, 1, 2], count: 3 }, { kind: "crusher", lanes: [1], count: 1 }] },
      { id: "station-gate-wave-05", atSeconds: 84, groups: [{ kind: "runner", lanes: [0, 2], count: 5 }, { kind: "spitter", lanes: [1], count: 2 }] },
      { id: "station-gate-wave-06", atSeconds: 108, groups: [{ kind: "grappler", lanes: [0, 2], count: 2 }, { kind: "crusher", lanes: [0, 2], count: 2 }, { kind: "walker", lanes: [1], count: 3 }] },
      { id: "station-gate-wave-07", atSeconds: 132, groups: [{ kind: "grappler", lanes: [1], count: 2 }, { kind: "runner", lanes: [0, 2], count: 4 }, { kind: "spitter", lanes: [0, 2], count: 2 }] },
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
    mapPosition: { x: 87, y: 51, unit: "percent" },
    unlockRequirements: [{ type: "stage-stars", stageId: CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE, minimumStars: 1 }],
    prerequisiteStageIds: [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE],
    missionType: "escort",
    objective: "保守台車を護衛し、生存者と物資を出口へ運ぶ",
    objectiveConfig: {
      target: "maintenance-cart",
      durationSeconds: 135,
      maxIntegrity: 500,
      repairSeconds: 20,
      rescueCount: 5,
      startX: 258,
      endX: 776,
      cartLane: 1,
      escortRadiusX: 110,
      escortRadiusY: 48,
      threatRadiusX: 90,
      threatRadiusY: 55,
    },
    theme: {
      id: "theme-nishijin-station-platform",
      backgroundId: "background-nishijin-station-platform-v1",
      tags: ["ホーム", "線路", "保守台車"],
    },
    enemyKinds: ["walker", "runner", "spitter", "crusher", "ooze", "sprinter"],
    waves: [
      { id: "station-platform-wave-01", atSeconds: 3, groups: [{ kind: "walker", lanes: [0, 1, 2], count: 5 }] },
      { id: "station-platform-wave-02", atSeconds: 19, groups: [{ kind: "ooze", lanes: [0, 2], count: 2 }, { kind: "runner", lanes: [1], count: 3 }] },
      { id: "station-platform-wave-03", atSeconds: 38, groups: [{ kind: "sprinter", lanes: [0, 2], count: 3 }, { kind: "spitter", lanes: [1], count: 2 }] },
      { id: "station-platform-wave-04", atSeconds: 58, groups: [{ kind: "ooze", lanes: [0, 1, 2], count: 3 }, { kind: "crusher", lanes: [1], count: 1 }] },
      { id: "station-platform-wave-05", atSeconds: 80, groups: [{ kind: "sprinter", lanes: [0, 1, 2], count: 4 }, { kind: "walker", lanes: [0, 2], count: 4 }] },
      { id: "station-platform-wave-06", atSeconds: 104, groups: [{ kind: "ooze", lanes: [0, 2], count: 2 }, { kind: "spitter", lanes: [0, 1, 2], count: 3 }, { kind: "runner", lanes: [1], count: 3 }] },
      { id: "station-platform-wave-07", atSeconds: 130, groups: [{ kind: "sprinter", lanes: [0, 2], count: 4 }, { kind: "crusher", lanes: [0, 2], count: 2 }] },
      { id: "station-platform-wave-08", atSeconds: 158, groups: [{ kind: "ooze", lanes: [1], count: 2 }, { kind: "sprinter", lanes: [0, 1, 2], count: 4 }, { kind: "walker", lanes: [0, 1, 2], count: 3 }] },
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
        "gate-eater",
        "research-container",
        "seal-door",
        "return-route",
      ],
      powerHoldSeconds: 6,
      powerReadyAtSeconds: [24, 62, 104],
      powerLanes: [0, 2, 1],
      powerXs: [410, 584, 744],
      powerRadiusX: 84,
      powerRadiusY: 42,
      sealDoorX: 867,
      sealLane: 1,
      researchContainerStartX: 708,
      researchContainerLane: 1,
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
      { id: "station-tunnel-wave-01", atSeconds: 0, groups: [{ kind: "walker", lanes: [0, 1, 2], count: 5 }] },
      { id: "station-tunnel-wave-02", atSeconds: 18, groups: [{ kind: "grappler", lanes: [0, 2], count: 2 }, { kind: "runner", lanes: [1], count: 3 }] },
      { id: "station-tunnel-wave-03", atSeconds: 42, groups: [{ kind: "ooze", lanes: [0, 2], count: 2 }, { kind: "spitter", lanes: [1], count: 2 }] },
      { id: "station-tunnel-wave-04", atSeconds: 66, groups: [{ kind: "sprinter", lanes: [0, 1, 2], count: 4 }, { kind: "crusher", lanes: [1], count: 1 }] },
      { id: "station-tunnel-wave-05", atSeconds: 92, groups: [{ kind: "grappler", lanes: [0, 2], count: 2 }, { kind: "ooze", lanes: [1], count: 2 }, { kind: "walker", lanes: [0, 1, 2], count: 3 }] },
      { id: "station-tunnel-warning", atSeconds: 112, waveNumber: 6, label: "大型特殊個体反応", units: [] },
      { id: "station-tunnel-gate-eater", atSeconds: 120, waveNumber: 7, label: "改札喰い // 封鎖対象", units: [["gate-eater", 1], ["sprinter", 0], ["sprinter", 2], ["spitter", 0], ["spitter", 2]] },
      { id: "station-tunnel-wave-08", atSeconds: 146, groups: [{ kind: "grappler", lanes: [0, 2], count: 2 }, { kind: "runner", lanes: [0, 1, 2], count: 4 }] },
      { id: "station-tunnel-wave-09", atSeconds: 172, groups: [{ kind: "ooze", lanes: [0, 1, 2], count: 3 }, { kind: "crusher", lanes: [0, 2], count: 2 }] },
      { id: "station-tunnel-wave-10", atSeconds: 198, groups: [{ kind: "sprinter", lanes: [0, 2], count: 4 }, { kind: "grappler", lanes: [1], count: 2 }, { kind: "walker", lanes: [0, 1, 2], count: 3 }] },
    ],
    boss: {
      id: "boss-gate-eater",
      enemyKind: "gate-eater",
      displayName: "改札喰い",
      classification: "駅設備・研究容器融合大型特殊個体",
      entranceEventId: "stage-station-tunnel-gate-eater-v070",
    },
    baseHp: 720,
    starThresholds: DEFAULT_STAR_THRESHOLDS,
    baseReward: stationTunnelBaseReward,
    firstTimeStarRewards: firstStarRewards(stationTunnelBaseReward),
    replayRewardMultipliers: DEFAULT_REPLAY_REWARD_MULTIPLIERS,
    preBattleEventId: "stage-station-tunnel-pre-v070",
    postBattleEventId: "stage-station-tunnel-post-v070",
    nextUnlocks: {
      stageIds: [],
      unitIds: [CAMPAIGN_UNIT_IDS.MONKEY],
      discoveredUnitIds: [CAMPAIGN_UNIT_IDS.MONKEY],
      recruitableUnitIds: [],
      mapSignalIds: ["map-signal-university-hospital"],
    },
  },
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
    roleTags: ["高機動", "近接", "レーン移動", "対高速"],
    roleName: "遊撃手",
    roleIcon: "速",
    weaponName: "バール",
    attackMode: "高速接近・打撃",
    rangeBand: "近距離",
    primaryTarget: "走行型・影走り",
    deploymentHint: "敵の薄い経路へ素早く投入",
    description: "機動力とバールで高速感染者を迎撃する",
    spritePath: null,
    assetStatus: "pending-approval",
    appearanceAudit: {
      presentation: "細身で機動的な男性的表現",
      weaponMatch: "携行するバールと高速近接役が一致",
      result: "0.7.0正式画像は承認待ち",
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
    spritePath: null,
    assetStatus: "pending-approval",
    appearanceAudit: {
      presentation: "軽装で機動的な女性的表現",
      weaponMatch: "自動小銃と遠距離射撃役が一致",
      result: "0.7.0正式画像は承認待ち",
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
    spritePath: null,
    assetStatus: "pending-approval",
    appearanceAudit: {
      presentation: "成人女性の救護装備表現を新規設計",
      weaponMatch: "短銃身カービン、救急バッグ、止血器具",
      result: "0.7.0正式画像は承認待ち",
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
    spritePath: null,
    assetStatus: "pending-approval",
    appearanceAudit: {
      presentation: "大柄で重装の男性的表現",
      weaponMatch: "大型ハンマーと破砕役が一致",
      result: "0.7.0正式画像は承認待ち",
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
    roleTags: ["中遠距離", "同一レーン直線範囲", "連射", "制圧", "対群体"],
    roleName: "制圧射手",
    roleIcon: "制",
    weaponName: "軽機関銃",
    attackMode: "同一レーン制圧連射",
    rangeBand: "中～遠距離",
    primaryTarget: "大型・密集群",
    deploymentHint: "火線を通せる後列へ配備",
    description: "軽機関銃の連射で大型個体と密集群を制圧する",
    recruitmentCostCaps: 200,
    spritePath: null,
    assetStatus: "pending-approval",
    appearanceAudit: {
      presentation: "弾帯を着用した女性的表現",
      weaponMatch: "軽機関銃と制圧射撃役が一致",
      result: "0.7.0正式画像は承認待ち",
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
    weaponName: "大型盾・警棒・短い散弾銃",
    attackMode: "防御・足止め",
    rangeBand: "近距離",
    primaryTarget: "前線の感染者",
    deploymentHint: "守る味方の前へ配備",
    description: "大型盾で攻撃を受け止め、後方の味方を守る",
    deploymentCost: 48,
    spritePath: null,
    assetStatus: "pending-approval",
    appearanceAudit: {
      presentation: "地域の警備員と大型盾の表現を新規設計",
      weaponMatch: "大型盾、警棒、短い散弾銃",
      result: "0.7.0正式画像は承認待ち",
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
    roleName: "工兵",
    roleIcon: "工",
    weaponName: "工業用釘打ち機・レンチ",
    attackMode: "射撃・自動足止め装置",
    rangeBand: "中距離",
    primaryTarget: "高速型・侵入経路",
    deploymentHint: "守るレーンの後方へ配備",
    description: "保線工具と足止め装置で敵の進行を妨害する",
    spritePath: null,
    assetStatus: "pending-approval",
    appearanceAudit: {
      presentation: "地下鉄保線作業員と工兵の表現を新規設計",
      weaponMatch: "工業用釘打ち機、レンチ、携帯工具",
      result: "0.7.0正式画像は承認待ち",
    },
    unlock: { type: "story-join", stageNumber: 6, costCaps: 0 },
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
});

export const CAMPAIGN_RECRUITMENT_COSTS = deepFreeze({
  [CAMPAIGN_UNIT_IDS.TATARA]: 150,
  [CAMPAIGN_UNIT_IDS.RAIDER]: 200,
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

export const CAMPAIGN_SAVE_SCHEMA_VERSION = 5;
export const SAVE_SCHEMA_VERSION = CAMPAIGN_SAVE_SCHEMA_VERSION;

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

export function createDefaultCampaignSave() {
  const ownership = [...INITIAL_UNIT_IDS];
  const formationUnitIds = [...INITIAL_UNIT_IDS].slice(0, CAMPAIGN_FORMATION_MAX_SLOTS);
  const formationPresets = CAMPAIGN_FORMATION_PRESET_ORDER.map((id) => ({
    id,
    displayName: CAMPAIGN_FORMATION_PRESET_LABELS[id],
    unitIds: [...formationUnitIds],
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
    completedStageIds: [],
    bestStarsByStage: {},
    claimedStarRewardsByStage: {},
    caps: 0,
    // Deprecated 0.6.x currency field retained as a synchronized read alias.
    supplies: 0,
    unlockedStageIds: [INITIAL_STAGE_ID],
    ownership,
    discovery: [...ownership],
    recruitable: [],
    // Deprecated 0.6.x roster field retained as a canonical-ID mirror.
    unlockedUnitIds: [...ownership],
    formationPresets,
    selectedFormationPresetId: CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_1,
    selectedPresetId: CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_1,
    lastSelectedStageId: INITIAL_STAGE_ID,
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

  if (!Number.isFinite(sourceSchemaVersion) || sourceSchemaVersion < CAMPAIGN_SAVE_SCHEMA_VERSION) {
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

function normalizeFormationPresets(value, ownership, legacyFormation) {
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
    return {
      id,
      displayName: CAMPAIGN_FORMATION_PRESET_LABELS[id],
      unitIds: unitIds.length > 0 ? unitIds : [...safeDefault],
    };
  });
}

/**
 * Normalizes current data and migrates schema-less/v0 aliases. Unknown fields
 * are ignored without invalidating recognized progress.
 */
export function migrateCampaignSave(rawSave) {
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
    && (!Number.isFinite(sourceSchemaVersion) || sourceSchemaVersion < CAMPAIGN_SAVE_SCHEMA_VERSION)
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
  const legacyFormation = firstDefined(
    source,
    ["formationUnitIds", "formationKinds", "selectedUnitIds", "loadoutUnitIds"],
    [],
  );
  const formationPresets = normalizeFormationPresets(
    firstDefined(source, ["formationPresets", "presets", "formations"], []),
    roster.ownership,
    legacyFormation,
  );
  const selectedFormationPresetId = normalizeFormationPresetId(firstDefined(
    source,
    ["selectedFormationPresetId", "selectedPresetId", "selectedFormationPreset", "selectedPreset"],
    CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_1,
  )) ?? CAMPAIGN_FORMATION_PRESET_IDS.SQUAD_1;
  const caps = clampInteger(
    firstDefined(source, ["caps", "supplies", "supply", "currency"], 0),
    0,
    Number.MAX_SAFE_INTEGER,
    0,
  );
  const revision = clampInteger(source.revision, 0, Number.MAX_SAFE_INTEGER, 0);
  const updatedAt = typeof source.updatedAt === "string" && Number.isFinite(Date.parse(source.updatedAt))
    ? new Date(source.updatedAt).toISOString()
    : "";

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
    completedStageIds,
    bestStarsByStage,
    claimedStarRewardsByStage,
    caps,
    supplies: caps,
    ...effectiveUnlocks,
    ...roster,
    unlockedUnitIds: [...roster.ownership],
    formationPresets,
    selectedFormationPresetId,
    selectedPresetId: selectedFormationPresetId,
    lastSelectedStageId,
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

export function reviseCampaignSave(save, { updatedAt = new Date().toISOString() } = {}) {
  const current = migrateCampaignSave(save);
  return {
    ...current,
    revision: Math.min(Number.MAX_SAFE_INTEGER, current.revision + 1),
    updatedAt: normalizedTimestamp(updatedAt, new Date().toISOString()),
    integrity: "",
  };
}

function campaignIntegrityPayload(save) {
  const normalized = migrateCampaignSave(save);
  const payload = { ...normalized };
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

export function computeCampaignSaveIntegrity(save) {
  return `fnv1a32:${fnv1a32(campaignIntegrityPayload(save))}`;
}

export function withCampaignSaveIntegrity(save) {
  const normalized = migrateCampaignSave(save);
  return {
    ...normalized,
    integrity: computeCampaignSaveIntegrity(normalized),
  };
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
 * intentionally forgiving migration function. Persisted v1-v4 saves always
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
  if (sourceSchemaVersion >= CAMPAIGN_SAVE_SCHEMA_VERSION && !verifyCampaignSaveIntegrity(parsed)) {
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

  const save = migrateCampaignSave(parsed);
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

export function serializeCampaignSave(save) {
  try {
    return JSON.stringify(withCampaignSaveIntegrity(save));
  } catch {
    return JSON.stringify(withCampaignSaveIntegrity(createDefaultCampaignSave()));
  }
}

export function deserializeCampaignSave(serialized) {
  if (typeof serialized !== "string") return migrateCampaignSave(serialized);
  try {
    const parsed = JSON.parse(serialized);
    if (isRecord(parsed)
      && Number(parsed.schemaVersion) >= CAMPAIGN_SAVE_SCHEMA_VERSION
      && typeof parsed.integrity === "string"
      && parsed.integrity.length > 0
      && !verifyCampaignSaveIntegrity(parsed)) {
      return createDefaultCampaignSave();
    }
    return migrateCampaignSave(parsed);
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
