import test from 'node:test';
import assert from 'node:assert/strict';
import {spriteKinds} from '../app/spriteManifest.js';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose,v177CaptureJointPose} from '../app/v177JointPresentation.js';
import {createCombatAnimationRuntime,advanceCombatAnimationRuntime,sampleAnimationClip,PLAYABLE_COMBAT_KINDS} from '../app/combatPresentation.js';
import {v102CombatMotionSample} from '../app/v102CombatMotion.js';

// Exercise the actual pose resolver/draw boundary. These transport fixtures
// are not native footage or an original-speed visual acceptance claim.
const context=()=>({save(){},restore(){},translate(){},scale(){},transform(){},drawImage(){},
  beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){}});
const runtime={locomotionPhase:.37,locomotionSettle:1};
const paint=(kind,plan,actor,image={naturalWidth:1})=>drawV177JointPose(context(),image,kind,plan,0,0,100,120,{actor});

test('a living playable actor takes its first hit on its current body without borrowing painted history',()=>{
 for(const kind of PLAYABLE_COMBAT_KINDS)for(const state of ['hit-light','hit-heavy']){
  const actor={kind,side:'human',hp:100,flash:.1,stunned:0},before=structuredClone(actor);
  const sample={requestedState:state,clipProgress:.2};
  const first=v177JointPose(kind,sample,runtime,{actor,grounded:true});
  assert.ok(first,kind+' first '+state);assert.equal(first.reactionHeld,true);
  if(V177_JOINT_ATLASES[kind].type==='rigid-parts')
   assert.ok(first.groundedHitBase,kind+' articulated recoil begins immediately');
  else assert.deepEqual(first.upperRigPoses,v177JointPose(kind,{requestedState:'idle'},runtime,{actor}).upperRigPoses,
   kind+' keeps its dedicated upper rig under the existing outer hit transform');
  assert.equal(paint(kind,first,actor),true);
  const repeat=v177JointPose(kind,sample,{...runtime,locomotionPhase:.8},{actor,grounded:true});
  assert.deepEqual(v177CaptureJointPose(kind,repeat),v177CaptureJointPose(kind,first),kind+' repeat cannot accumulate recoil');
  const next=v177JointPose(kind,{requestedState:'move'},{...runtime,locomotionPhase:.8},{actor});
  assert.ok(next);assert.notEqual(next.reactionHeld,true);assert.deepEqual(actor,before);
 }
});

test('first-hit current bodies require the living human owner and preserve explicit action ownership',()=>{
 const kind='scout',sample={requestedState:'hit-light'};
 for(const actor of [{kind:'medic',side:'human',hp:100},{kind,side:'zombie',hp:100},{kind,side:'human',hp:0},{kind,side:'human'},{}])
  assert.equal(v177JointPose(kind,sample,runtime,{actor}),null);
 assert.equal(v177JointPose(kind,sample,runtime,{actor:{kind,side:'human',hp:100},ownedPose:true}),null);
});

test('Mayo starts a first feral hit on the current rig, then holds its actually painted pose',()=>{
 for(const state of ['hit','hit-light','hit-heavy'])for(const normalPainted of [true,false]){
  const actor={kind:'mayo-chan',hp:170,flash:.1,stunned:0,manualAbility:{phase:'ready'},mayoRetreat:null};
  if(normalPainted){const normal=v177JointPose('mayo-chan',{requestedState:'move'},runtime,{actor});assert.equal(paint('mayo-chan',normal,actor),true);}
  actor.manualAbility.phase='feral';const before=structuredClone(actor),kind='mayo-chan-feral';
  const first=v177JointPose(kind,{requestedState:state,clipProgress:.1},runtime,{actor});
  assert.ok(first,'first '+state+' must not return to a legacy sprite');assert.equal(first.reactionHeld,true);
  const expected=v177JointPose(kind,{requestedState:'idle'},runtime);
  assert.deepEqual(v177CaptureJointPose(kind,first),v177CaptureJointPose(kind,expected),'seed only the current form skeleton');
  assert.equal(paint(kind,first,actor),true);
  const repeated=v177JointPose(kind,{requestedState:state,clipProgress:.6},{...runtime,locomotionPhase:.8},{actor});
  assert.deepEqual(v177CaptureJointPose(kind,repeated),v177CaptureJointPose(kind,first),'hold only after successful current-form paint');
  const next=v177JointPose(kind,{requestedState:'move'},{...runtime,locomotionPhase:.8},{actor});
  assert.ok(next);assert.notEqual(next.reactionHeld,true);assert.notEqual(next.phase,first.phase);
  assert.deepEqual(actor,before,'rendering cannot change HP, flash, stun or ability clocks');
 }
});

test('the feral hit bootstrap cannot claim another actor, a normal form, or an owned action',()=>{
 for(const actor of [{kind:'scout',manualAbility:{phase:'feral'}},{kind:'mayo-chan',manualAbility:{phase:'ready'}},{}])
  assert.equal(v177JointPose('mayo-chan-feral',{requestedState:'hit-light'},runtime,{actor}),null);
 const actor={kind:'mayo-chan',manualAbility:{phase:'feral'}};
 assert.equal(v177JointPose('mayo-chan',{requestedState:'hit-light'},runtime,{actor}),null);
 assert.equal(v177JointPose('mayo-chan-feral',{requestedState:'hit-light'},runtime,{actor,ownedPose:true}),null);
});

test('the first grounded feral hit applies recoil immediately without accumulating it on redraw',()=>{
 const kind='mayo-chan-feral',actor={kind:'mayo-chan',manualAbility:{phase:'feral'}},sample={requestedState:'hit-heavy',clipProgress:.2};
 const first=v177JointPose(kind,sample,runtime,{actor,grounded:true});
 assert.ok(first.groundedHitBase);assert.notDeepEqual(first.groundedMotion.upper,first.groundedHitBase.upper);
 assert.equal(paint(kind,first,actor),true);
 const repeated=v177JointPose(kind,sample,runtime,{actor,grounded:true});
 assert.deepEqual(v177CaptureJointPose(kind,repeated),v177CaptureJointPose(kind,first));
});

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
