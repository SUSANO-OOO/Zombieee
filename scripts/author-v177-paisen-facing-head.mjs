// Register an image_gen-painted combat profile on the existing neck pivot.
// Body paint, animation matrices, stats and timing remain source-bound.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'assets/source/v177/paisen/battle-r8');
const check = process.argv.includes('--check');
const replaceRegistration = process.argv.includes('--replace-registration');
const previousIndex = process.argv.indexOf('--previous-registration');
const previousRegistration = previousIndex >= 0 ? process.argv[previousIndex + 1] : 'registration-r1';
assert.match(previousRegistration, /^registration-r[1-9]\d*$/);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const source = JSON.parse(await fs.readFile(path.join(DIR, 'source-before-facing.json'), 'utf8'));
const beforeBytes = await fs.readFile(path.join(DIR, 'reference-before-facing.png'));
const oldHeadBytes = await fs.readFile(path.join(DIR, 'head-before-facing.png'));
const generatedBytes = await fs.readFile(path.join(DIR, 'head-side-profile-r8.generated.png'));
assert.equal(hash(beforeBytes), source.sourceSha256);
assert.equal(hash(oldHeadBytes), source.parts.find(part => part.name === 'head').sha256);
assert.equal(hash(generatedBytes), '42a2372f253ec9d6ddd84fcc9aa33f9fa03df6d6e39df85fd5ac1d29bbc9ce4f');
const rgba = bytes => sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const image = await rgba(generatedBytes);
let left = image.info.width, top = image.info.height, right = -1, bottom = -1;
// This bounds only the visible generated cutout. Preserve its original alpha
// inside the crop, including the antialiased outline; never paint a matte.
for (let y = 0; y < image.info.height; y++) for (let x = 0; x < image.info.width; x++) {
  if (image.data[(y * image.info.width + x) * 4 + 3] < 8) continue;
  left = Math.min(left, x); right = Math.max(right, x);
  top = Math.min(top, y); bottom = Math.max(bottom, y);
}
assert.ok(right > left && bottom > top);
const crop = { left, top, width: right - left + 1, height: bottom - top + 1 };
const normalizedBytes = await sharp(generatedBytes).extract(crop).resize({ height: 83, kernel: 'lanczos3' }).png().toBuffer();
const normalized = await rgba(normalizedBytes), targetTop = 16, neckY = source.rig.head[0][1];
let neckLeft = normalized.info.width, neckRight = -1;
for (let x = 0; x < normalized.info.width; x++) {
  if (normalized.data[((neckY - targetTop) * normalized.info.width + x) * 4 + 3] < 32) continue;
  neckLeft = Math.min(neckLeft, x); neckRight = Math.max(neckRight, x);
}
assert.ok(neckRight > neckLeft);
// The generated collar is wider than the body's original neckline. Register
// its nape on the actual shoulder opening; do not center the two collar rims.
const paintOffsetX = -7;
const targetLeft = Math.round(source.rig.head[0][0] - (neckLeft + neckRight) / 2) + paintOffsetX;
const head = Buffer.alloc(480 * 448 * 4);
for (let y = 0; y < normalized.info.height; y++) for (let x = 0; x < normalized.info.width; x++) {
  const from = (y * normalized.info.width + x) * 4, to = ((y + targetTop) * 480 + x + targetLeft) * 4;
  normalized.data.copy(head, to, from, from + 4);
}
const before = await rgba(beforeBytes), oldHead = await rgba(oldHeadBytes);
const torso = await rgba(await fs.readFile(path.join(DIR, 'torso.png')));
assert.equal(before.info.width, 480); assert.equal(before.info.height, 448);
const reference = Buffer.from(before.data), mask = Buffer.alloc(480 * 448);
let changed = 0, outsideChanges = 0;
for (let i = 0; i < reference.length; i += 4) {
  if (oldHead.data[i + 3]) { reference.fill(0, i, i + 4); mask[i / 4] = 255; }
  if (head[i + 3]) { head.copy(reference, i, i, i + 4); mask[i / 4] = 255; }
  if (!reference.subarray(i, i + 4).equals(before.data.subarray(i, i + 4))) {
    changed++; if (!mask[i / 4]) outsideChanges++;
  }
}
assert.equal(outsideChanges, 0);
// Composite only inside the replaced head region. Keep all other source RGBA
// exact, including semitransparent body pixels that an image-wide blend rounds.
for (let i = 0; i < reference.length; i += 4) {
  if (!mask[i / 4] || !torso.data[i + 3]) continue;
  const frontAlpha = torso.data[i + 3] / 255, backAlpha = reference[i + 3] / 255;
  const alpha = frontAlpha + backAlpha * (1 - frontAlpha);
  for (let channel = 0; channel < 3; channel++) reference[i + channel] = Math.round(
    (torso.data[i + channel] * frontAlpha + reference[i + channel] * backAlpha * (1 - frontAlpha)) / alpha);
  reference[i + 3] = Math.round(alpha * 255);
}
changed = 0; outsideChanges = 0;
let visibleHeadExactPixels = 0;
for (let i = 0; i < reference.length; i += 4) {
  if (!reference.subarray(i, i + 4).equals(before.data.subarray(i, i + 4))) {
    changed++; if (!mask[i / 4]) outsideChanges++;
  }
  if (head[i + 3] && !torso.data[i + 3]) {
    assert.deepEqual(reference.subarray(i, i + 4), head.subarray(i, i + 4)); visibleHeadExactPixels++;
  }
}
assert.equal(outsideChanges, 0); assert.ok(visibleHeadExactPixels > 1000);
const png = (bytes, channels) => sharp(bytes, { raw: { width: 480, height: 448, channels } }).png().toBuffer();
const headBytes = await png(head, 4), referenceBytes = await png(reference, 4), maskBytes = await png(mask, 1);
// In the actual rig the original shirt covers the base of the new neck. Make
// the identity reference show that same overlap, instead of a floating collar.
const definition = structuredClone(source), headPart = definition.parts.find(part => part.name === 'head');
const hand = await rgba(await fs.readFile(path.join(DIR, 'weapon-and-hands.png')));
const contactY = source.muzzle[1];
let contactX = -1;
for (let x = 0; x < hand.info.width; x++) {
  if (hand.data[(contactY * hand.info.width + x) * 4 + 3] >= 128) contactX = x;
}
assert.ok(contactX >= 0, 'The contact marker must be on the actual painted fist');
definition.muzzle = [contactX, contactY];
headPart.sha256 = hash(headBytes);
headPart.originalRegions = [[[targetLeft, targetTop], [targetLeft + normalized.info.width, targetTop],
  [targetLeft + normalized.info.width, targetTop + normalized.info.height], [targetLeft, targetTop + normalized.info.height]]];
