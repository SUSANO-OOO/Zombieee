import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {V100_MANUAL_IMPACT_ART as ART} from '../app/v100ManualImpactArt.js';
import {drawV100TataraImpact} from '../app/v100ManualImpactVfx.js';
import {drawV100ContactQueue,getV100SkillContactSnapshot,queueV100TataraGroundContact,queueV100TakuyaGroundContact} from '../app/v100CombatVfx.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {canUseVerifiedPwaArtwork} from '../app/pwaArtworkAvailability.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {advanceAreaEffects} from '../app/gameRules.js';

const image=(id,width=1536,height=1024)=>({id,complete:true,naturalWidth:width,naturalHeight:height});
function canvas(){
 const calls=[],stack=[],ctx={globalAlpha:1,globalCompositeOperation:'screen',shadowBlur:3,
  save(){stack.push([this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]);},
  restore(){[this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]=stack.pop();},
  translate(){},scale(){},drawImage(...args){calls.push({args,alpha:this.globalAlpha});}};
 return {ctx,calls,stack};
}
function fixture(){
 const owner={id:7,kind:'brute',side:'human',hp:80,x:300,y:250,manualAbility:{activationId:2}};
 const world={time:10,definition:{missionConfig:{v100StageNumber:2}},fighters:[owner]};
 const point={x:311,y:251,sourcePath:'/art/approved-current-tatara.webp',sourcePixel:{x:81,y:491}};
 return {world,owner,point};
}

test('Tatara paint waits for the measured hammer socket and does not change the real game state',()=>{
 const {world,owner,point}=fixture(),{ctx,calls,stack}=canvas();
 const objects={'v100-ground-impact':image('old'),[ART.brute.id]:image('new')};
 const before=structuredClone(world);queueV100TataraGroundContact(world,{owner});
 drawV100ContactQueue(ctx,objects,world,null,null,()=>null);assert.equal(calls.length,0);
 drawV100ContactQueue(ctx,objects,world,null,null,()=>point);
 assert.ok(calls.some(c=>c.args[0]===objects[ART.brute.id]));
 assert.equal(calls.filter(c=>c.args[0]===objects['v100-ground-impact']).length,0);
 const contact=getV100SkillContactSnapshot(world)[0];
 assert.equal(contact.x,point.x);assert.equal(contact.y,point.y);
 assert.equal(contact.effectSourcePath,ART.brute.path);assert.equal(contact.bodySourcePath,point.sourcePath);
 assert.deepEqual(world,before);assert.equal(ctx.globalAlpha,1);assert.equal(ctx.globalCompositeOperation,'screen');assert.equal(stack.length,0);
});

test('a real fighter clone and a late decode do not replace the running fallback, but a later activation can use it',()=>{
 const {world,owner,point}=fixture(),{ctx,calls}=canvas(),old=image('old'),objects={'v100-ground-impact':old};
 queueV100TataraGroundContact(world,{owner});drawV100ContactQueue(ctx,objects,world,null,null,()=>point);
 world.fighters=advanceAreaEffects({fighters:world.fighters,areaEffects:[],seconds:.016}).fighters;
 assert.notEqual(world.fighters[0],owner);world.time+=.1;objects[ART.brute.id]=image('new');calls.length=0;
 drawV100ContactQueue(ctx,objects,world,null,null,()=>point);
 assert.equal(calls.filter(c=>c.args[0]===objects[ART.brute.id]).length,0);assert.ok(calls.some(c=>c.args[0]===old));
 world.time+=.6;world.fighters[0].manualAbility.activationId++;
 queueV100TataraGroundContact(world,{owner:world.fighters[0]});calls.length=0;
 drawV100ContactQueue(ctx,objects,world,null,null,()=>point);assert.ok(calls.some(c=>c.args[0]===objects[ART.brute.id]));
});

test('preferred material stays selected if the optional lookup changes during its short lifetime',()=>{
 const {world,owner,point}=fixture(),{ctx,calls}=canvas(),preferred=image('new');
 const objects={'v100-ground-impact':image('old'),[ART.brute.id]:preferred};
 queueV100TataraGroundContact(world,{owner});drawV100ContactQueue(ctx,objects,world,null,null,()=>point);
 delete objects[ART.brute.id];world.time+=.12;calls.length=0;drawV100ContactQueue(ctx,objects,world,null,null,()=>point);
 assert.ok(calls.some(c=>c.args[0]===preferred));assert.equal(calls.filter(c=>c.args[0]===objects['v100-ground-impact']).length,0);
});

