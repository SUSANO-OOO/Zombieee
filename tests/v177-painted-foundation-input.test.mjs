import assert from 'node:assert/strict';
import test from 'node:test';
import {sampleV177PaintedFoundationInput} from '../scripts/v177-painted-foundation-input.mjs';

function fixture(t){
  const names=['__ASHFALL_BATTLE_QA__','requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout'];
  const saved=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const frames=new Map(),timers=new Map(),inputs=[];
  let serial=0,reads=0,readFailure=null;
  const fighter={id:7,renderAudit:{renderSequence:0,assetReady:true,jointLowerFrame:3,jointUpperFrame:4,renderedWeaponSocket:{x:12}}};
  globalThis.requestAnimationFrame=callback=>{const id=++serial;frames.set(id,callback);return id;};
  globalThis.cancelAnimationFrame=id=>frames.delete(id);
  globalThis.setTimeout=(callback,ms)=>{const id=++serial;timers.set(id,{callback,ms});return id;};
  globalThis.clearTimeout=id=>timers.delete(id);
  globalThis.__ASHFALL_BATTLE_QA__={
    getSnapshot(){reads++;if(readFailure)throw readFailure;return {fighters:[fighter]};},
    stepAnimationFoundationProof(id,action,dt){
      inputs.push({id,action,dt,paintedSequence:fighter.renderAudit.renderSequence});
      Object.assign(fighter.renderAudit,{jointLowerFrame:9,jointUpperFrame:10});
      fighter.renderAudit.renderedWeaponSocket.x=24;
    },
  };
  t.after(()=>{for(const [name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}});
  return {fighter,frames,timers,inputs,get reads(){return reads;},failRead(error){readFailure=error;},
    async paint(sequence,ready=true){
      Object.assign(fighter.renderAudit,{renderSequence:sequence,assetReady:ready});
      const pending=[...frames.values()];frames.clear();for(const callback of pending)callback();
      await Promise.resolve();await Promise.resolve();
    }};
}

test('serialized hosted helper waits for both actual paints and detaches the before-hit body',async t=>{
  const f=fixture(t),run=(0,eval)('('+sampleV177PaintedFoundationInput.toString()+')');
  let settled=false;const result=run({fighterId:7,previous:0,action:'hit-light'}).then(r=>{settled=true;return r;});
  assert.equal(f.inputs.length,0);assert.equal(f.reads,1);
  assert.deepEqual([...f.timers.values()].map(x=>x.ms),[30_000]);
  await f.paint(1);
  assert.deepEqual(f.inputs,[{id:7,action:'hit-light',dt:.06,paintedSequence:1}]);
  assert.equal(settled,false,'applying the input cannot substitute for an actual new draw');
  assert.deepEqual([...f.timers.values()].map(x=>x.ms),[30_000]);
  await f.paint(2);const r=await result;
  assert.equal(r.beforeRender.jointLowerFrame,3);assert.equal(r.beforeRender.jointUpperFrame,4);
  assert.equal(r.beforeRender.renderedWeaponSocket.x,12);
  assert.equal(r.sample.renderAudit.renderSequence,2);assert.equal(r.sample.renderAudit.jointLowerFrame,9);
  assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
});

test('missing ready paint times out without input and late frames cannot restart the helper',async t=>{
  const f=fixture(t);f.fighter.renderAudit.assetReady=false;
  const promise=sampleV177PaintedFoundationInput({fighterId:7,previous:0,action:'attack'});
  const rejected=assert.rejects(promise,/Paint timeout/),late=[...f.frames.values()][0];
  await f.paint(1,false);assert.equal(f.inputs.length,0);
  [...f.timers.values()][0].callback();await rejected;
  const reads=f.reads;late();await f.paint(2,true);
  assert.equal(f.inputs.length,0);assert.equal(f.reads,reads);assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
});

test('post-input timeout never repeats the step or accepts the preceding render',async t=>{
  const f=fixture(t);f.fighter.renderAudit.renderSequence=1;
  const promise=sampleV177PaintedFoundationInput({fighterId:7,previous:0,action:'deploy'});
  const rejected=assert.rejects(promise,/Paint timeout/);
  await Promise.resolve();await Promise.resolve();
  assert.equal(f.inputs.length,1);const late=[...f.frames.values()][0];
  [...f.timers.values()][0].callback();await rejected;
  late();await f.paint(2);assert.equal(f.inputs.length,1);assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
});

test('the first post-input draw stays observable even when its asset is invalid',async t=>{
  const f=fixture(t);f.fighter.renderAudit.renderSequence=1;
  const promise=sampleV177PaintedFoundationInput({fighterId:7,previous:0,action:'recovery'});
  await Promise.resolve();await Promise.resolve();await f.paint(2,false);
  const r=await promise;assert.equal(r.sample.renderAudit.assetReady,false);
  assert.equal(r.beforeRender,null);assert.equal(f.inputs.length,1);assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
});

test('snapshot failure rejects and cleans the owned wait before any input',async t=>{
  const f=fixture(t);f.failRead(new Error('snapshot unavailable'));
  await assert.rejects(sampleV177PaintedFoundationInput({fighterId:7,previous:0,action:'stop'}),/snapshot unavailable/);
  assert.equal(f.inputs.length,0);assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
});
