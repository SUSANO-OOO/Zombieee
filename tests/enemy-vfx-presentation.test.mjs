import assert from "node:assert/strict";
import test from "node:test";
import { ENEMY_CONTENT } from "../app/content/enemyCatalog.js";
import {
  ENEMY_PROJECTILE_KINDS,
  ENEMY_PROJECTILE_PRESENTATIONS,
  ENEMY_VFX_PROFILES,
  crawlerCombatVfxSnapshot,
  crawlerWeaponPose,
  enemyAttackCooldownAfterWindup,
  enemyCombatVfxSnapshot,
} from "../app/enemyVfxPresentation.js";
import { COMBAT_WEAPON_ANCHORS } from "../app/combatPresentation.js";

test("every authored enemy has a player-facing VFX role profile", () => {
  assert.deepEqual(
    Object.keys(ENEMY_VFX_PROFILES).sort(),
    ENEMY_CONTENT.map(({ id }) => id).sort(),
  );
  for (const enemy of ENEMY_CONTENT) {
    const profile = ENEMY_VFX_PROFILES[enemy.id];
    assert.equal(profile.kind, enemy.id);
    assert.ok(profile.role);
    assert.ok(profile.accentColor);
    assert.ok(profile.movementPuffs >= 1);
    assert.equal(profile.boss, enemy.spawnClass === "boss");
  }
});

test("every projectile enemy has a named organ anchor and distinct projectile presentation", () => {
  assert.deepEqual(Object.keys(ENEMY_PROJECTILE_PRESENTATIONS), ENEMY_PROJECTILE_KINDS);
  for (const kind of ENEMY_PROJECTILE_KINDS) {
    assert.ok(COMBAT_WEAPON_ANCHORS[kind], `${kind} organ anchor`);
    assert.ok(ENEMY_PROJECTILE_PRESENTATIONS[kind].origin, `${kind} origin name`);
    assert.ok(ENEMY_PROJECTILE_PRESENTATIONS[kind].trail, `${kind} trail`);
    assert.ok(ENEMY_PROJECTILE_PRESENTATIONS[kind].impactRadius >= 10, `${kind} impact`);
  }
});

test("enemy state snapshot separates entry, motion, warning, attack, hit, and low HP", () => {
  const shared = { kind: "resonator", hp: 100, maxHp: 100 };
  assert.equal(enemyCombatVfxSnapshot({ ...shared, combatReady: false, gateEntering: true }).phase, "entry");
  assert.equal(enemyCombatVfxSnapshot({ ...shared, moving: true }).phase, "move");
  assert.equal(enemyCombatVfxSnapshot({ ...shared, attackWindup: true }).phase, "warning");
  assert.equal(enemyCombatVfxSnapshot({ ...shared, attacking: true }).phase, "attack");
  assert.equal(enemyCombatVfxSnapshot({ ...shared, flash: .1, knock: 13 }).phase, "hit-heavy");
  assert.equal(enemyCombatVfxSnapshot({ ...shared, hp: 17 }).critical, true);
});

test("enemy warning wind-up preserves the prior impact-to-impact attack interval", () => {
  for (const attackEvery of [0.85, 1.45, 2.2]) {
    for (const windup of [.14, .22, .32]) {
      const cooldown = enemyAttackCooldownAfterWindup(attackEvery, windup);
      assert.ok(Math.abs(windup + cooldown - attackEvery) < 1e-12);
    }
  }
  assert.equal(enemyAttackCooldownAfterWindup(.1, .2), 0);
});

test("CRAWLER weapon pose keeps turret turn, recoil, and projectile origin on one muzzle", () => {
  const aimed = crawlerWeaponPose({
    weaponX: 100,
    weaponY: 200,
    targetX: 600,
    targetY: 310,
    phase: "firing",
    time: .15,
  });
  assert.ok(aimed.angle > 0 && aimed.angle <= .34);
  assert.ok(aimed.recoil > 0);
  assert.ok(aimed.muzzleX > aimed.pivotX);
  assert.ok(aimed.muzzleY > aimed.pivotY);
  const stored = crawlerWeaponPose({ weaponX: 100, weaponY: 200, phase: "ready" });
  assert.equal(stored.stored, true);
  assert.equal(stored.recoil, 0);
});

test("CRAWLER VFX state remains readable at power-save density", () => {
  const critical = crawlerCombatVfxSnapshot({
    baseHp: 120,
    baseMaxHp: 500,
    doorPhase: "open",
    weaponPhase: "firing",
    hitFlash: .1,
    repairFlash: 1,
    effectDensity: .48,
  });
  assert.equal(critical.critical, true);
  assert.equal(critical.doorLit, true);
  assert.equal(critical.firing, true);
  assert.ok(critical.smokePuffs >= 2);
  assert.ok(critical.sparkCount >= 2);
  assert.ok(critical.repairArcCount >= 2);
});
