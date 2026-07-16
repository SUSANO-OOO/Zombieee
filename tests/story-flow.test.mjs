import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
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
  getStageDefeatStoryEventId,
  getStageEntryStoryEventId,
  getStageNextAttemptStoryEventId,
  getStageReplayStoryEventId,
  getStageResultStoryEventIds,
  getStageRetryStoryEventId,
  getTriggeredBattleStoryEventIds,
  listStoryFlowEventIds,
  resolveBattleStoryPresentation,
  resolveStoryEventCompletion,
  shouldAutoSkipStoryEvent,
} from "../app/storyFlow.js";

const STAGE_1 = CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET;
const STAGE_2 = CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE;
const STAGE_3 = CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE;

test("the deterministic flow reaches all 39 prologue-v5 events", () => {
  assert.equal(STORY_FLOW_SCRIPT_VERSION, "prologue-v5");
  assert.deepEqual(new Set(listStoryFlowEventIds()), new Set(STORY_EVENT_IDS));
  assert.deepEqual(Object.keys(STAGE_STORY_FLOWS), [STAGE_1, STAGE_2, STAGE_3]);
  assert.deepEqual(getPrologueOpeningEventIds(), ["prologue-opening", "prologue-operations-room"]);
});

test("first attempts, retries, and cleared-stage replays never reuse first-meeting scenes", () => {
  assert.equal(getStageEntryStoryEventId({ stageId: STAGE_1 }), "stage-nishijin-pre");
  assert.equal(getStageEntryStoryEventId({ stageId: STAGE_1, completedStageIds: [STAGE_1] }), "stage-nishijin-replay");
  assert.equal(getStageEntryStoryEventId({ stageId: STAGE_1, readStoryEventIds: ["stage-nishijin-pre"] }), "stage-nishijin-retry");
  assert.equal(getStageEntryStoryEventId({ stageId: STAGE_2, readStoryEventIds: ["stage-sawara-pre"] }), "stage-sawara-retry");
  assert.equal(getStageEntryStoryEventId({ stageId: STAGE_3, readStoryEventIds: ["stage-takuya-pre"] }), "stage-takuya-retry");
  assert.equal(getStageEntryStoryEventId({ stageId: STAGE_1, readStoryEventIds: ["stage-nishijin-defeat"] }), "stage-nishijin-retry");
  assert.equal(getStageEntryStoryEventId({ stageId: STAGE_3, readStoryEventIds: ["stage-takuya-defeat-after-boss"] }), "stage-takuya-retry");
  assert.equal(getStageReplayStoryEventId(STAGE_2), "stage-sawara-replay");
  assert.equal(getStageRetryStoryEventId(STAGE_1), "stage-nishijin-retry");
  assert.equal(getStageRetryStoryEventId(STAGE_2), "stage-sawara-retry");
  assert.equal(getStageRetryStoryEventId(STAGE_3), "stage-takuya-retry");
  assert.equal(getStageNextAttemptStoryEventId({ stageId: STAGE_1, previousWon: false }), "stage-nishijin-retry");
  assert.equal(getStageNextAttemptStoryEventId({ stageId: STAGE_1, previousWon: true }), "stage-nishijin-replay");
  assert.equal(getStageNextAttemptStoryEventId({ stageId: STAGE_2, previousWon: false }), "stage-sawara-retry");
  assert.equal(getStageNextAttemptStoryEventId({ stageId: STAGE_2, previousWon: true }), "stage-sawara-replay");
  assert.equal(getStageNextAttemptStoryEventId({ stageId: STAGE_3, previousWon: false }), "stage-takuya-retry");
  assert.equal(getStageNextAttemptStoryEventId({ stageId: STAGE_3, previousWon: true }), "stage-takuya-replay");
});

test("stage-one state events fire from battle state and only once", () => {
  let state = createBattleStoryFlowState(STAGE_1);
  const first = advanceBattleStoryFlow({
    state,
    snapshot: { battleStarted: true, enemyKindsSeen: ["runner"], signalIds: ["distress-voice"] },
  });
  assert.deepEqual(first.eventIds, [
    "stage-nishijin-battle-start",
    "stage-nishijin-battle-runner",
    "stage-nishijin-battle-distress-voice",
  ]);
  state = first.state;

  const second = advanceBattleStoryFlow({
    state,
    snapshot: {
      battleStarted: true,
      enemyKindsSeen: ["runner", "spitter"],
      signalIds: ["distress-voice"],
      enemyBaseExposed: true,
    },
  });
  assert.deepEqual(second.eventIds, ["stage-nishijin-battle-spitter", "stage-nishijin-battle-base-exposed"]);
  const duplicate = advanceBattleStoryFlow({ state: second.state, snapshot: { battleStarted: true, enemyBaseExposed: true } });
  assert.deepEqual(duplicate.eventIds, []);
});

