import { STORY_EVENTS } from "./storyEvents.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function uniqueStrings(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry) => typeof entry === "string" && entry.length > 0))];
}

/**
 * Runtime integration emits these exact trigger IDs when the corresponding
 * battle transition is observed. The story event metadata remains the owner of
 * speaker, line, deployment and mandatory-alert details.
 */
export const STORY_BATTLE_TRIGGER_IDS = deepFreeze({
  DEPLOY: "deploy",
  FAST_ENEMY: "fast-enemy",
  FRONTLINE_OPEN: "frontline-open",
  GROUPED_ENEMIES: "grouped-enemies",
  CONVOY_START: "convoy-start",
  HEAVY_ENEMY: "heavy-enemy",
  DEFENSE_30_REMAINING: "defense-30-remaining",
  CONVOY_CRITICAL: "convoy-critical",
  TAKUYA_ENTRANCE: "takuya-entrance",
  TAKUYA_APPROACH: "takuya-approach",
  RIGHT_SHOULDER_EXPOSED: "right-shoulder-exposed",
  KUMAVERSON_CRITICAL: "kumaverson-critical",
  FINAL_WEAKPOINT_EXPOSED: "final-weakpoint-exposed",
  BOSS_DEFEATED_BASE_REMAINS: "boss-defeated-base-remains",
  GRAPPLER_SEEN: "grappler-seen",
  GRAPPLER_GRAB: "grappler-grab",
  CONTAINER_EXPOSED: "container-exposed",
  OOZE_SEEN: "ooze-seen",
  SPRINTER_SEEN: "sprinter-seen",
  CART_STALLED: "cart-stalled",
  POWER_1_ACTIVATED: "power-1-activated",
  GATE_EATER_CHARGE: "gate-eater-charge",
  GATE_EATER_FLANK: "gate-eater-flank",
  POWER_2_ACTIVATED: "power-2-activated",
  RESEARCH_CONTAINER_EXPOSED: "research-container-exposed",
  POWER_3_ACTIVATED: "power-3-activated",
  RETURN_WINDOW_OPEN: "return-window-open",
});

const EVENT_RULE_INPUTS = [
  ["stage-nishijin-alert-v070", "stage-nishijin-shopping-street", "scripted-bark"],
  ["stage-sawara-alert-v070", "stage-sawara-ward-office", "scripted-bark"],
  ["stage-takuya-warning-v070", "stage-nishijin-defense-line-takuya", "scripted-bark"],
  ["stage-takuya-final-v070", "stage-nishijin-defense-line-takuya", "nonblocking-cut"],
  ["stage-takuya-base-remains-v070", "stage-nishijin-defense-line-takuya", "scripted-bark"],
  ["stage-station-gate-alert-v070", "stage-nishijin-station-gate", "scripted-bark"],
  ["stage-station-platform-alert-v070", "stage-nishijin-station-platform", "scripted-bark"],
  ["stage-station-tunnel-power-v070", "stage-nishijin-station-tunnel-seal", "scripted-bark"],
];

function metadataTriggerIds(eventId) {
  if (eventId === "stage-takuya-final-v070") return [STORY_BATTLE_TRIGGER_IDS.FINAL_WEAKPOINT_EXPOSED];
  const contracts = STORY_EVENTS[eventId]?.presentation?.battleBarks;
  return uniqueStrings(Array.isArray(contracts) ? contracts.map(({ trigger }) => trigger) : []);
}

/**
 * The eight canonical in-battle story presentations. `triggerIds` are derived
 * from the canonical story metadata, except for the Stage 3 final cut whose
 * existing story-flow threshold is exposed as a dedicated non-blocking cue.
 */
export const STORY_BATTLE_TRIGGER_RULES = deepFreeze(Object.fromEntries(EVENT_RULE_INPUTS.map(([eventId, stageId, kind]) => [
  eventId,
  {
    eventId,
    stageId,
    kind,
    nonBlocking: true,
    pausesBattle: false,
    triggerIds: metadataTriggerIds(eventId),
  },
])));

