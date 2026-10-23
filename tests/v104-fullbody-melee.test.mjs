import test from 'node:test';
import assert from 'node:assert/strict';
import {V177_JOINT_ATLASES as A,v177JointPose,v177CaptureJointPose,drawV177JointPose,v177RenderedJointWeaponSocket} from '../app/v177JointPresentation.js';
import {drawV104WeaponWake} from '../app/v104CombatVfx.js';
import {UNIT_WEAPON_PROFILE,ENEMY_FIREARM_WEAPON_PROFILE,weaponProfileForUnit} from '../app/combatPresentation.js';
const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const melee=['brawler','shade','walker','runner','turned','sprinter','grappler','crusher','abomination','gairen','mugarian-president-mutated','futago','futago-separated-a','futago-separated-b',
 'scout','brute','guardian','gate-eater','red-panther-shield','red-panther-knife','tky','miyamoto-musashi','crazy-king','kumaverson','takuya','takuya-omega'];
const runtime={locomotionPhase:.2,locomotionSettle:1};
function sample(kind,state,progress,sequence=0,actualRuntime=runtime){
 return v177JointPose(kind,{requestedState:state,clipProgress:progress},actualRuntime,{grounded:true,actor:{attackSequence:sequence+(state==='wind-up'?0:1),attackWindup:state==='wind-up'?1:0}});
}
test('every humanoid melee keeps both actual arm chains attached through broad windup, impact and recovery',()=>{
 for(const kind of [...melee,'babayaga'])for(let sequence=0;sequence<3;sequence++)for(const state of ['wind-up','active','recovery'])for(let n=0;n<=30;n++){
  const plan=sample(kind,state,n/30,sequence),pose=v177CaptureJointPose(kind,plan),atlas=A[kind];
  assert.ok(plan.choreography,kind);
  for(const c of atlas.armConstraints){
   const s=point(pose.upper[c.parentBone],c.shoulder),e=point(pose.upper[c.upperBone],c.elbow),w=point(pose.upper[c.lowerBone],c.wrist),held=point(pose.upper[c.effectorBone],c.effectorWrist??c.wrist);
   assert.ok(distance(s,point(pose.upper[c.upperBone],c.shoulder))<.002,kind+' shoulder');
   assert.ok(distance(e,point(pose.upper[c.lowerBone],c.elbow))<.002,kind+' elbow');
   assert.ok(distance(w,held)<.002,kind+' wrist');
   assert.ok(Math.abs(distance(s,e)-distance(c.shoulder,c.elbow))<.002,kind+' upper bone');
   assert.ok(Math.abs(distance(e,w)-distance(c.elbow,c.wrist))<.002,kind+' forearm bone');
  }
  for(const c of atlas.legConstraints??[]){
   const parent=pose[c.parentUpper===false?'lower':'upper'][c.parentBone],hip=point(parent,c.hip),knee=point(pose.lower[c.upperBone],c.knee),ankle=point(pose.lower[c.lowerBone],c.ankle);
   assert.ok(distance(hip,point(pose.lower[c.upperBone],c.hip))<.002,kind+' hip');
   assert.ok(distance(knee,point(pose.lower[c.lowerBone],c.knee))<.002,kind+' knee');
   assert.ok(distance(ankle,point(pose.lower[c.effectorBone],c.ankle))<.002,kind+' ankle');
   assert.ok(Math.abs(distance(hip,knee)-distance(c.hip,c.knee))<.002,kind+' thigh bone');
   assert.ok(Math.abs(distance(knee,ankle)-distance(c.knee,c.ankle))<.002,kind+' shin bone');
  }
 }
});
test('windup and follow-through move the striking wrist and torso, while every stance foot retains its original owner',()=>{
 for(const kind of melee){
  const atlas=A[kind],c=atlas.armConstraints.find(c=>c.effectorBone===atlas.weaponBone);
  const wind=sample(kind,'wind-up',.72),impact=sample(kind,'active',0),follow=sample(kind,'active',.7);
  const poses=[wind,impact,follow].map(p=>v177CaptureJointPose(kind,p));
  const wrists=poses.map(p=>point(p.upper[c.effectorBone],c.effectorWrist??c.wrist));
  assert.ok(distance(wrists[0],wrists[1])>15,kind+' must swing the hand, not only rotate a remote weapon');
  assert.ok(distance(wrists[1],wrists[2])>2,kind+' must follow through');
  const angles=poses.map(p=>Math.atan2(p.upper.spine[1],p.upper.spine[0]));
  assert.ok(Math.abs(angles[0]-angles[2])>.25,kind+' whole-body weight transfer');
  for(const p of [wind,impact,follow]){
   const neutral={...p,choreography:undefined},actual=v177CaptureJointPose(kind,p),original=v177CaptureJointPose(kind,neutral);
   for(const leg of atlas.legConstraints??[])assert.deepEqual(point(actual.lower[leg.effectorBone],leg.ankle),point(original.lower[leg.effectorBone],leg.ankle),kind+' stance foot');
  }
 }
});

