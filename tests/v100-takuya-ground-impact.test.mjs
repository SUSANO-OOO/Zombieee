import assert from "node:assert/strict";
import test from "node:test";
import { drawV100ContactQueue, getV100SkillContactSnapshot, queueV100TakuyaGroundContact } from "../app/v100CombatVfx.js";
import { TAKUYA_GROUND_BLADE_SOCKET, v100RenderedTakuyaGroundSocket } from "../app/v100TakuyaGroundSocket.js";

const world = () => ({ time: 10, definition: { missionConfig: { v100StageNumber: 25 } } });
const owner = () => ({ id: 9, kind: "takuya", side: "zombie", hp: 180, x: 300 });
const frame = (flipX = false) => ({
  path: TAKUYA_GROUND_BLADE_SOCKET.path,
  sourceRect: { w: 512, h: 757 },
  anchorX: 229 / 512,
  anchorY: 604 / 757,
  flipX,
});
const pose = { offsetX: 0, offsetY: 0, rotationRadians: 0, scaleX: 1, scaleY: 1 };

test("Takuya ground socket is source-bound to attack-b blade contact and respects native left/flip", () => {
  const left = v100RenderedTakuyaGroundSocket({ frame: frame(false), size: { w: 220, h: 325 }, pose, x: 300, y: 500, direction: "left" });
  assert.equal(left.pixel.x, 188);
  assert.equal(left.pixel.y, 617);
  const right = v100RenderedTakuyaGroundSocket({ frame: frame(true), size: { w: 220, h: 325 }, pose, x: 300, y: 500, direction: "right" });
  assert.ok(right.x > left.x);
});

test("Takuya ground impact waits for the rendered attack-b socket, snapshots lineage, and expires", () => {
  const w = world();
  assert.equal(queueV100TakuyaGroundContact(w, { owner: owner() }), true);
  const calls = [];
  const ctx = { save() {}, restore() {}, translate(...args) { calls.push(args); }, scale() {}, drawImage() {} };
  const objects = { "v100-ground-impact": { complete: true, naturalWidth: 1536 } };
  drawV100ContactQueue(ctx, objects, w, null, () => null);
  assert.equal(calls.length, 0, "unresolved socket must not draw");
  const socket = { x: 312, y: 601, sourceId: TAKUYA_GROUND_BLADE_SOCKET.sourceId, kind: "takuya-ground-blade", pixel: { x: 188, y: 617 } };
  drawV100ContactQueue(ctx, objects, w, null, () => socket);
  assert.equal(calls.length, 1);
  const [snapshot] = getV100SkillContactSnapshot(w);
  assert.equal(snapshot.sourceId, "takuya-battle-repaired-v1");
  assert.equal(snapshot.kind, "takuya-ground-blade");
  assert.deepEqual(snapshot.resolvedSocket, socket);
  w.time += .61;
  calls.length = 0;
  drawV100ContactQueue(ctx, objects, w, null, () => socket);
  assert.equal(calls.length, 0);
});

test("Takuya ground queue is V1-only and owner/death gated", () => {
  const legacy = { time: 1, definition: { missionConfig: {} } };
  assert.equal(queueV100TakuyaGroundContact(legacy, { owner: owner() }), false);
  const w = world();
  assert.equal(queueV100TakuyaGroundContact(w, { owner: { ...owner(), hp: 0 } }), false);
  assert.equal(queueV100TakuyaGroundContact(w, { owner: { ...owner(), kind: "crusher" } }), false);
});
