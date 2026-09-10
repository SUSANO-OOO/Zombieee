import assert from "node:assert/strict";
import test from "node:test";
import { queueV100ClawContact, getV100ClawContactSnapshot, drawV100ContactQueue, clearV100ContactQueue } from "../app/v100CombatVfx.js";

const fixture = () => ({
  world: { time: 12, definition: { missionConfig: { v100StageNumber: 2 } } },
  attacker: { id: 7, kind: "walker", side: "zombie", x: 280, attackSequence: 3 },
  target: { id: 4, kind: "brawler", side: "human", x: 255, y: 240, hp: 61, manualAbility: { phase: "idle" } },
});
test("claw contact follows positive applied melee damage and retains a finite immutable receipt", () => {
  const { world, attacker, target } = fixture(), state = JSON.stringify({ world, attacker, target });
  assert.equal(queueV100ClawContact(world, { attacker, target, hpBefore: 80, attackKind: "melee" }), true);
  assert.equal(JSON.stringify({ world, attacker, target }), state);
  const [contact] = getV100ClawContactSnapshot(world);
  assert.equal(contact.hpBefore, 80); assert.equal(contact.hpAfter, 61);
  assert.equal(contact.sourceId, 7); assert.equal(contact.targetId, 4);
  assert.deepEqual([contact.x, contact.y, contact.direction, contact.duration], [259, 210, -1, .2]);
  contact.hpBefore = 999; target.hp = 40;
  assert.equal(getV100ClawContactSnapshot(world)[0].hpBefore, 80);
  assert.equal(getV100ClawContactSnapshot(world)[0].hpAfter, 61);
  world.time += .201; assert.deepEqual(getV100ClawContactSnapshot(world), []);
});
test("misses, wrong weapons, ranged damage and protected bodies do not emit claw fibers", () => {
  for (const mutate of [
    f => { f.target.hp = 80; }, f => { f.target.hp = 90; },
    f => { f.attacker.kind = "red-panther-knife"; }, f => { f.attacker.side = "human"; },
    f => { f.target.side = "zombie"; }, f => { f.world.definition.missionConfig = {}; },
    f => { f.target.kind = "kumaverson"; f.target.manualAbility.phase = "active"; },
    f => { f.target.kind = "guardian"; f.target.manualAbility.phase = "active"; },
    f => { f.target.x = NaN; }, f => { f.world.time = Infinity; },
  ]) {
    const f = fixture(); mutate(f);
    assert.equal(queueV100ClawContact(f.world, { ...f, hpBefore: 80, attackKind: "melee" }), false);
    assert.deepEqual(getV100ClawContactSnapshot(f.world), []);
  }
  const f = fixture();
  for (const input of [{ attackKind: "ranged", hpBefore: 80 }, { attackKind: "melee", hpBefore: 0 }, { attackKind: "melee", hpBefore: NaN }]) {
    assert.equal(queueV100ClawContact(f.world, { ...f, ...input }), false);
  }
});
test("a lethal claw hit still displays its six authored frames once and clears with battle state", () => {
  const f = fixture(); f.target.hp = -8;
  assert.equal(queueV100ClawContact(f.world, { ...f, hpBefore: 4, attackKind: "melee" }), true);
  const draws = [], objects = { "v100-claw-contact": { complete: true, naturalWidth: 1536 } };
  const context = { save() {}, restore() {}, translate() {}, scale() {}, drawImage(...args) { draws.push(args); } };
  for (let frame = 0; frame < 6; frame++) { f.world.time = 12 + (frame + .1) / 6 * .2; drawV100ContactQueue(context, objects, f.world); }
  assert.deepEqual(draws.map(a => a.slice(1, 5)), [[0,0,512,512],[512,0,512,512],[1024,0,512,512],[0,512,512,512],[512,512,512,512],[1024,512,512,512]]);
  assert.ok(draws.every(a => a[0] === objects["v100-claw-contact"]));
  clearV100ContactQueue(f.world); assert.deepEqual(getV100ClawContactSnapshot(f.world), []);
  drawV100ContactQueue(context, objects, f.world); assert.equal(draws.length, 6);
});
test("claw contact stays beside Mayo's harness instead of above her small body", () => {
  const f=fixture();f.target.kind="mayo-chan";
  assert.equal(queueV100ClawContact(f.world,{...f,hpBefore:80,attackKind:"melee"}),true);
  assert.equal(getV100ClawContactSnapshot(f.world)[0].y,f.target.y-16);
});
