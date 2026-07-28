"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  RANDOM_BATTLE_BARK_TRIGGER_IDS,
  advanceBattleBarkRuntime,
  clearNonScriptedBattleBarks,
  createBattleBarkRuntime,
  queueBattleBark,
  queueScriptedBattleBarkCue,
} from "./battleBarks.js";
import { decideAllyIntent } from "./allyAi.js";
import {
  advanceNavigationRecovery,
  allyAiProfileFor,
  chooseEnemyTargetForProfile,
  createNavigationRecoveryState,
  enemyAiProfileFor,
  retainedTargetDuringRetarget,
  shouldPrioritizeSupportObject,
} from "./combatAiProfiles.js";
import {
  advanceTowardLane,
  chooseCommittedEnemyLane,
  chooseHumanDeploymentLane,
  humanLaneTransitioning,
  planHumanLaneAssignments,
} from "./lanePlanner.js";
import { createAudioMixer, createAudioRequestGate, runGuardedAudioRequest } from "./audioMixer.js";
import {
  CRAWLER_DOOR_PHASES,
  advanceCrawlerDoorRuntime,
  createCrawlerDoorRuntime,
} from "./crawlerDeployment.js";
import {
  crawlerDefenseResponderCapacity,
  isEffectiveCrawlerDefenseClaim,
  isCrawlerAttackThreat,
  shouldReleaseCrawlerDefenseTarget,
} from "./crawlerDefense.js";
import { sameSideSeparationStep } from "./fighterSeparation.js";
import { BattleBarkAuditScreen } from "./BattleBarkAuditScreen";
import {
  battleSpaceFor,
  battleSpaceLineOfSight,
  enemySpawnPortalPoint,
  friendlyDeploymentPoint,
  nearestValidBattlefieldPlacement,
} from "./battleSpace.js";
import { SpriteAuditScreen } from "./SpriteAuditScreen";
import { createBattleResultId, createBattleSessionTransition, resolvePauseAction } from "./battleSession.js";
import {
  CAMPAIGN_SNAPSHOT_KINDS,
  campaignStorageFor,
  clearCampaignSaveEverywhere,
  createCampaignManualExport,
  createCorruptCampaignRawExport,
  indexedDbFor,
  parseCampaignManualImport,
  preflightUnreadableCampaignRecovery,
  reconcileCampaignStorage,
  writeCampaignBackup,
  writeCampaignRecoverySnapshot,
  writeCampaignSave,
  writeCampaignSaveReplicas,
} from "./campaignStorage.js";
import { claimDefeatResolution } from "./defeatLedger.js";
import {
  CampaignScreens,
  type CampaignResultView,
  type CampaignScreen,
  type BossCompendiumView,
  type EnemyCompendiumView,
  type OutbreakMissionScreenView,
  type OutbreakResultView,
  type RecordsSummaryView,
  type StageScreenView,
  type SupplyScreenView,
  type UnitScreenView,
  type UpgradeFeedbackView,
} from "./CampaignScreens";
import {
  CAMPAIGN_SAVE_SCHEMA_VERSION,
  CAMPAIGN_REGIONS,
  CAMPAIGN_STAGE_BY_ID,
  CAMPAIGN_STAGE_IDS,
  CAMPAIGN_STAGES,
  CAMPAIGN_RECRUITMENT_COSTS,
  CAMPAIGN_UNITS,
  INITIAL_STAGE_ID,
  acknowledgeCampaignMigrationNotice,
  campaignUnitIdToCombatKind,
  campaignUnitLevelUpgradeQuote,
  checkpointSurvivalCampaignSave,
  createDefaultCampaignSave,
  getCampaignLevelCap,
  getCampaignUnitLevel,
  getFormationPresetEquipmentSnapshot,
  getSelectedFormationCombatKinds,
  getSelectedFormationUnitIds,
  inspectCampaignSaveCandidate,
  isUnitDiscovered,
  isUnitOwned,
  isUnitRecruitable,
  isStageUnlocked,
  markCampaignStarted,
  markStoryEventRead,
  persistOutbreakCampaignSettlement,
  persistSurvivalCampaignSettlement,
  recruitCampaignUnit,
  reviseCampaignSave,
  resolveStageResult,
  selectFormationPreset,
  selectCampaignStage,
  setFormationPresetUnits,
  serializeCampaignSave,
  updateCampaignSettings,
  updateStoryPlaybackSettings,
  upgradeCampaignUnit,
} from "./campaign.js";
import { EQUIPMENT_BY_ID, aggregateEquipmentEffects } from "./equipment.js";
import {
  OUTBREAK_MISSIONS,
  OUTBREAK_MISSION_BY_ID,
  isOutbreakMissionUnlocked,
} from "./outbreakMissions.js";
import {
  SURVIVAL_END_REASONS,
  SURVIVAL_RUN_PHASES,
  SURVIVAL_UPGRADE_BY_ID,
  beginSurvivalWave,
  completeSurvivalWave,
  createDefaultSurvivalProgress,
  createSurvivalRun,
  endSurvivalRun,
  resumeSurvivalCheckpoint,
  saveSurvivalCheckpoint,
  setSurvivalRunSpeed,
} from "./survival.js";
import {
  advanceSurvivalCombat,
  captureUnfinishedSurvivalCombatStats,
  chooseSurvivalCombatUpgrade,
  createSurvivalCombatRuntime,
  survivalCombatEndReason,
  survivalDefenseDestination,
  survivalHudSnapshot,
  survivalUpgradeEffects,
  survivalWaveReward,
} from "./survivalBattleRuntime.js";
import {
  ENEMY_CONTENT,
  enemyBodyRadiusFor,
  enemyContentFor,
  enemyInitialAbilityCooldownFor,
  enemyLaneSpeedFor,
  enemyStatsForWave,
} from "./content/enemyCatalog.js";
import {
  BOSS_DEFINITIONS,
  bossDefinitionForEnemyKind,
  bossHudSnapshot,
  bossPhaseForHp,
  bossTelegraphSnapshot,
  enforceBossBodyBarrier,
  isBossEnemyKind,
} from "./bossFoundation.js";
import {
  BOSS_ANOMALY_TUNING,
  advanceBossAnomalyAbility,
  beginBossAnomalyAbility,
  bossAnomalyAreaTargetIds,
  createBossAnomalyRuntime,
  gairenIncomingDamageMultiplier,
  isBossAnomalyKind,
  motherBroodSummonPlan,
  ooguchiChargeStep,
} from "./bossAnomalies.js";
import {
  KUROME_PROTOTYPE_TUNING,
  advanceKuromeTracking,
  beginKuromeTracking,
  createKuromeTrackingRuntime,
  kuromeEmergencyEvadePlan,
  resolveKuromeBeam,
} from "./kuromeBoss.js";
import {
  advanceV090InfectedAbility,
  anchorBloomReinforcement,
  beginV090InfectedAbility,
  cagewalkerFrontDamageMultiplier,
  createV090InfectedRuntime,
  isV090InfectedKind,
  pallMantaProjectileMultiplier,
  resonatorHowlTargets,
  spindleLandingPoint,
  v090InfectedDefinition,
} from "./v090Infected.js";
import {
  advanceBattleStoryFlow,
  createBattleStoryFlowState,
  getPrologueOpeningEventIds,
  getPrologueReplayEventIds,
  getPrologueSkipEventIds,
  getStageEntryStoryEventIds,
  getStageNextAttemptStoryEventId,
  getStageResultStoryEventIds,
  isPrologueOpeningEventId,
  resolveStoryEventCompletion,
} from "./storyFlow.js";
import {
  STORY_BATTLE_EVENT_IDS,
  STORY_BATTLE_TRIGGER_IDS,
  createStoryBattleBarkState,
  resolveStoryBattleBarkCue,
  resolveStoryBattleBarkPresentation,
} from "./storyBattleBarks.js";
import { battleOutcomeFor, createBattleDefinition, objectiveForBattle, phaseBannerForBattle, phaseForBattle } from "./battleDefinitions.js";
import {
  COMBAT_ROLE_RULES,
  advanceAllyLifecycle,
  advanceEnemyLifecycle,
  beginAllyDeath,
  beginEnemyDeath,
  canAcquireCombatTarget,
  createAllyLifecycle,
  createAttackTransaction,
  createEnemyLifecycle,
  createGenericZombieSpawn,
  ENEMY_DEATH_CONFIG,
  enforceEnemyCorpseCaps,
  igniteAllyCorpsesInFire,
  supportCohesion,
} from "./combatLifecycle.js";
import {
  advancePendingWeaponHits,
  attackPresentationDuration,
  mrsChihaLauncherBashDuration,
  sampleAnimationClip,
  sampleAttackPresentation,
  sampleMrsChihaLauncherBash,
  weaponDamageEventsFor,
  weaponProfileForAction,
  weaponProfileForUnit,
} from "./combatPresentation.js";
import { allyCorpseVisualCue } from "./corpseVisuals.js";
import { resolveLocalQaMode, resolveLocalQaSafeArea, resolveLocalQaScenario } from "./localQa.js";
import { PRODUCTION_VISUALS, stageVisualFor } from "./productionVisuals.js";
import {
  COMPACT_BATTLE_SPRITE_SCALE,
  FORMATION_CARD_ART,
  PORTRAIT_ART,
  fitSpriteBattleDisplaySize,
  spriteBattleDisplaySizeFor,
  spriteFrameFor,
  spriteKinds,
  spriteSheetPath,
} from "./spriteManifest.js";
import { STAGE_OBJECT_MANIFEST, stageObjectsFor } from "./stageObjectManifest.js";
import {
  STAGE_VIEWPORT_IDS,
  battlefieldDepthScale,
  clampToWalkable,
  combatReadyGroundingAudit,
  resolveStageViewportProfile,
  stageDebugPrimitives,
  stageGeometryFor,
} from "./stageGeometry.js";
import { stageResultFacts } from "./stageResultFacts.js";
import { V075_VISUAL_PROFILES } from "./visualProfiles.js";
import {
  BATTLE_AUDIO_LOOP_CONTRACTS,
  LEGACY_SFX_CUE_MAP,
  PRODUCTION_AUDIO_MANIFEST,
  STATION_AUDIO_CUE_IDS,
  STORY_AUDIO_MIX,
  TAKUYA_ENTRANCE_AUDIO,
  UPGRADE_AUDIO_CUE_IDS,
  enemyVoiceCue,
  humanVoiceCueForUnit,
  sceneIdForScreen,
  sceneIdForStoryEvent,
  stopBattleAudioLoops,
  storyWarningCueForEvent,
  unitAudioCueFor,
  weaponCueForUnit,
} from "./productionAudio.js";
import { RELEASE_LABEL, RELEASE_VERSION } from "./releaseIdentity.js";
import {
  AIRSTRIKE_DEF,
  BARRICADE_MAX_HP,
  BATTLEFIELD_SUPPLY_DEFS,
  CAMERA_SHAKE_EVENTS,
  COMMAND_INITIAL,
  COMMAND_MAX,
  ENEMY_GATE_SPAWN,
  ENEMY_BASE_COLLAPSE_SECONDS,
  LANE_Y,
  MISSION_EVENTS,
  PREP_SECONDS,
  RENDER_ARRAY_LIMITS,
  SUPPORT_GAUGE_MAX,
  UNIT_CARDS,
  WORLD_GEOMETRY,
  advanceAttackCooldown,
  advanceAreaEffects,
  advanceBleedDamage,
  advanceConvoyEvacuation,
  advanceBattlefieldSupply,
  advanceCameraShakeRuntime,
  advanceCrawlerAbilityRuntime,
  advanceEmergencySupportRuntime,
  advanceEnemyBaseCollapse,
  advanceEnemySpawnRuntime,
  advanceZombieX,
  advanceLimitFor,
  advanceCommand,
  airstrikePlacementCheck,
  applyBattlefieldSupplyDamage,
  airstrikeObserverPose,
  barricadeState,
  battlefieldPlacementForbiddenZones,
  battlefieldSupplyPlacementCheck,
  cameraShakeAmplitude,
  canvasPointerToWorld,
  canDeploy,
  capRenderArray,
  createCameraShakeRuntime,
  createCrawlerAbilityRuntime,
  createEmergencySupportRuntime,
  createEnemySpawnRuntime,
  crawlerSiegeDamage,
  crawlerThreatLevel,
  enemyCanTargetBattlefieldSupply,
  enemyBaseTargetPoint,
  enemyBaseVisualState,
  enqueueEnemyWave,
  humanAttackMultiplier,
  humanCombatMinX,
  interceptorTargetScore,
  isBabayagaPriorityTarget,
  isCrawlerRouteBlocker,
  keyboardInputGate,
  newcomerAttackPayload,
  objectiveFor,
  requestAirstrike,
  requestCrawlerBarrage,
  requestDrumDetonation,
  retainActiveAreaEffects,
  resolveAirstrikeImpact,
  resolveBattlefieldSupplyLanding,
  resolveBattlefieldSupplyPlacement,
  resolveCrawlerBarrage,
  resolveDrumDetonation,
  resolveNewcomerAttackEffects,
  roleEffectForAction,
  roleTargetBias,
  scrapReward,
  selectBlockingContainer,
  selectAreaEffectsForRender,
  structureDamageMultiplier,
  supportGaugeReward,
  triggerCameraShake,
} from "./gameRules.js";
import {
  UNIT_ROLE_TUNING,
  advanceCrazyKingMomentum,
  advanceNaoProtection,
  advanceRaiderSuppression,
  applyRaiderShots,
  applyRaiderSuppression,
  coolRaiderHeat,
  crazyKingAttackInterval,
  createMonkeyTrap,
  raiderCanFire,
  resolveGantetsuInterception,
  resolveGantetsuSteadfastDamage,
  resolveNaoHealing,
  resolveTataraStrikeDamage,
  selectNaoHealTarget,
  selectRaiderLineTargets,
  tataraTargetSpecialty,
  triggerMonkeyTrap,
} from "./unitRoleMechanics.js";
import {
  STATION_ENEMY_TUNING,
  advanceKaramitePull,
  advanceKaramiteWindup,
  advanceLeakMudHazards,
  advanceLeakMudWindup,
  advanceSoukiBurst,
  advanceTicketGateEaterCharge,
  beginKaramiteWindup,
  beginLeakMudWindup,
  beginSoukiBurst,
  beginTicketGateEaterCharge,
  createKaramiteRuntime,
  createLeakMudRuntime,
  createSoukiRuntime,
  createTicketGateEaterRuntime,
  resolveKaramiteBind,
  resolveLeakMudZone,
  selectKaramiteTarget,
  ticketGateEaterDamageProfile,
} from "./stationEnemyMechanics.js";
import {
  STATION_MISSION_TYPES,
  advanceStationMissionRuntime,
  createStationMissionRuntime,
  currentPowerNode,
  escortCartX,
  stationHumanMoveSpeed,
} from "./stationStageMechanics.js";
import {
  createResearchContainerRuntime,
  enforceGateEaterContainmentInvariant,
  relocateStationHazards,
  resolveContainmentStrike,
  stationSpatialSnapshot,
} from "./stationSpatialMechanics.js";
import {
  UNIT_LEVEL_MAX,
  applyUnitLevelProgression,
  damageAfterUnitDefense,
  unitLevelMilestones,
} from "./unitProgression.js";
import {
  MANUAL_ABILITY_REGISTRY,
  advanceManualAbility,
  beginManualAbility,
  canActivateManualAbility,
  createManualAbilityRuntime,
  layoutManualAbilityIcons,
  manualAbilityCheckpointCooldown,
  manualAbilityLocksNormalAction,
  mayoAbilityHpStep,
  restoreManualAbilityCooldown,
  selectManualAbilityTarget,
  triggerMusashiCounter,
} from "./manualAbilities.js";
import {
  advanceMayoRetreat,
  createMayoRetreatRuntime,
  mayoRetreatBlocksDamage,
  mayoRetreatSpriteState,
} from "./mayoLifecycle.js";

const W = 960;
const H = 540;

type Lane = 0 | 1 | 2;
type UnitKind = "scout" | "ranger" | "brute" | "brawler" | "gunner" | "medic" | "crazy-king" | "kumaverson" | "babayaga" | "guardian" | "engineer" | "zakimiya" | "tky" | "mrs-chiha" | "miyamoto-musashi" | "mayo-chan";
type EnemyKind = "walker" | "runner" | "spitter" | "crusher" | "shade" | "abomination" | "takuya" | "turned" | "grappler" | "ooze" | "sprinter" | "gate-eater" | "kurome" | "resonator" | "cagewalker" | "spindle" | "choir-knot" | "pall-manta" | "anchor-bloom";
type SupplyKind = "pod" | "drum" | "medical";
type MusicMode = "normal" | "danger" | "boss";
type QaMode = "endgame" | "takuya-entrance" | "ai-reacquire" | "roles" | "zakimiya" | "new-playables" | "mayo" | "supplies" | "airstrike" | "crawler" | "loadout" | "dialogue" | "stress" | "lifecycle" | "barks" | "sprites";
type SelectedAction = `supply:${SupplyKind}` | "airstrike" | null;
type EventDestination = "map" | "battle" | "battle-resume" | "result";
type PauseAction = "restart" | "loadout" | "withdraw";

const BASE_X = WORLD_GEOMETRY.baseX;
const BARRICADE_X = WORLD_GEOMETRY.barricade.attackX;
const MUSTER_X = WORLD_GEOMETRY.musterX;
const MUSTER_LANE = 2 as Lane;
type LaneCenters = readonly [number, number, number];
let activeLaneCenters = LANE_Y as unknown as LaneCenters;
let activeStageViewportId = STAGE_VIEWPORT_IDS.STANDARD;
let activeStageGeometry = stageGeometryFor(INITIAL_STAGE_ID, STAGE_VIEWPORT_IDS.STANDARD);

function compactBattleViewport() {
  return activeStageViewportId !== STAGE_VIEWPORT_IDS.STANDARD;
}

function activeBattlefieldDepthScale(y: number) {
  return battlefieldDepthScale(activeStageGeometry, y);
}

function activeLaneForY(y: number, fallback: Lane = 1) {
  let closest = fallback;
  for (const lane of [0, 1, 2] as Lane[]) {
    if (Math.abs(y - activeLaneCenters[lane]) < Math.abs(y - activeLaneCenters[closest])) closest = lane;
  }
  return closest;
}

function activeMusterY() {
  return activeLaneCenters[MUSTER_LANE];
}

function activeYForContentY(y: number) {
  const contentY = Number.isFinite(y) ? y : LANE_Y[1];
  const route = LANE_Y.reduce((nearest, routeY, index) => (
    Math.abs(contentY - routeY) < Math.abs(contentY - LANE_Y[nearest]) ? index : nearest
  ), 1);
  return activeLaneCenters[route] + contentY - LANE_Y[route];
}

function stationObjectiveDestination(g: Game, fighter: Fighter) {
  if (g.definition.missionType === STATION_MISSION_TYPES.ESCORT) {
    const lane = ([0, 1, 2].includes(Number(g.definition.missionConfig.cartLane))
      ? Number(g.definition.missionConfig.cartLane)
      : 1) as Lane;
    return {
      x: escortCartX(g.stageMission, g.definition.missionConfig) - 18 - (fighter.id % 3) * 18,
      lane,
    };
  }
  if (g.definition.missionType !== STATION_MISSION_TYPES.SEQUENTIAL_SEAL) return null;
  if (g.stageMission.sealed) {
    return {
      x: Number(g.definition.missionConfig.returnX ?? MUSTER_X),
      lane: fighter.anchorLane ?? fighter.lane,
    };
  }
  if (g.stageMission.gateEaterDefeated && g.stageMission.researchContainerContained) return null;
  const powerNode = currentPowerNode(g.stageMission, g.definition.missionConfig);
  if (powerNode) {
    return {
      x: powerNode.x - 12 - (fighter.id % 3) * 15,
      lane: powerNode.lane as Lane,
    };
  }
  const gateEater = g.fighters.find((candidate) => candidate.kind === "gate-eater"
    && candidate.hp > 0
    && candidate.contained !== true);
  const containmentX = gateEater?.x
    ?? g.researchContainer?.x
    ?? Number(g.definition.missionConfig.sealDoorX ?? 867) - 90;
  return {
    x: Math.max(MUSTER_X, containmentX - Math.max(28, fighter.range * .72)),
    lane: (gateEater?.lane ?? g.researchContainer?.lane ?? 1) as Lane,
  };
}

type UnitCard = {
  kind: UnitKind;
  aiProfile: string;
  name: string;
  cost: number;
  key: string;
  desc: string;
  deployCooldown: number;
  hp: number;
  speed: number;
  laneSpeed: number;
  bodyRadius: number;
  damage: number;
  range: number;
  attackEvery: number;
  progressionLevel?: number;
  progressionRank?: number;
  defense?: number;
  healingMultiplier?: number;
  trapDurationMultiplier?: number;
};

type MissionEvent = { at: number; wave: number; label: string; bossOnly?: boolean; units: string[] };
type BattleDefinition = {
  stageId: string;
  operationId: string;
  operationCategory: "campaign" | "outbreak";
  displayName: string;
  missionType: "assault" | "timed-defense" | "boss-assault" | "escort" | "sequential-seal" | "survival";
  prepSeconds: number;
  baseMaxHp: number;
  enemyBaseMaxHp: number;
  enemyBaseMode: "target" | "scenery";
  startsEnemyBaseVulnerable: boolean;
  bossUnlocksEnemyBase: boolean;
  bossEnemyKind: string | null;
  timeline: MissionEvent[];
  defenseEndAt: number | null;
  phaseSchedule: { at: number; phase: 1 | 2 | 3; label: string; objective: string }[] | null;
  objective: string;
  missionConfig: Record<string, unknown>;
  rescueCount: number;
};
type CampaignSave = ReturnType<typeof createDefaultCampaignSave>;
type CampaignStageData = {
  id: string; stageNumber: number; regionId: string; displayName: string; objective: string; missionType: BattleDefinition["missionType"];
  objectivePattern?: string;
  baseReward: number; firstTimeStarRewards: Record<number, number>; mapPosition: { x: number; y: number };
};
type CampaignUnitData = {
  id: string; combatKind: UnitKind; displayName: string; roleName: string; description: string;
  roleIcon: string; weaponName: string; attackMode: string; rangeBand: string; primaryTarget: string; deploymentHint: string;
  recruitmentCostCaps?: number;
  unlock: { type: string; stageId?: string; stageNumber?: number; costCaps?: number };
};
type EnemyEntryMode = "base-interior" | "right-edge" | "right-edge-outside";
type EnemySpawnEntry = {
  entryId: number; kind: string; lane: Lane; wave: number; order: number; delay: number;
  x: number; y: number; combatReadyX: number; combatReadyY?: number; entrySpeed: number; slot: number;
  portalId?: string; routeId?: string; entryMode?: EnemyEntryMode;
};
type EnemySpawnRuntime = { pending: EnemySpawnEntry[]; cooldown: number; nextEntryId: number };

const cards = UNIT_CARDS as UnitCard[];
const missionEvents = MISSION_EVENTS as MissionEvent[];
const supplyDefs = BATTLEFIELD_SUPPLY_DEFS as Record<SupplyKind, {
  kind: SupplyKind; name: string; key: string; cost: number; maxHp: number; minX: number; maxX: number;
  placementClearance: number; blocksEnemies: boolean; landingRadius?: number; blastRadius?: number; burnRadius?: number; healRadius?: number;
}>;

const SUPPORT_DISPLAY_NAMES: Record<SupplyKind, string> = {
  pod: "投下ポッド",
  drum: "爆薬ドラム",
  medical: "救護所",
};

function placementReasonLabel(reason: string) {
  const shortReasons: Record<string, string> = {
    "配置できます": "配置可",
    "配置可能範囲外です": "配置範囲外",
    "進行上の禁止領域です": "禁止領域",
    "既存物資に近すぎます": "物資に近すぎます",
    "スクラップが不足しています": "スクラップ不足",
    "支援ゲージが不足しています": "支援ゲージ不足",
    "航空支援の有効範囲外です": "航空支援範囲外",
  };
  return shortReasons[reason] ?? reason.replace(/です$/, "");
}

function placementIndicatorFor(action: SelectedAction, lane: Lane, x: number, y: number, valid: boolean, reason: string): PlacementIndicator {
  const kind = action?.startsWith("supply:") ? action.slice("supply:".length) as SupplyKind : null;
  const radius = kind === "pod" ? supplyDefs.pod.landingRadius ?? 92
    : kind === "drum" ? supplyDefs.drum.blastRadius ?? 112
      : kind === "medical" ? supplyDefs.medical.healRadius ?? 104
        : AIRSTRIKE_DEF.radius;
  return {
    lane,
    x,
    y,
    valid,
    reason,
    radius,
    ...(kind === "drum" ? { innerRadius: supplyDefs.drum.burnRadius ?? 88 } : {}),
    action,
  };
}

type Fighter = {
  id: number;
  side: "human" | "zombie";
  kind: string;
  aiProfile: string;
  lane: Lane;
  anchorLane: Lane | null;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  range: number;
  cooldown: number;
  supportCooldown: number;
  attackEvery: number;
  flash: number;
  step: number;
  attack: number;
  attackVariant?: "launcher-bash" | null;
  knock: number;
  variant: number;
  targetId: number | null;
  targetObjectId: number | null;
  crawlerDefenseTargetId?: number | null;
  retargetIn: number;
  nextLaneDecisionAt: number;
  bodyRadius: number;
  laneSpeed: number;
  spawnGrace: number;
  targetable?: boolean;
  combatReady: boolean;
  contained: boolean;
  gateEntering: boolean;
  entryDirection?: -1 | 1;
  spawnPortalId?: string | null;
  spawnEntryMode?: EnemyEntryMode;
  entryStepDistance?: number;
  gateEntrySpeed: number;
  combatReadyX: number;
  combatReadyY?: number;
  entryRampX?: number;
  entryRampY?: number;
  entryRampCleared?: boolean;
  marked: number;
  stunned: number;
  bleedRemaining: number;
  bleedDamagePerSecond: number;
  aiDestinationX: number;
  aiMoveDirection: number;
  navigationRecovery: {
    lastX: number;
    lastY: number;
    stuckSeconds: number;
    recoverySeconds: number;
    recoveryLane: number | null;
    originalLane: number;
    recoveryCount: number;
  };
  abilityCooldown: number;
  abilityWindup: number;
  attackSequence: number;
  damageReductionRemaining: number;
  damageReductionMultiplier: number;
  defense: number;
  healingMultiplier: number;
  trapDurationMultiplier: number;
  healFocusTargetId: number | null;
  healFocusRemaining: number;
  comboHits: number;
  comboWindow: number;
  weaponHeat: number;
  overheated: boolean;
  suppressionStacks: number;
  suppressedRemaining: number;
  suppressionMultiplier: number;
  guardStandRemaining: number;
  guardStandAvailable: boolean;
  engineerTrapReady: boolean;
  engineerTrapX: number;
  engineerTrapLane: Lane | null;
  engineerTrapCooldown: number;
  engineerTrapManual: boolean;
  armorBreakStacks: number;
  armorBrokenRemaining: number;
  burning?: boolean;
  slowMultiplier?: number;
  stationAbility: StationAbilityRuntime;
  progressionLevel?: number;
  progressionRank?: number;
  manualAbility?: ManualAbilityRuntime | null;
  mayoBiteSlowRemaining?: number;
  mayoRetreat?: ReturnType<typeof createMayoRetreatRuntime> | null;
  visionDisruptedRemaining?: number;
  summonOwnerId?: number | null;
  summonSource?: string | null;
};
type StationAbilityRuntime = {
  kind?: string | null;
  phase: string;
  remainingSeconds: number;
  targetId?: string | null;
  targetIds?: readonly string[];
  lane?: Lane | null;
  lockedLane?: Lane | null;
  zoneId?: string | number | null;
  ownerId?: string | number | null;
  ownerSide?: "human" | "zombie" | null;
  centerX?: number | null;
  centerY?: number | null;
  targetX?: number | null;
  targetY?: number | null;
  direction?: number;
  originX?: number | null;
  originY?: number | null;
  resolved?: boolean;
  guarded?: boolean;
  split?: boolean;
};
type StationHazard = {
  id: string | number | null;
  ownerId: string | number | null;
  ownerSide: "human" | "zombie" | null;
  lane: Lane;
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  remainingSeconds: number;
  tickAccumulator: number;
  active: boolean;
};
type ResearchContainerRuntime = {
  x: number;
  lane: Lane;
  exposed: boolean;
  contained: boolean;
};
type StageMissionRuntime = {
  missionType: string;
  completed: boolean;
  failed: boolean;
  transitions: readonly string[];
  progress?: number;
  integrity?: number;
  maxIntegrity?: number;
  repairRemaining?: number;
  contaminated?: boolean;
  stalled?: boolean;
  powerActivated?: number;
  powerHold?: number;
  gateEaterSeen?: boolean;
  gateEaterDefeated?: boolean;
  gateEaterContained?: boolean;
  researchContainerExposed?: boolean;
  researchContainerContained?: boolean;
  sealed?: boolean;
  escapeRemaining?: number | null;
  returnTargetCount?: number | null;
  returnTargetIds?: readonly string[] | null;
  returnedUnitIds?: readonly string[];
  returnedCount?: number;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
type RoleEffect = "scout" | "ranger" | "brute" | "brawler" | "gunner" | "medic" | "crazy-king" | "kumaverson" | "babayaga";
type Shot = {
  x: number;
  y: number;
  tx: number;
  ty: number;
  life: number;
  side: "human" | "zombie";
  sourceId?: number;
  targetId?: number;
  damageTargetId?: number;
  effect?: RoleEffect;
  emphasized?: boolean;
  duration?: number;
  style?: "projectile" | "melee" | "crawler";
  weapon?: string;
  shotIndex?: number;
  recoil?: number;
  casing?: boolean;
  hitStopSeconds?: number;
  impactDelaySeconds?: number;
};
type PendingWeaponHit = {
  eventKind: "muzzle" | "impact";
  targetKind: "fighter" | "enemy-base";
  damageMode?: "direct" | "containment" | "grenade";
  raiderLineHit?: boolean;
  raiderSecondary?: boolean;
  sourceId: number;
  targetId: number | null;
  targetX: number;
  targetY: number;
  originX: number;
  originY: number;
  remainingSeconds: number;
  damage: number;
  weapon: UnitKind;
  shotIndex: number;
  recoil: number;
  casing: boolean;
  hitStopSeconds: number;
  impactDelaySeconds: number;
  applyDamage: boolean;
};
type DamageText = { x: number; y: number; value: string; life: number; color: string };
type ManualAbilityRuntime = NonNullable<ReturnType<typeof createManualAbilityRuntime>>;
type ManualAbilityVfx = {
  ownerId: number;
  activationId: number;
  kind: string;
  originX: number;
  originY: number;
  targetX: number;
  targetY: number;
  elapsed: number;
  duration: number;
  points?: readonly { x: number; y: number }[];
  windupSeconds?: number;
  salvoIntervalSeconds?: number;
  projectileTravelSeconds?: number;
};
type ManualAbilityReceipt = {
  ownerId: number;
  activationId: number;
  kind: string;
  eventType: string;
  at: number;
  salvoIndex?: number;
  mode?: string;
  attackSequence?: number;
};
type PendingAbilityAudioCue = {
  cueId: string;
  x: number;
  dedupeKey: string;
};
type ManualAbilityIconView = {
  fighterId: number;
  kind: UnitKind;
  x: number;
  y: number;
  hitSize: number;
  anchorX: number;
  anchorY: number;
  pointerLength: number;
  pointerAngle: number;
};
type Corpse = {
  id: number;
  x: number;
  y: number;
  lane: Lane;
  side: "human" | "zombie";
  kind: string;
  life: number;
  variant: number;
  prevented: boolean;
  state: "dying" | "corpse" | "ashing" | "removed" | "ally-corpse" | "infection-warning" | "burning" | "ash" | "generic-zombie";
  phaseElapsed: number;
  deathAge: number;
  deathClass?: "normal" | "heavy" | "boss";
  warningLevel?: "none" | "light" | "strong";
  infectionRemaining?: number | null;
  infectionPrevented?: boolean;
  riseLockRemaining?: number;
  targetable?: boolean;
  blocking?: boolean;
  canAct?: boolean;
  removalReason?: string | null;
};
type BattlefieldObjectPhase = "dropping" | "impact" | "active" | "detonating" | "destroying" | "expired";
type BattlefieldObject = {
  id: number;
  kind: SupplyKind;
  lane: Lane;
  x: number;
  y: number;
  phase: BattlefieldObjectPhase;
  phaseTime: number;
  hp: number;
  maxHp: number;
  blocksEnemies: boolean;
  targetable: boolean;
  hitFlash: number;
  landingTriggered: boolean;
  detonationTriggered: boolean;
  detonationReason?: string;
  remaining: number | null;
  readyToLand?: boolean;
};
type AreaEffect = {
  id: number;
  kind: "burn" | "healing";
  sourceSupplyId: number;
  lane: Lane;
  x: number;
  y: number;
  radius: number;
  amountPerSecond: number;
  remaining: number;
  phase: "active" | "expired";
  slowMultiplier?: number;
};
type AirstrikeRuntime = ReturnType<typeof createEmergencySupportRuntime> & { targetLane: Lane | null; targetY?: number | null };
type CrawlerRuntime = ReturnType<typeof createCrawlerAbilityRuntime>;
type BattleBarkRuntime = ReturnType<typeof createBattleBarkRuntime>;
type BattleBark = BattleBarkRuntime["active"][number];
type PlacementIndicator = { lane: Lane; x: number; y: number; valid: boolean; reason: string; radius: number; innerRadius?: number; action: SelectedAction };

type RoleMetrics = {
  naoHealing: number;
  naoPreventedDamage: number;
  crazyKingSecondaryHits: number;
  crazyKingMaxTier: number;
  raiderPierceHits: number;
  raiderSuppressionApplications: number;
  raiderOverheats: number;
  tataraHeavyDamage: number;
  tataraStructureDamage: number;
  gantetsuRedirectedDamage: number;
  monkeyTrapTriggers: number;
};

type CombatMetrics = {
  damageByUnit: Record<string, number>;
  damageTakenByUnit: Record<string, number>;
  healingByUnit: Record<string, number>;
  enemyDefeatsByKind: Record<string, number>;
};

type StationMetrics = {
  aiRecoveries: number;
  karamiteBinds: number;
  leakMudZones: number;
  soukiBursts: number;
  gateEaterCharges: number;
  powerActivations: number;
  escortCompletions: number;
  sealCompletions: number;
  offFloorSteps: number;
  maxLaneAnchorError: number;
};

type Game = {
  definition: BattleDefinition;
  resultId: string;
  formationKinds: UnitKind[];
  unitLevelsByKind: Record<string, number>;
  personalEquipmentByKind: Record<string, string[]>;
  tacticalEquipmentIds: string[];
  equipmentEnhancementLevels: Record<string, number>;
  running: boolean;
  paused: boolean;
  over: boolean;
  won: boolean;
  time: number;
  last: number;
  energy: number;
  supportGauge: number;
  scrap: number;
  kills: number;
  wave: number;
  phase: 1 | 2 | 3;
  eventIndex: number;
  convoyProgress: number;
  civiliansEvacuated: number;
  enemySpawn: EnemySpawnRuntime;
  baseHp: number;
  baseMaxHp: number;
  barricadeHp: number;
  barricadeMaxHp: number;
  barricadeVulnerable: boolean;
  barricadeHitFlash: number;
  barricadeHitY: number;
  barricadeBucklingAnnounced: boolean;
  barricadeCriticalAnnounced: boolean;
  fighters: Fighter[];
  particles: Particle[];
  shots: Shot[];
  pendingWeaponHits: PendingWeaponHit[];
  damageTexts: DamageText[];
  corpses: Corpse[];
  selectedSupply: SupplyKind;
  battlefieldObjects: BattlefieldObject[];
  areaEffects: AreaEffect[];
  stationHazards: StationHazard[];
  researchContainer: ResearchContainerRuntime | null;
  stageMission: StageMissionRuntime;
  nextAreaEffectId: number;
  airstrike: AirstrikeRuntime;
  crawlerAbility: CrawlerRuntime;
  placementIndicator: PlacementIndicator | null;
  deployCooldowns: Record<UnitKind, number>;
  deployQueue: UnitKind[];
  qaNextDeploymentLane?: Lane | null;
  crawlerDoor: ReturnType<typeof createCrawlerDoorRuntime>;
  nextId: number;
  nextLanePlanAt: number;
  resolvedDefeatIds: Set<number>;
  shake: ReturnType<typeof createCameraShakeRuntime>;
  enemyBaseCollapse: number;
  resultPresented: boolean;
  banner: string;
  bannerTime: number;
  flashOverlay: number;
  combo: number;
  comboTime: number;
  maxCombo: number;
  unitsLost: number;
  crawlerFootstepCount: number;
  crawlerHitFlash: number;
  crawlerHitSfxCooldown: number;
  criticalAnnounced: boolean;
  takuyaEnragedAnnounced: boolean;
  takuyaEntranceAudioRemaining: number;
  battleBarks: BattleBarkRuntime;
  barkFlags: string[];
  storyFlowState: ReturnType<typeof createBattleStoryFlowState>;
  storyBattleBarkState: ReturnType<typeof createStoryBattleBarkState>;
  storyBattleReadEventIds: string[];
  storyBattleReceiptEventIds: string[];
  enemyKindsSeen: string[];
  signalIds: string[];
  bossDefeated: boolean;
  bossDefeatPending: boolean;
  qaBarks: boolean;
  roleMetrics: RoleMetrics;
  combatMetrics: CombatMetrics;
  stationMetrics: StationMetrics;
  survivalRun: ReturnType<typeof createSurvivalRun> | null;
  survivalRuntime: ReturnType<typeof createSurvivalCombatRuntime> | null;
  survivalCheckpointReceipt: string | null;
  manualAbilityVfx: ManualAbilityVfx[];
  manualAbilityReceipts: ManualAbilityReceipt[];
  pendingAbilityAudioCues: PendingAbilityAudioCue[];
};

type Hud = {
  missionType: BattleDefinition["missionType"];
  energy: number;
  supportGauge: number;
  scrap: number;
  kills: number;
  wave: number;
  phase: 1 | 2 | 3;
  baseHp: number;
  baseMaxHp: number;
  barricadeHp: number;
  barricadeMaxHp: number;
  barricadeVulnerable: boolean;
  barricadeHitFlash: number;
  deployQueue: number;
  airstrikePhase: AirstrikeRuntime["phase"];
  crawlerPhase: CrawlerRuntime["phase"];
  crawlerCharge: number;
  combo: number;
  bossHp: number;
  bossMax: number;
  bossKind: string | null;
  bossWorldX: number | null;
  takuyaEntranceAudioActive: boolean;
  crawlerHitFlash: number;
  threat: number;
  objective: string;
  deployCooldowns: Record<UnitKind, number>;
  battleBarks: BattleBark[];
  manualAbilityIcons: ManualAbilityIconView[];
};

type BattleResult = {
  resultId: string;
  stageId: string;
  won: boolean;
  time: number;
  wave: number;
  kills: number;
  scrap: number;
  baseHp: number;
  baseMaxHp: number;
  maxCombo: number;
  unitsLost: number;
  bossDefeated: boolean;
  enemyBaseDestroyed: boolean;
  encounteredEnemyKinds: readonly string[];
  enemyDefeatsByKind: Readonly<Record<string, number>>;
  unitStats: Readonly<Pick<CombatMetrics, "damageByUnit" | "damageTakenByUnit" | "healingByUnit">>;
  missionRuntime?: StageMissionRuntime;
};

type SavePersistenceState = "checking" | "saved" | "recovered" | "unavailable";
type CampaignPersistResult = {
  durable: boolean;
  localSaved: boolean;
  backupSaved: boolean;
  skipped?: boolean;
};
type PersistedReplicaReceipt = {
  serialized: string;
  localSaved: boolean;
  backupSaved: boolean;
};
type SaveRecoveryCandidate = {
  source: string;
  raw: string;
  reason: string;
  state?: string;
  valid?: boolean;
  metadata?: { revision?: number; updatedAt?: string };
};
type SaveRecoveryState = {
  status: string;
  recoveryReason: string;
  bothCorrupt?: boolean;
  conflict?: boolean;
  candidates: readonly SaveRecoveryCandidate[];
  corruptCandidates: readonly SaveRecoveryCandidate[];
  writeBlockedSources?: readonly string[];
};
type PendingResultCommit = {
  save: CampaignSave;
  view: CampaignResultView;
  storyEventIds: readonly string[];
};
type SurvivalResultView = {
  endReason: string;
  reachedWave: number;
  kills: number;
  bossKills: number;
  earnedCaps: number;
  earnedEquipmentGrants: readonly { equipmentId: string; displayName: string; quantity: number }[];
  unitStats: readonly {
    kind: string;
    displayName: string;
    damage: number;
    damageTaken: number;
    healing: number;
  }[];
  newHighestWave: boolean;
  capsAfter: number;
};
type PendingSurvivalSettlement = {
  run: ReturnType<typeof createSurvivalRun>;
  endedAt: string;
};
type PendingSurvivalCheckpoint = {
  run: ReturnType<typeof createSurvivalRun>;
  checkpointId: string;
};
type PendingOutbreakSettlement = {
  end: BattleResult;
  completedAt: string;
};
const CAMPAIGN_SAVE_KEY = "nishijin-campaign-v1";
type AudioUnlockUiState = "idle" | "pending" | "success" | "failed";

type SpriteMap = Record<string, HTMLImageElement>;
type MusicRuntime = {
  master: GainNode;
  normalBus: GainNode;
  dangerBus: GainNode;
  bossBus: GainNode;
  timer: number;
  step: number;
  nextStepAt: number;
  mode: MusicMode;
};
type JingleRuntime = { gain: GainNode; oscillators: OscillatorNode[] };
type SfxCategory = "ui" | "combat" | "ambient" | "major";
type SfxCueDef = {
  category: SfxCategory;
  frequency: number;
  duration: number;
  type: OscillatorType;
  volume: number;
  cooldown: number;
  priority: number;
  duck?: { level: number; seconds: number };
};

const MUSIC_MASTER_GAIN = .16;
const SFX_CUES = {
  denied: { category: "ui", frequency: 105, duration: .1, type: "sawtooth", volume: .055, cooldown: .08, priority: 10 },
  queue: { category: "ui", frequency: 170, duration: .05, type: "square", volume: .055, cooldown: .04, priority: 15 },
  "ui-confirm": { category: "ui", frequency: 240, duration: .05, type: "square", volume: .045, cooldown: .06, priority: 15 },
  "ui-cancel": { category: "ui", frequency: 125, duration: .06, type: "square", volume: .04, cooldown: .08, priority: 15 },
  "supply-pod": { category: "ui", frequency: 118, duration: .11, type: "square", volume: .055, cooldown: .08, priority: 20 },
  "supply-drum": { category: "ui", frequency: 92, duration: .11, type: "square", volume: .055, cooldown: .08, priority: 20 },
  "supply-medical": { category: "ui", frequency: 210, duration: .11, type: "square", volume: .055, cooldown: .08, priority: 20 },
  "pod-descent": { category: "ambient", frequency: 86, duration: .26, type: "sawtooth", volume: .035, cooldown: .25, priority: 25 },
  "pod-hit": { category: "combat", frequency: 88, duration: .06, type: "square", volume: .03, cooldown: .08, priority: 20 },
  "pod-destroy": { category: "major", frequency: 61, duration: .22, type: "sawtooth", volume: .05, cooldown: .3, priority: 72 },
  "burn-start": { category: "ambient", frequency: 148, duration: .18, type: "sawtooth", volume: .035, cooldown: .32, priority: 28 },
  "medical-heal": { category: "ambient", frequency: 286, duration: .09, type: "sine", volume: .035, cooldown: .4, priority: 24 },
  "airstrike-request": { category: "ui", frequency: 68, duration: .24, type: "sawtooth", volume: .055, cooldown: .2, priority: 40 },
  "airstrike-targeting": { category: "ambient", frequency: 392, duration: .11, type: "square", volume: .04, cooldown: .3, priority: 45 },
  "airstrike-inbound": { category: "major", frequency: 72, duration: .3, type: "sawtooth", volume: .045, cooldown: .4, priority: 70, duck: { level: .55, seconds: .35 } },
  "airstrike-return": { category: "ui", frequency: 205, duration: .1, type: "triangle", volume: .035, cooldown: .25, priority: 30 },
  "crawler-request": { category: "ui", frequency: 82, duration: .16, type: "sawtooth", volume: .055, cooldown: .2, priority: 40 },
  "drum-request": { category: "ui", frequency: 112, duration: .08, type: "square", volume: .055, cooldown: .12, priority: 30 },
  "start-low": { category: "ui", frequency: 180, duration: .12, type: "square", volume: .055, cooldown: .2, priority: 45 },
  "start-high": { category: "ui", frequency: 260, duration: .12, type: "square", volume: .055, cooldown: .2, priority: 45 },
  "deploy-light": { category: "combat", frequency: 220, duration: .07, type: "square", volume: .055, cooldown: .04, priority: 25 },
  "deploy-heavy": { category: "combat", frequency: 110, duration: .07, type: "square", volume: .055, cooldown: .04, priority: 30 },
  "wave-contact": { category: "combat", frequency: 82, duration: .24, type: "sawtooth", volume: .055, cooldown: .18, priority: 55 },
  "boss-warning": { category: "major", frequency: 58, duration: .45, type: "sawtooth", volume: .055, cooldown: .5, priority: 90, duck: { level: .3, seconds: .55 } },
  "airstrike-impact": { category: "major", frequency: 52, duration: .42, type: "sawtooth", volume: .055, cooldown: .5, priority: 100, duck: { level: .2, seconds: .65 } },
  "crawler-barrage": { category: "major", frequency: 74, duration: .3, type: "sawtooth", volume: .055, cooldown: .45, priority: 95, duck: { level: .25, seconds: .55 } },
  "pod-impact": { category: "major", frequency: 58, duration: .22, type: "sawtooth", volume: .055, cooldown: .3, priority: 85, duck: { level: .35, seconds: .4 } },
  "drum-blast": { category: "major", frequency: 64, duration: .24, type: "sawtooth", volume: .055, cooldown: .35, priority: 90, duck: { level: .3, seconds: .5 } },
  "takuya-slam": { category: "major", frequency: 54, duration: .3, type: "sawtooth", volume: .055, cooldown: .4, priority: 95, duck: { level: .25, seconds: .55 } },
  "takuya-down": { category: "major", frequency: 49, duration: .4, type: "sawtooth", volume: .055, cooldown: .6, priority: 100, duck: { level: .22, seconds: .6 } },
  "object-destroy": { category: "combat", frequency: 72, duration: .18, type: "sawtooth", volume: .055, cooldown: .15, priority: 60 },
  "object-hit": { category: "combat", frequency: 94, duration: .045, type: "square", volume: .022, cooldown: .06, priority: 10 },
  "takuya-hit": { category: "combat", frequency: 64, duration: .16, type: "sawtooth", volume: .055, cooldown: .12, priority: 65 },
  "ranged-shot": { category: "combat", frequency: 330, duration: .035, type: "square", volume: .055, cooldown: .04, priority: 10 },
  "melee-hit": { category: "combat", frequency: 102, duration: .045, type: "square", volume: .03, cooldown: .05, priority: 12 },
  "role-scout": { category: "combat", frequency: 420, duration: .08, type: "square", volume: .04, cooldown: .45, priority: 35 },
  "role-ranger": { category: "combat", frequency: 510, duration: .09, type: "triangle", volume: .04, cooldown: .5, priority: 38 },
  "role-brute": { category: "combat", frequency: 82, duration: .12, type: "sawtooth", volume: .045, cooldown: .55, priority: 42 },
  "role-brawler": { category: "combat", frequency: 176, duration: .1, type: "square", volume: .045, cooldown: .5, priority: 40 },
  "role-gunner": { category: "combat", frequency: 128, duration: .13, type: "sawtooth", volume: .045, cooldown: .55, priority: 44 },
  "role-medic": { category: "ambient", frequency: 340, duration: .12, type: "sine", volume: .04, cooldown: .6, priority: 38 },
  "role-crazy-king": { category: "combat", frequency: 71, duration: .17, type: "sawtooth", volume: .05, cooldown: .45, priority: 46 },
  "role-kumaverson": { category: "combat", frequency: 116, duration: .13, type: "square", volume: .05, cooldown: .48, priority: 45 },
  "role-babayaga": { category: "combat", frequency: 390, duration: .055, type: "triangle", volume: .04, cooldown: .42, priority: 47 },
  "structure-heavy": { category: "combat", frequency: 78, duration: .055, type: "square", volume: .024, cooldown: .04, priority: 30 },
  "structure-light": { category: "combat", frequency: 132, duration: .055, type: "square", volume: .024, cooldown: .04, priority: 25 },
  "crawler-hit": { category: "combat", frequency: 96, duration: .06, type: "sawtooth", volume: .028, cooldown: .22, priority: 40 },
  "crawler-critical": { category: "major", frequency: 76, duration: .18, type: "sawtooth", volume: .035, cooldown: .6, priority: 100, duck: { level: .2, seconds: .7 } },
  "base-damaged": { category: "major", frequency: 112, duration: .18, type: "sawtooth", volume: .045, cooldown: .8, priority: 72 },
  "base-critical": { category: "major", frequency: 76, duration: .26, type: "sawtooth", volume: .05, cooldown: .8, priority: 88, duck: { level: .45, seconds: .4 } },
  "base-collapse": { category: "major", frequency: 46, duration: .48, type: "sawtooth", volume: .055, cooldown: 1, priority: 100, duck: { level: .2, seconds: .7 } },
  victory: { category: "major", frequency: 330, duration: .16, type: "square", volume: .04, cooldown: .8, priority: 95 },
  defeat: { category: "major", frequency: 73, duration: .22, type: "sawtooth", volume: .04, cooldown: .8, priority: 95 },
  retry: { category: "ui", frequency: 275, duration: .1, type: "triangle", volume: .04, cooldown: .35, priority: 45 },
  turned: { category: "combat", frequency: 72, duration: .22, type: "sawtooth", volume: .055, cooldown: .25, priority: 70 },
} as const satisfies Record<string, SfxCueDef>;
type SfxCueId = keyof typeof SFX_CUES;
type SfxVoice = { oscillator: OscillatorNode; gain: GainNode; cue: SfxCueId; priority: number; startedAt: number };
type SfxRuntime = {
  context: AudioContext;
  master: GainNode;
  buses: Record<SfxCategory, GainNode>;
  active: Map<OscillatorNode, SfxVoice>;
  lastPlayedAt: Map<SfxCueId, number>;
};

const emptyCooldowns = () => Object.fromEntries(cards.map((card) => [card.kind, 0])) as Record<UnitKind, number>;
const emptyRoleMetrics = (): RoleMetrics => ({
  naoHealing: 0,
  naoPreventedDamage: 0,
  crazyKingSecondaryHits: 0,
  crazyKingMaxTier: 0,
  raiderPierceHits: 0,
  raiderSuppressionApplications: 0,
  raiderOverheats: 0,
  tataraHeavyDamage: 0,
  tataraStructureDamage: 0,
  gantetsuRedirectedDamage: 0,
  monkeyTrapTriggers: 0,
});
const emptyCombatMetrics = (): CombatMetrics => ({
  damageByUnit: {},
  damageTakenByUnit: {},
  healingByUnit: {},
  enemyDefeatsByKind: {},
});
function addCombatMetric(record: Record<string, number>, key: string, amount: number) {
  const applied = Math.max(0, Number(amount) || 0);
  if (!key || applied <= 0) return;
  record[key] = Math.min(Number.MAX_SAFE_INTEGER, (record[key] ?? 0) + applied);
}
function recordUnitDamage(g: Game, unitKind: string, amount: number) {
  addCombatMetric(g.combatMetrics.damageByUnit, unitKind, amount);
}
function recordUnitDamageTaken(g: Game, unitKind: string, amount: number) {
  addCombatMetric(g.combatMetrics.damageTakenByUnit, unitKind, amount);
}
function recordUnitHealing(g: Game, unitKind: string, amount: number) {
  addCombatMetric(g.combatMetrics.healingByUnit, unitKind, amount);
}
const emptyStationMetrics = (): StationMetrics => ({
  aiRecoveries: 0,
  karamiteBinds: 0,
  leakMudZones: 0,
  soukiBursts: 0,
  gateEaterCharges: 0,
  powerActivations: 0,
  escortCompletions: 0,
  sealCompletions: 0,
  offFloorSteps: 0,
  maxLaneAnchorError: 0,
});

function createStationAbilityRuntime(kind: string): StationAbilityRuntime {
  if (kind === "grappler") return createKaramiteRuntime() as StationAbilityRuntime;
  if (kind === "ooze") return createLeakMudRuntime() as StationAbilityRuntime;
  if (kind === "sprinter") return createSoukiRuntime() as StationAbilityRuntime;
  if (kind === "gate-eater") return createTicketGateEaterRuntime() as StationAbilityRuntime;
  if (kind === "kurome") return createKuromeTrackingRuntime() as StationAbilityRuntime;
  if (isBossAnomalyKind(kind)) return createBossAnomalyRuntime(kind) as StationAbilityRuntime;
  if (isV090InfectedKind(kind)) return createV090InfectedRuntime(kind) as StationAbilityRuntime;
  return { phase: "idle", remainingSeconds: 0 };
}

const initialGame = (
  selectedSupply: SupplyKind = "pod",
  stageId = CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE,
  formationKinds: UnitKind[] = cards.slice(0, 7).map((card) => card.kind),
  resultId = createBattleResultId(stageId),
  storyBattleReadEventIds: string[] = [],
  unitLevels: Record<string, number> = {},
  equipmentSnapshot: {
    personalEquipmentByUnit?: Record<string, readonly (string | null)[]>;
    tacticalEquipmentIds?: readonly (string | null)[];
    equipmentEnhancementLevels?: Record<string, number>;
  } = {},
): Game => {
  const definition = createBattleDefinition(stageId) as BattleDefinition;
  const campaignUnits = CAMPAIGN_UNITS as unknown as readonly CampaignUnitData[];
  const unitLevelsByKind = Object.fromEntries(campaignUnits
    .map((unit) => [unit.combatKind, unitLevels[unit.id] ?? 1]));
  const personalEquipmentByKind = Object.fromEntries(campaignUnits.map((unit) => [
    unit.combatKind,
    (equipmentSnapshot.personalEquipmentByUnit?.[unit.id] ?? [])
      .filter((equipmentId): equipmentId is string => typeof equipmentId === "string"),
  ]));
  const tacticalEquipmentIds = (equipmentSnapshot.tacticalEquipmentIds ?? [])
    .filter((equipmentId): equipmentId is string => typeof equipmentId === "string");
  const equipmentEnhancementLevels = { ...(equipmentSnapshot.equipmentEnhancementLevels ?? {}) };
  const tacticalEffects = aggregateEquipmentEffects(
    tacticalEquipmentIds,
    equipmentEnhancementLevels,
  );
  const adjustedBaseMaxHp = Math.round(definition.baseMaxHp * tacticalEffects.baseHpMultiplier);
  return ({
  definition,
  resultId,
  formationKinds: [...formationKinds],
  unitLevelsByKind,
  personalEquipmentByKind,
  tacticalEquipmentIds,
  equipmentEnhancementLevels,
  running: false,
  paused: false,
  over: false,
  won: false,
  time: 0,
  last: 0,
  energy: Math.min(COMMAND_MAX, COMMAND_INITIAL + tacticalEffects.startingEnergyFlat),
  supportGauge: Math.min(SUPPORT_GAUGE_MAX, tacticalEffects.supportGaugeFlat),
  scrap: 0,
  kills: 0,
  wave: 1,
  phase: 1,
  eventIndex: 0,
  convoyProgress: 0,
  civiliansEvacuated: 0,
  enemySpawn: createEnemySpawnRuntime() as EnemySpawnRuntime,
  baseHp: adjustedBaseMaxHp,
  baseMaxHp: adjustedBaseMaxHp,
  barricadeHp: definition.enemyBaseMaxHp,
  barricadeMaxHp: definition.enemyBaseMaxHp,
  barricadeVulnerable: definition.startsEnemyBaseVulnerable,
  barricadeHitFlash: 0,
  barricadeHitY: activeLaneCenters[1],
  barricadeBucklingAnnounced: false,
  barricadeCriticalAnnounced: false,
  fighters: [],
  particles: [],
  shots: [],
  pendingWeaponHits: [],
  damageTexts: [],
  corpses: [],
  selectedSupply,
  battlefieldObjects: [],
  areaEffects: [],
  stationHazards: [],
  researchContainer: definition.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL
    ? createResearchContainerRuntime(definition.missionConfig) as ResearchContainerRuntime
    : null,
  stageMission: createStationMissionRuntime(definition.missionType, definition.missionConfig) as StageMissionRuntime,
  nextAreaEffectId: 1,
  airstrike: createEmergencySupportRuntime() as AirstrikeRuntime,
  crawlerAbility: createCrawlerAbilityRuntime() as CrawlerRuntime,
  placementIndicator: null,
  deployCooldowns: emptyCooldowns(),
  deployQueue: [],
  qaNextDeploymentLane: null,
  crawlerDoor: createCrawlerDoorRuntime(),
  nextId: 1,
  nextLanePlanAt: 0,
  resolvedDefeatIds: new Set<number>(),
  shake: createCameraShakeRuntime(),
  enemyBaseCollapse: 0,
  resultPresented: false,
  banner: `${definition.displayName} // 出撃準備 ${definition.prepSeconds}`,
  bannerTime: .2,
  flashOverlay: 0,
  combo: 0,
  comboTime: 0,
  maxCombo: 0,
  unitsLost: 0,
  crawlerFootstepCount: 0,
  crawlerHitFlash: 0,
  crawlerHitSfxCooldown: 0,
  criticalAnnounced: false,
  takuyaEnragedAnnounced: false,
  takuyaEntranceAudioRemaining: 0,
  battleBarks: createBattleBarkRuntime(),
  barkFlags: [],
  // Outbreak operations reuse the prerequisite campaign battlefield and its
  // authored battle-bark flow; the operation ID itself is not a story stage.
  storyFlowState: createBattleStoryFlowState(definition.stageId),
  storyBattleBarkState: createStoryBattleBarkState(),
  storyBattleReadEventIds: [...storyBattleReadEventIds],
  storyBattleReceiptEventIds: [],
  enemyKindsSeen: [],
  signalIds: [],
  bossDefeated: false,
  bossDefeatPending: false,
  qaBarks: false,
  roleMetrics: emptyRoleMetrics(),
  combatMetrics: emptyCombatMetrics(),
  stationMetrics: emptyStationMetrics(),
  survivalRun: null,
  survivalRuntime: null,
  survivalCheckpointReceipt: null,
  manualAbilityVfx: [],
  manualAbilityReceipts: [],
  pendingAbilityAudioCues: [],
  });
};

const initialSurvivalGame = ({
  selectedSupply,
  run,
  formationKinds,
  unitLevels,
}: {
  selectedSupply: SupplyKind;
  run: ReturnType<typeof createSurvivalRun>;
  formationKinds: UnitKind[];
  unitLevels: Record<string, number>;
}): Game => {
  const stageId = CAMPAIGN_STAGE_IDS.T_PLAN_CENTRAL_SEAL;
  const game = initialGame(
    selectedSupply,
    stageId,
    formationKinds,
    run.runId,
    [],
    unitLevels,
    run.formation,
  );
  game.definition = {
    ...game.definition,
    displayName: "感染防衛前線",
    missionType: "survival",
    prepSeconds: 0,
    enemyBaseMode: "scenery",
    startsEnemyBaseVulnerable: false,
    bossUnlocksEnemyBase: false,
    timeline: [],
    defenseEndAt: null,
    phaseSchedule: null,
    objective: "CRAWLER防衛・無限wave",
    missionConfig: {
      spawnProfile: "survival-infection-breach",
      defenseFrontX: 646,
    },
    rescueCount: 0,
  };
  game.survivalRun = run;
  game.survivalRuntime = createSurvivalCombatRuntime(run);
  game.survivalCheckpointReceipt = null;
  game.baseHp = run.crawler.hp;
  game.baseMaxHp = run.crawler.maxHp;
  game.barricadeHp = 1;
  game.barricadeMaxHp = 1;
  game.barricadeVulnerable = false;
  game.wave = run.currentWave;
  game.phase = 1;
  game.eventIndex = 0;
  game.banner = `SURVIVAL // WAVE ${run.currentWave}`;
  game.bannerTime = 2.2;
  return game;
};

function addParticles(g: Game, x: number, y: number, color: string, count = 8) {
  for (let i = 0; i < count; i++) {
    g.particles.push({
      x,
      y,
      vx: (Math.random() - .5) * 120,
      vy: -Math.random() * 110 - 20,
      life: .4 + Math.random() * .5,
      color,
      size: 2 + Math.random() * 4,
    });
  }
  g.particles = capRenderArray(g.particles, RENDER_ARRAY_LIMITS.particles) as Particle[];
}

function addDamageText(g: Game, text: DamageText) {
  g.damageTexts.push(text);
  g.damageTexts = capRenderArray(g.damageTexts, RENDER_ARRAY_LIMITS.damageTexts) as DamageText[];
}

function addWeaponShot(g: Game, hit: Pick<PendingWeaponHit,
  "sourceId" | "targetId" | "originX" | "originY" | "targetX" | "targetY"
  | "weapon" | "shotIndex" | "recoil" | "casing" | "hitStopSeconds" | "impactDelaySeconds">) {
  // Keep the fading impact trace resident long enough for low-frequency
  // mobile WebKit frames to show the complete three-round burst together.
  const duration = Math.max(.01, hit.impactDelaySeconds) + hit.hitStopSeconds + .16;
  g.shots.push({
    x: hit.originX,
    y: hit.originY,
    tx: hit.targetX,
    ty: hit.targetY,
    life: duration,
    duration,
    side: "human",
    sourceId: hit.sourceId,
    ...(hit.targetId === null ? {} : { targetId: hit.targetId, damageTargetId: hit.targetId }),
    style: "projectile",
    weapon: hit.weapon,
    shotIndex: hit.shotIndex,
    recoil: hit.recoil,
    casing: hit.casing,
    hitStopSeconds: hit.hitStopSeconds,
    impactDelaySeconds: hit.impactDelaySeconds,
  });
  if (hit.casing) {
    addParticles(g, hit.originX - 3 - hit.shotIndex * 2, hit.originY - 4, "#d8a94f", 1);
  }
}

function laneY(lane: Lane, id = 0) {
  return activeLaneCenters[lane] + ((id % 3) - 1) * 3;
}

function fighterDistance(a: Pick<Fighter, "x" | "y">, b: Pick<Fighter, "x" | "y">) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function effectDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, (a.y - b.y) * 2);
}

function manualAbilityTargetCandidates(g: Game, owner: Fighter) {
  if (owner.kind !== "brute"
    || !g.barricadeVulnerable
    || g.barricadeHp <= 0
    || g.definition.enemyBaseMode === "scenery") {
    return g.fighters;
  }
  const target = enemyBaseTargetPoint(owner.lane, activeLaneCenters);
  return [...g.fighters, {
    id: "manual-structure:enemy-base",
    kind: "infected-base",
    side: "zombie",
    x: target.x,
    y: target.y,
    lane: owner.lane,
    hp: g.barricadeHp,
    maxHp: g.barricadeMaxHp,
    combatReady: true,
    contained: false,
    targetable: true,
    isStructure: true,
  }];
}

function snapshotManualAbilityCooldowns(fighters: readonly Fighter[]) {
  const byKind: Record<string, number[]> = {};
  const living = fighters
    .filter((fighter) => fighter.side === "human" && fighter.hp > 0 && fighter.manualAbility)
    .sort((left, right) => left.id - right.id);
  for (const fighter of living) {
    const values = byKind[fighter.kind] ?? [];
    values.push(manualAbilityCheckpointCooldown(fighter.manualAbility));
    byKind[fighter.kind] = values;
  }
  return byKind;
}

function consumeSurvivalManualAbilityCooldown(g: Game, kind: UnitKind) {
  const run = g.survivalRun;
  const queue = run?.manualAbilityCooldownsByKind?.[kind];
  if (!run || !Array.isArray(queue) || queue.length === 0) {
    return restoreManualAbilityCooldown(kind, 0) as ManualAbilityRuntime | null;
  }
  const [cooldown, ...remaining] = queue;
  const nextCooldowns = { ...run.manualAbilityCooldownsByKind };
  if (remaining.length > 0) nextCooldowns[kind] = remaining;
  else delete nextCooldowns[kind];
  g.survivalRun = {
    ...run,
    manualAbilityCooldownsByKind: nextCooldowns,
  };
  return restoreManualAbilityCooldown(kind, cooldown) as ManualAbilityRuntime | null;
}

function v090EnemyIncomingDamageMultiplier(
  g: Game,
  attacker: Fighter | null,
  target: Fighter,
  attackKind: "melee" | "ranged",
) {
  if (target.side !== "zombie") return 1;
  let multiplier = target.kind === "cagewalker" && attacker
    ? cagewalkerFrontDamageMultiplier({
      phase: target.stationAbility.phase,
      attackerX: attacker.x,
      targetX: target.x,
    })
    : 1;
  if (target.kind === "gairen" && attacker) {
    multiplier *= gairenIncomingDamageMultiplier({
      runtime: target.stationAbility,
      attackerX: attacker.x,
      bossX: target.x,
      verticalDistance: attacker.y - target.y,
    });
  }
  for (const anchor of g.fighters) {
    if (anchor.kind !== "anchor-bloom" || anchor.hp <= 0 || !anchor.combatReady) continue;
    const reinforcement = anchorBloomReinforcement({
      phase: anchor.stationAbility.phase,
      anchor,
      target,
    });
    if (reinforcement.active) {
      multiplier *= reinforcement.incomingDamageMultiplier;
      break;
    }
  }
  if (attackKind === "ranged" && attacker) {
    for (const manta of g.fighters) {
      if (manta.kind !== "pall-manta" || manta.hp <= 0 || !manta.combatReady) continue;
      const canopyMultiplier = pallMantaProjectileMultiplier({
        phase: manta.stationAbility.phase,
        shooter: attacker,
        target,
        manta,
      });
      if (canopyMultiplier < 1) {
        multiplier *= canopyMultiplier;
        break;
      }
    }
  }
  return multiplier;
}

function createUnitRoleRuntime({
  defense = 0,
  healingMultiplier = 1,
  trapDurationMultiplier = 1,
}: Pick<UnitCard, "defense" | "healingMultiplier" | "trapDurationMultiplier"> = {}) {
  return {
    damageReductionRemaining: 0,
    damageReductionMultiplier: 1,
    defense,
    healingMultiplier,
    trapDurationMultiplier,
    healFocusTargetId: null,
    healFocusRemaining: 0,
    comboHits: 0,
    comboWindow: 0,
    weaponHeat: 0,
    overheated: false,
    suppressionStacks: 0,
    suppressedRemaining: 0,
    suppressionMultiplier: 1,
    guardStandRemaining: 0,
    guardStandAvailable: true,
    engineerTrapReady: false,
    engineerTrapX: 0,
    engineerTrapLane: null,
    engineerTrapCooldown: 0,
    engineerTrapManual: false,
    armorBreakStacks: 0,
    armorBrokenRemaining: 0,
  };
}

function damageAfterRoleProtection(target: Fighter, damage: number) {
  const incoming = Math.max(0, damage);
  const multiplier = target.damageReductionRemaining > 0
    ? Math.max(0, Math.min(1, target.damageReductionMultiplier))
    : 1;
  return {
    damage: incoming * multiplier,
    prevented: incoming * (1 - multiplier),
  };
}

function applyIncomingHumanDamage(
  g: Game,
  target: Fighter,
  incomingDamage: number,
  { attackKind = "melee", attacker = null }: { attackKind?: "melee" | "ranged"; attacker?: Fighter | null } = {},
) {
  const incoming = Math.max(0, incomingDamage);
  const targetHpBefore = target.hp;
  if (target.kind === "mayo-chan" && mayoRetreatBlocksDamage(target.mayoRetreat)) {
    return Object.freeze({
      targetDamage: 0,
      redirectedDamage: 0,
      preventedDamage: incoming,
    });
  }
  if (target.kind === "miyamoto-musashi" && attackKind === "melee" && target.manualAbility) {
    const counter = triggerMusashiCounter(target.manualAbility);
    if (counter.ok) {
      const storedTargetId = counter.event?.target?.targetId;
      const counterTarget = attacker?.side === "zombie" && attacker.hp > 0
        ? attacker
        : g.fighters.find((candidate) => (
          candidate.id === storedTargetId
          && candidate.side === "zombie"
          && candidate.hp > 0
          && candidate.combatReady
        )) ?? null;
      target.manualAbility = counter.runtime as ManualAbilityRuntime;
      target.flash = Math.max(target.flash, .32);
      target.attack = Math.max(target.attack, .42);
      target.cooldown = Math.max(target.cooldown, .42);
      g.manualAbilityReceipts.push({
        ownerId: target.id,
        activationId: counter.event?.activationId ?? target.manualAbility.activationId,
        kind: target.kind,
        eventType: "impact",
        mode: "counter",
        at: g.time,
      });
      g.manualAbilityReceipts = g.manualAbilityReceipts.slice(-32);
      g.pendingAbilityAudioCues.push({
        cueId: "ability-musashi-counter",
        x: counterTarget?.x ?? target.x,
        dedupeKey: `manual-ability:${target.id}:${counter.event?.activationId ?? target.manualAbility.activationId}:counter`,
      });
      g.pendingAbilityAudioCues = g.pendingAbilityAudioCues.slice(-8);
      g.manualAbilityVfx = g.manualAbilityVfx
        .filter((effect) => effect.ownerId !== target.id)
        .concat({
          ownerId: target.id,
          activationId: counter.event?.activationId ?? target.manualAbility.activationId,
          kind: target.kind,
          originX: target.x,
          originY: target.y,
          targetX: counterTarget?.x ?? target.x + 42,
          targetY: counterTarget?.y ?? target.y,
          elapsed: 0,
          duration: .46,
        })
        .slice(-8);
      addDamageText(g, {
        x: target.x,
        y: target.y - 72,
        value: "受け流し",
        life: .9,
        color: "#c5e7ff",
      });
      if (counterTarget) {
        const definition = MANUAL_ABILITY_REGISTRY["miyamoto-musashi"];
        const strikeDamage = definition.counterDamage * (isBossEnemyKind(counterTarget.kind) ? definition.bossDamageMultiplier : 1);
        const applied = Math.min(counterTarget.hp, strikeDamage);
        counterTarget.hp = Math.max(0, counterTarget.hp - strikeDamage);
        recordUnitDamage(g, target.kind, applied);
        counterTarget.stunned = Math.max(counterTarget.stunned, definition.counterStunSeconds);
        counterTarget.flash = Math.max(counterTarget.flash, .3);
        counterTarget.knock = Math.max(counterTarget.knock, isBossEnemyKind(counterTarget.kind) ? 5 : 14);
        addDamageText(g, {
          x: counterTarget.x,
          y: counterTarget.y - 58,
          value: `無空 -${Math.round(applied)}`,
          life: .92,
          color: "#d7efff",
        });
        addParticles(g, counterTarget.x, counterTarget.y - 30, "#c7e4ef", 18);
      }
      return Object.freeze({
        targetDamage: 0,
        redirectedDamage: 0,
        preventedDamage: incoming,
      });
    }
  }
  const activeGuardian = g.fighters
    .filter((candidate) => (
      candidate.side === "human"
      && candidate.kind === "guardian"
      && candidate.hp > 0
      && candidate.manualAbility?.phase === "active"
      && fighterDistance(candidate, target) <= MANUAL_ABILITY_REGISTRY.guardian.protectionRadius
      && target.x <= candidate.x + 12
    ))
    .sort((left, right) => fighterDistance(left, target) - fighterDistance(right, target) || left.id - right.id)[0] ?? null;
  const manualProtectionMultiplier = target.kind === "kumaverson" && target.manualAbility?.phase === "active"
    ? MANUAL_ABILITY_REGISTRY.kumaverson.damageTakenMultiplier
    : target.kind === "guardian" && target.manualAbility?.phase === "active"
      ? MANUAL_ABILITY_REGISTRY.guardian.selfDamageTakenMultiplier
      : activeGuardian
        ? MANUAL_ABILITY_REGISTRY.guardian.allyDamageTakenMultiplier
        : 1;
  let targetDamage = incoming * manualProtectionMultiplier;
  let redirectedDamage = 0;
  let preventedDamage = incoming - targetDamage;
  const guardian = g.fighters
    .filter((candidate) => candidate.side === "human" && candidate.kind === "guardian" && candidate.hp > 0)
    .sort((left, right) => fighterDistance(left, target) - fighterDistance(right, target) || left.id - right.id)
    .find((candidate) => resolveGantetsuInterception({
      guardian: candidate,
      target,
      incomingDamage: targetDamage,
      attackKind,
      steadfast: { remainingSeconds: candidate.guardStandRemaining, available: candidate.guardStandAvailable },
    }).eligible);

  if (guardian) {
    const guardianHpBefore = guardian.hp;
    const rawInterception = resolveGantetsuInterception({
      guardian,
      target,
      incomingDamage: targetDamage,
      attackKind,
      steadfast: { remainingSeconds: guardian.guardStandRemaining, available: guardian.guardStandAvailable },
    });
    const armoredGuardianDamage = damageAfterUnitDefense(rawInterception.guardianDamage, guardian.defense);
    const guardedDamage = damageAfterRoleProtection(guardian, armoredGuardianDamage.damage);
    const protectedGuardian = {
      ...guardian,
      hp: guardian.hp + armoredGuardianDamage.prevented + guardedDamage.prevented,
    };
    const appliedInterception = resolveGantetsuInterception({
      guardian: protectedGuardian,
      target,
      incomingDamage: targetDamage,
      attackKind,
      steadfast: { remainingSeconds: guardian.guardStandRemaining, available: guardian.guardStandAvailable },
    });
    guardian.hp = appliedInterception.guardianHp;
    guardian.guardStandRemaining = appliedInterception.steadfast.remainingSeconds;
    guardian.guardStandAvailable = appliedInterception.steadfast.available;
    recordUnitDamageTaken(g, guardian.kind, Math.max(0, guardianHpBefore - guardian.hp));
    guardian.flash = Math.max(guardian.flash, .12);
    redirectedDamage = rawInterception.guardianDamage;
    targetDamage = rawInterception.targetDamage;
    preventedDamage += armoredGuardianDamage.prevented + guardedDamage.prevented;
    g.roleMetrics.gantetsuRedirectedDamage += redirectedDamage;
    g.roleMetrics.naoPreventedDamage += guardedDamage.prevented;
    addDamageText(g, {
      x: guardian.x,
      y: guardian.y - 72,
      value: `盾 -${Math.round(guardedDamage.damage)}`,
      life: .7,
      color: "#bcd5d5",
    });
  }

  const armoredTargetDamage = damageAfterUnitDefense(targetDamage, target.defense);
  const protectedTarget = damageAfterRoleProtection(target, armoredTargetDamage.damage);
  let appliedTargetDamage = protectedTarget.damage;
  if (target.kind === "guardian") {
    const steadfastDamage = resolveGantetsuSteadfastDamage({
      guardian: target,
      incomingDamage: protectedTarget.damage,
      steadfast: {
        remainingSeconds: target.guardStandRemaining,
        available: target.guardStandAvailable,
      },
    });
    target.hp = steadfastDamage.hp;
    target.guardStandRemaining = steadfastDamage.steadfast.remainingSeconds;
    target.guardStandAvailable = steadfastDamage.steadfast.available;
    appliedTargetDamage = steadfastDamage.damage;
    preventedDamage += Math.max(0, protectedTarget.damage - steadfastDamage.damage);
    if (steadfastDamage.steadfast.triggered) {
      addDamageText(g, {
        x: target.x,
        y: target.y - 78,
        value: "踏みとどまる",
        life: .95,
        color: "#d7ecec",
      });
    }
  } else {
    target.hp -= protectedTarget.damage;
  }
  recordUnitDamageTaken(g, target.kind, Math.max(0, targetHpBefore - target.hp));
  preventedDamage += armoredTargetDamage.prevented + protectedTarget.prevented;
  g.roleMetrics.naoPreventedDamage += protectedTarget.prevented;
  return Object.freeze({
    targetDamage: appliedTargetDamage,
    redirectedDamage,
    preventedDamage,
  });
}

function bodyRadiusFor(kind: string) {
  return UNIT_CARDS.find((unit) => unit.kind === kind)?.bodyRadius
    ?? enemyBodyRadiusFor(kind)
    ?? 11;
}

const ENEMY_RECORD_PROFILE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  nearest: "正面の対象へ接近し、近距離で攻撃する。",
  "crawler-priority": "高速で防衛線を抜け、移動拠点を優先する。",
  ranged: "距離を保ちながら遠隔攻撃を行う。",
  "support-object": "高耐久で支援物資や防衛対象を破壊する。",
  backline: "前衛を抜け、後衛の隊員を狙う。",
  area: "広い攻撃範囲で密集した部隊を崩す。",
  grab: "拘束予告後に隊員を引き寄せる。",
  contamination: "床面へ持続汚染を残し、移動を制限する。",
  charge: "直線予告後に高速突進する。",
  "sonic-cone": "前方へ拡大する音圧攻撃で部隊を崩す。",
  "living-barricade": "味方感染体の前面を覆う生体防壁となる。",
  "vault-backline": "前衛を跳び越えて後衛へ着地する。",
  "mimic-taunt": "擬態音声で標的選択を撹乱する。",
  "projectile-canopy": "皮膜を展開し、遠隔攻撃を減衰させる。",
  "root-support": "地面へ根を張り、周囲の感染体を補強する。",
});

function spriteCompendiumStyle(
  kind: string,
  box = { width: 160, height: 118 },
): CSSProperties {
  const frame = spriteFrameFor(kind, "idle", "left");
  const content = frame.contentRect ?? frame.sourceRect ?? { x: frame.x, y: frame.y, w: frame.w, h: frame.h };
  const source = frame.sourceRect ?? { x: frame.x, y: frame.y, w: frame.w, h: frame.h };
  const boxWidth = box.width;
  const boxHeight = box.height;
  const scale = Math.min((boxWidth - 16) / Math.max(1, content.w), (boxHeight - 12) / Math.max(1, content.h));
  const contentCenterX = (content.x - source.x + content.w / 2) * scale;
  const contentCenterY = (content.y - source.y + content.h / 2) * scale;
  return {
    position: "absolute",
    width: `${source.w * scale}px`,
    height: `${source.h * scale}px`,
    left: `${boxWidth / 2 - contentCenterX}px`,
    top: `${boxHeight / 2 - contentCenterY}px`,
    backgroundImage: `url('${frame.path}')`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${frame.sheetWidth * scale}px ${frame.sheetHeight * scale}px`,
    backgroundPosition: `${-source.x * scale}px ${-source.y * scale}px`,
  };
}

function fullCompendiumStyle(path: string): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    backgroundImage: `url('${path}')`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
    backgroundSize: "contain",
  };
}

function spawnEnemy(g: Game, kind: string, lane: Lane, order = 0, gateEntry: EnemySpawnEntry | null = null) {
  const data = enemyStatsForWave(kind, g.wave);
  if (!g.enemyKindsSeen.includes(kind)) g.enemyKindsSeen.push(kind);
  const id = g.nextId++;
  const gateEntering = kind !== "turned" && gateEntry !== null;
  g.fighters.push({
    id,
    side: "zombie",
    kind,
    aiProfile: enemyContentFor(kind)?.aiProfile ?? "nearest",
    lane,
    anchorLane: lane,
    x: gateEntering ? gateEntry.x : kind === "turned" ? 0 : Math.min(WORLD_GEOMETRY.barricade.enemySpawnMaxX, WORLD_GEOMETRY.barricade.enemySpawnMinX + order * 16),
    y: gateEntering ? gateEntry.y : laneY(lane, id),
    maxHp: data.hp,
    ...data,
    cooldown: order * .18,
    supportCooldown: 0,
    flash: 0,
    step: Math.random() * 4,
    attack: 0,
    knock: 0,
    variant: id % 3,
    targetId: null,
    targetObjectId: null,
    retargetIn: 0,
    nextLaneDecisionAt: 0,
    bodyRadius: bodyRadiusFor(kind),
    laneSpeed: enemyLaneSpeedFor(kind),
    spawnGrace: 0,
    combatReady: !gateEntering,
    contained: false,
    gateEntering,
    entryDirection: -1,
    spawnPortalId: gateEntry?.portalId ?? null,
    spawnEntryMode: gateEntry?.entryMode,
    entryStepDistance: 0,
    gateEntrySpeed: gateEntry?.entrySpeed ?? 0,
    combatReadyX: gateEntry?.combatReadyX ?? 0,
    combatReadyY: gateEntry?.combatReadyY ?? gateEntry?.y ?? laneY(lane, id),
    marked: 0,
    stunned: 0,
    bleedRemaining: 0,
    bleedDamagePerSecond: 0,
    aiDestinationX: 0,
    aiMoveDirection: 0,
    navigationRecovery: createNavigationRecoveryState({
      x: gateEntering ? gateEntry.x : kind === "turned" ? 0 : Math.min(WORLD_GEOMETRY.barricade.enemySpawnMaxX, WORLD_GEOMETRY.barricade.enemySpawnMinX + order * 16),
      y: gateEntering ? gateEntry.y : laneY(lane, id),
      lane,
    }),
    abilityCooldown: enemyInitialAbilityCooldownFor(kind),
    abilityWindup: 0,
    attackSequence: 0,
    stationAbility: createStationAbilityRuntime(kind),
    ...createUnitRoleRuntime(),
  });
  return g.fighters[g.fighters.length - 1];
}

function equippedCardForGame(g: Game, kind: UnitKind) {
  const baseCard = cards.find((item) => item.kind === kind);
  if (!baseCard) return null;
  const progressedCard = applyUnitLevelProgression(baseCard, g.unitLevelsByKind[kind] ?? 1) as UnitCard & { progressionLevel: number; progressionRank: number };
  const equipmentEffects = aggregateEquipmentEffects([
    ...(g.personalEquipmentByKind[kind] ?? []),
    ...g.tacticalEquipmentIds,
  ], g.equipmentEnhancementLevels);
  const survivalEffects = survivalUpgradeEffects(g.survivalRun);
  return {
    ...progressedCard,
    hp: Math.max(1, Math.round(progressedCard.hp * equipmentEffects.hpMultiplier)),
    damage: progressedCard.damage
      * survivalEffects.attackMultiplier
      * equipmentEffects.damageMultiplier,
    range: progressedCard.range
      * survivalEffects.rangeMultiplier
      * equipmentEffects.rangeMultiplier,
    speed: progressedCard.speed * equipmentEffects.speedMultiplier,
    laneSpeed: progressedCard.laneSpeed * equipmentEffects.speedMultiplier,
    attackEvery: progressedCard.attackEvery * equipmentEffects.attackEveryMultiplier,
    defense: Math.min(
      .75,
      1 - (1 - Math.min(.75, (progressedCard.defense ?? 0) + equipmentEffects.defenseFlat))
        * survivalEffects.defenseMultiplier,
    ),
    healingMultiplier: (progressedCard.healingMultiplier ?? 1)
      * survivalEffects.healingMultiplier
      * equipmentEffects.healingMultiplier,
    deployCooldown: progressedCard.deployCooldown * equipmentEffects.redeployMultiplier,
  } as UnitCard & { progressionLevel: number; progressionRank: number };
}

function spawnHuman(g: Game, kind: UnitKind, runOutFromCrawler = false) {
  const card = equippedCardForGame(g, kind);
  if (!card) return null;
  const id = g.nextId++;
  const laneCounts = [0, 0, 0];
  for (const ally of g.fighters) {
    if (ally.side === "human" && ally.hp > 0 && ally.anchorLane !== null) laneCounts[ally.anchorLane] += 1;
  }
  const assignedLane = runOutFromCrawler && g.qaNextDeploymentLane !== null
    && g.qaNextDeploymentLane !== undefined
    ? g.qaNextDeploymentLane
    : chooseHumanDeploymentLane({ laneCounts }) as Lane;
  if (runOutFromCrawler) g.qaNextDeploymentLane = null;
  const laneSpeed = card.laneSpeed;
  const deployment = runOutFromCrawler
    ? friendlyDeploymentPoint({
      stageId: g.definition.stageId,
      viewport: activeStageViewportId,
    })
    : {
      legacyLane: MUSTER_LANE,
      x: MUSTER_X,
      y: activeMusterY(),
      combatReadyX: MUSTER_X,
      combatReadyY: activeMusterY(),
    };
  const manualAbility = g.survivalRun
    ? consumeSurvivalManualAbilityCooldown(g, kind)
    : createManualAbilityRuntime(kind) as ManualAbilityRuntime | null;
  g.fighters.push({
    id, side: "human", kind, aiProfile: card.aiProfile, lane: deployment.legacyLane as Lane, anchorLane: assignedLane, x: deployment.x, y: deployment.y, hp: card.hp, maxHp: card.hp,
    speed: card.speed, damage: card.damage, range: card.range, cooldown: 0, supportCooldown: 0,
    attackEvery: card.attackEvery, flash: 0, step: Math.random() * 4, attack: 0, knock: 0, variant: id % 3,
    targetId: null, targetObjectId: null, retargetIn: 0, nextLaneDecisionAt: 0, bodyRadius: bodyRadiusFor(kind), laneSpeed, spawnGrace: .95,
    combatReady: !runOutFromCrawler, gateEntering: runOutFromCrawler, entryDirection: 1, spawnPortalId: runOutFromCrawler ? "crawler-door" : null, entryStepDistance: 0, gateEntrySpeed: Math.max(54, card.speed * 3.2), combatReadyX: deployment.combatReadyX,
    combatReadyY: deployment.combatReadyY,
    entryRampX: "rampFootX" in deployment ? deployment.rampFootX : deployment.combatReadyX,
    entryRampY: "rampFootY" in deployment ? deployment.rampFootY : deployment.combatReadyY,
    entryRampCleared: !runOutFromCrawler,
    contained: false,
    marked: 0, stunned: 0, bleedRemaining: 0, bleedDamagePerSecond: 0, aiDestinationX: MUSTER_X, aiMoveDirection: 0,
    navigationRecovery: createNavigationRecoveryState({ x: deployment.x, y: deployment.y, lane: assignedLane }),
    abilityCooldown: 0, abilityWindup: 0, attackSequence: 0,
    stationAbility: createStationAbilityRuntime(kind),
    manualAbility,
    mayoBiteSlowRemaining: 0,
    mayoRetreat: null,
    progressionLevel: card.progressionLevel,
    progressionRank: card.progressionRank,
    ...createUnitRoleRuntime(card),
  });
  addParticles(g, deployment.combatReadyX, deployment.combatReadyY, "#d0b48b", 7);
  g.banner = `${card.name} // 移動拠点から出撃`;
  g.bannerTime = .8;
  return card;
}

function beginMayoRetreat(g: Game, fighter: Fighter, reason: "ability" | "injury") {
  if (fighter.kind !== "mayo-chan" || fighter.mayoRetreat) return false;
  fighter.hp = Math.max(1, fighter.hp);
  fighter.targetable = false;
  fighter.combatReady = false;
  fighter.gateEntering = false;
  fighter.contained = false;
  fighter.targetId = null;
  fighter.targetObjectId = null;
  fighter.aiMoveDirection = -1;
  fighter.cooldown = Number.POSITIVE_INFINITY;
  fighter.manualAbility = fighter.manualAbility
    ? ({ ...fighter.manualAbility, phase: "retreat", activeRemaining: 0, target: null } as ManualAbilityRuntime)
    : null;
  fighter.mayoRetreat = createMayoRetreatRuntime({ reason });
  g.manualAbilityVfx = g.manualAbilityVfx.filter((effect) => effect.ownerId !== fighter.id);
  const redeploy = Math.max(36, (cards.find((card) => card.kind === "mayo-chan")?.deployCooldown ?? 24) * 1.75);
  g.deployCooldowns["mayo-chan"] = Math.max(g.deployCooldowns["mayo-chan"] ?? 0, redeploy);
  g.banner = reason === "injury" ? "マヨちゃん // 負傷退避" : "マヨちゃん // 退避";
  g.bannerTime = 1.35;
  addParticles(g, fighter.x, fighter.y - 10, reason === "injury" ? "#e6c97a" : "#b05268", 9);
  return true;
}

function prepareEndgameQa(g: Game) {
  g.time = 148;
  g.phase = 3;
  g.wave = 8;
  g.eventIndex = missionEvents.length;
  g.baseHp = 500;
  g.barricadeHp = 760;
  g.energy = COMMAND_MAX;

  const lineup: [UnitKind, Lane, number][] = [
    ["brute", 0, 730],
    ["gunner", 1, 690],
    ["brawler", 2, 730],
  ];
  for (const [kind, lane, x] of lineup) {
    spawnHuman(g, kind);
    const fighter = g.fighters[g.fighters.length - 1];
    fighter.lane = lane;
    fighter.anchorLane = lane;
    fighter.x = x;
    fighter.y = laneY(lane, fighter.id);
    fighter.cooldown = 2.2;
    fighter.spawnGrace = 0;
  }

  const takuya = spawnEnemy(g, "takuya", 1);
  takuya.hp = 420;
  takuya.x = 720;
  takuya.y = laneY(1, takuya.id);
  takuya.cooldown = .5;
  takuya.abilityCooldown = 0;
  g.banner = "QA ENDGAME // TAKUYA ACTIVE";
  g.bannerTime = 2.2;

}

function prepareTakuyaEntranceQa(g: Game) {
  const bossEventIndex = g.definition.timeline.findIndex((event) => (
    event.units.includes("takuya")
  ));
  const bossEvent = g.definition.timeline[bossEventIndex];
  if (!bossEvent || bossEventIndex < 0) return;

  g.time = Math.max(PREP_SECONDS, bossEvent.at - 1.2);
  g.phase = 3;
  g.wave = Math.max(1, bossEvent.wave - 1);
  g.eventIndex = bossEventIndex;
  g.baseHp = g.baseMaxHp;
  g.barricadeHp = BARRICADE_MAX_HP;
  g.energy = COMMAND_MAX;

  const lineup: [UnitKind, Lane, number][] = [
    ["brawler", 0, 700],
    ["gunner", 1, 660],
    ["kumaverson", 2, 700],
  ];
  for (const [kind, lane, x] of lineup) {
    spawnHuman(g, kind);
    const fighter = g.fighters[g.fighters.length - 1];
    fighter.lane = lane;
    fighter.anchorLane = lane;
    fighter.x = x;
    fighter.y = laneY(lane, fighter.id);
    fighter.cooldown = 2.2;
    fighter.spawnGrace = 0;
  }
  g.banner = "QA AUDIO // TAKUYA ENTRANCE IN 1.2s";
  g.bannerTime = 2.2;
}

function prepareAiReacquireQa(g: Game) {
  prepareEndgameQa(g);
  g.time = 168;
  g.baseHp = g.baseMaxHp;
  const takuya = g.fighters.find((fighter) => fighter.kind === "takuya");
  if (takuya) {
    takuya.hp = 18;
    takuya.cooldown = 2;
    takuya.abilityCooldown = 99;
  }
  for (const ally of g.fighters.filter((fighter) => fighter.side === "human")) ally.cooldown = 0;
  for (const [kind, lane, x] of [
    ["runner", 0, 790],
    ["walker", 1, 805],
    ["spitter", 2, 820],
  ] as [EnemyKind, Lane, number][]) {
    const enemy = spawnEnemy(g, kind, lane);
    enemy.x = x;
    enemy.y = laneY(lane, enemy.id);
    enemy.combatReady = false;
    enemy.gateEntering = true;
    enemy.combatReadyX = 650 + lane * 8;
    enemy.gateEntrySpeed = 92;
    enemy.targetId = null;
    enemy.targetObjectId = null;
  }
  g.banner = "QA AI // POST-TAKUYA REACQUIRE";
  g.bannerTime = 2.2;
}

function prepareRolesQa(g: Game) {
  g.time = 60;
  g.phase = 2;
  g.wave = 4;
  g.eventIndex = missionEvents.length;
  g.baseHp = 520;
  g.barricadeHp = BARRICADE_MAX_HP;
  g.energy = COMMAND_MAX;
  g.scrap = 100;
  g.barricadeVulnerable = true;
  g.barricadeMaxHp = Math.max(BARRICADE_MAX_HP, 5000);
  g.barricadeHp = g.barricadeMaxHp;

  const lineup: [UnitKind, Lane, number][] = [
    ["scout", 0, 310], ["brawler", 0, 465], ["guardian", 0, 520], ["crazy-king", 0, 650],
    ["ranger", 1, 300], ["gunner", 1, 430], ["babayaga", 1, 360], ["engineer", 1, 690],
    ["medic", 2, 420], ["brute", 2, 700], ["kumaverson", 2, 600],
  ];
  for (const [kind, lane, x] of lineup) {
    spawnHuman(g, kind);
    const fighter = g.fighters[g.fighters.length - 1];
    fighter.lane = lane; fighter.anchorLane = lane; fighter.x = x; fighter.y = laneY(lane, fighter.id);
    fighter.cooldown = 0; fighter.spawnGrace = 0;
    if (kind === "brute") {
      fighter.maxHp = 420;
      fighter.hp = 380;
    }
  }

  const scenarios: [EnemyKind, Lane, number, number?][] = [
    ["crusher", 0, 470], ["walker", 0, 680, .45], ["walker", 0, 700], ["walker", 0, 720],
    ["walker", 1, 500], ["walker", 1, 540], ["walker", 1, 580], ["spitter", 1, 640],
    ["crusher", 2, 740], ["walker", 2, 820],
  ];
  for (const [kind, lane, x, hpRatio] of scenarios) {
    const fighter = spawnEnemy(g, kind, lane);
    fighter.x = x; fighter.y = laneY(lane, fighter.id); fighter.cooldown = 1.2;
    if (hpRatio) fighter.hp = fighter.maxHp * hpRatio;
  }
  const brawler = g.fighters.find((fighter) => fighter.side === "human" && fighter.kind === "brawler");
  const guardianAssault = g.fighters.find((fighter) => fighter.side === "zombie" && fighter.kind === "crusher" && fighter.lane === 0);
  if (brawler && guardianAssault) {
    guardianAssault.maxHp = 1600;
    guardianAssault.hp = guardianAssault.maxHp;
    guardianAssault.cooldown = 0;
    guardianAssault.targetId = brawler.id;
    guardianAssault.retargetIn = 99;
  }
  const raiderTarget = g.fighters.find((fighter) => fighter.side === "zombie" && fighter.kind === "walker" && fighter.lane === 1);
  if (raiderTarget) {
    raiderTarget.maxHp = 1600;
    raiderTarget.hp = raiderTarget.maxHp;
  }
  const tataraTarget = g.fighters.find((fighter) => fighter.side === "zombie" && fighter.kind === "crusher" && fighter.lane === 2);
  if (tataraTarget) {
    tataraTarget.maxHp = 300;
    tataraTarget.hp = tataraTarget.maxHp;
  }
  const breaker = g.fighters.find((fighter) => fighter.side === "human" && fighter.kind === "brute");
  const heldEnemy = g.fighters.find((fighter) => fighter.side === "zombie" && fighter.kind === "walker" && fighter.lane === 2);
  if (breaker && heldEnemy) heldEnemy.targetId = breaker.id;
  g.banner = "QA ROLES // ELEVEN UNIT LIVE FIRE";
  g.bannerTime = 2.2;
}

function prepareZakimiyaQa(g: Game) {
  g.time = 60;
  g.phase = 2;
  g.wave = 4;
  g.eventIndex = missionEvents.length;
  g.baseHp = g.baseMaxHp;
  g.barricadeVulnerable = true;
  g.barricadeMaxHp = Math.max(BARRICADE_MAX_HP, 5000);
  g.barricadeHp = g.barricadeMaxHp;
  g.energy = COMMAND_MAX;
  g.scrap = 150;
  g.fighters = [];
  g.corpses = [];
  g.enemySpawn = createEnemySpawnRuntime() as EnemySpawnRuntime;

  spawnHuman(g, "zakimiya");
  const zakimiya = g.fighters[g.fighters.length - 1];
  zakimiya.lane = 1;
  zakimiya.anchorLane = 1;
  zakimiya.x = 380;
  zakimiya.y = laneY(1, zakimiya.id);
  zakimiya.spawnGrace = 0;
  zakimiya.combatReady = true;
  zakimiya.gateEntering = false;

  for (const [index, x] of [425, 555, 580, 605].entries()) {
    const target = spawnEnemy(g, index === 3 ? "crusher" : "walker", 1);
    target.x = x;
    target.y = laneY(1, target.id);
    target.maxHp = index === 0 ? 900 : 520;
    target.hp = target.maxHp;
    target.speed = 0;
    target.laneSpeed = 0;
    target.damage = 0;
    target.cooldown = 99;
    target.combatReady = true;
    target.gateEntering = false;
  }
  g.banner = "QA ZAKIMIYA // NORMAL ATTACK + 火酒投擲";
  g.bannerTime = 1.25;
}

function prepareNewPlayablesQa(g: Game) {
  g.time = 60;
  g.phase = 2;
  g.wave = 4;
  g.eventIndex = missionEvents.length;
  g.baseHp = g.baseMaxHp;
  g.barricadeVulnerable = true;
  g.barricadeMaxHp = Math.max(BARRICADE_MAX_HP, 8000);
  g.barricadeHp = g.barricadeMaxHp;
  g.energy = COMMAND_MAX;
  g.scrap = 200;
  g.fighters = [];
  g.corpses = [];
  g.enemySpawn = createEnemySpawnRuntime() as EnemySpawnRuntime;

  const lineup: readonly [UnitKind, Lane, number][] = [
    ["tky", 0, 350],
    ["mrs-chiha", 1, 295],
    ["miyamoto-musashi", 2, 370],
  ];
  for (const [kind, lane, x] of lineup) {
    spawnHuman(g, kind);
    const fighter = g.fighters[g.fighters.length - 1];
    fighter.lane = lane;
    fighter.anchorLane = lane;
    fighter.x = x;
    fighter.y = laneY(lane, fighter.id);
    fighter.spawnGrace = 0;
    fighter.combatReady = true;
    fighter.gateEntering = false;
    fighter.cooldown = 0;
  }

  const enemies: readonly [EnemyKind, Lane, number][] = [
    ["walker", 0, 470], ["walker", 0, 510], ["crusher", 0, 550],
    ["walker", 1, 500], ["walker", 1, 555], ["crusher", 1, 610],
    ["crusher", 2, 470],
  ];
  for (const [kind, lane, x] of enemies) {
    const target = spawnEnemy(g, kind, lane);
    target.x = x;
    target.y = laneY(lane, target.id);
    target.maxHp = 1600;
    target.hp = target.maxHp;
    target.speed = 0;
    target.laneSpeed = 0;
    target.damage = 0;
    target.cooldown = 99;
    target.combatReady = true;
    target.gateEntering = false;
  }
  g.banner = "QA NEW PLAYABLES // TKY + Mrs.チハ + 宮本武蔵";
  g.bannerTime = 1.4;
}

function prepareMayoQa(g: Game) {
  g.time = 60;
  g.phase = 2;
  g.wave = 4;
  g.eventIndex = missionEvents.length;
  g.baseHp = g.baseMaxHp;
  g.barricadeVulnerable = true;
  g.barricadeMaxHp = Math.max(BARRICADE_MAX_HP, 8000);
  g.barricadeHp = g.barricadeMaxHp;
  g.energy = COMMAND_MAX;
  g.scrap = 200;
  g.fighters = [];
  g.corpses = [];
  g.enemySpawn = createEnemySpawnRuntime() as EnemySpawnRuntime;
  g.manualAbilityReceipts = [];
  g.manualAbilityVfx = [];
  g.resolvedDefeatIds = new Set();

  spawnHuman(g, "mayo-chan");
  const mayo = g.fighters[g.fighters.length - 1];
  mayo.lane = 1;
  mayo.anchorLane = 1;
  mayo.x = 320;
  mayo.y = laneY(1, mayo.id);
  mayo.spawnGrace = 0;
  mayo.combatReady = true;
  mayo.gateEntering = false;
  mayo.cooldown = 0;

  for (const [index, x] of [410, 485, 560].entries()) {
    const target = spawnEnemy(g, index === 0 ? "runner" : "walker", 1);
    target.x = x;
    target.y = laneY(1, target.id);
    target.maxHp = 2400;
    target.hp = target.maxHp;
    target.speed = 0;
    target.laneSpeed = 0;
    target.damage = 0;
    target.cooldown = 99;
    target.combatReady = true;
    target.gateEntering = false;
  }
  g.banner = "QA MAYO-CHAN // NORMAL + 凶暴マヨ + 負傷退避";
  g.bannerTime = 1.4;
}

function emitBattleBark(g: Game, trigger: string, speakerKind: string, speakerId?: number | string) {
  const result = queueBattleBark({ runtime: g.battleBarks, event: { trigger, speakerKind, speakerId }, qa: g.qaBarks });
  g.battleBarks = result.runtime as BattleBarkRuntime;
  return result.shown;
}

function emitBattleBarkOnce(g: Game, flag: string, trigger: string, speakerKind: UnitKind) {
  if (g.barkFlags.includes(flag)) return false;
  const shown = emitBattleBark(g, trigger, speakerKind, speakerKind);
  if (shown) g.barkFlags.push(flag);
  return shown;
}

function emitStoryBattleBark(
  g: Game,
  eventId: string,
  trigger: string,
  mode: CampaignSave["settings"]["battleEventMode"],
) {
  const deployedKinds = [...new Set(g.fighters
    .filter((fighter) => fighter.side === "human" && fighter.hp > 0)
    .map((fighter) => fighter.kind))];
  const resolved = resolveStoryBattleBarkCue({
    state: g.storyBattleBarkState,
    eventId,
    trigger,
    deployedKinds,
  });
  g.storyBattleBarkState = resolved.state;
  const presentation = resolveStoryBattleBarkPresentation({
    cue: resolved.cue,
    eventId,
    trigger,
    readStoryEventIds: g.storyBattleReadEventIds,
    mode,
  });
  if (presentation.kind === "brief") {
    if (!g.storyBattleReceiptEventIds.includes(eventId)) g.storyBattleReceiptEventIds.push(eventId);
    g.banner = `通信 // ${presentation.label}`;
    g.bannerTime = Math.max(g.bannerTime, 1.8);
    return true;
  }
  if (presentation.kind !== "full" || !resolved.cue) return false;
  const queued = queueScriptedBattleBarkCue({ runtime: g.battleBarks, cue: resolved.cue });
  g.battleBarks = queued.runtime as BattleBarkRuntime;
  if (queued.queued && !g.storyBattleReceiptEventIds.includes(eventId)) {
    g.storyBattleReceiptEventIds.push(eventId);
  }
  return queued.queued;
}

function livingSpeaker(g: Game, kinds: readonly UnitKind[]) {
  return kinds.find((kind) => g.fighters.some((fighter) => fighter.side === "human" && fighter.kind === kind && fighter.hp > 0)) ?? null;
}

function battleSilenceSceneId(g: Game) {
  const scriptedFinalActive = g.battleBarks.active.some((bark) => (
    bark.scripted === true
    && bark.trigger === STORY_BATTLE_TRIGGER_IDS.FINAL_WEAKPOINT_EXPOSED
  ));
  if (scriptedFinalActive) return sceneIdForStoryEvent("stage-takuya-final-v070");
  if (g.takuyaEntranceAudioRemaining > 0) return TAKUYA_ENTRANCE_AUDIO.silenceSceneId;
  return null;
}

function dispatchScriptedStoryBattleBarks(
  g: Game,
  mode: CampaignSave["settings"]["battleEventMode"],
  newlyTriggeredEventIds: readonly string[] = [],
) {
  const stageId = g.definition.stageId;
  const activeEnemies = g.fighters.filter((fighter) => fighter.side === "zombie" && fighter.hp > 0 && fighter.combatReady);
  const boss = activeEnemies.find((fighter) => fighter.kind === "takuya");

  if (stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET) {
    if (livingSpeaker(g, ["brawler"])) {
      emitStoryBattleBark(g, "stage-nishijin-alert-v070", STORY_BATTLE_TRIGGER_IDS.DEPLOY, mode);
    }
    if (g.enemyKindsSeen.some((kind) => kind === "runner" || kind === "sprinter")) {
      emitStoryBattleBark(g, "stage-nishijin-alert-v070", STORY_BATTLE_TRIGGER_IDS.FAST_ENEMY, mode);
    }
    if (g.barricadeBucklingAnnounced) {
      emitStoryBattleBark(g, "stage-nishijin-alert-v070", STORY_BATTLE_TRIGGER_IDS.FRONTLINE_OPEN, mode);
    }
    if (activeEnemies.some((enemy) => activeEnemies.filter((candidate) => effectDistance(enemy, candidate) <= 86).length >= 3)) {
      emitStoryBattleBark(g, "stage-nishijin-alert-v070", STORY_BATTLE_TRIGGER_IDS.GROUPED_ENEMIES, mode);
    }
    return;
  }

  if (stageId === CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE) {
    if (g.time >= g.definition.prepSeconds) {
      emitStoryBattleBark(g, "stage-sawara-alert-v070", STORY_BATTLE_TRIGGER_IDS.CONVOY_START, mode);
    }
    if (g.enemyKindsSeen.some((kind) => kind === "crusher" || kind === "abomination")) {
      emitStoryBattleBark(g, "stage-sawara-alert-v070", STORY_BATTLE_TRIGGER_IDS.HEAVY_ENEMY, mode);
    }
    if (g.definition.defenseEndAt !== null && g.definition.defenseEndAt - g.time <= 30) {
      emitStoryBattleBark(g, "stage-sawara-alert-v070", STORY_BATTLE_TRIGGER_IDS.DEFENSE_30_REMAINING, mode);
    }
    if (g.baseHp / Math.max(1, g.baseMaxHp) <= .35) {
      emitStoryBattleBark(g, "stage-sawara-alert-v070", STORY_BATTLE_TRIGGER_IDS.CONVOY_CRITICAL, mode);
    }
    return;
  }

  if (stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE) {
    if (boss || g.enemySpawn.pending.some((entry) => entry.kind === "takuya")) {
      emitStoryBattleBark(g, "stage-takuya-warning-v070", STORY_BATTLE_TRIGGER_IDS.TAKUYA_ENTRANCE, mode);
    }
    const nearestHumanDistance = boss
      ? Math.min(...g.fighters
        .filter((fighter) => fighter.side === "human" && fighter.hp > 0)
        .map((fighter) => fighterDistance(boss, fighter)), Number.POSITIVE_INFINITY)
      : Number.POSITIVE_INFINITY;
    if (nearestHumanDistance <= 230) {
      emitStoryBattleBark(g, "stage-takuya-warning-v070", STORY_BATTLE_TRIGGER_IDS.TAKUYA_APPROACH, mode);
    }
    if (boss && boss.hp / Math.max(1, boss.maxHp) <= .5) {
      emitStoryBattleBark(g, "stage-takuya-warning-v070", STORY_BATTLE_TRIGGER_IDS.RIGHT_SHOULDER_EXPOSED, mode);
    }
    const criticalKumaverson = g.fighters.some((fighter) => (
      fighter.side === "human"
      && fighter.kind === "kumaverson"
      && fighter.hp > 0
      && fighter.hp / Math.max(1, fighter.maxHp) <= .28
    ));
    if (criticalKumaverson) {
      emitStoryBattleBark(g, "stage-takuya-warning-v070", STORY_BATTLE_TRIGGER_IDS.KUMAVERSON_CRITICAL, mode);
    }
    if (newlyTriggeredEventIds.includes("stage-takuya-final-v070")
      || (boss && boss.hp / Math.max(1, boss.maxHp) <= .25)) {
      emitStoryBattleBark(g, "stage-takuya-final-v070", STORY_BATTLE_TRIGGER_IDS.FINAL_WEAKPOINT_EXPOSED, mode);
    }
    if (g.bossDefeated && g.barricadeHp > 0) {
      emitStoryBattleBark(g, "stage-takuya-base-remains-v070", STORY_BATTLE_TRIGGER_IDS.BOSS_DEFEATED_BASE_REMAINS, mode);
    }
    return;
  }

  if (stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE) {
    if (g.enemyKindsSeen.includes("grappler")) {
      emitStoryBattleBark(g, "stage-station-gate-alert-v070", STORY_BATTLE_TRIGGER_IDS.GRAPPLER_SEEN, mode);
    }
    if (g.signalIds.includes(STORY_BATTLE_TRIGGER_IDS.GRAPPLER_GRAB)) {
      emitStoryBattleBark(g, "stage-station-gate-alert-v070", STORY_BATTLE_TRIGGER_IDS.GRAPPLER_GRAB, mode);
    }
    if (g.barricadeBucklingAnnounced) {
      emitStoryBattleBark(g, "stage-station-gate-alert-v070", STORY_BATTLE_TRIGGER_IDS.CONTAINER_EXPOSED, mode);
    }
    return;
  }

  if (stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM) {
    if (g.enemyKindsSeen.includes("ooze")) {
      emitStoryBattleBark(g, "stage-station-platform-alert-v070", STORY_BATTLE_TRIGGER_IDS.OOZE_SEEN, mode);
    }
    if (g.enemyKindsSeen.includes("sprinter")) {
      emitStoryBattleBark(g, "stage-station-platform-alert-v070", STORY_BATTLE_TRIGGER_IDS.SPRINTER_SEEN, mode);
    }
    if (g.signalIds.includes(STORY_BATTLE_TRIGGER_IDS.CART_STALLED)) {
      emitStoryBattleBark(g, "stage-station-platform-alert-v070", STORY_BATTLE_TRIGGER_IDS.CART_STALLED, mode);
    }
    return;
  }

  if (stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL) {
    for (const trigger of [
      STORY_BATTLE_TRIGGER_IDS.POWER_1_ACTIVATED,
      STORY_BATTLE_TRIGGER_IDS.GATE_EATER_CHARGE,
      STORY_BATTLE_TRIGGER_IDS.GATE_EATER_FLANK,
      STORY_BATTLE_TRIGGER_IDS.POWER_2_ACTIVATED,
      STORY_BATTLE_TRIGGER_IDS.RESEARCH_CONTAINER_EXPOSED,
      STORY_BATTLE_TRIGGER_IDS.POWER_3_ACTIVATED,
      STORY_BATTLE_TRIGGER_IDS.RETURN_WINDOW_OPEN,
    ]) {
      if (g.signalIds.includes(trigger)) {
        emitStoryBattleBark(g, "stage-station-tunnel-power-v070", trigger, mode);
      }
    }
  }
}

function dispatchSituationalBattleBarks(g: Game) {
  const livingAllies = g.fighters.filter((fighter) => fighter.side === "human" && fighter.hp > 0);
  const activeEnemies = g.fighters.filter((fighter) => fighter.side === "zombie" && fighter.hp > 0 && fighter.combatReady);
  if (!livingAllies.length) return;

  const injuredSelf = livingAllies.find((fighter) => fighter.hp / fighter.maxHp <= .62
    && ["brawler", "scout", "brute", "crazy-king", "kumaverson", "babayaga"].includes(fighter.kind));
  if (injuredSelf) emitBattleBarkOnce(g, `self-injured:${injuredSelf.kind}`, RANDOM_BATTLE_BARK_TRIGGER_IDS.SELF_INJURED, injuredSelf.kind as UnitKind);

  const injuredAlly = livingAllies.some((fighter) => fighter.hp / fighter.maxHp <= .55);
  if (injuredAlly && livingSpeaker(g, ["medic"])) emitBattleBarkOnce(g, "ally-injured", RANDOM_BATTLE_BARK_TRIGGER_IDS.ALLY_INJURED, "medic");

  const allyInDanger = livingAllies.some((fighter) => fighter.hp / fighter.maxHp <= .28);
  const dangerSpeaker = allyInDanger ? livingSpeaker(g, ["medic", "brawler", "ranger", "gunner", "kumaverson"]) : null;
  if (dangerSpeaker) emitBattleBarkOnce(g, "ally-danger", RANDOM_BATTLE_BARK_TRIGGER_IDS.ALLY_DANGER, dangerSpeaker);

  const fastSpeaker = g.enemyKindsSeen.some((kind) => kind === "runner" || kind === "sprinter")
    ? livingSpeaker(g, ["ranger", "scout"])
    : null;
  if (fastSpeaker) emitBattleBarkOnce(g, "fast-enemy", RANDOM_BATTLE_BARK_TRIGGER_IDS.FAST_ENEMY, fastSpeaker);

  const heavySeen = g.enemyKindsSeen.some((kind) => ["crusher", "abomination", "takuya", "grappler", "gate-eater"].includes(kind));
  if (heavySeen && livingSpeaker(g, ["brute"])) emitBattleBarkOnce(g, "heavy-enemy", RANDOM_BATTLE_BARK_TRIGGER_IDS.HEAVY_ENEMY, "brute");

  const specialSeen = g.enemyKindsSeen.some((kind) => isBabayagaPriorityTarget(kind));
  if (specialSeen && livingSpeaker(g, ["babayaga"])) emitBattleBarkOnce(g, "special-enemy", RANDOM_BATTLE_BARK_TRIGGER_IDS.SPECIAL_ENEMY, "babayaga");

  const grouped = activeEnemies.some((enemy) => activeEnemies.filter((candidate) => effectDistance(enemy, candidate) <= 86).length >= 3);
  if (grouped && livingSpeaker(g, ["crazy-king"])) emitBattleBarkOnce(g, "grouped-enemies", RANDOM_BATTLE_BARK_TRIGGER_IDS.GROUPED_ENEMIES, "crazy-king");

  if (g.baseHp / g.baseMaxHp <= .35 && livingSpeaker(g, ["babayaga"])) {
    emitBattleBarkOnce(g, "serious", RANDOM_BATTLE_BARK_TRIGGER_IDS.SERIOUS, "babayaga");
  }

  const victoryNear = (g.barricadeVulnerable && g.barricadeHp / Math.max(1, g.barricadeMaxHp) <= .2)
    || (g.definition.defenseEndAt !== null && g.definition.defenseEndAt - g.time <= 15);
  const victorySpeaker = victoryNear ? livingSpeaker(g, ["scout", "kumaverson", "babayaga"]) : null;
  if (victorySpeaker) emitBattleBarkOnce(g, "victory-near", RANDOM_BATTLE_BARK_TRIGGER_IDS.VICTORY_NEAR, victorySpeaker);
}

function placeQaSupply(g: Game, supplyKind: SupplyKind, lane: Lane, x: number) {
  const result = resolveBattlefieldSupplyPlacement({
    running: true, paused: false, over: false, scrap: g.scrap, supplyKind, lane, x,
    supplies: g.battlefieldObjects, objects: [], supports: [], areaEffects: g.areaEffects,
    nextId: g.nextId, nextAreaEffectId: g.nextAreaEffectId, laneCenters: activeLaneCenters, forbiddenZones: [],
  });
  if (!result.ok) return;
  g.scrap = result.scrap;
  g.battlefieldObjects = result.supplies.map((supply) => ({
    ...supply,
    hitFlash: "hitFlash" in supply && typeof supply.hitFlash === "number" ? supply.hitFlash : 0,
  })) as BattlefieldObject[];
  g.areaEffects = result.areaEffects as AreaEffect[];
  g.nextId = result.nextId;
  g.nextAreaEffectId = result.nextAreaEffectId;
}

function prepareSuppliesQa(g: Game) {
  g.time = 60; g.phase = 2; g.wave = 4; g.eventIndex = missionEvents.length;
  g.energy = COMMAND_MAX; g.scrap = 400; g.supportGauge = SUPPORT_GAUGE_MAX;
  placeQaSupply(g, "pod", 0, 430);
  placeQaSupply(g, "drum", 1, 535);
  placeQaSupply(g, "medical", 2, 640);
  for (const [kind, lane, x] of [["runner", 0, 445], ["walker", 1, 555], ["crusher", 2, 670]] as [EnemyKind, Lane, number][]) {
    const enemy = spawnEnemy(g, kind, lane); enemy.x = x; enemy.y = laneY(lane, enemy.id); enemy.cooldown = 1.8;
  }
  spawnHuman(g, "brute");
  const ally = g.fighters[g.fighters.length - 1]; ally.lane = 2; ally.anchorLane = 2; ally.x = 610; ally.y = laneY(2, ally.id); ally.hp = Math.round(ally.maxHp * .45); ally.spawnGrace = 0;
  g.banner = "QA SUPPLIES // POD · DRUM · MEDICAL"; g.bannerTime = 2.2;
}

function prepareAirstrikeQa(g: Game) {
  g.time = 60; g.phase = 2; g.wave = 4; g.eventIndex = missionEvents.length;
  g.energy = COMMAND_MAX; g.supportGauge = SUPPORT_GAUGE_MAX;
  for (const lane of [0, 1, 2] as Lane[]) {
    for (let index = 0; index < 3; index++) {
      const enemy = spawnEnemy(g, index === 2 ? "crusher" : "walker", lane, index);
      enemy.x = 500 + index * 22; enemy.y = laneY(lane, enemy.id); enemy.cooldown = 2;
    }
  }
  g.banner = "QA AIRSTRIKE // GAUGE READY"; g.bannerTime = 2.2;
}

function prepareCrawlerQa(g: Game) {
  prepareAirstrikeQa(g);
  g.supportGauge = 0;
  g.crawlerAbility = createCrawlerAbilityRuntime(1) as CrawlerRuntime;
  const boss = spawnEnemy(g, "takuya", 1); boss.x = 650; boss.y = laneY(1, boss.id); boss.abilityCooldown = 99;
  g.banner = "QA CRAWLER BARRAGE // READY"; g.bannerTime = 2.2;
}

function prepareStressQa(g: Game) {
  g.time = 60; g.phase = 2; g.wave = 4; g.eventIndex = missionEvents.length;
  g.energy = COMMAND_MAX; g.scrap = 999; g.supportGauge = SUPPORT_GAUGE_MAX;
  g.crawlerAbility = createCrawlerAbilityRuntime(1) as CrawlerRuntime;
  const supplyKinds: SupplyKind[] = ["pod", "drum", "medical"];
  for (const lane of [0, 1, 2] as Lane[]) {
    for (let index = 0; index < 5; index++) placeQaSupply(g, supplyKinds[(lane + index) % supplyKinds.length], lane, 280 + index * 110);
    for (let index = 0; index < 8; index++) {
      const kind: EnemyKind = index === 7 ? "crusher" : index % 3 === 0 ? "runner" : "walker";
      const enemy = spawnEnemy(g, kind, lane);
      enemy.x = 460 + index * 28; enemy.y = laneY(lane, enemy.id); enemy.cooldown = 1.8;
    }
  }
  const unitKinds: UnitKind[] = ["scout", "ranger", "brute", "brawler", "gunner", "medic", "crazy-king", "kumaverson", "babayaga", "guardian", "engineer"];
  for (let index = 0; index < 18; index++) {
    spawnHuman(g, unitKinds[index % unitKinds.length]);
    const fighter = g.fighters[g.fighters.length - 1];
    fighter.lane = (index % 3) as Lane; fighter.anchorLane = fighter.lane; fighter.x = 300 + (index % 6) * 55; fighter.y = laneY(fighter.lane, fighter.id); fighter.spawnGrace = 0;
  }
  g.banner = "QA STRESS // MASS DEPLOYMENT READY"; g.bannerTime = 2.2;
}

function prepareLifecycleQa(g: Game) {
  g.time = 72; g.phase = 2; g.wave = 4; g.eventIndex = missionEvents.length;
  g.energy = COMMAND_MAX; g.scrap = 300; g.supportGauge = SUPPORT_GAUGE_MAX;
  const addCorpse = (lifecycle: Record<string, unknown>, side: "human" | "zombie", kind: string, lane: Lane, x: number, variant: number) => {
    g.corpses.push({
      ...lifecycle,
      id: Number(lifecycle.id), x, y: laneY(lane, Number(lifecycle.id)), lane, side, kind,
      life: side === "human" ? 14 : 10, variant,
      prevented: lifecycle.infectionPrevented === true,
    } as Corpse);
  };

  const walkerId = g.nextId++;
  addCorpse(advanceEnemyLifecycle(beginEnemyDeath(createEnemyLifecycle({ id: walkerId, kind: "walker", lane: 0, x: 430, y: laneY(0), hp: 0 })), .18), "zombie", "walker", 0, 430, 0);
  const crusherId = g.nextId++;
  addCorpse(advanceEnemyLifecycle(beginEnemyDeath(createEnemyLifecycle({ id: crusherId, kind: "crusher", lane: 1, x: 520, y: laneY(1), hp: 0 })), 1.25), "zombie", "crusher", 1, 520, 1);
  const bossId = g.nextId++;
  addCorpse(advanceEnemyLifecycle(beginEnemyDeath(createEnemyLifecycle({ id: bossId, kind: "takuya", lane: 2, x: 650, y: laneY(2), hp: 0 })), 9.85), "zombie", "takuya", 2, 650, 2);

  const pasenId = g.nextId++;
  addCorpse(advanceAllyLifecycle(beginAllyDeath(createAllyLifecycle({ id: pasenId, kind: "brawler", inheritedKind: "brawler", lane: 0, x: 610, y: laneY(0), hp: 0 })), 7.2), "human", "brawler", 0, 610, 0);
  const rangerId = g.nextId++;
  const burningRanger = advanceAllyLifecycle(igniteAllyCorpsesInFire({
    lifecycles: [beginAllyDeath(createAllyLifecycle({ id: rangerId, kind: "ranger", inheritedKind: "ranger", lane: 1, x: 400, y: laneY(1), hp: 0 }))],
    fireAreas: [{ kind: "burn", phase: "active", remaining: 30, radius: 88, x: 400, y: laneY(1) }],
  }).lifecycles[0], .75);
  addCorpse(burningRanger, "human", "ranger", 1, 400, 1);
  g.areaEffects.push({ id: g.nextAreaEffectId++, kind: "burn", sourceSupplyId: -1, lane: 1, x: 400, y: laneY(1), radius: 88, amountPerSecond: 0, remaining: 30, phase: "active", slowMultiplier: 1 });

  const crazyKingId = g.nextId++;
  addCorpse(advanceAllyLifecycle(beginAllyDeath(createAllyLifecycle({ id: crazyKingId, kind: "crazy-king", inheritedKind: "crazy-king", lane: 0, x: 520, y: laneY(0), hp: 0 })), .7), "human", "crazy-king", 0, 520, 2);
  const kumaversonId = g.nextId++;
  addCorpse(advanceAllyLifecycle(beginAllyDeath(createAllyLifecycle({ id: kumaversonId, kind: "kumaverson", inheritedKind: "kumaverson", lane: 1, x: 620, y: laneY(1), hp: 0 })), 7.2), "human", "kumaverson", 1, 620, 0);
  const babayagaId = g.nextId++;
  const burningBabayaga = advanceAllyLifecycle(igniteAllyCorpsesInFire({
    lifecycles: [beginAllyDeath(createAllyLifecycle({ id: babayagaId, kind: "babayaga", inheritedKind: "babayaga", lane: 2, x: 460, y: laneY(2), hp: 0 }))],
    fireAreas: [{ kind: "burn", phase: "active", remaining: 30, radius: 88, x: 460, y: laneY(2) }],
  }).lifecycles[0], .75);
  addCorpse(burningBabayaga, "human", "babayaga", 2, 460, 1);
  g.areaEffects.push({ id: g.nextAreaEffectId++, kind: "burn", sourceSupplyId: -2, lane: 2, x: 460, y: laneY(2), radius: 88, amountPerSecond: 0, remaining: 30, phase: "active", slowMultiplier: 1 });
  g.banner = "QA 表現確認 // 死亡・感染・焼却"; g.bannerTime = 3;
}

function prepareStationQa(g: Game, state: "start" | "near-win" | "near-loss" | "boss-regression") {
  const spawnQaHuman = (kind: UnitKind) => {
    const card = spawnHuman(g, kind);
    return card ? g.fighters[g.fighters.length - 1] : null;
  };
  if (state === "start") {
    g.banner = `LOCAL QA // ${g.definition.displayName} START`;
    g.bannerTime = 2.2;
    return;
  }
  g.time = Math.max(PREP_SECONDS, g.definition.timeline.at(-1)?.at ?? PREP_SECONDS);
  g.phase = phaseForBattle(g.definition, g.time) as Game["phase"];
  g.eventIndex = g.definition.timeline.length;
  g.enemySpawn = createEnemySpawnRuntime() as EnemySpawnRuntime;
  g.energy = COMMAND_MAX;

  if (state === "boss-regression"
    && g.definition.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL) {
    g.stageMission = {
      ...g.stageMission,
      powerActivated: 3,
      powerHold: 0,
      gateEaterSeen: true,
      researchContainerExposed: true,
    };
    if (g.researchContainer) {
      g.researchContainer = {
        ...g.researchContainer,
        exposed: true,
      };
    }
    const boss = spawnEnemy(g, "gate-eater", 1);
    boss.hp = Math.ceil(boss.maxHp * .29);
    boss.x = 720;
    boss.y = laneY(1, boss.id);
    boss.combatReady = true;
    boss.gateEntering = false;
    boss.cooldown = 4;
    boss.spawnGrace = 0;
    for (const [index, kind] of (["brute", "ranger", "gunner"] as UnitKind[]).entries()) {
      const attacker = spawnQaHuman(kind);
      if (!attacker) continue;
      attacker.lane = 1;
      attacker.anchorLane = 1;
      attacker.x = 610 - index * 12;
      attacker.y = laneY(1, attacker.id);
      attacker.cooldown = 0;
      attacker.spawnGrace = 0;
    }
    g.banner = `LOCAL QA // 改札喰い ${boss.hp}/${boss.maxHp} HP REGRESSION`;
    g.bannerTime = 3;
    return;
  }

  if (state === "near-loss") {
    if (g.definition.missionType === "escort") {
      g.stageMission = {
        ...g.stageMission,
        progress: .5,
        integrity: 1,
      };
      const threat = spawnEnemy(g, "walker", 1);
      threat.x = escortCartX(g.stageMission, g.definition.missionConfig);
      threat.y = laneY(1, threat.id);
      threat.cooldown = 5;
    } else {
      g.baseHp = 1;
      const attacker = spawnEnemy(g, "walker", 1);
      attacker.x = BASE_X + 18;
      attacker.y = laneY(1, attacker.id);
      attacker.cooldown = 0;
    }
    g.banner = `LOCAL QA // ${g.definition.displayName} NEAR LOSS`;
    g.bannerTime = 2.2;
    return;
  }

  g.baseHp = g.baseMaxHp;
  if (g.definition.missionType === "assault") {
    g.barricadeVulnerable = true;
    g.barricadeHp = 1;
    const finisher = spawnQaHuman("brute");
    if (finisher) {
      finisher.lane = 1;
      finisher.anchorLane = 1;
      finisher.x = BARRICADE_X - 34;
      finisher.y = laneY(1, finisher.id);
      finisher.cooldown = 0;
      finisher.spawnGrace = 0;
    }
  } else if (g.definition.missionType === "escort") {
    g.stageMission = {
      ...g.stageMission,
      progress: .999,
      integrity: g.stageMission.maxIntegrity,
      repairRemaining: 0,
      contaminated: false,
      stalled: false,
    };
    for (const [index, kind] of (["brawler", "ranger", "medic"] as UnitKind[]).entries()) {
      const escort = spawnQaHuman(kind);
      if (escort) {
        escort.lane = 1;
        escort.anchorLane = 1;
        escort.x = escortCartX(g.stageMission, g.definition.missionConfig) - 32 - index * 26;
        escort.y = laneY(1, escort.id);
        escort.cooldown = 4;
        escort.spawnGrace = 0;
      }
    }
  } else if (g.definition.missionType === "sequential-seal") {
    if (g.researchContainer) {
      g.researchContainer = {
        ...g.researchContainer,
        x: Number(g.definition.missionConfig.sealDoorX ?? 867) + 24,
        exposed: true,
        contained: true,
      };
    }
    g.stageMission = {
      ...g.stageMission,
      powerActivated: 3,
      powerHold: 0,
      gateEaterSeen: true,
      gateEaterDefeated: true,
      gateEaterContained: true,
      researchContainerExposed: true,
      researchContainerContained: true,
      sealed: true,
      escapeRemaining: .35,
      returnTargetCount: 1,
      returnedCount: 1,
    };
    const returning = spawnQaHuman("brawler");
    if (returning) {
      returning.lane = 1;
      returning.anchorLane = 1;
      returning.x = Number(g.definition.missionConfig.returnX ?? BASE_X + 115);
      returning.y = laneY(1, returning.id);
      returning.cooldown = 4;
      returning.spawnGrace = 0;
    }
  }
  g.banner = `LOCAL QA // ${g.definition.displayName} NEAR WIN`;
  g.bannerTime = 2.2;
}

function prepareQaMode(g: Game, qaMode: QaMode | null) {
  g.qaBarks = qaMode !== null && qaMode !== "loadout";
  if (qaMode === "roles" || qaMode === "dialogue") prepareRolesQa(g);
  else if (qaMode === "zakimiya") prepareZakimiyaQa(g);
  else if (qaMode === "new-playables") prepareNewPlayablesQa(g);
  else if (qaMode === "mayo") prepareMayoQa(g);
  else if (qaMode === "takuya-entrance") prepareTakuyaEntranceQa(g);
  else if (qaMode === "endgame") prepareEndgameQa(g);
  else if (qaMode === "ai-reacquire") prepareAiReacquireQa(g);
  else if (qaMode === "supplies") prepareSuppliesQa(g);
  else if (qaMode === "airstrike") prepareAirstrikeQa(g);
  else if (qaMode === "crawler") prepareCrawlerQa(g);
  else if (qaMode === "stress") prepareStressQa(g);
  else if (qaMode === "lifecycle") prepareLifecycleQa(g);
  if (qaMode === "dialogue") {
    const first = g.fighters.find((fighter) => fighter.side === "human");
    if (first) emitBattleBark(g, "role-cue", first.kind, first.id);
  }
}

function prepareManualAbilityProof(g: Game, requestedKinds: readonly UnitKind[]) {
  const kinds = requestedKinds.filter((kind) => (
    MANUAL_ABILITY_REGISTRY[kind]?.runtimeStatus === "integrated"
  ));
  if (kinds.length === 0) throw new Error("Manual ability proof requires at least one integrated unit");
  g.time = 60;
  g.phase = 2;
  g.wave = 4;
  g.eventIndex = g.definition.timeline.length;
  g.running = true;
  g.over = false;
  g.won = false;
  g.survivalRun = null;
  g.survivalRuntime = null;
  g.survivalCheckpointReceipt = null;
  g.baseHp = g.baseMaxHp;
  g.barricadeVulnerable = true;
  g.barricadeMaxHp = Math.max(BARRICADE_MAX_HP, 12000);
  g.barricadeHp = g.barricadeMaxHp;
  g.energy = COMMAND_MAX;
  g.scrap = 200;
  g.fighters = [];
  g.corpses = [];
  g.enemySpawn = createEnemySpawnRuntime() as EnemySpawnRuntime;
  g.deployQueue = [];
  g.pendingWeaponHits = [];
  g.areaEffects = [];
  g.manualAbilityVfx = [];
  g.manualAbilityReceipts = [];
  g.pendingAbilityAudioCues = [];
  g.battleBarks = createBattleBarkRuntime() as BattleBarkRuntime;
  g.qaBarks = false;
  g.banner = "";
  g.bannerTime = 0;

  const owners: Fighter[] = [];
  const rosterProof = kinds.length > 4;
  for (const [index, kind] of kinds.entries()) {
    const lane = (index % 3) as Lane;
    const column = Math.floor(index / 3);
    const x = rosterProof ? 260 + column * 78 : 300;
    spawnHuman(g, kind);
    const fighter = g.fighters[g.fighters.length - 1];
    fighter.lane = lane;
    fighter.anchorLane = lane;
    fighter.x = x;
    fighter.y = laneY(lane, fighter.id);
    fighter.spawnGrace = 0;
    fighter.combatReady = true;
    fighter.gateEntering = false;
    fighter.speed = 0;
    fighter.laneSpeed = 0;
    fighter.cooldown = 99;
    fighter.supportCooldown = 99;
    fighter.aiMoveDirection = 1;
    fighter.manualAbility = createManualAbilityRuntime(kind) as ManualAbilityRuntime;
    owners.push(fighter);

    if (!rosterProof && kind !== "medic") {
      const targetKind: EnemyKind = kind === "scout"
        ? "runner"
        : kind === "engineer"
          ? "runner"
          : kind === "ranger" || kind === "babayaga"
            ? "spitter"
            : kind === "brute"
              ? "crusher"
              : "walker";
      const target = spawnEnemy(g, targetKind, lane);
      target.x = Math.min(825, x + 92);
      target.y = fighter.y;
      target.maxHp = 2400;
      target.hp = target.maxHp;
      target.speed = 0;
      target.laneSpeed = 0;
      target.damage = 0;
      target.cooldown = 99;
      target.abilityCooldown = 99;
      target.combatReady = true;
      target.gateEntering = false;
      target.targetId = null;
      target.retargetIn = 99;
      if (kind === "brawler" || kind === "engineer") {
        const nearby = spawnEnemy(g, "walker", lane);
        nearby.x = Math.min(825, x + (kind === "engineer" ? 58 : 72));
        nearby.y = fighter.y;
        nearby.maxHp = 2400;
        nearby.hp = nearby.maxHp;
        nearby.speed = 0;
        nearby.laneSpeed = 0;
        nearby.damage = 0;
        nearby.cooldown = 99;
        nearby.abilityCooldown = 99;
        nearby.combatReady = true;
        nearby.gateEntering = false;
        nearby.targetId = null;
        nearby.retargetIn = 99;
      }
    }
  }

  if (rosterProof) {
    for (const lane of [0, 1, 2] as const) {
      for (const [targetKind, x] of [["runner", 350], ["spitter", 500], ["crusher", 650]] as const) {
        const target = spawnEnemy(g, targetKind, lane);
        target.x = x;
        target.y = activeLaneCenters[lane];
        target.maxHp = 7200;
        target.hp = target.maxHp;
        target.speed = 0;
        target.laneSpeed = 0;
        target.damage = 0;
        target.cooldown = 99;
        target.abilityCooldown = 99;
        target.combatReady = true;
        target.gateEntering = false;
        target.targetId = null;
        target.retargetIn = 99;
      }
    }
  }

  const medic = owners.find((fighter) => fighter.kind === "medic");
  if (medic) {
    let wounded = owners
      .filter((fighter) => fighter.id !== medic.id)
      .sort((left, right) => fighterDistance(left, medic) - fighterDistance(right, medic) || left.id - right.id)[0];
    if (!wounded) {
      spawnHuman(g, "scout");
      wounded = g.fighters[g.fighters.length - 1];
      wounded.lane = medic.lane;
      wounded.anchorLane = medic.lane;
      wounded.x = medic.x + 54;
      wounded.y = medic.y;
      wounded.spawnGrace = 0;
      wounded.combatReady = true;
      wounded.gateEntering = false;
      wounded.speed = 0;
      wounded.laneSpeed = 0;
      wounded.cooldown = 99;
    }
    wounded.hp = Math.max(1, wounded.maxHp * .24);
  }
  g.banner = "";
  g.bannerTime = 0;
  return {
    ownerIds: owners.map(({ id }) => id),
    kinds: owners.map(({ kind }) => kind as UnitKind),
  };
}

function spriteDisplaySize(kind: string) {
  return spriteBattleDisplaySizeFor(kind);
}

function compactSpriteScale(kind: string) {
  if (!compactBattleViewport()) return 1;
  return kind === "mother" ? 1.06 : COMPACT_BATTLE_SPRITE_SCALE;
}

// Asset-load diagnostic fallback only. Normal production rendering resolves
// both late-game roles through manifest-backed approved atlases.
function drawDiagnosticRoleFighter(ctx: CanvasRenderingContext2D, f: Fighter) {
  if (f.kind !== "guardian" && f.kind !== "engineer") return;
  const guardian = f.kind === "guardian";
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.fillStyle = "rgba(0,0,0,.42)";
  ctx.beginPath(); ctx.ellipse(0, 8, guardian ? 24 : 18, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = guardian ? "#48575b" : "#806b3e";
  ctx.strokeStyle = f.flash > 0 ? "#fff1ad" : guardian ? "#aebfc1" : "#d5bd78";
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (guardian) {
    ctx.roundRect(-19, -69, 38, 66, 10);
  } else {
    ctx.roundRect(-14, -61, 28, 58, 8);
  }
  ctx.fill(); ctx.stroke();
  if (guardian) {
    ctx.fillStyle = "#2c3538"; ctx.strokeStyle = "#d1dadd"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(5, -62, 27, 55, 7); ctx.fill(); ctx.stroke();
  } else {
    ctx.strokeStyle = "#e1c978"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-20, -43); ctx.lineTo(21, -21); ctx.stroke();
    ctx.beginPath(); ctx.arc(23, -20, 6, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = "#fff4d4";
  ctx.font = "900 13px monospace";
  ctx.textAlign = "center";
  ctx.fillText(guardian ? "G" : "M", guardian ? -2 : 0, -35);
  ctx.restore();
}

// Asset-load diagnostic fallback only. Normal production rendering resolves
// station enemies through manifest-backed approved atlases.
function drawDiagnosticStationEnemy(ctx: CanvasRenderingContext2D, f: Fighter) {
  if (!["grappler", "ooze", "sprinter", "gate-eater"].includes(f.kind)) return;
  const gateEater = f.kind === "gate-eater";
  const grappler = f.kind === "grappler";
  const ooze = f.kind === "ooze";
  const color = gateEater ? "#635f54" : grappler ? "#625044" : ooze ? "#4c5d47" : "#655047";
  const accent = gateEater ? "#e0b35c" : grappler ? "#d68c68" : ooze ? "#a7c071" : "#e2a76f";
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.fillStyle = "rgba(0,0,0,.46)";
  ctx.beginPath(); ctx.ellipse(0, 8, gateEater ? 38 : ooze ? 25 : 20, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.strokeStyle = f.flash > 0 ? "#fff1ad" : accent;
  ctx.lineWidth = gateEater ? 4 : 3;
  if (gateEater) {
    ctx.beginPath(); ctx.roundRect(-38, -84, 76, 78, 8); ctx.fill(); ctx.stroke();
    for (const offset of [-24, 0, 24]) {
      ctx.beginPath(); ctx.moveTo(offset, -76); ctx.lineTo(offset, -12); ctx.stroke();
    }
    ctx.fillStyle = "#332d28"; ctx.fillRect(-25, -66, 50, 28);
  } else if (ooze) {
    ctx.beginPath();
    ctx.moveTo(-25, -10); ctx.quadraticCurveTo(-21, -55, 0, -58);
    ctx.quadraticCurveTo(22, -52, 25, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (const offset of [-16, 0, 15]) {
      ctx.beginPath(); ctx.moveTo(offset, -7); ctx.quadraticCurveTo(offset + 4, 2, offset + 1, 8); ctx.stroke();
    }
  } else {
    ctx.beginPath();
    if (f.kind === "sprinter") {
      ctx.moveTo(-10, -66); ctx.lineTo(20, -45); ctx.lineTo(10, -4); ctx.lineTo(-18, -10); ctx.closePath();
    } else {
      ctx.roundRect(-15, -70, 30, 66, 9);
    }
    ctx.fill(); ctx.stroke();
    ctx.lineWidth = grappler ? 7 : 4;
    ctx.beginPath();
    if (grappler) {
      ctx.moveTo(-10, -53); ctx.lineTo(-38, -27); ctx.lineTo(-48, -2);
      ctx.moveTo(10, -53); ctx.lineTo(38, -27); ctx.lineTo(48, -2);
    } else {
      ctx.moveTo(-6, -10); ctx.lineTo(-24, 4);
      ctx.moveTo(8, -8); ctx.lineTo(28, 1);
    }
    ctx.stroke();
  }
  ctx.fillStyle = "#fff4d4";
  ctx.font = `900 ${gateEater ? 17 : 14}px monospace`;
  ctx.textAlign = "center";
  ctx.fillText(gateEater ? "改" : grappler ? "絡" : ooze ? "泥" : "走", 0, gateEater ? -46 : -32);
  ctx.restore();
}

function drawMonkeyTrap(ctx: CanvasRenderingContext2D, fighter: Fighter) {
  if (fighter.kind !== "engineer" || !fighter.engineerTrapReady || fighter.engineerTrapLane === null) return;
  const trapProfile = weaponProfileForAction("engineer", "deploy");
  const x = fighter.engineerTrapX;
  const y = activeLaneCenters[fighter.engineerTrapLane] + 5;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,.45)";
  ctx.beginPath(); ctx.ellipse(0, 3, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = trapProfile.trailColor; ctx.fillStyle = "#5b5335"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-14, -7, 28, 10, 3); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = .28;
  ctx.beginPath(); ctx.arc(0, -2, trapProfile.impactRadius, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
  for (const offset of [-9, 0, 9]) {
    ctx.beginPath(); ctx.moveTo(offset - 3, -7); ctx.lineTo(offset, -15); ctx.lineTo(offset + 3, -7); ctx.stroke();
  }
  ctx.restore();
}

function drawSpriteFighter(ctx: CanvasRenderingContext2D, f: Fighter, sprites: SpriteMap) {
  const mayoFeral = f.kind === "mayo-chan"
    && (f.manualAbility?.phase === "feral" || f.mayoRetreat?.reason === "ability");
  const renderKind = mayoFeral ? "mayo-chan-feral" : f.kind;
  const sprite = sprites[renderKind];
  if (!sprite?.complete || !sprite.naturalWidth) {
    drawDiagnosticRoleFighter(ctx, f);
    drawDiagnosticStationEnemy(ctx, f);
    return;
  }
  const moving = f.mayoRetreat?.phase === "run"
    || f.gateEntering
    || f.side === "zombie"
    || Math.abs(f.aiMoveDirection) > .05;
  const attackDuration = f.kind === "mrs-chiha" && f.attackVariant === "launcher-bash"
    ? mrsChihaLauncherBashDuration()
    : attackPresentationDuration(f.kind);
  const manualAbilityActive = f.side === "human" && manualAbilityLocksNormalAction(f.manualAbility);
  const manualAbilityDefinition = manualAbilityActive ? MANUAL_ABILITY_REGISTRY[f.kind] : null;
  const manualAbilityElapsed = !manualAbilityActive || !manualAbilityDefinition
    ? 0
    : f.manualAbility?.phase === "windup"
      ? Math.max(0, manualAbilityDefinition.windupSeconds - f.manualAbility.windupRemaining)
      : f.kind === "mrs-chiha"
        ? Math.max(0, f.manualAbility?.abilityElapsed ?? 0)
        : f.kind === "miyamoto-musashi" && f.manualAbility?.phase === "guard"
          ? manualAbilityDefinition.windupSeconds
            + ((manualAbilityDefinition.guardSeconds - f.manualAbility.guardRemaining) % .36)
          : f.step;
  const anomalyTuning = isBossAnomalyKind(f.kind)
    ? BOSS_ANOMALY_TUNING[f.kind as keyof typeof BOSS_ANOMALY_TUNING]
    : null;
  const animationSample = f.mayoRetreat
    ? sampleAnimationClip("mayo-chan", mayoRetreatSpriteState(f.mayoRetreat), f.mayoRetreat.phaseElapsed)
    : manualAbilityActive
    ? sampleAnimationClip(f.kind, "special", manualAbilityElapsed)
    : f.kind === "kurome" && ["tracking", "locked"].includes(f.stationAbility.phase)
      ? sampleAnimationClip(f.kind, "wind-up", KUROME_PROTOTYPE_TUNING.warningSeconds - f.stationAbility.remainingSeconds)
      : f.kind === "kurome" && f.stationAbility.phase === "firing"
        ? sampleAnimationClip(f.kind, "active", KUROME_PROTOTYPE_TUNING.fireSeconds - f.stationAbility.remainingSeconds)
    : f.kind === "kurome" && f.stationAbility.phase === "recovery"
      ? sampleAnimationClip(f.kind, "recovery", KUROME_PROTOTYPE_TUNING.recoverySeconds - f.stationAbility.remainingSeconds)
    : anomalyTuning && f.stationAbility.phase === "warning"
      ? sampleAnimationClip(
        f.kind,
        "wind-up",
        anomalyTuning.warningSeconds - f.stationAbility.remainingSeconds,
      )
    : anomalyTuning && f.stationAbility.phase === "active"
      ? sampleAnimationClip(
        f.kind,
        "active",
        anomalyTuning.activeSeconds - f.stationAbility.remainingSeconds,
      )
    : anomalyTuning && f.stationAbility.phase === "recovery"
      ? sampleAnimationClip(
        f.kind,
        "recovery",
        anomalyTuning.recoverySeconds - f.stationAbility.remainingSeconds,
      )
    : isV090InfectedKind(f.kind) && f.stationAbility.phase === "warning"
      ? sampleAnimationClip(
        f.kind,
        "wind-up",
        Math.max(0, (v090InfectedDefinition(f.kind)?.warningSeconds ?? 0) - f.stationAbility.remainingSeconds),
      )
      : isV090InfectedKind(f.kind) && f.stationAbility.phase === "active"
        ? sampleAnimationClip(
          f.kind,
          "active",
          Math.max(0, (v090InfectedDefinition(f.kind)?.activeSeconds ?? 0) - f.stationAbility.remainingSeconds),
        )
        : isV090InfectedKind(f.kind) && f.stationAbility.phase === "recovery"
          ? sampleAnimationClip(
            f.kind,
            "recovery",
            Math.max(0, (v090InfectedDefinition(f.kind)?.recoverySeconds ?? 0) - f.stationAbility.remainingSeconds),
          )
    : f.flash > 0
    ? sampleAnimationClip(f.kind, "hit", Math.max(0, .12 - f.flash))
    : f.abilityWindup > 0
      ? sampleAnimationClip(f.kind, "wind-up", Math.max(0, .24 - f.abilityWindup))
      : f.attack > 0
        ? f.kind === "mrs-chiha" && f.attackVariant === "launcher-bash"
          ? sampleMrsChihaLauncherBash(Math.max(0, attackDuration - f.attack))
          : sampleAttackPresentation(f.kind, Math.max(0, attackDuration - f.attack))
        : moving
          ? sampleAnimationClip(f.kind, "move", f.step)
          : sampleAnimationClip(f.kind, "idle", f.step);
  const state = animationSample.spriteState;
  const lockedDirection = Number(f.manualAbility?.target?.direction);
  const direction = f.side === "human"
    ? (manualAbilityActive && lockedDirection < 0) || (!manualAbilityActive && f.aiMoveDirection < -.05) ? "left" : "right"
    : "left";
  const frame = spriteFrameFor(renderKind, state, direction);
  const authoredSize = fitSpriteBattleDisplaySize(renderKind, frame, spriteDisplaySize(renderKind));
  const compactScale = compactSpriteScale(renderKind);
  const depthScale = activeBattlefieldDepthScale(f.y);
  const size = {
    w: authoredSize.w * compactScale * depthScale * animationSample.bodyScale,
    h: authoredSize.h * compactScale * depthScale * animationSample.bodyScale,
  };
  const bob = animationSample.movement ? Math.abs(Math.sin(f.step * 7)) * 1.1 : 0;
  ctx.save();
  if (f.side === "human"
    && f.gateEntering
    && f.spawnPortalId === "crawler-door"
    && f.entryRampCleared !== true) {
    const revealLeft = WORLD_GEOMETRY.crawler.doorX - 24;
    const revealRight = Math.max(
      WORLD_GEOMETRY.crawler.doorX + 25,
      Math.min(
        (f.entryRampX ?? WORLD_GEOMETRY.crawler.rampFootX) + size.w * .55,
        f.x + size.w * .55,
      ),
    );
    ctx.beginPath();
    ctx.rect(
      revealLeft,
      activeMusterY() - 108,
      revealRight - revealLeft,
      128,
    );
    ctx.clip();
  } else if (f.side === "zombie" && f.gateEntering) {
    const revealRight = f.spawnEntryMode === "right-edge"
      || f.spawnEntryMode === "right-edge-outside"
      ? W
      : ENEMY_GATE_SPAWN.revealX;
    ctx.beginPath();
    ctx.rect(0, 0, revealRight, H);
    ctx.clip();
  }
  ctx.fillStyle = "rgba(0,0,0,.42)";
  ctx.beginPath();
  ctx.ellipse(f.x, f.y + 5 * depthScale, size.w * .27, 4.5 * depthScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.imageSmoothingEnabled = true;
  if (f.flash > 0) {
    ctx.globalAlpha = .7;
    ctx.shadowColor = "#fff1ad";
    ctx.shadowBlur = 16;
  } else if (compactScale > 1) {
    ctx.shadowColor = "rgba(0,0,0,.9)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
  }
  ctx.translate(f.x, f.y - bob);
  if (frame.flipX) ctx.scale(-1, 1);
  ctx.drawImage(
    sprite,
    frame.sourceRect.x,
    frame.sourceRect.y,
    frame.sourceRect.w,
    frame.sourceRect.h,
    -size.w * frame.anchorX,
    -size.h * frame.anchorY,
    size.w,
    size.h,
  );
  ctx.restore();
}

function drawAreaEffect(ctx: CanvasRenderingContext2D, effect: AreaEffect, time: number) {
  if (effect.phase === "expired") return;
  ctx.save();
  ctx.translate(effect.x, effect.y);
  if (effect.kind === "healing") {
    const pulse = effect.radius * (.88 + Math.sin(time * 4) * .035);
    ctx.strokeStyle = "rgba(105,226,155,.44)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, pulse, pulse * .34, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(68,170,113,.08)"; ctx.fill();
  } else {
    const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, effect.radius);
    glow.addColorStop(0, "rgba(255,207,76,.58)"); glow.addColorStop(.4, "rgba(230,83,35,.35)"); glow.addColorStop(1, "rgba(120,24,13,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(0, 0, effect.radius, effect.radius * .34, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 6; i++) {
      const fx = (i - 2.5) * 15 + Math.sin(time * 8 + i) * 5;
      const fy = -8 - Math.abs(Math.sin(time * 6 + i * 1.7)) * 19;
      ctx.fillStyle = i % 2 ? "#ffb33f" : "#e64e29";
      ctx.beginPath(); ctx.arc(fx, fy, 4 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawManualAbilityVfx(ctx: CanvasRenderingContext2D, effect: ManualAbilityVfx) {
  const progress = Math.max(0, Math.min(1, effect.elapsed / Math.max(.001, effect.duration)));
  const windup = Math.max(.001, effect.windupSeconds ?? effect.duration);
  const charge = Math.max(0, Math.min(1, effect.elapsed / windup));
  const impactAge = Math.max(0, effect.elapsed - windup);
  if (effect.kind === "brawler") {
    const direction = effect.targetX >= effect.originX ? 1 : -1;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let index = 0; index < 5; index += 1) {
      const local = Math.max(0, Math.min(1, charge * 1.55 - index * .13));
      if (local <= 0) continue;
      const startX = effect.originX + direction * (10 + index * 3);
      const startY = effect.originY + (index % 2 ? 13 : -9);
      const endX = effect.targetX - direction * (8 - index * 2);
      const endY = effect.targetY + (index % 2 ? -11 : 10);
      ctx.globalAlpha = .32 + local * .58;
      ctx.strokeStyle = index === 4 ? "#fff1a8" : "#f3a943";
      ctx.shadowColor = "#d96b26";
      ctx.shadowBlur = 8;
      ctx.lineWidth = index === 4 ? 5 : 2.5;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(
        (startX + endX) / 2,
        (startY + endY) / 2 + (index % 2 ? -20 : 20),
        startX + (endX - startX) * local,
        startY + (endY - startY) * local,
      );
      ctx.stroke();
    }
    if (impactAge > 0) {
      const tail = Math.max(0, 1 - impactAge / .52);
      ctx.globalAlpha = tail;
      ctx.translate(effect.targetX, effect.targetY);
      ctx.strokeStyle = "#ffd36d";
      ctx.lineWidth = 3;
      for (let ray = 0; ray < 10; ray += 1) {
        const angle = ray / 10 * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 8, Math.sin(angle) * 8);
        ctx.lineTo(Math.cos(angle) * (25 + impactAge * 38), Math.sin(angle) * (16 + impactAge * 22));
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }
  if (effect.kind === "scout") {
    const direction = effect.targetX >= effect.originX ? 1 : -1;
    const dashX = effect.originX + (effect.targetX - effect.originX) * charge;
    const dashY = effect.originY + (effect.targetY - effect.originY) * charge;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let trail = 0; trail < 4; trail += 1) {
      ctx.globalAlpha = .7 - trail * .13;
      ctx.strokeStyle = trail % 2 ? "#9cf4ec" : "#36b8b5";
      ctx.lineWidth = 5 - trail * .8;
      ctx.beginPath();
      ctx.moveTo(dashX - direction * (18 + trail * 14), dashY + trail * 6 - 10);
      ctx.lineTo(dashX - direction * (2 + trail * 3), dashY - trail * 2);
      ctx.stroke();
    }
    ctx.translate(effect.targetX, effect.targetY);
    ctx.strokeStyle = "#c9fff5";
    ctx.shadowColor = "#42d8d0";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-direction * 3, -8, 25 + impactAge * 18, direction > 0 ? -1.6 : Math.PI - 1.6, direction > 0 ? .8 : Math.PI + .8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(direction * 16, -26);
    ctx.lineTo(direction * 29, -12);
    ctx.lineTo(direction * 20, -4);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (effect.kind === "ranger") {
    const tail = Math.max(0, 1 - impactAge / .5);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(effect.targetX, effect.targetY);
    ctx.strokeStyle = "#bdeaff";
    ctx.shadowColor = "#62b9d6";
    ctx.shadowBlur = 9;
    ctx.lineWidth = 2;
    const radius = 24 - charge * 8 + impactAge * 26;
    ctx.globalAlpha = impactAge > 0 ? tail : .45 + charge * .5;
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * (radius + 5), Math.sin(angle) * (radius + 5));
      ctx.lineTo(Math.cos(angle) * (radius + 16), Math.sin(angle) * (radius + 16));
      ctx.stroke();
    }
    if (impactAge > 0) {
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = tail;
      ctx.strokeStyle = "#f7fbff";
      ctx.shadowColor = "#8bd9f0";
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(effect.originX, effect.originY);
      ctx.lineTo(effect.targetX, effect.targetY);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (effect.kind === "medic") {
    const tail = Math.max(0, 1 - impactAge / .55);
    ctx.save();
    ctx.translate(effect.targetX, effect.targetY);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = impactAge > 0 ? tail : .4 + charge * .55;
    ctx.strokeStyle = "#89efb4";
    ctx.fillStyle = "rgba(68,181,119,.2)";
    ctx.shadowColor = "#48c485";
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3;
    const ring = 18 + (impactAge > 0 ? impactAge * 58 : (1 - charge) * 20);
    ctx.beginPath(); ctx.ellipse(0, 18, ring, ring * .32, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#d7ffe6";
    ctx.fillRect(-5, -31, 10, 34);
    ctx.fillRect(-17, -19, 34, 10);
    ctx.strokeStyle = "#b1ffd1";
    ctx.beginPath();
    for (let turn = 0; turn <= 22; turn += 1) {
      const angle = turn * .45 + effect.elapsed * 5;
      const x = Math.cos(angle) * (12 + turn * .35);
      const y = 19 - turn * 2.3;
      if (turn === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (effect.kind === "brute") {
    const direction = effect.targetX >= effect.originX ? 1 : -1;
    const tail = Math.max(0, 1 - impactAge / .55);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "#e3b477";
    ctx.shadowColor = "#9f653e";
    ctx.shadowBlur = 9;
    ctx.lineWidth = 5;
    ctx.globalAlpha = impactAge > 0 ? tail : .45 + charge * .45;
    ctx.beginPath();
    ctx.arc(effect.originX, effect.originY, 52, direction > 0 ? -2.4 : -.74, direction > 0 ? .25 : Math.PI + 2.9);
    ctx.stroke();
    if (impactAge > 0) {
      ctx.translate(effect.targetX, effect.targetY);
      ctx.lineWidth = 3;
      for (let crack = 0; crack < 8; crack += 1) {
        const angle = Math.PI + crack / 7 * Math.PI;
        const length = 38 + (crack % 3) * 14 + impactAge * 42;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * length * .45, Math.sin(angle) * length * .18);
        ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length * .35);
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }
  if (effect.kind === "crazy-king") {
    ctx.save();
    ctx.translate(effect.originX, effect.originY + 34);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "#ff803d";
    ctx.shadowColor = "#d43a20";
    ctx.shadowBlur = 14;
    ctx.lineWidth = 4;
    const radius = 34 + Math.sin(effect.elapsed * 15) * 4;
    ctx.beginPath();
    for (let tooth = 0; tooth <= 24; tooth += 1) {
      const angle = tooth / 24 * Math.PI * 2 + effect.elapsed * 2.4;
      const toothRadius = radius + (tooth % 2 ? 9 : 0);
      const x = Math.cos(angle) * toothRadius;
      const y = Math.sin(angle) * toothRadius * .34;
      if (tooth === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
    ctx.strokeStyle = "#ffd26a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-18, -48); ctx.lineTo(-9, -61); ctx.lineTo(0, -48); ctx.lineTo(10, -64); ctx.lineTo(20, -48);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (effect.kind === "kumaverson") {
    ctx.save();
    ctx.translate(effect.originX, effect.originY + 28);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "#f0bd61";
    ctx.fillStyle = "rgba(66,90,98,.18)";
    ctx.shadowColor = "#cf8d38";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -24, 33, Math.PI, Math.PI * 2);
    ctx.lineTo(33, 2); ctx.lineTo(-33, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -24, 20, 7, 0, 0, Math.PI * 2); ctx.stroke();
    for (const angle of [-.75, -.25, .25, .75]) {
      ctx.beginPath();
      ctx.moveTo(Math.sin(angle) * 30, -19);
      ctx.lineTo(Math.sin(angle) * (47 + Math.sin(effect.elapsed * 7) * 3), 9);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (effect.kind === "babayaga") {
    const tail = Math.max(0, 1 - impactAge / .5);
    ctx.save();
    ctx.translate(effect.targetX, effect.targetY);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = impactAge > 0 ? tail : .4 + charge * .55;
    ctx.strokeStyle = "#f2d46d";
    ctx.shadowColor = "#9d7f27";
    ctx.shadowBlur = 9;
    ctx.lineWidth = 2.5;
    const size = 31 - charge * 8 + impactAge * 22;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath();
      ctx.moveTo(sx * size, sy * (size - 9));
      ctx.lineTo(sx * size, sy * size);
      ctx.lineTo(sx * (size - 9), sy * size);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 18); ctx.stroke();
    ctx.fillStyle = "#fff0a3";
    for (let row = 0; row < 3; row += 1) ctx.fillRect(20, -15 + row * 8, 13 - row * 3, 2);
    ctx.restore();
    return;
  }
  if (effect.kind === "gunner") {
    const tail = Math.max(0, 1 - impactAge / .5);
    const direction = effect.targetX >= effect.originX ? 1 : -1;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = impactAge > 0 ? tail : .25 + charge * .42;
    ctx.lineCap = "round";
    for (let shot = 0; shot < 5; shot += 1) {
      const offset = (shot - 2) * 7;
      ctx.strokeStyle = shot % 2 ? "#ffd67b" : "#f09d3f";
      ctx.shadowColor = "#e2782d";
      ctx.shadowBlur = 8;
      ctx.lineWidth = shot === 2 ? 3.5 : 2;
      ctx.beginPath();
      ctx.moveTo(effect.originX + direction * 12, effect.originY + offset);
      ctx.lineTo(effect.targetX + direction * (38 + shot * 8), effect.targetY + offset * 1.25);
      ctx.stroke();
      ctx.fillStyle = "#f8c35f";
      ctx.beginPath();
      ctx.arc(effect.targetX + direction * (shot * 8 - 16), effect.targetY + offset, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  if (effect.kind === "guardian") {
    ctx.save();
    ctx.translate(effect.originX + 18, effect.originY + 30);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = "#9bc8cf";
    ctx.fillStyle = "rgba(77,121,132,.2)";
    ctx.shadowColor = "#4f8e9a";
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3;
    for (let panel = -1; panel <= 1; panel += 1) {
      const x = panel * 27;
      ctx.beginPath();
      ctx.moveTo(x - 13, -52); ctx.lineTo(x + 13, -52);
      ctx.lineTo(x + 17, -6); ctx.lineTo(x, 8); ctx.lineTo(x - 17, -6); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 7, -25); ctx.lineTo(x, -34); ctx.lineTo(x + 7, -25);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (effect.kind === "engineer") {
    const tail = Math.max(0, 1 - impactAge / .55);
    ctx.save();
    ctx.translate(effect.targetX, effect.targetY + 8);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = impactAge > 0 ? tail : .35 + charge * .55;
    ctx.strokeStyle = "#ddc66c";
    ctx.shadowColor = "#9e8735";
    ctx.shadowBlur = 8;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, 35 + impactAge * 20, 11 + impactAge * 6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-30, 0); ctx.lineTo(-18, -17); ctx.lineTo(-7, -3);
    ctx.moveTo(30, 0); ctx.lineTo(18, -17); ctx.lineTo(7, -3);
    ctx.stroke();
    for (let hook = -2; hook <= 2; hook += 1) {
      ctx.beginPath();
      ctx.moveTo(hook * 9 - 4, 0);
      ctx.lineTo(hook * 9, -11 - Math.abs(hook) * 2);
      ctx.lineTo(hook * 9 + 4, 0);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (effect.kind === "mayo-chan") {
    const pulse = .72 + Math.sin(effect.elapsed * 13) * .16;
    ctx.save();
    ctx.translate(effect.originX, effect.originY + 52);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(206,57,92,${pulse})`;
    ctx.shadowColor = "#b11f4c";
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 30 + Math.sin(effect.elapsed * 8) * 4, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    const direction = effect.targetX >= effect.originX ? 1 : -1;
    for (let index = 0; index < 4; index += 1) {
      const offset = index * 8;
      ctx.globalAlpha = Math.max(.15, .7 - index * .13);
      ctx.beginPath();
      ctx.moveTo(-direction * (10 + offset), -18 + index * 8);
      ctx.lineTo(-direction * (42 + offset + Math.sin(effect.elapsed * 14 + index) * 7), -18 + index * 8);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (effect.kind === "tky") {
    const charge = Math.min(1, progress / .42);
    const release = Math.max(0, (progress - .38) / .62);
    const direction = effect.targetX >= effect.originX ? 1 : -1;
    ctx.save();
    ctx.translate(effect.originX, effect.originY);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255,62,205,${.45 + charge * .5})`;
    ctx.shadowColor = "#ff42c8";
    ctx.shadowBlur = 18;
    ctx.lineCap = "round";
    ctx.lineWidth = 4 + charge * 6;
    ctx.beginPath();
    ctx.moveTo(direction * 8, -45);
    ctx.lineTo(direction * (34 + charge * 62), -56);
    ctx.stroke();
    if (release > 0) {
      ctx.globalAlpha = 1 - release * .55;
      ctx.lineWidth = 12 - release * 5;
      ctx.beginPath();
      ctx.arc(direction * 10, -34, 92 + release * 62, direction > 0 ? -1.1 : Math.PI - 1.1, direction > 0 ? .9 : Math.PI + .9);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.9)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (effect.kind === "mrs-chiha") {
    const points = effect.points?.length ? effect.points : [{ x: effect.targetX, y: effect.targetY }];
    const windupSeconds = effect.windupSeconds ?? 1.05;
    const salvoIntervalSeconds = effect.salvoIntervalSeconds ?? .22;
    const projectileTravelSeconds = effect.projectileTravelSeconds ?? .18;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let index = 0; index < points.length; index += 1) {
      const launchAt = windupSeconds + salvoIntervalSeconds * index;
      const impactAt = launchAt + projectileTravelSeconds;
      const local = Math.max(0, Math.min(1, (effect.elapsed - launchAt) / projectileTravelSeconds));
      const impactAge = effect.elapsed - impactAt;
      if (local <= 0 || impactAge > .24) continue;
      const point = points[index];
      const x = effect.originX + (point.x - effect.originX) * local;
      const y = effect.originY + (point.y - effect.originY) * local - Math.sin(local * Math.PI) * (52 + index * 5);
      ctx.strokeStyle = `rgba(226,172,90,${.3 + local * .55})`;
      ctx.lineWidth = index === points.length - 1 ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(effect.originX, effect.originY);
      ctx.quadraticCurveTo((effect.originX + point.x) / 2, Math.min(effect.originY, point.y) - 68, x, y);
      ctx.stroke();
      ctx.fillStyle = "#d4a45c";
      ctx.shadowColor = "#ffb252";
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(x, y, index === points.length - 1 ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
      if (impactAge >= 0) {
        ctx.globalAlpha = Math.max(.08, 1 - impactAge / .24);
        ctx.strokeStyle = index === points.length - 1 ? "#ffd28b" : "#e6a455";
        ctx.lineWidth = index === points.length - 1 ? 6 : 3;
        const impactScale = 1 + Math.min(1, impactAge / .18) * .55;
        ctx.beginPath(); ctx.ellipse(point.x, point.y, (26 + index * 4) * impactScale, (11 + index * 2) * impactScale, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    return;
  }
  if (effect.kind === "miyamoto-musashi") {
    const pulse = .72 + Math.sin(effect.elapsed * 11) * .12;
    ctx.save();
    ctx.translate(effect.originX, effect.originY - 38);
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(167,202,226,${pulse})`;
    ctx.shadowColor = "#88aecb";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 25 + Math.sin(effect.elapsed * 6) * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-19, 19); ctx.lineTo(19, -19); ctx.moveTo(-19, -19); ctx.lineTo(19, 19); ctx.stroke();
    ctx.restore();
    return;
  }
  if (effect.kind !== "zakimiya") return;
  const x = effect.originX + (effect.targetX - effect.originX) * progress;
  const linearY = effect.originY + (effect.targetY - effect.originY) * progress;
  const y = linearY - Math.sin(progress * Math.PI) * 72;
  const angle = Math.atan2(effect.targetY - effect.originY, effect.targetX - effect.originX) + progress * Math.PI * 5;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowColor = "#ff8a35";
  ctx.shadowBlur = 11;
  ctx.strokeStyle = "#f2c06d";
  ctx.fillStyle = "#6e3c1e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-4, -11, 8, 21, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e7d2a1";
  ctx.fillRect(-2.5, -15, 5, 6);
  ctx.fillStyle = "#ff8a35";
  ctx.beginPath();
  ctx.moveTo(-4, -15);
  ctx.quadraticCurveTo(-7, -23, 0, -27);
  ctx.quadraticCurveTo(7, -22, 3, -14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = .5;
  ctx.strokeStyle = "#ffae4f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(effect.originX, effect.originY);
  ctx.quadraticCurveTo(
    (effect.originX + effect.targetX) / 2,
    Math.min(effect.originY, effect.targetY) - 72,
    x,
    y,
  );
  ctx.stroke();
  ctx.restore();
}

function drawStationHazard(ctx: CanvasRenderingContext2D, hazard: StationHazard, time: number) {
  if (!hazard.active) return;
  ctx.save();
  ctx.translate(hazard.centerX, hazard.centerY);
  ctx.fillStyle = "rgba(93,118,65,.22)";
  ctx.strokeStyle = `rgba(181,205,116,${.48 + Math.sin(time * 5) * .12})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, hazard.radiusX, hazard.radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (let index = 0; index < 5; index++) {
    const x = Math.sin(time * 2.8 + index * 1.7) * hazard.radiusX * .72;
    const y = Math.cos(time * 3.2 + index * 1.3) * hazard.radiusY * .55;
    ctx.fillStyle = index % 2 ? "#778b55" : "#a1b66f";
    ctx.beginPath(); ctx.arc(x, y, 2 + index % 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawStationMission(ctx: CanvasRenderingContext2D, g: Game, stageObjects: SpriteMap) {
  if (g.definition.missionType === STATION_MISSION_TYPES.ESCORT) {
    const x = escortCartX(g.stageMission, g.definition.missionConfig);
    const y = activeLaneCenters[1] + 13;
    const integrity = Math.max(0, g.stageMission.integrity ?? 0);
    const maxIntegrity = Math.max(1, g.stageMission.maxIntegrity ?? 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.beginPath(); ctx.ellipse(0, 6, 32, 6, 0, 0, Math.PI * 2); ctx.fill();
    const isCoastalPowerRig = g.definition.stageId === CAMPAIGN_STAGE_IDS.COASTAL_LINK_BRIDGE;
    const cartSprite = isCoastalPowerRig
      ? stageObjects["coastal-power-rig"]
      : stageObjects["station-platform-mission-art-source"];
    if (cartSprite?.complete && cartSprite.naturalWidth) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      if (isCoastalPowerRig) {
        ctx.drawImage(cartSprite, -72, -59, 144, 72);
      } else {
        ctx.drawImage(cartSprite, 90, 260, 1400, 520, -60, -51, 120, 45);
      }
    } else {
      ctx.fillStyle = "#5f665f"; ctx.strokeStyle = g.stageMission.stalled ? "#e19b5e" : "#aebbb0"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(-28, -27, 56, 30, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#bfc8bb"; ctx.fillRect(-22, -20, 18, 12);
      ctx.fillStyle = "#81735a"; ctx.fillRect(2, -20, 20, 12);
      ctx.fillStyle = "#171b1a"; ctx.beginPath(); ctx.arc(-18, 5, 6, 0, Math.PI * 2); ctx.arc(18, 5, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = g.stageMission.stalled ? "#e19b5e" : "#aebbb0";
    ctx.lineWidth = 1.5;
    const objectiveHalfWidth = isCoastalPowerRig ? 72 : 60;
    ctx.strokeRect(-objectiveHalfWidth, -51, objectiveHalfWidth * 2, 45);
    ctx.fillStyle = "rgba(0,0,0,.8)"; ctx.fillRect(-objectiveHalfWidth, -61, objectiveHalfWidth * 2, 6);
    ctx.fillStyle = "#d5b85e";
    ctx.fillRect(-objectiveHalfWidth + 1, -60, (objectiveHalfWidth * 2 - 2) * integrity / maxIntegrity, 4);
    ctx.restore();
  }
  if (g.definition.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL) {
    const activated = g.stageMission.powerActivated ?? 0;
    const configuredPanelXs = g.definition.missionConfig.powerXs;
    const panelXs = Array.isArray(configuredPanelXs) && configuredPanelXs.length === 3
      ? configuredPanelXs.map((value, index) => Number(value) || [410, 584, 744][index])
      : [410, 584, 744];
    const configuredYs = g.definition.missionConfig.powerYs;
    const panelYs = Array.isArray(configuredYs) && configuredYs.length === 3
      ? configuredYs.map((value, index) => activeYForContentY(Number(value) || [212, 352, 282][index]))
      : [212, 352, 282].map(activeYForContentY);
    for (let index = 0; index < 3; index++) {
      const active = index < activated;
      const current = index === activated;
      const x = panelXs[index];
      const y = panelYs[index] - 8;
      ctx.save(); ctx.translate(x, y);
      const powerSprite = stageObjects["station-tunnel-mission-art-source"];
      const powerCrops = [
        { x: 82, y: 55, w: 378, h: 760 },
        { x: 520, y: 48, w: 365, h: 770 },
        { x: 930, y: 58, w: 350, h: 755 },
      ];
      if (powerSprite?.complete && powerSprite.naturalWidth) {
        const crop = powerCrops[index];
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(powerSprite, crop.x, crop.y, crop.w, crop.h, -23, -92, 46, 94);
      } else {
        ctx.fillStyle = active ? "#596d58" : "#3b4240";
        ctx.fillRect(-13, -33, 26, 35);
      }
      ctx.strokeStyle = active ? "#b8df83" : current ? "#e1aa5f" : "#707872";
      ctx.lineWidth = current ? 3 : 2;
      ctx.strokeRect(-23, -92, 46, 94);
      ctx.fillStyle = active ? "#c9f09a" : "#7a6d57";
      ctx.font = "900 12px monospace"; ctx.textAlign = "center";
      ctx.fillText(String(index + 1), 0, -6);
      ctx.restore();
    }
    if (g.researchContainer?.exposed) {
      const container = g.researchContainer;
      const y = activeLaneCenters[container.lane] + 8;
      ctx.save();
      ctx.translate(container.x, y);
      ctx.fillStyle = "rgba(0,0,0,.44)";
      ctx.beginPath(); ctx.ellipse(0, 7, 25, 6, 0, 0, Math.PI * 2); ctx.fill();
      const controllerSprite = stageObjects["station-tunnel-mission-art-source"];
      if (controllerSprite?.complete && controllerSprite.naturalWidth) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(controllerSprite, 1280, 420, 270, 390, -23, -54, 46, 66);
      } else {
        ctx.fillStyle = container.contained ? "#4b6758" : "#635f50";
        ctx.beginPath(); ctx.roundRect(-22, -35, 44, 39, 5); ctx.fill();
        ctx.fillStyle = "#181b1a"; ctx.fillRect(-14, -28, 28, 15);
      }
      ctx.strokeStyle = container.contained ? "#b8dc97" : "#d3b56e";
      ctx.lineWidth = 3;
      ctx.strokeRect(-23, -54, 46, 66);
      ctx.fillStyle = container.contained ? "#b8dc97" : "#e1c272";
      ctx.font = "900 11px monospace"; ctx.textAlign = "center";
      ctx.fillText("研究", 0, 8);
      ctx.restore();
    }
    const sealDoorX = Number(g.definition.missionConfig.sealDoorX ?? 867);
    ctx.save();
    const doorClosed = g.stageMission.completed === true;
    const returnWindowOpen = g.stageMission.sealed === true && !doorClosed;
    ctx.fillStyle = doorClosed
      ? "rgba(54,75,62,.85)"
      : returnWindowOpen
        ? "rgba(82,57,37,.82)"
        : "rgba(52,46,42,.82)";
    ctx.strokeStyle = doorClosed ? "#b6d38f" : returnWindowOpen ? "#e0a15e" : "#b2875a";
    ctx.lineWidth = 4;
    ctx.fillRect(sealDoorX - 39, activeLaneCenters[0] - 68, 78, activeLaneCenters[2] - activeLaneCenters[0] + 92);
    ctx.strokeRect(sealDoorX - 39, activeLaneCenters[0] - 68, 78, activeLaneCenters[2] - activeLaneCenters[0] + 92);
    ctx.restore();
  }
}

function drawBossTelegraph(ctx: CanvasRenderingContext2D, f: Fighter, g: Game) {
  const telegraph = bossTelegraphSnapshot(f, { fallbackTargetX: BASE_X + 48 });
  if (!telegraph) return;
  ctx.save();
  ctx.lineWidth = 3;
  ctx.setLineDash([9, 6]);
  ctx.strokeStyle = telegraph.color;
  if (telegraph.kind === "ground-ellipse") {
    const pulse = (telegraph.radius ?? 0) + Math.sin(g.time * 18) * 4;
    ctx.globalAlpha = .72 + Math.sin(g.time * 14) * .14;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y + 2, pulse, pulse / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (telegraph.kind === "brood-radial") {
    const radius = telegraph.radius ?? 0;
    const pulse = .5 + .5 * Math.sin(g.time * 10);
    const gradient = ctx.createRadialGradient(f.x, f.y, radius * .08, f.x, f.y, radius);
    gradient.addColorStop(0, "rgba(119,39,32,.34)");
    gradient.addColorStop(.58, "rgba(123,63,48,.18)");
    gradient.addColorStop(1, "rgba(158,104,85,0)");
    ctx.globalAlpha = .82;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y + 2, radius, radius * .5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = .7 + pulse * .22;
    for (let ring = 0; ring < 3; ring += 1) {
      const ringRadius = radius * (.46 + ring * .23) + pulse * (3 + ring * 2);
      ctx.lineWidth = 2.4 - ring * .35;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y + 2, ringRadius, ringRadius * .5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (let lobe = 0; lobe < 8; lobe += 1) {
      const angle = lobe / 8 * Math.PI * 2 + g.time * .12;
      const lobeRadius = radius * (.68 + .05 * Math.sin(g.time * 7 + lobe));
      const x = f.x + Math.cos(angle) * lobeRadius;
      const y = f.y + Math.sin(angle) * lobeRadius * .5;
      ctx.globalAlpha = .52 + pulse * .2;
      ctx.fillStyle = lobe % 2 ? "#7d4338" : "#b0765c";
      ctx.beginPath();
      ctx.ellipse(x, y, 5 + pulse * 2, 3 + pulse, angle, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (telegraph.kind === "lane-rectangle") {
    const targetX = telegraph.targetX ?? BASE_X + 48;
    const targetY = telegraph.targetY ?? f.y;
    const halfHeight = telegraph.laneHalfHeight ?? 31;
    const width = Math.max(0, f.x - targetX);
    ctx.globalAlpha = .2;
    ctx.fillStyle = telegraph.color;
    ctx.fillRect(targetX, targetY - halfHeight, width, halfHeight * 2);
    ctx.globalAlpha = .9;
    ctx.strokeRect(targetX, targetY - halfHeight, width, halfHeight * 2);
  } else if (telegraph.kind === "shell-sweep") {
    const radius = telegraph.radius ?? 0;
    const halfHeight = BOSS_ANOMALY_TUNING.gairen.sweepHalfHeight;
    const pulse = .5 + .5 * Math.sin(g.time * 11);
    ctx.setLineDash([]);
    ctx.globalAlpha = .18;
    ctx.fillStyle = telegraph.color;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.ellipse(f.x, f.y, radius, halfHeight, 0, Math.PI * .5, Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = .76 + pulse * .18;
    for (let shell = 0; shell < 5; shell += 1) {
      const angle = Math.PI * (.62 + shell * .19);
      const reach = radius * (.72 + shell % 2 * .2);
      ctx.lineWidth = 5 - shell * .55;
      ctx.beginPath();
      ctx.moveTo(f.x - 18, f.y - 15);
      ctx.quadraticCurveTo(
        f.x + Math.cos(angle) * reach * .55,
        f.y + Math.sin(angle) * reach * .25 - 22,
        f.x + Math.cos(angle) * reach,
        f.y + Math.sin(angle) * reach * .5,
      );
      ctx.stroke();
    }
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(
      f.x,
      f.y,
      radius + pulse * 5,
      halfHeight + pulse * 2,
      0,
      Math.PI * .5,
      Math.PI * 1.5,
    );
    ctx.stroke();
  } else if (telegraph.kind === "cross-strike") {
    const radius = telegraph.radius ?? 0;
    const targetX = telegraph.targetX ?? f.x;
    const targetY = telegraph.targetY ?? f.y;
    const halfWidth = BOSS_ANOMALY_TUNING.futago.crossStrikeHalfWidth;
    const pulse = 2 + Math.sin(g.time * 16) * 2;
    ctx.setLineDash([]);
    ctx.translate(targetX, targetY);
    ctx.globalAlpha = .18;
    ctx.fillStyle = telegraph.color;
    for (const angle of [
      -BOSS_ANOMALY_TUNING.futago.crossStrikeAngleRadians,
      BOSS_ANOMALY_TUNING.futago.crossStrikeAngleRadians,
    ]) {
      ctx.save();
      ctx.rotate(angle);
      ctx.fillRect(-radius, -halfWidth - pulse, radius * 2, (halfWidth + pulse) * 2);
      ctx.restore();
    }
    ctx.globalAlpha = .86;
    ctx.lineWidth = 3;
    for (const angle of [
      -BOSS_ANOMALY_TUNING.futago.crossStrikeAngleRadians,
      BOSS_ANOMALY_TUNING.futago.crossStrikeAngleRadians,
    ]) {
      ctx.save();
      ctx.rotate(angle);
      ctx.strokeRect(-radius, -halfWidth - pulse, radius * 2, (halfWidth + pulse) * 2);
      ctx.restore();
    }
    ctx.translate(-targetX, -targetY);
  } else if (telegraph.kind === "tracking-ray") {
    const targetX = telegraph.targetX ?? BASE_X + 48;
    const targetY = telegraph.targetY ?? f.y;
    const originY = f.y - 64;
    const pulse = .58 + Math.sin(g.time * 22) * .18;
    ctx.globalAlpha = telegraph.locked ? .94 : pulse;
    ctx.lineWidth = telegraph.locked ? 5 : 3;
    ctx.beginPath();
    ctx.moveTo(f.x - 4, originY);
    ctx.lineTo(targetX, targetY - 38);
    ctx.stroke();
    ctx.globalAlpha = telegraph.locked ? .22 : .1;
    ctx.lineWidth = Math.max(8, (telegraph.beamHalfWidth ?? 18) * 2);
    ctx.stroke();
    ctx.globalAlpha = .92;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(targetX, targetY - 38, telegraph.locked ? 12 : 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = .95;
  ctx.fillStyle = "#f4dfb8";
  ctx.font = "900 10px monospace";
  ctx.textAlign = "center";
  const compactLabels: Record<string, string> = {
    "brood-radial": "増殖域 // 範囲外へ退避",
    "lane-rectangle": "捕食突進 // 上下へ退避",
    "shell-sweep": "外殻展開 // 側面攻撃",
    "cross-strike": "交差中心 // 離脱",
  };
  const label = compactBattleViewport() && compactLabels[telegraph.kind]
    ? compactLabels[telegraph.kind]
    : `${telegraph.displayName} // ${telegraph.counterplay}`;
  const labelY = ["brood-radial", "shell-sweep", "cross-strike"].includes(telegraph.kind)
    ? f.y + Math.min(82, (telegraph.radius ?? 0) * .5 + 18)
    : telegraph.kind === "lane-rectangle"
      ? (telegraph.targetY ?? f.y) + (telegraph.laneHalfHeight ?? 31) + 18
      : f.y - 142;
  ctx.fillText(label, f.x, labelY);
  ctx.restore();
}

function drawMotherCombatVfx(ctx: CanvasRenderingContext2D, f: Fighter, g: Game) {
  if (f.kind !== "mother" || !["active", "recovery"].includes(f.stationAbility.phase)) return;
  const active = f.stationAbility.phase === "active";
  const tuning = BOSS_ANOMALY_TUNING.mother;
  const elapsed = active
    ? tuning.activeSeconds - f.stationAbility.remainingSeconds
    : tuning.recoverySeconds - f.stationAbility.remainingSeconds;
  const intensity = active
    ? Math.min(1, elapsed / .2)
    : Math.max(0, 1 - elapsed / tuning.recoverySeconds);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createRadialGradient(f.x, f.y - 24, 8, f.x, f.y - 18, 118);
  gradient.addColorStop(0, `rgba(255,210,146,${.3 * intensity})`);
  gradient.addColorStop(.34, `rgba(169,67,49,${.28 * intensity})`);
  gradient.addColorStop(1, "rgba(90,26,24,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(f.x, f.y - 14, 122, 68, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = "round";
  for (let strand = 0; strand < 11; strand += 1) {
    const angle = -Math.PI + strand / 10 * Math.PI;
    const reach = 78 + (strand % 3) * 18 + Math.sin(g.time * 8 + strand) * 7;
    ctx.strokeStyle = strand % 2
      ? `rgba(220,118,76,${.38 * intensity})`
      : `rgba(255,194,125,${.28 * intensity})`;
    ctx.lineWidth = 2 + (strand % 3);
    ctx.beginPath();
    ctx.moveTo(f.x + Math.cos(angle) * 28, f.y - 28 + Math.sin(angle) * 11);
    ctx.quadraticCurveTo(
      f.x + Math.cos(angle) * reach * .55,
      f.y - 62 - Math.sin(g.time * 5 + strand) * 14,
      f.x + Math.cos(angle) * reach,
      f.y - 6 + Math.sin(angle) * 35,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawAnomalyBossCombatVfx(ctx: CanvasRenderingContext2D, f: Fighter, g: Game) {
  if (!["ooguchi", "gairen", "futago"].includes(f.kind)
    || !["active", "recovery"].includes(f.stationAbility.phase)) return;
  const tuning = BOSS_ANOMALY_TUNING[f.kind as "ooguchi" | "gairen" | "futago"];
  const active = f.stationAbility.phase === "active";
  const elapsed = active
    ? tuning.activeSeconds - f.stationAbility.remainingSeconds
    : tuning.recoverySeconds - f.stationAbility.remainingSeconds;
  const intensity = active
    ? Math.min(1, elapsed / .16)
    : Math.max(0, 1 - elapsed / tuning.recoverySeconds);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (f.kind === "ooguchi") {
    const gradient = ctx.createRadialGradient(f.x - 42, f.y - 28, 5, f.x - 30, f.y - 20, 94);
    gradient.addColorStop(0, `rgba(255,194,116,${.46 * intensity})`);
    gradient.addColorStop(.42, `rgba(172,61,43,${.3 * intensity})`);
    gradient.addColorStop(1, "rgba(72,20,16,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(f.x - 34, f.y - 20, 98, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineCap = "round";
    for (let streak = 0; streak < 8; streak += 1) {
      const y = f.y - 56 + streak * 9;
      const reach = 54 + streak % 3 * 18;
      ctx.strokeStyle = streak % 2
        ? `rgba(221,120,72,${.34 * intensity})`
        : `rgba(255,213,151,${.25 * intensity})`;
      ctx.lineWidth = 2 + streak % 2;
      ctx.beginPath();
      ctx.moveTo(f.x + 42, y);
      ctx.bezierCurveTo(f.x + reach, y - 4, f.x + reach + 22, y + 5, f.x + reach + 42, y);
      ctx.stroke();
    }
  } else if (f.kind === "gairen") {
    const gradient = ctx.createRadialGradient(f.x, f.y - 66, 4, f.x, f.y - 58, 88);
    gradient.addColorStop(0, `rgba(255,210,143,${.58 * intensity})`);
    gradient.addColorStop(.34, `rgba(154,55,48,${.38 * intensity})`);
    gradient.addColorStop(1, "rgba(82,42,30,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y - 54, 72, 82, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let shell = 0; shell < 5; shell += 1) {
      const angle = -Math.PI * .9 + shell * Math.PI * .45;
      const reach = 64 + shell % 2 * 18;
      ctx.strokeStyle = shell % 2
        ? `rgba(213,174,102,${.42 * intensity})`
        : `rgba(255,226,168,${.28 * intensity})`;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(f.x + Math.cos(angle) * 24, f.y - 54 + Math.sin(angle) * 18);
      ctx.quadraticCurveTo(
        f.x + Math.cos(angle) * reach * .65,
        f.y - 62 + Math.sin(angle) * reach * .25,
        f.x + Math.cos(angle) * reach,
        f.y - 26 + Math.sin(angle) * reach * .45,
      );
      ctx.stroke();
    }
  } else {
    const split = f.hp / Math.max(1, f.maxHp) <= BOSS_ANOMALY_TUNING.futago.splitThreshold;
    const separation = split ? 31 : 18;
    for (const direction of [-1, 1]) {
      const centerX = f.x + direction * separation;
      const gradient = ctx.createRadialGradient(centerX, f.y - 54, 4, centerX, f.y - 46, 72);
      gradient.addColorStop(0, `rgba(255,198,184,${.45 * intensity})`);
      gradient.addColorStop(.42, `rgba(154,60,74,${.32 * intensity})`);
      gradient.addColorStop(1, "rgba(70,22,34,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(centerX, f.y - 44, 64, 76, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = `rgba(246,171,158,${.48 * intensity})`;
    ctx.lineWidth = 2.5;
    for (let filament = 0; filament < 7; filament += 1) {
      const y = f.y - 82 + filament * 12;
      ctx.beginPath();
      ctx.moveTo(f.x - separation, y);
      ctx.bezierCurveTo(
        f.x - 6,
        y - 12 + Math.sin(g.time * 7 + filament) * 6,
        f.x + 6,
        y + 12 - Math.sin(g.time * 7 + filament) * 6,
        f.x + separation,
        y,
      );
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawKuromeCombatVfx(ctx: CanvasRenderingContext2D, f: Fighter, g: Game) {
  if (f.kind !== "kurome" || f.stationAbility.phase !== "firing") return;
  const targetX = Number(f.stationAbility.targetX);
  const targetY = Number(f.stationAbility.targetY);
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) return;
  const phaseRatio = f.hp / Math.max(1, f.maxHp);
  const halfWidth = phaseRatio <= .3
    ? KUROME_PROTOTYPE_TUNING.finalPhaseBeamHalfWidth
    : KUROME_PROTOTYPE_TUNING.beamHalfWidth;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.shadowColor = "#54f4ff";
  ctx.shadowBlur = 18;
  ctx.strokeStyle = "rgba(68,225,242,.32)";
  ctx.lineWidth = halfWidth * 2;
  ctx.beginPath();
  ctx.moveTo(f.x - 4, f.y - 64);
  ctx.lineTo(targetX, targetY - 38);
  ctx.stroke();
  ctx.strokeStyle = "rgba(232,253,255,.96)";
  ctx.lineWidth = 4 + Math.sin(g.time * 70) * 1.2;
  ctx.stroke();
  ctx.restore();
}

function drawKuromeVisionInterference(ctx: CanvasRenderingContext2D, f: Fighter, g: Game) {
  const remaining = Math.max(0, Number(f.visionDisruptedRemaining) || 0);
  if (f.side !== "human" || remaining <= 0) return;
  const alpha = Math.min(.38, .12 + remaining * .18);
  ctx.save();
  const gradient = ctx.createRadialGradient(f.x, f.y - 35, 8, f.x, f.y - 35, 72);
  gradient.addColorStop(0, `rgba(74,226,238,${alpha * .55})`);
  gradient.addColorStop(.48, `rgba(32,15,53,${alpha})`);
  gradient.addColorStop(1, "rgba(8,4,18,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(f.x, f.y - 35, 72, 48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(104,233,241,${.4 + Math.sin(g.time * 18) * .16})`;
  ctx.setLineDash([5, 8]);
  ctx.beginPath();
  ctx.ellipse(f.x, f.y - 35, 49, 32, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawStationEnemyTelegraph(ctx: CanvasRenderingContext2D, f: Fighter, g: Game) {
  if (f.stationAbility.phase === "idle") return;
  ctx.save();
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  if (f.kind === "grappler" && f.stationAbility.phase === "windup") {
    const target = g.fighters.find((candidate) => String(candidate.id) === String(f.stationAbility.targetId));
    if (target) {
      ctx.strokeStyle = "rgba(222,128,92,.8)";
      ctx.beginPath(); ctx.moveTo(f.x, f.y - 35); ctx.lineTo(target.x, target.y - 34); ctx.stroke();
    }
  } else if (f.kind === "ooze" && f.stationAbility.phase === "windup") {
    ctx.strokeStyle = "rgba(172,198,103,.82)";
    ctx.beginPath();
    ctx.ellipse(f.stationAbility.centerX ?? f.x, f.stationAbility.centerY ?? f.y, STATION_ENEMY_TUNING.leakMud.radiusX, STATION_ENEMY_TUNING.leakMud.radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (f.kind === "sprinter" && f.stationAbility.phase === "telegraph") {
    ctx.fillStyle = "rgba(225,153,88,.16)";
    ctx.fillRect(BASE_X + 28, f.y - 18, Math.max(0, f.x - BASE_X - 28), 36);
    ctx.strokeStyle = "rgba(230,164,103,.85)";
    ctx.strokeRect(BASE_X + 28, f.y - 18, Math.max(0, f.x - BASE_X - 28), 36);
  } else if (f.kind === "resonator") {
    const reach = 168;
    const halfHeight = 34 + reach * .22;
    const pulse = 4 + Math.sin(g.time * 18) * 2;
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(144,104,94,.78)";
    ctx.fillStyle = "rgba(91,61,57,.12)";
    ctx.beginPath();
    ctx.moveTo(f.x - 8, f.y - 38);
    ctx.lineTo(f.x - reach, f.y - halfHeight);
    ctx.lineTo(f.x - reach, f.y + halfHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (let index = 0; index < 3; index += 1) {
      const x = f.x - 42 - index * 39;
      ctx.globalAlpha = .72 - index * .16;
      ctx.beginPath();
      ctx.ellipse(x, f.y - 22, 10 + index * 5 + pulse, 22 + index * 8, 0, Math.PI * .58, Math.PI * 1.42);
      ctx.stroke();
    }
  } else if (f.kind === "cagewalker") {
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(166,144,109,.8)";
    ctx.fillStyle = "rgba(45,35,30,.22)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y + 6, 56, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const offset of [-42, -21, 0, 22, 43]) {
      ctx.beginPath();
      ctx.moveTo(f.x + offset, f.y + 9);
      ctx.quadraticCurveTo(f.x + offset * .82, f.y - 18, f.x + offset * .58, f.y - 42);
      ctx.stroke();
    }
  } else if (f.kind === "spindle") {
    const targetX = Number(f.stationAbility.targetX);
    const targetY = Number(f.stationAbility.targetY);
    if (Number.isFinite(targetX) && Number.isFinite(targetY)) {
      const landingX = Math.min(BARRICADE_X - 12, targetX + 38);
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = "rgba(143,108,124,.86)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y - 16);
      ctx.quadraticCurveTo((f.x + landingX) / 2, Math.min(f.y, targetY) - 108, landingX, targetY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.ellipse(landingX, targetY + 4, 42, 13, 0, 0, Math.PI * 2);
      ctx.moveTo(landingX - 24, targetY - 7);
      ctx.lineTo(landingX + 24, targetY + 11);
      ctx.moveTo(landingX + 24, targetY - 7);
      ctx.lineTo(landingX - 24, targetY + 11);
      ctx.stroke();
    }
  } else if (f.kind === "choir-knot") {
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(151,111,126,.82)";
    ctx.lineWidth = 2;
    for (let index = 0; index < (f.stationAbility.targetIds?.length ?? 0); index += 1) {
      const target = g.fighters.find((candidate) => (
        String(candidate.id) === String(f.stationAbility.targetIds?.[index])
      ));
      if (!target) continue;
      const sourceOffset = (index - .5) * 13;
      ctx.beginPath();
      ctx.moveTo(f.x + sourceOffset, f.y - 44);
      ctx.bezierCurveTo(
        f.x - 30,
        f.y - 74 - index * 8,
        target.x + 36,
        target.y - 66,
        target.x,
        target.y - 46,
      );
      ctx.stroke();
    }
  } else if (f.kind === "pall-manta") {
    const active = f.stationAbility.phase === "active";
    ctx.setLineDash([]);
    ctx.fillStyle = active ? "rgba(47,37,44,.28)" : "rgba(74,54,63,.16)";
    ctx.strokeStyle = "rgba(118,89,101,.82)";
    ctx.lineWidth = active ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(f.x - 28, f.y - 12);
    ctx.lineTo(f.x + 32, f.y - 12);
    ctx.lineTo(f.x + 118, f.y + 17);
    ctx.lineTo(f.x - 32, f.y + 17);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (const offset of [4, 36, 68, 100]) {
      ctx.beginPath();
      ctx.moveTo(f.x + offset, f.y - 10);
      ctx.lineTo(f.x + offset + 9, f.y + 15);
      ctx.stroke();
    }
  } else if (f.kind === "anchor-bloom") {
    const active = f.stationAbility.phase === "active";
    ctx.setLineDash([]);
    ctx.strokeStyle = active ? "rgba(128,75,79,.88)" : "rgba(116,79,76,.7)";
    ctx.lineWidth = active ? 4 : 2.5;
    for (let index = 0; index < 5; index += 1) {
      const angle = index * Math.PI * .4 + Math.sin(g.time * 2) * .03;
      const reach = 58 + (index % 2) * 17;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y + 5);
      ctx.quadraticCurveTo(
        f.x + Math.cos(angle + .24) * reach * .58,
        f.y + Math.sin(angle + .24) * reach * .2,
        f.x + Math.cos(angle) * reach,
        f.y + Math.sin(angle) * reach * .32,
      );
      ctx.stroke();
    }
    for (const targetId of f.stationAbility.targetIds ?? []) {
      const target = g.fighters.find((candidate) => String(candidate.id) === String(targetId));
      if (!target) continue;
      ctx.globalAlpha = .56;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(target.x, target.y + 4);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBattlefieldSupply(ctx: CanvasRenderingContext2D, object: BattlefieldObject, sprites: SpriteMap) {
  const dropOffset = object.phase === "dropping" ? Math.max(0, object.phaseTime / .45) * 86 : 0;
  const destroySeconds = object.kind === "pod" ? .42 : object.kind === "drum" ? .36 : .3;
  const destroyRatio = object.phase === "destroying" ? Math.max(0, object.phaseTime / destroySeconds) : 1;
  const hpRatio = Math.max(0, object.hp / object.maxHp);
  const drawY = object.y - dropOffset;
  ctx.save();
  ctx.globalAlpha = object.phase === "destroying" ? destroyRatio : 1;
  ctx.fillStyle = "rgba(0,0,0,.42)";
  ctx.beginPath(); ctx.ellipse(object.x, object.y + 8, 35 + dropOffset * .08, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(object.x, drawY);
  if (object.phase === "destroying") { ctx.translate(0, (1 - destroyRatio) * 14); ctx.rotate((1 - destroyRatio) * -.18); ctx.scale(.78 + destroyRatio * .22, .58 + destroyRatio * .42); }
  if (object.hitFlash > 0) { ctx.shadowColor = "#fff0a4"; ctx.shadowBlur = 14; }
  const supplySprite = sprites[object.kind];
  if (object.kind === "pod" && supplySprite?.complete && supplySprite.naturalWidth) {
    ctx.filter = hpRatio <= .3 ? "saturate(.5) brightness(.66) sepia(.16)" : hpRatio <= .62 ? "saturate(.72) brightness(.82)" : "none";
    ctx.drawImage(supplySprite, 102, 40, 311, 356, -38, -66, 76, 87);
    ctx.filter = "none";
  } else if (object.kind === "drum" && supplySprite?.complete && supplySprite.naturalWidth) {
    ctx.filter = hpRatio <= .3 ? "saturate(.55) brightness(.67)" : hpRatio <= .62 ? "brightness(.82)" : "none";
    ctx.drawImage(supplySprite, -30, -63, 60, 64); ctx.filter = "none";
    if (object.phase === "detonating") {
      ctx.strokeStyle = `rgba(255,218,104,${.55 + Math.sin(performance.now() * .035) * .35})`;
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -25, 31, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (object.kind === "medical" && supplySprite?.complete && supplySprite.naturalWidth) {
    ctx.filter = hpRatio <= .3 ? "saturate(.52) brightness(.68)" : hpRatio <= .62 ? "brightness(.84)" : "none";
    ctx.drawImage(supplySprite, -39, -62, 78, 66); ctx.filter = "none";
  } else if (object.kind === "drum") {
    ctx.fillStyle = hpRatio <= .3 ? "#512b25" : "#783e2c";
    ctx.fillRect(-15, -36, 30, 42);
    ctx.fillStyle = "#c17642"; ctx.fillRect(-17, -31, 34, 5); ctx.fillRect(-17, -8, 34, 5);
    ctx.fillStyle = "#e7b94e"; ctx.font = "900 17px monospace"; ctx.textAlign = "center"; ctx.fillText("!", 0, -14);
  } else if (object.kind === "medical") {
    ctx.fillStyle = hpRatio <= .3 ? "#6f765f" : "#d0c6a5";
    ctx.fillRect(-23, -29, 46, 34);
    ctx.fillStyle = "#405f4f"; ctx.fillRect(-25, -24, 50, 5); ctx.fillRect(-25, -3, 50, 5);
    ctx.fillStyle = "#3fa56f"; ctx.fillRect(-4, -22, 8, 20); ctx.fillRect(-11, -16, 22, 8);
  } else {
    ctx.fillStyle = "#344b48";
    ctx.beginPath(); ctx.moveTo(-39,-31); ctx.lineTo(-29,-44); ctx.lineTo(29,-44); ctx.lineTo(39,-31); ctx.lineTo(36,5); ctx.lineTo(-36,5); ctx.closePath(); ctx.fill();
  }
  if (object.kind === "pod" && hpRatio <= .62) { ctx.strokeStyle = hpRatio <= .3 ? "#e76c4e" : "#172526"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(8,-39); ctx.lineTo(2,-27); ctx.lineTo(11,-20); ctx.lineTo(5,-7); ctx.stroke(); }
  if (object.phase === "dropping") { ctx.strokeStyle="rgba(205,222,202,.55)"; ctx.setLineDash([5,4]); ctx.beginPath(); ctx.moveTo(-27,-48); ctx.lineTo(-42,-82); ctx.moveTo(27,-48); ctx.lineTo(42,-82); ctx.stroke(); ctx.setLineDash([]); }
  if (object.phase === "impact") { const pulse=1-object.phaseTime/.26; ctx.strokeStyle=`rgba(255,190,85,${1-pulse})`; ctx.lineWidth=5-3*pulse; ctx.beginPath(); ctx.ellipse(0,7,42+pulse*62,12+pulse*24,0,0,Math.PI*2); ctx.stroke(); }
  ctx.shadowBlur = 0;
  if (object.phase === "active" || object.phase === "impact") {
    ctx.fillStyle = "rgba(0,0,0,.68)"; ctx.fillRect(-32, -48, 64, 6);
    ctx.fillStyle = object.hp / object.maxHp <= .3 ? "#ef6448" : "#70c59d";
    ctx.fillRect(-31, -47, 62 * Math.max(0, object.hp / object.maxHp), 4);
  }
  ctx.restore();
}

function drawPlacementIndicator(ctx: CanvasRenderingContext2D, indicator: PlacementIndicator | null) {
  if (!indicator) return;
  const radius = Math.max(24, indicator.radius);
  ctx.save();
  ctx.translate(indicator.x, indicator.y);
  ctx.strokeStyle = indicator.valid ? "rgba(113,216,170,.7)" : "rgba(239,100,72,.76)";
  ctx.fillStyle = indicator.valid ? "rgba(74,180,135,.06)" : "rgba(221,73,52,.075)";
  ctx.lineWidth = 1.4; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.ellipse(0, 4, radius, radius * .34, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (indicator.innerRadius && indicator.innerRadius < radius) {
    ctx.globalAlpha = .38;
    ctx.beginPath(); ctx.ellipse(0, 4, indicator.innerRadius, indicator.innerRadius * .34, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha = .62;
  if (indicator.action?.startsWith("supply:")) {
    ctx.strokeRect(-15, -24, 30, 24);
    ctx.beginPath(); ctx.moveTo(-7, -12); ctx.lineTo(7, -12); ctx.moveTo(0, -19); ctx.lineTo(0, -5); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.moveTo(0, -9); ctx.lineTo(0, 9); ctx.stroke();
  }
  ctx.restore();

  const label = placementReasonLabel(indicator.reason);
  const labelY = indicator.y - Math.min(52, radius * .34 + 16);
  ctx.save();
  ctx.font = "900 10px monospace";
  const labelWidth = Math.min(138, Math.ceil(ctx.measureText(label).width) + 14);
  const labelX = Math.max(labelWidth / 2 + 8, Math.min(W - labelWidth / 2 - 8, indicator.x));
  ctx.fillStyle = "rgba(12,14,14,.78)";
  ctx.fillRect(labelX - labelWidth / 2, labelY - 12, labelWidth, 18);
  ctx.strokeStyle = indicator.valid ? "rgba(113,216,170,.55)" : "rgba(239,100,72,.72)";
  ctx.lineWidth = 1;
  ctx.strokeRect(labelX - labelWidth / 2 + .5, labelY - 11.5, labelWidth - 1, 17);
  ctx.fillStyle = indicator.valid ? "#b8efd7" : "#ffac97";
  ctx.textAlign = "center";
  ctx.fillText(label, labelX, labelY + 1);
  ctx.restore();
}

function drawAirstrikeObserver(ctx: CanvasRenderingContext2D, g: Game) {
  const pose = airstrikeObserverPose(g.airstrike);
  if (!pose.visible) return;
  const crawler = WORLD_GEOMETRY.crawler;
  const x = crawler.commandDeckX + 4;
  const deckY = crawler.commandDeckY - 4;
  const y = deckY - pose.rise * 20;
  ctx.save();
  ctx.globalAlpha = .45 + pose.rise * .55;
  // Abstract deck-observer cue only; it does not define a named character identity.
  ctx.fillStyle = "#2b3130";
  ctx.fillRect(x - 6, y + 3, 12, 17);
  ctx.fillStyle = "#d1bd95";
  ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#171b1b"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 4, y - 2); ctx.lineTo(x + 10, y + 2); ctx.stroke();

  if (pose.action === "radio") {
    const pulse = 8 + Math.sin(g.time * 18) * 2;
    ctx.strokeStyle = "rgba(255,193,88,.9)"; ctx.lineWidth = 2;
    for (const radius of [pulse, pulse + 7]) {
      ctx.beginPath(); ctx.arc(x + 11, y + 1, radius, -.7, .7); ctx.stroke();
    }
  } else if (pose.action === "targeting") {
    ctx.strokeStyle = "#ffd36a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x + 16, y - 2, 8, 0, Math.PI * 2); ctx.moveTo(x + 16, y - 14); ctx.lineTo(x + 16, y + 10); ctx.moveTo(x + 4, y - 2); ctx.lineTo(x + 28, y - 2); ctx.stroke();
  } else if (pose.action === "inbound" || pose.action === "impact") {
    const signal = pose.action === "impact" ? 1 : .55 + Math.sin(g.time * 15) * .35;
    ctx.fillStyle = `rgba(255,112,54,${signal})`;
    ctx.beginPath(); ctx.arc(x + 13, y - 10, pose.action === "impact" ? 7 : 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#e7d8ad"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 4, y + 7); ctx.lineTo(x + 12, y - 8); ctx.stroke();
  }
  ctx.restore();
}

function drawCrawlerAsset(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  crawler: typeof WORLD_GEOMETRY.crawler,
) {
  const sourceX = image.naturalWidth * .016;
  const sourceY = image.naturalHeight * .088;
  const sourceWidth = image.naturalWidth * .968;
  const sourceHeight = image.naturalHeight * .802;
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    crawler.x,
    crawler.y,
    crawler.width,
    crawler.height,
  );
}

function drawCrawler(ctx: CanvasRenderingContext2D, g: Game, sprites: SpriteMap) {
  const crawlerClosedSprite = sprites.crawlerClosed ?? sprites.crawler;
  const crawlerOpenSprite = sprites.crawlerOpen ?? crawlerClosedSprite;
  const crawler = WORLD_GEOMETRY.crawler;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.48)";
  ctx.beginPath();
  ctx.ellipse(crawler.x + crawler.width * .5, crawler.y + crawler.height * .92, crawler.width * .45, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  if (g.baseHp <= 260) {
    for (let i = 0; i < 4; i++) {
      const smokeY = crawler.y + 26 - ((g.time * 18 + i * 13) % 48);
      ctx.globalAlpha = .12 + i * .035;
      ctx.fillStyle = "#1b1c1b";
      ctx.beginPath();
      ctx.arc(crawler.x + crawler.width * .46 + Math.sin(g.time * 2 + i) * 7, smokeY, 9 + i * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  if (crawlerClosedSprite?.complete && crawlerClosedSprite.naturalWidth) {
    ctx.globalAlpha = .92 + Math.max(0, g.baseHp / g.baseMaxHp) * .08;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    drawCrawlerAsset(ctx, crawlerClosedSprite, crawler);
    if (crawlerOpenSprite?.complete
      && crawlerOpenSprite.naturalWidth
      && g.crawlerDoor.doorProgress > 0) {
      const doorProgress = g.crawlerDoor.doorProgress * g.crawlerDoor.doorProgress * (3 - 2 * g.crawlerDoor.doorProgress);
      ctx.save();
      ctx.beginPath();
      ctx.rect(crawler.doorX - 43, activeMusterY() - 94, 108, 151);
      ctx.clip();
      ctx.globalAlpha = doorProgress;
      drawCrawlerAsset(ctx, crawlerOpenSprite, crawler);
      ctx.restore();
    }
  } else {
    ctx.fillStyle = "#5d3329";
    ctx.fillRect(crawler.x + 18, crawler.y + 45, crawler.width - 36, crawler.height - 50);
  }
  const weaponActive = ["deploying", "firing", "recovering"].includes(g.crawlerAbility.phase);
  const weaponLift = g.crawlerAbility.phase === "deploying" ? 7 : g.crawlerAbility.phase === "recovering" ? 4 : weaponActive ? 10 : 0;
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(13,18,18,.88)";
  ctx.fillRect(crawler.commandDeckX - 13, crawler.commandDeckY - 20, 26, 18);
  ctx.fillStyle = g.airstrike.phase === "idle" ? "#5b8274" : "#ffb95d";
  ctx.fillRect(crawler.commandDeckX - 8, crawler.commandDeckY - 16, 5, 4);
  drawAirstrikeObserver(ctx, g);
  ctx.fillStyle = "#161b1b";
  ctx.fillRect(crawler.commandDeckX - 10, crawler.commandDeckY - 6, 22, 5);
  ctx.fillStyle = "#252d2d"; ctx.fillRect(crawler.weaponX - 20, crawler.weaponY - 12 - weaponLift, 40, 8);
  ctx.fillStyle = "#85704f"; ctx.fillRect(crawler.weaponX + 11, crawler.weaponY - 10 - weaponLift, 34, 4);
  if (g.crawlerAbility.phase === "firing") {
    const muzzle = 12 + Math.sin(g.time * 45) * 5;
    ctx.fillStyle = "rgba(255,221,121,.9)";
    ctx.beginPath(); ctx.moveTo(crawler.weaponX + 44, crawler.weaponY - 8 - weaponLift); ctx.lineTo(crawler.weaponX + 44 + muzzle, crawler.weaponY - 15 - weaponLift); ctx.lineTo(crawler.weaponX + 44 + muzzle, crawler.weaponY - 1 - weaponLift); ctx.closePath(); ctx.fill();
  }
  if (g.crawlerDoor.phase !== CRAWLER_DOOR_PHASES.CLOSED) {
    const warningPulse = g.crawlerDoor.phase === CRAWLER_DOOR_PHASES.WARNING
      ? .42 + Math.sin(g.time * 34) * .38
      : .78;
    const glow = ctx.createRadialGradient(crawler.doorX + 8, activeMusterY() - 82, 1, crawler.doorX + 8, activeMusterY() - 82, 21);
    glow.addColorStop(0, `rgba(255,188,82,${warningPulse})`);
    glow.addColorStop(1, "rgba(221,103,47,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(crawler.doorX - 14, activeMusterY() - 104, 44, 44);
    ctx.fillStyle = `rgba(255,178,70,${warningPulse})`;
    ctx.beginPath();
    ctx.arc(crawler.doorX + 8, activeMusterY() - 82, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCrawlerExitFrame(ctx: CanvasRenderingContext2D, g: Game, sprites: SpriteMap) {
  if (g.crawlerDoor.doorProgress <= 0) return;
  const crawler = WORLD_GEOMETRY.crawler;
  const openSprite = sprites.crawlerOpen;
  if (!openSprite?.complete || !openSprite.naturalWidth) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(crawler.doorX - 38, activeMusterY() - 92, 17, 86);
  ctx.rect(crawler.doorX + 22, activeMusterY() - 92, 18, 86);
  ctx.rect(crawler.doorX - 38, activeMusterY() - 92, 78, 17);
  ctx.clip();
  drawCrawlerAsset(ctx, openSprite, crawler);
  ctx.restore();
}

function drawEnemyBase(
  ctx: CanvasRenderingContext2D,
  g: Game,
  enemyBaseSprite: HTMLImageElement | null,
  stageObjects: SpriteMap,
) {
  const barrier = WORLD_GEOMETRY.enemyBase;
  const stationRelaySprite = g.definition.stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE
    ? stageObjects["station-gate-mission-art-source"]
    : null;
  const ratio = Math.max(0, g.barricadeHp / g.barricadeMaxHp);
  const visualState = enemyBaseVisualState({ hp: g.barricadeHp, elapsed: g.enemyBaseCollapse });
  const damageLevel = visualState.damageLevel;
  const collapse = visualState.collapseProgress;
  const breached = visualState.phase === "collapsing" || visualState.phase === "collapsed";
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.42)";
  ctx.beginPath();
  ctx.ellipse(barrier.drawX + barrier.width * .55, barrier.drawY + barrier.height - 5, barrier.width * .5, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  const productionBaseSprite = stationRelaySprite?.complete && stationRelaySprite.naturalWidth
    ? stationRelaySprite
    : enemyBaseSprite;
  if (productionBaseSprite?.complete && productionBaseSprite.naturalWidth && collapse < 1) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (!breached && g.barricadeHitFlash > 0) {
      ctx.shadowColor = "rgba(255,144,65,.9)";
      ctx.shadowBlur = 12 + g.barricadeHitFlash * 24;
    }
    if (breached) {
      ctx.translate(barrier.drawX + barrier.width * .48, barrier.drawY + barrier.height * .78);
      ctx.rotate(-collapse * .12);
      ctx.translate(-(barrier.drawX + barrier.width * .48), -(barrier.drawY + barrier.height * .78));
      ctx.translate(collapse * 18, collapse * collapse * 76);
    }
    ctx.globalAlpha = breached ? Math.max(0, 1 - collapse * 1.2) : .94 + ratio * .06;
    if (productionBaseSprite === stationRelaySprite) {
      ctx.drawImage(
        productionBaseSprite,
        1080,
        210,
        360,
        540,
        barrier.drawX,
        barrier.drawY + 28,
        barrier.width,
        285,
      );
    } else {
      ctx.drawImage(productionBaseSprite, barrier.drawX, barrier.drawY, barrier.width, barrier.height);
    }
    ctx.restore();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  if (!g.barricadeVulnerable && !breached) {
    const shield = ctx.createLinearGradient(barrier.drawX, 0, barrier.drawX + 36, 0);
    shield.addColorStop(0, "rgba(103,198,220,.28)");
    shield.addColorStop(1, "rgba(103,198,220,0)");
    ctx.fillStyle = shield;
    ctx.fillRect(barrier.drawX - 4, barrier.drawY + 42, 52, barrier.height - 58);
    ctx.strokeStyle = `rgba(122,220,238,${.3 + Math.sin(g.time * 5) * .1})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barrier.drawX + 3, barrier.drawY + 40);
    ctx.lineTo(barrier.drawX + 3, barrier.drawY + barrier.height - 12);
    ctx.stroke();
  }

  if (!breached) {
    const lights = [[barrier.drawX + 43, barrier.drawY + 40], [barrier.drawX + 92, barrier.drawY + 51], [barrier.drawX + 133, barrier.drawY + 78]];
    for (let i = 0; i < lights.length; i++) {
      const [x, y] = lights[i];
      const working = damageLevel === 0 || (damageLevel === 1 && i < 2) || (damageLevel === 2 && i === 0);
      ctx.fillStyle = working ? `rgba(255,202,91,${.72 + Math.sin(g.time * 8 + i) * .18})` : i === 0 && damageLevel === 3 ? "#db4f35" : "#292625";
      ctx.beginPath(); ctx.arc(x, y, working ? 6 : 5, 0, Math.PI * 2); ctx.fill();
    }

    if (damageLevel >= 1) {
      const x = (value: number) => barrier.drawX + barrier.width * value;
      const y = (value: number) => barrier.drawY + barrier.height * value;
      const crackPaths = [
        [[.29, .26], [.34, .3], [.31, .34], [.37, .38]],
        [[.63, .37], [.58, .42], [.62, .47], [.57, .52]],
        [[.46, .56], [.51, .61], [.47, .67], [.54, .72]],
      ];
      const visibleCracks = damageLevel === 1 ? 1 : damageLevel === 2 ? 2 : 3;
      ctx.save();
      ctx.beginPath();
      ctx.rect(barrier.drawX + 2, barrier.drawY + 2, barrier.width - 4, barrier.height - 4);
      ctx.clip();
      ctx.strokeStyle = damageLevel === 1 ? "rgba(100,67,49,.58)" : damageLevel === 2 ? "rgba(126,70,47,.76)" : "rgba(151,63,42,.84)";
      ctx.lineWidth = damageLevel === 1 ? 1.25 : damageLevel === 2 ? 1.6 : 1.9;
      for (const path of crackPaths.slice(0, visibleCracks)) {
        ctx.beginPath();
        path.forEach(([px, py], index) => index === 0 ? ctx.moveTo(x(px), y(py)) : ctx.lineTo(x(px), y(py)));
        ctx.stroke();
      }

      if (damageLevel >= 2) {
        ctx.strokeStyle = damageLevel === 2 ? "rgba(96,82,68,.72)" : "rgba(119,71,52,.8)";
        ctx.lineWidth = damageLevel === 2 ? 1.5 : 1.8;
        ctx.beginPath();
        ctx.moveTo(x(.19), y(.48)); ctx.lineTo(x(.34), y(.5)); ctx.lineTo(x(.39), y(.55));
        ctx.moveTo(x(.61), y(.63)); ctx.lineTo(x(.72), y(.6)); ctx.lineTo(x(.77), y(.66));
        ctx.stroke();
      }

      if (damageLevel >= 3) {
        const fragments = [
          [[.31, .46], [.39, .44], [.41, .5], [.34, .53]],
          [[.58, .63], [.67, .65], [.63, .71], [.55, .68]],
        ];
        ctx.fillStyle = "rgba(39,31,28,.72)";
        for (const fragment of fragments) {
          ctx.beginPath();
          fragment.forEach(([px, py], index) => index === 0 ? ctx.moveTo(x(px), y(py)) : ctx.lineTo(x(px), y(py)));
          ctx.closePath(); ctx.fill();
        }
      }

      const smokeAnchors = [[.28, .28], [.63, .43], [.42, .61], [.7, .24]];
      for (let i = 0; i < damageLevel + 1; i++) {
        const [smokeX, smokeY] = smokeAnchors[i];
        const rise = (g.time * (7 + i * 1.5) + i * 9) % 16;
        ctx.globalAlpha = .07 + damageLevel * .055;
        ctx.fillStyle = "#191716";
        ctx.beginPath();
        ctx.arc(x(smokeX), y(smokeY) - rise, 5 + damageLevel * 1.4 + i, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  if (breached) {
    const groundY = barrier.drawY + barrier.height - 8;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#302723";
    for (let i = 0; i < 9; i++) {
      const spread = (i - 4) * 19;
      const fall = Math.min(1, collapse * 1.7);
      ctx.save();
      ctx.translate(barrier.drawX + barrier.width * .52 + spread * fall, groundY - (1 - fall) * (30 + (i % 3) * 24));
      ctx.rotate((i - 4) * .13 * fall);
      const debrisWidth = 22 + (i % 2) * 8;
      const debrisHeight = 14 + (i % 3) * 4;
      ctx.beginPath();
      ctx.moveTo(-11, -7);
      ctx.lineTo(debrisWidth - 11, -debrisHeight * .34);
      ctx.lineTo(debrisWidth * .42, debrisHeight - 7);
      ctx.lineTo(-debrisWidth * .45, debrisHeight * .28);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    const dust = Math.sin(Math.min(1, collapse) * Math.PI);
    ctx.globalAlpha = .18 + dust * .34;
    ctx.fillStyle = "#9c7a5c";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(barrier.drawX + 30 + i * 32, groundY - dust * (18 + i * 3), 24 + dust * 20, 10 + dust * 13, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (collapse >= .82) {
      ctx.fillStyle = "#d36b42"; ctx.font = "900 14px monospace"; ctx.textAlign = "center";
      ctx.fillText("感染拠点 破壊", barrier.drawX + barrier.width / 2, barrier.drawY + barrier.height - 42);
      ctx.textAlign = "left";
    }
  }

  if (!breached && g.barricadeHitFlash > 0) {
    const hitX = barrier.attackX;
    const glow = ctx.createRadialGradient(hitX, g.barricadeHitY - 18, 4, hitX, g.barricadeHitY - 18, 52);
    glow.addColorStop(0, `rgba(255,213,108,${Math.min(.75, g.barricadeHitFlash * 3)})`);
    glow.addColorStop(1, "rgba(218,67,32,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.fillRect(hitX - 55, g.barricadeHitY - 76, 110, 116);
  }
  ctx.restore();
}

function drawEmergencySupport(ctx: CanvasRenderingContext2D, g: Game) {
  const runtime = g.airstrike;
  if (runtime.phase === "idle" || runtime.targetX === null) return;
  const y = Number.isFinite(runtime.targetY)
    ? runtime.targetY as number
    : activeLaneCenters[runtime.targetLane ?? 1];
  ctx.save();
  if (["targeting", "inbound", "impact"].includes(runtime.phase)) {
    const pulse = AIRSTRIKE_DEF.radius * (.82 + Math.sin(g.time * 13) * .04);
    ctx.strokeStyle = runtime.phase === "impact" ? "#fff3b0" : "rgba(230,76,55,.8)";
    ctx.lineWidth = runtime.phase === "impact" ? 5 : 2.5;
    ctx.setLineDash(runtime.phase === "targeting" ? [8, 6] : []);
    ctx.beginPath(); ctx.ellipse(runtime.targetX, y, pulse, pulse * .34, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(runtime.targetX - 28, y); ctx.lineTo(runtime.targetX + 28, y); ctx.moveTo(runtime.targetX, y - 18); ctx.lineTo(runtime.targetX, y + 18); ctx.stroke();
  }
  if (runtime.phase === "inbound") {
    const progress = 1 - runtime.phaseTime / AIRSTRIKE_DEF.inboundSeconds;
    const jetX = -80 + progress * (W + 160);
    ctx.fillStyle = "#333b3c"; ctx.beginPath(); ctx.moveTo(jetX, 86); ctx.lineTo(jetX - 34, 96); ctx.lineTo(jetX - 8, 80); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(225,220,196,.34)"; ctx.beginPath(); ctx.moveTo(jetX - 38, 92); ctx.lineTo(jetX - 130, 82); ctx.stroke();
  }
  if (runtime.phase === "impact") {
    const glow = ctx.createRadialGradient(runtime.targetX, y, 3, runtime.targetX, y, AIRSTRIKE_DEF.radius);
    glow.addColorStop(0, "rgba(255,245,184,.95)"); glow.addColorStop(.22, "rgba(255,154,65,.72)"); glow.addColorStop(1, "rgba(189,50,29,0)");
    ctx.fillStyle = glow; ctx.fillRect(runtime.targetX - AIRSTRIKE_DEF.radius, y - AIRSTRIKE_DEF.radius, AIRSTRIKE_DEF.radius * 2, AIRSTRIKE_DEF.radius * 2);
  }
  ctx.restore();
}

function drawCrawlerBarrage(ctx: CanvasRenderingContext2D, g: Game) {
  if (g.crawlerAbility.phase !== "firing") return;
  const crawler = WORLD_GEOMETRY.crawler;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const pulse = 16 + Math.sin(g.time * 48) * 5;
  const muzzleX = crawler.weaponX + 45;
  const muzzleY = crawler.weaponY - 18;
  const glow = ctx.createRadialGradient(muzzleX, muzzleY, 2, muzzleX, muzzleY, pulse * 1.7);
  glow.addColorStop(0, "rgba(255,247,196,.95)");
  glow.addColorStop(.32, "rgba(255,179,68,.72)");
  glow.addColorStop(1, "rgba(255,117,42,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(muzzleX - pulse * 2, muzzleY - pulse * 2, pulse * 4, pulse * 4);
  ctx.restore();
}

function stageObjectStatesForGame(g: Game) {
  if (g.definition.stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET) {
    const trapSprung = g.enemyKindsSeen.includes("runner");
    const signFallen = g.enemyKindsSeen.includes("spitter");
    const baseExposed = g.barricadeBucklingAnnounced;
    const baseDestroyed = g.barricadeHp <= 0;
    return [
      "static-dressing",
      trapSprung ? "trap-sprung" : "trap-armed",
      signFallen ? "sign-fallen" : "sign-hanging",
      baseExposed ? "shutter-open" : "shutter-closed",
      baseDestroyed ? "base-destroyed" : "base-exposed",
    ];
  }
  if (g.definition.stageId === CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE) {
    return [
      "static-dressing",
      g.convoyProgress >= 5 / 6 ? "evac-ready" : "evac-blocked",
      g.convoyProgress >= 1 / 2 ? "rubble-cleared" : "rubble-blocking",
      "under-fire",
      g.convoyProgress >= 1 / 6 ? "supplies-open" : "supplies-sealed",
    ];
  }
  if (g.definition.stageId !== CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE) return [];
  const bossIncoming = g.enemySpawn.pending.some((entry) => entry.kind === "takuya");
  const nestState = g.barricadeHp <= 0 ? "nest-destroyed"
    : g.bossDefeated && g.barricadeHp / Math.max(1, g.barricadeMaxHp) <= .7 ? "nest-damaged"
      : g.bossDefeated ? "nest-exposed" : "nest-dormant";
  return ["static-dressing", g.bossDefeated ? "transmitter-damaged" : "transmitter-active", nestState, ...(bossIncoming ? ["takuya-entry"] : [])];
}

function activeStageObjectsForGame(g: Game) {
  if (!STAGE_OBJECT_MANIFEST[g.definition.stageId]) return [];
  return stageObjectsFor(g.definition.stageId, stageObjectStatesForGame(g));
}

function stageObjectForbiddenZonesForGame(g: Game) {
  return activeStageObjectsForGame(g)
    .filter((object) => object.collision)
    .map((object) => {
      const renderY = stageObjectRenderY(object);
      const halfHeight = (object.collision?.height ?? 0) / 2;
      return {
        id: object.id,
        minX: object.placement.x - (object.collision?.width ?? 0) / 2,
        maxX: object.placement.x + (object.collision?.width ?? 0) / 2,
        minY: renderY - halfHeight,
        maxY: renderY + halfHeight,
      };
    });
}

function correctedBattlefieldTargetForGame(
  g: Game,
  requested: { x: number; y: number },
  kind: SupplyKind | null,
) {
  const def = kind ? supplyDefs[kind] : null;
  const placementClearance = def?.placementClearance ?? 0;
  return nearestValidBattlefieldPlacement({
    stageId: g.definition.stageId,
    viewport: activeStageViewportId,
    requested,
    radius: kind === "pod" ? 22 : kind ? 18 : 0,
    clearance: placementClearance,
    obstacles: kind
      ? g.battlefieldObjects
        .filter((object) => object.phase !== "expired" && object.phase !== "destroying")
        .map((object) => ({
          id: `supply-${object.id}`,
          x: object.x,
          y: object.y,
          clearance: Math.max(placementClearance, supplyDefs[object.kind]?.placementClearance ?? placementClearance),
        }))
      : [],
    forbiddenAreas: stageObjectForbiddenZonesForGame(g),
  });
}

function hasBattleSpaceLineOfSight(g: Game, attacker: Fighter, target: Fighter) {
  if (attacker.range <= 64) return true;
  const supplyObstacles = g.battlefieldObjects
    .filter((object) => object.blocksEnemies && ["impact", "active"].includes(object.phase))
    .map((object) => ({
      id: `supply-${object.id}`,
      minX: object.x - 18,
      maxX: object.x + 18,
      minY: object.y - 31,
      maxY: object.y + 12,
    }));
  return battleSpaceLineOfSight({
    from: attacker,
    to: target,
    obstacles: [...stageObjectForbiddenZonesForGame(g), ...supplyObstacles],
    padding: 2,
  }).clear;
}

function stageObjectRenderY(object: ReturnType<typeof stageObjectsFor>[number]) {
  return object.placement.y >= 400
    ? object.placement.y + (activeLaneCenters[2] - LANE_Y[2])
    : object.placement.y;
}

function drawStageObjectOverlays(
  ctx: CanvasRenderingContext2D,
  objects: ReturnType<typeof stageObjectsFor>,
  images: SpriteMap,
  depthBands: readonly string[],
) {
  for (const object of objects
    .filter((candidate) => depthBands.includes(candidate.depthBand))
    .sort((a, b) => a.placement.z - b.placement.z)) {
    const image = images[object.id];
    if (!image?.complete || !image.naturalWidth) continue;
    const height = object.placement.width * image.naturalHeight / image.naturalWidth;
    const renderY = stageObjectRenderY(object);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      image,
      object.placement.x - object.placement.width * object.placement.anchorX,
      renderY - height * object.placement.anchorY,
      object.placement.width,
      height,
    );
    ctx.restore();
  }
}

function drawStageBackground(ctx: CanvasRenderingContext2D, g: Game, background: HTMLImageElement) {
  const compact = compactBattleViewport();
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#111617";
  ctx.fillRect(0, 0, W, H);
  if (compact && g.definition.stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET) {
    ctx.drawImage(background, 0, 0, background.naturalWidth, background.naturalHeight, 0, -73, W, 500);
  } else if (compact && g.definition.stageId === CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE) {
    const cropTop = Math.round(background.naturalHeight * .24);
    ctx.drawImage(background, 0, cropTop, background.naturalWidth, background.naturalHeight - cropTop, 0, 0, W, H);
  } else if (compact && g.definition.stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE) {
    const cropTop = Math.round(background.naturalHeight * .2);
    ctx.drawImage(background, 0, cropTop, background.naturalWidth, background.naturalHeight - cropTop, 0, 0, W, H);
  } else if (g.definition.stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET) {
    const cropTop = Math.round(background.naturalHeight * .2);
    ctx.drawImage(background, 0, cropTop, background.naturalWidth, background.naturalHeight - cropTop, 0, 0, W, H);
  } else if (g.definition.stageId === CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE) {
    const cropTop = Math.round(background.naturalHeight * .2);
    ctx.drawImage(background, 0, cropTop, background.naturalWidth, background.naturalHeight - cropTop, 0, 0, W, H);
  } else if (g.definition.stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE) {
    const cropTop = Math.round(background.naturalHeight * .17);
    ctx.drawImage(background, 0, cropTop, background.naturalWidth, background.naturalHeight - cropTop, 0, 0, W, H);
  } else if ([
    CAMPAIGN_STAGE_IDS.BAY_TOWER_SERVICE,
    CAMPAIGN_STAGE_IDS.CIVIC_ARCHIVE_ROUTE,
    CAMPAIGN_STAGE_IDS.COASTAL_LINK_BRIDGE,
  ].includes(g.definition.stageId)) {
    const cropTop = Math.round(background.naturalHeight * .12);
    ctx.drawImage(background, 0, cropTop, background.naturalWidth, background.naturalHeight - cropTop, 0, 0, W, H);
  } else if (g.definition.stageId === CAMPAIGN_STAGE_IDS.ESTUARY_FLOODGATE_SEAL) {
    const cropTop = Math.round(background.naturalHeight * .18);
    ctx.drawImage(background, 0, cropTop, background.naturalWidth, background.naturalHeight - cropTop, 0, 0, W, H);
  } else {
    ctx.drawImage(background, 0, 0, W, H);
  }
  ctx.restore();
}

function drawDiagnosticStationBackground(ctx: CanvasRenderingContext2D, g: Game) {
  if (![CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE, CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM, CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL].includes(g.definition.stageId)) {
    ctx.fillStyle = "#111617";
    ctx.fillRect(0, 0, W, H);
    return;
  }
  const gate = g.definition.stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE;
  const platform = g.definition.stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM;
  ctx.fillStyle = gate ? "#202323" : platform ? "#171d20" : "#17191a";
  ctx.fillRect(0, 0, W, H);
  const wall = ctx.createLinearGradient(0, 0, 0, activeLaneCenters[0] - 70);
  wall.addColorStop(0, gate ? "#323737" : platform ? "#253038" : "#292b2b");
  wall.addColorStop(1, "#151919");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, activeLaneCenters[0] - 58);
  ctx.fillStyle = gate ? "#3a3731" : platform ? "#32373a" : "#2e302f";
  ctx.fillRect(0, activeLaneCenters[0] - 58, W, activeLaneCenters[2] - activeLaneCenters[0] + 132);
  ctx.strokeStyle = "rgba(219,183,112,.18)";
  ctx.lineWidth = 2;
  for (const lane of [0, 1, 2] as Lane[]) {
    ctx.beginPath();
    ctx.moveTo(BASE_X + 28, activeLaneCenters[lane] + 13);
    ctx.lineTo(912, activeLaneCenters[lane] + 13);
    ctx.stroke();
  }
  if (gate) {
    for (let index = 0; index < 5; index++) {
      const x = 650 + index * 54;
      ctx.fillStyle = "#464b49"; ctx.fillRect(x, activeLaneCenters[0] - 52, 34, activeLaneCenters[2] - activeLaneCenters[0] + 88);
      ctx.fillStyle = "#b45d49"; ctx.fillRect(x + 7, activeLaneCenters[0] - 42, 20, 8);
    }
  } else if (platform) {
    ctx.fillStyle = "#101416";
    ctx.fillRect(0, activeLaneCenters[2] + 52, W, H - activeLaneCenters[2] - 52);
    ctx.strokeStyle = "#808581"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, activeLaneCenters[2] + 75); ctx.lineTo(W, activeLaneCenters[2] + 75); ctx.stroke();
    ctx.strokeStyle = "#d8b84d"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, activeLaneCenters[2] + 43); ctx.lineTo(W, activeLaneCenters[2] + 43); ctx.stroke();
  } else {
    ctx.strokeStyle = "#4d5453"; ctx.lineWidth = 18;
    ctx.beginPath(); ctx.moveTo(0, activeLaneCenters[0] - 74); ctx.lineTo(W, activeLaneCenters[0] - 74); ctx.stroke();
    ctx.strokeStyle = "#29302f"; ctx.lineWidth = 8;
    for (let x = 110; x < W; x += 120) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, activeLaneCenters[0] - 62); ctx.stroke();
    }
  }
  ctx.fillStyle = "rgba(255,255,255,.58)";
  ctx.font = "900 11px monospace";
  ctx.fillText("STATION ART LOAD FALLBACK // CHECK ASSET MANIFEST", 18, 24);
}

function drawStageGeometryDebug(ctx: CanvasRenderingContext2D, g: Game) {
  const geometry = stageGeometryFor(g.definition.stageId, activeStageViewportId);
  ctx.save();
  ctx.globalAlpha = .82;
  ctx.setLineDash([7, 5]);
  for (const primitive of stageDebugPrimitives(g.definition.stageId, activeStageViewportId)) {
    ctx.strokeStyle = primitive.role === "walkable-floor" ? "#62d8a1"
      : primitive.role === "logical-lane" ? "#7bbde8"
        : primitive.role === "forbidden-floor" ? "#e36b5d"
          : primitive.role === "objective-anchor" || primitive.role === "objective-route" ? "#f1cb62"
            : "#d8e1df";
    ctx.lineWidth = primitive.role === "walkable-floor" ? 3 : 2;
    if (primitive.kind === "rect" && "minX" in primitive) {
      ctx.strokeRect(
        primitive.minX,
        primitive.minY,
        primitive.maxX - primitive.minX,
        primitive.maxY - primitive.minY,
      );
    } else if (primitive.kind === "line" && "x1" in primitive) {
      ctx.beginPath();
      ctx.moveTo(primitive.x1, primitive.y1);
      ctx.lineTo(primitive.x2, primitive.y2);
      ctx.stroke();
    } else if (primitive.kind === "circle" && "x" in primitive) {
      ctx.beginPath();
      ctx.arc(primitive.x, primitive.y, primitive.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  const audit = combatReadyGroundingAudit({ geometry, fighters: g.fighters });
  const offFloorIds = new Set(audit.offFloor.map(({ id }) => id));
  for (const fighter of g.fighters) {
    if (!fighter.combatReady || fighter.hp <= 0) continue;
    ctx.strokeStyle = offFloorIds.has(fighter.id) ? "#ff4f45" : fighter.side === "human" ? "#74e0b0" : "#ef9b72";
    ctx.lineWidth = offFloorIds.has(fighter.id) ? 4 : 1.5;
    ctx.beginPath();
    ctx.arc(fighter.x, fighter.y, fighter.bodyRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillRect(fighter.x - 2, fighter.y - 2, 4, 4);
  }
  ctx.fillStyle = "rgba(8,12,13,.88)";
  ctx.fillRect(14, H - 42, 300, 28);
  ctx.fillStyle = audit.offFloorCount === 0 ? "#9fe1b5" : "#ff7d70";
  ctx.font = "900 12px monospace";
  ctx.fillText(`GEOMETRY ${geometry.viewport.id} // OFF-FLOOR ${audit.offFloorCount}`, 24, H - 24);
  ctx.restore();
}

function drawWorld(
  ctx: CanvasRenderingContext2D,
  g: Game,
  background: HTMLImageElement | null,
  sprites: SpriteMap,
  stageObjects: SpriteMap,
  enemyBaseSprite: HTMLImageElement | null,
  debugGeometry = false,
) {
  const shakeAmplitude = cameraShakeAmplitude(g.shake);
  const sx = shakeAmplitude > 0 ? (Math.random() - .5) * shakeAmplitude : 0;
  const sy = shakeAmplitude > 0 ? (Math.random() - .5) * shakeAmplitude : 0;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
  if (background?.complete && background.naturalWidth) {
    drawStageBackground(ctx, g, background);
  } else drawDiagnosticStationBackground(ctx, g);
  ctx.save();
  ctx.translate(sx, sy);
  const grade = ctx.createLinearGradient(0, 0, W, 0);
  grade.addColorStop(0, "rgba(23,28,31,.18)"); grade.addColorStop(.55, "rgba(15,13,12,.04)"); grade.addColorStop(1, "rgba(58,18,12,.2)");
  ctx.fillStyle = grade; ctx.fillRect(0, 0, W, H);

  const activeStageObjects = activeStageObjectsForGame(g);
  drawStageObjectOverlays(ctx, activeStageObjects, stageObjects, ["rear-scenery"]);

  // Units reveal the three routes through movement; no lane-map overlay is drawn over the battlefield.

  // The Crawler stays behind combatants; only its doorway masks a unit during deployment.
  drawCrawler(ctx, g, sprites);

  // A single shared-HP infected checkpoint closes all three routes.
  if (g.definition.enemyBaseMode !== "scenery") {
    drawEnemyBase(ctx, g, enemyBaseSprite, stageObjects);
  }
  drawStageObjectOverlays(ctx, activeStageObjects, stageObjects, ["objective"]);

  for (const effect of selectAreaEffectsForRender(g.areaEffects) as AreaEffect[]) drawAreaEffect(ctx, effect, g.time);
  for (const effect of g.manualAbilityVfx) drawManualAbilityVfx(ctx, effect);
  for (const hazard of g.stationHazards) drawStationHazard(ctx, hazard, g.time);
  drawStationMission(ctx, g, stageObjects);
  drawEmergencySupport(ctx, g);
  drawPlacementIndicator(ctx, g.placementIndicator);

  for (const corpse of g.corpses) {
    const allyCue = corpse.side === "human" ? allyCorpseVisualCue(corpse, g.time) : null;
    const fallDirection = corpse.variant % 2 === 0 ? -1 : 1;
    ctx.save();
    const sprite = sprites[corpse.kind];
    if (sprite?.complete && sprite.naturalWidth) {
      const frame = spriteFrameFor(corpse.kind, "death", corpse.side === "human" ? "right" : "left");
      const authoredSize = fitSpriteBattleDisplaySize(corpse.kind, frame, spriteDisplaySize(corpse.kind));
      const compactScale = compactBattleViewport() ? COMPACT_BATTLE_SPRITE_SCALE : 1;
      const depthScale = activeBattlefieldDepthScale(corpse.y);
      const width = authoredSize.w * compactScale * depthScale;
      const height = authoredSize.h * compactScale * depthScale;
      const authoredDeathPose = frame.derivedFrom !== "hit";
      const timing = ENEMY_DEATH_CONFIG.timings[corpse.deathClass ?? "normal"];
      const dyingProgress = corpse.side === "zombie"
        ? corpse.state === "dying" ? Math.min(1, corpse.phaseElapsed / timing.dyingSeconds) : 1
        : 1;
      const ashingProgress = corpse.state === "ashing" ? Math.min(1, corpse.phaseElapsed / timing.ashingSeconds) : 0;
      ctx.globalAlpha = corpse.state === "ash" ? Math.min(.55, corpse.life / 2)
        : corpse.state === "burning" ? .72
          : corpse.state === "ashing" ? Math.max(.08, .82 * (1 - ashingProgress))
            : corpse.state === "dying" ? .96 : .82;
      ctx.translate(corpse.x + (allyCue?.tremorX ?? 0), corpse.y + 5 + (allyCue?.tremorY ?? 0));
      const fallAngle = authoredDeathPose ? 0
        : corpse.side === "human" ? -1.18
          : corpse.deathClass === "boss" ? .68
            : corpse.deathClass === "heavy" ? .9 : 1.08;
      ctx.rotate(fallDirection * fallAngle * dyingProgress + (allyCue?.postureJitter ?? 0));
      if (corpse.state === "ashing") {
        ctx.filter = `grayscale(${Math.round(ashingProgress * 100)}%) sepia(${Math.round(ashingProgress * 70)}%) brightness(${1 - ashingProgress * .35})`;
        ctx.scale(1 - ashingProgress * .18, 1 - ashingProgress * .48);
      } else if (allyCue) {
        if (allyCue.skinTint === "light") ctx.filter = "grayscale(18%) sepia(32%) hue-rotate(34deg) saturate(.72) brightness(.9)";
        else if (allyCue.skinTint === "strong") ctx.filter = "grayscale(30%) sepia(52%) hue-rotate(42deg) saturate(.58) brightness(.76) contrast(1.08)";
        else if (allyCue.skinTint === "charred") ctx.filter = "grayscale(48%) sepia(70%) hue-rotate(335deg) saturate(.65) brightness(.58) contrast(1.18)";
        else if (allyCue.skinTint === "ash") ctx.filter = "grayscale(100%) brightness(.42) contrast(1.25)";
        ctx.scale(1, allyCue.bodyScaleY);
      }
      if (frame.flipX) ctx.scale(-1, 1);
      ctx.drawImage(
        sprite,
        frame.sourceRect.x,
        frame.sourceRect.y,
        frame.sourceRect.w,
        frame.sourceRect.h,
        -width * frame.anchorX,
        -height * frame.anchorY,
        width,
        height,
      );
      ctx.filter = "none";
    } else {
      ctx.globalAlpha = corpse.state === "ashing" || corpse.state === "ash" ? Math.min(.55, corpse.life / 2) : .65;
      ctx.translate(corpse.x, corpse.y + 7); ctx.scale(1, .45);
      ctx.fillStyle = corpse.kind === "takuya" || corpse.kind === "gate-eater" || corpse.kind === "shade" ? "#292d31" : corpse.side === "zombie" ? "#4e5a3e" : "#5d392f";
      ctx.beginPath(); ctx.ellipse(0, 0, corpse.kind === "abomination" || corpse.kind === "takuya" || corpse.kind === "gate-eater" ? 25 : 15, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (corpse.side === "zombie" && corpse.state === "dying" && corpse.kind === "takuya") {
      const pulse = 24 + corpse.phaseElapsed * 34;
      ctx.strokeStyle = `rgba(221,86,49,${Math.max(.12, .7 - corpse.phaseElapsed * .42)})`;
      ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(corpse.x, corpse.y - 30, pulse, pulse * .36, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (corpse.side === "zombie" && corpse.state === "ashing") {
      const timing = ENEMY_DEATH_CONFIG.timings[corpse.deathClass ?? "normal"];
      const ashProgress = Math.min(1, corpse.phaseElapsed / timing.ashingSeconds);
      for (let index = 0; index < (corpse.deathClass === "boss" ? 12 : corpse.deathClass === "heavy" ? 8 : 5); index++) {
        const drift = Math.sin(corpse.id * 1.7 + index * 2.3 + g.time * .9);
        ctx.globalAlpha = Math.max(0, .7 - ashProgress * .5 - index * .025);
        ctx.fillStyle = index % 3 === 0 ? "#a15d3e" : "#5d5d52";
        ctx.fillRect(corpse.x + drift * (12 + index * 1.8), corpse.y - 8 - ashProgress * (22 + index * 3), 2 + index % 3, 2 + index % 2);
      }
      ctx.globalAlpha = 1;
    }
    if (allyCue) {
      const headX = corpse.x - fallDirection * 24;
      if (allyCue.eyeGlint) {
        ctx.save();
        ctx.globalAlpha = .45 + Math.sin(g.time * 7 + corpse.id) * .16;
        ctx.fillStyle = "#b7c870"; ctx.shadowColor = "#80934d"; ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.ellipse(headX, corpse.y - 10, 2.2, 1.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      for (let index = 0; index < allyCue.smokePuffs; index++) {
        const drift = Math.sin(g.time * (1.7 + index * .24) + corpse.id + index * 2.1);
        const rise = (g.time * (9 + index * 2) + corpse.id * 3) % 22;
        ctx.globalAlpha = corpse.state === "burning" ? .25 : .12 + index * .05;
        ctx.fillStyle = corpse.state === "burning" ? "#342d29" : "#67705e";
        ctx.beginPath(); ctx.ellipse(corpse.x + drift * (7 + index * 2), corpse.y - 15 - rise, 4 + index * 1.5, 2.5 + index, 0, 0, Math.PI * 2); ctx.fill();
      }
      if (allyCue.flameTongues > 0) {
        for (let index = 0; index < allyCue.flameTongues; index++) {
          const phase = g.time * (13 + index) + corpse.id + index * 1.9;
          const baseX = corpse.x + Math.sin(phase * .7) * 17 + (index - 1.5) * 7;
          const baseY = corpse.y - 3 - Math.abs(Math.cos(phase)) * 5;
          const height = 15 + index * 3 + Math.sin(phase) * 4;
          ctx.globalAlpha = .58 + index * .06;
          ctx.fillStyle = index % 2 === 0 ? "#ef5f32" : "#f4b24f";
          ctx.beginPath(); ctx.moveTo(baseX - 5, baseY); ctx.quadraticCurveTo(baseX - 1, baseY - height * .55, baseX + Math.sin(phase) * 3, baseY - height); ctx.quadraticCurveTo(baseX + 6, baseY - height * .38, baseX + 5, baseY); ctx.closePath(); ctx.fill();
        }
      }
      if (corpse.state === "ash") {
        for (let index = 0; index < 4; index++) {
          const drift = Math.sin(corpse.id + index * 1.8 + g.time * .8);
          ctx.globalAlpha = .24 - index * .035;
          ctx.fillStyle = index % 2 === 0 ? "#858177" : "#4d4c48";
          ctx.fillRect(corpse.x + drift * (12 + index * 2), corpse.y - 4 - index * 4, 2 + index % 2, 2);
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  for (const fighter of g.fighters) drawMonkeyTrap(ctx, fighter);
  const renderables = [
    ...g.fighters.map((fighter) => ({ type: "fighter" as const, x: fighter.x, y: fighter.y, fighter })),
    ...g.battlefieldObjects.filter((object) => object.phase !== "expired").map((object) => ({ type: "object" as const, x: object.x, y: object.y, object })),
  ].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const renderable of renderables) {
    if (renderable.type === "object") { drawBattlefieldSupply(ctx, renderable.object, sprites); continue; }
    const f = renderable.fighter;
    if (f.combatReady) drawBossTelegraph(ctx, f, g);
    if (f.combatReady) drawStationEnemyTelegraph(ctx, f, g);
    drawSpriteFighter(ctx, f, sprites);
    if (f.combatReady) drawMotherCombatVfx(ctx, f, g);
    if (f.combatReady) drawAnomalyBossCombatVfx(ctx, f, g);
    if (f.combatReady) drawKuromeCombatVfx(ctx, f, g);
    drawKuromeVisionInterference(ctx, f, g);
    if (!f.combatReady) continue;
    const compactScale = compactBattleViewport() ? 1.1 : 1;
    const depthScale = activeBattlefieldDepthScale(f.y);
    const bossDefinition = bossDefinitionForEnemyKind(f.kind);
    const barW = (bossDefinition ? 58 : f.kind === "crusher" || f.kind === "grappler" || f.kind === "brute" || f.kind === "guardian" ? 38 : f.kind === "abomination" ? 52 : 28) * compactScale * depthScale;
    const height = bossDefinition
      ? !compactBattleViewport()
        ? bossDefinition.display.standardBodyHeight
        : bossDefinition.display.compactBodyHeight
      : (f.kind === "abomination" ? 115 : f.kind === "crusher" || f.kind === "grappler" || f.kind === "brute" || f.kind === "guardian" ? 94 : 80) * compactScale;
    const depthHeight = height * depthScale;
    const barHeight = compactScale > 1 ? 6 : 4;
    const barY = f.y - depthHeight - (compactScale > 1 ? 2 : 0);
    ctx.fillStyle = "rgba(0,0,0,.78)"; ctx.fillRect(f.x - barW / 2 - 1, barY - 1, barW + 2, barHeight + 2);
    ctx.fillStyle = f.side === "human" ? "#e9c65a" : "#cb5037";
    ctx.fillRect(f.x - barW / 2, barY, barW * Math.max(0, f.hp / f.maxHp), barHeight);
    if (f.side === "zombie" && f.marked > 0) {
      ctx.save();
      ctx.translate(f.x, barY - 10);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = `rgba(255,210,85,${Math.min(1, .45 + f.marked * .18)})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(-5, -5, 10, 10);
      ctx.restore();
    }
  }

  // Low roadside props sit below the routing corridor and mask only feet at
  // the near edge. Drawing them last prevents fighters from appearing on top
  // of wire, rubble, fallen signs, or supply crates.
  drawStageObjectOverlays(ctx, activeStageObjects, stageObjects, ["foreground-prop"]);

  drawCrawlerExitFrame(ctx, g, sprites);
  drawCrawlerBarrage(ctx, g);

  for (const shot of g.shots) {
    const duration = shot.duration ?? .12;
    const elapsed = Math.max(0, duration - shot.life);
    const impactDelay = Math.max(.001, shot.impactDelaySeconds ?? duration * .62);
    const hitStopSeconds = Math.max(0, shot.hitStopSeconds ?? 0);
    const recoverySeconds = Math.max(.001, duration - impactDelay - hitStopSeconds);
    const p = elapsed < impactDelay
      ? Math.min(1, elapsed / impactDelay)
      : 1;
    const impactProgress = elapsed < impactDelay
      ? -1
      : Math.min(1, (elapsed - impactDelay) / Math.max(.001, hitStopSeconds + recoverySeconds));
    const x = shot.x + (shot.tx - shot.x) * p;
    const y = shot.y + (shot.ty - shot.y) * p;
    const dx = shot.tx - shot.x;
    const dy = shot.ty - shot.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / distance;
    const uy = dy / distance;
    const weapon = shot.weapon ?? shot.effect ?? (shot.side === "human" ? "ranger" : "spitter");
    const weaponProfile = weaponProfileForUnit(weapon);
    const color = weapon === "spitter" ? "#91cf72"
      : weapon === "crawler" ? "#ffe09a"
        : shot.side === "human" ? weaponProfile.trailColor : "#e76747";
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = weapon === "crawler" ? 9 : 5;
    if (shot.style === "melee") {
      const strength = Math.max(.15, Math.min(1, shot.life / duration));
      const reach = shot.emphasized ? 18 : 11;
      ctx.globalAlpha = strength;
      ctx.lineWidth = shot.emphasized ? 4 : 2.25;
      ctx.beginPath(); ctx.arc(shot.tx, shot.ty, reach, -.9, 1.15); ctx.stroke();
      if (["crazy-king", "kumaverson", "brawler", "brute"].includes(weapon)) {
        ctx.beginPath(); ctx.moveTo(shot.tx - reach * .7, shot.ty - reach * .35); ctx.lineTo(shot.tx + reach * .65, shot.ty + reach * .4); ctx.stroke();
      }
    } else {
      const tailLength = weapon === "crawler" ? 46
        : weapon === "spitter" ? 18
          : weaponProfile.trail === "high-velocity" ? 36
            : weaponProfile.trail === "burst-tracer" ? 28
              : weaponProfile.trail === "bolt" ? 18
                : 22;
      ctx.lineWidth = weapon === "crawler" ? 2.8
        : weapon === "spitter" ? 2.4
          : weaponProfile.trail === "burst-tracer" ? 2.2
            : weaponProfile.trail === "high-velocity" ? 1.8
              : 1.45;
      ctx.beginPath();
      ctx.moveTo(x - ux * tailLength, y - uy * tailLength);
      ctx.lineTo(x, y);
      ctx.stroke();
      if (weapon === "crawler") {
        ctx.globalAlpha = .45;
        ctx.beginPath(); ctx.moveTo(x - ux * 30 - uy * 3, y - uy * 30 + ux * 3); ctx.lineTo(x - uy * 3, y + ux * 3); ctx.stroke();
      }
      if (p < .3) {
        const muzzle = 5 + (1 - p / .3) * (weapon === "crawler" ? 10 : 7 + (shot.recoil ?? weaponProfile.recoil) * 4);
        const flare = muzzle * (weapon === "crawler" ? .42 : .3);
        ctx.globalAlpha = .9;
        ctx.beginPath();
        ctx.moveTo(shot.x - ux * 2, shot.y - uy * 2);
        ctx.lineTo(shot.x + ux * muzzle + uy * flare, shot.y + uy * muzzle - ux * flare);
        ctx.lineTo(shot.x + ux * muzzle - uy * flare, shot.y + uy * muzzle + ux * flare);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = .45;
        ctx.beginPath();
        ctx.arc(shot.x + ux * muzzle * .55, shot.y + uy * muzzle * .55, flare * .72, 0, Math.PI * 2);
        ctx.fill();
      }
      if (shot.casing && p < .52) {
        const eject = 4 + (shot.shotIndex ?? 0) * 1.8 + p * 12;
        const casingX = shot.x - ux * 3 - uy * eject;
        const casingY = shot.y - uy * 3 + ux * eject + p * p * 9;
        ctx.save();
        ctx.translate(casingX, casingY);
        ctx.rotate(Math.atan2(dy, dx) + p * 8);
        ctx.globalAlpha = Math.max(0, 1 - p * 1.6);
        ctx.fillStyle = "#d8a94f";
        ctx.fillRect(-2.5, -1, 5, 2);
        ctx.restore();
      }
      if (impactProgress >= 0) {
        const impact = impactProgress;
        ctx.globalAlpha = 1 - impact * .7;
        ctx.lineWidth = weapon === "crawler" ? 2.5 : 1.5;
        const impactRadius = weapon === "crawler" ? 12 : weapon === "spitter" ? 8 : weaponProfile.impactRadius;
        ctx.beginPath(); ctx.arc(shot.tx, shot.ty, 3 + impact * impactRadius, 0, Math.PI * 2); ctx.stroke();
        for (let spark = 0; spark < 3; spark += 1) {
          const angle = spark * Math.PI * 2 / 3 + distance * .01;
          const length = 5 + impact * 7;
          ctx.beginPath(); ctx.moveTo(shot.tx, shot.ty); ctx.lineTo(shot.tx + Math.cos(angle) * length, shot.ty + Math.sin(angle) * length); ctx.stroke();
        }
      }
      if (shot.effect === "scout" && p > .45) {
        ctx.setLineDash([3, 3]); ctx.globalAlpha = .7;
        ctx.beginPath(); ctx.arc(shot.tx, shot.ty, 11, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
      if (shot.effect === "medic" && p > .58) {
        ctx.globalAlpha = .8; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(shot.tx - 7, shot.ty); ctx.lineTo(shot.tx + 7, shot.ty); ctx.moveTo(shot.tx, shot.ty - 7); ctx.lineTo(shot.tx, shot.ty + 7); ctx.stroke();
      }
    }
    ctx.restore();
  }
  ctx.shadowBlur = 0;
  for (const p of g.particles) {
    ctx.globalAlpha = Math.max(0, p.life * 1.6); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (const d of g.damageTexts) {
    ctx.globalAlpha = Math.min(1, d.life * 2); ctx.fillStyle = d.color; ctx.font = "bold 14px monospace"; ctx.textAlign = "center";
    ctx.shadowColor = "#000"; ctx.shadowBlur = 3; ctx.fillText(d.value, d.x, d.y);
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.textAlign = "left";
  if (g.flashOverlay > 0) {
    ctx.fillStyle = `rgba(255,193,106,${Math.min(.48, g.flashOverlay)})`; ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();

  if (debugGeometry) drawStageGeometryDebug(ctx, g);

  const nearestEnemyX = g.fighters.reduce((nearest, fighter) => fighter.side === "zombie" && fighter.hp > 0 ? Math.min(nearest, fighter.x) : nearest, Infinity);
  const threat = crawlerThreatLevel(nearestEnemyX);
  if (threat > 0 || g.crawlerHitFlash > 0) {
    ctx.save();
    const danger = ctx.createLinearGradient(0, 0, W * .38, 0);
    danger.addColorStop(0, `rgba(155,31,22,${.08 + threat * .2})`);
    danger.addColorStop(1, "rgba(155,31,22,0)");
    ctx.fillStyle = danger; ctx.fillRect(0, 0, W * .38, H);
    if (g.crawlerHitFlash > 0) {
      const hitGlow = ctx.createRadialGradient(112, 345, 6, 112, 345, 118);
      hitGlow.addColorStop(0, `rgba(255,126,69,${Math.min(.5, g.crawlerHitFlash * 2.8)})`);
      hitGlow.addColorStop(1, "rgba(178,35,22,0)");
      ctx.fillStyle = hitGlow; ctx.fillRect(0, 220, 250, 220);
    }
    ctx.restore();
  }
}

export function AshfallGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasTransformRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  const backgroundCacheRef = useRef<Record<string, HTMLImageElement>>({});
  const spriteRefs = useRef<SpriteMap>({});
  const stageObjectRefs = useRef<SpriteMap>({});
  const enemyBaseSpriteRef = useRef<HTMLImageElement | null>(null);
  const gameRef = useRef<Game>(initialGame("pod", INITIAL_STAGE_ID, ["brawler", "scout", "ranger", "medic"]));
  const productionMixerRef = useRef<ReturnType<typeof createAudioMixer> | null>(null);
  const sfxRequestGateRef = useRef(createAudioRequestGate());
  const desiredProductionSceneRef = useRef<string | null>("title");
  const battleRadioActiveRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const musicRef = useRef<MusicRuntime | null>(null);
  const jingleRef = useRef<JingleRuntime | null>(null);
  const sfxRuntimeRef = useRef<SfxRuntime | null>(null);
  const sfxMutedRef = useRef(false);
  const musicDuckUntilRef = useRef(0);
  const desiredMusicModeRef = useRef<MusicMode>("normal");
  const startSynthMusicRef = useRef<() => void>(() => undefined);
  const stopSynthMusicRef = useRef<() => void>(() => undefined);
  const musicStartTokenRef = useRef(0);
  const startCueTimerRef = useRef<number | null>(null);
  const resumeBattleAudioLoopsRef = useRef<(g: Game) => void>(() => undefined);
  const activeBurnLoopIdsRef = useRef<Set<number>>(new Set());
  const audioSuccessTimerRef = useRef<number | null>(null);
  const upgradeFeedbackTimerRef = useRef<number | null>(null);
  const volumePreviewLastAtRef = useRef(0);
  const audioActivationPendingRef = useRef(false);
  const audioAssetFailureRef = useRef(false);
  const pageHiddenRef = useRef(false);
  const fallbackAudioSuspendedRef = useRef(false);
  const runtimePerformanceRef = useRef({
    simulationTicks: 0,
    renderFrames: 0,
    hiddenFrameCallbacks: 0,
    visibilityTransitions: 0,
    backgroundDurationMs: 0,
    backgroundStartedAt: null as number | null,
  });
  const lastHudRef = useRef(0);
  const selectedActionRef = useRef<SelectedAction>(null);
  const eventDestinationRef = useRef<EventDestination>("map");
  const eventQueueRef = useRef<string[]>([]);
  const eventCompletionLockRef = useRef(false);
  const finalizedEndRef = useRef<BattleResult | null>(null);
  const survivalCheckpointSaveLocksRef = useRef(new Set<string>());
  const survivalSettlementPersistenceQaRef = useRef({ attempts: 0, failuresRemaining: 0 });
  const outbreakSettlementPersistenceQaRef = useRef({ attempts: 0, failuresRemaining: 0 });
  const bossFoundationQaRef = useRef<{
    entranceCounts: Record<string, number>;
    lastEntrance: { kind: string; cueId: string; warningLabel: string } | null;
    lastCounterplay: {
      kind: string;
      input: string;
      targetId: number;
      destinationLane: number;
    } | null;
    barrierChallenge: {
      bossId: number;
      humanId: number;
      targetX: number;
      attempted: boolean;
      blocked: boolean;
      resultingX: number | null;
    } | null;
  }>({
    entranceCounts: {},
    lastEntrance: null,
    lastCounterplay: null,
    barrierChallenge: null,
  });
  const qaScenarioAppliedRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pauseConfirm, setPauseConfirm] = useState<PauseAction | null>(null);
  const [bgmMuted, setBgmMuted] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(false);
  const [musicActive, setMusicActive] = useState(false);
  const [audioUnlockUi, setAudioUnlockUi] = useState<AudioUnlockUiState>("idle");
  const [audioUnlockVisible, setAudioUnlockVisible] = useState(true);
  const [assetsReady, setAssetsReady] = useState(false);
  const [assetError, setAssetError] = useState(false);
  const [qaMode, setQaMode] = useState<QaMode | null>(null);
  const [qaScenario, setQaScenario] = useState<ReturnType<typeof resolveLocalQaScenario>>(null);
  const [selectedSupply, setSelectedSupply] = useState<SupplyKind>("pod");
  const [selectedAction, setSelectedAction] = useState<SelectedAction>(null);
  const [screen, setScreen] = useState<CampaignScreen>("title");
  const upgradeLocksRef = useRef(new Set<string>());
  const [upgradePendingUnitIds, setUpgradePendingUnitIds] = useState<readonly string[]>([]);
  const [upgradeFeedback, setUpgradeFeedback] = useState<UpgradeFeedbackView | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [storyAudioPosition, setStoryAudioPosition] = useState<{ eventId: string | null; lineIndex: number }>({ eventId: null, lineIndex: 0 });
  const [forceStoryReplay, setForceStoryReplay] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState(INITIAL_STAGE_ID);
  const [selectedOutbreakMissionId, setSelectedOutbreakMissionId] = useState<string | null>(null);
  const activeOperationId = selectedOutbreakMissionId ?? selectedStageId;
  const activeBattlefieldStageId = selectedOutbreakMissionId
    ? OUTBREAK_MISSION_BY_ID[selectedOutbreakMissionId]?.prerequisiteStageId ?? selectedStageId
    : selectedStageId;
  const [campaignSave, setCampaignSave] = useState<CampaignSave>(() => createDefaultCampaignSave() as CampaignSave);
  const campaignSaveRef = useRef(campaignSave);
  useEffect(() => {
    campaignSaveRef.current = campaignSave;
  }, [campaignSave]);
  const [saveHydrated, setSaveHydrated] = useState(false);
  const [savePersistence, setSavePersistence] = useState<SavePersistenceState>("checking");
  const [saveRecovery, setSaveRecovery] = useState<SaveRecoveryState | null>(null);
  const [saveMutationPending, setSaveMutationPending] = useState(false);
  const [pendingResultCommit, setPendingResultCommit] = useState<PendingResultCommit | null>(null);
  const [resultSaveRetrying, setResultSaveRetrying] = useState(false);
  const lastPersistedSerializedRef = useRef("");
  const lastPersistedReplicaRef = useRef<PersistedReplicaReceipt>({ serialized: "", localSaved: false, backupSaved: false });
  const persistenceWriteBlockedSourcesRef = useRef<Set<string>>(new Set());
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveMutationPendingRef = useRef(false);
  const resultSaveRetryingRef = useRef(false);
  const formationUnitIds = useMemo(() => getSelectedFormationUnitIds(campaignSave), [campaignSave]);
  const formationKinds = useMemo(() => getSelectedFormationCombatKinds(campaignSave) as UnitKind[], [campaignSave]);
  const formationKindKey = formationKinds.join("|");
  const [campaignResult, setCampaignResult] = useState<CampaignResultView | null>(null);
  const [outbreakResult, setOutbreakResult] = useState<OutbreakResultView | null>(null);
  const [pendingOutbreakSettlement, setPendingOutbreakSettlement] = useState<PendingOutbreakSettlement | null>(null);
  const [outbreakSavePending, setOutbreakSavePending] = useState(false);
  const [selectedSurvivalStartWave, setSelectedSurvivalStartWave] = useState(1);
  const [survivalHud, setSurvivalHud] = useState<ReturnType<typeof survivalHudSnapshot>>(null);
  const [survivalResult, setSurvivalResult] = useState<SurvivalResultView | null>(null);
  const [survivalSavePending, setSurvivalSavePending] = useState(false);
  const [survivalSettlementAwaitingRetry, setSurvivalSettlementAwaitingRetry] = useState(false);
  const [pendingSurvivalCheckpoint, setPendingSurvivalCheckpoint] = useState<PendingSurvivalCheckpoint | null>(null);
  const [pendingSurvivalSettlement, setPendingSurvivalSettlement] = useState<PendingSurvivalSettlement | null>(null);
  const [hud, setHud] = useState<Hud>({
    missionType: "assault", energy: COMMAND_INITIAL, supportGauge: 0, scrap: 0, kills: 0, wave: 1, phase: 1, baseHp: 1000, baseMaxHp: 1000,
    barricadeHp: BARRICADE_MAX_HP, barricadeMaxHp: BARRICADE_MAX_HP, barricadeVulnerable: true, barricadeHitFlash: 0,
    deployQueue: 0, airstrikePhase: "idle", crawlerPhase: "cooldown", crawlerCharge: .5, combo: 0, bossHp: 0, bossMax: 0, bossKind: null, bossWorldX: null,
    takuyaEntranceAudioActive: false,
    crawlerHitFlash: 0, threat: 0,
    objective: objectiveFor(1, false), deployCooldowns: emptyCooldowns(), battleBarks: [], manualAbilityIcons: [],
  });
  const [end, setEnd] = useState<BattleResult | null>(null);

  const handleStoryAudioPositionChange = useCallback((nextEventId: string, lineIndex: number) => {
    const nextLineIndex = Number.isFinite(lineIndex) ? Math.max(0, Math.trunc(lineIndex)) : 0;
    setStoryAudioPosition((current) => (
      current.eventId === nextEventId && current.lineIndex === nextLineIndex
        ? current
        : { eventId: nextEventId, lineIndex: nextLineIndex }
    ));
  }, []);

  const enqueueCampaignStorageMutation = useCallback(<T,>(mutation: () => Promise<T>) => {
    const queued = persistenceQueueRef.current.then(mutation);
    persistenceQueueRef.current = queued.then(() => undefined, () => undefined);
    return queued;
  }, []);

  const beginSaveMutation = useCallback(() => {
    if (saveMutationPendingRef.current) return false;
    saveMutationPendingRef.current = true;
    setSaveMutationPending(true);
    return true;
  }, []);

  const finishSaveMutation = useCallback(() => {
    saveMutationPendingRef.current = false;
    setSaveMutationPending(false);
  }, []);

  const persistCampaignSave = useCallback((nextSave: CampaignSave): Promise<CampaignPersistResult> => {
    if (saveMutationPendingRef.current) {
      return Promise.resolve({ durable: false, localSaved: false, backupSaved: false, skipped: true });
    }
    const serialized = serializeCampaignSave(nextSave);
    return enqueueCampaignStorageMutation(async () => {
      const replica = lastPersistedReplicaRef.current;
      if (serialized === replica.serialized && replica.localSaved && replica.backupSaved) {
        return { durable: true, localSaved: true, backupSaved: true };
      }
      const storage = campaignStorageFor(window);
      const indexedDb = indexedDbFor(window);
      const previous = lastPersistedSerializedRef.current;
      if (previous) {
        const snapshot = await writeCampaignRecoverySnapshot({
          storage,
          indexedDb,
          key: CAMPAIGN_SAVE_KEY,
          kind: CAMPAIGN_SNAPSHOT_KINDS.LAST_KNOWN_GOOD,
          serialized: previous,
        });
        if (!snapshot.saved) {
          setSavePersistence("unavailable");
          return { durable: false, localSaved: false, backupSaved: false };
        }
      }
      const sameSerialized = serialized === replica.serialized;
      const alreadySavedSources = [
        ...(sameSerialized && replica.localSaved ? ["localStorage"] : []),
        ...(sameSerialized && replica.backupSaved ? ["indexedDB"] : []),
      ];
      const { localSaved, backupSaved } = await writeCampaignSaveReplicas({
        storage,
        indexedDb,
        key: CAMPAIGN_SAVE_KEY,
        serialized,
        blockedSources: [...persistenceWriteBlockedSourcesRef.current],
        alreadySavedSources,
      });
      if (localSaved || backupSaved) {
        lastPersistedSerializedRef.current = serialized;
        lastPersistedReplicaRef.current = { serialized, localSaved, backupSaved };
      }
      setSavePersistence(localSaved || backupSaved ? (localSaved && backupSaved ? "saved" : "recovered") : "unavailable");
      return {
        durable: localSaved || backupSaved,
        localSaved,
        backupSaved,
      };
    });
  }, [enqueueCampaignStorageMutation]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQaMode(resolveLocalQaMode(window.location.hostname, window.location.search) as QaMode | null);
      setQaScenario(resolveLocalQaScenario(window.location.hostname, window.location.search));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const storage = campaignStorageFor(window);
      const indexedDb = indexedDbFor(window);
      const reconciled = await reconcileCampaignStorage({
        storage,
        indexedDb,
        key: CAMPAIGN_SAVE_KEY,
        validate: (serialized: string, context: { source: string }) => inspectCampaignSaveCandidate(serialized, { source: context.source }),
      });
      if (cancelled) return;
      persistenceWriteBlockedSourcesRef.current = new Set(reconciled.writeBlockedSources ?? []);
      if (reconciled.status === "recovery-needed") {
        setSaveRecovery(reconciled as SaveRecoveryState);
        setSavePersistence("unavailable");
        return;
      }
      if (reconciled.status === "unavailable") {
        setSavePersistence("unavailable");
        return;
      }
      if (reconciled.repairBlockedBySnapshot) {
        lastPersistedSerializedRef.current = reconciled.serialized || "";
        lastPersistedReplicaRef.current = {
          serialized: reconciled.serialized || "",
          localSaved: reconciled.source === "localStorage",
          backupSaved: reconciled.source === "indexedDB",
        };
        setSaveRecovery({
          ...(reconciled as SaveRecoveryState),
          status: "recovery-needed",
          recoveryReason: "last-known-good-snapshot-failed",
        });
        setSavePersistence("unavailable");
        return;
      }
      const loaded = (reconciled.value ?? createDefaultCampaignSave()) as CampaignSave;
      const selectedCandidate = reconciled.candidates?.find((candidate: { source: string }) => candidate.source === reconciled.source);
      const sourceSchemaVersion = Number(selectedCandidate?.validation?.sourceSchemaVersion);
      if (reconciled.serialized
        && Number.isFinite(sourceSchemaVersion)
        && sourceSchemaVersion < CAMPAIGN_SAVE_SCHEMA_VERSION) {
        const snapshot = await writeCampaignRecoverySnapshot({
          storage,
          indexedDb,
          key: CAMPAIGN_SAVE_KEY,
          kind: CAMPAIGN_SNAPSHOT_KINDS.PRE_MIGRATION,
          serialized: reconciled.serialized,
        });
        if (!snapshot.saved) {
          setSaveRecovery({
            ...(reconciled as SaveRecoveryState),
            status: "recovery-needed",
            recoveryReason: "pre-migration-snapshot-failed",
          });
          setSavePersistence("unavailable");
          return;
        }
      }
      if (cancelled) return;
      lastPersistedSerializedRef.current = reconciled.serialized || "";
      lastPersistedReplicaRef.current = {
        serialized: reconciled.serialized || "",
        localSaved: Boolean(reconciled.serialized && (
          reconciled.candidates?.some((candidate: { source: string; valid: boolean; serialized: string }) => candidate.source === "localStorage" && candidate.valid && candidate.serialized === reconciled.serialized)
          || reconciled.repairedSources?.includes("localStorage")
        )),
        backupSaved: Boolean(reconciled.serialized && (
          reconciled.candidates?.some((candidate: { source: string; valid: boolean; serialized: string }) => candidate.source === "indexedDB" && candidate.valid && candidate.serialized === reconciled.serialized)
          || reconciled.repairedSources?.includes("indexedDB")
        )),
      };
      const legacyQa = resolveLocalQaMode(window.location.hostname, window.location.search) as QaMode | null;
      const campaignQa = resolveLocalQaScenario(window.location.hostname, window.location.search);
      const localQaAudio = Boolean(legacyQa || campaignQa);
      setCampaignSave(loaded);
      setSelectedStageId(legacyQa ? CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE : loaded.lastSelectedStageId);
      if (legacyQa) setScreen("loadout");
      const loadedBgmMuted = !loaded.settings.bgmEnabled || loaded.settings.bgmVolume <= 0;
      const loadedSfxMuted = !loaded.settings.sfxEnabled || loaded.settings.sfxVolume <= 0;
      setBgmMuted(localQaAudio ? false : loadedBgmMuted);
      sfxMutedRef.current = localQaAudio ? false : loadedSfxMuted;
      setSfxMuted(localQaAudio ? false : loadedSfxMuted);
      setSavePersistence(reconciled.status === "recovered" || reconciled.status === "degraded"
        ? "recovered"
        : reconciled.status === "unavailable"
          ? "unavailable"
          : reconciled.status === "empty"
            ? "checking"
            : "saved");
      setSaveHydrated(true);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!saveHydrated) return;
    // Local QA can expose every unit and stage, but must never turn those
    // conveniences into ordinary campaign progress.
    if (resolveLocalQaMode(window.location.hostname, window.location.search)
      || resolveLocalQaScenario(window.location.hostname, window.location.search)) return;
    void persistCampaignSave(campaignSave);
  }, [campaignSave, persistCampaignSave, saveHydrated]);

  useEffect(() => {
    const sfxRequestGate = sfxRequestGateRef.current;
    const mixer = createAudioMixer({
      manifest: PRODUCTION_AUDIO_MANIFEST,
      maxVoices: 28,
      maxWarningsTotal: 12,
      maxWarningsPerKey: 1,
      onAssetFailure: () => {
        audioAssetFailureRef.current = true;
        if (audioSuccessTimerRef.current !== null) {
          window.clearTimeout(audioSuccessTimerRef.current);
          audioSuccessTimerRef.current = null;
        }
        setAudioUnlockVisible(true);
        setAudioUnlockUi("failed");
      },
      // Decode and gesture failures are exposed through the player-facing
      // audio state and localhost diagnostics instead of browser console noise.
      logger: null,
    });
    productionMixerRef.current = mixer;
    const unsubscribeAudioStatus = mixer.subscribeStatus((status: { state?: string; needsGesture?: boolean; error?: string | null }) => {
      if (status.state === "unlocking") {
        setAudioUnlockVisible(true);
        setAudioUnlockUi("pending");
      } else if (status.state === "running") {
        if (audioAssetFailureRef.current) {
          setAudioUnlockVisible(true);
          setAudioUnlockUi("failed");
        } else if (!audioActivationPendingRef.current) {
          setAudioUnlockVisible(true);
          setAudioUnlockUi("success");
          if (audioSuccessTimerRef.current !== null) window.clearTimeout(audioSuccessTimerRef.current);
          audioSuccessTimerRef.current = window.setTimeout(() => {
            setAudioUnlockVisible(false);
            audioSuccessTimerRef.current = null;
          }, 1800);
        }
      } else if (status.state === "failed" || status.state === "recovery-needed") {
        setAudioUnlockVisible(true);
        setAudioUnlockUi("failed");
      } else if (status.state === "locked") {
        setAudioUnlockVisible(true);
        setAudioUnlockUi("idle");
      }
      const g = gameRef.current;
      if (status.state === "running" && g.running && !g.paused && !g.over && !sfxMutedRef.current) {
        resumeBattleAudioLoopsRef.current(g);
      }
    });
    const detachUnlock = mixer.attachUnlock(window);
    void mixer.preloadScene("title", { includeOptional: false });

    const qaWindow = window as typeof window & { __ASHFALL_AUDIO_QA__?: unknown };
    const isLocalQa = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const qaAssets = PRODUCTION_AUDIO_MANIFEST.assets.map((asset) => ({
      id: asset.id,
      category: asset.category,
      sources: asset.sources.map((source) => ({ ...source })),
    }));
    const qaPools = PRODUCTION_AUDIO_MANIFEST.pools.map((pool) => ({
      id: pool.id,
      category: pool.category,
      assetIds: [...pool.assetIds],
    }));
    const qaBridge = {
      assetPaths: PRODUCTION_AUDIO_MANIFEST.assets.flatMap((asset) => asset.sources.map((source) => source.src)),
      manifestAssetCount: PRODUCTION_AUDIO_MANIFEST.assets.length,
      assets: qaAssets,
      pools: qaPools,
      cueIds: [...qaAssets.map((asset) => asset.id), ...qaPools.map((pool) => pool.id), ...PRODUCTION_AUDIO_MANIFEST.aliases.map((alias) => alias.id)],
      sceneIds: PRODUCTION_AUDIO_MANIFEST.scenes.map((scene) => scene.id),
      getDiagnostics: () => mixer.getDiagnostics(),
      getSceneState: () => mixer.getSceneState(),
      unlock: () => mixer.unlock(),
      play: async (cueId: string, options: Record<string, unknown> = {}) => {
        if (!await mixer.unlock()) return null;
        return mixer.play(cueId, options);
      },
      setScene: async (sceneId: string) => {
        if (!await mixer.unlock()) return null;
        return mixer.setScene(sceneId);
      },
      suspend: async () => {
        if (!mixer.context || mixer.context.state === "closed") return false;
        await mixer.context.suspend();
        return mixer.context.state === "suspended";
      },
      recover: () => mixer.recoverAudio({ reason: "local-qa" }),
      hasInstance: (instanceKey: string) => mixer.hasInstance(instanceKey),
      stopScene: (fadeMs = 0) => mixer.stopScene({ fadeMs }),
      stopAll: (fadeMs = 0) => mixer.stopAll({ fadeMs }),
    };
    let diagnosticsTimer: number | null = null;
    let assetAuditCancelled = false;
    let assetAuditContext: AudioContext | null = null;
    if (isLocalQa) {
      qaWindow.__ASHFALL_AUDIO_QA__ = qaBridge;
      document.documentElement.dataset.audioMixer = "production";
      document.documentElement.dataset.audioManifestAssets = String(PRODUCTION_AUDIO_MANIFEST.assets.length);
      document.documentElement.dataset.audioManifestSources = String(qaBridge.assetPaths.length);
      document.documentElement.dataset.audioQaCues = String(qaBridge.cueIds.length);
      document.documentElement.dataset.audioQaScenes = String(qaBridge.sceneIds.length);
      const publishDiagnostics = () => {
        const diagnostics = mixer.getDiagnostics();
        const root = document.documentElement;
        root.dataset.audioUnlocked = String(diagnostics.unlocked);
        root.dataset.audioContextState = diagnostics.contextState ?? "none";
        root.dataset.audioActiveVoices = String(diagnostics.activeVoices);
        root.dataset.audioActiveLoopVoices = String(diagnostics.activeLoopVoices);
        root.dataset.audioActiveSceneVoices = String(diagnostics.activeSceneVoices);
        root.dataset.audioDuplicateLoopInstances = String(diagnostics.duplicateLoopInstanceKeys.length);
        root.dataset.audioWarnings = String(diagnostics.warningTotal);
        root.dataset.audioCacheReady = String(diagnostics.cache.ready);
        root.dataset.audioCacheFailed = String(diagnostics.cache.failed);
        root.dataset.audioRuntimeScene = diagnostics.sceneId ?? "none";
        const settings = mixer.getSettings();
        root.dataset.audioBgmVolume = String(settings.bgmVolume);
        root.dataset.audioSfxVolume = String(settings.sfxVolume);
      };
      publishDiagnostics();
      diagnosticsTimer = window.setInterval(publishDiagnostics, 250);

      if (new URLSearchParams(window.location.search).get("decode") === "assets") {
        const root = document.documentElement;
        const portraitPaths = [...new Set([
          ...Object.values(PORTRAIT_ART),
          ...Object.values(FORMATION_CARD_ART),
        ])];
        const productionImagePaths = [...new Set([
          ...portraitPaths,
          PRODUCTION_VISUALS.title,
          PRODUCTION_VISUALS.command,
          PRODUCTION_VISUALS.guide,
          ...Object.values(PRODUCTION_VISUALS.stages),
          ...Object.values(PRODUCTION_VISUALS.missionObjects),
        ])];
        root.dataset.assetDecodeStatus = "running";
        root.dataset.assetDecodeAudioRequested = String(qaBridge.assetPaths.length);
        root.dataset.assetDecodePortraitRequested = String(portraitPaths.length);
        root.dataset.assetDecodeImageRequested = String(productionImagePaths.length);
        root.dataset.assetDecodeAudioDecoded = "0";
        root.dataset.assetDecodePortraitDecoded = "0";
        root.dataset.assetDecodeImageDecoded = "0";
        root.dataset.assetDecodeFailures = "[]";
        void (async () => {
          const failures: Array<{ path: string; error: string }> = [];
          let audioDecoded = 0;
          let portraitDecoded = 0;
          let imageDecoded = 0;
          try {
            const AudioContextCtor = window.AudioContext
              ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextCtor) throw new Error("AudioContext is unavailable");
            assetAuditContext = new AudioContextCtor();
            for (const path of qaBridge.assetPaths) {
              if (assetAuditCancelled) return;
              try {
                const response = await fetch(path, { cache: "no-store" });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const bytes = await response.arrayBuffer();
                if (bytes.byteLength === 0) throw new Error("empty body");
                const decoded = await assetAuditContext.decodeAudioData(bytes.slice(0));
                if (!(decoded.duration > 0) || decoded.numberOfChannels < 1 || decoded.sampleRate < 8000) {
                  throw new Error("invalid decoded audio buffer");
                }
                audioDecoded += 1;
                root.dataset.assetDecodeAudioDecoded = String(audioDecoded);
              } catch (error) {
                failures.push({ path, error: error instanceof Error ? error.message : String(error) });
              }
            }
            for (const path of productionImagePaths) {
              if (assetAuditCancelled) return;
              try {
                const image = new Image();
                image.decoding = "async";
                image.src = path;
                await image.decode();
                if (image.naturalWidth <= 0 || image.naturalHeight <= 0) throw new Error("invalid decoded image");
                imageDecoded += 1;
                root.dataset.assetDecodeImageDecoded = String(imageDecoded);
                if (portraitPaths.includes(path)) {
                  portraitDecoded += 1;
                  root.dataset.assetDecodePortraitDecoded = String(portraitDecoded);
                }
              } catch (error) {
                failures.push({ path, error: error instanceof Error ? error.message : String(error) });
              }
            }
          } catch (error) {
            failures.push({ path: "browser-decoder", error: error instanceof Error ? error.message : String(error) });
          } finally {
            if (assetAuditContext && assetAuditContext.state !== "closed") await assetAuditContext.close();
            assetAuditContext = null;
          }
          if (!assetAuditCancelled) {
            root.dataset.assetDecodeFailures = JSON.stringify(failures);
            root.dataset.assetDecodeStatus = failures.length === 0
              && audioDecoded === qaBridge.assetPaths.length
              && portraitDecoded === portraitPaths.length
              && imageDecoded === productionImagePaths.length
              ? "passed"
              : "failed";
          }
        })();
      }
    }

    return () => {
      sfxRequestGate.cancelPending();
      audioActivationPendingRef.current = false;
      audioAssetFailureRef.current = false;
      assetAuditCancelled = true;
      if (assetAuditContext && assetAuditContext.state !== "closed") void assetAuditContext.close();
      detachUnlock();
      unsubscribeAudioStatus();
      if (audioSuccessTimerRef.current !== null) {
        window.clearTimeout(audioSuccessTimerRef.current);
        audioSuccessTimerRef.current = null;
      }
      if (upgradeFeedbackTimerRef.current !== null) {
        window.clearTimeout(upgradeFeedbackTimerRef.current);
        upgradeFeedbackTimerRef.current = null;
      }
      if (diagnosticsTimer !== null) window.clearInterval(diagnosticsTimer);
      if (qaWindow.__ASHFALL_AUDIO_QA__ === qaBridge) delete qaWindow.__ASHFALL_AUDIO_QA__;
      if (document.documentElement.dataset.audioMixer === "production") {
        delete document.documentElement.dataset.audioMixer;
        delete document.documentElement.dataset.audioManifestAssets;
        delete document.documentElement.dataset.audioManifestSources;
        delete document.documentElement.dataset.audioQaCues;
        delete document.documentElement.dataset.audioQaScenes;
        delete document.documentElement.dataset.audioScene;
        delete document.documentElement.dataset.audioUnlocked;
        delete document.documentElement.dataset.audioContextState;
        delete document.documentElement.dataset.audioActiveVoices;
        delete document.documentElement.dataset.audioActiveLoopVoices;
        delete document.documentElement.dataset.audioActiveSceneVoices;
        delete document.documentElement.dataset.audioDuplicateLoopInstances;
        delete document.documentElement.dataset.audioWarnings;
        delete document.documentElement.dataset.audioCacheReady;
        delete document.documentElement.dataset.audioCacheFailed;
        delete document.documentElement.dataset.audioRuntimeScene;
        delete document.documentElement.dataset.audioBgmVolume;
        delete document.documentElement.dataset.audioSfxVolume;
      }
      if (productionMixerRef.current === mixer) productionMixerRef.current = null;
      void mixer.dispose();
    };
  }, []);

  useEffect(() => {
    const applyVisibility = (forcedHidden: boolean | null = null) => {
      const hidden = forcedHidden ?? document.visibilityState === "hidden";
      if (pageHiddenRef.current === hidden) return;
      pageHiddenRef.current = hidden;
      const counters = runtimePerformanceRef.current;
      counters.visibilityTransitions += 1;
      gameRef.current.last = performance.now();
      if (hidden) {
        if (counters.backgroundStartedAt === null) counters.backgroundStartedAt = performance.now();
        const audio = audioRef.current;
        fallbackAudioSuspendedRef.current = audio?.state === "running";
        if (fallbackAudioSuspendedRef.current) void audio?.suspend().catch(() => undefined);
        return;
      }
      if (counters.backgroundStartedAt !== null) {
        counters.backgroundDurationMs += Math.max(0, performance.now() - counters.backgroundStartedAt);
        counters.backgroundStartedAt = null;
      }
      const audio = audioRef.current;
      if (fallbackAudioSuspendedRef.current && audio?.state === "suspended") {
        void audio.resume().catch(() => undefined);
      }
      fallbackAudioSuspendedRef.current = false;
    };
    const onVisibilityChange = () => applyVisibility();
    const onPageHide = () => applyVisibility(true);
    const onPageShow = () => applyVisibility(false);
    applyVisibility();
    document.addEventListener("visibilitychange", onVisibilityChange, { passive: true });
    window.addEventListener("pagehide", onPageHide, { passive: true });
    window.addEventListener("pageshow", onPageShow, { passive: true });
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  useEffect(() => {
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") return;
    const qaWindow = window as typeof window & {
      __ASHFALL_BATTLE_QA__?: unknown;
      __ASHFALL_RUNTIME_PERFORMANCE__?: unknown;
    };
    const bridge = {
      prepareManualAbilityProof: (kind: UnitKind | readonly UnitKind[] | "all" = "all") => {
        const availableKinds = Object.keys(MANUAL_ABILITY_REGISTRY) as UnitKind[];
        const requestedKinds = kind === "all" ? availableKinds : Array.isArray(kind) ? [...kind] : [kind];
        if (requestedKinds.some((requestedKind) => !availableKinds.includes(requestedKind))) {
          throw new RangeError(`Unknown manual ability proof kind: ${String(kind)}`);
        }
        const proof = prepareManualAbilityProof(
          gameRef.current,
          requestedKinds,
        );
        selectedActionRef.current = null;
        setSelectedAction(null);
        setStarted(true);
        setPaused(false);
        setEnd(null);
        setScreen("battle");
        return proof;
      },
      prepareManualAbilitySurvivalProof: (kind: UnitKind = "brawler") => {
        const definition = MANUAL_ABILITY_REGISTRY[kind];
        if (!definition) throw new RangeError(`Unknown manual ability proof kind: ${String(kind)}`);
        const proof = prepareManualAbilityProof(gameRef.current, [kind]);
        const g = gameRef.current;
        const run = beginSurvivalWave(createSurvivalRun({
          runId: `qa-manual-speed-${kind}`,
          formation: {
            unitIds: [definition.unitId],
            unitLevelsByUnit: { [definition.unitId]: 1 },
          },
        }));
        g.definition = {
          ...g.definition,
          displayName: "感染防衛前線",
          missionType: "survival",
          enemyBaseMode: "scenery",
          missionConfig: {
            ...g.definition.missionConfig,
            spawnProfile: "survival-infection-breach",
            defenseFrontX: 646,
          },
        };
        g.survivalRun = run;
        g.survivalRuntime = createSurvivalCombatRuntime(run);
        g.baseHp = run.crawler.hp;
        g.baseMaxHp = run.crawler.maxHp;
        g.barricadeVulnerable = false;
        setSurvivalHud(survivalHudSnapshot(run));
        setStarted(true);
        setPaused(false);
        setEnd(null);
        setScreen("battle");
        return proof;
      },
      primeManualAbilityCooldown: (ownerId: number, seconds = .5) => {
        const fighter = gameRef.current.fighters.find((candidate) => (
          candidate.id === ownerId
          && candidate.side === "human"
          && candidate.hp > 0
        ));
        if (!fighter) return null;
        fighter.manualAbility = restoreManualAbilityCooldown(
          fighter.kind,
          seconds,
        ) as ManualAbilityRuntime | null;
        return fighter.manualAbility ? {
          ownerId: fighter.id,
          kind: fighter.kind,
          phase: fighter.manualAbility.phase,
          cooldownRemaining: fighter.manualAbility.cooldownRemaining,
        } : null;
      },
      rearmManualAbilityTarget: (ownerId: number) => {
        const g = gameRef.current;
        const owner = g.fighters.find((fighter) => (
          fighter.id === ownerId
          && fighter.side === "human"
          && fighter.hp > 0
        ));
        if (!owner) return false;
        if (owner.kind === "medic") {
          const ally = g.fighters.find((fighter) => (
            fighter.side === "human"
            && fighter.id !== owner.id
            && fighter.hp > 0
          ));
          if (!ally) return false;
          ally.hp = Math.max(1, ally.maxHp * .24);
        }
        return selectManualAbilityTarget({
          owner,
          fighters: manualAbilityTargetCandidates(g, owner),
        }) !== null;
      },
      persistManualAbilityCheckpointProof: async (kind: UnitKind = "brawler", cooldownSeconds = 9.5) => {
        const definition = MANUAL_ABILITY_REGISTRY[kind];
        if (!definition) throw new RangeError(`Unknown manual ability checkpoint kind: ${String(kind)}`);
        let run = createSurvivalRun({
          runId: `qa-manual-checkpoint-${kind}`,
          formation: {
            unitIds: [definition.unitId],
            unitLevelsByUnit: { [definition.unitId]: 1 },
          },
        });
        for (let wave = 1; wave <= 5; wave += 1) {
          run = beginSurvivalWave(run);
          run = completeSurvivalWave(run, {
            bossKills: wave === 5 ? 1 : 0,
            crawlerHp: run.crawler.hp,
          });
        }
        run = {
          ...run,
          manualAbilityCooldownsByKind: {
            [kind]: [Math.max(0, Number(cooldownSeconds) || 0)],
          },
        };
        const checkpointBaseSave = campaignSaveRef.current.campaignStarted
          ? campaignSaveRef.current
          : markCampaignStarted(campaignSaveRef.current) as CampaignSave;
        const checkpoint = checkpointSurvivalCampaignSave(checkpointBaseSave, run, {
          savedAt: new Date().toISOString(),
        });
        const persisted = await persistCampaignSave(checkpoint.save as CampaignSave);
        if (persisted.durable) setCampaignSave(checkpoint.save as CampaignSave);
        return {
          durable: persisted.durable,
          checkpointId: checkpoint.checkpointId,
          cooldownSeconds: run.manualAbilityCooldownsByKind[kind][0],
        };
      },
      deployManualAbilityCheckpointProof: (kind: UnitKind = "brawler") => {
        const g = gameRef.current;
        if (!g.survivalRun) return null;
        const card = spawnHuman(g, kind);
        if (!card) return null;
        const fighter = g.fighters[g.fighters.length - 1];
        fighter.lane = 1;
        fighter.anchorLane = 1;
        fighter.x = 300;
        fighter.y = activeLaneCenters[1];
        fighter.spawnGrace = 0;
        fighter.combatReady = true;
        fighter.gateEntering = false;
        fighter.speed = 0;
        fighter.laneSpeed = 0;
        fighter.cooldown = 99;
        const target = spawnEnemy(g, "walker", 1);
        target.x = 392;
        target.y = fighter.y;
        target.maxHp = 2400;
        target.hp = target.maxHp;
        target.speed = 0;
        target.laneSpeed = 0;
        target.damage = 0;
        target.cooldown = 99;
        target.combatReady = true;
        target.gateEntering = false;
        return {
          ownerId: fighter.id,
          phase: fighter.manualAbility?.phase ?? null,
          cooldownRemaining: fighter.manualAbility?.cooldownRemaining ?? null,
        };
      },
      stabilizeNewPlayableProof: () => {
        if (qaMode !== "new-playables") return false;
        for (const fighter of gameRef.current.fighters) {
          if (fighter.side !== "human"
            || !["tky", "mrs-chiha", "miyamoto-musashi"].includes(fighter.kind)) continue;
          fighter.speed = 0;
          fighter.laneSpeed = 0;
          fighter.aiMoveDirection = 0;
        }
        return true;
      },
      stabilizeMayoProof: () => {
        if (qaMode !== "mayo") return false;
        const g = gameRef.current;
        for (const fighter of g.fighters) {
          if (fighter.side === "zombie") {
            fighter.speed = 0;
            fighter.laneSpeed = 0;
            fighter.damage = 0;
            fighter.cooldown = 99;
          }
        }
        return g.fighters.some((fighter) => fighter.kind === "mayo-chan" && fighter.side === "human");
      },
      resetMayoProof: () => {
        if (qaMode !== "mayo") return false;
        prepareMayoQa(gameRef.current);
        return true;
      },
      forceMayoIncapacitation: () => {
        if (qaMode !== "mayo") return false;
        const mayo = gameRef.current.fighters.find((fighter) => (
          fighter.kind === "mayo-chan"
          && fighter.side === "human"
          && !fighter.mayoRetreat
        ));
        if (!mayo) return false;
        mayo.hp = 0;
        return true;
      },
      probeMayoRetreatDamage: () => {
        if (qaMode !== "mayo") return null;
        const g = gameRef.current;
        const mayo = g.fighters.find((fighter) => (
          fighter.kind === "mayo-chan"
          && fighter.side === "human"
          && fighter.mayoRetreat
        ));
        if (!mayo) return null;
        const beforeHp = mayo.hp;
        const hazard = applyIncomingHumanDamage(g, mayo, 12, { attackKind: "ranged" });
        const bossArea = applyIncomingHumanDamage(g, mayo, 34, { attackKind: "melee" });
        return {
          beforeHp,
          afterHp: mayo.hp,
          targetable: mayo.targetable !== false,
          hazardDamage: hazard.targetDamage,
          bossAreaDamage: bossArea.targetDamage,
        };
      },
      prepareBossFoundationProof: (kind: "takuya" | "gate-eater" | "kurome" | "mother" | "ooguchi" | "gairen" | "futago") => {
        const g = gameRef.current;
        if (!isBossEnemyKind(kind)) throw new RangeError(`Unknown boss proof kind: ${String(kind)}`);
        const prototypeRoute = kind === "kurome" || isBossAnomalyKind(kind);
        const missionIndex = prototypeRoute
          ? -1
          : g.definition.timeline.findIndex((mission) => mission.units.includes(kind));
        if (!prototypeRoute && missionIndex < 0) {
          throw new Error(`Boss proof route ${g.definition.stageId} does not contain ${kind}`);
        }
        const mission = prototypeRoute
          ? { id: "qa-kurome-prototype", at: 0, wave: 1 }
          : g.definition.timeline[missionIndex];
        g.fighters = [];
        g.corpses = [];
        g.enemySpawn = createEnemySpawnRuntime() as EnemySpawnRuntime;
        g.eventIndex = prototypeRoute ? g.definition.timeline.length : missionIndex;
        g.time = mission.at;
        g.wave = mission.wave;
        g.deployQueue = [];
        g.battlefieldObjects = [];
        g.signalIds = [];
        g.banner = "";
        g.bannerTime = 0;
        g.running = true;
        g.paused = false;
        g.over = false;
        g.won = false;
        bossFoundationQaRef.current = {
          entranceCounts: {},
          lastEntrance: null,
          lastCounterplay: null,
          barrierChallenge: null,
        };
        const proofLane: Lane = 1;
        spawnHuman(g, "scout");
        const human = g.fighters.find((fighter) => fighter.side === "human");
        if (!human) throw new Error("Boss foundation proof requires one human");
        human.x = 300;
        human.y = activeLaneCenters[proofLane];
        human.lane = proofLane;
        human.anchorLane = proofLane;
        human.combatReady = true;
        human.gateEntering = false;
        human.spawnGrace = 0;
        human.speed = 0;
        human.laneSpeed = 0;
        human.cooldown = 99;
        human.damage = 0;
        if (prototypeRoute) {
          const portal = enemySpawnPortalPoint({
            stageId: g.definition.operationId,
            viewport: activeStageViewportId,
            entryId: 1,
            kind,
            missionType: "boss-assault",
          });
          const entry = {
            entryId: 1,
            kind,
            wave: 1,
            order: 0,
            delay: 0,
            ...portal,
            lane: portal.legacyLane as Lane,
          } as EnemySpawnEntry;
          spawnEnemy(g, kind, entry.lane, 0, entry);
          const definition = bossDefinitionForEnemyKind(kind);
          if (!definition) throw new Error(`${kind} boss contract missing`);
          bossFoundationQaRef.current.entranceCounts[kind] = 1;
          bossFoundationQaRef.current.lastEntrance = {
            kind,
            cueId: definition.entrance.cueId,
            warningLabel: definition.entrance.warningLabel,
          };
          g.banner = definition.entrance.warningLabel;
          g.bannerTime = 3.2;
        }
        setPaused(false);
        return {
          kind,
          humanId: human.id,
          missionId: mission.id,
          warningLabel: bossDefinitionForEnemyKind(kind)?.entrance.warningLabel ?? null,
        };
      },
      getBossFoundationProof: (kind: "takuya" | "gate-eater" | "kurome" | "mother" | "ooguchi" | "gairen" | "futago") => {
        const g = gameRef.current;
        const boss = g.fighters.find((fighter) => fighter.kind === kind && fighter.side === "zombie");
        const human = g.fighters.find((fighter) => fighter.side === "human");
        const definition = bossDefinitionForEnemyKind(kind);
        const idleFrame = spriteFrameFor(kind, "idle", "left");
        const authoredSize = fitSpriteBattleDisplaySize(kind, idleFrame, spriteDisplaySize(kind));
        const renderScale = compactSpriteScale(kind);
        const depthScale = activeBattlefieldDepthScale(boss?.y ?? activeLaneCenters[1]);
        const visibleHeightRatio = idleFrame.contentRect.h / idleFrame.sourceRect.h;
        const idleBodyScale = sampleAnimationClip(kind, "idle", 0).bodyScale;
        const renderedWidth = authoredSize.w * renderScale * depthScale * idleBodyScale;
        const renderedHeight = authoredSize.h * renderScale * depthScale * idleBodyScale;
        const renderedBodyHeight = renderedHeight * visibleHeightRatio;
        const renderedVisibleRect = boss ? {
          left: boss.x - renderedWidth * idleFrame.anchorX
            + renderedWidth * (idleFrame.contentRect.x - idleFrame.sourceRect.x) / idleFrame.sourceRect.w,
          top: boss.y - renderedHeight * idleFrame.anchorY
            + renderedHeight * (idleFrame.contentRect.y - idleFrame.sourceRect.y) / idleFrame.sourceRect.h,
          right: boss.x - renderedWidth * idleFrame.anchorX
            + renderedWidth * (
              idleFrame.contentRect.x - idleFrame.sourceRect.x + idleFrame.contentRect.w
            ) / idleFrame.sourceRect.w,
          bottom: boss.y - renderedHeight * idleFrame.anchorY
            + renderedHeight * (
              idleFrame.contentRect.y - idleFrame.sourceRect.y + idleFrame.contentRect.h
            ) / idleFrame.sourceRect.h,
        } : null;
        const compact = compactBattleViewport();
        const bannerWidth = compact ? 268 : 356;
        const bannerHeight = compact ? 32 : 54;
        const bannerX = (W - bannerWidth) / 2;
        const bannerY = compact ? 132 : 70;
        return {
          kind,
          bossId: boss?.id ?? null,
          humanId: human?.id ?? null,
          bossX: boss?.x ?? null,
          bossY: boss?.y ?? null,
          bossBodyRadius: boss?.bodyRadius ?? null,
          combatReadyX: boss?.combatReadyX ?? null,
          combatReady: boss?.combatReady ?? false,
          gateEntering: boss?.gateEntering ?? false,
          entryMode: boss?.spawnEntryMode ?? null,
          bossAttack: boss?.attack ?? 0,
          bossTargetId: boss?.targetId ?? null,
          bossHp: boss?.hp ?? null,
          bossMaxHp: boss?.maxHp ?? null,
          humanX: human?.x ?? null,
          humanY: human?.y ?? null,
          humanBodyRadius: human?.bodyRadius ?? null,
          humanHp: human?.hp ?? null,
          hud: boss ? bossHudSnapshot(boss) : null,
          telegraph: boss ? bossTelegraphSnapshot(boss, { fallbackTargetX: BASE_X + 48 }) : null,
          stationPhase: boss?.stationAbility.phase ?? null,
          stationTargetIds: boss?.stationAbility.targetIds ?? [],
          stationSplit: boss?.stationAbility.split ?? false,
          trackingTarget: boss ? {
            targetId: boss.stationAbility.targetId ?? null,
            targetX: boss.stationAbility.targetX ?? null,
            targetY: boss.stationAbility.targetY ?? null,
          } : null,
          visionDisruptedRemaining: human?.visionDisruptedRemaining ?? 0,
          prototypeStatus: definition?.prototypeStatus ?? null,
          spriteLoadedWidth: spriteRefs.current[kind]?.naturalWidth ?? 0,
          renderedBodyHeight,
          renderedVisibleRect,
          footAnchorDelta: renderedVisibleRect && boss
            ? renderedVisibleRect.bottom - boss.y
            : null,
          display: definition?.display ?? null,
          entranceCount: bossFoundationQaRef.current.entranceCounts[kind] ?? 0,
          lastEntrance: bossFoundationQaRef.current.lastEntrance,
          lastCounterplay: bossFoundationQaRef.current.lastCounterplay,
          barrier: bossFoundationQaRef.current.barrierChallenge,
          banner: g.bannerTime > 0 ? {
            text: g.banner,
            remainingSeconds: g.bannerTime,
            rect: {
              left: bannerX,
              top: bannerY,
              right: bannerX + bannerWidth,
              bottom: bannerY + bannerHeight,
            },
          } : null,
          battleBarkCount: g.battleBarks.active.length,
          broodCount: kind === "mother"
            ? g.fighters.filter((fighter) => (
              fighter.side === "zombie"
              && fighter.hp > 0
              && fighter.summonSource === "mother-brood"
              && fighter.summonOwnerId === boss?.id
            )).length
            : 0,
        };
      },
      accelerateBossFoundationEntry: (bossId: number) => {
        const boss = gameRef.current.fighters.find((fighter) => fighter.id === bossId && isBossEnemyKind(fighter.kind));
        if (!boss || !boss.gateEntering) return false;
        boss.gateEntrySpeed = Math.max(boss.gateEntrySpeed, 96);
        boss.cooldown = 99;
        boss.abilityCooldown = 99;
        return true;
      },
      startBossFoundationBarrierChallenge: (bossId: number, humanId: number) => {
        const g = gameRef.current;
        const boss = g.fighters.find((fighter) => fighter.id === bossId && isBossEnemyKind(fighter.kind));
        const human = g.fighters.find((fighter) => fighter.id === humanId && fighter.side === "human");
        if (!boss || !human || !boss.combatReady) return null;
        const separation = boss.bodyRadius + human.bodyRadius + 2;
        boss.speed = 0;
        boss.laneSpeed = 0;
        boss.cooldown = 99;
        boss.abilityCooldown = 99;
        human.x = boss.x - separation - 6;
        human.y = boss.y;
        human.lane = boss.lane;
        human.anchorLane = boss.lane;
        human.speed = 0;
        human.laneSpeed = 0;
        human.cooldown = 99;
        bossFoundationQaRef.current.barrierChallenge = {
          bossId,
          humanId,
          targetX: boss.x + separation + 24,
          attempted: false,
          blocked: false,
          resultingX: null,
        };
        return { separation, startX: human.x };
      },
      armBossFoundationTelegraph: (bossId: number, humanId: number) => {
        const g = gameRef.current;
        const boss = g.fighters.find((fighter) => fighter.id === bossId && isBossEnemyKind(fighter.kind));
        const human = g.fighters.find((fighter) => fighter.id === humanId && fighter.side === "human");
        if (!boss || !human || !boss.combatReady) return null;
        boss.speed = 0;
        boss.laneSpeed = 0;
        if (["ooguchi", "gairen", "futago"].includes(boss.kind)) {
          boss.x = boss.combatReadyX ?? boss.x;
        }
        boss.hp = Math.ceil(boss.maxHp * (boss.kind === "futago" ? .55 : .72));
        boss.abilityCooldown = 0;
        boss.abilityWindup = 0;
        boss.stationAbility = createStationAbilityRuntime(boss.kind);
        if (boss.kind === "mother") {
          g.fighters = g.fighters.filter((fighter) => (
            fighter.summonSource !== "mother-brood"
            || fighter.summonOwnerId !== boss.id
          ));
        }
        if (boss.kind === "kurome" || boss.kind === "mother") boss.x = Math.min(boss.x, 560);
        human.x = boss.x - (boss.kind === "kurome" ? 210 : boss.kind === "mother" ? 72 : 90);
        const proofLane = boss.kind === "ooguchi"
          ? (boss.lane === 0 ? 1 : 0)
          : boss.lane;
        human.y = activeLaneCenters[proofLane];
        human.lane = proofLane;
        human.anchorLane = proofLane;
        human.hp = human.maxHp;
        human.cooldown = 99;
        return {
          warningSeconds: bossDefinitionForEnemyKind(boss.kind)?.attackTelegraph.warningSeconds ?? 0,
        };
      },
      armMotherNormalAttack: (bossId: number, humanId: number) => {
        const g = gameRef.current;
        const boss = g.fighters.find((fighter) => (
          fighter.id === bossId
          && fighter.kind === "mother"
          && fighter.side === "zombie"
        ));
        const human = g.fighters.find((fighter) => (
          fighter.id === humanId
          && fighter.side === "human"
        ));
        if (!boss || !human || !boss.combatReady) return null;
        boss.stationAbility = createStationAbilityRuntime("mother");
        boss.abilityCooldown = 99;
        boss.cooldown = 0;
        boss.speed = 0;
        boss.laneSpeed = 0;
        human.hp = human.maxHp;
        human.x = boss.x - boss.bodyRadius - human.bodyRadius - 8;
        human.y = boss.y;
        human.lane = boss.lane;
        human.anchorLane = boss.lane;
        human.speed = 0;
        human.laneSpeed = 0;
        human.cooldown = 99;
        return { bossId, humanId, humanHp: human.hp };
      },
      armAnomalyBossNormalAttack: (bossId: number, humanId: number) => {
        const g = gameRef.current;
        const boss = g.fighters.find((fighter) => (
          fighter.id === bossId
          && ["ooguchi", "gairen", "futago"].includes(fighter.kind)
          && fighter.side === "zombie"
        ));
        const human = g.fighters.find((fighter) => (
          fighter.id === humanId
          && fighter.side === "human"
        ));
        if (!boss || !human || !boss.combatReady) return null;
        boss.stationAbility = createStationAbilityRuntime(boss.kind);
        boss.abilityCooldown = 99;
        boss.cooldown = 0;
        boss.speed = 0;
        boss.laneSpeed = 0;
        human.hp = human.maxHp;
        human.x = boss.x - boss.bodyRadius - human.bodyRadius - 8;
        human.y = boss.y;
        human.lane = boss.lane;
        human.anchorLane = boss.lane;
        human.speed = 0;
        human.laneSpeed = 0;
        human.cooldown = 99;
        return { bossId, humanId, humanHp: human.hp };
      },
      moveMotherProofHumanOutsideBrood: (bossId: number, humanId: number) => {
        const g = gameRef.current;
        const boss = g.fighters.find((fighter) => (
          fighter.id === bossId
          && fighter.kind === "mother"
          && fighter.side === "zombie"
        ));
        const human = g.fighters.find((fighter) => (
          fighter.id === humanId
          && fighter.side === "human"
        ));
        if (!boss || !human || boss.stationAbility.phase !== "warning") return null;
        const lane = boss.lane === 0 ? 2 : 0;
        human.x = Math.max(BASE_X + 42, boss.x - BOSS_ANOMALY_TUNING.mother.controlRadius - 72);
        human.y = activeLaneCenters[lane];
        human.lane = lane;
        human.anchorLane = lane;
        return {
          x: human.x,
          y: human.y,
          lane,
          distance: fighterDistance(boss, human),
        };
      },
      moveAnomalyProofHumanOutsideTelegraph: (bossId: number, humanId: number) => {
        const g = gameRef.current;
        const boss = g.fighters.find((fighter) => (
          fighter.id === bossId
          && ["ooguchi", "gairen", "futago"].includes(fighter.kind)
          && fighter.side === "zombie"
        ));
        const human = g.fighters.find((fighter) => (
          fighter.id === humanId
          && fighter.side === "human"
        ));
        if (!boss || !human || boss.stationAbility.phase !== "warning") return null;
        if (boss.kind === "ooguchi") {
          const lockedLane = boss.stationAbility.lane ?? boss.lane;
          const safeLane = lockedLane === 0 ? 2 : 0;
          human.y = activeLaneCenters[safeLane];
          human.lane = safeLane;
          human.anchorLane = safeLane;
        } else if (boss.kind === "gairen") {
          human.x = boss.x + BOSS_ANOMALY_TUNING.gairen.sweepRadius + 36;
          human.y = boss.y;
          human.lane = boss.lane;
          human.anchorLane = boss.lane;
        } else {
          human.x = BASE_X + 42;
          human.y = activeLaneCenters[boss.lane];
          human.lane = boss.lane;
          human.anchorLane = boss.lane;
        }
        return { x: human.x, y: human.y, lane: human.lane };
      },
      moveBossFoundationHumanToLane: (humanId: number, lane: Lane) => {
        const human = gameRef.current.fighters.find((fighter) => (
          fighter.id === humanId
          && fighter.side === "human"
        ));
        if (!human || !([0, 1, 2] as const).includes(lane)) return false;
        human.lane = lane;
        human.anchorLane = lane;
        human.y = activeLaneCenters[lane];
        return true;
      },
      prepareCrawlerDefenseProof: (
        input: EnemyKind | {
          attackerKind?: EnemyKind;
          lane?: Lane;
          existingClaim?: boolean;
        } = "walker",
      ) => {
        const g = gameRef.current;
        const options = typeof input === "string" ? { attackerKind: input } : input;
        const attackerKind = options.attackerKind ?? "walker";
        const proofLane = ([0, 1, 2] as const).includes(options.lane as Lane)
          ? options.lane as Lane
          : 1;
        g.fighters = [];
        g.corpses = [];
        g.enemySpawn = createEnemySpawnRuntime() as EnemySpawnRuntime;
        g.eventIndex = g.definition.timeline.length;
        g.deployQueue = [];
        g.qaNextDeploymentLane = null;
        g.crawlerDoor = createCrawlerDoorRuntime();
        g.battlefieldObjects = [];
        g.energy = COMMAND_MAX;
        g.baseHp = g.baseMaxHp;
        g.running = true;
        g.paused = false;
        g.over = false;
        g.won = false;
        for (const card of cards) g.deployCooldowns[card.kind] = 0;

        const attacker = spawnEnemy(g, attackerKind, proofLane);
        attacker.x = BASE_X + 20;
        attacker.y = activeLaneCenters[proofLane];
        attacker.lane = proofLane;
        attacker.anchorLane = proofLane;
        attacker.combatReady = true;
        attacker.gateEntering = false;
        attacker.contained = false;
        attacker.spawnGrace = 0;
        attacker.cooldown = 0;
        // Deliberately stale identity proves that live attack geometry, rather
        // than a previous target decision, owns the defense hand-off.
        attacker.targetId = 999_999;
        attacker.targetObjectId = 888_888;
        attacker.retargetIn = 99;
        attacker.stunned = 0;
        let existingClaimId: number | null = null;
        if (options.existingClaim === true) {
          const existing = spawnHuman(g, "scout");
          if (existing) {
            const claimant = g.fighters[g.fighters.length - 1];
            claimant.x = BARRICADE_X - 90;
            claimant.y = activeLaneCenters[proofLane];
            claimant.lane = proofLane;
            claimant.anchorLane = proofLane;
            claimant.combatReady = true;
            claimant.gateEntering = false;
            claimant.spawnGrace = 0;
            claimant.speed = 0;
            claimant.laneSpeed = 0;
            claimant.damage = 0;
            claimant.targetId = attacker.id;
            claimant.crawlerDefenseTargetId = null;
            claimant.retargetIn = 99;
            existingClaimId = claimant.id;
          }
        }
        return {
          attackerId: attacker.id,
          attackerKind: attacker.kind,
          crawlerX: BASE_X,
          lane: proofLane,
          initialAttackerHp: attacker.hp,
          existingClaimId,
        };
      },
      queueCrawlerDefenseUnit: (kind: UnitKind, lane: Lane = 1) => {
        const g = gameRef.current;
        if (!cards.some((card) => card.kind === kind)) return false;
        g.qaNextDeploymentLane = ([0, 1, 2] as const).includes(lane) ? lane : 1;
        g.deployQueue.push(kind);
        return true;
      },
      releaseCrawlerDefenseThreat: (attackerId: number) => {
        const g = gameRef.current;
        const attacker = g.fighters.find((fighter) => (
          fighter.id === attackerId
          && fighter.side === "zombie"
          && fighter.hp > 0
        ));
        if (!attacker) return false;
        attacker.x = BASE_X + 520;
        attacker.targetId = null;
        attacker.targetObjectId = null;
        attacker.retargetIn = 99;
        attacker.cooldown = 99;
        attacker.contained = true;
        return true;
      },
      spawnHumanForDamageProof: (kind: UnitKind) => {
        const g = gameRef.current;
        if (!g.formationKinds.includes(kind)) return null;
        const card = spawnHuman(g, kind);
        return card ? g.fighters[g.fighters.length - 1]?.id ?? null : null;
      },
      applyHumanDamage: (fighterId: number, incomingDamage: number) => {
        const g = gameRef.current;
        const target = g.fighters.find((fighter) => (
          fighter.id === fighterId
          && fighter.side === "human"
          && fighter.hp > 0
        ));
        if (!target) return null;
        const beforeHp = target.hp;
        const resolved = applyIncomingHumanDamage(g, target, incomingDamage);
        return {
          ...resolved,
          beforeHp,
          afterHp: target.hp,
          defense: target.defense,
        };
      },
      prepareMachineGunBurstProof: (
        proofKind: "fighter" | "enemy-base" | "gate-eater" | "pierce" = "fighter",
      ) => {
        const g = gameRef.current;
        let gunner = g.fighters.find((fighter) => fighter.side === "human" && fighter.kind === "gunner");
        if (!gunner) {
          const spawned = spawnHuman(g, "gunner");
          if (spawned) gunner = g.fighters.at(-1);
        }
        const targetKind = proofKind === "enemy-base" ? "enemy-base" : "fighter";
        const requestedEnemyKind: EnemyKind = proofKind === "gate-eater" ? "gate-eater" : "walker";
        const primaryTarget = targetKind === "fighter"
          ? g.fighters.find((fighter) => (
            fighter.side === "zombie" && fighter.kind === requestedEnemyKind
          )) ?? spawnEnemy(g, requestedEnemyKind, 1)
          : null;
        const secondaryTarget = proofKind === "pierce" ? spawnEnemy(g, "walker", 1) : null;
        const proofTarget = secondaryTarget ?? primaryTarget;
        if (!gunner || (targetKind === "fighter" && !primaryTarget) || !proofTarget && targetKind === "fighter") return null;
        const proofLane: Lane = 1;
        gunner.lane = proofLane;
        gunner.anchorLane = proofLane;
        gunner.x = targetKind === "enemy-base" ? BARRICADE_X - 70 : 430;
        gunner.y = laneY(proofLane, gunner.id);
        gunner.cooldown = 0;
        gunner.attack = 0;
        gunner.spawnGrace = 0;
        gunner.targetId = primaryTarget?.id ?? null;
        gunner.targetObjectId = null;
        gunner.retargetIn = 99;
        gunner.weaponHeat = 0;
        gunner.overheated = false;
        for (const [index, target] of [primaryTarget, secondaryTarget].filter(Boolean).entries()) {
          if (!target) continue;
          target.lane = proofLane;
          target.anchorLane = proofLane;
          target.x = 500 + index * 54;
          target.y = gunner.y;
          target.maxHp = 1600;
          target.hp = target.maxHp;
          target.cooldown = 99;
          target.spawnGrace = 0;
          target.combatReady = true;
          target.gateEntering = false;
          target.contained = false;
          target.targetId = null;
          target.targetObjectId = null;
          target.retargetIn = 99;
          target.stunned = 20;
          target.suppressionStacks = 0;
          target.suppressedRemaining = 0;
          target.suppressionMultiplier = 1;
        }
        if (proofKind === "gate-eater" && primaryTarget) {
          g.researchContainer = createResearchContainerRuntime(g.definition.missionConfig) as ResearchContainerRuntime;
          g.stageMission = {
            ...g.stageMission,
            powerActivated: 3,
            gateEaterDefeated: false,
          };
        } else {
          g.barricadeVulnerable = true;
          g.barricadeMaxHp = 1600;
          g.barricadeHp = g.barricadeMaxHp;
          g.barricadeBucklingAnnounced = false;
          g.barricadeCriticalAnnounced = false;
        }
        g.fighters = targetKind === "fighter"
          ? [gunner, primaryTarget, secondaryTarget].filter(Boolean) as Fighter[]
          : [gunner];
        g.pendingWeaponHits = [];
        g.shots = [];
        g.damageTexts = [];
        g.particles = [];
        const gateEaterMultiplier = primaryTarget?.kind === "gate-eater"
          ? ticketGateEaterDamageProfile({
            runtime: primaryTarget.stationAbility,
            attackVector: Math.abs(gunner.y - primaryTarget.y) > 24 ? "flank" : "front",
          }).multiplier
          : 1;
        return {
          gunnerId: gunner.id,
          targetId: proofTarget?.id ?? null,
          targetKind,
          proofKind,
          expectedDamage: proofKind === "enemy-base"
            ? gunner.damage * structureDamageMultiplier("gunner")
            : proofKind === "pierce"
              ? gunner.damage * gateEaterMultiplier * .58
              : gunner.damage * gateEaterMultiplier,
          initialTargetHp: proofTarget?.hp ?? g.barricadeHp,
        };
      },
      prepareSurvivalUpgradeProof: () => {
        const g = gameRef.current;
        if (!g.survivalRun || !g.survivalRuntime || g.over) {
          throw new Error("Survival upgrade proof requires an active run");
        }
        let checkpointOwner = g.fighters.find((fighter) => (
          fighter.side === "human"
          && fighter.hp > 0
          && fighter.manualAbility
        ));
        if (!checkpointOwner) {
          spawnHuman(g, "brawler");
          checkpointOwner = g.fighters[g.fighters.length - 1];
        }
        if (!checkpointOwner?.manualAbility) {
          throw new Error("Survival upgrade proof requires a manual ability owner");
        }
        checkpointOwner.manualAbility = restoreManualAbilityCooldown(
          checkpointOwner.kind,
          9.5,
        ) as ManualAbilityRuntime;
        const bossWave = beginSurvivalWave({
          ...g.survivalRun,
          phase: SURVIVAL_RUN_PHASES.WAVE_READY,
          currentWave: 5,
          lastCompletedWave: 4,
          speed: 1,
          bossEntrancePending: false,
          pendingUpgradeChoices: [],
        });
        const checkpointRun = completeSurvivalWave(bossWave, {
          kills: 1,
          bossKills: 1,
          crawlerHp: g.baseHp,
          reward: survivalWaveReward(5),
        });
        if (!checkpointRun || checkpointRun.phase !== SURVIVAL_RUN_PHASES.UPGRADE_SELECTION) {
          throw new Error("Could not prepare Survival upgrade checkpoint");
        }
        const checkpointWithCooldowns = {
          ...checkpointRun,
          manualAbilityCooldownsByKind: snapshotManualAbilityCooldowns(g.fighters),
        };
        const checkpointId = `survival:${checkpointWithCooldowns.runId}:wave:${checkpointWithCooldowns.lastCompletedWave}`;
        g.survivalRun = checkpointWithCooldowns;
        g.survivalRuntime = createSurvivalCombatRuntime(checkpointWithCooldowns);
        g.survivalCheckpointReceipt = checkpointId;
        g.wave = checkpointRun.currentWave;
        g.paused = true;
        g.enemySpawn = createEnemySpawnRuntime();
        g.fighters = g.fighters.filter((fighter) => fighter.side === "human" && fighter.hp > 0);
        setPaused(true);
        setSurvivalHud(survivalHudSnapshot(checkpointWithCooldowns));
        setPendingSurvivalCheckpoint({ run: checkpointWithCooldowns, checkpointId });
        return {
          checkpointId,
          choices: [...checkpointWithCooldowns.pendingUpgradeChoices],
          cooldownKind: checkpointOwner.kind,
          cooldownOwnerId: checkpointOwner.id,
          cooldownSeconds: checkpointOwner.manualAbility.cooldownRemaining,
        };
      },
      deploySurvivalLiveContinuationProof: (kind: UnitKind, cooldownOwnerId: number) => {
        const g = gameRef.current;
        if (!g.survivalRun || g.survivalRun.phase !== SURVIVAL_RUN_PHASES.WAVE_READY) {
          throw new Error("Survival continuation proof requires a selected checkpoint upgrade");
        }
        const cooldownOwner = g.fighters.find((fighter) => (
          fighter.id === cooldownOwnerId
          && fighter.side === "human"
          && fighter.hp > 0
        ));
        const card = spawnHuman(g, kind);
        if (!card) throw new Error(`Could not deploy Survival continuation proof for ${kind}`);
        const deployed = g.fighters[g.fighters.length - 1];
        return {
          cooldownOwner: cooldownOwner?.manualAbility ? {
            id: cooldownOwner.id,
            phase: cooldownOwner.manualAbility.phase,
            cooldownRemaining: cooldownOwner.manualAbility.cooldownRemaining,
          } : null,
          deployed: deployed.manualAbility ? {
            id: deployed.id,
            phase: deployed.manualAbility.phase,
            cooldownRemaining: deployed.manualAbility.cooldownRemaining,
          } : null,
          remainingCooldowns: [
            ...(g.survivalRun.manualAbilityCooldownsByKind?.[kind] ?? []),
          ],
        };
      },
      prepareSurvivalEntryVisibilityProof: () => {
        const g = gameRef.current;
        const enteringEnemy = g.fighters.find((fighter) => (
          fighter.side === "zombie"
          && fighter.hp > 0
          && fighter.gateEntering
          && !fighter.combatReady
          && (fighter.spawnEntryMode === "right-edge" || fighter.spawnEntryMode === "right-edge-outside")
        ));
        if (!enteringEnemy) {
          throw new Error("Survival entry visibility proof requires a right-edge entering enemy");
        }
        g.paused = true;
        enteringEnemy.x = Math.max(
          enteringEnemy.combatReadyX + 12,
          W - Math.max(12, enteringEnemy.bodyRadius),
        );
        enteringEnemy.spawnEntryMode = "right-edge-outside";
        return {
          fighterId: enteringEnemy.id,
          x: enteringEnemy.x,
          combatReadyX: enteringEnemy.combatReadyX,
          entryMode: enteringEnemy.spawnEntryMode,
        };
      },
      advanceOutbreakTimeline: () => {
        const g = gameRef.current;
        if (g.definition.operationCategory !== "outbreak" || g.over) return null;
        const nextEvent = g.definition.timeline[g.eventIndex];
        if (!nextEvent) {
          return {
            eventIndex: g.eventIndex,
            timelineLength: g.definition.timeline.length,
            exhausted: true,
          };
        }
        g.time = Math.max(g.time, nextEvent.at + .05);
        return {
          eventIndex: g.eventIndex,
          timelineLength: g.definition.timeline.length,
          nextEventAt: nextEvent.at,
          exhausted: false,
        };
      },
      accelerateOutbreakEntries: () => {
        const g = gameRef.current;
        if (g.definition.operationCategory !== "outbreak" || g.over) return 0;
        let accelerated = 0;
        for (const fighter of g.fighters) {
          if (fighter.side !== "zombie" || !fighter.gateEntering || fighter.combatReady) continue;
          fighter.gateEntrySpeed = Math.max(fighter.gateEntrySpeed, 260);
          accelerated += 1;
        }
        return accelerated;
      },
      defeatOutbreakEnemies: () => {
        const g = gameRef.current;
        if (g.definition.operationCategory !== "outbreak"
          || g.over
          || g.eventIndex < g.definition.timeline.length
          || g.enemySpawn.pending.length > 0
          || g.fighters.some((fighter) => (
            fighter.side === "zombie"
            && fighter.hp > 0
            && (!fighter.combatReady || fighter.gateEntering)
          ))) return 0;
        let defeated = 0;
        for (const fighter of g.fighters) {
          if (fighter.side !== "zombie" || fighter.hp <= 0 || fighter.contained) continue;
          fighter.hp = 0;
          defeated += 1;
        }
        return defeated;
      },
      defeatOutbreakBoss: () => {
        const g = gameRef.current;
        if (g.definition.operationCategory !== "outbreak" || g.over) return null;
        const boss = g.fighters.find((fighter) => (
          fighter.side === "zombie"
          && fighter.kind === g.definition.bossEnemyKind
          && fighter.hp > 0
          && fighter.combatReady
          && !fighter.gateEntering
        ));
        if (!boss) return null;
        const before = {
          bossId: boss.id,
          barricadeHp: g.barricadeHp,
          barricadeVulnerable: g.barricadeVulnerable,
        };
        boss.hp = 0;
        return before;
      },
      defeatOutbreakRemainingEnemies: () => {
        const g = gameRef.current;
        if (g.definition.operationCategory !== "outbreak"
          || g.over
          || !g.bossDefeated
          || g.eventIndex < g.definition.timeline.length
          || g.enemySpawn.pending.length > 0) return 0;
        let defeated = 0;
        for (const fighter of g.fighters) {
          if (fighter.side !== "zombie" || fighter.hp <= 0 || fighter.contained) continue;
          fighter.hp = 0;
          defeated += 1;
        }
        return defeated;
      },
      failNextOutbreakSettlementSave: () => {
        outbreakSettlementPersistenceQaRef.current.failuresRemaining += 1;
        return outbreakSettlementPersistenceQaRef.current.attempts;
      },
      setSurvivalEntryVisibilityMode: (fighterId: number, entryMode: EnemyEntryMode) => {
        const fighter = gameRef.current.fighters.find((candidate) => candidate.id === fighterId);
        if (!fighter || fighter.side !== "zombie" || !fighter.gateEntering) return false;
        fighter.spawnEntryMode = entryMode;
        return true;
      },
      failNextSurvivalSettlementSave: () => {
        survivalSettlementPersistenceQaRef.current.failuresRemaining += 1;
        return survivalSettlementPersistenceQaRef.current.attempts;
      },
      prepareEquipmentRuntimeProof: ({
        mode = "standard",
        equipped = true,
        profile = "offense",
      }: {
        mode?: "standard" | "survival-new" | "survival-resume";
        equipped?: boolean;
        profile?: "offense" | "durability";
      } = {}) => {
        const unit = (CAMPAIGN_UNITS as unknown as readonly CampaignUnitData[])[0];
        if (!unit) throw new Error("Equipment runtime proof requires a campaign unit");
        const personalEquipmentIds = profile === "durability"
          ? ["boss-ossified-core", "quick-loader"]
          : ["boss-muscle-fiber", "boss-rail-spine"];
        const personalEquipmentByUnit = equipped
          ? { [unit.id]: personalEquipmentIds }
          : {};
        const tacticalEquipmentIds = equipped
          ? ["boss-resonance-gland", "tactical-barricade-kit"]
          : [];
        const equipmentEnhancementLevels = equipped
          ? Object.fromEntries([
            ...personalEquipmentIds,
            "boss-resonance-gland",
            "tactical-barricade-kit",
          ].map((equipmentId) => [equipmentId, 3]))
          : {};
        const formation = {
          presetId: "formation-preset-1",
          unitIds: [unit.id],
          unitLevelsByUnit: { [unit.id]: 1 },
          personalEquipmentByUnit,
          tacticalEquipmentIds,
          equipmentEnhancementLevels,
        };
        let fresh: Game;
        let serializedResume = false;
        if (mode === "standard") {
          fresh = initialGame(
            "pod",
            CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET,
            [unit.combatKind as UnitKind],
            createBattleResultId(`equipment-runtime-${equipped ? "equipped" : "control"}`),
            [],
            formation.unitLevelsByUnit,
            formation,
          );
        } else {
          const tacticalEffects = aggregateEquipmentEffects(
            tacticalEquipmentIds,
            equipmentEnhancementLevels,
          );
          const createdRun = createSurvivalRun({
            runId: `equipment-runtime-${mode}-${equipped ? "equipped" : "control"}`,
            formation,
            crawlerMaxHp: Math.round(700 * tacticalEffects.baseHpMultiplier),
          });
          const checkpointRun = {
            ...createdRun,
            phase: SURVIVAL_RUN_PHASES.UPGRADE_SELECTION,
            currentWave: 6,
            lastCompletedWave: 5,
          };
          const serializedProgress = mode === "survival-resume"
            ? JSON.parse(JSON.stringify(saveSurvivalCheckpoint(
              createDefaultSurvivalProgress(),
              checkpointRun,
              "2026-07-26T00:00:00.000Z",
            )))
            : null;
          const run = serializedProgress
            ? resumeSurvivalCheckpoint(serializedProgress)
            : createdRun;
          if (!run) throw new Error("Equipment runtime proof could not resume checkpoint");
          serializedResume = mode === "survival-resume";
          fresh = initialSurvivalGame({
            selectedSupply: "pod",
            run,
            formationKinds: [unit.combatKind as UnitKind],
            unitLevels: formation.unitLevelsByUnit,
          });
        }
        fresh.running = true;
        const deployed = spawnHuman(fresh, unit.combatKind as UnitKind);
        const fighter = deployed ? fresh.fighters.at(-1) : null;
        if (!fighter) throw new Error("Equipment runtime proof could not deploy a fighter");
        gameRef.current = fresh;
        setStarted(true);
        setPaused(false);
        setEnd(null);
        setScreen("battle");
        return {
          mode,
          equipped,
          profile,
          serializedResume,
          unitId: unit.id,
          kind: fighter.kind,
          baseHp: fresh.baseHp,
          baseMaxHp: fresh.baseMaxHp,
          energy: fresh.energy,
          supportGauge: fresh.supportGauge,
          fighter: {
            hp: fighter.hp,
            maxHp: fighter.maxHp,
            damage: fighter.damage,
            range: fighter.range,
            speed: fighter.speed,
            laneSpeed: fighter.laneSpeed,
            attackEvery: fighter.attackEvery,
            defense: fighter.defense,
            deployCooldown: deployed.deployCooldown,
          },
          formation: fresh.survivalRun ? {
            personalEquipmentByUnit: { ...fresh.survivalRun.formation.personalEquipmentByUnit },
            tacticalEquipmentIds: [...fresh.survivalRun.formation.tacticalEquipmentIds],
            equipmentEnhancementLevels: {
              ...fresh.survivalRun.formation.equipmentEnhancementLevels,
            },
          } : null,
        };
      },
      getSnapshot: () => {
        const g = gameRef.current;
        const currentCampaignSave = campaignSaveRef.current;
        const geometry = stageGeometryFor(g.definition.stageId, activeStageViewportId);
        const battleSpace = battleSpaceFor(g.definition.stageId, activeStageViewportId);
        const grounding = combatReadyGroundingAudit({ geometry, fighters: g.fighters });
        return {
          screen,
          resultId: g.resultId,
          stageId: g.definition.stageId,
          operationId: g.definition.operationId,
          operationCategory: g.definition.operationCategory,
          time: g.time,
          running: g.running,
          paused: g.paused,
          over: g.over,
          won: g.won,
          survivalRun: g.survivalRun ? {
            ...g.survivalRun,
            formation: {
              ...g.survivalRun.formation,
              unitIds: [...g.survivalRun.formation.unitIds],
              unitLevelsByUnit: { ...g.survivalRun.formation.unitLevelsByUnit },
              personalEquipmentByUnit: { ...g.survivalRun.formation.personalEquipmentByUnit },
              tacticalEquipmentIds: [...g.survivalRun.formation.tacticalEquipmentIds],
              equipmentEnhancementLevels: { ...g.survivalRun.formation.equipmentEnhancementLevels },
            },
            crawler: { ...g.survivalRun.crawler },
            manualAbilityCooldownsByKind: Object.fromEntries(
              Object.entries(g.survivalRun.manualAbilityCooldownsByKind ?? {})
                .map(([kind, cooldowns]) => [kind, [...cooldowns]]),
            ),
            temporaryUpgradeStacks: { ...g.survivalRun.temporaryUpgradeStacks },
            pendingUpgradeChoices: [...g.survivalRun.pendingUpgradeChoices],
            stats: { ...g.survivalRun.stats },
            checkpointRewards: [...g.survivalRun.checkpointRewards],
            pendingReward: { ...g.survivalRun.pendingReward },
          } : null,
          survivalProgress: {
            ...currentCampaignSave.survival,
            unlockedStartWaves: [...currentCampaignSave.survival.unlockedStartWaves],
            processedRunIds: [...currentCampaignSave.survival.processedRunIds],
            claimedRewardIds: [...currentCampaignSave.survival.claimedRewardIds],
          },
          equipmentInventory: [...currentCampaignSave.equipmentInventory],
          survivalSettlementPersistenceAttempts: survivalSettlementPersistenceQaRef.current.attempts,
          outbreakSettlementPersistenceAttempts: outbreakSettlementPersistenceQaRef.current.attempts,
          bossDefeated: g.bossDefeated,
          bossDefeatPending: g.bossDefeatPending,
          baseHp: g.baseHp,
          baseMaxHp: g.baseMaxHp,
          barricadeHp: g.barricadeHp,
          barricadeMaxHp: g.barricadeMaxHp,
          barricadeVulnerable: g.barricadeVulnerable,
          wave: g.wave,
          eventIndex: g.eventIndex,
          timelineLength: g.definition.timeline.length,
          pendingSpawnCount: g.enemySpawn.pending.length,
          takuyaEntranceAudioRemaining: g.takuyaEntranceAudioRemaining,
          crawlerFootstepCount: g.crawlerFootstepCount,
          crawlerDoor: { ...g.crawlerDoor },
          pendingWeaponHits: g.pendingWeaponHits.map((hit) => ({ ...hit })),
          energy: g.energy,
          scrap: g.scrap,
          supportGauge: g.supportGauge,
          storyBattleReadEventIds: [...g.storyBattleReadEventIds],
          storyBattleReceiptEventIds: [...g.storyBattleReceiptEventIds],
          storyBattleEvaluatedCueKeys: [...g.storyBattleBarkState.evaluatedCueKeys],
          battleBarks: {
            clock: g.battleBarks.clock,
            active: g.battleBarks.active.map((bark) => ({ ...bark })),
            pendingScripted: g.battleBarks.pendingScripted.map((bark) => ({ ...bark })),
            scriptedCueIds: [...g.battleBarks.scriptedCueIds],
          },
          roleMetrics: { ...g.roleMetrics },
          stationMetrics: { ...g.stationMetrics },
          stageMission: { ...g.stageMission },
          researchContainer: g.researchContainer ? { ...g.researchContainer } : null,
          stationHazards: g.stationHazards.map((hazard) => ({ ...hazard })),
          geometry: {
            viewportId: geometry.viewport.id,
            checkedCount: grounding.checkedCount,
            offFloorCount: grounding.offFloorCount,
            offFloorIds: grounding.offFloor.map(({ id }) => id),
            visuallyOffFloorCount: grounding.visuallyOffFloorCount,
            visuallyOffFloorIds: grounding.visuallyOffFloor.map(({ id }) => id),
            visualFloor: { ...geometry.floor.visual },
            laneCenters: geometry.lanes.map(({ y }) => y),
            debugPrimitiveCount: geometry.debugPrimitives.length,
          },
          battleSpace: {
            playerFacingLaneCount: battleSpace.playerFacingLaneCount,
            supportArea: { ...battleSpace.supportArea },
            crawlerDoor: { ...battleSpace.crawler.door },
            crawlerRampFoot: { ...battleSpace.crawler.rampFoot },
            enemyPortalCount: battleSpace.spawnPortals.enemy.length,
          },
          battlefieldObjects: g.battlefieldObjects.map((object) => ({
            id: object.id,
            kind: object.kind,
            lane: object.lane,
            x: object.x,
            y: object.y,
            phase: object.phase,
          })),
          airstrike: { ...g.airstrike },
          placementIndicator: g.placementIndicator ? { ...g.placementIndicator } : null,
          attackIdentity: g.shots
            .filter((shot) => shot.sourceId !== undefined)
            .map((shot) => ({
              sourceId: shot.sourceId ?? null,
              targetId: shot.targetId ?? null,
              damageTargetId: shot.damageTargetId ?? null,
              weapon: shot.weapon ?? null,
              shotIndex: shot.shotIndex ?? null,
              recoil: shot.recoil ?? null,
              casing: shot.casing ?? false,
              hitStopSeconds: shot.hitStopSeconds ?? 0,
            })),
          fighters: g.fighters.map((fighter) => ({
            id: fighter.id,
            side: fighter.side,
            kind: fighter.kind,
            aiProfile: fighter.aiProfile,
            lane: fighter.lane,
            assignedLane: fighter.anchorLane,
            x: fighter.x,
            y: fighter.y,
            renderDepthScale: activeBattlefieldDepthScale(fighter.y),
            hp: fighter.hp,
            maxHp: fighter.maxHp,
            damage: fighter.damage,
            cooldown: fighter.cooldown,
            attack: fighter.attack,
            attackSequence: fighter.attackSequence,
            speed: fighter.speed,
            laneSpeed: fighter.laneSpeed,
            range: fighter.range,
            attackEvery: fighter.attackEvery,
            defense: fighter.defense,
            healingMultiplier: fighter.healingMultiplier,
            trapDurationMultiplier: fighter.trapDurationMultiplier,
            progressionLevel: fighter.progressionLevel ?? 1,
            progressionRank: fighter.progressionRank ?? 0,
            bodyRadius: fighter.bodyRadius,
            targetId: fighter.targetId,
            targetObjectId: fighter.targetObjectId,
            crawlerDefenseTargetId: fighter.crawlerDefenseTargetId ?? null,
            aiDestinationX: fighter.aiDestinationX,
            aiMoveDirection: fighter.aiMoveDirection,
            targetable: fighter.targetable !== false,
            combatReady: fighter.combatReady,
            gateEntering: fighter.gateEntering,
            entryDirection: fighter.entryDirection ?? -1,
            spawnPortalId: fighter.spawnPortalId ?? null,
            spawnEntryMode: fighter.spawnEntryMode ?? null,
            combatReadyX: fighter.combatReadyX,
            combatReadyY: fighter.combatReadyY ?? fighter.y,
            entryRampX: fighter.entryRampX ?? null,
            entryRampY: fighter.entryRampY ?? null,
            entryRampCleared: fighter.entryRampCleared ?? true,
            contained: fighter.contained,
            stunned: fighter.stunned,
            damageReductionRemaining: fighter.damageReductionRemaining,
            damageReductionMultiplier: fighter.damageReductionMultiplier,
            comboHits: fighter.comboHits,
            weaponHeat: fighter.weaponHeat,
            overheated: fighter.overheated,
            suppressionStacks: fighter.suppressionStacks,
            suppressedRemaining: fighter.suppressedRemaining,
            slowMultiplier: fighter.slowMultiplier,
            guardStandRemaining: fighter.guardStandRemaining,
            guardStandAvailable: fighter.guardStandAvailable,
            engineerTrapReady: fighter.engineerTrapReady,
            engineerTrapX: fighter.engineerTrapX,
            engineerTrapManual: fighter.engineerTrapManual,
            armorBreakStacks: fighter.armorBreakStacks,
            navigationRecovery: { ...fighter.navigationRecovery },
            stationAbility: { ...fighter.stationAbility },
            manualAbility: fighter.manualAbility ? { ...fighter.manualAbility } : null,
            mayoBiteSlowRemaining: fighter.mayoBiteSlowRemaining ?? 0,
            mayoRetreat: fighter.mayoRetreat ? { ...fighter.mayoRetreat } : null,
            visionDisruptedRemaining: fighter.visionDisruptedRemaining ?? 0,
          })),
          corpses: g.corpses.map((corpse) => ({ ...corpse })),
          manualAbilityVfx: g.manualAbilityVfx.map((effect) => ({ ...effect })),
          manualAbilityReceipts: g.manualAbilityReceipts.map((receipt) => ({ ...receipt })),
          areaEffects: g.areaEffects.map((effect) => ({ ...effect })),
          completedStageIds: [...campaignSave.completedStageIds],
          unlockedStageIds: [...campaignSave.unlockedStageIds],
          processedResultIds: [...campaignSave.processedResultIds],
          caps: campaignSave.caps,
          unitLevels: { ...campaignSave.unitLevels },
          unitRanks: { ...campaignSave.unitRanks },
          settings: { ...campaignSave.settings },
        };
      },
      getPerformanceSnapshot: () => ({ ...runtimePerformanceRef.current }),
    };
    qaWindow.__ASHFALL_BATTLE_QA__ = bridge;
    const runtimePerformanceBridge = runtimePerformanceRef.current;
    qaWindow.__ASHFALL_RUNTIME_PERFORMANCE__ = runtimePerformanceBridge;
    return () => {
      if (qaWindow.__ASHFALL_BATTLE_QA__ === bridge) delete qaWindow.__ASHFALL_BATTLE_QA__;
      if (qaWindow.__ASHFALL_RUNTIME_PERFORMANCE__ === runtimePerformanceBridge) {
        delete qaWindow.__ASHFALL_RUNTIME_PERFORMANCE__;
      }
    };
  }, [campaignSave.caps, campaignSave.completedStageIds, campaignSave.processedResultIds, campaignSave.settings, campaignSave.unitLevels, campaignSave.unitRanks, campaignSave.unlockedStageIds, persistCampaignSave, qaMode, screen]);

  useEffect(() => {
    const syncVisualViewport = () => {
      const viewport = window.visualViewport;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const offsetLeft = viewport?.offsetLeft ?? 0;
      const offsetTop = viewport?.offsetTop ?? 0;
      const root = document.documentElement;
      root.style.setProperty("--app-viewport-width", `${width}px`);
      root.style.setProperty("--app-viewport-height", `${height}px`);
      root.style.setProperty("--app-viewport-left", `${offsetLeft}px`);
      root.style.setProperty("--app-viewport-top", `${offsetTop}px`);
      root.dataset.viewportSource = viewport ? "visual" : "layout";
      const qaSafeArea = resolveLocalQaSafeArea(window.location.hostname, window.location.search);
      if (qaSafeArea) {
        root.style.setProperty("--app-viewport-safe-top", `${qaSafeArea.top}px`);
        root.style.setProperty("--app-viewport-safe-right", `${qaSafeArea.right}px`);
        root.style.setProperty("--app-viewport-safe-bottom", `${qaSafeArea.bottom}px`);
        root.style.setProperty("--app-viewport-safe-left", `${qaSafeArea.left}px`);
        root.dataset.safeAreaSource = "local-qa-iphone-landscape";
      }
    };
    syncVisualViewport();
    window.addEventListener("resize", syncVisualViewport);
    window.addEventListener("orientationchange", syncVisualViewport);
    window.visualViewport?.addEventListener("resize", syncVisualViewport);
    window.visualViewport?.addEventListener("scroll", syncVisualViewport);
    return () => {
      window.removeEventListener("resize", syncVisualViewport);
      window.removeEventListener("orientationchange", syncVisualViewport);
      window.visualViewport?.removeEventListener("resize", syncVisualViewport);
      window.visualViewport?.removeEventListener("scroll", syncVisualViewport);
    };
  }, []);

  const chooseAction = useCallback((action: SelectedAction) => {
    selectedActionRef.current = action;
    gameRef.current.placementIndicator = null;
    setSelectedAction(action);
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setAssetsReady(false);
      setAssetError(false);
    });
    const loadImage = (src: string, onReady: (image: HTMLImageElement) => void) => new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        const finish = () => {
          if (!image.naturalWidth) { reject(new Error(`Image unavailable: ${src}`)); return; }
          if (!cancelled) onReady(image);
          resolve();
        };
        if (typeof image.decode === "function") void image.decode().catch(() => undefined).finally(finish);
        else finish();
      };
      image.onerror = () => reject(new Error(`Image unavailable: ${src}`));
      image.src = src;
    });
    const ensureImageLoaded = (
      current: HTMLImageElement | null | undefined,
      src: string,
      onReady: (image: HTMLImageElement) => void,
    ) => {
      if (current?.naturalWidth) {
        onReady(current);
        return Promise.resolve();
      }
      return loadImage(src, onReady);
    };
    const releaseImage = (image: HTMLImageElement | null | undefined) => {
      if (!image) return;
      image.onload = null;
      image.onerror = null;
      image.removeAttribute("src");
    };
    const selectedFormationKinds = formationKindKey.split("|").filter(Boolean) as UnitKind[];
    const activeOutbreakEnemyKinds = selectedOutbreakMissionId
      ? OUTBREAK_MISSION_BY_ID[selectedOutbreakMissionId]?.enemyKinds ?? []
      : [];
    const stageEnemyKinds = activeOutbreakEnemyKinds.length > 0
      ? activeOutbreakEnemyKinds as UnitKind[]
      : Array.isArray(CAMPAIGN_STAGE_BY_ID[activeBattlefieldStageId]?.enemyKinds)
        ? CAMPAIGN_STAGE_BY_ID[activeBattlefieldStageId].enemyKinds as UnitKind[]
        : [];
    // QA galleries intentionally exercise every atlas. Production only retains
    // the selected formation and the current stage's enemy roster, preventing
    // all 23 high-resolution atlases from occupying mobile memory at once.
    // `turned` can be created from any fallen ally, independent of the stage's
    // authored enemy roster, so its atlas must remain available in production.
    const requiredSpriteKinds = qaMode || qaScenario
      ? [...spriteKinds]
      : [...new Set([...selectedFormationKinds, ...stageEnemyKinds, "turned" as UnitKind])];
    const persistentPaths: Record<string, string> = {
      crawlerClosed: V075_VISUAL_PROFILES.crawler.closed.path,
      crawlerOpen: V075_VISUAL_PROFILES.crawler.open.path,
      pod: "/tactical-drop-pod-v1.png",
      drum: "/explosive-drum-v1.png", medical: "/medical-supply-station-v1.png",
    };
    const stageObjectAssets = STAGE_OBJECT_MANIFEST[activeBattlefieldStageId]?.objects ?? [];
    const retainedSpriteKeys = new Set([...Object.keys(persistentPaths), ...requiredSpriteKinds]);
    for (const [key, image] of Object.entries(spriteRefs.current)) {
      if (retainedSpriteKeys.has(key)) continue;
      releaseImage(image);
      delete spriteRefs.current[key];
    }
    const retainedStageObjectIds = new Set(stageObjectAssets.map((object) => object.id));
    for (const [id, image] of Object.entries(stageObjectRefs.current)) {
      if (retainedStageObjectIds.has(id)) continue;
      releaseImage(image);
      delete stageObjectRefs.current[id];
    }
    for (const [stageId, image] of Object.entries(backgroundCacheRef.current)) {
      if (stageId === activeBattlefieldStageId) continue;
      releaseImage(image);
      delete backgroundCacheRef.current[stageId];
    }
    if (!backgroundCacheRef.current[activeBattlefieldStageId]) backgroundRef.current = null;
    const currentBackground = backgroundCacheRef.current[activeBattlefieldStageId];
    const criticalJobs = [
      ensureImageLoaded(currentBackground, stageVisualFor(activeBattlefieldStageId), (image) => {
        backgroundCacheRef.current[activeBattlefieldStageId] = image;
        backgroundRef.current = image;
      }),
      ensureImageLoaded(enemyBaseSpriteRef.current, V075_VISUAL_PROFILES.enemyBase.intact.path, (image) => { enemyBaseSpriteRef.current = image; }),
      ...Object.entries(persistentPaths).map(([key, src]) => (
        ensureImageLoaded(spriteRefs.current[key], src, (image) => { spriteRefs.current[key] = image; })
      )),
      ...requiredSpriteKinds.map((kind) => (
        ensureImageLoaded(spriteRefs.current[kind], spriteSheetPath(kind), (image) => { spriteRefs.current[kind] = image; })
      )),
      ...stageObjectAssets.map((object) => (
        ensureImageLoaded(stageObjectRefs.current[object.id], object.path, (image) => { stageObjectRefs.current[object.id] = image; })
      )),
    ];
    void Promise.all(criticalJobs).then(() => {
      if (cancelled) return;
      const root = document.documentElement;
      root.dataset.assetResidentScope = qaMode || qaScenario ? "all-local-qa" : "stage-and-formation";
      root.dataset.assetResidentStage = activeOperationId;
      root.dataset.assetResidentSprites = String(Object.keys(spriteRefs.current).length);
      root.dataset.assetResidentStageObjects = String(Object.keys(stageObjectRefs.current).length);
      root.dataset.assetResidentBackgrounds = String(Object.keys(backgroundCacheRef.current).length);
      setAssetsReady(true);
    }).catch(() => { if (!cancelled) setAssetError(true); });
    return () => { cancelled = true; };
  }, [activeBattlefieldStageId, activeOperationId, formationKindKey, qaMode, qaScenario, selectedOutbreakMissionId]);

  useEffect(() => {
    const configureCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const viewportProfile = resolveStageViewportProfile({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
      activeStageViewportId = viewportProfile.id;
      const geometryStageId = screen === "battle"
        ? gameRef.current.definition.stageId
        : activeBattlefieldStageId;
      const nextStageGeometry = stageGeometryFor(geometryStageId, viewportProfile.id);
      const nextLaneCenters = nextStageGeometry.lanes.map(({ y }) => y) as LaneCenters;
      if (nextLaneCenters.some((center, lane) => center !== activeLaneCenters[lane])) {
        const previousLaneCenters = activeLaneCenters;
        const shiftForLane = (lane: Lane) => nextLaneCenters[lane] - previousLaneCenters[lane];
        const g = gameRef.current;
        for (const fighter of g.fighters) fighter.y += shiftForLane(fighter.lane);
        for (const corpse of g.corpses) corpse.y += shiftForLane(corpse.lane);
        for (const object of g.battlefieldObjects) object.y += shiftForLane(object.lane);
        for (const effect of g.areaEffects) effect.y += shiftForLane(effect.lane);
        g.stationHazards = relocateStationHazards({
          hazards: g.stationHazards,
          previousLaneCenters,
          nextLaneCenters,
        }) as StationHazard[];
        for (const entry of g.enemySpawn.pending) entry.y += shiftForLane(entry.lane);
        if (g.placementIndicator) g.placementIndicator.y += shiftForLane(g.placementIndicator.lane);
        const hitLane = ([0, 1, 2] as Lane[]).reduce((nearest, lane) => (
          Math.abs(g.barricadeHitY - previousLaneCenters[lane]) < Math.abs(g.barricadeHitY - previousLaneCenters[nearest]) ? lane : nearest
        ), 1 as Lane);
        g.barricadeHitY += shiftForLane(hitLane);
        g.shots = [];
        g.manualAbilityVfx = [];
        g.particles = [];
        g.damageTexts = [];
        activeLaneCenters = nextLaneCenters;
      }
      activeStageGeometry = nextStageGeometry;
      const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
      const pixelHeight = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      canvas.dataset.dpr = String(dpr);
      const scale = Math.max(rect.width / W, rect.height / H);
      const offsetX = (rect.width - W * scale) / 2;
      const offsetY = (rect.height - H * scale) / 2;
      canvasTransformRef.current = { scale, offsetX, offsetY };
      canvas.dataset.worldScale = scale.toFixed(6);
      canvas.dataset.worldOffsetX = offsetX.toFixed(2);
      canvas.dataset.worldOffsetY = offsetY.toFixed(2);
      canvas.dataset.laneLayout = compactBattleViewport() ? "compact-landscape" : "standard";
      canvas.dataset.visualFloorAuthored = String(nextStageGeometry.floor.visual.authored);
      canvas.dataset.visualFloorHorizonY = String(nextStageGeometry.floor.visual.horizonY);
      canvas.dataset.visualFloorNearEdgeY = String(nextStageGeometry.floor.visual.nearEdgeY);
      const ctx = canvas.getContext("2d");
      ctx?.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);
    };
    configureCanvas();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(configureCanvas);
    if (canvasRef.current) observer?.observe(canvasRef.current);
    window.addEventListener("resize", configureCanvas);
    window.addEventListener("orientationchange", configureCanvas);
    window.visualViewport?.addEventListener("resize", configureCanvas);
    window.visualViewport?.addEventListener("scroll", configureCanvas);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", configureCanvas);
      window.removeEventListener("orientationchange", configureCanvas);
      window.visualViewport?.removeEventListener("resize", configureCanvas);
      window.visualViewport?.removeEventListener("scroll", configureCanvas);
    };
  }, [activeBattlefieldStageId, screen]);

  const ensureAudio = useCallback(() => {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioRef.current || audioRef.current.state === "closed") audioRef.current = new AudioCtx();
    return audioRef.current;
  }, []);

  const ensureSfxRuntime = useCallback((audio: AudioContext) => {
    const current = sfxRuntimeRef.current;
    if (current?.context === audio) return current;
    const master = audio.createGain();
    const ui = audio.createGain();
    const combat = audio.createGain();
    const ambient = audio.createGain();
    const major = audio.createGain();
    master.gain.value = .85;
    ui.gain.value = .8; combat.gain.value = .92; ambient.gain.value = .55; major.gain.value = 1;
    ui.connect(master); combat.connect(master); ambient.connect(master); major.connect(master); master.connect(audio.destination);
    const runtime: SfxRuntime = {
      context: audio,
      master,
      buses: { ui, combat, ambient, major },
      active: new Map(),
      lastPlayedAt: new Map(),
    };
    sfxRuntimeRef.current = runtime;
    return runtime;
  }, []);

  const playCue = useCallback((cueId: SfxCueId, options?: { frequency?: number }) => {
    if (sfxMutedRef.current) return false;
    const productionMixer = productionMixerRef.current;
    const productionCue = LEGACY_SFX_CUE_MAP[cueId];
    if (!productionMixer) return false;
    const cue = SFX_CUES[cueId];
    const fallback = () => productionMixer.playTestTone({
      frequency: options?.frequency ?? cue.frequency,
      duration: cue.duration,
      volume: Math.min(.08, cue.volume),
      respectSettings: true,
    });
    if (!productionCue) return fallback();
    void runGuardedAudioRequest({
      gate: sfxRequestGateRef.current,
      unlock: () => productionMixer.unlocked ? true : productionMixer.unlock(),
      isMuted: () => sfxMutedRef.current,
      fallback,
      play: (guardedFallback) => productionMixer.play(productionCue, {
        priority: cue.priority,
        cooldownMs: cue.cooldown * 1000,
        maxInstances: cue.category === "major" ? 2 : 5,
        durationSeconds: productionCue === "radio-open" ? .72 : undefined,
        duck: cue.duck ? {
          level: cue.duck.level,
          attackMs: 24,
          holdMs: cue.duck.seconds * 1000,
          releaseMs: 220,
        } : undefined,
        onLoadFailure: guardedFallback,
      }),
    });
    return true;
  }, []);

  const playProductionCue = useCallback((
    cueId: string | null,
    x: number,
    options: {
      priority?: number;
      cooldownMs?: number;
      volume?: number;
      playbackRate?: number;
      instanceKey?: string;
      maxInstances?: number;
      durationSeconds?: number;
      fallbackCue?: SfxCueId;
      dedupeKey?: string;
    } = {},
  ) => {
    if (!cueId || sfxMutedRef.current) return false;
    const productionMixer = productionMixerRef.current;
    if (!productionMixer) return false;
    const fallback = options.fallbackCue ? () => {
      const definition = SFX_CUES[options.fallbackCue as SfxCueId];
      return productionMixer.playTestTone({
        frequency: definition.frequency,
        duration: definition.duration,
        volume: Math.min(.08, definition.volume),
        respectSettings: true,
      });
    } : null;
    const pan = Math.max(-.85, Math.min(.85, x / W * 2 - 1));
    void runGuardedAudioRequest({
      gate: sfxRequestGateRef.current,
      unlock: () => productionMixer.unlocked ? true : productionMixer.unlock(),
      isMuted: () => sfxMutedRef.current,
      fallback,
      play: (guardedFallback) => productionMixer.play(cueId, {
        pan,
        priority: options.priority,
        cooldownMs: options.cooldownMs,
        volume: options.volume,
        playbackRate: options.playbackRate,
        instanceKey: options.instanceKey,
        maxInstances: options.maxInstances,
        durationSeconds: options.durationSeconds,
        dedupeKey: options.dedupeKey,
        onLoadFailure: fallback ? guardedFallback : undefined,
      }),
    });
    return true;
  }, []);

  const announceBossEntrance = useCallback((
    g: Game,
    kind: string,
    { activateTakuyaScene = false }: { activateTakuyaScene?: boolean } = {},
  ) => {
    const definition = bossDefinitionForEnemyKind(kind);
    if (!definition) return false;
    const receiptId = `boss-entrance:${kind}:wave-${g.wave}`;
    if (g.signalIds.includes(receiptId)) return false;
    g.signalIds.push(receiptId);
    g.banner = definition.entrance.warningLabel;
    g.bannerTime = 3.2;
    g.flashOverlay = Math.max(g.flashOverlay, .18);
    g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.takuyaEntrance);
    playProductionCue(definition.entrance.cueId, W / 2, {
      priority: 104,
      cooldownMs: 0,
      volume: .92,
      maxInstances: 1,
      fallbackCue: "boss-warning",
      dedupeKey: receiptId,
    });
    if (kind === "takuya") {
      if (activateTakuyaScene) {
        g.takuyaEntranceAudioRemaining = TAKUYA_ENTRANCE_AUDIO.durationSeconds;
        setHud((current) => ({ ...current, takuyaEntranceAudioActive: true }));
      }
      emitBattleBark(g, "takuya-entrance", "ranger", receiptId);
    } else {
      emitBattleBark(g, "wave-contact", "guide", receiptId);
    }
    const qaState = bossFoundationQaRef.current;
    qaState.entranceCounts[kind] = (qaState.entranceCounts[kind] ?? 0) + 1;
    qaState.lastEntrance = {
      kind,
      cueId: definition.entrance.cueId,
      warningLabel: definition.entrance.warningLabel,
    };
    return true;
  }, [playProductionCue]);

  const resumeBattleAudioLoops = useCallback((g: Game) => {
    const productionMixer = productionMixerRef.current;
    const burningCorpses = g.corpses.filter((corpse) => corpse.state === "burning").slice(0, 3);
    const nextBurningIds = new Set(burningCorpses.map((corpse) => corpse.id));
    for (const previousId of activeBurnLoopIdsRef.current) {
      if (!nextBurningIds.has(previousId)) {
        productionMixer?.stopInstance(`${BATTLE_AUDIO_LOOP_CONTRACTS.corpseBurn.instanceKey}:${previousId}`, { fadeMs: 60 });
      }
    }
    activeBurnLoopIdsRef.current = nextBurningIds;
    // Keep desired loop state while audio is locked. The RUNNING observer starts
    // it once, avoiding per-frame unlock churn after a rejected gesture.
    if (!productionMixer?.unlocked) return;

    const chainsawInstanceKey = BATTLE_AUDIO_LOOP_CONTRACTS.crazyKingChainsaw.instanceKey;
    if (g.fighters.some((fighter) => fighter.side === "human" && fighter.kind === "crazy-king" && fighter.hp > 0)
      && !productionMixer.hasInstance(chainsawInstanceKey)) {
      playProductionCue(BATTLE_AUDIO_LOOP_CONTRACTS.crazyKingChainsaw.cueId, W / 2, {
        priority: 48,
        cooldownMs: 0,
        volume: .32,
        instanceKey: chainsawInstanceKey,
        dedupeKey: chainsawInstanceKey,
        maxInstances: 1,
      });
    }
    for (const burningCorpse of burningCorpses) {
      const instanceKey = `${BATTLE_AUDIO_LOOP_CONTRACTS.corpseBurn.instanceKey}:${burningCorpse.id}`;
      if (productionMixer.hasInstance(instanceKey)) continue;
      playProductionCue(BATTLE_AUDIO_LOOP_CONTRACTS.corpseBurn.cueId, burningCorpse.x, {
        priority: 42,
        cooldownMs: 0,
        volume: .7,
        instanceKey,
        dedupeKey: instanceKey,
        maxInstances: 1,
      });
    }
  }, [playProductionCue]);

  useEffect(() => {
    resumeBattleAudioLoopsRef.current = resumeBattleAudioLoops;
  }, [resumeBattleAudioLoops]);

  const chooseActionWithCue = useCallback((action: SelectedAction) => {
    const g = gameRef.current;
    if (!g.running || g.paused || g.over) return;
    if (selectedActionRef.current === action) return;
    chooseAction(action);
    playCue(action ? "ui-confirm" : "ui-cancel");
  }, [chooseAction, playCue]);

  const activateManualAbility = useCallback((fighterId: number) => {
    const g = gameRef.current;
    if (!g.running || g.paused || g.over || selectedActionRef.current) return false;
    const fighter = g.fighters.find((candidate) => (
      candidate.id === fighterId
      && candidate.side === "human"
      && candidate.hp > 0
    ));
    const targetCandidates = fighter ? manualAbilityTargetCandidates(g, fighter) : g.fighters;
    if (!fighter?.manualAbility || !canActivateManualAbility({ fighter, fighters: targetCandidates })) {
      playCue("denied");
      return false;
    }
    const target = selectManualAbilityTarget({ owner: fighter, fighters: targetCandidates });
    const startedAbility = beginManualAbility(fighter.manualAbility, target);
    if (!startedAbility.ok || !target) {
      playCue("denied");
      return false;
    }
    const definition = MANUAL_ABILITY_REGISTRY[fighter.kind];
    if (!definition || definition.runtimeStatus !== "integrated") {
      playCue("denied");
      return false;
    }
    fighter.manualAbility = startedAbility.runtime as ManualAbilityRuntime;
    g.manualAbilityReceipts.push({
      ownerId: fighter.id,
      activationId: startedAbility.activationId,
      kind: fighter.kind,
      eventType: "start",
      at: g.time,
      attackSequence: fighter.attackSequence,
    });
    g.manualAbilityReceipts = g.manualAbilityReceipts.slice(-32);
    fighter.attack = Math.max(fighter.attack, definition.windupSeconds);
    fighter.cooldown = Math.max(fighter.cooldown, definition.windupSeconds);
    fighter.flash = Math.max(fighter.flash, .26);
    g.manualAbilityVfx = [...g.manualAbilityVfx, {
      ownerId: fighter.id,
      activationId: startedAbility.activationId,
      kind: fighter.kind,
      originX: fighter.x + 8,
      originY: fighter.y - 62,
      targetX: target.x,
      targetY: target.y - 8,
      elapsed: 0,
      duration: fighter.kind === "miyamoto-musashi"
        ? definition.windupSeconds + definition.guardSeconds
        : fighter.kind === "mayo-chan"
          ? definition.windupSeconds + definition.activeSeconds
        : ["crazy-king", "kumaverson", "guardian"].includes(fighter.kind)
          ? definition.windupSeconds + definition.activeSeconds
        : fighter.kind === "mrs-chiha"
          ? definition.windupSeconds
            + definition.salvoIntervalSeconds * (definition.salvoCount - 1)
            + definition.projectileTravelSeconds
            + definition.recoverySeconds
        : ["brawler", "scout", "ranger", "medic", "brute", "babayaga", "gunner", "engineer"].includes(fighter.kind)
          ? definition.windupSeconds + .55
        : definition.windupSeconds,
      points: target.points?.map((point: { x: number; y: number }) => ({ x: point.x, y: point.y - 8 })),
      windupSeconds: definition.windupSeconds,
      salvoIntervalSeconds: definition.salvoIntervalSeconds,
      projectileTravelSeconds: definition.projectileTravelSeconds,
    }].slice(-8);
    g.banner = `${cards.find((card) => card.kind === fighter.kind)?.name ?? fighter.kind} // ${definition.displayName}`;
    g.bannerTime = 1.15;
    setHud((current) => ({
      ...current,
      manualAbilityIcons: current.manualAbilityIcons.filter((icon) => icon.fighterId !== fighter.id),
    }));
    playCue("ui-confirm");
    if (fighter.kind === "zakimiya") playCue("burn-start");
    const abilityStartCue = fighter.kind === "tky"
      ? unitAudioCueFor(fighter.kind, "weapon", "abilityCharge")
      : fighter.kind === "mrs-chiha"
        ? unitAudioCueFor(fighter.kind, "weapon", "abilityReady")
        : fighter.kind === "miyamoto-musashi"
          ? unitAudioCueFor(fighter.kind, "weapon", "abilityGuard")
          : fighter.kind === "mayo-chan"
            ? unitAudioCueFor(fighter.kind, "weapon", "abilityStart")
          : fighter.kind === "crazy-king"
            ? unitAudioCueFor(fighter.kind, "weapon", "attack")
            : fighter.kind === "kumaverson"
              ? unitAudioCueFor(fighter.kind, "weapon", "swing")
              : fighter.kind === "babayaga"
                ? unitAudioCueFor(fighter.kind, "weapon", "shot")
                : weaponCueForUnit(fighter.kind);
    if (abilityStartCue) {
      playProductionCue(abilityStartCue, fighter.x, {
        priority: 82,
        cooldownMs: 240,
        maxInstances: 1,
        fallbackCue: fighter.kind === "mrs-chiha" ? "ranged-shot" : "melee-hit",
        dedupeKey: `manual-ability:${fighter.id}:${startedAbility.activationId}:start`,
      });
    }
    return true;
  }, [playCue, playProductionCue]);

  const stopSfx = useCallback(() => {
    sfxRequestGateRef.current.cancelPending();
    if (startCueTimerRef.current !== null) {
      window.clearTimeout(startCueTimerRef.current);
      startCueTimerRef.current = null;
    }
    const productionMixer = productionMixerRef.current;
    if (productionMixer) {
      stopBattleAudioLoops(productionMixer, { fadeMs: 35 });
      for (const corpseId of activeBurnLoopIdsRef.current) {
        productionMixer.stopInstance(`${BATTLE_AUDIO_LOOP_CONTRACTS.corpseBurn.instanceKey}:${corpseId}`, { fadeMs: 35 });
      }
      activeBurnLoopIdsRef.current.clear();
      for (const category of ["ui", "weapons", "melee", "humanVoices", "monsters", "support"] as const) {
        productionMixer.stopAll({ category, fadeMs: 35 });
      }
    }
    const runtime = sfxRuntimeRef.current;
    if (!runtime) return;
    for (const voice of runtime.active.values()) {
      try { voice.oscillator.stop(); } catch { /* The cue may already have ended. */ }
      try { voice.gain.disconnect(); } catch { /* The voice may already be disconnected. */ }
    }
    runtime.active.clear();
    runtime.lastPlayedAt.clear();
    for (const bus of Object.values(runtime.buses)) {
      try { bus.disconnect(); } catch { /* The bus may already be disconnected. */ }
    }
    try { runtime.master.disconnect(); } catch { /* The master may already be disconnected. */ }
    sfxRuntimeRef.current = null;
  }, []);

  const syncMusicMode = useCallback((mode: MusicMode) => {
    desiredMusicModeRef.current = mode;
    const productionMixer = productionMixerRef.current;
    if (!productionMixer) return;
    const g = gameRef.current;
    // React owns the two authored silence scenes. The simulation still tracks
    // the eventual boss/danger mode, but must not overwrite either silence
    // while its entrance timer or fixed final lines remain active.
    if (battleSilenceSceneId(g)) return;
    const sceneId = sceneIdForScreen("battle", g.definition.stageId, { musicMode: mode });
    if (desiredProductionSceneRef.current === sceneId) return;
    desiredProductionSceneRef.current = sceneId;
    if (sceneId && productionMixer.getSettings().bgmEnabled) {
      void productionMixer.setScene(sceneId).then((state) => {
        if (desiredProductionSceneRef.current !== sceneId) return;
        setMusicActive(Boolean(state?.bgmAssetId));
      }).catch(() => setMusicActive(false));
    }
  }, []);

  const stopSynthMusic = useCallback(() => {
    const music = musicRef.current;
    if (!music) return;
    window.clearInterval(music.timer);
    const audio = audioRef.current;
    if (audio && audio.state !== "closed") {
      music.master.gain.cancelScheduledValues(audio.currentTime);
      music.master.gain.setTargetAtTime(.0001, audio.currentTime, .055);
    }
    window.setTimeout(() => { try { music.master.disconnect(); } catch { /* Already disconnected. */ } }, 320);
    musicRef.current = null;
  }, []);

  const stopMusic = useCallback(() => {
    musicStartTokenRef.current++;
    musicDuckUntilRef.current = 0;
    setMusicActive(false);
    const productionMixer = productionMixerRef.current;
    if (productionMixer) void productionMixer.stopScene({ fadeMs: 220 });
    stopSynthMusic();
  }, [stopSynthMusic]);

  const stopJingle = useCallback(() => {
    const jingle = jingleRef.current;
    if (!jingle) return;
    for (const oscillator of jingle.oscillators) {
      try { oscillator.stop(); } catch { /* The note may already have ended. */ }
    }
    try { jingle.gain.disconnect(); } catch { /* Already disconnected. */ }
    jingleRef.current = null;
  }, []);

  const startSynthMusic = useCallback(() => {
    if (musicRef.current) return;
    const token = ++musicStartTokenRef.current;
    let audio: AudioContext;
    try { audio = ensureAudio(); } catch { setMusicActive(false); return; }
    if (audio.state !== "running") void audio.resume().catch(() => undefined);
    if (token !== musicStartTokenRef.current || musicRef.current) return;
    try {
      const master = audio.createGain(); const normalBus = audio.createGain(); const dangerBus = audio.createGain(); const bossBus = audio.createGain();
      musicDuckUntilRef.current = 0;
      master.gain.setValueAtTime(MUSIC_MASTER_GAIN, audio.currentTime); normalBus.gain.value = 1;
      const mode = desiredMusicModeRef.current;
      dangerBus.gain.value = mode === "normal" ? .0001 : mode === "danger" ? 1 : .55;
      bossBus.gain.value = mode === "boss" ? 1 : .0001;
      normalBus.connect(master); dangerBus.connect(master); bossBus.connect(master); master.connect(audio.destination);
      const music: MusicRuntime = { master, normalBus, dangerBus, bossBus, timer: 0, step: 0, nextStepAt: audio.currentTime + .04, mode };
      musicRef.current = music;
      setMusicActive(true);
      const bassLine = [55, 55, 65.41, 55, 49, 49, 43.65, 49, 55, 55, 73.42, 65.41, 49, 43.65, 49, 41.2];
      const melody = [220, 0, 246.94, 0, 293.66, 0, 261.63, 0, 220, 0, 329.63, 0, 293.66, 0, 196, 0];
      const voice = (frequency: number, at: number, duration: number, volume: number, type: OscillatorType, bus: GainNode, endFrequency?: number) => {
        const oscillator = audio.createOscillator(); const gain = audio.createGain();
        oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, at);
        if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + duration * .72);
        gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(volume, at + .012); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
        oscillator.connect(gain); gain.connect(bus); oscillator.start(at); oscillator.stop(at + duration + .02);
      };
      const scheduleStep = (at: number, stepNumber: number) => {
        const step = stepNumber % bassLine.length;
        voice(bassLine[step] * 2, at, .19, .16, "sawtooth", normalBus);
        if (step % 4 === 0) voice(bassLine[step] * 4, at, .82, .045, "triangle", normalBus);
        if (melody[step]) voice(melody[step], at, .17, .052, "triangle", normalBus);
        if (step % 2 === 0) voice(step % 4 === 0 ? 145 : 190, at, .09, .12, "sine", normalBus, 56);
        if (step % 2 === 1) voice(330 + (step % 4) * 48, at, .055, .075, "square", dangerBus);
        if (step % 4 === 2) voice(184, at, .13, .1, "sine", dangerBus, 68);
        voice(step % 2 ? 92 : 116, at, .075, step % 2 ? .065 : .11, "sawtooth", bossBus, 62);
        if (step % 4 === 0) voice(bassLine[step] * 2, at, .75, .075, "square", bossBus);
      };
      const scheduler = () => {
        if (musicRef.current !== music || audio.state === "closed") return;
        if (pageHiddenRef.current || document.visibilityState === "hidden") return;
        if (music.nextStepAt < audio.currentTime - .02) music.nextStepAt = audio.currentTime + .05;
        let scheduled = 0;
        while (music.nextStepAt < audio.currentTime + .12 && scheduled < 2) {
          scheduleStep(music.nextStepAt, music.step++);
          music.nextStepAt += .24;
          scheduled++;
        }
      };
      scheduler();
      music.timer = window.setInterval(scheduler, 50);
    } catch { musicRef.current = null; setMusicActive(false); }
  }, [ensureAudio]);

  const startMusic = useCallback(() => {
    const productionMixer = productionMixerRef.current;
    if (!productionMixer) return;
    const g = gameRef.current;
    const sceneId = battleSilenceSceneId(g)
      ?? sceneIdForScreen("battle", g.definition.stageId, { musicMode: desiredMusicModeRef.current });
    desiredProductionSceneRef.current = sceneId;
    productionMixer.setSettings({ bgmEnabled: true });
    if (!sceneId) return;
    void productionMixer.setScene(sceneId).then((state) => {
      if (desiredProductionSceneRef.current !== sceneId) return;
      setMusicActive(Boolean(state?.bgmAssetId));
    }).catch(() => setMusicActive(false));
  }, []);

  useEffect(() => {
    startSynthMusicRef.current = startSynthMusic;
    stopSynthMusicRef.current = stopSynthMusic;
  }, [startSynthMusic, stopSynthMusic]);

  const playEndJingle = useCallback((won: boolean) => {
    if (sfxMutedRef.current) return;
    if (productionMixerRef.current) return;
    try {
      const audio = ensureAudio();
      stopJingle();
      const master = audio.createGain();
      master.gain.setValueAtTime(1, audio.currentTime);
      master.connect(ensureSfxRuntime(audio).buses.ui);
      const runtime: JingleRuntime = { gain: master, oscillators: [] };
      jingleRef.current = runtime;
      const notes = won ? [220, 293.66, 369.99, 440] : [164.81, 138.59, 110, 73.42];
      notes.forEach((frequency, index) => {
        const at = audio.currentTime + .08 + index * .14;
        const oscillator = audio.createOscillator(); const gain = audio.createGain();
        oscillator.type = won ? "square" : "sawtooth"; oscillator.frequency.setValueAtTime(frequency, at);
        gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(.07, at + .02); gain.gain.exponentialRampToValueAtTime(.0001, at + .22);
        oscillator.connect(gain); gain.connect(master); oscillator.start(at); oscillator.stop(at + .24);
        runtime.oscillators.push(oscillator);
        if (index === notes.length - 1) {
          oscillator.onended = () => {
            if (jingleRef.current !== runtime) return;
            try { master.disconnect(); } catch { /* Already disconnected. */ }
            jingleRef.current = null;
          };
        }
      });
    } catch { /* Jingle is optional. */ }
  }, [ensureAudio, ensureSfxRuntime, stopJingle]);

  useEffect(() => () => {
    stopMusic();
    stopJingle();
    stopSfx();
    const audio = audioRef.current;
    if (audio && audio.state !== "closed") void audio.close();
  }, [stopJingle, stopMusic, stopSfx]);

  const storyFinalCutAudioActive = screen === "battle" && hud.battleBarks.some((bark) => (
    bark.scripted === true
    && bark.trigger === STORY_BATTLE_TRIGGER_IDS.FINAL_WEAKPOINT_EXPOSED
  ));
  const takuyaEntranceAudioActive = screen === "battle" && hud.takuyaEntranceAudioActive;

  useEffect(() => {
    const productionMixer = productionMixerRef.current;
    if (!productionMixer) return;
    productionMixer.setSettings({
      bgmEnabled: !bgmMuted,
      sfxEnabled: !sfxMuted,
      bgmVolume: campaignSave.settings.bgmVolume,
      sfxVolume: campaignSave.settings.sfxVolume,
      ambienceVolume: .5,
      masterVolume: .9,
    });
    productionMixer.setDialogueDucking(screen === "event" || (screen === "battle" && hud.battleBarks.length > 0), {
      level: STORY_AUDIO_MIX.dialogueBgmDuckLevel,
      ambienceLevel: STORY_AUDIO_MIX.importantAmbienceDuckLevel,
      fadeMs: STORY_AUDIO_MIX.dialogueReleaseMs,
    });
    const outcome = campaignResult?.won ?? end?.won;
    const storyLineIndex = storyAudioPosition.eventId === eventId ? storyAudioPosition.lineIndex : 0;
    const musicState = screen === "battle"
      ? (typeof outcome === "boolean"
        ? { won: outcome, musicMode: desiredMusicModeRef.current, eventId, storyLineIndex }
        : { musicMode: desiredMusicModeRef.current, eventId, storyLineIndex })
      : (typeof outcome === "boolean" ? { won: outcome, eventId, storyLineIndex } : { eventId, storyLineIndex });
    const sceneId = storyFinalCutAudioActive
      ? sceneIdForStoryEvent("stage-takuya-final-v070")
      : takuyaEntranceAudioActive
        ? TAKUYA_ENTRANCE_AUDIO.silenceSceneId
        : sceneIdForScreen(screen, activeBattlefieldStageId, musicState);
    desiredProductionSceneRef.current = sceneId;
    if (document.documentElement.dataset.audioMixer === "production") {
      document.documentElement.dataset.audioScene = sceneId ?? "none";
    }
    if (!sceneId || (screen === "battle" && paused)) {
      void productionMixer.stopScene({ fadeMs: 180 });
      stopSynthMusic();
      setMusicActive(false);
      return;
    }
    void productionMixer.setScene(sceneId).then((state) => {
      if (desiredProductionSceneRef.current !== sceneId) return;
      setMusicActive(Boolean(state?.bgmAssetId) && !bgmMuted);
    }).catch(() => setMusicActive(false));
  }, [activeBattlefieldStageId, bgmMuted, campaignResult?.won, campaignSave.settings.bgmVolume, campaignSave.settings.sfxVolume, end?.won, eventId, hud.battleBarks.length, paused, screen, sfxMuted, stopSynthMusic, storyAudioPosition.eventId, storyAudioPosition.lineIndex, storyFinalCutAudioActive, takuyaEntranceAudioActive]);

  useEffect(() => {
    const active = screen === "battle" && hud.battleBarks.length > 0;
    if (active === battleRadioActiveRef.current) return;
    battleRadioActiveRef.current = active;
    playProductionCue(active ? "radio-open" : "radio-close", 90, {
      priority: 54,
      cooldownMs: 120,
      maxInstances: 1,
      durationSeconds: active ? .72 : undefined,
    });
  }, [hud.battleBarks.length, playProductionCue, screen]);

  const deployHuman = useCallback((kind: UnitKind) => {
    const g = gameRef.current;
    if (!g.running || g.paused || g.over) return false;
    const card = equippedCardForGame(g, kind);
    if (!card || !g.formationKinds.includes(kind) || g.deployQueue.length >= 3 || !canDeploy({ running: g.running, paused: g.paused, over: g.over, command: g.energy, cost: card.cost, cooldown: g.deployCooldowns[kind] })) {
      playCue("denied");
      if (g.deployQueue.length >= 3) { g.banner = "格納庫満員 // 3"; g.bannerTime = .9; }
      return false;
    }
    g.energy -= card.cost;
    g.deployCooldowns[kind] = card.deployCooldown
      * survivalUpgradeEffects(g.survivalRun).redeployMultiplier;
    g.deployQueue.push(kind);
    g.banner = `${card.name} // 出撃待機 ${g.deployQueue.length}/3`;
    g.bannerTime = .7;
    playCue("queue");
    return true;
  }, [playCue]);

  const placeBattlefieldSupply = useCallback((kind: SupplyKind, requestedX: number, requestedY: number) => {
    const g = gameRef.current;
    if (!g.running || g.paused || g.over) return false;
    const stageObjectForbiddenZones = stageObjectForbiddenZonesForGame(g);
    const placement = correctedBattlefieldTargetForGame(g, { x: requestedX, y: requestedY }, kind);
    const target = placement.position ?? placement.requested;
    const lane = placement.legacyLane as Lane | null;
    if (!placement.ok || lane === null) {
      g.placementIndicator = placementIndicatorFor(`supply:${kind}`, activeLaneForY(target.y), target.x, target.y, false, placement.reason);
      g.banner = placementReasonLabel(placement.reason); g.bannerTime = .75; playCue("denied");
      return false;
    }
    const result = resolveBattlefieldSupplyPlacement({
      running: g.running, paused: g.paused, over: g.over, scrap: g.scrap, supplyKind: kind, lane, x: target.x, y: target.y,
      supplies: g.battlefieldObjects, objects: [], supports: [], areaEffects: g.areaEffects,
      nextId: g.nextId, nextAreaEffectId: g.nextAreaEffectId,
      laneCenters: activeLaneCenters,
      forbiddenZones: battlefieldPlacementForbiddenZones(stageObjectForbiddenZones),
    });
    const placementReason = result.ok && placement.adjusted ? placement.reason : result.reason;
    g.placementIndicator = placementIndicatorFor(`supply:${kind}`, lane, target.x, target.y, result.ok, placementReason);
    if (!result.ok) {
      g.banner = placementReasonLabel(result.reason); g.bannerTime = .75; playCue("denied");
      return false;
    }
    g.scrap = result.scrap;
    g.battlefieldObjects = result.supplies.map((supply) => ({
      ...supply,
      hitFlash: "hitFlash" in supply && typeof supply.hitFlash === "number" ? supply.hitFlash : 0,
    })) as BattlefieldObject[];
    g.areaEffects = result.areaEffects as AreaEffect[];
    g.nextId = result.nextId;
    g.nextAreaEffectId = result.nextAreaEffectId;
    g.banner = placement.adjusted
      ? `${supplyDefs[kind].name} // 最寄りの配置可能地点へ補正`
      : `${supplyDefs[kind].name} // 戦場配置`;
    g.bannerTime = 1.2; playCue(kind === "pod" ? "supply-pod" : kind === "drum" ? "supply-drum" : "supply-medical");
    emitBattleBark(g, kind === "pod" ? "support-pod" : kind === "drum" ? "support-drum" : "support-medical", kind === "drum" ? "gunner" : kind === "medical" ? "medic" : "guide", `support-${kind}`);
    if (kind === "pod") playCue("pod-descent");
    return true;
  }, [playCue]);

  const deployAirstrike = useCallback((requestedX: number, requestedY: number) => {
    const g = gameRef.current;
    if (!g.running || g.paused || g.over) return false;
    const placement = correctedBattlefieldTargetForGame(g, { x: requestedX, y: requestedY }, null);
    const target = placement.position ?? placement.requested;
    const lane = placement.legacyLane as Lane | null;
    if (!placement.ok || lane === null) {
      g.placementIndicator = placementIndicatorFor("airstrike", activeLaneForY(target.y), target.x, target.y, false, placement.reason);
      g.banner = placementReasonLabel(placement.reason); g.bannerTime = .75; playCue("denied");
      return false;
    }
    const result = requestAirstrike({
      running: g.running, paused: g.paused, over: g.over, supportGauge: g.supportGauge,
      lane, x: target.x, y: target.y, laneCenters: activeLaneCenters, runtime: g.airstrike,
    });
    if (!result.ok) {
      g.banner = placementReasonLabel(result.reason); g.bannerTime = .75; playCue("denied"); return false;
    }
    g.supportGauge = result.supportGauge;
    g.airstrike = result.runtime as AirstrikeRuntime;
    g.banner = placement.adjusted ? "航空支援 // 最寄りの有効地点へ補正" : "航空支援要請 // 指定地点";
    g.bannerTime = 1; playCue("airstrike-request");
    emitBattleBark(g, "airstrike-request", "guide", "airstrike");
    return true;
  }, [playCue]);

  const triggerCrawlerBarrage = useCallback(() => {
    const g = gameRef.current;
    if (!g.running || g.paused || g.over) return false;
    const result = requestCrawlerBarrage({ running: g.running, paused: g.paused, over: g.over, runtime: g.crawlerAbility });
    if (!result.ok) { g.banner = result.reason; g.bannerTime = 1; playCue("denied"); return false; }
    g.crawlerAbility = result.runtime as CrawlerRuntime;
    g.banner = "移動拠点火器を展開"; g.bannerTime = 1.1; playCue("crawler-request");
    emitBattleBark(g, "crawler-barrage", "guide", "crawler-barrage");
    return true;
  }, [playCue]);

  const triggerDrumAt = useCallback((x: number, y: number) => {
    const g = gameRef.current;
    if (!g.running || g.paused || g.over) return false;
    const drum = g.battlefieldObjects
      .filter((supply) => supply.kind === "drum" && supply.phase === "active" && effectDistance(supply, { x, y }) <= 52)
      .sort((a, b) => effectDistance(a, { x, y }) - effectDistance(b, { x, y }))[0];
    if (!drum) return false;
    const result = requestDrumDetonation(drum, "manual");
    if (!result.ok) return false;
    Object.assign(drum, result.supply);
    g.banner = "爆薬ドラム起爆 // 指定地点"; g.bannerTime = .85; playCue("drum-request");
    return true;
  }, [playCue]);

  const triggerKuromeEmergencyEvadeAt = useCallback((x: number, y: number) => {
    const g = gameRef.current;
    if (!g.running || g.paused || g.over) return false;
    for (const boss of g.fighters.filter((fighter) => (
      fighter.kind === "kurome"
      && fighter.side === "zombie"
      && fighter.combatReady
      && ["tracking", "locked"].includes(fighter.stationAbility.phase)
    ))) {
      const target = g.fighters.find((fighter) => (
        fighter.side === "human"
        && String(fighter.id) === String(boss.stationAbility.targetId)
      ));
      const plan = kuromeEmergencyEvadePlan({
        runtime: boss.stationAbility,
        target,
        tap: { x, y },
        laneCenters: activeLaneCenters,
      });
      if (!plan.ok || !target || !Number.isInteger(plan.lane)) continue;
      boss.stationAbility = plan.runtime as StationAbilityRuntime;
      target.lane = plan.lane as Lane;
      target.anchorLane = plan.lane as Lane;
      target.y = activeLaneCenters[plan.lane as Lane];
      target.targetId = null;
      target.targetObjectId = null;
      target.aiMoveDirection = 0;
      g.banner = "緊急回避 // 照準線を離脱";
      g.bannerTime = .85;
      bossFoundationQaRef.current.lastCounterplay = {
        kind: "kurome-emergency-evade",
        input: "battlefield-pointer",
        targetId: target.id,
        destinationLane: plan.lane,
      };
      playCue("deploy-light");
      return true;
    }
    return false;
  }, [playCue]);

  const executeSelected = useCallback((x: number, y: number) => {
    const action = selectedActionRef.current;
    if (!action) return;
    if (action.startsWith("supply:")) {
      const kind = action.slice("supply:".length) as SupplyKind;
      if (placeBattlefieldSupply(kind, x, y)) chooseAction(null);
      return;
    }
    if (deployAirstrike(x, y)) chooseAction(null);
  }, [chooseAction, deployAirstrike, placeBattlefieldSupply]);

  const pointerWorldPosition = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const transform = canvasTransformRef.current;
    const { x, y } = canvasPointerToWorld({ clientX: event.clientX, clientY: event.clientY, rect, transform, worldWidth: W, worldHeight: H });
    let lane: Lane = 0;
    if (Math.abs(y - activeLaneCenters[1]) < Math.abs(y - activeLaneCenters[lane])) lane = 1;
    if (Math.abs(y - activeLaneCenters[2]) < Math.abs(y - activeLaneCenters[lane])) lane = 2;
    return { x, y, lane };
  }, []);

  const handleBattlefieldPointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const action = selectedActionRef.current;
    if (!action) return;
    const { x, y, lane } = pointerWorldPosition(event);
    const g = gameRef.current;
    const kind = action.startsWith("supply:") ? action.slice("supply:".length) as SupplyKind : null;
    const placement = correctedBattlefieldTargetForGame(g, { x, y }, kind);
    const target = placement.position ?? placement.requested;
    const targetLane = (placement.legacyLane ?? lane) as Lane;
    const check = !placement.ok
      ? { ok: false, reason: placement.reason }
      : kind
        ? battlefieldSupplyPlacementCheck({
          running: g.running, paused: g.paused, over: g.over, scrap: g.scrap,
          supplyKind: kind, lane: targetLane, x: target.x, y: target.y, supplies: g.battlefieldObjects,
          laneCenters: activeLaneCenters,
          forbiddenZones: battlefieldPlacementForbiddenZones(stageObjectForbiddenZonesForGame(g)),
        })
        : airstrikePlacementCheck({
          running: g.running, paused: g.paused, over: g.over, supportGauge: g.supportGauge,
          lane: targetLane, x: target.x, y: target.y, laneCenters: activeLaneCenters, runtime: g.airstrike,
        });
    const reason = check.ok && placement.adjusted ? placement.reason : check.reason;
    g.placementIndicator = placementIndicatorFor(action, targetLane, target.x, target.y, check.ok, reason);
  }, [pointerWorldPosition]);

  const handleBattlefieldPointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (!selectedActionRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    handleBattlefieldPointerMove(event);
  }, [handleBattlefieldPointerMove]);

  const handleBattlefieldPointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const g = gameRef.current;
    if (!g.running || g.paused || g.over) return;
    const { x, y } = pointerWorldPosition(event);
    if (!selectedActionRef.current) {
      if (triggerKuromeEmergencyEvadeAt(x, y)) return;
      triggerDrumAt(x, y);
      return;
    }
    executeSelected(x, y);
  }, [executeSelected, pointerWorldPosition, triggerDrumAt, triggerKuromeEmergencyEvadeAt]);

  const handleBattlefieldPointerCancel = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (selectedActionRef.current) gameRef.current.placementIndicator = null;
  }, []);

  const stageViews = useMemo<StageScreenView[]>(() => (CAMPAIGN_STAGES as unknown as readonly CampaignStageData[]).map((stage) => {
    const claimed = campaignSave.claimedStarRewardsByStage[stage.id] ?? [];
    const nextMilestone = [1, 2, 3].find((star) => !claimed.includes(star));
    return {
      id: stage.id,
      stageNumber: stage.stageNumber,
      regionId: stage.regionId,
      regionLabel: CAMPAIGN_REGIONS.find(({ id }) => id === stage.regionId)?.shortLabel ?? "作戦区",
      regionName: CAMPAIGN_REGIONS.find(({ id }) => id === stage.regionId)?.displayName ?? "作戦区域",
      displayName: stage.displayName,
      chapterName: "序章　新たな世界の始まり",
      objective: stage.objective,
      missionLabel: stage.id === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE
        ? "感染中継点破壊作戦"
        : stage.missionType === "escort"
          ? "移動目標護衛作戦"
          : stage.missionType === "sequential-seal"
            ? "三電源・封鎖作戦"
            : stage.missionType === "assault"
              ? "拠点破壊作戦"
              : stage.missionType === "timed-defense"
              ? `${Number((CAMPAIGN_STAGE_BY_ID[stage.id].objectiveConfig as { durationSeconds?: number })?.durationSeconds) || 180}秒防衛作戦`
                : "ボス・拠点攻略",
      threat: stage.id === CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET
        ? "危険度 低〜中"
        : stage.id === CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE
          ? "危険度 中"
          : stage.id === CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE
            ? "危険度 極高 / TAKUYA"
            : stage.id === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE
              ? "危険度 高 / 絡手"
              : stage.id === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM
                ? "危険度 高 / 漏泥・走鬼"
              : stage.stageNumber <= 6
                ? "危険度 極高 / 改札喰い"
                : stage.stageNumber <= 9
                  ? "危険度 高 / 病院区域"
                  : stage.stageNumber <= 12
                    ? "危険度 高〜極高 / 研究区画"
                    : stage.stageNumber <= 14
                      ? "危険度 極高 / 物流線"
                      : "危険度 極高 / T計画中枢",
      unlocked: Boolean(qaMode || qaScenario) || isStageUnlocked(campaignSave, stage.id),
      completed: campaignSave.completedStageIds.includes(stage.id),
      bestStars: campaignSave.bestStarsByStage[stage.id] ?? 0,
      baseReward: stage.baseReward,
      nextStarReward: nextMilestone ? stage.firstTimeStarRewards[nextMilestone] : 0,
      mapPosition: stage.mapPosition,
      starCriteria: ["★ 作戦成功・移動拠点HP 1%以上", "★★ 移動拠点HP 70%以上", "★★★ 移動拠点HP 90%以上"],
    };
  }), [campaignSave, qaMode, qaScenario]);
  const selectedStageView = stageViews.find((stage) => stage.id === selectedStageId) ?? stageViews[0];
  const outbreakMissionViews = useMemo<OutbreakMissionScreenView[]>(() => OUTBREAK_MISSIONS.map((mission) => {
    const boss = bossDefinitionForEnemyKind(mission.boss.enemyKind);
    const equipmentId = mission.firstClearEquipmentGrant?.equipmentId ?? "";
    return {
      id: mission.id,
      displayName: mission.displayName,
      location: mission.location,
      objective: mission.objective,
      bossName: boss?.displayName ?? mission.boss.enemyKind,
      bossClassification: boss?.classification ?? "異常発生個体",
      bossImagePath: boss?.compendium?.assetPath ?? "",
      prerequisiteLabel: CAMPAIGN_STAGE_BY_ID[mission.prerequisiteStageId]?.displayName ?? mission.prerequisiteStageId,
      unlocked: Boolean(qaMode || qaScenario) || isOutbreakMissionUnlocked(
        campaignSave.outbreaks,
        campaignSave.completedStageIds,
        mission.id,
      ),
      cleared: campaignSave.outbreaks.clearedMissionIds.includes(mission.id),
      defeatCount: campaignSave.outbreaks.bossDefeatCounts[mission.boss.enemyKind] ?? 0,
      baseRewardCaps: mission.baseRewardCaps,
      equipmentName: EQUIPMENT_BY_ID[equipmentId]?.displayName ?? equipmentId,
    };
  }), [campaignSave.completedStageIds, campaignSave.outbreaks, qaMode, qaScenario]);
  const selectedOutbreakMissionView = outbreakMissionViews.find(({ id }) => id === selectedOutbreakMissionId)
    ?? outbreakMissionViews.find(({ unlocked }) => unlocked)
    ?? outbreakMissionViews[0];
  const selectedOperationView = selectedOutbreakMissionId && selectedOutbreakMissionView
    ? {
      id: selectedOutbreakMissionView.id,
      stageNumber: 0,
      regionId: "region-outbreak",
      regionLabel: "異常発生",
      regionName: selectedOutbreakMissionView.location,
      displayName: selectedOutbreakMissionView.displayName,
      chapterName: "異常発生任務",
      objective: selectedOutbreakMissionView.objective,
      missionLabel: "異常発生個体制圧作戦",
      threat: `危険度 極高 / ${selectedOutbreakMissionView.bossName}`,
      unlocked: selectedOutbreakMissionView.unlocked,
      completed: selectedOutbreakMissionView.cleared,
      bestStars: 0,
      baseReward: selectedOutbreakMissionView.baseRewardCaps,
      nextStarReward: 0,
      mapPosition: { x: 50, y: 50 },
      starCriteria: ["異常発生個体を撃破", "残存感染体を掃討", "移動拠点を防衛"],
    } satisfies StageScreenView
    : selectedStageView;
  const recordOperationLabel = useCallback((operationId: string) => {
    if (CAMPAIGN_STAGE_BY_ID[operationId]) return CAMPAIGN_STAGE_BY_ID[operationId].displayName;
    if (OUTBREAK_MISSION_BY_ID[operationId]) return OUTBREAK_MISSION_BY_ID[operationId].displayName;
    if (operationId.startsWith("survival-wave-")) {
      return `Survival WAVE ${operationId.slice("survival-wave-".length)}開始`;
    }
    return operationId;
  }, []);
  const enemyCompendiumViews = useMemo<EnemyCompendiumView[]>(() => ENEMY_CONTENT
    .filter((enemy) => !isBossEnemyKind(enemy.id))
    .map((enemy) => {
      const record = campaignSave.records.encountersByEnemy[enemy.id] ?? null;
      const legacyStage = CAMPAIGN_STAGES.find((stage) => (
        campaignSave.completedStageIds.includes(stage.id)
        && (stage.enemyKinds.includes(enemy.id) || stage.boss?.enemyKind === enemy.id)
      )) ?? null;
      const encountered = Boolean(record || legacyStage);
      const firstOperationId = record?.firstOperationId ?? legacyStage?.id ?? "";
      return {
        id: enemy.id,
        displayName: enemy.displayName,
        classification: enemy.runtimeGenerated
          ? "戦闘不能者由来・転化感染体"
          : enemy.spawnClass === "heavy"
            ? "重装通常感染体"
            : "通常感染体",
        encountered,
        firstEncounterLabel: firstOperationId
          ? recordOperationLabel(firstOperationId)
          : "未確認",
        encounterCount: record?.encounterCount ?? (legacyStage ? 1 : 0),
        defeatCount: campaignSave.records.defeatCountsByEnemy[enemy.id] ?? 0,
        attackProfile: ENEMY_RECORD_PROFILE_LABELS[enemy.aiProfile] ?? "固有の行動規則で部隊へ接近する。",
        artStyle: spriteCompendiumStyle(enemy.id),
      };
    }), [campaignSave.completedStageIds, campaignSave.records, recordOperationLabel]);
  const bossCompendiumViews = useMemo<BossCompendiumView[]>(() => BOSS_DEFINITIONS.map((boss) => {
    const record = campaignSave.records.encountersByEnemy[boss.enemyKind] ?? null;
    const legacyStage = CAMPAIGN_STAGES.find((stage) => (
      campaignSave.completedStageIds.includes(stage.id)
      && (stage.enemyKinds.includes(boss.enemyKind) || stage.boss?.enemyKind === boss.enemyKind)
    )) ?? null;
    const outbreakMission = OUTBREAK_MISSIONS.find((mission) => mission.boss.enemyKind === boss.enemyKind) ?? null;
    const outbreakDefeatCount = campaignSave.outbreaks.bossDefeatCounts[boss.enemyKind] ?? 0;
    const outbreakEncountered = Boolean(
      outbreakMission
      && campaignSave.outbreaks.clearedMissionIds.includes(outbreakMission.id),
    );
    const encountered = Boolean(record || legacyStage || outbreakEncountered);
    const firstOperationId = record?.firstOperationId
      ?? legacyStage?.id
      ?? (outbreakEncountered ? outbreakMission?.id : "")
      ?? "";
    const defeatCount = Math.max(
      campaignSave.records.defeatCountsByEnemy[boss.enemyKind] ?? 0,
      outbreakDefeatCount,
      legacyStage ? 1 : 0,
    );
    return {
      id: boss.id,
      displayName: boss.displayName,
      classification: boss.classification,
      encountered,
      firstEncounterLabel: firstOperationId ? recordOperationLabel(firstOperationId) : "未確認",
      defeatCount,
      attackName: boss.attackTelegraph.displayName,
      attackSummary: boss.compendium.summary,
      weakness: boss.attackTelegraph.counterplay,
      equipmentName: EQUIPMENT_BY_ID[boss.reward.equipmentId]?.displayName ?? boss.reward.equipmentId,
      artStyle: boss.compendium.assetPath
        ? fullCompendiumStyle(boss.compendium.assetPath)
        : spriteCompendiumStyle(boss.enemyKind, { width: 190, height: 168 }),
    };
  }), [campaignSave.completedStageIds, campaignSave.outbreaks, campaignSave.records, recordOperationLabel]);
  const recordsSummaryView = useMemo<RecordsSummaryView>(() => {
    const records = campaignSave.records;
    const unitKinds = [...new Set([
      ...Object.keys(records.unitStats.damageByUnit),
      ...Object.keys(records.unitStats.damageTakenByUnit),
      ...Object.keys(records.unitStats.healingByUnit),
    ])];
    return {
      battles: records.totals.battles,
      victories: records.totals.victories,
      defeats: records.totals.defeats,
      withdrawals: records.totals.withdrawals,
      battleSeconds: records.totals.battleSeconds,
      kills: records.totals.kills,
      bossKills: records.totals.bossKills,
      unitsLost: records.totals.unitsLost,
      capsEarned: records.totals.capsEarned,
      clearedStages: CAMPAIGN_STAGES.filter((stage) => (
        campaignSave.completedStageIds.includes(stage.id)
      )).length,
      totalStages: CAMPAIGN_STAGES.length,
      collectedStars: Object.values(campaignSave.bestStarsByStage)
        .reduce((total: number, stars) => total + Number(stars || 0), 0),
      highestSurvivalWave: campaignSave.survival.highestWave,
      survivalRuns: campaignSave.survival.totalRuns,
      outbreakClears: campaignSave.outbreaks.clearedMissionIds.length,
      recentResults: [...records.recentResults].reverse().map((result) => ({
        resultId: result.resultId,
        operationLabel: recordOperationLabel(result.operationId),
        categoryLabel: result.category === "survival" ? "SURVIVAL" : result.category === "outbreak" ? "異常発生" : "本編",
        outcomeLabel: result.outcome === "won" ? "勝利" : result.outcome === "withdrawn" ? "撤退" : "敗北",
        kills: result.kills,
        reachedWave: result.reachedWave,
        completedAt: result.completedAt,
      })),
      unitStats: unitKinds.map((kind) => ({
        kind,
        displayName: cards.find((card) => card.kind === kind)?.name ?? kind,
        damage: records.unitStats.damageByUnit[kind] ?? 0,
        damageTaken: records.unitStats.damageTakenByUnit[kind] ?? 0,
        healing: records.unitStats.healingByUnit[kind] ?? 0,
      })).sort((left, right) => right.damage - left.damage || left.displayName.localeCompare(right.displayName)),
    };
  }, [campaignSave, recordOperationLabel]);
  const campaignLevelCap = getCampaignLevelCap(campaignSave);
  const unitViews = useMemo<UnitScreenView[]>(() => (CAMPAIGN_UNITS as unknown as readonly CampaignUnitData[]).map((unit) => {
    const level = getCampaignUnitLevel(campaignSave, unit.id);
    const quote = campaignUnitLevelUpgradeQuote(campaignSave, unit.id);
    const baseCard = cards.find((card) => card.kind === unit.combatKind) ?? cards[0];
    const aiProfile = baseCard.aiProfile;
    const milestones = unitLevelMilestones(aiProfile, level);
    const nextMilestones = quote.nextLevel === null
      ? []
      : unitLevelMilestones(aiProfile, quote.nextLevel).filter((milestone) => !milestones.includes(milestone));
    const statSummaryFor = (targetLevel: number) => {
      if (targetLevel <= 1) return "基礎ステータス";
      const progressed = applyUnitLevelProgression(baseCard, targetLevel);
      const increase = (current: number, base: number) => Math.round((current / base - 1) * 100);
      return `HP +${increase(progressed.hp, baseCard.hp)}%・攻撃 +${increase(progressed.damage, baseCard.damage)}%・防御 ${Math.round(progressed.defense * 1000) / 10}%軽減・機動 +${increase(progressed.speed, baseCard.speed)}%・攻撃速度 +${increase(baseCard.attackEvery, progressed.attackEvery)}%`;
    };
    const compactStatSummaryFor = (targetLevel: number) => {
      if (targetLevel <= 1) return "基礎";
      const progressed = applyUnitLevelProgression(baseCard, targetLevel);
      const increase = (current: number, base: number) => Math.round((current / base - 1) * 100);
      return `HP+${increase(progressed.hp, baseCard.hp)} 攻+${increase(progressed.damage, baseCard.damage)} 防${Math.round(progressed.defense * 1000) / 10}% 機+${increase(progressed.speed, baseCard.speed)} 速+${increase(baseCard.attackEvery, progressed.attackEvery)}%`;
    };
    return {
      id: unit.id,
      kind: unit.combatKind,
      name: unit.displayName,
      role: unit.roleName,
      description: unit.description,
      roleIcon: unit.roleIcon,
      weaponName: unit.weaponName,
      attackMode: unit.attackMode,
      rangeBand: unit.rangeBand,
      primaryTarget: unit.primaryTarget,
      deploymentHint: unit.deploymentHint,
      owned: Boolean(qaMode || qaScenario) || isUnitOwned(campaignSave, unit.id),
      discovered: Boolean(qaMode || qaScenario) || isUnitDiscovered(campaignSave, unit.id),
      recruitable: !isUnitOwned(campaignSave, unit.id) && (Boolean(qaMode || qaScenario) || isUnitRecruitable(campaignSave, unit.id)),
      recruitCost: CAMPAIGN_RECRUITMENT_COSTS[unit.id as keyof typeof CAMPAIGN_RECRUITMENT_COSTS] ?? unit.recruitmentCostCaps ?? 0,
      unlockHint: unit.unlock.type === "initial"
        ? "初期加入"
        : unit.unlock.type === "recruitment"
          ? `${CAMPAIGN_STAGE_BY_ID[unit.unlock.stageId ?? ""]?.displayName ?? `Stage ${unit.unlock.stageNumber ?? "?"}`}後に調達`
          : `Stage ${unit.unlock.stageNumber ?? "?"}で加入`,
      level,
      maxLevel: UNIT_LEVEL_MAX,
      levelCap: campaignLevelCap,
      nextUpgradeCost: quote.nextLevel === null ? null : quote.costCaps,
      upgradeBlockedReason: quote.reason,
      upgradeBaseCost: quote.baseCostCaps,
      upgradeDiscount: quote.discountCaps,
      catchUp: quote.catchUp,
      milestones,
      nextMilestones,
      statSummary: statSummaryFor(level),
      nextStatSummary: statSummaryFor(quote.nextLevel ?? level),
      nextStatCompact: compactStatSummaryFor(quote.nextLevel ?? level),
    };
  }), [campaignLevelCap, campaignSave, qaMode, qaScenario]);
  const supplyViews = useMemo<SupplyScreenView[]>(() => (Object.keys(supplyDefs) as SupplyKind[]).map((kind) => ({
    kind,
    name: supplyDefs[kind].name,
    cost: supplyDefs[kind].cost,
    description: kind === "pod" ? "着地衝撃 / 敵を遮断" : kind === "drum" ? "任意起爆 / 火炎" : "周囲を継続回復",
  })), []);

  const disposeBattleRuntime = useCallback(() => {
    if (startCueTimerRef.current !== null) {
      window.clearTimeout(startCueTimerRef.current);
      startCueTimerRef.current = null;
    }
    chooseAction(null);
    battleRadioActiveRef.current = false;
    desiredProductionSceneRef.current = null;
    eventQueueRef.current = [];
    eventCompletionLockRef.current = false;
    setForceStoryReplay(false);
    gameRef.current.battleBarks = createBattleBarkRuntime() as BattleBarkRuntime;
    const mixer = productionMixerRef.current;
    if (mixer) void mixer.stopAll({ fadeMs: 80 });
    stopMusic();
    stopJingle();
    stopSfx();
  }, [chooseAction, stopJingle, stopMusic, stopSfx]);

  const openEvents = useCallback((
    nextEventIds: readonly string[],
    destination: EventDestination,
    { forceReplay = false }: { forceReplay?: boolean } = {},
  ) => {
    const queue = [...new Set(nextEventIds.filter(Boolean))];
    if (queue.length === 0) return false;
    eventCompletionLockRef.current = false;
    setForceStoryReplay(forceReplay);
    eventDestinationRef.current = destination;
    eventQueueRef.current = queue.slice(1);
    if (destination === "battle-resume") {
      const g = gameRef.current;
      g.paused = true;
      g.battleBarks = clearNonScriptedBattleBarks(g.battleBarks) as BattleBarkRuntime;
      setHud((current) => ({ ...current, battleBarks: [] }));
      setPaused(true);
      chooseAction(null);
      stopMusic(); stopJingle(); stopSfx();
    }
    setEventId(queue[0]);
    setScreen("event");
    return true;
  }, [chooseAction, stopJingle, stopMusic, stopSfx]);

  const openEvent = useCallback((nextEventId: string, destination: EventDestination) => openEvents([nextEventId], destination), [openEvents]);

  const startGame = useCallback((sessionOverride?: {
    stageId: string;
    formationKinds: UnitKind[];
    selectedSupply: SupplyKind;
    resultId: string | null;
  }) => {
    const retrying = gameRef.current.over;
    const qaAllUnlocked = Boolean(qaMode || qaScenario);
    const battleStageId = qaMode ? CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE : sessionOverride?.stageId ?? activeOperationId;
    const requestedFormation = sessionOverride?.formationKinds ?? formationKinds;
    const permittedFormation = qaAllUnlocked
      ? requestedFormation.slice(0, 7)
      : requestedFormation.filter((kind) => isUnitOwned(campaignSave, kind)).slice(0, 7);
    const fallbackFormation = getSelectedFormationCombatKinds(campaignSave)
      .filter((kind: string) => qaAllUnlocked || isUnitOwned(campaignSave, kind))
      .slice(0, 7) as UnitKind[];
    const battleSupply = sessionOverride?.selectedSupply ?? selectedSupply;
    const fresh = initialGame(
      battleSupply,
      battleStageId,
      permittedFormation.length > 0 ? permittedFormation : fallbackFormation,
      sessionOverride?.resultId ?? createBattleResultId(battleStageId),
      campaignSave.readStoryEventIds,
      campaignSave.unitLevels,
      getFormationPresetEquipmentSnapshot(campaignSave),
    );
    fresh.running = true;
    prepareQaMode(fresh, qaMode);
    if (qaScenario?.mode === "defense") {
      fresh.time = Math.max(PREP_SECONDS, (fresh.definition.defenseEndAt ?? PREP_SECONDS + 180) - 8);
      fresh.phase = phaseForBattle(fresh.definition, fresh.time) as Game["phase"];
      fresh.eventIndex = fresh.definition.timeline.filter((event: MissionEvent) => event.at <= fresh.time).length;
      fresh.banner = "LOCAL QA // 防衛終了8秒前";
      fresh.bannerTime = 2.2;
    }
    if (qaScenario?.mode === "mission") {
      fresh.time = PREP_SECONDS;
      fresh.phase = phaseForBattle(fresh.definition, fresh.time) as Game["phase"];
      fresh.banner = "LOCAL QA // Stage 1–6 AI実戦開始";
      fresh.bannerTime = 2.2;
    }
    if (qaScenario?.mode === "station") {
      // A terminal QA fixture must not immediately re-inject the same result
      // after the player chooses retry. Replays exercise the real fresh-start
      // path while retaining local-save isolation.
      prepareStationQa(fresh, retrying ? "start" : qaScenario.state);
    }
    gameRef.current = fresh;
    const bossHud = fresh.fighters
      .map((fighter) => bossHudSnapshot(fighter))
      .find((snapshot) => snapshot !== null);
    desiredMusicModeRef.current = "normal";
    finalizedEndRef.current = null;
    setStarted(true); setPaused(false); setEnd(null); setCampaignResult(null); setOutbreakResult(null); setPendingOutbreakSettlement(null); setScreen("battle"); chooseAction(null);
    setHud({ missionType: fresh.definition.missionType, energy: Math.floor(fresh.energy), supportGauge: Math.floor(fresh.supportGauge), scrap: fresh.scrap, kills: fresh.kills,
      wave: fresh.wave, phase: fresh.phase, baseHp: fresh.baseHp, baseMaxHp: fresh.baseMaxHp,
      barricadeHp: fresh.barricadeHp, barricadeMaxHp: fresh.barricadeMaxHp, barricadeVulnerable: fresh.barricadeVulnerable, barricadeHitFlash: 0,
      deployQueue: fresh.deployQueue.length, airstrikePhase: fresh.airstrike.phase,
      crawlerPhase: fresh.crawlerAbility.phase, crawlerCharge: fresh.crawlerAbility.charge, combo: 0,
      bossHp: bossHud?.hp ?? 0, bossMax: bossHud?.maxHp ?? 0, bossKind: bossHud?.enemyKind ?? null, bossWorldX: bossHud?.worldX ?? null,
      takuyaEntranceAudioActive: false,
      crawlerHitFlash: 0, threat: 0, objective: objectiveForBattle(fresh.definition, fresh),
      deployCooldowns: { ...fresh.deployCooldowns }, battleBarks: [...fresh.battleBarks.active], manualAbilityIcons: [] });
    disposeBattleRuntime(); if (!bgmMuted) startMusic();
    if (retrying) playCue("retry");
    else {
      playCue("start-low");
      startCueTimerRef.current = window.setTimeout(() => { startCueTimerRef.current = null; playCue("start-high"); }, 90);
    }
  }, [activeOperationId, bgmMuted, campaignSave, chooseAction, disposeBattleRuntime, formationKinds, playCue, qaMode, qaScenario, selectedSupply, startMusic]);

  const startSurvivalGame = useCallback((run: ReturnType<typeof createSurvivalRun>) => {
    const requestedKinds = run.formation.unitIds.flatMap((unitId: string) => {
      const unit = (CAMPAIGN_UNITS as unknown as readonly CampaignUnitData[])
        .find((candidate) => candidate.id === unitId);
      return unit ? [unit.combatKind] : [];
    }) as UnitKind[];
    const activeKinds = requestedKinds.length > 0 ? requestedKinds : formationKinds;
    const fresh = initialSurvivalGame({
      selectedSupply,
      run,
      formationKinds: activeKinds,
      unitLevels: { ...run.formation.unitLevelsByUnit },
    });
    fresh.running = true;
    gameRef.current = fresh;
    finalizedEndRef.current = null;
    setStarted(true);
    setPaused(run.phase === SURVIVAL_RUN_PHASES.UPGRADE_SELECTION);
    fresh.paused = run.phase === SURVIVAL_RUN_PHASES.UPGRADE_SELECTION;
    setEnd(null);
    setCampaignResult(null);
    setSurvivalResult(null);
    setSelectedOutbreakMissionId(null);
    setOutbreakResult(null);
    setPendingOutbreakSettlement(null);
    setPendingSurvivalSettlement(null);
    setSurvivalSettlementAwaitingRetry(false);
    setSurvivalHud(survivalHudSnapshot(run));
    setSelectedStageId(CAMPAIGN_STAGE_IDS.T_PLAN_CENTRAL_SEAL);
    setScreen("battle");
    chooseAction(null);
    disposeBattleRuntime();
    desiredMusicModeRef.current = "normal";
    if (!bgmMuted) startMusic();
    playCue("start-low");
  }, [bgmMuted, chooseAction, disposeBattleRuntime, formationKinds, playCue, selectedSupply, startMusic]);

  const openSurvival = useCallback(() => {
    const unlocked = campaignSave.survival.unlockedStartWaves;
    setSelectedSurvivalStartWave(unlocked.includes(selectedSurvivalStartWave)
      ? selectedSurvivalStartWave
      : unlocked[unlocked.length - 1] ?? 1);
    setSelectedStageId(CAMPAIGN_STAGE_IDS.T_PLAN_CENTRAL_SEAL);
    setSelectedOutbreakMissionId(null);
    setSurvivalResult(null);
    setScreen("survival");
  }, [campaignSave.survival.unlockedStartWaves, selectedSurvivalStartWave]);

  const startNewSurvival = useCallback(() => {
    const formationSnapshot = getFormationPresetEquipmentSnapshot(campaignSave);
    const tacticalEffects = aggregateEquipmentEffects(
      formationSnapshot.tacticalEquipmentIds.filter(
        (equipmentId): equipmentId is string => typeof equipmentId === "string",
      ),
      formationSnapshot.equipmentEnhancementLevels,
    );
    const run = createSurvivalRun({
      runId: createBattleResultId("survival"),
      startWave: selectedSurvivalStartWave,
      unlockedStartWaves: campaignSave.survival.unlockedStartWaves,
      formation: formationSnapshot,
      crawlerMaxHp: Math.round(700 * tacticalEffects.baseHpMultiplier),
      bossPool: campaignSave.outbreaks.survivalBossKinds,
    });
    startSurvivalGame(run);
  }, [campaignSave, selectedSurvivalStartWave, startSurvivalGame]);

  const resumeSurvival = useCallback(() => {
    const run = resumeSurvivalCheckpoint(campaignSave.survival);
    if (!run) return;
    startSurvivalGame(run);
  }, [campaignSave.survival, startSurvivalGame]);

  const returnToMap = useCallback((sessionOverride?: {
    stageId: string;
    formationKinds: UnitKind[];
    selectedSupply: SupplyKind;
  }) => {
    disposeBattleRuntime();
    const fresh = initialGame(
      sessionOverride?.selectedSupply ?? selectedSupply,
      sessionOverride?.stageId ?? selectedStageId,
      sessionOverride?.formationKinds ?? formationKinds,
      createBattleResultId(sessionOverride?.stageId ?? selectedStageId),
      campaignSave.readStoryEventIds,
      campaignSave.unitLevels,
      getFormationPresetEquipmentSnapshot(campaignSave),
    );
    gameRef.current = fresh;
    finalizedEndRef.current = null;
    setSelectedOutbreakMissionId(null);
    setStarted(false); setPaused(false); setEnd(null); setCampaignResult(null); setOutbreakResult(null); setPendingOutbreakSettlement(null); setSurvivalHud(null); setSurvivalResult(null); setPendingSurvivalSettlement(null); setSurvivalSettlementAwaitingRetry(false); setScreen("map"); chooseAction(null);
  }, [campaignSave, chooseAction, disposeBattleRuntime, formationKinds, selectedStageId, selectedSupply]);

  const handleEventComplete = useCallback(() => {
    const completion = resolveStoryEventCompletion({
      eventId,
      eventQueue: eventQueueRef.current,
      destination: eventDestinationRef.current,
      completionLocked: eventCompletionLockRef.current,
    });
    if (!completion.applied) return;
    if (completion.readEventId) {
      setCampaignSave((current) => markStoryEventRead(current, completion.readEventId) as CampaignSave);
    }
    eventQueueRef.current = completion.remainingEventIds;
    eventCompletionLockRef.current = completion.completionLocked;
    if (completion.nextEventId) {
      setEventId(completion.nextEventId);
      return;
    }
    setEventId(null);
    setForceStoryReplay(false);
    if (completion.destination === "battle") startGame();
    else if (completion.destination === "battle-resume") {
      const g = gameRef.current;
      g.paused = false;
      setPaused(false);
      setScreen("battle");
      if (!bgmMuted) startMusic();
      resumeBattleAudioLoops(g);
    } else if (completion.destination === "result") setScreen("result");
    else returnToMap();
  }, [bgmMuted, eventId, resumeBattleAudioLoops, returnToMap, startGame, startMusic]);

  const handleEventSkip = useCallback(() => {
    if (eventId && isPrologueOpeningEventId(eventId)) {
      setCampaignSave((current) => getPrologueOpeningEventIds().reduce(
        (next, openingEventId) => markStoryEventRead(next, openingEventId) as CampaignSave,
        current,
      ));
      eventQueueRef.current = [];
      eventCompletionLockRef.current = false;
      eventDestinationRef.current = "map";
      setForceStoryReplay(false);
      const [summaryEventId] = getPrologueSkipEventIds();
      setEventId(summaryEventId ?? null);
      if (!summaryEventId) setScreen("map");
      return;
    }
    handleEventComplete();
  }, [eventId, handleEventComplete]);

  const selectStage = useCallback((stageId: string) => {
    if (!qaMode && !qaScenario && !isStageUnlocked(campaignSave, stageId)) return;
    setSelectedStageId(stageId);
    setCampaignSave((current) => selectCampaignStage(current, stageId) as CampaignSave);
  }, [campaignSave, qaMode, qaScenario]);

  const selectFormation = useCallback((presetId: string) => {
    setCampaignSave((current) => selectFormationPreset(current, presetId) as CampaignSave);
  }, []);

  const toggleFormation = useCallback((unitId: string) => {
    setCampaignSave((current) => {
      if (!qaMode && !qaScenario && !isUnitOwned(current, unitId)) return current;
      const workingSave = qaMode || qaScenario
        ? {
          ...current,
          ownership: (CAMPAIGN_UNITS as unknown as readonly CampaignUnitData[]).map((unit) => unit.id),
          discovery: (CAMPAIGN_UNITS as unknown as readonly CampaignUnitData[]).map((unit) => unit.id),
          unlockedUnitIds: (CAMPAIGN_UNITS as unknown as readonly CampaignUnitData[]).map((unit) => unit.id),
        } as CampaignSave
        : current;
      const selected = getSelectedFormationUnitIds(workingSave);
      const next = selected.includes(unitId)
        ? selected.length > 1 ? selected.filter((entry) => entry !== unitId) : selected
        : selected.length < 7 ? [...selected, unitId] : selected;
      if (next === selected || (next.length === selected.length && next.every((entry, index) => entry === selected[index]))) return current;
      return setFormationPresetUnits(workingSave, workingSave.selectedFormationPresetId, next) as CampaignSave;
    });
  }, [qaMode, qaScenario]);
  const recruitUnit = useCallback((unitId: string) => {
    setCampaignSave((current) => recruitCampaignUnit(current, {
      unitId,
      acquisitionId: `recruit:${unitId}`,
    }).save as CampaignSave);
  }, []);
  const upgradeUnit = useCallback((unitId: string) => {
    if (upgradeLocksRef.current.has(unitId)) return;
    upgradeLocksRef.current.add(unitId);
    setUpgradePendingUnitIds([...upgradeLocksRef.current]);
    const currentSave = campaignSaveRef.current;
    const currentLevel = getCampaignUnitLevel(currentSave, unitId);
    const upgradeId = `upgrade:${unitId}:level-${currentLevel + 1}`;
    const transaction = upgradeCampaignUnit(currentSave, { unitId, upgradeId });
    if (transaction.result.applied) {
      const nextLevel = transaction.result.nextLevel ?? currentLevel;
      const unit = (CAMPAIGN_UNITS as unknown as readonly CampaignUnitData[]).find((candidate) => candidate.id === unitId);
      const baseCard = cards.find((candidate) => candidate.kind === unit?.combatKind) ?? cards[0];
      const before = applyUnitLevelProgression(baseCard, currentLevel);
      const after = applyUnitLevelProgression(baseCard, nextLevel);
      const milestones = unitLevelMilestones(baseCard.aiProfile, nextLevel)
        .filter((milestone) => !unitLevelMilestones(baseCard.aiProfile, currentLevel).includes(milestone));
      const defensePercent = (value: number) => Math.round(value * 1000) / 10;
      campaignSaveRef.current = transaction.save as CampaignSave;
      setCampaignSave(transaction.save as CampaignSave);
      setUpgradeFeedback({
        unitId,
        level: nextLevel,
        reachedMax: nextLevel >= UNIT_LEVEL_MAX,
        spentCaps: transaction.result.spentCaps,
        statDelta: `HP ${before.hp}→${after.hp} / 攻撃 ${before.damage}→${after.damage} / 防御 ${defensePercent(before.defense)}→${defensePercent(after.defense)}%`,
        milestones,
        receipt: transaction.result.upgradeId,
      });
      playProductionCue(UPGRADE_AUDIO_CUE_IDS.CURRENCY, W / 2, {
        priority: 68,
        cooldownMs: 60,
        volume: .72,
        maxInstances: 1,
        dedupeKey: `${upgradeId}:currency`,
      });
      playProductionCue(
        nextLevel >= UNIT_LEVEL_MAX ? UPGRADE_AUDIO_CUE_IDS.MAX : UPGRADE_AUDIO_CUE_IDS.SUCCESS,
        W / 2,
        {
          priority: nextLevel >= UNIT_LEVEL_MAX ? 82 : 74,
          cooldownMs: 60,
          volume: nextLevel >= UNIT_LEVEL_MAX ? .9 : .78,
          maxInstances: 1,
          dedupeKey: `${upgradeId}:result`,
        },
      );
      if (upgradeFeedbackTimerRef.current !== null) window.clearTimeout(upgradeFeedbackTimerRef.current);
      upgradeFeedbackTimerRef.current = window.setTimeout(() => {
        setUpgradeFeedback((current) => current?.receipt === transaction.result.upgradeId ? null : current);
        upgradeFeedbackTimerRef.current = null;
      }, nextLevel >= UNIT_LEVEL_MAX ? 1700 : 1350);
    }
    window.setTimeout(() => {
      upgradeLocksRef.current.delete(unitId);
      setUpgradePendingUnitIds([...upgradeLocksRef.current]);
    }, 650);
  }, [playProductionCue]);

  const beginCampaign = useCallback(() => {
    if (campaignSave.campaignStarted) {
      setSelectedStageId(campaignSave.lastSelectedStageId);
      setScreen("map");
      return;
    }
    setCampaignSave((current) => markCampaignStarted(current) as CampaignSave);
    openEvents(getPrologueOpeningEventIds(), "map");
  }, [campaignSave.campaignStarted, campaignSave.lastSelectedStageId, openEvents]);
  const replayPrologue = useCallback(() => {
    openEvents(getPrologueReplayEventIds(), "map", { forceReplay: true });
  }, [openEvents]);
  const openPersonnel = useCallback(() => setScreen("personnel"), []);
  const openLoadout = useCallback(() => setScreen("loadout"), []);
  const openRecords = useCallback(() => setScreen("records"), []);
  const openOutbreak = useCallback(() => {
    const selected = outbreakMissionViews.find(({ id }) => id === selectedOutbreakMissionId && isOutbreakMissionUnlocked(
      campaignSave.outbreaks,
      campaignSave.completedStageIds,
      id,
    )) ?? outbreakMissionViews.find(({ unlocked }) => unlocked) ?? outbreakMissionViews[0];
    setSelectedOutbreakMissionId(selected?.id ?? null);
    setOutbreakResult(null);
    setScreen("outbreak");
  }, [campaignSave.completedStageIds, campaignSave.outbreaks, outbreakMissionViews, selectedOutbreakMissionId]);
  const selectOutbreakMission = useCallback((missionId: string) => {
    if (!isOutbreakMissionUnlocked(
      campaignSave.outbreaks,
      campaignSave.completedStageIds,
      missionId,
    ) && !qaMode && !qaScenario) return;
    setSelectedOutbreakMissionId(missionId);
  }, [campaignSave.completedStageIds, campaignSave.outbreaks, qaMode, qaScenario]);
  const prepareOutbreak = useCallback(() => {
    if (!selectedOutbreakMissionId) return;
    if (!isOutbreakMissionUnlocked(
      campaignSave.outbreaks,
      campaignSave.completedStageIds,
      selectedOutbreakMissionId,
    ) && !qaMode && !qaScenario) return;
    setScreen("loadout");
  }, [campaignSave.completedStageIds, campaignSave.outbreaks, qaMode, qaScenario, selectedOutbreakMissionId]);
  const returnFromLoadout = useCallback(() => {
    if (selectedOutbreakMissionId) {
      setScreen("outbreak");
      return;
    }
    returnToMap();
  }, [returnToMap, selectedOutbreakMissionId]);
  const requestBattle = useCallback(() => {
    if (selectedOutbreakMissionId) {
      startGame({
        stageId: selectedOutbreakMissionId,
        formationKinds,
        selectedSupply,
        resultId: createBattleResultId(selectedOutbreakMissionId),
      });
      return;
    }
    const nextEventIds = getStageEntryStoryEventIds({
      stageId: selectedStageId,
      completedStageIds: campaignSave.completedStageIds,
      readStoryEventIds: campaignSave.readStoryEventIds,
    });
    if (nextEventIds.length > 0) openEvents(nextEventIds, "battle");
    else startGame();
  }, [campaignSave.completedStageIds, campaignSave.readStoryEventIds, formationKinds, openEvents, selectedOutbreakMissionId, selectedStageId, selectedSupply, startGame]);
  const retryBattle = useCallback(() => {
    if (selectedOutbreakMissionId) {
      startGame({
        stageId: selectedOutbreakMissionId,
        formationKinds,
        selectedSupply,
        resultId: createBattleResultId(selectedOutbreakMissionId),
      });
      return;
    }
    const nextEventId = getStageNextAttemptStoryEventId({
      stageId: selectedStageId,
      previousWon: campaignResult?.won === true,
    });
    if (nextEventId) openEvent(nextEventId, "battle");
    else startGame();
  }, [campaignResult?.won, formationKinds, openEvent, selectedOutbreakMissionId, selectedStageId, selectedSupply, startGame]);
  const continueResult = useCallback(() => {
    returnToMap();
  }, [returnToMap]);
  const continueOutbreakResult = useCallback(() => {
    setStarted(false);
    setPaused(false);
    setEnd(null);
    setOutbreakResult(null);
    setScreen("outbreak");
  }, []);
  const acknowledgeMigrationNotice = useCallback((noticeId: string) => {
    setCampaignSave((current) => acknowledgeCampaignMigrationNotice(current, noticeId) as CampaignSave);
  }, []);
  const downloadCampaignText = useCallback((filename: string, text: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, []);
  const exportCampaignSave = useCallback(() => {
    const serialized = serializeCampaignSave(campaignSave);
    downloadCampaignText(`nishijin-campaign-v${CAMPAIGN_SAVE_SCHEMA_VERSION}-backup.json`, createCampaignManualExport(serialized, {
      metadata: { revision: campaignSave.revision, updatedAt: campaignSave.updatedAt },
    }));
  }, [campaignSave, downloadCampaignText]);
  const exportCorruptCampaignSave = useCallback(() => {
    if (!saveRecovery) return;
    const candidates = saveRecovery.corruptCandidates.length > 0
      ? saveRecovery.corruptCandidates
      : saveRecovery.candidates;
    downloadCampaignText("nishijin-campaign-recovery-candidates.json", createCorruptCampaignRawExport(candidates));
  }, [downloadCampaignText, saveRecovery]);
  const importCampaignSave = useCallback((text: string) => {
    const imported = parseCampaignManualImport(text, {
      validate: (serialized: string, context: { source: string }) => inspectCampaignSaveCandidate(serialized, { source: context.source }),
    });
    if (imported.status !== "ready" || !imported.value) {
      window.alert(`バックアップを読み込めませんでした。現在のセーブは変更していません。\n${imported.reason || "整合性確認に失敗しました。"}`);
      return;
    }
    if (campaignSave.campaignStarted && !saveRecovery && !window.confirm("現在のセーブを、選択したバックアップで置き換えますか？")) return;
    if (!beginSaveMutation()) return;
    setSaveHydrated(false);
    void (async () => {
      try {
        const outcome = await enqueueCampaignStorageMutation(async () => {
          const storage = campaignStorageFor(window);
          const indexedDb = indexedDbFor(window);
          if (saveRecovery?.recoveryReason === "replica-unreadable") {
            const preflight = await preflightUnreadableCampaignRecovery({
              storage,
              indexedDb,
              key: CAMPAIGN_SAVE_KEY,
              selectedSerialized: imported.raw,
              validate: (serialized: string, context: { source: string }) => inspectCampaignSaveCandidate(serialized, { source: context.source }),
            });
            if (preflight.status === "blocked") {
              return { status: "blocked" as const, reason: "replica-still-unreadable" };
            }
            if (preflight.status === "refresh-required") {
              return {
                status: "refresh-required" as const,
                recovery: {
                  ...preflight.resolution,
                  status: "recovery-needed",
                  recoveryReason: "revealed-replica-conflict",
                } as SaveRecoveryState,
              };
            }
          }
          const sourceSchemaVersion = Number(imported.candidate?.validation?.sourceSchemaVersion);
          if (Number.isFinite(sourceSchemaVersion)
            && sourceSchemaVersion < CAMPAIGN_SAVE_SCHEMA_VERSION) {
            const preMigrationSnapshot = await writeCampaignRecoverySnapshot({
              storage,
              indexedDb,
              key: CAMPAIGN_SAVE_KEY,
              kind: CAMPAIGN_SNAPSHOT_KINDS.PRE_MIGRATION,
              serialized: imported.raw,
            });
            if (!preMigrationSnapshot.saved) {
              return { status: "blocked" as const, reason: "pre-migration-snapshot-failed" };
            }
          }
          const recoveryBackupCandidate = saveRecovery?.candidates.find((candidate) => (
            candidate.valid === true && candidate.raw && candidate.raw !== imported.raw
          )) ?? saveRecovery?.candidates.find((candidate) => candidate.valid === true && candidate.raw);
          const existingSerialized = lastPersistedSerializedRef.current || recoveryBackupCandidate?.raw || "";
          if (existingSerialized) {
            const lastKnownGoodSnapshot = await writeCampaignRecoverySnapshot({
              storage,
              indexedDb,
              key: CAMPAIGN_SAVE_KEY,
              kind: CAMPAIGN_SNAPSHOT_KINDS.LAST_KNOWN_GOOD,
              serialized: existingSerialized,
            });
            if (!lastKnownGoodSnapshot.saved) {
              return { status: "blocked" as const, reason: "last-known-good-snapshot-failed" };
            }
          }
          const highestRecoveryRevision = Math.max(
            0,
            ...(saveRecovery?.candidates ?? []).map((candidate) => Number(candidate.metadata?.revision) || 0),
          );
          const importedSave = imported.value as CampaignSave;
          const loaded = reviseCampaignSave({
            ...importedSave,
            revision: Math.max(importedSave.revision, campaignSave.revision, highestRecoveryRevision),
          }) as CampaignSave;
          const serialized = serializeCampaignSave(loaded);
          const localSaved = writeCampaignSave(storage, CAMPAIGN_SAVE_KEY, serialized);
          const backupSaved = await writeCampaignBackup(indexedDb, CAMPAIGN_SAVE_KEY, serialized);
          return { status: "written" as const, loaded, serialized, localSaved, backupSaved };
        });
        if (outcome.status === "refresh-required") {
          persistenceWriteBlockedSourcesRef.current = new Set(outcome.recovery.writeBlockedSources ?? []);
          setSaveRecovery(outcome.recovery);
          setSavePersistence("unavailable");
          window.alert("読めなかった保存先を再確認したところ、別の有効なセーブが見つかりました。どちらを使うか改めて選んでください。まだ上書きしていません。");
          return;
        }
        if (outcome.status === "blocked") {
          if (!saveRecovery) setSaveHydrated(true);
          window.alert(outcome.reason === "replica-still-unreadable"
            ? "読めない保存先が残っているため、読み込みを停止しました。ページを再読み込みしてから再試行してください。保存先には何も書き込んでいません。"
            : outcome.reason === "pre-migration-snapshot-failed"
              ? "移行前バックアップを保存できないため、読み込みを停止しました。現在のセーブは変更していません。"
              : "現在のセーブの退避に失敗したため、読み込みを停止しました。現在のセーブは変更していません。");
          return;
        }
        if (!outcome.localSaved && !outcome.backupSaved) {
          if (!saveRecovery) setSaveHydrated(true);
          window.alert("バックアップを検証できましたが、端末へ保存できませんでした。現在のセーブは変更していません。");
          return;
        }
        lastPersistedSerializedRef.current = outcome.serialized;
        lastPersistedReplicaRef.current = {
          serialized: outcome.serialized,
          localSaved: outcome.localSaved,
          backupSaved: outcome.backupSaved,
        };
        if (outcome.localSaved) persistenceWriteBlockedSourcesRef.current.delete("localStorage");
        if (outcome.backupSaved) persistenceWriteBlockedSourcesRef.current.delete("indexedDB");
        setCampaignSave(outcome.loaded);
        setSelectedStageId(outcome.loaded.lastSelectedStageId);
        setCampaignResult(null);
        setSaveRecovery(null);
        setSavePersistence(outcome.localSaved && outcome.backupSaved ? "saved" : "recovered");
        setScreen("title");
        setSaveHydrated(true);
      } catch {
        if (!saveRecovery) setSaveHydrated(true);
        window.alert("バックアップの読み込み処理に失敗しました。現在のセーブは変更していません。");
      } finally {
        finishSaveMutation();
      }
    })();
  }, [beginSaveMutation, campaignSave, enqueueCampaignStorageMutation, finishSaveMutation, saveRecovery]);
  const useRecoveryCandidate = useCallback((source: string) => {
    const candidate = saveRecovery?.candidates.find((entry) => (
      entry.source === source && entry.valid === true && typeof entry.raw === "string" && entry.raw.length > 0
    ));
    if (!candidate) {
      window.alert("選択した保存候補を読み込めませんでした。候補データを書き出して内容を確認してください。");
      return;
    }
    importCampaignSave(candidate.raw);
  }, [importCampaignSave, saveRecovery]);
  const enterRollbackFailureRecovery = useCallback(() => {
    const memoryCandidate: SaveRecoveryCandidate = {
      source: "memory-before-reset",
      raw: serializeCampaignSave(campaignSave),
      reason: "reset-rollback-failed",
      state: "valid",
      valid: true,
      metadata: { revision: campaignSave.revision, updatedAt: campaignSave.updatedAt },
    };
    setSaveRecovery(saveRecovery
      ? { ...saveRecovery, status: "recovery-needed", recoveryReason: "reset-rollback-failed" }
      : {
        status: "recovery-needed",
        recoveryReason: "reset-rollback-failed",
        candidates: [memoryCandidate],
        corruptCandidates: [],
      });
    setSavePersistence("unavailable");
    setSaveHydrated(false);
  }, [campaignSave, saveRecovery]);
  const resetCorruptCampaignSave = useCallback(() => {
    if (!window.confirm("破損したセーブを完全初期化しますか？ 星・報酬・加入・編成は元に戻せません。")) return;
    if (!beginSaveMutation()) return;
    void (async () => {
      try {
        const cleared = await enqueueCampaignStorageMutation(() => clearCampaignSaveEverywhere({ storage: campaignStorageFor(window), indexedDb: indexedDbFor(window), key: CAMPAIGN_SAVE_KEY }));
        if (!cleared.cleared) {
          if (cleared.status === "rollback-failed") {
            enterRollbackFailureRecovery();
            window.alert("保存先の一部削除後に復元できなかったため、復旧画面で停止しました。候補データを書き出してから復旧方法を選んでください。");
            return;
          }
          window.alert("完全初期化できませんでした。2つの保存先を消去できる通常ブラウザで開き直してください。現在のセーブ候補は変更していません。");
          return;
        }
        const fresh = createDefaultCampaignSave() as CampaignSave;
        lastPersistedSerializedRef.current = "";
        lastPersistedReplicaRef.current = { serialized: "", localSaved: false, backupSaved: false };
        persistenceWriteBlockedSourcesRef.current = new Set();
        setCampaignSave(fresh);
        setSelectedStageId(fresh.lastSelectedStageId);
        setCampaignResult(null);
        setSaveRecovery(null);
        setSavePersistence("checking");
        setScreen("title");
        setSaveHydrated(true);
      } catch {
        window.alert("完全初期化処理に失敗しました。現在のセーブ候補は変更していません。");
      } finally {
        finishSaveMutation();
      }
    })();
  }, [beginSaveMutation, enqueueCampaignStorageMutation, enterRollbackFailureRecovery, finishSaveMutation]);
  const resetCampaign = useCallback(() => {
    if (!window.confirm("セーブデータを初期化しますか？ 星・報酬・解放状態は元に戻せません。")) return;
    if (!beginSaveMutation()) return;
    setSaveHydrated(false);
    void (async () => {
      try {
        const cleared = await enqueueCampaignStorageMutation(() => clearCampaignSaveEverywhere({ storage: campaignStorageFor(window), indexedDb: indexedDbFor(window), key: CAMPAIGN_SAVE_KEY }));
        if (!cleared.cleared) {
          if (cleared.status === "rollback-failed") {
            enterRollbackFailureRecovery();
            window.alert("保存先の一部削除後に復元できなかったため、復旧画面で停止しました。操作前のメモリ保存候補を書き出せます。");
            return;
          }
          setSaveHydrated(true);
          window.alert("初期化できませんでした。2つの保存先を消去できる通常ブラウザで開き直してください。現在のセーブは変更していません。");
          return;
        }
        const fresh = createDefaultCampaignSave() as CampaignSave;
        lastPersistedSerializedRef.current = "";
        lastPersistedReplicaRef.current = { serialized: "", localSaved: false, backupSaved: false };
        persistenceWriteBlockedSourcesRef.current = new Set();
        setCampaignSave(fresh);
        setSelectedStageId(fresh.lastSelectedStageId);
        setCampaignResult(null);
        setSaveRecovery(null);
        setSavePersistence("checking");
        setScreen("title");
        setSaveHydrated(true);
      } catch {
        setSaveHydrated(true);
        window.alert("初期化処理に失敗しました。現在のセーブは変更していません。");
      } finally {
        finishSaveMutation();
      }
    })();
  }, [beginSaveMutation, enqueueCampaignStorageMutation, enterRollbackFailureRecovery, finishSaveMutation]);
  const restartCampaign = useCallback(() => {
    if (!window.confirm("現在のセーブデータを初期化して、物語を最初から始めますか？")) return;
    if (!beginSaveMutation()) return;
    setSaveHydrated(false);
    void (async () => {
      try {
        const cleared = await enqueueCampaignStorageMutation(() => clearCampaignSaveEverywhere({ storage: campaignStorageFor(window), indexedDb: indexedDbFor(window), key: CAMPAIGN_SAVE_KEY }));
        if (!cleared.cleared) {
          if (cleared.status === "rollback-failed") {
            enterRollbackFailureRecovery();
            window.alert("保存先の一部削除後に復元できなかったため、復旧画面で停止しました。操作前のメモリ保存候補を書き出せます。");
            return;
          }
          setSaveHydrated(true);
          window.alert("最初から始めるための初期化に失敗しました。現在のセーブは変更していません。");
          return;
        }
        const fresh = markCampaignStarted(createDefaultCampaignSave()) as CampaignSave;
        lastPersistedSerializedRef.current = "";
        lastPersistedReplicaRef.current = { serialized: "", localSaved: false, backupSaved: false };
        persistenceWriteBlockedSourcesRef.current = new Set();
        setCampaignSave(fresh);
        setSelectedStageId(fresh.lastSelectedStageId);
        setCampaignResult(null);
        setSaveRecovery(null);
        setSavePersistence("checking");
        setSaveHydrated(true);
        openEvents(getPrologueOpeningEventIds(), "map");
      } catch {
        setSaveHydrated(true);
        window.alert("最初から始めるための初期化処理に失敗しました。現在のセーブは変更していません。");
      } finally {
        finishSaveMutation();
      }
    })();
  }, [beginSaveMutation, enqueueCampaignStorageMutation, enterRollbackFailureRecovery, finishSaveMutation, openEvents]);

  const publishPendingResult = useCallback((pending: PendingResultCommit) => {
    setCampaignSave(pending.save);
    setCampaignResult(pending.view);
    setPendingResultCommit(null);
    setStarted(false);
    if (!openEvents(pending.storyEventIds, "result")) setScreen("result");
  }, [openEvents]);

  const retryPendingResultSave = useCallback(() => {
    if (!pendingResultCommit || resultSaveRetryingRef.current) return;
    resultSaveRetryingRef.current = true;
    setResultSaveRetrying(true);
    void (async () => {
      try {
        const persisted = await persistCampaignSave(pendingResultCommit.save);
        if (!persisted.durable) {
          window.alert("作戦結果をまだ端末へ保存できません。通常ブラウザで開き直す前に、結果バックアップを書き出してください。");
          return;
        }
        publishPendingResult(pendingResultCommit);
      } finally {
        resultSaveRetryingRef.current = false;
        setResultSaveRetrying(false);
      }
    })();
  }, [pendingResultCommit, persistCampaignSave, publishPendingResult]);

  const exportPendingResultSave = useCallback(() => {
    if (!pendingResultCommit) return;
    const serialized = serializeCampaignSave(pendingResultCommit.save);
    downloadCampaignText("nishijin-campaign-v5-pending-result.json", createCampaignManualExport(serialized, {
      metadata: { revision: pendingResultCommit.save.revision, updatedAt: pendingResultCommit.save.updatedAt },
    }));
  }, [downloadCampaignText, pendingResultCommit]);

  useEffect(() => {
    if (!pendingSurvivalCheckpoint) return;
    const { run, checkpointId } = pendingSurvivalCheckpoint;
    if (survivalCheckpointSaveLocksRef.current.has(checkpointId)) return;
    survivalCheckpointSaveLocksRef.current.add(checkpointId);
    setSurvivalSavePending(true);
    let cancelled = false;
    void (async () => {
      const checkpoint = checkpointSurvivalCampaignSave(campaignSaveRef.current, run, {
        savedAt: new Date().toISOString(),
      });
      if (!checkpoint.applied) {
        if (!cancelled) {
          setPendingSurvivalCheckpoint(null);
          setSurvivalSavePending(false);
        }
        return;
      }
      const persisted = await persistCampaignSave(checkpoint.save as CampaignSave);
      if (cancelled) return;
      if (!persisted.durable) {
        survivalCheckpointSaveLocksRef.current.delete(checkpointId);
        setSavePersistence("unavailable");
        setSurvivalSavePending(false);
        return;
      }
      const liveGame = gameRef.current;
      if (liveGame.survivalRun?.runId === run.runId
        && liveGame.survivalRun.phase === SURVIVAL_RUN_PHASES.UPGRADE_SELECTION
        && liveGame.survivalCheckpointReceipt === checkpointId) {
        const continuedRun = {
          ...liveGame.survivalRun,
          manualAbilityCooldownsByKind: {},
        };
        liveGame.survivalRun = continuedRun;
        setSurvivalHud(survivalHudSnapshot(continuedRun));
      }
      setCampaignSave(checkpoint.save as CampaignSave);
      setPendingSurvivalCheckpoint(null);
      setSurvivalSavePending(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingSurvivalCheckpoint, persistCampaignSave]);

  const retrySurvivalCheckpointSave = useCallback(() => {
    if (!pendingSurvivalCheckpoint || survivalSavePending) return;
    survivalCheckpointSaveLocksRef.current.delete(pendingSurvivalCheckpoint.checkpointId);
    setPendingSurvivalCheckpoint({ ...pendingSurvivalCheckpoint });
  }, [pendingSurvivalCheckpoint, survivalSavePending]);

  const commitSurvivalSettlement = useCallback((pending: PendingSurvivalSettlement) => {
    if (survivalSavePending) return;
    setSurvivalSavePending(true);
    void (async () => {
      const result = await persistSurvivalCampaignSettlement(
        campaignSaveRef.current,
        pending.run,
        {
          endedAt: pending.endedAt,
          persist: async (candidate) => {
            survivalSettlementPersistenceQaRef.current.attempts += 1;
            if (survivalSettlementPersistenceQaRef.current.failuresRemaining > 0) {
              survivalSettlementPersistenceQaRef.current.failuresRemaining -= 1;
              return { durable: false };
            }
            return persistCampaignSave(candidate as CampaignSave);
          },
        },
      );
      if (!result.committed) {
        setSavePersistence("unavailable");
        setSurvivalSettlementAwaitingRetry(true);
        setSurvivalSavePending(false);
        return;
      }
      const nextSave = result.save as CampaignSave;
      const lastResult = nextSave.survival.lastResult;
      setCampaignSave(nextSave);
      setPendingSurvivalSettlement(null);
      setSurvivalSettlementAwaitingRetry(false);
      setSurvivalSavePending(false);
      setStarted(false);
      setPaused(false);
      setSurvivalHud(null);
      if (lastResult) {
        setSurvivalResult({
          endReason: lastResult.endReason,
          reachedWave: lastResult.reachedWave,
          kills: lastResult.stats.kills,
          bossKills: lastResult.stats.bossKills,
          earnedCaps: lastResult.earnedCaps,
          earnedEquipmentGrants: lastResult.earnedEquipmentGrants.map((grant: { equipmentId: string; quantity: number }) => ({
            ...grant,
            displayName: EQUIPMENT_BY_ID[grant.equipmentId]?.displayName ?? grant.equipmentId,
          })),
          unitStats: [...new Set([
            ...lastResult.formation.unitIds
              .map((unitId: string) => campaignUnitIdToCombatKind(unitId))
              .filter((kind: string | null): kind is string => Boolean(kind)),
            ...Object.keys(lastResult.stats.damageByUnit),
            ...Object.keys(lastResult.stats.damageTakenByUnit),
            ...Object.keys(lastResult.stats.healingByUnit),
          ])].map((kind) => ({
            kind,
            displayName: cards.find((card) => card.kind === kind)?.name ?? kind,
            damage: lastResult.stats.damageByUnit[kind] ?? 0,
            damageTaken: lastResult.stats.damageTakenByUnit[kind] ?? 0,
            healing: lastResult.stats.healingByUnit[kind] ?? 0,
          })).sort((left, right) => right.damage - left.damage || left.displayName.localeCompare(right.displayName)),
          newHighestWave: lastResult.newHighestWave,
          capsAfter: nextSave.caps,
        });
      }
      setScreen("survival-result");
    })();
  }, [persistCampaignSave, survivalSavePending]);

  useEffect(() => {
    if (!pendingSurvivalSettlement || survivalSavePending || survivalSettlementAwaitingRetry) return;
    const timer = window.setTimeout(() => {
      commitSurvivalSettlement(pendingSurvivalSettlement);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    commitSurvivalSettlement,
    pendingSurvivalSettlement,
    survivalSavePending,
    survivalSettlementAwaitingRetry,
  ]);

  const retrySurvivalSettlementSave = useCallback(() => {
    if (!pendingSurvivalSettlement || survivalSavePending) return;
    setSurvivalSettlementAwaitingRetry(false);
    commitSurvivalSettlement(pendingSurvivalSettlement);
  }, [commitSurvivalSettlement, pendingSurvivalSettlement, survivalSavePending]);

  const commitOutbreakSettlement = useCallback(async (pending: PendingOutbreakSettlement) => {
    if (outbreakSavePending) return false;
    const mission = OUTBREAK_MISSION_BY_ID[pending.end.stageId];
    if (!mission) return false;
    setOutbreakSavePending(true);
    const settlement = await persistOutbreakCampaignSettlement(
      campaignSaveRef.current,
      {
        resultId: pending.end.resultId,
        missionId: mission.id,
        won: pending.end.won,
        completedAt: pending.completedAt,
        stats: {
          kills: pending.end.kills,
          unitsLost: pending.end.unitsLost,
          battleSeconds: pending.end.time,
        },
        encounteredEnemyKinds: pending.end.encounteredEnemyKinds,
        enemyDefeatsByKind: pending.end.enemyDefeatsByKind,
        unitStats: pending.end.unitStats,
      },
      {
        completedAt: pending.completedAt,
        persist: async (candidate: CampaignSave) => {
          outbreakSettlementPersistenceQaRef.current.attempts += 1;
          if (outbreakSettlementPersistenceQaRef.current.failuresRemaining > 0) {
            outbreakSettlementPersistenceQaRef.current.failuresRemaining -= 1;
            return { durable: false };
          }
          return persistCampaignSave(candidate);
        },
      },
    );
    if (!settlement.committed) {
      setPendingOutbreakSettlement(pending);
      setSavePersistence("unavailable");
      setOutbreakSavePending(false);
      return false;
    }
    const nextSave = settlement.save as CampaignSave;
    const lastResult = nextSave.outbreaks.lastResult;
    const boss = bossDefinitionForEnemyKind(mission.boss.enemyKind);
    setCampaignSave(nextSave);
    setPendingOutbreakSettlement(null);
    setOutbreakSavePending(false);
    setStarted(false);
    setPaused(false);
    if (lastResult) {
      setOutbreakResult({
        missionId: mission.id,
        displayName: mission.displayName,
        bossName: boss?.displayName ?? mission.boss.enemyKind,
        won: lastResult.won,
        firstClear: lastResult.firstClear,
        time: lastResult.stats.battleSeconds,
        kills: lastResult.stats.kills,
        unitsLost: lastResult.stats.unitsLost,
        earnedCaps: lastResult.earnedCaps,
        equipmentGrants: lastResult.equipmentGrants.map((grant: { equipmentId: string; quantity: number }) => ({
          ...grant,
          displayName: EQUIPMENT_BY_ID[grant.equipmentId]?.displayName ?? grant.equipmentId,
        })),
        survivalUnlocked: lastResult.firstClear
          && nextSave.outbreaks.survivalBossKinds.includes(lastResult.bossKind),
        capsAfter: nextSave.caps,
      });
    }
    setScreen("outbreak-result");
    return true;
  }, [outbreakSavePending, persistCampaignSave]);

  const retryOutbreakSettlementSave = useCallback(() => {
    if (!pendingOutbreakSettlement || outbreakSavePending) return;
    void commitOutbreakSettlement(pendingOutbreakSettlement);
  }, [commitOutbreakSettlement, outbreakSavePending, pendingOutbreakSettlement]);

  useEffect(() => {
    if (!end || finalizedEndRef.current === end) return;
    const timer = window.setTimeout(async () => {
      if (finalizedEndRef.current === end) return;
      finalizedEndRef.current = end;
      const completedAt = new Date().toISOString();
      if (OUTBREAK_MISSION_BY_ID[end.stageId]) {
        const pending = {
          end,
          completedAt,
        };
        setPendingOutbreakSettlement(pending);
        await commitOutbreakSettlement(pending);
        return;
      }
      const resolved = resolveStageResult(campaignSave, {
        resultId: end.resultId,
        stageId: end.stageId,
        won: end.won,
        baseHp: end.baseHp,
        baseMaxHp: end.baseMaxHp,
        battleSeconds: end.time,
        kills: end.kills,
        unitsLost: end.unitsLost,
        bossKills: end.bossDefeated ? 1 : 0,
        encounteredEnemyKinds: end.encounteredEnemyKinds,
        enemyDefeatsByKind: end.enemyDefeatsByKind,
        unitStats: end.unitStats,
        completedAt,
      });
      const view: CampaignResultView = {
        won: end.won,
        currentStars: resolved.result.stars,
        previousBestStars: resolved.result.previousBestStars,
        bestStars: resolved.result.bestStars,
        newBest: resolved.result.isNewBest,
        clearReward: resolved.result.replayReward,
        newStarReward: resolved.result.firstTimeStarReward,
        totalReward: resolved.result.totalReward,
        capsAfter: resolved.save.caps,
        time: end.time,
        kills: end.kills,
        unitsLost: end.unitsLost,
        baseHpRatio: end.baseMaxHp > 0 ? end.baseHp / end.baseMaxHp : 0,
        missionFacts: stageResultFacts({
          stageId: end.stageId,
          won: end.won,
          firstClear: !campaignSave.completedStageIds.includes(end.stageId),
          missionRuntime: end.missionRuntime,
        }),
        newlyUnlockedUnits: resolved.result.newlyUnlockedUnitIds.map((id: string) => {
          const unit = (CAMPAIGN_UNITS as unknown as readonly CampaignUnitData[]).find((candidate) => candidate.id === id);
          return unit ? `${unit.displayName}（${unit.roleName}）` : id;
        }),
        newlyUnlockedStages: resolved.result.newlyUnlockedStageIds.map((id: string) => CAMPAIGN_STAGE_BY_ID[id]?.displayName ?? id),
      };
      const storyEventIds = getStageResultStoryEventIds({
        stageId: end.stageId,
        won: end.won,
        completedStageIds: campaignSave.completedStageIds,
        bossDefeated: end.bossDefeated,
        enemyBaseDestroyed: end.enemyBaseDestroyed,
      });
      const pending = { save: resolved.save as CampaignSave, view, storyEventIds };
      if (resolved.result.applied) {
        const localQaResult = Boolean(
          resolveLocalQaMode(window.location.hostname, window.location.search)
          || resolveLocalQaScenario(window.location.hostname, window.location.search),
        );
        // Persist the processed receipt in the same result transaction, before
        // exposing the result UI. A reload cannot replay rewards in the gap
        // between React state publication and the passive save effect.
        if (!localQaResult) {
          const persisted = await persistCampaignSave(resolved.save as CampaignSave);
          if (!persisted.durable) {
            setPendingResultCommit(pending);
            setSavePersistence("unavailable");
            return;
          }
        }
      }
      publishPendingResult(pending);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [campaignSave, commitOutbreakSettlement, end, persistCampaignSave, publishPendingResult]);

  useEffect(() => {
    if (!saveHydrated || !qaScenario || qaScenarioAppliedRef.current) return;
    qaScenarioAppliedRef.current = true;
    const timer = window.setTimeout(() => {
      setSelectedStageId(qaScenario.stageId);
      const qaUnitIds = (CAMPAIGN_UNITS as unknown as readonly CampaignUnitData[]).map((unit) => unit.id);
      const qaFormationUnitIds = qaUnitIds.slice(0, 7);
      const progressionPreview = qaScenario.mode === "flow"
        && (qaScenario.screen === "personnel" || qaScenario.screen === "formation");
      const qaSave = {
        ...campaignSave,
        campaignStarted: true,
        ...(qaScenario.mode === "story" ? { readStoryEventIds: [], autoSkipReadStory: false } : {}),
        unlockedStageIds: [...new Set([...campaignSave.unlockedStageIds, qaScenario.stageId])],
        ownership: qaUnitIds,
        discovery: qaUnitIds,
        recruitable: [],
        unlockedUnitIds: qaUnitIds,
        formationPresets: campaignSave.formationPresets.map((preset) => preset.id === campaignSave.selectedFormationPresetId
          ? { ...preset, unitIds: qaFormationUnitIds }
          : preset),
        lastSelectedStageId: qaScenario.stageId,
        ...(progressionPreview ? {
          caps: 2500,
          supplies: 2500,
          completedStageIds: CAMPAIGN_STAGES.slice(0, 3).map((stage) => stage.id),
          unitLevels: Object.fromEntries(qaUnitIds.map((unitId, index) => [
            unitId,
            Math.min(5, Math.floor(index / 2) + 1),
          ])),
        } : {}),
      } as CampaignSave;
      if (qaScenario.mode === "story" && "eventId" in qaScenario) {
        setCampaignSave(qaSave);
        openEvent(qaScenario.eventId, "map");
        return;
      }
      if (qaScenario.screen === "result") {
        const stage = CAMPAIGN_STAGE_BY_ID[qaScenario.stageId];
        const baseHpRatio = qaScenario.stars === 3 ? .94 : qaScenario.stars === 2 ? .76 : .48;
        const resolved = resolveStageResult(qaSave, {
          resultId: `local-qa:${qaScenario.stageId}:${qaScenario.stars}`,
          stageId: qaScenario.stageId,
          won: qaScenario.stars > 0,
          baseHp: stage.baseHp * baseHpRatio,
          baseMaxHp: stage.baseHp,
        });
        setCampaignSave(resolved.save as CampaignSave);
        setCampaignResult({
          won: qaScenario.stars > 0,
          currentStars: resolved.result.stars,
          previousBestStars: resolved.result.previousBestStars,
          bestStars: resolved.result.bestStars,
          newBest: resolved.result.isNewBest,
          clearReward: resolved.result.replayReward,
          newStarReward: resolved.result.firstTimeStarReward,
          totalReward: resolved.result.totalReward,
          capsAfter: resolved.save.caps,
          time: 94,
          kills: 24,
          unitsLost: 1,
          baseHpRatio,
          missionFacts: stageResultFacts({
            stageId: qaScenario.stageId,
            won: qaScenario.stars > 0,
            firstClear: !qaSave.completedStageIds.includes(qaScenario.stageId),
          }),
          newlyUnlockedUnits: resolved.result.newlyUnlockedUnitIds.map((id: string) => {
            const unit = (CAMPAIGN_UNITS as unknown as readonly CampaignUnitData[]).find((candidate) => candidate.id === id);
            return unit ? `${unit.displayName}（${unit.roleName}）` : id;
          }),
          newlyUnlockedStages: resolved.result.newlyUnlockedStageIds.map((id: string) => CAMPAIGN_STAGE_BY_ID[id]?.displayName ?? id),
        });
        setScreen("result");
        return;
      }
      setCampaignSave(qaSave);
      if (qaScenario.mode === "station" || qaScenario.mode === "mission") {
        const qaFormationKinds = (CAMPAIGN_UNITS as unknown as readonly CampaignUnitData[])
          .slice(0, 7)
          .map((unit) => unit.combatKind as UnitKind);
        startGame({
          stageId: qaScenario.stageId,
          formationKinds: qaFormationKinds,
          selectedSupply,
          resultId: `local-qa:${qaScenario.stageId}:${qaScenario.state}`,
        });
        return;
      }
      if (qaScenario.mode === "defense") {
        setScreen("loadout");
        return;
      }
      if (qaScenario.screen === "title") setScreen("title");
      else if (qaScenario.screen === "intro") openEvents(getPrologueOpeningEventIds(), "map");
      else if (qaScenario.screen === "personnel") setScreen("personnel");
      else if (qaScenario.screen === "formation") setScreen("loadout");
      else setScreen("map");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [campaignSave, openEvent, openEvents, qaScenario, saveHydrated, selectedSupply, startGame]);

  const togglePause = useCallback(() => {
    const g = gameRef.current;
    if (!g.running || g.over) return;
    if (g.survivalRun?.phase === SURVIVAL_RUN_PHASES.UPGRADE_SELECTION) return;
    const transition = resolvePauseAction(g.paused ? "resume" : "pause");
    if (!transition) return;
    g.paused = transition.paused; setPaused(g.paused);
    setPauseConfirm(null);
    if (g.paused) {
      g.battleBarks = clearNonScriptedBattleBarks(g.battleBarks) as BattleBarkRuntime;
      setHud((current) => ({ ...current, battleBarks: [] }));
      stopMusic(); stopJingle(); stopSfx();
    } else {
      if (g.takuyaEntranceAudioRemaining > 0) {
        g.takuyaEntranceAudioRemaining = TAKUYA_ENTRANCE_AUDIO.durationSeconds;
        playProductionCue(TAKUYA_ENTRANCE_AUDIO.cueId, W / 2, {
          priority: 104,
          cooldownMs: 0,
          volume: .92,
          maxInstances: 1,
        });
      }
      setHud((current) => ({
        ...current,
        battleBarks: [...g.battleBarks.active],
        takuyaEntranceAudioActive: g.takuyaEntranceAudioRemaining > 0,
      }));
      if (!bgmMuted) startMusic();
      resumeBattleAudioLoops(g);
    }
  }, [bgmMuted, playProductionCue, resumeBattleAudioLoops, startMusic, stopJingle, stopMusic, stopSfx]);

  const changeSurvivalSpeed = useCallback((speed: 1 | 2) => {
    const g = gameRef.current;
    if (!g.survivalRun || g.over || g.paused) return;
    const nextRun = setSurvivalRunSpeed(g.survivalRun, speed);
    g.survivalRun = nextRun;
    const boss = g.fighters.find((fighter) => (
      isBossEnemyKind(fighter.kind)
      && fighter.hp > 0
      && fighter.combatReady
      && fighter.contained !== true
    ));
    setSurvivalHud(survivalHudSnapshot(nextRun, {
      bossKind: boss?.kind ?? null,
      bossHp: boss?.hp ?? 0,
      bossMaxHp: boss?.maxHp ?? 0,
    }));
  }, []);

  const selectSurvivalUpgrade = useCallback((upgradeId: string) => {
    const g = gameRef.current;
    if (!g.survivalRun
      || !g.survivalRuntime
      || pendingSurvivalCheckpoint
      || survivalSavePending) return;
    const previousEffects = survivalUpgradeEffects(g.survivalRun);
    const selection = chooseSurvivalCombatUpgrade(g.survivalRuntime, g.survivalRun, upgradeId);
    if (!selection.selected || !selection.run || !selection.runtime) return;
    const nextEffects = survivalUpgradeEffects(selection.run);
    for (const fighter of g.fighters) {
      if (fighter.side !== "human" || fighter.hp <= 0) continue;
      const remainingDamageFraction = 1 - fighter.defense;
      Object.assign(fighter, {
        damage: fighter.damage * (nextEffects.attackMultiplier / previousEffects.attackMultiplier),
        range: fighter.range * (nextEffects.rangeMultiplier / previousEffects.rangeMultiplier),
        healingMultiplier: fighter.healingMultiplier
          * (nextEffects.healingMultiplier / previousEffects.healingMultiplier),
        defense: 1 - remainingDamageFraction
          * (nextEffects.defenseMultiplier / previousEffects.defenseMultiplier),
      });
    }
    for (const kind of Object.keys(g.deployCooldowns) as UnitKind[]) {
      g.deployCooldowns[kind] *= nextEffects.redeployMultiplier / previousEffects.redeployMultiplier;
    }
    g.survivalRun = selection.run;
    g.survivalRuntime = selection.runtime;
    g.baseHp = selection.run.crawler.hp;
    g.baseMaxHp = selection.run.crawler.maxHp;
    g.paused = false;
    setPaused(false);
    setSurvivalHud(survivalHudSnapshot(selection.run));
    if (!bgmMuted) startMusic();
    playCue("ui-confirm");
  }, [bgmMuted, pendingSurvivalCheckpoint, playCue, startMusic, survivalSavePending]);

  const requestPauseAction = useCallback((action: PauseAction) => {
    if (!gameRef.current.running || gameRef.current.over) return;
    setPauseConfirm(action);
  }, []);

  const cancelPauseAction = useCallback(() => {
    const transition = createBattleSessionTransition({
      action: "cancel",
      stageId: activeOperationId,
      formationKinds,
      selectedSupply,
      campaignSave,
      currentResultId: gameRef.current.resultId,
    });
    if (transition?.destination === "pause" && !transition.discardBattleState && !transition.commitResult) {
      setPauseConfirm(null);
    }
  }, [activeOperationId, campaignSave, formationKinds, selectedSupply]);

  const confirmPauseAction = useCallback(() => {
    const action = pauseConfirm;
    if (!action) return;
    const activeGame = gameRef.current;
    if (activeGame.survivalRun) {
      if (action !== "withdraw" || activeGame.over) return;
      const endedAt = new Date().toISOString();
      const recordedRun = captureUnfinishedSurvivalCombatStats(
        activeGame.survivalRuntime,
        activeGame.survivalRun,
        {
          totalKills: activeGame.kills,
          combatStats: {
            ...activeGame.combatMetrics,
            encounteredEnemyKinds: activeGame.enemyKindsSeen,
          },
          updatedAt: endedAt,
        },
      );
      const endedRun = endSurvivalRun(recordedRun, SURVIVAL_END_REASONS.WITHDRAWAL, endedAt);
      if (!endedRun) return;
      activeGame.survivalRun = endedRun;
      activeGame.over = true;
      activeGame.paused = true;
      setPauseConfirm(null);
      setPaused(true);
      setPendingSurvivalSettlement({ run: endedRun, endedAt });
      chooseAction(null);
      stopMusic();
      stopSfx();
      return;
    }
    const transition = createBattleSessionTransition({
      action,
      stageId: activeOperationId,
      formationKinds,
      selectedSupply,
      campaignSave,
      currentResultId: gameRef.current.resultId,
    });
    if (!transition || !transition.discardBattleState || transition.commitResult) return;
    setPauseConfirm(null);
    if (transition.destination === "battle" && transition.startFreshBattle) {
      disposeBattleRuntime();
      startGame(transition as {
        stageId: string;
        formationKinds: UnitKind[];
        selectedSupply: SupplyKind;
        resultId: string;
      });
      return;
    }
    if (transition.destination === "loadout") {
      disposeBattleRuntime();
      const fresh = initialGame(
        transition.selectedSupply,
        transition.stageId,
        transition.formationKinds as UnitKind[],
        createBattleResultId(transition.stageId),
        campaignSave.readStoryEventIds,
        campaignSave.unitLevels,
        getFormationPresetEquipmentSnapshot(campaignSave),
      );
      gameRef.current = fresh;
      finalizedEndRef.current = null;
      setStarted(false); setPaused(false); setEnd(null); setCampaignResult(null); setScreen("loadout"); chooseAction(null);
      return;
    }
    if (transition.destination === "map") {
      if (selectedOutbreakMissionId) {
        disposeBattleRuntime();
        finalizedEndRef.current = null;
        setStarted(false);
        setPaused(false);
        setEnd(null);
        setCampaignResult(null);
        setOutbreakResult(null);
        setScreen("outbreak");
        chooseAction(null);
        return;
      }
      returnToMap(transition as {
        stageId: string;
        formationKinds: UnitKind[];
        selectedSupply: SupplyKind;
      });
    }
  }, [activeOperationId, campaignSave, chooseAction, disposeBattleRuntime, formationKinds, pauseConfirm, returnToMap, selectedOutbreakMissionId, selectedSupply, startGame, stopMusic, stopSfx]);

  const updateVolume = useCallback((kind: "bgm" | "sfx", value: number) => {
    if (end || pendingResultCommit || resultSaveRetryingRef.current) return;
    const normalized = Math.max(0, Math.min(1, value));
    const enabled = normalized > 0;
    const mixer = productionMixerRef.current;
    if (kind === "bgm") {
      setBgmMuted(!enabled);
      mixer?.setSettings({ bgmEnabled: enabled, bgmVolume: normalized });
      setCampaignSave((current) => updateCampaignSettings(current, {
        bgmEnabled: enabled,
        bgmVolume: normalized,
      }) as CampaignSave);
      const now = performance.now();
      if (enabled && mixer && now - volumePreviewLastAtRef.current >= 120) {
        volumePreviewLastAtRef.current = now;
        document.documentElement.dataset.audioBgmPreviewStatus = "requested";
        const desiredScene = desiredProductionSceneRef.current;
        const previewCue = (desiredScene && PRODUCTION_AUDIO_MANIFEST.sceneById[desiredScene]?.bgm)
          || PRODUCTION_AUDIO_MANIFEST.sceneById.title?.bgm
          || "music-title";
        void mixer.unlock().then((unlocked) => {
          if (!unlocked || productionMixerRef.current !== mixer) {
            document.documentElement.dataset.audioBgmPreviewStatus = "locked";
            return null;
          }
          mixer.stopInstance("volume-preview:bgm", { fadeMs: 24 });
          return mixer.play(previewCue, {
            loop: false,
            durationSeconds: 1.1,
            offsetSeconds: 1,
            priority: 1000,
            cooldownMs: 0,
            maxInstances: 1,
            instanceKey: "volume-preview:bgm",
            volume: .78,
          }).then((handle) => {
            document.documentElement.dataset.audioBgmPreviewStatus = handle ? "played" : "skipped";
            return handle;
          });
        });
      }
      return;
    }
    sfxMutedRef.current = !enabled;
    setSfxMuted(!enabled);
    mixer?.setSettings({ sfxEnabled: enabled, sfxVolume: normalized });
    setCampaignSave((current) => updateCampaignSettings(current, {
      sfxEnabled: enabled,
      sfxVolume: normalized,
    }) as CampaignSave);
    const now = performance.now();
    if (enabled && now - volumePreviewLastAtRef.current >= 120) {
      volumePreviewLastAtRef.current = now;
      playProductionCue("ui-select", W / 2, {
        priority: 64,
        cooldownMs: 80,
        volume: .78,
        maxInstances: 1,
        dedupeKey: `volume-preview:${Math.round(normalized * 20)}`,
      });
    }
  }, [end, pendingResultCommit, playProductionCue]);

  const setAutoSkipReadStory = useCallback((enabled: boolean) => {
    setCampaignSave((current) => updateStoryPlaybackSettings(current, { autoSkipReadStory: enabled }) as CampaignSave);
  }, []);

  const cycleBattleEventMode = useCallback(() => {
    const modes: CampaignSave["settings"]["battleEventMode"][] = ["first-time", "compact", "all"];
    setCampaignSave((current) => {
      const nextMode = modes[(modes.indexOf(current.settings.battleEventMode) + 1) % modes.length];
      return updateStoryPlaybackSettings(current, { battleEventMode: nextMode }) as CampaignSave;
    });
  }, []);

  const toggleBgm = useCallback(() => {
    if (end || pendingResultCommit || resultSaveRetryingRef.current) return;
    const next = !bgmMuted; setBgmMuted(next);
    setCampaignSave((current) => updateCampaignSettings(current, {
      bgmEnabled: !next,
      bgmVolume: !next && current.settings.bgmVolume <= 0 ? .5 : current.settings.bgmVolume,
    }) as CampaignSave);
    if (next) stopMusic(); else if (started && !paused && !end) startMusic();
  }, [bgmMuted, end, paused, pendingResultCommit, startMusic, started, stopMusic]);

  const toggleSfx = useCallback(() => {
    if (end || pendingResultCommit || resultSaveRetryingRef.current) return;
    const next = !sfxMutedRef.current;
    sfxMutedRef.current = next;
    setSfxMuted(next);
    setCampaignSave((current) => updateCampaignSettings(current, {
      sfxEnabled: !next,
      sfxVolume: !next && current.settings.sfxVolume <= 0 ? .6 : current.settings.sfxVolume,
    }) as CampaignSave);
    if (next) { stopJingle(); stopSfx(); }
    else if (gameRef.current.running && !gameRef.current.paused && !gameRef.current.over) resumeBattleAudioLoops(gameRef.current);
  }, [end, pendingResultCommit, resumeBattleAudioLoops, stopJingle, stopSfx]);

  const enableAudio = useCallback(() => {
    if (end || pendingResultCommit || resultSaveRetryingRef.current) return;
    const mixer = productionMixerRef.current;
    if (!mixer) return;
    const restoredBgmVolume = Math.max(.35, campaignSave.settings.bgmVolume);
    const restoredSfxVolume = Math.max(.4, campaignSave.settings.sfxVolume);
    if (bgmMuted || sfxMutedRef.current
      || campaignSave.settings.bgmVolume <= 0 || campaignSave.settings.sfxVolume <= 0) {
      setBgmMuted(false);
      sfxMutedRef.current = false;
      setSfxMuted(false);
      setCampaignSave((current) => updateCampaignSettings(current, {
          bgmEnabled: true,
          sfxEnabled: true,
          bgmVolume: Math.max(.35, current.settings.bgmVolume),
          sfxVolume: Math.max(.4, current.settings.sfxVolume),
      }) as CampaignSave);
      mixer.setSettings({
        muted: false,
        masterVolume: .9,
        bgmEnabled: true,
        sfxEnabled: true,
        bgmVolume: restoredBgmVolume,
        sfxVolume: restoredSfxVolume,
      });
    }
    setAudioUnlockVisible(true);
    setAudioUnlockUi("pending");
    audioActivationPendingRef.current = true;
    const test = (async () => {
      const played = mixer.unlocked && mixer.getAudioStatus().state === "running"
        ? mixer.playTestTone({ respectSettings: true })
        : await mixer.enableAudio();
      if (!played) return false;
      return mixer.retryFailedAudio();
    })();
    void test.then((played: boolean) => {
      audioActivationPendingRef.current = false;
      if (!played) {
        setAudioUnlockUi("failed");
        return;
      }
      audioAssetFailureRef.current = false;
      setAudioUnlockUi("success");
      if (audioSuccessTimerRef.current !== null) window.clearTimeout(audioSuccessTimerRef.current);
      audioSuccessTimerRef.current = window.setTimeout(() => {
        setAudioUnlockVisible(false);
        audioSuccessTimerRef.current = null;
      }, 1800);
    }).catch(() => {
      audioActivationPendingRef.current = false;
      setAudioUnlockUi("failed");
    });
  }, [bgmMuted, campaignSave.settings.bgmVolume, campaignSave.settings.sfxVolume, end, pendingResultCommit]);

  const playAudioTestTone = useCallback(() => {
    enableAudio();
  }, [enableAudio]);

  const dispatchBattleStoryEvents = useCallback((g: Game) => {
    const stageId = g.definition.stageId;
    const elapsedBattleSeconds = Math.max(0, g.time - g.definition.prepSeconds);
    if (stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET
      && g.enemyKindsSeen.includes("runner") && g.enemyKindsSeen.includes("spitter")
      && !g.signalIds.includes("distress-voice")) g.signalIds.push("distress-voice");
    const boss = g.fighters.find((fighter) => fighter.kind === "takuya" && fighter.hp > 0);
    const bossIncoming = g.enemySpawn.pending.some((entry) => entry.kind === "takuya");
    if (stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE) {
      if (g.enemyKindsSeen.length > 0 && !g.signalIds.includes("mimic-voice")) g.signalIds.push("mimic-voice");
      if ((g.bossDefeatPending || (boss && boss.hp / boss.maxHp <= .5)) && !g.signalIds.includes("takuya-mimic-child")) g.signalIds.push("takuya-mimic-child");
    }
    const step = advanceBattleStoryFlow({
      state: g.storyFlowState,
      snapshot: {
        battleStarted: g.time >= g.definition.prepSeconds,
        enemyKindsSeen: g.enemyKindsSeen,
        signalIds: g.signalIds,
        enemyBaseExposed: stageId === CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET
          ? g.barricadeBucklingAnnounced
          : g.barricadeVulnerable,
        elapsedSeconds: elapsedBattleSeconds,
        convoyProgress: g.convoyProgress,
        civiliansEvacuated: g.civiliansEvacuated,
        convoyEvacuated: g.definition.missionType === "timed-defense" && g.convoyProgress >= 1,
        bossWarning: Boolean(boss || bossIncoming),
        bossHp: g.bossDefeatPending ? 0 : boss?.hp ?? 0,
        bossMaxHp: g.bossDefeatPending ? enemyStatsForWave("takuya", g.wave).hp : boss?.maxHp ?? 0,
        bossDefeated: g.bossDefeatPending ? false : g.bossDefeated,
        enemyBaseDestroyed: g.barricadeHp <= 0,
        powerActivated: g.stageMission.powerActivated ?? 0,
        gateEaterContained: g.stageMission.gateEaterContained === true,
        sealed: g.stageMission.sealed === true,
        missionCompleted: g.stageMission.completed === true,
      },
    });
    g.storyFlowState = step.state;
    if (g.bossDefeatPending) {
      g.bossDefeatPending = false;
      g.bossDefeated = true;
    }
    const priorReceiptCount = g.storyBattleReceiptEventIds.length;
    dispatchScriptedStoryBattleBarks(
      g,
      campaignSave.settings.battleEventMode,
      step.eventIds,
    );
    const newReceiptIds = g.storyBattleReceiptEventIds.slice(priorReceiptCount);
    if (newReceiptIds.length > 0) {
      setCampaignSave((current) => newReceiptIds.reduce(
        (next, receiptEventId) => markStoryEventRead(next, receiptEventId) as CampaignSave,
        current,
      ));
    }
    const warningCue = step.eventIds
      .map((storyEventId) => storyWarningCueForEvent(storyEventId))
      .find(Boolean);
    if (warningCue) playProductionCue(warningCue, W / 2, {
      priority: 98,
      cooldownMs: 600,
      volume: .9,
      maxInstances: 1,
    });
    // Canonical in-battle lines are dispatched through the non-blocking bark
    // runtime at their individual combat transitions. Only true dialogue
    // events (currently the completed Stage 6 escape) may open StoryScreen.
    const blockingEventIds = step.eventIds.filter((storyEventId) => !STORY_BATTLE_EVENT_IDS.includes(storyEventId));
    return blockingEventIds.length > 0 && openEvents(blockingEventIds, "battle-resume");
  }, [campaignSave.settings.battleEventMode, openEvents, playProductionCue]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const g = gameRef.current;
      const inputGate = keyboardInputGate({ running: g.running, paused: g.paused, over: g.over, key: event.key, repeat: event.repeat });
      if (inputGate === "ignore") return;
      if (inputGate === "toggle-pause") { togglePause(); return; }
      const normalizedKey = event.key.toLowerCase();
      const card = cards.find((item) => item.key === event.key);
      if (card) { deployHuman(card.kind); return; }
      const supply = supplyDefs[selectedSupply];
      if (normalizedKey === supply.key.toLowerCase()) {
        const action = `supply:${selectedSupply}` as SelectedAction;
        chooseActionWithCue(selectedActionRef.current === action ? null : action);
        return;
      }
      if (normalizedKey === "q") { chooseActionWithCue(selectedActionRef.current === "airstrike" ? null : "airstrike"); return; }
      if (normalizedKey === "g") { triggerCrawlerBarrage(); return; }
      if (event.key === "Escape") {
        if (selectedActionRef.current) chooseActionWithCue(null); else togglePause();
        return;
      }
      if (normalizedKey === "p") { togglePause(); return; }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [chooseActionWithCue, deployHuman, selectedSupply, togglePause, triggerCrawlerBarrage]);

  useEffect(() => {
    let frame = 0;
    const loop = (now: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const g = gameRef.current;
      if (!ctx) { frame = requestAnimationFrame(loop); return; }
      const performanceCounters = runtimePerformanceRef.current;
      if (pageHiddenRef.current || document.visibilityState === "hidden") {
        performanceCounters.hiddenFrameCallbacks += 1;
        g.last = now;
        frame = requestAnimationFrame(loop);
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const frameDt = Math.min(.033, g.last ? (now - g.last) / 1000 : 0);
      const dt = frameDt * (g.survivalRun?.speed ?? 1);
      g.last = now;
      g.shake = advanceCameraShakeRuntime(g.shake, dt);
      if (g.running && !g.paused) g.battleBarks = advanceBattleBarkRuntime(g.battleBarks, dt) as BattleBarkRuntime;

      if (g.running && !g.paused && !g.over) {
        performanceCounters.simulationTicks += 1;
        g.time += dt;
        g.manualAbilityVfx = g.manualAbilityVfx
          .map((effect) => ({ ...effect, elapsed: effect.elapsed + dt }))
          .filter((effect) => effect.elapsed < effect.duration);
        const pendingAbilityAudioCues = g.pendingAbilityAudioCues.splice(0);
        for (const pendingCue of pendingAbilityAudioCues) {
          playProductionCue(pendingCue.cueId, pendingCue.x, {
            priority: 88,
            cooldownMs: 80,
            maxInstances: 2,
            fallbackCue: "melee-hit",
            dedupeKey: pendingCue.dedupeKey,
          });
        }
        for (const owner of g.fighters) {
          if (owner.side !== "human" || !owner.manualAbility) continue;
          if (owner.kind === "mayo-chan" && owner.manualAbility.phase === "feral" && !owner.mayoRetreat) {
            const hpStep = mayoAbilityHpStep({ hp: owner.hp, maxHp: owner.maxHp, seconds: dt });
            owner.hp = hpStep.hp;
            if (hpStep.forceRetreat && beginMayoRetreat(g, owner, "ability")) {
              g.manualAbilityReceipts.push({
                ownerId: owner.id,
                activationId: owner.manualAbility?.activationId ?? 0,
                kind: owner.kind,
                eventType: "retreat-safe-floor",
                at: g.time,
              });
              playProductionCue(unitAudioCueFor(owner.kind, "weapon", "abilityEnd"), owner.x, {
                priority: 82,
                cooldownMs: 400,
                maxInstances: 1,
                fallbackCue: "melee-hit",
              });
            }
            if (owner.mayoRetreat) continue;
          }
          const abilityStep = advanceManualAbility(owner.manualAbility, dt);
          owner.manualAbility = abilityStep.runtime as ManualAbilityRuntime;
          for (const event of abilityStep.events) {
            g.manualAbilityReceipts.push({
              ownerId: owner.id,
              activationId: event.activationId,
              kind: event.kind,
              eventType: event.type,
              at: g.time,
              salvoIndex: event.salvoIndex,
              mode: event.mode,
            });
            g.manualAbilityReceipts = g.manualAbilityReceipts.slice(-32);
            if (event.type === "active-start"
              && ["crazy-king", "kumaverson", "guardian"].includes(event.kind)
              && event.target) {
              const targetIds = new Set((event.target.targetIds ?? []).map(String));
              if (event.kind === "crazy-king") {
                owner.comboHits = Math.max(owner.comboHits, 3);
                owner.comboWindow = MANUAL_ABILITY_REGISTRY["crazy-king"].activeSeconds;
                owner.cooldown = 0;
                owner.retargetIn = 0;
                addParticles(g, owner.x, owner.y - 28, "#f06835", 24);
                addDamageText(g, {
                  x: owner.x,
                  y: owner.y - 72,
                  value: "狂王暴走",
                  life: 1,
                  color: "#ffb14f",
                });
              } else {
                for (const enemy of g.fighters) {
                  if (enemy.side !== "zombie"
                    || enemy.hp <= 0
                    || !enemy.combatReady
                    || !targetIds.has(String(enemy.id))) continue;
                  enemy.targetId = owner.id;
                  enemy.retargetIn = Math.max(
                    enemy.retargetIn,
                    event.kind === "guardian"
                      ? MANUAL_ABILITY_REGISTRY.guardian.activeSeconds
                      : MANUAL_ABILITY_REGISTRY.kumaverson.activeSeconds,
                  );
                }
                owner.cooldown = 0;
                addParticles(
                  g,
                  owner.x,
                  owner.y - 28,
                  event.kind === "guardian" ? "#82a8b2" : "#d9a04c",
                  22,
                );
                addDamageText(g, {
                  x: owner.x,
                  y: owner.y - 72,
                  value: event.kind === "guardian" ? "鉄壁展開" : "仁王立ち",
                  life: 1,
                  color: event.kind === "guardian" ? "#c4e8ec" : "#ffd07a",
                });
              }
              g.flashOverlay = Math.max(g.flashOverlay, .08);
              playProductionCue(weaponCueForUnit(owner.kind), owner.x, {
                priority: 84,
                cooldownMs: 180,
                maxInstances: 1,
                fallbackCue: "melee-hit",
                dedupeKey: `manual-ability:${owner.id}:${event.activationId}:active`,
              });
              continue;
            }
            if (event.type === "feral-start" && event.kind === "mayo-chan") {
              owner.retargetIn = 0;
              owner.targetId = null;
              owner.cooldown = 0;
              g.banner = "マヨちゃん // 凶暴マヨ";
              g.bannerTime = 1.05;
              addParticles(g, owner.x, owner.y - 20, "#b52c52", 16);
              playProductionCue(unitAudioCueFor(owner.kind, "weapon", "abilityRush"), owner.x, {
                priority: 80,
                cooldownMs: 160,
                maxInstances: 2,
                fallbackCue: "melee-hit",
                dedupeKey: `manual-ability:${owner.id}:${event.activationId}:feral`,
              });
              continue;
            }
            if (event.type === "retreat" && event.kind === "mayo-chan") {
              if (beginMayoRetreat(g, owner, "ability")) {
                playProductionCue(unitAudioCueFor(owner.kind, "weapon", "abilityEnd"), owner.x, {
                  priority: 82,
                  cooldownMs: 400,
                  maxInstances: 1,
                  fallbackCue: "melee-hit",
                  dedupeKey: `manual-ability:${owner.id}:${event.activationId}:retreat`,
                });
              }
              continue;
            }
            if (event.type === "guard-start" && event.kind === "miyamoto-musashi") {
              g.banner = "宮本武蔵 // 受け流し構え";
              g.bannerTime = 1;
              addParticles(g, owner.x, owner.y - 38, "#9ec7db", 10);
              playProductionCue(unitAudioCueFor(owner.kind, "weapon", "abilityGuard"), owner.x, {
                priority: 82,
                cooldownMs: 220,
                maxInstances: 1,
                fallbackCue: "melee-hit",
                dedupeKey: `manual-ability:${owner.id}:${event.activationId}:guard`,
              });
              continue;
            }
            if (event.type === "launch" && event.kind === "mrs-chiha") {
              owner.flash = Math.max(owner.flash, .08);
              addParticles(g, owner.x + 18, owner.y - 36, "#d4a45c", 5);
              playProductionCue(unitAudioCueFor(owner.kind, "weapon", "abilityShot"), owner.x, {
                priority: 82,
                cooldownMs: 70,
                maxInstances: 4,
                fallbackCue: "ranged-shot",
                dedupeKey: `manual-ability:${owner.id}:${event.activationId}:shot:${event.salvoIndex}`,
              });
              continue;
            }
            if (event.type !== "impact" || !event.target) continue;
            if (event.kind === "brawler") {
              const definition = MANUAL_ABILITY_REGISTRY.brawler;
              const target = g.fighters.find((candidate) => (
                String(candidate.id) === String(event.target.targetId)
                && candidate.side === "zombie"
                && candidate.hp > 0
                && candidate.combatReady
              ));
              if (!target) continue;
              const totalDamage = definition.impactDamage * definition.hitCount;
              const damage = Math.min(target.hp, totalDamage);
              target.hp = Math.max(0, target.hp - totalDamage);
              target.flash = Math.max(target.flash, .3);
              for (const nearby of g.fighters) {
                if (nearby.side !== "zombie"
                  || nearby.hp <= 0
                  || !nearby.combatReady
                  || effectDistance(nearby, target) > definition.finalKnockbackRadius) continue;
                nearby.knock = Math.max(
                  nearby.knock,
                  nearby.id === target.id ? definition.finalKnockback : definition.finalKnockback * .72,
                );
                nearby.flash = Math.max(nearby.flash, nearby.id === target.id ? .3 : .14);
              }
              recordUnitDamage(g, owner.kind, damage);
              addDamageText(g, { x: target.x, y: target.y - 52, value: `連打×${definition.hitCount} -${Math.round(damage)}`, life: .9, color: "#ffd16d" });
              addParticles(g, target.x, target.y - 30, "#ffb34f", 24);
              g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.weaponHeavy);
              playProductionCue(weaponCueForUnit(owner.kind), target.x, {
                priority: 84, cooldownMs: 80, maxInstances: 2, fallbackCue: "melee-hit",
                dedupeKey: `manual-ability:${owner.id}:${event.activationId}:combo`,
              });
              continue;
            }
            if (event.kind === "scout") {
              const definition = MANUAL_ABILITY_REGISTRY.scout;
              const target = g.fighters.find((candidate) => (
                String(candidate.id) === String(event.target.targetId)
                && candidate.side === "zombie"
                && candidate.hp > 0
                && candidate.combatReady
              ));
              if (!target) continue;
              const direction = Math.sign(target.x - owner.x) || 1;
              owner.x = target.x - direction * (target.bodyRadius + definition.stopDistance);
              owner.y = target.y;
              owner.lane = target.lane;
              const damage = Math.min(target.hp, definition.impactDamage);
              target.hp = Math.max(0, target.hp - definition.impactDamage);
              target.stunned = Math.max(target.stunned, definition.stunSeconds);
              target.flash = Math.max(target.flash, .28);
              target.knock = Math.max(target.knock, 11);
              recordUnitDamage(g, owner.kind, damage);
              addDamageText(g, { x: target.x, y: target.y - 52, value: `迎撃 -${Math.round(damage)}`, life: .86, color: "#7ee7e4" });
              addParticles(g, target.x, target.y - 30, "#73d8d5", 18);
              playProductionCue(weaponCueForUnit(owner.kind), target.x, {
                priority: 84, cooldownMs: 80, maxInstances: 1, fallbackCue: "melee-hit",
                dedupeKey: `manual-ability:${owner.id}:${event.activationId}:intercept`,
              });
              continue;
            }
            if (event.kind === "ranger") {
              const definition = MANUAL_ABILITY_REGISTRY.ranger;
              const targetIds = event.target.targetIds ?? [event.target.targetId];
              let appliedCount = 0;
              for (const targetId of targetIds) {
                const target = g.fighters.find((candidate) => (
                  String(candidate.id) === String(targetId)
                  && candidate.side === "zombie"
                  && candidate.hp > 0
                  && candidate.combatReady
                ));
                if (!target) continue;
                const strike = definition.impactDamage * (appliedCount === 0 ? 1 : definition.penetrationMultiplier);
                const damage = Math.min(target.hp, strike);
                target.hp = Math.max(0, target.hp - strike);
                target.flash = Math.max(target.flash, .24);
                recordUnitDamage(g, owner.kind, damage);
                addDamageText(g, { x: target.x, y: target.y - 50, value: `精密 -${Math.round(damage)}`, life: .82, color: "#d8f2ff" });
                addParticles(g, target.x, target.y - 30, "#b9e5f2", appliedCount === 0 ? 15 : 8);
                appliedCount += 1;
              }
              if (appliedCount > 0) {
                g.flashOverlay = Math.max(g.flashOverlay, .08);
                playProductionCue(weaponCueForUnit(owner.kind), owner.x, {
                  priority: 86, cooldownMs: 100, maxInstances: 1, fallbackCue: "ranged-shot",
                  dedupeKey: `manual-ability:${owner.id}:${event.activationId}:precision`,
                });
              }
              continue;
            }
            if (event.kind === "medic") {
              const definition = MANUAL_ABILITY_REGISTRY.medic;
              const target = g.fighters.find((candidate) => (
                String(candidate.id) === String(event.target.targetId)
                && candidate.side === "human"
                && candidate.hp > 0
              ));
              if (!target) continue;
              const healing = Math.min(target.maxHp - target.hp, target.maxHp * definition.healRatio * owner.healingMultiplier);
              target.hp = Math.min(target.maxHp, target.hp + healing);
              recordUnitHealing(g, owner.kind, healing);
              target.slowMultiplier = 1;
              target.suppressionStacks = 0;
              target.suppressedRemaining = 0;
              target.suppressionMultiplier = 1;
              target.damageReductionRemaining = Math.max(target.damageReductionRemaining, definition.protectionSeconds);
              target.damageReductionMultiplier = Math.min(target.damageReductionMultiplier, definition.protectionMultiplier);
              addDamageText(g, { x: target.x, y: target.y - 54, value: `緊急処置 +${Math.round(healing)}`, life: .95, color: "#76e5a6" });
              addParticles(g, target.x, target.y - 28, "#72dca0", 20);
              playProductionCue("support-heal", target.x, {
                priority: 82, cooldownMs: 120, maxInstances: 1, fallbackCue: "medical-heal",
                dedupeKey: `manual-ability:${owner.id}:${event.activationId}:treatment`,
              });
              continue;
            }
            if (event.kind === "brute") {
              const definition = MANUAL_ABILITY_REGISTRY.brute;
              const targetIds = new Set((event.target.targetIds ?? [event.target.targetId]).map(String));
              for (const target of g.fighters) {
                if (target.side !== "zombie"
                  || target.hp <= 0
                  || !target.combatReady
                  || !targetIds.has(String(target.id))) continue;
                const damage = Math.min(target.hp, definition.impactDamage);
                target.hp = Math.max(0, target.hp - definition.impactDamage);
                target.stunned = Math.max(target.stunned, definition.stunSeconds);
                target.armorBrokenRemaining = Math.max(target.armorBrokenRemaining, definition.armorBreakSeconds);
                target.armorBreakStacks = 0;
                target.flash = Math.max(target.flash, .3);
                target.knock = Math.max(target.knock, 14);
                recordUnitDamage(g, owner.kind, damage);
                addDamageText(g, { x: target.x, y: target.y - 48, value: `地砕 -${Math.round(damage)}`, life: .84, color: "#e6b06b" });
              }
              if (targetIds.has("manual-structure:enemy-base")
                && g.barricadeVulnerable
                && g.barricadeHp > 0) {
                const baseTarget = enemyBaseTargetPoint(owner.lane, activeLaneCenters);
                const structureDamage = Math.min(
                  g.barricadeHp,
                  resolveTataraStrikeDamage(
                    definition.impactDamage * definition.structureImpactMultiplier,
                    { targetType: "infected-base" },
                  ),
                );
                g.barricadeHp = Math.max(0, g.barricadeHp - structureDamage);
                g.barricadeHitFlash = Math.max(g.barricadeHitFlash, .28);
                g.barricadeHitY = baseTarget.y;
                g.roleMetrics.tataraStructureDamage += structureDamage;
                addDamageText(g, {
                  x: baseTarget.x,
                  y: baseTarget.y - 18,
                  value: `地砕 -${Math.round(structureDamage)}`,
                  life: .9,
                  color: "#ffd06b",
                });
                addParticles(g, baseTarget.x, baseTarget.y, "#e78b45", 18);
              }
              addParticles(g, event.target.x, event.target.y, "#b88a58", 30);
              g.flashOverlay = Math.max(g.flashOverlay, .13);
              g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.airstrikeImpact);
              playProductionCue(weaponCueForUnit(owner.kind), event.target.x, {
                priority: 88, cooldownMs: 120, maxInstances: 1, fallbackCue: "melee-hit",
                dedupeKey: `manual-ability:${owner.id}:${event.activationId}:ground`,
              });
              continue;
            }
            if (event.kind === "babayaga") {
              const definition = MANUAL_ABILITY_REGISTRY.babayaga;
              const target = g.fighters.find((candidate) => (
                String(candidate.id) === String(event.target.targetId)
                && candidate.side === "zombie"
                && candidate.hp > 0
                && candidate.combatReady
              ));
              if (!target) continue;
              const damage = Math.min(target.hp, definition.impactDamage);
              target.hp = Math.max(0, target.hp - definition.impactDamage);
              target.marked = Math.max(target.marked, definition.markSeconds);
              target.flash = Math.max(target.flash, .22);
              recordUnitDamage(g, owner.kind, damage);
              addDamageText(g, { x: target.x, y: target.y - 54, value: `弱点査定 -${Math.round(damage)}`, life: .92, color: "#f0d36f" });
              addParticles(g, target.x, target.y - 34, "#e2c756", 14);
              playProductionCue(unitAudioCueFor(owner.kind, "weapon", "hit") || weaponCueForUnit(owner.kind), target.x, {
                priority: 84, cooldownMs: 100, maxInstances: 1, fallbackCue: "ranged-shot",
                dedupeKey: `manual-ability:${owner.id}:${event.activationId}:audit`,
              });
              continue;
            }
            if (event.kind === "gunner") {
              const definition = MANUAL_ABILITY_REGISTRY.gunner;
              const targetIds = new Set((event.target.targetIds ?? []).map(String));
              for (const target of g.fighters) {
                if (target.side !== "zombie"
                  || target.hp <= 0
                  || !target.combatReady
                  || !targetIds.has(String(target.id))) continue;
                const strike = definition.impactDamage * definition.burstCount;
                const damage = Math.min(target.hp, strike);
                target.hp = Math.max(0, target.hp - strike);
                target.suppressionStacks = Math.max(target.suppressionStacks, UNIT_ROLE_TUNING.raider.maximumSuppressionStacks);
                target.suppressedRemaining = Math.max(target.suppressedRemaining, definition.suppressionSeconds);
                target.flash = Math.max(target.flash, .25);
                target.knock = Math.max(target.knock, 9);
                recordUnitDamage(g, owner.kind, damage);
                addDamageText(g, { x: target.x, y: target.y - 48, value: `制圧 -${Math.round(damage)}`, life: .84, color: "#f4c66d" });
                addParticles(g, target.x, target.y - 28, "#d7ae58", 12);
              }
              g.flashOverlay = Math.max(g.flashOverlay, .1);
              playProductionCue(weaponCueForUnit(owner.kind), owner.x, {
                priority: 88, cooldownMs: 60, maxInstances: 2, fallbackCue: "ranged-shot",
                dedupeKey: `manual-ability:${owner.id}:${event.activationId}:suppress`,
              });
              continue;
            }
            if (event.kind === "engineer") {
              owner.engineerTrapReady = true;
              owner.engineerTrapX = Number(event.target.trapX ?? event.target.x);
              owner.engineerTrapLane = (event.target.trapLane ?? event.target.lane) as Lane;
              owner.engineerTrapManual = true;
              owner.engineerTrapCooldown = 0;
              addDamageText(g, { x: owner.engineerTrapX, y: activeLaneCenters[owner.engineerTrapLane] - 30, value: "捕縛罠", life: .9, color: "#e3ce77" });
              addParticles(g, owner.engineerTrapX, activeLaneCenters[owner.engineerTrapLane] - 6, "#c8b158", 16);
              playProductionCue(weaponCueForUnit(owner.kind), owner.engineerTrapX, {
                priority: 80, cooldownMs: 100, maxInstances: 1, fallbackCue: "melee-hit",
                dedupeKey: `manual-ability:${owner.id}:${event.activationId}:trap`,
              });
              continue;
            }
            if (event.kind === "zakimiya") {
              const definition = MANUAL_ABILITY_REGISTRY.zakimiya;
              const affected = g.fighters.filter((candidate) => (
                candidate.side === "zombie"
                && candidate.hp > 0
                && candidate.combatReady
                && candidate.contained !== true
                && effectDistance(candidate, event.target) <= definition.effectRadius
              ));
              for (const target of affected) {
                const damage = Math.min(target.hp, definition.impactDamage);
                target.hp = Math.max(0, target.hp - definition.impactDamage);
                recordUnitDamage(g, owner.kind, damage);
                target.flash = Math.max(target.flash, .2);
                target.knock = Math.max(target.knock, 8);
                addDamageText(g, {
                  x: target.x,
                  y: target.y - 48,
                  value: `火酒 -${Math.round(damage)}`,
                  life: .82,
                  color: "#ffb15a",
                });
              }
              g.areaEffects.push({
                id: g.nextAreaEffectId++,
                kind: "burn",
                sourceSupplyId: -(100000 + owner.id),
                lane: (event.target.lane ?? activeLaneForY(event.target.y)) as Lane,
                x: event.target.x,
                y: event.target.y,
                radius: definition.effectRadius,
                amountPerSecond: definition.burnDamagePerSecond,
                remaining: definition.burnSeconds,
                phase: "active",
                slowMultiplier: .86,
              });
              addParticles(g, event.target.x, event.target.y - 12, "#f26a35", 28);
              addParticles(g, event.target.x, event.target.y - 16, "#f2c06d", 14);
              g.flashOverlay = Math.max(g.flashOverlay, .16);
              g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.airstrikeImpact);
              playProductionCue("weapon-pan-hit", event.target.x, {
                priority: 82,
                cooldownMs: 80,
                volume: .7,
                maxInstances: 1,
                fallbackCue: "melee-hit",
                dedupeKey: `manual-ability:${owner.id}:${event.activationId}`,
              });
              playCue("drum-blast");
              playCue("burn-start");
              continue;
            }
            if (event.kind === "tky") {
              const definition = MANUAL_ABILITY_REGISTRY.tky;
              const direction = Number(event.target.direction) < 0 ? -1 : 1;
              const originX = Number(event.target.originX);
              const originY = Number(event.target.originY);
              const affected = g.fighters.filter((candidate) => {
                const forward = (candidate.x - originX) * direction;
                return candidate.side === "zombie"
                  && candidate.hp > 0
                  && candidate.combatReady
                  && candidate.contained !== true
                  && forward >= -8
                  && forward <= definition.reach
                  && Math.abs(candidate.y - originY) <= definition.effectHalfHeight;
              });
              for (const target of affected) {
                const damage = Math.min(target.hp, definition.impactDamage);
                target.hp = Math.max(0, target.hp - definition.impactDamage);
                recordUnitDamage(g, owner.kind, damage);
                target.flash = Math.max(target.flash, .28);
                target.knock = Math.max(target.knock, definition.knockback);
                target.stunned = Math.max(target.stunned, definition.stunSeconds);
                addDamageText(g, { x: target.x, y: target.y - 50, value: `光刃 -${Math.round(damage)}`, life: .82, color: "#ff70d4" });
                addParticles(g, target.x, target.y - 34, "#ff42c8", 11);
              }
              g.flashOverlay = Math.max(g.flashOverlay, .12);
              g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.takuyaHeavy);
              playProductionCue(unitAudioCueFor(owner.kind, "weapon", "abilityRelease"), owner.x, {
                priority: 88,
                cooldownMs: 200,
                maxInstances: 1,
                fallbackCue: "melee-hit",
                dedupeKey: `manual-ability:${owner.id}:${event.activationId}:release`,
              });
              playProductionCue(unitAudioCueFor(owner.kind, "weapon", "abilityImpact"), event.target.x, {
                priority: 86,
                cooldownMs: 80,
                maxInstances: 2,
                fallbackCue: "airstrike-impact",
                dedupeKey: `manual-ability:${owner.id}:${event.activationId}:impact`,
              });
              continue;
            }
            if (event.kind === "mrs-chiha") {
              const definition = MANUAL_ABILITY_REGISTRY["mrs-chiha"];
              const finalRound = event.finalRound === true;
              const impactDamage = definition.impactDamage * (finalRound ? definition.finalDamageMultiplier : 1);
              for (const target of g.fighters) {
                if (target.side !== "zombie"
                  || target.hp <= 0
                  || !target.combatReady
                  || target.contained === true
                  || effectDistance(target, event.target) > definition.effectRadius) continue;
                const damage = Math.min(target.hp, impactDamage);
                target.hp = Math.max(0, target.hp - impactDamage);
                recordUnitDamage(g, owner.kind, damage);
                target.flash = Math.max(target.flash, finalRound ? .3 : .18);
                target.knock = Math.max(target.knock, finalRound ? definition.finalKnockback : 7);
                addDamageText(g, { x: target.x, y: target.y - 48, value: `榴弾 -${Math.round(damage)}`, life: .78, color: finalRound ? "#ffd08a" : "#d9aa63" });
              }
              addParticles(g, event.target.x, event.target.y - 14, finalRound ? "#ffd08a" : "#d48a42", finalRound ? 28 : 16);
              g.flashOverlay = Math.max(g.flashOverlay, .18);
              g.shake = triggerCameraShake(g.shake, finalRound ? CAMERA_SHAKE_EVENTS.airstrikeImpact : CAMERA_SHAKE_EVENTS.weaponHeavy);
              playProductionCue(unitAudioCueFor(owner.kind, "weapon", finalRound ? "abilityFinal" : "abilityImpact"), event.target.x, {
                priority: finalRound ? 92 : 85,
                cooldownMs: 70,
                maxInstances: 4,
                fallbackCue: "drum-blast",
                dedupeKey: `manual-ability:${owner.id}:${event.activationId}:impact:${event.salvoIndex}`,
              });
              continue;
            }
            if (event.kind === "miyamoto-musashi") {
              const definition = MANUAL_ABILITY_REGISTRY["miyamoto-musashi"];
              const target = g.fighters.find((candidate) => (
                candidate.id === event.target.targetId
                && candidate.side === "zombie"
                && candidate.hp > 0
                && candidate.combatReady
              )) ?? g.fighters
                .filter((candidate) => candidate.side === "zombie" && candidate.hp > 0 && candidate.combatReady)
                .sort((left, right) => fighterDistance(owner, left) - fighterDistance(owner, right) || left.id - right.id)
                .find((candidate) => fighterDistance(owner, candidate) <= definition.fallbackRange);
              g.manualAbilityVfx = g.manualAbilityVfx.filter((effect) => effect.ownerId !== owner.id);
              if (!target) continue;
              const strikeDamage = definition.counterDamage * (isBossEnemyKind(target.kind) ? definition.bossDamageMultiplier : 1);
              const damage = Math.min(target.hp, strikeDamage);
              target.hp = Math.max(0, target.hp - strikeDamage);
              recordUnitDamage(g, owner.kind, damage);
              target.flash = Math.max(target.flash, .3);
              target.stunned = Math.max(target.stunned, definition.counterStunSeconds);
              target.knock = Math.max(target.knock, isBossEnemyKind(target.kind) ? 4 : 13);
              owner.x += Math.sign(target.x - owner.x) * Math.min(26, Math.max(0, Math.abs(target.x - owner.x) - owner.range));
              addDamageText(g, { x: target.x, y: target.y - 54, value: `無空 -${Math.round(damage)}`, life: .9, color: "#d7efff" });
              addParticles(g, target.x, target.y - 34, "#c7e4ef", 18);
              playProductionCue(unitAudioCueFor(owner.kind, "weapon", "abilityCounter"), target.x, {
                priority: 88,
                cooldownMs: 180,
                maxInstances: 1,
                fallbackCue: "melee-hit",
                dedupeKey: `manual-ability:${owner.id}:${event.activationId}:${event.mode ?? "fallback"}`,
              });
            }
          }
        }
        const pendingWeaponStep = advancePendingWeaponHits(g.pendingWeaponHits, dt);
        g.pendingWeaponHits = [...pendingWeaponStep.pending] as PendingWeaponHit[];
        for (const hit of pendingWeaponStep.due as readonly PendingWeaponHit[]) {
          const target = hit.targetId === null
            ? null
            : g.fighters.find((candidate) => (
              candidate.id === hit.targetId
              && candidate.side === "zombie"
              && candidate.hp > 0
              && candidate.contained !== true
            )) ?? null;
          if (hit.eventKind === "muzzle") {
            const locksGrenadeLandingPoint = hit.weapon === "mrs-chiha";
            addWeaponShot(g, {
              ...hit,
              targetX: locksGrenadeLandingPoint ? hit.targetX : target?.x ?? hit.targetX,
              targetY: locksGrenadeLandingPoint ? hit.targetY : target ? target.y - 28 : hit.targetY,
            });
            if (hit.weapon === "mrs-chiha") {
              playProductionCue(unitAudioCueFor("mrs-chiha", "weapon", "shot"), hit.originX, {
                priority: 72,
                cooldownMs: 100,
                maxInstances: 2,
                fallbackCue: "ranged-shot",
              });
              if (!productionMixerRef.current) playCue("ranged-shot", { frequency: 350 });
            } else if (hit.shotIndex > 0 && !productionMixerRef.current) {
              playCue("ranged-shot", { frequency: 335 + hit.shotIndex * 18 });
            }
            continue;
          }
          if (!hit.applyDamage) continue;
          if (hit.targetKind === "enemy-base") {
            if (g.barricadeHp <= 0) continue;
            const beforeHit = g.barricadeHp;
            g.barricadeHp = Math.max(0, g.barricadeHp - hit.damage);
            g.barricadeHitFlash = .2;
            g.barricadeHitY = hit.targetY;
            addDamageText(g, {
              x: hit.targetX + (hit.shotIndex - 1) * 7,
              y: hit.targetY - 14 - hit.shotIndex * 3,
              value: `-${Math.round(Math.min(beforeHit, hit.damage))}`,
              life: .62,
              color: "#ffd06b",
            });
            addParticles(g, hit.targetX, hit.targetY, "#e8c56c", hit.weapon === "mrs-chiha" ? 13 : 2);
            if (hit.weapon === "mrs-chiha") {
              playProductionCue(unitAudioCueFor("mrs-chiha", "weapon", "hit"), hit.targetX, {
                priority: 78,
                cooldownMs: 90,
                maxInstances: 3,
                fallbackCue: "drum-blast",
              });
              if (!productionMixerRef.current) playCue("drum-blast");
            }
            if (!g.barricadeBucklingAnnounced
              && beforeHit > g.barricadeMaxHp * .7
              && g.barricadeHp <= g.barricadeMaxHp * .7) {
              g.barricadeBucklingAnnounced = true;
              g.banner = "感染拠点 // 損傷";
              g.bannerTime = 1.5;
              playCue("base-damaged");
            }
            if (!g.barricadeCriticalAnnounced
              && beforeHit > g.barricadeMaxHp * .35
              && g.barricadeHp <= g.barricadeMaxHp * .35) {
              g.barricadeCriticalAnnounced = true;
              g.banner = "感染拠点 // 大破";
              g.bannerTime = 1.7;
              g.flashOverlay = Math.max(g.flashOverlay, .12);
              playCue("base-critical");
            }
            continue;
          }
          if (hit.damageMode === "grenade") {
            const grenadeDefinition = MANUAL_ABILITY_REGISTRY["mrs-chiha"];
            const impactPoint = { x: hit.targetX, y: hit.targetY + 28 };
            for (const splashTarget of g.fighters) {
              if (splashTarget.side !== "zombie"
                || splashTarget.hp <= 0
                || !splashTarget.combatReady
                || splashTarget.contained === true
                || effectDistance(splashTarget, impactPoint) > grenadeDefinition.grenadeRadius) continue;
              const primaryTarget = splashTarget.id === hit.targetId;
              const grenadeDamage = primaryTarget
                ? hit.damage
                : hit.damage * grenadeDefinition.grenadeSplashMultiplier;
              let appliedSplash;
              if (primaryTarget
                && splashTarget.kind === "gate-eater"
                && g.definition.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL
                && g.researchContainer) {
                const hpBeforeStrike = splashTarget.hp;
                const containerWasExposed = g.researchContainer.exposed;
                const containment = resolveContainmentStrike({
                  boss: splashTarget,
                  researchContainer: g.researchContainer,
                  attackDamage: grenadeDamage,
                  powerActivated: g.stageMission.powerActivated ?? 0,
                  sealDoorX: Number(g.definition.missionConfig.sealDoorX ?? 867),
                });
                Object.assign(splashTarget, containment.boss);
                g.researchContainer = containment.researchContainer as ResearchContainerRuntime;
                appliedSplash = Math.max(0, hpBeforeStrike - splashTarget.hp);
                if (!containerWasExposed && g.researchContainer.exposed) {
                  if (!g.signalIds.includes(STORY_BATTLE_TRIGGER_IDS.RESEARCH_CONTAINER_EXPOSED)) {
                    g.signalIds.push(STORY_BATTLE_TRIGGER_IDS.RESEARCH_CONTAINER_EXPOSED);
                  }
                  g.banner = "研究容器露出 // 改札喰いと共に押し込め";
                  g.bannerTime = 2;
                }
                if (containment.bossDefeated && g.stageMission.gateEaterDefeated !== true) {
                  g.banner = "改札喰い撃破 // 研究容器を確保";
                  g.bannerTime = 1.8;
                }
              } else {
                appliedSplash = Math.min(splashTarget.hp, grenadeDamage);
                splashTarget.hp = Math.max(0, splashTarget.hp - grenadeDamage);
              }
              recordUnitDamage(g, hit.weapon, appliedSplash);
              splashTarget.flash = Math.max(splashTarget.flash, .16);
              splashTarget.knock = Math.max(splashTarget.knock, primaryTarget ? 6 : 4);
              addDamageText(g, {
                x: splashTarget.x,
                y: splashTarget.y - 43,
                value: `${primaryTarget ? "榴弾" : "爆風"} -${Math.round(appliedSplash)}`,
                life: .66,
                color: "#e4b46c",
              });
            }
            addParticles(g, impactPoint.x, impactPoint.y - 12, "#d7924f", 13);
            playProductionCue(unitAudioCueFor("mrs-chiha", "weapon", "hit"), impactPoint.x, {
              priority: 78,
              cooldownMs: 90,
              maxInstances: 3,
              fallbackCue: "drum-blast",
            });
            continue;
          }
          if (!target) continue;
          const beforeHit = target.hp;
          if (hit.damageMode === "containment"
            && target.kind === "gate-eater"
            && g.definition.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL
            && g.researchContainer) {
            const containerWasExposed = g.researchContainer.exposed;
            const containment = resolveContainmentStrike({
              boss: target,
              researchContainer: g.researchContainer,
              attackDamage: hit.damage,
              powerActivated: g.stageMission.powerActivated ?? 0,
              sealDoorX: Number(g.definition.missionConfig.sealDoorX ?? 867),
            });
            Object.assign(target, containment.boss);
            g.researchContainer = containment.researchContainer as ResearchContainerRuntime;
            if (!containerWasExposed && g.researchContainer.exposed) {
              if (!g.signalIds.includes(STORY_BATTLE_TRIGGER_IDS.RESEARCH_CONTAINER_EXPOSED)) {
                g.signalIds.push(STORY_BATTLE_TRIGGER_IDS.RESEARCH_CONTAINER_EXPOSED);
              }
              g.banner = "研究容器露出 // 改札喰いと共に押し込め";
              g.bannerTime = 2;
            }
            if (containment.bossDefeated && g.stageMission.gateEaterDefeated !== true) {
              g.banner = "改札喰い撃破 // 研究容器を確保";
              g.bannerTime = 1.8;
            }
          } else {
            target.hp -= hit.damage;
          }
          recordUnitDamage(g, hit.weapon, Math.max(0, beforeHit - target.hp));
          if (hit.raiderLineHit && hit.shotIndex === 0) {
            const suppression = applyRaiderSuppression(target.suppressionStacks, 1);
            target.suppressionStacks = suppression.stacks;
            target.suppressedRemaining = suppression.remainingSeconds;
            target.suppressionMultiplier = suppression.speedMultiplier;
            g.roleMetrics.raiderSuppressionApplications += 1;
            if (hit.raiderSecondary) g.roleMetrics.raiderPierceHits += 1;
          }
          target.flash = Math.max(target.flash, .12);
          target.knock = Math.max(target.knock, 2 + hit.recoil * 4);
          addDamageText(g, {
            x: target.x + (hit.shotIndex - 1) * 7,
            y: target.y - 45 - hit.shotIndex * 3,
            value: String(Math.round(Math.max(0, beforeHit - target.hp))),
            life: .62,
            color: hit.raiderSecondary ? "#e8cc72" : "#f6d278",
          });
          addParticles(g, target.x, target.y - 26, "#e8c56c", 2);
          if (hit.shotIndex === 0 && Math.random() < .48) {
            playProductionCue(enemyVoiceCue(target.kind, "hurt"), target.x, {
              priority: target.kind === "takuya" || target.kind === "gate-eater" ? 88 : 62,
              cooldownMs: 210,
              maxInstances: 3,
            });
          }
        }
        if (g.definition.stageId === CAMPAIGN_STAGE_IDS.SAWARA_WARD_OFFICE && g.time >= g.definition.prepSeconds) {
          const convoy = advanceConvoyEvacuation({
            progress: g.convoyProgress,
            civiliansEvacuated: g.civiliansEvacuated,
            dt,
            humanCount: g.fighters.filter((fighter) => fighter.side === "human" && fighter.hp > 0).length,
            baseHp: g.baseHp,
            baseMaxHp: g.baseMaxHp,
            // Reaching the timer with a destroyed/failed Crawler is still a
            // loss. Only a real battle win may complete the convoy and fire
            // the canonical success scene.
            missionComplete: battleOutcomeFor(g.definition, g) === "won",
          });
          g.convoyProgress = convoy.progress;
          g.civiliansEvacuated = convoy.civiliansEvacuated;
        }
        if ((g.definition.missionType === STATION_MISSION_TYPES.ESCORT
          || g.definition.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL)
          && g.time >= g.definition.prepSeconds) {
          const spatial = stationSpatialSnapshot({
            missionType: g.definition.missionType,
            missionRuntime: g.stageMission,
            config: g.definition.missionConfig,
            fighters: g.fighters,
            hazards: g.stationHazards,
            researchContainer: g.researchContainer,
            laneCenters: activeLaneCenters,
            eventIndex: g.eventIndex,
            timelineLength: g.definition.timeline.length,
            pendingSpawnCount: g.enemySpawn.pending.length,
          });
          const beforeTransitions = g.stageMission.transitions.length;
          const nextMission = advanceStationMissionRuntime({
            runtime: g.stageMission,
            missionType: g.definition.missionType,
            config: g.definition.missionConfig,
            seconds: dt,
            battleElapsedSeconds: Math.max(0, g.time - g.definition.prepSeconds),
            humanCount: spatial.humanCount,
            baseHp: g.baseHp,
            escortCount: spatial.escortCount,
            nearbyThreats: spatial.nearbyThreats,
            contaminated: spatial.contaminated,
            powerOperatorCount: spatial.powerOperatorCount,
            powerLaneThreats: spatial.powerLaneThreats,
            gateEaterSeen: spatial.gateEaterSeen,
            gateEaterDefeated: spatial.gateEaterDefeated,
            gateEaterContained: spatial.gateEaterContained,
            researchContainerExposed: spatial.researchContainerExposed,
            researchContainerContained: spatial.researchContainerContained,
            returnedCount: spatial.returnedCount,
            returnTargetCount: spatial.returnTargetCount,
            activeUnitIds: spatial.activeUnitIds,
            returnedUnitIds: spatial.returnedUnitIds,
            escapeRouteThreats: spatial.escapeRouteThreats,
            wavesResolved: spatial.wavesResolved,
          }) as StageMissionRuntime;
          if (nextMission.transitions.length > beforeTransitions) {
            const transition = nextMission.transitions.at(-1) ?? "";
            if (transition && !g.signalIds.includes(transition)) g.signalIds.push(transition);
            if (transition === "escort-contaminated"
              && !g.signalIds.includes(STORY_BATTLE_TRIGGER_IDS.CART_STALLED)) {
              g.signalIds.push(STORY_BATTLE_TRIGGER_IDS.CART_STALLED);
            }
            if (transition.startsWith("power-")) {
              g.stationMetrics.powerActivations += 1;
              g.banner = `電源 ${nextMission.powerActivated ?? 0}/3 起動`;
              g.bannerTime = 1.4;
              playProductionCue(STATION_AUDIO_CUE_IDS.POWER_SWITCH, W * .68, { priority: 84, maxInstances: 2 });
            } else if (transition === "escort-contaminated") {
              playProductionCue(STATION_AUDIO_CUE_IDS.CART_STALL, Number(spatial.cartX ?? W / 2), { priority: 82, maxInstances: 1 });
            } else if (transition === "escort-complete") {
              g.stationMetrics.escortCompletions += 1;
              playProductionCue(STATION_AUDIO_CUE_IDS.RESCUE_CONFIRM, Number(spatial.cartX ?? W / 2), { priority: 72, maxInstances: 1 });
            } else if (transition === "return-window-open") {
              g.banner = "退路 45秒 // 全員戻れ";
              g.bannerTime = 2;
              playProductionCue(STATION_AUDIO_CUE_IDS.RETURN_MARKER, W * .72, { priority: 80, maxInstances: 1 });
            } else if (transition === "return-complete") {
              g.stationMetrics.sealCompletions += 1;
              g.banner = "全員帰還 // 封鎖扉閉鎖";
              g.bannerTime = 2;
              const sealDoorX = Number(g.definition.missionConfig.sealDoorX ?? W * .9);
              playProductionCue(STATION_AUDIO_CUE_IDS.SEAL_ENGAGE, sealDoorX, { priority: 98, maxInstances: 1 });
              playProductionCue(STATION_AUDIO_CUE_IDS.MACHINE_STOP, sealDoorX, { priority: 90, maxInstances: 1 });
            }
          }
          g.stageMission = nextMission;
          if (g.definition.missionType === STATION_MISSION_TYPES.ESCORT) {
            g.convoyProgress = nextMission.progress ?? 0;
            g.civiliansEvacuated = Math.min(5, Math.floor((nextMission.progress ?? 0) * 5));
          }
        }
        g.energy = advanceCommand(g.energy, dt);
        g.bannerTime = Math.max(0, g.bannerTime - dt);
        g.flashOverlay = Math.max(0, g.flashOverlay - dt * 2.2);
        g.crawlerHitFlash = Math.max(0, g.crawlerHitFlash - dt);
        g.barricadeHitFlash = Math.max(0, g.barricadeHitFlash - dt);
        g.crawlerHitSfxCooldown = Math.max(0, g.crawlerHitSfxCooldown - dt);
        g.takuyaEntranceAudioRemaining = Math.max(0, g.takuyaEntranceAudioRemaining - dt);
        g.comboTime = Math.max(0, g.comboTime - dt);
        if (g.comboTime <= 0) g.combo = 0;
        for (const card of cards) g.deployCooldowns[card.kind] = Math.max(0, g.deployCooldowns[card.kind] - dt);
        const doorwayOccupied = g.fighters.some((fighter) => (
          fighter.side === "human"
          && fighter.spawnPortalId === "crawler-door"
          && fighter.gateEntering
          && fighter.hp > 0
        ));
        const crawlerDoorStep = advanceCrawlerDoorRuntime(g.crawlerDoor, dt, {
          queuedUnits: g.deployQueue.length,
          doorwayOccupied,
        });
        g.crawlerDoor = crawlerDoorStep.runtime;
        if (crawlerDoorStep.events.includes("warning")) {
          playProductionCue("support-pod-deploy", WORLD_GEOMETRY.crawler.doorX, {
            priority: 50,
            cooldownMs: 180,
            volume: .18,
            playbackRate: 1.22,
            maxInstances: 1,
          });
        }
        if (crawlerDoorStep.events.includes("opening") || crawlerDoorStep.events.includes("reopening")) {
          playProductionCue("support-pod-deploy", WORLD_GEOMETRY.crawler.doorX, {
            priority: 54,
            cooldownMs: 180,
            volume: .24,
            playbackRate: .72,
            maxInstances: 1,
          });
        }
        if (crawlerDoorStep.events.includes("closing")) {
          playProductionCue("support-pod-deploy", WORLD_GEOMETRY.crawler.doorX, {
            priority: 46,
            cooldownMs: 180,
            volume: .16,
            playbackRate: .58,
            maxInstances: 1,
          });
        }
        if (crawlerDoorStep.events.includes("launch")) {
          const kind = g.deployQueue.shift();
          if (kind) {
            const deployed = spawnHuman(g, kind, true);
            if (deployed) {
              const deploymentFighter = g.fighters[g.fighters.length - 1];
              const deploymentX = deploymentFighter?.x ?? WORLD_GEOMETRY.crawler.doorX;
              playProductionCue("support-pod-deploy", deploymentX, {
                priority: 58,
                cooldownMs: 90,
                volume: kind === "brute" ? .42 : .32,
                playbackRate: kind === "brute" ? .86 : 1.08,
                maxInstances: 1,
                fallbackCue: kind === "brute" ? "deploy-heavy" : "deploy-light",
              });
              const deployVoice = unitAudioCueFor(kind, "voice", "deploy") || humanVoiceCueForUnit(kind, "deploy");
              if (deployVoice) {
                playProductionCue(deployVoice, deploymentX, {
                  priority: 72,
                  cooldownMs: 400,
                  volume: kind === "crazy-king" || kind === "kumaverson" ? .94 : .8,
                  maxInstances: 1,
                });
              }
              emitBattleBarkOnce(g, `deploy:${kind}`, RANDOM_BATTLE_BARK_TRIGGER_IDS.DEPLOY, kind);
              if (kind === "crazy-king") {
                playProductionCue(unitAudioCueFor(kind, "weapon", "start"), MUSTER_X, { priority: 62, maxInstances: 1 });
                playProductionCue(BATTLE_AUDIO_LOOP_CONTRACTS.crazyKingChainsaw.cueId, W / 2, {
                  priority: 48,
                  cooldownMs: 0,
                  volume: .32,
                  instanceKey: BATTLE_AUDIO_LOOP_CONTRACTS.crazyKingChainsaw.instanceKey,
                  maxInstances: 1,
                });
              }
            }
          }
        }
        if (g.time < g.definition.prepSeconds && g.bannerTime <= .05) {
          g.banner = `出撃準備 // ${Math.max(1, Math.ceil(g.definition.prepSeconds - g.time))}`;
          g.bannerTime = .22;
        }

        const nextPhase = phaseForBattle(g.definition, g.time) as Game["phase"];
        if (nextPhase !== g.phase) {
          g.phase = nextPhase;
          g.banner = phaseBannerForBattle(g.definition, nextPhase);
          g.bannerTime = 3; g.flashOverlay = .15;
        }

        if (g.survivalRun && g.survivalRuntime) {
          g.survivalRun = {
            ...g.survivalRun,
            crawler: {
              ...g.survivalRun.crawler,
              hp: Math.max(0, Math.min(g.survivalRun.crawler.maxHp, Math.round(g.baseHp))),
            },
          };
          const activeSurvivalEnemies = g.fighters.filter((fighter) => (
            fighter.side === "zombie"
            && fighter.hp > 0
            && fighter.contained !== true
          ));
          const survivalBoss = activeSurvivalEnemies.find((fighter) => isBossEnemyKind(fighter.kind));
          const survivalStep = advanceSurvivalCombat(g.survivalRuntime, g.survivalRun, {
            seconds: dt,
            activeEnemyCount: activeSurvivalEnemies.length,
            pendingSpawnCount: g.enemySpawn.pending.length,
            totalKills: g.kills,
            crawlerHp: g.baseHp,
            bossCombatReady: Boolean(survivalBoss?.combatReady),
            livingHumanCount: g.fighters.filter((fighter) => fighter.side === "human" && fighter.hp > 0).length,
            queuedHumanCount: g.deployQueue.length,
            combatStats: {
              ...g.combatMetrics,
              encounteredEnemyKinds: g.enemyKindsSeen,
            },
          });
          if (survivalStep.run && survivalStep.runtime) {
            g.survivalRun = survivalStep.run;
            g.survivalRuntime = survivalStep.runtime;
            g.wave = survivalStep.run.currentWave;
            g.baseHp = survivalStep.run.crawler.hp;
            g.baseMaxHp = survivalStep.run.crawler.maxHp;
          }
          for (const event of survivalStep.events) {
            if (event.type === "queue-wave") {
              const firstNewEntryId = g.enemySpawn.nextEntryId;
              g.enemySpawn = (enqueueEnemyWave as unknown as (runtime: EnemySpawnRuntime, input: { units: string[]; wave: number }) => EnemySpawnRuntime)(
                g.enemySpawn,
                { units: [...event.plan.units], wave: event.plan.wave },
              );
              g.enemySpawn.pending = g.enemySpawn.pending.map((entry) => {
                if (entry.entryId < firstNewEntryId) return entry;
                const portal = enemySpawnPortalPoint({
                  stageId: g.definition.stageId,
                  viewport: activeStageViewportId,
                  entryId: entry.entryId,
                  kind: entry.kind,
                  missionType: "survival",
                });
                return { ...entry, ...portal, lane: portal.legacyLane as Lane };
              });
              g.banner = `WAVE ${event.plan.wave}`;
              g.bannerTime = 1.8;
              playCue("wave-contact");
              emitBattleBark(g, "wave-contact", "guide", `survival-wave-${event.plan.wave}`);
            } else if (event.type === "boss-warning") {
              announceBossEntrance(g, event.bossKind);
            } else if (event.type === "boss-combat-ready") {
              g.banner = "BOSS COMBAT READY";
              g.bannerTime = 1.6;
            } else if (event.type === "checkpoint" && g.survivalRun) {
              const checkpointId = `survival:${g.survivalRun.runId}:wave:${event.completedWave}`;
              if (g.survivalCheckpointReceipt !== checkpointId) {
                g.survivalRun = {
                  ...g.survivalRun,
                  manualAbilityCooldownsByKind: snapshotManualAbilityCooldowns(g.fighters),
                };
                g.survivalCheckpointReceipt = checkpointId;
                g.paused = true;
                setPaused(true);
                setPendingSurvivalCheckpoint({ run: g.survivalRun, checkpointId });
              }
            }
          }
          const survivalEndReason = survivalStep.terminalReason
            ?? survivalCombatEndReason(g.survivalRuntime, g.survivalRun, {
              crawlerHp: g.baseHp,
            });
          if (survivalEndReason) {
            const endedAt = new Date().toISOString();
            const recordedRun = captureUnfinishedSurvivalCombatStats(
              g.survivalRuntime,
              g.survivalRun,
              {
                totalKills: g.kills,
                combatStats: {
                  ...g.combatMetrics,
                  encounteredEnemyKinds: g.enemyKindsSeen,
                },
                updatedAt: endedAt,
              },
            );
            const endedRun = endSurvivalRun(recordedRun, survivalEndReason, endedAt);
            if (endedRun) {
              g.survivalRun = endedRun;
              g.over = true;
              g.paused = true;
              setPaused(true);
              setPendingSurvivalCheckpoint(null);
              setSurvivalSettlementAwaitingRetry(false);
              setPendingSurvivalSettlement({ run: endedRun, endedAt });
              chooseAction(null);
              stopMusic();
              stopSfx();
              playCue("defeat");
            }
          }
        } else {
          while (g.eventIndex < g.definition.timeline.length && g.time >= g.definition.timeline[g.eventIndex].at) {
            const mission = g.definition.timeline[g.eventIndex++] as MissionEvent;
            const bossAlive = g.fighters.some((fighter) => isBossEnemyKind(fighter.kind) && fighter.hp > 0);
            if (mission.bossOnly && !bossAlive) continue;
            g.wave = mission.wave; g.banner = mission.label; g.bannerTime = mission.label.includes("TAKUYA") ? 3.2 : 2.1;
            if (mission.label.includes("警告")) g.flashOverlay = .12;
            const firstNewEntryId = g.enemySpawn.nextEntryId;
            g.enemySpawn = (enqueueEnemyWave as unknown as (runtime: EnemySpawnRuntime, input: { units: string[]; wave: number }) => EnemySpawnRuntime)(g.enemySpawn, { units: mission.units, wave: mission.wave });
            g.enemySpawn.pending = g.enemySpawn.pending.map((entry) => {
              if (entry.entryId < firstNewEntryId) return entry;
              const portal = enemySpawnPortalPoint({
                stageId: g.definition.stageId,
                viewport: activeStageViewportId,
                entryId: entry.entryId,
                kind: entry.kind,
                missionType: g.definition.missionType,
              });
              return {
                ...entry,
                ...portal,
                lane: portal.legacyLane as Lane,
              };
            });
            if (mission.units.length) {
              const incomingBossKind = mission.units.find((kind) => isBossEnemyKind(kind)) ?? null;
              if (incomingBossKind) {
                announceBossEntrance(g, incomingBossKind, {
                  activateTakuyaScene: incomingBossKind === "takuya",
                });
              } else {
                playCue("wave-contact");
                emitBattleBark(g, "wave-contact", "guide", `wave-${mission.wave}`);
              }
            }
          }
        }

        const enemySpawnStep = advanceEnemySpawnRuntime(g.enemySpawn, dt, g.paused);
        g.enemySpawn = enemySpawnStep.runtime as EnemySpawnRuntime;
        for (const entry of enemySpawnStep.spawned as EnemySpawnEntry[]) spawnEnemy(g, entry.kind, entry.lane, entry.order, entry);

        const airstrikeStep = advanceEmergencySupportRuntime(g.airstrike, dt);
        g.airstrike = airstrikeStep.runtime as AirstrikeRuntime;
        if (airstrikeStep.events.includes("targeting")) playCue("airstrike-targeting");
        if (airstrikeStep.events.includes("inbound")) playCue("airstrike-inbound");
        if (airstrikeStep.events.includes("impact")) {
          const impact = resolveAirstrikeImpact({ runtime: g.airstrike, fighters: g.fighters, laneCenters: activeLaneCenters });
          g.airstrike = impact.runtime as AirstrikeRuntime;
          g.fighters = impact.fighters as Fighter[];
          for (const hit of impact.hits) {
            const fighter = g.fighters.find((candidate) => candidate.id === hit.id);
            if (fighter) { fighter.flash = .2; fighter.knock = Math.max(fighter.knock, 18); addDamageText(g, { x: fighter.x, y: fighter.y - 54, value: `航空 -${hit.damage}`, life: .85, color: "#fff0a0" }); }
          }
          addParticles(
            g,
            g.airstrike.targetX ?? W / 2,
            Number.isFinite(g.airstrike.targetY) ? g.airstrike.targetY as number : activeLaneCenters[g.airstrike.targetLane ?? 1],
            "#f28d46",
            34,
          );
          g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.airstrikeImpact); g.flashOverlay = .4; playCue("airstrike-impact");
        }
        if (airstrikeStep.events.includes("returning")) playCue("airstrike-return");
        if (airstrikeStep.events.includes("complete")) { g.banner = "航空支援帰投"; g.bannerTime = .75; }

        const crawlerStep = advanceCrawlerAbilityRuntime(g.crawlerAbility, dt);
        g.crawlerAbility = crawlerStep.runtime as CrawlerRuntime;
        if (crawlerStep.events.includes("fire")) {
          const barrage = resolveCrawlerBarrage({ runtime: g.crawlerAbility, fighters: g.fighters });
          g.crawlerAbility = barrage.runtime as CrawlerRuntime;
          g.fighters = barrage.fighters as Fighter[];
          const visualHitsByLane = [0, 0, 0];
          for (const hit of barrage.hits) {
            const fighter = g.fighters.find((candidate) => candidate.id === hit.id);
            if (fighter) {
              fighter.flash = .16;
              addDamageText(g, { x: fighter.x, y: fighter.y - 48, value: `掃射 -${hit.damage}`, life: .75, color: "#ffd36d" });
              addParticles(g, fighter.x, fighter.y - 22, "#e8b354", 5);
              if (visualHitsByLane[fighter.lane] < 3) {
                visualHitsByLane[fighter.lane] += 1;
                g.shots.push({
                  x: WORLD_GEOMETRY.crawler.weaponX + 45,
                  y: WORLD_GEOMETRY.crawler.weaponY - 18,
                  tx: fighter.x,
                  ty: fighter.y - 24,
                  life: .32 + visualHitsByLane[fighter.lane] * .035,
                  duration: .36,
                  side: "human",
                  style: "crawler",
                  weapon: "crawler",
                });
              }
            }
          }
          g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.crawlerBarrage); g.flashOverlay = .14; playCue("crawler-barrage");
        }

        for (const object of g.battlefieldObjects) {
          object.hitFlash = Math.max(0, object.hitFlash - dt);
          Object.assign(object, advanceBattlefieldSupply(object, dt));
          if (object.kind === "pod" && object.readyToLand && !object.landingTriggered) {
            const hpBeforeLanding = new Map(g.fighters.map((fighter) => [fighter.id, fighter.hp]));
            const landing = resolveBattlefieldSupplyLanding({ supply: object, fighters: g.fighters, laneCenters: activeLaneCenters });
            Object.assign(object, landing.supply);
            g.fighters = landing.fighters as Fighter[];
            for (const hit of landing.hits) {
              const fighter = g.fighters.find((candidate) => candidate.id === hit.id);
              if (fighter) {
                let appliedDamage = hit.damage;
                if (hit.side === "human") {
                  fighter.hp = hpBeforeLanding.get(fighter.id) ?? fighter.hp;
                  appliedDamage = applyIncomingHumanDamage(g, fighter, hit.damage, { attackKind: "ranged" }).targetDamage;
                }
                fighter.flash = .2;
                fighter.knock = Math.max(fighter.knock, 10);
                addDamageText(g, { x: fighter.x, y: fighter.y - 56, value: `着地 -${Math.round(appliedDamage)}`, life: .9, color: hit.side === "zombie" ? "#ffd06b" : "#ff8a70" });
              }
            }
            addParticles(g, object.x, object.y + 4, "#d7aa63", 26);
            g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.podLanding); g.flashOverlay = Math.max(g.flashOverlay, .12); playCue("pod-impact");
          }
          if (object.kind === "drum" && object.phase === "detonating" && !object.detonationTriggered) {
            const detonation = resolveDrumDetonation({ supply: object, fighters: g.fighters, areaEffects: g.areaEffects, nextAreaEffectId: g.nextAreaEffectId, laneCenters: activeLaneCenters });
            Object.assign(object, detonation.supply);
            g.fighters = detonation.fighters as Fighter[];
            g.areaEffects = detonation.areaEffects as AreaEffect[];
            g.nextAreaEffectId = detonation.nextAreaEffectId;
            for (const hit of detonation.hits) {
              const fighter = g.fighters.find((candidate) => candidate.id === hit.id);
              if (fighter) { fighter.flash = .18; fighter.knock = Math.max(fighter.knock, 13); addDamageText(g, { x: fighter.x, y: fighter.y - 52, value: `爆発 -${hit.damage}`, life: .82, color: "#ffbd59" }); }
            }
            addParticles(g, object.x, object.y - 8, "#f26a35", 28); g.flashOverlay = Math.max(g.flashOverlay, .23); playCue("drum-blast"); playCue("burn-start");
          }
        }
        g.battlefieldObjects = g.battlefieldObjects.filter((object) => object.phase !== "expired");
        const activeMedicalIds = g.battlefieldObjects.filter((object) => object.kind === "medical" && object.phase === "active" && object.hp > 0).map((object) => object.id);
        const areaStep = advanceAreaEffects({ areaEffects: g.areaEffects, fighters: g.fighters, seconds: dt, activeSupplyIds: activeMedicalIds });
        g.areaEffects = retainActiveAreaEffects(areaStep.areaEffects) as AreaEffect[];
        g.fighters = areaStep.fighters as Fighter[];
        if (areaStep.changes.some((change) => change.kind === "healing")) playCue("medical-heal");
        for (const fighter of g.fighters) {
          if (fighter.side === "human" && fighter.hp > 0) fighter.slowMultiplier = 1;
        }
        const hazardFrame = advanceLeakMudHazards({
          hazards: g.stationHazards,
          entities: g.fighters,
          elapsedSeconds: dt,
        }) as {
          zones: readonly StationHazard[];
          effects: readonly { targetId: number; damage: number; speedMultiplier: number }[];
          slowEffects: readonly { targetId: string; speedMultiplier: number }[];
        };
        g.stationHazards = [...hazardFrame.zones];
        for (const effect of hazardFrame.effects) {
          const target = g.fighters.find((fighter) => fighter.id === effect.targetId && fighter.side === "human" && fighter.hp > 0);
          if (!target) continue;
          const damage = applyIncomingHumanDamage(g, target, effect.damage, { attackKind: "ranged" }).targetDamage;
          target.flash = Math.max(target.flash, .12);
          target.slowMultiplier = Math.min(target.slowMultiplier ?? 1, effect.speedMultiplier);
          addDamageText(g, { x: target.x, y: target.y - 52, value: `汚染 -${Math.round(damage)}`, life: .72, color: "#a9bf70" });
        }
        for (const slow of hazardFrame.slowEffects) {
          const fighter = g.fighters.find((candidate) => String(candidate.id) === slow.targetId
            && candidate.side === "human"
            && candidate.hp > 0);
          if (fighter) fighter.slowMultiplier = Math.min(fighter.slowMultiplier ?? 1, slow.speedMultiplier);
        }

        const fighterById = new Map(g.fighters.filter((fighter) => fighter.hp > 0 && fighter.combatReady).map((fighter) => [fighter.id, fighter]));
        const crawlerAttackThreatIds = new Set(g.fighters
          .filter((fighter) => fighter.side === "zombie" && fighter.hp > 0 && fighter.combatReady)
          .filter((enemy) => {
            const blockingObject = selectBlockingContainer({
              enemyX: enemy.x,
              enemyY: enemy.y,
              enemyRadius: enemy.bodyRadius,
              objects: g.battlefieldObjects,
            }) as BattlefieldObject | undefined;
            return isCrawlerAttackThreat({
              enemyX: enemy.x,
              enemyRange: enemy.range,
              baseX: BASE_X,
              blockingObject,
              combatReady: enemy.combatReady,
              hp: enemy.hp,
              contained: enemy.contained,
            });
          })
          .map((fighter) => fighter.id));
        const targetClaims = new Map<number, number>();
        const interceptorClaims = new Map<number, number>();
        for (const fighter of g.fighters) {
          if (fighter.hp <= 0 || !fighter.combatReady || fighter.targetId === null) continue;
          const claimed = fighterById.get(fighter.targetId);
          if (fighter.side === "human" && claimed?.side === "zombie" && claimed.hp > 0) {
            const countsAsClaim = !crawlerAttackThreatIds.has(claimed.id)
              || isEffectiveCrawlerDefenseClaim({
                fighterTargetId: fighter.targetId,
                fighterDefenseTargetId: fighter.crawlerDefenseTargetId,
                fighterHp: fighter.hp,
                fighterCombatReady: fighter.combatReady,
                fighterX: fighter.x,
                fighterY: fighter.y,
                fighterRange: fighter.range,
                targetId: claimed.id,
                targetHp: claimed.hp,
                targetCombatReady: claimed.combatReady,
                targetX: claimed.x,
                targetY: claimed.y,
                targetBodyRadius: claimed.bodyRadius,
                canEngage: canAcquireCombatTarget({
                  attacker: fighter,
                  target: claimed,
                  hasLineOfSight: (attacker, candidate) => hasBattleSpaceLineOfSight(
                    g,
                    attacker as Fighter,
                    candidate as Fighter,
                  ),
                }),
              });
            if (countsAsClaim) targetClaims.set(claimed.id, (targetClaims.get(claimed.id) ?? 0) + 1);
          } else if (fighter.side === "zombie" && claimed?.side === "human" && claimed.hp > 0) {
            interceptorClaims.set(claimed.id, (interceptorClaims.get(claimed.id) ?? 0) + 1);
          }
        }

        const lanePlan = planHumanLaneAssignments({
          units: g.fighters
            .filter((fighter) => fighter.side === "human" && fighter.hp > 0 && fighter.combatReady)
            .map((fighter) => {
              const currentTarget = fighter.targetId === null ? null : fighterById.get(fighter.targetId);
              const locallyEngaged = Boolean(currentTarget
                && currentTarget.side === "zombie"
                && fighterDistance(fighter, currentTarget) <= fighter.range + currentTarget.bodyRadius + 24);
              return {
                id: fighter.id,
                hp: fighter.hp,
                lane: fighter.lane,
                assignedLane: fighter.anchorLane,
                y: fighter.y,
                laneSpeed: fighter.laneSpeed,
                targetId: locallyEngaged ? fighter.targetId : null,
                targetObjectId: fighter.targetObjectId,
                nextLaneDecisionAt: fighter.nextLaneDecisionAt,
              };
            }),
          threats: g.fighters
            .filter((fighter) => fighter.side === "zombie" && fighter.hp > 0 && fighter.combatReady)
            .map((fighter) => ({
              lane: fighter.lane,
              anchorLane: fighter.anchorLane,
              hp: fighter.hp,
              critical: fighter.x <= BASE_X + 155,
              imminent: fighter.x <= BASE_X + 330,
            })),
          now: g.time,
          nextPlanAt: g.nextLanePlanAt,
          laneCenters: activeLaneCenters,
        });
        g.nextLanePlanAt = lanePlan.nextPlanAt;
        for (const assignment of lanePlan.assignments) {
          const fighter = fighterById.get(Number(assignment.id));
          if (!fighter || fighter.side !== "human") continue;
          fighter.anchorLane = assignment.lane as Lane;
          fighter.nextLaneDecisionAt = assignment.nextLaneDecisionAt;
        }

        const movementStageGeometry = stageGeometryFor(g.definition.stageId, activeStageViewportId);
        for (const f of g.fighters) {
          if (g.definition.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL
            && f.kind === "gate-eater") {
            Object.assign(f, enforceGateEaterContainmentInvariant(f));
          }
          if (f.kind === "mayo-chan" && f.mayoRetreat) {
            const retreatStep = advanceMayoRetreat(f.mayoRetreat, dt, {
              x: f.x,
              baseX: BASE_X + 18,
            });
            f.mayoRetreat = retreatStep.runtime as Fighter["mayoRetreat"];
            f.x = retreatStep.x;
            f.y += Math.sign(activeMusterY() - f.y) * Math.min(Math.abs(activeMusterY() - f.y), 90 * dt);
            f.aiMoveDirection = f.mayoRetreat?.phase === "run" ? -1 : 0;
            f.step += dt;
            continue;
          }
          if (f.hp <= 0) continue;
          f.mayoBiteSlowRemaining = Math.max(0, (f.mayoBiteSlowRemaining ?? 0) - dt);
          f.visionDisruptedRemaining = Math.max(0, (f.visionDisruptedRemaining ?? 0) - dt);
          const mayoFeralMultiplier = f.kind === "mayo-chan" && f.manualAbility?.phase === "feral"
            ? MANUAL_ABILITY_REGISTRY["mayo-chan"].moveSpeedMultiplier
            : 1;
          const manualMovementMultiplier = f.kind === "crazy-king" && f.manualAbility?.phase === "active"
            ? MANUAL_ABILITY_REGISTRY["crazy-king"].moveSpeedMultiplier
            : f.kind === "guardian" && f.manualAbility?.phase === "active"
              ? 0
              : 1;
          const mayoBiteSlowMultiplier = (f.mayoBiteSlowRemaining ?? 0) > 0
            ? MANUAL_ABILITY_REGISTRY["mayo-chan"].biteSlowMultiplier
            : 1;
          const movementStartX = f.x;
          const humanMovementSpeed = f.side === "human"
            ? stationHumanMoveSpeed({
              baseSpeed: f.speed * mayoFeralMultiplier * manualMovementMultiplier,
              slowMultiplier: f.slowMultiplier ?? 1,
              runtime: g.stageMission,
              missionType: g.definition.missionType,
              config: g.definition.missionConfig,
            })
            : f.speed * mayoBiteSlowMultiplier;
          const humanLaneSpeed = f.side === "human"
            ? stationHumanMoveSpeed({
              baseSpeed: f.laneSpeed * mayoFeralMultiplier * manualMovementMultiplier,
              slowMultiplier: f.slowMultiplier ?? 1,
              runtime: g.stageMission,
              missionType: g.definition.missionType,
              config: g.definition.missionConfig,
            })
            : f.laneSpeed * mayoBiteSlowMultiplier;
          f.cooldown = advanceAttackCooldown(f.cooldown, dt); f.supportCooldown -= dt; f.retargetIn = Math.max(0, f.retargetIn - dt); f.spawnGrace = Math.max(0, f.spawnGrace - dt);
          f.flash = Math.max(0, f.flash - dt); f.attack = Math.max(0, f.attack - dt); f.marked = Math.max(0, f.marked - dt); f.step += dt;
          f.stunned = Math.max(0, f.stunned - dt);
          f.damageReductionRemaining = advanceNaoProtection(f.damageReductionRemaining, dt);
          if (f.damageReductionRemaining <= 0) f.damageReductionMultiplier = 1;
          f.healFocusRemaining = Math.max(0, f.healFocusRemaining - dt);
          if (f.healFocusRemaining <= 0) f.healFocusTargetId = null;
          f.comboWindow = Math.max(0, f.comboWindow - dt);
          if (f.comboWindow <= 0) f.comboHits = 0;
          if (f.kind === "gunner") {
            const heat = coolRaiderHeat({ heat: f.weaponHeat, overheated: f.overheated }, dt);
            f.weaponHeat = heat.heat;
            f.overheated = heat.overheated;
          }
          const suppression = advanceRaiderSuppression({
            stacks: f.suppressionStacks,
            remainingSeconds: f.suppressedRemaining,
          }, dt);
          f.suppressionStacks = suppression.stacks;
          f.suppressedRemaining = suppression.remainingSeconds;
          f.suppressionMultiplier = suppression.speedMultiplier;
          f.guardStandRemaining = Math.max(0, f.guardStandRemaining - dt);
          f.engineerTrapCooldown = Math.max(0, f.engineerTrapCooldown - dt);
          f.armorBrokenRemaining = Math.max(0, f.armorBrokenRemaining - dt);
          if (f.armorBrokenRemaining <= 0) f.armorBreakStacks = 0;
          if (f.kind === "kumaverson" && f.manualAbility?.phase === "active") {
            const hpBeforeHealing = f.hp;
            f.hp = Math.min(
              f.maxHp,
              f.hp + f.maxHp * MANUAL_ABILITY_REGISTRY.kumaverson.healRatioPerSecond * dt,
            );
            recordUnitHealing(g, f.kind, Math.max(0, f.hp - hpBeforeHealing));
          }
          if (f.bleedRemaining > 0) {
            Object.assign(f, advanceBleedDamage(f, dt));
            if (f.hp <= 0) continue;
          }
          f.abilityCooldown = Math.max(0, f.abilityCooldown - dt);
          if (f.contained) {
            f.targetId = null;
            f.targetObjectId = null;
            f.knock = 0;
            continue;
          }
          if (Math.abs(f.knock) > .1) {
            const knockResistance = f.kind === "crazy-king" && f.manualAbility?.phase === "active"
              ? MANUAL_ABILITY_REGISTRY["crazy-king"].knockResistanceMultiplier
              : 1;
            f.x += (f.side === "human" ? -1 : 1) * f.knock * knockResistance * dt * 6;
            f.knock *= .9;
          }

          if (f.gateEntering) {
            f.targetId = null;
            f.targetObjectId = null;
            const previousX = f.x;
            const previousY = f.y;
            const rampPending = f.side === "human"
              && f.entryRampCleared !== true
              && Number.isFinite(f.entryRampX)
              && Number.isFinite(f.entryRampY)
              ;
            const targetX = rampPending ? (f.entryRampX ?? f.combatReadyX) : f.combatReadyX;
            const targetY = rampPending
              ? (f.entryRampY ?? f.combatReadyY ?? f.y)
              : (f.combatReadyY ?? activeLaneCenters[f.navigationRecovery.recoveryLane ?? f.anchorLane ?? f.lane]);
            const entryDx = targetX - f.x;
            const entryDy = targetY - f.y;
            const entryDistance = Math.hypot(entryDx, entryDy);
            const entryStep = Math.min(entryDistance, f.gateEntrySpeed * dt);
            f.aiMoveDirection = Math.sign(entryDx) || f.entryDirection || 1;
            if (entryDistance > .001) {
              f.x += entryDx / entryDistance * entryStep;
              f.y += entryDy / entryDistance * entryStep;
            }
            if (f.side === "human") {
              f.entryStepDistance = (f.entryStepDistance ?? 0) + Math.hypot(f.x - previousX, f.y - previousY);
              if (f.entryStepDistance >= 18) {
                f.entryStepDistance %= 18;
                g.crawlerFootstepCount += 1;
                playProductionCue("weapon-melee-impact", f.x, {
                  priority: 44,
                  cooldownMs: 40,
                  volume: f.kind === "brute" || f.kind === "guardian" ? .24 : .16,
                  playbackRate: f.kind === "brute" || f.kind === "guardian" ? .78 : 1.24,
                  maxInstances: 2,
                });
              }
            }
            const reachedEntryPoint = entryDistance <= entryStep + .01;
            if (reachedEntryPoint && rampPending) {
              f.x = targetX;
              f.y = targetY;
              f.entryRampCleared = true;
            } else if (reachedEntryPoint) {
              f.x = f.combatReadyX;
              f.y = targetY;
              f.gateEntering = false;
              f.combatReady = true;
              f.cooldown = Math.max(f.cooldown, .18);
            }
            continue;
          }

          // A newly turned survivor is targetable during the rise animation,
          // but cannot move, retarget, or attack until the lifecycle lock ends.
          if (f.kind === "turned" && f.spawnGrace > 0) {
            f.targetId = null;
            f.targetObjectId = null;
            continue;
          }

          if (f.stunned > 0) {
            f.targetId = null;
            f.targetObjectId = null;
            if ((["grappler", "ooze", "sprinter", "gate-eater", "kurome"].includes(f.kind)
              || isBossAnomalyKind(f.kind)
              || isV090InfectedKind(f.kind))
              && f.stationAbility.phase !== "idle") {
              f.stationAbility = createStationAbilityRuntime(f.kind);
              f.abilityCooldown = Math.max(f.abilityCooldown, 1.8);
            }
            continue;
          }

          if (f.side === "human" && manualAbilityLocksNormalAction(f.manualAbility)) {
            f.targetId = null;
            f.targetObjectId = null;
            f.aiDestinationX = f.x;
            f.aiMoveDirection = 0;
            continue;
          }

          if (f.kind === "grappler") {
            let abilityFrame = f.stationAbility.phase !== "idle";
            if (f.stationAbility.phase === "windup") {
              f.stationAbility = advanceKaramiteWindup(f.stationAbility, dt) as StationAbilityRuntime;
            }
            if (f.stationAbility.phase === "ready") {
              const victim = g.fighters.find((candidate) => candidate.side === "human"
                && String(candidate.id) === String(f.stationAbility.targetId));
              const bind = resolveKaramiteBind({ runtime: f.stationAbility, attacker: f, target: victim });
              f.stationAbility = bind.runtime as StationAbilityRuntime;
              if (bind.bound && victim) {
                g.stationMetrics.karamiteBinds += 1;
                if (!g.signalIds.includes(STORY_BATTLE_TRIGGER_IDS.GRAPPLER_GRAB)) {
                  g.signalIds.push(STORY_BATTLE_TRIGGER_IDS.GRAPPLER_GRAB);
                }
                addDamageText(g, { x: victim.x, y: victim.y - 64, value: "拘束", life: .9, color: "#d98f6f" });
              } else {
                f.abilityCooldown = Math.max(f.abilityCooldown, 2);
              }
            }
            if (f.stationAbility.phase === "pulling") {
              const victim = g.fighters.find((candidate) => candidate.side === "human"
                && String(candidate.id) === String(f.stationAbility.targetId));
              const pull = advanceKaramitePull({
                runtime: f.stationAbility,
                attacker: f,
                target: victim,
                elapsedSeconds: dt,
              });
              f.stationAbility = pull.runtime as StationAbilityRuntime;
              if (victim && pull.bound) {
                victim.x = Math.max(BASE_X + 34, Math.min(BARRICADE_X, pull.target.x));
                victim.stunned = Math.max(victim.stunned, .08);
              }
              if (!pull.bound) f.abilityCooldown = Math.max(f.abilityCooldown, 6);
            }
            if (f.stationAbility.phase === "idle" && f.abilityCooldown <= 0) {
              const victim = selectKaramiteTarget({
                attacker: f,
                candidates: g.fighters,
              }) as Fighter | null;
              const windup = beginKaramiteWindup({ attacker: f, target: victim });
              if (windup.ok) {
                f.stationAbility = windup.runtime as StationAbilityRuntime;
                abilityFrame = true;
                g.banner = "絡手 // 拘束予告";
                g.bannerTime = Math.max(g.bannerTime, .75);
              }
            }
            if (abilityFrame || f.stationAbility.phase !== "idle") continue;
          }

          if (f.kind === "ooze") {
            let abilityFrame = f.stationAbility.phase !== "idle";
            if (f.stationAbility.phase === "windup") {
              f.stationAbility = advanceLeakMudWindup(f.stationAbility, dt) as StationAbilityRuntime;
            }
            if (f.stationAbility.phase === "ready") {
              const resolved = resolveLeakMudZone(f.stationAbility);
              f.stationAbility = resolved.runtime as StationAbilityRuntime;
              if (resolved.created && resolved.zone) {
                g.stationHazards.push(resolved.zone as StationHazard);
                g.stationMetrics.leakMudZones += 1;
                f.abilityCooldown = 7.5;
                addDamageText(g, { x: resolved.zone.centerX, y: resolved.zone.centerY - 18, value: "床汚染", life: .9, color: "#a9bf70" });
              }
            }
            if (f.stationAbility.phase === "idle" && f.abilityCooldown <= 0) {
              const victim = g.fighters
                .filter((candidate) => candidate.side === "human" && candidate.hp > 0 && candidate.combatReady
                  && (candidate.anchorLane ?? candidate.lane) === (f.anchorLane ?? f.lane)
                  && Math.abs(candidate.x - f.x) <= 210)
                .sort((left, right) => Math.abs(left.x - f.x) - Math.abs(right.x - f.x))[0];
              if (victim) {
                const windup = beginLeakMudWindup({
                  source: f,
                  zoneId: `leak-mud-${f.id}-${Math.floor(g.time * 10)}`,
                  lane: f.anchorLane ?? f.lane,
                  centerX: victim.x,
                  centerY: activeLaneCenters[f.anchorLane ?? f.lane],
                });
                if (windup.ok) {
                  f.stationAbility = windup.runtime as StationAbilityRuntime;
                  abilityFrame = true;
                  g.banner = "漏泥 // 床汚染予告";
                  g.bannerTime = Math.max(g.bannerTime, .8);
                }
              }
            }
            if (abilityFrame || f.stationAbility.phase !== "idle") continue;
          }

          if (f.kind === "sprinter") {
            if (f.stationAbility.phase === "idle" && f.abilityCooldown <= 0) {
              const started = beginSoukiBurst({ runner: f });
              if (started.ok) {
                f.stationAbility = started.runtime as StationAbilityRuntime;
                g.banner = "走鬼 // 後方侵入予告";
                g.bannerTime = Math.max(g.bannerTime, .62);
              }
            }
            if (f.stationAbility.phase !== "idle") {
              const beforeX = f.x;
              const burst = advanceSoukiBurst({
                runtime: f.stationAbility,
                runner: f,
                elapsedSeconds: dt,
                crawlerRearBoundaryX: BASE_X + 28,
              });
              f.stationAbility = burst.runtime as StationAbilityRuntime;
              const physicalFloor = g.fighters
                .filter((candidate) => candidate.side === "human" && candidate.hp > 0
                  && (candidate.anchorLane ?? candidate.lane) === (f.anchorLane ?? f.lane)
                  && candidate.x <= beforeX && candidate.x >= burst.runner.x - 4)
                .reduce((floor, candidate) => Math.max(floor, candidate.x + candidate.bodyRadius + f.bodyRadius), BASE_X + 28);
              f.x = Math.max(physicalFloor, burst.runner.x);
              f.lane = burst.runner.lane as Lane;
              f.anchorLane = f.lane;
              f.y = activeLaneCenters[f.lane];
              if (burst.burstStarted) g.stationMetrics.soukiBursts += 1;
              if (f.stationAbility.phase === "idle") f.abilityCooldown = 5.2;
              continue;
            }
          }

          if (isV090InfectedKind(f.kind)) {
            const definition = v090InfectedDefinition(f.kind);
            let abilityFrame = f.stationAbility.phase !== "idle";
            if (f.stationAbility.phase === "idle" && f.abilityCooldown <= 0) {
              const started = beginV090InfectedAbility({
                kind: f.kind,
                attacker: f,
                candidates: g.fighters,
              });
              if (started.ok) {
                f.stationAbility = started.runtime as StationAbilityRuntime;
                abilityFrame = true;
                g.banner = `${definition?.displayName ?? enemyContentFor(f.kind)?.displayName ?? "異形"} // ${
                  f.kind === "resonator"
                    ? "胸郭共鳴"
                    : f.kind === "cagewalker"
                      ? "骨檻展開"
                      : f.kind === "spindle"
                        ? "脊柱圧縮"
                        : f.kind === "choir-knot"
                          ? "擬声斉唱"
                          : f.kind === "pall-manta"
                            ? "皮膜展開"
                            : "五肢定着"
                }`;
                g.bannerTime = Math.max(g.bannerTime, Math.min(.86, definition?.warningSeconds ?? .7));
                playProductionCue(enemyVoiceCue(f.kind, "attack"), f.x, {
                  priority: 68,
                  cooldownMs: 140,
                  volume: .42,
                  playbackRate: f.kind === "spindle" ? 1.34 : f.kind === "cagewalker" ? .74 : .96,
                  fallbackCue: "melee-hit",
                });
              }
            }
            if (f.stationAbility.phase !== "idle") {
              const step = advanceV090InfectedAbility(f.stationAbility, dt);
              f.stationAbility = step.runtime as StationAbilityRuntime;
              if (step.events.includes("activate")) {
                if (f.kind === "resonator") {
                  const hitIds = resonatorHowlTargets({ attacker: f, candidates: g.fighters });
                  for (const victimId of hitIds) {
                    const victim = g.fighters.find((candidate) => String(candidate.id) === victimId);
                    if (!victim) continue;
                    const damage = applyIncomingHumanDamage(g, victim, 21, {
                      attackKind: "ranged",
                      attacker: f,
                    }).targetDamage;
                    victim.stunned = Math.max(victim.stunned, .34);
                    victim.knock = Math.max(victim.knock, 8);
                    addDamageText(g, {
                      x: victim.x,
                      y: victim.y - 56,
                      value: `共鳴 -${Math.round(damage)}`,
                      life: .82,
                      color: "#d79a86",
                    });
                  }
                  addParticles(g, f.x - 46, f.y - 38, "#896a62", 18);
                  g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.takuyaHeavy);
                } else if (f.kind === "cagewalker") {
                  for (const victim of g.fighters) {
                    if (victim.side !== "human" || victim.hp <= 0 || fighterDistance(victim, f) > 82) continue;
                    victim.x = Math.max(BASE_X + 32, victim.x - 24);
                    victim.knock = Math.max(victim.knock, 10);
                    victim.stunned = Math.max(victim.stunned, .22);
                  }
                  addParticles(g, f.x, f.y + 6, "#8e806b", 14);
                } else if (f.kind === "spindle") {
                  const victim = g.fighters.find((candidate) => (
                    String(candidate.id) === String(f.stationAbility.targetIds?.[0])
                    && candidate.side === "human"
                    && candidate.hp > 0
                  ));
                  const landing = spindleLandingPoint({
                    attacker: f,
                    target: victim,
                    minimumX: BASE_X + 48,
                    maximumX: BARRICADE_X - 12,
                  });
                  if (landing) {
                    f.x = landing.x;
                    f.y = landing.y;
                    f.lane = (victim?.anchorLane ?? victim?.lane ?? f.lane) as Lane;
                    f.anchorLane = f.lane;
                  }
                  for (const impacted of g.fighters) {
                    if (impacted.side !== "human" || impacted.hp <= 0 || fighterDistance(impacted, f) > 58) continue;
                    const damage = applyIncomingHumanDamage(g, impacted, 26, {
                      attackKind: "melee",
                      attacker: f,
                    }).targetDamage;
                    impacted.stunned = Math.max(impacted.stunned, .42);
                    addDamageText(g, {
                      x: impacted.x,
                      y: impacted.y - 50,
                      value: `着地 -${Math.round(damage)}`,
                      life: .78,
                      color: "#b9978e",
                    });
                  }
                  addParticles(g, f.x, f.y + 4, "#766a63", 22);
                  g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.takuyaHeavy);
                } else if (f.kind === "choir-knot") {
                  for (const victimId of f.stationAbility.targetIds ?? []) {
                    const victim = g.fighters.find((candidate) => (
                      String(candidate.id) === victimId
                      && candidate.side === "human"
                      && candidate.hp > 0
                    ));
                    if (!victim) continue;
                    victim.targetId = f.id;
                    victim.targetObjectId = null;
                    victim.retargetIn = Math.max(victim.retargetIn, 1.25);
                    addDamageText(g, {
                      x: victim.x,
                      y: victim.y - 60,
                      value: "擬声誘導",
                      life: .88,
                      color: "#c7a4ad",
                    });
                  }
                } else if (f.kind === "anchor-bloom") {
                  addParticles(g, f.x, f.y + 8, "#705552", 16);
                }
                playProductionCue("enemy-takuya-attack", f.x, {
                  priority: 74,
                  cooldownMs: 160,
                  volume: .5,
                  playbackRate: f.kind === "resonator" ? .66 : f.kind === "spindle" ? 1.42 : .88,
                  fallbackCue: "melee-hit",
                });
              }
              if (f.kind === "anchor-bloom" && f.stationAbility.phase === "active") {
                for (const targetId of f.stationAbility.targetIds ?? []) {
                  const target = g.fighters.find((candidate) => (
                    String(candidate.id) === targetId
                    && candidate.side === "zombie"
                    && candidate.hp > 0
                  ));
                  if (!target) continue;
                  const reinforcement = anchorBloomReinforcement({
                    phase: f.stationAbility.phase,
                    anchor: f,
                    target,
                  });
                  if (reinforcement.active) {
                    target.hp = Math.min(target.maxHp, target.hp + reinforcement.healingPerSecond * dt);
                  }
                }
              }
              if (step.events.includes("finish")) {
                f.abilityCooldown = definition?.cooldownSeconds ?? 7;
              }
              continue;
            }
            if (abilityFrame) continue;
          }

          if (f.kind === "mother") {
            let abilityFrame = f.stationAbility.phase !== "idle";
            if (f.stationAbility.phase !== "idle") {
              const step = advanceBossAnomalyAbility(f.stationAbility, dt);
              f.stationAbility = step.runtime as StationAbilityRuntime;
              if (step.events.includes("activate")) {
                const hitIds = bossAnomalyAreaTargetIds({
                  kind: "mother",
                  boss: f,
                  candidates: g.fighters,
                });
                for (const victimId of hitIds) {
                  const victim = g.fighters.find((candidate) => (
                    candidate.side === "human"
                    && String(candidate.id) === victimId
                  ));
                  if (!victim) continue;
                  const damage = applyIncomingHumanDamage(
                    g,
                    victim,
                    BOSS_ANOMALY_TUNING.mother.controlDamage,
                    { attackKind: "melee", attacker: f },
                  ).targetDamage;
                  victim.stunned = Math.max(victim.stunned, .42);
                  victim.knock = Math.max(victim.knock, 14);
                  addDamageText(g, {
                    x: victim.x,
                    y: victim.y - 58,
                    value: `増殖圧 -${Math.round(damage)}`,
                    life: .92,
                    color: "#d6a078",
                  });
                }
                const summonPlan = motherBroodSummonPlan({
                  boss: f,
                  candidates: g.fighters,
                  attackSequence: f.attackSequence,
                });
                for (let index = 0; index < summonPlan.length; index += 1) {
                  const planned = summonPlan[index];
                  const lane = Math.max(0, Math.min(2, f.lane + planned.laneOffset)) as Lane;
                  const summoned = spawnEnemy(g, planned.kind, lane, index);
                  summoned.x = Math.max(
                    BASE_X + 90,
                    Math.min(BARRICADE_X - 28, f.x + planned.xOffset),
                  );
                  summoned.y = activeLaneCenters[lane];
                  summoned.anchorLane = lane;
                  summoned.summonOwnerId = f.id;
                  summoned.summonSource = "mother-brood";
                  summoned.combatReady = true;
                  summoned.gateEntering = false;
                  summoned.spawnGrace = Math.max(summoned.spawnGrace, .62);
                  summoned.cooldown = Math.max(summoned.cooldown, .48);
                  addParticles(g, summoned.x, summoned.y - 18, index % 2 ? "#8a5344" : "#c08a62", 12);
                }
                f.attackSequence += 1;
                g.flashOverlay = Math.max(g.flashOverlay, .08);
                g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.takuyaHeavy);
                g.banner = "マザー // 増殖室離床";
                g.bannerTime = .8;
                playProductionCue("boss-mother-brood-eruption", f.x, {
                  priority: 98,
                  cooldownMs: 300,
                  volume: .78,
                  fallbackCue: "boss-warning",
                });
              }
              if (step.events.includes("complete")) {
                f.abilityCooldown = BOSS_ANOMALY_TUNING.mother.cooldownSeconds;
              }
              continue;
            }
            if (f.abilityCooldown <= 0) {
              const started = beginBossAnomalyAbility({
                boss: f,
                candidates: g.fighters,
              });
              if (started.ok) {
                f.stationAbility = started.runtime as StationAbilityRuntime;
                abilityFrame = true;
                g.banner = "マザー // 増殖兆候";
                g.bannerTime = .72;
                playProductionCue("boss-mother-brood-warning", f.x, {
                  priority: 90,
                  cooldownMs: 600,
                  volume: .62,
                  fallbackCue: "boss-warning",
                });
              }
            }
            if (abilityFrame || f.stationAbility.phase !== "idle") continue;
          }

          if (["ooguchi", "gairen", "futago"].includes(f.kind)) {
            const anomalyKind = f.kind as "ooguchi" | "gairen" | "futago";
            const tuning = BOSS_ANOMALY_TUNING[anomalyKind];
            let abilityFrame = f.stationAbility.phase !== "idle";
            if (f.stationAbility.phase !== "idle") {
              const previousX = f.x;
              const step = advanceBossAnomalyAbility(f.stationAbility, dt);
              f.stationAbility = step.runtime as StationAbilityRuntime;

              if (anomalyKind === "ooguchi"
                && (f.stationAbility.phase === "active" || step.events.includes("activate"))) {
                const charge = ooguchiChargeStep({
                  runtime: f.stationAbility,
                  boss: f,
                  elapsedSeconds: dt,
                  minimumX: BASE_X + 54,
                });
                if (charge.active) {
                  f.x = charge.boss.x;
                  if (Number.isInteger(charge.lane)) {
                    f.lane = charge.lane as Lane;
                    f.anchorLane = f.lane;
                    f.y = Number.isFinite(Number(f.stationAbility.targetY))
                      ? Number(f.stationAbility.targetY)
                      : activeLaneCenters[f.lane];
                  }
                  const hitIds = new Set(f.stationAbility.targetIds ?? []);
                  for (const victim of g.fighters) {
                    if (victim.side !== "human"
                      || victim.hp <= 0
                      || victim.targetable === false
                      || hitIds.has(String(victim.id))
                      || Math.abs(victim.y - f.y) > tuning.chargeHalfHeight
                      || victim.x < f.x - f.bodyRadius - victim.bodyRadius
                      || victim.x > previousX + f.bodyRadius + victim.bodyRadius) continue;
                    const resolved = applyIncomingHumanDamage(
                      g,
                      victim,
                      tuning.chargeDamage,
                      { attackKind: "melee", attacker: f },
                    );
                    hitIds.add(String(victim.id));
                    victim.flash = Math.max(victim.flash, .2);
                    victim.knock = Math.max(victim.knock, 22);
                    addDamageText(g, {
                      x: victim.x,
                      y: victim.y - 58,
                      value: `捕食突進 -${Math.round(resolved.targetDamage)}`,
                      life: .92,
                      color: "#e5a06d",
                    });
                  }
                  f.stationAbility = {
                    ...f.stationAbility,
                    targetIds: [...hitIds],
                  };
                }
              }

              if (step.events.includes("activate")) {
                if (anomalyKind === "ooguchi") {
                  g.banner = "オオグチ // 捕食突進";
                  addParticles(g, f.x - 38, f.y - 18, "#c4784e", 18);
                  playProductionCue("boss-ooguchi-charge-impact", f.x, {
                    priority: 99,
                    cooldownMs: 260,
                    volume: .82,
                    fallbackCue: "boss-warning",
                  });
                } else {
                  const areaBoss = anomalyKind === "futago"
                    ? {
                      ...f,
                      x: Number(f.stationAbility.targetX) || f.x,
                      y: Number(f.stationAbility.targetY) || f.y,
                    }
                    : f;
                  const hitIds = bossAnomalyAreaTargetIds({
                    kind: anomalyKind,
                    boss: areaBoss,
                    candidates: g.fighters,
                  });
                  const splitMultiplier = anomalyKind === "futago" && f.stationAbility.split
                    ? 1.2
                    : 1;
                  const abilityDamage = anomalyKind === "gairen"
                    ? BOSS_ANOMALY_TUNING.gairen.sweepDamage
                    : BOSS_ANOMALY_TUNING.futago.crossStrikeDamage * splitMultiplier;
                  for (const victimId of hitIds) {
                    const victim = g.fighters.find((candidate) => (
                      candidate.side === "human"
                      && String(candidate.id) === victimId
                    ));
                    if (!victim) continue;
                    const resolved = applyIncomingHumanDamage(
                      g,
                      victim,
                      abilityDamage,
                      { attackKind: "melee", attacker: f },
                    );
                    victim.flash = Math.max(victim.flash, .18);
                    victim.knock = Math.max(victim.knock, anomalyKind === "gairen" ? 18 : 14);
                    addDamageText(g, {
                      x: victim.x,
                      y: victim.y - 58,
                      value: anomalyKind === "gairen"
                        ? `外殻掃討 -${Math.round(resolved.targetDamage)}`
                        : `融合交差撃 -${Math.round(resolved.targetDamage)}`,
                      life: .92,
                      color: anomalyKind === "gairen" ? "#d3b77c" : "#d59a9d",
                    });
                  }
                  addParticles(
                    g,
                    areaBoss.x,
                    areaBoss.y - 20,
                    anomalyKind === "gairen" ? "#b79a68" : "#ba777d",
                    24,
                  );
                  g.banner = anomalyKind === "gairen"
                    ? "ガイレン // 外殻掃討・中枢露出"
                    : f.stationAbility.split
                      ? "フタゴ // 裂開・融合交差撃"
                      : "フタゴ // 融合交差撃";
                  playProductionCue(
                    anomalyKind === "gairen"
                      ? "boss-gairen-shell-sweep"
                      : "boss-futago-cross-impact",
                    f.x,
                    {
                      priority: 99,
                      cooldownMs: 260,
                      volume: .8,
                      fallbackCue: "boss-warning",
                    },
                  );
                }
                f.attackSequence += 1;
                g.bannerTime = .82;
                g.flashOverlay = Math.max(g.flashOverlay, .09);
                g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.takuyaHeavy);
              }

              if (step.events.includes("complete")) {
                const splitSpeed = anomalyKind === "futago"
                  && f.hp / Math.max(1, f.maxHp) <= BOSS_ANOMALY_TUNING.futago.splitThreshold
                  ? BOSS_ANOMALY_TUNING.futago.splitSpeedMultiplier
                  : 1;
                f.abilityCooldown = tuning.cooldownSeconds / splitSpeed;
              }
            }
            if (f.stationAbility.phase === "idle" && f.abilityCooldown <= 0) {
              const started = beginBossAnomalyAbility({
                boss: f,
                candidates: g.fighters,
              });
              if (started.ok) {
                f.stationAbility = started.runtime as StationAbilityRuntime;
                abilityFrame = true;
                g.banner = anomalyKind === "ooguchi"
                  ? "オオグチ // 捕食突進予告"
                  : anomalyKind === "gairen"
                    ? "ガイレン // 外殻掃討予告"
                    : "フタゴ // 融合交差撃予告";
                g.bannerTime = .68;
                playProductionCue(
                  anomalyKind === "ooguchi"
                    ? "boss-ooguchi-charge-warning"
                    : anomalyKind === "gairen"
                      ? "boss-gairen-shell-warning"
                      : "boss-futago-cross-warning",
                  f.x,
                  {
                    priority: 90,
                    cooldownMs: 600,
                    volume: .64,
                    fallbackCue: "boss-warning",
                  },
                );
              }
            }
            if (abilityFrame || f.stationAbility.phase !== "idle") continue;
          }

          if (f.kind === "kurome") {
            let abilityFrame = f.stationAbility.phase !== "idle";
            if (f.stationAbility.phase !== "idle") {
              const liveTarget = g.fighters.find((candidate) => (
                candidate.side === "human"
                && String(candidate.id) === String(f.stationAbility.targetId)
              ));
              const step = advanceKuromeTracking(f.stationAbility, dt, liveTarget);
              f.stationAbility = step.runtime as StationAbilityRuntime;
              if (step.fired) {
                const finalPhase = f.hp / Math.max(1, f.maxHp) <= .3;
                const beam = resolveKuromeBeam({
                  boss: f,
                  runtime: f.stationAbility,
                  candidates: g.fighters,
                  beamHalfWidth: finalPhase
                    ? KUROME_PROTOTYPE_TUNING.finalPhaseBeamHalfWidth
                    : KUROME_PROTOTYPE_TUNING.beamHalfWidth,
                });
                const damage = finalPhase
                  ? KUROME_PROTOTYPE_TUNING.finalPhaseDamage
                  : KUROME_PROTOTYPE_TUNING.damage;
                for (const victimId of beam.hits) {
                  const victim = g.fighters.find((candidate) => String(candidate.id) === victimId);
                  if (!victim) continue;
                  const resolved = applyIncomingHumanDamage(g, victim, damage, {
                    attackKind: "ranged",
                    attacker: f,
                  });
                  victim.flash = Math.max(victim.flash, .16);
                  victim.visionDisruptedRemaining = Math.max(
                    victim.visionDisruptedRemaining ?? 0,
                    KUROME_PROTOTYPE_TUNING.interferenceSeconds,
                  );
                  addDamageText(g, {
                    x: victim.x,
                    y: victim.y - 64,
                    value: `視界撹乱 -${Math.round(resolved.targetDamage)}`,
                    life: .95,
                    color: "#6ceaf1",
                  });
                }
                if (beam.target) addParticles(g, beam.target.x, beam.target.y, "#62e8ef", 22);
                g.flashOverlay = Math.max(g.flashOverlay, .12);
                g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.takuyaHeavy);
                g.banner = finalPhase
                  ? "クロメ // 追跡眼・過励起"
                  : "クロメ // 追跡眼";
                g.bannerTime = .82;
                playProductionCue("enemy-takuya-attack", f.x, {
                  priority: 94,
                  cooldownMs: 200,
                  volume: .84,
                  playbackRate: 1.28,
                  fallbackCue: "boss-warning",
                });
              }
              if (step.recovered) {
                f.abilityCooldown = f.hp / Math.max(1, f.maxHp) <= .3
                  ? KUROME_PROTOTYPE_TUNING.finalPhaseCooldownSeconds
                  : KUROME_PROTOTYPE_TUNING.cooldownSeconds;
              }
            }
            if (f.stationAbility.phase === "idle" && f.abilityCooldown <= 0) {
              const victim = g.fighters
                .filter((candidate) => candidate.side === "human"
                  && candidate.hp > 0
                  && candidate.combatReady
                  && candidate.targetable !== false
                  && fighterDistance(candidate, f) <= f.range)
                .sort((left, right) => left.x - right.x || fighterDistance(left, f) - fighterDistance(right, f))[0];
              const started = beginKuromeTracking(victim);
              if (started.ok) {
                f.stationAbility = started.runtime as StationAbilityRuntime;
                abilityFrame = true;
                g.banner = "クロメ // 追跡照準";
                // The ray itself owns the full warning window. Keep the global
                // banner brief so compact screens do not cover this tall boss.
                g.bannerTime = .68;
                playProductionCue("enemy-takuya-attack", f.x, {
                  priority: 90,
                  cooldownMs: 250,
                  volume: .52,
                  playbackRate: 1.65,
                  fallbackCue: "boss-warning",
                });
              }
            }
            if (abilityFrame || f.stationAbility.phase !== "idle") continue;
          }

          if (f.kind === "gate-eater") {
            if (f.stationAbility.phase === "idle" && f.abilityCooldown <= 0) {
              const victim = g.fighters
                .filter((candidate) => candidate.side === "human" && candidate.hp > 0)
                .sort((left, right) => fighterDistance(f, left) - fighterDistance(f, right))[0];
              const targetX = victim ? Math.max(BASE_X + 48, victim.x - 12) : Math.max(BASE_X + 48, f.x - 132);
              const started = beginTicketGateEaterCharge({ boss: f, targetX });
              if (started.ok) {
                f.stationAbility = started.runtime as StationAbilityRuntime;
                g.banner = "改札喰い // 突進予告";
                g.bannerTime = Math.max(
                  g.bannerTime,
                  bossDefinitionForEnemyKind("gate-eater")?.attackTelegraph.warningSeconds ?? 0,
                );
              }
            }
            if (f.stationAbility.phase !== "idle") {
              const charge = advanceTicketGateEaterCharge({
                runtime: f.stationAbility,
                boss: f,
                elapsedSeconds: dt,
              });
              f.stationAbility = charge.runtime as StationAbilityRuntime;
              f.x = Math.max(BASE_X + 48, charge.boss.x);
              f.lane = charge.boss.lane as Lane;
              f.anchorLane = f.lane;
              f.y = activeLaneCenters[f.lane];
              if (charge.chargeStarted) {
                g.stationMetrics.gateEaterCharges += 1;
                if (!g.signalIds.includes(STORY_BATTLE_TRIGGER_IDS.GATE_EATER_CHARGE)) {
                  g.signalIds.push(STORY_BATTLE_TRIGGER_IDS.GATE_EATER_CHARGE);
                }
              }
              if (charge.flankOpened && !g.signalIds.includes(STORY_BATTLE_TRIGGER_IDS.GATE_EATER_FLANK)) {
                g.signalIds.push(STORY_BATTLE_TRIGGER_IDS.GATE_EATER_FLANK);
              }
              if (charge.chargeEnded) {
                for (const victim of g.fighters) {
                  if (victim.side !== "human" || victim.hp <= 0 || fighterDistance(victim, f) > 92) continue;
                  const damage = applyIncomingHumanDamage(g, victim, 34, { attackKind: "melee", attacker: f }).targetDamage;
                  victim.flash = Math.max(victim.flash, .18);
                  victim.knock = Math.max(victim.knock, 14);
                  addDamageText(g, { x: victim.x, y: victim.y - 54, value: `突進 -${Math.round(damage)}`, life: .85, color: "#e2a65e" });
                }
              }
              if (f.stationAbility.phase === "idle") f.abilityCooldown = 7;
              continue;
            }
          }

          if (f.kind === "takuya") {
            let abilityFrame = false;
            if (f.abilityWindup > 0) {
              abilityFrame = true;
              const before = f.abilityWindup;
              f.abilityWindup = Math.max(0, f.abilityWindup - dt);
              if (before > 0 && f.abilityWindup <= 0) {
                const enraged = f.hp / f.maxHp <= .5;
                const radius = enraged ? 145 : 118;
                const damage = enraged ? 28 : 22;
                for (const victim of g.fighters) {
                  // Perspective-scaled distance matches the on-ground warning ellipse.
                  if (victim.side !== "human" || victim.hp <= 0 || effectDistance(victim, f) > radius) continue;
                  const resolved = applyIncomingHumanDamage(g, victim, damage, { attackKind: "melee", attacker: f });
                  victim.flash = .16; victim.knock = Math.max(victim.knock, 12);
                  g.damageTexts.push({ x: victim.x, y: victim.y - 48, value: String(Math.round(resolved.targetDamage)), life: .8, color: "#ff7658" });
                }
                addParticles(g, f.x, f.y - 4, "#e7653d", 28);
                g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.takuyaHeavy); g.flashOverlay = Math.max(g.flashOverlay, .22);
                g.banner = enraged ? "TAKUYA // 激昂・鉄槌強襲" : "TAKUYA // 鉄槌強襲";
                g.bannerTime = 1.15; playCue("takuya-slam");
              }
            } else if (f.abilityCooldown <= 0 && g.fighters.some((human) => human.side === "human" && human.hp > 0 && fighterDistance(human, f) <= 150)) {
              abilityFrame = true;
              f.abilityWindup = bossDefinitionForEnemyKind("takuya")?.attackTelegraph.warningSeconds ?? 0;
              f.abilityCooldown = f.hp / f.maxHp <= .5 ? 4.8 : 6.5;
              g.banner = "TAKUYA // 鉄槌強襲予告";
              g.bannerTime = f.abilityWindup + .05;
            }
            if (abilityFrame) continue;
          }

          if (f.kind === "engineer") {
            if (!f.engineerTrapReady && f.engineerTrapCooldown <= 0) {
              const placement = createMonkeyTrap({
                id: `monkey-trap-${f.id}-${Math.floor(g.time * 10)}`,
                engineer: { ...f, assignedLane: f.anchorLane ?? f.lane },
                assignedLane: f.anchorLane ?? f.lane,
                elapsedSinceLastPlacement: Infinity,
                minimumX: BASE_X + 86,
                maximumX: BARRICADE_X - 24,
              });
              if (placement.ok && placement.trap) {
                f.engineerTrapReady = true;
                f.engineerTrapX = placement.trap.x;
                f.engineerTrapLane = placement.trap.lane as Lane;
                f.engineerTrapManual = false;
              }
            }
            if (f.engineerTrapReady && f.engineerTrapLane !== null) {
              const trap = {
                id: `monkey-trap-${f.id}`,
                ownerId: f.id,
                ownerSide: f.side,
                lane: f.engineerTrapLane,
                x: f.engineerTrapX,
                active: true,
                used: false,
                triggerRadius: f.engineerTrapManual
                  ? MANUAL_ABILITY_REGISTRY.engineer.effectRadius
                  : UNIT_ROLE_TUNING.monkey.triggerRadius,
                stopSeconds: (f.engineerTrapManual
                  ? MANUAL_ABILITY_REGISTRY.engineer.bindSeconds
                  : UNIT_ROLE_TUNING.monkey.stopSeconds) * f.trapDurationMultiplier,
              };
              const trigger = triggerMonkeyTrap(trap, g.fighters.filter((candidate) => candidate.side === "zombie"));
              if (trigger.triggered) {
                const trappedTargets = f.engineerTrapManual
                  ? g.fighters.filter((candidate) => (
                    candidate.side === "zombie"
                    && candidate.hp > 0
                    && candidate.combatReady
                    && candidate.lane === trap.lane
                    && Math.abs(candidate.x - trap.x) <= trap.triggerRadius
                  ))
                  : g.fighters.filter((candidate) => (
                    candidate.id === trigger.targetId
                    && candidate.side === "zombie"
                    && candidate.hp > 0
                  ));
                if (trappedTargets.length > 0) {
                  for (const trapped of trappedTargets) {
                  trapped.stunned = Math.max(trapped.stunned, trigger.stopSeconds);
                  if (f.engineerTrapManual) {
                    trapped.suppressionStacks = Math.max(
                      trapped.suppressionStacks,
                      UNIT_ROLE_TUNING.raider.maximumSuppressionStacks,
                    );
                    trapped.suppressedRemaining = Math.max(
                      trapped.suppressedRemaining,
                      MANUAL_ABILITY_REGISTRY.engineer.bindSeconds
                        + MANUAL_ABILITY_REGISTRY.engineer.slowSeconds,
                    );
                  }
                    addDamageText(g, { x: trapped.x, y: trapped.y - 60, value: "足止め", life: .8, color: "#e1c978" });
                  }
                  f.engineerTrapReady = false;
                  f.engineerTrapCooldown = UNIT_ROLE_TUNING.monkey.placementIntervalSeconds;
                  f.engineerTrapManual = false;
                  g.roleMetrics.monkeyTrapTriggers += 1;
                }
              }
            }
          }

          if (f.kind === "medic" && f.supportCooldown <= 0) {
            const wounded = selectNaoHealTarget({
              healer: f,
              allies: g.fighters.filter((other) => other.side === "human" && other.id !== f.id),
              maxRange: UNIT_ROLE_TUNING.nao.healRange,
              distanceBetween: fighterDistance,
            }) as Fighter | null;
            if (wounded) {
              const concurrentHealers = g.fighters.filter((other) => other.side === "human"
                && other.kind === "medic"
                && other.id !== f.id
                && other.healFocusTargetId === wounded.id
                && other.healFocusRemaining > 0).length;
              const healing = resolveNaoHealing({
                target: wounded,
                baseHealing: UNIT_ROLE_TUNING.nao.baseHealing * f.healingMultiplier,
                healerNumber: concurrentHealers + 1,
                existingProtectionSeconds: wounded.damageReductionRemaining,
              });
              const healed = healing.amount;
              const roleEffect = roleEffectForAction({ unitKind: f.kind, action: "heal", targetKind: wounded.kind }) as RoleEffect | null;
              wounded.hp = healing.hp;
              recordUnitHealing(g, f.kind, healed);
              wounded.damageReductionRemaining = healing.protectionSeconds;
              wounded.damageReductionMultiplier = 1 - healing.damageReduction;
              f.healFocusTargetId = wounded.id;
              f.healFocusRemaining = 1.55;
              f.supportCooldown = 1.55;
              g.roleMetrics.naoHealing += healed;
              g.damageTexts.push({ x: wounded.x, y: wounded.y - 70, value: `+${Math.ceil(healed)}`, life: .8, color: "#83e0a2" });
              g.damageTexts.push({ x: f.x, y: f.y - 64, value: "救護", life: .7, color: "#9bf0ba" });
              g.shots.push({ x: f.x + 8, y: f.y - 34, tx: wounded.x, ty: wounded.y - 28, life: .32, duration: .32, side: "human", effect: roleEffect ?? undefined });
              addParticles(g, wounded.x, wounded.y - 30, "#69d993", 7);
              if (roleEffect) playCue("role-medic");
              emitBattleBark(g, "role-cue", f.kind, f.id);
            }
          }

          const returningToAssignedLane = f.side === "human" && humanLaneTransitioning({
            currentLane: f.lane,
            assignedLane: f.anchorLane ?? f.lane,
            y: f.y,
            laneCenters: activeLaneCenters,
          });
          if (f.kind === "medic"
            && !returningToAssignedLane
            && crawlerAttackThreatIds.size === 0
            && (f.crawlerDefenseTargetId === null || f.crawlerDefenseTargetId === undefined)) {
            const livingAllies = g.fighters.filter((ally) => ally.side === "human" && ally.hp > 0);
            const assignedPeers = livingAllies.filter((ally) => ally.anchorLane === f.anchorLane);
            const cohesion = assignedPeers.length > 1 ? (supportCohesion as unknown as (input: { support: Fighter; allies: Fighter[] }) => {
              needsRegroup: boolean; destination: { x: number; y: number; lane: Lane };
            } | null)({ support: f, allies: assignedPeers }) : null;
            if (cohesion?.needsRegroup) {
              const dx = cohesion.destination.x - f.x;
              const dy = cohesion.destination.y - f.y;
              f.x += Math.sign(dx) * Math.min(Math.abs(dx), humanMovementSpeed * dt);
              f.y += Math.sign(dy) * Math.min(Math.abs(dy), humanLaneSpeed * dt);
              f.lane = activeLaneForY(f.y, cohesion.destination.lane);
              f.targetId = null;
              continue;
            }
          }

          let target: Fighter | undefined;
          let objectTarget: BattlefieldObject | undefined;
          let allyIntent: ReturnType<typeof decideAllyIntent> | null = null;
          let distance = Infinity;
          if (f.side === "human") {
            f.targetObjectId = null;
            const allyProfile = allyAiProfileFor(f.aiProfile);
            const enemies = g.fighters.filter((enemy) => enemy.side === "zombie" && enemy.hp > 0 && enemy.combatReady);
            const assignedLane = f.anchorLane ?? f.lane;
            const stagingForAssignedLane = f.x <= MUSTER_X + 12 && returningToAssignedLane;
            const tacticalEnemies = enemies;
            const allyTargetCandidates = tacticalEnemies.map((enemy) => {
              const blockingCrawlerRouteObject = selectBlockingContainer({
                enemyX: enemy.x,
                enemyY: enemy.y,
                enemyRadius: enemy.bodyRadius,
                objects: g.battlefieldObjects,
              }) as BattlefieldObject | undefined;
              const attackingCrawler = isCrawlerAttackThreat({
                enemyX: enemy.x,
                enemyRange: enemy.range,
                baseX: BASE_X,
                blockingObject: blockingCrawlerRouteObject,
                combatReady: enemy.combatReady,
                hp: enemy.hp,
                contained: enemy.contained,
              });
              return {
                id: enemy.id,
                side: enemy.side,
                x: enemy.x,
                y: enemy.y,
                lane: enemy.lane,
                assignedLane: enemy.anchorLane ?? enemy.lane,
                kind: enemy.kind,
                boss: isBossEnemyKind(enemy.kind),
                hp: enemy.hp,
                combatReady: enemy.combatReady,
                bodyRadius: enemy.bodyRadius,
                verticalDistance: Math.abs(f.y - enemy.y),
                attackingCrawler,
                crawlerDefenseCapacity: crawlerDefenseResponderCapacity({ enemyKind: enemy.kind }),
                inContact: fighterDistance(f, enemy) <= f.bodyRadius + enemy.bodyRadius,
                attackEligible: canAcquireCombatTarget({
                  attacker: f,
                  target: enemy,
                  hasLineOfSight: (attacker, candidate) => hasBattleSpaceLineOfSight(g, attacker as Fighter, candidate as Fighter),
                }),
                blocksPath: Math.abs(enemy.y - f.y) <= enemy.bodyRadius + f.bodyRadius + 12
                  && Math.abs(enemy.x - f.x) <= Math.max(105, f.range + 36),
                threatensBase: !blockingCrawlerRouteObject && enemy.x <= WORLD_GEOMETRY.threatNearX,
                baseThreatDistance: Math.max(0, enemy.x - BASE_X),
                priority: -roleTargetBias(f.kind, enemy.kind),
              };
            });
            if (f.crawlerDefenseTargetId !== null
              && f.crawlerDefenseTargetId !== undefined
              && shouldReleaseCrawlerDefenseTarget({
                lockedTargetId: f.crawlerDefenseTargetId,
                candidates: allyTargetCandidates,
              })) {
              if (f.targetId !== null) {
                targetClaims.set(f.targetId, Math.max(0, (targetClaims.get(f.targetId) ?? 1) - 1));
              }
              f.targetId = null;
              f.crawlerDefenseTargetId = null;
              f.retargetIn = 0;
            }
            const retainedTarget = retainedTargetDuringRetarget({
              retargetIn: f.retargetIn,
              currentTargetId: f.targetId,
              candidates: allyTargetCandidates,
            });
            const intentEnemies = retainedTarget ? [retainedTarget] : allyTargetCandidates;
            const takuyaAlive = enemies.some((enemy) => enemy.kind === "takuya");
            const containmentBossAlive = enemies.some((enemy) => enemy.kind === "gate-eater" && enemy.contained !== true);
            const objectiveX = g.definition.missionType === "timed-defense"
              || g.definition.missionType === "survival"
              ? null
              : g.barricadeVulnerable
                ? BARRICADE_X
                : advanceLimitFor(g.phase, g.barricadeVulnerable);
            const defenseFrontX = g.survivalRun
              ? survivalDefenseDestination({ aiProfile: f.aiProfile })
              : 555;
            allyIntent = decideAllyIntent({
              missionType: g.definition.missionType,
              unit: {
                id: f.id,
                kind: f.kind,
                side: f.side,
                x: f.x,
                y: f.y,
                lane: f.lane,
                assignedLane,
                bodyRadius: f.bodyRadius,
                range: f.range,
                ranged: f.range > 64,
                allowAdjacentLaneTargets: COMBAT_ROLE_RULES[f.kind]?.allowAdjacentLaneTargets === true,
              },
              assignedLane,
              enemies: intentEnemies,
              objective: objectiveX === null ? null : { x: objectiveX, active: true },
              defenseAnchor: { 0: BASE_X + 205, 1: BASE_X + 225, 2: BASE_X + 205 },
              forwardAnchor: { 0: defenseFrontX - 15, 1: defenseFrontX, 2: defenseFrontX - 15 },
              claims: targetClaims,
              previousIntent: { targetId: f.targetId, destinationX: f.aiDestinationX, desiredX: f.aiDestinationX, moveDirection: f.aiMoveDirection },
              laneTransitioning: returningToAssignedLane,
              takuyaDefeated: g.definition.missionType === "boss-assault" && g.barricadeVulnerable && !takuyaAlive,
              maxPursuersPerEnemy: takuyaAlive || containmentBossAlive ? 9 : allyProfile.maxPursuersPerEnemy,
              localThreatRadius: Math.max(allyProfile.localThreatRadius, f.range + 56),
              defenseLeash: allyProfile.defenseLeash,
              rangePadding: allyProfile.rangePadding,
              hasLineOfSight: (_attacker, candidate) => {
                const actualTarget = fighterById.get(candidate.id);
                return actualTarget ? hasBattleSpaceLineOfSight(g, f, actualTarget) : false;
              },
            });
            const stationObjective = stationObjectiveDestination(g, f);
            if (stationObjective && allyIntent.reason !== "crawler-under-attack") {
              f.anchorLane = stationObjective.lane;
              allyIntent = {
                ...allyIntent,
                destinationX: stationObjective.x,
                desiredX: stationObjective.x,
                destinationLane: stationObjective.lane,
                moveDirection: Math.sign(stationObjective.x - f.x),
              };
            }
            if (g.survivalRun && allyIntent.reason !== "crawler-under-attack") {
              const survivalTarget = tacticalEnemies.find((enemy) => enemy.id === allyIntent?.targetId);
              const destinationX = survivalDefenseDestination({
                aiProfile: f.aiProfile,
                desiredX: allyIntent.destinationX,
                emergencyDefense: allyIntent.emergencyDefense,
                activeThreatX: survivalTarget?.x ?? null,
              });
              allyIntent = {
                ...allyIntent,
                destinationX,
                desiredX: destinationX,
                moveDirection: Math.sign(destinationX - f.x),
              };
            }
            const holdAtMuster = stagingForAssignedLane
              && allyIntent.reason !== "crawler-under-attack"
              && !stationObjective;
            if (holdAtMuster) allyIntent = { ...allyIntent, destinationX: MUSTER_X, desiredX: MUSTER_X, moveDirection: 0 };
            f.aiDestinationX = holdAtMuster ? MUSTER_X : allyIntent.destinationX;
            f.aiMoveDirection = allyIntent.moveDirection;
            target = tacticalEnemies.find((enemy) => enemy.id === allyIntent?.targetId);
            if (f.retargetIn <= 0 || target?.id !== f.targetId) {
              f.retargetIn = allyProfile.retargetSeconds + (f.variant % 3) * .05;
            }
            if (target?.id !== f.targetId) {
              if (f.targetId !== null) targetClaims.set(f.targetId, Math.max(0, (targetClaims.get(f.targetId) ?? 1) - 1));
              const nextDefenseTargetId = allyIntent.emergencyDefense ? target?.id ?? null : null;
              const nextClaimIsEffective = target && (
                !crawlerAttackThreatIds.has(target.id)
                || isEffectiveCrawlerDefenseClaim({
                  fighterTargetId: target.id,
                  fighterDefenseTargetId: nextDefenseTargetId,
                  fighterHp: f.hp,
                  fighterCombatReady: f.combatReady,
                  fighterX: f.x,
                  fighterY: f.y,
                  fighterRange: f.range,
                  targetId: target.id,
                  targetHp: target.hp,
                  targetCombatReady: target.combatReady,
                  targetX: target.x,
                  targetY: target.y,
                  targetBodyRadius: target.bodyRadius,
                  canEngage: canAcquireCombatTarget({
                    attacker: f,
                    target,
                    hasLineOfSight: (attacker, candidate) => hasBattleSpaceLineOfSight(
                      g,
                      attacker as Fighter,
                      candidate as Fighter,
                    ),
                  }),
                })
              );
              if (nextClaimIsEffective) targetClaims.set(target.id, (targetClaims.get(target.id) ?? 0) + 1);
              f.targetId = target?.id ?? null;
            }
            f.crawlerDefenseTargetId = allyIntent.emergencyDefense ? target?.id ?? null : null;
          } else {
            const enemyProfile = enemyAiProfileFor(f.aiProfile);
            const humans = g.fighters.filter((human) => human.side === "human" && human.hp > 0);
            const locked = f.targetId === null ? undefined : fighterById.get(f.targetId);
            const blockingSupply = selectBlockingContainer({
              enemyX: f.x,
              enemyY: f.y,
              enemyRadius: f.bodyRadius,
              objects: g.battlefieldObjects,
            }) as BattlefieldObject | undefined;
            const canAcquireHumanTarget = (human: Fighter) => canAcquireCombatTarget({
              attacker: f,
              target: human,
              hasLineOfSight: (attacker, candidate) => hasBattleSpaceLineOfSight(g, attacker as Fighter, candidate as Fighter),
            });
            const contactSupply = g.battlefieldObjects
              .filter((supply) => !supply.blocksEnemies && enemyCanTargetBattlefieldSupply({
                supply,
                enemyX: f.x,
                enemyY: f.y,
                attackRange: f.range,
              }))
              .sort((a, b) => Math.abs(f.x - a.x) - Math.abs(f.x - b.x))[0];
            const crawlerInRange = isCrawlerAttackThreat({
              enemyX: f.x,
              enemyRange: f.range,
              baseX: BASE_X,
              blockingObject: blockingSupply,
              combatReady: f.combatReady,
              hp: f.hp,
              contained: f.contained,
            });
            const physicalContact = crawlerInRange ? undefined : humans
              .filter((human) => canAcquireHumanTarget(human)
                && fighterDistance(f, human) <= f.range + human.bodyRadius + 4)
              .sort((a, b) => fighterDistance(f, a) - fighterDistance(f, b))[0];
            const routeY = activeLaneCenters[f.navigationRecovery.recoveryLane ?? f.anchorLane ?? f.lane];
            const lookAhead = Math.max(105, f.range + 36);
            const defenderCapacity = (human: Fighter) => human.kind === "guardian" ? 4 : human.kind === "scout" || human.kind === "medic" ? 1 : 2;
            const routeBlockers = crawlerInRange ? [] : humans.filter((human) => isCrawlerRouteBlocker({
              enemyX: f.x, defenderX: human.x, defenderY: human.y, routeY, lookAhead,
            }));
            const availableBlockers = routeBlockers.filter((human) => {
              const claimsFromOthers = Math.max(0, (interceptorClaims.get(human.id) ?? 0) - (f.targetId === human.id ? 1 : 0));
              return canAcquireHumanTarget(human) && claimsFromOthers < defenderCapacity(human);
            });
            const interceptorScore = (human: Fighter) => interceptorTargetScore({
              distance: fighterDistance(f, human),
              claims: interceptorClaims.get(human.id) ?? 0,
              capacity: defenderCapacity(human),
              isCurrent: f.targetId === human.id,
              rearward: human.x - f.x,
            }) + (human.kind === "guardian" ? -65 : human.kind === "brute" ? -10 : 0);
            const bestInterceptor = availableBlockers.reduce<Fighter | undefined>((choice, human) => {
              return !choice || interceptorScore(human) < interceptorScore(choice) ? human : choice;
            }, undefined);
            const profileCandidates = humans.map((human) => ({
              ...human,
              distance: fighterDistance(f, human),
              inContact: physicalContact?.id === human.id,
              blocksRoute: routeBlockers.some((blocker) => blocker.id === human.id),
              attackEligible: canAcquireHumanTarget(human),
              capacity: defenderCapacity(human),
              nearbyAllies: humans.filter((other) => other.id !== human.id && fighterDistance(human, other) <= 82).length,
            }));
            const lockedCandidate = profileCandidates.find((candidate) => candidate.id === locked?.id);
            const lockedPursuable = lockedCandidate
              && lockedCandidate.attackEligible
              && (lockedCandidate.inContact
                || lockedCandidate.blocksRoute
                || (enemyProfile.humanPursuit && lockedCandidate.distance <= enemyProfile.engagementRadius));
            const selectedCandidate = f.retargetIn > 0 && lockedPursuable
              ? lockedCandidate
              : chooseEnemyTargetForProfile({
                kind: f.kind,
                profile: f.aiProfile,
                enemy: f,
                candidates: profileCandidates,
                claims: interceptorClaims,
                currentTargetId: f.targetId,
              });
            const profileTarget = humans.find((human) => human.id === selectedCandidate?.id);
            const humanTarget = profileTarget ?? bestInterceptor;
            const supportObjectPreferred = contactSupply ? shouldPrioritizeSupportObject({
              profile: f.aiProfile,
              targetDistance: humanTarget ? fighterDistance(f, humanTarget) : Infinity,
              objectDistance: Math.hypot(f.x - contactSupply.x, f.y - contactSupply.y),
              hasPhysicalContact: Boolean(physicalContact),
              hasBlockingObject: Boolean(blockingSupply),
            }) : false;
            target = physicalContact
              ?? (blockingSupply || supportObjectPreferred ? undefined : humanTarget);
            if (!target) objectTarget = blockingSupply ?? (supportObjectPreferred ? contactSupply : undefined);
            if (f.retargetIn <= 0 || target?.id !== f.targetId) {
              f.retargetIn = enemyProfile.retargetSeconds + (f.variant % 3) * .08;
            }
            const attackingCrawlerOnCurrentRoute = isCrawlerAttackThreat({
              enemyX: f.x,
              enemyRange: f.range,
              baseX: BASE_X,
              blockingObject: blockingSupply,
              combatReady: f.combatReady,
              hp: f.hp,
              contained: f.contained,
            });
            const routeCosts = ([0, 1, 2] as Lane[]).map((candidate) => {
              const defense = humans
                .filter((human) => human.x < f.x && (human.anchorLane ?? human.lane) === candidate)
                .reduce((sum, human) => sum + human.hp * .08 + human.damage * 1.2, 0);
              const congestion = g.fighters.filter((enemy) => enemy.side === "zombie"
                && enemy.hp > 0 && enemy.combatReady && (enemy.anchorLane ?? enemy.lane) === candidate).length * 7;
              return defense + congestion + ((f.id * 7 + candidate * 13) % 5);
            });
            const routeDecision = chooseCommittedEnemyLane({
              currentLane: f.anchorLane ?? f.lane,
              physicalLane: f.lane,
              x: f.x,
              y: f.y,
              laneCenters: activeLaneCenters,
              routeCosts,
              now: g.time,
              nextLaneDecisionAt: f.nextLaneDecisionAt,
              hasTarget: Boolean(target),
              hasObjectTarget: Boolean(objectTarget),
              // Once a zombie is actually striking the CRAWLER it has reached
              // the end of its committed route. Do not let avoidance scoring
              // make it drift lanes while responders are converging.
              inContact: Boolean(physicalContact) || attackingCrawlerOnCurrentRoute,
              routeCooldown: enemyProfile.routeCooldown + f.variant * .12,
              switchMargin: enemyProfile.routeSwitchMargin,
            });
            f.anchorLane = routeDecision.committedLane as Lane;
            f.nextLaneDecisionAt = routeDecision.nextLaneDecisionAt;
            if (target?.id !== f.targetId) {
              if (f.targetId !== null) interceptorClaims.set(f.targetId, Math.max(0, (interceptorClaims.get(f.targetId) ?? 1) - 1));
              if (target) interceptorClaims.set(target.id, (interceptorClaims.get(target.id) ?? 0) + 1);
            }
            f.targetId = target?.id ?? null;
            f.targetObjectId = objectTarget?.id ?? null;
          }
          distance = target ? fighterDistance(f, target) : Infinity;
          if (target && distance <= f.range + target.bodyRadius) {
            const transaction = (createAttackTransaction as unknown as (input: {
              attacker: Fighter; candidates: Fighter[]; damage: number; hasLineOfSight: (attacker: Fighter, target: Fighter) => boolean;
              targetPriority: (candidate: Fighter) => number;
            }) => { target: Fighter; targetId: number } | null)({
              attacker: f,
              candidates: target ? [target] : [],
              damage: f.damage,
              hasLineOfSight: (attacker, candidate) => hasBattleSpaceLineOfSight(g, attacker, candidate),
              targetPriority: (candidate: Fighter) => (
                roleTargetBias(f.kind, candidate.kind)
                + (candidate.id === target?.id ? -10 : 0)
              ),
            });
            target = transaction?.target as Fighter | undefined;
            distance = target ? fighterDistance(f, target) : Infinity;
            if (target) f.targetId = transaction?.targetId ?? target.id;
          }
          if (
            f.side === "human" && g.barricadeVulnerable && target &&
            allyIntent?.reason !== "crawler-under-attack" &&
            BARRICADE_X - f.x <= Math.max(110, f.range + 20) &&
            distance > Math.max(84, f.range + 36)
          ) {
            // A remote straggler must not pull the whole squad away from the win condition.
            targetClaims.set(target.id, Math.max(0, (targetClaims.get(target.id) ?? 1) - 1));
            f.targetId = null;
            target = undefined;
            distance = Infinity;
          }
          const objectDistance = objectTarget ? Math.abs(f.x - objectTarget.x) : Infinity;
          const humanMinX = humanCombatMinX({
            desiredX: allyIntent?.destinationX,
            hasEnemyTarget: f.side === "human" && Boolean(target),
          });
          const humanMaxX = g.survivalRun
            ? survivalDefenseDestination({ aiProfile: f.aiProfile, desiredX: 9999 })
            : BARRICADE_X;
          const zombieTargetX = f.side === "zombie" ? (target?.x ?? objectTarget?.x) : undefined;
          const zombieTargetFloor = zombieTargetX !== undefined && zombieTargetX <= f.x ? zombieTargetX : null;
          const enemyBaseTarget = enemyBaseTargetPoint(f.lane, activeLaneCenters);
          const baseDistance = f.side === "human" ? (g.barricadeVulnerable ? enemyBaseTarget.x - f.x : Infinity) : f.x - BASE_X;
          if (objectTarget && ["active", "impact"].includes(objectTarget.phase)) {
            const stoppingDistance = f.range + 30;
            if (objectDistance <= stoppingDistance) {
              if (f.cooldown <= 0) {
                const result = applyBattlefieldSupplyDamage(objectTarget, f.damage);
                Object.assign(objectTarget, result.supply);
                objectTarget.hitFlash = .18;
                f.attack = .18;
                f.cooldown = f.kind === "takuya" && f.hp / f.maxHp <= .5 ? 1 : f.attackEvery;
                playProductionCue(enemyVoiceCue(f.kind, "attack"), f.x, {
                  priority: f.kind === "takuya" || f.kind === "gate-eater" ? 94 : 64,
                  cooldownMs: 150,
                  maxInstances: 3,
                  fallbackCue: f.kind === "takuya" || f.kind === "gate-eater" ? "takuya-slam" : "melee-hit",
                });
                g.damageTexts.push({ x: objectTarget.x, y: objectTarget.y - 58, value: `-${Math.round(f.damage)}`, life: .65, color: "#ff9a70" });
                addParticles(g, objectTarget.x + 24, objectTarget.y - 18, "#9aa58d", f.kind === "takuya" || f.kind === "gate-eater" || f.kind === "crusher" ? 9 : 4);
                if (f.kind === "spitter" || f.kind === "ooze") g.shots.push({ x: f.x - 14, y: f.y - 32, tx: objectTarget.x, ty: objectTarget.y - 22, life: .2, duration: .2, side: "zombie", style: "projectile", weapon: "spitter" });
                if (result.detonationRequested) {
                  f.targetObjectId = null;
                  g.banner = "爆薬ドラム損壊・起爆 // 戦場"; g.bannerTime = 1.05;
                } else if (result.supply.phase === "destroying") {
                  f.targetObjectId = null;
                  g.banner = `${supplyDefs[objectTarget.kind].name}破壊 // 戦場`; g.bannerTime = 1.25;
                  addParticles(g, objectTarget.x, objectTarget.y - 12, "#7e8e82", 18); playCue(objectTarget.kind === "pod" ? "pod-destroy" : "object-destroy");
                } else playCue(objectTarget.kind === "pod" ? "pod-hit" : "object-hit");
              }
            } else {
              const stopX = objectTarget.x + stoppingDistance;
              f.x = Math.max(stopX, f.x - f.speed * mayoBiteSlowMultiplier * Math.min(f.slowMultiplier ?? 1, f.suppressionMultiplier) * dt);
              const routeY = activeLaneCenters[f.navigationRecovery.recoveryLane ?? f.anchorLane ?? f.lane];
              const dy = routeY - f.y;
              if (Math.abs(dy) > 2) f.y += Math.sign(dy) * Math.min(Math.abs(dy), f.laneSpeed * mayoBiteSlowMultiplier * dt);
              f.y = Math.max(activeLaneCenters[0], Math.min(activeLaneCenters[2], f.y));
              f.lane = activeLaneForY(f.y, f.lane);
            }
          } else if (target && distance <= f.range + target.bodyRadius) {
            if (f.cooldown <= 0) {
              if (f.side === "human" && f.kind === "gunner" && !raiderCanFire({ heat: f.weaponHeat, overheated: f.overheated })) {
                f.cooldown = .1;
                continue;
              }
              const enragedTakuya = f.kind === "takuya" && f.hp / f.maxHp <= .5;
              const targetHpRatio = target.hp / target.maxHp;
              const roleEffect = f.side === "human" ? roleEffectForAction({
                unitKind: f.kind,
                action: "attack",
                targetKind: target.kind,
                targetHpRatio,
                targetAlreadyMarked: target.marked > 0,
                holdingFrontline: f.kind === "brute" && target.targetId === f.id,
              }) as RoleEffect | null : null;
              const tataraTarget = {
                ...target,
                armored: target.kind === "crusher" || target.kind === "grappler" || target.kind === "gate-eater",
              };
              const baseAttackDamage = f.side === "human"
                ? f.kind === "brute"
                  ? resolveTataraStrikeDamage(f.damage, tataraTarget)
                    * humanAttackMultiplier(f.kind, target.kind, targetHpRatio, target.marked > 0)
                    * (target.armorBrokenRemaining > 0 ? 1.12 : 1)
                  : f.damage * humanAttackMultiplier(f.kind, target.kind, targetHpRatio, target.marked > 0)
                : f.damage;
              const gateEaterProfile = target.kind === "gate-eater" && f.side === "human"
                ? ticketGateEaterDamageProfile({
                  runtime: target.stationAbility,
                  attackVector: Math.abs(f.y - target.y) > 24 ? "flank" : "front",
                })
                : { multiplier: 1 };
              const bossDamageMultiplier = g.survivalRun
                && f.side === "human"
                && ["takuya", "gate-eater"].includes(target.kind)
                ? survivalUpgradeEffects(g.survivalRun).bossDamageMultiplier
                : 1;
              const mrsLauncherBash = f.side === "human"
                && f.kind === "mrs-chiha"
                && distance <= MANUAL_ABILITY_REGISTRY["mrs-chiha"].launcherBashRange + target.bodyRadius;
              const humanAttackKind = f.range > 64 && !mrsLauncherBash ? "ranged" : "melee";
              const v090DamageMultiplier = f.side === "human"
                ? v090EnemyIncomingDamageMultiplier(g, f, target, humanAttackKind)
                : 1;
              const manualDamageMultiplier = f.side === "human"
                && f.kind === "crazy-king"
                && f.manualAbility?.phase === "active"
                ? MANUAL_ABILITY_REGISTRY["crazy-king"].damageMultiplier
                : 1;
              const attackDamage = baseAttackDamage
                * gateEaterProfile.multiplier
                * bossDamageMultiplier
                * (mrsLauncherBash ? MANUAL_ABILITY_REGISTRY["mrs-chiha"].launcherBashDamageMultiplier : 1)
                * v090DamageMultiplier
                * manualDamageMultiplier;
              const weaponDamageEvents = f.side === "human"
                ? weaponDamageEventsFor(f.kind, attackDamage)
                : null;
              const splitMachineGunBurst = f.side === "human"
                && f.kind === "gunner"
                && weaponDamageEvents
                && weaponDamageEvents.length > 1;
              const immediateAttackDamage = attackDamage;
              let appliedAttack: { targetDamage: number };
              if (splitMachineGunBurst) {
                appliedAttack = { targetDamage: 0 };
              } else if (f.side === "zombie" && target.side === "human") {
                appliedAttack = applyIncomingHumanDamage(g, target, immediateAttackDamage, { attackKind: f.range > 64 ? "ranged" : "melee", attacker: f });
              } else if (f.side === "human" && f.kind === "mrs-chiha" && !mrsLauncherBash && weaponDamageEvents) {
                const grenadeRound = weaponDamageEvents[0];
                g.pendingWeaponHits.push({
                  eventKind: "muzzle",
                  targetKind: "fighter",
                  sourceId: f.id,
                  targetId: target.id,
                  targetX: target.x,
                  targetY: target.y - 28,
                  originX: f.x + 14,
                  originY: f.y - 32,
                  remainingSeconds: grenadeRound.offsetSeconds,
                  damage: 0,
                  weapon: f.kind,
                  shotIndex: grenadeRound.shotIndex,
                  recoil: grenadeRound.recoil,
                  casing: grenadeRound.casing,
                  hitStopSeconds: grenadeRound.hitStopSeconds,
                  impactDelaySeconds: grenadeRound.travelSeconds,
                  applyDamage: false,
                }, {
                  eventKind: "impact",
                  targetKind: "fighter",
                  damageMode: "grenade",
                  sourceId: f.id,
                  targetId: target.id,
                  targetX: target.x,
                  targetY: target.y - 28,
                  originX: f.x + 14,
                  originY: f.y - 32,
                  remainingSeconds: grenadeRound.hitOffsetSeconds,
                  damage: immediateAttackDamage,
                  weapon: f.kind,
                  shotIndex: grenadeRound.shotIndex,
                  recoil: grenadeRound.recoil,
                  casing: grenadeRound.casing,
                  hitStopSeconds: grenadeRound.hitStopSeconds,
                  impactDelaySeconds: grenadeRound.travelSeconds,
                  applyDamage: true,
                });
                g.pendingWeaponHits = g.pendingWeaponHits.slice(-64);
                appliedAttack = { targetDamage: 0 };
              } else if (f.side === "human"
                && target.kind === "gate-eater"
                && g.definition.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL
                && g.researchContainer) {
                const hpBeforeStrike = target.hp;
                const containerWasExposed = g.researchContainer.exposed;
                const containment = resolveContainmentStrike({
                  boss: target,
                  researchContainer: g.researchContainer,
                  attackDamage: immediateAttackDamage,
                  powerActivated: g.stageMission.powerActivated ?? 0,
                  sealDoorX: Number(g.definition.missionConfig.sealDoorX ?? 867),
                });
                Object.assign(target, containment.boss);
                g.researchContainer = containment.researchContainer as ResearchContainerRuntime;
                appliedAttack = { targetDamage: Math.max(0, hpBeforeStrike - target.hp) };
                if (!containerWasExposed && g.researchContainer.exposed) {
                  if (!g.signalIds.includes(STORY_BATTLE_TRIGGER_IDS.RESEARCH_CONTAINER_EXPOSED)) {
                    g.signalIds.push(STORY_BATTLE_TRIGGER_IDS.RESEARCH_CONTAINER_EXPOSED);
                  }
                  g.banner = "研究容器露出 // 改札喰いと共に押し込め";
                  g.bannerTime = 2;
                }
                if (containment.bossDefeated && g.stageMission.gateEaterDefeated !== true) {
                  g.banner = "改札喰い撃破 // 研究容器を確保";
                  g.bannerTime = 1.8;
                }
              } else {
                target.hp -= immediateAttackDamage;
                appliedAttack = { targetDamage: immediateAttackDamage };
              }
              if (f.side === "human" && appliedAttack.targetDamage > 0) {
                recordUnitDamage(g, f.kind, appliedAttack.targetDamage);
              }
              if (splitMachineGunBurst) {
                const weaponProfile = weaponProfileForUnit(f.kind);
                for (const event of weaponDamageEvents) {
                  const sharedEvent = {
                    targetKind: "fighter" as const,
                    damageMode: target.kind === "gate-eater"
                      && g.definition.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL
                      ? "containment" as const
                      : "direct" as const,
                    raiderLineHit: true,
                    raiderSecondary: false,
                    sourceId: f.id,
                    targetId: target.id,
                    targetX: target.x,
                    targetY: target.y - 28,
                    originX: f.x + 14 - event.recoil * event.shotIndex * 2,
                    originY: f.y - 32 + event.shotIndex * 1.5,
                    weapon: f.kind as UnitKind,
                    shotIndex: event.shotIndex,
                    recoil: event.recoil,
                    casing: event.casing,
                    hitStopSeconds: event.hitStopSeconds,
                    impactDelaySeconds: event.travelSeconds,
                  };
                  if (event.offsetSeconds <= 0) {
                    addWeaponShot(g, sharedEvent);
                  } else {
                    g.pendingWeaponHits.push({
                      ...sharedEvent,
                      eventKind: "muzzle",
                      remainingSeconds: event.offsetSeconds,
                      damage: 0,
                      applyDamage: false,
                    });
                  }
                  g.pendingWeaponHits.push({
                    ...sharedEvent,
                    eventKind: "impact",
                    remainingSeconds: event.hitOffsetSeconds,
                    damage: event.damage,
                    applyDamage: true,
                  });
                }
                g.pendingWeaponHits = g.pendingWeaponHits.slice(-64);
                f.attack = Math.max(f.attack, weaponProfile.shotOffsetsSeconds.at(-1) ?? 0);
              }
              if (!splitMachineGunBurst) target.flash = .12;
              f.attackSequence += 1;
              let crazyKingRadius: number | null = null;
              if (f.side === "human" && f.kind === "crazy-king") {
                const momentum = advanceCrazyKingMomentum({
                  hitCount: f.comboHits,
                  secondsSinceLastHit: f.comboWindow > 0 ? 0 : Infinity,
                  hitLanded: true,
                });
                f.comboHits = momentum.hitCount;
                f.comboWindow = UNIT_ROLE_TUNING.crazyKing.comboWindowSeconds;
                crazyKingRadius = f.manualAbility?.phase === "active"
                  ? Math.max(momentum.radius, MANUAL_ABILITY_REGISTRY["crazy-king"].areaRadius)
                  : momentum.radius;
                g.roleMetrics.crazyKingMaxTier = Math.max(g.roleMetrics.crazyKingMaxTier, momentum.tier);
              }
              if (f.side === "human" && f.kind === "brute") {
                const specialty = tataraTargetSpecialty(tataraTarget);
                if (specialty !== "normal") {
                  g.roleMetrics.tataraHeavyDamage += attackDamage;
                  target.armorBreakStacks += 1;
                  if (target.armorBreakStacks >= 3) {
                    target.armorBreakStacks = 0;
                    target.armorBrokenRemaining = Math.max(target.armorBrokenRemaining, 3.2);
                    target.stunned = Math.max(target.stunned, .75);
                    addDamageText(g, { x: target.x, y: target.y - 66, value: "装甲破砕", life: .85, color: "#ffba70" });
                  }
                }
              }
              if (f.side === "human" && f.kind === "gunner") {
                const wasOverheated = f.overheated;
                const heat = applyRaiderShots(
                  { heat: f.weaponHeat, overheated: f.overheated },
                  weaponDamageEvents?.length ?? 1,
                );
                f.weaponHeat = heat.heat;
                f.overheated = heat.overheated;
                if (!wasOverheated && heat.overheated) g.roleMetrics.raiderOverheats += 1;
                const lineTargets = [...selectRaiderLineTargets({
                  attacker: f,
                  enemies: g.fighters.filter((candidate) => candidate.side === "zombie"
                    && candidate.hp > 0
                    && candidate.combatReady
                    && candidate.contained !== true),
                  range: UNIT_ROLE_TUNING.raider.lineRange,
                })] as Fighter[];
                if (!lineTargets.some((candidate) => candidate.id === target?.id)) lineTargets.unshift(target);
                for (const lineTarget of lineTargets) {
                  if (lineTarget.id === target.id) continue;
                  const pierceDamage = attackDamage * .58;
                  for (const event of weaponDamageEventsFor(f.kind, pierceDamage)) {
                    const sharedEvent = {
                      targetKind: "fighter" as const,
                      damageMode: lineTarget.kind === "gate-eater"
                        && g.definition.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL
                        ? "containment" as const
                        : "direct" as const,
                      raiderLineHit: true,
                      raiderSecondary: true,
                      sourceId: f.id,
                      targetId: lineTarget.id,
                      targetX: lineTarget.x,
                      targetY: lineTarget.y - 28,
                      originX: f.x + 14 - event.recoil * event.shotIndex * 2,
                      originY: f.y - 32 + event.shotIndex * 1.5,
                      weapon: f.kind as UnitKind,
                      shotIndex: event.shotIndex,
                      recoil: event.recoil,
                      casing: event.casing,
                      hitStopSeconds: event.hitStopSeconds,
                      impactDelaySeconds: event.travelSeconds,
                    };
                    if (event.offsetSeconds <= 0) {
                      addWeaponShot(g, sharedEvent);
                    } else {
                      g.pendingWeaponHits.push({
                        ...sharedEvent,
                        eventKind: "muzzle",
                        remainingSeconds: event.offsetSeconds,
                        damage: 0,
                        applyDamage: false,
                      });
                    }
                    g.pendingWeaponHits.push({
                      ...sharedEvent,
                      eventKind: "impact",
                      remainingSeconds: event.hitOffsetSeconds,
                      damage: event.damage,
                      applyDamage: true,
                    });
                  }
                }
                g.pendingWeaponHits = g.pendingWeaponHits.slice(-64);
              }
              if (f.side === "human" && ["crazy-king", "kumaverson", "babayaga"].includes(f.kind)) {
                const preview = newcomerAttackPayload({
                  unitKind: f.kind,
                  targetKind: target.kind,
                  targetIsHeavy: ["crusher", "abomination", "takuya", "grappler", "gate-eater"].includes(target.kind),
                  areaRadius: crazyKingRadius,
                });
                const nearbyTargets = preview.radius > 0
                  ? g.fighters.filter((candidate) => candidate.side === "zombie"
                    && candidate.hp > 0
                    && candidate.combatReady
                    && candidate.contained !== true
                    && candidate.id !== target.id
                    && effectDistance(candidate, f) <= preview.radius)
                  : [];
                const newcomerEffects = resolveNewcomerAttackEffects({
                  unitKind: f.kind,
                  target,
                  nearbyTargets,
                  attackDamage,
                  targetIsHeavy: ["crusher", "abomination", "takuya", "grappler", "gate-eater"].includes(target.kind),
                  areaRadius: crazyKingRadius,
                });
                Object.assign(target, newcomerEffects.target);
                for (const nextSecondary of newcomerEffects.secondaryTargets) {
                  const secondary = g.fighters.find((candidate) => candidate.id === nextSecondary.id && candidate.side === "zombie" && candidate.hp > 0);
                  if (!secondary) continue;
                  const secondaryHpBefore = secondary.hp;
                  Object.assign(secondary, nextSecondary);
                  recordUnitDamage(g, f.kind, Math.max(0, secondaryHpBefore - secondary.hp));
                  if (f.kind === "crazy-king") g.roleMetrics.crazyKingSecondaryHits += 1;
                  g.damageTexts.push({ x: secondary.x, y: secondary.y - 43, value: String(Math.round(newcomerEffects.secondaryDamage)), life: .58, color: "#efb95f" });
                }
              }
              if (target.kind === "gate-eater"
                && g.definition.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL) {
                Object.assign(target, enforceGateEaterContainmentInvariant(target));
              }
              if (f.side === "human") {
                emitBattleBarkOnce(g, `contact:${f.kind}`, RANDOM_BATTLE_BARK_TRIGGER_IDS.CONTACT, f.kind as UnitKind);
                const targetIsHeavy = ["crusher", "abomination", "takuya", "grappler", "gate-eater"].includes(target.kind);
                const weaponEvent = f.kind === "crazy-king"
                  ? "attack"
                  : f.kind === "kumaverson"
                    ? "swing"
                    : f.kind === "babayaga"
                      ? "shot"
                      : f.kind === "mrs-chiha"
                        ? mrsLauncherBash ? "bash" : "shot"
                        : f.kind === "tky" || f.kind === "miyamoto-musashi"
                          ? "attack"
                          : f.kind === "mayo-chan"
                            ? "bite"
                          : null;
                const contactAudioX = f.kind === "crazy-king" || f.kind === "kumaverson" ? (f.x + target.x) / 2 : f.x;
                const defersMrsLauncherAudio = f.kind === "mrs-chiha" && !mrsLauncherBash;
                if (!defersMrsLauncherAudio) {
                  playProductionCue((weaponEvent && unitAudioCueFor(f.kind, "weapon", weaponEvent)) || weaponCueForUnit(f.kind), contactAudioX, {
                    priority: f.kind === "gunner" || f.kind === "brute" || f.kind === "crazy-king" ? 74 : 64,
                    cooldownMs: f.kind === "crazy-king" ? 110 : f.kind === "kumaverson" ? 120 : f.kind === "gunner" || f.kind === "babayaga" ? 45 : 70,
                    volume: f.kind === "crazy-king" ? .66 : f.kind === "kumaverson" ? .52 : undefined,
                    maxInstances: f.kind === "crazy-king" || f.kind === "kumaverson" ? 1 : 5,
                    fallbackCue: ["ranger", "gunner", "medic", "babayaga", "engineer"].includes(f.kind)
                      ? "ranged-shot"
                      : "melee-hit",
                  });
                }
                if (f.kind === "crazy-king") playProductionCue(unitAudioCueFor(f.kind, "weapon", "fleshHit"), contactAudioX, { priority: targetIsHeavy ? 76 : 67, cooldownMs: 110, volume: targetIsHeavy ? .62 : .54, maxInstances: 1 });
                if (f.kind === "kumaverson") {
                  playProductionCue(unitAudioCueFor(f.kind, "weapon", targetIsHeavy ? "heavyHit" : "hit"), contactAudioX, { priority: targetIsHeavy ? 76 : 68, cooldownMs: 125, volume: targetIsHeavy ? .56 : .48, maxInstances: 1 });
                  if (target.stunned > 0) playProductionCue(unitAudioCueFor(f.kind, "weapon", "stun"), contactAudioX, { priority: 75, cooldownMs: 220, volume: .45, maxInstances: 1 });
                }
                if (f.kind === "babayaga") {
                  playProductionCue(unitAudioCueFor(f.kind, "weapon", "hit"), target.x, { priority: 65, maxInstances: 4 });
                  if (target.hp <= 0 && isBabayagaPriorityTarget(target.kind)) {
                    playProductionCue(unitAudioCueFor(f.kind, "weapon", "specialKill"), target.x, { priority: 86, maxInstances: 1 });
                  } else if (f.attackSequence % 6 === 0) {
                    playProductionCue(unitAudioCueFor(f.kind, "weapon", "reload"), f.x, { priority: 52, maxInstances: 1 });
                  }
                }
                if (f.kind === "mayo-chan" && target.side === "zombie") {
                  target.mayoBiteSlowRemaining = Math.max(
                    target.mayoBiteSlowRemaining ?? 0,
                    MANUAL_ABILITY_REGISTRY["mayo-chan"].biteSlowSeconds,
                  );
                  addParticles(g, target.x, target.y - 18, f.manualAbility?.phase === "feral" ? "#b72d52" : "#e4ca76", 5);
                  if (f.manualAbility?.phase === "feral") {
                    f.targetId = null;
                    f.retargetIn = 0;
                    playProductionCue(unitAudioCueFor(f.kind, "weapon", "abilityRush"), f.x, {
                      priority: 72,
                      cooldownMs: 130,
                      maxInstances: 2,
                      fallbackCue: "melee-hit",
                    });
                  }
                }
                if (Math.random() < .34) playProductionCue(humanVoiceCueForUnit(f.kind, "attack"), f.x, {
                  priority: 67,
                  cooldownMs: 320,
                  volume: f.kind === "brute" || f.kind === "brawler" || f.kind === "crazy-king" || f.kind === "kumaverson" ? .92 : .78,
                  maxInstances: 2,
                });
                if (!splitMachineGunBurst && target.side === "zombie" && Math.random() < .48) playProductionCue(enemyVoiceCue(target.kind, "hurt"), target.x, {
                  priority: target.kind === "takuya" || target.kind === "gate-eater" ? 88 : 62,
                  cooldownMs: 210,
                  maxInstances: 3,
                });
              } else {
                playProductionCue(enemyVoiceCue(f.kind, "attack"), f.x, {
                  priority: f.kind === "takuya" || f.kind === "gate-eater" ? 94 : 65,
                  cooldownMs: 160,
                  maxInstances: 3,
                  fallbackCue: f.kind === "spitter" || f.kind === "ooze" ? "ranged-shot" : "melee-hit",
                });
                if (target.side === "human" && Math.random() < .5) playProductionCue(humanVoiceCueForUnit(target.kind, "hurt"), target.x, {
                  priority: 72,
                  cooldownMs: 300,
                  volume: target.kind === "brute" || target.kind === "brawler" ? .94 : .8,
                  maxInstances: 2,
                });
              }
              if (f.kind === "scout" && target.side === "zombie") target.marked = Math.max(target.marked, 3.2);
              if (!splitMachineGunBurst) {
                target.knock = Math.max(target.knock, f.kind === "brute" || f.kind === "abomination" || f.kind === "takuya" || f.kind === "gate-eater" ? 9 : 3);
              }
              f.attack = .18;
              f.attackVariant = f.kind === "mrs-chiha" && mrsLauncherBash ? "launcher-bash" : null;
              if (f.side === "human") {
                f.attack = f.attackVariant === "launcher-bash"
                  ? mrsChihaLauncherBashDuration()
                  : attackPresentationDuration(f.kind);
              }
              f.cooldown = enragedTakuya
                ? .9
                : f.kind === "crazy-king"
                  ? crazyKingAttackInterval(f.attackEvery, f.comboHits)
                    * (f.manualAbility?.phase === "active"
                      ? MANUAL_ABILITY_REGISTRY["crazy-king"].attackIntervalMultiplier
                      : 1)
                  : f.kind === "mayo-chan" && f.manualAbility?.phase === "feral"
                    ? f.attackEvery * MANUAL_ABILITY_REGISTRY["mayo-chan"].attackIntervalMultiplier
                  : f.attackEvery;
              if (!splitMachineGunBurst && !(f.side === "human" && f.kind === "mrs-chiha" && !mrsLauncherBash)) {
                g.damageTexts.push({ x: target.x + (Math.random() - .5) * 10, y: target.y - 45, value: String(Math.round(appliedAttack.targetDamage)), life: .65, color: f.side === "human" ? "#f6d278" : "#e98a72" });
              }
              if (roleEffect && f.abilityCooldown <= 0) {
                const roleCue = roleEffect === "scout" ? "索敵マーク" : roleEffect === "ranger" ? "対・毒吐き" : roleEffect === "brute" ? "対装甲破砕" : roleEffect === "brawler" ? "フィニッシュ" : roleEffect === "gunner" ? "直線制圧" : roleEffect === "crazy-king" ? "密集切断" : roleEffect === "kumaverson" ? "打撃・足止め" : roleEffect === "babayaga" ? "特殊個体分析" : null;
                if (roleCue) { g.damageTexts.push({ x: f.x, y: f.y - 66, value: roleCue, life: .75, color: "#ffe078" }); f.abilityCooldown = 1.8; emitBattleBark(g, "role-cue", f.kind, f.id); }
              }
              if (f.kind === "takuya") {
                for (const splash of g.fighters) {
                  if (splash.side === "human" && splash.id !== target.id && splash.hp > 0 && fighterDistance(splash, target) < 58) {
                    const resolved = applyIncomingHumanDamage(g, splash, 22, { attackKind: "melee" });
                    splash.flash = .12; splash.knock = 6;
                    g.damageTexts.push({ x: splash.x, y: splash.y - 46, value: String(Math.round(resolved.targetDamage)), life: .65, color: "#e98a72" });
                  }
                }
                addParticles(g, target.x, target.y + 2, "#b78656", 13); playCue("takuya-hit");
              }
              if (f.side === "human") {
                const emphasized = roleEffect === "brawler" || roleEffect === "gunner" || roleEffect === "crazy-king" || roleEffect === "kumaverson" || roleEffect === "babayaga";
                const ranged = ["ranger", "gunner", "medic", "babayaga", "engineer"].includes(f.kind)
                  || (f.kind === "mrs-chiha" && !mrsLauncherBash);
                if (f.kind === "gunner" && weaponDamageEvents) {
                  if (!splitMachineGunBurst) {
                    const firstRound = weaponDamageEvents[0];
                    addWeaponShot(g, {
                      sourceId: f.id,
                      targetId: target.id,
                      originX: f.x + 14,
                      originY: f.y - 32,
                      targetX: target.x,
                      targetY: target.y - 28,
                      weapon: f.kind,
                      shotIndex: firstRound.shotIndex,
                      recoil: firstRound.recoil,
                      casing: firstRound.casing,
                      hitStopSeconds: firstRound.hitStopSeconds,
                      impactDelaySeconds: firstRound.travelSeconds,
                    });
                    for (const event of weaponDamageEvents.slice(1)) {
                      g.pendingWeaponHits.push({
                        eventKind: "muzzle",
                        targetKind: "fighter",
                        sourceId: f.id,
                        targetId: target.id,
                        targetX: target.x,
                        targetY: target.y - 28,
                        originX: f.x + 14 - event.recoil * event.shotIndex * 2,
                        originY: f.y - 32 + event.shotIndex * 1.5,
                        remainingSeconds: event.offsetSeconds,
                        damage: 0,
                        weapon: f.kind,
                        shotIndex: event.shotIndex,
                        recoil: event.recoil,
                        casing: event.casing,
                        hitStopSeconds: event.hitStopSeconds,
                        impactDelaySeconds: event.travelSeconds,
                        applyDamage: false,
                      });
                    }
                  }
                } else if (!(f.kind === "mrs-chiha" && !mrsLauncherBash)) {
                  g.shots.push({ x: f.x + 14, y: f.y - 32, tx: target.x, ty: target.y - 28, life: .26, duration: .26, side: "human", sourceId: f.id, targetId: target.id, damageTargetId: target.id, effect: roleEffect ?? undefined, emphasized, style: ranged ? "projectile" : "melee", weapon: f.kind });
                }
                if (roleEffect && !["crazy-king", "kumaverson", "babayaga"].includes(f.kind)) playCue(`role-${roleEffect}` as SfxCueId);
                if (!productionMixerRef.current) {
                  if (["ranger", "gunner", "medic", "babayaga", "engineer"].includes(f.kind)) playCue("ranged-shot", { frequency: 310 + Math.random() * 50 });
                  else playCue("melee-hit");
                }
              } else if (f.kind === "spitter" || f.kind === "ooze") {
                g.shots.push({ x: f.x - 14, y: f.y - 32, tx: target.x, ty: target.y - 28, life: .2, duration: .2, side: "zombie", sourceId: f.id, targetId: target.id, damageTargetId: target.id, style: "projectile", weapon: "spitter" });
                if (!productionMixerRef.current) playCue("ranged-shot", { frequency: 205 });
              } else {
                addParticles(g, target.x, target.y - 18, target.kind === "takuya" || target.kind === "shade" ? "#b98a62" : target.side === "zombie" ? "#8aa66a" : "#c06d51", 3);
                if (!productionMixerRef.current && f.kind !== "takuya") playCue("melee-hit");
              }
            }
          } else if (!target && baseDistance <= f.range + 10) {
            if (f.cooldown <= 0) {
              if (f.side === "human") {
                if (f.kind === "gunner" && !raiderCanFire({ heat: f.weaponHeat, overheated: f.overheated })) {
                  f.cooldown = .1;
                  continue;
                }
                const beforeHit = g.barricadeHp;
                const roleEffect = roleEffectForAction({ unitKind: f.kind, action: "structure", targetKind: "infected-base" }) as RoleEffect | null;
                const structureDamage = f.kind === "brute"
                  ? resolveTataraStrikeDamage(f.damage, { targetType: "infected-base" })
                  : f.damage * structureDamageMultiplier(f.kind);
                const structureWeaponEvents = weaponDamageEventsFor(f.kind, structureDamage);
                const deferredStructureImpact = f.kind === "gunner" || f.kind === "mrs-chiha";
                if (!deferredStructureImpact) g.barricadeHp = Math.max(0, g.barricadeHp - structureDamage);
                if (f.kind === "brute") g.roleMetrics.tataraStructureDamage += structureDamage;
                if (f.kind === "gunner") {
                  const wasOverheated = f.overheated;
                  const heat = applyRaiderShots(
                    { heat: f.weaponHeat, overheated: f.overheated },
                    structureWeaponEvents.length,
                  );
                  f.weaponHeat = heat.heat;
                  f.overheated = heat.overheated;
                  if (!wasOverheated && heat.overheated) g.roleMetrics.raiderOverheats += 1;
                }
                f.attackSequence += 1;
                emitBattleBarkOnce(g, `enemy-base-attack:${f.kind}`, RANDOM_BATTLE_BARK_TRIGGER_IDS.ENEMY_BASE_ATTACK, f.kind as UnitKind);
                const structureWeaponEvent = f.kind === "crazy-king" ? "attack" : f.kind === "kumaverson" ? "swing" : f.kind === "babayaga" ? "shot" : null;
                const structureAudioX = f.kind === "crazy-king" || f.kind === "kumaverson" ? (f.x + enemyBaseTarget.x) / 2 : f.x;
                if (f.kind !== "mrs-chiha") {
                  playProductionCue((structureWeaponEvent && unitAudioCueFor(f.kind, "weapon", structureWeaponEvent)) || weaponCueForUnit(f.kind), structureAudioX, {
                    priority: f.kind === "brute" || f.kind === "gunner" || f.kind === "crazy-king" ? 76 : 64,
                    cooldownMs: f.kind === "crazy-king" ? 110 : f.kind === "kumaverson" ? 125 : f.kind === "gunner" || f.kind === "babayaga" ? 45 : 75,
                    volume: f.kind === "crazy-king" ? .64 : f.kind === "kumaverson" ? .5 : undefined,
                    maxInstances: f.kind === "crazy-king" || f.kind === "kumaverson" ? 1 : 5,
                    fallbackCue: f.kind === "brute" ? "structure-heavy" : "structure-light",
                  });
                }
                if (f.kind === "crazy-king") playProductionCue(unitAudioCueFor(f.kind, "weapon", "fleshHit"), structureAudioX, { priority: 74, volume: .56, cooldownMs: 110, maxInstances: 1 });
                if (f.kind === "kumaverson") playProductionCue(unitAudioCueFor(f.kind, "weapon", "heavyHit"), structureAudioX, { priority: 74, volume: .54, cooldownMs: 130, maxInstances: 1 });
                if (f.kind === "babayaga" && f.attackSequence % 6 === 0) playProductionCue(unitAudioCueFor(f.kind, "weapon", "reload"), f.x, { priority: 52, maxInstances: 1 });
                if (f.kind === "gunner") {
                  const firstRound = structureWeaponEvents[0];
                  addWeaponShot(g, {
                    sourceId: f.id,
                    targetId: null,
                    originX: f.x + 14,
                    originY: f.y - 32,
                    targetX: enemyBaseTarget.x,
                    targetY: enemyBaseTarget.y,
                    weapon: f.kind,
                    shotIndex: firstRound.shotIndex,
                    recoil: firstRound.recoil,
                    casing: firstRound.casing,
                    hitStopSeconds: firstRound.hitStopSeconds,
                    impactDelaySeconds: firstRound.travelSeconds,
                  });
                  for (const event of structureWeaponEvents) {
                    const sharedEvent = {
                      targetKind: "enemy-base" as const,
                      sourceId: f.id,
                      targetId: null,
                      targetX: enemyBaseTarget.x,
                      targetY: enemyBaseTarget.y,
                      originX: f.x + 14 - event.recoil * event.shotIndex * 2,
                      originY: f.y - 32 + event.shotIndex * 1.5,
                      weapon: f.kind as UnitKind,
                      shotIndex: event.shotIndex,
                      recoil: event.recoil,
                      casing: event.casing,
                      hitStopSeconds: event.hitStopSeconds,
                      impactDelaySeconds: event.travelSeconds,
                    };
                    if (event.shotIndex > 0) {
                      g.pendingWeaponHits.push({
                        ...sharedEvent,
                        eventKind: "muzzle",
                        remainingSeconds: event.offsetSeconds,
                        damage: 0,
                        applyDamage: false,
                      });
                    }
                    g.pendingWeaponHits.push({
                      ...sharedEvent,
                      eventKind: "impact",
                      remainingSeconds: event.hitOffsetSeconds,
                      damage: event.damage,
                      applyDamage: true,
                    });
                  }
                  g.pendingWeaponHits = g.pendingWeaponHits.slice(-64);
                } else if (f.kind === "mrs-chiha") {
                  const grenadeRound = structureWeaponEvents[0];
                  const sharedGrenadeEvent = {
                    targetKind: "enemy-base" as const,
                    sourceId: f.id,
                    targetId: null,
                    targetX: enemyBaseTarget.x,
                    targetY: enemyBaseTarget.y,
                    originX: f.x + 14,
                    originY: f.y - 32,
                    weapon: f.kind as UnitKind,
                    shotIndex: grenadeRound.shotIndex,
                    recoil: grenadeRound.recoil,
                    casing: grenadeRound.casing,
                    hitStopSeconds: grenadeRound.hitStopSeconds,
                    impactDelaySeconds: grenadeRound.travelSeconds,
                  };
                  g.pendingWeaponHits.push({
                    ...sharedGrenadeEvent,
                    eventKind: "muzzle",
                    remainingSeconds: grenadeRound.offsetSeconds,
                    damage: 0,
                    applyDamage: false,
                  }, {
                    ...sharedGrenadeEvent,
                    eventKind: "impact",
                    remainingSeconds: grenadeRound.hitOffsetSeconds,
                    damage: grenadeRound.damage,
                    applyDamage: true,
                  });
                  g.pendingWeaponHits = g.pendingWeaponHits.slice(-64);
                } else {
                  g.barricadeHitFlash = .2;
                  g.barricadeHitY = f.y;
                  g.damageTexts.push({ x: enemyBaseTarget.x, y: enemyBaseTarget.y - 14, value: `-${Math.round(structureDamage)}`, life: .7, color: "#ffd06b" });
                  addParticles(g, enemyBaseTarget.x, enemyBaseTarget.y, "#e78b45", f.kind === "brute" ? 10 : 5);
                  if (!roleEffect && ["ranger", "medic", "babayaga", "engineer"].includes(f.kind)) {
                    g.shots.push({ x: f.x + 14, y: f.y - 32, tx: enemyBaseTarget.x, ty: enemyBaseTarget.y, life: .2, duration: .2, side: "human", style: "projectile", weapon: f.kind });
                  }
                }
                if (roleEffect && !deferredStructureImpact) {
                  g.shots.push({ x: f.x + 14, y: f.y - 32, tx: enemyBaseTarget.x, ty: enemyBaseTarget.y, life: .26, duration: .26, side: "human", effect: roleEffect, emphasized: true, style: ["ranger", "gunner", "medic", "babayaga", "engineer"].includes(f.kind) ? "projectile" : "melee", weapon: f.kind });
                  if (!productionMixerRef.current && !["crazy-king", "kumaverson", "babayaga"].includes(f.kind)) {
                    playCue(`role-${roleEffect}` as SfxCueId);
                  }
                } else if (roleEffect === "gunner" && !productionMixerRef.current) {
                  playCue("role-gunner");
                }
                if (!deferredStructureImpact && !g.barricadeBucklingAnnounced && beforeHit > g.barricadeMaxHp * .7 && g.barricadeHp <= g.barricadeMaxHp * .7) {
                  g.barricadeBucklingAnnounced = true; g.banner = "感染拠点 // 損傷"; g.bannerTime = 1.5; playCue("base-damaged");
                }
                if (!deferredStructureImpact && !g.barricadeCriticalAnnounced && beforeHit > g.barricadeMaxHp * .35 && g.barricadeHp <= g.barricadeMaxHp * .35) {
                  g.barricadeCriticalAnnounced = true; g.banner = "感染拠点 // 大破"; g.bannerTime = 1.7; g.flashOverlay = Math.max(g.flashOverlay, .12); playCue("base-critical");
                }
                if (!productionMixerRef.current && f.kind !== "mrs-chiha") playCue(f.kind === "brute" ? "structure-heavy" : "structure-light");
              } else {
                const beforeHit = g.baseHp;
                const siegeDamage = crawlerSiegeDamage(f.damage, g.phase);
                g.baseHp = Math.max(0, g.baseHp - siegeDamage);
                playProductionCue(enemyVoiceCue(f.kind, "attack"), f.x, {
                  priority: f.kind === "takuya" || f.kind === "gate-eater" ? 94 : 66,
                  cooldownMs: 170,
                  maxInstances: 3,
                  fallbackCue: f.kind === "takuya" || f.kind === "gate-eater" ? "takuya-slam" : "structure-light",
                });
                g.crawlerHitFlash = .18;
                if (beforeHit === g.baseMaxHp) { g.banner = "突破発生 — 移動拠点が攻撃を受けています"; g.bannerTime = 1.4; }
                if (g.crawlerHitSfxCooldown <= 0 && g.baseHp > 0) {
                  g.crawlerHitSfxCooldown = .28;
                  playCue("crawler-hit");
                  addParticles(g, BASE_X + 5, f.y - 10, "#d76a45", 5);
                  g.damageTexts.push({ x: BASE_X + 12, y: f.y - 36, value: `移動拠点 -${siegeDamage}`, life: .7, color: "#ff7658" });
                }
                if (!g.criticalAnnounced && beforeHit > 130 && g.baseHp <= 130 && g.baseHp > 0) {
                  g.criticalAnnounced = true; g.banner = "移動拠点 危険状態"; g.bannerTime = 1.6; g.flashOverlay = Math.max(g.flashOverlay, .12);
                  g.crawlerHitSfxCooldown = Math.max(g.crawlerHitSfxCooldown, .5); playCue("crawler-critical");
                  emitBattleBark(g, "crawler-critical", "crawler", "crawler");
                }
              }
              const enragedSiege = f.kind === "takuya" && f.hp / f.maxHp <= .5;
              f.attackVariant = null;
              f.attack = f.side === "human" ? attackPresentationDuration(f.kind) : .18;
              f.cooldown = enragedSiege ? 1 : f.attackEvery;
            }
          } else if (target && f.side === "human") {
            const dx = target.x - f.x;
            const stoppingDistance = Math.max(18, f.range + target.bodyRadius * .55);
            const desiredX = allyIntent?.destinationX ?? (target.x - Math.sign(dx || 1) * stoppingDistance);
            if (Math.abs(desiredX - f.x) > 2) {
              f.x += Math.sign(desiredX - f.x) * Math.min(Math.abs(desiredX - f.x), humanMovementSpeed * dt);
              f.x = Math.max(humanMinX, Math.min(humanMaxX, f.x));
            }
            const destinationLane = (f.navigationRecovery.recoveryLane ?? (f.range > 64
              ? f.anchorLane ?? f.lane
              : allyIntent?.destinationLane ?? f.anchorLane ?? f.lane)) as Lane;
            const laneStep = advanceTowardLane({
              y: f.y,
              currentLane: f.lane,
              destinationLane,
              laneCenters: activeLaneCenters,
              laneSpeed: humanLaneSpeed,
              seconds: dt,
              settleTolerance: 2,
              hysteresis: 5,
            });
            f.y = laneStep.y;
            f.lane = laneStep.lane as Lane;
          } else if (target && f.side === "zombie") {
            // The CRAWLER remains the objective: enemies advance on their route and only stop for a physical blocker.
            f.x = advanceZombieX({ enemyX: f.x, speed: f.speed * mayoBiteSlowMultiplier * Math.min(f.slowMultiplier ?? 1, f.suppressionMultiplier), seconds: dt, burning: false, targetFloor: zombieTargetFloor });
            const routeY = activeLaneCenters[f.navigationRecovery.recoveryLane ?? f.anchorLane ?? f.lane];
            const dy = routeY - f.y;
            if (Math.abs(dy) > 2) f.y += Math.sign(dy) * Math.min(Math.abs(dy), f.laneSpeed * mayoBiteSlowMultiplier * dt);
            f.y = Math.max(activeLaneCenters[0], Math.min(activeLaneCenters[2], f.y));
            f.lane = activeLaneForY(f.y, f.lane);
          } else {
            if (f.side === "human") {
              const desiredX = allyIntent?.destinationX ?? f.x;
              if (Math.abs(desiredX - f.x) > 2) {
                f.x += Math.sign(desiredX - f.x) * Math.min(Math.abs(desiredX - f.x), humanMovementSpeed * dt);
                f.x = Math.max(humanMinX, Math.min(humanMaxX, f.x));
              }
              const laneStep = advanceTowardLane({
                y: f.y,
                currentLane: f.lane,
                destinationLane: (f.navigationRecovery.recoveryLane ?? f.anchorLane ?? f.lane) as Lane,
                laneCenters: activeLaneCenters,
                laneSpeed: humanLaneSpeed,
                seconds: dt,
                settleTolerance: 2,
                hysteresis: 5,
              });
              f.y = laneStep.y;
              f.lane = laneStep.lane as Lane;
            } else {
              f.x = advanceZombieX({ enemyX: f.x, speed: f.speed * mayoBiteSlowMultiplier * Math.min(f.slowMultiplier ?? 1, f.suppressionMultiplier), seconds: dt, burning: false });
            }
            if (f.side === "zombie" && f.anchorLane !== null) {
              const dy = activeLaneCenters[f.navigationRecovery.recoveryLane ?? f.anchorLane] - f.y;
              if (Math.abs(dy) > 2) f.y += Math.sign(dy) * Math.min(Math.abs(dy), f.laneSpeed * mayoBiteSlowMultiplier * dt);
              f.y = Math.max(activeLaneCenters[0], Math.min(activeLaneCenters[2], f.y));
              f.lane = activeLaneForY(f.y, f.lane);
            }
          }

          if (f.side === "human" || f.side === "zombie") {
            let appliedSeparation = false;
            for (const other of g.fighters) {
              if (other.side !== f.side || other.id >= f.id || other.hp <= 0 || !other.combatReady) continue;
              const separationStep = sameSideSeparationStep({
                id: f.id,
                side: f.side,
                x: f.x,
                y: f.y,
                bodyRadius: f.bodyRadius,
                otherX: other.x,
                otherY: other.y,
                otherBodyRadius: other.bodyRadius,
                spawnGrace: f.spawnGrace,
                laneMinY: activeLaneCenters[0],
                laneMaxY: activeLaneCenters[2],
              });
              appliedSeparation ||= separationStep.dx !== 0 || separationStep.dy !== 0;
              f.x += separationStep.dx;
              f.y += separationStep.dy;
            }
            if (f.side === "human") f.x = Math.max(humanMinX, f.x);
            else if (zombieTargetFloor !== null) f.x = Math.max(zombieTargetFloor, f.x);
            f.y = Math.max(activeLaneCenters[0], Math.min(activeLaneCenters[2], f.y));
            // Pair separation is a constrained solver step: project that step
            // onto the walkable floor here, then leave the frame-level audit
            // below independent so other movement sources remain detectable.
            if (appliedSeparation) {
              const separatedPosition = clampToWalkable(movementStageGeometry, {
                x: f.x,
                y: f.y,
                bodyRadius: f.bodyRadius,
              });
              f.x = separatedPosition.x;
              f.y = separatedPosition.y;
            }
            f.lane = activeLaneForY(f.y, f.lane);
          }
          if (f.side === "human" && f.combatReady && f.hp > 0) {
            const qaBarrier = bossFoundationQaRef.current.barrierChallenge;
            if (qaBarrier
              && qaBarrier.humanId === f.id
              && qaBarrier.attempted === false) {
              f.x = qaBarrier.targetX;
              qaBarrier.attempted = true;
            }
            for (const boss of g.fighters) {
              const barrier = enforceBossBodyBarrier({
                mover: f,
                boss,
                padding: 2,
                previousX: movementStartX,
              });
              if (barrier.blocked) {
                f.x = Math.min(f.x, barrier.x);
                if (qaBarrier
                  && qaBarrier.humanId === f.id
                  && qaBarrier.bossId === boss.id) {
                  qaBarrier.blocked = true;
                }
              }
            }
            if (qaBarrier && qaBarrier.humanId === f.id && qaBarrier.attempted) {
              qaBarrier.resultingX = f.x;
            }
          }
        }

        const stageGeometry = movementStageGeometry;
        for (const fighter of g.fighters) {
          if (!fighter.combatReady || fighter.hp <= 0) continue;
          const laneAnchorError = Math.abs(fighter.y - activeLaneCenters[fighter.lane]);
          g.stationMetrics.maxLaneAnchorError = Math.max(g.stationMetrics.maxLaneAnchorError, laneAnchorError);
          const grounded = clampToWalkable(stageGeometry, {
            x: fighter.x,
            y: fighter.y,
            bodyRadius: fighter.bodyRadius,
          });
          if (grounded.clamped) g.stationMetrics.offFloorSteps += 1;
          fighter.x = grounded.x;
          fighter.y = grounded.y;
          fighter.lane = activeLaneForY(fighter.y, fighter.lane);
          const lockedTarget = fighter.targetId === null ? undefined : fighterById.get(fighter.targetId);
          const lockedObject = fighter.targetObjectId === null
            ? undefined
            : g.battlefieldObjects.find((object) => object.id === fighter.targetObjectId);
          const targetEngaged = Boolean(lockedTarget
            && fighterDistance(fighter, lockedTarget) <= fighter.range + lockedTarget.bodyRadius + 2);
          const objectEngaged = Boolean(lockedObject
            && Math.hypot(fighter.x - lockedObject.x, fighter.y - lockedObject.y) <= fighter.range + 34);
          const crawlerEngaged = fighter.side === "zombie" && isCrawlerAttackThreat({
            enemyX: fighter.x,
            enemyRange: fighter.range,
            baseX: BASE_X,
            blockingObject: lockedObject,
            combatReady: fighter.combatReady,
            hp: fighter.hp,
            contained: fighter.contained,
          });
          const desiredLane = fighter.navigationRecovery.recoveryLane ?? fighter.anchorLane ?? fighter.lane;
          const desiredX = fighter.side === "human"
            ? fighter.aiDestinationX
            : lockedTarget?.x ?? lockedObject?.x ?? BASE_X;
          const desiredY = activeLaneCenters[desiredLane];
          const moving = Math.hypot(desiredX - fighter.x, desiredY - fighter.y) > 3;
          const previousRecoveryCount = fighter.navigationRecovery.recoveryCount;
          fighter.navigationRecovery = advanceNavigationRecovery({
            state: fighter.navigationRecovery,
            x: fighter.x,
            y: fighter.y,
            desiredX,
            desiredY,
            lane: fighter.anchorLane ?? fighter.lane,
            laneCount: activeLaneCenters.length,
            seed: fighter.id,
            seconds: dt,
            moving,
            engaged: targetEngaged || objectEngaged || crawlerEngaged,
          });
          g.stationMetrics.aiRecoveries += Math.max(
            0,
            fighter.navigationRecovery.recoveryCount - previousRecoveryCount,
          );
        }

        if (g.definition.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL) {
          for (const fighter of g.fighters) {
            if (fighter.kind === "gate-eater") {
              Object.assign(fighter, enforceGateEaterContainmentInvariant(fighter));
            }
          }
        }
        const dead = g.fighters.filter((fighter) => fighter.hp <= 0);
        for (const fighter of dead) {
          if (!claimDefeatResolution(g.resolvedDefeatIds, fighter.id)) continue;
          if (fighter.side === "human" && fighter.kind === "mayo-chan") {
            if (beginMayoRetreat(g, fighter, "injury")) {
              g.unitsLost++;
              emitBattleBark(g, "ally-down", "medic", `mayo-retreat-${fighter.id}`);
              playProductionCue(unitAudioCueFor("mayo-chan", "voice", "hurt"), fighter.x, {
                priority: 88,
                cooldownMs: 300,
                maxInstances: 1,
                fallbackCue: "melee-hit",
              });
              playProductionCue(unitAudioCueFor("mayo-chan", "voice", "retreat"), fighter.x, {
                priority: 86,
                cooldownMs: 1000,
                maxInstances: 1,
                fallbackCue: "melee-hit",
              });
            }
            continue;
          }
          addParticles(g, fighter.x, fighter.y - 15, fighter.kind === "takuya" || fighter.kind === "gate-eater" || fighter.kind === "shade" ? "#c08d62" : fighter.side === "zombie" ? "#7e965e" : "#b0614e", fighter.kind === "takuya" || fighter.kind === "gate-eater" ? 20 : 11);
          if (fighter.side === "human") playProductionCue(humanVoiceCueForUnit(fighter.kind, "death"), fighter.x, {
            priority: 88,
            cooldownMs: 220,
            volume: fighter.kind === "brute" || fighter.kind === "brawler" ? .96 : .86,
            maxInstances: 3,
          });
          else playProductionCue(enemyVoiceCue(fighter.kind, "death"), fighter.x, {
            priority: fighter.kind === "takuya" || fighter.kind === "gate-eater" ? 98 : 82,
            cooldownMs: 180,
            volume: fighter.kind === "takuya" || fighter.kind === "gate-eater" ? 1 : .88,
            maxInstances: 4,
          });
          if (fighter.side === "human" && fighter.kind === "crazy-king"
            && !g.fighters.some((candidate) => candidate.id !== fighter.id && candidate.side === "human" && candidate.kind === "crazy-king" && candidate.hp > 0)) {
            productionMixerRef.current?.stopInstance(BATTLE_AUDIO_LOOP_CONTRACTS.crazyKingChainsaw.instanceKey, { fadeMs: 90 });
            playProductionCue(unitAudioCueFor("crazy-king", "weapon", "stop"), fighter.x, { priority: 68, maxInstances: 1 });
          }
          const lifecycle = fighter.side === "zombie"
            ? beginEnemyDeath(createEnemyLifecycle({ id: fighter.id, x: fighter.x, y: fighter.y, lane: fighter.lane, kind: fighter.kind, side: fighter.side, variant: fighter.variant, hp: 0 }))
            : beginAllyDeath(createAllyLifecycle({ id: fighter.id, x: fighter.x, y: fighter.y, lane: fighter.lane, kind: fighter.kind, inheritedKind: fighter.kind, side: fighter.side, variant: fighter.variant, hp: 0 }));
          g.corpses.push({
            ...lifecycle,
            id: fighter.id,
            x: fighter.x,
            y: fighter.y,
            lane: fighter.lane,
            side: fighter.side,
            kind: fighter.kind,
            life: fighter.side === "human" ? 14 : 10,
            variant: fighter.variant,
            prevented: false,
          } as Corpse);
          if (fighter.side === "zombie") {
            g.kills++; g.combo++; g.comboTime = 2.3;
            addCombatMetric(g.combatMetrics.enemyDefeatsByKind, fighter.kind, 1);
            g.maxCombo = Math.max(g.maxCombo, g.combo);
            g.scrap += scrapReward(fighter.kind);
            g.supportGauge = Math.min(SUPPORT_GAUGE_MAX, g.supportGauge + supportGaugeReward(fighter.kind));
            const isOutbreakBoss = g.definition.operationCategory === "outbreak"
              && fighter.kind === g.definition.bossEnemyKind;
            if (isOutbreakBoss
              || (fighter.kind === g.definition.bossEnemyKind && g.definition.bossUnlocksEnemyBase)) {
              g.bossDefeatPending = true;
              if (!isOutbreakBoss) g.barricadeVulnerable = true;
              const defeatedBossName = bossDefinitionForEnemyKind(fighter.kind)?.displayName
                ?? enemyContentFor(fighter.kind)?.displayName
                ?? "大型感染体";
              g.banner = g.definition.operationCategory === "outbreak"
                ? `${defeatedBossName}撃破 — 残存感染体を掃討`
                : fighter.kind === "takuya"
                ? "TAKUYA撃破 — 感染拠点が露出"
                : `${defeatedBossName}撃破 — 感染核が露出`;
              g.bannerTime = 3.4; g.flashOverlay = .3;
              g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.takuyaDefeat);
              if (g.definition.operationCategory === "outbreak") {
                emitBattleBark(g, "victory", "guide", `outbreak-boss-down-${fighter.kind}`);
              } else if (fighter.kind === "takuya") {
                playCue("takuya-down");
                if (!emitBattleBark(g, "base-exposed", "crawler", "tactical")) emitBattleBark(g, "takuya-down", "crawler", "tactical");
              } else {
                emitBattleBark(g, "base-exposed", "crawler", "tactical");
              }
            } else if (fighter.kind === "gate-eater"
              && g.definition.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL) {
              g.bossDefeated = true;
              const sealDoorX = Number(g.definition.missionConfig.sealDoorX ?? 867);
              if (g.researchContainer) {
                g.researchContainer = {
                  ...g.researchContainer,
                  x: Math.max(g.researchContainer.x, sealDoorX + 18),
                  exposed: true,
                  contained: true,
                };
              }
              g.stageMission = {
                ...g.stageMission,
                gateEaterSeen: true,
                gateEaterDefeated: true,
                gateEaterContained: true,
                researchContainerExposed: true,
                researchContainerContained: true,
              };
              g.banner = "改札喰い撃破 — 研究容器を封鎖区画へ確保";
              g.bannerTime = 3.4;
              g.flashOverlay = .3;
              g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.takuyaDefeat);
            }
          } else {
            g.unitsLost++;
            emitBattleBark(g, "ally-down", "medic", `ally-down-${fighter.id}`);
          }
        }
        g.fighters = g.fighters.filter((fighter) => fighter.hp > 0 && fighter.mayoRetreat?.complete !== true);

        const beforeFireStates = new Map(g.corpses.map((corpse) => [corpse.id, corpse.state]));
        const ignition = (igniteAllyCorpsesInFire as unknown as (input: {
          lifecycles: Corpse[]; fireAreas: AreaEffect[]; paused: boolean;
        }) => { lifecycles: Corpse[]; ignitedIds: number[] })({ lifecycles: g.corpses, fireAreas: g.areaEffects, paused: false });
        g.corpses = ignition.lifecycles as Corpse[];
        for (const corpseId of ignition.ignitedIds) {
          if (beforeFireStates.get(corpseId) === "burning") continue;
          const corpse = g.corpses.find((candidate) => candidate.id === corpseId);
          if (!corpse) continue;
          corpse.prevented = true;
          addParticles(g, corpse.x, corpse.y - 12, "#f26a35", 12);
          playCue("burn-start");
        }

        const revived: Fighter[] = [];
        const nextCorpses: Corpse[] = [];
        for (const corpse of g.corpses) {
          if (corpse.side === "zombie") {
            const next = advanceEnemyLifecycle(corpse, dt, { offscreen: corpse.x < -80 || corpse.x > W + 80 }) as Corpse;
            next.life = next.state === "dying" ? 2 : next.state === "corpse" ? 4 : next.state === "ashing" ? Math.max(.1, 2 - next.phaseElapsed) : -1;
            if (next.state !== "removed") nextCorpses.push(next);
            continue;
          }

          const next = advanceAllyLifecycle(corpse, dt) as Corpse;
          if (corpse.state !== "infection-warning" && next.state === "infection-warning") {
            emitBattleBark(g, "infection-warning", "medic", `infection-${corpse.id}`);
            playProductionCue("infection-warning-01", corpse.x, {
              priority: 78,
              cooldownMs: 700,
              maxInstances: 2,
            });
            playProductionCue("infection-twitch-01", corpse.x, {
              priority: 64,
              cooldownMs: 520,
              maxInstances: 2,
            });
          }
          if (next.state === "generic-zombie") {
            const generic = createGenericZombieSpawn(next);
            if (!generic) continue;
            const data = enemyStatsForWave("turned", g.wave); const id = g.nextId++;
            revived.push({
               id, side: "zombie", kind: "turned", aiProfile: enemyContentFor("turned")?.aiProfile ?? "nearest", lane: generic.lane as Lane, anchorLane: generic.lane as Lane,
              x: generic.x, y: generic.y, hp: data.hp, maxHp: data.hp, speed: data.speed, damage: data.damage,
              range: data.range, cooldown: Math.max(.4, generic.riseLockRemaining), supportCooldown: 0, attackEvery: data.attackEvery,
              flash: 0, step: 0, attack: 0, knock: 0, variant: corpse.variant,
              targetId: null, targetObjectId: null, retargetIn: 0, nextLaneDecisionAt: g.time + .8, bodyRadius: bodyRadiusFor("turned"), laneSpeed: enemyLaneSpeedFor("turned"), spawnGrace: generic.riseLockRemaining,
               combatReady: true, gateEntering: false, gateEntrySpeed: 0, combatReadyX: 0, contained: false,
               marked: 0, stunned: 0, bleedRemaining: 0, bleedDamagePerSecond: 0, aiDestinationX: corpse.x, aiMoveDirection: 0,
               navigationRecovery: createNavigationRecoveryState({ x: generic.x, y: generic.y, lane: generic.lane }),
               abilityCooldown: 0, abilityWindup: 0, attackSequence: 0,
               stationAbility: createStationAbilityRuntime("turned"),
               ...createUnitRoleRuntime(),
            });
            addParticles(g, corpse.x, corpse.y - 20, "#90a965", 14); playCue("turned");
            continue;
          }
          if (next.state === "ash") next.life = corpse.state === "ash" ? corpse.life - dt : 2;
          else next.life = Math.max(next.life, 2.1);
          if (next.life > 0) nextCorpses.push(next);
        }
        if (revived.length) g.fighters.push(...revived);
        const enemyCorpses = enforceEnemyCorpseCaps(nextCorpses.filter((corpse) => corpse.side === "zombie")) as Corpse[];
        g.corpses = [...enemyCorpses.filter((corpse) => corpse.state !== "removed"), ...nextCorpses.filter((corpse) => corpse.side === "human")];
        resumeBattleAudioLoops(g);

        for (const p of g.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 180 * dt; }
        g.particles = g.particles.filter((p) => p.life > 0);
        for (const d of g.damageTexts) { d.life -= dt; d.y -= dt * 23; }
        g.damageTexts = g.damageTexts.filter((d) => d.life > 0);
        for (const shot of g.shots) shot.life -= dt;
        g.shots = g.shots.filter((shot) => shot.life > 0);
        g.particles = capRenderArray(g.particles, "particles") as Particle[];
        g.shots = capRenderArray(g.shots, "shots") as Shot[];
        g.damageTexts = capRenderArray(g.damageTexts, "damageTexts") as DamageText[];

        dispatchSituationalBattleBarks(g);
        if (!g.survivalRun) dispatchBattleStoryEvents(g);
        const bossActiveOrIncoming = g.fighters.some((fighter) => isBossEnemyKind(fighter.kind)
            && fighter.hp > 0 && fighter.contained !== true)
          || g.enemySpawn.pending.some((entry) => isBossEnemyKind(entry.kind));
        const enragedTakuya = g.fighters.find((fighter) => fighter.kind === "takuya" && fighter.hp > 0 && fighter.hp / fighter.maxHp <= .5);
        if (enragedTakuya && !g.takuyaEnragedAnnounced) {
          g.takuyaEnragedAnnounced = true;
          emitBattleBark(g, "takuya-enraged", "gunner", "takuya-enraged");
        }
        syncMusicMode(bossActiveOrIncoming ? "boss" : g.phase >= 2 || g.baseHp <= 260 ? "danger" : "normal");

        const stationResolution = stationSpatialSnapshot({
          missionType: g.definition.missionType,
          missionRuntime: g.stageMission,
          config: g.definition.missionConfig,
          fighters: g.fighters,
          hazards: g.stationHazards,
          researchContainer: g.researchContainer,
          laneCenters: activeLaneCenters,
          eventIndex: g.eventIndex,
          timelineLength: g.definition.timeline.length,
          pendingSpawnCount: g.enemySpawn.pending.length,
        });
        const outcome = g.paused ? null : battleOutcomeFor(g.definition, {
          ...g,
          wavesResolved: stationResolution.wavesResolved,
        });
        if (outcome && !g.survivalRun) {
          // A simultaneous collapse is a loss: protecting the crawler always remains mandatory.
          g.won = outcome === "won";
          const enemyBaseDestroyed = g.barricadeHp <= 0;
          g.shake = enemyBaseDestroyed ? triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.enemyBaseCollapse) : createCameraShakeRuntime();
          g.enemyBaseCollapse = 0;
          emitBattleBark(g, g.won ? "victory" : "defeat", "guide", "tactical");
          g.over = true;
          g.resultPresented = !enemyBaseDestroyed;
          if (!enemyBaseDestroyed) setEnd({
            resultId: g.resultId,
            stageId: g.definition.operationId,
            won: g.won,
            time: g.time,
            wave: g.wave,
            kills: g.kills,
            scrap: g.scrap,
            baseHp: Math.max(0, g.baseHp),
            baseMaxHp: g.baseMaxHp,
            maxCombo: g.maxCombo,
            unitsLost: g.unitsLost,
            bossDefeated: g.bossDefeated,
            enemyBaseDestroyed,
            encounteredEnemyKinds: [...g.enemyKindsSeen],
            enemyDefeatsByKind: { ...g.combatMetrics.enemyDefeatsByKind },
            unitStats: {
              damageByUnit: { ...g.combatMetrics.damageByUnit },
              damageTakenByUnit: { ...g.combatMetrics.damageTakenByUnit },
              healingByUnit: { ...g.combatMetrics.healingByUnit },
            },
            missionRuntime: g.definition.missionType === "escort" || g.definition.missionType === "sequential-seal"
              ? { ...g.stageMission }
              : undefined,
          });
          chooseAction(null);
          stopMusic(); stopSfx();
          if (enemyBaseDestroyed) playCue("base-collapse");
          playCue(g.won ? "victory" : "defeat");
          playEndJingle(g.won);
        }
      }

      if (g.over && !g.resultPresented && !g.survivalRun) {
        const collapseStep = advanceEnemyBaseCollapse({ barricadeHp: g.barricadeHp, elapsed: g.enemyBaseCollapse, seconds: dt, duration: ENEMY_BASE_COLLAPSE_SECONDS });
        g.enemyBaseCollapse = collapseStep.elapsed;
        if (collapseStep.complete) {
          g.resultPresented = true;
          setEnd({
            resultId: g.resultId,
            stageId: g.definition.operationId,
            won: g.won,
            time: g.time,
            wave: g.wave,
            kills: g.kills,
            scrap: g.scrap,
            baseHp: Math.max(0, g.baseHp),
            baseMaxHp: g.baseMaxHp,
            maxCombo: g.maxCombo,
            unitsLost: g.unitsLost,
            bossDefeated: g.bossDefeated,
            enemyBaseDestroyed: g.barricadeHp <= 0,
            encounteredEnemyKinds: [...g.enemyKindsSeen],
            enemyDefeatsByKind: { ...g.combatMetrics.enemyDefeatsByKind },
            unitStats: {
              damageByUnit: { ...g.combatMetrics.damageByUnit },
              damageTakenByUnit: { ...g.combatMetrics.damageTakenByUnit },
              healingByUnit: { ...g.combatMetrics.healingByUnit },
            },
          });
        }
      }

      drawWorld(
        ctx,
        g,
        backgroundRef.current,
        spriteRefs.current,
        stageObjectRefs.current,
        enemyBaseSpriteRef.current,
        qaScenario?.mode === "station",
      );
      performanceCounters.renderFrames += 1;
      if (g.bannerTime > 0 && g.running) {
        const compact = compactBattleViewport();
        const bannerWidth = compact ? 268 : 356;
        const bannerHeight = compact ? 32 : 54;
        const bannerX = (W - bannerWidth) / 2;
        const bannerY = compact ? 132 : 70;
        ctx.fillStyle = "rgba(15,14,14,.82)"; ctx.fillRect(bannerX, bannerY, bannerWidth, bannerHeight);
        ctx.strokeStyle = "#d79647"; ctx.strokeRect(bannerX + .5, bannerY + .5, bannerWidth - 1, bannerHeight - 1);
        ctx.fillStyle = "#f0d2a3"; ctx.font = `bold ${compact ? 12 : 19}px monospace`; ctx.textAlign = "center";
        ctx.fillText(g.banner, W / 2, bannerY + (compact ? 21 : 34)); ctx.textAlign = "left";
      }
      if (now - lastHudRef.current > 100) {
        lastHudRef.current = now;
        const bossHud = g.fighters
          .map((fighter) => bossHudSnapshot(fighter))
          .find((snapshot) => snapshot !== null);
        const nearestEnemyX = g.fighters.reduce((nearest, fighter) => fighter.side === "zombie" && fighter.hp > 0 && fighter.combatReady ? Math.min(nearest, fighter.x) : nearest, Infinity);
        const canvasRect = canvas.getBoundingClientRect();
        const transform = canvasTransformRef.current;
        const fighterScreenSize = (fighter: Fighter) => {
          const authored = spriteBattleDisplaySizeFor(fighter.kind);
          const compactScale = compactBattleViewport() ? COMPACT_BATTLE_SPRITE_SCALE : 1;
          const depthScale = activeBattlefieldDepthScale(fighter.y);
          return {
            w: authored.w * compactScale * depthScale,
            h: authored.h * compactScale * depthScale,
          };
        };
        const frameElement = canvas.closest(".game-frame");
        const obstacleRects = [...(frameElement?.querySelectorAll(
          ".top-hud,.survival-hud,.boss-hud,.crawler-alert,.battle-barks,.placement-hint,.bottom-hud,.stats-strip",
        ) ?? [])].map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            ownerId: null,
            x: rect.left - canvasRect.left,
            y: rect.top - canvasRect.top,
            width: rect.width,
            height: rect.height,
          };
        });
        for (const fighter of g.fighters) {
          if (fighter.hp <= 0) continue;
          const size = fighterScreenSize(fighter);
          obstacleRects.push({
            ownerId: fighter.id,
            x: transform.offsetX + fighter.x * transform.scale - size.w * transform.scale * .5,
            y: transform.offsetY + fighter.y * transform.scale - size.h * transform.scale,
            width: size.w * transform.scale,
            height: size.h * transform.scale,
          });
        }
        if (g.bannerTime > 0 && g.running) {
          const compact = compactBattleViewport();
          const bannerWidth = compact ? 268 : 356;
          const bannerHeight = compact ? 32 : 54;
          obstacleRects.push({
            ownerId: null,
            x: transform.offsetX + (W - bannerWidth) / 2 * transform.scale,
            y: transform.offsetY + (compact ? 132 : 70) * transform.scale,
            width: bannerWidth * transform.scale,
            height: bannerHeight * transform.scale,
          });
        }
        const readyAbilityFighters = g.running && !g.paused && !g.over && !selectedActionRef.current
          ? g.fighters.filter((fighter) => canActivateManualAbility({
            fighter,
            fighters: manualAbilityTargetCandidates(g, fighter),
          }))
            .map((fighter) => {
              const size = fighterScreenSize(fighter);
              return {
                id: fighter.id,
                kind: fighter.kind,
                x: fighter.x,
                y: fighter.y,
                screenX: transform.offsetX + fighter.x * transform.scale,
                screenY: transform.offsetY + (fighter.y - size.h - 6) * transform.scale,
              };
            })
          : [];
        const rootStyle = getComputedStyle(document.documentElement);
        const safeInsets = Object.fromEntries(["top", "right", "bottom", "left"].map((edge) => [
          edge,
          Math.max(0, Number.parseFloat(rootStyle.getPropertyValue(`--app-viewport-safe-${edge}`)) || 0) + 6,
        ]));
        const manualAbilityIcons = layoutManualAbilityIcons({
          fighters: readyAbilityFighters,
          obstacles: obstacleRects,
          displayWidth: canvasRect.width,
          displayHeight: canvasRect.height,
          safeInsets,
        }).map((icon) => ({
          fighterId: Number(icon.fighterId),
          kind: icon.kind as UnitKind,
          x: icon.x,
          y: icon.y,
          hitSize: icon.hitSize,
          anchorX: icon.anchorX,
          anchorY: icon.anchorY,
          pointerLength: Math.hypot(
            icon.anchorX - icon.x - icon.hitSize / 2,
            icon.anchorY - icon.y - icon.hitSize / 2,
          ),
          pointerAngle: Math.atan2(
            icon.anchorY - icon.y - icon.hitSize / 2,
            icon.anchorX - icon.x - icon.hitSize / 2,
          ) * 180 / Math.PI - 90,
        }));
        setHud({
          missionType: g.definition.missionType, energy: Math.floor(g.energy), supportGauge: Math.floor(g.supportGauge), scrap: g.scrap, kills: g.kills,
          wave: g.wave, phase: g.phase, baseHp: Math.max(0, g.baseHp), baseMaxHp: g.baseMaxHp,
          barricadeHp: Math.max(0, g.barricadeHp), barricadeMaxHp: g.barricadeMaxHp, barricadeVulnerable: g.barricadeVulnerable, barricadeHitFlash: g.barricadeHitFlash,
          deployQueue: g.deployQueue.length,
          airstrikePhase: g.airstrike.phase, crawlerPhase: g.crawlerAbility.phase, crawlerCharge: g.crawlerAbility.charge,
          combo: g.combo, bossHp: bossHud?.hp ?? 0, bossMax: bossHud?.maxHp ?? 0, bossKind: bossHud?.enemyKind ?? null, bossWorldX: bossHud?.worldX ?? null,
          takuyaEntranceAudioActive: g.takuyaEntranceAudioRemaining > 0,
          crawlerHitFlash: g.crawlerHitFlash, threat: crawlerThreatLevel(nearestEnemyX),
          objective: objectiveForBattle(g.definition, g), deployCooldowns: { ...g.deployCooldowns },
          battleBarks: g.paused ? [] : [...g.battleBarks.active],
          manualAbilityIcons,
        });
        if (g.survivalRun) {
          setSurvivalHud(survivalHudSnapshot({
            ...g.survivalRun,
            crawler: {
              ...g.survivalRun.crawler,
              hp: Math.max(0, Math.min(g.survivalRun.crawler.maxHp, Math.round(g.baseHp))),
            },
          }, {
            bossKind: bossHud?.enemyKind ?? null,
            bossHp: bossHud?.hp ?? 0,
            bossMaxHp: bossHud?.maxHp ?? 0,
          }));
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [announceBossEntrance, chooseAction, dispatchBattleStoryEvents, playCue, playEndJingle, playProductionCue, qaScenario, resumeBattleAudioLoops, stopMusic, stopSfx, syncMusicMode]);

  const healthPct = Math.max(0, hud.baseHp / hud.baseMaxHp * 100);
  const barricadePct = Math.max(0, hud.barricadeHp / hud.barricadeMaxHp * 100);
  const barricadeCondition = barricadeState(hud.barricadeHp) === "BREACHED" ? "破壊" : barricadeState(hud.barricadeHp) === "BREACH IMMINENT" ? "大破" : barricadeState(hud.barricadeHp) === "BUCKLING" ? "損傷" : "健全";
  const bossPct = hud.bossMax ? Math.max(0, hud.bossHp / hud.bossMax * 100) : 0;
  const bossPhase = bossPhaseForHp(hud.bossHp, hud.bossMax, hud.bossKind);
  const isStationPlatformAssault = activeBattlefieldStageId === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM && hud.missionType === "assault";
  const phaseName = hud.missionType === "escort"
    ? hud.phase === 1 ? "発進" : hud.phase === 2 ? "突破" : "護送"
    : hud.missionType === "sequential-seal"
      ? hud.phase === 1 ? "電源1" : hud.phase === 2 ? "電源2・3" : "封鎖"
      : isStationPlatformAssault
        ? hud.phase === 1 ? "確保" : hud.phase === 2 ? "制圧" : "総攻撃"
        : hud.missionType === "assault"
          ? hud.phase === 1 ? "侵入" : hud.phase === 2 ? "前進" : "総攻撃"
          : hud.phase === 1 ? "防衛" : hud.phase === 2 ? "前進" : "総攻撃";
  const stationMissionHud = hud.missionType === "escort" || hud.missionType === "sequential-seal";
  const isSurvivalBattle = screen === "battle" && survivalHud !== null;
  const survivalUpgradeOpen = isSurvivalBattle
    && survivalHud.phase === SURVIVAL_RUN_PHASES.UPGRADE_SELECTION;
  const enemyBaseLabel = activeBattlefieldStageId === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE ? "感染中継点" : "感染拠点";
  const selectedStageBossKind = selectedOutbreakMissionId
    ? OUTBREAK_MISSION_BY_ID[selectedOutbreakMissionId]?.boss?.enemyKind ?? null
    : CAMPAIGN_STAGE_BY_ID[selectedStageId]?.boss?.enemyKind ?? null;
  const activeBossKind = survivalHud?.bossKind ?? hud.bossKind ?? selectedStageBossKind;
  const activeBossLabel = activeBossKind
    ? bossDefinitionForEnemyKind(activeBossKind)?.displayName ?? enemyContentFor(activeBossKind).displayName
    : "BOSS";
  const bossHudSide = (hud.bossWorldX ?? 0) >= W * .64 ? "boss-hud-left" : "boss-hud-right";
  const selectedName = selectedAction?.startsWith("supply:")
    ? SUPPORT_DISPLAY_NAMES[selectedAction.slice("supply:".length) as SupplyKind]
    : selectedAction === "airstrike" ? "航空支援" : null;
  const combatLocked = !!end || hud.baseHp <= 0 || hud.barricadeHp <= 0;
  const audioUnlockLabel = audioUnlockUi === "pending" ? "音声を準備中…" : audioUnlockUi === "success" ? "音声が有効になりました" : audioUnlockUi === "failed" ? "音声を開始できませんでした　もう一度試す" : "音声を有効にする";
  const audioUnlockShortLabel = audioUnlockUi === "pending" ? "準備中" : audioUnlockUi === "success" ? "音声OK" : audioUnlockUi === "failed" ? "音声再試行" : "音声開始";

  return (
    <main className="game-shell" data-screen={screen} data-stage-id={activeOperationId} data-battlefield-stage-id={activeBattlefieldStageId} data-release-version={RELEASE_VERSION}>
      <section className="game-frame" style={{ "--battlefield-art": `url('${stageVisualFor(activeBattlefieldStageId)}')` } as CSSProperties} aria-label="西新世紀末物語 ゲーム">
        <canvas ref={canvasRef} width={W} height={H} className={`battlefield ${selectedAction ? "targeting" : ""} ${screen === "battle" ? "active" : "inactive"}`} aria-label="連続座標の戦場" aria-hidden={screen !== "battle"} onPointerMove={handleBattlefieldPointerMove} onPointerDown={handleBattlefieldPointerDown} onPointerUp={handleBattlefieldPointerUp} onPointerCancel={handleBattlefieldPointerCancel} />
        {screen === "battle" && !selectedAction && hud.manualAbilityIcons.map((icon) => {
          const ability = MANUAL_ABILITY_REGISTRY[icon.kind];
          if (!ability) return null;
          return <button
            key={icon.fighterId}
            type="button"
            className="manual-ability-ready"
            data-fighter-id={icon.fighterId}
            data-ability-kind={icon.kind}
            data-owner-anchor-x={icon.anchorX}
            data-owner-anchor-y={icon.anchorY}
            style={{ left: icon.x, top: icon.y, width: icon.hitSize, height: icon.hitSize }}
            aria-label={`${cards.find((card) => card.kind === icon.kind)?.name ?? icon.kind}：${ability.displayName}`}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onPointerCancel={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              activateManualAbility(icon.fighterId);
            }}
          >
            <span aria-hidden="true"><b className={`manual-ability-ready-icon ability-${icon.kind}`} /></span>
            <i
              aria-hidden="true"
              style={{ height: icon.pointerLength, transform: `rotate(${icon.pointerAngle}deg)` }}
            />
          </button>;
        })}
        {(qaMode || qaScenario) && (
          <div className={`qa-badge ${screen === "battle" ? "" : "campaign-qa-badge"}`} role="status">
            {"LOCAL QA // "}{(qaMode ?? qaScenario?.mode ?? "flow").toUpperCase()}{" // 通常セーブ非反映"}
          </div>
        )}
        {audioUnlockVisible && <button
          className="enable-audio-button"
          data-state={audioUnlockUi}
          data-audio-unlock-control="true"
          onClick={enableAudio}
          disabled={audioUnlockUi === "pending" || Boolean(end || pendingResultCommit)}
          aria-label={audioUnlockUi === "failed" ? "音声を開始できませんでした　もう一度試す" : "音声を有効にする"}
          aria-live="polite"
        >
          <b><span className="audio-unlock-long">{audioUnlockLabel}</span><span className="audio-unlock-short">{audioUnlockShortLabel}</span></b>
          <small>{audioUnlockUi === "success" ? "確認音を再生しました（聞こえない場合は端末・タブのミュートを確認）" : audioUnlockUi === "failed" ? "音源または再生処理を確認して、タップで再試行" : "タップしてBGM・環境音・効果音・戦闘ボイスを開始"}</small>
        </button>}
        {screen === "battle" && <>
        {hud.battleBarks.length > 0 && <div className={`battle-barks ${bossHudSide === "boss-hud-left" ? "battle-barks-right" : ""}`} aria-live="polite" aria-label="戦闘台詞">{hud.battleBarks.map((bark) => <p key={bark.id} data-tone={bark.tone}><b>{bark.speaker}</b><span>{bark.text}</span></p>)}</div>}

        {isSurvivalBattle ? <div className="survival-hud" role="region" aria-label="Survival戦闘情報">
          <div className="survival-wave"><small>WAVE</small><strong>{survivalHud.wave}</strong></div>
          <div className="survival-next-boss"><small>NEXT BOSS</small><b>WAVE {survivalHud.nextBossWave}</b></div>
          <div className={`survival-crawler-health ${healthPct <= 25 ? "critical" : ""}`}>
            <span>CRAWLER HP</span><b>{Math.ceil(hud.baseHp)} / {hud.baseMaxHp}</b>
            <i><em style={{ width: `${healthPct}%` }} /></i>
          </div>
          <div className="survival-speed" aria-label="戦闘速度">
            <button className={survivalHud.speed === 1 ? "active" : ""} disabled={paused || survivalSavePending} onClick={() => changeSurvivalSpeed(1)}>1倍</button>
            <button className={survivalHud.speed === 2 ? "active" : ""} disabled={paused || survivalHud.speedLocked || survivalSavePending} onClick={() => changeSurvivalSpeed(2)}>2倍</button>
          </div>
          <button className="survival-pause" onClick={togglePause} disabled={survivalUpgradeOpen || survivalSavePending} aria-label={paused ? "再開" : "一時停止"}>{paused ? "▶" : "Ⅱ"}</button>
        </div> : <>
          <div className="top-hud">
            <div className="brand-block"><span className="brand-mark">移</span><div><b>移動拠点</b><small>{selectedOperationView.displayName} <em>{RELEASE_LABEL}</em></small></div></div>
            <div className="phase-block"><small>第{hud.phase}段階</small><strong>{phaseName}</strong><em>第{hud.wave}波</em></div>
            <button className="icon-btn" onClick={togglePause} aria-label={paused ? "再開" : "一時停止"}>{paused ? "▶" : "Ⅱ"}</button>
            <button className={`icon-btn audio-btn ${musicActive ? "playing" : ""}`} data-playing={musicActive} data-muted={bgmMuted} disabled={Boolean(end || pendingResultCommit)} onClick={toggleBgm} aria-label={bgmMuted ? "音楽を再生" : "音楽をミュート"}><b>{bgmMuted ? "×" : "♫"}</b><small>音楽</small></button>
            <button className="icon-btn audio-btn" data-muted={sfxMuted} disabled={Boolean(end || pendingResultCommit)} onClick={toggleSfx} aria-label={sfxMuted ? "効果音を再生" : "効果音をミュート"}><b>{sfxMuted ? "×" : "効"}</b><small>効果音</small></button>
          </div>

          <div className={`health-hud crawler-health ${healthPct <= 25 ? "critical" : ""} ${hud.crawlerHitFlash > 0 ? "hit" : ""}`}><div><span>移動拠点</span><b>{Math.ceil(hud.baseHp)} / {hud.baseMaxHp}</b></div><i><em style={{ width: `${healthPct}%` }} /></i></div>
          {stationMissionHud || selectedOutbreakMissionId
            ? <div className="health-hud barrier-health mission-health"><div><span>作戦目標</span><b>{hud.objective}</b></div></div>
            : <div className={`health-hud barrier-health ${hud.barricadeVulnerable ? "vulnerable" : "reinforced"} ${hud.barricadeHitFlash > 0 ? "hit" : ""}`}><div><span>{hud.missionType === "timed-defense" ? "救援区域" : enemyBaseLabel}</span><b>{hud.missionType === "timed-defense" ? "防衛対象外" : hud.barricadeVulnerable ? `${Math.ceil(hud.barricadeHp)} / ${hud.barricadeMaxHp}` : "防護中"}</b></div><i><em style={{ width: `${barricadePct}%` }} /></i>{hud.barricadeVulnerable && <small>{barricadeCondition}</small>}</div>}
          {started && !end && hud.threat > .55 && <div className={`crawler-alert ${hud.threat > .82 ? "imminent" : ""}`}><b>移動拠点 脅威</b><span>{hud.threat > .82 ? "接触寸前" : "接近中"}</span></div>}
        </>}
        {hud.bossMax > 0 && <div className={`boss-hud ${bossHudSide} ${isSurvivalBattle ? "survival-boss-hud" : ""}`}><div><span>{activeBossLabel}{" // "}{bossPhase.label}</span><b>{Math.ceil(hud.bossHp)} / {hud.bossMax}</b></div><i><em style={{ width: `${bossPct}%` }} /></i></div>}

        {selectedAction && started && !paused && !end && <div className="placement-hint" role="status" aria-live="polite">
          <span className="placement-copy"><b>{selectedName}</b><span>戦場をタップ</span></span>
          <button className="placement-cancel" onClick={() => chooseActionWithCue(null)} aria-label={`${selectedName}の配置をキャンセル`}>キャンセル</button>
        </div>}

        <div className="bottom-hud">
          <div className="resource-stack">
            <div className="resource command"><span>指揮</span><strong>{hud.energy}</strong><small>/{COMMAND_MAX}</small><i><em style={{ width: `${hud.energy / COMMAND_MAX * 100}%` }} /></i></div>
            <div className="resource rage"><span>支援</span><strong>{hud.supportGauge}</strong><small>/{SUPPORT_GAUGE_MAX}</small><i><em style={{ width: `${hud.supportGauge}%` }} /></i></div>
          </div>

          <div className="combat-deck">
            <div className="unit-cards" aria-label="生存者ユニット">
              {cards.filter((card) => formationKinds.includes(card.kind)).map((card) => {
                const cooldown = Math.ceil(hud.deployCooldowns[card.kind] ?? 0);
                const portraitArt = (FORMATION_CARD_ART as Record<string, string | undefined>)[card.kind];
                return (
                  <button key={card.kind} className={`unit-card ${cooldown > 0 ? "cooling" : ""}`} data-kind={card.kind} data-portrait={portraitArt ? "approved" : "diagnostic"} disabled={!started || paused || hud.energy < card.cost || cooldown > 0 || combatLocked} onClick={() => deployHuman(card.kind)} style={portraitArt ? { "--unit-card-art": `url('${portraitArt}')` } as CSSProperties : undefined}>
                    <span className="keycap">{card.key}</span><span className="portrait"><i />{!portraitArt && <b className="diagnostic-portrait" aria-hidden="true">{card.kind === "guardian" ? "盾" : "工"}</b>}</span>
                    <span className="card-copy"><b>{card.name}</b><small>{card.desc}</small></span><span className="cost">⚡{card.cost}</span>
                    {cooldown > 0 && <span className="cooldown-mask"><b>{cooldown}</b><small>秒待ち</small></span>}
                  </button>
                );
              })}
            </div>
            <div className="support-row" aria-label="戦場物資・航空支援・移動拠点一斉掃射">
              <span className="support-label">物資<br />支援</span>
              <button
                className={`support-btn ${selectedSupply} ${selectedAction === `supply:${selectedSupply}` ? "selected" : ""}`}
                disabled={!started || paused || hud.scrap < supplyDefs[selectedSupply].cost || combatLocked}
                onClick={() => chooseActionWithCue(selectedAction === `supply:${selectedSupply}` ? null : `supply:${selectedSupply}`)}
                aria-label={`${supplyDefs[selectedSupply].name} ${supplyDefs[selectedSupply].cost}スクラップ`}
              >
                <span className="support-key">{supplyDefs[selectedSupply].key}</span><b>{SUPPORT_DISPLAY_NAMES[selectedSupply]}</b><small>{selectedSupply === "pod" ? "着地衝撃＋進路封鎖" : selectedSupply === "drum" ? "タップ／被弾で起爆" : "周辺の味方を継続回復"}</small><em>▰{supplyDefs[selectedSupply].cost}</em>
              </button>
              <button className={`support-btn airstrike ${selectedAction === "airstrike" ? "selected" : ""}`} disabled={!started || paused || hud.supportGauge < AIRSTRIKE_DEF.gaugeCost || hud.airstrikePhase !== "idle" || combatLocked} onClick={() => chooseActionWithCue(selectedAction === "airstrike" ? null : "airstrike")} aria-label={`${hud.airstrikePhase === "idle" ? "緊急航空支援" : "航空支援実行中"} ${AIRSTRIKE_DEF.gaugeCost}支援ゲージ`}>
                <span className="support-key">Q</span><b>{hud.airstrikePhase === "idle" ? "航空支援" : "支援実行中"}</b><small>通信・照準・飛来・着弾・帰投</small><em>◆{AIRSTRIKE_DEF.gaugeCost}</em>
              </button>
              <button className="support-btn barrage" disabled={!started || paused || hud.crawlerPhase !== "ready" || combatLocked} onClick={triggerCrawlerBarrage} aria-label={hud.crawlerPhase === "ready" ? "移動拠点一斉掃射" : `移動拠点一斉掃射 再装填 ${Math.round(hud.crawlerCharge * 100)}%`}>
                <span className="support-key">G</span><b>{hud.crawlerPhase === "ready" ? "一斉掃射" : `装填 ${Math.round(hud.crawlerCharge * 100)}%`}</b><small>戦場全域固定火器</small><em>⌁</em>
              </button>
            </div>
          </div>
        </div>

        {isSurvivalBattle
          ? <div className="stats-strip survival-stats"><span>☠ 撃破 {hud.kills}</span><span>BOSS {survivalHud.bossKills}</span><span className="bay-status">格納庫 {hud.deployQueue}/3</span>{hud.combo > 1 && <span className="combo">×{hud.combo} 連続</span>}<span className="objective">防衛前線を維持</span></div>
          : <div className="stats-strip"><span>☠ 撃破 {hud.kills}</span><span>▰ スクラップ {hud.scrap}</span><span className="bay-status">格納庫 {hud.deployQueue}/3</span>{hud.combo > 1 && <span className="combo">×{hud.combo} 連続</span>}<span className="objective">目標：{hud.objective}</span></div>}
        {survivalUpgradeOpen && <div className="survival-upgrade-screen" role="dialog" aria-modal="true" aria-label="ボス撃破強化選択"><section>
          <small>BOSS CHECKPOINT // WAVE {survivalHud.lastCompletedWave}</small>
          <h2>3択強化を選択</h2>
          <p>{pendingSurvivalCheckpoint || survivalSavePending ? "checkpointを保存しています。保存完了後に選択できます。" : "このrun中だけ有効です。1つ選ぶと次waveへ進みます。"}</p>
          <div className="survival-upgrade-choices">
            {survivalHud.pendingUpgradeChoices.map((upgradeId) => {
              const upgrade = SURVIVAL_UPGRADE_BY_ID[upgradeId];
              if (!upgrade) return null;
              const stack = survivalHud.upgradeStacks[upgradeId] ?? 0;
              return <button key={upgradeId} disabled={Boolean(pendingSurvivalCheckpoint || survivalSavePending)} onClick={() => selectSurvivalUpgrade(upgradeId)}>
                <small>{upgrade.category.toUpperCase()}</small>
                <b>{upgrade.displayName}</b>
                <span>1段階あたり +{Math.round(upgrade.effectPerStack * 100)}%</span>
                <em>現在 {stack} / 選択後 {stack + 1}</em>
              </button>;
            })}
          </div>
          {pendingSurvivalCheckpoint && !survivalSavePending && savePersistence === "unavailable" && <div className="survival-save-retry" role="alert">
            <b>checkpointを保存できませんでした</b><button onClick={retrySurvivalCheckpointSave}>保存を再試行</button>
          </div>}
        </section></div>}
        {paused && started && !end && !survivalUpgradeOpen && !pendingSurvivalSettlement && <div className="pause-screen" role="dialog" aria-modal="true" aria-label="一時停止メニュー"><div className="pause-panel">
          <small>作戦一時停止</small><h2>一時停止</h2>
          <div className="pause-actions">
            <button className="primary" onClick={togglePause}>作戦を再開</button>
            {!isSurvivalBattle && <button onClick={() => requestPauseAction("restart")}>ステージを最初からやり直す</button>}
            {!isSurvivalBattle && <button onClick={() => requestPauseAction("loadout")}>編成画面へ戻る</button>}
            <button className="danger" onClick={() => requestPauseAction("withdraw")}>エリアマップへ撤退</button>
          </div>
          <section className="pause-volume" aria-label="音量設定"><h3>音量設定</h3>
            <label><span>BGM <b>{Math.round(campaignSave.settings.bgmVolume * 100)}%</b></span><input type="range" min="0" max="1" step="0.05" value={campaignSave.settings.bgmVolume} data-volume-kind="bgm" data-audio-unlock-control="true" aria-label="BGM音量" aria-valuetext={`${Math.round(campaignSave.settings.bgmVolume * 100)}%${campaignSave.settings.bgmVolume <= 0 ? " ミュート" : ""}`} disabled={Boolean(end || pendingResultCommit)} onChange={(event) => updateVolume("bgm", Number(event.currentTarget.value))} /></label>
            <label><span>SE・戦闘ボイス <b>{Math.round(campaignSave.settings.sfxVolume * 100)}%</b></span><input type="range" min="0" max="1" step="0.05" value={campaignSave.settings.sfxVolume} data-volume-kind="sfx" data-audio-unlock-control="true" aria-label="SE・戦闘ボイス音量" aria-valuetext={`${Math.round(campaignSave.settings.sfxVolume * 100)}%${campaignSave.settings.sfxVolume <= 0 ? " ミュート" : ""}`} disabled={Boolean(end || pendingResultCommit)} onChange={(event) => updateVolume("sfx", Number(event.currentTarget.value))} /></label>
            <div><button disabled={Boolean(end || pendingResultCommit)} onClick={toggleBgm}>{bgmMuted ? "BGMを有効にする" : "BGMをミュート"}</button><button disabled={Boolean(end || pendingResultCommit)} onClick={toggleSfx}>{sfxMuted ? "効果音を有効にする" : "効果音をミュート"}</button><button className="audio-test-tone" data-audio-unlock-control="true" onClick={playAudioTestTone} disabled={Boolean(end || pendingResultCommit)}>テスト音を鳴らす</button></div>
            <p className="audio-troubleshooting">成功表示でも聞こえない場合は、端末音量とブラウザのタブミュートを確認してください。</p>
          </section>
          {!isSurvivalBattle && <section className="pause-story" aria-label="戦闘中の会話設定"><span><b>戦闘中の会話</b><small>既読イベントの再表示方法</small></span><button onClick={cycleBattleEventMode}>{campaignSave.settings.battleEventMode === "first-time" ? "初回のみ" : campaignSave.settings.battleEventMode === "compact" ? "通信を簡略表示" : "毎回すべて表示"}</button></section>}
          {pauseConfirm && <div className="pause-confirm" role="alertdialog" aria-modal="true"><div><h3>{pauseConfirm === "restart" ? "ステージをやり直しますか？" : pauseConfirm === "loadout" ? "編成画面へ戻りますか？" : "作戦から撤退しますか？"}</h3><p>{isSurvivalBattle ? "完了済みwaveの報酬を一括保存してrunを終了します。" : "現在の戦闘状態は破棄されます。星・報酬・解放は発生しません。"}</p><span><button onClick={cancelPauseAction}>キャンセル</button><button className="danger" onClick={confirmPauseAction}>実行する</button></span></div></div>}
        </div></div>}
        </>}
        {screen === "survival" && <div className="survival-lobby campaign-overlay"><section>
          <header><div><small>ENDLESS DEFENSE</small><h1>Survival Mode</h1><p>感染防衛前線でCRAWLERを守り、5waveごとのboss checkpointを突破してください。</p></div><button onClick={() => returnToMap()}>エリアマップへ戻る</button></header>
          <div className="survival-lobby-grid">
            <article>
              <small>FORMATION SNAPSHOT</small><h2>出撃部隊</h2>
              <ul>{formationUnitIds.map((unitId) => {
                const unit = unitViews.find((candidate) => candidate.id === unitId);
                return <li key={unitId}><b>{unit?.name ?? unitId}</b><span>Level {Math.max(1, Number(campaignSave.unitLevels[unitId] ?? 1))}</span></li>;
              })}</ul>
              <p>開始時のLevelと装備をsnapshotへ固定し、checkpoint再開時も同じ値を使用します。</p>
            </article>
            <article>
              <small>START WAVE</small><h2>開始wave</h2>
              <div className="survival-start-waves">{campaignSave.survival.unlockedStartWaves.map((wave) => <button key={wave} className={selectedSurvivalStartWave === wave ? "active" : ""} onClick={() => setSelectedSurvivalStartWave(wave)}>WAVE {wave}</button>)}</div>
              <p>最高到達wave {campaignSave.survival.highestWave} / 累計run {campaignSave.survival.totalRuns}</p>
              <button className="survival-start" disabled={formationUnitIds.length === 0 || saveMutationPending} onClick={startNewSurvival}>新しいrunを開始</button>
            </article>
            {campaignSave.survival.activeCheckpoint && <article className="survival-resume-card">
              <small>CHECKPOINT FOUND</small><h2>WAVE {campaignSave.survival.activeCheckpoint.checkpointWave}から再開</h2>
              <p>保存済みの部隊Level・装備・一時強化・CRAWLER HPを復元します。</p>
              <button disabled={saveMutationPending} onClick={resumeSurvival}>checkpointから再開</button>
            </article>}
          </div>
        </section></div>}
        {screen === "survival-result" && survivalResult && <div className="survival-result campaign-overlay"><section>
          <small>RUN SETTLED // ATOMIC SAVE COMPLETE</small>
          <h1>{survivalResult.endReason === SURVIVAL_END_REASONS.WITHDRAWAL ? "撤退完了" : survivalResult.endReason === SURVIVAL_END_REASONS.CRAWLER_DESTROYED ? "CRAWLER大破" : "部隊壊滅"}</h1>
          <div className="survival-result-grid">
            <article><small>到達</small><b>WAVE {survivalResult.reachedWave}</b>{survivalResult.newHighestWave && <em>NEW RECORD</em>}</article>
            <article><small>撃破</small><b>{survivalResult.kills}</b><span>BOSS {survivalResult.bossKills}</span></article>
            <article><small>獲得CAPS</small><b>+{survivalResult.earnedCaps}</b><span>所持 {survivalResult.capsAfter}</span></article>
          </div>
          <div className="survival-unit-result"><h2>隊員別戦闘記録</h2>{survivalResult.unitStats.length > 0
            ? <table><thead><tr><th>隊員</th><th>与damage</th><th>被damage</th><th>回復</th></tr></thead><tbody>{survivalResult.unitStats.map((unit) => <tr key={unit.kind}><th>{unit.displayName}</th><td>{unit.damage.toLocaleString("ja-JP")}</td><td>{unit.damageTaken.toLocaleString("ja-JP")}</td><td>{unit.healing.toLocaleString("ja-JP")}</td></tr>)}</tbody></table>
            : <p>このrunでは隊員別damage記録がありません。</p>}</div>
          <div className="survival-equipment-result"><h2>装備報酬</h2>{survivalResult.earnedEquipmentGrants.length > 0
            ? <ul>{survivalResult.earnedEquipmentGrants.map((grant) => <li key={grant.equipmentId}><b>{grant.displayName}</b><span>×{grant.quantity}</span></li>)}</ul>
            : <p>今回の装備報酬はありません。</p>}</div>
          <div className="survival-result-actions"><button onClick={openSurvival}>次のrunへ</button><button onClick={() => returnToMap()}>エリアマップへ戻る</button></div>
        </section></div>}
        {qaMode === "barks" ? <BattleBarkAuditScreen /> : qaMode === "sprites" ? <SpriteAuditScreen /> : <CampaignScreens
          screen={screen}
          eventId={eventId}
          stages={stageViews}
          selectedStage={selectedOperationView}
          units={unitViews}
          formationUnitIds={formationUnitIds}
          formationPresets={campaignSave.formationPresets.map((preset) => ({ id: preset.id, name: preset.displayName, unitIds: preset.unitIds }))}
          selectedFormationPresetId={campaignSave.selectedFormationPresetId}
          supplies={supplyViews}
          selectedSupply={selectedSupply}
          supplyCurrency={campaignSave.caps}
          caps={campaignSave.caps}
          result={campaignResult}
          outbreakMissions={outbreakMissionViews}
          selectedOutbreakMissionId={selectedOutbreakMissionId}
          outbreakResult={outbreakResult}
          recordsSummary={recordsSummaryView}
          enemyCompendium={enemyCompendiumViews}
          bossCompendium={bossCompendiumViews}
          loadoutReturnLabel={selectedOutbreakMissionId ? "異常発生任務" : "地図へ"}
          assetsReady={assetsReady}
          assetError={assetError}
          hasCampaignSave={campaignSave.campaignStarted}
          saveRecoveryRequired={saveRecovery !== null}
          saveRecoveryReason={saveRecovery?.recoveryReason ?? ""}
          saveRecoveryCandidateSources={(saveRecovery?.candidates ?? []).filter((candidate) => candidate.valid === true).map((candidate) => candidate.source)}
          saveRecoveryCanExport={Boolean(saveRecovery && (saveRecovery.corruptCandidates.length > 0 || saveRecovery.candidates.length > 0))}
          saveMutationPending={saveMutationPending}
          upgradePendingUnitIds={upgradePendingUnitIds}
          upgradeFeedback={upgradeFeedback}
          savePersistence={savePersistence}
          readStoryEventIds={campaignSave.readStoryEventIds}
          autoSkipReadStory={campaignSave.autoSkipReadStory}
          forceStoryReplay={forceStoryReplay}
          onBegin={beginCampaign}
          onRestartCampaign={restartCampaign}
          onExportSave={exportCampaignSave}
          onExportCorruptSave={exportCorruptCampaignSave}
          onImportSave={importCampaignSave}
          onUseRecoveryCandidate={useRecoveryCandidate}
          onResetCorruptSave={resetCorruptCampaignSave}
          onEventComplete={handleEventComplete}
          onEventSkip={handleEventSkip}
          onStoryAudioPositionChange={handleStoryAudioPositionChange}
          onSetAutoSkipReadStory={setAutoSkipReadStory}
          onReplayPrologue={replayPrologue}
          onSelectStage={selectStage}
          onOpenSurvival={openSurvival}
          onOpenOutbreak={openOutbreak}
          onOpenRecords={openRecords}
          onSelectOutbreakMission={selectOutbreakMission}
          onPrepareOutbreak={prepareOutbreak}
          onOpenPersonnel={openPersonnel}
          onOpenLoadout={openLoadout}
          onReturnToMap={returnToMap}
          onReturnFromLoadout={returnFromLoadout}
          onSelectFormationPreset={selectFormation}
          onToggleFormation={toggleFormation}
          onRecruitUnit={recruitUnit}
          onUpgradeUnit={upgradeUnit}
          onSelectSupply={(kind) => setSelectedSupply(kind as SupplyKind)}
          onStartBattle={requestBattle}
          onRetry={retryBattle}
          onContinueResult={continueResult}
          onContinueOutbreakResult={continueOutbreakResult}
          onResetSave={resetCampaign}
          onReloadAssets={() => window.location.reload()}
        />}
        {screen !== "battle" && campaignSave.migrationNotices[0] && <div className="migration-notice" role="alertdialog" aria-modal="true" aria-label="Version 0.9.0キャップ経済再編">
          <section>
            <small>MIGRATION RECEIPT</small>
            <h2>{campaignSave.migrationNotices[0].title}</h2>
            <p>{campaignSave.migrationNotices[0].body}</p>
            <dl><div><dt>旧残高</dt><dd>{campaignSave.migrationNotices[0].previousCaps}</dd></div><div><dt>新開始資金</dt><dd>{campaignSave.migrationNotices[0].nextCaps}</dd></div></dl>
            <button onClick={() => acknowledgeMigrationNotice(campaignSave.migrationNotices[0].id)}>内容を確認</button>
          </section>
        </div>}
      </section>
      {pendingResultCommit && <div className="result-save-blocker" role="alertdialog" aria-modal="true" aria-label="作戦結果の保存失敗">
        <section><small>SAVE REQUIRED</small><h2>作戦結果を保存できません</h2><p>報酬や加入の二重適用を防ぐため、結果画面へ進まず停止しています。保存を再試行するか、結果を含むバックアップを書き出してください。</p><div><button disabled={resultSaveRetrying} onClick={retryPendingResultSave}>{resultSaveRetrying ? "保存を再試行中" : "保存を再試行"}</button><button disabled={resultSaveRetrying} onClick={exportPendingResultSave}>結果バックアップを書き出す</button></div></section>
      </div>}
      {pendingSurvivalSettlement && <div className="result-save-blocker survival-settlement-blocker" role="alertdialog" aria-modal="true" aria-label="Survival結果の保存">
        <section><small>ATOMIC SETTLEMENT REQUIRED</small><h2>{survivalSavePending ? "Survival結果を保存しています" : "Survival結果を保存できません"}</h2><p>進行、receipt、CAPS、装備数量、last result、checkpoint削除、revision、integrityを一度のcampaign save更新で確定します。保存完了までは報酬を画面へ反映しません。</p><div><button disabled={survivalSavePending} onClick={retrySurvivalSettlementSave}>{survivalSavePending ? "保存中" : "一括保存を再試行"}</button></div></section>
      </div>}
      {pendingOutbreakSettlement && <div className="result-save-blocker outbreak-settlement-blocker" role="alertdialog" aria-modal="true" aria-label="異常発生任務結果の保存">
        <section><small>ATOMIC SETTLEMENT REQUIRED</small><h2>{outbreakSavePending ? "異常発生任務の結果を保存しています" : "異常発生任務の結果を保存できません"}</h2><p>撃破記録、Survival解放、receipt、キャップ、装備数量、last result、revision、integrityを一度のcampaign save更新で確定します。保存完了までは報酬を画面へ反映しません。</p><div><button disabled={outbreakSavePending} onClick={retryOutbreakSettlementSave}>{outbreakSavePending ? "保存中" : "一括保存を再試行"}</button></div></section>
      </div>}
      {savePersistence === "unavailable" && <div className="save-persistence-warning" role="alert">
        <b>セーブを端末へ保存できません</b>
        <span>進行すると再読み込み後に失われるため、Safariの通常タブで開き直してください。</span>
      </div>}
      <div className="rotate-notice"><span>↻</span><b>スマホを横向きにしてください</b><small>この作戦は横画面に最適化されています</small></div>
    </main>
  );
}
