import { CAMPAIGN_UNITS, campaignUnitIdToCombatKind } from "./campaign.js";
import { PREP_SECONDS } from "./gameRules.js";
import { V100_MISSION_VEHICLES } from "./v100MissionVehicles.js";
import { researchCoreObjective } from "./v100ResearchCore.js";
import { v100EquipmentSnapshot, v100OpeningSupportGauge } from "./v100Equipment.js";
import {
  V100_BOSS_BY_ID,
  V100_STAGE_BY_ID,
  V100_STAGE_IDS,
  V100_VEHICLE,
  v100SupportFor,
} from "./v100Registry.js";

const BOSS_KIND_BY_V100_ID = Object.freeze({
  "boss-takuya": "takuya",
  "boss-gate-eater": "gate-eater",
  "boss-mother": "mother",
  "boss-ooguchi": "ooguchi",
  "boss-kurome": "kurome",
  "boss-gairen": "gairen",
  "boss-futago": "futago",
  "boss-mugarian-president-mutated": "mugarian-president-mutated",
  "boss-takuya-omega": "takuya-omega",
});

// Design Lock 17.5 owns these identities. A missing row must fail closed:
// silently falling back to P previously put SMG units into Stage 24.
const A = Object.freeze(["walker", "runner", "spitter", "crusher"]);
const B = Object.freeze([...A, "grappler", "ooze", "sprinter"]);
const C = Object.freeze([...B, "shade", "abomination"]);
const D = Object.freeze(["resonator", "cagewalker", "spindle", "choir-knot", "pall-manta", "anchor-bloom"]);
const P = Object.freeze(["red-panther-knife", "red-panther-shield", "red-panther-smg", "red-panther-commander"]);
export const V100_ENEMY_PACKS = Object.freeze({
  A, B, C, D, P,
  "A+abomination": Object.freeze([...A, "abomination"]),
  "A+shade/abomination": Object.freeze([...A, "shade", "abomination"]),
  "A+grappler": Object.freeze([...A, "grappler"]),
  "A+ooze/sprinter": Object.freeze([...A, "ooze", "sprinter"]),
  "B+shade": Object.freeze([...B, "shade"]),
  "D+panther-knife/smg": Object.freeze([...D, "red-panther-knife", "red-panther-smg"]),
  "D+panther-shield/smg": Object.freeze([...D, "red-panther-shield", "red-panther-smg"]),
  "D+panther-smg/commander": Object.freeze([...D, "red-panther-smg", "red-panther-commander"]),
  "D+panther-shield/smg/commander": Object.freeze([...D, "red-panther-shield", "red-panther-smg", "red-panther-commander"]),
  "panther-shield/commander": Object.freeze(["red-panther-shield", "red-panther-commander"]),
  "A-add-waves": A,
});

const MISSION_TYPE_MAP = Object.freeze({
  assault: "assault",
  "timed-defense": "timed-defense",
  boss: "boss-assault",
  escort: "escort",
  power: "sequential-seal",
  seal: "sequential-seal",
});

const MISSION_LABELS = Object.freeze({
  assault: "感染拠点を制圧",
  "timed-defense": "防衛線を維持",
  boss: "ボスを撃破",
  escort: "目標を護送",
  power: "電源ノードを順番に起動",
  seal: "封鎖ノードを順番に起動",
});

function freeze(value) {
  return Object.freeze(value);
}

function packFor(stage) {
  const pack = V100_ENEMY_PACKS[stage.enemyPack];
  if (!pack) throw new RangeError(`Unknown V1 enemy pack: ${stage.enemyPack}`);
  return pack;
}

function bossKindForStage(stage) {
  const boss = stage.firstClearPayload.find((value) => typeof value === "string" && value.startsWith("boss-"));
  return boss ? BOSS_KIND_BY_V100_ID[boss] ?? null : null;
}

