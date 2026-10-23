import test from 'node:test';
import assert from 'node:assert/strict';
import {V177_JOINT_ATLASES as atlases,v177JointPose,v177GroundedJointPose,v177CaptureJointPose,v177JointCycleDistance,drawV177JointPose} from '../app/v177JointPresentation.js';
import {v177GroundedStrideFactor} from '../app/v177GroundedMotion.js';
import {combatApproachSpeed} from '../app/combatApproach.js';
import {animationClipFor,attackPresentationDuration,sampleAttackPresentation} from '../app/combatPresentation.js';

const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function pose(kind,state,p,phase=p,settle=state==='move'?0:1){
  const runtime={locomotionPhase:phase,locomotionSettle:settle},sample={requestedState:state,clipProgress:p};
  return v177GroundedJointPose(kind,v177JointPose(kind,sample,runtime),sample,runtime);
}

test('all source legs and arms remain attached through the enlarged gait and whole-body attacks',()=>{
  let samples=0;
  for(const [kind,atlas]of Object.entries(atlases)){
    if(atlas.type!=='rigid-parts')continue;
    for(const state of ['move','wind-up','active','recovery'])for(let n=0;n<=120;n++){
      const p=pose(kind,state,n/120),captured=v177CaptureJointPose(kind,p);
      for(const chain of [...(atlas.legConstraints??[]),...(atlas.armConstraints??[])]){
        const leg=Boolean(chain.hip),owner=leg?'lower':'upper';
        const parent=captured[leg&&chain.parentUpper===false?'lower':'upper'][chain.parentBone];
        const upper=captured[owner][chain.upperBone],lower=captured[owner][chain.lowerBone],effector=captured[owner][chain.effectorBone];
        const hip=chain.hip??chain.shoulder,knee=chain.knee??chain.elbow,ankle=chain.ankle??chain.wrist,target=chain.effectorWrist??ankle;
        for(const [a,b]of [[point(parent,hip),point(upper,hip)],[point(upper,knee),point(lower,knee)],[point(lower,ankle),point(effector,target)]])
          assert.ok(distance(a,b)<.002,JSON.stringify({kind,state,n,chain:chain.upperBone,a,b}));
      }
      samples++;
    }
  }
  assert.equal(samples,47*4*121);
});

test('larger planted steps cancel real root travel rather than sliding at the new stride distance',()=>{
  for(const [kind,atlas]of Object.entries(atlases)){
    if(atlas.type!=='rigid-parts')continue;
    let previous,plants=0;
    for(let n=0;n<=300;n++){
      const phase=n/300,base=v177CaptureJointPose(kind,v177JointPose(kind,{requestedState:'move'},{locomotionPhase:phase,locomotionSettle:0}));
      const current=v177CaptureJointPose(kind,pose(kind,'move',phase));
      for(const leg of atlas.legConstraints??[]){
        const foot=point(current.lower[leg.effectorBone],leg.ankle),original=point(base.lower[leg.effectorBone],leg.ankle);
        const before=previous?.[leg.effectorBone];
        if(before&&Math.abs(original[0]-before.original[0]+atlas.cycleDistance/300)<.0001&&Math.abs(original[1]-before.original[1])<.0001){
          const travel=v177JointCycleDistance(kind,1)*v177GroundedStrideFactor(kind)/300;
          // source-coordinate scale may differ from the reference display.
          assert.ok(Math.abs(foot[0]-before.foot[0]+travel*(atlas.referenceFrame?.scale??1))<.0002,kind);
          assert.ok(Math.abs(foot[1]-before.foot[1])<.0003,kind);plants++;
        }
      }
      previous=Object.fromEntries((atlas.legConstraints??[]).map(l=>[l.effectorBone,{foot:point(current.lower[l.effectorBone],l.ankle),original:point(base.lower[l.effectorBone],l.ankle)}]));
    }
    assert.ok(plants>10,kind+' has actual planted samples');
  }
});

