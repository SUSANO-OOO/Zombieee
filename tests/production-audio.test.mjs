import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { AUDIO_CATEGORIES } from "../app/audioManifest.js";
import { CAMPAIGN_STAGE_IDS } from "../app/campaign.js";
import {
  BATTLE_AUDIO_LOOP_CONTRACTS,
  LEGACY_SFX_CUE_MAP,
  PRODUCTION_AUDIO_MANIFEST,
  PRODUCTION_AUDIO_SCENE_IDS,
  UNIT_AUDIO_CUE_CONTRACTS,
  enemyVoiceCue,
  humanVoiceCueForUnit,
  sceneIdForScreen,
  stopBattleAudioLoops,
  unitAudioCueFor,
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

function countMp3Frames(buffer) {
  let offset = 0;
  if (buffer.subarray(0, 3).toString("ascii") === "ID3") {
    const size = ((buffer[6] & 0x7f) << 21) | ((buffer[7] & 0x7f) << 14) | ((buffer[8] & 0x7f) << 7) | (buffer[9] & 0x7f);
    offset = 10 + size;
  }
  let frames = 0;
  while (offset + 4 <= buffer.length) {
    const header = buffer.readUInt32BE(offset);
    if (((header & 0xffe00000) >>> 0) !== 0xffe00000) break;
    const versionBits = (header >>> 19) & 0x3;
    const layerBits = (header >>> 17) & 0x3;
    const bitrateIndex = (header >>> 12) & 0xf;
    const sampleRateIndex = (header >>> 10) & 0x3;
    const padding = (header >>> 9) & 0x1;
    if (versionBits === 1 || layerBits !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) break;
    const mpeg1Bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
    const mpeg2Bitrates = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
    const sampleRates = versionBits === 3 ? [44100, 48000, 32000] : versionBits === 2 ? [22050, 24000, 16000] : [11025, 12000, 8000];
    const bitrate = (versionBits === 3 ? mpeg1Bitrates : mpeg2Bitrates)[bitrateIndex] * 1000;
    const frameLength = Math.floor((versionBits === 3 ? 144 : 72) * bitrate / sampleRates[sampleRateIndex]) + padding;
    if (frameLength < 24 || offset + frameLength > buffer.length) break;
    frames += 1;
    offset += frameLength;
  }
  return frames;
}

function inspectOggVorbis(buffer) {
  let offset = 0;
  let pages = 0;
  let eos = false;
  let lastGranule = 0n;
  while (offset < buffer.length) {
    assert.equal(buffer.subarray(offset, offset + 4).toString("ascii"), "OggS");
    assert.equal(buffer[offset + 4], 0);
    const segmentCount = buffer[offset + 26];
    const headerLength = 27 + segmentCount;
    assert.ok(offset + headerLength <= buffer.length);
    let payloadLength = 0;
    for (let index = 0; index < segmentCount; index += 1) payloadLength += buffer[offset + 27 + index];
    assert.ok(offset + headerLength + payloadLength <= buffer.length);
    eos ||= Boolean(buffer[offset + 5] & 0x04);
    lastGranule = buffer.readBigUInt64LE(offset + 6);
    pages += 1;
    offset += headerLength + payloadLength;
  }
  const ascii = buffer.toString("latin1");
  return {
    pages,
    eos,
    lastGranule,
    identification: ascii.includes("\u0001vorbis"),
    comments: ascii.includes("\u0003vorbis"),
    setup: ascii.includes("\u0005vorbis"),
  };
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

test("production manifest maps complete MP3 and OGG alternates for all 9 tracks and 126 SFX", () => {
  const manifestPaths = PRODUCTION_AUDIO_MANIFEST.assets.flatMap((asset) => asset.sources.map((source) => source.src));
  const actualPaths = [
    ...inventoryPaths("music", "mp3"),
    ...inventoryPaths("music", "ogg"),
    ...inventoryPaths("sfx", "mp3"),
    ...inventoryPaths("sfx", "ogg"),
  ];
  assert.equal(inventoryPaths("music", "mp3").length, 9);
  assert.equal(inventoryPaths("music", "ogg").length, 9);
  assert.equal(inventoryPaths("sfx", "mp3").length, 126);
  assert.equal(inventoryPaths("sfx", "ogg").length, 126);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.assets.length, 135);
  assert.equal(manifestPaths.length, 270);
  assert.equal(new Set(manifestPaths).size, manifestPaths.length);
  assert.deepEqual([...manifestPaths].sort(), [...actualPaths].sort());
});

test("every referenced source is repository-local, nonempty, and has parseable MP3 frames or complete OGG Vorbis pages", () => {
  for (const asset of PRODUCTION_AUDIO_MANIFEST.assets) {
    assert.equal(asset.sources.length, 2, asset.id);
    assert.deepEqual(asset.sources.map((source) => source.type), ["audio/mpeg", "audio/ogg"], asset.id);
    for (const source of asset.sources) {
      assert.match(source.src, /^\/audio\/v060\/(music|sfx)\/[a-z0-9-]+\.(mp3|ogg)$/);
      assert.doesNotMatch(source.src, /:\/\/|^\/\//);
      const filePath = publicFileFor(source.src);
      assert.equal(existsSync(filePath), true, `${asset.id}: ${source.src}`);
      const bytes = readFileSync(filePath);
      assert.ok(bytes.length > 512, source.src);
      if (source.src.endsWith(".ogg")) {
        const parsed = inspectOggVorbis(bytes);
        assert.ok(parsed.pages >= 2, source.src);
        assert.equal(parsed.eos, true, source.src);
        assert.ok(parsed.lastGranule > 0n, source.src);
        assert.equal(parsed.identification && parsed.comments && parsed.setup, true, source.src);
      } else {
        assert.equal(bytes.subarray(0, 3).toString("ascii"), "ID3", source.src);
        assert.ok(countMp3Frames(bytes) >= 2, source.src);
      }
    }
  }
});

test("all 26 newcomer cues bind dedicated generated masters to dedicated MP3 and OGG finals", () => {
  const provenancePath = path.join(repositoryRoot, "reference", "audio", "generated-audio-provenance-v1.json");
  const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
  assert.equal(provenance.version, 1);
  assert.equal(provenance.generator, "scripts/build-v060-audio.py");
  assert.equal(provenance.cues.length, 26);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.aliases.length, 0);
  const cueIds = new Set(provenance.cues.map(({ id }) => id));
  assert.equal(cueIds.size, 26);
  for (const record of provenance.cues) {
    assert.equal(record.origin, "project-original deterministic synthesis; no sampled recording", record.id);
    assert.ok(record.source.path.endsWith(`${record.id}.wav`), record.id);
    const sourcePath = path.join(repositoryRoot, ...record.source.path.split("/"));
    assert.equal(sha256(sourcePath), record.source.sha256, record.id);
    const asset = PRODUCTION_AUDIO_MANIFEST.assetById[record.id];
    assert.ok(asset, record.id);
    assert.deepEqual(asset.sources.map(({ src }) => src), record.finals.map(({ path: finalPath }) => `/${finalPath.replace(/^public\//, "")}`), record.id);
    for (const final of record.finals) {
      const finalPath = path.join(repositoryRoot, ...final.path.split("/"));
      assert.equal(sha256(finalPath), final.sha256, `${record.id}: ${final.path}`);
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

test("all nine units map to production weapon cues and body-profile nonverbal voice cues", () => {
  const expectedWeapons = {
    scout: "weapon-crowbar",
    ranger: "weapon-rifle",
    brute: "weapon-hammer",
    brawler: "weapon-unarmed",
    gunner: "weapon-gunner",
    medic: "weapon-rifle",
    "crazy-king": "weapon-chainsaw-attack",
    kumaverson: "weapon-pan-swing",
    babayaga: "weapon-suppressed-pistol",
  };
  for (const [kind, expectedCue] of Object.entries(expectedWeapons)) {
    assert.equal(weaponCueForUnit(kind), expectedCue);
    assert.ok(
      PRODUCTION_AUDIO_MANIFEST.assetById[expectedCue]
        || PRODUCTION_AUDIO_MANIFEST.poolById[expectedCue]
        || PRODUCTION_AUDIO_MANIFEST.aliasById[expectedCue],
      `${kind}: ${expectedCue}`,
    );
    for (const event of ["attack", "hurt", "death"]) {
      const voiceCue = humanVoiceCueForUnit(kind, event);
      assert.ok(
        PRODUCTION_AUDIO_MANIFEST.assetById[voiceCue]
          || PRODUCTION_AUDIO_MANIFEST.poolById[voiceCue]
          || PRODUCTION_AUDIO_MANIFEST.aliasById[voiceCue],
        `${kind}: ${event}`,
      );
    }
  }
  assert.match(humanVoiceCueForUnit("ranger", "hurt"), /^human-female-/);
  assert.match(humanVoiceCueForUnit("gunner", "death"), /^human-female-/);
  assert.match(humanVoiceCueForUnit("brute", "attack"), /^human-male-heavy-/);
  assert.match(humanVoiceCueForUnit("scout", "hurt"), /^human-male-light-/);
  assert.equal(humanVoiceCueForUnit("crazy-king", "deploy"), "voice-crazy-king-deploy");
  assert.equal(humanVoiceCueForUnit("kumaverson", "hurt"), "voice-kumaverson-hurt");
  assert.equal(humanVoiceCueForUnit("babayaga", "death"), "voice-babayaga-death");
  assert.equal(weaponCueForUnit("unknown"), null);
  assert.equal(humanVoiceCueForUnit("scout", "speech"), null);
});

test("new-unit contracts resolve to dedicated original production assets and expose stoppable battle loops", () => {
  assert.equal(PRODUCTION_AUDIO_MANIFEST.aliases.length, 0);
  assert.equal(Object.keys(UNIT_AUDIO_CUE_CONTRACTS).length, 3);
  const dedicatedCueIds = Object.values(UNIT_AUDIO_CUE_CONTRACTS).flatMap((contract) => [
    ...Object.values(contract.weaponEvents),
    ...Object.values(contract.voiceEvents),
  ]);
  assert.equal(new Set(dedicatedCueIds).size, 26);
  for (const cueId of dedicatedCueIds) {
    const asset = PRODUCTION_AUDIO_MANIFEST.assetById[cueId];
    assert.ok(asset, cueId);
    assert.deepEqual(asset.sources.map((source) => source.type), ["audio/mpeg", "audio/ogg"], cueId);
  }

  assert.equal(unitAudioCueFor("crazy-king", "weapon", "idleLoop"), "weapon-chainsaw-idle-loop");
  assert.equal(unitAudioCueFor("kumaverson", "weapon", "stun"), "weapon-pan-stun");
  assert.equal(unitAudioCueFor("babayaga", "weapon", "reload"), "weapon-suppressed-reload");
  assert.equal(unitAudioCueFor("babayaga", "voice", "deploy"), "voice-babayaga-deploy");
  assert.equal(unitAudioCueFor("unknown", "weapon", "attack"), null);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.assetById["weapon-chainsaw-idle-loop"].loop, true);
  assert.deepEqual(BATTLE_AUDIO_LOOP_CONTRACTS.crazyKingChainsaw, {
    cueId: "weapon-chainsaw-idle-loop",
    category: "weapons",
    instanceKey: "chainsaw-idle-loop",
  });

  const calls = [];
  const stopped = stopBattleAudioLoops({
    stopInstances: (instanceKeys, options) => {
      calls.push({ instanceKeys, options });
      return instanceKeys.length;
    },
  }, { fadeMs: 80 });
  assert.equal(stopped, 2);
  assert.deepEqual(calls, [{
    instanceKeys: ["corpse-burn-loop", "chainsaw-idle-loop"],
    options: { fadeMs: 80 },
  }]);
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
  assert.equal(currentCueIds.length, 58);
  assert.deepEqual(Object.keys(LEGACY_SFX_CUE_MAP).sort(), currentCueIds.sort());
  for (const [legacyId, productionId] of Object.entries(LEGACY_SFX_CUE_MAP)) {
    assert.ok(
      PRODUCTION_AUDIO_MANIFEST.assetById[productionId]
        || PRODUCTION_AUDIO_MANIFEST.poolById[productionId]
        || PRODUCTION_AUDIO_MANIFEST.aliasById[productionId],
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
  assert.match(source, /runGuardedAudioRequest\(\{[\s\S]*play: \(guardedFallback\) => productionMixer\.play\(productionCue/);
  assert.match(source, /onLoadFailure: guardedFallback/);
  assert.match(source, /sfxRequestGateRef\.current\.cancelPending\(\)/);
  assert.match(source, /durationSeconds: productionCue === "radio-open" \? \.72 : undefined/);
  assert.match(source, /durationSeconds: active \? \.72 : undefined/);
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
  assert.match(source, /BATTLE_AUDIO_LOOP_CONTRACTS\.corpseBurn\.cueId/);
  assert.match(source, /instanceKey: BATTLE_AUDIO_LOOP_CONTRACTS\.corpseBurn\.instanceKey/);
  const corpseBurnAsset = PRODUCTION_AUDIO_MANIFEST.assets.find(({ id }) => id === BATTLE_AUDIO_LOOP_CONTRACTS.corpseBurn.cueId);
  assert.equal(corpseBurnAsset?.loop, true);
  assert.equal(corpseBurnAsset?.maxInstances, 3);
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
  assert.equal(allCueIds.length, 176);
  assert.equal(new Set(allCueIds).size, allCueIds.length);
  for (const category of ["bgm", "weapons", "melee", "humanVoices", "monsters", "support"]) {
    assert.ok(
      PRODUCTION_AUDIO_MANIFEST.assets.some((asset) => asset.category === category)
        || PRODUCTION_AUDIO_MANIFEST.pools.some((pool) => pool.category === category),
      category,
    );
  }
});