export const STORY_BATTLE_EVENT_IDS = deepFreeze(Object.keys(STORY_BATTLE_TRIGGER_RULES));

const STORY_BATTLE_BRIEF_LABELS = deepFreeze({
  [STORY_BATTLE_TRIGGER_IDS.DEPLOY]: "先行隊を展開",
  [STORY_BATTLE_TRIGGER_IDS.FAST_ENEMY]: "高速感染者を確認",
  [STORY_BATTLE_TRIGGER_IDS.FRONTLINE_OPEN]: "前線が開通",
  [STORY_BATTLE_TRIGGER_IDS.GROUPED_ENEMIES]: "感染者群を確認",
  [STORY_BATTLE_TRIGGER_IDS.CONVOY_START]: "避難車両が発進",
  [STORY_BATTLE_TRIGGER_IDS.HEAVY_ENEMY]: "大型感染者を確認",
  [STORY_BATTLE_TRIGGER_IDS.DEFENSE_30_REMAINING]: "防衛残り30秒",
  [STORY_BATTLE_TRIGGER_IDS.CONVOY_CRITICAL]: "避難車両が危険",
  [STORY_BATTLE_TRIGGER_IDS.TAKUYA_ENTRANCE]: "TAKUYA起動",
  [STORY_BATTLE_TRIGGER_IDS.TAKUYA_APPROACH]: "TAKUYA接近",
  [STORY_BATTLE_TRIGGER_IDS.RIGHT_SHOULDER_EXPOSED]: "右肩装甲が露出",
  [STORY_BATTLE_TRIGGER_IDS.KUMAVERSON_CRITICAL]: "クマバーソンが危険",
  [STORY_BATTLE_TRIGGER_IDS.FINAL_WEAKPOINT_EXPOSED]: "最終弱点が露出",
  [STORY_BATTLE_TRIGGER_IDS.BOSS_DEFEATED_BASE_REMAINS]: "感染拠点は活動中",
  [STORY_BATTLE_TRIGGER_IDS.GRAPPLER_SEEN]: "絡手を確認",
  [STORY_BATTLE_TRIGGER_IDS.GRAPPLER_GRAB]: "味方が拘束",
  [STORY_BATTLE_TRIGGER_IDS.CONTAINER_EXPOSED]: "研究容器が露出",
  [STORY_BATTLE_TRIGGER_IDS.OOZE_SEEN]: "漏泥を確認",
  [STORY_BATTLE_TRIGGER_IDS.SPRINTER_SEEN]: "走鬼を確認",
  [STORY_BATTLE_TRIGGER_IDS.CART_STALLED]: "搬送台車が停止",
  [STORY_BATTLE_TRIGGER_IDS.POWER_1_ACTIVATED]: "第一電源を起動",
  [STORY_BATTLE_TRIGGER_IDS.GATE_EATER_CHARGE]: "改札喰いが突進",
  [STORY_BATTLE_TRIGGER_IDS.GATE_EATER_FLANK]: "側面攻撃の機会",
  [STORY_BATTLE_TRIGGER_IDS.POWER_2_ACTIVATED]: "第二電源を起動",
  [STORY_BATTLE_TRIGGER_IDS.RESEARCH_CONTAINER_EXPOSED]: "研究容器を確認",
  [STORY_BATTLE_TRIGGER_IDS.POWER_3_ACTIVATED]: "第三電源を起動",
  [STORY_BATTLE_TRIGGER_IDS.RETURN_WINDOW_OPEN]: "帰還経路が開通",
});

export function storyBattleBriefLabel(trigger) {
  return STORY_BATTLE_BRIEF_LABELS[trigger] ?? "通信更新";
}

