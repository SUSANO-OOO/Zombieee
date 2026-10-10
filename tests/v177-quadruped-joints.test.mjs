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

const dir=new URL('../assets/source/v100/joints/mayo-r1/',import.meta.url);
const definition=JSON.parse(await readFile(new URL('parts.json',dir)));
const motion=JSON.parse(gunzipSync(await readFile(new URL('motion.json.gz',dir))));
const atlas=V177_JOINT_ATLASES['mayo-chan'];
const transform=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const pixels=async file=>sharp(await readFile(new URL(file,dir))).ensureAlpha().raw().toBuffer();
function render(plan){
 const matrices=[],calls=[];
 const ctx={save(){},restore(){},translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},
  transform(...m){matrices.push(m);},drawImage(...a){calls.push(a);}};
 assert.equal(drawV177JointPose(ctx,{naturalWidth:atlas.decodedWidth},'mayo-chan',plan,0,0,480,448),true);
 assert.equal(calls.length,17);return matrices;
}

test('four fixed-length limbs keep painted contact, diagonal support and a reachable flight interval',async()=>{
 const soles=[];
 for(const leg of definition.rig.legs){
  const data=await pixels(leg.paintedPaw+'.png');let bottom=-1;
  for(let y=0;y<448;y++)for(let x=0;x<480;x++)if(data[(y*480+x)*4+3]>=32)bottom=Math.max(bottom,y);
  const points=[];for(let x=0;x<480;x++)if(data[(bottom*480+x)*4+3]>=32)points.push([x+.5,bottom+.5]);
  assert.ok(points.length>=2);soles.push(points);
 }
 let boneError=0,groundError=0,drift=0,flightFrames=0;
 for(const action of motion.actions)for(let i=0;i<action.frames.length;i++){
  const f=action.frames[i],first=action.frames[0];
  for(const [name,b]of Object.entries(f.bones))boneError=Math.max(boneError,Math.abs(distance(b.head,b.tail)-distance(first.bones[name].head,first.bones[name].tail)));
  const planted=definition.rig.legs.map(l=>(i/60+l.offset)%1<=.3);
  assert.equal(planted[0],planted[3]);assert.equal(planted[1],planted[2]);
  if(action.name==='walk'&&planted.every(p=>!p)){
   flightFrames++;assert.ok(f.bones.pelvis.head[1]<definition.pelvisY,'Body rises only with both diagonal pairs airborne');
  }
  for(let li=0;li<4;li++){
   const q=(i/60+definition.rig.legs[li].offset)%1,pq=((i-1)/60+definition.rig.legs[li].offset)%1;
   const bone=`leg-${li}-foot`;
   if(action.name==='attack'||action.name==='settle-3'||planted[li])for(const p of soles[li])groundError=Math.max(groundError,Math.abs(transform(f.deform[bone],p)[1]-432));
   if(i&&(action.name==='attack'||q<=.3&&pq<=.3&&q>pq))for(const p of soles[li])drift=Math.max(drift,distance(transform(f.deform[bone],p),transform(action.frames[i-1].deform[bone],p)));
  }
 }
 assert.ok(boneError<.01,{boneError});assert.ok(groundError<.01,{groundError});assert.ok(drift<.01,{drift});assert.ok(flightFrames>=12);
 const walk=motion.actions.find(a=>a.name==='walk');
 assert.ok(Math.abs(walk.frames.at(-1).bones.root.head[0]-walk.frames[0].bones.root.head[0]-atlas.cycleDistance)<.001);
 assert.ok(v177JointCycleDistance('mayo-chan',.1106)>20&&v177JointCycleDistance('mayo-chan',.1106)<21);
});

