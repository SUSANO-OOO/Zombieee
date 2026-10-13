import test from 'node:test';
import assert from 'node:assert/strict';
import { V177_JOINT_ATLASES, v177JointPose, drawV177JointPose,
  v177CaptureJointPose, v177InterpolateCapturedJointPose, drawV177ResolvedJointPose } from '../app/v177JointPresentation.js';

const multiply = (a,b) => [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],
  a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const point = (m,x,y) => [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
function recording() {
  let matrix=[1,0,0,1,0,0];const stack=[],calls=[];
  return { calls, ctx: {
    save() { stack.push([...matrix]); }, restore() { matrix=stack.pop(); },
    translate(x,y) { matrix=multiply(matrix,[1,0,0,1,x,y]); },
    scale(x,y) { matrix=multiply(matrix,[x,0,0,y,0,0]); },
    transform(...m) { matrix=multiply(matrix,m); },
    drawImage(image,...rects) { calls.push({image,rects,matrix:[...matrix]}); },
  } };
}
function samePaint(expected,actual) {
  assert.equal(actual.length,expected.length);let error=0;
  for(let i=0;i<expected.length;i++) {
    const a=expected[i],b=actual[i];assert.equal(a.image,b.image);assert.deepEqual(a.rects,b.rects);
    const [,,,,x,y,w,h]=a.rects;
    for(const [px,py]of [[x,y],[x+w,y],[x,y+h],[x+w,y+h]]) {
      const p=point(a.matrix,px,py),q=point(b.matrix,px,py);error=Math.max(error,Math.hypot(p[0]-q[0],p[1]-q[1]));
    }
  }
  assert.ok(error<=.001,`source-part corners moved ${error}px at the live/corpse handoff`);
}

for(const kind of ['takuya','mugarian-president-mutated','takuya-omega']) {
  test(`${kind}: capture retains the actual feet, upper owner and original paint at the handoff`,()=>{
    const atlas=V177_JOINT_ATLASES[kind],before=JSON.stringify(atlas),image={naturalWidth:atlas.decodedWidth??512};
    const states=['move','idle','wind-up','active','recovery','reload','weapon-cycle'];
    for(const [i,requestedState]of states.entries())for(const settle of [0,.5,1]) {
      const plan=v177JointPose(kind,{requestedState,clipProgress:.17+i*.11},
        {locomotionPhase:.071+i*.113,locomotionSettle:settle});
      const original=recording();assert.equal(drawV177JointPose(original.ctx,image,kind,plan,-73,-154,171,253),true);
      const captured=v177CaptureJointPose(kind,plan);assert.ok(captured);
      const matrices=v177InterpolateCapturedJointPose(kind,captured,atlas.poses[0],0),replayed=recording();
      assert.equal(drawV177ResolvedJointPose(replayed.ctx,image,kind,matrices,-73,-154,171,253),true);
      samePaint(original.calls,replayed.calls);
      for(const p of [.1,.35,.65,1])for(const m of v177InterpolateCapturedJointPose(kind,captured,atlas.poses[0],p)) {
        assert.ok(Math.abs(Math.hypot(m[0],m[1])-1)<1e-12,'interpolation cannot shorten a source limb');
        assert.ok(Math.abs(Math.hypot(m[2],m[3])-1)<1e-12);
      }
    }
    assert.equal(JSON.stringify(atlas),before,'capturing and interpolation must not mutate the live atlas');
  });

  test(`${kind}: body and detached groups own each original texture part exactly once`,()=>{
    const atlas=V177_JOINT_ATLASES[kind],image={naturalWidth:512};
    const plan=v177JointPose(kind,{requestedState:'active',clipProgress:.63},{locomotionPhase:.371,locomotionSettle:.5});
    const captured=v177CaptureJointPose(kind,plan),matrices=v177InterpolateCapturedJointPose(kind,captured,atlas.poses[0],.4);
    for(const detached of [new Set(['head']),new Set(atlas.parts.filter(part=>part.bone===atlas.weaponBone).map(part=>part.name))]) {
      const whole=recording(),body=recording(),fragment=recording();
      assert.equal(drawV177ResolvedJointPose(whole.ctx,image,kind,matrices,0,0,atlas.referenceFrame.width,atlas.referenceFrame.height),true);
      assert.equal(drawV177ResolvedJointPose(body.ctx,image,kind,matrices,0,0,atlas.referenceFrame.width,atlas.referenceFrame.height,{omitParts:detached}),true);
      assert.equal(drawV177ResolvedJointPose(fragment.ctx,image,kind,matrices,0,0,atlas.referenceFrame.width,atlas.referenceFrame.height,{onlyParts:detached}),true);
      const sourceKey=call=>call.rects.slice(0,4).join(',');
      const all=whole.calls.map(sourceKey).sort(),split=[...body.calls,...fragment.calls].map(sourceKey).sort();
      assert.equal(split.length,atlas.parts.length);assert.equal(new Set(split).size,split.length);
      assert.deepEqual(split,all,'a detached hand/weapon must use its actual atlas part, with no duplicate or lost paint');
    }
  });
}

test('unavailable rigs, malformed matrices and empty ownership cannot claim a resolved draw',()=>{
  const record=recording(),atlas=V177_JOINT_ATLASES.takuya;
  assert.equal(v177CaptureJointPose('ranger',{}),null);
  assert.equal(v177CaptureJointPose('takuya',null),null);
  assert.equal(v177InterpolateCapturedJointPose('unknown',{},atlas.poses[0],.5),null);
  assert.equal(drawV177ResolvedJointPose(record.ctx,{naturalWidth:512},'takuya',[],0,0,512,757),false);
  const plan=v177JointPose('takuya',{requestedState:'idle'},{locomotionPhase:0,locomotionSettle:0});
  const matrices=v177InterpolateCapturedJointPose('takuya',v177CaptureJointPose('takuya',plan),atlas.poses[0],0);
  assert.equal(drawV177ResolvedJointPose(record.ctx,{naturalWidth:512},'takuya',matrices,0,0,512,757,{onlyParts:new Set(['missing'])}),false);
  assert.deepEqual(record.calls,[]);
});
