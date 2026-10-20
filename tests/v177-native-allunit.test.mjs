import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {load as loadYaml} from 'js-yaml';
import {spriteKinds} from '../app/spriteManifest.js';
import {normalAttackReach,canAcquireCombatTarget,canNormalAttackTarget} from '../app/combatLifecycle.js';
import {chooseCommittedEnemyLane} from '../app/lanePlanner.js';
import {chooseEnemyTargetForProfile,enemyAiProfileFor} from '../app/combatAiProfiles.js';
import {createMayoFeralProofOwner} from '../app/v177NativeMayoProof.js';
import {createCombatAnimationRuntime,advanceCombatAnimationRuntime} from '../app/combatPresentation.js';
import {createBattleDefinition} from '../app/battleDefinitions.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {registerV100Twin,bossRenderKind} from '../app/bossFoundation.js';
import {MANUAL_ABILITY_REGISTRY,createManualAbilityRuntime,beginManualAbility,advanceManualAbility} from '../app/manualAbilities.js';
import {configureV177BornTurnedContinuation} from '../app/v177NativeTurnedProof.js';
import {createV177FutagoDamageCopy,prepareV177NativeFutagoPair} from '../app/v177NativeFutagoProof.js';
import {FORM_BINDINGS,SHARDS,VIEWPORTS,LIMITS,planShard,validateManifest,assertPlannedCase} from '../scripts/v177-native-allunit-manifest.mjs';
import {nativeAllUnitBinding,main,ensureNativeAllUnitAssets} from '../scripts/v177-native-allunit-browser.mjs';
import {readNativeAllUnitSample,postpaintCaptureBoundary,assertShardPostpaintContract} from '../scripts/v177-native-allunit-contract.mjs';
import {hasPreparedAllUnitPaint,observeMayoPointer,finishMayoPointer} from '../scripts/v177-native-allunit-cases.mjs';
import {assertFutagoPairDamageAndOwner,assertMayoFeralReceipt} from '../scripts/v177-native-allunit-owners.mjs';

test('asset setup records each original sequential operation before awaiting it without retrying or skipping',async()=>{
  const owner={cleanup:'open'},calls=[],forms=['ooguchi','guardian','gairen','futago'];let time=100;
  const page={async evaluate(fn,form){
    assert.equal(owner.assetReadiness.at(-1).form,form);assert.equal(owner.assetReadiness.at(-1).status,'starting');
    const actual=vm.runInNewContext('('+fn.toString()+')',{window:{__ASHFALL_BATTLE_QA__:{
      async ensureEnemyFacingProofAsset(kind){calls.push(kind);}
    }}});await actual(form);
  }};
  await ensureNativeAllUnitAssets(page,forms,owner,{now:()=>++time});
  assert.deepEqual(calls,forms);assert.deepEqual(owner.assetReadiness.map(r=>r.form),forms);
  for(const receipt of owner.assetReadiness){assert.equal(receipt.status,'completed');assert.ok(receipt.hostCompletedAtMs>receipt.hostStartedAtMs);}
});

test('asset setup retains the exact failed kind and original rejection without attempting the remaining kinds',async()=>{
  const owner={cleanup:'open'},sentinel=Error('Original asset failure'),calls=[];
  const page={async evaluate(_fn,form){calls.push(form);if(form==='guardian')throw sentinel;}};
  await assert.rejects(ensureNativeAllUnitAssets(page,['ooguchi','guardian','gairen'],owner),e=>e===sentinel);
  assert.deepEqual(calls,['ooguchi','guardian']);
  assert.deepEqual(owner.assetReadiness.map(r=>r.status),['completed','failed']);
  assert.equal(owner.assetReadiness[1].error,String(sentinel));
});

test('a pending asset remains visible at owner close and its late return cannot complete setup or start another asset',async()=>{
  const owner={cleanup:'open'},calls=[];let release;
  const pending=ensureNativeAllUnitAssets({evaluate(_fn,form){calls.push(form);return new Promise(resolve=>{release=resolve;});}},
    ['ooguchi','guardian'],owner);
  assert.equal(owner.assetReadiness[0].form,'ooguchi');assert.equal(owner.assetReadiness[0].status,'starting');
  owner.cleanup='pending';release();
  await assert.rejects(pending,/owner closed before readiness returned/u);
  assert.deepEqual(calls,['ooguchi']);assert.equal(owner.assetReadiness[0].status,'failed');
  assert.equal(owner.assetReadiness[0].hostCompletedAtMs,undefined);
});

test('all real renderer forms have one owned route and nine planned captures',()=>{
  assert.equal(validateManifest().forms,48);assert.deepEqual(FORM_BINDINGS.map(f=>f.form),spriteKinds);
  assert.equal(new Set(FORM_BINDINGS.map(f=>f.atlas.path)).size,45);
  assert.equal(SHARDS.length,12);for(const s of SHARDS)assert.equal(planShard(s.id).length,36);
  const rows=SHARDS.flatMap(s=>planShard(s.id));assert.equal(rows.length,432);
  for(const form of spriteKinds)assert.equal(rows.filter(r=>r.form===form).length,9);
  assert.equal(new Set(rows.map(r=>r.caseId)).size,432);
  assert.doesNotThrow(()=>assertPlannedCase({...rows[0],status:'starting',samples:[]}));
  for(const bad of [{...rows[0],owner:'mayo-activation'},{...rows[0],form:'missing'},
    {...rows[0],viewport:{width:844,height:339}},{...rows[0],binding:{...rows[0].binding,kind:'other'}}])
    assert.throws(()=>assertPlannedCase(bad));
});

