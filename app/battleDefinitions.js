import { CAMPAIGN_STAGE_BY_ID, CAMPAIGN_STAGE_IDS } from "./campaign.js";
import { BARRICADE_MAX_HP, PREP_SECONDS, battleOutcome, objectiveFor, phaseAt } from "./gameRules.js";
import { OUTBREAK_MISSION_BY_ID } from "./outbreakMissions.js";
import {
  STATION_MISSION_TYPES,
  stationMissionObjective,
  stationMissionOutcome,
} from "./stationStageMechanics.js";
import { v100BattleDefinitionFor } from "./v100BattleAdapter.js";

const PHASE_SCHEDULES = Object.freeze({
  assault: Object.freeze([
    Object.freeze({ at: 0, phase: 1, label: "侵入路を確保", objective: "感染拠点を破壊" }),
    Object.freeze({ at: 45, phase: 2, label: "商店街中央へ前進", objective: "感染拠点を破壊" }),
    Object.freeze({ at: 80, phase: 3, label: "感染拠点へ総攻撃", objective: "感染拠点を破壊" }),
  ]),
  "timed-defense": Object.freeze([
    Object.freeze({ at: 0, phase: 1, label: "救援部隊を援護", objective: "救援部隊の撤収を援護" }),
    Object.freeze({ at: 65, phase: 2, label: "避難線を維持", objective: "救援部隊の撤収を援護" }),
    Object.freeze({ at: 125, phase: 3, label: "最終防衛", objective: "救援部隊の撤収を援護" }),
  ]),
  escort: Object.freeze([
    Object.freeze({ at: 0, phase: 1, label: "保守台車を発進", objective: "保守台車を護衛" }),
    Object.freeze({ at: 60, phase: 2, label: "汚染区画を突破", objective: "保守台車を護衛" }),
    Object.freeze({ at: 120, phase: 3, label: "出口まで護送", objective: "生存者と物資を出口へ運ぶ" }),
  ]),
  "sequential-seal": Object.freeze([
    Object.freeze({ at: 0, phase: 1, label: "電源1を確保", objective: "三つの電源を順番に起動" }),
    Object.freeze({ at: 62, phase: 2, label: "電源2・3を起動", objective: "三つの電源を順番に起動" }),
    Object.freeze({ at: 120, phase: 3, label: "改札喰いを撃破", objective: "感染流出路を封鎖" }),
  ]),
});

const STATION_PLATFORM_ASSAULT_SCHEDULE = Object.freeze([
  Object.freeze({ at: 0, phase: 1, label: "ホーム入口を確保", objective: "感染拠点を破壊" }),
  Object.freeze({ at: 60, phase: 2, label: "ホーム中央を制圧", objective: "感染拠点を破壊" }),
  Object.freeze({ at: 120, phase: 3, label: "感染拠点へ総攻撃", objective: "感染拠点を破壊" }),
]);

function unitsForWave(wave) {
  if (Array.isArray(wave.units)) {
    return wave.units.map((unit) => String(Array.isArray(unit) ? unit[0] : unit));
  }
  return (wave.groups ?? []).flatMap((group) => (
    Array.from({ length: group.count }, () => String(group.kind))
  ));
}

function campaignTimeline(stage) {
  return stage.waves.map((wave, index) => {
    const event = {
      at: PREP_SECONDS + wave.atSeconds,
      wave: wave.waveNumber ?? index + 1,
      label: wave.label ?? `${stage.displayName} // 第${index + 1}波`,
      units: Object.freeze(unitsForWave(wave)),
    };
    if (wave.bossOnly === true) event.bossOnly = true;
    return Object.freeze(event);
  });
}

function operationPhaseSchedule(stage) {
  const schedule = PHASE_SCHEDULES[stage.missionType];
  if (stage.stageNumber <= 6 || !schedule) return schedule;
  const targetLabel = stage.objectiveConfig?.targetLabel;
  if (stage.missionType === "timed-defense") {
    return Object.freeze([
      Object.freeze({ at: 0, phase: 1, label: `${targetLabel}を防衛`, objective: stage.objective }),
      Object.freeze({ at: 65, phase: 2, label: "防衛線を維持", objective: stage.objective }),
      Object.freeze({ at: 125, phase: 3, label: "最終防衛", objective: stage.objective }),
    ]);
  }
  if (stage.missionType === STATION_MISSION_TYPES.ESCORT) {
    return Object.freeze([
      Object.freeze({ at: 0, phase: 1, label: `${targetLabel}を発進`, objective: stage.objective }),
      Object.freeze({ at: 60, phase: 2, label: "護送経路を確保", objective: stage.objective }),
      Object.freeze({ at: 120, phase: 3, label: `${targetLabel}を出口へ`, objective: stage.objective }),
    ]);
  }
  return schedule;
}

