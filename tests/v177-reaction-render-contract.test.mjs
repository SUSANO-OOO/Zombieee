import test from 'node:test';
import assert from 'node:assert/strict';
import {assertV177ReactionRender,assertV177ReactionCoverage} from '../scripts/v177-reaction-render-contract.mjs';
import {spriteKinds,spriteFrameFor} from '../app/spriteManifest.js';
import {PLAYABLE_COMBAT_KINDS} from '../app/combatPresentation.js';
import {v177ProofFormIdentity} from '../app/v177ContinuousProof.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
import {v102CorpseFallingPose} from '../app/v102CorpsePose.js';
import {V177_CORPSE_JOINT_DATA} from '../app/v177CorpseJointData.js';
import {jointCorpseRenderFixture} from './helpers/v177-corpse-joint-render.mjs';
const fixture=(form,{style=null}={})=>{
  const identity=v177ProofFormIdentity(form,{knownForms:spriteKinds,playableKinds:PLAYABLE_COMBAT_KINDS});
  const protectedBody=identity.kind==='mayo-chan',direction=identity.side==='human'?'right':'left';
  const jointFixture=V177_CORPSE_JOINT_DATA[form]?jointCorpseRenderFixture(form,{kind:identity.kind,style}):null;
  const paint=(state,sequence)=>{
    if(state==='death'&&jointFixture)return jointFixture.render(sequence>=20?1:.2,sequence).receipt;
    const frame=spriteFrameFor(form,state==='retreat'?'walk-a':state,direction);
    const fallProgress=state==='death'?(sequence>=20?1:.2):undefined;
    const pose=state==='death'?v102CorpseFallingPose(form,frame,frame.sourceRect.w*.2,frame.sourceRect.h*.2,-1,fallProgress):null;
    return {renderKind:form,spritePath:frame.path,assetReady:true,renderSequence:sequence,requestedState:state,
      sourceRect:{...frame.sourceRect},sourceRow:frame.sourceRect.y,renderWidth:frame.sourceRect.w*.2,renderHeight:frame.sourceRect.h*.2,
      jointAtlasPath:V177_JOINT_ATLASES[form].path,jointLowerFrame:sequence,poseScaleX:1,poseScaleY:1,
      x:500,y:285,fallProgress,rotationRadians:pose?.rotationRadians??(state==='death'&&frame.derivedFrom==='hit'?.2:0),
      corpsePoseSourceBound:pose?.sourceBound,corpsePoseSourceSha256:pose?.sourceSha256,corpsePoseProgress:pose?.poseProgress,
      corpseGroundOffsetY:pose?.groundOffsetY,corpseGroundSupportY:pose?.groundSupportY};
  };
  const live=paint('idle',1),fighter={id:7,kind:identity.kind,side:identity.side,renderKind:form,v100TwinPart:identity.v100TwinPart,hp:150,x:500};
  const empty={impacts:[],pools:[],wounds:[],pending:false};
  const before={at:10,simulationTime:4,running:true,paused:true,route:'/v100',visible:true,
    body:{fighter,corpse:null,renderHistory:[live],corpseRenderHistory:[]},effects:empty};
  const body=protectedBody
    ? {fighter:{...fighter,hp:1,x:450,mayoRetreat:{reason:'injury',phase:'run',renderKind:form}},corpse:null,
      renderHistory:[live,paint('death',2),paint('hit',3),paint('retreat',4),paint('retreat',5)],corpseRenderHistory:[]}
    : {fighter:null,corpse:{id:7,kind:identity.kind,side:identity.side,v100TwinPart:identity.v100TwinPart,deathAge:.05,variant:0},renderHistory:[live],
      corpseRenderHistory:[paint('death',10),paint('death',11),paint('death',12)]};
  const after={at:1000,simulationTime:5,running:true,paused:true,route:'/v100',visible:true,body,
    effects:protectedBody?empty:jointFixture?jointFixture.effects():{impacts:[{targetId:7,lethal:true}],pools:[{targetId:7}],wounds:[{targetId:7,lethal:true}],pending:false}};
  const late=structuredClone(after);late.at=2000;late.simulationTime=6;
  if(protectedBody){
    late.body.fighter=null;
    late.body.renderHistory.push(paint('retreat',6),paint('retreat',7));
    late.receipts=[{ownerId:7,kind:'mayo-chan',eventType:'retreat-complete',at:5.9,mode:'injury',x:100,baseX:100}];
  }else{
    late.body.corpse.deathAge=.6;
    late.body.corpseRenderHistory.push(...[20,21,22].map(sequence=>({...paint('death',sequence),fallProgress:1})));
  }
  return {form,proof:{fighterId:7,...identity,phase:'defeat',outcome:protectedBody?'retreat':'corpse',originalActorStats:{hp:150}},before,after,late,status:'passed'};
};

test('native reaction coverage distinguishes the actual46 corpses from the two protected retreat forms',()=>{
  const all=spriteKinds.map(fixture);
  for(const evidence of all)assert.equal(assertV177ReactionRender(evidence).form,evidence.form);
  assert.deepEqual(assertV177ReactionCoverage(all),{forms:48,corpses:46,protectedRetreats:2,allActionsAcceptance:false,normalPlayAcceptance:false});
});

