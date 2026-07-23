import { deepFreeze } from "./freeze.js";

export const CONTENT_SCHEMA_VERSION = 1;

export const CONTENT_COLLECTIONS = deepFreeze([
  "units",
  "enemies",
  "stages",
  "missions",
  "waves",
  "maps",
  "difficulty",
  "rewards",
  "acquisition",
  "upgrades",
  "events",
  "sideEvents",
  "challenges",
  "timedEvents",
  "assets",
  "saves",
]);

export const CONTENT_SCHEMAS = deepFreeze({
  units: {
    requiredStrings: ["id", "displayName", "combatKind", "aiProfile"],
    requiredObjects: ["combat", "unlock"],
    requiredArrays: ["aliases", "assetRefs"],
  },
  enemies: {
    requiredStrings: ["id", "displayName", "spawnClass", "aiProfile"],
    requiredNumbers: ["hp", "hpPerWave", "speed", "damage", "range", "attackEvery", "bodyRadius", "laneSpeed"],
    requiredArrays: ["aliases"],
  },
  stages: {
    requiredStrings: ["id", "displayName", "missionId", "mapId", "rewardId"],
    requiredNumbers: ["stageNumber"],
    requiredArrays: ["enemyKinds", "prerequisiteStageIds", "waveIds"],
  },
  missions: {
    requiredStrings: ["id", "stageId", "missionType", "objective"],
    requiredObjects: ["objectiveConfig"],
  },
  waves: {
    requiredStrings: ["id", "stageId"],
    requiredNumbers: ["atSeconds", "waveNumber"],
    requiredArrays: ["enemyKinds", "spawns"],
  },
  maps: {
    requiredStrings: ["id", "stageId", "displayName"],
    requiredObjects: ["theme", "visualSignature"],
    requiredArrays: ["assetRefs"],
  },
  difficulty: {
    requiredStrings: ["id", "displayName"],
    requiredNumbers: ["enemyHpMultiplier", "enemyDamageMultiplier", "rewardMultiplier"],
  },
  rewards: {
    requiredStrings: ["id", "stageId"],
    requiredNumbers: ["baseReward"],
    requiredObjects: ["firstTimeStarRewards"],
  },
  acquisition: {
    requiredStrings: ["id", "unitId", "type"],
    requiredObjects: ["unlock"],
  },
  upgrades: {
    requiredStrings: ["id", "unitId", "displayName"],
    requiredNumbers: ["maxLevel"],
  },
  events: {
    requiredStrings: ["id"],
  },
  sideEvents: {
    requiredStrings: ["id", "displayName", "summary", "eventKind", "rewardPolicy"],
    requiredObjects: ["mission", "schedule"],
    requiredArrays: ["aliases"],
  },
  challenges: {
    requiredStrings: ["id", "displayName", "summary", "eventKind", "rewardPolicy"],
    requiredObjects: ["mission", "schedule"],
    requiredArrays: ["aliases"],
  },
  timedEvents: {
    requiredStrings: ["id", "displayName", "summary", "eventKind", "rewardPolicy"],
    requiredObjects: ["mission", "schedule"],
    requiredArrays: ["aliases"],
  },
  assets: {
    requiredStrings: ["id", "path", "kind"],
  },
  saves: {
    requiredStrings: ["id"],
    requiredNumbers: ["schemaVersion", "contentSchemaVersion"],
  },
});

export const STABLE_CONTENT_ID_PATTERN = /^[a-z0-9][a-z0-9._:/-]*$/u;
