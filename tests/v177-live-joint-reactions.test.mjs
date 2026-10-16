import test from 'node:test';
import assert from 'node:assert/strict';
import {spriteKinds} from '../app/spriteManifest.js';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose} from '../app/v177JointPresentation.js';
import {createCombatAnimationRuntime,advanceCombatAnimationRuntime,sampleAnimationClip,PLAYABLE_COMBAT_KINDS} from '../app/combatPresentation.js';
import {v102CombatMotionSample} from '../app/v102CombatMotion.js';

// Exercise the actual pose resolver/draw boundary. These transport fixtures
// are not native footage or an original-speed visual acceptance claim.
const context=()=>({save(){},restore(){},translate(){},scale(){},transform(){},drawImage(){},
  beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){}});
const runtime={locomotionPhase:.37,locomotionSettle:1};
const paint=(kind,plan,actor,image={naturalWidth:1})=>drawV177JointPose(context(),image,kind,plan,0,0,100,120,{actor});

test('all48 bodies keep the last actually drawn feet and weapon rig through every ordinary hit state',()=>{
  for(const kind of spriteKinds){
    const actor={},source=v177JointPose(kind,{requestedState:'active',clipProgress:.43},runtime,{actor});
    assert.ok(source,kind);assert.equal(paint(kind,source,actor),true);
    for(const state of ['hit','hit-light','hit-heavy'])for(const p of [0,.25,.75,1]){
      const hit=v177JointPose(kind,{requestedState:state,clipProgress:p},{...runtime,locomotionPhase:.8},{actor});
      assert.ok(hit,kind+'/'+state);assert.equal(hit.reactionHeld,true);
      for(const key of Object.keys(source))assert.deepEqual(hit[key],source[key],kind+'/'+state+'/'+key);
      assert.equal(paint(kind,hit,actor),true);
    }
    const next=v177JointPose(kind,{requestedState:'move',clipProgress:.2},{...runtime,locomotionPhase:.8},{actor});
    assert.ok(next);assert.notEqual(next.phase,source.phase);assert.notEqual(next.reactionHeld,true);
  }
});

test('an unpainted or mismatched actor, an owned action, and an unavailable image never reuse another body',()=>{
  const actor={},kind='scout',sample={requestedState:'active',clipProgress:.5},hit={requestedState:'hit-light'};
  const source=v177JointPose(kind,sample,runtime,{actor});
  assert.equal(v177JointPose(kind,hit,runtime,{actor}),null,'prepared but unpainted poses are not history');
  assert.equal(paint(kind,source,actor),true);
  assert.equal(v177JointPose(kind,hit,runtime,{actor:{}}),null);
  assert.equal(v177JointPose('medic',hit,runtime,{actor}),null);
  paint(kind,source,actor);
  assert.equal(v177JointPose(kind,sample,runtime,{actor,ownedPose:true}),null);
  assert.equal(v177JointPose(kind,hit,runtime,{actor}),null);
  paint(kind,source,actor);
  assert.equal(paint(kind,source,actor,{naturalWidth:0}),false);
  assert.equal(v177JointPose(kind,hit,runtime,{actor}),null);
  assert.equal(v177JointPose(kind,hit,runtime),null,'unbound callers retain their explicit fallback');
});

test('every48 deployment pose follows actual travel through the existing gait rather than swapping static frames',()=>{
  for(const kind of spriteKinds){
    assert.ok(V177_JOINT_ATLASES[kind]);
    let r=createCombatAnimationRuntime({deploying:true,x:0,y:0});
    r=advanceCombatAnimationRuntime(r,{kind,deploying:true,x:2,y:0,locomotionCycleDistance:20},.05);
    assert.equal(r.state,'deploy');assert.equal(r.locomotionPhase,.1);
    const plan=v177JointPose(kind,sampleAnimationClip(kind,r.state,r.elapsedSeconds),r);
    assert.ok(plan,kind);assert.ok(Math.abs(plan.phase-r.locomotionPhase)<1e-12);
  }
});

test('an enemy attack timer cannot overwrite the actual ordinary hit pose selected by the renderer',()=>{
  const enemies=spriteKinds.filter(kind=>!PLAYABLE_COMBAT_KINDS.includes(kind)&&kind!=='mayo-chan-feral');
  for(const kind of enemies)for(const state of ['hit','hit-light','hit-heavy']){
    const hit=sampleAnimationClip(kind,state,.04);
    for(const timers of [{attack:.15,attackWindup:0},{attack:0,attackWindup:.1}]){
      const result=v102CombatMotionSample(kind,hit,{side:'zombie',abilityWindup:0,...timers});
      assert.equal(result.requestedState,hit.requestedState,kind+'/'+state);
      assert.equal(result.spriteState,hit.spriteState,kind+'/'+state+'/paint');
    }
  }
});
