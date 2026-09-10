import test from "node:test";
import assert from "node:assert/strict";

import {
  BATTLE_PRESSURE_SCENE_BY_NORMAL_SCENE,
  BATTLE_PRESSURE_SCENE_BY_STAGE_ID,
  BATTLE_STAGE_SCENE_BY_ID,
  PRODUCTION_AUDIO_MANIFEST,
  TAKUYA_ENTRANCE_AUDIO,
  TAKUYA_ENTRANCE_MUSIC_DUCK,
  V099_MANUAL_ABILITY_AUDIO_CONTRACTS,
  V099_PHYSICAL_AUDIO_ASSET_COUNT,
  V099_SUPPORT_POD_AUDIO_CONTRACT,
  battleSceneTransitionCrossfadeMs,
  sceneIdForScreen,
} from "../app/productionAudio.js";
import { CAMPAIGN_STAGES } from "../app/campaign.js";
import {
  V099_ABILITY_ROOT_AUDIO_CUES,
  V099_MUSIC_AUDIO_CUES,
  V099_READY_AUDIO_CUES,
  V099_TIMELINE_AUDIO_CUES,
} from "../app/battleAudioContracts.js";

test("v0.9.9.0 ships exactly 37 one-source physical audio assets after final BGM remediation", () => {
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

test("the exact 16-unit ready and timeline matrix matches design revision v2", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(V099_MANUAL_ABILITY_AUDIO_CONTRACTS).map(([kind, contract]) => [kind, contract.readyCue])), {
    brawler: "ability-ready-melee",
    scout: "ability-ready-melee",
    ranger: "ability-ready-ranged",
    medic: "ability-ready-support",
    brute: "ability-ready-melee",
    "crazy-king": "ability-ready-melee",
    kumaverson: "ability-ready-support",
    babayaga: "ability-ready-ranged",
    gunner: "ability-ready-ranged",
    guardian: "ability-ready-support",
    engineer: "ability-ready-support",
    zakimiya: "ability-ready-ranged",
    tky: "ability-ready-melee",
    "mrs-chiha": "ability-ready-ranged",
    "miyamoto-musashi": "ability-ready-melee",
    "mayo-chan": "ability-ready-support",
  });
  assert.deepEqual(V099_MANUAL_ABILITY_AUDIO_CONTRACTS.medic.timeline, { success: "ability-medic-treatment" });
  assert.deepEqual(V099_MANUAL_ABILITY_AUDIO_CONTRACTS.guardian.timeline, { hold: "ability-guardian-shieldwall-hold" });
  assert.deepEqual(V099_MANUAL_ABILITY_AUDIO_CONTRACTS.zakimiya.timeline, {
    throw: "ability-zakimiya-molotov-throw",
    impact: "ability-zakimiya-molotov-impact",
    burn: "ability-zakimiya-molotov-burn",
  });
  assert.equal(V099_MANUAL_ABILITY_AUDIO_CONTRACTS["mrs-chiha"].timeline.flight, "weapon-mrs-chiha-grenade-flight");
  assert.equal(V099_MANUAL_ABILITY_AUDIO_CONTRACTS["mrs-chiha"].timeline.stow, "weapon-mrs-chiha-launcher-stow");
  assert.equal(V099_MUSIC_AUDIO_CUES.length, 4);
  assert.equal(V099_ABILITY_ROOT_AUDIO_CUES.length, 12);
  assert.equal(V099_TIMELINE_AUDIO_CUES.length, 18);
  assert.equal(V099_READY_AUDIO_CUES.length, 3);
  assert.equal(4 + 12 + 18 + 3, V099_PHYSICAL_AUDIO_ASSET_COUNT);
});

