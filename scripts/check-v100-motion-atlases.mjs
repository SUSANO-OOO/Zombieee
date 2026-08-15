import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CELL_WIDTH = 1280;
const CELL_HEIGHT = 512;
const ATLAS_HEIGHT = CELL_HEIGHT * 2;
const GUTTER = 16;

const ATLASES = Object.freeze([
  {
    asset: "public/art/v100/bosses/mugarian-president-mutated-battle-v1.png",
    metadata: "public/art/v100/bosses/mugarian-president-mutated-battle-v1-metadata.json",
    states: ["entrance", "idle", "move", "attack", "hit", "phase", "death", "defeat"],
  },
  {
    asset: "public/art/v100/bosses/takuya-omega-battle-v1.png",
    metadata: "public/art/v100/bosses/takuya-omega-battle-v1-metadata.json",
    states: ["entrance", "idle", "move", "attack", "hit", "phase", "death", "defeat"],
  },
  ...["knife", "shield", "smg", "commander"].map((role) => ({
    asset: `public/art/v100/enemies/red-panther-${role}-battle-v1.png`,
    metadata: `public/art/v100/enemies/red-panther-${role}-battle-v1-metadata.json`,
    states: ["idle", "move", "attack", "hit", "death"],
  })),
]);

function absolute(relativePath) {
  return path.join(ROOT, relativePath.replaceAll("/", path.sep));
}

function alphaBounds(data, atlasWidth, cellWidth, cellHeight, offsetX, offsetY) {
  let left = cellWidth;
  let top = cellHeight;
  let right = -1;
  let bottom = -1;
  let alphaPixels = 0;
  let partialPixels = 0;
  for (let y = 0; y < cellHeight; y += 1) {
    for (let x = 0; x < cellWidth; x += 1) {
      const alpha = data[((offsetY + y) * atlasWidth + offsetX + x) * 4 + 3];
      if (alpha === 0) continue;
      alphaPixels += 1;
      if (alpha < 255) partialPixels += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  assert.ok(alphaPixels > 0, `empty atlas cell at ${offsetX},${offsetY}`);
  return {
    x: left,
    y: top,
    width: right - left + 1,
    height: bottom - top + 1,
    alphaPixels,
    partialPixels,
  };
}

function assertPerimeterTransparent(data, width, offsetX, offsetY) {
  for (let y = 0; y < CELL_HEIGHT; y += 1) {
    for (let x = 0; x < CELL_WIDTH; x += 1) {
      if (x >= GUTTER && x < CELL_WIDTH - GUTTER && y >= GUTTER && y < CELL_HEIGHT - GUTTER) continue;
      const alpha = data[((offsetY + y) * width + offsetX + x) * 4 + 3];
      assert.equal(alpha, 0, `non-transparent ${GUTTER}px perimeter at ${offsetX},${offsetY}`);
    }
  }
}

function mirroredRect(rect) {
  return {
    x: CELL_WIDTH - rect.x - rect.width,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

async function checkAtlas(record) {
  const metadata = JSON.parse(await readFile(absolute(record.metadata), "utf8"));
  assert.equal(metadata.format, "nishijin-v100-motion-atlas-metadata", `${record.asset} metadata format`);
  assert.equal(metadata.version, 1, `${record.asset} metadata version`);
  assert.deepEqual(metadata.cell, { width: CELL_WIDTH, height: CELL_HEIGHT }, `${record.asset} cell`);
  assert.equal(metadata.noClipping, true, `${record.asset} no clipping contract`);
  assert.deepEqual(metadata.frames.map((frame) => frame.state), record.states, `${record.asset} state order`);

  const sourceBytes = await readFile(absolute(record.asset));
  const { data, info } = await sharp(sourceBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual({ width: info.width, height: info.height }, {
    width: CELL_WIDTH * record.states.length,
    height: ATLAS_HEIGHT,
  }, `${record.asset} dimensions`);
  assert.deepEqual(metadata.atlas, { width: info.width, height: info.height }, `${record.asset} metadata dimensions`);

  for (let index = 0; index < record.states.length; index += 1) {
    const frame = metadata.frames[index];
    assert.equal(frame.clipped, false, `${record.asset}/${frame.state} clipped`);
    const leftOffsetX = index * CELL_WIDTH;
    const left = alphaBounds(data, info.width, CELL_WIDTH, CELL_HEIGHT, leftOffsetX, CELL_HEIGHT);
    const right = alphaBounds(data, info.width, CELL_WIDTH, CELL_HEIGHT, leftOffsetX, 0);
    const expected = {
      x: frame.contentRect.x,
      y: frame.contentRect.y,
      width: frame.contentRect.width,
      height: frame.contentRect.height,
    };
    assert.deepEqual(left, { ...expected, alphaPixels: left.alphaPixels, partialPixels: left.partialPixels }, `${record.asset}/${frame.state} metadata bounds`);
    assert.deepEqual(right, { ...mirroredRect(expected), alphaPixels: right.alphaPixels, partialPixels: right.partialPixels }, `${record.asset}/${frame.state} mirrored bounds`);
    assert.equal(left.alphaPixels, right.alphaPixels, `${record.asset}/${frame.state} mirrored alpha`);
    assert.ok(left.partialPixels > 0, `${record.asset}/${frame.state} retains anti-aliased alpha`);
    assertPerimeterTransparent(data, info.width, leftOffsetX, CELL_HEIGHT);
    assertPerimeterTransparent(data, info.width, leftOffsetX, 0);
  }
  return { asset: record.asset, scale: metadata.commonScale, states: record.states.length };
}

const results = [];
for (const record of ATLASES) results.push(await checkAtlas(record));
for (const result of results) console.log(`OK ${result.asset} states=${result.states} commonScale=${result.scale}`);
