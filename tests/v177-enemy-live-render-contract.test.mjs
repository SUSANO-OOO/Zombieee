import test from 'node:test';
import assert from 'node:assert/strict';
import {assertV177EnemyLiveRender} from '../scripts/v177-enemy-live-render-contract.mjs';
const fixture=(phase='move')=>({kind:'kurome',phase,fighterId:8,expectedJointPath:'/art/v100/joints/kurome-r1.webp',samples:Array.from({length:6},(_,i)=>({at:200*i,simulationTime:i*.2,running:true,paused:false,route:'/v100',visible:true,fighter:{id:8,kind:'kurome',hp:2100,x:620-i*3,attackSequence:phase==='attack'?1:0},renders:[{renderSequence:i+1,assetReady:true,x:620-i*3,y:280,renderWidth:150,renderHeight:140,poseScaleX:1,poseScaleY:1,requestedState:phase==='move'?'move':'active',actualXDelta:phase==='move'?-3:0,jointAtlasPath:'/art/v100/joints/kurome-r1.webp',jointLowerFrame:2,jointUpperFrame:3}]}))});

test('Live evidence requires actual V1 travel and attack drawing for the connected rig',()=>{
  assert.equal(assertV177EnemyLiveRender(fixture()).jointConnected,true);
  assert.ok(assertV177EnemyLiveRender(fixture('attack')).states.includes('active'));
  const legacy=fixture();legacy.expectedJointPath=null;for(const s of legacy.samples)for(const r of s.renders)r.jointAtlasPath=null;
  assert.equal(assertV177EnemyLiveRender(legacy).jointConnected,false,'unconnected forms cannot be counted as joint-connected');
});

test('Legacy routing, paused poses, stalled clocks and missing joints cannot pass as live V1 joints',()=>{
  for(const mutate of [f=>{f.samples[0].route='/';},f=>{f.samples[2].paused=true;},f=>{for(const s of f.samples)s.simulationTime=0;},f=>{f.samples[2].renders[0].jointAtlasPath=null;},f=>{f.samples[2].renders[0].x=NaN;},f=>{for(const s of f.samples)s.renders[0].renderSequence=1;},f=>{f.samples[0].fighter.id=9;}]){const f=fixture();mutate(f);assert.throws(()=>assertV177EnemyLiveRender(f));}
});

test('Pose labels without actual travel or normal attack receipts cannot pass',()=>{
  const stationary=fixture();for(const s of stationary.samples)s.fighter.x=620;assert.throws(()=>assertV177EnemyLiveRender(stationary),/actually advance/);
  const noAttack=fixture('attack');for(const s of noAttack.samples)s.fighter.attackSequence=0;assert.throws(()=>assertV177EnemyLiveRender(noAttack),/real attack/);
  const noActive=fixture('attack');for(const s of noActive.samples)s.renders[0].requestedState='wind-up';assert.throws(()=>assertV177EnemyLiveRender(noActive),/active drawing/);
});
