import { createAudioManifest } from "./audioManifest.js";
import { CAMPAIGN_STAGE_IDS } from "./campaign.js";

const V060_AUDIO_ROOT = "/audio/v060";
const V070_AUDIO_ROOT = "/audio/v070";

const MUSIC_TRACKS = Object.freeze([
  "title",
  "intro",
  "map",
  "battle-stage1",
  "battle-stage2",
  "battle-stage3",
  "boss",
  "victory",
  "defeat",
]);

const UI_CUES = Object.freeze([
  "ui-cancel",
  "ui-confirm",
  "ui-error",
  "ui-hover",
  "ui-select",
]);

const RADIO_CUES = Object.freeze(["radio-open", "radio-close", "radio-static-loop"]);
const SUPPORT_CUES = Object.freeze([
  "support-airstrike",
  "support-barrier",
  "support-explosion",
  "support-heal",
  "support-pod-deploy",
  "support-pod-impact",
]);
const LIFECYCLE_CUES = Object.freeze([
  "infection-twitch-01",
  "infection-warning-01",
  "corpse-ignite",
  "corpse-burn-loop",
]);

const WEAPON_POOL_CATEGORIES = Object.freeze({
  "weapon-barrage": "weapons",
  "weapon-crowbar": "melee",
  "weapon-gunner": "weapons",
  "weapon-hammer": "melee",
  "weapon-melee-impact": "melee",
  "weapon-melee-swing": "melee",
  "weapon-rifle": "weapons",
  "weapon-unarmed": "melee",
});

const HUMAN_VOICE_PROFILES = Object.freeze(["female", "male-heavy", "male-light"]);
const HUMAN_VOICE_EVENTS = Object.freeze(["attack", "hurt", "death"]);
const ENEMY_KINDS = Object.freeze(["walker", "runner", "spitter", "crusher", "shade", "abomination", "turned", "takuya"]);
const ENEMY_VOICE_PROFILE_BY_KIND = Object.freeze({
  grappler: "crusher",
  ooze: "spitter",
  sprinter: "runner",
  "gate-eater": "takuya",
});
const ENEMY_VOICE_EVENTS = Object.freeze(["attack", "hurt", "death"]);

const NEW_UNIT_AUDIO_CUES = Object.freeze([
  { id: "weapon-chainsaw-start", category: "weapons", cooldownMs: 180, maxInstances: 1, gain: 0.82, priority: 72 },
  {
    id: "weapon-chainsaw-idle-loop",
    category: "weapons",
    loop: true,
    cooldownMs: 0,
    maxInstances: 1,
    gain: 0.52,
    priority: 58,
  },
  { id: "weapon-chainsaw-attack", category: "weapons", cooldownMs: 80, maxInstances: 2, gain: 0.82, priority: 72 },
  { id: "weapon-chainsaw-flesh-hit", category: "melee", cooldownMs: 70, maxInstances: 4, gain: 0.78, priority: 68 },
  { id: "weapon-chainsaw-hard-hit", category: "melee", cooldownMs: 100, maxInstances: 3, gain: 0.84, priority: 72 },
  { id: "weapon-chainsaw-stop", category: "weapons", cooldownMs: 180, maxInstances: 1, gain: 0.72, priority: 66 },
  { id: "weapon-pan-swing", category: "melee", cooldownMs: 110, maxInstances: 2, gain: 0.52, priority: 62 },
  { id: "weapon-pan-hit", category: "melee", cooldownMs: 120, maxInstances: 2, gain: 0.58, priority: 68 },
  { id: "weapon-pan-heavy-hit", category: "melee", cooldownMs: 150, maxInstances: 2, gain: 0.62, priority: 74 },
  { id: "weapon-pan-stun", category: "melee", cooldownMs: 240, maxInstances: 1, gain: 0.54, priority: 78 },
  { id: "weapon-suppressed-pistol", category: "weapons", cooldownMs: 90, maxInstances: 4, gain: 0.72, priority: 70 },
  { id: "weapon-suppressed-hit", category: "weapons", cooldownMs: 70, maxInstances: 4, gain: 0.66, priority: 64 },
  { id: "weapon-suppressed-reload", category: "weapons", cooldownMs: 280, maxInstances: 1, gain: 0.62, priority: 60 },
  { id: "weapon-special-kill", category: "weapons", cooldownMs: 500, maxInstances: 1, gain: 0.76, priority: 82 },
  { id: "voice-crazy-king-deploy", category: "humanVoices", cooldownMs: 500, maxInstances: 1, gain: 0.78, priority: 70 },
  { id: "voice-crazy-king-attack", category: "humanVoices", cooldownMs: 220, maxInstances: 2, gain: 0.78, priority: 68 },
  { id: "voice-crazy-king-hurt", category: "humanVoices", cooldownMs: 300, maxInstances: 2, gain: 0.82, priority: 76 },
  { id: "voice-crazy-king-death", category: "humanVoices", cooldownMs: 1000, maxInstances: 1, gain: 0.86, priority: 88 },
  { id: "voice-kumaverson-deploy", category: "humanVoices", cooldownMs: 500, maxInstances: 1, gain: 0.76, priority: 70 },
  { id: "voice-kumaverson-attack", category: "humanVoices", cooldownMs: 220, maxInstances: 2, gain: 0.76, priority: 68 },
  { id: "voice-kumaverson-hurt", category: "humanVoices", cooldownMs: 300, maxInstances: 2, gain: 0.80, priority: 76 },
  { id: "voice-kumaverson-death", category: "humanVoices", cooldownMs: 1000, maxInstances: 1, gain: 0.84, priority: 88 },
  { id: "voice-babayaga-deploy", category: "humanVoices", cooldownMs: 500, maxInstances: 1, gain: 0.70, priority: 70 },
  { id: "voice-babayaga-attack", category: "humanVoices", cooldownMs: 220, maxInstances: 2, gain: 0.70, priority: 68 },
  { id: "voice-babayaga-hurt", category: "humanVoices", cooldownMs: 300, maxInstances: 2, gain: 0.74, priority: 76 },
  { id: "voice-babayaga-death", category: "humanVoices", cooldownMs: 1000, maxInstances: 1, gain: 0.78, priority: 88 },
]);

