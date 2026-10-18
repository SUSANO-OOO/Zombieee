import assert from 'node:assert/strict';
import {createBattleDefinition} from '../app/battleDefinitions.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {v177FormalFutagoPairSource} from '../app/v177NativeFutagoProof.js';
export const FUTAGO_PAIR_FORMS=Object.freeze(['futago-separated-a','futago-separated-b']);
const formalFutagoSource=v177FormalFutagoPairSource(createBattleDefinition(V100_STAGE_IDS[23],{v100:true}));
const uniqueRows=rows=>[...new Map(rows.map(r=>[r.sequence,r])).values()];
export function assertFutagoPairDamageAndOwner(row){
  const p=row.proof,first=row.captureStart,last=row.samples.at(-1);assert.notEqual(row.deadlineExpired,true);assert.equal(row.nativeClip.status,'recorded');assert.equal(row.nativeClip.requestedMimeType,'video/webm;codecs=vp8');assert.equal(row.nativeClip.engine,'webkit');assert.ok(row.nativeClip.bytes>0&&row.nativeClip.bytes<=8*1024*1024);assert.match(row.nativeClip.sha256,/^[a-f0-9]{64}$/u);assert.equal(row.nativeClip.originalSpeedAccepted,false);assert.equal(row.nativeClip.encodedPtsVerified,false);assert.ok(FUTAGO_PAIR_FORMS.includes(row.form));assert.equal(p.owner,'futago-pair');assert.equal(p.kind,'futago');assert.equal(p.side,'zombie');assert.equal(p.legacyFusedFixture,false);assert.equal(p.renderKind,row.form);assert.equal(p.v100TwinPart,row.form.at(-1));
  const owner=p.ownerEvidence;assert.equal(owner.v100BossId,'boss-futago');assert.equal(owner.selectedPart,p.v100TwinPart);assert.equal(owner.formalWave.wave,4);assert.equal(owner.formalWave.allWaveKinds.filter(k=>k==='futago').length,2);assert.equal(owner.spawnCountBefore,0);assert.equal(owner.spawnCountAfter,2);assert.notEqual(owner.aId,owner.bId);assert.equal(p.fighterId,p.v100TwinPart==='a'?owner.aId:owner.bId);assert.equal(p.partnerId,p.v100TwinPart==='a'?owner.bId:owner.aId);
  assert.deepEqual(owner.formalWave,formalFutagoSource,'Retain the complete original S24 wave and source orders');
  assert.deepEqual(owner.spawnOrdinals,['a','b'].map((part,ordinal)=>({fighterId:part==='a'?owner.aId:owner.bId,
    part,ordinal,sourceOrder:formalFutagoSource.pairOrders[ordinal]})),'Both distinct original registrations must be retained');
  assert.equal(owner.pairId,0);
  const statKeys=['speed','laneSpeed','damage','range','attackEvery','hp','maxHp'];
  for(const sample of [first,...row.samples]){
    assert.equal(sample.battleGeneration,p.battleGeneration);assert.equal(sample.running,true);assert.equal(sample.paused,false);assert.equal(sample.visible,true);assert.ok(sample.route.endsWith('/v100'));assert.equal(sample.lookup?.requestedFighterId,p.fighterId);assert.equal(sample.lookup?.observedFighterId,p.fighterId);assert.deepEqual(sample.ownerEvidence,owner);assert.equal(sample.damageCopy?.overflow,false);assert.equal(sample.damageCopy.failure,null);for(const r of sample.damageCopy.rows)assert.ok(r.at<=sample.simulationTime,'Future damage receipt is invalid');
    for(const [actor,stats,id,part]of [[sample.fighter,p.originalActorStats,p.fighterId,p.v100TwinPart],[sample.partner,p.originalPartnerStats,p.partnerId,p.v100TwinPart==='a'?'b':'a']]){assert.equal(actor?.id,id);assert.equal(actor.kind,'futago');assert.equal(actor.side,'zombie');assert.equal(actor.renderKind,'futago-separated-'+part);assert.equal(actor.v100TwinPart,part);assert.ok(actor.hp>0);for(const k of statKeys)assert.equal(actor[k],stats[k],'Original pair '+id+'/'+k);const raw=sample.rawPairMembers.find(r=>r.id===id);assert.equal(raw?.v100TwinPair,owner.pairId);assert.equal(raw.v100BossId,'boss-futago');assert.equal(raw.v100TwinPart,part);assert.equal(raw.v100TwinEnraged,false);}
    if(sample.fighter.targetId!==null)assert.equal(sample.fighter.targetId,p.targetId,'Natural selected target must match');if(sample.partner.targetId!==null)assert.equal(sample.partner.targetId,p.partnerTargetId,'Natural companion target must match');
    for(const [t,id]of [[sample.target,p.targetId],[sample.partnerTarget,p.partnerTargetId]]){assert.equal(t.id,id);assert.equal(t.kind,'guardian');assert.equal(t.side,'human');for(const k of ['speed','laneSpeed','damage'])assert.equal(t[k],0);assert.equal(t.maxHp,1_000_000);}
  }
  assert.ok(first.at>=row.recordingStart.startedAt);assert.equal(row.recordingStart.timeOrigin,row.nativeClip.timeOrigin);assert.ok(last.at<=row.nativeClip.stopRequestedAt);assert.ok(row.samples.every(s=>s.at>first.at&&s.at<=row.nativeClip.stopRequestedAt));
  const renders=[...new Map(row.samples.flatMap(s=>s.renders).filter(r=>r.renderSequence>row.sequenceBaseline&&r.jointPaintedAt>=first.simulationTime&&r.jointPaintedAt<=last.simulationTime).map(r=>[r.renderSequence,r])).values()];
  assert.ok(renders.length>=5,'Actual new post-ack draw receipts required');for(const r of renders){assert.equal(r.renderKind,p.renderKind);assert.equal(r.jointDrawSucceeded,true);assert.equal(r.assetReady,true);assert.equal(r.jointAtlasPath,row.expectedJointPath);assert.ok(Number.isFinite(r.jointPaintedAt));assert.ok(r.renderWidth>0&&r.renderHeight>0);}
  const rawCopies=row.samples.flatMap(s=>s.damageCopy.rows);for(const r of rawCopies){const duplicates=rawCopies.filter(q=>q.sequence===r.sequence);for(const duplicate of duplicates)assert.deepEqual(duplicate,r,'Conflicting duplicate raw damage receipt');}
  const copies=uniqueRows(rawCopies).filter(r=>r.sequence>first.damageCopy.sequence&&r.sequence<=last.damageCopy.sequence).sort((a,b)=>a.sequence-b.sequence);assert.equal(copies.length,last.damageCopy.sequence-first.damageCopy.sequence,'Damage copies cannot overflow or omit a source');for(let i=0;i<copies.length;i++){const r=copies[i];assert.equal(r.sequence,first.damageCopy.sequence+i+1);assert.equal(r.proofId,p.proofId);assert.equal(r.battleGeneration,p.battleGeneration);assert.ok(r.at>=first.simulationTime&&r.at<=last.simulationTime);assert.ok([p.targetId,p.partnerTargetId].includes(r.targetId));assert.equal(r.sourceId,r.targetId===p.targetId?p.fighterId:p.partnerId,'Cross-target companion or unknown source must fail');}
  const incoming=copies.filter(r=>r.targetId===p.targetId);
  for(const r of incoming){assert.equal(r.proofId,p.proofId);assert.equal(r.battleGeneration,p.battleGeneration);assert.equal(r.sourceId,p.fighterId,'No companion or unknown source may borrow this target HP delta');assert.equal(r.sourceKind,'futago');assert.ok(['normal-direct','cross-strike'].includes(r.mode));assert.ok(r.at>=first.simulationTime&&r.at<=last.simulationTime);assert.ok(r.appliedDamage>=0);assert.ok(Math.abs(r.beforeHp-r.afterHp-r.appliedDamage)<1e-7);}
  const damage=first.target.hp-last.target.hp,total=incoming.reduce((n,r)=>n+r.appliedDamage,0);assert.ok(Math.abs(damage-total)<1e-7,'All target HP loss must be accounted by actual postdamage copies');
  const normal=incoming.filter(r=>r.mode==='normal-direct'&&r.appliedDamage>0);
  const allImpacts=[...new Map(row.samples.flatMap(s=>s.completedAttackImpacts).map(r=>[[r.battleGeneration,r.sourceId,r.attackSequence,r.impactOrdinal].join(':'),r])).values()];
  const newNormalImpacts=allImpacts.filter(r=>r.sourceId===p.fighterId&&r.targetId===p.targetId&&r.attackSequence>first.fighter.attackSequence&&r.battleGeneration===p.battleGeneration&&r.contactAtBattleTime>=first.simulationTime&&r.contactAtBattleTime<=last.simulationTime);
  if(row.phase!=='move'){
    assert.equal(last.fighter.targetId,p.targetId);assert.equal(last.partner.targetId,p.partnerTargetId);
    assert.ok(damage>0&&normal.length>0);assert.ok(last.fighter.attackSequence>first.fighter.attackSequence);assert.ok(newNormalImpacts.length>0,'A new original normal attack/impact receipt must belong to this body');
    for(const r of normal){const real=newNormalImpacts.find(i=>i.attackSequence===r.attackSequence&&i.mode==='direct'&&i.audioRequestObserved===true&&i.sourceKind==='futago');assert.ok(real,'Raw damage copy must match the original completed normal receipt');}
  }
  return {sourceId:p.fighterId,targetId:p.targetId,partnerId:p.partnerId,pairId:owner.pairId,selectedPart:p.v100TwinPart,appliedDamage:damage,copiedDamage:total,normalImpactSequences:newNormalImpacts.map(r=>r.attackSequence),actualNewDraws:renders.length,scope:'Controlled original pair source attribution only; no campaign, naturalness, PTS, audio or whole-game acceptance'};
}

