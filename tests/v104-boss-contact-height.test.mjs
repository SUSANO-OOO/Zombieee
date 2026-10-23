import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import sharp from 'sharp';
import {V177_JOINT_ATLASES as A,v177JointPose,v177RenderedJointWeaponSocket,v177JointPaintSupportY,v177CaptureJointPose,drawV177JointPose} from '../app/v177JointPresentation.js';
import {V177_CORPSE_JOINT_DATA} from '../app/v177CorpseJointData.js';
import {spriteFrameFor} from '../app/spriteManifest.js';import {v100HumanWalkFrame} from '../app/v100HumanWalk.js';
import {v177LiveJointGroundLift} from '../app/v177CorpseJointPresentation.js';import {v104MeleeImpactPoint} from '../app/v104CombatVfx.js';

const tree=ts.createSourceFile('game.tsx',fs.readFileSync('app/AshfallGame.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),expressions=[];
const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(tree)==='tipPoint')expressions.push(n.initializer.getText(tree));ts.forEachChild(n,visit);};visit(tree);assert.equal(expressions.length,1);
const actualSecondaryPoint=(kind,plan,arm)=>vm.runInNewContext(expressions[0],{jointPose:plan,renderKind:kind,arm});

test('giant boss normal impacts meet the original defender body height on both alternating strikes and facings',()=>{
 // Measured original controlled-room display sizes, unchanged world spacing,
 // and the original guardian's 80px standing body above the same 282 floor.
 for(const kind of['mugarian-president-mutated','takuya-omega'])for(const sequence of[1,2])for(const direction of['left','right'])for(const gait of[0,.25,.5,.75]){
  const a=A[kind],plan=v177JointPose(kind,{requestedState:'active',clipProgress:0},{locomotionPhase:gait,locomotionSettle:1},
   {grounded:true,actor:{attackSequence:sequence,attackWindup:0}});
  const frame=v100HumanWalkFrame(spriteFrameFor(kind,'walk-a','right'),direction),h=kind==='takuya-omega'?227.55555555555557:218.11659192825113,size={w:h*a.width/a.height,h};
  const bob=v177LiveJointGroundLift(kind,plan,{frame,width:size.w,height:size.h,x:620,y:282,angle:0,scaleX:1,scaleY:1,flipX:frame.flipX},287);
  const base={kind,plan,frame,size,direction,pose:{offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotationRadians:0},x:620,y:282,bob};
  const target={x:620+(direction==='left'?-1:1)*(kind==='takuya-omega'?82:88),y:282};
  const arm=a.armConstraints.find(c=>plan.choreography.strikeBones.includes(c.effectorBone));assert.ok(arm);
  const sourcePoint=arm.effectorBone===a.weaponBone?a.muzzle:actualSecondaryPoint(kind,plan,arm);
  const tip=v177RenderedJointWeaponSocket({...base,sourceBone:arm.effectorBone,sourcePoint}),grip=v177RenderedJointWeaponSocket({...base,sourceBone:arm.effectorBone,sourcePoint:arm.effectorWrist??arm.wrist});
  const contact=v104MeleeImpactPoint({kind,tip,grip,target});
  assert.ok(contact.y>=202&&contact.y<=282,JSON.stringify({kind,sequence,direction,gait,contact,target}));
  assert.ok(Math.abs(contact.x-target.x)<=18,JSON.stringify({kind,sequence,direction,gait,contact,target}));
 }
});

test('the abdominal-claw effect endpoint is an opaque original fingertip, never a fabricated point below the hand',async()=>{
 const kind='mugarian-president-mutated',a=A[kind],arm=a.armConstraints[1];
 const plan=v177JointPose(kind,{requestedState:'active',clipProgress:0},{locomotionPhase:.2,locomotionSettle:1},{grounded:true,actor:{attackSequence:2,attackWindup:0}});
 const p=actualSecondaryPoint(kind,plan,arm),part=a.parts.find(p=>p.bone===arm.effectorBone),s=part.source,d=part.destination;
 const x=s.x+Math.floor((p[0]-d.x)*s.w/d.w),y=s.y+Math.floor((p[1]-d.y)*s.h/d.h);
 assert.ok(x>=s.x&&x<s.x+s.w&&y>=s.y&&y<s.y+s.h);
 const {data,info}=await sharp('public'+a.path).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.ok(data[(y*info.width+x)*4+3]>=128,'The game must use the visible original finger pixels');
});

test('the complete cane never raises the planted shoes through the actual live ground correction',()=>{
 const kind='mugarian-president-mutated',a=A[kind],outlines=V177_CORPSE_JOINT_DATA[kind].outlines
  .map(o=>({...o,bone:a.parts.find(p=>p.name===o.name).bone,upper:a.parts.find(p=>p.name===o.name).upper}));
 const soles=outlines.filter(o=>a.legConstraints.some(l=>l.paintedPaw===o.name)),cane=outlines.filter(o=>o.name==='cane-and-hand');
 const frame=v100HumanWalkFrame(spriteFrameFor(kind,'walk-a','right'),'left'),h=218.11659192825113;
 const rendered={frame,width:h*a.width/a.height,height:h,x:620,y:282,angle:0,scaleX:1,scaleY:1,flipX:frame.flipX};
 const [wind,active]=a.attackBoundaries??[.28,.7];
 for(const gait of[0,.25,.5,.75])for(const settle of[0,.5,1])for(const sequence of[1,2])for(let n=0;n<=200;n++){
  const p=n/200,state=p<=wind?'wind-up':p<=active?'active':'recovery';
  const progress=state==='wind-up'?p/wind:state==='active'?(p-wind)/(active-wind):(p-active)/(1-active);
  const plan=v177JointPose(kind,{requestedState:state,clipProgress:progress},{locomotionPhase:gait,locomotionSettle:settle},
   {grounded:true,actor:{attackSequence:sequence-(state==='wind-up'?1:0),attackWindup:state==='wind-up'?1:0}});
  const feet=v177JointPaintSupportY(kind,plan,soles,rendered),stick=v177JointPaintSupportY(kind,plan,cane,rendered);
  assert.ok(stick<=feet+.00001,JSON.stringify({gait,settle,sequence,p,feet,stick}));
  const lift=v177LiveJointGroundLift(kind,plan,rendered,287),soleLift=Math.max(0,feet-287);
  assert.ok(lift<=soleLift+.00001,JSON.stringify({gait,settle,sequence,p,lift,soleLift}));
 }
});

