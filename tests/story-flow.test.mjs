import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CAMPAIGN_STAGES,
  CAMPAIGN_STAGE_IDS,
  createDefaultCampaignSave,
  markStoryEventRead,
  resolveStageResult,
  updateStoryPlaybackSettings,
} from "../app/campaign.js";
import { STORY_EVENT_IDS } from "../app/storyEvents.js";
import {
  BATTLE_EVENT_MODES,
  BATTLE_DEFEAT_REASON_IDS,
  MANDATORY_BATTLE_ALERT_IDS,
  STORY_FLOW_SCRIPT_VERSION,
  STAGE_STORY_FLOWS,
  advanceBattleStoryFlow,
  battleStoryBriefLabel,
  battleStoryTriggerMatches,
  createBattleStoryFlowState,
  deriveBattleDefeatReason,
  getPrologueOpeningEventIds,
  getPrologueReplayEventIds,
  getPrologueSkipEventIds,
  getStageDefeatStoryEventId,
  getStageEntryStoryEventId,
  getStageEntryStoryEventIds,
  getStageNextAttemptStoryEventId,
  getStageReplayStoryEventId,
  getStageResultStoryEventIds,
  getStageRetryStoryEventId,
  getTriggeredBattleStoryEventIds,
  isPrologueOpeningEventId,
  listStoryFlowEventIds,
  resolveBattleStoryPresentation,
  resolveStoryEventCompletion,
  shouldAutoSkipStoryEvent,
} from "../app/storyFlow.js";

const STAGE_1 = CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET;
const STAGE_2 = CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE;
const STAGE_3 = CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE;
const STAGE_4 = CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE;
const STAGE_5 = CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM;
const STAGE_6 = CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL;

test("outbreak-origin-v8 flow reaches every canonical event and covers all sixteen stages", () => {
  assert.equal(STORY_FLOW_SCRIPT_VERSION, "outbreak-origin-v8");
  assert.deepEqual(new Set(listStoryFlowEventIds()), new Set(STORY_EVENT_IDS));
  assert.deepEqual(Object.keys(STAGE_STORY_FLOWS), CAMPAIGN_STAGES.map(({ id }) => id));
  assert.deepEqual(getPrologueOpeningEventIds(), [
    "prologue-kumaya-v070",
    "prologue-collapse-montage-v070",
    "prologue-crawler-montage-v070",
    "crawler-signal-v070",
  ]);
  assert.deepEqual(getPrologueReplayEventIds(), getPrologueOpeningEventIds());
  assert.deepEqual(getPrologueSkipEventIds(), ["prologue-skip-summary-v070"]);
  assert.equal(isPrologueOpeningEventId("prologue-kumaya-v070"), true);
  assert.equal(isPrologueOpeningEventId("stage-nishijin-pre-v070"), false);
});

test("first attempts, interrupted multi-scene entries, retries, and replays never repeat introductions", () => {
  assert.deepEqual(getStageEntryStoryEventIds({ stageId: STAGE_1 }), ["stage-nishijin-pre-v070"]);
  assert.deepEqual(getStageEntryStoryEventIds({ stageId: STAGE_4 }), [
    "station-briefing-v070",
    "stage-station-gate-pre-v070",
  ]);
  assert.deepEqual(getStageEntryStoryEventIds({
    stageId: STAGE_4,
    readStoryEventIds: ["station-briefing-v070"],
  }), ["stage-station-gate-pre-v070"]);
  assert.deepEqual(getStageEntryStoryEventIds({
    stageId: STAGE_4,
    readStoryEventIds: ["station-briefing-v070", "stage-station-gate-pre-v070"],
  }), ["stage-station-gate-retry-v070"]);
  assert.equal(getStageEntryStoryEventId({ stageId: STAGE_1, completedStageIds: [STAGE_1] }), "stage-nishijin-replay-v070");
  assert.equal(getStageEntryStoryEventId({ stageId: STAGE_3, readStoryEventIds: ["stage-takuya-defeat-after-boss-v070"] }), "stage-takuya-retry-v070");
  for (const [stageId, prefix] of [
    [STAGE_1, "stage-nishijin"],
    [STAGE_2, "stage-sawara"],
    [STAGE_3, "stage-takuya"],
    [STAGE_4, "stage-station-gate"],
    [STAGE_5, "stage-station-platform"],
    [STAGE_6, "stage-station-tunnel"],
  ]) {
    assert.equal(getStageReplayStoryEventId(stageId), `${prefix}-replay-v070`);
    assert.equal(getStageRetryStoryEventId(stageId), `${prefix}-retry-v070`);
    assert.equal(getStageNextAttemptStoryEventId({ stageId, previousWon: false }), `${prefix}-retry-v070`);
    assert.equal(getStageNextAttemptStoryEventId({ stageId, previousWon: true }), `${prefix}-replay-v070`);
  }
});

