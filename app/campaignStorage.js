const inMemoryCampaignSaves = new Map();
const CAMPAIGN_BACKUP_DATABASE = "nishijin-campaign-backup";
const CAMPAIGN_BACKUP_STORE = "saves";

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