test('missing, broken and malformed optional material keeps the existing contact',()=>{
 for(const candidate of [undefined,{...image('bad'),complete:false},image('bad',0,0),image('bad',1536,512),image('bad',Infinity,1024)]){
  const {world,owner,point}=fixture(),{ctx,calls}=canvas(),old=image('old');
  queueV100TataraGroundContact(world,{owner});drawV100ContactQueue(ctx,{'v100-ground-impact':old,[ART.brute.id]:candidate},world,null,null,()=>point);
  assert.equal(calls.length,1);assert.equal(calls[0].args[0],old);
 }
});

test('all six cells blend at the unchanged 180px contact, then stop without a new impact',()=>{
 const {ctx,calls}=canvas(),preferred=image('new'),entry={x:311,y:251,size:180,duration:.6,tataraGroundContact:{resolvedSocket:true}};
 for(const elapsed of [0,.12,.24,.36,.48,.58])assert.equal(drawV100TataraImpact(ctx,{[ART.brute.id]:preferred},entry,elapsed),true);
 assert.equal(new Set(calls.map(c=>c.args[1]/512+c.args[2]/512*3)).size,6);
 assert.ok(calls.every(c=>c.args.slice(1).every(Number.isFinite)&&c.args[7]===180&&c.args[8]===180&&c.alpha>0&&c.alpha<=1));
 assert.equal(drawV100TataraImpact(ctx,{[ART.brute.id]:preferred},entry,.6),false);
 for(const patch of [{x:NaN},{size:0},{size:Infinity},{tataraGroundContact:{resolvedSocket:false}}])assert.equal(drawV100TataraImpact(ctx,{[ART.brute.id]:preferred},{...entry,...patch},.1),false);
});

test('the actual formation and committed path are both required, and the new image is never a battle blocker',()=>{
 const options={stageId:V100_STAGE_IDS[1],formationKinds:['brute'],verifiedManualImpactPaths:[ART.brute.path]};
 const plan=requiredBattleAssetPlan(options),entry=plan.stageObjects.find(e=>e.id===ART.brute.id);
 assert.equal(entry.optional,true);assert.ok(plan.optionalPaths.includes(ART.brute.path));assert.ok(!plan.paths.includes(ART.brute.path));
 for(const patch of [{formationKinds:['scout']},{verifiedManualImpactPaths:[]},{includeV100Sprites:false}])assert.ok(!requiredBattleAssetPlan({...options,...patch}).optionalPaths.includes(ART.brute.path));
 const facts={artwork:ART.brute,gameBlocked:false,storedHashes:new Set([ART.brute.hash]),browserPlayAccepted:true};
 assert.equal(canUseVerifiedPwaArtwork({...facts,installedManifest:{assets:[]}}),false);
 assert.equal(canUseVerifiedPwaArtwork({...facts,installedManifest:{assets:[{path:ART.brute.path,hash:'old'}]}}),false);
 assert.equal(canUseVerifiedPwaArtwork({...facts,installedManifest:{assets:[{path:ART.brute.path,hash:ART.brute.hash}]},storedHashes:new Set()}),false);
 assert.equal(canUseVerifiedPwaArtwork({...facts,installedManifest:{assets:[{path:ART.brute.path,hash:ART.brute.hash}]}}),true);
});

test('TAKUYA keeps its own existing ground material and pending-contact cancellation still applies',()=>{
 const {world,owner,point}=fixture(),{ctx,calls}=canvas(),old=image('old');owner.kind='takuya';owner.side='zombie';
 queueV100TakuyaGroundContact(world,{owner});drawV100ContactQueue(ctx,{'v100-ground-impact':old,[ART.brute.id]:image('new')},world,null,()=>point);
 assert.equal(calls.length,1);assert.equal(calls[0].args[0],old);
 const other=fixture();queueV100TataraGroundContact(other.world,{owner:other.owner});other.owner.manualAbility.activationId++;
 drawV100ContactQueue(ctx,{'v100-ground-impact':old},other.world,null,null,()=>point);assert.equal(getV100SkillContactSnapshot(other.world).length,0);
});

test('the PWA entry imports the data-only manual metadata leaf',async()=>{
 const leaf=await readFile(new URL('../app/v100ManualImpactArt.js',import.meta.url),'utf8');assert.doesNotMatch(leaf,/^\s*import(?:\s|\{)/mu);
 const gate=await readFile(new URL('../app/PwaGate.tsx',import.meta.url),'utf8');assert.match(gate,/artworks: V100_MANUAL_IMPACT_ART/u);
});
