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

export const BATTLE_EVENT_MODES = deepFreeze(["first-time", "compact", "all"]);
export const MANDATORY_BATTLE_ALERT_IDS = deepFreeze([
  "stage-nishijin-alert-v070",
  "stage-takuya-warning-v070",
  "stage-takuya-base-remains-v070",
]);

const BATTLE_ALERT_LABELS = deepFreeze({
  "stage-nishijin-alert-v070": "感染拠点が露出",
  "stage-sawara-alert-v070": "避難車両が発進",
  "stage-takuya-warning-v070": "TAKUYAを確認",
  "stage-takuya-final-v070": "最終弱点が露出",
  "stage-takuya-base-remains-v070": "TAKUYA制圧　残存敵を掃討",
  "stage-station-gate-alert-v070": "絡手を確認",
  "stage-station-platform-alert-v070": "漏泥を確認",
  "stage-station-tunnel-power-v070": "封鎖電源を起動",
  "stage-station-escape-v070": "封鎖完了　全員帰還",
});

export function battleStoryBriefLabel(eventId) {
  return BATTLE_ALERT_LABELS[eventId] ?? "通信更新";
}

export function resolveBattleStoryPresentation({
  eventIds = [],
  readStoryEventIds = [],
  mode = "first-time",
} = {}) {
  const events = uniqueStrings(eventIds);
  const read = new Set(uniqueStrings(readStoryEventIds));
  const normalizedMode = BATTLE_EVENT_MODES.includes(mode) ? mode : "first-time";
  const fullEventIds = [];
  const briefEventIds = [];
  const skippedEventIds = [];
  for (const eventId of events) {
    if (normalizedMode === "all" || !read.has(eventId)) {
      fullEventIds.push(eventId);
    } else if (normalizedMode === "compact" || MANDATORY_BATTLE_ALERT_IDS.includes(eventId)) {
      briefEventIds.push(eventId);
    } else {
      skippedEventIds.push(eventId);
    }
  }
  return Object.freeze({
    fullEventIds: Object.freeze(fullEventIds),
    briefEventIds: Object.freeze(briefEventIds),
    skippedEventIds: Object.freeze(skippedEventIds),
  });
}

export const BATTLE_DEFEAT_REASON_IDS = deepFreeze({
  CRAWLER_DESTROYED: "crawler-destroyed",
  CONVOY_LOST: "convoy-lost",
  TAKUYA_BASE_REMAINS: "takuya-base-remains",
});

function eventIds(value) {
  return uniqueStrings(Array.isArray(value) ? value : [value]);
}

function stageFlow({ pre, replay, battle, post, defeat, retry }) {
  return {
    pre: eventIds(pre),
    replay,
    battle,
    post: eventIds(post),
    defeat,
    retry,
  };
}

