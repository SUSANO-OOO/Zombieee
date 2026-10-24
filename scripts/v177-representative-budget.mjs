import assert from 'node:assert/strict';
import { createDefaultV100Save, normalizeV100Save } from '../app/v100Save.js';
import { V100_BOSSES, V100_STAGE_IDS, V100_VEHICLE } from '../app/v100Registry.js';
import {
  createV100BattleResult, recordV100PendingResult, finalizeV100PendingResult,
  purchaseV100Unit, purchaseV100Support, equipV100Support,
  upgradeV100Unit, upgradeV100Vehicle,
} from '../app/v100Transactions.js';

export const V177_REPRESENTATIVE_FORMATIONS = Object.freeze({
  14: Object.freeze(['unit-gantetsu', 'unit-nao', 'unit-babayaga', 'unit-mizuchi', 'unit-monkey', 'unit-paisen', 'unit-hachi']),
  25: Object.freeze(['unit-tatara', 'unit-raider', 'unit-zakimiya', 'unit-mayo-chan', 'unit-kumaverson', 'unit-nao', 'unit-gantetsu']),
  30: Object.freeze(['unit-miyamoto-musashi', 'unit-mrs-chiha', 'unit-tky', 'unit-crazy-king', 'unit-nao', 'unit-gantetsu', 'unit-mizuchi']),
});

// Only the prefix is synthetic. Every reward and purchase uses production
// transactions, at one star per first clear, with no replay or star bonuses.
// These fixtures prove a conservative purchasing budget, not earned victories.
export function createV177RepresentativeBudget(stageNumber) {
  assert.ok(Number.isInteger(stageNumber), 'representative stage number must be an integer');
  const formation = V177_REPRESENTATIVE_FORMATIONS[stageNumber];
  assert.ok(formation, 'representative stages are 14, 25 and 30');
  const now = '2026-10-16T00:00:00.000Z';
  let save = createDefaultV100Save({ playerName: '通常動作確認', now });
  const initialCaps = save.caps, rewards = [], purchases = [];
  for (let number = 1; number < stageNumber; number += 1) {
    const result = createV100BattleResult({ stageId: V100_STAGE_IDS[number - 1], battleRunId: `synthetic-budget-s${number}`,
      won: true, objectiveComplete: true, bossDefeated: V100_BOSSES.some(boss => boss.stageNumber === number),
      vehicleHp: 1, vehicleMaxHp: V100_VEHICLE.baseHp });
    assert.equal(result.stars, 1);
    const pending = recordV100PendingResult(save, result, { now });
    assert.equal(pending.applied, true);
    const settled = finalizeV100PendingResult(pending.save, { result, now });
    assert.equal(settled.applied, true);
    rewards.push({ stageNumber: number, capsBefore: save.caps, capsAfter: settled.save.caps,
      rewardCaps: settled.save.lastResult.rewardCaps, breakdown: settled.save.lastResult.rewardBreakdown,
      battleRunId: result.battleRunId, synthetic: true });
    save = settled.save;
  }
  const earnedCaps = save.caps - initialCaps;
  function spend(type, id, mutation) {
    assert.equal(mutation.applied, true, `${type} ${id}: ${mutation.reason}`);
    assert.ok(mutation.save.caps <= save.caps);
    purchases.push({ type, id, capsBefore: save.caps, capsAfter: mutation.save.caps, spentCaps: save.caps - mutation.save.caps });
    save = mutation.save;
  }
  for (const id of formation) {
    assert.ok(save.registeredUnitIds.includes(id), `${id} must already be unlocked`);
    if (!save.ownedUnitIds.includes(id)) spend('unit', id, purchaseV100Unit(save, id, { now }));
  }
  if (!save.ownedSupportIds.includes('support-healing')) spend('support', 'support-healing', purchaseV100Support(save, 'support-healing', { now }));
  if (save.equippedSupportId !== 'support-healing') spend('equip-support', 'support-healing', equipV100Support(save, 'support-healing', { now }));
  const vehicleTarget = Math.min(3, Math.floor(stageNumber / 10));
  while (save.vehicle.upgradeLevel < vehicleTarget) {
    const mutation = upgradeV100Vehicle(save, { now });
    if (!mutation.applied) { assert.equal(mutation.reason, 'insufficient-caps'); break; }
    spend('vehicle', save.vehicle.upgradeLevel + 1, mutation);
  }
  for (let step = 0; step < formation.length * 29; step += 1) {
    const candidates = [...formation].sort((a, b) => save.unitLevels[a] - save.unitLevels[b]);
    const upgrade = candidates.map(id => ({ id, mutation: upgradeV100Unit(save, id, { expectedLevel: save.unitLevels[id], now }) })).find(item => item.mutation.applied);
    if (!upgrade) break;
    spend('level', upgrade.id, upgrade.mutation);
  }
  const stageId = V100_STAGE_IDS[stageNumber - 1];
  save = normalizeV100Save({ ...save, campaignStarted: true, formationSlots: [...formation],
    flowState: { phase: 'formation', eventId: null, stageId, stageNumber, destination: 'formation', nodeIndex: 0, firstClear: false, finalized: true } });
  assert.equal(initialCaps + earnedCaps - purchases.reduce((sum, item) => sum + item.spentCaps, 0), save.caps);
  return { save, budget: {
    schema: 'v177-representative-purchasing-budget/v1', stageNumber, stageId, initialCaps, earnedCaps,
    spentCaps: purchases.reduce((sum, item) => sum + item.spentCaps, 0), remainingCaps: save.caps,
    rewards, purchases, syntheticPrefixStages: stageNumber - 1, starsPerFirstClear: 1,
    replayGrind: false, earnedCampaignAcceptance: false, difficultyAcceptance: false,
    scope: 'Prior-stage victories are synthetic one-star production receipts. CAPS, registrations, purchases, levels and vehicle upgrades use production rules; subsequent battle inputs and outcomes must be observed independently.',
  } };
}
