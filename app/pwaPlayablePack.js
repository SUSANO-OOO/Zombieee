// Version 0.9.8.2 staged-install dependency contract.
//
// This module is shared by the manifest generator and the browser gate. It is
// intentionally derived from the same stage, sprite, visual, and audio data the
// game uses, so the first-play pack cannot drift into a hand-maintained guess.

import {
  CAMPAIGN_STAGE_BY_ID,
  CAMPAIGN_UNITS,
  INITIAL_STAGE_ID,
  INITIAL_UNIT_IDS,
} from "./campaign.js";
import {
  BATTLE_AUDIO_LOOP_CONTRACTS,
  PRODUCTION_AUDIO_MANIFEST,
  PRODUCTION_AUDIO_SCENE_IDS,
  enemyVoiceCue,
  humanVoiceCueForUnit,
  sceneIdForScreen,
  unitAudioCueFor,
  weaponCueForUnit,
} from "./productionAudio.js";
import { PRODUCTION_VISUALS, stageVisualFor } from "./productionVisuals.js";
import { STAGE_OBJECT_MANIFEST } from "./stageObjectManifest.js";
import {
  FORMATION_CARD_ART,
  PERSONNEL_CARD_ART,
  PORTRAIT_ART,
  spriteKinds,
  spriteSheetPath,
} from "./spriteManifest.js";
import { V075_VISUAL_PROFILES } from "./visualProfiles.js";

export { INITIAL_STAGE_ID };

export const PWA_INSTALL_TIERS = Object.freeze([
  "shell",
  "first-play",
  "on-demand",
  "optional",
]);

export const PWA_INSTALL_PRIORITIES = Object.freeze({
  shell: 0,
  "first-play": 10,
  "on-demand": 50,
  optional: 80,
});

const INITIAL_UNIT_BY_ID = new Map((CAMPAIGN_UNITS ?? []).map((unit) => [unit.id, unit]));

export const INITIAL_UNIT_KINDS = Object.freeze(
  INITIAL_UNIT_IDS
    .map((unitId) => INITIAL_UNIT_BY_ID.get(unitId)?.combatKind)
    .filter((kind) => typeof kind === "string"),
);

const SHELL_PATHS = Object.freeze([
  PRODUCTION_VISUALS.title,
  PRODUCTION_VISUALS.command,
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-1024.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon-180.png",
]);

// These images are requested directly by the battle renderer rather than by
// STAGE_OBJECT_MANIFEST, so they must be part of the dependency graph too.
const COMMON_BATTLE_ART_PATHS = Object.freeze([
  "/tactical-drop-pod-v1.png",
  "/explosive-drum-v1.png",
  "/medical-supply-station-v1.png",
]);

const AUDIO_ASSET_BY_ID = new Map(
  (PRODUCTION_AUDIO_MANIFEST.assets ?? []).map((asset) => [asset.id, asset]),
);
const AUDIO_POOL_BY_ID = new Map(
  (PRODUCTION_AUDIO_MANIFEST.pools ?? []).map((pool) => [pool.id, pool]),
);
const AUDIO_ALIAS_BY_ID = new Map(
  (PRODUCTION_AUDIO_MANIFEST.aliases ?? []).map((alias) => [alias.id, alias]),
);

function addUnique(set, value) {
  if (typeof value === "string" && value.length > 0) set.add(value);
}

function audioCueIdsFromReference(reference, output, seen = new Set()) {
  if (typeof reference !== "string" || seen.has(reference)) return;
  seen.add(reference);
  const alias = AUDIO_ALIAS_BY_ID.get(reference);
  if (alias) {
    audioCueIdsFromReference(alias.targetId, output, seen);
    return;
  }
  const pool = AUDIO_POOL_BY_ID.get(reference);
  if (pool) {
    for (const assetId of pool.assetIds ?? []) audioCueIdsFromReference(assetId, output, seen);
    return;
  }
  if (AUDIO_ASSET_BY_ID.has(reference)) output.add(reference);
}

function addAudioCue(reference, output) {
  audioCueIdsFromReference(reference, output);
}

function addSceneAudio(sceneId, output, { includePreload = true } = {}) {
  const scene = (PRODUCTION_AUDIO_MANIFEST.scenes ?? []).find((entry) => entry.id === sceneId);
  if (!scene) return;
  for (const reference of [scene.bgm, ...(scene.ambience ?? []), ...(includePreload ? (scene.preload ?? []) : [])]) {
    audioCueIdsFromReference(reference, output);
  }
}

function stageFor(stageId) {
  return CAMPAIGN_STAGE_BY_ID[stageId] ?? CAMPAIGN_STAGE_BY_ID[INITIAL_STAGE_ID];
}

function stageBattleKinds(stageId) {
  const stage = stageFor(stageId);
  return [
    ...(stage?.enemyKinds ?? []),
    ...((stage?.waves ?? []).flatMap((wave) => (wave.groups ?? []).map((group) => group.kind))),
  ];
}

