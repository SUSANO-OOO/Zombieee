import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {v177IncomingStunStats} from '../app/v177IncomingStunProof.js';

const readyStates=new Set(['idle','move','start-move','stop-move','turn']);
export function readNativeIncomingStunSample({fighterId,targetId,afterSequence=0,performanceBoundary=false}) {
  const qa=window.__ASHFALL_BATTLE_QA__,snapshot=qa.getSnapshot(),observed=qa.getV177IncomingStunProof(afterSequence);
  const select=id=>{
    const f=snapshot.fighters.find(row=>row.id===id);
    if(!f)return null;
    const keys=['id','kind','side','x','y','knock','hp','maxHp','speed','laneSpeed','damage','range','attackEvery','bodyRadius',
      'defense','progressionLevel','progressionRank','flash','stunned','attack','attackWindup','abilityWindup',
      'cooldown','abilityCooldown','spawnGrace','stationAbility'];
    return Object.fromEntries(keys.map(key=>[key,f[key]??null]));
  };
  const boundary=performanceBoundary?(()=>{
    const canvas=document.querySelector('.game-shell canvas'),rect=canvas.getBoundingClientRect();
    return {runtimePerformance:qa.getPerformanceSnapshot(),geometry:{viewport:{width:window.innerWidth,height:window.innerHeight},
      devicePixelRatio:window.devicePixelRatio,canvas:{width:canvas.width,height:canvas.height,
        rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}}}};
  })():{};
  return {at:performance.now(),simulationTime:snapshot.time,running:snapshot.running,paused:snapshot.paused,
    route:location.pathname,visible:document.visibilityState==='visible',fighter:select(fighterId),target:select(targetId),
    proofId:observed?.proof.proofId??null,battleGeneration:observed?.proof.battleGeneration??null,
    released:observed?.released??false,overflow:observed?.overflow??false,
    impacts:observed?.impacts??[],draws:observed?.draws??[],...boundary};
}

export function nativeIncomingStunReady(row) {
  const samples=[row.captureStart,...row.samples];
  const draws=[...new Map(samples.flatMap(s=>s?.draws??[]).map(draw=>[draw.renderSequence,draw])).values()]
    .sort((a,b)=>a.renderSequence-b.renderSequence);
  const lastStun=draws.findLast(draw=>draw.jointDrawSucceeded&&draw.liveStun);
  return Boolean(lastStun&&draws.filter(draw=>draw.renderSequence>lastStun.renderSequence&&draw.jointDrawSucceeded
    &&draw.stunned===0&&!draw.liveStun&&readyStates.has(draw.requestedState)).length>=3);
}

