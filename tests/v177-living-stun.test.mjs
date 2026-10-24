import test from 'node:test';
import assert from 'node:assert/strict';
import { V177_JOINT_ATLASES, v177JointPose, drawV177JointPose, v177CaptureJointPose } from '../app/v177JointPresentation.js';
import { v177LivingStunState, v177LivingStunSample } from '../app/v177LivingStun.js';

const kinds=Object.keys(V177_JOINT_ATLASES).filter(k=>V177_JOINT_ATLASES[k].type==='rigid-parts');
const runtime={locomotionPhase:.371,locomotionSettle:.5,elapsedSeconds:0,transitionCount:2};
const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const context=()=>({calls:[],save(){},restore(){},translate(){},scale(){},
  transform(...m){this.calls.push(m);},drawImage(...args){this.calls.push(args.slice(1));},
  beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){}});
const paint=(kind,plan,actor,image={naturalWidth:1})=>{
  const ctx=context();assert.equal(drawV177JointPose(ctx,image,kind,plan,0,0,100,120,{actor}),true);return ctx.calls;
};
function sameJoints(a,b,label) {
  for(const owner of ['lower','upper'])for(const [bone,m]of Object.entries(a[owner])) {
    for(let i=0;i<6;i++)assert.ok(Math.abs(m[i]-b[owner][bone][i])<.001,`${label}/${owner}/${bone}/${i}`);
  }
}
function attached(atlas,pose,label) {
  for(const chain of [...(atlas.armConstraints??[]),...(atlas.legConstraints??[])]) {
    const leg=Boolean(chain.hip),owner=leg?'lower':'upper';
    const parent=pose[leg&&chain.parentUpper===false?'lower':'upper'][chain.parentBone];
    const top=chain.hip??chain.shoulder,middle=chain.knee??chain.elbow,end=chain.ankle??chain.wrist;
    const upper=pose[owner][chain.upperBone],lower=pose[owner][chain.lowerBone];
    const effector=pose[owner][chain.effectorBone];
    for(const [a,b,name]of [
      [point(parent,top),point(upper,top),'parent'],
      [point(upper,middle),point(lower,middle),'joint'],
      [point(lower,end),point(effector,chain.effectorWrist??end),'endpoint'],
    ])assert.ok(distance(a,b)<.001,`${label}/${chain.upperBone}/${name}: ${distance(a,b)}`);
  }
}

test('late living stun uses actual eligibility, preserves owners and never chooses a death image',()=>{
  const fighter={kind:'scout',hp:20,stunned:.3,combatReady:true,gateEntering:false,contained:false,
    flash:0,attack:0,attackWindup:0,abilityWindup:0,stationAbility:{phase:'idle'}};
  const before=JSON.stringify(fighter);assert.equal(v177LivingStunState(fighter),'incapacitated');
  for(const patch of [{hp:0},{stunned:0},{combatReady:false},{gateEntering:true},{contained:true},
    {flash:.1},{attack:.05},{attackWindup:.03},{abilityWindup:.03},{mayoRetreat:{phase:'rise'}},
    ...['warning','active','recovery'].map(phase=>({stationAbility:{phase}}))])
    assert.equal(v177LivingStunState({...fighter,...patch}),null);
  assert.equal(v177LivingStunState(fighter,{manualAbilityActive:true}),null);
  assert.equal(v177LivingStunState(fighter,{supported:false}),null);
  assert.equal(JSON.stringify(fighter),before);
  for(const kind of kinds){const sample=v177LivingStunSample(kind);
    assert.equal(sample.requestedState,'incapacitated');assert.equal(sample.spriteState,'idle');}
});

test('47 rigid bodies enter from their own painted pose, keep attachments, and return to the real gait phase',()=>{
  assert.equal(kinds.length,47);
  for(const kind of kinds) {
    const atlas=V177_JOINT_ATLASES[kind],original=JSON.stringify(atlas),actor={};
    const initial=v177JointPose(kind,{requestedState:'active',clipProgress:.43},runtime,{actor});
    const initialPaint=paint(kind,initial,actor),captured=v177CaptureJointPose(kind,initial);
    const entry=v177JointPose(kind,v177LivingStunSample(kind),runtime,{actor,stunRemaining:.6});
    assert.ok(entry.liveStun,kind);sameJoints(captured,v177CaptureJointPose(kind,entry),kind+'/entry');
    assert.deepEqual(paint(kind,entry,actor),initialPaint,kind+'/entry paint');
    for(const elapsed of [.016,.05,.1,.15,.3,.49,.59]) {
      const r={...runtime,elapsedSeconds:elapsed,locomotionSettle:Math.min(1,.5+elapsed/.16)};
      const plan=v177JointPose(kind,v177LivingStunSample(kind),r,{actor,stunRemaining:.6-elapsed});
      const pose=v177CaptureJointPose(kind,plan);attached(atlas,pose,kind+'/'+elapsed);
      for(const owner of ['lower','upper'])for(const [bone,m]of Object.entries(pose[owner])) {
        assert.ok(m.every(Number.isFinite),kind+'/'+bone);
        if(!atlas.softBones?.[bone])assert.ok(Math.abs(Math.hypot(m[0],m[1])-1)<1e-10,kind+'/'+bone+'/length');
      }
      paint(kind,plan,actor);
    }
    const finalRuntime={...runtime,elapsedSeconds:.6,locomotionSettle:1};
    const final=v177JointPose(kind,v177LivingStunSample(kind),finalRuntime,{actor,stunRemaining:1e-9});
    const neutral=v177JointPose(kind,{requestedState:'idle'},finalRuntime);
    sameJoints(v177CaptureJointPose(kind,final),v177CaptureJointPose(kind,neutral),kind+'/exit');
    assert.equal(final.phase,neutral.phase);assert.equal(final.settleIndex,neutral.settleIndex);
    assert.equal(JSON.stringify(atlas),original,kind+'/source immutability');
  }
});

