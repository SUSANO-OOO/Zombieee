export const BATTLE_BARK_CONFIG = Object.freeze({
  maxVisible: 2,
  defaultDuration: 1.8,
  globalCooldown: .8,
  speakerCooldown: 3.5,
  duplicateCooldown: 8,
  defaultProbability: 1,
  defaultWeight: 1,
});

/**
 * @typedef {{
 *   id: string,
 *   trigger: string,
 *   speakerKind?: string,
 *   speaker: string,
 *   text: string,
 *   duration?: number,
 *   priority: number,
 *   probability?: number,
 *   weight?: number,
 *   tone?: string,
 *   cooldown?: number,
 * }} BattleBarkLine
 * @typedef {{
 *   id: string,
 *   lineId: string,
 *   trigger: string,
 *   speakerId: string,
 *   speakerKind: string,
 *   speaker: string,
 *   text: string,
 *   remaining: number,
 *   priority: number,
 *   sequence: number,
 *   tone: string,
 * }} BattleBark
 * @typedef {{
 *   clock: number,
 *   sequence: number,
 *   active: BattleBark[],
 *   globalReadyAt: number,
 *   speakerReadyAt: Record<string, number>,
 *   lineReadyAt: Record<string, number>,
 * }} BattleBarkRuntime
 * @typedef {{trigger: string, speakerKind: string, speakerId?: string | number}} BattleBarkEvent
 */

// Producer-approved dialogue can be added here without changing runtime code.
// Normal play intentionally ships with no placeholder or personality copy.
export const APPROVED_BATTLE_BARK_LINES = /** @type {readonly BattleBarkLine[]} */ (Object.freeze([]));

// These diagnostic labels are only selected by localhost-only QA routes.
export const LOCAL_QA_BATTLE_BARK_LINES = /** @type {readonly BattleBarkLine[]} */ (Object.freeze([
  ...["scout", "ranger", "brute", "brawler", "gunner", "medic"].map((speakerKind, index) => Object.freeze({
    id: `qa-role-${speakerKind}`,
    trigger: "role-cue",
    speakerKind,
    speaker: speakerKind === "brute" ? "BREAKER" : speakerKind.toUpperCase(),
    text: `QA // ${speakerKind === "brute" ? "BREAKER" : speakerKind.toUpperCase()} ROLE CUE`,
    duration: 1.7,
    priority: 20 + index,
    probability: 1,
    weight: 1,
    tone: "qa",
  })),
  Object.freeze({ id: "qa-crawler-critical", trigger: "crawler-critical", speakerKind: "crawler", speaker: "CRAWLER", text: "QA // CRAWLER CRITICAL", duration: 2, priority: 90, probability: 1, weight: 1, tone: "qa" }),
  Object.freeze({ id: "qa-takuya-down", trigger: "takuya-down", speakerKind: "crawler", speaker: "TACTICAL", text: "QA // TAKUYA DOWN", duration: 1.9, priority: 95, probability: 1, weight: 1, tone: "qa" }),
  Object.freeze({ id: "qa-base-exposed", trigger: "base-exposed", speakerKind: "crawler", speaker: "TACTICAL", text: "QA // ENEMY BASE EXPOSED", duration: 1.9, priority: 96, probability: 1, weight: 1, tone: "qa" }),
  Object.freeze({ id: "qa-victory", trigger: "victory", speakerKind: "crawler", speaker: "TACTICAL", text: "QA // MISSION COMPLETE", duration: 2, priority: 100, probability: 1, weight: 1, tone: "qa" }),
]));

/** @returns {BattleBarkRuntime} */
export function createBattleBarkRuntime() {
  return {
    clock: 0,
    sequence: 0,
    active: [],
    globalReadyAt: 0,
    speakerReadyAt: {},
    lineReadyAt: {},
  };
}

/**
 * @param {BattleBarkRuntime} runtime
 * @param {number} seconds
 * @returns {BattleBarkRuntime}
 */
