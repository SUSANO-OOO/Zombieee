import test from "node:test";
import assert from "node:assert/strict";

import {
  V100_BOSSES,
  V100_CAMPAIGN_GENERATION,
  V100_CAMPAIGN_NAMESPACE,
  V100_EVENT_IDS,
  V100_INITIAL_UNIT_IDS,
  V100_LEVEL_COSTS,
  V100_LEGACY_GIFT,
  V100_STAGE_BY_ID,
  V100_STAGE_IDS,
  V100_STAGE_REWARD_TOTAL,
  V100_SUPPORTS,
  V100_UNITS,
  V100_VEHICLE,
  normalizeV100PlayerName,
  renderV100PlayerName,
  v100LevelCapForStage,
  v100StageReward,
  v100StarsForVehicle,
} from "../app/v100Registry.js";
import {
  claimV100LegacyGift,
  createDefaultV100Save,
  createV100SaveFromLegacy,
  isEligibleV100LegacyHistory,
  acknowledgeV100LegacyGiftPopup,
  normalizeV100Save,
  serializeV100Save,
  deserializeV100Save,
  updateV100PlayerName,
} from "../app/v100Save.js";
import {
  createV100BattleResult,
  createV100BattleState,
  finalizeV100PendingResult,
  purchaseV100Support,
  purchaseV100Unit,
  recordV100PendingResult,
  reserveV100FormationSlot,
  v100BossVisibleInOtherModes,
} from "../app/v100Transactions.js";
import { v100LevelQuote, v100LevelStats } from "../app/v100Progression.js";

test("V1.0.0 registry is one closed 30-stage contract", () => {
  assert.equal(V100_STAGE_IDS.length, 30);
  assert.equal(new Set(V100_STAGE_IDS).size, 30);
  assert.equal(V100_EVENT_IDS.length, 1 + 30 * 3 + 3);
  assert.equal(V100_STAGE_REWARD_TOTAL, 9000);
  assert.equal(v100StageReward(1, "first-clear"), 90);
  assert.equal(v100StageReward(30, "first-clear"), 380);
  assert.equal(v100StageReward(1, "replay"), 20);
  assert.equal(v100StageReward(30, "replay"), 75);
  assert.equal(v100StarsForVehicle({ won: true, vehicleHp: 612, vehicleMaxHp: 680 }), 3);
  assert.equal(V100_STAGE_BY_ID[V100_STAGE_IDS[29]].eventIds.firstClearPost, "v100:event:s30:first-clear-post");
  assert.equal(V100_STAGE_BY_ID[V100_STAGE_IDS[28]].firstClearPayload.includes("omega-post-story-only"), true);
});

test("V1.0.0 unit, level, vehicle, support, and boss values are fixed", () => {
  assert.deepEqual(V100_INITIAL_UNIT_IDS, ["unit-hachi", "unit-paisen", "unit-kumaverson", "unit-babayaga"]);
  assert.equal(V100_UNITS.length, 16);
  assert.deepEqual(V100_LEVEL_COSTS, [10, 12, 14, 16, 18, 20, 22, 24, 26, 30, 34, 38, 42, 46, 52, 58, 64, 70, 76, 84, 92, 100, 108, 116, 126, 138, 150, 162, 174]);
  assert.deepEqual([0, 5, 10, 15, 20, 25].map(v100LevelCapForStage), [5, 10, 15, 20, 25, 30]);
  assert.equal(v100LevelStats({ hp: 100, damage: 50, healing: 40, cooldown: 2 }, 5).hp, 110);
  assert.equal(v100LevelStats({ hp: 100, damage: 50, healing: 40, cooldown: 2 }, 5).damage, 54);
  assert.equal(v100LevelStats({ hp: 100, damage: 50, healing: 40, cooldown: 2 }, 5).cooldown, 2);
  assert.equal(V100_VEHICLE.baseHp, 680);
  assert.equal(V100_VEHICLE.baseHp + V100_VEHICLE.hpPerUpgrade * 5, 1080);
  assert.deepEqual(V100_SUPPORTS.map((support) => support.unlockStageNumber), [2, 6, 9]);
  assert.deepEqual(V100_BOSSES.map((boss) => boss.id), [
    "boss-takuya", "boss-gate-eater", "boss-mother", "boss-ooguchi", "boss-kurome",
    "boss-gairen", "boss-futago", "boss-mugarian-president-mutated", "boss-takuya-omega",
  ]);
});

