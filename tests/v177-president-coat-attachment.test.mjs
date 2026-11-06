import assert from 'node:assert/strict';
import test from 'node:test';
import { V177_JOINT_ATLASES, v177JointPose, v177CaptureJointPose, drawV177JointPose } from '../app/v177JointPresentation.js';

const kind = 'mugarian-president-mutated';
const atlas = V177_JOINT_ATLASES[kind];
const point = (m, [x, y]) => [m[0]*x+m[2]*y+m[4], m[1]*x+m[3]*y+m[5]];
const local = (m, [x, y]) => [m[0]*(x-m[4])+m[1]*(y-m[5]), m[2]*(x-m[4])+m[3]*(y-m[5])];

test('President coat seams stay attached to the bending torso through both claw attacks', () => {
  const rest = atlas.poses[atlas.lowerCount-atlas.frameCount];
  for (const grounded of [false, true]) for (const sequence of [1, 2]) for (const settle of [0, .5, 1]) {
    for (const requestedState of ['wind-up', 'active', 'recovery']) for (let n=0; n<=20; n++) {
      const plan = v177JointPose(kind, { requestedState, clipProgress:n/20 }, {
        locomotionPhase:.1371, locomotionSettle:settle,
      }, { grounded, actor:{kind, attackSequence:sequence, attackWindup:requestedState==='wind-up'?1:0} });
      const pose = v177CaptureJointPose(kind, plan);
      for (const bone of ['coat-far', 'coat-near']) {
        const part = atlas.parts.find(p=>p.bone===bone);
        const seam = [part.destination.x+part.destination.w/2, part.destination.y];
        const expected = point(pose.upper.spine, local(rest.spine, point(rest[bone], seam)));
        const actual = point(pose[part.upper?'upper':'lower'][bone], seam);
        assert.ok(Math.hypot(actual[0]-expected[0], actual[1]-expected[1])<.001,
          `${bone} detached in ${requestedState} ${n/20} / settle ${settle}`);
      }
    }
  }
});

test('Coat seams follow the same torso through an interrupted attack and living stun', () => {
  for(const grounded of [false,true])for(const attackSequence of [1,2]){
  const actor={kind,attackSequence}, runtime={locomotionPhase:.1371,locomotionSettle:1,elapsedSeconds:0};
  const context={save(){},restore(){},translate(){},scale(){},transform(){},drawImage(){}};
  const rest=atlas.poses[atlas.lowerCount-atlas.frameCount];
  const paint=plan=>assert.equal(drawV177JointPose(context,{naturalWidth:512},kind,plan,0,0,544,512,{actor}),true);
  paint(v177JointPose(kind,{requestedState:'active',clipProgress:.5},runtime,{actor,grounded}));
  for(const elapsed of [0,.03,.06,.09,.12,.18,.27,.4,.55]){
    runtime.elapsedSeconds=elapsed;
    const plan=v177JointPose(kind,{requestedState:'incapacitated'},runtime,{actor,grounded,stunRemaining:.6-elapsed});
    assert.equal(plan.liveStun,true);assert.equal(plan.stunElapsed,elapsed);
    const pose=v177CaptureJointPose(kind,plan);
    for(const bone of ['coat-far','coat-near']){
      const part=atlas.parts.find(p=>p.bone===bone),seam=[part.destination.x+part.destination.w/2,part.destination.y];
      const expected=point(pose.upper.spine,local(rest.spine,point(rest[bone],seam)));
      const actual=point(pose[part.upper?'upper':'lower'][bone],seam);
      assert.ok(Math.hypot(actual[0]-expected[0],actual[1]-expected[1])<.01,`${bone} stun ${elapsed}`);
    }
    paint(plan);
  }
  }
});
