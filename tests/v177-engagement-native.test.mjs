import test from 'node:test';
import assert from 'node:assert/strict';
import {configureV177ContinuousActorProof as configure,v177ProofFormIdentity} from '../app/v177ContinuousProof.js';
import {normalAttackReach} from '../app/combatLifecycle.js';
import {PLAYABLE_COMBAT_KINDS,createCombatAnimationRuntime} from '../app/combatPresentation.js';
import {createManualAbilityRuntime,MANUAL_ABILITY_REGISTRY} from '../app/manualAbilities.js';
import {spriteKinds} from '../app/spriteManifest.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
import {assertV177AuthoredLiveRender,assertV177EngagementFormCoverage} from '../scripts/v177-continuous-render-contract.mjs';
const catalog={knownForms:spriteKinds,playableKinds:PLAYABLE_COMBAT_KINDS,createAnimationRuntime:createCombatAnimationRuntime,attackReachFor:normalAttackReach,feralSeconds:MANUAL_ABILITY_REGISTRY['mayo-chan'].activeSeconds};
function setup(form){const id=v177ProofFormIdentity(form,catalog);return {actor:{id:7,kind:id.kind,side:id.side,speed:27,laneSpeed:42,damage:31,range:120,bodyRadius:18,attackEvery:1.2,hp:150,maxHp:180,progressionLevel:4,manualAbility:createManualAbilityRuntime(id.kind)},target:{id:8,kind:id.side==='human'?'walker':'guardian',side:id.side==='human'?'zombie':'human',bodyRadius:23,hp:80,maxHp:80,speed:60,damage:40}};}
function fixture(form){const {actor,target}=setup(form),proof=configure(actor,target,{...catalog,form,phase:'engage',lane:1,laneY:285}),sign=actor.side==='human'?1:-1;
 const states=['move','move','wind-up','active','recovery','idle'];
 const samples=states.map((state,i)=>{const x=proof.initial.actorX+sign*i*2;return {route:'/v100',visible:true,running:true,paused:false,at:i*300,simulationTime:i*.3,fighter:{...actor,renderKind:form,manualAbilityPhase:actor.manualAbility?.phase,x,attackSequence:i>=3?1:0},renders:[{renderKind:form,assetReady:true,renderWidth:80,renderHeight:100,x,y:285,poseScaleX:1,poseScaleY:1,renderSequence:i+1,jointAtlasPath:V177_JOINT_ATLASES[form].path,jointLowerFrame:i,jointUpperFrame:i,requestedState:state,actualXDelta:i?sign*2:0,renderedWeaponSocket:{x,y:260},
   ...(form==='ranger'?{jointWeightedLowerDrawSucceeded:true,jointWeightedLower:{mode:'continuous-weighted-mesh',phase:.37,settle:.5,parts:5,meshVertices:130,meshTriangles:192,coverageSamples:4,duplicateWithinPart:0,degenerate:0}}:{})}]};});
 return {form,phase:'engage',proof,samples,status:'passed'};}
test('all48 approach fixtures use production reach and retain actor identity, stats and progression',()=>{
 for(const form of spriteKinds){const {actor,target}=setup(form),before=structuredClone(actor),proof=configure(actor,target,{...catalog,form,phase:'engage',lane:1,laneY:285});
  for(const key of ['id','kind','side','speed','laneSpeed','damage','range','attackEvery','hp','maxHp','progressionLevel'])assert.equal(actor[key],before[key],form+'/'+key);
  assert.equal(proof.engagement.productionAttackReach,normalAttackReach(actor,target));assert.ok(Math.abs(target.x-actor.x)>normalAttackReach(actor,target)+4);assert.equal(actor.cooldown,0);assert.equal(target.damage,0);
 }
});
test('an engagement with missing production reach, invalid reach or zero original speed is rejected',()=>{
 for(const change of [o=>{o.attackReachFor=undefined;},o=>{o.attackReachFor=()=>NaN;},o=>{o.attackReachFor=()=>-1;}]){const {actor,target}=setup('scout'),options={...catalog,form:'scout',phase:'engage',lane:1,laneY:285};change(options);assert.throws(()=>configure(actor,target,options),/original speed and production attack reach/);}
 const {actor,target}=setup('scout');actor.speed=0;assert.throws(()=>configure(actor,target,{...catalog,form:'scout',phase:'engage',lane:1,laneY:285}));
});
test('modeled engagement receipts reject static, reversed, paused or altered-stat substitutes',()=>{
 for(const mutate of [r=>{r.samples.forEach(s=>s.fighter.x=r.samples[0].fighter.x);},r=>{r.samples[0].renders[0].requestedState='active';},r=>{r.samples[2].paused=true;},r=>{r.samples[2].fighter.damage++;}]){const row=fixture('scout');mutate(row);assert.throws(()=>assertV177AuthoredLiveRender(row));}
 assertV177AuthoredLiveRender(fixture('scout'));
});
test('the additional coverage requires every48 body exactly once without declaring all21 or campaign acceptance',()=>{
 const rows=spriteKinds.map(fixture),result=assertV177EngagementFormCoverage(rows);assert.equal(result.forms,48);assert.equal(result.allActionsAcceptance,false);assert.equal(result.normalPlayAcceptance,false);
 assert.throws(()=>assertV177EngagementFormCoverage(rows.slice(1)));const duplicate=structuredClone(rows);duplicate[0]=duplicate[1];assert.throws(()=>assertV177EngagementFormCoverage(duplicate));
});
