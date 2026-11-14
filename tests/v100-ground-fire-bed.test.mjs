import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {V100_GROUND_FIRE_BED_ART} from '../app/v100GroundFireArt.js';
import {drawV100GroundFire,clearV100ContactQueue} from '../app/v100CombatVfx.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {verifiedPwaArtworkPaths} from '../app/pwaArtworkAvailability.js';
import {selectBattleArtworkPolicy} from '../app/pwaBattleArtworkContext.js';

const art=V100_GROUND_FIRE_BED_ART.burn;
const modern={complete:true,naturalWidth:768,naturalHeight:512};
const legacy={complete:true,naturalWidth:768,naturalHeight:640};
const effect=(change={})=>({id:7,kind:'burn',phase:'active',x:300,y:200,radius:88,remaining:2,...change});
function render(objects,effect,time,world){
 const calls=[],stack=[];
 const ctx={globalAlpha:.71,globalCompositeOperation:'screen',shadowBlur:9,tx:0,ty:0,flip:1,
  save(){stack.push([this.globalAlpha,this.globalCompositeOperation,this.shadowBlur,this.tx,this.ty,this.flip]);},
  restore(){[this.globalAlpha,this.globalCompositeOperation,this.shadowBlur,this.tx,this.ty,this.flip]=stack.pop();},
  translate(x,y){this.tx+=x;this.ty+=y;},scale(x){this.flip*=x;},rotate(){},
  drawImage(...args){calls.push({args,alpha:this.globalAlpha,tx:this.tx,ty:this.ty,flip:this.flip});}};
 const result=drawV100GroundFire(ctx,objects,effect,time,world);
 assert.deepEqual([ctx.globalAlpha,ctx.globalCompositeOperation,ctx.shadowBlur,ctx.tx,ctx.ty,ctx.flip],[.71,'screen',9,0,0,1]);
 assert.equal(stack.length,0);
 return {result,calls};
}

test('a live fire keeps its selected raster across cloned effects, late decoding and battle isolation',()=>{
 const first=effect(),world={areaEffects:[first]},other={areaEffects:[first]};
 const objects={'v100-ground-fire':legacy,[art.id]:{complete:false,naturalWidth:768,naturalHeight:512}};
 assert.ok(render(objects,first,10,world).calls.every(c=>c.args[0]===legacy));
 objects[art.id]=modern;
 assert.ok(render(objects,{...first,remaining:1.8},10.2,world).calls.every(c=>c.args[0]===legacy),'late decode must not pop a live burn');
 assert.ok(render(objects,{...first},10.2,other).calls.every(c=>c.args[0]===modern),'same ID in another battle is independent');
 const second=effect({id:8});world.areaEffects=[first,second];
 assert.ok(render(objects,second,10.2,world).calls.every(c=>c.args[0]===modern),'the next burn can use prepared art');
 delete objects[art.id];
 assert.ok(render(objects,{...second},10.3,world).calls.every(c=>c.args[0]===modern),'prepared source remains stable');
 clearV100ContactQueue(world);
 assert.ok(render(objects,{...second},0,world).calls.every(c=>c.args[0]===legacy),'existing reset clears visual choice');
});

