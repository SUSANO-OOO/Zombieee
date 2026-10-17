import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { captureNormalAudioUnlockAttempt, readNormalAudioUnlockSnapshot, NORMAL_AUDIO_UNLOCK_ATTEMPT_LIMIT, NORMAL_AUDIO_UNLOCK_READ_MS } from '../scripts/v177-normal-audio-unlock-observation.mjs';

const snapshot = () => ({ schema: 'v177-normal-audio-unlock-snapshot/v1', controls: { status: 'ok', total: 0 } });

test('one native locator click keeps its arguments, return value and before/after ordering', async () => {
  const events = [], attempts = [], result = Symbol('original click result');
  const page = { evaluate: async fn => { assert.equal(fn, readNormalAudioUnlockSnapshot); events.push('read'); return snapshot(); } };
  const audio = { async click(...args) { assert.deepEqual(args, []); events.push('click'); return result; } };
  assert.equal(await captureNormalAudioUnlockAttempt(audio, { page, attempts, stageNumber: 1 }), result);
  assert.deepEqual(events, ['read', 'click', 'read']);
  assert.equal(attempts[0].click.status, 'returned');
  assert.deepEqual(attempts[0].acceptance, { audioSignal: false, physicalSavedRecording: false, wholeGame: false });
});

test('failed readbacks cannot replace the original click Error object', async () => {
  const original = Object.freeze(new Error('original locator TimeoutError')), attempts = [];
  let clicks = 0, reads = 0;
  const page = { evaluate: async () => { reads += 1; throw new Error('observation failure with private details'); } };
  const audio = { async click() { clicks += 1; throw original; } };
  await assert.rejects(() => captureNormalAudioUnlockAttempt(audio, { page, attempts, stageNumber: 1 }), error => error === original);
  assert.equal(clicks, 1); assert.equal(reads, 2);
  assert.equal(attempts[0].before.reason, 'evaluate-rejected');
  assert.equal(attempts[0].after.reason, 'evaluate-rejected');
  assert.equal(attempts[0].click.status, 'failed');
  assert.equal(JSON.stringify(attempts).includes('private details'), false);
});

test('invalid readback data stays unknown while a returned click keeps its result', async () => {
  const attempts = [];
  assert.equal(await captureNormalAudioUnlockAttempt({ click: async () => 7 }, { page: { evaluate: async () => undefined }, attempts, stageNumber: 2 }), 7);
  assert.equal(attempts[0].before.status, 'unknown'); assert.equal(attempts[0].after.status, 'unknown');
});

test('the 16-row observation bound keeps subsequent original clicks and records only suppression', async () => {
  const attempts = []; let reads = 0, clicks = 0;
  const page = { evaluate: async () => { reads += 1; return snapshot(); } };
  const audio = { async click(...args) { assert.equal(args.length, 0); clicks += 1; } };
  for (let index = 0; index < NORMAL_AUDIO_UNLOCK_ATTEMPT_LIMIT; index += 1) await captureNormalAudioUnlockAttempt(audio, { page, attempts, stageNumber: 1 });
  const before = structuredClone(attempts.at(-1));
  await captureNormalAudioUnlockAttempt(audio, { page, attempts, stageNumber: 1 });
  assert.equal(attempts.length, 16); assert.equal(reads, 32); assert.equal(clicks, 17);
  assert.deepEqual({ ...attempts.at(-1), suppressedObservationAttempts: undefined }, { ...before, suppressedObservationAttempts: undefined });
  assert.equal(attempts.at(-1).suppressedObservationAttempts, 1);
  const original = new Error('click after observation limit');
  await assert.rejects(() => captureNormalAudioUnlockAttempt({ click: async () => { throw original; } }, { page, attempts, stageNumber: 1 }), error => error === original);
  assert.equal(reads, 32); assert.equal(attempts.at(-1).suppressedObservationAttempts, 2);
});

test('each read owns 1s and late completion or rejection cannot promote a timeout', { timeout: 6000 }, async () => {
  assert.equal(NORMAL_AUDIO_UNLOCK_READ_MS, 1000);
  let complete; let reads = 0; const attempts = [];
  const page = { evaluate: () => ++reads === 1 ? new Promise(resolve => { complete = resolve; }) : Promise.resolve(snapshot()) };
  await captureNormalAudioUnlockAttempt({ click: async () => 1 }, { page, attempts, stageNumber: 1 });
  const timedOut = structuredClone(attempts[0].before);
  assert.equal(timedOut.reason, 'read-timeout'); assert.equal(timedOut.timeoutMs, 1000);
  complete(snapshot()); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(attempts[0].before, timedOut);
  const original = new Error('original after-read case'), failedAttempts = []; let rejectLate; reads = 0;
  const latePage = { evaluate: () => ++reads === 1 ? Promise.resolve(snapshot()) : new Promise((resolve, reject) => { rejectLate = reject; }) };
  await assert.rejects(() => captureNormalAudioUnlockAttempt({ click: async () => { throw original; } }, { page: latePage, attempts: failedAttempts, stageNumber: 1 }), error => error === original);
  const after = structuredClone(failedAttempts[0].after);
  rejectLate(new Error('late diagnostic failure')); await new Promise(resolve => setImmediate(resolve));
  assert.equal(after.reason, 'read-timeout'); assert.deepEqual(failedAttempts[0].after, after);
});

