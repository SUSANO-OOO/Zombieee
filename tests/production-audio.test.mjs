import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { AUDIO_CATEGORIES } from "../app/audioManifest.js";
import { CAMPAIGN_STAGE_IDS } from "../app/campaign.js";
import { STORY_EVENT_IDS, STORY_EVENTS } from "../app/storyEvents.js";
import {
  BATTLE_AUDIO_LOOP_CONTRACTS,
  LEGACY_SFX_CUE_MAP,
  PRODUCTION_AUDIO_MANIFEST,
  PRODUCTION_AUDIO_SCENE_IDS,
  STATION_AUDIO_CUE_IDS,
  STORY_AUDIO_EVENT_SCENE_IDS,
  STORY_AUDIO_MIX,
  STORY_AUDIO_PHASE_RULES,
  STORY_AUDIO_SCENE_RULES,
  STORY_WARNING_EVENT_IDS,
  TAKUYA_ENTRANCE_AUDIO,
  UNIT_AUDIO_CUE_CONTRACTS,
  enemyVoiceCue,
  humanVoiceCueForUnit,
  sceneIdForStoryEvent,
  sceneIdForScreen,
  stopBattleAudioLoops,
  storyWarningCueForEvent,
  unitAudioCueFor,
  weaponCueForUnit,
} from "../app/productionAudio.js";

const repositoryRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function publicFileFor(sourcePath) {
  return path.join(repositoryRoot, "public", ...sourcePath.split("/").filter(Boolean));
}

function inventoryPaths(version, folder, extension) {
  const directory = path.join(repositoryRoot, "public", "audio", version, folder);
  return readdirSync(directory)
    .filter((name) => name.endsWith(`.${extension}`))
    .map((name) => `/audio/${version}/${folder}/${name}`);
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

test("production manifest preserves every v060 battle cue and adds only non-voice v070 story finals", () => {
  const manifestPaths = PRODUCTION_AUDIO_MANIFEST.assets.flatMap((asset) => asset.sources.map((source) => source.src));
  const v060Paths = [
    ...inventoryPaths("v060", "music", "mp3"),
    ...inventoryPaths("v060", "music", "ogg"),
    ...inventoryPaths("v060", "sfx", "mp3"),
    ...inventoryPaths("v060", "sfx", "ogg"),
  ];
  const v070Paths = [
    ...inventoryPaths("v070", "music", "mp3"),
    ...inventoryPaths("v070", "music", "ogg"),
    ...inventoryPaths("v070", "ambience", "mp3"),
    ...inventoryPaths("v070", "ambience", "ogg"),
    ...inventoryPaths("v070", "sfx", "mp3"),
    ...inventoryPaths("v070", "sfx", "ogg"),
  ];
  const activeV060Paths = manifestPaths.filter((sourcePath) => sourcePath.startsWith("/audio/v060/"));
  const activeV070Paths = manifestPaths.filter((sourcePath) => sourcePath.startsWith("/audio/v070/"));
  assert.equal(PRODUCTION_AUDIO_MANIFEST.version, 2);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.assets.length, 171);
  assert.equal(manifestPaths.length, 342);
  assert.equal(new Set(manifestPaths).size, manifestPaths.length);
  assert.equal(activeV060Paths.length, 270);
  assert.equal(activeV070Paths.length, 72);
  assert.deepEqual([...activeV060Paths].sort(), [...v060Paths].sort());
  assert.deepEqual([...activeV070Paths].sort(), [...v070Paths].sort());
  assert.equal(activeV060Paths.some((sourcePath) => /\/sfx\/(?:human-|voice-)/.test(sourcePath)), true);
  assert.equal(activeV070Paths.some((sourcePath) => /voice|speech|tts/i.test(sourcePath)), false);
});

