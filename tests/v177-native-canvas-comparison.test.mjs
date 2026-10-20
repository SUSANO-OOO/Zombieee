import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { NATIVE_CAPTURE_COMPARISON_CASES, assertNativeCaptureDiagnosticHost,
  startNativeCanvasCalibration, stopNativeCanvasCalibration,
  nativeCaptureCalibrationObservation } from '../scripts/v177-native-canvas-comparison.mjs';

test('the diagnostic compares both native containers in both visibility conditions without changing the production default', () => {
  assert.equal(NATIVE_CAPTURE_COMPARISON_CASES.length, 4);
  assert.equal(new Set(NATIVE_CAPTURE_COMPARISON_CASES.map(row => row.id)).size, 4);
  for (const headless of [false, true]) {
    assert.deepEqual(NATIVE_CAPTURE_COMPARISON_CASES.filter(row => row.headless === headless)
      .map(row => row.mimeType).sort(), ['video/mp4', 'video/webm;codecs=vp8']);
  }
});

test('the actual local CLI stops before launching a browser, and only hosted native macOS is allowed', () => {
  for (const [platform, actions] of [['win32', 'true'], ['linux', 'true'], ['darwin', undefined]]) {
    assert.throws(() => assertNativeCaptureDiagnosticHost(platform, actions), /hosted native macOS only/u);
  }
  assertNativeCaptureDiagnosticHost('darwin', 'true');
  if (process.platform !== 'darwin') {
    const run = spawnSync(process.execPath, ['scripts/v177-native-canvas-comparison-browser.mjs'],
      { encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: 'true' } });
    assert.equal(run.status, 1); assert.match(run.stderr, /hosted native macOS only/u);
  }
});

test('calibration paints only its original canvas on actual RAF callbacks and cancels its own loop', () => {
  let now = 100, next = 0; const queue = new Map(), calls = [];
  const context = { fillRect: (...args) => calls.push(args), fillText: () => {} };
  const canvas = { width: 844, height: 340, isConnected: true,
    getContext: type => { assert.equal(type, '2d'); return context; } };
  const globals = { performance: { timeOrigin: 1000, now: () => now },
    requestAnimationFrame: callback => { queue.set(++next, callback); return next; },
    cancelAnimationFrame: id => queue.delete(id) };
  Object.defineProperty(globals, 'AudioContext', { get: () => assert.fail('No audio device') });
  const start = vm.runInNewContext('(' + startNativeCanvasCalibration.toString() + ')', globals);
  const stop = vm.runInNewContext('(' + stopNativeCanvasCalibration.toString() + ')', globals);
  const state = start(canvas);
  for (const at of [117, 139, 165]) {
    now = at; const [id, callback] = queue.entries().next().value; queue.delete(id); callback();
  }
  now = 180; const observation = stop(state);
  assert.equal(observation.drawCount, 4);
  assert.deepEqual(Array.from(observation.draws, draw => draw.at), [100, 117, 139, 165]);
  assert.equal(observation.stoppedAt, 180); assert.equal(observation.originalCanvasUnchanged, true);
  assert.equal(queue.size, 0); assert.equal(calls.length, 8);
});

const source = { timeOrigin: 1000, drawCount: 4, draws: [{ sequence: 0, at: 100 },
  { sequence: 1, at: 117 }, { sequence: 2, at: 139 }, { sequence: 3, at: 165 }],
  originalCanvasUnchanged: true, timingOverflow: false, width: 844, height: 340 };
const clip = { status: 'recorded', timeOrigin: 1000, startedAt: 110, stopRequestedAt: 170,
  stoppedAt: 190, captureWindowMs: 60, nativeElapsedMs: 80, width: 844, height: 340,
  file: 'transport-only.webm', bytes: 3, sha256: 'a'.repeat(64), originalSpeedAccepted: false, encodedPtsVerified: false };

test('observed source paint timing is distinct from encoded-frame or game acceptance', () => {
  const row = nativeCaptureCalibrationObservation(source, clip);
  assert.equal(row.observedSourceDraws, 3); assert.equal(row.maximumSourceDrawGapMs, 26);
  assert.equal(row.nativeStopFlushMs, 20); assert.equal(row.encodedFrameCount, null);
  assert.equal(row.independentlyDecoded, false); assert.equal(row.recorderRouteAccepted, false);
  assert.equal(row.gameQualityAccepted, false); assert.equal(row.physicalIphoneRecordingAccepted, false);
});

test('unsupported and failed native recordings remain explicit measured outcomes, never a quality pass', () => {
  for (const status of ['unsupported', 'invalid']) {
    const row = nativeCaptureCalibrationObservation(source, { ...clip, status, errors: ['original native failure'] });
    assert.equal(row.nativeOutcome, status); assert.equal(row.originalSpeedAccepted, false);
  }
  assert.throws(() => nativeCaptureCalibrationObservation(source, { ...clip, originalSpeedAccepted: true }));
  assert.throws(() => nativeCaptureCalibrationObservation(source, { ...clip, timeOrigin: 2000 }));
  assert.throws(() => nativeCaptureCalibrationObservation(source, { ...clip, persistenceOrCaptureError: 'original persistence failure' }), /original persistence failure/u);
});

test('the diagnostic workflow uses read-only permissions, exact PR head, native Mac and preserved artifacts', () => {
  const workflow = fs.readFileSync(new URL('../.github/workflows/native-capture-comparison.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflow_dispatch:/u); assert.doesNotMatch(workflow, /pull_request:|pull_request_target|continue-on-error/u);
  assert.match(workflow, /contents: read/u); assert.match(workflow, /cancel-in-progress: false/u);
  assert.match(workflow, /runs-on: macos-15-intel/u); assert.match(workflow, /timeout-minutes: 15/u);
  assert.match(workflow, /ref: \$\{\{ inputs\.expected_head \}\}/u);
  assert.match(workflow, /pwa-native-runtime\/node_modules\/playwright\/cli\.js install webkit/u);
  assert.match(workflow, /if: always\(\)/u); assert.match(workflow, /path: outputs\/v177-native-capture-comparison/u);
  assert.doesNotMatch(workflow, /npm run build|pages-release-request|deploy-pages/u);
});
