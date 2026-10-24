import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {gunzipSync} from 'node:zlib';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {CAMPAIGN_STAGE_IDS} from '../app/campaign.js';
import {V177_JOINT_ASSET_ADDITIONS} from '../scripts/v177-joint-asset-contract.mjs';
import {spriteFrameFor} from '../app/spriteManifest.js';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose,v177RenderedJointWeaponSocket} from '../app/v177JointPresentation.js';
const transform=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]],distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),hash=b=>createHash('sha256').update(b).digest('hex');

test('Mother retains six source-bound feet, lattice openings, tripod support and continuous brood attacks',async()=>{
const kind='mother',dir='assets/source/v100/joints/mother-r1/',atlas=V177_JOINT_ATLASES[kind],d=JSON.parse(await readFile(dir+'parts.json')),motion=JSON.parse(gunzipSync(await readFile(dir+'motion.json.gz')));
const pixels=async f=>sharp(await readFile(f)).ensureAlpha().raw().toBuffer();
function inside([x,y],p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const[a,b]=p[i],[c,e]=p[j];if((b>y)!==(e>y)&&x<(c-a)*(y-b)/(e-b)+a)hit=!hit;}return hit;}
function edge(p,poly){let best=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));best=Math.min(best,distance(p,[a[0]+t*dx,a[1]+t*dy]));}return best;}
const outlines=new Map(),solePoints=[],rawParts=new Map();let originalPixels=0,overlayPixels=0,preservedNegativeAlphaPixels=0,protectedFootPixels=0;
assert.equal(d.rig.legs.length,6);assert.equal(d.rig.arms.length,0);assert.equal(d.rig.weapons.length,0);assert.equal(d.parts.length,23);assert.equal(d.rig.extras.length,3);assert.deepEqual(motion.rig,d.rig);
assert.deepEqual(d.rig.legs.map(l=>l.offset),[0,.5,0,.5,.5,0]);assert.equal(d.motion.walk.spanPx,26);assert.equal(d.motion.walk.stanceFraction,.72);
for(const part of d.parts){
 const bytes=await readFile(dir+part.file),data=await pixels(dir+part.file),reference=await pixels(dir+(part.originalReference??'identity-reference.png'));assert.equal(hash(bytes),part.sha256);rawParts.set(part.name,data);const outline=[];
 for(let y=0;y<448;y++)for(let x=0;x<480;x++){
  const i=(y*480+x)*4,p=[x+.5,y+.5];
  if(data[i+3]>=32&&(x===0||x===479||y===0||y===447||[-480,480,-1,1].some(n=>data[i+n*4+3]<32)))outline.push(p);
  if(part.original){const polys=typeof part.polygon[0][0]==='number'?[part.polygon]:part.polygon;
   if(reference[i+3]>=32&&polys.some(poly=>inside(p,poly)&&edge(p,poly)>1.5)&&!(part.excludedRegions??[]).some(poly=>inside(p,poly)||edge(p,poly)<=1.5)){assert.deepEqual(data.subarray(i,i+4),reference.subarray(i,i+4),part.name+' original RGBA');originalPixels++;}}
  if(part.originalRegions?.some(poly=>inside(p,poly)&&edge(p,poly)>1.5)&&!part.excludedRegions.some(poly=>inside(p,poly)||edge(p,poly)<=1.5)){
   if(reference[i+3]>=32){assert.deepEqual(data.subarray(i,i+4),reference.subarray(i,i+4),part.name+' original overlay RGBA');overlayPixels++;}
   else if(reference[i+3]===0){assert.equal(data[i+3],0,part.name+' original lattice aperture remains transparent');preservedNegativeAlphaPixels++;}
  }
 }
 assert.ok(outline.length>10);outlines.set(part.name,outline);
}
for(const [li,leg]of d.rig.legs.entries()){
 const p=d.parts.find(x=>x.name===leg.paintedPaw),data=rawParts.get(p.name);assert.ok(p.original&&p.bone===`leg-${li}-foot`);
 assert.equal(p.originalReference,li===3?'original-attack-b.png':'identity-reference.png');
 let bottom=-1;for(let y=0;y<448;y++)for(let x=0;x<480;x++)if(data[(y*480+x)*4+3]>=32)bottom=Math.max(bottom,y);
 const sole=[];for(let x=0;x<480;x++)if(data[(bottom*480+x)*4+3]>=32)sole.push([x+.5,bottom+.5]);assert.ok(sole.length);solePoints.push(sole);
 for(let y=Math.ceil(leg.ankle[1]+8);y<448;y++)for(let x=0;x<480;x++){const pt=[x+.5,y+.5];if(inside(pt,p.polygon)&&edge(pt,p.polygon)>1.5){protectedFootPixels++;for(const part of d.parts)if(!part.bone.endsWith('-foot'))assert.equal(rawParts.get(part.name)[(y*480+x)*4+3],0,part.name+' cannot carry another supporting sole');}}
}
assert.ok(originalPixels>1000&&overlayPixels>10000&&preservedNegativeAlphaPixels>500&&protectedFootPixels>50);
let boneError=0,sourceGroundError=0,sourceStanceDrift=0,sourceFrames=0;
for(const action of motion.actions)for(let n=0;n<action.frames.length;n++){
 const f=action.frames[n],first=action.frames[0];sourceFrames++;
 for(const [name,b]of Object.entries(f.bones))boneError=Math.max(boneError,Math.abs(distance(b.head,b.tail)-distance(first.bones[name].head,first.bones[name].tail)));
 for(let li=0;li<6;li++){const l=d.rig.legs[li],q=(n/60+l.offset)%1,pq=((n-1)/60+l.offset)%1,bone=`leg-${li}-foot`;
  if(action.name==='attack'||action.name==='settle-3'||q<=d.motion.walk.stanceFraction)for(const p of solePoints[li])sourceGroundError=Math.max(sourceGroundError,Math.abs(transform(f.deform[bone],p)[1]-432));
  if(n&&(action.name==='attack'||q<=d.motion.walk.stanceFraction&&pq<=d.motion.walk.stanceFraction&&q>pq))for(const p of solePoints[li])sourceStanceDrift=Math.max(sourceStanceDrift,distance(transform(f.deform[bone],p),transform(action.frames[n-1].deform[bone],p)));
 }
 for(const part of d.parts)for(const p of outlines.get(part.name)){const q=transform(f.deform[part.bone],p);q[0]-=f.bones.root.head[0]-d.rig.root[0];assert.ok(q[0]>=0&&q[0]<=480&&q[1]>=0&&q[1]<=448,JSON.stringify({action:action.name,n,part:part.name,q}));}
}
for(const [metric,value]of Object.entries({boneError,sourceGroundError,sourceStanceDrift}))assert.ok(value<.001,JSON.stringify({metric,value}));assert.equal(sourceFrames,305);
function painted(sample,runtime){const matrices=[],ctx={save(){},restore(){},translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},transform(...m){matrices.push(m);},drawImage(){}};assert.ok(drawV177JointPose(ctx,{naturalWidth:512},kind,v177JointPose(kind,sample,runtime),0,0,480,448));return Object.fromEntries(atlas.parts.map((p,i)=>[p.bone,matrices[i]]));}
let minReachMargin=Infinity,dense=0,runtimeJointError=0,runtimeAttachmentError=0,runtimeGroundError=0,runtimeStanceDrift=0,minSupportingFeet=6,previous=null;
function check(raw){
 for(let i=0;i<6;i++){const l=d.rig.legs[i],a=raw[`leg-${i}-upper`],b=raw[`leg-${i}-lower`],foot=raw[`leg-${i}-foot`],hip=transform(raw.spine,l.hip),knee=transform(a,l.knee),ankle=transform(foot,l.ankle),upper=distance(l.hip,l.knee),lower=distance(l.knee,l.ankle),gap=distance(hip,ankle);
  minReachMargin=Math.min(minReachMargin,gap-Math.abs(upper-lower),upper+lower-gap);assert.ok(gap>Math.abs(upper-lower)+.001&&gap<upper+lower-.001,'Fixed six-leg reach, no fallback');
  runtimeJointError=Math.max(runtimeJointError,distance(transform(a,l.hip),hip),distance(knee,transform(b,l.knee)),distance(transform(b,l.ankle),ankle));
  const bend=(ankle[0]-hip[0])*(knee[1]-hip[1])-(ankle[1]-hip[1])*(knee[0]-hip[0]),restBend=(l.ankle[0]-l.hip[0])*(l.knee[1]-l.hip[1])-(l.ankle[1]-l.hip[1])*(l.knee[0]-l.hip[0]);assert.ok(bend*restBend>0,'Each alien knee retains its authored branch');
 }
 for(const [name,c]of Object.entries(d.parentAttachments))runtimeAttachmentError=Math.max(runtimeAttachmentError,distance(transform(raw[name],c.pivot),transform(raw[c.parent],c.pivot)));
 for(const part of atlas.parts){const m=raw[part.bone];assert.ok(m.length===6&&m.every(Number.isFinite));assert.ok(Math.abs(m[0]*m[3]-m[1]*m[2]-1)<.0001,'No stretch/shear/inversion');for(const p of outlines.get(part.name)){const q=transform(m,p);assert.ok(q[0]>=0&&q[0]<=480&&q[1]>=0&&q[1]<=448,JSON.stringify({dense,part:part.name,q}));}}
}
for(let n=0;n<=600;n++)for(const settle of [0,.5,1]){
 const phase=n/600,raw=painted({requestedState:'move'},{locomotionPhase:phase,locomotionSettle:settle});check(raw);dense++;
 if(settle===0){let supports=0;
  for(let i=0;i<6;i++){const l=d.rig.legs[i],q=(phase+l.offset)%1,point=[l.ankle[0],l.ankle[1]+432-l.groundAnkleY],a=transform(raw[`leg-${i}-foot`],point);if(Math.abs(a[1]-432)<.001)supports++;
   if(previous){const pq=(previous.phase+l.offset)%1;if(q>1/30&&q<d.motion.walk.stanceFraction-1/30&&q>pq&&pq>1/30){const b=transform(previous.raw[`leg-${i}-foot`],point);runtimeGroundError=Math.max(runtimeGroundError,Math.abs(a[1]-432));runtimeStanceDrift=Math.max(runtimeStanceDrift,Math.abs(a[0]+phase*atlas.cycleDistance-b[0]-previous.phase*atlas.cycleDistance));}}}
  minSupportingFeet=Math.min(minSupportingFeet,supports);assert.ok(supports>=3,'Actual renderer retains tripod ground support');previous={phase,raw};
 }
}
const runtime={locomotionPhase:.1371,locomotionSettle:1},idle=painted({requestedState:'idle'},runtime);
for(const state of ['wind-up','active','recovery'])for(let n=0;n<=60;n++){const raw=painted({requestedState:state,clipProgress:n/60},runtime);check(raw);dense++;
 for(let i=0;i<6;i++)assert.deepEqual(raw[`leg-${i}-foot`],idle[`leg-${i}-foot`],'Attack keeps all held feet');
 if(state==='wind-up'&&n===0||state==='recovery'&&n===60)for(const bone of ['spine','head',...d.rig.extras.map(e=>e.name)])assert.ok(raw[bone].every((v,i)=>Math.abs(v-idle[bone][i])<.001),'Continuous attack handoff '+bone);
}
for(const [metric,value]of Object.entries({runtimeJointError,runtimeAttachmentError,runtimeGroundError,runtimeStanceDrift}))assert.ok(value<.001,JSON.stringify({metric,value}));assert.equal(dense,1986);
for(const [pose,b]of Object.entries(d.poseBindings)){assert.equal(hash(await readFile(dir+b.file)),b.sha256);assert.equal(hash(await readFile('public'+b.path)),b.sourceSha256);const f=spriteFrameFor(kind,pose,'right');assert.equal(f.path,b.path);assert.deepEqual(f.sourceRect,b.sourceRect);}
assert.equal(hash(await readFile(dir+'identity-reference.png')),d.sourceSha256);const [mx,my]=atlas.muzzle;assert.ok(rawParts.get('neck')[(my*480+mx)*4+3]>=32,'Original head mouth point');
assert.equal(v177JointPose(kind,{requestedState:'hit'},{}),null);assert.equal(v177JointPose(kind,{requestedState:'active'},{},{ownedPose:true}),null);
const texture=await readFile('public'+atlas.path);assert.equal(texture.length,68230);assert.equal(hash(texture),'230991a43eff9f9331b68126ec3412f6fb0bc606ec2d46ce47973e16232231f1');assert.equal(atlas.decodedBytes,382976);assert.ok(minReachMargin>5);assert.equal(minSupportingFeet,3);assert.ok(originalPixels>13000&&overlayPixels>57000&&preservedNegativeAlphaPixels>26000&&protectedFootPixels>1900);assert.deepEqual(atlas.muzzle,[450,304]);assert.equal(hash(await readFile(dir+'hidden-parts-study.png')),d.sheetSha256);for(const state of ['hit','death','collapse','transform'])assert.equal(v177JointPose(kind,{requestedState:state},{}),null);
});
test('Mother mouth and six supporting feet and soles share mirrored coordinates and enemy-only conditional loading',async()=>{
 for(const kind of ['mother']){
  const atlas=V177_JOINT_ATLASES[kind],d=JSON.parse(await readFile('assets/source/v100/joints/'+kind+'-r1/parts.json'));
  const bytes=await readFile('public'+atlas.path),expected=V177_JOINT_ASSET_ADDITIONS.find(a=>a.path===atlas.path),meta=await sharp(bytes).metadata();
  assert.equal(bytes.length,expected.bytes);assert.equal('sha256-'+hash(bytes),expected.hash);assert.equal(meta.width*meta.height*4,atlas.decodedBytes);assert.ok(atlas.decodedBytes<=512*1024);
  for(const [pose,binding]of Object.entries(d.poseBindings)){const frame=spriteFrameFor(kind,pose,'right');assert.equal(frame.path,binding.path);assert.deepEqual(frame.sourceRect,binding.sourceRect);assert.deepEqual(frame.drawSlices,binding.drawSlices);}
  for(const direction of ['left','right'])for(const scale of [.12,.2]){
   let m=[1,0,0,1,300,500];const stack=[],calls=[];const mul=b=>{const a=m;m=[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];};
   const ctx={save(){stack.push([...m]);},restore(){m=stack.pop();},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},translate(x,y){mul([1,0,0,1,x,y]);},scale(x,y){mul([x,0,0,y,0,0]);},transform(...a){mul(a);},drawImage(){calls.push([...m]);}};
   if(direction==='left')ctx.scale(-1,1);const frame={...spriteFrameFor(kind,'walk-a',direction),flipX:direction==='left'},size={w:atlas.referenceFrame.width*scale,h:atlas.referenceFrame.height*scale},plan=v177JointPose(kind,{requestedState:'active',clipProgress:.26},{locomotionPhase:.1371,locomotionSettle:1});
   assert.ok(drawV177JointPose(ctx,{naturalWidth:512},kind,plan,-size.w*frame.anchorX,-size.h*frame.anchorY,size.w,size.h));assert.equal(calls.length,d.parts.length);
   const contact=transform(calls[atlas.parts.findIndex(p=>p.name==='neck')],atlas.muzzle),socket=v177RenderedJointWeaponSocket({kind,plan,direction,frame,size,pose:{offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotationRadians:0},x:300,y:500});assert.ok(distance(contact,[socket.x,socket.y])<1e-10);
   for(const leg of d.rig.legs){const p=[leg.ankle[0],leg.ankle[1]+432-leg.groundAnkleY],matrix=calls[atlas.parts.findIndex(p=>p.name===leg.paintedPaw)];assert.ok(Math.abs(transform(matrix,p)[1]-500)<.001);}
  }
  const input={stageId:CAMPAIGN_STAGE_IDS.NISHIJIN_SHOPPING_STREET,formationKinds:['ranger'],enemyKinds:[kind,kind]};const plan=requiredBattleAssetPlan(input);
  assert.equal(plan.paths.filter(p=>p===atlas.path).length,1);assert.equal(plan.persistent.filter(p=>p.key===atlas.key).length,1);
  assert.ok(!requiredBattleAssetPlan({...input,enemyKinds:[]}).paths.includes(atlas.path));assert.ok(!requiredBattleAssetPlan({...input,includeV100Sprites:false}).paths.includes(atlas.path));
 }
});
