import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose,v177JointCycleDistance} from '../app/v177JointPresentation.js';
import {spriteFrameFor,SPRITE_STATES} from '../app/spriteManifest.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {CAMPAIGN_STAGE_IDS} from '../app/campaign.js';
const dir=new URL('../assets/source/v100/joints/runner-r1/',import.meta.url);
const d=JSON.parse(await readFile(new URL('parts.json',dir))),motion=JSON.parse(gunzipSync(await readFile(new URL('motion.json.gz',dir)))),atlas=V177_JOINT_ATLASES.runner;
const transform=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]],distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const pixels=async file=>sharp(await readFile(new URL(file,dir))).ensureAlpha().raw().toBuffer();
function record(plan){
 const raw=[],ctx={save(){},restore(){},translate(){},scale(){},transform(...m){raw.push(m);},drawImage(){}};
 assert.equal(drawV177JointPose(ctx,{naturalWidth:atlas.decodedWidth},'runner',plan,0,0,394,757),true);
 assert.equal(raw.length,15);return raw;
}
test('runner has a separate fixed-length run, actual flight and opposed bent-arm swing on the approved infected paint',async()=>{
 let boneError=0,groundError=0,drift=0,handError=0,flightFrames=0;
 const soles=[];
 for(const leg of d.rig.legs){
  const data=await pixels('../walker-r1/'+leg.paintedPaw+'.png');let bottom=-1;
  for(let y=0;y<448;y++)for(let x=0;x<480;x++)if(data[(y*480+x)*4+3]>=32)bottom=Math.max(bottom,y);
  const points=[];for(let x=0;x<480;x++)if(data[(bottom*480+x)*4+3]>=32)points.push([x+.5,bottom+.5]);soles.push(points);
 }
 for(const action of motion.actions)for(let i=0;i<action.frames.length;i++){
  const f=action.frames[i],first=action.frames[0];
  for(const [name,b]of Object.entries(f.bones))boneError=Math.max(boneError,Math.abs(distance(b.head,b.tail)-distance(first.bones[name].head,first.bones[name].tail)));
  for(let ai=0;ai<2;ai++)handError=Math.max(handError,distance(f.bones[`arm-${ai}-lower`].tail,f.bones[`arm-${ai}-hand`].head));
  if(action.name==='walk'&&soles.every((ps,li)=>ps.every(p=>transform(f.deform[`leg-${li}-foot`],p)[1]<431.99)))flightFrames++;
  for(let li=0;li<2;li++){
   const q=(i/60+d.rig.legs[li].offset)%1,pq=((i-1)/60+d.rig.legs[li].offset)%1,bone=`leg-${li}-foot`,stance=d.motion.walk.stanceFraction;
   if(action.name==='attack'||action.name==='settle-3'||q<=stance)for(const p of soles[li])groundError=Math.max(groundError,Math.abs(transform(f.deform[bone],p)[1]-432));
   if(i&&(action.name==='attack'||q<=stance&&pq<=stance&&q>pq))for(const p of soles[li])drift=Math.max(drift,distance(transform(f.deform[bone],p),transform(action.frames[i-1].deform[bone],p)));
  }
 }
 for(const [measure,value]of Object.entries({boneError,groundError,drift,handError}))assert.ok(value<.001,{measure,value});
 assert.ok(flightFrames>0,'Running has a short real flight phase, rather than sliding grounded feet faster');
 const walk=motion.actions.find(a=>a.name==='walk'),travel=walk.frames.at(-1).bones.root.head[0]-walk.frames[0].bones.root.head[0];
 assert.ok(Math.abs(atlas.cycleDistance-travel)<.001);assert.ok(Math.abs(v177JointCycleDistance('runner',.2)-travel/d.referenceFrame.scale*.2)<.001);
 const wristAt=(f,i)=>f.bones[`arm-${i}-hand`].head[0]-f.bones.root.head[0];
 const a=walk.frames[15],b=walk.frames[45];assert.ok((wristAt(a,0)-wristAt(b,0))*(wristAt(a,1)-wristAt(b,1))<0,'Arms oppose each other through the running cycle');
 assert.notEqual(atlas.cycleDistance,V177_JOINT_ATLASES.walker.cycleDistance);assert.notDeepEqual(atlas.poses[0],V177_JOINT_ATLASES.walker.poses[0]);
});
test('production running interpolation keeps wrists and elbows joined, planted feet still, and claw transitions in the same bent-arm stance',()=>{
 const matrixFor=(raw,bone)=>raw[atlas.parts.findIndex(p=>p.bone===bone)];
 let previous=null;
 for(let n=0;n<=600;n++)for(const settle of [0,.5,1]){
  const phase=n/600,plan=v177JointPose('runner',{requestedState:'move'},{locomotionPhase:phase,locomotionSettle:settle}),raw=record(plan);
  for(const arm of d.armConstraints){
   assert.ok(distance(transform(matrixFor(raw,arm.upperBone),arm.shoulder),transform(matrixFor(raw,arm.parentBone),arm.shoulder))<.001);
   assert.ok(distance(transform(matrixFor(raw,arm.upperBone),arm.elbow),transform(matrixFor(raw,arm.lowerBone),arm.elbow))<.001);
   assert.ok(distance(transform(matrixFor(raw,arm.lowerBone),arm.wrist),transform(matrixFor(raw,arm.effectorBone),arm.wrist))<.001);
  }
  if(settle===0){
   if(previous)for(let li=0;li<2;li++){
    const q=(phase+d.rig.legs[li].offset)%1,pq=(previous.phase+d.rig.legs[li].offset)%1;
    if(q>1/30&&q<d.motion.walk.stanceFraction-1/30&&q>pq&&pq>1/30){
     const leg=d.rig.legs[li],p=[leg.ankle[0],leg.ankle[1]+432-leg.groundAnkleY],bone=`leg-${li}-foot`;
     const now=transform(matrixFor(raw,bone),p),before=transform(matrixFor(previous.raw,bone),p);
     assert.ok(Math.abs(now[1]-432)<.001);assert.ok(Math.abs(now[0]+phase*atlas.cycleDistance-before[0]-previous.phase*atlas.cycleDistance)<.001,'World-space planted foot stays still as the actual body travels');
    }
   }
   previous={phase,raw};
  }
 }
 const runtime={locomotionPhase:.1371,locomotionSettle:1},idle=record(v177JointPose('runner',{requestedState:'idle'},runtime));
 for(const state of ['wind-up','active','recovery'])for(let n=0;n<=60;n++){
  const raw=record(v177JointPose('runner',{requestedState:state,clipProgress:n/60},runtime));
  for(let i=0;i<raw.length;i++)if(!atlas.parts[i].upper)assert.deepEqual(raw[i],idle[i],'Attack holds current feet');
  for(const arm of d.armConstraints)assert.ok(distance(transform(matrixFor(raw,arm.lowerBone),arm.wrist),transform(matrixFor(raw,arm.effectorBone),arm.wrist))<.001);
  if(state==='wind-up'&&n===0||state==='recovery'&&n===60)for(const arm of d.armConstraints)
   assert.ok(distance(transform(matrixFor(raw,arm.effectorBone),arm.wrist),transform(matrixFor(idle,arm.effectorBone),arm.wrist))<.001,'No drop to the old dangling-arm stance at attack start or recovery');
 }
});
test('the separately authored running motion reuses every exact painted part and one conditional infected texture',async()=>{
 const walker=V177_JOINT_ATLASES.walker,original=JSON.parse(await readFile(new URL('../walker-r1/parts.json',dir)));
 assert.notEqual(atlas,walker);assert.equal(atlas.key,walker.key);assert.equal(atlas.path,walker.path);assert.deepEqual(atlas.parts,walker.parts);
 for(const state of SPRITE_STATES)for(const direction of ['left','right'])assert.deepEqual(spriteFrameFor('runner',state,direction),spriteFrameFor('walker',state,direction));
 for(const part of d.parts){const same=original.parts.find(p=>p.name===part.name);assert.equal(part.sha256,same.sha256);assert.equal(createHash('sha256').update(await readFile(new URL(part.file,dir))).digest('hex'),same.sha256);}
 const plan=requiredBattleAssetPlan({stageId:CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE,formationKinds:['scout'],enemyKinds:['walker','runner','turned']});
 assert.equal(plan.persistent.filter(p=>p.key===atlas.key).length,1);assert.equal(plan.paths.filter(p=>p===atlas.path).length,1);
 for(const state of ['hit-light','death','ability'])assert.equal(v177JointPose('runner',{requestedState:state},{}),null);
 assert.equal(v177JointPose('runner',{requestedState:'active'},{},{ownedPose:true}),null);
});
