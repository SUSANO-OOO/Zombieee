import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {startNativeCanvasClip,finishNativeCanvasClip,nativeCaptureRafWindow} from '../scripts/v177-native-canvas-clips.mjs';

function fixture({counter=true,requestSupported=true}={}){
  let clock=100,sequence=0,requests=0;const callbacks=new Map(),rates=[];
  const track={stop(){},getSettings:()=>({frameRate:0}),...(requestSupported?{requestFrame(){requests++;}}:{})};
  class Recorder{
    static isTypeSupported(){return true;}
    constructor(stream,options){this.state='inactive';this.mimeType=options.mimeType;this.listeners=new Map();}
    addEventListener(name,fn){this.listeners.set(name,fn);}removeEventListener(name){this.listeners.delete(name);}
    start(){this.state='recording';this.listeners.get('start')();}
    stop(){this.state='inactive';this.listeners.get('dataavailable')?.({data:new Blob(['original-bytes']),timecode:0});this.listeners.get('stop')?.();}
  }
  const canvas={width:844,height:390,isConnected:true,captureStream(rate){rates.push(rate);return {getVideoTracks:()=>[track],getAudioTracks:()=>[],getTracks:()=>[track]};}};
  const context=vm.createContext({MediaRecorder:Recorder,performance:{timeOrigin:1000,now:()=>++clock},
    setTimeout:()=>1,clearTimeout(){},requestAnimationFrame(fn){callbacks.set(++sequence,fn);return sequence;},cancelAnimationFrame(id){callbacks.delete(id);},
    Blob,Uint8Array,btoa:s=>Buffer.from(s,'binary').toString('base64'),__ASHFALL_RUNTIME_PERFORMANCE__:counter?{renderFrames:0}:null});
  const start=vm.runInContext('('+startNativeCanvasClip.toString()+')',context),finish=vm.runInContext('('+finishNativeCanvasClip.toString()+')',context);
  return {context,rates,requests:()=>requests,callbacks,state:()=>start(canvas,{metadata:{},engine:'webkit',requestedMimeType:'video/webm;codecs=vp8',requestedCaptureHz:0,postpaintRequests:true}),
    step(value){context.__ASHFALL_RUNTIME_PERFORMANCE__.renderFrames=value;const pending=[...callbacks.values()];callbacks.clear();pending.forEach(fn=>fn(clock));},finish};
}
test('requests follow real new draws, keep skipped counters and never catch up or request unchanged frames',async()=>{
  const f=fixture(),s=f.state();f.step(0);assert.equal(f.requests(),0);f.step(1);f.step(1);f.step(5);
  assert.equal(f.requests(),2);assert.equal(s.paintRequests.counterSkips.length,1);
  assert.deepEqual(Array.from(s.paintRequests.rows,r=>r.renderFrames),[1,5]);assert.deepEqual(f.rates,[0]);
  s.stop();f.step(6);assert.equal(f.requests(),2);assert.equal(f.callbacks.size,0);
  const receipt=await f.finish(s,{completed:true});assert.equal(receipt.postpaintRequests,true);
  assert.equal(Buffer.from(receipt.videoBase64,'base64').toString(),'original-bytes');
  assert.equal(receipt.originalSpeedAccepted,false);assert.equal(receipt.encodedPtsVerified,false);
});
test('counter reversal or replacement stops acquisition and retains the failure',async()=>{
  for(const replace of [false,true]){
    const f=fixture(),s=f.state();f.step(2);if(replace)f.context.__ASHFALL_RUNTIME_PERFORMANCE__={renderFrames:2};
    f.step(replace?3:1);assert.equal(f.requests(),1);assert.ok(s.errors.length);assert.equal(f.callbacks.size,0);
    assert.equal((await f.finish(s,{completed:true})).status,'invalid');
  }
});
test('unsupported requestFrame or missing actual paint counter fails without a periodic fallback',()=>{
  for(const options of [{requestSupported:false},{counter:false}]){
    const f=fixture(options),s=f.state();assert.equal(s.status,'invalid');assert.ok(s.errors.length);assert.deepEqual(f.rates,[0]);assert.equal(f.callbacks.size,0);
  }
});
test('rate zero remains forbidden without explicit diagnostic opt-in',()=>{
  assert.throws(()=>startNativeCanvasClip(null,{metadata:{},requestedCaptureHz:0}),/Unknown native acquisition request rate/u);
  assert.throws(()=>startNativeCanvasClip(null,{metadata:{},requestedCaptureHz:60,postpaintRequests:true}),/explicit rate zero/u);
});
test('source gap analysis separates the capture window from unrelated export and boundary waits',()=>{
  const rows=[0,100,120,300,310,1200].map(at=>({at})),copy=structuredClone(rows);
  const result=nativeCaptureRafWindow(rows,{startedAt:100,stopRequestedAt:310});
  assert.equal(result.maxAllObservationGapMs,890);assert.equal(result.maxRawOverlappingPairMs,180);
  assert.equal(result.maxFullyInsideGapMs,180);assert.deepEqual(result.boundaryPairs,[]);assert.deepEqual(rows,copy);
  const boundary=nativeCaptureRafWindow([{at:0},{at:1000}],{startedAt:100,stopRequestedAt:310});
  assert.equal(boundary.maxFullyInsideGapMs,null);assert.equal(boundary.boundaryPairs.length,1);
  assert.throws(()=>nativeCaptureRafWindow([{at:5},{at:4}],{startedAt:1,stopRequestedAt:10}));
});
