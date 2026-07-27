import assert from "node:assert/strict";
import test from "node:test";

import {
  computeCampaignSaveIntegrity,
  createDefaultCampaignSave,
  deserializeCampaignSave,
  inspectCampaignSaveCandidate,
  migrateCampaignSave,
  persistOutbreakCampaignSettlement,
  serializeCampaignSave,
  settleOutbreakCampaignSave,
  verifyCampaignSaveIntegrity,
} from "../app/campaign.js";
import {
  OUTBREAK_MISSIONS,
  OUTBREAK_MISSION_BY_ID,
  OUTBREAK_MISSION_IDS,
  createDefaultOutbreakProgress,
  isOutbreakMissionUnlocked,
  normalizeOutbreakProgress,
  resolveOutbreakProgress,
} from "../app/outbreakMissions.js";

const MOTHER_MISSION = OUTBREAK_MISSION_IDS.MOTHER_BROOD_VAULT;

function campaignWithUnlockedMission(missionId = MOTHER_MISSION) {
  const mission = OUTBREAK_MISSION_BY_ID[missionId];
  return {
    ...createDefaultCampaignSave(),
    completedStageIds: [mission.prerequisiteStageId],
  };
}

test("five anomaly missions bind one boss, prerequisite Stage, right-edge spawn profile, and reward", () => {
  assert.equal(OUTBREAK_MISSIONS.length, 5);
  assert.deepEqual(
    OUTBREAK_MISSIONS.map(({ boss }) => boss.enemyKind),
    ["mother", "ooguchi", "kurome", "gairen", "futago"],
  );
  for (const mission of OUTBREAK_MISSIONS) {
    assert.equal(OUTBREAK_MISSION_BY_ID[mission.id], mission);
    assert.equal(mission.operationCategory, "outbreak");
    assert.equal(mission.missionType, "boss-assault");
    assert.equal(mission.objectiveConfig.spawnProfile, "right-edge-outside-boss");
    assert.equal(mission.boss.encounterId, `encounter-${mission.id}`);
    assert.equal(mission.waves.at(-1).units.includes(mission.boss.enemyKind), true);
    assert.ok(mission.baseRewardCaps >= 420);
    assert.deepEqual(mission.firstClearEquipmentGrant.quantity, 1);
  }
});

test("mission unlocks require the authored prerequisite Stage and first clear unlocks Survival exactly once", () => {
  const progress = createDefaultOutbreakProgress();
  assert.deepEqual(normalizeOutbreakProgress({
    survivalBossKinds: ["takuya", "gate-eater", "mother", "gairen"],
  }).survivalBossKinds, ["takuya", "gate-eater"]);
  const mission = OUTBREAK_MISSION_BY_ID[MOTHER_MISSION];
  assert.equal(isOutbreakMissionUnlocked(progress, [], MOTHER_MISSION), false);
  assert.equal(
    isOutbreakMissionUnlocked(progress, [mission.prerequisiteStageId], MOTHER_MISSION),
    true,
  );
  const first = resolveOutbreakProgress(progress, {
    resultId: "outbreak-result-mother-1",
    missionId: MOTHER_MISSION,
    won: true,
    completedAt: "2026-07-27T06:00:00.000Z",
  });
  assert.equal(first.duplicate, false);
  assert.equal(first.progress.clearedMissionIds.includes(MOTHER_MISSION), true);
  assert.equal(first.progress.survivalBossKinds.includes("mother"), true);
  assert.equal(first.progress.bossDefeatCounts.mother, 1);
  assert.equal(first.reward.caps, mission.baseRewardCaps);
  assert.deepEqual(first.reward.equipmentGrants, [mission.firstClearEquipmentGrant]);

  const duplicate = resolveOutbreakProgress(first.progress, {
    resultId: "outbreak-result-mother-1",
    missionId: MOTHER_MISSION,
    won: true,
  });
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.reward, { caps: 0, equipmentGrants: [] });
  assert.deepEqual(duplicate.progress, normalizeOutbreakProgress(first.progress));
});

test("non-boolean victory values never clear a mission or grant rewards", () => {
  const progress = createDefaultOutbreakProgress();
  for (const won of ["false", 1, {}, []]) {
    const resolved = resolveOutbreakProgress(progress, {
      resultId: `outbreak-invalid-victory-${typeof won}-${String(won)}`,
      missionId: MOTHER_MISSION,
      won,
    });
    assert.equal(resolved.progress.clearedMissionIds.length, 0);
    assert.equal(resolved.progress.survivalBossKinds.includes("mother"), false);
    assert.equal(resolved.progress.bossDefeatCounts.mother, undefined);
    assert.equal(resolved.progress.lastResult.won, false);
    assert.deepEqual(resolved.reward, { caps: 0, equipmentGrants: [] });
  }
});

