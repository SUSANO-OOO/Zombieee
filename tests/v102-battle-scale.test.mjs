import test from 'node:test';
import assert from 'node:assert/strict';
import { spriteKinds, spriteFrameFor, SPRITE_STATES, fitSpriteBattleDisplaySize } from '../app/spriteManifest.js';
import { v102BattleDisplaySize } from '../app/v102BattleScale.js';

test('every ally, enemy and split form retains its idle pixel scale through attacks, hits and death', () => {
  for (const kind of spriteKinds) for (const direction of ['left', 'right']) {
    const maximum = { w: 160, h: 180 };
    const idle = spriteFrameFor(kind, 'idle', 'right');
    const fitted = fitSpriteBattleDisplaySize(kind, idle, maximum);
    for (const state of SPRITE_STATES) {
      const frame = spriteFrameFor(kind, state, direction);
      const size = v102BattleDisplaySize(kind, frame, maximum);
      assert.ok(Math.abs(size.w / frame.sourceRect.w - fitted.w / idle.sourceRect.w) < 1e-12, `${kind}/${state}/${direction} width`);
      assert.ok(Math.abs(size.h / frame.sourceRect.h - fitted.h / idle.sourceRect.h) < 1e-12, `${kind}/${state}/${direction} height`);
    }
  }
});

test('guardian attack no longer magnifies the actor to fit its crouched silhouette', () => {
  const maximum = { w: 100, h: 100 };
  const idle = spriteFrameFor('guardian', 'idle', 'right');
  const strike = spriteFrameFor('guardian', 'attack-a', 'right');
  const old = fitSpriteBattleDisplaySize('guardian', strike, maximum);
  const fixed = v102BattleDisplaySize('guardian', strike, maximum);
  assert.ok(old.h / fixed.h > 1.28, 'Fixture exposes the reported size jump');
  assert.equal(fixed.h, fitSpriteBattleDisplaySize('guardian', idle, maximum).h);
});