test('attack weight transfers over alternating support and returns to the same boot targets',()=>{
  for(const kind of ['brute','brawler','takuya','kumaverson']){
    const atlas=atlases[kind],initial=v177CaptureJointPose(kind,pose(kind,'wind-up',0,.21));
    const contact=v177CaptureJointPose(kind,pose(kind,'active',.45,.21));
    const end=v177CaptureJointPose(kind,pose(kind,'recovery',1,.21));
    assert.ok(distance(point(initial.lower.pelvis,[0,0]),point(contact.lower.pelvis,[0,0]))>3,kind);
    for(const leg of atlas.legConstraints){
      assert.deepEqual(initial.lower[leg.effectorBone],end.lower[leg.effectorBone],kind+' no boot reset');
    }
    let previous;
    for(let n=0;n<=300;n++){
      const state=n<=84?'wind-up':n<=210?'active':'recovery';
      const progress=state==='wind-up'?n/84:state==='active'?(n-84)/126:(n-210)/90;
      const plan=pose(kind,state,progress,.21),paint=v177CaptureJointPose(kind,plan);
      const feet=atlas.legConstraints.map(leg=>({bone:leg.effectorBone,
        at:point(paint.lower[leg.effectorBone],leg.ankle),
        lift:plan.groundedMotion.steps?.feet[leg.effectorBone]?.lift??0}));
      assert.ok(feet.some(f=>f.lift<1e-10),kind+' keeps a support foot');
      if(previous)for(const foot of feet){const old=previous.find(f=>f.bone===foot.bone);
        if(foot.lift<1e-10&&old.lift<1e-10)
          assert.ok(distance(foot.at,old.at)<.001,kind+' a planted boot cannot slide');
      }
      previous=feet;
    }
  }
});

test('Omega repeated held-hit projections keep one authored source and enter stun without a grip snap',()=>{
  const kind='takuya-omega',ctx={save(){},restore(){},translate(){},scale(){},transform(){},drawImage(){}};
  for(const phase of [.1,.45,.8])for(const gait of [.137,.371])for(const settle of [0,.5,1]){
    const actor={id:1,kind,hp:100,x:500},world={time:0,fighters:[actor]},runtime={locomotionPhase:gait,locomotionSettle:settle,elapsedSeconds:0,transitionCount:2};
    const paint=p=>drawV177JointPose(ctx,{naturalWidth:1},kind,p,0,0,100,100,{actor,world});
    paint(v177JointPose(kind,{requestedState:'active',clipProgress:phase},runtime,{grounded:true,actor,world}));
    let held;
    for(let i=0;i<20;i++){
      const p=v177JointPose(kind,{requestedState:'hit-heavy',clipProgress:.2},runtime,{grounded:true,actor,world}),now=v177CaptureJointPose(kind,p);
      if(held)assert.deepEqual(now,held,'repainting the same hit cannot accumulate its weapon correction');
      held=now;paint(p);
    }
    const sample={requestedState:'incapacitated'},options={grounded:true,actor,world,stunRemaining:.8};
    const first=v177JointPose(kind,sample,runtime,options);paint(first);
    assert.deepEqual(v177CaptureJointPose(kind,first),held);
    runtime.elapsedSeconds=1e-9;
    const next=v177CaptureJointPose(kind,v177JointPose(kind,sample,runtime,{...options,stunRemaining:.8-1e-9}));
    for(const owner of ['lower','upper'])for(const bone of Object.keys(held[owner]))for(let j=0;j<6;j++)
      assert.ok(Math.abs(next[owner][bone][j]-held[owner][bone][j])<.001,`${gait}/${settle}/${phase}/${bone}`);
  }
});

test('clear-ground traversal is faster on both sides, preserves stops and slows, and eases at contact',()=>{
  for(const speed of [4,11,14,23,34]){
    assert.equal(combatApproachSpeed(speed,24),speed);
    assert.equal(combatApproachSpeed(speed,180),speed*2.5);
    assert.equal(combatApproachSpeed(speed,-180),speed*2.5);
    assert.ok(Math.abs(combatApproachSpeed(speed*.4,180)-combatApproachSpeed(speed,180)*.4)<1e-12);
    let x=0,t=0;while(x<300-1e-6&&t<100){x+=Math.min(300-x,combatApproachSpeed(speed,300-x)/120);t+=1/120;}
    assert.ok(t<300/speed*.72,JSON.stringify({speed,t,before:300/speed}));
  }
  assert.equal(combatApproachSpeed(0,500),0);
});

test('hit articulation changes the body without accumulating transforms across repaints',()=>{
  const actor={},kind='brute',atlas=atlases[kind],runtime={locomotionPhase:.21,locomotionSettle:1};
  const ctx={save(){},restore(){},translate(){},scale(){},transform(){},drawImage(){}};
  const ready=pose(kind,'idle',0,.21),original=v177CaptureJointPose(kind,ready);
  drawV177JointPose(ctx,{naturalWidth:1},kind,ready,0,0,100,100,{actor});
  const s={requestedState:'hit-heavy',clipProgress:.2};
  const first=v177GroundedJointPose(kind,v177JointPose(kind,s,runtime,{actor}),s,runtime);
  const expected=v177CaptureJointPose(kind,first);
  assert.notDeepEqual(expected.upper.spine,original.upper.spine);
  for(let n=0;n<5;n++){
    drawV177JointPose(ctx,{naturalWidth:1},kind,first,0,0,100,100,{actor});
    const next=v177GroundedJointPose(kind,v177JointPose(kind,s,runtime,{actor}),s,runtime);
    assert.deepEqual(v177CaptureJointPose(kind,next),expected);
    for(const leg of atlas.legConstraints)assert.deepEqual(expected.lower[leg.effectorBone],original.lower[leg.effectorBone]);
  }
});

