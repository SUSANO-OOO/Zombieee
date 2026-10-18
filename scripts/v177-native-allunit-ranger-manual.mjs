import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {nativeBattleTap} from './v100-normal-tactical-input.mjs';
import {manualMarkerDispatchStarted} from './v100-phase-g-runtime-evidence.mjs';
import {beginV177NativeCanvasClip} from './v177-native-canvas-clips.mjs';
import {hasPreparedAllUnitPaint,assertAllUnitClip} from './v177-native-allunit-cases.mjs';
import {nativeGamePerformanceReceipt} from './v177-native-game-capture-browser.mjs';
import {LIMITS} from './v177-native-allunit-manifest.mjs';
import {assertShardProof,createNativeAllUnitRealmOwner,readNativeAllUnitRealmOwner,
  postpaintCaptureBoundary,assertShardPostpaintContract,releasePreparedShardClock} from './v177-native-allunit-contract.mjs';
import {RANGER_MANUAL_PHASE,RANGER_MANUAL_GROUP,assertRangerManualPlan,
  rangerManualEnvelopeReference,assertRangerManualCapture} from './v177-native-allunit-ranger-manual-contract.mjs';

// Serializable factory. The method closes over actual realm-owner references;
// no function-string injection, expected paint stamps or global observer patch.
export function createNativeRangerManualReader({proof,realmOwner}){
  const read=({performanceBoundary=false,includeRealm=true}={})=>{
    const canvas=document.querySelector('.game-shell canvas'),refs={window,document,performance,canvas};
    realmOwner.check(refs);const realm=includeRealm?realmOwner.member(refs,'sample'):null;
    const qa=window.__ASHFALL_BATTLE_QA__,snapshot=qa.getSnapshot(),phaseG=qa.getPhaseGCombatSnapshot();
    const audit=qa.getEnemyFacingRuntimeAudit(proof.fighterId),target=qa.getEnemyFacingRuntimeAudit(proof.targetId);
    const runtimeActor=phaseG.fighters.find(f=>f.id===proof.fighterId),history=audit.renderHistory??[];
    const boundary=performanceBoundary?(()=>{const r=canvas.getBoundingClientRect();return{
      runtimePerformance:qa.getPerformanceSnapshot(),geometry:{viewport:{width:innerWidth,height:innerHeight},devicePixelRatio,
        canvas:{width:canvas.width,height:canvas.height,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}}};})():{};
    return {schema:'v177-native-shard-postpaint/v1',at:performance.now(),timeOrigin:performance.timeOrigin,...(realm?{realm}:{}),
      simulationTime:snapshot.time,route:location.pathname,visible:document.visibilityState==='visible',running:snapshot.running,paused:snapshot.paused,
      viewport:{width:innerWidth,height:innerHeight},...boundary,
      lookup:{requestedFighterId:proof.fighterId,observedFighterId:audit.fighter?.id,requestedTargetId:proof.targetId,observedTargetId:target.fighter?.id},
      battleGeneration:phaseG.battleGeneration,historyOverflow:history.length>128,
      fighter:structuredClone(audit.fighter),target:structuredClone(target.fighter),
      manualRuntime:structuredClone(runtimeActor?.manualAbility),
      phaseG:structuredClone({screen:phaseG.screen,stageId:phaseG.stageId,time:phaseG.time,battleGeneration:phaseG.battleGeneration,
        fighters:phaseG.fighters,manualAbilityReceipts:phaseG.manualAbilityReceipts}),
      skillContacts:structuredClone(snapshot.v100SkillContacts),manualMuzzles:structuredClone(snapshot.v100ManualMuzzles),
      completedAttackImpacts:structuredClone(phaseG.completedAttackImpacts),
      // All actual rows, including missing/false manual flags, remain raw.
      renders:structuredClone(history),latestPaint:structuredClone(history.at(-1)??null)};
  };
  return {read,realmOwner};
}
export function startNativeRangerManualObservation({reader}){
  const state={reader,timeOrigin:performance.timeOrigin,startedAt:performance.now(),rows:[],overflow:false,
    historyOverflow:false,lastSequence:null,stopped:false,raf:null,failure:null,pointer:{events:[],overflow:false}};
  const refs=()=>({window,document,performance,canvas:document.querySelector('.game-shell canvas')});
  state.realmStarted=reader.realmOwner.member(refs(),'raf-start');
  const record=e=>{
    const b=e.target?.closest?.('button.manual-ability-ready');if(!b)return;
    if(state.pointer.events.length>=16){state.pointer.overflow=true;return;}
    state.pointer.events.push({type:e.type,isTrusted:e.isTrusted,fighterId:Number(b.dataset.fighterId),kind:b.dataset.abilityKind,at:performance.now()});
  };
  for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,record,true);
  const observe=()=>{
    if(state.stopped)return;
    try{
      if(state.rows.length>=4096){state.overflow=true;throw Error('Manual source RAF4096 bound exhausted');}
      const raw=reader.read({includeRealm:false}),history=raw.renders;
      if(raw.historyOverflow||history.length>128){state.historyOverflow=true;throw Error('Manual raw history128 bound exhausted');}
      if(!Array.isArray(raw.skillContacts)||raw.skillContacts.length>48||!Array.isArray(raw.manualMuzzles)||raw.manualMuzzles.length>16
        ||!Array.isArray(raw.phaseG.manualAbilityReceipts)||raw.phaseG.manualAbilityReceipts.length>48)throw Error('Original manual observation arrays unavailable/unbounded');
      if(state.lastSequence!==null&&history.length&&history.at(-1).renderSequence>state.lastSequence
        &&!history.some(r=>r.renderSequence===state.lastSequence))throw Error('Manual source draw history lost its previous actual row');
      const renders=state.lastSequence===null?history:history.filter(r=>r.renderSequence>state.lastSequence);
      if(history.length)state.lastSequence=history.at(-1).renderSequence;
      state.rows.push({...raw,renders,renderSequence:raw.latestPaint?.renderSequence??null,renderKind:raw.latestPaint?.renderKind??null});
      state.raf=requestAnimationFrame(observe);
    }catch(error){state.failure??=String(error);state.stopped=true;}
  };
  state.stop=()=>{
    state.stopped=true;cancelAnimationFrame(state.raf);for(const type of ['pointerdown','pointerup','click'])document.removeEventListener(type,record,true);
    let stopped=null;try{stopped=reader.realmOwner.member(refs(),'raf-stop');}catch(error){state.failure??=String(error);}
    return {timeOrigin:state.timeOrigin,startedAt:state.startedAt,stoppedAt:performance.now(),rows:state.rows,
      realm:{started:state.realmStarted,stopped,failure:state.failure},overflow:state.overflow,historyOverflow:state.historyOverflow,
      failure:state.failure,pointer:state.pointer,encodedFrameCount:null,encodedPtsVerified:false,
      scope:'Actual same-RPC runtime/receipts/contacts/muzzles and unfiltered new draw history on native RAF; not encoded frames, input injection or visual acceptance'};
  };
  state.raf=requestAnimationFrame(observe);return state;
}
export function stopNativeRangerManualObservation(state){return state.stop();}

