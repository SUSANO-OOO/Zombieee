import test from 'node:test';
import assert from 'node:assert/strict';
import { V177_JOINT_ATLASES as atlases, v177JointPose, drawV177JointPose,
  v177CaptureJointPose } from '../app/v177JointPresentation.js';
import { createCombatAnimationRuntime, advanceCombatAnimationRuntime } from '../app/combatPresentation.js';
import { v177LiveJointGroundLift } from '../app/v177CorpseJointPresentation.js';
import { V177_WALKER_FLOOR_DATA as floorData } from '../app/v177WalkerFloorData.js';
import { spriteFrameFor, spriteBattleDisplaySizeFor, COMPACT_BATTLE_SPRITE_SCALE } from '../app/spriteManifest.js';
import { v100EnemyContactSize } from '../app/v100EnemyContactPresentation.js';
import { v102BattleBodyScale } from '../app/v102CombatMotion.js';
import { stageGeometryFor, STAGE_VIEWPORT_IDS, battlefieldDepthScale } from '../app/stageGeometry.js';
import { V100_STAGE_IDS } from '../app/v100Registry.js';

const point=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],
  a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const rigid=Object.entries(atlases).filter(([,a])=>a.type==='rigid-parts');
function paint(kind,plan,rendered={}) {
  const atlas=atlases[kind],r={width:480,height:448,x:0,y:0,flipX:false,...rendered};
  let m=[r.flipX?-1:1,0,0,1,r.x,r.y];const stack=[],calls=[];
  const ctx={save:()=>stack.push([...m]),restore:()=>{m=stack.pop();},
    translate:(x,y)=>{m=multiply(m,[1,0,0,1,x,y]);},scale:(x,y)=>{m=multiply(m,[x,0,0,y,0,0]);},
    transform:(...n)=>{m=multiply(m,n);},drawImage:(_image,...rect)=>calls.push({matrix:[...m],rect}),
    beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){}};
  assert.equal(drawV177JointPose(ctx,{naturalWidth:atlas.decodedWidth},kind,plan,
    -r.width*(r.frame?.anchorX??0),-r.height*(r.frame?.anchorY??0),r.width,r.height),true);
  assert.equal(calls.length,atlas.parts?.length??(1+atlas.upperRig.parts.length),'each source part is painted once');assert.equal(stack.length,0);
  return calls;
}
function paintDelta(a,b) {
  assert.equal(a.length,b.length);let max=0;
  for(let i=0;i<a.length;i++){
    assert.deepEqual(a[i].rect,b[i].rect,'interpolation keeps the original source texture parts');
    const [,,,,x,y,w,h]=a[i].rect;
    for(const p of [[x,y],[x+w,y],[x,y+h],[x+w,y+h]])max=Math.max(max,distance(point(a[i].matrix,p),point(b[i].matrix,p)));
  }
  return max;
}

test('all47 rigid forms paint continuously across the old rounded steps and every authored settle row',()=>{
  assert.equal(rigid.length,47);const epsilon=1e-9;
  for(const [kind,atlas] of rigid)for(const phase of [0,.037,7/30,.371,.731,.999999])
    for(const settle of [1/6,1/3,.5,2/3,5/6])for(const state of ['move','idle','active','recovery']){
      const sample={requestedState:state,clipProgress:.371},runtime={locomotionPhase:phase};
      const a=paint(kind,v177JointPose(kind,sample,{...runtime,locomotionSettle:settle-epsilon}));
      const b=paint(kind,v177JointPose(kind,sample,{...runtime,locomotionSettle:settle+epsilon}));
      assert.ok(paintDelta(a,b)<.00001,`${kind}/${state}/${phase}/${settle}: visible part corners jump`);
      assert.equal(atlas.poses.length>=atlas.lowerCount,true);
    }
});

test('all47 keep shoulders, elbows, wrists, hips, knees and ankles joined between settle rows',()=>{
  for(const [kind,atlas] of rigid)for(const phase of [.037,.2317,.571,.931])
    for(const settle of [.01,.11,.22,.34,.45,.56,.67,.78,.89,.99])
      for(const state of ['move','wind-up','active','recovery']){
        const plan=v177JointPose(kind,{requestedState:state,clipProgress:.371},{locomotionPhase:phase,locomotionSettle:settle});
        const pose=v177CaptureJointPose(kind,plan);
        for(const chain of [...(atlas.armConstraints??[]),...(atlas.legConstraints??[])]){
          const leg=Boolean(chain.hip),upper=leg?chain.parentUpper!==false:true;
          const parent=pose[upper?'upper':'lower'][chain.parentBone],effector=pose[leg?'lower':'upper'][chain.effectorBone];
          const a=pose[leg?'lower':'upper'][chain.upperBone],b=pose[leg?'lower':'upper'][chain.lowerBone];
          const A=chain.hip??chain.shoulder,B=chain.knee??chain.elbow,C=chain.ankle??chain.wrist;
          const target=chain.effectorWrist??C;
          assert.ok(distance(point(parent,A),point(a,A))<.001,`${kind}/${state}: parent joint`);
          assert.ok(distance(point(a,B),point(b,B))<.001,`${kind}/${state}: elbow/knee`);
          assert.ok(distance(point(b,C),point(effector,target))<.001,`${kind}/${state}: wrist/ankle`);
          for(const m of [a,b]){
            assert.ok(Math.abs(Math.hypot(m[0],m[1])-1)<1e-10,kind+' fixed bone length');
            assert.ok(Math.abs(m[0]*m[3]-m[1]*m[2]-1)<1e-10,kind+' no shear or reflection');
          }
        }
      }
});

