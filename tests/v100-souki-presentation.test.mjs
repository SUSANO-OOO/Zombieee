import assert from 'node:assert/strict';
import test from 'node:test';
import {beginSoukiBurst,advanceSoukiBurst,STATION_ENEMY_TUNING} from '../app/stationEnemyMechanics.js';
import {spriteFrameFor,fitSpriteBattleDisplaySize,SPRITE_STATES} from '../app/spriteManifest.js';
import {v100SoukiPose,v100SoukiAuthoredSize,V100_SOUKI_STABLE_POSE} from '../app/v100SoukiPresentation.js';
import {readFileSync} from 'node:fs';
import {createCombatAnimationRuntime,advanceCombatAnimationRuntime,combatFacingDirection} from '../app/combatPresentation.js';

test('Souki burst stride follows signed actual travel while its ability clock continues',()=>{
 const duration=STATION_ENEMY_TUNING.souki.burstSeconds,speed=STATION_ENEMY_TUNING.souki.burstSpeed;
 for(const elapsed of [.1,.3,.54,.8,1]){
  const runtime={phase:'burst',remainingSeconds:duration-elapsed};
  assert.deepEqual(v100SoukiPose(runtime,0,-speed*elapsed),v100SoukiPose(runtime),'Full-speed cadence stays unchanged at a matching world phase');
 }
 for(const distance of [0,46,-46]){
  const poses=[.3,.5,.8,1].map(elapsed=>v100SoukiPose({phase:'burst',remainingSeconds:duration-elapsed},0,distance));
  assert.equal(new Set(poses.map(p=>p.spriteState)).size,1,'No foot cycle while the root stays at contact');
  assert.deepEqual(poses.map(p=>p.elapsed),[.3,.5,.8,1].map(e=>duration-(duration-e)),'Keep original ability time');
 }
 const at=distance=>v100SoukiPose({phase:'burst',remainingSeconds:.3},0,distance).spriteState;
 assert.notEqual(at(-speed*.3),at(-speed*.5),'Different world positions select different stride poses');
 const source=readFileSync('app/AshfallGame.tsx','utf8');
 assert.match(source,/v100SoukiPose\(f\.stationAbility,actionPresentationFlash,f\.x\)/u);
});

test('rightward contact pushback reverses the fixed-left burst even when normal runtime facing becomes right',()=>{
 const f={x:381.8,y:285},ability={phase:'burst',remainingSeconds:.3};
 let animation=createCombatAnimationRuntime({x:f.x,y:f.y,direction:'left'});
 const before=v100SoukiPose(ability,0,f.x);assert.equal(before.spriteState,'attack-b');
 const actualXDelta=2;f.x+=actualXDelta;
 const direction=combatFacingDirection({side:'zombie',actualXDelta,aiMoveDirection:0,entryDirection:-1,targetDirection:-1});
 animation=advanceCombatAnimationRuntime(animation,{kind:'sprinter',direction,x:f.x,y:f.y,locomotionCycleDistance:48.5930950493},1/60);
 assert.equal(animation.direction,'right');assert.ok(animation.locomotionPhase>0,'Normal runtime faces the actual push');
 const after=v100SoukiPose(ability,0,f.x);assert.equal(after.spriteState,'walk-a','Fixed-left body retraces the preceding stride cell');
 assert.equal(after.elapsed,before.elapsed,'The shove does not advance ability time');
 assert.equal(v100SoukiPose(ability,0,381.8).spriteState,before.spriteState,'Returning to the same world point restores its pose');
});

test('Souki uses its authored crouch, launch, strides and recovery through an actual unchanged burst',()=>{
 let runner={id:8,kind:'sprinter',side:'zombie',hp:90,combatReady:true,lane:1,x:780,y:285};
 let runtime=beginSoukiBurst({runner}).runtime;const poses=new Map();
 assert.equal(v100SoukiPose(runtime).spriteState,'idle');
 for(let i=0;i<150;i++){
  const sample=v100SoukiPose(runtime),phase=runtime.phase;
  if(sample){const states=poses.get(phase)??new Set();states.add(sample.spriteState);poses.set(phase,states);assert.equal(v100SoukiPose(runtime,.1).spriteState,'hit');}
  const beforeX=runner.x,next=advanceSoukiBurst({runtime,runner,elapsedSeconds:1/60,crawlerRearBoundaryX:100});runtime=next.runtime;runner=next.runner;
  if(phase==='telegraph'&&runtime.phase==='telegraph')assert.equal(runner.x,beforeX,'Windup does not slide forward');
 }
 assert.deepEqual([...poses.get('telegraph')],['idle','walk-a','attack-a']);
 assert.ok(['attack-b','walk-a','walk-b'].every(p=>poses.get('burst').has(p)));
 assert.deepEqual([...poses.get('recovery')],['walk-a','attack-a','idle']);
 assert.equal(runtime.phase,'idle');assert.equal(v100SoukiPose(runtime),null);
 assert.ok(Math.abs(runner.x-(780-STATION_ENEMY_TUNING.souki.burstSpeed*STATION_ENEMY_TUNING.souki.burstSeconds))<1e-8);
 assert.equal(runner.hp,90);assert.equal(runner.lane,1);
 assert.deepEqual(V100_SOUKI_STABLE_POSE,{offsetX:0,offsetY:0,rotationRadians:0,scaleX:1,scaleY:1,opacity:1});
});

test('Souki keeps one source-cell scale and authored foot baseline through every pose and direction',()=>{
 for(const direction of ['left','right']){
  const idle=spriteFrameFor('sprinter','idle',direction),maximum={w:58,h:96};
  const base=fitSpriteBattleDisplaySize('sprinter',idle,maximum),scale=base.h/448;
  for(const state of SPRITE_STATES){
   const frame=spriteFrameFor('sprinter',state,direction),size=v100SoukiAuthoredSize(frame,direction,maximum);
   assert.deepEqual(size,base);assert.equal(frame.anchorY,idle.anchorY,'Keep the actual common foot line');
   if(state==='attack-a')assert.ok(frame.contentRect.h*scale<idle.contentRect.h*scale*.65,'Crouching lowers the head without enlarging the body');
  }
 }
 assert.equal(v100SoukiPose({phase:'telegraph',remainingSeconds:NaN}),null);
 assert.throws(()=>v100SoukiAuthoredSize(spriteFrameFor('guardian','idle','left'),'left',{w:58,h:96}),/Recalibrate/);
});
