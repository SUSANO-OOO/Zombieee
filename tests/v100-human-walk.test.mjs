import test from 'node:test';
import assert from 'node:assert/strict';
import {v100PaisenWalkPose,v100PaisenWalkCycleDistance,v100HumanWalkPhase} from '../app/v100HumanWalk.js';
import {createCombatAnimationRuntime,advanceCombatAnimationRuntime} from '../app/combatPresentation.js';
test('the two feet exchange contact, clear the ground, and keep anatomical segment lengths',()=>{
  const first=v100PaisenWalkPose(0),opposite=v100PaisenWalkPose(.5);
  assert.ok(first.near.point[0]>first.far.point[0]);assert.ok(opposite.near.point[0]<opposite.far.point[0]);
  for(let i=0;i<240;i++){
    const pose=v100PaisenWalkPose(i/240);
    assert.ok(pose.near.planted||pose.far.planted,'walk keeps a supporting foot');
    for(const limb of [pose.near,pose.far]){
      assert.ok(limb.point[1]<=564);assert.equal(limb.planted,limb.point[1]===564);
      assert.ok(Math.abs(Math.hypot(limb.knee[0]-limb.hip[0],limb.knee[1]-limb.hip[1])-pose.upper)<.001);
      assert.ok(Math.abs(Math.hypot(limb.point[0]-limb.knee[0],limb.point[1]-limb.knee[1])-pose.lower)<.001);
    }
  }
});
test('starting and stopping preserve travel phase and settle a supporting foot without resetting the gait',()=>{
  let r=createCombatAnimationRuntime({x:0,y:0});
  r=advanceCombatAnimationRuntime(r,{kind:'brawler',x:8,y:0},.1);
  assert.equal(r.locomotionTravelDistance,8);
  r=advanceCombatAnimationRuntime(r,{kind:'brawler',x:16,y:0},.1);
  const before=v100HumanWalkPhase(r,.15);
  r=advanceCombatAnimationRuntime(r,{kind:'brawler',x:16,y:0},.1);
  assert.equal(r.state,'stop-move');assert.equal(v100HumanWalkPhase(r,.15),before);
  const settled=v100HumanWalkPhase({...r,elapsedSeconds:.18},.15);
  assert.equal(settled,Math.round(before*2)/2);
  assert.equal(r.locomotionTravelDistance,16);
});
test('a planted foot remains at one world position as the character advances, at different body scales',()=>{
  for(const scale of [.12,.15,.18])for(const [a,b] of [[.02,.15],[.2,.4],[.43,.58]]){
    const distance=v100PaisenWalkCycleDistance(scale);
    const footAt=p=>p*distance+v100PaisenWalkPose(p).near.point[0]*scale;
    assert.ok(Math.abs(footAt(a)-footAt(b))<1e-8);
  }
  assert.deepEqual(v100PaisenWalkPose(0),v100PaisenWalkPose(1),'cycle joins without a leg reset');
});
