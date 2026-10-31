import {withV177PaintPartIdentity} from './helpers/v177-render-trace.mjs';
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
import {V177_JOINT_ASSET_ADDITIONS} from '../scripts/v177-runtime-joint-asset-contract.mjs';
const kinds=['guardian','grappler','sprinter','crusher'];
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
 assert.equal(raw.length,{'guardian':16,'grappler':15,'sprinter':15,'crusher':15}[kind]);return {raw,calls,frame,size};
}
for(const kind of kinds){
 const dir=new URL('../assets/source/v100/joints/'+kind+'-r1/',import.meta.url),d=JSON.parse(await readFile(new URL('parts.json',dir))),motion=JSON.parse(gunzipSync(await readFile(new URL('motion.json.gz',dir)))),atlas=V177_JOINT_ATLASES[kind];
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
  const binding=await readFile(new URL('../public'+d.identityBinding.path,import.meta.url));assert.equal(hash(binding),d.identityBinding.sourceSha256);
  const weapon=await pixels(new URL('weapon-and-hands.png',dir)),[mx,my]=atlas.muzzle;assert.ok(weapon[(my*480+mx)*4+3]>=32,'Contact marker must touch the original weapon or fist');
  const bytes=await readFile(new URL('../public'+atlas.path,import.meta.url)),expected=V177_JOINT_ASSET_ADDITIONS.find(a=>a.path===atlas.path),metadata=await sharp(bytes).metadata();
  assert.equal(bytes.length,expected.bytes);assert.equal('sha256-'+hash(bytes),expected.hash);assert.equal(metadata.width*metadata.height*4,atlas.decodedBytes);assert.ok(atlas.decodedBytes<=512*1024);
  for(const direction of ['left','right'])for(const scale of [.12,.2]){
   const plan=v177JointPose(kind,{requestedState:'active',clipProgress:.26},{locomotionPhase:.1371,locomotionSettle:1}),{raw,calls,frame,size}=record(kind,plan,{direction,scale,x:300,y:500});
   const contact=transform(calls[atlas.parts.findIndex(p=>p.name==='weapon-and-hands')],atlas.muzzle),socket=v177RenderedJointWeaponSocket({kind,plan,direction,frame,size,pose:{offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotationRadians:0},x:300,y:500});
   assert.ok(distance(contact,[socket.x,socket.y])<1e-10,'Paint and effects share normalization and mirror');
   for(const leg of d.rig.legs){const p=[leg.ankle[0],leg.ankle[1]+432-leg.groundAnkleY],m=calls[atlas.parts.findIndex(p=>p.name===leg.paintedPaw)];assert.ok(Math.abs(transform(m,p)[1]-500)<.001,'Painted sole meets the original ground anchor');}
   const point=[240,75],p=transform(matrixFor(raw,'head'),point),actual=transform(calls[atlas.parts.findIndex(p=>p.name==='head')],point),ref=d.referenceFrame;
   assert.ok(Math.abs(actual[0]-(300+(direction==='left'?-1:1)*((p[0]-ref.tx)/ref.scale-frame.anchorX*d.referenceFrame.width)*scale))<1e-10);
   assert.ok(Math.abs(actual[1]-(500+((p[1]-ref.ty)/ref.scale-frame.anchorY*d.referenceFrame.height)*scale))<1e-10);
  }
 });
 test(kind+': shield, long claw, bent running arms and heavy fist use distinct contact trajectories',()=>{
  const runtime={locomotionPhase:.1371,locomotionSettle:1},idle=record(kind,v177JointPose(kind,{requestedState:'wind-up',clipProgress:0},runtime)).raw,active=record(kind,v177JointPose(kind,{requestedState:'active',clipProgress:.5},runtime)).raw;
  const start=transform(matrixFor(idle,'weapon-0'),atlas.muzzle),end=transform(matrixFor(active,'weapon-0'),atlas.muzzle);
  assert.equal(d.rig.legs.length,2);assert.equal(d.rig.arms.length,2);
  if(kind==='guardian'){
   assert.equal(d.rig.attack.style,'shield');assert.equal(d.armConstraints.filter(a=>a.effectorBone==='weapon-0').length,2);
   assert.ok(end[0]-start[0]>12&&end[0]-start[0]<30,'Short shield bash stays guarded');
  }else if(kind==='grappler'){
   assert.equal(d.rig.attack.style,'claw');assert.ok(end[0]-start[0]>200,'Long original claw reaches ahead of the face');
   assert.ok(end[1]-start[1]<-80);
  }else if(kind==='sprinter'){
   assert.equal(d.rig.attack.style,'run-lunge');assert.ok(end[0]-start[0]>70,'Bent running hands reach forward on attack');
   const raised=record(kind,v177JointPose(kind,{requestedState:'wind-up',clipProgress:.18/.28},runtime)).raw;
   const windup=transform(matrixFor(raised,'weapon-0'),atlas.muzzle);
   assert.ok(windup[1]<start[1]-40,'Draw the striking hand up before the lunge');
   assert.ok(end[1]>windup[1]+60,'Bring the raised hand through the forward strike');
  }else {
   assert.equal(d.rig.attack.style,'slam');
   const raised=record(kind,v177JointPose(kind,{requestedState:'wind-up',clipProgress:.18/.28},runtime)).raw;
   const windup=transform(matrixFor(raised,'weapon-0'),atlas.muzzle);
   assert.ok(windup[1]<start[1]-65,'Heavy fist lifts for anticipation');
   assert.ok(end[0]-start[0]>40&&end[1]-windup[1]>60,'Raised fist drops into forward contact');
  }
 });

 test(kind+': every evaluated pose clears its authored weapon envelope without paint clipping',async()=>{
  const bounds=d.motion.paintBounds;assert.deepEqual(bounds,{x:0,y:0,w:480,h:448});
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
test('conditional shield and enemy textures deduplicate the crusher derived form',()=>{
 const input={stageId:CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE,formationKinds:['guardian'],enemyKinds:['grappler','sprinter','crusher','abomination']},plan=requiredBattleAssetPlan(input);
 assert.strictEqual(V177_JOINT_ATLASES.abomination,V177_JOINT_ATLASES.crusher);
 const a=spriteFrameFor('abomination','walk-a','right'),c=spriteFrameFor('crusher','walk-a','right');
 assert.deepEqual(a,c,'The shared form retains the complete source, slices, normalization and facing');
 for(const kind of kinds){const atlas=V177_JOINT_ATLASES[kind];
  assert.equal(plan.persistent.filter(p=>p.key===atlas.key).length,1);assert.equal(plan.paths.filter(p=>p===atlas.path).length,1);
  assert.ok(!requiredBattleAssetPlan({...input,formationKinds:[],enemyKinds:['walker']}).paths.includes(atlas.path));
  assert.ok(!requiredBattleAssetPlan({...input,includeV100Sprites:false}).paths.includes(atlas.path));
 }
});
test('sprinter has real flight, bent elbows below the shoulders and opposed arm swing',async()=>{
 const dir=new URL('../assets/source/v100/joints/sprinter-r1/',import.meta.url),d=JSON.parse(await readFile(new URL('parts.json',dir))),motion=JSON.parse(gunzipSync(await readFile(new URL('motion.json.gz',dir)))),atlas=V177_JOINT_ATLASES.sprinter;
 const soles=[];for(const leg of d.rig.legs){const data=await pixels(new URL(leg.paintedPaw+'.png',dir));let point;
  for(let y=0;y<448;y++)for(let x=0;x<480;x++)if(data[(y*480+x)*4+3]>=32)point=[x+.5,y+.5];assert.ok(point);soles.push(point);
 }
 const walk=motion.actions.find(a=>a.name==='walk');let flight=0,support=0;
 for(let n=0;n<60;n++){
  const f=walk.frames[n],q=n/60,offGround=d.rig.legs.map(l=>((q+l.offset)%1)>d.motion.walk.stanceFraction);
  const heights=soles.map((p,i)=>432-transform(f.deform['leg-'+i+'-foot'],p)[1]);
  if(offGround.every(Boolean)){assert.ok(heights.every(h=>h>.5),'Both actual painted soles leave the floor in flight');flight++;}
  else {assert.ok(heights.some(h=>Math.abs(h)<.001),'A support interval has an actual planted sole');support++;}
  for(const arm of d.armConstraints)assert.ok(f.bones[arm.upperBone].tail[1]>=f.bones[arm.upperBone].head[1]-.001,'No elbow wing above the back in the running cycle');
 }
 assert.ok(flight>=6&&support>=40,'A run has actual support and flight intervals');
 const rawAt=p=>record('sprinter',v177JointPose('sprinter',{requestedState:'move'},{locomotionPhase:p,locomotionSettle:0})).raw;
 const a=rawAt(.25),b=rawAt(.75),matrix=(raw,bone)=>raw[atlas.parts.findIndex(p=>p.bone===bone)];
 const shifts=d.armConstraints.map(arm=>transform(matrix(a,arm.effectorBone),arm.wrist)[0]-transform(matrix(b,arm.effectorBone),arm.wrist)[0]);
 assert.ok(shifts[0]*shifts[1]<0&&shifts.every(s=>Math.abs(s)>40),'Arms oppose each other through the authored run');
});
test('crusher preserves coarse pixel paint and restores the surrounding smoothing state',async()=>{
 const atlas=V177_JOINT_ATLASES.crusher,dir=new URL('../assets/source/v100/joints/crusher-r1/',import.meta.url);assert.equal(atlas.paintStyle,'pixel-art');
 const texture=await pixels(new URL('../public'+atlas.path,import.meta.url));let compared=0;
 for(const part of atlas.parts){const b=part.destination,s=part.source,expected=await sharp(await readFile(new URL(part.name+'.png',dir))).extract({left:b.x,top:b.y,width:b.w,height:b.h}).resize(s.w,s.h,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
  for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++){const i=(y*s.w+x)*4,j=((s.y+y)*atlas.decodedWidth+s.x+x)*4;if(expected[i+3]===255){assert.deepEqual(texture.subarray(j,j+4),expected.subarray(i,i+4));compared++;}}
 }
 assert.ok(compared>1000);
 for(const kind of kinds){const stack=[],draws=[],ctx={imageSmoothingEnabled:true,save(){stack.push(this.imageSmoothingEnabled);},restore(){this.imageSmoothingEnabled=stack.pop();},translate(){},scale(){},transform(){},drawImage(){draws.push(this.imageSmoothingEnabled);}};
  drawV177JointPose(ctx,{naturalWidth:512},kind,v177JointPose(kind,{requestedState:'move'},{locomotionPhase:.24,locomotionSettle:0}),0,0,480,448);
  assert.equal(draws.length,kind==='guardian'?16:15);assert.ok(draws.every(v=>v===(kind!=='crusher')));assert.equal(ctx.imageSmoothingEnabled,true);
 }
});
