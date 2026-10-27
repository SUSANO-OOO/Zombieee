import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {omitEncoderAndSelectCanvasSource} from '../scripts/ops-canvas-source-adapter.mjs';
test('both controls avoid the actual encoder, and only the declared source condition creates a native stream',async()=>{
  for(const mode of ['canvas-source','no-canvas-source','canvas-source-light','no-canvas-source-light']){
    let realSources=0,nativeEncoders=0;const real={getTracks:()=>[{kind:'video'}],getVideoTracks:()=>[{getSettings:()=>({frameRate:60})}]};
    const canvas={captureStream(...args){assert.deepEqual(Array.from(args),[60]);realSources++;return real;}};
    class Native {static isTypeSupported(){return true;}constructor(){nativeEncoders++;throw Error('Real encoder must remain absent');}}
    const context=vm.createContext({window:{MediaRecorder:Native,__ASHFALL_BATTLE_QA__:{getV105CorrectionAudit:()=>({time:123,actualGameSnapshot:true})}},document:{querySelector:()=>canvas},queueMicrotask});
    vm.runInContext('('+omitEncoderAndSelectCanvasSource.toString()+')',context)(mode);
    const stream=canvas.captureStream(60),recorder=new context.window.MediaRecorder(stream,{mimeType:'video/mp4'});
    let events=0;recorder.onstart=()=>events++;recorder.onstop=()=>events++;recorder.start();recorder.stop();await Promise.resolve();
    assert.equal(events,2);assert.equal(nativeEncoders,0);assert.equal(realSources,mode.startsWith('no-')?0:1);
    if(mode.startsWith('no-'))assert.equal(stream.getVideoTracks()[0].getSettings().diagnosticCanvasSourceOmitted,true);
    assert.equal(context.window.__OPS_ENCODER_CONTROL__.encoderCreated,false);
  }
});
test('light observation omits only per-frame data and never substitutes a simulation timestamp',()=>{
  const canvas={captureStream(){return {};}};class Native {static isTypeSupported(){return true;}}
  const context=vm.createContext({window:{MediaRecorder:Native,__ASHFALL_BATTLE_QA__:{getV105CorrectionAudit:()=>({time:123,actualGameSnapshot:true})}},document:{querySelector:()=>canvas},queueMicrotask});
  vm.runInContext('('+omitEncoderAndSelectCanvasSource.toString()+')',context)('no-canvas-source-light');
  const qa=context.window.__ASHFALL_BATTLE_QA__;
  assert.equal(qa.getV105CorrectionAudit([1]).actualGameSnapshot,true);
  context.window.__V105_RECORDING__={state:{stopAt:null}};
  const omitted=qa.getV105CorrectionAudit([1]);assert.equal(omitted.diagnosticFrameSnapshotOmitted,true);assert.equal(omitted.time,undefined);assert.equal(omitted.fighters,undefined);
  assert.equal(qa.getV105CorrectionAudit([]).time,123);
  context.window.__V105_RECORDING__.state.stopAt=500;
  assert.equal(qa.getV105CorrectionAudit([1]).time,123);
});
test('unknown modes cannot silently become a no-source observation',()=>{
  assert.throws(()=>omitEncoderAndSelectCanvasSource('other'),/Unknown source control/u);
});
