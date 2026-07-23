import {
  CAMPAIGN_FORMATION_MAX_SLOTS,
  CAMPAIGN_GUIDE,
  CAMPAIGN_SAVE_SCHEMA_VERSION,
  CAMPAIGN_STAGES,
  CAMPAIGN_UNITS,
  STAGE_VISUAL_SIGNATURES,
} from "../campaign.js";
import { PRODUCTION_AUDIO_MANIFEST } from "../productionAudio.js";
import { PRODUCTION_VISUALS, STORY_BACKGROUND_VISUALS } from "../productionVisuals.js";
import { PORTRAIT_ART, SPRITE_MANIFEST } from "../spriteManifest.js";
import { STAGE_OBJECT_MANIFEST } from "../stageObjectManifest.js";
import { STORY_EVENTS } from "../storyEvents.js";
import { UNIT_PROGRESSION_MAX_RANK, UNIT_PROGRESSION_RANKS } from "../unitProgression.js";
import { ENEMY_CONTENT, ENEMY_CONTENT_BY_ID } from "./enemyCatalog.js";
import { deepFreeze } from "./freeze.js";
import { createContentLoader } from "./loader.js";
import { CONTENT_SCHEMA_VERSION } from "./schema.js";
import { UNIT_CONTENT_BY_ID } from "./unitCatalog.js";

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, "en"));
}

function collectAssetPaths(value, output = new Set(), seen = new WeakSet()) {
  if (typeof value === "string") {
    if (value.startsWith("/") && /\.(?:avif|gif|jpe?g|mp3|ogg|png|svg|webp|wav)$/iu.test(value)) output.add(value);
    return output;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return output;
  seen.add(value);
  for (const child of Object.values(value)) collectAssetPaths(child, output, seen);
  return output;
}

function assetKind(path) {
  const extension = path.split(".").at(-1)?.toLowerCase();
  if (["mp3", "ogg", "wav"].includes(extension)) return "audio";
  if (extension === "svg") return "vector";
  return "image";
}

function normalizeWave(stage, wave, index) {
  const spawns = Array.isArray(wave.units)
    ? wave.units.map((unit) => ({
      enemyId: String(Array.isArray(unit) ? unit[0] : unit),
      count: 1,
      laneHints: [],
    }))
    : (wave.groups ?? []).map((group) => ({
      enemyId: group.kind,
      count: group.count,
      laneHints: [],
    }));
  return {
    ...wave,
    id: wave.id,
    stageId: stage.id,
    waveNumber: wave.waveNumber ?? index + 1,
    enemyKinds: uniqueSorted(spawns.map(({ enemyId }) => enemyId)),
    spawns,
  };
}

const waves = CAMPAIGN_STAGES.flatMap((stage) => (
  stage.waves.map((wave, index) => normalizeWave(stage, wave, index))
));

const missions = CAMPAIGN_STAGES.map((stage) => ({
  id: `mission:${stage.id}`,
  stageId: stage.id,
  displayName: stage.objective,
  missionType: stage.missionType,
  objective: stage.objective,
  objectiveConfig: stage.objectiveConfig,
  waveIds: stage.waves.map((wave) => wave.id),
}));

const maps = CAMPAIGN_STAGES.map((stage) => {
  const visualSignature = STAGE_VISUAL_SIGNATURES[stage.id];
  const visual = PRODUCTION_VISUALS[stage.id] ?? null;
  const stageObjects = STAGE_OBJECT_MANIFEST[stage.id] ?? null;
  return {
    id: `map:${stage.id}`,
    stageId: stage.id,
    displayName: stage.displayName,
    theme: stage.theme,
    visualSignature,
    assetRefs: uniqueSorted([...collectAssetPaths([visual, stageObjects])]),
  };
});

const rewards = CAMPAIGN_STAGES.map((stage) => ({
  id: `reward:${stage.id}`,
  stageId: stage.id,
  baseReward: stage.baseReward,
  firstTimeStarRewards: stage.firstTimeStarRewards,
  replayRewardMultipliers: stage.replayRewardMultipliers,
}));

const units = CAMPAIGN_UNITS.map((unit) => {
  const combat = UNIT_CONTENT_BY_ID[unit.combatKind];
  return {
    ...unit,
    id: unit.id,
    aliases: uniqueSorted([unit.combatKind, ...unit.aliases]),
    aiProfile: combat.aiProfile,
    combat,
    assetRefs: uniqueSorted([unit.spritePath, PORTRAIT_ART[unit.combatKind]]),
  };
});

const stages = CAMPAIGN_STAGES.map((stage) => ({
  ...stage,
  missionId: `mission:${stage.id}`,
  mapId: `map:${stage.id}`,
  rewardId: `reward:${stage.id}`,
  waveIds: stage.waves.map((wave) => wave.id),
}));

const acquisition = CAMPAIGN_UNITS.map((unit) => ({
  id: `acquisition:${unit.id}`,
  unitId: unit.id,
  type: unit.unlock.type,
  unlock: unit.unlock,
}));

const upgrades = CAMPAIGN_UNITS.map((unit) => ({
  id: `upgrade:${unit.id}`,
  unitId: unit.id,
  displayName: `${unit.displayName} 強化`,
  maxLevel: UNIT_PROGRESSION_MAX_RANK,
  ranks: UNIT_PROGRESSION_RANKS,
}));

const events = Object.values(STORY_EVENTS).map((event) => ({
  ...event,
  aliases: event.aliases ?? [],
}));

const assetSources = [
  units,
  CAMPAIGN_GUIDE,
  PRODUCTION_AUDIO_MANIFEST,
  PRODUCTION_VISUALS,
  STORY_BACKGROUND_VISUALS,
  SPRITE_MANIFEST,
  PORTRAIT_ART,
  STAGE_OBJECT_MANIFEST,
];

const assets = uniqueSorted([...collectAssetPaths(assetSources)]).map((path) => ({
  id: `asset:${path}`,
  path,
  kind: assetKind(path),
}));

export const CONTENT_REGISTRY = deepFreeze({
  contentSchemaVersion: CONTENT_SCHEMA_VERSION,
  units,
  enemies: ENEMY_CONTENT,
  stages,
  missions,
  waves,
  maps,
  difficulty: [{
    id: "difficulty:standard",
    displayName: "標準",
    enemyHpMultiplier: 1,
    enemyDamageMultiplier: 1,
    rewardMultiplier: 1,
  }],
  rewards,
  acquisition,
  upgrades,
  events,
  sideEvents: [],
  challenges: [],
  timedEvents: [],
  assets,
  saves: [{
    id: `save:campaign-v${CAMPAIGN_SAVE_SCHEMA_VERSION}`,
    schemaVersion: CAMPAIGN_SAVE_SCHEMA_VERSION,
    contentSchemaVersion: CONTENT_SCHEMA_VERSION,
    formationMaxSlots: CAMPAIGN_FORMATION_MAX_SLOTS,
  }],
});

export const contentLoader = createContentLoader(CONTENT_REGISTRY);

export const CONTENT_REGISTRY_FACTS = deepFreeze({
  collectionCounts: Object.fromEntries(Object.entries(CONTENT_REGISTRY)
    .filter(([, value]) => Array.isArray(value))
    .map(([collection, records]) => [collection, records.length])),
  enemyIds: Object.keys(ENEMY_CONTENT_BY_ID),
});
