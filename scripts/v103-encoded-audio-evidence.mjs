import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// This function is serialized into the owned hosted page. An offline decoder
// must never create another hardware playback context or replace native errors.
export async function decodeNativeEncodedAudio(bytes) {
  const decoder = new globalThis.OfflineAudioContext(2, 1, 44100);
  const buffer = await decoder.decodeAudioData(Uint8Array.from(bytes).buffer);
  let sum = 0, peak = 0, count = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    for (const value of buffer.getChannelData(channel)) {
      sum += value * value;
      peak = Math.max(peak, Math.abs(value));
      count += 1;
    }
  }
  return {rms:Math.sqrt(sum / count), peak, duration:buffer.duration,
    sampleRate:buffer.sampleRate, channels:buffer.numberOfChannels};
}

// The a92 WebKit recording failed its native decoder, and the previous caller
// discarded all encoded bytes. Retain the exact original before that boundary;
// the caller still applies the same duration, RMS, peak and ownership gates.
export async function persistThenDecodeNativeAudio({sample, out, file, label, recordings, decode}) {
  assert.ok(typeof file === 'string' && file.length > 0 && file === path.basename(file)
    && !/[/\\]/u.test(file) && file !== '.' && file !== '..', 'Evidence file must be an owned basename');
  assert.ok(Array.isArray(sample?.bytes), 'Native encoded bytes must be serialized exactly');
  for (const byte of sample.bytes) assert.ok(Number.isInteger(byte) && byte >= 0 && byte <= 255);
  assert.ok(Array.isArray(recordings));
  assert.equal(typeof decode, 'function');
  const {bytes, ...metadata} = sample, raw = Buffer.from(bytes);
  const entry = {...metadata, label, file, bytes:raw.length,
    encodedSha256:createHash('sha256').update(raw).digest('hex'),
    nativeDecodeStatus:'pending'};
  const target = path.join(out, file), sidecar = target + '.json';
  await writeFile(target, raw, {flag:'wx'});
  recordings.push(entry);
  await writeFile(sidecar, JSON.stringify(entry, null, 2), {flag:'wx'});
  if (sample.recordingFailure) {
    entry.nativeDecodeStatus = 'not-attempted';
    entry.nativeRecordStatus = 'failed';
    await writeFile(sidecar, JSON.stringify(entry, null, 2));
    throw new Error(sample.recordingFailure);
  }
  try {
    Object.assign(entry, await decode(Array.from(raw)), {nativeDecodeStatus:'passed'});
  } catch (error) {
    entry.nativeDecodeStatus = 'failed';
    entry.nativeDecodeFailure = String(error);
    await writeFile(sidecar, JSON.stringify(entry, null, 2));
    throw error;
  }
  await writeFile(sidecar, JSON.stringify(entry, null, 2));
  return entry;
}

// Serialized only into an owned hosted QA page. The 2500ms recording window
// starts at the native start event, not at the asynchronous start() API call.
export async function recordNativeEncodedAudio(stream) {
  const timing = { requestedRecordMs: 2500, startTimeoutMs: 2000, stopTimeoutMs: 2000,
    apiStartMs: null, startEventMs: null, stopCallMs: null, stopEventMs: null, chunks: [] };
  const chunks = [];
  let requestedMimeType = null, recorder = null, recordingFailure = null, rejectStart, startTimer, stopTimer;
  let stopped, actualStop, resolveActualStop, stopWaitAttempted = false;
  const now = () => globalThis.performance.now();
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  try {
    requestedMimeType = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"]
      .find(type => MediaRecorder.isTypeSupported(type));
    if (!requestedMimeType) throw new Error("Native audio encoding is unavailable");
    recorder = new MediaRecorder(stream, { mimeType: requestedMimeType });
    const started = new Promise((resolve, reject) => {
      rejectStart = reject;
      recorder.onstart = () => { timing.startEventMs = now(); resolve(); };
    });
    void started.catch(() => {});
    actualStop = new Promise(resolve => { resolveActualStop = resolve; });
    stopped = new Promise((resolve, reject) => {
      recorder.ondataavailable = event => {
        timing.chunks.push({ atMs: now(), bytes: event.data.size, eventTimeStamp: event.timeStamp ?? null });
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => { timing.stopEventMs = now(); resolveActualStop(); resolve(); };
      recorder.onerror = event => { const error = event.error ?? event; recordingFailure ??= String(error); rejectStart(error); reject(error); };
    });
    // A recorder error can arrive while the start event is pending. Keep that
    // same failure observable without producing an unhandled second rejection.
    void stopped.catch(() => {});
    timing.apiStartMs = now();
    recorder.start();
    await Promise.race([started, new Promise((_, reject) => {
      startTimer = setTimeout(() => reject(new Error("Native recorder start event timed out")), timing.startTimeoutMs);
    })]);
    clearTimeout(startTimer);
    await Promise.race([wait(timing.requestedRecordMs), stopped.then(() => { throw new Error("Native recorder stopped before the recording window completed"); })]);
    timing.stopCallMs = now();
    recorder.stop();
    stopWaitAttempted = true;
    await Promise.race([stopped, new Promise((_, reject) => {
      stopTimer = setTimeout(() => reject(new Error("Native recorder stop event timed out")), timing.stopTimeoutMs);
    })]);
  } catch (error) {
    recordingFailure ??= String(error);
  } finally {
    clearTimeout(startTimer); clearTimeout(stopTimer);
    if (recorder && recorder.state !== "inactive") {
      try { timing.stopCallMs ??= now(); recorder.stop(); } catch (error) { recordingFailure ??= String(error); }
    }
    if (stopped && timing.stopEventMs === null) {
      // An error after stop() may reject before its final data/stop events.
      // Drain those events within the same original deadline, never a new one.
      const remainingStopMs = stopWaitAttempted
        ? Math.max(0, timing.stopTimeoutMs - (now() - timing.stopCallMs))
        : timing.stopTimeoutMs;
      if (remainingStopMs > 0) {
        let drainTimer;
        try {
          await Promise.race([actualStop, new Promise(resolve => { drainTimer = setTimeout(resolve, remainingStopMs); })]);
        } finally { clearTimeout(drainTimer); }
      }
    }
    if (recorder) recorder.onstart = recorder.onstop = recorder.ondataavailable = recorder.onerror = null;
  }
  const mimeType = recorder?.mimeType ?? requestedMimeType ?? "";
  const bytes = await new Blob(chunks, { type: mimeType }).arrayBuffer();
  return { mimeType, requestedMimeType, bytes: Array.from(new Uint8Array(bytes)),
    recorderTiming: timing, nativeRecordStatus: recordingFailure ? "failed" : "passed",
    ...(recordingFailure ? { recordingFailure } : {}) };
}
