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
  advanceTowardLane,
  chooseCommittedEnemyLane,
  chooseHumanDeploymentLane,
  humanLaneTransitioning,
  planHumanLaneAssignments,
} from "./lanePlanner.js";
import { createAudioMixer, createAudioRequestGate, runGuardedAudioRequest } from "./audioMixer.js";
import { BattleBarkAuditScreen } from "./BattleBarkAuditScreen";
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
import { CampaignScreens, type CampaignResultView, type CampaignScreen, type StageScreenView, type SupplyScreenView, type UnitScreenView } from "./CampaignScreens";
import {
  CAMPAIGN_STAGE_BY_ID,
  CAMPAIGN_STAGE_IDS,
  CAMPAIGN_STAGES,
  CAMPAIGN_RECRUITMENT_COSTS,
  CAMPAIGN_UNITS,
  INITIAL_STAGE_ID,
  createDefaultCampaignSave,
  getSelectedFormationCombatKinds,
  getSelectedFormationUnitIds,
  inspectCampaignSaveCandidate,
  isUnitDiscovered,
  isUnitOwned,
  isUnitRecruitable,
  isStageUnlocked,
  markCampaignStarted,
  markStoryEventRead,
  recruitCampaignUnit,
  reviseCampaignSave,
  resolveStageResult,
  selectFormationPreset,
  selectCampaignStage,
  setFormationPresetUnits,
  serializeCampaignSave,
  updateCampaignSettings,
  updateStoryPlaybackSettings,
} from "./campaign.js";
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
  createAllyLifecycle,
  createAttackTransaction,
  createEnemyLifecycle,
  createGenericZombieSpawn,
  ENEMY_DEATH_CONFIG,
  enforceEnemyCorpseCaps,
  hasAdjacentLaneLineOfSight,
  igniteAllyCorpsesInFire,
  supportCohesion,
} from "./combatLifecycle.js";
import { allyCorpseVisualCue } from "./corpseVisuals.js";
import { resolveLocalQaMode, resolveLocalQaSafeArea, resolveLocalQaScenario } from "./localQa.js";
import { PRODUCTION_VISUALS, stageVisualFor } from "./productionVisuals.js";
import { PORTRAIT_ART, fitSpriteBattleDisplaySize, spriteFrameFor, spriteKinds, spriteSheetPath } from "./spriteManifest.js";
import { STAGE_OBJECT_MANIFEST, stageObjectsFor } from "./stageObjectManifest.js";
import {
  STAGE_VIEWPORT_IDS,
  clampToWalkable,
  combatReadyGroundingAudit,
  resolveStageViewportProfile,
  stageDebugPrimitives,
  stageGeometryFor,
} from "./stageGeometry.js";
import { stageResultFacts } from "./stageResultFacts.js";
import {
  BATTLE_AUDIO_LOOP_CONTRACTS,
  LEGACY_SFX_CUE_MAP,
  PRODUCTION_AUDIO_MANIFEST,
  STATION_AUDIO_CUE_IDS,
  STORY_AUDIO_MIX,
  TAKUYA_ENTRANCE_AUDIO,
  enemyVoiceCue,
  humanVoiceCueForUnit,
  sceneIdForScreen,
  sceneIdForStoryEvent,
  stopBattleAudioLoops,
  storyWarningCueForEvent,
  unitAudioCueFor,
  weaponCueForUnit,
} from "./productionAudio.js";
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
  bossPhaseForHp,
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
  laneCentersForViewport,
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
  naoDamageAfterProtection,
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

const W = 960;
const H = 540;

type Lane = 0 | 1 | 2;
type UnitKind = "scout" | "ranger" | "brute" | "brawler" | "gunner" | "medic" | "crazy-king" | "kumaverson" | "babayaga" | "guardian" | "engineer";
type EnemyKind = "walker" | "runner" | "spitter" | "crusher" | "shade" | "abomination" | "takuya" | "turned" | "grappler" | "ooze" | "sprinter" | "gate-eater";
type SupplyKind = "pod" | "drum" | "medical";
type MusicMode = "normal" | "danger" | "boss";
type QaMode = "endgame" | "takuya-entrance" | "ai-reacquire" | "roles" | "supplies" | "airstrike" | "crawler" | "loadout" | "dialogue" | "stress" | "lifecycle" | "barks" | "sprites";
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
const LANE_NAMES_JA = ["上", "中央", "下"] as const;

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
  name: string;
  cost: number;
  key: string;
  desc: string;
  deployCooldown: number;
  hp: number;
  speed: number;
  damage: number;
  range: number;
  attackEvery: number;
};

