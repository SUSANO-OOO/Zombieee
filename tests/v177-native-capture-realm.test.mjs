import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {createNativeAllUnitRealmOwner, readNativeAllUnitRealmOwner,
  assertNativeCaptureRealm} from '../scripts/v177-native-capture-realm.mjs';
import {startNativeGameRafObservation, stopNativeGameRafObservation} from '../scripts/v177-native-game-capture-browser.mjs';
import {startNativeTurnedGetupRafObservation} from '../scripts/v177-native-turned-getup.mjs';
import {startNativeCanvasClip, finishNativeCanvasClip} from '../scripts/v177-native-canvas-clips.mjs';

// Execute the real browser callbacks against inert media and a changing raw
// getter. This proves reference ownership, never native video or naturalness.
function fixture() {
  let origin = 1000, now = 100, next = 0;
  const callbacks = new Map(), track = {stop() {}, getSettings: () => ({})};
  const stream = {getTracks: () => [track], getVideoTracks: () => [track], getAudioTracks: () => []};
  const canvas = {width: 980, height: 520, isConnected: true, captureStream: () => stream};
  const document = {querySelector: () => canvas};
  const window = {__ASHFALL_BATTLE_QA__: {
    getEnemyFacingRuntimeAudit: () => ({renderHistory: [{renderSequence: next, renderKind: 'ranger'}]}),
    getV177TurnedGetupProof: () => ({actorId: null, corpseRenderSequence: next}),
  }};
  canvas.ownerDocument = document; document.defaultView = window;
  const performance = {get timeOrigin() { return origin; }, now: () => ++now};
  class MediaRecorder {
    static isTypeSupported() { return true; }
    constructor(_stream, {mimeType}) { this.mimeType = mimeType; this.listeners = new Map(); this.state = 'inactive'; }
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    removeEventListener(name) { this.listeners.delete(name); }
    start() { this.state = 'recording'; this.listeners.get('start')(); }
    stop() {
      this.state = 'inactive'; this.listeners.get('dataavailable')({data: new Blob(['inert-fixture']), timecode: 0});
      this.listeners.get('stop')();
    }
  }
  const globals = {window, document, performance, crypto: {randomUUID}, Blob, btoa, MediaRecorder,
    requestAnimationFrame(fn) { callbacks.set(++next, fn); return next; },
    cancelAnimationFrame(id) { callbacks.delete(id); }, setTimeout: () => 1, clearTimeout() {}};
  const context = vm.createContext(globals);
  const run = (fn, ...args) => vm.runInContext('(' + fn.toString() + ')', context)(...args);
  return {globals, run, setOrigin(value) { origin = value; }, refs: {window, document, performance, canvas}};
}

async function record(start = startNativeGameRafObservation) {
  const f = fixture(), owner = f.run(createNativeAllUnitRealmOwner);
  const realmOwner = f.run(readNativeAllUnitRealmOwner, owner);
  const observation = f.run(start, {fighterId: 8, realmOwner: owner});
  f.setOrigin(1001);
  const recording = f.run(startNativeCanvasClip, f.refs.canvas,
    {metadata: {}, engine: 'webkit', requestedMimeType: 'video/webm;codecs=vp8', realmOwner: owner});
  const recordingStart = {realm: recording.realmStarted};
  const nativeClip = await f.run(finishNativeCanvasClip, recording, {completed: true});
  const sourceRaf = f.run(stopNativeGameRafObservation, observation);
  return {f, owner, row: {realmOwner, recordingStart, nativeClip, sourceRaf}};
}

test('actual normal and pre-birth RAF/recorder callbacks preserve different raw reads within one real realm', async () => {
  for (const start of [startNativeGameRafObservation, startNativeTurnedGetupRafObservation]) {
    const {row} = await record(start), receipt = assertNativeCaptureRealm(row);
    assert.equal(row.nativeClip.status, 'recorded');
    assert.equal(receipt.rawRafTimeOrigin, 1000); assert.equal(receipt.rawRecorderTimeOrigin, 1001);
    assert.equal(receipt.rawOriginAtCreation, 1000); assert.equal(receipt.sameRealmVerified, true);
    assert.equal(receipt.originalSpeedAccepted, false); assert.equal(receipt.naturalnessAccepted, false);
    assert.equal(row.sourceRaf.timeOrigin, 1000); assert.equal(row.nativeClip.timeOrigin, 1001);
  }
});

test('identical raw origins cannot substitute for missing, foreign, reordered or failed owner receipts', async () => {
  const {row} = await record();
  const faults = [r => { delete r.realmOwner; }, r => { delete r.sourceRaf.realm; },
    r => { delete r.nativeClip.realm.created; }, r => { r.nativeClip.realm.started.ownerId = randomUUID(); },
    r => { r.nativeClip.realm.finished.createdAt++; }, r => { r.nativeClip.realm.finished.rawOriginAtCreation++; },
    r => { r.nativeClip.realm.created.sequence = r.sourceRaf.realm.started.sequence; },
    r => { r.sourceRaf.realm.stopped.sequence = r.nativeClip.realm.finished.sequence; },
    r => { r.sourceRaf.realm.failure = 'Original canvas changed'; },
    r => { r.recordingStart.realm.member = 'another-start'; }, r => { r.sourceRaf.timeOrigin = NaN; }];
  for (const mutate of faults) {
    const changed = structuredClone(row); changed.nativeClip.timeOrigin = changed.sourceRaf.timeOrigin;
    mutate(changed); assert.throws(() => assertNativeCaptureRealm(changed));
  }
});

test('an equal-origin replacement Window, Document, Performance or Canvas fails the actual private closure', async () => {
  const {f, owner} = await record();
  for (const key of ['window', 'document', 'performance', 'canvas']) {
    const refs = {...f.refs, [key]: {...f.refs[key]}};
    assert.throws(() => owner.member(refs, 'sample'), /reference mismatch/u);
  }
});
