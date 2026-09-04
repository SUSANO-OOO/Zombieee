import assert from "node:assert/strict";
import test from "node:test";
import { V100_BOSSES } from "../app/v100Registry.js";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save, deserializeV100Save } from "../app/v100Save.js";
import { beginV100Survival, checkpointV100Survival, selectV100SurvivalUpgrade, settleV100Survival, dismissV100SurvivalResult } from "../app/v100SurvivalTransactions.js";
import { v100SurvivalBossPool } from "../app/v100Survival.js";
import { beginV100Outbreak } from "../app/v100Transactions.js";
import { createSurvivalRun, normalizeSurvivalRun, beginSurvivalWave, completeSurvivalWave, endSurvivalRun, normalizeSurvivalBossPool, SURVIVAL_END_REASONS } from "../app/survival.js";
import { survivalWaveReward, selectSurvivalBossKind, survivalWaveSpawnPlan } from "../app/survivalBattleRuntime.js";

const reload = save => deserializeV100Save(serializeV100Save(save)).save;
function ready(boss = V100_BOSSES[0]) { const save = createDefaultV100Save(); save.campaignStarted = true; save.flowState.phase = "map"; save.receipts = [boss.firstDefeatReceipt]; save.formationSlots = Array(7).fill(save.ownedUnitIds[0]); return normalizeV100Save(save); }
function completeThrough(run, finalWave, hp = 540) {
  let current = run;
  for (let wave = run.currentWave; wave <= finalWave; wave++) {
    current = beginSurvivalWave(current);
    const boss = selectSurvivalBossKind({ waveNumber: wave, bossPool: current.bossPool, lastBossKind: current.lastBossKind, strictBossPool: true });
    if (boss) current = { ...current, lastBossKind: boss };
    current = completeSurvivalWave(current, { kills: 3, bossKills: boss ? 1 : 0, crawlerHp: hp, battleSeconds: 10,
      enemyDefeatsByKind: boss ? { [boss]: 1, walker: 2 } : { walker: 3 }, reward: survivalWaveReward(wave) });
  }
  return current;
}
function choose(save) { const run = save.survival.active.run; return selectV100SurvivalUpgrade(save, run.runId, run.pendingUpgradeChoices[0]); }

test("V1 preserves the exact receipt pool and seven ordered duplicate slots; legacy semantics remain", () => {
  assert.deepEqual(normalizeSurvivalBossPool(["takuya"]), ["takuya", "gate-eater"]);
  assert.deepEqual(normalizeSurvivalBossPool([], { strict: true }), []);
  assert.equal(selectSurvivalBossKind({ waveNumber: 5, bossPool: [], strictBossPool: true }), null);
  assert.throws(() => survivalWaveSpawnPlan(5, { bossPool: [], strictBossPool: true }));
  const old = createSurvivalRun({ runId: "old", formation: { unitIds: Array(7).fill("unit-hachi") } });
  assert.equal(old.formation.unitIds.length, 1); assert.equal(Object.hasOwn(old, "modePolicy"), false);
  const current = reload(beginV100Survival(ready(), { runId: "current" }).save).survival.active.run;
  assert.deepEqual(current.bossPool, ["takuya"]); assert.equal(current.formation.unitIds.length, 7); assert.equal(current.modePolicy, "v100");
  for (const n of [5, 10, 15, 20]) assert.equal(survivalWaveSpawnPlan(n, { bossPool: current.bossPool, lastBossKind: "takuya", strictBossPool: true }).bossKind, "takuya");
  assert.deepEqual(normalizeSurvivalRun(current), current);
});

for (const boss of V100_BOSSES) test(`${boss.id} checkpoint and choice persist exactly once without Story changes`, () => {
  const initial = ready(boss), begun = beginV100Survival(initial, { runId: boss.id }); assert.equal(begun.applied, true);
  const raw = completeThrough(begun.save.survival.active.run, 5);
  const outcome = checkpointV100Survival(begun.save, raw); assert.equal(outcome.applied, true);
  const saved = reload(outcome.save);
  assert.equal(saved.caps, 110); assert.equal(saved.bosses.defeatCounts[boss.id], 2); assert.equal(saved.survival.clearCounts[boss.id], 1);
  assert.equal(saved.equipment.inventory["survival-field-kit"], 1); assert.equal(saved.survival.active.run.crawler.hp, 540);
  assert.deepEqual(saved.completedStageIds, initial.completedStageIds); assert.deepEqual(saved.availableStageIds, initial.availableStageIds); assert.deepEqual(saved.ownedUnitIds, initial.ownedUnitIds);
  assert.equal(checkpointV100Survival(saved, raw).applied, false);
  const id = saved.survival.active.run.pendingUpgradeChoices[0], selected = selectV100SurvivalUpgrade(saved, boss.id, id);
  assert.equal(selected.applied, true); assert.equal(selected.save.survival.active.run.temporaryUpgradeStacks[id], 1);
  const resumed = reload(selected.save); assert.equal(resumed.survival.active.run.phase, "wave-ready");
  assert.equal(selectV100SurvivalUpgrade(resumed, boss.id, id).applied, false); assert.equal(resumed.caps, 110);
});