export function advanceBattleBarkRuntime(runtime, seconds) {
  const elapsed = Math.max(0, Number(seconds) || 0);
  const clock = runtime.clock + elapsed;
  return {
    ...runtime,
    clock,
    active: runtime.active
      .map((bark) => ({ ...bark, remaining: Math.max(0, bark.remaining - elapsed) }))
      .filter((bark) => bark.remaining > 0),
  };
}

/** @param {BattleBarkLine} line @param {BattleBarkEvent} event */
function lineMatches(line, event) {
  return line.trigger === event.trigger && (!line.speakerKind || line.speakerKind === event.speakerKind);
}

export function battleBarkPassesProbability(probability = BATTLE_BARK_CONFIG.defaultProbability, roll = Math.random()) {
  const chance = Math.max(0, Math.min(1, Number(probability) || 0));
  const normalizedRoll = Math.max(0, Math.min(1, Number(roll) || 0));
  return normalizedRoll < chance;
}

/**
 * @param {{runtime: BattleBarkRuntime, event: BattleBarkEvent, qa?: boolean, random?: () => number}} input
 * @returns {{shown: boolean, reason?: string, runtime: BattleBarkRuntime, bark?: BattleBark}}
 */
export function queueBattleBark({ runtime, event, qa = false, random = Math.random }) {
  const catalog = qa ? LOCAL_QA_BATTLE_BARK_LINES : APPROVED_BATTLE_BARK_LINES;
  const candidates = catalog.filter((line) => lineMatches(line, event)).sort((a, b) => b.priority - a.priority || (b.weight ?? BATTLE_BARK_CONFIG.defaultWeight) - (a.weight ?? BATTLE_BARK_CONFIG.defaultWeight) || a.id.localeCompare(b.id));
  if (!candidates.length) return { shown: false, reason: "no-approved-line", runtime };

  let reason = "lower-priority";
  for (const line of candidates) {
    const speakerId = String(event.speakerId ?? event.speakerKind ?? line.speaker);
    const duplicateActive = runtime.active.some((bark) => bark.lineId === line.id || (bark.speakerId === speakerId && bark.trigger === event.trigger));
    if (duplicateActive) { reason = "duplicate-active"; continue; }
    if ((runtime.lineReadyAt[line.id] ?? 0) > runtime.clock) { reason = "line-cooldown"; continue; }
    if ((runtime.speakerReadyAt[speakerId] ?? 0) > runtime.clock) { reason = "speaker-cooldown"; continue; }
    if (runtime.globalReadyAt > runtime.clock && line.priority < 90) { reason = "global-cooldown"; continue; }
    if (!battleBarkPassesProbability(line.probability, random())) { reason = "probability"; continue; }

    const sequence = runtime.sequence + 1;
    /** @type {BattleBark} */
    const bark = {
      id: `${line.id}:${sequence}`,
      lineId: line.id,
      trigger: event.trigger,
      speakerId,
      speakerKind: event.speakerKind,
      speaker: line.speaker,
      text: line.text,
      remaining: line.duration ?? BATTLE_BARK_CONFIG.defaultDuration,
      priority: line.priority,
      sequence,
      tone: line.tone ?? "neutral",
    };
    const ranked = [...runtime.active, bark]
      .sort((a, b) => b.priority - a.priority || b.sequence - a.sequence)
      .slice(0, BATTLE_BARK_CONFIG.maxVisible);
    if (!ranked.some((active) => active.id === bark.id)) { reason = "lower-priority"; continue; }

    const active = ranked.sort((a, b) => a.sequence - b.sequence);
    return {
      shown: true,
      bark,
      runtime: {
        ...runtime,
        sequence,
        active,
        globalReadyAt: runtime.clock + BATTLE_BARK_CONFIG.globalCooldown,
        speakerReadyAt: { ...runtime.speakerReadyAt, [speakerId]: runtime.clock + BATTLE_BARK_CONFIG.speakerCooldown },
        lineReadyAt: { ...runtime.lineReadyAt, [line.id]: runtime.clock + (line.cooldown ?? BATTLE_BARK_CONFIG.duplicateCooldown) },
      },
    };
  }
  return { shown: false, reason, runtime };
}
