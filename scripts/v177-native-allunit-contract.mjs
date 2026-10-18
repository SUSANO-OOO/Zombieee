import assert from 'node:assert/strict';
import {assertPlannedCase,LIMITS} from './v177-native-allunit-manifest.mjs';
const statKeys=['speed','laneSpeed','damage','range','attackEvery','hp','maxHp'];
const id=value=>Number.isSafeInteger(value)&&value>=0;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const token=value=>typeof value==='string'&&value.length>0&&value.length<=160;
export function assertShardProof(row,proof){
 assertPlannedCase(row);const b=row.binding;assert.equal(proof?.schema,'v177-native-shard-proof/v1');
 assert.ok(token(proof.proofId));assert.ok(id(proof.battleGeneration));assert.ok(token(proof.route));
 assert.ok(id(proof.fighterId)&&id(proof.targetId)&&proof.fighterId!==proof.targetId);
 for(const key of ['owner','kind','side','renderKind','v100TwinPart','legacyFusedFixture'])assert.equal(proof[key],key==='owner'?row.owner:b[key],'Prepared identity differs: '+key);
 assert.equal(proof.phase,row.phase);
 assert.ok(proof.originalActorStats&&statKeys.every(k=>finite(proof.originalActorStats[k])));assert.ok(proof.originalActorStats.speed>0&&proof.originalActorStats.attackEvery>0&&proof.originalActorStats.hp>0&&proof.originalActorStats.maxHp>=proof.originalActorStats.hp);
 assert.ok(proof.ownerEvidence&&typeof proof.ownerEvidence==='object','Source adapter evidence missing');
 // Per-owner birth/ability/pair/damage contracts remain the actual adapter's responsibility.
 return proof;
}
// Serializable read-only browser callback. It does not stamp expected proof values onto a paint.
// Existing fighterId -> Map/history binding is the source ownership boundary.
// No new state/ring/stamp is required. Identical plausible rows maliciously substituted
// after this exact source callback cannot be distinguished by data validation alone.
export function readNativeAllUnitSample({fighterId,targetId,owner,proofId,performanceBoundary=false}){
 const qa=window.__ASHFALL_BATTLE_QA__,snapshot=qa.getSnapshot(),audit=qa.getEnemyFacingRuntimeAudit(fighterId),target=qa.getEnemyFacingRuntimeAudit(targetId);
 const phaseG=qa.getPhaseGCombatSnapshot();
 const mayo=owner==='mayo-activation'?qa.getV177NativeMayoProof(proofId,true):null;
 const pair=owner==='futago-pair'?qa.getV177NativeFutagoPair(proofId):null;
 const history=audit.renderHistory??[];
 const boundary=performanceBoundary?(()=>{
  const canvas=document.querySelector('.game-shell canvas'),r=canvas.getBoundingClientRect();
  return{runtimePerformance:qa.getPerformanceSnapshot(),geometry:{viewport:{width:innerWidth,height:innerHeight},devicePixelRatio,
   canvas:{width:canvas.width,height:canvas.height,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}}};
 })():{};
 return{schema:'v177-native-shard-postpaint/v1',at:performance.now(),timeOrigin:performance.timeOrigin,
  simulationTime:snapshot.time,route:location.pathname,visible:document.visibilityState==='visible',
  running:snapshot.running,paused:snapshot.paused,viewport:{width:innerWidth,height:innerHeight},...boundary,
  lookup:{requestedFighterId:fighterId,observedFighterId:audit.fighter?.id,requestedTargetId:targetId,observedTargetId:target.fighter?.id},
  battleGeneration:phaseG.battleGeneration,historyOverflow:history.length>128,
  fighter:audit.fighter?{...audit.fighter,...(mayo?{activeRemaining:mayo.manualAbility?.activeRemaining}:{} )}:null,target:target.fighter,
  completedAttackImpacts:phaseG.completedAttackImpacts.map(r=>({...r})),
  ...(mayo?{proofId:mayo.proofId,proofGeneration:mayo.proofGeneration,simulationTick:mayo.simulationTick}:{}),
  ...(pair?{ownerEvidence:pair.ownerEvidence,rawPairMembers:pair.members,
   damageCopy:{sequence:pair.sequence,overflow:pair.overflow,failure:pair.failure,rows:pair.rows},
   partner:qa.getEnemyFacingRuntimeAudit(pair.proof.partnerId).fighter,
   partnerTarget:qa.getEnemyFacingRuntimeAudit(pair.proof.partnerTargetId).fighter}:{}),
  renders:history.map(r=>({renderSequence:r.renderSequence,renderKind:r.renderKind,assetReady:r.assetReady,
   renderWidth:r.renderWidth,renderHeight:r.renderHeight,x:r.x,y:r.y,poseScaleX:r.poseScaleX,poseScaleY:r.poseScaleY,
   requestedState:r.requestedState,actualXDelta:r.actualXDelta,jointAtlasPath:r.jointAtlasPath,
   jointLowerFrame:r.jointLowerFrame,jointUpperFrame:r.jointUpperFrame,jointDrawSucceeded:r.jointDrawSucceeded,
   jointPaintedAt:r.jointPaintedAt,renderedWeaponSocket:r.renderedWeaponSocket,
   jointWeightedLowerDrawSucceeded:r.jointWeightedLowerDrawSucceeded,jointWeightedLower:r.jointWeightedLower,
   jointWeaponCycleDrawSucceeded:r.jointWeaponCycleDrawSucceeded,jointWeaponCycle:r.jointWeaponCycle}))};
}
function assertRawEnvelope(row,proof,raw,pausedState=false){
 assertShardProof(row,proof);assert.equal(raw?.schema,'v177-native-shard-postpaint/v1');assert.ok(finite(raw.at)&&finite(raw.timeOrigin)&&finite(raw.simulationTime));
 assert.equal(raw.route,proof.route,'Actual route ownership differs');if(proof.owner!=='legacy-art')assert.equal(raw.route,'/v100');assert.equal(raw.visible,true);assert.equal(raw.running,true);assert.equal(raw.paused,pausedState);assert.deepEqual(raw.viewport,row.viewport);assert.equal(raw.historyOverflow,false);
 assert.equal(raw.lookup?.requestedFighterId,proof.fighterId);assert.equal(raw.lookup?.observedFighterId,proof.fighterId,'Borrowed actor lookup');assert.equal(raw.lookup?.requestedTargetId,proof.targetId);assert.equal(raw.lookup?.observedTargetId,proof.targetId);assert.equal(raw.battleGeneration,proof.battleGeneration,'Original battle/audio generation changed');
 const f=raw.fighter;assert.ok(f);for(const key of ['kind','side','renderKind','v100TwinPart'])assert.equal(f[key],proof[key]);assert.equal(f.id,proof.fighterId);assert.ok(f.hp>0&&finite(f.x));
 for(const key of ['speed','laneSpeed','damage','range','attackEvery','maxHp'])assert.equal(f[key],proof.originalActorStats[key],'Original actor stat changed: '+key);
 if(proof.owner!=='mayo-activation')assert.equal(f.hp,proof.originalActorStats.hp,'Old unchanged actor HP invariant retained');
 else assert.equal(f.manualAbilityPhase,'feral','Actual Mayo render owner must still be feral');
 assert.equal(raw.target?.id,proof.targetId);assert.ok(Array.isArray(raw.renders)&&raw.renders.length>0&&raw.renders.length<=LIMITS.maxHistoryRows);
 return raw;
}
function assertPaint(row,proof,raw,paint,minimumSimulationTime){
 assert.ok(id(paint.renderSequence)&&paint.renderSequence>0);
 assert.equal(paint.jointDrawSucceeded,true,'Actual postpaint success is required');
 assert.ok(finite(paint.jointPaintedAt)&&paint.jointPaintedAt>=minimumSimulationTime&&paint.jointPaintedAt<=raw.simulationTime,'Stale/future paint simulation time');
 assert.equal(paint.renderKind,proof.renderKind);assert.equal(paint.assetReady,true);assert.equal(paint.jointAtlasPath,row.binding.atlas.path);
 assert.ok([paint.renderWidth,paint.renderHeight,paint.x,paint.y,paint.poseScaleX,paint.poseScaleY].every(finite));assert.ok(paint.renderWidth>0&&paint.renderHeight>0&&paint.poseScaleX>0&&paint.poseScaleY>0);
 assert.ok(id(paint.jointLowerFrame)&&id(paint.jointUpperFrame));
 if(['wind-up','active','recovery'].includes(paint.requestedState))assert.ok(finite(paint.renderedWeaponSocket?.x)&&finite(paint.renderedWeaponSocket?.y),'Actual attack socket missing');
 if(row.form==='ranger'){
  assert.equal(paint.jointWeightedLowerDrawSucceeded,true);const w=paint.jointWeightedLower;assert.equal(w?.mode,'continuous-weighted-mesh');assert.equal(w.parts,5);assert.equal(w.meshVertices,130);assert.equal(w.meshTriangles,192);assert.equal(w.coverageSamples,4);assert.equal(w.duplicateWithinPart,0);assert.equal(w.degenerate,0);
 }
}
export function postpaintCaptureBoundary(row,proof,raw,recorderStart){
 assertRawEnvelope(row,proof,raw,true);assert.ok(finite(recorderStart?.startedAt)&&finite(recorderStart.timeOrigin));assert.equal(raw.timeOrigin,recorderStart.timeOrigin);assert.ok(raw.at>=recorderStart.startedAt,'Boundary must be read after actual native recorder start acknowledgment');
 const newest=raw.renders.reduce((a,b)=>a.renderSequence>b.renderSequence?a:b);assertPaint(row,proof,raw,newest,0);
 return{schema:'v177-native-shard-boundary/v1',caseId:row.caseId,proofId:proof.proofId,battleGeneration:proof.battleGeneration,fighterId:proof.fighterId,renderSequence:newest.renderSequence,simulationTime:raw.simulationTime,at:raw.at,timeOrigin:raw.timeOrigin,recorderStartedAt:recorderStart.startedAt};
}
export function assertShardPostpaintContract(row,proof,boundary,release,samples){
 assertShardProof(row,proof);assert.equal(boundary?.schema,'v177-native-shard-boundary/v1');assert.equal(boundary.caseId,row.caseId);
 for(const key of ['proofId','battleGeneration','fighterId'])assert.equal(boundary[key],proof[key]);
 assert.ok(id(boundary.renderSequence)&&boundary.renderSequence>0);assert.ok([boundary.simulationTime,boundary.at,boundary.timeOrigin,boundary.recorderStartedAt].every(finite));assert.ok(boundary.at>=boundary.recorderStartedAt);
 assert.ok(release&&finite(release.at)&&finite(release.timeOrigin)&&finite(release.beforeTime)&&finite(release.afterTime));assert.equal(release.timeOrigin,boundary.timeOrigin);assert.ok(release.at>=boundary.at);assert.equal(release.beforePaused,true);assert.equal(release.afterPaused,false);assert.equal(release.beforeTime,release.afterTime,'Release must not advance/reset simulation');assert.equal(release.beforeTime,boundary.simulationTime,'Prepared clock must remain paused through record start/baseline');
 const count=row.phase==='engage'?LIMITS.engageSamples:LIMITS.moveAttackSamples;assert.ok(Array.isArray(samples));assert.equal(samples.length,count,'Original observation sample count retained');
 const distinct=new Map();let previous={...boundary,at:release.at};
 for(const raw of samples){
  assertRawEnvelope(row,proof,raw);assert.equal(raw.timeOrigin,boundary.timeOrigin);assert.ok(raw.at>previous.at&&raw.simulationTime>=previous.simulationTime,'Raw native/simulation clock regressed or froze');
  for(const paint of raw.renders){
   assert.ok(id(paint.renderSequence));if(paint.renderSequence<=boundary.renderSequence)continue; // Preserve old raw rows; never count them as capture evidence.
   assertPaint(row,proof,raw,paint,boundary.simulationTime);
   const old=distinct.get(paint.renderSequence);if(old)assert.deepEqual(paint,old,'A renderSequence was rebound to different paint evidence');else distinct.set(paint.renderSequence,paint);
  }
  previous=raw;
 }
 assert.ok(previous.at-boundary.at>=1000);assert.ok(previous.simulationTime-boundary.simulationTime>=.5);assert.ok(distinct.size>=5,'Repeated/stale receipts cannot substitute five actual new paints');
 return{schema:'v177-native-shard-postpaint-check/v1',caseId:row.caseId,distinctNewPaints:distinct.size,postpaintValidated:true,ownerEvidenceAccepted:false,motionDamageAccepted:false,encodedTimelineAccepted:false,naturalnessAccepted:false,originalSpeedAccepted:false,physicalSavedAudioAccepted:false,wholeGameAccepted:false,remaining:['Actual owner adapter must validate source birth/activation/pair/legacy and damage ownership','Existing strict movement/attack/engagement, HP/damage/performance, actual clip/deadline/cleanup checks remain required','Native original bytes/PTS and human original-speed viewing remain separate']};
}
// No real media, rendering, clock setter or runtime launch is present in this module.

