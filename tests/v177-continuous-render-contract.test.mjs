import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {spriteKinds} from '../app/spriteManifest.js';
import {PLAYABLE_COMBAT_KINDS} from '../app/combatPresentation.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
import {v177ProofFormIdentity as sourceIdentity} from '../app/v177ContinuousProof.js';
import {V177_ADDITIONAL_CONTINUOUS_FORMS,assertV177AuthoredLiveRender,assertV177ContinuousFormCoverage} from '../scripts/v177-continuous-render-contract.mjs';
const v177ProofFormIdentity=form=>sourceIdentity(form,{knownForms:spriteKinds,playableKinds:PLAYABLE_COMBAT_KINDS});
const evidence=(form,phase='move')=>{
  const identity=v177ProofFormIdentity(form),sign=identity.side==='human'?1:-1;
  const stats={speed:77,laneSpeed:42,damage:31,range:120,attackEvery:1.2,hp:150,maxHp:180};
  const proof={fighterId:8,targetId:9,...identity,phase,originalActorStats:stats};
  const samples=Array.from({length:6},(_,i)=>({at:i*200,simulationTime:i*.2,route:'/v100',visible:true,running:true,paused:false,
    fighter:{id:8,...identity,...stats,manualAbilityPhase:form==='mayo-chan-feral'?'feral':'ready',x:500+sign*i*3,attackSequence:phase==='attack'?1:0},
    renders:[{renderSequence:i+1,renderKind:form,assetReady:true,x:500+sign*i*3,y:285,renderWidth:150,renderHeight:140,
      poseScaleX:1,poseScaleY:1,requestedState:phase==='move'?'move':'active',actualXDelta:phase==='move'?sign*3:0,
      jointAtlasPath:V177_JOINT_ATLASES[form].path,jointLowerFrame:phase==='move'?i:3,jointUpperFrame:120+i,renderedWeaponSocket:{x:510,y:260},
      ...(form==='ranger'?{jointWeightedLowerDrawSucceeded:true,jointWeightedLower:{mode:'continuous-weighted-mesh',phase:.37,settle:.5,parts:5,meshVertices:130,meshTriangles:192,coverageSamples:4,duplicateWithinPart:0,degenerate:0}}:{})}]}));
  return {form,phase,proof,samples,status:'passed'};
};
test('All 48 original bodies can require actual AI travel, attack motion and unchanged actor stats',()=>{
  for(const form of spriteKinds)for(const phase of ['move','attack']){
    const e=evidence(form,phase),r=assertV177AuthoredLiveRender(e);
    assert.equal(r.form,form);assert.equal(r.expectedJointPath,V177_JOINT_ATLASES[form].path);
    assert.equal(r.legacyFusedFixture,form==='futago');
  }
});