export function assertNativeIncomingStun(row) {
  const proof=row.proof,samples=[row.captureStart,...row.samples],first=samples[0],last=samples.at(-1);
  assert.equal(row.form,'ranger');assert.equal(row.phase,'incoming-stun');assert.equal(proof.phase,row.phase);
  for(const[key,value]of Object.entries({proofId:proof.proofId,battleGeneration:proof.battleGeneration,
    fighterId:proof.fighterId,form:'ranger',phase:'incoming-stun',fixtureGroup:'natural-incoming-stun',
    controlledOpponent:false,originalStats:true}))assert.equal(row.nativeClip.metadata?.[key],value,'Original clip binding: '+key);
  for(const flag of ['originalStats'])assert.equal(proof[flag],true);
  for(const flag of ['inertOpponent','injectedHit','injectedStun','manualClockAdvance'])assert.equal(proof[flag],false);
  assert.ok(Math.abs(proof.original.sourceCooldown-1.26)<1e-10);
  assert.equal(proof.original.sourceAbilityCooldown,2.1);
  assert.equal(first.paused,true,'Original native recording begins before releasing the original combat clock');
  assert.equal(first.fighter.hp,proof.original.actorHp);assert.equal(first.target.hp,proof.original.sourceHp);
  assert.equal(first.fighter.cooldown,proof.original.actorCooldown);assert.equal(first.target.cooldown,proof.original.sourceCooldown);
  assert.equal(first.target.abilityCooldown,proof.original.sourceAbilityCooldown);
  assert.ok(row.recordingStart.startedAt<=first.at&&first.at<=row.releasedAtNative&&row.releasedAtNative<=last.at);
  assert.equal(row.recordingStart.timeOrigin,row.nativeClip.timeOrigin);
  assert.equal(row.recordingStart.startedAt,row.nativeClip.startedAt);
  assert.ok(row.nativeClip.stopRequestedAt>=last.at);
  assert.equal(row.release.receipt.releasedAt,first.simulationTime);
  const uniqueDraws=new Map();
  for(const [i,sample]of samples.entries()){
    assert.equal(sample.proofId,proof.proofId);assert.equal(sample.battleGeneration,proof.battleGeneration);
    assert.equal(sample.overflow,false);assert.equal(sample.running,true);assert.equal(sample.visible,true);
    if(i){assert.equal(sample.paused,false);assert.equal(sample.released,true);assert.ok(sample.at>samples[i-1].at);
      assert.ok(sample.simulationTime>=samples[i-1].simulationTime);}
    assert.equal(sample.fighter?.id,proof.fighterId);assert.equal(sample.target?.id,proof.targetId);
    assert.equal(sample.fighter.kind,'ranger');assert.equal(sample.target.kind,'spindle');
    assert.ok(sample.fighter.hp>0&&sample.target.hp>0,'Both original actors must remain alive throughout the recorded proof');
    assert.ok(sample.fighter.hp<=proof.original.actorHp&&sample.target.hp<=proof.original.sourceHp,
      'Neither original actor may acquire a durable or healed fixture HP reserve');
    assert.deepEqual(v177IncomingStunStats(sample.fighter),proof.original.actor);
    assert.deepEqual(v177IncomingStunStats(sample.target),proof.original.source);
    for(const draw of sample.draws){
      assert.equal(draw.proofId,proof.proofId);assert.equal(draw.battleGeneration,proof.battleGeneration);
      assert.equal(draw.renderKind,'ranger');assert.equal(draw.jointAtlasPath,'/art/v100/joints/ranger-r3.webp');
      assert.equal(draw.jointDrawSucceeded,true,'A pre-draw state label or sprite fallback is insufficient');
      assert.equal(draw.jointWeightedLowerDrawSucceeded,true,'Continuous weighted lower must actually be painted');
      assert.equal(draw.jointWeightedLower?.mode,'continuous-weighted-mesh');
      assert.ok(draw.hp>0&&Number.isFinite(draw.at)&&draw.at>=first.simulationTime&&draw.at<=sample.simulationTime
        &&Number.isSafeInteger(draw.renderSequence));
      if(uniqueDraws.has(draw.renderSequence))assert.deepEqual(uniqueDraws.get(draw.renderSequence),draw);
      else uniqueDraws.set(draw.renderSequence,draw);
    }
  }
  const draws=[...uniqueDraws.values()].sort((a,b)=>a.renderSequence-b.renderSequence);
  const impacts=last.impacts;
  for(const impact of impacts){
    assert.equal(impact.proofId,proof.proofId);assert.equal(impact.battleGeneration,proof.battleGeneration);
    assert.equal(impact.sourceId,proof.targetId);assert.equal(impact.targetId,proof.fighterId);
    assert.equal(impact.sourceKind,'spindle');assert.equal(impact.targetKind,'ranger');
    assert.ok(impact.at>first.simulationTime&&impact.at<=last.simulationTime&&impact.damage>0);
    assert.ok(Math.abs(impact.hpBefore-impact.hpAfter-impact.damage)<1e-8&&impact.hpAfter>0);
  }
  const hit=impacts.find(impact=>impact.kind==='normal-hit'),landing=impacts.find(impact=>impact.kind==='coil-vault');
  assert.ok(hit&&landing&&hit.at<landing.at,'A real normal hit must precede the real coil-vault activation');
  assert.ok(hit.flash>0&&Number.isSafeInteger(hit.attackSequence)&&hit.attackSequence>0);
  assert.equal(landing.sourceAbilityPhase,'active');assert.ok(landing.distance<=58&&landing.stunned>=.42);
  assert.ok(landing.abilityTargetIds.map(String).includes(String(proof.fighterId)));
  assert.ok(samples.some(s=>s.simulationTime>hit.at&&s.simulationTime<landing.at&&s.target.stationAbility?.phase==='warning'));
  const flashed=draws.find(d=>d.at>=hit.at&&d.at<landing.at&&d.flash>0);
  assert.ok(flashed,'The actual normal-hit flash must be painted inside this recorded window');
  assert.ok(draws.some(d=>d.renderSequence>flashed.renderSequence&&d.at<landing.at&&d.flash===0));
  const late=draws.filter(d=>d.at>=landing.at&&d.liveStun&&d.flash===0&&d.stunned>.12);
  assert.ok(late.length>=3,'Late living stun requires several actual successful joint draws');
  for(const draw of late){
    assert.equal(draw.requestedState,'incapacitated');assert.equal(draw.attack,0);assert.equal(draw.attackWindup,0);
    assert.equal(draw.abilityWindup,0);assert.notEqual(draw.manualAbilityPhase,'active');
    assert.ok(draw.stunRemaining>0&&Number.isFinite(draw.stunElapsed));
    assert.ok(Number.isSafeInteger(draw.lowerIndex)&&draw.lowerIndex>=0&&draw.lowerIndex<120);
    assert.equal(Object.keys(draw.upperPose??{}).length,7);
    for(const matrix of Object.values(draw.upperPose))assert.ok(matrix.length===6&&matrix.every(Number.isFinite));
  }
  assert.ok(nativeIncomingStunReady(row),'The original hybrid ready pose must return alive after the observed stun');
  assert.ok(Math.abs(first.fighter.hp-last.fighter.hp-impacts.reduce((sum,r)=>sum+r.damage,0))<1e-8);
  return {proofId:proof.proofId,battleGeneration:proof.battleGeneration,sourceId:proof.targetId,targetId:proof.fighterId,
    normalHit:hit,coilVault:landing,observedSuccessfulDraws:draws.length,lateStunDraws:late.length,
    appliedDamage:first.fighter.hp-last.fighter.hp,aliveReadyReturn:true,
    scope:'Original Ranger and Spindle combat, actual incoming impacts and successful joint draws; limited diagnostic only',
    originalSpeedAccepted:false,naturalnessAccepted:false,physicalIphoneRecordingAccepted:false,wholeGameAccepted:false};
}

