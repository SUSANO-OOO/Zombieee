import assert from "node:assert/strict";
import test from "node:test";
import { TATARA_GROUND_ART, v100RenderedTataraGroundSocket, v100TataraDisplaySize, v100TataraGroundPose } from "../app/v100TataraPresentation.js";
import { drawV100ContactQueue, getV100SkillContactSnapshot, queueV100TataraGroundContact } from "../app/v100CombatVfx.js";

const definition = { missionConfig: { v100StageNumber: 25 } };
const owner = (activationId = 7, hp = 100) => ({ id: 4, kind: "brute", side: "human", hp, x: 300, y: 500,
  manualAbility: { activationId, phase: "recovery", windupRemaining: .1, target: { direction: 1 } } });
const frame = (flipX = false) => ({ path: TATARA_GROUND_ART.path, sourceRect: { w: 640, h: 512 }, anchorX: TATARA_GROUND_ART.anchorX, anchorY: 496 / 512, flipX });
const pose = { offsetX: 0, offsetY: 0, rotationRadians: 0, scaleX: 1, scaleY: 1 };

test("Tatara pose is only the first .14 seconds of living recovery", () => {
  assert.ok(v100TataraGroundPose({ ...owner().manualAbility, kind: "brute" }, { hp: 100 }));
  assert.equal(v100TataraGroundPose({ ...owner().manualAbility, kind: "brute", windupRemaining: .07 }, { hp: 100 }), null);
  assert.equal(v100TataraGroundPose({ ...owner().manualAbility, kind: "brute", phase: "active" }, { hp: 100 }), null);
  assert.equal(v100TataraGroundPose({ ...owner().manualAbility, kind: "brute" }, { hp: 0 }), null);
});

test("Tatara display keeps one source-cell scale across the 640x512 frame", () => {
  assert.deepEqual(v100TataraDisplaySize({ w: 480, h: 448 }), { w: 640, h: 512 });
  assert.deepEqual(v100TataraDisplaySize({ w: 240, h: 224 }), { w: 320, h: 256 });
});

test("Tatara socket transforms the authored hammer point with native left/right flip", () => {
  const pixel = { x: 81.89, y: 491.909 };
  const left = v100RenderedTataraGroundSocket({ frame: frame(false), size: { w: 200, h: 160 }, pose, x: 300, y: 500, direction: "left", sourcePixel: pixel });
  const right = v100RenderedTataraGroundSocket({ frame: frame(true), size: { w: 200, h: 160 }, pose, x: 300, y: 500, direction: "right", sourcePixel: pixel });
  assert.ok(Number.isFinite(left.x) && Number.isFinite(right.x));
  assert.notEqual(left.x, right.x);
  assert.deepEqual(left.sourcePixel, pixel);
});

test("Tatara contact remains pending until matching rendered socket, cancels wrong activation/death, then freezes point", () => {
  const world = { time: 10, definition, fighters: [owner()] };
  assert.equal(queueV100TataraGroundContact(world, { owner: owner() }), true);
  const ctx = { save() {}, restore() {}, translate() {}, scale() {}, drawImage() {} };
  const objects = { "v100-ground-impact": { complete: true, naturalWidth: 1536, naturalHeight: 512 } };
  drawV100ContactQueue(ctx, objects, world, null, null, () => null);
  assert.equal(getV100SkillContactSnapshot(world).length, 1);
  world.fighters[0].manualAbility.activationId = 8;
  drawV100ContactQueue(ctx, objects, world, null, null, () => ({ x: 300, y: 400 }));
  assert.equal(getV100SkillContactSnapshot(world).length, 0);

  const liveWorld = { time: 10, definition, fighters: [owner()] };
  queueV100TataraGroundContact(liveWorld, { owner: liveWorld.fighters[0] });
  const point = { x: 311, y: 422, sourcePath: TATARA_GROUND_ART.path, sourcePixel: { x: 81.89, y: 491.909 } };
  drawV100ContactQueue(ctx, objects, liveWorld, null, null, () => point);
  liveWorld.fighters[0].x = 999;
  liveWorld.time += .2;
  const snapshot = getV100SkillContactSnapshot(liveWorld)[0];
  assert.equal(snapshot.x, point.x);
  assert.equal(snapshot.y, point.y);
  assert.equal(snapshot.effectSourcePath, "/art/v100/combat-vfx/ground-impact-six-frames-r1.webp");
  assert.equal(snapshot.bodySourcePath, TATARA_GROUND_ART.path);
  liveWorld.time += .41;
  drawV100ContactQueue(ctx, objects, liveWorld, null, null, () => ({ x: 1, y: 1 }));
  assert.equal(getV100SkillContactSnapshot(liveWorld).length, 0);

  const deadWorld = { time: 10, definition, fighters: [owner()] };
  queueV100TataraGroundContact(deadWorld, { owner: deadWorld.fighters[0] });
  deadWorld.fighters[0].hp = 0;
  drawV100ContactQueue(ctx, objects, deadWorld, null, null, () => ({ x: 1, y: 1 }));
  assert.equal(getV100SkillContactSnapshot(deadWorld).length, 0);
});
