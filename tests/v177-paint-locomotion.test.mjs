import test from 'node:test';
import assert from 'node:assert/strict';
import {v177PaintLocomotion} from '../app/v177PaintLocomotion.js';
import {V177_JOINT_ATLASES as atlases,v177JointPose,drawV177JointPose,v177CaptureJointPose} from '../app/v177JointPresentation.js';
import {createCombatAnimationRuntime,advanceCombatAnimationRuntime} from '../app/combatPresentation.js';

const context=()=>new Proxy({},{get:(_target,key)=>key==='createLinearGradient'?()=>({addColorStop(){}}):()=>{}});
const point=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
function paint(kind,plan,actor,world){
  assert.equal(drawV177JointPose(context(),{naturalWidth:atlases[kind].decodedWidth},kind,plan,0,0,100,120,{actor,world}),true);
}

test('one real pursuit tick between sparse paints still lifts the original swing foot',()=>{
  const kind='medic',atlas=atlases[kind],actor={id:1,x:330,hp:100,kind},world={time:0,fighters:[]};world.fighters=[actor];
  let runtime={...createCombatAnimationRuntime({x:actor.x,y:285}),locomotionPhase:.30,locomotionSettle:1,deployCompleted:true};
  paint(kind,v177JointPose(kind,{requestedState:'idle'},runtime,{actor,world}),actor,world);
  // The actual movement/settle owner runs at60Hz. Only one of the next twelve
  // ticks travels; the first subsequent paint sees moving=false, settle=1.
  for(let i=0;i<12;i++){
    if(i===0)actor.x+=29/60;
    runtime=advanceCombatAnimationRuntime(runtime,{kind,x:actor.x,y:285,direction:'right',locomotionCycleDistance:31},1/60);
    world.time+=1/60;
  }
  assert.equal(runtime.moving,false);assert.equal(runtime.locomotionSettle,1);
  const before=structuredClone({runtime,world});
  const plan=v177JointPose(kind,{requestedState:'recovery',clipProgress:.6},runtime,{actor,world});
  assert.equal(plan.paintLocomotion.settle,0,'the pursuit happened since the last actual paint');
  const leg=atlas.legConstraints[0],pose=v177CaptureJointPose(kind,plan);
  const ankle=point(pose.lower[leg.effectorBone],leg.ankle);
  const ground=Math.max(...atlas.poses.slice(0,atlas.frameCount).map(p=>point(p[leg.effectorBone],leg.ankle)[1]));
  assert.ok(ground-ankle[1]>10,'the original boot is visibly lifted instead of sweeping on the floor');
  assert.deepEqual({runtime,world},before,'renderer tracking never changes gameplay clocks, positions or stats');
  paint(kind,plan,actor,world);
  world.time+=.08;
  const settling=v177JointPose(kind,{requestedState:'idle'},runtime,{actor,world});
  assert.ok(Math.abs(settling.paintLocomotion.settle-.5)<1e-12,'a real stop settles continuously from the painted lift');
});

test('all47 rigid forms retain their actual painted travel across immutable actor copies and stopped ticks',()=>{
  for(const [kind,atlas]of Object.entries(atlases).filter(([,a])=>a.type==='rigid-parts')){
    let actor={id:1,x:330,hp:100,kind};const world={time:10,fighters:[actor]};
    const start={locomotionPhase:.3,locomotionSettle:1};
    paint(kind,v177JointPose(kind,{requestedState:'idle'},start,{actor,world}),actor,world);
    actor={...actor,x:330.5};world.fighters=[actor];world.time+=.05;
    const runtime={locomotionPhase:.32,locomotionSettle:1};
    const plan=v177JointPose(kind,{requestedState:'active',clipProgress:.4},runtime,{actor,world});
    assert.ok(plan.paintLocomotion.settle<.59,kind+' missed its short pursuit');
    const source=JSON.stringify(atlas);paint(kind,plan,actor,world);
    const repeated=v177JointPose(kind,{requestedState:'active',clipProgress:.4},runtime,{actor,world});
    assert.deepEqual(repeated.paintLocomotion,plan.paintLocomotion,kind+' repeated draw advanced the lift');
    const held=v177JointPose(kind,{requestedState:'hit-light'},runtime,{actor,world});
    assert.equal(held.reactionHeld,true);assert.deepEqual(held.paintLocomotion,plan.paintLocomotion);
    const stun=v177JointPose(kind,{requestedState:'incapacitated'},runtime,{actor,world,stunRemaining:.3});
    assert.ok(stun.liveStun,kind+' living stun must retain its existing owner');
    assert.equal(JSON.stringify(atlas),source,kind+' changed source anatomy or authored transforms');
  }
});

