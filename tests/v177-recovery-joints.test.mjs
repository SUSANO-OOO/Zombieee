import assert from 'node:assert/strict';
import test from 'node:test';
import {animationClipFor,sampleAnimationClip} from '../app/combatPresentation.js';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose} from '../app/v177JointPresentation.js';

test('real reload and weapon-cycle clips keep every authored body and planted feet on their connected rig',()=>{
  const kinds=Object.keys(V177_JOINT_ATLASES);
  assert.equal(kinds.length,48);
  for(const kind of kinds)for(const state of ['reload','weapon-cycle']){
    const atlas=V177_JOINT_ATLASES[kind],clip=animationClipFor(kind,state);
    const runtime={locomotionPhase:.37,locomotionSettle:1};
    const idle=v177JointPose(kind,sampleAnimationClip(kind,'idle',0),runtime);
    const image={naturalWidth:atlas.decodedWidth,path:atlas.path},upperFrames=new Set();
    for(let i=0;i<=20;i++){
      const sample=sampleAnimationClip(kind,state,clip.durationSeconds*i/20);
      assert.equal(sample.requestedState,state);
      const plan=v177JointPose(kind,sample,runtime);
      assert.ok(plan,`${kind}/${state} must not substitute an old static body during real recovery`);
      assert.equal(plan.lowerIndex,idle.lowerIndex,`${kind}/${state} must keep planted foot phase`);
      assert.equal(plan.phase,idle.phase);
      upperFrames.add(plan.upperIndex);
      const calls=[];
      const ctx={save(){},restore(){},translate(){},scale(){},transform(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},drawImage(...args){calls.push(args);}};
      assert.equal(drawV177JointPose(ctx,image,kind,plan,0,0,atlas.referenceFrame?.width??atlas.width,atlas.referenceFrame?.height??atlas.height),true);
      assert.ok(calls.length>0);
      assert.ok(calls.every(([texture,...coords])=>texture===image&&coords.every(Number.isFinite)),`${kind}/${state} must actually draw its own texture at finite coordinates`);
    }
    assert.ok(upperFrames.size>1,`${kind}/${state} must move the arms or upper body through recovery`);
    assert.equal(v177JointPose(kind,sampleAnimationClip(kind,state,0),runtime,{ownedPose:true}),null,'a dedicated ability still owns its authored pose');
  }
});