definition.sourceSha256 = hash(referenceBytes);
definition.status = 'producer-photo body with enemy-facing head; source study, native acceptance open';
definition.identityBinding.bodyReference = definition.identityBinding.battleReference;
definition.identityBinding.battleReference = 'assets/source/v177/paisen/battle-r8/identity-reference.png';
definition.order = definition.order.filter(name => name !== 'head');
definition.order.splice(definition.order.indexOf('torso'), 0, 'head');
definition.headOrientation = { yawDegrees: 90, baseFacing: 'right', mirroredFacing: 'left',
  gaze: 'opponent', source: 'head-side-profile-r8.generated.png', generatedSha256: hash(generatedBytes),
  neckPivot: source.rig.head[0], paintOffsetX, headBehindTorso: true,
  playerRuntimeAdopted: false, producerAccepted: false };
for (const part of definition.parts) if (part.name !== 'head') {
  assert.equal(hash(await fs.readFile(path.join(DIR, part.file))), part.sha256, 'Body part changed: ' + part.name);
}
const provenance = { schema: 'v177-paisen-facing-head-registration-r8',
  sourceReferenceSha256: source.sourceSha256, oldHeadSha256: hash(oldHeadBytes),
  generatedHeadSha256: hash(generatedBytes), headSha256: hash(headBytes),
  referenceSha256: hash(referenceBytes), generatedAlphaCrop: crop,
  normalizedSize: [normalized.info.width, normalized.info.height], top: targetTop, left: targetLeft,
  neckPivot: source.rig.head[0], neckline: [neckLeft, neckRight], paintOffsetX, headBehindTorso: true,
  changedPixels: changed, outsideHeadMaskChanges: outsideChanges, visibleHeadExactPixels,
  otherBodyPartsUnchanged: 14, animationMatricesUnchanged: true,
  weaponContactPoint: { previous: source.muzzle, registered: definition.muzzle, minimumPaintAlpha: 128 },
  motionSha256: hash(await fs.readFile(path.join(DIR, 'motion.json.gz'))),
  semanticReview: 'Generated profile manually inspected: one eye visible, nose and iris face right. Assembled poses require separate review.',
  nativeAccepted: false, animationNaturalnessAccepted: false, wholeGameAccepted: false };
const files = new Map([['head.png', headBytes], ['identity-reference.png', referenceBytes],
  ['head-replacement-mask-r8.png', maskBytes], ['parts.json', Buffer.from(JSON.stringify(definition, null, 2) + '\n')],
  ['head-registration-r8.provenance.json', Buffer.from(JSON.stringify(provenance, null, 2) + '\n')]]);
for (const [name, bytes] of files) {
  const target = path.join(DIR, name);
  if (check) assert.deepEqual(await fs.readFile(target), bytes, 'Facing-head replay differs: ' + name);
  else if (replaceRegistration) {
    assert.deepEqual(await fs.readFile(target), await fs.readFile(path.join(DIR, previousRegistration, name)),
      'Preserve the previous registration before replacing it: ' + name);
    await fs.writeFile(target, bytes);
  } else await fs.writeFile(target, bytes, { flag: 'wx' });
}
console.log(JSON.stringify({ check, files: files.size, headSha256: hash(headBytes), referenceSha256: hash(referenceBytes),
  outsideHeadMaskChanges: outsideChanges, bodyPartsPreserved: 14, nativeAccepted: false }));
