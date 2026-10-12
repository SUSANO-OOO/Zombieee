import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalCampaignDeploymentCount} from '../scripts/v100-normal-play-contract.mjs';

test('normal campaign reads the compact HUD accessible counter, including the genuinely empty defense line',()=>{
  const game=readFileSync(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8');
  const match=/className="bay-status v100-deployed-count" aria-label=\{`([^`]+)`\}/u.exec(game);
  assert.ok(match,'the normal route must read the production compact counter');
  for(const active of [0,3,7]){
    const label=match[1].replace('${hud.summonedCount}',String(active));
    assert.deepEqual(normalCampaignDeploymentCount(label),{active,limit:7});
  }
});
test('missing counters, banner text and exceeded or altered deployment limits cannot pass normal campaign QA',()=>{
  for(const label of [null,undefined,'','3/7','同時出撃の上限 // 7体','同時出撃 8 / 7','同時出撃 7 / 8','同時出撃 NaN / 7'])assert.throws(()=>normalCampaignDeploymentCount(label));
});
