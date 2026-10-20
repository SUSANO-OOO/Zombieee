import test from 'node:test';
import assert from 'node:assert/strict';
import {V177_JOINT_ATLASES} from '../app/v177JointData.js';
import {createCombatAnimationRuntime,advanceCombatAnimationRuntime} from '../app/combatPresentation.js';
import {v177RangerFootPlacement} from '../app/v177RangerFootPlacement.js';
import {v177RangerLowerPose} from '../app/v177RangerLowerMotion.js';

const rig=V177_JOINT_ATLASES.ranger.lowerRig,cycle=rig.spanPx/rig.stanceFraction;
function assertOriginalLegs(result,settle){
 const pose=v177RangerLowerPose(rig,result.phase,settle,undefined,result.targets);
 for(let i=0;i<2;i++){
  const joint=pose.joints[i],leg=rig.legs[i];
  assert.ok(Math.abs(Math.hypot(joint[2]-joint[0],joint[3]-joint[1])-leg.upperLength)<1e-9);
  assert.ok(Math.abs(Math.hypot(joint[4]-joint[2],joint[5]-joint[3])-leg.lowerLength)<1e-9);
  assert.equal(joint[4],result.targets[i][0]);assert.equal(joint[5],result.targets[i][1]);
 }
}

test('retargeting an airborne turn preserves the height curve and ankle angle',()=>{
 const scale=.18;let root=330,y=285,time=0,state,input;
 let runtime=createCombatAnimationRuntime({x:root,y,direction:'right'});
 for(let frame=0;frame<=21;frame++){
  root-=29/60;y+=60/60;time+=1/60;
  runtime=advanceCombatAnimationRuntime(runtime,{x:root,y,kind:'ranger',direction:'right',locomotionCycleDistance:scale*cycle},1/60);
  if(frame%3)continue;
  input={time,root,scale,phase:runtime.locomotionPhase,settle:runtime.locomotionSettle,moving:true,facing:'right'};
  state=v177RangerFootPlacement(rig,state,input).state;
 }
 assert.ok(state.feet.some(foot=>foot.flight?.kind==='move'&&foot.height>0));
 const next={...input,time:time+1e-7,root:root-29e-7,phase:input.phase-29e-7/(scale*cycle)};
 const straight=v177RangerFootPlacement(rig,state,next),turned=v177RangerFootPlacement(rig,state,{...next,facing:'left'});
 for(let i=0;i<2;i++)for(const key of ['height','angle'])
  assert.ok(Math.abs(straight.state.feet[i][key]-turned.state.feet[i][key])<1e-5,'a facing request cannot replace an airborne curve');
 assertOriginalLegs(turned,next.settle);
});

test('turns during an airborne retreat keep original legs reachable at the actual paint',()=>{
 // Seed 177 first fails on the old implementation at paint .416666s: an
 // old-facing flight lands after reflection. Later turns also exercise a
 // travelling root while reflection is deferred and skipped private samples.
 let seed=177;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let run=0;run<40;run++){
  let root=330,y=285,time=0,facing='right',dx=0,dy=0,state;
  const scale=.18;
  let runtime=createCombatAnimationRuntime({x:root,y,direction:facing});
  for(let frame=0;frame<1500;frame++){
   if(frame%23===0){dx=[-29,0,29][Math.floor(random()*3)];dy=[-60,0,60][Math.floor(random()*3)];facing=random()<.5?'right':'left';}
   root+=dx/60;y=Math.max(220,Math.min(330,y+dy/60));time+=1/60;
   runtime=advanceCombatAnimationRuntime(runtime,{x:root,y,kind:'ranger',direction:facing,locomotionCycleDistance:scale*cycle},1/60);
   if(frame%3)continue;
   const result=v177RangerFootPlacement(rig,state,{time,root,scale,phase:runtime.locomotionPhase,
    settle:runtime.locomotionSettle,moving:runtime.moving,facing:runtime.direction});
   assertOriginalLegs(result,runtime.locomotionSettle);
   if(state)for(let i=0;i<2;i++)if(state.feet[i].mode==='plant'&&result.state.feet[i].mode==='plant')
    assert.equal(result.state.feet[i].x,state.feet[i].x,'a support cannot slide to hide a turning error');
   state=result.state;
  }
 }
});

