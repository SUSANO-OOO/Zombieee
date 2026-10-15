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
