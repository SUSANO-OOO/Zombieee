import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMPAIGN_STAGES,
  CAMPAIGN_UNITS,
  CAMPAIGN_SAVE_SCHEMA_VERSION,
  campaignUnitLevelUpgradeQuote,
  computeCampaignSaveIntegrity,
  createDefaultCampaignSave,
  deserializeCampaignSave,
  getCampaignLevelCap,
  getCampaignUnitLevel,
  inspectCampaignSaveCandidate,
  migrateCampaignSave,
  serializeCampaignSave,
  upgradeCampaignUnit,
} from "../app/campaign.js";
import {
  V090_CAPS_MIGRATION_BASE,
  V090_CAPS_MIGRATION_ID,
  V090_STARTER_EQUIPMENT_BUDGET,
  economyAffordabilitySnapshot,
  reorganizeLegacyCaps,
} from "../app/campaignEconomy.js";
import { CONTENT_REGISTRY } from "../app/content/registry.js";
import { UNIT_CARDS } from "../app/gameRules.js";
import {
  beginSurvivalWave,
  completeSurvivalBossEntrance,
  completeSurvivalWave,
  createDefaultSurvivalProgress,
  createSurvivalRun,
  saveSurvivalCheckpoint,
} from "../app/survival.js";
import {
  UNIT_LEVEL_CAP_MILESTONES,
  UNIT_LEVEL_MAX,
  UNIT_LEVEL_MIN,
  UNIT_LEVEL_PUBLIC_CAP,
  applyUnitLevelProgression,
  levelProgressionPowerIndex,
  unitLevelCapForHighestStage,
  unitLevelCost,
  unitLevelMilestones,
  unitLevelUpgradeQuote,
} from "../app/unitProgression.js";

const unitIds = CAMPAIGN_UNITS.map((unit) => unit.id);
const V080_ROLE_PROGRESSION = Object.freeze({
  frontline: { defenseBonus: .03 },
  heavy: { defenseBonus: .03 },
  skirmisher: { speedMultiplier: 1.06 },
  marksman: { damageMultiplier: 1.05 },
  suppression: { attackEveryMultiplier: .95 },
  support: { healingMultiplier: 1.06 },
  engineer: { trapDurationMultiplier: 1.08 },
});

function v080RankGolden(card, rank) {
  const role = V080_ROLE_PROGRESSION[card.aiProfile] ?? V080_ROLE_PROGRESSION.frontline;
  const milestone = rank >= 2;
  const hpMultiplier = 1 + rank * .03;
  const damageMultiplier = hpMultiplier * (milestone ? role.damageMultiplier ?? 1 : 1);
  const speedMultiplier = (1 + rank * .015) * (milestone ? role.speedMultiplier ?? 1 : 1);
  const attackEveryMultiplier = (1 - rank * .02 - (rank >= 4 ? .04 : 0))
    * (milestone ? role.attackEveryMultiplier ?? 1 : 1);
  const defense = rank * .015 + (milestone ? role.defenseBonus ?? 0 : 0);
  return {
    hp: Math.round(card.hp * hpMultiplier),
    damage: Math.round(card.damage * damageMultiplier * 10) / 10,
    speed: Math.round(card.speed * speedMultiplier * 100) / 100,
    laneSpeed: Math.round(card.laneSpeed * speedMultiplier * 100) / 100,
    range: card.range,
    attackEvery: Math.round(card.attackEvery * attackEveryMultiplier * 1000) / 1000,
    defense: Math.round(defense * 10000) / 10000,
    healingMultiplier: milestone ? role.healingMultiplier ?? 1 : 1,
    trapDurationMultiplier: milestone ? role.trapDurationMultiplier ?? 1 : 1,
  };
}

function fullyOwnedSave(extra = {}) {
  return migrateCampaignSave({
    ...createDefaultCampaignSave(),
    ownership: unitIds,
    discovery: unitIds,
    recruitable: [],
    unlockedUnitIds: unitIds,
    caps: 100_000,
    supplies: 100_000,
    ...extra,
  });
}