test('short-weapon lunges alternate a planted support foot, never cross legs, and return to the same stance',()=>{
 for(const kind of ['kumaverson','brute','guardian','gate-eater','red-panther-shield','scout','red-panther-knife',
  'brawler','shade','walker','runner','turned','sprinter','grappler','crusher','abomination','futago-separated-a','futago-separated-b','mugarian-president-mutated'])for(const phase of [0,.25,.5,.75]){
  const atlas=A[kind],legs=atlas.legConstraints,[wind,active]=atlas.attackBoundaries??[.28,.7];
  const at=p=>{
   const state=p<=wind?'wind-up':p<=active?'active':'recovery';
   const progress=state==='wind-up'?p/wind:state==='active'?(p-wind)/(active-wind):(p-active)/(1-active);
   const pose=v177CaptureJointPose(kind,sample(kind,state,progress,0,{...runtime,locomotionPhase:phase}));
   return legs.map(l=>point(pose.lower[l.effectorBone],l.ankle));
  };
  const start=at(0),end=at(1),order=[0,1].sort((a,b)=>start[a][0]-start[b][0]),[rear,lead]=order;
  for(let n=0;n<=100;n++){
   const p=n/100,feet=at(p);
   assert.ok(feet[lead][0]-feet[rear][0]>=start[lead][0]-start[rear][0]-.002,kind+' legs cannot cross');
  }
  for(const [p,support,shifted]of [[.08,rear,false],[.21,lead,true],[.72,lead,true],[.91,rear,false]]){
   const feet=at(p),plant=at(shifted?.5:0)[support];
   assert.ok(distance(feet[support],plant)<.002,kind+' planted support at '+p);
   const swing=support===0?1:0;
   assert.ok(feet[swing][1]<start[swing][1]-1,kind+' swing foot must lift at '+p);
  }
  for(let n=0;n<2;n++)assert.ok(distance(start[n],end[n])<.002,kind+' same stance after recovery');
 }
});
test('Babayaga carries a lowered suppressed handgun, raises both original grips to aim, and returns to that same carry',()=>{
 const atlas=A.babayaga,c=atlas.armConstraints[0],idle=v177JointPose('babayaga',{requestedState:'idle',clipProgress:0},runtime);
 const before=sample('babayaga','wind-up',0),aim=sample('babayaga','active',0),after=sample('babayaga','recovery',1);
 assert.deepEqual(before.choreography.upper,idle.choreography.upper);assert.deepEqual(after.choreography.upper,idle.choreography.upper);
 const carry=v177CaptureJointPose('babayaga',before),ready=v177CaptureJointPose('babayaga',aim),weapon=atlas.weaponBone;
 assert.ok(point(carry.upper[weapon],atlas.muzzle)[1]>point(carry.upper[weapon],c.effectorWrist)[1]+50);
 assert.ok(Math.abs(point(ready.upper[weapon],atlas.muzzle)[1]-point(ready.upper[weapon],c.effectorWrist)[1])<20);
 for(const arm of atlas.armConstraints)assert.ok(point(ready.upper[weapon],arm.effectorWrist)[1]<point(carry.upper[weapon],arm.effectorWrist)[1]-30);
 assert.deepEqual(before.choreography.frontBones,idle.choreography.frontBones);assert.deepEqual(after.choreography.frontBones,idle.choreography.frontBones);
});
test('carried weapons keep the same paint ownership at both attack endpoints',()=>{
 for(const kind of ['crazy-king','babayaga','kumaverson','takuya-omega']){
  const idle=v177JointPose(kind,{requestedState:'idle',clipProgress:0},runtime);
  for(const plan of [sample(kind,'wind-up',0),sample(kind,'recovery',1)])assert.deepEqual(plan.choreography.frontBones,idle.choreography.frontBones,kind);
 }
});
test('painted handguns use pistol presentation while Babayaga retains the same one-round travel timing',()=>{
 assert.equal(UNIT_WEAPON_PROFILE.babayaga,'suppressed-pistol');
 assert.equal(ENEMY_FIREARM_WEAPON_PROFILE['red-panther-commander'],'handgun');
 const pistol=weaponProfileForUnit('babayaga');assert.equal(pistol.id,'suppressed-pistol');assert.deepEqual(pistol.damageWeights,[1]);assert.deepEqual(pistol.shotOffsetsSeconds,[0]);assert.equal(pistol.projectileTravelSeconds,.12);
});
function fakeContext(onDraw=()=>{}){
 return {save(){},restore(){},translate(){},scale(){},rotate(){},transform(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},drawImage:onDraw};
}
test('both attacking arms paint once in front of the torso instead of disappearing behind it',()=>{
 for(const kind of melee){
  const atlas=A[kind],plan=sample(kind,'active',0),draws=[],ctx=fakeContext((_,sx,sy)=>draws.push(atlas.parts.find(p=>p.source.x===sx&&p.source.y===sy)?.bone));
  assert.equal(drawV177JointPose(ctx,{naturalWidth:512},kind,plan,0,0,100,100),true);
  assert.equal(draws.length,atlas.parts.length);assert.equal(new Set(atlas.parts.map(p=>p.name)).size,draws.length);
  const spine=draws.lastIndexOf('spine');
  for(const c of atlas.armConstraints)assert.ok(draws.indexOf(c.lowerBone)>spine,kind+' visible forearm');
 }
});
test('a stun re-entry retains the actual painted arm order even after its return motion has finished',()=>{
 for(const kind of ['walker','tky','miyamoto-musashi','brawler']){
  const actor={id:701,hp:100,attackSequence:1},world={battleGeneration:1},ctx=fakeContext(),image={naturalWidth:512};
  const paint=plan=>drawV177JointPose(ctx,image,kind,plan,0,0,100,100,{actor,world});
  const active=v177JointPose(kind,{requestedState:'active',clipProgress:.1},runtime,{actor,world,grounded:true});paint(active);
  let plan=v177JointPose(kind,{requestedState:'incapacitated'},{...runtime,transitionCount:1,elapsedSeconds:0},{actor,world,grounded:true,stunRemaining:1});paint(plan);
  plan=v177JointPose(kind,{requestedState:'incapacitated'},{...runtime,transitionCount:1,elapsedSeconds:.073},{actor,world,grounded:true,stunRemaining:.927});paint(plan);
  const reentry=v177JointPose(kind,{requestedState:'incapacitated'},{...runtime,transitionCount:2,elapsedSeconds:0},{actor,world,grounded:true,stunRemaining:1});
  assert.deepEqual(reentry.frontBones,plan.frontBones,kind+' actual paint order');
  assert.deepEqual(v177CaptureJointPose(kind,reentry).upper,v177CaptureJointPose(kind,plan).upper,kind+' exact entry pose');
 }
});
test('fractionally minified pixel sources filter their alpha edges; enlarged pixels keep nearest sampling',()=>{
 for(const kind of ['shade','crusher','abomination']){
  const plan=sample(kind,'active',0),ctx=fakeContext();
  drawV177JointPose(ctx,{naturalWidth:512},kind,plan,0,0,80,80);assert.equal(ctx.imageSmoothingEnabled,true);
  drawV177JointPose(ctx,{naturalWidth:512},kind,plan,0,0,960,896);assert.equal(ctx.imageSmoothingEnabled,false);
 }
});
test('independent blade channels retain their actual sockets and both swept effects survive actor copies',()=>{
 const kind='miyamoto-musashi',atlas=A[kind],plan=sample(kind,'active',.2),arm=atlas.armConstraints[1];
 const options={kind,plan,direction:'right',frame:{anchorX:.5,anchorY:1,flipX:false},size:{w:100,h:100},pose:{offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotationRadians:0},x:400,y:300,depthScale:1,sourcePoint:arm.effectorWrist};
 const primary=v177RenderedJointWeaponSocket(options),secondary=v177RenderedJointWeaponSocket({...options,sourceBone:'weapon-1'});
 assert.notDeepEqual(primary,secondary);
 const image={complete:true,naturalWidth:512,naturalHeight:512},objects={'v104-steel':image},world={},calls=[];
 const ctx=fakeContext((...args)=>calls.push(args));
 for(let n=0;n<3;n++)for(const channel of ['weapon-0','weapon-1']){
  const input={actor:{id:7,hp:100},world,kind,time:n/60,phase:.3+n*.03,sequence:1,channel,tip:{x:100+n*5,y:80+n*4},grip:{x:80+n*2,y:100}};
  assert.equal(drawV104WeaponWake(ctx,objects,input),n>0);
  assert.equal(drawV104WeaponWake(ctx,objects,input),false,'one paint per channel and source time');
 }
 assert.equal(calls.length,8);
 assert.equal(drawV104WeaponWake(ctx,objects,{actor:{id:7,hp:100},world:{},kind,time:1,phase:.4,channel:'weapon-1',tip:{x:120,y:100},grip:{x:80,y:100}}),false);
});
