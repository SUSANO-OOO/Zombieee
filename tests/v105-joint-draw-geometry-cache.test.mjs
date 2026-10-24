import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as current from '../app/v177JointPresentation.js';

// The unchanged pre-optimization algorithm is an immutable image/matrix
// oracle. This does not inherit any old runtime or performance acceptance.
const before=execFileSync('git',['show','eabe9195c6277c4b27b3709871a6a2dc5b9657cc:app/v177JointPresentation.js'],{encoding:'utf8',maxBuffer:512*1024});
const resolved=before.replace(/(from\s+['"])(\.\/[^'"]+)(['"])/gu,(_all,a,p,b)=>a+new URL('../app/'+p.slice(2),import.meta.url).href+b);
const original=await import('data:text/javascript;base64,'+Buffer.from(resolved).toString('base64'));
function draw(module,kind,plan){
  const calls=[],values={globalAlpha:1};
  const ctx=new Proxy(values,{
    get:(o,k)=>{
      if(k in o)return o[k];
      if(k==='createLinearGradient')return(...args)=>{calls.push([k,...args]);return{addColorStop:(...args)=>calls.push(['colorStop',...args])};};
      return(...args)=>calls.push([k,...(k==='drawImage'?args.slice(1):args)]);
    },
    set:(o,k,v)=>{calls.push(['set',k,typeof v==='object'?'gradient':v]);o[k]=v;return true;},
  });
  module.drawV177JointPose(ctx,{naturalWidth:512,naturalHeight:512},kind,plan,-48,-80,96,96);
  return calls;
}

test('one-draw chain reuse preserves exact original paint commands and every source matrix across rigid bodies',()=>{
  let poses=0;
  for(const [kind,atlas]of Object.entries(current.V177_JOINT_ATLASES)){
    if(atlas.type!=='rigid-parts')continue;
    for(const state of ['idle','move','wind-up','active','recovery','reload'])for(const p of [0,.13,.41,.83,1]){
      const actor={id:1,kind,side:'human',hp:100,combatReady:true,x:300,y:300,knock:0,attackSequence:2,
        attackWindup:state==='wind-up'?.2:0,animationPresentation:{moving:state==='move',locomotionPhase:p,locomotionSettle:state==='move'?0:1,direction:'right'}};
      const world={time:1,fighters:[actor]},sample={requestedState:state,clipProgress:p};
      let plan=current.v177JointPose(kind,sample,actor.animationPresentation,{grounded:true,actor,world});
      if(!plan)continue;
      plan=current.v105BipedFootPlan(kind,plan,{actor,world,width:96,frame:{anchorX:.5},direction:'right'});
      assert.deepEqual(draw(current,kind,plan),draw(original,kind,plan),kind+'/'+state+'/'+p);
      assert.deepEqual(current.v177CaptureJointPose(kind,plan),original.v177CaptureJointPose(kind,plan));
      // A following paint must not retain geometry from this draw, even when
      // an owner reuses the plan while changing its final rigid correction.
      if(plan.groundedMotion){
        plan.groundedMotion={...plan.groundedMotion,lower:[...plan.groundedMotion.lower],upper:[...plan.groundedMotion.upper]};
        plan.groundedMotion.lower[4]+=.125;plan.groundedMotion.upper[4]+=.125;
        assert.deepEqual(draw(current,kind,plan),draw(original,kind,plan));
      }
      poses++;
    }
  }
  assert.ok(poses>1000,'All registered rigid source bodies must participate');
});
