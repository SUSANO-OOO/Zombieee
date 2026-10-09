import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { v100EventAudioSnapshot } from "../scripts/v100-event-audio-audit.mjs";

const expected = { selector: ".event", eventId: "v100:event:prologue", nodeIndex: 3, sceneId: "story-kumaya-daily" };
function nativeAudio(nodeIndex = 3) {
  const presentation = { eventId: expected.eventId, nodeIndex, sceneId: expected.sceneId };
  return { owner: "v100-event-runtime", desired: presentation, active: { ...presentation },
    sceneState: { sceneId: expected.sceneId }, diagnostics: { contextState: "running", activeSceneVoices: 1 }, receipts: [] };
}
function audit(audio, { eventId = expected.eventId, nodeIndex = 3, present = true, snapshot = () => audio } = {}) {
  return vm.runInNewContext(`(${v100EventAudioSnapshot.toString()})(expected)`, { expected,
    document: { querySelector: () => present ? { getAttribute: name => name === "data-v100-event-id" ? eventId : String(nodeIndex) } : null },
    window: { __V100_EVENT_AUDIO_QA__: { getSnapshot: snapshot } },
  });
}

test("a coherent old audio cursor cannot pass for the newly visible dialogue", () => {
  assert.equal(audit(nativeAudio(2)), false);
  assert.equal(audit(nativeAudio(), { nodeIndex: 4 }), false);
  assert.equal(audit(nativeAudio(), { eventId: "v100:event:ending" }), false);
  assert.equal(audit(nativeAudio(), { present: false }), false);
});

test("the native scene must match the presentation computed from the script", () => {
  const audio = nativeAudio();
  audio.desired.sceneId = "wrong-scene"; audio.active.sceneId = "wrong-scene"; audio.sceneState.sceneId = "wrong-scene";
  assert.equal(audit(audio), false);
});

test("requested or suspended audio is not evidence of native playback", () => {
  for (const diagnostics of [{ contextState: "suspended", activeSceneVoices: 1 }, { contextState: "running", activeSceneVoices: 0 }]) {
    assert.equal(audit({ ...nativeAudio(), diagnostics }), false);
  }
  assert.equal(audit({ ...nativeAudio(), active: null }), false);
});

test("the accepted native snapshot is returned from one sample before stopping", () => {
  let samples = 0;
  const actual = audit(null, { snapshot: () => { samples++; return samples === 1 ? nativeAudio() : { ...nativeAudio(), diagnostics: { contextState: "running", activeSceneVoices: 0 } }; } });
  assert.equal(samples, 1);
  assert.equal(actual.audio.diagnostics.activeSceneVoices, 1);
  assert.equal(actual.eventId, expected.eventId);
  assert.equal(actual.nodeIndex, expected.nodeIndex);
  assert.equal(actual.sceneId, expected.sceneId);
});
