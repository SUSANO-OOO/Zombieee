const STABLE_ID_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,95}$/u;
const SAFE_DISPLAY_TEXT_PATTERN = /^[^<>\u0000-\u001f\u007f]{1,96}$/u;
const EVENT_KINDS = Object.freeze([
  "battle-event",
  "side-mission",
  "high-difficulty-operation",
  "challenge-mode",
  "timed-event",
]);
const RUN_OUTCOMES = Object.freeze(["won", "lost", "withdrawn"]);
const EVENT_PROGRESS_SCHEMA_VERSION = 1;
const EVENT_HISTORY_LIMIT = 100;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function requireStableId(value, field) {
  if (typeof value !== "string" || !STABLE_ID_PATTERN.test(value)) {
    throw new TypeError(`${field} must be a stable lowercase ID`);
  }
  return value;
}

function requireDisplayText(value, field) {
  if (typeof value !== "string" || !SAFE_DISPLAY_TEXT_PATTERN.test(value.trim())) {
    throw new TypeError(`${field} must be short plain text without markup or control characters`);
  }
  return value.trim();
}

function canonicalTimestamp(value, field) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new TypeError(`${field} must be an ISO timestamp`);
  }
  const canonical = new Date(value).toISOString();
  if (canonical !== value) throw new TypeError(`${field} must be a canonical ISO timestamp`);
  return canonical;
}

