import assert from 'node:assert/strict';
import {nativeBattleTap} from './v100-normal-tactical-input.mjs';
import {manualMarkerDispatchStarted} from './v100-phase-g-runtime-evidence.mjs';

const readySelector=proof=>'button.manual-ability-ready.available[data-ability-kind="mayo-chan"][data-fighter-id="'+proof.fighterId+'"][aria-disabled="false"]';

export function hasPausedReadyMayo(proof){
  const qa=window.__ASHFALL_BATTLE_QA__,snapshot=qa.getSnapshot();
  const live=qa.getV177NativeMayoProof(proof.proofId,true),audit=qa.getEnemyFacingRuntimeAudit(proof.fighterId);
  return snapshot.running===true&&snapshot.paused===true&&document.visibilityState==='visible'
    &&live.proofGeneration===proof.proofGeneration&&live.battleGeneration===proof.battleGeneration
    &&live.fighterId===proof.fighterId&&live.manualAbility?.phase==='ready'&&!live.mayoRetreat
    &&audit.fighter?.renderKind==='mayo-chan'&&audit.fighter.hp>0
    &&audit.renderHistory.some(r=>r.renderKind==='mayo-chan'&&r.assetReady===true&&r.renderSequence>0);
}

// Arm the inert target in the SAME page task as observing the real activation.
// No feral timer, self-drain, actor position or gameplay clock is assigned.
export function armRunningMayoWhenFeral(proof){
  const qa=window.__ASHFALL_BATTLE_QA__,snapshot=qa.getSnapshot();
  const live=qa.getV177NativeMayoProof(proof.proofId,true);
  if(!snapshot.running||snapshot.paused||live.proofGeneration!==proof.proofGeneration
    ||live.battleGeneration!==proof.battleGeneration||live.fighterId!==proof.fighterId
    ||live.manualAbility?.phase!=='feral'||!(live.manualAbility.activeRemaining>0)||live.mayoRetreat)return false;
  const source=qa.getV177NativeMayoProof(proof.proofId),owner=source.ownerEvidence;
  if(!owner?.feralReceipt||owner.startReceipt?.ownerId!==proof.fighterId
    ||owner.feralReceipt.ownerId!==proof.fighterId
    ||owner.activationId!==proof.priorActivationId+1
    ||live.manualAbility.activationId!==owner.activationId
    ||owner.startReceipt.activationId!==owner.activationId
    ||owner.feralReceipt.activationId!==owner.activationId
    ||owner.startReceipt.kind!=='mayo-chan'||owner.startReceipt.eventType!=='start'
    ||owner.feralReceipt.kind!=='mayo-chan'||owner.feralReceipt.eventType!=='feral-start')return false;
  const audit=qa.getEnemyFacingRuntimeAudit(proof.fighterId),prefix=audit.renderHistory;
  if(!prefix.length||prefix.some(r=>!Number.isSafeInteger(r.renderSequence)||r.renderSequence<=0))
    throw new Error('Original Mayo render boundary missing');
  const renderSequence=Math.max(...prefix.map(r=>r.renderSequence));
  const armed=qa.armV177NativeMayoProof(proof.proofId,{pauseForRecorder:false});
  return {...armed,activationRenderPrefix:prefix,captureBoundary:{at:performance.now(),
    simulationTime:live.simulationTime,renderSequence}};
}

export function fenceRecordedMayoSample(sample,boundary){
  assert.ok(Number.isSafeInteger(boundary?.renderSequence)&&boundary.renderSequence>0,'Original feral render boundary required');
  assert.ok(sample.renders.every(r=>Number.isSafeInteger(r.renderSequence)&&r.renderSequence>0),'Original render sequence required');
  // The prefix is retained once in the proof and in the complete native clip.
  // Keep EVERY post-boundary row, including wrong bodies or failed paints.
  return {...sample,renders:sample.renders.filter(r=>r.renderSequence>boundary.renderSequence)};
}

export async function prepareMayoEngagement(page){
  await page.evaluate(async()=>{
    const qa=window.__ASHFALL_BATTLE_QA__;
    await qa.ensureUnitRenderProofAsset('mayo-chan');
    await qa.ensureUnitRenderProofAsset('mayo-chan-feral');
  });
  const proof=await page.evaluate(()=>{
    const qa=window.__ASHFALL_BATTLE_QA__,proof=qa.prepareV177NativeMayoProof({phase:'engage'});
    qa.setEnemyVfxProofPaused(true);return proof;
  });
  await page.waitForFunction(hasPausedReadyMayo,proof,{timeout:5000});
  await page.locator(readySelector(proof)).waitFor({state:'visible',timeout:5000});
  return proof;
}

export async function releaseReadyMayoForRecording(page,proof){
  return page.evaluate(proof=>{
    const qa=window.__ASHFALL_BATTLE_QA__,live=qa.getV177NativeMayoProof(proof.proofId,true),snapshot=qa.getSnapshot();
    if(!snapshot.running||!snapshot.paused||live.proofGeneration!==proof.proofGeneration
      ||live.battleGeneration!==proof.battleGeneration||live.fighterId!==proof.fighterId
      ||live.manualAbility?.phase!=='ready'||live.mayoRetreat)throw new Error('Mayo must still be ready before recording');
    qa.setEnemyVfxProofPaused(false);
    return {at:performance.now(),simulationTime:live.simulationTime,proofId:proof.proofId};
  },proof);
}

export async function activateRecordedMayo(page,proof,clip){
  assert.ok(clip,'Mayo engagement requires the original running canvas recording');
  const recordingStart=await clip.waitForStart();
  const before=await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.getPhaseGCombatSnapshot());
  const inputPhases=[];
  assert.equal(await nativeBattleTap(page,page.locator(readySelector(proof)),inputPhases),true,'Original Mayo native input required');
  const after=await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.getPhaseGCombatSnapshot());
  assert.equal(manualMarkerDispatchStarted(before,after,proof.fighterId,'mayo-chan'),true,'Original Mayo activation receipt required');
  const result=await page.waitForFunction(armRunningMayoWhenFeral,proof,{timeout:5000,polling:'raf'});
  try{
    const armed=await result.jsonValue();
    Object.assign(proof,armed,{captureActivation:{recordingStart,inputPhases,
      prefix:'original normal-ready and windup, recorded before the real feral observation window',
      boundary:armed.arm}});
  }finally{await result.dispose();}
}
