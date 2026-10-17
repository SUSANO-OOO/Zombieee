// Producer-photo body: one rig texture and the same authored fallback identity.
// This copies registered source paint; it neither changes battle stats nor
// requires an image model, Blender installation, or browser during replay.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { buildRigidJointAtlas } from './build-v177-rigid-joint-atlas.mjs';
import { buildV100PaisenAtlas, PAISEN_SOURCE_BATTLE_PATH, PAISEN_IDENTITY_PATH,
  PAISEN_ATLAS_PATH } from './build-v100-paisen-atlas.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE = 'assets/source/v177/paisen/battle-r8';
const JOINT_PATH = '/art/v100/joints/brawler-photo-r2.webp';
const JOINT_DATA = 'app/v177PaisenPhotoJointData.js';
const SPRITE_DATA = 'app/v177PaisenPhotoSpriteData.js';
const CLASSIC_PROVENANCE = 'assets/source/v100/runtime/paisen-battle-atlas-provenance.json';
const BODY_PROVENANCE = 'assets/source/v177/paisen/photo-body-runtime-r2.json';
const SIX_SHA = "051b2bf3ee268497eb7cac73b800c132ecbbe58462034f68a2a87c25bb5d31e3";
const WIDTH = 394, HEIGHT = 757;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function measuredBounds(bytes, columns, rows, minimumAlpha = 1) {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, WIDTH * columns);
  assert.equal(info.height, HEIGHT * rows);
  const result = [];
  for (let row = 0; row < rows; row++) {
    const bounds = [];
    for (let column = 0; column < columns; column++) {
      let left = WIDTH, top = HEIGHT, right = -1, bottom = -1;
      for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
        if (data[((row * HEIGHT + y) * info.width + column * WIDTH + x) * 4 + 3] < minimumAlpha) continue;
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
      assert.ok(left >= 16 && top >= 16 && right < WIDTH - 16 && bottom < HEIGHT - 16,
        `Photo frame ${row}:${column} must retain the actual transparent gutter`);
      bounds.push([left, top, right + 1, bottom + 1]);
    }
    result.push(bounds);
  }
  return result;
}

