import test from "node:test";
import assert from "node:assert/strict";
import { MANUAL_ABILITY_REGISTRY, advanceManualAbility, beginManualAbility, createManualAbilityRuntime } from "../app/manualAbilities.js";
import { v100SupportManualPose } from "../app/v100SupportManualPose.js";

const TARGET = { id: 99, x: 100, y: 200, side: "zombie", kind: "walker" };
const KINDS = ["medic", "brute", "engineer"];

test("support manual pose follows each actual ability timeline", () => {
  for (const kind of KINDS) {
    const definition = MANUAL_ABILITY_REGISTRY[kind];
    const started = beginManualAbility(createManualAbilityRuntime(kind), TARGET);
    assert.equal(started.ok, true);
    assert.equal(v100SupportManualPose(started.runtime, definition, { hp: 100 }), "attack-a");

    const impact = advanceManualAbility(started.runtime, definition.windupSeconds);
    assert.equal(impact.events[0]?.type, "impact");
    assert.equal(impact.runtime.phase, "recovery");
    assert.equal(v100SupportManualPose(impact.runtime, definition, { hp: 100 }), "attack-b");

    const attackBWindow = Math.min(.10, definition.recoverySeconds * .65);
    const lateRecovery = advanceManualAbility(impact.runtime, attackBWindow);
    assert.equal(v100SupportManualPose(lateRecovery.runtime, definition, { hp: 100 }), "idle");

    const restored = advanceManualAbility(lateRecovery.runtime, definition.recoverySeconds);
    assert.equal(v100SupportManualPose(restored.runtime, definition, { hp: 100 }), null);
  }
});

test("support pose is fail-closed for dead, cancelled, and unsupported runtimes", () => {
  const definition = MANUAL_ABILITY_REGISTRY.medic;
  const runtime = beginManualAbility(createManualAbilityRuntime("medic"), TARGET).runtime;
  assert.equal(v100SupportManualPose(runtime, definition, { hp: 0 }), null);
  assert.equal(v100SupportManualPose({ ...runtime, phase: "cancelled" }, definition), null);
  assert.equal(v100SupportManualPose({ ...runtime, kind: "brawler" }, definition), null);
  assert.equal(v100SupportManualPose({ ...runtime, phase: "recovery", abilityElapsed: NaN }, definition), null);
});