test("fresh V1.0.0 save is isolated from the legacy namespace", () => {
  const save = createDefaultV100Save();
  assert.equal(save.namespace, V100_CAMPAIGN_NAMESPACE);
  assert.equal(save.campaignGeneration, V100_CAMPAIGN_GENERATION);
  assert.equal(save.caps, 0);
  assert.deepEqual(save.ownedUnitIds, V100_INITIAL_UNIT_IDS);
  assert.deepEqual(save.completedStageIds, []);
  assert.deepEqual(save.receipts, []);
  assert.equal(save.legacy.eligible, false);
  assert.equal(save.vehicle.maxHp, 680);
  assert.equal(save.formationSlots.filter(Boolean).length, 4);
});

test("legacy eligibility copies only settings and grants one receipt-backed 180 CAPS gift", () => {
  const legacyRaw = JSON.stringify({
    namespace: "nishijin-campaign-v1",
    campaignStarted: true,
    caps: 9999,
    ownedUnitIds: ["unit-tatara"],
    completedStageIds: ["stage-old"],
    settings: { bgmEnabled: false, sfxVolume: 0.25, unrelated: "drop" },
  });
  assert.equal(isEligibleV100LegacyHistory(legacyRaw), true);
  const save = createV100SaveFromLegacy({ legacyCandidate: legacyRaw });
  assert.equal(save.caps, 0);
  assert.deepEqual(save.ownedUnitIds, V100_INITIAL_UNIT_IDS);
  assert.equal(save.settings.bgmEnabled, false);
  assert.equal(save.settings.sfxVolume, 0.25);
  assert.equal(save.settings.unrelated, undefined);
  const gifted = claimV100LegacyGift(save, { legacyCandidate: legacyRaw });
  assert.equal(gifted.applied, true);
  assert.equal(gifted.save.caps, 180);
  assert.equal(gifted.save.receipts.includes(V100_LEGACY_GIFT.entitlementReceipt), true);
  assert.equal(claimV100LegacyGift(gifted.save, { legacyCandidate: legacyRaw }).duplicate, true);
  assert.equal(acknowledgeV100LegacyGiftPopup(gifted.save, { screen: "battle" }).reason, "unsafe-screen");
  const popup = acknowledgeV100LegacyGiftPopup(gifted.save, { screen: "map" });
  assert.equal(popup.applied, true);
  assert.equal(popup.save.receipts.includes(V100_LEGACY_GIFT.popupReceipt), true);
});

test("name contract normalizes, rejects unsafe text, and escapes render-time token", () => {
  assert.equal(normalizeV100PlayerName("　Ａ　Ｂ　").value, "Ａ Ｂ");
  assert.equal(normalizeV100PlayerName("a\u200Bb").ok, false);
  assert.equal(normalizeV100PlayerName("abcdefghijklmnop").reason, "too-long");
  assert.equal(renderV100PlayerName("Hello {{PLAYER_NAME}}", "<司令>").includes("&lt;司令&gt;"), true);
  const save = createDefaultV100Save({ playerName: "旧名" });
  const renamed = updateV100PlayerName(save, "新名");
  assert.equal(renamed.applied, true);
  assert.deepEqual(renamed.save.receipts, []);
});

