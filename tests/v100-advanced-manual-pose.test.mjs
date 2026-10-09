import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceManualAbility,
  beginManualAbility,
  createManualAbilityRuntime,
  triggerMusashiCounter,
} from "../app/manualAbilities.js";
import { v100AdvancedManualPose } from "../app/v100AdvancedManualPose.js";
import { v100ScoutApproachStep } from "../app/v100ScoutApproach.js";

const target = { targetId: 8, x: 260, y: 200, lane: 1 };

function start(kind, extra = {}, abilityTarget = target) {
  const begun = beginManualAbility({ ...createManualAbilityRuntime(kind), ...extra }, abilityTarget);
  assert.equal(begun.ok, true);
  return begun.runtime;
}

test("scout and tky use their authored impact recovery cells then idle", () => {
  for (const kind of ["scout", "tky"]) {
    let runtime = start(kind);
    assert.equal(v100AdvancedManualPose(runtime).spriteState, kind === "tky" ? "attack-b" : "attack-a");
    const impact = advanceManualAbility(runtime, runtime.windupRemaining);
    runtime = impact.runtime;
    assert.equal(runtime.phase, "recovery");
    assert.equal(v100AdvancedManualPose(runtime).spriteState, kind === "tky" ? "attack-a" : "attack-b");
    runtime = advanceManualAbility(runtime, .1).runtime;
    assert.equal(v100AdvancedManualPose(runtime).spriteState, "idle");
    const pose = v100AdvancedManualPose(runtime).pose;
    assert.deepEqual(pose, { offsetX: 0, offsetY: 0, rotationRadians: 0, scaleX: 1, scaleY: 1, opacity: 1, movement: false, bodyScale: 1 });
    assert.equal(Object.values(pose).every((value) => typeof value === "boolean" || Number.isFinite(value)), true);
  }
});

test("scout approach splits the windup boundary and never changes invalid targets", () => {
  const scoutTarget = { id: 8, targetId: 8, side: "zombie", hp: 100, combatReady: true, x: 260, y: 200, lane: 1, bodyRadius: 10, direction: 1 };
  const runtime = start("scout", {}, scoutTarget);
  const owner = { kind: "scout", hp: 100, combatReady: true, x: 100, y: 160, bodyRadius: 12, manualAbility: { ...runtime, targetId: scoutTarget.id } };
  assert.equal(v100ScoutApproachStep(owner, scoutTarget, .05), null);
  const crossing = v100ScoutApproachStep(owner, scoutTarget, .12);
  assert.ok(crossing && crossing.x > owner.x && crossing.x < 216);
  assert.equal(crossing.direction, 1);
  const crossedTarget = { ...scoutTarget, x: 80 };
  const fixedDirection = v100ScoutApproachStep({ ...owner, manualAbility: { ...owner.manualAbility, windupRemaining: .12 } }, crossedTarget, .12);
  assert.equal(fixedDirection.direction, 1);
  assert.equal(fixedDirection.x, 36);
  const landed = v100ScoutApproachStep({ ...owner, manualAbility: { ...owner.manualAbility, windupRemaining: .12 } }, scoutTarget, .12);
  assert.deepEqual(landed, { x: 216, y: 200, lane: 1, direction: 1 });
  assert.equal(v100ScoutApproachStep(owner, { ...scoutTarget, id: 9 }, .12), null);
  assert.equal(v100ScoutApproachStep({ ...owner, hp: 0 }, scoutTarget, .12), null);
  assert.equal(v100ScoutApproachStep(owner, { ...scoutTarget, x: Number.NaN }, .12), null);
  assert.deepEqual(owner, { kind: "scout", hp: 100, combatReady: true, x: 100, y: 160, bodyRadius: 12, manualAbility: owner.manualAbility });
});

test("scout uses authored walk alternation only in the final .18 seconds", () => {
  const runtime = start("scout");
  assert.equal(v100AdvancedManualPose(runtime).spriteState, "attack-a");
  assert.equal(v100AdvancedManualPose({ ...runtime, windupRemaining: .18 }).spriteState, "walk-a");
  assert.equal(v100AdvancedManualPose({ ...runtime, windupRemaining: .1 }).spriteState, "walk-b");
  assert.equal(v100AdvancedManualPose({ ...runtime, windupRemaining: .03 }).spriteState, "walk-a");
});

