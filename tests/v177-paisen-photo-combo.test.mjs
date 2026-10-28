import test from 'node:test';
import assert from 'node:assert/strict';
import { v177PaisenPhotoComboSample, v177PaisenPhotoComboJointPose } from '../app/v177PaisenPhotoCombo.js';
import { MANUAL_ABILITY_REGISTRY,createManualAbilityRuntime,beginManualAbility,advanceManualAbility } from '../app/manualAbilities.js';

const definition = MANUAL_ABILITY_REGISTRY.brawler;
const runtimeAt = time => ({ phase: time<definition.windupSeconds?'windup':'recovery',abilityElapsed:time,
  windupRemaining:time<definition.windupSeconds?definition.windupSeconds-time:definition.windupSeconds+definition.recoverySeconds-time });

test('the current repainted photo rig owns preparation, launch and return poses',()=>{
  const owner={kind:'brawler',side:'human',hp:100,combatReady:true,stunned:0,
    animationPresentation:{locomotionPhase:.2,locomotionSettle:0},manualAbility:null};
  const phases=[];
  for(const time of [.13,definition.windupSeconds,definition.windupSeconds+.1]){
    owner.manualAbility=runtimeAt(time);
    const plan=v177PaisenPhotoComboJointPose(owner,definition);
    assert.ok(plan,'current live atlas must resolve the dedicated fist-wave pose');
    assert.equal(plan.abilityPresentation,'fist-wave');phases.push(plan.attackPhase);
  }
  assert.ok(phases[0]<phases[1]&&phases[1]<phases[2]);
});

test('photo fist-wave rig reaches release pose at the actual gameplay launch event', () => {
  const before = structuredClone(definition);
  for(const steps of [[.26],[.13,.13],[.2,.06]]){
    let runtime=beginManualAbility(createManualAbilityRuntime('brawler'),{targetId:9,x:300,y:300}).runtime;
    const events=[];
    for(const dt of steps){const step=advanceManualAbility(runtime,dt);runtime=step.runtime;events.push(...step.events);}
    assert.deepEqual(events.map(e=>e.type),['fist-wave-release']);
    const sample = v177PaisenPhotoComboSample(runtime, definition);
    assert.equal(sample.requestedState, 'active');
    assert.ok(sample.clipProgress < 1e-10);
    assert.equal(sample.abilityPresentation,'fist-wave');
  }
  assert.deepEqual(definition, before, 'presentation must not alter the real ability definition');
});

test('photo fist-wave preparation and final return remain on the real ability clock', () => {
  const end=definition.windupSeconds+definition.recoverySeconds;
  assert.deepEqual(v177PaisenPhotoComboSample({ ...runtimeAt(0), phase: 'windup' }, definition),
    { requestedState: 'wind-up', clipProgress: 0,abilityPresentation:'fist-wave' });
  const half = v177PaisenPhotoComboSample(runtimeAt(definition.windupSeconds / 2), definition);
  assert.deepEqual(half, { requestedState: 'wind-up', clipProgress: .5,abilityPresentation:'fist-wave' });
  const ending = v177PaisenPhotoComboSample(runtimeAt(end - 1e-6), definition);
  assert.equal(ending.requestedState, 'recovery');
  assert.ok(ending.clipProgress > .999 && ending.clipProgress < 1);
  assert.equal(v177PaisenPhotoComboSample(runtimeAt(end), definition), null);
});

test('ready, cooldown, interrupted or invalid clocks cannot create a photo fist-wave pose', () => {
  for (const runtime of [null, { ...runtimeAt(.2), phase: 'ready' },
    { ...runtimeAt(.2), phase: 'cooldown' }, { ...runtimeAt(.2), windupRemaining:NaN },
    runtimeAt(NaN), runtimeAt(-1)]) assert.equal(v177PaisenPhotoComboSample(runtime, definition), null);
  const owner = { kind: 'brawler', side: 'human', hp: 1, combatReady: true,
    stunned: 1, manualAbility: runtimeAt(definition.windupSeconds) };
  assert.equal(v177PaisenPhotoComboJointPose(owner, definition), null);
  assert.equal(v177PaisenPhotoComboJointPose({ ...owner, kind: 'scout', stunned: 0 }, definition), null);
});