type MissionEvent = { at: number; wave: number; label: string; bossOnly?: boolean; units: [string, Lane][] };
type BattleDefinition = {
  stageId: string;
  displayName: string;
  missionType: "assault" | "timed-defense" | "boss-assault" | "escort" | "sequential-seal";
  prepSeconds: number;
  baseMaxHp: number;
  enemyBaseMaxHp: number;
  enemyBaseMode: "target" | "scenery";
  startsEnemyBaseVulnerable: boolean;
  bossUnlocksEnemyBase: boolean;
  timeline: MissionEvent[];
  defenseEndAt: number | null;
  phaseSchedule: { at: number; phase: 1 | 2 | 3; label: string; objective: string }[] | null;
  objective: string;
  missionConfig: Record<string, unknown>;
  rescueCount: number;
};
type CampaignSave = ReturnType<typeof createDefaultCampaignSave>;
type CampaignStageData = {
  id: string; displayName: string; objective: string; missionType: BattleDefinition["missionType"];
  baseReward: number; firstTimeStarRewards: Record<number, number>; mapPosition: { x: number; y: number };
};
type CampaignUnitData = {
  id: string; combatKind: UnitKind; displayName: string; roleName: string; description: string;
  roleIcon: string; weaponName: string; attackMode: string; rangeBand: string; primaryTarget: string; deploymentHint: string;
  recruitmentCostCaps?: number;
  unlock: { type: string; stageId?: string; stageNumber?: number; costCaps?: number };
};
type EnemySpawnEntry = {
  entryId: number; kind: string; lane: Lane; wave: number; order: number; delay: number;
  x: number; y: number; combatReadyX: number; entrySpeed: number; slot: number;
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

function placementIndicatorFor(action: SelectedAction, lane: Lane, x: number, valid: boolean, reason: string): PlacementIndicator {
  const kind = action?.startsWith("supply:") ? action.slice("supply:".length) as SupplyKind : null;
  const radius = kind === "pod" ? supplyDefs.pod.landingRadius ?? 92
    : kind === "drum" ? supplyDefs.drum.blastRadius ?? 112
      : kind === "medical" ? supplyDefs.medical.healRadius ?? 104
        : AIRSTRIKE_DEF.radius;
  return {
    lane,
    x,
    y: activeLaneCenters[lane],
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
  knock: number;
  variant: number;
  targetId: number | null;
  targetObjectId: number | null;
  retargetIn: number;
  nextLaneDecisionAt: number;
  bodyRadius: number;
  laneSpeed: number;
  spawnGrace: number;
  combatReady: boolean;
  contained: boolean;
  gateEntering: boolean;
  gateEntrySpeed: number;
  combatReadyX: number;
  marked: number;
  stunned: number;
  bleedRemaining: number;
  bleedDamagePerSecond: number;
  aiDestinationX: number;
  aiMoveDirection: number;
  abilityCooldown: number;
  abilityWindup: number;
  attackSequence: number;
  damageReductionRemaining: number;
  damageReductionMultiplier: number;
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
  armorBreakStacks: number;
  armorBrokenRemaining: number;
  burning?: boolean;
  slowMultiplier?: number;
  stationAbility: StationAbilityRuntime;
};
type StationAbilityRuntime = {
  phase: string;
  remainingSeconds: number;
  targetId?: string | null;
  lane?: Lane | null;
  lockedLane?: Lane | null;
  zoneId?: string | number | null;
  ownerId?: string | number | null;
  ownerSide?: "human" | "zombie" | null;
  centerX?: number | null;
  centerY?: number | null;
  targetX?: number | null;
  direction?: number;
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
type Shot = { x: number; y: number; tx: number; ty: number; life: number; side: "human" | "zombie"; effect?: RoleEffect; emphasized?: boolean; duration?: number; style?: "projectile" | "melee" | "crawler"; weapon?: string };
type DamageText = { x: number; y: number; value: string; life: number; color: string };
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
type AirstrikeRuntime = ReturnType<typeof createEmergencySupportRuntime> & { targetLane: Lane | null };
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

type StationMetrics = {
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
  deployTimer: number;
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
  stationMetrics: StationMetrics;
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
  takuyaEntranceAudioActive: boolean;
  crawlerHitFlash: number;
  threat: number;
  objective: string;
  deployCooldowns: Record<UnitKind, number>;
  battleBarks: BattleBark[];
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
const emptyStationMetrics = (): StationMetrics => ({
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
  return { phase: "idle", remainingSeconds: 0 };
}

const initialGame = (
  selectedSupply: SupplyKind = "pod",
  stageId = CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE,
  formationKinds: UnitKind[] = cards.slice(0, 7).map((card) => card.kind),
  resultId = createBattleResultId(stageId),
  storyBattleReadEventIds: string[] = [],
): Game => {
  const definition = createBattleDefinition(stageId) as BattleDefinition;
  return ({
  definition,
  resultId,
  formationKinds: [...formationKinds],
  running: false,
  paused: false,
  over: false,
  won: false,
  time: 0,
  last: 0,
  energy: COMMAND_INITIAL,
  supportGauge: 0,
  scrap: 0,
  kills: 0,
  wave: 1,
  phase: 1,
  eventIndex: 0,
  convoyProgress: 0,
  civiliansEvacuated: 0,
  enemySpawn: createEnemySpawnRuntime() as EnemySpawnRuntime,
  baseHp: definition.baseMaxHp,
  baseMaxHp: definition.baseMaxHp,
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
  deployTimer: 0,
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
  crawlerHitFlash: 0,
  crawlerHitSfxCooldown: 0,
  criticalAnnounced: false,
  takuyaEnragedAnnounced: false,
  takuyaEntranceAudioRemaining: 0,
  battleBarks: createBattleBarkRuntime(),
  barkFlags: [],
  storyFlowState: createBattleStoryFlowState(stageId),
  storyBattleBarkState: createStoryBattleBarkState(),
  storyBattleReadEventIds: [...storyBattleReadEventIds],
  storyBattleReceiptEventIds: [],
  enemyKindsSeen: [],
  signalIds: [],
  bossDefeated: false,
  bossDefeatPending: false,
  qaBarks: false,
  roleMetrics: emptyRoleMetrics(),
  stationMetrics: emptyStationMetrics(),
  });
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

function laneY(lane: Lane, id = 0) {
  return activeLaneCenters[lane] + ((id % 3) - 1) * 3;
}

function fighterDistance(a: Pick<Fighter, "x" | "y">, b: Pick<Fighter, "x" | "y">) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function effectDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, (a.y - b.y) * 2);
}

function createUnitRoleRuntime() {
  return {
    damageReductionRemaining: 0,
    damageReductionMultiplier: 1,
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
    armorBreakStacks: 0,
    armorBrokenRemaining: 0,
  };
}

function applyIncomingHumanDamage(
  g: Game,
  target: Fighter,
  incomingDamage: number,
  { attackKind = "melee" }: { attackKind?: "melee" | "ranged" } = {},
) {
  const incoming = Math.max(0, incomingDamage);
  let targetDamage = incoming;
  let redirectedDamage = 0;
  let preventedDamage = 0;
  const guardian = g.fighters
    .filter((candidate) => candidate.side === "human" && candidate.kind === "guardian" && candidate.hp > 0)
    .sort((left, right) => fighterDistance(left, target) - fighterDistance(right, target) || left.id - right.id)
    .find((candidate) => resolveGantetsuInterception({
      guardian: candidate,
      target,
      incomingDamage: incoming,
      attackKind,
      steadfast: { remainingSeconds: candidate.guardStandRemaining, available: candidate.guardStandAvailable },
    }).eligible);

  if (guardian) {
    const rawInterception = resolveGantetsuInterception({
      guardian,
      target,
      incomingDamage: incoming,
      attackKind,
      steadfast: { remainingSeconds: guardian.guardStandRemaining, available: guardian.guardStandAvailable },
    });
    const guardedDamage = naoDamageAfterProtection({
      damage: rawInterception.guardianDamage,
      protectionSeconds: guardian.damageReductionRemaining,
    });
    const protectedGuardian = {
      ...guardian,
      hp: guardian.hp + guardedDamage.prevented,
    };
    const appliedInterception = resolveGantetsuInterception({
      guardian: protectedGuardian,
      target,
      incomingDamage: incoming,
      attackKind,
      steadfast: { remainingSeconds: guardian.guardStandRemaining, available: guardian.guardStandAvailable },
    });
    guardian.hp = appliedInterception.guardianHp;
    guardian.guardStandRemaining = appliedInterception.steadfast.remainingSeconds;
    guardian.guardStandAvailable = appliedInterception.steadfast.available;
    guardian.flash = Math.max(guardian.flash, .12);
    redirectedDamage = rawInterception.guardianDamage;
    targetDamage = rawInterception.targetDamage;
    preventedDamage += guardedDamage.prevented;
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

  const protectedTarget = naoDamageAfterProtection({
    damage: targetDamage,
    protectionSeconds: target.damageReductionRemaining,
  });
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
  preventedDamage += protectedTarget.prevented;
  g.roleMetrics.naoPreventedDamage += protectedTarget.prevented;
  return Object.freeze({
    targetDamage: appliedTargetDamage,
    redirectedDamage,
    preventedDamage,
  });
}

function bodyRadiusFor(kind: string) {
  if (kind === "gate-eater") return 25;
  if (kind === "takuya" || kind === "abomination") return 20;
  if (kind === "guardian") return 18;
  if (kind === "crusher" || kind === "brute" || kind === "kumaverson" || kind === "grappler") return 16;
  if (kind === "ooze") return 14;
  if (kind === "crazy-king") return 14;
  return 11;
}

function enemyLaneSpeedFor(kind: string) {
  if (kind === "sprinter") return 82;
  if (kind === "runner" || kind === "shade") return 64;
  if (kind === "spitter") return 42;
  if (kind === "grappler") return 32;
  if (kind === "ooze") return 26;
  if (kind === "gate-eater") return 22;
  if (kind === "walker" || kind === "turned") return 38;
  if (kind === "takuya") return 32;
  if (kind === "crusher") return 24;
  return 18;
}

function enemyStats(kind: string, wave: number) {
  if (kind === "gate-eater") return { hp: 1800, speed: 7, damage: 64, range: 42, attackEvery: 1.32 };
  if (kind === "grappler") return { hp: 165 + wave * 4, speed: 13, damage: 20, range: 34, attackEvery: 1.12 };
  if (kind === "ooze") return { hp: 138 + wave * 3, speed: 10, damage: 14, range: 68, attackEvery: 1.45 };
  if (kind === "sprinter") return { hp: 78 + wave * 2, speed: 38, damage: 18, range: 24, attackEvery: .68 };
  if (kind === "takuya") return { hp: 1200, speed: 9, damage: 58, range: 38, attackEvery: 1.15 };
  if (kind === "shade") return { hp: 220, speed: 29, damage: 23, range: 27, attackEvery: .62 };
  if (kind === "abomination") return { hp: 480, speed: 8, damage: 50, range: 28, attackEvery: 1.18 };
  if (kind === "crusher") return { hp: 210 + wave * 5, speed: 11, damage: 35, range: 27, attackEvery: 1.18 };
  if (kind === "spitter") return { hp: 72 + wave * 3, speed: 14, damage: 13, range: 122, attackEvery: 1.5 };
  if (kind === "runner") return { hp: 52 + wave * 2, speed: 34, damage: 14, range: 25, attackEvery: .72 };
  if (kind === "turned") return { hp: 95, speed: 18, damage: 18, range: 25, attackEvery: .88 };
  return { hp: 86 + wave * 5, speed: 18, damage: 15, range: 25, attackEvery: 1.02 };
}

function spawnEnemy(g: Game, kind: string, lane: Lane, order = 0, gateEntry: EnemySpawnEntry | null = null) {
  const data = enemyStats(kind, g.wave);
  if (!g.enemyKindsSeen.includes(kind)) g.enemyKindsSeen.push(kind);
  const id = g.nextId++;
  const gateEntering = kind !== "turned" && gateEntry !== null;
  g.fighters.push({
    id,
    side: "zombie",
    kind,
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
    gateEntrySpeed: gateEntry?.entrySpeed ?? 0,
    combatReadyX: gateEntry?.combatReadyX ?? 0,
    marked: 0,
    stunned: 0,
    bleedRemaining: 0,
    bleedDamagePerSecond: 0,
    aiDestinationX: 0,
    aiMoveDirection: 0,
    abilityCooldown: kind === "takuya" ? 4.2
      : kind === "gate-eater" ? 4
        : kind === "grappler" ? 2.5
          : kind === "ooze" ? 3
            : kind === "sprinter" ? 2
              : 0,
    abilityWindup: 0,
    attackSequence: 0,
    stationAbility: createStationAbilityRuntime(kind),
    ...createUnitRoleRuntime(),
  });
  return g.fighters[g.fighters.length - 1];
}

function spawnHuman(g: Game, kind: UnitKind) {
  const card = cards.find((item) => item.kind === kind);
  if (!card) return null;
  const id = g.nextId++;
  const laneCounts = [0, 0, 0];
  for (const ally of g.fighters) {
    if (ally.side === "human" && ally.hp > 0 && ally.anchorLane !== null) laneCounts[ally.anchorLane] += 1;
  }
  const assignedLane = chooseHumanDeploymentLane({ laneCounts }) as Lane;
  const laneSpeed = kind === "scout" ? 78
    : kind === "brawler" ? 68
      : kind === "brute" ? 42
        : kind === "guardian" ? 36
        : kind === "gunner" ? 54
          : kind === "crazy-king" ? 58
            : kind === "kumaverson" ? 48
              : kind === "babayaga" ? 62
                : kind === "engineer" ? 56
                : 60;
  g.fighters.push({
    id, side: "human", kind, lane: MUSTER_LANE, anchorLane: assignedLane, x: MUSTER_X, y: activeMusterY(), hp: card.hp, maxHp: card.hp,
    speed: card.speed, damage: card.damage, range: card.range, cooldown: 0, supportCooldown: 0,
    attackEvery: card.attackEvery, flash: 0, step: Math.random() * 4, attack: 0, knock: 0, variant: id % 3,
    targetId: null, targetObjectId: null, retargetIn: 0, nextLaneDecisionAt: 0, bodyRadius: bodyRadiusFor(kind), laneSpeed, spawnGrace: .95,
    combatReady: true, gateEntering: false, gateEntrySpeed: 0, combatReadyX: 0,
    contained: false,
    marked: 0, stunned: 0, bleedRemaining: 0, bleedDamagePerSecond: 0, aiDestinationX: MUSTER_X, aiMoveDirection: 0, abilityCooldown: 0, abilityWindup: 0, attackSequence: 0,
    stationAbility: createStationAbilityRuntime(kind),
    ...createUnitRoleRuntime(),
  });
  addParticles(g, MUSTER_X, activeMusterY(), "#d0b48b", 7);
  g.banner = `${card.name} // 移動拠点から出撃`;
  g.bannerTime = .8;
  return card;
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
    event.units.some(([kind]) => kind === "takuya")
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

const SPRITE_DISPLAY_SIZES: Record<string, { w: number; h: number }> = {
  scout: { w: 58, h: 98 }, ranger: { w: 58, h: 98 }, brute: { w: 72, h: 108 },
  brawler: { w: 62, h: 99 }, gunner: { w: 60, h: 100 }, medic: { w: 60, h: 100 },
  "crazy-king": { w: 72, h: 104 }, kumaverson: { w: 64, h: 102 }, babayaga: { w: 62, h: 103 },
  guardian: { w: 78, h: 108 }, engineer: { w: 60, h: 100 },
  walker: { w: 58, h: 96 }, runner: { w: 53, h: 90 }, turned: { w: 58, h: 96 },
  shade: { w: 64, h: 101 }, spitter: { w: 62, h: 101 }, crusher: { w: 80, h: 112 },
  abomination: { w: 101, h: 132 }, takuya: { w: 94, h: 128 },
  grappler: { w: 78, h: 108 }, ooze: { w: 70, h: 94 }, sprinter: { w: 58, h: 96 },
  "gate-eater": { w: 126, h: 142 },
};

function spriteDisplaySize(kind: string) {
  return SPRITE_DISPLAY_SIZES[kind] ?? { w: 58, h: 96 };
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
  const x = fighter.engineerTrapX;
  const y = activeLaneCenters[fighter.engineerTrapLane] + 5;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,.45)";
  ctx.beginPath(); ctx.ellipse(0, 3, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#d9c16d"; ctx.fillStyle = "#5b5335"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-14, -7, 28, 10, 3); ctx.fill(); ctx.stroke();
  for (const offset of [-9, 0, 9]) {
    ctx.beginPath(); ctx.moveTo(offset - 3, -7); ctx.lineTo(offset, -15); ctx.lineTo(offset + 3, -7); ctx.stroke();
  }
  ctx.restore();
}

function drawSpriteFighter(ctx: CanvasRenderingContext2D, f: Fighter, sprites: SpriteMap) {
  const sprite = sprites[f.kind];
  if (!sprite?.complete || !sprite.naturalWidth) {
    drawDiagnosticRoleFighter(ctx, f);
    drawDiagnosticStationEnemy(ctx, f);
    return;
  }
  const moving = f.side === "zombie" || Math.abs(f.aiMoveDirection) > .05;
  const state = f.flash > 0 ? "hit"
    : f.attack > .09 ? "attack-b"
      : f.attack > 0 ? "attack-a"
        : moving ? (Math.floor(f.step * (f.kind === "runner" ? 8 : 5)) % 2 ? "walk-b" : "walk-a")
          : "idle";
  const direction = f.side === "human" ? (f.aiMoveDirection < -.05 ? "left" : "right") : "left";
  const frame = spriteFrameFor(f.kind, state, direction);
  const authoredSize = fitSpriteBattleDisplaySize(f.kind, frame, spriteDisplaySize(f.kind));
  const compactScale = activeLaneCenters === LANE_Y ? 1 : 1.1;
  const size = { w: authoredSize.w * compactScale, h: authoredSize.h * compactScale };
  const bob = Math.abs(Math.sin(f.step * 7)) * 1.1;
  ctx.save();
  if (f.side === "human" && f.spawnGrace > 0) {
    ctx.beginPath();
    ctx.rect(WORLD_GEOMETRY.crawler.exitX - 2, 0, W - WORLD_GEOMETRY.crawler.exitX + 2, H);
    ctx.clip();
  } else if (f.side === "zombie" && f.gateEntering) {
    ctx.beginPath();
    ctx.rect(0, 0, ENEMY_GATE_SPAWN.revealX, H);
    ctx.clip();
  }
  ctx.fillStyle = "rgba(0,0,0,.42)";
  ctx.beginPath();
  ctx.ellipse(f.x, f.y + 8, size.w * .27, 4.5, 0, 0, Math.PI * 2);
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
    const cartSprite = stageObjects["station-platform-mission-art-source"];
    if (cartSprite?.complete && cartSprite.naturalWidth) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(cartSprite, 90, 260, 1400, 520, -60, -51, 120, 45);
    } else {
      ctx.fillStyle = "#5f665f"; ctx.strokeStyle = g.stageMission.stalled ? "#e19b5e" : "#aebbb0"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(-28, -27, 56, 30, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#bfc8bb"; ctx.fillRect(-22, -20, 18, 12);
      ctx.fillStyle = "#81735a"; ctx.fillRect(2, -20, 20, 12);
      ctx.fillStyle = "#171b1a"; ctx.beginPath(); ctx.arc(-18, 5, 6, 0, Math.PI * 2); ctx.arc(18, 5, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = g.stageMission.stalled ? "#e19b5e" : "#aebbb0";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-60, -51, 120, 45);
    ctx.fillStyle = "rgba(0,0,0,.8)"; ctx.fillRect(-60, -61, 120, 6);
    ctx.fillStyle = "#d5b85e"; ctx.fillRect(-59, -60, 118 * integrity / maxIntegrity, 4);
    ctx.restore();
  }
  if (g.definition.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL) {
    const activated = g.stageMission.powerActivated ?? 0;
    const configuredPanelXs = g.definition.missionConfig.powerXs;
    const panelXs = Array.isArray(configuredPanelXs) && configuredPanelXs.length === 3
      ? configuredPanelXs.map((value, index) => Number(value) || [410, 584, 744][index])
      : [410, 584, 744];
    const configuredLanes = g.definition.missionConfig.powerLanes;
    const lanes = (Array.isArray(configuredLanes) && configuredLanes.length === 3
      ? configuredLanes.map((value, index) => [0, 1, 2].includes(Number(value)) ? Number(value) : [0, 2, 1][index])
      : [0, 2, 1]) as Lane[];
    for (let index = 0; index < 3; index++) {
      const active = index < activated;
      const current = index === activated;
      const x = panelXs[index];
      const y = activeLaneCenters[lanes[index]] - 8;
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
  } else if (f.kind === "gate-eater" && f.stationAbility.phase === "windup") {
    const targetX = f.stationAbility.targetX ?? BASE_X + 48;
    ctx.fillStyle = "rgba(224,166,83,.16)";
    ctx.fillRect(targetX, f.y - 31, Math.max(0, f.x - targetX), 62);
    ctx.strokeStyle = "rgba(231,178,91,.9)";
    ctx.strokeRect(targetX, f.y - 31, Math.max(0, f.x - targetX), 62);
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

function drawCrawler(ctx: CanvasRenderingContext2D, g: Game, sprites: SpriteMap) {
  const crawlerSprite = sprites.crawler;
  const crawler = WORLD_GEOMETRY.crawler;
  const deploymentGlow = g.fighters.reduce((glow, fighter) => fighter.side === "human" ? Math.max(glow, fighter.spawnGrace) : glow, 0);
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
  if (crawlerSprite?.complete && crawlerSprite.naturalWidth) {
    ctx.globalAlpha = .92 + Math.max(0, g.baseHp / g.baseMaxHp) * .08;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(crawlerSprite, crawler.x, crawler.y, crawler.width, crawler.height);
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
  if (deploymentGlow > 0) {
    ctx.globalAlpha = Math.min(.92, .38 + deploymentGlow * .58);
    ctx.fillStyle = "#14120f";
    ctx.fillRect(crawler.exitX - 21, activeMusterY() - 79, 22, 76);
    const glow = ctx.createRadialGradient(crawler.exitX - 3, activeMusterY() - 34, 2, crawler.exitX - 3, activeMusterY() - 34, 42);
    glow.addColorStop(0, `rgba(255,205,112,${Math.min(.48, deploymentGlow * .56)})`);
    glow.addColorStop(1, "rgba(221,103,47,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.fillRect(crawler.exitX - 45, activeMusterY() - 86, 90, 92);
    ctx.fillStyle = `rgba(242,178,82,${Math.min(.72, deploymentGlow * .76)})`;
    ctx.fillRect(crawler.exitX - 5, activeMusterY() - 69, 4, 66);
  }
  ctx.restore();
}

function drawCrawlerExitFrame(ctx: CanvasRenderingContext2D, g: Game) {
  const deploymentGlow = g.fighters.reduce((glow, fighter) => fighter.side === "human" ? Math.max(glow, fighter.spawnGrace) : glow, 0);
  if (deploymentGlow <= 0) return;
  const exitX = WORLD_GEOMETRY.crawler.exitX;
  ctx.save();
  ctx.globalAlpha = Math.min(1, .35 + deploymentGlow);
  ctx.fillStyle = "#281d16";
  ctx.fillRect(exitX - 2, activeMusterY() - 80, 4, 78);
  ctx.fillStyle = "rgba(242,178,82,.72)";
  ctx.fillRect(exitX, activeMusterY() - 69, 2, 66);
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
  if (runtime.phase === "idle" || runtime.targetX === null || runtime.targetLane === null) return;
  const y = activeLaneCenters[runtime.targetLane];
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
    .flatMap((object) => {
      const renderY = stageObjectRenderY(object);
      const halfHeight = (object.collision?.height ?? 0) / 2;
      const declaredLanes = object.collision?.lanes ?? [];
      const affectedLanes = declaredLanes.length > 0
        ? declaredLanes.filter((lane): lane is Lane => lane === 0 || lane === 1 || lane === 2)
        : ([0, 1, 2] as Lane[]).filter((lane) => Math.abs(activeLaneCenters[lane] - renderY) <= halfHeight + 18);
      return affectedLanes.map((lane) => ({
        lane,
        minX: object.placement.x - (object.collision?.width ?? 0) / 2,
        maxX: object.placement.x + (object.collision?.width ?? 0) / 2,
      }));
    });
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
  const compact = activeLaneCenters[0] !== LANE_Y[0];
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
      const { w: width, h: height } = fitSpriteBattleDisplaySize(corpse.kind, frame, spriteDisplaySize(corpse.kind));
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
    if (f.combatReady && f.kind === "takuya" && f.abilityWindup > 0) {
      const slamRadius = f.hp / f.maxHp <= .5 ? 145 : 118;
      const pulse = slamRadius + Math.sin(g.time * 18) * 4;
      ctx.strokeStyle = `rgba(255,94,56,${.55 + Math.sin(g.time * 14) * .18})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y + 2, pulse, pulse / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (f.combatReady) drawStationEnemyTelegraph(ctx, f, g);
    drawSpriteFighter(ctx, f, sprites);
    if (!f.combatReady) continue;
    const compactScale = activeLaneCenters === LANE_Y ? 1 : 1.1;
    const barW = (f.kind === "takuya" || f.kind === "gate-eater" ? 52 : f.kind === "crusher" || f.kind === "grappler" || f.kind === "brute" || f.kind === "guardian" ? 38 : f.kind === "abomination" ? 52 : 28) * compactScale;
    const height = (f.kind === "takuya" || f.kind === "gate-eater" ? 111 : f.kind === "abomination" ? 115 : f.kind === "crusher" || f.kind === "grappler" || f.kind === "brute" || f.kind === "guardian" ? 94 : 80) * compactScale;
    const barHeight = compactScale > 1 ? 6 : 4;
    const barY = f.y - height - (compactScale > 1 ? 2 : 0);
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

  drawCrawlerExitFrame(ctx, g);
  drawCrawlerBarrage(ctx, g);

  for (const shot of g.shots) {
    const duration = shot.duration ?? .12;
    const p = Math.max(0, Math.min(1, 1 - shot.life / duration));
    const x = shot.x + (shot.tx - shot.x) * p;
    const y = shot.y + (shot.ty - shot.y) * p;
    const dx = shot.tx - shot.x;
    const dy = shot.ty - shot.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / distance;
    const uy = dy / distance;
    const weapon = shot.weapon ?? shot.effect ?? (shot.side === "human" ? "ranger" : "spitter");
    const color = weapon === "ranger" ? "#b7efff"
      : weapon === "gunner" ? "#ffd067"
        : weapon === "medic" ? "#79efac"
          : weapon === "babayaga" ? "#ddd8bd"
            : weapon === "spitter" ? "#91cf72"
              : weapon === "crawler" ? "#ffe09a"
                : shot.side === "human" ? "#ffe078" : "#e76747";
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
      const tailLength = weapon === "crawler" ? 46 : weapon === "gunner" ? 28 : weapon === "spitter" ? 18 : 22;
      ctx.lineWidth = weapon === "crawler" ? 2.8 : weapon === "gunner" ? 2.2 : weapon === "spitter" ? 2.4 : 1.45;
      ctx.beginPath();
      ctx.moveTo(x - ux * tailLength, y - uy * tailLength);
      ctx.lineTo(x, y);
      ctx.stroke();
      if (weapon === "crawler") {
        ctx.globalAlpha = .45;
        ctx.beginPath(); ctx.moveTo(x - ux * 30 - uy * 3, y - uy * 30 + ux * 3); ctx.lineTo(x - uy * 3, y + ux * 3); ctx.stroke();
      }
      if (p < .3) {
        const muzzle = 4 + (1 - p / .3) * (weapon === "crawler" ? 9 : 5);
        ctx.globalAlpha = .9;
        ctx.beginPath();
        ctx.moveTo(shot.x - ux * 2, shot.y - uy * 2);
        ctx.lineTo(shot.x + ux * muzzle, shot.y + uy * muzzle);
        ctx.moveTo(shot.x - uy * muzzle * .45, shot.y + ux * muzzle * .45);
        ctx.lineTo(shot.x + uy * muzzle * .45, shot.y - ux * muzzle * .45);
        ctx.stroke();
      }
      if (p > .62) {
        const impact = (p - .62) / .38;
        ctx.globalAlpha = 1 - impact * .7;
        ctx.lineWidth = weapon === "crawler" ? 2.5 : 1.5;
        ctx.beginPath(); ctx.arc(shot.tx, shot.ty, 3 + impact * (weapon === "crawler" ? 12 : 7), 0, Math.PI * 2); ctx.stroke();
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
  const audioActivationPendingRef = useRef(false);
  const audioAssetFailureRef = useRef(false);
  const lastHudRef = useRef(0);
  const selectedActionRef = useRef<SelectedAction>(null);
  const eventDestinationRef = useRef<EventDestination>("map");
  const eventQueueRef = useRef<string[]>([]);
  const eventCompletionLockRef = useRef(false);
  const finalizedEndRef = useRef<BattleResult | null>(null);
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
  const [eventId, setEventId] = useState<string | null>(null);
  const [storyAudioPosition, setStoryAudioPosition] = useState<{ eventId: string | null; lineIndex: number }>({ eventId: null, lineIndex: 0 });
  const [forceStoryReplay, setForceStoryReplay] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState(INITIAL_STAGE_ID);
  const [campaignSave, setCampaignSave] = useState<CampaignSave>(() => createDefaultCampaignSave() as CampaignSave);
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
  const [hud, setHud] = useState<Hud>({
    missionType: "assault", energy: COMMAND_INITIAL, supportGauge: 0, scrap: 0, kills: 0, wave: 1, phase: 1, baseHp: 1000, baseMaxHp: 1000,
    barricadeHp: BARRICADE_MAX_HP, barricadeMaxHp: BARRICADE_MAX_HP, barricadeVulnerable: true, barricadeHitFlash: 0,
    deployQueue: 0, airstrikePhase: "idle", crawlerPhase: "cooldown", crawlerCharge: .5, combo: 0, bossHp: 0, bossMax: 0,
    takuyaEntranceAudioActive: false,
    crawlerHitFlash: 0, threat: 0,
    objective: objectiveFor(1, false), deployCooldowns: emptyCooldowns(), battleBarks: [],
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
      if (reconciled.serialized && Number.isFinite(sourceSchemaVersion) && sourceSchemaVersion < 5) {
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
      setBgmMuted(localQaAudio ? false : !loaded.settings.bgmEnabled);
      sfxMutedRef.current = localQaAudio ? false : !loaded.settings.sfxEnabled;
      setSfxMuted(localQaAudio ? false : !loaded.settings.sfxEnabled);
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
        const portraitPaths = [...new Set(Object.values(PORTRAIT_ART))];
        const productionImagePaths = [...new Set([
          ...portraitPaths,
          PRODUCTION_VISUALS.title,
          PRODUCTION_VISUALS.command,
          PRODUCTION_VISUALS.guide,
          ...Object.values(PRODUCTION_VISUALS.stages),
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
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") return;
    const qaWindow = window as typeof window & { __ASHFALL_BATTLE_QA__?: unknown };
    const bridge = {
      getSnapshot: () => {
        const g = gameRef.current;
        const geometry = stageGeometryFor(g.definition.stageId, activeStageViewportId);
        const grounding = combatReadyGroundingAudit({ geometry, fighters: g.fighters });
        return {
          screen,
          resultId: g.resultId,
          stageId: g.definition.stageId,
          time: g.time,
          running: g.running,
          paused: g.paused,
          over: g.over,
          won: g.won,
          bossDefeated: g.bossDefeated,
          bossDefeatPending: g.bossDefeatPending,
          baseHp: g.baseHp,
          baseMaxHp: g.baseMaxHp,
          barricadeHp: g.barricadeHp,
          barricadeMaxHp: g.barricadeMaxHp,
          wave: g.wave,
          eventIndex: g.eventIndex,
          pendingSpawnCount: g.enemySpawn.pending.length,
          takuyaEntranceAudioRemaining: g.takuyaEntranceAudioRemaining,
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
            debugPrimitiveCount: geometry.debugPrimitives.length,
          },
          fighters: g.fighters.map((fighter) => ({
            id: fighter.id,
            side: fighter.side,
            kind: fighter.kind,
            lane: fighter.lane,
            assignedLane: fighter.anchorLane,
            x: fighter.x,
            y: fighter.y,
            hp: fighter.hp,
            bodyRadius: fighter.bodyRadius,
            targetId: fighter.targetId,
            targetObjectId: fighter.targetObjectId,
            combatReady: fighter.combatReady,
            contained: fighter.contained,
            damageReductionRemaining: fighter.damageReductionRemaining,
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
            armorBreakStacks: fighter.armorBreakStacks,
            stationAbility: { ...fighter.stationAbility },
          })),
          completedStageIds: [...campaignSave.completedStageIds],
          unlockedStageIds: [...campaignSave.unlockedStageIds],
          processedResultIds: [...campaignSave.processedResultIds],
        };
      },
    };
    qaWindow.__ASHFALL_BATTLE_QA__ = bridge;
    const publishSnapshot = () => {
      document.documentElement.dataset.battleQaSnapshot = JSON.stringify(bridge.getSnapshot());
    };
    publishSnapshot();
    const snapshotTimer = window.setInterval(publishSnapshot, 250);
    return () => {
      window.clearInterval(snapshotTimer);
      delete document.documentElement.dataset.battleQaSnapshot;
      if (qaWindow.__ASHFALL_BATTLE_QA__ === bridge) delete qaWindow.__ASHFALL_BATTLE_QA__;
    };
  }, [campaignSave.completedStageIds, campaignSave.processedResultIds, campaignSave.unlockedStageIds, screen]);

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
    const stageEnemyKinds = Array.isArray(CAMPAIGN_STAGE_BY_ID[selectedStageId]?.enemyKinds)
      ? CAMPAIGN_STAGE_BY_ID[selectedStageId].enemyKinds as UnitKind[]
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
      crawler: "/crawler-fortress-v1.png", pod: "/tactical-drop-pod-v1.png",
      drum: "/explosive-drum-v1.png", medical: "/medical-supply-station-v1.png",
    };
    const stageObjectAssets = STAGE_OBJECT_MANIFEST[selectedStageId]?.objects ?? [];
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
      if (stageId === selectedStageId) continue;
      releaseImage(image);
      delete backgroundCacheRef.current[stageId];
    }
    if (!backgroundCacheRef.current[selectedStageId]) backgroundRef.current = null;
    const currentBackground = backgroundCacheRef.current[selectedStageId];
    const criticalJobs = [
      ensureImageLoaded(currentBackground, stageVisualFor(selectedStageId), (image) => {
        backgroundCacheRef.current[selectedStageId] = image;
        backgroundRef.current = image;
      }),
      ensureImageLoaded(enemyBaseSpriteRef.current, "/infected-checkpoint-v1.png", (image) => { enemyBaseSpriteRef.current = image; }),
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
      root.dataset.assetResidentStage = selectedStageId;
      root.dataset.assetResidentSprites = String(Object.keys(spriteRefs.current).length);
      root.dataset.assetResidentStageObjects = String(Object.keys(stageObjectRefs.current).length);
      root.dataset.assetResidentBackgrounds = String(Object.keys(backgroundCacheRef.current).length);
      setAssetsReady(true);
    }).catch(() => { if (!cancelled) setAssetError(true); });
    return () => { cancelled = true; };
  }, [formationKindKey, qaMode, qaScenario, selectedStageId]);

  useEffect(() => {
    const configureCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nextLaneCenters = laneCentersForViewport(rect.width, rect.height) as LaneCenters;
      activeStageViewportId = resolveStageViewportProfile({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }).id;
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
        g.particles = [];
        g.damageTexts = [];
        activeLaneCenters = nextLaneCenters;
      }
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
      canvas.dataset.laneLayout = nextLaneCenters === LANE_Y ? "standard" : "compact-landscape";
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
  }, []);

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
        : sceneIdForScreen(screen, selectedStageId, musicState);
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
  }, [bgmMuted, campaignResult?.won, campaignSave.settings.bgmVolume, campaignSave.settings.sfxVolume, end?.won, eventId, hud.battleBarks.length, paused, screen, selectedStageId, sfxMuted, stopSynthMusic, storyAudioPosition.eventId, storyAudioPosition.lineIndex, storyFinalCutAudioActive, takuyaEntranceAudioActive]);

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
    const card = cards.find((item) => item.kind === kind);
    if (!card || !g.formationKinds.includes(kind) || g.deployQueue.length >= 3 || !canDeploy({ running: g.running, paused: g.paused, over: g.over, command: g.energy, cost: card.cost, cooldown: g.deployCooldowns[kind] })) {
      playCue("denied");
      if (g.deployQueue.length >= 3) { g.banner = "格納庫満員 // 3"; g.bannerTime = .9; }
      return false;
    }
    g.energy -= card.cost;
    g.deployCooldowns[kind] = card.deployCooldown;
    g.deployQueue.push(kind);
    if (g.deployQueue.length === 1 && g.deployTimer <= 0) g.deployTimer = .04;
    g.banner = `${card.name} // 出撃待機 ${g.deployQueue.length}/3`;
    g.bannerTime = .7;
    playCue("queue");
    return true;
  }, [playCue]);

  const placeBattlefieldSupply = useCallback((kind: SupplyKind, lane: Lane, x: number) => {
    const g = gameRef.current;
    if (!g.running || g.paused || g.over) return false;
    const stageObjectForbiddenZones = stageObjectForbiddenZonesForGame(g);
    const result = resolveBattlefieldSupplyPlacement({
      running: g.running, paused: g.paused, over: g.over, scrap: g.scrap, supplyKind: kind, lane, x,
      supplies: g.battlefieldObjects, objects: [], supports: [], areaEffects: g.areaEffects,
      nextId: g.nextId, nextAreaEffectId: g.nextAreaEffectId,
      laneCenters: activeLaneCenters,
      forbiddenZones: battlefieldPlacementForbiddenZones(stageObjectForbiddenZones),
    });
    g.placementIndicator = placementIndicatorFor(`supply:${kind}`, lane, x, result.ok, result.reason);
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
    g.banner = `${supplyDefs[kind].name}配置 // ${LANE_NAMES_JA[lane]}レーン`;
    g.bannerTime = 1.2; playCue(kind === "pod" ? "supply-pod" : kind === "drum" ? "supply-drum" : "supply-medical");
    emitBattleBark(g, kind === "pod" ? "support-pod" : kind === "drum" ? "support-drum" : "support-medical", kind === "drum" ? "gunner" : kind === "medical" ? "medic" : "guide", `support-${kind}`);
    if (kind === "pod") playCue("pod-descent");
    return true;
  }, [playCue]);

  const deployAirstrike = useCallback((lane: Lane, x: number) => {
    const g = gameRef.current;
    if (!g.running || g.paused || g.over) return false;
    const result = requestAirstrike({
      running: g.running, paused: g.paused, over: g.over, supportGauge: g.supportGauge,
      lane, x, runtime: g.airstrike,
    });
    if (!result.ok) {
      g.banner = placementReasonLabel(result.reason); g.bannerTime = .75; playCue("denied"); return false;
    }
    g.supportGauge = result.supportGauge;
    g.airstrike = result.runtime as AirstrikeRuntime;
    g.banner = `航空支援要請 // ${LANE_NAMES_JA[lane]}レーン`;
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

  const triggerDrumAt = useCallback((lane: Lane, x: number) => {
    const g = gameRef.current;
    if (!g.running || g.paused || g.over) return false;
    const drum = g.battlefieldObjects
      .filter((supply) => supply.kind === "drum" && supply.lane === lane && supply.phase === "active" && Math.abs(supply.x - x) <= 44)
      .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
    if (!drum) return false;
    const result = requestDrumDetonation(drum, "manual");
    if (!result.ok) return false;
    Object.assign(drum, result.supply);
    g.banner = `爆薬ドラム起爆 // ${LANE_NAMES_JA[lane]}レーン`; g.bannerTime = .85; playCue("drum-request");
    return true;
  }, [playCue]);

  const executeSelected = useCallback((lane: Lane, x: number) => {
    const action = selectedActionRef.current;
    if (!action) return;
    if (action.startsWith("supply:")) {
      const kind = action.slice("supply:".length) as SupplyKind;
      if (placeBattlefieldSupply(kind, lane, x)) chooseAction(null);
      return;
    }
    if (deployAirstrike(lane, x)) chooseAction(null);
  }, [chooseAction, deployAirstrike, placeBattlefieldSupply]);

  const pointerWorldPosition = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const transform = canvasTransformRef.current;
    const { x, y } = canvasPointerToWorld({ clientX: event.clientX, clientY: event.clientY, rect, transform, worldWidth: W, worldHeight: H });
    let lane: Lane = 0;
    if (Math.abs(y - activeLaneCenters[1]) < Math.abs(y - activeLaneCenters[lane])) lane = 1;
    if (Math.abs(y - activeLaneCenters[2]) < Math.abs(y - activeLaneCenters[lane])) lane = 2;
    return { x, lane };
  }, []);

  const handleBattlefieldPointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const action = selectedActionRef.current;
    if (!action) return;
    const { x, lane } = pointerWorldPosition(event);
    const g = gameRef.current;
    const stageObjectForbiddenZones = stageObjectForbiddenZonesForGame(g);
    const check = action.startsWith("supply:")
      ? battlefieldSupplyPlacementCheck({
        running: g.running, paused: g.paused, over: g.over, scrap: g.scrap,
        supplyKind: action.slice("supply:".length), lane, x, supplies: g.battlefieldObjects,
        laneCenters: activeLaneCenters,
        forbiddenZones: battlefieldPlacementForbiddenZones(stageObjectForbiddenZones),
      })
      : airstrikePlacementCheck({
        running: g.running, paused: g.paused, over: g.over, supportGauge: g.supportGauge,
        lane, x, runtime: g.airstrike,
      });
    g.placementIndicator = placementIndicatorFor(action, lane, x, check.ok, check.reason);
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
    const { x, lane } = pointerWorldPosition(event);
    if (!selectedActionRef.current) { triggerDrumAt(lane, x); return; }
    executeSelected(lane, x);
  }, [executeSelected, pointerWorldPosition, triggerDrumAt]);

  const handleBattlefieldPointerCancel = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (selectedActionRef.current) gameRef.current.placementIndicator = null;
  }, []);

  const stageViews = useMemo<StageScreenView[]>(() => (CAMPAIGN_STAGES as unknown as readonly CampaignStageData[]).map((stage) => {
    const claimed = campaignSave.claimedStarRewardsByStage[stage.id] ?? [];
    const nextMilestone = [1, 2, 3].find((star) => !claimed.includes(star));
    return {
      id: stage.id,
      displayName: stage.displayName,
      chapterName: "序章　新たな世界の始まり",
      objective: stage.objective,
      missionLabel: stage.id === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE
        ? "感染中継点破壊作戦"
        : stage.missionType === "escort"
          ? "保守台車護衛作戦"
          : stage.missionType === "sequential-seal"
            ? "三電源・封鎖作戦"
            : stage.missionType === "assault"
              ? "拠点破壊作戦"
              : stage.missionType === "timed-defense"
                ? "180秒防衛作戦"
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
                : "危険度 極高 / 改札喰い",
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
  const unitViews = useMemo<UnitScreenView[]>(() => (CAMPAIGN_UNITS as unknown as readonly CampaignUnitData[]).map((unit) => ({
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
  })), [campaignSave, qaMode, qaScenario]);
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
    const battleStageId = qaMode ? CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE : sessionOverride?.stageId ?? selectedStageId;
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
    if (qaScenario?.mode === "station") {
      // A terminal QA fixture must not immediately re-inject the same result
      // after the player chooses retry. Replays exercise the real fresh-start
      // path while retaining local-save isolation.
      prepareStationQa(fresh, retrying ? "start" : qaScenario.state);
    }
    gameRef.current = fresh;
    const boss = fresh.fighters.find((fighter) => fighter.kind === "takuya" && fighter.hp > 0);
    desiredMusicModeRef.current = "normal";
    finalizedEndRef.current = null;
    setStarted(true); setPaused(false); setEnd(null); setCampaignResult(null); setScreen("battle"); chooseAction(null);
    setHud({ missionType: fresh.definition.missionType, energy: Math.floor(fresh.energy), supportGauge: Math.floor(fresh.supportGauge), scrap: fresh.scrap, kills: fresh.kills,
      wave: fresh.wave, phase: fresh.phase, baseHp: fresh.baseHp, baseMaxHp: fresh.baseMaxHp,
      barricadeHp: fresh.barricadeHp, barricadeMaxHp: fresh.barricadeMaxHp, barricadeVulnerable: fresh.barricadeVulnerable, barricadeHitFlash: 0,
      deployQueue: fresh.deployQueue.length, airstrikePhase: fresh.airstrike.phase,
      crawlerPhase: fresh.crawlerAbility.phase, crawlerCharge: fresh.crawlerAbility.charge, combo: 0,
      bossHp: boss?.hp ?? 0, bossMax: boss?.maxHp ?? 0,
      takuyaEntranceAudioActive: false,
      crawlerHitFlash: 0, threat: 0, objective: objectiveForBattle(fresh.definition, fresh),
      deployCooldowns: { ...fresh.deployCooldowns }, battleBarks: [...fresh.battleBarks.active] });
    disposeBattleRuntime(); if (!bgmMuted) startMusic();
    if (retrying) playCue("retry");
    else {
      playCue("start-low");
      startCueTimerRef.current = window.setTimeout(() => { startCueTimerRef.current = null; playCue("start-high"); }, 90);
    }
  }, [bgmMuted, campaignSave, chooseAction, disposeBattleRuntime, formationKinds, playCue, qaMode, qaScenario, selectedStageId, selectedSupply, startMusic]);

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
    );
    gameRef.current = fresh;
    finalizedEndRef.current = null;
    setStarted(false); setPaused(false); setEnd(null); setCampaignResult(null); setScreen("map"); chooseAction(null);
  }, [chooseAction, disposeBattleRuntime, formationKinds, selectedStageId, selectedSupply]);

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
  const openLoadout = useCallback(() => setScreen("loadout"), []);
  const requestBattle = useCallback(() => {
    const nextEventIds = getStageEntryStoryEventIds({
      stageId: selectedStageId,
      completedStageIds: campaignSave.completedStageIds,
      readStoryEventIds: campaignSave.readStoryEventIds,
    });
    if (nextEventIds.length > 0) openEvents(nextEventIds, "battle");
    else startGame();
  }, [campaignSave.completedStageIds, campaignSave.readStoryEventIds, openEvents, selectedStageId, startGame]);
  const retryBattle = useCallback(() => {
    const nextEventId = getStageNextAttemptStoryEventId({
      stageId: selectedStageId,
      previousWon: campaignResult?.won === true,
    });
    if (nextEventId) openEvent(nextEventId, "battle");
    else startGame();
  }, [campaignResult?.won, openEvent, selectedStageId, startGame]);
  const continueResult = useCallback(() => {
    returnToMap();
  }, [returnToMap]);
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
    downloadCampaignText("nishijin-campaign-v5-backup.json", createCampaignManualExport(serialized, {
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
          if (Number.isFinite(sourceSchemaVersion) && sourceSchemaVersion < 5) {
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
    if (!end || finalizedEndRef.current === end) return;
    const timer = window.setTimeout(async () => {
      if (finalizedEndRef.current === end) return;
      finalizedEndRef.current = end;
      const resolved = resolveStageResult(campaignSave, {
        resultId: end.resultId,
        stageId: end.stageId,
        won: end.won,
        baseHp: end.baseHp,
        baseMaxHp: end.baseMaxHp,
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
  }, [campaignSave, end, persistCampaignSave, publishPendingResult]);

  useEffect(() => {
    if (!saveHydrated || !qaScenario || qaScenarioAppliedRef.current) return;
    qaScenarioAppliedRef.current = true;
    const timer = window.setTimeout(() => {
      setSelectedStageId(qaScenario.stageId);
      const qaUnitIds = (CAMPAIGN_UNITS as unknown as readonly CampaignUnitData[]).map((unit) => unit.id);
      const qaFormationUnitIds = qaUnitIds.slice(0, 7);
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
      if (qaScenario.mode === "station") {
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
      else if (qaScenario.screen === "formation") setScreen("loadout");
      else setScreen("map");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [campaignSave, openEvent, openEvents, qaScenario, saveHydrated, selectedSupply, startGame]);

  const togglePause = useCallback(() => {
    const g = gameRef.current;
    if (!g.running || g.over) return;
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

  const requestPauseAction = useCallback((action: PauseAction) => {
    if (!gameRef.current.running || gameRef.current.over) return;
    setPauseConfirm(action);
  }, []);

  const cancelPauseAction = useCallback(() => {
    const transition = createBattleSessionTransition({
      action: "cancel",
      stageId: selectedStageId,
      formationKinds,
      selectedSupply,
      campaignSave,
      currentResultId: gameRef.current.resultId,
    });
    if (transition?.destination === "pause" && !transition.discardBattleState && !transition.commitResult) {
      setPauseConfirm(null);
    }
  }, [campaignSave, formationKinds, selectedStageId, selectedSupply]);

  const confirmPauseAction = useCallback(() => {
    const action = pauseConfirm;
    if (!action) return;
    const transition = createBattleSessionTransition({
      action,
      stageId: selectedStageId,
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
      const fresh = initialGame(transition.selectedSupply, transition.stageId, transition.formationKinds as UnitKind[]);
      gameRef.current = fresh;
      finalizedEndRef.current = null;
      setStarted(false); setPaused(false); setEnd(null); setCampaignResult(null); setScreen("loadout"); chooseAction(null);
      return;
    }
    if (transition.destination === "map") returnToMap(transition as {
      stageId: string;
      formationKinds: UnitKind[];
      selectedSupply: SupplyKind;
    });
  }, [campaignSave, chooseAction, disposeBattleRuntime, formationKinds, pauseConfirm, returnToMap, selectedStageId, selectedSupply, startGame]);

  const updateVolume = useCallback((kind: "bgm" | "sfx", value: number) => {
    if (end || pendingResultCommit || resultSaveRetryingRef.current) return;
    const normalized = Math.max(0, Math.min(1, value));
    setCampaignSave((current) => updateCampaignSettings(current, kind === "bgm"
      ? { bgmVolume: normalized }
      : { sfxVolume: normalized }) as CampaignSave);
  }, [end, pendingResultCommit]);

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
    setCampaignSave((current) => updateCampaignSettings(current, { bgmEnabled: !next }) as CampaignSave);
    if (next) stopMusic(); else if (started && !paused && !end) startMusic();
  }, [bgmMuted, end, paused, pendingResultCommit, startMusic, started, stopMusic]);

  const toggleSfx = useCallback(() => {
    if (end || pendingResultCommit || resultSaveRetryingRef.current) return;
    const next = !sfxMutedRef.current;
    sfxMutedRef.current = next;
    setSfxMuted(next);
    setCampaignSave((current) => updateCampaignSettings(current, { sfxEnabled: !next }) as CampaignSave);
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
        bossMaxHp: g.bossDefeatPending ? enemyStats("takuya", g.wave).hp : boss?.maxHp ?? 0,
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
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const dt = Math.min(.033, g.last ? (now - g.last) / 1000 : 0);
      g.last = now;
      g.shake = advanceCameraShakeRuntime(g.shake, dt);
      if (g.running && !g.paused) g.battleBarks = advanceBattleBarkRuntime(g.battleBarks, dt) as BattleBarkRuntime;

      if (g.running && !g.paused && !g.over) {
        g.time += dt;
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
        g.deployTimer = Math.max(0, g.deployTimer - dt);
        if (g.deployQueue.length && g.deployTimer <= 0) {
          const kind = g.deployQueue.shift();
          if (kind) {
            const deployed = spawnHuman(g, kind);
            g.deployTimer = .45;
            if (deployed) {
              playProductionCue("support-pod-deploy", MUSTER_X, {
                priority: 58,
                cooldownMs: 90,
                volume: kind === "brute" ? .42 : .32,
                playbackRate: kind === "brute" ? .86 : 1.08,
                maxInstances: 1,
                fallbackCue: kind === "brute" ? "deploy-heavy" : "deploy-light",
              });
              const deployVoice = unitAudioCueFor(kind, "voice", "deploy") || humanVoiceCueForUnit(kind, "deploy");
              if (deployVoice) {
                playProductionCue(deployVoice, MUSTER_X, {
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

        while (g.eventIndex < g.definition.timeline.length && g.time >= g.definition.timeline[g.eventIndex].at) {
          const mission = g.definition.timeline[g.eventIndex++] as MissionEvent;
          const bossAlive = g.fighters.some((fighter) => fighter.kind === "takuya" && fighter.hp > 0);
          if (mission.bossOnly && !bossAlive) continue;
          g.wave = mission.wave; g.banner = mission.label; g.bannerTime = mission.label.includes("TAKUYA") ? 3.2 : 2.1;
          if (mission.label.includes("警告")) g.flashOverlay = .12;
          const firstNewEntryId = g.enemySpawn.nextEntryId;
          g.enemySpawn = (enqueueEnemyWave as unknown as (runtime: EnemySpawnRuntime, input: { units: [string, Lane][]; wave: number }) => EnemySpawnRuntime)(g.enemySpawn, { units: mission.units, wave: mission.wave });
          g.enemySpawn.pending = g.enemySpawn.pending.map((entry) => ({
            ...entry,
            y: entry.entryId >= firstNewEntryId
              ? activeLaneCenters[entry.lane] + (entry.y - LANE_Y[entry.lane])
              : entry.y,
          }));
          if (mission.units.length) {
            const includesTakuya = mission.units.some(([kind]) => kind === "takuya");
            if (includesTakuya) {
              g.takuyaEntranceAudioRemaining = TAKUYA_ENTRANCE_AUDIO.durationSeconds;
              setHud((current) => ({ ...current, takuyaEntranceAudioActive: true }));
              playProductionCue(TAKUYA_ENTRANCE_AUDIO.cueId, W / 2, {
                priority: 104,
                cooldownMs: 0,
                volume: .92,
                maxInstances: 1,
              });
              g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.takuyaEntrance);
              emitBattleBark(g, "takuya-entrance", "ranger", "takuya-entrance");
            } else {
              playCue("wave-contact");
              emitBattleBark(g, "wave-contact", "guide", `wave-${mission.wave}`);
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
          addParticles(g, g.airstrike.targetX ?? W / 2, activeLaneCenters[g.airstrike.targetLane ?? 1], "#f28d46", 34);
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
        const targetClaims = new Map<number, number>();
        const interceptorClaims = new Map<number, number>();
        for (const fighter of g.fighters) {
          if (fighter.hp <= 0 || !fighter.combatReady || fighter.targetId === null) continue;
          const claimed = fighterById.get(fighter.targetId);
          if (fighter.side === "human" && claimed?.side === "zombie" && claimed.hp > 0) {
            targetClaims.set(claimed.id, (targetClaims.get(claimed.id) ?? 0) + 1);
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

        for (const f of g.fighters) {
          if (g.definition.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL
            && f.kind === "gate-eater") {
            Object.assign(f, enforceGateEaterContainmentInvariant(f));
          }
          if (f.hp <= 0) continue;
          const humanMovementSpeed = f.side === "human"
            ? stationHumanMoveSpeed({
              baseSpeed: f.speed,
              slowMultiplier: f.slowMultiplier ?? 1,
              runtime: g.stageMission,
              missionType: g.definition.missionType,
              config: g.definition.missionConfig,
            })
            : f.speed;
          const humanLaneSpeed = f.side === "human"
            ? stationHumanMoveSpeed({
              baseSpeed: f.laneSpeed,
              slowMultiplier: f.slowMultiplier ?? 1,
              runtime: g.stageMission,
              missionType: g.definition.missionType,
              config: g.definition.missionConfig,
            })
            : f.laneSpeed;
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
          if (Math.abs(f.knock) > .1) { f.x += (f.side === "human" ? -1 : 1) * f.knock * dt * 6; f.knock *= .9; }

          if (f.gateEntering) {
            f.targetId = null;
            f.targetObjectId = null;
            f.x = Math.max(f.combatReadyX, f.x - f.gateEntrySpeed * dt);
            const routeY = activeLaneCenters[f.anchorLane ?? f.lane];
            const dy = routeY - f.y;
            if (Math.abs(dy) > 1) f.y += Math.sign(dy) * Math.min(Math.abs(dy), f.laneSpeed * .58 * dt);
            if (f.x <= f.combatReadyX + .01) {
              f.x = f.combatReadyX;
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
            if (["grappler", "ooze", "sprinter", "gate-eater"].includes(f.kind)
              && f.stationAbility.phase !== "idle") {
              f.stationAbility = createStationAbilityRuntime(f.kind);
              f.abilityCooldown = Math.max(f.abilityCooldown, 1.8);
            }
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
                g.bannerTime = Math.max(g.bannerTime, 1.05);
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
                  const damage = applyIncomingHumanDamage(g, victim, 34, { attackKind: "melee" }).targetDamage;
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
                  const resolved = applyIncomingHumanDamage(g, victim, damage, { attackKind: "melee" });
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
              f.abilityWindup = .85;
              f.abilityCooldown = f.hp / f.maxHp <= .5 ? 4.8 : 6.5;
              g.banner = "TAKUYA // 鉄槌強襲予告";
              g.bannerTime = .9;
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
                triggerRadius: UNIT_ROLE_TUNING.monkey.triggerRadius,
                stopSeconds: UNIT_ROLE_TUNING.monkey.stopSeconds,
              };
              const trigger = triggerMonkeyTrap(trap, g.fighters.filter((candidate) => candidate.side === "zombie"));
              if (trigger.triggered) {
                const trapped = g.fighters.find((candidate) => candidate.id === trigger.targetId && candidate.side === "zombie" && candidate.hp > 0);
                if (trapped) {
                  trapped.stunned = Math.max(trapped.stunned, trigger.stopSeconds);
                  f.engineerTrapReady = false;
                  f.engineerTrapCooldown = UNIT_ROLE_TUNING.monkey.placementIntervalSeconds;
                  g.roleMetrics.monkeyTrapTriggers += 1;
                  addDamageText(g, { x: trapped.x, y: trapped.y - 60, value: "足止め", life: .8, color: "#e1c978" });
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
                healerNumber: concurrentHealers + 1,
                existingProtectionSeconds: wounded.damageReductionRemaining,
              });
              const healed = healing.amount;
              const roleEffect = roleEffectForAction({ unitKind: f.kind, action: "heal", targetKind: wounded.kind }) as RoleEffect | null;
              wounded.hp = healing.hp;
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
          if (f.kind === "medic" && !returningToAssignedLane) {
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
            const enemies = g.fighters.filter((enemy) => enemy.side === "zombie" && enemy.hp > 0 && enemy.combatReady);
            const assignedLane = f.anchorLane ?? f.lane;
            const stagingForAssignedLane = f.x <= MUSTER_X + 12 && returningToAssignedLane;
            const tacticalEnemies = enemies;
            const takuyaAlive = enemies.some((enemy) => enemy.kind === "takuya");
            const containmentBossAlive = enemies.some((enemy) => enemy.kind === "gate-eater" && enemy.contained !== true);
            const objectiveX = g.definition.missionType === "timed-defense"
              ? null
              : g.barricadeVulnerable
                ? BARRICADE_X
                : advanceLimitFor(g.phase, g.barricadeVulnerable);
            const defenseFrontX = 555;
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
              enemies: tacticalEnemies.map((enemy) => ({
                id: enemy.id,
                side: enemy.side,
                x: enemy.x,
                y: enemy.y,
                lane: enemy.lane,
                hp: enemy.hp,
                combatReady: enemy.combatReady,
                bodyRadius: enemy.bodyRadius,
                verticalDistance: Math.abs(f.y - enemy.y),
                attackingCrawler: enemy.targetId === null
                  && enemy.targetObjectId === null
                  && enemy.x - BASE_X <= enemy.range + 10,
                blocksPath: Math.abs(enemy.y - f.y) <= enemy.bodyRadius + f.bodyRadius + 12
                  && Math.abs(enemy.x - f.x) <= Math.max(105, f.range + 36),
                threatensBase: enemy.x <= WORLD_GEOMETRY.threatNearX,
                baseThreatDistance: Math.max(0, enemy.x - BASE_X),
                priority: -roleTargetBias(f.kind, enemy.kind),
              })),
              objective: objectiveX === null ? null : { x: objectiveX, active: true },
              defenseAnchor: { 0: BASE_X + 205, 1: BASE_X + 225, 2: BASE_X + 205 },
              forwardAnchor: { 0: defenseFrontX - 15, 1: defenseFrontX, 2: defenseFrontX - 15 },
              claims: targetClaims,
              previousIntent: { targetId: f.targetId, destinationX: f.aiDestinationX, desiredX: f.aiDestinationX, moveDirection: f.aiMoveDirection },
              laneTransitioning: returningToAssignedLane,
              takuyaDefeated: g.definition.missionType === "boss-assault" && g.barricadeVulnerable && !takuyaAlive,
              maxPursuersPerEnemy: takuyaAlive || containmentBossAlive ? 9 : 2,
              localThreatRadius: Math.max(150, f.range + 56),
              hasLineOfSight: (_attacker, candidate) => {
                const actualTarget = fighterById.get(candidate.id);
                return actualTarget ? hasAdjacentLaneLineOfSight({
                  attacker: f,
                  target: actualTarget,
                  blockers: [...g.fighters, ...g.battlefieldObjects],
                }) : false;
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
            const holdAtMuster = stagingForAssignedLane
              && allyIntent.reason !== "crawler-under-attack"
              && !stationObjective;
            if (holdAtMuster) allyIntent = { ...allyIntent, destinationX: MUSTER_X, desiredX: MUSTER_X, moveDirection: 0 };
            f.aiDestinationX = holdAtMuster ? MUSTER_X : allyIntent.destinationX;
            f.aiMoveDirection = allyIntent.moveDirection;
            target = tacticalEnemies.find((enemy) => enemy.id === allyIntent?.targetId);
            if (f.retargetIn <= 0 || target?.id !== f.targetId) f.retargetIn = .34 + (f.variant % 3) * .05;
            if (target?.id !== f.targetId) {
              if (f.targetId !== null) targetClaims.set(f.targetId, Math.max(0, (targetClaims.get(f.targetId) ?? 1) - 1));
              if (target) targetClaims.set(target.id, (targetClaims.get(target.id) ?? 0) + 1);
              f.targetId = target?.id ?? null;
            }
          } else {
            const humans = g.fighters.filter((human) => human.side === "human" && human.hp > 0);
            const locked = f.targetId === null ? undefined : fighterById.get(f.targetId);
            const routeLane = f.lane;
            const blockingSupply = selectBlockingContainer({ enemyX: f.x, enemyLane: routeLane, objects: g.battlefieldObjects }) as BattlefieldObject | undefined;
            const contactSupply = g.battlefieldObjects
              .filter((supply) => !supply.blocksEnemies && enemyCanTargetBattlefieldSupply({ supply, enemyX: f.x, enemyLane: routeLane, attackRange: f.range }))
              .sort((a, b) => Math.abs(f.x - a.x) - Math.abs(f.x - b.x))[0];
            const crawlerInRange = !blockingSupply && f.x - BASE_X <= f.range + 10;
            const physicalContact = crawlerInRange ? undefined : humans
              .filter((human) => fighterDistance(f, human) <= f.range + human.bodyRadius + 4)
              .sort((a, b) => fighterDistance(f, a) - fighterDistance(f, b))[0];
            const routeY = activeLaneCenters[f.anchorLane ?? f.lane];
            const lookAhead = Math.max(105, f.range + 36);
            const defenderCapacity = (human: Fighter) => human.kind === "guardian" ? 4 : human.kind === "scout" || human.kind === "medic" ? 1 : 2;
            const routeBlockers = crawlerInRange ? [] : humans.filter((human) => isCrawlerRouteBlocker({
              enemyX: f.x, defenderX: human.x, defenderY: human.y, routeY, lookAhead,
            }));
            const availableBlockers = routeBlockers.filter((human) => {
              const claimsFromOthers = Math.max(0, (interceptorClaims.get(human.id) ?? 0) - (f.targetId === human.id ? 1 : 0));
              return claimsFromOthers < defenderCapacity(human);
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
            const lockedValid = locked?.side === "human" && locked.hp > 0 && availableBlockers.some((human) => human.id === locked.id);
            target = physicalContact ?? (blockingSupply ? undefined : (lockedValid && f.retargetIn > 0 ? locked : bestInterceptor));
            if (!target) objectTarget = blockingSupply ?? contactSupply;
            if (f.retargetIn <= 0 || target?.id !== f.targetId) f.retargetIn = .52 + (f.variant % 3) * .08;
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
              inContact: Boolean(physicalContact),
              routeCooldown: 1.05 + f.variant * .18,
              switchMargin: 9,
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
              hasLineOfSight: (attacker, candidate) => hasAdjacentLaneLineOfSight({
                attacker,
                target: candidate,
                blockers: [...g.fighters, ...g.battlefieldObjects],
              }),
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
                  g.banner = `爆薬ドラム損壊・起爆 // ${LANE_NAMES_JA[objectTarget.lane]}レーン`; g.bannerTime = 1.05;
                } else if (result.supply.phase === "destroying") {
                  f.targetObjectId = null;
                  g.banner = `${supplyDefs[objectTarget.kind].name}破壊 // ${LANE_NAMES_JA[objectTarget.lane]}レーン`; g.bannerTime = 1.25;
                  addParticles(g, objectTarget.x, objectTarget.y - 12, "#7e8e82", 18); playCue(objectTarget.kind === "pod" ? "pod-destroy" : "object-destroy");
                } else playCue(objectTarget.kind === "pod" ? "pod-hit" : "object-hit");
              }
            } else {
              const stopX = objectTarget.x + stoppingDistance;
              f.x = Math.max(stopX, f.x - f.speed * Math.min(f.slowMultiplier ?? 1, f.suppressionMultiplier) * dt);
              const routeY = activeLaneCenters[f.anchorLane ?? f.lane];
              const dy = routeY - f.y;
              if (Math.abs(dy) > 2) f.y += Math.sign(dy) * Math.min(Math.abs(dy), f.laneSpeed * dt);
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
              const attackDamage = baseAttackDamage * gateEaterProfile.multiplier;
              let appliedAttack: { targetDamage: number };
              if (f.side === "human"
                && target.kind === "gate-eater"
                && g.definition.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL
                && g.researchContainer) {
                const hpBeforeStrike = target.hp;
                const containerWasExposed = g.researchContainer.exposed;
                const containment = resolveContainmentStrike({
                  boss: target,
                  researchContainer: g.researchContainer,
                  attackDamage,
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
              } else if (f.side === "zombie" && target.side === "human") {
                appliedAttack = applyIncomingHumanDamage(g, target, attackDamage, { attackKind: f.range > 64 ? "ranged" : "melee" });
              } else {
                target.hp -= attackDamage;
                appliedAttack = { targetDamage: attackDamage };
              }
              target.flash = .12;
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
                crazyKingRadius = momentum.radius;
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
                const heat = applyRaiderShots({ heat: f.weaponHeat, overheated: f.overheated }, 1);
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
                  const suppression = applyRaiderSuppression(lineTarget.suppressionStacks, 1);
                  lineTarget.suppressionStacks = suppression.stacks;
                  lineTarget.suppressedRemaining = suppression.remainingSeconds;
                  lineTarget.suppressionMultiplier = suppression.speedMultiplier;
                  g.roleMetrics.raiderSuppressionApplications += 1;
                  if (lineTarget.id === target.id) continue;
                  const pierceDamage = attackDamage * .58;
                  lineTarget.hp -= pierceDamage;
                  lineTarget.flash = Math.max(lineTarget.flash, .1);
                  g.roleMetrics.raiderPierceHits += 1;
                  addDamageText(g, { x: lineTarget.x, y: lineTarget.y - 43, value: String(Math.round(pierceDamage)), life: .55, color: "#e8cc72" });
                }
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
                  Object.assign(secondary, nextSecondary);
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
                const weaponEvent = f.kind === "crazy-king" ? "attack" : f.kind === "kumaverson" ? "swing" : f.kind === "babayaga" ? "shot" : null;
                const contactAudioX = f.kind === "crazy-king" || f.kind === "kumaverson" ? (f.x + target.x) / 2 : f.x;
                playProductionCue((weaponEvent && unitAudioCueFor(f.kind, "weapon", weaponEvent)) || weaponCueForUnit(f.kind), contactAudioX, {
                  priority: f.kind === "gunner" || f.kind === "brute" || f.kind === "crazy-king" ? 74 : 64,
                  cooldownMs: f.kind === "crazy-king" ? 110 : f.kind === "kumaverson" ? 120 : f.kind === "gunner" || f.kind === "babayaga" ? 45 : 70,
                  volume: f.kind === "crazy-king" ? .66 : f.kind === "kumaverson" ? .52 : undefined,
                  maxInstances: f.kind === "crazy-king" || f.kind === "kumaverson" ? 1 : 5,
                  fallbackCue: ["ranger", "gunner", "medic", "babayaga", "engineer"].includes(f.kind) ? "ranged-shot" : "melee-hit",
                });
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
                if (Math.random() < .34) playProductionCue(humanVoiceCueForUnit(f.kind, "attack"), f.x, {
                  priority: 67,
                  cooldownMs: 320,
                  volume: f.kind === "brute" || f.kind === "brawler" || f.kind === "crazy-king" || f.kind === "kumaverson" ? .92 : .78,
                  maxInstances: 2,
                });
                if (target.side === "zombie" && Math.random() < .48) playProductionCue(enemyVoiceCue(target.kind, "hurt"), target.x, {
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
              target.knock = Math.max(target.knock, f.kind === "brute" || f.kind === "abomination" || f.kind === "takuya" || f.kind === "gate-eater" ? 9 : 3);
              f.attack = .18;
              f.cooldown = enragedTakuya
                ? .9
                : f.kind === "crazy-king"
                  ? crazyKingAttackInterval(f.attackEvery, f.comboHits)
                  : f.attackEvery;
              g.damageTexts.push({ x: target.x + (Math.random() - .5) * 10, y: target.y - 45, value: String(Math.round(appliedAttack.targetDamage)), life: .65, color: f.side === "human" ? "#f6d278" : "#e98a72" });
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
                const ranged = ["ranger", "gunner", "medic", "babayaga", "engineer"].includes(f.kind);
                g.shots.push({ x: f.x + 14, y: f.y - 32, tx: target.x, ty: target.y - 28, life: .26, duration: .26, side: "human", effect: roleEffect ?? undefined, emphasized, style: ranged ? "projectile" : "melee", weapon: f.kind });
                if (roleEffect && !["crazy-king", "kumaverson", "babayaga"].includes(f.kind)) playCue(`role-${roleEffect}` as SfxCueId);
                if (!productionMixerRef.current) {
                  if (["ranger", "gunner", "medic", "babayaga", "engineer"].includes(f.kind)) playCue("ranged-shot", { frequency: 310 + Math.random() * 50 });
                  else playCue("melee-hit");
                }
              } else if (f.kind === "spitter" || f.kind === "ooze") {
                g.shots.push({ x: f.x - 14, y: f.y - 32, tx: target.x, ty: target.y - 28, life: .2, duration: .2, side: "zombie", style: "projectile", weapon: "spitter" });
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
                g.barricadeHp = Math.max(0, g.barricadeHp - structureDamage);
                if (f.kind === "brute") g.roleMetrics.tataraStructureDamage += structureDamage;
                if (f.kind === "gunner") {
                  const wasOverheated = f.overheated;
                  const heat = applyRaiderShots({ heat: f.weaponHeat, overheated: f.overheated }, 1);
                  f.weaponHeat = heat.heat;
                  f.overheated = heat.overheated;
                  if (!wasOverheated && heat.overheated) g.roleMetrics.raiderOverheats += 1;
                }
                f.attackSequence += 1;
                emitBattleBarkOnce(g, `enemy-base-attack:${f.kind}`, RANDOM_BATTLE_BARK_TRIGGER_IDS.ENEMY_BASE_ATTACK, f.kind as UnitKind);
                const structureWeaponEvent = f.kind === "crazy-king" ? "attack" : f.kind === "kumaverson" ? "swing" : f.kind === "babayaga" ? "shot" : null;
                const structureAudioX = f.kind === "crazy-king" || f.kind === "kumaverson" ? (f.x + enemyBaseTarget.x) / 2 : f.x;
                playProductionCue((structureWeaponEvent && unitAudioCueFor(f.kind, "weapon", structureWeaponEvent)) || weaponCueForUnit(f.kind), structureAudioX, {
                  priority: f.kind === "brute" || f.kind === "gunner" || f.kind === "crazy-king" ? 76 : 64,
                  cooldownMs: f.kind === "crazy-king" ? 110 : f.kind === "kumaverson" ? 125 : f.kind === "gunner" || f.kind === "babayaga" ? 45 : 75,
                  volume: f.kind === "crazy-king" ? .64 : f.kind === "kumaverson" ? .5 : undefined,
                  maxInstances: f.kind === "crazy-king" || f.kind === "kumaverson" ? 1 : 5,
                  fallbackCue: f.kind === "brute" ? "structure-heavy" : "structure-light",
                });
                if (f.kind === "crazy-king") playProductionCue(unitAudioCueFor(f.kind, "weapon", "fleshHit"), structureAudioX, { priority: 74, volume: .56, cooldownMs: 110, maxInstances: 1 });
                if (f.kind === "kumaverson") playProductionCue(unitAudioCueFor(f.kind, "weapon", "heavyHit"), structureAudioX, { priority: 74, volume: .54, cooldownMs: 130, maxInstances: 1 });
                if (f.kind === "babayaga" && f.attackSequence % 6 === 0) playProductionCue(unitAudioCueFor(f.kind, "weapon", "reload"), f.x, { priority: 52, maxInstances: 1 });
                g.barricadeHitFlash = .2;
                g.barricadeHitY = f.y;
                g.damageTexts.push({ x: enemyBaseTarget.x, y: enemyBaseTarget.y - 14, value: `-${Math.round(structureDamage)}`, life: .7, color: "#ffd06b" });
                addParticles(g, enemyBaseTarget.x, enemyBaseTarget.y, "#e78b45", f.kind === "brute" ? 10 : 5);
                if (!roleEffect && ["ranger", "gunner", "medic", "babayaga", "engineer"].includes(f.kind)) {
                  g.shots.push({ x: f.x + 14, y: f.y - 32, tx: enemyBaseTarget.x, ty: enemyBaseTarget.y, life: .2, duration: .2, side: "human", style: "projectile", weapon: f.kind });
                }
                if (roleEffect) {
                  g.shots.push({ x: f.x + 14, y: f.y - 32, tx: enemyBaseTarget.x, ty: enemyBaseTarget.y, life: .26, duration: .26, side: "human", effect: roleEffect, emphasized: true, style: ["ranger", "gunner", "medic", "babayaga", "engineer"].includes(f.kind) ? "projectile" : "melee", weapon: f.kind });
                  if (!productionMixerRef.current && !["crazy-king", "kumaverson", "babayaga"].includes(f.kind)) {
                    playCue(`role-${roleEffect}` as SfxCueId);
                  }
                }
                if (!g.barricadeBucklingAnnounced && beforeHit > g.barricadeMaxHp * .7 && g.barricadeHp <= g.barricadeMaxHp * .7) {
                  g.barricadeBucklingAnnounced = true; g.banner = "感染拠点 // 損傷"; g.bannerTime = 1.5; playCue("base-damaged");
                }
                if (!g.barricadeCriticalAnnounced && beforeHit > g.barricadeMaxHp * .35 && g.barricadeHp <= g.barricadeMaxHp * .35) {
                  g.barricadeCriticalAnnounced = true; g.banner = "感染拠点 // 大破"; g.bannerTime = 1.7; g.flashOverlay = Math.max(g.flashOverlay, .12); playCue("base-critical");
                }
                if (!productionMixerRef.current) playCue(f.kind === "brute" ? "structure-heavy" : "structure-light");
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
              f.attack = .18; f.cooldown = enragedSiege ? 1 : f.attackEvery;
            }
          } else if (target && f.side === "human") {
            const dx = target.x - f.x;
            const stoppingDistance = Math.max(18, f.range + target.bodyRadius * .55);
            const desiredX = allyIntent?.destinationX ?? (target.x - Math.sign(dx || 1) * stoppingDistance);
            if (Math.abs(desiredX - f.x) > 2) {
              f.x += Math.sign(desiredX - f.x) * Math.min(Math.abs(desiredX - f.x), humanMovementSpeed * dt);
              f.x = Math.max(humanMinX, Math.min(BARRICADE_X, f.x));
            }
            const destinationLane = (f.range > 64
              ? f.anchorLane ?? f.lane
              : allyIntent?.destinationLane ?? f.anchorLane ?? f.lane) as Lane;
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
            f.x = advanceZombieX({ enemyX: f.x, speed: f.speed * Math.min(f.slowMultiplier ?? 1, f.suppressionMultiplier), seconds: dt, burning: false, targetFloor: zombieTargetFloor });
            const routeY = activeLaneCenters[f.anchorLane ?? f.lane];
            const dy = routeY - f.y;
            if (Math.abs(dy) > 2) f.y += Math.sign(dy) * Math.min(Math.abs(dy), f.laneSpeed * dt);
            f.y = Math.max(activeLaneCenters[0], Math.min(activeLaneCenters[2], f.y));
            f.lane = activeLaneForY(f.y, f.lane);
          } else {
            if (f.side === "human") {
              const desiredX = allyIntent?.destinationX ?? f.x;
              if (Math.abs(desiredX - f.x) > 2) {
                f.x += Math.sign(desiredX - f.x) * Math.min(Math.abs(desiredX - f.x), humanMovementSpeed * dt);
                f.x = Math.max(humanMinX, Math.min(BARRICADE_X, f.x));
              }
              const laneStep = advanceTowardLane({
                y: f.y,
                currentLane: f.lane,
                destinationLane: f.anchorLane ?? f.lane,
                laneCenters: activeLaneCenters,
                laneSpeed: humanLaneSpeed,
                seconds: dt,
                settleTolerance: 2,
                hysteresis: 5,
              });
              f.y = laneStep.y;
              f.lane = laneStep.lane as Lane;
            } else {
              f.x = advanceZombieX({ enemyX: f.x, speed: f.speed * Math.min(f.slowMultiplier ?? 1, f.suppressionMultiplier), seconds: dt, burning: false });
            }
            if (f.side === "zombie" && f.anchorLane !== null) {
              const dy = activeLaneCenters[f.anchorLane] - f.y;
              if (Math.abs(dy) > 2) f.y += Math.sign(dy) * Math.min(Math.abs(dy), f.laneSpeed * dt);
              f.y = Math.max(activeLaneCenters[0], Math.min(activeLaneCenters[2], f.y));
              f.lane = activeLaneForY(f.y, f.lane);
            }
          }

          if (f.side === "human" || f.side === "zombie") {
            for (const other of g.fighters) {
              if (other.side !== f.side || other.id >= f.id || other.hp <= 0 || !other.combatReady) continue;
              const dx = f.x - other.x; const dy = f.y - other.y; const separation = f.bodyRadius + other.bodyRadius;
              const gap = Math.hypot(dx, dy);
              if (gap >= separation || gap > 26) continue;
              const ux = gap > .1 ? dx / gap : (f.id % 2 ? 1 : -1) * .35;
              const uy = gap > .1 ? dy / gap : (f.id % 2 ? 1 : -1);
              const push = Math.min(2.2, (separation - gap) * (f.spawnGrace > 0 ? .2 : .08));
              if (f.side === "human") {
                f.x += ux * push; f.y += uy * push;
              } else {
                // Queue separation keeps the lead attacker fixed: followers fan out or yield away from the CRAWLER.
                const canFanOut = (uy < 0 && f.y > activeLaneCenters[0] + 3) || (uy > 0 && f.y < activeLaneCenters[2] - 3);
                if (canFanOut) f.y += uy * push * 1.25;
                else if (f.x >= other.x) f.x += push * .45;
              }
            }
            if (f.side === "human") f.x = Math.max(humanMinX, f.x);
            else if (zombieTargetFloor !== null) f.x = Math.max(zombieTargetFloor, f.x);
            f.y = Math.max(activeLaneCenters[0], Math.min(activeLaneCenters[2], f.y));
            f.lane = activeLaneForY(f.y, f.lane);
          }
        }

        const stageGeometry = stageGeometryFor(g.definition.stageId, activeStageViewportId);
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
            g.maxCombo = Math.max(g.maxCombo, g.combo);
            g.scrap += scrapReward(fighter.kind);
            g.supportGauge = Math.min(SUPPORT_GAUGE_MAX, g.supportGauge + supportGaugeReward(fighter.kind));
            if (fighter.kind === "takuya" && g.definition.bossUnlocksEnemyBase) {
              g.bossDefeatPending = true;
              g.barricadeVulnerable = true; g.banner = "TAKUYA撃破 — 感染拠点が露出"; g.bannerTime = 3.4; g.flashOverlay = .3;
              g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.takuyaDefeat);
              playCue("takuya-down");
              if (!emitBattleBark(g, "base-exposed", "crawler", "tactical")) emitBattleBark(g, "takuya-down", "crawler", "tactical");
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
        g.fighters = g.fighters.filter((fighter) => fighter.hp > 0);

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
            const data = enemyStats("turned", g.wave); const id = g.nextId++;
            revived.push({
              id, side: "zombie", kind: "turned", lane: generic.lane as Lane, anchorLane: generic.lane as Lane,
              x: generic.x, y: generic.y, hp: data.hp, maxHp: data.hp, speed: data.speed, damage: data.damage,
              range: data.range, cooldown: Math.max(.4, generic.riseLockRemaining), supportCooldown: 0, attackEvery: data.attackEvery,
              flash: 0, step: 0, attack: 0, knock: 0, variant: corpse.variant,
              targetId: null, targetObjectId: null, retargetIn: 0, nextLaneDecisionAt: g.time + .8, bodyRadius: bodyRadiusFor("turned"), laneSpeed: enemyLaneSpeedFor("turned"), spawnGrace: generic.riseLockRemaining,
               combatReady: true, gateEntering: false, gateEntrySpeed: 0, combatReadyX: 0, contained: false,
               marked: 0, stunned: 0, bleedRemaining: 0, bleedDamagePerSecond: 0, aiDestinationX: corpse.x, aiMoveDirection: 0, abilityCooldown: 0, abilityWindup: 0, attackSequence: 0,
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
        dispatchBattleStoryEvents(g);
        const bossActiveOrIncoming = g.fighters.some((fighter) => ["takuya", "gate-eater"].includes(fighter.kind)
            && fighter.hp > 0 && fighter.contained !== true)
          || g.enemySpawn.pending.some((entry) => ["takuya", "gate-eater"].includes(entry.kind));
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
        if (outcome) {
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
            stageId: g.definition.stageId,
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

      if (g.over && !g.resultPresented) {
        const collapseStep = advanceEnemyBaseCollapse({ barricadeHp: g.barricadeHp, elapsed: g.enemyBaseCollapse, seconds: dt, duration: ENEMY_BASE_COLLAPSE_SECONDS });
        g.enemyBaseCollapse = collapseStep.elapsed;
        if (collapseStep.complete) {
          g.resultPresented = true;
          setEnd({
            resultId: g.resultId,
            stageId: g.definition.stageId,
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
      if (g.bannerTime > 0 && g.running) {
        const compact = activeLaneCenters !== LANE_Y;
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
        const boss = g.fighters.find((fighter) => ["takuya", "gate-eater"].includes(fighter.kind)
          && fighter.hp > 0 && fighter.combatReady && fighter.contained !== true);
        const nearestEnemyX = g.fighters.reduce((nearest, fighter) => fighter.side === "zombie" && fighter.hp > 0 && fighter.combatReady ? Math.min(nearest, fighter.x) : nearest, Infinity);
        setHud({
          missionType: g.definition.missionType, energy: Math.floor(g.energy), supportGauge: Math.floor(g.supportGauge), scrap: g.scrap, kills: g.kills,
          wave: g.wave, phase: g.phase, baseHp: Math.max(0, g.baseHp), baseMaxHp: g.baseMaxHp,
          barricadeHp: Math.max(0, g.barricadeHp), barricadeMaxHp: g.barricadeMaxHp, barricadeVulnerable: g.barricadeVulnerable, barricadeHitFlash: g.barricadeHitFlash,
          deployQueue: g.deployQueue.length,
          airstrikePhase: g.airstrike.phase, crawlerPhase: g.crawlerAbility.phase, crawlerCharge: g.crawlerAbility.charge,
          combo: g.combo, bossHp: boss?.hp ?? 0, bossMax: boss?.maxHp ?? 0,
          takuyaEntranceAudioActive: g.takuyaEntranceAudioRemaining > 0,
          crawlerHitFlash: g.crawlerHitFlash, threat: crawlerThreatLevel(nearestEnemyX),
          objective: objectiveForBattle(g.definition, g), deployCooldowns: { ...g.deployCooldowns },
          battleBarks: g.paused ? [] : [...g.battleBarks.active],
        });
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [chooseAction, dispatchBattleStoryEvents, playCue, playEndJingle, playProductionCue, qaScenario, resumeBattleAudioLoops, stopMusic, stopSfx, syncMusicMode]);

  const healthPct = Math.max(0, hud.baseHp / hud.baseMaxHp * 100);
  const barricadePct = Math.max(0, hud.barricadeHp / hud.barricadeMaxHp * 100);
  const barricadeCondition = barricadeState(hud.barricadeHp) === "BREACHED" ? "破壊" : barricadeState(hud.barricadeHp) === "BREACH IMMINENT" ? "大破" : barricadeState(hud.barricadeHp) === "BUCKLING" ? "損傷" : "健全";
  const bossPct = hud.bossMax ? Math.max(0, hud.bossHp / hud.bossMax * 100) : 0;
  const bossPhase = bossPhaseForHp(hud.bossHp, hud.bossMax);
  const isStationPlatformAssault = selectedStageId === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM && hud.missionType === "assault";
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
  const enemyBaseLabel = selectedStageId === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE ? "感染中継点" : "感染拠点";
  const bossLabel = selectedStageId === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_TUNNEL ? "改札喰い" : "TAKUYA";
  const selectedName = selectedAction?.startsWith("supply:")
    ? SUPPORT_DISPLAY_NAMES[selectedAction.slice("supply:".length) as SupplyKind]
    : selectedAction === "airstrike" ? "航空支援" : null;
  const combatLocked = !!end || hud.baseHp <= 0 || hud.barricadeHp <= 0;
  const audioUnlockLabel = audioUnlockUi === "pending" ? "音声を準備中…" : audioUnlockUi === "success" ? "音声が有効になりました" : audioUnlockUi === "failed" ? "音声を開始できませんでした　もう一度試す" : "音声を有効にする";
  const audioUnlockShortLabel = audioUnlockUi === "pending" ? "準備中" : audioUnlockUi === "success" ? "音声OK" : audioUnlockUi === "failed" ? "音声再試行" : "音声開始";

  return (
    <main className="game-shell" data-screen={screen} data-stage-id={selectedStageId}>
      <section className="game-frame" style={{ "--battlefield-art": `url('${stageVisualFor(selectedStageId)}')` } as CSSProperties} aria-label="西新世紀末物語 ゲーム">
        <canvas ref={canvasRef} width={W} height={H} className={`battlefield ${selectedAction ? "targeting" : ""} ${screen === "battle" ? "active" : "inactive"}`} aria-label="3レーン戦場" aria-hidden={screen !== "battle"} onPointerMove={handleBattlefieldPointerMove} onPointerDown={handleBattlefieldPointerDown} onPointerUp={handleBattlefieldPointerUp} onPointerCancel={handleBattlefieldPointerCancel} />
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
        {hud.battleBarks.length > 0 && <div className="battle-barks" aria-live="polite" aria-label="戦闘台詞">{hud.battleBarks.map((bark) => <p key={bark.id} data-tone={bark.tone}><b>{bark.speaker}</b><span>{bark.text}</span></p>)}</div>}

        <div className="top-hud">
          <div className="brand-block"><span className="brand-mark">移</span><div><b>移動拠点</b><small>{selectedStageView.displayName} <em>Version 0.7.1</em></small></div></div>
          <div className="phase-block"><small>第{hud.phase}段階</small><strong>{phaseName}</strong><em>第{hud.wave}波</em></div>
          <button className="icon-btn" onClick={togglePause} aria-label={paused ? "再開" : "一時停止"}>{paused ? "▶" : "Ⅱ"}</button>
          <button className={`icon-btn audio-btn ${musicActive ? "playing" : ""}`} data-playing={musicActive} data-muted={bgmMuted} disabled={Boolean(end || pendingResultCommit)} onClick={toggleBgm} aria-label={bgmMuted ? "音楽を再生" : "音楽をミュート"}><b>{bgmMuted ? "×" : "♫"}</b><small>音楽</small></button>
          <button className="icon-btn audio-btn" data-muted={sfxMuted} disabled={Boolean(end || pendingResultCommit)} onClick={toggleSfx} aria-label={sfxMuted ? "効果音を再生" : "効果音をミュート"}><b>{sfxMuted ? "×" : "効"}</b><small>効果音</small></button>
        </div>

        <div className={`health-hud crawler-health ${healthPct <= 25 ? "critical" : ""} ${hud.crawlerHitFlash > 0 ? "hit" : ""}`}><div><span>移動拠点</span><b>{Math.ceil(hud.baseHp)} / {hud.baseMaxHp}</b></div><i><em style={{ width: `${healthPct}%` }} /></i></div>
        {stationMissionHud
          ? <div className="health-hud barrier-health mission-health"><div><span>作戦目標</span><b>{hud.objective}</b></div></div>
          : <div className={`health-hud barrier-health ${hud.barricadeVulnerable ? "vulnerable" : "reinforced"} ${hud.barricadeHitFlash > 0 ? "hit" : ""}`}><div><span>{hud.missionType === "timed-defense" ? "救援区域" : enemyBaseLabel}</span><b>{hud.missionType === "timed-defense" ? "防衛対象外" : hud.barricadeVulnerable ? `${Math.ceil(hud.barricadeHp)} / ${hud.barricadeMaxHp}` : "防護中"}</b></div><i><em style={{ width: `${barricadePct}%` }} /></i>{hud.barricadeVulnerable && <small>{barricadeCondition}</small>}</div>}
        {hud.bossMax > 0 && <div className="boss-hud"><div><span>{bossLabel}{" // "}{bossPhase.label}</span><b>{Math.ceil(hud.bossHp)} / {hud.bossMax}</b></div><i><em style={{ width: `${bossPct}%` }} /></i></div>}
        {started && !end && hud.threat > .55 && <div className={`crawler-alert ${hud.threat > .82 ? "imminent" : ""}`}><b>移動拠点 脅威</b><span>{hud.threat > .82 ? "接触寸前" : "接近中"}</span></div>}

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
                const portraitArt = (PORTRAIT_ART as Record<string, string | undefined>)[card.kind];
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
                <span className="support-key">G</span><b>{hud.crawlerPhase === "ready" ? "一斉掃射" : `装填 ${Math.round(hud.crawlerCharge * 100)}%`}</b><small>全3レーン固定火器</small><em>⌁</em>
              </button>
            </div>
          </div>
        </div>

        <div className="stats-strip"><span>☠ 撃破 {hud.kills}</span><span>▰ スクラップ {hud.scrap}</span><span className="bay-status">格納庫 {hud.deployQueue}/3</span>{hud.combo > 1 && <span className="combo">×{hud.combo} 連続</span>}<span className="objective">目標：{hud.objective}</span></div>
        {paused && started && !end && <div className="pause-screen" role="dialog" aria-modal="true" aria-label="一時停止メニュー"><div className="pause-panel">
          <small>作戦一時停止</small><h2>一時停止</h2>
          <div className="pause-actions">
            <button className="primary" onClick={togglePause}>作戦を再開</button>
            <button onClick={() => requestPauseAction("restart")}>ステージを最初からやり直す</button>
            <button onClick={() => requestPauseAction("loadout")}>編成画面へ戻る</button>
            <button className="danger" onClick={() => requestPauseAction("withdraw")}>エリアマップへ撤退</button>
          </div>
          <section className="pause-volume" aria-label="音量設定"><h3>音量設定</h3>
            <label><span>BGM <b>{Math.round(campaignSave.settings.bgmVolume * 100)}%</b></span><input type="range" min="0" max="1" step="0.05" value={campaignSave.settings.bgmVolume} disabled={Boolean(end || pendingResultCommit)} onChange={(event) => updateVolume("bgm", Number(event.currentTarget.value))} /></label>
            <label><span>効果音 <b>{Math.round(campaignSave.settings.sfxVolume * 100)}%</b></span><input type="range" min="0" max="1" step="0.05" value={campaignSave.settings.sfxVolume} disabled={Boolean(end || pendingResultCommit)} onChange={(event) => updateVolume("sfx", Number(event.currentTarget.value))} /></label>
            <div><button disabled={Boolean(end || pendingResultCommit)} onClick={toggleBgm}>{bgmMuted ? "BGMを有効にする" : "BGMをミュート"}</button><button disabled={Boolean(end || pendingResultCommit)} onClick={toggleSfx}>{sfxMuted ? "効果音を有効にする" : "効果音をミュート"}</button><button className="audio-test-tone" data-audio-unlock-control="true" onClick={playAudioTestTone} disabled={Boolean(end || pendingResultCommit)}>テスト音を鳴らす</button></div>
            <p className="audio-troubleshooting">成功表示でも聞こえない場合は、端末音量とブラウザのタブミュートを確認してください。</p>
          </section>
          <section className="pause-story" aria-label="戦闘中の会話設定"><span><b>戦闘中の会話</b><small>既読イベントの再表示方法</small></span><button onClick={cycleBattleEventMode}>{campaignSave.settings.battleEventMode === "first-time" ? "初回のみ" : campaignSave.settings.battleEventMode === "compact" ? "通信を簡略表示" : "毎回すべて表示"}</button></section>
          {pauseConfirm && <div className="pause-confirm" role="alertdialog" aria-modal="true"><div><h3>{pauseConfirm === "restart" ? "ステージをやり直しますか？" : pauseConfirm === "loadout" ? "編成画面へ戻りますか？" : "作戦から撤退しますか？"}</h3><p>現在の戦闘状態は破棄されます。星・報酬・解放は発生しません。</p><span><button onClick={cancelPauseAction}>キャンセル</button><button className="danger" onClick={confirmPauseAction}>実行する</button></span></div></div>}
        </div></div>}
        </>}
        {qaMode === "barks" ? <BattleBarkAuditScreen /> : qaMode === "sprites" ? <SpriteAuditScreen /> : <CampaignScreens
          screen={screen}
          eventId={eventId}
          stages={stageViews}
          selectedStage={selectedStageView}
          units={unitViews}
          formationUnitIds={formationUnitIds}
          formationPresets={campaignSave.formationPresets.map((preset) => ({ id: preset.id, name: preset.displayName, unitIds: preset.unitIds }))}
          selectedFormationPresetId={campaignSave.selectedFormationPresetId}
          supplies={supplyViews}
          selectedSupply={selectedSupply}
          supplyCurrency={campaignSave.caps}
          caps={campaignSave.caps}
          result={campaignResult}
          assetsReady={assetsReady}
          assetError={assetError}
          hasCampaignSave={campaignSave.campaignStarted}
          saveRecoveryRequired={saveRecovery !== null}
          saveRecoveryReason={saveRecovery?.recoveryReason ?? ""}
          saveRecoveryCandidateSources={(saveRecovery?.candidates ?? []).filter((candidate) => candidate.valid === true).map((candidate) => candidate.source)}
          saveRecoveryCanExport={Boolean(saveRecovery && (saveRecovery.corruptCandidates.length > 0 || saveRecovery.candidates.length > 0))}
          saveMutationPending={saveMutationPending}
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
          onOpenLoadout={openLoadout}
          onReturnToMap={returnToMap}
          onSelectFormationPreset={selectFormation}
          onToggleFormation={toggleFormation}
          onRecruitUnit={recruitUnit}
          onSelectSupply={(kind) => setSelectedSupply(kind as SupplyKind)}
          onStartBattle={requestBattle}
          onRetry={retryBattle}
          onContinueResult={continueResult}
          onResetSave={resetCampaign}
          onReloadAssets={() => window.location.reload()}
        />}
      </section>
      {pendingResultCommit && <div className="result-save-blocker" role="alertdialog" aria-modal="true" aria-label="作戦結果の保存失敗">
        <section><small>SAVE REQUIRED</small><h2>作戦結果を保存できません</h2><p>報酬や加入の二重適用を防ぐため、結果画面へ進まず停止しています。保存を再試行するか、結果を含むバックアップを書き出してください。</p><div><button disabled={resultSaveRetrying} onClick={retryPendingResultSave}>{resultSaveRetrying ? "保存を再試行中" : "保存を再試行"}</button><button disabled={resultSaveRetrying} onClick={exportPendingResultSave}>結果バックアップを書き出す</button></div></section>
      </div>}
      {savePersistence === "unavailable" && <div className="save-persistence-warning" role="alert">
        <b>セーブを端末へ保存できません</b>
        <span>進行すると再読み込み後に失われるため、Safariの通常タブで開き直してください。</span>
      </div>}
      <div className="rotate-notice"><span>↻</span><b>スマホを横向きにしてください</b><small>この作戦は横画面に最適化されています</small></div>
    </main>
  );
}