test("every referenced source is repository-local, nonempty, and has parseable MP3 frames or complete OGG Vorbis pages", () => {
  for (const asset of PRODUCTION_AUDIO_MANIFEST.assets) {
    assert.equal(asset.sources.length, 2, asset.id);
    assert.deepEqual(asset.sources.map((source) => source.type), ["audio/mpeg", "audio/ogg"], asset.id);
    for (const source of asset.sources) {
      assert.match(source.src, /^\/audio\/(?:v060\/(?:music|sfx)|v070\/(?:music|ambience|sfx))\/[a-z0-9-]+\.(mp3|ogg)$/);
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

test("all 26 existing newcomer weapon and battle-voice cues remain active", () => {
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
  assert.equal(provenance.cues.filter(({ id }) => id.startsWith("voice-")).length, 12);
});

test("all 36 v070 cues are reproducible layered masters rather than placeholder beeps", () => {
  const provenancePath = path.join(repositoryRoot, "reference", "audio", "v070-generated", "provenance.json");
  const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
  assert.equal(provenance.version, 1);
  assert.equal(provenance.generator, "scripts/build-v070-story-audio.py");
  assert.equal(provenance.cues.length, 36);
  assert.equal(provenance.policy.includes("No story-dialogue voiceover is generated"), true);
  assert.equal(provenance.policy.includes("existing v060 battle voices are retained separately"), true);
  for (const record of provenance.cues) {
    assert.equal(record.simpleTone, false, record.id);
    assert.ok(record.layers.length >= 4, record.id);
    assert.doesNotMatch(record.id, /voice|speech/i);
    assert.equal(record.origin, "project-original deterministic layered synthesis; no sampled recording or generated voice");
    const sourcePath = path.join(repositoryRoot, ...record.source.path.split("/"));
    assert.equal(sha256(sourcePath), record.source.sha256, record.id);
    const asset = PRODUCTION_AUDIO_MANIFEST.assetById[record.id];
    assert.ok(asset, record.id);
    assert.equal(asset.loop, record.loop, record.id);
    assert.deepEqual(asset.sources.map(({ src }) => src), record.finals.map(({ path: finalPath }) => `/${finalPath.replace(/^public\//, "")}`), record.id);
    for (const final of record.finals) {
      const finalPath = path.join(repositoryRoot, ...final.path.split("/"));
      assert.equal(sha256(finalPath), final.sha256, `${record.id}: ${final.path}`);
    }
  }
  const entrance = provenance.cues.find(({ id }) => id === TAKUYA_ENTRANCE_AUDIO.cueId);
  assert.equal(entrance.durationSeconds, TAKUYA_ENTRANCE_AUDIO.durationSeconds);
  assert.deepEqual(entrance.layers, [
    "vehicle-metal-rip",
    "music-stop-gap",
    "heavy-footstep-1",
    "heavy-footstep-2",
    "heavy-footstep-3",
  ]);
});

test("TAKUYA entrance stops BGM for the authored metal tear and three-step sequence before boss music", () => {
  const source = readFileSync(path.join(repositoryRoot, "app", "AshfallGame.tsx"), "utf8");
  assert.deepEqual(TAKUYA_ENTRANCE_AUDIO, {
    cueId: "sfx-v070-takuya-entrance",
    silenceSceneId: "silence-stage3-entrance",
    durationSeconds: 3.4,
  });
  assert.equal(PRODUCTION_AUDIO_MANIFEST.assetById[TAKUYA_ENTRANCE_AUDIO.cueId].category, "monsters");
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById.stage3.preload.includes(TAKUYA_ENTRANCE_AUDIO.cueId), true);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById["story-stage3-battle"].preload.includes(TAKUYA_ENTRANCE_AUDIO.cueId), true);
  assert.match(source, /g\.takuyaEntranceAudioRemaining = TAKUYA_ENTRANCE_AUDIO\.durationSeconds/);
  assert.match(source, /playProductionCue\(TAKUYA_ENTRANCE_AUDIO\.cueId, W \/ 2/);
  assert.match(source, /takuyaEntranceAudioActive[\s\S]*TAKUYA_ENTRANCE_AUDIO\.silenceSceneId/);
  assert.match(source, /g\.takuyaEntranceAudioRemaining = Math\.max\(0, g\.takuyaEntranceAudioRemaining - dt\)/);
  assert.match(source, /if \(battleSilenceSceneId\(g\)\) return/);
  assert.match(source, /syncMusicMode\(bossActiveOrIncoming \? "boss"/);
});

test("production manifest keeps every mixer category and valid two-sample variation pools", () => {
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
  assert.equal(PRODUCTION_AUDIO_MANIFEST.assets.some((asset) => asset.category === "humanVoices"), true);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.pools.some((pool) => pool.category === "humanVoices"), true);
});

test("all 43 battle and authored story scenes resolve with intentional limited silence", () => {
  const expectedScenes = [
    "title", "intro", "map", "loadout", "stage1", "stage2", "stage3",
    "station-gate", "station-platform", "station-tunnel", "boss", "victory", "defeat",
    "silence-prologue-title", "story-kumaya-daily", "story-kumaya-crisis", "story-collapse-montage",
    "story-crawler-montage", "story-crawler-signal", "story-stage1-pre", "story-stage1-battle",
    "story-stage1-post", "story-stage2-pre", "story-stage2-battle", "story-stage2-post",
    "story-stage3-pre", "story-stage3-battle", "story-boss", "silence-stage3-entrance",
    "silence-stage3-final", "story-stage3-post",
    "story-station-briefing", "story-station-gate-pre", "story-station-gate-battle", "story-station-gate-post",
    "story-station-platform-pre", "story-station-platform-battle", "story-station-platform-post",
    "story-station-tunnel-pre", "story-station-tunnel-battle", "silence-station-seal",
    "story-station-return", "story-chapter-ending",
  ];
  assert.deepEqual(PRODUCTION_AUDIO_MANIFEST.scenes.map((scene) => scene.id), expectedScenes);
  assert.deepEqual(Object.values(PRODUCTION_AUDIO_SCENE_IDS), expectedScenes);
  for (const scene of PRODUCTION_AUDIO_MANIFEST.scenes) {
    if (scene.bgm) assert.ok(PRODUCTION_AUDIO_MANIFEST.assetById[scene.bgm], `${scene.id}: ${scene.bgm}`);
    for (const cueId of [...scene.ambience, ...scene.preload]) {
      assert.ok(PRODUCTION_AUDIO_MANIFEST.assetById[cueId] || PRODUCTION_AUDIO_MANIFEST.poolById[cueId], `${scene.id}: ${cueId}`);
    }
  }
  const battleSceneIds = ["stage1", "stage2", "stage3", "station-gate", "station-platform", "station-tunnel", "boss"];
  const battleMusicIds = battleSceneIds.map((sceneId) => PRODUCTION_AUDIO_MANIFEST.sceneById[sceneId].bgm);
  const battleMusicPaths = battleMusicIds.map((assetId) => PRODUCTION_AUDIO_MANIFEST.assetById[assetId].sources[0].src);
  assert.equal(new Set(battleMusicIds).size, battleSceneIds.length);
  assert.equal(new Set(battleMusicPaths).size, battleSceneIds.length);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById["silence-prologue-title"].bgm, undefined);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById["silence-prologue-title"].ambience.length, 0);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById["silence-prologue-title"].crossfadeMs, 0);
  assert.deepEqual(PRODUCTION_AUDIO_MANIFEST.sceneById["story-collapse-montage"].preload, []);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById[TAKUYA_ENTRANCE_AUDIO.silenceSceneId].bgm, undefined);
  assert.deepEqual(
    PRODUCTION_AUDIO_MANIFEST.sceneById[TAKUYA_ENTRANCE_AUDIO.silenceSceneId].preload,
    [TAKUYA_ENTRANCE_AUDIO.cueId],
  );
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById["silence-stage3-final"].bgm, undefined);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById["silence-stage3-final"].ambience.length, 0);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById["silence-station-seal"].bgm, undefined);
  assert.deepEqual(PRODUCTION_AUDIO_MANIFEST.sceneById["silence-station-seal"].ambience, ["ambience-v070-station-seal-aftermath-loop"]);
});

