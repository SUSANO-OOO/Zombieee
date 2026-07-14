import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { AUDIO_CATEGORIES } from "../app/audioManifest.js";
import { CAMPAIGN_STAGE_IDS } from "../app/campaign.js";
import {
  LEGACY_SFX_CUE_MAP,
  PRODUCTION_AUDIO_MANIFEST,
  PRODUCTION_AUDIO_SCENE_IDS,
  enemyVoiceCue,
  humanVoiceCueForUnit,
  sceneIdForScreen,
  weaponCueForUnit,
} from "../app/productionAudio.js";

const repositoryRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function publicFileFor(sourcePath) {
  return path.join(repositoryRoot, "public", ...sourcePath.split("/").filter(Boolean));
}

function inventoryPaths(folder, extension) {
  const directory = path.join(repositoryRoot, "public", "audio", "v060", folder);
  return readdirSync(directory)
    .filter((name) => name.endsWith(`.${extension}`))
    .map((name) => `/audio/v060/${folder}/${name}`);
}

test("production manifest maps complete MP3 and OGG alternates for all 9 tracks and 100 SFX", () => {
  const manifestPaths = PRODUCTION_AUDIO_MANIFEST.assets.flatMap((asset) => asset.sources.map((source) => source.src));
  const actualPaths = [
    ...inventoryPaths("music", "mp3"),
    ...inventoryPaths("music", "ogg"),
    ...inventoryPaths("sfx", "mp3"),
    ...inventoryPaths("sfx", "ogg"),
  ];
  assert.equal(inventoryPaths("music", "mp3").length, 9);
  assert.equal(inventoryPaths("music", "ogg").length, 9);
  assert.equal(inventoryPaths("sfx", "mp3").length, 100);
  assert.equal(inventoryPaths("sfx", "ogg").length, 100);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.assets.length, 109);
  assert.equal(manifestPaths.length, 218);
  assert.equal(new Set(manifestPaths).size, manifestPaths.length);
  assert.deepEqual([...manifestPaths].sort(), [...actualPaths].sort());
});

