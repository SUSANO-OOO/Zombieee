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

test('repeated short pursuits cannot add a new lift above an already airborne boot',()=>{
  for(const [walkTicks,stopTicks]of [[1,1],[2,1],[4,1],[4,2],[3,1]])for(let sample=0;sample<20;sample++){
    const currentScale=78.46153846153847/480;
    let state,root=350,phase=sample/20,settle=1;
    for(let tick=0;tick<240;tick++){
      const moving=tick%(walkTicks+stopTicks)<walkTicks,dx=moving?29/60:0;
      root+=dx;phase+=dx/(currentScale*cycle);
      settle=moving?Math.max(0,settle-1/60/.12):Math.min(1,settle+1/60/.16);
      const result=v177RangerFootPlacement(rig,state,{time:tick/60,root,phase,scale:currentScale,settle,moving,facing:'right'});
      state=result.state;checkPose(result,settle);
      for(const foot of state.feet){
        assert.ok(foot.height>=0&&foot.height<=rig.liftPx+1e-10,'An interrupted step must keep its original18px apex, not accumulate another lift');
        assert.ok(foot.angle>=-.16-1e-10&&foot.angle<=0);
      }
    }
  }
});

test('short movement and stop changes finish each real step and show both boots on the floor',()=>{
  for(const dt of [1/60,1/24])for(const currentScale of [78.46153846153847/480,86.30769230769232/480])
  for(const walkTicks of [1,2,3,4,6])for(const stopTicks of [1,2,3,6,12]){
    let root=330,phase=0,settle=1,result=v177RangerFootPlacement(rig,null,
      {time:0,root,phase,scale:currentScale,settle,moving:false,facing:'right'});
    const lastGround=[0,0];
    for(let tick=1;tick<=240;tick++){
      const time=tick*dt,moving=(tick-1)%(walkTicks+stopTicks)<walkTicks,dx=moving?29*dt:0;
      root+=dx;phase+=dx/(currentScale*cycle);
      settle=moving?Math.max(0,settle-dt/.12):Math.min(1,settle+dt/.16);
      const previous=result.state;
      result=v177RangerFootPlacement(rig,previous,{time,root,phase,scale:currentScale,settle,moving,facing:'right'});
      checkPose(result,settle);
      for(let i=0;i<2;i++){
        const foot=result.state.feet[i],before=previous.feet[i];
        assert.ok(foot.height>=0&&foot.height<=rig.liftPx+1e-10);
        if(foot.height<1e-9)lastGround[i]=time;
        assert.ok(time-lastGround[i]<=.5,'Restarting a pursuit cannot postpone this boot landing indefinitely');
        if(before.mode==='plant'&&foot.mode==='plant')assert.ok(Math.abs(foot.x-before.x)<1e-8,'Support remains at the actual world contact');
      }
    }
  }
});

test('small real pursuit drift takes a short step instead of suspending a boot for seconds',()=>{
  for(const facing of [-1,1]){
    let root=330,phase=.12,result=v177RangerFootPlacement(rig,null,
      {time:0,root,phase,scale,settle:1,moving:false,facing});
    const lastGround=[0,0];
    for(let tick=1;tick<=600;tick++){
      const time=tick/60;root+=facing*.04;phase+=.04/(scale*cycle);
      result=v177RangerFootPlacement(rig,result.state,{time,root,phase,scale,settle:0,moving:false,facing});
      checkPose(result,0);
      for(let i=0;i<2;i++){
        if(result.state.feet[i].height<1e-9)lastGround[i]=time;
        assert.ok(time-lastGround[i]<=.5,'Slow drift must keep showing actual ground contacts');
      }
    }
  }
});

test('a pursuit resumed in the air starts at the painted ankle angle and lands continuously',()=>{
  let state,root=350,phase=0,settle=1,input,airborne;
  for(let tick=0;tick<40;tick++){
    const moving=tick%5<4,dx=moving?29/60:0;
    root+=dx;phase+=dx/(scale*cycle);
    settle=moving?Math.max(0,settle-1/60/.12):Math.min(1,settle+1/60/.16);
    input={time:tick/60,root,phase,scale,settle,moving,facing:'right'};
    state=v177RangerFootPlacement(rig,state,input).state;
    if(!state.moving&&state.feet.some(foot=>foot.height>.2&&Math.abs(foot.angle)>.005)){airborne=state;break;}
  }
  assert.ok(airborne,'The regression must actually restart an airborne stop step');
  const epsilon=1e-9,dx=29*epsilon,resume={...input,time:input.time+epsilon,root:root+dx,phase:phase+dx/(scale*cycle),moving:true};
  let result=v177RangerFootPlacement(rig,airborne,resume);checkPose(result,settle);
  for(let i=0;i<2;i++)for(const key of ['x','height','angle'])
    assert.ok(Math.abs(result.state.feet[i][key]-airborne.feet[i][key])<1e-6,key+' cannot jump on restart');
  for(let tick=1;tick<=40;tick++)result=v177RangerFootPlacement(rig,result.state,{...resume,time:resume.time+tick/60,moving:false,settle:1});
  assert.deepEqual(result.state.feet.map(foot=>[foot.height,foot.angle]),[[0,0],[0,0]]);
});

