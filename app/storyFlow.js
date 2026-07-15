import { CAMPAIGN_STAGE_IDS } from "./campaign.js";
import { STORY_EVENTS, STORY_EVENT_IDS, STORY_SCRIPT_VERSION } from "./storyEvents.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function uniqueStrings(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry) => typeof entry === "string" && entry.length > 0))];
}

export const STORY_FLOW_SCRIPT_VERSION = STORY_SCRIPT_VERSION;

export const BATTLE_DEFEAT_REASON_IDS = deepFreeze({
  CRAWLER_DESTROYED: "crawler-destroyed",
  CONVOY_LOST: "convoy-lost",
  TAKUYA_BASE_REMAINS: "takuya-base-remains",
});

function stageFlow({ pre, replay, battle, post, defeat, retry }) {
  return { pre, replay, battle, post, defeat, retry };
}

export const STAGE_STORY_FLOWS = deepFreeze({
  [CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET]: stageFlow({
    pre: "stage-nishijin-pre",
    replay: "stage-nishijin-replay",
    battle: [
      { eventId: "stage-nishijin-battle-start", trigger: { type: "battle-start" } },
      { eventId: "stage-nishijin-battle-runner", trigger: { type: "enemy-first-seen", enemyKind: "runner" } },
      { eventId: "stage-nishijin-battle-spitter", trigger: { type: "enemy-first-seen", enemyKind: "spitter" } },
      { eventId: "stage-nishijin-battle-distress-voice", trigger: { type: "signal", signalId: "distress-voice" } },
      { eventId: "stage-nishijin-battle-base-exposed", trigger: { type: "enemy-base-exposed" } },
    ],
    post: "stage-nishijin-post",
    defeat: "stage-nishijin-defeat",
    retry: "stage-nishijin-retry",
  }),
  [CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE]: stageFlow({
    pre: "stage-sawara-pre",
    replay: "stage-sawara-replay",
    battle: [
      { eventId: "stage-sawara-battle-start", trigger: { type: "battle-start" } },
      { eventId: "stage-sawara-battle-30", trigger: { type: "defense-milestone", seconds: 30, convoyProgress: 1 / 6 } },
      { eventId: "stage-sawara-battle-60", trigger: { type: "defense-milestone", seconds: 60, convoyProgress: 1 / 3 } },
      { eventId: "stage-sawara-battle-90", trigger: { type: "defense-milestone", seconds: 90, convoyProgress: 1 / 2 } },
      { eventId: "stage-sawara-battle-120", trigger: { type: "defense-milestone", seconds: 120, convoyProgress: 2 / 3 } },
      { eventId: "stage-sawara-battle-150", trigger: { type: "defense-milestone", seconds: 150, convoyProgress: 5 / 6 } },
      { eventId: "stage-sawara-battle-success", trigger: { type: "convoy-evacuated" } },
    ],
    post: "stage-sawara-post",
    defeat: "stage-sawara-defeat",
    retry: "stage-sawara-retry",
  }),
  [CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE]: stageFlow({
    pre: "stage-takuya-pre",
    replay: "stage-takuya-replay",
    battle: [
      { eventId: "stage-takuya-battle-start", trigger: { type: "battle-start" } },
      { eventId: "stage-takuya-battle-mimic", trigger: { type: "signal", signalId: "mimic-voice" } },
      { eventId: "stage-takuya-battle-heavy", trigger: { type: "enemy-first-seen", enemyKind: "crusher" } },
      { eventId: "stage-takuya-warning", trigger: { type: "boss-warning" } },
      { eventId: "stage-takuya-phase-1", trigger: { type: "boss-hp-at-most", ratio: 0.75 } },
      { eventId: "stage-takuya-mimic-child", trigger: { type: "signal", signalId: "takuya-mimic-child" } },
      { eventId: "stage-takuya-final", trigger: { type: "boss-hp-at-most", ratio: 0.25 } },
      { eventId: "stage-takuya-base-remains", trigger: { type: "boss-defeated-base-remains" } },
    ],
    post: "stage-takuya-post",
    defeat: "stage-takuya-defeat",
    retry: "stage-takuya-retry",
  }),
});

