import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';

import { SPRITE_MANIFEST } from '../app/spriteManifest.js';
import { V100_TAKUYA_SPRITE_GEOMETRY } from '../app/v100TakuyaSpriteGeometry.js';
import { V100_RUNTIME_ASSET_MANIFEST } from '../app/v100RuntimeAssetManifest.js';

const publicFile = (assetPath) => new URL(`../public${assetPath}`, import.meta.url);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const originalArt = Object.freeze([
  ['/art/v100/bosses/takuya-battle-repaired-v1.png', '7baf14827f63faadbf7c05cd17d78edd735012a9def65904b50dae363d633419'],
  ['/art/v100/bosses/takuya-omega-battle-v2.png', '16241ef40b809c2258822af01653d3b04cf02c959e835ff2e427a2338d3756c8'],
  ['/art/v100/portraits/takuya-omega-event-portrait-v1.webp', '4faaac8803005275b0bc105c7d43a4a86a223278698cba8b65e8d7eabb172bf2'],
]);

test('TAKUYA battles and portrait retain the original character art', async () => {
  assert.equal(SPRITE_MANIFEST.takuya.path, originalArt[0][0]);
  assert.equal(V100_TAKUYA_SPRITE_GEOMETRY.path, originalArt[0][0]);
  assert.equal(V100_RUNTIME_ASSET_MANIFEST.bosses['boss-takuya-omega'], originalArt[1][0]);
  assert.equal(V100_RUNTIME_ASSET_MANIFEST.portraits.takuyaOmega, originalArt[2][0]);
  for (const [assetPath, approvedHash] of originalArt) {
    assert.equal(sha256(await readFile(publicFile(assetPath))), approvedHash, assetPath);
  }
  const manifest = JSON.parse(await readFile(publicFile('/asset-manifest.json'), 'utf8'));
  assert.ok(originalArt.every(([assetPath]) => manifest.assets.some((asset) => asset.path === assetPath)));
  assert.equal(manifest.assets.some((asset) => /takuya[^/]*vest/iu.test(asset.path)), false);
});

test('TAKUYA final defeat cut uses the original costume and lossless transport', async () => {
  const provenance = JSON.parse(await readFile(new URL('../assets/source/v100/cuts/takuya-omega-defeat-original-costume-v4.provenance.json', import.meta.url), 'utf8'));
  const source = await readFile(new URL(`../${provenance.sourcePath}`, import.meta.url));
  const transport = await readFile(new URL(`../${provenance.transportPath}`, import.meta.url));
  assert.equal(V100_RUNTIME_ASSET_MANIFEST.storyCuts.takuyaOmegaEndingDefeat, `/${provenance.transportPath.slice('public/'.length)}`);
  assert.equal(sha256(source), provenance.sourceSha256);
  assert.equal(sha256(transport), provenance.transportSha256);
  assert.equal(transport.length, provenance.transportBytes);
  assert.ok((await sharp(source).raw().toBuffer()).equals(await sharp(transport).raw().toBuffer()));
});
