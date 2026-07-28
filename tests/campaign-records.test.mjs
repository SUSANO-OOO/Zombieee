import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMPAIGN_RECORDS_SCHEMA_VERSION,
  createDefaultCampaignRecords,
  normalizeCampaignRecords,
  recordCampaignOperation,
} from "../app/campaignRecords.js";

test("campaign records normalize hostile input into a bounded schema", () => {
  const normalized = normalizeCampaignRecords({
    schemaVersion: 99,
    processedRecordIds: ["result-a", "result-a", "", "__proto__"],
    encountersByEnemy: {
      walker: {
        firstOperationId: "stage-1",
        firstEncounteredAt: "2026-07-27T01:02:03.000Z",
        encounterCount: 3.8,
      },
      invalid: { encounterCount: 2 },
    },
    defeatCountsByEnemy: { walker: 7.9, negative: -4 },
    totals: { battles: 4.2, kills: Number.POSITIVE_INFINITY },
    recentResults: [{ resultId: "result-a", operationId: "stage-1", outcome: "won" }],
  });

  assert.equal(normalized.schemaVersion, CAMPAIGN_RECORDS_SCHEMA_VERSION);
  assert.deepEqual(normalized.processedRecordIds, ["result-a"]);
  assert.equal(normalized.encountersByEnemy.walker.encounterCount, 3);
  assert.equal(normalized.encountersByEnemy.invalid, undefined);
  assert.deepEqual(normalized.defeatCountsByEnemy, { walker: 7 });
  assert.equal(normalized.totals.battles, 4);
  assert.equal(normalized.totals.kills, 0);
  assert.equal(normalized.lastResult.resultId, "result-a");
});

test("recording an operation is deterministic, additive, and receipt-idempotent", () => {
  const input = {
    resultId: "record-stage-17",
    operationId: "stage-17",
    category: "campaign",
    outcome: "won",
    battleSeconds: 124.8,
    kills: 9,
    bossKills: 1,
    unitsLost: 2,
    capsEarned: 320,
    encounteredEnemyKinds: ["walker", "walker", "carrier"],
    enemyDefeatsByKind: { walker: 7, carrier: 2 },
    unitStats: {
      damageByUnit: { hachi: 920, nao: 30 },
      damageTakenByUnit: { hachi: 140 },
      healingByUnit: { nao: 280 },
    },
    completedAt: "2026-07-27T02:03:04.000Z",
  };
  const first = recordCampaignOperation(createDefaultCampaignRecords(), input);
  const repeated = recordCampaignOperation(first, input);

  assert.deepEqual(repeated, first);
  assert.deepEqual(first.processedRecordIds, ["record-stage-17"]);
  assert.equal(first.totals.battles, 1);
  assert.equal(first.totals.victories, 1);
  assert.equal(first.totals.battleSeconds, 124);
  assert.equal(first.totals.kills, 9);
  assert.deepEqual(first.defeatCountsByEnemy, { carrier: 2, walker: 7 });
  assert.deepEqual(Object.keys(first.encountersByEnemy), ["carrier", "walker"]);
  assert.equal(first.encountersByEnemy.walker.firstOperationId, "stage-17");
  assert.equal(first.encountersByEnemy.walker.encounterCount, 1);
  assert.equal(first.unitStats.damageByUnit.hachi, 920);
  assert.equal(first.unitStats.healingByUnit.nao, 280);

  const second = recordCampaignOperation(first, {
    ...input,
    resultId: "record-stage-17-replay",
    outcome: "lost",
    encounteredEnemyKinds: ["walker"],
    enemyDefeatsByKind: { walker: 1 },
    unitStats: { damageByUnit: { hachi: 80 } },
  });
  assert.equal(second.totals.battles, 2);
  assert.equal(second.totals.defeats, 1);
  assert.equal(second.encountersByEnemy.walker.encounterCount, 2);
  assert.equal(second.defeatCountsByEnemy.walker, 8);
  assert.equal(second.unitStats.damageByUnit.hachi, 1_000);
});

test("records keep only the latest twenty-four operation summaries without losing totals", () => {
  let records = createDefaultCampaignRecords();
  for (let index = 0; index < 30; index += 1) {
    records = recordCampaignOperation(records, {
      resultId: `result-${index}`,
      operationId: `operation-${index}`,
      won: true,
      kills: 1,
    });
  }
  assert.equal(records.totals.battles, 30);
  assert.equal(records.totals.kills, 30);
  assert.equal(records.recentResults.length, 24);
  assert.equal(records.recentResults[0].resultId, "result-6");
  assert.equal(records.lastResult.resultId, "result-29");
});
