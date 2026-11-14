import assert from 'node:assert/strict';
import test from 'node:test';
import {V100_BOSS_ATTACK_ART as ART} from '../app/v100BossAttackArt.js';
import {drawV100TakuyaGroundRelease,drawV100GateChargeTrail,drawV100KuromeRay} from '../app/v100BossAttackVfx.js';
import {drawV100ContactQueue,getV100SkillContactSnapshot,queueV100TakuyaGroundContact} from '../app/v100CombatVfx.js';
import {beginTicketGateEaterCharge,advanceTicketGateEaterCharge,STATION_ENEMY_TUNING} from '../app/stationEnemyMechanics.js';
import {advanceAreaEffects} from '../app/gameRules.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';

const image=(id,width=1536,height=1024)=>({id,complete:true,naturalWidth:width,naturalHeight:height});
function canvas(){
 const calls=[],transforms=[],stack=[],ctx={globalAlpha:.9,globalCompositeOperation:'screen',shadowBlur:3,
  save(){stack.push([this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]);},
  restore(){[this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]=stack.pop();},
  translate(...v){transforms.push(['translate',...v]);},rotate(...v){transforms.push(['rotate',...v]);},scale(...v){transforms.push(['scale',...v]);},
  drawImage(...args){calls.push({args,alpha:this.globalAlpha});}};
 return {ctx,calls,transforms,stack};
}
const battle=owner=>({time:10,fighters:[owner],battlePresentation:{generation:0},definition:{missionConfig:{v100StageNumber:3}}});

test('TAKUYA material is anchored to the actual sword contact without changing the queued hit or actor',()=>{
 const owner={id:9,kind:'takuya',side:'zombie',hp:180,x:300},world=battle(owner),before=structuredClone(world);
 const {ctx,calls,stack}=canvas(),preferred=image(ART.takuya.id),objects={'v100-ground-impact':image('old'),[ART.takuya.id]:preferred};
 const socket={x:312,y:251,sourceId:'takuya-battle-repaired-v1',kind:'takuya-ground-blade',pixel:{x:188,y:617}};
 queueV100TakuyaGroundContact(world,{owner});drawV100ContactQueue(ctx,objects,world,null,()=>null);assert.equal(calls.length,0);
 drawV100ContactQueue(ctx,objects,world,null,()=>socket);
 assert.ok(calls.some(c=>c.args[0]===preferred));assert.ok(!calls.some(c=>c.args[0]===objects['v100-ground-impact']));
 const contact=getV100SkillContactSnapshot(world)[0];assert.deepEqual(contact.resolvedSocket,socket);assert.equal(contact.effectSourcePath,ART.takuya.path);
 assert.equal(contact.duration,.6);assert.equal(calls[0].args[7],220);assert.equal(calls[0].args[8],170);
 assert.deepEqual(world,before);assert.equal(ctx.globalAlpha,.9);assert.equal(ctx.globalCompositeOperation,'screen');assert.equal(stack.length,0);
});

test('TAKUYA late decode keeps the existing136px fallback through real fighter clones and can change on a later contact',()=>{
 const owner={id:9,kind:'takuya',side:'zombie',hp:180,x:300},world=battle(owner),{ctx,calls}=canvas(),old=image('old'),objects={'v100-ground-impact':old};
 const socket={x:312,y:251,sourceId:'approved',kind:'takuya-ground-blade'};
 queueV100TakuyaGroundContact(world,{owner});drawV100ContactQueue(ctx,objects,world,null,()=>socket);assert.equal(calls[0].args[7],136);
 world.fighters=advanceAreaEffects({fighters:world.fighters,areaEffects:[],seconds:.016}).fighters;world.time+=.1;objects[ART.takuya.id]=image('new');calls.length=0;
 drawV100ContactQueue(ctx,objects,world,null,()=>socket);assert.equal(calls[0].args[0],old);
 world.time+=.6;queueV100TakuyaGroundContact(world,{owner:world.fighters[0]});calls.length=0;
 drawV100ContactQueue(ctx,objects,world,null,()=>socket);assert.equal(calls[0].args[0],objects[ART.takuya.id]);
});

