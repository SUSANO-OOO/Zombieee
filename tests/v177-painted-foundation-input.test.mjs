import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {stepV177PaintedFoundationInput} from '../scripts/v177-painted-foundation-input.mjs';
import {V177_NATIVE_ACTION_PLAN} from '../scripts/v177-native-action-plan.mjs';

function fixture(t){
  const names=['__ASHFALL_BATTLE_QA__','window'],saved=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const inputs=[];let reads=0,readFailure=null;
  const fighter={id:7,renderAudit:{renderSequence:1,assetReady:true,jointLowerFrame:3,jointUpperFrame:4,renderedWeaponSocket:{x:12}}};
  const qa={
    getSnapshot(){reads++;if(readFailure)throw readFailure;return {fighters:[fighter]};},
    stepAnimationFoundationProof(id,action,dt){
      inputs.push({id,action,dt,paintedSequence:fighter.renderAudit.renderSequence});
      Object.assign(fighter.renderAudit,{jointLowerFrame:9,jointUpperFrame:10});
      fighter.renderAudit.renderedWeaponSocket.x=24;
    },
  };
  globalThis.__ASHFALL_BATTLE_QA__=qa;globalThis.window={__ASHFALL_BATTLE_QA__:qa};
  t.after(()=>{for(const [name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}});
  return {fighter,inputs,get reads(){return reads;},failRead(error){readFailure=error;}};
}

test('serialized hosted step captures the actual before-hit body before mutating the reused audit',t=>{
  const f=fixture(t),run=(0,eval)('('+stepV177PaintedFoundationInput.toString()+')');
  const r=run({fighterId:7,previous:0,action:'hit-light'});
  assert.equal(f.reads,1);assert.equal(r.previous,1);
  assert.deepEqual(f.inputs,[{id:7,action:'hit-light',dt:.06,paintedSequence:1}]);
  assert.equal(r.beforeRender.jointLowerFrame,3);assert.equal(r.beforeRender.jointUpperFrame,4);
  assert.equal(r.beforeRender.renderedWeaponSocket.x,12);assert.equal(f.fighter.renderAudit.renderedWeaponSocket.x,24);
});

test('all eleven existing inputs retain the same time step and only hits transfer the before snapshot',t=>{
  const f=fixture(t);
  for(const {action}of V177_NATIVE_ACTION_PLAN){
    const r=stepV177PaintedFoundationInput({fighterId:7,previous:0,action});
    assert.equal(Boolean(r.beforeRender),action.startsWith('hit-'),action);
    assert.equal(f.inputs.at(-1).dt,.06,action);assert.equal(r.previous,1,action);
  }
  assert.equal(f.reads,11);assert.equal(f.inputs.length,11);
});

test('missing, stale or unready bodies never receive the input',t=>{
  const f=fixture(t);
  assert.throws(()=>stepV177PaintedFoundationInput({fighterId:7,previous:1,action:'attack'}),/ready paint/);
  f.fighter.renderAudit.assetReady=false;
  assert.throws(()=>stepV177PaintedFoundationInput({fighterId:7,previous:0,action:'attack'}),/ready paint/);
  assert.throws(()=>stepV177PaintedFoundationInput({fighterId:99,previous:0,action:'attack'}),/ready paint/);
  assert.equal(f.inputs.length,0);
});

test('snapshot failures preserve the original error without applying an input',t=>{
  const f=fixture(t),error=new Error('snapshot unavailable');f.failRead(error);
  assert.throws(()=>stepV177PaintedFoundationInput({fighterId:7,previous:0,action:'stop'}),e=>e===error);
  assert.equal(f.inputs.length,0);
});

test('actual driver keeps both protocol paint waits and exposes the first invalid post-input draw',async t=>{
  const f=fixture(t),source=readFileSync(new URL('../scripts/v102-combat-browser.mjs',import.meta.url),'utf8');
  const start=source.indexOf('          await page.waitForFunction(({fighterId,previous})=>{');
  const end=source.indexOf('          const r=sample.renderAudit;',start);
  assert.ok(start>=0&&end>start);
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  const run=new AsyncFunction('page','proof','action','stepV177PaintedFoundationInput',source.slice(start,end)+'return {sample,beforeRender};');
  const calls=[];let waits=0;
  f.fighter.renderAudit.renderSequence=0;
  const page={
    async waitForFunction(predicate,arg,options){
      assert.equal(options,undefined,'retain the original protocol-owned default timeout');
      waits++;calls.push('wait'+waits);assert.equal(Boolean(predicate(arg)),false);
      assert.equal(f.inputs.length,waits-1);
      f.fighter.renderAudit.renderSequence=waits;
      if(waits===2)f.fighter.renderAudit.assetReady=false;
      assert.equal(Boolean(predicate(arg)),true);
    },
    async evaluate(fn,arg){calls.push(fn===stepV177PaintedFoundationInput?'step':'sample');return fn(arg);},
  };
  const r=await run(page,{fighterId:7,previous:0},'hit-heavy',stepV177PaintedFoundationInput);
  assert.deepEqual(calls,['wait1','step','wait2','sample']);assert.equal(f.inputs.length,1);
  assert.equal(r.beforeRender.jointLowerFrame,3);assert.equal(r.sample.renderAudit.assetReady,false);
});