export function assertMayoFeralReceipt(row,definition) {
  const need=(c,m)=>{if(!c)throw new Error(m);},near=(a,b,m)=>need(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-8,m);
  need(definition.windupSeconds===.3&&definition.recoverySeconds===.16&&definition.activeSeconds===6.2&&definition.hpDrainPerSecond===7&&definition.cooldownSeconds===34&&definition.safeHpRatio===.2,'Original Mayo registry required');
  const p=row.proof,e=p.ownerEvidence,l=p.ledger,samples=[row.captureStart,...row.samples],first=samples[0],last=samples.at(-1);
  need(Number.isSafeInteger(p.proofGeneration)&&p.proofGeneration>0,'Real positive Mayo proof generation required');
  need(p.owner==='mayo-activation'&&p.kind==='mayo-chan'&&p.side==='human'&&p.renderKind==='mayo-chan-feral'&&!p.legacyFusedFixture&&p.phase===row.phase&&['move','attack','engage'].includes(row.phase),'Mayo-only lane');
  need(!p.failure&&!p.overflow&&!p.pending&&l.length>0&&l.length<=4096,'Incomplete Mayo tick evidence');
  need(e?.activationId===p.priorActivationId+1&&e.startReceipt?.ownerId===p.fighterId&&e.startReceipt.kind==='mayo-chan'&&e.startReceipt.eventType==='start'&&e.startReceipt.activationId===e.activationId,'Actual activation receipt missing');
  need(e.feralReceipt?.ownerId===p.fighterId&&e.feralReceipt.activationId===e.activationId&&e.feralReceipt.eventType==='feral-start'&&e.feralReceipt.kind==='mayo-chan','Actual feral-start receipt missing');
  const pointer=e.pointer;need(pointer?.events?.length===3&&pointer.events.every((r,i)=>r.type===['pointerdown','pointerup','click'][i]&&r.isTrusted===true&&r.fighterId===p.fighterId&&r.kind==='mayo-chan'),'Trusted native activation input missing');
  need(pointer.proofId===p.proofId&&pointer.proofGeneration===p.proofGeneration&&pointer.battleGeneration===p.battleGeneration,'Pointer owner mismatch');
  let prior=null,feralFirst=null;
  for(const r of l) {
    need(Number.isSafeInteger(r.tick)&&Number.isFinite(r.dt)&&r.dt>0&&r.to>r.from,'Invalid source tick');
    near(r.to-r.from,r.dt,'Source dt/time mismatch');need(r.before.kind==='mayo-chan'&&r.after.kind==='mayo-chan'&&r.before.activationId===e.activationId&&r.after.activationId===e.activationId,'Activation switched');near(r.maxHp,p.originalActorStats.maxHp,'Source maxHp changed');
    if(prior){need(r.tick===prior.tick+1,'Missing/duplicate source tick');near(r.from,prior.to,'Simulation gap');near(r.hpBefore,prior.hpAfter,'Unexplained incoming damage/heal');need(JSON.stringify(r.before)===JSON.stringify(prior.after),'Manual clock/state reset');}
    near(r.before.cooldownRemaining,0,'Original active cooldown changed');near(r.after.cooldownRemaining,0,'Original active cooldown changed');
    const expectedHp=r.before.phase==='feral'&&!r.retreatBefore?Math.max(Math.max(1,r.maxHp*definition.safeHpRatio),r.hpBefore-definition.hpDrainPerSecond*r.dt):r.hpBefore;
    near(r.hpAfter,expectedHp,'Actual self-drain differs from7HP/s');
    if(r.before.phase==='feral'){need(r.after.phase==='feral'&&r.after.activeRemaining>0&&!r.retreatAfter,'Active window expired; not an accepted clip');near(r.after.activeRemaining,r.before.activeRemaining-r.dt,'Feral clock reset/frozen');}
    else {
      need(['windup','recovery'].includes(r.before.phase),'Feral injection without original windup');
      const remaining=r.before.windupRemaining-r.dt;
      if(r.before.phase==='windup'&&remaining>0){need(r.after.phase==='windup','Windup bypass');near(r.after.windupRemaining,remaining,'Windup clock');}
      else if(r.before.phase==='windup'&&-remaining<definition.recoverySeconds){need(r.after.phase==='recovery','Original recovery bypass');near(r.after.windupRemaining,definition.recoverySeconds+remaining,'Recovery clock');}
      else if(r.before.phase==='recovery'&&remaining>0){need(r.after.phase==='recovery','Recovery bypass');near(r.after.windupRemaining,remaining,'Recovery clock');}
      else {need(r.after.phase==='feral','Real feral transition missing');const overflow=r.before.phase==='windup'?Math.max(0,-remaining-definition.recoverySeconds):Math.max(0,-remaining);near(r.after.activeRemaining,definition.activeSeconds-overflow,'Feral duration modified');if(!feralFirst)feralFirst=r;}
    }
    prior=r;
  }
  need(l[0].before.phase==='windup','Prefix from actual start must be retained');need(Number.isFinite(p.preparedAt)&&e.startReceipt.at>=p.preparedAt,'Stale activation before this proof');near(l[0].from,e.startReceipt.at,'Activation prefix gap');near(l[0].before.windupRemaining,definition.windupSeconds,'Original windup shortened');near(l[0].before.abilityElapsed,0,'Activation clock overwritten');near(l[0].before.activeRemaining,0,'Active window injected');near(l[0].hpBefore,p.originalActorStats.hp,'Original actor HP overwritten');
  need(feralFirst,'No actual windup/recovery-to-feral step');near(e.feralReceipt.at,feralFirst.to,'Feral-start simulation receipt mismatch');
  need(last.at>first.at&&last.simulationTime>first.simulationTime,'Native/simulation must both advance');
  for(const s of samples){
    need(s.proofId===p.proofId&&s.proofGeneration===p.proofGeneration&&s.battleGeneration===p.battleGeneration,'Sample lifecycle mismatch');
    need(s.running===true&&!s.paused&&s.visible===true,'Capture is not live/visible');
    const f=s.fighter,t=s.target;need(f?.id===p.fighterId&&f.kind==='mayo-chan'&&f.side==='human'&&f.renderKind==='mayo-chan-feral'&&f.manualAbilityPhase==='feral'&&!f.mayoRetreat&&f.activeRemaining>0,'Capture left real feral owner');
    for(const k of ['speed','laneSpeed','damage','range','attackEvery','maxHp'])need(f[k]===p.originalActorStats[k],'Actor stat changed:'+k);
    need(t?.id===p.targetId&&t.kind==='walker'&&t.side==='zombie'&&t.maxHp===1_000_000&&['speed','laneSpeed','damage'].every(k=>t[k]===0),'Inert target contract changed');
    const r=l.find(r=>r.tick===s.simulationTick);need(r,'Sample source tick missing');near(s.simulationTime,r.to,'Sample simulation clock');near(f.hp,r.hpAfter,'Sample HP not bound to actual source tick');near(f.activeRemaining,r.after.activeRemaining,'Sample activeRemaining mismatch');
  }
  const damage=first.target.hp-last.target.hp;need(damage>=0,'Target HP increased');
  if(row.phase!=='move'){need(damage>0&&last.fighter.attackSequence>first.fighter.attackSequence,'No new actual attack damage');need(samples.flatMap(s=>s.completedAttackImpacts??[]).some(r=>r.sourceId===p.fighterId&&r.targetId===p.targetId&&r.sourceKind==='mayo-chan'&&r.mode==='direct'&&r.audioRequestObserved===true&&Number.isSafeInteger(r.attackSequence)&&r.attackSequence>first.fighter.attackSequence&&r.attackSequence<=last.fighter.attackSequence&&r.battleGeneration===p.battleGeneration&&r.contactAtBattleTime>=first.simulationTime&&r.contactAtBattleTime<=last.simulationTime),'A new original Mayo normal impact receipt must belong to this activation');}
  return {owner:'mayo-activation',sourceId:p.fighterId,targetId:p.targetId,activationId:e.activationId,sourceRows:l.length,nativeSeconds:(last.at-first.at)/1000,simulationSeconds:last.simulationTime-first.simulationTime,observedSelfDrain:first.fighter.hp-last.fighter.hp,appliedDamage:damage,activeRemainingEnd:last.fighter.activeRemaining,originalSpeedAccepted:false,naturalnessAccepted:false,wholeGameAccepted:false};
}
