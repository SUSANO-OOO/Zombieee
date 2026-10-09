import assert from 'node:assert/strict';
import test from 'node:test';
import {beginSoukiBurst,advanceSoukiBurst,STATION_ENEMY_TUNING} from '../app/stationEnemyMechanics.js';
import {spriteFrameFor,fitSpriteBattleDisplaySize,SPRITE_STATES} from '../app/spriteManifest.js';
import {v100SoukiPose,v100SoukiAuthoredSize,V100_SOUKI_STABLE_POSE} from '../app/v100SoukiPresentation.js';

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
