import { campaignUnitIdToCombatKind } from "./campaign.js";
import { V100_UNITS } from "./v100Registry.js";

const amount = value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const counter = value => amount(value) && Number.isInteger(value);
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);

// Presentation-only measurements. They never determine victory, stars or CAPS.
export function normalizeV100BattleReport(report) {
  if (!record(report) || !counter(report.wave) || !counter(report.kills) || !Array.isArray(report.units) || report.units.length > V100_UNITS.length) return null;
  const units = V100_UNITS.flatMap(unit => {
    const row = report.units.find(entry => entry?.unitId === unit.id);
    return row && [row.damage, row.damageTaken, row.healing].every(amount)
      ? [Object.freeze({ unitId: unit.id, damage: row.damage, damageTaken: row.damageTaken, healing: row.healing })] : [];
  });
  return Object.freeze({ wave: report.wave, kills: report.kills, units: Object.freeze(units) });
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
  return normalizeV100BattleReport({ wave: raw.wave, kills: raw.kills, units });
}
