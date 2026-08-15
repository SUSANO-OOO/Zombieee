import { V100_EVENT_IDS, V100_STAGE_BY_ID } from "./v100Registry.js";
import { v100StoryEventFor, v100StoryEventIdsForStage } from "./v100StoryEvents.js";

export const V100_FLOW_PHASES = Object.freeze([
  "name", "event", "formation", "battle", "result", "post", "first-clear-post", "ending", "credits", "epilogue", "map",
]);

function stageNumberFor(stageId) {
  return V100_STAGE_BY_ID[stageId]?.number ?? 0;
}

function stateWith(state, patch) {
  return Object.freeze({ ...state, ...patch });
}

export function createV100StoryFlowState({ playerName = "", completedStageIds = [], readStoryEventIds = [] } = {}) {
  return Object.freeze({
    phase: playerName ? "event" : "name",
    eventId: playerName ? "v100:event:prologue" : null,
    stageId: null,
    stageNumber: null,
    playerName: playerName || null,
    completedStageIds: [...completedStageIds],
    readStoryEventIds: [...readStoryEventIds],
    pendingResult: null,
    firstClear: false,
    canSkip: Boolean(playerName),
    finalized: false,
    destination: playerName ? "prologue" : "name",
  });
}

export function startV100NamedCampaign(state, playerName) {
  if (!playerName || typeof playerName !== "string") return { accepted: false, reason: "name-required", state };
  if (state.phase !== "name") return { accepted: false, reason: "name-screen-not-active", state };
  return { accepted: true, state: stateWith(state, {
    phase: "event",
    eventId: "v100:event:prologue",
    playerName,
    destination: "prologue",
    canSkip: true,
  }) };
}

export function beginV100StageAttempt(state, stageId) {
  const stage = V100_STAGE_BY_ID[stageId];
  if (!stage) return { accepted: false, reason: "unknown-stage", state };
  if (stage.number > 1 && !state.completedStageIds.includes(stage.prerequisiteStageId)) return { accepted: false, reason: "stage-locked", state };
  if (!["map", "event"].includes(state.phase)) return { accepted: false, reason: "flow-busy", state };
  const eventId = v100StoryEventIdsForStage(stage.number)[0];
  return { accepted: true, state: stateWith(state, {
    phase: "event",
    eventId,
    stageId,
    stageNumber: stage.number,
    destination: "stage-pre",
    canSkip: true,
    pendingResult: null,
    finalized: false,
  }) };
}

export function completeV100Event(state, { skipped = false } = {}) {
  if (!["event", "post", "first-clear-post", "ending", "credits", "epilogue"].includes(state.phase) || !state.eventId) return { accepted: false, reason: "event-not-active", state };
  const event = v100StoryEventFor(state.eventId);
  if (!event) return { accepted: false, reason: "unknown-event", state };
  if (state.eventId === "v100:event:prologue") return { accepted: true, state: stateWith(state, { phase: "map", eventId: null, destination: "map", canSkip: false }) };
  if (state.eventId.endsWith(":pre")) return { accepted: true, skipped, state: stateWith(state, { phase: "formation", eventId: null, destination: "formation", canSkip: false }) };
  if (state.eventId.endsWith(":post")) {
    return state.firstClear
      ? { accepted: true, skipped, state: stateWith(state, { phase: "first-clear-post", eventId: `${state.eventId.replace(":post", ":first-clear-post")}`, destination: "first-clear-post", canSkip: true }) }
      : { accepted: true, skipped, state: stateWith(state, { phase: "map", eventId: null, destination: "map", canSkip: false, finalized: true }) };
  }
  if (state.eventId.endsWith(":first-clear-post")) return finalizeV100Flow(state);
  if (state.eventId === "v100:event:ending") return { accepted: true, state: stateWith(state, { phase: "credits", eventId: "v100:event:credits", destination: "credits", canSkip: true }) };
  if (state.eventId === "v100:event:credits") return { accepted: true, state: stateWith(state, { phase: "epilogue", eventId: "v100:event:epilogue", destination: "epilogue", canSkip: true }) };
  if (state.eventId === "v100:event:epilogue") return { accepted: true, state: stateWith(state, { phase: "map", eventId: null, destination: "postgame-map", canSkip: false }) };
  return { accepted: false, reason: "event-transition-not-defined", state };
}

export function enterV100Battle(state) {
  if (state.phase !== "formation" || !state.stageId) return { accepted: false, reason: "formation-required", state };
  return { accepted: true, state: stateWith(state, { phase: "battle", destination: "battle", canSkip: false }) };
}

export function finishV100Battle(state, result) {
  if (state.phase !== "battle") return { accepted: false, reason: "battle-not-active", state };
  if (!result || result.stageId !== state.stageId) return { accepted: false, reason: "stage-result-mismatch", state };
  const firstClear = !state.completedStageIds.includes(state.stageId);
  return { accepted: true, state: stateWith(state, {
    phase: "result",
    destination: "result",
    pendingResult: { ...result },
    firstClear,
    canSkip: false,
    finalized: false,
  }) };
}

export function enterV100PostResult(state) {
  if (state.phase !== "result" || !state.pendingResult) return { accepted: false, reason: "result-not-active", state };
  if (state.pendingResult.won !== true) return { accepted: false, reason: "defeat-has-no-post", state };
  const eventId = v100StoryEventIdsForStage(stageNumberFor(state.stageId))[1];
  return { accepted: true, state: stateWith(state, { phase: "post", eventId, destination: "post", canSkip: true }) };
}

export function finalizeV100Flow(state) {
  if (state.phase !== "first-clear-post" || !state.pendingResult) return { accepted: false, reason: "first-clear-finalize-required", state };
  const completed = state.completedStageIds.includes(state.stageId) ? [...state.completedStageIds] : [...state.completedStageIds, state.stageId];
  if (state.stageNumber === 30) return { accepted: true, state: stateWith(state, {
    phase: "ending",
    eventId: "v100:event:ending",
    destination: "ending",
    completedStageIds: completed,
    canSkip: true,
    finalized: true,
  }) };
  return { accepted: true, state: stateWith(state, { phase: "map", eventId: null, destination: "map", completedStageIds: completed, canSkip: false, finalized: true }) };
}

export function defeatV100Flow(state) {
  if (state.phase !== "result" || state.pendingResult?.won === true) return { accepted: false, reason: "defeat-result-required", state };
  return { accepted: true, state: stateWith(state, { phase: "formation", eventId: null, pendingResult: null, destination: "formation", canSkip: false, finalized: true }) };
}

export function skipV100StoryEvent(state) {
  if (state.phase !== "event" || !state.canSkip) return { accepted: false, reason: "skip-blocked", state };
  return completeV100Event(state, { skipped: true });
}

export function markV100FlowEventRead(state, eventId) {
  if (!V100_EVENT_IDS.includes(eventId)) return state;
  if (state.readStoryEventIds.includes(eventId)) return state;
  return stateWith(state, { readStoryEventIds: [...state.readStoryEventIds, eventId] });
}

export function v100StoryFlowContract() {
  return Object.freeze({
    order: ["name", "prologue", "stage-pre", "formation", "battle", "result", "stage-post", "first-clear-finalize", "map"],
    defeatDestination: "formation",
    stage30Destination: ["ending", "credits", "epilogue", "postgame-map"],
    skipCannotCross: ["formation", "battle", "result", "first-clear-finalize"],
  });
}
