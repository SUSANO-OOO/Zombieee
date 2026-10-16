import assert from 'node:assert/strict';

export const NATIVE_CAPTURE_COMPARISON_CASES = Object.freeze([
  { id: 'headless-mp4', headless: true, mimeType: 'video/mp4' },
  { id: 'headless-vp8', headless: true, mimeType: 'video/webm;codecs=vp8' },
  { id: 'headed-mp4', headless: false, mimeType: 'video/mp4' },
  { id: 'headed-vp8', headless: false, mimeType: 'video/webm;codecs=vp8' },
].map(Object.freeze));

export function assertNativeCaptureDiagnosticHost(platform, githubActions) {
  assert.ok(platform === 'darwin' && githubActions === 'true',
    'Native capture comparison is hosted native macOS only; local browser/game/audio launch is prohibited');
}

// This is a synthetic recorder calibration, not a game or a unit-quality test.
// Paint the original canvas directly on its native RAF clock. Do not set a
// capture rate, copy game pictures, or manufacture encoded timestamps.
export function startNativeCanvasCalibration(canvas) {
  if (!canvas?.isConnected) throw Error('Calibration canvas is not connected');
  const context = canvas.getContext('2d');
  if (!context) throw Error('Native 2D canvas is unavailable');
  const state = { canvas, width: canvas.width, height: canvas.height,
    timeOrigin: performance.timeOrigin, startedAt: performance.now(),
    drawCount: 0, draws: [], timingOverflow: false, stopped: false, raf: null };
  const paint = () => {
    if (state.stopped) return;
    const at = performance.now(), sequence = state.drawCount++;
    context.fillStyle = '#14212a'; context.fillRect(0, 0, state.width, state.height);
    context.fillStyle = '#a6c4a5';
    context.fillRect((sequence * 7) % Math.max(1, state.width - 60), 100, 60, 80);
    context.fillStyle = '#efc46b'; context.font = '24px monospace';
    context.fillText('native paint ' + sequence, 24, 40);
    if (state.draws.length < 4096) state.draws.push({ sequence, at });
    else state.timingOverflow = true;
    state.raf = requestAnimationFrame(paint);
  };
  paint();
  return state;
}

export function stopNativeCanvasCalibration(state) {
  if (!state.stopped) {
    state.stopped = true; state.stoppedAt = performance.now();
    cancelAnimationFrame(state.raf);
  }
  return { timeOrigin: state.timeOrigin, startedAt: state.startedAt,
    stoppedAt: state.stoppedAt, drawCount: state.drawCount, draws: state.draws,
    timingOverflow: state.timingOverflow,
    width: state.width, height: state.height,
    originalCanvasUnchanged: state.canvas.isConnected
      && state.canvas.width === state.width && state.canvas.height === state.height };
}

export function nativeCaptureCalibrationObservation(observation, clip) {
  assert.ok(['recorded', 'unsupported', 'invalid'].includes(clip.status));
  assert.equal(clip.originalSpeedAccepted, false);
  assert.equal(clip.encodedPtsVerified, false);
  assert.equal(observation.timeOrigin, clip.timeOrigin, 'source and recorder must share their native clock');
  assert.ok(Number.isSafeInteger(observation.drawCount) && observation.drawCount >= observation.draws.length);
  let previous = null;
  for (const draw of observation.draws) {
    assert.ok(Number.isFinite(draw.at) && Number.isSafeInteger(draw.sequence));
    assert.ok(!previous || draw.at >= previous.at && draw.sequence > previous.sequence);
    previous = draw;
  }
  if (clip.persistenceOrCaptureError) throw Error(clip.persistenceOrCaptureError);
  if (clip.bytes) {
    assert.ok(Number.isSafeInteger(clip.bytes) && clip.bytes > 0 && clip.bytes <= 8 * 1024 * 1024);
    assert.match(clip.sha256, /^[a-f0-9]{64}$/u); assert.equal(typeof clip.file, 'string');
  }
  if (clip.status === 'recorded') {
    assert.ok(clip.bytes && observation.width === clip.width && observation.height === clip.height);
    assert.ok(Number.isFinite(clip.startedAt) && Number.isFinite(clip.stopRequestedAt));
    assert.equal(clip.captureWindowMs, clip.stopRequestedAt - clip.startedAt);
    assert.equal(clip.nativeElapsedMs, clip.stoppedAt - clip.startedAt);
  }
  const within = observation.draws.filter(draw => clip.startedAt !== null
    && clip.stopRequestedAt !== null && draw.at >= clip.startedAt && draw.at <= clip.stopRequestedAt);
  const intervals = within.slice(1).map((draw, i) => draw.at - within[i].at);
  const span = within.length > 1 ? within.at(-1).at - within[0].at : null;
  return { nativeOutcome: clip.status, observedSourceDraws: within.length,
    observedSourceSpanMs: span, maximumSourceDrawGapMs: intervals.length ? Math.max(...intervals) : null,
    meanObservedSourceDrawsPerSecond: span > 0 ? (within.length - 1) * 1000 / span : null,
    sourceCanvasUnchanged: observation.originalCanvasUnchanged,
    sourceTimingOverflow: observation.timingOverflow,
    nativeStopFlushMs: Number.isFinite(clip.stoppedAt) && Number.isFinite(clip.stopRequestedAt)
      ? clip.stoppedAt - clip.stopRequestedAt : null,
    encodedFrameCount: null, independentlyDecoded: false,
    recorderRouteAccepted: false, originalSpeedAccepted: false,
    gameQualityAccepted: false, physicalIphoneRecordingAccepted: false };
}