test('TAKUYA missing/broken sheets, unresolved contacts and expired effects never paint a replacement',()=>{
 for(const candidate of [undefined,{...image('bad'),complete:false},image('bad',0,0),image('bad',1536,512),image('bad',Infinity,1024)]){
  const {ctx,calls}=canvas(),entry={x:10,y:20,duration:.6,takuyaGroundContact:{resolvedSocket:true}};
  assert.equal(drawV100TakuyaGroundRelease(ctx,{[ART.takuya.id]:candidate},entry,.1),false);assert.equal(calls.length,0);
 }
 const {ctx}=canvas(),entry={x:10,y:20,duration:.6,takuyaGroundContact:{resolvedSocket:false}};
 assert.equal(drawV100TakuyaGroundRelease(ctx,{[ART.takuya.id]:image('new')},entry,.1),false);
 entry.takuyaGroundContact.resolvedSocket=true;assert.equal(drawV100TakuyaGroundRelease(ctx,{[ART.takuya.id]:image('new')},entry,.6),false);
});

test('the actual early-arriving Gate Eater simulation advances six cells continuously into exposure and leaves game data unchanged',()=>{
 let owner={id:7,kind:'gate-eater',side:'zombie',hp:3200,x:500,y:240,lane:1,combatReady:true};
 const start=beginTicketGateEaterCharge({boss:owner,targetX:460});assert.equal(start.ok,true);
 let runtime={...start.runtime,originX:500},world=battle(owner),elapsed=0;const {ctx,calls}=canvas(),objects={[ART['gate-eater'].id]:image('gate')};
 const tuning=STATION_ENEMY_TUNING.ticketGateEater,firstCells=[],phases=[];
 for(let tick=0;tick<170;tick++){
  const result=advanceTicketGateEaterCharge({runtime,boss:owner,elapsedSeconds:1/60});owner=result.boss;runtime={...result.runtime,originX:500};world.fighters=[owner];world.time+=1/60;elapsed+=1/60;
  const data=structuredClone({world,runtime}),n=calls.length;
  const drawn=drawV100GateChargeTrail(ctx,objects,{world,ownerId:7,x:owner.x,y:owner.y,runtime});
  assert.deepEqual({world,runtime},data,'rendering must not alter motion, phase, damage or save');
  if(drawn){firstCells.push(calls[n].args[1]/512+calls[n].args[2]/512*3);phases.push(runtime.phase);}
  if(elapsed>tuning.windupSeconds+40/150+.4+.1)assert.equal(drawn,false,'trail expires .4s after the actual early arrival');
 }
 assert.ok(phases.includes('charging')&&phases.includes('exposed'));
 assert.equal(new Set(calls.map(c=>c.args[1]/512+c.args[2]/512*3)).size,6);
 assert.ok(firstCells.every((cell,i)=>i===0||cell>=firstCells[i-1]),'no first-frame replay at charge/exposure transition');
 assert.equal(owner.x,460);assert.equal(owner.hp,3200);
});

test('Gate Eater mirrors the trail for real rightward motion, keeps late sources fixed, and adds no windup debris',()=>{
 const owner={id:7,kind:'gate-eater',hp:100},world=battle(owner),{ctx,calls,transforms}=canvas(),objects={};
 const runtime={phase:'charging',remainingSeconds:.8,originX:300,targetX:420,direction:1};
 assert.equal(drawV100GateChargeTrail(ctx,objects,{world,ownerId:7,x:315,y:240,runtime}),false);
 objects[ART['gate-eater'].id]=image('gate');assert.equal(drawV100GateChargeTrail(ctx,objects,{world,ownerId:7,x:330,y:240,runtime}),false,'late decode waits for a later battle');
 const next=battle({...owner});assert.equal(drawV100GateChargeTrail(ctx,objects,{world:next,ownerId:7,x:315,y:240,runtime}),true);
 assert.ok(transforms.some(t=>t[0]==='scale'&&t[1]===-1));calls.length=0;
 for(const phase of ['windup','idle'])assert.equal(drawV100GateChargeTrail(ctx,objects,{world:next,ownerId:7,x:315,y:240,runtime:{...runtime,phase}}),false);
 assert.equal(calls.length,0);
});