const V070_AUDIO_ASSET_SPECS = Object.freeze([
  { id: "music-v070-kumaya-daily", folder: "music", category: "bgm", loop: true, gain: 0.54, priority: 900 },
  { id: "music-v070-crawler-life", folder: "music", category: "bgm", loop: true, gain: 0.56, priority: 900 },
  { id: "music-v070-stage2-tension", folder: "music", category: "bgm", loop: true, gain: 0.58, priority: 900 },
  { id: "music-v070-stage3-approach", folder: "music", category: "bgm", loop: true, gain: 0.56, priority: 900 },
  { id: "music-v070-collapse-montage", folder: "music", category: "bgm", loop: true, gain: 0.64, priority: 900 },
  { id: "music-v070-crawler-montage", folder: "music", category: "bgm", loop: true, gain: 0.62, priority: 900 },
  { id: "music-v070-crawler-briefing", folder: "music", category: "bgm", loop: true, gain: 0.58, priority: 900 },
  { id: "music-v070-station-gate", folder: "music", category: "bgm", loop: true, gain: 0.66, priority: 900 },
  { id: "music-v070-station-platform", folder: "music", category: "bgm", loop: true, gain: 0.64, priority: 900 },
  { id: "music-v070-station-tunnel", folder: "music", category: "bgm", loop: true, gain: 0.62, priority: 900 },
  { id: "music-v070-rescue", folder: "music", category: "bgm", loop: false, gain: 0.62, priority: 900 },
  { id: "music-v070-return", folder: "music", category: "bgm", loop: true, gain: 0.58, priority: 900 },
  { id: "music-v070-crawler-morning", folder: "music", category: "bgm", loop: true, gain: 0.60, priority: 900 },
  { id: "ambience-v070-kumaya-daily-loop", folder: "ambience", category: "ambience", loop: true, gain: 0.36, priority: 120 },
  { id: "ambience-v070-kumaya-crisis-loop", folder: "ambience", category: "ambience", loop: true, gain: 0.50, priority: 120 },
  { id: "ambience-v070-rain-street-loop", folder: "ambience", category: "ambience", loop: true, gain: 0.46, priority: 120 },
  { id: "ambience-v070-stage2-engine-loop", folder: "ambience", category: "ambience", loop: true, gain: 0.46, priority: 120 },
  { id: "ambience-v070-medical-bay-loop", folder: "ambience", category: "ambience", loop: true, gain: 0.38, priority: 120 },
  { id: "ambience-v070-stage3-wind-loop", folder: "ambience", category: "ambience", loop: true, gain: 0.44, priority: 120 },
  { id: "ambience-v070-collapse-city-loop", folder: "ambience", category: "ambience", loop: true, gain: 0.48, priority: 120 },
  { id: "ambience-v070-crawler-ops-loop", folder: "ambience", category: "ambience", loop: true, gain: 0.45, priority: 120 },
  { id: "ambience-v070-crawler-canteen-loop", folder: "ambience", category: "ambience", loop: true, gain: 0.42, priority: 120 },
  { id: "ambience-v070-radio-signal-loop", folder: "ambience", category: "ambience", loop: true, gain: 0.38, priority: 120 },
  { id: "ambience-v070-station-gate-loop", folder: "ambience", category: "ambience", loop: true, gain: 0.50, priority: 120 },
  { id: "ambience-v070-station-platform-loop", folder: "ambience", category: "ambience", loop: true, gain: 0.48, priority: 120 },
  { id: "ambience-v070-station-tunnel-loop", folder: "ambience", category: "ambience", loop: true, gain: 0.48, priority: 120 },
  { id: "ambience-v070-station-seal-aftermath-loop", folder: "ambience", category: "ambience", loop: true, gain: 0.42, priority: 120 },
  { id: "sfx-v070-takuya-entrance", folder: "sfx", category: "monsters", loop: false, gain: 0.82, priority: 104, cooldownMs: 5000, maxInstances: 1 },
  { id: "sfx-v070-station-warning", folder: "sfx", category: "ui", loop: false, gain: 0.68, priority: 96, cooldownMs: 600, maxInstances: 1 },
  { id: "sfx-v070-power-switch", folder: "sfx", category: "support", loop: false, gain: 0.74, priority: 84, cooldownMs: 180, maxInstances: 2 },
  { id: "sfx-v070-cart-stall", folder: "sfx", category: "support", loop: false, gain: 0.70, priority: 82, cooldownMs: 500, maxInstances: 1 },
  { id: "sfx-v070-seal-engage", folder: "sfx", category: "support", loop: false, gain: 0.78, priority: 98, cooldownMs: 800, maxInstances: 1 },
  { id: "sfx-v070-machine-stop", folder: "sfx", category: "support", loop: false, gain: 0.66, priority: 90, cooldownMs: 900, maxInstances: 1 },
  { id: "sfx-v070-rescue-confirm", folder: "sfx", category: "ui", loop: false, gain: 0.60, priority: 72, cooldownMs: 500, maxInstances: 1 },
  { id: "sfx-v070-return-marker", folder: "sfx", category: "ui", loop: false, gain: 0.62, priority: 80, cooldownMs: 350, maxInstances: 1 },
  { id: "sfx-v070-terminal-confirm", folder: "sfx", category: "ui", loop: false, gain: 0.54, priority: 64, cooldownMs: 180, maxInstances: 2 },
]);