export async function captureNativeIncomingStunCase(page,row,deps) {
  let clip,observation,originalFailure;
  try{
    row.proof=await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.prepareV177IncomingStunProof());
    await page.waitForFunction(({fighterId})=>window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(fighterId)
      .renderHistory.some(draw=>draw.renderKind==='ranger'&&draw.jointAtlasPath==='/art/v100/joints/ranger-r3.webp'
        &&draw.jointWeightedLowerDrawSucceeded===true),row.proof,{timeout:5000});
    observation=await page.evaluateHandle(deps.startNativeGameRafObservation,row.proof);
    clip=await deps.beginV177NativeCanvasClip(page,{form:'ranger',requestedKind:'ranger',phase:'incoming-stun',
      fixtureGroup:'natural-incoming-stun',fighterId:row.proof.fighterId,preparedRenderKind:'ranger',
      proofId:row.proof.proofId,battleGeneration:row.proof.battleGeneration,diagnosticOnly:true,controlledOpponent:false,originalStats:true},
    {directory:path.join(deps.out,`${row.viewport.width}x${row.viewport.height}`,'native-canvas-clips'),engine:'webkit',requestedMimeType:deps.mimeType});
    row.recordingStart=await clip.waitForStart();
    row.captureStart=await page.evaluate(readNativeIncomingStunSample,{...row.proof,performanceBoundary:true});
    row.release=await page.evaluate(proofId=>({receipt:window.__ASHFALL_BATTLE_QA__.releaseV177IncomingStunProof(proofId),at:performance.now()}),row.proof.proofId);
    row.releasedAtNative=row.release.at;assert.equal(row.release.receipt.proofId,row.proof.proofId);
    let afterSequence=row.captureStart.draws.at(-1)?.renderSequence??0;
    for(let i=0;i<60;i++){
      await page.waitForTimeout(100);
      const sample=await page.evaluate(readNativeIncomingStunSample,{...row.proof,afterSequence});
      row.samples.push(sample);afterSequence=sample.draws.at(-1)?.renderSequence??afterSequence;
      if(!sample.fighter||!sample.target||sample.fighter.hp<=0||sample.target.hp<=0||nativeIncomingStunReady(row)||i===59){
        row.samples.push(await page.evaluate(readNativeIncomingStunSample,{...row.proof,afterSequence,performanceBoundary:true}));
        break;
      }
    }
    const completedClip=clip;clip=null;row.nativeClip=await completedClip.finish({completed:true});
    row.sourceRaf=await observation.evaluate(deps.stopNativeGameRafObservation);await observation.dispose();observation=null;
    assert.equal(row.nativeClip.status,'recorded');assert.equal(row.nativeClip.engine,'webkit');
    assert.equal(row.nativeClip.requestedMimeType,deps.mimeType);assert.match(row.nativeClip.mimeType,/^video\/webm/u);
    assert.ok(Number.isSafeInteger(row.nativeClip.bytes)&&row.nativeClip.bytes>0&&row.nativeClip.bytes<=8*1024*1024);
    assert.equal(row.nativeClip.originalSpeedAccepted,false);assert.equal(row.nativeClip.encodedPtsVerified,false);
    const bytes=await(deps.read??readFile)(row.nativeClip.file);
    assert.equal(bytes.length,row.nativeClip.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.nativeClip.sha256);
    assert.equal(row.sourceRaf.timeOrigin,row.nativeClip.timeOrigin);assert.equal(row.sourceRaf.overflow,false);
    assert.ok(row.sourceRaf.rows.length>=2);
    for(const[i,source]of row.sourceRaf.rows.entries()){
      assert.ok(Number.isFinite(source.at)&&Number.isFinite(source.renderSequence));assert.equal(source.renderKind,'ranger');
      if(i)assert.ok(source.at>row.sourceRaf.rows[i-1].at);
    }
    row.summary=assertNativeIncomingStun(row);row.performanceReceipt=deps.nativeGamePerformanceReceipt(row);
    assert.notEqual(row.deadlineExpired,true,'A late incoming-stun operation cannot promote its timed-out capture');
    row.status='observed-diagnostic';
  }catch(error){originalFailure=error;row.originalFailure=String(error);deps.onFailure?.(error);throw error;}
  finally{
    row.cleanupErrors=[];
    if(clip)try{row.interruptedClip=await clip.finish({completed:false});}catch(error){row.cleanupErrors.push(String(error));}
    if(observation){
      try{row.interruptedSourceRaf=await observation.evaluate(deps.stopNativeGameRafObservation);}catch(error){row.cleanupErrors.push(String(error));}
      try{await observation.dispose();}catch(error){row.cleanupErrors.push(String(error));}
    }
    try{await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(true));}catch(error){row.cleanupErrors.push(String(error));}
    if(!originalFailure&&row.cleanupErrors.length)throw Error(row.cleanupErrors.join('; '));
  }
}
