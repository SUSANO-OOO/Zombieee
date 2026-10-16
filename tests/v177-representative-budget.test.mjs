import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultV100Save, deserializeV100Save, serializeV100Save } from '../app/v100Save.js';
import { V100_STAGE_IDS, V100_UNITS, v100StageReward } from '../app/v100Registry.js';
import { finalizeV100PendingResult } from '../app/v100Transactions.js';
import { createV177RepresentativeBudget, V177_REPRESENTATIVE_FORMATIONS } from '../scripts/v177-representative-budget.mjs';

test('middle and late fixtures spend only the real one-star first-clear budget', () => {
  for (const number of [14, 25, 30]) {
    const { save, budget } = createV177RepresentativeBudget(number);
    const expected = Array.from({ length: number - 1 }, (_, index) => v100StageReward(index + 1, 'first-clear')).reduce((a, b) => a + b, 0);
    assert.equal(budget.initialCaps, createDefaultV100Save().caps);
    assert.equal(budget.earnedCaps, expected);
    assert.equal(save.caps, budget.initialCaps + expected - budget.spentCaps);
    assert.ok(save.caps >= 0);
    assert.deepEqual(save.completedStageIds, V100_STAGE_IDS.slice(0, number - 1));
    assert.deepEqual(save.availableStageIds, V100_STAGE_IDS.slice(0, number));
    for (const reward of budget.rewards) {
      assert.deepEqual(reward.breakdown, { firstClear: v100StageReward(reward.stageNumber, 'first-clear'), replay: 0, star2: 0, star3: 0 });
      assert.equal(reward.synthetic, true);
    }
    assert.equal(budget.earnedCampaignAcceptance, false);
    assert.equal(budget.difficultyAcceptance, false);
  }
});

test('fixtures retain valid save receipts, unlocked ownership and paid progression', () => {
  for (const number of [14, 25, 30]) {
    const { save, budget } = createV177RepresentativeBudget(number);
    assert.equal(deserializeV100Save(serializeV100Save(save)).ok, true);
    assert.equal(finalizeV100PendingResult(save).applied, false, 'synthetic rewards are already settled once');
    assert.equal(save.pendingResult, null);
    assert.equal(save.flowState.phase, 'formation');
    assert.equal(save.flowState.stageNumber, number);
    assert.deepEqual(save.formationSlots, [...V177_REPRESENTATIVE_FORMATIONS[number]]);
    for (const id of save.formationSlots) {
      assert.ok(save.ownedUnitIds.includes(id));
      assert.ok(save.registeredUnitIds.includes(id));
      assert.ok(save.unitLevels[id] >= 1 && save.unitLevels[id] <= save.levelCap);
    }
    for (const item of budget.purchases) assert.equal(item.capsBefore - item.capsAfter, item.spentCaps);
    assert.ok(Object.values(save.unitLevels).some(level => level < save.levelCap), 'no blanket max-level fixture');
    assert.equal(save.vehicle.upgradeReceipts.length, save.vehicle.upgradeLevel);
  }
});

test('the three bounded formations cover every ally, with deterministic independent budgets', () => {
  const forms = new Set(Object.values(V177_REPRESENTATIVE_FORMATIONS).flat());
  assert.deepEqual([...forms].sort(), V100_UNITS.map(unit => unit.id).sort());
  for (const number of [14, 25, 30]) assert.deepEqual(createV177RepresentativeBudget(number), createV177RepresentativeBudget(number));
  for (const bad of [0, 3, 13, 31, NaN, '14', '__proto__']) assert.throws(() => createV177RepresentativeBudget(bad));
});
