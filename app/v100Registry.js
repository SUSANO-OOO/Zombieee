import { deepFreeze } from "./content/freeze.js";

export const V100_VERSION = "1.0.0";
export const V100_DESIGN_ID = "V100-SOL-DL-001";
export const V100_DESIGN_REVISION = "r2";
export const V100_CAMPAIGN_NAMESPACE = "nishijin-campaign-v100";
export const V100_CAMPAIGN_GENERATION = "v100-new-campaign-1";
export const V100_LEGACY_NAMESPACE = "nishijin-campaign-v1";
export const V100_FORMATION_MAX_SLOTS = 7;
export const V100_DEFAULT_PLAYER_NAME = "指揮官";

export const V100_LEGACY_SETTINGS_WHITELIST = deepFreeze([
  "bgmEnabled",
  "sfxEnabled",
  "bgmVolume",
  "sfxVolume",
  "reducedMotion",
  "battleEventMode",
  "graphicsQuality",
  "autoSkipReadStory",
]);

export const V100_STAGE_IDS = deepFreeze([
  "stage-nishijin-shopping-street",
  "stage-sawara-ward-office",
  "stage-nishijin-defense-line-takuya",
  "stage-nishijin-station-gate",
  "stage-nishijin-station-platform",
  "stage-nishijin-station-tunnel-seal",
  "stage-university-hospital-approach",
  "stage-hospital-emergency-ward",
  "stage-hospital-evacuation-route",
  "stage-research-access",
  "stage-research-containment",
  "stage-research-freight-passage",
  "stage-logistics-relay",
  "stage-evacuation-freight-yard",
  "stage-t-plan-outer-core",
  "stage-t-plan-central-seal",
  "stage-bay-tower-service",
  "stage-civic-archive-route",
  "stage-coastal-link-bridge",
  "stage-estuary-floodgate-seal",
  "stage-mugarian-logistics-hq",
  "stage-mugarian-clinical-trial-wing",
  "stage-mugarian-special-operations-armory",
  "stage-mugarian-tech-tower",
  "stage-mugarian-executive-lab",
  "stage-bay-evacuation-yard",
  "stage-segawa-private-lab",
  "stage-national-dispersal-network",
  "stage-segawa-research-core",
  "stage-nishijin-defense-line-takuya-omega",
]);

export const V100_STAGE_NAMES = deepFreeze([
  "西新商店街・薬局救出",
  "早良区役所・最後の一台",
  "西新防衛線・TAKUYA",
  "西新駅・閉鎖改札",
  "西新駅・地下ホーム",
  "西新駅・保守トンネル",
  "大学病院・救急搬入口",
  "大学病院・救急病棟",
  "大学病院・地下機械室",
  "地下研究区画・除染ゲート",
  "地下研究区画・検体隔離区画",
  "地下研究区画・搬送坑道",
  "物流線・中継ヤード",
  "物流線・貨物退避場",
  "T計画・外郭制御区",
  "T計画・中央封鎖区",
  "湾岸タワー・非常回廊",
  "市民資料館・避難者台帳",
  "海浜連絡橋・七秒",
  "河口防潮門・帰れる道",
  "ムガリアン物流本部",
  "ムガリアン臨床試験棟",
  "ムガリアン特殊作戦庫・二つの顔",
  "ムガリアン技術開発塔",
  "ムガリアン役員研究所・市場の終わり",
  "湾岸撤収ヤード・観測対象",
  "セガワ私設研究区画・RED PANTHER",
  "全国散布管制網・次の街",
  "セガワ特級研究中枢・原株",
  "西新防衛線・TAKUYA-Ω",
]);

