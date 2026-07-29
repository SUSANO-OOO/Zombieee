import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  COMBAT_ANIMATION_STATES,
  COMBAT_CLIP_FALLBACKS,
  COMBAT_CLIP_STATES,
  COMBAT_OPTIONAL_CLIP_STATES,
  COMBAT_PRESENTATION_PROFILES,
  COMBAT_WEAPON_ANCHORS,
  REPRESENTATIVE_SIX_KINDS,
  UNIT_WEAPON_PROFILE,
  WEAPON_PROFILE_IDS,
  WEAPON_PROFILES,
  advanceCombatAnimationRuntime,
  advancePendingWeaponHits,
  animationClipFor,
  attackPresentationDuration,
  combatFacingDirection,
  combatWeaponAnchor,
  combatClipEventsBetween,
  combatClipEventsFor,
  createCombatAnimationRuntime,
  mrsChihaLauncherBashDuration,
  sampleAnimationClip,
  sampleAttackPresentation,
  sampleMrsChihaLauncherBash,
  weaponDamageEventsFor,
  weaponProfileForAction,
  weaponProfileForUnit,
} from "../app/combatPresentation.js";
import { manualAbilityDefinitionFor } from "../app/manualAbilities.js";
import { spriteKinds } from "../app/spriteManifest.js";

test("every runtime sprite kind owns all core and optional variable-frame combat clips", () => {
  assert.deepEqual(Object.keys(COMBAT_PRESENTATION_PROFILES), spriteKinds);
  const frameCounts = new Set();
  for (const kind of spriteKinds) {
    const profile = COMBAT_PRESENTATION_PROFILES[kind];
    assert.ok(["small", "standard", "large"].includes(profile.bodyClass));
    assert.deepEqual(Object.keys(profile.clips), COMBAT_ANIMATION_STATES);
    for (const state of COMBAT_ANIMATION_STATES) {
      const clip = animationClipFor(kind, state);
      assert.ok(clip.durationSeconds > 0, `${kind}/${state} duration`);
      assert.ok(clip.frames.length > 0, `${kind}/${state} frames`);
      frameCounts.add(clip.frames.length);
      for (const current of clip.frames) {
        assert.ok(current.durationSeconds > 0, `${kind}/${state} frame duration`);
        assert.match(current.spriteState, /^(?:idle|walk-a|walk-b|attack-a|attack-b|hit|death)$/);
        for (const event of current.events) {
          assert.ok(event.at >= 0 && event.at <= current.durationSeconds, `${kind}/${state}/${event.type} boundary`);
        }
      }
    }
  }
  assert.ok(frameCounts.size >= 3, "clips must not collapse to one fixed frame count");
});

test("optional clip fallbacks preserve hurt, down, and death semantics", () => {
  assert.deepEqual(COMBAT_CLIP_STATES, [
    "idle", "move", "wind-up", "active", "recovery", "hit", "incapacitated", "death", "special",
  ]);
  assert.equal(COMBAT_OPTIONAL_CLIP_STATES.length, 12);
  assert.equal(COMBAT_CLIP_FALLBACKS["hit-light"], "hit");
  assert.equal(COMBAT_CLIP_FALLBACKS["hit-heavy"], "hit");
  assert.equal(COMBAT_CLIP_FALLBACKS.down, "incapacitated");
  for (const kind of spriteKinds) {
    for (const state of ["hit-light", "hit-heavy", "down"]) {
      const spriteStates = animationClipFor(kind, state).frames.map(({ spriteState }) => spriteState);
      assert.equal(spriteStates.some((spriteState) => spriteState.startsWith("attack")), false, `${kind}/${state}`);
    }
    assert.deepEqual(
      animationClipFor(kind, "death").frames.map(({ spriteState }) => spriteState),
      ["death"],
      `${kind}/death`,
    );
  }
});

