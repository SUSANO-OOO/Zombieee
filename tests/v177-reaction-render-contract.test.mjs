import test from 'node:test';
import assert from 'node:assert/strict';
import {assertV177ReactionRender,assertV177ReactionCoverage} from '../scripts/v177-reaction-render-contract.mjs';
import {spriteKinds,spriteFrameFor} from '../app/spriteManifest.js';
import {PLAYABLE_COMBAT_KINDS} from '../app/combatPresentation.js';
import {v177ProofFormIdentity} from '../app/v177ContinuousProof.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
const fixture=form=>{
  const identity=v177ProofFormIdentity(form,{knownForms:spriteKinds,playableKinds:PLAYABLE_COMBAT_KINDS});
  const protectedBody=identity.kind==='mayo-chan',direction=identity.side==='human'?'right':'left';
  const paint=(state,sequence)=>{
    const frame=spriteFrameFor(form,state==='retreat'?'walk-a':state,direction);
    return {renderKind:form,spritePath:frame.path,assetReady:true,renderSequence:sequence,requestedState:state,
      sourceRect:{...frame.sourceRect},sourceRow:frame.sourceRect.y,renderWidth:frame.sourceRect.w*.2,renderHeight:frame.sourceRect.h*.2,
      jointAtlasPath:V177_JOINT_ATLASES[form].path,jointLowerFrame:sequence,poseScaleX:1,poseScaleY:1};
  };
  const live=paint('idle',1),fighter={id:7,kind:identity.kind,side:identity.side,renderKind:form,v100TwinPart:identity.v100TwinPart,hp:150,x:500};
  const empty={impacts:[],pools:[],wounds:[],pending:false};
  const before={at:10,simulationTime:4,running:true,paused:true,route:'/v100',visible:true,
    body:{fighter,corpse:null,renderHistory:[live],corpseRenderHistory:[]},effects:empty};
  const body=protectedBody
    ? {fighter:{...fighter,hp:1,x:450,mayoRetreat:{reason:'injury',phase:'run',renderKind:form}},corpse:null,
      renderHistory:[live,paint('death',2),paint('hit',3),paint('retreat',4),paint('retreat',5)],corpseRenderHistory:[]}
    : {fighter:null,corpse:{id:7,kind:identity.kind,side:identity.side,v100TwinPart:identity.v100TwinPart},renderHistory:[live],
      corpseRenderHistory:[paint('death',10),paint('death',11),paint('death',12)]};
  const after={at:1000,simulationTime:5,running:true,paused:true,route:'/v100',visible:true,body,
    effects:protectedBody?empty:{impacts:[{targetId:7,lethal:true}],pools:[{targetId:7}],wounds:[{targetId:7,lethal:true}],pending:false}};
  return {form,proof:{fighterId:7,...identity,phase:'defeat',outcome:protectedBody?'retreat':'corpse',originalActorStats:{hp:150}},before,after,status:'passed'};
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