function getStageFlow(stageId) {
  const flow = STAGE_STORY_FLOWS[stageId];
  if (!flow) throw new RangeError(`Unknown campaign story stage: ${String(stageId)}`);
  return flow;
}

function hasSignal(snapshot, signalId) {
  return uniqueStrings(snapshot?.signalIds).includes(signalId);
}

function bossHpRatio(snapshot) {
  const hp = Number(snapshot?.bossHp);
  const maxHp = Number(snapshot?.bossMaxHp);
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, hp) / maxHp;
}

export function battleStoryTriggerMatches(trigger, snapshot = {}) {
  switch (trigger?.type) {
    case "battle-start":
      return snapshot.battleStarted === true;
    case "enemy-first-seen":
      return uniqueStrings(snapshot.enemyKindsSeen).includes(trigger.enemyKind);
    case "signal":
      return hasSignal(snapshot, trigger.signalId);
    case "enemy-base-exposed":
      return snapshot.enemyBaseExposed === true;
    case "defense-milestone":
      return Number(snapshot.elapsedSeconds) >= trigger.seconds
        && Number(snapshot.convoyProgress) >= trigger.convoyProgress;
    case "convoy-evacuated":
      return snapshot.convoyEvacuated === true || snapshot.outcome === "won";
    case "boss-warning":
      return snapshot.bossWarning === true || hasSignal(snapshot, "takuya-warning");
    case "boss-hp-at-most":
      return snapshot.bossDefeated !== true && bossHpRatio(snapshot) <= trigger.ratio;
    case "boss-defeated-base-remains":
      return snapshot.bossDefeated === true && snapshot.enemyBaseDestroyed !== true;
    default:
      return false;
  }
}

export function getTriggeredBattleStoryEventIds({ stageId, snapshot = {}, firedEventIds = [] }) {
  const fired = new Set(uniqueStrings(firedEventIds));
  return getStageFlow(stageId).battle
    .filter(({ eventId, trigger }) => !fired.has(eventId) && battleStoryTriggerMatches(trigger, snapshot))
    .map(({ eventId }) => eventId);
}

export function createBattleStoryFlowState(stageId) {
  getStageFlow(stageId);
  return { stageId, firedEventIds: [] };
}

export function advanceBattleStoryFlow({ state, snapshot = {} }) {
  const current = state && typeof state === "object"
    ? { stageId: state.stageId, firedEventIds: uniqueStrings(state.firedEventIds) }
    : null;
  if (!current) throw new TypeError("A battle story flow state is required");
  const eventIds = getTriggeredBattleStoryEventIds({
    stageId: current.stageId,
    snapshot,
    firedEventIds: current.firedEventIds,
  });
  return {
    eventIds,
    state: {
      stageId: current.stageId,
      firedEventIds: [...current.firedEventIds, ...eventIds],
    },
  };
}

export function getPrologueOpeningEventIds() {
  return ["prologue-opening", "prologue-operations-room"];
}

export function getStageEntryStoryEventId({ stageId, completedStageIds = [], readStoryEventIds = [] }) {
  const flow = getStageFlow(stageId);
  if (uniqueStrings(completedStageIds).includes(stageId)) return flow.replay;
  const read = new Set(uniqueStrings(readStoryEventIds));
  const defeatIds = [flow.defeat];
  if (stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE) defeatIds.push("stage-takuya-defeat-after-boss");
  // Completing the pre-operation scene means this stage has already been
  // attempted, even if the player later withdrew or the session ended before
  // a defeat receipt was written. Never introduce rescued/joined characters a
  // second time; use the canonical retry operation briefing instead.
  return read.has(flow.pre) || defeatIds.some((eventId) => read.has(eventId)) ? flow.retry : flow.pre;
}

export function getStageReplayStoryEventId(stageId) {
  return getStageFlow(stageId).replay;
}

export function getStageRetryStoryEventId(stageId) {
  return getStageFlow(stageId).retry;
}

