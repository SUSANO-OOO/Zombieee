import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const directory = new URL('../assets/source/v177/paisen/battle-r8/', import.meta.url);
const read = name => fs.readFile(new URL(name, directory));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const rgba = async name => sharp(await read(name)).ensureAlpha().raw().toBuffer();
const definition = JSON.parse(await read('parts.json'));

test('the opponent-facing head registration replays exactly and keeps the three-photo identity binding', async () => {
  const result = JSON.parse(execFileSync(process.execPath,
    ['scripts/author-v177-paisen-facing-head.mjs', '--check'], { encoding: 'utf8' }));
  assert.equal(result.check, true); assert.equal(result.files, 5);
  assert.equal(definition.headOrientation.baseFacing, 'right');
  assert.equal(definition.headOrientation.mirroredFacing, 'left');
  assert.equal(definition.identityBinding.path, '/art/v100/portraits/paisen-identity-r2.webp');
  const master = await fs.readFile(new URL('../public' + definition.identityBinding.path, import.meta.url));
  assert.equal(hash(master), definition.identityBinding.sourceSha256);
  assert.equal(definition.order.filter(name => name === 'head').length, 1);
  assert.ok(definition.order.indexOf('head') < definition.order.indexOf('torso'),
    'The existing shirt must cover the generated collar through the actual draw order');
});

test('the nape reaches the actual shirt opening instead of floating in front of it', async () => {
  const current = await rgba('head.png'), rejected = await rgba('registration-r1/head.png'), torso = await rgba('torso.png');
  const y = definition.rig.head[0][1] - 10;
  const span = pixels => {
    let left = 480, right = -1;
    for (let x = 180; x < 285; x++) if (pixels[(y * 480 + x) * 4 + 3] >= 128) {
      left = Math.min(left, x); right = Math.max(right, x);
    }
    assert.ok(right > left); return { left, right };
  };
  const shirt = span(torso), old = span(rejected), head = span(current);
  assert.ok(old.left > shirt.right, 'The real rejected registration reproduces the reported nape gap');
  assert.ok(head.left <= shirt.right && head.right >= shirt.left,
    'The corrected head and original neckline overlap; there is no empty source-pixel column');
});

test('neck correction preserves all fourteen body parts, motion and every RGBA pixel outside the head mask', async () => {
  const original = JSON.parse(await read('source-before-facing.json'));
  for (const part of definition.parts) if (part.name !== 'head') {
    assert.equal(part.sha256, original.parts.find(source => source.name === part.name).sha256);
    assert.equal(hash(await read(part.file)), part.sha256);
  }
  assert.deepEqual(definition.rig, original.rig);
  const before = await rgba('reference-before-facing.png'), after = await rgba('identity-reference.png');
  const mask = await sharp(await read('head-replacement-mask-r8.png')).greyscale().raw().toBuffer();
  let unchanged = 0;
  for (let pixel = 0; pixel < mask.length; pixel++) if (!mask[pixel]) {
    assert.deepEqual(after.subarray(pixel * 4, pixel * 4 + 4), before.subarray(pixel * 4, pixel * 4 + 4)); unchanged++;
  }
  assert.ok(unchanged > 200000);
  const proof = JSON.parse(await read('head-registration-r8.provenance.json'));
  assert.equal(hash(await read('motion.json.gz')), proof.motionSha256);
  assert.equal(proof.outsideHeadMaskChanges, 0);
});
