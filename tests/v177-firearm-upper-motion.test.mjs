import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {V177_JOINT_ATLASES as atlases,v177JointPose,v177CaptureJointPose,
  drawV177JointPose,v177RenderedJointWeaponSocket} from '../app/v177JointPresentation.js';
import {animationClipFor,sampleAttackPresentation,weaponDamageEventsFor,
  advancePendingWeaponHits,cancelPendingWeaponTransaction} from '../app/combatPresentation.js';
import {spriteFrameFor,spriteKinds} from '../app/spriteManifest.js';

const kinds=['medic','engineer'],states=['wind-up','active','recovery'];
const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const runtime={locomotionPhase:.37,locomotionSettle:1};
const original=plan=>{const result={...plan};delete result.firearmUpperTransform;return result;};
const parts=kind=>JSON.parse(fs.readFileSync('assets/source/v100/joints/'+kind+'-r1/parts.json'));

function record(kind,plan,{actor,world,scale=1,direction='right',x=0,y=0}={}){
  let m=[1,0,0,1,x,y];const stack=[],calls=[];
  const multiply=b=>{const a=m;m=[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],
    a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];};
  const ctx={save(){stack.push([...m]);},restore(){m=stack.pop();},
    translate(a,b){multiply([1,0,0,1,a,b]);},scale(a,b){multiply([a,0,0,b,0,0]);},
    transform(...t){multiply(t);},drawImage(){calls.push([...m]);}};
  const frame={...spriteFrameFor(kind,'walk-a',direction),flipX:direction==='left'},size={w:480*scale,h:448*scale};
  if(direction==='left')ctx.scale(-1,1);
  assert.equal(drawV177JointPose(ctx,{naturalWidth:atlases[kind].decodedWidth},kind,plan,
    -size.w*frame.anchorX,-size.h*frame.anchorY,size.w,size.h,{actor,world}),true);
  return{calls,frame,size};
}

function joins(kind,pose){
  for(const arm of atlases[kind].armConstraints){
    const upper=pose.upper[arm.upperBone],lower=pose.upper[arm.lowerBone],
      parent=pose.upper[arm.parentBone],weapon=pose.upper[arm.effectorBone];
    assert.ok(distance(point(upper,arm.shoulder),point(parent,arm.shoulder))<1e-9);
    assert.ok(distance(point(upper,arm.elbow),point(lower,arm.elbow))<1e-9);
    assert.ok(distance(point(lower,arm.wrist),point(weapon,arm.effectorWrist??arm.wrist))<1e-9);
    assert.ok(Math.abs(distance(point(upper,arm.shoulder),point(upper,arm.elbow))-distance(arm.shoulder,arm.elbow))<1e-9);
    assert.ok(Math.abs(distance(point(lower,arm.elbow),point(lower,arm.wrist))-distance(arm.elbow,arm.wrist))<1e-9);
  }
}

test('actual Nao/Monkey draw plans lean into ready, recoil visibly, and recover on the original shot clock',()=>{
  for(const kind of kinds){
    const duration=Object.fromEntries(states.map(s=>[s,animationClipFor(kind,s).durationSeconds]));
    const angles=[];
    for(let n=0;n<=30;n++){
      const t=n/100,state=t<duration.active?'active':'recovery',elapsed=state==='active'?t:t-duration.active;
      if(elapsed>duration[state])continue;
      const plan=v177JointPose(kind,{requestedState:state,clipProgress:elapsed/duration[state]},runtime),
        pose=v177CaptureJointPose(kind,plan),angle=Math.atan2(pose.upper.spine[1],pose.upper.spine[0]);
      angles.push({t,angle});
    }
    assert.ok(angles[0].angle>0,'ready leans forward before the impulse');
    assert.ok(Math.min(...angles.map(p=>p.angle))<-.05,'actual torso rotates with the backward impulse');
    const held=angles.filter(p=>p.angle<-.015);
    assert.ok(held.at(-1).t-held[0].t>=.08,'body follow-through remains readable beyond one 25fps frame');
    assert.ok(Math.abs(angles.at(-1).angle)<.001,'body returns to its ready angle');
    const peak=v177JointPose(kind,{requestedState:'active',clipProgress:.3},runtime),plain=original(peak),
      shot=record(kind,peak),base=record(kind,plain),head=atlases[kind].parts.findIndex(p=>p.name==='head');
    assert.ok(point(shot.calls[head],[260,50])[0]<point(base.calls[head],[260,50])[0]-7,'actual painted head follows the recoil');
  }
});

