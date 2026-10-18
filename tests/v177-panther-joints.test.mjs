import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';
import {ENEMY_FIREARM_WEAPON_PROFILE,weaponProfileForUnit} from '../app/combatPresentation.js';
import {enemyCombatVfxSnapshot,ENEMY_PROJECTILE_KINDS} from '../app/enemyVfxPresentation.js';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose,v177JointCycleDistance,v177RenderedJointWeaponSocket} from '../app/v177JointPresentation.js';
import {spriteFrameFor} from '../app/spriteManifest.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {CAMPAIGN_STAGE_IDS} from '../app/campaign.js';
import {V177_JOINT_ASSET_ADDITIONS} from '../scripts/v177-joint-asset-contract.mjs';
const kinds=['red-panther-knife','red-panther-smg','red-panther-shield','red-panther-commander'];
const transform=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]],distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const pixels=async url=>sharp(await readFile(url)).ensureAlpha().raw().toBuffer();
const gameSource=await readFile(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8');
const gameAst=ts.createSourceFile('AshfallGame.tsx',gameSource,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TSX);
function actualFirearmCallbacks(extra={}){
 const names=['addShot','addEnemyFirearmShot','drawEnemyCombatReadabilityVfx'];
 const declarations=gameAst.statements.filter(node=>ts.isFunctionDeclaration(node)&&names.includes(node.name?.text));
 assert.equal(declarations.length,names.length);
 const source=declarations.map(node=>node.getText(gameAst)).join('\n')+'\n({'+names.join(',')+'});';
 return vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{
  ENEMY_FIREARM_WEAPON_PROFILE,enemyCombatVfxSnapshot,acquireRenderObject:()=>({}),SHOT_POOL_KEYS:[],
  shotRenderOrigins:new WeakMap(),V100_CLAW_CONTACT_WEAPONS:[],V100_CONTACT_WEAPONS:[],
  capRenderObjectsInPlace(){},RENDER_ARRAY_LIMITS:{shots:48},
  weaponAnchorForTarget:()=>({x:91,y:42}),V100_CONTACT_ENEMY_KINDS:[],V100_STATION_POSE_KINDS:[],
  bossDefinitionForEnemyKind:()=>null,...extra,
 });
}
test('actual Panther normal-shot callbacks paint one source-owned firearm trace without another damage transaction',()=>{
 const {addEnemyFirearmShot}=actualFirearmCallbacks();
 for(const kind of Object.keys(ENEMY_FIREARM_WEAPON_PROFILE))for(const [targetHeight,target]of [
  [28,{id:71,x:320,y:200,hp:50}],[22,{id:72,x:310,y:210,hp:30}],[18,{x:90,y:220}],
 ]){
  const fighter=Object.freeze({id:17,kind,side:'zombie',damage:22,cooldown:1.18,attackSequence:4});
  Object.freeze(target);const g={definition:{missionConfig:{v100StageNumber:21}},shots:[],renderObjectPools:{shots:[]},pendingWeaponHits:[],baseHp:90};
  addEnemyFirearmShot(g,fighter,target,targetHeight);
  assert.equal(g.shots.length,1);const shot=g.shots[0];
  assert.equal(shot.style,'projectile');assert.equal(shot.side,'zombie');assert.equal(shot.weapon,kind);assert.equal(shot.sourceId,17);
  assert.equal(shot.x,91);assert.equal(shot.y,42);assert.equal(shot.tx,target.x);assert.equal(shot.ty,target.y-targetHeight);
  assert.equal(shot.impactDelaySeconds,0);assert.equal(shot.damageTargetId,undefined);assert.equal(shot.casing,false);
  assert.equal(g.pendingWeaponHits.length,0);assert.equal(g.baseHp,90);assert.equal(fighter.cooldown,1.18);
  assert.equal(ENEMY_PROJECTILE_KINDS.includes(kind),false,'Do not move immediate gun hits into the deferred organ-projectile damage path');
  assert.ok(['ballistic','burst-tracer'].includes(weaponProfileForUnit(kind).trail),'A firearm must not fall back to an unarmed contact arc');
 }
 const g={definition:{missionConfig:{v100StageNumber:21}},shots:[]};
 for(const fighter of [{kind:'red-panther-knife',side:'zombie'},{kind:'spitter',side:'zombie'},{kind:'ranger',side:'human'}])addEnemyFirearmShot(g,fighter,{x:1,y:2});
 addEnemyFirearmShot({...g,definition:{missionConfig:{}}},{kind:'red-panther-smg',side:'zombie'},{x:1,y:2});
 assert.equal(g.shots.length,0);
});
test('actual enemy warning renderer uses the Panther gun pose while preserving other enemy warnings',()=>{
 const ribbons=[],{drawEnemyCombatReadabilityVfx}=actualFirearmCallbacks({drawCombatRibbon:(...args)=>ribbons.push(args)});
 const ctx={save(){},restore(){}},g={definition:{missionConfig:{v100StageNumber:21}},time:2};
 for(const kind of ['red-panther-smg','red-panther-commander','walker']){
  ribbons.length=0;
  drawEnemyCombatReadabilityVfx(ctx,{id:17,kind,side:'zombie',hp:100,maxHp:100,combatReady:true,gateEntering:false,
   attack:0,attackWindup:.2,abilityWindup:0,flash:0,knock:0,bodyRadius:12,
   stationAbility:{phase:'idle'},animationPresentation:{direction:'left',moving:false},x:300,y:200},g,1,{});
  assert.equal(ribbons.length,kind==='walker'?2:0,'The two gun poses replace the unrelated waist/knee warning ribbons');
 }
});
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
 assert.equal(drawV177JointPose(ctx,{naturalWidth:atlas.decodedWidth},kind,plan,-size.w*frame.anchorX,-size.h*frame.anchorY,size.w,size.h),true);
 assert.equal(raw.length,{'red-panther-knife':16,'red-panther-smg':15,'red-panther-shield':15,'red-panther-commander':17}[kind]);return {raw,calls,frame,size};
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
 test(kind+': production interpolation keeps elbows and weapon and free hands attached through travel, aim, recoil and recovery',()=>{
  function checkArms(raw){for(const arm of d.armConstraints){
   const upper=matrixFor(raw,arm.upperBone),lower=matrixFor(raw,arm.lowerBone),parent=matrixFor(raw,arm.parentBone),weapon=matrixFor(raw,arm.effectorBone);
   const target=distance(transform(parent,arm.shoulder),transform(weapon,arm.wrist)),a=distance(arm.shoulder,arm.elbow),b=distance(arm.elbow,arm.wrist);
   assert.ok(target>Math.abs(a-b)+.0001&&target<a+b-.0001,'Authored grip stays reachable without the runtime fallback');
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
 test(kind+': original head, hands, weapon and visible costume survive, with an opaque muzzle at the exact rendered socket',async()=>{
  const reference=await pixels(new URL('identity-reference.png',dir));let originalPixels=0,torsoPixels=0,armPaintPixels=0,redInsigniaPixels=0;
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
      assert.deepEqual(data.subarray(i,i+4),reference.subarray(i,i+4),'Original visible sleeve, forearm armor and insignia');armPaintPixels++;
      if(reference[i]>55&&reference[i]>reference[i+1]*1.6)redInsigniaPixels++;
     }
    }
    if(part.name!=='torso'||reference[i+3]<32)continue;
    const p=[x+.5,y+.5],exclusions=[part.excludedOriginalWeapon,...part.sourceArmExclusions];
    if(!inside(p,part.originalTorsoRegion)||edgeDistance(p,part.originalTorsoRegion)<=1.5||exclusions.some(poly=>inside(p,poly)||edgeDistance(p,poly)<=1.5))continue;
    assert.deepEqual(data.subarray(i,i+4),reference.subarray(i,i+4),'Visible original costume');torsoPixels++;
   }
  }
  assert.ok(originalPixels>3000);assert.ok(torsoPixels>1500,JSON.stringify({kind,torsoPixels}));assert.ok(armPaintPixels>300);assert.ok(redInsigniaPixels>=3,JSON.stringify({kind,redInsigniaPixels}));
  const binding=await readFile(new URL('../public'+d.identityBinding.path,import.meta.url));assert.equal(hash(binding),d.identityBinding.sourceSha256);
  const weapon=await pixels(new URL('weapon-and-hands.png',dir)),[mx,my]=atlas.muzzle;assert.ok(weapon[(my*480+mx)*4+3]>=32,'Muzzle marker must touch painted weapon');
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
 test(kind+': weapon-specific actions keep the knife thrust, shield push and horizontal firearm aim distinct',()=>{
  assert.equal(d.rig.legs.length,2);assert.equal(d.rig.arms.length,2);
  const runtime={locomotionPhase:.1371,locomotionSettle:1},idle=record(kind,v177JointPose(kind,{requestedState:'wind-up',clipProgress:0},runtime)).raw,active=record(kind,v177JointPose(kind,{requestedState:'active',clipProgress:.5},runtime)).raw;
  const start=transform(matrixFor(idle,'weapon-0'),atlas.muzzle),end=transform(matrixFor(active,'weapon-0'),atlas.muzzle);
  if(kind==='red-panther-knife'){assert.ok(end[0]-start[0]>25);assert.ok(end[1]-start[1]<-20);assert.equal(d.armConstraints.filter(a=>a.effectorBone==='weapon-0').length,1);}
  else if(kind==='red-panther-shield'){assert.ok(end[0]-start[0]>15&&end[0]-start[0]<35);assert.ok(Math.abs(end[1]-start[1])<15);assert.equal(d.armConstraints.filter(a=>a.effectorBone==='weapon-0').length,2);}
  else{
   const base=transform(matrixFor(active,'weapon-0'),kind==='red-panther-smg'?[337,180]:[351,239]);
   assert.ok(end[0]-base[0]>10);assert.ok(Math.abs(end[1]-base[1])<.001,'Actual painted barrel becomes horizontal at aim');
  }
 });

}
test('Red Panther textures load only for selected enemy waves and never change legacy asset plans',()=>{
 const input={stageId:CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE,formationKinds:['brawler'],enemyKinds:kinds},plan=requiredBattleAssetPlan(input);
 for(const kind of kinds){const atlas=V177_JOINT_ATLASES[kind];assert.equal(plan.persistent.filter(p=>p.key===atlas.key).length,1);assert.equal(plan.paths.filter(p=>p===atlas.path).length,1);
  assert.ok(!requiredBattleAssetPlan({...input,enemyKinds:['walker']}).paths.includes(atlas.path));
  assert.ok(!requiredBattleAssetPlan({...input,includeV100Sprites:false}).paths.includes(atlas.path));
 }
});
test('knife authoring removes the source third arm while keeping its original backpack and two actual arm chains',async()=>{
 const dir=new URL('../assets/source/v100/joints/red-panther-knife-r1/',import.meta.url),d=JSON.parse(await readFile(new URL('parts.json',dir))),reference=await pixels(new URL('identity-reference.png',dir));
 assert.ok(d.excludedSourceExtraArm.length>=4);assert.equal(d.rig.arms.length,2);assert.ok(d.parts.find(p=>p.name==='backpack'&&p.original));assert.ok(d.parts.find(p=>p.name==='free-hand'&&p.original));let sourceArtifactPixels=0;
 for(let y=218;y<=240;y++)for(let x=149;x<=174;x++)if(reference[(y*480+x)*4+3]>=32)sourceArtifactPixels++;
 assert.ok(sourceArtifactPixels>50,'The source defect is actually present in this bound reference');
 for(const part of d.parts){const data=await pixels(new URL(part.file,dir));for(let y=218;y<=240;y++)for(let x=149;x<=174;x++)assert.ok(data[(y*480+x)*4+3]<8,'No retained third hand in '+part.name);}
});
