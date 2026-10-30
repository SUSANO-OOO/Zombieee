import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalCampaignDeploymentCount,readNormalCampaignHud,normalCampaignHudReady} from '../scripts/v100-normal-play-contract.mjs';

test('one native HUD read keeps the actual counter, preparation label and frame owner together',()=>{
  const wave={tagName:'BUTTON',querySelector:()=>({textContent:'次の波'})},root={querySelectorAll:()=>[{getAttribute:()=> '同時出撃 3/7'}],querySelector:()=>wave};let reads=0;
  const observed=readNormalCampaignHud({owner:'case-3',action:'drain'},root,(owner,action)=>{reads++;assert.equal(owner,'case-3');assert.equal(action,'drain');return {sourceFrames:12};});
  assert.equal(reads,1);assert.deepEqual(observed,{value:'同時出撃 3/7',frames:{sourceFrames:12},waveDisplay:{label:'次の波',preparation:true}});assert.equal(normalCampaignHudReady(observed,'battle'),true);
});

test('an unmounted terminal HUD returns immediately, but a missing live HUD remains a failure',()=>{
  const observed=readNormalCampaignHud({owner:'case-3',action:'drain'},{querySelectorAll:()=>[],querySelector:()=>null});
  assert.deepEqual(observed,{value:null,frames:null,waveDisplay:null});assert.equal(normalCampaignHudReady(observed,'result'),false);
  assert.throws(()=>normalCampaignHudReady(observed,'battle'),/requires the live counter and wave HUD/);
  assert.throws(()=>normalCampaignHudReady({value:'同時出撃 3/7',waveDisplay:null},'battle'));
});

test('a duplicate deployment counter is rejected while the native battle HUD remains mounted',()=>{
  const counter={getAttribute:()=> '同時出撃 3/7'},wave={tagName:'DIV',querySelector:()=>({textContent:'第3波'})};
  const observed=readNormalCampaignHud({owner:'case-3',action:'drain'},{querySelectorAll:()=>[counter,counter],querySelector:()=>wave});
  assert.equal(observed.value,null);assert.deepEqual(observed.waveDisplay,{label:'第3波',preparation:false});
  assert.throws(()=>normalCampaignHudReady(observed,'battle'),/requires the live counter and wave HUD/);
});

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
