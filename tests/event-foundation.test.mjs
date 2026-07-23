import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMPAIGN_SAVE_SCHEMA_VERSION,
  CAMPAIGN_STAGES,
  activeCampaignEventBattleRequest,
  campaignEventViews,
  createDefaultCampaignSave,
  deserializeCampaignSave,
  finishCampaignEvent,
  migrateCampaignSave,
  serializeCampaignSave,
  startCampaignEvent,
  verifyCampaignSaveIntegrity,
} from "../app/campaign.js";
import {
  CONTENT_REGISTRY,
} from "../app/content/registry.js";
import {
  EVENT_FOUNDATION_CONTENT,
  EVENT_FOUNDATION_FIXTURE_BY_ID,
  EVENT_FOUNDATION_FIXTURE_REGISTRY,
  EVENT_FOUNDATION_REGISTRY,
  createEventFoundationProgress,
  eventAvailabilityAt,
  eventDisplayView,
  finishEventRun,
  normalizeEventFoundationProgress,
  registerEventDefinition,
  startEventRun,
  validateEventFoundationRegistry,
} from "../app/eventFoundation.js";

const timedEventId = "timed-event:v075-foundation-drill";
const permanentEventId = "side-mission:v075-relay-sweep";
const fixtureRegistry = EVENT_FOUNDATION_FIXTURE_REGISTRY;

test("five minimal fixtures cover every required event family on the standard battle engine", () => {
  assert.equal(EVENT_FOUNDATION_REGISTRY.length, 0);
  assert.equal(EVENT_FOUNDATION_FIXTURE_REGISTRY.length, 5);
  assert.deepEqual(
    EVENT_FOUNDATION_FIXTURE_REGISTRY.map(({ eventKind }) => eventKind).sort(),
    [
      "battle-event",
      "challenge-mode",
      "high-difficulty-operation",
      "side-mission",
      "timed-event",
    ],
  );
  assert.equal(EVENT_FOUNDATION_CONTENT.events.length, 0);
  assert.equal(EVENT_FOUNDATION_CONTENT.sideEvents.length, 0);
  assert.equal(EVENT_FOUNDATION_CONTENT.challenges.length, 0);
  assert.equal(EVENT_FOUNDATION_CONTENT.timedEvents.length, 0);
  assert.equal(EVENT_FOUNDATION_FIXTURE_REGISTRY.every(({ fixtureOnly }) => fixtureOnly), true);
  assert.equal(EVENT_FOUNDATION_FIXTURE_REGISTRY.every(({ rewardPolicy }) => rewardPolicy === "none"), true);
  assert.equal(
    ["events", "sideEvents", "challenges", "timedEvents"].flatMap(
      (collection) => CONTENT_REGISTRY[collection],
    ).some(({ id }) => EVENT_FOUNDATION_FIXTURE_BY_ID[id]),
    false,
  );

  const validation = validateEventFoundationRegistry({
    stageIds: CAMPAIGN_STAGES.map(({ id }) => id),
    difficultyIds: CONTENT_REGISTRY.difficulty.map(({ id }) => id),
    registry: fixtureRegistry,
  });
  assert.deepEqual(validation, { ok: true, errors: [] });
});

test("registration rejects markup, command-like IDs, invalid time ranges, and overlapping reruns", () => {
  const base = {
    id: "side-mission:test-safe",
    displayName: "安全な任務",
    summary: "通常戦闘を再利用するfixture",
    eventKind: "side-mission",
    mission: {
      stageId: "stage-nishijin-shopping-street",
      difficultyId: "difficulty:standard",
    },
    schedule: { type: "permanent" },
  };
  assert.throws(
    () => registerEventDefinition({ ...base, displayName: "<img src=x onerror=alert(1)>" }),
    /plain text/u,
  );
  assert.throws(
    () => registerEventDefinition({ ...base, id: "side-mission:test;rm-rf" }),
    /stable lowercase ID/u,
  );
  assert.throws(
    () => registerEventDefinition({ ...base, rewardPolicy: "campaign-standrad" }),
    /rewardPolicy/u,
  );
  assert.throws(
    () => registerEventDefinition({
      ...base,
      schedule: {
        type: "timed",
        windows: [{
          occurrenceId: "side-mission:test-safe:first",
          startsAt: "2026-02-01T00:00:00.000Z",
          endsAt: "2026-01-01T00:00:00.000Z",
        }],
      },
    }),
    /end after/u,
  );
  assert.throws(
    () => registerEventDefinition({
      ...base,
      schedule: {
        type: "timed",
        windows: [
          {
            occurrenceId: "side-mission:test-safe:first",
            startsAt: "2026-01-01T00:00:00.000Z",
            endsAt: "2026-02-01T00:00:00.000Z",
          },
          {
            occurrenceId: "side-mission:test-safe:rerun",
            startsAt: "2026-01-15T00:00:00.000Z",
            endsAt: "2026-03-01T00:00:00.000Z",
          },
        ],
      },
    }),
    /cannot overlap/u,
  );
});

