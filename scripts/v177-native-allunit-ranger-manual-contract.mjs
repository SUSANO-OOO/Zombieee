import assert from 'node:assert/strict';
import {MANUAL_ABILITY_REGISTRY} from '../app/manualAbilities.js';
import {RUNTIME_SIMULATION_STEP_SECONDS as STEP} from '../app/renderPerformance.js';
import {SHARDS,planShard,LIMITS} from './v177-native-allunit-manifest.mjs';
export const RANGER_MANUAL_PHASE='ranger-manual-precision';
export const RANGER_MANUAL_GROUP='actual-ranger-manual-precision';
const finite=Number.isFinite;
const statKeys=['speed','laneSpeed','damage','range','attackEvery','hp','maxHp'];
export function planRangerManualShard(shardId){
  assert.ok(SHARDS.some(s=>s.id===shardId),'Unknown manual supplement shard');
  return Object.freeze(planShard(shardId).filter(r=>r.form==='ranger'&&r.phase==='engage').map(reference=>Object.freeze({
    caseId:`${shardId}:ranger:${RANGER_MANUAL_PHASE}:${reference.viewport.width}x${reference.viewport.height}`,
    shardId,form:'ranger',phase:RANGER_MANUAL_PHASE,owner:'ranger-manual-precision',
    viewport:reference.viewport,binding:reference.binding,referenceCaseId:reference.caseId,
  })));
}
export function assertRangerManualPlan(row){
  const planned=planRangerManualShard(row.shardId).find(r=>r.caseId===row.caseId);assert.ok(planned,'Unplanned manual supplement');
  assert.deepEqual(Object.fromEntries(Object.keys(planned).map(k=>[k,row[k]])),planned);
  return planned;
}
export function rangerManualEnvelopeReference(row){
  assertRangerManualPlan(row);return planShard(row.shardId).find(r=>r.caseId===row.referenceCaseId);
}
export function assertRangerManualCapture(row){
  assertRangerManualPlan(row);const proof=row.proof,source=row.sourceRaf,definition=MANUAL_ABILITY_REGISTRY.ranger;
  assert.equal(definition.windupSeconds,.5);assert.equal(definition.recoverySeconds,.18);assert.equal(definition.impactDamage,92);
  assert.equal(row.phase,RANGER_MANUAL_PHASE);assert.equal(row.recordingMetadata.phase,RANGER_MANUAL_PHASE);
  assert.equal(row.recordingMetadata.fixtureGroup,RANGER_MANUAL_GROUP);
  assert.equal(row.recordingMetadata.baselineActivationId,row.baselineActivationId);
  assert.equal(source.failure,null);assert.equal(source.overflow,false);assert.equal(source.historyOverflow,false);
  assert.ok(Array.isArray(source.rows)&&source.rows.length>=2&&source.rows.length<=LIMITS.sourceRafRows);
  assert.equal(source.pointer.overflow,false);
  for(const type of ['pointerdown','pointerup','click'])assert.ok(source.pointer.events.some(e=>e.type===type&&e.isTrusted===true&&e.fighterId===proof.fighterId&&e.kind==='ranger'),'Actual trusted '+type+' missing');
  let previousPointer=-Infinity;
  for(const e of source.pointer.events){assert.equal(e.isTrusted,true);assert.equal(e.fighterId,proof.fighterId);assert.equal(e.kind,'ranger');
    assert.ok(finite(e.at)&&e.at>=row.beforeInput.at&&e.at<=row.afterInput.at&&e.at>=previousPointer);previousPointer=e.at;}
  assert.ok(source.pointer.events.length>=3&&source.pointer.events.length<=16);
  assert.ok(Number.isSafeInteger(row.baselineActivationId)&&row.baselineActivationId>=0);
  const receipts=row.afterInput.phaseG.manualAbilityReceipts;
  const starts=receipts.filter(r=>r.ownerId===proof.fighterId&&r.kind==='ranger'&&r.eventType==='start'&&r.activationId===row.baselineActivationId+1&&r.at>=row.beforeInput.simulationTime);
  assert.equal(starts.length,1,'One new actual original start receipt required');const start=starts[0],activationId=start.activationId;
  assert.equal(row.beforeInput.manualRuntime.activationId,row.baselineActivationId);
  assert.equal(start.attackSequence,row.beforeInput.fighter.attackSequence);
  assert.ok(start.at>=row.release.afterTime&&start.at<=row.afterInput.simulationTime);
  assert.ok(row.recordingStart.startedAt<=row.release.at&&row.release.at<=row.beforeInput.at);
  const frames=source.rows.filter(r=>r.at>=row.release.at);assert.ok(frames.length>=2);
  let previous=null,seenActivation=false;const draws=new Map(),contacts=new Map(),muzzles=[];let lockedTarget=null,cooldown=null;const impactRows=[];
  for(const raw of frames){
    assert.ok([raw.at,raw.timeOrigin,raw.simulationTime].every(finite));
    assert.equal(raw.route,proof.route);assert.equal(raw.visible,true);assert.equal(raw.running,true);assert.equal(raw.paused,false);
    assert.deepEqual(raw.viewport,row.viewport);assert.equal(raw.historyOverflow,false);
    assert.equal(raw.battleGeneration,proof.battleGeneration);assert.equal(raw.lookup.requestedFighterId,proof.fighterId);assert.equal(raw.lookup.observedFighterId,proof.fighterId);
    assert.equal(raw.lookup.requestedTargetId,proof.targetId);assert.equal(raw.lookup.observedTargetId,proof.targetId);
    assert.equal(raw.fighter.id,proof.fighterId);assert.equal(raw.fighter.kind,'ranger');assert.equal(raw.fighter.side,'human');assert.equal(raw.fighter.renderKind,'ranger');
    for(const k of statKeys)assert.equal(raw.fighter[k],proof.originalActorStats[k],'Original Ranger stat changed: '+k);
    assert.equal(raw.target.id,proof.targetId);assert.equal(raw.target.kind,'walker');assert.equal(raw.target.side,'zombie');
    for(const k of ['speed','laneSpeed','damage'])assert.equal(raw.target[k],0);assert.equal(raw.target.maxHp,1_000_000);
    if(previous){assert.ok(raw.at>previous.at);assert.ok(raw.simulationTime>=previous.simulationTime);}previous=raw;
    const runtime=raw.manualRuntime;assert.equal(runtime?.kind,'ranger');
    if(runtime.activationId===activationId){seenActivation=true;if(runtime.target){lockedTarget??=runtime.target;assert.deepEqual(runtime.target,lockedTarget);}
      if(runtime.phase==='cooldown'&&raw.simulationTime>=start.at+definition.windupSeconds+definition.recoverySeconds-STEP){assert.equal(runtime.abilityElapsed,definition.windupSeconds+definition.recoverySeconds);assert.equal(runtime.windupRemaining,0);assert.equal(runtime.target,null);assert.ok(runtime.cooldownRemaining>0&&runtime.cooldownRemaining<=definition.cooldownSeconds);cooldown??=raw;}
    }else {assert.equal(seenActivation,false,'Manual runtime activation regressed');assert.equal(runtime.activationId,row.baselineActivationId);}
    for(const receipt of raw.phaseG.manualAbilityReceipts){if(receipt.ownerId===proof.fighterId&&receipt.kind==='ranger'&&receipt.activationId===activationId&&receipt.eventType==='impact')impactRows.push(receipt);}
    for(const contact of raw.skillContacts){
      if(contact.ownerId!==proof.fighterId||contact.kind!=='ranger'||contact.activationId!==activationId)continue;
      const key=[contact.ownerId,contact.activationId,contact.shotIndex,contact.targetId,contact.startedAt].join(':');
      const old=contacts.get(key);if(old)assert.deepEqual(contact,old);else contacts.set(key,contact);
    }
    for(const muzzle of raw.manualMuzzles)if(muzzle.ownerId===proof.fighterId&&muzzle.kind==='ranger'&&muzzle.activationId===activationId)muzzles.push({muzzle,paint:raw.latestPaint,simulationTime:raw.simulationTime});
    assert.ok(raw.renders.length<=LIMITS.maxHistoryRows);
    for(const paint of raw.renders){
      if(paint.renderSequence<=row.sequenceBaseline)continue;
      assert.equal(paint.jointDrawSucceeded,true);assert.ok(finite(paint.jointPaintedAt)&&paint.jointPaintedAt>=row.boundary.simulationTime&&paint.jointPaintedAt<=raw.simulationTime);
      assert.equal(paint.renderKind,'ranger');assert.equal(paint.jointAtlasPath,row.binding.atlas.path);
      const lower=paint.jointWeightedLower;assert.equal(paint.jointWeightedLowerDrawSucceeded,true);assert.equal(lower?.mode,'continuous-weighted-mesh');
      assert.equal(lower.parts,5);assert.equal(lower.meshVertices,130);assert.equal(lower.meshTriangles,192);assert.equal(lower.coverageSamples,4);assert.equal(lower.degenerate,0);assert.equal(lower.duplicateWithinPart,0);
      const simultaneous=paint.jointPaintedAt===raw.simulationTime&&paint.jointPaintedAt>start.at
        &&runtime.activationId===activationId&&['windup','recovery'].includes(runtime.phase);
      if(simultaneous)assert.equal(paint.jointRangerManualDrawSucceeded,true,'Actual live manual draw fell back or omitted its receipt');
      if(paint.jointRangerManual!=null||paint.jointRangerManualDrawSucceeded===true){
        assert.equal(paint.jointRangerManualDrawSucceeded,true);const d=paint.jointRangerManual;
        assert.equal(d?.component,'precision-shot');assert.equal(d.fighterId,proof.fighterId);assert.equal(d.activationId,activationId);
        assert.equal(d.runtimeKind,'ranger');assert.ok(['windup','recovery'].includes(d.runtimePhase));
        if(simultaneous){assert.equal(d.runtimePhase,runtime.phase);assert.equal(d.abilityElapsed,runtime.abilityElapsed);assert.equal(d.windupRemaining,runtime.windupRemaining);}
        assert.equal(d.sourceAtlas,row.binding.atlas.path);assert.equal(d.paintedAt,paint.jointPaintedAt);
        assert.ok([d.abilityElapsed,d.windupRemaining,d.clockElapsed].every(finite));assert.ok(d.windupRemaining>=0);
        assert.ok(Math.abs((d.paintedAt-start.at)-d.clockElapsed)<=STEP,'Actual runtime clock differs from original simulation');
        if(d.runtimePhase==='windup'){assert.equal(d.presentationPhase,'aim');assert.equal(d.clockElapsed,definition.windupSeconds-d.windupRemaining);assert.equal(d.recoveryRemaining,null);assert.ok(d.clockElapsed>=0&&d.clockElapsed<definition.windupSeconds);}
        else {assert.equal(d.clockElapsed,d.abilityElapsed);assert.ok(finite(d.recoveryRemaining));assert.equal(d.recoveryRemaining,d.windupRemaining);assert.ok(d.clockElapsed>=definition.windupSeconds&&d.clockElapsed<=definition.windupSeconds+definition.recoverySeconds);assert.ok(['recoil','return'].includes(d.presentationPhase));}
        assert.ok(finite(paint.renderedWeaponSocket?.x)&&finite(paint.renderedWeaponSocket?.y));
      }
      const old=draws.get(paint.renderSequence);if(old)assert.deepEqual(paint,old,'Actual paint rebound');else draws.set(paint.renderSequence,paint);
    }
  }
  assert.ok(lockedTarget,'Actual locked manual target absent');assert.equal(lockedTarget.targetId,proof.targetId);assert.deepEqual(lockedTarget.targetIds,[proof.targetId]);
  const aim=Object.fromEntries(['direction','targetId','targetIds','x','y'].filter(k=>Object.hasOwn(lockedTarget,k)).map(k=>[k,lockedTarget[k]]));
  const manual=[...draws.values()].filter(p=>p.jointRangerManualDrawSucceeded===true);
  for(const p of manual)assert.deepEqual(p.jointRangerManual.lockedAim,aim,'Actual locked aim changed or omitted');
  for(const phase of ['aim','recoil','return'])assert.ok(manual.some(p=>p.jointRangerManual.presentationPhase===phase),'Missing actual '+phase+' paint');
  // A descriptor can be absent on neutral paints. It cannot disappear between
  // the actual first manual paint and the final return within this activation.
  const firstManual=Math.min(...manual.map(p=>p.renderSequence)),lastManual=Math.max(...manual.map(p=>p.renderSequence));
  for(const p of draws.values())if(p.renderSequence>=firstManual&&p.renderSequence<=lastManual)assert.equal(p.jointRangerManualDrawSucceeded,true,'Unpainted/fallback hole in manual cycle');
  assert.ok(cooldown,'Actual post-return cooldown missing');
  const impacts=[...new Map(impactRows.map(r=>[JSON.stringify(r),r])).values()];assert.equal(impacts.length,1,'One same-activation real impact required');const impact=impacts[0];
  assert.ok(Math.abs(impact.at-start.at-definition.windupSeconds)<=STEP,'Original .5s windup changed');
  assert.equal(contacts.size,1,'One actual unborrowed Ranger contact required');const contact=[...contacts.values()][0];
  assert.equal(contact.targetId,proof.targetId);assert.equal(contact.shotIndex,0);assert.equal(contact.startedAt,impact.at);
  assert.ok([contact.hpBefore,contact.hpAfter].every(finite)&&contact.hpBefore>contact.hpAfter);assert.equal(contact.hpBefore-contact.hpAfter,definition.impactDamage);
  const muzzle=muzzles.find(({muzzle:m,paint:p})=>m.shotIndex===0&&m.startedAt===impact.at&&finite(m.x)&&finite(m.y)
    &&p?.jointRangerManualDrawSucceeded===true&&p.jointRangerManual.activationId===activationId
    &&m.x===p.renderedWeaponSocket?.x&&m.y===p.renderedWeaponSocket?.y);
  assert.ok(muzzle,'Same-activation actual muzzle/socket paint missing');
  return {schema:'v177-ranger-manual-native-receipt/v1',caseId:row.caseId,sourceId:proof.fighterId,targetId:proof.targetId,activationId,
    originalStart:start,originalImpact:impact,contact,actualMuzzle:muzzle.muzzle,lockedAim:aim,manualPaints:manual.length,
    sourceRafFrames:source.rows.length,windupSeconds:definition.windupSeconds,recoverySeconds:definition.recoverySeconds,
    originalSimulationStepSeconds:STEP,appliedDamage:contact.hpBefore-contact.hpAfter,
    normalEngageAccepted:false,originalSpeedAccepted:false,naturalnessAccepted:false,physicalSavedAudioAccepted:false,wholeGameAccepted:false,
    scope:'Supplemental actual precision-shot only; real input/start/contact/muzzle and postdraw descriptors. No normal motion case or visual acceptance substitution'};
}