test('all original feet and the resolved waist stay fixed while both complete arm chains and source bag follow together',()=>{
  for(const kind of kinds){const data=parts(kind);
    for(const r of [runtime,{locomotionPhase:.83,locomotionSettle:.45}])
      for(const state of states)for(let n=0;n<=120;n++){
        const plan=v177JointPose(kind,{requestedState:state,clipProgress:n/120},r),
          pose=v177CaptureJointPose(kind,plan),baseline=v177CaptureJointPose(kind,original(plan));
        assert.deepEqual(pose.lower,baseline.lower);joins(kind,pose);
        assert.ok(distance(point(pose.upper.spine,data.rig.spine[0]),point(baseline.upper.spine,data.rig.spine[0]))<1e-9);
        for(const bone of ['head',...(kind==='medic'?['bag']:[])]){
          const source=[data.rig.spine[0][0],100];
          assert.ok(Math.abs(distance(point(pose.upper[bone],source),point(pose.upper.spine,data.rig.spine[0]))
            -distance(point(baseline.upper[bone],source),point(baseline.upper.spine,data.rig.spine[0])))<1e-9);
        }
      }
  }
});

test('normal shot endpoints and both phase joins have continuous actual matrices, with no change to other action owners',()=>{
  for(const kind of kinds){
    for(const [a,b]of [['wind-up','active'],['active','recovery']]){
      const before=v177CaptureJointPose(kind,v177JointPose(kind,{requestedState:a,clipProgress:1},runtime)),
        after=v177CaptureJointPose(kind,v177JointPose(kind,{requestedState:b,clipProgress:0},runtime));
      for(const layer of ['lower','upper'])for(const bone of Object.keys(before[layer]))
        before[layer][bone].forEach((v,i)=>assert.ok(Math.abs(v-after[layer][bone][i])<1e-9));
    }
    for(const [state,p]of [['wind-up',0],['recovery',1]]){
      const plan=v177JointPose(kind,{requestedState:state,clipProgress:p},runtime);
      assert.equal(plan.firearmUpperTransform,undefined);
    }
    for(const state of ['idle','move','deploy','turn','retreat','reload','weapon-cycle'])
      assert.equal(v177JointPose(kind,{requestedState:state,clipProgress:.3},runtime).firearmUpperTransform,undefined);
    for(const state of ['ability','death','collapse','transform'])
      assert.equal(v177JointPose(kind,{requestedState:state,clipProgress:.3},runtime),null);
    assert.equal(v177JointPose(kind,{requestedState:'active',clipProgress:.3},runtime,{ownedPose:true}),null);
  }
  for(const kind of spriteKinds.filter(k=>!kinds.includes(k)&&k!=='gunner'))for(const state of states)
    assert.equal(v177JointPose(kind,{requestedState:state,clipProgress:.3},runtime)?.firearmUpperTransform,undefined);
});

test('new shoulder/body recoil shares the painted muzzle in both directions at the three sprite scales',()=>{
  for(const kind of kinds)for(const state of states)for(const p of [.12,.3,.8])
    for(const direction of ['left','right'])for(const scale of [.12,.16,.2]){
      const plan=v177JointPose(kind,{requestedState:state,clipProgress:p},runtime),
        {calls,frame,size}=record(kind,plan,{direction,scale,x:300,y:500}),
        weapon=atlases[kind].parts.findIndex(p=>p.name==='weapon-and-hands'),
        painted=point(calls[weapon],atlases[kind].muzzle),
        socket=v177RenderedJointWeaponSocket({kind,plan,direction,frame,size,x:300,y:500,
          pose:{offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotationRadians:0}});
      assert.ok(distance(painted,[socket.x,socket.y])<1e-9);
    }
});

