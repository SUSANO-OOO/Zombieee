import assert from 'node:assert/strict';
import {bossRenderKind} from '../app/bossFoundation.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';

// Use the spawned actor's stable part identity, never the observed texture, to
// select the expected art. V1 twins always spawn as two independent bodies.
export function v177EnemyRuntimeRenderIdentity({kind,renderKind,v100TwinPart=null}) {
  if(kind==='futago')assert.ok(['a','b'].includes(v100TwinPart),'V1 twin evidence requires its spawned part identity');
  else assert.equal(v100TwinPart,null,'only V1 twins may declare a twin part');
  const expectedRenderKind=bossRenderKind({kind,v100TwinPart});
  assert.equal(renderKind,expectedRenderKind,'the prepared render form must follow the spawned actor identity');
  return {renderKind:expectedRenderKind,v100TwinPart,expectedJointPath:V177_JOINT_ATLASES[expectedRenderKind]?.path??null};
}

// Pure evidence validation. This module never launches a browser or steps a pose.
export function assertV177EnemyLiveRender({kind,phase,fighterId,samples,renderKind=kind,v100TwinPart=null,expectedJointPath=null}) {
  const identity=v177EnemyRuntimeRenderIdentity({kind,renderKind,v100TwinPart});
  if(expectedJointPath)assert.equal(expectedJointPath,identity.expectedJointPath,'the expected joint texture must belong to the spawned render form');
  assert.ok(['move','attack'].includes(phase),'unsupported continuous enemy phase');
  assert.ok(Array.isArray(samples)&&samples.length>=5,'continuous evidence needs multiple native observations');
  for(let i=0;i<samples.length;i++){
    const s=samples[i];
    assert.ok(s.route.endsWith('/v100'),'continuous joint evidence must use the actual V1 route');
    assert.equal(s.visible,true,'the continuous page must stay visible');
    assert.equal(s.running,true,'the actual battle must remain running');
    assert.equal(s.paused,false,'a paused pose fixture cannot pass as live simulation');
    assert.ok(Number.isFinite(s.at)&&Number.isFinite(s.simulationTime),'native and simulation clocks must be finite');
    if(i){assert.ok(s.at>samples[i-1].at,'native observations must progress');assert.ok(s.simulationTime>=samples[i-1].simulationTime,'simulation cannot move backwards');}
    assert.equal(s.fighter?.id,fighterId,'the observed actor must be the prepared actor');
    assert.equal(s.fighter.kind,kind,'the observed actor must retain its kind');
    assert.equal(s.fighter.v100TwinPart??null,v100TwinPart,'the observed actor must retain its twin part');
    assert.equal(s.fighter.renderKind,identity.renderKind,'the observed render form must follow its actor identity');
    assert.ok(Number.isFinite(s.fighter.x)&&s.fighter.hp>0,'the live actor must remain finite and alive');
    assert.ok(s.renders.length>0,'native observations require actual draw receipts');
    for(const r of s.renders){
      assert.equal(r.renderKind,identity.renderKind,'each actual draw must retain the prepared render form');
      assert.ok(r.assetReady&&r.renderWidth>0&&r.renderHeight>0,'the native actor must actually draw its ready art');
      assert.ok([r.x,r.y,r.poseScaleX,r.poseScaleY,r.renderSequence].every(Number.isFinite),'actual draw geometry must be finite');
      if(expectedJointPath&&['start-move','move','stop','idle','wind-up','active','recovery'].includes(r.requestedState)){
        assert.equal(r.jointAtlasPath,expectedJointPath,'live V1 drawing must use the connected joint texture');
        assert.ok(Number.isInteger(r.jointLowerFrame)&&Number.isInteger(r.jointUpperFrame),'live joint draws require actual pose indices');
      }
    }
  }
  const first=samples[0],last=samples.at(-1),renders=samples.flatMap(s=>s.renders);
  assert.ok(last.at-first.at>=1000,'continuous evidence must cover at least one native second');
  assert.ok(last.simulationTime-first.simulationTime>=.5,'the real simulation must advance during capture');
  assert.ok(new Set(renders.map(r=>r.renderSequence)).size>=5,'actual rendering must progress throughout capture');
  if(phase==='move'){
    assert.ok(first.fighter.x-last.fighter.x>4,'the enemy must actually advance towards its target');
    assert.ok(renders.some(r=>r.actualXDelta<0&&['move','start-move'].includes(r.requestedState)),'walking requires real travel and a native locomotion draw');
  }else{
    assert.ok(samples.some(s=>s.fighter.attackSequence>0),'normal AI must produce a real attack');
    assert.ok(renders.some(r=>r.requestedState==='active'),'the actual attack must reach its native active drawing');
  }
  return {kind,phase,nativeSeconds:(last.at-first.at)/1000,simulationSeconds:last.simulationTime-first.simulationTime,actualXTravel:last.fighter.x-first.fighter.x,drawReceipts:new Set(renders.map(r=>r.renderSequence)).size,states:[...new Set(renders.map(r=>r.requestedState))],jointConnected:Boolean(expectedJointPath),expectedJointPath};
}