test("authored story scenes never bind existing human battle-voice cues", () => {
  const storySceneIds = PRODUCTION_AUDIO_MANIFEST.scenes
    .map(({ id }) => id)
    .filter((id) => id === "intro" || id.startsWith("story-") || id.startsWith("silence-"));
  assert.equal(storySceneIds.length, 31);
  for (const sceneId of storySceneIds) {
    const scene = PRODUCTION_AUDIO_MANIFEST.sceneById[sceneId];
    const cueIds = [scene.bgm, ...scene.ambience, ...scene.preload].filter(Boolean);
    for (const cueId of cueIds) {
      const cue = PRODUCTION_AUDIO_MANIFEST.assetById[cueId] ?? PRODUCTION_AUDIO_MANIFEST.poolById[cueId];
      assert.notEqual(cue?.category, "humanVoices", `${sceneId}: ${cueId}`);
    }
  }
  const v070Assets = PRODUCTION_AUDIO_MANIFEST.assets.filter((asset) => (
    asset.sources.some(({ src }) => src.startsWith("/audio/v070/"))
  ));
  assert.equal(v070Assets.some(({ category }) => category === "humanVoices"), false);
  const battleVoiceAssets = PRODUCTION_AUDIO_MANIFEST.assets.filter(({ category }) => category === "humanVoices");
  assert.equal(battleVoiceAssets.length, 30);
  for (const asset of battleVoiceAssets) {
    assert.match(
      asset.id,
      /^(?:human-(?:female|male-heavy|male-light)-(?:attack|hurt|death)-0[12]|voice-(?:crazy-king|kumaverson|babayaga)-(?:deploy|attack|hurt|death))$/,
    );
    assert.equal(asset.sources.every(({ src }) => src.startsWith("/audio/v060/sfx/")), true, asset.id);
  }
});

