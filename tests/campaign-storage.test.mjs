import assert from "node:assert/strict";
import test from "node:test";

import {
  campaignStorageFor,
  clearCampaignStorageFallback,
  indexedDbFor,
  readCampaignBackup,
  readCampaignSave,
  writeCampaignBackup,
  writeCampaignSave,
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

function createFakeIndexedDb() {
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
              const request = { result: undefined, onsuccess: null, onerror: null };
              queueMicrotask(() => {
                request.result = values.get(key);
                request.onsuccess?.();
                listeners.get("complete")?.();
              });
              return request;
            },
            put(value, key) {
              const request = { result: undefined, onsuccess: null, onerror: null };
              queueMicrotask(() => {
                values.set(key, value);
                request.result = key;
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
