import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {ALLY_DEATH_CONFIG} from '../app/combatLifecycle.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';

export function readNativeTurnedGetupSample({afterSequence=0,performanceBoundary=false}={}) {
  const qa=window.__ASHFALL_BATTLE_QA__,state=qa.getV177TurnedGetupProof({afterSequence});
  const boundary=performanceBoundary?(()=>{
    const canvas=document.querySelector('.game-shell canvas'),rect=canvas.getBoundingClientRect();
    return {runtimePerformance:qa.getPerformanceSnapshot(),geometry:{viewport:{width:innerWidth,height:innerHeight},
      devicePixelRatio,canvas:{width:canvas.width,height:canvas.height,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}}}};
  })():{};
  return {...state,at:performance.now(),simulationTime:state.time,visible:document.visibilityState==='visible',route:location.pathname,...boundary};
}

export function startNativeTurnedGetupRafObservation() {
  const state={timeOrigin:performance.timeOrigin,startedAt:performance.now(),rows:[],overflow:false,stopped:false,raf:null};
  const observe=()=>{
    if(state.stopped)return;
    const proof=window.__ASHFALL_BATTLE_QA__.getV177TurnedGetupProof({light:true});
    if(state.rows.length<4096)state.rows.push({at:performance.now(),actorId:proof.actorId,
      renderSequence:proof.fighterRenderSequence??proof.corpseRenderSequence,renderKind:proof.actorId===null?'brawler':'turned'});
    else state.overflow=true;
    state.raf=requestAnimationFrame(observe);
  };
  state.raf=requestAnimationFrame(observe);return state;
}

function observedDraws(row) {
  return [...new Map([row.captureStart,...row.samples].flatMap(s=>s.draws??[]).map(d=>[d.renderSequence,d])).values()]
    .sort((a,b)=>a.renderSequence-b.renderSequence);
}
export function nativeTurnedGetupReady(row) {
  const draws=observedDraws(row),rise=draws.findLast(d=>d.jointGetupDrawSucceeded);
  return Boolean(rise&&draws.filter(d=>d.renderSequence>rise.renderSequence&&d.jointDrawSucceeded
    &&d.jointGetupProgress===null&&['idle','move','start-move','stop-move','turn'].includes(d.requestedState)).length>=3);
}

