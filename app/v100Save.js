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
import { inspectCampaignSaveCandidate } from "./campaign.js";
import { normalizeV100Equipment } from "./v100Equipment.js";
import { normalizeV100BossProgress } from "./v100BossProgress.js";
import { normalizeV100OutbreakProgress } from "./v100Outbreak.js";
import { normalizeV100SurvivalProgress } from "./v100Survival.js";
import { CAMPAIGN_EXPORT_FORMAT, CAMPAIGN_IMPORT_MAX_BYTES, parseCampaignManualImport } from "./campaignStorage.js";

export const V100_SAVE_SCHEMA_VERSION = 1;
export const V100_PRIMARY_STORAGE_KEY = V100_CAMPAIGN_NAMESPACE;
export const V100_SAVE_EXPORT_FORMAT = "nishijin-campaign-v100-save";
export const V100_SAVE_FLOW_PHASES = Object.freeze([
  "name", "event", "formation", "battle", "result", "post", "first-clear-post", "ending", "credits", "epilogue", "map",
]);
export const V100_SAFE_GIFT_SCREENS = Object.freeze(["title", "map"]);
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
  const validValue = (key, candidate) => {
    if (["bgmEnabled", "sfxEnabled", "reducedMotion", "autoSkipReadStory"].includes(key)) return typeof candidate === "boolean";
    if (["bgmVolume", "sfxVolume"].includes(key)) return typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0 && candidate <= 1;
    if (key === "battleEventMode") return ["first-time", "compact", "all"].includes(candidate);
    if (key === "graphicsQuality") return ["auto", "high", "power-save"].includes(candidate);
    return false;
  };
  return Object.fromEntries(V100_LEGACY_SETTINGS_WHITELIST.map((key) => [key,
    Object.hasOwn(source, key) && validValue(key, source[key]) ? source[key] : V100_DEFAULT_SETTINGS[key],
  ]));
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
    equipment: normalizeV100Equipment(null),
    outbreak: normalizeV100OutbreakProgress(null, []),
    survival: normalizeV100SurvivalProgress(null, [], V100_INITIAL_UNIT_IDS),
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
    flowState: {
      phase: "name",
      eventId: null,
      stageId: null,
      stageNumber: null,
      destination: "name",
      nodeIndex: 0,
      firstClear: false,
      finalized: false,
    },
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

