import test from 'node:test';
import assert from 'node:assert/strict';
import { createV177RepresentativeBudget } from '../scripts/v177-representative-budget.mjs';
import { assertRepresentativeBattleObservation, V177_REPRESENTATIVE_WINDOW_MS } from '../scripts/v177-representative-battles.mjs';

function observed(outcome, number = 14) {
  const fixture = createV177RepresentativeBudget(number);
  const openingSave = structuredClone(fixture.save);
  openingSave.flowState.phase = 'battle';
  const finalSave = structuredClone(openingSave);
  if (outcome !== 'observed-window') finalSave.pendingResult = { battleRunId: `v100:${fixture.budget.stageId}:${openingSave.revision}`, won: outcome === 'won' };
  return { number, budget: fixture.budget, openingSave, finalSave, outcome, wallElapsedMs: V177_REPRESENTATIVE_WINDOW_MS,
    inputs: [{ action: 'deploy' }], snapshots: [{ humans: 2, enemies: 3 }], errors: [], requestAudit: { unexpectedFailures: [] },
    nativeClip: { status: 'recorded', errors: [], bytes: 2048, originalSpeedAccepted: false }, videoBytes: 4096 };
}

test('independent representative observations finish on a real defeat or the bounded window without requiring victory', () => {
  for (const number of [14, 25, 30]) for (const outcome of ['lost', 'won', 'observed-window']) {
    const row = observed(outcome, number), before = structuredClone(row);
    const result = assertRepresentativeBattleObservation(row);
    assert.equal(result.observationStatus, outcome);
    assert.equal(result.earnedCampaignAcceptance, false);
    assert.equal(result.balanceAcceptance, false);
    assert.equal(result.originalSpeedAccepted, false);
    assert.equal(result.releaseAcceptance, false);
    assert.deepEqual(row, before, 'do not rewrite the actual outcome');
  }
});

test('faults, unearned money, absent combat/video and forced results cannot be accepted as representative observations', () => {
  const mutations = [
    row => { row.errors.push('pageerror'); }, row => { row.requestAudit.unexpectedFailures.push('asset404'); },
    row => { row.captureError = 'native recorder failed'; }, row => { row.saveCaptureError = 'save failed'; },
    row => { row.videoCaptureError = 'video failed'; }, row => { row.budget.earnedCaps += 1; },
    row => { row.openingSave.caps += 1; row.finalSave.caps += 1; }, row => { row.finalSave.caps += 1; },
    row => { row.finalSave.completedStageIds.push(row.budget.stageId); }, row => { row.openingSave.unitLevels['unit-gantetsu'] = 30; },
    row => { row.inputs.length = 0; }, row => { row.snapshots[0].enemies = 0; },
    row => { row.nativeClip.status = 'invalid'; }, row => { row.nativeClip.errors.push('clip-time-limit'); },
    row => { row.nativeClip.bytes = 0; }, row => { row.videoBytes = 0; },
    row => { row.finalSave.pendingResult.won = true; }, row => { row.finalSave.pendingResult.battleRunId = 'forged'; },
  ];
  for (const mutate of mutations) { const row = observed('lost'); mutate(row); assert.throws(() => assertRepresentativeBattleObservation(row)); }
  const early = observed('observed-window'); early.wallElapsedMs = 100; assert.throws(() => assertRepresentativeBattleObservation(early));
  const forced = observed('observed-window'); forced.finalSave.pendingResult = { won: true }; assert.throws(() => assertRepresentativeBattleObservation(forced));
});
