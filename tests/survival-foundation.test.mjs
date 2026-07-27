import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMPAIGN_SAVE_SCHEMA_VERSION,
  computeCampaignSaveIntegrity,
  createDefaultCampaignSave,
  deserializeCampaignSave,
  inspectCampaignSaveCandidate,
  serializeCampaignSave,
} from "../app/campaign.js";
import {
  SURVIVAL_END_REASONS,
  SURVIVAL_RUN_PHASES,
  SURVIVAL_SPEED_OPTIONS,
  SURVIVAL_UPGRADES,
  beginSurvivalWave,
  completeSurvivalBossEntrance,
  completeSurvivalWave,
  createDefaultSurvivalProgress,
  createSurvivalCheckpoint,
  createSurvivalRun,
  endSurvivalRun,
  normalizeSurvivalProgress,
  resumeSurvivalCheckpoint,
  saveSurvivalCheckpoint,
  selectSurvivalUpgrade,
  setSurvivalRunSpeed,
  settleSurvivalRun,
  survivalLateStartUpgradeStacks,
  survivalUnlockedStartWaves,
  survivalUpgradeChoices,
  survivalWaveDescriptor,
} from "../app/survival.js";

function playWave(run, input = {}) {
  let active = beginSurvivalWave(run);
  if (active.bossEntrancePending) active = completeSurvivalBossEntrance(active);
  return completeSurvivalWave(active, input);
}

function playThrough(run, lastWave, rewardCaps = 0) {
  let current = run;
  while (current.lastCompletedWave < lastWave) {
    const wave = current.currentWave;
    current = playWave(current, {
      kills: wave,
      damageByUnit: { "unit-paissen": wave * 10 },
      reward: { caps: rewardCaps },
    });
    if (current.phase === SURVIVAL_RUN_PHASES.UPGRADE_SELECTION && current.currentWave <= lastWave) {
      current = selectSurvivalUpgrade(current, current.pendingUpgradeChoices[0]);
    }
  }
  return current;
}

test("models unbounded five-wave blocks, boss cadence, and ten-wave map damage tiers", () => {
  assert.deepEqual(survivalWaveDescriptor(1), {
    waveNumber: 1,
    blockNumber: 1,
    waveInBlock: 1,
    isBoss: false,
    mapDamageTier: 0,
  });
  assert.deepEqual(survivalWaveDescriptor(5), {
    waveNumber: 5,
    blockNumber: 1,
    waveInBlock: 5,
    isBoss: true,
    mapDamageTier: 0,
  });
  assert.deepEqual(survivalWaveDescriptor(10), {
    waveNumber: 10,
    blockNumber: 2,
    waveInBlock: 5,
    isBoss: true,
    mapDamageTier: 0,
  });
  assert.equal(survivalWaveDescriptor(11).mapDamageTier, 1);
  assert.equal(survivalWaveDescriptor(10_005).isBoss, true);
  assert.equal(survivalWaveDescriptor(10_005).blockNumber, 2_001);
});

test("unlocks starts at wave 11, 21, and later without granting skipped rewards", () => {
  assert.deepEqual(survivalUnlockedStartWaves(0), [1]);
  assert.deepEqual(survivalUnlockedStartWaves(9), [1]);
  assert.deepEqual(survivalUnlockedStartWaves(10), [1, 11]);
  assert.deepEqual(survivalUnlockedStartWaves(29), [1, 11, 21]);
  assert.deepEqual(survivalUnlockedStartWaves(30), [1, 11, 21, 31]);
  assert.throws(
    () => createSurvivalRun({ runId: "locked", startWave: 11, unlockedStartWaves: [1] }),
    /not unlocked/,
  );

  const late = createSurvivalRun({
    runId: "late-start",
    startWave: 21,
    unlockedStartWaves: [1, 11, 21],
    formation: {
      presetId: "formation-preset-2",
      unitIds: ["unit-paissen", "unit-nao"],
      unitLevelsByUnit: { "unit-paissen": 18, "unit-nao": 7 },
      personalEquipmentByUnit: { "unit-paissen": ["equipment-a", "equipment-b", "ignored-third"] },
      tacticalEquipmentIds: ["tactical-a", "tactical-b", "ignored-third"],
    },
  });
  assert.equal(late.startWave, 21);
  assert.equal(late.currentWave, 21);
  assert.equal(late.lastCompletedWave, 20);
  assert.equal(Object.values(late.temporaryUpgradeStacks).reduce((total, stacks) => total + stacks, 0), 4);
  assert.deepEqual(late.pendingReward, { caps: 0, equipmentGrants: [] });
  assert.deepEqual(late.checkpointRewards, []);
  assert.deepEqual(late.formation.unitLevelsByUnit, {
    "unit-paissen": 18,
    "unit-nao": 7,
  });
  assert.deepEqual(late.formation.personalEquipmentByUnit["unit-paissen"], ["equipment-a", "equipment-b"]);
  assert.deepEqual(late.formation.tacticalEquipmentIds, ["tactical-a", "tactical-b"]);
  assert.deepEqual(survivalLateStartUpgradeStacks(1), {});
});

