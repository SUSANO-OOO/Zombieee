import test from 'node:test';
import assert from 'node:assert/strict';
import {spriteKinds} from '../app/spriteManifest.js';
import {sampleAnimationClip,sampleAttackPresentation,animationClipFor,createCombatAnimationRuntime,advanceCombatAnimationRuntime} from '../app/combatPresentation.js';
import {V102_MOTION_GROUPS,v102CombatMotionSample,v102GroundLift,v102TravelCycleDistance,v102BattleBodyScale} from '../app/v102CombatMotion.js';

test('all allies, enemies and alternate bodies retain anatomy throughout locomotion and actions',()=>{
  assert.deepEqual(Object.keys(V102_MOTION_GROUPS).sort(),[...spriteKinds].sort());
  for(const kind of spriteKinds)for(const state of ['idle','move','wind-up','active','recovery','hit-heavy'])for(const p of [0,.25,.5,.9]){
    const s=sampleAnimationClip(kind,state,animationClipFor(kind,state).durationSeconds*p);
    const r=v102CombatMotionSample(kind,s);
    assert.equal(r.bodyScale,s.bodyScale,kind+' preserves its authored character scale');assert.equal(r.bodyScale,v102BattleBodyScale(kind),kind);assert.equal(r.pose.scaleX,1,kind);assert.equal(r.pose.scaleY,1,kind);assert.equal(r.pose.offsetY,0,kind);
    if(state==='recovery')assert.notEqual(r.spriteState,'attack-a',kind);
    if(V102_MOTION_GROUPS[kind]!=='floating')assert.equal(v102GroundLift(kind,r,1.8),0,kind);
    assert.ok(v102TravelCycleDistance(kind,80)>=9);
  }
});
test('ordinary motion and native contact retain the original boss, heavy ally and animal sizes',()=>{
  for(const [kind,scale]of [['mother',2.38],['gairen',2.45],['kurome',1.95],['crusher',1.1],['guardian',1.14],['mayo-chan',.82]]){
    const moving=v102CombatMotionSample(kind,sampleAnimationClip(kind,'move',.1));
    const contact=v102CombatMotionSample(kind,sampleAnimationClip(kind,'active',0),{ownedPose:true});
    assert.equal(v102BattleBodyScale(kind),scale);assert.equal(moving.bodyScale,scale);assert.equal(contact.bodyScale,scale);
  }
});
test('enemy contact follows its actual attack timer and does not restart its windup',()=>{
  for(const kind of spriteKinds)for(const remaining of [.18,.16,.12,.08,.03]){
    const s=sampleAttackPresentation(kind,.2);
    const r=v102CombatMotionSample(kind,s,{side:'zombie',attack:remaining});
    assert.equal(r.spriteState,remaining>.06?'attack-b':'idle',kind);
  }
});

test('authored enemy walking frames and articulated feet share the configured travel distance',()=>{
  for(const kind of spriteKinds){
    const stride=v102TravelCycleDistance(kind,80),observation={kind,moving:true,x:0,y:0,locomotionCycleDistance:stride};
    const ready=advanceCombatAnimationRuntime(createCombatAnimationRuntime(observation),{...observation,state:'move'},0);
    const moved=advanceCombatAnimationRuntime(ready,{...observation,x:stride},.05);
    assert.equal(moved.locomotionPhase,1,kind);
    assert.ok(Math.abs(moved.elapsedSeconds-animationClipFor(kind,'move').durationSeconds)<1e-8,kind);
    const held=advanceCombatAnimationRuntime(moved,{...observation,x:stride},.05);
    assert.equal(held.elapsedSeconds,moved.elapsedSeconds,'elapsed wall time alone cannot move feet');
  }
});
test('owned guards, sequential combos, boss actions and retreat keep their existing socket contract',()=>{
  for(const kind of spriteKinds){const s=sampleAnimationClip(kind,'special',.2);assert.equal(v102CombatMotionSample(kind,s,{ownedPose:true,side:'zombie',attack:.18}),s);}
});