test("permanent, ended, upcoming rerun, and active rerun states are deterministic", () => {
  assert.deepEqual(eventAvailabilityAt(
    permanentEventId,
    "2026-05-01T00:00:00.000Z",
    { registry: fixtureRegistry },
  ), {
    state: "active",
    phase: "permanent",
    occurrenceId: `${permanentEventId}:permanent`,
    startsAt: null,
    endsAt: null,
    nextStartsAt: null,
  });
  assert.deepEqual(eventAvailabilityAt(
    timedEventId,
    "2026-03-01T00:00:00.000Z",
    { registry: fixtureRegistry },
  ), {
    state: "upcoming",
    phase: "awaiting-rerun",
    occurrenceId: null,
    startsAt: "2026-07-01T00:00:00.000Z",
    endsAt: "2026-08-01T00:00:00.000Z",
    nextStartsAt: "2026-07-01T00:00:00.000Z",
  });
  assert.equal(eventAvailabilityAt(
    timedEventId,
    "2026-07-23T00:00:00.000Z",
    { registry: fixtureRegistry },
  ).phase, "rerun");
  assert.equal(eventAvailabilityAt(
    timedEventId,
    "2026-09-01T00:00:00.000Z",
    { registry: fixtureRegistry },
  ).state, "ended");
  assert.equal(eventDisplayView(timedEventId, {
    now: "2026-07-23T00:00:00.000Z",
    progress: createEventFoundationProgress(),
    registry: fixtureRegistry,
  }).statusLabel, "復刻開催中");
});

test("start and finish are receipt-safe, save-compatible, and reusable for reruns", () => {
  const started = startEventRun(createEventFoundationProgress(), permanentEventId, {
    now: "2026-07-23T01:00:00.000Z",
    runId: "event-run:test-permanent-1",
    registry: fixtureRegistry,
  });
  assert.equal(started.applied, true);
  assert.equal(started.run.stageId, EVENT_FOUNDATION_FIXTURE_BY_ID[permanentEventId].mission.stageId);
  assert.equal(startEventRun(started.progress, timedEventId, {
    now: "2026-07-23T01:01:00.000Z",
    runId: "event-run:test-overlap",
    registry: fixtureRegistry,
  }).reason, "run-already-active");

  const finished = finishEventRun(started.progress, {
    runId: started.run.runId,
    outcome: "won",
    endedAt: "2026-07-23T01:05:00.000Z",
    registry: fixtureRegistry,
  });
  assert.equal(finished.applied, true);
  assert.deepEqual(finished.progress.completedEventIds, [permanentEventId]);
  assert.deepEqual(finished.progress.completedOccurrenceIds, [`${permanentEventId}:permanent`]);
  assert.equal(finishEventRun(finished.progress, {
    runId: started.run.runId,
    outcome: "won",
    endedAt: "2026-07-23T01:06:00.000Z",
    registry: fixtureRegistry,
  }).reason, "run-already-finished");

  const replay = startEventRun(finished.progress, permanentEventId, {
    now: "2026-07-23T02:00:00.000Z",
    runId: "event-run:test-permanent-2",
    registry: fixtureRegistry,
  });
  assert.equal(replay.applied, true);
  assert.equal(replay.progress.runHistory.length, 1);
});

