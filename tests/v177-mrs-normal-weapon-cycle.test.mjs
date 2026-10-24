import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { animationClipFor, attackPresentationDuration, sampleAttackPresentation } from '../app/combatPresentation.js';
import { v102CombatMotionSample } from '../app/v102CombatMotion.js';
import { V177_JOINT_ATLASES, v177JointPose, v177CaptureJointPose, drawV177JointPose,
  v177RenderedJointWeaponSocket } from '../app/v177JointPresentation.js';
import { v177LivingStunSample } from '../app/v177LivingStun.js';

const kind='mrs-chiha',atlas=V177_JOINT_ATLASES[kind];
const active=animationClipFor(kind,'active').durationSeconds;
const recovery=animationClipFor(kind,'recovery').durationSeconds;
const duration=attackPresentationDuration(kind);
const runtime={locomotionPhase:.371,locomotionSettle:.5,elapsedSeconds:0,transitionCount:2};
const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const actorAt=p=>({id:37,kind,side:'human',hp:80,maxHp:80,attack:duration-active-recovery*p,
  attackSequence:1,attackVariant:null,attackWindup:0,abilityWindup:0,flash:0,stunned:0,
  contained:false,gateEntering:false,combatReady:true,stationAbility:{phase:'idle'},manualAbility:{phase:'idle'}});
const sampleFor=f=>v102CombatMotionSample(f.kind,
  sampleAttackPresentation(f.kind,attackPresentationDuration(f.kind)-f.attack),
  {side:f.side,attack:f.attack,attackWindup:f.attackWindup,abilityWindup:f.abilityWindup});
const context=()=>({calls:[],save(){},restore(){},translate(){},scale(){},
  transform(...m){this.calls.push(['matrix',...m]);},
  drawImage(...args){this.calls.push(['draw',...args.slice(1)]);},
  beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){}});
const paint=(plan,actor,world,image={naturalWidth:1})=>{
  const ctx=context();
  assert.equal(drawV177JointPose(ctx,image,kind,plan,0,0,100,120,{actor,world}),true);
  assert.equal(ctx.calls.filter(c=>c[0]==='draw').length,atlas.parts.length);
  return ctx.calls;
};
function attached(pose) {
  for(const chain of atlas.armConstraints){
    const parent=pose.upper[chain.parentBone],upper=pose.upper[chain.upperBone],
      lower=pose.upper[chain.lowerBone],weapon=pose.upper[chain.effectorBone];
    assert.ok(distance(point(parent,chain.shoulder),point(upper,chain.shoulder))<1e-9);
    assert.ok(distance(point(upper,chain.elbow),point(lower,chain.elbow))<1e-9);
    assert.ok(distance(point(lower,chain.wrist),point(weapon,chain.effectorWrist??chain.wrist))<1e-9);
    assert.ok(Math.abs(distance(point(upper,chain.shoulder),point(upper,chain.elbow))
      -distance(chain.shoulder,chain.elbow))<1e-9);
    assert.ok(Math.abs(distance(point(lower,chain.elbow),point(lower,chain.wrist))
      -distance(chain.elbow,chain.wrist))<1e-9);
  }
}
const maxJointDifference=(a,b)=>Math.max(...['lower','upper'].flatMap(owner=>
  Object.keys(a[owner]).flatMap(bone=>a[owner][bone].map((v,i)=>Math.abs(v-b[owner][bone][i])))));

test('the actual renderer derives handling from the raw normal actor clock through stable keys and copies',()=>{
  assert.equal(active,.38);assert.ok(Math.abs(recovery-.22)<1e-12);assert.ok(Math.abs(duration-.6)<1e-12);
  assert.equal(animationClipFor(kind,'weapon-cycle').durationSeconds,.36);
  const world={time:42},actor=actorAt(.5),sample=sampleFor(actor),before=JSON.stringify({actor,sample,world});
  const plan=v177JointPose(kind,sample,runtime,{actor,world});
  assert.equal(sample.requestedState,'recovery');assert.equal(plan.mrsNormalWeaponCycle,true);
  assert.ok(Math.abs(plan.weaponCycleClockElapsed-recovery*.5)<1e-12);
  assert.equal(plan.weaponCycleClockDuration,recovery);
  assert.ok(Number.isFinite(plan.attackPhase));
  assert.deepEqual(v177JointPose(kind,sample,runtime,{actor:{...actor},world}),plan);
  world.audioEpoch=17;
  assert.deepEqual(v177JointPose(kind,sample,runtime,{actor:{...actor},world}),plan);
  delete world.audioEpoch;
  assert.equal(JSON.stringify({actor,sample,world}),before);
});

