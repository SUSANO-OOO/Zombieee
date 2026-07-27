import { deepFreeze } from "./freeze.js";

export const ENEMY_CONTENT_SCHEMA_VERSION = 1;

export const ENEMY_CONTENT = deepFreeze([
  { id: "walker", displayName: "歩行感染者", aliases: [], aiProfile: "nearest", hp: 86, hpPerWave: 5, speed: 18, damage: 15, range: 25, attackEvery: 1.02, bodyRadius: 11, laneSpeed: 38, abilityPressure: 1, spawnClass: "normal", initialAbilityCooldown: 0 },
  { id: "runner", displayName: "走行感染者", aliases: [], aiProfile: "crawler-priority", hp: 52, hpPerWave: 2, speed: 34, damage: 14, range: 25, attackEvery: .72, bodyRadius: 11, laneSpeed: 64, abilityPressure: 1.12, spawnClass: "normal", initialAbilityCooldown: 0 },
  { id: "spitter", displayName: "吐瀉感染者", aliases: [], aiProfile: "ranged", hp: 72, hpPerWave: 3, speed: 14, damage: 13, range: 122, attackEvery: 1.5, bodyRadius: 11, laneSpeed: 42, abilityPressure: 1.18, spawnClass: "normal", initialAbilityCooldown: 0 },
  { id: "crusher", displayName: "粉砕感染者", aliases: [], aiProfile: "support-object", hp: 210, hpPerWave: 5, speed: 11, damage: 35, range: 27, attackEvery: 1.18, bodyRadius: 16, laneSpeed: 24, abilityPressure: 1.28, spawnClass: "heavy", initialAbilityCooldown: 0 },
  { id: "shade", displayName: "影走り", aliases: [], aiProfile: "backline", hp: 220, hpPerWave: 0, speed: 29, damage: 23, range: 27, attackEvery: .62, bodyRadius: 11, laneSpeed: 64, abilityPressure: 1.35, spawnClass: "normal", initialAbilityCooldown: 0 },
  { id: "abomination", displayName: "大型変異体", aliases: [], aiProfile: "area", hp: 480, hpPerWave: 0, speed: 8, damage: 50, range: 28, attackEvery: 1.18, bodyRadius: 20, laneSpeed: 18, abilityPressure: 1.42, spawnClass: "heavy", initialAbilityCooldown: 0 },
  { id: "turned", displayName: "転化者", aliases: [], aiProfile: "nearest", hp: 95, hpPerWave: 0, speed: 18, damage: 18, range: 25, attackEvery: .88, bodyRadius: 11, laneSpeed: 38, abilityPressure: 1, spawnClass: "normal", initialAbilityCooldown: 0, runtimeGenerated: true },
  { id: "takuya", displayName: "TAKUYA", aliases: [], aiProfile: "summon", hp: 1200, hpPerWave: 0, speed: 9, damage: 58, range: 38, attackEvery: 1.15, bodyRadius: 29, laneSpeed: 32, abilityPressure: 1.55, spawnClass: "boss", initialAbilityCooldown: 4.2 },
  { id: "grappler", displayName: "カラミテ", aliases: [], aiProfile: "grab", hp: 165, hpPerWave: 4, speed: 13, damage: 20, range: 34, attackEvery: 1.12, bodyRadius: 16, laneSpeed: 32, abilityPressure: 1.34, spawnClass: "heavy", initialAbilityCooldown: 2.5 },
  { id: "ooze", displayName: "漏泥", aliases: [], aiProfile: "contamination", hp: 138, hpPerWave: 3, speed: 10, damage: 14, range: 68, attackEvery: 1.45, bodyRadius: 14, laneSpeed: 26, abilityPressure: 1.4, spawnClass: "normal", initialAbilityCooldown: 3 },
  { id: "sprinter", displayName: "走鬼", aliases: [], aiProfile: "charge", hp: 78, hpPerWave: 2, speed: 38, damage: 18, range: 24, attackEvery: .68, bodyRadius: 11, laneSpeed: 82, abilityPressure: 1.38, spawnClass: "normal", initialAbilityCooldown: 2 },
  { id: "gate-eater", displayName: "改札喰い", aliases: [], aiProfile: "base-defense", hp: 1800, hpPerWave: 0, speed: 7, damage: 64, range: 42, attackEvery: 1.32, bodyRadius: 32, laneSpeed: 22, abilityPressure: 1.65, spawnClass: "boss", initialAbilityCooldown: 4 },
  { id: "kurome", displayName: "クロメ", aliases: [], aiProfile: "ranged", hp: 2100, hpPerWave: 0, speed: 8, damage: 36, range: 240, attackEvery: 1.72, bodyRadius: 36, laneSpeed: 28, abilityPressure: 1.72, spawnClass: "boss", initialAbilityCooldown: 3.4, prototypeStatus: "producer-approved" },
  { id: "mother", displayName: "マザー", aliases: [], aiProfile: "summon", hp: 2600, hpPerWave: 0, speed: 5, damage: 38, range: 78, attackEvery: 1.58, bodyRadius: 44, laneSpeed: 16, abilityPressure: 1.86, spawnClass: "boss", initialAbilityCooldown: 3.8, prototypeStatus: "producer-review-required" },
  { id: "ooguchi", displayName: "オオグチ", aliases: [], aiProfile: "charge", hp: 2300, hpPerWave: 0, speed: 13, damage: 74, range: 52, attackEvery: 1.46, bodyRadius: 42, laneSpeed: 48, abilityPressure: 1.9, spawnClass: "boss", initialAbilityCooldown: 3.5, prototypeStatus: "producer-review-required" },
  { id: "gairen", displayName: "ガイレン", aliases: [], aiProfile: "base-defense", hp: 3000, hpPerWave: 0, speed: 4, damage: 52, range: 88, attackEvery: 1.66, bodyRadius: 46, laneSpeed: 14, abilityPressure: 1.92, spawnClass: "boss", initialAbilityCooldown: 4.1, prototypeStatus: "producer-review-required" },
  { id: "futago", displayName: "フタゴ", aliases: [], aiProfile: "area", hp: 2500, hpPerWave: 0, speed: 9, damage: 44, range: 60, attackEvery: 1.22, bodyRadius: 39, laneSpeed: 34, abilityPressure: 1.88, spawnClass: "boss", initialAbilityCooldown: 3.6, prototypeStatus: "producer-review-required" },
  { id: "resonator", displayName: "裂声体", aliases: [], aiProfile: "sonic-cone", hp: 170, hpPerWave: 4, speed: 12, damage: 18, range: 32, attackEvery: 1.2, bodyRadius: 15, laneSpeed: 30, abilityPressure: 1.48, spawnClass: "normal", initialAbilityCooldown: 2.8 },
  { id: "cagewalker", displayName: "骨檻", aliases: [], aiProfile: "living-barricade", hp: 270, hpPerWave: 6, speed: 9, damage: 28, range: 34, attackEvery: 1.34, bodyRadius: 22, laneSpeed: 20, abilityPressure: 1.56, spawnClass: "heavy", initialAbilityCooldown: 2.4 },
  { id: "spindle", displayName: "脊走り", aliases: [], aiProfile: "vault-backline", hp: 122, hpPerWave: 3, speed: 31, damage: 22, range: 27, attackEvery: .76, bodyRadius: 18, laneSpeed: 70, abilityPressure: 1.6, spawnClass: "normal", initialAbilityCooldown: 2.1 },
  { id: "choir-knot", displayName: "百面瘤", aliases: [], aiProfile: "mimic-taunt", hp: 158, hpPerWave: 4, speed: 13, damage: 15, range: 72, attackEvery: 1.38, bodyRadius: 18, laneSpeed: 30, abilityPressure: 1.52, spawnClass: "normal", initialAbilityCooldown: 2.7 },
  { id: "pall-manta", displayName: "皮幕", aliases: [], aiProfile: "projectile-canopy", hp: 238, hpPerWave: 5, speed: 12, damage: 21, range: 31, attackEvery: 1.22, bodyRadius: 24, laneSpeed: 27, abilityPressure: 1.58, spawnClass: "heavy", initialAbilityCooldown: 2.6 },
  { id: "anchor-bloom", displayName: "掌根", aliases: [], aiProfile: "root-support", hp: 214, hpPerWave: 5, speed: 6, damage: 16, range: 36, attackEvery: 1.46, bodyRadius: 23, laneSpeed: 18, abilityPressure: 1.62, spawnClass: "heavy", initialAbilityCooldown: 3 },
]);