test('exact PR native host and shard guard run before owned server import',async()=>{
  const head='a'.repeat(40),env={GITHUB_ACTIONS:'true',RUNNER_OS:'macOS',GITHUB_EVENT_NAME:'pull_request',
    GITHUB_EVENT_PATH:'event.json',V177_EXPECTED_HEAD_SHA:head,V177_CAPTURE_SHARD:'forms-1'};
  const guard={platform:'darwin',env,read:async()=>JSON.stringify({number:180,pull_request:{head:{sha:head}}}),head:()=>head};
  assert.equal((await nativeAllUnitBinding(guard)).shardId,'forms-1');
  for(const override of [{platform:'win32'},{platform:'linux'},{env:{...env,V177_CAPTURE_SHARD:'forms-13'}},
    {env:{...env,GITHUB_ACTIONS:'false'}},{head:()=> 'b'.repeat(40)}]){
    let loaded=false;await assert.rejects(main({...guard,...override,argv:['node','driver'],load:async()=>{loaded=true;}}));
    assert.equal(loaded,false);
  }
});

function paintFixture(){
  const row=SHARDS.flatMap(s=>planShard(s.id)).find(r=>r.form==='medic'&&r.phase==='move'&&r.viewport.height===390);
  const stats={speed:38,laneSpeed:20,damage:10,range:180,attackEvery:1,hp:100,maxHp:100};
  const proof={schema:'v177-native-shard-proof/v1',proofId:'2:medic:4:move',battleGeneration:2,route:'/v100',
    owner:row.owner,kind:row.binding.kind,side:row.binding.side,renderKind:row.form,v100TwinPart:null,
    legacyFusedFixture:false,phase:row.phase,fighterId:4,targetId:5,originalActorStats:stats,ownerEvidence:{constructorFixture:true}};
  const raw=(seq,time,at,paused)=>({schema:'v177-native-shard-postpaint/v1',at,timeOrigin:88,simulationTime:time,
    route:'/v100',visible:true,running:true,paused,viewport:row.viewport,battleGeneration:2,historyOverflow:false,
    lookup:{requestedFighterId:4,observedFighterId:4,requestedTargetId:5,observedTargetId:5},
    fighter:{...stats,id:4,kind:'medic',side:'human',renderKind:'medic',v100TwinPart:null,x:330+time*38},target:{id:5},
    renders:[{renderSequence:seq,renderKind:'medic',assetReady:true,renderWidth:60,renderHeight:90,
      x:330+time*38,y:220,poseScaleX:1,poseScaleY:1,requestedState:'move',actualXDelta:1,
      jointAtlasPath:row.binding.atlas.path,jointLowerFrame:seq%30,jointUpperFrame:0,
      jointDrawSucceeded:true,jointPaintedAt:time,renderedWeaponSocket:{x:350,y:200}}]});
  const initial=raw(1,0,1010,true),start={startedAt:1000,timeOrigin:88};
  const boundary=postpaintCaptureBoundary(row,proof,initial,start);
  const release={at:1011,timeOrigin:88,beforePaused:true,afterPaused:false,beforeTime:0,afterTime:0};
  const samples=Array.from({length:15},(_,i)=>raw(i+2,(i+1)*.12,1131+i*120,false));
  return{row,proof,initial,start,boundary,release,samples};
}
test('only fresh successful paints after native ACK count as captured evidence',()=>{
  const f=paintFixture(),result=assertShardPostpaintContract(f.row,f.proof,f.boundary,f.release,f.samples);
  assert.equal(result.distinctNewPaints,15);assert.equal(result.postpaintValidated,true);
  assert.equal(result.ownerEvidenceAccepted,false);assert.equal(result.naturalnessAccepted,false);
  const faults=[
    x=>x.samples[1].lookup.observedFighterId=99,
    x=>delete x.samples[1].renders[0].jointDrawSucceeded,
    x=>x.samples[1].renders[0].jointDrawSucceeded=false,
    x=>x.samples[1].renders[0].jointPaintedAt=99,
    x=>x.samples[1].renders[0].jointAtlasPath='/art/borrowed.webp',
    x=>x.samples[1].fighter.speed++,x=>x.samples[1].fighter.hp--,
    x=>x.samples[1].battleGeneration++,x=>x.samples[1].paused=true,
    x=>x.samples[1].at=x.samples[0].at,x=>x.release.afterTime=.1,
    x=>x.samples.forEach(s=>s.renders=[{...x.initial.renders[0]}]),
  ];
  for(const mutate of faults){const x=paintFixture();mutate(x);assert.throws(()=>assertShardPostpaintContract(x.row,x.proof,x.boundary,x.release,x.samples));}
  const x=paintFixture();x.initial.at=999;assert.throws(()=>postpaintCaptureBoundary(x.row,x.proof,x.initial,x.start));
});

test('actual read callback preserves false and absent postpaint flags',()=>{
  for(const flag of [true,false,undefined]){
    const f=paintFixture(),draw={...f.initial.renders[0],jointDrawSucceeded:flag};
    const qa={getSnapshot:()=>({time:0,running:true,paused:true}),
      getEnemyFacingRuntimeAudit:id=>id===4?{fighter:f.initial.fighter,renderHistory:[draw]}:{fighter:{id:5}},
      getPhaseGCombatSnapshot:()=>({battleGeneration:2,completedAttackImpacts:[]})};
    const context={args:{fighterId:4,targetId:5,owner:'ordinary'},window:{__ASHFALL_BATTLE_QA__:qa},
      document:{visibilityState:'visible'},location:{pathname:'/v100'},performance:{now:()=>1010,timeOrigin:88},
      innerWidth:844,innerHeight:390};
    const raw=vm.runInNewContext('('+readNativeAllUnitSample.toString()+')(args)',context);
    assert.equal(raw.renders[0].jointDrawSucceeded,flag);
    if(flag===true)assert.doesNotThrow(()=>postpaintCaptureBoundary(f.row,f.proof,JSON.parse(JSON.stringify(raw)),f.start));
    else assert.throws(()=>postpaintCaptureBoundary(f.row,f.proof,JSON.parse(JSON.stringify(raw)),f.start));
  }
});
test('prepared readiness reads real current paused actor and actual paint',()=>{
  const f=paintFixture(),qa={getSnapshot:()=>({running:true,paused:true}),
    getEnemyFacingRuntimeAudit:()=>({fighter:f.initial.fighter,renderHistory:f.initial.renders})};
  const run=()=>vm.runInNewContext('('+hasPreparedAllUnitPaint.toString()+')(proof)',
    {proof:f.proof,window:{__ASHFALL_BATTLE_QA__:qa},document:{visibilityState:'visible'}});
  assert.equal(run(),true);f.initial.renders[0].jointDrawSucceeded=false;assert.equal(run(),false);
});

