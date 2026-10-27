import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {startAvailabilityProbe,stopAvailabilityProbe} from '../scripts/ops-timer-availability-probe.mjs';
function fixture(){
  let now=1,callback,calls=0,cleared=0;const qa={time:123},raf=()=>{},media=class{};
  const sandbox={window:{__ASHFALL_BATTLE_QA__:qa,requestAnimationFrame:raf,MediaRecorder:media},performance:{now:()=>now},
    setInterval:(fn,ms)=>{assert.equal(ms,16);callback=fn;calls++;return 7;},clearInterval:id=>{assert.equal(id,7);cleared++;}};
  const context=vm.createContext(sandbox);
  return {sandbox,qa,raf,media,start:value=>vm.runInContext('('+startAvailabilityProbe.toString()+')',context)(value),
    stop:()=>vm.runInContext('('+stopAvailabilityProbe.toString()+')',context)(),tick:at=>{now=at;callback();},counts:()=>({calls,cleared})};
}
test('only enabled observations retain actual callback times, including a real gap; game and native APIs stay untouched',()=>{
  for(const enabled of [false,true]){
    const f=fixture();f.start(enabled);if(enabled){f.tick(17);f.tick(33);f.tick(233);}
    const result=f.stop();assert.deepEqual(Array.from(result.rows),enabled?[17,33,233]:[]);
    assert.deepEqual(f.counts(),{calls:enabled?1:0,cleared:enabled?1:0});assert.equal(result.overflow,false);
    assert.equal(f.sandbox.window.__ASHFALL_BATTLE_QA__,f.qa);assert.equal(f.qa.time,123);
    assert.equal(f.sandbox.window.requestAnimationFrame,f.raf);assert.equal(f.sandbox.window.MediaRecorder,f.media);
    assert.equal(f.sandbox.window.__OPS_TIMER_AVAILABILITY__,undefined);
  }
});
test('duplicate/missing probes and overflow cannot be reported as complete evidence',()=>{
  const f=fixture();assert.throws(()=>f.start('true'),/Invalid/u);assert.throws(f.stop,/Missing/u);
  f.start(true);assert.throws(()=>f.start(true),/duplicate/u);
  for(let i=0;i<4097;i++)f.tick(i+2);
  const result=f.stop();assert.equal(result.rows.length,4096);assert.equal(result.overflow,true);
});
