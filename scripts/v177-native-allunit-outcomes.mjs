import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {planShard,LIMITS} from './v177-native-allunit-manifest.mjs';
import {prepareCase,hasPreparedAllUnitPaint,finishMayoPointer} from './v177-native-allunit-cases.mjs';
import {createNativeAllUnitRealmOwner,readNativeAllUnitRealmOwner,releasePreparedShardClock,
  assertShardProof,assertNativeRealmMember} from './v177-native-allunit-contract.mjs';
import {beginV177NativeCanvasClip} from './v177-native-canvas-clips.mjs';
import {startNativeGameRafObservation,stopNativeGameRafObservation,nativeGamePerformanceReceipt} from './v177-native-game-capture-browser.mjs';
import {assertJointCorpsePaint} from './v177-reaction-render-contract.mjs';
import {V177_CORPSE_JOINT_DATA} from '../app/v177CorpseJointData.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
import {renderedSourcePixelScale} from './v102-render-source-scale.mjs';

export function planOutcomeShard(shardId){
  return planShard(shardId).filter(row=>row.phase==='engage').map(reference=>({
    ...reference,caseId:reference.caseId.replace(':engage:',':controlled-outcome:'),phase:'controlled-outcome',
    referenceCaseId:reference.caseId,reference:{...reference},
  }));
}

export function readNativeOutcomeSample(realmOwner,{fighterId,afterSequence=0,sampleAt,performanceBoundary=false}){
  realmOwner.check({window,document,performance,canvas:document.querySelector('.game-shell canvas')});
  if(sampleAt!==undefined&&performance.now()<sampleAt)return new Promise((resolve,reject)=>{
    setTimeout(()=>{try{resolve(readNativeOutcomeSample(realmOwner,{fighterId,afterSequence,sampleAt,performanceBoundary}));}catch(error){reject(error);}},sampleAt-performance.now());
  });
  const realm=realmOwner.member({window,document,performance,canvas:document.querySelector('.game-shell canvas')},'sample');
  const qa=window.__ASHFALL_BATTLE_QA__,snapshot=qa.getSnapshot(),audit=qa.getEnemyFacingRuntimeAudit(fighterId),combat=qa.getPhaseGCombatSnapshot();
  const boundary=performanceBoundary?(()=>{
    const canvas=document.querySelector('.game-shell canvas'),r=canvas.getBoundingClientRect();
    return {runtimePerformance:qa.getPerformanceSnapshot(),geometry:{viewport:{width:innerWidth,height:innerHeight},devicePixelRatio,
      canvas:{width:canvas.width,height:canvas.height,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}}};
  })():{};
  return {realm,at:performance.now(),timeOrigin:performance.timeOrigin,simulationTime:snapshot.time,
    route:location.pathname,visible:document.visibilityState==='visible',running:snapshot.running,paused:snapshot.paused,battleGeneration:combat.battleGeneration,
    body:{fighter:audit.fighter,corpse:audit.corpse,renderHistory:audit.renderHistory.filter(r=>r.renderSequence>afterSequence),
      corpseRenderHistory:audit.corpseRenderHistory.filter(r=>r.renderSequence>afterSequence)},
    effects:{impacts:combat.combatGore.impacts.filter(r=>r.targetId===fighterId),wounds:combat.combatGore.wounds.filter(r=>r.targetId===fighterId),
      pools:combat.combatGore.pools.filter(r=>r.targetId===fighterId)},
    receipts:combat.manualAbilityReceipts.filter(r=>r.ownerId===fighterId),...boundary};
}

const draws=row=>row.samples.flatMap(s=>[...s.body.renderHistory,...s.body.corpseRenderHistory]);
export function nativeOutcomeComplete(row){
  const last=row.samples.at(-1);if(!last)return false;
  if(row.outcome.outcome==='retreat')return !last.body.fighter&&!last.body.corpse
    &&last.receipts.some(r=>r.eventType==='retreat-complete');
  const dead=draws(row).filter(r=>r.requestedState==='death');
  return Boolean(last.body.corpse&&dead.slice(-3).length===3&&dead.slice(-3).every(r=>r.fallProgress===1)
    &&dead.some(r=>r.fallProgress>0&&r.fallProgress<1));
}