test('pointer observer copies native trust and actual button identity without activation',()=>{
  const listeners=new Map(),proof={proofId:'mayo:4',proofGeneration:2,battleGeneration:7,fighterId:4};
  const context={proof,performance:{now:()=>12},document:{
    addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)}};
  const state=vm.runInNewContext('('+observeMayoPointer.toString()+')(proof)',context);
  const button={dataset:{fighterId:'4',abilityKind:'mayo-chan'}};
  for(const type of ['pointerdown','pointerup','click'])listeners.get(type)({type,isTrusted:false,target:{closest:()=>button}});
  context.state=state;const result=vm.runInNewContext('('+finishMayoPointer.toString()+')(state)',context);
  assert.equal(result.events.length,3);assert.ok(result.events.every(r=>r.isTrusted===false&&r.fighterId===4));
  assert.equal(listeners.size,0);
});

test('born continuation preserves real actor timers, targets, gait and object',()=>{
  for(const phase of ['move','attack','engage']){
    const actor={id:12,kind:'turned',side:'zombie',hp:80,maxHp:80,speed:23,laneSpeed:18,damage:9,range:24,
      attackEvery:.8,spawnGrace:0,flash:0,stunned:0,knock:0,x:600,y:220,lane:1,bodyRadius:18,
      cooldown:.37,abilityCooldown:2.5,attackSequence:4,targetId:null,targetObjectId:null,anchorLane:1,nextLaneDecisionAt:77.7,
      navigationRecovery:{recoveryLane:null,recoverySeconds:0,terminalFallbackSeconds:0,routeReleaseRequested:false},
      animationPresentation:{locomotionPhase:12.3}};
    const before=structuredClone(actor),birth={actorId:12,corpseId:11,bornAt:76.8,initialRemaining:.75,
      source:{sourceBound:true,recordedAfterPaint:true}};
    const world={time:77.8,battleAudioGeneration:7,running:true,paused:false,over:false,fighters:[actor]};
    const source={released:true,proofId:'7:turned-getup:11',battleGeneration:7,time:77.8,actorId:12,corpseId:11,
      actualBirth:birth,proof:{initialFighterIds:[],manualBirth:false,injectedSpawnGrace:false,manualClockAdvance:false,preparedAt:72},releasedAt:72,
      draws:[1,2,3].map(i=>({renderSequence:i,renderKind:'turned',jointDrawSucceeded:true,jointGetupProgress:null,jointPaintedAt:77.55+i*.05,requestedState:'move'}))};
    const result=configureV177BornTurnedContinuation(world,{proofId:source.proofId,phase},{
      readGetup:()=>source,readBirth:()=>birth,catalog:{attackReachFor:normalAttackReach},
      laneYFor:lane=>[180,220,260][lane],
      configure:()=>{throw Error('Generic reset must never run');},
      spawnTarget:g=>{const t={id:13,kind:'guardian',side:'human',bodyRadius:26};g.fighters.push(t);return t;},
    });
    assert.deepEqual(actor,before);assert.equal(world.fighters[0],actor);assert.equal(world.time,77.8);
    assert.equal(result.fighterId,12);assert.equal(result.targetId,13);assert.equal(result.origin.corpseId,11);
  }
});
test('pair damage observer quarantines mismatch and retains bounded raw source attribution',()=>{
  const owner=createV177FutagoDamageCopy(),world={time:1,battleAudioGeneration:3};
  owner.arm(world,{owner:'futago-pair',proofId:'pair',targetId:7,partnerTargetId:8});
  assert.doesNotThrow(()=>owner.copyAfterAppliedDamage(world,{source:{id:4,kind:'futago'},target:{id:7,hp:95},
    beforeHp:100,resolvedDamage:6,mode:'normal-direct',attackSequence:1}));
  assert.equal(owner.read(world).failure,'Actual postdamage boundaries differ');
  for(let i=0;i<129;i++)owner.copyAfterAppliedDamage(world,{source:{id:99,kind:'other'},target:{id:7,hp:95},
    beforeHp:100,resolvedDamage:5,mode:'normal-direct',attackSequence:i});
  const read=owner.read(world);assert.equal(read.rows.length,128);assert.equal(read.overflow,true);assert.equal(read.rows[0].sourceId,99);
  read.rows[0].sourceId=4;assert.equal(owner.read(world).rows[0].sourceId,99);
});

