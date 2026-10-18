import test from 'node:test';
import assert from 'node:assert/strict';
import {V177_JOINT_ATLASES} from '../app/v177JointData.js';
import {v177RangerFootPlacement} from '../app/v177RangerFootPlacement.js';
import {v177RangerLowerPose} from '../app/v177RangerLowerMotion.js';

const rig=V177_JOINT_ATLASES.ranger.lowerRig,scale=.18,cycle=rig.spanPx/rig.stanceFraction;
function checkPose(result,settle) {
  const pose=v177RangerLowerPose(rig,result.phase,settle,undefined,result.targets);
  for(let i=0;i<2;i++){
    const j=pose.joints[i],leg=rig.legs[i];
    assert.ok(Math.abs(Math.hypot(j[2]-j[0],j[3]-j[1])-leg.upperLength)<1e-9);
    assert.ok(Math.abs(Math.hypot(j[4]-j[2],j[5]-j[3])-leg.lowerLength)<1e-9);
    assert.ok(j[4]===result.targets[i][0]&&j[5]===result.targets[i][1]);
  }
  return pose;
}

test('every stopped walk entry finishes with distinct ordered shooting feet, using reachable lifted steps',()=>{
  for(let sample=0;sample<120;sample++){
    const phase=sample/120,input={time:0,root:330,phase,scale,moving:true,settle:0,facing:'right'};
    let result=v177RangerFootPlacement(rig,null,input),lifted=false,plants=0;
    for(let frame=1;frame<=36;frame++){
      const previous=result.state,before=JSON.stringify(previous);
      result=v177RangerFootPlacement(rig,previous,{...input,time:frame/60,moving:false,settle:Math.min(1,frame/10)});
      assert.equal(JSON.stringify(previous),before,'sampling cannot mutate the last painted state');
      checkPose(result,Math.min(1,frame/10));
      for(let i=0;i<2;i++){
        const a=previous.feet[i],b=result.state.feet[i];
        if(b.height>1)lifted=true;
        if(a.mode==='plant'&&b.mode==='plant'){
          assert.ok(Math.abs(a.x-b.x)<1e-8,'a supporting foot cannot be dragged to the shooting template');plants++;
        }
      }
    }
    const pose=checkPose(result,1),[far,near]=pose.joints;
    assert.ok(near[4]-far[4]>=64.99,'a stopped mid-stride cannot leave both boots intertwined');
    assert.ok(near[2]>far[2],'settled knees follow the same front/back order as the feet');
    assert.deepEqual(result.state.feet.map(foot=>foot.height),[0,0]);
    assert.ok(lifted&&plants>0,'the repair must include an airborne step and a fixed support');
  }
});

test('walk, shooting, short pursuit, retreat and a facing change keep support plants and continuous history',()=>{
  let time=0,root=330,phase=0,settle=1,state,plants=0,steps=0,largestMotion=0;
  const stages=[[.3,0,'right'],[1,29,'right'],[.9,0,'right'],
    ...Array.from({length:6},()=>[[1/60,29,'right'],[.3,0,'right']]).flat(),
    [.6,-29,'right'],[.8,0,'right'],[1,-29,'left'],[.7,0,'left']];
  for(const[seconds,speed,facing]of stages)for(let frame=0;frame<Math.round(seconds*60);frame++){
    const moving=speed!==0,dx=speed/60;
    time+=1/60;root+=dx;phase+=dx*(facing==='left'?-1:1)/(scale*cycle);
    settle=moving?Math.max(0,settle-1/60/.12):Math.min(1,settle+1/60/.16);
    const input={time,root,phase,scale,settle,facing,moving},previous=state;
    const result=v177RangerFootPlacement(rig,state,input);state=result.state;checkPose(result,settle);
    const repeated=v177RangerFootPlacement(rig,state,input);
    assert.deepEqual(repeated,result,'a paused or duplicate draw cannot advance a step or change its angle');
    if(previous)for(let i=0;i<2;i++){
      largestMotion=Math.max(largestMotion,Math.abs(state.feet[i].x-previous.feet[i].x));
      if(previous.feet[i].mode==='plant'&&state.feet[i].mode==='plant'){
        assert.ok(Math.abs(state.feet[i].x-previous.feet[i].x)<1e-8);plants++;
      }
      if(state.feet[i].height>1)steps++;
    }
  }
  assert.ok(plants>200&&steps>50);
  assert.ok(largestMotion<4,'neither restarting nor mirroring may teleport a foot');
  assert.deepEqual(state.feet.map(foot=>foot.height),[0,0]);
});