test("semantic pose transforms keep the authored ground anchor fixed", () => {
  for (const state of COMBAT_OPTIONAL_CLIP_STATES) {
    const current = animationClipFor("walker", state);
    for (const elapsed of [0, current.durationSeconds / 2, current.durationSeconds]) {
      const sample = sampleAnimationClip("walker", state, elapsed);
      assert.equal(sample.groundAnchor, 1, `${state} ground anchor`);
      assert.equal(sample.pose.offsetY, 0, `${state} cannot lift the contact point`);
      assert.ok(sample.pose.scaleX >= .8 && sample.pose.scaleX <= 1.12, `${state} scaleX`);
      assert.ok(sample.pose.scaleY >= .8 && sample.pose.scaleY <= 1.12, `${state} scaleY`);
      assert.ok(Math.abs(sample.pose.rotationRadians) <= .13, `${state} rotation`);
      assert.ok(sample.pose.opacity >= .7 && sample.pose.opacity <= 1, `${state} opacity`);
    }
  }
});

test("event cursor consumes transition and loop events exactly once", () => {
  const started = combatClipEventsBetween("scout", "start-move", 0, .13);
  assert.deepEqual(started.map(({ type }) => type), ["locomotion-start", "footstep"]);
  assert.equal(combatClipEventsBetween("scout", "start-move", .08, .08).length, 0);
  const move = animationClipFor("scout", "move");
  const crossed = combatClipEventsBetween("scout", "move", move.durationSeconds - .01, move.durationSeconds + .08);
  assert.deepEqual(crossed.map(({ type }) => type), ["footstep"]);
  assert.equal(crossed[0].cycle, 1);
});

test("locomotion runtime exposes deploy, start, stop, and turn transitions from real motion", () => {
  let runtime = createCombatAnimationRuntime({ deploying: true, direction: "right", x: 100, y: 200 });
  assert.equal(runtime.state, "deploy");
  runtime = advanceCombatAnimationRuntime(runtime, {
    kind: "scout", deploying: false, direction: "right", x: 102, y: 200,
  }, .05);
  assert.equal(runtime.state, "start-move");
  assert.equal(runtime.moving, true);
  runtime = advanceCombatAnimationRuntime(runtime, {
    kind: "scout", direction: "right", moving: true, x: 108, y: 200,
  }, .2);
  assert.equal(runtime.state, "move");
  runtime = advanceCombatAnimationRuntime(runtime, {
    kind: "scout", direction: "left", moving: true, x: 104, y: 200,
  }, .02);
  assert.equal(runtime.state, "turn");
  assert.equal(runtime.direction, "left");
  runtime = advanceCombatAnimationRuntime(runtime, {
    kind: "scout", direction: "left", moving: false, x: 104, y: 200,
  }, .2);
  assert.equal(runtime.state, "stop-move");
  runtime = advanceCombatAnimationRuntime(runtime, {
    kind: "scout", direction: "left", moving: false, x: 104, y: 200,
  }, .2);
  assert.equal(runtime.state, "idle");
  assert.ok(runtime.transitionCount >= 5);
  assert.ok(runtime.eventCount >= 1);
});

test("runtime event cursor never repeats a state-entry event on the following tick", () => {
  let runtime = createCombatAnimationRuntime({ direction: "right", x: 10, y: 20 });
  runtime = advanceCombatAnimationRuntime(runtime, {
    kind: "scout", direction: "right", x: 14, y: 20,
  }, .01);
  assert.equal(runtime.state, "start-move");
  assert.equal(runtime.eventCount, 1);
  assert.deepEqual(runtime.lastEvents.map(({ type }) => type), ["locomotion-start"]);
  runtime = advanceCombatAnimationRuntime(runtime, {
    kind: "scout", direction: "right", x: 18, y: 20,
  }, .13);
  assert.equal(runtime.state, "start-move");
  assert.equal(runtime.eventCount, 2);
  assert.deepEqual(runtime.lastEvents.map(({ type }) => type), ["footstep"]);
});

test("an initially active deploy clip emits its entry event once", () => {
  let runtime = createCombatAnimationRuntime({
    deploying: true,
    direction: "right",
    x: 10,
    y: 20,
  });
  runtime = advanceCombatAnimationRuntime(runtime, {
    kind: "scout", deploying: true, direction: "right", x: 10, y: 20,
  }, .02);
  assert.equal(runtime.eventCount, 1);
  assert.deepEqual(runtime.lastEvents.map(({ type }) => type), ["deploy-brace"]);
  runtime = advanceCombatAnimationRuntime(runtime, {
    kind: "scout", deploying: true, direction: "right", x: 10, y: 20,
  }, .02);
  assert.equal(runtime.eventCount, 1);
  assert.deepEqual(runtime.lastEvents, []);
});

