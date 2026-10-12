import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {V177_NATIVE_ACTION_PLAN} from '../scripts/v177-native-action-plan.mjs';
import {spriteKinds} from '../app/spriteManifest.js';
import {V177_JOINT_ATLASES,v177JointPose} from '../app/v177JointPresentation.js';
import {PLAYABLE_COMBAT_KINDS,animationClipFor,attackPresentationDuration,createCombatAnimationRuntime,advanceCombatAnimationRuntime} from '../app/combatPresentation.js';

test('native pose coverage includes every actual foundation input without duplicates or invented actions',()=>{
  const source=fs.readFileSync('app/AshfallGame.tsx','utf8');
  const type=source.match(/stepAnimationFoundationProof:\s*\(\s*fighterId:\s*number,\s*action:\s*([^,]+),/u)?.[1];
  assert.ok(type,'read the actual bridge input union');
  const actual=[...type.matchAll(/"([^"]+)"/gu)].map(m=>m[1]);
  const planned=V177_NATIVE_ACTION_PLAN.map(p=>p.action);
  assert.equal(new Set(planned).size,planned.length);
  assert.deepEqual([...planned].sort(),actual.sort());
  assert.equal(planned.length,11);
});

test('every declared joint pose is connected for all 48 original forms, including native reload',()=>{
  assert.equal(spriteKinds.length,48);
  for(const kind of spriteKinds)for(const plan of V177_NATIVE_ACTION_PLAN){
    assert.ok(V177_JOINT_ATLASES[kind]);
    const state=plan.expectedState??(plan.action.startsWith('move-')?'move':'stop-move');
    const pose=v177JointPose(kind,{requestedState:state,clipProgress:.2},
      {locomotionPhase:.2,locomotionSettle:1});
    assert.equal(Boolean(pose),plan.joint,`${kind}/${plan.action}: actual joint eligibility`);
    if(plan.attackOrigin)assert.ok(pose&&Number.isInteger(pose.upperIndex));
  }
});

test('fresh bridge fixtures expose each requested deployment, hit and reload state',()=>{
  const source=fs.readFileSync('app/AshfallGame.tsx','utf8');
  const parsed=ts.createSourceFile('AshfallGame.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let declaration;
  const visit=node=>{
    if(ts.isPropertyAssignment(node)&&node.name.getText(parsed)==='stepAnimationFoundationProof')declaration=node.initializer;
    if(!declaration)ts.forEachChild(node,visit);
  };
  visit(parsed);assert.ok(declaration);
  const emitted=ts.transpileModule(`const step=${declaration.getText(parsed)};`,
    {compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText;
  for(const form of spriteKinds){
    const kind=form==='mayo-chan-feral'?'mayo-chan':form.startsWith('futago-separated-')?'futago':form;
    const side=PLAYABLE_COMBAT_KINDS.includes(kind)?'human':'zombie';
    const direction=side==='human'?'right':'left';
    const gameRef={current:{fighters:[],definition:{missionConfig:{v100StageNumber:1}}}};
    const step=vm.runInNewContext(emitted+'\nstep',{
      gameRef,advanceCombatAnimationRuntime,animationClipFor,attackPresentationDuration,
      articulatedCycleDistanceFor:()=>80,
    });
    for(const plan of V177_NATIVE_ACTION_PLAN){
      gameRef.current.fighters=[{id:1,kind,side,x:500,y:300,
        animationPresentation:createCombatAnimationRuntime({deploying:true,direction,x:500,y:300})}];
      if(plan.expectedState!=='deploy')step(1,'stop',.5);
      const result=step(1,plan.action,.06);
      if(['deploy','reload','hit-light','hit-heavy'].includes(plan.expectedState)){
        assert.equal(result.state,plan.expectedState,`${form}/${plan.action}: fresh fixture must expose the requested state`);
      }
    }
  }
});