const STAGE_ROWS = [
  ["assault", "A", "STREET", "infected-base-pharmacy-rescue", "unit-nao"],
  ["timed-defense", "A+abomination", "STREET", "evacuation-perimeter-90s", "unit-mizuchi", "support-healing"],
  ["boss", "A+shade/abomination", "STREET", "boss-arena", "boss-takuya"],
  ["assault", "A+grappler", "STATION", "destructible-seal-base", "unit-monkey"],
  ["boss", "A+ooze/sprinter", "STATION", "sound-lure-seal-boss-arena", "unit-crazy-king", "boss-gate-eater", "level-cap-10"],
  ["escort", "B", "STATION", "maintenance-cart-destination", "unit-raider", "support-explosive-drum"],
  ["timed-defense", "B", "MEDICAL", "medicine-transfer-perimeter-85s", "unit-tatara"],
  ["assault", "B", "MEDICAL", "infected-base", "unit-gantetsu"],
  ["power", "B", "MEDICAL", "three-power-nodes", "support-incendiary-drum"],
  ["assault", "C", "LAB", "decontamination-access-seal", "unit-mayo-chan", "level-cap-15"],
  ["boss", "C", "LAB", "specimen-isolation-supply-pipes", "boss-mother"],
  ["escort", "B+shade", "LAB", "sealed-transport-destination", "unit-zakimiya"],
  ["assault", "C", "LAB", "logistics-relay-drug-warehouse", "none"],
  ["boss", "C", "LAB", "three-couplers-boss-arena", "unit-tky", "boss-ooguchi"],
  ["power", "C", "LAB", "three-power-nodes", "level-cap-20"],
  ["seal", "C", "LAB", "three-seal-nodes", "none"],
  ["boss", "D", "BAY", "boss-arena", "unit-mrs-chiha", "boss-kurome"],
  ["timed-defense", "D", "BAY", "records-evacuation-perimeter-95s", "none"],
  ["escort", "D", "BAY", "evidence-convoy-destination", "none"],
  ["boss", "D", "BAY", "control-seal-boss-arena", "unit-miyamoto-musashi", "level-cap-25", "boss-gairen"],
  ["assault", "D+panther-knife/smg", "CORPORATE", "lure-controller-base", "none"],
  ["timed-defense", "D+panther-shield/smg", "CORPORATE", "43-cell-rescue-records-perimeter-100s", "none"],
  ["assault", "P", "CORPORATE", "command-vehicle-auth-key-base", "none"],
  ["boss", "panther-shield/commander", "CORPORATE", "central-controller-twin-arena", "boss-futago"],
  ["boss", "P", "CORPORATE", "medical-equipment-boss-arena", "level-cap-30", "boss-mugarian-president-mutated"],
  ["escort", "D+panther-smg/commander", "CORPORATE", "three-refrigerated-trucks-destination", "none"],
  ["assault", "P", "CORPORATE", "lab-seal-base", "none"],
  ["power", "D+panther-shield/smg/commander", "FINAL", "four-dispersal-nodes", "none"],
  ["assault", "P", "FINAL", "overseas-activation-source-stock", "none", "omega-post-story-only"],
  ["boss", "A-add-waves", "FINAL", "stage-3-damage-dawn-safe-corridor", "boss-takuya-omega", "ending-credits-epilogue"],
];

export const V100_STAGES = deepFreeze(V100_STAGE_IDS.map((id, index) => {
  const [missionType, enemyPack, audioProfile, objectiveId, ...payload] = STAGE_ROWS[index];
  return {
    id,
    number: index + 1,
    displayName: V100_STAGE_NAMES[index],
    prerequisiteStageId: index === 0 ? null : V100_STAGE_IDS[index - 1],
    missionType,
    enemyPack,
    audioProfile,
    objectiveId,
    firstClearPayload: payload,
    eventIds: {
      pre: `v100:event:s${String(index + 1).padStart(2, "0")}:pre`,
      post: `v100:event:s${String(index + 1).padStart(2, "0")}:post`,
      firstClearPost: `v100:event:s${String(index + 1).padStart(2, "0")}:first-clear-post`,
    },
    receipts: {
      firstClear: `v100:s${String(index + 1).padStart(2, "0")}:first-clear`,
      star2: `v100:s${String(index + 1).padStart(2, "0")}:star:2`,
      star3: `v100:s${String(index + 1).padStart(2, "0")}:star:3`,
    },
  };
}));

export const V100_STAGE_BY_ID = deepFreeze(Object.fromEntries(V100_STAGES.map((stage) => [stage.id, stage])));

