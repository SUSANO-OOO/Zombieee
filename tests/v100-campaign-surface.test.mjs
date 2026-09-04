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
  v100StorageContract,
} from "../app/v100CampaignStorage.js";
import { createDefaultV100Save } from "../app/v100Save.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("V1 export round-trip and native storage contract remain namespace-specific", () => {
  const save = createDefaultV100Save({ playerName: "監査指揮官" });
  const imported = importV100BrowserSave(exportV100BrowserSave(save));
  assert.equal(imported.ok, true); assert.deepEqual(imported.save, save);
  assert.deepEqual(v100StorageContract(), {
    primary: "nishijin-campaign-v100", mirror: V100_MIRROR_STORAGE_KEY,
    lastKnownGood: V100_BACKUP_STORAGE_KEY, database: "nishijin-campaign-v100",
    version: 1, stores: ["saves", "entitlements"], popupLeaseMs: 30000,
    legacyReadOnly: "nishijin-campaign-v1", legacyWriteAllowed: false,
    conflictPolicy: "indexeddb-transaction-expected-revision",
  });
});

test("V1 route exposes the name, seven-slot, event, battle, result, and postgame surfaces", async () => {
  const source = await readFile(path.join(ROOT, "app/V100Campaign.tsx"), "utf8");
  const spriteManifest = await readFile(path.join(ROOT, "app/spriteManifest.js"), "utf8");
  for (const marker of ["この名前で作戦を始める", "出撃準備 / 7枠", "会話記録", "作戦結果", "この作戦を編成", "postgame-map"]) assert.match(source + (await readFile(path.join(ROOT, "app/v100StoryFlow.js"), "utf8")), new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")));
  for (const forbidden of ["LUNA RUNTIME", "REV ", "EVENT LOG", "BATTLE RESULT", "READ EVENT REPLAY", "LEGACY ENTITLEMENT", "pending result", "receipt", "FORMATION / 7 ORDERED SLOTS"]) {
    assert.doesNotMatch(source, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")));
  }
  assert.match(source, /v100ProductionSessionFor/u);
  assert.match(source, /AshfallGame externalSession/u);
  assert.match(spriteManifest, /V100_CUSTOM_LEFT_VISIBLE_BY_KIND/u);
  assert.match(spriteManifest, /nativeDirection: direction/u);
  assert.match(source, /recordV100PendingResult/u);
  assert.match(source, /exportV100BrowserSave/u);
});
