import assert from 'node:assert/strict';

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
