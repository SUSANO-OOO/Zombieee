import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultV100Save, applyV100SaveMutation, serializeV100Save, deserializeV100Save } from "../app/v100Save.js";
import { V100_STAGE_IDS, v100LevelCost } from "../app/v100Registry.js";
import { createV100StoryFlowState, leaveV100Battle, defeatV100Flow, finishV100Battle, enterV100PostResult, v100StoryFlowCheckpoint } from "../app/v100StoryFlow.js";
import { createV100BattleResult, upgradeV100Unit, finalizeV100PendingResult } from "../app/v100Transactions.js";
// Pure flow checkpoints are round-tripped through the real save serializer.
// Native IndexedDB atomicity/ownership/fault coverage lives in v100-durable-storage-browser-smoke.mjs.
const roundTrip = save => { const loaded = deserializeV100Save(serializeV100Save(save)); assert.equal(loaded.ok, true); return loaded.save; };
function battleFlow() {
  return createV100StoryFlowState({ playerName: "監査指揮官", flowState: { phase: "battle", stageId: V100_STAGE_IDS[0], destination: "battle" } });
}
function defeat() { return createV100BattleResult({ stageId: V100_STAGE_IDS[0], battleRunId: "actual-run", won: false, vehicleHp: 0, elapsedSeconds: 45 }); }

test("V1 withdraw, loadout and restart persist distinct destinations without awards", () => {
  for (const [action, destination] of [["withdraw", "map"], ["loadout", "formation"], ["restart", "battle"]]) {
    const save = { ...createDefaultV100Save({ playerName: "監査指揮官" }), campaignStarted: true };
    const transition = leaveV100Battle(battleFlow(), action);
    assert.equal(transition.accepted, true); assert.equal(transition.state.phase, destination);
    const checkpoint = v100StoryFlowCheckpoint(transition.state);
    const next = applyV100SaveMutation(save, draft => ({ ...draft, ...checkpoint }));
    const loaded = roundTrip(next.save);
    assert.equal(createV100StoryFlowState(loaded).phase, destination);
    assert.equal(loaded.revision, save.revision + 1);
    for (const key of ["caps", "bestStars", "receipts", "completedStageIds", "availableStageIds", "formationSlots"]) assert.deepEqual(loaded[key], save[key]);
  }
});

test("V1 exit rejects unknown actions, nonbattle states and completed victories", () => {
  for (const action of ["cancel", "toString", "constructor", null]) assert.equal(leaveV100Battle(battleFlow(), action).accepted, false);
  assert.equal(leaveV100Battle({ ...battleFlow(), phase: "map" }, "withdraw").accepted, false);
  const won = finishV100Battle(battleFlow(), { ...defeat(), won: true }).state;
  assert.equal(leaveV100Battle(won, "withdraw").accepted, false);
  assert.equal(defeatV100Flow(won, "map").accepted, false);
  assert.equal(enterV100PostResult(won).accepted, true);
});

test("defeat details survive reload with independent retry/map destinations and no reward", () => {
  const result = defeat();
  const state = finishV100Battle(battleFlow(), result).state;
  const save = { ...createDefaultV100Save(), ...v100StoryFlowCheckpoint(state), lastResult: result };
  const loaded = roundTrip(save);
  const restored = createV100StoryFlowState(loaded);
  assert.equal(restored.pendingResult.elapsedSeconds, 45);
  assert.equal(restored.pendingResult.resultId, "actual-run");
  assert.equal(defeatV100Flow(restored).state.phase, "formation");
  assert.equal(defeatV100Flow(restored, "map").state.phase, "map");
  assert.equal(defeatV100Flow(restored, "post").accepted, false);
  assert.equal(finalizeV100PendingResult(loaded).applied, false);
  assert.equal(createV100StoryFlowState({ ...loaded, lastResult: { ...result, stageId: V100_STAGE_IDS[1] } }).pendingResult, null);
  assert.equal(createV100StoryFlowState({ ...loaded, lastResult: { ...result, won: true } }).pendingResult, null);
});

test("owned-unit upgrade uses canonical cost, persists one receipt and rejects a stale repeated level", () => {
  const save = { ...createDefaultV100Save(), caps: 1000 };
  const id = save.ownedUnitIds[0];
  const upgrade = upgradeV100Unit(save, id, { expectedLevel: 1 });
  assert.equal(upgrade.applied, true);
  assert.equal(upgrade.save.unitLevels[id], 2);
  assert.equal(upgrade.save.caps, 1000 - v100LevelCost(2));
  assert.equal(upgrade.save.receipts.filter(r => r === `v100:unit:${id}:level:2`).length, 1);
  const repeat = upgradeV100Unit(upgrade.save, id, { expectedLevel: 1 });
  assert.equal(repeat.applied, false); assert.equal(repeat.reason, "stale-level");
  assert.equal(repeat.save.caps, upgrade.save.caps);
  assert.equal(roundTrip(upgrade.save).unitLevels[id], 2);
});

test("level upgrade rejects locked unit, insufficient CAPS, level cap and already spent receipt", () => {
  const save = createDefaultV100Save(), id = save.ownedUnitIds[0];
  assert.equal(upgradeV100Unit(save, "unit-mizuchi").reason, "unit-not-owned");
  assert.equal(upgradeV100Unit(save, "toString").reason, "unit-not-owned");
  assert.equal(upgradeV100Unit(save, id).reason, "insufficient-caps");
  assert.equal(upgradeV100Unit({ ...save, caps: 10000, unitLevels: { ...save.unitLevels, [id]: 5 } }, id).reason, "level-cap");
  assert.equal(upgradeV100Unit({ ...save, caps: 1000, receipts: [`v100:unit:${id}:level:2`] }, id).reason, "duplicate-receipt");
});
