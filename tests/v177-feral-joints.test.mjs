import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose,v177RenderedJointWeaponSocket,v177JointCycleDistance} from '../app/v177JointPresentation.js';
import {mayoBattleRenderKind} from '../app/mayoLifecycle.js';
import {advanceCombatAnimationRuntime,createCombatAnimationRuntime,sampleAnimationClip} from '../app/combatPresentation.js';
import {spriteFrameFor} from '../app/spriteManifest.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {CAMPAIGN_STAGE_IDS} from '../app/campaign.js';
import {V177_JOINT_ASSET_ADDITIONS} from '../scripts/v177-joint-asset-contract.mjs';
import {validateJointTransform} from '../scripts/build-v177-rigid-joint-atlas.mjs';
import {jointLegacyInterpolationControlDigest} from './helpers/v177-render-trace.mjs';
const revision='frozen-r1',kind='mayo-chan-feral',dir='assets/source/v100/joints/mayo-feral-r1/';
const d=JSON.parse(await readFile(dir+'parts.json')),motion=JSON.parse(gunzipSync(await readFile(dir+'motion.json.gz'))),atlas=V177_JOINT_ATLASES[kind];
assert.deepEqual(motion.rig,d.rig);

test('Feral original RGBA, four soles, complete hidden fur and evaluated anatomy remain intact',async()=>{
const W=d.width,H=d.height,hash=b=>createHash('sha256').update(b).digest('hex');
const transform=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]],distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const pixels=async file=>sharp(await readFile(file)).ensureAlpha().raw().toBuffer();
function inside([x,y],polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const[a,b]=polygon[i],[c,e]=polygon[j];if((b>y)!==(e>y)&&x<(c-a)*(y-b)/(e-b)+a)hit=!hit;}return hit;}
function edge(p,poly){let best=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));best=Math.min(best,distance(p,[a[0]+t*dx,a[1]+t*dy]));}return best;}
const outlines=new Map(),partPixels=new Map(),references=new Map(),solePoints=[];
const report={revision,connected:true,originalPixels:0,originalByPart:{},sourceFrames:0,runtimeSamples:0,sourceBoneError:0,sourceGroundError:0,sourceWorldFootDrift:0,runtimeGroundError:0,runtimeWorldFootDrift:0,hiddenFurMinimumCenterAlpha:255,sourceBounds:{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity,outside:[]},runtimeBounds:{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity,outside:[]},decodedBytes:atlas.decodedBytes,budgetBytes:512*1024};
for(const part of d.parts){const bytes=await readFile(dir+part.file),data=await pixels(dir+part.file);assert.equal(hash(bytes),part.sha256);assert.equal(data.length,W*H*4);partPixels.set(part.name,data);let count=0;const outline=[];
 const referenceName=part.originalReference??'identity-reference.png';if(!references.has(referenceName))references.set(referenceName,await pixels(dir+referenceName));const reference=references.get(referenceName),[ox,oy]=part.sourceOffset??[0,0];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,p=[x+.5,y+.5];
  if(data[i+3]>=32&&(x===0||x===W-1||y===0||y===H-1||[-W,W,-1,1].some(n=>data[i+n*4+3]<32)))outline.push(p);
  const sx=x-ox,sy=y-oy,j=(sy*W+sx)*4;
  if(part.original&&sx>=0&&sx<W&&sy>=0&&sy<H&&reference[j+3]>=32&&inside(p,part.polygon)&&edge(p,part.polygon)>1.5&&!(part.excludedRegions??[]).some(poly=>inside(p,poly)||edge(p,poly)<=1.5)){
   assert.deepEqual(data.subarray(i,i+4),reference.subarray(j,j+4),part.name+' exact original RGBA');count++;}
 }
 assert.ok(outline.length>4,part.name+' nonempty source');outlines.set(part.name,outline);report.originalPixels+=count;if(part.original)report.originalByPart[part.name]=count;
 const fur=part.hiddenCompletion;if(fur?.method==='explicit-curved-fur-centerline-rectification')for(let n=0;n<=50;n++){const t=n/50,x=Math.round(fur.A[0]+(fur.B[0]-fur.A[0])*t),y=Math.round(fur.A[1]+(fur.B[1]-fur.A[1])*t);report.hiddenFurMinimumCenterAlpha=Math.min(report.hiddenFurMinimumCenterAlpha,data[(y*W+x)*4+3]);}
}
for(const l of d.rig.legs){const data=partPixels.get(l.paintedPaw);let bottom=-1;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(data[(y*W+x)*4+3]>=32)bottom=Math.max(bottom,y);const points=[];for(let x=0;x<W;x++)if(data[(bottom*W+x)*4+3]>=32)points.push([x+.5,bottom+.5]);assert.ok(points.length);solePoints.push(points);}
function bounds(which,m,points,context,dx=0){for(const p of points){const q=transform(m,p);q[0]-=dx;which.minX=Math.min(which.minX,q[0]);which.minY=Math.min(which.minY,q[1]);which.maxX=Math.max(which.maxX,q[0]);which.maxY=Math.max(which.maxY,q[1]);if((q[0]<0||q[0]>480||q[1]<0||q[1]>448)&&which.outside.length<12)which.outside.push({...context,q});}}
for(const action of motion.actions)for(let n=0;n<action.frames.length;n++){const f=action.frames[n],first=action.frames[0];report.sourceFrames++;
 for(const [name,b]of Object.entries(f.bones))if(!d.softBones?.[name])report.sourceBoneError=Math.max(report.sourceBoneError,Math.abs(distance(b.head,b.tail)-distance(first.bones[name].head,first.bones[name].tail)));
 for(let li=0;li<4;li++){const l=d.rig.legs[li],q=(n/60+l.offset)%1,pq=((n-1)/60+l.offset)%1,bone='leg-'+li+'-foot';
  if(action.name==='attack'||action.name==='settle-3'||q<=d.motion.walk.stanceFraction)for(const p of solePoints[li])report.sourceGroundError=Math.max(report.sourceGroundError,Math.abs(transform(f.deform[bone],p)[1]-432));
  if(n&&(action.name==='attack'||q<=d.motion.walk.stanceFraction&&pq<=d.motion.walk.stanceFraction&&q>pq))for(const p of solePoints[li])report.sourceWorldFootDrift=Math.max(report.sourceWorldFootDrift,distance(transform(f.deform[bone],p),transform(action.frames[n-1].deform[bone],p)));
 }
 for(const part of d.parts)bounds(report.sourceBounds,f.deform[part.bone],outlines.get(part.name),{action:action.name,frame:n+1,part:part.name},f.bones.root.head[0]-d.rig.root[0]);
}
function record(plan){const raw=[],ctx={save(){},restore(){},translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},transform(...m){raw.push(m)},drawImage(){}};assert.ok(drawV177JointPose(ctx,{naturalWidth:512},kind,plan,0,0,480,448));return Object.fromEntries(atlas.parts.map((p,i)=>[p.bone,raw[i]]));}
function runtimeBounds(raw,context){report.runtimeSamples++;for(const part of d.parts)bounds(report.runtimeBounds,raw[part.bone],outlines.get(part.name),{...context,part:part.name});}
let previous;
for(let n=0;n<=600;n++)for(const settle of [0,.5,1]){const phase=n/600,raw=record(v177JointPose(kind,{requestedState:'move'},{locomotionPhase:phase,locomotionSettle:settle}));runtimeBounds(raw,{state:'move',phase,settle});
 if(settle===0){for(let li=0;li<4;li++){const l=d.rig.legs[li],q=(phase+l.offset)%1,pq=previous?(previous.phase+l.offset)%1:0,bone='leg-'+li+'-foot';if(q>1/30&&q<d.motion.walk.stanceFraction-1/30&&q>pq&&pq>1/30){for(const p of solePoints[li]){const a=transform(raw[bone],p),b=transform(previous.raw[bone],p);report.runtimeGroundError=Math.max(report.runtimeGroundError,Math.abs(a[1]-432));report.runtimeWorldFootDrift=Math.max(report.runtimeWorldFootDrift,Math.abs(a[0]+phase*atlas.cycleDistance-b[0]-previous.phase*atlas.cycleDistance));}}}previous={phase,raw};}
 if(settle===1)for(let li=0;li<4;li++)for(const p of solePoints[li])report.runtimeGroundError=Math.max(report.runtimeGroundError,Math.abs(transform(raw['leg-'+li+'-foot'],p)[1]-432));
}
const runtime={locomotionPhase:.1371,locomotionSettle:1};
for(const state of ['wind-up','active','recovery'])for(let n=0;n<=60;n++)runtimeBounds(record(v177JointPose(kind,{requestedState:state,clipProgress:n/60},runtime)),{state,clip:n/60});
const weapon=partPixels.get(d.muzzleSourcePart),[mx,my]=d.muzzle;report.contactAlpha=weapon[(my*W+mx)*4+3];
report.passed=report.originalPixels>5000&&report.sourceFrames===305&&report.runtimeSamples===1986&&report.hiddenFurMinimumCenterAlpha>=220&&report.contactAlpha>=32&&report.decodedBytes<=report.budgetBytes&&report.sourceBounds.outside.length===0&&report.runtimeBounds.outside.length===0&&['sourceBoneError','sourceGroundError','sourceWorldFootDrift','runtimeGroundError','runtimeWorldFootDrift'].every(k=>report[k]<.001);
assert.equal(report.passed,true,JSON.stringify(report));
});

