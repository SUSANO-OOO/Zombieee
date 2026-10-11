import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import {spriteFrameFor} from '../app/spriteManifest.js';
import {v100HumanWalkFrame} from '../app/v100HumanWalk.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {CAMPAIGN_STAGE_IDS} from '../app/campaign.js';
import {V177_JOINT_ASSET_ADDITIONS} from '../scripts/v177-joint-asset-contract.mjs';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose,v177RenderedJointWeaponSocket} from '../app/v177JointPresentation.js';
const kind='ooguchi',dir='assets/source/v100/joints/ooguchi-r1/',atlas=V177_JOINT_ATLASES[kind];
const hash=b=>createHash('sha256').update(b).digest('hex'),transform=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]],dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function inside([x,y],polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const[a,b]=polygon[i],[c,d]=polygon[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;}return hit;}
function edgeDistance(p,poly){let best=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));best=Math.min(best,dist(p,[a[0]+t*dx,a[1]+t*dy]));}return best;}
test('Ooguchi original four legs retain ground contact, fixed reach and attached mandibles through dense runtime interpolation',async()=>{
const d=JSON.parse(await readFile(dir+'parts.json')),motion=JSON.parse(gunzipSync(await readFile(dir+'motion.json.gz')));
assert.equal(d.rig.legs.length,4);assert.equal(d.rig.arms.length,0);assert.equal(d.rig.weapons.length,0);
const soles=[],outlines=new Map();let originalPixels=0,overlayPixels=0,boneError=0,groundError=0,stanceDrift=0,hingeError=0,minReach=Infinity,dense=0,minSupports=4,maxPaintGround=0;
for(const part of d.parts){
 const b=await readFile(dir+part.file);assert.equal(hash(b),part.sha256);const raw=await sharp(b).ensureAlpha().raw().toBuffer(),ref=await sharp(dir+'identity-reference.png').ensureAlpha().raw().toBuffer(),edge=[];
 for(let y=0;y<448;y++)for(let x=0;x<480;x++){const n=(y*480+x)*4;if(raw[n+3]<32)continue;if(part.original&&raw[n+3]===255){assert.deepEqual(raw.subarray(n,n+4),ref.subarray(n,n+4));originalPixels++;}if(x===0||x===479||y===0||y===447||[-480,480,-1,1].some(o=>raw[n+o*4+3]<32))edge.push([x+.5,y+.5]);}
 outlines.set(part.name,edge);
 if(part.originalRegions)for(let y=0;y<448;y++)for(let x=0;x<480;x++){const n=(y*480+x)*4,p=[x+.5,y+.5];if(ref[n+3]<32||!inside(p,part.generatedSilhouette)||edgeDistance(p,part.generatedSilhouette)<=1.5||!part.originalRegions.some(poly=>inside(p,poly)&&edgeDistance(p,poly)>1.5)||(part.excludedRegions??[]).some(poly=>inside(p,poly)||edgeDistance(p,poly)<=1.5))continue;assert.deepEqual(raw.subarray(n,n+4),ref.subarray(n,n+4),part.name+' retains visible original RGBA');overlayPixels++;}
}
assert.ok(overlayPixels>2000,'Visible limbs and torso retain original surface paint');
for(const binding of Object.values(d.poseBindings)){assert.equal(hash(await readFile(dir+binding.file)),binding.sha256);assert.equal(hash(await readFile('public'+binding.path)),binding.sourceSha256);}
for(const l of d.rig.legs){const raw=await sharp(dir+l.paintedPaw+'.png').ensureAlpha().raw().toBuffer();let bottom=-1;for(let y=0;y<448;y++)for(let x=0;x<480;x++)if(raw[(y*480+x)*4+3]>=32)bottom=Math.max(bottom,y);const a=[];for(let x=0;x<480;x++)if(raw[(bottom*480+x)*4+3]>=32)a.push([x+.5,bottom+.5]);assert.ok(a.length>=2);soles.push(a);}
for(const a of motion.actions)for(let n=0;n<a.frames.length;n++){const f=a.frames[n],first=a.frames[0];for(const [name,b]of Object.entries(f.bones))boneError=Math.max(boneError,Math.abs(dist(b.head,b.tail)-dist(first.bones[name].head,first.bones[name].tail)));for(let i=0;i<4;i++){const l=d.rig.legs[i],q=(n/60+l.offset)%1;if(a.name==='attack'||a.name==='settle-3'||q<=d.motion.walk.stanceFraction)for(const p of soles[i])groundError=Math.max(groundError,Math.abs(transform(f.deform['leg-'+i+'-foot'],p)[1]-432));}}
function matrices(plan){const raw=[];const ctx={save(){},restore(){},translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},transform(...m){raw.push(m);},drawImage(){}};assert.ok(drawV177JointPose(ctx,{naturalWidth:512},kind,plan,0,0,480,448));assert.equal(raw.length,d.parts.length);return raw;}
function matrix(raw,bone){return raw[atlas.parts.findIndex(p=>p.bone===bone)];}
function check(raw){
 for(const c of d.legConstraints){const parent=matrix(raw,c.parentBone),u=matrix(raw,c.upperBone),l=matrix(raw,c.lowerBone),foot=matrix(raw,c.effectorBone),hip=transform(parent,c.hip),ankle=transform(foot,c.ankle),len=dist(hip,ankle),a=dist(c.hip,c.knee),b=dist(c.knee,c.ankle);minReach=Math.min(minReach,len-Math.abs(a-b),a+b-len);assert.ok(len>Math.abs(a-b)+.0001&&len<a+b-.0001,c.upperBone+' reach');boneError=Math.max(boneError,dist(transform(u,c.hip),hip),dist(transform(u,c.knee),transform(l,c.knee)),dist(transform(l,c.ankle),ankle));}
 for(const [bone,c]of Object.entries(d.parentAttachments)){hingeError=Math.max(hingeError,dist(transform(matrix(raw,bone),c.pivot),transform(matrix(raw,c.parent),c.pivot)));}
 for(let i=0;i<raw.length;i++)for(const p of outlines.get(atlas.parts[i].name)){const q=transform(raw[i],p);assert.ok(q[0]>=-.001&&q[0]<=480.001&&q[1]>=-.001&&q[1]<=448.001,atlas.parts[i].name+' canvas bounds');if(atlas.parts[i].name.endsWith('-paw'))maxPaintGround=Math.max(maxPaintGround,q[1]-432);}
 dense++;
}
let previous;
for(let n=0;n<=600;n++)for(const settle of [0,.5,1]){
 const phase=n/600,raw=matrices(v177JointPose(kind,{requestedState:'move'},{locomotionPhase:phase,locomotionSettle:settle}));check(raw);

 for(let i=0;i<4;i++){const l=d.rig.legs[i],q=(phase+l.offset)%1;const foot=matrix(raw,'leg-'+i+'-foot');if(settle===1||q>1/30&&q<d.motion.walk.stanceFraction-1/30){for(const p of soles[i])groundError=Math.max(groundError,Math.abs(transform(foot,p)[1]-432));}
 if(settle===0&&previous){const pq=(previous.phase+l.offset)%1;if(q>1/30&&q<d.motion.walk.stanceFraction-1/30&&pq>1/30&&q>pq){for(const p of soles[i]){const a=transform(foot,p),b=transform(matrix(previous.raw,'leg-'+i+'-foot'),p);stanceDrift=Math.max(stanceDrift,Math.abs(a[0]+phase*atlas.cycleDistance-b[0]-previous.phase*atlas.cycleDistance));}}}}
 if(settle===0){minSupports=Math.min(minSupports,d.rig.legs.filter(l=>(phase+l.offset)%1<=d.motion.walk.stanceFraction).length);previous={phase,raw};}
}
const runtime={locomotionPhase:.1371,locomotionSettle:1},idle=matrices(v177JointPose(kind,{requestedState:'idle'},runtime));
for(const state of ['wind-up','active','recovery'])for(let n=0;n<=60;n++){const raw=matrices(v177JointPose(kind,{requestedState:state,clipProgress:n/60},runtime));check(raw);for(let i=0;i<4;i++){const foot=matrix(raw,'leg-'+i+'-foot');assert.deepEqual(foot,matrix(idle,'leg-'+i+'-foot'));for(const p of soles[i])groundError=Math.max(groundError,Math.abs(transform(foot,p)[1]-432));}if(state==='wind-up'&&n===0||state==='recovery'&&n===60)for(const name of ['spine','head','jaw'])assert.ok(dist(transform(matrix(raw,name),d.interpolationPivots[name]??d.rig.spine[0]),transform(matrix(idle,name),d.interpolationPivots[name]??d.rig.spine[0]))<.001,'continuous entry/recovery');}
const jaw=await sharp(dir+'jaw.png').ensureAlpha().raw().toBuffer();assert.ok(jaw[(d.muzzle[1]*480+d.muzzle[0])*4+3]>=32,'Muzzle on original jaw paint');
assert.ok(originalPixels>20000);assert.ok(minSupports>=3);for(const [key,value]of Object.entries({boneError,groundError,stanceDrift,hingeError,maxPaintGround}))assert.ok(value<.001,key+' '+value);
assert.equal(dense,1986);assert.ok(minReach>6);assert.equal(atlas.poses.length,151);for(const state of ['hit','death','collapse','transform'])assert.equal(v177JointPose(kind,{requestedState:state},runtime),null);assert.equal(v177JointPose(kind,{requestedState:'active'},runtime,{ownedPose:true}),null);
});
test('Ooguchi jaw contact and four claws share mirrored coordinates and enemy-only conditional loading',async()=>{
 for(const kind of ['ooguchi']){
  const atlas=V177_JOINT_ATLASES[kind],d=JSON.parse(await readFile('assets/source/v100/joints/'+kind+'-r1/parts.json'));
  const bytes=await readFile('public'+atlas.path),expected=V177_JOINT_ASSET_ADDITIONS.find(a=>a.path===atlas.path),meta=await sharp(bytes).metadata();
  assert.equal(bytes.length,expected.bytes);assert.equal('sha256-'+hash(bytes),expected.hash);assert.equal(meta.width*meta.height*4,atlas.decodedBytes);assert.ok(atlas.decodedBytes<=512*1024);
  for(const pose of ['idle','walk-a','attack-a','attack-b']){const binding=d.poseBindings[pose],frame=spriteFrameFor(kind,pose,'right');assert.equal(frame.path,binding.path);assert.deepEqual(frame.sourceRect,binding.sourceRect);assert.equal(frame.flipX,false);}
  for(const direction of ['left','right'])for(const scale of [.12,.2]){
   let m=[1,0,0,1,300,500];const stack=[],calls=[];const mul=b=>{const a=m;m=[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];};
   const ctx={save(){stack.push([...m]);},restore(){m=stack.pop();},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},translate(x,y){mul([1,0,0,1,x,y]);},scale(x,y){mul([x,0,0,y,0,0]);},transform(...a){mul(a);},drawImage(){calls.push([...m]);}};
   const frame=v100HumanWalkFrame(spriteFrameFor(kind,'walk-a','right'),direction);assert.equal(frame.flipX,direction==='left');if(frame.flipX)ctx.scale(-1,1);const size={w:atlas.referenceFrame.width*scale,h:atlas.referenceFrame.height*scale},plan=v177JointPose(kind,{requestedState:'active',clipProgress:.26},{locomotionPhase:.1371,locomotionSettle:1});
   assert.ok(drawV177JointPose(ctx,{naturalWidth:512},kind,plan,-size.w*frame.anchorX,-size.h*frame.anchorY,size.w,size.h));assert.equal(calls.length,d.parts.length);
   const contact=transform(calls[atlas.parts.findIndex(p=>p.name==='jaw')],atlas.muzzle),socket=v177RenderedJointWeaponSocket({kind,plan,direction,frame,size,pose:{offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotationRadians:0},x:300,y:500});assert.ok(Math.hypot(contact[0]-socket.x,contact[1]-socket.y)<1e-10);
   for(const leg of d.rig.legs){const p=[leg.ankle[0],leg.ankle[1]+432-leg.groundAnkleY],matrix=calls[atlas.parts.findIndex(p=>p.name===leg.paintedPaw)];assert.ok(Math.abs(transform(matrix,p)[1]-500)<.001);}
  }
  const input={stageId:CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET,formationKinds:['ranger'],enemyKinds:[kind,kind]};const plan=requiredBattleAssetPlan(input);
  assert.equal(plan.paths.filter(p=>p===atlas.path).length,1);assert.equal(plan.persistent.filter(p=>p.key===atlas.key).length,1);
  assert.ok(!requiredBattleAssetPlan({...input,enemyKinds:[]}).paths.includes(atlas.path));assert.ok(!requiredBattleAssetPlan({...input,includeV100Sprites:false}).paths.includes(atlas.path));
 }
});
