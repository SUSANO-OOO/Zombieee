import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { spriteKinds, spriteFrameFor } from '../app/spriteManifest.js';
import { V102_FALLING_DEATH_FRAMES } from '../app/v102CorpsePoseData.js';
import { v102CorpseFallingPose, v102HasFallingDeathFrame, V102_FALLING_DEATH_KINDS } from '../app/v102CorpsePose.js';
import { buildCorpsePoseData } from '../scripts/build-v102-corpse-pose-data.mjs';

test('falling-key contact data reproduces exactly from the six original source cells without changing their images', async () => {
  assert.equal(await buildCorpsePoseData(), fs.readFileSync('app/v102CorpsePoseData.js', 'utf8'));
  assert.deepEqual(V102_FALLING_DEATH_KINDS, ['takuya', 'mugarian-president-mutated', 'takuya-omega']);
  assert.equal(V102_FALLING_DEATH_FRAMES.length, 6);
  for (const source of V102_FALLING_DEATH_FRAMES) {
    const frame = spriteFrameFor(source.kind, 'death', source.direction);
    assert.equal(source.path, frame.path);assert.deepEqual(source.sourceRect, frame.sourceRect);
    assert.equal(source.frameFlipX, frame.flipX);
    assert.equal(source.sourceSha256, createHash('sha256').update(fs.readFileSync('public' + frame.path)).digest('hex'));
  }
});

test('every bound falling key settles continuously in both fall directions and never crosses the ground', () => {
  for (const source of V102_FALLING_DEATH_FRAMES) for (const direction of [-1, 1]) for (const scale of [.17, .31]) {
    const frame = spriteFrameFor(source.kind, 'death', source.direction);let previous = 0;
    for (let step = 0; step <= 120; step++) {
      const pose = v102CorpseFallingPose(source.kind, frame, frame.w * scale, frame.h * scale, direction, step / 120);
      assert.ok(pose.sourceBound);assert.equal(pose.sourceSha256, source.sourceSha256);
      assert.ok(pose.groundSupportY + pose.groundOffsetY <= 1e-8);
      const angle = Math.abs(pose.rotationRadians);assert.ok(angle >= previous - 1e-12 && angle - previous < .02);previous = angle;
      if (step === 0) assert.equal(angle, 0);
      if (step === 120) { assert.ok(Math.abs(angle - Math.PI / 2) < 1e-12);assert.ok(Math.abs(pose.groundSupportY + pose.groundOffsetY) < 1e-8); }
    }
  }
});

test('the runtime support matches an independent full-alpha pixel scan through rotation, mirror and ash scaling', async () => {
  for (const source of V102_FALLING_DEATH_FRAMES) {
    const frame = spriteFrameFor(source.kind, 'death', source.direction), r = frame.sourceRect;
    const { data, info } = await sharp('public' + frame.path).extract({left:r.x,top:r.y,width:r.w,height:r.h}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const slices = frame.drawSlices ?? [{x:0,y:0,w:r.w,h:r.h}];
    for (const direction of [-1, 1]) for (const progress of [0, .22, .5, .77, 1]) {
      const width = r.w * .23 * .82, height = r.h * .23 * .52;
      const pose = v102CorpseFallingPose(source.kind, frame, width, height, direction, progress);
      const sin = Math.sin(pose.rotationRadians), cos = Math.cos(pose.rotationRadians), flip = frame.flipX ? -1 : 1;
      const cx = sin * flip * width / r.w, cy = cos * height / r.h;
      const offset = -sin * flip * width * frame.anchorX - cos * height * frame.anchorY;
      let support = -Infinity;
      for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * 4 + 3] < 8 || !slices.some(s => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h)) continue;
        support = Math.max(support, cx * (x + (cx >= 0 ? 1 : 0)) + cy * (y + (cy >= 0 ? 1 : 0)) + offset);
      }
      assert.ok(Math.abs(pose.groundSupportY - support) < 1e-8, source.kind + ' exact painted outline');
    }
  }
});

test('all other authored forms and mismatched source cells retain their existing corpse path', () => {
  for (const kind of spriteKinds) for (const direction of ['right', 'left']) {
    const frame = spriteFrameFor(kind, 'death', direction);
    if (!V102_FALLING_DEATH_KINDS.includes(kind)) assert.equal(v102CorpseFallingPose(kind, frame, 100, 100, 1, 1), null);
    else {
      assert.equal(v102HasFallingDeathFrame(kind, frame), true);
      const changed = {...frame, sourceRect:{...frame.sourceRect, w:frame.sourceRect.w + 1}};
      assert.equal(v102HasFallingDeathFrame(kind, changed), false);
      assert.equal(v102CorpseFallingPose(kind, changed, 100, 100, 1, 1), null);
    }
  }
});
