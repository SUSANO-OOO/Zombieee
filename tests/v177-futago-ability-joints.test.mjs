import test from 'node:test';
import assert from 'node:assert/strict';
import { V177_JOINT_ATLASES, v177JointPose, drawV177JointPose } from '../app/v177JointPresentation.js';
import { BOSS_ANOMALY_TUNING, createBossAnomalyRuntime, beginBossAnomalyAbility,
  advanceBossAnomalyAbility } from '../app/bossAnomalies.js';

// Pure renderer/runtime regression: Canvas command mocks prove neither native
// pixels nor continuous original-speed appearance or performance.
const tuning=BOSS_ANOMALY_TUNING.futago;
function draw(f,pose,{fail=false}={}) {
  const atlas=V177_JOINT_ATLASES[f.kind],matrices=[],parts=[];let depth=0;
  const ctx={save(){depth++;},restore(){depth--;},translate(){},scale(){},
    transform(...matrix){matrices.push(matrix);},
    drawImage(_image,...rect){if(fail)throw new Error('fixture draw failure');parts.push(rect);}};
  assert.equal(drawV177JointPose(ctx,{naturalWidth:atlas.decodedWidth??1024},f.kind,pose,
    0,0,480,448,{actor:f.actor,world:f.world}),true);
  assert.equal(depth,0);assert.equal(parts.length,16);assert.equal(parts.length,atlas.parts.length);
  return {matrices,parts};
}
function delta(a,b) {
  assert.equal(a.matrices.length,b.matrices.length);assert.deepEqual(a.parts,b.parts);
  return Math.max(...a.matrices.flatMap((m,i)=>m.map((n,j)=>Math.abs(n-b.matrices[i][j]))));
}
function fixture(part='a',{state='move',progress=.3}={}) {
  const actor={id:part==='a'?1:2,kind:'futago',side:'zombie',v100BossId:'boss-futago',v100TwinPair:0,
    v100TwinPart:part,hp:100,maxHp:100,x:610,y:282,lane:1,combatReady:true,attackSequence:0,abilityWindup:0,
    stationAbility:createBossAnomalyRuntime('futago')};
  const runtime={state,elapsedSeconds:0,transitionCount:0,locomotionPhase:.137,locomotionSettle:.4};
  actor.animationPresentation=runtime;
  const f={actor,runtime,kind:'futago-separated-'+part,world:{time:0,fighters:[actor]}};
  f.previous=draw(f,v177JointPose(f.kind,{requestedState:state,clipProgress:progress},runtime,{actor,world:f.world}));
  const begun=beginBossAnomalyAbility({boss:actor,candidates:[{id:3,kind:'guardian',side:'human',hp:100,x:400,y:282,lane:1}]});
  assert.equal(begun.ok,true);actor.stationAbility=begun.runtime;return f;
}
function advance(f,dt) {
  const result=advanceBossAnomalyAbility(f.actor.stationAbility,dt);
  f.actor.stationAbility=result.runtime;f.world.time+=dt;
  // Consume the original event exactly as the gameplay owner does.
  if(result.events.includes('activate'))f.actor.attackSequence++;
  return result.events;
}
function plan(f,extra={}) {
  return v177JointPose(f.kind,{requestedState:'idle'},f.runtime,{actor:f.actor,world:f.world,
    ownedPose:f.actor.stationAbility.phase!=='idle',futagoAbilityOwner:f.actor.stationAbility.phase!=='idle',
    futagoAbilityTuning:tuning,...extra});
}

test('formal separated a/b use the real anomaly clocks and paint all16 original parts in all3 phases',()=>{
  assert.deepEqual([tuning.warningSeconds,tuning.activeSeconds,tuning.recoverySeconds,tuning.cooldownSeconds],[1.2,3.6,.9,7]);
  for(const part of ['a','b']) {
    const f=fixture(part);
    for(const [phase,duration,event] of [['warning',tuning.warningSeconds,'activate'],['active',tuning.activeSeconds,'recover'],['recovery',tuning.recoverySeconds,'complete']]) {
      assert.equal(f.actor.stationAbility.phase,phase);
      for(const dt of [0,duration/2]) {
        advance(f,dt);const before=structuredClone(f.actor),q=plan(f);
        assert.equal(q.futagoAbilityJoint.phase,phase);assert.equal(q.futagoAbilityJoint.part,part);
        assert.equal(q.futagoAbilityJoint.pairId,0);assert.equal(q.futagoAbilityJoint.remaining,f.actor.stationAbility.remainingSeconds);
        draw(f,q);assert.deepEqual(f.actor,before,'render never mutates the actor or its clocks');
      }
      assert.deepEqual(advance(f,duration/2),[event]);
    }
    assert.equal(f.actor.stationAbility.phase,'idle');assert.equal(plan(f).futagoAbilityJoint,undefined);
  }
});

