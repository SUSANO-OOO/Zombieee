import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultCampaignSave,
  inspectCampaignSaveCandidate,
  serializeCampaignSave,
} from "../app/campaign.js";
import {
  CAMPAIGN_CORRUPT_EXPORT_FORMAT,
  CAMPAIGN_EXPORT_FORMAT,
  CAMPAIGN_SNAPSHOT_KINDS,
  campaignStorageFor,
  clearCampaignSaveEverywhere,
  clearCampaignStorageFallback,
  createCampaignManualExport,
  createCorruptCampaignRawExport,
  indexedDbFor,
  lastKnownGoodCampaignSaveKey,
  parseCampaignManualImport,
  preMigrationCampaignSaveKey,
  preflightUnreadableCampaignRecovery,
  readCampaignBackup,
  readCampaignRecoverySnapshot,
  readCampaignSave,
  readCampaignStorageCandidates,
  reconcileCampaignStorage,
  resolveCampaignStorageCandidates,
  writeCampaignRecoverySnapshot,
  writeCampaignBackup,
  writeCampaignSave,
  writeCampaignSaveReplicas,
} from "../app/campaignStorage.js";

test("campaign storage accessor survives a localStorage getter SecurityError", () => {
  const windowLike = {};
  Object.defineProperty(windowLike, "localStorage", {
    get() { throw new DOMException("opaque origin", "SecurityError"); },
  });
  assert.equal(campaignStorageFor(windowLike), null);
  assert.equal(campaignStorageFor({ localStorage: { marker: true } }).marker, true);
});

test("campaign storage survives unavailable localStorage", () => {
  const key = "storage-unavailable";
  clearCampaignStorageFallback(key);
  const storage = {
    getItem() { throw new DOMException("denied", "SecurityError"); },
    setItem() { throw new DOMException("full", "QuotaExceededError"); },
  };

  assert.equal(readCampaignSave(storage, key), "");
  assert.equal(writeCampaignSave(storage, key, "{\"stage\":2}"), false);
  assert.equal(readCampaignSave(storage, key), "{\"stage\":2}");
});

test("campaign storage mirrors successful writes for later read failures", () => {
  const key = "storage-transient";
  clearCampaignStorageFallback(key);
  let value = "initial";
  let readable = true;
  const storage = {
    getItem() {
      if (!readable) throw new DOMException("denied", "SecurityError");
      return value;
    },
    setItem(_key, next) { value = next; },
  };

  assert.equal(readCampaignSave(storage, key), "initial");
  assert.equal(writeCampaignSave(storage, key, "next"), true);
  readable = false;
  assert.equal(readCampaignSave(storage, key), "next");
});

test("campaign storage rejects writes that cannot be read back", () => {
  const key = "storage-not-durable";
  clearCampaignStorageFallback(key);
  const storage = {
    getItem() { return null; },
    setItem() {},
  };

  assert.equal(writeCampaignSave(storage, key, "next"), false);
  assert.equal(readCampaignSave(storage, key), "next");
});

test("indexedDB accessor survives privacy-mode access errors", () => {
  const windowLike = {};
  Object.defineProperty(windowLike, "indexedDB", {
    get() { throw new DOMException("denied", "SecurityError"); },
  });
  assert.equal(indexedDbFor(windowLike), null);
  assert.equal(indexedDbFor({ indexedDB: { marker: true } }).marker, true);
});