test('Four rigid feral legs join the moving torso to planted paws at every interpolated pose',()=>{
const transform=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]],distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const record=plan=>{const out=[];const ctx={save(){},restore(){},translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},transform(...m){out.push(m)},drawImage(){}};
 assert.ok(drawV177JointPose(ctx,{naturalWidth:512},kind,plan,0,0,480,448));return Object.fromEntries(atlas.parts.map((p,i)=>[p.bone,out[i]]));};
const summary={revision,productionConnected:true,source:'actual production renderer and frozen dedicated feral source',samples:0,hips:0,knees:0,ankles:0,softHinges:0,minimumReachMargin:Infinity,maximumRigidDetError:0,feetMoveDuringAttack:0,worst:{}};
function maximum(name,value,context){if(value>summary[name]){summary[name]=value;summary.worst[name]={...context,value};}}
function check(raw,context){summary.samples++;
 for(let li=0;li<4;li++){const l=d.rig.legs[li],upper=raw['leg-'+li+'-upper'],lower=raw['leg-'+li+'-lower'],foot=raw['leg-'+li+'-foot'],body=raw.spine;
  maximum('hips',distance(transform(upper,l.hip),transform(body,l.hip)),{...context,li});
  maximum('knees',distance(transform(upper,l.knee),transform(lower,l.knee)),{...context,li});
  maximum('ankles',distance(transform(lower,l.ankle),transform(foot,l.ankle)),{...context,li});
  const a=distance(l.hip,l.knee),b=distance(l.knee,l.ankle),gap=distance(transform(body,l.hip),transform(foot,l.ankle));
  summary.minimumReachMargin=Math.min(summary.minimumReachMargin,gap-Math.abs(a-b),a+b-gap);
 }
 for(const [bone,m]of Object.entries(raw)){if(!d.softBones?.[bone])maximum('maximumRigidDetError',Math.abs(m[0]*m[3]-m[1]*m[2]-1),{...context,bone});
  const attachment=d.parentAttachments?.[bone];if(attachment)maximum('softHinges',distance(transform(m,attachment.pivot),transform(raw[attachment.parent],attachment.pivot)),{...context,bone});}
}
for(let n=0;n<=600;n++)for(const settle of [0,.5,1]){const runtime={locomotionPhase:n/600,locomotionSettle:settle},plan=v177JointPose(kind,{requestedState:'move'},runtime);check(record(plan),{state:'move',phase:n/600,settle});}
for(let p=0;p<12;p++)for(const settle of [0,1]){const runtime={locomotionPhase:(p+.1371)/12,locomotionSettle:settle},idle=record(v177JointPose(kind,{requestedState:'idle'},runtime));
 for(const state of ['wind-up','active','recovery'])for(let n=0;n<=60;n++){const raw=record(v177JointPose(kind,{requestedState:state,clipProgress:n/60},runtime));check(raw,{state,clip:n/60,phase:runtime.locomotionPhase,settle});
  for(let li=0;li<4;li++){const bone='leg-'+li+'-foot';maximum('feetMoveDuringAttack',distance(transform(raw[bone],d.rig.legs[li].ankle),transform(idle[bone],d.rig.legs[li].ankle)),{state,clip:n/60,li});}}
}
summary.passed=summary.hips<.001&&summary.knees<.001&&summary.ankles<.001&&summary.softHinges<.001&&summary.minimumReachMargin>.001&&summary.maximumRigidDetError<.0001&&summary.feetMoveDuringAttack<.001;
assert.equal(summary.passed,true,JSON.stringify(summary));assert.equal(summary.samples,6195);
});

