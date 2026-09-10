import {
  V100_PRIMARY_STORAGE_KEY, V100_SAVE_EXPORT_FORMAT, createDefaultV100Save,
  createV100SaveFromLegacy, deserializeV100Save, serializeV100Save,
  isEligibleV100LegacyHistory, claimV100LegacyGift, acknowledgeV100LegacyGiftPopup,
} from "./v100Save.js";
import { V100_LEGACY_GIFT } from "./v100Registry.js";
import { CAMPAIGN_STORAGE_TIMEOUT_MS, CAMPAIGN_IMPORT_MAX_BYTES } from "./campaignStorage.js";

export const V100_DATABASE_NAME = V100_PRIMARY_STORAGE_KEY;
export const V100_DATABASE_VERSION = 1;
export const V100_MIRROR_STORAGE_KEY = `${V100_PRIMARY_STORAGE_KEY}:mirror`;
export const V100_BACKUP_STORAGE_KEY = `${V100_PRIMARY_STORAGE_KEY}:last-known-good`;
export const V100_LEGACY_STORAGE_KEY = "nishijin-campaign-v1";
export const V100_POPUP_LEASE_MS = 30_000;
export const V100_STORAGE_EVENT_KEYS = Object.freeze([V100_PRIMARY_STORAGE_KEY, V100_MIRROR_STORAGE_KEY, V100_BACKUP_STORAGE_KEY]);
const CURRENT = "current";
const PREVIOUS = "last-known-good";
const MIRROR_CORRUPTION = "bootstrap-corrupt-mirrors";
const GIFT = V100_LEGACY_GIFT.entitlementReceipt;
const CHANNEL = `${V100_PRIMARY_STORAGE_KEY}:changed`;
const LEGACY_KEYS = [V100_LEGACY_STORAGE_KEY, `${V100_LEGACY_STORAGE_KEY}::last-known-good`, `${V100_LEGACY_STORAGE_KEY}::pre-migration`];

