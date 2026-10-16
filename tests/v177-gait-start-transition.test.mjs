import assert from 'node:assert/strict';
import test from 'node:test';
import { createCombatAnimationRuntime, advanceCombatAnimationRuntime } from '../app/combatPresentation.js';
import { spriteKinds } from '../app/spriteManifest.js';
import { V177_JOINT_ATLASES, v177JointCycleDistance, v177JointPose } from '../app/v177JointPresentation.js';

test('all48 original rigs begin a moving stride from their planted pose instead of lifting in one update',()=>{
  assert.equal(spriteKinds.length,48);
  for(const kind of spriteKinds)for(const phase of [.13,.37,.78]){
    const atlas=V177_JOINT_ATLASES[kind],stride=v177JointCycleDistance(kind,.2);
    const initial={...createCombatAnimationRuntime(),locomotionPhase:phase};
    // A small real displacement must advance the gait immediately, while its
    // lift remains close to the previously planted pose as elapsed time tends
    // to zero. This exercises the actual plan for rigid and baked originals.
    const dt=1/600,x=.02;
    let runtime=advanceCombatAnimationRuntime(initial,{kind,x,y:0,moving:true,locomotionCycleDistance:stride},dt);
    const plan=v177JointPose(kind,{requestedState:runtime.state,clipProgress:0},runtime);
    assert.equal(runtime.state,'start-move',kind);
    assert.ok(Math.abs(runtime.locomotionPhase-phase-x/stride)<1e-12,kind);
    assert.ok(runtime.locomotionSettle>.9&&runtime.locomotionSettle<1,`${kind}: a new stride instantly changed its lift`);
    assert.equal(Math.floor(plan.lowerIndex/atlas.frameCount),atlas.settleLevels-1,`${kind}: first draw discarded the planted pose`);
    // Keep the existing quick response: the running pose must be available
    // after a short continuous start, without slowing actual travel.
    for(let frame=1;frame<=12;frame++)runtime=advanceCombatAnimationRuntime(runtime,
      {kind,x:x+frame*.5,y:0,locomotionCycleDistance:stride},1/60);
    assert.equal(runtime.locomotionSettle,0,kind);
    assert.ok(Math.abs(runtime.locomotionPhase-phase-(x+6)/stride)<1e-12,kind);
  }
});

test('resuming during a stop retains the partial plant and stationary attack retains the travel phase',()=>{
  for(const kind of spriteKinds){
    const stride=v177JointCycleDistance(kind,.2);
    const moving={...createCombatAnimationRuntime(),state:'move',moving:true,locomotionPhase:.78,locomotionSettle:0};
    const stopping=advanceCombatAnimationRuntime(moving,{kind,x:0,y:0,locomotionCycleDistance:stride},.05);
    assert.ok(stopping.locomotionSettle>0&&stopping.locomotionSettle<1,kind);
    const resumed=advanceCombatAnimationRuntime(stopping,{kind,x:.5,y:0,locomotionCycleDistance:stride},1/60);
    assert.ok(resumed.locomotionSettle>0&&resumed.locomotionSettle<stopping.locomotionSettle,`${kind}: restart discarded the partial plant`);
    const attack=advanceCombatAnimationRuntime(resumed,{kind,state:'active',x:.5,y:0,locomotionCycleDistance:stride},.03);
    assert.equal(attack.locomotionPhase,resumed.locomotionPhase,kind);
    assert.equal(attack.locomotionTravelDistance,resumed.locomotionTravelDistance,kind);
    const plans=[0,.5,1].map(clipProgress=>v177JointPose(kind,{requestedState:'active',clipProgress},attack));
    assert.equal(new Set(plans.map(plan=>plan.lowerIndex)).size,1,`${kind}: attack replaced the feet`);
  }
});

test('a zero-time moving hint cannot reset the planted lift or advance stationary travel',()=>{
  const initial=createCombatAnimationRuntime();
  const next=advanceCombatAnimationRuntime(initial,{kind:'ranger',moving:true,x:0,y:0},0);
  assert.equal(next.locomotionSettle,initial.locomotionSettle);
  assert.equal(next.locomotionPhase,initial.locomotionPhase);
  assert.equal(next.locomotionTravelDistance,initial.locomotionTravelDistance);
});
