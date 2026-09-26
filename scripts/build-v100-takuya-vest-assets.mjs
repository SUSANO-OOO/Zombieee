import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const relative = value => path.join(root, value.replaceAll('/', path.sep));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

const sources = Object.freeze({
  stage3: 'assets/source/v100/takuya/takuya-stage3-vest-source-v2.png',
  omega: 'assets/source/v100/enemies/takuya-omega-vest-atlas-source-v3.png',
  identity: 'assets/source/v100/enemies/takuya-omega-identity-master-vest-r3.png',
  ending: 'assets/source/v100/cuts/takuya-omega-defeat-vest-source-v3.png',
});
const outputs = Object.freeze({
  stage3: 'public/art/v100/bosses/takuya-battle-vest-v2.png',
  omega: 'public/art/v100/bosses/takuya-omega-battle-vest-v3.png',
  portrait: 'public/art/v100/portraits/takuya-omega-event-portrait-vest-v2.webp',
  ending: 'public/art/v100/cuts/takuya-omega-ending-defeat-vest-v3.webp',
});

const sourceHash = {};
for (const [key, source] of Object.entries(sources)) sourceHash[key] = sha256(await fs.readFile(relative(source)));

function alphaBounds(pixels, imageWidth, cell) {
  let left = cell.width;
  let top = cell.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < cell.height; y++) for (let x = 0; x < cell.width; x++) {
    const alpha = pixels[((cell.top + y) * imageWidth + cell.left + x) * 4 + 3];
    if (alpha < 8) continue;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  }
  assert.ok(right >= left && bottom >= top, `empty generated frame at ${cell.left},${cell.top}`);
  return { left: cell.left + left, top: cell.top + top, width: right - left + 1, height: bottom - top + 1 };
}

async function frameFromSource(image, raw, cell, rect) {
  const bound = alphaBounds(raw.data, raw.info.width, cell);
  const input = await sharp(image).extract(bound).resize(rect.width, rect.height, { fit: 'fill' }).png().toBuffer();
  return { input, bound };
}

const stage3Original = JSON.parse(await fs.readFile(relative('public/art/v100/bosses/takuya-battle-repaired-v1-metadata.json'), 'utf8'));
const stage3Source = await fs.readFile(relative(sources.stage3));
const stage3Info = await sharp(stage3Source).metadata();
assert.deepEqual([stage3Info.width, stage3Info.height], [2172, 724]);
const stage3Raw = await sharp(stage3Source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const stage3Layers = [];
const stage3Bounds = [];
for (let index = 0; index < 6; index++) {
  const [left, top, right, bottom] = stage3Original.visibleRects[index];
  const { input, bound } = await frameFromSource(stage3Source, stage3Raw,
    { left: index * 362, top: 0, width: 362, height: 724 },
    { width: right - left, height: bottom - top });
  stage3Layers.push({ input, left: index * 512 + left, top });
  stage3Bounds.push(bound);
}
const stage3Atlas = await sharp({ create: { width: 3072, height: 757, channels: 4, background: transparent } })
  .composite(stage3Layers).png().toBuffer();
await fs.writeFile(relative(outputs.stage3), stage3Atlas);
const stage3Metadata = {
  ...stage3Original,
  path: '/art/v100/bosses/takuya-battle-vest-v2.png',
  sourcePath: sources.stage3,
  sourceSha256: sourceHash.stage3,
  atlasSha256: sha256(stage3Atlas),
  frameSourceBounds: stage3Bounds,
  costumeContinuity: 'orange emergency vest remnants, six pose-aligned frames',
};
await fs.writeFile(relative('public/art/v100/bosses/takuya-battle-vest-v2-metadata.json'), JSON.stringify(stage3Metadata, null, 2) + '\n');

const omegaOriginal = JSON.parse(await fs.readFile(relative('public/art/v100/bosses/takuya-omega-battle-v2-metadata.json'), 'utf8'));
const omegaSource = await fs.readFile(relative(sources.omega));
const omegaInfo = await sharp(omegaSource).metadata();
assert.deepEqual([omegaInfo.width, omegaInfo.height], [2172, 724]);
// The image edit preserves an 8 by 2 grid. Four extra columns of transparent
// width make each source cell integral; the placed frames retain the reviewed
// V1.0.0 geometry, ground line, and mirrored direction rows.
const omegaGrid = await sharp(omegaSource).resize(2176, 724, { fit: 'fill' }).png().toBuffer();
const omegaRaw = await sharp(omegaGrid).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const omegaLayers = [];
const omegaBounds = [];
for (let index = 0; index < 8; index++) {
  const rect = omegaOriginal.frames[index].contentRect;
  const { input, bound } = await frameFromSource(omegaGrid, omegaRaw,
    { left: index * 272, top: 362, width: 272, height: 362 },
    { width: rect.width, height: rect.height });
  omegaLayers.push({ input, left: index * 544 + rect.x, top: 512 + rect.y });
  omegaLayers.push({ input: await sharp(input).flop().png().toBuffer(), left: index * 544 + (544 - rect.x - rect.width), top: rect.y });
  omegaBounds.push(bound);
}
const omegaAtlas = await sharp({ create: { width: 4352, height: 1024, channels: 4, background: transparent } })
  .composite(omegaLayers).png().toBuffer();
await fs.writeFile(relative(outputs.omega), omegaAtlas);
const omegaMetadata = {
  ...omegaOriginal,
  repair: 'reviewed-costume-continuity-image-edit-with-locked-frame-geometry',
  identityMaster: sources.identity,
  identityMasterSha256: sourceHash.identity,
  sources: omegaBounds.map((bounds, index) => ({ state: omegaOriginal.frames[index].state, path: sources.omega, sourceSha256: sourceHash.omega, bounds })),
  sha256: sha256(omegaAtlas),
  costumeContinuity: 'orange emergency vest remnants, eight pose-aligned mirrored frames',
};
await fs.writeFile(relative('public/art/v100/bosses/takuya-omega-battle-vest-v3-metadata.json'), JSON.stringify(omegaMetadata, null, 2) + '\n');

const portrait = await sharp(relative(sources.identity)).webp({ quality: 88, effort: 6 }).toBuffer();
const ending = await sharp(relative(sources.ending)).webp({ quality: 88, effort: 6 }).toBuffer();
await fs.writeFile(relative(outputs.portrait), portrait);
await fs.writeFile(relative(outputs.ending), ending);
const provenance = {
  generator: 'scripts/build-v100-takuya-vest-assets.mjs',
  editMethod: 'built-in image generation, precise costume edit of reviewed original TAKUYA assets',
  preservedIdentity: ['pale hair', 'black protective eyewear', 'cheek scar', 'asymmetric body', 'chains', 'back tubes', 'weapon'],
  sourceSha256: sourceHash,
  outputSha256: Object.fromEntries(Object.entries(outputs).map(([key, output]) => [key, { path: output, sha256: sha256(({ stage3: stage3Atlas, omega: omegaAtlas, portrait, ending })[key]) }])),
};
await fs.writeFile(relative('assets/source/v100/takuya/takuya-vest-v2.provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
console.log(JSON.stringify(provenance.outputSha256, null, 2));
