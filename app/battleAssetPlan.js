import { CAMPAIGN_STAGE_BY_ID, CAMPAIGN_STAGE_IDS } from "./campaign.js";
import { PRODUCTION_VISUALS, stageVisualFor } from "./productionVisuals.js";
import { legacySpriteKinds, spriteKinds, spriteSheetPath } from "./spriteManifest.js";
import { STAGE_OBJECT_MANIFEST } from "./stageObjectManifest.js";
import { V075_VISUAL_PROFILES } from "./visualProfiles.js";
import { V099_CRAWLER_RUNTIME_PROFILE } from "./crawlerEquipmentSprites.js";
import { V100_RUNTIME_ASSET_MANIFEST } from "./v100RuntimeAssetManifest.js";
import { V100_STAGE_BY_ID } from "./v100Registry.js";

export const BATTLE_SUPPORT_ASSET_PATHS = Object.freeze({
  pod: "/tactical-drop-pod-v1.png",
  drum: "/explosive-drum-v1.png",
  medical: "/medical-supply-station-v1.png",
});

export const BATTLE_CRAWLER_ASSET_PATHS = Object.freeze({
  crawlerHostClosed: V099_CRAWLER_RUNTIME_PROFILE.equipmentHost.closed.path,
  crawlerDeploymentBase: V099_CRAWLER_RUNTIME_PROFILE.deployment.baseInterior.path,
  crawlerForegroundMask: V099_CRAWLER_RUNTIME_PROFILE.deployment.foregroundMask.path,
  crawlerBarrageEquipment: V099_CRAWLER_RUNTIME_PROFILE.equipment.barrage.sheet.path,
  crawlerAirstrikeEquipment: V099_CRAWLER_RUNTIME_PROFILE.equipment.airstrike.sheet.path,
});

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
function frozenEntry(entry) {
  return Object.freeze({ ...entry });
}

/**
 * Single production owner for the visual assets that must be decoded before a
 * battle can mount. The PWA already stores the complete pack; this plan owns
 * only the current-stage in-memory decode boundary.
 */
export function requiredBattleAssetPlan({
  stageId,
  formationKinds = [],
  enemyKinds = [],
  includeAllSprites = false,
  includeV100Sprites = true,
} = {}) {
  const stage = CAMPAIGN_STAGE_BY_ID[stageId];
  const v100Stage = V100_STAGE_BY_ID[stageId] ?? null;
  const v100RuntimeStage = V100_RUNTIME_ASSET_MANIFEST.stages[stageId] ?? null;
  if (!stage && !v100Stage && !PRODUCTION_VISUALS.stages[stageId]) {
    throw new RangeError(`Unknown battle stage: ${String(stageId)}`);
  }
  const requiredKinds = includeAllSprites
    ? [...(includeV100Sprites ? spriteKinds : legacySpriteKinds)]
    : unique([...formationKinds, ...enemyKinds, "turned"]);
  const manifestObjects = STAGE_OBJECT_MANIFEST[stageId]?.objects ?? [];
  const v100MissionObjectEntries = v100RuntimeStage
    ? Object.entries(V100_RUNTIME_ASSET_MANIFEST.missionObjects)
      .filter(([, path]) => v100RuntimeStage.missionObjects.includes(path))
      .map(([id, path]) => ({ id, path, runtimeUsage: "mission-render-source" }))
    : [];
  const v100VfxEntries = v100RuntimeStage
    ? Object.entries(V100_RUNTIME_ASSET_MANIFEST.vfx)
      .filter(([, path]) => v100RuntimeStage.vfx.includes(path))
      .map(([id, path]) => ({ id: `vfx-${id}`, path, runtimeUsage: "battle-overlay" }))
    : [];
  const extraMissionObjects = stage?.missionType === "escort"
    && stageId !== CAMPAIGN_STAGE_IDS.COASTAL_LINK_BRIDGE
    ? [{ id: "maintenance-cart", path: PRODUCTION_VISUALS.missionObjects["maintenance-cart"], runtimeUsage: "mission-render-source" }]
    : [];
  const allStageObjects = [...manifestObjects, ...extraMissionObjects, ...v100MissionObjectEntries, ...v100VfxEntries];
  const stageObjects = unique(allStageObjects.map((entry) => entry.id))
    .map((id) => allStageObjects.find((entry) => entry.id === id))
    .map((entry) => frozenEntry({
      id: entry.id,
      path: entry.path,
      category: entry.runtimeUsage === "mission-render-source" ? "mission" : "stage-object",
      runtimeUsage: entry.runtimeUsage ?? "battle-overlay",
    }));
  const persistent = [
    ...Object.entries(BATTLE_CRAWLER_ASSET_PATHS)
      .map(([key, path]) => frozenEntry({ key, path, category: "crawler" })),
    ...Object.entries(BATTLE_SUPPORT_ASSET_PATHS)
      .map(([key, path]) => frozenEntry({ key, path, category: "support" })),
  ];
  const plan = {
    stageId,
    background: frozenEntry({ path: stageVisualFor(stageId), category: "background" }),
    enemyBase: frozenEntry({ path: V075_VISUAL_PROFILES.enemyBase.intact.path, category: "base" }),
    sprites: requiredKinds.map((kind) => frozenEntry({
      kind,
      path: spriteSheetPath(kind),
      category: formationKinds.includes(kind) ? "unit" : "enemy",
    })),
    stageObjects: Object.freeze(stageObjects),
    persistent: Object.freeze(persistent),
  };
  return Object.freeze({
    ...plan,
    paths: Object.freeze(unique([
      plan.background.path,
      plan.enemyBase.path,
      ...plan.sprites.map(({ path }) => path),
      ...plan.stageObjects.map(({ path }) => path),
      ...plan.persistent.map(({ path }) => path),
    ])),
  });
}