test("formation reservation is atomic, allows duplicate IDs, and rejects slot eight", () => {
  let save = createDefaultV100Save();
  let state = createV100BattleState({ resource: 100 });
  for (let index = 0; index < 7; index += 1) {
    const result = reserveV100FormationSlot(save, state, { unitId: "unit-hachi", cost: 1, reservationId: `run:${index}`, now: index });
    assert.equal(result.accepted, true);
    state = result.battleState;
  }
  const rejected = reserveV100FormationSlot(save, state, { unitId: "unit-hachi", cost: 50, reservationId: "run:8", now: 8 });
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reason, "formation-full");
  assert.equal(rejected.battleState.resource, 93);
  assert.equal(rejected.battleState.receipts.includes("run:8"), false);
});

test("stage finalize applies first clear payloads and exact boss mode gates once", () => {
  let save = createDefaultV100Save();
  const result = {
    stageId: "stage-nishijin-defense-line-takuya",
    stageNumber: 3,
    battleRunId: "run-s03",
    won: true,
    objectiveComplete: true,
    bossDefeated: true,
    vehicleHp: 680,
    vehicleMaxHp: 680,
    stars: 3,
  };
  save = recordV100PendingResult(save, result).save;
  // The stage is linear; make Stage 2 available as a minimal fixture without
  // granting its rewards, then finalize Stage 2 and Stage 3 in order.
  save = normalizeV100Save({ ...save, availableStageIds: ["stage-nishijin-shopping-street", "stage-sawara-ward-office", "stage-nishijin-defense-line-takuya"] });
  save = finalizeV100PendingResult(save).save;
  assert.equal(save.bosses.discoveredIds.includes("boss-takuya"), true);
  assert.equal(v100BossVisibleInOtherModes(save, "boss-takuya"), true);
  assert.equal(v100BossVisibleInOtherModes(save, "boss-gate-eater"), false);
  assert.equal(save.caps, 150);
});

test("boss battle results cannot bypass the explicit defeat presentation", () => {
  const blocked = createV100BattleResult({
    stageId: "stage-nishijin-defense-line-takuya",
    battleRunId: "run-boss-blocked",
    won: true,
    objectiveComplete: true,
    vehicleHp: 680,
    vehicleMaxHp: 680,
  });
  assert.deepEqual(blocked, { ok: false, reason: "boss-not-defeated" });
  const accepted = createV100BattleResult({
    stageId: "stage-nishijin-defense-line-takuya",
    battleRunId: "run-boss-accepted",
    won: true,
    objectiveComplete: true,
    bossDefeated: true,
    vehicleHp: 680,
    vehicleMaxHp: 680,
  });
  assert.equal(accepted.won, true);
});

test("registered units and supports are purchased separately from unlock registration", () => {
  let save = createDefaultV100Save({});
  save = normalizeV100Save({ ...save, registeredUnitIds: [...save.registeredUnitIds, "unit-nao"], supportPurchaseUnlockedIds: ["support-healing"], caps: 200 });
  const unit = purchaseV100Unit(save, "unit-nao");
  assert.equal(unit.applied, true);
  const support = purchaseV100Support(unit.save, "support-healing");
  assert.equal(support.applied, true);
  assert.equal(support.save.ownedUnitIds.includes("unit-nao"), true);
  assert.equal(support.save.ownedSupportIds.includes("support-healing"), true);
  assert.equal(support.save.caps, 70);
  assert.equal(v100LevelQuote({ levels: support.save.unitLevels, unitId: "unit-nao", clearedStageNumber: 0, caps: 70 }).costCaps, 10);
});

test("save round trip retains only V1 state and rejects the wrong namespace", () => {
  const save = createDefaultV100Save({ playerName: "指揮官" });
  const roundTrip = deserializeV100Save(serializeV100Save(save));
  assert.equal(roundTrip.ok, true);
  assert.deepEqual(roundTrip.save, normalizeV100Save(save));
  assert.equal(normalizeV100Save({ namespace: "nishijin-campaign-v1" }).namespace, V100_CAMPAIGN_NAMESPACE);
});
