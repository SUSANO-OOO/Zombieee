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
    legacyReadOnly: "nishijin-campaign-v1",
    legacyWriteAllowed: false,
  });
});

test("V1 route exposes the name, seven-slot, event, battle, result, and postgame surfaces", async () => {
  const source = await readFile(path.join(ROOT, "app/V100Campaign.tsx"), "utf8");
  for (const marker of ["物語を始める", "FORMATION / 7 ORDERED SLOTS", "EVENT LOG", "BATTLE RESULT", "ENDING", "postgame-map"]) assert.match(source + (await readFile(path.join(ROOT, "app/v100StoryFlow.js"), "utf8")), new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")));
  assert.match(source, /v100RuntimeSpriteFrameFor/u);
  assert.match(source, /direction="left"/gu);
  assert.match(source, /recordV100PendingResult/u);
  assert.match(source, /exportV100BrowserSave/u);
});
