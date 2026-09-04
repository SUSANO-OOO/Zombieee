import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultV100Save, claimV100LegacyGift, acknowledgeV100LegacyGiftPopup } from "../app/v100Save.js";
import { readV100BrowserSave, persistV100BrowserSave, restoreV100BrowserSave, exportV100BrowserSave, importV100BrowserSave } from "../app/v100CampaignStorage.js";

test("unavailable or denied IDB fails closed and never writes a localStorage fallback", async () => {
  for (const host of [{}, { get indexedDB() { throw new Error("SecurityError"); } }, { indexedDB: { open() { throw new Error("SecurityError"); } } }]) {
    let writes = 0;
    host.localStorage = { getItem: () => null, setItem: () => { writes += 1; } };
    const read = await readV100BrowserSave(host);
    assert.equal(read.ok, false); assert.equal(read.save, null);
    assert.equal((await persistV100BrowserSave(createDefaultV100Save(), host, { expectedRevision: 0 })).ok, false);
    assert.equal(writes, 0);
  }
});

test("import rejects foreign envelopes, generations, schema, invalid amounts and oversized input", () => {
  const save = createDefaultV100Save();
  const good = JSON.parse(exportV100BrowserSave(save));
  for (const envelope of [{ ...good, namespace: "nishijin-campaign-v1" }, { ...good, format: "nishijin-campaign-save" }, { ...good, schemaVersion: 2 }]) assert.equal(importV100BrowserSave(JSON.stringify(envelope)).ok, false);
  for (const fields of [{ namespace: "nishijin-campaign-v1" }, { campaignGeneration: "other" }, { caps: -1 }, { caps: 1.5 }, { revision: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.equal(importV100BrowserSave(JSON.stringify({ ...good, serialized: JSON.stringify({ ...save, ...fields }) })).ok, false);
  }
  for (const input of [null, "", "{", "x".repeat(1024 * 1024 + 1)]) assert.equal(importV100BrowserSave(input).ok, false);
  assert.deepEqual(importV100BrowserSave(JSON.stringify(good)).save, save);
});

test("invalid mutations and invalid restore files are rejected before touching IDB", async () => {
  let opened = 0;
  const host = { indexedDB: { open() { opened += 1; throw new Error("should-not-open"); } } };
  assert.equal((await persistV100BrowserSave({ ...createDefaultV100Save(), caps: -1 }, host)).reason, "invalid-save");
  assert.equal((await restoreV100BrowserSave("{}", host)).ok, false);
  assert.equal(opened, 0);
});

test("gift popup permits only title and map after the grant", () => {
  const eligible = { ...createDefaultV100Save(), legacy: { eligible: true } };
  const gifted = claimV100LegacyGift(eligible).save;
  for (const screen of ["title", "map"]) assert.equal(acknowledgeV100LegacyGiftPopup(gifted, { screen }).applied, true);
  for (const screen of ["personnel", "loadout", "event", "formation", "battle", "result", "ending", "data", "recovery"]) assert.equal(acknowledgeV100LegacyGiftPopup(gifted, { screen }).reason, "unsafe-screen");
});