function sourceFor(root, folder, name) {
  // MP3 is first because it is supported by older iPhone Safari versions;
  // Vorbis OGG remains the higher-efficiency alternate for modern browsers.
  return [
    { src: `${root}/${folder}/${name}.mp3`, type: "audio/mpeg" },
    { src: `${root}/${folder}/${name}.ogg`, type: "audio/ogg" },
  ];
}

function musicAsset(name) {
  return {
    id: `music-${name}`,
    category: "bgm",
    sources: sourceFor(V060_AUDIO_ROOT, "music", name),
    preload: "scene",
    loop: !["victory", "defeat"].includes(name),
    gain: name === "boss" ? 0.82 : 0.76,
    priority: 900,
    cooldownMs: 0,
    maxInstances: 1,
  };
}

function sfxAsset(name, category, options = {}) {
  return {
    id: name,
    category,
    sources: sourceFor(V060_AUDIO_ROOT, "sfx", name),
    preload: options.preload ?? "lazy",
    loop: options.loop ?? false,
    gain: options.gain ?? 0.82,
    priority: options.priority ?? 50,
    cooldownMs: options.cooldownMs ?? 60,
    maxInstances: options.maxInstances ?? 4,
  };
}

function v070Asset(spec) {
  return {
    id: spec.id,
    category: spec.category,
    sources: sourceFor(V070_AUDIO_ROOT, spec.folder, spec.id),
    preload: spec.category === "bgm" || spec.category === "ambience" ? "scene" : "lazy",
    loop: spec.loop,
    gain: spec.gain,
    priority: spec.priority,
    cooldownMs: spec.cooldownMs ?? 0,
    maxInstances: spec.maxInstances ?? (spec.category === "bgm" ? 1 : 2),
  };
}

function variationAssets(baseId, category, options = {}) {
  return [1, 2].map((variation) => sfxAsset(
    `${baseId}-${String(variation).padStart(2, "0")}`,
    category,
    options,
  ));
}

function variationPool(baseId, category, options = {}) {
  return {
    id: baseId,
    category,
    assetIds: [`${baseId}-01`, `${baseId}-02`],
    strategy: "shuffle",
    avoidImmediateRepeat: true,
    cooldownMs: options.cooldownMs ?? 60,
    priority: options.priority ?? 50,
    maxInstances: options.maxInstances ?? 4,
  };
}

const weaponAssets = Object.entries(WEAPON_POOL_CATEGORIES).flatMap(([baseId, category]) => variationAssets(baseId, category, {
  gain: category === "melee" ? 0.82 : 0.76,
  priority: 62,
  cooldownMs: baseId === "weapon-gunner" || baseId === "weapon-barrage" ? 45 : 70,
  maxInstances: 5,
}));
const weaponPools = Object.entries(WEAPON_POOL_CATEGORIES).map(([baseId, category]) => variationPool(baseId, category, {
  priority: 62,
  cooldownMs: baseId === "weapon-gunner" || baseId === "weapon-barrage" ? 45 : 70,
  maxInstances: 5,
}));

const humanVoiceAssets = HUMAN_VOICE_PROFILES.flatMap((profile) => HUMAN_VOICE_EVENTS.flatMap((event) => variationAssets(
  `human-${profile}-${event}`,
  "humanVoices",
  { gain: 0.8, priority: event === "death" ? 86 : 66, cooldownMs: event === "attack" ? 180 : 260, maxInstances: 3 },
)));
const humanVoicePools = HUMAN_VOICE_PROFILES.flatMap((profile) => HUMAN_VOICE_EVENTS.map((event) => variationPool(
  `human-${profile}-${event}`,
  "humanVoices",
  { priority: event === "death" ? 86 : 66, cooldownMs: event === "attack" ? 180 : 260, maxInstances: 3 },
)));

const enemyVoiceAssets = ENEMY_KINDS.flatMap((kind) => ENEMY_VOICE_EVENTS.flatMap((event) => variationAssets(
  `enemy-${kind}-${event}`,
  "monsters",
  { gain: kind === "takuya" ? 0.9 : 0.82, priority: kind === "takuya" ? 92 : event === "death" ? 78 : 60, cooldownMs: event === "attack" ? 130 : 180, maxInstances: 4 },
)));
const enemyVoicePools = ENEMY_KINDS.flatMap((kind) => ENEMY_VOICE_EVENTS.map((event) => variationPool(
  `enemy-${kind}-${event}`,
  "monsters",
  { priority: kind === "takuya" ? 92 : event === "death" ? 78 : 60, cooldownMs: event === "attack" ? 130 : 180, maxInstances: 4 },
)));

const assets = [
  ...MUSIC_TRACKS.map(musicAsset),
  ...UI_CUES.map((name) => sfxAsset(name, "ui", { gain: 0.68, priority: 32, cooldownMs: 45, maxInstances: 3 })),
  sfxAsset("radio-open", "ui", { gain: 0.7, priority: 48, cooldownMs: 120, maxInstances: 2 }),
  sfxAsset("radio-close", "ui", { gain: 0.66, priority: 48, cooldownMs: 120, maxInstances: 2 }),
  sfxAsset("radio-static-loop", "ambience", { loop: true, gain: 0.42, priority: 25, cooldownMs: 0, maxInstances: 1 }),
  ...SUPPORT_CUES.map((name) => sfxAsset(name, "support", {
    gain: name === "support-explosion" || name === "support-airstrike" ? 0.9 : 0.8,
    priority: name === "support-explosion" || name === "support-airstrike" ? 94 : 72,
    cooldownMs: name === "support-explosion" ? 180 : 100,
    maxInstances: 3,
  })),
  sfxAsset("infection-twitch-01", "monsters", { gain: 0.64, priority: 64, cooldownMs: 500, maxInstances: 2 }),
  sfxAsset("infection-warning-01", "monsters", { gain: 0.7, priority: 76, cooldownMs: 800, maxInstances: 2 }),
  sfxAsset("corpse-ignite", "support", { gain: 0.82, priority: 78, cooldownMs: 240, maxInstances: 3 }),
  // This is a bounded battle event loop, not scene ambience. Keeping it on the
  // support bus lets stopSfx cancel every pending/active burn on pause, result,
  // retry, and map return without tearing down the scene ambience state.
  sfxAsset("corpse-burn-loop", "support", { loop: true, gain: 0.46, priority: 38, cooldownMs: 0, maxInstances: 3 }),
  ...weaponAssets,
  ...humanVoiceAssets,
  ...enemyVoiceAssets,
  ...NEW_UNIT_AUDIO_CUES.map(({ id, category, ...options }) => sfxAsset(id, category, options)),
  ...V070_AUDIO_ASSET_SPECS.map(v070Asset),
];