test('actual attack paint, stun entry, first return and re-entry keep the cane wrist continuous above the actual returning soles',()=>{
 const kind='mugarian-president-mutated',a=A[kind],arm=a.armConstraints[2];
 const outlines=V177_CORPSE_JOINT_DATA[kind].outlines.map(o=>({...o,bone:a.parts.find(p=>p.name===o.name).bone,upper:a.parts.find(p=>p.name===o.name).upper}));
 const soles=outlines.filter(o=>a.legConstraints.some(l=>l.paintedPaw===o.name)),cane=outlines.filter(o=>o.name==='cane-and-hand');
 const frame=v100HumanWalkFrame(spriteFrameFor(kind,'walk-a','right'),'left'),h=218.11659192825113;
 const rendered={frame,width:h*a.width/a.height,height:h,x:620,y:282,angle:0,scaleX:1,scaleY:1,flipX:frame.flipX};
 const ctx={save(){},restore(){},translate(){},scale(){},rotate(){},transform(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},drawImage(){}};
 const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
 const [wind,active]=a.attackBoundaries??[.28,.7];
 for(const gait of[0,.25,.5,.75])for(const settle of[0,1])for(const p of[.08,.21,.28,.48,.64,.77,.82,.95])for(const reentryAt of[.073,.99]){
  const actor={id:701,hp:100,attackSequence:1},world={battleGeneration:1},runtime={locomotionPhase:gait,locomotionSettle:settle};
  const paint=plan=>assert.ok(drawV177JointPose(ctx,{naturalWidth:512},kind,plan,0,0,100,100,{actor,world}));
  const wrist=plan=>point(v177CaptureJointPose(kind,plan).upper[arm.effectorBone],arm.wrist);
  const check=(plan,elapsed)=>{
   const feet=v177JointPaintSupportY(kind,plan,soles,rendered),stick=v177JointPaintSupportY(kind,plan,cane,rendered);
   assert.ok(stick<=feet+.00001,JSON.stringify({gait,settle,p,elapsed,feet,stick}));
   assert.ok(v177LiveJointGroundLift(kind,plan,rendered,287)<=Math.max(0,feet-287)+.00001);
   const captured=v177CaptureJointPose(kind,plan);
   for(const c of a.armConstraints){
    const shoulder=point(captured.upper[c.parentBone],c.shoulder),elbow=point(captured.upper[c.upperBone],c.elbow),hand=point(captured.upper[c.effectorBone],c.effectorWrist??c.wrist);
    assert.ok(Math.hypot(...point(captured.upper[c.upperBone],c.shoulder).map((x,i)=>x-shoulder[i]))<.002);
    assert.ok(Math.hypot(...point(captured.upper[c.lowerBone],c.elbow).map((x,i)=>x-elbow[i]))<.002);
    assert.ok(Math.hypot(...point(captured.upper[c.lowerBone],c.wrist).map((x,i)=>x-hand[i]))<.002);
    assert.ok(Math.abs(Math.hypot(elbow[0]-shoulder[0],elbow[1]-shoulder[1])-Math.hypot(c.elbow[0]-c.shoulder[0],c.elbow[1]-c.shoulder[1]))<.002);
    assert.ok(Math.abs(Math.hypot(elbow[0]-hand[0],elbow[1]-hand[1])-Math.hypot(c.elbow[0]-c.wrist[0],c.elbow[1]-c.wrist[1]))<.002);
   }
  };
  const state=p<=wind?'wind-up':p<=active?'active':'recovery',progress=state==='wind-up'?p/wind:state==='active'?(p-wind)/(active-wind):(p-active)/(1-active);
  actor.attackWindup=state==='wind-up'?1:0;if(actor.attackWindup)actor.attackSequence=0;
  const attack=v177JointPose(kind,{requestedState:state,clipProgress:progress},runtime,{actor,world,grounded:true});paint(attack);let before=wrist(attack);
  for(const elapsed of[0,1e-8,.001,.03,.073,.12,.2,.4,.7,.9,.99].filter(t=>t<=reentryAt)){
   const plan=v177JointPose(kind,{requestedState:'incapacitated'},{...runtime,transitionCount:1,elapsedSeconds:elapsed},{actor,world,grounded:true,stunRemaining:1-elapsed});
   if(elapsed<=1e-8)assert.ok(Math.hypot(...wrist(plan).map((x,i)=>x-before[i]))<.002,JSON.stringify({gait,settle,p,elapsed,before,after:wrist(plan)}));
   check(plan,elapsed);paint(plan);before=wrist(plan);
  }
  for(const elapsed of[0,1e-8,.03,.073,.4,.99]){
   const plan=v177JointPose(kind,{requestedState:'incapacitated'},{...runtime,transitionCount:2,elapsedSeconds:elapsed},{actor,world,grounded:true,stunRemaining:1-elapsed});
   if(elapsed<=1e-8)assert.ok(Math.hypot(...wrist(plan).map((x,i)=>x-before[i]))<.002);
   check(plan,elapsed);paint(plan);before=wrist(plan);
  }
 }
});