test('wrong corpse bodies, fake outcomes, missing damage and stale paints cannot pass the native reaction contract',()=>{
  for(const mutate of [e=>{e.after.simulationTime=e.before.simulationTime;},e=>{e.before.body.fighter.hp=0;},
    e=>{e.after.body.corpse.id=9;},e=>{e.after.body.corpseRenderHistory=[];},e=>{e.after.effects.impacts=[];},
    e=>{e.after.body.corpseRenderHistory[1].renderKind='runner';},e=>{e.after.body.corpseRenderHistory[1].spritePath='wrong.png';},
    e=>{e.after.body.corpseRenderHistory[1].renderWidth*=1.2;},e=>{e.after.body.corpseRenderHistory[1].assetReady=false;},
    e=>{e.after.body.corpseRenderHistory[1].renderSequence=1;}]){
    const evidence=fixture('walker');mutate(evidence);assert.throws(()=>assertV177ReactionRender(evidence));
  }
  const twin=fixture('futago-separated-b');twin.after.body.corpse.v100TwinPart='a';assert.throws(()=>assertV177ReactionRender(twin));
});

test('retreat form swaps, blood, frozen paws and missing phases or coverage cannot pass as whole-body reaction proof',()=>{
  for(const mutate of [e=>{e.after.body.fighter.renderKind='mayo-chan';},e=>{e.after.effects=structuredClone(e.after.effects);e.after.effects.pools=[{targetId:7}];},
    e=>{e.after.body.corpse={id:7};},e=>{e.after.body.fighter.x=500;},
    e=>{e.after.body.renderHistory=e.after.body.renderHistory.filter(r=>r.requestedState!=='hit');},
    e=>{for(const r of e.after.body.renderHistory)r.jointLowerFrame=1;}]){
    const evidence=fixture('mayo-chan-feral');mutate(evidence);assert.throws(()=>assertV177ReactionRender(evidence));
  }
  const all=spriteKinds.map(fixture);assert.throws(()=>assertV177ReactionCoverage(all.slice(1)));
  const duplicate=all.slice();duplicate[0]=duplicate[1];assert.throws(()=>assertV177ReactionCoverage(duplicate));
});

test('an early corpse alone, an instant fallback fall, or a stale or unfinished late paint cannot pass the full reaction',()=>{
  for(const mutate of [e=>{delete e.late;},e=>{e.late.simulationTime=e.after.simulationTime;},
    e=>{e.late.body.corpse.kind='runner';},e=>{for(const r of e.late.body.corpseRenderHistory)r.fallProgress=.2;},
    e=>{e.late.body.corpseRenderHistory=e.after.body.corpseRenderHistory;},
    e=>{e.late.body.corpseRenderHistory.at(-1).rotationRadians=NaN;},
    e=>{for(const r of e.after.body.corpseRenderHistory)r.fallProgress=1;}]){
    const evidence=fixture('brawler');mutate(evidence);assert.throws(()=>assertV177ReactionRender(evidence));
  }
});

test('Mayo retreat must finish once at its real vehicle destination without a late corpse, blood or identity swap',()=>{
  for(const mutate of [e=>{e.late.receipts=[];},e=>{e.late.receipts[0].ownerId=99;},
    e=>{e.late.body.fighter=e.after.body.fighter;},e=>{e.late.body.corpse={id:7};},
    e=>{e.late.effects.pools=[{targetId:7}];},e=>{e.late.body.renderHistory.at(-1).renderKind='mayo-chan';},
    e=>{e.late.receipts[0].x=110;},e=>{e.late.receipts.push({...e.late.receipts[0]});}]){
    const evidence=fixture('mayo-chan-feral');mutate(evidence);assert.throws(()=>assertV177ReactionRender(evidence));
  }
});

test('a mid-fall boss source key cannot pass a completed corpse without source-bound floor contact',()=>{
  for(const mutate of [e=>{for(const r of e.late.body.corpseRenderHistory)r.rotationRadians=0;},
    e=>{for(const r of e.late.body.corpseRenderHistory)delete r.corpsePoseSourceBound;},
    e=>{for(const r of e.late.body.corpseRenderHistory)r.corpseGroundOffsetY=(r.corpseGroundOffsetY??0)+1;}]){
    const evidence=fixture('takuya-omega');mutate(evidence);assert.throws(()=>assertV177ReactionRender(evidence));
  }
});

test('actual source-loop joint corpses retain original cut and impact parts through their landed outcome',()=>{
  for(const form of Object.keys(V177_CORPSE_JOINT_DATA))for(const style of ['cut','blast','crush']){
    const evidence=fixture(form,{style});assert.equal(assertV177ReactionRender(evidence).form,form);
    assert.ok(evidence.late.body.corpseRenderHistory.at(-1).corpseJointFragmentParts.length>0);
  }
});

test('wrong joint sources, duplicate or absent parts, detached intact joints and floating fragments cannot pass',()=>{
  for(const mutate of [
    e=>{e.after.body.corpseRenderHistory[0].corpsePoseSourceSha256='wrong';},
    e=>{e.after.body.corpseRenderHistory[0].corpseJointParts[0].sourceRect.x++;},
    e=>{e.after.body.corpseRenderHistory[0].corpseJointParts.push(e.after.body.corpseRenderHistory[0].corpseJointParts[0]);},
    e=>{e.after.body.corpseRenderHistory[0].corpseJointParts.pop();},
    e=>{e.after.body.corpseRenderHistory[0].corpseJointParts.find(p=>p.name==='near-forearm').matrix[4]+=1;},
    e=>{e.late.body.corpseRenderHistory.at(-1).corpseJointFragmentMatrix[5]-=1;},
    e=>{e.late.body.corpseRenderHistory.at(-1).jointSourceReference.w++;},
    e=>{e.late.body.corpseRenderHistory.at(-1).corpseJointOwnedParts=[];},
  ]){
    const evidence=fixture('takuya',{style:'cut'});mutate(evidence);assert.throws(()=>assertV177ReactionRender(evidence));
  }
});
