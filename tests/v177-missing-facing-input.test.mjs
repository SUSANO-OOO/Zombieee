import test from 'node:test';
import assert from 'node:assert/strict';
import { combatFacingFromMotion } from '../app/enemyFacingContract.js';
import { combatFacingDirection } from '../app/combatPresentation.js';

test('an ability without a direction must retain actual movement or attack target facing', () => {
  // AshfallGame passes Number(fighter.manualAbility?.target?.direction).
  for (const manualDirection of [Number(undefined), Infinity, -Infinity]) {
    for (const resolve of [combatFacingFromMotion, combatFacingDirection]) {
      assert.equal(resolve({ side: 'human', manualAbilityActive: true, manualDirection, actualXDelta: -2 }), 'left');
      assert.equal(resolve({ side: 'human', manualAbilityActive: true, manualDirection, attacking: true, targetDirection: -1 }), 'left');
    }
  }
});

test('a missing target direction cannot force an enemy to face right', () => {
  for (const resolve of [combatFacingFromMotion, combatFacingDirection]) {
    for (const attacking of [false, true]) {
      assert.equal(resolve({ side: 'zombie', targetDirection: NaN, attacking, entryDirection: -1 }), 'left');
    }
  }
});

test('finite manual and attack directions keep their established priority', () => {
  const resolve = combatFacingFromMotion;
  assert.equal(resolve({ side: 'human', manualAbilityActive: true, manualDirection: 1, actualXDelta: -2, attacking: true, targetDirection: -1 }), 'right');
  assert.equal(resolve({ side: 'human', manualAbilityActive: true, manualDirection: -1, actualXDelta: 2, targetDirection: 1 }), 'left');
  assert.equal(resolve({ side: 'human', attacking: true, targetDirection: -1, actualXDelta: 2 }), 'left');
  assert.equal(resolve({ side: 'human', actualXDelta: -2, targetDirection: 1 }), 'left');
  assert.equal(resolve({ side: 'zombie', actualXDelta: 2, targetDirection: -1 }), 'right');
});