test("battle state emits only the compact canonical alerts and never repeats one", () => {
  let state = createBattleStoryFlowState(STAGE_1);
  const quiet = advanceBattleStoryFlow({ state, snapshot: { battleStarted: true, enemyKindsSeen: ["runner"] } });
  assert.deepEqual(quiet.eventIds, []);
  const exposed = advanceBattleStoryFlow({ state: quiet.state, snapshot: { enemyBaseExposed: true } });
  assert.deepEqual(exposed.eventIds, ["stage-nishijin-alert-v070"]);
  assert.deepEqual(advanceBattleStoryFlow({ state: exposed.state, snapshot: { enemyBaseExposed: true } }).eventIds, []);

  assert.deepEqual(getTriggeredBattleStoryEventIds({
    stageId: STAGE_2,
    snapshot: { elapsedSeconds: 180, convoyProgress: 1, convoyEvacuated: true },
  }), ["stage-sawara-alert-v070"]);
  assert.deepEqual(getTriggeredBattleStoryEventIds({
    stageId: STAGE_3,
    snapshot: { bossWarning: true, bossHp: 200, bossMaxHp: 1000, bossDefeated: false },
  }), ["stage-takuya-warning-v070", "stage-takuya-final-v070"]);
  assert.deepEqual(getTriggeredBattleStoryEventIds({
    stageId: STAGE_4,
    snapshot: { enemyKindsSeen: ["grappler"] },
  }), ["stage-station-gate-alert-v070"]);
  assert.deepEqual(getTriggeredBattleStoryEventIds({
    stageId: STAGE_5,
    snapshot: { enemyKindsSeen: ["ooze"] },
  }), ["stage-station-platform-alert-v070"]);
  assert.deepEqual(getTriggeredBattleStoryEventIds({
    stageId: STAGE_6,
    snapshot: { powerActivated: 1, missionCompleted: true },
  }), ["stage-station-tunnel-power-v070", "stage-station-escape-v070"]);
  assert.equal(battleStoryTriggerMatches({ type: "power-at-least", count: 2 }, { powerActivated: 1 }), false);
  assert.equal(battleStoryTriggerMatches({ type: "mission-complete" }, { missionCompleted: true }), true);
  assert.equal(battleStoryTriggerMatches({ type: "mission-complete" }, { sealed: true }), false);
});

test("result routing covers Stage 1-6, special TAKUYA defeat, and the ending", () => {
  assert.deepEqual(getStageResultStoryEventIds({ stageId: STAGE_1, won: true }), ["stage-nishijin-post-v070"]);
  assert.deepEqual(getStageResultStoryEventIds({ stageId: STAGE_2, won: false }), ["stage-sawara-defeat-v070"]);
  assert.deepEqual(getStageResultStoryEventIds({ stageId: STAGE_3, won: true }), ["stage-takuya-post-v070"]);
  assert.deepEqual(getStageResultStoryEventIds({
    stageId: STAGE_3,
    won: false,
    bossDefeated: true,
    enemyBaseDestroyed: false,
  }), ["stage-takuya-defeat-after-boss-v070"]);
  assert.deepEqual(getStageResultStoryEventIds({ stageId: STAGE_4, won: true }), ["stage-station-gate-post-v070"]);
  assert.deepEqual(getStageResultStoryEventIds({ stageId: STAGE_5, won: true }), ["stage-station-platform-post-v070"]);
  assert.deepEqual(getStageResultStoryEventIds({ stageId: STAGE_6, won: true }), [
    "stage-station-tunnel-post-v070",
    "chapter-ending-v070",
  ]);
  assert.deepEqual(getStageResultStoryEventIds({ stageId: STAGE_6, won: false }), ["stage-station-tunnel-defeat-v070"]);
  assert.deepEqual(getStageResultStoryEventIds({ stageId: STAGE_6, won: true, completedStageIds: [STAGE_6] }), []);
  assert.equal(deriveBattleDefeatReason({ stageId: STAGE_3, bossDefeated: true }), BATTLE_DEFEAT_REASON_IDS.TAKUYA_BASE_REMAINS);
  assert.equal(getStageDefeatStoryEventId({
    stageId: STAGE_3,
    defeatReason: BATTLE_DEFEAT_REASON_IDS.TAKUYA_BASE_REMAINS,
  }), "stage-takuya-defeat-after-boss-v070");
});

test("automatic skip applies only to read events while explicit replay remains a UI override", () => {
  assert.equal(shouldAutoSkipStoryEvent({
    eventId: "stage-nishijin-pre-v070",
    readStoryEventIds: [],
    autoSkipReadStory: true,
  }), false);
  assert.equal(shouldAutoSkipStoryEvent({
    eventId: "stage-nishijin-pre-v070",
    readStoryEventIds: ["stage-nishijin-pre-v070"],
    autoSkipReadStory: false,
  }), false);
  assert.equal(shouldAutoSkipStoryEvent({
    eventId: "stage-nishijin-pre-v070",
    readStoryEventIds: ["stage-nishijin-pre-v070"],
    autoSkipReadStory: true,
  }), true);
});

