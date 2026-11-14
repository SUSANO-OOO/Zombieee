import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {V100_KING_EXHAUST_ART as ART,V100_KING_EXHAUST_SOCKET as SOCKET} from '../app/v100KingExhaustArt.js';
import {drawV100KingExhaust,getV100KingExhaustSnapshot as snapshot} from '../app/v100KingExhaustVfx.js';
import {V177_JOINT_ATLASES,v177JointPose,v177RenderedJointWeaponSocket} from '../app/v177JointPresentation.js';
import {advanceAreaEffects} from '../app/gameRules.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {canUseVerifiedPwaArtwork} from '../app/pwaArtworkAvailability.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';

const image=(width=768,height=512)=>({complete:true,naturalWidth:width,naturalHeight:height});
function fixture(){
  const owner={id:7,kind:'crazy-king',side:'human',hp:80,combatReady:true,x:300,y:250,
    manualAbility:{kind:'crazy-king',activationId:2,phase:'active'}};
  const world={time:10,battlePresentation:{generation:1},definition:{missionConfig:{v100StageNumber:2}},fighters:[owner]};
  const point=()=>({x:311,y:210,axisX:287,axisY:210,paintedAt:world.time,sourcePath:SOCKET.bodyPath,sourceBone:SOCKET.sourceBone});
  return {world,owner,point};
}
function canvas(){
  const calls=[],transforms=[],stack=[];
  const ctx={globalAlpha:.73,globalCompositeOperation:'screen',shadowBlur:3,
    save(){stack.push([this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]);},
    restore(){[this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]=stack.pop();},
    translate(...args){transforms.push(args);},rotate(...args){transforms.push(args);},
    drawImage(...args){calls.push({args,alpha:this.globalAlpha});}};
  return {ctx,calls,transforms,stack};
}

test('exhaust originates from opaque paint on the current approved saw housing, separately from its blade tip',async()=>{
  const bytes=await readFile('public'+SOCKET.bodyPath),hash=createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash,SOCKET.bodySha256);
  const atlas=V177_JOINT_ATLASES['crazy-king'],part=atlas.parts.find(p=>p.name==='weapon-and-hands');
  assert.equal(part.bone,SOCKET.sourceBone);
  const packed=SOCKET.sourcePoint.map((p,i)=>part.source[i?'y':'x']+(p-part.destination[i?'y':'x'])/part.destination[i?'h':'w']*part.source[i?'h':'w']);
  assert.ok(Math.abs(packed[0]-187)<1e-9&&Math.abs(packed[1]-28)<1e-9);
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.ok(data[(28*info.width+187)*4+3]>=200);
  assert.ok(Math.hypot(...SOCKET.sourcePoint.map((n,i)=>n-atlas.muzzle[i]))>100);
});

test('the real joint transform resolves the vent and rearward axis in idle, walking and both facing directions',()=>{
  const pose={offsetX:0,offsetY:0,rotationRadians:0,scaleX:1,scaleY:1};
  for(const state of ['idle','move','wind-up','active','recovery'])for(const direction of ['left','right']){
    const plan=v177JointPose('crazy-king',{requestedState:state,clipProgress:.35},{locomotionPhase:.35,locomotionSettle:state==='move'?0:1});
    const args={kind:'crazy-king',plan,direction,frame:{anchorX:.5,anchorY:1,flipX:direction==='left'},
      size:{w:150,h:140},pose,x:300,y:250,sourceBone:SOCKET.sourceBone,allowIdle:true};
    const vent=v177RenderedJointWeaponSocket({...args,sourcePoint:SOCKET.sourcePoint});
    const axis=v177RenderedJointWeaponSocket({...args,sourcePoint:SOCKET.axisPoint});
    assert.ok([vent.x,vent.y,axis.x,axis.y].every(Number.isFinite));
    assert.ok(Math.hypot(axis.x-vent.x,axis.y-vent.y)>.5);
  }
});