test("partial defeat and withdrawal pay completed normal waves, never an unfinished boss", () => {
  for (const reason of [SURVIVAL_END_REASONS.WITHDRAWAL, SURVIVAL_END_REASONS.CRAWLER_DESTROYED]) {
    let save = beginV100Survival(ready(), { runId: reason }).save;
    save = checkpointV100Survival(save, completeThrough(save.survival.active.run, 5)).save;
    save = choose(save).save;
    let run = completeThrough(save.survival.active.run, 9);
    run = beginSurvivalWave(run); run.stats.enemyDefeatsByKind.takuya += 1; run.stats.bossKills += 1;
    const ended = endSurvivalRun(run, reason), outcome = settleV100Survival(save, ended); assert.equal(outcome.applied, true);
    const result = reload(outcome.save); assert.equal(result.caps, 232); assert.equal(result.survival.lastResult.finalCaps, 122);
    assert.equal(result.bosses.defeatCounts[V100_BOSSES[0].id], 2); assert.equal(result.survival.clearCounts[V100_BOSSES[0].id], 1);
    assert.equal(result.survival.lastResult.clearedBosses, 1); assert.equal(result.survival.highestCompletedWave, 9);
    assert.equal(result.survival.highestReachedWave, 10); assert.equal(result.survival.active, null);
    assert.equal(settleV100Survival(result, ended).applied, false); assert.equal(result.survival.totalRuns, 1);
    assert.equal(dismissV100SurvivalResult(result).save.survival.view, "hub");
  }
});

test("late starts require completed milestones and cannot earn skipped rewards or boss counts", () => {
  let save = ready(); assert.equal(beginV100Survival(save, { runId: "locked", startWave: 11 }).applied, false);
  save = beginV100Survival(save, { runId: "full" }).save;
  for (const wave of [5, 10, 15, 20]) { save = checkpointV100Survival(save, completeThrough(save.survival.active.run, wave)).save; save = choose(save).save; }
  assert.equal(save.bosses.defeatCounts[V100_BOSSES[0].id], 5); assert.equal(save.ownedUnitIds.length, ready().ownedUnitIds.length);
  save = settleV100Survival(save, endSurvivalRun(save.survival.active.run, SURVIVAL_END_REASONS.WITHDRAWAL)).save;
  save = dismissV100SurvivalResult(save).save;
  const caps = save.caps, count = save.bosses.defeatCounts[V100_BOSSES[0].id];
  const late = beginV100Survival(save, { runId: "late", startWave: 21 }); assert.equal(late.applied, true);
  const ended = settleV100Survival(late.save, endSurvivalRun(late.save.survival.active.run, SURVIVAL_END_REASONS.WITHDRAWAL)).save;
  assert.equal(ended.caps, caps); assert.equal(ended.bosses.defeatCounts[V100_BOSSES[0].id], count); assert.equal(ended.survival.lastResult.totalCaps, 0);
});

test("undiscovered, prototype, competing and substituted runs cannot enter or settle", () => {
  const empty = createDefaultV100Save(); empty.flowState.phase = "map"; empty.bosses.discoveredIds = V100_BOSSES.map(b => b.id);
  assert.deepEqual(v100SurvivalBossPool(empty.receipts), []); assert.equal(beginV100Survival(empty, { runId: "none" }).applied, false);
  const initial = ready(), begun = beginV100Survival(initial, { runId: "valid" }).save, run = completeThrough(begun.survival.active.run, 5);
  assert.equal(beginV100Outbreak(begun, V100_BOSSES[0].id, { runId: "other" }).applied, false);
  assert.equal(beginV100Survival(begun, { runId: "other" }).applied, false);
  for (const change of [{ runId: "substitute" }, { bossPool: ["kurome-prototype"] }, { lastCompletedWave: 10 }, { lastCompletedWave: 5.5 }, { lastBossKind: "gate-eater" }, { crawler: { maxHp: 999, hp: 900 } }, { crawler: { maxHp: 680, hp: 681 } }, { stats: { ...run.stats, battleSeconds: Infinity } }]) {
    const result = checkpointV100Survival(begun, { ...run, ...change }); assert.equal(result.applied, false); assert.deepEqual(result.save, normalizeV100Save(begun));
  }
  const finished = settleV100Survival(begun, endSurvivalRun(begun.survival.active.run, SURVIVAL_END_REASONS.WITHDRAWAL)).save;
  assert.equal(reload({ ...finished, survival: { ...finished.survival, active: begun.survival.active } }).survival.active, null);
  const old = createDefaultV100Save(); delete old.survival; assert.equal(reload(old).survival.active, null); assert.equal(reload(old).survival.totalRuns, 0);
});