const pools = [...weaponPools, ...humanVoicePools, ...enemyVoicePools];
const COMMON_UI_PRELOAD = Object.freeze(["ui-cancel", "ui-confirm", "ui-error", "ui-hover", "ui-select"]);
const COMBAT_PRELOAD = Object.freeze([
  ...COMMON_UI_PRELOAD,
  ...SUPPORT_CUES,
  ...LIFECYCLE_CUES,
  "radio-open",
  "radio-close",
  ...NEW_UNIT_AUDIO_CUES.map(({ id }) => id),
]);

export const STORY_AUDIO_MIX = Object.freeze({
  dialogueBgmDuckDb: -4,
  dialogueBgmDuckLevel: 0.630957,
  importantAmbienceDuckDb: -2,
  importantAmbienceDuckLevel: 0.794328,
  dialogueReleaseMs: 350,
});

export const STATION_AUDIO_CUE_IDS = Object.freeze({
  WARNING: "sfx-v070-station-warning",
  POWER_SWITCH: "sfx-v070-power-switch",
  CART_STALL: "sfx-v070-cart-stall",
  SEAL_ENGAGE: "sfx-v070-seal-engage",
  MACHINE_STOP: "sfx-v070-machine-stop",
  RESCUE_CONFIRM: "sfx-v070-rescue-confirm",
  RETURN_MARKER: "sfx-v070-return-marker",
  TERMINAL_CONFIRM: "sfx-v070-terminal-confirm",
});

export const TAKUYA_ENTRANCE_AUDIO = Object.freeze({
  cueId: "sfx-v070-takuya-entrance",
  silenceSceneId: "silence-stage3-entrance",
  durationSeconds: 3.4,
});

const STATION_PRELOAD = Object.freeze(Object.values(STATION_AUDIO_CUE_IDS));