test("campaign save migration preserves event runs and routes them into the normal battle request", () => {
  const original = createDefaultCampaignSave();
  assert.equal(original.schemaVersion, CAMPAIGN_SAVE_SCHEMA_VERSION);
  assert.equal(CAMPAIGN_SAVE_SCHEMA_VERSION, 7);
  assert.deepEqual(original.eventFoundation, createEventFoundationProgress());

  const started = startCampaignEvent(original, timedEventId, {
    now: "2026-07-23T03:00:00.000Z",
    runId: "event-run:campaign-rerun-1",
    registry: fixtureRegistry,
  });
  assert.equal(started.result.applied, true);
  assert.deepEqual(activeCampaignEventBattleRequest(started.save, { registry: fixtureRegistry }), {
    engine: "standard-battle",
    eventId: timedEventId,
    runId: "event-run:campaign-rerun-1",
    occurrenceId: "timed-event:v075-foundation-drill:rerun-1",
    stageId: "stage-nishijin-station-platform",
    difficultyId: "difficulty:event",
  });
  assert.equal(campaignEventViews(started.save, {
    now: "2026-07-23T03:01:00.000Z",
    registry: fixtureRegistry,
  }).find(({ id }) => id === timedEventId).canStart, false);

  const restored = deserializeCampaignSave(
    serializeCampaignSave(started.save, { eventRegistry: fixtureRegistry }),
    { eventRegistry: fixtureRegistry },
  );
  assert.deepEqual(restored.eventFoundation, started.save.eventFoundation);
  const finished = finishCampaignEvent(restored, {
    runId: "event-run:campaign-rerun-1",
    outcome: "lost",
    endedAt: "2026-07-23T03:05:00.000Z",
    registry: fixtureRegistry,
  });
  assert.equal(finished.result.applied, true);
  assert.equal(activeCampaignEventBattleRequest(finished.save, { registry: fixtureRegistry }), null);
  assert.equal(finished.save.eventFoundation.runHistory[0].outcome, "lost");
  assert.deepEqual(migrateCampaignSave(finished.save, { eventRegistry: fixtureRegistry }), finished.save);
});

test("normalization discards unknown, malformed, duplicated, and oversized untrusted run data", () => {
  const valid = {
    runId: "event-run:valid",
    eventId: permanentEventId,
    occurrenceId: `${permanentEventId}:permanent`,
    stageId: "attacker-controlled-value",
    difficultyId: "attacker-controlled-value",
    status: "finished",
    startedAt: "2026-07-23T00:00:00.000Z",
    endedAt: "2026-07-23T00:01:00.000Z",
    outcome: "won",
  };
  const normalized = normalizeEventFoundationProgress({
    schemaVersion: 999,
    activeRun: { ...valid, status: "in-progress", endedAt: null, outcome: null },
    runHistory: [
      ...Array.from({ length: 120 }, (_, index) => ({
        ...valid,
        runId: `event-run:valid-${index}`,
      })),
      { ...valid, runId: "event-run:bad<script>" },
      { ...valid, eventId: "unknown:event" },
    ],
    completedEventIds: ["attacker-controlled"],
  }, { registry: fixtureRegistry });
  assert.equal(normalized.schemaVersion, 1);
  assert.equal(normalized.runHistory.length, 100);
  assert.equal(normalized.runHistory.every(({ stageId }) => (
    stageId === EVENT_FOUNDATION_FIXTURE_BY_ID[permanentEventId].mission.stageId
  )), true);
  assert.deepEqual(normalized.completedEventIds, [permanentEventId]);
});

test("hostile prototype keys and forged occurrence IDs are discarded without throwing", () => {
  const permanentOccurrenceId = `${permanentEventId}:permanent`;
  const base = {
    runId: "event-run:hostile",
    eventId: permanentEventId,
    occurrenceId: permanentOccurrenceId,
    status: "finished",
    startedAt: "2026-07-23T00:00:00.000Z",
    endedAt: "2026-07-23T00:01:00.000Z",
    outcome: "won",
  };
  const normalized = normalizeEventFoundationProgress({
    activeRun: { ...base, runId: "event-run:prototype", eventId: "__proto__", status: "in-progress" },
    runHistory: [
      { ...base, runId: "event-run:forged", occurrenceId: "forged:occurrence" },
      base,
    ],
    completedOccurrenceIds: ["forged:occurrence", permanentOccurrenceId],
  }, { registry: fixtureRegistry });
  assert.equal(normalized.activeRun, null);
  assert.deepEqual(normalized.runHistory.map(({ runId }) => runId), ["event-run:hostile"]);
  assert.deepEqual(normalized.completedOccurrenceIds, [permanentOccurrenceId]);
});