// These controlled Node fixtures exercise ownership failures. They do not
// constitute native draw, input, media, campaign or naturalness evidence.
function pairFixture(form='futago-separated-a',phase='attack'){
  const stats={speed:9,laneSpeed:34,damage:36,range:60,attackEvery:1,hp:3000,maxHp:3000};
  const world={definition:createBattleDefinition(V100_STAGE_IDS[23],{v100:true}),time:12,
    battleAudioGeneration:7,paused:true,running:true,over:false,fighters:[],v100TwinSpawnCount:0};
  let nextId=10;const original=[];
  const spawn=(kind,side)=>{
    const f={id:nextId++,kind,side,...stats,bodyRadius:kind==='guardian'?18:39,x:858,y:297,lane:1,anchorLane:1,
      cooldown:.72+(nextId-11)*.18,abilityCooldown:3.6,attackSequence:4,targetId:null,
      animationPresentation:createCombatAnimationRuntime({direction:side==='zombie'?'left':'right',x:858,y:297})};
    f.animationPresentation.locomotionPhase=.27;f.animationPresentation.locomotionTravelDistance=12.3;
    if(kind==='futago'){f.v100BossId='boss-futago';registerV100Twin(world,f);original.push(structuredClone(f));}
    world.fighters.push(f);return f;
  };
  const proof=prepareV177NativeFutagoPair(world,{renderKind:form,phase,proofId:'pair:test',laneY:300},{
    spawnEnemy:()=>spawn('futago','zombie'),spawnControlledGuardian:()=>spawn('guardian','human'),
    bossRenderKind,normalAttackReach,originalFutagoStatsFor:()=>stats});
  return{world,proof,original};
}
test('pair initial placement preserves clocks and does not invent first-frame travel',()=>{
  for(const form of ['futago-separated-a','futago-separated-b'])for(const phase of ['move','attack','engage']){
    const {world,original}=pairFixture(form,phase);assert.equal(world.time,12);
    for(const f of world.fighters){
      assert.equal(f.animationPresentation.lastX,f.x);assert.equal(f.animationPresentation.lastY,f.y);
      const before=f.animationPresentation,next=advanceCombatAnimationRuntime(before,
        {kind:f.kind,x:f.x,y:f.y,direction:before.direction,moving:false},1/60);
      assert.equal(next.moving,false);assert.equal(next.locomotionTravelDistance,before.locomotionTravelDistance);
      assert.equal(next.locomotionPhase,before.locomotionPhase);
      if(f.kind==='futago'){
        const source=original.find(a=>a.id===f.id);
        for(const k of ['cooldown','abilityCooldown','attackSequence','targetId','hp'])assert.equal(f[k],source[k]);
        const strip=a=>{const r=structuredClone(a);for(const k of ['x','y','lane','anchorLane'])delete r[k];
          delete r.animationPresentation.lastX;delete r.animationPresentation.lastY;return r;};
        assert.deepEqual(strip(f),strip(source));
      }
    }
  }
});
test('real area pursuit retains the move opponent after the original compact boss barrier correction',()=>{
  for(const form of ['futago-separated-a','futago-separated-b']){
    const {world,proof}=pairFixture(form,'move'),actor=world.fighters.find(f=>f.id===proof.fighterId),
      target=world.fighters.find(f=>f.id===proof.targetId),other=world.fighters.find(f=>f.id===proof.partnerTargetId);
    const before=structuredClone(actor),time=world.time,profile=enemyAiProfileFor('area');
    assert.equal(actor.speed,9);assert.equal(normalAttackReach(actor,target),80);assert.equal(profile.engagementRadius,185);
    assert.equal(target.x,actor.x-150);assert.equal(other.x,850);
    // Original compact capture endpoints; target4's real boss barrier moved
    // it to770.5529899. Keeping x400 left target3 outside the185px pursuit.
    const atStart={...actor,x:608.5,y:285},old={...target,x:400,y:285};
    const candidates=(enemy,primary)=>[primary,{...other,x:770.5529898977056,y:285}].map(t=>({...t,
      distance:Math.hypot(enemy.x-t.x,enemy.y-t.y),inContact:false,blocksRoute:false,attackEligible:true,nearbyAllies:0}));
    assert.equal(chooseEnemyTargetForProfile({kind:'futago',profile:'area',enemy:atStart,candidates:candidates(atStart,old)})?.id,other.id,
      'retain the original failed natural target choice');
    for(const x of [609.721,608.5,600,590,577.6]){
      const enemy={...actor,x,y:285},primary={...target,y:285},distance=x-primary.x;
      assert.ok(distance>normalAttackReach(enemy,primary)&&distance<=profile.engagementRadius);
      assert.ok(distance<770.5529898977056-x,'the original companion target stays farther away');
      for(const currentTargetId of [null,target.id])assert.equal(chooseEnemyTargetForProfile({
        kind:'futago',profile:'area',enemy,candidates:candidates(enemy,primary),currentTargetId})?.id,target.id);
    }
    assert.deepEqual(actor,before);assert.equal(world.time,time);assert.equal(target.hp,1_000_000);assert.equal(other.hp,1_000_000);
  }
});
function pairOwnerRow(){
  const {world,proof:p}=pairFixture(),binding=FORM_BINDINGS.find(r=>r.form===p.renderKind);
  const actor=id=>{const f=world.fighters.find(r=>r.id===id);return{...structuredClone(f),renderKind:bossRenderKind(f)};};
  const first={at:100,simulationTime:12,battleGeneration:7,running:true,paused:false,visible:true,route:'/v100',
    lookup:{requestedFighterId:p.fighterId,observedFighterId:p.fighterId},ownerEvidence:structuredClone(p.ownerEvidence),
    fighter:actor(p.fighterId),partner:actor(p.partnerId),target:actor(p.targetId),partnerTarget:actor(p.partnerTargetId),
    rawPairMembers:world.fighters.filter(f=>f.kind==='futago').map(f=>structuredClone(f)),
    renders:[],damageCopy:{sequence:0,overflow:false,failure:null,rows:[]},completedAttackImpacts:[]};
  const damage={sequence:1,proofId:p.proofId,battleGeneration:7,sourceId:p.fighterId,sourceKind:'futago',
    targetId:p.targetId,mode:'normal-direct',beforeHp:1_000_000,afterHp:999964,appliedDamage:36,attackSequence:5,at:13};
  const samples=Array.from({length:5},(_,i)=>{
    const s=structuredClone(first);s.at=350+i*250;s.simulationTime=12+(i+1)*.3;
    if(s.simulationTime>=13){s.fighter.attackSequence=5;s.fighter.targetId=p.targetId;s.partner.targetId=p.partnerTargetId;
      s.target.hp=999964;s.damageCopy={sequence:1,overflow:false,failure:null,rows:[structuredClone(damage)]};
      s.completedAttackImpacts=[{battleGeneration:7,sourceId:p.fighterId,targetId:p.targetId,attackSequence:5,
        impactOrdinal:0,mode:'direct',audioRequestObserved:true,sourceKind:'futago',contactAtBattleTime:13}];}
    s.renders=[{renderSequence:6+i,renderKind:p.renderKind,jointDrawSucceeded:true,assetReady:true,
      jointPaintedAt:s.simulationTime,jointAtlasPath:binding.atlas.path,renderWidth:100,renderHeight:120}];return s;
  });
  return{form:p.renderKind,phase:'attack',proof:p,captureStart:first,samples,expectedJointPath:binding.atlas.path,
    sequenceBaseline:5,recordingStart:{startedAt:90,timeOrigin:44},nativeClip:{status:'recorded',engine:'webkit',
      requestedMimeType:'video/webm;codecs=vp8',bytes:100,sha256:'a'.repeat(64),originalSpeedAccepted:false,
      encodedPtsVerified:false,timeOrigin:44,stopRequestedAt:2000}};
}
test('pair owner consumes raw lookup and rejects duplicated or substituted formal registrations',()=>{
  const baseline=pairOwnerRow();assert.doesNotThrow(()=>assertFutagoPairDamageAndOwner(baseline));
  for(const mutate of [
    e=>e.spawnOrdinals[1]=structuredClone(e.spawnOrdinals[0]),
    e=>{e.formalWave.allWaveKinds=['futago','futago'];e.spawnOrdinals.forEach((r,i)=>r.sourceOrder=i);},
    e=>e.formalWave.at++,
  ]){
    const r=structuredClone(baseline);mutate(r.proof.ownerEvidence);
    for(const s of [r.captureStart,...r.samples])s.ownerEvidence=structuredClone(r.proof.ownerEvidence);
    assert.throws(()=>assertFutagoPairDamageAndOwner(r));
  }
});
function mayoOwnerRow(){
  let runtime=beginManualAbility(createManualAbilityRuntime('mayo-chan'),{id:12,kind:'walker',side:'zombie',hp:1_000_000}).runtime;
  let time=0,tick=0,hp=100,feralAt;const ledger=[];
  const project=r=>Object.fromEntries(['kind','phase','activationId','abilityElapsed','windupRemaining','activeRemaining','cooldownRemaining'].map(k=>[k,r[k]]));
  const step=dt=>{const before=project(runtime),hpBefore=hp,from=time;time+=dt;tick++;
    if(runtime.phase==='feral')hp=Math.max(20,hp-7*dt);runtime=advanceManualAbility(runtime,dt).runtime;
    ledger.push({tick,from,to:time,dt,hpBefore,hpAfter:hp,maxHp:100,before,after:project(runtime),retreatBefore:false,retreatAfter:false});
    if(before.phase!=='feral'&&runtime.phase==='feral')feralAt=time;
  };
  while(runtime.phase!=='feral')step(.1);
  const p={proofId:'mayo:test',proofGeneration:1,battleGeneration:7,preparedAt:0,priorActivationId:0,
    owner:'mayo-activation',kind:'mayo-chan',side:'human',renderKind:'mayo-chan-feral',legacyFusedFixture:false,
    fighterId:10,targetId:12,phase:'attack',originalActorStats:{speed:10,laneSpeed:30,damage:12,range:50,attackEvery:1,hp:100,maxHp:100},
    failure:null,overflow:false,pending:null,ledger,ownerEvidence:{activationId:1,
      startReceipt:{ownerId:10,kind:'mayo-chan',eventType:'start',activationId:1,at:0},
      feralReceipt:{ownerId:10,kind:'mayo-chan',eventType:'feral-start',activationId:1,at:feralAt},
      pointer:{proofId:'mayo:test',proofGeneration:1,battleGeneration:7,events:['pointerdown','pointerup','click']
        .map(type=>({type,isTrusted:true,fighterId:10,kind:'mayo-chan'}))}}};
  const sample=(index=0)=>({at:1000+time*1000,simulationTime:time,simulationTick:tick,proofId:p.proofId,proofGeneration:1,
    battleGeneration:7,running:true,paused:false,visible:true,
    fighter:{id:10,kind:'mayo-chan',side:'human',renderKind:'mayo-chan-feral',manualAbilityPhase:'feral',
      mayoRetreat:false,...p.originalActorStats,hp,activeRemaining:runtime.activeRemaining,attackSequence:index},
    target:{id:12,kind:'walker',side:'zombie',maxHp:1_000_000,hp:1_000_000-index*10,speed:0,laneSpeed:0,damage:0},
    completedAttackImpacts:index?[{sourceId:10,targetId:12,battleGeneration:7,attackSequence:index,
      sourceKind:'mayo-chan',mode:'direct',audioRequestObserved:true,contactAtBattleTime:time}]:[]});
  const first=sample(),samples=[];for(let i=1;i<=15;i++){step(.12);samples.push(sample(i));}
  return{phase:'attack',proof:p,captureStart:first,samples};
}
test('Mayo owner requires a lifecycle and new original normal impact from actual manual ticks',()=>{
  const baseline=mayoOwnerRow(),definition=MANUAL_ABILITY_REGISTRY['mayo-chan'];
  assert.doesNotThrow(()=>assertMayoFeralReceipt(baseline,definition));
  const noGeneration=structuredClone(baseline);delete noGeneration.proof.proofGeneration;
  delete noGeneration.proof.ownerEvidence.pointer.proofGeneration;
  for(const s of [noGeneration.captureStart,...noGeneration.samples])delete s.proofGeneration;
  assert.throws(()=>assertMayoFeralReceipt(noGeneration,definition));
  for(const change of [r=>r.attackSequence=0,r=>r.sourceKind='guardian',r=>r.mode='unrelated',r=>r.audioRequestObserved=false]){
    const row=structuredClone(baseline);
    for(const s of row.samples)for(const impact of s.completedAttackImpacts)change(impact);
    assert.throws(()=>assertMayoFeralReceipt(row,definition));
  }
});
test('workflow keeps exact head, independent twelve shards and original owned budgets',()=>{
  const workflow=loadYaml(fs.readFileSync('.github/workflows/native-allunit-capture.yml','utf8'));
  assert.equal(workflow.concurrency['cancel-in-progress'],false);
  assert.equal(workflow.jobs.capture.strategy.matrix.shard,'${{ fromJSON(needs.build.outputs.shards) }}');
  assert.equal(workflow.jobs.capture.strategy['fail-fast'],false);assert.equal(workflow.jobs.capture['timeout-minutes'],15);
  assert.equal(workflow.jobs.build['timeout-minutes'],15);assert.equal(workflow.jobs.capture.needs,'build');
  assert.equal(workflow.jobs.build.steps[0].with.ref,'${{ github.event.pull_request.head.sha || inputs.expected_head }}');
  assert.equal(workflow.jobs.build.steps[0].with['persist-credentials'],false);
  assert.equal(workflow.jobs.capture.env.V177_EXPECTED_BUILD_SHA256,'${{ needs.build.outputs.dist_sha256 }}');
  assert.equal(workflow.jobs.capture.env.V177_EXPECTED_BUILD_RECEIPT_SHA256,'${{ needs.build.outputs.receipt_sha256 }}');
  assert.equal(workflow.jobs.capture.steps.some(s=>s.run==='npm run build'),false);
  assert.equal(workflow.jobs.capture.steps[0].with.ref,'${{ github.event.pull_request.head.sha || inputs.expected_head }}');
  assert.equal(workflow.jobs.capture.steps[0].with['persist-credentials'],false);
  assert.equal(LIMITS.caseMs,30000);assert.equal(LIMITS.readinessMs,5000);assert.equal(LIMITS.clipBytes,8*1024*1024);
  assert.deepEqual(VIEWPORTS,[{width:1280,height:720},{width:844,height:390},{width:844,height:340}]);
});