function feralMatrices(plan){
 const raw=[],ctx={save(){},restore(){},translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},transform(...m){raw.push(m)},drawImage(){}};
 assert.ok(drawV177JointPose(ctx,{naturalWidth:512},kind,plan,0,0,480,448));return Object.fromEntries(atlas.parts.map((p,i)=>[p.bone,raw[i]]));
}
const point=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]],gap=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
test('Source-bound feral petals fold and reopen on the same rigid head and visible mirrored contact',()=>{
 const runtime={locomotionPhase:.1371,locomotionSettle:1},sample=(state,p)=>feralMatrices(v177JointPose(kind,{requestedState:state,clipProgress:p},runtime));
 const rest=sample('idle',0),active=sample('active',.3),returned=sample('recovery',1);
 for(const name of ['mouth-core','mouth-petal-0','mouth-petal-1','mouth-petal-2','mouth-petal-3']){
  assert.ok(Math.abs(Math.hypot(...rest[name].slice(0,2))-.03)<.00001);
  assert.ok(Math.abs(Math.hypot(...active[name].slice(0,2))-.68)<.00001);
  assert.ok(Math.abs(Math.hypot(...returned[name].slice(0,2))-.03)<.00001);
  const extra=d.rig.extras.find(e=>e.name===name);
  for(const raw of [rest,active,returned])assert.ok(gap(point(raw[name],extra.a),point(raw.head,extra.a))<.001);
 }
 assert.ok(Math.abs(Math.hypot(...rest['idle-mouth'].slice(0,2))-1)<.00001);
 assert.ok(Math.abs(Math.hypot(...active['idle-mouth'].slice(0,2))-.12)<.00001);
 const scale=n=>[n,0,0,n,0,0];
 for(const n of [.03,.3,.68])assert.doesNotThrow(()=>validateJointTransform(d,'mouth-petal-0',scale(n)));
 for(const n of [.02,.69])assert.throws(()=>validateJointTransform(d,'mouth-petal-0',scale(n)));
 for(const m of [[-.3,0,0,.3,0,0],[.3,.1,.1,.3,0,0]])assert.throws(()=>validateJointTransform(d,'mouth-petal-0',m));
 for(const bone of ['head','spine','leg-0-upper','leg-3-foot'])assert.throws(()=>validateJointTransform(d,bone,scale(.5)));
 for(const state of ['wind-up','active','recovery'])for(const clip of [.1371,.5,1])for(const direction of ['left','right']){
  const plan=v177JointPose(kind,{requestedState:state,clipProgress:clip},runtime),calls=[],stack=[];let m=[1,0,0,1,0,0];
  const mul=n=>{const[a,b,c,e,f,g]=m,[h,i,j,k,l,o]=n;m=[a*h+c*i,b*h+e*i,a*j+c*k,b*j+e*k,a*l+c*o+f,b*l+e*o+g];};
  const ctx={save(){stack.push([...m])},restore(){m=stack.pop()},translate(x,y){mul([1,0,0,1,x,y])},scale(x,y){mul([x,0,0,y,0,0])},transform(...a){mul(a)},drawImage(){calls.push([...m])}};
  const frame={...spriteFrameFor(kind,'walk-a',direction),flipX:direction==='left'},size={w:192,h:179.2};
  ctx.save();ctx.translate(300,500);if(direction==='left')ctx.scale(-1,1);
  drawV177JointPose(ctx,{naturalWidth:512},kind,plan,-frame.anchorX*size.w,-frame.anchorY*size.h,size.w,size.h);ctx.restore();
  const painted=point(calls[atlas.parts.findIndex(p=>p.bone===atlas.weaponBone)],atlas.muzzle);
  const socket=v177RenderedJointWeaponSocket({kind,plan,direction,frame,size,pose:{offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotationRadians:0},x:300,y:500});
  assert.ok(gap(painted,[socket.x,socket.y])<1e-10,'Contact follows the actual drawn fanged petal');
 }
 assert.equal(v177JointPose(kind,{requestedState:'active'},runtime,{ownedPose:true}),null);
});

