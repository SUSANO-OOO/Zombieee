import assert from 'node:assert/strict';
import {spriteKinds,spriteFrameFor} from '../app/spriteManifest.js';
import {animationClipFor,PLAYABLE_COMBAT_KINDS} from '../app/combatPresentation.js';
import {v177ProofFormIdentity} from '../app/v177ContinuousProof.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
import {renderedSourcePixelScale} from './v102-render-source-scale.mjs';
import {v102CorpseFallingPose,v102HasFallingDeathFrame} from '../app/v102CorpsePose.js';
import {V177_CORPSE_JOINT_DATA} from '../app/v177CorpseJointData.js';

const transform=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
export function assertJointCorpsePaint(form,receipt,corpse,wound,settled=false){
  const atlas=V177_JOINT_ATLASES[form],data=V177_CORPSE_JOINT_DATA[form],reference=atlas.referenceFrame;
  assert.equal(receipt.corpseJointPose,true);assert.equal(receipt.corpsePoseSourceBound,true);
  assert.equal(receipt.corpsePoseSourceSha256,data.atlasSha256);assert.equal(receipt.spritePath,data.atlasPath);
  const owned=wound?.severed?data.severedParts[wound.style==='cut'||wound.style==='saw'?'head':'impact']:[];
  assert.deepEqual(receipt.corpseJointOwnedParts,owned);
  const body=receipt.corpseJointParts,fragment=receipt.corpseJointFragmentParts;
  assert.ok(Array.isArray(body)&&Array.isArray(fragment));
  assert.deepEqual(body.map(p=>p.name),atlas.parts.filter(p=>!owned.includes(p.name)).map(p=>p.name));
  assert.deepEqual(fragment.map(p=>p.name),atlas.parts.filter(p=>owned.includes(p.name)).map(p=>p.name));
  const all=[...body,...fragment];assert.equal(all.length,atlas.parts.length);assert.equal(new Set(all.map(p=>p.name)).size,all.length);
  for(const p of all){
    const original=atlas.parts.find(a=>a.name===p.name);assert.deepEqual(p.sourceRect,original.source);
    assert.equal(p.matrix.length,6);assert.ok(p.matrix.every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(p.matrix[0],p.matrix[1])-1)<.001);assert.ok(Math.abs(Math.hypot(p.matrix[2],p.matrix[3])-1)<.001);
    assert.ok(Math.abs(p.matrix[0]*p.matrix[2]+p.matrix[1]*p.matrix[3])<.001,'a corpse part cannot shear');
  }
  const root=receipt.corpseJointRoot,m=receipt.corpseJointRootMatrix;
  assert.ok(root&&m?.length===6&&m.every(Number.isFinite));assert.equal(root.angle,receipt.rotationRadians);
  const c=Math.cos(root.angle),s=Math.sin(root.angle),sx=root.scaleX*(root.flipX?-1:1);
  const expected=[c*sx,s*sx,-s*root.scaleY,c*root.scaleY,root.x,root.y];
  for(let i=0;i<6;i++)assert.ok(Math.abs(m[i]-expected[i])<1e-8,'the recorded root must be the actual applied transform');
  assert.equal(root.flipX,receipt.frameFlipX);
  const anchor=receipt.corpseJointAnchor;assert.ok(anchor&&Number.isFinite(anchor.x)&&Number.isFinite(anchor.y));
  function support(parts,matrix){
    assert.equal(matrix?.length,6);assert.ok(matrix.every(Number.isFinite));let max=-Infinity;
    for(const part of parts){const shape=data.outlines.find(p=>p.name===part.name);
      for(const p of shape.hull){const q=transform(part.matrix,p),local=[(q[0]-reference.tx)/reference.scale/reference.width*receipt.renderWidth-anchor.x*receipt.renderWidth,
        (q[1]-reference.ty)/reference.scale/reference.height*receipt.renderHeight-anchor.y*receipt.renderHeight];max=Math.max(max,transform(matrix,local)[1]);}
    }
    return max-(receipt.y+5);
  }
  const floorError=support(body,m);assert.ok(floorError<=1e-8,'the owned body paint must not sink below its actual floor');
  assert.ok(Math.abs(floorError-receipt.corpseGroundOffsetY-receipt.corpseGroundSupportY)<1e-8);
  if(fragment.length){
    const error=support(fragment,receipt.corpseJointFragmentMatrix);
    assert.ok(error<=1e-8);assert.ok(Math.abs(error-receipt.corpseJointFragmentGroundError)<1e-8);
    if(settled)assert.ok(Math.abs(error)<1e-8,'the detached owned source must actually land');
  }else{assert.equal(receipt.corpseJointFragmentMatrix,null);assert.equal(receipt.corpseJointFragmentGroundError,null);}
  const bones=new Map(body.map(p=>[atlas.parts.find(a=>a.name===p.name).bone,p.matrix]));
  const tubeAttachment=atlas.parentAttachments?.['back-tubes'],tube=bones.get('back-tubes'),tubeParent=bones.get(tubeAttachment?.parent);
  if(tube&&tubeParent){
    const a=transform(tube,tubeAttachment.pivot),b=transform(tubeParent,tubeAttachment.pivot);
    assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])/reference.scale<=.001,'the folded tube must retain its original spine attachment');
  }
  for(const chain of [...(atlas.armConstraints??[]),...(atlas.legConstraints??[])]){
    const parent=bones.get(chain.parentBone),upper=bones.get(chain.upperBone),lower=bones.get(chain.lowerBone),effector=bones.get(chain.effectorBone);
    if(!parent||!upper||!lower)continue;
    const pairs=[[transform(parent,chain.hip??chain.shoulder),transform(upper,chain.hip??chain.shoulder)],
      [transform(upper,chain.knee??chain.elbow),transform(lower,chain.knee??chain.elbow)]];
    if(effector)pairs.push([transform(lower,chain.ankle??chain.wrist),transform(effector,chain.effectorWrist??chain.ankle??chain.wrist)]);
    for(const [a,b]of pairs)assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])/reference.scale<=.001,'an unsevered rendered joint must remain connected');
  }
  if(settled){assert.equal(receipt.corpsePoseProgress,1);assert.ok(Math.abs(floorError)<1e-8);
    assert.ok(Math.abs(receipt.rotationRadians-(corpse.variant%2===0?-1:1)*Math.PI/2)<1e-8);}
}

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
    const lastLive=body.renderHistory.at(-1)??paint;
    const jointOwner=Boolean(V177_CORPSE_JOINT_DATA[form]&&lastLive.jointAtlasPath===V177_JOINT_ATLASES[form].path);
    for(const r of body.corpseRenderHistory){
      assert.equal(r.renderKind,form,'actual corpse drawing must retain the original body');
      assert.equal(Boolean(r.corpseJointPose),jointOwner,'the last actually painted rig must own the corpse handoff');
      if(jointOwner)assertJointCorpsePaint(form,r,body.corpse,wounds[0]);
      else{assert.equal(r.spritePath,frame.path);assert.deepEqual(r.sourceRect,frame.sourceRect);}
      assert.ok(r.assetReady);
      assert.ok(r.renderSequence>paint.renderSequence);
      assert.ok(Math.abs(renderedSourcePixelScale(r)-pixelScale)<1e-8,'defeat keeps the same source-pixel scale');
      assert.ok(Number.isFinite(r.fallProgress)&&r.fallProgress>=0&&r.fallProgress<=1&&Number.isFinite(r.rotationRadians));
    }
    assert.equal(new Set(body.corpseRenderHistory.map(r=>r.renderSequence)).size,body.corpseRenderHistory.length);
    if(identity.side==='human'&&frame.derivedFrom==='hit')assert.ok(body.corpseRenderHistory.some(r=>r.fallProgress>0&&r.fallProgress<1),'a fallback ally body must actually paint the intermediate fall');
    if(v102HasFallingDeathFrame(form,frame)){
      assert.ok(body.corpseRenderHistory.some(r=>r.corpsePoseProgress>0&&r.corpsePoseProgress<1),'a falling boss key must paint its intermediate collapse');
      for(const r of body.corpseRenderHistory)assert.equal(r.corpsePoseSourceBound,true,'the falling pose must use its exact original source outline');
    }
    assert.equal(late.body.fighter,null);assert.equal(late.body.corpse?.id,proof.fighterId);
    assert.equal(late.body.corpse.kind,identity.kind);assert.equal(late.body.corpse.side,identity.side);
    assert.equal(late.body.corpse.v100TwinPart??null,identity.v100TwinPart);
    assert.ok(late.body.corpse.deathAge>=animationClipFor(form,'death').durationSeconds);
    const settled=late.body.corpseRenderHistory.slice(-3);assert.equal(settled.length,3);
    for(const r of settled){
      assert.equal(r.renderKind,form);assert.equal(Boolean(r.corpseJointPose),jointOwner);
      if(jointOwner)assertJointCorpsePaint(form,r,late.body.corpse,wounds[0],true);
      else{assert.equal(r.spritePath,frame.path);assert.deepEqual(r.sourceRect,frame.sourceRect);}
      assert.ok(r.assetReady);
      assert.equal(r.fallProgress,1);assert.ok(Number.isFinite(r.rotationRadians));
      assert.ok(r.renderSequence>body.corpseRenderHistory.at(-1).renderSequence,'settled body must be painted again after the early outcome');
      assert.ok(Math.abs(renderedSourcePixelScale(r)-pixelScale)<1e-8);
      if(!jointOwner&&v102HasFallingDeathFrame(form,frame)){
        const direction=late.body.corpse.variant%2===0?-1:1;
        const expected=v102CorpseFallingPose(form,frame,r.renderWidth,r.renderHeight,direction,1);
        assert.equal(r.corpsePoseSourceBound,true);assert.equal(r.corpsePoseSourceSha256,expected.sourceSha256);
        assert.equal(r.corpsePoseProgress,1);
        assert.ok(Math.abs(r.rotationRadians-expected.rotationRadians)<1e-8,'the completed boss must not stay in its mid-fall key');
        assert.ok(Number.isFinite(r.corpseGroundOffsetY)&&Number.isFinite(r.corpseGroundSupportY));
        assert.ok(Math.abs(r.corpseGroundOffsetY+r.corpseGroundSupportY)<1e-8,'the actual completed outline must reach the floor without sinking');
      }
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