export function resolveStoryBattleBarkPresentation({
  cue = null,
  eventId,
  trigger,
  readStoryEventIds = [],
  mode = "first-time",
} = {}) {
  if (!cue) return deepFreeze({ kind: "none", label: null });
  const read = new Set(uniqueStrings(readStoryEventIds));
  const normalizedMode = ["first-time", "compact", "all"].includes(mode) ? mode : "first-time";
  if (!read.has(eventId) || normalizedMode === "all" || cue.mandatory === true) {
    return deepFreeze({ kind: "full", label: null });
  }
  if (normalizedMode === "compact") {
    return deepFreeze({ kind: "brief", label: storyBattleBriefLabel(trigger) });
  }
  return deepFreeze({ kind: "skip", label: null });
}

/**
 * The source metadata groups all three lines under the operator contract. Only
 * いくらちゃん is an operator: the two playable speakers remain conditional
 * on being deployed at the instant this trigger is first observed.
 */
const BASE_REMAINS_CONTRACTS = deepFreeze([
  {
    trigger: STORY_BATTLE_TRIGGER_IDS.BOSS_DEFEATED_BASE_REMAINS,
    lineIndexes: [0],
    speakerKind: null,
    requiresDeployed: false,
    npcSupport: false,
    operator: true,
    mandatory: true,
  },
  {
    trigger: STORY_BATTLE_TRIGGER_IDS.BOSS_DEFEATED_BASE_REMAINS,
    lineIndexes: [1],
    speakerKind: "babayaga",
    requiresDeployed: true,
    npcSupport: false,
    operator: false,
    mandatory: true,
  },
  {
    trigger: STORY_BATTLE_TRIGGER_IDS.BOSS_DEFEATED_BASE_REMAINS,
    lineIndexes: [2],
    speakerKind: "brawler",
    requiresDeployed: true,
    npcSupport: false,
    operator: false,
    mandatory: true,
  },
]);

function contractsFor(eventId, storyEvent) {
  if (eventId === "stage-takuya-base-remains-v070") return BASE_REMAINS_CONTRACTS;
  return Array.isArray(storyEvent?.presentation?.battleBarks)
    ? storyEvent.presentation.battleBarks
    : [];
}

function contractIsEligible(contract, deployedKinds) {
  const requiredKinds = uniqueStrings(contract.requiredDeployedKinds);
  if (requiredKinds.length > 0) return requiredKinds.every((kind) => deployedKinds.has(kind));
  if (contract.requiresDeployed === true) {
    return typeof contract.speakerKind === "string" && deployedKinds.has(contract.speakerKind);
  }
  return contract.npcSupport === true || contract.operator === true;
}

function cueLine({ eventId, trigger, lineIndex, line, contract, mandatory }) {
  return {
    id: `story:${eventId}:${trigger}:${lineIndex}`,
    lineId: `story:${eventId}:${lineIndex}`,
    eventId,
    trigger,
    lineIndex,
    speakerKind: contract && Object.hasOwn(contract, "speakerKind")
      ? contract.speakerKind
      : line.portrait === "radio" ? null : line.portrait ?? null,
    speaker: line.speaker,
    text: line.text,
    mandatory: contract?.mandatory === true || mandatory,
    priority: contract?.mandatory === true || mandatory ? 120 : 110,
    tone: "story-scripted",
    playVoice: false,
  };
}

export function storyBattleCueKey(eventId, trigger) {
  return `${String(eventId)}:${String(trigger)}`;
}

export function createStoryBattleBarkState() {
  return deepFreeze({ evaluatedCueKeys: [] });
}

function normalizedState(state) {
  return {
    evaluatedCueKeys: uniqueStrings(state?.evaluatedCueKeys),
  };
}

function result({ state, cue = null, key = null, evaluated = false, reason }) {
  return deepFreeze({ state, cue, key, evaluated, reason });
}