test('the reproduced walker/turned stop no longer jumps at5/6 and stays on the alpha1 floor in3viewports and mirrors',()=>{
  const frame=spriteFrameFor('turned','walk-a','right');
  const size=v100EnemyContactSize('turned',frame,'right',spriteBattleDisplaySizeFor('turned'));
  for(const viewport of Object.values(STAGE_VIEWPORT_IDS)){
    const geo=stageGeometryFor(V100_STAGE_IDS[0],viewport),depth=battlefieldDepthScale(geo,geo.lanes[1].y);
    const scale=(viewport===STAGE_VIEWPORT_IDS.STANDARD?1:COMPACT_BATTLE_SPRITE_SCALE)*depth*v102BattleBodyScale('turned');
    for(const kind of ['walker','turned'])for(const flipX of [false,true]){
      const r={viewport,frame,width:size.w*scale,height:size.h*scale,x:530,y:geo.lanes[1].y,angle:0,scaleX:1,scaleY:1,flipX};
      const painted=[];
      for(const settle of [5/6-1e-9,5/6+1e-9]){
        const plan=v177JointPose(kind,{requestedState:'move'},{locomotionPhase:7/30,locomotionSettle:settle});
        const lift=v177LiveJointGroundLift(kind,plan,r,r.y+5),calls=paint(kind,plan,{...r,y:r.y-lift});
        const bottom=Math.max(...calls.flatMap((call,i)=>floorData.outlines[i].hull.map(p=>point(call.matrix,p)[1])));
        assert.ok(Math.abs(bottom-r.y-5)<1e-9,'actual original alpha1 silhouette is grounded');painted.push(calls);
      }
      assert.ok(paintDelta(...painted)<1e-6,`${kind}/${viewport}/${flipX}: old2.871717px discontinuity`);
    }
  }
});

test('real stop and restart retain actual travel, event clocks and phase while only the source pose settles',()=>{
  let runtime={...createCombatAnimationRuntime({direction:'right',x:530,y:300}),state:'move',moving:true,
    deployCompleted:true,locomotionPhase:7/30,locomotionSettle:0};
  const phase=runtime.locomotionPhase;
  for(let i=0;i<12;i++){
    runtime=advanceCombatAnimationRuntime(runtime,{kind:'walker',x:530,y:300,moving:false,direction:'right'},1/60);
    const before=structuredClone(runtime);v177JointPose('walker',{requestedState:runtime.state},runtime);
    assert.deepEqual(runtime,before);assert.equal(runtime.locomotionPhase,phase);
    assert.equal(runtime.lastX,530);assert.equal(runtime.lastY,300);
  }
  assert.equal(runtime.locomotionSettle,1);
  const next=advanceCombatAnimationRuntime(runtime,{kind:'walker',x:531,y:300,moving:true,direction:'right',locomotionCycleDistance:40},1/60);
  assert.ok(Math.abs(next.locomotionPhase-phase-1/40)<1e-12);assert.ok(next.locomotionSettle<1);
});

test('Ranger retains one original weighted lower cell and its7 upper parts without a second pair of feet',()=>{
  const atlas=atlases.ranger,before=JSON.stringify(atlas);
  for(const settle of [0,1/6,.5,5/6,1])for(const state of ['move','active','recovery']){
    const phase=.371,plan=v177JointPose('ranger',{requestedState:state,clipProgress:.371},{locomotionPhase:phase,locomotionSettle:settle});
    const calls=paint('ranger',plan),index=Math.round(settle*(atlas.settleLevels-1))*atlas.frameCount+Math.floor(phase*atlas.frameCount);
    assert.equal(plan.lowerIndex,index);assert.equal(calls.length,1+atlas.upperRig.parts.length);
    assert.deepEqual(calls[0].rect.slice(0,4),Object.values(atlas.frames[index].source));
  }
  assert.equal(JSON.stringify(atlas),before);
});