test("a moving gate entrant completes deploy once and continues with movement instead of sliding idle", () => {
  let runtime = createCombatAnimationRuntime({
    deploying: true,
    direction: "right",
    x: 96,
    y: 285,
  });
  runtime = advanceCombatAnimationRuntime(runtime, {
    kind: "scout", deploying: true, direction: "right", x: 111, y: 285,
  }, .16);
  assert.equal(runtime.state, "deploy");
  assert.equal(runtime.deployCompleted, false);
  runtime = advanceCombatAnimationRuntime(runtime, {
    kind: "scout", deploying: true, direction: "right", x: 128, y: 285,
  }, .17);
  assert.equal(runtime.state, "move");
  assert.equal(runtime.deployCompleted, true);
  assert.equal(runtime.moving, true);
  assert.match(sampleAnimationClip("scout", runtime.state, runtime.elapsedSeconds).spriteState, /^walk-/);
});

test("clip sampling loops movement and clamps one-shot recovery", () => {
  const move = animationClipFor("scout", "move");
  assert.equal(
    sampleAnimationClip("scout", "move", move.durationSeconds + .01).spriteState,
    sampleAnimationClip("scout", "move", .01).spriteState,
  );
  const recovery = animationClipFor("brute", "recovery");
  const final = sampleAnimationClip("brute", "recovery", recovery.durationSeconds + 10);
  assert.equal(final.frameIndex, recovery.frames.length - 1);
  assert.equal(final.bodyScale, 1.12);
});

test("manual abilities recover to an active pose and enemy movement selects the authored facing", () => {
  for (const kind of Object.keys(UNIT_WEAPON_PROFILE)) {
    const specialStates = animationClipFor(kind, "special").frames.map(({ spriteState }) => spriteState);
    assert.equal(specialStates.includes("hit"), false, `${kind} ability cannot use the hurt pose`);
    assert.equal(specialStates.includes("death"), false, `${kind} ability cannot use the defeated pose`);
  }
  assert.equal(combatFacingDirection({ side: "zombie", aiMoveDirection: 1 }), "right");
  assert.equal(combatFacingDirection({ side: "zombie", aiMoveDirection: -1 }), "left");
  assert.equal(combatFacingDirection({ side: "zombie", entryDirection: 1 }), "right");
  assert.equal(combatFacingDirection({ side: "zombie", entryDirection: -1 }), "left");
  assert.equal(combatFacingDirection({
    side: "human",
    aiMoveDirection: 1,
    manualDirection: -1,
    manualAbilityActive: true,
  }), "left");
});

test("machine-gun active clip and damage timeline share three synchronized rounds", () => {
  const active = animationClipFor("gunner", "active");
  assert.equal(active.frames.length, 3);
  assert.deepEqual(
    active.frames.flatMap(({ events }) => events.filter(({ type }) => type === "muzzle").map(({ shotIndex }) => shotIndex)),
    [0, 1, 2],
  );
  const events = weaponDamageEventsFor("gunner", 13);
  assert.equal(events.length, 3);
  assert.deepEqual(events.map(({ offsetSeconds }) => offsetSeconds), [0, .055, .11]);
  assert.deepEqual(
    events.map(({ hitOffsetSeconds }) => Number(hitOffsetSeconds.toFixed(3))),
    [.055, .11, .165],
  );
  assert.deepEqual(events.map(({ travelSeconds }) => travelSeconds), [.055, .055, .055]);
  assert.deepEqual(
    combatClipEventsFor("gunner", "active")
      .filter(({ type }) => type === "hit")
      .map(({ at }) => at),
    events.map(({ hitOffsetSeconds }) => hitOffsetSeconds),
  );
  assert.equal(events.reduce((total, event) => total + event.damage, 0), 13);
  assert.ok(events.every((event) => event.muzzle
    && event.projectile === "burst-tracer"
    && event.casing
    && event.impact === "suppression-spark"
    && event.hitReaction
    && event.hitStopSeconds > 0
    && event.recoil > 0));
  assert.equal(attackPresentationDuration("gunner"), .275);
  assert.equal(sampleAttackPresentation("gunner", .06).state, "active");
  assert.equal(sampleAttackPresentation("gunner", .2).state, "recovery");
});

