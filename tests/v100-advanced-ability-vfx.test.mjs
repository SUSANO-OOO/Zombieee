import test from "node:test";
import assert from "node:assert/strict";
import { clearV100AdvancedAbilityEffects, drawV100AdvancedAbilityEffects, getV100AdvancedAbilityEffectsSnapshot, queueV100AdvancedAbilityEffect, resolveV100AdvancedAbilityOrigin } from "../app/v100AdvancedAbilityVfx.js";

const world = () => ({ time: 10, definition: { missionConfig: { v100StageNumber: 3 } } });

test("advanced VFX queue is event-bound, finite, deduped, and expires by world time", () => {
  const game = world();
  assert.equal(queueV100AdvancedAbilityEffect(game, { ownerId: 2, activationId: 4, type: "mrs-grenade-flight", shotIndex: 0, x: 100, y: 200, originX: 90, originY: 190, targetX: 180, targetY: 200, duration: .18 }), true);
  assert.equal(queueV100AdvancedAbilityEffect(game, { ownerId: 2, activationId: 4, type: "mrs-grenade-flight", shotIndex: 0, x: 100, y: 200, originX: 90, originY: 190, targetX: 180, targetY: 200, duration: .18 }), false);
  assert.equal(queueV100AdvancedAbilityEffect(game, { ownerId: 2, activationId: 4, type: "mrs-grenade-flight", shotIndex: 1, x: 100, y: 200, originX: 90, originY: 190, targetX: 180, targetY: 200, duration: .18 }), true);
  assert.equal(queueV100AdvancedAbilityEffect(game, { ownerId: 2, activationId: 4, type: "mrs-grenade-flight", shotIndex: 2, x: NaN, y: 200, duration: .18 }), false);
  assert.equal(getV100AdvancedAbilityEffectsSnapshot(game).length, 2);
  game.time = 10.19; assert.equal(getV100AdvancedAbilityEffectsSnapshot(game).length, 0); clearV100AdvancedAbilityEffects(game);
});

test("unresolved socket coordinates cannot create a rendered advanced effect", () => {
  const game = world(); assert.equal(queueV100AdvancedAbilityEffect(game, { ownerId: 2, activationId: 4, type: "tky-lightblade", x: NaN, y: NaN, duration: .24 }), false); assert.equal(getV100AdvancedAbilityEffectsSnapshot(game).length, 0);
});

test("advanced queue retains shot metadata, bounds growth, and prunes dead owners", () => {
  const game = world(); game.fighters = [{ id: 7, hp: 100 }];
  for (let shotIndex = 0; shotIndex < 70; shotIndex += 1) queueV100AdvancedAbilityEffect(game, { ownerId: 7, activationId: 9, type: "mrs-grenade-impact", shotIndex, x: 10, y: 20, size: shotIndex === 69 ? 220 : 64, finalRound: shotIndex === 69, duration: 1 });
  const current = getV100AdvancedAbilityEffectsSnapshot(game); assert.equal(current.length, 64); assert.equal(current.at(-1).finalRound, true); assert.equal(current.at(-1).size, 220);
  game.fighters[0].hp = 0; assert.equal(getV100AdvancedAbilityEffectsSnapshot(game).length, 64); clearV100AdvancedAbilityEffects(game);
});

test("pending socket effect resolves only from an actual draw socket", () => {
  const game = world(); game.fighters = [{ id: 4, hp: 100, manualAbility: { activationId: 2 } }]; assert.equal(queueV100AdvancedAbilityEffect(game, { ownerId: 4, activationId: 2, type: "tky-lightblade", pendingOrigin: true, duration: .24 }), true);
  assert.equal(getV100AdvancedAbilityEffectsSnapshot(game)[0].resolvedSocketPoint, undefined);
  assert.equal(resolveV100AdvancedAbilityOrigin(game, 4, { x: 300, y: 220 }, { activationId: 2, path: "/art/v090/characters/tky-battle-r1.png", state: "attack-a", sourcePixel: { x: 311, y: 125 } }), 1);
  const resolved = getV100AdvancedAbilityEffectsSnapshot(game)[0]; assert.deepEqual(resolved.resolvedSocketPoint, { x: 300, y: 220 }); assert.equal(resolved.sourceState, "attack-a");
  const wrong = world(); wrong.fighters = [{ id: 4, hp: 100, manualAbility: { activationId: 2 } }]; assert.equal(queueV100AdvancedAbilityEffect(wrong, { ownerId: 4, activationId: 2, type: "tky-lightblade", pendingOrigin: true, duration: .24 }), true);
  assert.equal(resolveV100AdvancedAbilityOrigin(wrong, 4, { x: 1, y: 2 }, { activationId: 99, state: "attack-a" }), 0);
  assert.equal(resolveV100AdvancedAbilityOrigin(wrong, 4, { x: 1, y: 2 }, { activationId: 2, state: "attack-b" }), 0);
});

