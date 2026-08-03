import test from "node:test";
import assert from "node:assert/strict";

import {
  BATTLE_PRESSURE_SCENE_BY_NORMAL_SCENE,
  BATTLE_PRESSURE_SCENE_BY_STAGE_ID,
  BATTLE_STAGE_SCENE_BY_ID,
  PRODUCTION_AUDIO_MANIFEST,
  V099_MANUAL_ABILITY_AUDIO_CONTRACTS,
  V099_PHYSICAL_AUDIO_ASSET_COUNT,
  V099_SUPPORT_POD_AUDIO_CONTRACT,
} from "../app/productionAudio.js";

test("v0.9.9.0 PR2 ships exactly 36 one-source physical audio assets", () => {
  const assets = PRODUCTION_AUDIO_MANIFEST.assets.filter((asset) => asset.sources[0]?.src.startsWith("/audio/v099/"));
  assert.equal(assets.length, V099_PHYSICAL_AUDIO_ASSET_COUNT);
  assert.equal(new Set(assets.map((asset) => asset.id)).size, V099_PHYSICAL_AUDIO_ASSET_COUNT);
  assert.ok(assets.every((asset) => asset.sources.length === 1));
  assert.ok(assets.every((asset) => asset.sources[0].src.startsWith("/audio/v099/")));
});

test("all 16 manual abilities have an explicit ready family and activation root", () => {
  const expectedKinds = [
    "brawler", "scout", "ranger", "medic", "brute", "crazy-king", "kumaverson", "babayaga",
    "gunner", "guardian", "engineer", "zakimiya", "tky", "mrs-chiha", "miyamoto-musashi", "mayo-chan",
  ];
  assert.deepEqual(Object.keys(V099_MANUAL_ABILITY_AUDIO_CONTRACTS), expectedKinds);
  for (const kind of expectedKinds) {
    const contract = V099_MANUAL_ABILITY_AUDIO_CONTRACTS[kind];
    assert.ok(contract.readyCue, `${kind} ready cue`);
    assert.ok(contract.activationRoot, `${kind} activation root`);
    assert.ok(Object.keys(contract.timeline).length > 0, `${kind} timeline`);
  }
  assert.equal(V099_MANUAL_ABILITY_AUDIO_CONTRACTS["mrs-chiha"].activationRoot, "ability-mrs-chiha-salvo-activate");
  assert.equal(V099_MANUAL_ABILITY_AUDIO_CONTRACTS["miyamoto-musashi"].timeline.fallbackCross, "ability-musashi-fallback-cross");
});

test("stage and pressure maps are explicit for every campaign stage", () => {
  assert.equal(Object.keys(BATTLE_STAGE_SCENE_BY_ID).length, 20);
  assert.equal(Object.keys(BATTLE_PRESSURE_SCENE_BY_STAGE_ID).length, 20);
  assert.equal(Object.values(BATTLE_PRESSURE_SCENE_BY_STAGE_ID).filter(Boolean).length, 20);
  assert.deepEqual([...new Set(Object.values(BATTLE_PRESSURE_SCENE_BY_NORMAL_SCENE))].sort(), ["pressure-station", "pressure-surface"].sort());
});

test("support pod lifecycle has distinct PR2-owned semantic cues", () => {
  assert.deepEqual(Object.keys(V099_SUPPORT_POD_AUDIO_CONTRACT), ["inbound", "landing", "activation", "complete"]);
  assert.equal(new Set(Object.values(V099_SUPPORT_POD_AUDIO_CONTRACT)).size, 4);
});
