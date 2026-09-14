import test from "node:test";
import assert from "node:assert/strict";
import {
  clearV100SupportAbilityEffects,
  drawV100SupportAbilityEffects,
  getV100SupportAbilityEffectsSnapshot,
  queueV100SupportAbilityEffect,
} from "../app/v100SupportAbilityVfx.js";

function world() {
  return { time: 10, definition: { missionConfig: { v100StageNumber: 3 } } };
}

test("support VFX queue accepts only bounded real events and expires by world time", () => {
  const game = world();
  assert.equal(queueV100SupportAbilityEffect(game, { ownerId: 4, activationId: 2, eventType: "medic-impact", targetId: 77, x: 120, y: 200 }), true);
  assert.equal(queueV100SupportAbilityEffect(game, { ownerId: 4, activationId: 2, eventType: "medic-impact", x: 120, y: 200, startedAt: 10 }), false);
  assert.equal(queueV100SupportAbilityEffect(game, { ownerId: 4, activationId: 2, eventType: "medic-impact", x: 120, y: 200, startedAt: 10.001 }), true);
  assert.equal(queueV100SupportAbilityEffect({ time: 1, definition: { missionConfig: {} } }, { ownerId: 1, activationId: 1, eventType: "medic-impact", x: 1, y: 1 }), false);
  assert.equal(queueV100SupportAbilityEffect(game, { ownerId: 4, activationId: 2, eventType: "windup", x: 120, y: 200 }), false);
  assert.equal(getV100SupportAbilityEffectsSnapshot(game).length, 2);
  assert.equal(getV100SupportAbilityEffectsSnapshot(game)[0].targetId, 77);
  game.time = 10.46;
  assert.equal(getV100SupportAbilityEffectsSnapshot(game).length, 0);
  clearV100SupportAbilityEffects(game);
  const bounded = world();
  for (let index = 0; index < 40; index += 1) queueV100SupportAbilityEffect(bounded, { ownerId: 100 + index, activationId: 1, eventType: "trap-deploy", x: index, y: 300, startedAt: 10 + index * .001 });
  assert.equal(getV100SupportAbilityEffectsSnapshot(bounded).length, 32);
  clearV100SupportAbilityEffects(bounded);
});

test("support VFX renderer uses raster draw calls only", () => {
  const game = world();
  queueV100SupportAbilityEffect(game, { ownerId: 4, activationId: 2, eventType: "medic-impact", targetId: 77, x: 120, y: 200 });
  queueV100SupportAbilityEffect(game, { ownerId: 5, activationId: 3, eventType: "trap-deploy", x: 220, y: 300, duration: .3 });
  queueV100SupportAbilityEffect(game, { ownerId: 5, activationId: 3, eventType: "trap-sprung", x: 220, y: 300, duration: .3 });
  const calls = [];
  let alpha = 1;
  const ctx = {
    save() {}, restore() {}, translate(x, y) { calls.push({ type: "translate", x, y, alpha }); }, drawImage(...args) { calls.push({ type: "drawImage", args, alpha }); },
    set globalAlpha(value) { alpha = value; },
  };
  const objects = {
    "v100-dust": { complete: true, naturalWidth: 128, naturalHeight: 128 },
    "v100-support-trap-sprung": { complete: true, naturalWidth: 145, naturalHeight: 28 },
  };
  drawV100SupportAbilityEffects(ctx, objects, game);
  const firstDraws = calls.filter((call) => call.type === "drawImage");
  assert.ok(firstDraws.length >= 5);
  assert.equal(firstDraws.some(({ args }) => args[0] === objects["v100-dust"]), true);
  assert.equal(firstDraws.some(({ args }) => args[0] === objects["v100-support-trap-sprung"]), true);
  assert.equal(calls.filter((call) => call.type === "translate").every(({ x, y, alpha: value }) => [x, y, value].every(Number.isFinite)), true);
  assert.equal(firstDraws.every(({ args, alpha: value }) => [...args.slice(1), value].every(Number.isFinite)), true);
  const firstGeometry = firstDraws.map(({ args }) => args.slice(1));
  game.time = 10.2;
  const laterCalls = [];
  const laterCtx = { ...ctx, translate(x, y) { laterCalls.push({ type: "translate", x, y, alpha }); }, drawImage(...args) { laterCalls.push({ type: "drawImage", args, alpha }); } };
  drawV100SupportAbilityEffects(laterCtx, objects, game);
  assert.notDeepEqual(laterCalls.filter((call) => call.type === "drawImage").map(({ args }) => args.slice(1)), firstGeometry);
  game.time = 11;
  const expiredCalls = [];
  drawV100SupportAbilityEffects({ ...laterCtx, drawImage(...args) { expiredCalls.push(args); } }, objects, game);
  assert.equal(expiredCalls.length, 0);
  clearV100SupportAbilityEffects(game);
});
