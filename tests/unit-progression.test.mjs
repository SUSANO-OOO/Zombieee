import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMPAIGN_STAGES,
  CAMPAIGN_UNITS,
  applyStageResult,
  campaignUnitUpgradeQuote,
  createDefaultCampaignSave,
  getCampaignUnitRank,
  migrateCampaignSave,
  deserializeCampaignSave,
  serializeCampaignSave,
  upgradeCampaignUnit,
} from "../app/campaign.js";
import { CONTENT_REGISTRY } from "../app/content/registry.js";
import { UNIT_CARDS } from "../app/gameRules.js";
import {
  UNIT_PROGRESSION_MAX_RANK,
  UNIT_PROGRESSION_RANKS,
  applyUnitProgression,
  damageAfterUnitDefense,
  progressionPowerIndex,
  unitProgressionMilestones,
  unitUpgradeQuote,
} from "../app/unitProgression.js";

const unitIds = CAMPAIGN_UNITS.map((unit) => unit.id);

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

test("all eleven stable unit IDs expose four paid ranks and registry records", () => {
  assert.equal(UNIT_PROGRESSION_MAX_RANK, 4);
  assert.deepEqual(UNIT_PROGRESSION_RANKS.map(({ costCaps }) => costCaps), [0, 60, 120, 200, 320]);
  assert.equal(CONTENT_REGISTRY.upgrades.length, 11);
  assert.deepEqual(CONTENT_REGISTRY.upgrades.map(({ unitId }) => unitId), unitIds);

  let save = fullyOwnedSave();
  for (const unitId of unitIds) {
    for (let rank = 1; rank <= UNIT_PROGRESSION_MAX_RANK; rank += 1) {
      const upgraded = upgradeCampaignUnit(save, {
        unitId,
        upgradeId: `test:${unitId}:rank-${rank}`,
      });
      assert.equal(upgraded.result.applied, true, `${unitId} rank ${rank}`);
      assert.equal(upgraded.result.nextRank, rank);
      save = upgraded.save;
    }
    assert.equal(getCampaignUnitRank(save, unitId), UNIT_PROGRESSION_MAX_RANK);
  }
  assert.equal(save.caps, 100_000 - unitIds.length * 700);
});

test("every rank raises combat stats while maximum growth preserves formation value", () => {
  for (const card of UNIT_CARDS) {
    let previous = applyUnitProgression(card, 0);
    for (let rank = 1; rank <= UNIT_PROGRESSION_MAX_RANK; rank += 1) {
      const progressed = applyUnitProgression(card, rank);
      assert.ok(progressed.hp >= previous.hp, `${card.kind} hp rank ${rank}`);
      assert.ok(progressed.damage >= previous.damage, `${card.kind} damage rank ${rank}`);
      assert.ok(progressed.speed >= previous.speed, `${card.kind} speed rank ${rank}`);
      assert.ok(progressed.laneSpeed >= previous.laneSpeed, `${card.kind} lane speed rank ${rank}`);
      assert.equal(progressed.range, card.range, `${card.kind} range stays role-locked at rank ${rank}`);
      assert.ok(progressed.attackEvery <= previous.attackEvery, `${card.kind} cadence rank ${rank}`);
      assert.ok(progressed.defense > previous.defense, `${card.kind} defense rank ${rank}`);
      previous = progressed;
    }
    const maximum = applyUnitProgression(card, UNIT_PROGRESSION_MAX_RANK);
    const power = progressionPowerIndex(card, UNIT_PROGRESSION_MAX_RANK);
    assert.ok(maximum.hp > card.hp);
    assert.ok(maximum.damage > card.damage);
    assert.ok(maximum.speed > card.speed);
    assert.equal(maximum.range, card.range);
    assert.ok(maximum.attackEvery < card.attackEvery);
    assert.ok(power.durability <= 1.24, `${card.kind} durability cap`);
    assert.ok(power.damagePerSecond <= 1.35, `${card.kind} dps cap`);
    assert.ok(power.defense >= .06 && power.defense <= .09, `${card.kind} defense cap`);
  }
});

