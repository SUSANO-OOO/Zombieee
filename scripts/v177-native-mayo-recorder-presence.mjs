import assert from 'node:assert/strict';
import {prepareCase,hasPreparedAllUnitPaint} from './v177-native-allunit-cases.mjs';
import {assertV177AuthoredLiveRender} from './v177-continuous-render-contract.mjs';
import {startNativeGameRafObservation,stopNativeGameRafObservation,nativeGameDamageReceipt} from './v177-native-game-capture-browser.mjs';
import {readNativeAllUnitSample,assertShardProof,createNativeAllUnitRealmOwner,readNativeAllUnitRealmOwner,releasePreparedShardClock,assertNativeRealmMember} from './v177-native-allunit-contract.mjs';
import {LIMITS} from './v177-native-allunit-manifest.mjs';

// ADHOC non-recording diagnostic, never an accepted native-media case. Its
// gameplay and reader callbacks are the exact imports used by the original A.
export async function observeUnrecordedMayo(page,row,{onFailure=()=>{}}={}){
 assert.equal(process.env.V105_RECORDER_PRESENCE,'absent');
 assert.equal(row.caseId,'forms-4:mayo-chan:attack:1280x720');
 assert.equal(row.owner,'ordinary');assert.equal(row.phase,'attack');
 assert.equal(LIMITS.moveAttackSamples,15);assert.equal(LIMITS.sampleDelayMs,120);
 const resources={pointer:null,realmOwner:null,sampleHandles:[]};let observation,primary;
 const active=()=>{assert.notEqual(row.deadlineExpired,true);assert.equal(page.isClosed(),false);};
 const owned=async operation=>{active();const value=await operation();active();return value;};
 try{
  row.proof=await prepareCase(page,row,owned,active,resources);assertShardProof(row,row.proof);
  await owned(()=>page.waitForFunction(hasPreparedAllUnitPaint,row.proof,{timeout:LIMITS.readinessMs}));
  resources.realmOwner=await page.evaluateHandle(createNativeAllUnitRealmOwner);active();
  row.realmOwner=await owned(()=>resources.realmOwner.evaluate(readNativeAllUnitRealmOwner));
  observation=await page.evaluateHandle(startNativeGameRafObservation,{...row.proof,realmOwner:resources.realmOwner});active();
  row.pausedCaptureStart=await owned(()=>resources.realmOwner.evaluate(readNativeAllUnitSample,{...row.proof,performanceBoundary:true}));
  assert.equal(row.pausedCaptureStart.paused,true);assert.equal(row.pausedCaptureStart.running,true);
  row.unrecordedBoundary={at:row.pausedCaptureStart.at,simulationTime:row.pausedCaptureStart.simulationTime,
   renderSequence:Math.max(...row.pausedCaptureStart.renders.map(r=>r.renderSequence)),realm:row.pausedCaptureStart.realm};
  row.sequenceBaseline=row.unrecordedBoundary.renderSequence;
  row.release=await owned(()=>resources.realmOwner.evaluate(releasePreparedShardClock,row.proof));
  assert.equal(row.release.beforePaused,true);assert.equal(row.release.afterPaused,false);
  assert.equal(row.release.beforeTime,row.release.afterTime);
  row.captureStart=await owned(()=>resources.realmOwner.evaluate(readNativeAllUnitSample,{...row.proof,performanceBoundary:true}));
  row.sampleRpcTimings=[];
  for(let i=0;i<LIMITS.moveAttackSamples;i++){
   const sampleAt=row.captureStart.at+(i+1)*LIMITS.sampleDelayMs;
   const rpc={index:i,sampleAt,startedAt:performance.now(),status:'pending'};row.sampleRpcTimings.push(rpc);
   try{await owned(async()=>{const handle=await resources.realmOwner.evaluateHandle(readNativeAllUnitSample,{...row.proof,
     sampleAt,performanceBoundary:i===LIMITS.moveAttackSamples-1,immutableSnapshot:true});
     resources.sampleHandles.push({handle,exported:false});});rpc.status='completed';}
   catch(error){rpc.status='error';rpc.error=String(error);throw error;}
   finally{rpc.finishedAt=performance.now();rpc.durationMs=rpc.finishedAt-rpc.startedAt;}
  }
  row.sourceRaf=await owned(()=>observation.evaluate(stopNativeGameRafObservation));
  await observation.dispose();observation=null;
  row.captureEnd=await owned(()=>resources.realmOwner.evaluate(readNativeAllUnitSample,{...row.proof,performanceBoundary:true}));
  for(const entry of resources.sampleHandles){row.samples.push(await owned(()=>entry.handle.evaluate(value=>value)));entry.exported=true;}
  assert.equal(row.sourceRaf.overflow,false);assert.equal(row.sourceRaf.realm.failure,null);
  let previous=row.release.realm;
  for(const s of [row.captureStart,...row.samples]){
   assertNativeRealmMember(row.realmOwner,s.realm,'sample',previous);previous=s.realm;
   assert.equal(s.running,true);assert.equal(s.paused,false);assert.equal(s.visible,true);
   assert.equal(s.fighter.id,row.proof.fighterId);assert.equal(s.target.id,row.proof.targetId);
   assert.equal(s.battleGeneration,row.proof.battleGeneration);
  }
  const windowSamples=row.samples.map(s=>({...s,renders:s.renders.filter(r=>r.renderSequence>row.sequenceBaseline
   &&r.jointPaintedAt>=row.unrecordedBoundary.simulationTime&&r.jointPaintedAt<=s.simulationTime)}));
  row.summary=assertV177AuthoredLiveRender({...row,samples:windowSamples});
  row.damageReceipt=nativeGameDamageReceipt(row);
  row.unrecordedPerformance={before:row.captureStart.runtimePerformance,after:row.samples.at(-1).runtimePerformance,
   geometryBefore:row.captureStart.geometry,geometryAfter:row.samples.at(-1).geometry,accepted:false,
   scope:'Original raw counter/geometry boundaries only; no clip, original native-media contract or formal acceptance'};
  row.media={created:false,streamCreated:false,captureTimerCreated:false,encodedPtsVerified:false,accepted:false};
  active();row.status='observed-unrecorded-control';
 }catch(error){primary=error;row.originalFailure=String(error);onFailure(error);throw error;}
 finally{
  row.cleanupErrors=[];
  if(observation){try{row.interruptedSourceRaf=await observation.evaluate(stopNativeGameRafObservation);}catch(e){row.cleanupErrors.push(String(e));}
   try{await observation.dispose();}catch(e){row.cleanupErrors.push(String(e));}}
  for(const entry of resources.sampleHandles){if(!entry.exported)try{(row.interruptedSamples??=[]).push(await entry.handle.evaluate(value=>value));}catch(e){row.cleanupErrors.push(String(e));}
   try{await entry.handle.dispose();}catch(e){row.cleanupErrors.push(String(e));}}
  try{await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(true));}catch(e){row.cleanupErrors.push(String(e));}
  if(resources.realmOwner)try{await resources.realmOwner.dispose();}catch(e){row.cleanupErrors.push(String(e));}
  if(!primary&&row.cleanupErrors.length)throw Error(row.cleanupErrors.join('; '));
 }
}