test("screen and stage routing selects title, story, preparation, stage, boss, and outcome scenes", () => {
  assert.equal(sceneIdForScreen("title"), "title");
  assert.equal(sceneIdForScreen("event"), "intro");
  assert.equal(sceneIdForScreen("map"), "map");
  assert.equal(sceneIdForScreen("loadout"), "loadout");
  assert.equal(sceneIdForScreen("battle", CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET, "normal"), "stage1");
  assert.equal(sceneIdForScreen("battle", CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE, { musicMode: "danger" }), "stage2");
  assert.equal(sceneIdForScreen("battle", CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE, { musicMode: "normal" }), "stage3");
  assert.equal(sceneIdForScreen("battle", CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE, { musicMode: "normal" }), "station-gate");
  assert.equal(sceneIdForScreen("battle", CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM, { musicMode: "normal" }), "station-platform");
  assert.equal(sceneIdForScreen("battle", CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL, { musicMode: "normal" }), "station-tunnel");
  assert.equal(sceneIdForScreen("battle", CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE, { musicMode: "boss" }), "boss");
  assert.equal(sceneIdForScreen("result", null, { won: true }), "victory");
  assert.equal(sceneIdForScreen("result", null, { end: { won: false } }), "defeat");
  assert.equal(sceneIdForScreen("unknown"), null);
});

