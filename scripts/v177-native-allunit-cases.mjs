import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {MANUAL_ABILITY_REGISTRY} from '../app/manualAbilities.js';
import {assertV177AuthoredLiveRender} from './v177-continuous-render-contract.mjs';
import {nativeBattleTap} from './v100-normal-tactical-input.mjs';
import {manualMarkerDispatchStarted} from './v100-phase-g-runtime-evidence.mjs';
import {beginV177NativeCanvasClip} from './v177-native-canvas-clips.mjs';
import {startNativeGameRafObservation,stopNativeGameRafObservation,
  nativeGameDamageReceipt,nativeGamePerformanceReceipt} from './v177-native-game-capture-browser.mjs';
import {LIMITS,assertPlannedCase} from './v177-native-allunit-manifest.mjs';
import {readNativeAllUnitSample,assertShardProof,postpaintCaptureBoundary,
  assertShardPostpaintContract,createNativeAllUnitRealmOwner,readNativeAllUnitRealmOwner,
  assertNativeRealmMember} from './v177-native-allunit-contract.mjs';
import {assertMayoFeralReceipt,assertFutagoPairDamageAndOwner} from './v177-native-allunit-owners.mjs';

export function hasPreparedAllUnitPaint(proof){
  const qa=window.__ASHFALL_BATTLE_QA__,s=qa?.getSnapshot(),a=qa?.getEnemyFacingRuntimeAudit(proof.fighterId);
  return document.visibilityState==='visible'&&s?.running===true&&s.paused===true
    &&a?.fighter?.id===proof.fighterId&&a.fighter.hp>0&&a.fighter.renderKind===proof.renderKind
    &&a.renderHistory.some(r=>r.renderKind===proof.renderKind&&r.jointDrawSucceeded===true
      &&r.assetReady===true&&Number.isFinite(r.jointPaintedAt)&&r.renderSequence>0);
}

// Read and prepare in ONE browser task. A separate boolean wait/evaluate lets
// the original route AI change lanes between the observation and placement.
export function prepareBornTurnedWhenReady({proofId,phase}){
  const qa=window.__ASHFALL_BATTLE_QA__,source=qa.getV177TurnedGetupProof();
  if(!source||source.proofId!==proofId||!source.released||!source.running||source.paused||source.over)
    throw Error('Original released born proof changed while awaiting preparation');
  const birth=source.actualBirth,actor=source.fighter;
  if(!birth||!actor||actor.spawnGrace!==0)return false;
  const normal=source.draws.filter(row=>row.renderKind==='turned'&&row.jointDrawSucceeded===true
    &&row.jointGetupProgress===null&&Number.isFinite(row.jointPaintedAt)
    &&row.jointPaintedAt>=birth.bornAt+birth.initialRemaining
    &&['idle','move','start-move','stop-move','turn'].includes(row.requestedState));
  if(new Set(normal.map(row=>row.renderSequence)).size<3)return false;
  if(phase==='engage'){
    const navigation=actor.navigationRecovery,lane=actor.anchorLane;
    const centers=qa.getSnapshot().geometry.laneCenters;
    if(!navigation||navigation.recoveryLane!==null||navigation.recoverySeconds!==0
      ||navigation.terminalFallbackSeconds!==0||navigation.routeReleaseRequested
      ||!Number.isInteger(lane)||lane<0||lane>2||actor.lane!==lane
      ||!Number.isFinite(centers[lane])||!Number.isFinite(actor.y)||Math.abs(actor.y-centers[lane])>2
      ||!(actor.nextLaneDecisionAt>birth.bornAt+.8)
      ||actor.targetId!==null||actor.targetObjectId!==null)return false;
  }
  return qa.prepareV177BornTurnedContinuation({proofId,phase});
}
export function observeMayoPointer(proof){
  const state={proofId:proof.proofId,proofGeneration:proof.proofGeneration,
    battleGeneration:proof.battleGeneration,events:[],allTargets:[],overflow:false};
  const record=e=>{
    const button=e.target?.closest?.('button.manual-ability-ready');
    const expected=document.querySelector?.('button.manual-ability-ready[data-fighter-id="'+proof.fighterId+'"]');
    const rect=expected?.getBoundingClientRect();
    if(state.allTargets.length<32)state.allTargets.push({type:e.type,isTrusted:e.isTrusted,
      at:performance.now(),x:e.clientX,y:e.clientY,target:e.target?.tagName,
      fighterId:button?.dataset.fighterId??null,kind:button?.dataset.abilityKind??null,
      expectedRect:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null,
      expectedAvailable:expected?.getAttribute('aria-disabled')??null,
      layout:document.documentElement?.dataset.manualAbilityLayoutDebug??null});
    else state.overflow=true;
    if(e.type==='pointermove')return;
    if(!button||Number(button.dataset.fighterId)!==proof.fighterId)return;
    if(state.events.length>=16){state.overflow=true;return;}
    state.events.push({type:e.type,isTrusted:e.isTrusted,fighterId:Number(button.dataset.fighterId),
      kind:button.dataset.abilityKind,at:performance.now()});
  };
  for(const type of ['pointermove','pointerdown','pointerup','click'])document.addEventListener(type,record,true);
  state.stop=()=>{for(const type of ['pointermove','pointerdown','pointerup','click'])document.removeEventListener(type,record,true);};
  return state;
}
export function finishMayoPointer(state){
  state.stop();return {proofId:state.proofId,proofGeneration:state.proofGeneration,
    battleGeneration:state.battleGeneration,events:state.events,allTargets:state.allTargets,overflow:state.overflow};
}