test("fifteen weapon profiles cover all sixteen playable units without generic missing VFX", () => {
  assert.deepEqual(Object.keys(WEAPON_PROFILES), WEAPON_PROFILE_IDS);
  assert.equal(Object.keys(UNIT_WEAPON_PROFILE).length, 16);
  for (const [kind, profileId] of Object.entries(UNIT_WEAPON_PROFILE)) {
    const profile = WEAPON_PROFILES[profileId];
    assert.ok(profile, `${kind} profile`);
    assert.ok(profile.trail.length > 0);
    assert.ok(profile.impact.length > 0);
    assert.equal(profile.damageWeights.length, profile.shotOffsetsSeconds.length);
    assert.ok(Math.abs(profile.damageWeights.reduce((total, weight) => total + weight, 0) - 1) < 1e-9);
  }
  assert.equal(UNIT_WEAPON_PROFILE.engineer, "suppressed-carbine");
  assert.equal(weaponProfileForAction("engineer", "attack").id, "suppressed-carbine");
  assert.equal(weaponProfileForAction("engineer", "attack").casing, true);
  assert.equal(weaponProfileForAction("engineer", "deploy").id, "deployable");
  assert.equal(weaponProfileForAction("medic", "heal").id, "heal-support");
  assert.equal(weaponProfileForUnit("scout").id, "crowbar");
  assert.equal(weaponProfileForUnit("scout").casing, false);
  assert.equal(weaponProfileForUnit("scout").trail, "hooked-crowbar-arc");
  assert.equal(weaponProfileForAction("tky", "attack").id, "plasma-blade");
  assert.equal(weaponProfileForAction("mrs-chiha", "attack").id, "grenade");
  assert.equal(weaponProfileForAction("miyamoto-musashi", "attack").id, "dual-katana");
  assert.equal(weaponProfileForAction("mayo-chan", "attack").id, "bite");
});

test("all sixteen playable units and every projectile enemy use directional weapon anchors above the lower body", () => {
  const playableKinds = Object.keys(UNIT_WEAPON_PROFILE);
  assert.equal(playableKinds.length, 16);
  for (const kind of playableKinds) assert.ok(COMBAT_WEAPON_ANCHORS[kind], `${kind} weapon anchor`);
  for (const kind of ["spitter", "ooze", "choir-knot", "resonator"]) {
    assert.ok(COMBAT_WEAPON_ANCHORS[kind], `${kind} projectile organ anchor`);
  }
  for (const kind of [...playableKinds, "spitter", "ooze", "choir-knot", "resonator"]) {
    const right = combatWeaponAnchor({ kind, x: 400, y: 220, direction: 1 });
    const left = combatWeaponAnchor({ kind, x: 400, y: 220, direction: -1 });
    assert.equal(right.y, left.y, `${kind} vertical anchor mirrors exactly`);
    assert.ok(right.y <= 196, `${kind} origin cannot be at the waist or feet`);
    assert.equal(Number((right.x - 400).toFixed(6)), Number((400 - left.x).toFixed(6)), `${kind} horizontal anchor mirrors`);
  }
});

