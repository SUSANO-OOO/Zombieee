import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {V177_JOINT_ATLASES,v177JointCycleDistance,v177JointPose,drawV177JointPose,v177RenderedJointWeaponSocket} from '../app/v177JointPresentation.js';
import {createCombatAnimationRuntime,advanceCombatAnimationRuntime,sampleAnimationClip} from '../app/combatPresentation.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {CAMPAIGN_STAGE_IDS} from '../app/campaign.js';
import {spriteFrameFor} from '../app/spriteManifest.js';
import {V177_JOINT_ASSET_ADDITIONS} from '../scripts/v177-joint-asset-contract.mjs';

const dir=new URL('../assets/source/v100/joints/ranger-r1/',import.meta.url);
const parts=JSON.parse(await readFile(new URL('parts.json',dir)));
const motion=JSON.parse(gunzipSync(await readFile(new URL('motion.json.gz',dir))));
const atlas=V177_JOINT_ATLASES.ranger;
const transform=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

test('actual-travel gait phase freezes while stationary and survives attack transitions',()=>{
  const scale=.22,stride=v177JointCycleDistance('ranger',scale);
  assert.ok(stride>30&&stride<35);
  let runtime=createCombatAnimationRuntime();
  runtime=advanceCombatAnimationRuntime(runtime,{kind:'ranger',x:stride*.37,y:0,locomotionCycleDistance:stride},1/60);
  assert.ok(Math.abs(runtime.locomotionPhase-.37)<1e-12);
  const phase=runtime.locomotionPhase;
  for(let i=0;i<20;i++)runtime=advanceCombatAnimationRuntime(runtime,{kind:'ranger',x:stride*.37,y:0,locomotionCycleDistance:stride},1/60);
  assert.equal(runtime.locomotionPhase,phase);
  assert.equal(runtime.locomotionSettle,1);
  const lower=[];
  for(const state of ['idle','wind-up','active','recovery'])for(const p of [0,.5,1]){
    const pose=v177JointPose('ranger',{requestedState:state,clipProgress:p},runtime);
    lower.push(pose.lowerIndex);
  }
  assert.equal(new Set(lower).size,1,'Aiming must not teleport the feet');
  assert.ok(Math.abs(v177JointPose('ranger',{requestedState:'active'},{...runtime,locomotionPhase:phase}).phase-phase)<1e-12);
  assert.equal(v177JointPose('ranger',{requestedState:'hit'},runtime),null);
  assert.equal(v177JointPose('ranger',{requestedState:'active'},runtime,{ownedPose:true}),null);
  assert.equal(v177JointPose('spitter',{requestedState:'move'},runtime),null);
});

