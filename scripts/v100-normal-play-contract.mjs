import assert from 'node:assert/strict';
import { AIRSTRIKE_DEF } from '../app/gameRules.js';

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

export function normalCampaignAirstrikeTarget(canvas, anchors, hudText = '') {
  if (!canvas || !['x','y','width','height','worldScale','worldOffsetX','worldOffsetY'].every(key => Number.isFinite(canvas[key])) || canvas.width <= 0 || canvas.height <= 0 || canvas.worldScale <= 0) return null;
  const visible = (anchors ?? []).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)
    && point.x >= 0 && point.x <= canvas.width && point.y >= 0 && point.y <= canvas.height);
  const front = [...visible].sort((a,b) => b.x - a.x)[0];
  const health = /耐久\s+(\d+)\s*[/／]\s*(\d+)/u.exec(hudText);
  const defensive = Boolean(health && Number(health[2]) > 0 && Number(health[1]) < Number(health[2]) * .98);
  const x = front ? defensive ? Math.min(front.x,canvas.width * .34) : front.x + Math.min(36,canvas.width * .04) : canvas.width * .34;
  const y = front ? front.y + 24 : canvas.height * .60;
  const margin = Math.min(12,canvas.width / 4,canvas.height / 4);
  // Aim one world pixel inside the valid edge: CSS transforms can round an
  // exact boundary just outside the production placement check.
  const left = Math.max(margin,canvas.worldOffsetX + (AIRSTRIKE_DEF.minX + 1) * canvas.worldScale);
  const right = Math.min(canvas.width - margin,canvas.worldOffsetX + (AIRSTRIKE_DEF.maxX - 1) * canvas.worldScale);
  if (left > right) return null;
  const localX = Math.max(left,Math.min(right,x)), localY = Math.max(margin,Math.min(canvas.height - margin,y));
  return {point: {x: canvas.x + localX,y: canvas.y + localY},
    worldPoint: {x: (localX - canvas.worldOffsetX) / canvas.worldScale,y: (localY - canvas.worldOffsetY) / canvas.worldScale},
    defensive, visibleSquadAnchors: visible};
}
