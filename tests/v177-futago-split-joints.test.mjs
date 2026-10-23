import {withV177PaintPartIdentity} from './helpers/v177-render-trace.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {spriteFrameFor} from '../app/spriteManifest.js';
import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose} from '../app/v177JointPresentation.js';
const atlases=Object.fromEntries(['futago-separated-a','futago-separated-b'].map(kind=>[kind,V177_JOINT_ATLASES[kind]]));
const transform=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]],distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const hash=b=>createHash('sha256').update(b).digest('hex');
const pixels=async file=>sharp(await readFile(file)).ensureAlpha().raw().toBuffer();
function inside([x,y],polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const[a,b]=polygon[i],[c,d]=polygon[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;}return hit;}
function edge(p,poly){let best=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));best=Math.min(best,distance(p,[a[0]+t*dx,a[1]+t*dy]));}return best;}
function record(kind,plan){const raw=[];const ctx={save(){},restore(){},translate(){},scale(){},transform(...m){raw.push(m);},drawImage(){}};assert.ok(withV177PaintPartIdentity(()=>drawV177JointPose(ctx,{naturalWidth:512},kind,plan,0,0,480,448),ctx,kind,[raw]));return raw;}
for(const [kind,atlas]of Object.entries(atlases))test(kind+' retains every original native crop RGBA pixel, two fixed-length legs and both claws through travel, settling and strike',async()=>{
 const dir='assets/source/v100/joints/'+kind+'-r1/',d=JSON.parse(await readFile(dir+'parts.json')),motion=JSON.parse(gunzipSync(await readFile(dir+'motion.json.gz')));
 assert.deepEqual(motion.rig,d.rig);const outlines=new Map(),soles=[];let originalPixels=0,overlayPixels=0;
 for(const part of d.parts){
  const bytes=await readFile(dir+part.file),data=await pixels(dir+part.file);assert.equal(hash(bytes),part.sha256);const outline=[];
  const reference=await pixels(dir+(part.originalReference??'identity-reference.png')),[ox,oy]=part.sourceOffset??[0,0];
  for(let y=0;y<448;y++)for(let x=0;x<480;x++){
   const i=(y*480+x)*4,p=[x+.5,y+.5],sx=x-ox,sy=y-oy,j=(sy*480+sx)*4;
   if(data[i+3]>=32&&part.generatedSilhouette)assert.ok(inside(p,part.generatedSilhouette)||edge(p,part.generatedSilhouette)<1.5,part.name+' paint stays inside its owned limb');
   if(data[i+3]>=32&&(x===0||x===479||y===0||y===447||[-480,480,-1,1].some(n=>data[i+n*4+3]<32)))outline.push(p);
   if(part.original&&sx>=0&&sx<480&&sy>=0&&sy<448&&reference[j+3]>=32){
    const polys=typeof part.polygon[0][0]==='number'?[part.polygon]:part.polygon;
    if(polys.some(poly=>inside(p,poly)&&edge(p,poly)>1.5)&&!(part.excludedRegions??[]).some(poly=>inside(p,poly)||edge(p,poly)<=1.5)){assert.deepEqual(data.subarray(i,i+4),reference.subarray(j,j+4),kind+' '+part.name+' retains source RGBA');originalPixels++;}
   }
   if(part.originalRegions&&(!part.generatedSilhouette||inside(p,part.generatedSilhouette)&&edge(p,part.generatedSilhouette)>1.5)&&reference[i+3]>=32&&part.originalRegions.some(poly=>inside(p,poly)&&edge(p,poly)>1.5)&&!part.excludedRegions.some(poly=>inside(p,poly)||edge(p,poly)<=1.5)){
    assert.deepEqual(data.subarray(i,i+4),reference.subarray(i,i+4),kind+' '+part.name+' original sleeve/costume');overlayPixels++;
   }
  }
  assert.ok(outline.length>10);outlines.set(part.name,outline);
 }
 for(const leg of d.rig.legs){const data=await pixels(dir+leg.paintedPaw+'.png');let bottom=-1;for(let y=0;y<448;y++)for(let x=0;x<480;x++)if(data[(y*480+x)*4+3]>=32)bottom=Math.max(bottom,y);const points=[];for(let x=0;x<480;x++)if(data[(bottom*480+x)*4+3]>=32)points.push([x+.5,bottom+.5]);assert.ok(points.length);soles.push(points);}
 let boneError=0,groundError=0,gripError=0,drift=0,poses=0;
 for(const action of motion.actions)for(let n=0;n<action.frames.length;n++){
  const f=action.frames[n],first=action.frames[0];poses++;
  for(const [name,b]of Object.entries(f.bones))boneError=Math.max(boneError,Math.abs(distance(b.head,b.tail)-distance(first.bones[name].head,first.bones[name].tail)));
  for(const arm of d.armConstraints)gripError=Math.max(gripError,distance(transform(f.deform[arm.lowerBone],arm.wrist),transform(f.deform[arm.effectorBone],arm.effectorWrist??arm.wrist)));
  for(let li=0;li<d.rig.legs.length;li++){const leg=d.rig.legs[li],q=(n/60+leg.offset)%1,pq=((n-1)/60+leg.offset)%1,bone='leg-'+li+'-foot';
   if(action.name==='attack'||action.name==='settle-3'||q<=d.motion.walk.stanceFraction)for(const p of soles[li])groundError=Math.max(groundError,Math.abs(transform(f.deform[bone],p)[1]-leg.paintGroundY));
   if(n&&(action.name==='attack'||q<=d.motion.walk.stanceFraction&&pq<=d.motion.walk.stanceFraction&&q>pq))for(const p of soles[li])drift=Math.max(drift,distance(transform(f.deform[bone],p),transform(action.frames[n-1].deform[bone],p)));
  }
  for(const part of d.parts)for(const p of outlines.get(part.name)){const q=transform(f.deform[part.bone],p);q[0]-=f.bones.root.head[0]-d.rig.root[0];assert.ok(q[0]>=0&&q[0]<=480&&q[1]>=0&&q[1]<=448,JSON.stringify({kind,action:action.name,frame:n+1,part:part.name,q}));}
 }
 for(const [metric,value]of Object.entries({boneError,groundError,gripError,drift}))assert.ok(value<.001,JSON.stringify({kind,metric,value}));
 const matrix=(raw,bone)=>raw[atlas.parts.findIndex(p=>p.bone===bone)];let dense=0,minMargin=Infinity,minLegReachMarginPx=Infinity,previous;
 function checkArms(raw){for(const l of d.legConstraints){const upper=matrix(raw,l.upperBone),lower=matrix(raw,l.lowerBone),parent=matrix(raw,l.parentBone),foot=matrix(raw,l.effectorBone);assert.ok(distance(transform(upper,l.hip),transform(parent,l.hip))<.001);assert.ok(distance(transform(upper,l.knee),transform(lower,l.knee))<.001);assert.ok(distance(transform(lower,l.ankle),transform(foot,l.ankle))<.001);const a=distance(l.hip,l.knee),b=distance(l.knee,l.ankle),gap=distance(transform(parent,l.hip),transform(foot,l.ankle));minLegReachMarginPx=Math.min(minLegReachMarginPx,a+b-gap,gap-Math.abs(a-b));assert.ok(gap>Math.abs(a-b)+.001&&gap<a+b-.001,'No scaling/clamping or detached fixed leg');}for(const [name,a]of Object.entries(d.parentAttachments)){const child=matrix(raw,name),parent=matrix(raw,a.parent);assert.ok(distance(transform(child,a.pivot),transform(parent,a.pivot))<.001,name+' remains at the original shared neck');}for(const arm of d.armConstraints){
  const upper=matrix(raw,arm.upperBone),lower=matrix(raw,arm.lowerBone),parent=matrix(raw,arm.parentBone),effector=matrix(raw,arm.effectorBone),target=transform(effector,arm.effectorWrist??arm.wrist);
  const len=distance(transform(parent,arm.shoulder),target),a=distance(arm.shoulder,arm.elbow),b=distance(arm.elbow,arm.wrist);minMargin=Math.min(minMargin,len-Math.abs(a-b),a+b-len);assert.ok(len>Math.abs(a-b)+.0001&&len<a+b-.0001,JSON.stringify({kind,arm:arm.upperBone,len,reach:a+b}));
  assert.ok(distance(transform(upper,arm.shoulder),transform(parent,arm.shoulder))<.001);assert.ok(distance(transform(upper,arm.elbow),transform(lower,arm.elbow))<.001);assert.ok(distance(transform(lower,arm.wrist),target)<.001,'Painted holding hand and wrist stay attached');
 }}
 for(let n=0;n<=600;n++)for(const settle of [0,.5,1]){
  const phase=n/600,raw=record(kind,v177JointPose(kind,{requestedState:'move'},{locomotionPhase:phase,locomotionSettle:settle}));checkArms(raw);dense++;
  if(settle===0){if(previous)for(let li=0;li<d.rig.legs.length;li++){const leg=d.rig.legs[li],q=(phase+leg.offset)%1,pq=(previous.phase+leg.offset)%1;
   if(q>1/30&&q<d.motion.walk.stanceFraction-1/30&&q>pq&&pq>1/30){const p=[leg.ankle[0],leg.ankle[1]+leg.paintGroundY-leg.groundAnkleY],a=transform(matrix(raw,'leg-'+li+'-foot'),p),b=transform(matrix(previous.raw,'leg-'+li+'-foot'),p);assert.ok(Math.abs(a[1]-leg.paintGroundY)<.001);assert.ok(Math.abs(a[0]+phase*atlas.cycleDistance-b[0]-previous.phase*atlas.cycleDistance)<.001);}}
   previous={phase,raw};}
 }
 const runtime={locomotionPhase:.1371,locomotionSettle:1},idle=record(kind,v177JointPose(kind,{requestedState:'idle'},runtime));
 for(const state of ['wind-up','active','recovery'])for(let n=0;n<=60;n++){const raw=record(kind,v177JointPose(kind,{requestedState:state,clipProgress:n/60},runtime));checkArms(raw);dense++;for(let i=0;i<raw.length;i++)if(!atlas.parts[i].upper)assert.deepEqual(raw[i],idle[i]);
  if(state==='wind-up'&&n===0||state==='recovery'&&n===60)for(const arm of d.armConstraints)assert.ok(distance(transform(matrix(raw,arm.effectorBone),arm.effectorWrist??arm.wrist),transform(matrix(idle,arm.effectorBone),arm.effectorWrist??arm.wrist))<.001,'No attack handover jump');}
 const weapon=await pixels(dir+'large-claw.png'),[mx,my]=atlas.muzzle;assert.ok(weapon[(my*480+mx)*4+3]>=32,JSON.stringify({kind,muzzle:atlas.muzzle,alpha:weapon[(my*480+mx)*4+3]}));
 assert.equal(d.rig.legs.length,2);assert.equal(d.rig.arms.length,2);assert.equal(poses,305);assert.equal(d.rig.weapons.length,0);assert.ok(originalPixels>1000&&overlayPixels>1000);
 for(const [pose,binding]of Object.entries(d.poseBindings)){
  assert.equal(hash(await readFile(dir+binding.file)),binding.sha256);const bytes=await readFile('public'+binding.path);assert.equal(hash(bytes),binding.sourceSha256);
  const frame=spriteFrameFor(kind,pose,'right');assert.deepEqual(binding.sourceRect,frame.sourceRect);assert.deepEqual(binding.drawSlices,frame.drawSlices??null);assert.equal(frame.flipX,false);
  const s=binding.sourceRect,original=await sharp(bytes).extract({left:s.x,top:s.y,width:s.w,height:s.h}).ensureAlpha().raw().toBuffer(),ref=await pixels(dir+binding.file),[ox,oy]=binding.referenceTransform.paddingOnly?[d.sourcePadding.tx,d.sourcePadding.ty]:[0,0],width=binding.referenceTransform.paddingOnly?480:s.w;let kept=0;
  for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++){
   const i=(y*s.w+x)*4,j=((y+oy)*width+x+ox)*4,allowed=!binding.drawSlices||binding.drawSlices.some(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h);
   if(!allowed)assert.equal(ref[j+3],0,'Neighbor exclusions remain transparent');
   else {assert.deepEqual(ref.subarray(j,j+4),original.subarray(i,i+4),'Every owned canonical pixel including semi-transparent RGB is retained');if(original[i+3]>=32)kept++;}
  }
  assert.ok(kept>1000,pose+' original crop paint retained without resampling');
 }
 const f=spriteFrameFor(kind,'walk-a','right'),nativeNear=(d.rig.legs[1].paintGroundY-d.referenceFrame.ty)/d.referenceFrame.scale;
 assert.ok(Math.abs(nativeNear-f.anchorY*d.referenceFrame.height)<.001,'Original painted sole registers at the real sprite anchor');

 assert.equal(dense,1986);assert.ok(originalPixels>10000&&overlayPixels>6000);for(const state of ['hit','death','collapse','transform'])assert.equal(v177JointPose(kind,{requestedState:state},runtime),null);assert.equal(v177JointPose(kind,{requestedState:'active'},runtime,{ownedPose:true}),null);
});
