import { BOSS_DEFINITIONS } from "./bossFoundation.js";
import { CAMPAIGN_STAGES } from "./campaign.js";
import { requiredBattleAssetPlan } from "./battleAssetPlan.js";
import { ENEMY_CONTENT } from "./content/enemyCatalog.js";
import { V100_STAGES } from "./v100Registry.js";
import { v100BattleDefinitionFor } from "./v100BattleAdapter.js";
import { SPRITE_STATES, spriteFrameFor, spriteSheetPath } from "./spriteManifest.js";
import { deepFreeze } from "./content/freeze.js";

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
}

function legacyStageEnemyKinds(stage) {
  return uniqueStrings([
    ...(stage.enemyKinds ?? []),
    ...(stage.waves ?? []).flatMap((wave) => [
      ...(wave.groups ?? []).map((group) => group.kind),
      ...(wave.units ?? []),
    ]),
    stage.boss?.enemyKind,
  ]);
}

function v100StageEnemyKinds(stageId) {
  const definition = v100BattleDefinitionFor(stageId);
  return uniqueStrings([
    ...(definition?.timeline ?? []).flatMap((event) => event.units ?? []),
    definition?.bossEnemyKind,
  ]);
}

function spriteRequirementFor(kind) {
  try {
    return {
      kind,
      sheet: spriteSheetPath(kind),
      states: SPRITE_STATES.map((state) => ({
        state,
        left: spriteFrameFor(kind, state, "left"),
        right: spriteFrameFor(kind, state, "right"),
      })),
      error: null,
    };
  } catch (error) {
    return { kind, sheet: null, states: [], error: String(error?.message ?? error) };
  }
}

/**
 * Derives the production enemy/boss QA universe from the same runtime sources
 * that mount a battle. The asset plan intentionally adds `turned`, because it
 * is a runtime-generated enemy even though it is not authored in every stage.
 */
export function productionEnemyRuntimeContract() {
  const stageSources = [
    ...CAMPAIGN_STAGES.map((stage) => ({
      source: "legacy-campaign",
      stageId: stage.id,
      enemyKinds: legacyStageEnemyKinds(stage),
    })),
    ...V100_STAGES.map((stage) => ({
      source: "v100-battle-adapter",
      stageId: stage.id,
      enemyKinds: v100StageEnemyKinds(stage.id),
    })),
  ];

  const plannedKinds = [];
  const stagePlans = stageSources.map((source) => {
    const plan = requiredBattleAssetPlan({
      stageId: source.stageId,
      enemyKinds: source.enemyKinds,
    });
    const planKinds = plan.sprites.map(({ kind }) => kind);
    plannedKinds.push(...planKinds);
    return {
      ...source,
      plannedEnemyKinds: planKinds,
      spritePaths: plan.sprites.map(({ kind, path }) => ({ kind, path })),
    };
  });

  const registryKinds = ENEMY_CONTENT.map(({ id }) => id);
  const registrySet = new Set(registryKinds);
  const plannedUniqueKinds = uniqueStrings(plannedKinds);
  const plannedSet = new Set(plannedUniqueKinds);
  const requiredEnemyKinds = ENEMY_CONTENT
    .map(({ id }) => id)
    .filter((kind) => plannedSet.has(kind));
  const unknownReachableKinds = plannedUniqueKinds.filter((kind) => !registrySet.has(kind));
  const unreachableRegisteredKinds = registryKinds.filter((kind) => !plannedSet.has(kind));
  const bossKinds = uniqueStrings(BOSS_DEFINITIONS.map(({ enemyKind }) => enemyKind));
  const missingBossKinds = bossKinds.filter((kind) => !plannedSet.has(kind));
  const spriteRequirements = requiredEnemyKinds.map(spriteRequirementFor);

  return deepFreeze({
    stageSources: stagePlans,
    registryKinds,
    bossKinds,
    requiredEnemyKinds,
    unknownReachableKinds,
    unreachableRegisteredKinds,
    missingBossKinds,
    spriteRequirements,
  });
}