const scenes = [
  { id: "title", bgm: "music-title", preload: COMMON_UI_PRELOAD, crossfadeMs: 900 },
  { id: "intro", bgm: "music-intro", ambience: ["radio-static-loop"], preload: [...COMMON_UI_PRELOAD, ...RADIO_CUES], crossfadeMs: 700 },
  { id: "map", bgm: "music-map", preload: COMMON_UI_PRELOAD, crossfadeMs: 650 },
  { id: "loadout", bgm: "music-map", preload: [...COMMON_UI_PRELOAD, ...Object.keys(WEAPON_POOL_CATEGORIES)], crossfadeMs: 350 },
  { id: "stage1", bgm: "music-battle-stage1", preload: COMBAT_PRELOAD, crossfadeMs: 800 },
  { id: "stage2", bgm: "music-battle-stage2", preload: COMBAT_PRELOAD, crossfadeMs: 800 },
  { id: "stage3", bgm: "music-battle-stage3", preload: [...COMBAT_PRELOAD, TAKUYA_ENTRANCE_AUDIO.cueId], crossfadeMs: 800 },
  { id: "station-gate", bgm: "music-v070-station-gate", ambience: ["ambience-v070-station-gate-loop"], preload: [...COMBAT_PRELOAD, ...STATION_PRELOAD], crossfadeMs: 650 },
  { id: "station-platform", bgm: "music-v070-station-platform", ambience: ["ambience-v070-station-platform-loop"], preload: [...COMBAT_PRELOAD, ...STATION_PRELOAD], crossfadeMs: 620 },
  { id: "station-tunnel", bgm: "music-v070-station-tunnel", ambience: ["ambience-v070-station-tunnel-loop"], preload: [...COMBAT_PRELOAD, ...STATION_PRELOAD], crossfadeMs: 520 },
  { id: "boss", bgm: "music-boss", preload: COMBAT_PRELOAD, crossfadeMs: 420 },
  { id: "victory", bgm: "music-victory", preload: ["ui-confirm"], crossfadeMs: 320 },
  { id: "defeat", bgm: "music-defeat", preload: ["ui-confirm", "ui-cancel"], crossfadeMs: 320 },
  { id: "silence-prologue-title", preload: [], crossfadeMs: 0 },
  { id: "story-kumaya-daily", bgm: "music-v070-kumaya-daily", ambience: ["ambience-v070-kumaya-daily-loop"], preload: COMMON_UI_PRELOAD, crossfadeMs: 520 },
  { id: "story-kumaya-crisis", ambience: ["ambience-v070-kumaya-crisis-loop"], preload: [], crossfadeMs: 120 },
  { id: "story-collapse-montage", bgm: "music-v070-collapse-montage", ambience: ["ambience-v070-collapse-city-loop"], preload: [], crossfadeMs: 700 },
  { id: "story-crawler-montage", bgm: "music-v070-crawler-montage", ambience: ["ambience-v070-crawler-ops-loop"], preload: [STATION_AUDIO_CUE_IDS.TERMINAL_CONFIRM], crossfadeMs: 680 },
  { id: "story-crawler-signal", bgm: "music-v070-crawler-life", ambience: ["ambience-v070-crawler-ops-loop", "ambience-v070-radio-signal-loop"], preload: ["radio-open", "radio-close", STATION_AUDIO_CUE_IDS.TERMINAL_CONFIRM], crossfadeMs: 360 },
  { id: "story-stage1-pre", ambience: ["ambience-v070-rain-street-loop"], preload: COMMON_UI_PRELOAD, crossfadeMs: 260 },
  { id: "story-stage1-battle", bgm: "music-battle-stage1", preload: COMMON_UI_PRELOAD, crossfadeMs: 420 },
  { id: "story-stage1-post", bgm: "music-v070-rescue", ambience: ["ambience-v070-rain-street-loop"], preload: [STATION_AUDIO_CUE_IDS.RESCUE_CONFIRM], crossfadeMs: 260 },
  { id: "story-stage2-pre", bgm: "music-v070-stage2-tension", ambience: ["ambience-v070-stage2-engine-loop"], preload: COMMON_UI_PRELOAD, crossfadeMs: 420 },
  { id: "story-stage2-battle", bgm: "music-battle-stage2", preload: COMMON_UI_PRELOAD, crossfadeMs: 420 },
  { id: "story-stage2-post", ambience: ["ambience-v070-medical-bay-loop"], preload: COMMON_UI_PRELOAD, crossfadeMs: 260 },
  { id: "story-stage3-pre", bgm: "music-v070-stage3-approach", ambience: ["ambience-v070-stage3-wind-loop"], preload: COMMON_UI_PRELOAD, crossfadeMs: 420 },
  { id: "story-stage3-battle", bgm: "music-battle-stage3", preload: [...COMMON_UI_PRELOAD, TAKUYA_ENTRANCE_AUDIO.cueId], crossfadeMs: 360 },
  { id: "story-boss", bgm: "music-boss", preload: COMMON_UI_PRELOAD, crossfadeMs: 260 },
  { id: "silence-stage3-entrance", preload: ["sfx-v070-takuya-entrance"], crossfadeMs: 80 },
  { id: "silence-stage3-final", preload: [], crossfadeMs: 180 },
  { id: "story-stage3-post", ambience: ["ambience-v070-stage3-wind-loop"], preload: COMMON_UI_PRELOAD, crossfadeMs: 260 },
  { id: "story-station-briefing", bgm: "music-v070-crawler-briefing", ambience: ["ambience-v070-crawler-ops-loop"], preload: [STATION_AUDIO_CUE_IDS.TERMINAL_CONFIRM], crossfadeMs: 520 },
  { id: "story-station-gate-pre", ambience: ["ambience-v070-station-gate-loop"], preload: [STATION_AUDIO_CUE_IDS.WARNING], crossfadeMs: 280 },
  { id: "story-station-gate-battle", bgm: "music-v070-station-gate", ambience: ["ambience-v070-station-gate-loop"], preload: STATION_PRELOAD, crossfadeMs: 360 },
  { id: "story-station-gate-post", bgm: "music-v070-rescue", ambience: ["ambience-v070-station-gate-loop"], preload: [STATION_AUDIO_CUE_IDS.RESCUE_CONFIRM], crossfadeMs: 260 },
  { id: "story-station-platform-pre", bgm: "music-v070-station-platform", ambience: ["ambience-v070-station-platform-loop"], preload: [STATION_AUDIO_CUE_IDS.CART_STALL], crossfadeMs: 360 },
  { id: "story-station-platform-battle", bgm: "music-v070-station-platform", ambience: ["ambience-v070-station-platform-loop"], preload: STATION_PRELOAD, crossfadeMs: 320 },
  { id: "story-station-platform-post", ambience: ["ambience-v070-station-platform-loop"], preload: [STATION_AUDIO_CUE_IDS.TERMINAL_CONFIRM], crossfadeMs: 240 },
  { id: "story-station-tunnel-pre", bgm: "music-v070-station-tunnel", ambience: ["ambience-v070-station-tunnel-loop"], preload: [STATION_AUDIO_CUE_IDS.POWER_SWITCH], crossfadeMs: 320 },
  { id: "story-station-tunnel-battle", bgm: "music-v070-station-tunnel", ambience: ["ambience-v070-station-tunnel-loop"], preload: STATION_PRELOAD, crossfadeMs: 260 },
  { id: "silence-station-seal", ambience: ["ambience-v070-station-seal-aftermath-loop"], preload: [STATION_AUDIO_CUE_IDS.SEAL_ENGAGE, STATION_AUDIO_CUE_IDS.MACHINE_STOP, STATION_AUDIO_CUE_IDS.RETURN_MARKER], crossfadeMs: 140 },
  { id: "story-station-return", bgm: "music-v070-return", ambience: ["ambience-v070-crawler-ops-loop"], preload: [STATION_AUDIO_CUE_IDS.RESCUE_CONFIRM, STATION_AUDIO_CUE_IDS.TERMINAL_CONFIRM], crossfadeMs: 560 },
  { id: "story-chapter-ending", bgm: "music-v070-crawler-morning", ambience: ["ambience-v070-crawler-canteen-loop"], preload: [STATION_AUDIO_CUE_IDS.TERMINAL_CONFIRM], crossfadeMs: 640 },
];

export const PRODUCTION_AUDIO_MANIFEST = createAudioManifest({
  version: 2,
  assets,
  pools,
  aliases: [],
  scenes,
});