test('the actual Mrs normal-shot owner retains the grounded walking feet before resolving its weapon cycle',()=>{
  const kind='mrs-chiha',atlas=atlases[kind];
  const active=animationClipFor(kind,'active').durationSeconds,recovery=animationClipFor(kind,'recovery').durationSeconds;
  const actor={id:37,kind,side:'human',hp:80,attack:attackPresentationDuration(kind)-active-recovery*.5,
    attackSequence:1,attackWindup:0,abilityWindup:0,flash:0,stunned:0,combatReady:true,stationAbility:{phase:'idle'}};
  const sample=sampleAttackPresentation(kind,attackPresentationDuration(kind)-actor.attack);
  let previous;
  for(let n=0;n<=300;n++){
    const phase=n/300,runtime={locomotionPhase:phase,locomotionSettle:0};
    const actual=v177CaptureJointPose(kind,v177JointPose(kind,sample,runtime,{grounded:true,actor,world:{time:42}}));
    const baseline=v177CaptureJointPose(kind,v177JointPose(kind,sample,runtime,{grounded:true}));
    assert.deepEqual(actual.lower,baseline.lower);
    if(previous)for(const leg of atlas.legConstraints){
      const now=point(actual.lower[leg.effectorBone],leg.ankle),before=point(previous[leg.effectorBone],leg.ankle);
      const stride=atlas.cycleDistance*v177GroundedStrideFactor(kind)/300;
      if(Math.abs(now[1]-before[1])<1e-5&&now[0]<before[0])assert.ok(Math.abs(now[0]-before[0]+stride)<.0002);
    }
    previous=actual.lower;
  }
});

test('grounded attacks and held hits enter living stun continuously and retain fixed limb attachments',()=>{
  const ctx={save(){},restore(){},translate(){},scale(){},transform(){},drawImage(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){}};
  for(const [kind,atlas]of Object.entries(atlases)){
    if(atlas.type!=='rigid-parts')continue;
    for(const entryState of ['active','hit-heavy']){
      const actor={id:1,kind,hp:100,x:500},world={time:0,fighters:[actor]};
      const runtime={locomotionPhase:.21,locomotionSettle:1,elapsedSeconds:0,transitionCount:2};
      const paint=plan=>drawV177JointPose(ctx,{naturalWidth:1},kind,plan,0,0,100,100,{actor,world});
      let plan=v177JointPose(kind,{requestedState:'active',clipProgress:.45},runtime,{grounded:true,actor,world});paint(plan);
      if(entryState==='hit-heavy'){plan=v177JointPose(kind,{requestedState:entryState,clipProgress:.2},runtime,{grounded:true,actor,world});paint(plan);}
      const before=v177CaptureJointPose(kind,plan),sample={requestedState:'incapacitated'};
      const first=v177JointPose(kind,sample,runtime,{grounded:true,actor,world,stunRemaining:.8});paint(first);
      const atEntry=v177CaptureJointPose(kind,first);assert.deepEqual(atEntry,before);
      runtime.elapsedSeconds=1e-8;world.time=1e-8;
      const next=v177JointPose(kind,sample,runtime,{grounded:true,actor,world,stunRemaining:.8-1e-8});
      const after=v177CaptureJointPose(kind,next);
      for(const owner of ['lower','upper'])for(const bone of Object.keys(before[owner]))for(let j=0;j<6;j++)
        assert.ok(Math.abs(before[owner][bone][j]-after[owner][bone][j])<.001,JSON.stringify({kind,entryState,owner,bone,j}));
      for(const elapsed of [.02,.08,.16,.4,.7,.799999]){
        runtime.elapsedSeconds=elapsed;world.time=elapsed;
        const q=v177JointPose(kind,sample,runtime,{grounded:true,actor,world,stunRemaining:.8-elapsed});
        const p=v177CaptureJointPose(kind,q);
        for(const l of atlas.legConstraints??[]){
          const parent=p[l.parentUpper===false?'lower':'upper'][l.parentBone],upper=p.lower[l.upperBone],lower=p.lower[l.lowerBone];
          assert.ok(distance(point(parent,l.hip),point(upper,l.hip))<.002,kind+' stun hip');
          assert.ok(distance(point(upper,l.knee),point(lower,l.knee))<.002,kind+' stun knee');
          assert.ok(distance(point(lower,l.ankle),point(p.lower[l.effectorBone],l.ankle))<.002,kind+' stun ankle');
        }
        paint(q);
      }
    }
  }
});
