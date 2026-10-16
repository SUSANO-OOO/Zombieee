import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  animationClipFor, createCombatAnimationRuntime, advanceCombatAnimationRuntime,
  combatFacingDirection, sampleAnimationClip,
} from '../app/combatPresentation.js';
import {
  V177_JOINT_ATLASES, v177JointCycleDistance, v177JointPose,
  v177CaptureJointPose, drawV177JointPose,
} from '../app/v177JointPresentation.js';
import { v100HumanWalkPhase, v100PaisenWalkPose } from '../app/v100HumanWalk.js';
import { v100MainHumanWalkPose } from '../app/v100MainHumanWalk.js';

const scale = .2;
const sourceParts = Object.fromEntries(['scout', 'medic'].map(kind => [kind,
  JSON.parse(readFileSync(`assets/source/v100/joints/${kind}-r1/parts.json`, 'utf8'))]));
const point = (matrix, [x, y]) => [
  matrix[0] * x + matrix[2] * y + matrix[4],
  matrix[1] * x + matrix[3] * y + matrix[5],
];
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function movingRuntime(kind, direction, phase) {
  return { ...createCombatAnimationRuntime({ x: 100, y: 280, direction }),
    state: 'move', moving: true, locomotionPhase: phase, locomotionSettle: 0 };
}
function worldContact(kind, runtime, legIndex) {
  // Use the actual source ankle and the production renderer's resolved matrix.
  // The fixed frame anchor cancels when comparing the same facing and scale.
  const leg = sourceParts[kind].rig.legs[legIndex];
  const sample = sampleAnimationClip(kind, 'active', 0);
  const plan = v177JointPose(kind, sample, runtime);
  const matrix = v177CaptureJointPose(kind, plan).lower[`leg-${legIndex}-foot`];
  const [x, y] = point(matrix, leg.ankle);
  return [runtime.lastX + (runtime.direction === 'left' ? -1 : 1) * scale * x,
    runtime.lastY + scale * y];
}

test('target-facing forward and backward travel preserve the actual planted boot in both facings', () => {
  for (const kind of ['scout', 'medic']) for (const direction of ['right', 'left']) {
    const facing = direction === 'left' ? -1 : 1;
    const stride = v177JointCycleDistance(kind, scale);
    for (const motion of [1, -1]) {
      const initial = movingRuntime(kind, direction, .1), dx = motion * facing;
      const actualDirection = combatFacingDirection({ side: 'human', actualXDelta: dx,
        targetDirection: facing, attacking: true });
      const next = advanceCombatAnimationRuntime(initial, { kind, direction: actualDirection,
        x: initial.lastX + dx, y: initial.lastY, locomotionCycleDistance: stride }, 1 / 60);
      assert.equal(actualDirection, direction, 'the attack still faces its target');
      assert.ok(distance(worldContact(kind, initial, 1), worldContact(kind, next, 1)) < .001,
        `${kind}/${direction}/${motion}: planted boot slid with actual root travel`);
      assert.equal(next.locomotionTravelDistance, 1, 'distance evidence remains unsigned');
      assert.equal(next.stateTravelDistance, 1);
      assert.ok(Math.abs(next.elapsedSeconds - animationClipFor(kind, 'move').durationSeconds / stride) < 1e-12);
      assert.equal(next.lastX, initial.lastX + dx, 'animation never changes actual travel');
    }
  }
});

