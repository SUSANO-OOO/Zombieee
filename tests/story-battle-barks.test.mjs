import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BATTLE_BARK_CONFIG,
  advanceBattleBarkRuntime,
  clearNonScriptedBattleBarks,
  createBattleBarkRuntime,
  queueBattleBark,
  queueScriptedBattleBarkCue,
} from "../app/battleBarks.js";
import {
  STORY_BATTLE_EVENT_IDS,
  STORY_BATTLE_TRIGGER_IDS,
  STORY_BATTLE_TRIGGER_RULES,
  createStoryBattleBarkState,
  resolveStoryBattleBarkCue,
  resolveStoryBattleBarkPresentation,
  storyBattleBriefLabel,
} from "../app/storyBattleBarks.js";
import { STORY_EVENTS } from "../app/storyEvents.js";
import { resolveBattleStoryPresentation } from "../app/storyFlow.js";

const gameSource = readFileSync(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");

const EXPECTED_TRIGGER_RULES = {
  "stage-nishijin-alert-v070": ["deploy", "fast-enemy", "frontline-open", "grouped-enemies"],
  "stage-sawara-alert-v070": ["convoy-start", "heavy-enemy", "defense-30-remaining", "convoy-critical"],
  "stage-takuya-warning-v070": ["takuya-entrance", "takuya-approach", "right-shoulder-exposed", "kumaverson-critical"],
  "stage-takuya-final-v070": ["final-weakpoint-exposed"],
  "stage-takuya-base-remains-v070": ["boss-defeated-base-remains"],
  "stage-station-gate-alert-v070": ["grappler-seen", "grappler-grab", "container-exposed"],
  "stage-station-platform-alert-v070": ["ooze-seen", "sprinter-seen", "cart-stalled"],
  "stage-station-tunnel-power-v070": [
    "power-1-activated",
    "gate-eater-charge",
    "gate-eater-flank",
    "power-2-activated",
    "research-container-exposed",
    "power-3-activated",
    "return-window-open",
  ],
};

test("the pure trigger registry covers the eight canonical non-blocking battle presentations", () => {
  assert.deepEqual(STORY_BATTLE_EVENT_IDS, Object.keys(EXPECTED_TRIGGER_RULES));
  assert.deepEqual(
    Object.fromEntries(Object.entries(STORY_BATTLE_TRIGGER_RULES).map(([eventId, rule]) => [eventId, rule.triggerIds])),
    EXPECTED_TRIGGER_RULES,
  );
  for (const rule of Object.values(STORY_BATTLE_TRIGGER_RULES)) {
    assert.equal(rule.nonBlocking, true);
    assert.equal(rule.pausesBattle, false);
    assert.equal(Object.isFrozen(rule), true);
    assert.equal(Object.isFrozen(rule.triggerIds), true);
  }
});

test("gameplay consumes every scripted trigger without routing battle presentations through StoryScreen", () => {
  assert.match(gameSource, /storyBattleBarkState: ReturnType<typeof createStoryBattleBarkState>/);
  assert.match(gameSource, /storyBattleBarkState: createStoryBattleBarkState\(\)/);
  assert.match(gameSource, /dispatchScriptedStoryBattleBarks\([\s\S]*campaignSave\.settings\.battleEventMode/);
  assert.match(gameSource, /!STORY_BATTLE_EVENT_IDS\.includes\(storyEventId\)/);
  assert.doesNotMatch(gameSource, /openEvents\(presentation\.fullEventIds/);
  assert.match(gameSource, /resolveStoryBattleBarkPresentation\(/);
  assert.match(gameSource, /storyBattleReadEventIds: \[\.\.\.storyBattleReadEventIds\]/);
  assert.match(gameSource, /storyBattleReceiptEventIds/);
  assert.match(gameSource, /markStoryEventRead\(next, receiptEventId\)/);
  for (const triggerName of Object.keys(STORY_BATTLE_TRIGGER_IDS)) {
    assert.match(gameSource, new RegExp(`STORY_BATTLE_TRIGGER_IDS\\.${triggerName}`), triggerName);
  }
  for (const eventId of STORY_BATTLE_EVENT_IDS) {
    assert.match(gameSource, new RegExp(eventId.replaceAll("-", "\\-")), eventId);
  }
  assert.match(gameSource, /bark\.trigger === STORY_BATTLE_TRIGGER_IDS\.FINAL_WEAKPOINT_EXPOSED/);
  assert.match(gameSource, /storyFinalCutAudioActive[\s\S]*sceneIdForStoryEvent\("stage-takuya-final-v070"\)/);
  assert.match(gameSource, /storyWarningCueForEvent\(storyEventId\)/);
  assert.match(gameSource, /playProductionCue\(warningCue, W \/ 2, \{[\s\S]*priority: 98/);
  assert.match(gameSource, /newlyTriggeredEventIds\.includes\("stage-takuya-final-v070"\)/);
});

test("battle event preferences remain meaningful across attempts without pausing battle", () => {
  const eventId = "stage-station-gate-alert-v070";
  const firstAttempt = resolveBattleStoryPresentation({
    eventIds: [eventId],
    readStoryEventIds: [],
    mode: "first-time",
  });
  assert.deepEqual(firstAttempt, {
    fullEventIds: [eventId],
    briefEventIds: [],
    skippedEventIds: [],
  });
  const secondAttempt = resolveBattleStoryPresentation({
    eventIds: [eventId],
    readStoryEventIds: [eventId],
    mode: "first-time",
  });
  assert.deepEqual(secondAttempt, {
    fullEventIds: [],
    briefEventIds: [],
    skippedEventIds: [eventId],
  });
  assert.deepEqual(resolveBattleStoryPresentation({
    eventIds: [eventId],
    readStoryEventIds: [eventId],
    mode: "compact",
  }).briefEventIds, [eventId]);
  assert.deepEqual(resolveBattleStoryPresentation({
    eventIds: [eventId],
    readStoryEventIds: [eventId],
    mode: "all",
  }).fullEventIds, [eventId]);
});

test("beat-aware playback covers unread and read modes, mandatory beats, and absent cues", () => {
  const eventId = "stage-station-gate-alert-v070";
  const trigger = "grappler-seen";
  const ordinaryCue = resolveStoryBattleBarkCue({
    state: createStoryBattleBarkState(),
    eventId,
    trigger,
    deployedKinds: ["ranger"],
  }).cue;
  assert.equal(ordinaryCue.mandatory, false);
  const mandatoryCue = resolveStoryBattleBarkCue({
    state: createStoryBattleBarkState(),
    eventId: "stage-takuya-final-v070",
    trigger: "final-weakpoint-exposed",
    deployedKinds: [],
  }).cue;
  assert.equal(mandatoryCue.mandatory, true);

  for (const mode of ["first-time", "compact", "all"]) {
    assert.equal(resolveStoryBattleBarkPresentation({
      cue: ordinaryCue,
      eventId,
      trigger,
      readStoryEventIds: [],
      mode,
    }).kind, "full", `unread/${mode}`);
    assert.equal(resolveStoryBattleBarkPresentation({
      cue: mandatoryCue,
      eventId: mandatoryCue.eventId,
      trigger: mandatoryCue.trigger,
      readStoryEventIds: [mandatoryCue.eventId],
      mode,
    }).kind, "full", `mandatory/${mode}`);
  }

  assert.equal(resolveStoryBattleBarkPresentation({
    cue: ordinaryCue,
    eventId,
    trigger,
    readStoryEventIds: [eventId],
    mode: "first-time",
  }).kind, "skip");
  const compact = resolveStoryBattleBarkPresentation({
    cue: ordinaryCue,
    eventId,
    trigger,
    readStoryEventIds: [eventId],
    mode: "compact",
  });
  assert.deepEqual(compact, { kind: "brief", label: storyBattleBriefLabel(trigger) });
  assert.equal(compact.label, "絡手を確認");
  assert.equal(resolveStoryBattleBarkPresentation({
    cue: ordinaryCue,
    eventId,
    trigger,
    readStoryEventIds: [eventId],
    mode: "all",
  }).kind, "full");
  assert.deepEqual(resolveStoryBattleBarkPresentation({
    cue: null,
    eventId,
    trigger,
    readStoryEventIds: [],
    mode: "all",
  }), { kind: "none", label: null });
});

test("metadata-derived cues preserve exact line indexes and declaration order", () => {
  const allHeavySpeakers = resolveStoryBattleBarkCue({
    state: createStoryBattleBarkState(),
    eventId: "stage-sawara-alert-v070",
    trigger: "heavy-enemy",
    deployedKinds: ["kumaverson", "crazy-king"],
  });
  assert.equal(allHeavySpeakers.reason, "queued");
  assert.deepEqual(allHeavySpeakers.cue.lines.map(({ lineIndex }) => lineIndex), [2, 3, 4]);
  assert.deepEqual(
    allHeavySpeakers.cue.lines.map(({ text }) => text),
    STORY_EVENTS["stage-sawara-alert-v070"].lines.slice(2, 5).map(({ text }) => text),
  );

  const onlyKumaverson = resolveStoryBattleBarkCue({
    state: createStoryBattleBarkState(),
    eventId: "stage-sawara-alert-v070",
    trigger: "heavy-enemy",
    deployedKinds: ["kumaverson"],
  });
  assert.deepEqual(onlyKumaverson.cue.lines.map(({ lineIndex }) => lineIndex), [2]);

  const operatorAndNpc = resolveStoryBattleBarkCue({
    state: createStoryBattleBarkState(),
    eventId: "stage-station-platform-alert-v070",
    trigger: "ooze-seen",
    deployedKinds: [],
  });
  assert.deepEqual(operatorAndNpc.cue.lines.map(({ lineIndex }) => lineIndex), [0, 1]);
});

test("the TAKUYA approach exchange requires both Paissen and Kumaverson deployed", () => {
  const paissenOnly = resolveStoryBattleBarkCue({
    state: createStoryBattleBarkState(),
    eventId: "stage-takuya-warning-v070",
    trigger: "takuya-approach",
    deployedKinds: ["brawler"],
  });
  assert.equal(paissenOnly.cue, null);
  assert.equal(paissenOnly.reason, "no-eligible-lines");

  const both = resolveStoryBattleBarkCue({
    state: createStoryBattleBarkState(),
    eventId: "stage-takuya-warning-v070",
    trigger: "takuya-approach",
    deployedKinds: ["brawler", "kumaverson"],
  });
  assert.deepEqual(both.cue.lines.map(({ lineIndex, speaker }) => [lineIndex, speaker]), [
    [1, "パイセン"],
    [2, "クマバーソン"],
  ]);
});

test("a trigger is evaluated even with no eligible deployed speaker and never fires retroactively", () => {
  const missed = resolveStoryBattleBarkCue({
    state: createStoryBattleBarkState(),
    eventId: "stage-nishijin-alert-v070",
    trigger: "fast-enemy",
    deployedKinds: [],
  });
  assert.equal(missed.evaluated, true);
  assert.equal(missed.reason, "no-eligible-lines");
  assert.equal(missed.cue, null);
  assert.deepEqual(missed.state.evaluatedCueKeys, ["stage-nishijin-alert-v070:fast-enemy"]);

  const deployedLater = resolveStoryBattleBarkCue({
    state: missed.state,
    eventId: "stage-nishijin-alert-v070",
    trigger: "fast-enemy",
    deployedKinds: ["babayaga"],
  });
  assert.equal(deployedLater.evaluated, false);
  assert.equal(deployedLater.reason, "already-evaluated");
  assert.equal(deployedLater.cue, null);
  assert.deepEqual(deployedLater.state, missed.state);
});

test("the base-remains correction keeps the operator unconditional and playable speakers deployed-only", () => {
  const operatorOnly = resolveStoryBattleBarkCue({
    state: createStoryBattleBarkState(),
    eventId: "stage-takuya-base-remains-v070",
    trigger: "boss-defeated-base-remains",
    deployedKinds: [],
  });
  assert.deepEqual(operatorOnly.cue.lines.map(({ lineIndex, speaker }) => [lineIndex, speaker]), [[0, "いくらちゃん"]]);

  const full = resolveStoryBattleBarkCue({
    state: createStoryBattleBarkState(),
    eventId: "stage-takuya-base-remains-v070",
    trigger: "boss-defeated-base-remains",
    deployedKinds: ["babayaga", "brawler"],
  });
  assert.deepEqual(full.cue.lines.map(({ lineIndex }) => lineIndex), [0, 1, 2]);
  assert.deepEqual(full.cue.lines.map(({ speakerKind }) => speakerKind), [null, "babayaga", "brawler"]);
  assert.ok(full.cue.lines.every(({ mandatory }) => mandatory));
});

test("Stage 3 final resolves as a fixed non-blocking, voice-free cut", () => {
  const resolved = resolveStoryBattleBarkCue({
    state: createStoryBattleBarkState(),
    eventId: "stage-takuya-final-v070",
    trigger: "final-weakpoint-exposed",
    deployedKinds: [],
  });
  assert.equal(resolved.reason, "queued");
  assert.equal(resolved.cue.kind, "nonblocking-cut");
  assert.equal(resolved.cue.nonBlocking, true);
  assert.equal(resolved.cue.pausesBattle, false);
  assert.equal(resolved.cue.playVoice, false);
  assert.equal(resolved.cue.music, "silence");
  assert.deepEqual(
    resolved.cue.lines.map(({ speaker, text }) => [speaker, text]),
    STORY_EVENTS["stage-takuya-final-v070"].lines.map(({ speaker, text }) => [speaker, text]),
  );
  assert.ok(resolved.cue.lines.every(({ playVoice }) => playVoice === false));
});

test("unknown event-trigger pairs do not consume one-shot state", () => {
  const state = createStoryBattleBarkState();
  const resolved = resolveStoryBattleBarkCue({
    state,
    eventId: "stage-nishijin-alert-v070",
    trigger: "heavy-enemy",
    deployedKinds: ["kumaverson"],
  });
  assert.equal(resolved.reason, "unknown-event-trigger");
  assert.equal(resolved.evaluated, false);
  assert.deepEqual(resolved.state, state);
});

test("scripted multi-line cues display exactly one authored line at a time in order", () => {
  const { cue } = resolveStoryBattleBarkCue({
    state: createStoryBattleBarkState(),
    eventId: "stage-sawara-alert-v070",
    trigger: "heavy-enemy",
    deployedKinds: ["kumaverson", "crazy-king"],
  });
  const queued = queueScriptedBattleBarkCue({ runtime: createBattleBarkRuntime(), cue });
  assert.equal(queued.queued, true);
  assert.deepEqual(queued.runtime.active.map(({ text }) => text), [cue.lines[0].text]);
  assert.deepEqual(queued.runtime.pendingScripted.map(({ text }) => text), cue.lines.slice(1).map(({ text }) => text));
  assert.ok(queued.runtime.active.every(({ scripted, playVoice }) => scripted && playVoice === false));

  const second = advanceBattleBarkRuntime(queued.runtime, BATTLE_BARK_CONFIG.defaultDuration);
  assert.deepEqual(second.active.filter(({ scripted }) => scripted).map(({ text }) => text), [cue.lines[1].text]);
  const third = advanceBattleBarkRuntime(second, BATTLE_BARK_CONFIG.defaultDuration);
  assert.deepEqual(third.active.filter(({ scripted }) => scripted).map(({ text }) => text), [cue.lines[2].text]);
  const finished = advanceBattleBarkRuntime(third, BATTLE_BARK_CONFIG.defaultDuration);
  assert.deepEqual(finished.active.filter(({ scripted }) => scripted), []);
  assert.deepEqual(finished.pendingScripted, []);
});

test("pause discards normal chatter but freezes the active scripted line and FIFO tail", () => {
  const cue = resolveStoryBattleBarkCue({
    state: createStoryBattleBarkState(),
    eventId: "stage-takuya-final-v070",
    trigger: "final-weakpoint-exposed",
    deployedKinds: [],
  }).cue;
  let runtime = queueBattleBark({
    runtime: createBattleBarkRuntime(),
    event: { trigger: "victory", speakerKind: "crawler" },
    random: () => 0,
  }).runtime;
  runtime = queueScriptedBattleBarkCue({ runtime, cue }).runtime;
  const beforePause = {
    active: runtime.active.filter(({ scripted }) => scripted).map(({ text, remaining }) => [text, remaining]),
    pending: runtime.pendingScripted.map(({ text, remaining }) => [text, remaining]),
  };
  const paused = clearNonScriptedBattleBarks(runtime);
  assert.equal(paused.active.every(({ scripted }) => scripted), true);
  assert.deepEqual(
    paused.active.map(({ text, remaining }) => [text, remaining]),
    beforePause.active,
  );
  assert.deepEqual(
    paused.pendingScripted.map(({ text, remaining }) => [text, remaining]),
    beforePause.pending,
  );
  const resumed = advanceBattleBarkRuntime(paused, BATTLE_BARK_CONFIG.defaultDuration);
  assert.equal(resumed.active.find(({ scripted }) => scripted).text, cue.lines[1].text);
  assert.match(gameSource, /clearNonScriptedBattleBarks\(g\.battleBarks\)/);
});

test("a lethal threshold crossing queues the fixed final before base-remains lines", () => {
  const finalCue = resolveStoryBattleBarkCue({
    state: createStoryBattleBarkState(),
    eventId: "stage-takuya-final-v070",
    trigger: "final-weakpoint-exposed",
    deployedKinds: ["brawler", "babayaga"],
  }).cue;
  const remainsCue = resolveStoryBattleBarkCue({
    state: createStoryBattleBarkState(),
    eventId: "stage-takuya-base-remains-v070",
    trigger: "boss-defeated-base-remains",
    deployedKinds: ["brawler", "babayaga"],
  }).cue;
  const finalQueued = queueScriptedBattleBarkCue({ runtime: createBattleBarkRuntime(), cue: finalCue });
  const bothQueued = queueScriptedBattleBarkCue({ runtime: finalQueued.runtime, cue: remainsCue });
  assert.deepEqual(
    [
      ...bothQueued.runtime.active.filter(({ scripted }) => scripted),
      ...bothQueued.runtime.pendingScripted,
    ].map(({ text }) => text),
    [...finalCue.lines, ...remainsCue.lines].map(({ text }) => text),
  );
});

test("large time steps consume scripted lines sequentially instead of showing them together", () => {
  const { cue } = resolveStoryBattleBarkCue({
    state: createStoryBattleBarkState(),
    eventId: "stage-nishijin-alert-v070",
    trigger: "grouped-enemies",
    deployedKinds: [],
  });
  const queued = queueScriptedBattleBarkCue({ runtime: createBattleBarkRuntime(), cue });
  const advanced = advanceBattleBarkRuntime(queued.runtime, BATTLE_BARK_CONFIG.defaultDuration + .5);
  const activeScripted = advanced.active.filter(({ scripted }) => scripted);
  assert.equal(activeScripted.length, 1);
  assert.equal(activeScripted[0].text, cue.lines[1].text);
  assert.ok(Math.abs(activeScripted[0].remaining - (BATTLE_BARK_CONFIG.defaultDuration - .5)) < 1e-9);
});

test("scripted warnings outrank normal attack barks and duplicate cues are rejected", () => {
  let runtime = createBattleBarkRuntime();
  runtime = queueBattleBark({
    runtime,
    event: { trigger: "victory", speakerKind: "crawler" },
    random: () => 0,
  }).runtime;
  runtime = queueBattleBark({
    runtime,
    event: { trigger: "takuya-enraged", speakerKind: "crawler" },
    random: () => 0,
  }).runtime;
  assert.equal(runtime.active.length, 2);

  const { cue } = resolveStoryBattleBarkCue({
    state: createStoryBattleBarkState(),
    eventId: "stage-nishijin-alert-v070",
    trigger: "grouped-enemies",
    deployedKinds: [],
  });
  const queued = queueScriptedBattleBarkCue({ runtime, cue });
  assert.equal(queued.queued, true);
  assert.ok(queued.runtime.active.some(({ scriptedCueId }) => scriptedCueId === cue.id));
  assert.ok(queued.runtime.active.find(({ scriptedCueId }) => scriptedCueId === cue.id).priority > 100);

  const duplicate = queueScriptedBattleBarkCue({ runtime: queued.runtime, cue });
  assert.equal(duplicate.queued, false);
  assert.equal(duplicate.reason, "duplicate-scripted-cue");
  assert.equal(duplicate.runtime, queued.runtime);
});

test("separate scripted cues remain FIFO while each cue keeps its own line order", () => {
  const firstCue = resolveStoryBattleBarkCue({
    state: createStoryBattleBarkState(),
    eventId: "stage-nishijin-alert-v070",
    trigger: "grouped-enemies",
    deployedKinds: [],
  }).cue;
  const secondCue = resolveStoryBattleBarkCue({
    state: createStoryBattleBarkState(),
    eventId: "stage-station-platform-alert-v070",
    trigger: "ooze-seen",
    deployedKinds: [],
  }).cue;
  const first = queueScriptedBattleBarkCue({ runtime: createBattleBarkRuntime(), cue: firstCue });
  const second = queueScriptedBattleBarkCue({ runtime: first.runtime, cue: secondCue });
  assert.deepEqual(second.runtime.pendingScripted.map(({ text }) => text), [
    firstCue.lines[1].text,
    secondCue.lines[0].text,
    secondCue.lines[1].text,
  ]);

  const afterFirstCue = advanceBattleBarkRuntime(second.runtime, BATTLE_BARK_CONFIG.defaultDuration * 2);
  assert.deepEqual(afterFirstCue.active.filter(({ scripted }) => scripted).map(({ text }) => text), [secondCue.lines[0].text]);
});
