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