test('backward travel crosses zero without resetting the plant or its unsigned distance evidence', () => {
  for (const kind of ['scout', 'medic']) for (const direction of ['right', 'left']) {
    const facing = direction === 'left' ? -1 : 1, stride = v177JointCycleDistance(kind, scale);
    let runtime = movingRuntime(kind, direction, .005);
    const plant = worldContact(kind, runtime, 0);
    for (let step = 1; step <= 6; step++) {
      runtime = advanceCombatAnimationRuntime(runtime, { kind, direction,
        x: 100 - facing * step, y: 280, locomotionCycleDistance: stride }, 1 / 60);
      assert.ok(runtime.locomotionPhase < 0);
      assert.ok(distance(plant, worldContact(kind, runtime, 0)) < .001,
        `${kind}/${direction}/${step}: negative phase reset or lost the source plant`);
      assert.ok(Math.abs(runtime.locomotionPhase - (.005 - step / stride)) < 1e-12);
      assert.equal(runtime.locomotionTravelDistance, step);
      assert.equal(runtime.stateTravelDistance, step);
      assert.ok(runtime.lastEvents.every(event => event.at >= 0));
    }
    const stopped = advanceCombatAnimationRuntime(runtime, { kind, direction,
      x: runtime.lastX, y: runtime.lastY, locomotionCycleDistance: stride }, 1 / 60);
    assert.equal(stopped.state, 'stop-move');
    assert.equal(stopped.locomotionPhase, runtime.locomotionPhase);
    assert.equal(stopped.locomotionStopPhase, runtime.locomotionPhase);
    const idle = advanceCombatAnimationRuntime(stopped, { kind, direction,
      x: runtime.lastX, y: runtime.lastY, locomotionCycleDistance: stride }, .3);
    assert.equal(idle.locomotionPhase, runtime.locomotionPhase);
    assert.equal(idle.locomotionStopPhase, runtime.locomotionPhase);
    assert.equal(idle.locomotionTravelDistance, 6);
  }
});

test('negative gait phases wrap through every actual joint renderer and the legacy walk consumers', () => {
  for (const [kind, atlas] of Object.entries(V177_JOINT_ATLASES)) {
    const negative = { locomotionPhase: -.25, locomotionSettle: .5 };
    const positive = { ...negative, locomotionPhase: .75 };
    const sample = sampleAnimationClip(kind, 'move', .1);
    const plan = v177JointPose(kind, sample, negative);
    assert.deepEqual(plan, v177JointPose(kind, sample, positive), kind);
    let painted = 0;
    const finite = (...values) => assert.ok(values.every(Number.isFinite), kind);
    const ctx = { save() {}, restore() {}, translate: finite, scale: finite, transform: finite,
      beginPath() {}, moveTo: finite, lineTo: finite, closePath() {}, fill() {},
      drawImage(_image, ...values) { finite(...values); painted++; } };
    assert.equal(drawV177JointPose(ctx, { naturalWidth: 2048 }, kind, plan, 0, 0,
      atlas.referenceFrame?.width ?? atlas.width, atlas.referenceFrame?.height ?? atlas.height), true);
    assert.ok(painted > 0);
  }
  assert.equal(v100HumanWalkPhase({ locomotionPhase: -.25 }), -.25);
  assert.deepEqual(v100PaisenWalkPose(-.25), v100PaisenWalkPose(.75));
  assert.deepEqual(v100MainHumanWalkPose('scout', -.25), v100MainHumanWalkPose('scout', .75));
});

test('signed travel leaves vertical-only cadence and action-owned stationary feet unchanged', () => {
  const kind = 'scout', stride = v177JointCycleDistance(kind, scale);
  const initial = movingRuntime(kind, 'left', -.25);
  const vertical = advanceCombatAnimationRuntime(initial, { kind, direction: 'left',
    x: initial.lastX, y: initial.lastY + 1, locomotionCycleDistance: stride }, 1 / 60);
  assert.ok(Math.abs(vertical.locomotionPhase - (initial.locomotionPhase + 1 / stride)) < 1e-12);
  for (const state of ['active', 'hit-light']) {
    const held = advanceCombatAnimationRuntime(initial, { kind, state, direction: 'left',
      x: initial.lastX + 1, y: initial.lastY, locomotionCycleDistance: stride }, 1 / 60);
    assert.equal(held.locomotionPhase, initial.locomotionPhase);
    assert.equal(held.locomotionTravelDistance, initial.locomotionTravelDistance);
  }
});