test('owners, status, other forms and non-recovery samples keep their original plans',()=>{
  const original=actorAt(.5),sample=sampleFor(original);
  for(const patch of [{hp:0},{side:'zombie'},{attack:0},{attackVariant:'launcher-bash'},
    {attackWindup:.1},{abilityWindup:.1},{flash:.1},{stunned:.1},{contained:true},
    {gateEntering:true},{combatReady:false},
    ...['warning','active','recovery'].map(phase=>({stationAbility:{phase}})),
    ...['windup','salvo','guard','recovery'].map(phase=>({manualAbility:{phase}}))]){
    const actor={...original,...patch},before=JSON.stringify(actor);
    const plan=v177JointPose(kind,sample,runtime,{actor,world:{}});
    assert.notEqual(plan?.mrsNormalWeaponCycle,true,JSON.stringify(patch));
    assert.deepEqual(plan,v177JointPose(kind,sample,runtime));
    assert.equal(JSON.stringify(actor),before);
  }
  assert.equal(v177JointPose(kind,sample,runtime,{actor:original,ownedPose:true}),null);
  for(const requestedState of ['idle','move','wind-up','active','reload'])
    assert.notEqual(v177JointPose(kind,{requestedState,clipProgress:.5},runtime,{actor:original})?.mrsNormalWeaponCycle,true);
  for(const other of Object.keys(V177_JOINT_ATLASES).filter(k=>k!==kind)){
    const s={requestedState:'recovery',clipProgress:.5};
    assert.deepEqual(v177JointPose(other,s,runtime,{actor:{...original,kind:other},world:{}}),
      v177JointPose(other,s,runtime),other);
  }
});

test('real handling paint preserves feet and arm anatomy, distinct midpoints, endpoint commands and a finite muzzle',()=>{
  for(const phase of [0,.371,.91])for(const settle of [0,.5,1])for(const p of [0,.125,.25,.5,.75,.875,1]){
    const actor=actorAt(p),sample=sampleFor(actor),r={...runtime,locomotionPhase:phase,locomotionSettle:settle};
    const plan=v177JointPose(kind,sample,r,{actor,world:{}}),baseline=v177JointPose(kind,sample,r);
    const pose=v177CaptureJointPose(kind,plan),basePose=v177CaptureJointPose(kind,baseline);
    assert.deepEqual(pose.lower,basePose.lower);assert.deepEqual(pose.upper.pelvis,basePose.upper.pelvis);attached(pose);
    const actual=paint(plan,actor,{}),original=paint(baseline,{},{});
    if(p===0||p===1)assert.deepEqual(actual,original);
    else{
      assert.equal(plan.mrsNormalWeaponCycle,true);assert.notDeepEqual(actual,original);
      assert.ok(plan.weaponCycleReachMargin>0);
      const socket=v177RenderedJointWeaponSocket({kind,plan,direction:'right',
        frame:{anchorX:.5,anchorY:1,flipX:false},size:{w:100,h:120},
        pose:{scaleX:1,scaleY:1,rotationRadians:0,offsetX:0,offsetY:0},x:100,y:200});
      assert.ok(socket&&Number.isFinite(socket.x)&&Number.isFinite(socket.y));
    }
  }
});