test("resets a boss wave to 1x and allows 2x only after the entrance finishes", () => {
  let run = createSurvivalRun({ runId: "speed-gate" });
  run = beginSurvivalWave(run);
  run = setSurvivalRunSpeed(run, 2);
  assert.equal(run.speed, 2);
  run = completeSurvivalWave(run, { kills: 1 });
  run = playWave(run, { kills: 2 });
  run = playWave(run, { kills: 3 });
  run = playWave(run, { kills: 4 });
  assert.equal(run.currentWave, 5);
  assert.equal(run.speed, 2);

  run = beginSurvivalWave(run);
  assert.equal(run.speed, 1);
  assert.equal(run.bossEntrancePending, true);
  assert.equal(setSurvivalRunSpeed(run, 2).speed, 1);
  run = completeSurvivalBossEntrance(run);
  run = setSurvivalRunSpeed(run, 2);
  assert.equal(run.speed, 2);
  assert.deepEqual(SURVIVAL_SPEED_OPTIONS, [1, 2]);

  run = completeSurvivalWave(run, { kills: 5, reward: { caps: 25 } });
  assert.equal(run.phase, SURVIVAL_RUN_PHASES.UPGRADE_SELECTION);
  assert.equal(run.speed, 1);
  assert.equal(run.pendingUpgradeChoices.length, 3);
  assert.equal(new Set(run.pendingUpgradeChoices).size, 3);
});

test("offers deterministic unique three-choice upgrades and applies only the selected effect", () => {
  assert.equal(SURVIVAL_UPGRADES.length, 7);
  const choices = survivalUpgradeChoices("upgrade-run", 5);
  assert.deepEqual(survivalUpgradeChoices("upgrade-run", 5), choices);
  assert.equal(choices.length, 3);
  assert.equal(new Set(choices).size, 3);

  let run = playThrough(createSurvivalRun({ runId: "upgrade-run" }), 5);
  const before = structuredClone(run);
  const invalid = selectSurvivalUpgrade(run, "not-a-real-upgrade");
  assert.deepEqual(invalid, run);
  assert.deepEqual(run, before);

  for (const inheritedKey of ["constructor", "__proto__", "toString"]) {
    const forged = {
      ...before,
      pendingUpgradeChoices: [inheritedKey, inheritedKey, inheritedKey],
      temporaryUpgradeStacks: Object.fromEntries([[inheritedKey, 3]]),
    };
    const rejected = selectSurvivalUpgrade(forged, inheritedKey);
    assert.equal(rejected.phase, SURVIVAL_RUN_PHASES.UPGRADE_SELECTION);
    assert.equal(rejected.pendingUpgradeChoices.includes(inheritedKey), false);
    assert.equal(Object.hasOwn(rejected.temporaryUpgradeStacks, inheritedKey), false);
    assert.ok(rejected.pendingUpgradeChoices.every(
      (upgradeId) => SURVIVAL_UPGRADES.some(({ id }) => id === upgradeId),
    ));
  }

  const selectedId = run.pendingUpgradeChoices[0];
  run = selectSurvivalUpgrade(run, selectedId);
  assert.equal(run.phase, SURVIVAL_RUN_PHASES.WAVE_READY);
  assert.deepEqual(run.pendingUpgradeChoices, []);
  assert.equal(run.temporaryUpgradeStacks[selectedId], 1);
});