test("new playable special clips preserve authored body phases and Mrs. Chiha's normal launcher cycle", () => {
  assert.deepEqual(
    combatClipEventsFor("tky", "special").map(({ type }) => type),
    [
      "light-blade-charge",
      "light-blade-extend",
      "light-blade-sweep",
      "light-blade-release",
      "light-blade-recover",
      "light-blade-ready",
    ],
  );
  assert.deepEqual(
    combatClipEventsFor("mrs-chiha", "special")
      .filter(({ type }) => type === "salvo-shot")
      .map(({ at }) => Number(at.toFixed(2))),
    [1.05, 1.27, 1.49, 1.71],
  );
  assert.equal(
    Number(combatClipEventsFor("mrs-chiha", "special").find(({ type }) => type === "launcher-stow").at.toFixed(2)),
    1.91,
  );
  assert.deepEqual(
    combatClipEventsFor("miyamoto-musashi", "special").map(({ type }) => type),
    ["cross-guard-ready", "cross-guard-hold"],
  );
  assert.deepEqual(
    combatClipEventsFor("mrs-chiha", "active").map(({ type }) => type),
    ["launcher-retrieve", "launcher-aim", "muzzle", "grenade-launch"],
  );
  assert.deepEqual(
    combatClipEventsFor("mrs-chiha", "recovery").map(({ type }) => type),
    ["launcher-stow"],
  );
});

test("the representative six own distinct motion, attack, and manual-ability timelines", () => {
  assert.deepEqual(REPRESENTATIVE_SIX_KINDS, [
    "scout", "gunner", "crazy-king", "tky", "mrs-chiha", "mayo-chan",
  ]);
  const expectedSpecialDurations = {
    scout: .38,
    gunner: .71,
    "crazy-king": .63,
    tky: .78,
    "mrs-chiha": 2.19,
    "mayo-chan": .46,
  };
  const signatures = new Set();
  for (const kind of REPRESENTATIVE_SIX_KINDS) {
    const definition = manualAbilityDefinitionFor(kind);
    const special = animationClipFor(kind, "special");
    const move = animationClipFor(kind, "move");
    const active = animationClipFor(kind, "active");
    assert.ok(definition, `${kind} manual ability`);
    assert.equal(Number(special.durationSeconds.toFixed(2)), expectedSpecialDurations[kind], `${kind} special duration`);
    assert.ok(special.durationSeconds >= definition.windupSeconds, `${kind} covers ability wind-up`);
    assert.ok(move.movement, `${kind} move must be locomotion`);
    assert.ok(active.frames.some(({ spriteState }) => spriteState.startsWith("attack")), `${kind} attack pose`);
    signatures.add(combatClipEventsFor(kind, "special").map(({ type }) => type).join("|"));
    for (const state of ["idle", "move", "wind-up", "active", "recovery", "special"]) {
      const current = animationClipFor(kind, state);
      const sample = sampleAnimationClip(kind, state, current.durationSeconds * .55);
      assert.equal(sample.groundAnchor, 1, `${kind}/${state} ground anchor`);
      assert.equal(sample.pose.offsetY, 0, `${kind}/${state} procedural pose cannot lift the feet`);
      assert.ok(sample.pose.scaleX >= .8 && sample.pose.scaleX <= 1.12, `${kind}/${state} scaleX`);
      assert.ok(sample.pose.scaleY >= .8 && sample.pose.scaleY <= 1.12, `${kind}/${state} scaleY`);
      assert.ok(Math.abs(sample.pose.rotationRadians) <= .13, `${kind}/${state} rotation`);
    }
  }
  assert.equal(signatures.size, REPRESENTATIVE_SIX_KINDS.length);
});

test("representative-six weapon anchors mirror at the authored weapon or attack point", () => {
  for (const kind of REPRESENTATIVE_SIX_KINDS) {
    const right = combatWeaponAnchor({ kind, x: 420, y: 260, direction: 1 });
    const left = combatWeaponAnchor({ kind, x: 420, y: 260, direction: -1 });
    assert.ok(Math.abs(right.x - 420) >= 18, `${kind} origin is not the sprite center`);
    assert.ok(right.y <= 241, `${kind} origin is not the lower body`);
    assert.equal(right.y, left.y, `${kind} vertical anchor mirror`);
    assert.equal(right.x - 420, 420 - left.x, `${kind} horizontal anchor mirror`);
  }
});

test("Raider manual muzzle and damage markers share the five-round suppression timeline", () => {
  const specialEvents = combatClipEventsFor("gunner", "special");
  assert.deepEqual(
    specialEvents.filter(({ type }) => type === "suppression-muzzle").map(({ shotIndex }) => shotIndex),
    [0, 1, 2, 3, 4],
  );
  assert.deepEqual(
    specialEvents
      .filter(({ type }) => type === "suppression-hit")
      .map(({ at }) => Number(at.toFixed(3))),
    [.235, .309, .383, .457, .531],
  );
});