export function assertNativeTurnedGetup(row) {
  const proof=row.proof,samples=[row.captureStart,...row.samples],first=samples[0],last=samples.at(-1),birth=last.actualBirth;
  assert.equal(row.form,'turned');assert.equal(row.phase,'turned-getup');assert.equal(proof.variant,row.variant);
  assert.equal(proof.preparedFixture,true);assert.equal(proof.preparedCorpseAgeSeconds,7.2);
  for(const flag of ['manualBirth','injectedSpawnGrace','manualClockAdvance'])assert.equal(proof[flag],false);
  assert.deepEqual(proof.initialFighterIds,[]);assert.equal(first.paused,true);assert.equal(first.actorId,null);
  assert.equal(first.corpse?.id,proof.corpseId);assert.equal(first.actualBirth,null);
  assert.equal(row.recordingStart.timeOrigin,row.nativeClip.timeOrigin);assert.equal(row.recordingStart.startedAt,row.nativeClip.startedAt);
  assert.ok(row.nativeClip.startedAt<=first.at&&first.at<=row.releasedAtNative&&row.releasedAtNative<=last.at);
  assert.ok(row.nativeClip.stopRequestedAt>=last.at);assert.equal(row.release.receipt.releasedAt,proof.preparedAt);
  for(const [key,value]of Object.entries({form:'turned',requestedKind:'turned',preparedRenderKind:'turned',
    phase:'turned-getup',fixtureGroup:'actual-infection-getup',fighterId:null,corpseId:proof.corpseId,
    variant:row.variant,proofId:proof.proofId,battleGeneration:proof.battleGeneration,diagnosticOnly:true}))
    assert.equal(row.nativeClip.metadata[key],value,'Original pre-birth clip binding: '+key);
  assert.ok(birth&&birth.actorId!==proof.corpseId&&!proof.initialFighterIds.includes(birth.actorId));
  assert.equal(birth.corpseId,proof.corpseId);assert.equal(birth.variant,proof.expectedVariant);
  assert.equal(birth.variantBasis,'source-bound-fall');assert.equal(birth.source?.sourceBound,true);
  assert.equal(birth.source.recordedAfterPaint,true);assert.ok(Number.isFinite(birth.source.paintedFloorY));
  assert.ok(birth.source.at>=first.simulationTime&&birth.source.at<=birth.bornAt);
  assert.ok(Math.abs(birth.source.paintedFloorY-birth.floorY)<1e-7);
  const lock=ALLY_DEATH_CONFIG.riseLockSeconds;
  assert.ok(birth.initialRemaining>0&&birth.initialRemaining<=lock);
  assert.ok(Math.abs(birth.initialRemaining+birth.bornAt-proof.preparedAt-proof.preparedCorpse.infectionRemaining-lock)<1e-8);
  for(const [i,s]of samples.entries()) {
    assert.equal(s.proofId,proof.proofId);assert.equal(s.battleGeneration,proof.battleGeneration);
    assert.equal(s.overflow,false);assert.equal(s.running,true);assert.equal(s.over,false);assert.equal(s.visible,true);
    if(i){assert.equal(s.paused,false);assert.equal(s.released,true);assert.ok(s.at>samples[i-1].at);assert.ok(s.time>=samples[i-1].time);}
    if(s.actorId!==null) {
      assert.equal(s.actorId,birth.actorId);assert.equal(s.fighter?.id,birth.actorId);
      assert.equal(s.fighter.kind,'turned');assert.equal(s.fighter.side,'zombie');assert.ok(s.fighter.hp>0);
      assert.equal(s.corpse,null);assert.equal(s.fighter.flash,0);assert.equal(s.fighter.stunned,0);
      assert.ok(Math.abs(s.fighter.spawnGrace-Math.max(0,birth.initialRemaining-(s.time-birth.bornAt)))<1e-8);
    }
  }
  const draws=observedDraws(row),rise=draws.filter(d=>d.jointGetupDrawSucceeded),atlas=V177_JOINT_ATLASES.turned;
  assert.ok(rise.length>=3);assert.ok(Math.min(...rise.map(d=>d.jointGetupProgress))<.25);
  assert.ok(Math.max(...rise.map(d=>d.jointGetupProgress))>.8);
  for(const draw of draws) {
    assert.equal(draw.renderKind,'turned');assert.equal(draw.jointAtlasPath,atlas.path);assert.equal(draw.jointDrawSucceeded,true);
    assert.ok(Number.isFinite(draw.jointPaintedAt)&&draw.jointPaintedAt>=first.simulationTime&&draw.jointPaintedAt<=last.time);
    if(draw.jointGetupProgress===null)assert.ok(draw.jointPaintedAt>=birth.bornAt+birth.initialRemaining-1e-8,
      'Ordinary movement cannot replace the still-locked original rise');
  }
  for(const draw of rise) {
    assert.equal(draw.jointGetupCorpseId,proof.corpseId);assert.equal(draw.jointGetupVariant,proof.expectedVariant);
    assert.equal(draw.jointGetupSourcePaintBound,true);assert.equal(draw.jointGetupReactionAmplitude,0);
    assert.equal(draw.jointGetupPaintedAt,draw.jointPaintedAt);
    const expected=1-Math.max(0,birth.initialRemaining-(draw.jointGetupPaintedAt-birth.bornAt))/lock;
    assert.ok(Math.abs(draw.jointGetupProgress-expected)<1e-8);
    for(const part of atlas.parts) {
      const m=draw.jointGetupPaintedPose?.[part.upper?'upper':'lower']?.[part.bone];
      assert.ok(m?.length===6&&m.every(Number.isFinite),'Every original source part must actually paint');
    }
  }
  assert.ok(nativeTurnedGetupReady(row));assert.equal(last.fighter.spawnGrace,0);
  const initialActor=samples.find(s=>s.actorId===birth.actorId)?.fighter;assert.ok(last.fighter.x<initialActor.x);
  assert.ok(draws.some(d=>d.jointGetupProgress===null&&d.actualXDelta<0));
  return {corpseId:proof.corpseId,actualActorId:birth.actorId,variant:birth.variant,actualBirth:birth,
    successfulRiseDraws:rise.length,successfulJointDraws:draws.length,originalRiseClock:lock,
    scope:'Explicit pre-aged human corpse, original infection/new ID/rise and ordinary movement; not campaign, native PTS or naturalness acceptance',
    originalSpeedAccepted:false,naturalnessAccepted:false,physicalIphoneRecordingAccepted:false,wholeGameAccepted:false};
}