test("the timed-defense milestones remain ordered and can catch up deterministically", () => {
  const before = getTriggeredBattleStoryEventIds({
    stageId: STAGE_2,
    snapshot: { battleStarted: true, elapsedSeconds: 89, convoyProgress: 89 / 180 },
  });
  assert.deepEqual(before, ["stage-sawara-battle-start", "stage-sawara-battle-30", "stage-sawara-battle-60"]);

  const after = getTriggeredBattleStoryEventIds({
    stageId: STAGE_2,
    snapshot: { battleStarted: true, elapsedSeconds: 180, convoyProgress: 1, convoyEvacuated: true },
    firedEventIds: before,
  });
  assert.deepEqual(after, [
    "stage-sawara-battle-90",
    "stage-sawara-battle-120",
    "stage-sawara-battle-150",
    "stage-sawara-battle-success",
  ]);
});

test("timed-defense dialogue cannot fire from elapsed time or convoy progress alone", () => {
  const elapsedOnly = getTriggeredBattleStoryEventIds({
    stageId: STAGE_2,
    snapshot: { elapsedSeconds: 120, convoyProgress: 0 },
  });
  const progressOnly = getTriggeredBattleStoryEventIds({
    stageId: STAGE_2,
    snapshot: { elapsedSeconds: 0, convoyProgress: 1 },
  });
  const bothAtThirty = getTriggeredBattleStoryEventIds({
    stageId: STAGE_2,
    snapshot: { elapsedSeconds: 30, convoyProgress: 1 / 6 },
  });

  assert.deepEqual(elapsedOnly, []);
  assert.deepEqual(progressOnly, []);
  assert.deepEqual(bothAtThirty, ["stage-sawara-battle-30"]);
});

test("TAKUYA events use explicit signals, enemy first sight, boss HP, and base state", () => {
  const eventIds = getTriggeredBattleStoryEventIds({
    stageId: STAGE_3,
    snapshot: {
      battleStarted: true,
      enemyKindsSeen: ["crusher"],
      signalIds: ["mimic-voice", "takuya-warning", "takuya-mimic-child"],
      bossHp: 200,
      bossMaxHp: 1000,
      bossDefeated: false,
    },
  });
  assert.deepEqual(eventIds, [
    "stage-takuya-battle-start",
    "stage-takuya-battle-mimic",
    "stage-takuya-battle-heavy",
    "stage-takuya-warning",
    "stage-takuya-phase-1",
    "stage-takuya-mimic-child",
    "stage-takuya-final",
  ]);
  assert.equal(battleStoryTriggerMatches({ type: "boss-defeated-base-remains" }, {
    bossDefeated: true,
    enemyBaseDestroyed: false,
  }), true);
});

test("a lethal TAKUYA burst catches up HP dialogue before the surviving base event", () => {
  const started = advanceBattleStoryFlow({
    state: createBattleStoryFlowState(STAGE_3),
    snapshot: { battleStarted: true, bossHp: 800, bossMaxHp: 1000, bossDefeated: false },
  });
  const lethal = advanceBattleStoryFlow({
    state: started.state,
    snapshot: {
      battleStarted: true,
      signalIds: ["takuya-mimic-child"],
      bossHp: 0,
      bossMaxHp: 1000,
      bossDefeated: false,
    },
  });
  assert.deepEqual(lethal.eventIds, [
    "stage-takuya-phase-1",
    "stage-takuya-mimic-child",
    "stage-takuya-final",
  ]);
  const remains = advanceBattleStoryFlow({
    state: lethal.state,
    snapshot: { bossDefeated: true, enemyBaseDestroyed: false },
  });
  assert.deepEqual(remains.eventIds, ["stage-takuya-base-remains"]);
});

