const inMemoryCampaignSaves = new Map();
const CAMPAIGN_BACKUP_DATABASE = "nishijin-campaign-backup";
const CAMPAIGN_BACKUP_STORE = "saves";

export const CAMPAIGN_STORAGE_SOURCES = Object.freeze({
  LOCAL_STORAGE: "localStorage",
  INDEXED_DB: "indexedDB",
  MANUAL: "manual",
});

export const CAMPAIGN_SNAPSHOT_KINDS = Object.freeze({
  PRE_MIGRATION: "pre-migration",
  LAST_KNOWN_GOOD: "last-known-good",
});

export const CAMPAIGN_EXPORT_FORMAT = "nishijin-campaign-save";
export const CAMPAIGN_CORRUPT_EXPORT_FORMAT = "nishijin-campaign-corrupt-raw";
const CAMPAIGN_EXPORT_VERSION = 1;

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function campaignStorageFor(windowLike) {
  try {
    return windowLike?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readCampaignSave(storage, key) {
  try {
    const stored = storage?.getItem?.(key);
    if (typeof stored === "string") {
      inMemoryCampaignSaves.set(key, stored);
      return stored;
    }
  } catch {
    // Privacy modes and embedded browsers may reject storage access. The
    // in-memory copy still lets the current run finish normally.
  }
  return inMemoryCampaignSaves.get(key) ?? "";
}

export function writeCampaignSave(storage, key, serialized) {
  const value = typeof serialized === "string" ? serialized : String(serialized ?? "");
  inMemoryCampaignSaves.set(key, value);
  try {
    if (!storage?.setItem || !storage?.getItem) return false;
    storage?.setItem?.(key, value);
    return storage.getItem(key) === value;
  } catch {
    return false;
  }
}

export function clearCampaignStorageFallback(key) {
  inMemoryCampaignSaves.delete(key);
}

export function indexedDbFor(windowLike) {
  try {
    return windowLike?.indexedDB ?? null;
  } catch {
    return null;
  }
}

function openCampaignBackupDatabase(indexedDb) {
  return new Promise((resolve, reject) => {
    if (!indexedDb?.open) {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }
    const request = indexedDb.open(CAMPAIGN_BACKUP_DATABASE, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CAMPAIGN_BACKUP_STORE)) {
        database.createObjectStore(CAMPAIGN_BACKUP_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open campaign backup"));
    request.onblocked = () => reject(new Error("Campaign backup database is blocked"));
  });
}

function runCampaignBackupRequest(indexedDb, mode, operation) {
  return openCampaignBackupDatabase(indexedDb).then((database) => new Promise((resolve, reject) => {
    let transaction;
    try {
      transaction = database.transaction(CAMPAIGN_BACKUP_STORE, mode);
      const store = transaction.objectStore(CAMPAIGN_BACKUP_STORE);
      const request = operation(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Campaign backup request failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("Campaign backup transaction aborted"));
    } catch (error) {
      reject(error);
    } finally {
      transaction?.addEventListener?.("complete", () => database.close());
      transaction?.addEventListener?.("abort", () => database.close());
      transaction?.addEventListener?.("error", () => database.close());
    }
  }));
}

export async function readCampaignBackup(indexedDb, key) {
  try {
    const stored = await runCampaignBackupRequest(indexedDb, "readonly", (store) => store.get(key));
    return typeof stored === "string" ? stored : "";
  } catch {
    return "";
  }
}

export async function writeCampaignBackup(indexedDb, key, serialized) {
  const value = typeof serialized === "string" ? serialized : String(serialized ?? "");
  try {
    await runCampaignBackupRequest(indexedDb, "readwrite", (store) => store.put(value, key));
    const verified = await readCampaignBackup(indexedDb, key);
    return verified === value;
  } catch {
    return false;
  }
}

/**
 * Writes the two primary replicas while honoring sources whose contents could
 * not be read during hydration. An unreadable source may contain a newer save,
 * so only an explicit recovery/reset action may overwrite it.
 */
export async function writeCampaignSaveReplicas({
  storage,
  indexedDb,
  key,
  serialized,
  blockedSources = [],
  alreadySavedSources = [],
}) {
  const blocked = new Set(blockedSources);
  const alreadySaved = new Set(alreadySavedSources);
  const localSaved = blocked.has(CAMPAIGN_STORAGE_SOURCES.LOCAL_STORAGE)
    ? false
    : alreadySaved.has(CAMPAIGN_STORAGE_SOURCES.LOCAL_STORAGE)
      ? true
      : writeCampaignSave(storage, key, serialized);
  const backupSaved = blocked.has(CAMPAIGN_STORAGE_SOURCES.INDEXED_DB)
    ? false
    : alreadySaved.has(CAMPAIGN_STORAGE_SOURCES.INDEXED_DB)
      ? true
      : await writeCampaignBackup(indexedDb, key, serialized);
  return {
    localSaved,
    backupSaved,
    blockedSources: [...blocked],
  };
}

function describeStorageError(error, fallback) {
  return {
    name: typeof error?.name === "string" && error.name ? error.name : "Error",
    message: typeof error?.message === "string" && error.message ? error.message : fallback,
  };
}

function createRawCandidate(source, key, state, raw = "", error = null) {
  return {
    source,
    key,
    state,
    raw,
    serialized: typeof raw === "string" ? raw : "",
    error,
  };
}

/**
 * Reads only localStorage. Unlike readCampaignSave, this never substitutes the
 * in-memory mirror, so callers can independently judge the durable candidate.
 */
export function readLocalCampaignCandidate(storage, key) {
  if (!storage?.getItem) {
    return createRawCandidate(
      CAMPAIGN_STORAGE_SOURCES.LOCAL_STORAGE,
      key,
      "unavailable",
      "",
      { name: "UnavailableError", message: "localStorage is unavailable" },
    );
  }
  try {
    const stored = storage.getItem(key);
    if (stored === null || stored === undefined || stored === "") {
      return createRawCandidate(CAMPAIGN_STORAGE_SOURCES.LOCAL_STORAGE, key, "missing");
    }
    if (typeof stored === "string") {
      inMemoryCampaignSaves.set(key, stored);
    }
    return createRawCandidate(CAMPAIGN_STORAGE_SOURCES.LOCAL_STORAGE, key, "present", stored);
  } catch (error) {
    return createRawCandidate(
      CAMPAIGN_STORAGE_SOURCES.LOCAL_STORAGE,
      key,
      "read-error",
      "",
      describeStorageError(error, "Could not read localStorage campaign save"),
    );
  }
}

/**
 * Reads only IndexedDB and preserves read failures as structured state.
 */
export async function readIndexedDbCampaignCandidate(indexedDb, key) {
  if (!indexedDb?.open) {
    return createRawCandidate(
      CAMPAIGN_STORAGE_SOURCES.INDEXED_DB,
      key,
      "unavailable",
      "",
      { name: "UnavailableError", message: "IndexedDB is unavailable" },
    );
  }
  try {
    const stored = await runCampaignBackupRequest(indexedDb, "readonly", (store) => store.get(key));
    if (stored === null || stored === undefined || stored === "") {
      return createRawCandidate(CAMPAIGN_STORAGE_SOURCES.INDEXED_DB, key, "missing");
    }
    return createRawCandidate(CAMPAIGN_STORAGE_SOURCES.INDEXED_DB, key, "present", stored);
  } catch (error) {
    return createRawCandidate(
      CAMPAIGN_STORAGE_SOURCES.INDEXED_DB,
      key,
      "read-error",
      "",
      describeStorageError(error, "Could not read IndexedDB campaign save"),
    );
  }
}

export async function readCampaignStorageCandidates({ storage, indexedDb, key }) {
  const localStorageCandidate = readLocalCampaignCandidate(storage, key);
  const indexedDbCandidate = await readIndexedDbCampaignCandidate(indexedDb, key);
  return {
    localStorage: localStorageCandidate,
    indexedDB: indexedDbCandidate,
  };
}

function normalizeValidationResult(result) {
  if (result && typeof result === "object" && typeof result.status === "string") {
    const valid = result.status === "valid";
    return {
      valid,
      value: result.save ?? result.value,
      metadata: {
        revision: result.revision,
        updatedAt: result.updatedAt,
      },
      reason: valid ? "" : String(result.reason ?? result.status),
      details: result,
    };
  }
  if (result && typeof result === "object" && hasOwn(result, "valid")) {
    return {
      valid: result.valid === true,
      value: result.save ?? result.value,
      metadata: result.metadata,
      reason: result.valid === true ? "" : String(result.reason ?? "Campaign save validation failed"),
      details: result,
    };
  }
  if (result === true) return { valid: true, value: undefined, metadata: undefined, reason: "", details: result };
  if (result === false || result === null || result === undefined) {
    return {
      valid: false,
      value: undefined,
      metadata: undefined,
      reason: "Campaign save validation failed",
      details: result,
    };
  }
  return { valid: true, value: result, metadata: undefined, reason: "", details: result };
}

function metadataFromValue(value) {
  if (!value || typeof value !== "object") return {};
  return {
    revision: value.revision,
    updatedAt: value.updatedAt,
  };
}

function normalizeCandidateMetadata(metadata) {
  const revision = Number.isInteger(metadata?.revision) && metadata.revision >= 0
    ? metadata.revision
    : 0;
  const rawUpdatedAt = metadata?.updatedAt;
  const updatedAtMs = typeof rawUpdatedAt === "number" && Number.isFinite(rawUpdatedAt)
    ? rawUpdatedAt
    : typeof rawUpdatedAt === "string" && rawUpdatedAt
      ? Date.parse(rawUpdatedAt)
      : 0;
  return {
    revision,
    updatedAt: rawUpdatedAt ?? "",
    updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : 0,
  };
}

/**
 * Validates one raw candidate without importing campaign.js.
 *
 * validate(serialized, context) may return a boolean, a parsed value, a
 * { valid, value/save, metadata, reason } object, or campaign.js' planned
 * { status, save, revision, updatedAt, reason } inspection result.
 * deserialize(serialized, context) is optional and runs after validation when
 * the validator did not already return a parsed value.
 * getMetadata(value, context) may override revision/updatedAt extraction.
 */
export function validateCampaignStorageCandidate(candidate, {
  validate,
  deserialize,
  getMetadata,
} = {}) {
  const rawState = candidate?.state ?? "unavailable";
  if (rawState !== "present") {
    return {
      ...candidate,
      rawState,
      state: rawState,
      valid: false,
      value: undefined,
      metadata: normalizeCandidateMetadata(),
      sourceSchemaVersion: undefined,
      reason: candidate?.error?.message ?? (rawState === "missing" ? "Campaign save is missing" : "Campaign save is unavailable"),
    };
  }
  if (typeof candidate.raw !== "string") {
    return {
      ...candidate,
      rawState,
      state: "corrupt",
      valid: false,
      value: undefined,
      metadata: normalizeCandidateMetadata(),
      sourceSchemaVersion: undefined,
      reason: "Campaign save is not serialized text",
    };
  }
  if (typeof validate !== "function" && typeof deserialize !== "function") {
    throw new TypeError("validate or deserialize callback is required");
  }

  const context = {
    source: candidate.source,
    key: candidate.key,
    serialized: candidate.raw,
  };
  try {
    let validation = typeof validate === "function"
      ? normalizeValidationResult(validate(candidate.raw, context))
      : { valid: true, value: undefined, metadata: undefined, reason: "", details: undefined };
    if (!validation.valid) {
      return {
        ...candidate,
        rawState,
        state: "corrupt",
        valid: false,
        value: validation.value,
        metadata: normalizeCandidateMetadata(validation.metadata),
        sourceSchemaVersion: validation.details?.sourceSchemaVersion,
        reason: validation.reason,
        validation: validation.details,
      };
    }

    let value = validation.value;
    if (value === undefined && typeof deserialize === "function") {
      value = deserialize(candidate.raw, context);
      if (value === null || value === undefined) {
        validation = {
          ...validation,
          valid: false,
          reason: "Campaign save deserialization failed",
        };
      }
    }
    if (!validation.valid) {
      return {
        ...candidate,
        rawState,
        state: "corrupt",
        valid: false,
        value,
        metadata: normalizeCandidateMetadata(validation.metadata),
        sourceSchemaVersion: validation.details?.sourceSchemaVersion,
        reason: validation.reason,
        validation: validation.details,
      };
    }

    const metadata = typeof getMetadata === "function"
      ? getMetadata(value, context)
      : validation.metadata ?? metadataFromValue(value);
    return {
      ...candidate,
      rawState,
      state: "valid",
      valid: true,
      value,
      metadata: normalizeCandidateMetadata(metadata),
      sourceSchemaVersion: validation.details?.sourceSchemaVersion ?? value?.schemaVersion,
      reason: "",
      validation: validation.details,
    };
  } catch (error) {
    return {
      ...candidate,
      rawState,
      state: "corrupt",
      valid: false,
      value: undefined,
      metadata: normalizeCandidateMetadata(),
      sourceSchemaVersion: undefined,
      reason: describeStorageError(error, "Campaign save validation failed").message,
    };
  }
}

export function compareCampaignCandidateFreshness(left, right) {
  const revisionDifference = (left?.metadata?.revision ?? 0) - (right?.metadata?.revision ?? 0);
  if (revisionDifference !== 0) return revisionDifference;
  return (left?.metadata?.updatedAtMs ?? 0) - (right?.metadata?.updatedAtMs ?? 0);
}

function candidatesAsArray(candidates) {
  if (Array.isArray(candidates)) return candidates;
  return [
    candidates?.localStorage
      ?? createRawCandidate(CAMPAIGN_STORAGE_SOURCES.LOCAL_STORAGE, "", "unavailable"),
    candidates?.indexedDB
      ?? createRawCandidate(CAMPAIGN_STORAGE_SOURCES.INDEXED_DB, "", "unavailable"),
  ];
}

function candidateWithSourcePriority(left, right) {
  const freshness = compareCampaignCandidateFreshness(left, right);
  if (freshness !== 0) return freshness > 0 ? left : right;
  if (left.source === CAMPAIGN_STORAGE_SOURCES.LOCAL_STORAGE) return left;
  if (right.source === CAMPAIGN_STORAGE_SOURCES.LOCAL_STORAGE) return right;
  return left;
}

/**
 * Pure candidate resolution. No storage is changed here.
 */
export function resolveCampaignStorageCandidates(candidates, callbacks = {}) {
  const inspected = candidatesAsArray(candidates).map((candidate) => (
    validateCampaignStorageCandidate(candidate, callbacks)
  ));
  const local = inspected.find((candidate) => candidate.source === CAMPAIGN_STORAGE_SOURCES.LOCAL_STORAGE);
  const indexed = inspected.find((candidate) => candidate.source === CAMPAIGN_STORAGE_SOURCES.INDEXED_DB);
  const validCandidates = inspected.filter((candidate) => candidate.valid);
  const corruptCandidates = inspected
    .filter((candidate) => candidate.state === "corrupt")
    .map((candidate) => ({
      source: candidate.source,
      raw: candidate.raw,
      reason: candidate.reason,
      metadata: candidate.metadata,
    }));
  const unreadableSources = inspected
    .filter((candidate) => candidate.rawState === "unavailable" || candidate.rawState === "read-error")
    .map((candidate) => candidate.source);
  const base = {
    source: null,
    localValid: local?.valid === true,
    indexedDbValid: indexed?.valid === true,
    serialized: "",
    value: undefined,
    metadata: normalizeCandidateMetadata(),
    sourceSchemaVersion: undefined,
    candidates: inspected,
    corruptCandidates,
    unreadableSources,
    writeBlockedSources: unreadableSources,
    repairSources: [],
    recoveryNeeded: false,
    recoveryReason: "",
    bothCorrupt: local?.state === "corrupt" && indexed?.state === "corrupt",
    conflict: false,
  };

  if (validCandidates.length === 0) {
    if (corruptCandidates.length > 0) {
      return {
        ...base,
        status: "recovery-needed",
        recoveryNeeded: true,
        recoveryReason: base.bothCorrupt ? "both-corrupt" : "corrupt-without-valid-candidate",
      };
    }
    const allMissing = inspected.every((candidate) => candidate.rawState === "missing");
    const hasUnreadableCandidate = inspected.some((candidate) => (
      candidate.rawState === "unavailable" || candidate.rawState === "read-error"
    ));
    return {
      ...base,
      status: allMissing ? "empty" : "unavailable",
      recoveryNeeded: !allMissing && hasUnreadableCandidate,
      recoveryReason: allMissing ? "" : "unreadable-without-valid-candidate",
    };
  }

  let selected = validCandidates[0];
  for (const candidate of validCandidates.slice(1)) {
    selected = candidateWithSourcePriority(selected, candidate);
  }
  const equalFreshnessConflict = validCandidates.some((candidate) => (
    candidate !== selected
      && compareCampaignCandidateFreshness(candidate, selected) === 0
      && candidate.serialized !== selected.serialized
  ));
  if (equalFreshnessConflict) {
    return {
      ...base,
      status: "recovery-needed",
      recoveryNeeded: true,
      recoveryReason: "equal-freshness-conflict",
      conflict: true,
      candidates: inspected,
    };
  }

  const repairSources = inspected
    .filter((candidate) => (
      candidate.source !== selected.source
        && (
          candidate.rawState === "missing"
          || candidate.state === "corrupt"
          || (candidate.valid && candidate.serialized !== selected.serialized)
        )
    ))
    .map((candidate) => candidate.source);
  return {
    ...base,
    status: unreadableSources.length > 0 ? "recovery-needed" : "ready",
    source: selected.source,
    serialized: selected.serialized,
    value: selected.value,
    metadata: selected.metadata,
    sourceSchemaVersion: selected.sourceSchemaVersion,
    candidates: inspected,
    corruptCandidates,
    repairSources,
    recoveryNeeded: repairSources.length > 0 || unreadableSources.length > 0,
    recoveryReason: unreadableSources.length > 0
      ? "replica-unreadable"
      : repairSources.length > 0
        ? "replica-missing-corrupt-or-stale"
        : "",
  };
}

/**
 * Re-reads sources that were unavailable during hydration before an explicit
 * recovery choice is allowed to write anything. A newly revealed, different
 * valid save must be shown to the player as a candidate instead of being
 * overwritten by the previously visible peer.
 */
export async function preflightUnreadableCampaignRecovery({
  storage,
  indexedDb,
  key,
  selectedSerialized,
  validate,
  deserialize,
  getMetadata,
}) {
  const candidates = await readCampaignStorageCandidates({ storage, indexedDb, key });
  const resolution = resolveCampaignStorageCandidates(candidates, {
    validate,
    deserialize,
    getMetadata,
  });
  const stillUnreadable = resolution.candidates.filter((candidate) => (
    candidate.rawState === "unavailable" || candidate.rawState === "read-error"
  ));
  if (stillUnreadable.length > 0) {
    return {
      status: "blocked",
      reason: "replica-still-unreadable",
      resolution,
      unreadableSources: stillUnreadable.map((candidate) => candidate.source),
    };
  }
  const revealedDifferentCandidates = resolution.candidates.filter((candidate) => (
    candidate.valid === true && candidate.serialized !== selectedSerialized
  ));
  if (revealedDifferentCandidates.length > 0) {
    return {
      status: "refresh-required",
      reason: "revealed-replica-conflict",
      resolution,
      revealedDifferentCandidates,
    };
  }
  return {
    status: "ready",
    reason: "",
    resolution,
    revealedDifferentCandidates: [],
  };
}

export function campaignSnapshotKey(key, kind) {
  if (!Object.values(CAMPAIGN_SNAPSHOT_KINDS).includes(kind)) {
    throw new TypeError(`Unknown campaign snapshot kind: ${kind}`);
  }
  return `${key}::${kind}`;
}

export function preMigrationCampaignSaveKey(key) {
  return campaignSnapshotKey(key, CAMPAIGN_SNAPSHOT_KINDS.PRE_MIGRATION);
}

export function lastKnownGoodCampaignSaveKey(key) {
  return campaignSnapshotKey(key, CAMPAIGN_SNAPSHOT_KINDS.LAST_KNOWN_GOOD);
}

export async function writeCampaignRecoverySnapshot({
  storage,
  indexedDb,
  key,
  kind,
  serialized,
}) {
  if (typeof serialized !== "string" || !serialized) {
    return {
      status: "rejected",
      key: campaignSnapshotKey(key, kind),
      kind,
      localStorage: false,
      indexedDB: false,
      saved: false,
      reason: "A non-empty serialized campaign save is required",
    };
  }
  const snapshotKey = campaignSnapshotKey(key, kind);
  const localSaved = writeCampaignSave(storage, snapshotKey, serialized);
  const indexedDbSaved = await writeCampaignBackup(indexedDb, snapshotKey, serialized);
  return {
    status: localSaved || indexedDbSaved ? "saved" : "unavailable",
    key: snapshotKey,
    kind,
    localStorage: localSaved,
    indexedDB: indexedDbSaved,
    saved: localSaved || indexedDbSaved,
    reason: localSaved || indexedDbSaved ? "" : "Could not persist campaign recovery snapshot",
  };
}

export async function readCampaignRecoverySnapshot({
  storage,
  indexedDb,
  key,
  kind,
}) {
  return readCampaignStorageCandidates({
    storage,
    indexedDb,
    key: campaignSnapshotKey(key, kind),
  });
}

async function repairCampaignStorageResolution({
  storage,
  indexedDb,
  key,
  resolution,
  snapshotBeforeRepair,
}) {
  const snapshot = snapshotBeforeRepair
    ? await writeCampaignRecoverySnapshot({
      storage,
      indexedDb,
      key,
      kind: CAMPAIGN_SNAPSHOT_KINDS.LAST_KNOWN_GOOD,
      serialized: resolution.serialized,
    })
    : null;
  if (snapshotBeforeRepair && !snapshot?.saved) {
    return {
      snapshot,
      snapshotRequired: true,
      repairBlockedBySnapshot: true,
      repairResults: {},
      repairedSources: [],
      repairFailedSources: [],
      repairSkippedSources: [...resolution.repairSources],
    };
  }
  const repairResults = {};
  for (const source of resolution.repairSources) {
    if (source === CAMPAIGN_STORAGE_SOURCES.LOCAL_STORAGE) {
      repairResults[source] = writeCampaignSave(storage, key, resolution.serialized);
    } else if (source === CAMPAIGN_STORAGE_SOURCES.INDEXED_DB) {
      repairResults[source] = await writeCampaignBackup(indexedDb, key, resolution.serialized);
    }
  }
  const repairedSources = Object.entries(repairResults)
    .filter(([, saved]) => saved)
    .map(([source]) => source);
  const repairFailedSources = Object.entries(repairResults)
    .filter(([, saved]) => !saved)
    .map(([source]) => source);
  return {
    snapshot,
    snapshotRequired: false,
    repairBlockedBySnapshot: false,
    repairResults,
    repairedSources,
    repairFailedSources,
    repairSkippedSources: [],
  };
}

/**
 * Boundary API used during hydration. The two stores are always read and
 * validated independently. With repair enabled (the default), a valid newest
 * candidate repairs a missing, corrupt, or older replica after first archiving
 * the selected value as last-known-good.
 */
export async function reconcileCampaignStorage({
  storage,
  indexedDb,
  key,
  validate,
  deserialize,
  getMetadata,
  repair = true,
  snapshotBeforeRepair = true,
}) {
  const candidates = await readCampaignStorageCandidates({ storage, indexedDb, key });
  const resolution = resolveCampaignStorageCandidates(candidates, {
    validate,
    deserialize,
    getMetadata,
  });
  if (
    resolution.status !== "ready"
    || !repair
    || resolution.repairSources.length === 0
  ) {
    return {
      ...resolution,
      status: resolution.status === "ready" && resolution.repairSources.length > 0
        ? "recoverable"
        : resolution.status,
      repairedSources: [],
      repairFailedSources: [],
      repairResults: {},
      snapshot: null,
    };
  }

  const repaired = await repairCampaignStorageResolution({
    storage,
    indexedDb,
    key,
    resolution,
    snapshotBeforeRepair,
  });
  return {
    ...resolution,
    ...repaired,
    status: repaired.repairBlockedBySnapshot || repaired.repairFailedSources.length > 0
      ? "degraded"
      : "recovered",
    recoveryNeeded: repaired.repairBlockedBySnapshot || repaired.repairFailedSources.length > 0,
    recoveryReason: repaired.repairBlockedBySnapshot
      ? "snapshot-required"
      : repaired.repairFailedSources.length > 0
        ? "replica-repair-failed"
        : "replica-repaired",
  };
}

function exportTimestamp(value) {
  if (typeof value === "string" && value) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return new Date().toISOString();
}

export function createCampaignManualExport(serialized, {
  exportedAt,
  metadata,
} = {}) {
  if (typeof serialized !== "string" || !serialized) {
    throw new TypeError("A non-empty serialized campaign save is required");
  }
  return JSON.stringify({
    format: CAMPAIGN_EXPORT_FORMAT,
    version: CAMPAIGN_EXPORT_VERSION,
    exportedAt: exportTimestamp(exportedAt),
    metadata: metadata ?? null,
    serialized,
  }, null, 2);
}

export function parseCampaignManualImport(text, callbacks = {}) {
  if (typeof text !== "string" || !text.trim()) {
    return {
      status: "recovery-needed",
      source: CAMPAIGN_STORAGE_SOURCES.MANUAL,
      serialized: "",
      value: undefined,
      metadata: normalizeCandidateMetadata(),
      sourceSchemaVersion: undefined,
      raw: typeof text === "string" ? text : "",
      reason: "Manual backup is empty",
    };
  }
  const trimmed = text.trim();
  let serialized = trimmed;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed?.format === CAMPAIGN_EXPORT_FORMAT) {
      if (parsed.version !== CAMPAIGN_EXPORT_VERSION || typeof parsed.serialized !== "string") {
        throw new TypeError("Unsupported or malformed campaign export envelope");
      }
      serialized = parsed.serialized;
    } else if (typeof parsed === "string") {
      serialized = parsed;
    }
  } catch (error) {
    if (trimmed.includes(`"format"`) && trimmed.includes(CAMPAIGN_EXPORT_FORMAT)) {
      return {
        status: "recovery-needed",
        source: CAMPAIGN_STORAGE_SOURCES.MANUAL,
        serialized: "",
        value: undefined,
        metadata: normalizeCandidateMetadata(),
        sourceSchemaVersion: undefined,
        raw: trimmed,
        reason: describeStorageError(error, "Could not parse campaign export").message,
      };
    }
  }

  const inspected = validateCampaignStorageCandidate(
    createRawCandidate(CAMPAIGN_STORAGE_SOURCES.MANUAL, "", "present", serialized),
    callbacks,
  );
  return {
    status: inspected.valid ? "ready" : "recovery-needed",
    source: CAMPAIGN_STORAGE_SOURCES.MANUAL,
    serialized: inspected.valid ? inspected.serialized : "",
    value: inspected.value,
    metadata: inspected.metadata,
    sourceSchemaVersion: inspected.sourceSchemaVersion,
    raw: serialized,
    reason: inspected.reason,
    candidate: inspected,
  };
}

function rawForExport(raw) {
  if (typeof raw === "string") return raw;
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}

export function createCorruptCampaignRawExport(input, { exportedAt } = {}) {
  const providedCandidates = Array.isArray(input)
    ? input
    : input?.corruptCandidates ?? input?.candidates ?? [];
  const candidates = providedCandidates
    .filter((candidate) => candidate?.state === "corrupt" || hasOwn(candidate ?? {}, "reason"))
    .map((candidate) => ({
      source: candidate.source ?? "unknown",
      reason: String(candidate.reason ?? "Unknown corruption"),
      rawType: typeof candidate.raw,
      raw: rawForExport(candidate.raw),
    }));
  return JSON.stringify({
    format: CAMPAIGN_CORRUPT_EXPORT_FORMAT,
    version: CAMPAIGN_EXPORT_VERSION,
    exportedAt: exportTimestamp(exportedAt),
    candidates,
  }, null, 2);
}

export function removeCampaignSave(storage, key) {
  inMemoryCampaignSaves.delete(key);
  try {
    if (!storage?.removeItem || !storage?.getItem) return false;
    storage.removeItem(key);
    const remaining = storage.getItem(key);
    return remaining === null || remaining === undefined;
  } catch {
    return false;
  }
}

export async function deleteCampaignBackup(indexedDb, key) {
  try {
    if (!indexedDb?.open) return false;
    await runCampaignBackupRequest(indexedDb, "readwrite", (store) => store.delete(key));
    const remaining = await runCampaignBackupRequest(indexedDb, "readonly", (store) => store.get(key));
    return remaining === null || remaining === undefined;
  } catch {
    return false;
  }
}

function createExactStorageEntry(source, key, state, raw = undefined, error = null) {
  return { source, key, state, raw, error };
}

function readExactLocalStorageEntry(storage, key) {
  if (!storage?.getItem || !storage?.setItem || !storage?.removeItem) {
    return createExactStorageEntry(
      CAMPAIGN_STORAGE_SOURCES.LOCAL_STORAGE,
      key,
      "unavailable",
      undefined,
      { name: "UnavailableError", message: "localStorage cannot be read, written, and cleared" },
    );
  }
  try {
    const raw = storage.getItem(key);
    return raw === null || raw === undefined
      ? createExactStorageEntry(CAMPAIGN_STORAGE_SOURCES.LOCAL_STORAGE, key, "missing")
      : createExactStorageEntry(
        CAMPAIGN_STORAGE_SOURCES.LOCAL_STORAGE,
        key,
        "present",
        typeof raw === "string" ? raw : String(raw),
      );
  } catch (error) {
    return createExactStorageEntry(
      CAMPAIGN_STORAGE_SOURCES.LOCAL_STORAGE,
      key,
      "read-error",
      undefined,
      describeStorageError(error, "Could not preflight localStorage campaign entry"),
    );
  }
}

async function readExactIndexedDbEntry(indexedDb, key) {
  if (!indexedDb?.open) {
    return createExactStorageEntry(
      CAMPAIGN_STORAGE_SOURCES.INDEXED_DB,
      key,
      "unavailable",
      undefined,
      { name: "UnavailableError", message: "IndexedDB is unavailable" },
    );
  }
  try {
    const raw = await runCampaignBackupRequest(indexedDb, "readonly", (store) => store.get(key));
    return raw === null || raw === undefined
      ? createExactStorageEntry(CAMPAIGN_STORAGE_SOURCES.INDEXED_DB, key, "missing")
      : createExactStorageEntry(CAMPAIGN_STORAGE_SOURCES.INDEXED_DB, key, "present", raw);
  } catch (error) {
    return createExactStorageEntry(
      CAMPAIGN_STORAGE_SOURCES.INDEXED_DB,
      key,
      "read-error",
      undefined,
      describeStorageError(error, "Could not preflight IndexedDB campaign entry"),
    );
  }
}

async function readExactCampaignStorageEntries({ storage, indexedDb, keys }) {
  const entries = [];
  for (const candidateKey of keys) {
    // Read both stores even when one fails. A clear is allowed only after every
    // target entry has an independently captured rollback state.
    const local = readExactLocalStorageEntry(storage, candidateKey);
    const indexed = await readExactIndexedDbEntry(indexedDb, candidateKey);
    entries.push(local, indexed);
  }
  return entries;
}

function rawStorageValuesEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (
    left
    && right
    && typeof left === "object"
    && typeof right === "object"
  ) {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return false;
    }
  }
  return false;
}

