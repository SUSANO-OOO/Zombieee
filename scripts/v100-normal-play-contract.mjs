import assert from 'node:assert/strict';

// Read both parts in one browser task. The result page legitimately unmounts
// the whole battle HUD; a locator that waits for the old wave node can then
// time out instead of recording the real win or loss.
export function readNormalCampaignHud({owner,action},root=globalThis.document,readFrames=globalThis.__V177_READ_NORMAL_FRAMES__) {
  const counters=root.querySelectorAll('.v100-deployed-count'),wave=root.querySelector('.phase-block');
  return {value:counters.length===1?counters[0].getAttribute('aria-label'):null,
    frames:readFrames?.(owner,action)??null,
    waveDisplay:wave?{label:wave.querySelector('em')?.textContent??'',preparation:wave.tagName==='BUTTON'}:null};
}

export function normalCampaignHudReady(observed,phase) {
  if(observed.value===null||observed.waveDisplay===null){
    assert.notEqual(phase,'battle','Normal play requires the live counter and wave HUD while battle is active');
    return false;
  }
  return true;
}

// Read the visible counter's accessible label. Compact HUD text contains only
// "3/7", so searching its text for "同時出撃" silently skipped the cap check
// and never selected an emergency escort when the actual line was empty.
export function normalCampaignDeploymentCount(label) {
  assert.equal(typeof label,'string','normal play requires the actual deployment counter');
  const match=/^同時出撃\s+(\d+)\s*\/\s*(\d+)$/u.exec(label);
  assert.ok(match,'normal play requires an unambiguous deployment count');
  const active=Number(match[1]),limit=Number(match[2]);
  assert.equal(limit,7,'the campaign deployment limit must remain seven');
  assert.ok(active<=limit,'normal play cannot accept a deployment-cap violation');
  return {active,limit};
}

// Follow the formation actually prepared through the ordinary UI. A second,
// hidden role sort delayed the equipped medic from ~3s to ~27-31s in the D28
// Stage 3 originals. Preserve that failed evidence; this restores the selected
// order, rather than declaring the campaign won or changing battle rules.
export function normalCampaignDeployOrder(kinds) {
  assert.ok(Array.isArray(kinds) && kinds.every(kind => typeof kind === 'string' && kind.length > 0));
  assert.equal(new Set(kinds).size, kinds.length, 'normal play requires one card per equipped kind');
  return [...kinds];
}

// Vehicle fire costs 70 support and the first airstrike costs 85. Preserve the
// first aircraft opportunity while an enemy target is visible and until its
// ordinary aimed UI input is acknowledged. No visible target releases defense.
// This only selects an input; it never changes gauge, time or battle rules.
// Funding depends on visible opposition, not on whether two enemies already
// fit the firing radius. Keep the same85/70 costs and ordinary UI acknowledgment.
export function normalCampaignCanSpendVehicleGauge(inputs, hasVisibleEnemyTarget = true) {
  return !hasVisibleEnemyTarget || (Array.isArray(inputs) && inputs.some(input => input?.action === 'airstrike'
    && input.acknowledgment?.disabled === 'true'));
}