/** @typedef {ReturnType<typeof import("./v100Save.js").normalizeV100Save>} Save */
/** @typedef {{expectedRevision?: number | null, ownerId?: string | null}} WriteOptions */
/** @typedef {{ownerId: string, claimId: string, balance: number, expiresAt: number}} Popup */
/** @typedef {{token: string, candidate: Save | null, raw: string}} Recovery */
/** @typedef {{ok: boolean, save: Save | null, reason: string, source: string, changed: boolean, mirrorSaved: boolean, popup: Popup | null, recovery: Recovery | null, retryAt: number}} StorageResult */
/** @returns {StorageResult} */
function result(ok, save = null, reason = "", extra = {}) {
  return { ok, save, reason, source: "indexedDB", changed: false, mirrorSaved: true, popup: null, recovery: null, retryAt: 0, ...extra };
}
function storageFor(host) { try { return host?.localStorage ?? null; } catch { return null; } }
export function createV100SaveOwnerId(host = globalThis) {
  return `v100-tab:${host?.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
}
function checksum(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function parsedSave(serialized) {
  if (typeof serialized !== "string" || !serialized || serialized.length > CAMPAIGN_IMPORT_MAX_BYTES) return null;
  try {
    const raw = JSON.parse(serialized);
    if (!Number.isSafeInteger(raw?.caps) || raw.caps < 0 || !Number.isSafeInteger(raw?.revision) || raw.revision < 0) return null;
    const parsed = deserializeV100Save(serialized);
    return parsed.ok ? parsed.save : null;
  } catch { return null; }
}
function pack(save, legacyVerified) {
  const serialized = serializeV100Save(save);
  const verified = legacyVerified === true;
  return { format: 1, serialized, legacyVerified: verified, checksum: checksum(`${verified}:${serialized}`) };
}
function unpack(record) {
  if (!record || record.format !== 1 || typeof record.legacyVerified !== "boolean" || typeof record.serialized !== "string") return null;
  return record.checksum === checksum(`${record.legacyVerified}:${record.serialized}`) ? parsedSave(record.serialized) : null;
}
function openDatabase(factory, name, legacy = false) {
  return new Promise((resolve, reject) => {
    if (!factory) { reject(new Error("indexeddb-unavailable")); return; }
    let request;
    let settled = false;
    const finish = (error, db = null) => {
      if (settled) { db?.close(); return; }
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(db);
    };
    const timer = setTimeout(() => finish(new Error("storage-timeout")), CAMPAIGN_STORAGE_TIMEOUT_MS);
    try {
      request = legacy ? factory.open(name) : factory.open(name, V100_DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (legacy || settled) { request.transaction.abort(); return; }
        for (const store of ["saves", "entitlements"]) if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
      };
      request.onsuccess = () => finish(null, request.result);
      request.onerror = () => finish(request.error ?? new Error("database-open-failed"));
      request.onblocked = () => finish(new Error("database-blocked"));
    } catch (error) { finish(error); }
  });
}
/** All mutation requests are enqueued inside native IDB request callbacks. @returns {Promise<StorageResult>} */
async function transaction(host, action) {
  let db;
  try {
    db = await openDatabase(host?.indexedDB, V100_DATABASE_NAME);
    return await new Promise((resolve) => {
      let tx;
      let outcome = result(false, null, "transaction-incomplete");
      let settled = false;
      const finish = (value) => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } };
      const timer = setTimeout(() => { try { tx?.abort(); } catch { /* Already completed. */ } finish(result(false, null, "storage-timeout")); }, CAMPAIGN_STORAGE_TIMEOUT_MS);
      try {
        tx = db.transaction(["saves", "entitlements"], "readwrite");
        const saves = tx.objectStore("saves");
        const gifts = tx.objectStore("entitlements");
        const values = { current: null, previous: null, gift: null, mirrorCorruption: null };
        let waiting = 4;
        tx.oncomplete = () => finish(outcome);
        tx.onabort = () => finish(result(false, null, tx.error?.name ?? "transaction-aborted"));
        tx.onerror = () => { /* Native error aborts the transaction; never publish partial success. */ };
        for (const [key, request] of [["current", saves.get(CURRENT)], ["previous", saves.get(PREVIOUS)], ["gift", gifts.get(GIFT)], ["mirrorCorruption", saves.get(MIRROR_CORRUPTION)]]) {
          request.onsuccess = () => {
            values[key] = request.result ?? null;
            waiting -= 1;
            if (waiting === 0) {
              try { outcome = action(values, saves, gifts); }
              catch { try { tx.abort(); } catch { /* Native onabort still owns the failed outcome. */ } }
            }
          };
        }
      } catch { try { tx?.abort(); } catch { /* No active transaction. */ } finish(result(false, null, "transaction-unavailable")); }
    });
  } catch (error) { return result(false, null, error?.message ?? "indexeddb-unavailable"); }
  finally { db?.close(); }
}
function recoveryFor(values) {
  const raw = JSON.stringify({ current: values.current, previous: values.previous, mirrorCorruption: values.mirrorCorruption });
  return { token: checksum(raw), candidate: unpack(values.previous), raw };
}
function currentState(values) {
  const save = unpack(values.current);
  return save ? result(true, save) : result(false, null, "recovery-required", { recovery: recoveryFor(values) });
}
function putSave(saves, values, save, verified) {
  if (unpack(values.current)) saves.put(values.current, PREVIOUS);
  else if (!unpack(values.previous)) saves.put(pack(save, verified), PREVIOUS);
  saves.put(pack(save, verified), CURRENT);
}
function carryGift(save, row) {
  let gift = row;
  if (!gift && save.receipts.includes(GIFT)) gift = { state: "committed", popupAcknowledged: save.legacy.popupAcknowledged, ownerId: null, claimId: null, expiresAt: 0 };
  if (gift?.state !== "committed") return { save, gift };
  const acknowledged = gift.popupAcknowledged === true || save.legacy.popupAcknowledged;
  const receipts = [...new Set([...save.receipts, GIFT, ...(acknowledged ? [V100_LEGACY_GIFT.popupReceipt] : [])])];
  return { save: { ...save, receipts, legacy: { eligible: true, entitlementClaimed: true, popupAcknowledged: acknowledged } }, gift: { ...gift, popupAcknowledged: acknowledged } };
}
function popupHeldByOther(row, ownerId) { return row?.state === "committed" && !row.popupAcknowledged && row.ownerId && row.ownerId !== ownerId && row.expiresAt > Date.now(); }
function safeGiftScreen(save, screen) { return (screen === "title" && save.flowState.phase === "name" && !save.campaignStarted) || (screen === "map" && save.flowState.phase === "map"); }
function notify(host) {
  try { const channel = new host.BroadcastChannel(CHANNEL); channel.postMessage("changed"); channel.close(); } catch { /* storage and focus events also read durable state. */ }
}
/** @param {StorageResult} outcome @returns {StorageResult} */
function mirrorAndNotify(outcome, host) {
  if (!outcome.ok || !outcome.save) return outcome;
  const serialized = serializeV100Save(outcome.save);
  let mirrorSaved = true;
  const storage = storageFor(host);
  for (const key of V100_STORAGE_EVENT_KEYS) {
    try { storage.setItem(key, serialized); if (storage.getItem(key) !== serialized) mirrorSaved = false; }
    catch { mirrorSaved = false; }
  }
  if (outcome.changed) notify(host);
  return { ...outcome, mirrorSaved };
}
export function subscribeV100SaveChanges(callback, host = globalThis) {
  let channel;
  const storage = (event) => { if (!event.key || V100_STORAGE_EVENT_KEYS.includes(event.key)) callback(); };
  try { channel = new host.BroadcastChannel(CHANNEL); channel.onmessage = callback; } catch { /* Focus remains available. */ }
  host.addEventListener?.("storage", storage);
  host.addEventListener?.("focus", callback);
  return () => { channel?.close(); host.removeEventListener?.("storage", storage); host.removeEventListener?.("focus", callback); };
}
async function legacyCandidates(host) {
  const candidates = [];
  const storage = storageFor(host);
  for (const key of LEGACY_KEYS) { try { const raw = storage?.getItem(key); if (typeof raw === "string") candidates.push(raw); } catch { /* Read-only optional history. */ } }
  let db;
  try {
    db = await openDatabase(host?.indexedDB, "nishijin-campaign-backup", true);
    if (db.objectStoreNames.contains("saves")) await new Promise((resolve) => {
      const tx = db.transaction("saves", "readonly");
      const timer = setTimeout(() => { try { tx.abort(); } catch { /* Complete. */ } resolve(null); }, CAMPAIGN_STORAGE_TIMEOUT_MS);
      tx.oncomplete = tx.onabort = () => { clearTimeout(timer); resolve(null); };
      for (const key of LEGACY_KEYS) {
        const request = tx.objectStore("saves").get(key);
        request.onsuccess = () => { if (typeof request.result === "string") candidates.push(request.result); };
      }
    });
  } catch { /* Missing, blocked or denied legacy storage cannot establish eligibility. */ }
  finally { db?.close(); }
  return candidates;
}
export async function readV100BrowserSave(host = globalThis) {
  const storage = storageFor(host);
  const mirrors = [];
  const rawMirrors = {};
  let existingMirror = false;
  for (const key of V100_STORAGE_EVENT_KEYS) {
    try { const raw = storage?.getItem(key); if (raw) { existingMirror = true; rawMirrors[key] = raw; const save = parsedSave(raw); if (save) mirrors.push(save); } } catch { /* Durable storage still owns the save. */ }
  }
  mirrors.sort((a, b) => b.revision - a.revision);
  const history = (await legacyCandidates(host)).find(isEligibleV100LegacyHistory);
  const outcome = await transaction(host, (values, saves, gifts) => {
    if (values.current || values.previous || values.mirrorCorruption) return currentState(values);
    if (existingMirror && !mirrors.length) {
      saves.put(rawMirrors, MIRROR_CORRUPTION);
      return result(false, null, "recovery-required", { recovery: recoveryFor({ ...values, mirrorCorruption: rawMirrors }) });
    }
    let save = mirrors[0] ?? createV100SaveFromLegacy({ legacyCandidate: history });
    save = { ...save, legacy: { ...save.legacy, eligible: Boolean(history) } };
    const carried = carryGift(save, values.gift);
    if (carried.gift) gifts.put(carried.gift, GIFT);
    putSave(saves, values, carried.save, Boolean(history));
    return result(true, carried.save, "", { changed: true });
  });
  return mirrorAndNotify(outcome, host);
}
/** @param {Save} nextSave @param {any} [host] @param {WriteOptions} [options] */
export async function persistV100BrowserSave(nextSave, host = globalThis, { expectedRevision = null, ownerId = null } = {}) {
  const incoming = parsedSave(JSON.stringify(nextSave));
  if (!incoming) return result(false, null, "invalid-save");
  const outcome = await transaction(host, (values, saves, gifts) => {
    const state = currentState(values);
    if (!state.ok) return state;
    if (expectedRevision !== state.save.revision) return result(false, state.save, "stale-writer");
    if (incoming.revision <= state.save.revision) return result(false, state.save, "revision-not-advanced");
    if (popupHeldByOther(values.gift, ownerId)) return result(false, state.save, "popup-owned-by-another-tab");
    const carried = carryGift(incoming, values.gift);
    if (carried.gift) gifts.put(carried.gift, GIFT);
    putSave(saves, values, carried.save, values.current.legacyVerified);
    return result(true, carried.save, "", { changed: true });
  });
  return mirrorAndNotify(outcome, host);
}
export async function claimV100BrowserGift(host = globalThis, { ownerId = createV100SaveOwnerId(host), screen = "" } = {}) {
  const outcome = await transaction(host, (values, saves, gifts) => {
    const state = currentState(values);
    if (!state.ok) return state;
    if (!safeGiftScreen(state.save, screen)) return result(false, state.save, "unsafe-screen");
    let { save, gift } = carryGift(state.save, values.gift);
    if (!gift && !values.current.legacyVerified) return result(true, save);
    if (!gift) { gift = { state: "pending", popupAcknowledged: false }; gifts.add(gift, GIFT); }
    if (gift.state === "pending") {
      const claimed = claimV100LegacyGift({ ...save, legacy: { ...save.legacy, eligible: true } });
      save = claimed.save;
      gift = { ...gift, state: "committed", popupAcknowledged: save.legacy.popupAcknowledged };
    }
    if (serializeV100Save(save) !== serializeV100Save(state.save)) {
      if (save.revision <= state.save.revision) save = { ...save, revision: state.save.revision + 1 };
      putSave(saves, values, save, values.current.legacyVerified);
    }
    if (gift.popupAcknowledged) { gifts.put({ ...gift, ownerId: null, claimId: null, expiresAt: 0 }, GIFT); return result(true, save); }
    if (popupHeldByOther(gift, ownerId)) return result(true, save, "", { retryAt: gift.expiresAt });
    const claimId = gift.ownerId === ownerId && gift.expiresAt > Date.now() ? gift.claimId : createV100SaveOwnerId(host);
    const expiresAt = Date.now() + V100_POPUP_LEASE_MS;
    gifts.put({ ...gift, ownerId, claimId, expiresAt }, GIFT);
    return result(true, save, "", { changed: true, popup: { ownerId, claimId, balance: save.caps, expiresAt } });
  });
  return mirrorAndNotify(outcome, host);
}
/** @param {any} [host] @param {{ownerId?: string | null, claimId?: string | null, screen?: string, painted?: boolean}} [options] */
export async function acknowledgeV100BrowserGift(host = globalThis, { ownerId = null, claimId = null, screen = "", painted = false } = {}) {
  if (!painted) return result(false, null, "visible-paint-required");
  const outcome = await transaction(host, (values, saves, gifts) => {
    const state = currentState(values);
    if (!state.ok) return state;
    if (!safeGiftScreen(state.save, screen)) return result(false, state.save, "unsafe-screen");
    const row = values.gift;
    if (row?.popupAcknowledged) return result(true, state.save);
    if (!row || row.ownerId !== ownerId || row.claimId !== claimId || row.expiresAt <= Date.now()) return result(false, state.save, "popup-ownership-lost");
    const acknowledged = acknowledgeV100LegacyGiftPopup(state.save, { screen });
    if (!acknowledged.applied && !acknowledged.save.legacy.popupAcknowledged) return result(false, state.save, "gift-missing");
    putSave(saves, values, acknowledged.save, values.current.legacyVerified);
    gifts.put({ ...row, popupAcknowledged: true, ownerId: null, claimId: null, expiresAt: 0 }, GIFT);
    return result(true, acknowledged.save, "", { changed: true });
  });
  return mirrorAndNotify(outcome, host);
}
export async function releaseV100PopupOwnership(host = globalThis, ownerId) {
  const outcome = await transaction(host, (values, _saves, gifts) => {
    const row = values.gift;
    if (row?.ownerId === ownerId && !row.popupAcknowledged) {
      gifts.put({ ...row, ownerId: null, claimId: null, expiresAt: 0 }, GIFT);
      return result(true, unpack(values.current), "", { changed: true });
    }
    return result(true, unpack(values.current));
  });
  if (outcome.changed) notify(host);
  return outcome;
}
/** @param {string} serialized @param {any} [host] @param {WriteOptions} [options] */
export async function registerV100LegacyHistory(serialized, host = globalThis, { expectedRevision = null, ownerId = null } = {}) {
  if (!isEligibleV100LegacyHistory(serialized)) return result(false, null, "legacy-history-not-eligible");
  const outcome = await transaction(host, (values, saves) => {
    const state = currentState(values);
    if (!state.ok) return state;
    if (expectedRevision !== state.save.revision) return result(false, state.save, "stale-writer");
    if (popupHeldByOther(values.gift, ownerId)) return result(false, state.save, "popup-owned-by-another-tab");
    if (values.current.legacyVerified) return state;
    const save = { ...state.save, revision: state.save.revision + 1, legacy: { ...state.save.legacy, eligible: true } };
    putSave(saves, values, save, true);
    return result(true, save, "", { changed: true });
  });
  return mirrorAndNotify(outcome, host);
}
export function exportV100BrowserSave(save, { now = new Date().toISOString() } = {}) {
  return JSON.stringify({ format: V100_SAVE_EXPORT_FORMAT, namespace: V100_PRIMARY_STORAGE_KEY, schemaVersion: 1, exportedAt: now, serialized: serializeV100Save(save) });
}
export function importV100BrowserSave(serialized) {
  if (typeof serialized !== "string" || !serialized || serialized.length > CAMPAIGN_IMPORT_MAX_BYTES) return result(false, null, "invalid-export-size");
  try {
    const envelope = JSON.parse(serialized);
    if (envelope?.format !== V100_SAVE_EXPORT_FORMAT || envelope.namespace !== V100_PRIMARY_STORAGE_KEY || envelope.schemaVersion !== 1) return result(false, null, "invalid-export-envelope");
    const save = parsedSave(envelope.serialized);
    return save ? result(true, save) : result(false, null, "invalid-inner-save");
  } catch { return result(false, null, "invalid-export-json"); }
}
/** @param {string} serialized @param {any} [host] @param {WriteOptions & {recoveryToken?: string | null}} [options] */
export async function restoreV100BrowserSave(serialized, host = globalThis, { expectedRevision = null, recoveryToken = null, ownerId = null } = {}) {
  const incoming = importV100BrowserSave(serialized);
  if (!incoming.ok) return incoming;
  const outcome = await transaction(host, (values, saves, gifts) => {
    const current = unpack(values.current);
    if (recoveryToken !== null) {
      if (current || recoveryFor(values).token !== recoveryToken) return result(false, current, "recovery-source-changed");
    } else if (!current || expectedRevision !== current.revision) return result(false, current, "stale-writer");
    if (popupHeldByOther(values.gift, ownerId)) return result(false, current, "popup-owned-by-another-tab");
    const base = current ?? unpack(values.previous) ?? createDefaultV100Save();
    const carried = carryGift({ ...incoming.save, revision: base.revision + 1, updatedAt: new Date().toISOString() }, values.gift);
    if (carried.gift) gifts.put(carried.gift, GIFT);
    if (values.current && !current) saves.put(values.current, `corrupt:${createV100SaveOwnerId(host)}`);
    const verified = values.current?.legacyVerified === true && Boolean(current) || values.previous?.legacyVerified === true && Boolean(unpack(values.previous));
    putSave(saves, values, carried.save, verified);
    return result(true, carried.save, "", { changed: true });
  });
  return mirrorAndNotify(outcome, host);
}
export function v100StorageContract() {
  return Object.freeze({ primary: V100_PRIMARY_STORAGE_KEY, mirror: V100_MIRROR_STORAGE_KEY, lastKnownGood: V100_BACKUP_STORAGE_KEY,
    database: V100_DATABASE_NAME, version: V100_DATABASE_VERSION, stores: ["saves", "entitlements"], popupLeaseMs: V100_POPUP_LEASE_MS,
    legacyReadOnly: V100_LEGACY_STORAGE_KEY, legacyWriteAllowed: false, conflictPolicy: "indexeddb-transaction-expected-revision" });
}