test('actual lane travel with no horizontal travel keeps both original legs reachable through stop and pursuit',()=>{
 for(const scale of [.18,.2])for(const laneSpeed of [-60,60]){
  let root=203.28333333333316,y=285,state;
  let runtime=createCombatAnimationRuntime({x:root,y,direction:'right'});
  for(let frame=0;frame<120;frame++){
   if(frame){
    if(frame<35)y+=laneSpeed/60;
    else if(frame>=65)root+=20/60;
    runtime=advanceCombatAnimationRuntime(runtime,{x:root,y,kind:'ranger',direction:'right',
     locomotionCycleDistance:scale*cycle},1/60);
   }
   const previous=state,result=v177RangerFootPlacement(rig,state,{time:frame/60,root,scale,
    phase:runtime.locomotionPhase,settle:runtime.locomotionSettle,moving:runtime.moving,facing:runtime.direction});
   assertOriginalLegs(result,runtime.locomotionSettle);
   if(previous)for(let i=0;i<2;i++)if(previous.feet[i].mode==='plant'&&result.state.feet[i].mode==='plant')
    assert.ok(Math.abs(previous.feet[i].x-result.state.feet[i].x)<1e-8,'a supporting boot cannot slide to hide an overextended leg');
   state=result.state;
  }
 }
});

test('a moving turn begins its actual lifted step without stretching the newly leading leg',()=>{
 for(const facing of ['right','left']){
  const scale=.18,direction=facing==='right'?-1:1;
  const first={time:0,root:180,scale,phase:0,settle:0,moving:true,facing};
  const before=v177RangerFootPlacement(rig,null,first),input={...first,time:.05,
   root:first.root+direction,phase:1/(scale*cycle),facing:facing==='right'?'left':'right'};
  const result=v177RangerFootPlacement(rig,before.state,input);
  assertOriginalLegs(result,0);
  assert.ok(result.state.feet.some(foot=>foot.mode==='swing'&&foot.height>0));
  for(let i=0;i<2;i++)assert.ok(Math.abs(result.state.feet[i].x-before.state.feet[i].x)<4,
   'turning cannot mirror-teleport the old world foot positions');
 }
});

test('a pursuit that ends between paints cannot reuse the previous completed stop anchors',()=>{
 // f262 native performance artifact12135499268, webkit-844x390 actor9:
 // the last stop's boots remained at these world coordinates after retreat.
 const scale=86.30769230769232/480,root=726.863905230166,phase=24.599256761950738;
 const input={time:90.01666666666284,root,phase,scale,settle:1,moving:false,facing:'right'};
 const first=v177RangerFootPlacement(rig,null,{...input,time:input.time-.5});
 const before=v177RangerFootPlacement(rig,first.state,input);
 assert.ok(Math.abs(before.state.feet[0].x-719.6715975378582)<1e-10);
 assert.ok(Math.abs(before.state.feet[1].x-731.3590975378582)<1e-10);
 const next={...input,time:90.7166666666628,root:719.589367630198,phase:24.332410599448785};
 const saved=JSON.stringify(before.state),after=v177RangerFootPlacement(rig,before.state,next);
 assertOriginalLegs(after,1);
 assert.equal(JSON.stringify(before.state),saved);
 assert.equal(after.state.moving,true,'the feet must follow travel since the preceding paint even when the latest simulation tick stopped');
 assert.ok(after.state.feet.some(foot=>foot.height>0),'the correction requires an actual lifted step');
 for(let frame=1,state=after.state;frame<=36;frame++){
  const result=v177RangerFootPlacement(rig,state,{...next,time:next.time+frame/60});
  assertOriginalLegs(result,1);
  for(let i=0;i<2;i++)if(state.feet[i].mode==='plant'&&result.state.feet[i].mode==='plant')
   assert.ok(Math.abs(state.feet[i].x-result.state.feet[i].x)<1e-8,'settling cannot drag its support');
  state=result.state;
  if(frame===36){assert.equal(state.moving,false);assert.deepEqual(state.feet.map(foot=>foot.height),[0,0]);}
 }
});

test('short real movement and stop ticks between every paint keep the original gait and fixed supports',()=>{
 for(const facing of ['right','left'])for(const speed of [-29,29]){
  const scale=.18;let root=330,time=0,runtime=createCombatAnimationRuntime({x:root,y:285,direction:facing});
  const input=()=>({time,root,scale,phase:runtime.locomotionPhase,settle:runtime.locomotionSettle,moving:runtime.moving,facing:runtime.direction});
  let state=v177RangerFootPlacement(rig,null,input()).state;
  time=.5;state=v177RangerFootPlacement(rig,state,input()).state;
  let supports=0,lifts=0;
  for(let paint=0;paint<40;paint++){
   root+=speed/60;
   for(let tick=0;tick<2;tick++){
    time+=1/60;
    runtime=advanceCombatAnimationRuntime(runtime,{x:root,y:285,kind:'ranger',direction:facing,locomotionCycleDistance:scale*cycle},1/60);
   }
   assert.equal(runtime.moving,false,'the actual last simulation tick is stopped');
   const previous=state,unchanged=JSON.stringify(runtime),result=v177RangerFootPlacement(rig,state,input());
   assertOriginalLegs(result,runtime.locomotionSettle);state=result.state;
   assert.equal(JSON.stringify(runtime),unchanged,'presentation cannot rewrite gameplay animation history');
   assert.equal(state.moving,true);
   assert.deepEqual(v177RangerFootPlacement(rig,state,input()),result,'a repeated paint cannot advance the footstep');
   for(let i=0;i<2;i++){
    if(state.feet[i].height>1)lifts++;
    if(previous.feet[i].mode==='plant'&&state.feet[i].mode==='plant'){
     assert.ok(Math.abs(previous.feet[i].x-state.feet[i].x)<1e-8,'short pursuits cannot slide a grounded boot');supports++;
    }
   }
  }
  assert.ok(supports>10&&lifts>10);
 }
});

