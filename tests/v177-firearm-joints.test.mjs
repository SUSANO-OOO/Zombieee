import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose,v177JointCycleDistance,v177RenderedJointWeaponSocket} from '../app/v177JointPresentation.js';
import {spriteFrameFor} from '../app/spriteManifest.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {CAMPAIGN_STAGE_IDS} from '../app/campaign.js';
import {V177_JOINT_ASSET_ADDITIONS} from '../scripts/v177-joint-asset-contract.mjs';
const kinds=['gunner','medic','engineer'];
const transform=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]],distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const pixels=async url=>sharp(await readFile(url)).ensureAlpha().raw().toBuffer();
function inside([x,y],polygon){
 let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const [ax,ay]=polygon[i],[bx,by]=polygon[j];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)hit=!hit;
 }return hit;
}
function edgeDistance(p,polygon){
 let best=Infinity;for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
  best=Math.min(best,distance(p,[a[0]+t*dx,a[1]+t*dy]));
 }return best;
}
function record(kind,plan,{direction='right',scale=1,x=0,y=0}={}){
 const atlas=V177_JOINT_ATLASES[kind],frame={...spriteFrameFor(kind,'walk-a',direction),flipX:direction==='left'},size={w:480*scale,h:448*scale};
 let m=[1,0,0,1,x,y];const stack=[],raw=[],calls=[];
 const multiply=b=>{const a=m;m=[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];};
 const ctx={save(){stack.push([...m]);},restore(){m=stack.pop();},translate(x,y){multiply([1,0,0,1,x,y]);},scale(x,y){multiply([x,0,0,y,0,0]);},transform(...a){raw.push(a);multiply(a);},drawImage(){calls.push([...m]);}};
 if(direction==='left')ctx.scale(-1,1);
 assert.equal(drawV177JointPose(ctx,{naturalWidth:atlas.decodedWidth},kind,plan,-size.w*frame.anchorX,-size.h*frame.anchorY,size.w,size.h),true);
 assert.equal(raw.length,kind==='medic'?16:14);return {raw,calls,frame,size};
}
for(const kind of kinds){
 const dir=new URL('../assets/source/v100/joints/'+kind+'-r1/',import.meta.url),d=JSON.parse(await readFile(new URL('parts.json',dir))),motion=JSON.parse(gunzipSync(await readFile(new URL('motion.json.gz',dir)))),atlas=V177_JOINT_ATLASES[kind];
 const matrixFor=(raw,bone)=>raw[atlas.parts.findIndex(p=>p.bone===bone)];
 test(kind+': evaluated Blender limbs retain fixed lengths, planted painted soles and both original grips',async()=>{
  const soles=[];for(const leg of d.rig.legs){
   const data=await pixels(new URL(leg.paintedPaw+'.png',dir));let bottom=-1;
   for(let y=0;y<448;y++)for(let x=0;x<480;x++)if(data[(y*480+x)*4+3]>=32)bottom=Math.max(bottom,y);
   // A tapered toe can end in one opaque pixel; test every actual lowest pixel.
   const points=[];for(let x=0;x<480;x++)if(data[(bottom*480+x)*4+3]>=32)points.push([x+.5,bottom+.5]);assert.ok(points.length>0);soles.push(points);
  }
  let boneError=0,groundError=0,drift=0,gripError=0;
  for(const action of motion.actions)for(let i=0;i<action.frames.length;i++){
   const f=action.frames[i],first=action.frames[0];
   for(const [name,b]of Object.entries(f.bones))boneError=Math.max(boneError,Math.abs(distance(b.head,b.tail)-distance(first.bones[name].head,first.bones[name].tail)));
   for(const arm of d.armConstraints)gripError=Math.max(gripError,distance(transform(f.deform[arm.lowerBone],arm.wrist),transform(f.deform[arm.effectorBone],arm.wrist)));
   for(let li=0;li<2;li++){
    const q=(i/60+d.rig.legs[li].offset)%1,pq=((i-1)/60+d.rig.legs[li].offset)%1,bone='leg-'+li+'-foot',stance=d.motion.walk.stanceFraction;
    if(action.name==='attack'||action.name==='settle-3'||q<=stance)for(const p of soles[li])groundError=Math.max(groundError,Math.abs(transform(f.deform[bone],p)[1]-432));
    if(i&&(action.name==='attack'||q<=stance&&pq<=stance&&q>pq))for(const p of soles[li])drift=Math.max(drift,distance(transform(f.deform[bone],p),transform(action.frames[i-1].deform[bone],p)));
   }
  }
  for(const [measure,value]of Object.entries({boneError,groundError,drift,gripError}))assert.ok(value<.001,JSON.stringify({kind,measure,value}));
  const walk=motion.actions.find(a=>a.name==='walk');assert.ok(Math.abs(walk.frames.at(-1).bones.root.head[0]-walk.frames[0].bones.root.head[0]-atlas.cycleDistance)<.001);
  assert.ok(Math.abs(v177JointCycleDistance(kind,.2)-atlas.cycleDistance/d.referenceFrame.scale*.2)<1e-10);
 });
 test(kind+': production interpolation keeps elbows and both weapon grips attached through travel, aim, recoil and recovery',()=>{
  function checkArms(raw){for(const arm of d.armConstraints){
   const upper=matrixFor(raw,arm.upperBone),lower=matrixFor(raw,arm.lowerBone),parent=matrixFor(raw,arm.parentBone),weapon=matrixFor(raw,arm.effectorBone);
   const target=distance(transform(parent,arm.shoulder),transform(weapon,arm.wrist)),a=distance(arm.shoulder,arm.elbow),b=distance(arm.elbow,arm.wrist);
   assert.ok(target>Math.abs(a-b)+.0001&&target<a+b-.0001,'Authored grip stays reachable without the runtime fallback');
   assert.ok(distance(transform(upper,arm.shoulder),transform(parent,arm.shoulder))<.001);
   assert.ok(distance(transform(upper,arm.elbow),transform(lower,arm.elbow))<.001);
   assert.ok(distance(transform(lower,arm.wrist),transform(weapon,arm.wrist))<.001);
  }}
  let previous;
  for(let n=0;n<=600;n++)for(const settle of [0,.5,1]){
   const phase=n/600,{raw}=record(kind,v177JointPose(kind,{requestedState:'move'},{locomotionPhase:phase,locomotionSettle:settle}));checkArms(raw);
   if(settle===0){
    if(previous)for(let li=0;li<2;li++){
     const leg=d.rig.legs[li],q=(phase+leg.offset)%1,pq=(previous.phase+leg.offset)%1;
     if(q>1/30&&q<d.motion.walk.stanceFraction-1/30&&q>pq&&pq>1/30){
      const p=[leg.ankle[0],leg.ankle[1]+432-leg.groundAnkleY],bone='leg-'+li+'-foot',now=transform(matrixFor(raw,bone),p),before=transform(matrixFor(previous.raw,bone),p);
      assert.ok(Math.abs(now[1]-432)<.001);assert.ok(Math.abs(now[0]+phase*atlas.cycleDistance-before[0]-previous.phase*atlas.cycleDistance)<.001,'Planted foot stays fixed in world space');
     }
    }previous={phase,raw};
   }
  }
  const runtime={locomotionPhase:.1371,locomotionSettle:1},idle=record(kind,v177JointPose(kind,{requestedState:'idle'},runtime)).raw;
  for(const state of ['wind-up','active','recovery'])for(let n=0;n<=60;n++){
   const {raw}=record(kind,v177JointPose(kind,{requestedState:state,clipProgress:n/60},runtime));checkArms(raw);
   for(let i=0;i<raw.length;i++)if(!atlas.parts[i].upper)assert.deepEqual(raw[i],idle[i],'Aiming and firing hold the current feet');
   if(state==='wind-up'&&n===0||state==='recovery'&&n===60)for(const arm of d.armConstraints)
    assert.ok(distance(transform(matrixFor(raw,arm.effectorBone),arm.wrist),transform(matrixFor(idle,arm.effectorBone),arm.wrist))<.001,'No grip jump at attack handover');
  }
  for(const state of ['hit-light','death','ability'])assert.equal(v177JointPose(kind,{requestedState:state},{}),null);
  assert.equal(v177JointPose(kind,{requestedState:'active'},{},{ownedPose:true}),null);
 });
 test(kind+': original head, hands, weapon and visible costume survive, with an opaque muzzle at the exact rendered socket',async()=>{
  const reference=await pixels(new URL('identity-reference.png',dir));let originalPixels=0,torsoPixels=0;
  for(const part of d.parts){
   const bytes=await readFile(new URL(part.file,dir));assert.equal(hash(bytes),part.sha256);
   if(!part.original&&part.name!=='torso')continue;
   const data=await pixels(new URL(part.file,dir));
   for(let y=0;y<448;y++)for(let x=0;x<480;x++){
    const i=(y*480+x)*4;if(part.original&&data[i+3]===255){assert.deepEqual(data.subarray(i,i+4),reference.subarray(i,i+4),part.name);originalPixels++;}
    if(part.name!=='torso'||reference[i+3]!==255)continue;
    const p=[x+.5,y+.5],exclusions=[part.excludedOriginalWeapon,...part.sourceArmExclusions];
    if(!inside(p,part.originalTorsoRegion)||edgeDistance(p,part.originalTorsoRegion)<=1.5||exclusions.some(poly=>inside(p,poly)||edgeDistance(p,poly)<=1.5))continue;
    assert.deepEqual(data.subarray(i,i+4),reference.subarray(i,i+4),'Visible original costume');torsoPixels++;
   }
  }
  assert.ok(originalPixels>3000);assert.ok(torsoPixels>1500,JSON.stringify({kind,torsoPixels}));
  const binding=await readFile(new URL('../public'+d.identityBinding.path,import.meta.url));assert.equal(hash(binding),d.identityBinding.sourceSha256);
  const weapon=await pixels(new URL('weapon-and-hands.png',dir)),[mx,my]=atlas.muzzle;assert.ok(weapon[(my*480+mx)*4+3]>=32,'Muzzle marker must touch painted weapon');
  const bytes=await readFile(new URL('../public'+atlas.path,import.meta.url)),expected=V177_JOINT_ASSET_ADDITIONS.find(a=>a.path===atlas.path),metadata=await sharp(bytes).metadata();
  assert.equal(bytes.length,expected.bytes);assert.equal('sha256-'+hash(bytes),expected.hash);assert.equal(metadata.width*metadata.height*4,atlas.decodedBytes);assert.ok(atlas.decodedBytes<=300*1024);
  for(const direction of ['left','right'])for(const scale of [.12,.2]){
   const plan=v177JointPose(kind,{requestedState:'active',clipProgress:.26},{locomotionPhase:.1371,locomotionSettle:1}),{raw,calls,frame,size}=record(kind,plan,{direction,scale,x:300,y:500});
   const contact=transform(calls[atlas.parts.findIndex(p=>p.name==='weapon-and-hands')],atlas.muzzle),socket=v177RenderedJointWeaponSocket({kind,plan,direction,frame,size,pose:{offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotationRadians:0},x:300,y:500});
   assert.ok(distance(contact,[socket.x,socket.y])<1e-10,'Paint and effects share normalization and mirror');
   for(const leg of d.rig.legs){const p=[leg.ankle[0],leg.ankle[1]+432-leg.groundAnkleY],m=calls[atlas.parts.findIndex(p=>p.name===leg.paintedPaw)];assert.ok(Math.abs(transform(m,p)[1]-500)<.001,'Painted sole meets the original ground anchor');}
   const point=[240,75],p=transform(matrixFor(raw,'head'),point),actual=transform(calls[atlas.parts.findIndex(p=>p.name==='head')],point),ref=d.referenceFrame;
   assert.ok(Math.abs(actual[0]-(300+(direction==='left'?-1:1)*((p[0]-ref.tx)/ref.scale-frame.anchorX*480)*scale))<1e-10);
   assert.ok(Math.abs(actual[1]-(500+((p[1]-ref.ty)/ref.scale-frame.anchorY*448)*scale))<1e-10);
  }
 });
}
test('firearm joint textures load only for selected units and never change legacy asset plans',()=>{
 const input={stageId:CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE,formationKinds:kinds,enemyKinds:['walker']},plan=requiredBattleAssetPlan(input);
 for(const kind of kinds){const atlas=V177_JOINT_ATLASES[kind];assert.equal(plan.persistent.filter(p=>p.key===atlas.key).length,1);assert.equal(plan.paths.filter(p=>p===atlas.path).length,1);
  assert.ok(!requiredBattleAssetPlan({...input,formationKinds:['brawler']}).paths.includes(atlas.path));
  assert.ok(!requiredBattleAssetPlan({...input,includeV100Sprites:false}).paths.includes(atlas.path));
 }
});