test('a resumed support phase cannot drop the other airborne stop step onto the ground',()=>{
  const input={time:0,root:350,phase:.4,scale,settle:0,moving:true,facing:'right'};
  let result=v177RangerFootPlacement(rig,null,input);
  for(let tick=1;tick<=20;tick++)result=v177RangerFootPlacement(rig,result.state,
    {...input,time:tick/60,moving:false,settle:Math.min(1,tick/60/.16)});
  const previous=result.state,airborne=previous.feet.findIndex(foot=>foot.height>10);
  assert.ok(airborne>=0,'The old branch must encounter its actual airborne foot');
  const epsilon=1e-9,dx=29*epsilon;
  result=v177RangerFootPlacement(rig,previous,{...input,time:20/60+epsilon,
    root:350+dx,phase:.4+dx/(scale*cycle),moving:true,settle:1});
  checkPose(result,1);
  for(const key of ['x','height','angle'])
    assert.ok(Math.abs(result.state.feet[airborne][key]-previous.feet[airborne][key])<1e-6,key+' must continue from the real airborne pose');
  assert.equal(result.state.feet[airborne].mode,'swing');
});

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

test('a held airborne step follows the same body reflection before it lands',()=>{
  for(const facing of [-1,1]){
    const input={time:0,root:330,phase:.12,scale,settle:0,moving:true,facing};
    let result=v177RangerFootPlacement(rig,null,input);
    for(let tick=1;tick<=15;tick++)result=v177RangerFootPlacement(rig,result.state,
      {...input,time:tick/60,moving:false,settle:1});
    assert.ok(result.state.feet.some(foot=>foot.flight),'The regression holds an actual airborne correction');
    const before=result;
    result=v177RangerFootPlacement(rig,result.state,
      {...input,time:.35,root:330+facing*5,moving:false,settle:1,frozen:true,facing:-facing});
    assert.deepEqual(result.targets,before.targets,'The held local leg pose moves with its body');
    for(let tick=1;tick<=30;tick++){
      result=v177RangerFootPlacement(rig,result.state,
        {...input,time:.35+tick/60,root:330+facing*5,moving:false,settle:1,facing:-facing});
      checkPose(result,1);
    }
    assert.deepEqual(result.state.feet.map(foot=>foot.height),[0,0]);
  }
});

test('cancelling a pending stationary turn keeps the original landing deadline and reachable feet',()=>{
  for(const facing of [-1,1]){
    const input={time:0,root:330,phase:.12,scale,settle:0,moving:true,facing};
    let result=v177RangerFootPlacement(rig,null,input);
    result=v177RangerFootPlacement(rig,result.state,
      {...input,time:1/60,moving:false,settle:1,facing:-facing});
    assert.equal(result.state.turnTargetFacing,-facing,'This must cancel a turn still waiting for foot support');
    const airborne=result.state.feet.findIndex(foot=>foot.flight),before=result.state.feet[airborne];
    const epsilon=1e-9;
    const cancelled=v177RangerFootPlacement(rig,result.state,
      {...input,time:1/60+epsilon,moving:false,settle:1});
    assert.equal(cancelled.state.feet[airborne].flight.endAt,before.flight.endAt);
    for(const key of ['x','height','angle'])assert.ok(
      Math.abs(cancelled.state.feet[airborne][key]-before[key])<1e-6,key+' must continue from the actual airborne pose');
    result=cancelled;
    for(let tick=2;tick<=60;tick++){
      result=v177RangerFootPlacement(rig,result.state,
        {...input,time:tick/60,moving:false,settle:1});
      checkPose(result,1);
    }
    assert.deepEqual(result.state.feet.map(foot=>foot.height),[0,0]);
    assert.equal(result.state.facing,facing);
  }
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