function normalizeTimestamp(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function requireSchedule(schedule, eventId) {
  if (!isRecord(schedule) || !["permanent", "timed"].includes(schedule.type)) {
    throw new TypeError(`${eventId} schedule must be permanent or timed`);
  }
  if (schedule.type === "permanent") {
    if (Array.isArray(schedule.windows) && schedule.windows.length > 0) {
      throw new TypeError(`${eventId} permanent schedule cannot declare windows`);
    }
    return Object.freeze({ type: "permanent", windows: Object.freeze([]) });
  }
  if (!Array.isArray(schedule.windows) || schedule.windows.length === 0) {
    throw new TypeError(`${eventId} timed schedule requires at least one window`);
  }
  const occurrenceIds = new Set();
  const windows = schedule.windows.map((window, index) => {
    if (!isRecord(window)) throw new TypeError(`${eventId} window ${index} must be an object`);
    const occurrenceId = requireStableId(window.occurrenceId, `${eventId}.occurrenceId`);
    if (occurrenceIds.has(occurrenceId)) throw new TypeError(`${eventId} has a duplicate occurrenceId`);
    occurrenceIds.add(occurrenceId);
    const startsAt = canonicalTimestamp(window.startsAt, `${eventId}.startsAt`);
    const endsAt = canonicalTimestamp(window.endsAt, `${eventId}.endsAt`);
    if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new RangeError(`${eventId} window must end after it starts`);
    return Object.freeze({ occurrenceId, startsAt, endsAt });
  }).sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  for (let index = 1; index < windows.length; index += 1) {
    if (Date.parse(windows[index].startsAt) < Date.parse(windows[index - 1].endsAt)) {
      throw new RangeError(`${eventId} timed windows cannot overlap`);
    }
  }
  return Object.freeze({ type: "timed", windows: Object.freeze(windows) });
}

export function registerEventDefinition(candidate) {
  if (!isRecord(candidate)) throw new TypeError("Event definition must be an object");
  const id = requireStableId(candidate.id, "event.id");
  if (!EVENT_KINDS.includes(candidate.eventKind)) throw new TypeError(`${id} has an unknown eventKind`);
  const displayName = requireDisplayText(candidate.displayName, `${id}.displayName`);
  const summary = requireDisplayText(candidate.summary, `${id}.summary`);
  if (!isRecord(candidate.mission)) throw new TypeError(`${id}.mission must be an object`);
  const mission = Object.freeze({
    stageId: requireStableId(candidate.mission.stageId, `${id}.mission.stageId`),
    difficultyId: requireStableId(candidate.mission.difficultyId, `${id}.mission.difficultyId`),
  });
  const schedule = requireSchedule(candidate.schedule, id);
  const rewardPolicy = candidate.rewardPolicy ?? "none";
  if (!["none", "campaign-standard"].includes(rewardPolicy)) {
    throw new TypeError(`${id}.rewardPolicy must be none or campaign-standard`);
  }
  return deepFreeze({
    id,
    displayName,
    summary,
    eventKind: candidate.eventKind,
    mission,
    schedule,
    rewardPolicy,
    fixtureOnly: candidate.fixtureOnly === true,
    aliases: Array.isArray(candidate.aliases)
      ? [...new Set(candidate.aliases.map((alias) => requireDisplayText(alias, `${id}.alias`)))]
      : [],
  });
}

const fixtureDefinitions = [
  {
    id: "battle-event:v075-radio-intercept",
    displayName: "戦闘中イベント接続試験",
    summary: "通常戦闘へ短い戦闘イベントを差し込む恒久fixture",
    eventKind: "battle-event",
    mission: {
      stageId: "stage-nishijin-shopping-street",
      difficultyId: "difficulty:standard",
    },
    schedule: { type: "permanent" },
    rewardPolicy: "none",
    fixtureOnly: true,
  },
  {
    id: "side-mission:v075-relay-sweep",
    displayName: "サイド任務接続試験",
    summary: "既存ステージを再利用する恒久サイド任務fixture",
    eventKind: "side-mission",
    mission: {
      stageId: "stage-nishijin-station-gate",
      difficultyId: "difficulty:standard",
    },
    schedule: { type: "permanent" },
    rewardPolicy: "none",
    fixtureOnly: true,
  },
  {
    id: "operation:v075-red-zone",
    displayName: "高難易度作戦接続試験",
    summary: "通常戦闘部品へ難易度指定を渡す恒久作戦fixture",
    eventKind: "high-difficulty-operation",
    mission: {
      stageId: "stage-nishijin-defense-line-takuya",
      difficultyId: "difficulty:high",
    },
    schedule: { type: "permanent" },
    rewardPolicy: "none",
    fixtureOnly: true,
  },
  {
    id: "challenge:v075-three-stage-session",
    displayName: "Challenge Mode接続試験",
    summary: "将来の三ステージsessionを通常戦闘へ接続する恒久fixture",
    eventKind: "challenge-mode",
    mission: {
      stageId: "stage-nishijin-shopping-street",
      difficultyId: "difficulty:challenge",
    },
    schedule: { type: "permanent" },
    rewardPolicy: "none",
    fixtureOnly: true,
  },
  {
    id: "timed-event:v075-foundation-drill",
    displayName: "期間イベント復刻接続試験",
    summary: "終了済み開催と復刻開催を同じstable IDで扱うfixture",
    eventKind: "timed-event",
    mission: {
      stageId: "stage-nishijin-station-platform",
      difficultyId: "difficulty:event",
    },
    schedule: {
      type: "timed",
      windows: [
        {
          occurrenceId: "timed-event:v075-foundation-drill:first",
          startsAt: "2026-01-01T00:00:00.000Z",
          endsAt: "2026-02-01T00:00:00.000Z",
        },
        {
          occurrenceId: "timed-event:v075-foundation-drill:rerun-1",
          startsAt: "2026-07-01T00:00:00.000Z",
          endsAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    },
    rewardPolicy: "none",
    fixtureOnly: true,
  },
].map(registerEventDefinition);

function frozenIndex(registry) {
  const index = Object.create(null);
  for (const definition of registry) index[definition.id] = definition;
  return deepFreeze(index);
}

export const EVENT_FOUNDATION_FIXTURE_REGISTRY = deepFreeze(fixtureDefinitions);
export const EVENT_FOUNDATION_FIXTURE_BY_ID = frozenIndex(EVENT_FOUNDATION_FIXTURE_REGISTRY);
export const EVENT_FOUNDATION_REGISTRY = deepFreeze([]);
export const EVENT_FOUNDATION_BY_ID = frozenIndex(EVENT_FOUNDATION_REGISTRY);
export const EVENT_FOUNDATION_CONTENT = deepFreeze({
  events: EVENT_FOUNDATION_REGISTRY.filter(({ eventKind }) => eventKind === "battle-event"),
  sideEvents: EVENT_FOUNDATION_REGISTRY.filter(({ eventKind }) => (
    eventKind === "side-mission" || eventKind === "high-difficulty-operation"
  )),
  challenges: EVENT_FOUNDATION_REGISTRY.filter(({ eventKind }) => eventKind === "challenge-mode"),
  timedEvents: EVENT_FOUNDATION_REGISTRY.filter(({ eventKind }) => eventKind === "timed-event"),
});

function registryIndex(registry = EVENT_FOUNDATION_REGISTRY) {
  const definitions = [];
  for (const candidate of Array.isArray(registry) ? registry : []) {
    try {
      definitions.push(registerEventDefinition(candidate));
    } catch {
      // Invalid developer or imported definitions are excluded from runtime lookup.
    }
  }
  const invalidIds = new Set();
  const knownIds = new Set();
  const occurrenceOwners = new Map();
  for (const definition of definitions) {
    if (knownIds.has(definition.id)) invalidIds.add(definition.id);
    knownIds.add(definition.id);
    const occurrenceIds = definition.schedule.type === "permanent"
      ? [`${definition.id}:permanent`]
      : definition.schedule.windows.map(({ occurrenceId }) => occurrenceId);
    for (const occurrenceId of occurrenceIds) {
      const owner = occurrenceOwners.get(occurrenceId);
      if (owner && owner !== definition.id) {
        invalidIds.add(owner);
        invalidIds.add(definition.id);
      } else {
        occurrenceOwners.set(occurrenceId, definition.id);
      }
    }
  }
  const index = new Map();
  for (const definition of definitions) {
    if (!invalidIds.has(definition.id)) index.set(definition.id, definition);
  }
  return index;
}

function occurrenceBelongsToEvent(event, occurrenceId, startedAt = null) {
  if (!event || typeof occurrenceId !== "string" || !STABLE_ID_PATTERN.test(occurrenceId)) return false;
  if (event.schedule.type === "permanent") return occurrenceId === `${event.id}:permanent`;
  const window = event.schedule.windows.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (!window) return false;
  if (startedAt === null) return true;
  const instant = Date.parse(startedAt);
  return instant >= Date.parse(window.startsAt) && instant < Date.parse(window.endsAt);
}

export function validateEventFoundationRegistry({
  stageIds = [],
  difficultyIds = [],
  registry = EVENT_FOUNDATION_REGISTRY,
} = {}) {
  const knownStages = new Set(stageIds);
  const knownDifficulties = new Set(difficultyIds);
  const ids = new Set();
  const occurrenceOwners = new Map();
  const errors = [];
  for (const candidate of Array.isArray(registry) ? registry : []) {
    let definition;
    try {
      definition = registerEventDefinition(candidate);
    } catch {
      errors.push(`${String(candidate?.id ?? "unknown")}:invalid-definition`);
      continue;
    }
    if (ids.has(definition.id)) errors.push(`${definition.id}:duplicate-id`);
    ids.add(definition.id);
    const occurrenceIds = definition.schedule.type === "permanent"
      ? [`${definition.id}:permanent`]
      : definition.schedule.windows.map(({ occurrenceId }) => occurrenceId);
    for (const occurrenceId of occurrenceIds) {
      const owner = occurrenceOwners.get(occurrenceId);
      if (owner && owner !== definition.id) {
        errors.push(`${definition.id}:duplicate-occurrence:${occurrenceId}`);
      } else {
        occurrenceOwners.set(occurrenceId, definition.id);
      }
    }
    if (!knownStages.has(definition.mission.stageId)) errors.push(`${definition.id}:unknown-stage`);
    if (!knownDifficulties.has(definition.mission.difficultyId)) errors.push(`${definition.id}:unknown-difficulty`);
  }
  return deepFreeze({ ok: errors.length === 0, errors });
}

export function eventAvailabilityAt(
  definitionOrId,
  now = new Date().toISOString(),
  { registry = EVENT_FOUNDATION_REGISTRY } = {},
) {
  const definition = typeof definitionOrId === "string"
    ? registryIndex(registry).get(definitionOrId)
    : registerEventDefinition(definitionOrId);
  if (!definition) throw new RangeError(`Unknown event: ${String(definitionOrId)}`);
  const instant = Date.parse(canonicalTimestamp(now, "now"));
  if (definition.schedule.type === "permanent") {
    return deepFreeze({
      state: "active",
      phase: "permanent",
      occurrenceId: `${definition.id}:permanent`,
      startsAt: null,
      endsAt: null,
      nextStartsAt: null,
    });
  }
  const windows = definition.schedule.windows;
  const activeIndex = windows.findIndex((window) => (
    instant >= Date.parse(window.startsAt) && instant < Date.parse(window.endsAt)
  ));
  if (activeIndex >= 0) {
    const active = windows[activeIndex];
    return deepFreeze({
      state: "active",
      phase: activeIndex === 0 ? "first-run" : "rerun",
      occurrenceId: active.occurrenceId,
      startsAt: active.startsAt,
      endsAt: active.endsAt,
      nextStartsAt: windows[activeIndex + 1]?.startsAt ?? null,
    });
  }
  const next = windows.find((window) => instant < Date.parse(window.startsAt)) ?? null;
  const priorCount = windows.filter((window) => instant >= Date.parse(window.endsAt)).length;
  return deepFreeze({
    state: next ? "upcoming" : "ended",
    phase: next && priorCount > 0 ? "awaiting-rerun" : next ? "awaiting-first-run" : "ended",
    occurrenceId: null,
    startsAt: next?.startsAt ?? null,
    endsAt: next?.endsAt ?? null,
    nextStartsAt: next?.startsAt ?? null,
  });
}

export function createEventFoundationProgress() {
  return {
    schemaVersion: EVENT_PROGRESS_SCHEMA_VERSION,
    activeRun: null,
    runHistory: [],
    processedRunIds: [],
    attemptCountsByEvent: {},
    completedEventIds: [],
    completedOccurrenceIds: [],
  };
}

function safeRunRecord(candidate, { active = false, eventsById = new Map() } = {}) {
  if (!isRecord(candidate)) return null;
  if (!STABLE_ID_PATTERN.test(candidate.runId ?? "")) return null;
  if (!STABLE_ID_PATTERN.test(candidate.eventId ?? "")) return null;
  const event = eventsById.get(candidate.eventId);
  if (!event) return null;
  const startedAt = normalizeTimestamp(candidate.startedAt);
  if (!startedAt) return null;
  if (!occurrenceBelongsToEvent(event, candidate.occurrenceId, startedAt)) return null;
  if (active) {
    return {
      runId: candidate.runId,
      eventId: event.id,
      occurrenceId: candidate.occurrenceId,
      stageId: event.mission.stageId,
      difficultyId: event.mission.difficultyId,
      status: "in-progress",
      startedAt,
      endedAt: null,
      outcome: null,
    };
  }
  const endedAt = normalizeTimestamp(candidate.endedAt);
  if (!endedAt || Date.parse(endedAt) < Date.parse(startedAt) || !RUN_OUTCOMES.includes(candidate.outcome)) return null;
  return {
    runId: candidate.runId,
    eventId: event.id,
    occurrenceId: candidate.occurrenceId,
    stageId: event.mission.stageId,
    difficultyId: event.mission.difficultyId,
    status: "finished",
    startedAt,
    endedAt,
    outcome: candidate.outcome,
  };
}

export function normalizeEventFoundationProgress(raw, { registry = EVENT_FOUNDATION_REGISTRY } = {}) {
  const source = isRecord(raw) ? raw : {};
  const eventsById = registryIndex(registry);
  const historyByRunId = new Map();
  for (const candidate of Array.isArray(source.runHistory) ? source.runHistory : []) {
    const run = safeRunRecord(candidate, { eventsById });
    if (run) historyByRunId.set(run.runId, run);
  }
  const allHistory = [...historyByRunId.values()]
    .sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  const runHistory = allHistory
    .slice(-EVENT_HISTORY_LIMIT);
  const processedRunIds = [...new Set([
    ...(Array.isArray(source.processedRunIds)
      ? source.processedRunIds.filter((runId) => typeof runId === "string" && STABLE_ID_PATTERN.test(runId))
      : []),
    ...allHistory.map(({ runId }) => runId),
  ])];
  const historyAttemptCounts = new Map();
  for (const { eventId } of allHistory) {
    historyAttemptCounts.set(eventId, (historyAttemptCounts.get(eventId) ?? 0) + 1);
  }
  const storedAttemptCounts = isRecord(source.attemptCountsByEvent)
    ? Object.entries(source.attemptCountsByEvent)
      .filter(([eventId, count]) => (
        eventsById.has(eventId)
        && Number.isSafeInteger(count)
        && count >= 0
      ))
    : [];
  const attemptCountsByEvent = Object.fromEntries([
    ...eventsById.keys(),
  ].map((eventId) => [
    eventId,
    Math.max(
      Number(storedAttemptCounts.find(([storedEventId]) => storedEventId === eventId)?.[1] ?? 0),
      historyAttemptCounts.get(eventId) ?? 0,
    ),
  ]).filter(([, count]) => count > 0));
  const completedEventIds = [...new Set([
    ...(Array.isArray(source.completedEventIds)
      ? source.completedEventIds.filter((eventId) => eventsById.has(eventId))
      : []),
    ...allHistory.filter(({ outcome }) => outcome === "won").map(({ eventId }) => eventId),
  ])];
  const completedOccurrenceIds = [...new Set([
    ...(Array.isArray(source.completedOccurrenceIds)
      ? source.completedOccurrenceIds.filter((occurrenceId) => (
        [...eventsById.values()].some((event) => occurrenceBelongsToEvent(event, occurrenceId))
      ))
      : []),
    ...allHistory.filter(({ outcome }) => outcome === "won").map(({ occurrenceId }) => occurrenceId),
  ])];
  const activeRun = safeRunRecord(source.activeRun, { active: true, eventsById });
  if (activeRun && processedRunIds.includes(activeRun.runId)) {
    return {
      ...createEventFoundationProgress(),
      runHistory,
      processedRunIds,
      attemptCountsByEvent,
      completedEventIds,
      completedOccurrenceIds,
    };
  }
  return {
    schemaVersion: EVENT_PROGRESS_SCHEMA_VERSION,
    activeRun,
    runHistory,
    processedRunIds,
    attemptCountsByEvent,
    completedEventIds,
    completedOccurrenceIds,
  };
}

export function startEventRun(
  progress,
  eventId,
  { now, runId, registry = EVENT_FOUNDATION_REGISTRY } = {},
) {
  const definition = registryIndex(registry).get(eventId);
  if (!definition) throw new RangeError(`Unknown event: ${String(eventId)}`);
  const timestamp = canonicalTimestamp(now, "now");
  const normalizedRunId = requireStableId(runId, "runId");
  const current = normalizeEventFoundationProgress(progress, { registry });
  if (current.activeRun) {
    return deepFreeze({ applied: false, reason: "run-already-active", progress: current, run: current.activeRun });
  }
  if (current.processedRunIds.includes(normalizedRunId)) {
    return deepFreeze({ applied: false, reason: "run-id-already-processed", progress: current, run: null });
  }
  const availability = eventAvailabilityAt(definition, timestamp, { registry });
  if (availability.state !== "active") {
    return deepFreeze({ applied: false, reason: availability.state, progress: current, run: null });
  }
  const run = {
    runId: normalizedRunId,
    eventId: definition.id,
    occurrenceId: availability.occurrenceId,
    stageId: definition.mission.stageId,
    difficultyId: definition.mission.difficultyId,
    status: "in-progress",
    startedAt: timestamp,
    endedAt: null,
    outcome: null,
  };
  return deepFreeze({
    applied: true,
    reason: "started",
    run,
    progress: { ...current, activeRun: run },
  });
}

export function finishEventRun(
  progress,
  { runId, outcome, endedAt, registry = EVENT_FOUNDATION_REGISTRY } = {},
) {
  const current = normalizeEventFoundationProgress(progress, { registry });
  const normalizedRunId = requireStableId(runId, "runId");
  if (!RUN_OUTCOMES.includes(outcome)) throw new TypeError("outcome must be won, lost, or withdrawn");
  const timestamp = canonicalTimestamp(endedAt, "endedAt");
  if (!current.activeRun || current.activeRun.runId !== normalizedRunId) {
    const prior = current.runHistory.find((run) => run.runId === normalizedRunId) ?? null;
    return deepFreeze({
      applied: false,
      reason: prior || current.processedRunIds.includes(normalizedRunId)
        ? "run-already-finished"
        : "active-run-mismatch",
      progress: current,
      run: prior,
    });
  }
  if (Date.parse(timestamp) < Date.parse(current.activeRun.startedAt)) {
    throw new RangeError("endedAt cannot precede startedAt");
  }
  const run = {
    ...current.activeRun,
    status: "finished",
    endedAt: timestamp,
    outcome,
  };
  const progressAfter = normalizeEventFoundationProgress({
    ...current,
    activeRun: null,
    runHistory: [...current.runHistory, run],
    processedRunIds: [...current.processedRunIds, run.runId],
    attemptCountsByEvent: {
      ...current.attemptCountsByEvent,
      [run.eventId]: (current.attemptCountsByEvent[run.eventId] ?? 0) + 1,
    },
  }, { registry });
  return deepFreeze({ applied: true, reason: "finished", progress: progressAfter, run });
}

export function eventDisplayView(
  definitionOrId,
  { now, progress, registry = EVENT_FOUNDATION_REGISTRY } = {},
) {
  const definition = typeof definitionOrId === "string"
    ? registryIndex(registry).get(definitionOrId)
    : registerEventDefinition(definitionOrId);
  if (!definition) throw new RangeError(`Unknown event: ${String(definitionOrId)}`);
  const availability = eventAvailabilityAt(definition, now, { registry });
  const current = normalizeEventFoundationProgress(progress, { registry });
  const attempts = current.runHistory.filter(({ eventId }) => eventId === definition.id);
  const statusLabel = availability.state === "active"
    ? availability.phase === "rerun" ? "復刻開催中" : "挑戦可能"
    : availability.state === "upcoming"
      ? availability.phase === "awaiting-rerun" ? "復刻予定" : "開催予定"
      : "開催終了";
  return deepFreeze({
    id: definition.id,
    displayName: definition.displayName,
    summary: definition.summary,
    eventKind: definition.eventKind,
    status: availability.state,
    statusLabel,
    occurrenceId: availability.occurrenceId,
    startsAt: availability.startsAt,
    endsAt: availability.endsAt,
    stageId: definition.mission.stageId,
    difficultyId: definition.mission.difficultyId,
    canStart: availability.state === "active" && current.activeRun === null,
    attempts: current.attemptCountsByEvent[definition.id] ?? attempts.length,
    cleared: current.completedEventIds.includes(definition.id),
    fixtureOnly: definition.fixtureOnly,
  });
}