test('subthreshold drift after walking uses new lifted stop steps instead of retaining an expired goal',()=>{
 for(const drift of [-.04,.04]){
  const scale=.18;let root=330,time=0,runtime=createCombatAnimationRuntime({x:root,y:285,direction:'right'}),state;
  const observe=()=>{
   const previous=state,result=v177RangerFootPlacement(rig,state,{time,root,scale,
    phase:runtime.locomotionPhase,settle:runtime.locomotionSettle,moving:runtime.moving,facing:runtime.direction});
   assertOriginalLegs(result,runtime.locomotionSettle);state=result.state;
   if(previous)for(let i=0;i<2;i++)if(previous.feet[i].mode==='plant'&&state.feet[i].mode==='plant')
    assert.ok(Math.abs(previous.feet[i].x-state.feet[i].x)<1e-8,'corrective steps cannot slide their support');
  };
  observe();
  for(let frame=1;frame<=60;frame++){
   time+=1/60;root+=29/60;
   runtime=advanceCombatAnimationRuntime(runtime,{x:root,y:285,kind:'ranger',direction:'right',locomotionCycleDistance:scale*cycle},1/60);
   observe();
  }
  const phase=runtime.locomotionPhase;let lifted=0;
  for(let frame=1;frame<=480;frame++){
   time+=1/60;root+=drift;
   runtime=advanceCombatAnimationRuntime(runtime,{x:root,y:285,kind:'ranger',direction:'right',locomotionCycleDistance:scale*cycle},1/60);
   assert.equal(runtime.moving,false);assert.equal(runtime.locomotionPhase,phase);
   observe();if(state.feet.some(foot=>foot.height>.1))lifted++;
  }
  assert.ok(lifted>60,'continued small displacements need actual corrective steps');
  for(let frame=0;frame<60;frame++){
   time+=1/60;
   runtime=advanceCombatAnimationRuntime(runtime,{x:root,y:285,kind:'ranger',direction:'right',locomotionCycleDistance:scale*cycle},1/60);
   observe();
  }
  assert.deepEqual(state.feet.map(foot=>foot.height),[0,0]);
  assert.ok(Math.abs(state.feet[0].x-(root+scale*(rig.legs[0].footCenter-24-240)))<1e-8);
  assert.ok(Math.abs(state.feet[1].x-(root+scale*(rig.legs[1].footCenter+24-240)))<1e-8);
 }
});

test('a stationary facing turn lifts the endangered boot before reflecting the body',()=>{
 // Counterexample A: reflecting a fixed far ankle at phase .12 exceeds the
 // original leg length. Both world anchors must survive that first paint.
 for(const facing of ['right','left']){
  const input={time:0,root:330,phase:.12,scale:.18,moving:true,settle:0,facing};
  const first=v177RangerFootPlacement(rig,null,input);
  const request={...input,time:1/60,moving:false,facing:facing==='right'?'left':'right'};
  let result=v177RangerFootPlacement(rig,first.state,request);
  assertOriginalLegs(result,0);
  assert.equal(result.state.facing,first.state.facing,'the body must wait for a reachable turning pose');
  assert.ok(result.state.feet[0].height>0,'the endangered far boot must lift first');
  assert.equal(result.state.feet[1].x,first.state.feet[1].x,'the other boot remains a world-space support');
  assert.deepEqual(v177RangerFootPlacement(rig,result.state,request),result,'repeated painting cannot advance the turn');
  for(let frame=2;frame<=32;frame++){
   const previous=result.state;
   result=v177RangerFootPlacement(rig,previous,{...request,time:frame/60});
   assertOriginalLegs(result,0);
   for(let i=0;i<2;i++)if(previous.feet[i].mode==='plant'&&result.state.feet[i].mode==='plant')
    assert.equal(result.state.feet[i].x,previous.feet[i].x,'a turn cannot mirror or slide its supporting boot');
  }
  assert.equal(result.state.facing,-first.state.facing);
  assert.deepEqual(result.state.feet.map(foot=>foot.height),[0,0]);
 }
});