test('hit/stun can freeze an in-flight correction and a fresh actor does not inherit another stop',()=>{
  const input={time:2,root:330,phase:.31,scale,settle:0,moving:true,facing:'right'};
  const walking=v177RangerFootPlacement(rig,null,input);
  const stopping=v177RangerFootPlacement(rig,walking.state,{...input,time:2.1,moving:false,settle:.7});
  const frozen=v177RangerFootPlacement(rig,stopping.state,{...input,time:2.4,moving:false,settle:1,frozen:true});
  assert.deepEqual(frozen.targets,stopping.targets);
  const resumed=v177RangerFootPlacement(rig,frozen.state,{...input,time:2.5,moving:false,settle:1});
  const uninterrupted=v177RangerFootPlacement(rig,stopping.state,{...input,time:2.2,moving:false,settle:1});
  for(let i=0;i<2;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(resumed.targets[i][j]-uninterrupted.targets[i][j])<1e-10);
  const fresh=v177RangerFootPlacement(rig,null,{...input,time:2.5,moving:false,settle:1});
  assert.notDeepEqual(fresh.targets,resumed.targets);
  assert.equal(v177RangerFootPlacement(rig,null,{...input,time:undefined}),null);
});

test('missed render intervals still cross actual gait boundaries without stretching either leg',()=>{
  for(const currentScale of[.18,.2])for(const seconds of[1/60,.05,.1,.5,1])for(const travel of[-1,1])for(let sample=0;sample<120;sample++){
    const input={time:0,root:330,phase:sample/120,scale:currentScale,settle:0,moving:true,facing:'right'};
    const first=v177RangerFootPlacement(rig,null,input),distance=travel*20*seconds;
    const after=v177RangerFootPlacement(rig,first.state,{...input,time:seconds,root:330+distance,
      phase:input.phase+distance/(currentScale*cycle)});
    checkPose(after,0);
  }
});

test('a real knock displacement carries the held leg pose with the rigid body rather than leaving feet behind',()=>{
  const input={time:2,root:330,phase:.31,scale:.2,settle:1,moving:false,facing:'right'};
  const before=v177RangerFootPlacement(rig,null,input);
  for(const displacement of[-25,-5,5,25]){
    const after=v177RangerFootPlacement(rig,before.state,{...input,time:2.1,root:330+displacement,frozen:true});
    checkPose(after,1);
    for(let i=0;i<2;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(after.targets[i][j]-before.targets[i][j])<1e-10);
  }
});

test('gradual lane-depth scale changes keep planted legs reachable and adjust only airborne landings',()=>{
  for(const travel of[-1,1])for(let sample=0;sample<120;sample++){
    let state,root=330,phase=sample/120;
    for(let frame=0;frame<180;frame++){
      const currentScale=.2-.02*Math.sin(Math.PI*frame/180),dx=travel*.48;
      root+=dx;phase+=dx/(currentScale*cycle);
      const previous=state,result=v177RangerFootPlacement(rig,state,{
        time:frame/60,root,phase,scale:currentScale,moving:true,settle:0,facing:'right',
      });
      state=result.state;checkPose(result,0);
      if(previous)for(let i=0;i<2;i++)if(previous.feet[i].mode==='plant'&&state.feet[i].mode==='plant')
        assert.ok(Math.abs(state.feet[i].x-previous.feet[i].x)<1e-8,'a depth correction cannot drag a planted boot');
    }
  }
});
