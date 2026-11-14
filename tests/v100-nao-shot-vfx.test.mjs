import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parse} from '@babel/parser';

const source=await readFile(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8');
const ast=parse(source,{sourceType:'module',plugins:['typescript','jsx']});
function findNamedProperty(root,name){
 if(!root||typeof root!=='object')return null;
 if(Array.isArray(root)){for(const n of root){const found=findNamedProperty(n,name);if(found)return found;}return null;}
 if(root.type==='ObjectProperty'&&root.key?.name===name)return root.value;
 for(const [key,value]of Object.entries(root)){if(['loc','start','end','extra','comments','tokens'].includes(key))continue;const found=findNamedProperty(value,name);if(found)return found;}
 return null;
}
test('the actual normal-treatment preparation is local and explicit, then leaves healing to the runtime',()=>{
 const method=findNamedProperty(ast,'prepareV100NaoTreatmentProof');assert.ok(method);
 function setup({host='127.0.0.1',search='?qaNaoTreatment=1',external=true,stage=2}={}){
  const game={definition:{missionConfig:{v100StageNumber:stage}},fighters:[
   {id:1,kind:'medic',side:'human',hp:68,maxHp:68,supportCooldown:99,x:300,y:240},
   {id:2,kind:'scout',side:'human',hp:19.2,maxHp:80,supportCooldown:99,x:354,y:240}]};
  let calls=0;const ctx={gameRef:{current:game},window:{location:{hostname:host,search}},URLSearchParams,
   externalSessionActive:external,bridge:{prepareManualAbilityProof(kind){assert.equal(kind,'medic');calls++;return{ownerIds:[1],kinds:['medic']};}}};
  const call=vm.runInNewContext('('+source.slice(method.start,method.end)+')',ctx),before=JSON.stringify(game);
  return {game,call,before,getCalls:()=>calls};
 }
 for(const options of [{host:'example.com'},{search:''},{external:false},{stage:0}]){
  const s=setup(options);assert.equal(s.call(),null);assert.equal(s.getCalls(),0);assert.equal(JSON.stringify(s.game),s.before);
 }
 const s=setup(),result=s.call();assert.equal(s.getCalls(),1);assert.equal(s.game.fighters[0].supportCooldown,0);
 const expected=JSON.parse(s.before);expected.fighters[0].supportCooldown=0;assert.equal(JSON.stringify(s.game),JSON.stringify(expected));
 assert.equal(result.healerId,1);assert.equal(result.patients.length,1);assert.equal(result.patients[0].hp,19.2);
});

// These comparisons bind to the real pre-change treatment and paint output.
import {drawV100NaoTreatmentShot} from '../app/v100NaoShotVfx.js';
import {drawV100BallisticShot} from '../app/v100BallisticVfx.js';
import {drawV100SupportAbilityEffects,queueV100SupportAbilityEffect} from '../app/v100SupportAbilityVfx.js';
import {v100MuzzleFrame,drawV100Muzzle} from '../app/v100CombatVfx.js';
import {weaponDamageEventsFor,weaponProfileForUnit} from '../app/combatPresentation.js';
const gauze={complete:true,naturalWidth:1536,naturalHeight:1024};
function treatmentCanvas(){
 const calls=[],stack=[];const c={globalAlpha:.37,globalCompositeOperation:'multiply',shadowBlur:17,
  save(){stack.push([this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]);},
  restore(){[this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]=stack.pop();},
  drawImage(_image,...args){calls.push({args,alpha:this.globalAlpha,composite:this.globalCompositeOperation,shadow:this.shadowBlur});}};
 return{c,calls,state:()=>[c.globalAlpha,c.globalCompositeOperation,c.shadowBlur],restored(){assert.deepEqual(this.state(),[.37,'multiply',17]);assert.equal(stack.length,0);}};
}
const healPacket=()=>({side:'human',effect:'medic',life:.32,duration:.32,sourceId:1,targetId:2});
const healWorld=()=>({fighters:[{id:1,side:'human',kind:'medic',hp:68,x:300,y:240},{id:2,side:'human',kind:'scout',hp:42,x:360,y:230}]});
const treatmentObjects={'quality-medic-gauze':gauze};

test('all thirteen captured manual-treatment paint outputs remain identical, including canvas state',async()=>{
 const fixture=JSON.parse(await readFile(new URL('./fixtures/v100-medic-mist-manual-baseline.json',import.meta.url),'utf8'));
 assert.equal(fixture.cases.length,13);
 for(const sample of fixture.cases){
  const world={time:10,definition:{missionConfig:{v100StageNumber:2}},fighters:[{...sample.target}]},v=treatmentCanvas();
  assert.equal(queueV100SupportAbilityEffect(world,{ownerId:1,activationId:2,eventType:'medic-impact',targetId:77,x:345,y:212,startedAt:10,duration:.45}),true);
  world.time+=sample.elapsed;drawV100SupportAbilityEffects(v.c,treatmentObjects,world);
  assert.deepEqual(v.calls,sample.calls);assert.deepEqual(v.state(),sample.finalState);v.restored();
 }
});

test('automatic treatment follows its living recipient through all six authored cells without changing simulation or consuming randomness',()=>{
 const world=healWorld(),e=healPacket(),frames=new Set();
 const original=Math.random;Math.random=()=>{throw Error('treatment painting consumed simulation randomness');};
 try{for(let index=0;index<6;index++){
  world.fighters[1].x+=9;world.fighters[1].y-=2;
  const before=JSON.stringify({world,e}),v=treatmentCanvas();
  assert.equal(drawV100NaoTreatmentShot(v.c,treatmentObjects,e,{elapsed:(index+.2)*.32/6,duration:.32},world),true);
  assert.equal(v.calls.length,1);const a=v.calls[0].args;frames.add(a[1]/512*3+a[0]/512);
  assert.equal(a[0],index%3*512);assert.equal(a[1],Math.floor(index/3)*512);
  assert.ok(Math.abs(a[4]+a[6]/2-world.fighters[1].x)<1e-8,'dressing stays centred on the actual recipient');
  assert.ok(a[6]<82,'ordinary treatment is smaller than the manual treatment');
  assert.equal(JSON.stringify({world,e}),before);v.restored();
 }}finally{Math.random=original;}
 assert.equal(frames.size,6);
});

test('missing art, invalid lifetime and dead or lost recipients suppress the old glyph without inventing a shot',()=>{
 const checks=[
  {objects:{}},{objects:{'quality-medic-gauze':{...gauze,complete:false}}},
  {objects:{'quality-medic-gauze':{...gauze,naturalWidth:512}}},
  {shot:{life:0}},{shot:{life:Infinity}},{shot:{targetId:undefined}},
  {time:{elapsed:-.01}},{time:{elapsed:NaN}},{time:{elapsed:.32}},{time:{duration:0}},
  {fighters:[]},{fighters:[{id:2,side:'human',hp:0,x:360,y:230}]},
  {fighters:[{id:2,side:'zombie',hp:42,x:360,y:230}]},
  {fighters:[{id:2,side:'human',hp:42,x:NaN,y:230}]},
  {fighters:[{id:1,side:'human',kind:'ranger'},healWorld().fighters[1]]},
 ];
 for(const check of checks){const v=treatmentCanvas(),world=check.fighters?{fighters:check.fighters}:healWorld();
  assert.equal(drawV100NaoTreatmentShot(v.c,check.objects??treatmentObjects,{...healPacket(),...check.shot},{elapsed:.04,duration:.32,...check.time},world),true);
  assert.equal(v.calls.length,0);v.restored();
 }
 const world=healWorld();world.fighters.shift();const afterHealerDeath=treatmentCanvas();
 drawV100NaoTreatmentShot(afterHealerDeath.c,treatmentObjects,healPacket(),{elapsed:.04,duration:.32},world);
 assert.equal(afterHealerDeath.calls.length,1,'completed treatment may finish after its healer has left');
});

test('the actual rifle packet and healing packet cannot exchange treatment and ballistic artwork',()=>{
 const gun={...healPacket(),weapon:'medic',style:'projectile',damageTargetId:7,casing:false,x:300,y:200,tx:480,ty:200};
 const v=treatmentCanvas();assert.equal(drawV100NaoTreatmentShot(v.c,treatmentObjects,gun,{elapsed:.04,duration:.32},healWorld()),false);assert.equal(v.calls.length,0);
 const heal=treatmentCanvas();assert.equal(drawV100BallisticShot(heal.c,{},healPacket(),{weapon:'medic',weaponProfile:weaponProfileForUnit('medic'),x:330,y:200,ux:1,uy:0,p:.2,elapsed:.04,distance:180},{}),false);assert.equal(heal.calls.length,0);
});
function findNode(root,predicate){
 if(!root||typeof root!=='object')return null;
 if(Array.isArray(root)){for(const n of root){const found=findNode(n,predicate);if(found)return found;}return null;}
 if(predicate(root))return root;
 for(const [key,value]of Object.entries(root)){if(['loc','start','end','extra','comments','tokens'].includes(key))continue;const found=findNode(value,predicate);if(found)return found;}
 return null;
}
function canonicalAst(value){
 if(Array.isArray(value))return value.map(canonicalAst);if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value).filter(([key])=>!['loc','start','end','extra','comments','tokens','leadingComments','trailingComments','innerComments'].includes(key)).map(([key,item])=>[key,canonicalAst(item)]));
}
test('the actual automatic-healing block changes only visual source and recipient IDs; healing, timing, audio and ordinary shot damage remain exact',async()=>{
 const fixture=JSON.parse(await readFile(new URL('./fixtures/v100-nao-normal-healing-baseline.json',import.meta.url),'utf8'));
 const old=parse(fixture.automaticHealingBlock,{sourceType:'module',plugins:['typescript']}).program.body[0];
 const current=findNode(ast,n=>n.type==='IfStatement'&&source.slice(n.test.start,n.test.end).replaceAll(' ','')==='f.kind==="medic"&&f.supportCooldown<=0');assert.ok(current);
 const before=canonicalAst(old),after=canonicalAst(current),call=findNode(after,n=>n.type==='CallExpression'&&n.callee?.name==='addShot');assert.ok(call);assert.equal(call.arguments.length,20);
 for(const [index,owner,member]of [[11,'f','id'],[12,'wounded','id']]){
  assert.deepEqual(call.arguments[index],{type:'MemberExpression',object:{type:'Identifier',name:owner},computed:false,property:{type:'Identifier',name:member}});
  call.arguments[index]={type:'Identifier',name:'undefined'};
 }
 assert.equal(call.arguments[13].name,'undefined','healing never supplies an enemy damage target');
 assert.deepEqual(after,before);assert.deepEqual(weaponDamageEventsFor('medic',7.84),fixture.normalDamageEvents);
});

test('the carbine flash uses six existing paint cells, ends promptly and restores canvas state',()=>{
 const frames=new Set();for(let i=0;i<6;i++){
  const sample=v100MuzzleFrame('medic',(i+.2)*.075/6);assert.equal(sample.size,32);frames.add(sample.frame);
 }
 assert.equal(frames.size,6);assert.equal(v100MuzzleFrame('medic',.075),null);assert.equal(v100MuzzleFrame('medic',-.001),null);
 const translations=[],rotations=[],v=treatmentCanvas();v.c.translate=(...a)=>translations.push(a);v.c.rotate=r=>rotations.push(r);
 assert.equal(drawV100Muzzle(v.c,{'v100-muzzle':gauze},{weapon:'medic',elapsed:.03,x:334,y:219,tx:500,ty:250}),true);
 assert.deepEqual(translations,[[334,219]]);assert.equal(rotations.length,1);assert.equal(v.calls.length,1);v.restored();
 assert.ok(source.includes("muzzleOrigin: (V100_WEAPON_SOCKETS[weapon]||weapon==='medic') ? liveSocket??null : undefined,"),'actual renderer uses the live joint muzzle, suppressing a missing source');
});