function bornLaneTargetFixture({phase='engage',lane=1,anchorLane=0,recoveryLane=null,actorX=608.5,laneYFor}={}){
 const actor={id:12,kind:'turned',side:'zombie',hp:95,maxHp:95,speed:18,laneSpeed:38,damage:18,range:25,
  attackEvery:.88,spawnGrace:0,flash:0,stunned:0,knock:0,x:actorX,y:288.16666666666663,lane,anchorLane,bodyRadius:11,
  cooldown:.37,abilityCooldown:2.5,attackSequence:4,targetId:null,targetObjectId:null,nextLaneDecisionAt:77.62,
  navigationRecovery:{recoveryLane,elapsed:.37,recoverySeconds:0,terminalFallbackSeconds:0,routeReleaseRequested:false},
  animationPresentation:{locomotionPhase:12.3,locomotionTravelDistance:3.7}};
 const birth={actorId:12,corpseId:11,bornAt:76.8,initialRemaining:.75,source:{sourceBound:true,recordedAfterPaint:true}};
 const world={time:77.8,battleAudioGeneration:7,running:true,paused:false,over:false,fighters:[actor]};
 const source={released:true,proofId:'7:turned-getup:11',battleGeneration:7,time:77.8,actorId:12,corpseId:11,
  actualBirth:birth,proof:{initialFighterIds:[],manualBirth:false,injectedSpawnGrace:false,manualClockAdvance:false,preparedAt:72},releasedAt:72,
  draws:[1,2,3].map(i=>({renderSequence:i,renderKind:'turned',jointDrawSucceeded:true,jointGetupProgress:null,jointPaintedAt:77.55+i*.05,requestedState:'move'}))};
 let spawned=0;
 const deps={readGetup:()=>source,readBirth:()=>birth,laneYFor,catalog:{attackReachFor:normalAttackReach},
  spawnTarget:g=>{spawned++;const t={id:13,kind:'guardian',side:'human',bodyRadius:18};g.fighters.push(t);return t;}};
 return{world,actor,source,deps,phase,get spawned(){return spawned;},
  run:()=>configureV177BornTurnedContinuation(world,{proofId:source.proofId,phase},deps)};
}
test('born continuation aligns only the inert target to its current route or physical App lane center',()=>{
 for(const phase of ['move','attack','engage'])for(const lane of [0,1,2]){
  let centers=[400,480,560];const seen=[];
  const f=bornLaneTargetFixture({phase,lane,laneYFor:n=>{seen.push(n);return centers[n];}});
  centers=[413,497,581]; // Deliberately unlike static gameRules or a cached value.
  if(phase==='engage'){f.actor.anchorLane=lane;f.actor.y=centers[lane];}
  const before=structuredClone(f.actor),time=f.world.time;
  const proof=f.run(),target=f.world.fighters[1];
  const expectedLane=lane;
  assert.deepEqual(seen,[expectedLane]);assert.equal(target.y,centers[expectedLane]);
  assert.equal(target.lane,expectedLane);assert.equal(target.anchorLane,expectedLane);
  assert.equal(proof.initial.targetY,centers[expectedLane]);assert.equal(proof.initial.targetLane,expectedLane);
  assert.equal(proof.initial.actorY,before.y);assert.equal(target.hp,1_000_000);
  assert.equal(target.speed,0);assert.equal(target.laneSpeed,0);assert.equal(target.damage,0);
  assert.equal(proof.fighterId,before.id);assert.equal(f.world.fighters[0],f.actor);
  assert.deepEqual(f.actor,before);assert.equal(f.world.time,time);assert.equal(f.world.paused,false);
 }
});

