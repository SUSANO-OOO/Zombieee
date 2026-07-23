import { CAMPAIGN_STAGE_BY_ID, CAMPAIGN_STAGE_IDS } from "./campaign.js";
import { BARRICADE_MAX_HP, PREP_SECONDS, battleOutcome, objectiveFor, phaseAt } from "./gameRules.js";
import {
  STATION_MISSION_TYPES,
  stationMissionObjective,
  stationMissionOutcome,
} from "./stationStageMechanics.js";

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

export function createBattleDefinition(stageId) {
  const stage = CAMPAIGN_STAGE_BY_ID[stageId];
  if (!stage) throw new RangeError(`Unknown campaign stage: ${String(stageId)}`);
  const isTakuya = stage.id === CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE;
  const isDefense = stage.missionType === "timed-defense";
  const isStationObjective = stage.missionType === STATION_MISSION_TYPES.ESCORT
    || stage.missionType === STATION_MISSION_TYPES.SEQUENTIAL_SEAL;
  const timeline = campaignTimeline(stage);
  return {
    stageId: stage.id,
    displayName: stage.displayName,
    missionType: stage.missionType,
    prepSeconds: PREP_SECONDS,
    baseMaxHp: stage.baseHp,
    starThresholds: stage.starThresholds,
    enemyBaseMaxHp: BARRICADE_MAX_HP,
    enemyBaseMode: isDefense || isStationObjective ? "scenery" : "target",
    startsEnemyBaseVulnerable: stage.missionType === "assault",
    bossUnlocksEnemyBase: isTakuya,
    timeline,
    defenseEndAt: isDefense ? PREP_SECONDS + stage.objectiveConfig.durationSeconds : null,
    phaseSchedule: isTakuya
      ? null
      : stage.id === CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_PLATFORM
        ? STATION_PLATFORM_ASSAULT_SCHEDULE
        : PHASE_SCHEDULES[stage.missionType],
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
  if (definition.missionType === "timed-defense") {
    const remaining = Math.max(0, Math.ceil(definition.defenseEndAt - Math.max(definition.prepSeconds, state.time)));
    return `救援部隊の撤収まで ${remaining}秒`;
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
  return objectiveFor(state.phase, state.barricadeVulnerable);
}

export function battleOutcomeFor(definition, state) {
  if (state.baseHp <= 0) return "lost";
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
