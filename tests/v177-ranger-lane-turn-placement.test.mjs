import test from 'node:test';
import assert from 'node:assert/strict';
import {V177_JOINT_ATLASES} from '../app/v177JointData.js';
import {createCombatAnimationRuntime,advanceCombatAnimationRuntime} from '../app/combatPresentation.js';
import {v177RangerFootPlacement} from '../app/v177RangerFootPlacement.js';
import {v177RangerLowerPose} from '../app/v177RangerLowerMotion.js';

const rig=V177_JOINT_ATLASES.ranger.lowerRig,cycle=rig.spanPx/rig.stanceFraction;
function assertOriginalLegs(result,settle){
 const pose=v177RangerLowerPose(rig,result.phase,settle,undefined,result.targets);
 for(let i=0;i<2;i++){
  const joint=pose.joints[i],leg=rig.legs[i];
  assert.ok(Math.abs(Math.hypot(joint[2]-joint[0],joint[3]-joint[1])-leg.upperLength)<1e-9);
  assert.ok(Math.abs(Math.hypot(joint[4]-joint[2],joint[5]-joint[3])-leg.lowerLength)<1e-9);
  assert.equal(joint[4],result.targets[i][0]);assert.equal(joint[5],result.targets[i][1]);
 }
}

test('actual lane travel with no horizontal travel keeps both original legs reachable through stop and pursuit',()=>{
 for(const scale of [.18,.2])for(const laneSpeed of [-60,60]){
  let root=203.28333333333316,y=285,state;
  let runtime=createCombatAnimationRuntime({x:root,y,direction:'right'});
  for(let frame=0;frame<120;frame++){
   if(frame){
    if(frame<35)y+=laneSpeed/60;
    else if(frame>=65)root+=20/60;
    runtime=advanceCombatAnimationRuntime(runtime,{x:root,y,kind:'ranger',direction:'right',
     locomotionCycleDistance:scale*cycle},1/60);
   }
   const previous=state,result=v177RangerFootPlacement(rig,state,{time:frame/60,root,scale,
    phase:runtime.locomotionPhase,settle:runtime.locomotionSettle,moving:runtime.moving,facing:runtime.direction});
   assertOriginalLegs(result,runtime.locomotionSettle);
   if(previous)for(let i=0;i<2;i++)if(previous.feet[i].mode==='plant'&&result.state.feet[i].mode==='plant')
    assert.ok(Math.abs(previous.feet[i].x-result.state.feet[i].x)<1e-8,'a supporting boot cannot slide to hide an overextended leg');
   state=result.state;
  }
 }
});

test('a moving turn begins its actual lifted step without stretching the newly leading leg',()=>{
 for(const facing of ['right','left']){
  const scale=.18,direction=facing==='right'?-1:1;
  const first={time:0,root:180,scale,phase:0,settle:0,moving:true,facing};
  const before=v177RangerFootPlacement(rig,null,first),input={...first,time:.05,
   root:first.root+direction,phase:1/(scale*cycle),facing:facing==='right'?'left':'right'};
  const result=v177RangerFootPlacement(rig,before.state,input);
  assertOriginalLegs(result,0);
  assert.ok(result.state.feet.some(foot=>foot.mode==='swing'&&foot.height>0));
  for(let i=0;i<2;i++)assert.ok(Math.abs(result.state.feet[i].x-before.state.feet[i].x)<4,
   'turning cannot mirror-teleport the old world foot positions');
 }
});

test('a pursuit that ends between paints cannot reuse the previous completed stop anchors',()=>{
 // f262 native performance artifact12135499268, webkit-844x390 actor9:
 // the last stop's boots remained at these world coordinates after retreat.
 const scale=86.30769230769232/480,root=726.863905230166,phase=24.599256761950738;
 const input={time:90.01666666666284,root,phase,scale,settle:1,moving:false,facing:'right'};
 const first=v177RangerFootPlacement(rig,null,{...input,time:input.time-.5});
 const before=v177RangerFootPlacement(rig,first.state,input);
 assert.ok(Math.abs(before.state.feet[0].x-719.6715975378582)<1e-10);
 assert.ok(Math.abs(before.state.feet[1].x-731.3590975378582)<1e-10);
 const next={...input,time:90.7166666666628,root:719.589367630198,phase:24.332410599448785};
 const saved=JSON.stringify(before.state),after=v177RangerFootPlacement(rig,before.state,next);
 assertOriginalLegs(after,1);
 assert.equal(JSON.stringify(before.state),saved);
 assert.equal(after.state.moving,true,'the feet must follow travel since the preceding paint even when the latest simulation tick stopped');
 assert.ok(after.state.feet.some(foot=>foot.height>0),'the correction requires an actual lifted step');
 for(let frame=1,state=after.state;frame<=36;frame++){
  const result=v177RangerFootPlacement(rig,state,{...next,time:next.time+frame/60});
  assertOriginalLegs(result,1);
  for(let i=0;i<2;i++)if(state.feet[i].mode==='plant'&&result.state.feet[i].mode==='plant')
   assert.ok(Math.abs(state.feet[i].x-result.state.feet[i].x)<1e-8,'settling cannot drag its support');
  state=result.state;
  if(frame===36){assert.equal(state.moving,false);assert.deepEqual(state.feet.map(foot=>foot.height),[0,0]);}
 }
});