export const PRODUCTION_AUDIO_SCENE_IDS = Object.freeze({
  TITLE: "title",
  INTRO: "intro",
  MAP: "map",
  LOADOUT: "loadout",
  STAGE_1: "stage1",
  STAGE_2: "stage2",
  STAGE_3: "stage3",
  STATION_GATE: "station-gate",
  STATION_PLATFORM: "station-platform",
  STATION_TUNNEL: "station-tunnel",
  BOSS: "boss",
  VICTORY: "victory",
  DEFEAT: "defeat",
  SILENCE_PROLOGUE_TITLE: "silence-prologue-title",
  STORY_KUMAYA_DAILY: "story-kumaya-daily",
  STORY_KUMAYA_CRISIS: "story-kumaya-crisis",
  STORY_COLLAPSE_MONTAGE: "story-collapse-montage",
  STORY_CRAWLER_MONTAGE: "story-crawler-montage",
  STORY_CRAWLER_SIGNAL: "story-crawler-signal",
  STORY_STAGE1_PRE: "story-stage1-pre",
  STORY_STAGE1_BATTLE: "story-stage1-battle",
  STORY_STAGE1_POST: "story-stage1-post",
  STORY_STAGE2_PRE: "story-stage2-pre",
  STORY_STAGE2_BATTLE: "story-stage2-battle",
  STORY_STAGE2_POST: "story-stage2-post",
  STORY_STAGE3_PRE: "story-stage3-pre",
  STORY_STAGE3_BATTLE: "story-stage3-battle",
  STORY_BOSS: "story-boss",
  SILENCE_STAGE3_ENTRANCE: "silence-stage3-entrance",
  SILENCE_STAGE3_FINAL: "silence-stage3-final",
  STORY_STAGE3_POST: "story-stage3-post",
  STORY_STATION_BRIEFING: "story-station-briefing",
  STORY_STATION_GATE_PRE: "story-station-gate-pre",
  STORY_STATION_GATE_BATTLE: "story-station-gate-battle",
  STORY_STATION_GATE_POST: "story-station-gate-post",
  STORY_STATION_PLATFORM_PRE: "story-station-platform-pre",
  STORY_STATION_PLATFORM_BATTLE: "story-station-platform-battle",
  STORY_STATION_PLATFORM_POST: "story-station-platform-post",
  STORY_STATION_TUNNEL_PRE: "story-station-tunnel-pre",
  STORY_STATION_TUNNEL_BATTLE: "story-station-tunnel-battle",
  SILENCE_STATION_SEAL: "silence-station-seal",
  STORY_STATION_RETURN: "story-station-return",
  STORY_CHAPTER_ENDING: "story-chapter-ending",
});

const STAGE_SCENE_BY_ID = Object.freeze({
  [CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET]: PRODUCTION_AUDIO_SCENE_IDS.STAGE_1,
  [CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE]: PRODUCTION_AUDIO_SCENE_IDS.STAGE_2,
  [CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE]: PRODUCTION_AUDIO_SCENE_IDS.STAGE_3,
  [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE]: PRODUCTION_AUDIO_SCENE_IDS.STATION_GATE,
  [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM]: PRODUCTION_AUDIO_SCENE_IDS.STATION_PLATFORM,
  [CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL]: PRODUCTION_AUDIO_SCENE_IDS.STATION_TUNNEL,
});

const UNIT_WEAPON_CUES = Object.freeze({
  scout: "weapon-crowbar",
  ranger: "weapon-rifle",
  brute: "weapon-hammer",
  brawler: "weapon-unarmed",
  gunner: "weapon-gunner",
  medic: "weapon-rifle",
  "crazy-king": "weapon-chainsaw-attack",
  kumaverson: "weapon-pan-swing",
  babayaga: "weapon-suppressed-pistol",
});

const UNIT_VOICE_PROFILES = Object.freeze({
  scout: "male-light",
  ranger: "female",
  brute: "male-heavy",
  brawler: "male-heavy",
  gunner: "female",
  medic: "male-light",
  "crazy-king": "male-heavy",
  kumaverson: "male-heavy",
  babayaga: "male-light",
  guardian: "male-heavy",
  engineer: "male-light",
});

const newUnitContract = ({ weapon, voiceProfile, weaponEvents, voicePrefix }) => Object.freeze({
  weapon,
  voiceProfile,
  weaponEvents: Object.freeze({ ...weaponEvents }),
  voiceEvents: Object.freeze({
    deploy: `voice-${voicePrefix}-deploy`,
    attack: `voice-${voicePrefix}-attack`,
    hurt: `voice-${voicePrefix}-hurt`,
    death: `voice-${voicePrefix}-death`,
  }),
});

export const UNIT_AUDIO_CUE_CONTRACTS = Object.freeze({
  "crazy-king": newUnitContract({
    weapon: "weapon-chainsaw-attack",
    voiceProfile: "male-heavy",
    voicePrefix: "crazy-king",
    weaponEvents: {
      start: "weapon-chainsaw-start",
      idleLoop: "weapon-chainsaw-idle-loop",
      attack: "weapon-chainsaw-attack",
      fleshHit: "weapon-chainsaw-flesh-hit",
      hardHit: "weapon-chainsaw-hard-hit",
      stop: "weapon-chainsaw-stop",
    },
  }),
  kumaverson: newUnitContract({
    weapon: "weapon-pan-swing",
    voiceProfile: "male-heavy",
    voicePrefix: "kumaverson",
    weaponEvents: {
      swing: "weapon-pan-swing",
      hit: "weapon-pan-hit",
      heavyHit: "weapon-pan-heavy-hit",
      stun: "weapon-pan-stun",
    },
  }),
  babayaga: newUnitContract({
    weapon: "weapon-suppressed-pistol",
    voiceProfile: "male-light",
    voicePrefix: "babayaga",
    weaponEvents: {
      shot: "weapon-suppressed-pistol",
      hit: "weapon-suppressed-hit",
      reload: "weapon-suppressed-reload",
      specialKill: "weapon-special-kill",
    },
  }),
});

export const BATTLE_AUDIO_LOOP_CONTRACTS = Object.freeze({
  corpseBurn: Object.freeze({
    cueId: "corpse-burn-loop",
    category: "support",
    instanceKey: "corpse-burn-loop",
  }),
  crazyKingChainsaw: Object.freeze({
    cueId: "weapon-chainsaw-idle-loop",
    category: "weapons",
    instanceKey: "chainsaw-idle-loop",
  }),
});

