import { CAMPAIGN_STAGE_BY_ID, CAMPAIGN_STAGE_IDS, INITIAL_STAGE_ID } from "./campaign.js";

export const LOCAL_QA_MODES = Object.freeze(["endgame", "roles", "supplies", "airstrike", "crawler", "loadout", "dialogue", "stress", "lifecycle"]);

export function resolveLocalQaMode(hostname, search = "") {
  if (hostname !== "localhost" && hostname !== "127.0.0.1") return null;
  const value = new URLSearchParams(search).get("qa");
  return LOCAL_QA_MODES.includes(value) ? value : null;
}

export const LOCAL_QA_SAFE_AREA_PRESETS = Object.freeze({
  "iphone-landscape": Object.freeze({ top: 0, right: 44, bottom: 21, left: 44 }),
});

export function resolveLocalQaSafeArea(hostname, search = "") {
  if (hostname !== "localhost" && hostname !== "127.0.0.1") return null;
  const values = new URLSearchParams(search).getAll("safe");
  if (values.length !== 1) return null;
  return LOCAL_QA_SAFE_AREA_PRESETS[values[0]] ?? null;
}

export const LOCAL_QA_CAMPAIGN_SCREENS = Object.freeze([
  "title",
  "intro",
  "map",
  "details",
  "formation",
  "result",
]);

export const LOCAL_QA_CAMPAIGN_STAGE_ALIASES = Object.freeze({
  1: CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET,
  2: CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE,
  3: CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE,
});

function isLocalQaHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function optionalSingleValue(params, key) {
  const values = params.getAll(key);
  if (values.length > 1) return { valid: false, value: null };
  return { valid: true, value: values.length === 1 ? values[0] : null };
}

function resolveCampaignStageId(value, fallback) {
  const candidate = value ?? fallback;
  if (LOCAL_QA_CAMPAIGN_STAGE_ALIASES[candidate]) return LOCAL_QA_CAMPAIGN_STAGE_ALIASES[candidate];
  return CAMPAIGN_STAGE_BY_ID[candidate] ? candidate : null;
}

function resolveQaStars(value, fallback = 0) {
  if (value === null) return fallback;
  return /^[0-3]$/.test(value) ? Number(value) : null;
}

/**
 * Resolves local-only campaign QA URLs without expanding the legacy battle QA
 * mode list. Every player-controlled value is mapped through a closed allowlist.
 */
export function resolveLocalQaScenario(hostname, search = "") {
  if (!isLocalQaHostname(hostname)) return null;
  const params = new URLSearchParams(search);
  const qaValues = params.getAll("qa");
  if (qaValues.length !== 1) return null;

  const qa = qaValues[0];
  const screenParam = optionalSingleValue(params, "screen");
  const stageParam = optionalSingleValue(params, "stage");
  const starsParam = optionalSingleValue(params, "stars");
  if (!screenParam.valid || !stageParam.valid || !starsParam.valid) return null;

  if (qa === "flow") {
    if (!LOCAL_QA_CAMPAIGN_SCREENS.includes(screenParam.value)) return null;
    const stageId = resolveCampaignStageId(stageParam.value, INITIAL_STAGE_ID);
    const stars = resolveQaStars(starsParam.value);
    if (!stageId || stars === null) return null;
    return { mode: "flow", screen: screenParam.value, stageId, stars };
  }

  if (qa === "defense") {
    if (screenParam.value !== null || starsParam.value !== null) return null;
    const stageId = resolveCampaignStageId(stageParam.value, CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE);
    if (stageId !== CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE) return null;
    return { mode: "defense", screen: "battle", stageId, stars: 0 };
  }

  return null;
}