test("advanced draw paths keep every effect finite", () => {
  const game = world(); game.fighters = Array.from({ length: 7 }, (_, index) => ({ id: index + 1, hp: 100 }));
  const image = (w = 512, h = 512) => ({ complete: true, naturalWidth: w, naturalHeight: h });
  const objects = {
    "v100-grenade-projectile": image(128, 57), "v100-fire-whisky-projectile": image(128, 64),
    "v100-lightblade": image(1536, 1024), "v100-countercut": image(1536, 1024),
    "v100-dust": image(), "v100-explosion": image(), "v100-smoke-a": image(), "v100-smoke-b": image(),
  };
  const calls = [];
  const ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, drawImage(...args) { calls.push(args); },
    set globalAlpha(value) { assert.ok(Number.isFinite(value)); }, set globalCompositeOperation(_) {}, set shadowBlur(_) {} };
  const entries = [
    { ownerId: 1, activationId: 1, type: "mrs-grenade-flight", x: 90, y: 190, targetX: 180, targetY: 200, originX: 90, originY: 190, duration: .18 },
    { ownerId: 2, activationId: 1, type: "zakimiya-bottle", x: 90, y: 190, targetX: 180, targetY: 200, originX: 90, originY: 190, duration: .16 },
    { ownerId: 3, activationId: 1, type: "tky-lightblade", x: 100, y: 200, direction: -1, duration: .24 },
    { ownerId: 4, activationId: 1, type: "musashi-crosscut", x: 100, y: 200, duration: .22 },
    { ownerId: 5, activationId: 1, type: "mayo-dust", x: 100, y: 200, duration: .25 },
    { ownerId: 6, activationId: 1, type: "zakimiya-impact", x: 100, y: 200, duration: .6 },
    { ownerId: 7, activationId: 1, type: "mrs-grenade-impact", x: 100, y: 200, duration: .6 },
  ];
  for (const entry of entries) assert.equal(queueV100AdvancedAbilityEffect(game, entry), true);
  game.time = 10.05; drawV100AdvancedAbilityEffects(ctx, objects, game);
  assert.ok(calls.length >= entries.length); for (const args of calls) assert.ok(args.slice(1).every((value) => typeof value !== "number" || Number.isFinite(value)));
});

test("Zakimiya threshold crossing starts the bottle at the crossing time", () => {
  const game = world(); game.fighters = [{ id: 8, hp: 100, manualAbility: { activationId: 3 } }];
  assert.equal(queueV100AdvancedAbilityEffect(game, { ownerId: 8, activationId: 3, type: "zakimiya-bottle", pendingOrigin: true, targetX: 220, targetY: 180, startedAt: 10.4, duration: .16 }), true);
  game.time = 10.5; assert.equal(getV100AdvancedAbilityEffectsSnapshot(game).length, 1);
  game.time = 10.56; assert.equal(getV100AdvancedAbilityEffectsSnapshot(game).length, 0);
});

test("Mayo dust fades toward the feet and restores canvas alpha", () => {
  const game = world(); const image = { complete: true, naturalWidth: 512, naturalHeight: 512 };
  queueV100AdvancedAbilityEffect(game, { ownerId: 10, activationId: 1, type: "mayo-dust", x: 140, y: 240, duration: .25 });
  let alpha = 1; const alphas = []; let saves = 0; let restores = 0; const ctx = {
    save() { saves += 1; }, restore() { restores += 1; alpha = 1; }, drawImage() {},
    get globalAlpha() { return alpha; }, set globalAlpha(value) { alpha = value; alphas.push(value); },
  };
  drawV100AdvancedAbilityEffects(ctx, { "v100-dust": image }, game); game.time = 10.24; drawV100AdvancedAbilityEffects(ctx, { "v100-dust": image }, game);
  assert.equal(saves, 2); assert.equal(restores, 2); assert.equal(alphas.length, 2); assert.ok(alphas[0] > alphas[1]); assert.equal(alpha, 1);
});

test("pending owner loss removes only unresolved effects", () => {
  const game = world(); game.fighters = [{ id: 8, hp: 100, manualAbility: { activationId: 3 } }, { id: 9, hp: 100, manualAbility: { activationId: 4 } }];
  assert.equal(queueV100AdvancedAbilityEffect(game, { ownerId: 8, activationId: 3, type: "zakimiya-bottle", pendingOrigin: true, targetX: 220, targetY: 180, startedAt: 10, duration: .6 }), true);
  assert.equal(queueV100AdvancedAbilityEffect(game, { ownerId: 9, activationId: 4, type: "tky-lightblade", pendingOrigin: true, startedAt: 10, duration: .6 }), true);
  assert.equal(resolveV100AdvancedAbilityOrigin(game, 9, { x: 50, y: 60 }, { activationId: 4, state: "attack-a" }), 1);
  game.fighters[0].hp = 0; game.fighters.splice(1, 1); game.time = 10.1;
  const active = getV100AdvancedAbilityEffectsSnapshot(game); assert.equal(active.length, 1); assert.equal(active[0].pendingOrigin, false);
});