export function assertNativeOutcome(row,bytes){
  const {nativeClip:clip,proof,outcome}=row;
  assert.equal(outcome.schema,'v177-controlled-outcome/v1');assert.equal(outcome.form,row.form);
  assert.equal(outcome.fighterId,proof.fighterId);assert.equal(outcome.targetId,proof.targetId);
  assert.equal(outcome.battleGeneration,proof.battleGeneration);assert.equal(outcome.controlledIncomingDamage,true);
  assert.equal(outcome.manualClockAdvance,false);assert.ok(outcome.hpBefore>0);
  assert.equal(outcome.incomingHit.sourceId,proof.targetId);assert.equal(outcome.incomingHit.targetId,proof.fighterId);
  assert.equal(outcome.incomingHit.damage,outcome.maxHp*100+1);assert.equal(outcome.incomingHit.remainingSeconds,.08);
  assert.equal(clip.status,'recorded');assert.equal(clip.engine,row.engine);assert.equal(clip.originalSpeedAccepted,false);
  assert.equal(clip.encodedPtsVerified,false);assert.equal(clip.requestedMimeType,'video/webm;codecs=vp8');
  assert.ok(clip.bytes>0&&clip.bytes<=LIMITS.clipBytes);assert.equal(bytes.length,clip.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),clip.sha256);
  assert.deepEqual(clip.metadata,row.recordingMetadata);assert.equal(clip.timeOrigin,row.recordingStart.timeOrigin);
  assert.equal(clip.startedAt,row.recordingStart.startedAt);assert.ok(clip.startedAt<=row.captureStart.at);
  assert.equal(row.captureStart.paused,true);assert.equal(row.captureStart.body.fighter.hp,outcome.hpBefore);
  const initialPaint=row.captureStart.body.renderHistory.at(-1);
  assert.equal(initialPaint?.renderKind,row.form);assert.equal(initialPaint.assetReady,true);
  assert.equal(initialPaint.jointDrawSucceeded,true,'The original living body must actually paint before damage');
  assert.equal(initialPaint.jointAtlasPath,V177_JOINT_ATLASES[row.form].path);
  assert.equal(row.release.beforeTime,row.release.afterTime);assert.equal(row.release.beforePaused,true);assert.equal(row.release.afterPaused,false);
  assert.ok(row.captureStart.at<=row.release.at&&row.release.at<=row.samples[0].at);
  let prior=row.realmOwner;
  const realm=(actual,member)=>{assertNativeRealmMember(row.realmOwner,actual,member,prior);prior=actual;};
  realm(row.sourceRaf.realm.started,'raf-start');realm(clip.realm.created,'recorder-create');realm(row.recordingStart.realm,'recorder-start');
  assert.deepEqual(clip.realm.started,row.recordingStart.realm);realm(row.captureStart.realm,'sample');realm(row.release.realm,'release');
  let previous=row.captureStart;
  for(const s of [row.captureStart,...row.samples,row.captureEnd]){
    assert.equal(s.battleGeneration,proof.battleGeneration,'Original battle owner changed during outcome capture');
    assert.equal(s.timeOrigin,row.recordingStart.timeOrigin);assert.equal(s.visible,true);assert.equal(s.running,true);assert.equal(s.route,proof.route);
  }
  for(const s of row.samples){
    realm(s.realm,'sample');assert.equal(s.timeOrigin,row.captureStart.timeOrigin);assert.equal(s.visible,true);
    assert.equal(s.running,true);assert.equal(s.paused,false);assert.equal(s.route,proof.route);
    assert.ok(s.at>previous.at&&s.simulationTime>=previous.simulationTime);previous=s;
    if(s.body.fighter){
      assert.equal(s.body.fighter.id,proof.fighterId);assert.equal(s.body.fighter.renderKind,row.form);
      for(const key of ['speed','laneSpeed','damage','range','attackEvery','maxHp'])
        assert.equal(s.body.fighter[key],proof.originalActorStats[key],'Original actor stat changed: '+key);
    }
  }
  realm(clip.realm.finished,'recorder-finish');realm(row.sourceRaf.realm.stopped,'raf-stop');realm(row.captureEnd.realm,'sample');
  assert.equal(row.sourceRaf.realm.failure,null);assert.equal(row.sourceRaf.overflow,false);
  assert.equal(row.captureEnd.paused,false);assert.ok(row.captureEnd.at>=row.samples.at(-1).at);
  assert.ok(row.samples.at(-1).at<=clip.stopRequestedAt);assert.ok(nativeOutcomeComplete(row),'Continuous recording must reach its actual outcome');
  const fresh=draws(row).filter(r=>r.renderSequence>row.sequenceBaseline);
  assert.ok(fresh.length>=3);assert.equal(new Set(fresh.map(r=>r.renderSequence)).size,fresh.length);
  for(const r of fresh){assert.equal(r.renderKind,row.form);assert.equal(r.assetReady,true);}
  const last=row.samples.at(-1);
  if(outcome.outcome==='retreat'){
    for(const state of ['death','hit','retreat'])assert.ok(fresh.some(r=>r.requestedState===state),'Missing actual protected retreat phase '+state);
    assert.equal(last.body.fighter,null);assert.equal(last.body.corpse,null);
    const run=fresh.filter(r=>r.requestedState==='retreat');
    assert.ok(run.length>=2&&new Set(run.map(r=>r.x)).size>1,'Retreat must actually move');
    assert.ok(run.at(-1).x<row.captureStart.body.fighter.x-20,'Retreat must travel toward the vehicle');
    for(const s of row.samples)for(const key of ['impacts','wounds','pools'])assert.equal(s.effects[key].length,0,'Mayo must retain its protected nonlethal owner');
    assert.equal(last.receipts.filter(r=>r.eventType==='retreat-complete').length,1);
  }else{
    assert.equal(last.body.fighter,null);assert.equal(last.body.corpse.id,proof.fighterId);
    const wound=row.samples.flatMap(s=>s.effects.wounds).find(r=>r.lethal);
    assert.ok(wound,'Actual damage pipeline must produce the lethal wound');
    const dead=fresh.filter(r=>r.requestedState==='death'),lastLive=fresh.filter(r=>r.requestedState!=='death').at(-1)??initialPaint;
    const jointOwner=Boolean(V177_CORPSE_JOINT_DATA[row.form]&&lastLive.jointAtlasPath===V177_JOINT_ATLASES[row.form].path);
    const pixelScale=renderedSourcePixelScale(lastLive);
    for(const r of dead){
      assert.equal(Boolean(r.corpseJointPose),jointOwner,'Original painted joint owner must survive defeat');
      assert.ok(Math.abs(renderedSourcePixelScale(r)-pixelScale)<1e-8,'Defeat must retain original source-pixel scale');
      if(jointOwner)assertJointCorpsePaint(row.form,r,last.body.corpse,wound);
    }
    const settled=dead.slice(-3);
    for(const r of settled){assert.equal(r.fallProgress,1);if(jointOwner)assertJointCorpsePaint(row.form,r,last.body.corpse,wound,true);}
  }
  return {caseId:row.caseId,continuousUntilOutcome:true,originalActorStats:true,controlledIncomingDamage:true,
    naturalIncomingCombatAccepted:false,originalSpeedAccepted:false,naturalnessAccepted:false,all21Accepted:false,
    actualStates:[...new Set(fresh.map(r=>r.requestedState))],freshDraws:fresh.length,outcome:outcome.outcome};
}