test("battle event presentation shows unread authored lines and keeps read mandatory alerts visible", () => {
  assert.deepEqual(BATTLE_EVENT_MODES, ["first-time", "compact", "all"]);
  assert.deepEqual(MANDATORY_BATTLE_ALERT_IDS, [
    "stage-nishijin-alert-v070",
    "stage-takuya-warning-v070",
    "stage-takuya-base-remains-v070",
  ]);
  const ordinary = "stage-station-gate-alert-v070";
  const mandatory = "stage-takuya-base-remains-v070";
  assert.deepEqual(resolveBattleStoryPresentation({
    eventIds: [ordinary, mandatory, ordinary],
    readStoryEventIds: [],
    mode: "first-time",
  }), {
    fullEventIds: [ordinary, mandatory],
    briefEventIds: [],
    skippedEventIds: [],
  });
  assert.deepEqual(resolveBattleStoryPresentation({
    eventIds: [ordinary, mandatory],
    readStoryEventIds: [],
    mode: "compact",
  }), {
    fullEventIds: [ordinary, mandatory],
    briefEventIds: [],
    skippedEventIds: [],
  });
  assert.deepEqual(resolveBattleStoryPresentation({
    eventIds: [ordinary, mandatory],
    readStoryEventIds: [ordinary, mandatory],
    mode: "compact",
  }), {
    fullEventIds: [],
    briefEventIds: [ordinary, mandatory],
    skippedEventIds: [],
  });
  assert.deepEqual(resolveBattleStoryPresentation({
    eventIds: [ordinary, mandatory],
    readStoryEventIds: [ordinary, mandatory],
    mode: "first-time",
  }), {
    fullEventIds: [],
    briefEventIds: [mandatory],
    skippedEventIds: [ordinary],
  });
  assert.deepEqual(resolveBattleStoryPresentation({
    eventIds: [ordinary, mandatory],
    readStoryEventIds: [ordinary, mandatory],
    mode: "all",
  }), {
    fullEventIds: [ordinary, mandatory],
    briefEventIds: [],
    skippedEventIds: [],
  });
  assert.equal(battleStoryBriefLabel(mandatory), "TAKUYA制圧　残存敵を掃討");
});

test("the completion reducer preserves queues, destinations, and duplicate protection", () => {
  const first = resolveStoryEventCompletion({
    eventId: "prologue-kumaya-v070",
    eventQueue: ["prologue-collapse-montage-v070"],
    destination: "map",
  });
  assert.deepEqual(first, {
    applied: true,
    readEventId: "prologue-kumaya-v070",
    nextEventId: "prologue-collapse-montage-v070",
    remainingEventIds: [],
    destination: null,
    completionLocked: false,
  });
  const terminal = resolveStoryEventCompletion({
    eventId: first.nextEventId,
    eventQueue: first.remainingEventIds,
    destination: "map",
  });
  assert.equal(terminal.destination, "map");
  assert.equal(terminal.completionLocked, true);
  assert.equal(resolveStoryEventCompletion({ completionLocked: true }).applied, false);
  for (const destination of ["battle", "battle-resume", "result", "map"]) {
    assert.equal(resolveStoryEventCompletion({ eventId: "stage-nishijin-pre-v070", destination }).destination, destination);
  }
});

test("normal completion, manual skip, and auto-skip cannot change battle rewards", () => {
  const run = (mode) => {
    let save = createDefaultCampaignSave();
    if (mode === "auto-skip") save = updateStoryPlaybackSettings(save, { autoSkipReadStory: true });
    const completion = resolveStoryEventCompletion({ eventId: "stage-nishijin-pre-v070", destination: "battle" });
    save = markStoryEventRead(save, completion.readEventId);
    const resolved = resolveStageResult(save, {
      resultId: `same-result-${mode}`,
      stageId: STAGE_1,
      won: true,
      baseHp: 90,
      baseMaxHp: 100,
    });
    return {
      stars: resolved.result.stars,
      rewards: resolved.result.totalReward,
      completed: resolved.save.completedStageIds,
      unlockedStages: resolved.save.unlockedStageIds,
      unlockedUnits: resolved.save.unlockedUnitIds,
    };
  };
  const normal = run("normal");
  assert.deepEqual(run("manual-skip"), normal);
  assert.deepEqual(run("auto-skip"), normal);
});

test("story UI has fixed-summary prologue skip and force-replay bypass", async () => {
  const [screens, game] = await Promise.all([
    readFile(new URL("../app/CampaignScreens.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(screens, /forceStoryReplay \|\| completedRef\.current/);
  assert.match(screens, /const skipOnce = useCallback/);
  assert.match(screens, /プロローグでは固定要約を表示して四十三日後へ進みます/);
  assert.match(screens, /プロローグを回想/);
  assert.match(game, /getPrologueSkipEventIds/);
  assert.match(game, /openEvents\(getPrologueReplayEventIds\(\), "map", \{ forceReplay: true \}\)/);
  assert.match(game, /getStageEntryStoryEventIds/);
});

test("unknown stages are rejected instead of silently routing to another story", () => {
  assert.throws(() => createBattleStoryFlowState("missing-stage"), /Unknown campaign story stage/);
  assert.throws(() => getStageEntryStoryEventIds({ stageId: "missing-stage" }), /Unknown campaign story stage/);
});
