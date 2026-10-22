import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readRuntimeObservation, installRuntimeObservationDiagnostics, runtimePerformanceConsoleSummary } from "../scripts/v100-runtime-observation.mjs";

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
  return { window, Element, pending, rect, events, getterOwner, nativeGetter, nativeSnapshot, nativeRaf, nativeRect, reads: () => reads, now: () => clock, advance: amount => { clock += amount; } };
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

test("existing RAF diagnostics retain only a new same-callback CPU tail without extra sampling", () => {
  const c = timingContext(), rows = [], diagnostic = c.window.__V100_RAF_CALLBACK_DIAG__;
  c.window.__ASHFALL_RUNTIME_PERFORMANCE__ = { frameCpuTimings: rows, frameCpuSequence: 0 };
  diagnostic.start();
  c.window.requestAnimationFrame((timestamp) => {
    const entryAt = c.now(); c.advance(5);
    rows.push(Object.freeze({ sequence: 1, rafTimestamp: timestamp, entryAt,
      simulationFinishedAt: entryAt + 2, drawFinishedAt: entryAt + 4, exitAt: c.now(), simulationTime: 11 }));
  });
  c.pending.shift()(123);
  c.window.requestAnimationFrame(() => c.advance(1));
  c.pending.shift()(123); // Same clock, but the earlier CPU row cannot be borrowed.
  c.window.requestAnimationFrame((timestamp) => {
    rows.push(Object.freeze({ sequence: 2, rafTimestamp: timestamp, entryAt: c.now() + 100, exitAt: c.now() + 101 }));
  });
  c.pending.shift()(124); // A foreign/out-of-bound tail is not this callback.
  const output = JSON.parse(JSON.stringify(diagnostic.stop()));
  assert.equal(output.count, 3); assert.equal(c.reads(), 0);
  assert.deepEqual(output.timeline.records.map(r => r.frameCpu?.sequence ?? null), [1, null, null]);
  assert.equal(output.timeline.records[0].frameCpu.simulationFinishedAt - output.timeline.records[0].frameCpu.entryAt, 2);
  assert.equal(rows.length, 2); assert.equal(Object.isFrozen(rows[0]), true);
});

test("CI costs stay readable with full-size diagnostics while raw evidence and failed gates remain unchanged", () => {
  const records = Array.from({ length: 12_000 }, (_, index) => ({ kind: "raf", startedAt: index * 16, endedAt: index * 16 + 9, durationMs: 9, frameTimestamp: index * 16 }));
  const value = { p95RafMs: 57, medianFps: 59, effectiveRenderHz: 58,
    raf: { count: 1_700, elapsedMs: 30_104, times: records.map(row => row.frameTimestamp), intervals: Array(1_699).fill(16) },
    callbackDiagnostic: { diagnosticOnly: true, count: 1_701, p50Ms: 7, p95Ms: 18, maxMs: 42, over8Ms: 417, over16Ms: 110, over33Ms: 2,
      timeline: { clock: "performance.now", maxRecords: 12_000, overflow: 3, records,
        costs: { raf: { count: 1_701, p95Ms: 18, maxMs: 42, records }, snapshot: { count: 40, p95Ms: 2, maxMs: 7 }, futureUnknownKind: { records } } } },
    gates: { sampleCount: true, p95Raf: false, medianFps: true, renderCadence: true } };
  const before = JSON.stringify(value), summary = runtimePerformanceConsoleSummary(value);
  assert.ok(JSON.stringify(summary).length < 2_048, "Bounded console diagnostics must not lose the measured failure to log truncation");
  assert.equal(summary.p95RafMs, 57);
  assert.equal(summary.rafSampleCount, 1_700);
  assert.equal(summary.rafElapsedMs, 30_104);
  assert.equal(summary.callbackDiagnosticStoredInReport, true);
  assert.equal(summary.callbackDiagnostic.p95Ms, 18);
  assert.equal(summary.callbackDiagnostic.timeline.overflow, 3);
  assert.deepEqual(summary.callbackDiagnostic.timeline.costs, { raf: { count: 1_701, p95Ms: 18, maxMs: 42 }, snapshot: { count: 40, p95Ms: 2, maxMs: 7 } });
  assert.deepEqual(summary.gates, value.gates);
  assert.equal(summary.gates.p95Raf, false);
  assert.equal(JSON.stringify(value), before, "The report retains all original samples, costs and gate results");
});

test("successful diagnostic controls expose their measured values without inventing missing timing", () => {
  const c = timingContext();
  c.window.__V100_RAF_CALLBACK_DIAG__.start();
  c.window.requestAnimationFrame(() => c.advance(5));
  c.pending.shift()(123);
  const diagnostic = c.window.__V100_RAF_CALLBACK_DIAG__.stop();
  const value = { p95RafMs: 16, medianFps: 62.5, effectiveRenderHz: 60, callbackDiagnostic: diagnostic, gates: { p95Raf: true } };
  const summary = runtimePerformanceConsoleSummary(value);
  assert.equal(summary.p95RafMs, 16);
  assert.equal(summary.callbackDiagnostic.p95Ms, diagnostic.p95Ms);
  assert.equal(summary.callbackDiagnostic.timeline.costs.raf.count, diagnostic.count);
  assert.equal(summary.gates.p95Raf, true);
  assert.equal(summary.rafElapsedMs, undefined);
  assert.equal(runtimePerformanceConsoleSummary({ gates: { p95Raf: false } }).callbackDiagnostic, null);
  assert.equal(runtimePerformanceConsoleSummary(null), null);
});
