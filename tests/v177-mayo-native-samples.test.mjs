import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {collectV177MayoNativeSamples,takeV177MayoNativeSamples} from '../scripts/v177-mayo-native-samples.mjs';

function fixture({automatic=true,failAt=0}={}){
  let now=0,reads=0,nextTimer=0;
  const waits=[],timers=new Map(),fighter={id:17,kind:'mayo-chan',hp:64,manualAbilityPhase:'feral'};
  const socket={x:0,y:2},render={renderSequence:1,renderKind:'mayo-chan-feral',assetReady:true,
    x:3,y:4,renderWidth:5,renderHeight:6,poseScaleX:1,poseScaleY:1,requestedState:'active',actualXDelta:1,
    jointAtlasPath:'original.png',jointLowerFrame:2,jointWeightedLowerDrawSucceeded:true,
    jointWeightedLower:{mode:'original'},jointUpperFrame:3,renderedWeaponSocket:socket};
  const qa={getSnapshot:()=>({time:now/1000,running:true,paused:false}),getEnemyFacingRuntimeAudit:id=>{
    assert.equal(id,17);reads++;if(reads===failAt)throw new Error('Actual audit read failed');
    fighter.hp=64-reads;fighter.manualAbilityPhase=reads===30?'retreat':'feral';
    socket.x=reads;render.renderSequence=reads;return {fighter,renderHistory:[render]};
  }};
  const context=vm.createContext({window:{__ASHFALL_BATTLE_QA__:qa},location:{pathname:'/v100'},
    document:{visibilityState:'visible'},performance:{now:()=>now},structuredClone,
    setTimeout(callback,delay){
      assert.equal(delay,120);waits.push(delay);const id=++nextTimer;timers.set(id,callback);
      if(automatic)queueMicrotask(()=>{if(timers.has(id)){now+=delay;timers.delete(id);callback();}});
      return id;
    },clearTimeout(id){timers.delete(id);}});
  const collect=vm.runInContext('('+collectV177MayoNativeSamples.toString()+')',context);
  const take=vm.runInContext('('+takeV177MayoNativeSamples.toString()+')',context);
  return {collect,take,waits,timers,qa,fighter,render,get reads(){return reads;}};
}

test('all30 timed observations retain an expired phase and freeze nested values at each read',async()=>{
  const f=fixture(),receipt=await f.collect({owner:'original',fighterId:17}),row=f.take({owner:'original'});
  assert.equal(receipt.status,'completed');assert.equal(receipt.count,30);
  assert.equal(row.samples.length,30);assert.equal(f.waits.length,30);assert.equal(f.reads,30);
  assert.equal(row.startedAt,0);assert.equal(row.finishedAt,3600);
  for(let i=0;i<30;i++){
    const sample=row.samples[i];assert.equal(sample.at,(i+1)*120);assert.equal(sample.simulationTime,(i+1)*120/1000);
    assert.equal(sample.fighter.hp,63-i);assert.equal(sample.renders[0].renderedWeaponSocket.x,i+1);
    assert.equal(sample.renders[0].renderSequence,i+1);assert.equal(sample.renders[0].jointWeightedLower.mode,'original');
  }
  assert.equal(row.samples.at(-1).fighter.manualAbilityPhase,'retreat','do not hide the bad final state');
  assert.equal(row.samples[0].fighter.manualAbilityPhase,'feral');
  assert.equal(f.fighter.manualAbilityPhase,'retreat');assert.equal(f.timers.size,0);
  assert.equal(f.take({owner:'original'}),null,'evidence is taken once');
});

test('a real read error remains failed with all earlier observations available',async()=>{
  const f=fixture({failAt:7}),receipt=await f.collect({owner:'failed',fighterId:17}),row=f.take({owner:'failed'});
  assert.equal(receipt.status,'failed');assert.match(receipt.error,/Actual audit read failed/);
  assert.equal(row.status,'failed');assert.equal(row.samples.length,6);assert.equal(f.reads,7);
  assert.equal(f.timers.size,0);assert.equal(f.take({owner:'failed'}),null);
});

test('only the current owner can cancel and drain an incomplete collection',async()=>{
  const f=fixture({automatic:false}),pending=f.collect({owner:'current',fighterId:17});
  assert.equal(f.timers.size,1);
  assert.throws(()=>f.take({owner:'other'}),/another owner/);assert.equal(f.timers.size,1);
  const row=f.take({owner:'current'});assert.equal(row.cancelled,true);assert.equal(row.samples.length,0);
  const final=await pending;assert.equal(final.status,'failed');assert.match(final.error,/cancelled/);
  assert.equal(f.timers.size,0);assert.equal(f.reads,0);assert.equal(f.fighter.hp,64);
});

test('a second collector cannot overwrite a pending owner',async()=>{
  const f=fixture({automatic:false}),pending=f.collect({owner:'first',fighterId:17});
  await assert.rejects(f.collect({owner:'second',fighterId:17}),/already owned/);
  const row=f.take({owner:'first'});assert.equal(row.owner,'first');assert.equal(row.sampleCount,30);
  assert.equal(row.spacingMs,120);assert.equal((await pending).status,'failed');assert.equal(f.timers.size,0);
});