function stageTimeline(stage, missionType, bossKind) {
  const pack = packFor(stage);
  const bossLabel = V100_BOSS_BY_ID[stage.firstClearPayload.find(value => value.startsWith("boss-"))]?.displayName ?? bossKind;
  if (stage.number === 30) {
    // The boss is the battle's opening threat. Exactly two later A-only
    // reinforcements belong to this operation; no Panther survives its prelude.
    return freeze([
      // bossOnly means "only while an existing boss is alive" in Ashfall's
      // real event consumer; the opening boss must never carry that gate.
      freeze({ at: PREP_SECONDS, wave: 1, label: `警告 // ${bossLabel}`, units: freeze([bossKind]), bossOnly: false }),
      freeze({ at: PREP_SECONDS + 24, wave: 2, label: "最終防衛 // 増援1/2", units: freeze(["walker", "runner"]), addWave: true }),
      freeze({ at: PREP_SECONDS + 48, wave: 3, label: "最終防衛 // 増援2/2", units: freeze(["spitter", "crusher"]), addWave: true }),
    ]);
  }
  const counts = stage.number === 29 ? [2, 2, 3, 3, 3, 3] : [2, 2, 3, 3];
  let cursor = 0;
  return freeze(counts.map((count, index) => {
    const wave = index + 1;
    const units = Array.from({length: count}, () => pack[cursor++ % pack.length]);
    const bossArrives = bossKind && wave === counts.length;
    if (bossArrives) units.push(bossKind);
    return freeze({
      at: PREP_SECONDS + index * (missionType === "timed-defense" ? 27 : missionType === "escort" ? 20 : 24),
      wave,
      label: bossArrives ? `警告 // ${bossLabel}` : stage.number === 29 ? `特級研究中枢 // 精鋭第${wave}/6波` : `${stage.displayName} // 第${wave}波`,
      units: freeze(units),
      ...(bossArrives ? { bossOnly: false } : {}),
    });
  }));
}

function phaseScheduleFor(stage, missionType, objective) {
  if (missionType === "timed-defense") {
    const durationSeconds = Number(stage.objectiveId.match(/perimeter-(\d+)s/u)?.[1]) || 100;
    return {
      durationSeconds,
      phases: freeze([
        freeze({ at: PREP_SECONDS, phase: 1, label: "防衛部隊を展開", objective }),
        freeze({ at: PREP_SECONDS + Math.round(durationSeconds * 0.58), phase: 2, label: "防衛線を維持", objective }),
        freeze({ at: PREP_SECONDS + Math.round(durationSeconds * 0.82), phase: 3, label: "最終防衛", objective }),
      ]),
    };
  }
  if (missionType === "escort") {
    const intercept = V100_MISSION_VEHICLES[stage.id]?.count === 3;
    return {
      durationSeconds: 105,
      phases: freeze([
        freeze({ at: PREP_SECONDS, phase: 1, label: intercept ? "冷蔵車3台を追跡" : "護送対象を発進", objective }),
        freeze({ at: PREP_SECONDS + 42, phase: 2, label: intercept ? "冷蔵車列を包囲" : "護送経路を確保", objective }),
        freeze({ at: PREP_SECONDS + 78, phase: 3, label: intercept ? "封鎖地点で冷蔵車列を確保" : "出口まで護送", objective }),
      ]),
    };
  }
  if (missionType === "sequential-seal") {
    return {
      phases: freeze([
        freeze({ at: PREP_SECONDS, phase: 1, label: "第1ノードを起動", objective }),
        freeze({ at: PREP_SECONDS + 62, phase: 2, label: "封鎖設備を維持", objective }),
        freeze({ at: PREP_SECONDS + 120, phase: 3, label: "感染流出路を封鎖", objective }),
      ]),
    };
  }
  return {
    phases: freeze([
      freeze({ at: PREP_SECONDS, phase: 1, label: "侵入路を確保", objective }),
      freeze({ at: PREP_SECONDS + 38, phase: 2, label: "敵拠点へ前進", objective }),
      freeze({ at: PREP_SECONDS + 76, phase: 3, label: bossKindForStage(stage) ? "異常個体を撃破" : "感染拠点へ総攻撃", objective }),
    ]),
  };
}

/**
 * Converts the V1 registry into the definition consumed by the existing
 * Ashfall simulation. This module owns no simulation state and must remain a
 * pure adapter: the production loop, hit resolution, result timing and UI are
 * still owned by AshfallGame.
 */