test('Kurome maps the painted core to the existing physical eye and target with unchanged hit-width presentation',()=>{
 const owner={id:8,kind:'kurome',hp:4100},world=battle(owner),{ctx,calls,transforms,stack}=canvas(),art=ART.kurome;
 const origin={x:410,y:135},target={x:120,y:175},halfWidth=18,progress=.3;
 const before=structuredClone({world,origin,target});assert.equal(drawV100KuromeRay(ctx,{[art.id]:image('ray')},{world,ownerId:8,origin,target,halfWidth,progress}),true);
 const length=Math.hypot(target.x-origin.x,target.y-origin.y);assert.equal(calls.length,2);
 for(const c of calls){const a=c.args;assert.ok(Math.abs(a[5]+a[7]*art.beamStartX)<1e-8);assert.ok(Math.abs(a[5]+a[7]*art.beamEndX-length)<1e-8);assert.ok(Math.abs(a[6]+a[8]*art.beamAxisY)<1e-8);assert.ok(Math.abs(a[8]*art.beamSpanY-halfWidth*2.4)<1e-8);}
 assert.deepEqual(transforms[0],['translate',origin.x,origin.y]);assert.deepEqual({world,origin,target},before);
 assert.equal(ctx.globalAlpha,.9);assert.equal(ctx.globalCompositeOperation,'screen');assert.equal(stack.length,0);
});

test('Kurome fallback survives actual fighter cloning and does not emit after the real firing window',()=>{
 const owner={id:8,kind:'kurome',hp:4100},world=battle(owner),{ctx,calls}=canvas(),objects={};
 const options={world,ownerId:8,origin:{x:400,y:130},target:{x:120,y:175},halfWidth:18,progress:.1};
 assert.equal(drawV100KuromeRay(ctx,objects,options),false);world.fighters=advanceAreaEffects({fighters:world.fighters,areaEffects:[],seconds:.016}).fighters;
 objects[ART.kurome.id]=image('ray');assert.equal(drawV100KuromeRay(ctx,objects,{...options,progress:.4}),false);
 const later={...options,world:battle({...owner})};assert.equal(drawV100KuromeRay(ctx,objects,later),true);calls.length=0;
 for(const patch of [{progress:1},{progress:-1},{halfWidth:0},{target:{x:NaN,y:20}},{origin:options.target}])assert.equal(drawV100KuromeRay(ctx,objects,{...later,...patch}),false);
 assert.equal(calls.length,0);
});

test('only each real stage boss gets its permitted optional material, never the core ready list',()=>{
 for(const kind of ['takuya','gate-eater','kurome']){
  const art=ART[kind],options={stageId:V100_STAGE_IDS[2],enemyKinds:[kind],verifiedBossAttackPaths:Object.values(ART).map(a=>a.path)};
  const plan=requiredBattleAssetPlan(options),own=plan.stageObjects.filter(a=>a.id.startsWith('v100-boss-attack-'));
  assert.deepEqual(own.map(a=>a.id),[art.id]);assert.equal(own[0].optional,true);assert.ok(!plan.paths.includes(art.path));
  assert.ok(!requiredBattleAssetPlan({...options,verifiedBossAttackPaths:[]}).optionalPaths.includes(art.path));
 }
});

test('validly decoded but wrong-size optional images still fall back instead of cropping the wrong cells',()=>{
 const {ctx,calls}=canvas(),owner={id:8,kind:'kurome',hp:4100};
 assert.equal(drawV100KuromeRay(ctx,{[ART.kurome.id]:image('wrong',3072,2048)},{world:battle(owner),ownerId:8,origin:{x:410,y:135},target:{x:120,y:175},halfWidth:18,progress:.3}),false);
 assert.equal(drawV100GateChargeTrail(ctx,{[ART['gate-eater'].id]:image('wrong',3072,2048)},{world:battle({id:7,kind:'gate-eater',hp:3200}),ownerId:7,x:315,y:240,runtime:{phase:'charging',remainingSeconds:.8,originX:300,targetX:420,direction:1}}),false);
 assert.equal(calls.length,0);
});

