import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {v177JointPose,V177_JOINT_ATLASES,v177CaptureJointPose,drawV177JointPose} from '../app/v177JointPresentation.js';
import {v177LivingStunState,v177LivingStunSample,v177RangerLivingStunSample} from '../app/v177LivingStun.js';
import {advanceCombatAnimationRuntime,createCombatAnimationRuntime} from '../app/combatPresentation.js';
import {traceRangerPose,rangerPoint as point} from './helpers/v177-ranger-render.mjs';

const atlas=V177_JOINT_ATLASES.ranger,rig=atlas.upperRig;
const actor=()=>({kind:'ranger',hp:30,stunned:.6,combatReady:true,gateEntering:false,contained:false,
  flash:0,attack:0,attackWindup:0,abilityWindup:0,stationAbility:{phase:'idle'}});
const runtime={state:'idle',locomotionPhase:.371,locomotionSettle:.5,elapsedSeconds:0,transitionCount:2};
const sample=t=>t<.28?{requestedState:'wind-up',clipProgress:t/.28}:t<.7
  ?{requestedState:'active',clipProgress:(t-.28)/.42}:{requestedState:'recovery',clipProgress:(t-.7)/.3};
const matrices=trace=>Object.fromEntries(rig.parts.map((part,i)=>[part.bone,trace.calls[i+1].matrix]));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function connected(trace) {
  assert.equal(trace.calls.length,1+V177_JOINT_ATLASES.ranger.upperRig.parts.length,'one weighted lower and seven upper parts, without ghost feet');
  const m=matrices(trace);
  assert.ok(distance(point(m.spine,[230.5,112]),point(m.head,[230.5,112]))<.001);
  for(const c of rig.armConstraints)for(const [a,b]of [
    [point(m.spine,c.shoulder),point(m[c.upperBone],c.shoulder)],
    [point(m[c.upperBone],c.elbow),point(m[c.lowerBone],c.elbow)],
    [point(m[c.lowerBone],c.wrist),point(m[c.effectorBone],c.wrist)],
  ])assert.ok(distance(a,b)<.001,'painted shoulder/elbow/grip remains connected');
  for(const matrix of Object.values(m))assert.ok(matrix.every(Number.isFinite)&&Math.abs(Math.hypot(matrix[0],matrix[1])-1)<1e-10);
}
function samePaint(a,b) {
  assert.deepEqual(a.calls[0],b.calls[0]);
  for(let i=1;i<a.calls.length;i++)for(let j=0;j<6;j++)assert.ok(Math.abs(a.calls[i].matrix[j]-b.calls[i].matrix[j])<.001);
}
const stun=(f,r,remaining)=>v177JointPose('ranger',v177LivingStunSample('ranger'),r,{actor:f,stunRemaining:remaining});