export const V100_UNIT_IDS = deepFreeze({
  HACHI: "unit-hachi",
  PAISEN: "unit-paisen",
  KUMAVERSON: "unit-kumaverson",
  BABAYAGA: "unit-babayaga",
  NAO: "unit-nao",
  MIZUCHI: "unit-mizuchi",
  MONKEY: "unit-monkey",
  CRAZY_KING: "unit-crazy-king",
  RAIDER: "unit-raider",
  TATARA: "unit-tatara",
  GANTETSU: "unit-gantetsu",
  MAYO_CHAN: "unit-mayo-chan",
  ZAKIMIYA: "unit-zakimiya",
  TKY: "unit-tky",
  MRS_CHIHA: "unit-mrs-chiha",
  MIYAMOTO_MUSASHI: "unit-miyamoto-musashi",
});

const UNIT_ROWS = [
  ["HACHI", "ハチ", "skirmisher", 0, "initial"],
  ["PAISEN", "パイセン", "frontline", 0, "initial"],
  ["KUMAVERSON", "クマバーソン", "heavy", 0, "initial"],
  ["BABAYAGA", "ババヤガ", "marksman", 0, "initial"],
  ["NAO", "ナオ", "support", 80, 1],
  ["MIZUCHI", "ミズチ", "suppression", 100, 2],
  ["MONKEY", "モンキー", "engineer", 110, 4],
  ["CRAZY_KING", "クレイジーキング", "frontline", 120, 5],
  ["RAIDER", "レイダー", "suppression", 130, 6],
  ["TATARA", "タタラ", "heavy", 145, 7],
  ["GANTETSU", "ガンテツ", "heavy", 150, 8],
  ["MAYO_CHAN", "マヨちゃん", "skirmisher", 160, 10],
  ["ZAKIMIYA", "ザキミヤ", "frontline", 175, 12],
  ["TKY", "TKY", "skirmisher", 190, 14],
  ["MRS_CHIHA", "Mrs.チハ", "marksman", 210, 17],
  ["MIYAMOTO_MUSASHI", "宮本武蔵", "frontline", 230, 20],
];

export const V100_UNITS = deepFreeze(UNIT_ROWS.map(([key, displayName, role, costCaps, availability]) => ({
  id: V100_UNIT_IDS[key],
  displayName,
  role,
  registrationCostCaps: costCaps,
  availabilityStageNumber: availability === "initial" ? 0 : availability,
  initial: availability === "initial",
  registrationReceipt: availability === "initial" ? null : `v100:s${String(availability).padStart(2, "0")}:unit:${V100_UNIT_IDS[key]}:register`,
})));

export const V100_UNIT_BY_ID = deepFreeze(Object.fromEntries(V100_UNITS.map((unit) => [unit.id, unit])));
export const V100_INITIAL_UNIT_IDS = deepFreeze(V100_UNITS.filter((unit) => unit.initial).map((unit) => unit.id));

export const V100_LEVEL_CAP_MILESTONES = deepFreeze([
  { clearedStageNumber: 0, levelCap: 5 },
  { clearedStageNumber: 5, levelCap: 10 },
  { clearedStageNumber: 10, levelCap: 15 },
  { clearedStageNumber: 15, levelCap: 20 },
  { clearedStageNumber: 20, levelCap: 25 },
  { clearedStageNumber: 25, levelCap: 30 },
]);

export const V100_LEVEL_COSTS = deepFreeze([
  10, 12, 14, 16, 18, 20, 22, 24, 26, 30,
  34, 38, 42, 46, 52, 58, 64, 70, 76, 84,
  92, 100, 108, 116, 126, 138, 150, 162, 174,
]);

export const V100_SUPPORTS = deepFreeze([
  {
    id: "support-healing",
    displayName: "回復支援",
    unlockStageNumber: 2,
    unlockReceipt: "v100:s02:support-healing:unlock",
    unlockCostCaps: 50,
    battleCost: 50,
    cooldownSeconds: 25,
  },
  {
    id: "support-explosive-drum",
    displayName: "爆薬ドラム缶",
    unlockStageNumber: 6,
    unlockReceipt: "v100:s06:support-explosive-drum:unlock",
    unlockCostCaps: 40,
    battleCost: 40,
    cooldownSeconds: 20,
  },
  {
    id: "support-incendiary-drum",
    displayName: "火炎ドラム缶",
    unlockStageNumber: 9,
    unlockReceipt: "v100:s09:support-incendiary-drum:unlock",
    unlockCostCaps: 55,
    battleCost: 55,
    cooldownSeconds: 28,
  },
]);

