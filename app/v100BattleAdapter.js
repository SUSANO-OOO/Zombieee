import { CAMPAIGN_UNITS, campaignUnitIdToCombatKind } from "./campaign.js";
import { PREP_SECONDS } from "./gameRules.js";
import {
  V100_BOSS_BY_ID,
  V100_STAGE_BY_ID,
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

const ENEMY_PACKS = Object.freeze({
  A: ["walker", "runner", "spitter"],
  "A+abomination": ["walker", "runner", "abomination"],
  "A+shade/abomination": ["walker", "shade", "abomination"],
  "A+grappler": ["walker", "grappler", "crusher"],
  "A+ooze/sprinter": ["runner", "ooze", "sprinter"],
  B: ["runner", "spitter", "crusher"],
  "B+shade": ["runner", "shade", "crusher"],
  C: ["spitter", "grappler", "ooze", "sprinter"],
  "D": ["shade", "crusher", "spitter"],
  "D+panther-knife/smg": ["red-panther-knife", "red-panther-smg", "runner"],
  "D+panther-shield/smg": ["red-panther-shield", "red-panther-smg", "crusher"],
  "D+panther-smg/commander": ["red-panther-smg", "red-panther-commander", "shade"],
  "D+panther-shield/smg/commander": ["red-panther-shield", "red-panther-smg", "red-panther-commander"],
  P: ["red-panther-commander", "red-panther-shield", "red-panther-smg"],
  "A-add-waves": ["walker", "shade", "abomination"],
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
  return ENEMY_PACKS[stage.enemyPack]
    ?? (stage.enemyPack.includes("panther") ? ENEMY_PACKS.P : ENEMY_PACKS.A);
}

function bossKindForStage(stage) {
  const boss = stage.firstClearPayload.find((value) => typeof value === "string" && value.startsWith("boss-"));
  return boss ? BOSS_KIND_BY_V100_ID[boss] ?? null : null;
}

function waveUnits(pack, waveNumber, bossKind = null) {
  const offset = Math.max(0, waveNumber - 1) % pack.length;
  const units = [
    pack[offset],
    pack[(offset + 1) % pack.length],
    ...(waveNumber >= 3 ? [pack[(offset + 2) % pack.length]] : []),
  ];
  if (bossKind && waveNumber === 4) units.push(bossKind);
  return units;
}

function phaseScheduleFor(stage, missionType, objective) {
  if (missionType === "timed-defense") {
    const durationSeconds = stage.objectiveId.includes("95s") ? 95 : stage.objectiveId.includes("90s") ? 90 : 100;
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
    return {
      durationSeconds: 135,
      phases: freeze([
        freeze({ at: PREP_SECONDS, phase: 1, label: "護送対象を発進", objective }),
        freeze({ at: PREP_SECONDS + 55, phase: 2, label: "護送経路を確保", objective }),
        freeze({ at: PREP_SECONDS + 105, phase: 3, label: "出口まで護送", objective }),
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
  const objective = MISSION_LABELS[stage.missionType] ?? stage.objectiveId;
  const phase = phaseScheduleFor(stage, missionType, objective);
  const pack = packFor(stage);
  const timeline = [0, 1, 2, 3].map((index) => {
    const wave = index + 1;
    const units = waveUnits(pack, wave, bossKind);
    return freeze({
      at: PREP_SECONDS + index * (missionType === "timed-defense" ? 27 : 24),
      wave,
      label: wave === 4 && bossKind
        ? `警告 // ${V100_BOSS_BY_ID[stage.firstClearPayload.find((value) => value.startsWith("boss-"))]?.displayName ?? bossKind}`
        : `${stage.displayName} // 第${wave}波`,
      units: freeze(units),
      ...(wave === 4 && bossKind ? { bossOnly: false } : {}),
    });
  });
  const baseMaxHp = V100_VEHICLE.baseHp;
  const station = missionType === "escort"
    ? { durationSeconds: phase.durationSeconds, maxIntegrity: 500, startX: 258, endX: 776 }
    : missionType === "sequential-seal"
      ? { powerCount: stage.objectiveId.includes("four") ? 4 : 3 }
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
  if (!support) return "pod";
  if (support.id === "support-healing") return "medical";
  return "drum";
}

export function v100ProductionSessionFor({ save, stageId, resultId, onBattleResult = null }) {
  const formationUnitIds = save?.formationSlots?.filter(Boolean).slice(0, 7) ?? [];
  const formationKinds = v100FormationCombatKinds(formationUnitIds);
  const definition = v100BattleDefinitionFor(stageId);
  const enemyKinds = [...new Set(definition?.timeline?.flatMap((event) => event.units) ?? [])];
  return freeze({
    stageId,
    resultId: resultId ?? `v100:${stageId}:${Date.now()}`,
    displayName: definition?.displayName ?? stageId,
    formationUnitIds: freeze([...formationUnitIds]),
    formationKinds: freeze([...formationKinds]),
    enemyKinds: freeze([...enemyKinds]),
    selectedSupply: v100SupportSupplyFor(save?.equippedSupportId),
    unitLevels: { ...(save?.unitLevels ?? {}) },
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