export const ENEMY_CONTENT_BY_ID = deepFreeze(Object.fromEntries(
  ENEMY_CONTENT.map((enemy) => [enemy.id, enemy]),
));

export function enemyContentFor(id) {
  return ENEMY_CONTENT_BY_ID[id] ?? null;
}

export function enemyStatsForWave(id, wave = 0) {
  const enemy = enemyContentFor(id);
  if (!enemy) throw new RangeError(`Unknown enemy content: ${String(id)}`);
  const waveNumber = Number.isFinite(wave) ? Math.max(0, wave) : 0;
  return Object.freeze({
    hp: enemy.hp + enemy.hpPerWave * waveNumber,
    speed: enemy.speed,
    damage: enemy.damage,
    range: enemy.range,
    attackEvery: enemy.attackEvery,
  });
}

export function enemyBalanceStatsForWave(id, wave = 1) {
  const enemy = enemyContentFor(id);
  const stats = enemyStatsForWave(id, Math.max(1, wave));
  return Object.freeze({
    ...stats,
    hpPerWave: enemy.hpPerWave,
    abilityPressure: enemy.abilityPressure,
    dps: stats.damage / stats.attackEvery,
  });
}

export function enemyBodyRadiusFor(id) {
  return enemyContentFor(id)?.bodyRadius ?? null;
}

export function enemyLaneSpeedFor(id) {
  return enemyContentFor(id)?.laneSpeed ?? null;
}

export function enemyInitialAbilityCooldownFor(id) {
  return enemyContentFor(id)?.initialAbilityCooldown ?? 0;
}

export function enemySpawnClassFor(id) {
  return enemyContentFor(id)?.spawnClass ?? "normal";
}
