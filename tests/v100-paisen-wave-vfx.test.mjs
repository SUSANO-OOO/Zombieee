import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import * as waves from '../app/v105PaisenFistWave.js';
import {V100_PAISEN_WAVE_ART as ART} from '../app/v100PaisenWaveArt.js';
import {V100_MANUAL_IMPACT_ART} from '../app/v100ManualImpactArt.js';
import {MANUAL_ABILITY_REGISTRY} from '../app/manualAbilities.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {canUseVerifiedPwaArtwork} from '../app/pwaArtworkAvailability.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';

const image=(id,w=768,h=512)=>({id,complete:true,naturalWidth:w,naturalHeight:h});
const legacy=image('legacy',256,94),dust=image('dust',512,512);
const objects=()=>({'v105-fist-wave':legacy,'v100-dust':dust,[ART.id]:image('new')});
function canvas(){
 const rows=[],stack=[];
 return {rows,globalAlpha:.61,globalCompositeOperation:'xor',shadowBlur:9,
  save(){stack.push([this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]);},
  restore(){[this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]=stack.pop();},
  translate(){},rotate(){},drawImage(...args){rows.push({args,alpha:this.globalAlpha,composite:this.globalCompositeOperation,blur:this.shadowBlur});}};
}
function launch(){
 const owner={id:1,kind:'brawler',side:'human',hp:100,combatReady:true,x:100,y:300,manualAbility:{activationId:1,phase:'recovery'}};
 const target={id:9,side:'zombie',hp:1000,combatReady:true,bodyRadius:16,x:240,y:300};
 const world={time:.26,fighters:[owner,target]};
 const event={activationId:1,target:{x:240,y:300,direction:1}};
 assert.equal(waves.queueV105FistWave(world,owner,event,MANUAL_ABILITY_REGISTRY.brawler),true);
 assert.equal(waves.resolveV105FistWavePaint(world,owner,{x:145,y:268},{activationId:1,sourceAtlas:'/current-paisen.webp',paintedAt:.26}),true);
 return {world,owner,target};
}
const frame=row=>row.args.length===9?row.args[1]/256+row.args[2]/256*3:null;

test('the visual change keeps all four existing simulation and receipt functions byte-identical',async()=>{
 const oldSource=execFileSync('git',['show','4ed3f08f98a119a9261ab1e9b2d1d69abc5c0039:app/v105PaisenFistWave.js'],{encoding:'utf8',windowsHide:true});
 const old=await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64'));
 for(const name of ['queueV105FistWave','resolveV105FistWavePaint','advanceV105FistWaves','v105FistWaveSnapshot'])
  assert.equal(waves[name].toString().replaceAll('\r\n','\n'),old[name].toString().replaceAll('\r\n','\n'),name);
 assert.equal(ART.impactSeconds,.3);
 assert.equal(MANUAL_ABILITY_REGISTRY.brawler.range,150);
 assert.equal(MANUAL_ABILITY_REGISTRY.brawler.projectileRadius,8);
 assert.equal(MANUAL_ABILITY_REGISTRY.brawler.projectileSpeed,540);
 assert.equal(MANUAL_ABILITY_REGISTRY.brawler.impactDamage,280);
});

test('flight uses distinct real atlas cells without changing battle state or leaking canvas settings',()=>{
 const {world}=launch(),ctx=canvas(),art=objects(),seen=new Set();
 for(const age of [0,.05,.1,.16]){
  world.time=.26+age;const before=waves.v105FistWaveSnapshot(world);ctx.rows.length=0;
  waves.drawV105FistWaves(ctx,art,world);
  assert.deepEqual(waves.v105FistWaveSnapshot(world),before);
  assert.ok(ctx.rows.length>0&&ctx.rows.length<=2);
  for(const row of ctx.rows){assert.equal(row.args[0].id,'new');seen.add(frame(row));assert.equal(row.composite,'source-over');assert.equal(row.blur,0);assert.ok(row.alpha>0&&row.alpha<=1);assert.ok(row.args.slice(1).every(Number.isFinite));}
  assert.deepEqual([ctx.globalAlpha,ctx.globalCompositeOperation,ctx.shadowBlur],[.61,'xor',9]);
 }
 assert.deepEqual([...seen].sort(),[0,1,2]);
});

test('one real collision owns three distinct impact cells and expires at the existing .30 second boundary',()=>{
 const {world,target}=launch(),ctx=canvas(),art=objects();
 waves.drawV105FistWaves(ctx,art,world);world.time=.52;
 const events=waves.advanceV105FistWaves(world,world.fighters);
 assert.equal(events.filter(e=>e.type==='contact').length,1);assert.equal(events.find(e=>e.type==='contact').target,target);
 const seen=new Set();
 for(const age of [0,.135,.27]){
  world.time=.52+age;ctx.rows.length=0;waves.drawV105FistWaves(ctx,art,world);
  assert.ok(ctx.rows.length>0&&ctx.rows.length<=2);
  for(const row of ctx.rows){assert.equal(row.args[0].id,'new');assert.equal(row.composite,'source-over');seen.add(frame(row));}
 }
 assert.deepEqual([...seen].sort(),[3,4,5]);
 world.time=.821;waves.advanceV105FistWaves(world,world.fighters);ctx.rows.length=0;waves.drawV105FistWaves(ctx,art,world);assert.deepEqual(ctx.rows,[]);
});

