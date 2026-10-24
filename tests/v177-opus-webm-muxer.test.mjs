import test from "node:test";
import assert from "node:assert/strict";
import { OpusWebmMuxer, parseNativeOpusHead, inspectOpusPacket } from "../scripts/v177-opus-webm-muxer.mjs";

const configuration = { codec: "opus", sampleRate: 48000, numberOfChannels: 2 };
const header = (preSkip = 312, gain = -256) => {
  const data = new Uint8Array(19); data.set(new TextEncoder().encode("OpusHead")); data[8] = 1; data[9] = 2;
  const view = new DataView(data.buffer); view.setUint16(10, preSkip, true); view.setUint32(12, 48000, true); view.setInt16(16, gain, true);
  return data;
};
// Independent minimal EBML reader for the binary evidence, not muxer helpers.
function elements(data, start = 0, end = data.length) {
  const rows = []; let cursor = start;
  while (cursor < end) {
    const first = data[cursor]; let width = 1;
    while (width <= 4 && !(first & (1 << (8 - width)))) width++;
    assert.ok(width <= 4 && cursor + width < end, "Valid EBML ID");
    let id = 0; for (let i = 0; i < width; i++) id = id * 256 + data[cursor++];
    const sizeFirst = data[cursor]; let sizeWidth = 1;
    while (sizeWidth <= 8 && !(sizeFirst & (1 << (8 - sizeWidth)))) sizeWidth++;
    assert.ok(sizeWidth <= 8 && cursor + sizeWidth <= end, "Valid EBML size");
    let size = BigInt(data[cursor++] & ((1 << (8 - sizeWidth)) - 1));
    for (let i = 1; i < sizeWidth; i++) size = size * 256n + BigInt(data[cursor++]);
    const unknown = size === (1n << BigInt(sizeWidth * 7)) - 1n;
    const stop = unknown ? end : cursor + Number(size); assert.ok(stop <= end, "EBML payload fits its boundary");
    rows.push({ id, start: cursor, end: stop, data: data.slice(cursor, stop), unknown }); cursor = stop;
  }
  assert.equal(cursor, end); return rows;
}
const child = (parent, id) => { const found = elements(parent.data).find(row => row.id === id); assert.ok(found, "Element " + id.toString(16)); return found; };
const number = row => [...row.data].reduce((sum, byte) => sum * 256 + byte, 0);
const packet = () => Uint8Array.of(0x94, 0x11, 0x22, 0x33);

test("native OpusHead retains pre-skip, signed gain and original byte identity", () => {
  const original = header(), parsed = parseNativeOpusHead(original, configuration);
  assert.equal(parsed.preSkipSamples, 312); assert.equal(parsed.codecDelayNs, 6500000);
  assert.equal(parsed.codecDelayRoundingNs, 0); assert.equal(parsed.outputGainQ8, -256);
  assert.equal(parsed.seekPreRollNs, 80000000); assert.deepEqual(parsed.original, original);
  original[10] = 0; assert.equal(parsed.original[10], 56, "Description is copied before caller mutation");
  assert.ok(Math.abs(parseNativeOpusHead(header(317), configuration).codecDelayRoundingNs) <= .5);
});

test("absent, invented, extended or mismatched native descriptions fail closed", () => {
  for (const description of [[], new Uint8Array(19), [...header(), 0], header().slice(0, 18)]) {
    assert.throws(() => parseNativeOpusHead(description, configuration));
  }
  for (const [index, value] of [[8, 2], [9, 3], [18, 1], [12, 0]]) {
    const bad = header(); bad[index] = value; assert.throws(() => parseNativeOpusHead(bad, configuration));
  }
  for (const config of [{ ...configuration, codec: "mp4a.40.2" }, { ...configuration, sampleRate: 44100 },
    { ...configuration, numberOfChannels: 1 }]) assert.throws(() => parseNativeOpusHead(header(), config));
});

test("MSE initialization carries exact native private data and codec timing metadata", () => {
  const original = header(), muxer = new OpusWebmMuxer(original, configuration), top = elements(muxer.initializationSegment);
  assert.deepEqual(top.map(row => row.id), [0x1a45dfa3, 0x18538067]); assert.equal(top[1].unknown, true);
  assert.equal(new TextDecoder().decode(child(top[0], 0x4282).data), "webm");
  const segmentChildren = elements(top[1].data); assert.deepEqual(segmentChildren.map(row => row.id), [0x1549a966, 0x1654ae6b]);
  assert.equal(number(child(segmentChildren[0], 0x2ad7b1)), 1000, "Microsecond native timestamps are lossless");
  const track = child(segmentChildren[1], 0xae);
  assert.equal(new TextDecoder().decode(child(track, 0x86).data), "A_OPUS");
  assert.deepEqual(child(track, 0x63a2).data, original);
  assert.equal(number(child(track, 0x56aa)), 6500000); assert.equal(number(child(track, 0x56bb)), 80000000);
  assert.equal(number(child(track, 0x23e383)), 10000000);
  const audio = child(track, 0xe1); assert.equal(number(child(audio, 0x9f)), 2);
  const sampleRate = child(audio, 0xb5).data; assert.equal(new DataView(sampleRate.buffer).getFloat64(0), 48000);
});