export async function captureNativeRangerManualCase(page,row,{out,onFailure=()=>{},
  begin=beginV177NativeCanvasClip,tap=nativeBattleTap,readBytes=readFile}={}){
  assertRangerManualPlan(row);const reference=rangerManualEnvelopeReference(row);
  const resources={realmOwner:null,reader:null,observation:null};let clip,primary;
  const active=()=>{assert.notEqual(row.deadlineExpired,true,'Late manual capture cannot become accepted');assert.equal(page.isClosed(),false);};
  const owned=async operation=>{active();const value=await operation();active();return value;};
  const read=options=>owned(()=>resources.reader.evaluate((reader,options)=>reader.read(options),options));
  try{
    const prepared=await owned(()=>page.evaluate(()=>{const qa=window.__ASHFALL_BATTLE_QA__,proof=qa.prepareV177ContinuousActorProof({form:'ranger',phase:'engage'});qa.setEnemyVfxProofPaused(true);return{
      ...proof,route:location.pathname,battleGeneration:qa.getPhaseGCombatSnapshot().battleGeneration};}));
    row.proof={...prepared,schema:'v177-native-shard-proof/v1',owner:'ordinary',
      proofId:prepared.proofId??prepared.battleGeneration+':ranger:'+prepared.fighterId+':engage',
      ownerEvidence:{constructorFixture:true,legacyFusedFixture:false}};
    assertShardProof(reference,row.proof);
    await owned(()=>page.waitForFunction(hasPreparedAllUnitPaint,row.proof,{timeout:LIMITS.readinessMs}));
    resources.realmOwner=await page.evaluateHandle(createNativeAllUnitRealmOwner);active();
    row.realmOwner=await owned(()=>resources.realmOwner.evaluate(readNativeAllUnitRealmOwner));
    resources.reader=await page.evaluateHandle(createNativeRangerManualReader,{proof:row.proof,realmOwner:resources.realmOwner});active();
    row.preparedManual=await read();assert.equal(row.preparedManual.paused,true);assert.equal(row.preparedManual.manualRuntime?.kind,'ranger');
    assert.equal(row.preparedManual.manualRuntime.phase,'ready');assert.equal(row.preparedManual.manualRuntime.cooldownRemaining,0);
    row.baselineActivationId=row.preparedManual.manualRuntime.activationId;assert.ok(Number.isSafeInteger(row.baselineActivationId)&&row.baselineActivationId>=0);
    resources.observation=await page.evaluateHandle(startNativeRangerManualObservation,{reader:resources.reader});active();
    row.recordingMetadata={form:'ranger',requestedKind:'ranger',preparedRenderKind:'ranger',phase:RANGER_MANUAL_PHASE,fixtureGroup:RANGER_MANUAL_GROUP,
      fighterId:row.proof.fighterId,targetId:row.proof.targetId,owner:row.owner,caseId:row.caseId,referenceCaseId:reference.caseId,
      proofId:row.proof.proofId,battleGeneration:row.proof.battleGeneration,baselineActivationId:row.baselineActivationId,
      manualAbilityKind:'ranger',constructorPhase:'engage',legacyFusedFixture:false,diagnosticOnly:true,controlledOpponent:true};
    clip=await begin(page,row.recordingMetadata,{directory:path.join(out,row.viewport.width+'x'+row.viewport.height,'native-ranger-manual-clips'),
      engine:'webkit',requestedMimeType:'video/webm;codecs=vp8',realmOwner:resources.realmOwner});active();
    row.recordingStart=await owned(()=>clip.waitForStart());row.pausedCaptureStart=await read({performanceBoundary:true});
    // The reference validates only the raw normal constructor/postpaint envelope.
    // This row is never fed to the normal engage motion/damage success contract.
    row.boundary=postpaintCaptureBoundary(reference,row.proof,row.pausedCaptureStart,row.recordingStart);row.sequenceBaseline=row.boundary.renderSequence;
    row.release=await owned(()=>resources.realmOwner.evaluate(releasePreparedShardClock,row.proof));
    row.captureStart=await read({performanceBoundary:true});
    const selector='button.manual-ability-ready.available[data-ability-kind="ranger"][data-fighter-id="'+row.proof.fighterId+'"][aria-disabled="false"]';
    const button=page.locator(selector);await owned(()=>button.waitFor({state:'visible',timeout:LIMITS.readinessMs}));
    row.beforeInput=await read();assert.equal(row.beforeInput.manualRuntime.activationId,row.baselineActivationId);assert.equal(row.beforeInput.manualRuntime.phase,'ready');
    const inputPage={mouse:Object.fromEntries(['move','down','up'].map(key=>[key,async(...args)=>{active();const value=await page.mouse[key](...args);active();return value;}]))};
    row.inputPhases=[];assert.equal(await owned(()=>tap(inputPage,button,row.inputPhases)),true,'Real Ranger native pointer input required');
    row.afterInput=await read();assert.equal(manualMarkerDispatchStarted(row.beforeInput.phaseG,row.afterInput.phaseG,row.proof.fighterId,'ranger'),true,'Actual same-activation original start receipt required');
    for(let i=0;i<LIMITS.engageSamples;i++){
      await owned(()=>page.waitForTimeout(LIMITS.sampleDelayMs));row.samples.push(await read({performanceBoundary:i===LIMITS.engageSamples-1}));
    }
    const finished=clip;clip=null;row.nativeClip=await finished.finish({completed:true});active();
    row.sourceRaf=await owned(()=>resources.observation.evaluate(stopNativeRangerManualObservation));
    await resources.observation.dispose();resources.observation=null;
    row.captureEnd=await read();assertAllUnitClip(row,await readBytes(row.nativeClip.file));
    row.postpaintEnvelopeReceipt=assertShardPostpaintContract(reference,row.proof,row.boundary,row.release,row.samples);
    row.manualReceipt=assertRangerManualCapture(row);row.performanceReceipt=nativeGamePerformanceReceipt(row);active();
    row.normalEngageAccepted=false;row.status='observed-manual-diagnostic';
  }catch(error){primary=error;row.originalFailure=String(error);onFailure(error);throw error;}
  finally{
    row.cleanupErrors=[];
    if(clip)try{row.interruptedClip=await clip.finish({completed:false});}catch(error){row.cleanupErrors.push(String(error));}
    if(resources.observation){try{row.interruptedSourceRaf=await resources.observation.evaluate(stopNativeRangerManualObservation);}catch(error){row.cleanupErrors.push(String(error));}
      try{await resources.observation.dispose();}catch(error){row.cleanupErrors.push(String(error));}}
    try{await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(true));}catch(error){row.cleanupErrors.push(String(error));}
    for(const handle of [resources.reader,resources.realmOwner])if(handle)try{await handle.dispose();}catch(error){row.cleanupErrors.push(String(error));}
    if(!primary&&row.cleanupErrors.length)throw Error(row.cleanupErrors.join('; '));
  }
}