test('the actual Ranger draw selector fills living stun without changing the real gait runtime or its owners',()=>{
  const source=readFileSync('app/AshfallGame.tsx','utf8'),tree=ts.createSourceFile('game.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const declarations={};const visit=node=>{if(ts.isVariableDeclaration(node)&&['presentationState','rangerStunSample'].includes(node.name.getText(tree)))declarations[node.name.getText(tree)]=node.initializer.getText(tree);ts.forEachChild(node,visit);};visit(tree);
  assert.equal(Object.keys(declarations).length,2);
  const selectState=new Function('fighter','manualAbilityActive','mayoRetreatSpriteState','V177_JOINT_ATLASES','v177LivingStunState','return ('+declarations.presentationState+');');
  const selectDraw=new Function('f','options','renderKind','manualAbilityActive','V177_JOINT_ATLASES','v177RangerLivingStunSample','return ('+declarations.rangerStunSample+');');
  const f=actor(),before=JSON.stringify(f),r=createCombatAnimationRuntime({x:200,y:0,direction:'right'});
  assert.equal(selectState(f,false,()=>assert.fail(),V177_JOINT_ATLASES,v177LivingStunState),null);
  const draw=selectDraw({...f,animationPresentation:r},{v100AuthoredPresentation:true},'ranger',false,V177_JOINT_ATLASES,v177RangerLivingStunSample);
  assert.equal(draw.requestedState,'incapacitated');assert.equal(draw.spriteState,'idle');
  assert.equal(selectDraw({...f,animationPresentation:r},{v100AuthoredPresentation:false},'ranger',false,V177_JOINT_ATLASES,v177RangerLivingStunSample),null);
  const observation={kind:'ranger',x:201,y:0,direction:'right',locomotionCycleDistance:atlas.cycleDistance};
  assert.deepEqual(advanceCombatAnimationRuntime(r,{...observation,state:selectState(f,false,()=>{},V177_JOINT_ATLASES,v177LivingStunState)},.016),advanceCombatAnimationRuntime(r,observation,.016));
  for(const patch of [{kind:'medic'},{hp:0},{stunned:0},{flash:.1},{attack:.1},{attackWindup:.1},{abilityWindup:.1},
    {contained:true},{combatReady:false},{gateEntering:true},{stationAbility:{phase:'active'}}])assert.equal(v177RangerLivingStunSample({...f,...patch},r),null);
  for(const state of ['deploy','reload','weapon-cycle','recovery','active','hit-light','special','retreat'])assert.equal(v177RangerLivingStunSample(f,{...r,state}),null);
  assert.equal(v177RangerLivingStunSample(f,r,{manualAbilityActive:true}),null);assert.equal(v177RangerLivingStunSample(f,r,{supported:false}),null);
  assert.equal(JSON.stringify(f),before);
});

test('painted Ranger attacks enter stun exactly and keep weighted feet, waist, neck and both grips through short and long returns',()=>{
  const original=JSON.stringify(atlas);
  for(const phase of [0,.1,.28,.43,.7,.83,1])for(const gait of [0,.249,.673,.999])for(const settle of [0,.5,1])for(const duration of [.04,.1,.3,.6]){
    const f=actor(),r={...runtime,locomotionPhase:gait,locomotionSettle:settle};
    const initial=v177JointPose('ranger',sample(phase),r,{actor:f}),painted=traceRangerPose(initial,{actor:f});
    const entry=stun(f,r,duration);assert.ok(entry.liveStun);assert.deepEqual(traceRangerPose(entry,{actor:f}).calls,painted.calls);
    for(let i=1;i<=12;i++){
      const elapsed=duration*i/12,remaining=Math.max(1e-12,duration-elapsed),current={...r,elapsedSeconds:i%2?999:0,transitionCount:i,
        locomotionSettle:Math.min(1,settle+elapsed/.16)};
      const plan=stun(f,current,remaining),trace=traceRangerPose(plan,{actor:f});connected(trace);
      const neutral=v177JointPose('ranger',{requestedState:'idle'},current);
      assert.equal(plan.lowerIndex,neutral.lowerIndex);assert.equal(plan.upperOffsetY,neutral.upperOffsetY);
      const waist=point(matrices(trace).spine,[232.5,228.5]);
      assert.ok(distance(waist,[232.5,228.5+plan.upperOffsetY])<.001,'waist stays with the selected lower pelvis');
      assert.ok(Math.abs(Math.atan2(plan.rangerStunUpperTransform[1],plan.rangerStunUpperTransform[0]))<=.035+1e-10);
      if(i===12)samePaint(trace,traceRangerPose(neutral));
      assert.equal(v177CaptureJointPose('ranger',plan),null,'a weighted lower is not a full-body corpse rig');
    }
  }
  assert.equal(JSON.stringify(atlas),original);
});

test('paused redraw, runtime state changes and repeated stun hits cannot accumulate a body lean or reset its timer',()=>{
  const f=actor();traceRangerPose(v177JointPose('ranger',sample(.43),runtime),{actor:f});
  traceRangerPose(stun(f,runtime,.6),{actor:f});
  const plan=stun(f,{...runtime,elapsedSeconds:900,transitionCount:100},.48),painted=traceRangerPose(plan,{actor:f});
  for(let i=0;i<1000;i++){
    const again=stun(f,{...runtime,elapsedSeconds:i,transitionCount:i},.48);
    assert.equal(again.stunElapsed,plan.stunElapsed);assert.deepEqual(traceRangerPose(again,{actor:f}).calls,painted.calls);
  }
  for(let i=0;i<100;i++){
    const hit=v177JointPose('ranger',{requestedState:'hit-light'},runtime,{actor:f});const held=traceRangerPose(hit,{actor:f});
    const next=stun(f,runtime,.6);assert.deepEqual(traceRangerPose(next,{actor:f}).calls,held.calls);
    const reacted=stun(f,runtime,.55);connected(traceRangerPose(reacted,{actor:f}));
    assert.ok(Math.abs(Math.atan2(reacted.rangerStunUpperTransform[1],reacted.rangerStunUpperTransform[0]))<=.035+1e-10);
  }
});

test('missing or foreign painted history, owned actions and failed images cannot borrow a Ranger status body',()=>{
  const f=actor();assert.equal(stun(f,runtime,.5),null);
  const normal=v177JointPose('ranger',{requestedState:'move'},runtime,{actor:f});traceRangerPose(normal,{actor:f});
  assert.equal(stun(actor(),runtime,.5),null);
  assert.equal(v177JointPose('ranger',v177LivingStunSample('ranger'),runtime,{actor:f,stunRemaining:.5,ownedPose:true}),null);
  assert.equal(stun(f,runtime,.5),null);
  traceRangerPose(normal,{actor:f});
  assert.equal(drawV177JointPose({}, {naturalWidth:0},'ranger',normal,0,0,480,448,{actor:f}),false);
  assert.equal(stun(f,runtime,.5),null);
});