function stampedSchema9Save(extra = {}) {
  const current = createDefaultCampaignSave();
  const legacy = {
    ...current,
    ...extra,
    schemaVersion: 9,
    integrity: "",
  };
  delete legacy.unitLevels;
  delete legacy.processedMigrationIds;
  delete legacy.migrationNotices;
  legacy.integrity = computeCampaignSaveIntegrity(legacy);
  return legacy;
}

test("Level data spans 1-50 while public Stage 20 progression stops at Level 25", () => {
  assert.equal(UNIT_LEVEL_MIN, 1);
  assert.equal(UNIT_LEVEL_MAX, 50);
  assert.equal(UNIT_LEVEL_PUBLIC_CAP, 25);
  assert.deepEqual(UNIT_LEVEL_CAP_MILESTONES, [
    { clearedStage: 0, levelCap: 5 },
    { clearedStage: 5, levelCap: 10 },
    { clearedStage: 10, levelCap: 15 },
    { clearedStage: 15, levelCap: 20 },
    { clearedStage: 20, levelCap: 25 },
    { clearedStage: 25, levelCap: 30 },
    { clearedStage: 30, levelCap: 35 },
    { clearedStage: 35, levelCap: 40 },
    { clearedStage: 40, levelCap: 45 },
    { clearedStage: 50, levelCap: 50 },
  ]);
  for (const [stage, cap] of [[0, 5], [4, 5], [5, 10], [10, 15], [15, 20], [20, 25], [25, 30], [30, 35], [35, 40], [40, 45], [49, 45], [50, 50], [150, 50]]) {
    assert.equal(unitLevelCapForHighestStage(stage), cap, `Stage ${stage}`);
  }
});

test("schema 9 Rank 0-4 migrates exactly to Level 1-5 and keeps run-start checkpoint Levels", () => {
  const ranks = Object.fromEntries(unitIds.map((unitId, index) => [unitId, index % 5]));
  let run = createSurvivalRun({
    runId: "level-contract-run",
    formation: {
      presetId: "formation-preset-1",
      unitIds: [unitIds[0]],
      unitLevelsByUnit: { [unitIds[0]]: 4 },
      personalEquipmentByUnit: {},
      tacticalEquipmentIds: [],
    },
  });
  for (let wave = 1; wave <= 5; wave += 1) {
    run = beginSurvivalWave(run);
    if (run.bossEntrancePending) run = completeSurvivalBossEntrance(run);
    run = completeSurvivalWave(run, { kills: wave });
  }
  const survival = saveSurvivalCheckpoint(
    createDefaultSurvivalProgress(),
    run,
    "2026-07-26T00:00:00.000Z",
  );
  const legacy = stampedSchema9Save({
    unitRanks: ranks,
    survival: { ...survival, highestWave: 40 },
  });
  const inspected = inspectCampaignSaveCandidate(JSON.stringify(legacy));
  assert.equal(inspected.status, "valid");
  assert.equal(inspected.sourceSchemaVersion, 9);
  assert.equal(inspected.save.schemaVersion, CAMPAIGN_SAVE_SCHEMA_VERSION);
  for (const [unitId, rank] of Object.entries(ranks)) {
    assert.equal(inspected.save.unitLevels[unitId], rank + 1);
  }
  assert.equal(inspected.save.survival.activeCheckpoint.run.formation.unitLevelsByUnit[unitIds[0]], 4);
  assert.equal(getCampaignLevelCap(inspected.save), 5, "Survival wave must not unlock campaign Level cap");
});

test("Level 1-5 preserves every legacy Rank 0-4 combat value", () => {
  for (const card of UNIT_CARDS) {
    for (let rank = 0; rank <= 4; rank += 1) {
      const legacy = v080RankGolden(card, rank);
      const leveled = applyUnitLevelProgression(card, rank + 1);
      for (const field of ["hp", "damage", "speed", "laneSpeed", "range", "attackEvery", "defense", "healingMultiplier", "trapDurationMultiplier"]) {
        assert.equal(leveled[field], legacy[field], `${card.kind} Rank ${rank} ${field}`);
      }
      assert.equal(leveled.progressionLevel, rank + 1);
    }
  }
});