test('real lane and melee rules retain the old born engage miss while unsettled preparation fails before spawn',()=>{
 // Original native last samples in desktop/phone geometry: the target remained
 // in lane1 while the born actor reached its source-bound committed route0.
 for(const {centers,actorX,targetX,x,y} of [{centers:[212,282,352],actorX:607.9,targetX:543.1,x:505.9000000000146,y:213.60000000000082},
  {centers:[240,285,325],actorX:608.2,targetX:543.4,x:505.6000000000146,y:241.93333333333385}]){
  const f=bornLaneTargetFixture({actorX,laneYFor:n=>centers[n]}),before=structuredClone(f.actor),time=f.world.time;
  const decision=chooseCommittedEnemyLane({currentLane:f.actor.anchorLane,physicalLane:f.actor.lane,
   x:f.actor.x,y:f.actor.y,laneCenters:centers,routeCosts:[4,80009,0],now:time,nextLaneDecisionAt:f.actor.nextLaneDecisionAt,hasTarget:true});
  assert.equal(decision.committedLane,0);assert.equal(decision.reason,'engaged');
  assert.throws(f.run,/settle on its naturally committed route/u);assert.equal(f.spawned,0);
  const target={id:13,kind:'guardian',side:'human',bodyRadius:18,combatReady:true,hp:1_000_000,
   x:actorX-normalAttackReach(f.actor,{bodyRadius:18})-f.actor.speed*1.1,y:centers[0],lane:0,anchorLane:0};
  const liveActor={...f.actor,x,y,lane:0,combatReady:true};
  assert.ok(Math.abs(target.x-targetX)<1e-8,'retain the original native target X');
  const oldPhysicalTarget={...target,y:centers[1],lane:1,anchorLane:1};
  assert.equal(canAcquireCombatTarget({attacker:liveActor,target:oldPhysicalTarget}),false,'retain the original cross-lane miss');
  assert.equal(canAcquireCombatTarget({attacker:liveActor,target}),true);
  assert.equal(canNormalAttackTarget({attacker:liveActor,target}),true,'the same original native position can strike on its existing route');
  assert.equal(target.lane,decision.committedLane);assert.equal(target.hp,1_000_000);
  assert.deepEqual(f.actor,before);assert.equal(f.world.time,time);
 }
});