test('interpolated production paint keeps planted feet, fixed proportions and the held gait through bite contact',()=>{
 const runtime={locomotionPhase:.1371,locomotionSettle:1};
 const base=render(v177JointPose('mayo-chan',{requestedState:'idle'},runtime));
 for(const state of ['wind-up','active','recovery'])for(const p of [0,.137,.5,.999,1]){
  const plan=v177JointPose('mayo-chan',{requestedState:state,clipProgress:p},runtime),matrices=render(plan);
  for(let i=0;i<17;i++){
   const m=matrices[i];assert.ok(Math.abs(m[0]*m[3]-m[1]*m[2]-1)<1e-12,'No interpolated limb shortening');
   if(!atlas.parts[i].upper)assert.deepEqual(m,base[i],'Biting must not teleport the feet');
  }
 }
 for(const phase of [.001,.01471,.0549,.1274,.2413]){
  const plan=v177JointPose('mayo-chan',{requestedState:'move'},{locomotionPhase:phase,locomotionSettle:0});
  const matrix=render(plan)[atlas.parts.findIndex(p=>p.name==='near-front-paw')];
  const foot=transform(matrix,definition.rig.legs[3].ankle);
  assert.ok(Math.abs(foot[0]+phase*atlas.cycleDistance-(320+28))<.001,'Painted planted foot remains stationary in world space between source keys');
 }
 const active=v177JointPose('mayo-chan',{requestedState:'active',clipProgress:0},runtime);
 const jaw=render(active)[atlas.parts.findIndex(p=>p.name==='jaw')],head=render(active)[atlas.parts.findIndex(p=>p.name==='head')];
 assert.ok(Math.atan2(jaw[1],jaw[0])-Math.atan2(head[1],head[0])<-.32,'Jaw is already closed when damage is applied');
 const pose={offsetX:0,offsetY:0,rotationRadians:0,scaleX:1,scaleY:1},frame=spriteFrameFor('mayo-chan','walk-a','right');
 const input={kind:'mayo-chan',plan:active,size:{w:480,h:448},pose,x:300,y:500};
 const right=v177RenderedJointWeaponSocket({...input,direction:'right',frame});
 const left=v177RenderedJointWeaponSocket({...input,direction:'left',frame:{...frame,flipX:true}});
 const contact=transform(jaw,atlas.muzzle);
 assert.ok(Math.abs(right.x-(300+contact[0]-240))<1e-10);assert.ok(Math.abs(right.y-(500+contact[1]-432))<1e-10);
 assert.ok(Math.abs(right.x+left.x-600)<1e-10);assert.equal(right.y,left.y);
 assert.equal(v177JointPose('mayo-chan',{requestedState:'active'},runtime,{ownedPose:true}),null);
 assert.equal(v177JointPose('mayo-chan-feral',{requestedState:'move'},runtime),null,'Derived identity still requires its own paint and acceptance');
});

test('opaque head and jaw preserve original paint; conditional atlas bytes and memory stay source-bound',async()=>{
 const reference=await pixels('identity-reference.png');
 let originalPixels=0;
 for(const p of definition.parts){
  const bytes=await readFile(new URL(p.file,dir));assert.equal(createHash('sha256').update(bytes).digest('hex'),p.sha256);
  if(!p.original)continue;
  const data=await pixels(p.file);
  // Polygon masks change alpha at their antialiased cut boundary; compare the
  // opaque identity paint separately from those newly exposed cut edges.
  for(let i=0;i<data.length;i+=4)if(data[i+3]===255){assert.deepEqual(data.subarray(i,i+4),reference.subarray(i,i+4),p.name);originalPixels++;}
 }
 assert.ok(originalPixels>20000);
 const jaw=await pixels('jaw.png'),head=await pixels('head.png'),[tx,ty]=atlas.muzzle;assert.ok(jaw[(ty*480+tx)*4+3]>=32,'Bite origin is on the painted mouth');
 let hingeOverlap=0;
 for(let y=250;y<268;y++)for(let x=398;x<=410;x++)if(jaw[(y*480+x)*4+3]>=32&&head[(y*480+x)*4+3]>=32)hingeOverlap++;
 assert.ok(hingeOverlap>=80,'Original attached neck fur must overlap the pivot to prevent an exposed triangular hinge gap');
 const binding=await readFile(new URL('../public'+definition.identityBinding.path,import.meta.url));
 assert.equal(createHash('sha256').update(binding).digest('hex'),definition.identityBinding.sourceSha256);
  const rect=definition.identityBinding.sourceRect;
  const original=await sharp(binding).extract({left:rect.x,top:rect.y,width:rect.w,height:rect.h}).ensureAlpha().raw().toBuffer();
  for(let i=0;i<reference.length;i+=4)if(reference[i+3]===255)assert.deepEqual(reference.subarray(i,i+4),original.subarray(i,i+4),'Reference remains bound to the approved source cell');
 const bytes=await readFile(new URL('../public'+atlas.path,import.meta.url)),expected=V177_JOINT_ASSET_ADDITIONS.find(a=>a.path===atlas.path);
 assert.equal(bytes.length,expected.bytes);assert.equal('sha256-'+createHash('sha256').update(bytes).digest('hex'),expected.hash);
 const metadata=await sharp(bytes).metadata();assert.equal(metadata.width*metadata.height*4,atlas.decodedBytes);assert.ok(atlas.decodedBytes<=1024*1024);
 const stageId=CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE;
 assert.equal(requiredBattleAssetPlan({stageId,formationKinds:['mayo-chan','mayo-chan']}).paths.filter(p=>p===atlas.path).length,1);
 assert.ok(!requiredBattleAssetPlan({stageId,formationKinds:['scout']}).paths.includes(atlas.path));
});