export function readMayoPointerGeometry(elements,point){
  const button=elements.length===1?elements[0]:null;
  if(!button||button.disabled||button.getAttribute('aria-disabled')!=='false')return null;
  const r=button.getBoundingClientRect(),center={x:r.x+r.width/2,y:r.y+r.height/2};
  const owns=p=>r.width>0&&r.height>0&&document.elementFromPoint(p.x,p.y)?.closest('button')===button;
  return {fighterId:Number(button.dataset.fighterId),kind:button.dataset.abilityKind,
    rect:{x:r.x,y:r.y,width:r.width,height:r.height},center,ownsPointer:owns(point),ownsCenter:owns(center),at:performance.now()};
}

// Moving an OS pointer is asynchronous. The HUD may publish another actual
// actor position before its ACK. Reposition once before the only down/up;
// reject a changed owner or another missed target instead of pressing again.
export async function confirmMayoPointer(page,button,point,proof,phases,active=()=>{}){
  const observe=async name=>{
    active();const phase={name,startedAt:Date.now(),status:'pending'};phases.push(phase);
    try{
      const state=await button.evaluateAll(readMayoPointerGeometry,point);active();phase.observation=state;
      assert.ok(state,'Mayo control disappeared before down');assert.equal(state.fighterId,proof.fighterId);
      assert.equal(state.kind,'mayo-chan');phase.status='completed';return state;
    }catch(error){phase.status='error';phase.error=String(error);throw error;}
    finally{phase.endedAt=Date.now();}
  };
  let state=await observe('confirm-after-move');
  if(!state.ownsPointer||Math.hypot(state.center.x-point.x,state.center.y-point.y)>.5){
    assert.equal(state.ownsCenter,true,'Current Mayo center is covered');point=state.center;
    const phase={name:'reposition-before-down',point,startedAt:Date.now(),status:'pending'};phases.push(phase);
    try{active();await page.mouse.move(point.x,point.y);active();phase.status='completed';}
    catch(error){phase.status='error';phase.error=String(error);throw error;}
    finally{phase.endedAt=Date.now();}
    state=await observe('confirm-after-reposition');
  }
  assert.equal(state.ownsPointer,true,'Mayo moved outside the final pointer before down');
}