test("result routing distinguishes ordinary defeat, post-boss defeat, victory, and ending", () => {
  assert.deepEqual(getStageResultStoryEventIds({ stageId: STAGE_1, won: true }), ["stage-nishijin-post"]);
  assert.deepEqual(getStageResultStoryEventIds({ stageId: STAGE_1, won: true, completedStageIds: [STAGE_1] }), []);
  assert.deepEqual(getStageResultStoryEventIds({ stageId: STAGE_2, won: false }), ["stage-sawara-defeat"]);
  assert.deepEqual(getStageResultStoryEventIds({ stageId: STAGE_3, won: false }), ["stage-takuya-defeat"]);
  assert.deepEqual(getStageResultStoryEventIds({
    stageId: STAGE_3,
    won: false,
    bossDefeated: true,
    enemyBaseDestroyed: false,
  }), ["stage-takuya-defeat-after-boss"]);
  assert.deepEqual(getStageResultStoryEventIds({ stageId: STAGE_3, won: true }), ["stage-takuya-post", "prologue-ending"]);
  assert.deepEqual(getStageResultStoryEventIds({ stageId: STAGE_3, won: true, completedStageIds: [STAGE_3] }), []);
  assert.equal(deriveBattleDefeatReason({ stageId: STAGE_3, bossDefeated: true }), BATTLE_DEFEAT_REASON_IDS.TAKUYA_BASE_REMAINS);
  assert.equal(getStageDefeatStoryEventId({ stageId: STAGE_3, defeatReason: BATTLE_DEFEAT_REASON_IDS.TAKUYA_BASE_REMAINS }), "stage-takuya-defeat-after-boss");
  assert.equal(getStageDefeatStoryEventId({ stageId: STAGE_1, defeatReason: BATTLE_DEFEAT_REASON_IDS.TAKUYA_BASE_REMAINS }), "stage-nishijin-defeat");
});

test("automatic skipping is allowed only for an event already marked read", () => {
  assert.equal(shouldAutoSkipStoryEvent({
    eventId: "stage-nishijin-pre",
    readStoryEventIds: [],
    autoSkipReadStory: true,
  }), false);
  assert.equal(shouldAutoSkipStoryEvent({
    eventId: "stage-nishijin-pre",
    readStoryEventIds: ["stage-nishijin-pre"],
    autoSkipReadStory: false,
  }), false);
  assert.equal(shouldAutoSkipStoryEvent({
    eventId: "stage-nishijin-pre",
    readStoryEventIds: ["stage-nishijin-pre"],
    autoSkipReadStory: true,
  }), true);
});

test("battle event presentation supports first-time, compact, and all without suppressing mandatory alerts", () => {
  assert.deepEqual(BATTLE_EVENT_MODES, ["first-time", "compact", "all"]);
  assert.deepEqual(MANDATORY_BATTLE_ALERT_IDS, [
    "stage-nishijin-battle-base-exposed",
    "stage-takuya-warning",
    "stage-takuya-base-remains",
  ]);

  const ordinary = "stage-nishijin-battle-runner";
  const mandatory = "stage-takuya-base-remains";
  assert.deepEqual(resolveBattleStoryPresentation({
    eventIds: [ordinary, mandatory, ordinary],
    readStoryEventIds: [],
    mode: "first-time",
  }), {
    fullEventIds: [ordinary],
    briefEventIds: [mandatory],
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
    mode: "compact",
  }), {
    fullEventIds: [],
    briefEventIds: [ordinary, mandatory],
    skippedEventIds: [],
  });
  assert.deepEqual(resolveBattleStoryPresentation({
    eventIds: [ordinary, mandatory],
    readStoryEventIds: [ordinary, mandatory],
    mode: "all",
  }), {
    fullEventIds: [ordinary],
    briefEventIds: [mandatory],
    skippedEventIds: [],
  });
  assert.equal(battleStoryBriefLabel(mandatory), "TAKUYA撃破　感染拠点を破壊せよ");
  assert.equal(battleStoryBriefLabel(ordinary), "通信更新");
});

