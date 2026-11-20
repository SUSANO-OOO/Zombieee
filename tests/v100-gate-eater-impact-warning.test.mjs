import assert from 'node:assert/strict';
import test from 'node:test';
import { beginTicketGateEaterCharge, advanceTicketGateEaterCharge, STATION_ENEMY_TUNING } from '../app/stationEnemyMechanics.js';
import { drawV100GateChargeWarning, ticketGateEaterImpactPreview } from '../app/v100BossAttackVfx.js';

const laneCenters = [210, 285, 350];
const minimumX = 166;
const impactRadius = STATION_ENEMY_TUNING.ticketGateEater.chargeImpactRadius;
const startingBoss = {
  id: 1, side: 'zombie', kind: 'gate-eater', hp: 3200, x: 600, y: 281, lane: 1, combatReady: true,
};

test('the warning follows the actual charge stop from windup until impact on the locked lane', () => {
  for (const [startX, targetX] of [[600, 550], [600, 200], [600, 730], [600, 900], [215, minimumX]]) {
    let boss = { ...startingBoss, x: startX };
    const started = beginTicketGateEaterCharge({ boss, targetX });
    assert.equal(started.ok, true);
    let runtime = started.runtime;
    const preview = [];
    for (let tick = 0; tick < 180 && runtime.phase !== 'exposed'; tick += 1) {
      const location = ticketGateEaterImpactPreview({ ...boss, stationAbility: runtime }, laneCenters, minimumX);
      assert.ok(location);
      preview.push(location);
      const step = advanceTicketGateEaterCharge({ boss, runtime, elapsedSeconds: 1 / 60 });
      boss = { ...step.boss, x: Math.max(minimumX, step.boss.x) };
      runtime = step.runtime;
    }
    assert.equal(runtime.phase, 'exposed');
    for (const mark of preview) {
      assert.ok(Math.abs(mark.x - boss.x) < 1e-6, JSON.stringify({ targetX, mark, stoppedAt: boss.x }));
      assert.equal(mark.y, laneCenters[boss.lane]);
      assert.equal(mark.radius, impactRadius);
    }
    assert.equal(ticketGateEaterImpactPreview({ ...boss, stationAbility: runtime }, laneCenters, minimumX), null);
  }
});

test('the floor light paints only the live attacking boss damage area and restores canvas state', () => {
  const calls = [];
  const state = { globalAlpha: .77, globalCompositeOperation: 'screen', fillStyle: '#fff' };
  const stack = [];
  const ctx = {
    ...state,
    save() { stack.push({globalAlpha:this.globalAlpha,globalCompositeOperation:this.globalCompositeOperation,fillStyle:this.fillStyle}); },
    restore() { Object.assign(this, stack.pop()); },
    createRadialGradient(...args) {
      const colors = [];
      calls.push({ type: 'gradient', args, colors });
      return { addColorStop(at, color) { colors.push({at,color}); } };
    },
    fillRect(...args) { calls.push({ type:'paint', args, opacity:this.globalAlpha }); },
  };
  const { runtime } = beginTicketGateEaterCharge({ boss: startingBoss, targetX: 200 });
  const ready = { ...startingBoss, stationAbility: runtime };
  const world = {
    time: 20,
    fighters: [ready, { ...ready, hp: 0 }, { ...ready, contained: true }, { ...ready, combatReady: false },
      { ...ready, stationAbility: { ...runtime, phase: 'exposed' } }, { ...ready, kind: 'ooguchi' }],
  };
  const before = structuredClone(world);
  const {x,y,radius} = ticketGateEaterImpactPreview(ready,laneCenters,minimumX);
  drawV100GateChargeWarning(ctx, world, laneCenters, minimumX);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].args, [x, y, 14, x, y, radius]);
  assert.ok(calls[0].colors.at(-1).color.endsWith(',0)'));
  assert.deepEqual(calls[1].args, [x-radius, y-radius, radius*2, radius*2]);
  assert.ok(calls[1].opacity>0 && calls[1].opacity<.55);
  assert.deepEqual(world, before);
  assert.equal(stack.length, 0);
  for (const [key,value] of Object.entries(state)) assert.equal(ctx[key],value);
});
