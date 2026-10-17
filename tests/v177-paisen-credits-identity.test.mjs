import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {V100_CREDITS_FILM} from '../app/v100CreditsFilm.js';
import {assertPaisenCreditsRegion, inspectPaisenCredits} from '../scripts/build-v177-paisen-credits.mjs';

const manifest = JSON.parse(fs.readFileSync('assets/source/v177/paisen/credits/runtime-adoption-r1.json'));

test('every active Paisen credits scene uses the registered photo identity at its existing URL', () => {
  const actual = V100_CREDITS_FILM.filter(scene => scene.actors.includes('unit-paisen'))
    .map(scene => ({sceneId: scene.id, runtimePath: scene.src}));
  assert.deepEqual(manifest.entries.map(entry => ({sceneId: entry.sceneId, runtimePath: entry.runtimePath})), actual);
  assert.equal(manifest.photoReferences.filter(reference => reference.role.startsWith('Producer authoritative photo')).length, 3);
});

test('all eight runtime illustrations preserve original pixels outside the author regions and encode the sources losslessly', async () => {
  const result = await inspectPaisenCredits({assetRoot: 'public'});
  assert.equal(result.sceneCount, 8);
  assert.ok(result.entries.every(entry => entry.outsideRegisteredRegion === 0 && entry.losslessPixelExact));
});

test('an unrelated changed pixel cannot pass the Paisen source-preservation contract', async () => {
  const entry = manifest.entries[0];
  const originalFile = execFileSync('git', ['cat-file', 'blob', entry.originalGitBlob], {maxBuffer: 20e6});
  const original = await sharp(originalFile).ensureAlpha().raw().toBuffer();
  const authored = await sharp(entry.authorSource).ensureAlpha().raw().toBuffer();
  const mask = await sharp(entry.approvedRegion).ensureAlpha().raw().toBuffer();
  let index = -1;
  for (let i = 0; i < mask.length; i += 4) if (mask[i + 3] === 0) { index = i; break; }
  assert.ok(index >= 0);
  const altered = Buffer.from(authored); altered[index] ^= 1;
  assert.throws(() => assertPaisenCreditsRegion(original, altered, mask), /outside registered Paisen region/);
});
