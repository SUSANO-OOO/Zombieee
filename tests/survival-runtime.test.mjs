import test from "node:test";
import assert from "node:assert/strict";

import {
  checkpointSurvivalCampaignSave,
  createDefaultCampaignSave,
  deserializeCampaignSave,
  persistSurvivalCampaignSettlement,
  serializeCampaignSave,
  settleSurvivalCampaignSave,
  verifyCampaignSaveIntegrity,
} from "../app/campaign.js";
import {
  SURVIVAL_END_REASONS,
  SURVIVAL_RUN_PHASES,
  beginSurvivalWave,
  completeSurvivalBossEntrance,
  completeSurvivalWave,
  createSurvivalRun,
  endSurvivalRun,
  saveSurvivalCheckpoint,
  selectSurvivalUpgrade,
} from "../app/survival.js";
import {
  SURVIVAL_DEFENSE_FRONT,
  advanceSurvivalCombat,
  chooseSurvivalCombatUpgrade,
  createSurvivalCombatRuntime,
  survivalCombatEndReason,
  survivalDefenseDestination,
  survivalHudSnapshot,
  selectSurvivalBossKind,
  survivalUpgradeEffects,
  survivalWaveReward,
  survivalWaveSpawnPlan,
} from "../app/survivalBattleRuntime.js";

function formation() {
  return {
    presetId: "formation-preset-1",
    unitIds: ["unit-hachi", "unit-nao"],
    unitLevelsByUnit: { "unit-hachi": 4, "unit-nao": 3 },
    personalEquipmentByUnit: {},
    tacticalEquipmentIds: [],
  };
}

function newRun(runId = "survival-runtime-test") {
  return createSurvivalRun({
    runId,
    startedAt: "2026-07-26T10:00:00.000Z",
    formation: formation(),
  });
}

function completeWave(run, reward = survivalWaveReward(run.currentWave)) {
  let active = beginSurvivalWave(run);
  if (active.bossEntrancePending) active = completeSurvivalBossEntrance(active);
  const boss = active.currentWave % 5 === 0;
  return completeSurvivalWave(active, {
    kills: boss ? 3 : 2,
    bossKills: boss ? 1 : 0,
    crawlerHp: active.crawler.hp,
    reward,
  });
}

function completeThroughWave(run, targetWave, rewardForWave = survivalWaveReward) {
  let current = run;
  while (current.lastCompletedWave < targetWave) {
    const wave = current.currentWave;
    current = completeWave(current, rewardForWave(wave));
    if (current.phase === SURVIVAL_RUN_PHASES.UPGRADE_SELECTION) {
      current = selectSurvivalUpgrade(current, current.pendingUpgradeChoices[0]);
    }
  }
  return current;
}

test("wave plans are deterministic, bounded, and put bosses on every fifth wave", () => {
  for (const wave of [1, 4, 5, 10, 25, 1000]) {
    const first = survivalWaveSpawnPlan(wave);
    const second = survivalWaveSpawnPlan(wave);
    assert.deepEqual(first, second);
    assert.ok(first.units.length <= 32);
    assert.equal(Boolean(first.bossKind), wave % 5 === 0);
    if (first.bossKind) assert.equal(first.units.includes(first.bossKind), true);
  }
  assert.notEqual(survivalWaveSpawnPlan(5).bossKind, survivalWaveSpawnPlan(10).bossKind);
});

test("unlocked boss pool is snapshotted and never repeats the previous boss when alternatives exist", () => {
  const bossPool = ["takuya", "gate-eater", "kurome", "mother", "ooguchi", "gairen", "futago"];
  const run = createSurvivalRun({
    runId: "survival-boss-pool",
    formation: formation(),
    bossPool,
  });
  assert.deepEqual(run.bossPool, bossPool);
  assert.equal(run.lastBossKind, null);
  let lastBossKind = null;
  const sequence = [];
  for (const waveNumber of [5, 10, 15, 20, 25, 30, 35, 40, 45]) {
    const plan = survivalWaveSpawnPlan(waveNumber, { bossPool, lastBossKind });
    assert.equal(plan.bossKind, selectSurvivalBossKind({
      waveNumber,
      bossPool,
      lastBossKind,
    }));
    assert.notEqual(plan.bossKind, lastBossKind);
    assert.equal(plan.units.includes(plan.bossKind), true);
    sequence.push(plan.bossKind);
    lastBossKind = plan.bossKind;
  }
  assert.ok(new Set(sequence).size >= 6);

  const single = survivalWaveSpawnPlan(5, {
    bossPool: ["mother"],
    lastBossKind: "mother",
  });
  assert.equal(single.bossKind, "mother");
});