test("Level growth remains monotonic and bounded through Level 50", () => {
  for (const card of UNIT_CARDS) {
    let previous = applyUnitLevelProgression(card, 1);
    for (let level = 2; level <= UNIT_LEVEL_MAX; level += 1) {
      const progressed = applyUnitLevelProgression(card, level);
      assert.ok(progressed.hp >= previous.hp, `${card.kind} hp Lv${level}`);
      assert.ok(progressed.damage >= previous.damage, `${card.kind} damage Lv${level}`);
      assert.ok(progressed.speed >= previous.speed, `${card.kind} speed Lv${level}`);
      assert.ok(progressed.attackEvery <= previous.attackEvery, `${card.kind} cadence Lv${level}`);
      assert.equal(progressed.range, card.range);
      previous = progressed;
    }
    const power = levelProgressionPowerIndex(card, 50);
    assert.ok(power.durability <= 2.25, `${card.kind} durability`);
    assert.ok(power.damagePerSecond <= 2.65, `${card.kind} dps`);
    assert.ok(power.defense <= .22, `${card.kind} defense`);
  }
});

test("Stage clears alone unlock Level caps and transactions stop exactly at the cap", () => {
  let save = fullyOwnedSave({ completedStageIds: [], caps: 100_000, supplies: 100_000 });
  const unitId = unitIds[0];
  assert.equal(getCampaignLevelCap(save), 5);
  for (let level = 2; level <= 5; level += 1) {
    const result = upgradeCampaignUnit(save, { unitId, upgradeId: `level-cap:${unitId}:${level}` });
    assert.equal(result.result.applied, true);
    assert.equal(result.result.nextLevel, level);
    save = result.save;
  }
  const blocked = upgradeCampaignUnit(save, { unitId, upgradeId: `level-cap:${unitId}:6` });
  assert.equal(blocked.result.applied, false);
  assert.equal(blocked.result.reason, "level-cap");
  assert.equal(getCampaignUnitLevel(blocked.save, unitId), 5);

  save = migrateCampaignSave({
    ...save,
    completedStageIds: CAMPAIGN_STAGES.slice(0, 5).map(({ id }) => id),
  });
  assert.equal(getCampaignLevelCap(save), 10);
  assert.equal(campaignUnitLevelUpgradeQuote(save, unitId).nextLevel, 6);
});

test("Level prices preserve Rank 1-4 costs and scale without allowing instant roster completion", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(unitLevelCost), [0, 60, 120, 200, 320]);
  for (let level = 3; level <= UNIT_LEVEL_MAX; level += 1) {
    assert.ok(unitLevelCost(level) >= unitLevelCost(level - 1), `Lv${level}`);
  }
  const fullRosterTo25 = unitIds.length * Array.from({ length: 24 }, (_, index) => unitLevelCost(index + 2))
    .reduce((total, cost) => total + cost, 0);
  const largestMigration = reorganizeLegacyCaps(Number.MAX_SAFE_INTEGER).nextCaps;
  assert.ok(largestMigration < fullRosterTo25);
});

test("late recruits receive a bounded catch-up discount using Level medians", () => {
  const levels = Object.fromEntries(unitIds.map((unitId, index) => [unitId, index === 0 ? 1 : 4]));
  const quote = unitLevelUpgradeQuote({
    unitId: unitIds[0],
    levels,
    ownedUnitIds: unitIds,
    completedStageCount: 3,
    levelCap: 5,
  });
  assert.equal(quote.currentLevel, 1);
  assert.equal(quote.nextLevel, 2);
  assert.equal(quote.baseCostCaps, 60);
  assert.equal(quote.costCaps, 40);
  assert.equal(quote.catchUp, true);
  assert.equal(unitLevelUpgradeQuote({
    unitId: unitIds[0],
    levels,
    ownedUnitIds: unitIds,
    completedStageCount: 2,
    levelCap: 5,
  }).costCaps, 60);
});

