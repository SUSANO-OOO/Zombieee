import {
  V100_PRIMARY_STORAGE_KEY,
  createDefaultV100Save,
  deserializeV100Save,
  normalizeV100Save,
  serializeV100Save,
} from "./v100Save.js";

export const V100_MIRROR_STORAGE_KEY = `${V100_PRIMARY_STORAGE_KEY}:mirror`;
export const V100_BACKUP_STORAGE_KEY = `${V100_PRIMARY_STORAGE_KEY}:last-known-good`;
export const V100_LEGACY_STORAGE_KEY = "nishijin-campaign-v1";

function storageFor(host) {
  return host?.localStorage ?? null;
}

export function readV100BrowserSave(host = globalThis) {
  const storage = storageFor(host);
  if (!storage) return { save: createDefaultV100Save(), source: "default", rawLegacy: "" };
  const primary = deserializeV100Save(storage.getItem(V100_PRIMARY_STORAGE_KEY) ?? "");
  const mirror = deserializeV100Save(storage.getItem(V100_MIRROR_STORAGE_KEY) ?? "");
  const candidates = [
    primary.ok ? { save: primary.save, source: "primary" } : null,
    mirror.ok ? { save: mirror.save, source: "mirror" } : null,
  ].filter(Boolean);
  candidates.sort((left, right) => right.save.revision - left.save.revision);
  return {
    save: candidates[0]?.save ?? createDefaultV100Save(),
    source: candidates[0]?.source ?? "default",
    rawLegacy: storage.getItem(V100_LEGACY_STORAGE_KEY) ?? "",
  };
}

export function persistV100BrowserSave(save, host = globalThis) {
  const storage = storageFor(host);
  const normalized = normalizeV100Save(save);
  if (!storage) return { ok: false, reason: "storage-unavailable", save: normalized };
  const serialized = serializeV100Save(normalized);
  storage.setItem(V100_PRIMARY_STORAGE_KEY, serialized);
  storage.setItem(V100_MIRROR_STORAGE_KEY, serialized);
  storage.setItem(V100_BACKUP_STORAGE_KEY, serialized);
  return { ok: true, save: normalized };
}

export function exportV100BrowserSave(save) {
  return JSON.stringify({
    format: "nishijin-campaign-v100-save",
    namespace: V100_PRIMARY_STORAGE_KEY,
    serialized: serializeV100Save(save),
  });
}

export function importV100BrowserSave(serialized) {
  const parsed = deserializeV100Save(serialized);
  if (!parsed.ok) return parsed;
  return { ok: true, save: parsed.save };
}

export function v100StorageContract() {
  return Object.freeze({
    primary: V100_PRIMARY_STORAGE_KEY,
    mirror: V100_MIRROR_STORAGE_KEY,
    lastKnownGood: V100_BACKUP_STORAGE_KEY,
    legacyReadOnly: V100_LEGACY_STORAGE_KEY,
    legacyWriteAllowed: false,
  });
}