export function v100BattleDefinitionFor(stageId) {
  const stage = V100_STAGE_BY_ID[stageId];
  if (!stage) return null;
  const missionType = MISSION_TYPE_MAP[stage.missionType] ?? "assault";
  const bossKind = bossKindForStage(stage);
  const missionVehicle = V100_MISSION_VEHICLES[stageId];
  const objective = stage.number === 29 ? researchCoreObjective(null) : missionVehicle?.count === 3 ? "冷蔵車3台を封鎖地点へ追い込み、停止・確保" : missionVehicle ? `${missionVehicle.targetLabel}を目的地へ護送` : MISSION_LABELS[stage.missionType] ?? stage.objectiveId;
  const phase = phaseScheduleFor(stage, missionType, objective);
  const timeline = stageTimeline(stage, missionType, bossKind);
  const baseMaxHp = V100_VEHICLE.baseHp;
  const station = missionType === "escort"
    ? { durationSeconds: phase.durationSeconds, maxIntegrity: 500, startX: missionVehicle?.count === 3 ? 450 : 258, endX: missionVehicle?.count === 3 ? 650 : 720 }
    : missionType === "sequential-seal"
      ? { powerCount: stage.objectiveId.includes("four") ? 4 : 3, requiresContainment: false }
      : {};
  return freeze({
    stageId,
    operationId: stageId,
    operationCategory: "campaign",
    displayName: stage.displayName,
    missionType,
    prepSeconds: PREP_SECONDS,
    baseMaxHp,
    starThresholds: { 1: 0.01, 2: 0.7, 3: 0.9 },
    enemyBaseMaxHp: 1000,
    enemyBaseMode: missionType === "assault" || missionType === "boss-assault" ? "target" : "scenery",
    startsEnemyBaseVulnerable: missionType === "assault" && !bossKind,
    bossUnlocksEnemyBase: Boolean(bossKind),
    bossEnemyKind: bossKind,
    timeline,
    defenseEndAt: missionType === "timed-defense" ? PREP_SECONDS + phase.durationSeconds : null,
    phaseSchedule: phase.phases,
    objective,
    missionConfig: {
      ...station,
      ...(missionVehicle ? {targetLabel:missionVehicle.targetLabel,vehicleCount:missionVehicle.count,convoyInterception:missionVehicle.count===3} : {}),
      v100StageNumber: stage.number,
      v100ObjectiveId: stage.objectiveId,
      v100EnemyPack: stage.enemyPack,
      target: stage.missionType === "assault" ? "infected-relay" : undefined,
    },
    rescueCount: stage.missionType === "escort" ? 1 : 0,
  });
}

export function v100CombatKindForUnit(unitId) {
  return campaignUnitIdToCombatKind(unitId);
}

export function v100FormationCombatKinds(unitIds, { maxSlots = 7 } = {}) {
  return (Array.isArray(unitIds) ? unitIds : [])
    .map(v100CombatKindForUnit)
    .filter((kind) => typeof kind === "string")
    .slice(0, Math.max(0, Math.floor(Number(maxSlots) || 0)));
}

export function v100SupportSupplyFor(supportId) {
  const support = v100SupportFor(supportId);
  if (!support) return null;
  if (support.id === "support-healing") return "medical";
  return "drum";
}

export function v100ProductionSessionFor({ save, stageId, resultId, onBattleResult = null }) {
  const formationUnitIds = save?.formationSlots?.filter(Boolean).slice(0, 7) ?? [];
  const formationKinds = v100FormationCombatKinds(formationUnitIds);
  const definition = v100BattleDefinitionFor(stageId);
  const enemyKinds = [...new Set(definition?.timeline?.flatMap((event) => event.units) ?? [])];
  const equippedSupportId = v100SupportFor(save?.equippedSupportId)
    && save?.ownedSupportIds?.includes(save.equippedSupportId) ? save.equippedSupportId : null;
  const equipmentSnapshot = v100EquipmentSnapshot(save);
  return freeze({
    stageId,
    resultId: resultId ?? `v100:${stageId}:${Date.now()}`,
    displayName: definition?.displayName ?? stageId,
    formationUnitIds: freeze([...formationUnitIds]),
    formationKinds: freeze([...formationKinds]),
    // Ikura is a rescued radio operator, not a purchasable combat unit.
    barkSpeakerKinds: freeze([...new Set([
      ...(save?.ownedUnitIds ?? []).map(v100CombatKindForUnit).filter(Boolean),
      ...(save?.completedStageIds?.includes(V100_STAGE_IDS[0]) ? ["guide"] : []),
    ])]),
    enemyKinds: freeze([...enemyKinds]),
    selectedSupply: v100SupportSupplyFor(equippedSupportId),
    equippedSupportId,
    unitLevels: { ...(save?.unitLevels ?? {}) },
    settings: freeze({ ...(save?.settings ?? {}) }),
    // Only the owned V1 inventory can affect an external battle.
    equipmentSnapshot,
    initialSupportGauge: v100OpeningSupportGauge(equipmentSnapshot),
    vehicleMaxHp: Math.max(V100_VEHICLE.baseHp, Number(save?.vehicle?.maxHp) || V100_VEHICLE.baseHp),
    ...(typeof onBattleResult === "function" ? { onBattleResult } : {}),
  });
}

export function v100BattleAdapterContract() {
  return freeze({
    owner: "AshfallGame",
    stateOwner: "AshfallGame",
    definitionOwner: "v100BattleAdapter",
    resultOwner: "V100Campaign",
    maxFormationSlots: 7,
    stageCount: 30,
    bossCount: 9,
    duplicateFormationKindsAllowed: true,
  });
}

export const V100_BATTLE_ADAPTER = Object.freeze({
  BOSS_KIND_BY_V100_ID,
  v100BattleDefinitionFor,
  v100CombatKindForUnit,
  v100FormationCombatKinds,
  v100SupportSupplyFor,
  v100ProductionSessionFor,
  v100BattleAdapterContract,
  campaignUnitCount: CAMPAIGN_UNITS.length,
});
