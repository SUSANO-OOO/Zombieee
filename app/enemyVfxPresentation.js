import { ENEMY_CONTENT } from "./content/enemyCatalog.js";

const deepFreeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};

export const ENEMY_PROJECTILE_KINDS = Object.freeze([
  "spitter",
  "ooze",
  "resonator",
  "choir-knot",
]);

export const ENEMY_PROJECTILE_PRESENTATIONS = deepFreeze({
  spitter: {
    id: "acid-spit",
    origin: "mouth",
    color: "#9ad873",
    coreColor: "#d8f19c",
    trail: "glob",
    tailLength: 18,
    impactRadius: 10,
  },
  ooze: {
    id: "mud-ejection",
    origin: "organ",
    color: "#b8c875",
    coreColor: "#e1e5a7",
    trail: "glob",
    tailLength: 16,
    impactRadius: 12,
  },
  resonator: {
    id: "resonance-pulse",
    origin: "throat",
    color: "#d49ca9",
    coreColor: "#f0cad2",
    trail: "sonic",
    tailLength: 22,
    impactRadius: 14,
  },
  "choir-knot": {
    id: "chorus-bolt",
    origin: "face-cluster",
    color: "#ce91b1",
    coreColor: "#f0c7dc",
    trail: "chorus",
    tailLength: 24,
    impactRadius: 13,
  },
});

const ROLE_BY_KIND = Object.freeze({
  walker: "shambler",
  turned: "shambler",
  runner: "pursuer",
  sprinter: "pursuer",
  spindle: "pursuer",
  shade: "ambusher",
  spitter: "projectile",
  ooze: "projectile",
  resonator: "projectile",
  "choir-knot": "projectile",
  crusher: "heavy",
  abomination: "heavy",
  grappler: "controller",
  cagewalker: "controller",
  "pall-manta": "controller",
  "anchor-bloom": "support",
  takuya: "boss",
  "gate-eater": "boss",
  kurome: "boss",
  mother: "boss",
  ooguchi: "boss",
  gairen: "boss",
  futago: "boss",
});

const ROLE_PRESENTATION = deepFreeze({
  shambler: { accentColor: "#b77958", movementPuffs: 1, hitSparks: 2 },
  pursuer: { accentColor: "#d79562", movementPuffs: 3, hitSparks: 2 },
  ambusher: { accentColor: "#a98e91", movementPuffs: 2, hitSparks: 3 },
  projectile: { accentColor: "#bb9a78", movementPuffs: 1, hitSparks: 2 },
  heavy: { accentColor: "#c47d59", movementPuffs: 3, hitSparks: 5 },
  controller: { accentColor: "#b88a78", movementPuffs: 2, hitSparks: 4 },
  support: { accentColor: "#aa7a80", movementPuffs: 1, hitSparks: 3 },
  boss: { accentColor: "#df855e", movementPuffs: 5, hitSparks: 7 },
});

export const ENEMY_VFX_PROFILES = deepFreeze(Object.fromEntries(
  ENEMY_CONTENT.map((enemy) => {
    const role = ROLE_BY_KIND[enemy.id] ?? "shambler";
    return [enemy.id, {
      kind: enemy.id,
      role,
      boss: enemy.spawnClass === "boss",
      projectile: ENEMY_PROJECTILE_PRESENTATIONS[enemy.id] ?? null,
      ...ROLE_PRESENTATION[role],
    }];
  }),
));

export function enemyVfxProfileFor(kind) {
  return ENEMY_VFX_PROFILES[kind] ?? null;
}

export function enemyProjectilePresentationFor(kind) {
  return ENEMY_PROJECTILE_PRESENTATIONS[kind] ?? null;
}

export function enemyAttackCooldownAfterWindup(intendedCooldown, windupSeconds) {
  return Math.max(
    0,
    (Number(intendedCooldown) || 0) - Math.max(0, Number(windupSeconds) || 0),
  );
}