function ownValue(record, key) {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(record, key) ? record[key] : null;
}

export function weaponCueForUnit(kind) {
  return ownValue(UNIT_WEAPON_CUES, kind);
}

export function humanVoiceCueForUnit(kind, event) {
  const contractCue = ownValue(UNIT_AUDIO_CUE_CONTRACTS, kind)?.voiceEvents?.[event];
  if (contractCue) return contractCue;
  const profile = ownValue(UNIT_VOICE_PROFILES, kind);
  const profileEvent = event === "deploy" ? "attack" : event;
  return profile && HUMAN_VOICE_EVENTS.includes(profileEvent) ? `human-${profile}-${profileEvent}` : null;
}

export function unitAudioCueFor(kind, group, event) {
  const contract = ownValue(UNIT_AUDIO_CUE_CONTRACTS, kind);
  if (!contract) return null;
  if (group === "weapon") return ownValue(contract.weaponEvents, event);
  if (group === "voice") return ownValue(contract.voiceEvents, event);
  return null;
}

export function stopBattleAudioLoops(mixer, { fadeMs = 0 } = {}) {
  if (!mixer?.stopInstances) return 0;
  return mixer.stopInstances(
    Object.values(BATTLE_AUDIO_LOOP_CONTRACTS).map((contract) => contract.instanceKey),
    { fadeMs },
  );
}

export function enemyVoiceCue(kind, event) {
  const profile = ENEMY_KINDS.includes(kind) ? kind : ownValue(ENEMY_VOICE_PROFILE_BY_KIND, kind);
  return profile && ENEMY_VOICE_EVENTS.includes(event) ? `enemy-${profile}-${event}` : null;
}

function outcomeFrom(value) {
  if (typeof value === "boolean") return value ? "victory" : "defeat";
  if (value && typeof value === "object") {
    if (typeof value.won === "boolean") return value.won ? "victory" : "defeat";
    return outcomeFrom(value.end ?? value.result ?? value.outcome);
  }
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  if (["victory", "win", "won", "success"].includes(normalized)) return "victory";
  if (["defeat", "lose", "lost", "failure"].includes(normalized)) return "defeat";
  return null;
}

export const STORY_AUDIO_EVENT_SCENE_IDS = Object.freeze({
  "prologue-kumaya-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_KUMAYA_DAILY,
  "prologue-collapse-montage-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_COLLAPSE_MONTAGE,
  "prologue-crawler-montage-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_CRAWLER_MONTAGE,
  "crawler-signal-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_CRAWLER_SIGNAL,
  "prologue-skip-summary-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_CRAWLER_SIGNAL,
  "stage-nishijin-pre-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE1_PRE,
  "stage-nishijin-alert-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE1_BATTLE,
  "stage-nishijin-post-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE1_POST,
  "stage-nishijin-defeat-v070": PRODUCTION_AUDIO_SCENE_IDS.DEFEAT,
  "stage-nishijin-retry-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE1_BATTLE,
  "stage-nishijin-replay-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE1_BATTLE,
  "stage-sawara-pre-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE2_PRE,
  "stage-sawara-alert-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE2_BATTLE,
  "stage-sawara-post-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE2_POST,
  "stage-sawara-defeat-v070": PRODUCTION_AUDIO_SCENE_IDS.DEFEAT,
  "stage-sawara-retry-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE2_BATTLE,
  "stage-sawara-replay-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE2_BATTLE,
  "stage-takuya-pre-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE3_PRE,
  "stage-takuya-warning-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_BOSS,
  "stage-takuya-final-v070": PRODUCTION_AUDIO_SCENE_IDS.SILENCE_STAGE3_FINAL,
  "stage-takuya-base-remains-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE3_BATTLE,
  "stage-takuya-post-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE3_POST,
  "stage-takuya-defeat-v070": PRODUCTION_AUDIO_SCENE_IDS.DEFEAT,
  "stage-takuya-defeat-after-boss-v070": PRODUCTION_AUDIO_SCENE_IDS.DEFEAT,
  "stage-takuya-retry-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE3_BATTLE,
  "stage-takuya-replay-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE3_BATTLE,
  "station-briefing-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_BRIEFING,
  "stage-station-gate-pre-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_GATE_PRE,
  "stage-station-gate-alert-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_GATE_BATTLE,
  "stage-station-gate-post-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_GATE_POST,
  "stage-station-gate-defeat-v070": PRODUCTION_AUDIO_SCENE_IDS.DEFEAT,
  "stage-station-gate-retry-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_GATE_BATTLE,
  "stage-station-gate-replay-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_GATE_BATTLE,
  "stage-station-platform-pre-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_PLATFORM_PRE,
  "stage-station-platform-alert-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_PLATFORM_BATTLE,
  "stage-station-platform-post-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_PLATFORM_POST,
  "stage-station-platform-defeat-v070": PRODUCTION_AUDIO_SCENE_IDS.DEFEAT,
  "stage-station-platform-retry-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_PLATFORM_BATTLE,
  "stage-station-platform-replay-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_PLATFORM_BATTLE,
  "stage-station-tunnel-pre-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_TUNNEL_PRE,
  "stage-station-tunnel-power-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_TUNNEL_BATTLE,
  "stage-station-escape-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_TUNNEL_BATTLE,
  "stage-station-tunnel-post-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_RETURN,
  "stage-station-tunnel-defeat-v070": PRODUCTION_AUDIO_SCENE_IDS.DEFEAT,
  "stage-station-tunnel-retry-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_TUNNEL_BATTLE,
  "stage-station-tunnel-replay-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_TUNNEL_BATTLE,
  "chapter-ending-v070": PRODUCTION_AUDIO_SCENE_IDS.STORY_CHAPTER_ENDING,
});

