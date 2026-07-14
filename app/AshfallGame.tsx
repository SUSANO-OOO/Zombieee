"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { advanceBattleBarkRuntime, createBattleBarkRuntime, queueBattleBark } from "./battleBarks.js";
import { createAudioMixer } from "./audioMixer.js";
import { CampaignScreens, type CampaignResultView, type CampaignScreen, type StageScreenView, type SupplyScreenView, type UnitScreenView } from "./CampaignScreens";
import {
  CAMPAIGN_STAGE_BY_ID,
  CAMPAIGN_STAGE_IDS,
  CAMPAIGN_STAGES,
  CAMPAIGN_UNITS,
  INITIAL_STAGE_ID,
  STAGE_VISUAL_SIGNATURES,
  createDefaultCampaignSave,
  deserializeCampaignSave,
  isStageUnlocked,
  isUnitUnlocked,
  markCampaignStarted,
  resolveStageResult,
  selectCampaignStage,
  serializeCampaignSave,
} from "./campaign.js";
import { battleOutcomeFor, createBattleDefinition, objectiveForBattle, phaseBannerForBattle, phaseForBattle } from "./battleDefinitions.js";
import {
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
import {
  LEGACY_SFX_CUE_MAP,
  PRODUCTION_AUDIO_MANIFEST,
  enemyVoiceCue,
  humanVoiceCueForUnit,
  sceneIdForScreen,
  weaponCueForUnit,
} from "./productionAudio.js";
import {
  AIRSTRIKE_DEF,
  BARRICADE_MAX_HP,
  BATTLEFIELD_SUPPLY_DEFS,
  CAMERA_SHAKE_EVENTS,
  COMMAND_MAX,
  ENEMY_GATE_SPAWN,
  ENEMY_BASE_COLLAPSE_SECONDS,
  LANE_Y,
  MISSION_EVENTS,
  PREP_SECONDS,
  RENDER_ARRAY_LIMITS,
  SUPPORT_GAUGE_MAX,
  TACTIC_MODES,
  UNIT_CARDS,
  WORLD_GEOMETRY,
  advanceAreaEffects,
  advanceBattlefieldSupply,
  advanceCameraShakeRuntime,
  advanceCrawlerAbilityRuntime,
  advanceEmergencySupportRuntime,
  advanceEnemyBaseCollapse,
  advanceEnemySpawnRuntime,
  advanceZombieX,
  advanceLimitFor,
  advanceCommand,
  applyBattlefieldSupplyDamage,
  airstrikeObserverPose,
  autonomousTargetScore,
  barricadeState,
  battlefieldSupplyPlacementCheck,
  cameraShakeAmplitude,
  canDeploy,
  capRenderArray,
  createCameraShakeRuntime,
  createCrawlerAbilityRuntime,
  createEmergencySupportRuntime,
  createEnemySpawnRuntime,
  crawlerSiegeDamage,
  crawlerThreatLevel,
  enemyCanTargetBattlefieldSupply,
  enemyBaseVisualState,
  enqueueEnemyWave,
  humanAttackMultiplier,
  interceptorTargetScore,
  isCrawlerRouteBlocker,
  keyboardInputGate,
  laneCentersForViewport,
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
  roleEffectForAction,
  roleTargetBias,
  scrapReward,
  selectBlockingContainer,
  selectAreaEffectsForRender,
  structureDamageMultiplier,
  supportGaugeReward,
  tacticTargetBias,
  triggerCameraShake,
} from "./gameRules.js";

const W = 960;
const H = 540;

type Lane = 0 | 1 | 2;
type UnitKind = "scout" | "ranger" | "brute" | "brawler" | "gunner" | "medic";
type EnemyKind = "walker" | "runner" | "spitter" | "crusher" | "shade" | "abomination" | "takuya" | "turned";
type SupplyKind = "pod" | "drum" | "medical";
type MusicMode = "normal" | "danger" | "boss";
type TacticMode = "defend" | "balanced" | "assault";
type QaMode = "endgame" | "roles" | "supplies" | "airstrike" | "crawler" | "loadout" | "dialogue" | "stress" | "lifecycle";
type SelectedAction = `supply:${SupplyKind}` | "airstrike" | null;
type EventDestination = "map" | "battle" | "result";

const BASE_X = WORLD_GEOMETRY.baseX;
const BARRICADE_X = WORLD_GEOMETRY.barricade.attackX;
const MUSTER_X = WORLD_GEOMETRY.musterX;
const MUSTER_LANE = 2 as Lane;
type LaneCenters = readonly [number, number, number];
let activeLaneCenters = LANE_Y as unknown as LaneCenters;

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
  missionType: "assault" | "timed-defense" | "boss-assault";
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
};
type CampaignSave = {
  schemaVersion: number;
  campaignStarted: boolean;
  processedResultIds: string[];
  completedStageIds: string[];
  bestStarsByStage: Record<string, number>;
  claimedStarRewardsByStage: Record<string, number[]>;
  supplies: number;
  unlockedStageIds: string[];
  unlockedUnitIds: string[];
  lastSelectedStageId: string;
  settings: {
    bgmEnabled: boolean; sfxEnabled: boolean; bgmVolume: number; sfxVolume: number; reducedMotion: boolean;
  };
};
type CampaignStageData = {
  id: string; displayName: string; objective: string; missionType: "assault" | "timed-defense" | "boss-assault";
  baseReward: number; firstTimeStarRewards: Record<number, number>; mapPosition: { x: number; y: number };
};
type CampaignUnitData = {
  id: string; combatKind: UnitKind; displayName: string; roleName: string; description: string;
  roleIcon: string; weaponName: string; attackMode: string; rangeBand: string; primaryTarget: string; deploymentHint: string;
  unlock: { type: "initial" } | { type: "stage-clear"; stageId: string };
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
  placementClearance: number; blocksEnemies: boolean;
}>;

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
  bodyRadius: number;
  laneSpeed: number;
  spawnGrace: number;
  combatReady: boolean;
  gateEntering: boolean;
  gateEntrySpeed: number;
  combatReadyX: number;
  marked: number;
  abilityCooldown: number;
  abilityWindup: number;
  burning?: boolean;
  slowMultiplier?: number;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
type RoleEffect = "scout" | "ranger" | "brute" | "brawler" | "gunner" | "medic";
type Shot = { x: number; y: number; tx: number; ty: number; life: number; side: "human" | "zombie"; effect?: RoleEffect; emphasized?: boolean; duration?: number; style?: "projectile" | "melee" };
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
type PlacementIndicator = { lane: Lane; x: number; y: number; valid: boolean; reason: string };

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
  nextAreaEffectId: number;
  airstrike: AirstrikeRuntime;
  crawlerAbility: CrawlerRuntime;
  placementIndicator: PlacementIndicator | null;
  deployCooldowns: Record<UnitKind, number>;
  deployQueue: UnitKind[];
  deployTimer: number;
  tactic: TacticMode;
  nextId: number;
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
  battleBarks: BattleBarkRuntime;
  qaBarks: boolean;
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
  tactic: TacticMode;
  deployQueue: number;
  airstrikePhase: AirstrikeRuntime["phase"];
  crawlerPhase: CrawlerRuntime["phase"];
  crawlerCharge: number;
  combo: number;
  bossHp: number;
  bossMax: number;
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
};

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

const MAX_SFX_VOICES = 10;
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
  "tactic-defend": { category: "ui", frequency: 130, duration: .06, type: "square", volume: .055, cooldown: .08, priority: 15 },
  "tactic-balanced": { category: "ui", frequency: 190, duration: .06, type: "square", volume: .055, cooldown: .08, priority: 15 },
  "tactic-assault": { category: "ui", frequency: 250, duration: .06, type: "square", volume: .055, cooldown: .08, priority: 15 },
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

