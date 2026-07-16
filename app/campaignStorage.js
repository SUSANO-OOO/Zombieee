const inMemoryCampaignSaves = new Map();

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
    storage?.setItem?.(key, value);
    return true;
  } catch {
    return false;
  }
}

export function clearCampaignStorageFallback(key) {
  inMemoryCampaignSaves.delete(key);
}
