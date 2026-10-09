import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readRuntimeObservation, installRuntimeObservationDiagnostics } from "../scripts/v100-runtime-observation.mjs";

test("serialized observation transfers only live acceptance fields with one unchanged native read", () => {
  const human = Object.freeze({ id: 1, kind: "guardian", side: "human", hp: 37, maxHp: 90, x: 350, y: 255, lane: 1, renderAuditHistory: [{ large: true }] });
  const boss = Object.freeze({ id: 9, kind: "mugarian-president-mutated", side: "zombie", hp: 4416, maxHp: 6200, x: 720, y: 230, lane: 0, combatReady: true });
  const snapshot = Object.freeze({ stageId: "stage-25", operationId: "operation-25", time: 109, running: true, over: false, won: false, baseHp: 1051, baseMaxHp: 1080,
    fighters: [human, boss, { id: 12, side: "human", hp: 0 }, { id: 13, side: "zombie", hp: -1 }], expensiveAudit: "retained only in the browser" });
  let reads = 0;
  const context = { window: { __ASHFALL_BATTLE_QA__: { getSnapshot() { reads += 1; return snapshot; } } } };
  const result = JSON.parse(JSON.stringify(vm.runInNewContext(`(${readRuntimeObservation.toString()})()`, context)));
  assert.deepEqual(result, { stageId: "stage-25", operationId: "operation-25", time: 109, running: true, over: false, won: false, baseHp: 1051, baseMaxHp: 1080,
    humanCount: 1, enemyCount: 1,
    boss: [{ id: 9, kind: boss.kind, hp: 4416, maxHp: 6200, x: 720, y: 230, lane: 0, combatReady: true }],
    humans: [{ id: 1, kind: "guardian", hp: 37, maxHp: 90, x: 350, y: 255, lane: 1 }] });
  assert.equal(reads, 1);
  assert.equal(snapshot.fighters[0], human);
  assert.equal(JSON.stringify(result).includes("renderAuditHistory"), false);
  assert.equal(vm.runInNewContext(`(${readRuntimeObservation.toString()})()`, { window: {} }), null);
});

function timingContext() {
  let clock = 0, reads = 0;
  const pending = [], events = new Map(), nativeSnapshot = Object.freeze({ alive: true });
  const nativeRaf = function(callback) { assert.equal(this, window); pending.push(callback); return 71; };
  const nativeGetter = function(value) { assert.equal(this, getterOwner); reads += 1; clock += 3; if (value === "throw") throw new Error("native snapshot failure"); return nativeSnapshot; };
  const getterOwner = { getSnapshot: nativeGetter };
  class Element { getBoundingClientRect(value) { clock += 2; if (value === "throw") throw new Error("native layout failure"); return rect; } }
  const rect = Object.freeze({ x: 13, y: 17, width: 24, height: 32 });
  const nativeRect = Element.prototype.getBoundingClientRect;
  const window = { __ASHFALL_BATTLE_QA__: getterOwner, requestAnimationFrame: nativeRaf,
    addEventListener(type, listener) { events.set(type, listener); },
    removeEventListener(type, listener) { assert.equal(events.get(type), listener); events.delete(type); } };
  vm.runInNewContext(`(${installRuntimeObservationDiagnostics.toString()})()`, { window, Element, performance: { now: () => clock++ } });
  return { window, Element, pending, rect, events, getterOwner, nativeGetter, nativeSnapshot, nativeRaf, nativeRect, reads: () => reads, advance: amount => { clock += amount; } };
}

test("timing preserves native returns, exceptions and callback IDs and adds no observations", () => {
  const c = timingContext(), diagnostic = c.window.__V100_RAF_CALLBACK_DIAG__;
  assert.equal(c.reads(), 0);
  diagnostic.start();
  assert.equal(c.reads(), 0);
  assert.equal(c.getterOwner.getSnapshot(), c.nativeSnapshot);
  assert.throws(() => c.getterOwner.getSnapshot("throw"), /native snapshot failure/);
  assert.equal(new c.Element().getBoundingClientRect(), c.rect);
  assert.throws(() => new c.Element().getBoundingClientRect("throw"), /native layout failure/);
  assert.equal(c.window.requestAnimationFrame(timestamp => { assert.equal(timestamp, 123); c.advance(5); return "native callback return"; }), 71);
  assert.equal(c.pending.shift()(123), "native callback return");
  c.events.get("pointerdown")({ type: "pointerdown" });
  const output = JSON.parse(JSON.stringify(diagnostic.stop()));
  assert.equal(c.reads(), 2);
  assert.deepEqual(output.timeline.records.map(row => row.kind), ["snapshot", "snapshot", "layout", "layout", "raf", "pointerdown"]);
  assert.ok(output.timeline.records.every(row => row.endedAt >= row.startedAt));
  assert.equal(output.count, 1);
  assert.equal(output.timeline.costs.snapshot.count, 2);
  assert.equal(output.timeline.records.find(row => row.kind === "raf").frameTimestamp, 123);
  assert.equal(c.getterOwner.getSnapshot, c.nativeGetter);
  assert.equal(c.window.requestAnimationFrame, c.nativeRaf);
  assert.equal(c.Element.prototype.getBoundingClientRect, c.nativeRect);
  assert.equal(c.events.size, 0);
});

test("diagnostic storage remains bounded without hiding native calls or exceptions", () => {
  const c = timingContext(), diagnostic = c.window.__V100_RAF_CALLBACK_DIAG__;
  diagnostic.start();
  for (let i = 0; i < 12_005; i += 1) assert.equal(c.getterOwner.getSnapshot(), c.nativeSnapshot);
  const output = diagnostic.stop();
  assert.equal(c.reads(), 12_005);
  assert.equal(output.timeline.records.length, 12_000);
  assert.equal(output.timeline.overflow, 5);
  assert.equal(c.getterOwner.getSnapshot, c.nativeGetter);
});