let battleReceiptSequence = 0;
function createBattleResultId(stageId: string) {
  battleReceiptSequence += 1;
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${battleReceiptSequence}`;
  return `${stageId}:${randomId}`;
}

const initialGame = (
  selectedSupply: SupplyKind = "pod",
  stageId = CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE,
  formationKinds: UnitKind[] = cards.map((card) => card.kind),
): Game => {
  const definition = createBattleDefinition(stageId) as BattleDefinition;
  return ({
  definition,
  resultId: createBattleResultId(stageId),
  formationKinds: [...formationKinds],
  running: false,
  paused: false,
  over: false,
  won: false,
  time: 0,
  last: 0,
  energy: 70,
  supportGauge: 0,
  scrap: 0,
  kills: 0,
  wave: 1,
  phase: 1,
  eventIndex: 0,
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
  nextAreaEffectId: 1,
  airstrike: createEmergencySupportRuntime() as AirstrikeRuntime,
  crawlerAbility: createCrawlerAbilityRuntime() as CrawlerRuntime,
  placementIndicator: null,
  deployCooldowns: emptyCooldowns(),
  deployQueue: [],
  deployTimer: 0,
  tactic: "balanced",
  nextId: 1,
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
  battleBarks: createBattleBarkRuntime(),
  qaBarks: false,
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

function bodyRadiusFor(kind: string) {
  if (kind === "takuya" || kind === "abomination") return 20;
  if (kind === "crusher" || kind === "brute") return 16;
  return 11;
}

function enemyLaneSpeedFor(kind: string) {
  if (kind === "runner" || kind === "shade") return 64;
  if (kind === "spitter") return 42;
  if (kind === "walker" || kind === "turned") return 38;
  if (kind === "takuya") return 32;
  if (kind === "crusher") return 24;
  return 18;
}

function enemyStats(kind: string, wave: number) {
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
    bodyRadius: bodyRadiusFor(kind),
    laneSpeed: enemyLaneSpeedFor(kind),
    spawnGrace: 0,
    combatReady: !gateEntering,
    gateEntering,
    gateEntrySpeed: gateEntry?.entrySpeed ?? 0,
    combatReadyX: gateEntry?.combatReadyX ?? 0,
    marked: 0,
    abilityCooldown: kind === "takuya" ? 4.2 : 0,
    abilityWindup: 0,
  });
  return g.fighters[g.fighters.length - 1];
}

function spawnHuman(g: Game, kind: UnitKind) {
  const card = cards.find((item) => item.kind === kind);
  if (!card) return null;
  const id = g.nextId++;
  const laneSpeed = kind === "scout" ? 78 : kind === "brawler" ? 68 : kind === "brute" ? 42 : kind === "gunner" ? 54 : 60;
  g.fighters.push({
    id, side: "human", kind, lane: MUSTER_LANE, anchorLane: null, x: MUSTER_X, y: activeMusterY(), hp: card.hp, maxHp: card.hp,
    speed: card.speed, damage: card.damage, range: card.range, cooldown: 0, supportCooldown: 0,
    attackEvery: card.attackEvery, flash: 0, step: Math.random() * 4, attack: 0, knock: 0, variant: id % 3,
    targetId: null, targetObjectId: null, retargetIn: 0, bodyRadius: bodyRadiusFor(kind), laneSpeed, spawnGrace: .95,
    combatReady: true, gateEntering: false, gateEntrySpeed: 0, combatReadyX: 0,
    marked: 0, abilityCooldown: 0, abilityWindup: 0,
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
  g.tactic = "assault";

  const lineup: [UnitKind, Lane, number][] = [
    ["brute", 0, 730],
    ["gunner", 1, 690],
    ["brawler", 2, 730],
  ];
  for (const [kind, lane, x] of lineup) {
    spawnHuman(g, kind);
    const fighter = g.fighters[g.fighters.length - 1];
    fighter.lane = lane;
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

function prepareRolesQa(g: Game) {
  g.time = 60;
  g.phase = 2;
  g.wave = 4;
  g.eventIndex = missionEvents.length;
  g.baseHp = 520;
  g.barricadeHp = BARRICADE_MAX_HP;
  g.energy = COMMAND_MAX;
  g.scrap = 100;
  g.tactic = "balanced";

  const lineup: [UnitKind, Lane, number][] = [
    ["scout", 0, 400], ["ranger", 1, 400], ["brute", 2, 500],
    ["brawler", 0, 610], ["gunner", 1, 630], ["medic", 2, 580],
  ];
  for (const [kind, lane, x] of lineup) {
    spawnHuman(g, kind);
    const fighter = g.fighters[g.fighters.length - 1];
    fighter.lane = lane; fighter.x = x; fighter.y = laneY(lane, fighter.id);
    fighter.cooldown = 0; fighter.spawnGrace = 0;
    if (kind === "brute") fighter.hp -= 40;
  }

  const scenarios: [EnemyKind, Lane, number, number?][] = [
    ["runner", 0, 450], ["walker", 0, 640, .3], ["spitter", 1, 535],
    ["crusher", 1, 720], ["walker", 2, 535],
  ];
  for (const [kind, lane, x, hpRatio] of scenarios) {
    const fighter = spawnEnemy(g, kind, lane);
    fighter.x = x; fighter.y = laneY(lane, fighter.id); fighter.cooldown = 1.2;
    if (hpRatio) fighter.hp = fighter.maxHp * hpRatio;
  }
  const breaker = g.fighters.find((fighter) => fighter.side === "human" && fighter.kind === "brute");
  const heldEnemy = g.fighters.find((fighter) => fighter.side === "zombie" && fighter.kind === "walker" && fighter.lane === 2);
  if (breaker && heldEnemy) heldEnemy.targetId = breaker.id;
  g.banner = "QA ROLES // SIX UNIT LIVE FIRE";
  g.bannerTime = 2.2;
}

function emitBattleBark(g: Game, trigger: string, speakerKind: string, speakerId?: number | string) {
  const result = queueBattleBark({ runtime: g.battleBarks, event: { trigger, speakerKind, speakerId }, qa: g.qaBarks });
  g.battleBarks = result.runtime as BattleBarkRuntime;
  return result.shown;
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
  const ally = g.fighters[g.fighters.length - 1]; ally.lane = 2; ally.x = 610; ally.y = laneY(2, ally.id); ally.hp = Math.round(ally.maxHp * .45); ally.spawnGrace = 0;
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
  const unitKinds: UnitKind[] = ["scout", "ranger", "brute", "brawler", "gunner", "medic"];
  for (let index = 0; index < 18; index++) {
    spawnHuman(g, unitKinds[index % unitKinds.length]);
    const fighter = g.fighters[g.fighters.length - 1];
    fighter.lane = (index % 3) as Lane; fighter.x = 300 + (index % 6) * 55; fighter.y = laneY(fighter.lane, fighter.id); fighter.spawnGrace = 0;
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
  g.banner = "QA 表現確認 // 死亡・感染・焼却"; g.bannerTime = 3;
}

function prepareQaMode(g: Game, qaMode: QaMode | null) {
  g.qaBarks = qaMode !== null && qaMode !== "loadout";
  if (qaMode === "roles" || qaMode === "dialogue") prepareRolesQa(g);
  else if (qaMode === "endgame") prepareEndgameQa(g);
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

function drawSpriteFighter(ctx: CanvasRenderingContext2D, f: Fighter, sprites: SpriteMap) {
  const enemySheet = f.kind === "takuya" ? "takuya" : f.kind === "shade" ? "shade" : f.kind === "crusher" || f.kind === "abomination" ? "crusher" : f.kind === "spitter" ? "spitter" : "infected";
  const sprite = sprites[f.side === "human" ? f.kind : enemySheet] ?? (f.side === "zombie" ? sprites.infected : undefined);
  if (!sprite?.complete || !sprite.naturalWidth) return;
  const frameWidth = sprite.naturalWidth / 6;
  const frame = f.flash > 0 ? 5 : f.attack > .09 ? 4 : f.attack > 0 ? 3 : 1 + (Math.floor(f.step * (f.kind === "runner" ? 8 : 5)) % 2);
  const sizes: Record<string, { w: number; h: number }> = {
    scout: { w: 58, h: 98 }, ranger: { w: 58, h: 98 }, brute: { w: 72, h: 108 },
    brawler: { w: 62, h: 99 }, gunner: { w: 60, h: 100 }, medic: { w: 60, h: 100 },
    walker: { w: 58, h: 96 }, runner: { w: 53, h: 90 }, turned: { w: 58, h: 96 },
    shade: { w: 64, h: 101 }, spitter: { w: 62, h: 101 }, crusher: { w: 80, h: 112 },
    abomination: { w: 101, h: 132 }, takuya: { w: 94, h: 128 },
  };
  const size = sizes[f.kind] ?? { w: 58, h: 96 };
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
  }
  ctx.drawImage(sprite, frame * frameWidth, 0, frameWidth, sprite.naturalHeight, f.x - size.w / 2, f.y - size.h + 24 - bob, size.w, size.h);
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
  ctx.save();
  ctx.translate(indicator.x, indicator.y);
  ctx.strokeStyle = indicator.valid ? "#71d8aa" : "#ef6448";
  ctx.fillStyle = indicator.valid ? "rgba(74,180,135,.18)" : "rgba(221,73,52,.2)";
  ctx.lineWidth = 3; ctx.setLineDash([8, 5]);
  ctx.beginPath(); ctx.ellipse(0, 4, 43, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = .68;
  ctx.fillRect(-31, -35, 62, 38);
  ctx.globalAlpha = 1; ctx.fillStyle = indicator.valid ? "#a7f0cf" : "#ff9a82";
  ctx.font = "900 12px monospace"; ctx.textAlign = "center";
  ctx.fillText(indicator.reason, 0, -47);
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

function drawEnemyBase(ctx: CanvasRenderingContext2D, g: Game, enemyBaseSprite: HTMLImageElement | null) {
  const barrier = WORLD_GEOMETRY.enemyBase;
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
  if (enemyBaseSprite?.complete && enemyBaseSprite.naturalWidth && collapse < 1) {
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
    ctx.drawImage(enemyBaseSprite, barrier.drawX, barrier.drawY, barrier.width, barrier.height);
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
    const glow = ctx.createRadialGradient(barrier.drawX + 10, g.barricadeHitY - 18, 4, barrier.drawX + 10, g.barricadeHitY - 18, 52);
    glow.addColorStop(0, `rgba(255,213,108,${Math.min(.75, g.barricadeHitFlash * 3)})`);
    glow.addColorStop(1, "rgba(218,67,32,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.fillRect(barrier.drawX - 48, g.barricadeHitY - 76, 110, 116);
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
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let lane = 0; lane < 3; lane++) {
    const y = activeLaneCenters[lane];
    for (let i = 0; i < 5; i++) {
      const phase = (g.time * 520 + i * 137 + lane * 43) % 620;
      const x = WORLD_GEOMETRY.crawler.weaponX + 40 + phase;
      ctx.strokeStyle = i % 2 ? "rgba(255,206,92,.75)" : "rgba(255,245,190,.9)";
      ctx.lineWidth = i % 2 ? 2 : 3;
      ctx.beginPath(); ctx.moveTo(x - 54, y - 24 + (i - 2) * 3); ctx.lineTo(x, y - 24 + (i - 2) * 3); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawStageEnvironment(ctx: CanvasRenderingContext2D, g: Game) {
  const signature = STAGE_VISUAL_SIGNATURES[g.definition.stageId as keyof typeof STAGE_VISUAL_SIGNATURES];
  if (!signature) return;
  ctx.save();
  if (signature.kind === "shopping-arcade") {
    const canopy = ctx.createLinearGradient(0, 72, 0, 188);
    canopy.addColorStop(0, "rgba(104,38,31,.82)");
    canopy.addColorStop(1, "rgba(31,26,23,.18)");
    ctx.fillStyle = canopy; ctx.fillRect(0, 62, W, 126);
    for (let index = 0; index < 8; index++) {
      const x = index * 122 - 18;
      ctx.fillStyle = index % 2 ? "rgba(176,126,66,.35)" : "rgba(82,103,93,.38)";
      ctx.fillRect(x, 92, 100, 74);
      ctx.strokeStyle = "rgba(231,205,159,.2)"; ctx.strokeRect(x + .5, 92.5, 99, 73);
      ctx.fillStyle = "rgba(241,218,170,.72)"; ctx.font = "bold 13px sans-serif";
      ctx.fillText(["西新", "惣菜", "青果", "書店"][index % 4], x + 12, 120);
    }
    ctx.fillStyle = "rgba(34,25,23,.64)"; ctx.fillRect(0, 166, W, 15);
    ctx.fillStyle = "rgba(238,198,122,.7)"; ctx.font = "bold 17px sans-serif"; ctx.fillText("西新商店街", 392, 84);

    // A stranded delivery van and a fallen bicycle keep the location legible
    // below the mobile top HUD instead of relying on the arcade sign alone.
    ctx.save(); ctx.translate(278, 222); ctx.rotate(-.035);
    ctx.fillStyle = "rgba(95,86,65,.92)"; ctx.fillRect(-70, -31, 140, 54);
    ctx.fillStyle = "rgba(48,58,58,.9)"; ctx.fillRect(-50, -22, 38, 21); ctx.fillRect(-5, -22, 35, 21);
    ctx.fillStyle = "rgba(137,57,42,.82)"; ctx.fillRect(36, -30, 34, 53);
    ctx.strokeStyle = "rgba(219,182,118,.48)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(43, -17); ctx.lineTo(62, 10); ctx.moveTo(62, -17); ctx.lineTo(43, 10); ctx.stroke();
    ctx.fillStyle = "#171919"; ctx.beginPath(); ctx.arc(-43, 25, 12, 0, Math.PI * 2); ctx.arc(44, 25, 12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "rgba(79,72,59,.9)"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(592, 298, 22, 0, Math.PI * 2); ctx.arc(650, 298, 22, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(592, 298); ctx.lineTo(619, 270); ctx.lineTo(650, 298); ctx.lineTo(610, 297); ctx.lineTo(628, 281); ctx.moveTo(619, 270); ctx.lineTo(639, 263); ctx.stroke();

    for (const [x, y, radius] of [[476, 382, 48], [735, 333, 34]] as const) {
      const scar = ctx.createRadialGradient(x, y, 4, x, y, radius);
      scar.addColorStop(0, "rgba(21,15,13,.72)"); scar.addColorStop(.55, "rgba(52,28,21,.42)"); scar.addColorStop(1, "rgba(34,21,18,0)");
      ctx.fillStyle = scar; ctx.fillRect(x - radius, y - radius / 2, radius * 2, radius);
    }
    ctx.save(); ctx.translate(747, 181); ctx.rotate(.15);
    ctx.fillStyle = "rgba(115,46,36,.9)"; ctx.fillRect(-46, -22, 92, 42);
    ctx.strokeStyle = "rgba(237,188,111,.62)"; ctx.lineWidth = 3; ctx.strokeRect(-44, -20, 88, 38);
    ctx.beginPath(); ctx.moveTo(-31, -13); ctx.lineTo(31, 12); ctx.moveTo(27, -15); ctx.lineTo(-18, 15); ctx.stroke();
    ctx.restore();
    for (let index = 0; index < 4; index++) {
      const x = 206 + index * 180;
      ctx.strokeStyle = "rgba(58,50,42,.72)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 62); ctx.lineTo(x, 142 + (index % 2) * 10); ctx.stroke();
      const glow = ctx.createRadialGradient(x, 148, 2, x, 148, 34);
      glow.addColorStop(0, index === 2 ? "rgba(255,121,71,.18)" : "rgba(248,197,108,.28)"); glow.addColorStop(1, "rgba(238,151,76,0)");
      ctx.fillStyle = glow; ctx.fillRect(x - 34, 114, 68, 68);
    }
  } else if (signature.kind === "evacuation-civic-center") {
    ctx.fillStyle = "rgba(58,72,76,.72)"; ctx.fillRect(0, 58, W, 126);
    for (let x = 24; x < W; x += 92) {
      ctx.fillStyle = "rgba(168,195,197,.18)"; ctx.fillRect(x, 78, 58, 72);
      ctx.strokeStyle = "rgba(200,220,218,.18)"; ctx.strokeRect(x + .5, 78.5, 57, 71);
    }
    ctx.fillStyle = "rgba(222,226,207,.78)"; ctx.font = "bold 16px sans-serif"; ctx.fillText("早良区役所　救援撤収区域", 342, 82);
    ctx.fillStyle = "rgba(217,217,199,.88)"; ctx.fillRect(806, 286, 124, 46);
    ctx.fillStyle = "rgba(196,132,48,.92)"; ctx.fillRect(818, 298, 54, 8);
    ctx.fillStyle = "rgba(32,39,42,.95)"; ctx.beginPath(); ctx.arc(832, 337, 11, 0, Math.PI * 2); ctx.arc(902, 337, 11, 0, Math.PI * 2); ctx.fill();

    const flood = ctx.createLinearGradient(462, 102, 530, 322);
    flood.addColorStop(0, "rgba(190,233,235,.28)"); flood.addColorStop(1, "rgba(112,177,181,0)");
    ctx.fillStyle = flood; ctx.beginPath(); ctx.moveTo(450, 104); ctx.lineTo(385, 330); ctx.lineTo(592, 330); ctx.closePath(); ctx.fill();
    for (const [x, y, width] of [[210, 202, 118], [588, 216, 132]] as const) {
      ctx.fillStyle = "rgba(214,211,183,.78)"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + width / 2, y - 48); ctx.lineTo(x + width, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(51,76,79,.82)"; ctx.fillRect(x + 7, y, width - 14, 42);
      ctx.strokeStyle = "rgba(214,224,211,.45)"; ctx.strokeRect(x + 7.5, y + .5, width - 15, 41);
    }
    ctx.strokeStyle = "rgba(220,229,210,.55)"; ctx.lineWidth = 4; ctx.setLineDash([18, 12]);
    ctx.beginPath(); ctx.moveTo(126, 350); ctx.bezierCurveTo(330, 314, 560, 366, 790, 326); ctx.stroke(); ctx.setLineDash([]);
    for (const [x, y] of [[170, 305], [542, 342], [734, 278]] as const) {
      ctx.fillStyle = "rgba(213,104,45,.9)"; ctx.beginPath(); ctx.moveTo(x, y - 19); ctx.lineTo(x - 10, y + 11); ctx.lineTo(x + 10, y + 11); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(235,219,179,.8)"; ctx.fillRect(x - 7, y - 2, 14, 4);
    }
    ctx.fillStyle = "rgba(84,75,59,.9)";
    for (let index = 0; index < 7; index++) {
      const x = 258 + index * 55; const y = 413 + (index % 2) * 8;
      ctx.beginPath(); ctx.ellipse(x, y, 28, 10, -.08 + index * .025, 0, Math.PI * 2); ctx.fill();
    }
    const beaconAlpha = .2 + (Math.sin(g.time * 8) + 1) * .14;
    for (const x of [820, 900]) {
      const beacon = ctx.createRadialGradient(x, 278, 2, x, 278, 45);
      beacon.addColorStop(0, `rgba(219,65,48,${beaconAlpha})`); beacon.addColorStop(1, "rgba(219,65,48,0)");
      ctx.fillStyle = beacon; ctx.fillRect(x - 45, 233, 90, 90);
    }
  } else if (signature.kind === "infected-industrial-line") {
    const infectionGlow = ctx.createRadialGradient(804, 170, 20, 804, 170, 250);
    infectionGlow.addColorStop(0, "rgba(169,37,24,.38)"); infectionGlow.addColorStop(.5, "rgba(104,30,25,.17)"); infectionGlow.addColorStop(1, "rgba(61,18,17,0)");
    ctx.fillStyle = infectionGlow; ctx.fillRect(540, 20, 420, 350);
    for (let index = 0; index < 7; index++) {
      const x = 688 + Math.sin(index * 2.1 + g.time * .2) * 74 + index * 30;
      const y = 150 - ((g.time * (7 + index) + index * 23) % 95);
      ctx.globalAlpha = .08 + index * .012; ctx.fillStyle = index % 2 ? "#9e4936" : "#4e3831";
      ctx.beginPath(); ctx.ellipse(x, y, 25 + index * 3, 13 + index, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(92,82,68,.9)"; ctx.lineWidth = 5;
    for (const x of [330, 470, 610, 750, 875]) { ctx.beginPath(); ctx.moveTo(x, 126); ctx.lineTo(x, 222); ctx.stroke(); }
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(310, 158);
    for (let x = 310; x <= 900; x += 18) ctx.lineTo(x, 158 + Math.sin(x * .12) * 8);
    ctx.stroke();
    for (let x = 330; x < 870; x += 45) { ctx.beginPath(); ctx.arc(x, 158 + Math.sin(x * .12) * 8, 9, 0, Math.PI * 2); ctx.stroke(); }
    for (const [x, y, size] of [[410, 282, 34], [650, 358, 42], [778, 258, 29]] as const) {
      ctx.strokeStyle = "rgba(102,92,74,.95)"; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(x - size, y - size * .8); ctx.lineTo(x + size, y + size * .8); ctx.moveTo(x + size, y - size * .8); ctx.lineTo(x - size, y + size * .8); ctx.moveTo(x, y - size); ctx.lineTo(x, y + size); ctx.stroke();
    }
    for (const [x, y, rx] of [[510, 385, 62], [735, 438, 48]] as const) {
      const crater = ctx.createRadialGradient(x, y, 8, x, y, rx);
      crater.addColorStop(0, "rgba(12,12,12,.8)"); crater.addColorStop(.48, "rgba(44,31,26,.66)"); crater.addColorStop(.78, "rgba(112,65,43,.28)"); crater.addColorStop(1, "rgba(40,24,22,0)");
      ctx.fillStyle = crater; ctx.beginPath(); ctx.ellipse(x, y, rx, rx * .34, -.05, 0, Math.PI * 2); ctx.fill();
    }
    for (let index = 0; index < 3; index++) {
      const x = 742 + index * 48; const y = 338 + (index % 2) * 26;
      ctx.globalAlpha = .62; ctx.fillStyle = index % 2 ? "#e69a3f" : "#c94f2d";
      ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.quadraticCurveTo(x, y - 34 - Math.sin(g.time * 9 + index) * 6, x + 5, y - 43); ctx.quadraticCurveTo(x + 14, y - 18, x + 8, y); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawWorld(ctx: CanvasRenderingContext2D, g: Game, background: HTMLImageElement | null, sprites: SpriteMap, enemyBaseSprite: HTMLImageElement | null) {
  const shakeAmplitude = cameraShakeAmplitude(g.shake);
  const sx = shakeAmplitude > 0 ? (Math.random() - .5) * shakeAmplitude : 0;
  const sy = shakeAmplitude > 0 ? (Math.random() - .5) * shakeAmplitude : 0;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
  if (background?.complete) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(background, 0, 0, W, H);
    ctx.restore();
  }
  drawStageEnvironment(ctx, g);
  ctx.save();
  ctx.translate(sx, sy);
  const grade = ctx.createLinearGradient(0, 0, W, 0);
  grade.addColorStop(0, "rgba(23,28,31,.18)"); grade.addColorStop(.55, "rgba(15,13,12,.04)"); grade.addColorStop(1, "rgba(58,18,12,.2)");
  ctx.fillStyle = grade; ctx.fillRect(0, 0, W, H);

  // Units reveal the three routes through movement; no lane-map overlay is drawn over the battlefield.

  // The Crawler stays behind combatants; only its doorway masks a unit during deployment.
  drawCrawler(ctx, g, sprites);

  // A single shared-HP infected checkpoint closes all three routes.
  if (g.definition.enemyBaseMode !== "scenery") drawEnemyBase(ctx, g, enemyBaseSprite);

  for (const effect of selectAreaEffectsForRender(g.areaEffects) as AreaEffect[]) drawAreaEffect(ctx, effect, g.time);
  drawEmergencySupport(ctx, g);
  drawPlacementIndicator(ctx, g.placementIndicator);

  for (const corpse of g.corpses) {
    const allyCue = corpse.side === "human" ? allyCorpseVisualCue(corpse, g.time) : null;
    const fallDirection = corpse.variant % 2 === 0 ? -1 : 1;
    ctx.save();
    const enemySheet = corpse.kind === "takuya" ? "takuya"
      : corpse.kind === "shade" ? "shade"
        : corpse.kind === "crusher" || corpse.kind === "abomination" ? "crusher"
          : corpse.kind === "spitter" ? "spitter"
            : "infected";
    const sprite = corpse.side === "human" ? sprites[corpse.kind] : sprites[enemySheet] ?? sprites.infected;
    if (sprite?.complete && sprite.naturalWidth) {
      const frameWidth = sprite.naturalWidth / 6;
      const widths: Record<string, number> = { scout: 58, ranger: 58, brute: 72, brawler: 62, gunner: 60, medic: 60, walker: 58, runner: 53, turned: 58, shade: 64, spitter: 62, crusher: 80, abomination: 101, takuya: 94 };
      const heights: Record<string, number> = { scout: 98, ranger: 98, brute: 108, brawler: 99, gunner: 100, medic: 100, walker: 96, runner: 90, turned: 96, shade: 101, spitter: 101, crusher: 112, abomination: 132, takuya: 128 };
      const width = widths[corpse.kind] ?? 60;
      const height = heights[corpse.kind] ?? 100;
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
      const fallAngle = corpse.side === "human" ? -1.18 : corpse.kind === "takuya" ? .68 : corpse.deathClass === "heavy" ? .9 : 1.08;
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
      const sourceFrame = corpse.side === "zombie" && corpse.state === "dying" ? 5 : 0;
      ctx.drawImage(sprite, sourceFrame * frameWidth, 0, frameWidth, sprite.naturalHeight, -width / 2, -height + 26, width, height);
      ctx.filter = "none";
    } else {
      ctx.globalAlpha = corpse.state === "ashing" || corpse.state === "ash" ? Math.min(.55, corpse.life / 2) : .65;
      ctx.translate(corpse.x, corpse.y + 7); ctx.scale(1, .45);
      ctx.fillStyle = corpse.kind === "takuya" || corpse.kind === "shade" ? "#292d31" : corpse.side === "zombie" ? "#4e5a3e" : "#5d392f";
      ctx.beginPath(); ctx.ellipse(0, 0, corpse.kind === "abomination" || corpse.kind === "takuya" ? 25 : 15, 7, 0, 0, Math.PI * 2); ctx.fill();
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
      for (let index = 0; index < (corpse.kind === "takuya" ? 12 : corpse.deathClass === "heavy" ? 8 : 5); index++) {
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
    drawSpriteFighter(ctx, f, sprites);
    if (!f.combatReady) continue;
    const barW = f.kind === "takuya" ? 52 : f.kind === "crusher" || f.kind === "brute" ? 38 : f.kind === "abomination" ? 52 : 28;
    const height = f.kind === "takuya" ? 111 : f.kind === "abomination" ? 115 : f.kind === "crusher" || f.kind === "brute" ? 94 : 80;
    const barY = f.y - height;
    ctx.fillStyle = "rgba(0,0,0,.58)"; ctx.fillRect(f.x - barW / 2, barY, barW, 4);
    ctx.fillStyle = f.side === "human" ? "#e9c65a" : "#cb5037";
    ctx.fillRect(f.x - barW / 2, barY, barW * Math.max(0, f.hp / f.maxHp), 4);
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

  drawCrawlerExitFrame(ctx, g);
  drawCrawlerBarrage(ctx, g);

  for (const shot of g.shots) {
    const duration = shot.duration ?? .12;
    const p = 1 - shot.life / duration;
    const x = shot.x + (shot.tx - shot.x) * p;
    const y = shot.y + (shot.ty - shot.y) * p;
    if (shot.effect) {
      const strength = Math.max(.2, Math.min(1, shot.life / duration));
      ctx.save(); ctx.globalAlpha = strength;
      if (shot.effect === "scout") {
        ctx.strokeStyle = "#ffe26e"; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(shot.tx, shot.ty, 13 + (1 - strength) * 7, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        for (const [dx, dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) { ctx.beginPath(); ctx.moveTo(shot.tx + dx * 17, shot.ty + dy * 8); ctx.lineTo(shot.tx + dx * 9, shot.ty + dy * 8); ctx.stroke(); }
      } else if (shot.effect === "ranger") {
        ctx.strokeStyle = "#b7efff"; ctx.shadowColor = "#67c8ff"; ctx.shadowBlur = 8; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(shot.x, shot.y); ctx.lineTo(x, y); ctx.stroke();
        ctx.beginPath(); ctx.arc(shot.tx, shot.ty, 6, 0, Math.PI * 2); ctx.stroke();
      } else if (shot.effect === "brute") {
        ctx.strokeStyle = "#ff9d45"; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(shot.tx, shot.ty + 12, 11 + (1 - strength) * 18, 5 + (1 - strength) * 7, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#d8b36c"; for (const dx of [-12, -4, 5, 13]) ctx.fillRect(shot.tx + dx, shot.ty + 4 - Math.abs(dx) * .2, 3, 8);
      } else if (shot.effect === "brawler") {
        const reach = shot.emphasized ? 20 : 13; ctx.strokeStyle = shot.emphasized ? "#fff18a" : "#f08a57"; ctx.lineWidth = shot.emphasized ? 5 : 3;
        ctx.beginPath(); ctx.moveTo(shot.tx - reach, shot.ty - reach * .45); ctx.lineTo(shot.tx + reach, shot.ty + reach * .45); ctx.moveTo(shot.tx + reach * .7, shot.ty - reach * .65); ctx.lineTo(shot.tx - reach * .7, shot.ty + reach * .65); ctx.stroke();
      } else if (shot.effect === "gunner") {
        ctx.strokeStyle = shot.emphasized ? "#ffd067" : "#e8b354"; ctx.shadowColor = "#ff9e35"; ctx.shadowBlur = 10; ctx.lineWidth = shot.emphasized ? 5 : 3;
        ctx.beginPath(); ctx.moveTo(shot.x, shot.y - 2); ctx.lineTo(x, y - 2); ctx.moveTo(shot.x, shot.y + 2); ctx.lineTo(x, y + 2); ctx.stroke();
        ctx.strokeRect(shot.tx - 10, shot.ty - 10, 20, 20);
      } else if (shot.effect === "medic") {
        ctx.strokeStyle = "#79efac"; ctx.shadowColor = "#58d98f"; ctx.shadowBlur = 9; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(shot.x, shot.y); ctx.quadraticCurveTo((shot.x + shot.tx) / 2, Math.min(shot.y, shot.ty) - 13, shot.tx, shot.ty); ctx.stroke();
        ctx.beginPath(); ctx.arc(shot.tx, shot.ty, 9 + (1 - strength) * 5, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = "#b8ffd0"; ctx.fillRect(shot.tx - 2, shot.ty - 8, 4, 16); ctx.fillRect(shot.tx - 8, shot.ty - 2, 16, 4);
      }
      ctx.restore();
      continue;
    }
    ctx.strokeStyle = shot.side === "human" ? "#ffe078" : "#e76747";
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 7;
    if (shot.style === "melee") {
      const strength = Math.max(.15, Math.min(1, shot.life / duration));
      ctx.globalAlpha = strength; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(shot.tx, shot.ty, 5 + (1 - strength) * 5, -.8, 1.2); ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.lineWidth = shot.side === "human" ? 2.5 : 4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (shot.side === "human" ? -15 : 15), y); ctx.stroke();
    }
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
  const enemyBaseSpriteRef = useRef<HTMLImageElement | null>(null);
  const gameRef = useRef<Game>(initialGame("pod", INITIAL_STAGE_ID, ["brawler", "scout", "ranger", "medic"]));
  const productionMixerRef = useRef<ReturnType<typeof createAudioMixer> | null>(null);
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
  const lastHudRef = useRef(0);
  const selectedActionRef = useRef<SelectedAction>(null);
  const eventDestinationRef = useRef<EventDestination>("map");
  const finalizedEndRef = useRef<BattleResult | null>(null);
  const qaScenarioAppliedRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [bgmMuted, setBgmMuted] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(false);
  const [musicActive, setMusicActive] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [assetError, setAssetError] = useState(false);
  const [qaMode, setQaMode] = useState<QaMode | null>(null);
  const [qaScenario, setQaScenario] = useState<ReturnType<typeof resolveLocalQaScenario>>(null);
  const [selectedSupply, setSelectedSupply] = useState<SupplyKind>("pod");
  const [selectedAction, setSelectedAction] = useState<SelectedAction>(null);
  const [screen, setScreen] = useState<CampaignScreen>("title");
  const [eventId, setEventId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState(INITIAL_STAGE_ID);
  const [formationKinds, setFormationKinds] = useState<UnitKind[]>(["brawler", "scout", "ranger", "medic"]);
  const [campaignSave, setCampaignSave] = useState<CampaignSave>(() => createDefaultCampaignSave() as CampaignSave);
  const [saveHydrated, setSaveHydrated] = useState(false);
  const [campaignResult, setCampaignResult] = useState<CampaignResultView | null>(null);
  const [hud, setHud] = useState<Hud>({
    missionType: "assault", energy: 70, supportGauge: 0, scrap: 0, kills: 0, wave: 1, phase: 1, baseHp: 1000, baseMaxHp: 1000,
    barricadeHp: BARRICADE_MAX_HP, barricadeMaxHp: BARRICADE_MAX_HP, barricadeVulnerable: true, barricadeHitFlash: 0,
    tactic: "balanced", deployQueue: 0, airstrikePhase: "idle", crawlerPhase: "cooldown", crawlerCharge: .5, combo: 0, bossHp: 0, bossMax: 0,
    crawlerHitFlash: 0, threat: 0,
    objective: objectiveFor(1, false), deployCooldowns: emptyCooldowns(), battleBarks: [],
  });
  const [end, setEnd] = useState<BattleResult | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQaMode(resolveLocalQaMode(window.location.hostname, window.location.search) as QaMode | null);
      setQaScenario(resolveLocalQaScenario(window.location.hostname, window.location.search));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const loaded = deserializeCampaignSave(window.localStorage.getItem("nishijin-campaign-v1") ?? "") as CampaignSave;
      const legacyQa = resolveLocalQaMode(window.location.hostname, window.location.search) as QaMode | null;
      const campaignQa = resolveLocalQaScenario(window.location.hostname, window.location.search);
      const localQaAudio = Boolean(legacyQa || campaignQa);
      setCampaignSave(loaded);
      setSelectedStageId(legacyQa ? CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE : loaded.lastSelectedStageId);
      setFormationKinds(legacyQa ? cards.map((card) => card.kind) : (current) => current.filter((kind) => loaded.unlockedUnitIds.includes(kind)));
      if (legacyQa) setScreen("loadout");
      setBgmMuted(localQaAudio ? false : !loaded.settings.bgmEnabled);
      sfxMutedRef.current = localQaAudio ? false : !loaded.settings.sfxEnabled;
      setSfxMuted(localQaAudio ? false : !loaded.settings.sfxEnabled);
      setSaveHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!saveHydrated) return;
    // Local QA can expose every unit and stage, but must never turn those
    // conveniences into ordinary campaign progress.
    if (resolveLocalQaMode(window.location.hostname, window.location.search)
      || resolveLocalQaScenario(window.location.hostname, window.location.search)) return;
    window.localStorage.setItem("nishijin-campaign-v1", serializeCampaignSave(campaignSave));
  }, [campaignSave, saveHydrated]);

  useEffect(() => {
    const mixer = createAudioMixer({
      manifest: PRODUCTION_AUDIO_MANIFEST,
      maxVoices: 28,
      maxWarningsTotal: 12,
      maxWarningsPerKey: 1,
    });
    productionMixerRef.current = mixer;
    const detachUnlock = mixer.attachUnlock(window);
    void mixer.preloadScene("title");

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
      cueIds: [...qaAssets.map((asset) => asset.id), ...qaPools.map((pool) => pool.id)],
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
      stopScene: (fadeMs = 0) => mixer.stopScene({ fadeMs }),
      stopAll: (fadeMs = 0) => mixer.stopAll({ fadeMs }),
    };
    let diagnosticsTimer: number | null = null;
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
    }

    return () => {
      detachUnlock();
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
    const criticalPaths: Record<string, string> = {
      scout: "/scout-sprites-v2.png", ranger: "/ranger-sprites-v1.png", brute: "/breaker-sprites-v2.png",
      brawler: "/brawler-sprites-v1.png", gunner: "/gunner-sprites-v1.png", medic: "/medic-sprites-v1.png",
      infected: "/infected-sprites-v1.png", crawler: "/crawler-fortress-v1.png", pod: "/tactical-drop-pod-v1.png",
      drum: "/explosive-drum-v1.png", medical: "/medical-supply-station-v1.png",
    };
    const criticalJobs = [
      loadImage(stageVisualFor(INITIAL_STAGE_ID), (image) => {
        backgroundCacheRef.current[INITIAL_STAGE_ID] = image;
        if (!backgroundRef.current) backgroundRef.current = image;
      }),
      loadImage("/infected-checkpoint-v1.png", (image) => { enemyBaseSpriteRef.current = image; }),
      ...Object.entries(criticalPaths).map(([key, src]) => loadImage(src, (image) => { spriteRefs.current[key] = image; })),
    ];
    void Promise.all(criticalJobs).then(() => {
      if (cancelled) return;
      setAssetsReady(true);
      const laterPaths: Record<string, string> = {
        crusher: "/crusher-sprites-v1.png", spitter: "/spitter-sprites-v1.png",
        takuya: "/takuya-boss-sprites-v2.png", shade: "/shade-raider-sprites-v1.png",
      };
      for (const [key, src] of Object.entries(laterPaths)) {
        void loadImage(src, (image) => { spriteRefs.current[key] = image; }).catch(() => undefined);
      }
      for (const [stageId, src] of Object.entries(PRODUCTION_VISUALS.stages)) {
        if (backgroundCacheRef.current[stageId]) continue;
        void loadImage(src, (image) => {
          backgroundCacheRef.current[stageId] = image;
        }).catch(() => undefined);
      }
    }).catch(() => { if (!cancelled) setAssetError(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const configureCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nextLaneCenters = laneCentersForViewport(rect.width, rect.height) as LaneCenters;
      if (nextLaneCenters.some((center, lane) => center !== activeLaneCenters[lane])) {
        const previousLaneCenters = activeLaneCenters;
        const shiftForLane = (lane: Lane) => nextLaneCenters[lane] - previousLaneCenters[lane];
        const g = gameRef.current;
        for (const fighter of g.fighters) fighter.y += shiftForLane(fighter.lane);
        for (const corpse of g.corpses) corpse.y += shiftForLane(corpse.lane);
        for (const object of g.battlefieldObjects) object.y += shiftForLane(object.lane);
        for (const effect of g.areaEffects) effect.y += shiftForLane(effect.lane);
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

  useEffect(() => {
    const cached = backgroundCacheRef.current[selectedStageId];
    if (cached) {
      backgroundRef.current = cached;
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (cancelled || !image.naturalWidth) return;
      backgroundCacheRef.current[selectedStageId] = image;
      backgroundRef.current = image;
    };
    image.src = stageVisualFor(selectedStageId);
    return () => { cancelled = true; };
  }, [selectedStageId]);

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

  const duckMusic = useCallback((level: number, seconds: number) => {
    const productionMixer = productionMixerRef.current;
    if (productionMixer) {
      productionMixer.duckMusic({ level, holdMs: seconds * 1000, attackMs: 24, releaseMs: 180 });
      return;
    }
    const audio = audioRef.current;
    const music = musicRef.current;
    if (!audio || !music || audio.state === "closed") return;
    const now = audio.currentTime;
    const restoreAt = Math.max(musicDuckUntilRef.current, now + seconds);
    musicDuckUntilRef.current = restoreAt;
    music.master.gain.cancelScheduledValues(now);
    music.master.gain.setTargetAtTime(MUSIC_MASTER_GAIN * level, now, .02);
    music.master.gain.setTargetAtTime(MUSIC_MASTER_GAIN, restoreAt, .08);
  }, []);

  const playSynthCue = useCallback((cueId: SfxCueId, options?: { frequency?: number }) => {
    if (sfxMutedRef.current) return false;
    try {
      const audio = ensureAudio();
      if (audio.state !== "running") void audio.resume().catch(() => undefined);
      const runtime = ensureSfxRuntime(audio);
      const cue: SfxCueDef = SFX_CUES[cueId];
      const now = audio.currentTime;
      if ((runtime.lastPlayedAt.get(cueId) ?? -Infinity) + cue.cooldown > now) return false;
      if (runtime.active.size >= MAX_SFX_VOICES) {
        const victim = [...runtime.active.values()].sort((a, b) => a.priority - b.priority || a.startedAt - b.startedAt)[0];
        if (!victim || victim.priority >= cue.priority) return false;
        runtime.active.delete(victim.oscillator);
        try { victim.oscillator.stop(); } catch { /* The displaced voice may already have ended. */ }
        try { victim.gain.disconnect(); } catch { /* The displaced voice may already be disconnected. */ }
      }
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = cue.type;
      oscillator.frequency.value = options?.frequency ?? cue.frequency;
      gain.gain.setValueAtTime(cue.volume, now);
      gain.gain.exponentialRampToValueAtTime(.001, now + cue.duration);
      oscillator.connect(gain); gain.connect(runtime.buses[cue.category]);
      const voice: SfxVoice = { oscillator, gain, cue: cueId, priority: cue.priority, startedAt: now };
      runtime.active.set(oscillator, voice);
      runtime.lastPlayedAt.set(cueId, now);
      oscillator.onended = () => {
        runtime.active.delete(oscillator);
        try { oscillator.disconnect(); } catch { /* Already disconnected. */ }
        try { gain.disconnect(); } catch { /* Already disconnected. */ }
      };
      oscillator.start(); oscillator.stop(now + cue.duration);
      if (cue.duck) duckMusic(cue.duck.level, cue.duck.seconds);
      return true;
    } catch { return false; }
  }, [duckMusic, ensureAudio, ensureSfxRuntime]);

  const playCue = useCallback((cueId: SfxCueId, options?: { frequency?: number }) => {
    if (sfxMutedRef.current) return false;
    const productionMixer = productionMixerRef.current;
    const productionCue = LEGACY_SFX_CUE_MAP[cueId];
    if (!productionMixer || !productionCue) return playSynthCue(cueId, options);
    const cue = SFX_CUES[cueId];
    void (async () => {
      const unlocked = productionMixer.unlocked || await productionMixer.unlock();
      if (!unlocked) {
        playSynthCue(cueId, options);
        return;
      }
      await productionMixer.play(productionCue, {
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
        onLoadFailure: () => playSynthCue(cueId, options),
      });
    })().catch(() => {
      playSynthCue(cueId, options);
    });
    return true;
  }, [playSynthCue]);

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
    } = {},
  ) => {
    if (!cueId || sfxMutedRef.current) return false;
    const productionMixer = productionMixerRef.current;
    if (!productionMixer) return options.fallbackCue ? playSynthCue(options.fallbackCue) : false;
    const pan = Math.max(-.85, Math.min(.85, x / W * 2 - 1));
    void (async () => {
      const unlocked = productionMixer.unlocked || await productionMixer.unlock();
      if (!unlocked) {
        if (options.fallbackCue) playSynthCue(options.fallbackCue);
        return;
      }
      await productionMixer.play(cueId, {
        pan,
        priority: options.priority,
        cooldownMs: options.cooldownMs,
        volume: options.volume,
        playbackRate: options.playbackRate,
        instanceKey: options.instanceKey,
        maxInstances: options.maxInstances,
        durationSeconds: options.durationSeconds,
        onLoadFailure: options.fallbackCue ? () => playSynthCue(options.fallbackCue as SfxCueId) : undefined,
      });
    })().catch(() => {
      if (options.fallbackCue) playSynthCue(options.fallbackCue);
    });
    return true;
  }, [playSynthCue]);

  const chooseActionWithCue = useCallback((action: SelectedAction) => {
    const g = gameRef.current;
    if (!g.running || g.paused || g.over) return;
    if (selectedActionRef.current === action) return;
    chooseAction(action);
    playCue(action ? "ui-confirm" : "ui-cancel");
  }, [chooseAction, playCue]);

  const stopSfx = useCallback(() => {
    if (startCueTimerRef.current !== null) {
      window.clearTimeout(startCueTimerRef.current);
      startCueTimerRef.current = null;
    }
    const productionMixer = productionMixerRef.current;
    if (productionMixer) {
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
    if (productionMixer) {
      const sceneId = sceneIdForScreen("battle", gameRef.current.definition.stageId, { musicMode: mode });
      if (desiredProductionSceneRef.current === sceneId) return;
      desiredProductionSceneRef.current = sceneId;
      if (sceneId && productionMixer.getSettings().bgmEnabled) {
        void productionMixer.setScene(sceneId, { onBgmLoadFailure: () => startSynthMusicRef.current() }).then((state) => {
          if (desiredProductionSceneRef.current !== sceneId) return;
          if (state?.bgmAssetId) stopSynthMusicRef.current();
          setMusicActive(Boolean(state?.bgmAssetId || musicRef.current));
        }).catch(() => startSynthMusicRef.current());
      }
      return;
    }
    const music = musicRef.current;
    const audio = audioRef.current;
    if (!music || !audio || music.mode === mode) return;
    music.mode = mode;
    const danger = mode === "normal" ? .0001 : mode === "danger" ? 1 : .55;
    const boss = mode === "boss" ? 1 : .0001;
    for (const [bus, value] of [[music.dangerBus, danger], [music.bossBus, boss]] as [GainNode, number][]) {
      bus.gain.cancelScheduledValues(audio.currentTime);
      bus.gain.setTargetAtTime(value, audio.currentTime, .16);
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
    if (!productionMixer) {
      startSynthMusic();
      return;
    }
    const sceneId = sceneIdForScreen("battle", gameRef.current.definition.stageId, { musicMode: desiredMusicModeRef.current });
    desiredProductionSceneRef.current = sceneId;
    productionMixer.setSettings({ bgmEnabled: true });
    if (!sceneId) {
      startSynthMusic();
      return;
    }
    void productionMixer.setScene(sceneId, { onBgmLoadFailure: startSynthMusic }).then((state) => {
      if (desiredProductionSceneRef.current !== sceneId) return;
      if (state?.bgmAssetId) stopSynthMusic();
      setMusicActive(Boolean(state?.bgmAssetId || musicRef.current));
    }).catch(startSynthMusic);
  }, [startSynthMusic, stopSynthMusic]);

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
      level: screen === "event" ? .42 : .58,
      fadeMs: 120,
    });
    const outcome = campaignResult?.won ?? end?.won;
    const musicState = screen === "battle"
      ? (typeof outcome === "boolean" ? { won: outcome, musicMode: desiredMusicModeRef.current } : { musicMode: desiredMusicModeRef.current })
      : (typeof outcome === "boolean" ? { won: outcome } : null);
    const sceneId = sceneIdForScreen(screen, selectedStageId, musicState);
    desiredProductionSceneRef.current = sceneId;
    if (document.documentElement.dataset.audioMixer === "production") {
      document.documentElement.dataset.audioScene = sceneId ?? "none";
    }
    if (bgmMuted || !sceneId || (screen === "battle" && paused)) {
      void productionMixer.stopScene({ fadeMs: 180 });
      stopSynthMusic();
      setMusicActive(false);
      return;
    }
    void productionMixer.setScene(sceneId, { onBgmLoadFailure: startSynthMusic }).then((state) => {
      if (desiredProductionSceneRef.current !== sceneId) return;
      if (state?.bgmAssetId) stopSynthMusic();
      setMusicActive(Boolean(state?.bgmAssetId || musicRef.current));
    }).catch(startSynthMusic);
  }, [bgmMuted, campaignResult?.won, campaignSave.settings.bgmVolume, campaignSave.settings.sfxVolume, end?.won, hud.battleBarks.length, paused, screen, selectedStageId, sfxMuted, startSynthMusic, stopSynthMusic]);

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
    const result = resolveBattlefieldSupplyPlacement({
      running: g.running, paused: g.paused, over: g.over, scrap: g.scrap, supplyKind: kind, lane, x,
      supplies: g.battlefieldObjects, objects: [], supports: [], areaEffects: g.areaEffects,
      nextId: g.nextId, nextAreaEffectId: g.nextAreaEffectId,
      laneCenters: activeLaneCenters,
      forbiddenZones: [{ minX: BASE_X - 55, maxX: BASE_X + 45 }, { minX: BARRICADE_X - 12, maxX: W }],
    });
    g.placementIndicator = { lane, x, y: activeLaneCenters[lane], valid: result.ok, reason: result.reason };
    if (!result.ok) {
      g.banner = `配置不可 // ${result.reason}`; g.bannerTime = 1.15; playCue("denied");
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
      g.banner = `配置不可 // ${result.reason}`; g.bannerTime = 1.15; playCue("denied"); return false;
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
    const x = Math.max(0, Math.min(W, (event.clientX - rect.left - transform.offsetX) / transform.scale));
    const y = Math.max(0, Math.min(H, (event.clientY - rect.top - transform.offsetY) / transform.scale));
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
    const check = action.startsWith("supply:")
      ? battlefieldSupplyPlacementCheck({
        running: g.running, paused: g.paused, over: g.over, scrap: g.scrap,
        supplyKind: action.slice("supply:".length), lane, x, supplies: g.battlefieldObjects,
        laneCenters: activeLaneCenters,
        forbiddenZones: [{ minX: BASE_X - 55, maxX: BASE_X + 45 }, { minX: BARRICADE_X - 12, maxX: W }],
      })
      : { ok: g.running && !g.paused && !g.over && g.supportGauge >= AIRSTRIKE_DEF.gaugeCost && g.airstrike.phase === "idle", reason: "航空支援目標" };
    g.placementIndicator = { lane, x, y: activeLaneCenters[lane], valid: check.ok, reason: check.reason };
  }, [pointerWorldPosition]);

  const handleBattlefieldPointer = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const g = gameRef.current;
    if (!g.running || g.paused || g.over) return;
    const { x, lane } = pointerWorldPosition(event);
    if (!selectedActionRef.current) { triggerDrumAt(lane, x); return; }
    executeSelected(lane, x);
  }, [executeSelected, pointerWorldPosition, triggerDrumAt]);

  const executeSelectedInLane = useCallback((lane: Lane) => {
    const preferredX = gameRef.current.placementIndicator?.x ?? 560;
    executeSelected(lane, preferredX);
  }, [executeSelected]);

  const stageViews = useMemo<StageScreenView[]>(() => (CAMPAIGN_STAGES as unknown as readonly CampaignStageData[]).map((stage, index) => {
    const claimed = campaignSave.claimedStarRewardsByStage[stage.id] ?? [];
    const nextMilestone = [1, 2, 3].find((star) => !claimed.includes(star));
    return {
      id: stage.id,
      displayName: stage.displayName,
      chapterName: "序章　新たな世界の始まり",
      objective: stage.objective,
      missionLabel: stage.missionType === "assault" ? "拠点破壊作戦" : stage.missionType === "timed-defense" ? "180秒防衛作戦" : "ボス・拠点攻略",
      threat: index === 0 ? "危険度 低〜中" : index === 1 ? "危険度 中" : "危険度 極高 / TAKUYA",
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
    unlocked: Boolean(qaMode || qaScenario) || isUnitUnlocked(campaignSave, unit.id),
    unlockHint: unit.unlock.type === "initial"
      ? "初期解放"
      : `${CAMPAIGN_STAGE_BY_ID[unit.unlock.stageId]?.displayName ?? "指定ステージ"}クリアで解放`,
  })), [campaignSave, qaMode, qaScenario]);
  const supplyViews = useMemo<SupplyScreenView[]>(() => (Object.keys(supplyDefs) as SupplyKind[]).map((kind) => ({
    kind,
    name: supplyDefs[kind].name,
    cost: supplyDefs[kind].cost,
    description: kind === "pod" ? "着地衝撃 / 敵を遮断" : kind === "drum" ? "任意起爆 / 火炎" : "周囲を継続回復",
  })), []);

  const openEvent = useCallback((nextEventId: string, destination: EventDestination) => {
    eventDestinationRef.current = destination;
    setEventId(nextEventId);
    setScreen("event");
  }, []);

  const startGame = useCallback(() => {
    const retrying = gameRef.current.over;
    const qaAllUnlocked = Boolean(qaMode || qaScenario);
    const battleStageId = qaMode ? CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE : selectedStageId;
    const permittedFormation = qaAllUnlocked
      ? formationKinds
      : formationKinds.filter((kind) => isUnitUnlocked(campaignSave, kind));
    const fallbackFormation = cards.map((card) => card.kind).filter((kind) => qaAllUnlocked || isUnitUnlocked(campaignSave, kind));
    const fresh = initialGame(selectedSupply, battleStageId, permittedFormation.length > 0 ? permittedFormation : fallbackFormation);
    fresh.running = true;
    prepareQaMode(fresh, qaMode);
    if (qaScenario?.mode === "defense") {
      fresh.time = Math.max(PREP_SECONDS, (fresh.definition.defenseEndAt ?? PREP_SECONDS + 180) - 8);
      fresh.phase = phaseForBattle(fresh.definition, fresh.time) as Game["phase"];
      fresh.eventIndex = fresh.definition.timeline.filter((event: MissionEvent) => event.at <= fresh.time).length;
      fresh.banner = "LOCAL QA // 防衛終了8秒前";
      fresh.bannerTime = 2.2;
    }
    gameRef.current = fresh;
    const boss = fresh.fighters.find((fighter) => fighter.kind === "takuya" && fighter.hp > 0);
    desiredMusicModeRef.current = "normal";
    finalizedEndRef.current = null;
    setStarted(true); setPaused(false); setEnd(null); setCampaignResult(null); setScreen("battle"); chooseAction(null);
    setHud({ missionType: fresh.definition.missionType, energy: Math.floor(fresh.energy), supportGauge: Math.floor(fresh.supportGauge), scrap: fresh.scrap, kills: fresh.kills,
      wave: fresh.wave, phase: fresh.phase, baseHp: fresh.baseHp, baseMaxHp: fresh.baseMaxHp,
      barricadeHp: fresh.barricadeHp, barricadeMaxHp: fresh.barricadeMaxHp, barricadeVulnerable: fresh.barricadeVulnerable, barricadeHitFlash: 0,
      tactic: fresh.tactic, deployQueue: fresh.deployQueue.length, airstrikePhase: fresh.airstrike.phase,
      crawlerPhase: fresh.crawlerAbility.phase, crawlerCharge: fresh.crawlerAbility.charge, combo: 0,
      bossHp: boss?.hp ?? 0, bossMax: boss?.maxHp ?? 0,
      crawlerHitFlash: 0, threat: 0, objective: objectiveForBattle(fresh.definition, fresh),
      deployCooldowns: { ...fresh.deployCooldowns }, battleBarks: [...fresh.battleBarks.active] });
    stopMusic(); stopJingle(); stopSfx(); if (!bgmMuted) startMusic();
    if (retrying) playCue("retry");
    else {
      playCue("start-low");
      startCueTimerRef.current = window.setTimeout(() => { startCueTimerRef.current = null; playCue("start-high"); }, 90);
    }
  }, [bgmMuted, campaignSave, chooseAction, formationKinds, playCue, qaMode, qaScenario, selectedStageId, selectedSupply, startMusic, stopJingle, stopMusic, stopSfx]);

  const returnToMap = useCallback(() => {
    stopMusic(); stopJingle(); stopSfx();
    const fresh = initialGame(selectedSupply, selectedStageId, formationKinds);
    gameRef.current = fresh;
    finalizedEndRef.current = null;
    setStarted(false); setPaused(false); setEnd(null); setCampaignResult(null); setScreen("map"); chooseAction(null);
  }, [chooseAction, formationKinds, selectedStageId, selectedSupply, stopJingle, stopMusic, stopSfx]);

  const handleEventComplete = useCallback(() => {
    setEventId(null);
    if (eventDestinationRef.current === "battle") startGame();
    else if (eventDestinationRef.current === "result") setScreen("result");
    else returnToMap();
  }, [returnToMap, startGame]);

  const selectStage = useCallback((stageId: string) => {
    if (!qaMode && !qaScenario && !isStageUnlocked(campaignSave, stageId)) return;
    setSelectedStageId(stageId);
    setCampaignSave((current) => selectCampaignStage(current, stageId) as CampaignSave);
  }, [campaignSave, qaMode, qaScenario]);

  const toggleFormation = useCallback((kind: string) => {
    if (!qaMode && !qaScenario && !isUnitUnlocked(campaignSave, kind)) return;
    setFormationKinds((current) => current.includes(kind as UnitKind)
      ? current.filter((entry) => entry !== kind)
      : [...current, kind as UnitKind]);
  }, [campaignSave, qaMode, qaScenario]);

  const beginCampaign = useCallback(() => {
    if (campaignSave.campaignStarted) {
      setSelectedStageId(campaignSave.lastSelectedStageId);
      setScreen("map");
      return;
    }
    setCampaignSave((current) => markCampaignStarted(current) as CampaignSave);
    openEvent("intro", "map");
  }, [campaignSave.campaignStarted, campaignSave.lastSelectedStageId, openEvent]);
  const openLoadout = useCallback(() => setScreen("loadout"), []);
  const requestBattle = useCallback(() => {
    const stage = CAMPAIGN_STAGE_BY_ID[selectedStageId];
    openEvent(stage.preBattleEventId, "battle");
  }, [openEvent, selectedStageId]);
  const retryBattle = useCallback(() => startGame(), [startGame]);
  const continueResult = useCallback(() => {
    if (end?.won) openEvent(CAMPAIGN_STAGE_BY_ID[end.stageId].postBattleEventId, "map");
    else returnToMap();
  }, [end, openEvent, returnToMap]);
  const resetCampaign = useCallback(() => {
    if (!window.confirm("セーブデータを初期化しますか？ 星・報酬・解放状態は元に戻せません。")) return;
    const fresh = createDefaultCampaignSave() as CampaignSave;
    setCampaignSave(fresh);
    setSelectedStageId(fresh.lastSelectedStageId);
    setFormationKinds(["brawler", "scout", "ranger", "medic"]);
    setCampaignResult(null);
    setScreen("title");
  }, []);
  const restartCampaign = useCallback(() => {
    if (!window.confirm("現在のセーブデータを初期化して、物語を最初から始めますか？")) return;
    const fresh = markCampaignStarted(createDefaultCampaignSave()) as CampaignSave;
    setCampaignSave(fresh);
    setSelectedStageId(fresh.lastSelectedStageId);
    setFormationKinds(["brawler", "scout", "ranger", "medic"]);
    setCampaignResult(null);
    openEvent("intro", "map");
  }, [openEvent]);

  useEffect(() => {
    if (!end || finalizedEndRef.current === end) return;
    const timer = window.setTimeout(() => {
      if (finalizedEndRef.current === end) return;
      finalizedEndRef.current = end;
      const resolved = resolveStageResult(campaignSave, {
        resultId: end.resultId,
        stageId: end.stageId,
        won: end.won,
        baseHp: end.baseHp,
        baseMaxHp: end.baseMaxHp,
      });
      if (resolved.result.applied) {
        const localQaResult = Boolean(
          resolveLocalQaMode(window.location.hostname, window.location.search)
          || resolveLocalQaScenario(window.location.hostname, window.location.search),
        );
        // Persist the processed receipt in the same result transaction, before
        // exposing the result UI. A reload cannot replay rewards in the gap
        // between React state publication and the passive save effect.
        if (!localQaResult) {
          window.localStorage.setItem("nishijin-campaign-v1", serializeCampaignSave(resolved.save));
        }
        setCampaignSave(resolved.save as CampaignSave);
      }
      setCampaignResult({
        won: end.won,
        currentStars: resolved.result.stars,
        previousBestStars: resolved.result.previousBestStars,
        bestStars: resolved.result.bestStars,
        newBest: resolved.result.isNewBest,
        clearReward: resolved.result.replayReward,
        newStarReward: resolved.result.firstTimeStarReward,
        totalReward: resolved.result.totalReward,
        suppliesAfter: resolved.save.supplies,
        time: end.time,
        kills: end.kills,
        unitsLost: end.unitsLost,
        baseHpRatio: end.baseMaxHp > 0 ? end.baseHp / end.baseMaxHp : 0,
        newlyUnlockedUnits: resolved.result.newlyUnlockedUnitIds.map((id: string) => {
          const unit = (CAMPAIGN_UNITS as unknown as readonly CampaignUnitData[]).find((candidate) => candidate.id === id);
          return unit ? `${unit.displayName}（${unit.roleName}）` : id;
        }),
        newlyUnlockedStages: resolved.result.newlyUnlockedStageIds.map((id: string) => CAMPAIGN_STAGE_BY_ID[id]?.displayName ?? id),
      });
      setStarted(false);
      setScreen("result");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [campaignSave, end]);

  useEffect(() => {
    if (!saveHydrated || !qaScenario || qaScenarioAppliedRef.current) return;
    qaScenarioAppliedRef.current = true;
    const timer = window.setTimeout(() => {
      setSelectedStageId(qaScenario.stageId);
      const qaSave = {
        ...campaignSave,
        campaignStarted: true,
        unlockedStageIds: [...new Set([...campaignSave.unlockedStageIds, qaScenario.stageId])],
        unlockedUnitIds: cards.map((card) => card.kind),
        lastSelectedStageId: qaScenario.stageId,
      } as CampaignSave;
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
          suppliesAfter: resolved.save.supplies,
          time: 94,
          kills: 24,
          unitsLost: 1,
          baseHpRatio,
          newlyUnlockedUnits: resolved.result.newlyUnlockedUnitIds.map((id: string) => {
            const unit = (CAMPAIGN_UNITS as unknown as readonly CampaignUnitData[]).find((candidate) => candidate.id === id);
            return unit ? `${unit.displayName}（${unit.roleName}）` : id;
          }),
          newlyUnlockedStages: resolved.result.newlyUnlockedStageIds.map((id: string) => CAMPAIGN_STAGE_BY_ID[id]?.displayName ?? id),
        });
        setFormationKinds(cards.map((card) => card.kind));
        setScreen("result");
        return;
      }
      setCampaignSave(qaSave);
      setFormationKinds(cards.map((card) => card.kind));
      if (qaScenario.mode === "defense") {
        setScreen("loadout");
        return;
      }
      if (qaScenario.screen === "title") setScreen("title");
      else if (qaScenario.screen === "intro") openEvent("intro", "map");
      else if (qaScenario.screen === "formation") setScreen("loadout");
      else setScreen("map");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [campaignSave, openEvent, qaScenario, saveHydrated]);

  const togglePause = useCallback(() => {
    const g = gameRef.current;
    if (!g.running || g.over) return;
    g.paused = !g.paused; setPaused(g.paused);
    if (g.paused) {
      g.battleBarks = createBattleBarkRuntime() as BattleBarkRuntime;
      setHud((current) => ({ ...current, battleBarks: [] }));
      stopMusic(); stopJingle(); stopSfx();
    } else if (!bgmMuted) startMusic();
  }, [bgmMuted, startMusic, stopJingle, stopMusic, stopSfx]);

  const toggleBgm = useCallback(() => {
    const next = !bgmMuted; setBgmMuted(next);
    setCampaignSave((current) => ({ ...current, settings: { ...current.settings, bgmEnabled: !next } }));
    if (next) stopMusic(); else if (started && !paused && !end) startMusic();
  }, [bgmMuted, end, paused, startMusic, started, stopMusic]);

  const toggleSfx = useCallback(() => {
    const next = !sfxMutedRef.current;
    sfxMutedRef.current = next;
    setSfxMuted(next);
    setCampaignSave((current) => ({ ...current, settings: { ...current.settings, sfxEnabled: !next } }));
    if (next) { stopJingle(); stopSfx(); }
  }, [stopJingle, stopSfx]);

  const setTactic = useCallback((tactic: TacticMode) => {
    const g = gameRef.current;
    if (!g.running || g.paused || g.over || g.tactic === tactic) return;
    g.tactic = tactic;
    g.banner = `作戦方針 // ${tactic === "defend" ? "防衛" : tactic === "assault" ? "突撃" : "均衡"}`;
    g.bannerTime = .9;
    setHud((current) => ({ ...current, tactic }));
    playCue(tactic === "defend" ? "tactic-defend" : tactic === "assault" ? "tactic-assault" : "tactic-balanced");
  }, [playCue]);

  const cycleTactic = useCallback(() => {
    const current = gameRef.current.tactic;
    const modes = TACTIC_MODES as TacticMode[];
    setTactic(modes[(modes.indexOf(current) + 1) % modes.length]);
  }, [setTactic]);

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
      if (normalizedKey === "r") cycleTactic();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [chooseActionWithCue, cycleTactic, deployHuman, selectedSupply, togglePause, triggerCrawlerBarrage]);

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
        g.energy = advanceCommand(g.energy, dt);
        g.bannerTime = Math.max(0, g.bannerTime - dt);
        g.flashOverlay = Math.max(0, g.flashOverlay - dt * 2.2);
        g.crawlerHitFlash = Math.max(0, g.crawlerHitFlash - dt);
        g.barricadeHitFlash = Math.max(0, g.barricadeHitFlash - dt);
        g.crawlerHitSfxCooldown = Math.max(0, g.crawlerHitSfxCooldown - dt);
        g.comboTime = Math.max(0, g.comboTime - dt);
        if (g.comboTime <= 0) g.combo = 0;
        for (const card of cards) g.deployCooldowns[card.kind] = Math.max(0, g.deployCooldowns[card.kind] - dt);
        g.deployTimer = Math.max(0, g.deployTimer - dt);
        if (g.deployQueue.length && g.deployTimer <= 0) {
          const kind = g.deployQueue.shift();
          if (kind) {
            const deployed = spawnHuman(g, kind);
            g.deployTimer = .45;
            if (deployed) playCue(kind === "brute" ? "deploy-heavy" : "deploy-light");
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
            playCue(includesTakuya ? "boss-warning" : "wave-contact");
            if (includesTakuya) {
              g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.takuyaEntrance);
              emitBattleBark(g, "takuya-entrance", "ranger", "takuya-entrance");
            } else emitBattleBark(g, "wave-contact", "guide", `wave-${mission.wave}`);
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
          for (const hit of barrage.hits) {
            const fighter = g.fighters.find((candidate) => candidate.id === hit.id);
            if (fighter) { fighter.flash = .16; addDamageText(g, { x: fighter.x, y: fighter.y - 48, value: `掃射 -${hit.damage}`, life: .75, color: "#ffd36d" }); }
          }
          for (const lane of [0, 1, 2] as Lane[]) addParticles(g, 560, activeLaneCenters[lane] - 12, "#e8b354", 8);
          g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.crawlerBarrage); g.flashOverlay = .14; playCue("crawler-barrage");
        }

        for (const object of g.battlefieldObjects) {
          object.hitFlash = Math.max(0, object.hitFlash - dt);
          Object.assign(object, advanceBattlefieldSupply(object, dt));
          if (object.kind === "pod" && object.readyToLand && !object.landingTriggered) {
            const landing = resolveBattlefieldSupplyLanding({ supply: object, fighters: g.fighters, laneCenters: activeLaneCenters });
            Object.assign(object, landing.supply);
            g.fighters = landing.fighters as Fighter[];
            for (const hit of landing.hits) {
              const fighter = g.fighters.find((candidate) => candidate.id === hit.id);
              if (fighter) { fighter.flash = .2; fighter.knock = Math.max(fighter.knock, 10); addDamageText(g, { x: fighter.x, y: fighter.y - 56, value: `着地 -${hit.damage}`, life: .9, color: hit.side === "zombie" ? "#ffd06b" : "#ff8a70" }); }
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

        for (const f of g.fighters) {
          if (f.hp <= 0) continue;
          f.cooldown -= dt; f.supportCooldown -= dt; f.retargetIn = Math.max(0, f.retargetIn - dt); f.spawnGrace = Math.max(0, f.spawnGrace - dt);
          f.flash = Math.max(0, f.flash - dt); f.attack = Math.max(0, f.attack - dt); f.marked = Math.max(0, f.marked - dt); f.step += dt;
          f.abilityCooldown = Math.max(0, f.abilityCooldown - dt);
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
                  victim.hp -= damage; victim.flash = .16; victim.knock = Math.max(victim.knock, 12);
                  g.damageTexts.push({ x: victim.x, y: victim.y - 48, value: String(damage), life: .8, color: "#ff7658" });
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

          if (f.kind === "medic" && f.supportCooldown <= 0) {
            const wounded = g.fighters
              .filter((other) => other.side === "human" && other.id !== f.id && other.hp > 0 && other.hp < other.maxHp && fighterDistance(other, f) <= 108)
              .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
            if (wounded) {
              const healed = Math.min(16, wounded.maxHp - wounded.hp);
              const roleEffect = roleEffectForAction({ unitKind: f.kind, action: "heal", targetKind: wounded.kind }) as RoleEffect | null;
              wounded.hp += healed; f.supportCooldown = 1.55;
              g.damageTexts.push({ x: wounded.x, y: wounded.y - 70, value: `+${Math.ceil(healed)}`, life: .8, color: "#83e0a2" });
              g.damageTexts.push({ x: f.x, y: f.y - 64, value: "救護", life: .7, color: "#9bf0ba" });
              g.shots.push({ x: f.x + 8, y: f.y - 34, tx: wounded.x, ty: wounded.y - 28, life: .32, duration: .32, side: "human", effect: roleEffect ?? undefined });
              addParticles(g, wounded.x, wounded.y - 30, "#69d993", 7);
              if (roleEffect) playCue("role-medic");
              emitBattleBark(g, "role-cue", f.kind, f.id);
            }
          }

          if (f.kind === "medic") {
            const cohesion = (supportCohesion as unknown as (input: { support: Fighter; allies: Fighter[] }) => {
              needsRegroup: boolean; destination: { x: number; y: number; lane: Lane };
            } | null)({ support: f, allies: g.fighters.filter((ally) => ally.side === "human" && ally.hp > 0) });
            if (cohesion?.needsRegroup) {
              const dx = cohesion.destination.x - f.x;
              const dy = cohesion.destination.y - f.y;
              f.x += Math.sign(dx) * Math.min(Math.abs(dx), f.speed * dt);
              f.y += Math.sign(dy) * Math.min(Math.abs(dy), f.laneSpeed * dt);
              f.lane = activeLaneForY(f.y, cohesion.destination.lane);
              f.targetId = null;
              continue;
            }
          }

          let target: Fighter | undefined;
          let objectTarget: BattlefieldObject | undefined;
          let distance = Infinity;
          if (f.side === "human") {
            f.targetObjectId = null;
            const enemies = g.fighters.filter((enemy) => enemy.side === "zombie" && enemy.hp > 0 && enemy.combatReady);
            const locked = f.targetId === null ? undefined : fighterById.get(f.targetId);
            const contact = enemies
              .filter((enemy) => fighterDistance(f, enemy) <= 48)
              .sort((a, b) => fighterDistance(f, a) - fighterDistance(f, b))[0];
            const targetCapacity = (enemy: Fighter) => enemy.kind === "takuya" ? 6 : enemy.kind === "abomination" ? 3 : enemy.kind === "crusher" || enemy.kind === "shade" ? 2 : 1;
            const targetScore = (enemy: Fighter) => autonomousTargetScore({ distance: fighterDistance(f, enemy), claims: targetClaims.get(enemy.id) ?? 0, capacity: targetCapacity(enemy), enemyX: enemy.x, isCurrent: f.targetId === enemy.id }) + roleTargetBias(f.kind, enemy.kind) + tacticTargetBias(g.tactic, enemy.x);
            const best = enemies.reduce<Fighter | undefined>((choice, enemy) => !choice || targetScore(enemy) < targetScore(choice) ? enemy : choice, undefined);
            if (contact) target = contact;
            else if (locked?.side === "zombie" && locked.hp > 0) {
              target = locked;
              if (f.retargetIn <= 0 && best && best.id !== locked.id && targetScore(best) + 34 < targetScore(locked)) target = best;
            } else target = best;
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
            const defenderCapacity = (human: Fighter) => human.kind === "brute" ? 3 : human.kind === "scout" || human.kind === "medic" ? 1 : 2;
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
            }) + (human.kind === "brute" ? -45 : 0);
            const bestInterceptor = availableBlockers.reduce<Fighter | undefined>((choice, human) => {
              return !choice || interceptorScore(human) < interceptorScore(choice) ? human : choice;
            }, undefined);
            const lockedValid = locked?.side === "human" && locked.hp > 0 && availableBlockers.some((human) => human.id === locked.id);
            target = physicalContact ?? (blockingSupply ? undefined : (lockedValid && f.retargetIn > 0 ? locked : bestInterceptor));
            if (!target) objectTarget = blockingSupply ?? contactSupply;
            if (f.retargetIn <= 0 || target?.id !== f.targetId) {
              if (!target && !objectTarget && f.x > 520) {
                const routes: Lane[] = [0, 1, 2];
                f.anchorLane = routes.reduce((bestLane, lane) => {
                  const routeScore = (candidate: Lane) => {
                    const defense = humans
                      .filter((human) => human.x < f.x && Math.abs(human.y - activeLaneCenters[candidate]) <= 34)
                      .reduce((sum, human) => sum + human.hp * .08 + human.damage * 1.2, 0);
                    const congestion = g.fighters.filter((enemy) => enemy.side === "zombie" && enemy.hp > 0 && enemy.combatReady && enemy.anchorLane === candidate).length * 7;
                    const switchCost = Math.abs(f.y - activeLaneCenters[candidate]) * .34;
                    return defense + congestion + switchCost + ((f.id * 7 + candidate * 13) % 11);
                  };
                  return routeScore(lane) < routeScore(bestLane) ? lane : bestLane;
                }, f.anchorLane ?? f.lane);
              }
              f.retargetIn = .52 + (f.variant % 3) * .08;
            }
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
              candidates: g.fighters.filter((candidate) => candidate.side !== f.side && candidate.hp > 0 && candidate.combatReady),
              damage: f.damage,
              hasLineOfSight: (attacker, candidate) => hasAdjacentLaneLineOfSight({
                attacker,
                target: candidate,
                blockers: [...g.fighters, ...g.battlefieldObjects],
              }),
              targetPriority: (candidate: Fighter) => candidate.id === target?.id ? -10 : 0,
            });
            target = transaction?.target as Fighter | undefined;
            distance = target ? fighterDistance(f, target) : Infinity;
            if (target) f.targetId = transaction?.targetId ?? target.id;
          }
          if (
            f.side === "human" && g.barricadeVulnerable && target &&
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
          const zombieTargetX = f.side === "zombie" ? (target?.x ?? objectTarget?.x) : undefined;
          const zombieTargetFloor = zombieTargetX !== undefined && zombieTargetX <= f.x ? zombieTargetX : null;
          const baseDistance = f.side === "human" ? (g.barricadeVulnerable ? BARRICADE_X - f.x : Infinity) : f.x - BASE_X;
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
                  priority: f.kind === "takuya" ? 94 : 64,
                  cooldownMs: 150,
                  maxInstances: 3,
                  fallbackCue: "melee-hit",
                });
                g.damageTexts.push({ x: objectTarget.x, y: objectTarget.y - 58, value: `-${Math.round(f.damage)}`, life: .65, color: "#ff9a70" });
                addParticles(g, objectTarget.x + 24, objectTarget.y - 18, "#9aa58d", f.kind === "takuya" || f.kind === "crusher" ? 9 : 4);
                if (f.kind === "spitter") g.shots.push({ x: f.x - 14, y: f.y - 32, tx: objectTarget.x, ty: objectTarget.y - 22, life: .12, side: "zombie" });
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
              f.x = Math.max(stopX, f.x - f.speed * dt);
              const routeY = activeLaneCenters[f.anchorLane ?? f.lane];
              const dy = routeY - f.y;
              if (Math.abs(dy) > 2) f.y += Math.sign(dy) * Math.min(Math.abs(dy), f.laneSpeed * dt);
              f.y = Math.max(activeLaneCenters[0], Math.min(activeLaneCenters[2], f.y));
              f.lane = activeLaneForY(f.y, f.lane);
            }
          } else if (target && distance <= f.range + target.bodyRadius) {
            if (f.cooldown <= 0) {
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
              const attackDamage = f.side === "human" ? f.damage * humanAttackMultiplier(f.kind, target.kind, targetHpRatio, target.marked > 0) : f.damage;
              target.hp -= attackDamage; target.flash = .12;
              if (f.side === "human") {
                playProductionCue(weaponCueForUnit(f.kind), f.x, {
                  priority: f.kind === "gunner" || f.kind === "brute" ? 74 : 64,
                  cooldownMs: f.kind === "gunner" ? 45 : 70,
                  maxInstances: 5,
                  fallbackCue: ["ranger", "gunner", "medic"].includes(f.kind) ? "ranged-shot" : "melee-hit",
                });
                if (Math.random() < .34) playProductionCue(humanVoiceCueForUnit(f.kind, "attack"), f.x, {
                  priority: 67,
                  cooldownMs: 320,
                  volume: f.kind === "brute" || f.kind === "brawler" ? .92 : .78,
                  maxInstances: 2,
                });
                if (target.side === "zombie" && Math.random() < .48) playProductionCue(enemyVoiceCue(target.kind, "hurt"), target.x, {
                  priority: target.kind === "takuya" ? 88 : 62,
                  cooldownMs: 210,
                  maxInstances: 3,
                });
              } else {
                playProductionCue(enemyVoiceCue(f.kind, "attack"), f.x, {
                  priority: f.kind === "takuya" ? 94 : 65,
                  cooldownMs: 160,
                  maxInstances: 3,
                  fallbackCue: f.kind === "spitter" ? "ranged-shot" : "melee-hit",
                });
                if (target.side === "human" && Math.random() < .5) playProductionCue(humanVoiceCueForUnit(target.kind, "hurt"), target.x, {
                  priority: 72,
                  cooldownMs: 300,
                  volume: target.kind === "brute" || target.kind === "brawler" ? .94 : .8,
                  maxInstances: 2,
                });
              }
              if (f.kind === "scout" && target.side === "zombie") target.marked = Math.max(target.marked, 3.2);
              target.knock = f.kind === "brute" || f.kind === "abomination" || f.kind === "takuya" ? 9 : 3;
              f.attack = .18; f.cooldown = enragedTakuya ? .9 : f.attackEvery;
              g.damageTexts.push({ x: target.x + (Math.random() - .5) * 10, y: target.y - 45, value: String(Math.round(attackDamage)), life: .65, color: f.side === "human" ? "#f6d278" : "#e98a72" });
              if (roleEffect && f.abilityCooldown <= 0) {
                const roleCue = roleEffect === "scout" ? "索敵マーク" : roleEffect === "ranger" ? "対・毒吐き" : roleEffect === "brute" ? "前線保持" : roleEffect === "brawler" ? "フィニッシュ" : roleEffect === "gunner" ? "重装破砕" : null;
                if (roleCue) { g.damageTexts.push({ x: f.x, y: f.y - 66, value: roleCue, life: .75, color: "#ffe078" }); f.abilityCooldown = 1.8; emitBattleBark(g, "role-cue", f.kind, f.id); }
              }
              if (f.kind === "takuya") {
                for (const splash of g.fighters) {
                  if (splash.side === "human" && splash.id !== target.id && splash.hp > 0 && fighterDistance(splash, target) < 58) {
                    splash.hp -= 22; splash.flash = .12; splash.knock = 6;
                    g.damageTexts.push({ x: splash.x, y: splash.y - 46, value: "22", life: .65, color: "#e98a72" });
                  }
                }
                addParticles(g, target.x, target.y + 2, "#b78656", 13); playCue("takuya-hit");
              }
              if (f.side === "human") {
                const emphasized = roleEffect === "brawler" || roleEffect === "gunner";
                const ranged = ["ranger", "gunner", "medic"].includes(f.kind);
                g.shots.push({ x: f.x + 14, y: f.y - 32, tx: target.x, ty: target.y - 28, life: .26, duration: .26, side: "human", effect: roleEffect ?? undefined, emphasized, style: ranged ? "projectile" : "melee" });
                if (roleEffect) playCue(`role-${roleEffect}` as SfxCueId);
                if (!productionMixerRef.current) {
                  if (["ranger", "gunner", "medic"].includes(f.kind)) playCue("ranged-shot", { frequency: 310 + Math.random() * 50 });
                  else playCue("melee-hit");
                }
              } else if (f.kind === "spitter") {
                g.shots.push({ x: f.x - 14, y: f.y - 32, tx: target.x, ty: target.y - 28, life: .12, side: "zombie" });
                if (!productionMixerRef.current) playCue("ranged-shot", { frequency: 205 });
              } else {
                addParticles(g, target.x, target.y - 18, target.kind === "takuya" || target.kind === "shade" ? "#b98a62" : target.side === "zombie" ? "#8aa66a" : "#c06d51", 3);
                if (!productionMixerRef.current && f.kind !== "takuya") playCue("melee-hit");
              }
            }
          } else if (!target && baseDistance <= f.range + 10) {
            if (f.cooldown <= 0) {
              if (f.side === "human") {
                const beforeHit = g.barricadeHp;
                const roleEffect = roleEffectForAction({ unitKind: f.kind, action: "structure", targetKind: "infected-base" }) as RoleEffect | null;
                const structureDamage = f.damage * structureDamageMultiplier(f.kind, g.tactic);
                g.barricadeHp = Math.max(0, g.barricadeHp - structureDamage);
                playProductionCue(weaponCueForUnit(f.kind), f.x, {
                  priority: f.kind === "brute" || f.kind === "gunner" ? 76 : 64,
                  cooldownMs: f.kind === "gunner" ? 45 : 75,
                  maxInstances: 5,
                  fallbackCue: f.kind === "brute" ? "structure-heavy" : "structure-light",
                });
                g.barricadeHitFlash = .2;
                g.barricadeHitY = f.y;
                g.damageTexts.push({ x: WORLD_GEOMETRY.barricade.drawX + 10, y: f.y - 38, value: `-${Math.round(structureDamage)}`, life: .7, color: "#ffd06b" });
                addParticles(g, WORLD_GEOMETRY.barricade.drawX + 4, f.y - 18, "#e78b45", f.kind === "brute" ? 10 : 5);
                if (["ranger", "gunner", "medic"].includes(f.kind)) {
                  g.shots.push({ x: f.x + 14, y: f.y - 32, tx: WORLD_GEOMETRY.barricade.drawX + 8, ty: f.y - 24, life: .12, side: "human" });
                }
                if (roleEffect) {
                  g.shots.push({ x: f.x + 14, y: f.y - 32, tx: WORLD_GEOMETRY.barricade.drawX + 8, ty: f.y - 24, life: .26, duration: .26, side: "human", effect: roleEffect, emphasized: true, style: "melee" });
                  playCue("role-brute");
                }
                if (!g.barricadeBucklingAnnounced && beforeHit > g.barricadeMaxHp * .7 && g.barricadeHp <= g.barricadeMaxHp * .7) {
                  g.barricadeBucklingAnnounced = true; g.banner = "感染拠点 // 損傷"; g.bannerTime = 1.5; playCue("base-damaged");
                }
                if (!g.barricadeCriticalAnnounced && beforeHit > g.barricadeMaxHp * .35 && g.barricadeHp <= g.barricadeMaxHp * .35) {
                  g.barricadeCriticalAnnounced = true; g.banner = "感染拠点 // 大破"; g.bannerTime = 1.7; g.flashOverlay = Math.max(g.flashOverlay, .12); playCue("base-critical");
                }
                playCue(f.kind === "brute" ? "structure-heavy" : "structure-light");
              } else {
                const beforeHit = g.baseHp;
                const siegeDamage = crawlerSiegeDamage(f.damage, g.phase);
                g.baseHp = Math.max(0, g.baseHp - siegeDamage);
                playProductionCue(enemyVoiceCue(f.kind, "attack"), f.x, {
                  priority: f.kind === "takuya" ? 94 : 66,
                  cooldownMs: 170,
                  maxInstances: 3,
                  fallbackCue: f.kind === "takuya" ? "takuya-slam" : "structure-light",
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
            const humanLimit = advanceLimitFor(g.tactic, g.phase, g.barricadeVulnerable);
            const dx = target.x - f.x; const dy = target.y - f.y;
            const stoppingDistance = Math.max(18, f.range + target.bodyRadius * .55);
            const moveMultiplier = g.tactic === "assault" ? 1.12 : g.tactic === "defend" ? .92 : 1;
            if (f.x > humanLimit + 2) {
              f.x = Math.max(humanLimit, f.x - f.speed * dt * 1.15);
            } else if (Math.abs(dx) > stoppingDistance) {
              const nextX = f.x + Math.sign(dx) * Math.min(Math.abs(dx), f.speed * dt * moveMultiplier);
              f.x = Math.max(MUSTER_X - 8, Math.min(humanLimit, nextX));
            }
            if (Math.abs(dy) > 2) f.y += Math.sign(dy) * Math.min(Math.abs(dy), f.laneSpeed * dt);
            f.y = Math.max(activeLaneCenters[0], Math.min(activeLaneCenters[2], f.y));
            f.lane = activeLaneForY(f.y, f.lane);
          } else if (target && f.side === "zombie") {
            // The CRAWLER remains the objective: enemies advance on their route and only stop for a physical blocker.
            f.x = advanceZombieX({ enemyX: f.x, speed: f.speed * (f.slowMultiplier ?? 1), seconds: dt, burning: false, targetFloor: zombieTargetFloor });
            const routeY = activeLaneCenters[f.anchorLane ?? f.lane];
            const dy = routeY - f.y;
            if (Math.abs(dy) > 2) f.y += Math.sign(dy) * Math.min(Math.abs(dy), f.laneSpeed * dt);
            f.y = Math.max(activeLaneCenters[0], Math.min(activeLaneCenters[2], f.y));
            f.lane = activeLaneForY(f.y, f.lane);
          } else {
            const humanLimit = advanceLimitFor(g.tactic, g.phase, g.barricadeVulnerable);
            const heldAtLine = f.side === "human" && f.x >= humanLimit;
            if (f.side === "human" && f.x > humanLimit + 2) {
              f.x = Math.max(humanLimit, f.x - f.speed * dt * 1.15);
            } else if (!heldAtLine) {
              if (f.side === "human") {
                const moveMultiplier = g.tactic === "assault" ? 1.12 : g.tactic === "defend" ? .92 : 1;
                f.x += f.speed * dt * moveMultiplier;
              } else {
                f.x = advanceZombieX({ enemyX: f.x, speed: f.speed * (f.slowMultiplier ?? 1), seconds: dt, burning: false });
              }
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
            if (f.side === "human") f.x = Math.max(MUSTER_X - 8, f.x);
            else if (zombieTargetFloor !== null) f.x = Math.max(zombieTargetFloor, f.x);
            f.y = Math.max(activeLaneCenters[0], Math.min(activeLaneCenters[2], f.y));
            f.lane = activeLaneForY(f.y, f.lane);
          }
        }

        const dead = g.fighters.filter((fighter) => fighter.hp <= 0);
        for (const fighter of dead) {
          addParticles(g, fighter.x, fighter.y - 15, fighter.kind === "takuya" || fighter.kind === "shade" ? "#c08d62" : fighter.side === "zombie" ? "#7e965e" : "#b0614e", fighter.kind === "takuya" ? 20 : 11);
          if (fighter.side === "human") playProductionCue(humanVoiceCueForUnit(fighter.kind, "death"), fighter.x, {
            priority: 88,
            cooldownMs: 220,
            volume: fighter.kind === "brute" || fighter.kind === "brawler" ? .96 : .86,
            maxInstances: 3,
          });
          else playProductionCue(enemyVoiceCue(fighter.kind, "death"), fighter.x, {
            priority: fighter.kind === "takuya" ? 98 : 82,
            cooldownMs: 180,
            volume: fighter.kind === "takuya" ? 1 : .88,
            maxInstances: 4,
          });
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
              g.barricadeVulnerable = true; g.banner = "TAKUYA撃破 — 感染拠点が露出"; g.bannerTime = 3.4; g.flashOverlay = .3;
              g.shake = triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.takuyaDefeat);
              playCue("takuya-down");
              if (!emitBattleBark(g, "base-exposed", "crawler", "tactical")) emitBattleBark(g, "takuya-down", "crawler", "tactical");
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
          playProductionCue("corpse-burn-loop", corpse.x, {
            priority: 42,
            cooldownMs: 0,
            volume: .7,
            instanceKey: "corpse-burn-loop",
            maxInstances: 3,
            durationSeconds: 1.7,
          });
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
              targetId: null, targetObjectId: null, retargetIn: 0, bodyRadius: bodyRadiusFor("turned"), laneSpeed: enemyLaneSpeedFor("turned"), spawnGrace: generic.riseLockRemaining,
              combatReady: true, gateEntering: false, gateEntrySpeed: 0, combatReadyX: 0,
              marked: 0, abilityCooldown: 0, abilityWindup: 0,
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

        for (const p of g.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 180 * dt; }
        g.particles = g.particles.filter((p) => p.life > 0);
        for (const d of g.damageTexts) { d.life -= dt; d.y -= dt * 23; }
        g.damageTexts = g.damageTexts.filter((d) => d.life > 0);
        for (const shot of g.shots) shot.life -= dt;
        g.shots = g.shots.filter((shot) => shot.life > 0);
        g.particles = capRenderArray(g.particles, "particles") as Particle[];
        g.shots = capRenderArray(g.shots, "shots") as Shot[];
        g.damageTexts = capRenderArray(g.damageTexts, "damageTexts") as DamageText[];

        const bossActiveOrIncoming = g.fighters.some((fighter) => fighter.kind === "takuya" && fighter.hp > 0)
          || g.enemySpawn.pending.some((entry) => entry.kind === "takuya");
        const enragedTakuya = g.fighters.find((fighter) => fighter.kind === "takuya" && fighter.hp > 0 && fighter.hp / fighter.maxHp <= .5);
        if (enragedTakuya && !g.takuyaEnragedAnnounced) {
          g.takuyaEnragedAnnounced = true;
          emitBattleBark(g, "takuya-enraged", "gunner", "takuya-enraged");
        }
        syncMusicMode(bossActiveOrIncoming ? "boss" : g.phase >= 2 || g.baseHp <= 260 ? "danger" : "normal");

        const outcome = battleOutcomeFor(g.definition, g);
        if (outcome) {
          // A simultaneous collapse is a loss: protecting the crawler always remains mandatory.
          g.won = outcome === "won";
          const enemyBaseDestroyed = g.barricadeHp <= 0;
          g.shake = enemyBaseDestroyed ? triggerCameraShake(g.shake, CAMERA_SHAKE_EVENTS.enemyBaseCollapse) : createCameraShakeRuntime();
          g.enemyBaseCollapse = 0;
          emitBattleBark(g, g.won ? "victory" : "defeat", "guide", "tactical");
          g.over = true;
          g.resultPresented = !enemyBaseDestroyed;
          if (!enemyBaseDestroyed) setEnd({ resultId: g.resultId, stageId: g.definition.stageId, won: g.won, time: g.time, wave: g.wave, kills: g.kills, scrap: g.scrap, baseHp: Math.max(0, g.baseHp), baseMaxHp: g.baseMaxHp, maxCombo: g.maxCombo, unitsLost: g.unitsLost });
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
          setEnd({ resultId: g.resultId, stageId: g.definition.stageId, won: g.won, time: g.time, wave: g.wave, kills: g.kills, scrap: g.scrap, baseHp: Math.max(0, g.baseHp), baseMaxHp: g.baseMaxHp, maxCombo: g.maxCombo, unitsLost: g.unitsLost });
        }
      }

      drawWorld(ctx, g, backgroundRef.current, spriteRefs.current, enemyBaseSpriteRef.current);
      if (g.bannerTime > 0 && g.running) {
        ctx.fillStyle = "rgba(15,14,14,.8)"; ctx.fillRect(302, 70, 356, 54);
        ctx.strokeStyle = "#d79647"; ctx.strokeRect(302.5, 70.5, 355, 53);
        ctx.fillStyle = "#f0d2a3"; ctx.font = "bold 19px monospace"; ctx.textAlign = "center";
        ctx.fillText(g.banner, W / 2, 104); ctx.textAlign = "left";
      }
      if (now - lastHudRef.current > 100) {
        lastHudRef.current = now;
        const boss = g.fighters.find((fighter) => fighter.kind === "takuya" && fighter.hp > 0 && fighter.combatReady);
        const nearestEnemyX = g.fighters.reduce((nearest, fighter) => fighter.side === "zombie" && fighter.hp > 0 && fighter.combatReady ? Math.min(nearest, fighter.x) : nearest, Infinity);
        setHud({
          missionType: g.definition.missionType, energy: Math.floor(g.energy), supportGauge: Math.floor(g.supportGauge), scrap: g.scrap, kills: g.kills,
          wave: g.wave, phase: g.phase, baseHp: Math.max(0, g.baseHp), baseMaxHp: g.baseMaxHp,
          barricadeHp: Math.max(0, g.barricadeHp), barricadeMaxHp: g.barricadeMaxHp, barricadeVulnerable: g.barricadeVulnerable, barricadeHitFlash: g.barricadeHitFlash,
          tactic: g.tactic, deployQueue: g.deployQueue.length,
          airstrikePhase: g.airstrike.phase, crawlerPhase: g.crawlerAbility.phase, crawlerCharge: g.crawlerAbility.charge,
          combo: g.combo, bossHp: boss?.hp ?? 0, bossMax: boss?.maxHp ?? 0,
          crawlerHitFlash: g.crawlerHitFlash, threat: crawlerThreatLevel(nearestEnemyX),
          objective: objectiveForBattle(g.definition, g), deployCooldowns: { ...g.deployCooldowns }, battleBarks: [...g.battleBarks.active],
        });
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [chooseAction, playCue, playEndJingle, playProductionCue, stopMusic, stopSfx, syncMusicMode]);

  const healthPct = Math.max(0, hud.baseHp / hud.baseMaxHp * 100);
  const barricadePct = Math.max(0, hud.barricadeHp / hud.barricadeMaxHp * 100);
  const barricadeCondition = barricadeState(hud.barricadeHp) === "BREACHED" ? "破壊" : barricadeState(hud.barricadeHp) === "BREACH IMMINENT" ? "大破" : barricadeState(hud.barricadeHp) === "BUCKLING" ? "損傷" : "健全";
  const bossPct = hud.bossMax ? Math.max(0, hud.bossHp / hud.bossMax * 100) : 0;
  const phaseName = hud.phase === 1 ? "防衛" : hud.phase === 2 ? "前進" : "総攻撃";
  const tacticName = hud.tactic === "defend" ? "防衛" : hud.tactic === "assault" ? "突撃" : "均衡";
  const selectedName = selectedAction?.startsWith("supply:")
    ? supplyDefs[selectedAction.slice("supply:".length) as SupplyKind].name
    : selectedAction === "airstrike" ? "緊急航空支援" : null;
  const combatLocked = !!end || hud.baseHp <= 0 || hud.barricadeHp <= 0;

  return (
    <main className="game-shell" data-screen={screen} data-stage-id={selectedStageId}>
      <section className="game-frame" style={{ "--battlefield-art": `url('${stageVisualFor(selectedStageId)}')` } as CSSProperties} aria-label="西新世紀末物語 ゲーム">
        <canvas ref={canvasRef} width={W} height={H} className={`battlefield ${selectedAction ? "targeting" : ""} ${screen === "battle" ? "active" : "inactive"}`} aria-label="3レーン戦場" aria-hidden={screen !== "battle"} onPointerMove={handleBattlefieldPointerMove} onPointerDown={handleBattlefieldPointer} />
        {(qaMode || qaScenario) && (
          <div className={`qa-badge ${screen === "battle" ? "" : "campaign-qa-badge"}`} role="status">
            {"LOCAL QA // "}{(qaMode ?? qaScenario?.mode ?? "flow").toUpperCase()}{" // 通常セーブ非反映"}
          </div>
        )}
        {screen === "battle" && <>
        {hud.battleBarks.length > 0 && <div className="battle-barks" aria-live="polite" aria-label="戦闘台詞">{hud.battleBarks.map((bark) => <p key={bark.id}><b>{bark.speaker}</b><span>{bark.text}</span></p>)}</div>}

        <div className="top-hud">
          <div className="brand-block"><span className="brand-mark">移</span><div><b>移動拠点</b><small>{selectedStageView.displayName} <em>先行版 0.6.0</em></small></div></div>
          <div className="phase-block"><small>第{hud.phase}段階</small><strong>{phaseName}</strong><em>第{hud.wave}波</em></div>
          <button className={`tactic-cycle ${hud.tactic}`} onClick={cycleTactic} aria-label={`作戦方針を切り替え（現在：${tacticName}）`}><small>方針</small><b>{tacticName}</b><em>R</em></button>
          <button className="icon-btn" onClick={togglePause} aria-label={paused ? "再開" : "一時停止"}>{paused ? "▶" : "Ⅱ"}</button>
          <button className={`icon-btn audio-btn ${musicActive ? "playing" : ""}`} data-playing={musicActive} data-muted={bgmMuted} onClick={toggleBgm} aria-label={bgmMuted ? "音楽を再生" : "音楽をミュート"}><b>{bgmMuted ? "×" : "♫"}</b><small>音楽</small></button>
          <button className="icon-btn audio-btn" data-muted={sfxMuted} onClick={toggleSfx} aria-label={sfxMuted ? "効果音を再生" : "効果音をミュート"}><b>{sfxMuted ? "×" : "効"}</b><small>効果音</small></button>
        </div>

        <div className={`health-hud crawler-health ${healthPct <= 25 ? "critical" : ""} ${hud.crawlerHitFlash > 0 ? "hit" : ""}`}><div><span>移動拠点</span><b>{Math.ceil(hud.baseHp)} / {hud.baseMaxHp}</b></div><i><em style={{ width: `${healthPct}%` }} /></i></div>
        <div className={`health-hud barrier-health ${hud.barricadeVulnerable ? "vulnerable" : "reinforced"} ${hud.barricadeHitFlash > 0 ? "hit" : ""}`}><div><span>{hud.missionType === "timed-defense" ? "救援区域" : "感染拠点"}</span><b>{hud.missionType === "timed-defense" ? "防衛対象外" : hud.barricadeVulnerable ? `${Math.ceil(hud.barricadeHp)} / ${hud.barricadeMaxHp}` : "防護中"}</b></div><i><em style={{ width: `${barricadePct}%` }} /></i>{hud.barricadeVulnerable && <small>{barricadeCondition}</small>}</div>
        {hud.bossMax > 0 && <div className="boss-hud"><div><span>異常感染者 // TAKUYA</span><b>鉄の審判</b></div><i><em style={{ width: `${bossPct}%` }} /></i></div>}
        {started && !end && hud.threat > .55 && <div className={`crawler-alert ${hud.threat > .82 ? "imminent" : ""}`}><b>移動拠点 脅威</b><span>{hud.threat > .82 ? "接触寸前" : "接近中"}</span></div>}

        {selectedAction && started && !paused && !end && <div className="placement-hint">
          <span className="placement-copy"><b>{selectedName}選択中</b><span>戦場タップまたはレーン指定</span><small>再タップ／ESCで解除</small></span>
          <span className="lane-targets" aria-label="レーンを直接指定">
            {([0, 1, 2] as Lane[]).map((lane) => <button key={lane} onClick={() => executeSelectedInLane(lane)} aria-label={`${LANE_NAMES_JA[lane]}レーン中央へ${selectedName}を指定`}>{LANE_NAMES_JA[lane]}</button>)}
          </span>
        </div>}

        <div className="bottom-hud">
          <div className="resource-stack">
            <div className="resource command"><span>指揮</span><strong>{hud.energy}</strong><small>/{COMMAND_MAX}</small><i><em style={{ width: `${hud.energy}%` }} /></i></div>
            <div className="resource rage"><span>支援</span><strong>{hud.supportGauge}</strong><small>/{SUPPORT_GAUGE_MAX}</small><i><em style={{ width: `${hud.supportGauge}%` }} /></i></div>
          </div>

          <div className="combat-deck">
            <div className="unit-cards" aria-label="生存者ユニット">
              {cards.filter((card) => formationKinds.includes(card.kind)).map((card) => {
                const cooldown = Math.ceil(hud.deployCooldowns[card.kind] ?? 0);
                return (
                  <button key={card.kind} className="unit-card" data-kind={card.kind} disabled={!started || paused || hud.energy < card.cost || cooldown > 0 || combatLocked} onClick={() => deployHuman(card.kind)}>
                    <span className="keycap">{card.key}</span><span className="portrait"><i /></span>
                    <span className="card-copy"><b>{card.name}</b><small>{card.desc}</small></span><span className="cost">⚡{card.cost}</span>
                    {cooldown > 0 && <span className="cooldown-mask"><b>{cooldown}</b><small>秒</small></span>}
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
                <span className="support-key">{supplyDefs[selectedSupply].key}</span><b>{supplyDefs[selectedSupply].name}</b><small>{selectedSupply === "pod" ? "着地衝撃＋進路封鎖" : selectedSupply === "drum" ? "タップ／被弾で起爆" : "周辺の味方を継続回復"}</small><em>▰{supplyDefs[selectedSupply].cost}</em>
              </button>
              <button className={`support-btn airstrike ${selectedAction === "airstrike" ? "selected" : ""}`} disabled={!started || paused || hud.supportGauge < AIRSTRIKE_DEF.gaugeCost || hud.airstrikePhase !== "idle" || combatLocked} onClick={() => chooseActionWithCue(selectedAction === "airstrike" ? null : "airstrike")}>
                <span className="support-key">Q</span><b>{hud.airstrikePhase === "idle" ? "緊急航空支援" : "航空支援実行中"}</b><small>通信・照準・飛来・着弾・帰投</small><em>◆{AIRSTRIKE_DEF.gaugeCost}</em>
              </button>
              <button className="support-btn barrage" disabled={!started || paused || hud.crawlerPhase !== "ready" || combatLocked} onClick={triggerCrawlerBarrage}>
                <span className="support-key">G</span><b>{hud.crawlerPhase === "ready" ? "移動拠点一斉掃射" : `再装填 ${Math.round(hud.crawlerCharge * 100)}%`}</b><small>全3レーン固定火器</small><em>⌁</em>
              </button>
            </div>
          </div>
        </div>

        <div className="stats-strip"><span>☠ 撃破 {hud.kills}</span><span>▰ スクラップ {hud.scrap}</span><span className="bay-status">格納庫 {hud.deployQueue}/3</span>{hud.combo > 1 && <span className="combo">×{hud.combo} 連続</span>}<span className="objective">目標：{hud.objective}</span></div>
        {paused && started && !end && <div className="pause-screen"><div><small>作戦一時停止</small><h2>一時停止</h2><button onClick={togglePause}>作戦を再開</button></div></div>}
        </>}
        <CampaignScreens
          screen={screen}
          eventId={eventId}
          stages={stageViews}
          selectedStage={selectedStageView}
          units={unitViews}
          formationKinds={formationKinds}
          supplies={supplyViews}
          selectedSupply={selectedSupply}
          supplyCurrency={campaignSave.supplies}
          result={campaignResult}
          assetsReady={assetsReady}
          assetError={assetError}
          hasCampaignSave={campaignSave.campaignStarted}
          onBegin={beginCampaign}
          onRestartCampaign={restartCampaign}
          onEventComplete={handleEventComplete}
          onSelectStage={selectStage}
          onOpenLoadout={openLoadout}
          onReturnToMap={returnToMap}
          onToggleFormation={toggleFormation}
          onSelectSupply={(kind) => setSelectedSupply(kind as SupplyKind)}
          onStartBattle={requestBattle}
          onRetry={retryBattle}
          onContinueResult={continueResult}
          onResetSave={resetCampaign}
          onReloadAssets={() => window.location.reload()}
        />
      </section>
      <div className="rotate-notice"><span>↻</span><b>スマホを横向きにしてください</b><small>この作戦は横画面に最適化されています</small></div>
    </main>
  );
}
