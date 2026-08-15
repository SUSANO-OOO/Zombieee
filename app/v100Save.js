import {
  V100_CAMPAIGN_GENERATION,
  V100_CAMPAIGN_NAMESPACE,
  V100_DEFAULT_PLAYER_NAME,
  V100_FORMATION_MAX_SLOTS,
  V100_INITIAL_UNIT_IDS,
  V100_LEGACY_GIFT,
  V100_LEGACY_NAMESPACE,
  V100_LEGACY_SETTINGS_WHITELIST,
  V100_STAGE_IDS,
  V100_UNITS,
  V100_VEHICLE,
  normalizeV100PlayerName,
} from "./v100Registry.js";

export const V100_SAVE_SCHEMA_VERSION = 1;
export const V100_PRIMARY_STORAGE_KEY = V100_CAMPAIGN_NAMESPACE;
export const V100_SAFE_GIFT_SCREENS = Object.freeze(["title", "map", "personnel", "loadout"]);
export const V100_DEFAULT_SETTINGS = Object.freeze({
  bgmEnabled: true,
  sfxEnabled: true,
  bgmVolume: 0.8,
  sfxVolume: 0.9,
  reducedMotion: false,
  battleEventMode: "first-time",
  graphicsQuality: "auto",
  autoSkipReadStory: false,
});

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function integer(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(minimum, Math.min(maximum, Math.floor(numeric))) : minimum;
}

function uniqueStrings(value) {
  return [...new Set(Array.isArray(value) ? value.filter((entry) => typeof entry === "string" && entry.length > 0) : [])];
}

function normalizeSettings(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(V100_LEGACY_SETTINGS_WHITELIST.map((key) => [key, source[key] === undefined ? V100_DEFAULT_SETTINGS[key] : source[key]]));
}

function normalizedName(value, fallback = V100_DEFAULT_PLAYER_NAME) {
  const result = normalizeV100PlayerName(value);
  return result.ok ? result.value : fallback;
}

function defaultBossState() {
  return {
    discoveredIds: [],
    compendiumIds: [],
    outbreakIds: [],
    survivalIds: [],
    storyReplayStageNumbers: [],
    defeatCounts: {},
  };
}

export function createDefaultV100Save({ settings = {}, playerName = V100_DEFAULT_PLAYER_NAME, now = new Date().toISOString() } = {}) {
  const unitLevels = Object.fromEntries(V100_UNITS.map((unit) => [unit.id, 1]));
  return {
    namespace: V100_CAMPAIGN_NAMESPACE,
    campaignGeneration: V100_CAMPAIGN_GENERATION,
    schemaVersion: V100_SAVE_SCHEMA_VERSION,
    revision: 0,
    updatedAt: now,
    campaignStarted: false,
    playerName: normalizedName(playerName),
    availableStageIds: [V100_STAGE_IDS[0]],
    completedStageIds: [],
    bestStars: {},
    caps: 0,
    ownedUnitIds: [...V100_INITIAL_UNIT_IDS],
    registeredUnitIds: [...V100_INITIAL_UNIT_IDS],
    unitLevels,
    levelCap: 5,
    equippedSupportId: null,
    supportPurchaseUnlockedIds: [],
    ownedSupportIds: [],
    vehicle: {
      upgradeLevel: 0,
      maxHp: V100_VEHICLE.baseHp,
      upgradeReceipts: [],
    },
    bosses: defaultBossState(),
    formationSlots: [...V100_INITIAL_UNIT_IDS, ...Array(V100_FORMATION_MAX_SLOTS - V100_INITIAL_UNIT_IDS.length).fill(null)],
    receipts: [],
    readStoryEventIds: [],
    eventCursor: null,
    pendingResult: null,
    lastResult: null,
    postGameAvailable: false,
    legacy: {
      eligible: false,
      entitlementClaimed: false,
      popupAcknowledged: false,
    },
    settings: normalizeSettings(settings),
  };
}

function normalizeFormationSlots(value, ownedUnitIds) {
  const slots = Array.isArray(value) ? value.slice(0, V100_FORMATION_MAX_SLOTS) : [];
  while (slots.length < V100_FORMATION_MAX_SLOTS) slots.push(null);
  return slots.map((unitId) => typeof unitId === "string" && ownedUnitIds.includes(unitId) ? unitId : null);
}

