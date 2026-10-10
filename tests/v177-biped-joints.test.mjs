import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose,v177JointCycleDistance,v177RenderedJointWeaponSocket} from '../app/v177JointPresentation.js';
import {spriteFrameFor,spriteBattleDisplaySizeFor} from '../app/spriteManifest.js';
import {v102BattleDisplaySize} from '../app/v102BattleScale.js';
import {v102BattleBodyScale} from '../app/v102CombatMotion.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {CAMPAIGN_STAGE_IDS} from '../app/campaign.js';
import {V177_JOINT_ASSET_ADDITIONS} from '../scripts/v177-joint-asset-contract.mjs';

const dir=new URL('../assets/source/v100/joints/scout-r1/',import.meta.url);
const definition=JSON.parse(await readFile(new URL('parts.json',dir)));
const motion=JSON.parse(gunzipSync(await readFile(new URL('motion.json.gz',dir))));
const atlas=V177_JOINT_ATLASES.scout;
const transform=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const pixels=async file=>sharp(await readFile(new URL(file,dir))).ensureAlpha().raw().toBuffer();
function render(plan){
 const matrices=[],calls=[];
 const ctx={save(){},restore(){},translate(){},scale(){},transform(...m){matrices.push(m);},drawImage(...a){calls.push(a);}};
 assert.equal(drawV177JointPose(ctx,{naturalWidth:atlas.decodedWidth},'scout',plan,0,0,480,448),true);
 assert.equal(calls.length,16);return matrices;
}

test('both biped legs keep fixed lengths, painted ground support and a travel-scaled stride; the crowbar stays in its hand',async()=>{
 const soles=[];
 for(const leg of definition.rig.legs){
  const data=await pixels(leg.paintedPaw+'.png');let bottom=-1;
  for(let y=0;y<448;y++)for(let x=0;x<480;x++)if(data[(y*480+x)*4+3]>=32)bottom=Math.max(bottom,y);
  const points=[];for(let x=0;x<480;x++)if(data[(bottom*480+x)*4+3]>=32)points.push([x+.5,bottom+.5]);
  assert.ok(points.length>=2);soles.push(points);
 }
 let boneError=0,groundError=0,drift=0,gripError=0;
 for(const action of motion.actions)for(let i=0;i<action.frames.length;i++){
  const f=action.frames[i],first=action.frames[0];
  for(const [name,b]of Object.entries(f.bones))boneError=Math.max(boneError,Math.abs(distance(b.head,b.tail)-distance(first.bones[name].head,first.bones[name].tail)));
  gripError=Math.max(gripError,distance(f.bones['weapon-0'].head,f.bones['arm-0-hand'].tail),distance(f.bones['arm-0-lower'].tail,f.bones['arm-0-hand'].head));
  for(let li=0;li<2;li++){
   const q=(i/60+definition.rig.legs[li].offset)%1,pq=((i-1)/60+definition.rig.legs[li].offset)%1;
   const bone=`leg-${li}-foot`,stance=definition.motion.walk.stanceFraction;
   if(action.name==='attack'||action.name==='settle-3'||q<=stance)for(const p of soles[li])groundError=Math.max(groundError,Math.abs(transform(f.deform[bone],p)[1]-432));
   if(i&&(action.name==='attack'||q<=stance&&pq<=stance&&q>pq))for(const p of soles[li])drift=Math.max(drift,distance(transform(f.deform[bone],p),transform(action.frames[i-1].deform[bone],p)));
  }
 }
 assert.ok(boneError<.01,{boneError});assert.ok(groundError<.01,{groundError});assert.ok(drift<.01,{drift});assert.ok(gripError<.01,{gripError});
 const walk=motion.actions.find(a=>a.name==='walk');
 assert.ok(Math.abs(walk.frames.at(-1).bones.root.head[0]-walk.frames[0].bones.root.head[0]-atlas.cycleDistance)<.001);
 const frame=spriteFrameFor('scout','walk-a','right'),size=v102BattleDisplaySize('scout',frame,spriteBattleDisplaySizeFor('scout'));
 const scale=size.w/frame.sourceRect.w*v102BattleBodyScale('scout'),cycle=v177JointCycleDistance('scout',scale);
 assert.ok(cycle>23&&cycle<25,'A complete stride must travel far enough at the accelerated ally speed');
});

