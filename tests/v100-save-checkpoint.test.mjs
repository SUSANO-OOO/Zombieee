import test from "node:test";
import assert from "node:assert/strict";
import { V100_EVENT_IDS, V100_EVENT_BY_ID, V100_STAGE_IDS, v100EventPhaseForId } from "../app/v100Registry.js";
import { createDefaultV100Save, deserializeV100Save, serializeV100Save } from "../app/v100Save.js";
import { exportV100BrowserSave, importV100BrowserSave, restoreV100BrowserSave } from "../app/v100CampaignStorage.js";
import { createV100StoryFlowState, shouldAutoSkipV100StoryEvent, v100StoryFlowCheckpoint } from "../app/v100StoryFlow.js";
import { createV100BattleResult, recordV100PendingResult, finalizeV100PendingResult } from "../app/v100Transactions.js";
import { completeV100Event } from "../app/v100StoryFlow.js";

const save = createDefaultV100Save({ playerName: "監査" });
const checkpoint = eventId => ({
  phase: v100EventPhaseForId(eventId), eventId,
  stageId: V100_EVENT_BY_ID[eventId].stageNumber ? V100_STAGE_IDS[V100_EVENT_BY_ID[eventId].stageNumber - 1] : null,
  stageNumber: V100_EVENT_BY_ID[eventId].stageNumber,
  nodeIndex: 0, firstClear: false, finalized: false,
});
const envelope = raw => JSON.stringify({ ...JSON.parse(exportV100BrowserSave(save)), serialized: JSON.stringify(raw) });

test("all registered event checkpoints and both S30 ending checkpoint forms remain readable", () => {
  for (const eventId of V100_EVENT_IDS) {
    for (const inheritedStage of [null, ...(["v100:event:ending", "v100:event:credits", "v100:event:epilogue"].includes(eventId) ? [30] : [])]) {
      const flowState = { ...checkpoint(eventId), ...(inheritedStage ? { stageId: V100_STAGE_IDS[29], stageNumber: 30 } : {}) };
      let resultSave = save;
      if (["post", "first-clear-post"].includes(flowState.phase)) {
        const initial = { ...save, completedStageIds: V100_STAGE_IDS.slice(0, flowState.stageNumber - 1), availableStageIds: V100_STAGE_IDS.slice(0, flowState.stageNumber) };
        const result = createV100BattleResult({ stageId: flowState.stageId, battleRunId: eventId, won: true, objectiveComplete: true, bossDefeated: true, vehicleHp: 680 });
        const pending = recordV100PendingResult(initial, result);
        assert.equal(pending.applied, true);
        resultSave = pending.save;
        if (flowState.phase === "first-clear-post") {
          const settled = finalizeV100PendingResult(resultSave);
          assert.equal(settled.applied, true);
          resultSave = { ...settled.save, readStoryEventIds: [eventId.replace(":first-clear-post", ":post")] };
          flowState.firstClear = true;
        }
      }
      const raw = { ...resultSave, campaignStarted: true, flowState, eventCursor: { eventId, phase: flowState.phase, nodeIndex: 0 } };
      const parsed = deserializeV100Save(JSON.stringify(raw));
      assert.equal(parsed.ok, true, eventId);
      assert.equal(createV100StoryFlowState(parsed.save).phase, flowState.phase);
      assert.equal(createV100StoryFlowState(parsed.save).eventId, eventId);
      assert.equal(completeV100Event(createV100StoryFlowState(parsed.save)).accepted, true, eventId);
    }
  }
});

test("older cursor-only and default-name checkpoints infer the registered event phase", () => {
  for (const eventId of ["v100:event:prologue", "v100:event:s01:pre", "v100:event:s01:post", "v100:event:credits"]) {
    for (const flowState of [undefined, save.flowState]) {
      const raw = { ...save, campaignStarted: true, flowState, eventCursor: { eventId, nodeIndex: 1 }, pendingResult: eventId.endsWith(":post") ? { stageId: V100_STAGE_IDS[0], won: true } : null };
      const parsed = deserializeV100Save(JSON.stringify(raw));
      assert.equal(parsed.ok, true);
      const flow = createV100StoryFlowState(parsed.save);
      assert.equal(flow.phase, v100EventPhaseForId(eventId));
      assert.equal(flow.nodeIndex, 1);
      assert.equal(deserializeV100Save(serializeV100Save({ ...parsed.save, ...v100StoryFlowCheckpoint(flow) })).ok, true);
    }
  }
});

test("unknown, mismatched and incomplete active event checkpoints cannot reach IDB restore", async () => {
  const valid = checkpoint("v100:event:s01:pre");
  const cases = [
    { flowState: { ...valid, eventId: "v100:event:missing" } },
    { eventCursor: { eventId: "v100:event:missing", nodeIndex: 0 } },
    { flowState: { ...valid, phase: "unknown" } },
    { flowState: { ...valid, phase: "credits" } },
    { flowState: { ...valid, eventId: null } },
    { flowState: valid, eventCursor: { eventId: "v100:event:s02:pre", phase: "event", nodeIndex: 0 } },
    { flowState: valid, eventCursor: { eventId: valid.eventId, phase: "post", nodeIndex: 0 } },
    { flowState: { ...valid, stageId: V100_STAGE_IDS[1] } },
    { flowState: { ...valid, stageNumber: 2 } },
    { flowState: { ...valid, nodeIndex: -1 } },
    { flowState: { ...valid, nodeIndex: 0.5 } },
    { flowState: { ...valid, phase: "map" } },
    { flowState: checkpoint("v100:event:s01:post") },
    { flowState: checkpoint("v100:event:s01:first-clear-post") },
    { flowState: { phase: "battle", stageId: null, eventId: null } },
    { flowState: { phase: "result", stageId: V100_STAGE_IDS[0], eventId: null } },
    { flowState: checkpoint("v100:event:s01:post"), pendingResult: { stageId: V100_STAGE_IDS[0], won: false } },
    { flowState: checkpoint("v100:event:s01:post"), pendingResult: { stageId: V100_STAGE_IDS[1], won: true } },
    { flowState: checkpoint("v100:event:s01:first-clear-post"), pendingResult: { stageId: V100_STAGE_IDS[0], won: true } },
  ];
  let opened = 0;
  const host = { indexedDB: { open() { opened += 1; throw new Error("unexpected IDB access"); } } };
  for (const fields of cases) {
    const input = envelope({ ...save, ...fields });
    assert.equal(importV100BrowserSave(input).reason, "invalid-inner-save");
    assert.equal((await restoreV100BrowserSave(input, host)).reason, "invalid-inner-save");
  }
  assert.equal(opened, 0);
});

test("read preference skips ordinary read dialogue while replay, new scenes and reward/credits confirmation remain visible", () => {
  for (const eventId of V100_EVENT_IDS) {
    const state = { ...checkpoint(eventId), readStoryEventIds: [eventId] };
    assert.equal(shouldAutoSkipV100StoryEvent(state, { enabled: true }), !["first-clear-post", "credits"].includes(state.phase), eventId);
    assert.equal(shouldAutoSkipV100StoryEvent(state, { enabled: true, replay: true }), false);
    assert.equal(shouldAutoSkipV100StoryEvent(state, { enabled: false }), false);
    assert.equal(shouldAutoSkipV100StoryEvent({ ...state, readStoryEventIds: [] }, { enabled: true }), false);
  }
});