test("every referenced source is repository-local, exists, and has a valid MP3 or OGG header", () => {
  for (const asset of PRODUCTION_AUDIO_MANIFEST.assets) {
    assert.equal(asset.sources.length, 2, asset.id);
    assert.deepEqual(asset.sources.map((source) => source.type), ["audio/mpeg", "audio/ogg"], asset.id);
    for (const source of asset.sources) {
      assert.match(source.src, /^\/audio\/v060\/(music|sfx)\/[a-z0-9-]+\.(mp3|ogg)$/);
      assert.doesNotMatch(source.src, /:\/\/|^\/\//);
      const filePath = publicFileFor(source.src);
      assert.equal(existsSync(filePath), true, `${asset.id}: ${source.src}`);
      const header = readFileSync(filePath).subarray(0, 4);
      if (source.src.endsWith(".ogg")) assert.equal(header.toString("ascii"), "OggS", source.src);
      else assert.equal(header.subarray(0, 3).toString("ascii"), "ID3", source.src);
    }
  }
});

test("production manifest covers every required mixer category with valid two-sample variation pools", () => {
  assert.deepEqual(
    [...new Set(PRODUCTION_AUDIO_MANIFEST.assets.map((asset) => asset.category))].sort(),
    [...AUDIO_CATEGORIES].sort(),
  );
  assert.equal(PRODUCTION_AUDIO_MANIFEST.pools.length, 41);
  for (const pool of PRODUCTION_AUDIO_MANIFEST.pools) {
    assert.equal(pool.assetIds.length, 2, pool.id);
    assert.equal(new Set(pool.assetIds).size, 2, pool.id);
    for (const assetId of pool.assetIds) {
      assert.equal(PRODUCTION_AUDIO_MANIFEST.assetById[assetId]?.category, pool.category, `${pool.id}: ${assetId}`);
    }
  }
  for (const cueId of [
    "ui-confirm",
    "ui-error",
    "radio-open",
    "radio-static-loop",
    "support-airstrike",
    "support-heal",
    "infection-warning-01",
    "infection-twitch-01",
    "corpse-ignite",
    "corpse-burn-loop",
  ]) {
    assert.ok(PRODUCTION_AUDIO_MANIFEST.assetById[cueId], cueId);
  }
  assert.equal(PRODUCTION_AUDIO_MANIFEST.assetById["corpse-burn-loop"].category, "support");
});

test("all ten scenes resolve and the three stages plus boss use distinct tracks", () => {
  const expectedScenes = ["title", "intro", "map", "loadout", "stage1", "stage2", "stage3", "boss", "victory", "defeat"];
  assert.deepEqual(PRODUCTION_AUDIO_MANIFEST.scenes.map((scene) => scene.id), expectedScenes);
  assert.deepEqual(Object.values(PRODUCTION_AUDIO_SCENE_IDS), expectedScenes);
  for (const scene of PRODUCTION_AUDIO_MANIFEST.scenes) {
    assert.ok(PRODUCTION_AUDIO_MANIFEST.assetById[scene.bgm], `${scene.id}: ${scene.bgm}`);
    for (const cueId of [...scene.ambience, ...scene.preload]) {
      assert.ok(PRODUCTION_AUDIO_MANIFEST.assetById[cueId] || PRODUCTION_AUDIO_MANIFEST.poolById[cueId], `${scene.id}: ${cueId}`);
    }
  }
  const battleSceneIds = ["stage1", "stage2", "stage3", "boss"];
  const battleMusicIds = battleSceneIds.map((sceneId) => PRODUCTION_AUDIO_MANIFEST.sceneById[sceneId].bgm);
  const battleMusicPaths = battleMusicIds.map((assetId) => PRODUCTION_AUDIO_MANIFEST.assetById[assetId].sources[0].src);
  assert.equal(new Set(battleMusicIds).size, battleSceneIds.length);
  assert.equal(new Set(battleMusicPaths).size, battleSceneIds.length);
});

test("screen and stage routing selects title, story, preparation, stage, boss, and outcome scenes", () => {
  assert.equal(sceneIdForScreen("title"), "title");
  assert.equal(sceneIdForScreen("event"), "intro");
  assert.equal(sceneIdForScreen("map"), "map");
  assert.equal(sceneIdForScreen("loadout"), "loadout");
  assert.equal(sceneIdForScreen("battle", CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET, "normal"), "stage1");
  assert.equal(sceneIdForScreen("battle", CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE, { musicMode: "danger" }), "stage2");
  assert.equal(sceneIdForScreen("battle", CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE, { musicMode: "normal" }), "stage3");
  assert.equal(sceneIdForScreen("battle", CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE, { musicMode: "boss" }), "boss");
  assert.equal(sceneIdForScreen("result", null, { won: true }), "victory");
  assert.equal(sceneIdForScreen("result", null, { end: { won: false } }), "defeat");
  assert.equal(sceneIdForScreen("unknown"), null);
});

test("all six units map to matching weapon pools and sex/body-profile nonverbal voice pools", () => {
  const expectedWeapons = {
    scout: "weapon-crowbar",
    ranger: "weapon-rifle",
    brute: "weapon-hammer",
    brawler: "weapon-unarmed",
    gunner: "weapon-gunner",
    medic: "weapon-rifle",
  };
  for (const [kind, expectedCue] of Object.entries(expectedWeapons)) {
    assert.equal(weaponCueForUnit(kind), expectedCue);
    assert.ok(PRODUCTION_AUDIO_MANIFEST.poolById[expectedCue], `${kind}: ${expectedCue}`);
    for (const event of ["attack", "hurt", "death"]) {
      const voiceCue = humanVoiceCueForUnit(kind, event);
      assert.ok(PRODUCTION_AUDIO_MANIFEST.poolById[voiceCue], `${kind}: ${event}`);
    }
  }
  assert.match(humanVoiceCueForUnit("ranger", "hurt"), /^human-female-/);
  assert.match(humanVoiceCueForUnit("gunner", "death"), /^human-female-/);
  assert.match(humanVoiceCueForUnit("brute", "attack"), /^human-male-heavy-/);
  assert.match(humanVoiceCueForUnit("scout", "hurt"), /^human-male-light-/);
  assert.equal(weaponCueForUnit("unknown"), null);
  assert.equal(humanVoiceCueForUnit("scout", "speech"), null);
});

test("all eight enemy kinds expose distinct attack, hurt, and death variation pools", () => {
  const enemyKinds = ["walker", "runner", "spitter", "crusher", "shade", "abomination", "turned", "takuya"];
  const cueIds = [];
  for (const kind of enemyKinds) {
    for (const event of ["attack", "hurt", "death"]) {
      const cueId = enemyVoiceCue(kind, event);
      cueIds.push(cueId);
      assert.ok(PRODUCTION_AUDIO_MANIFEST.poolById[cueId], `${kind}: ${event}`);
      assert.equal(PRODUCTION_AUDIO_MANIFEST.poolById[cueId].category, "monsters");
    }
  }
  assert.equal(new Set(cueIds).size, 24);
  assert.equal(enemyVoiceCue("crawler", "attack"), null);
  assert.equal(enemyVoiceCue("walker", "spawn"), null);
});

test("legacy SFX mapping covers every current SFX_CUES key and only targets production cues", () => {
  const source = readFileSync(path.join(repositoryRoot, "app", "AshfallGame.tsx"), "utf8");
  const start = source.indexOf("const SFX_CUES = {");
  const end = source.indexOf("} as const satisfies Record<string, SfxCueDef>;", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const cueBlock = source.slice(start, end);
  const currentCueIds = [...cueBlock.matchAll(/^\s*(?:"([^"]+)"|([a-z][a-z0-9-]*)):\s*\{\s*category:/gm)]
    .map((match) => match[1] ?? match[2]);
  assert.equal(currentCueIds.length, 55);
  assert.deepEqual(Object.keys(LEGACY_SFX_CUE_MAP).sort(), currentCueIds.sort());
  for (const [legacyId, productionId] of Object.entries(LEGACY_SFX_CUE_MAP)) {
    assert.ok(
      PRODUCTION_AUDIO_MANIFEST.assetById[productionId] || PRODUCTION_AUDIO_MANIFEST.poolById[productionId],
      `${legacyId}: ${productionId}`,
    );
  }
  assert.equal(LEGACY_SFX_CUE_MAP.victory, "ui-confirm");
  assert.equal(LEGACY_SFX_CUE_MAP.defeat, "ui-cancel");
  assert.notEqual(LEGACY_SFX_CUE_MAP.victory, "music-victory");
  assert.notEqual(LEGACY_SFX_CUE_MAP.defeat, "music-defeat");
});

test("gameplay routes scenes and combat identity through production audio before oscillator fallback", () => {
  const source = readFileSync(path.join(repositoryRoot, "app", "AshfallGame.tsx"), "utf8");
  assert.match(source, /createAudioMixer\(\{[\s\S]*manifest: PRODUCTION_AUDIO_MANIFEST/);
  assert.match(source, /const productionCue = LEGACY_SFX_CUE_MAP\[cueId\]/);
  assert.match(source, /if \(!productionMixer \|\| !productionCue\) return playSynthCue\(cueId, options\)/);
  assert.match(source, /await productionMixer\.play\(productionCue/);
  assert.match(source, /durationSeconds: productionCue === "radio-open" \? \.72 : undefined/);
  assert.match(source, /durationSeconds: active \? \.72 : undefined/);
  assert.match(source, /onLoadFailure: \(\) => playSynthCue\(cueId, options\)/);
  assert.match(source, /setScene\(sceneId, \{ onBgmLoadFailure: startSynthMusic \}\)/);
  assert.match(source, /sceneIdForScreen\(screen, selectedStageId, musicState\)/);
  assert.match(source, /if \(desiredProductionSceneRef\.current === sceneId\) return/);
  assert.match(source, /setScene\(sceneId, \{ onBgmLoadFailure: \(\) => startSynthMusicRef\.current\(\) \}\)/);
  assert.match(source, /createAudioMixer\(\{[\s\S]*maxVoices: 28/);
  assert.match(source, /const localQaAudio = Boolean\(legacyQa \|\| campaignQa\)/);
  assert.match(source, /setBgmMuted\(localQaAudio \? false : !loaded\.settings\.bgmEnabled\)/);
  assert.match(source, /bgmVolume: campaignSave\.settings\.bgmVolume/);
  assert.match(source, /sfxVolume: campaignSave\.settings\.sfxVolume/);
  assert.match(source, /bgmMuted \|\| !sceneId \|\| \(screen === "battle" && paused\)/);
  assert.match(source, /weaponCueForUnit\(f\.kind\)/);
  assert.match(source, /humanVoiceCueForUnit\(f\.kind, "attack"\)/);
  assert.match(source, /humanVoiceCueForUnit\(fighter\.kind, "death"\)/);
  assert.match(source, /enemyVoiceCue\(f\.kind, "attack"\)/);
  assert.match(source, /enemyVoiceCue\(fighter\.kind, "death"\)/);
  assert.match(source, /"infection-warning-01"/);
  assert.match(source, /"corpse-burn-loop"/);
  assert.match(source, /instanceKey: "corpse-burn-loop",[\s\S]*maxInstances: 3/);
});

test("localhost-only audio QA bridge can inspect and individually play every asset, pool, and scene", () => {
  const source = readFileSync(path.join(repositoryRoot, "app", "AshfallGame.tsx"), "utf8");
  assert.match(source, /const isLocalQa = window\.location\.hostname === "localhost" \|\| window\.location\.hostname === "127\.0\.0\.1"/);
  assert.match(source, /if \(isLocalQa\) \{[\s\S]*qaWindow\.__ASHFALL_AUDIO_QA__ = qaBridge/);
  assert.match(source, /assets: qaAssets/);
  assert.match(source, /pools: qaPools/);
  assert.match(source, /cueIds: \[\.\.\.qaAssets\.map[\s\S]*\.\.\.qaPools\.map/);
  assert.match(source, /sceneIds: PRODUCTION_AUDIO_MANIFEST\.scenes\.map/);
  assert.match(source, /play: async \(cueId: string,[\s\S]*mixer\.play\(cueId, options\)/);
  assert.match(source, /setScene: async \(sceneId: string\)[\s\S]*mixer\.setScene\(sceneId\)/);
  assert.match(source, /stopScene: \(fadeMs = 0\) => mixer\.stopScene/);
  assert.match(source, /stopAll: \(fadeMs = 0\) => mixer\.stopAll/);
  assert.match(source, /dataset\.audioManifestSources = String\(qaBridge\.assetPaths\.length\)/);
  assert.match(source, /dataset\.audioQaCues = String\(qaBridge\.cueIds\.length\)/);
  assert.match(source, /dataset\.audioQaScenes = String\(qaBridge\.sceneIds\.length\)/);

  const allCueIds = [
    ...PRODUCTION_AUDIO_MANIFEST.assets.map((asset) => asset.id),
    ...PRODUCTION_AUDIO_MANIFEST.pools.map((pool) => pool.id),
  ];
  assert.equal(allCueIds.length, 150);
  assert.equal(new Set(allCueIds).size, allCueIds.length);
  for (const category of ["bgm", "weapons", "melee", "humanVoices", "monsters", "support"]) {
    assert.ok(
      PRODUCTION_AUDIO_MANIFEST.assets.some((asset) => asset.category === category)
        || PRODUCTION_AUDIO_MANIFEST.pools.some((pool) => pool.category === category),
      category,
    );
  }
});
