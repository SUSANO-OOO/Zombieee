import test from 'node:test';
import assert from 'node:assert/strict';
import {v177AdditionalContinuousForms,v177ProofFormIdentity as sourceIdentity,configureV177ContinuousActorProof as configure} from '../app/v177ContinuousProof.js';
import {spriteKinds} from '../app/spriteManifest.js';
import {createManualAbilityRuntime,MANUAL_ABILITY_REGISTRY} from '../app/manualAbilities.js';
import {PLAYABLE_COMBAT_KINDS,createCombatAnimationRuntime} from '../app/combatPresentation.js';
const catalog={knownForms:spriteKinds,playableKinds:PLAYABLE_COMBAT_KINDS,createAnimationRuntime:createCombatAnimationRuntime,feralSeconds:MANUAL_ABILITY_REGISTRY['mayo-chan'].activeSeconds};
const V177_ADDITIONAL_CONTINUOUS_FORMS=v177AdditionalContinuousForms(spriteKinds,PLAYABLE_COMBAT_KINDS);
const v177ProofFormIdentity=form=>sourceIdentity(form,catalog);
const configureV177ContinuousActorProof=(actor,target,options)=>configure(actor,target,{...catalog,...options});
const setup=form=>{
  const identity=v177ProofFormIdentity(form);
  return {actor:{id:7,kind:identity.kind,side:identity.side,speed:77,laneSpeed:42,damage:31,range:120,attackEvery:1.2,hp:150,maxHp:180,progressionLevel:4,manualAbility:createManualAbilityRuntime(identity.kind)},
    target:{id:8,kind:identity.side==='human'?'walker':'guardian',side:identity.side==='human'?'zombie':'human',hp:80,maxHp:80,speed:60,damage:40}};
};
test('Every ally and alternate authored body has continuous coverage without changing its stable combat kind',()=>{
  assert.equal(V177_ADDITIONAL_CONTINUOUS_FORMS.length,20);
  const base=spriteKinds.filter(kind=>!V177_ADDITIONAL_CONTINUOUS_FORMS.includes(kind));
  assert.equal(new Set([...base,...V177_ADDITIONAL_CONTINUOUS_FORMS]).size,48);
  for(const form of spriteKinds){
    const {actor,target}=setup(form),identity=v177ProofFormIdentity(form);
    const before=structuredClone(actor);
    const proof=configureV177ContinuousActorProof(actor,target,{form,phase:'move',lane:1,laneY:285});
    for(const key of ['id','kind','side','speed','laneSpeed','damage','range','attackEvery','hp','maxHp','progressionLevel'])assert.equal(actor[key],before[key],`${form}/${key}`);
    assert.equal(proof.renderKind,form);assert.equal(proof.kind,identity.kind);
    assert.equal(actor.animationPresentation.direction,identity.side==='human'?'right':'left');
    assert.equal(target.damage,0);assert.equal(target.speed,0);assert.equal(target.hp,1_000_000);
    assert.ok((target.x-actor.x)*(identity.side==='human'?1:-1)>actor.range);
  }
});
test('Twin bodies and the feral form retain their own source-bound identity during ordinary AI fixtures',()=>{
  for(const form of ['futago','futago-separated-a','futago-separated-b','mayo-chan-feral']){
    const {actor,target}=setup(form),proof=configureV177ContinuousActorProof(actor,target,{form,phase:'attack',lane:1,laneY:285});
    assert.equal(actor.kind,form==='mayo-chan-feral'?'mayo-chan':'futago');
    assert.equal(actor.v100TwinPart??null,proof.v100TwinPart);
    assert.equal(proof.legacyFusedFixture,form==='futago');
    assert.ok(Math.abs(target.x-actor.x)<actor.range);assert.equal(actor.cooldown,0);
    if(form==='mayo-chan-feral'){assert.equal(actor.manualAbility.phase,'feral');assert.equal(actor.manualAbility.activeRemaining,MANUAL_ABILITY_REGISTRY['mayo-chan'].activeSeconds);}
  }
});
test('Unknown bodies, invalid phases and actor identity substitutions fail before a continuous fixture starts',()=>{
  assert.throws(()=>v177ProofFormIdentity('invented-person'));
  for(const change of [s=>{s.actor.kind='walker';},s=>{s.target.side=s.actor.side;},s=>{s.actor.speed=NaN;}]){
    const s=setup('scout');change(s);assert.throws(()=>configureV177ContinuousActorProof(s.actor,s.target,{form:'scout',phase:'move',lane:1,laneY:285}));
  }
  const s=setup('scout');assert.throws(()=>configureV177ContinuousActorProof(s.actor,s.target,{form:'scout',phase:'manually-stepped-pose',lane:1,laneY:285}));
});
