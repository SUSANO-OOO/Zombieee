import test from 'node:test';
import assert from 'node:assert/strict';
import { V177_JOINT_ATLASES, v177JointPose, v177CaptureJointPose,
  v177InterpolateCapturedJointPose } from '../app/v177JointPresentation.js';
import { V177_CORPSE_JOINT_DATA } from '../app/v177CorpseJointData.js';

const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
function assertOriginalJoints(kind,matrices,label){
  const atlas=V177_JOINT_ATLASES[kind],bones=new Map(atlas.parts.map((part,i)=>[part.bone,matrices[i]]));
  for(const chain of [...atlas.armConstraints,...atlas.legConstraints]){
    const start=chain.hip??chain.shoulder,middle=chain.knee??chain.elbow,end=chain.ankle??chain.wrist;
    for(const [name,left,a,right,b]of [
      ['root',chain.parentBone,start,chain.upperBone,start],
      ['middle',chain.upperBone,middle,chain.lowerBone,middle],
      ['grip/ankle',chain.lowerBone,end,chain.effectorBone,chain.effectorWrist??end],
    ]){
      const x=point(bones.get(left),a),y=point(bones.get(right),b);
      assert.ok(Math.hypot(x[0]-y[0],x[1]-y[1])/atlas.referenceFrame.scale<=.001,
        label+' '+chain.effectorBone+' '+name+' must remain connected');
    }
  }
}

test('an Omega interrupted during the native active attack keeps its hand on the blade throughout backward collapse',()=>{
  const kind='takuya-omega',atlas=V177_JOINT_ATLASES[kind];
  const plan=v177JointPose(kind,{requestedState:'active',clipProgress:.25},{locomotionPhase:0,locomotionSettle:0});
  const initial=v177CaptureJointPose(kind,plan),finalPose={...atlas.poses[0],...V177_CORPSE_JOINT_DATA[kind].falls['-1']};
  for(const progress of [0,.025,.05,.1,.2,.35,.5,.65,.8,.9,.95,.975,1])
    assertOriginalJoints(kind,v177InterpolateCapturedJointPose(kind,initial,finalPose,progress),'progress '+progress);
});

test('all three original corpse rigs preserve limb joints from moving and interrupted attacks into both resting directions',()=>{
  for(const kind of Object.keys(V177_CORPSE_JOINT_DATA))for(const side of [-1,1])
    for(const requestedState of ['move','idle','wind-up','active','recovery','reload','weapon-cycle'])
      for(const clipProgress of [.25,.75])for(const locomotionPhase of [0,.249,.501,.883])for(const locomotionSettle of [0,1]){
        const atlas=V177_JOINT_ATLASES[kind],plan=v177JointPose(kind,{requestedState,clipProgress},{locomotionPhase,locomotionSettle});
        const initial=v177CaptureJointPose(kind,plan),finalPose={...atlas.poses[0],...V177_CORPSE_JOINT_DATA[kind].falls[String(side)]};
        for(const progress of [0,.1,.35,.5,.8,1])
          assertOriginalJoints(kind,v177InterpolateCapturedJointPose(kind,initial,finalPose,progress),
            [kind,side,requestedState,clipProgress,locomotionPhase,locomotionSettle,progress].join('/'));
      }
});