test('actually painted recoil survives a hit and enters or leaves living stun without a body or grip jump',()=>{
  for(const kind of kinds)for(const state of states)for(const p of [.1,.3,.8]){
    const actor={},r={...runtime,elapsedSeconds:4,transitionCount:3},
      source=v177JointPose(kind,{requestedState:state,clipProgress:p},r,{actor});
    record(kind,source,{actor});
    const hit=v177JointPose(kind,{requestedState:'hit-light'},r,{actor});
    assert.deepEqual(v177CaptureJointPose(kind,hit),v177CaptureJointPose(kind,source));
    record(kind,hit,{actor});
    for(const t of [0,.005,.025,.06,.1,.12,.2,.6,.79]){
      const plan=v177JointPose(kind,{requestedState:'incapacitated'},
        {...r,elapsedSeconds:4+t},{actor,stunRemaining:.8-t}),pose=v177CaptureJointPose(kind,plan);
      if(t===0)assert.deepEqual(pose,v177CaptureJointPose(kind,source));
      joins(kind,pose);record(kind,plan,{actor});
      const baseline=v177CaptureJointPose(kind,original(source));
      for(const part of atlases[kind].parts)if(!part.upper)
        pose.lower[part.bone].forEach((v,i)=>assert.ok(Math.abs(v-baseline.lower[part.bone][i])<1e-9,
          'Every actually painted lower part keeps its original transform through stun'));
    }
  }
});

test('Nao and Monkey yield both elbows as the weapon recoils relative to the torso, with the painted muzzle following',()=>{
  for(const kind of kinds){
    const plan=v177JointPose(kind,{requestedState:'active',clipProgress:.3},runtime),plain={...plan};
    delete plain.firearmWeaponPullback;
    const pose=v177CaptureJointPose(kind,plan),baseline=v177CaptureJointPose(kind,plain),atlas=atlases[kind];
    assert.deepEqual(pose.lower,baseline.lower);assert.deepEqual(pose.upper.spine,baseline.upper.spine);joins(kind,pose);
    const muzzle=point(pose.upper[atlas.weaponBone],atlas.muzzle),oldMuzzle=point(baseline.upper[atlas.weaponBone],atlas.muzzle),
      wrist=point(baseline.upper[atlas.weaponBone],atlas.armConstraints[0].effectorWrist??atlas.armConstraints[0].wrist),
      dx=oldMuzzle[0]-wrist[0],dy=oldMuzzle[1]-wrist[1],length=Math.hypot(dx,dy);
    assert.ok(((muzzle[0]-oldMuzzle[0])*dx+(muzzle[1]-oldMuzzle[1])*dy)/length<-10,
      'weapon moves backwards along its actual barrel, relative to the unchanged torso');
    for(const arm of atlas.armConstraints){
      assert.ok(distance(point(pose.upper[arm.upperBone],arm.elbow),
        point(baseline.upper[arm.upperBone],arm.elbow))>1,'both original elbows yield instead of translating rigidly');
      assert.ok(distance(point(pose.upper[arm.upperBone],arm.shoulder),
        point(baseline.upper[arm.upperBone],arm.shoulder))<1e-9);
    }
    for(const direction of ['left','right'])for(const scale of [.12,.16,.2]){
      const {calls,frame,size}=record(kind,plan,{direction,scale,x:300,y:500}),
        weapon=atlas.parts.findIndex(p=>p.name==='weapon-and-hands'),painted=point(calls[weapon],atlas.muzzle),
        socket=v177RenderedJointWeaponSocket({kind,plan,direction,frame,size,x:300,y:500,
          pose:{offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotationRadians:0}});
      assert.ok(distance(painted,[socket.x,socket.y])<1e-9);
    }
    for(const state of ['idle','move','wind-up','ability','deploy','reload','weapon-cycle'])
      assert.equal(v177JointPose(kind,{requestedState:state,clipProgress:.3},runtime)?.firearmWeaponPullback,undefined);
    assert.equal(v177JointPose(kind,{requestedState:'recovery',clipProgress:1},runtime).firearmWeaponPullback,undefined);
  }
  assert.equal(v177JointPose('gunner',{requestedState:'active',clipProgress:.3},runtime).firearmWeaponPullback,undefined);
});

