import { STORY_SCRIPT_VERSION } from "./storyEvents.js";

/**
 * Pure, data-driven campaign progression for the 0.6.0 early-access foundation.
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
});

export const CAMPAIGN_UNIT_IDS = deepFreeze({
  PAISEN: "brawler",
  TACHIBANA_JIN: "scout",
  KUROKI_RIN: "ranger",
  SHIRAISHI_NAOTO: "medic",
  OBA_GO: "brute",
  CRAZY_KING: "crazy-king",
  KUMAVERSON: "kumaverson",
  BABAYAGA: "babayaga",
  MAKABE_REINA: "gunner",
});

export const CAMPAIGN_GUIDE_ID = "guide-mizuki-nana";

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

// PROVISIONAL BALANCE (0.6.0): these supply values are explicit starting
// points for playtesting, not final economy decisions. Star milestone rewards
// below intentionally begin at one half of each stage's provisional base.
export const PROVISIONAL_BASE_REWARDS = deepFreeze({
  [CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET]: 100,
  [CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE]: 140,
  [CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE]: 200,
});

function firstStarRewards(baseReward) {
  const reward = Math.round(baseReward * 0.5);
  return deepFreeze({ 1: reward, 2: reward, 3: reward });
}

const nishijinBaseReward = PROVISIONAL_BASE_REWARDS[CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET];
const sawaraBaseReward = PROVISIONAL_BASE_REWARDS[CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE];
const takuyaBaseReward = PROVISIONAL_BASE_REWARDS[CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE];

export const CAMPAIGN_STAGES = deepFreeze([
  {
    id: CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET,
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
      { id: "nishijin-wave-01", atSeconds: 5, groups: [{ kind: "walker", lanes: [0, 1, 2], count: 3 }] },
      { id: "nishijin-wave-02", atSeconds: 24, groups: [{ kind: "runner", lanes: [0, 2], count: 4 }, { kind: "walker", lanes: [1], count: 2 }] },
      { id: "nishijin-wave-03", atSeconds: 48, groups: [{ kind: "spitter", lanes: [1], count: 2 }, { kind: "walker", lanes: [0, 2], count: 4 }] },
      { id: "nishijin-wave-04", atSeconds: 76, groups: [{ kind: "crusher", lanes: [1], count: 1 }, { kind: "runner", lanes: [0, 2], count: 4 }] },
    ],
    boss: null,
    baseHp: 1000,
    starThresholds: DEFAULT_STAR_THRESHOLDS,
    baseReward: nishijinBaseReward,
    firstTimeStarRewards: firstStarRewards(nishijinBaseReward),
    replayRewardMultipliers: DEFAULT_REPLAY_REWARD_MULTIPLIERS,
    preBattleEventId: "stage-nishijin-pre",
    postBattleEventId: "stage-nishijin-post",
    nextUnlocks: {
      stageIds: [CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE],
      unitIds: [CAMPAIGN_UNIT_IDS.OBA_GO, CAMPAIGN_UNIT_IDS.CRAZY_KING],
      mapSignalIds: [],
    },
  },
  {
    id: CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE,
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
      { id: "sawara-wave-01", atSeconds: 8, groups: [{ kind: "walker", lanes: [0, 1, 2], count: 6 }] },
      { id: "sawara-wave-02", atSeconds: 38, groups: [{ kind: "runner", lanes: [0, 2], count: 6 }, { kind: "spitter", lanes: [1], count: 2 }] },
      { id: "sawara-wave-03", atSeconds: 78, groups: [{ kind: "crusher", lanes: [0, 2], count: 2 }, { kind: "walker", lanes: [1], count: 4 }] },
      { id: "sawara-wave-04", atSeconds: 122, groups: [{ kind: "abomination", lanes: [1], count: 1 }, { kind: "runner", lanes: [0, 2], count: 8 }] },
      { id: "sawara-wave-05", atSeconds: 160, groups: [{ kind: "crusher", lanes: [0, 1, 2], count: 3 }, { kind: "spitter", lanes: [0, 2], count: 4 }] },
    ],
    boss: null,
    baseHp: 1000,
    starThresholds: DEFAULT_STAR_THRESHOLDS,
    baseReward: sawaraBaseReward,
    firstTimeStarRewards: firstStarRewards(sawaraBaseReward),
    replayRewardMultipliers: DEFAULT_REPLAY_REWARD_MULTIPLIERS,
    preBattleEventId: "stage-sawara-pre",
    postBattleEventId: "stage-sawara-post",
    nextUnlocks: {
      stageIds: [CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE],
      unitIds: [CAMPAIGN_UNIT_IDS.KUMAVERSON, CAMPAIGN_UNIT_IDS.BABAYAGA, CAMPAIGN_UNIT_IDS.MAKABE_REINA],
      mapSignalIds: [],
    },
  },
  {
    id: CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE,
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
      { id: "takuya-wave-02", atSeconds: 15, waveNumber: 2, label: "第2波 — 分散攻撃", units: [["walker", 0], ["runner", 0], ["spitter", 1], ["walker", 1], ["walker", 2]] },
      { id: "takuya-wave-03", atSeconds: 37, waveNumber: 3, label: "第3波 — 圧力上昇", units: [["runner", 0], ["walker", 0], ["runner", 1], ["walker", 1], ["runner", 2], ["walker", 2]] },
      { id: "takuya-wave-04", atSeconds: 55, waveNumber: 4, label: "精鋭出現 — 影走り", units: [["shade", 0], ["runner", 0], ["walker", 1], ["spitter", 1], ["runner", 2]] },
      { id: "takuya-wave-05", atSeconds: 75, waveNumber: 5, label: "第5波 — 重装感染体", units: [["crusher", 0], ["walker", 0], ["spitter", 1], ["runner", 1], ["crusher", 2], ["walker", 2]] },
      { id: "takuya-wave-06", atSeconds: 98, waveNumber: 6, label: "第6波 — 全レーン警戒", units: [["runner", 0], ["spitter", 0], ["walker", 1], ["crusher", 1], ["runner", 2], ["spitter", 2]] },
      { id: "takuya-wave-07", atSeconds: 118, waveNumber: 7, label: "最終防衛線 — 維持", units: [["crusher", 0], ["runner", 0], ["abomination", 1], ["walker", 1], ["crusher", 2], ["runner", 2]] },
      { id: "takuya-warning", atSeconds: 137, waveNumber: 7, label: "警告 — 巨大反応", units: [] },
      { id: "takuya-wave-boss", atSeconds: 143, waveNumber: 8, label: "異常感染者 — TAKUYA / 鉄の審判", units: [["walker", 0], ["spitter", 0], ["takuya", 1], ["runner", 1], ["crusher", 2]] },
      { id: "takuya-wave-09", atSeconds: 163, waveNumber: 9, label: "感染体増援", units: [["runner", 0], ["spitter", 1], ["runner", 2]] },
      { id: "takuya-wave-10", atSeconds: 183, waveNumber: 10, label: "TAKUYA — 激昂", bossOnly: true, units: [["crusher", 0], ["runner", 1], ["crusher", 2]] },
      { id: "takuya-wave-final", atSeconds: 215, waveNumber: 11, label: "最終機会 — 感染拠点を破壊", units: [["runner", 0], ["spitter", 0], ["runner", 1], ["crusher", 1], ["runner", 2], ["spitter", 2]] },
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
    preBattleEventId: "stage-takuya-pre",
    postBattleEventId: "stage-takuya-post",
    nextUnlocks: {
      stageIds: [],
      unitIds: [],
      mapSignalIds: ["map-signal-momochihama-anomaly"],
    },
  },
]);

export const CAMPAIGN_STAGE_BY_ID = deepFreeze(Object.fromEntries(CAMPAIGN_STAGES.map((stage) => [stage.id, stage])));
export const STAGE_BY_ID = CAMPAIGN_STAGE_BY_ID;
export const INITIAL_STAGE_ID = CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET;

export const CAMPAIGN_UNITS = deepFreeze([
  {
    id: CAMPAIGN_UNIT_IDS.PAISEN,
    combatKind: "brawler",
    displayName: "パイセン",
    roleName: "格闘家",
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
    id: CAMPAIGN_UNIT_IDS.TACHIBANA_JIN,
    combatKind: "scout",
    displayName: "橘 迅",
    roleName: "遊撃手",
    roleIcon: "速",
    weaponName: "バール",
    attackMode: "高速接近・打撃",
    rangeBand: "近距離",
    primaryTarget: "走行型・影走り",
    deploymentHint: "敵の薄い経路へ素早く投入",
    description: "機動力とバールで高速感染者を迎撃する",
    spritePath: "/scout-sprites-v2.png",
    appearanceAudit: {
      presentation: "細身で機動的な男性的表現",
      weaponMatch: "携行するバールと高速近接役が一致",
      result: "表示名・人物表現・役割と整合",
    },
    unlock: { type: "initial" },
  },
  {
    id: CAMPAIGN_UNIT_IDS.KUROKI_RIN,
    combatKind: "ranger",
    displayName: "黒木 凛",
    roleName: "射撃手",
    roleIcon: "狙",
    weaponName: "自動小銃",
    attackMode: "遠距離精密射撃",
    rangeBand: "遠距離",
    primaryTarget: "吐瀉型・大型",
    deploymentHint: "後列から危険個体を狙う",
    description: "自動小銃で遠方の危険個体を優先排除する",
    spritePath: "/ranger-sprites-v1.png",
    appearanceAudit: {
      presentation: "軽装で機動的な女性的表現",
      weaponMatch: "自動小銃と遠距離射撃役が一致",
      result: "表示名・人物表現・役割と整合",
    },
    storyRole: "序章の現場案内役",
    unlock: { type: "initial" },
  },
  {
    id: CAMPAIGN_UNIT_IDS.SHIRAISHI_NAOTO,
    combatKind: "medic",
    displayName: "白石 直人",
    roleName: "衛生兵",
    roleIcon: "救",
    weaponName: "自動小銃・救急バッグ",
    attackMode: "援護射撃・味方治療",
    rangeBand: "中距離",
    primaryTarget: "負傷した味方",
    deploymentHint: "味方の後方へ配備",
    description: "部隊に追従し、援護射撃と治療を行う",
    spritePath: "/medic-sprites-v1.png",
    appearanceAudit: {
      presentation: "救護装備を着用した男性的表現",
      weaponMatch: "自動小銃と救急バッグが役割に一致",
      result: "表示名・人物表現・役割と整合",
    },
    unlock: { type: "initial" },
  },
  {
    id: CAMPAIGN_UNIT_IDS.OBA_GO,
    combatKind: "brute",
    displayName: "大庭 豪",
    roleName: "破砕兵",
    roleIcon: "砕",
    weaponName: "大型ハンマー",
    attackMode: "重打撃",
    rangeBand: "近距離",
    primaryTarget: "重装型・感染拠点",
    deploymentHint: "前線の要所へ配備",
    description: "大型ハンマーで重装個体と感染拠点を砕く",
    spritePath: "/breaker-sprites-v2.png",
    appearanceAudit: {
      presentation: "大柄で重装の男性的表現",
      weaponMatch: "大型ハンマーと破砕役が一致",
      result: "表示名・体格・武器・役割と整合",
    },
    unlock: { type: "stage-clear", stageId: CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET },
  },
  {
    id: CAMPAIGN_UNIT_IDS.CRAZY_KING,
    combatKind: "crazy-king",
    displayName: "クレイジーキング",
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
    unlock: { type: "stage-clear", stageId: CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET },
  },
  {
    id: CAMPAIGN_UNIT_IDS.KUMAVERSON,
    combatKind: "kumaverson",
    displayName: "クマバーソン",
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
    unlock: { type: "stage-clear", stageId: CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE },
  },
  {
    id: CAMPAIGN_UNIT_IDS.BABAYAGA,
    combatKind: "babayaga",
    displayName: "ババヤガ",
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
    unlock: { type: "stage-clear", stageId: CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE },
  },
  {
    id: CAMPAIGN_UNIT_IDS.MAKABE_REINA,
    combatKind: "gunner",
    displayName: "真壁 玲奈",
    roleName: "制圧射手",
    roleIcon: "制",
    weaponName: "自動小銃",
    attackMode: "制圧連射",
    rangeBand: "中～遠距離",
    primaryTarget: "大型・密集群",
    deploymentHint: "火線を通せる後列へ配備",
    description: "自動小銃の連射で大型個体と密集群を制圧する",
    spritePath: "/gunner-sprites-v1.png",
    appearanceAudit: {
      presentation: "弾帯を着用した女性的表現",
      weaponMatch: "自動小銃と制圧射撃役が一致",
      result: "表示名・人物表現・武器・役割と整合",
    },
    unlock: { type: "stage-clear", stageId: CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE },
  },
]);

export const CAMPAIGN_GUIDE = deepFreeze({
  id: CAMPAIGN_GUIDE_ID,
  displayName: "水城 奈々",
  roleName: "通信・地図・情報分析",
  combatant: false,
  location: "移動拠点",
});

export const CAMPAIGN_CHARACTERS = deepFreeze([...CAMPAIGN_UNITS, CAMPAIGN_GUIDE]);
export const CAMPAIGN_UNIT_BY_ID = deepFreeze(Object.fromEntries(CAMPAIGN_UNITS.map((unit) => [unit.id, unit])));
export const UNIT_BY_ID = CAMPAIGN_UNIT_BY_ID;
export const INITIAL_UNIT_IDS = deepFreeze(CAMPAIGN_UNITS.filter((unit) => unit.unlock.type === "initial").map((unit) => unit.id));

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
    currencyName: "補給物資",
    baseReward: stage.baseReward,
    replayMultiplier,
    replayReward,
    newStarMilestones,
    firstTimeStarReward,
    totalReward: replayReward + firstTimeStarReward,
  };
}

export const calculateBattleRewards = calculateStageRewards;

export const CAMPAIGN_SAVE_SCHEMA_VERSION = 3;
export const SAVE_SCHEMA_VERSION = CAMPAIGN_SAVE_SCHEMA_VERSION;

export const DEFAULT_CAMPAIGN_SETTINGS = deepFreeze({
  bgmEnabled: true,
  sfxEnabled: true,
  bgmVolume: 0.75,
  sfxVolume: 0.8,
  reducedMotion: false,
});

export function createDefaultCampaignSave() {
  return {
    schemaVersion: CAMPAIGN_SAVE_SCHEMA_VERSION,
    campaignStarted: false,
    storyScriptVersion: STORY_SCRIPT_VERSION,
    readStoryEventIds: [],
    autoSkipReadStory: false,
    processedResultIds: [],
    completedStageIds: [],
    bestStarsByStage: {},
    claimedStarRewardsByStage: {},
    supplies: 0,
    unlockedStageIds: [INITIAL_STAGE_ID],
    unlockedUnitIds: [...INITIAL_UNIT_IDS],
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

function normalizeSettings(value) {
  const source = isRecord(value) ? value : {};
  const bgmLegacy = firstDefined(source, ["bgmEnabled", "bgm", "musicEnabled"], DEFAULT_CAMPAIGN_SETTINGS.bgmEnabled);
  const sfxLegacy = firstDefined(source, ["sfxEnabled", "sfx", "effectsEnabled"], DEFAULT_CAMPAIGN_SETTINGS.sfxEnabled);
  return {
    bgmEnabled: typeof bgmLegacy === "boolean" ? bgmLegacy : DEFAULT_CAMPAIGN_SETTINGS.bgmEnabled,
    sfxEnabled: typeof sfxLegacy === "boolean" ? sfxLegacy : DEFAULT_CAMPAIGN_SETTINGS.sfxEnabled,
    bgmVolume: clampNumber(source.bgmVolume, 0, 1, DEFAULT_CAMPAIGN_SETTINGS.bgmVolume),
    sfxVolume: clampNumber(source.sfxVolume, 0, 1, DEFAULT_CAMPAIGN_SETTINGS.sfxVolume),
    reducedMotion: typeof source.reducedMotion === "boolean" ? source.reducedMotion : DEFAULT_CAMPAIGN_SETTINGS.reducedMotion,
  };
}

function deriveUnlocks(completedStageIds, explicitStageIds = [], explicitUnitIds = []) {
  const completed = new Set(completedStageIds);
  const knownStageOrder = CAMPAIGN_STAGES.map((stage) => stage.id);
  const knownUnitOrder = CAMPAIGN_UNITS.map((unit) => unit.id);
  const knownStageIds = new Set(knownStageOrder);
  const knownUnitIds = new Set(knownUnitOrder);
  // A historical localhost QA save persisted exactly every current stage/unit
  // while recording no clears. Repair only that unambiguous shape. Legitimate
  // explicit unlocks and unknown future IDs remain durable migration data.
  const qaAllUnlockLeak = completedStageIds.length === 0
    && knownStageOrder.every((id) => explicitStageIds.includes(id))
    && knownUnitOrder.every((id) => explicitUnitIds.includes(id));
  const stages = new Set([INITIAL_STAGE_ID, ...(qaAllUnlockLeak ? [] : explicitStageIds), ...completedStageIds]);
  const units = new Set([...INITIAL_UNIT_IDS, ...(qaAllUnlockLeak ? [] : explicitUnitIds)]);
  for (const stageId of completed) {
    const stage = CAMPAIGN_STAGE_BY_ID[stageId];
    if (!stage) continue;
    for (const unlockedStageId of stage.nextUnlocks.stageIds) stages.add(unlockedStageId);
    for (const unlockedUnitId of stage.nextUnlocks.unitIds) units.add(unlockedUnitId);
  }
  const unlockedStageIds = [
    ...knownStageOrder.filter((id) => stages.has(id)),
    ...[...stages].filter((id) => !knownStageIds.has(id)),
  ];
  const unlockedUnitIds = [
    ...knownUnitOrder.filter((id) => units.has(id)),
    ...[...units].filter((id) => !knownUnitIds.has(id)),
  ];
  return { unlockedStageIds, unlockedUnitIds };
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
  const explicitUnitIds = uniqueStrings(firstDefined(source, ["unlockedUnitIds", "unlockedUnits"], []));
  const unlocks = deriveUnlocks(completedStageIds, explicitStageIds, explicitUnitIds);
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
    || clampInteger(firstDefined(source, ["supplies", "supply", "currency"], 0), 0, Number.MAX_SAFE_INTEGER, 0) > 0
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

  return {
    schemaVersion: CAMPAIGN_SAVE_SCHEMA_VERSION,
    campaignStarted,
    storyScriptVersion: STORY_SCRIPT_VERSION,
    readStoryEventIds,
    autoSkipReadStory: typeof autoSkipCandidate === "boolean" ? autoSkipCandidate : false,
    processedResultIds,
    completedStageIds,
    bestStarsByStage,
    claimedStarRewardsByStage,
    supplies: clampInteger(firstDefined(source, ["supplies", "supply", "currency"], 0), 0, Number.MAX_SAFE_INTEGER, 0),
    ...unlocks,
    lastSelectedStageId,
    settings: normalizeSettings(rawSettings),
  };
}

export function serializeCampaignSave(save) {
  try {
    return JSON.stringify(migrateCampaignSave(save));
  } catch {
    return JSON.stringify(createDefaultCampaignSave());
  }
}

export function deserializeCampaignSave(serialized) {
  if (typeof serialized !== "string") return migrateCampaignSave(serialized);
  try {
    return migrateCampaignSave(JSON.parse(serialized));
  } catch {
    return createDefaultCampaignSave();
  }
}

export function markStoryEventRead(save, eventId) {
  const current = migrateCampaignSave(save);
  const normalizedEventId = typeof eventId === "string" ? eventId.trim() : "";
  if (!normalizedEventId || current.readStoryEventIds.includes(normalizedEventId)) return current;
  return migrateCampaignSave({
    ...current,
    readStoryEventIds: [...current.readStoryEventIds, normalizedEventId],
  });
}

export function updateStoryPlaybackSettings(save, changes = {}) {
  const current = migrateCampaignSave(save);
  if (!isRecord(changes) || typeof changes.autoSkipReadStory !== "boolean") return current;
  return migrateCampaignSave({
    ...current,
    autoSkipReadStory: changes.autoSkipReadStory,
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
        currencyName: "補給物資",
        baseReward: stage.baseReward,
        replayMultiplier: 0,
        replayReward: 0,
        newStarMilestones: [],
        firstTimeStarReward: 0,
        totalReward: 0,
        newlyUnlockedStageIds: [],
        newlyUnlockedUnitIds: [],
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
  const unlocksBefore = deriveUnlocks(current.completedStageIds, current.unlockedStageIds, current.unlockedUnitIds);
  const unlocksAfter = deriveUnlocks(completedStageIds, current.unlockedStageIds, current.unlockedUnitIds);
  const newlyUnlockedStageIds = unlocksAfter.unlockedStageIds.filter((id) => !unlocksBefore.unlockedStageIds.includes(id));
  const newlyUnlockedUnitIds = unlocksAfter.unlockedUnitIds.filter((id) => !unlocksBefore.unlockedUnitIds.includes(id));

  const nextSave = migrateCampaignSave({
    ...current,
    campaignStarted: true,
    processedResultIds: [...current.processedResultIds, resultId],
    completedStageIds,
    bestStarsByStage: { ...current.bestStarsByStage, [stage.id]: bestStars },
    claimedStarRewardsByStage: { ...current.claimedStarRewardsByStage, [stage.id]: claimedAfter },
    supplies: current.supplies + rewards.totalReward,
    lastSelectedStageId: stage.id,
  });

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
      newlyUnlockedUnitIds,
      ...rewards,
    },
  };
}

export function markCampaignStarted(save) {
  const current = migrateCampaignSave(save);
  return current.campaignStarted ? current : { ...current, campaignStarted: true };
}

export function applyStageResult(save, stageIdOrResult, maybeResult) {
  return resolveStageResult(save, stageIdOrResult, maybeResult).save;
}

export function isStageUnlocked(save, stageId) {
  return migrateCampaignSave(save).unlockedStageIds.includes(stageId);
}

export function isUnitUnlocked(save, unitId) {
  return migrateCampaignSave(save).unlockedUnitIds.includes(unitId);
}

export function selectCampaignStage(save, stageId) {
  const current = migrateCampaignSave(save);
  if (!CAMPAIGN_STAGE_BY_ID[stageId] || !current.unlockedStageIds.includes(stageId)) return current;
  return { ...current, lastSelectedStageId: stageId };
}

export function updateCampaignSettings(save, settingsPatch) {
  const current = migrateCampaignSave(save);
  return {
    ...current,
    settings: normalizeSettings({ ...current.settings, ...(isRecord(settingsPatch) ? settingsPatch : {}) }),
  };
}
