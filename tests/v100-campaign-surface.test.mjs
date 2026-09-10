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
import { v100BattleDefinitionFor, v100MissionObjectiveFor, v100ProductionSessionFor } from "../app/v100BattleAdapter.js";
import { objectiveForBattle } from "../app/battleDefinitions.js";
import { V100_STAGE_IDS } from "../app/v100Registry.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("map briefings describe the authored task rather than number words in objective IDs", () => {
  const expected = new Map([
    [3, "大型変異感染者TAKUYAを撃破"],
    [7, "医薬品の搬出を守る"],
    [14, "ボスを撃破"],
    [16, "3基の封鎖装置を順番に作動"],
    [26, "冷蔵車3台を封鎖地点へ追い込み、停止・確保"],
    [28, "国内散布装置4基を順番に物理停止"],
    [29, "国外起動回線と感染源原株を破壊"],
    [30, "TAKUYA-Ωを撃破し、西新を守る"],
  ]);
  for (const [number, goal] of expected) {
    const id = V100_STAGE_IDS[number - 1];
    assert.equal(v100MissionObjectiveFor(id), goal);
    assert.equal(v100BattleDefinitionFor(id).objective, goal);
  }
  for (const number of [1, 4, 8, 10, 13]) {
    const definition = v100BattleDefinitionFor(V100_STAGE_IDS[number - 1]);
    assert.equal(objectiveForBattle(definition, {}), number === 4 ? "感染中継点を破壊" : "感染拠点を破壊");
  }
});

test("external battle takes V1 settings while legacy equipment cannot affect its loadout", () => {
  const clean = createDefaultV100Save({ settings: { bgmEnabled: false, graphicsQuality: "power-save", autoSkipReadStory: true } });
  const contaminated = { ...clean, equipmentSnapshot: { tacticalEquipmentIds: ["tactical-supply-cache"] }, equipmentInventory: [{ equipmentId: "field-machete", quantity: 1 }] };
  const session = v100ProductionSessionFor({ save: contaminated, stageId: V100_STAGE_IDS[0], resultId: "v1-owned-run" });
  assert.deepEqual(session.settings, clean.settings);
  assert.deepEqual(session.equipmentSnapshot, { personalEquipmentByUnit: {}, tacticalEquipmentIds: [], equipmentEnhancementLevels: {} });
  assert.equal(session.resultId, "v1-owned-run");
  assert.equal(Object.isFrozen(session.settings), true);
  assert.equal(Object.isFrozen(session.equipmentSnapshot), true);
  assert.throws(() => { session.equipmentSnapshot.tacticalEquipmentIds.push("tactical-supply-cache"); }, TypeError);
  assert.equal(contaminated.equipmentSnapshot.tacticalEquipmentIds.length, 1);
});

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