test("normal completion, manual skip, and read auto-skip share one deterministic transition", () => {
  const input = {
    eventId: "prologue-opening",
    eventQueue: ["prologue-operations-room"],
    destination: "map",
    completionLocked: false,
  };
  const normal = resolveStoryEventCompletion(input);
  const manualSkip = resolveStoryEventCompletion(input);
  const automaticSkip = resolveStoryEventCompletion(input);
  assert.deepEqual(manualSkip, normal);
  assert.deepEqual(automaticSkip, normal);
  assert.deepEqual(normal, {
    applied: true,
    readEventId: "prologue-opening",
    nextEventId: "prologue-operations-room",
    remainingEventIds: [],
    destination: null,
    completionLocked: false,
  });

  const terminal = resolveStoryEventCompletion({
    eventId: normal.nextEventId,
    eventQueue: normal.remainingEventIds,
    destination: "map",
    completionLocked: normal.completionLocked,
  });
  assert.equal(terminal.applied, true);
  assert.equal(terminal.destination, "map");
  assert.equal(terminal.completionLocked, true);
  const duplicate = resolveStoryEventCompletion({
    eventId: null,
    eventQueue: terminal.remainingEventIds,
    destination: "map",
    completionLocked: terminal.completionLocked,
  });
  assert.equal(duplicate.applied, false);
  assert.equal(duplicate.destination, null);
});

test("all story completion destinations are preserved by the single completion reducer", () => {
  for (const destination of ["battle", "battle-resume", "result", "map"]) {
    const completion = resolveStoryEventCompletion({ eventId: "stage-nishijin-pre", destination });
    assert.equal(completion.applied, true);
    assert.equal(completion.readEventId, "stage-nishijin-pre");
    assert.equal(completion.destination, destination);
    assert.equal(completion.completionLocked, true);
  }
});

test("normal completion, manual skip, and auto-skip produce identical battle rewards and unlocks", () => {
  const run = (mode) => {
    let save = createDefaultCampaignSave();
    if (mode === "auto-skip") save = updateStoryPlaybackSettings(save, { autoSkipReadStory: true });
    const completion = resolveStoryEventCompletion({
      eventId: "stage-nishijin-pre",
      destination: "battle",
    });
    assert.equal(completion.applied, true);
    assert.equal(completion.destination, "battle");
    save = markStoryEventRead(save, completion.readEventId);
    const resolved = resolveStageResult(save, {
      resultId: `same-result-${mode}`,
      stageId: STAGE_1,
      won: true,
      baseHp: 90,
      baseMaxHp: 100,
    });
    return {
      result: {
        stars: resolved.result.stars,
        firstTimeStarReward: resolved.result.firstTimeStarReward,
        replayReward: resolved.result.replayReward,
        totalReward: resolved.result.totalReward,
        newlyUnlockedStageIds: resolved.result.newlyUnlockedStageIds,
        newlyUnlockedUnitIds: resolved.result.newlyUnlockedUnitIds,
      },
      progression: {
        completedStageIds: resolved.save.completedStageIds,
        bestStarsByStage: resolved.save.bestStarsByStage,
        claimedStarRewardsByStage: resolved.save.claimedStarRewardsByStage,
        supplies: resolved.save.supplies,
        unlockedStageIds: resolved.save.unlockedStageIds,
        unlockedUnitIds: resolved.save.unlockedUnitIds,
      },
    };
  };
  const normal = run("normal");
  assert.deepEqual(run("manual-skip"), normal);
  assert.deepEqual(run("auto-skip"), normal);
});

test("the story UI routes line completion, manual skip, and auto-skip through completeOnce", async () => {
  const source = await readFile(new URL("../app/CampaignScreens.tsx", import.meta.url), "utf8");
  assert.match(source, /const completeOnce = useCallback\(\(\) => \{[\s\S]*completedRef\.current = true;[\s\S]*onEventComplete\(\)/);
  assert.match(source, /window\.setTimeout\(completeOnce, 0\)/);
  assert.match(source, /const advance = \(\) =>[\s\S]*: completeOnce\(\)/);
  assert.match(source, /<button onClick=\{completeOnce\}>この会話だけスキップ<\/button>/);
  assert.match(source, /onSetAutoSkipReadStory\(true\); completeOnce\(\)/);
  assert.match(source, /className="cancel" onClick=\{\(\) => setSkipOpen\(false\)\}/);
});

test("unknown stages are rejected instead of silently routing to the wrong story", () => {
  assert.throws(() => createBattleStoryFlowState("missing-stage"), /Unknown campaign story stage/);
  assert.throws(() => getStageEntryStoryEventId({ stageId: "missing-stage" }), /Unknown campaign story stage/);
});