test("rank two and four add role milestones on top of base stat growth", () => {
  assert.deepEqual(unitProgressionMilestones("heavy", 1), []);
  assert.deepEqual(unitProgressionMilestones("heavy", 2), ["重装装甲"]);
  assert.deepEqual(unitProgressionMilestones("heavy", 4), ["重装装甲", "実戦連携"]);
  assert.deepEqual(unitProgressionMilestones("marksman", 2), ["精密火力"]);
  assert.deepEqual(unitProgressionMilestones("engineer", 2), ["拘束強化"]);

  const heavy = applyUnitProgression(UNIT_CARDS.find(({ aiProfile }) => aiProfile === "heavy"), 2);
  const marksman = applyUnitProgression(UNIT_CARDS.find(({ aiProfile }) => aiProfile === "marksman"), 2);
  const support = applyUnitProgression(UNIT_CARDS.find(({ aiProfile }) => aiProfile === "support"), 2);
  const engineer = applyUnitProgression(UNIT_CARDS.find(({ aiProfile }) => aiProfile === "engineer"), 2);
  assert.equal(heavy.defense, .06);
  assert.equal(marksman.damage > UNIT_CARDS.find(({ aiProfile }) => aiProfile === "marksman").damage * 1.06, true);
  assert.equal(support.healingMultiplier, 1.06);
  assert.equal(engineer.trapDurationMultiplier, 1.08);
});

test("percentage defense reduces every hit without flattening low-damage attacks", () => {
  assert.deepEqual(damageAfterUnitDefense(100, .06), {
    damage: 94,
    prevented: 6,
    reduction: .06,
  });
  assert.equal(damageAfterUnitDefense(2, .09).damage, 1.82);
  assert.equal(damageAfterUnitDefense(-4, .5).damage, 0);
  assert.equal(damageAfterUnitDefense(100, 9).reduction, .75);
});

test("late recruits receive a bounded catch-up discount below the owned-roster median", () => {
  const ranks = Object.fromEntries(unitIds.map((unitId, index) => [unitId, index === 0 ? 0 : 3]));
  const quote = unitUpgradeQuote({
    unitId: unitIds[0],
    ranks,
    ownedUnitIds: unitIds,
    completedStageCount: 3,
  });
  assert.deepEqual(quote, {
    currentRank: 0,
    nextRank: 1,
    baseCostCaps: 60,
    discountCaps: 20,
    costCaps: 40,
    catchUp: true,
  });
  assert.equal(unitUpgradeQuote({
    unitId: unitIds[0],
    ranks,
    ownedUnitIds: unitIds,
    completedStageCount: 2,
  }).costCaps, 60);

  let save = fullyOwnedSave({
    completedStageIds: CAMPAIGN_STAGES.slice(0, 3).map((stage) => stage.id),
    unitRanks: ranks,
    caps: 600,
    supplies: 600,
  });
  for (let rank = 1; rank <= UNIT_PROGRESSION_MAX_RANK; rank += 1) {
    save = upgradeCampaignUnit(save, {
      unitId: unitIds[0],
      upgradeId: `catch-up:${unitIds[0]}:${rank}`,
    }).save;
  }
  assert.equal(getCampaignUnitRank(save, unitIds[0]), UNIT_PROGRESSION_MAX_RANK);
  assert.ok(save.caps >= 0);
  assert.ok(save.caps > 600 - 700);
});

