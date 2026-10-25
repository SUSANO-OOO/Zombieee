import {withV177PaintPartIdentity} from './helpers/v177-render-trace.mjs';
import {applyV105Source} from '../scripts/v105-five-corrections-asset-contract.mjs';
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
import {V177_MELEE_JOINT_ATLASES} from '../app/v177MeleeJointData.js';
import {V177_RETIRED_JOINT_SOURCE_ASSETS,V177_JOINT_ASSET_ADDITIONS} from '../scripts/v177-joint-asset-contract.mjs';
const kinds=['brute','brawler','crazy-king','kumaverson'];
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
 const atlas=V177_JOINT_ATLASES[kind],frame={...spriteFrameFor(kind,'walk-a',direction),flipX:direction==='left'},size={w:atlas.referenceFrame.width*scale,h:atlas.referenceFrame.height*scale};
 let m=[1,0,0,1,x,y];const stack=[],raw=[],calls=[];
 const multiply=b=>{const a=m;m=[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];};
 const ctx={save(){stack.push([...m]);},restore(){m=stack.pop();},translate(x,y){multiply([1,0,0,1,x,y]);},scale(x,y){multiply([x,0,0,y,0,0]);},transform(...a){raw.push(a);multiply(a);},drawImage(){calls.push([...m]);}};
 if(direction==='left')ctx.scale(-1,1);
 assert.equal(withV177PaintPartIdentity(()=>drawV177JointPose(ctx,{naturalWidth:atlas.decodedWidth},kind,plan,-size.w*frame.anchorX,-size.h*frame.anchorY,size.w,size.h),ctx,kind,[raw,calls]),true);
 assert.equal(raw.length,{'brute':14,'brawler':15,'crazy-king':15,'kumaverson':15}[kind]);return {raw,calls,frame,size};
}
for(const kind of kinds){
 const dir=new URL(kind==='brawler'?'../assets/source/v177/paisen/battle-r8/':'../assets/source/v100/joints/'+kind+'-r1/',import.meta.url),d=JSON.parse(await readFile(new URL('parts.json',dir))),motion=JSON.parse(gunzipSync(await readFile(new URL('motion.json.gz',dir)))),atlas=V177_JOINT_ATLASES[kind];
 const matrixFor=(raw,bone)=>raw[atlas.parts.findIndex(p=>p.bone===bone)];
 test(kind+': evaluated Blender limbs retain fixed lengths, planted painted soles and weapon and free hands',async()=>{
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
 test(kind+': production interpolation keeps elbows and weapon and free hands attached through travel, anticipation, contact and recovery',()=>{
  function checkArms(raw){for(const arm of d.armConstraints){
   const upper=matrixFor(raw,arm.upperBone),lower=matrixFor(raw,arm.lowerBone),parent=matrixFor(raw,arm.parentBone),weapon=matrixFor(raw,arm.effectorBone);
   const target=distance(transform(parent,arm.shoulder),transform(weapon,arm.wrist)),a=distance(arm.shoulder,arm.elbow),b=distance(arm.elbow,arm.wrist);
   assert.ok(target>Math.abs(a-b)+.0001&&target<a+b-.0001,JSON.stringify({kind,arm:arm.upperBone,target,min:Math.abs(a-b),max:a+b}));
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
 test(kind+': original head, hands, weapon and visible costume survive, with an opaque contact point at the exact rendered socket',async()=>{
  if(kind==='brawler'){
   const reference=await pixels(new URL('identity-reference.png',dir)),head=await pixels(new URL('head.png',dir)),shirt=await pixels(new URL('torso.png',dir));let originalHead=0;
   for(let i=0;i<head.length;i+=4)if(head[i+3]>=32&&shirt[i+3]===0){assert.deepEqual(head.subarray(i,i+4),reference.subarray(i,i+4),'Photo-bound full-body reference head');originalHead++;}
   assert.ok(originalHead>1000);assert.equal(hash(await readFile(new URL('identity-reference.png',dir))),d.sourceSha256);
   const texture=await pixels(new URL('../public'+atlas.path,import.meta.url));let authoredPaint=0;
   for(const part of atlas.parts){
    const source=d.parts.find(p=>p.name===part.name),bytes=await readFile(new URL(source.file,dir));assert.equal(hash(bytes),source.sha256);
    const b=part.destination,s=part.source,expected=await sharp(bytes).extract({left:b.x,top:b.y,width:b.w,height:b.h}).resize(s.w,s.h,{kernel:'lanczos3'}).ensureAlpha().raw().toBuffer();
    for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++){const i=(y*s.w+x)*4,j=((s.y+y)*atlas.decodedWidth+s.x+x)*4;
     assert.equal(texture[j+3],expected[i+3]);if(expected[i+3]===255){assert.deepEqual(texture.subarray(j,j+4),expected.subarray(i,i+4),'Every opaque source pixel belongs to the registered photo paint');authoredPaint++;}
    }
   }
   assert.equal(authoredPaint,6921);assert.equal(d.identityBinding.path,'/art/v100/portraits/paisen-identity-r2.webp');
  }else{
  const reference=await pixels(new URL('identity-reference.png',dir));let originalPixels=0,torsoPixels=0,armPaintPixels=0;
  for(const part of d.parts){
   const bytes=await readFile(new URL(part.file,dir));assert.equal(hash(bytes),part.sha256);
   if(!part.original&&part.name!=='torso'&&!part.originalRegions)continue;
   const data=await pixels(new URL(part.file,dir));
   for(let y=0;y<448;y++)for(let x=0;x<480;x++){
    const i=(y*480+x)*4;
    if(part.original&&reference[i+3]>=32){
     const point=[x+.5,y+.5],polygons=typeof part.polygon[0][0]==='number'?[part.polygon]:part.polygon;
     if(polygons.some(poly=>inside(point,poly)&&edgeDistance(point,poly)>1.5)){assert.deepEqual(data.subarray(i,i+4),reference.subarray(i,i+4),part.name+' preserves translucent source RGBA');originalPixels++;}
    }
    if(part.originalRegions&&reference[i+3]>=32){
     const point=[x+.5,y+.5];
     if(part.originalRegions.some(poly=>inside(point,poly)&&edgeDistance(point,poly)>1.5)&&!part.excludedRegions.some(poly=>inside(point,poly)||edgeDistance(point,poly)<=1.5)){
      assert.deepEqual(data.subarray(i,i+4),reference.subarray(i,i+4),'Original visible sleeve and forearm paint');armPaintPixels++;
     }
    }
    if(part.name!=='torso'||reference[i+3]<32)continue;
    const p=[x+.5,y+.5],exclusions=[part.excludedOriginalWeapon,...part.sourceArmExclusions];
    if(!inside(p,part.originalTorsoRegion)||edgeDistance(p,part.originalTorsoRegion)<=1.5||exclusions.some(poly=>inside(p,poly)||edgeDistance(p,poly)<=1.5))continue;
    assert.deepEqual(data.subarray(i,i+4),reference.subarray(i,i+4),'Visible original costume');torsoPixels++;
   }
  }
  assert.ok(originalPixels>1000);assert.ok(torsoPixels>1000,JSON.stringify({kind,torsoPixels}));assert.ok(armPaintPixels>100);
  }
  const binding=await readFile(new URL('../public'+d.identityBinding.path,import.meta.url));assert.equal(hash(binding),d.identityBinding.sourceSha256);
  const weapon=await pixels(new URL('weapon-and-hands.png',dir)),[mx,my]=atlas.muzzle;assert.ok(weapon[(my*480+mx)*4+3]>=32,'Contact marker must touch the original weapon or fist');
  const bytes=await readFile(new URL('../public'+atlas.path,import.meta.url)),expected=V177_JOINT_ASSET_ADDITIONS.map(applyV105Source).find(a=>a.path===atlas.path),metadata=await sharp(bytes).metadata();
  assert.equal(bytes.length,expected.bytes);assert.equal('sha256-'+hash(bytes),expected.hash);assert.equal(metadata.width*metadata.height*4,atlas.decodedBytes);assert.ok(atlas.decodedBytes<=512*1024);
  for(const direction of ['left','right'])for(const scale of [.12,.2]){
   const plan=v177JointPose(kind,{requestedState:'active',clipProgress:.26},{locomotionPhase:.1371,locomotionSettle:1}),{raw,calls,frame,size}=record(kind,plan,{direction,scale,x:300,y:500});
   const contact=transform(calls[atlas.parts.findIndex(p=>p.name==='weapon-and-hands')],atlas.muzzle),socket=v177RenderedJointWeaponSocket({kind,plan,direction,frame,size,pose:{offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotationRadians:0},x:300,y:500});
   assert.ok(distance(contact,[socket.x,socket.y])<1e-10,'Paint and effects share normalization and mirror');
   for(const leg of d.rig.legs){const p=[leg.ankle[0],leg.ankle[1]+432-leg.groundAnkleY],m=calls[atlas.parts.findIndex(p=>p.name===leg.paintedPaw)];const sourcePlaneY=kind==='brawler'?500+((d.motion.walk.groundY-d.referenceFrame.ty)/d.referenceFrame.scale-frame.anchorY*d.referenceFrame.height)*scale:500;assert.ok(Math.abs(transform(m,p)[1]-sourcePlaneY)<.001,'Planted sole retains its exact source-to-frame ground plane');}
   const point=[240,75],p=transform(matrixFor(raw,'head'),point),actual=transform(calls[atlas.parts.findIndex(p=>p.name==='head')],point),ref=d.referenceFrame;
   assert.ok(Math.abs(actual[0]-(300+(direction==='left'?-1:1)*((p[0]-ref.tx)/ref.scale-frame.anchorX*d.referenceFrame.width)*scale))<1e-10);
   assert.ok(Math.abs(actual[1]-(500+((p[1]-ref.ty)/ref.scale-frame.anchorY*d.referenceFrame.height)*scale))<1e-10);
  }
 });
 test(kind+': distinct hammer, guarded punch, two-handed saw sweep and downward pan strike follow the actual hands',()=>{
  assert.equal(d.rig.legs.length,2);assert.equal(d.rig.arms.length,2);
  const runtime={locomotionPhase:.1371,locomotionSettle:1},idle=record(kind,v177JointPose(kind,{requestedState:'wind-up',clipProgress:0},runtime)).raw,active=record(kind,v177JointPose(kind,{requestedState:'active',clipProgress:.5},runtime)).raw;
  const start=transform(matrixFor(idle,'weapon-0'),atlas.muzzle),end=transform(matrixFor(active,'weapon-0'),atlas.muzzle);
  if(kind==='brute'){
   assert.equal(d.armConstraints.filter(a=>a.effectorBone==='weapon-0').length,2);assert.ok(end[0]-start[0]>200);assert.ok(end[1]-start[1]>140);
   assert.ok(Math.atan2(matrixFor(active,'spine')[1],matrixFor(active,'spine')[0])>.6,'The torso follows the heavy forward swing');
  }else if(kind==='brawler'){
   assert.equal(d.rig.attack.style,'punch');assert.equal(d.armConstraints.filter(a=>a.effectorBone==='weapon-0').length,1);
   const strikeArm=d.armConstraints.find(a=>a.effectorBone==='weapon-0'),guardArm=d.armConstraints.find(a=>a.effectorBone!=='weapon-0');
   const activeWrist=transform(matrixFor(active,'weapon-0'),strikeArm.wrist),activeShoulder=transform(matrixFor(active,'spine'),strikeArm.shoulder);
   assert.ok(activeWrist[0]>activeShoulder[0]&&activeWrist[1]<strikeArm.wrist[1],'Photo-sized fist strikes forward above its resting position');
   const guard=transform(matrixFor(active,guardArm.effectorBone),guardArm.wrist),head=transform(matrixFor(active,'head'),d.rig.head[0]);
   assert.ok(guard[1]>head[1]&&guard[1]<d.rig.pelvis[0][1],'The second fist remains between the face and chest');
   assert.ok(end[0]>start[0]);assert.equal(d.sourceSha256,"cd36c9f9d958714874c2e7c49008d7afce673811850c4fc1e389cee65a850797");
  }else if(kind==='crazy-king'){
   const raised=record(kind,v177JointPose(kind,{requestedState:'wind-up',clipProgress:5/7},runtime)).raw;
   const a=matrixFor(raised,'weapon-0'),b=matrixFor(active,'weapon-0');
   assert.ok(Math.atan2(b[1],b[0])-Math.atan2(a[1],a[0])>2.8,'The held chainsaw sweeps through roughly half a turn');
   const hand=transform(matrixFor(active,'arm-1-hand'),atlas.armConstraints[1].wrist),handle=transform(b,[195,253]);
   assert.ok(Math.hypot(hand[0]-handle[0],hand[1]-handle[1])<.002,'The second actual painted hand holds the second handle');
  }else {
   const raised=record(kind,v177JointPose(kind,{requestedState:'wind-up',clipProgress:5/7},runtime)).raw;
   const overhead=transform(matrixFor(raised,'weapon-0'),atlas.muzzle);
   assert.ok(end[1]-overhead[1]>180,'The frying pan comes down from above the head');
  }
 });

 test(kind+': every evaluated pose clears its authored weapon envelope without paint clipping',async()=>{
  const bounds=d.motion.paintBounds;assert.deepEqual(bounds,{x:0,y:0,w:kind==='brute'?576:480,h:448});
  const outlines=new Map();
  for(const part of d.parts){const data=await pixels(new URL(part.file,dir)),points=[];
   for(let y=1;y<447;y++)for(let x=1;x<479;x++){const i=(y*480+x)*4;if(data[i+3]>=32&&[-480,480,-1,1].some(n=>data[i+n*4+3]<32))points.push([x+.5,y+.5]);}
   assert.ok(points.length>10);outlines.set(part.name,points);
  }
  for(const action of motion.actions)for(const frame of action.frames)for(const part of d.parts)for(const p of outlines.get(part.name)){
   const q=transform(frame.deform[part.bone],p);q[0]-=frame.bones.root.head[0]-d.rig.root[0];
   assert.ok(q[0]>=bounds.x&&q[0]<=bounds.x+bounds.w&&q[1]>=bounds.y&&q[1]<=bounds.y+bounds.h,JSON.stringify({kind,action:action.name,frame:frame.frame,part:part.name,q}));
  }
 });
}
test('Melee textures load only for selected forms and never change legacy asset plans',()=>{
 const input={stageId:CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE,formationKinds:[],enemyKinds:kinds},plan=requiredBattleAssetPlan(input);
 for(const kind of kinds){const atlas=V177_JOINT_ATLASES[kind];assert.equal(plan.persistent.filter(p=>p.key===atlas.key).length,1);assert.equal(plan.paths.filter(p=>p===atlas.path).length,1);
  assert.ok(!requiredBattleAssetPlan({...input,enemyKinds:['walker']}).paths.includes(atlas.path));
  assert.ok(!requiredBattleAssetPlan({...input,includeV100Sprites:false}).paths.includes(atlas.path));
 }
});

test('legacy hammer interpolation keeps its grip control and the new broad swing keeps both actual hands joined',()=>{
 const atlas=V177_JOINT_ATLASES.brute,pivot=atlas.interpolationPivots['weapon-0'];
 assert.deepEqual(pivot,[254,168]);
 for(const state of ['wind-up','active','recovery'])for(let n=0;n<=180;n++){
  const plan=v177JointPose('brute',{requestedState:state,clipProgress:n/180},{locomotionPhase:.1371,locomotionSettle:1});
  const {raw}=record('brute',{...plan,choreography:undefined}),a=transform(atlas.poses[plan.upperIndex]['weapon-0'],pivot),b=transform(atlas.poses[plan.upperNextIndex]['weapon-0'],pivot);
  const expected=[a[0]+(b[0]-a[0])*plan.upperBlend,a[1]+(b[1]-a[1])*plan.upperBlend+plan.upperOffsetY];
  const actual=transform(raw[atlas.parts.findIndex(p=>p.bone==='weapon-0')],pivot);
  assert.ok(distance(actual,expected)<.001,'The original two-handed grip stays on the evaluated path between keys');
  const current=record('brute',plan).raw;
  for(const arm of atlas.armConstraints){
   const wrist=transform(current[atlas.parts.findIndex(p=>p.bone===arm.lowerBone)],arm.wrist);
   const held=transform(current[atlas.parts.findIndex(p=>p.bone===arm.effectorBone)],arm.effectorWrist??arm.wrist);
   assert.ok(distance(wrist,held)<.001,'Both painted hands own the same rigid hammer throughout its broad swing');
  }
 }
});

test('hammer knees bend forwards without detaching the hip, knee or planted ankle in either facing',()=>{
 const atlas=V177_JOINT_ATLASES.brute;
 const matrixFor=(rows,bone)=>rows[atlas.parts.findIndex(part=>part.bone===bone)];
 for(const direction of ['left','right'])for(let n=0;n<=120;n++)for(const settle of [0,.5,1]){
  const runtime={locomotionPhase:n/120,locomotionSettle:settle};
  for(const requestedState of ['move','idle','wind-up','active','recovery']){
   const {raw,calls}=record('brute',v177JointPose('brute',{requestedState,clipProgress:n/120},runtime),{direction});
   for(const chain of atlas.legConstraints){
    const upper=matrixFor(raw,chain.upperBone),lower=matrixFor(raw,chain.lowerBone);
    const hip=transform(matrixFor(raw,chain.parentBone),chain.hip),knee=transform(upper,chain.knee);
    const ankle=transform(matrixFor(raw,chain.effectorBone),chain.ankle);
    assert.ok(distance(transform(upper,chain.hip),hip)<1e-9,'Thigh stays attached to the pelvis');
    assert.ok(distance(transform(lower,chain.knee),knee)<1e-9,'Thigh and shin meet at the same knee');
    assert.ok(distance(transform(lower,chain.ankle),ankle)<1e-9,'Shin stays attached to the shoe');
    assert.ok(Math.abs(distance(hip,knee)-distance(chain.hip,chain.knee))<1e-9);
    assert.ok(Math.abs(distance(knee,ankle)-distance(chain.knee,chain.ankle))<1e-9);
    const paintedHip=transform(matrixFor(calls,chain.upperBone),chain.hip);
    const paintedKnee=transform(matrixFor(calls,chain.upperBone),chain.knee);
    const paintedAnkle=transform(matrixFor(calls,chain.effectorBone),chain.ankle);
    const forward=(paintedKnee[0]-paintedHip[0])*(paintedAnkle[1]-paintedHip[1])
      -(paintedKnee[1]-paintedHip[1])*(paintedAnkle[0]-paintedHip[0]);
    assert.ok(forward*(direction==='left'?-1:1)>0,'The knee must bend towards the direction faced');
   }
  }
 }
});

test('archived brawler pixel paint stays unchanged and current painted rigs restore canvas smoothing',async()=>{
 const atlas=V177_MELEE_JOINT_ATLASES.brawler,dir=new URL('../assets/source/v100/joints/brawler-r1/',import.meta.url);
 const retired=V177_RETIRED_JOINT_SOURCE_ASSETS.find(a=>a.path===atlas.path);assert.ok(retired);assert.equal('sha256-'+hash(await readFile(new URL('../public'+atlas.path,import.meta.url))),retired.hash);
 assert.equal(atlas.paintStyle,'pixel-art');
 const texture=await pixels(new URL('../public'+atlas.path,import.meta.url));let compared=0;
 for(const part of atlas.parts){
  const b=part.destination,s=part.source,expected=await sharp(await readFile(new URL(part.name+'.png',dir))).extract({left:b.x,top:b.y,width:b.w,height:b.h}).resize(s.w,s.h,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
  for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++){
   const i=(y*s.w+x)*4,j=((s.y+y)*atlas.decodedWidth+s.x+x)*4;
   if(expected[i+3]===255){assert.deepEqual(texture.subarray(j,j+4),expected.subarray(i,i+4));compared++;}
  }
 }
 assert.ok(compared>1000);
 for(const kind of kinds){
  const stack=[],draws=[],ctx={imageSmoothingEnabled:true,save(){stack.push(this.imageSmoothingEnabled);},restore(){this.imageSmoothingEnabled=stack.pop();},translate(){},scale(){},transform(){},drawImage(){draws.push(this.imageSmoothingEnabled);}};
  drawV177JointPose(ctx,{naturalWidth:512},kind,v177JointPose(kind,{requestedState:'move'},{locomotionPhase:.24,locomotionSettle:0}),0,0,480,448);
  assert.equal(draws.length,kind==='brute'?14:15);assert.ok(draws.every(v=>v===true));assert.equal(ctx.imageSmoothingEnabled,true);
 }
});

test('clothing layers do not retain brawler old forearm pixels or the detached kumaverson thigh fragment',async()=>{
 const bDir=new URL('../assets/source/v100/joints/brawler-r1/',import.meta.url),reference=await pixels(new URL('identity-reference.png',bDir)),pelvis=await pixels(new URL('pelvis.png',bDir));let sourceSkin=0;
 // This interior patch was copied unchanged into the shorts in the rejected
 // trial. Avoid classifying unrelated brown antialiasing as retained skin.
 for(let y=230;y<241;y++)for(let x=216;x<225;x++){
  const i=(y*480+x)*4;
  if(reference[i+3]>=32&&reference[i]>120&&reference[i]>reference[i+1]*1.35&&reference[i+1]>reference[i+2]*1.2){
   sourceSkin++;assert.ok(pelvis[i+3]<32||Math.abs(pelvis[i]-reference[i])+Math.abs(pelvis[i+1]-reference[i+1])+Math.abs(pelvis[i+2]-reference[i+2])>50,'An old stationary forearm cannot move with the shorts');
  }
 }
 assert.ok(sourceSkin>30,'The removed arm pixels really exist in this bound original source');
 const torso=await pixels(new URL('torso.png',bDir));
 for(let y=170;y<229;y++)for(let x=190;x<235;x++){
  const i=(y*480+x)*4;
  assert.ok(!(torso[i+3]>=64&&torso[i]>140&&torso[i]>torso[i+1]*1.35&&torso[i+1]>torso[i+2]*1.2),'No orange old-arm strip in the hidden shirt fill');
 }
 const kDir=new URL('../assets/source/v100/joints/kumaverson-r1/',import.meta.url),thigh=await pixels(new URL('near-thigh.png',kDir));
 for(let y=312;y<341;y++)for(let x=238;x<248;x++)assert.equal(thigh[(y*480+x)*4+3],0);
});