function browserGlobals({ missingBridge = false, statusThrows = false } = {}) {
  const calls = { status: 0, diagnostics: 0, forbidden: 0 };
  const forbidden = () => { calls.forbidden += 1; throw new Error('must not call an audio or media mutation'); };
  const attributes = { 'aria-label': '音声を有効にする', 'data-state': 'success' };
  const control = { disabled: false, isConnected: true, getAttribute: key => attributes[key] ?? null,
    getBoundingClientRect: () => ({ x: 10, y: 20, width: 80, height: 24 }) };
  const hit = { tagName: 'B', classList: ['audio-unlock-long'], getAttribute: () => null, closest: () => control };
  const bridge = {
    getAudioStatus() { calls.status += 1; if (statusThrows) throw new Error('private status error'); return { state: 'running', contextState: 'running', needsGesture: false, reason: 'gesture:pointerdown', error: 'private audio error' }; },
    getDiagnostics() { calls.diagnostics += 1; return { unlocked: true, contextState: 'running', contextGeneration: 1, contextCreateCount: 1, audioState: 'running', needsGesture: false, lifecycleHidden: false, disposed: false, activeVoices: 2, activeBgmVoices: 1, activeSceneVoices: 1,
      cache: { failed: 1 }, failedAssets: [{ assetId: 'PRIVATE_ASSET', category: 'bgm', optional: false, src: 'https://private.invalid/?secret=value' }],
      output: { mode: 'media-stream', paused: false, disposed: false, streamId: 'PRIVATE_STREAM' }, settings: { private: 'PRIVATE_SETTINGS' } }; },
  };
  for (const key of ['unlock', 'play', 'setScene', 'suspend', 'recover', 'stopScene', 'stopAll', 'resetCueRequests']) Object.defineProperty(bridge, key, { get: forbidden });
  const windowFixture = { innerWidth: 844, innerHeight: 390, __ASHFALL_AUDIO_QA__: missingBridge ? undefined : bridge,
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1', pointerEvents: 'auto' }) };
  for (const key of ['AudioContext', 'webkitAudioContext', 'Audio', 'MediaRecorder']) Object.defineProperty(windowFixture, key, { get: forbidden });
  const documentFixture = { visibilityState: 'visible', querySelectorAll: selector => { assert.equal(selector, '[data-audio-unlock-control="true"]'); return [control]; }, elementFromPoint: () => hit, createElement: forbidden };
  Object.defineProperty(documentFixture, 'body', { get: forbidden });
  return { globals: { window: windowFixture, document: documentFixture, performance: { now: () => 1234 } }, calls, control };
}

test('serialized browser readback is self-contained, calls only approved getters and drops private fields', () => {
  const fixture = browserGlobals();
  const result = vm.runInNewContext('(' + readNormalAudioUnlockSnapshot.toString() + ')()', fixture.globals);
  assert.equal(result.audioStatus.value.state, 'running'); assert.equal(result.diagnostics.value.unlocked, true);
  assert.equal(result.controls.values[0].topHit.sameMarkedControl, true);
  assert.deepEqual(fixture.calls, { status: 1, diagnostics: 1, forbidden: 0 });
  const raw = JSON.stringify(result);
  for (const text of ['PRIVATE_', 'private.invalid', 'private audio error']) assert.equal(raw.includes(text), false);
});

test('missing bridge is unknown and a failed status getter remains separate from readable diagnostics', () => {
  const missing = browserGlobals({ missingBridge: true });
  const unknown = vm.runInNewContext('(' + readNormalAudioUnlockSnapshot.toString() + ')()', missing.globals);
  assert.equal(unknown.audioStatus.status, 'unknown'); assert.equal(unknown.diagnostics.status, 'unknown');
  assert.equal(unknown.controls.status, 'ok'); assert.equal(missing.calls.forbidden, 0);
  const failed = browserGlobals({ statusThrows: true });
  const data = vm.runInNewContext('(' + readNormalAudioUnlockSnapshot.toString() + ')()', failed.globals);
  assert.equal(data.audioStatus.status, 'data-error'); assert.equal(data.diagnostics.status, 'ok');
  assert.equal(JSON.stringify(data).includes('private status error'), false); assert.equal(failed.calls.forbidden, 0);
});

test('unrecognized marked-control labels and large DOM/asset sets stay bounded without body text', () => {
  const fixture = browserGlobals();
  fixture.control.getAttribute = key => key === 'aria-label' ? 'PRIVATE_PLAYER_NAME' : key === 'data-state' ? 'partial' : null;
  fixture.globals.document.querySelectorAll = () => Array.from({ length: 10 }, () => fixture.control);
  fixture.globals.window.__ASHFALL_AUDIO_QA__.getDiagnostics = () => ({ unlocked: true, failedAssets: Array.from({ length: 70 }, () => ({ category: 'bgm', optional: true })) });
  const result = vm.runInNewContext('(' + readNormalAudioUnlockSnapshot.toString() + ')()', fixture.globals);
  assert.equal(result.controls.total, 10); assert.equal(result.controls.values.length, 4); assert.equal(result.controls.truncated, true);
  assert.equal(result.controls.values[0].ariaLabel, null); assert.equal(result.controls.values[0].dataState, 'partial');
  assert.equal(result.diagnostics.value.failedAssetCount, 70); assert.equal(result.diagnostics.value.failedCategories.length, 64);
  assert.equal(result.diagnostics.value.failedCategoriesTruncated, true); assert.equal(JSON.stringify(result).includes('PRIVATE_PLAYER_NAME'), false);
});
