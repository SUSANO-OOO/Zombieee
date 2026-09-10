import test from "node:test";
import assert from "node:assert/strict";

import { V100_EVENT_IDS } from "../app/v100Registry.js";
import {
  V100_STORY_EVENTS,
  V100_STORY_SOURCE_LINE_COUNT,
  V100_STORY_SOURCE_SHA256,
  v100StoryEventView,
  v100StoryContract,
} from "../app/v100StoryEvents.js";
import {
  beginV100StageAttempt,
  completeV100Event,
  createV100StoryFlowState,
  defeatV100Flow,
  enterV100Battle,
  enterV100PostResult,
  finalizeV100Flow,
  finishV100Battle,
  skipV100StoryEvent,
} from "../app/v100StoryFlow.js";

test("canonical v10 story event registry is complete and source-bound", () => {
  assert.equal(Object.keys(V100_STORY_EVENTS).length, 94);
  assert.deepEqual(Object.keys(V100_STORY_EVENTS), V100_EVENT_IDS);
  assert.equal(V100_STORY_SOURCE_SHA256, "c7293d739998431c38f337a7ef8d4e724b74696537ff44ad8f0c30d854a017a4");
  assert.equal(V100_STORY_SOURCE_LINE_COUNT, 2681);
  assert.equal(v100StoryContract().creditsHasDialogue, false);
  assert.equal(v100StoryContract().creditsMusic, null);
  for (const event of Object.values(V100_STORY_EVENTS)) {
    for (const node of event.nodes) {
      if (node.kind === "dialogue" && node.portraitKind === "major") assert.notEqual(node.portraitOwner, "minor-human-shared-event-silhouette");
      assert.equal(node.text.includes("{{PLAYER\\_NAME}}"), false);
    }
  }
});

test("story rendering expands the current name without mutating the source registry", () => {
  const source = V100_STORY_EVENTS["v100:event:s01:post"].nodes.find((node) => node.text.includes("PLAYER"));
  assert.ok(source);
  const view = v100StoryEventView("v100:event:s01:post", "指揮官");
  assert.equal(view.nodes.some((node) => node.text.includes("指揮官")), true);
  assert.equal(V100_STORY_EVENTS["v100:event:s01:post"].nodes.some((node) => node.text.includes("指揮官")), false);
});

test("V1.0.0 stage flow cannot bypass battle/result/finalize and routes defeat safely", () => {
  let state = createV100StoryFlowState({ playerName: "指揮官" });
  let transition = beginV100StageAttempt(state, "stage-nishijin-shopping-street");
  assert.equal(transition.accepted, true);
  state = transition.state;
  state = completeV100Event(state).state;
  assert.equal(state.phase, "formation");
  assert.equal(skipV100StoryEvent(state).accepted, false);
  state = enterV100Battle(state).state;
  state = finishV100Battle(state, { stageId: state.stageId, won: false, stars: 0 }).state;
  assert.equal(enterV100PostResult(state).accepted, false);
  state = defeatV100Flow(state).state;
  assert.equal(state.phase, "formation");
});

test("victory requires post and first-clear finalize, with the Stage 30 ending chain", () => {
  let state = createV100StoryFlowState({ playerName: "指揮官", completedStageIds: [] });
  state = beginV100StageAttempt({ ...state, completedStageIds: [
    "stage-nishijin-shopping-street", "stage-sawara-ward-office", "stage-nishijin-defense-line-takuya", "stage-nishijin-station-gate", "stage-nishijin-station-platform", "stage-nishijin-station-tunnel-seal", "stage-university-hospital-approach", "stage-hospital-emergency-ward", "stage-hospital-evacuation-route", "stage-research-access", "stage-research-containment", "stage-research-freight-passage", "stage-logistics-relay", "stage-evacuation-freight-yard", "stage-t-plan-outer-core", "stage-t-plan-central-seal", "stage-bay-tower-service", "stage-civic-archive-route", "stage-coastal-link-bridge", "stage-estuary-floodgate-seal", "stage-mugarian-logistics-hq", "stage-mugarian-clinical-trial-wing", "stage-mugarian-special-operations-armory", "stage-mugarian-tech-tower", "stage-mugarian-executive-lab", "stage-bay-evacuation-yard", "stage-segawa-private-lab", "stage-national-dispersal-network", "stage-segawa-research-core",
  ] }, "stage-nishijin-defense-line-takuya-omega").state;
  state = completeV100Event(state).state;
  state = enterV100Battle(state).state;
  state = finishV100Battle(state, { stageId: state.stageId, won: true, stars: 3 }).state;
  assert.equal(finalizeV100Flow(state).accepted, false);
  state = enterV100PostResult(state).state;
  state = completeV100Event(state).state;
  assert.equal(state.phase, "first-clear-post");
  state = finalizeV100Flow(state).state;
  assert.equal(state.phase, "ending");
  state = completeV100Event(state).state;
  assert.equal(state.phase, "credits");
  state = completeV100Event(state).state;
  assert.equal(state.phase, "epilogue");
  state = completeV100Event(state).state;
  assert.equal(state.destination, "postgame-map");
});