test('only a fresh successfully painted housing can emit, and rendering cannot mutate the real game or consume RNG',()=>{
  const {world,point}=fixture(),{ctx,calls,stack}=canvas(),before=structuredClone(world);
  const original=Math.random;Math.random=()=>{throw Error('Render consumed game RNG');};
  try{drawV100KingExhaust(ctx,{[ART['crazy-king'].id]:image()},world,point);}finally{Math.random=original;}
  assert.equal(calls.length,1);assert.deepEqual(world,before);
  assert.equal(ctx.globalAlpha,.73);assert.equal(ctx.globalCompositeOperation,'screen');assert.equal(ctx.shadowBlur,3);assert.equal(stack.length,0);
  for(const patch of [{paintedAt:9},{sourcePath:'/different-body.webp'},{sourceBone:'head'},{axisX:311},{x:NaN}]){
    const f=fixture(),c=canvas();drawV100KingExhaust(c.ctx,{[ART['crazy-king'].id]:image()},f.world,()=>({...f.point(),...patch}));
    assert.equal(c.calls.length,0);assert.equal(snapshot(f.world).length,0);
  }
});

test('a real fighter clone and late optional decode wait until a later manual activation',()=>{
  const {world,point}=fixture(),{ctx,calls}=canvas(),objects={};
  drawV100KingExhaust(ctx,objects,world,point);
  const original=world.fighters[0];world.fighters=advanceAreaEffects({fighters:world.fighters,areaEffects:[],seconds:.016}).fighters;
  assert.notEqual(world.fighters[0],original);world.time+=.2;objects[ART['crazy-king'].id]=image();
  drawV100KingExhaust(ctx,objects,world,point);assert.equal(calls.length,0);
  world.fighters[0].manualAbility={...world.fighters[0].manualAbility,activationId:3};
  drawV100KingExhaust(ctx,objects,world,point);assert.equal(calls.length,1);
});

test('the first decoded source remains selected through a lookup change and windup-to-active transition',()=>{
  const {world,owner,point}=fixture(),{ctx,calls}=canvas(),preferred=image(),objects={[ART['crazy-king'].id]:preferred};
  owner.manualAbility.phase='windup';drawV100KingExhaust(ctx,objects,world,point);
  delete objects[ART['crazy-king'].id];owner.manualAbility.phase='active';world.time+=.2;
  drawV100KingExhaust(ctx,objects,world,point);
  assert.equal(snapshot(world).length,2);assert.ok(calls.every(c=>c.args[0]===preferred));
  assert.ok(snapshot(world)[1].alpha>snapshot(world)[0].alpha);
});

test('missing, broken or malformed optional sources do not add a blocker or a diagram fallback',()=>{
  for(const candidate of [undefined,{...image(),complete:false},image(0,0),image(768,256),image(Infinity,512)]){
    const {world,point}=fixture(),{ctx,calls}=canvas();drawV100KingExhaust(ctx,{[ART['crazy-king'].id]:candidate},world,point);
    assert.equal(calls.length,0);assert.equal(snapshot(world).length,0);
  }
});

test('all six packet frames finish and fade without replaying at the end of the real ability',()=>{
  const {world,owner,point}=fixture(),{ctx,calls,stack}=canvas(),objects={[ART['crazy-king'].id]:image()};
  drawV100KingExhaust(ctx,objects,world,point);owner.manualAbility.phase='cooldown';
  for(const elapsed of [.12,.24,.36,.48,.6]){world.time=10+elapsed;drawV100KingExhaust(ctx,objects,world,point);}
  assert.equal(new Set(calls.map(c=>c.args[1]/256+c.args[2]/256*3)).size,6);
  assert.ok(calls.every(c=>c.args.slice(1).every(Number.isFinite)&&c.alpha>0&&c.alpha<1));
  const count=calls.length;world.time=10.65;drawV100KingExhaust(ctx,objects,world,point);
  assert.equal(calls.length,count);assert.equal(snapshot(world).length,0);assert.equal(stack.length,0);
});

test('released packets keep their original world position when a new socket moves and turns',()=>{
  const {world,point}=fixture(),{ctx}=canvas(),objects={[ART['crazy-king'].id]:image()};
  drawV100KingExhaust(ctx,objects,world,point);const first=snapshot(world)[0];
  world.time+=.2;drawV100KingExhaust(ctx,objects,world,()=>({...point(),x:410,y:195,axisX:434,axisY:195}));
  const rows=snapshot(world);assert.equal(rows.length,2);
  for(const key of ['x','y','angle','startedAt'])assert.equal(rows[0][key],first[key]);
  assert.equal(rows[1].x,410);assert.equal(rows[1].angle,0);assert.ok(Math.abs(rows[0].angle-Math.PI)<1e-9);
});