test("upgrade transactions are idempotent and reject invalid spend paths", () => {
  const unitId = unitIds[0];
  const receipt = `upgrade:${unitId}:rank-1`;
  const save = fullyOwnedSave({ caps: 60, supplies: 60 });
  const first = upgradeCampaignUnit(save, { unitId, upgradeId: receipt });
  assert.equal(first.result.applied, true);
  assert.equal(first.save.caps, 0);
  assert.equal(first.result.spentCaps, 60);

  const retry = upgradeCampaignUnit(first.save, { unitId, upgradeId: receipt });
  assert.equal(retry.result.applied, false);
  assert.equal(retry.result.alreadyProcessed, true);
  assert.equal(retry.save.caps, 0);
  assert.equal(getCampaignUnitRank(retry.save, unitId), 1);

  const underfunded = upgradeCampaignUnit(first.save, {
    unitId,
    upgradeId: `upgrade:${unitId}:rank-2`,
  });
  assert.equal(underfunded.result.reason, "insufficient-caps");
  assert.equal(underfunded.save.processedUpgradeIds.includes(`upgrade:${unitId}:rank-2`), false);

  const notOwnedId = unitIds.at(-1);
  const notOwned = upgradeCampaignUnit(createDefaultCampaignSave(), {
    unitId: notOwnedId,
    upgradeId: `upgrade:${notOwnedId}:rank-1`,
  });
  assert.equal(notOwned.result.reason, "not-owned");

  const maximum = fullyOwnedSave({
    unitRanks: Object.fromEntries(unitIds.map((id) => [id, UNIT_PROGRESSION_MAX_RANK])),
  });
  assert.equal(upgradeCampaignUnit(maximum, {
    unitId,
    upgradeId: `upgrade:${unitId}:rank-5`,
  }).result.reason, "max-rank");
});

test("schema 5 and alias-keyed ranks migrate through the current schema without data loss", () => {
  const legacy = {
    ...createDefaultCampaignSave(),
    schemaVersion: 5,
    integrity: "",
    processedUpgradeIds: ["legacy-upgrade"],
    unitRanks: { brawler: 2, gunner: 3, brute: 99, unknown: 4 },
  };
  const migrated = migrateCampaignSave(legacy);
  assert.equal(migrated.schemaVersion, 7);
  assert.deepEqual(migrated.processedUpgradeIds, ["legacy-upgrade"]);
  assert.equal(getCampaignUnitRank(migrated, "brawler"), 2);
  assert.equal(getCampaignUnitRank(migrated, "gunner"), 3);
  assert.equal(getCampaignUnitRank(migrated, "brute"), UNIT_PROGRESSION_MAX_RANK);
  assert.equal(Object.hasOwn(migrated.unitRanks, "unknown"), false);
  assert.deepEqual(migrateCampaignSave(migrated), migrated);
});

test("nonzero stable ranks and processed upgrade receipts survive serialize and reload", () => {
  const save = fullyOwnedSave({
    unitRanks: Object.fromEntries(unitIds.map((unitId, index) => [unitId, index % 5])),
    processedUpgradeIds: ["upgrade:unit-paisen:rank-1", "upgrade:unit-raider:rank-2"],
  });
  const restored = deserializeCampaignSave(serializeCampaignSave(save));
  assert.deepEqual(restored.unitRanks, save.unitRanks);
  assert.deepEqual(restored.processedUpgradeIds, save.processedUpgradeIds);
  assert.deepEqual(deserializeCampaignSave(serializeCampaignSave(restored)), restored);
});

test("caps spending cannot lock stage progression and unupgraded play remains valid", () => {
  let save = createDefaultCampaignSave();
  for (let index = 0; index < CAMPAIGN_STAGES.length; index += 1) {
    const stage = CAMPAIGN_STAGES[index];
    assert.equal(save.unlockedStageIds.includes(stage.id), true, `${stage.id} must be reachable`);
    save = applyStageResult(save, {
      stageId: stage.id,
      resultId: `no-upgrade-clear:${stage.id}`,
      won: true,
      baseHp: stage.baseHp * .5,
      baseMaxHp: stage.baseHp,
    });
    save = migrateCampaignSave({ ...save, caps: 0, supplies: 0 });
    assert.equal(Object.values(save.unitRanks).every((rank) => rank === 0), true);
  }
  assert.equal(save.completedStageIds.length, CAMPAIGN_STAGES.length);
});

test("campaign quote uses ownership, completion, and stable unit IDs", () => {
  const save = fullyOwnedSave({
    completedStageIds: CAMPAIGN_STAGES.slice(0, 3).map((stage) => stage.id),
    unitRanks: Object.fromEntries(unitIds.map((unitId, index) => [unitId, index === 0 ? 0 : 2])),
  });
  const quote = campaignUnitUpgradeQuote(save, unitIds[0]);
  assert.equal(quote.catchUp, true);
  assert.equal(quote.currentRank, 0);
  assert.equal(quote.nextRank, 1);
});
