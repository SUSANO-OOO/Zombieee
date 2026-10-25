import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {v177RangerFootPlacement as current} from '../app/v177RangerFootPlacement.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
const source=execFileSync('git',['show','d5527a3ca2a6488c0255e8576916b7a05e4f6170:app/v177RangerFootPlacement.js'],{encoding:'utf8'});
const resolved=source.replace(/(from\s+['"])(\.\/[^'"]+)(['"])/gu,(_all,a,p,b)=>a+new URL('../app/'+p.slice(2),import.meta.url).href+b);
const {v177RangerFootPlacement:original}=await import('data:text/javascript;base64,'+Buffer.from(resolved).toString('base64'));
const atlas=V177_JOINT_ATLASES.guardian;
const rig={phaseOwned:true,spanPx:40,liftPx:18,stanceFraction:.62,bob:()=>0,
  legs:atlas.legConstraints.map((leg,i)=>({...leg,footCenter:leg.ankle[0],groundAnkle:leg.ankle[1],restOffset:0,offset:i*.5,
    upperLength:Math.hypot(leg.knee[0]-leg.hip[0],leg.knee[1]-leg.hip[1]),lowerLength:Math.hypot(leg.ankle[0]-leg.knee[0],leg.ankle[1]-leg.knee[1])}))};
const base={time:0,root:300,phase:0,scale:.2,settle:1,moving:false,facing:1,bodyCorrection:0};
test('settled bipeds advance time with exact original feet/targets while sharing only immutable resting records',()=>{
  let a=current(rig,null,base),b=original(rig,null,base);
  for(let tick=1;tick<=600;tick++){
    const previous=a.state,copy=structuredClone(previous),input={...base,time:tick/60};
    for(const foot of previous.feet)Object.freeze(foot);Object.freeze(previous.feet);
    a=current(rig,previous,input);b=original(rig,b.state,input);
    assert.deepEqual(a,b);assert.equal(a.state.time,tick/60);assert.equal(a.state.feet,previous.feet);assert.deepEqual(previous,copy);
  }
});
test('movement, turning, unsettled feet, impulses and corrections keep the original transition path',()=>{
  const seed=original(rig,null,base).state;
  for(const delta of [{moving:true,root:300.4,phase:.02},{facing:-1},{settle:.9},{frozen:true},{bodyCorrection:1,root:299.9},{root:300.1}]){
    const previous=structuredClone(seed),input={...base,time:.02,...delta};
    assert.deepEqual(current(rig,previous,input),original(rig,previous,input));
  }
});
