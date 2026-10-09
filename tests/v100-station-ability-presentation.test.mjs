import assert from 'node:assert/strict';
import test from 'node:test';
import {beginKaramiteWindup,advanceKaramiteWindup,resolveKaramiteBind,advanceKaramitePull,beginTicketGateEaterCharge,advanceTicketGateEaterCharge,STATION_ENEMY_TUNING} from '../app/stationEnemyMechanics.js';
import {v100StationAbilityPose,v100GateEaterAuthoredSize,V100_STATION_STABLE_POSE} from '../app/v100StationAbilityPresentation.js';
import {spriteFrameFor,spriteBattleDisplaySizeFor,SPRITE_STATES} from '../app/spriteManifest.js';

test('Karamite keeps its real arm posture and target direction through unchanged windup and pull',()=>{
 for(const direction of [-1,1]){
  const attacker={id:'g',side:'zombie',hp:100,lane:1,x:600,y:280};let target={id:'h',side:'human',hp:150,lane:1,x:600+direction*100,y:280};
  let runtime=beginKaramiteWindup({attacker,target}).runtime;
  for(let i=0;i<53;i++){assert.equal(v100StationAbilityPose('grappler',runtime).spriteState,'attack-a');assert.equal(runtime.direction,direction);runtime=advanceKaramiteWindup(runtime,1/60);}
  assert.equal(runtime.phase,'windup');runtime=advanceKaramiteWindup(runtime,STATION_ENEMY_TUNING.karamite.windupSeconds-53/60);
  assert.equal(runtime.phase,'ready');const bind=resolveKaramiteBind({runtime,attacker,target});assert.equal(bind.bound,true);runtime=bind.runtime;
  let distance=0;
  while(runtime.phase==='pulling'){
   assert.equal(v100StationAbilityPose('grappler',runtime).spriteState,'attack-b');assert.equal(runtime.direction,direction);
   const next=advanceKaramitePull({runtime,attacker,target,elapsedSeconds:1/60});runtime=next.runtime;target=next.target;distance+=next.pulledDistance;
  }
  assert.ok(Math.abs(distance-82)<1e-7);assert.equal(target.hp,150);assert.equal(target.y,280);assert.equal(runtime.phase,'idle');
  assert.equal(v100StationAbilityPose('grappler',runtime),null);
 }
});

test('Gate Eater braces, charges low and settles through its actual unchanged ability timeline',()=>{
 for(const direction of [-1,1]){
  let boss={id:'b',side:'zombie',hp:2100,combatReady:true,lane:1,x:600,y:280};
  let runtime=beginTicketGateEaterCharge({boss,targetX:600+direction*135}).runtime;
  const observed=new Map();
  for(let i=0;i<400&&runtime.phase!=='idle';i++){
   const sample=v100StationAbilityPose('gate-eater',runtime),poses=observed.get(runtime.phase)??new Set();poses.add(sample.spriteState);observed.set(runtime.phase,poses);assert.equal(sample.direction,direction);
   assert.equal(v100StationAbilityPose('gate-eater',runtime,.02),null,'Actual damage still uses the hit reaction');
   const previousX=boss.x,next=advanceTicketGateEaterCharge({runtime,boss,elapsedSeconds:1/60});
   if(runtime.phase==='windup'&&next.runtime.phase==='windup')assert.equal(next.boss.x,previousX);
   runtime=next.runtime;boss=next.boss;
  }
  assert.deepEqual([...observed.get('windup')],['attack-a']);assert.deepEqual([...observed.get('charging')],['attack-b']);assert.deepEqual([...observed.get('exposed')],['attack-b','walk-a','idle']);
  assert.ok(Math.abs(boss.x-(600+direction*135))<1e-7);assert.equal(boss.hp,2100);assert.equal(boss.lane,1);
 }
});

test('Gate Eater poses retain one image scale and common authored foot baseline',()=>{
 for(const direction of ['left','right']){
  const idle=spriteFrameFor('gate-eater','idle',direction),maximum=spriteBattleDisplaySizeFor('gate-eater'),reference=v100GateEaterAuthoredSize(idle,direction,maximum);
  for(const state of SPRITE_STATES){const frame=spriteFrameFor('gate-eater',state,direction);assert.deepEqual(v100GateEaterAuthoredSize(frame,direction,maximum),reference);assert.equal(frame.anchorY,idle.anchorY);}
  assert.ok(spriteFrameFor('gate-eater','attack-b',direction).contentRect.h<idle.contentRect.h);
 }
 assert.equal(v100StationAbilityPose('gate-eater',{phase:'charging',remainingSeconds:NaN}),null);
 assert.deepEqual(V100_STATION_STABLE_POSE,{offsetX:0,offsetY:0,rotationRadians:0,scaleX:1,scaleY:1,opacity:1});
});
