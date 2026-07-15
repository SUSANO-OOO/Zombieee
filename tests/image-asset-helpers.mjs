import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function readPngHeader(bytes) {
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("Invalid PNG signature");
  if (bytes.toString("ascii", 12, 16) !== "IHDR") throw new Error("PNG is missing IHDR");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
    interlace: bytes[28],
  };
}

function paeth(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}

export function decodeRgbaPng(bytes) {
  const header = readPngHeader(bytes);
  if (header.bitDepth !== 8 || header.colorType !== 6 || header.interlace !== 0) {
    throw new Error(`Expected non-interlaced 8-bit RGBA PNG, got ${JSON.stringify(header)}`);
  }

  const idat = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    if (type === "IDAT") idat.push(bytes.subarray(dataStart, dataStart + length));
    offset = dataStart + length + 4;
    if (type === "IEND") break;
  }
  if (idat.length === 0) throw new Error("PNG is missing IDAT");

  const packed = inflateSync(Buffer.concat(idat));
  const stride = header.width * 4;
  const expected = (stride + 1) * header.height;
  if (packed.length !== expected) throw new Error(`Unexpected PNG payload length: ${packed.length} != ${expected}`);
  const rgba = Buffer.alloc(stride * header.height);
  for (let y = 0; y < header.height; y += 1) {
    const inputRow = y * (stride + 1);
    const outputRow = y * stride;
    const filter = packed[inputRow];
    for (let x = 0; x < stride; x += 1) {
      const raw = packed[inputRow + 1 + x];
      const left = x >= 4 ? rgba[outputRow + x - 4] : 0;
      const above = y > 0 ? rgba[outputRow - stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? rgba[outputRow - stride + x - 4] : 0;
      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + above;
      else if (filter === 3) value = raw + Math.floor((left + above) / 2);
      else if (filter === 4) value = raw + paeth(left, above, upperLeft);
      else throw new Error(`Unsupported PNG filter: ${filter}`);
      rgba[outputRow + x] = value & 0xff;
    }
  }
  return { ...header, data: rgba };
}

export function alphaBounds(decoded, rect = { x: 0, y: 0, w: decoded.width, h: decoded.height }) {
  let left = rect.x + rect.w;
  let top = rect.y + rect.h;
  let right = rect.x;
  let bottom = rect.y;
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      if (decoded.data[(y * decoded.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  return right > left && bottom > top ? { x: left, y: top, w: right - left, h: bottom - top } : null;
}

export function hasTransparentPerimeter(decoded, rect, gutter) {
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      const edge = x < rect.x + gutter || x >= rect.x + rect.w - gutter || y < rect.y + gutter || y >= rect.y + rect.h - gutter;
      if (edge && decoded.data[(y * decoded.width + x) * 4 + 3] !== 0) return false;
    }
  }
  return true;
}

export function decodeWebpDimensions(bytes) {
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("Invalid WebP RIFF container");
  }
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (data + size > bytes.length) throw new Error(`Truncated WebP ${type} chunk`);
    if (type === "VP8X") {
      return {
        width: bytes.readUIntLE(data + 4, 3) + 1,
        height: bytes.readUIntLE(data + 7, 3) + 1,
        codec: type,
      };
    }
    if (type === "VP8L") {
      if (bytes[data] !== 0x2f) throw new Error("Invalid VP8L signature");
      const bits = bytes.readUInt32LE(data + 1);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, codec: type };
    }
    if (type === "VP8 ") {
      if (!bytes.subarray(data + 3, data + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) throw new Error("Invalid VP8 frame header");
      return {
        width: bytes.readUInt16LE(data + 6) & 0x3fff,
        height: bytes.readUInt16LE(data + 8) & 0x3fff,
        codec: type,
      };
    }
    offset = data + size + (size & 1);
  }
  throw new Error("WebP image chunk not found");
}
