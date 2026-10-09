import { PRODUCTION_AUDIO_MANIFEST } from "./productionAudio.js";
import { productionEnemyRuntimeContract } from "./productionEnemyRuntime.js";
import { V100_STAGE_RUNTIME } from "./v100StageRuntime.js";
import {
  V100_RUNTIME_ASSET_MANIFEST,
  v100RuntimeAssetPathList,
} from "./v100RuntimeAssetManifest.js";
import { V100_STAGE_IDS, V100_STAGES } from "./v100Registry.js";
import { V100_STORY_EVENTS } from "./v100StoryEvents.js";

const V100_CANONICAL_CONTENT_VERSION = "v100-canonical-content-v1";

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
}

function assetKey(value) {
  return typeof value === "string" ? value.replace(/^\//u, "") : value;
}

function stageEnemyKinds(stageId, battleDefinitionFor) {
  const definition = battleDefinitionFor(stageId);
  if (Array.isArray(definition)) return uniqueStrings(definition);
  return uniqueStrings([
    ...(definition?.timeline ?? []).flatMap((wave) => wave.units ?? []),
    definition?.bossEnemyKind,
  ]);
}

/**
 * The V1 content gate is intentionally independent of the legacy content
 * registry. It follows the exact sources mounted by the V1 route and battle
 * adapter, then fails closed when a story, scene, asset, or reachable enemy
 * reference is removed.
 */
export function validateV100CanonicalContent({
  stages = V100_STAGES,
  stageIds = V100_STAGE_IDS,
  runtimes = V100_STAGE_RUNTIME,
  storyEvents = V100_STORY_EVENTS,
  audioManifest = PRODUCTION_AUDIO_MANIFEST,
  runtimeAssetManifest = V100_RUNTIME_ASSET_MANIFEST,
  runtimeAssetPaths = v100RuntimeAssetPathList(),
  physicalAssetPaths = null,
  enemyRuntime = productionEnemyRuntimeContract(),
  battleDefinitionFor = null,
} = {}) {
  const errors = [];
  const expectedIds = [...stageIds];
  const actualIds = Array.isArray(stages) ? stages.map((stage) => stage?.id) : [];
  const expectedSet = new Set(expectedIds);
  const actualSet = new Set(actualIds);
  const duplicateStageIds = actualIds.filter((id, index) => actualIds.indexOf(id) !== index);
  const missingStageIds = expectedIds.filter((id) => !actualSet.has(id));
  const unexpectedStageIds = actualIds.filter((id) => !expectedSet.has(id));
  if (actualIds.length !== expectedIds.length) errors.push(`stage-count:${actualIds.length}/${expectedIds.length}`);
  for (const id of duplicateStageIds) errors.push(`stage-duplicate:${String(id)}`);
  for (const id of missingStageIds) errors.push(`stage-missing:${id}`);
  for (const id of unexpectedStageIds) errors.push(`stage-unexpected:${String(id)}`);
  for (let index = 0; index < expectedIds.length; index += 1) {
    if (actualIds[index] !== expectedIds[index]) errors.push(`stage-order:${index + 1}:${String(actualIds[index])}`);
  }

  const sceneById = audioManifest?.sceneById ?? {};
  const battleDefinition = battleDefinitionFor ?? ((stageId) => {
    const source = enemyRuntime?.stageSources?.find((entry) => entry.stageId === stageId && entry.source === "v100-battle-adapter")
      ?? enemyRuntime?.stageSources?.find((entry) => entry.stageId === stageId);
    return source?.plannedEnemyKinds ?? source?.enemyKinds ?? [];
  });
  const reachableEnemyKinds = new Set();
  const requiredAssetRefs = new Set();
  const storyEventRefs = new Set();
  const audioSceneRefs = new Set();
  const stageReports = [];

  for (const stage of Array.isArray(stages) ? stages : []) {
    if (!stage || typeof stage.id !== "string") {
      errors.push("stage-invalid-record");
      continue;
    }
    const runtime = runtimes?.[stage.id];
    if (!runtime) {
      errors.push(`${stage.id}:runtime-missing`);
      continue;
    }
    if (runtime.stageNumber !== stage.number) errors.push(`${stage.id}:runtime-stage-number`);
    if (!runtime.objective?.id || !runtime.objective?.missionType) errors.push(`${stage.id}:mission-objective-missing`);
    if (!runtime.backgroundPath) errors.push(`${stage.id}:background-missing`);
    const eventIds = Array.isArray(runtime.storyEventIds) ? runtime.storyEventIds : [];
    if (eventIds.length !== 3) errors.push(`${stage.id}:story-event-triplet`);
    for (const eventId of eventIds) {
      storyEventRefs.add(eventId);
      const event = storyEvents?.[eventId];
      if (!event) errors.push(`${stage.id}:story-event-missing:${String(eventId)}`);
      else if (!Array.isArray(event.nodes)) errors.push(`${stage.id}:story-event-nodes-invalid:${eventId}`);
    }
    const requiredPaths = Array.isArray(runtime.requiredAssetPaths) ? runtime.requiredAssetPaths : [];
    if (requiredPaths.length === 0) errors.push(`${stage.id}:runtime-assets-empty`);
    for (const assetPath of requiredPaths) {
      requiredAssetRefs.add(assetPath);
      if (physicalAssetPaths && !physicalAssetPaths.has(assetKey(assetPath))) {
        errors.push(`${stage.id}:asset-missing:${String(assetPath)}`);
      }
    }
    for (const sceneId of Object.values(runtime.audio?.scenes ?? {})) {
      audioSceneRefs.add(sceneId);
      if (!sceneById[sceneId]) errors.push(`${stage.id}:audio-scene-missing:${String(sceneId)}`);
    }
    const enemyKinds = stageEnemyKinds(stage.id, battleDefinition);
    for (const kind of enemyKinds) reachableEnemyKinds.add(kind);
    stageReports.push(Object.freeze({
      stageId: stage.id,
      number: stage.number,
      storyEventIds: Object.freeze([...eventIds]),
      audioSceneIds: Object.freeze(Object.values(runtime.audio?.scenes ?? {})),
      assetCount: requiredPaths.length,
      enemyKinds: Object.freeze(enemyKinds),
    }));
  }

  // The runtime contract also includes legacy encounters that remain mounted
  // by the shared battle owner. Unioning its planned set keeps this V1 gate
  // honest about the complete production candidate instead of treating the
  // V100 campaign adapter as a second, isolated enemy universe.
  for (const source of enemyRuntime?.stageSources ?? []) {
    for (const kind of source.plannedEnemyKinds ?? source.enemyKinds ?? []) reachableEnemyKinds.add(kind);
  }
  const requiredEnemyKinds = uniqueStrings(enemyRuntime?.registryKinds ?? enemyRuntime?.requiredEnemyKinds ?? []);
  const reachableSorted = [...reachableEnemyKinds].sort();
  const requiredSorted = [...requiredEnemyKinds].sort();
  const missingEnemyKinds = requiredSorted.filter((kind) => !reachableEnemyKinds.has(kind));
  const unknownEnemyKinds = reachableSorted.filter((kind) => !requiredEnemyKinds.includes(kind));
  if (missingEnemyKinds.length > 0) errors.push(`enemy-missing:${missingEnemyKinds.join(",")}`);
  if (unknownEnemyKinds.length > 0) errors.push(`enemy-unregistered:${unknownEnemyKinds.join(",")}`);

  const manifestPaths = uniqueStrings(runtimeAssetPaths);
  for (const assetPath of manifestPaths) {
    if (physicalAssetPaths && !physicalAssetPaths.has(assetKey(assetPath))) errors.push(`manifest-asset-missing:${assetPath}`);
  }
  for (const [name, path] of Object.entries(runtimeAssetManifest?.portraits ?? {})) {
    if (typeof path !== "string" || path.length === 0) errors.push(`manifest-portrait-invalid:${name}`);
  }

  return Object.freeze({
    ok: errors.length === 0,
    version: V100_CANONICAL_CONTENT_VERSION,
    errors: Object.freeze(errors),
    counts: Object.freeze({
      stages: Array.isArray(stages) ? stages.length : 0,
      storyEvents: Object.keys(storyEvents ?? {}).length,
      stageStoryRefs: storyEventRefs.size,
      runtimeAssets: manifestPaths.length,
      stageAssetRefs: requiredAssetRefs.size,
      audioSceneRefs: audioSceneRefs.size,
      reachableEnemyKinds: reachableSorted.length,
    }),
    missingEnemyKinds: Object.freeze(missingEnemyKinds),
    unknownEnemyKinds: Object.freeze(unknownEnemyKinds),
    stageReports: Object.freeze(stageReports),
    runtimeAssetManifest: Object.freeze({
      schema: runtimeAssetManifest?.schema ?? null,
      stageCount: Object.keys(runtimeAssetManifest?.stages ?? {}).length,
    }),
  });
}

export { V100_CANONICAL_CONTENT_VERSION };
