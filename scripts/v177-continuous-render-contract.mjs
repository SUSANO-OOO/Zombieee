import assert from 'node:assert/strict';
import {v177AdditionalContinuousForms,v177ProofFormIdentity} from '../app/v177ContinuousProof.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
import {spriteKinds} from '../app/spriteManifest.js';
import {PLAYABLE_COMBAT_KINDS} from '../app/combatPresentation.js';
import {assertV177EnemyLiveRender} from './v177-enemy-live-render-contract.mjs';
export const V177_ADDITIONAL_CONTINUOUS_FORMS=v177AdditionalContinuousForms(spriteKinds,PLAYABLE_COMBAT_KINDS);
const proofCatalog={knownForms:spriteKinds,playableKinds:PLAYABLE_COMBAT_KINDS};

export function assertV177AuthoredLiveRender({form,phase,proof,samples}){
  const identity=v177ProofFormIdentity(form,proofCatalog),path=V177_JOINT_ATLASES[form]?.path;
  assert.ok(path,'every authored body must have its connected joint texture');
  assert.ok(['move','attack'].includes(phase));
  for(const key of ['kind','side','renderKind','v100TwinPart','legacyFusedFixture'])assert.equal(proof[key],identity[key],`prepared ${key} must retain the requested original body`);
  assert.equal(proof.phase,phase);assert.ok(Number.isFinite(proof.fighterId));
  assert.ok(Array.isArray(samples)&&samples.length>=5);
  const statKeys=['speed','laneSpeed','damage','range','attackEvery'];
  for(const key of statKeys)assert.ok(Number.isFinite(proof.originalActorStats[key]));
  for(let i=0;i<samples.length;i++){
    const s=samples[i],f=s.fighter;
    assert.ok(s.route.endsWith('/v100'));assert.equal(s.visible,true);assert.equal(s.running,true);assert.equal(s.paused,false);
    assert.ok(Number.isFinite(s.at)&&Number.isFinite(s.simulationTime));
    if(i){assert.ok(s.at>samples[i-1].at);assert.ok(s.simulationTime>=samples[i-1].simulationTime);}
    assert.equal(f?.id,proof.fighterId);assert.equal(f.kind,identity.kind);assert.equal(f.side,identity.side);
    assert.equal(f.renderKind,form);assert.equal(f.v100TwinPart??null,identity.v100TwinPart);
    assert.ok(Number.isFinite(f.x)&&f.hp>0);
    for(const key of statKeys)assert.equal(f[key],proof.originalActorStats[key],`${form}: original ${key} must remain in use`);
    if(form==='mayo-chan-feral')assert.equal(f.manualAbilityPhase,'feral');
    assert.ok(s.renders.length>0);
    for(const r of s.renders){
      assert.equal(r.renderKind,form,'actual draw identity must match the requested original body');
      assert.ok(r.assetReady&&r.renderWidth>0&&r.renderHeight>0);
      assert.ok([r.x,r.y,r.poseScaleX,r.poseScaleY,r.renderSequence].every(Number.isFinite));
      assert.equal(r.jointAtlasPath,path,'actual live art must use this body’s connected texture');
      assert.ok(Number.isInteger(r.jointLowerFrame)&&Number.isInteger(r.jointUpperFrame));
      if(['wind-up','active','recovery'].includes(r.requestedState))assert.ok(Number.isFinite(r.renderedWeaponSocket?.x)&&Number.isFinite(r.renderedWeaponSocket?.y),'live attack origin must follow the drawn weapon or mouth');
    }
  }
  const first=samples[0],last=samples.at(-1),renders=samples.flatMap(s=>s.renders),sign=identity.side==='human'?1:-1;
  assert.ok(last.at-first.at>=1000);assert.ok(last.simulationTime-first.simulationTime>=.5);
  assert.ok(new Set(renders.map(r=>r.renderSequence)).size>=5,'native draw receipts must advance');
  if(phase==='move'){
    assert.ok((last.fighter.x-first.fighter.x)*sign>4,'the original actor must actually advance towards its target');
    const walking=renders.filter(r=>['start-move','move'].includes(r.requestedState));
    assert.ok(walking.some(r=>r.actualXDelta*sign>0));
    assert.ok(new Set(walking.map(r=>r.jointLowerFrame)).size>1,'the feet must advance through the actual-distance gait');
    for(const r of walking){assert.equal(r.poseScaleX,1);assert.equal(r.poseScaleY,1);}
  }else{
    assert.ok(samples.some(s=>s.fighter.attackSequence>0),'normal AI must perform a real attack');
    assert.ok(renders.some(r=>r.requestedState==='active'));
    assert.ok(new Set(renders.map(r=>r.jointUpperFrame)).size>1,'the attack rig must advance through its motion');
  }
  return {form,phase,kind:identity.kind,side:identity.side,legacyFusedFixture:identity.legacyFusedFixture,
    nativeSeconds:(last.at-first.at)/1000,simulationSeconds:last.simulationTime-first.simulationTime,
    actualXTravel:last.fighter.x-first.fighter.x,drawReceipts:new Set(renders.map(r=>r.renderSequence)).size,
    expectedJointPath:path,states:[...new Set(renders.map(r=>r.requestedState))]};
}

export function assertV177ContinuousFormCoverage(baseEnemies,additional){
  const enemyKinds=spriteKinds.filter(kind=>!PLAYABLE_COMBAT_KINDS.includes(kind)&&kind!=='mayo-chan-feral'&&!kind.startsWith('futago-separated-'));
  assert.equal(baseEnemies.length,enemyKinds.length*2);assert.equal(additional.length,V177_ADDITIONAL_CONTINUOUS_FORMS.length*2);
  for(const kind of enemyKinds)for(const phase of ['move','attack'])assert.equal(baseEnemies.filter(e=>e.kind===kind&&e.phase===phase).length,1);
  for(const form of V177_ADDITIONAL_CONTINUOUS_FORMS)for(const phase of ['move','attack'])assert.equal(additional.filter(e=>e.form===form&&e.phase===phase).length,1);
  for(const e of baseEnemies){assert.equal(e.status,'passed');assertV177EnemyLiveRender({...e,fighterId:e.proof.fighterId});}
  for(const e of additional){assert.equal(e.status,'passed');assertV177AuthoredLiveRender(e);}
  const observed=new Set([...baseEnemies.map(e=>`${e.renderKind}/${e.phase}`),...additional.map(e=>`${e.form}/${e.phase}`)]);
  for(const form of spriteKinds)for(const phase of ['move','attack'])assert.ok(observed.has(`${form}/${phase}`),`missing continuous ${form}/${phase}`);
  return {forms:spriteKinds.length,phases:baseEnemies.length+additional.length,baseEnemyPhases:baseEnemies.length,
    additionalPhases:additional.length,allActionsAcceptance:false,normalPlayAcceptance:false};
}