test("deterministic shuffle terminates with three unique choices for 3, 6, 7, 8, and 9 upgrades", () => {
  for (const upgradeCount of [3, 6, 7, 8, 9]) {
    const pool = Array.from(
      { length: upgradeCount },
      (_, index) => ({ id: `test-upgrade-${upgradeCount}-${index + 1}` }),
    );
    for (let seedIndex = 0; seedIndex < 100; seedIndex += 1) {
      const runId = `shuffle-${upgradeCount}-${seedIndex}`;
      const choices = survivalUpgradeChoices(runId, 5 + seedIndex * 5, pool);
      assert.equal(choices.length, 3);
      assert.equal(new Set(choices).size, 3);
      assert.ok(choices.every((upgradeId) => pool.some(({ id }) => id === upgradeId)));
      assert.deepEqual(
        survivalUpgradeChoices(runId, 5 + seedIndex * 5, pool),
        choices,
      );
    }
  }
  assert.throws(
    () => survivalUpgradeChoices("too-small", 5, [{ id: "a" }, { id: "b" }]),
    /at least three unique upgrades/,
  );
});

test("saves only boss-boundary checkpoints and resumes pending upgrade selection after reload", () => {
  const initialProgress = createDefaultSurvivalProgress();
  let run = createSurvivalRun({ runId: "checkpoint-run" });
  run = playThrough(run, 4, 5);
  assert.equal(createSurvivalCheckpoint(run), null);

  run = playWave(run, {
    kills: 9,
    reward: {
      caps: 10,
      equipmentGrants: [{ equipmentId: "boss-drop-a", quantity: 1 }],
    },
  });
  const checkpoint = createSurvivalCheckpoint(run, "2026-07-26T09:30:00.000Z");
  assert.equal(checkpoint.checkpointWave, 5);
  assert.equal(checkpoint.run.phase, SURVIVAL_RUN_PHASES.UPGRADE_SELECTION);
  assert.equal(checkpoint.run.checkpointRewards[0].reward.caps, 30);

  const progress = saveSurvivalCheckpoint(initialProgress, run, "2026-07-26T09:30:00.000Z");
  assert.equal(progress.highestWave, 5);
  assert.equal(progress.activeCheckpoint.checkpointId, "survival:checkpoint-run:wave:5");
  const resumed = resumeSurvivalCheckpoint(normalizeSurvivalProgress(JSON.parse(JSON.stringify(progress))));
  assert.equal(resumed.runId, run.runId);
  assert.equal(resumed.phase, SURVIVAL_RUN_PHASES.UPGRADE_SELECTION);
  assert.deepEqual(resumed.pendingUpgradeChoices, run.pendingUpgradeChoices);

  const selected = selectSurvivalUpgrade(resumed, resumed.pendingUpgradeChoices[0]);
  const updatedProgress = saveSurvivalCheckpoint(progress, selected, "2026-07-26T09:31:00.000Z");
  assert.equal(updatedProgress.activeCheckpoint.run.phase, SURVIVAL_RUN_PHASES.WAVE_READY);
  assert.equal(updatedProgress.activeCheckpoint.checkpointWave, 5);
});

test("preserves duplicate equipment quantities within and across checkpoints through settlement", () => {
  const equipmentId = "equipment-survival-repeat";
  let run = createSurvivalRun({ runId: "equipment-quantity-run" });
  run = playWave(run, {
    reward: {
      equipmentGrants: [
        { equipmentId, quantity: 2 },
        { equipmentId, quantity: 3 },
      ],
    },
  });
  run = playWave(run, {
    reward: { equipmentGrants: [{ equipmentId, quantity: 4 }] },
  });
  run = playWave(run);
  run = playWave(run);
  run = playWave(run, {
    reward: { equipmentGrants: [{ equipmentId, quantity: 1 }] },
  });
  assert.deepEqual(run.checkpointRewards[0].reward.equipmentGrants, [
    { equipmentId, quantity: 10 },
  ]);

  run = selectSurvivalUpgrade(run, run.pendingUpgradeChoices[0]);
  run = playWave(run, {
    reward: { equipmentGrants: [{ equipmentId, quantity: 2 }] },
  });
  run = playWave(run);
  run = playWave(run);
  run = playWave(run);
  run = playWave(run, {
    reward: { equipmentGrants: [{ equipmentId, quantity: 5 }] },
  });
  assert.deepEqual(run.checkpointRewards[1].reward.equipmentGrants, [
    { equipmentId, quantity: 7 },
  ]);

  const progress = saveSurvivalCheckpoint(createDefaultSurvivalProgress(), run);
  run = endSurvivalRun(run, SURVIVAL_END_REASONS.WITHDRAWAL);
  const settled = settleSurvivalRun(progress, run);
  assert.deepEqual(settled.payout.equipmentGrants, [
    { equipmentId, quantity: 17 },
  ]);
  assert.deepEqual(settled.progress.lastResult.earnedEquipmentGrants, [
    { equipmentId, quantity: 17 },
  ]);
  const campaign = {
    ...createDefaultCampaignSave(),
    survival: settled.progress,
  };
  const restored = deserializeCampaignSave(serializeCampaignSave(campaign));
  assert.deepEqual(restored.survival.lastResult.earnedEquipmentGrants, [
    { equipmentId, quantity: 17 },
  ]);

  const legacyReward = playWave(
    createSurvivalRun({ runId: "legacy-equipment-array" }),
    { reward: { equipmentIds: [equipmentId, equipmentId] } },
  );
  assert.deepEqual(legacyReward.pendingReward.equipmentGrants, [
    { equipmentId, quantity: 2 },
  ]);
});