export function enemyCombatVfxSnapshot({
  kind,
  side = "zombie",
  hp = 0,
  maxHp = 1,
  combatReady = true,
  gateEntering = false,
  moving = false,
  attacking = false,
  attackWindup = false,
  flash = 0,
  knock = 0,
  abilityPhase = "idle",
} = {}) {
  const profile = side === "zombie" ? enemyVfxProfileFor(kind) : null;
  if (!profile) return null;
  const hpRatio = Math.max(0, Number(hp) || 0) / Math.max(1, Number(maxHp) || 1);
  const abilityActive = !["idle", "recovery"].includes(String(abilityPhase));
  const phase = !combatReady && gateEntering
    ? "entry"
    : Number(flash) > 0
      ? Number(knock) >= 12 ? "hit-heavy" : "hit-light"
      : abilityActive || attackWindup
        ? "warning"
        : attacking
          ? "attack"
          : moving
            ? "move"
            : "idle";
  return Object.freeze({
    ...profile,
    phase,
    hpRatio,
    lowHp: hpRatio > 0 && hpRatio <= .35,
    critical: hpRatio > 0 && hpRatio <= .18,
    abilityActive,
  });
}

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, Number(value) || 0));

export function crawlerWeaponPose({
  weaponX = 0,
  weaponY = 0,
  targetX = null,
  targetY = null,
  phase = "ready",
  time = 0,
} = {}) {
  const pivotX = Number(weaponX) || 0;
  const pivotY = (Number(weaponY) || 0) - 8;
  const hasTarget = Number.isFinite(Number(targetX)) && Number.isFinite(Number(targetY));
  const rawAngle = hasTarget
    ? Math.atan2(Number(targetY) - pivotY, Number(targetX) - pivotX)
    : 0;
  const angle = clamp(rawAngle, -.34, .34);
  const deployed = ["deploying", "firing", "recovering"].includes(phase);
  const lift = phase === "deploying" ? 7 : phase === "recovering" ? 4 : deployed ? 10 : 0;
  const recoil = phase === "firing" ? 3.5 + (Math.sin(Number(time) * 48) + 1) * 2.25 : 0;
  const barrelLength = 44 - recoil;
  const liftedPivotY = pivotY - lift;
  return Object.freeze({
    angle,
    lift,
    recoil,
    pivotX,
    pivotY: liftedPivotY,
    muzzleX: pivotX + Math.cos(angle) * barrelLength,
    muzzleY: liftedPivotY + Math.sin(angle) * barrelLength,
    deployed,
    stored: !deployed,
  });
}

export function crawlerCombatVfxSnapshot({
  baseHp = 0,
  baseMaxHp = 1,
  doorPhase = "closed",
  doorProgress = 0,
  weaponPhase = "ready",
  hitFlash = 0,
  repairFlash = 0,
  over = false,
  effectDensity = 1,
} = {}) {
  const hpRatio = Math.max(0, Number(baseHp) || 0) / Math.max(1, Number(baseMaxHp) || 1);
  const density = clamp(effectDensity, .25, 1);
  return Object.freeze({
    hpRatio,
    lowHp: hpRatio > 0 && hpRatio <= .52,
    critical: hpRatio > 0 && hpRatio <= .26,
    doorLit: doorPhase !== "closed" || Number(doorProgress) > 0,
    firing: weaponPhase === "firing",
    hit: Number(hitFlash) > 0,
    repairing: Number(repairFlash) > 0,
    stored: over === true || !["deploying", "firing", "recovering"].includes(weaponPhase),
    smokePuffs: hpRatio <= .26 ? Math.max(2, Math.round(6 * density))
      : hpRatio <= .52 ? Math.max(1, Math.round(3 * density))
        : 0,
    sparkCount: Number(hitFlash) > 0 ? Math.max(2, Math.round(7 * density)) : 0,
    repairArcCount: Number(repairFlash) > 0 ? Math.max(2, Math.round(6 * density)) : 0,
  });
}