export function normalizeV100Save(raw, { fallback = null } = {}) {
  const base = createDefaultV100Save({ settings: raw?.settings, playerName: fallback?.playerName ?? V100_DEFAULT_PLAYER_NAME });
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  if (raw.namespace !== V100_CAMPAIGN_NAMESPACE || raw.campaignGeneration !== V100_CAMPAIGN_GENERATION) return base;
  const ownedUnitIds = [...new Set([
    ...V100_INITIAL_UNIT_IDS,
    ...uniqueStrings(raw.ownedUnitIds).filter((unitId) => V100_UNITS.some((unit) => unit.id === unitId)),
  ])];
  const registeredUnitIds = [...new Set([
    ...V100_INITIAL_UNIT_IDS,
    ...uniqueStrings(raw.registeredUnitIds).filter((unitId) => V100_UNITS.some((unit) => unit.id === unitId)),
  ])];
  const completedStageIds = uniqueStrings(raw.completedStageIds).filter((stageId) => V100_STAGE_IDS.includes(stageId));
  const availableStageIds = [...new Set([
    V100_STAGE_IDS[0],
    ...uniqueStrings(raw.availableStageIds).filter((stageId) => V100_STAGE_IDS.includes(stageId)),
  ])];
  const receipts = uniqueStrings(raw.receipts).filter((receipt) => receipt.startsWith("v100:"));
  const bestStars = Object.fromEntries(Object.entries(raw.bestStars && typeof raw.bestStars === "object" ? raw.bestStars : {})
    .filter(([stageId]) => V100_STAGE_IDS.includes(stageId))
    .map(([stageId, stars]) => [stageId, integer(stars, 0, 3)]));
  const unitLevels = Object.fromEntries(V100_UNITS.map((unit) => [unit.id, integer(raw.unitLevels?.[unit.id], 1, 30) || 1]));
  const vehicleLevel = integer(raw.vehicle?.upgradeLevel, 0, V100_VEHICLE.maxUpgradeLevel);
  const vehicle = {
    upgradeLevel: vehicleLevel,
    maxHp: V100_VEHICLE.baseHp + vehicleLevel * V100_VEHICLE.hpPerUpgrade,
    upgradeReceipts: uniqueStrings(raw.vehicle?.upgradeReceipts).filter((receipt) => receipt.startsWith("v100:vehicle:")),
  };
  const rawBosses = raw.bosses && typeof raw.bosses === "object" ? raw.bosses : {};
  const bosses = {
    discoveredIds: uniqueStrings(rawBosses.discoveredIds).filter((id) => id.startsWith("boss-")),
    compendiumIds: uniqueStrings(rawBosses.compendiumIds).filter((id) => id.startsWith("compendium:boss-")),
    outbreakIds: uniqueStrings(rawBosses.outbreakIds).filter((id) => id.startsWith("outbreak:boss-")),
    survivalIds: uniqueStrings(rawBosses.survivalIds).filter((id) => id.startsWith("survival:boss-")),
    storyReplayStageNumbers: (Array.isArray(rawBosses.storyReplayStageNumbers) ? rawBosses.storyReplayStageNumbers : [])
      .map(Number).filter((number) => Number.isInteger(number) && number >= 1 && number <= 30),
    defeatCounts: Object.fromEntries(Object.entries(rawBosses.defeatCounts && typeof rawBosses.defeatCounts === "object" ? rawBosses.defeatCounts : {})
      .filter(([id, count]) => id.startsWith("boss-") && Number.isFinite(Number(count)))
      .map(([id, count]) => [id, integer(count, 0)])),
  };
  return {
    ...base,
    schemaVersion: V100_SAVE_SCHEMA_VERSION,
    revision: integer(raw.revision),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : base.updatedAt,
    campaignStarted: raw.campaignStarted === true,
    playerName: normalizedName(raw.playerName, normalizedName(fallback?.playerName)),
    availableStageIds,
    completedStageIds,
    bestStars,
    caps: integer(raw.caps),
    ownedUnitIds,
    registeredUnitIds,
    unitLevels,
    levelCap: integer(raw.levelCap, 5, 30) || 5,
    equippedSupportId: typeof raw.equippedSupportId === "string" ? raw.equippedSupportId : null,
    supportPurchaseUnlockedIds: uniqueStrings(raw.supportPurchaseUnlockedIds).filter((supportId) => ["support-healing", "support-explosive-drum", "support-incendiary-drum"].includes(supportId)),
    ownedSupportIds: uniqueStrings(raw.ownedSupportIds).filter((supportId) => ["support-healing", "support-explosive-drum", "support-incendiary-drum"].includes(supportId)),
    vehicle,
    bosses,
    formationSlots: normalizeFormationSlots(raw.formationSlots, ownedUnitIds),
    receipts,
    readStoryEventIds: uniqueStrings(raw.readStoryEventIds).filter((eventId) => eventId.startsWith("v100:event:")),
    eventCursor: raw.eventCursor && typeof raw.eventCursor === "object" ? {
      eventId: typeof raw.eventCursor.eventId === "string" ? raw.eventCursor.eventId : null,
      phase: typeof raw.eventCursor.phase === "string" ? raw.eventCursor.phase : null,
      nodeIndex: integer(raw.eventCursor.nodeIndex),
      nodeKey: typeof raw.eventCursor.nodeKey === "string" ? raw.eventCursor.nodeKey : null,
    } : null,
    pendingResult: raw.pendingResult && typeof raw.pendingResult === "object" ? clone(raw.pendingResult) : null,
    lastResult: raw.lastResult && typeof raw.lastResult === "object" ? clone(raw.lastResult) : null,
    postGameAvailable: raw.postGameAvailable === true,
    legacy: {
      eligible: raw.legacy?.eligible === true,
      entitlementClaimed: raw.legacy?.entitlementClaimed === true || receipts.includes(V100_LEGACY_GIFT.entitlementReceipt),
      popupAcknowledged: raw.legacy?.popupAcknowledged === true || receipts.includes(V100_LEGACY_GIFT.popupReceipt),
    },
    settings: normalizeSettings(raw.settings),
  };
}

