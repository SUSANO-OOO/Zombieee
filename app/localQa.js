import { CAMPAIGN_STAGE_BY_ID, CAMPAIGN_STAGE_IDS, INITIAL_STAGE_ID } from "./campaign.js";
import { COMMAND_INITIAL, COMMAND_MAX, COMMAND_REGEN } from "./gameRules.js";
import { STORY_EVENT_IDS } from "./storyEvents.js";

export const LOCAL_QA_MODES = Object.freeze(["endgame", "ai-reacquire", "roles", "supplies", "airstrike", "crawler", "loadout", "dialogue", "stress", "lifecycle", "barks", "sprites"]);

export function resolveLocalQaMode(hostname, search = "") {
  if (hostname !== "localhost" && hostname !== "127.0.0.1") return null;
  const value = new URLSearchParams(search).get("qa");
  return LOCAL_QA_MODES.includes(value) ? value : null;
}

/**
 * Deterministically measures the battle command economy without running a
 * browser clock. Deployment attempts are processed in chronological order;
 * equal-time attempts retain their input order so burst deployment is
 * measurable and repeatable in CI.
 */
export function measureCommandEconomy({
  durationSeconds = 0,
  deployments = [],
  initialCommand = COMMAND_INITIAL,
  commandMax = COMMAND_MAX,
  regenPerSecond = COMMAND_REGEN,
} = {}) {
  const duration = Math.max(0, Number(durationSeconds) || 0);
  const maximum = Math.max(0, Number(commandMax) || 0);
  const regeneration = Math.max(0, Number(regenPerSecond) || 0);
  let command = Math.max(0, Math.min(maximum, Number(initialCommand) || 0));
  let at = 0;
  let cappedSeconds = 0;
  let overflowCommand = 0;
  let spentCommand = 0;
  const attempts = [];

  const advanceTo = (nextAt) => {
    const boundedAt = Math.max(at, Math.min(duration, nextAt));
    const elapsed = boundedAt - at;
    if (elapsed <= 0) return;
    if (command >= maximum || regeneration === 0) {
      if (command >= maximum) {
        cappedSeconds += elapsed;
        overflowCommand += elapsed * regeneration;
      }
      at = boundedAt;
      return;
    }
    const capacity = maximum - command;
    const generated = elapsed * regeneration;
    if (generated >= capacity) {
      const secondsToCap = capacity / regeneration;
      cappedSeconds += elapsed - secondsToCap;
      overflowCommand += generated - capacity;
      command = maximum;
    } else {
      command += generated;
    }
    at = boundedAt;
  };

  const orderedDeployments = Array.isArray(deployments)
    ? deployments
      .map((deployment, index) => ({ ...deployment, index }))
      .filter((deployment) => Number.isFinite(deployment.at) && deployment.at >= 0 && deployment.at <= duration)
      .sort((left, right) => left.at - right.at || left.index - right.index)
    : [];

  for (const deployment of orderedDeployments) {
    advanceTo(deployment.at);
    const cost = Math.max(0, Number(deployment.cost) || 0);
    const commandBefore = command;
    const deployed = command >= cost;
    if (deployed) {
      command -= cost;
      spentCommand += cost;
    }
    attempts.push(Object.freeze({
      id: deployment.id ?? `attempt-${deployment.index + 1}`,
      at: deployment.at,
      cost,
      deployed,
      commandBefore,
      commandAfter: command,
    }));
  }
  advanceTo(duration);

  const successfulAttempts = attempts.filter((attempt) => attempt.deployed);
  const generatedCommand = duration * regeneration;
  return Object.freeze({
    durationSeconds: duration,
    initialCommand: Math.max(0, Math.min(maximum, Number(initialCommand) || 0)),
    commandMax: maximum,
    regenPerSecond: regeneration,
    finalCommand: command,
    generatedCommand,
    spentCommand,
    overflowCommand,
    overflowRate: generatedCommand > 0 ? overflowCommand / generatedCommand : 0,
    cappedSeconds,
    firstDeploymentSeconds: successfulAttempts[0]?.at ?? null,
    successfulDeployments: successfulAttempts.length,
    failedDeployments: attempts.length - successfulAttempts.length,
    attempts: Object.freeze(attempts),
  });
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
  4: CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE,
  5: CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM,
  6: CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL,
});

export const LOCAL_QA_STATION_STATES = Object.freeze([
  "start",
  "near-win",
  "near-loss",
]);

const LOCAL_QA_STATION_STAGE_ALIASES = Object.freeze({
  4: CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE,
  5: CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM,
  6: CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL,
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
  const eventParam = optionalSingleValue(params, "event");
  const stateParam = optionalSingleValue(params, "state");
  if (!screenParam.valid || !stageParam.valid || !starsParam.valid || !eventParam.valid || !stateParam.valid) return null;

  if (qa === "flow") {
    if (eventParam.value !== null || stateParam.value !== null) return null;
    if (!LOCAL_QA_CAMPAIGN_SCREENS.includes(screenParam.value)) return null;
    const stageId = resolveCampaignStageId(stageParam.value, INITIAL_STAGE_ID);
    const stars = resolveQaStars(starsParam.value);
    if (!stageId || stars === null) return null;
    return { mode: "flow", screen: screenParam.value, stageId, stars };
  }

  if (qa === "defense") {
    if (screenParam.value !== null || starsParam.value !== null || eventParam.value !== null || stateParam.value !== null) return null;
    const stageId = resolveCampaignStageId(stageParam.value, CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE);
    if (stageId !== CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE) return null;
    return { mode: "defense", screen: "battle", stageId, stars: 0 };
  }

  if (qa === "story") {
    if (screenParam.value !== null || stageParam.value !== null || starsParam.value !== null || stateParam.value !== null) return null;
    if (!eventParam.value || !STORY_EVENT_IDS.includes(eventParam.value)) return null;
    return { mode: "story", screen: "event", stageId: INITIAL_STAGE_ID, stars: 0, eventId: eventParam.value };
  }

  if (qa === "station") {
    if (screenParam.value !== null || starsParam.value !== null || eventParam.value !== null) return null;
    const stageId = stageParam.value === null
      ? null
      : LOCAL_QA_STATION_STAGE_ALIASES[stageParam.value] ?? null;
    if (!stageId || !LOCAL_QA_STATION_STATES.includes(stateParam.value)) return null;
    return { mode: "station", screen: "battle", stageId, stars: 0, state: stateParam.value };
  }

  return null;
}