export const V100_VEHICLE = deepFreeze({
  id: "armored-vehicle",
  displayName: "装甲車両",
  baseHp: 680,
  hpPerUpgrade: 80,
  maxUpgradeLevel: 5,
  upgradeCosts: [120, 180, 260, 360, 480],
  abilities: [
    { id: "vehicle-barrage", displayName: "一斉砲撃", battleCost: 70, cooldownSeconds: 38 },
    { id: "vehicle-airstrike", displayName: "航空支援", battleCost: 85, cooldownSeconds: 50 },
  ],
});

const BOSS_ROWS = [
  ["boss-takuya", "TAKUYA", 3, 1600, 34, 1.25, [0.70, 0.35], "2 adds", 45, 110, 20],
  ["boss-gate-eater", "改札喰い", 5, 2100, 30, 1.40, [0.75, 0.40], "3 adds", 55, 130, 25],
  ["boss-mother", "MOTHER", 11, 2800, 28, 1.10, [0.70, 0.40], "brood 4/6", 60, 190, 40],
  ["boss-ooguchi", "オオグチ", 14, 3400, 42, 1.55, [0.75, 0.45], "charge", 65, 220, 45],
  ["boss-kurome", "クロメ", 17, 4100, 34, 0.90, [0.70, 0.35], "clones", 70, 250, 50],
  ["boss-gairen", "ガイレン", 20, 4700, 48, 1.65, [0.75, 0.45], "shell cycle", 72, 280, 55],
  ["boss-futago", "フタゴ", 24, 3000, 36, 1.00, ["twin state"], "survivor enrages", 75, 320, 65],
  ["boss-mugarian-president-mutated", "変異ムガリアン社長", 25, 6200, 44, 1.20, [0.70, 0.35], "four-arm form", 80, 330, 65],
  ["boss-takuya-omega", "TAKUYA-Ω", 30, 9200, 56, 1.35, [0.75, 0.45, 0.20], "2 add waves", 85, 380, 75],
];

export const V100_BOSSES = deepFreeze(BOSS_ROWS.map(([id, displayName, stageNumber, hp, damage, cadenceSeconds, phaseThresholds, special, resistance, firstRewardCaps, repeatRewardCaps]) => ({
  id,
  displayName,
  stageNumber,
  hp,
  damage,
  cadenceSeconds,
  phaseThresholds,
  special,
  resistance,
  firstStoryRewardCaps: firstRewardCaps,
  repeatStoryRewardCaps: repeatRewardCaps,
  firstDefeatReceipt: `v100:s${String(stageNumber).padStart(2, "0")}:${id}:first-defeat`,
  compendiumId: `compendium:${id}`,
  outbreakId: `outbreak:${id}`,
  survivalId: `survival:${id}`,
})));

export const V100_BOSS_BY_ID = deepFreeze(Object.fromEntries(V100_BOSSES.map((boss) => [boss.id, boss])));

export const V100_EVENT_IDS = deepFreeze([
  "v100:event:prologue",
  ...V100_STAGE_IDS.flatMap((_, index) => {
    const stage = String(index + 1).padStart(2, "0");
    return [`v100:event:s${stage}:pre`, `v100:event:s${stage}:post`, `v100:event:s${stage}:first-clear-post`];
  }),
  "v100:event:ending",
  "v100:event:credits",
  "v100:event:epilogue",
]);

export const V100_EVENT_BY_ID = deepFreeze(Object.fromEntries(V100_EVENT_IDS.map((id) => [id, {
  id,
  kind: id === "v100:event:credits" ? "credits" : id.includes(":pre") || id === "v100:event:prologue" ? "story" : "post-result",
  stageNumber: /^v100:event:s(\d{2}):/.exec(id)?.[1] ? Number(/^v100:event:s(\d{2}):/.exec(id)[1]) : null,
}])));

export const V100_LEGACY_GIFT = deepFreeze({
  amountCaps: 180,
  entitlementReceipt: "v100:release-gift:legacy-180:v1",
  popupReceipt: "v100:release-gift:legacy-180:popup:v1",
});

export function v100StageNumberFor(stageId) {
  return V100_STAGE_BY_ID[stageId]?.number ?? 0;
}

export function v100StageFor(stageId) {
  return V100_STAGE_BY_ID[stageId] ?? null;
}