/**
 * Resolve one exact story cue without mutating runtime state.
 *
 * A valid event/trigger pair is marked evaluated before deployment eligibility
 * is checked. Consequently a unit deployed after the triggering transition
 * cannot cause a stale line to fire retroactively.
 *
 * `deployedKinds` must contain the living deployed unit kinds at the instant
 * the transition is observed, not the selected formation or owned roster.
 */
export function resolveStoryBattleBarkCue({
  state = createStoryBattleBarkState(),
  eventId,
  trigger,
  deployedKinds = [],
} = {}) {
  const current = normalizedState(state);
  const rule = STORY_BATTLE_TRIGGER_RULES[eventId];
  if (!rule || !rule.triggerIds.includes(trigger)) {
    return result({
      state: deepFreeze(current),
      reason: "unknown-event-trigger",
    });
  }

  const key = storyBattleCueKey(eventId, trigger);
  if (current.evaluatedCueKeys.includes(key)) {
    return result({
      state: deepFreeze(current),
      key,
      reason: "already-evaluated",
    });
  }

  const nextState = deepFreeze({
    evaluatedCueKeys: [...current.evaluatedCueKeys, key],
  });
  const storyEvent = STORY_EVENTS[eventId];
  if (!storyEvent) {
    return result({ state: nextState, key, evaluated: true, reason: "missing-story-event" });
  }

  if (rule.kind === "nonblocking-cut") {
    const lines = storyEvent.lines.map((line, lineIndex) => cueLine({
      eventId,
      trigger,
      lineIndex,
      line,
      contract: null,
      mandatory: true,
    }));
    const cue = {
      id: `story:${key}`,
      eventId,
      trigger,
      kind: rule.kind,
      nonBlocking: true,
      pausesBattle: false,
      mandatory: true,
      priority: 120,
      playVoice: false,
      music: storyEvent.presentation.music,
      lines,
    };
    return result({ state: nextState, cue: deepFreeze(cue), key, evaluated: true, reason: "queued" });
  }

  const deployed = new Set(uniqueStrings(deployedKinds));
  const matchingContracts = contractsFor(eventId, storyEvent)
    .filter((contract) => contract.trigger === trigger);
  const eligibleContracts = matchingContracts
    .filter((contract) => contractIsEligible(contract, deployed));
  const mandatory = eligibleContracts.some((contract) => contract.mandatory === true);
  const lines = eligibleContracts.flatMap((contract) => contract.lineIndexes.map((lineIndex) => {
    const line = storyEvent.lines[lineIndex];
    if (!line) throw new RangeError(`Missing story battle line: ${eventId}[${lineIndex}]`);
    return cueLine({ eventId, trigger, lineIndex, line, contract, mandatory: false });
  }));

  if (lines.length === 0) {
    return result({ state: nextState, key, evaluated: true, reason: "no-eligible-lines" });
  }

  const cue = {
    id: `story:${key}`,
    eventId,
    trigger,
    kind: rule.kind,
    nonBlocking: true,
    pausesBattle: false,
    mandatory,
    priority: mandatory ? 120 : 110,
    playVoice: false,
    music: storyEvent.presentation.music,
    lines,
  };
  return result({ state: nextState, cue: deepFreeze(cue), key, evaluated: true, reason: "queued" });
}

const invalidRules = STORY_BATTLE_EVENT_IDS.flatMap((eventId) => {
  const storyEvent = STORY_EVENTS[eventId];
  const rule = STORY_BATTLE_TRIGGER_RULES[eventId];
  if (!storyEvent) return [`${eventId}:missing-event`];
  if (rule.kind === "nonblocking-cut") return storyEvent.lines.length > 0 ? [] : [`${eventId}:missing-lines`];
  if (storyEvent.presentation.kind !== "battle-alert") return [`${eventId}:not-battle-alert`];
  return rule.triggerIds.length > 0 ? [] : [`${eventId}:missing-triggers`];
});

if (invalidRules.length > 0) {
  throw new Error(`Story battle trigger rules are invalid: ${invalidRules.join(",")}`);
}