export async function prepareCase(page,row,owned,active,resources){
  let proof;
  if(row.owner==='turned-birth'){
    row.birthSetup=await owned(()=>page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.prepareV177TurnedGetupProof({variant:0})));
    await owned(()=>page.waitForFunction(()=>Number.isFinite(window.__ASHFALL_BATTLE_QA__
      .getV177TurnedGetupProof({light:true}).corpseRenderSequence),undefined,{timeout:LIMITS.readinessMs}));
    row.birthRelease=await owned(()=>page.evaluate(id=>window.__ASHFALL_BATTLE_QA__.releaseV177TurnedGetupProof(id),row.birthSetup.proofId));
    // The original 4.8s infection and .75s rise run freely, without a clock setter.
    const ready=await owned(()=>page.waitForFunction(prepareBornTurnedWhenReady,
      {proofId:row.birthSetup.proofId,phase:row.phase},{timeout:8500,polling:'raf'}));
    try{proof=await owned(()=>ready.jsonValue());}finally{await ready.dispose();}
  }else if(row.owner==='futago-pair'){
    proof=await owned(()=>page.evaluate(({form,phase})=>window.__ASHFALL_BATTLE_QA__
      .prepareV177NativeFutagoPair({form,phase}),{form:row.form,phase:row.phase}));
  }else if(row.owner==='mayo-activation'){
    proof=await owned(()=>page.evaluate(phase=>window.__ASHFALL_BATTLE_QA__.prepareV177NativeMayoProof({phase}),row.phase));
    row.preparedMayoProof=proof;
    const selector='button.manual-ability-ready.available[data-ability-kind="mayo-chan"][data-fighter-id="'+proof.fighterId+'"][aria-disabled="false"]';
    const button=page.locator(selector);await owned(()=>button.waitFor({state:'visible',timeout:LIMITS.readinessMs}));
    resources.pointer=await page.evaluateHandle(observeMayoPointer,proof);active();
    const before=await owned(()=>page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.getPhaseGCombatSnapshot()));
    row.beforeMayoInput=before;
    const inputPage={mouse:Object.fromEntries(['move','down','up'].map(key=>[key,async(...args)=>{
      active();const result=await page.mouse[key](...args);active();
      if(key==='move')await confirmMayoPointer(page,button,{x:args[0],y:args[1]},proof,row.inputPhases,active);
      return result;
    }]))};
    row.inputPhases=[];
    assert.equal(await owned(()=>nativeBattleTap(inputPage,button,row.inputPhases)),true,'Original Mayo native input required');
    const after=await owned(()=>page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.getPhaseGCombatSnapshot()));
    row.afterMayoInput=after;
    assert.equal(manualMarkerDispatchStarted(before,after,proof.fighterId,'mayo-chan'),true);
    row.pointer=await owned(()=>resources.pointer.evaluate(finishMayoPointer));
    assert.equal(row.pointer.overflow,false);await resources.pointer.dispose();resources.pointer=null;
    await owned(()=>page.waitForFunction(id=>{
      const s=window.__ASHFALL_BATTLE_QA__.getV177NativeMayoProof(id,true);
      return s.manualAbility?.phase==='feral'&&s.manualAbility.activeRemaining>0&&!s.mayoRetreat;
    },proof.proofId,{timeout:LIMITS.readinessMs}));
    proof=await owned(()=>page.evaluate(id=>window.__ASHFALL_BATTLE_QA__.armV177NativeMayoProof(id),proof.proofId));
  }else{
    assert.ok(['ordinary','legacy-art'].includes(row.owner),'Every special form requires its own real owner');
    proof=await owned(()=>page.evaluate(({form,phase})=>{
      const qa=window.__ASHFALL_BATTLE_QA__,p=qa.prepareV177ContinuousActorProof({form,phase});
      qa.setEnemyVfxProofPaused(true);return p;
    },{form:row.form,phase:row.phase}));
  }
  const actual=await owned(()=>page.evaluate(()=>({route:location.pathname,
    battleGeneration:window.__ASHFALL_BATTLE_QA__.getPhaseGCombatSnapshot().battleGeneration})));
  return {...proof,...actual,schema:'v177-native-shard-proof/v1',owner:row.owner,
    proofId:proof.proofId??actual.battleGeneration+':'+row.form+':'+proof.fighterId+':'+row.phase,
    ownerEvidence:proof.ownerEvidence??proof.origin??{constructorFixture:true,legacyFusedFixture:proof.legacyFusedFixture}};
}