export const STAGE_STORY_FLOWS = deepFreeze({
  [CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET]: stageFlow({
    pre: "stage-nishijin-pre-v070",
    replay: "stage-nishijin-replay-v070",
    battle: [
      { eventId: "stage-nishijin-alert-v070", trigger: { type: "enemy-base-exposed" } },
    ],
    post: "stage-nishijin-post-v070",
    defeat: "stage-nishijin-defeat-v070",
    retry: "stage-nishijin-retry-v070",
  }),
  [CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE]: stageFlow({
    pre: "stage-sawara-pre-v070",
    replay: "stage-sawara-replay-v070",
    battle: [
      { eventId: "stage-sawara-alert-v070", trigger: { type: "convoy-evacuated" } },
    ],
    post: "stage-sawara-post-v070",
    defeat: "stage-sawara-defeat-v070",
    retry: "stage-sawara-retry-v070",
  }),
  [CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE]: stageFlow({
    pre: "stage-takuya-pre-v070",
    replay: "stage-takuya-replay-v070",
    battle: [
      { eventId: "stage-takuya-warning-v070", trigger: { type: "boss-warning" } },
      { eventId: "stage-takuya-final-v070", trigger: { type: "boss-hp-at-most", ratio: 0.25 } },
      { eventId: "stage-takuya-base-remains-v070", trigger: { type: "boss-defeated-base-remains" } },
    ],
    post: "stage-takuya-post-v070",
    defeat: "stage-takuya-defeat-v070",
    retry: "stage-takuya-retry-v070",
  }),
  [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE]: stageFlow({
    pre: ["station-briefing-v070", "stage-station-gate-pre-v070"],
    replay: "stage-station-gate-replay-v070",
    battle: [
      { eventId: "stage-station-gate-alert-v070", trigger: { type: "enemy-first-seen", enemyKind: "grappler" } },
    ],
    post: "stage-station-gate-post-v070",
    defeat: "stage-station-gate-defeat-v070",
    retry: "stage-station-gate-retry-v070",
  }),
  [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM]: stageFlow({
    pre: "stage-station-platform-pre-v070",
    replay: "stage-station-platform-replay-v070",
    battle: [
      { eventId: "stage-station-platform-alert-v070", trigger: { type: "enemy-first-seen", enemyKind: "ooze" } },
    ],
    post: "stage-station-platform-post-v070",
    defeat: "stage-station-platform-defeat-v070",
    retry: "stage-station-platform-retry-v070",
  }),
  [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL]: stageFlow({
    pre: "stage-station-tunnel-pre-v070",
    replay: "stage-station-tunnel-replay-v070",
    battle: [
      { eventId: "stage-station-tunnel-power-v070", trigger: { type: "power-at-least", count: 1 } },
      { eventId: "stage-station-escape-v070", trigger: { type: "mission-complete" } },
    ],
    post: ["stage-station-tunnel-post-v070", "chapter-ending-v070"],
    defeat: "stage-station-tunnel-defeat-v070",
    retry: "stage-station-tunnel-retry-v070",
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
    case "power-at-least":
      return Number(snapshot.powerActivated) >= trigger.count;
    case "mission-complete":
      return snapshot.missionCompleted === true;
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
  return [
    "prologue-kumaya-v070",
    "prologue-collapse-montage-v070",
    "prologue-crawler-montage-v070",
    "crawler-signal-v070",
  ];
}

export function getPrologueReplayEventIds() {
  return getPrologueOpeningEventIds();
}

export function getPrologueSkipEventIds() {
  return ["prologue-skip-summary-v070"];
}

export function isPrologueOpeningEventId(eventId) {
  return getPrologueOpeningEventIds().includes(eventId);
}

export function getStageEntryStoryEventIds({ stageId, completedStageIds = [], readStoryEventIds = [] }) {
  const flow = getStageFlow(stageId);
  if (uniqueStrings(completedStageIds).includes(stageId)) return eventIds(flow.replay);
  const read = new Set(uniqueStrings(readStoryEventIds));
  const defeatIds = [flow.defeat];
  if (stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE) defeatIds.push("stage-takuya-defeat-after-boss-v070");
  // Completing the pre-operation scene means this stage has already been
  // attempted, even if the player later withdrew or the session ended before
  // a defeat receipt was written. Never introduce rescued/joined characters a
  // second time; use the canonical retry operation briefing instead.
  const unreadPre = flow.pre.filter((eventId) => !read.has(eventId));
  if (unreadPre.length > 0 && !defeatIds.some((eventId) => read.has(eventId))) return unreadPre;
  return eventIds(flow.retry);
}

export function getStageEntryStoryEventId(options) {
  return getStageEntryStoryEventIds(options)[0] ?? null;
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
    && reason === BATTLE_DEFEAT_REASON_IDS.TAKUYA_BASE_REMAINS) return "stage-takuya-defeat-after-boss-v070";
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
  if (!won) {
    return uniqueStrings([
      getStageDefeatStoryEventId({ stageId, bossDefeated, enemyBaseDestroyed, defeatReason }),
    ]);
  }
  if (uniqueStrings(completedStageIds).includes(stageId)) return [];
  return flow.post;
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
  const stageEventIds = uniqueStrings(Object.values(STAGE_STORY_FLOWS).flatMap((flow) => [
    ...flow.pre,
    ...flow.battle.map(({ eventId }) => eventId),
    ...flow.post,
    flow.defeat,
    flow.retry,
    flow.replay,
  ]));
  return [...new Set([
    ...getPrologueOpeningEventIds(),
    ...getPrologueSkipEventIds(),
    ...stageEventIds,
    "stage-takuya-defeat-after-boss-v070",
  ])
  ];
}

const unknownFlowEventIds = listStoryFlowEventIds().filter((eventId) => !STORY_EVENTS[eventId]);
const unreachableStoryEventIds = STORY_EVENT_IDS.filter((eventId) => !listStoryFlowEventIds().includes(eventId));
if (unknownFlowEventIds.length || unreachableStoryEventIds.length) {
  throw new Error(`Story flow coverage mismatch: unknown=${unknownFlowEventIds.join(",")} unreachable=${unreachableStoryEventIds.join(",")}`);
}