test('production interpolation holds both feet through crowbar contact and preserves the rendered hand, weapon and mirrored effect origin',()=>{
 const runtime={locomotionPhase:.1371,locomotionSettle:1},base=render(v177JointPose('scout',{requestedState:'idle'},runtime));
 for(const state of ['wind-up','active','recovery'])for(const p of Array.from({length:61},(_,i)=>i/60)){
  const plan=v177JointPose('scout',{requestedState:state,clipProgress:p},runtime),matrices=render(plan);
  for(let i=0;i<16;i++){
   const m=matrices[i];assert.ok(Math.abs(m[0]*m[3]-m[1]*m[2]-1)<1e-12,'No interpolated limb shortening');
   if(!atlas.parts[i].upper)assert.deepEqual(m,base[i],'Attacking must not teleport either foot or the pelvis');
  }
  const matrixFor=bone=>matrices[atlas.parts.findIndex(p=>p.bone===bone)];
  for(const arm of definition.armConstraints){
   const upper=matrixFor(arm.upperBone),lower=matrixFor(arm.lowerBone),effector=matrixFor(arm.effectorBone),parent=matrixFor(arm.parentBone);
   assert.ok(distance(transform(upper,arm.shoulder),transform(parent,arm.shoulder))<.001,'The shoulder stays attached to the torso');
   assert.ok(distance(transform(upper,arm.elbow),transform(lower,arm.elbow))<.001,'The upper arm and forearm meet at the elbow');
   assert.ok(distance(transform(lower,arm.wrist),transform(effector,arm.wrist))<.001,'The painted hand remains attached between source keys');
  }
 }
 for(const phase of [.001,.01471,.0549,.1274,.2413,.5049,.5547]){
  const plan=v177JointPose('scout',{requestedState:'move'},{locomotionPhase:phase,locomotionSettle:0}),matrices=render(plan);
  for(const [i,leg]of definition.rig.legs.entries()){
   const q=(phase+leg.offset)%1;if(q>.58)continue;
   const m=matrices[atlas.parts.findIndex(p=>p.bone===`leg-${i}-foot`)];
   const foot=transform(m,leg.ankle);
   const expected=leg.center+definition.motion.walk.spanPx/2+Math.floor(phase+leg.offset)*atlas.cycleDistance-leg.offset*atlas.cycleDistance;
   assert.ok(Math.abs(foot[0]+phase*atlas.cycleDistance-expected)<.001,'Planted paint must stay fixed in world space between keys');
  }
 }
 const plan=v177JointPose('scout',{requestedState:'active',clipProgress:0},runtime);
 const weapon=render(plan)[atlas.parts.findIndex(p=>p.name==='crowbar-and-hand')],contact=transform(weapon,atlas.muzzle);
 assert.ok(contact[0]>400&&contact[1]<240,'The bar must reach its contact pose when damage is applied');
 const pose={offsetX:0,offsetY:0,rotationRadians:0,scaleX:1,scaleY:1},frame=spriteFrameFor('scout','walk-a','right');
 const input={kind:'scout',plan,size:{w:480,h:448},pose,x:300,y:500};
 const right=v177RenderedJointWeaponSocket({...input,direction:'right',frame});
 const left=v177RenderedJointWeaponSocket({...input,direction:'left',frame:{...frame,flipX:true}});
 assert.ok(Math.abs(right.x-(300+contact[0]-240))<1e-10);assert.ok(Math.abs(right.y-(500+contact[1]-432))<1e-10);
 assert.ok(Math.abs(right.x+left.x-600)<1e-10);assert.equal(right.y,left.y);
 for(const state of ['hit-heavy','death','ability'])assert.equal(v177JointPose('scout',{requestedState:state},runtime),null,'Other authored action owners remain intact');
 assert.equal(v177JointPose('scout',{requestedState:'active'},runtime,{ownedPose:true}),null);
 const attack=motion.actions.find(a=>a.name==='attack');
 for(let i=0;i<=30;i++){
  const plan={...v177JointPose('scout',{requestedState:'idle'},runtime),upperIndex:atlas.lowerCount+i,upperNextIndex:atlas.lowerCount+i,upperBlend:0,upperOffsetY:0,attackPhase:i/30};
  const matrices=render(plan);
  for(const arm of definition.armConstraints)for(const bone of [arm.upperBone,arm.lowerBone]){
   const actual=matrices[atlas.parts.findIndex(p=>p.bone===bone)],source=attack.frames[i*2].deform[bone];
   const points=bone===arm.upperBone?[arm.shoulder,arm.elbow]:[arm.elbow,arm.wrist];
   assert.ok(points.every(p=>distance(transform(actual,p),transform(source,p))<.001),JSON.stringify({reason:'Preserve the evaluated Blender joint positions at source keys',i,bone}));
  }
 }
});

test('the original face, backpack, crowbar and holding hand stay source-bound; only a needed battle decodes the exact small texture',async()=>{
 const reference=await pixels('identity-reference.png');let originalPixels=0;
 for(const p of definition.parts){
  const bytes=await readFile(new URL(p.file,dir));assert.equal(createHash('sha256').update(bytes).digest('hex'),p.sha256);
  if(!p.original)continue;
  const data=await pixels(p.file);
  for(let i=0;i<data.length;i+=4)if(data[i+3]===255){assert.deepEqual(data.subarray(i,i+4),reference.subarray(i,i+4),p.name);originalPixels++;}
 }
 assert.ok(originalPixels>7000);
 const weapon=await pixels('crowbar-and-hand.png'),[tx,ty]=atlas.muzzle;assert.ok(weapon[(ty*480+tx)*4+3]>=32,'Contact origin is on the painted crowbar');
 const binding=await readFile(new URL('../public'+definition.identityBinding.path,import.meta.url));
 assert.equal(createHash('sha256').update(binding).digest('hex'),definition.identityBinding.sourceSha256);
 const rect=definition.identityBinding.sourceRect,original=await sharp(binding).extract({left:rect.x,top:rect.y,width:rect.w,height:rect.h}).ensureAlpha().raw().toBuffer();
 for(let i=0;i<reference.length;i+=4)if(reference[i+3]===255)assert.deepEqual(reference.subarray(i,i+4),original.subarray(i,i+4),'Reference remains bound to the approved source cell');
 const bytes=await readFile(new URL('../public'+atlas.path,import.meta.url)),expected=V177_JOINT_ASSET_ADDITIONS.find(a=>a.path===atlas.path);
 assert.equal(bytes.length,expected.bytes);assert.equal('sha256-'+createHash('sha256').update(bytes).digest('hex'),expected.hash);
 const metadata=await sharp(bytes).metadata();assert.equal(metadata.width*metadata.height*4,atlas.decodedBytes);assert.ok(atlas.decodedBytes<=512*1024);
 const stageId=CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE;
 assert.equal(requiredBattleAssetPlan({stageId,formationKinds:['scout','scout']}).paths.filter(p=>p===atlas.path).length,1);
 assert.ok(!requiredBattleAssetPlan({stageId,formationKinds:['ranger']}).paths.includes(atlas.path));
});
