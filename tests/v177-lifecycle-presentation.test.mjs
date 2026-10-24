import test from 'node:test';
import assert from 'node:assert/strict';
import { V100_BOSSES } from '../app/v100Registry.js';
import { animationClipFor, sampleAnimationClip } from '../app/combatPresentation.js';
import { mayoRetreatSpriteState, MAYO_RETREAT_TIMING } from '../app/mayoLifecycle.js';
import { v177FallState, createV177LifecyclePresentation } from '../app/v177LifecyclePresentation.js';
import { v177JointActorKey } from '../app/v177JointActorHistory.js';
import { bossPhaseForHp } from '../app/bossFoundation.js';
import { V177_JOINT_ATLASES, v177JointPose, v177CaptureJointPose, drawV177JointPose } from '../app/v177JointPresentation.js';
import { rememberV177TurnedBirth, v177TurnedGetupPose } from '../app/v177TurnedGetupPresentation.js';
const {v177MayoRetreatSample,v177ObserveBossPhase:observePhase,v177PhaseChangePose}=createV177LifecyclePresentation({
  animationClipFor,sampleAnimationClip,mayoRetreatSpriteState,v177JointActorKey,
  atlasFor:kind=>V177_JOINT_ATLASES[kind],v177CaptureJointPose,
});
const v177ObserveBossPhase=(world,actor)=>observePhase(world,actor,bossPhaseForHp(actor.hp,actor.maxHp,actor.kind,actor).phase);

test('protected down/get-up retain the exact original Mayo sample and lifecycle durations',()=>{
  assert.deepEqual(MAYO_RETREAT_TIMING,{fallSeconds:.34,riseSeconds:.22,runSpeed:190});
  for(const [phase,state] of [['fall','down'],['rise','get-up'],['run','retreat']])for(const elapsed of [0,.04,.2]) {
    const actor={mayoRetreat:{phase,phaseElapsed:elapsed}},before=structuredClone(actor);
    const old=sampleAnimationClip('mayo-chan',phase==='run'?'retreat':mayoRetreatSpriteState(actor.mayoRetreat),elapsed);
    const actual=v177MayoRetreatSample(actor);
    assert.equal(actual.requestedState,state);assert.equal(actual.lifecycleOwner,'mayo-retreat');
    for(const key of Object.keys(old).filter(k=>!['requestedState','resolvedState'].includes(k)))assert.deepEqual(actual[key],old[key]);
    assert.deepEqual(actor,before);
  }
  assert.equal(v177FallState(0),'down');assert.equal(v177FallState(.999999),'down');assert.equal(v177FallState(1),'death');
});

test('get-up requires the actual registered infection birth, not ordinary spawn grace',()=>{
  const world={time:12},actor={id:10,kind:'turned',side:'zombie',hp:100,spawnGrace:.5,
    stationAbility:{phase:'idle'},manualAbility:{phase:'idle'},animationPresentation:{direction:'left',locomotionSettle:1}};
  assert.equal(v177TurnedGetupPose(world,actor),null);
  rememberV177TurnedBirth(world,{id:9,kind:'ranger',side:'human'},actor);
  assert.ok(v177TurnedGetupPose(world,actor)?.turnedGetup);
  assert.equal(v177TurnedGetupPose({...world},actor),null);
  actor.attack=.1;assert.equal(v177TurnedGetupPose(world,actor),null);
  actor.attack=0;actor.spawnGrace=0;assert.equal(v177TurnedGetupPose(world,actor),null);
});

