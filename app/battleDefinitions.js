import { CAMPAIGN_STAGE_BY_ID, CAMPAIGN_STAGE_IDS } from "./campaign.js";
import { BARRICADE_MAX_HP, PREP_SECONDS, battleOutcome, objectiveFor, phaseAt } from "./gameRules.js";

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
});

function unitsForWave(wave) {
  if (Array.isArray(wave.units)) return wave.units.map((unit) => [...unit]);
  return (wave.groups ?? []).flatMap((group) => Array.from({ length: group.count }, (_, index) => [
    group.kind,
    group.lanes[index % group.lanes.length],
  ]));
}

function campaignTimeline(stage) {
  return stage.waves.map((wave, index) => {
    const event = {
      at: PREP_SECONDS + wave.atSeconds,
      wave: wave.waveNumber ?? index + 1,
      label: wave.label ?? `${stage.displayName} // 第${index + 1}波`,
      units: Object.freeze(unitsForWave(wave).map((unit) => Object.freeze(unit))),
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
  const timeline = campaignTimeline(stage);
  return {
    stageId: stage.id,
    displayName: stage.displayName,
    missionType: stage.missionType,
    prepSeconds: PREP_SECONDS,
    baseMaxHp: stage.baseHp,
    starThresholds: stage.starThresholds,
    enemyBaseMaxHp: BARRICADE_MAX_HP,
    enemyBaseMode: isDefense ? "scenery" : "target",
    startsEnemyBaseVulnerable: stage.missionType === "assault",
    bossUnlocksEnemyBase: isTakuya,
    timeline,
    defenseEndAt: isDefense ? PREP_SECONDS + stage.objectiveConfig.durationSeconds : null,
    phaseSchedule: isTakuya ? null : PHASE_SCHEDULES[stage.missionType],
    objective: stage.objective,
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
  if (definition.missionType === "assault") return "感染拠点を破壊";
  return objectiveFor(state.phase, state.barricadeVulnerable);
}

export function battleOutcomeFor(definition, state) {
  if (state.baseHp <= 0) return "lost";
  const baseMaxHp = Number.isFinite(Number(state.baseMaxHp)) && Number(state.baseMaxHp) > 0
    ? Number(state.baseMaxHp)
    : definition.baseMaxHp;
  const clearRatio = definition.starThresholds?.[1] ?? 0;
  const hasClearHp = Number(state.baseHp) / baseMaxHp >= clearRatio;
  if (definition.missionType === "timed-defense") {
    if (state.time < definition.defenseEndAt) return null;
    return hasClearHp ? "won" : "lost";
  }
  const assaultOutcome = battleOutcome(state.baseHp, state.barricadeHp);
  return assaultOutcome === "won" && !hasClearHp ? "lost" : assaultOutcome;
}
