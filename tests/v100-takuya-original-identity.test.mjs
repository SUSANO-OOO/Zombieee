import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';

import { SPRITE_MANIFEST } from '../app/spriteManifest.js';
import { V100_TAKUYA_SPRITE_GEOMETRY } from '../app/v100TakuyaSpriteGeometry.js';
import { V100_RUNTIME_ASSET_MANIFEST } from '../app/v100RuntimeAssetManifest.js';
import { REJECTED_V100_ART, assertV100ArtAllowed } from '../scripts/rejected-v100-art.mjs';

const publicFile = (assetPath) => new URL(`../public${assetPath}`, import.meta.url);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const originalArt = Object.freeze([
  ['/art/v100/bosses/takuya-battle-repaired-v1.png', '7baf14827f63faadbf7c05cd17d78edd735012a9def65904b50dae363d633419'],
  ['/art/v100/bosses/takuya-omega-battle-v2.png', '16241ef40b809c2258822af01653d3b04cf02c959e835ff2e427a2338d3756c8'],
  ['/art/v100/portraits/takuya-omega-event-portrait-v1.webp', '4faaac8803005275b0bc105c7d43a4a86a223278698cba8b65e8d7eabb172bf2'],
]);

test('rejected TAKUYA sources and regeneration route stay removed', async () => {
  const rejectedFiles = [
    ...Object.values(REJECTED_V100_ART.sources),
    ...Object.values(REJECTED_V100_ART.outputSha256).map(row => row.path),
    'assets/source/v100/takuya/rejected-build-v100-takuya-vest-assets.mjs',
    'scripts/build-v100-takuya-vest-assets.mjs',
  ];
  for (const file of rejectedFiles) {
    await assert.rejects(access(new URL(`../${file}`, import.meta.url)), { code: 'ENOENT' }, file);
  }
  for (const file of Object.values(REJECTED_V100_ART.sources)) assert.throws(() => assertV100ArtAllowed(file), /Rejected producer art/u);
  for (const row of Object.values(REJECTED_V100_ART.outputSha256)) assert.throws(() => assertV100ArtAllowed(row.path.replace(/^public/u, '')), /Rejected producer art/u);
  for (const hash of Object.values(REJECTED_V100_ART.sourceSha256)) assert.throws(() => assertV100ArtAllowed('renamed.png', hash), /Rejected producer art bytes/u);
  for (const row of Object.values(REJECTED_V100_ART.outputSha256)) assert.throws(() => assertV100ArtAllowed('renamed.webp', row.sha256), /Rejected producer art bytes/u);
  for (const [file, hash] of originalArt) assert.doesNotThrow(() => assertV100ArtAllowed(file, hash));
});

test('TAKUYA battles and portrait retain the original character art', async () => {
  assert.equal(SPRITE_MANIFEST.takuya.path, originalArt[0][0]);
  assert.equal(V100_TAKUYA_SPRITE_GEOMETRY.path, originalArt[0][0]);
  assert.equal(V100_RUNTIME_ASSET_MANIFEST.bosses['boss-takuya-omega'], originalArt[1][0]);
  assert.equal(V100_RUNTIME_ASSET_MANIFEST.portraits.takuyaOmega, originalArt[2][0]);
  for (const [assetPath, approvedHash] of originalArt) {
    const candidate=await readFile(publicFile(assetPath));
    if(assetPath.includes('takuya-omega-battle-v2')){
      const baseline=await readFile(new URL('../assets/source/v100/sprite-repairs/omega-published-1.0.3.png',import.meta.url));
      assert.equal(sha256(baseline),approvedHash,'published original identity remains immutable');
      const a=await sharp(baseline).ensureAlpha().raw().toBuffer(),b=await sharp(candidate).ensureAlpha().raw().toBuffer();
      assert.equal(a.length,b.length);
      for(let i=0;i<a.length;i+=4){assert.ok(a.subarray(i,i+3).equals(b.subarray(i,i+3)),'background repair retains all identity colors');assert.ok(b[i+3]<=a[i+3]);}
    }else assert.equal(sha256(candidate), approvedHash, assetPath);
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