test('real boss phase changes nod around the existing neck without moving feet, weapons, other joints or gameplay',()=>{
  for(const boss of V100_BOSSES)for(const part of boss.id==='boss-futago'?['a','b']:[null]) {
    const kind=boss.id.slice(5),form=part?`futago-separated-${part}`:kind,atlas=V177_JOINT_ATLASES[form];
    const actor={id:10,side:'zombie',kind,v100BossId:boss.id,hp:1000,maxHp:1000,v100TwinPart:part,v100TwinEnraged:false};
    const world={time:10},sample={requestedState:'idle'},plan=v177JointPose(form,sample,{locomotionPhase:.31,locomotionSettle:1});
    const original=v177CaptureJointPose(form,plan),before=structuredClone({actor,plan});
    v177ObserveBossPhase(world,actor);
    assert.equal(v177PhaseChangePose(world,actor,form,plan,sample),null);
    if(part)actor.v100TwinEnraged=true;else actor.hp=Math.floor(boss.phaseThresholds[0]*1000);
    v177ObserveBossPhase(world,actor);
    assert.equal(v177PhaseChangePose(world,actor,form,plan,{requestedState:'active'},{ownedPose:true}),null,'committed special retains its pose');
    const first=v177PhaseChangePose(world,actor,form,plan,sample);assert.equal(first.phaseChange.progress,0);
    const d=atlas.parts.find(p=>p.bone==='head').destination,p=atlas.parentAttachments?.head?.pivot??[d.x+d.w/2,d.y+d.h];
    const spine=original.upper[atlas.parentAttachments?.head?.parent??'spine'];
    const neck=[spine[0]*p[0]+spine[2]*p[1]+spine[4],spine[1]*p[0]+spine[3]*p[1]+spine[5]];
    const duration=animationClipFor(form,'phase-change').durationSeconds;
    for(let i=1;i<30;i++) {
      world.time=10+duration*i/30;
      const actual=v177PhaseChangePose(world,actor,form,plan,sample),pose=actual.resolvedJointPose;
      assert.deepEqual(pose.lower,original.lower,form+' original feet and legs');
      for(const [bone,m] of Object.entries(pose.upper)) {
        const old=original.upper[bone];
        if(bone!=='head'&&atlas.parentAttachments?.[bone]?.parent!=='head'){assert.deepEqual(m,old);continue;}
        assert.ok(Math.abs((m[0]*m[3]-m[1]*m[2])-(old[0]*old[3]-old[1]*old[2]))<1e-10,'no shape scaling');
        // Invert the original part matrix to locate its actual neck point;
        // the painted matrix must leave that same point attached to the body.
        const det=old[0]*old[3]-old[1]*old[2],dx=neck[0]-old[4],dy=neck[1]-old[5];
        const lx=(old[3]*dx-old[2]*dy)/det,ly=(-old[1]*dx+old[0]*dy)/det;
        assert.ok(Math.abs(m[0]*lx+m[2]*ly+m[4]-neck[0])<1e-9);
        assert.ok(Math.abs(m[1]*lx+m[3]*ly+m[5]-neck[1])<1e-9);
      }
    }
    world.time=10+duration+.000001;assert.equal(v177PhaseChangePose(world,actor,form,plan,sample),null);
    assert.deepEqual(plan,before.plan);assert.equal(actor.hp,part?1000:Math.floor(boss.phaseThresholds[0]*1000));
    v177ObserveBossPhase(world,actor);assert.equal(v177PhaseChangePose(world,actor,form,plan,sample),null,'same phase does not restart');
  }
});

test('ordinary actors and restored low-HP bosses never invent a phase-change animation',()=>{
  for(const v100BossId of [undefined,'boss-takuya']) {
    const actor={id:1,side:'zombie',kind:'takuya',hp:50,maxHp:1000,v100BossId},world={time:10};
    const sample={requestedState:'idle'},plan=v177JointPose('takuya',sample,{locomotionPhase:0,locomotionSettle:1});
    v177ObserveBossPhase(world,actor);assert.equal(v177PhaseChangePose(world,actor,'takuya',plan,sample),null);
  }
});

test('actual painted hit/stun history never accumulates the phase dip or loses the visible corpse source',()=>{
  for(const status of ['hit-light','incapacitated']) {
    const world={time:10},actor={id:10,kind:'takuya',side:'zombie',hp:100,maxHp:100,v100BossId:'boss-takuya'};
    const runtime={locomotionPhase:.31,locomotionSettle:1,elapsedSeconds:0};
    const ctx=new Proxy({},{get:()=>()=>{}}),image={naturalWidth:2048};
    const initial=v177JointPose('takuya',{requestedState:'idle'},runtime,{actor,world});
    v177ObserveBossPhase(world,actor);actor.hp=70;v177ObserveBossPhase(world,actor);
    const neutral=v177CaptureJointPose('takuya',initial).upper.head;
    let painted=v177PhaseChangePose(world,actor,'takuya',initial,{requestedState:'idle'});
    assert.equal(drawV177JointPose(ctx,image,'takuya',painted,0,0,100,100,{actor,world}),true);
    for(let i=1;i<=8;i++) {
      world.time=10+i/60;runtime.elapsedSeconds=i/60;
      const sample=sampleAnimationClip('takuya',status,i/60),base=v177JointPose('takuya',sample,runtime,{actor,world,stunRemaining:1-i/60});
      painted=v177PhaseChangePose(world,actor,'takuya',base,sample);
      const raw=v177CaptureJointPose('takuya',base).upper.head,actual=v177CaptureJointPose('takuya',painted).upper.head;
      const delta=Math.atan2(actual[1],actual[0])-Math.atan2(raw[1],raw[0]);
      assert.ok(Math.abs(delta-painted.phaseChange.angle)<1e-10,'one phase rotation per actual frame');
      if(status==='hit-light')assert.ok(Math.abs(Math.atan2(actual[1],actual[0])-Math.atan2(neutral[1],neutral[0]))<=.12);
      drawV177JointPose(ctx,image,'takuya',painted,0,0,100,100,{actor,world});
    }
    assert.notDeepEqual(v177CaptureJointPose('takuya',painted),v177CaptureJointPose('takuya',painted.phaseChangeBasePlan),
      'postpaint/corpse capture still receives the actually visible pose');
  }
});