async function write(root, name, bytes) {
  const target = path.join(root, name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
}

export async function buildV177PaisenPhotoBody({ outputRoot = ROOT, sourceDirectory = path.join(ROOT, SOURCE) } = {}) {
  outputRoot = path.resolve(outputRoot);
  const definition = JSON.parse(await fs.readFile(path.join(sourceDirectory, 'parts.json'), 'utf8'));
  const sourceProof = JSON.parse(await fs.readFile(path.join(sourceDirectory, 'authored-fallback-six-r1.provenance.json'), 'utf8'));
  const six = await fs.readFile(path.join(sourceDirectory, 'authored-fallback-six-r1.png'));
  assert.equal(hash(six), SIX_SHA);
  assert.equal(sourceProof.sourceFrameSha256, SIX_SHA);
  assert.equal(sourceProof.partsSha256, hash(await fs.readFile(path.join(sourceDirectory, 'parts.json'))));
  assert.equal(sourceProof.motionSha256, hash(await fs.readFile(path.join(sourceDirectory, 'motion.json.gz'))));
  assert.equal(sourceProof.sourceHeadSha256, hash(await fs.readFile(path.join(sourceDirectory, 'head.png'))));
  assert.equal(definition.kind, 'brawler');
  assert.equal(definition.identityBinding.path, PAISEN_IDENTITY_PATH);
  assert.equal(definition.parts.length, 15);
  const identity = await fs.readFile(path.join(ROOT, 'public', PAISEN_IDENTITY_PATH));
  assert.equal(hash(identity), definition.identityBinding.sourceSha256);
  if (outputRoot !== ROOT) await write(outputRoot, 'public' + PAISEN_IDENTITY_PATH, identity);
  await fs.mkdir(path.join(outputRoot, 'app'), { recursive: true });

  let atlas;
  const oldCwd = process.cwd();
  let joint;
  try {
    process.chdir(outputRoot);
    joint = await buildRigidJointAtlas({
      sourceDirectory, assetPath: JOINT_PATH, dataFile: JOINT_DATA,
      exportName: 'V177_PAISEN_PHOTO_JOINT_ATLASES',
      generator: 'scripts/build-v177-paisen-photo-body.mjs',
      description: 'Producer three-photo Paisen: one source-bound 15-part rig and matching authored fallback frames; native naturalness acceptance remains separate.',
      captureAtlas: value => { atlas = value; },
    });
  } finally { process.chdir(oldCwd); }
  assert.equal(joint.hash, sourceProof.textureSha256, 'Authored fallback frames must use this exact rig paint');
  assert.equal(atlas.poses.length, 151);
  assert.equal(atlas.parts.length, 15);
  await write(outputRoot, 'public' + PAISEN_SOURCE_BATTLE_PATH, six);
  const sevenProvenance = await buildV100PaisenAtlas({ root: outputRoot });
  const seven = await fs.readFile(path.join(outputRoot, 'public', PAISEN_ATLAS_PATH));
  const sixVisible = (await measuredBounds(six, 6, 1))[0];
  const sixContact = (await measuredBounds(six, 6, 1, 8))[0];
  const sevenBounds = await measuredBounds(seven, 7, 2);
  assert.equal(new Set(sixContact.map(bounds => bounds[3])).size, 1,
    'Idle, gait, strike and impact must share the same visible painted floor');
  const sprite = {
    schema: 'zombieee-paisen-photo-sprites/1', revision: 'producer-photos-20261015-body-r2-facing-opponent-neck-r2',
    source: SOURCE, cellWidth: WIDTH, cellHeight: HEIGHT,
    sixPath: PAISEN_SOURCE_BATTLE_PATH, sixSha256: hash(six),
    sevenPath: PAISEN_ATLAS_PATH, sevenSha256: hash(seven),
    jointPath: JOINT_PATH, jointSha256: joint.hash,
    identityPath: PAISEN_IDENTITY_PATH, identitySha256: hash(identity),
    sixVisible, sixGroundAnchorPixels: sixContact.map(bounds => bounds[3]), contactAlphaThreshold: 8,
    sevenVisible: { right: sevenBounds[0], left: sevenBounds[1] },
    authoredCell: { x: 16, y: 16, w: WIDTH - 32, h: HEIGHT - 32 },
    originalHeadSourceSha256: sourceProof.sourceHeadSha256,
  };
  const data = '// Generated by scripts/build-v177-paisen-photo-body.mjs; measured source-alpha bounds.\n'
    + 'const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n'
    + 'export const V177_PAISEN_PHOTO_SPRITES = freeze(' + JSON.stringify(sprite) + ');\n';
  await write(outputRoot, SPRITE_DATA, data);
  const provenance = {
    schema: 'zombieee-paisen-photo-body/1', source: SOURCE,
    identityBinding: definition.identityBinding, sourceFrameSha256: SIX_SHA,
    sourcePartsSha256: sourceProof.partsSha256, motionSha256: sourceProof.motionSha256,
    originalHeadSourceSha256: sourceProof.sourceHeadSha256,
    authoredFallbackOrigin: sourceProof.generatedBy,
    authoredFallbackPixelReplay: 'Exact copy of the source-bound six-frame PNG. No browser rerender is claimed by this generator.',
    joint, sprite, optionalSevenState: sevenProvenance,
    statesRequireNativeAcceptance: 21, allUnitForms: 48,
    nativeAccepted: false, originalSpeedNaturalnessAccepted: false, wholeGameAccepted: false,
  };
  await write(outputRoot, BODY_PROVENANCE, JSON.stringify(provenance, null, 2) + '\n');
  return { joint, sprite, provenance, files: ['public' + JOINT_PATH, JOINT_DATA,
    'public' + PAISEN_SOURCE_BATTLE_PATH, 'public' + PAISEN_ATLAS_PATH, SPRITE_DATA,
    CLASSIC_PROVENANCE, BODY_PROVENANCE] };
}

async function copySource(folder) {
  const directory = path.join(folder, 'source');
  await fs.mkdir(directory);
  const original = path.join(ROOT, SOURCE);
  const definition = JSON.parse(await fs.readFile(path.join(original, 'parts.json'), 'utf8'));
  const names = new Set(['parts.json', 'motion.json.gz', 'identity-reference.png',
    'authored-fallback-six-r1.png', 'authored-fallback-six-r1.provenance.json',
    ...definition.parts.map(part => part.file)]);
  for (const name of names) await fs.copyFile(path.join(original, name), path.join(directory, name));
  return directory;
}

async function check() {
  const folder = await fs.mkdtemp(path.join(ROOT, 'output/issue177-paisen-photo-replay-'));
  const directory = await copySource(folder);
  const result = await buildV177PaisenPhotoBody({ outputRoot: folder, sourceDirectory: directory });
  for (const name of result.files) {
    assert.deepEqual(await fs.readFile(path.join(folder, name)), await fs.readFile(path.join(ROOT, name)),
      'Changed photo-body generated output: ' + name);
  }
  return { check: true, files: result.files.length, root: folder,
    nativeAccepted: false, wholeGameAccepted: false };
}

const entryPath = process.argv[1] ? await fs.realpath(process.argv[1]).catch(() => null) : null;
if (entryPath === fileURLToPath(import.meta.url)) {
  const stagingIndex = process.argv.indexOf('--staging-root');
  let result;
  if (stagingIndex >= 0) {
    assert.ok(process.argv[stagingIndex + 1], 'A fresh private staging root is required');
    const folder = path.resolve(process.argv[stagingIndex + 1]);
    const relative = path.relative(path.join(ROOT, 'output'), folder);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative),
      'Staging must stay in a fresh output folder; production files are read-only');
    await fs.mkdir(folder);
    const directory = await copySource(folder);
    result = await buildV177PaisenPhotoBody({ outputRoot: folder, sourceDirectory: directory });
  } else result = process.argv.includes('--check') ? await check() : await buildV177PaisenPhotoBody();
  console.log(JSON.stringify(result, null, 2));
}
