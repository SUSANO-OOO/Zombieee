import test from 'node:test';
import assert from 'node:assert/strict';
import {v100PaisenWalkPose,v100PaisenWalkCycleDistance,v100HumanWalkPhase,v100UsesHumanWalk} from '../app/v100HumanWalk.js';
import {createCombatAnimationRuntime,advanceCombatAnimationRuntime,sampleAnimationClip,sampleAttackPresentation,animationClipFor} from '../app/combatPresentation.js';
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
  for(const phase of [.04,.22,.4,.61,.89]) {
    const distance=v100PaisenWalkCycleDistance(.15),x=phase*distance;
    let r=createCombatAnimationRuntime({x:0,y:0});
    r=advanceCombatAnimationRuntime(r,{kind:'brawler',x,y:0,locomotionCycleDistance:distance},.1);
    r=advanceCombatAnimationRuntime(r,{kind:'brawler',x,y:0,locomotionCycleDistance:distance},.2);
    assert.equal(r.state,'stop-move');assert.ok(Math.abs(v100HumanWalkPhase(r)-phase)<1e-10);
    r=advanceCombatAnimationRuntime(r,{kind:'brawler',x,y:0,locomotionCycleDistance:distance},.15);
    const beforeIdle=v100HumanWalkPhase(r);
    r=advanceCombatAnimationRuntime(r,{kind:'brawler',x,y:0,locomotionCycleDistance:distance},.04);
    assert.equal(r.state,'idle');const settled=Math.round(phase*2)/2;
    assert.equal(v100HumanWalkPhase(r),settled);assert.ok(Math.abs(settled-beforeIdle)<.02);
    r=advanceCombatAnimationRuntime(r,{kind:'brawler',x:x+1,y:0,locomotionCycleDistance:distance},.02);
    assert.ok(Math.abs(v100HumanWalkPhase(r)-(settled+1/distance))<1e-10);
  }
});
test('moving attacks and the sequential combo retain their attack art',()=>{
  for(const clip of ['wind-up','active','recovery','special','hit-light','death']) {
    const duration=animationClipFor('brawler',clip).durationSeconds;
    for(const p of [0,.25,.5,.75,.99])assert.equal(v100UsesHumanWalk('brawler',sampleAnimationClip('brawler',clip,duration*p)),false,clip);
  }
  for(const p of [0,.04,.08,.12,.18])assert.equal(v100UsesHumanWalk('brawler',sampleAttackPresentation('brawler',p)),false);
  for(const clip of ['idle','move','start-move','stop-move','turn'])assert.equal(v100UsesHumanWalk('brawler',sampleAnimationClip('brawler',clip,0)),true);
  assert.equal(v100UsesHumanWalk('brawler',sampleAnimationClip('brawler','move',0),{manualAbilityActive:true}),false);
});
test('a planted foot remains at one world position as the character advances, at different body scales',()=>{
  for(const scale of [.12,.15,.18])for(const [a,b] of [[.02,.15],[.2,.4],[.43,.58]]){
    const distance=v100PaisenWalkCycleDistance(scale);
    const footAt=p=>p*distance+v100PaisenWalkPose(p).near.point[0]*scale;
    assert.ok(Math.abs(footAt(a)-footAt(b))<1e-8);
  }
  assert.deepEqual(v100PaisenWalkPose(0),v100PaisenWalkPose(1),'cycle joins without a leg reset');
});
