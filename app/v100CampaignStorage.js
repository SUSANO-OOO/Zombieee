import {
  V100_PRIMARY_STORAGE_KEY,
  V100_SAVE_EXPORT_FORMAT,
  createDefaultV100Save,
  deserializeV100Save,
  normalizeV100Save,
  serializeV100Save,
} from "./v100Save.js";

export const V100_MIRROR_STORAGE_KEY = `${V100_PRIMARY_STORAGE_KEY}:mirror`;
export const V100_BACKUP_STORAGE_KEY = `${V100_PRIMARY_STORAGE_KEY}:last-known-good`;
export const V100_OWNER_STORAGE_KEY = `${V100_PRIMARY_STORAGE_KEY}:owner`;
export const V100_LEGACY_STORAGE_KEY = "nishijin-campaign-v1";
export const V100_OWNER_LEASE_MS = 30_000;
export const V100_STORAGE_EVENT_KEYS = Object.freeze([
  V100_PRIMARY_STORAGE_KEY,
  V100_MIRROR_STORAGE_KEY,
  V100_BACKUP_STORAGE_KEY,
]);

let ownerSequence = 0;

function storageFor(host) {
  return host?.localStorage ?? null;
}

function nowFor(host, override = null) {
  if (Number.isFinite(Number(override))) return Number(override);
  return typeof host?.Date?.now === "function" ? host.Date.now() : Date.now();
}

function ownerIdFor(host) {
  ownerSequence += 1;
  const random = typeof host?.crypto?.randomUUID === "function"
    ? host.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `v100-tab:${random}:${ownerSequence}`;
}

function readOwner(storage) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(V100_OWNER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || typeof parsed.ownerId !== "string") return null;
    return {
      ownerId: parsed.ownerId,
      acquiredAt: Number(parsed.acquiredAt) || 0,
      expiresAt: Number(parsed.expiresAt) || 0,
    };
  } catch {
    return null;
  }
}

function saveCandidate(storage, key) {
  if (!storage) return null;
  try {
    const parsed = deserializeV100Save(storage.getItem(key) ?? "");
    return parsed.ok ? parsed.save : null;
  } catch {
    return null;
  }
}

function currentCandidate(storage) {
  const candidates = [
    [V100_PRIMARY_STORAGE_KEY, "primary"],
    [V100_MIRROR_STORAGE_KEY, "mirror"],
    [V100_BACKUP_STORAGE_KEY, "last-known-good"],
  ].map(([key, source]) => {
    const save = saveCandidate(storage, key);
    return save ? { save, source } : null;
  }).filter(Boolean);
  candidates.sort((left, right) => right.save.revision - left.save.revision || (left.source === "primary" ? -1 : 1));
  return candidates[0] ?? null;
}

export function createV100SaveOwnerId(host = globalThis) {
  return ownerIdFor(host);
}

export function claimV100SaveOwnership(host = globalThis, { ownerId = createV100SaveOwnerId(host), leaseMs = V100_OWNER_LEASE_MS, now = null } = {}) {
  const storage = storageFor(host);
  if (!storage) return { ok: false, reason: "storage-unavailable", ownerId };
  const time = nowFor(host, now);
  const existing = readOwner(storage);
  if (existing && existing.ownerId !== ownerId && existing.expiresAt > time) {
    return { ok: false, reason: "ownership-conflict", ownerId, existing };
  }
  const lease = { ownerId, acquiredAt: existing?.ownerId === ownerId ? existing.acquiredAt : time, expiresAt: time + Math.max(1_000, Number(leaseMs) || V100_OWNER_LEASE_MS) };
  try {
    storage.setItem(V100_OWNER_STORAGE_KEY, JSON.stringify(lease));
    return { ok: true, ownerId, lease };
  } catch (error) {
    return { ok: false, reason: "ownership-write-failed", ownerId, error };
  }
}

export function releaseV100SaveOwnership(host = globalThis, ownerId) {
  const storage = storageFor(host);
  if (!storage || typeof ownerId !== "string") return { ok: false, reason: "invalid-owner" };
  const existing = readOwner(storage);
  if (!existing || existing.ownerId !== ownerId) return { ok: false, reason: "not-owner", existing };
  try {
    storage.removeItem(V100_OWNER_STORAGE_KEY);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: "ownership-remove-failed", error };
  }
}