test('Feral keeps its own original identity, bounded texture and preload through transformation',async()=>{
 const hash=b=>createHash('sha256').update(b).digest('hex');
 assert.notEqual(atlas,V177_JOINT_ATLASES['mayo-chan']);
 assert.equal(d.identityBinding.sourceSha256,'87e86f2b6fd4dd113da9ebcb939f370afcc63828f488a80752649a38f386555c');
 for(const [pose,binding]of Object.entries(d.poseBindings)){
  const source=await readFile('public'+binding.path);assert.equal(hash(source),binding.sourceSha256);assert.equal(hash(await readFile(dir+binding.file)),binding.sha256);
  const frame=spriteFrameFor(kind,pose,'right');assert.equal(frame.path,binding.path);assert.deepEqual(frame.sourceRect,binding.sourceRect);
  const {x,y,w,h}=binding.sourceRect,original=await sharp(source).extract({left:x,top:y,width:w,height:h}).ensureAlpha().raw().toBuffer(),padded=await sharp(dir+binding.file).ensureAlpha().raw().toBuffer();
  let compared=0;for(let yy=0;yy<448;yy++)for(let xx=0;xx<640;xx++){const i=(yy*640+xx)*4,j=(yy*480+xx)*4;if(xx<480&&original[j+3]===255){assert.deepEqual(padded.subarray(i,i+4),original.subarray(j,j+4));compared++;}if(xx>=480)assert.equal(padded[i+3],0,'Extra source margin is transparent');}assert.ok(compared>10000);
 }
 assert.equal(hash(await readFile(dir+'parts-study-r1.png')),d.sheetSha256);
 const provenance=JSON.parse(await readFile(dir+'generated-parts-provenance.json'));assert.equal(provenance.sha256,d.sheetSha256);
 const bytes=await readFile('public'+atlas.path),expected=V177_JOINT_ASSET_ADDITIONS.find(x=>x.path===atlas.path),meta=await sharp(bytes).metadata();
 assert.equal(bytes.length,expected.bytes);assert.equal('sha256-'+hash(bytes),expected.hash);assert.equal(meta.width*meta.height*4,atlas.decodedBytes);assert.ok(atlas.decodedBytes<=512*1024);
 assert.equal(d.atlasPacking,'height-descending-shelves');
 for(let i=0;i<atlas.parts.length;i++)for(let j=i+1;j<atlas.parts.length;j++){const a=atlas.parts[i].source,b=atlas.parts[j].source;assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'Packed paint regions cannot overlap');}
 const stageId=CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET;
 assert.ok(!requiredBattleAssetPlan({stageId,formationKinds:['scout']}).paths.includes(atlas.path));
 for(const options of [{formationKinds:['mayo-chan']},{formationKinds:['mayo-chan','mayo-chan-feral','mayo-chan']},{enemyKinds:[kind,kind]}]){
  const plan=requiredBattleAssetPlan({stageId,...options});assert.equal(plan.paths.filter(p=>p===atlas.path).length,1,'A present or transformable form preloads once');
 }
 assert.ok(!requiredBattleAssetPlan({stageId,formationKinds:['mayo-chan'],includeV100Sprites:false}).paths.includes(atlas.path));
});

