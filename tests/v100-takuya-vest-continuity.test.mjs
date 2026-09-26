import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import sharp from 'sharp';

import { V100_TAKUYA_SPRITE_GEOMETRY } from '../app/v100TakuyaSpriteGeometry.js';
import { V100_RUNTIME_ASSET_MANIFEST } from '../app/v100RuntimeAssetManifest.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = relativePath => path.join(root, relativePath.replaceAll('/', path.sep));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const stagePath = 'public/art/v100/bosses/takuya-battle-vest-v2.png';
const omegaPath = 'public/art/v100/bosses/takuya-omega-battle-vest-v3.png';

async function orangeCounts(atlasPath, cellWidth, rowTop, rects) {
  const { data, info } = await sharp(file(atlasPath)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return rects.map(([left, top, right, bottom], index) => {
    let count = 0;
    for (let y = top; y < Math.min(bottom, top + (bottom - top) * .65); y++) {
      for (let x = left; x < right; x++) {
        const offset = ((rowTop + y) * info.width + index * cellWidth + x) * 4;
        const red = data[offset];
        const green = data[offset + 1];
        const blue = data[offset + 2];
        const alpha = data[offset + 3];
        if (alpha > 160 && red > 130 && red > green * 1.7 && green > blue * 1.35 && green > 30) count++;
      }
    }
    return count;
  });
}

test('Stage 3 and final boss retain visible orange vest fragments in every combat pose', async () => {
  const stageMetadata = JSON.parse(await fs.readFile(file('public/art/v100/bosses/takuya-battle-vest-v2-metadata.json'), 'utf8'));
  const omegaMetadata = JSON.parse(await fs.readFile(file('public/art/v100/bosses/takuya-omega-battle-vest-v3-metadata.json'), 'utf8'));
  const stageBytes = await fs.readFile(file(stagePath));
  const omegaBytes = await fs.readFile(file(omegaPath));
  assert.equal(hash(stageBytes), stageMetadata.atlasSha256);
  assert.equal(hash(omegaBytes), omegaMetadata.sha256);
  assert.equal(V100_TAKUYA_SPRITE_GEOMETRY.path, `/${stagePath.slice('public/'.length)}`);
  assert.equal(V100_TAKUYA_SPRITE_GEOMETRY.atlasSha256, stageMetadata.atlasSha256);
  assert.equal(V100_RUNTIME_ASSET_MANIFEST.bosses['boss-takuya-omega'], `/${omegaPath.slice('public/'.length)}`);
  assert.deepEqual((await sharp(stageBytes).metadata()).width, 3072);
  assert.deepEqual((await sharp(omegaBytes).metadata()).width, 4352);
  const stageOrange = await orangeCounts(stagePath, 512, 0, stageMetadata.visibleRects);
  const omegaRects = omegaMetadata.frames.map(({ contentRect: rect }) => [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height]);
  const omegaOrange = await orangeCounts(omegaPath, 544, 512, omegaRects);
  assert.ok(stageOrange.every(count => count > 400), `Stage 3 vest missing in pose: ${stageOrange}`);
  assert.ok(omegaOrange.every(count => count > 400), `Omega vest missing in pose: ${omegaOrange}`);
});

test('vest edit is source-bound and does not overwrite reviewed original art', async () => {
  const provenance = JSON.parse(await fs.readFile(file('assets/source/v100/takuya/takuya-vest-v2.provenance.json'), 'utf8'));
  const sources = {
    stage3: 'assets/source/v100/takuya/takuya-stage3-vest-source-v2.png',
    omega: 'assets/source/v100/enemies/takuya-omega-vest-atlas-source-v3.png',
    identity: 'assets/source/v100/enemies/takuya-omega-identity-master-vest-r3.png',
    ending: 'assets/source/v100/cuts/takuya-omega-defeat-vest-source-v3.png',
  };
  for (const [key, source] of Object.entries(sources)) {
    assert.equal(hash(await fs.readFile(file(source))), provenance.sourceSha256[key], source);
  }
  for (const output of Object.values(provenance.outputSha256)) {
    assert.equal(hash(await fs.readFile(file(output.path))), output.sha256, output.path);
  }
  for (const original of [
    'public/art/v100/bosses/takuya-battle-repaired-v1.png',
    'public/art/v100/bosses/takuya-omega-battle-v2.png',
  ]) assert.ok((await fs.stat(file(original))).size > 0, original);
});