const gunnerEvents=weaponDamageEventsFor('gunner',13),gunnerActor=Object.freeze({id:17});
// Fixtures use the existing released Shot fields. Pending entries alone are not shots.
function gunnerShots(events,t){
  return events.filter(e=>e.offsetSeconds<=t).map(e=>{
    const duration=Math.max(.01,e.travelSeconds)+e.hitStopSeconds+.16;
    return Object.freeze({sourceId:17,side:'human',weapon:'gunner',style:'projectile',
      shotIndex:e.shotIndex,duration,life:duration-(t-e.offsetSeconds)});
  });
}
function gunnerPlan(t,shots=gunnerShots(gunnerEvents,t)){
  return v177JointPose('gunner',sampleAttackPresentation('gunner',t),runtime,
    {actor:gunnerActor,world:{shots}});
}
const upperAngle=plan=>Math.atan2(v177CaptureJointPose('gunner',plan).upper.spine[1],
  v177CaptureJointPose('gunner',plan).upper.spine[0]);

test('Gunner recoils for each released round, while canceled future rounds and duplicate traces create no extra kick',()=>{
  assert.deepEqual(gunnerEvents.map(e=>e.offsetSeconds),[0,.055,.11]);
  assert.ok(Math.abs(gunnerEvents.reduce((n,e)=>n+e.damage,0)-13)<1e-12);
  let pending=gunnerEvents.map(e=>({...e,remainingSeconds:e.offsetSeconds,transactionId:'burst'}));
  for(const [index,dt]of [[0,0],[1,.055],[2,.055]]){
    const advanced=advancePendingWeaponHits(pending,dt);pending=advanced.pending;
    assert.deepEqual(advanced.due.map(e=>e.shotIndex),[index]);
    const t=gunnerEvents[index].offsetSeconds+.016,shots=gunnerShots(gunnerEvents,t),
      actual=gunnerPlan(t,shots),baseline=gunnerPlan(t,[]);
    assert.ok(upperAngle(actual)<upperAngle(baseline)-.07,'each released round moves the actual torso');
    assert.deepEqual(gunnerPlan(t,[...shots,...shots]),actual,'multi-target traces cannot multiply body recoil');
    if(index)assert.ok(upperAngle(gunnerPlan(t,gunnerShots(gunnerEvents.slice(0,1),t)))
      >upperAngle(actual)+.06,'canceled later rounds have no fabricated impulse');
  }
  const canceled=cancelPendingWeaponTransaction(gunnerEvents.slice(1).map(e=>({
    ...e,remainingSeconds:e.offsetSeconds,transactionId:'burst'})),'burst');
  assert.deepEqual(advancePendingWeaponHits(canceled,.12).due,[]);
  assert.deepEqual(advancePendingWeaponHits(gunnerEvents.map(e=>({
    ...e,remainingSeconds:e.offsetSeconds})),.12).due.map(e=>e.shotIndex),[0,1,2]);
});