export function createBattleDefinition(stageId, { v100 = false } = {}) {
  if (v100) {
    const v100Definition = v100BattleDefinitionFor(stageId);
    if (v100Definition) return v100Definition;
  }
  const outbreakMission = OUTBREAK_MISSION_BY_ID[stageId] ?? null;
  const stage = CAMPAIGN_STAGE_BY_ID[stageId] ?? outbreakMission;
  if (!stage) throw new RangeError(`Unknown campaign stage: ${String(stageId)}`);
  const isDefense = stage.missionType === "timed-defense";
  const isStationObjective = stage.missionType === STATION_MISSION_TYPES.ESCORT
    || stage.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL;
  const bossUnlocksEnemyBase = !outbreakMission
    && ["assault", "boss-assault"].includes(stage.missionType)
    && Boolean(stage.boss?.enemyKind);
  const timeline = campaignTimeline(stage);
  const outbreakPhaseSchedule = outbreakMission
    ? Object.freeze(timeline.map((event, index) => Object.freeze({
      at: event.at,
      phase: Math.min(3, index + 1),
      label: event.label,
      objective: stage.objective,
    })))
    : null;
  return {
    stageId: outbreakMission?.prerequisiteStageId ?? stage.id,
    operationId: stage.id,
    operationCategory: outbreakMission ? "outbreak" : "campaign",
    displayName: stage.displayName,
    missionType: stage.missionType,
    prepSeconds: PREP_SECONDS,
    baseMaxHp: stage.baseHp,
    starThresholds: stage.starThresholds,
    enemyBaseMaxHp: BARRICADE_MAX_HP,
    enemyBaseMode: outbreakMission || isDefense || isStationObjective ? "scenery" : "target",
    startsEnemyBaseVulnerable: !outbreakMission && stage.missionType === "assault" && !bossUnlocksEnemyBase,
    bossUnlocksEnemyBase,
    bossEnemyKind: stage.boss?.enemyKind ?? null,
    timeline,
    defenseEndAt: isDefense ? PREP_SECONDS + stage.objectiveConfig.durationSeconds : null,
    phaseSchedule: outbreakPhaseSchedule ?? (stage.id === CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE
      ? null
      : stage.id === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM
        ? STATION_PLATFORM_ASSAULT_SCHEDULE
        : operationPhaseSchedule(stage)),
    objective: stage.objective,
    missionConfig: stage.objectiveConfig ?? {},
    rescueCount: Number(stage.objectiveConfig?.rescueCount) || 0,
  };
}

export function phaseForBattle(definition, time) {
  if (!definition.phaseSchedule) return phaseAt(time);
  return definition.phaseSchedule.reduce((phase, entry) => time >= entry.at ? entry.phase : phase, 1);
}

export function phaseBannerForBattle(definition, phase) {
  if (!definition.phaseSchedule) return phase === 2 ? "第2段階 — 感染拠点へ前進" : "第3段階 — 鉄の審判";
  return definition.phaseSchedule.find((entry) => entry.phase === phase)?.label ?? definition.objective;
}

export function objectiveForBattle(definition, state) {
  if (definition.operationCategory === "outbreak") {
    return state.bossDefeated ? "残存感染体を掃討" : definition.objective;
  }
  if (definition.missionType === "timed-defense") {
    const remaining = Math.max(0, Math.ceil(definition.defenseEndAt - Math.max(definition.prepSeconds, state.time)));
    const hudLabel = definition.missionConfig?.hudLabel ?? "救援部隊の撤収";
    return `${hudLabel}まで ${remaining}秒`;
  }
  if (definition.missionType === STATION_MISSION_TYPES.ESCORT
    || definition.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL) {
    return stationMissionObjective(state.stageMission, definition.missionConfig) || definition.objective;
  }
  if (definition.missionType === "assault") {
    return definition.missionConfig?.target === "infected-relay"
      ? "感染中継点を破壊"
      : "感染拠点を破壊";
  }
  if (definition.missionType === "boss-assault") {
    return state.barricadeVulnerable ? "感染核を破壊" : definition.objective;
  }
  return objectiveFor(state.phase, state.barricadeVulnerable);
}

export function battleOutcomeFor(definition, state) {
  if (state.baseHp <= 0) return "lost";
  if (definition.operationCategory === "outbreak") {
    if (state.bossDefeated !== true) return null;
    const livingEnemies = Array.isArray(state.fighters)
      && state.fighters.some((fighter) => (
        fighter?.side === "zombie"
        && Number(fighter?.hp) > 0
        && fighter?.contained !== true
      ));
    const pendingEnemies = Array.isArray(state.enemySpawn?.pending)
      && state.enemySpawn.pending.length > 0;
    const pendingWaves = Number(state.eventIndex) < definition.timeline.length;
    return livingEnemies || pendingEnemies || pendingWaves ? null : "won";
  }
  if (definition.missionType === STATION_MISSION_TYPES.ESCORT
    || definition.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL) {
    const missionOutcome = stationMissionOutcome({ runtime: state.stageMission, baseHp: state.baseHp });
    if (missionOutcome !== "won") return missionOutcome;
    return state.wavesResolved === true ? "won" : null;
  }
  const baseMaxHp = Number.isFinite(Number(state.baseMaxHp)) && Number(state.baseMaxHp) > 0
    ? Number(state.baseMaxHp)
    : definition.baseMaxHp;
  const clearRatio = definition.starThresholds?.[1] ?? 0;
  const hasClearHp = Number(state.baseHp) / baseMaxHp >= clearRatio;
  if (definition.missionType === "timed-defense") {
    if (state.time < definition.defenseEndAt) return null;
    return hasClearHp ? "won" : "lost";
  }
  if (definition.bossUnlocksEnemyBase
    && Number(state.barricadeHp) <= 0
    && (state.bossDefeated !== true || state.barricadeVulnerable !== true)) return null;
  const assaultOutcome = battleOutcome(state.baseHp, state.barricadeHp);
  return assaultOutcome === "won" && !hasClearHp ? "lost" : assaultOutcome;
}