test('paused status redraws do not recapture the reacted result or accumulate transforms',()=>{
  for(const kind of ['medic','engineer','mayo-chan','mother','spindle','gate-eater','choir-knot']) {
    const actor={},initial=v177JointPose(kind,{requestedState:'move'},runtime,{actor});paint(kind,initial,actor);
    paint(kind,v177JointPose(kind,v177LivingStunSample(kind),runtime,{actor,stunRemaining:.6}),actor);
    const r={...runtime,elapsedSeconds:.2},sample=v177LivingStunSample(kind);
    const expected=v177JointPose(kind,sample,r,{actor,stunRemaining:.4});
    const expectedPaint=paint(kind,expected,actor);
    for(let i=0;i<1000;i++)assert.deepEqual(paint(kind,v177JointPose(kind,sample,r,{actor,stunRemaining:.4}),actor),expectedPaint);
  }
});

test('Omega interrupted floor-constrained recovery keeps its painted grip on the first stun return frame',()=>{
 const kind='takuya-omega',atlas=V177_JOINT_ATLASES[kind];
 for(const phase of[.21,.371])for(const progress of[.51,.73]){
  const actor={},r={...runtime,locomotionPhase:phase,locomotionSettle:1};
  const initial=v177JointPose(kind,{requestedState:'recovery',clipProgress:progress},r,{actor,grounded:true});
  paint(kind,initial,actor);const original=v177CaptureJointPose(kind,initial);
  const entry=v177JointPose(kind,v177LivingStunSample(kind),r,{actor,grounded:true,stunRemaining:.6});paint(kind,entry,actor);
  for(const elapsed of[1e-8,1e-7]){
   const plan=v177JointPose(kind,v177LivingStunSample(kind),{...r,elapsedSeconds:elapsed},{actor,grounded:true,stunRemaining:.6-elapsed});
   const actual=v177CaptureJointPose(kind,plan);sameJoints(original,actual,`recovery ${progress} first return`);attached(atlas,actual,'constrained return');
  }
 }
});

test('short and interrupted stuns retain fixed arm reach and foot attachment across actual painted handoffs',()=>{
  for(const kind of kinds)for(const state of ['move','active','recovery'])
    for(const phase of [.07,.37,.79])for(const settle of [0,.5,1])for(const duration of [.04,.3,.6]) {
      const atlas=V177_JOINT_ATLASES[kind],actor={};
      const r={...runtime,locomotionPhase:phase,locomotionSettle:settle};
      paint(kind,v177JointPose(kind,{requestedState:state,clipProgress:.43},r,{actor}),actor);
      paint(kind,v177JointPose(kind,v177LivingStunSample(kind),r,{actor,stunRemaining:duration}),actor);
      for(const fraction of [.05,.2,.4,.65,.85,.99]) {
        const elapsed=duration*fraction;
        const clock=fraction>=.4?(fraction-.4)*duration:elapsed;
        const observed={...r,elapsedSeconds:clock,transitionCount:fraction>=.4?3:2,
          locomotionSettle:Math.min(1,settle+elapsed/.16)};
        if(fraction===.4)paint(kind,v177JointPose(kind,{requestedState:'hit-light'},observed,{actor}),actor);
        const plan=v177JointPose(kind,v177LivingStunSample(kind),observed,{actor,stunRemaining:duration-elapsed});
        attached(atlas,v177CaptureJointPose(kind,plan),`${kind}/${state}/${phase}/${settle}/${duration}/${fraction}`);
        paint(kind,plan,actor);
      }
    }
});

