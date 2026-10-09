import { campaignUnitIdToCombatKind } from "./campaign.js";
import { V100_BOSS_BY_ID, V100_UNITS } from "./v100Registry.js";
import { ENEMY_CONTENT } from "./content/enemyCatalog.js";

const amount = value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const counter = value => amount(value) && Number.isInteger(value);
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const enemies = new Map(ENEMY_CONTENT.map(enemy => [enemy.id, enemy]));

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
  return Object.freeze({ wave: report.wave, kills: report.kills, units: Object.freeze(units), ...(bossProgress ? { bossProgress } : {}), ...(lastVehicleHit ? { lastVehicleHit } : {}) });
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
  return normalizeV100BattleReport({ wave: raw.wave, kills: raw.kills, units, bossProgress: raw.bossProgress, lastVehicleHit: raw.lastVehicleHit });
}
