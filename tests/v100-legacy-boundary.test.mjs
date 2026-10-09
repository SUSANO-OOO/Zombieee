import test from "node:test";
import assert from "node:assert/strict";
import { INITIAL_STAGE_ID, createDefaultCampaignSave, serializeCampaignSave, computeCampaignSaveIntegrity, inspectCampaignSaveCandidate } from "../app/campaign.js";
import { createCampaignManualExport } from "../app/campaignStorage.js";
import { V100_DEFAULT_SETTINGS, copyV100LegacySettings, createDefaultV100Save, createV100SaveFromLegacy, isEligibleV100LegacyHistory, normalizeV100Save } from "../app/v100Save.js";
import { V100_INITIAL_UNIT_IDS, V100_LEGACY_SETTINGS_WHITELIST } from "../app/v100Registry.js";

function signedLegacy(changes = {}) {
  const value = { ...createDefaultCampaignSave(), ...changes };
  const serialized = JSON.stringify({ ...value, integrity: computeCampaignSaveIntegrity(value) });
  assert.equal(inspectCampaignSaveCandidate(serialized).status, "valid", "Use a real integrity-valid legacy shape");
  return serialized;
}

test("only validated actual play establishes legacy eligibility", () => {
  const empty = serializeCampaignSave(createDefaultCampaignSave());
  assert.equal(isEligibleV100LegacyHistory(empty), false);
  assert.equal(isEligibleV100LegacyHistory(signedLegacy({ revision: 7 })), false);
  for (const changes of [
    { campaignStarted: true },
    { completedStageIds: [INITIAL_STAGE_ID] },
    { processedResultIds: ["result:one"] },
    { processedAcquisitionIds: ["recruit:one"] },
    { processedUpgradeIds: ["upgrade:one"] },
    { processedEquipmentTransactionIds: ["equipment:one"] },
  ]) assert.equal(isEligibleV100LegacyHistory(signedLegacy(changes)), true, JSON.stringify(changes));
  for (const candidate of [null, "", "{", [], { revision: 1 }, { campaignStarted: true }, { ownedUnitIds: ["unit-hachi"] }]) {
    assert.equal(isEligibleV100LegacyHistory(candidate), false);
  }
});

test("supported old schema migration cannot infer an entitlement from schema or starting balance", () => {
  for (const schemaVersion of [0, 1, 2]) {
    const old = { ...createDefaultCampaignSave(), schemaVersion };
    delete old.integrity;
    if (schemaVersion < 2) delete old.campaignStarted;
    assert.equal(inspectCampaignSaveCandidate(old).status, "valid");
    assert.equal(isEligibleV100LegacyHistory(old), false);
    assert.equal(isEligibleV100LegacyHistory({ ...old, completedStageIds: [INITIAL_STAGE_ID] }), true);
    if (schemaVersion === 2) {
      delete old.campaignStarted;
      assert.equal(inspectCampaignSaveCandidate(old).reason, "unrecognized-legacy-shape");
      assert.equal(isEligibleV100LegacyHistory(old), false);
    }
  }
});

test("foreign identities, QA markers and corrupted integrity reject played-looking data", () => {
  const valid = JSON.parse(signedLegacy({ campaignStarted: true }));
  for (const changes of [
    { namespace: "nishijin-campaign-v100" }, { saveNamespace: "foreign" }, { namespace: "foreign", saveNamespace: "nishijin-campaign-v1" },
    { namespace: null }, { campaignGeneration: "v100-new-campaign-1" }, { campaignGeneration: "foreign" },
    { qaMode: true }, { qaMode: "all" }, { localQa: true }, { isFixture: true },
  ]) assert.equal(isEligibleV100LegacyHistory(signedLegacy({ campaignStarted: true, ...changes })), false, JSON.stringify(changes));
  for (const changes of [{ integrity: "bad" }, { integrity: "" }, { caps: valid.caps + 1 }, { schemaVersion: 9999 }]) {
    assert.equal(isEligibleV100LegacyHistory({ ...valid, ...changes }), false, JSON.stringify(changes));
  }
  assert.equal(isEligibleV100LegacyHistory(signedLegacy({ campaignStarted: true, namespace: "nishijin-campaign-v1" })), true);
  assert.equal(isEligibleV100LegacyHistory(createDefaultV100Save()), false);
});