test("finite Clusters preserve native payload, absolute microseconds and per-packet duration", () => {
  const muxer = new OpusWebmMuxer(header(), configuration);
  for (const timestamp of [12345, 22345, 32345]) {
    const raw = packet(), part = muxer.segment({ data: raw, timestamp, duration: 10000 }), cluster = elements(part)[0];
    assert.equal(cluster.id, 0x1f43b675); assert.equal(cluster.unknown, false);
    const group = child(cluster, 0xa0), block = child(group, 0xa1);
    const relative = new DataView(block.data.buffer).getInt16(1);
    assert.equal(number(child(cluster, 0xe7)) + relative, timestamp);
    assert.deepEqual(block.data.slice(4), raw); assert.equal(number(child(group, 0x9b)), 10000);
    assert.equal(block.data[0], 0x81); assert.equal(block.data[3], 0, "No lacing or invisible flag hides codec content");
  }
});

test("negative native timestamps are represented, never zeroed or shifted by codec delay", () => {
  const muxer = new OpusWebmMuxer(header(), configuration);
  for (const timestamp of [-6500, 3500, 13500]) {
    const cluster = elements(muxer.segment({ data: packet(), timestamp, duration: 10000 }))[0];
    const block = child(child(cluster, 0xa0), 0xa1);
    assert.equal(number(child(cluster, 0xe7)) + new DataView(block.data.buffer).getInt16(1), timestamp);
  }
});

test("packet clock errors, metadata duration and actual TOC mismatch are rejected without repair", () => {
  const muxer = new OpusWebmMuxer(header(), configuration);
  muxer.segment({ data: packet(), timestamp: 0, duration: 10000 });
  for (const timestamp of [0, 9999, 10001, 20000, NaN, -32769, .5]) {
    assert.throws(() => muxer.segment({ data: packet(), timestamp, duration: 10000 }));
  }
  for (const duration of [null, 20000, 9999, NaN]) assert.throws(() => muxer.segment({ data: packet(), timestamp: 10000, duration }));
  assert.throws(() => muxer.segment({ data: Uint8Array.of(0x9c, 1), timestamp: 10000, duration: 10000 }), /TOC/);
  assert.doesNotThrow(() => muxer.segment({ data: packet(), timestamp: 10000, duration: 10000 }));
});

test("RFC 6716 TOC durations are inspected across SILK, hybrid and CELT", () => {
  for (let config = 0; config < 32; config++) {
    const expected = config < 12 ? [10000, 20000, 40000, 60000][config & 3]
      : config < 16 ? [10000, 20000][config & 1] : [2500, 5000, 10000, 20000][config & 3];
    assert.equal(inspectOpusPacket(Uint8Array.of(config << 3, 7)).durationUs, expected);
  }
  assert.equal(inspectOpusPacket(Uint8Array.of(0x8d, 1, 2)).durationUs, 10000, "Two 5ms frames");
  assert.equal(inspectOpusPacket(Uint8Array.of(0x87, 4, 1, 2, 3, 4)).durationUs, 10000, "Four 2.5ms frames");
  assert.equal(inspectOpusPacket(Uint8Array.of(0x94)).durationUs, 10000, "Zero-length DTX frame is valid framing");
});

test("VBR, padding and native packet framing boundaries remain explicit", () => {
  assert.deepEqual(inspectOpusPacket(Uint8Array.of(0x96, 1, 10, 11, 12)).frameBytes, [1, 2]);
  assert.deepEqual(inspectOpusPacket(Uint8Array.of(0x97, 0x82, 1, 10, 11, 12)).frameBytes, [1, 2]);
  assert.deepEqual(inspectOpusPacket(Uint8Array.of(0x97, 0x42, 1, 10, 11, 0)).frameBytes, [1, 1]);
  for (const bad of [[], [0x95, 1], [0x96], [0x96, 252], [0x96, 5, 1], [0x97], [0x97, 0],
    [0x97, 0x42], [0x97, 0x42, 255], [0x97, 0x42, 5, 1], [0x9f, 7, 1], [0x97, 0x82, 255]]) {
    assert.throws(() => inspectOpusPacket(bad));
  }
  assert.throws(() => inspectOpusPacket(new Uint8Array(1277).fill(0x94)), /1275/);
});

test("EBML VINT size boundaries retain all payload bytes", () => {
  for (const length of [122, 123, 127, 128, 255, 256, 1276]) {
    const data = new Uint8Array(length); data[0] = 0x94;
    const muxer = new OpusWebmMuxer(header(), configuration), cluster = elements(muxer.segment({ data, timestamp: 0, duration: 10000 }))[0];
    assert.deepEqual(child(child(cluster, 0xa0), 0xa1).data.slice(4), data);
  }
});
