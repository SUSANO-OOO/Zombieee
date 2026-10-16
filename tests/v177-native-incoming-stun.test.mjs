import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {UNIT_CONTENT_BY_ID} from '../app/content/unitCatalog.js';
import {enemyStatsForWave} from '../app/content/enemyCatalog.js';
import {createCombatAnimationRuntime} from '../app/combatPresentation.js';
import {createNavigationRecoveryState} from '../app/combatAiProfiles.js';
import {configureV177IncomingStunPair,armV177IncomingStunProof,releaseV177IncomingStunProof,
  readV177IncomingStunProof,recordV177IncomingStunImpact,recordV177IncomingStunDraw,
  v177IncomingStunStats} from '../app/v177IncomingStunProof.js';
import {v177JointPose} from '../app/v177JointPresentation.js';
import {v177LivingStunSample} from '../app/v177LivingStun.js';
import {traceRangerPose} from './helpers/v177-ranger-render.mjs';
import {assertNativeIncomingStun,nativeIncomingStunReady,captureNativeIncomingStunCase,
  readNativeIncomingStunSample} from '../scripts/v177-native-incoming-stun.mjs';
import {nativeGamePerformanceReceipt,withNativeGameCaseDeadline} from '../scripts/v177-native-game-capture-browser.mjs';