test('missing, late or malformed optional material keeps the old flight and impact for that same activation',()=>{
 for(const optional of [undefined,{...image('incomplete'),complete:false},image('wrong',768,256),image('invalid',Infinity,512)]){
  const {world,owner}=launch(),ctx=canvas(),art=objects();art[ART.id]=optional;
  waves.drawV105FistWaves(ctx,art,world);assert.equal(ctx.rows[0].args[0].id,'legacy');
  art[ART.id]=image('late');world.time=.30;ctx.rows.length=0;waves.drawV105FistWaves(ctx,art,world);assert.equal(ctx.rows[0].args[0].id,'legacy');
  world.time=.52;waves.advanceV105FistWaves(world,world.fighters);ctx.rows.length=0;waves.drawV105FistWaves(ctx,art,world);assert.equal(ctx.rows[0].args[0].id,'dust');
  world.time=1;waves.advanceV105FistWaves(world,world.fighters);owner.manualAbility.activationId=2;
  assert.equal(waves.queueV105FistWave(world,owner,{activationId:2,target:{x:240,y:300,direction:1}},MANUAL_ABILITY_REGISTRY.brawler),true);
  assert.equal(waves.resolveV105FistWavePaint(world,owner,{x:145,y:268},{activationId:2,sourceAtlas:'/current-paisen.webp',paintedAt:1}),true);
  ctx.rows.length=0;waves.drawV105FistWaves(ctx,art,world);assert.equal(ctx.rows[0].args[0].id,'late');
 }
});

test('reset and ended battles remove all old material decisions and paint',()=>{
 const {world}=launch(),ctx=canvas(),art=objects();delete art[ART.id];waves.drawV105FistWaves(ctx,art,world);
 waves.clearV105FistWaves(world);ctx.rows.length=0;waves.drawV105FistWaves(ctx,objects(),world);assert.deepEqual(ctx.rows,[]);
 const next=launch();next.world.over=true;waves.drawV105FistWaves(ctx,objects(),next.world);assert.deepEqual(ctx.rows,[]);
});

test('only an actual Paisen formation with a verified committed artwork may request the optional material',()=>{
 const options={stageId:V100_STAGE_IDS[1],formationKinds:['brawler'],verifiedManualImpactPaths:[ART.path]};
 const plan=requiredBattleAssetPlan(options);assert.ok(plan.optionalPaths.includes(ART.path));assert.ok(!plan.paths.includes(ART.path));
 for(const patch of [{formationKinds:['scout']},{verifiedManualImpactPaths:[]},{includeV100Sprites:false}])assert.ok(!requiredBattleAssetPlan({...options,...patch}).optionalPaths.includes(ART.path));
 const facts={artwork:ART,gameBlocked:false,storedHashes:new Set([ART.hash]),browserPlayAccepted:true,installedManifest:{assets:[{path:ART.path,hash:ART.hash}]}};
 assert.equal(canUseVerifiedPwaArtwork(facts),true);
 for(const patch of [{installedManifest:{assets:[]}},{installedManifest:{assets:[{path:ART.path,hash:'wrong'}]}},{storedHashes:new Set()},{gameBlocked:true}])assert.equal(canUseVerifiedPwaArtwork({...facts,...patch}),false);
 assert.deepEqual(V100_MANUAL_IMPACT_ART.brawler,ART);
});

test('selected authored cells have clean gutters and the old rejected crop remains a real negative example',async()=>{
 const folder='assets/source/quality-20261115/paisen-wave-r1';
 for(const [file,expected]of [['generated-r3.png',true],['generated-r1.png',false]]){
  const {data,info}=await sharp(await readFile(folder+'/'+file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([info.width,info.height],[1536,1024]);let clean=true;
  for(let cell=0;cell<6;cell++)for(let y=0;y<512;y++)for(let x=0;x<512;x++){
   if(x>=32&&x<480&&y>=32&&y<480)continue;
   if(data[((Math.floor(cell/3)*512+y)*1536+cell%3*512+x)*4+3]>32)clean=false;
  }
  assert.equal(clean,expected,file);
 }
 const asset=await readFile('public'+ART.path);assert.equal('sha256-'+createHash('sha256').update(asset).digest('hex'),ART.hash);
 for(const anchor of ART.anchors)assert.ok(anchor.every(n=>Number.isFinite(n)&&n>0&&n<1));
});

test('the selected source regenerates the exact phone runtime and provenance without writing',()=>{
 execFileSync(process.execPath,['scripts/build-v100-paisen-wave-art.mjs','--check'],{windowsHide:true,stdio:'pipe'});
});