test("Mrs Chiha maps four real launches and impacts, then recovery", () => {
  const points = [0, 1, 2, 3].map((index) => ({ ...target, targetId: index + 10, x: 240 + index * 20 }));
  let runtime = start("mrs-chiha", {}, { ...target, points });
  const events = [];
  let sawLaunchAttack = false;
  let sawBetweenLaunchAttack = false;
  for (let step = 0; step < 250 && runtime.phase !== "recovery"; step += 1) {
    const pose = v100AdvancedManualPose(runtime);
    if (runtime.phase === "salvo" && pose?.spriteState === "attack-b") sawLaunchAttack = true;
    if (runtime.phase === "salvo" && pose?.spriteState === "attack-a") sawBetweenLaunchAttack = true;
    const advanced = advanceManualAbility(runtime, .01);
    events.push(...advanced.events);
    runtime = advanced.runtime;
  }
  assert.equal(events.filter((event) => event.type === "launch").length, 4);
  assert.equal(events.filter((event) => event.type === "impact").length, 4);
  assert.equal(sawLaunchAttack, true);
  assert.equal(sawBetweenLaunchAttack, true);
  assert.equal(runtime.phase, "recovery");
  assert.equal(v100AdvancedManualPose(runtime).spriteState, "attack-a");
  runtime = advanceManualAbility(runtime, .18).runtime;
  assert.equal(v100AdvancedManualPose(runtime).spriteState, "idle");
});

test("ready, cooldown, dead, unsupported, and invalid runtimes return null", () => {
  assert.equal(v100AdvancedManualPose(createManualAbilityRuntime("scout")), null);
  assert.equal(v100AdvancedManualPose({ ...createManualAbilityRuntime("scout"), activationId: 1, phase: "cooldown", abilityElapsed: 1, windupRemaining: 0 }), null);
  assert.equal(v100AdvancedManualPose({ ...start("tky"), phase: "windup" }, { hp: 0 }), null);
  assert.equal(v100AdvancedManualPose({ ...start("brute") }), null);
  assert.equal(v100AdvancedManualPose({ ...start("scout"), abilityElapsed: Number.NaN }), null);
});

test("tky and Musashi use the authored raised/guard and recovery cells", () => {
  let tky = start("tky");
  assert.equal(v100AdvancedManualPose(tky).spriteState, "attack-b");
  tky = advanceManualAbility(tky, tky.windupRemaining).runtime;
  assert.equal(v100AdvancedManualPose(tky).spriteState, "attack-a");
  let musashi = start("miyamoto-musashi");
  musashi = advanceManualAbility(musashi, musashi.windupRemaining).runtime;
  assert.equal(musashi.phase, "guard");
  assert.equal(v100AdvancedManualPose(musashi).spriteState, "attack-b");
  musashi = advanceManualAbility(musashi, musashi.guardRemaining).runtime;
  assert.equal(musashi.phase, "recovery");
  assert.equal(v100AdvancedManualPose(musashi).spriteState, "attack-a");
  musashi = advanceManualAbility(musashi, .12).runtime;
  assert.equal(v100AdvancedManualPose(musashi).spriteState, "idle");
});

test("Musashi counter enters the same authored recovery window", () => {
  let runtime = start("miyamoto-musashi");
  runtime = advanceManualAbility(runtime, runtime.windupRemaining).runtime;
  const counter = triggerMusashiCounter(runtime);
  assert.equal(counter.ok, true);
  assert.equal(v100AdvancedManualPose(counter.runtime).spriteState, "attack-a");
  const recovered = advanceManualAbility(counter.runtime, .12).runtime;
  assert.equal(v100AdvancedManualPose(recovered).spriteState, "idle");
});

test("Zakimiya holds the bottle, presents it, then returns after impact", () => {
  let runtime = start("zakimiya");
  assert.equal(v100AdvancedManualPose(runtime).spriteState, "attack-a");
  runtime = advanceManualAbility(runtime, .4).runtime;
  assert.equal(runtime.phase, "windup");
  assert.equal(v100AdvancedManualPose(runtime).spriteState, "attack-b");
  runtime = advanceManualAbility(runtime, .161).runtime;
  assert.equal(runtime.phase, "recovery");
  assert.equal(v100AdvancedManualPose(runtime).spriteState, "attack-b");
  runtime = advanceManualAbility(runtime, .1).runtime;
  assert.equal(v100AdvancedManualPose(runtime).spriteState, "idle");
});