test('all six fire cells animate inside the real footprint and fade out without consuming simulation randomness',async()=>{
 const e=effect(),world={areaEffects:[e],fighters:[{id:1,hp:31,burning:1.7}],randomState:17};
 const before=JSON.stringify(world),frames=new Set(),oldRandom=Math.random;
 const {data,info}=await sharp('public'+art.path).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 try{
  Math.random=()=>{throw new Error('drawing must not advance simulation randomness');};
  for(let time=0;time<2;time+=1/60){
   const {calls}=render({[art.id]:modern}, {...e},time,world);
   assert.ok(calls.length>=1&&calls.length<=2);
   for(const {args,alpha} of calls){
    const [,sx,sy,sw,sh,dx,dy,width,height]=args;
    assert.deepEqual([sw,sh],[256,256]);assert.ok(alpha>0&&alpha<=.96);
    assert.equal(dx,-width*art.anchorX);assert.equal(dy,-height*art.anchorY);
    frames.add(sy/256*3+sx/256);
    for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(data[((sy+y)*info.width+sx+x)*4+3]>32){
     assert.ok(Math.abs(dx+(x+.5)/256*width)<e.radius,'painted fire remains within the existing horizontal danger area');
    }
   }
  }
 }finally{Math.random=oldRandom;}
 assert.deepEqual([...frames].sort(),[0,1,2,3,4,5]);assert.equal(JSON.stringify(world),before);
 const full=render({[art.id]:modern},e,1,world),fade=render({[art.id]:modern},{...e,remaining:.225},1,world);
 assert.equal(fade.calls[0].alpha,full.calls[0].alpha/2);
 for(const change of [{remaining:0},{remaining:-1},{phase:'expired'},{radius:0},{x:NaN},{id:Infinity}]){
  const result=render({[art.id]:modern},{...e,...change},1,world);assert.equal(result.result,false);assert.equal(result.calls.length,0);
 }
});

test('old, partial and unverified installed packs cannot request the fire; exact offline bytes can',()=>{
 const installedManifest={assets:[{path:art.path,hash:art.hash}]},storedHashes=new Set([art.hash]);
 const facts={artworks:V100_GROUND_FIRE_BED_ART,installedManifest,storedHashes,gameBlocked:false};
 const valid=verifiedPwaArtworkPaths(facts);assert.equal(valid,art.path);
 for(const changes of [{installedManifest:{assets:[]}},{storedHashes:new Set()},{gameBlocked:true},
  {installedManifest:{assets:[{path:art.path,hash:'previous-content'}]}}]){
  assert.equal(verifiedPwaArtworkPaths({...facts,...changes,browserPlayAccepted:true}),'');
 }
 assert.equal(verifiedPwaArtworkPaths({...facts,installedManifest:null,browserPlayAccepted:true}),art.path);
 assert.equal(verifiedPwaArtworkPaths({...facts,installedManifest:null}), '');
 const locked=selectBattleArtworkPolicy(null,'same-stage','');
 assert.equal(selectBattleArtworkPolicy(locked,'same-stage',valid).paths,'','no mid-battle preparation expansion');
 assert.equal(selectBattleArtworkPolicy(locked,'next-stage',valid).paths,valid);
 for(const stageId of V100_STAGE_IDS){
  const old=requiredBattleAssetPlan({stageId}),current=requiredBattleAssetPlan({stageId,verifiedGroundFirePaths:[valid]});
  assert.ok(!old.stageObjects.some(a=>a.id===art.id));assert.ok(!old.paths.includes(art.path));
  const row=current.stageObjects.find(a=>a.id===art.id);assert.ok(row?.optional);
  assert.ok(current.optionalPaths.includes(art.path));assert.ok(!current.paths.includes(art.path));
 }
});

test('the selected fire source reproduces the exact runtime and offline manifest entry',async()=>{
 execFileSync(process.execPath,['scripts/build-v100-ground-fire-art.mjs','--check'],{timeout:30000});
 const bytes=await readFile('public'+art.path),manifest=JSON.parse(await readFile('public/asset-manifest.json'));
 const row=manifest.assets.find(a=>a.path===art.path);
 assert.equal(row.hash,'sha256-'+createHash('sha256').update(bytes).digest('hex'));assert.equal(row.bytes,bytes.length);
 assert.equal(row.criticality,'critical');assert.equal(row.hash,art.hash);
 const gate=await readFile('app/PwaGate.tsx','utf8'),game=await readFile('app/AshfallGame.tsx','utf8');
 assert.ok(gate.includes('artworks: V100_GROUND_FIRE_BED_ART, installedManifest, storedHashes, gameBlocked: blocking, baseUrl'));
 assert.ok(game.includes("verifiedGroundFirePaths: battleArtworkPolicyRef.current.paths.split('\\n').filter(Boolean)"));
 assert.ok(game.includes('drawV100GroundFire(ctx, objects, effect, time, world)'));
});