export function getStageNextAttemptStoryEventId({ stageId, previousWon = false } = {}) {
  return previousWon ? getStageReplayStoryEventId(stageId) : getStageRetryStoryEventId(stageId);
}

export function deriveBattleDefeatReason({ stageId, bossDefeated = false, enemyBaseDestroyed = false, defeatReason } = {}) {
  getStageFlow(stageId);
  if (stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE && bossDefeated && !enemyBaseDestroyed) {
    return BATTLE_DEFEAT_REASON_IDS.TAKUYA_BASE_REMAINS;
  }
  if (typeof defeatReason === "string" && defeatReason.length > 0) return defeatReason;
  if (stageId === CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE) return BATTLE_DEFEAT_REASON_IDS.CONVOY_LOST;
  return BATTLE_DEFEAT_REASON_IDS.CRAWLER_DESTROYED;
}

export function getStageDefeatStoryEventId({ stageId, bossDefeated = false, enemyBaseDestroyed = false, defeatReason } = {}) {
  const flow = getStageFlow(stageId);
  const reason = deriveBattleDefeatReason({ stageId, bossDefeated, enemyBaseDestroyed, defeatReason });
  if (stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE
    && reason === BATTLE_DEFEAT_REASON_IDS.TAKUYA_BASE_REMAINS) return "stage-takuya-defeat-after-boss";
  return flow.defeat;
}

export function getStageResultStoryEventIds({
  stageId,
  won = false,
  completedStageIds = [],
  bossDefeated = false,
  enemyBaseDestroyed = false,
  defeatReason,
} = {}) {
  const flow = getStageFlow(stageId);
  if (!won) return [getStageDefeatStoryEventId({ stageId, bossDefeated, enemyBaseDestroyed, defeatReason })];
  if (uniqueStrings(completedStageIds).includes(stageId)) return [];
  return stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE
    ? [flow.post, "prologue-ending"]
    : [flow.post];
}

export function isStoryEventRead(readStoryEventIds, eventId) {
  return uniqueStrings(readStoryEventIds).includes(eventId);
}

export function shouldAutoSkipStoryEvent({ eventId, readStoryEventIds = [], autoSkipReadStory = false } = {}) {
  return autoSkipReadStory === true && isStoryEventRead(readStoryEventIds, eventId);
}

export function resolveStoryEventCompletion({
  eventId = null,
  eventQueue = [],
  destination = "map",
  completionLocked = false,
} = {}) {
  const queue = uniqueStrings(eventQueue);
  if (completionLocked) {
    return {
      applied: false,
      readEventId: null,
      nextEventId: typeof eventId === "string" ? eventId : null,
      remainingEventIds: queue,
      destination: null,
      completionLocked: true,
    };
  }
  const [nextEventId = null, ...remainingEventIds] = queue;
  return {
    applied: true,
    readEventId: typeof eventId === "string" && eventId.length > 0 ? eventId : null,
    nextEventId,
    remainingEventIds,
    destination: nextEventId ? null : destination,
    completionLocked: nextEventId === null,
  };
}

export function listStoryFlowEventIds() {
  const stageEventIds = Object.values(STAGE_STORY_FLOWS).flatMap((flow) => [
    flow.pre,
    ...flow.battle.map(({ eventId }) => eventId),
    flow.post,
    flow.defeat,
    flow.retry,
    flow.replay,
  ]);
  return [...new Set([...getPrologueOpeningEventIds(), ...stageEventIds, "stage-takuya-defeat-after-boss", "prologue-ending"])
  ];
}

const unknownFlowEventIds = listStoryFlowEventIds().filter((eventId) => !STORY_EVENTS[eventId]);
const unreachableStoryEventIds = STORY_EVENT_IDS.filter((eventId) => !listStoryFlowEventIds().includes(eventId));
if (unknownFlowEventIds.length || unreachableStoryEventIds.length) {
  throw new Error(`Story flow coverage mismatch: unknown=${unknownFlowEventIds.join(",")} unreachable=${unreachableStoryEventIds.join(",")}`);
}