function normalizeFlowState(value, fallback) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
  const phase = V100_SAVE_FLOW_PHASES.includes(source?.phase) ? source.phase : fallback?.phase ?? "name";
  const eventId = typeof source?.eventId === "string" && source.eventId.startsWith("v100:event:") ? source.eventId : null;
  const stageId = V100_STAGE_IDS.includes(source?.stageId) ? source.stageId : null;
  const stageNumber = Number.isInteger(Number(source?.stageNumber)) && Number(source.stageNumber) >= 1 && Number(source.stageNumber) <= 30
    ? Math.floor(Number(source.stageNumber))
    : null;
  return {
    phase,
    eventId,
    stageId,
    stageNumber,
    destination: typeof source?.destination === "string" ? source.destination : phase,
    nodeIndex: integer(source?.nodeIndex, 0, 10_000),
    firstClear: source?.firstClear === true,
    finalized: source?.finalized === true,
  };
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
  const bosses = normalizeV100BossProgress(raw.bosses, receipts);
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
    equipment: normalizeV100Equipment(raw.equipment, ownedUnitIds),
    outbreak: normalizeV100OutbreakProgress(raw.outbreak, receipts),
    survival: normalizeV100SurvivalProgress(raw.survival, receipts, ownedUnitIds),
    formationSlots: normalizeFormationSlots(raw.formationSlots, ownedUnitIds),
    receipts,
    readStoryEventIds: uniqueStrings(raw.readStoryEventIds).filter((eventId) => eventId.startsWith("v100:event:")),
    eventCursor: raw.eventCursor && typeof raw.eventCursor === "object" ? {
      eventId: typeof raw.eventCursor.eventId === "string" ? raw.eventCursor.eventId : null,
      phase: typeof raw.eventCursor.phase === "string" ? raw.eventCursor.phase : null,
      nodeIndex: integer(raw.eventCursor.nodeIndex),
      nodeKey: typeof raw.eventCursor.nodeKey === "string" ? raw.eventCursor.nodeKey : null,
    } : null,
    flowState: normalizeFlowState(raw.flowState, base.flowState),
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

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function validateV100SavePayload(raw) {
  const errors = [];
  if (!isRecord(raw)) errors.push("payload-not-object");
  if (isRecord(raw)) {
    if (raw.namespace !== V100_CAMPAIGN_NAMESPACE) errors.push("wrong-namespace");
    if (raw.campaignGeneration !== V100_CAMPAIGN_GENERATION) errors.push("wrong-generation");
    if (raw.schemaVersion !== V100_SAVE_SCHEMA_VERSION) errors.push("wrong-schema-version");
    if (!Number.isInteger(Number(raw.revision)) || Number(raw.revision) < 0) errors.push("invalid-revision");
    if (typeof raw.playerName !== "string") errors.push("invalid-player-name");
    for (const key of ["availableStageIds", "completedStageIds", "ownedUnitIds", "registeredUnitIds", "formationSlots", "receipts", "readStoryEventIds"]) {
      if (!Array.isArray(raw[key])) errors.push(`invalid-${key}`);
    }
    if (!isRecord(raw.vehicle)) errors.push("invalid-vehicle");
    if (!isRecord(raw.bosses)) errors.push("invalid-bosses");
    if (!isRecord(raw.legacy)) errors.push("invalid-legacy");
    if (!isRecord(raw.settings)) errors.push("invalid-settings");
    if (raw.eventCursor !== null && !isRecord(raw.eventCursor)) errors.push("invalid-event-cursor");
    if (raw.flowState !== undefined && !isRecord(raw.flowState)) errors.push("invalid-flow-state");
    if (raw.pendingResult !== null && !isRecord(raw.pendingResult)) errors.push("invalid-pending-result");
    if (raw.lastResult !== null && !isRecord(raw.lastResult)) errors.push("invalid-last-result");
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

export function deserializeV100Save(serialized, options = {}) {
  if (typeof serialized !== "string" || serialized.length === 0) return { ok: false, reason: "empty", save: createDefaultV100Save() };
  try {
    const parsed = JSON.parse(serialized);
    const validation = validateV100SavePayload(parsed);
    if (!validation.ok) return { ok: false, reason: "invalid-payload", errors: validation.errors, save: createDefaultV100Save() };
    const save = normalizeV100Save(parsed, options);
    return { ok: true, save };
  } catch (error) {
    return { ok: false, reason: "invalid-json", error, save: createDefaultV100Save() };
  }
}

function hasForeignLegacyIdentity(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return ["namespace", "saveNamespace"].some(key => Object.hasOwn(value, key) && value[key] !== V100_LEGACY_NAMESPACE)
    || Object.hasOwn(value, "campaignGeneration")
    || Boolean(value.qaMode || value.localQa || value.isFixture);
}

function legacyCandidate(candidate) {
  try {
    const text = typeof candidate === "string" ? candidate : JSON.stringify(candidate);
    if (typeof text !== "string" || text.length > CAMPAIGN_IMPORT_MAX_BYTES) return null;
    const outer = JSON.parse(text);
    if (hasForeignLegacyIdentity(outer) || (outer?.format !== undefined && outer.format !== CAMPAIGN_EXPORT_FORMAT)) return null;
    // The existing bounded import parser verifies envelopes; the strict inspector
    // verifies actual legacy shape/integrity before any forgiving migration.
    const imported = parseCampaignManualImport(text, { validate: raw => {
      const value = JSON.parse(raw);
      if (hasForeignLegacyIdentity(value) || value?.format !== undefined) return { valid: false, reason: "foreign-or-qa-save" };
      return inspectCampaignSaveCandidate(raw, { source: "v100-legacy-read-only" });
    } });
    return imported.status === "ready" ? { raw: JSON.parse(imported.serialized), save: imported.value } : null;
  } catch {
    return null;
  }
}

function legacyHasPlayed(history) {
  if (!history) return false;
  // Migration can infer campaignStarted from a schema number. Only an explicit
  // source flag or actual durable gameplay history establishes this entitlement.
  return history.raw.campaignStarted === true
    || ["completedStageIds", "processedResultIds", "processedAcquisitionIds", "processedUpgradeIds", "processedEquipmentTransactionIds"]
      .some(key => Array.isArray(history.save?.[key]) && history.save[key].length > 0);
}

export function isEligibleV100LegacyHistory(candidate) {
  return legacyHasPlayed(legacyCandidate(candidate));
}

export function copyV100LegacySettings(candidate) {
  const history = legacyCandidate(candidate);
  if (!legacyHasPlayed(history)) return normalizeSettings({});
  const source = history.raw.settings ?? history.raw.options;
  return normalizeSettings({
    ...(source && typeof source === "object" && !Array.isArray(source) ? source : {}),
    // The actual legacy save owns this preference at its top level.
    ...(typeof history.raw.autoSkipReadStory === "boolean" ? { autoSkipReadStory: history.raw.autoSkipReadStory } : {}),
  });
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
