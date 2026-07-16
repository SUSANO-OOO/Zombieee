import assert from "node:assert/strict";
import test from "node:test";

import {
  campaignStorageFor,
  clearCampaignStorageFallback,
  readCampaignSave,
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
