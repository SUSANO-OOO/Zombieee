import {
  CAMPAIGN_RECRUITMENT_COSTS,
  CAMPAIGN_SAVE_SCHEMA_VERSION,
  CAMPAIGN_STAGE_IDS,
  CAMPAIGN_STAGES,
  CAMPAIGN_UNIT_IDS,
  campaignUnitUpgradeQuote,
  createDefaultCampaignSave,
  migrateCampaignSave,
  recruitCampaignUnit,
  resolveStageResult,
  upgradeCampaignUnit,
} from "../campaign.js";
import {
  STAGE_BALANCE_REFERENCE_FORMATIONS,
  simulateStageBalance,
} from "../stageBalanceSimulation.js";
import { deepFreeze } from "./freeze.js";

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function runBalanceAudit() {
  const results = CAMPAIGN_STAGES.map((stage) => {
    const options = {
      stageId: stage.id,
      formation: STAGE_BALANCE_REFERENCE_FORMATIONS[stage.id],
      seed: `content-pipeline:${stage.id}`,
    };
    const first = simulateStageBalance(options);
    const second = simulateStageBalance(options);
    return {
      stageId: stage.id,
      outcome: first.outcome,
      baseHp: first.baseHp,
      waveCount: first.waves.scheduled,
      spawnedWaveCount: first.waves.spawned,
      deterministic: jsonEqual(first, second),
      commandNeverNegative: first.command.deployments.every(({ commandAfter }) => commandAfter >= 0),
    };
  });
  return deepFreeze({
    ok: results.every((result) => (
      result.outcome === "won"
      && result.baseHp > 0
      && result.waveCount === result.spawnedWaveCount
      && result.deterministic
      && result.commandNeverNegative
    )),
    results,
  });
}

export function runCapsEconomyAudit() {
  const recruitmentSequence = [
    {
      stageId: CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET,
      unitId: CAMPAIGN_UNIT_IDS.TATARA,
    },
    {
      stageId: CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE,
      unitId: CAMPAIGN_UNIT_IDS.RAIDER,
    },
  ];
  let save = createDefaultCampaignSave();
  const steps = [];
  for (const [index, { stageId, unitId }] of recruitmentSequence.entries()) {
    const stage = CAMPAIGN_STAGES.find(({ id }) => id === stageId);
    const resolved = resolveStageResult(save, {
      stageId,
      resultId: `content-pipeline:economy:${index + 1}`,
      won: true,
      baseHp: stage.baseHp,
      baseMaxHp: stage.baseHp,
    });
    const cost = CAMPAIGN_RECRUITMENT_COSTS[unitId];
    const beforeRecruitment = resolved.save.caps;
    const recruited = recruitCampaignUnit(resolved.save, unitId, {
      acquisitionId: `content-pipeline:recruit:${unitId}`,
    });
    const upgradeQuote = campaignUnitUpgradeQuote(recruited.save, unitId);
    const upgraded = upgradeCampaignUnit(recruited.save, unitId, {
      upgradeId: `content-pipeline:upgrade:${unitId}:rank-${upgradeQuote.nextRank}`,
    });
    steps.push({
      stageId,
      earnedCaps: resolved.result.totalReward,
      unitId,
      cost,
      capsBeforeRecruitment: beforeRecruitment,
      capsAfterRecruitment: recruited.save.caps,
      recruitApplied: recruited.result.applied,
      affordable: beforeRecruitment >= cost,
      upgradeCost: upgradeQuote.costCaps,
      capsAfterUpgrade: upgraded.save.caps,
      upgradeApplied: upgraded.result.applied,
      neverNegative: upgraded.save.caps >= 0,
    });
    save = upgraded.save;
  }
  return deepFreeze({
    ok: steps.every((step) => (
      step.recruitApplied
      && step.affordable
      && step.upgradeApplied
      && step.neverNegative
    )),
    steps,
    finalCaps: save.caps,
  });
}

function migrationFixtures() {
  const firstStage = CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET;
  return [
    {
      label: "schema-less",
      source: {
        clearedStages: [firstStage],
        stageStars: { [firstStage]: 2 },
        currency: 111,
      },
    },
    ...[1, 2, 3, 4, 5, 6].map((schemaVersion) => ({
      label: `schema-v${schemaVersion}`,
      source: {
        schemaVersion,
        campaignStarted: true,
        completedStageIds: [firstStage],
        bestStarsByStage: { [firstStage]: 2 },
        claimedStarRewardsByStage: { [firstStage]: [1, 2] },
        caps: 100 + schemaVersion,
        supplies: 100 + schemaVersion,
        processedResultIds: [`fixture-result-v${schemaVersion}`],
        unlockedStageIds: [firstStage],
      },
    })),
  ];
}

export function runSaveMigrationAudit() {
  const results = migrationFixtures().map(({ label, source }) => {
    const migrated = migrateCampaignSave(source);
    const rerun = migrateCampaignSave(migrated);
    const firstStage = CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET;
    return {
      label,
      schemaVersion: migrated.schemaVersion,
      progressPreserved: migrated.completedStageIds.includes(firstStage)
        && migrated.bestStarsByStage[firstStage] >= 2,
      currencyPreserved: migrated.caps >= Number(source.caps ?? source.supplies ?? source.currency ?? 0),
      idempotent: jsonEqual(migrated, rerun),
    };
  });
  return deepFreeze({
    ok: results.every((result) => (
      result.schemaVersion === CAMPAIGN_SAVE_SCHEMA_VERSION
      && result.progressPreserved
      && result.currencyPreserved
      && result.idempotent
    )),
    results,
  });
}

export function runContentPipelineAudits() {
  const balance = runBalanceAudit();
  const capsEconomy = runCapsEconomyAudit();
  const saveMigration = runSaveMigrationAudit();
  return deepFreeze({
    ok: balance.ok && capsEconomy.ok && saveMigration.ok,
    balance,
    capsEconomy,
    saveMigration,
  });
}