test('Gunner actual paint keeps both arm chains, planted lower parts, waist and muzzle attached through all three kicks',()=>{
  const data=parts('gunner'),atlas=atlases.gunner,weapon=atlas.parts.findIndex(p=>p.name==='weapon-and-hands');
  for(const event of gunnerEvents)for(const direction of ['left','right'])for(const scale of [.12,.16,.2]){
    const plan=gunnerPlan(event.offsetSeconds+.016),pose=v177CaptureJointPose('gunner',plan),
      plain=original(plan),baseline=v177CaptureJointPose('gunner',plain),
      shot=record('gunner',plan,{direction,scale,x:300,y:500}),
      base=record('gunner',plain,{direction,scale,x:300,y:500});
    joins('gunner',pose);assert.deepEqual(pose.lower,baseline.lower);
    assert.ok(distance(point(pose.upper.spine,data.rig.spine[0]),point(baseline.upper.spine,data.rig.spine[0]))<1e-9);
    for(let i=0;i<atlas.parts.length;i++)if(!atlas.parts[i].upper)assert.deepEqual(shot.calls[i],base.calls[i]);
    const painted=point(shot.calls[weapon],atlas.muzzle),socket=v177RenderedJointWeaponSocket({
      kind:'gunner',plan,direction,frame:shot.frame,size:shot.size,x:300,y:500,
      pose:{offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotationRadians:0}});
    assert.ok(distance(painted,[socket.x,socket.y])<1e-9);
  }
});

test('Gunner release edges and active/recovery handover are continuous; unsupported owners cannot drive normal recoil',()=>{
  for(const t of [0,.012,.055,.067,.08,.11,.122,.135,.165,.19,.275]){
    const before=v177CaptureJointPose('gunner',gunnerPlan(Math.max(0,t-1e-8))),
      after=v177CaptureJointPose('gunner',gunnerPlan(t+1e-8));
    for(const layer of ['lower','upper'])for(const bone of Object.keys(before[layer]))
      before[layer][bone].forEach((v,i)=>assert.ok(Math.abs(v-after[layer][bone][i])<.0001,'no transform jump at '+t));
  }
  // The existing clip sampler stops an epsilon before the endpoint.
  assert.ok(Math.abs(upperAngle(gunnerPlan(.275)))<1e-12);
  assert.equal(v177JointPose('gunner',{requestedState:'recovery',clipProgress:1},runtime).firearmUpperTransform,undefined);
  const t=.016,shot=gunnerShots(gunnerEvents,t)[0],baseline=gunnerPlan(t,[]);
  for(const invalid of [{sourceId:18},{side:'zombie'},{weapon:'ranger'},{style:'beam'},
    {shotIndex:3},{shotIndex:undefined},{duration:NaN},{life:NaN},{life:0},{life:shot.duration+.01}])
    assert.deepEqual(gunnerPlan(t,[{...shot,...invalid}]),baseline);
  const world=Object.freeze({shots:Object.freeze([shot])}),sample=sampleAttackPresentation('gunner',t);
  assert.deepEqual(v177JointPose('gunner',sample,runtime,{world}),baseline);
  assert.equal(v177JointPose('gunner',sample,runtime,{actor:gunnerActor,world,ownedPose:true}),null);
  for(const state of ['move','idle','deploy','turn','retreat','reload','weapon-cycle'])
    assert.equal(v177JointPose('gunner',{requestedState:state,clipProgress:.3},runtime,
      {actor:gunnerActor,world}).firearmUpperTransform,undefined);
  const actor={id:18},ownWorld={shots:[{...shot,sourceId:18}]},r={...runtime,elapsedSeconds:4,transitionCount:3},
    plan=v177JointPose('gunner',sample,r,{actor,world:ownWorld});
  record('gunner',plan,{actor,world:ownWorld});
  const pose=v177CaptureJointPose('gunner',plan);
  for(const state of ['hit-light','incapacitated']){
    const held=v177JointPose('gunner',{requestedState:state},r,{actor,world:ownWorld,stunRemaining:.8});
    assert.deepEqual(v177CaptureJointPose('gunner',held),pose);joins('gunner',pose);
  }
});