for(const displacement of ['windup-back','charging-forward'])test('Gate Eater material does not rewind or skip cells after actual '+displacement+' displacement',()=>{
 let owner={id:7,kind:'gate-eater',side:'zombie',hp:3200,x:500,y:240,lane:1,combatReady:true};
 let runtime={...beginTicketGateEaterCharge({boss:owner,targetX:460}).runtime,originX:500};
 const world=battle(owner),{ctx,calls}=canvas(),objects={[ART['gate-eater'].id]:image('gate')};
 let displaced=false,previous=null,transitions=0,lastPhase='windup';
 for(let tick=0;tick<180;tick++){
  // The real battle can move the boss through knock before advancing this
  // same production charge runtime. Its committed origin intentionally stays.
  if(!displaced&&(displacement==='windup-back'||runtime.phase==='charging'&&runtime.remainingSeconds<.8)){
   owner={...owner,x:owner.x+(displacement==='windup-back'?15:-20)};displaced=true;
  }
  const result=advanceTicketGateEaterCharge({runtime,boss:owner,elapsedSeconds:1/60});
  owner=result.boss;runtime={...result.runtime,originX:500};world.fighters=[owner];world.time+=1/60;
  const start=calls.length;
  if(drawV100GateChargeTrail(ctx,objects,{world,ownerId:7,x:owner.x,y:owner.y,runtime})){
   const frameCalls=calls.slice(start),weight=frameCalls.reduce((sum,c)=>sum+c.alpha,0);
   const position=frameCalls.reduce((sum,c)=>sum+(c.args[1]/512+c.args[2]/512*3)*c.alpha,0)/weight;
   if(previous!==null){assert.ok(position>=previous-1e-8,'no backward animation');assert.ok(position-previous<=.22,'no phase-boundary frame skip');}
   if(lastPhase==='charging'&&runtime.phase==='exposed')transitions++;
   previous=position;
  }
  lastPhase=runtime.phase;
 }
 assert.equal(displaced,true);assert.equal(transitions,1);assert.ok(previous>4.7);assert.equal(owner.hp,3200);
});

test('a Gate Eater first seen after charging shows only the settling tail, and a new battle generation starts fresh',()=>{
 const owner={id:7,kind:'gate-eater',hp:3200},world=battle(owner),{ctx,calls}=canvas(),objects={[ART['gate-eater'].id]:image('gate')};
 const runtime={phase:'exposed',remainingSeconds:1.55,direction:-1};
 assert.equal(drawV100GateChargeTrail(ctx,objects,{world,ownerId:7,x:460,y:240,runtime}),true);
 assert.ok(calls.every(c=>c.args[1]/512+c.args[2]/512*3>=3),'do not replay an unseen impact');
 world.battlePresentation.generation++;calls.length=0;
 assert.equal(drawV100GateChargeTrail(ctx,objects,{world,ownerId:7,x:495,y:240,runtime:{phase:'charging',remainingSeconds:.88,direction:-1}}),true);
 assert.ok(calls.some(c=>c.args[1]===0&&c.args[2]===0));
});

test('settling Gate Eater floor debris stays at its stop point when a later hit moves the exposed body',()=>{
 const owner={id:7,kind:'gate-eater',hp:3200,x:460,y:240},world=battle(owner),{ctx,transforms}=canvas();
 const objects={[ART['gate-eater'].id]:image('gate')},runtime={phase:'exposed',remainingSeconds:1.55,direction:-1};
 assert.equal(drawV100GateChargeTrail(ctx,objects,{world,ownerId:7,x:460,y:240,runtime}),true);
 world.time+=.1;owner.x=475;
 assert.equal(drawV100GateChargeTrail(ctx,objects,{world,ownerId:7,x:475,y:240,runtime:{...runtime,remainingSeconds:1.45}}),true);
 assert.deepEqual(transforms.filter(t=>t[0]==='translate'),[['translate',460,240],['translate',460,240]],'floor fragments must not slide after the exposed actor');
 assert.equal(owner.x,475,'rendering must preserve the real knock displacement');
});