test('born engage rejects transient recovery and unsettled routes, while move and attack keep physical placements',()=>{
 for(const setup of [{anchorLane:0,recoveryLane:2,expected:2},{anchorLane:2,recoveryLane:null,expected:2},
  {anchorLane:null,recoveryLane:null,expected:1}])for(const phase of ['move','attack','engage']){
  const centers=[212,282,352],f=bornLaneTargetFixture({...setup,phase,laneYFor:n=>centers[n]}),before=structuredClone(f.actor),time=f.world.time;
  if(phase==='engage'){
   assert.throws(f.run,/settle on its naturally committed route/u);assert.equal(f.spawned,0);
   assert.deepEqual(f.actor,before);assert.equal(f.world.time,time);continue;
  }
  const result=f.run(),target=f.world.fighters[1];assert.equal(target.lane,1);
  assert.equal(result.initial.targetLane,target.lane);assert.equal(target.y,centers[target.lane]);assert.deepEqual(f.actor,before);assert.equal(f.world.time,time);
 }
 for(const setup of [{anchorLane:3},{recoveryLane:-1},{recoveryLane:.5},{recoveryLane:NaN}]){
  const f=bornLaneTargetFixture({...setup,laneYFor:()=>282}),before=structuredClone(f.actor);
  assert.throws(f.run,/lane center resolver/u);assert.equal(f.spawned,0);assert.deepEqual(f.actor,before);assert.equal(f.world.time,77.8);
 }
});

test('every unsettled born engage condition fails before target allocation without touching the original actor',()=>{
 for(const mutate of [a=>{a.navigationRecovery.recoveryLane=0;},a=>{a.navigationRecovery.recoverySeconds=.01;},
  a=>{a.navigationRecovery.terminalFallbackSeconds=.01;},a=>{a.navigationRecovery.routeReleaseRequested=true;},
  a=>{a.anchorLane=2;},a=>{a.y+=2.01;},a=>{a.y=NaN;},a=>{a.y=Infinity;},a=>{a.y=-Infinity;},
  a=>{a.nextLaneDecisionAt=77.6;},
  a=>{a.targetId=20;},a=>{a.targetObjectId='barricade';}]){
  const f=bornLaneTargetFixture({anchorLane:1,laneYFor:()=>282});f.actor.y=282;mutate(f.actor);
  const before=structuredClone(f.actor);assert.throws(f.run,/settle on its naturally committed route/u);
  assert.equal(f.spawned,0);assert.equal(f.world.fighters.length,1);assert.deepEqual(f.actor,before);assert.equal(f.world.time,77.8);
 }
});
test('missing/nonfinite current lane resolver fails before spawning and never falls back to transient actor Y',()=>{
 for(const laneYFor of [undefined,null,0,()=>undefined,()=>NaN,()=>Infinity]){
  const f=bornLaneTargetFixture({laneYFor}),before=structuredClone(f.actor);
  assert.throws(f.run,/lane center/u);assert.equal(f.spawned,0);assert.equal(f.world.fighters.length,1);
  assert.deepEqual(f.actor,before);assert.equal(f.world.time,77.8);
 }
 for(const lane of [-1,3,.5,null]){
  const f=bornLaneTargetFixture({lane,laneYFor:()=>0}),before=structuredClone(f.actor);
  assert.throws(f.run,/lane center resolver/u);assert.equal(f.spawned,0);assert.deepEqual(f.actor,before);
 }
});