test("checkpoints and results retain the run-start unit Level snapshot", () => {
  const formation = {
    presetId: "formation-preset-levels",
    unitIds: ["unit-paissen", "unit-nao", "unit-kumaverson"],
    unitLevelsByUnit: {
      "unit-paissen": 18,
      "unit-nao": 7,
      "unit-kumaverson": 99,
      "unit-not-deployed": 40,
    },
  };
  let run = createSurvivalRun({ runId: "level-snapshot-run", formation });
  formation.unitLevelsByUnit["unit-paissen"] = 50;
  assert.deepEqual(run.formation.unitLevelsByUnit, {
    "unit-paissen": 18,
    "unit-nao": 7,
    "unit-kumaverson": 50,
  });

  run = playThrough(run, 5);
  const progress = saveSurvivalCheckpoint(createDefaultSurvivalProgress(), run);
  const campaign = {
    ...createDefaultCampaignSave(),
    survival: progress,
  };
  const restored = deserializeCampaignSave(serializeCampaignSave(campaign));
  const resumed = resumeSurvivalCheckpoint(restored.survival);
  assert.deepEqual(resumed.formation.unitLevelsByUnit, {
    "unit-paissen": 18,
    "unit-nao": 7,
    "unit-kumaverson": 50,
  });

  const ended = endSurvivalRun(resumed, SURVIVAL_END_REASONS.WITHDRAWAL);
  const settled = settleSurvivalRun(progress, ended);
  assert.deepEqual(settled.progress.lastResult.formation.unitLevelsByUnit, {
    "unit-paissen": 18,
    "unit-nao": 7,
    "unit-kumaverson": 50,
  });
});

test("settles completed checkpoint and partial-wave rewards exactly once", () => {
  let run = createSurvivalRun({
    runId: "settlement-run",
    formation: {
      presetId: "formation-preset-1",
      unitIds: ["unit-paissen", "unit-nao"],
      tacticalEquipmentIds: ["tactical-radio"],
    },
  });
  run = playThrough(run, 5, 10);
  let progress = saveSurvivalCheckpoint(createDefaultSurvivalProgress(), run);
  run = selectSurvivalUpgrade(run, run.pendingUpgradeChoices[0]);
  run = playWave(run, {
    kills: 6,
    damageByUnit: Object.fromEntries([
      ["constructor", 999],
      ["__proto__", 999],
      ["toString", 999],
      ["prototype", 999],
      [" constructor ", 999],
      [" __proto__ ", 999],
      [" toString ", 999],
      [" prototype ", 999],
    ]),
    reward: { caps: 10 },
  });
  run = playWave(run, {
    kills: 7,
    reward: {
      caps: 10,
      equipmentGrants: [{ equipmentId: "equipment-survival-a", quantity: 1 }],
    },
  });
  run = endSurvivalRun(run, SURVIVAL_END_REASONS.WITHDRAWAL, "2026-07-26T10:00:00.000Z");

  const settled = settleSurvivalRun(progress, run, { endedAt: "2026-07-26T10:00:00.000Z" });
  progress = settled.progress;
  assert.equal(settled.duplicate, false);
  assert.equal(settled.payout.caps, 70);
  assert.deepEqual(settled.payout.equipmentGrants, [
    { equipmentId: "equipment-survival-a", quantity: 1 },
  ]);
  assert.equal(settled.payout.rewardIds.length, 2);
  assert.equal(progress.highestWave, 7);
  assert.equal(progress.totalRuns, 1);
  assert.equal(progress.activeCheckpoint, null);
  assert.equal(progress.lastResult.reachedWave, 7);
  assert.equal(progress.lastResult.stats.kills, 1 + 2 + 3 + 4 + 5 + 6 + 7);
  for (const inheritedKey of ["constructor", "__proto__", "toString", "prototype"]) {
    assert.equal(
      Object.hasOwn(progress.lastResult.stats.damageByUnit, inheritedKey),
      false,
    );
  }
  assert.deepEqual(progress.lastResult.formation.tacticalEquipmentIds, ["tactical-radio"]);

  const duplicate = settleSurvivalRun(progress, run);
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.payout, {
    caps: 0,
    equipmentGrants: [],
    rewardIds: [],
  });
  assert.equal(duplicate.progress.totalRuns, 1);
  assert.deepEqual(duplicate.progress.claimedRewardIds, progress.claimedRewardIds);
});