function spritePathsForKinds(kinds, output) {
  for (const kind of new Set(kinds)) {
    if (spriteKinds.includes(kind)) addUnique(output, spriteSheetPath(kind));
  }
}

function addStageVisualDependencies(stageId, output) {
  addUnique(output, stageVisualFor(stageId));
  for (const object of STAGE_OBJECT_MANIFEST[stageId]?.objects ?? []) addUnique(output, object.path);
}

/**
 * Returns image paths needed for the current stage/formation. The result is
 * also used for on-demand stage and unit downloads after the player is already
 * in the game.
 */
export function dependencyPathsForOperation({ stageId = INITIAL_STAGE_ID, unitKinds = INITIAL_UNIT_KINDS } = {}) {
  const output = new Set();
  addStageVisualDependencies(stageId, output);
  spritePathsForKinds([
    ...unitKinds,
    ...stageBattleKinds(stageId),
    "turned",
  ], output);
  addUnique(output, V075_VISUAL_PROFILES.crawler.closed.path);
  addUnique(output, V075_VISUAL_PROFILES.crawler.open.path);
  addUnique(output, V075_VISUAL_PROFILES.enemyBase.intact.path);
  for (const path of COMMON_BATTLE_ART_PATHS) addUnique(output, path);
  return output;
}

function initialAudioDependencies() {
  const output = new Set();
  const sceneIds = [
    PRODUCTION_AUDIO_SCENE_IDS.TITLE,
    PRODUCTION_AUDIO_SCENE_IDS.MAP,
    PRODUCTION_AUDIO_SCENE_IDS.LOADOUT,
    PRODUCTION_AUDIO_SCENE_IDS.STAGE_1,
    PRODUCTION_AUDIO_SCENE_IDS.VICTORY,
    PRODUCTION_AUDIO_SCENE_IDS.DEFEAT,
    PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE1_PRE,
    PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE1_BATTLE,
    PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE1_POST,
  ];
  for (const sceneId of sceneIds) addSceneAudio(sceneId, output, { includePreload: false });

  // The full combat preload intentionally covers every later unit. The first
  // play contract narrows it to the initial formation, Stage1 enemies, and the
  // support/lifecycle cues that can actually be triggered in that battle.
  for (const cue of [
    "ui-cancel",
    "ui-confirm",
    "ui-error",
    "ui-hover",
    "ui-select",
    "employment-dossier-reveal",
    "support-airstrike",
    "support-barrier",
    "support-explosion",
    "support-heal",
    "support-pod-deploy",
    "support-pod-impact",
    "infection-twitch-01",
    "infection-warning-01",
    "corpse-ignite",
    "corpse-burn-loop",
    "radio-open",
    "radio-close",
  ]) addAudioCue(cue, output);
  for (const kind of [...INITIAL_UNIT_KINDS, ...stageBattleKinds(INITIAL_STAGE_ID)]) {
    addAudioCue(weaponCueForUnit(kind), output);
    for (const event of ["attack", "hurt", "death"]) {
      addAudioCue(humanVoiceCueForUnit(kind, event), output);
      addAudioCue(enemyVoiceCue(kind, event), output);
    }
    for (const event of [
      "start", "idleLoop", "attack", "fleshHit", "hardHit", "stop", "swing", "hit", "heavyHit", "stun",
      "shot", "reload", "specialKill",
    ]) {
      addAudioCue(unitAudioCueFor(kind, "weapon", event), output);
    }
    for (const event of ["deploy", "attack", "hurt", "death", "retreat"]) {
      addAudioCue(unitAudioCueFor(kind, "voice", event), output);
    }
  }
  for (const contract of Object.values(BATTLE_AUDIO_LOOP_CONTRACTS)) addAudioCue(contract.cueId, output);
  return output;
}

export const FIRST_PLAY_AUDIO_IDS = Object.freeze([...initialAudioDependencies()]);

export function dependencyAudioIdsForOperation({ stageId = INITIAL_STAGE_ID, unitKinds = INITIAL_UNIT_KINDS } = {}) {
  const output = new Set();
  const sceneId = sceneIdForScreen("battle", stageId);
  if (sceneId) addSceneAudio(sceneId, output, { includePreload: false });
  for (const kind of [...unitKinds, ...stageBattleKinds(stageId)]) {
    addAudioCue(weaponCueForUnit(kind), output);
    for (const event of ["attack", "hurt", "death"]) {
      addAudioCue(humanVoiceCueForUnit(kind, event), output);
      addAudioCue(enemyVoiceCue(kind, event), output);
    }
    for (const event of ["start", "idleLoop", "attack", "fleshHit", "hardHit", "stop", "swing", "hit", "heavyHit", "stun", "shot", "reload", "specialKill"]) {
      addAudioCue(unitAudioCueFor(kind, "weapon", event), output);
    }
    for (const event of ["deploy", "attack", "hurt", "death", "retreat"]) {
      addAudioCue(unitAudioCueFor(kind, "voice", event), output);
    }
  }
  return output;
}