test('paused or skipped frames cannot create catch-up packets, and the maximum in-flight set is bounded',()=>{
  const {world,point}=fixture(),{ctx}=canvas(),objects={[ART['crazy-king'].id]:image()};
  drawV100KingExhaust(ctx,objects,world,point);drawV100KingExhaust(ctx,objects,world,point);
  assert.equal(snapshot(world).length,1);
  world.time+=3;drawV100KingExhaust(ctx,objects,world,point);assert.equal(snapshot(world).length,1);
  world.fighters=Array.from({length:40},(_,i)=>({...world.fighters[0],id:i+100}));world.time+=.2;
  drawV100KingExhaust(ctx,objects,world,point);assert.equal(snapshot(world).length,24);
});

test('death, cancellation and unpainted actors stop emission; stage end and generation reset clear the previous effect',()=>{
  for(const stop of [o=>{o.hp=0;},o=>{o.manualAbility.phase='recovery';},o=>{o.combatReady=false;}]){
    const {world,owner,point}=fixture(),{ctx}=canvas(),objects={[ART['crazy-king'].id]:image()};
    drawV100KingExhaust(ctx,objects,world,point);stop(owner);world.time+=.2;
    drawV100KingExhaust(ctx,objects,world,point);assert.equal(snapshot(world).length,1);
    world.time+=.5;drawV100KingExhaust(ctx,objects,world,point);assert.equal(snapshot(world).length,0);
  }
  const {world,point}=fixture(),{ctx}=canvas(),objects={[ART['crazy-king'].id]:image()};
  drawV100KingExhaust(ctx,objects,world,point);world.time+=.2;drawV100KingExhaust(ctx,objects,world,()=>null);
  assert.equal(snapshot(world).length,1);
  world.battlePresentation.generation++;assert.equal(snapshot(world).length,0);
  drawV100KingExhaust(ctx,objects,world,point);world.over=true;
  drawV100KingExhaust(ctx,objects,world,point);assert.equal(snapshot(world).length,0);
});

test('only the actual King formation with committed matching content prepares this image, always optionally',()=>{
  const art=ART['crazy-king'],options={stageId:V100_STAGE_IDS[1],formationKinds:['crazy-king'],verifiedKingExhaustPaths:[art.path]};
  const plan=requiredBattleAssetPlan(options),entry=plan.stageObjects.find(e=>e.id===art.id);
  assert.equal(entry.optional,true);assert.ok(plan.optionalPaths.includes(art.path));assert.ok(!plan.paths.includes(art.path));
  for(const patch of [{formationKinds:['brute']},{verifiedKingExhaustPaths:[]},{includeV100Sprites:false}]){
    assert.ok(!requiredBattleAssetPlan({...options,...patch}).optionalPaths.includes(art.path));
  }
  const facts={artwork:art,gameBlocked:false,storedHashes:new Set([art.hash])};
  for(const installedManifest of [{assets:[]},{assets:[{path:art.path,hash:'old'}]}])assert.equal(canUseVerifiedPwaArtwork({...facts,installedManifest}),false);
  assert.equal(canUseVerifiedPwaArtwork({...facts,installedManifest:{assets:[{path:art.path,hash:art.hash}]},storedHashes:new Set()}),false);
  assert.equal(canUseVerifiedPwaArtwork({...facts,installedManifest:{assets:[{path:art.path,hash:art.hash}]}}),true);
});

test('the PWA gate imports only generated metadata, and the real body resolver accepts idle without depending on the blade socket',async()=>{
  const leaf=await readFile(new URL('../app/v100KingExhaustArt.js',import.meta.url),'utf8');assert.doesNotMatch(leaf,/^\s*import(?:\s|\{)/mu);
  const gate=await readFile(new URL('../app/PwaGate.tsx',import.meta.url),'utf8');assert.match(gate,/artworks: V100_KING_EXHAUST_ART/u);
  const ash=(await readFile(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8')).replaceAll('\r\n','\n');
  assert.match(ash,/drewArticulatedWalk&&jointPose&&renderKind==='crazy-king'&&options\.world/u);
  assert.match(ash,/sourceBone:V100_KING_EXHAUST_SOCKET\.sourceBone,allowIdle:true/u);
  assert.match(ash,/fighterKingExhaustSockets\.delete\(f\)/u);
});
