import test from 'node:test';
import assert from 'node:assert/strict';
import {createCombatAnimationRuntime,advanceCombatAnimationRuntime} from '../app/combatPresentation.js';
import {V177_JOINT_ATLASES,v177JointPose,v177JointCycleDistance,v177CaptureJointPose,drawV177JointPose} from '../app/v177JointPresentation.js';

test('actual travel during reload retains the planted Gunner boot in both directions',()=>{
 const kind='gunner',atlas=V177_JOINT_ATLASES[kind],width=74.25454545454545;
 const scale=width/(atlas.referenceFrame.width*atlas.referenceFrame.scale),stride=v177JointCycleDistance(kind,width/atlas.referenceFrame.width);
 const leg=atlas.legConstraints[1],ctx=new Proxy({},{get:()=>()=>{}}),boot=(plan,x,sign)=>{
  const m=v177CaptureJointPose(kind,plan).lower[leg.effectorBone],p=leg.ankle;
  return {x:x+sign*(m[0]*p[0]+m[2]*p[1]+m[4])*scale,y:m[1]*p[0]+m[3]*p[1]+m[5],angle:Math.atan2(m[1],m[0])};
 };
 for(const state of ['reload','weapon-cycle'])for(const direction of ['right','left']){
  const sign=direction==='left'?-1:1,actor={id:1,kind,x:377.415,hp:100},world={time:0,fighters:[actor]};
  let runtime={...createCombatAnimationRuntime({x:actor.x,y:282,direction}),locomotionPhase:2.021613528241763,locomotionSettle:0,deployCompleted:true};
  const points=[];
  for(let tick=0;tick<5;tick++){
   if(tick){actor.x+=sign*.435;world.time+=1/60;runtime=advanceCombatAnimationRuntime(runtime,{kind,state,x:actor.x,y:282,direction,locomotionCycleDistance:stride},1/60);}
   const before=structuredClone({actor,runtime}),plan=v177JointPose(kind,{requestedState:state,clipProgress:tick*.1},runtime,{actor,world});
   points.push(boot(plan,actor.x,sign));
   assert.equal(drawV177JointPose(ctx,{naturalWidth:atlas.decodedWidth},kind,plan,0,0,width,100,{actor,world}),true);
   assert.deepEqual({actor,runtime},before,'Rendering must not change movement, timers or HP');
  }
  assert.ok(points.every(p=>Math.abs(p.y-points[0].y)<.001&&Math.abs(p.angle)<.001),'The measured original boot remains on its authored floor');
  const drift=Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x));
  assert.ok(drift<.0001,`${state}/${direction}: the planted boot slid ${drift} world px during actual travel`);
  assert.ok(Math.abs(runtime.elapsedSeconds-3/60)<1e-12,'Reload event time keeps advancing at the original rate');
  assert.equal(runtime.state,state);
 }
});
