import assert from 'node:assert/strict';
import test from 'node:test';
import { attackPresentationDuration, sampleAnimationClip, sampleAttackPresentation } from '../app/combatPresentation.js';
import { ENEMY_NORMAL_ATTACK_SECONDS } from '../app/enemyCombatTiming.js';
import { v102CombatMotionSample } from '../app/v102CombatMotion.js';
import { V177_JOINT_ATLASES, v177JointPose, v177CaptureJointPose } from '../app/v177JointPresentation.js';

const runtime = { locomotionPhase: .1, locomotionSettle: 1 };
const point = (matrix, [x, y]) => [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]];
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function normalSample(kind, elapsed, options = {}) {
  const attack = ENEMY_NORMAL_ATTACK_SECONDS - elapsed;
  const sample = sampleAttackPresentation(kind, attackPresentationDuration(kind) - attack);
  return v102CombatMotionSample(kind, sample, { side: 'zombie', attack, ...options });
}

test('the actual enemy contact-to-recovery boundary does not teleport painted arms or weapons', () => {
  let comparedBodies = 0;
  const discontinuities = [];
  for (const [kind, atlas] of Object.entries(V177_JOINT_ATLASES)) {
    const before = v177JointPose(kind, normalSample(kind, .12 - 1e-9), runtime);
    const after = v177JointPose(kind, normalSample(kind, .12), runtime);
    assert.ok(before && after, kind);
    if (atlas.type !== 'rigid-parts') {
      if (before.upperIndex !== after.upperIndex) discontinuities.push({ kind, beforeFrame: before.upperIndex, afterFrame: after.upperIndex });
      continue;
    }
    const a = v177CaptureJointPose(kind, before).upper;
    const b = v177CaptureJointPose(kind, after).upper;
    let largestJump = 0;
    for (const part of atlas.parts.filter(part => part.upper)) {
      const d = part.destination;
      for (const p of [[d.x, d.y], [d.x + d.w, d.y], [d.x, d.y + d.h], [d.x + d.w, d.y + d.h]]) {
        largestJump = Math.max(largestJump, distance(point(a[part.bone], p), point(b[part.bone], p)));
      }
    }
    for (const chain of atlas.armConstraints ?? []) {
      const wrist = chain.effectorWrist ?? chain.wrist;
      largestJump = Math.max(largestJump, distance(point(a[chain.effectorBone], wrist), point(b[chain.effectorBone], wrist)));
    }
    if (largestJump >= .001) discontinuities.push({ kind, sourcePixelJump: largestJump });
    comparedBodies++;
  }
  assert.ok(comparedBodies > 0, 'compare the actual connected, painted rigs');
  assert.deepEqual(discontinuities, [], 'contact-to-recovery must preserve connected painted arms and weapons');
});

test('normal attacks retain their existing timer, legacy sprite cadence and planted gait', () => {
  assert.equal(ENEMY_NORMAL_ATTACK_SECONDS, .18);
  const cases = [[0, 'active', 'attack-b'], [.06, 'active', 'attack-b'], [.12, 'recovery', 'attack-b'], [.15, 'recovery', 'idle']];
  for (const kind of Object.keys(V177_JOINT_ATLASES)) {
    const idle = v177JointPose(kind, sampleAnimationClip(kind, 'idle', 0), runtime);
    for (const [elapsed, state, sprite] of cases) {
      const sample = normalSample(kind, elapsed);
      assert.equal(sample.requestedState, state, kind);
      assert.equal(sample.spriteState, sprite, kind + ' preserves fallback sprite timing');
      const plan = v177JointPose(kind, sample, runtime);
      assert.equal(plan.lowerIndex, idle.lowerIndex, kind + ' does not restart the feet at contact or recovery');
      assert.equal(plan.phase, idle.phase, kind);
    }
  }
});

test('dedicated attacks, abilities, hits and allied timing retain their own presentation owners', () => {
  for (const kind of Object.keys(V177_JOINT_ATLASES)) {
    for (const state of ['special', 'hit-light', 'hit-heavy']) {
      const sample = sampleAnimationClip(kind, state, .04);
      assert.equal(v102CombatMotionSample(kind, sample, { ownedPose: true, side: 'zombie', attack: .05 }), sample);
      const result = v102CombatMotionSample(kind, sample, { side: 'zombie', attack: .05, abilityWindup: .1 });
      assert.equal(result.requestedState, state, kind);
      assert.equal(result.clipProgress, sample.clipProgress, kind);
    }
    const ally = sampleAttackPresentation(kind, .09);
    const result = v102CombatMotionSample(kind, ally, { side: 'human', attack: .09 });
    assert.equal(result.requestedState, ally.requestedState, kind);
    assert.equal(result.clipProgress, ally.clipProgress, kind);
  }
});