export function v100BossForStage(stageNumber) {
  return V100_BOSSES.find((boss) => boss.stageNumber === Number(stageNumber)) ?? null;
}

export function v100UnitFor(unitId) {
  return V100_UNIT_BY_ID[unitId] ?? null;
}

export function v100SupportFor(supportId) {
  return V100_SUPPORTS.find((support) => support.id === supportId) ?? null;
}

export function v100LevelCapForStage(stageNumber) {
  const number = Math.max(0, Math.floor(Number(stageNumber) || 0));
  return V100_LEVEL_CAP_MILESTONES.reduce((cap, milestone) => number >= milestone.clearedStageNumber ? milestone.levelCap : cap, 5);
}

export function v100LevelCost(nextLevel) {
  const level = Math.floor(Number(nextLevel) || 0);
  return level >= 2 && level <= 30 ? V100_LEVEL_COSTS[level - 2] : 0;
}

function isWellFormedUnicode(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xDC00 && next <= 0xDFFF)) return false;
      index += 1;
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      return false;
    }
  }
  return true;
}

export function normalizeV100PlayerName(value) {
  if (typeof value !== "string" || !isWellFormedUnicode(value)) return { ok: false, reason: "invalid-characters", value: V100_DEFAULT_PLAYER_NAME };
  const normalized = value.normalize("NFC").replace(/^[\u0020\u3000]+|[\u0020\u3000]+$/gu, "").replace(/[\u0020\u3000]+/gu, " ");
  if (!normalized) return { ok: true, skipped: true, value: V100_DEFAULT_PLAYER_NAME };
  if (/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\u202A-\u202E\u2066-\u2069\uFEFF]/u.test(normalized)) {
    return { ok: false, reason: "invalid-characters", value: V100_DEFAULT_PLAYER_NAME };
  }
  const segments = typeof Intl?.Segmenter === "function"
    ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(normalized)].map((entry) => entry.segment)
    : Array.from(normalized);
  if (segments.length < 1 || segments.length > 12) return { ok: false, reason: "too-long", value: V100_DEFAULT_PLAYER_NAME, graphemeCount: segments.length };
  return { ok: true, skipped: false, value: normalized, graphemeCount: segments.length };
}

export function escapeV100Html(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[character]));
}

export function renderV100PlayerName(text, playerName) {
  const normalized = normalizeV100PlayerName(playerName);
  const safeName = escapeV100Html(normalized.ok ? normalized.value : V100_DEFAULT_PLAYER_NAME);
  return String(text).replace(/\{\{PLAYER_NAME\}\}/gu, safeName);
}

export function v100StarsForVehicle({ won = false, vehicleHp = 0, vehicleMaxHp = V100_VEHICLE.baseHp } = {}) {
  if (won !== true || Number(vehicleHp) <= 0 || Number(vehicleMaxHp) <= 0) return 0;
  const ratio = Number(vehicleHp) / Number(vehicleMaxHp);
  return ratio >= 0.90 ? 3 : ratio >= 0.70 ? 2 : 1;
}

function roundToFive(value) {
  return Math.max(0, Math.round(value / 5) * 5);
}

export function v100StageReward(stageNumber, kind = "first-clear") {
  const number = Math.max(1, Math.min(30, Math.floor(Number(stageNumber) || 1)));
  if (kind === "first-clear") return 80 + number * 10;
  if (kind === "star:2") return 15 + 5 * Math.floor((number - 1) / 5);
  if (kind === "star:3") return 25 + 5 * Math.floor((number - 1) / 5);
  if (kind === "replay") return Math.max(20, roundToFive((80 + number * 10) * 0.20));
  return 0;
}

export const V100_STAGE_REWARD_TOTAL = V100_STAGES.reduce((sum, stage) => sum
  + v100StageReward(stage.number, "first-clear")
  + v100StageReward(stage.number, "star:2")
  + v100StageReward(stage.number, "star:3"), 0);

export function v100UnitStatAtLevel(baseValue, level, mode = "base") {
  const safeLevel = Math.max(1, Math.min(30, Math.floor(Number(level) || 1)));
  const multiplier = mode === "hp" ? 1 + 0.025 * (safeLevel - 1) : 1 + 0.02 * (safeLevel - 1);
  return Math.round(Number(baseValue) * multiplier);
}