test("all 47 canonical events route to their authored BGM, ambience, defeat, or battle scene", () => {
  const expected = {
    "prologue-kumaya-v070": "story-kumaya-daily",
    "prologue-collapse-montage-v070": "story-collapse-montage",
    "prologue-crawler-montage-v070": "story-crawler-montage",
    "crawler-signal-v070": "story-crawler-signal",
    "prologue-skip-summary-v070": "story-crawler-signal",
    "stage-nishijin-pre-v070": "story-stage1-pre",
    "stage-nishijin-alert-v070": "story-stage1-battle",
    "stage-nishijin-post-v070": "story-stage1-post",
    "stage-nishijin-defeat-v070": "defeat",
    "stage-nishijin-retry-v070": "story-stage1-battle",
    "stage-nishijin-replay-v070": "story-stage1-battle",
    "stage-sawara-pre-v070": "story-stage2-pre",
    "stage-sawara-alert-v070": "story-stage2-battle",
    "stage-sawara-post-v070": "story-stage2-post",
    "stage-sawara-defeat-v070": "defeat",
    "stage-sawara-retry-v070": "story-stage2-battle",
    "stage-sawara-replay-v070": "story-stage2-battle",
    "stage-takuya-pre-v070": "story-stage3-pre",
    "stage-takuya-warning-v070": "story-boss",
    "stage-takuya-final-v070": "silence-stage3-final",
    "stage-takuya-base-remains-v070": "story-stage3-battle",
    "stage-takuya-post-v070": "story-stage3-post",
    "stage-takuya-defeat-v070": "defeat",
    "stage-takuya-defeat-after-boss-v070": "defeat",
    "stage-takuya-retry-v070": "story-stage3-battle",
    "stage-takuya-replay-v070": "story-stage3-battle",
    "station-briefing-v070": "story-station-briefing",
    "stage-station-gate-pre-v070": "story-station-gate-pre",
    "stage-station-gate-alert-v070": "story-station-gate-battle",
    "stage-station-gate-post-v070": "story-station-gate-post",
    "stage-station-gate-defeat-v070": "defeat",
    "stage-station-gate-retry-v070": "story-station-gate-battle",
    "stage-station-gate-replay-v070": "story-station-gate-battle",
    "stage-station-platform-pre-v070": "story-station-platform-pre",
    "stage-station-platform-alert-v070": "story-station-platform-battle",
    "stage-station-platform-post-v070": "story-station-platform-post",
    "stage-station-platform-defeat-v070": "defeat",
    "stage-station-platform-retry-v070": "story-station-platform-battle",
    "stage-station-platform-replay-v070": "story-station-platform-battle",
    "stage-station-tunnel-pre-v070": "story-station-tunnel-pre",
    "stage-station-tunnel-power-v070": "story-station-tunnel-battle",
    "stage-station-escape-v070": "story-station-tunnel-battle",
    "stage-station-tunnel-post-v070": "story-station-return",
    "stage-station-tunnel-defeat-v070": "defeat",
    "stage-station-tunnel-retry-v070": "story-station-tunnel-battle",
    "stage-station-tunnel-replay-v070": "story-station-tunnel-battle",
    "chapter-ending-v070": "story-chapter-ending",
  };
  assert.deepEqual(Object.keys(expected), [...STORY_EVENT_IDS]);
  assert.deepEqual(STORY_AUDIO_EVENT_SCENE_IDS, expected);
  for (const [eventId, sceneId] of Object.entries(expected)) {
    assert.equal(sceneIdForStoryEvent(eventId), sceneId, eventId);
    assert.equal(sceneIdForScreen("event", null, { eventId }), sceneId, eventId);
    const scene = PRODUCTION_AUDIO_MANIFEST.sceneById[sceneId];
    const cueIds = [scene.bgm, ...scene.ambience, ...scene.preload].filter(Boolean);
    assert.equal(cueIds.some((cueId) => (
      (PRODUCTION_AUDIO_MANIFEST.assetById[cueId] ?? PRODUCTION_AUDIO_MANIFEST.poolById[cueId])?.category === "humanVoices"
    )), false, eventId);
  }
  assert.equal(sceneIdForStoryEvent("unknown-event"), null);
  assert.equal(sceneIdForScreen("event", null, { eventId: "unknown-event" }), "intro");
  assert.equal(STORY_AUDIO_SCENE_RULES.length, 47);
  assert.equal(STORY_AUDIO_SCENE_RULES.every(({ match }) => match === "exact"), true);
  assert.deepEqual(STORY_AUDIO_PHASE_RULES, [
    { eventId: "prologue-kumaya-v070", fromLineIndex: 17, sceneId: "story-kumaya-crisis" },
    { eventId: "prologue-collapse-montage-v070", fromLineIndex: 4, sceneId: "silence-prologue-title", holdMs: 2000 },
    { eventId: "stage-station-escape-v070", fromLineIndex: 5, sceneId: "silence-station-seal", holdMs: 2500 },
  ]);
  assert.match(STORY_EVENTS["prologue-kumaya-v070"].lines[16].text, /まずい/);
  assert.equal(sceneIdForStoryEvent("prologue-kumaya-v070", 16), "story-kumaya-daily");
  assert.equal(sceneIdForStoryEvent("prologue-kumaya-v070", 17), "story-kumaya-crisis");
  assert.equal(sceneIdForScreen("event", null, { eventId: "prologue-kumaya-v070", storyLineIndex: 17 }), "story-kumaya-crisis");
  assert.equal(STORY_EVENTS["prologue-collapse-montage-v070"].lines.length, 4);
  assert.equal(STORY_EVENTS["prologue-collapse-montage-v070"].presentation.silenceAfterMs, 2000);
  assert.equal(sceneIdForStoryEvent("prologue-collapse-montage-v070", 3), "story-collapse-montage");
  assert.equal(sceneIdForStoryEvent("prologue-collapse-montage-v070", 4), "silence-prologue-title");
  assert.equal(STORY_EVENTS["stage-station-escape-v070"].lines.length, 5);
  assert.equal(STORY_EVENTS["stage-station-escape-v070"].presentation.silenceAfterMs, 2500);
  assert.equal(sceneIdForStoryEvent("stage-station-escape-v070", 4), "story-station-tunnel-battle");
  assert.equal(sceneIdForStoryEvent("stage-station-escape-v070", 5), "silence-station-seal");

  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById["story-kumaya-daily"].bgm, "music-v070-kumaya-daily");
  assert.deepEqual(PRODUCTION_AUDIO_MANIFEST.sceneById["story-kumaya-crisis"].ambience, ["ambience-v070-kumaya-crisis-loop"]);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById["story-kumaya-crisis"].bgm, undefined);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById["story-stage1-pre"].bgm, undefined);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById["story-stage1-post"].bgm, "music-v070-rescue");
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById["story-stage2-post"].bgm, undefined);
  assert.deepEqual(PRODUCTION_AUDIO_MANIFEST.sceneById["story-stage2-post"].ambience, ["ambience-v070-medical-bay-loop"]);
  assert.equal(PRODUCTION_AUDIO_MANIFEST.sceneById["story-stage3-post"].bgm, undefined);
  assert.deepEqual(PRODUCTION_AUDIO_MANIFEST.sceneById["story-stage3-post"].ambience, ["ambience-v070-stage3-wind-loop"]);

  assert.deepEqual(STORY_WARNING_EVENT_IDS, [
    "stage-station-gate-alert-v070",
    "stage-station-platform-alert-v070",
    "stage-station-tunnel-power-v070",
  ]);
  for (const eventId of STORY_WARNING_EVENT_IDS) assert.equal(storyWarningCueForEvent(eventId), STATION_AUDIO_CUE_IDS.WARNING);
  assert.equal(storyWarningCueForEvent("stage-nishijin-alert-v070"), null);
  assert.deepEqual(STORY_AUDIO_MIX, {
    dialogueBgmDuckDb: -4,
    dialogueBgmDuckLevel: 0.630957,
    importantAmbienceDuckDb: -2,
    importantAmbienceDuckLevel: 0.794328,
    dialogueReleaseMs: 350,
  });
  assert.ok(STORY_AUDIO_MIX.dialogueBgmDuckDb >= -5 && STORY_AUDIO_MIX.dialogueBgmDuckDb <= -3);
  assert.ok(STORY_AUDIO_MIX.importantAmbienceDuckDb >= -3 && STORY_AUDIO_MIX.importantAmbienceDuckDb <= -1);
  assert.ok(STORY_AUDIO_MIX.dialogueReleaseMs >= 250 && STORY_AUDIO_MIX.dialogueReleaseMs <= 500);
  for (const cueId of Object.values(STATION_AUDIO_CUE_IDS)) assert.ok(PRODUCTION_AUDIO_MANIFEST.assetById[cueId], cueId);
});

