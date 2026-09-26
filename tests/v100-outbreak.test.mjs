import test from "node:test";
import assert from "node:assert/strict";
import { V100_BOSSES, v100StageReward } from "../app/v100Registry.js";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save, deserializeV100Save } from "../app/v100Save.js";
import { beginV100Outbreak, settleV100Outbreak, leaveV100Outbreak, dismissV100OutbreakResult } from "../app/v100Transactions.js";
import { v100OutbreakEncounters } from "../app/v100Outbreak.js";

const reload = save => deserializeV100Save(serializeV100Save(save)).save;
function ready(boss) { const save = createDefaultV100Save(); save.campaignStarted = true; save.flowState.phase = "map"; save.flowState.destination = "map"; save.receipts = [boss.firstDefeatReceipt]; return normalizeV100Save(save); }
function resultFor(save, extra = {}) { const boss = v100OutbreakEncounters(save).find(b => b.id === save.outbreak.active.bossId); return { resultId: save.outbreak.active.runId, stageId: boss.stageId, won: true, bossDefeated: true, baseHp: 450, baseMaxHp: 680, time: 90, unitsLost: 2, ...extra }; }

for (const boss of V100_BOSSES) test(`${boss.id} Outbreak first/repeat settlement is isolated and receipt-idempotent`, () => {
  const initial = ready(boss);
  const started = beginV100Outbreak(initial, boss.id, { runId: "first" }); assert.equal(started.applied, true);
  const active = reload(started.save), result = resultFor(active);
  assert.deepEqual(active.outbreak.active, { bossId: boss.id, runId: "first" });
  const finished = settleV100Outbreak(active, result); assert.equal(finished.applied, true);
  const saved = reload(finished.save), reward = v100StageReward(boss.stageNumber, "replay"), item = v100OutbreakEncounters(saved)[0].rewardEquipment;
  assert.equal(saved.caps, reward); assert.equal(saved.bosses.defeatCounts[boss.id], 2); assert.equal(saved.outbreak.clearCounts[boss.id], 1);
  assert.equal(saved.outbreak.active, null); assert.equal(saved.outbreak.view, "result");
  assert.equal(saved.equipment.inventory[item.id], 1); assert.equal(saved.outbreak.lastResult.grantedQuantity, 1);
  assert.deepEqual(saved.completedStageIds, initial.completedStageIds); assert.deepEqual(saved.availableStageIds, initial.availableStageIds);
  assert.deepEqual(saved.bestStars, initial.bestStars); assert.deepEqual(saved.flowState, initial.flowState); assert.deepEqual(saved.readStoryEventIds, initial.readStoryEventIds);
  assert.equal(settleV100Outbreak(saved, result).applied, false);
  const replay = beginV100Outbreak(dismissV100OutbreakResult(saved).save, boss.id, { runId: "second" });
  const repeated = reload(settleV100Outbreak(replay.save, resultFor(replay.save)).save);
  assert.equal(repeated.caps, reward * 2); assert.equal(repeated.bosses.defeatCounts[boss.id], 3); assert.equal(repeated.outbreak.clearCounts[boss.id], 2);
  assert.equal(repeated.equipment.inventory[item.id], 1); assert.equal(repeated.outbreak.lastResult.grantedQuantity, 0);
  assert.equal(new Set(repeated.receipts).size, repeated.receipts.length);
});

test("Outbreak never exposes or starts an unproved boss, prototype or invalid run", () => {
  const clean = createDefaultV100Save(); assert.deepEqual(v100OutbreakEncounters(clean), []);
  for (const boss of V100_BOSSES) assert.equal(beginV100Outbreak(clean, boss.id, { runId: "attempt" }).applied, false);
  const boss = V100_BOSSES[0], save = ready(boss);
  for (const id of ["boss-kurome-prototype", "toString", "boss-takuya-omega"]) assert.equal(beginV100Outbreak(save, id, { runId: "attempt" }).applied, false);
  for (const runId of [null, "", "x".repeat(161), " leading", "bad\nrun"]) assert.equal(beginV100Outbreak(save, boss.id, { runId }).applied, false);
  const started = beginV100Outbreak(save, boss.id, { runId: "attempt" }).save;
  assert.equal(beginV100Outbreak(started, boss.id, { runId: "competing" }).reason, "activity-active");
});

test("invalid or substituted results cannot settle the active Outbreak", () => {
  const save = beginV100Outbreak(ready(V100_BOSSES[0]), V100_BOSSES[0].id, { runId: "valid" }).save;
  for (const change of [{ resultId: "stale" }, { stageId: "toString" }, { bossDefeated: false }, { baseHp: 0 }, { baseHp: 681 },
    { baseMaxHp: 999 }, { time: Infinity }, { time: -1 }, { unitsLost: NaN }, { won: "true" }]) {
    const failed = settleV100Outbreak(save, resultFor(save, change)); assert.equal(failed.applied, false); assert.deepEqual(failed.save, normalizeV100Save(save));
  }
});

test("defeat, withdrawal and restart preserve money/counts and reject late results", () => {
  const boss = V100_BOSSES[0], first = beginV100Outbreak(ready(boss), boss.id, { runId: "first" }).save;
  const oldResult = resultFor(first);
  const restart = leaveV100Outbreak(first, { runId: "first", restartRunId: "second" }); assert.equal(restart.applied, true);
  assert.equal(restart.save.outbreak.active.runId, "second"); assert.equal(settleV100Outbreak(restart.save, oldResult).applied, false);
  const loss = reload(settleV100Outbreak(restart.save, resultFor(restart.save, { won: false, baseHp: 0, bossDefeated: false })).save);
  assert.equal(loss.caps, 0); assert.equal(loss.bosses.defeatCounts[boss.id], 1); assert.deepEqual(loss.outbreak.clearCounts, {}); assert.deepEqual(loss.equipment.inventory, {});
  assert.equal(settleV100Outbreak(loss, oldResult).applied, false);
  const fresh = beginV100Outbreak(dismissV100OutbreakResult(loss).save, boss.id, { runId: "third" }).save;
  const withdrawn = leaveV100Outbreak(fresh, { runId: "third" }).save;
  assert.equal(withdrawn.outbreak.view, "hub"); assert.equal(withdrawn.caps, 0); assert.equal(withdrawn.bosses.defeatCounts[boss.id], 1);
  assert.equal(reload({ ...withdrawn, outbreak: { ...withdrawn.outbreak, active: fresh.outbreak.active } }).outbreak.active, null);
  assert.equal(beginV100Outbreak(withdrawn, boss.id, { runId: "third" }).applied, false);
});

test("capped tactical duplicate rewards do not convert to money or claim another item", () => {
  const futago = V100_BOSSES.find(b => b.id === "boss-futago"), president = V100_BOSSES.find(b => b.id === "boss-mugarian-president-mutated");
  let save = ready(futago); save.receipts.push(president.firstDefeatReceipt); save = normalizeV100Save(save);
  for (const boss of [futago, president]) {
    const begun = beginV100Outbreak(save, boss.id, { runId: boss.id }).save;
    save = settleV100Outbreak(begun, resultFor(begun)).save;
    assert.equal(save.outbreak.lastResult.grantedQuantity, boss === futago ? 1 : 0);
    save = dismissV100OutbreakResult(save).save;
  }
  assert.equal(save.equipment.inventory["boss-mimic-larynx"], 1);
  assert.equal(save.caps, v100StageReward(24, "replay") + v100StageReward(25, "replay"));
});
