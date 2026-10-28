import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import test from 'node:test';
import {animationClipFor,sampleMrsChihaLauncherBash,sampleMrsChihaLauncherBashWindup} from '../app/combatPresentation.js';
import {v102CombatMotionSample} from '../app/v102CombatMotion.js';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose,v177RenderedJointWeaponSocket} from '../app/v177JointPresentation.js';
import {spriteFrameFor} from '../app/spriteManifest.js';
const kind='mrs-chiha',atlas=V177_JOINT_ATLASES[kind],runtime={locomotionPhase:.1371,locomotionSettle:1},duration=animationClipFor(kind,'wind-up').durationSeconds;
const transform=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]],distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function rendered(sample){
 const actual=v102CombatMotionSample(kind,sample,{side:'human',attack:.2}),plan=v177JointPose(kind,actual,runtime);
 assert.ok(plan,'The actual launcher-bash sample must never lose the connected body');
 const raw=[];assert.equal(drawV177JointPose({save(){},restore(){},translate(){},scale(){},transform(...m){raw.push(m);},drawImage(){}},{naturalWidth:atlas.decodedWidth},kind,plan,0,0,480,448),true);
 return {sample:actual,plan,raw};
}
const matrix=(raw,bone)=>raw[atlas.parts.findIndex(p=>p.bone===bone)];
test('the real close-range sample carries complete phase information through the production motion and joint path',()=>{
 const states=new Set(),variant=atlas.attackVariants['launcher-bash'];
 assert.equal(variant.startIndex,151);assert.deepEqual(variant.attackBoundaries,[.28,.7]);assert.equal(atlas.poses.length,182);
 for(let n=0;n<=1080;n++){const {sample,plan,raw}=rendered(sampleMrsChihaLauncherBash(.27*n/1080));states.add(sample.requestedState);
  assert.equal(sample.resolvedState,sample.requestedState);assert.equal(sample.attackVariant,'launcher-bash');assert.ok(Number.isFinite(sample.clipProgress)&&sample.clipProgress>=0&&sample.clipProgress<=1);
  assert.ok(plan.upperIndex>=151&&plan.upperIndex<182&&plan.upperNextIndex<182);assert.equal(raw.length,16);assert.ok(raw.every(m=>m.every(Number.isFinite)));
 }
 assert.deepEqual([...states],['wind-up','active','recovery']);
 assert.equal(v177JointPose(kind,{...sampleMrsChihaLauncherBash(.13),attackVariant:'unknown'},runtime),null,'An unbound action must not silently use a firing pose');
 for(const state of ['hit','death','transform'])assert.equal(v177JointPose(kind,{requestedState:state},runtime),null);
 assert.equal(v177JointPose(kind,sampleMrsChihaLauncherBash(.13),runtime,{ownedPose:true}),null);
});
test('normal windup, close-range contact and recovery keep both grips, fixed anatomy and the same planted soles',async()=>{
 const d=JSON.parse(await readFile('assets/source/v100/joints/mrs-chiha-r1/parts.json')),ready=rendered(sampleMrsChihaLauncherBashWindup(0));let maxError=0,groundError=0,margin=Infinity;
 const samples=[...Array.from({length:241},(_,n)=>sampleMrsChihaLauncherBashWindup(duration*n/240)),...Array.from({length:1081},(_,n)=>sampleMrsChihaLauncherBash(.27*n/1080))];
 for(const sample of samples){const {raw}=rendered(sample);
  for(let i=0;i<raw.length;i++)if(!atlas.parts[i].upper)assert.deepEqual(raw[i],ready.raw[i],'Attack never advances the standing walking phase');
  for(const arm of d.armConstraints){const shoulder=transform(matrix(raw,arm.parentBone),arm.shoulder),elbow=transform(matrix(raw,arm.upperBone),arm.elbow),wrist=transform(matrix(raw,arm.lowerBone),arm.wrist),grip=transform(matrix(raw,arm.effectorBone),arm.effectorWrist);
   maxError=Math.max(maxError,distance(wrist,grip),distance(transform(matrix(raw,arm.upperBone),arm.shoulder),shoulder),distance(transform(matrix(raw,arm.lowerBone),arm.elbow),elbow));
   margin=Math.min(margin,distance(arm.shoulder,arm.elbow)+distance(arm.elbow,arm.wrist)-distance(shoulder,grip));
  }
  for(let li=0;li<2;li++){const leg=d.rig.legs[li],p=[leg.ankle[0],leg.ankle[1]+432-leg.groundAnkleY];groundError=Math.max(groundError,Math.abs(transform(matrix(raw,'leg-'+li+'-foot'),p)[1]-432));}
 }
 assert.ok(maxError<.001,JSON.stringify({maxError}));assert.ok(groundError<.001,JSON.stringify({groundError}));assert.ok(margin>.001);
 const before=rendered(sampleMrsChihaLauncherBashWindup(duration)),after=rendered(sampleMrsChihaLauncherBash(0)),returned=rendered(sampleMrsChihaLauncherBash(.27));
 for(let i=0;i<before.raw.length;i++)for(let k=0;k<6;k++)assert.ok(Math.abs(before.raw[i][k]-after.raw[i][k])<.001,'No weapon/body snap at windup handover');
 for(const arm of d.armConstraints)assert.ok(distance(transform(matrix(returned.raw,arm.effectorBone),arm.effectorWrist),transform(matrix(ready.raw,arm.effectorBone),arm.effectorWrist))<.001,'Return to the same ready grip');
});
test('the new Blender action retains every original walking and firing sample and every other newcomer atlas',async()=>{
 const source=execFileSync('git',['show','c858205c427aad2f583f79abfa0a8903e0171de3:app/v177NewcomerJointData.js'],{encoding:'utf8',maxBuffer:4*1024*1024}),begin=source.indexOf('Object.entries(')+'Object.entries('.length,baseline=JSON.parse(source.slice(begin,source.lastIndexOf('));')));
 assert.deepEqual(atlas.poses.slice(0,151),baseline[kind].poses);assert.deepEqual(atlas.parts,baseline[kind].parts);
 const headRevisions=JSON.parse(await readFile('assets/source/quality-20261028/identity/head-runtime-provenance.json')).entries;
 for(const other of ['zakimiya','tky','miyamoto-musashi'])assert.deepEqual(V177_JOINT_ATLASES[other],{...baseline[other],path:headRevisions.find(a=>a.kind===other)?.assetPath??baseline[other].path});
 const old=JSON.parse(gunzipSync(execFileSync('git',['show','c858205c427aad2f583f79abfa0a8903e0171de3:assets/source/v100/joints/mrs-chiha-r1/motion.json.gz'],{maxBuffer:4*1024*1024}))),motion=JSON.parse(gunzipSync(await readFile('assets/source/v100/joints/mrs-chiha-r1/motion.json.gz')));
 assert.equal(motion.actions.length,6);assert.deepEqual(motion.actions.filter(a=>a.name!=='launcher-bash'),old.actions);assert.equal(motion.actions.find(a=>a.name==='launcher-bash').frames.length,61);
 const texture=execFileSync('git',['show','c858205c427aad2f583f79abfa0a8903e0171de3:public/art/v100/joints/mrs-chiha-r1.webp'],{maxBuffer:2*1024*1024});assert.deepEqual(await readFile('public/art/v100/joints/mrs-chiha-r1.webp'),texture);
});

