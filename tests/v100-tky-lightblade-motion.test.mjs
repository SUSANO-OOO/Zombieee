import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MANUAL_ABILITY_REGISTRY, advanceManualAbility, beginManualAbility, createManualAbilityRuntime,
} from '../app/manualAbilities.js';
import { v105CurrentAbilitySample } from '../app/v105CurrentAbilityPose.js';
import { V177_JOINT_ATLASES, v177CaptureJointPose, v177JointPose } from '../app/v177JointPresentation.js';

const kind = 'tky';
const definition = MANUAL_ABILITY_REGISTRY[kind];
const rig = V177_JOINT_ATLASES[kind];
const locomotion = { locomotionPhase: .2, locomotionSettle: 1 };
const activated = beginManualAbility(createManualAbilityRuntime(kind), { x: 380, y: 250 });
const actor = { kind, side: 'human', hp: 100, combatReady: true };

function point(matrix, [x, y]) {
  return [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]];
}
function manualAt(elapsed) {
  const runtime = advanceManualAbility(activated.runtime, elapsed).runtime;
  return v105CurrentAbilitySample({ ...actor, manualAbility: runtime }, {}, { manualDefinition: definition });
}
function pose(sample, attackSequence = 0) {
  const plan = v177JointPose(kind, sample, locomotion, { actor: { ...actor, attackSequence }, grounded: true });
  return { plan, joints: v177CaptureJointPose(kind, plan).upper };
}
function weapon(joints) {
  const matrix = joints[rig.weaponBone];
  const wrist = point(matrix, rig.armConstraints[0].wrist);
  const tip = point(matrix, rig.muzzle);
  return { wrist, tip, pitch: Math.atan2(tip[1] - wrist[1], tip[0] - wrist[0]) };
}

test('TKY holds the plasma blade low before a dedicated sweeping release', () => {
  assert.equal(activated.ok, true);
  const prep = manualAt(definition.windupSeconds * .56);
  const ordinary = { requestedState: 'wind-up', clipProgress: prep.clipProgress };
  assert.equal(prep.abilityPresentation, 'lightblade-release');
  const held = pose(prep);
  const low = weapon(held.joints);
  assert.ok(Math.abs(low.pitch) < .28, 'The prepared blade points forward across the waist');
  assert.notDeepEqual(held.joints, pose(ordinary, 0).joints);
  assert.notDeepEqual(held.joints, pose(ordinary, 2).joints);
  assert.deepEqual(held.joints, pose(prep, 2).joints, 'The manual stance does not alternate with ordinary combos');

  const release = advanceManualAbility(activated.runtime, definition.windupSeconds + .002);
  assert.deepEqual(release.events.map(event => event.type), ['impact']);
  const released = pose(manualAt(definition.windupSeconds + .015));
  assert.ok(released.plan.choreography.stepDistance > 0);
  assert.ok(weapon(released.joints).wrist[0] > low.wrist[0] + 25, 'The hilt travels forward at release');
});

test('both wrists stay on the approved plasma hilt through preparation and recovery', () => {
  assert.equal(rig.path, '/art/v100/joints/tky-combat-plasma-r1.webp');
  const end = definition.windupSeconds + definition.recoverySeconds;
  for (let index = 0; index < 48; index += 1) {
    const { joints } = pose(manualAt(end * index / 48));
    for (const arm of rig.armConstraints) {
      const wrist = point(joints[arm.lowerBone], arm.wrist);
      const grip = point(joints[arm.effectorBone], arm.effectorWrist ?? arm.wrist);
      assert.ok(Math.hypot(wrist[0] - grip[0], wrist[1] - grip[1]) < 1e-7);
    }
  }
});