test("combat runtime queues a wave, keeps the boss at 1x until combat-ready, and pauses for upgrade", () => {
  let run = newRun();
  let runtime = createSurvivalCombatRuntime(run);
  let step = advanceSurvivalCombat(runtime, run, { seconds: 2, totalKills: 0 });
  run = step.run;
  runtime = step.runtime;
  assert.equal(run.phase, SURVIVAL_RUN_PHASES.IN_WAVE);
  assert.equal(step.events[0].type, "queue-wave");

  step = advanceSurvivalCombat(runtime, run, {
    activeEnemyCount: 0,
    pendingSpawnCount: 0,
    totalKills: 4,
    crawlerHp: 700,
  });
  assert.equal(step.run.lastCompletedWave, 1);
  assert.equal(step.run.phase, SURVIVAL_RUN_PHASES.WAVE_READY);

  run = completeThroughWave(step.run, 4);
  runtime = createSurvivalCombatRuntime(run);
  step = advanceSurvivalCombat(runtime, run, { seconds: 2, totalKills: run.stats.kills });
  run = step.run;
  runtime = step.runtime;
  assert.equal(run.currentWave, 5);
  assert.equal(run.speed, 1);
  assert.equal(run.bossEntrancePending, true);
  assert.equal(step.events.some(({ type }) => type === "boss-warning"), true);
  assert.equal(
    run.lastBossKind,
    step.events.find(({ type }) => type === "boss-warning").bossKind,
  );

  step = advanceSurvivalCombat(runtime, run, {
    activeEnemyCount: 1,
    pendingSpawnCount: 0,
    totalKills: run.stats.kills,
    bossCombatReady: true,
  });
  run = step.run;
  runtime = step.runtime;
  assert.equal(run.bossEntrancePending, false);
  assert.equal(step.events.some(({ type }) => type === "boss-combat-ready"), true);

  step = advanceSurvivalCombat(runtime, run, {
    activeEnemyCount: 0,
    pendingSpawnCount: 0,
    totalKills: run.stats.kills + 5,
    crawlerHp: 640,
  });
  assert.equal(step.run.phase, SURVIVAL_RUN_PHASES.UPGRADE_SELECTION);
  assert.equal(step.run.pendingUpgradeChoices.length, 3);
  assert.equal(step.events.some(({ type }) => type === "checkpoint"), true);

  const selected = chooseSurvivalCombatUpgrade(
    step.runtime,
    step.run,
    step.run.pendingUpgradeChoices[0],
  );
  assert.equal(selected.selected, true);
  assert.equal(selected.run.phase, SURVIVAL_RUN_PHASES.WAVE_READY);
  assert.equal(selected.runtime.intermissionRemaining, 1.5);
});

test("terminal loss wins atomically over boss completion and emits no checkpoint", () => {
  let run = completeThroughWave(newRun("terminal-before-checkpoint"), 4);
  let runtime = createSurvivalCombatRuntime(run);
  let step = advanceSurvivalCombat(runtime, run, {
    seconds: 2,
    totalKills: run.stats.kills,
    livingHumanCount: 1,
  });
  run = step.run;
  runtime = step.runtime;
  assert.equal(run.currentWave, 5);
  assert.equal(run.phase, SURVIVAL_RUN_PHASES.IN_WAVE);

  step = advanceSurvivalCombat(runtime, run, {
    seconds: 0.1,
    activeEnemyCount: 0,
    pendingSpawnCount: 0,
    totalKills: run.stats.kills + 1,
    crawlerHp: 0,
    livingHumanCount: 1,
  });
  assert.equal(step.terminalReason, SURVIVAL_END_REASONS.CRAWLER_DESTROYED);
  assert.deepEqual(step.events, []);
  assert.equal(step.run.lastCompletedWave, 4);
  assert.equal(step.run.phase, SURVIVAL_RUN_PHASES.IN_WAVE);
  assert.equal(step.run.pendingUpgradeChoices.length, 0);
});