export function readV100BrowserSave(host = globalThis) {
  const storage = storageFor(host);
  if (!storage) return { save: createDefaultV100Save(), source: "default", rawLegacy: "", ownership: null };
  const candidate = currentCandidate(storage);
  return {
    save: candidate?.save ?? createDefaultV100Save(),
    source: candidate?.source ?? "default",
    rawLegacy: storage.getItem(V100_LEGACY_STORAGE_KEY) ?? "",
    ownership: readOwner(storage),
  };
}

export function persistV100BrowserSave(save, host = globalThis, {
  ownerId = null,
  leaseMs = V100_OWNER_LEASE_MS,
  now = null,
} = {}) {
  const storage = storageFor(host);
  const normalized = normalizeV100Save(save);
  if (!storage) return { ok: false, reason: "storage-unavailable", save: normalized };
  if (ownerId !== null) {
    const ownership = claimV100SaveOwnership(host, { ownerId, leaseMs, now });
    if (!ownership.ok) return { ok: false, reason: ownership.reason, save: readV100BrowserSave(host).save, ownership };
  }
  const serialized = serializeV100Save(normalized);
  const current = currentCandidate(storage);
  if (current) {
    const currentSerialized = serializeV100Save(current.save);
    if (current.save.revision > normalized.revision || (current.save.revision === normalized.revision && currentSerialized !== serialized)) {
      return { ok: false, reason: "stale-writer", save: current.save, current };
    }
  }
  try {
    // Keep recovery copies ahead of the primary pointer so a partial write is
    // recoverable by the highest-revision reader.
    storage.setItem(V100_BACKUP_STORAGE_KEY, serialized);
    storage.setItem(V100_MIRROR_STORAGE_KEY, serialized);
    storage.setItem(V100_PRIMARY_STORAGE_KEY, serialized);
    const verified = saveCandidate(storage, V100_PRIMARY_STORAGE_KEY);
    if (!verified || serializeV100Save(verified) !== serialized) return { ok: false, reason: "write-verification-failed", save: current?.save ?? normalized };
    return { ok: true, save: verified, ownership: readOwner(storage) };
  } catch (error) {
    return { ok: false, reason: "storage-write-failed", error, save: current?.save ?? normalized };
  }
}

export function exportV100BrowserSave(save, { now = new Date().toISOString() } = {}) {
  return JSON.stringify({
    format: V100_SAVE_EXPORT_FORMAT,
    namespace: V100_PRIMARY_STORAGE_KEY,
    schemaVersion: 1,
    exportedAt: now,
    serialized: serializeV100Save(save),
  });
}

export function importV100BrowserSave(serialized) {
  if (typeof serialized !== "string" || serialized.length === 0) return { ok: false, reason: "empty-export" };
  let envelope;
  try {
    envelope = JSON.parse(serialized);
  } catch (error) {
    return { ok: false, reason: "invalid-export-json", error };
  }
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) return { ok: false, reason: "invalid-export-envelope" };
  if (envelope.format !== V100_SAVE_EXPORT_FORMAT) return { ok: false, reason: "invalid-export-format" };
  if (envelope.namespace !== V100_PRIMARY_STORAGE_KEY) return { ok: false, reason: "wrong-export-namespace" };
  if (typeof envelope.serialized !== "string" || envelope.serialized.length === 0) return { ok: false, reason: "missing-inner-save" };
  const parsed = deserializeV100Save(envelope.serialized);
  if (!parsed.ok) return { ok: false, reason: `invalid-inner-save:${parsed.reason}`, errors: parsed.errors, save: parsed.save };
  return { ok: true, save: parsed.save, envelope };
}

export function v100StorageContract() {
  return Object.freeze({
    primary: V100_PRIMARY_STORAGE_KEY,
    mirror: V100_MIRROR_STORAGE_KEY,
    lastKnownGood: V100_BACKUP_STORAGE_KEY,
    owner: V100_OWNER_STORAGE_KEY,
    ownerLeaseMs: V100_OWNER_LEASE_MS,
    legacyReadOnly: V100_LEGACY_STORAGE_KEY,
    legacyWriteAllowed: false,
    importRequires: ["format", "namespace", "serialized-inner-save", "namespace-and-generation-validation"],
    conflictPolicy: "single-writer-revision-and-owner-lease",
  });
}
