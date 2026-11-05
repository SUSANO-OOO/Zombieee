import { campaignUnitIdToCombatKind } from "./campaign.js";
import { V100_BOSS_BY_ID, V100_STAGE_IDS, V100_UNITS } from "./v100Registry.js";
import { ENEMY_CONTENT } from "./content/enemyCatalog.js";
import { V100_MISSION_VEHICLES } from "./v100MissionVehicles.js";
import { V100_DEFENSE_OBJECTIVES } from "./v100DefenseObjectives.js";

const amount = value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const counter = value => amount(value) && Number.isInteger(value);
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const enemies = new Map(ENEMY_CONTENT.map(enemy => [enemy.id, enemy]));

function normalizeDefenseProgress(value) {
  if (!record(value) || !Object.hasOwn(V100_DEFENSE_OBJECTIVES, value.stageId)
    || !amount(value.elapsedSeconds) || !amount(value.durationSeconds) || value.durationSeconds <= 0
    || value.elapsedSeconds > value.durationSeconds) return null;
  return Object.freeze({ stageId: value.stageId, elapsedSeconds: value.elapsedSeconds, durationSeconds: value.durationSeconds });
}

export function v100DefenseResultText(result) {
  const defense = normalizeDefenseProgress(result?.battleReport?.defenseProgress);
  if (result?.won !== false || !defense || defense.stageId !== result.stageId) return null;
  const profile = V100_DEFENSE_OBJECTIVES[defense.stageId];
  const remaining = Math.ceil(defense.durationSeconds - defense.elapsedSeconds);
  const opened = Math.min(profile.recordCount ?? 0, Math.floor(defense.elapsedSeconds / defense.durationSeconds * (profile.recordCount ?? 0) + 1e-9));
  return {
    progress: profile.recordCount ? `収容室 ${opened}/${profile.recordCount}室を開放`
      : `${profile.label}を${Math.floor(defense.elapsedSeconds)}秒維持`,
    detail: remaining > 0 ? `防衛完了まであと${remaining}秒` : "防衛時間は経過・作戦目標は未達",
  };
}

function normalizeEscortProgress(value) {
  if (!record(value) || !Object.hasOwn(V100_MISSION_VEHICLES, value.stageId)
    || !amount(value.progress) || value.progress > 1
    || !amount(value.integrity) || !amount(value.maxIntegrity) || value.maxIntegrity <= 0 || value.integrity > value.maxIntegrity
    || typeof value.failed !== "boolean" || typeof value.completed !== "boolean"
    || (value.failed && value.completed)) return null;
  return Object.freeze({ stageId: value.stageId, progress: value.progress, integrity: value.integrity,
    maxIntegrity: value.maxIntegrity, failed: value.failed, completed: value.completed });
}

export function v100EscortResultText(result) {
  const escort = normalizeEscortProgress(result?.battleReport?.escortProgress);
  if (result?.won !== false || !escort || escort.stageId !== result.stageId) return null;
  const vehicle = V100_MISSION_VEHICLES[escort.stageId];
  const destroyed = escort.failed && escort.integrity === 0;
  return {
    outcome: destroyed ? `${vehicle.targetLabel}が破壊された。${vehicle.count === 3 ? "確保" : "護送"}は失敗だ。` : null,
    progress: escort.progress >= 1 ? `${vehicle.targetLabel}は${vehicle.count === 3 ? "封鎖地点" : "目的地"}に到着`
      : `${vehicle.count === 3 ? "冷蔵車列の確保" : "護送"} ${Math.floor(escort.progress * 100)}%まで到達`,
    advice: destroyed ? vehicle.count === 3 ? "車列を守る味方に加え、攻撃役も早めに出して周囲の敵を倒そう。"
      : "護送役だけに任せず、攻撃役も早めに出して車を守ろう。" : null,
  };
}

function normalizeVehicleHit(value) {
  if (!record(value) || !enemies.has(value.enemyKind) || !amount(value.time) || !amount(value.damage) || value.damage <= 0) return null;
  return Object.freeze({ enemyKind: value.enemyKind, time: value.time, damage: value.damage });
}

export function v100VehicleHitFor({ enemyKind, time, beforeHp, afterHp }) {
  if (!amount(beforeHp) || !amount(afterHp) || afterHp >= beforeHp) return null;
  return normalizeVehicleHit({ enemyKind, time, damage: beforeHp - afterHp });
}

export function v100LastVehicleHitText(result) {
  const hit = normalizeVehicleHit(result?.battleReport?.lastVehicleHit);
  const elapsed = result?.elapsedSeconds;
  if (result?.won !== false || !hit || !amount(elapsed) || hit.time > elapsed || elapsed - hit.time > 5) return null;
  return `${enemies.get(hit.enemyKind).displayName}の攻撃で耐久を${Math.ceil(hit.damage)}失いました（終了${Math.round(elapsed - hit.time)}秒前）。`;
}

function normalizeBossProgress(value) {
  const boss = V100_BOSS_BY_ID[value?.bossId];
  if (!record(value) || !boss || !["not-encountered", "active", "defeated"].includes(value.state)) return null;
  const base = { bossId: boss.id, displayName: boss.displayName, state: value.state };
  if (value.state === "not-encountered") return Object.freeze({ ...base, hp: null, maxHp: null });
  if (!amount(value.hp) || !amount(value.maxHp) || value.maxHp <= 0 || value.hp > value.maxHp
    || (value.state === "defeated" && value.hp !== 0)) return null;
  return Object.freeze({ ...base, hp: value.hp, maxHp: value.maxHp });
}

