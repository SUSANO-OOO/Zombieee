import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceManualAbility, beginManualAbility, createManualAbilityRuntime,
  MANUAL_ABILITY_REGISTRY,
} from '../app/manualAbilities.js';
import { v105CurrentAbilitySample } from '../app/v105CurrentAbilityPose.js';
import {
  V177_JOINT_ATLASES, v177CaptureJointPose, v177JointPose,
} from '../app/v177JointPresentation.js';

const kind = 'crazy-king';
const definition = MANUAL_ABILITY_REGISTRY[kind];
const rig = V177_JOINT_ATLASES[kind];
const rest = { requestedState: 'idle', clipProgress: 0 };
const locomotion = { locomotionPhase: .2, locomotionSettle: 1 };
const started = beginManualAbility(createManualAbilityRuntime(kind), { x: 100, y: 0 });

function sample(manualAbility, base = rest) {
  return v105CurrentAbilitySample(
    { kind, side: 'human', hp: 100, combatReady: true, manualAbility },
    base,
    { manualDefinition: definition },
  );
}

function paintedPose(motion, manualAbility) {
  const actor = manualAbility ? { kind, manualAbility } : undefined;
  const plan = v177JointPose(kind, motion, locomotion, { grounded: true, actor });
  return v177CaptureJointPose(kind, plan).upper;
}

function point(matrix, [x, y]) {
  return [
    matrix[0] * x + matrix[2] * y + matrix[4],
    matrix[1] * x + matrix[3] * y + matrix[5],
  ];
}

test('King prepares Overdrive low with both hands, then returns control to combat', () => {
  assert.equal(started.ok, true);
  const preparation = advanceManualAbility(started.runtime, definition.windupSeconds * .68).runtime;
  const special = sample(preparation);
  assert.equal(special.abilityPresentation, 'chainsaw-rev');

  const rev = paintedPose(special);
  const ordinary = paintedPose({ requestedState: 'wind-up', clipProgress: special.clipProgress });
  const bladeTip = pose => point(pose[rig.weaponBone], rig.muzzle);
  const head = pose => point(pose.head, rig.interpolationPivots.head);
  assert.ok(bladeTip(rev)[1] > head(rev)[1] + 60, 'Overdrive holds the saw below the head');
  assert.ok(bladeTip(ordinary)[1] < head(ordinary)[1], 'Ordinary attacks still swing the saw overhead');

  const activated = advanceManualAbility(started.runtime, definition.windupSeconds + .001);
  assert.deepEqual(activated.events.map(event => event.type), ['active-start']);
  assert.equal(sample(activated.runtime), null, 'The active buff allows regular movement and idle poses');
});

test('Overdrive powers a low attack without changing the attack clock or releasing either grip', () => {
  const active = advanceManualAbility(started.runtime, definition.windupSeconds + .1).runtime;
  const base = { requestedState: 'wind-up', clipProgress: .72, movement: false };
  const cutting = sample(active, base);
  assert.deepEqual(cutting, { ...base, abilityPresentation: 'chainsaw-overdrive' });
  assert.equal(sample(active, { requestedState: 'move', clipProgress: .4 }), null);
  const ordinary = paintedPose(base);
  const powered = paintedPose(cutting, active);
  const bladeTip = pose => point(pose[rig.weaponBone], rig.muzzle);
  assert.ok(bladeTip(powered)[1] > bladeTip(ordinary)[1] + 80, 'the powered cut loads at waist height');

  for (const state of ['wind-up', 'active', 'recovery']) {
    for (let frame = 0; frame < 12; frame += 1) {
      const pose = paintedPose(sample(active, { requestedState: state, clipProgress: frame / 12 }), active);
      for (const arm of rig.armConstraints) {
        const wrist = point(pose[arm.lowerBone], arm.wrist);
        const heldWrist = point(pose[arm.effectorBone], arm.effectorWrist ?? arm.wrist);
        assert.ok(Math.hypot(wrist[0] - heldWrist[0], wrist[1] - heldWrist[1]) < 1e-7);
      }
    }
  }
  const ended = paintedPose(cutting, { ...active, activeRemaining: 0 });
  assert.deepEqual(ended, ordinary);
});

test('The saw remains attached to both wrists throughout the rev and rejoins the ready pose', () => {
  const neutral = paintedPose(rest);
  const begin = paintedPose(sample(started.runtime));
  const end = paintedPose({ requestedState: 'wind-up', clipProgress: 1, abilityPresentation: 'chainsaw-rev' });
  assert.deepEqual(begin[rig.weaponBone], neutral[rig.weaponBone]);
  assert.deepEqual(end[rig.weaponBone], neutral[rig.weaponBone]);
  for (let frame = 0; frame < 48; frame += 1) {
    const runtime = advanceManualAbility(started.runtime, definition.windupSeconds * frame / 48).runtime;
    const pose = paintedPose(sample(runtime));
    for (const arm of rig.armConstraints) {
      const wrist = point(pose[arm.lowerBone], arm.wrist);
      const heldWrist = point(pose[arm.effectorBone], arm.effectorWrist ?? arm.wrist);
      assert.ok(Math.hypot(wrist[0] - heldWrist[0], wrist[1] - heldWrist[1]) < 1e-7);
    }
  }
});