export async function captureNativeTurnedGetupCase(page,row,deps) {
  let clip,observation,originalFailure;
  try {
    row.proof=await page.evaluate(variant=>window.__ASHFALL_BATTLE_QA__.prepareV177TurnedGetupProof({variant}),row.variant);
    await page.waitForFunction(()=>Number.isFinite(window.__ASHFALL_BATTLE_QA__.getV177TurnedGetupProof({light:true}).corpseRenderSequence),undefined,{timeout:5000});
    observation=await page.evaluateHandle(startNativeTurnedGetupRafObservation);
    clip=await deps.beginV177NativeCanvasClip(page,{form:'turned',requestedKind:'turned',preparedRenderKind:'turned',phase:'turned-getup',
      fixtureGroup:'actual-infection-getup',fighterId:null,corpseId:row.proof.corpseId,variant:row.variant,
      proofId:row.proof.proofId,battleGeneration:row.proof.battleGeneration,diagnosticOnly:true},
    {directory:path.join(deps.out,`${row.viewport.width}x${row.viewport.height}`,'native-canvas-clips'),engine:'webkit',requestedMimeType:deps.mimeType});
    row.recordingStart=await clip.waitForStart();row.captureStart=await page.evaluate(readNativeTurnedGetupSample,{performanceBoundary:true});
    row.release=await page.evaluate(proofId=>({receipt:window.__ASHFALL_BATTLE_QA__.releaseV177TurnedGetupProof(proofId),at:performance.now()}),row.proof.proofId);
    row.releasedAtNative=row.release.at;let afterSequence=Math.max(0,...row.captureStart.corpseDraws.map(d=>d.renderSequence));
    for(let i=0;i<85;i++) {
      await page.waitForTimeout(100);const sample=await page.evaluate(readNativeTurnedGetupSample,{afterSequence});row.samples.push(sample);
      afterSequence=Math.max(afterSequence,...sample.corpseDraws.map(d=>d.renderSequence),...sample.draws.map(d=>d.renderSequence));
      if(nativeTurnedGetupReady(row)||sample.over||i===84) {
        row.samples.push(await page.evaluate(readNativeTurnedGetupSample,{afterSequence,performanceBoundary:true}));break;
      }
    }
    const completed=clip;clip=null;row.nativeClip=await completed.finish({completed:true});
    row.sourceRaf=await observation.evaluate(deps.stopNativeGameRafObservation);await observation.dispose();observation=null;
    assert.equal(row.nativeClip.status,'recorded');assert.equal(row.nativeClip.engine,'webkit');assert.equal(row.nativeClip.requestedMimeType,deps.mimeType);
    assert.match(row.nativeClip.mimeType,/^video\/webm/u);assert.equal(row.nativeClip.originalSpeedAccepted,false);assert.equal(row.nativeClip.encodedPtsVerified,false);
    assert.ok(Number.isSafeInteger(row.nativeClip.bytes)&&row.nativeClip.bytes>0&&row.nativeClip.bytes<=8*1024*1024);
    const bytes=await(deps.read??readFile)(row.nativeClip.file);assert.equal(bytes.length,row.nativeClip.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),row.nativeClip.sha256);
    assert.equal(row.sourceRaf.timeOrigin,row.nativeClip.timeOrigin);assert.equal(row.sourceRaf.overflow,false);assert.ok(row.sourceRaf.rows.length>=3);
    row.summary=assertNativeTurnedGetup(row);row.performanceReceipt=deps.nativeGamePerformanceReceipt(row);
    assert.notEqual(row.deadlineExpired,true);row.status='observed-diagnostic';
  }catch(error){originalFailure=error;row.originalFailure=String(error);deps.onFailure?.(error);throw error;}
  finally {
    row.cleanupErrors=[];
    if(clip)try{row.interruptedClip=await clip.finish({completed:false});}catch(error){row.cleanupErrors.push(String(error));}
    if(observation) {
      try{row.interruptedSourceRaf=await observation.evaluate(deps.stopNativeGameRafObservation);}catch(error){row.cleanupErrors.push(String(error));}
      try{await observation.dispose();}catch(error){row.cleanupErrors.push(String(error));}
    }
    try{await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(true));}catch(error){row.cleanupErrors.push(String(error));}
    if(!originalFailure&&row.cleanupErrors.length)throw Error(row.cleanupErrors.join('; '));
  }
}
