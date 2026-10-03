import assert from "node:assert/strict";
import test from "node:test";

import {
  V100_COMBAT_FX_AUDIT,
  V100_COMBAT_FX_INVENTORY,
  V100_COMBAT_VFX_PROFILES,
  validateV100CombatPresentationInventory,
} from "../app/v100CombatPresentation.js";
import {
  enemyCombatVfxSnapshot,
  enemyVfxProfileFor,
} from "../app/enemyVfxPresentation.js";
import { productionVisualIntegrityInventory } from "../app/visualIntegrityInventory.js";

const V100_ENEMY_KINDS = Object.keys(V100_COMBAT_VFX_PROFILES);

test("V1 combat presentation inventory is complete and production-safe", () => {
  assert.equal(V100_COMBAT_FX_AUDIT.ok, true, V100_COMBAT_FX_AUDIT.errors.join(", "));
  assert.equal(V100_COMBAT_FX_AUDIT.identityErrors.length, 0);
  assert.equal(V100_COMBAT_FX_AUDIT.replaceIncompleteCount, 0);
  assert.equal(V100_COMBAT_FX_INVENTORY.filter(({ productionVisible }) => productionVisible === false).length, 1);
  assert.equal(
    V100_COMBAT_FX_INVENTORY.filter(({ productionVisible, primitive }) => productionVisible !== false && primitive === "debug-marker").length,
    0,
  );
  for (const entry of V100_COMBAT_FX_INVENTORY) {
    assert.deepEqual(entry.causalSequence, ["source", "prep", "travel", "contact", "impact", "target-reaction", "aftermath"]);
  }
});

test("V1 enemy profiles retain identity locks and reach the production VFX owner", () => {
  assert.deepEqual(
    V100_ENEMY_KINDS.map((kind) => enemyVfxProfileFor(kind)?.kind),
    V100_ENEMY_KINDS,
  );
  const president = enemyVfxProfileFor("mugarian-president-mutated");
  assert.equal(president.identityArmCount, 4);
  assert.equal(president.identityHandCount, 4);
  assert.equal(president.giantWeapon, undefined);
  const omega = enemyVfxProfileFor("takuya-omega");
  assert.equal(omega.identityArmCount, 2);
  assert.equal(omega.identityHandCount, 2);
  assert.equal(omega.giantWeapon, true);
  for (const kind of V100_ENEMY_KINDS) {
    const snapshot = enemyCombatVfxSnapshot({ kind, hp: 75, maxHp: 100, attackWindup: true });
    assert.equal(snapshot.kind, kind);
    assert.equal(snapshot.phase, "warning");
    assert.ok(snapshot.soundCue);
    assert.ok(snapshot.movementPuffs >= 1);
    assert.ok(snapshot.hitSparks >= 2);
  }
});

test("visual integrity inventory exposes the same combat audit", () => {
  const inventory = productionVisualIntegrityInventory();
  assert.equal(inventory.combatFxAudit.ok, true);
  assert.equal(inventory.combatFx.length, V100_COMBAT_FX_INVENTORY.length);
  assert.equal(validateV100CombatPresentationInventory({ inventory: inventory.combatFx }).ok, true);
});
