import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// Browser-only observer: retain native source identities without changing playback.
export function installV100EventLoopProbe() {
  if (typeof AudioBufferSourceNode === "undefined") throw new Error("Event-log audio observation requires native Web Audio");
  const sources = new Map();
  let nextId = 0;
  const start = AudioBufferSourceNode.prototype.start;
  const stop = AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start = function (...args) {
    const result = start.apply(this, args);
    const row = { id: ++nextId, startedAsLoop: this.loop, startedAt: this.context.currentTime, stoppedAt: null, ended: false };
    sources.set(this, row);
    this.addEventListener("ended", () => { row.ended = true; });
    return result;
  };
  AudioBufferSourceNode.prototype.stop = function (...args) {
    const result = stop.apply(this, args);
    const row = sources.get(this);
    if (row) row.stoppedAt = this.context.currentTime;
    return result;
  };
  window.__V100_EVENT_LOOP_PROBE__ = { snapshot: () => [...sources].map(([source, row]) => ({ ...row, loop: source.loop, contextState: source.context.state })) };
}

const activeLoops = sources => sources.filter(row => row.loop && !row.ended && row.stoppedAt === null);
const loopHistory = sources => sources.filter(row => row.startedAsLoop || row.loop).map(row => row.id);

export function assertV100EventLogAudioContinuity({ before, open, closed, samples }) {
  assert.ok(typeof before.rawSave === "string" && before.rawSave.length > 0, "An existing save is required");
  assert.ok(typeof before.audio.active?.eventId === "string");
  assert.equal(before.cursor.event, before.audio.active.eventId);
  assert.equal(before.cursor.node, String(before.audio.active.nodeIndex));
  assert.equal(before.audio.diagnostics.contextState, "running");
  assert.ok(before.audio.diagnostics.activeBgmVoices > 0, "A real BGM must be active before opening the log");
  const loops = activeLoops(before.sources);
  assert.ok(loops.length > 0, "Native loop identity evidence is required");
  assert.ok(samples.length >= 40, "Retain the original 50ms/40-sample observation minimum");
  for (const state of [open, closed]) {
    assert.equal(state.rawSave, before.rawSave, "The read-only log must preserve exact save bytes");
    assert.deepEqual(state.cursor, before.cursor, "The visible event cursor must not advance");
    assert.deepEqual(state.audio.active, before.audio.active);
    assert.deepEqual(state.audio.receipts, before.audio.receipts, "No event audio re-request on log open/close");
    assert.deepEqual(activeLoops(state.sources), loops, "Keep the same playing native loop sources");
    assert.deepEqual(loopHistory(state.sources), loopHistory(before.sources), "No transient loop restart between snapshots");
  }
  for (const sample of samples) {
    assert.equal(sample.contextState, "running");
    assert.ok(sample.bgmVoices > 0, "BGM must remain active while the log is open and after closing");
    assert.deepEqual(sample.active, before.audio.active);
    assert.equal(sample.sceneId, before.audio.sceneState.sceneId);
    assert.deepEqual(sample.duplicates, []);
    assert.deepEqual(sample.loops, loops);
    assert.deepEqual(sample.loopHistory, loopHistory(before.sources));
  }
  return { status: "passed", samples: samples.length, nativeLoopIds: loops.map(row => row.id), rawSaveUnchanged: true };
}

export async function observeV100EventLogAudio(page, selector, options) {
  const observation = options.evidence ?? {};
  Object.assign(observation, { status: "observing", phase: "native-scene-precondition" });
  try {
    await observeEventLogFlow(page, selector, options, observation);
    observation.status = "passed";
    return observation;
  } catch (error) {
    observation.status = "failed";
    observation.error = String(error);
    throw error;
  } finally {
    for (const state of [observation.before, observation.open, observation.closed]) {
      if (!state || !Object.hasOwn(state, "rawSave")) continue;
      state.saveSha256 = createHash("sha256").update(state.rawSave ?? "").digest("hex");
      state.saveBytes = Buffer.byteLength(state.rawSave ?? "");
      delete state.rawSave;
    }
  }
}

async function observeEventLogFlow(page, selector, { timeout, clickControl }, observation) {
  await page.waitForFunction(() => {
    const a = window.__V100_EVENT_AUDIO_QA__?.getSnapshot?.();
    return window.__V100_EVENT_LOOP_PROBE__ && a?.diagnostics.contextState === "running"
      && a.diagnostics.activeBgmVoices > 0 && a.diagnostics.cache.loading === 0
      && a.diagnostics.activePreloads === 0 && a.diagnostics.queuedPreloads === 0
      && document.documentElement.dataset.pwaSaveMutationPending === "false";
  }, undefined, { timeout });
  await page.waitForTimeout(1000);
  const read = () => page.evaluate(selector => {
    const surface = document.querySelector(selector);
    return { audio: window.__V100_EVENT_AUDIO_QA__.getSnapshot(), sources: window.__V100_EVENT_LOOP_PROBE__.snapshot(),
      cursor: { event: surface?.getAttribute("data-v100-event-id"), node: surface?.getAttribute("data-v100-node-index") },
      rawSave: localStorage.getItem("nishijin-campaign-v100") };
  }, selector);
  Object.assign(observation, { before: await read(), open: null, closed: null, samples: [], phase: "before-open" });
  await page.evaluate(() => {
    window.__V100_EVENT_LOG_SAMPLES__ = [];
    window.__V100_EVENT_LOG_TIMER__ = setInterval(() => {
      const a = window.__V100_EVENT_AUDIO_QA__.getSnapshot();
      const sources = window.__V100_EVENT_LOOP_PROBE__.snapshot();
      window.__V100_EVENT_LOG_SAMPLES__.push({ active: a.active, sceneId: a.sceneState.sceneId,
        contextState: a.diagnostics.contextState, bgmVoices: a.diagnostics.activeBgmVoices,
        duplicates: a.diagnostics.duplicateLoopInstanceKeys,
        loops: sources.filter(row => row.loop && !row.ended && row.stoppedAt === null),
        loopHistory: sources.filter(row => row.startedAsLoop || row.loop).map(row => row.id) });
    }, 50);
  });
  let hasPrimaryError = false;
  try {
    await clickControl(page.getByRole("button", { name: "会話ログ", exact: true }), "open read-only conversation log");
    const dialog = page.getByRole("dialog", { name: "会話記録", exact: true });
    await dialog.waitFor({ state: "visible", timeout });
    observation.phase = "log-open";
    await page.waitForTimeout(1500);
    observation.open = await read();
    await clickControl(dialog.getByRole("button", { name: "閉じる", exact: true }), "close read-only conversation log");
    await dialog.waitFor({ state: "hidden", timeout });
    observation.phase = "log-closed";
    await page.waitForTimeout(1500);
    observation.closed = await read();
  } catch (error) {
    hasPrimaryError = true;
    throw error;
  } finally {
    try {
      observation.samples = await page.evaluate(() => { clearInterval(window.__V100_EVENT_LOG_TIMER__); return window.__V100_EVENT_LOG_SAMPLES__; });
    } catch (error) {
      observation.samplingCleanupError = String(error);
      if (!hasPrimaryError) throw error;
    }
  }
  observation.phase = "assert-continuity";
  observation.contract = assertV100EventLogAudioContinuity(observation);
}