test('short real movement and stop ticks between every paint keep the original gait and fixed supports',()=>{
 for(const facing of ['right','left'])for(const speed of [-29,29]){
  const scale=.18;let root=330,time=0,runtime=createCombatAnimationRuntime({x:root,y:285,direction:facing});
  const input=()=>({time,root,scale,phase:runtime.locomotionPhase,settle:runtime.locomotionSettle,moving:runtime.moving,facing:runtime.direction});
  let state=v177RangerFootPlacement(rig,null,input()).state;
  time=.5;state=v177RangerFootPlacement(rig,state,input()).state;
  let supports=0,lifts=0;
  for(let paint=0;paint<40;paint++){
   root+=speed/60;
   for(let tick=0;tick<2;tick++){
    time+=1/60;
    runtime=advanceCombatAnimationRuntime(runtime,{x:root,y:285,kind:'ranger',direction:facing,locomotionCycleDistance:scale*cycle},1/60);
   }
   assert.equal(runtime.moving,false,'the actual last simulation tick is stopped');
   const previous=state,unchanged=JSON.stringify(runtime),result=v177RangerFootPlacement(rig,state,input());
   assertOriginalLegs(result,runtime.locomotionSettle);state=result.state;
   assert.equal(JSON.stringify(runtime),unchanged,'presentation cannot rewrite gameplay animation history');
   assert.equal(state.moving,true);
   assert.deepEqual(v177RangerFootPlacement(rig,state,input()),result,'a repeated paint cannot advance the footstep');
   for(let i=0;i<2;i++){
    if(state.feet[i].height>1)lifts++;
    if(previous.feet[i].mode==='plant'&&state.feet[i].mode==='plant'){
     assert.ok(Math.abs(previous.feet[i].x-state.feet[i].x)<1e-8,'short pursuits cannot slide a grounded boot');supports++;
    }
   }
  }
  assert.ok(supports>10&&lifts>10);
 }
});

test('subthreshold drift after walking uses new lifted stop steps instead of retaining an expired goal',()=>{
 for(const drift of [-.04,.04]){
  const scale=.18;let root=330,time=0,runtime=createCombatAnimationRuntime({x:root,y:285,direction:'right'}),state;
  const observe=()=>{
   const previous=state,result=v177RangerFootPlacement(rig,state,{time,root,scale,
    phase:runtime.locomotionPhase,settle:runtime.locomotionSettle,moving:runtime.moving,facing:runtime.direction});
   assertOriginalLegs(result,runtime.locomotionSettle);state=result.state;
   if(previous)for(let i=0;i<2;i++)if(previous.feet[i].mode==='plant'&&state.feet[i].mode==='plant')
    assert.ok(Math.abs(previous.feet[i].x-state.feet[i].x)<1e-8,'corrective steps cannot slide their support');
  };
  observe();
  for(let frame=1;frame<=60;frame++){
   time+=1/60;root+=29/60;
   runtime=advanceCombatAnimationRuntime(runtime,{x:root,y:285,kind:'ranger',direction:'right',locomotionCycleDistance:scale*cycle},1/60);
   observe();
  }
  const phase=runtime.locomotionPhase;let lifted=0;
  for(let frame=1;frame<=480;frame++){
   time+=1/60;root+=drift;
   runtime=advanceCombatAnimationRuntime(runtime,{x:root,y:285,kind:'ranger',direction:'right',locomotionCycleDistance:scale*cycle},1/60);
   assert.equal(runtime.moving,false);assert.equal(runtime.locomotionPhase,phase);
   observe();if(state.feet.some(foot=>foot.height>.1))lifted++;
  }
  assert.ok(lifted>60,'continued small displacements need actual corrective steps');
  for(let frame=0;frame<60;frame++){
   time+=1/60;
   runtime=advanceCombatAnimationRuntime(runtime,{x:root,y:285,kind:'ranger',direction:'right',locomotionCycleDistance:scale*cycle},1/60);
   observe();
  }
  assert.deepEqual(state.feet.map(foot=>foot.height),[0,0]);
  assert.ok(Math.abs(state.feet[0].x-(root+scale*(rig.legs[0].footCenter-24-240)))<1e-8);
  assert.ok(Math.abs(state.feet[1].x-(root+scale*(rig.legs[1].footCenter+24-240)))<1e-8);
 }
});
