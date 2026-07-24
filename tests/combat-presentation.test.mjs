import assert from "node:assert/strict";
import test from "node:test";

import {
  COMBAT_CLIP_STATES,
  COMBAT_PRESENTATION_PROFILES,
  UNIT_WEAPON_PROFILE,
  WEAPON_PROFILE_IDS,
  WEAPON_PROFILES,
  advancePendingWeaponHits,
  animationClipFor,
  attackPresentationDuration,
  combatClipEventsFor,
  sampleAnimationClip,
  sampleAttackPresentation,
  weaponDamageEventsFor,
  weaponProfileForAction,
} from "../app/combatPresentation.js";
import { spriteKinds } from "../app/spriteManifest.js";

test("every runtime sprite kind owns all variable-frame combat clips", () => {
  assert.deepEqual(Object.keys(COMBAT_PRESENTATION_PROFILES), spriteKinds);
  const frameCounts = new Set();
  for (const kind of spriteKinds) {
    const profile = COMBAT_PRESENTATION_PROFILES[kind];
    assert.ok(["small", "standard", "large"].includes(profile.bodyClass));
    assert.deepEqual(Object.keys(profile.clips), COMBAT_CLIP_STATES);
    for (const state of COMBAT_CLIP_STATES) {
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

test("ten weapon profiles cover all eleven playable units without generic missing VFX", () => {
  assert.deepEqual(Object.keys(WEAPON_PROFILES), WEAPON_PROFILE_IDS);
  assert.equal(Object.keys(UNIT_WEAPON_PROFILE).length, 11);
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