test('actual paint to held hit to living stun keeps the handling pose continuous and returns to ready',()=>{
  for(const p of [.125,.5,.875]){
    const world={},actor=actorAt(p),initial=v177JointPose(kind,sampleFor(actor),runtime,{actor,world});
    const initialPaint=paint(initial,actor,world),initialPose=v177CaptureJointPose(kind,initial);
    const held=v177JointPose(kind,{requestedState:'hit-light'},runtime,{actor:{...actor},world});
    assert.equal(held.reactionHeld,true);assert.deepEqual(paint(held,actor,world),initialPaint);
    const entry=v177JointPose(kind,v177LivingStunSample(kind),runtime,{actor:{...actor},world,stunRemaining:.6});
    assert.deepEqual(paint(entry,actor,world),initialPaint);
    const epsilon=v177JointPose(kind,v177LivingStunSample(kind),{...runtime,elapsedSeconds:1e-9},
      {actor:{...actor},world,stunRemaining:.6-1e-9});
    assert.ok(maxJointDifference(initialPose,v177CaptureJointPose(kind,epsilon))<1e-7);
    for(const elapsed of [.016,.05,.1,.2,.4,.59]){
      const next=v177JointPose(kind,v177LivingStunSample(kind),{...runtime,elapsedSeconds:elapsed},
        {actor:{...actor},world,stunRemaining:.6-elapsed});
      attached(v177CaptureJointPose(kind,next));paint(next,actor,world);
    }
    const endRuntime={...runtime,elapsedSeconds:.6};
    const end=v177JointPose(kind,v177LivingStunSample(kind),endRuntime,{actor,world,stunRemaining:1e-9});
    assert.ok(maxJointDifference(v177CaptureJointPose(kind,end),
      v177CaptureJointPose(kind,v177JointPose(kind,{requestedState:'idle'},endRuntime)))<1e-8);
  }
});

test('the actual App block records only successful same-frame normal handling paints',()=>{
  const source=ts.createSourceFile('AshfallGame.tsx',readFileSync(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8'),
    ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),found=[];
  function visit(node){
    if(ts.isIfStatement(node)&&node.expression.getText(source)==="renderKind==='mrs-chiha'"
      &&node.thenStatement.getText(source).includes('jointWeaponCycleDrawSucceeded'))found.push(node);
    ts.forEachChild(node,visit);
  }
  visit(source);assert.equal(found.length,1);
  const node=found[0],parent=node.parent.getText(source);
  const paintPosition=parent.indexOf('audit.jointDrawSucceeded=Boolean(jointPose&&drewArticulatedWalk)');
  assert.ok(paintPosition>=0&&paintPosition<parent.indexOf(node.getText(source)));
  const record=new Function('audit','jointPose','animationSample','f','options','V177_JOINT_ATLASES','renderKind',
    node.getText(source));
  const actor=actorAt(.5),sample=sampleFor(actor),plan=v177JointPose(kind,sample,runtime,{actor,world:{}});
  const run=(painted,selected=plan,s=sample,f=actor,world={time:42})=>{
    const audit={jointDrawSucceeded:painted};record(audit,selected,s,f,{world},V177_JOINT_ATLASES,kind);return audit;
  };
  const valid=run(true);assert.equal(valid.jointWeaponCycleDrawSucceeded,true);
  assert.equal(valid.jointWeaponCycle.fighterId,actor.id);assert.equal(valid.jointWeaponCycle.attackSequence,1);
  assert.equal(valid.jointWeaponCycle.paintedAt,42);assert.equal(valid.jointWeaponCycle.duration,recovery);
  assert.equal(valid.jointWeaponCycle.sourceTexture,atlas.path);assert.equal(valid.jointWeaponCycle.independentCylinder,false);
  for(const audit of [run(false),run(true,null),run(true,{...plan,reactionHeld:true}),
    run(true,plan,{...sample,requestedState:'hit-light'}),run(true,plan,sample,{...actor,attackSequence:0}),
    run(true,plan,sample,actor,{}),run(true,{...plan,weaponCycleClockElapsed:undefined})]){
    assert.equal(audit.jointWeaponCycleDrawSucceeded,false);assert.equal(audit.jointWeaponCycle,undefined);
  }
});