test('Optional leg correction retains the immutable original28 legacy renderer control',()=>{
 const kinds=Object.keys(V177_JOINT_ATLASES).filter(k=>k!==kind);
 assert.deepEqual(jointLegacyInterpolationControlDigest(kinds),{sha256:'3ca7b6f34efc55eca1e7dd7b1c7de43208cce67cda534003040309775713f44b',forms:28,poses:1764,paintCalls:26523,precision:.000001});
});

test('Feral form and actual retreat distance own the same gait without advancing on knockback',()=>{
 assert.equal(mayoBattleRenderKind({kind:'mayo-chan',manualAbility:{phase:'ready'}}),'mayo-chan');
 assert.equal(mayoBattleRenderKind({kind:'mayo-chan',manualAbility:{phase:'feral'}}),kind);
 assert.equal(mayoBattleRenderKind({kind:'mayo-chan',manualAbility:{phase:'ready'},mayoRetreat:{reason:'ability',phase:'run'}}),kind);
 assert.equal(mayoBattleRenderKind({kind:'mayo-chan',mayoRetreat:{reason:'injury',phase:'run'}}),'mayo-chan');
 assert.equal(mayoBattleRenderKind({kind:'walker'}),null);
 const fighter={kind:'mayo-chan',manualAbility:{phase:'feral'}},stride=v177JointCycleDistance(mayoBattleRenderKind(fighter),1);
 assert.notEqual(stride,v177JointCycleDistance('mayo-chan',1));
 let runtime=createCombatAnimationRuntime({deploying:false,direction:'left',x:200,y:0});
 runtime=advanceCombatAnimationRuntime(runtime,{kind:'mayo-chan',state:'retreat',direction:'left',locomotionCycleDistance:stride,x:200-stride*.1,y:0},.016);
 assert.ok(Math.abs(runtime.locomotionPhase-.1)<1e-12);
 const a=feralMatrices(v177JointPose(kind,sampleAnimationClip('mayo-chan','retreat',.1),runtime)),worldA=runtime.lastX;
 runtime=advanceCombatAnimationRuntime(runtime,{kind:'mayo-chan',state:'retreat',direction:'left',locomotionCycleDistance:stride,x:200-stride*.11,y:0},.016);
 assert.ok(Math.abs(runtime.locomotionPhase-.11)<1e-12);assert.ok(Math.abs(runtime.locomotionTravelDistance-stride*.11)<1e-12);
 const b=feralMatrices(v177JointPose(kind,sampleAnimationClip('mayo-chan','retreat',.116),runtime));
 for(const li of [0,3]){const l=d.rig.legs[li],sole=[l.ankle[0],l.ankle[1]+432-l.groundAnkleY],bone='leg-'+li+'-foot';
  assert.ok(Math.abs((worldA-point(a[bone],sole)[0])-(runtime.lastX-point(b[bone],sole)[0]))<.001,'Mirrored retreat paw remains planted in world space');}
 const phase=runtime.locomotionPhase;
 runtime=advanceCombatAnimationRuntime(runtime,{kind:'mayo-chan',state:'hit-heavy',locomotionCycleDistance:stride,x:runtime.lastX-3,y:0},.016);
 assert.equal(runtime.locomotionPhase,phase,'Damage displacement cannot replay a walking step');
});
