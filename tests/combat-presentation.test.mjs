import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

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
  mrsChihaLauncherBashDuration,
  sampleAnimationClip,
  sampleAttackPresentation,
  sampleMrsChihaLauncherBash,
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

test("thirteen weapon profiles cover all fifteen playable units without generic missing VFX", () => {
  assert.deepEqual(Object.keys(WEAPON_PROFILES), WEAPON_PROFILE_IDS);
  assert.equal(Object.keys(UNIT_WEAPON_PROFILE).length, 15);
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
  assert.equal(weaponProfileForAction("tky", "attack").id, "plasma-blade");
  assert.equal(weaponProfileForAction("mrs-chiha", "attack").id, "grenade");
  assert.equal(weaponProfileForAction("miyamoto-musashi", "attack").id, "dual-katana");
});

test("new playable special clips preserve authored body phases and Mrs. Chiha's normal launcher cycle", () => {
  assert.deepEqual(
    combatClipEventsFor("tky", "special").map(({ type }) => type),
    ["light-blade-charge", "light-blade-extend", "light-blade-release"],
  );
  assert.deepEqual(
    combatClipEventsFor("mrs-chiha", "special")
      .filter(({ type }) => type === "salvo-shot")
      .map(({ at }) => Number(at.toFixed(2))),
    [1.05, 1.27, 1.49, 1.71],
  );
  assert.equal(
    Number(combatClipEventsFor("mrs-chiha", "special").find(({ type }) => type === "launcher-stow").at.toFixed(2)),
    1.73,
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