export function serializeV100Save(save) {
  return JSON.stringify(normalizeV100Save(save));
}

export function deserializeV100Save(serialized, options = {}) {
  if (typeof serialized !== "string" || serialized.length === 0) return { ok: false, reason: "empty", save: createDefaultV100Save() };
  try {
    const parsed = JSON.parse(serialized);
    const save = normalizeV100Save(parsed, options);
    if (save.namespace !== V100_CAMPAIGN_NAMESPACE) return { ok: false, reason: "wrong-namespace", save: createDefaultV100Save() };
    return { ok: true, save };
  } catch (error) {
    return { ok: false, reason: "invalid-json", error, save: createDefaultV100Save() };
  }
}

function candidateValue(candidate) {
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) return candidate;
  if (typeof candidate !== "string") return null;
  try {
    const parsed = JSON.parse(candidate);
    if (parsed?.format === "nishijin-campaign-save" && typeof parsed.serialized === "string") return JSON.parse(parsed.serialized);
    return parsed;
  } catch {
    return null;
  }
}

export function isEligibleV100LegacyHistory(candidate) {
  const value = candidateValue(candidate);
  if (!value || value.namespace === V100_CAMPAIGN_NAMESPACE || value.campaignGeneration === V100_CAMPAIGN_GENERATION) return false;
  if (value.namespace && value.namespace !== V100_LEGACY_NAMESPACE && value.saveNamespace !== V100_LEGACY_NAMESPACE) return false;
  if (value.qaMode === true || value.localQa === true || value.isFixture === true) return false;
  return value.campaignStarted === true
    || (Array.isArray(value.completedStageIds) && value.completedStageIds.length > 0)
    || (Array.isArray(value.processedResultIds) && value.processedResultIds.length > 0)
    || (Array.isArray(value.ownedUnitIds) && value.ownedUnitIds.length > 0)
    || (value.revision !== undefined && Number(value.revision) > 0);
}

export function copyV100LegacySettings(candidate) {
  const value = candidateValue(candidate);
  return normalizeSettings(value?.settings);
}

export function createV100SaveFromLegacy({ legacyCandidate = null, settings = {}, playerName = V100_DEFAULT_PLAYER_NAME, now } = {}) {
  const eligible = isEligibleV100LegacyHistory(legacyCandidate);
  const inheritedSettings = eligible ? copyV100LegacySettings(legacyCandidate) : normalizeSettings(settings);
  const save = createDefaultV100Save({ settings: inheritedSettings, playerName, now });
  return {
    ...save,
    legacy: { eligible, entitlementClaimed: false, popupAcknowledged: false },
  };
}