function exactStorageEntriesMatch(actual, expected) {
  if (actual.state !== expected.state) return false;
  return expected.state !== "present" || rawStorageValuesEqual(actual.raw, expected.raw);
}

function restoreExactLocalStorageEntry(storage, expected) {
  const current = readExactLocalStorageEntry(storage, expected.key);
  if (exactStorageEntriesMatch(current, expected)) {
    if (expected.state === "present") {
      inMemoryCampaignSaves.set(
        expected.key,
        typeof expected.raw === "string" ? expected.raw : String(expected.raw ?? ""),
      );
    } else if (expected.state === "missing") {
      inMemoryCampaignSaves.delete(expected.key);
    }
    return true;
  }
  try {
    if (expected.state === "missing") {
      inMemoryCampaignSaves.delete(expected.key);
      storage.removeItem(expected.key);
    } else if (expected.state === "present") {
      const value = typeof expected.raw === "string" ? expected.raw : String(expected.raw ?? "");
      inMemoryCampaignSaves.set(expected.key, value);
      storage.setItem(expected.key, value);
    } else {
      return false;
    }
  } catch {
    return false;
  }
  return exactStorageEntriesMatch(readExactLocalStorageEntry(storage, expected.key), expected);
}

async function restoreExactIndexedDbEntry(indexedDb, expected) {
  const current = await readExactIndexedDbEntry(indexedDb, expected.key);
  if (exactStorageEntriesMatch(current, expected)) return true;
  try {
    if (expected.state === "missing") {
      await runCampaignBackupRequest(indexedDb, "readwrite", (store) => store.delete(expected.key));
    } else if (expected.state === "present") {
      await runCampaignBackupRequest(indexedDb, "readwrite", (store) => store.put(expected.raw, expected.key));
    } else {
      return false;
    }
  } catch {
    return false;
  }
  return exactStorageEntriesMatch(await readExactIndexedDbEntry(indexedDb, expected.key), expected);
}

