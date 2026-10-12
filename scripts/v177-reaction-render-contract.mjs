import assert from 'node:assert/strict';
import {spriteKinds,spriteFrameFor} from '../app/spriteManifest.js';
import {PLAYABLE_COMBAT_KINDS} from '../app/combatPresentation.js';
import {v177ProofFormIdentity} from '../app/v177ContinuousProof.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
import {renderedSourcePixelScale} from './v102-render-source-scale.mjs';

export function assertV177ReactionRender({form,proof,before,after}){
  const identity=v177ProofFormIdentity(form,{knownForms:spriteKinds,playableKinds:PLAYABLE_COMBAT_KINDS});
  for(const key of ['kind','side','renderKind','v100TwinPart','legacyFusedFixture'])assert.equal(proof[key],identity[key]);
  assert.equal(proof.phase,'defeat');assert.ok(Number.isFinite(proof.fighterId));
  for(const observation of [before,after]){
    assert.ok(observation.route.endsWith('/v100'));assert.equal(observation.visible,true);
    assert.equal(observation.running,true);assert.equal(observation.paused,true,'only the initial and final painted outcome are held');
    assert.ok(Number.isFinite(observation.at)&&Number.isFinite(observation.simulationTime));
  }
  assert.ok(after.at>before.at&&after.simulationTime>before.simulationTime,'real damage must advance the native simulation');
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
    }
    assert.equal(new Set(body.corpseRenderHistory.map(r=>r.renderSequence)).size,body.corpseRenderHistory.length);
  }
  return {form,outcome:proof.outcome,nativeSeconds:(after.at-before.at)/1000,
    simulationSeconds:after.simulationTime-before.simulationTime,pixelScale,originalSpeedNaturalnessAcceptance:false,normalPlayAcceptance:false};
}

export function assertV177ReactionCoverage(evidence){
  assert.equal(evidence.length,spriteKinds.length);
  for(const form of spriteKinds){
    const entries=evidence.filter(e=>e.form===form);assert.equal(entries.length,1,`one real damage outcome required for ${form}`);
    assert.equal(entries[0].status,'passed');assertV177ReactionRender(entries[0]);
  }
  return {forms:48,corpses:46,protectedRetreats:2,allActionsAcceptance:false,normalPlayAcceptance:false};
}
