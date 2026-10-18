import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {hasPausedReadyMayo,armRunningMayoWhenFeral,fenceRecordedMayoSample,activateRecordedMayo} from '../scripts/v177-mayo-engagement-capture.mjs';

function fixture(){
 const proof={proofId:'mayo-original',proofGeneration:7,battleGeneration:12,fighterId:751,priorActivationId:2};
 const snapshot={running:true,paused:false};
 const live={...proof,manualAbility:{phase:'feral',activationId:3,activeRemaining:6.2},mayoRetreat:null};
 const source={ownerEvidence:{activationId:3,startReceipt:{ownerId:751,activationId:3,kind:'mayo-chan',eventType:'start'},
  feralReceipt:{ownerId:751,activationId:3,kind:'mayo-chan',eventType:'feral-start'}}};
 const audit={fighter:{renderKind:'mayo-chan',hp:64},renderHistory:[{renderKind:'mayo-chan',assetReady:true,renderSequence:4}]};
 const calls=[],qa={getSnapshot:()=>snapshot,getV177NativeMayoProof:(id,light)=>light?live:source,
  getEnemyFacingRuntimeAudit:()=>audit,armV177NativeMayoProof:(...args)=>{calls.push(args);return{arm:{activeRemaining:6.2}};}};
 const run=fn=>vm.runInNewContext('('+fn.toString()+')',{window:{__ASHFALL_BATTLE_QA__:qa},document:{visibilityState:'visible'},performance:{now:()=>123}})(proof);
 return{proof,snapshot,live,source,audit,calls,run};
}

test('only the same real activation can arm the running feral observation',()=>{
 const f=fixture(),result=f.run(armRunningMayoWhenFeral);
 assert.equal(result.arm.activeRemaining,6.2);assert.equal(f.calls.length,1);
 assert.equal(f.calls[0][0],f.proof.proofId);assert.equal(f.calls[0][1].pauseForRecorder,false);
 assert.equal(result.captureBoundary.renderSequence,4);assert.equal(result.activationRenderPrefix.length,1);
 for(const change of [
  f=>{f.snapshot.paused=true;},f=>{f.snapshot.running=false;},
  f=>{f.live.proofGeneration++;},f=>{f.live.battleGeneration++;},f=>{f.live.fighterId++;},
  f=>{f.live.manualAbility.phase='retreat';},f=>{f.live.manualAbility.activeRemaining=0;},
  f=>{f.live.mayoRetreat={};},f=>{f.source.ownerEvidence.feralReceipt=null;},
  f=>{f.source.ownerEvidence.startReceipt.ownerId++;},f=>{f.source.ownerEvidence.feralReceipt.ownerId++;},
  f=>{f.source.ownerEvidence.activationId++;},f=>{f.source.ownerEvidence.feralReceipt.activationId++;},
  f=>{f.live.manualAbility.activationId++;},f=>{f.source.ownerEvidence.startReceipt.activationId++;},
  f=>{f.source.ownerEvidence.startReceipt.kind='ranger';},f=>{f.source.ownerEvidence.startReceipt.eventType='feral-start';},
  f=>{f.source.ownerEvidence.feralReceipt.kind='ranger';},f=>{f.source.ownerEvidence.feralReceipt.eventType='start';},
 ]){
  const f=fixture();change(f);assert.equal(f.run(armRunningMayoWhenFeral),false);assert.equal(f.calls.length,0);
 }
});

test('a fixed real render boundary preserves every in-window failure and keeps the original prefix',()=>{
 const f=fixture(),armed=f.run(armRunningMayoWhenFeral),prefix=structuredClone(f.audit.renderHistory);
 const bad={renderSequence:6,renderKind:'mayo-chan',assetReady:false};
 const sample={at:124,renders:[...prefix,{renderSequence:5,renderKind:'mayo-chan-feral'},bad]};
 const observed=fenceRecordedMayoSample(sample,armed.captureBoundary);
 assert.deepEqual(armed.activationRenderPrefix,f.audit.renderHistory);
 assert.deepEqual(observed.renders,[sample.renders[1],bad]);
 assert.deepEqual(sample.renders[0],prefix[0]);assert.equal(sample.renders.length,3);
 assert.throws(()=>fenceRecordedMayoSample(sample,null),/boundary required/);
 assert.throws(()=>fenceRecordedMayoSample({...sample,renders:[{renderKind:'mayo-chan-feral'}]},armed.captureBoundary),/sequence required/);
});

test('normal ready paint must finish before recording setup can consume the active window',()=>{
 const f=fixture();f.snapshot.paused=true;f.live.manualAbility.phase='ready';
 assert.equal(f.run(hasPausedReadyMayo),true);assert.equal(f.calls.length,0);
 for(const change of [f=>{f.snapshot.paused=false;},f=>{f.live.manualAbility.phase='feral';},
  f=>{f.live.proofGeneration++;},f=>{f.audit.fighter.renderKind='mayo-chan-feral';},
  f=>{f.audit.renderHistory=[];},f=>{f.audit.renderHistory[0].assetReady=false;}]){
  const f=fixture();f.snapshot.paused=true;f.live.manualAbility.phase='ready';change(f);
  assert.equal(f.run(hasPausedReadyMayo),false);assert.equal(f.calls.length,0);
 }
});

test('native start ACK precedes the actual marker input and a genuine activation precedes the feral boundary',async()=>{
 const proof={fighterId:751,proofId:'mayo-original'},events=[];let pressed=false;
 const snapshot=()=>({screen:'battle',battleGeneration:12,stageId:'stage-1',time:10,
  fighters:[{id:751,manualAbility:{activationId:pressed?3:2}}],
  manualAbilityReceipts:pressed?[{ownerId:751,kind:'mayo-chan',eventType:'start',activationId:3,at:10}]:[]});
 const page={evaluate:async()=>snapshot(),locator:selector=>{
  assert.ok(selector.includes('[data-fighter-id="751"]'));
  return{evaluateAll:async()=>({unitCard:false,point:{x:40,y:50}})};
 },mouse:{move:async()=>events.push('move'),down:async()=>events.push('down'),up:async()=>{events.push('up');pressed=true;}},
 waitForFunction:async(fn,p,options)=>{events.push('feral');assert.equal(options.polling,'raf');assert.equal(p,proof);
  return{jsonValue:async()=>({arm:{activeRemaining:6.2,pauseForRecorder:false},captureBoundary:{renderSequence:100}}),dispose:async()=>events.push('dispose')};}};
 await activateRecordedMayo(page,proof,{waitForStart:async()=>{events.push('ACK');return{startedAt:123};}});
 assert.deepEqual(events,['ACK','move','down','up','feral','dispose']);
 assert.equal(proof.captureActivation.recordingStart.startedAt,123);
 assert.equal(proof.captureActivation.boundary.activeRemaining,6.2);
 assert.equal(proof.captureBoundary.renderSequence,100);
});

test('a missing original start ACK never invokes the ability or arms a capture',async()=>{
 const sentinel=new Error('Original recorder start missing');let inputs=0;
 const page={evaluate:async()=>{inputs++;throw new Error('must not read ability');}};
 await assert.rejects(()=>activateRecordedMayo(page,{fighterId:751},{waitForStart:async()=>{throw sentinel;}}),e=>e===sentinel);
 assert.equal(inputs,0);
});