function currentMayoLaneFixture(options={}) {
 const {phase='engage',centers=[240,285,325],actorLane=2,actorY=325,actorX=354.124375}=options;
 const actor={id:10,kind:'mayo-chan',side:'human',speed:47.85,laneSpeed:120,damage:14.56,range:22,attackEvery:.48,
  hp:64,maxHp:64,cooldown:0,bodyRadius:7,x:330,y:centers[1],lane:1,anchorLane:1,combatReady:true,
  manualAbility:createManualAbilityRuntime('mayo-chan'),mayoRetreat:null,
  animationPresentation:{state:'move',locomotionPhase:12.34},navigationRecovery:{elapsed:.19}};
 const target={id:12,kind:'walker',side:'zombie',hp:100,maxHp:100,x:900,y:centers[1],lane:1,anchorLane:1,
  bodyRadius:11,combatReady:true,speed:20,laneSpeed:20,damage:10,cooldown:0};
 const world={time:0,running:true,over:false,paused:false,fighters:[actor,target],manualAbilityReceipts:[]},ui=[];let tick=0;
 const owner=createMayoFeralProofOwner({definition:MANUAL_ABILITY_REGISTRY['mayo-chan'],battleGeneration:()=>7,
  simulationTick:()=>tick,nativeNow:()=>1234,setPausedUi:v=>ui.push(v),attackReachFor:normalAttackReach,
  prepareNormalPair:()=>({actor,target}),laneYFor:Object.hasOwn(options,'resolver')?options.resolver:lane=>centers[lane]});
 const proof=owner.prepare(world,{proofId:'mayo-current-lane',phase});
 const begun=beginManualAbility(actor.manualAbility,{id:target.id,x:target.x,y:target.y,lane:target.lane});
 assert.equal(begun.ok,true);actor.manualAbility=begun.runtime;
 world.manualAbilityReceipts.push({ownerId:actor.id,kind:'mayo-chan',eventType:'start',activationId:begun.activationId,at:0});
 while(actor.manualAbility.phase!=='feral'&&tick<100){
  tick++;world.time+=1/60;owner.beforeStep(world,actor,1/60,tick);
  const step=advanceManualAbility(actor.manualAbility,1/60);actor.manualAbility=step.runtime;
  for(const e of step.events)world.manualAbilityReceipts.push({ownerId:actor.id,kind:e.kind,eventType:e.type,activationId:e.activationId,at:world.time});
  owner.afterStep(world,actor,tick);
 }
 assert.equal(actor.manualAbility.phase,'feral');
 // Geometry observed after genuine activation in the three original failing native cases.
 Object.assign(actor,{x:actorX,y:actorY,lane:actorLane,anchorLane:actorLane});
 return {actor,target,world,ui,owner,proof,centers};
}

test('Mayo feral arm repairs the three recorded stale target lanes without resetting the actual actor',()=>{
 for(const options of [
  {phase:'attack',centers:[212,282,352],actorLane:0,actorY:233.5,actorX:355.719375},
  {phase:'engage',centers:[240,285,325],actorLane:2,actorY:323.5,actorX:353.326875},
  {phase:'engage',centers:[240,285,325],actorLane:2,actorY:325,actorX:354.124375},
 ]){
  const f=currentMayoLaneFixture(options),beforeActor=structuredClone(f.actor),beforeTarget=structuredClone(f.target),time=f.world.time;
  assert.equal(canAcquireCombatTarget({attacker:f.actor,target:f.target,hasLineOfSight:true}),false);
  f.owner.arm(f.world,f.proof.proofId);
  assert.deepEqual(f.actor,beforeActor);assert.equal(f.world.time,time);
  assert.equal(f.target.lane,f.actor.lane);assert.equal(f.target.anchorLane,f.actor.lane);
  assert.equal(f.target.y,f.centers[f.actor.lane]);if(f.actor.y!==f.centers[f.actor.lane])assert.notEqual(f.target.y,f.actor.y);
  for(const key of ['hp','maxHp','speed','laneSpeed','damage','cooldown'])assert.equal(f.target[key],beforeTarget[key]);
  assert.equal(canAcquireCombatTarget({attacker:f.actor,target:f.target,hasLineOfSight:true}),true);
  assert.equal(canNormalAttackTarget({attacker:f.actor,target:f.target,hasLineOfSight:true}),options.phase==='attack');
  if(options.phase==='engage')assert.ok(f.target.x-f.actor.x>normalAttackReach(f.actor,f.target)+4);
  assert.deepEqual(f.ui,[true]);
 }
});

test('Mayo missing or nonfinite current lane center fails before changing either actor, target or pause',()=>{
 for(const resolver of [undefined,()=>NaN,()=>Infinity]){
  const f=currentMayoLaneFixture({resolver}),actor=structuredClone(f.actor),target=structuredClone(f.target),time=f.world.time;
  assert.throws(()=>f.owner.arm(f.world,f.proof.proofId),/Current Mayo lane center resolver/);
  assert.deepEqual(f.actor,actor);assert.deepEqual(f.target,target);assert.equal(f.world.time,time);
  assert.equal(f.world.paused,false);assert.deepEqual(f.ui,[]);
 }
});

test('already recording Mayo arms only the target while its original clock and ability keep running',()=>{
 const f=currentMayoLaneFixture(),actor=structuredClone(f.actor),time=f.world.time;
 const armed=f.owner.arm(f.world,f.proof.proofId,{pauseForRecorder:false});
 assert.deepEqual(f.actor,actor);assert.equal(f.world.time,time);
 assert.equal(f.world.paused,false);assert.deepEqual(f.ui,[]);
 assert.equal(armed.arm.pauseForRecorder,false);
 assert.equal(armed.arm.activeRemaining,actor.manualAbility.activeRemaining);
 assert.equal(armed.ownerEvidence.feralReceipt.activationId,actor.manualAbility.activationId);
 assert.equal(f.target.lane,actor.lane);assert.equal(f.target.y,f.centers[actor.lane]);
 assert.ok(f.target.x-actor.x>normalAttackReach(f.actor,f.target));
 assert.throws(()=>f.owner.release(f.world,f.proof.proofId),/release invalid/);
 assert.deepEqual(f.actor,actor);assert.equal(f.world.paused,false);
});

test('running Mayo arm rejects a paused world or invalid option before any fixture mutation',()=>{
 for(const option of [false,null,0,'false']){
  const f=currentMayoLaneFixture();if(option===false)f.world.paused=true;
  const before=structuredClone(f.world);
  assert.throws(()=>f.owner.arm(f.world,f.proof.proofId,{pauseForRecorder:option}),/unpaused world/);
  assert.deepEqual(f.world,before);assert.deepEqual(f.ui,[]);
 }
});