test('actual warning/active/recovery and true idle boundaries meet the last successful paint',()=>{
  const epsilon=1e-9;
  for(const part of ['a','b'])for(const state of ['move','active','recovery']) {
    const f=fixture(part,{state,progress:.61});assert.equal(delta(f.previous,draw(f,plan(f))),0);
    for(const duration of [tuning.warningSeconds,tuning.activeSeconds,tuning.recoverySeconds]) {
      advance(f,duration-epsilon);const before=draw(f,plan(f));advance(f,2*epsilon);
      const after=draw(f,plan(f));assert.ok(delta(before,after)<1e-5,'source matrices remain continuous at the real phase boundary');
    }
    assert.equal(f.actor.stationAbility.phase,'idle','test the actual idle state, not near-end recovery');
    assert.equal(plan(f).futagoAbilityJoint,undefined);
  }
});

test('typed ability paint enters the existing living-stun return without an authored-normal-attack snap',()=>{
  for(const part of ['a','b']) {
    const f=fixture(part,{state:'active',progress:.68});draw(f,plan(f));advance(f,.5);
    const held=draw(f,plan(f));f.actor.stationAbility=createBossAnomalyRuntime('futago');
    f.runtime.elapsedSeconds=10;f.runtime.transitionCount=3;
    const sample={requestedState:'incapacitated'},options={actor:f.actor,world:f.world,stunRemaining:.42};
    const first=draw(f,v177JointPose(f.kind,sample,f.runtime,options));assert.equal(delta(held,first),0);
    f.runtime.elapsedSeconds+=1e-7;
    const next=draw(f,v177JointPose(f.kind,sample,f.runtime,{...options,stunRemaining:.42-1e-7}));
    assert.ok(delta(first,next)<1e-4,'typed marker must avoid the generic authored attack return');
  }
});

test('legacy fused, foreign identity, competing owner and invalid source clocks retain the owned-pose guard',()=>{
  for(const mutate of [
    f=>{f.kind='futago';f.actor.v100TwinPart=undefined;},
    f=>{f.actor.v100TwinPart='b';},f=>{f.actor.v100BossId='boss-other';},
    f=>{f.actor.v100TwinPair=-1;},f=>{f.actor.v100TwinPair=.5;},f=>{f.actor.side='human';},
    f=>{f.actor.hp=0;},f=>{f.actor.combatReady=false;},f=>{f.actor.contained=true;},
    f=>{f.actor.abilityWindup=.1;},f=>{f.actor.stationAbility={...f.actor.stationAbility,kind:'gairen'};},
    f=>{f.actor.stationAbility={...f.actor.stationAbility,remainingSeconds:9};},
  ]) {const f=fixture();mutate(f);assert.equal(plan(f),null);}
  const f=fixture();assert.equal(plan(f,{futagoAbilityOwner:false}),null,'a different authored owner keeps the generic guard');
  assert.equal(v177JointPose('gairen',{},f.runtime,{actor:f.actor,world:f.world,ownedPose:true,futagoAbilityOwner:true,futagoAbilityTuning:tuning}),null);
});

test('only successful actual paints publish entry history; same-ID clones retain it and new worlds cannot borrow it',()=>{
  const f=fixture('a',{state:'active',progress:.5});
  plan(f);assert.throws(()=>draw(f,plan(f),{fail:true}),/fixture draw failure/);
  advance(f,.4);const first=plan(f);assert.equal(first.futagoAbilityJoint.entry.elapsed,.4);
  const actual=draw(f,first);assert.equal(delta(f.previous,actual),0,'unpainted or failed plans cannot replace the source entry');
  f.actor={...f.actor};f.world.fighters=[f.actor];
  const clone=plan(f);assert.equal(clone.futagoAbilityJoint.entry.elapsed,.4);assert.equal(delta(actual,draw(f,clone)),0);
  f.world={time:f.world.time,fighters:[f.actor]};
  assert.equal(plan(f).futagoAbilityJoint.entryPaintBound,false,'new-world history is unavailable rather than borrowed');
});
