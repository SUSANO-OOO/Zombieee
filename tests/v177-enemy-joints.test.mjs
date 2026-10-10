import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose,v177JointCycleDistance,v177RenderedJointWeaponSocket} from '../app/v177JointPresentation.js';
import {spriteFrameFor,SPRITE_STATES} from '../app/spriteManifest.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {CAMPAIGN_STAGE_IDS} from '../app/campaign.js';
import {V177_JOINT_ASSET_ADDITIONS} from '../scripts/v177-joint-asset-contract.mjs';
const dir=new URL('../assets/source/v100/joints/walker-r1/',import.meta.url);
const d=JSON.parse(await readFile(new URL('parts.json',dir))),motion=JSON.parse(gunzipSync(await readFile(new URL('motion.json.gz',dir)))),atlas=V177_JOINT_ATLASES.walker;
const transform=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]],distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const pixels=async file=>sharp(await readFile(new URL(file,dir))).ensureAlpha().raw().toBuffer();
function record(plan,{kind='walker',size={w:394,h:757},direction='right',x=0,y=0}={}){
 let m=[1,0,0,1,x,y];const stack=[],calls=[],raw=[];
 const multiply=b=>{const a=m;m=[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];};
 const ctx={save(){stack.push([...m]);},restore(){m=stack.pop();},translate(x,y){multiply([1,0,0,1,x,y]);},scale(x,y){multiply([x,0,0,y,0,0]);},transform(...a){raw.push(a);multiply(a);},drawImage(){calls.push([...m]);}};
 if(direction==='left')ctx.scale(-1,1);
 const frame=spriteFrameFor(kind,'walk-a',direction);
 assert.equal(drawV177JointPose(ctx,{naturalWidth:atlas.decodedWidth},kind,plan,-size.w*frame.anchorX,-size.h*frame.anchorY,size.w,size.h),true);
 assert.equal(calls.length,15);return {calls,raw};
}
test('infected legs keep fixed lengths and real painted support; both original hands follow their arm chains',async()=>{
 const soles=[];
 for(const leg of d.rig.legs){
  const data=await pixels(leg.paintedPaw+'.png');let bottom=-1;
  for(let y=0;y<448;y++)for(let x=0;x<480;x++)if(data[(y*480+x)*4+3]>=32)bottom=Math.max(bottom,y);
  const points=[];for(let x=0;x<480;x++)if(data[(bottom*480+x)*4+3]>=32)points.push([x+.5,bottom+.5]);assert.ok(points.length>=2);soles.push(points);
 }
 let boneError=0,groundError=0,drift=0,handError=0;
 for(const action of motion.actions)for(let i=0;i<action.frames.length;i++){
  const f=action.frames[i],first=action.frames[0];
  for(const [name,b]of Object.entries(f.bones))boneError=Math.max(boneError,Math.abs(distance(b.head,b.tail)-distance(first.bones[name].head,first.bones[name].tail)));
  for(let ai=0;ai<2;ai++)handError=Math.max(handError,distance(f.bones[`arm-${ai}-lower`].tail,f.bones[`arm-${ai}-hand`].head));
  for(let li=0;li<2;li++){
   const q=(i/60+d.rig.legs[li].offset)%1,pq=((i-1)/60+d.rig.legs[li].offset)%1,bone=`leg-${li}-foot`,stance=d.motion.walk.stanceFraction;
   if(action.name==='attack'||action.name==='settle-3'||q<=stance)for(const p of soles[li])groundError=Math.max(groundError,Math.abs(transform(f.deform[bone],p)[1]-432));
   if(i&&(action.name==='attack'||q<=stance&&pq<=stance&&q>pq))for(const p of soles[li])drift=Math.max(drift,distance(transform(f.deform[bone],p),transform(action.frames[i-1].deform[bone],p)));
  }
 }
 assert.ok(boneError<.001,{boneError});assert.ok(groundError<.001,{groundError});assert.ok(drift<.001,{drift});assert.ok(handError<.001,{handError});
 const walk=motion.actions.find(a=>a.name==='walk');assert.ok(Math.abs(walk.frames.at(-1).bones.root.head[0]-walk.frames[0].bones.root.head[0]-atlas.cycleDistance)<.001);
 assert.ok(Math.abs(v177JointCycleDistance('walker',.2)-atlas.cycleDistance/.906318082788671*.2)<1e-10,'Normalized paint must use the original source-to-world scale for travel');
});
test('legacy source padding, scale and ground anchor survive production drawing in both directions, including the real claw socket',()=>{
 const runtime={locomotionPhase:.1371,locomotionSettle:1},base=record(v177JointPose('walker',{requestedState:'idle'},runtime));
 for(const state of ['wind-up','active','recovery'])for(let n=0;n<=60;n++){
  const plan=v177JointPose('walker',{requestedState:state,clipProgress:n/60},runtime),{raw}=record(plan);
  for(let i=0;i<raw.length;i++)if(!atlas.parts[i].upper)assert.deepEqual(raw[i],base.raw[i],'Claw attacks must hold the current leg phase');
  const matrixFor=bone=>raw[atlas.parts.findIndex(p=>p.bone===bone)];
  for(const arm of d.armConstraints){
   const upper=matrixFor(arm.upperBone),lower=matrixFor(arm.lowerBone),hand=matrixFor(arm.effectorBone),spine=matrixFor(arm.parentBone);
   assert.ok(distance(transform(upper,arm.shoulder),transform(spine,arm.shoulder))<.001);
   assert.ok(distance(transform(upper,arm.elbow),transform(lower,arm.elbow))<.001);
   assert.ok(distance(transform(lower,arm.wrist),transform(hand,arm.wrist))<.001,'No disconnected hand between Blender keys');
  }
 }
 for(let n=0;n<=600;n++)for(const settle of [0,.5,1]){
  const plan=v177JointPose('walker',{requestedState:'move'},{locomotionPhase:n/600,locomotionSettle:settle}),{raw}=record(plan);
  const matrixFor=bone=>raw[atlas.parts.findIndex(p=>p.bone===bone)];
  for(const arm of d.armConstraints){
   assert.ok(distance(transform(matrixFor(arm.upperBone),arm.elbow),transform(matrixFor(arm.lowerBone),arm.elbow))<.001,'Walking elbow continuity');
   assert.ok(distance(transform(matrixFor(arm.lowerBone),arm.wrist),transform(matrixFor(arm.effectorBone),arm.wrist))<.001,JSON.stringify({reason:'Walking wrist continuity',phase:n/600,settle,arm:arm.lowerBone}));
  }
 }
 for(const kind of ['walker','turned'])for(const direction of ['left','right'])for(const scale of [.12,.2]){
  const originalFrame=spriteFrameFor(kind,'walk-a',direction),frame={...originalFrame,flipX:direction==='left'},size={w:394*scale,h:757*scale};
  const plan=v177JointPose(kind,{requestedState:'active',clipProgress:0},runtime),drawn=record(plan,{kind,direction,size,x:300,y:500});
  const contact=transform(drawn.calls[atlas.parts.findIndex(p=>p.name==='near-hand')],atlas.muzzle);
  const socket=v177RenderedJointWeaponSocket({kind,plan,direction,frame,size,pose:{offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotationRadians:0},x:300,y:500});
  assert.ok(distance(contact,[socket.x,socket.y])<1e-10,'Effect and painted claw share the complete normalization and mirror transform');
  for(const leg of d.rig.legs){
   const sole=[leg.ankle[0],leg.ankle[1]+432-leg.groundAnkleY],m=drawn.calls[atlas.parts.findIndex(p=>p.name===leg.paintedPaw)];
   assert.ok(Math.abs(transform(m,sole)[1]-500)<.001,'Normalized paint must meet the original ground anchor');
  }
  const headPoint=[317,54],actual=transform(drawn.calls[atlas.parts.findIndex(p=>p.name==='head')],headPoint),headMatrix=drawn.raw[atlas.parts.findIndex(p=>p.name==='head')],p=transform(headMatrix,headPoint);
  const rx=(p[0]-d.referenceFrame.tx)/d.referenceFrame.scale,ry=(p[1]-d.referenceFrame.ty)/d.referenceFrame.scale;
  assert.ok(Math.abs(actual[0]-(300+(direction==='left'?-1:1)*(rx-197)*scale))<1e-10);
  assert.ok(Math.abs(actual[1]-(500+(ry-originalFrame.anchorY*757)*scale))<1e-10,'The legacy head retains its original source-pixel scale and padding');
 }
});
test('shared infected identity and source paint use one exact conditional texture; hit, death and ability owners stay intact',async()=>{
 const reference=await pixels('identity-reference.png');let originalPixels=0;
 for(const p of d.parts){const bytes=await readFile(new URL(p.file,dir));assert.equal(createHash('sha256').update(bytes).digest('hex'),p.sha256);if(!p.original)continue;
  const data=await pixels(p.file);for(let i=0;i<data.length;i+=4)if(data[i+3]===255){assert.deepEqual(data.subarray(i,i+4),reference.subarray(i,i+4),p.name);originalPixels++;}}
 assert.ok(originalPixels>3000);const binding=await readFile(new URL('../public'+d.identityBinding.path,import.meta.url));assert.equal(createHash('sha256').update(binding).digest('hex'),d.identityBinding.sourceSha256);
 for(const state of SPRITE_STATES)for(const direction of ['left','right'])assert.deepEqual(spriteFrameFor('walker',state,direction),spriteFrameFor('turned',state,direction));
 assert.equal(V177_JOINT_ATLASES.turned,atlas);
 const hand=await pixels('near-hand.png'),[x,y]=atlas.muzzle;assert.ok(hand[(y*480+x)*4+3]>=32);
 const bytes=await readFile(new URL('../public'+atlas.path,import.meta.url)),expected=V177_JOINT_ASSET_ADDITIONS.find(a=>a.path===atlas.path),metadata=await sharp(bytes).metadata();
 assert.equal(bytes.length,expected.bytes);assert.equal('sha256-'+createHash('sha256').update(bytes).digest('hex'),expected.hash);assert.equal(metadata.width*metadata.height*4,atlas.decodedBytes);assert.ok(atlas.decodedBytes<=512*1024);
 const input={stageId:CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE,formationKinds:['scout'],enemyKinds:['walker','turned','walker']};
 const plan=requiredBattleAssetPlan(input);assert.equal(plan.persistent.filter(p=>p.key===atlas.key).length,1);assert.equal(plan.paths.filter(p=>p===atlas.path).length,1);
 assert.ok(!requiredBattleAssetPlan({...input,includeV100Sprites:false}).paths.includes(atlas.path));
 for(const state of ['hit-light','death','ability'])assert.equal(v177JointPose('walker',{requestedState:state},{}),null);
 assert.equal(v177JointPose('walker',{requestedState:'active'},{},{ownedPose:true}),null);
});
