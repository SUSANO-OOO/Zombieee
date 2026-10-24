import {spriteFrameFor} from '../app/spriteManifest.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {gunzipSync} from 'node:zlib';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {CAMPAIGN_STAGE_IDS} from '../app/campaign.js';
import {V177_JOINT_ASSET_ADDITIONS} from '../scripts/v177-joint-asset-contract.mjs';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose,v177RenderedJointWeaponSocket} from '../app/v177JointPresentation.js';
const atlases={'kurome':V177_JOINT_ATLASES.kurome};
const transform=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]],distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const hash=b=>createHash('sha256').update(b).digest('hex');
const pixels=async file=>sharp(await readFile(file)).ensureAlpha().raw().toBuffer();
function inside([x,y],polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const[a,b]=polygon[i],[c,d]=polygon[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;}return hit;}
function edge(p,poly){let best=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));best=Math.min(best,distance(p,[a[0]+t*dx,a[1]+t*dy]));}return best;}
function record(kind,plan){const raw=[];const ctx={save(){},restore(){},translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},transform(...m){raw.push(m);},drawImage(){}};assert.ok(drawV177JointPose(ctx,{naturalWidth:512},kind,plan,0,0,480,448));return raw;}
for(const [kind,atlas]of Object.entries(atlases))test('Kurome retains its original eye, head, claw hands and hock feet with closed joints and planted gait',async()=>{
 const dir='assets/source/v100/joints/kurome-r1/',d=JSON.parse(await readFile(dir+'parts.json')),motion=JSON.parse(gunzipSync(await readFile(dir+'motion.json.gz')));
 assert.deepEqual(motion.rig,d.rig);const outlines=new Map(),soles=[];let originalPixels=0,overlayPixels=0;
 for(const part of d.parts){
  const bytes=await readFile(dir+part.file),data=await pixels(dir+part.file);assert.equal(hash(bytes),part.sha256);const outline=[];
  const reference=await pixels(dir+(part.originalReference??'identity-reference.png')),[ox,oy]=part.sourceOffset??[0,0];
  for(let y=0;y<448;y++)for(let x=0;x<480;x++){
   const i=(y*480+x)*4,p=[x+.5,y+.5],sx=x-ox,sy=y-oy,j=(sy*480+sx)*4;
   if(data[i+3]>=32&&(x===0||x===479||y===0||y===447||[-480,480,-1,1].some(n=>data[i+n*4+3]<32)))outline.push(p);
   if(part.original&&sx>=0&&sx<480&&sy>=0&&sy<448&&reference[j+3]>=32){
    const polys=typeof part.polygon[0][0]==='number'?[part.polygon]:part.polygon;
    if(polys.some(poly=>inside(p,poly)&&edge(p,poly)>1.5)&&!(part.excludedRegions??[]).some(poly=>inside(p,poly)||edge(p,poly)<=1.5)){assert.deepEqual(data.subarray(i,i+4),reference.subarray(j,j+4),kind+' '+part.name+' retains source RGBA');originalPixels++;}
   }
   if(part.originalRegions&&reference[i+3]>=32&&part.originalRegions.some(poly=>inside(p,poly)&&edge(p,poly)>1.5)&&!part.excludedRegions.some(poly=>inside(p,poly)||edge(p,poly)<=1.5)){
    assert.deepEqual(data.subarray(i,i+4),reference.subarray(i,i+4),kind+' '+part.name+' original sleeve/costume');overlayPixels++;
   }
  }
  assert.ok(outline.length>10);outlines.set(part.name,outline);
 }
 for(const leg of d.rig.legs){const data=await pixels(dir+leg.paintedPaw+'.png');let bottom=-1;for(let y=0;y<448;y++)for(let x=0;x<480;x++)if(data[(y*480+x)*4+3]>=32)bottom=Math.max(bottom,y);const points=[];for(let x=0;x<480;x++)if(data[(bottom*480+x)*4+3]>=32)points.push([x+.5,bottom+.5]);assert.ok(points.length);soles.push(points);}
 let boneError=0,groundError=0,gripError=0,drift=0,poses=0;
 for(const action of motion.actions)for(let n=0;n<action.frames.length;n++){
  const f=action.frames[n],first=action.frames[0];poses++;
  for(const [name,b]of Object.entries(f.bones))if(!d.softBones?.[name])boneError=Math.max(boneError,Math.abs(distance(b.head,b.tail)-distance(first.bones[name].head,first.bones[name].tail)));
  for(const arm of d.armConstraints)gripError=Math.max(gripError,distance(transform(f.deform[arm.lowerBone],arm.wrist),transform(f.deform[arm.effectorBone],arm.effectorWrist??arm.wrist)));
  for(let li=0;li<2;li++){const leg=d.rig.legs[li],q=(n/60+leg.offset)%1,pq=((n-1)/60+leg.offset)%1,bone='leg-'+li+'-foot';
   if(action.name==='attack'||action.name==='settle-3'||q<=d.motion.walk.stanceFraction)for(const p of soles[li])groundError=Math.max(groundError,Math.abs(transform(f.deform[bone],p)[1]-432));
   if(n&&(action.name==='attack'||q<=d.motion.walk.stanceFraction&&pq<=d.motion.walk.stanceFraction&&q>pq))for(const p of soles[li])drift=Math.max(drift,distance(transform(f.deform[bone],p),transform(action.frames[n-1].deform[bone],p)));
  }
  for(const part of d.parts)for(const p of outlines.get(part.name)){const q=transform(f.deform[part.bone],p);q[0]-=f.bones.root.head[0]-d.rig.root[0];assert.ok(q[0]>=0&&q[0]<=480&&q[1]>=0&&q[1]<=448,JSON.stringify({kind,action:action.name,frame:n+1,part:part.name,q}));}
 }
 for(const [metric,value]of Object.entries({boneError,groundError,gripError,drift}))assert.ok(value<.001,JSON.stringify({kind,metric,value}));
 const matrix=(raw,bone)=>raw[atlas.parts.findIndex(p=>p.bone===bone)];let dense=0,minMargin=Infinity,previous;
 function checkArms(raw){
  // Source paint ownership independently identifies the pelvis as hip owner.
  assert.ok(d.parts.some(p=>p.bone==='pelvis'&&d.lowerLayers.includes(p.name)));
  for(let li=0;li<d.rig.legs.length;li++){
   const leg=d.rig.legs[li],upper=matrix(raw,'leg-'+li+'-upper'),lower=matrix(raw,'leg-'+li+'-lower'),foot=matrix(raw,'leg-'+li+'-foot');
   const hip=transform(matrix(raw,'pelvis'),leg.hip),knee=transform(upper,leg.knee),ankle=transform(foot,leg.ankle),a=distance(leg.hip,leg.knee),b=distance(leg.knee,leg.ankle),gap=distance(hip,ankle);
   minMargin=Math.min(minMargin,gap-Math.abs(a-b),a+b-gap);
   assert.ok(gap>Math.abs(a-b)+.001&&gap<a+b-.001,'Leg stays within fixed reach without fallback');
   assert.ok(distance(transform(upper,leg.hip),hip)<.001,'Hip remains in the painted pelvis');
   assert.ok(distance(knee,transform(lower,leg.knee))<.001,'Knee joins its thigh and calf');
   assert.ok(distance(transform(lower,leg.ankle),ankle)<.001,'Calf remains joined to the held boot');
   const forwardBend=(ankle[0]-hip[0])*(knee[1]-hip[1])-(ankle[1]-hip[1])*(knee[0]-hip[0]);assert.ok(forwardBend<-.001,'Both knees bend toward travel in source-facing coordinates');
  }
  for(const part of atlas.parts)for(const p of outlines.get(part.name)){const q=transform(matrix(raw,part.bone),p);assert.ok(q[0]>=0&&q[0]<=480&&q[1]>=0&&q[1]<=448,JSON.stringify({kind,dense,part:part.name,q}));}

  for(const [bone,range]of Object.entries(d.softBones??{})){
   const m=matrix(raw,bone),sx=Math.hypot(m[0],m[1]),sy=Math.hypot(m[2],m[3]);
   assert.ok(sx>=range.minScale-.0001&&sy>=range.minScale-.0001&&sx<=range.maxScale+.0001&&sy<=range.maxScale+.0001,'Only the authored soft throat volume expands');
   assert.ok(m[0]*m[3]-m[1]*m[2]>0&&Math.abs(m[0]*m[2]+m[1]*m[3])<.0001,'Soft volume cannot shear or invert');
   const extra=d.rig.extras.find(e=>e.name===bone);
   assert.ok(distance(transform(m,extra.a),transform(matrix(raw,extra.parent),extra.a))<.001,'Soft throat stays attached to the neck');
  }
  assert.ok(distance(transform(matrix(raw,'head'),d.rig.head[0]),transform(matrix(raw,'spine'),d.rig.head[0]))<.001,'Head stays on the original neck');
  const fin=d.rig.extras.find(e=>e.name==='back-fin');if(fin)assert.ok(distance(transform(matrix(raw,fin.name),fin.a),transform(matrix(raw,'spine'),fin.a))<.001,'Fin stays attached to its original thorax');
  const jaw=d.rig.extras.find(e=>e.name==='jaw');
  if(jaw)assert.ok(distance(transform(matrix(raw,'jaw'),jaw.a),transform(matrix(raw,'head'),jaw.a))<.001,'Jaw hinge stays on the same head during mouth opening');
  for(const part of atlas.parts)if(!d.softBones?.[part.bone]){const m=matrix(raw,part.bone);assert.ok(Math.abs(m[0]*m[3]-m[1]*m[2]-1)<.0001,'Head, torso and all limbs stay rigid');}
  for(const arm of d.armConstraints){
  const upper=matrix(raw,arm.upperBone),lower=matrix(raw,arm.lowerBone),parent=matrix(raw,arm.parentBone),effector=matrix(raw,arm.effectorBone),target=transform(effector,arm.effectorWrist??arm.wrist);
  const len=distance(transform(parent,arm.shoulder),target),a=distance(arm.shoulder,arm.elbow),b=distance(arm.elbow,arm.wrist);minMargin=Math.min(minMargin,len-Math.abs(a-b),a+b-len);assert.ok(len>Math.abs(a-b)+.0001&&len<a+b-.0001,JSON.stringify({kind,arm:arm.upperBone,len,reach:a+b}));
  assert.ok(distance(transform(upper,arm.shoulder),transform(parent,arm.shoulder))<.001);assert.ok(distance(transform(upper,arm.elbow),transform(lower,arm.elbow))<.001);assert.ok(distance(transform(lower,arm.wrist),target)<.001,'Painted holding hand and wrist stay attached');
 }}
 for(let n=0;n<=600;n++)for(const settle of [0,.5,1]){
  const phase=n/600,raw=record(kind,v177JointPose(kind,{requestedState:'move'},{locomotionPhase:phase,locomotionSettle:settle}));checkArms(raw);dense++;
  if(settle===0){if(previous)for(let li=0;li<2;li++){const leg=d.rig.legs[li],q=(phase+leg.offset)%1,pq=(previous.phase+leg.offset)%1;
   if(q>1/30&&q<d.motion.walk.stanceFraction-1/30&&q>pq&&pq>1/30){const p=[leg.ankle[0],leg.ankle[1]+432-leg.groundAnkleY],a=transform(matrix(raw,'leg-'+li+'-foot'),p),b=transform(matrix(previous.raw,'leg-'+li+'-foot'),p);assert.ok(Math.abs(a[1]-432)<.001);assert.ok(Math.abs(a[0]+phase*atlas.cycleDistance-b[0]-previous.phase*atlas.cycleDistance)<.001);}}
   previous={phase,raw};}
 }
 const runtime={locomotionPhase:.1371,locomotionSettle:1},idle=record(kind,v177JointPose(kind,{requestedState:'idle'},runtime));
 for(const state of ['wind-up','active','recovery'])for(let n=0;n<=60;n++){const raw=record(kind,v177JointPose(kind,{requestedState:state,clipProgress:n/60},runtime));checkArms(raw);dense++;for(let i=0;i<raw.length;i++)if(atlas.parts[i].bone.endsWith('-foot'))assert.deepEqual(raw[i],idle[i]);
  if(state==='wind-up'&&n===0||state==='recovery'&&n===60)for(const arm of d.armConstraints)assert.ok(distance(transform(matrix(raw,arm.effectorBone),arm.effectorWrist??arm.wrist),transform(matrix(idle,arm.effectorBone),arm.effectorWrist??arm.wrist))<.001,'No attack handover jump');}
 for(const part of d.parts)if(!part.bone.endsWith('-foot')){const data=await pixels(dir+part.file);for(const leg of d.rig.legs){const foot=d.parts.find(p=>p.name===leg.paintedPaw);for(let y=0;y<448;y++)for(let x=0;x<480;x++)if(y>leg.ankle[1]+20&&inside([x+.5,y+.5],foot.polygon)&&edge([x+.5,y+.5],foot.polygon)>1.5)assert.equal(data[(y*480+x)*4+3],0,'Only the matching foot bone may retain the original claw-foot below its hock attachment cap');}}
 const weapon=await pixels(dir+('head')+'.png'),[mx,my]=atlas.muzzle;assert.ok(weapon[(my*480+mx)*4+3]>=32,JSON.stringify({kind,muzzle:atlas.muzzle,alpha:weapon[(my*480+mx)*4+3]}));
 assert.equal(d.rig.legs.length,2);assert.equal(d.rig.arms.length,2);assert.equal(d.rig.weapons.length,0);assert.ok(originalPixels>1000&&overlayPixels>1000);
 for(const [pose,binding]of Object.entries(d.poseBindings)){assert.equal(hash(await readFile(dir+binding.file)),binding.sha256);assert.equal(hash(await readFile('public'+binding.path)),binding.sourceSha256);const frame=spriteFrameFor(kind,pose,'right');assert.equal(frame.path,binding.path);assert.deepEqual(frame.sourceRect,binding.sourceRect);assert.deepEqual(frame.drawSlices,binding.drawSlices);}
 assert.equal(poses,305);assert.equal(dense,1986);assert.ok(minMargin>4);assert.ok(originalPixels>10000&&overlayPixels>24000);
 assert.equal(d.parts.length,16);assert.equal(d.weaponBone,'head');assert.deepEqual(d.muzzle,[306,82]);
 assert.deepEqual(d.parentAttachments.head,{parent:'spine',pivot:[286,145]});assert.deepEqual(d.parentAttachments['back-fin'],{parent:'spine',pivot:[219,155]});
 for(const name of ['head','back-fin','near-hand','far-hand','near-foot','far-foot'])assert.ok(d.parts.find(p=>p.name===name).original);
 assert.equal(hash(await readFile(dir+'hidden-parts-study.png')),d.sheetSha256);
 assert.equal(v177JointPose(kind,{requestedState:'active'},{},{ownedPose:true}),null,'Preserve the separate authored ability owner');
 for(const state of ['hit','death','collapse','transform'])assert.equal(v177JointPose(kind,{requestedState:state},{}),null);
});
test('Kurome eye emission and soles share mirrored coordinates and enemy-only conditional loading',async()=>{
 for(const kind of ['kurome']){
  const atlas=V177_JOINT_ATLASES[kind],d=JSON.parse(await readFile('assets/source/v100/joints/'+kind+'-r1/parts.json'));
  const bytes=await readFile('public'+atlas.path),expected=V177_JOINT_ASSET_ADDITIONS.find(a=>a.path===atlas.path),meta=await sharp(bytes).metadata();
  assert.equal(bytes.length,expected.bytes);assert.equal('sha256-'+hash(bytes),expected.hash);assert.equal(meta.width*meta.height*4,atlas.decodedBytes);assert.ok(atlas.decodedBytes<=512*1024);
  for(const [pose,binding]of Object.entries(d.poseBindings)){const frame=spriteFrameFor(kind,pose,'right');assert.equal(frame.path,binding.path);assert.deepEqual(frame.sourceRect,binding.sourceRect);assert.deepEqual(frame.drawSlices,binding.drawSlices);}
  for(const direction of ['left','right'])for(const scale of [.12,.2]){
   let m=[1,0,0,1,300,500];const stack=[],calls=[];const mul=b=>{const a=m;m=[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];};
   const ctx={save(){stack.push([...m]);},restore(){m=stack.pop();},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},translate(x,y){mul([1,0,0,1,x,y]);},scale(x,y){mul([x,0,0,y,0,0]);},transform(...a){mul(a);},drawImage(){calls.push([...m]);}};
   if(direction==='left')ctx.scale(-1,1);const frame={...spriteFrameFor(kind,'walk-a',direction),flipX:direction==='left'},size={w:atlas.referenceFrame.width*scale,h:atlas.referenceFrame.height*scale},plan=v177JointPose(kind,{requestedState:'active',clipProgress:.26},{locomotionPhase:.1371,locomotionSettle:1});
   assert.ok(drawV177JointPose(ctx,{naturalWidth:512},kind,plan,-size.w*frame.anchorX,-size.h*frame.anchorY,size.w,size.h));assert.equal(calls.length,d.parts.length);
   const contact=transform(calls[atlas.parts.findIndex(p=>p.name==='head')],atlas.muzzle),socket=v177RenderedJointWeaponSocket({kind,plan,direction,frame,size,pose:{offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotationRadians:0},x:300,y:500});assert.ok(distance(contact,[socket.x,socket.y])<1e-10);
   for(const leg of d.rig.legs){const p=[leg.ankle[0],leg.ankle[1]+432-leg.groundAnkleY],matrix=calls[atlas.parts.findIndex(p=>p.name===leg.paintedPaw)];assert.ok(Math.abs(transform(matrix,p)[1]-500)<.001);}
  }
  const input={stageId:CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET,formationKinds:['ranger'],enemyKinds:[kind,kind]};const plan=requiredBattleAssetPlan(input);
  assert.equal(plan.paths.filter(p=>p===atlas.path).length,1);assert.equal(plan.persistent.filter(p=>p.key===atlas.key).length,1);
  assert.ok(!requiredBattleAssetPlan({...input,enemyKinds:[]}).paths.includes(atlas.path));assert.ok(!requiredBattleAssetPlan({...input,includeV100Sprites:false}).paths.includes(atlas.path));
 }
});