test("a late start, defeat, or withdrawal never pays rewards for skipped or unfinished waves", () => {
  let run = createSurvivalRun({
    runId: "late-defeat",
    startWave: 11,
    unlockedStartWaves: [1, 11],
  });
  run = beginSurvivalWave(run);
  run = endSurvivalRun(run, SURVIVAL_END_REASONS.CRAWLER_DESTROYED);
  const settled = settleSurvivalRun(createDefaultSurvivalProgress(), run);
  assert.equal(settled.payout.caps, 0);
  assert.equal(settled.progress.lastResult.reachedWave, 10);
  assert.equal(settled.progress.highestWave, 10);
  assert.deepEqual(settled.progress.unlockedStartWaves, [1, 11]);

  let forged = createSurvivalRun({
    runId: "late-forged-checkpoints",
    startWave: 21,
    unlockedStartWaves: [1, 11, 21],
  });
  forged = {
    ...forged,
    checkpointRewards: [
      {
        checkpointWave: 5,
        reward: {
          caps: 999,
          equipmentGrants: [{ equipmentId: "forged-equipment", quantity: 2 }],
        },
      },
      {
        checkpointWave: 20,
        reward: {
          caps: 999,
          equipmentGrants: [{ equipmentId: "forged-equipment", quantity: 2 }],
        },
      },
    ],
  };
  forged = endSurvivalRun(forged, SURVIVAL_END_REASONS.WITHDRAWAL);
  const rejected = settleSurvivalRun(createDefaultSurvivalProgress(), forged);
  assert.deepEqual(rejected.payout, {
    caps: 0,
    equipmentGrants: [],
    rewardIds: [],
  });
  assert.deepEqual(rejected.progress.claimedRewardIds, []);
});

test("campaign schema 12 persists survival checkpoints and migrates a stamped schema 7 save", () => {
  const fresh = createDefaultCampaignSave();
  assert.equal(CAMPAIGN_SAVE_SCHEMA_VERSION, 12);
  assert.deepEqual(fresh.survival, createDefaultSurvivalProgress());

  const checkpointBossPool = ["takuya", "gate-eater", "mother", "gairen"];
  let run = playThrough(createSurvivalRun({
    runId: "campaign-checkpoint",
    bossPool: checkpointBossPool,
  }), 5, 4);
  const save = {
    ...fresh,
    survival: saveSurvivalCheckpoint(fresh.survival, run, "2026-07-26T11:00:00.000Z"),
  };
  const restored = deserializeCampaignSave(serializeCampaignSave(save));
  assert.equal(restored.schemaVersion, CAMPAIGN_SAVE_SCHEMA_VERSION);
  assert.equal(restored.survival.activeCheckpoint.checkpointWave, 5);
  const resumed = resumeSurvivalCheckpoint(restored.survival);
  assert.equal(resumed.runId, "campaign-checkpoint");
  assert.deepEqual(resumed.bossPool, checkpointBossPool);
  assert.equal(resumed.lastBossKind, null);

  const legacy = { ...fresh, schemaVersion: 7 };
  delete legacy.survival;
  legacy.integrity = computeCampaignSaveIntegrity(legacy);
  const inspected = inspectCampaignSaveCandidate(JSON.stringify(legacy), { source: "published-v0.8.0" });
  assert.equal(inspected.status, "valid");
  assert.equal(inspected.reason, "migrated");
  assert.equal(inspected.sourceSchemaVersion, 7);
  assert.equal(inspected.save.schemaVersion, CAMPAIGN_SAVE_SCHEMA_VERSION);
  assert.deepEqual(inspected.save.survival, createDefaultSurvivalProgress());
});
