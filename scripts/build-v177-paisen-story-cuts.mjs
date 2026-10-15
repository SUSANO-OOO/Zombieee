import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {assertPaisenCreditsRegion as assertActorRegion} from './build-v177-paisen-credits.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = 'assets/source/v177/paisen/cuts/registered-story-r1/runtime-adoption-r1.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export async function inspectPaisenStoryCuts({root = projectRoot, assetRoot, out} = {}) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath)));
  assert.equal(manifest.schema, 'v177-paisen-r9-story-photo-identity/1');
  assert.equal(manifest.sceneCount, 9);
  assert.equal(manifest.entries.length, manifest.sceneCount);
  assert.equal(new Set(manifest.entries.map(entry => entry.runtimePath)).size, manifest.sceneCount);
  assert.equal(sha(fs.readFileSync(path.join(root, manifest.identityMaster))), manifest.identityMasterSha256);
  const entries = [];
  for (const entry of manifest.entries) {
    assert.ok(entry.runtimePath.startsWith('/art/v100/story-r'));
    const authoredFile = fs.readFileSync(path.join(root, entry.authorSource));
    const maskFile = fs.readFileSync(path.join(root, entry.approvedRegion));
    assert.equal(sha(authoredFile), entry.authorSourceSha256);
    assert.equal(sha(maskFile), entry.approvedRegionSha256);
    const originalFile = execFileSync('git', ['cat-file', 'blob', entry.originalGitBlob], {cwd: root, maxBuffer: 20e6});
    assert.equal(sha(originalFile), entry.originalSha256);
    const authoredMeta = await sharp(authoredFile).metadata();
    const originalMeta = await sharp(originalFile).metadata();
    assert.deepEqual([authoredMeta.width, authoredMeta.height], [entry.width, entry.height]);
    assert.deepEqual([authoredMeta.width, authoredMeta.height], [originalMeta.width, originalMeta.height]);
    const original = await sharp(originalFile).ensureAlpha().raw().toBuffer();
    const authored = await sharp(authoredFile).ensureAlpha().raw().toBuffer();
    const mask = await sharp(maskFile).ensureAlpha().raw().toBuffer();
    assert.equal(assertActorRegion(original, authored, mask), entry.changedPixels);
    const encoded = await sharp(authoredFile).webp({lossless:true, effort:6}).toBuffer();
    assert.equal(encoded.length, entry.runtimeBytes);
    assert.equal(sha(encoded), entry.runtimeSha256);
    assert.ok((await sharp(encoded).ensureAlpha().raw().toBuffer()).equals(authored), 'Runtime differs from the authored pixels');
    if (assetRoot) assert.ok(fs.readFileSync(path.join(assetRoot, entry.runtimePath.slice(1))).equals(encoded), 'Stale runtime: ' + entry.sceneId);
    if (out) {
      const target = path.join(out, entry.runtimePath.slice(1));
      fs.mkdirSync(path.dirname(target), {recursive:true});
      fs.writeFileSync(target, encoded, {flag:'wx'});
    }
    entries.push({sceneId:entry.sceneId, runtimePath:entry.runtimePath, bytes:encoded.length,
      sha256:entry.runtimeSha256, width:entry.width, height:entry.height,
      changedPixels:entry.changedPixels, outsideRegisteredRegion:0, losslessPixelExact:true});
  }
  return {sceneCount:entries.length, entries, totalByteDelta:manifest.totalByteDelta,
    nativeAccepted:false, producerAccepted:false, wholeGameAccepted:false};
}

const invoked = process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url));
if (invoked) {
  const args = process.argv.slice(2), value = name => {
    const index = args.indexOf(name);
    if (index < 0) return undefined;
    assert.ok(args[index+1] && !args[index+1].startsWith('--'), 'Missing '+name+' value');
    return path.resolve(args[index+1]);
  };
  const out = value('--out'), assetRoot = value('--asset-root');
  assert.ok(out || args.includes('--check'), 'Use --out for a new staging directory or --check for verification');
  console.log(JSON.stringify(await inspectPaisenStoryCuts({out,
    assetRoot:assetRoot ?? (args.includes('--check') ? path.join(projectRoot,'public') : undefined)})));
}
