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
const drumArt=V100_GROUND_FIRE_BED_ART.drum;
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

test('whisky lights at the contact point and spreads to the full burn footprint',()=>{
 const assets={[art.id]:modern};
 const whisky=effect({sourceUnitKind:'zakimiya',remaining:5});
 const world={areaEffects:[whisky]};
 const width=remaining=>render(assets,{...whisky,remaining},5-remaining,world).calls[0].args[7];
 const fullWidth=whisky.radius*2.2;
 assert.ok(width(5)<fullWidth/3);
 assert.ok(width(5)<width(4.88)&&width(4.88)<fullWidth);
 assert.equal(width(4.65),fullWidth);
 assert.equal(width(.5),fullWidth);
 assert.equal(render(assets,effect({remaining:5,sourceSupplyId:4}),0,{}).calls[0].args[7],fullWidth);
});

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

test('only a drum gets the rising fire, which animates above its ground bed and fades out',()=>{
 const column={...modern};
 const objects={[art.id]:modern,[drumArt.id]:column};
 const drum=effect({sourceSupplyId:4}),whisky=effect({id:8,sourceSupplyId:-100004,sourceUnitKind:'zakimiya'});
 const world={areaEffects:[drum,whisky]};
 const cells=new Set();
 for(let time=0;time<2;time+=1/30){
  const {calls}=render(objects,drum,time,world);
  const ground=calls.filter(c=>c.args[0]===modern),smoke=calls.filter(c=>c.args[0]===column);
  assert.ok(ground.length>0&&smoke.length>0&&calls.length<=4);
  assert.equal(calls[0],ground[0]);
  for(const {args} of smoke){
   const [,sx,sy,,,x,,width,height]=args;
   assert.ok(height>ground[0].args[8]&&Math.abs(x)+width/2<drum.radius*1.6);
   cells.add(sy/256*3+sx/256);
  }
 }
 assert.deepEqual([...cells].sort(),[0,1,2,3,4,5]);
 assert.ok(render(objects,whisky,1,world).calls.every(c=>c.args[0]===modern));
 const full=render(objects,drum,1,world).calls;
 const fade=render(objects,{...drum,remaining:.225},1,world).calls;
 assert.deepEqual(fade.map(c=>c.alpha),full.map(c=>c.alpha/2));
 assert.ok(fade.find(c=>c.args[0]===column).args[8]<full.find(c=>c.args[0]===column).args[8]);
 const lateWorld={areaEffects:[drum]};
 render({[art.id]:modern},drum,0,lateWorld);
 assert.ok(render(objects,drum,1,lateWorld).calls.every(c=>c.args[0]===modern));
});

test('old, partial and unverified installed packs cannot request the fire; exact offline bytes can',()=>{
 const installedManifest={assets:[{path:art.path,hash:art.hash}]},storedHashes=new Set([art.hash]);
 const facts={artworks:{burn:art},installedManifest,storedHashes,gameBlocked:false};
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
 const newInstalled={...facts,artworks:V100_GROUND_FIRE_BED_ART,
  installedManifest:{assets:[...installedManifest.assets,{path:drumArt.path,hash:drumArt.hash}]}};
 assert.equal(verifiedPwaArtworkPaths(newInstalled),art.path);
 const both=verifiedPwaArtworkPaths({...newInstalled,storedHashes:new Set([art.hash,drumArt.hash])}).split('\n');
 assert.deepEqual(new Set(both),new Set([art.path,drumArt.path]));
 for(const stageId of V100_STAGE_IDS){
  const old=requiredBattleAssetPlan({stageId}),current=requiredBattleAssetPlan({stageId,verifiedGroundFirePaths:[valid]});
  assert.ok(!old.stageObjects.some(a=>a.id===art.id));assert.ok(!old.paths.includes(art.path));
  const row=current.stageObjects.find(a=>a.id===art.id);assert.ok(row?.optional);
  assert.ok(current.optionalPaths.includes(art.path));assert.ok(!current.paths.includes(art.path));
  assert.ok(!requiredBattleAssetPlan({stageId,verifiedGroundFirePaths:both}).optionalPaths.includes(drumArt.path));
  assert.ok(!requiredBattleAssetPlan({stageId,verifiedGroundFirePaths:[valid],incendiaryDrumEquipped:true}).optionalPaths.includes(drumArt.path));
  const equipped=requiredBattleAssetPlan({stageId,verifiedGroundFirePaths:both,incendiaryDrumEquipped:true});
  assert.ok(equipped.optionalPaths.includes(drumArt.path));assert.ok(!equipped.paths.includes(drumArt.path));
 }
});

test('the selected fire source reproduces the exact runtime and offline manifest entry',async()=>{
 execFileSync(process.execPath,['scripts/build-v100-ground-fire-art.mjs','--check'],{timeout:30000});
 const manifest=JSON.parse(await readFile('public/asset-manifest.json'));
 for(const entry of [art,drumArt]){
  const bytes=await readFile('public'+entry.path),row=manifest.assets.find(a=>a.path===entry.path);
  assert.equal(row.hash,'sha256-'+createHash('sha256').update(bytes).digest('hex'));assert.equal(row.bytes,bytes.length);
  assert.equal(row.criticality,'critical');assert.equal(row.hash,entry.hash);
 }
 const gate=await readFile('app/PwaGate.tsx','utf8'),game=await readFile('app/AshfallGame.tsx','utf8');
 assert.ok(gate.includes('artworks: V100_GROUND_FIRE_BED_ART, installedManifest, storedHashes, gameBlocked: blocking, baseUrl'));
 assert.ok(game.includes("verifiedGroundFirePaths: battleArtworkPolicyRef.current.paths.split('\\n').filter(Boolean)"));
 assert.ok(game.includes('drawV100GroundFire(ctx, objects, effect, time, world)'));
});