test("manual exports require supported envelope and validated inner legacy save", () => {
  const raw = signedLegacy({ campaignStarted: true });
  const valid = createCampaignManualExport(raw);
  assert.equal(isEligibleV100LegacyHistory(valid), true);
  const envelope = JSON.parse(valid);
  for (const changes of [{ version: 2 }, { format: "foreign-save" }, { serialized: "{" }, { serialized: JSON.stringify({ campaignStarted: true }) }, { serialized: 9 }, { localQa: true }]) {
    assert.equal(isEligibleV100LegacyHistory({ ...envelope, ...changes }), false);
  }
  assert.equal(isEligibleV100LegacyHistory(createCampaignManualExport(serializeCampaignSave(createDefaultCampaignSave()))), false);
  assert.equal(isEligibleV100LegacyHistory(JSON.stringify({ ...envelope, padding: "x".repeat(1024 * 1024) })), false);
});

test("whitelisted settings preserve valid silent/accessibility preferences and top-level legacy read preference", () => {
  const settings = { bgmEnabled: false, sfxEnabled: false, bgmVolume: 0, sfxVolume: 1, reducedMotion: true, battleEventMode: "compact", graphicsQuality: "power-save", autoSkipReadStory: false, caps: 999 };
  const raw = signedLegacy({ campaignStarted: true, autoSkipReadStory: true, settings });
  const copied = copyV100LegacySettings(raw);
  assert.deepEqual(Object.keys(copied), [...V100_LEGACY_SETTINGS_WHITELIST]);
  assert.deepEqual(copied, { bgmEnabled: false, sfxEnabled: false, bgmVolume: 0, sfxVolume: 1, reducedMotion: true, battleEventMode: "compact", graphicsQuality: "power-save", autoSkipReadStory: true });
});

test("malformed whitelisted values use V1 defaults without coercion or nested values", () => {
  const candidates = {
    bgmEnabled: ["true", 1, null, {}], sfxEnabled: ["false", 0, [], null],
    reducedMotion: [1, "false", null], autoSkipReadStory: ["yes", 1, {}],
    bgmVolume: ["0.5", -1, 2, null, {}, Infinity, NaN], sfxVolume: ["0.4", -1, 2, null, [], Infinity, NaN],
    battleEventMode: ["unknown", null, 1, {}], graphicsQuality: ["low", null, 1, []],
  };
  for (const [key, values] of Object.entries(candidates)) for (const value of values) {
    const result = createDefaultV100Save({ settings: { [key]: value } });
    assert.equal(result.settings[key], V100_DEFAULT_SETTINGS[key], `${key}:${String(value)}`);
    assert.equal(normalizeV100Save({ ...result, settings: { [key]: value } }).settings[key], V100_DEFAULT_SETTINGS[key]);
  }
  assert.deepEqual(createDefaultV100Save({ settings: Object.create({ bgmEnabled: false }) }).settings, V100_DEFAULT_SETTINGS);
  const raw = signedLegacy({ campaignStarted: true, settings: { bgmEnabled: "yes", bgmVolume: { caps: 99 }, graphicsQuality: "unrecognized" } });
  assert.deepEqual(copyV100LegacySettings(raw), V100_DEFAULT_SETTINGS);
  assert.deepEqual(copyV100LegacySettings({ campaignStarted: true, settings: { bgmEnabled: false } }), V100_DEFAULT_SETTINGS);
});

test("legacy candidate bytes and all progression remain outside the new campaign", () => {
  const legacy = JSON.parse(signedLegacy({ campaignStarted: true, caps: 9999, completedStageIds: [INITIAL_STAGE_ID], processedResultIds: ["old-result"], autoSkipReadStory: true }));
  const before = JSON.stringify(legacy);
  const created = createV100SaveFromLegacy({ legacyCandidate: legacy });
  assert.equal(JSON.stringify(legacy), before);
  assert.equal(created.legacy.eligible, true);
  assert.equal(created.caps, 0);
  assert.equal(created.campaignStarted, false);
  assert.deepEqual(created.ownedUnitIds, V100_INITIAL_UNIT_IDS);
  assert.deepEqual(created.completedStageIds, []);
  assert.deepEqual(created.bestStars, {});
  assert.deepEqual(created.receipts, []);
  assert.deepEqual(created.readStoryEventIds, []);
  assert.ok(Object.values(created.unitLevels).every(level => level === 1));
  assert.equal(created.vehicle.upgradeLevel, 0);
  assert.deepEqual(created.ownedSupportIds, []);
  assert.equal(created.settings.autoSkipReadStory, true);
});