test("Level transactions are receipt-idempotent and survive serialize/reload", () => {
  const unitId = unitIds[0];
  const save = fullyOwnedSave({ caps: 60, supplies: 60 });
  const first = upgradeCampaignUnit(save, { unitId, upgradeId: `upgrade:${unitId}:level-2` });
  assert.equal(first.result.applied, true);
  assert.equal(first.save.caps, 0);
  assert.equal(getCampaignUnitLevel(first.save, unitId), 2);

  const retry = upgradeCampaignUnit(first.save, { unitId, upgradeId: `upgrade:${unitId}:level-2` });
  assert.equal(retry.result.applied, false);
  assert.equal(retry.result.alreadyProcessed, true);
  assert.equal(retry.save.caps, 0);

  const restored = deserializeCampaignSave(serializeCampaignSave(first.save));
  assert.equal(getCampaignUnitLevel(restored, unitId), 2);
  assert.deepEqual(restored.processedUpgradeIds, first.save.processedUpgradeIds);
});

test("caps migration is one-time, receipt-backed, visible, and preserves unrelated progress", () => {
  const previousCaps = 987;
  const legacy = stampedSchema9Save({
    campaignStarted: true,
    caps: previousCaps,
    supplies: previousCaps,
    completedStageIds: CAMPAIGN_STAGES.slice(0, 3).map(({ id }) => id),
    bestStarsByStage: { [CAMPAIGN_STAGES[0].id]: 3 },
    readStoryEventIds: ["story-receipt"],
    unitRanks: { [unitIds[0]]: 4 },
  });
  const expected = reorganizeLegacyCaps(previousCaps);
  const migrated = inspectCampaignSaveCandidate(JSON.stringify(legacy)).save;
  assert.equal(migrated.revision, legacy.revision + 1);
  assert.ok(Date.parse(migrated.updatedAt) > Date.parse(legacy.updatedAt || "1970-01-01T00:00:00.000Z"));
  assert.equal(migrated.caps, expected.nextCaps);
  assert.equal(migrated.supplies, expected.nextCaps);
  assert.deepEqual(migrated.processedMigrationIds, [V090_CAPS_MIGRATION_ID]);
  assert.equal(migrated.migrationNotices.length, 1);
  assert.equal(migrated.migrationNotices[0].previousCaps, previousCaps);
  assert.equal(migrated.migrationNotices[0].nextCaps, expected.nextCaps);
  assert.equal(migrated.bestStarsByStage[CAMPAIGN_STAGES[0].id], 3);
  assert.deepEqual(migrated.readStoryEventIds, ["story-receipt"]);
  assert.equal(migrated.unitLevels[unitIds[0]], 5);

  const reloaded = deserializeCampaignSave(serializeCampaignSave(migrated));
  assert.equal(reloaded.caps, expected.nextCaps);
  assert.deepEqual(reloaded.processedMigrationIds, [V090_CAPS_MIGRATION_ID]);
  assert.equal(migrateCampaignSave(reloaded).caps, expected.nextCaps);
});

test("migration starting funds cover starter equipment and multiple early Level ups but not all upgrades", () => {
  const zeroLegacy = reorganizeLegacyCaps(0);
  assert.equal(zeroLegacy.nextCaps, V090_CAPS_MIGRATION_BASE);
  const affordability = economyAffordabilitySnapshot({
    startingCaps: zeroLegacy.nextCaps,
    levelCosts: [unitLevelCost(2), unitLevelCost(3), unitLevelCost(4), unitLevelCost(5)],
    starterEquipmentCost: V090_STARTER_EQUIPMENT_BUDGET,
  });
  assert.ok(affordability.affordableLevelUps >= 3);
  assert.ok(affordability.affordableLevelUps < 4);
  assert.ok(affordability.remainingCaps >= 0);
});

test("all stable unit IDs remain registry-backed and Level milestone labels are deterministic", () => {
  assert.equal(CONTENT_REGISTRY.upgrades.length, 15);
  assert.deepEqual(CONTENT_REGISTRY.upgrades.map(({ unitId }) => unitId), unitIds);
  assert.deepEqual(unitLevelMilestones("heavy", 1), []);
  assert.deepEqual(unitLevelMilestones("heavy", 3), ["重装装甲"]);
  assert.deepEqual(unitLevelMilestones("heavy", 5), ["重装装甲", "実戦連携"]);
  assert.deepEqual(unitLevelMilestones("heavy", 20), ["重装装甲", "実戦連携", "熟練戦技 I", "熟練戦技 II"]);
});
