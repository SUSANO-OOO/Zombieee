// Bounded diagnostic muxer, not a production audio backend. No browser/Node APIs.
// https://www.w3.org/TR/mse-byte-stream-format-webm/
// https://www.webmproject.org/docs/container/
// https://www.matroska.org/technical/elements.html (CodecDelay, BlockDuration)
// https://www.ietf.org/archive/id/draft-ietf-cellar-codec-20.html#section-3.4.32
// https://datatracker.ietf.org/doc/html/rfc7845#section-5.1
// https://datatracker.ietf.org/doc/html/rfc6716#section-3
const check = (ok, message) => { if (!ok) throw new Error(message); };
const bytes = value => {
  if (value instanceof Uint8Array) return value.slice();
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (Array.isArray(value) && value.every(item => Number.isInteger(item) && item >= 0 && item <= 255)) return Uint8Array.from(value);
  throw new Error("Expected original byte array");
};
const join = parts => {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
};
const uint = value => {
  check(Number.isSafeInteger(value) && value >= 0, "Invalid unsigned EBML integer");
  let number = BigInt(value), width = 1;
  while (number >= (1n << BigInt(width * 8))) width++;
  const result = new Uint8Array(width);
  for (let i = width - 1; i >= 0; i--) { result[i] = Number(number & 255n); number >>= 8n; }
  return result;
};
const size = value => {
  check(Number.isSafeInteger(value) && value >= 0, "Invalid EBML size");
  let width = 1;
  while (BigInt(value) >= (1n << BigInt(7 * width)) - 1n) width++;
  check(width <= 8, "EBML element exceeds its size range");
  let number = BigInt(value) | (1n << BigInt(7 * width));
  const result = new Uint8Array(width);
  for (let i = width - 1; i >= 0; i--) { result[i] = Number(number & 255n); number >>= 8n; }
  return result;
};
const element = (id, payload) => join([uint(id), size(payload.length), payload]);
const integer = (id, value) => element(id, uint(value));
const text = (id, value) => element(id, new TextEncoder().encode(value));
const master = (id, children) => element(id, join(children));
const float = (id, value) => {
  const payload = new Uint8Array(8); new DataView(payload.buffer).setFloat64(0, value);
  return element(id, payload);
};

export function parseNativeOpusHead(description, configuration) {
  const original = bytes(description);
  check(original.length === 19, "This stereo diagnostic requires the exact 19-byte native OpusHead");
  check(String.fromCharCode(...original.subarray(0, 8)) === "OpusHead", "Native description is not OpusHead");
  const view = new DataView(original.buffer, original.byteOffset, original.byteLength);
  const header = { version: original[8], channels: original[9], preSkipSamples: view.getUint16(10, true),
    inputSampleRate: view.getUint32(12, true), outputGainQ8: view.getInt16(16, true), mappingFamily: original[18] };
  check(header.version === 1 && header.mappingFamily === 0 && [1, 2].includes(header.channels), "Unsupported native OpusHead version/channel mapping");
  check(configuration?.codec === "opus" && configuration.sampleRate === 48000
    && configuration.numberOfChannels === header.channels, "Native OpusHead and decoder configuration disagree");
  check(header.inputSampleRate === 48000, "Native OpusHead did not retain the requested 48kHz input rate");
  const exactDelay = header.preSkipSamples * 1e9 / 48000;
  return { ...header, original, codecDelayNs: Math.round(exactDelay), codecDelayRoundingNs: Math.round(exactDelay) - exactDelay,
    seekPreRollNs: 80000000, timestampScaleNs: 1000 };
}

