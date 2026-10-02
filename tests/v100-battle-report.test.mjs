import test from "node:test";
import assert from "node:assert/strict";
import { normalizeV100BattleReport, v100BattleReportFor } from "../app/v100BattleReport.js";
import { createDefaultV100Save, deserializeV100Save, serializeV100Save } from "../app/v100Save.js";
import { createV100BattleResult, finalizeV100PendingResult, recordV100PendingResult } from "../app/v100Transactions.js";
import { V100_STAGE_IDS, v100StageReward } from "../app/v100Registry.js";
import { v100RewardPresentationFor } from "../app/v100RewardPresentation.js";
import { advanceAreaEffects } from "../app/gameRules.js";

const measured = () => v100BattleReportFor({
  wave: 6, kills: 31,
  unitStats: { damageByUnit: { scout: 117.5, babayaga: 29, unknown: 9999 }, damageTakenByUnit: { scout: 84 }, healingByUnit: { medic: 44 } },
});
const result = (run, hp = 680, battleReport = measured()) => createV100BattleResult({
  stageId: V100_STAGE_IDS[0], battleRunId: run, won: true, objectiveComplete: true, vehicleHp: hp, vehicleMaxHp: 680, battleReport,
});
const reload = save => {
  const parsed = deserializeV100Save(serializeV100Save(save));
  assert.equal(parsed.ok, true);
  return parsed.save;
};
const settle = (save, value) => {
  const pending = recordV100PendingResult(save, value);
  assert.equal(pending.applied, true);
  const settled = finalizeV100PendingResult(reload(pending.save));
  assert.equal(settled.applied, true);
  return reload(settled.save);
};

test("attributed burning measures actual HP loss without changing combat or crediting support", () => {
  const fighters = [{ id: 1, side: "zombie", hp: 6, maxHp: 6, x: 100, y: 100, worldY: 100, lane: 0, combatReady: true }];
  const effect = { id: 1, kind: "burn", sourceSupplyId: -1, lane: 0, x: 100, y: 100, radius: 50, amountPerSecond: 10, remaining: 3, phase: "active", slowMultiplier: .86 };
  const plain = advanceAreaEffects({ areaEffects: [effect], fighters, seconds: 1 });
  const measured = advanceAreaEffects({ areaEffects: [{ ...effect, sourceUnitKind: "zakimiya" }, { ...effect, id: 2, sourceUnitKind: "zakimiya" }], fighters, seconds: 1 });
  assert.deepEqual(measured.fighters, plain.fighters);
  assert.equal(measured.changes.length, 1);
  assert.equal(measured.changes[0].sourceUnitKind, "zakimiya");
  assert.equal(measured.changes[0].measuredDamage, 6);
  assert.equal(measured.changes[0].amount, 10);
  assert.equal(Object.hasOwn(plain.changes[0], "sourceUnitKind"), false);
  assert.equal(fighters[0].hp, 6);
});

test("production combat kinds become canonical characters without invented participants", () => {
  assert.deepEqual(measured(), { wave: 6, kills: 31, units: [
    { unitId: "unit-hachi", damage: 117.5, damageTaken: 84, healing: 0 },
    { unitId: "unit-babayaga", damage: 29, damageTaken: 0, healing: 0 },
    { unitId: "unit-nao", damage: 0, damageTaken: 0, healing: 44 },
  ] });
  assert.equal(v100BattleReportFor({ wave: 6, kills: 31 }), null);
  assert.equal(v100BattleReportFor({ wave: Infinity, kills: 31, unitStats: { damageByUnit: {}, damageTakenByUnit: {}, healingByUnit: {} } }), null);
  assert.equal(normalizeV100BattleReport({ ...measured(), units: Array(17).fill(measured().units[0]) }), null);
  const bad = { wave: 1, kills: 0, unitStats: { damageByUnit: { scout: NaN }, damageTakenByUnit: {}, healingByUnit: {} } };
  assert.deepEqual(v100BattleReportFor(bad).units, []);
});

test("measured report survives pending, reward settlement and save reload without changing receipts or payout", () => {
  const initial = createDefaultV100Save();
  const value = result("report-first");
  const final = settle(initial, value);
  assert.deepEqual(final.lastResult.battleReport, measured());
  assert.equal(final.caps, v100StageReward(1, "first-clear") + v100StageReward(1, "star:2") + v100StageReward(1, "star:3"));
  const duplicate = recordV100PendingResult(final, { ...value, battleReport: { ...measured(), kills: 9999 } });
  assert.equal(duplicate.applied, false);
  assert.equal(serializeV100Save(duplicate.save), serializeV100Save(final));
  const without = settle(initial, result("report-first", 680, null));
  assert.deepEqual(final.receipts, without.receipts);
  assert.equal(final.caps, without.caps);
  assert.equal(Object.hasOwn(without.lastResult, "battleReport"), false);
});

test("CAPS breakdown quotes the actual first and replay settlements, including one-time star improvement", () => {
  const first = settle(createDefaultV100Save(), result("low-first", 68));
  assert.deepEqual(v100RewardPresentationFor(first.lastResult).breakdown, { firstClear: v100StageReward(1, "first-clear"), replay: 0, star2: 0, star3: 0 });
  const better = settle(first, result("star-improvement"));
  assert.deepEqual(v100RewardPresentationFor(better.lastResult).breakdown, { firstClear: 0, replay: v100StageReward(1, "replay"), star2: v100StageReward(1, "star:2"), star3: v100StageReward(1, "star:3") });
  const replay = settle(better, result("ordinary-replay"));
  assert.deepEqual(v100RewardPresentationFor(replay.lastResult).breakdown, { firstClear: 0, replay: v100StageReward(1, "replay"), star2: 0, star3: 0 });
  assert.equal(v100RewardPresentationFor({ ...replay.lastResult, rewardBreakdown: undefined }).breakdown, null);
  assert.equal(v100RewardPresentationFor({ ...replay.lastResult, rewardBreakdown: { firstClear: 0, replay: 9999, star2: 0, star3: 0 } }).breakdown, null);
});