test('the actual continuous browser read preserves weighted Ranger paint receipts without manufacturing success',async()=>{
  // Extract the actual hosted reader without importing its browser-launching entry point.
  const source=await readFile('scripts/v102-combat-browser.mjs','utf8'),ast=ts.createSourceFile('combat.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),callbacks=[];
  const visit=node=>{if(ts.isCallExpression(node)&&node.expression.getText(ast)==='page.evaluate'&&node.arguments[0]?.getText(ast).includes('renders:audit.renderHistory.map'))callbacks.push(node.arguments[0]);ts.forEachChild(node,visit);};visit(ast);
  assert.equal(callbacks.length,1);
  const read=new Function('window','performance','location','document','id','return ('+callbacks[0].getText(ast)+')(id)');
  const project=sample=>read({__ASHFALL_BATTLE_QA__:{getSnapshot:()=>({time:sample.simulationTime,running:sample.running,paused:sample.paused}),
    getEnemyFacingRuntimeAudit:()=>({fighter:sample.fighter,renderHistory:sample.renders})}},
    {now:()=>sample.at},{pathname:sample.route},{visibilityState:sample.visible?'visible':'hidden'},sample.fighter.id);
  for(const phase of ['move','attack']){
    const original=evidence('ranger',phase),projected={...original,samples:original.samples.map(project)};
    for(let i=0;i<original.samples.length;i++)assert.deepEqual(projected.samples[i].renders,original.samples[i].renders);
    assert.doesNotThrow(()=>assertV177AuthoredLiveRender(projected));
    for(const field of ['jointWeightedLowerDrawSucceeded','jointWeightedLower']){
      const absent=structuredClone(original);delete absent.samples[1].renders[0][field];
      const sampled={...absent,samples:absent.samples.map(project)};
      assert.equal(sampled.samples[1].renders[0][field],undefined);assert.throws(()=>assertV177AuthoredLiveRender(sampled));
    }
    const failed=structuredClone(original);failed.samples[1].renders[0].jointWeightedLowerDrawSucceeded=false;
    const sampled={...failed,samples:failed.samples.map(project)};
    assert.equal(sampled.samples[1].renders[0].jointWeightedLowerDrawSucceeded,false);assert.throws(()=>assertV177AuthoredLiveRender(sampled));
  }
});
test('A paused label, frozen feet, different body, altered speed or missing attack origin cannot pass as native motion',()=>{
  for(const change of [
    e=>{e.samples[1].paused=true;},e=>{e.samples[1].fighter.speed++;},
    e=>{e.samples[1].renders[0].renderKind='gunner';},e=>{e.samples[1].renders[0].jointAtlasPath=null;},
    e=>{for(const s of e.samples)s.renders[0].jointLowerFrame=0;},
    e=>{for(const s of e.samples)s.fighter.x=500;},e=>{e.samples[1].fighter.side='zombie';},
    e=>{for(const s of e.samples)s.simulationTime=0;},
  ]){const e=evidence('scout');change(e);assert.throws(()=>assertV177AuthoredLiveRender(e));}
  for(const change of [
    e=>{e.samples[1].renders[0].renderedWeaponSocket=null;},
    e=>{for(const s of e.samples)s.fighter.attackSequence=0;},
    e=>{for(const s of e.samples)s.renders[0].jointUpperFrame=120;},
  ]){const e=evidence('ranger','attack');change(e);assert.throws(()=>assertV177AuthoredLiveRender(e));}
  const twin=evidence('futago-separated-b');twin.samples[1].fighter.v100TwinPart='a';assert.throws(()=>assertV177AuthoredLiveRender(twin));
  const feral=evidence('mayo-chan-feral');feral.samples[1].fighter.manualAbilityPhase='ready';assert.throws(()=>assertV177AuthoredLiveRender(feral));
});
const coverage=()=>{
  const enemyKinds=spriteKinds.filter(kind=>!PLAYABLE_COMBAT_KINDS.includes(kind)&&kind!=='mayo-chan-feral'&&!kind.startsWith('futago-separated-'));
  const base=enemyKinds.flatMap(kind=>['move','attack'].map(phase=>{
    const e=evidence(kind==='futago'?'futago-separated-a':kind,phase);
    return {...e,kind,renderKind:e.proof.renderKind,v100TwinPart:e.proof.v100TwinPart,expectedJointPath:V177_JOINT_ATLASES[e.form].path};
  }));
  const extra=V177_ADDITIONAL_CONTINUOUS_FORMS.flatMap(form=>['move','attack'].map(phase=>evidence(form,phase)));
  return {base,extra};
};
test('controlled enemy evidence cannot replace an original-stat move or attack for any authored body',()=>{
  const {base,extra}=coverage();
  for(const form of spriteKinds)for(const phase of ['move','attack']){
    const missingBase=structuredClone(base),missingExtra=structuredClone(extra);
    const selected=[...missingBase,...missingExtra].filter(e=>(e.renderKind??e.form)===form&&e.phase===phase);
    assert.ok(selected.length>0);
    for(const e of selected)delete e.proof.originalActorStats;
    assert.throws(()=>assertV177ContinuousFormCoverage(missingBase,missingExtra),`${form}/${phase} requires actual original-stat evidence`);
  }
  const altered=structuredClone(base),walker=altered.find(e=>e.kind==='walker'&&e.phase==='move');
  walker.samples[0].fighter.speed=70;
  assert.throws(()=>assertV177ContinuousFormCoverage(altered,extra),'a real enemy must keep its captured original speed');
});
test('Complete move/attack coverage includes every ally, enemy and derived body and cannot hide an omitted or duplicate phase',()=>{
  const {base,extra}=coverage();assert.deepEqual(assertV177ContinuousFormCoverage(base,extra),{forms:48,phases:98,baseEnemyPhases:58,additionalPhases:40,originalStatForms:48,originalStatPhases:96,allActionsAcceptance:false,normalPlayAcceptance:false});
  assert.throws(()=>assertV177ContinuousFormCoverage(base,extra.slice(1)));
  const duplicate=structuredClone(extra);duplicate[1]=structuredClone(duplicate[0]);assert.throws(()=>assertV177ContinuousFormCoverage(base,duplicate));
  const stale=structuredClone(extra);stale[0].samples[0].renders[0].jointAtlasPath='/art/v100/joints/obsolete.webp';assert.throws(()=>assertV177ContinuousFormCoverage(base,stale));
});
