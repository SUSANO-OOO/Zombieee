import assert from 'node:assert/strict';
import test from 'node:test';
import {drawV100MaterialParticle,particleMaterialCell} from '../app/v100MaterialParticles.js';
import {V100_PARTICLE_MATERIAL_ART} from '../app/v100ParticleMaterialArt.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {verifiedPwaArtworkPaths} from '../app/pwaArtworkAvailability.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';

const art=V100_PARTICLE_MATERIAL_ART.particles;
const particle=()=>({x:100,y:150,vx:-24,vy:-60,life:.6,size:5,color:'#f06835'});
const atlas=()=>({complete:true,naturalWidth:768,naturalHeight:512});
function fixture(){
 const draws=[],surfaces=[],stack=[],transforms=[];
 const ctx={globalAlpha:.4,globalCompositeOperation:'screen',shadowBlur:8,
  save(){stack.push([this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]);},
  restore(){[this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]=stack.pop();},
  translate(...args){transforms.push(['translate',...args]);},rotate(...args){transforms.push(['rotate',...args]);},
  drawImage(...args){draws.push({args,alpha:this.globalAlpha,composite:this.globalCompositeOperation});}};
 function createRasterSurface(width,height){const calls=[],surface={width,height,calls,getContext(){return {drawImage(...args){calls.push(['image',...args]);},fillRect(...args){calls.push(['tint',...args]);}};}};surfaces.push(surface);return surface;}
 return {ctx,draws,surfaces,stack,transforms,createRasterSurface};
}
test('a real small raster fragment replaces the shared ellipse without mutating the particle or canvas state',()=>{
 const p=particle(),before=structuredClone(p),f=fixture();
 assert.equal(drawV100MaterialParticle(f.ctx,{'v100-particle-materials':atlas()},p,f),true);
 assert.deepEqual(p,before);assert.equal(f.draws.length,1);assert.equal(f.draws[0].args[0],f.surfaces[0]);
 assert.equal(f.draws[0].args[3],48);assert.equal(f.draws[0].args[4],48);
 assert.ok(f.draws[0].args[7]<=p.size*2.9&&f.draws[0].args[7]>=p.size*2.15);
 assert.equal(f.draws[0].alpha,.96);assert.equal(f.draws[0].composite,'source-over');
 assert.deepEqual([f.ctx.globalAlpha,f.ctx.globalCompositeOperation,f.ctx.shadowBlur],[.4,'screen',8]);assert.equal(f.stack.length,0);
});
test('drawing does not consume simulation randomness, including first-time tint creation',()=>{
 const f=fixture(),original=Math.random;Math.random=()=>{throw new Error('Simulation randomness consumed');};
 try{assert.equal(drawV100MaterialParticle(f.ctx,{'v100-particle-materials':atlas()},particle(),f),true);}finally{Math.random=original;}
});
test('a late optional image cannot change a live fragment; a reused pool entry or a new battle can select it',()=>{
 const f=fixture(),p=particle(),dust={complete:true,naturalWidth:64,naturalHeight:64},world={time:1,battlePresentation:{generation:0}};
 const objects={'v100-dust':dust},options={...f,world};
 drawV100MaterialParticle(f.ctx,objects,p,options);assert.equal(f.draws.at(-1).args[0],dust);
 objects['v100-particle-materials']=atlas();world.time+=.1;p.life-=.1;p.x+=4;p.vy+=18;
 drawV100MaterialParticle(f.ctx,objects,p,options);assert.equal(f.draws.at(-1).args[0],dust);
 world.time+=1;p.life=.8;drawV100MaterialParticle(f.ctx,objects,p,options);
 assert.equal(f.draws.at(-1).args[0],f.surfaces[0]);
 world.battlePresentation.generation++;delete objects['v100-particle-materials'];
 drawV100MaterialParticle(f.ctx,objects,p,options);assert.equal(f.draws.at(-1).args[0],dust);
});
test('gravity, movement, fading and collection compaction cannot change a born particle material',()=>{
 const p=particle(),cell=particleMaterialCell(p);
 assert.equal(particleMaterialCell({...p,x:12,y:290,vy:99,life:.1}),cell);
 const variants=new Set();for(let i=0;i<200;i++)for(const color of ['#f06835','#b72d52','#c7e4ef'])variants.add(particleMaterialCell({...p,size:2+i/50,vx:i-100,color}));
 assert.deepEqual([...variants].sort(),[0,1,2,3,4,5]);
});
test('the same tint is reused and phone tint surfaces stay bounded at24 tiny atlases',()=>{
 const f=fixture(),image=atlas(),p=particle();
 for(let i=0;i<3;i++)drawV100MaterialParticle(f.ctx,{'v100-particle-materials':image},p,f);
 assert.equal(f.surfaces.length,1);
 for(let i=0;i<60;i++)drawV100MaterialParticle(f.ctx,{'v100-particle-materials':image},{...p,color:'#'+i.toString(16).padStart(6,'0')},f);
 const alive=f.surfaces.filter(s=>s.width&&s.height);assert.equal(alive.length,24);
 assert.ok(alive.reduce((n,s)=>n+s.width*s.height*4,0)<=24*144*96*4);
 assert.ok(f.surfaces.some(s=>s.width===0&&s.height===0));
});
test('unavailable canvas tinting is tried once and uses the already required natural dust texture',()=>{
 const f=fixture(),image=atlas(),dust={complete:true,naturalWidth:64,naturalHeight:64};let attempts=0;
 const options={createRasterSurface(){attempts++;throw new Error('No2d surface');}};
 for(let i=0;i<3;i++)assert.equal(drawV100MaterialParticle(f.ctx,{'v100-particle-materials':image,'v100-dust':dust},particle(),options),true);
 assert.equal(attempts,1);assert.ok(f.draws.every(d=>d.args[0]===dust));
});
test('missing, failed and incorrectly sized optional art retains the required dust path',()=>{
 for(const image of [undefined,{complete:false,naturalWidth:768,naturalHeight:512},{complete:true,naturalWidth:1,naturalHeight:1}]){
  const f=fixture(),dust={complete:true,naturalWidth:64,naturalHeight:64};
  assert.equal(drawV100MaterialParticle(f.ctx,{'v100-particle-materials':image,'v100-dust':dust},particle(),f),true);
  assert.equal(f.draws[0].args[0],dust);assert.equal(f.surfaces.length,0);
 }
});
test('expired, invalid or unrenderable particles create no surface and no drawing',()=>{
 for(const p of [null,{...particle(),life:0},{...particle(),x:NaN},{...particle(),size:-1}]){
  const f=fixture();assert.equal(drawV100MaterialParticle(f.ctx,{'v100-particle-materials':atlas()},p,f),false);assert.equal(f.draws.length,0);assert.equal(f.surfaces.length,0);
 }
 const f=fixture();assert.equal(drawV100MaterialParticle(f.ctx,{},particle(),f),false);assert.equal(f.draws.length,0);
});
test('an old, partial, blocked or hash-mismatched installation never requests the new material',()=>{
 const installedManifest={assets:[{path:art.path,hash:art.hash}]},storedHashes=new Set([art.hash]);
 const negative=[{}, {installedManifest:{assets:[]},storedHashes,browserPlayAccepted:true},{installedManifest,storedHashes:new Set()},
  {installedManifest:{assets:[{path:art.path,hash:'wrong'}]},storedHashes},{installedManifest,storedHashes,gameBlocked:true}];
 for(const facts of negative){const paths=verifiedPwaArtworkPaths({artworks:V100_PARTICLE_MATERIAL_ART,gameBlocked:false,...facts});assert.equal(paths,'');
  const plan=requiredBattleAssetPlan({stageId:V100_STAGE_IDS[0],verifiedParticleMaterialPaths:paths.split('\n').filter(Boolean)});assert.equal(plan.stageObjects.some(o=>o.id===art.id),false);}
 for(const facts of [{installedManifest,storedHashes},{browserPlayAccepted:true}])assert.equal(verifiedPwaArtworkPaths({artworks:V100_PARTICLE_MATERIAL_ART,gameBlocked:false,...facts}),art.path);
});
test('all V1 stages keep their mandatory decode, while the verified texture is optional and legacy plans stay unchanged',()=>{
 for(const stageId of V100_STAGE_IDS){const baseline=requiredBattleAssetPlan({stageId}),enabled=requiredBattleAssetPlan({stageId,verifiedParticleMaterialPaths:[art.path]});
  assert.deepEqual(enabled.paths,baseline.paths);assert.deepEqual(enabled.sprites,baseline.sprites);assert.deepEqual(enabled.cards,baseline.cards);
  assert.deepEqual(enabled.optionalPaths,[art.path]);assert.equal(enabled.stageObjects.find(o=>o.id===art.id).optional,true);
  assert.equal(requiredBattleAssetPlan({stageId,includeV100Sprites:false,verifiedParticleMaterialPaths:[art.path]}).stageObjects.some(o=>o.id===art.id),false);
 }
});