export async function captureNativeOutcomeCase(page,row,{out,engine='webkit',onFailure=()=>{}}={}){
  const resources={pointer:null,realmOwner:null};let clip,observation,primary;
  const active=()=>{assert.notEqual(row.deadlineExpired,true);assert.equal(page.isClosed(),false);};
  const owned=async fn=>{active();const value=await fn();active();return value;};
  try{
    assert.equal(row.referenceCaseId,row.reference.caseId);row.engine=engine;
    row.proof=await prepareCase(page,row.reference,owned,active,resources);assertShardProof(row.reference,row.proof);
    await owned(()=>page.waitForFunction(hasPreparedAllUnitPaint,row.proof,{timeout:LIMITS.readinessMs}));
    row.outcome=await owned(()=>page.evaluate(({fighterId,targetId})=>window.__ASHFALL_BATTLE_QA__.queueV177ControlledOutcome({fighterId,targetId}),row.proof));
    resources.realmOwner=await page.evaluateHandle(createNativeAllUnitRealmOwner);active();
    row.realmOwner=await owned(()=>resources.realmOwner.evaluate(readNativeAllUnitRealmOwner));
    observation=await page.evaluateHandle(startNativeGameRafObservation,{...row.proof,realmOwner:resources.realmOwner});active();
    row.recordingMetadata={form:row.form,phase:row.phase,fighterId:row.proof.fighterId,targetId:row.proof.targetId,
      preparedRenderKind:row.form,owner:row.owner,caseId:row.caseId,referenceCaseId:row.referenceCaseId,
      battleGeneration:row.proof.battleGeneration,proofId:row.proof.proofId,fixtureGroup:'controlled-incoming-outcome',diagnosticOnly:true,
      controlledIncomingDamage:true,manualClockAdvance:false,continuousUntilOutcome:true};
    clip=await beginV177NativeCanvasClip(page,row.recordingMetadata,{directory:path.join(out,row.viewport.width+'x'+row.viewport.height,'native-canvas-clips'),engine,requestedMimeType:'video/webm;codecs=vp8',realmOwner:resources.realmOwner});active();
    row.recordingStart=await owned(()=>clip.waitForStart());
    row.captureStart=await owned(()=>resources.realmOwner.evaluate(readNativeOutcomeSample,{fighterId:row.proof.fighterId,performanceBoundary:true}));
    row.sequenceBaseline=Math.max(...row.captureStart.body.renderHistory.map(r=>r.renderSequence));assert.ok(Number.isFinite(row.sequenceBaseline));
    row.release=await owned(()=>resources.realmOwner.evaluate(releasePreparedShardClock,row.proof));
    let afterSequence=row.sequenceBaseline;
    for(let i=0;i<80;i++){
      const s=await owned(()=>resources.realmOwner.evaluate(readNativeOutcomeSample,{fighterId:row.proof.fighterId,afterSequence,
        sampleAt:row.captureStart.at+(i+1)*LIMITS.sampleDelayMs,performanceBoundary:true}));row.samples.push(s);
      afterSequence=Math.max(afterSequence,...s.body.renderHistory.map(r=>r.renderSequence),...s.body.corpseRenderHistory.map(r=>r.renderSequence));
      if(nativeOutcomeComplete(row))break;
    }
    const completed=clip;clip=null;row.nativeClip=await completed.finish({completed:true});active();
    row.sourceRaf=await owned(()=>observation.evaluate(stopNativeGameRafObservation));await observation.dispose();observation=null;
    row.captureEnd=await owned(()=>resources.realmOwner.evaluate(readNativeOutcomeSample,{fighterId:row.proof.fighterId,afterSequence,performanceBoundary:true}));
    row.summary=assertNativeOutcome(row,await readFile(row.nativeClip.file));
    row.performanceReceipt=nativeGamePerformanceReceipt(row);row.status='observed-outcome-diagnostic';
  }catch(error){primary=error;row.originalFailure=String(error);onFailure(error);throw error;}
  finally{
    row.cleanupErrors=[];
    if(resources.pointer){try{await resources.pointer.evaluate(finishMayoPointer);await resources.pointer.dispose();}catch(e){row.cleanupErrors.push(String(e));}}
    if(clip)try{row.interruptedClip=await clip.finish({completed:false});}catch(e){row.cleanupErrors.push(String(e));}
    if(observation)try{row.interruptedSourceRaf=await observation.evaluate(stopNativeGameRafObservation);await observation.dispose();}catch(e){row.cleanupErrors.push(String(e));}
    try{await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(true));}catch(e){row.cleanupErrors.push(String(e));}
    if(resources.realmOwner)try{await resources.realmOwner.dispose();}catch(e){row.cleanupErrors.push(String(e));}
    if(!primary&&row.cleanupErrors.length)throw Error(row.cleanupErrors.join('; '));
  }
}