export function assertAllUnitClip(row,bytes,{codecControl=false,requestedMimeType='video/webm;codecs=vp8',requestedCaptureHz=60,acquisitionControl=false}={}){
  const c=row.nativeClip;
  if(acquisitionControl){
    assert.equal(row.caseId,'forms-6:abomination:attack:844x340');assert.equal(row.recordingMetadata.acquisitionControl,true);
  }else assert.equal(row.recordingMetadata.acquisitionControl,undefined,'A normal observation cannot acquire a diagnostic label');
  if(requestedCaptureHz===null)assert.ok(c.requestedCaptureHz===null||c.requestedCaptureHz===undefined,'Historical noargs evidence keeps its original method');
  else{assert.equal(requestedCaptureHz,60);assert.equal(c.requestedCaptureHz,60);}
  if(codecControl){
    assert.equal(row.caseId,'forms-2:brute:attack:1280x720');assert.equal(row.form,'brute');assert.equal(row.phase,'attack');
    assert.deepEqual(row.viewport,{width:1280,height:720});assert.equal(row.recordingMetadata.codecControl,true);
    assert.ok(['video/webm;codecs=vp8','video/mp4'].includes(requestedMimeType));
  }else assert.equal(requestedMimeType,'video/webm;codecs=vp8','Ordinary all-unit clips keep the VP8 contract');
  assert.equal(c.status,'recorded');assert.equal(c.engine,'webkit');assert.equal(c.requestedMimeType,requestedMimeType);
  assert.match(c.mimeType,requestedMimeType==='video/mp4'?/^video\/mp4(?:;|$)/u:/^video\/webm(?:;|$)/u);
  assert.equal(c.originalSpeedAccepted,false);assert.equal(c.encodedPtsVerified,false);
  assert.ok(Number.isSafeInteger(c.bytes)&&c.bytes>0&&c.bytes<=LIMITS.clipBytes);
  assert.equal(bytes.length,c.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),c.sha256);
  for(const [key,value]of Object.entries(row.recordingMetadata))assert.deepEqual(c.metadata[key],value,'Original clip binding: '+key);
  assert.equal(c.timeOrigin,row.recordingStart.timeOrigin);assert.equal(c.startedAt,row.recordingStart.startedAt);
  assert.ok(Number.isFinite(c.stopRequestedAt)&&c.stopRequestedAt>c.startedAt
    &&c.stopRequestedAt-c.startedAt<=LIMITS.clipMs,'Original15s recording window');
  assert.ok(c.startedAt<=row.boundary.at&&row.boundary.at<=row.release.at);
  assert.ok(row.samples.at(-1).at<=c.stopRequestedAt);
  assert.ok(Number.isFinite(c.timeOrigin)&&Number.isFinite(row.sourceRaf.timeOrigin),'Original raw clock origins must remain recorded');
  assert.equal(row.realmOwner?.member,'owner-created');
  assertNativeRealmMember(row.realmOwner,row.realmOwner,'owner-created',null);
  let previous=row.realmOwner;
  const check=(r,member)=>{assertNativeRealmMember(row.realmOwner,r,member,previous);previous=r;};
  check(row.sourceRaf.realm?.started,'raf-start');
  check(c.realm?.created,'recorder-create');check(row.recordingStart.realm,'recorder-start');
  assert.deepEqual(c.realm.started,row.recordingStart.realm,'Same recorder-state start receipt differs');
  check(row.boundary.realm,'sample');check(row.release.realm,'release');check(row.captureStart.realm,'sample');
  for(const s of row.samples)check(s.realm,'sample');
  check(c.realm.finished,'recorder-finish');check(row.sourceRaf.realm?.stopped,'raf-stop');check(row.captureEnd.realm,'sample');
  assert.equal(row.sourceRaf.realm.failure,null);
  assert.equal(row.sourceRaf.overflow,false);
  assert.ok(row.sourceRaf.rows.length>=2);
  for(let i=0;i<row.sourceRaf.rows.length;i++){
    const r=row.sourceRaf.rows[i];assert.ok(Number.isFinite(r.at)&&Number.isFinite(r.renderSequence));
    assert.equal(r.renderKind,row.form);if(i)assert.ok(r.at>row.sourceRaf.rows[i-1].at);
  }
}
export async function captureAllUnitCase(page,row,{out,onFailure=()=>{},requestedMimeType='video/webm;codecs=vp8',requestedCaptureHz=60,codecControl=false,acquisitionControl=false}={}){
  assertPlannedCase(row);let clip,observation,primary;
  const resources={pointer:null,realmOwner:null,captureStartHandle:null,captureStartExported:false,sampleHandles:[]};
  const active=()=>{assert.notEqual(row.deadlineExpired,true,'Late capture cannot become accepted');assert.equal(page.isClosed(),false);};
  const owned=async operation=>{active();const value=await operation();active();return value;};
  try{
    row.proof=await prepareCase(page,row,owned,active,resources);assertShardProof(row,row.proof);
    await owned(()=>page.waitForFunction(hasPreparedAllUnitPaint,row.proof,{timeout:LIMITS.readinessMs}));
    resources.realmOwner=await page.evaluateHandle(createNativeAllUnitRealmOwner);active();
    row.realmOwner=await owned(()=>resources.realmOwner.evaluate(readNativeAllUnitRealmOwner));
    observation=await page.evaluateHandle(startNativeGameRafObservation,{...row.proof,realmOwner:resources.realmOwner});active();
    row.recordingMetadata={form:row.form,requestedKind:row.proof.kind,phase:row.phase,
      fixtureGroup:row.phase==='engage'?'approach-to-attack':row.proof.side==='human'||row.owner==='legacy-art'?'authored-form':'base-enemy',
      fighterId:row.proof.fighterId,preparedRenderKind:row.form,owner:row.owner,caseId:row.caseId,
      proofId:row.proof.proofId,battleGeneration:row.proof.battleGeneration,
      legacyFusedFixture:row.proof.legacyFusedFixture,diagnosticOnly:true,controlledOpponent:true,
      samplingProtocol:'native-min-spacing-v2',
      ...(codecControl?{codecControl:true}:{}),...(acquisitionControl?{acquisitionControl:true}:{})};
    clip=await beginV177NativeCanvasClip(page,row.recordingMetadata,{directory:path.join(out,
      row.viewport.width+'x'+row.viewport.height,'native-canvas-clips'),engine:'webkit',requestedMimeType,requestedCaptureHz,realmOwner:resources.realmOwner});active();
    row.recordingStart=await owned(()=>clip.waitForStart());
    row.pausedCaptureStart=await owned(()=>resources.realmOwner.evaluate(readNativeAllUnitSample,{...row.proof,performanceBoundary:true}));
    row.boundary=postpaintCaptureBoundary(row,row.proof,row.pausedCaptureStart,row.recordingStart);
    row.sequenceBaseline=row.boundary.renderSequence;
    // Release and baseline are one browser task, so the first live attack
    // cannot occur between them. Keep every form's large snapshot in its realm
    // until encoding has finished; only the real scalar receipts cross now.
    await owned(async()=>{resources.captureStartHandle=await resources.realmOwner.evaluateHandle(readNativeAllUnitSample,
      {...row.proof,releaseClock:true,performanceBoundary:true,immutableSnapshot:true});});
    const start=await owned(()=>resources.captureStartHandle.evaluate(value=>({at:value.at,release:value.releaseReceipt})));
    row.release=start.release;const captureStartAt=start.at;
    const count=row.phase==='engage'?LIMITS.engageSamples:LIMITS.moveAttackSamples;
    row.sampleRpcTimings=[];
    for(let i=0;i<count;i++){
      const sampleAt=captureStartAt+(i+1)*LIMITS.sampleDelayMs;
      const rpc={index:i,sampleAt,startedAt:performance.now(),status:'pending'};row.sampleRpcTimings.push(rpc);
      try{
        // Keep the original read/cadence in the page. Transferring every full
        // history while encoding can stall WebKit even when the reader is fast.
        await owned(async()=>{
          const handle=await resources.realmOwner.evaluateHandle(readNativeAllUnitSample,{...row.proof,
            sampleAt,previousSample:resources.sampleHandles.at(-1)?.handle??resources.captureStartHandle,
            performanceBoundary:i===count-1,immutableSnapshot:true});
          resources.sampleHandles.push({handle,exported:false});
        });rpc.status='completed';
      }catch(error){rpc.status='error';rpc.error=String(error);throw error;}
      finally{rpc.finishedAt=performance.now();rpc.durationMs=rpc.finishedAt-rpc.startedAt;}
    }
    const completed=clip;clip=null;row.nativeClip=await completed.finish({completed:true});active();
    row.sourceRaf=await owned(()=>observation.evaluate(stopNativeGameRafObservation));
    await observation.dispose();observation=null;
    row.captureEnd=await owned(()=>resources.realmOwner.evaluate(readNativeAllUnitSample,{...row.proof,performanceBoundary:true}));
    if(resources.captureStartHandle){
      row.captureStart=await owned(()=>resources.captureStartHandle.evaluate(value=>value));resources.captureStartExported=true;
    }
    if(row.owner==='mayo-activation'){
      assert.equal(row.captureEnd.fighter?.manualAbilityPhase,'feral');assert.ok(row.captureEnd.fighter.activeRemaining>0);
      row.proof={...row.proof,...await owned(()=>page.evaluate(id=>window.__ASHFALL_BATTLE_QA__.getV177NativeMayoProof(id),row.proof.proofId))};
      row.proof.ownerEvidence.pointer=row.pointer;
    }
    for(const entry of resources.sampleHandles){
      row.samples.push(await owned(()=>entry.handle.evaluate(value=>value)));entry.exported=true;
    }
    let previous=row.captureStart;
    for(const [i,sample]of row.samples.entries()){
      const planned=captureStartAt+(i+1)*LIMITS.sampleDelayMs;
      const notBefore=Math.max(planned,previous.at+LIMITS.sampleDelayMs);
      assert.equal(sample.readTiming.sampleAt,planned,'Keep the original plan, including its lateness');
      assert.equal(sample.readTiming.notBeforeAt,notBefore);
      assert.equal(sample.readTiming.spacingAnchorAt,previous.at);
      assert.ok(sample.at>=notBefore,'Delayed reads must not consume the next sample early');
      previous=sample;
    }
    assertAllUnitClip(row,await readFile(row.nativeClip.file),{codecControl,requestedMimeType,requestedCaptureHz,acquisitionControl});
    row.postpaintReceipt=assertShardPostpaintContract(row,row.proof,row.boundary,row.release,row.samples);
    const windowSamples=row.samples.map(s=>({...s,renders:s.renders.filter(r=>r.renderSequence>row.sequenceBaseline
      &&r.jointPaintedAt>=row.boundary.simulationTime&&r.jointPaintedAt<=s.simulationTime)}));
    row.summary=assertV177AuthoredLiveRender({...row,samples:windowSamples});
    row.expectedJointPath=row.binding.atlas.path;
    row.damageReceipt=row.owner==='mayo-activation'?assertMayoFeralReceipt(row,MANUAL_ABILITY_REGISTRY['mayo-chan'])
      :row.owner==='futago-pair'?assertFutagoPairDamageAndOwner(row):nativeGameDamageReceipt(row);
    row.performanceReceipt=nativeGamePerformanceReceipt(row);
    row.captureTailPerformanceReceipt={...nativeGamePerformanceReceipt({...row,samples:[row.captureEnd]}),
      scope:'Separate cumulative counter boundary after recorder finish and RAF stop; the original sample window and thresholds are unchanged. Not original-speed or performance acceptance'};
    active();row.status='observed-diagnostic';
  }catch(error){primary=error;row.originalFailure=String(error);onFailure(error);throw error;}
  finally{
    row.cleanupErrors=[];
    if(resources.pointer){
      try{row.interruptedPointer=await resources.pointer.evaluate(finishMayoPointer);}catch(e){row.cleanupErrors.push(String(e));}
      try{await resources.pointer.dispose();}catch(e){row.cleanupErrors.push(String(e));}
    }
    if(clip)try{row.interruptedClip=await clip.finish({completed:false});}catch(e){row.cleanupErrors.push(String(e));}
    if(observation){
      try{row.interruptedSourceRaf=await observation.evaluate(stopNativeGameRafObservation);}catch(e){row.cleanupErrors.push(String(e));}
      try{await observation.dispose();}catch(e){row.cleanupErrors.push(String(e));}
    }
    if(resources.captureStartHandle){
      if(!resources.captureStartExported)try{row.interruptedCaptureStart=await resources.captureStartHandle.evaluate(value=>value);}catch(e){row.cleanupErrors.push(String(e));}
      try{await resources.captureStartHandle.dispose();}catch(e){row.cleanupErrors.push(String(e));}
    }
    for(const entry of resources.sampleHandles){
      if(!entry.exported)try{(row.interruptedSamples??=[]).push(await entry.handle.evaluate(value=>value));}catch(e){row.cleanupErrors.push(String(e));}
      try{await entry.handle.dispose();}catch(e){row.cleanupErrors.push(String(e));}
    }
    try{await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(true));}catch(e){row.cleanupErrors.push(String(e));}
    if(resources.realmOwner)try{await resources.realmOwner.dispose();}catch(e){row.cleanupErrors.push(String(e));}
    if(!primary&&row.cleanupErrors.length)throw Error(row.cleanupErrors.join('; '));
  }
}