test("stage and pressure maps are explicit for every campaign stage", () => {
  const legacyStageIds = new Set(CAMPAIGN_STAGES.map(({ id }) => id));
  const legacyStageScenes = Object.fromEntries(Object.entries(BATTLE_STAGE_SCENE_BY_ID)
    .filter(([stageId]) => legacyStageIds.has(stageId)));
  const legacyPressureScenes = Object.fromEntries(Object.entries(BATTLE_PRESSURE_SCENE_BY_STAGE_ID)
    .filter(([stageId]) => legacyStageIds.has(stageId)));
  const legacyNormalSceneIds = new Set(Object.values(legacyStageScenes));
  const legacyPressureByNormalScene = Object.fromEntries(Object.entries(BATTLE_PRESSURE_SCENE_BY_NORMAL_SCENE)
    .filter(([normalSceneId]) => legacyNormalSceneIds.has(normalSceneId)));
  assert.equal(Object.keys(legacyStageScenes).length, 20);
  assert.equal(Object.keys(legacyPressureScenes).length, 20);
  assert.equal(Object.values(legacyPressureScenes).filter(Boolean).length, 20);
  assert.deepEqual([...new Set(Object.values(legacyPressureByNormalScene))].sort(), ["pressure-station", "pressure-surface"].sort());
});

test("support pod lifecycle has distinct PR2-owned semantic cues", () => {
  assert.deepEqual(Object.keys(V099_SUPPORT_POD_AUDIO_CONTRACT), ["inbound", "landing", "activation", "complete"]);
  assert.equal(new Set(Object.values(V099_SUPPORT_POD_AUDIO_CONTRACT)).size, 4);
  for (const cueId of Object.values(V099_SUPPORT_POD_AUDIO_CONTRACT)) {
    assert.ok(PRODUCTION_AUDIO_MANIFEST.aliasById[cueId], cueId);
    assert.equal(PRODUCTION_AUDIO_MANIFEST.assets.some((asset) => asset.id === cueId), false, cueId);
  }
});

test("pressure and boss transitions use explicit 600/250/600ms adapters and fail closed", () => {
  assert.equal(battleSceneTransitionCrossfadeMs("stage1", "pressure-surface"), 600);
  assert.equal(battleSceneTransitionCrossfadeMs("pressure-station", "station-platform"), 600);
  assert.equal(battleSceneTransitionCrossfadeMs("stage2", "boss"), 250);
  assert.equal(battleSceneTransitionCrossfadeMs("pressure-surface", "boss"), 250);
  assert.equal(battleSceneTransitionCrossfadeMs("boss", "stage3"), 600);
  assert.equal(battleSceneTransitionCrossfadeMs("boss", "pressure-station"), 600);
  assert.equal(battleSceneTransitionCrossfadeMs("stage1", "stage2"), null);
  assert.equal(sceneIdForScreen("battle", "missing-stage", { musicMode: "pressure" }), null);
  assert.equal(sceneIdForScreen("battle", "missing-stage", { musicMode: "normal" }), null);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById["pressure-surface"].crossfadeMs, 600);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById.boss.crossfadeMs, 250);
});

test("all normal battle scenes use the audible v0.9.9.0 track and TAKUYA entrance owns a composing transient duck", () => {
  for (const sceneId of [
    "stage1", "stage2", "stage3", "station-gate", "station-platform", "station-tunnel",
    "story-stage1-battle", "story-stage2-battle", "story-stage3-battle",
    "story-station-gate-battle", "story-station-platform-battle", "story-station-tunnel-battle",
  ]) {
    assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById[sceneId].bgm, "music-v099-normal", sceneId);
  }
  assert.deepEqual(TAKUYA_ENTRANCE_MUSIC_DUCK, {
    level: 0.32,
    attackMs: 30,
    holdMs: 2920,
    releaseMs: 450,
  });
  assert.deepEqual(TAKUYA_ENTRANCE_AUDIO, {
    cueId: "sfx-v070-takuya-entrance",
    bossSceneId: "boss",
    musicDuck: TAKUYA_ENTRANCE_MUSIC_DUCK,
    durationSeconds: 3.4,
  });
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById[TAKUYA_ENTRANCE_AUDIO.bossSceneId].bgm, "music-boss");
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById[TAKUYA_ENTRANCE_AUDIO.bossSceneId].preload.includes("music-boss"), true);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById["story-boss"].bgm, "music-boss");
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById["story-boss"].preload.includes("music-boss"), true);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById["silence-stage3-entrance"], undefined);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById["silence-stage3-final"], undefined);
});