test("Mrs. Chiha's normal grenade uses a locked impact point, delayed AoE, and minimum-range bash", async () => {
  const [grenadeRound] = weaponDamageEventsFor("mrs-chiha", 24);
  assert.equal(Number(grenadeRound.offsetSeconds.toFixed(2)), .32);
  assert.equal(Number(grenadeRound.travelSeconds.toFixed(2)), .28);
  assert.equal(Number(grenadeRound.hitOffsetSeconds.toFixed(2)), .6);
  assert.equal(sampleMrsChihaLauncherBash(.02).spriteState, "attack-b");
  assert.equal(sampleMrsChihaLauncherBash(.14).spriteState, "attack-a");
  assert.equal(Number(mrsChihaLauncherBashDuration().toFixed(2)), .27);
  const source = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  assert.match(source, /mrsLauncherBash[\s\S]{0,240}launcherBashRange/);
  assert.match(source, /eventKind: "muzzle"[\s\S]{0,500}remainingSeconds: grenadeRound\.offsetSeconds[\s\S]{0,500}eventKind: "impact"[\s\S]{0,500}remainingSeconds: grenadeRound\.hitOffsetSeconds/);
  assert.match(source, /hit\.damageMode === "grenade"[\s\S]{0,900}effectDistance\(splashTarget, impactPoint\)[\s\S]{0,600}grenadeSplashMultiplier/);
  assert.match(source, /f\.kind === "mrs-chiha"[\s\S]{0,250}mrsLauncherBash \? "bash" : "shot"/);
  assert.match(source, /attackVariant = f\.kind === "mrs-chiha" && mrsLauncherBash \? "launcher-bash" : null/);
  assert.match(source, /locksGrenadeLandingPoint[\s\S]{0,260}hit\.targetX/);
  const scheduledGrenadeIndex = source.indexOf('else if (f.side === "human" && f.kind === "mrs-chiha" && !mrsLauncherBash');
  const immediateContainmentIndex = source.indexOf('&& target.kind === "gate-eater"', scheduledGrenadeIndex);
  assert.ok(scheduledGrenadeIndex >= 0 && immediateContainmentIndex > scheduledGrenadeIndex,
    "Mrs. Chiha grenade must schedule before the immediate containment path");
  assert.match(source, /primaryTarget[\s\S]{0,300}splashTarget\.kind === "gate-eater"[\s\S]{0,700}resolveContainmentStrike/);
  assert.match(source, /deferredStructureImpact = f\.kind === "gunner" \|\| f\.kind === "mrs-chiha"/);
  const structureGrenadeIndex = source.indexOf('} else if (f.kind === "mrs-chiha") {', source.indexOf("deferredStructureImpact"));
  const enemyBaseTargetIndex = source.indexOf('targetKind: "enemy-base"', structureGrenadeIndex);
  const structureImpactIndex = source.indexOf("remainingSeconds: grenadeRound.hitOffsetSeconds", enemyBaseTargetIndex);
  assert.ok(structureGrenadeIndex >= 0
    && enemyBaseTargetIndex > structureGrenadeIndex
    && structureImpactIndex > enemyBaseTargetIndex,
  "Mrs. Chiha must schedule a delayed grenade impact against the infected base");
});

test("pending burst hits become due in stable shot order", () => {
  const events = weaponDamageEventsFor("gunner", 12).slice(1).map((event) => ({
    id: `round-${event.shotIndex}`,
    remainingSeconds: event.offsetSeconds,
  }));
  const first = advancePendingWeaponHits(events, .06);
  assert.deepEqual(first.due.map(({ id }) => id), ["round-1"]);
  assert.equal(first.pending.length, 1);
  const second = advancePendingWeaponHits(first.pending, .06);
  assert.deepEqual(second.due.map(({ id }) => id), ["round-2"]);
  assert.equal(second.pending.length, 0);
});