// Presentation-only measurements. They never determine victory, stars or CAPS.
export function normalizeV100BattleReport(report) {
  if (!record(report) || !counter(report.wave) || !counter(report.kills) || !Array.isArray(report.units) || report.units.length > V100_UNITS.length) return null;
  const units = V100_UNITS.flatMap(unit => {
    const row = report.units.find(entry => entry?.unitId === unit.id);
    return row && [row.damage, row.damageTaken, row.healing].every(amount)
      ? [Object.freeze({ unitId: unit.id, damage: row.damage, damageTaken: row.damageTaken, healing: row.healing })] : [];
  });
  const bossProgress = normalizeBossProgress(report.bossProgress);
  const lastVehicleHit = normalizeVehicleHit(report.lastVehicleHit);
  const escortProgress = normalizeEscortProgress(report.escortProgress);
  const defenseProgress = normalizeDefenseProgress(report.defenseProgress);
  return Object.freeze({ wave: report.wave, kills: report.kills, units: Object.freeze(units), ...(bossProgress ? { bossProgress } : {}), ...(lastVehicleHit ? { lastVehicleHit } : {}), ...(escortProgress ? { escortProgress } : {}), ...(defenseProgress ? { defenseProgress } : {}) });
}

export function v100BattleReportFor(raw) {
  const stats = raw?.unitStats;
  if (!record(stats) || ![stats.damageByUnit, stats.damageTakenByUnit, stats.healingByUnit].every(record)) return null;
  const units = V100_UNITS.flatMap(unit => {
    const kind = campaignUnitIdToCombatKind(unit.id);
    const maps = [stats.damageByUnit, stats.damageTakenByUnit, stats.healingByUnit];
    if (!maps.some(map => Object.hasOwn(map, kind))) return [];
    const values = maps.map(map => Object.hasOwn(map, kind) ? map[kind] : 0);
    if (!values.every(amount)) return [];
    return [{ unitId: unit.id, damage: values[0], damageTaken: values[1], healing: values[2] }];
  });
  const escortProgress = normalizeEscortProgress({ ...raw.missionRuntime, stageId: raw.stageId });
  const defenseProgress = raw.defenseProgress?.stageId === raw.stageId ? normalizeDefenseProgress(raw.defenseProgress) : null;
  return normalizeV100BattleReport({ wave: raw.wave, kills: raw.kills, units, bossProgress: raw.bossProgress, lastVehicleHit: raw.lastVehicleHit, escortProgress, defenseProgress });
}

// A run's measured contribution, not a new grade, currency or permanent record.
// Compare only the last completed win on this same stage. Missing legacy data
// must never turn into a zero-casualty or faster-clear claim.
export function v100BattleMeritsFor(result, previousResult = null) {
  if (!record(result) || result.won !== true || result.objectiveComplete !== true
    || !V100_STAGE_IDS.includes(result.stageId)) return [];
  const previous = record(previousResult) && previousResult.won === true
    && previousResult.objectiveComplete === true && previousResult.stageId === result.stageId
    && typeof previousResult.battleRunId === "string" && previousResult.battleRunId.length > 0
    && typeof result.battleRunId === "string" && result.battleRunId.length > 0
    && previousResult.battleRunId !== result.battleRunId ? previousResult : null;
  const merits = [];
  if (counter(result.unitDeaths) && result.unitDeaths === 0) {
    merits.push({ id: "no-down", title: "戦闘不能なし", detail: previous && counter(previous.unitDeaths) && previous.unitDeaths > 0
      ? `前回${previous.unitDeaths}回 → 今回0回` : "仲間を倒されずに目標達成" });
  } else if (previous && counter(result.unitDeaths) && counter(previous.unitDeaths)
    && result.unitDeaths < previous.unitDeaths) {
    merits.push({ id: "fewer-downs", title: "戦闘不能を減らした", detail: `前回${previous.unitDeaths}回 → 今回${result.unitDeaths}回` });
  }
  if (previous && amount(previous.elapsedSeconds) && previous.elapsedSeconds > 0
    && amount(result.elapsedSeconds) && result.elapsedSeconds > 0
    && previous.elapsedSeconds - result.elapsedSeconds >= 1) {
    merits.push({ id: "faster-clear", title: "前回より速く突破",
      detail: `前回${Math.round(previous.elapsedSeconds)}秒 → 今回${Math.round(result.elapsedSeconds)}秒` });
  }
  const report = normalizeV100BattleReport(result.battleReport);
  for (const [metric, id, title, suffix] of [["damage", "damage", "攻撃を支えた", "ダメージ"], ["healing", "healing", "回復で支えた", "HP回復"]]) {
    const rows = report?.units ?? [];
    const most = Math.max(0, ...rows.map(unit => unit[metric]));
    if (most < 1) continue;
    const leaders = rows.filter(unit => unit[metric] === most);
    const names = leaders.map(unit => V100_UNITS.find(candidate => candidate.id === unit.unitId).displayName);
    merits.push({ id, title: `${title} ${names.length <= 2 ? names.join("・") : `${names.length}人`}`,
      detail: `${Math.round(most).toLocaleString("ja-JP")} ${suffix}${names.length > 1 ? "ずつ" : ""}${metric === "healing" ? "（自分への回復も含む）" : ""}`,
      unitIds: leaders.map(unit => unit.unitId) });
  }
  return merits;
}