function storageEntriesBySource(entries) {
  const result = {
    localStorage: {},
    indexedDB: {},
  };
  for (const entry of entries) {
    result[entry.source][entry.key] = {
      state: entry.state,
      raw: entry.raw,
      error: entry.error,
    };
  }
  return result;
}

export async function clearCampaignSaveEverywhere({
  storage,
  indexedDb,
  key,
  includeRecoverySnapshots = true,
}) {
  const keys = [
    key,
    ...(includeRecoverySnapshots
      ? [preMigrationCampaignSaveKey(key), lastKnownGoodCampaignSaveKey(key)]
      : []),
  ];
  const preflightEntries = await readExactCampaignStorageEntries({ storage, indexedDb, keys });
  const preflight = storageEntriesBySource(preflightEntries);
  const preflightFailures = preflightEntries
    .filter((entry) => entry.state === "unavailable" || entry.state === "read-error")
    .map((entry) => ({
      source: entry.source,
      key: entry.key,
      state: entry.state,
      error: entry.error,
    }));
  if (preflightFailures.length > 0) {
    return {
      status: "preflight-failed",
      cleared: false,
      keys,
      preflightSucceeded: false,
      preflightFailures,
      preflight,
      deletionSucceeded: false,
      localStorage: {},
      indexedDB: {},
      rollbackAttempted: false,
      rollbackSucceeded: null,
      rollback: null,
      verification: preflight,
    };
  }

  const localStorage = {};
  const indexedDB = {};
  let deletionFailure = null;
  for (const candidateKey of keys) {
    localStorage[candidateKey] = removeCampaignSave(storage, candidateKey);
    indexedDB[candidateKey] = await deleteCampaignBackup(indexedDb, candidateKey);
    if (!localStorage[candidateKey] || !indexedDB[candidateKey]) {
      deletionFailure = {
        key: candidateKey,
        localStorage: localStorage[candidateKey],
        indexedDB: indexedDB[candidateKey],
      };
      break;
    }
  }
  if (deletionFailure) {
    const rollbackLocalStorage = {};
    const rollbackIndexedDB = {};
    for (const entry of preflightEntries) {
      if (entry.source === CAMPAIGN_STORAGE_SOURCES.LOCAL_STORAGE) {
        rollbackLocalStorage[entry.key] = restoreExactLocalStorageEntry(storage, entry);
      } else {
        rollbackIndexedDB[entry.key] = await restoreExactIndexedDbEntry(indexedDb, entry);
      }
    }
    const verificationEntries = await readExactCampaignStorageEntries({ storage, indexedDb, keys });
    const expectedEntries = new Map(preflightEntries.map((entry) => [`${entry.source}:${entry.key}`, entry]));
    const verificationSucceeded = verificationEntries.every((entry) => {
      const expected = expectedEntries.get(`${entry.source}:${entry.key}`);
      return expected ? exactStorageEntriesMatch(entry, expected) : false;
    });
    const rollbackSucceeded = Object.values(rollbackLocalStorage).every(Boolean)
      && Object.values(rollbackIndexedDB).every(Boolean)
      && verificationSucceeded;
    return {
      status: rollbackSucceeded ? "rolled-back" : "rollback-failed",
      cleared: false,
      keys,
      preflightSucceeded: true,
      preflightFailures: [],
      preflight,
      deletionSucceeded: false,
      deletionFailure,
      localStorage,
      indexedDB,
      rollbackAttempted: true,
      rollbackSucceeded,
      rollback: {
        localStorage: rollbackLocalStorage,
        indexedDB: rollbackIndexedDB,
      },
      verification: storageEntriesBySource(verificationEntries),
    };
  }

  return {
    status: "cleared",
    cleared: true,
    keys,
    preflightSucceeded: true,
    preflightFailures: [],
    preflight,
    deletionSucceeded: true,
    localStorage,
    indexedDB,
    rollbackAttempted: false,
    rollbackSucceeded: null,
    rollback: null,
    verification: {
      localStorage: Object.fromEntries(keys.map((candidateKey) => [candidateKey, { state: "missing" }])),
      indexedDB: Object.fromEntries(keys.map((candidateKey) => [candidateKey, { state: "missing" }])),
    },
  };
}
