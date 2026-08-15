import { PRODUCTION_AUDIO_SCENE_IDS } from "./productionAudio.js";
import { PRODUCTION_VISUALS } from "./productionVisuals.js";
import { STAGE_OBJECT_MANIFEST } from "./stageObjectManifest.js";
import { V100_STAGE_BY_ID, V100_STAGES } from "./v100Registry.js";

const ASSAULT_STATES = Object.freeze(["intact", "damaged", "critical", "destroyed"]);
const DEFENSE_STATES = Object.freeze(["perimeter", "incoming", "impact", "success"]);
const ESCORT_STATES = Object.freeze(["moving", "intact", "damaged", "critical", "destroyed"]);
const NODE_STATES = Object.freeze(["off", "engaged", "on", "connection", "disconnection"]);
const BOSS_STATES = Object.freeze(["entrance", "telegraph", "phase", "hit", "death", "defeat"]);

function sceneIdsFor(stage) {
  const number = stage.number;
  const boss = stage.missionType === "boss";
  if (number === 1) return { pre: PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE1_PRE, battle: boss ? PRODUCTION_AUDIO_SCENE_IDS.STORY_BOSS : PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE1_BATTLE, post: PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE1_POST };
  if (number === 2) return { pre: PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE2_PRE, battle: PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE2_BATTLE, post: PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE2_POST };
  if (number === 3) return { pre: PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE3_PRE, battle: boss ? PRODUCTION_AUDIO_SCENE_IDS.STORY_BOSS : PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE3_BATTLE, post: PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE3_POST };
  if (number === 4) return { pre: PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_GATE_PRE, battle: PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_GATE_BATTLE, post: PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_GATE_POST };
  if (number === 5) return { pre: PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_PLATFORM_PRE, battle: boss ? PRODUCTION_AUDIO_SCENE_IDS.STORY_BOSS : PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_PLATFORM_BATTLE, post: PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_PLATFORM_POST };
  if (number === 6) return { pre: PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_TUNNEL_PRE, battle: PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_TUNNEL_BATTLE, post: PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_RETURN };
  if (number <= 9) return { pre: PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE2_PRE, battle: PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE2_BATTLE, post: PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE2_POST };
  if (number <= 16) return { pre: PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_TUNNEL_PRE, battle: boss ? PRODUCTION_AUDIO_SCENE_IDS.STORY_BOSS : PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_TUNNEL_BATTLE, post: PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_RETURN };
  return { pre: PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE3_PRE, battle: boss ? PRODUCTION_AUDIO_SCENE_IDS.STORY_BOSS : PRODUCTION_AUDIO_SCENE_IDS.STORY_STAGE3_BATTLE, post: PRODUCTION_AUDIO_SCENE_IDS.STORY_STATION_RETURN };
}

function objectiveStatesFor(missionType) {
  if (missionType === "timed-defense") return DEFENSE_STATES;
  if (missionType === "escort") return ESCORT_STATES;
  if (missionType === "power" || missionType === "seal") return NODE_STATES;
  if (missionType === "boss") return Object.freeze([...ASSAULT_STATES, ...BOSS_STATES]);
  return ASSAULT_STATES;
}

function objectPathsFor(stageId) {
  const manifest = STAGE_OBJECT_MANIFEST[stageId];
  return manifest ? manifest.objects.map((entry) => entry.path) : [];
}

function runtimeRecord(stage) {
  const existingManifest = STAGE_OBJECT_MANIFEST[stage.id] ?? null;
  // Stages 21-30 are intentionally reserved for the Phase 3 runtime-derived
  // backgrounds. Keeping the record present lets the Phase 2 registry and
  // reachability checks load without silently borrowing an earlier stage.
  const backgroundPath = PRODUCTION_VISUALS.stages[stage.id] ?? null;
  return Object.freeze({
    stageId: stage.id,
    stageNumber: stage.number,
    backgroundPath,
    reuseBoundary: stage.number <= 20 ? "existing-production-or-approved-mission-source" : "v100-derived-runtime-required",
    objective: Object.freeze({
      id: stage.objectiveId,
      missionType: stage.missionType,
      states: objectiveStatesFor(stage.missionType),
      source: existingManifest ? "existing-stage-object-manifest" : "existing-authored-runtime-object-contract",
    }),
    missionObjectPaths: Object.freeze(objectPathsFor(stage.id)),
    requiredAssetPaths: Object.freeze([...(backgroundPath ? [backgroundPath] : []), ...objectPathsFor(stage.id)]),
    audio: Object.freeze({
      profile: stage.audioProfile,
      scenes: Object.freeze(sceneIdsFor(stage)),
      bossOwnsProductionSceneUntilDeath: stage.missionType === "boss",
    }),
    enemyPack: stage.enemyPack,
    storyEventIds: Object.freeze(Object.values(stage.eventIds)),
  });
}

export const V100_STAGE_RUNTIME = Object.freeze(Object.fromEntries(V100_STAGES.map((stage) => [stage.id, runtimeRecord(stage)])));

export function v100StageRuntimeFor(stageId) {
  return V100_STAGE_RUNTIME[stageId] ?? null;
}

export function v100StageRequiredAssetPaths(stageId) {
  return v100StageRuntimeFor(stageId)?.requiredAssetPaths ?? [];
}

export function v100StageAudioFor(stageId, phase = "pre") {
  const scenes = v100StageRuntimeFor(stageId)?.audio.scenes;
  return scenes?.[phase] ?? null;
}

export function validateV100StageRuntimeRegistry() {
  const errors = [];
  for (const stage of V100_STAGES) {
    const runtime = V100_STAGE_RUNTIME[stage.id];
    if (!runtime) errors.push(`${stage.id}:missing-runtime`);
    if (runtime && runtime.stageNumber !== stage.number) errors.push(`${stage.id}:stage-number`);
    if (runtime && runtime.storyEventIds.length !== 3) errors.push(`${stage.id}:event-triplet`);
    if (runtime && runtime.objective.states.length === 0) errors.push(`${stage.id}:objective-states`);
    if (runtime && stage.number <= 20 && runtime.requiredAssetPaths.length === 0) errors.push(`${stage.id}:required-assets`);
    if (runtime && stage.number <= 20 && !runtime.backgroundPath) errors.push(`${stage.id}:background`);
    if (V100_STAGE_BY_ID[stage.id]?.missionType !== runtime?.objective.missionType) errors.push(`${stage.id}:mission-type`);
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors), stageCount: Object.keys(V100_STAGE_RUNTIME).length });
}

export const V100_PHASE2_STAGE_NUMBERS = Object.freeze(Array.from({ length: 20 }, (_, index) => index + 1));
