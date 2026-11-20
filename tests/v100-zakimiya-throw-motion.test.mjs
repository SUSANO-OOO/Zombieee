import assert from 'node:assert/strict';
import test from 'node:test';
import { MANUAL_ABILITY_REGISTRY, advanceManualAbility, beginManualAbility, createManualAbilityRuntime } from '../app/manualAbilities.js';
import { v105CurrentAbilitySample } from '../app/v105CurrentAbilityPose.js';
import { V177_JOINT_ATLASES, v177CaptureJointPose, v177JointPose } from '../app/v177JointPresentation.js';

const kind = 'zakimiya';
const definition = MANUAL_ABILITY_REGISTRY[kind];
const rig = V177_JOINT_ATLASES[kind];
const locomotion = { locomotionPhase: .26, locomotionSettle: 1 };
const actor = { kind, side: 'human', hp: 100, combatReady: true };
const activated = beginManualAbility(createManualAbilityRuntime(kind), { x: 390, y: 240 });
const throwingHand = rig.armConstraints.find(arm => arm.effectorBone === 'arm-1-hand');

function point(matrix, [x,y]) {
  return [matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]];
}

function abilityAt(elapsed, fighter=actor) {
  const { runtime } = advanceManualAbility(activated.runtime, elapsed);
  return v105CurrentAbilitySample({ ...fighter, manualAbility: runtime }, {}, { manualDefinition: definition });
}

function capture(sample, attackSequence=0) {
  const plan = v177JointPose(kind,sample,locomotion,{ actor:{...actor,attackSequence}, grounded:true });
  return { plan, upper:v177CaptureJointPose(kind,plan).upper };
}

test('the fire-whisky windup leads into a free-hand throw at the original release moment', () => {
  assert.equal(activated.ok,true);
  const before = abilityAt(definition.throwReleaseSeconds - .001);
  const contact = abilityAt(definition.throwReleaseSeconds + .001);
  assert.equal(before.abilityPresentation,'fire-whisky-throw');
  assert.equal(before.requestedState,'wind-up');
  assert.equal(contact.requestedState,'active');
  const tuckedSample = abilityAt(.31);
  const tucked = capture(tuckedSample);
  const release = capture(contact);
  const grip = result => point(result.upper[throwingHand.effectorBone],throwingHand.grip);
  const poseDelta = grip(release)[0] - grip(tucked)[0];
  assert.ok(poseDelta > 75,'The free hand moves from behind the shoulders into the throw');
  assert.ok(Math.hypot(...grip(capture(before)).map((coordinate,index)=>coordinate-grip(release)[index])) < 5,
    'The held bottle meets the beginning of flight');
  assert.notDeepEqual(tucked.upper,capture({requestedState:'wind-up',clipProgress:tuckedSample.clipProgress}).upper);
  assert.deepEqual(tucked.upper,capture(tuckedSample,2).upper);
  assert.ok(release.plan.choreography.stepDistance > 0);
  assert.deepEqual(release.plan.choreography.strikeBones,[]);
});

test('the spare arm stays connected while the melee bottle stays on its own wrist', () => {
  for (const time of [.04,.14,.23,.31,.37,.399,.4,.44,.55,.57,.67,.75]) {
    const { upper } = capture(abilityAt(time));
    for (const arm of rig.armConstraints) {
      const wrist = point(upper[arm.lowerBone],arm.wrist);
      const hand = point(upper[arm.effectorBone],arm.effectorWrist??arm.wrist);
      assert.ok(Math.hypot(wrist[0]-hand[0],wrist[1]-hand[1]) < 1e-7);
    }
  }
  assert.equal(abilityAt(.31,{...actor,stunned:.2}).abilityPresentation,'ability-interrupted');
});
