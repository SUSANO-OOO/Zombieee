import assert from "node:assert/strict";
import test from "node:test";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  V100_BACKUP_STORAGE_KEY,
  V100_MIRROR_STORAGE_KEY,
  exportV100BrowserSave,
  importV100BrowserSave,
  persistV100BrowserSave,
  readV100BrowserSave,
  v100StorageContract,
} from "../app/v100CampaignStorage.js";
import { createDefaultV100Save } from "../app/v100Save.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fakeHost() {
  const values = new Map();
  return { localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  } };
}

test("V1 browser save uses primary, mirror, and last-known-good without touching legacy bytes", () => {
  const host = fakeHost();
  const save = createDefaultV100Save({ playerName: "LUNA" });
  assert.equal(persistV100BrowserSave(save, host).ok, true);
  const loaded = readV100BrowserSave(host);
  assert.equal(loaded.save.playerName, "LUNA");
  assert.equal(loaded.source, "primary");
  const exported = exportV100BrowserSave(save);
  assert.equal(importV100BrowserSave(exported).ok, true);
  assert.deepEqual(v100StorageContract(), {
    primary: "nishijin-campaign-v100",
    mirror: V100_MIRROR_STORAGE_KEY,
    lastKnownGood: V100_BACKUP_STORAGE_KEY,
    owner: "nishijin-campaign-v100:owner",
    ownerLeaseMs: 30000,
    legacyReadOnly: "nishijin-campaign-v1",
    legacyWriteAllowed: false,
    importRequires: ["format", "namespace", "serialized-inner-save", "namespace-and-generation-validation"],
    conflictPolicy: "single-writer-revision-and-owner-lease",
  });
});

test("V1 route exposes the name, seven-slot, event, battle, result, and postgame surfaces", async () => {
  const source = await readFile(path.join(ROOT, "app/V100Campaign.tsx"), "utf8");
  const spriteManifest = await readFile(path.join(ROOT, "app/spriteManifest.js"), "utf8");
  for (const marker of ["物語を始める", "FORMATION / 7 ORDERED SLOTS", "EVENT LOG", "BATTLE RESULT", "ENDING", "postgame-map"]) assert.match(source + (await readFile(path.join(ROOT, "app/v100StoryFlow.js"), "utf8")), new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")));
  assert.match(source, /v100ProductionSessionFor/u);
  assert.match(source, /AshfallGame externalSession/u);
  assert.match(spriteManifest, /V100_CUSTOM_LEFT_VISIBLE_BY_KIND/u);
  assert.match(spriteManifest, /nativeDirection: direction/u);
  assert.match(source, /recordV100PendingResult/u);
  assert.match(source, /exportV100BrowserSave/u);
});