test('real bone exports preserve leg lengths, actual painted support points, grips and clothing winding',async()=>{
  const walk=motion.actions.find(action=>action.name==='walk');
  assert.ok(Math.abs(walk.frames.at(-1).bones.root.head[0]-walk.frames[0].bones.root.head[0]-atlas.cycleDistance)<.01);
  const soles=[];
  for(const name of ['far-boot','near-boot']){
    const part=parts.parts.find(p=>p.name===name),{data,info}=await sharp(await readFile(new URL(part.file,dir))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let bottom=-1;const points=[];
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=32)bottom=Math.max(bottom,y);
    for(let y=bottom-1;y<=bottom;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>=32)points.push([x+.5,y+.5]);
    assert.ok(points.length>=4);soles.push(points);
  }
  let maxBone=0,maxGround=0,maxGrip=0,maxDrift=0,folds=0;
  for(const action of motion.actions){
    const rest=action.frames[0].bones;
    for(let i=0;i<action.frames.length;i++){
      const f=action.frames[i];
      for(const [name,bone]of Object.entries(f.bones))maxBone=Math.max(maxBone,Math.abs(distance(bone.head,bone.tail)-distance(rest[name].head,rest[name].tail)));
      for(const [li,p]of [[0,[244,173]],[1,[293,203]]])maxGrip=Math.max(maxGrip,distance(f.bones[`arm-${li}-hand`].tail,transform(f.deform['weapon-0'],p)));
      for(let li=0;li<2;li++){
        const q=(i/60+(li===0?.5:0))%1,pq=((i-1)/60+(li===0?.5:0))%1;
        const planted=action.name==='attack'||action.name==='settle-3'||q<=.62;
        if(planted){
          const bottom=Math.max(...soles[li].map(p=>transform(f.deform[`leg-${li}-foot`],p)[1]));
          maxGround=Math.max(maxGround,Math.abs(bottom-432));
        }
        if(action.name==='walk'&&i>0&&q<=.62&&pq<=.62&&q>pq)for(const p of soles[li]){
          maxDrift=Math.max(maxDrift,distance(transform(f.deform[`leg-${li}-foot`],p),transform(action.frames[i-1].deform[`leg-${li}-foot`],p)));
        }
      }
      const area=([a,b,c])=>(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
      for(const [name,mesh]of Object.entries(motion.meshDefinitions))for(const t of mesh.triangles){
        if(area(t.map(j=>f.meshes[name][j]))/area(t.map(j=>mesh.sourcePositions[j]))<=0)folds++;
      }
    }
  }
  assert.ok(maxBone<.01,{maxBone});assert.ok(maxGround<.01,{maxGround});
  assert.ok(maxGrip<.01,{maxGrip});assert.ok(maxDrift<.01,{maxDrift});assert.equal(folds,0);
});

test('both image layers and the shot socket share the same pose, proportions and mirror',()=>{
  const runtime={locomotionPhase:.37,locomotionSettle:.5},plan=v177JointPose('ranger',sampleAnimationClip('ranger','active',.03),runtime);
  const calls=[],image={naturalWidth:atlas.decodedWidth};
  assert.equal(drawV177JointPose({drawImage:(...args)=>calls.push(args)},image,'ranger',plan,-48,-86.4,96,89.6),true);
  assert.equal(calls.length,2);
  for(const [i,[index,dy]]of [[plan.lowerIndex,0],[plan.upperIndex,plan.upperOffsetY]].entries()){
    const row=atlas.frames[index],c=calls[i];
    assert.deepEqual(c.slice(1,5),Object.values(row.source));
    assert.ok(Math.abs(c[6]-(-86.4+(row.destination.y+dy)/448*89.6))<1e-12);
  }
  const pose={offsetX:0,offsetY:0,rotationRadians:0,scaleX:1,scaleY:1};
  const input={kind:'ranger',plan,size:{w:96,h:89.6},pose,x:300,y:200};
  const right=v177RenderedJointWeaponSocket({...input,direction:'right',frame:{...spriteFrameFor('ranger','walk-a','right'),flipX:false}});
  const left=v177RenderedJointWeaponSocket({...input,direction:'left',frame:{...spriteFrameFor('ranger','walk-a','right'),flipX:true}});
  assert.ok(Math.abs(right.x+left.x-600)<1e-10);assert.equal(right.y,left.y);
});

test('candidate textures stay source-bound and the installed pack loads only requested joint atlases',async()=>{
  const stageId=CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE;
  const loaded=requiredBattleAssetPlan({stageId,formationKinds:['ranger','ranger']});
  assert.equal(loaded.paths.filter(p=>p===atlas.path).length,1);
  assert.ok(loaded.persistent.some(p=>p.key===atlas.key));
  assert.ok(!requiredBattleAssetPlan({stageId,formationKinds:['scout']}).paths.includes(atlas.path));
  assert.ok(!requiredBattleAssetPlan({stageId,formationKinds:['ranger'],includeV100Sprites:false}).paths.includes(atlas.path));
  const bytes=await readFile(new URL('../public'+atlas.path,import.meta.url)),metadata=await sharp(bytes).metadata();
  assert.equal(metadata.width,atlas.decodedWidth);assert.equal(metadata.height,atlas.decodedHeight);
  assert.ok(atlas.decodedBytes<=6*1024*1024);
  const texture=await sharp(bytes).ensureAlpha().raw().toBuffer();
  for(let i=atlas.lowerCount;i<atlas.frames.length;i++){
    const {source:s,destination:d}=atlas.frames[i],[mx,my]=atlas.muzzles[i-atlas.lowerCount];
    const tx=Math.round(s.x+(mx-d.x)/d.w*s.w),ty=Math.round(s.y+(my-d.y)/d.h*s.h);
    let painted=false;
    for(let yy=ty-1;yy<=ty+1;yy++)for(let xx=tx-1;xx<=tx+1;xx++)if(texture[(yy*metadata.width+xx)*4+3]>=32)painted=true;
    assert.ok(painted,`Shot socket must land on the actual painted muzzle in upper frame ${i}`);
  }
  const expected=V177_JOINT_ASSET_ADDITIONS[0];
  assert.equal(bytes.length,expected.bytes);assert.equal('sha256-'+createHash('sha256').update(bytes).digest('hex'),expected.hash);
  for(const p of parts.parts)assert.equal(createHash('sha256').update(await readFile(new URL(p.file,dir))).digest('hex'),p.sha256,p.name);
  assert.ok(parts.parts.find(p=>p.name==='head').original);
  assert.ok(parts.parts.find(p=>p.name==='weapon').original);
  const reference=await readFile(new URL('identity-reference.png',dir));
  assert.equal(createHash('sha256').update(reference).digest('hex'),parts.sourceSha256);
  const original=await readFile(new URL('../public'+parts.identityBinding.path,import.meta.url));
  assert.equal(createHash('sha256').update(original).digest('hex'),parts.identityBinding.sourceSha256);
  const referencePixels=await sharp(reference).ensureAlpha().raw().toBuffer();
  for(const name of ['head','weapon']){
    const p=parts.parts.find(p=>p.name===name),pixels=await sharp(await readFile(new URL(p.file,dir))).ensureAlpha().raw().toBuffer();
    let compared=0;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]===255){
      assert.deepEqual(pixels.subarray(i,i+3),referencePixels.subarray(i,i+3),`${name}: retained original paint`);compared++;
    }
    assert.ok(compared>2000);
  }
  const manifest=JSON.parse(await readFile(new URL('../public/asset-manifest.json',import.meta.url)));
  assert.ok(manifest.assets.some(p=>p.path===expected.path&&p.hash===expected.hash));
  assert.ok(!manifest.assets.some(p=>p.path.includes('/source/v100/joints/')));
});
