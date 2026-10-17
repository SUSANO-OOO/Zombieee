import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {armV177TurnedGetupProof,releaseV177TurnedGetupProof,readV177TurnedGetupProof} from '../app/v177TurnedGetupProof.js';
import {createAllyLifecycle,beginAllyDeath,advanceAllyLifecycle} from '../app/combatLifecycle.js';
import {allyCorpseVisualCue} from '../app/corpseVisuals.js';
import {createBattleDefinition,battleOutcomeFor} from '../app/battleDefinitions.js';
import {createEnemySpawnRuntime} from '../app/gameRules.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {V177_JOINT_ATLASES,v177JointPose,v177CaptureJointPose} from '../app/v177JointPresentation.js';
import {assertNativeTurnedGetup,nativeTurnedGetupReady,captureNativeTurnedGetupCase,readNativeTurnedGetupSample,
  startNativeTurnedGetupRafObservation} from '../scripts/v177-native-turned-getup.mjs';

const app=fs.readFileSync('app/AshfallGame.tsx','utf8'),tree=ts.createSourceFile('app.tsx',app,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),nodes=[];
const visit=n=>{nodes.push(n);ts.forEachChild(n,visit);};visit(tree);
const prepare=nodes.find(n=>ts.isPropertyAssignment(n)&&n.name.getText(tree)==='prepareV177TurnedGetupProof');assert.ok(prepare);
const compiled=ts.transpileModule('const prepare='+prepare.initializer.getText(tree)+';',
  {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function prepared(variant=0) {
  const definition=createBattleDefinition(V100_STAGE_IDS[0],{v100:true}),world={definition,nextId:42,time:10,phase:0,wave:0,
    fighters:[],corpses:[],areaEffects:[{kind:'burn'}],baseMaxHp:definition.baseMaxHp,barricadeMaxHp:definition.enemyBaseMaxHp,
    battleAudioGeneration:7,survivalRun:null,save:{revision:9,settings:{bgmVolume:.5}},performance:{renderFrames:17}};
  const history=new Map(),events=[],bindings={gameRef:{current:world},V100_STAGE_IDS,activeLaneCenters:[220,300,380],
    fighterRenderAuditHistory:history,fighterActualXDeltaAudit:new Map(),corpseRenderAuditHistory:new Map(),
    selectedActionRef:{current:null},createEnemySpawnRuntime,clearTransientRenderObjects:()=>events.push('clear-transient'),
    advanceAllyLifecycle,beginAllyDeath,createAllyLifecycle,battleOutcomeFor,armV177TurnedGetupProof};
  for(const name of ['setSelectedAction','setStarted','setPaused','setEnd','setScreen'])bindings[name]=value=>events.push([name,value]);
  const run=new Function(...Object.keys(bindings),compiled+'return prepare;')(...Object.values(bindings));
  return {world,run,proof:run({variant}),events};
}

test('actual localhost preparation seeds one original human lifecycle and preserves save, ID sequence and performance',()=>{
  for(const variant of [0,1]) {
    const {world,proof}=prepared(variant);
    assert.equal(proof.variant,variant);assert.equal(proof.expectedVariant,variant===0?'forward':'back');
    assert.deepEqual(proof.initialFighterIds,[]);assert.equal(world.fighters.length,0);assert.equal(world.nextId,43);
    assert.equal(world.corpses.length,1);assert.equal(world.corpses[0].id,42);assert.equal(world.corpses[0].side,'human');
    assert.ok(Math.abs(world.corpses[0].infectionRemaining-4.8)<1e-9);assert.equal(world.areaEffects.length,0);
    assert.equal(battleOutcomeFor(world.definition,{...world,wavesResolved:true}),null);
    assert.deepEqual(world.save,{revision:9,settings:{bgmVolume:.5}});assert.deepEqual(world.performance,{renderFrames:17});
    const unchanged=structuredClone(world);assert.throws(()=>releaseV177TurnedGetupProof(world,'wrong'));
    assert.deepEqual(world,unchanged);assert.equal(releaseV177TurnedGetupProof(world,proof.proofId).releasedAt,72);
    assert.equal(world.time,72);assert.equal(world.paused,false);assert.equal(world.fighters.length,0);
    assert.throws(()=>releaseV177TurnedGetupProof(world,proof.proofId));
  }
});

test('preparation rejects other stages and variants before changing their world',()=>{
  for(const change of [world=>{world.definition=createBattleDefinition(V100_STAGE_IDS[1],{v100:true});},world=>{world.survivalRun={};}]) {
    const {world,run}=prepared();change(world);const before=structuredClone(world);assert.throws(()=>run({variant:0}));assert.deepEqual(world,before);
  }
  const {world,run}=prepared(),before=structuredClone(world);assert.throws(()=>run({variant:2}));assert.deepEqual(world,before);
});

test('world-local observations discover only an actual matching new ID and isolate returned data and release generation',()=>{
  const {world,proof}=prepared(),birth={corpseId:42,actorId:99,bornAt:76.81},corpseRows=[{renderSequence:3}],fighterRows=[{renderSequence:4}];
  const deps={readBirth:()=>birth,corpseHistory:()=>corpseRows,fighterHistory:()=>fighterRows};
  assert.equal(readV177TurnedGetupProof({...world},{},deps),null);assert.equal(readV177TurnedGetupProof(world,{},deps).actorId,null);
  releaseV177TurnedGetupProof(world,proof.proofId);world.fighters=[{id:99,kind:'turned',side:'zombie'}];world.corpses=[];
  const full=readV177TurnedGetupProof(world,{},deps);assert.equal(full.actorId,99);full.actualBirth.actorId=1;full.draws[0].renderSequence=1;
  assert.equal(readV177TurnedGetupProof(world,{},deps).actorId,99);assert.equal(fighterRows[0].renderSequence,4);
  const light=readV177TurnedGetupProof(world,{light:true},deps);assert.equal(light.actorId,99);assert.equal(light.draws,undefined);
  world.fighters.push({id:100,kind:'turned',side:'zombie'});
  assert.throws(()=>readV177TurnedGetupProof(world,{}, {...deps,readBirth:(_w,f)=>({...birth,actorId:f.id})}));
  world.fighters.pop();world.battleAudioGeneration++;assert.throws(()=>readV177TurnedGetupProof(world,{},deps));
});

function contractFixture(variant=0) {
  const {proof}=prepared(variant),bornAt=76.81,sourceAt=76.79,floorY=proof.preparedCorpse.y+5;
  const sourceCue=allyCorpseVisualCue(advanceAllyLifecycle(proof.preparedCorpse,sourceAt-proof.preparedAt),sourceAt);
  const birth={corpseId:42,actorId:99,bornAt,initialRemaining:.74,
    variant:proof.expectedVariant,variantBasis:'source-bound-fall',floorY,
    source:{at:sourceAt,sourceBound:true,recordedAfterPaint:true,physicalFloorY:floorY,paintedFloorY:floorY+sourceCue.tremorY}};
  const pose=v177CaptureJointPose('turned',v177JointPose('turned',{requestedState:'idle'},{locomotionPhase:0,locomotionSettle:1}));
  const draw=(sequence,progress)=>({renderSequence:sequence,renderKind:'turned',jointAtlasPath:V177_JOINT_ATLASES.turned.path,
    jointDrawSucceeded:true,jointPaintedAt:progress===null?77.56+sequence*.001:bornAt+progress*.75-.01,
    jointGetupProgress:progress,jointGetupDrawSucceeded:progress!==null,jointGetupPaintedAt:progress===null?undefined:bornAt+progress*.75-.01,
    jointGetupCorpseId:42,jointGetupVariant:proof.expectedVariant,jointGetupSourcePaintBound:true,jointGetupReactionAmplitude:0,
    jointGetupPaintedPose:pose,requestedState:progress===null?'move':'idle',actualXDelta:progress===null?-.3:0});
  const common={proofId:proof.proofId,battleGeneration:7,running:true,over:false,visible:true,overflow:false,proof,corpseDraws:[]};
  const captureStart={...common,at:110,simulationTime:72,time:72,paused:true,released:false,actorId:null,actualBirth:null,
    corpse:{id:42},fighter:null,draws:[],corpseDraws:[{renderSequence:1}]};
  const samples=[.1,.5,.9,null].map((progress,i)=>{
    const time=progress===null?77.6:bornAt+progress*.75-.01;
    return {...common,at:1000+i*2000,time,simulationTime:time,paused:false,released:true,actorId:99,actualBirth:birth,corpse:null,
      fighter:{id:99,kind:'turned',side:'zombie',hp:40,flash:0,stunned:0,spawnGrace:Math.max(0,.74-(time-bornAt)),x:progress===null?609:610},
      draws:progress===null?[draw(5,null),draw(6,null),draw(7,null)]:[draw(i+2,progress)]};
  });
  const metadata={form:'turned',requestedKind:'turned',preparedRenderKind:'turned',phase:'turned-getup',fixtureGroup:'actual-infection-getup',
    fighterId:null,corpseId:42,variant,proofId:proof.proofId,battleGeneration:7,diagnosticOnly:true};
  const bytes=Buffer.from('transport-only fixture, not native video'),nativeClip={metadata,status:'recorded',engine:'webkit',mimeType:'video/webm',
    requestedMimeType:'video/webm;codecs=vp8',timeOrigin:100000,startedAt:100,stopRequestedAt:8000,originalSpeedAccepted:false,encodedPtsVerified:false,
    file:'/transport-fixture.webm',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  return {row:{form:'turned',phase:'turned-getup',variant,proof,captureStart,samples,nativeClip,recordingStart:{startedAt:100,timeOrigin:100000},
    releasedAtNative:120,release:{receipt:{releasedAt:72,proofId:proof.proofId}}},bytes};
}

test('the receipt contract fails closed on a replaced newborn, source, clock, prepaint label or missing ordinary return',()=>{
  for(const variant of [0,1])assert.equal(assertNativeTurnedGetup(contractFixture(variant).row).wholeGameAccepted,false);
  for(const mutate of [r=>{r.samples.at(-1).actualBirth.source.sourceBound=false;},r=>{r.samples.at(-1).actualBirth.actorId=42;},
    r=>{r.samples.at(-1).fighter.spawnGrace=.1;},r=>{r.samples[0].draws[0].jointDrawSucceeded=false;},
    r=>{r.samples[0].draws[0].jointGetupPaintedPose.upper.spine=[1];},r=>{r.samples.at(-1).draws=[];},
    r=>{r.nativeClip.metadata.fighterId=99;},r=>{r.samples.at(-1).actualBirth.source.at=71;}]) {
    const {row}=contractFixture();mutate(row);assert.throws(()=>assertNativeTurnedGetup(row));
  }
  const {row}=contractFixture();row.samples.at(-1).draws=[];assert.equal(nativeTurnedGetupReady(row),false);
});

test('the original infection tremor has its own strict painted-floor owner and cannot hide physical or source drift',()=>{
  for(const variant of [0,1]){
    const {row}=contractFixture(variant),birth=row.samples.at(-1).actualBirth;
    const cue=allyCorpseVisualCue(advanceAllyLifecycle(row.proof.preparedCorpse,birth.source.at-row.proof.preparedAt),birth.source.at);
    assert.ok(cue.tremorY>1e-4);assert.ok(Math.abs(birth.source.paintedFloorY-birth.floorY-cue.tremorY)<1e-12);
    assert.equal(assertNativeTurnedGetup(row).wholeGameAccepted,false);
  }
  for(const mutate of [r=>{r.samples.at(-1).actualBirth.source.physicalFloorY+=1e-5;},
    r=>{r.samples.at(-1).actualBirth.source.paintedFloorY+=1e-5;},
    r=>{const b=r.samples.at(-1).actualBirth;b.source.paintedFloorY=b.floorY;},
    r=>{r.proof.preparedCorpse.y+=1e-5;},r=>{r.proof.preparedCorpse.id++;},
    r=>{r.samples.at(-1).actualBirth.source.at=r.samples.at(-1).actualBirth.bornAt;}]){
    const {row}=contractFixture();mutate(row);assert.throws(()=>assertNativeTurnedGetup(row));
  }
});

test('actual capture ownership releases after native start and preserves the original failure through cleanup',async()=>{
  for(const fail of [false,true]) {
    const {row:original,bytes}=contractFixture(),events=[],sentinel=Error('original capture failure');let cursor=-1;
    const row={form:'turned',phase:'turned-getup',variant:0,viewport:{width:844,height:340},samples:[]};
    const handle={evaluate:async()=>({timeOrigin:100000,overflow:false,rows:[{at:1},{at:2},{at:3}]}),dispose:async()=>events.push('dispose')};
    const page={waitForFunction:async()=>{},evaluateHandle:async fn=>{assert.equal(fn,startNativeTurnedGetupRafObservation);return handle;},
      waitForTimeout:async()=>{},evaluate:async(fn)=>{
        if(fn===readNativeTurnedGetupSample){
          if(fail&&cursor===0)throw sentinel;
          if(cursor<0){cursor++;return original.captureStart;}
          if(cursor<4)return original.samples[cursor++];
          return {...original.samples.at(-1),at:original.samples.at(-1).at+1,draws:[],corpseDraws:[]};
        }
        if(fn.toString().includes('prepareV177TurnedGetupProof'))return original.proof;
        if(fn.toString().includes('releaseV177TurnedGetupProof')){events.push('release');return {...original.release,at:120};}
        if(fn.toString().includes('setEnemyVfxProofPaused')){events.push('pause');return true;}throw Error('unexpected mutator');
      }};
    const deps={out:'/fixture',mimeType:'video/webm;codecs=vp8',read:async()=>bytes,
      nativeGamePerformanceReceipt:()=>({scope:'mock counters only'}),stopNativeGameRafObservation(){},
      beginV177NativeCanvasClip:async(_page,metadata)=>({waitForStart:async()=>{events.push('native-start');return original.recordingStart;},
        finish:async({completed})=>{events.push(completed?'complete':'interrupt');return {...original.nativeClip,metadata};}})};
    if(fail)await assert.rejects(captureNativeTurnedGetupCase(page,row,deps),error=>error===sentinel);
    else {await captureNativeTurnedGetupCase(page,row,deps);assert.equal(row.status,'observed-diagnostic');}
    assert.ok(events.indexOf('native-start')<events.indexOf('release'));assert.equal(events.at(-1),'pause');
    assert.equal(events.filter(e=>e==='dispose').length,1);if(fail)assert.ok(events.includes('interrupt'));
  }
});
