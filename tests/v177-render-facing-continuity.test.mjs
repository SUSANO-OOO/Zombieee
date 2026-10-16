import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { combatFacingDirection, PLAYABLE_COMBAT_KINDS } from '../app/combatPresentation.js';
import {
  beginManualAbility, createManualAbilityRuntime,
  manualAbilityLocksNormalAction, selectManualAbilityTarget,
} from '../app/manualAbilities.js';

// Execute the actual drawSpriteFighter direction selection. A separately
// rewritten resolver would miss a renderer overriding a correct runtime pose.
const source = readFileSync(new URL('../app/AshfallGame.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  const lockedDirection = Number(f.manualAbility?.target?.direction);');
const end = source.indexOf('  const anomalyTuning = ', start);
assert.ok(start > source.indexOf('function drawSpriteFighter(') && end > start);
const directionSelection = new Script(source.slice(start, end) + '\ndirection;', {
  filename: 'AshfallGame.tsx:drawSpriteFighter:direction',
});
const renderFacing = (f, overrides = {}) => directionSelection.runInNewContext({
  f, combatFacingDirection,
  manualAbilityActive: manualAbilityLocksNormalAction(f.manualAbility),
  stationAbilityPose: null, soukiPose: null,
  guardianGuardPose: null, kumaGuardArtPose: null,
  ...overrides,
});

test('an actual target without a locked direction keeps the runtime facing in the renderer', () => {
  const owner = { id: 1, side: 'human', kind: 'miyamoto-musashi', x: 200, y: 280,
    lane: 1, hp: 100, combatReady: true, aiMoveDirection: 0 };
  const enemy = { id: 2, side: 'zombie', kind: 'walker', x: 180, y: 280,
    lane: 1, hp: 100, combatReady: true };
  const target = selectManualAbilityTarget({ owner, fighters: [owner, enemy] });
  assert.equal(target.targetId, enemy.id);
  assert.equal(target.direction, undefined);
  const activation = beginManualAbility(createManualAbilityRuntime(owner.kind), target);
  assert.equal(activation.ok, true);
  const direction = combatFacingDirection({ side: owner.side, targetDirection: -1,
    manualDirection: Number(activation.runtime.target.direction),
    manualAbilityActive: manualAbilityLocksNormalAction(activation.runtime), attacking: true });
  assert.equal(direction, 'left');
  assert.equal(renderFacing({ ...owner, manualAbility: activation.runtime,
    animationPresentation: { direction } }), direction);
});

test('all ally forms preserve the actual facing when an ability has no finite nonzero lock', () => {
  assert.equal(PLAYABLE_COMBAT_KINDS.length, 16);
  for (const kind of PLAYABLE_COMBAT_KINDS) {
    for (const direction of ['left', 'right']) {
      for (const lockedDirection of [undefined, NaN, Infinity, -Infinity, 0]) {
        for (const aiMoveDirection of [-1, 0, 1]) {
          const f = { side: 'human', kind, aiMoveDirection,
            manualAbility: { phase: 'windup', target: { direction: lockedDirection } },
            animationPresentation: { direction } };
          assert.equal(renderFacing(f), direction, `${kind}/${direction}/${lockedDirection}/${aiMoveDirection}`);
        }
      }
    }
  }
});

test('explicit manual and station pose directions keep their existing render priority', () => {
  const f = { side: 'human', aiMoveDirection: -1, animationPresentation: { direction: 'left' },
    manualAbility: { phase: 'windup', target: { direction: 1 } } };
  assert.equal(renderFacing(f), 'right');
  assert.equal(renderFacing(f, { stationAbilityPose: { direction: -1 } }), 'left');
  assert.equal(renderFacing(f, { soukiPose: {} }), 'left');
  assert.equal(renderFacing(f, { guardianGuardPose: {} }), 'right');
  assert.equal(renderFacing(f, { kumaGuardArtPose: {} }), 'right');
  assert.equal(renderFacing({ ...f, manualAbility: { phase: 'ready' } }), 'left');
});
