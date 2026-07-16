import { createAudioManifest } from "./audioManifest.js";
import { CAMPAIGN_STAGE_IDS } from "./campaign.js";

const AUDIO_ROOT = "/audio/v060";

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

function sourceFor(folder, name) {
  // MP3 is first because it is supported by older iPhone Safari versions;
  // Vorbis OGG remains the higher-efficiency alternate for modern browsers.
  return [
    { src: `${AUDIO_ROOT}/${folder}/${name}.mp3`, type: "audio/mpeg" },
    { src: `${AUDIO_ROOT}/${folder}/${name}.ogg`, type: "audio/ogg" },
  ];
}

function musicAsset(name) {
  return {
    id: `music-${name}`,
    category: "bgm",
    sources: sourceFor("music", name),
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
    sources: sourceFor("sfx", name),
    preload: options.preload ?? "lazy",
    loop: options.loop ?? false,
    gain: options.gain ?? 0.82,
    priority: options.priority ?? 50,
    cooldownMs: options.cooldownMs ?? 60,
    maxInstances: options.maxInstances ?? 4,
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

const scenes = [
  { id: "title", bgm: "music-title", preload: COMMON_UI_PRELOAD, crossfadeMs: 900 },
  { id: "intro", bgm: "music-intro", ambience: ["radio-static-loop"], preload: [...COMMON_UI_PRELOAD, ...RADIO_CUES], crossfadeMs: 700 },
  { id: "map", bgm: "music-map", preload: COMMON_UI_PRELOAD, crossfadeMs: 650 },
  { id: "loadout", bgm: "music-map", preload: [...COMMON_UI_PRELOAD, ...Object.keys(WEAPON_POOL_CATEGORIES)], crossfadeMs: 350 },
  { id: "stage1", bgm: "music-battle-stage1", preload: COMBAT_PRELOAD, crossfadeMs: 800 },
  { id: "stage2", bgm: "music-battle-stage2", preload: COMBAT_PRELOAD, crossfadeMs: 800 },
  { id: "stage3", bgm: "music-battle-stage3", preload: COMBAT_PRELOAD, crossfadeMs: 800 },
  { id: "boss", bgm: "music-boss", preload: COMBAT_PRELOAD, crossfadeMs: 420 },
  { id: "victory", bgm: "music-victory", preload: ["ui-confirm"], crossfadeMs: 320 },
  { id: "defeat", bgm: "music-defeat", preload: ["ui-confirm", "ui-cancel"], crossfadeMs: 320 },
];

export const PRODUCTION_AUDIO_MANIFEST = createAudioManifest({
  version: 1,
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
  BOSS: "boss",
  VICTORY: "victory",
  DEFEAT: "defeat",
});

const STAGE_SCENE_BY_ID = Object.freeze({
  [CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET]: PRODUCTION_AUDIO_SCENE_IDS.STAGE_1,
  [CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE]: PRODUCTION_AUDIO_SCENE_IDS.STAGE_2,
  [CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE]: PRODUCTION_AUDIO_SCENE_IDS.STAGE_3,
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
  return profile && HUMAN_VOICE_EVENTS.includes(event) ? `human-${profile}-${event}` : null;
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
  return ENEMY_KINDS.includes(kind) && ENEMY_VOICE_EVENTS.includes(event) ? `enemy-${kind}-${event}` : null;
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

export function sceneIdForScreen(screen, stageId = null, musicState = null) {
  const outcome = outcomeFrom(musicState);
  const musicMode = typeof musicState === "string" ? musicState : musicState?.musicMode;
  if (screen === "result") return outcome;
  if (screen === "title") return PRODUCTION_AUDIO_SCENE_IDS.TITLE;
  if (screen === "event" || screen === "intro") return PRODUCTION_AUDIO_SCENE_IDS.INTRO;
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
  "tactic-defend": "ui-select",
  "tactic-balanced": "ui-select",
  "tactic-assault": "ui-confirm",
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