test('unpainted queries, failed draws, other battles and missing clocks cannot supply locomotion history',()=>{
  const actor={id:1,x:330,hp:100,kind:'medic'},world={time:0,fighters:[actor]};
  const initial=v177JointPose('medic',{requestedState:'idle'},{locomotionPhase:.3,locomotionSettle:1},{actor,world});
  world.time=.2;actor.x+=1;
  const unpainted=v177JointPose('medic',{requestedState:'move'},{locomotionPhase:.4,locomotionSettle:1},{actor,world});
  assert.equal(unpainted.paintLocomotion.settle,1,'a resolver query is not an actual paint');
  paint('medic',initial,actor,world);
  assert.equal(drawV177JointPose(context(),{naturalWidth:0},'medic',unpainted,0,0,100,120,{actor,world}),false);
  assert.equal(v177JointPose('medic',{requestedState:'move'},{locomotionPhase:.5,locomotionSettle:1},{actor,world}).paintLocomotion.settle,1);
  assert.deepEqual(v177PaintLocomotion({locomotionPhase:.4,locomotionSettle:1},{phase:.3,settle:0},{time:1,x:330}),{phase:.4,settle:1,time:1,x:330});
  assert.deepEqual(v177PaintLocomotion({locomotionPhase:.4,locomotionSettle:1},null),{phase:.4,settle:1});
  assert.equal(v177JointPose('medic',{requestedState:'move'},{locomotionPhase:.5,locomotionSettle:1},{actor,world:{...world}}).paintLocomotion.settle,1);
});

test('hit and living-stun recovery never replay travel from an older held pose',()=>{
  for(const state of ['hit-light','hit-heavy','incapacitated']){
    const actor={id:1,x:330,hp:100,kind:'medic'},world={time:0,fighters:[actor]};
    const before={locomotionPhase:.3,locomotionSettle:1};
    paint('medic',v177JointPose('medic',{requestedState:'idle'},before,{actor,world}),actor,world);
    world.time=.4;actor.x=345;
    const runtime={locomotionPhase:.6,locomotionSettle:1};
    const held=v177JointPose('medic',{requestedState:state},runtime,{actor,world,stunRemaining:.2});
    paint('medic',held,actor,world);
    world.time=.5;
    const restored=v177JointPose('medic',{requestedState:'idle'},runtime,{actor,world});
    assert.equal(restored.paintLocomotion.settle,1,state+' replayed earlier knockback as a fresh walking lift');
  }
});

test('a newly lifted pursuit foot does not snap down after a held hit',()=>{
  const actor={id:1,x:330,hp:100,kind:'medic'},world={time:0,fighters:[actor]};
  paint('medic',v177JointPose('medic',{requestedState:'idle'},{locomotionPhase:.3,locomotionSettle:1},{actor,world}),actor,world);
  world.time=.2;actor.x=330.5;
  const runtime={locomotionPhase:.32,locomotionSettle:1};
  const lifted=v177JointPose('medic',{requestedState:'recovery',clipProgress:.8},runtime,{actor,world});
  assert.equal(lifted.paintLocomotion.settle,0);paint('medic',lifted,actor,world);
  world.time=.25;actor.x=325;
  const held=v177JointPose('medic',{requestedState:'hit-heavy'},runtime,{actor,world});
  assert.equal(held.paintLocomotion.settle,0);assert.equal(held.paintLocomotion.time,.25);
  assert.deepEqual(v177CaptureJointPose('medic',held),v177CaptureJointPose('medic',lifted),'only held metadata may advance');
  paint('medic',held,actor,world);world.time+=1/60;
  const restored=v177JointPose('medic',{requestedState:'idle'},runtime,{actor,world});
  assert.ok(Math.abs(restored.paintLocomotion.settle-(1/60)/.16)<1e-12,'only time after the held paint lowers the foot');
});
