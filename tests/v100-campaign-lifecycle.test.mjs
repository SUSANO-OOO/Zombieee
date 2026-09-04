import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultV100Save, applyV100SaveMutation, serializeV100Save, V100_PRIMARY_STORAGE_KEY } from "../app/v100Save.js";
import { V100_STAGE_IDS, v100LevelCost } from "../app/v100Registry.js";
import { createV100StoryFlowState, leaveV100Battle, defeatV100Flow, finishV100Battle, enterV100PostResult, v100StoryFlowCheckpoint } from "../app/v100StoryFlow.js";
import { createV100BattleResult, upgradeV100Unit, finalizeV100PendingResult } from "../app/v100Transactions.js";
import { persistV100BrowserSave, readV100BrowserSave, claimV100SaveOwnership, releaseV100SaveOwnership, V100_LEGACY_STORAGE_KEY } from "../app/v100CampaignStorage.js";

// Real storage and production transition functions; no alternative combat model.
function hostFor() {
  const values = new Map([[V100_LEGACY_STORAGE_KEY, "legacy-save-untouched"]]);
  let now = 100_000, failure = null;
  return {
    values, Date: { now: () => now }, advance: ms => { now += ms; }, fail: mode => { failure = mode; },
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => { if (failure === "quota") throw new Error("QuotaExceededError"); if (failure !== "drop") values.set(key, String(value)); },
      removeItem: key => values.delete(key),
    },
  };
}
function battleFlow() {
  return createV100StoryFlowState({ playerName: "監査指揮官", flowState: { phase: "battle", stageId: V100_STAGE_IDS[0], destination: "battle" } });
}
function defeat() { return createV100BattleResult({ stageId: V100_STAGE_IDS[0], battleRunId: "actual-run", won: false, vehicleHp: 0, elapsedSeconds: 45 }); }

test("V1 withdraw, loadout and restart persist distinct destinations without awards", () => {
  for (const [action, destination] of [["withdraw", "map"], ["loadout", "formation"], ["restart", "battle"]]) {
    const host = hostFor();
    const save = { ...createDefaultV100Save({ playerName: "監査指揮官" }), campaignStarted: true };
    assert.equal(persistV100BrowserSave(save, host).ok, true);
    const transition = leaveV100Battle(battleFlow(), action);
    assert.equal(transition.accepted, true); assert.equal(transition.state.phase, destination);
    const checkpoint = v100StoryFlowCheckpoint(transition.state);
    const next = applyV100SaveMutation(save, draft => ({ ...draft, ...checkpoint }));
    assert.equal(persistV100BrowserSave(next.save, host).ok, true);
    const loaded = readV100BrowserSave(host).save;
    assert.equal(createV100StoryFlowState(loaded).phase, destination);
    assert.equal(loaded.revision, save.revision + 1);
    for (const key of ["caps", "bestStars", "receipts", "completedStageIds", "availableStageIds", "formationSlots"]) assert.deepEqual(loaded[key], save[key]);
    assert.equal(host.values.get(V100_LEGACY_STORAGE_KEY), "legacy-save-untouched");
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
  const host = hostFor(); assert.equal(persistV100BrowserSave(save, host).ok, true);
  const loaded = readV100BrowserSave(host).save;
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
  const host = hostFor(); assert.equal(persistV100BrowserSave(upgrade.save, host).ok, true);
  assert.equal(readV100BrowserSave(host).save.unitLevels[id], 2);
});

test("level upgrade rejects locked unit, insufficient CAPS, level cap and already spent receipt", () => {
  const save = createDefaultV100Save(), id = save.ownedUnitIds[0];
  assert.equal(upgradeV100Unit(save, "unit-mizuchi").reason, "unit-not-owned");
  assert.equal(upgradeV100Unit(save, "toString").reason, "unit-not-owned");
  assert.equal(upgradeV100Unit(save, id).reason, "insufficient-caps");
  assert.equal(upgradeV100Unit({ ...save, caps: 10000, unitLevels: { ...save.unitLevels, [id]: 5 } }, id).reason, "level-cap");
  assert.equal(upgradeV100Unit({ ...save, caps: 1000, receipts: [`v100:unit:${id}:level:2`] }, id).reason, "duplicate-receipt");
});

test("default ownership lease uses real current time, expires and cannot be released by another tab", () => {
  const host = hostFor();
  const first = claimV100SaveOwnership(host, { ownerId: "one" });
  assert.equal(first.lease.acquiredAt, 100000); assert.equal(first.lease.expiresAt, 130000);
  assert.equal(claimV100SaveOwnership(host, { ownerId: "two" }).reason, "ownership-conflict");
  assert.equal(releaseV100SaveOwnership(host, "two").ok, false);
  host.advance(30001);
  assert.equal(claimV100SaveOwnership(host, { ownerId: "two" }).ok, true);
  assert.equal(releaseV100SaveOwnership(host, "one").ok, false);
  assert.equal(releaseV100SaveOwnership(host, "two").ok, true);
  assert.equal(claimV100SaveOwnership(host, { ownerId: "zero", now: 0 }).lease.acquiredAt, 0);
});

test("storage reports quota, verification, stale writer and owner conflict instead of commit success", () => {
  const host = hostFor(), save = createDefaultV100Save();
  assert.equal(persistV100BrowserSave(save, host, { ownerId: "one" }).ok, true);
  const next = applyV100SaveMutation(save, draft => ({ ...draft, caps: 88 })).save;
  assert.equal(persistV100BrowserSave(next, host, { ownerId: "two" }).ok, false);
  host.fail("quota"); assert.equal(persistV100BrowserSave(next, host).reason, "storage-write-failed");
  host.fail("drop"); assert.equal(persistV100BrowserSave(next, host).reason, "write-verification-failed");
  assert.equal(host.values.get(V100_PRIMARY_STORAGE_KEY), serializeV100Save(save));
  host.fail(null); assert.equal(persistV100BrowserSave(next, host, { ownerId: "one" }).ok, true);
  assert.equal(persistV100BrowserSave(save, host).reason, "stale-writer");
  assert.equal(readV100BrowserSave(host).save.caps, 88);
});

test("denied browser storage accessor fails closed without resetting legacy storage", () => {
  const host = { get localStorage() { throw new Error("SecurityError"); } };
  assert.equal(persistV100BrowserSave(createDefaultV100Save(), host).reason, "storage-unavailable");
  assert.equal(readV100BrowserSave(host).source, "default");
});