export const FIRST_PLAY_PATHS = Object.freeze([
  ...new Set([
    ...SHELL_PATHS,
    ...dependencyPathsForOperation({ stageId: INITIAL_STAGE_ID, unitKinds: INITIAL_UNIT_KINDS }),
    PORTRAIT_ART.radio,
  ]),
]);

export const ON_DEMAND_PATHS = Object.freeze([
  ...new Set([
    ...Object.values(PRODUCTION_VISUALS.stages),
    ...Object.values(PRODUCTION_VISUALS.eventCuts),
    ...Object.values(PRODUCTION_VISUALS.missionObjects),
    ...Object.values(STAGE_OBJECT_MANIFEST).flatMap((entry) => (entry.objects ?? []).map((object) => object.path)),
    ...spriteKinds.map((kind) => spriteSheetPath(kind)),
    ...COMMON_BATTLE_ART_PATHS,
    V075_VISUAL_PROFILES.crawler.closed.path,
    V075_VISUAL_PROFILES.crawler.open.path,
    V075_VISUAL_PROFILES.enemyBase.intact.path,
    ...Object.values(FORMATION_CARD_ART),
    ...Object.values(PERSONNEL_CARD_ART),
  ]),
]);

export function tierForPath(assetPath) {
  if (SHELL_PATHS.includes(assetPath)) return "shell";
  if (FIRST_PLAY_PATHS.includes(assetPath)) return "first-play";
  if (ON_DEMAND_PATHS.includes(assetPath)) return "on-demand";
  return "optional";
}

export function tierForAudioId(audioId) {
  return FIRST_PLAY_AUDIO_IDS.includes(audioId) ? "first-play" : "on-demand";
}

/** Returns a complete dependency description for an install or on-demand job. */
export function dependencySetForOperation({ stageId = INITIAL_STAGE_ID, unitKinds = INITIAL_UNIT_KINDS } = {}) {
  return {
    paths: dependencyPathsForOperation({ stageId, unitKinds }),
    audioIds: dependencyAudioIdsForOperation({ stageId, unitKinds }),
  };
}

export function preferredAudioAsset(assets, { canPlayType } = {}) {
  const candidates = [...assets];
  const scored = candidates.map((asset) => {
    const type = asset.audioType ?? "";
    const support = typeof canPlayType === "function" ? String(canPlayType(type) ?? "") : "maybe";
    const supported = support === "probably" ? 30 : support === "maybe" ? 20 : 0;
    const format = type === "audio/mpeg" || /\.mp3$/i.test(asset.path) ? 3
      : type === "audio/ogg" || /\.ogg$/i.test(asset.path) ? 2
        : type === "audio/wav" || /\.wav$/i.test(asset.path) ? 1 : 0;
    return { asset, score: supported + format };
  });
  scored.sort((left, right) => right.score - left.score || (left.asset.path < right.asset.path ? -1 : 1));
  return scored[0]?.asset ?? null;
}

/** Keeps the manifest's alternate audio sources but downloads only one usable source. */
export function selectPreferredAudioVariants(assets, options = {}) {
  const groups = new Map();
  const nonAudio = [];
  for (const asset of assets ?? []) {
    if (asset.category !== "audio" || typeof asset.audioId !== "string") {
      nonAudio.push(asset);
      continue;
    }
    const group = groups.get(asset.audioId) ?? [];
    group.push(asset);
    groups.set(asset.audioId, group);
  }
  const selected = [...nonAudio];
  for (const group of groups.values()) {
    const variant = preferredAudioAsset(group, options);
    if (variant) selected.push(variant);
  }
  return selected;
}

export function assetsForDependencySet(manifest, dependencies, options = {}) {
  const paths = dependencies?.paths instanceof Set ? dependencies.paths : new Set(dependencies?.paths ?? []);
  const audioIds = dependencies?.audioIds instanceof Set ? dependencies.audioIds : new Set(dependencies?.audioIds ?? []);
  const assets = (manifest?.assets ?? []).filter((asset) => paths.has(asset.path) || (asset.category === "audio" && audioIds.has(asset.audioId)));
  return selectPreferredAudioVariants(assets, options);
}

export function assetsForInstall(manifest, { firstPlayOnly = false, canPlayType } = {}) {
  const tiers = firstPlayOnly ? new Set(["shell", "first-play"]) : null;
  const assets = (manifest?.assets ?? []).filter((asset) => !tiers || tiers.has(asset.installTier ?? tierForPath(asset.path)));
  return selectPreferredAudioVariants(assets, { canPlayType });
}