test('the close-range contact follows the same original weapon in both production facings and scales',()=>{
 for(const direction of ['left','right'])for(const scale of [.12,.2])for(const t of [0,.1,.13,.18,.27]){
  let world=[1,0,0,1,330,285];const stack=[],drawn=[];
  const multiply=b=>{const a=world;world=[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];};
  const ctx={save(){stack.push([...world]);},restore(){world=stack.pop();},translate(x,y){multiply([1,0,0,1,x,y]);},scale(x,y){multiply([x,0,0,y,0,0]);},transform(...m){multiply(m);},drawImage(){drawn.push([...world]);}};
  if(direction==='left')ctx.scale(-1,1);
  const frame={...spriteFrameFor(kind,'walk-a',direction),flipX:direction==='left'},size={w:atlas.referenceFrame.width*scale,h:atlas.referenceFrame.height*scale},plan=rendered(sampleMrsChihaLauncherBash(t)).plan;
  assert.equal(drawV177JointPose(ctx,{naturalWidth:atlas.decodedWidth},kind,plan,-size.w*frame.anchorX,-size.h*frame.anchorY,size.w,size.h),true);
  const tip=transform(drawn[atlas.parts.findIndex(p=>p.bone===atlas.weaponBone)],atlas.muzzle),socket=v177RenderedJointWeaponSocket({kind,plan,direction,frame,size,pose:{offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotationRadians:0},x:330,y:285});
  assert.ok(distance(tip,[socket.x,socket.y])<1e-10,'Visible contact cannot jump to the old firing weapon');
 }
});