export const STORY_AUDIO_PHASE_RULES = Object.freeze([
  Object.freeze({ eventId: "prologue-kumaya-v070", fromLineIndex: 17, sceneId: PRODUCTION_AUDIO_SCENE_IDS.STORY_KUMAYA_CRISIS }),
  Object.freeze({ eventId: "prologue-collapse-montage-v070", fromLineIndex: 4, sceneId: PRODUCTION_AUDIO_SCENE_IDS.SILENCE_PROLOGUE_TITLE, holdMs: 2000 }),
  Object.freeze({ eventId: "stage-station-escape-v070", fromLineIndex: 5, sceneId: PRODUCTION_AUDIO_SCENE_IDS.SILENCE_STATION_SEAL, holdMs: 2500 }),
]);

export const STORY_AUDIO_SCENE_RULES = Object.freeze(
  Object.entries(STORY_AUDIO_EVENT_SCENE_IDS).map(([value, sceneId]) => Object.freeze({ match: "exact", value, sceneId })),
);

export const STORY_WARNING_EVENT_IDS = Object.freeze([
  "stage-station-gate-alert-v070",
  "stage-station-platform-alert-v070",
  "stage-station-tunnel-power-v070",
]);

export function storyWarningCueForEvent(eventId) {
  return STORY_WARNING_EVENT_IDS.includes(eventId) ? STATION_AUDIO_CUE_IDS.WARNING : null;
}

export function sceneIdForStoryEvent(eventId, lineIndex = 0) {
  if (typeof eventId !== "string" || eventId.length === 0) return null;
  let sceneId = ownValue(STORY_AUDIO_EVENT_SCENE_IDS, eventId);
  if (!sceneId) return null;
  const normalizedLineIndex = Number.isInteger(lineIndex) && lineIndex >= 0 ? lineIndex : 0;
  for (const rule of STORY_AUDIO_PHASE_RULES) {
    if (rule.eventId === eventId && normalizedLineIndex >= rule.fromLineIndex) sceneId = rule.sceneId;
  }
  return sceneId;
}

export function sceneIdForScreen(screen, stageId = null, musicState = null) {
  const outcome = outcomeFrom(musicState);
  const musicMode = typeof musicState === "string" ? musicState : musicState?.musicMode;
  const eventId = musicState && typeof musicState === "object" ? musicState.eventId : null;
  const storyLineIndex = musicState && typeof musicState === "object" ? musicState.storyLineIndex : 0;
  if (screen === "result") return outcome;
  if (screen === "title") return PRODUCTION_AUDIO_SCENE_IDS.TITLE;
  if (screen === "event" || screen === "intro") return sceneIdForStoryEvent(eventId, storyLineIndex) ?? PRODUCTION_AUDIO_SCENE_IDS.INTRO;
  if (screen === "map") return PRODUCTION_AUDIO_SCENE_IDS.MAP;
  if (screen === "loadout" || screen === "formation") return PRODUCTION_AUDIO_SCENE_IDS.LOADOUT;
  if (screen === "victory" || screen === "defeat") return screen;
  if (screen !== "battle") return null;
  if (outcome) return outcome;
  if (musicMode === "boss") return PRODUCTION_AUDIO_SCENE_IDS.BOSS;
  return ownValue(STAGE_SCENE_BY_ID, stageId);
}

export const LEGACY_SFX_CUE_MAP = Object.freeze({
  denied: "ui-error",
  queue: "ui-select",
  "ui-confirm": "ui-confirm",
  "ui-cancel": "ui-cancel",
  "supply-pod": "support-pod-deploy",
  "supply-drum": "ui-confirm",
  "supply-medical": "support-heal",
  "pod-descent": "support-pod-deploy",
  "pod-hit": "support-pod-impact",
  "pod-destroy": "support-explosion",
  "burn-start": "corpse-ignite",
  "medical-heal": "support-heal",
  "airstrike-request": "radio-open",
  "airstrike-targeting": "ui-select",
  "airstrike-inbound": "support-airstrike",
  "airstrike-return": "radio-close",
  "crawler-request": "radio-open",
  "drum-request": "ui-confirm",
  "start-low": "radio-open",
  "start-high": "ui-confirm",
  "deploy-light": "support-pod-deploy",
  "deploy-heavy": "support-pod-deploy",
  "wave-contact": "enemy-walker-attack",
  "boss-warning": "enemy-takuya-attack",
  "airstrike-impact": "support-explosion",
  "crawler-barrage": "weapon-barrage",
  "pod-impact": "support-pod-impact",
  "drum-blast": "support-explosion",
  "takuya-slam": "enemy-takuya-attack",
  "takuya-down": "enemy-takuya-death",
  "object-destroy": "support-explosion",
  "object-hit": "weapon-melee-impact",
  "takuya-hit": "enemy-takuya-hurt",
  "ranged-shot": "weapon-rifle",
  "melee-hit": "weapon-melee-impact",
  "role-scout": "weapon-crowbar",
  "role-ranger": "weapon-rifle",
  "role-brute": "weapon-hammer",
  "role-brawler": "weapon-unarmed",
  "role-gunner": "weapon-gunner",
  "role-medic": "support-heal",
  "role-crazy-king": "weapon-chainsaw-attack",
  "role-kumaverson": "weapon-pan-hit",
  "role-babayaga": "weapon-suppressed-pistol",
  "structure-heavy": "weapon-hammer",
  "structure-light": "weapon-melee-impact",
  "crawler-hit": "weapon-melee-impact",
  "crawler-critical": "ui-error",
  "base-damaged": "weapon-melee-impact",
  "base-critical": "support-explosion",
  "base-collapse": "support-explosion",
  // The result scene owns the full music track. These legacy end cues are
  // deliberately short stings so battle completion cannot start that track twice.
  victory: "ui-confirm",
  defeat: "ui-cancel",
  retry: "ui-confirm",
  turned: "enemy-turned-attack",
});
