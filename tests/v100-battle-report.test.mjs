import test from "node:test";
import assert from "node:assert/strict";
import { normalizeV100BattleReport, v100BattleReportFor, v100VehicleHitFor, v100LastVehicleHitText } from "../app/v100BattleReport.js";
import { applyV100SaveMutation, createDefaultV100Save, deserializeV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { createV100BattleResult, finalizeV100PendingResult, recordV100PendingResult } from "../app/v100Transactions.js";
import { V100_STAGE_IDS, v100StageReward, v100StarsForVehicle, v100StarTargetsForVehicle } from "../app/v100Registry.js";
import { bossBattleResultSnapshot } from "../app/bossFoundation.js";
import { v100RewardPresentationFor } from "../app/v100RewardPresentation.js";
import { advanceAreaEffects } from "../app/gameRules.js";
import { beginV100StageAttempt, completeV100Event, createV100StoryFlowState, enterV100Battle, enterV100PostResult, finishV100Battle, markV100FlowEventRead, v100StoryFlowCheckpoint } from "../app/v100StoryFlow.js";

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

test("last vehicle damage records only actual HP loss and survives settlement without changing rewards", () => {
  const hit = v100VehicleHitFor({ enemyKind: "runner", time: 24.5, beforeHp: 9, afterHp: 0 });
  assert.deepEqual(hit, { enemyKind: "runner", time: 24.5, damage: 9 });
  for (const input of [
    { enemyKind: "unknown", time: 1, beforeHp: 9, afterHp: 0 },
    { enemyKind: "runner", time: Infinity, beforeHp: 9, afterHp: 0 },
    { enemyKind: "runner", time: 1, beforeHp: 9, afterHp: 10 },
  ]) assert.equal(v100VehicleHitFor(input), null);
  const report = normalizeV100BattleReport({ ...measured(), lastVehicleHit: hit });
  const saved = settle(createDefaultV100Save(), result("hit-report", 680, report));
  const control = settle(createDefaultV100Save(), result("hit-report"));
  assert.deepEqual(saved.lastResult.battleReport.lastVehicleHit, hit);
  assert.deepEqual(saved.receipts, control.receipts);
  assert.equal(saved.caps, control.caps);
  assert.match(v100LastVehicleHitText({ won: false, elapsedSeconds: 25, battleReport: report }), /走行感染者.*9.*1秒前/u);
  for (const input of [
    { won: true, elapsedSeconds: 25, battleReport: report },
    { won: false, elapsedSeconds: 24, battleReport: report },
    { won: false, elapsedSeconds: 35, battleReport: report },
    { won: false, elapsedSeconds: 25, battleReport: measured() },
  ]) assert.equal(v100LastVehicleHitText(input), null);
  assert.equal(normalizeV100BattleReport({ ...measured(), lastVehicleHit: { ...hit, damage: -1 } }).lastVehicleHit, undefined);
});

test("result boss measurements preserve fractional HP, entering bodies and actual maximum without counting clones", () => {
  const game = {
    definition: { bossEnemyKind: "kurome", missionConfig: { v100StageNumber: 10 } },
    fighters: [{ kind: "kurome", side: "zombie", hp: 59.92, maxHp: 4300, gateEntering: true },
      { kind: "kurome", side: "zombie", hp: 430, maxHp: 430, summonSource: "kurome-clone" }],
    enemyKindsSeen: ["kurome"], bossReportMaxHp: 4300,
  };
  const original = structuredClone(game);
  const bossProgress = bossBattleResultSnapshot(game);
  assert.deepEqual(game, original);
  assert.equal(bossProgress.bossId, "boss-kurome");
  assert.equal(bossProgress.hp, 59.92);
  assert.equal(bossProgress.maxHp, 4300);
  assert.equal(bossProgress.state, "active");
  const report = normalizeV100BattleReport({ ...measured(), bossProgress });
  const withReport = settle(createDefaultV100Save(), result("boss-measurement", 680, report));
  const without = settle(createDefaultV100Save(), result("boss-measurement"));
  assert.deepEqual(withReport.lastResult.battleReport.bossProgress, bossProgress);
  assert.deepEqual(withReport.receipts, without.receipts);
  assert.equal(withReport.caps, without.caps);
  assert.equal(bossBattleResultSnapshot({ ...game, fighters: [], enemyKindsSeen: [] }).state, "not-encountered");
  assert.deepEqual(bossBattleResultSnapshot({ ...game, fighters: [], bossDefeated: true }), { ...bossProgress, state: "defeated", hp: 0 });
});

test("FUTAGO result measurement includes the arriving second body and excludes an already defeated body", () => {
  const first = { kind: "futago", side: "zombie", hp: 1200, maxHp: 3000, v100TwinPart: "a", v100TwinPair: 0 };
  const game = { definition: { bossEnemyKind: "futago", missionConfig: { v100StageNumber: 21 } }, fighters: [first], enemyKindsSeen: ["futago"], bossReportMaxHp: 6000, v100TwinSpawnCount: 1 };
  assert.equal(bossBattleResultSnapshot(game).hp, 4200);
  const second = { ...first, hp: 875.25, v100TwinPart: "b" };
  assert.equal(bossBattleResultSnapshot({ ...game, fighters: [second], v100TwinSpawnCount: 2 }).hp, 875.25);
  const progress = bossBattleResultSnapshot({ ...game, fighters: [first, second], v100TwinSpawnCount: 2 });
  assert.equal(progress.hp, 2075.25);
  assert.equal(progress.maxHp, 6000);
  assert.equal(bossBattleResultSnapshot({ ...game, fighters: [], bossDefeatPending: true }).hp, 0);
  assert.equal(normalizeV100BattleReport({ ...measured(), bossProgress: { ...progress, hp: Infinity } }).bossProgress, undefined);
});

test("visible next-star HP targets meet the actual star boundary at every legal vehicle upgrade", () => {
  for (let hp = 680; hp <= 1000; hp += 80) {
    const targets = v100StarTargetsForVehicle(hp);
    for (const stars of [2, 3]) {
      assert.equal(v100StarsForVehicle({ won: true, vehicleHp: targets[stars], vehicleMaxHp: hp }), stars);
      assert.equal(v100StarsForVehicle({ won: true, vehicleHp: targets[stars] - 1, vehicleMaxHp: hp }), stars - 1);
      assert.equal(v100StarsForVehicle({ won: false, vehicleHp: targets[stars], vehicleMaxHp: hp }), 0);
    }
  }
  assert.equal(v100StarTargetsForVehicle(680)[3] - 498, 114);
});

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

test("replay and improved stars show durable rewards, resume confirmation and never repeat the ending or payouts", () => {
  for (const number of [1, 30]) {
    const stageId = V100_STAGE_IDS[number - 1];
    const initial = normalizeV100Save({ ...createDefaultV100Save({ playerName: "確認" }), completedStageIds: V100_STAGE_IDS.slice(0, number - 1), availableStageIds: V100_STAGE_IDS.slice(0, number) });
    const victory = (run, hp) => createV100BattleResult({ stageId, battleRunId: run, won: true, objectiveComplete: true, bossDefeated: true, vehicleHp: hp, vehicleMaxHp: 680 });
    const first = settle(initial, victory("first-" + number, 68));
    let flow = createV100StoryFlowState({ ...first, flowState: { phase: "map" } });
    flow = beginV100StageAttempt(flow, stageId).state;
    flow = enterV100Battle(completeV100Event(flow).state).state;
    const replayResult = victory("improved-" + number, 680);
    flow = enterV100PostResult(finishV100Battle(flow, replayResult).state).state;
    const settled = settle(first, replayResult);
    flow = completeV100Event(markV100FlowEventRead(flow, flow.eventId)).state;
    assert.equal(flow.phase, "first-clear-post");
    assert.equal(flow.firstClear, false);
    const point = v100StoryFlowCheckpoint(flow);
    const checkpoint = applyV100SaveMutation(settled, draft => ({ ...draft, ...point, readStoryEventIds: flow.readStoryEventIds }));
    assert.equal(checkpoint.applied, true);
    const saved = reload(checkpoint.save);
    const resumed = createV100StoryFlowState(saved);
    assert.deepEqual(resumed.pendingResult, saved.lastResult);
    const summary = v100RewardPresentationFor(resumed.pendingResult);
    assert.deepEqual(summary.unlocks, []);
    assert.deepEqual(summary.breakdown, { firstClear: 0, replay: v100StageReward(number, "replay"), star2: v100StageReward(number, "star:2"), star3: v100StageReward(number, "star:3") });
    const continued = completeV100Event(resumed);
    assert.equal(continued.accepted, true);
    assert.equal(continued.state.phase, "map");
    assert.equal(continued.state.eventId, null);
    const repeated = recordV100PendingResult(saved, replayResult);
    assert.equal(repeated.applied, false);
    assert.equal(serializeV100Save(repeated.save), serializeV100Save(saved));
    assert.deepEqual(saved.ownedUnitIds, first.ownedUnitIds);
    assert.deepEqual(saved.unitLevels, first.unitLevels);
    assert.deepEqual(saved.settings, first.settings);
  }
});