test("campaign settlement rejects a locked mission without consuming its receipt", () => {
  const current = createDefaultCampaignSave();
  const result = {
    resultId: "outbreak-locked-mother",
    missionId: MOTHER_MISSION,
    won: true,
    completedAt: "2026-07-27T06:04:00.000Z",
  };
  const settlement = settleOutbreakCampaignSave(current, result);
  assert.equal(settlement.applied, false);
  assert.equal(settlement.duplicate, false);
  assert.equal(settlement.reason, "mission-locked");
  assert.deepEqual(settlement.payout, { caps: 0, equipmentGrants: [] });
  assert.equal(settlement.save.revision, current.revision);
  assert.equal(settlement.save.processedResultIds.includes(result.resultId), false);
  assert.equal(settlement.save.outbreaks.processedResultIds.includes(result.resultId), false);
  assert.equal(settlement.save.caps, current.caps);
  assert.deepEqual(settlement.save.equipmentInventory, current.equipmentInventory);
});

test("campaign settlement atomically applies receipt, caps, equipment quantity, unlock, revision, and integrity", () => {
  const mission = OUTBREAK_MISSION_BY_ID[MOTHER_MISSION];
  const equipmentId = mission.firstClearEquipmentGrant.equipmentId;
  const current = {
    ...campaignWithUnlockedMission(),
    caps: 100,
    supplies: 100,
    equipmentInventory: [{ equipmentId, quantity: 2 }],
  };
  const result = {
    resultId: "outbreak-atomic-mother",
    missionId: MOTHER_MISSION,
    won: true,
    completedAt: "2026-07-27T06:05:00.000Z",
    stats: { kills: 12, unitsLost: 1, battleSeconds: 88.5 },
  };
  const first = settleOutbreakCampaignSave(current, result);
  assert.equal(first.applied, true);
  assert.equal(first.duplicate, false);
  assert.equal(first.save.revision, current.revision + 1);
  assert.equal(first.save.updatedAt, result.completedAt);
  assert.equal(first.save.caps, 100 + mission.baseRewardCaps);
  assert.equal(first.save.supplies, first.save.caps);
  assert.deepEqual(first.save.equipmentInventory, [{ equipmentId, quantity: 3 }]);
  assert.equal(first.save.processedResultIds.includes(result.resultId), true);
  assert.equal(first.save.outbreaks.processedResultIds.includes(result.resultId), true);
  assert.equal(first.save.outbreaks.claimedRewardIds.length, 1);
  assert.equal(first.save.outbreaks.survivalBossKinds.includes("mother"), true);
  assert.equal(verifyCampaignSaveIntegrity(first.save), true);

  const reloaded = deserializeCampaignSave(serializeCampaignSave(first.save));
  const duplicate = settleOutbreakCampaignSave(reloaded, result);
  assert.equal(duplicate.applied, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.save.revision, first.save.revision);
  assert.equal(duplicate.save.caps, first.save.caps);
  assert.deepEqual(duplicate.save.equipmentInventory, first.save.equipmentInventory);
  assert.equal(verifyCampaignSaveIntegrity(duplicate.save), true);

  const crossLedgerDuplicate = settleOutbreakCampaignSave({
    ...current,
    processedResultIds: ["outbreak-cross-ledger"],
  }, {
    ...result,
    resultId: "outbreak-cross-ledger",
  });
  assert.equal(crossLedgerDuplicate.applied, false);
  assert.equal(crossLedgerDuplicate.duplicate, true);
  assert.deepEqual(crossLedgerDuplicate.payout, { caps: 0, equipmentGrants: [] });
  assert.equal(crossLedgerDuplicate.save.caps, current.caps);
});

test("schema 11 saves migrate once to schema 12 with default outbreak progress", () => {
  const legacy = {
    ...createDefaultCampaignSave(),
    schemaVersion: 11,
    revision: 4,
    updatedAt: "2026-07-27T05:00:00.000Z",
  };
  delete legacy.outbreaks;
  legacy.integrity = computeCampaignSaveIntegrity(legacy);
  const inspected = inspectCampaignSaveCandidate(JSON.stringify(legacy), {
    source: "integration-0.9.0-schema-11",
  });
  assert.equal(inspected.status, "valid");
  assert.equal(inspected.reason, "migrated");
  assert.equal(inspected.sourceSchemaVersion, 11);
  assert.equal(inspected.save.schemaVersion, 12);
  assert.equal(inspected.save.revision, 5);
  assert.deepEqual(inspected.save.outbreaks, createDefaultOutbreakProgress());
  assert.deepEqual(migrateCampaignSave(inspected.save), inspected.save);
});

test("failed persistence publishes no partial outbreak progress or reward", async () => {
  const current = campaignWithUnlockedMission();
  const result = {
    resultId: "outbreak-persist-failure",
    missionId: MOTHER_MISSION,
    won: true,
    completedAt: "2026-07-27T06:10:00.000Z",
  };
  let calls = 0;
  const failed = await persistOutbreakCampaignSettlement(current, result, {
    persist: async (candidate) => {
      calls += 1;
      assert.equal(verifyCampaignSaveIntegrity(candidate), true);
      return { durable: false };
    },
  });
  assert.equal(calls, 1);
  assert.equal(failed.committed, false);
  assert.equal(failed.save, current);
  assert.equal(failed.candidateSave.outbreaks.processedResultIds.includes(result.resultId), true);
  assert.equal(current.outbreaks.processedResultIds.includes(result.resultId), false);
  assert.equal(current.caps, createDefaultCampaignSave().caps);
});
