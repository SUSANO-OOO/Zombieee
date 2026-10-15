import test from 'node:test';
import assert from 'node:assert/strict';
import { v177PaisenPhotoComboSample, v177PaisenPhotoComboJointPose } from '../app/v177PaisenPhotoCombo.js';
import { advanceV100BrawlerCombo, v100BrawlerComboTiming } from '../app/v100BrawlerCombo.js';
import { MANUAL_ABILITY_REGISTRY } from '../app/manualAbilities.js';

const definition = MANUAL_ABILITY_REGISTRY.brawler;
const runtimeAt = time => ({ phase: 'salvo', sequentialBrawler: true, abilityElapsed: time });

test('photo combo reaches its extended source pose at every actual existing contact', () => {
  const before = structuredClone(definition), timing = v100BrawlerComboTiming(definition);
  let runtime = { phase: 'windup', sequentialBrawler: true, abilityElapsed: 0,
    activationId: 4, cooldownRemaining: 0, target: { id: 9, direction: 1 } };
  const impacts = [];
  for (let step = 0; step < 240 * (timing.recoveryEnd + .1); step++) {
    const next = advanceV100BrawlerCombo(runtime, 1 / 240, definition);
    runtime = next.runtime; impacts.push(...next.events.filter(event => event.type === 'impact'));
  }
  assert.equal(impacts.length, definition.hitCount);
  for (const event of impacts) {
    const sample = v177PaisenPhotoComboSample(runtimeAt(event.timelineAt), definition);
    assert.equal(sample.requestedState, 'active');
    assert.ok(sample.clipProgress < 1e-10);
  }
  assert.deepEqual(definition, before, 'presentation must not alter the real ability definition');
});

test('photo combo preparation and final return remain on the real ability clock', () => {
  const timing = v100BrawlerComboTiming(definition);
  assert.deepEqual(v177PaisenPhotoComboSample({ ...runtimeAt(0), phase: 'windup' }, definition),
    { requestedState: 'wind-up', clipProgress: 0 });
  const half = v177PaisenPhotoComboSample(runtimeAt(definition.windupSeconds / 2), definition);
  assert.deepEqual(half, { requestedState: 'wind-up', clipProgress: .5 });
  const ending = v177PaisenPhotoComboSample({ ...runtimeAt(timing.recoveryEnd - 1e-6), phase: 'recovery' }, definition);
  assert.equal(ending.requestedState, 'recovery');
  assert.ok(ending.clipProgress > .999 && ending.clipProgress < 1);
  assert.equal(v177PaisenPhotoComboSample(runtimeAt(timing.recoveryEnd), definition), null);
});

test('ready, cooldown, interrupted or invalid clocks cannot create a photo combo pose', () => {
  for (const runtime of [null, { ...runtimeAt(.2), phase: 'ready' },
    { ...runtimeAt(.2), phase: 'cooldown' }, { ...runtimeAt(.2), sequentialBrawler: false },
    runtimeAt(NaN), runtimeAt(-1)]) assert.equal(v177PaisenPhotoComboSample(runtime, definition), null);
  const owner = { kind: 'brawler', side: 'human', hp: 1, combatReady: true,
    stunned: 1, manualAbility: runtimeAt(definition.windupSeconds) };
  assert.equal(v177PaisenPhotoComboJointPose(owner, definition), null);
  assert.equal(v177PaisenPhotoComboJointPose({ ...owner, kind: 'scout', stunned: 0 }, definition), null);
});