// RFC 6716 packet framing: read the TOC rather than trusting WebCodecs.duration.
// Validate framing lengths, including zero-length DTX frames; no codec decoding.
export function inspectOpusPacket(value) {
  const packet = bytes(value); check(packet.length > 0, "Empty native Opus packet");
  const config = packet[0] >> 3, code = packet[0] & 3;
  const frameDurationUs = config < 12 ? [10000, 20000, 40000, 60000][config & 3]
    : config < 16 ? [10000, 20000][config & 1] : [2500, 5000, 10000, 20000][config & 3];
  let cursor = 1, end = packet.length, frameCount = code === 0 ? 1 : 2, variable = code === 2;
  if (code === 3) {
    check(cursor < end, "Truncated Opus frame-count byte");
    const flags = packet[cursor++]; frameCount = flags & 63; variable = Boolean(flags & 128);
    check(frameCount > 0, "Opus frame count is zero");
    if (flags & 64) {
      let padding = 0, last;
      do { check(cursor < end, "Truncated Opus padding length"); last = packet[cursor++]; padding += last === 255 ? 254 : last; } while (last === 255);
      end -= padding; check(end >= cursor, "Opus padding exceeds its native packet");
    }
  }
  check(frameCount * frameDurationUs <= 120000, "Opus packet exceeds 120ms");
  const frameBytes = [];
  if (variable) {
    let consumed = 0;
    for (let i = 0; i < frameCount - 1; i++) {
      check(cursor < end, "Truncated Opus frame length");
      const first = packet[cursor++]; let length = first;
      if (first >= 252) { check(cursor < end, "Truncated long Opus frame length"); length += 4 * packet[cursor++]; }
      check(length <= 1275, "Opus frame exceeds 1275 bytes"); frameBytes.push(length); consumed += length;
    }
    const last = end - cursor - consumed;
    check(last >= 0 && last <= 1275, "Invalid Opus VBR payload lengths"); frameBytes.push(last);
  } else {
    check((end - cursor) % frameCount === 0, "Invalid Opus CBR payload length");
    const length = (end - cursor) / frameCount; check(length <= 1275, "Opus frame exceeds 1275 bytes");
    for (let i = 0; i < frameCount; i++) frameBytes.push(length);
  }
  return { config, code, frameCount, frameDurationUs, durationUs: frameCount * frameDurationUs, frameBytes };
}

export class OpusWebmMuxer {
  constructor(description, configuration) {
    this.header = parseNativeOpusHead(description, configuration);
    this.lastTimestamp = null; this.lastDuration = null;
    const ebml = master(0x1a45dfa3, [integer(0x4286, 1), integer(0x42f7, 1), integer(0x42f2, 4),
      integer(0x42f3, 8), text(0x4282, "webm"), integer(0x4287, 4), integer(0x4285, 2)]);
    const info = master(0x1549a966, [integer(0x2ad7b1, this.header.timestampScaleNs),
      text(0x4d80, "v177-opus-diagnostic"), text(0x5741, "v177-opus-diagnostic")]);
    const track = master(0xae, [integer(0xd7, 1), integer(0x73c5, 1), integer(0x83, 2), integer(0x9c, 0),
      text(0x86, "A_OPUS"), element(0x63a2, this.header.original), integer(0x56aa, this.header.codecDelayNs),
      integer(0x56bb, this.header.seekPreRollNs), integer(0x23e383, 10000000),
      master(0xe1, [float(0xb5, this.header.inputSampleRate), integer(0x9f, this.header.channels)])]);
    // Unknown Segment size is allowed for MSE. Each following Cluster is finite.
    this.initializationSegment = join([ebml, uint(0x18538067), Uint8Array.of(1, 255, 255, 255, 255, 255, 255, 255), info, master(0x1654ae6b, [track])]);
  }

  segment({ data, timestamp, duration }) {
    const packet = bytes(data), framing = inspectOpusPacket(packet);
    check(Number.isSafeInteger(timestamp) && timestamp >= -32768, "Native Opus timestamp cannot be represented exactly");
    check(Number.isSafeInteger(duration) && duration === 10000 && framing.durationUs === duration,
      "Native Opus TOC and duration must both be exactly 10ms");
    if (this.lastTimestamp !== null) check(timestamp === this.lastTimestamp + this.lastDuration, "Native Opus packet clock has a gap, overlap or reordering");
    // 1us ticks retain native integer microseconds. Do not zero, shift or speed up
    // timestamps. CodecDelay is declarative codec metadata, never a clock offset.
    const clusterTimestamp = Math.max(0, timestamp), relative = timestamp - clusterTimestamp;
    const blockHeader = new Uint8Array(4); blockHeader[0] = 0x81;
    new DataView(blockHeader.buffer).setInt16(1, relative); blockHeader[3] = 0;
    const group = master(0xa0, [element(0xa1, join([blockHeader, packet])), integer(0x9b, duration)]);
    const cluster = master(0x1f43b675, [integer(0xe7, clusterTimestamp), group]);
    this.lastTimestamp = timestamp; this.lastDuration = duration;
    return cluster;
  }
}