// Newall48 setup only. Parent must preload exactassets first; these callbacks are
// synchronous, so no simulation task runs between ordinary bridge and pause.
// Old45 readiness/prepare/capture is unchanged. No real call is made by this draft.
export function prepareOrdinaryShardPaused({form,phase}){
 if(['turned','mayo-chan-feral','futago','futago-separated-a','futago-separated-b'].includes(form))throw Error('Special owner adapter required');
 if(!['move','attack','engage'].includes(phase))throw Error('Unknown phase');
 const qa=window.__ASHFALL_BATTLE_QA__,proof=qa.prepareV177ContinuousActorProof({form,phase});
 qa.setEnemyVfxProofPaused(true);const snapshot=qa.getSnapshot();
 if(snapshot.paused!==true)throw Error('Prepared actor did not pause');
 return{proof,preparedSimulationTime:snapshot.time,scope:'Paused setup only, no movement or cold/performance acceptance'};
}
export function releasePreparedShardClock(){
 const qa=window.__ASHFALL_BATTLE_QA__,before=qa.getSnapshot();if(before.paused!==true)throw Error('Prepared clock was not paused');
 qa.setEnemyVfxProofPaused(false);const after=qa.getSnapshot();if(after.paused!==false||after.time!==before.time)throw Error('Release changed original simulation clock');
 return{at:performance.now(),timeOrigin:performance.timeOrigin,beforePaused:before.paused,afterPaused:after.paused,beforeTime:before.time,afterTime:after.time};
}
