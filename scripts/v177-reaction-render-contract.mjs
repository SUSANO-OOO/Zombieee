import assert from 'node:assert/strict';
import {spriteKinds,spriteFrameFor} from '../app/spriteManifest.js';
import {animationClipFor,PLAYABLE_COMBAT_KINDS} from '../app/combatPresentation.js';
import {v177ProofFormIdentity} from '../app/v177ContinuousProof.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
import {renderedSourcePixelScale} from './v102-render-source-scale.mjs';

export function assertV177ReactionRender({form,proof,before,after,late}){
  const identity=v177ProofFormIdentity(form,{knownForms:spriteKinds,playableKinds:PLAYABLE_COMBAT_KINDS});
  for(const key of ['kind','side','renderKind','v100TwinPart','legacyFusedFixture'])assert.equal(proof[key],identity[key]);
  assert.equal(proof.phase,'defeat');assert.ok(Number.isFinite(proof.fighterId));
  assert.ok(late,'the reaction must include its real settled or completed outcome');
  for(const observation of [before,after,late]){
    assert.ok(observation.route.endsWith('/v100'));assert.equal(observation.visible,true);
    assert.equal(observation.running,true);assert.equal(observation.paused,true,'only the initial and final painted outcome are held');
    assert.ok(Number.isFinite(observation.at)&&Number.isFinite(observation.simulationTime));
  }
  assert.ok(after.at>before.at&&after.simulationTime>before.simulationTime,'real damage must advance the native simulation');
  assert.ok(late.at>after.at&&late.simulationTime>after.simulationTime,'the late outcome must advance beyond the first reaction paint');
  const living=before.body.fighter,paint=before.body.renderHistory.at(-1);
  assert.equal(living?.id,proof.fighterId);assert.equal(living.kind,identity.kind);assert.equal(living.side,identity.side);
  assert.equal(living.renderKind,form);assert.equal(living.v100TwinPart??null,identity.v100TwinPart);
  assert.equal(living.hp,proof.originalActorStats.hp,'initial native paint must precede actual damage');
  assert.ok(living.hp>0&&paint?.assetReady);assert.equal(paint.renderKind,form);
  const pixelScale=renderedSourcePixelScale(paint),body=after.body;
  const impacts=after.effects.impacts.filter(e=>e.targetId===proof.fighterId);
  const wounds=after.effects.wounds.filter(e=>e.targetId===proof.fighterId);
  if(identity.kind==='mayo-chan'){
    assert.equal(proof.outcome,'retreat');assert.equal(body.corpse,null);assert.equal(body.corpseRenderHistory.length,0);
    assert.equal(impacts.length,0);assert.equal(wounds.length,0);
    assert.equal(after.effects.pools.filter(e=>e.targetId===proof.fighterId).length,0,'Mayo must not leave a blood pool');
    assert.equal(body.fighter?.id,proof.fighterId);assert.equal(body.fighter.kind,'mayo-chan');
    assert.equal(body.fighter.renderKind,form);assert.equal(body.fighter.mayoRetreat?.reason,'injury');
    assert.equal(body.fighter.mayoRetreat?.phase,'run');assert.ok(body.fighter.hp>0&&body.fighter.hp<living.hp);
    assert.ok(body.fighter.x<living.x-20,'the dedicated retreat must actually move toward the vehicle');
    for(const r of body.renderHistory){assert.equal(r.renderKind,form);assert.ok(r.assetReady);}
    for(const state of ['death','hit','retreat'])assert.ok(body.renderHistory.some(r=>r.requestedState===state),`Mayo actual ${state} must be painted`);
    const running=body.renderHistory.filter(r=>r.requestedState==='retreat');
    assert.ok(running.length>=2);assert.ok(new Set(running.map(r=>r.jointLowerFrame)).size>1,'retreat feet must advance through the real gait');
    for(const r of running){
      assert.equal(r.jointAtlasPath,V177_JOINT_ATLASES[form].path);assert.equal(r.poseScaleX,1);assert.equal(r.poseScaleY,1);
      assert.ok(Math.abs(renderedSourcePixelScale(r)-pixelScale)<1e-8,'retreat keeps the same source-pixel scale');
    }
    assert.equal(late.body.fighter,null);assert.equal(late.body.corpse,null);assert.equal(late.body.corpseRenderHistory.length,0);
    for(const category of ['impacts','wounds','pools'])assert.equal(late.effects[category].filter(e=>e.targetId===proof.fighterId).length,0);
    const completed=(late.receipts??[]).filter(r=>r.ownerId===proof.fighterId&&r.kind==='mayo-chan'&&r.eventType==='retreat-complete');
    assert.equal(completed.length,1,'one original-owner retreat must actually finish');
    assert.equal(completed[0].mode,'injury');
    assert.ok(Number.isFinite(completed[0].at)&&completed[0].at>=after.simulationTime&&completed[0].at<=late.simulationTime);
    assert.ok(Number.isFinite(completed[0].x)&&Number.isFinite(completed[0].baseX));assert.equal(completed[0].x,completed[0].baseX);
    for(const r of late.body.renderHistory){assert.equal(r.renderKind,form);assert.ok(r.assetReady);}
    const finalRun=late.body.renderHistory.at(-1);
    assert.equal(finalRun.requestedState,'retreat');assert.ok(finalRun.renderSequence>running.at(-1).renderSequence);
    assert.ok(Math.abs(renderedSourcePixelScale(finalRun)-pixelScale)<1e-8);
  }else{
    assert.equal(proof.outcome,'corpse');assert.equal(body.fighter,null);
    assert.equal(body.corpse?.id,proof.fighterId);assert.equal(body.corpse.kind,identity.kind);assert.equal(body.corpse.side,identity.side);
    assert.equal(body.corpse.v100TwinPart??null,identity.v100TwinPart);
    assert.equal(impacts.length,1,'one applied lethal hit must produce one impact');assert.equal(wounds.length,1);assert.equal(wounds[0].lethal,true);
    assert.ok(body.corpseRenderHistory.length>=3,'the actual corpse must be painted repeatedly');
    const frame=spriteFrameFor(form,'death',identity.side==='human'?'right':'left');
    for(const r of body.corpseRenderHistory){
      assert.equal(r.renderKind,form,'actual corpse drawing must retain the original body');
      assert.equal(r.spritePath,frame.path);assert.deepEqual(r.sourceRect,frame.sourceRect);assert.ok(r.assetReady);
      assert.ok(r.renderSequence>paint.renderSequence);
      assert.ok(Math.abs(renderedSourcePixelScale(r)-pixelScale)<1e-8,'defeat keeps the same source-pixel scale');
      assert.ok(Number.isFinite(r.fallProgress)&&r.fallProgress>=0&&r.fallProgress<=1&&Number.isFinite(r.rotationRadians));
    }
    assert.equal(new Set(body.corpseRenderHistory.map(r=>r.renderSequence)).size,body.corpseRenderHistory.length);
    if(identity.side==='human'&&frame.derivedFrom==='hit')assert.ok(body.corpseRenderHistory.some(r=>r.fallProgress>0&&r.fallProgress<1),'a fallback ally body must actually paint the intermediate fall');
    assert.equal(late.body.fighter,null);assert.equal(late.body.corpse?.id,proof.fighterId);
    assert.equal(late.body.corpse.kind,identity.kind);assert.equal(late.body.corpse.side,identity.side);
    assert.equal(late.body.corpse.v100TwinPart??null,identity.v100TwinPart);
    assert.ok(late.body.corpse.deathAge>=animationClipFor(form,'death').durationSeconds);
    const settled=late.body.corpseRenderHistory.slice(-3);assert.equal(settled.length,3);
    for(const r of settled){
      assert.equal(r.renderKind,form);assert.equal(r.spritePath,frame.path);assert.deepEqual(r.sourceRect,frame.sourceRect);assert.ok(r.assetReady);
      assert.equal(r.fallProgress,1);assert.ok(Number.isFinite(r.rotationRadians));
      assert.ok(r.renderSequence>body.corpseRenderHistory.at(-1).renderSequence,'settled body must be painted again after the early outcome');
      assert.ok(Math.abs(renderedSourcePixelScale(r)-pixelScale)<1e-8);
    }
  }
  return {form,outcome:proof.outcome,nativeSeconds:(after.at-before.at)/1000,
    simulationSeconds:after.simulationTime-before.simulationTime,lateNativeSeconds:(late.at-after.at)/1000,
    lateSimulationSeconds:late.simulationTime-after.simulationTime,pixelScale,originalSpeedNaturalnessAcceptance:false,normalPlayAcceptance:false};
}

export function assertV177ReactionCoverage(evidence){
  assert.equal(evidence.length,spriteKinds.length);
  for(const form of spriteKinds){
    const entries=evidence.filter(e=>e.form===form);assert.equal(entries.length,1,`one real damage outcome required for ${form}`);
    assert.equal(entries[0].status,'passed');assertV177ReactionRender(entries[0]);
  }
  return {forms:48,corpses:46,protectedRetreats:2,allActionsAcceptance:false,normalPlayAcceptance:false};
}