test("squad terminal grace wins over an otherwise empty boss wave", () => {
  let run = completeThroughWave(newRun("squad-terminal-before-checkpoint"), 4);
  let runtime = createSurvivalCombatRuntime(run);
  let step = advanceSurvivalCombat(runtime, run, {
    seconds: 2,
    totalKills: run.stats.kills,
    livingHumanCount: 1,
  });
  run = step.run;
  runtime = { ...step.runtime, hadLivingHuman: true, noHumanSeconds: 2.95 };
  step = advanceSurvivalCombat(runtime, run, {
    seconds: 0.1,
    activeEnemyCount: 0,
    pendingSpawnCount: 0,
    totalKills: run.stats.kills + 1,
    crawlerHp: 700,
    livingHumanCount: 0,
    queuedHumanCount: 0,
  });
  assert.equal(step.terminalReason, SURVIVAL_END_REASONS.SQUAD_DEFEATED);
  assert.deepEqual(step.events, []);
  assert.equal(step.run.lastCompletedWave, 4);
});

test("defense front clamps role anchors and returns temporary pursuit to the front", () => {
  assert.equal(
    survivalDefenseDestination({ aiProfile: "frontline", desiredX: 900 }),
    SURVIVAL_DEFENSE_FRONT.pursuitLimitX,
  );
  assert.equal(
    survivalDefenseDestination({ aiProfile: "marksman", desiredX: undefined }),
    SURVIVAL_DEFENSE_FRONT.rangedX,
  );
  assert.equal(
    survivalDefenseDestination({
      aiProfile: "support",
      desiredX: 800,
      emergencyDefense: true,
      activeThreatX: 380,
    }),
    SURVIVAL_DEFENSE_FRONT.emergencyDefenseX,
  );
});

test("squad defeat and CRAWLER destruction are distinct terminal contracts", () => {
  const run = beginSurvivalWave(newRun());
  const runtime = {
    ...createSurvivalCombatRuntime(run),
    hadLivingHuman: true,
    noHumanSeconds: 3,
  };
  assert.equal(
    survivalCombatEndReason(runtime, run, { crawlerHp: 700 }),
    SURVIVAL_END_REASONS.SQUAD_DEFEATED,
  );
  assert.equal(
    survivalCombatEndReason(runtime, run, { crawlerHp: 0 }),
    SURVIVAL_END_REASONS.CRAWLER_DESTROYED,
  );
});

test("HUD snapshot exposes wave, next boss, speed lock, CRAWLER HP, and upgrade state", () => {
  const run = beginSurvivalWave(newRun());
  const hud = survivalHudSnapshot(run, { bossKind: null });
  assert.equal(hud.wave, 1);
  assert.equal(hud.nextBossWave, 5);
  assert.equal(hud.crawlerHp, 700);
  assert.equal(hud.speed, 1);
  assert.equal(hud.pendingUpgradeChoices.length, 0);
});

test("temporary upgrades expose live combat multipliers for deployed and future units", () => {
  const effects = survivalUpgradeEffects({
    ...newRun("upgrade-effects"),
    temporaryUpgradeStacks: {
      "assault-drill": 2,
      "layered-armor": 2,
      "field-triage": 1,
      "range-calibration": 1,
      "rapid-redeployment": 2,
      "boss-breaker": 1,
    },
  });
  assert.equal(effects.attackMultiplier, 1.16);
  assert.equal(effects.defenseMultiplier, .88);
  assert.equal(effects.healingMultiplier, 1.1);
  assert.equal(effects.rangeMultiplier, 1.06);
  assert.equal(effects.redeployMultiplier, .84);
  assert.equal(effects.bossDamageMultiplier, 1.1);
});

test("checkpoint save advances one revision and stamps integrity once", () => {
  let run = completeThroughWave(newRun("checkpoint-atomic"), 5);
  const current = createDefaultCampaignSave();
  const result = checkpointSurvivalCampaignSave(current, run, {
    savedAt: "2026-07-26T10:05:00.000Z",
  });
  assert.equal(result.applied, true);
  assert.equal(result.save.revision, current.revision + 1);
  assert.equal(verifyCampaignSaveIntegrity(result.save), true);
  assert.equal(result.save.survival.activeCheckpoint.checkpointWave, 5);
  const duplicate = checkpointSurvivalCampaignSave(result.save, run, {
    savedAt: "2026-07-26T10:06:00.000Z",
  });
  assert.equal(duplicate.applied, false);
  assert.equal(duplicate.save.revision, result.save.revision);
});