export function applyV100SaveMutation(save, mutation, { now = new Date().toISOString(), expectedRevision = null } = {}) {
  const current = normalizeV100Save(save);
  if (expectedRevision !== null && current.revision !== expectedRevision) return { applied: false, reason: "stale-revision", save: current };
  const next = typeof mutation === "function" ? mutation(clone(current)) : null;
  if (!next || typeof next !== "object") return { applied: false, reason: "invalid-mutation", save: current };
  const normalized = normalizeV100Save({ ...next, revision: current.revision + 1, updatedAt: now });
  return { applied: true, save: normalized };
}

export function claimV100LegacyGift(save, { legacyCandidate = null, now } = {}) {
  const current = normalizeV100Save(save);
  const eligible = current.legacy.eligible || isEligibleV100LegacyHistory(legacyCandidate);
  if (!eligible) return { applied: false, reason: "not-eligible", save: current };
  if (current.receipts.includes(V100_LEGACY_GIFT.entitlementReceipt)) return { applied: false, duplicate: true, reason: "duplicate-receipt", save: current };
  const result = applyV100SaveMutation(current, (next) => ({
    ...next,
    caps: next.caps + V100_LEGACY_GIFT.amountCaps,
    receipts: [...next.receipts, V100_LEGACY_GIFT.entitlementReceipt],
    legacy: { ...next.legacy, eligible: true, entitlementClaimed: true },
  }), { now });
  return result;
}

export function acknowledgeV100LegacyGiftPopup(save, { screen, now } = {}) {
  const current = normalizeV100Save(save);
  if (!V100_SAFE_GIFT_SCREENS.includes(screen)) return { applied: false, reason: "unsafe-screen", save: current };
  if (!current.legacy.entitlementClaimed || !current.receipts.includes(V100_LEGACY_GIFT.entitlementReceipt)) return { applied: false, reason: "entitlement-missing", save: current };
  if (current.receipts.includes(V100_LEGACY_GIFT.popupReceipt)) return { applied: false, duplicate: true, reason: "duplicate-receipt", save: current };
  return applyV100SaveMutation(current, (next) => ({
    ...next,
    receipts: [...next.receipts, V100_LEGACY_GIFT.popupReceipt],
    legacy: { ...next.legacy, popupAcknowledged: true },
  }), { now });
}

export function updateV100PlayerName(save, value, { now } = {}) {
  const current = normalizeV100Save(save);
  const result = normalizeV100PlayerName(value);
  if (!result.ok) return { applied: false, reason: result.reason, save: current };
  if (result.value === current.playerName) return { applied: false, unchanged: true, save: current };
  return applyV100SaveMutation(current, (next) => ({ ...next, playerName: result.value }), { now });
}

export function setV100EventCursor(save, cursor, { now } = {}) {
  return applyV100SaveMutation(save, (next) => ({ ...next, eventCursor: cursor ? clone(cursor) : null }), { now });
}

export function markV100EventRead(save, eventId, { now } = {}) {
  if (typeof eventId !== "string" || !eventId.startsWith("v100:event:")) return { applied: false, reason: "unknown-event", save: normalizeV100Save(save) };
  const current = normalizeV100Save(save);
  if (current.readStoryEventIds.includes(eventId)) return { applied: false, duplicate: true, reason: "already-read", save: current };
  return applyV100SaveMutation(current, (next) => ({
    ...next,
    readStoryEventIds: [...next.readStoryEventIds, eventId],
    eventCursor: null,
  }), { now });
}

export function preserveV100LegacySnapshot(rawLegacySerialized) {
  return typeof rawLegacySerialized === "string" ? rawLegacySerialized : "";
}

export function v100SaveNamespaceContract() {
  return Object.freeze({
    primaryKey: V100_PRIMARY_STORAGE_KEY,
    namespace: V100_CAMPAIGN_NAMESPACE,
    generation: V100_CAMPAIGN_GENERATION,
    legacyNamespace: V100_LEGACY_NAMESPACE,
    legacySettingsWhitelist: V100_LEGACY_SETTINGS_WHITELIST,
    initialUnits: V100_INITIAL_UNIT_IDS,
    initialCaps: 0,
    formationSlots: V100_FORMATION_MAX_SLOTS,
  });
}