function pair(){
  const card=UNIT_CONTENT_BY_ID.ranger,stats=enemyStatsForWave('spindle',1);
  const common={flash:0,stunned:0,attack:0,attackWindup:0,abilityWindup:0,combatReady:true,
    gateEntering:false,contained:false,stationAbility:{phase:'idle',targetIds:[]},manualAbility:{phase:'idle'}};
  const actor={...structuredClone(common),...card,id:71,kind:'ranger',side:'human',maxHp:card.hp,cooldown:0,
    spawnGrace:.95,progressionLevel:1,progressionRank:0};
  const source={...structuredClone(common),...stats,id:72,kind:'spindle',side:'zombie',maxHp:stats.hp,cooldown:1.26,
    abilityCooldown:2.1,laneSpeed:70,bodyRadius:18};
  const world={time:10,battleAudioGeneration:3,running:true,paused:true,over:false,fighters:[actor,source]};
  const options={lane:1,laneY:300,createAnimationRuntime:createCombatAnimationRuntime,createNavigationRuntime:createNavigationRecoveryState};
  const proof=armV177IncomingStunProof(world,configureV177IncomingStunPair(actor,source,options));
  return {actor,source,world,proof,options};
}
const source=fs.readFileSync('app/AshfallGame.tsx','utf8');
const tree=ts.createSourceFile('game.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function findNode(predicate){let result;const visit=node=>{if(predicate(node))result=node;ts.forEachChild(node,visit);};visit(tree);assert.ok(result);return result;}
const javascript=text=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;

test('the production QA pair uses original spawn constructors and keeps HP, stats and all spawn timers',()=>{
  const {actor,source:enemy,options}=pair(),before=structuredClone([actor,enemy]);
  configureV177IncomingStunPair(actor,enemy,options);
  const geometry=new Set(['x','y','lane','anchorLane','animationPresentation','navigationRecovery']);
  for(const[i,f]of [actor,enemy].entries())for(const key of Object.keys(f))if(!geometry.has(key))assert.deepEqual(f[key],before[i][key]);
  const node=findNode(node=>ts.isPropertyAssignment(node)&&node.name.getText(tree)==='prepareV177IncomingStunProof');
  const names=['gameRef','fighterRenderAuditHistory','fighterActualXDeltaAudit','corpseRenderAuditHistory',
    'createEnemySpawnRuntime','clearTransientRenderObjects','spawnHuman','spawnEnemy','configureV177IncomingStunPair',
    'activeLaneCenters','createCombatAnimationRuntime','createNavigationRecoveryState','armV177IncomingStunProof',
    'selectedActionRef','setSelectedAction','setStarted','setPaused','setEnd','setScreen'];
  const g={time:4,battleAudioGeneration:9,definition:{timeline:[]},baseMaxHp:100,barricadeMaxHp:100,fighters:[],nextId:10,
    pendingWeaponHits:[{sourceId:500,targetId:501,remainingSeconds:.1}]};
  const calls=[],ui=[],human=structuredClone(before[0]),zombie=structuredClone(before[1]);
  const values=[{current:g},new Map(),new Map(),new Map(),()=>({}),()=>{},(world,kind,deploy)=>{
    calls.push(['human',kind,deploy]);world.fighters.push(human);return true;},(world,kind,lane,order)=>{
    calls.push(['enemy',kind,lane,order]);world.fighters.push(zombie);return zombie;},configureV177IncomingStunPair,
    [220,300,380],createCombatAnimationRuntime,createNavigationRecoveryState,armV177IncomingStunProof,
    {current:null},()=>{},()=>{},value=>ui.push(['paused',value]),()=>{},()=>{}];
  const prepare=new Function(...names,javascript('return ('+node.initializer.getText(tree)+');'))(...values);
  const proof=prepare();assert.deepEqual(calls,[['human','ranger',false],['enemy','spindle',1,7]]);
  assert.equal(g.paused,true);assert.equal(proof.original.actorHp,70);assert.equal(proof.original.sourceCooldown,1.26);
  assert.equal(proof.original.sourceAbilityCooldown,2.1);assert.deepEqual(ui,[['paused',true]]);
  assert.equal(proof.battleGeneration,9);assert.equal(g.fighters.length,2);
  assert.deepEqual(g.pendingWeaponHits,[],'A previous battle must not inject an old pending hit into the original pair');
});

test('release is once-only, bound to world and generation, and changes only the pause boundary',()=>{
  for(const mutation of [({world})=>world.battleAudioGeneration++,({world})=>world.paused=false,
    ({world})=>world.running=false,({world})=>world.over=true]){
    const data=pair();mutation(data);assert.throws(()=>releaseV177IncomingStunProof(data.world,data.proof.proofId));
  }
  const data=pair(),actors=JSON.stringify(data.world.fighters);
  assert.throws(()=>releaseV177IncomingStunProof(data.world,'foreign'));
  const receipt=releaseV177IncomingStunProof(data.world,data.proof.proofId);
  assert.equal(receipt.releasedAt,10);assert.equal(data.world.paused,false);assert.equal(JSON.stringify(data.world.fighters),actors);
  assert.throws(()=>releaseV177IncomingStunProof(data.world,data.proof.proofId));
  assert.equal(readV177IncomingStunProof({}),null);
});

test('the actual coil-vault branch records its original damage and stun after the original resolution',()=>{
  const data=pair(),{world,actor,source:enemy}=data;enemy.stationAbility={phase:'active',targetIds:[String(actor.id)]};
  world.time=12;const hp=actor.hp;
  const branch=findNode(node=>ts.isIfStatement(node)&&node.expression.getText(tree)==='f.kind === "spindle"'
    &&node.thenStatement.getText(tree).includes('recordV177IncomingStunImpact'));
  const execute=new Function('g','f','spindleLandingPoint','BASE_X','BARRICADE_X','fighterDistance','applyIncomingHumanDamage',
    'fighterRenderAuditEnabled','recordV177IncomingStunImpact','addDamageText','addParticles','triggerCameraShake','CAMERA_SHAKE_EVENTS',
    javascript(branch.thenStatement.getText(tree)));
  execute(world,enemy,()=>({x:actor.x+38,y:actor.y}),80,960,(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
    (_g,target,damage)=>{assert.equal(damage,26);target.hp-=damage;return {targetDamage:damage};},true,
    recordV177IncomingStunImpact,()=>{},()=>{},()=>0,{takuyaHeavy:0});
  assert.equal(actor.hp,hp-26);assert.equal(actor.stunned,.42);
  const impact=readV177IncomingStunProof(world).impacts[0];assert.equal(impact.hpBefore,hp);assert.equal(impact.hpAfter,actor.hp);
  assert.equal(impact.proofId,data.proof.proofId);assert.equal(impact.sourceId,enemy.id);assert.equal(impact.targetId,actor.id);
  assert.equal(impact.kind,'coil-vault');assert.equal(impact.damage,26);assert.equal(impact.distance,38);
});

function rowFixture(){
  const data=pair(),{actor,source:enemy,world,proof}=data;let sequence=1,afterSequence=0;
  const runtime={state:'idle',locomotionPhase:.37,locomotionSettle:1,elapsedSeconds:0};
  const counters=()=>Object.fromEntries(['simulationTicks','renderFrames','hiddenFrameCallbacks','visibilityTransitions',
    'backgroundDurationMs','droppedSimulationSeconds','scheduledSimulationSteps','rafRequests','rafCancellations'].map(key=>[key,Math.round((world.time-10)*60)]));
  const geometry={viewport:{width:844,height:340},devicePixelRatio:1,canvas:{width:844,height:340,rect:{x:0,y:0,width:844,height:340}}};
  const paint=(state='idle')=>{
    const plan=v177JointPose('ranger',state==='incapacitated'?v177LivingStunSample('ranger'):{requestedState:state},runtime,
      {actor,stunRemaining:actor.stunned});traceRangerPose(plan,{actor});
    recordV177IncomingStunDraw(world,actor,true,plan,{renderSequence:sequence++,renderKind:'ranger',requestedState:state,
      jointAtlasPath:'/art/v100/joints/ranger-r2.webp'});
  };
  const sample=()=>{
    const observed=readV177IncomingStunProof(world,afterSequence);afterSequence=observed.draws.at(-1)?.renderSequence??afterSequence;
    return {at:100+(world.time-10)*1000,simulationTime:world.time,running:true,paused:world.paused,visible:true,
      fighter:structuredClone(actor),target:structuredClone(enemy),proofId:proof.proofId,battleGeneration:proof.battleGeneration,
      released:observed.released,overflow:observed.overflow,impacts:observed.impacts,draws:observed.draws,
      runtimePerformance:counters(),geometry};
  };
  paint();const first=sample();const release={receipt:releaseV177IncomingStunProof(world,proof.proofId),at:110};
  const samples=[];world.time=11.55;actor.hp-=22;actor.flash=.12;
  recordV177IncomingStunImpact(world,enemy,actor,'normal-hit',70,22,1);paint('hit-light');samples.push(sample());
  world.time=11.75;actor.flash=0;paint();samples.push(sample());
  world.time=12.2;enemy.stationAbility={phase:'warning',targetIds:[String(actor.id)]};paint();samples.push(sample());
  world.time=12.76;enemy.stationAbility.phase='active';actor.hp-=26;actor.stunned=.42;
  recordV177IncomingStunImpact(world,enemy,actor,'coil-vault',48,26);
  for(const time of [12.77,12.83,12.93]){world.time=time;actor.stunned=13.18-time;paint('incapacitated');samples.push(sample());}
  for(const time of [13.18,13.2,13.22]){world.time=time;actor.stunned=0;paint();samples.push(sample());}
  const bytes=Buffer.from('Original native diagnostic fixture bytes');
  const row={form:'ranger',phase:'incoming-stun',viewport:{width:844,height:340},proof,captureStart:first,samples,
    recordingStart:{startedAt:90,timeOrigin:10000},release,releasedAtNative:110,
    nativeClip:{status:'recorded',engine:'webkit',requestedMimeType:'video/webm;codecs=vp8',mimeType:'video/webm;codecs=vp8',
      metadata:{proofId:proof.proofId,battleGeneration:proof.battleGeneration,fighterId:proof.fighterId,form:'ranger',
        phase:'incoming-stun',fixtureGroup:'natural-incoming-stun',controlledOpponent:false,originalStats:true},
      file:'fixture.webm',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),width:844,height:340,
      startedAt:90,stopRequestedAt:3330,timeOrigin:10000,originalSpeedAccepted:false,encodedPtsVerified:false},
    sourceRaf:{timeOrigin:10000,overflow:false,rows:[{at:100,renderSequence:1,renderKind:'ranger'},{at:3320,renderSequence:10,renderKind:'ranger'}]}};
  return {row,bytes,data};
}

test('incoming receipt accepts real post-draw Ranger matrices and the complete alive ready return, separately from old damage receipts',()=>{
  const {row}=rowFixture(),receipt=assertNativeIncomingStun(row);
  assert.equal(receipt.appliedDamage,48);assert.equal(receipt.lateStunDraws,3);assert.equal(nativeIncomingStunReady(row),true);
  assert.equal(receipt.originalSpeedAccepted,false);assert.equal(receipt.naturalnessAccepted,false);
  assert.equal(nativeGamePerformanceReceipt(row).simulationToNativeRatio,1);
});

test('repeated copies of one ready draw cannot satisfy three distinct successful recovery paints',()=>{
  const {row}=rowFixture();
  const ready=row.samples.flatMap(sample=>sample.draws).findLast(draw=>draw.requestedState==='idle'&&draw.stunned===0);
  // Repeat the earliest returned ready paint, including its original sequence
  // and time, in three later poll results. This was the independent r1 M1.
  const first=row.samples.flatMap(sample=>sample.draws).find(draw=>draw.renderSequence>6&&draw.requestedState==='idle'&&draw.stunned===0);
  assert.notEqual(first.renderSequence,ready.renderSequence);
  for(const sample of row.samples)sample.draws=sample.draws.map(draw=>draw.renderSequence>=first.renderSequence?structuredClone(first):draw);
  assert.equal(nativeIncomingStunReady(row),false);assert.throws(()=>assertNativeIncomingStun(row),/ready pose/u);
});

test('wrong bindings, injected/inert stats, pre-record hits, labels without painted joints, death and missing return fail closed',()=>{
  const faults=[row=>row.proof.inertOpponent=true,row=>row.proof.injectedStun=true,
    row=>row.proof.original.sourceCooldown=0,row=>row.proof.original.sourceCooldown=1.44,row=>row.samples[0].proofId='foreign',
    row=>row.samples[0].battleGeneration++,row=>row.samples[0].fighter.hp=0,
    row=>row.samples[0].target.damage=0,row=>row.samples[0].target.hp=1e6,
    row=>row.samples[0].overflow=true,row=>row.recordingStart.startedAt=120,
    row=>row.nativeClip.metadata.proofId='foreign',row=>row.nativeClip.metadata.fixtureGroup='approach-to-attack',
    row=>row.nativeClip.stopRequestedAt=120,row=>row.samples.at(-1).impacts[0].at=row.captureStart.simulationTime,
    row=>row.samples.at(-1).impacts[0].sourceId=row.proof.fighterId,
    row=>row.samples.at(-1).impacts[1].stunned=0,row=>row.samples.at(-1).impacts[1].abilityTargetIds=[],
    row=>{for(const sample of row.samples)for(const draw of sample.draws)draw.jointDrawSucceeded=false;},
    row=>{for(const sample of row.samples)for(const draw of sample.draws)draw.liveStun=false;},
    row=>{for(const sample of row.samples)for(const draw of sample.draws)if(draw.liveStun)draw.upperPose=null;},
    row=>{for(const sample of row.samples)for(const draw of sample.draws)if(draw.liveStun)draw.attack=.1;},
    row=>{row.samples=row.samples.slice(0,6);},
    row=>{for(const sample of row.samples)if(sample.target.stationAbility.phase==='warning')sample.target.stationAbility.phase='idle';}];
  for(const[index,mutate]of faults.entries()){const {row}=rowFixture();mutate(row);assert.throws(()=>assertNativeIncomingStun(row),'Fault '+index);}
});

test('the private observation ring bounds both streams, clones data and cannot borrow another world or actor',()=>{
  const {world,actor,source:enemy}=pair();
  recordV177IncomingStunImpact(world,{...enemy,id:900},actor,'normal-hit',70,1,1);
  recordV177IncomingStunDraw(world,{...actor,id:900},true,{},{});
  assert.equal(readV177IncomingStunProof(world).draws.length,0);assert.equal(readV177IncomingStunProof(world).impacts.length,0);
  for(let i=1;i<=513;i++)recordV177IncomingStunDraw(world,actor,false,null,{renderSequence:i});
  const read=readV177IncomingStunProof(world);assert.equal(read.draws.length,512);assert.equal(read.overflow,true);
  read.draws[0].hp=999;assert.notEqual(readV177IncomingStunProof(world).draws[0].hp,999);
  for(let i=0;i<17;i++)recordV177IncomingStunImpact(world,enemy,actor,'normal-hit',70,1,i);
  assert.equal(readV177IncomingStunProof(world).impacts.length,16);
  assert.equal(readV177IncomingStunProof(world,511).draws.length,1);
});

function pipeline(fault){
  const fixture=rowFixture(),expected=fixture.row,events=[],sentinel=new Error('Original incoming-stun capture error');let index=-1;
  const observation={async evaluate(){events.push('observer-stop');return expected.sourceRaf;},async dispose(){events.push('observer-dispose');}};
  const page={async waitForFunction(){},async waitForTimeout(){},async evaluateHandle(){return observation;},
    async evaluate(fn){
      if(fn.name==='readNativeIncomingStunSample'){
        if(fault==='sample'&&index===0)throw sentinel;
        const value=index++<0?expected.captureStart:expected.samples[Math.min(index-1,expected.samples.length-1)];
        if(index>expected.samples.length)return {...structuredClone(value),at:value.at+.1,draws:[]};
        return structuredClone(value);
      }
      const text=String(fn);if(text.includes('prepareV177IncomingStunProof'))return expected.proof;
      if(text.includes('releaseV177IncomingStunProof')){events.push('release');return expected.release;}
      if(text.includes('setEnemyVfxProofPaused')){events.push('pause');return true;}
      throw Error('Unexpected fixture page evaluation');
    }};
  const deps={out:'output',mimeType:'video/webm;codecs=vp8',startNativeGameRafObservation(){},stopNativeGameRafObservation(){},
    nativeGamePerformanceReceipt,read:async()=>fixture.bytes,onFailure:error=>events.push(error===sentinel?'original-failure':'contract-failure'),
    async beginV177NativeCanvasClip(_page,metadata){
      assert.equal(metadata.fixtureGroup,'natural-incoming-stun');assert.equal(metadata.controlledOpponent,false);
      return {async waitForStart(){events.push('recorder-start');if(fault==='start')throw sentinel;return expected.recordingStart;},
        async finish({completed}){events.push('clip-'+completed);if(fault==='cleanup'&&!completed)return new Promise(()=>{});
          return expected.nativeClip;}};
    }};
  return {...fixture,row:{form:'ranger',phase:'incoming-stun',viewport:expected.viewport,samples:[]},page,deps,events,sentinel,expected};
}

test('dedicated native case starts before release, keeps original bytes, and measures real boundaries without reusing inert receipts',async()=>{
  const f=pipeline();await captureNativeIncomingStunCase(f.page,f.row,f.deps);
  assert.equal(f.row.status,'observed-diagnostic');assert.equal(f.row.summary.appliedDamage,48);
  assert.ok(f.events.indexOf('recorder-start')<f.events.indexOf('release'));
  assert.equal(f.events.filter(e=>e==='clip-true').length,1);assert.equal(f.events.includes('clip-false'),false);
  assert.equal(f.events.at(-1),'pause');assert.ok(f.events.includes('observer-dispose'));
});

test('capture failures retain their first error before cleanup, while a missing-state contract retains a completed original clip',async()=>{
  for(const fault of ['start','sample']){
    const f=pipeline(fault);await assert.rejects(captureNativeIncomingStunCase(f.page,f.row,f.deps),e=>e===f.sentinel);
    assert.equal(f.row.originalFailure,String(f.sentinel));assert.ok(f.events.indexOf('original-failure')<f.events.indexOf('clip-false'));
    assert.notEqual(f.row.status,'observed-diagnostic');assert.ok(f.events.includes('observer-dispose'));
  }
  const f=pipeline();for(const sample of f.expected.samples)for(const draw of sample.draws)draw.liveStun=false;
  await assert.rejects(captureNativeIncomingStunCase(f.page,f.row,f.deps));assert.equal(f.row.nativeClip.status,'recorded');
  assert.equal(f.events.includes('clip-false'),false);assert.notEqual(f.row.status,'observed-diagnostic');
});

test('a late incoming-stun result cannot promote an expired owned case',async()=>{
  const f=pipeline();f.row.deadlineExpired=true;await assert.rejects(captureNativeIncomingStunCase(f.page,f.row,f.deps));
  assert.equal(f.row.nativeClip.status,'recorded');assert.notEqual(f.row.status,'observed-diagnostic');
  let deadline,release,closed=0;const original=new Error('first before blocked cleanup');
  const pending=withNativeGameCaseDeadline(async()=>{f.row.originalFailure=String(original);await new Promise(resolve=>{release=resolve;});},
    async()=>{closed++;},{schedule:fn=>{deadline=fn;return 1;},cancel(){},onDeadline:()=>{f.row.deadlineExpired=true;}});
  await new Promise(resolve=>setImmediate(resolve));deadline();await assert.rejects(pending,/30s/u);
  assert.equal(closed,1);assert.equal(f.row.originalFailure,String(original));release();
});

test('the browser sampler returns successful-draw deltas and original actors without changing their clock',()=>{
  const f=rowFixture(),state=f.data,previous={window:globalThis.window,document:globalThis.document,location:globalThis.location};
  try{
    const snapshot={time:state.world.time,running:true,paused:false,fighters:state.world.fighters};
    globalThis.window={innerWidth:844,innerHeight:340,devicePixelRatio:1,__ASHFALL_BATTLE_QA__:{
      getSnapshot:()=>snapshot,getV177IncomingStunProof:after=>readV177IncomingStunProof(state.world,after),getPerformanceSnapshot:()=>({})}};
    globalThis.document={visibilityState:'visible',querySelector:()=>({width:844,height:340,getBoundingClientRect:()=>({x:0,y:0,width:844,height:340})})};
    globalThis.location={pathname:'/v100'};
    const before=JSON.stringify(state.world),sample=readNativeIncomingStunSample({...f.row.proof,afterSequence:8,performanceBoundary:true});
    assert.equal(sample.fighter.id,state.actor.id);assert.equal(sample.target.id,state.source.id);
    assert.ok(sample.draws.every(draw=>draw.renderSequence>8));assert.deepEqual(sample.geometry.viewport,{width:844,height:340});
    assert.equal(JSON.stringify(state.world),before);assert.equal(v177IncomingStunStats(sample.fighter).kind,'ranger');
  }finally{for(const[key,value]of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