test("atomic settlement updates progress, receipts, caps, equipment, checkpoint deletion, revision, and integrity together", () => {
  let run = completeThroughWave(
    newRun("settlement-atomic"),
    10,
    (wave) => ({
      caps: wave,
      equipmentGrants: wave % 5 === 0
        ? [{ equipmentId: "survival-field-kit", quantity: 1 }]
        : [],
    }),
  );
  const progressWithCheckpoint = saveSurvivalCheckpoint(
    createDefaultCampaignSave().survival,
    run,
    "2026-07-26T10:10:00.000Z",
  );
  const current = {
    ...createDefaultCampaignSave(),
    caps: 100,
    supplies: 100,
    equipmentInventory: [{ equipmentId: "survival-field-kit", quantity: 2 }],
    survival: progressWithCheckpoint,
  };
  run = endSurvivalRun(run, SURVIVAL_END_REASONS.WITHDRAWAL, "2026-07-26T10:11:00.000Z");
  const result = settleSurvivalCampaignSave(current, run, {
    endedAt: "2026-07-26T10:11:00.000Z",
  });
  assert.equal(result.applied, true);
  assert.equal(result.save.revision, current.revision + 1);
  assert.equal(verifyCampaignSaveIntegrity(result.save), true);
  assert.equal(result.save.caps, 155);
  assert.equal(result.save.supplies, 155);
  assert.deepEqual(result.save.equipmentInventory, [
    { equipmentId: "survival-field-kit", quantity: 4 },
  ]);
  assert.equal(result.save.survival.processedRunIds.includes(run.runId), true);
  assert.equal(result.save.survival.claimedRewardIds.length, 2);
  assert.equal(result.save.survival.activeCheckpoint, null);
  assert.equal(result.save.survival.lastResult.earnedCaps, 55);
});

test("serialized settlement reload cannot award caps, equipment, or receipts twice", () => {
  const completed = completeThroughWave(
    newRun("settlement-reload"),
    5,
    () => ({
      caps: 40,
      equipmentGrants: [{ equipmentId: "survival-field-kit", quantity: 2 }],
    }),
  );
  const ended = endSurvivalRun(
    completed,
    SURVIVAL_END_REASONS.CRAWLER_DESTROYED,
    "2026-07-26T10:20:00.000Z",
  );
  const first = settleSurvivalCampaignSave(createDefaultCampaignSave(), ended, {
    endedAt: "2026-07-26T10:20:00.000Z",
  });
  const reloaded = deserializeCampaignSave(serializeCampaignSave(first.save));
  const second = settleSurvivalCampaignSave(reloaded, ended, {
    endedAt: "2026-07-26T10:21:00.000Z",
  });
  assert.equal(second.applied, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.payout.caps, 0);
  assert.deepEqual(second.payout.equipmentGrants, []);
  assert.equal(second.save.caps, first.save.caps);
  assert.deepEqual(second.save.equipmentInventory, first.save.equipmentInventory);
  assert.equal(second.save.revision, first.save.revision);
  assert.equal(verifyCampaignSaveIntegrity(second.save), true);
});

test("persistence publishes the complete candidate once or retains the old save without partial state", async () => {
  const ended = endSurvivalRun(
    completeThroughWave(newRun("settlement-persist"), 5),
    SURVIVAL_END_REASONS.WITHDRAWAL,
    "2026-07-26T10:30:00.000Z",
  );
  const current = createDefaultCampaignSave();
  let calls = 0;
  const failed = await persistSurvivalCampaignSettlement(current, ended, {
    endedAt: "2026-07-26T10:30:00.000Z",
    persist: async () => {
      calls += 1;
      return { durable: false };
    },
  });
  assert.equal(calls, 1);
  assert.equal(failed.committed, false);
  assert.equal(failed.save, current);
  assert.equal(failed.candidateSave.survival.processedRunIds.includes(ended.runId), true);

  calls = 0;
  const succeeded = await persistSurvivalCampaignSettlement(current, ended, {
    endedAt: "2026-07-26T10:30:00.000Z",
    persist: async (candidate) => {
      calls += 1;
      assert.equal(verifyCampaignSaveIntegrity(candidate), true);
      return { durable: true };
    },
  });
  assert.equal(calls, 1);
  assert.equal(succeeded.committed, true);
  assert.equal(succeeded.save.survival.processedRunIds.includes(ended.runId), true);
});
