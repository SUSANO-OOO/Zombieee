import test from 'node:test';
import assert from 'node:assert/strict';
import {assertV177EnemyLiveRender,v177EnemyRuntimeRenderIdentity} from '../scripts/v177-enemy-live-render-contract.mjs';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
const fixture=(phase='move',kind='kurome',v100TwinPart=null)=>{
  const renderKind=v100TwinPart?`futago-separated-${v100TwinPart}`:kind;
  const expectedJointPath=V177_JOINT_ATLASES[renderKind].path;
  return {kind,phase,fighterId:8,renderKind,v100TwinPart,expectedJointPath,
    samples:Array.from({length:6},(_,i)=>({at:200*i,simulationTime:i*.2,running:true,paused:false,route:'/v100',visible:true,
      fighter:{id:8,kind,renderKind,v100TwinPart,hp:2100,x:620-i*3,attackSequence:phase==='attack'?1:0},
      renders:[{renderSequence:i+1,renderKind,assetReady:true,x:620-i*3,y:280,renderWidth:150,renderHeight:140,poseScaleX:1,poseScaleY:1,requestedState:phase==='move'?'move':'active',actualXDelta:phase==='move'?-3:0,jointAtlasPath:expectedJointPath,jointLowerFrame:2+i,jointUpperFrame:3+i}]}))};
};

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

test('a missing native draw at any observation still fails the continuous evidence contract',()=>{
  for(const index of [0,2,5]){
    const f=fixture();f.samples[index].renders=[];
    assert.throws(()=>assertV177EnemyLiveRender(f),/native observations require actual draw receipts/);
  }
});

test('connected enemies cannot slide on frozen feet or use a frozen attack rig',()=>{
  const feet=fixture();for(const s of feet.samples)for(const r of s.renders)r.jointLowerFrame=2;
  assert.throws(()=>assertV177EnemyLiveRender(feet),/enemy feet must advance/);
  const arms=fixture('attack');for(const s of arms.samples)for(const r of s.renders)r.jointUpperFrame=3;
  assert.throws(()=>assertV177EnemyLiveRender(arms),/enemy attack rig must advance/);
});

test('Each V1 twin selects its own connected body from the spawned part identity',()=>{
  for(const part of ['a','b'])for(const phase of ['move','attack']){
    const f=fixture(phase,'futago',part),path=`/art/v100/joints/futago-separated-${part}-r1.webp`;
    assert.deepEqual(v177EnemyRuntimeRenderIdentity(f),{renderKind:`futago-separated-${part}`,v100TwinPart:part,expectedJointPath:path});
    assert.equal(assertV177EnemyLiveRender(f).expectedJointPath,path);
  }
});

test('Fused art, wrong twin parts, missing draw identity and another body cannot pass for a V1 twin',()=>{
  for(const mutate of [
    f=>{f.renderKind='futago';},
    f=>{f.v100TwinPart=null;},
    f=>{f.samples[0].fighter.v100TwinPart='a';},
    f=>{f.samples[0].fighter.renderKind='futago-separated-a';},
    f=>{delete f.samples[0].renders[0].renderKind;},
    f=>{f.samples[0].renders[0].renderKind='futago';},
    f=>{f.samples[0].renders[0].jointAtlasPath='/art/v100/joints/futago-r1.webp';},
    f=>{f.samples[0].renders[0].jointAtlasPath='/art/v100/joints/futago-separated-a-r1.webp';},
    f=>{f.expectedJointPath='/art/v100/joints/futago-r1.webp';},
  ]){const f=fixture('move','futago','b');mutate(f);assert.throws(()=>assertV177EnemyLiveRender(f));}
  assert.throws(()=>v177EnemyRuntimeRenderIdentity({kind:'kurome',renderKind:'kurome',v100TwinPart:'b'}));
});