test('turning from each gait phase preserves original legs and supports through a stop or immediate pursuit',()=>{
 for(const facing of [-1,1])for(const scale of [.18,.2])for(const resume of [false,true])for(let key=0;key<60;key++){
  let root=330,phase=key/60;
  const input={time:0,root,phase,scale,moving:true,settle:0,facing};
  let result=v177RangerFootPlacement(rig,null,input);
  for(let frame=1;frame<=36;frame++){
   const moving=resume&&frame>=2,settle=moving?0:Math.min(1,frame/10);
   if(moving){root-=facing*29/60;phase+=29/60/(scale*cycle);}
   const current={...input,time:frame/60,root,phase,moving,settle,facing:-facing},previous=result.state;
   result=v177RangerFootPlacement(rig,previous,current);
   assertOriginalLegs(result,settle);
   assert.deepEqual(v177RangerFootPlacement(rig,result.state,current),result,'sampling the same turn twice must be idempotent');
   for(let i=0;i<2;i++)if(previous.feet[i].mode==='plant'&&result.state.feet[i].mode==='plant')
    assert.equal(result.state.feet[i].x,previous.feet[i].x,'a turning support remains planted in world space');
  }
  assert.equal(result.state.facing,-facing);
 }
});


test('the real deployment boundary correction carries the pose without stretching a planted leg',()=>{
 // Stage 4 Chromium: ramp exit at x=148 was clamped to x=197 in one tick.
 const {previous,input}={"previous":{"time":13.1666666666669,"root":148,"facing":1,"scale":0.16346153846153846,"phase":2.919267523851999,"offset":0,"moving":true,"travelSign":1,"feet":[{"x":147.87711843932527,"height":12.421422206676564,"angle":-0.11041264183712501,"mode":"swing","flight":{"id":"13.000000000000226:0","at":13.000000000000226,"endAt":13.220000000000226,"fromHeight":0,"fromAngle":0,"peak":18,"xAt":13.000000000000226,"fromX":136.10115583494235,"vx":0,"goalLocal":251.74401770586337,"goalFacing":1,"kind":"move","nominalEnd":3,"travelSign":1},"phaseHold":null,"vx":131.66469291860483},{"x":151.4843752024354,"height":8.248077391093743,"angle":-0.07331624347638882,"mode":"swing","flight":{"id":"13.133333333333566:1","at":13.133333333333566,"endAt":13.353333333333566,"fromHeight":0,"fromAngle":0,"peak":18,"xAt":13.133333333333566,"fromX":151.29238412219635,"vx":0,"goalLocal":279.11207838026235,"goalFacing":1,"kind":"move","nominalEnd":3,"travelSign":1},"phaseHold":null,"vx":12.326843685292834}],"requestedFacing":1,"lastLandedLeg":1},"input":{"time":13.183333333333568,"root":197,"scale":0.16346153846153846,"phase":5.302787805919049,"moving":true,"facing":1,"settle":0}};
 const saved=JSON.stringify(previous),result=v177RangerFootPlacement(rig,previous,input);
 assertOriginalLegs(result,input.settle);
 assert.equal(JSON.stringify(previous),saved);
 const dx=input.root-previous.root;
 for(let i=0;i<2;i++){
  assert.ok(Math.abs(result.state.feet[i].x-previous.feet[i].x-dx)<1e-10);
  assert.equal(result.state.feet[i].height,previous.feet[i].height);
  assert.equal(result.state.feet[i].angle,previous.feet[i].angle);
 }
 assert.deepEqual(v177RangerFootPlacement(rig,result.state,input),result);
 const turnInput={...input,facing:-1},turned=v177RangerFootPlacement(rig,previous,turnInput);
 assertOriginalLegs(turned,input.settle);
 assert.equal(turned.state.requestedFacing,-1);
 assert.deepEqual(v177RangerFootPlacement(rig,turned.state,turnInput),turned);
 let state=result.state;
 for(let frame=1;frame<=90;frame++){
  const next={...input,time:input.time+frame/60,root:input.root+29*frame/60,phase:input.phase+29*frame/60/(input.scale*cycle)};
  const result=v177RangerFootPlacement(rig,state,next);assertOriginalLegs(result,next.settle);
  for(let i=0;i<2;i++)if(state.feet[i].mode==='plant'&&result.state.feet[i].mode==='plant')
   assert.equal(result.state.feet[i].x,state.feet[i].x,'normal pursuit retains world supports');
  state=result.state;
 }
});