test("processed run receipts survive the bounded display history", () => {
  const occurrenceId = `${permanentEventId}:permanent`;
  const rawHistory = Array.from({ length: 101 }, (_, index) => ({
    runId: `event-run:receipt-${String(index).padStart(3, "0")}`,
    eventId: permanentEventId,
    occurrenceId,
    status: "finished",
    startedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    endedAt: new Date(Date.UTC(2026, 0, 1, 0, index, 30)).toISOString(),
    outcome: index === 0 ? "won" : "lost",
  }));
  const normalized = normalizeEventFoundationProgress(
    { runHistory: rawHistory },
    { registry: fixtureRegistry },
  );
  assert.equal(normalized.runHistory.length, 100);
  assert.equal(normalized.processedRunIds.length, 101);
  assert.deepEqual(normalized.completedEventIds, [permanentEventId]);
  assert.equal(normalized.attemptCountsByEvent[permanentEventId], 101);
  assert.deepEqual(eventDisplayView(permanentEventId, {
    now: "2026-07-23T04:00:00.000Z",
    progress: normalized,
    registry: fixtureRegistry,
  }), {
    id: permanentEventId,
    displayName: EVENT_FOUNDATION_FIXTURE_BY_ID[permanentEventId].displayName,
    summary: EVENT_FOUNDATION_FIXTURE_BY_ID[permanentEventId].summary,
    eventKind: "side-mission",
    status: "active",
    statusLabel: "挑戦可能",
    occurrenceId,
    startsAt: null,
    endsAt: null,
    stageId: EVENT_FOUNDATION_FIXTURE_BY_ID[permanentEventId].mission.stageId,
    difficultyId: "difficulty:standard",
    canStart: true,
    attempts: 101,
    cleared: true,
    fixtureOnly: true,
  });
  assert.equal(startEventRun(normalized, permanentEventId, {
    now: "2026-07-23T04:00:00.000Z",
    runId: rawHistory[0].runId,
    registry: fixtureRegistry,
  }).reason, "run-id-already-processed");
});

test("timed receipts require their authored window and occurrence IDs are globally unique", () => {
  const timed = EVENT_FOUNDATION_FIXTURE_BY_ID[timedEventId];
  const outsideWindow = normalizeEventFoundationProgress({
    runHistory: [{
      runId: "event-run:outside-window",
      eventId: timedEventId,
      occurrenceId: timed.schedule.windows[1].occurrenceId,
      status: "finished",
      startedAt: "2050-07-23T00:00:00.000Z",
      endedAt: "2050-07-23T00:01:00.000Z",
      outcome: "won",
    }],
  }, { registry: fixtureRegistry });
  assert.deepEqual(outsideWindow.runHistory, []);
  assert.deepEqual(outsideWindow.completedOccurrenceIds, []);

  const duplicateOccurrence = registerEventDefinition({
    ...timed,
    id: "timed-event:v075-duplicate-occurrence",
    displayName: "重複occurrence検査",
  });
  const validation = validateEventFoundationRegistry({
    stageIds: CAMPAIGN_STAGES.map(({ id }) => id),
    difficultyIds: CONTENT_REGISTRY.difficulty.map(({ id }) => id),
    registry: [timed, duplicateOccurrence],
  });
  assert.equal(validation.ok, false);
  assert.equal(validation.errors.some((error) => error.includes("duplicate-occurrence")), true);
});

test("current-schema integrity is checked before event registry migration", () => {
  const originalDefinition = registerEventDefinition({
    id: "side-mission:registry-drift",
    displayName: "Registry drift",
    summary: "Integrity ordering fixture",
    eventKind: "side-mission",
    mission: {
      stageId: "stage-nishijin-shopping-street",
      difficultyId: "difficulty:standard",
    },
    schedule: { type: "permanent" },
    rewardPolicy: "none",
  });
  const changedDefinition = registerEventDefinition({
    ...originalDefinition,
    mission: {
      ...originalDefinition.mission,
      stageId: "stage-nishijin-station-gate",
    },
  });
  const started = startCampaignEvent(
    { ...createDefaultCampaignSave(), campaignStarted: true, caps: 4321, supplies: 4321 },
    originalDefinition.id,
    {
      now: "2026-07-23T05:00:00.000Z",
      runId: "event-run:registry-drift",
      registry: [originalDefinition],
    },
  );
  const serialized = serializeCampaignSave(started.save, {
    eventRegistry: [originalDefinition],
  });
  const raw = JSON.parse(serialized);
  assert.equal(verifyCampaignSaveIntegrity(raw, { eventRegistry: [changedDefinition] }), true);
  const restored = deserializeCampaignSave(serialized, {
    eventRegistry: [changedDefinition],
  });
  assert.equal(restored.campaignStarted, true);
  assert.equal(restored.caps, 4321);
  assert.equal(restored.eventFoundation.activeRun.stageId, changedDefinition.mission.stageId);
});