test('missing history, actor mismatch, owned actions and missing images cannot borrow a status body',()=>{
  const actor={},sample=v177LivingStunSample('scout');
  const initial=v177JointPose('scout',{requestedState:'move'},runtime,{actor});
  assert.equal(v177JointPose('scout',sample,runtime,{actor,stunRemaining:.5}),null);
  paint('scout',initial,actor);
  assert.equal(v177JointPose('scout',sample,runtime,{actor:{},stunRemaining:.5}),null);
  assert.equal(v177JointPose('medic',sample,runtime,{actor,stunRemaining:.5}),null);
  paint('scout',initial,actor);
  assert.equal(v177JointPose('scout',sample,runtime,{actor,stunRemaining:.5,ownedPose:true}),null);
  paint('scout',initial,actor);
  assert.equal(drawV177JointPose(context(),{naturalWidth:0},'scout',initial,0,0,100,120,{actor}),false);
  assert.equal(v177JointPose('scout',sample,runtime,{actor,stunRemaining:.5}),null);
  assert.equal(v177JointPose('ranger',v177LivingStunSample('ranger'),runtime,{actor,stunRemaining:.5}),null);
});

test('an interrupted lunge returns on alternating lifted feet, including short stuns and re-entry in mid-step',()=>{
 for(const kind of ['kumaverson','brute','walker'])for(const duration of [.04,.3,.6])for(const clipProgress of [.1,.7]){
  const atlas=V177_JOINT_ATLASES[kind],actor={id:701,hp:100,attackSequence:1},r={...runtime,locomotionPhase:.5,locomotionSettle:1};
  const attack=v177JointPose(kind,{requestedState:'active',clipProgress},r,{actor,grounded:true});paint(kind,attack,actor);
  const original=v177CaptureJointPose(kind,attack),neutral=v177CaptureJointPose(kind,v177JointPose(kind,{requestedState:'idle'},r,{grounded:true}));
  const positions=p=>atlas.legConstraints.map(l=>point(p.lower[l.effectorBone],l.ankle));
  const floor=positions(neutral),start=positions(original);
  assert.ok(start.some((p,i)=>Math.abs(p[0]-floor[i][0])>10),'fixture must start in the actual forward lunge');
  const entry=v177JointPose(kind,v177LivingStunSample(kind),r,{actor,grounded:true,stunRemaining:duration});paint(kind,entry,actor);
  sameJoints(original,v177CaptureJointPose(kind,entry),kind+' exact interrupted entry');
  let previous=start;
  for(let n=1;n<=80;n++){
   const elapsed=duration*n/80,remaining=Math.max(1e-9,duration-elapsed),clock={...r,elapsedSeconds:elapsed};
   const plan=v177JointPose(kind,v177LivingStunSample(kind),clock,{actor,grounded:true,stunRemaining:remaining}),pose=v177CaptureJointPose(kind,plan),feet=positions(pose);
   attached(atlas,pose,kind+' grounded return '+n);
   assert.ok(feet.some((p,i)=>Math.abs(p[1]-floor[i][1])<.001),kind+' must retain a planted support');
   for(let i=0;i<2;i++)if(Math.abs(feet[i][0]-previous[i][0])>.01)
    assert.ok(Math.min(feet[i][1],previous[i][1])<floor[i][1]-.001,kind+' cannot slide a grounded returning foot');
   paint(kind,plan,actor);previous=feet;
  }
  for(let i=0;i<2;i++)assert.ok(distance(previous[i],floor[i])<.001,kind+' must finish at the neutral feet');
  if(duration===.6){
   // Reproduce a new interruption while a returning foot is airborne.
   paint(kind,attack,actor);
   paint(kind,v177JointPose(kind,v177LivingStunSample(kind),{...r,transitionCount:10},{actor,grounded:true,stunRemaining:.6}),actor);
   const midway=v177JointPose(kind,v177LivingStunSample(kind),{...r,transitionCount:10,elapsedSeconds:.18},{actor,grounded:true,stunRemaining:.42});paint(kind,midway,actor);
   const captured=v177CaptureJointPose(kind,midway),next={...r,transitionCount:11,elapsedSeconds:0};
   const reentry=v177JointPose(kind,v177LivingStunSample(kind),next,{actor,grounded:true,stunRemaining:.4});paint(kind,reentry,actor);
   sameJoints(captured,v177CaptureJointPose(kind,reentry),kind+' exact mid-step re-entry');
   const tiny=v177JointPose(kind,v177LivingStunSample(kind),{...next,elapsedSeconds:1e-8},{actor,grounded:true,stunRemaining:.4-1e-8});
   sameJoints(captured,v177CaptureJointPose(kind,tiny),kind+' continuous mid-step return');
   const expected=paint(kind,tiny,actor);
   for(let n=0;n<20;n++)assert.deepEqual(paint(kind,v177JointPose(kind,v177LivingStunSample(kind),{...next,elapsedSeconds:1e-8},{actor,grounded:true,stunRemaining:.4-1e-8}),actor),expected,kind+' paused step redraw');
  }
 }
});
