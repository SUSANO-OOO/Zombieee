import test from "node:test";
import assert from "node:assert/strict";
import { assertV100EventLogAudioContinuity, installV100EventLoopProbe, observeV100EventLogAudio } from "../scripts/v100-event-log-audio-audit.mjs";

function observation() {
  const active = { eventId: "v100:event:prologue", nodeIndex: 0, sceneId: "city" };
  const sources = [{ id: 1, loop: true, startedAt: 1, stoppedAt: null, ended: false }];
  const before = { audio: { active, receipts: [{ action: "requested", sceneId: "city" }], sceneState: { sceneId: "city" },
    diagnostics: { contextState: "running", activeBgmVoices: 1 } }, sources, cursor: { event: active.eventId, node: "0" }, rawSave: "exact fixture bytes" };
  return { before, open: structuredClone(before), closed: structuredClone(before), samples: Array.from({ length: 40 }, () => ({
    active: structuredClone(active), sceneId: "city", contextState: "running", bgmVoices: 1, duplicates: [],
    loops: structuredClone(sources), loopHistory: [1],
  })) };
}

test("read-only log preserves a real native loop while unrelated one-shot UI audio is allowed", () => {
  const row = observation();
  row.open.sources.push({ id: 2, loop: false, startedAt: 2, stoppedAt: null, ended: false });
  assert.equal(assertV100EventLogAudioContinuity(row).status, "passed");
});
test("same cue restarted as a new native source is rejected even if the mixer stays running", () => {
  const row = observation(); row.closed.sources[0].id = 2;
  assert.throws(() => assertV100EventLogAudioContinuity(row));
});
test("a transient new loop that ended between snapshots is still rejected", () => {
  const row = observation(); row.closed.sources.push({ id: 2, loop: true, startedAt: 2, stoppedAt: 3, ended: true });
  assert.throws(() => assertV100EventLogAudioContinuity(row));
});
test("a sampled silence gap cannot pass merely because the final loop is active", () => {
  const row = observation(); row.samples[15].bgmVoices = 0;
  assert.throws(() => assertV100EventLogAudioContinuity(row));
});
test("save mutation and visible cursor advancement each invalidate a read-only log observation", () => {
  for (const mutation of [row => { row.open.rawSave += "changed"; }, row => { row.closed.cursor.node = "1"; }]) {
    const row = observation(); mutation(row); assert.throws(() => assertV100EventLogAudioContinuity(row));
  }
});
test("empty native source evidence cannot pass through matching snapshots", () => {
  const row = observation(); row.before.sources = []; row.open.sources = []; row.closed.sources = [];
  assert.throws(() => assertV100EventLogAudioContinuity(row));
});
test("absent save bytes cannot count as an unchanged existing save", () => {
  const row = observation(); row.before.rawSave = null; row.open.rawSave = null; row.closed.rawSave = null;
  assert.throws(() => assertV100EventLogAudioContinuity(row));
});
test("native observer forwards methods and reads live loop/context while retaining loop history", t => {
  const previousSource = Object.getOwnPropertyDescriptor(globalThis, "AudioBufferSourceNode");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  t.after(() => {
    if (previousSource) Object.defineProperty(globalThis, "AudioBufferSourceNode", previousSource);
    else delete globalThis.AudioBufferSourceNode;
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete globalThis.window;
  });
  class NativeSource {
    constructor() { this.loop = true; this.context = { currentTime: 1, state: "running" }; }
    start(...args) { this.startArguments = args; return 17; }
    stop(...args) { this.stopArguments = args; return 23; }
    addEventListener(name, callback) { assert.equal(name, "ended"); this.finish = callback; }
  }
  Object.defineProperty(globalThis, "AudioBufferSourceNode", { configurable: true, writable: true, value: NativeSource });
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: {} });
  installV100EventLoopProbe();
  const source = new NativeSource();
  assert.equal(source.start(0, 2), 17); assert.deepEqual(source.startArguments, [0, 2]);
  source.loop = false; source.context.state = "suspended";
  const snapshot = globalThis.window.__V100_EVENT_LOOP_PROBE__.snapshot;
  assert.equal(snapshot()[0].loop, false);
  assert.equal(snapshot()[0].startedAsLoop, true);
  assert.equal(snapshot()[0].contextState, "suspended");
  source.context.currentTime = 4;
  assert.equal(source.stop(7), 23); assert.deepEqual(source.stopArguments, [7]);
  assert.equal(snapshot()[0].stoppedAt, 4);
  source.finish(); assert.equal(snapshot()[0].ended, true);
});
test("sampling cleanup cannot replace the primary UI failure", async () => {
  const primary = new Error("primary UI input failed");
  const cleanup = new Error("page disconnected during sampler cleanup");
  const evidence = {};
  let evaluations = 0;
  const page = {
    waitForFunction: async () => {}, waitForTimeout: async () => {}, getByRole: () => ({}),
    evaluate: async () => {
      evaluations++;
      if (evaluations === 1) return observation().before;
      if (evaluations === 2) return undefined;
      throw cleanup;
    },
  };
  await assert.rejects(observeV100EventLogAudio(page, "[data-test]", {
    timeout: 45000, evidence, clickControl: async () => { throw primary; },
  }), error => error === primary);
  assert.equal(evidence.error, String(primary));
  assert.equal(evidence.samplingCleanupError, String(cleanup));
});
