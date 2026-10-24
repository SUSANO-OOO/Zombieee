import assert from "node:assert/strict";
import { V100_STORY_EVENTS, V100_STORY_SCRIPT_VERSION } from "../app/v100StoryEvents.js";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save, deserializeV100Save } from "../app/v100Save.js";
import { V100_STAGE_IDS, v100EventPhaseForId } from "../app/v100Registry.js";
import { createV100BattleResult, recordV100PendingResult, finalizeV100PendingResult } from "../app/v100Transactions.js";

// Synthetic presentation checkpoint only. The ordinary pending/finalization
// transactions supply valid post-battle receipts; this never proves a win.
export function createV100DialogueFixture({eventId, nodeIndex, playerName = "構図確認"}) {
  const event = V100_STORY_EVENTS[eventId];
  const phase = v100EventPhaseForId(eventId);
  assert.ok(event && phase, `Unknown story fixture: ${eventId}`);
  assert.ok(Number.isSafeInteger(nodeIndex) && nodeIndex >= 0 && nodeIndex < event.nodes.length);
  const stageNumber = event.stageNumber ?? null;
  const stageId = stageNumber ? V100_STAGE_IDS[stageNumber - 1] : null;
  let save = normalizeV100Save({...createDefaultV100Save({playerName}), campaignStarted:true,
    revision:7, availableStageIds:V100_STAGE_IDS,
    completedStageIds:V100_STAGE_IDS.slice(0, Math.max(0, (stageNumber ?? 1) - 1)),
  });
  if (phase === "post" || phase === "first-clear-post") {
    const result = createV100BattleResult({stageId, battleRunId:`presentation:${eventId}`,
      won:true, bossDefeated:true, objectiveComplete:true, vehicleHp:680, vehicleMaxHp:680,
      elapsedSeconds:120, unitDeaths:0});
    const pending = recordV100PendingResult(save, result, {now:0});
    assert.equal(pending.applied, true, pending.reason);
    save = pending.save;
    if (phase === "first-clear-post") {
      const settled = finalizeV100PendingResult(save, {result, now:0});
      assert.equal(settled.applied, true, settled.reason);
      save = settled.save;
    }
  }
  save = normalizeV100Save({...save, flowState:{phase, eventId, stageId, stageNumber,
    destination:phase, nodeIndex, scriptVersion:V100_STORY_SCRIPT_VERSION,
    firstClear:phase === "post" || phase === "first-clear-post", finalized:phase !== "post"}});
  const decoded = deserializeV100Save(serializeV100Save(save));
  assert.equal(decoded.ok, true, `${eventId}:${nodeIndex} invalid fixture: ${decoded.errors?.join(",")}`);
  assert.equal(decoded.save.flowState.eventId, eventId);
  assert.equal(decoded.save.flowState.nodeIndex, nodeIndex);
  return save;
}