test("StoryScreen reports line boundaries and holds authored silence before event completion", () => {
  const screensSource = readFileSync(path.join(repositoryRoot, "app", "CampaignScreens.tsx"), "utf8");
  const gameSource = readFileSync(path.join(repositoryRoot, "app", "AshfallGame.tsx"), "utf8");
  assert.match(screensSource, /onStoryAudioPositionChange: \(eventId: string, lineIndex: number\) => void/);
  assert.match(screensSource, /onStoryAudioPositionChange\(event\.id, index\)/);
  assert.match(screensSource, /const holdMs = event\.presentation\.silenceAfterMs/);
  assert.match(screensSource, /onStoryAudioPositionChange\(event\.id, event\.lines\.length\)/);
  assert.match(screensSource, /window\.setTimeout\(completeOnce, holdMs\)/);
  assert.match(screensSource, /disabled=\{silenceTail\} aria-busy=\{silenceTail\}/);
  assert.match(gameSource, /const storyLineIndex = storyAudioPosition\.eventId === eventId \? storyAudioPosition\.lineIndex : 0/);
  assert.match(gameSource, /sceneIdForScreen\(screen, selectedStageId, musicState\)/);
  assert.match(gameSource, /onStoryAudioPositionChange=\{handleStoryAudioPositionChange\}/);
  assert.match(gameSource, /setMusicActive\(Boolean\(state\?\.bgmAssetId\) && !bgmMuted\)/);
  assert.match(gameSource, /storyWarningCueForEvent\(storyEventId\)/);
  assert.match(gameSource, /playProductionCue\(warningCue, W \/ 2, \{[\s\S]*priority: 98/);
});

test("all weapon-mapped units retain production weapons and all eleven units retain battle-voice contracts", () => {
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
  const expectedVoicePrefixes = {
    scout: "human-male-light",
    ranger: "human-female",
    brute: "human-male-heavy",
    brawler: "human-male-heavy",
    gunner: "human-female",
    medic: "human-male-light",
    "crazy-king": "voice-crazy-king",
    kumaverson: "voice-kumaverson",
    babayaga: "voice-babayaga",
    guardian: "human-male-heavy",
    engineer: "human-male-light",
  };
  for (const [kind, expectedCue] of Object.entries(expectedWeapons)) {
    assert.equal(weaponCueForUnit(kind), expectedCue);
    assert.ok(
      PRODUCTION_AUDIO_MANIFEST.assetById[expectedCue]
        || PRODUCTION_AUDIO_MANIFEST.poolById[expectedCue]
        || PRODUCTION_AUDIO_MANIFEST.aliasById[expectedCue],
      `${kind}: ${expectedCue}`,
    );
  }
  for (const [kind, expectedVoicePrefix] of Object.entries(expectedVoicePrefixes)) {
    for (const event of ["attack", "hurt", "death"]) {
      const voiceCue = `${expectedVoicePrefix}-${event}`;
      assert.equal(humanVoiceCueForUnit(kind, event), voiceCue);
      assert.equal(
        (PRODUCTION_AUDIO_MANIFEST.assetById[voiceCue] ?? PRODUCTION_AUDIO_MANIFEST.poolById[voiceCue])?.category,
        "humanVoices",
        `${kind}: ${event}`,
      );
    }
    const deployCue = humanVoiceCueForUnit(kind, "deploy");
    const expectedDeployCue = expectedVoicePrefix.startsWith("voice-")
      ? `${expectedVoicePrefix}-deploy`
      : `${expectedVoicePrefix}-attack`;
    assert.equal(deployCue, expectedDeployCue);
    assert.equal(
      (PRODUCTION_AUDIO_MANIFEST.assetById[deployCue] ?? PRODUCTION_AUDIO_MANIFEST.poolById[deployCue])?.category,
      "humanVoices",
    );
    assert.equal(humanVoiceCueForUnit(kind, "speech"), null);
  }
  assert.equal(weaponCueForUnit("unknown"), null);
  assert.equal(humanVoiceCueForUnit("unknown", "attack"), null);
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
  assert.equal(enemyVoiceCue("grappler", "attack"), "enemy-crusher-attack");
  assert.equal(enemyVoiceCue("ooze", "hurt"), "enemy-spitter-hurt");
  assert.equal(enemyVoiceCue("sprinter", "death"), "enemy-runner-death");
  assert.equal(enemyVoiceCue("gate-eater", "attack"), "enemy-takuya-attack");
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
  for (const removedCueId of ["tactic-defend", "tactic-balanced", "tactic-assault"]) {
    assert.equal(Object.hasOwn(LEGACY_SFX_CUE_MAP, removedCueId), false);
  }
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

test("gameplay routes scenes, combat identity, and procedural fallback through the production mixer", () => {
  const source = readFileSync(path.join(repositoryRoot, "app", "AshfallGame.tsx"), "utf8");
  assert.match(source, /createAudioMixer\(\{[\s\S]*manifest: PRODUCTION_AUDIO_MANIFEST/);
  assert.match(source, /const productionCue = LEGACY_SFX_CUE_MAP\[cueId\]/);
  assert.match(source, /const fallback = \(\) => productionMixer\.playTestTone\(\{/);
  assert.match(source, /if \(!productionMixer\) return false/);
  assert.match(source, /if \(!productionCue\) return fallback\(\)/);
  assert.match(source, /audioActivationPendingRef\.current = true[\s\S]*mixer\.playTestTone\(\{ respectSettings: true \}\)[\s\S]*await mixer\.enableAudio\(\)[\s\S]*mixer\.retryFailedAudio\(\)/);
  assert.match(source, /onAssetFailure: \(\) => \{[\s\S]*setAudioUnlockUi\("failed"\)/);
  assert.match(source, /className="audio-test-tone" data-audio-unlock-control="true" onClick=\{playAudioTestTone\}/);
  assert.match(source, /className="enable-audio-button"[\s\S]*data-audio-unlock-control="true"/);
  for (const label of ["音声を有効にする", "音声を準備中…", "音声が有効になりました", "音声を開始できませんでした　もう一度試す"]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /const audioUnlockShortLabel = [\s\S]*"音声開始"/);
  assert.match(source, /runGuardedAudioRequest\(\{[\s\S]*play: \(guardedFallback\) => productionMixer\.play\(productionCue/);
  assert.match(source, /onLoadFailure: guardedFallback/);
  assert.doesNotMatch(source, /return playSynthCue\(cueId, options\)/);
  assert.match(source, /sfxRequestGateRef\.current\.cancelPending\(\)/);
  assert.match(source, /if \(!productionMixer\?\.unlocked\) return/);
  assert.match(source, /productionMixer\.hasInstance\(instanceKey\)/);
  assert.match(source, /durationSeconds: productionCue === "radio-open" \? \.72 : undefined/);
  assert.match(source, /durationSeconds: active \? \.72 : undefined/);
  assert.match(source, /productionMixer\.setScene\(sceneId\)\.then/);
  assert.match(source, /sceneIdForScreen\(screen, selectedStageId, musicState\)/);
  assert.match(source, /if \(desiredProductionSceneRef\.current === sceneId\) return/);
  assert.doesNotMatch(source, /onBgmLoadFailure/);
  assert.match(source, /createAudioMixer\(\{[\s\S]*maxVoices: 28/);
  assert.match(source, /const localQaAudio = Boolean\(legacyQa \|\| campaignQa\)/);
  assert.match(source, /setBgmMuted\(localQaAudio \? false : !loaded\.settings\.bgmEnabled\)/);
  assert.match(source, /bgmVolume: campaignSave\.settings\.bgmVolume/);
  assert.match(source, /sfxVolume: campaignSave\.settings\.sfxVolume/);
  assert.match(source, /bgmEnabled: !bgmMuted/);
  assert.match(source, /if \(!sceneId \|\| \(screen === "battle" && paused\)\)/);
  assert.match(source, /weaponCueForUnit\(f\.kind\)/);
  assert.match(source, /const deployVoice = unitAudioCueFor\(kind, "voice", "deploy"\) \|\| humanVoiceCueForUnit\(kind, "deploy"\)/);
  assert.match(source, /humanVoiceCueForUnit\(f\.kind, "attack"\)/);
  assert.match(source, /humanVoiceCueForUnit\(target\.kind, "hurt"\)/);
  assert.match(source, /humanVoiceCueForUnit\(fighter\.kind, "death"\)/);
  assert.match(source, /enemyVoiceCue\(f\.kind, "attack"\)/);
  assert.match(source, /enemyVoiceCue\(fighter\.kind, "death"\)/);
  assert.match(source, /"infection-warning-01"/);
  assert.match(source, /BATTLE_AUDIO_LOOP_CONTRACTS\.corpseBurn\.cueId/);
  assert.match(source, /const instanceKey = `\$\{BATTLE_AUDIO_LOOP_CONTRACTS\.corpseBurn\.instanceKey\}:\$\{burningCorpse\.id\}`/);
  assert.match(source, /dedupeKey: instanceKey/);
  assert.match(source, /burningCorpses = [\s\S]*\.slice\(0, 3\)/);
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
  assert.equal(allCueIds.length, 212);
  assert.equal(new Set(allCueIds).size, allCueIds.length);
  for (const category of AUDIO_CATEGORIES) {
    assert.ok(
      PRODUCTION_AUDIO_MANIFEST.assets.some((asset) => asset.category === category)
        || PRODUCTION_AUDIO_MANIFEST.pools.some((pool) => pool.category === category),
      category,
    );
  }
});