function createFakeIndexedDb({ deleteFailures = new Set(), getFailures = new Set(), putFailures = new Set(), putCalls = null } = {}) {
  const values = new Map();
  let created = false;
  const database = {
    objectStoreNames: { contains() { return created; } },
    createObjectStore() { created = true; },
    close() {},
    transaction() {
      const listeners = new Map();
      const transaction = {
        error: null,
        addEventListener(name, listener) { listeners.set(name, listener); },
        objectStore() {
          return {
            get(key) {
              const request = { result: undefined, error: null, onsuccess: null, onerror: null };
              queueMicrotask(() => {
                if (getFailures.has(key)) {
                  request.error = new Error(`get failed for ${key}`);
                  request.onerror?.();
                  return;
                }
                request.result = values.get(key);
                request.onsuccess?.();
                listeners.get("complete")?.();
              });
              return request;
            },
            put(value, key) {
              const request = { result: undefined, error: null, onsuccess: null, onerror: null };
              queueMicrotask(() => {
                putCalls?.push(key);
                if (putFailures.has(key)) {
                  request.error = new Error(`put failed for ${key}`);
                  request.onerror?.();
                  return;
                }
                values.set(key, value);
                request.result = key;
                request.onsuccess?.();
                listeners.get("complete")?.();
              });
              return request;
            },
            delete(key) {
              const request = { result: undefined, error: null, onsuccess: null, onerror: null };
              queueMicrotask(() => {
                if (deleteFailures.has(key)) {
                  request.error = new Error(`delete failed for ${key}`);
                  request.onerror?.();
                  return;
                }
                values.delete(key);
                request.onsuccess?.();
                listeners.get("complete")?.();
              });
              return request;
            },
          };
        },
      };
      return transaction;
    },
  };
  return {
    open() {
      const request = { result: database, error: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };
      queueMicrotask(() => {
        if (!created) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
}

test("campaign backup writes and verifies an independent IndexedDB copy", async () => {
  const indexedDb = createFakeIndexedDb();
  assert.equal(await readCampaignBackup(indexedDb, "campaign"), "");
  assert.equal(await writeCampaignBackup(indexedDb, "campaign", "{\"supplies\":150}"), true);
  assert.equal(await readCampaignBackup(indexedDb, "campaign"), "{\"supplies\":150}");
});

test("campaign backup reports unavailable IndexedDB without throwing", async () => {
  assert.equal(await readCampaignBackup(null, "campaign"), "");
  assert.equal(await writeCampaignBackup(null, "campaign", "{}"), false);
});

function createFakeLocalStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

function serializedSave(revision, updatedAt, extra = {}) {
  return JSON.stringify({
    schemaVersion: 5,
    revision,
    updatedAt,
    integrity: "fnv1a32:test",
    ...extra,
  });
}

function inspectSerializedSave(raw) {
  try {
    const save = JSON.parse(raw);
    if (
      save?.schemaVersion !== 5
      || !Number.isInteger(save.revision)
      || typeof save.updatedAt !== "string"
      || typeof save.integrity !== "string"
    ) {
      return { status: "corrupt", reason: "invalid save shape" };
    }
    return {
      status: "valid",
      save,
      revision: save.revision,
      updatedAt: save.updatedAt,
      sourceSchemaVersion: save.schemaVersion,
    };
  } catch {
    return { status: "corrupt", reason: "invalid JSON" };
  }
}

test("campaign candidates are read and validated independently before newest selection", async () => {
  const key = "independent-candidates";
  const older = serializedSave(4, "2026-07-17T01:00:00.000Z", { marker: "local" });
  const newer = serializedSave(5, "2026-07-17T00:00:00.000Z", { marker: "indexed" });
  const storage = createFakeLocalStorage({ [key]: older });
  const indexedDb = createFakeIndexedDb();
  await writeCampaignBackup(indexedDb, key, newer);

  const candidates = await readCampaignStorageCandidates({ storage, indexedDb, key });
  const resolution = resolveCampaignStorageCandidates(candidates, {
    validate: inspectSerializedSave,
  });

  assert.equal(resolution.status, "ready");
  assert.equal(resolution.source, "indexedDB");
  assert.equal(resolution.localValid, true);
  assert.equal(resolution.indexedDbValid, true);
  assert.equal(resolution.serialized, newer);
  assert.equal(resolution.value.marker, "indexed");
  assert.equal(resolution.sourceSchemaVersion, 5);
  assert.deepEqual(resolution.repairSources, ["localStorage"]);
  assert.equal(resolution.recoveryNeeded, true);
});

test("an unreadable candidate plus a missing replica never becomes an empty fresh save", async () => {
  const key = "unreadable-plus-missing";
  const storage = {
    getItem() { throw new DOMException("temporarily denied", "SecurityError"); },
  };
  const resolution = resolveCampaignStorageCandidates(
    await readCampaignStorageCandidates({ storage, indexedDb: createFakeIndexedDb(), key }),
    { validate: inspectSerializedSave },
  );

  assert.equal(resolution.status, "unavailable");
  assert.equal(resolution.recoveryNeeded, true);
  assert.equal(resolution.recoveryReason, "unreadable-without-valid-candidate");
  assert.equal(resolution.serialized, "");
});

test("foreign legacy JSON plus a missing replica requires recovery and is never replicated", async () => {
  const key = "foreign-plus-missing";
  const foreign = JSON.stringify({ foo: "bar" });
  const storage = createFakeLocalStorage({ [key]: foreign });
  const indexedDb = createFakeIndexedDb();

  const result = await reconcileCampaignStorage({
    storage,
    indexedDb,
    key,
    validate: inspectCampaignSaveCandidate,
  });

  assert.equal(result.status, "recovery-needed");
  assert.equal(result.recoveryReason, "corrupt-without-valid-candidate");
  assert.deepEqual(result.repairedSources, []);
  assert.equal(storage.getItem(key), foreign);
  assert.equal(await readCampaignBackup(indexedDb, key), "");
});

test("a temporarily unreadable replica is write-blocked through passive persistence and keeps a hidden newer save", async () => {
  const key = "hidden-newer-local";
  const hiddenNewer = serializedSave(9, "2026-07-17T09:00:00.000Z", { marker: "hidden-newer" });
  const readableOlder = serializedSave(4, "2026-07-17T04:00:00.000Z", { marker: "readable-older" });
  const nextReadable = serializedSave(5, "2026-07-17T05:00:00.000Z", { marker: "next-readable" });
  const localSnapshotKey = lastKnownGoodCampaignSaveKey(key);
  const hiddenSnapshot = serializedSave(8, "2026-07-17T08:00:00.000Z", { marker: "hidden-snapshot" });
  const localValues = new Map([[key, hiddenNewer], [localSnapshotKey, hiddenSnapshot]]);
  let primaryReads = 0;
  let primaryWrites = 0;
  const storage = {
    getItem(candidateKey) {
      if (candidateKey === key) {
        primaryReads += 1;
        if (primaryReads === 1) throw new DOMException("temporary read failure", "SecurityError");
      }
      return localValues.get(candidateKey) ?? null;
    },
    setItem(candidateKey, value) {
      if (candidateKey === key) {
        primaryWrites += 1;
      }
      localValues.set(candidateKey, String(value));
    },
    removeItem() {},
  };
  const indexedDb = createFakeIndexedDb();
  await writeCampaignBackup(indexedDb, key, readableOlder);

  const reconciled = await reconcileCampaignStorage({
    storage,
    indexedDb,
    key,
    validate: inspectSerializedSave,
  });

  assert.equal(reconciled.status, "recovery-needed");
  assert.equal(reconciled.source, "indexedDB");
  assert.equal(reconciled.recoveryReason, "replica-unreadable");
  assert.deepEqual(reconciled.repairSources, []);
  assert.deepEqual(reconciled.writeBlockedSources, ["localStorage"]);
  assert.equal(primaryWrites, 0);

  const revealed = await preflightUnreadableCampaignRecovery({
    storage,
    indexedDb,
    key,
    selectedSerialized: reconciled.serialized,
    validate: inspectSerializedSave,
  });
  assert.equal(revealed.status, "refresh-required");
  assert.equal(revealed.reason, "revealed-replica-conflict");
  assert.equal(revealed.revealedDifferentCandidates[0].serialized, hiddenNewer);
  assert.equal(primaryWrites, 0);
  assert.equal(localValues.get(key), hiddenNewer);
  assert.equal(localValues.get(localSnapshotKey), hiddenSnapshot);

  const passive = await writeCampaignSaveReplicas({
    storage,
    indexedDb,
    key,
    serialized: reconciled.serialized,
    blockedSources: reconciled.writeBlockedSources,
    alreadySavedSources: ["indexedDB"],
  });
  assert.equal(passive.localSaved, false);
  assert.equal(passive.backupSaved, true);
  assert.equal(primaryWrites, 0);
  assert.equal(localValues.get(key), hiddenNewer);
  assert.equal(localValues.get(localSnapshotKey), hiddenSnapshot);

  const laterSave = await writeCampaignSaveReplicas({
    storage,
    indexedDb,
    key,
    serialized: nextReadable,
    blockedSources: reconciled.writeBlockedSources,
  });
  assert.equal(laterSave.localSaved, false);
  assert.equal(laterSave.backupSaved, true);
  assert.equal(primaryWrites, 0);
  assert.equal(localValues.get(key), hiddenNewer);
  assert.equal(localValues.get(localSnapshotKey), hiddenSnapshot);
  assert.equal(await readCampaignBackup(indexedDb, key), nextReadable);
});

test("unreadable recovery preflight performs no trial write when verification reads still fail", async () => {
  const key = "unreadable-preflight-no-write";
  const snapshotKey = lastKnownGoodCampaignSaveKey(key);
  const hiddenPrimary = serializedSave(9, "2026-07-17T09:00:00.000Z", { marker: "hidden-primary" });
  const hiddenSnapshot = serializedSave(8, "2026-07-17T08:00:00.000Z", { marker: "hidden-snapshot" });
  const selected = serializedSave(4, "2026-07-17T04:00:00.000Z", { marker: "selected" });
  const values = new Map([[key, hiddenPrimary], [snapshotKey, hiddenSnapshot]]);
  let writes = 0;
  const storage = {
    getItem(candidateKey) {
      if (candidateKey === key) throw new DOMException("still denied", "SecurityError");
      return values.get(candidateKey) ?? null;
    },
    setItem(candidateKey, value) {
      writes += 1;
      values.set(candidateKey, String(value));
    },
    removeItem() {},
  };
  const indexedDb = createFakeIndexedDb();
  await writeCampaignBackup(indexedDb, key, selected);

  const result = await preflightUnreadableCampaignRecovery({
    storage,
    indexedDb,
    key,
    selectedSerialized: selected,
    validate: inspectSerializedSave,
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "replica-still-unreadable");
  assert.deepEqual(result.unreadableSources, ["localStorage"]);
  assert.equal(writes, 0, "preflight must not probe writability with setItem");
  assert.equal(values.get(key), hiddenPrimary);
  assert.equal(values.get(snapshotKey), hiddenSnapshot);
  assert.equal(await readCampaignBackup(indexedDb, key), selected);
});

test("unreadable recovery preflight blocks when a previously readable peer becomes unreadable", async () => {
  const key = "preflight-new-unreadable-peer";
  const selected = serializedSave(4, "2026-07-17T04:00:00.000Z", { marker: "selected" });
  let localWrites = 0;
  const storage = {
    getItem() { return null; },
    setItem() { localWrites += 1; },
    removeItem() {},
  };
  const getFailures = new Set();
  const putCalls = [];
  const indexedDb = createFakeIndexedDb({ getFailures, putCalls });
  await writeCampaignBackup(indexedDb, key, selected);
  const putsBeforePreflight = putCalls.length;
  getFailures.add(key);

  const result = await preflightUnreadableCampaignRecovery({
    storage,
    indexedDb,
    key,
    selectedSerialized: selected,
    validate: inspectSerializedSave,
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "replica-still-unreadable");
  assert.deepEqual(result.unreadableSources, ["indexedDB"]);
  assert.equal(localWrites, 0);
  assert.equal(putCalls.length, putsBeforePreflight, "preflight must not write to a newly unreadable peer");
});

test("unreadable recovery preflight refreshes when the previously selected peer changes before adoption", async () => {
  const key = "preflight-selected-peer-changed";
  const originallySelected = serializedSave(4, "2026-07-17T04:00:00.000Z", { marker: "original" });
  const changedPeer = serializedSave(6, "2026-07-17T06:00:00.000Z", { marker: "changed" });
  let localWrites = 0;
  const storage = {
    getItem() { return null; },
    setItem() { localWrites += 1; },
    removeItem() {},
  };
  const putCalls = [];
  const indexedDb = createFakeIndexedDb({ putCalls });
  await writeCampaignBackup(indexedDb, key, changedPeer);
  const putsBeforePreflight = putCalls.length;

  const result = await preflightUnreadableCampaignRecovery({
    storage,
    indexedDb,
    key,
    selectedSerialized: originallySelected,
    validate: inspectSerializedSave,
  });

  assert.equal(result.status, "refresh-required");
  assert.equal(result.reason, "revealed-replica-conflict");
  assert.equal(result.revealedDifferentCandidates[0].serialized, changedPeer);
  assert.equal(localWrites, 0);
  assert.equal(putCalls.length, putsBeforePreflight);
});

test("a missing local replica plus unavailable IndexedDB never authorizes initialization", async () => {
  const key = "missing-plus-unavailable";
  const resolution = resolveCampaignStorageCandidates(
    await readCampaignStorageCandidates({ storage: createFakeLocalStorage(), indexedDb: null, key }),
    { validate: inspectSerializedSave },
  );

  assert.equal(resolution.status, "unavailable");
  assert.equal(resolution.recoveryNeeded, true);
  assert.equal(resolution.recoveryReason, "unreadable-without-valid-candidate");
});

test("updatedAt breaks revision ties while equal-freshness divergent saves require recovery", async () => {
  const key = "freshness-tie";
  const earlier = serializedSave(8, "2026-07-17T01:00:00.000Z", { marker: "earlier" });
  const later = serializedSave(8, "2026-07-17T02:00:00.000Z", { marker: "later" });
  const storage = createFakeLocalStorage({ [key]: earlier });
  const indexedDb = createFakeIndexedDb();
  await writeCampaignBackup(indexedDb, key, later);

  const candidates = await readCampaignStorageCandidates({ storage, indexedDb, key });
  const selected = resolveCampaignStorageCandidates(candidates, { validate: inspectSerializedSave });
  assert.equal(selected.source, "indexedDB");
  assert.equal(selected.serialized, later);

  const equalTime = serializedSave(8, "2026-07-17T02:00:00.000Z", { marker: "different" });
  storage.setItem(key, equalTime);
  const conflicted = resolveCampaignStorageCandidates(
    await readCampaignStorageCandidates({ storage, indexedDb, key }),
    { validate: inspectSerializedSave },
  );
  assert.equal(conflicted.status, "recovery-needed");
  assert.equal(conflicted.conflict, true);
  assert.equal(conflicted.recoveryReason, "equal-freshness-conflict");
  assert.equal(conflicted.serialized, "");
});

test("a valid IndexedDB candidate repairs corrupt localStorage and preserves raw evidence", async () => {
  const key = "repair-local";
  const valid = serializedSave(9, "2026-07-17T03:00:00.000Z", { marker: "durable" });
  const corrupt = "{\"schemaVersion\":5";
  const storage = createFakeLocalStorage({ [key]: corrupt });
  const indexedDb = createFakeIndexedDb();
  await writeCampaignBackup(indexedDb, key, valid);

  const resolution = await reconcileCampaignStorage({
    storage,
    indexedDb,
    key,
    validate: inspectSerializedSave,
  });

  assert.equal(resolution.status, "recovered");
  assert.equal(resolution.source, "indexedDB");
  assert.equal(resolution.localValid, false);
  assert.equal(resolution.indexedDbValid, true);
  assert.deepEqual(resolution.repairedSources, ["localStorage"]);
  assert.equal(resolution.corruptCandidates[0].source, "localStorage");
  assert.equal(resolution.corruptCandidates[0].raw, corrupt);
  assert.equal(storage.getItem(key), valid);
  assert.equal(storage.getItem(lastKnownGoodCampaignSaveKey(key)), valid);
  assert.equal(await readCampaignBackup(indexedDb, lastKnownGoodCampaignSaveKey(key)), valid);
});

test("a valid localStorage candidate repairs corrupt IndexedDB", async () => {
  const key = "repair-indexed";
  const valid = serializedSave(10, "2026-07-17T04:00:00.000Z", { marker: "local" });
  const storage = createFakeLocalStorage({ [key]: valid });
  const indexedDb = createFakeIndexedDb();
  await writeCampaignBackup(indexedDb, key, "not-json");

  const resolution = await reconcileCampaignStorage({
    storage,
    indexedDb,
    key,
    validate: inspectSerializedSave,
  });

  assert.equal(resolution.status, "recovered");
  assert.equal(resolution.source, "localStorage");
  assert.equal(resolution.localValid, true);
  assert.equal(resolution.indexedDbValid, false);
  assert.deepEqual(resolution.repairedSources, ["indexedDB"]);
  assert.equal(await readCampaignBackup(indexedDb, key), valid);
});

test("a valid candidate repairs a missing replica in either direction", async () => {
  for (const source of ["localStorage", "indexedDB"]) {
    const key = `repair-missing-${source}`;
    const valid = serializedSave(10, "2026-07-17T04:30:00.000Z", { source });
    const storage = createFakeLocalStorage(source === "localStorage" ? { [key]: valid } : {});
    const indexedDb = createFakeIndexedDb();
    if (source === "indexedDB") await writeCampaignBackup(indexedDb, key, valid);

    const resolution = await reconcileCampaignStorage({
      storage,
      indexedDb,
      key,
      validate: inspectSerializedSave,
    });

    assert.equal(resolution.status, "recovered");
    assert.equal(resolution.source, source);
    assert.equal(storage.getItem(key), valid);
    assert.equal(await readCampaignBackup(indexedDb, key), valid);
  }
});

test("a failed replica repair reports degraded durability without losing the selected save", async () => {
  const key = "repair-degraded";
  const valid = serializedSave(10, "2026-07-17T04:45:00.000Z");
  const storage = {
    getItem() { return null; },
    setItem() { throw new DOMException("full", "QuotaExceededError"); },
    removeItem() {},
  };
  const indexedDb = createFakeIndexedDb();
  await writeCampaignBackup(indexedDb, key, valid);

  const resolution = await reconcileCampaignStorage({
    storage,
    indexedDb,
    key,
    validate: inspectSerializedSave,
  });

  assert.equal(resolution.status, "degraded");
  assert.equal(resolution.source, "indexedDB");
  assert.equal(resolution.serialized, valid);
  assert.deepEqual(resolution.repairFailedSources, ["localStorage"]);
  assert.equal(await readCampaignBackup(indexedDb, key), valid);
});

test("replica repair never overwrites a stale or corrupt replica when every last-known-good snapshot write fails", async () => {
  for (const variant of ["stale", "corrupt"]) {
    const key = `repair-snapshot-required-${variant}`;
    const snapshotKey = lastKnownGoodCampaignSaveKey(key);
    const replicaRaw = variant === "stale"
      ? serializedSave(9, "2026-07-17T04:40:00.000Z", { marker: "stale-local" })
      : "{corrupt-local";
    const selectedRaw = serializedSave(10, "2026-07-17T04:45:00.000Z", { marker: "new-indexed" });
    const storage = createFakeLocalStorage({ [key]: replicaRaw });
    const setItem = storage.setItem.bind(storage);
    storage.setItem = (candidateKey, value) => {
      if (candidateKey === snapshotKey) throw new DOMException("full", "QuotaExceededError");
      setItem(candidateKey, value);
    };
    const indexedDb = createFakeIndexedDb({ putFailures: new Set([snapshotKey]) });
    await writeCampaignBackup(indexedDb, key, selectedRaw);

    const resolution = await reconcileCampaignStorage({
      storage,
      indexedDb,
      key,
      validate: inspectSerializedSave,
    });

    assert.equal(resolution.status, "degraded");
    assert.equal(resolution.recoveryReason, "snapshot-required");
    assert.equal(resolution.snapshotRequired, true);
    assert.equal(resolution.repairBlockedBySnapshot, true);
    assert.equal(resolution.snapshot.saved, false);
    assert.deepEqual(resolution.repairedSources, []);
    assert.deepEqual(resolution.repairFailedSources, []);
    assert.deepEqual(resolution.repairSkippedSources, ["localStorage"]);
    assert.equal(storage.getItem(key), replicaRaw);
    assert.equal(await readCampaignBackup(indexedDb, key), selectedRaw);
  }
});

test("both corrupt candidates block silent reset and remain exportable without mutation", async () => {
  const key = "both-corrupt";
  const localRaw = "{local-broken";
  const indexedRaw = "{indexed-broken";
  const storage = createFakeLocalStorage({ [key]: localRaw });
  const indexedDb = createFakeIndexedDb();
  await writeCampaignBackup(indexedDb, key, indexedRaw);

  const resolution = await reconcileCampaignStorage({
    storage,
    indexedDb,
    key,
    validate: inspectSerializedSave,
  });

  assert.equal(resolution.status, "recovery-needed");
  assert.equal(resolution.bothCorrupt, true);
  assert.equal(resolution.serialized, "");
  assert.equal(resolution.corruptCandidates.length, 2);
  assert.equal(storage.getItem(key), localRaw);
  assert.equal(await readCampaignBackup(indexedDb, key), indexedRaw);

  const rawExport = JSON.parse(createCorruptCampaignRawExport(resolution, {
    exportedAt: "2026-07-17T05:00:00.000Z",
  }));
  assert.equal(rawExport.format, CAMPAIGN_CORRUPT_EXPORT_FORMAT);
  assert.deepEqual(rawExport.candidates.map(({ source, raw }) => ({ source, raw })), [
    { source: "localStorage", raw: localRaw },
    { source: "indexedDB", raw: indexedRaw },
  ]);
});

test("pre-migration and last-known-good snapshots use separate independently readable keys", async () => {
  const key = "snapshots";
  const legacy = JSON.stringify({ schemaVersion: 4, caps: 20 });
  const current = serializedSave(11, "2026-07-17T06:00:00.000Z");
  const storage = createFakeLocalStorage();
  const indexedDb = createFakeIndexedDb();

  const preMigration = await writeCampaignRecoverySnapshot({
    storage,
    indexedDb,
    key,
    kind: CAMPAIGN_SNAPSHOT_KINDS.PRE_MIGRATION,
    serialized: legacy,
  });
  const lastGood = await writeCampaignRecoverySnapshot({
    storage,
    indexedDb,
    key,
    kind: CAMPAIGN_SNAPSHOT_KINDS.LAST_KNOWN_GOOD,
    serialized: current,
  });

  assert.equal(preMigration.saved, true);
  assert.equal(lastGood.saved, true);
  assert.equal(preMigrationCampaignSaveKey(key), `${key}::pre-migration`);
  assert.equal(lastKnownGoodCampaignSaveKey(key), `${key}::last-known-good`);
  assert.equal(storage.getItem(preMigrationCampaignSaveKey(key)), legacy);
  assert.equal(await readCampaignBackup(indexedDb, lastKnownGoodCampaignSaveKey(key)), current);

  const snapshotCandidates = await readCampaignRecoverySnapshot({
    storage,
    indexedDb,
    key,
    kind: CAMPAIGN_SNAPSHOT_KINDS.PRE_MIGRATION,
  });
  assert.equal(snapshotCandidates.localStorage.serialized, legacy);
  assert.equal(snapshotCandidates.indexedDB.serialized, legacy);
});

test("manual export and import are pure and accept campaign inspection callbacks", () => {
  const serialized = serializedSave(12, "2026-07-17T07:00:00.000Z", { caps: 42 });
  const exported = createCampaignManualExport(serialized, {
    exportedAt: "2026-07-17T07:30:00.000Z",
    metadata: { slot: "manual" },
  });
  const envelope = JSON.parse(exported);
  assert.equal(envelope.format, CAMPAIGN_EXPORT_FORMAT);
  assert.equal(envelope.serialized, serialized);

  const imported = parseCampaignManualImport(exported, { validate: inspectSerializedSave });
  assert.equal(imported.status, "ready");
  assert.equal(imported.serialized, serialized);
  assert.equal(imported.value.caps, 42);
  assert.equal(imported.metadata.revision, 12);
  assert.equal(imported.sourceSchemaVersion, 5);

  const rawImported = parseCampaignManualImport(serialized, { validate: inspectSerializedSave });
  assert.equal(rawImported.status, "ready");
  assert.equal(rawImported.serialized, serialized);

  const corrupt = parseCampaignManualImport("{broken", { validate: inspectSerializedSave });
  assert.equal(corrupt.status, "recovery-needed");
  assert.equal(corrupt.serialized, "");
  assert.equal(corrupt.raw, "{broken");
});

test("strict campaign inspection rejects a checksum-tampered manual import without mutating storage", () => {
  const key = "strict-import";
  const serialized = serializeCampaignSave(createDefaultCampaignSave());
  const parsed = JSON.parse(serialized);
  const tampered = JSON.stringify({ ...parsed, caps: parsed.caps + 999 });
  const storage = createFakeLocalStorage({ [key]: serialized });

  const imported = parseCampaignManualImport(tampered, {
    validate: inspectCampaignSaveCandidate,
  });

  assert.equal(imported.status, "recovery-needed");
  assert.equal(imported.reason, "integrity-mismatch");
  assert.equal(imported.serialized, "");
  assert.equal(storage.getItem(key), serialized);

  const foreign = parseCampaignManualImport(JSON.stringify({ foo: "bar" }), {
    validate: inspectCampaignSaveCandidate,
  });
  assert.equal(foreign.status, "recovery-needed");
  assert.equal(foreign.reason, "unrecognized-legacy-shape");
  assert.equal(foreign.serialized, "");
  assert.equal(storage.getItem(key), serialized);
});

test("complete reset removes primary and recovery keys from both stores", async () => {
  const key = "complete-reset";
  const keys = [
    key,
    preMigrationCampaignSaveKey(key),
    lastKnownGoodCampaignSaveKey(key),
  ];
  const storage = createFakeLocalStorage(Object.fromEntries(keys.map((candidateKey) => [candidateKey, "local"])));
  const indexedDb = createFakeIndexedDb();
  for (const candidateKey of keys) {
    await writeCampaignBackup(indexedDb, candidateKey, "indexed");
  }

  const result = await clearCampaignSaveEverywhere({ storage, indexedDb, key });
  assert.equal(result.status, "cleared");
  assert.equal(result.cleared, true);
  for (const candidateKey of keys) {
    assert.equal(storage.getItem(candidateKey), null);
    assert.equal(await readCampaignBackup(indexedDb, candidateKey), "");
  }
});

test("transactional clear rolls localStorage back when the primary IndexedDB delete fails", async () => {
  const key = "clear-primary-one-side-failure";
  const preMigrationKey = preMigrationCampaignSaveKey(key);
  const lastGoodKey = lastKnownGoodCampaignSaveKey(key);
  const originals = {
    [key]: "primary-before-clear",
    [preMigrationKey]: "legacy-before-clear",
    [lastGoodKey]: "last-good-before-clear",
  };
  const storage = createFakeLocalStorage(originals);
  const indexedDb = createFakeIndexedDb({ deleteFailures: new Set([key]) });
  for (const [candidateKey, raw] of Object.entries(originals)) {
    await writeCampaignBackup(indexedDb, candidateKey, raw);
  }

  const result = await clearCampaignSaveEverywhere({ storage, indexedDb, key });

  assert.equal(result.status, "rolled-back");
  assert.equal(result.cleared, false);
  assert.equal(result.preflightSucceeded, true);
  assert.equal(result.localStorage[key], true);
  assert.equal(result.indexedDB[key], false);
  assert.equal(result.rollbackAttempted, true);
  assert.equal(result.rollbackSucceeded, true);
  for (const [candidateKey, raw] of Object.entries(originals)) {
    assert.equal(storage.getItem(candidateKey), raw);
    assert.equal(await readCampaignBackup(indexedDb, candidateKey), raw);
  }
});

test("transactional clear restores both primaries when a later snapshot delete fails", async () => {
  const key = "clear-snapshot-failure";
  const preMigrationKey = preMigrationCampaignSaveKey(key);
  const lastGoodKey = lastKnownGoodCampaignSaveKey(key);
  const originals = {
    [key]: "primary-before-clear",
    [preMigrationKey]: "legacy-before-clear",
    [lastGoodKey]: "last-good-before-clear",
  };
  const storage = createFakeLocalStorage(originals);
  const indexedDb = createFakeIndexedDb({ deleteFailures: new Set([preMigrationKey]) });
  for (const [candidateKey, raw] of Object.entries(originals)) {
    await writeCampaignBackup(indexedDb, candidateKey, raw);
  }

  const result = await clearCampaignSaveEverywhere({ storage, indexedDb, key });

  assert.equal(result.status, "rolled-back");
  assert.equal(result.cleared, false);
  assert.equal(result.deletionFailure.key, preMigrationKey);
  assert.equal(result.localStorage[key], true);
  assert.equal(result.indexedDB[key], true);
  assert.equal(result.rollbackSucceeded, true);
  for (const [candidateKey, raw] of Object.entries(originals)) {
    assert.equal(storage.getItem(candidateKey), raw);
    assert.equal(await readCampaignBackup(indexedDb, candidateKey), raw);
  }
});

test("transactional clear rejects an unavailable preflight without changing either target state", async () => {
  const key = "clear-preflight-unavailable";
  const preMigrationKey = preMigrationCampaignSaveKey(key);
  const lastGoodKey = lastKnownGoodCampaignSaveKey(key);
  const originals = {
    [key]: "primary-before-clear",
    [preMigrationKey]: "legacy-before-clear",
    [lastGoodKey]: "last-good-before-clear",
  };
  const storage = createFakeLocalStorage(originals);

  const result = await clearCampaignSaveEverywhere({ storage, indexedDb: null, key });

  assert.equal(result.status, "preflight-failed");
  assert.equal(result.cleared, false);
  assert.equal(result.preflightSucceeded, false);
  assert.equal(result.preflightFailures.length, 3);
  assert.equal(result.rollbackAttempted, false);
  assert.equal(result.rollbackSucceeded, null);
  for (const [candidateKey, raw] of Object.entries(originals)) {
    assert.equal(storage.getItem(candidateKey), raw);
  }
});

test("transactional clear verifies rollback even when a failed delete already removed raw data", async () => {
  const key = "clear-delete-then-throw";
  const original = "primary-before-clear";
  const storage = createFakeLocalStorage({ [key]: original });
  const removeItem = storage.removeItem.bind(storage);
  let failAfterPrimaryDelete = true;
  storage.removeItem = (candidateKey) => {
    removeItem(candidateKey);
    if (candidateKey === key && failAfterPrimaryDelete) {
      failAfterPrimaryDelete = false;
      throw new Error("delete completed before the adapter reported failure");
    }
  };
  const indexedDb = createFakeIndexedDb();
  await writeCampaignBackup(indexedDb, key, original);

  const result = await clearCampaignSaveEverywhere({ storage, indexedDb, key });

  assert.equal(result.status, "rolled-back");
  assert.equal(result.rollbackSucceeded, true);
  assert.equal(storage.getItem(key), original);
  assert.equal(await readCampaignBackup(indexedDb, key), original);
  assert.equal(result.verification.localStorage[key].state, "present");
  assert.equal(result.verification.indexedDB[key].state, "present");
});
