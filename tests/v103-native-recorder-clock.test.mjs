import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {recordNativeEncodedAudio,persistThenDecodeNativeAudio} from "../scripts/v103-encoded-audio-evidence.mjs";

function fakeRecorder(t,{startDelay=750,neverStart=false,neverStop=false,errorAt=null,stopDelay=0}={}) {
  t.mock.timers.enable({apis:["setTimeout"]});
  let now=0;const instances=[],events=[];
  class Recorder {
    static isTypeSupported(type){return type==="audio/mp4";}
    constructor(stream,options){this.stream=stream;this.mimeType=options.mimeType;this.state="inactive";instances.push(this);}
    start(){
      this.state="recording";events.push({action:"api-start",at:now});
      if(!neverStart)setTimeout(()=>{events.push({action:"native-start",at:now});this.onstart?.();},startDelay);
      if(errorAt!==null)setTimeout(()=>{this.onerror?.({error:new Error("modeled native recorder fault")});},errorAt);
    }
    stop(){
      this.state="inactive";events.push({action:"api-stop",at:now});
      if(!neverStop)setTimeout(()=>{this.ondataavailable?.({data:new Blob([Uint8Array.of(71,72,73)]),timeStamp:now});this.onstop?.();},stopDelay);
    }
  }
  const run=vm.runInNewContext("("+recordNativeEncodedAudio.toString()+")",{
    MediaRecorder:Recorder,Blob,Uint8Array,performance:{now:()=>now},setTimeout:(fn,ms)=>setTimeout(fn,ms),clearTimeout:timer=>clearTimeout(timer),
    AudioContext:class{constructor(){throw Error("No realtime audio device is allowed");}},
  });
  const advance=async ms=>{now+=ms;t.mock.timers.tick(ms);for(let i=0;i<12;i++)await Promise.resolve();t.mock.timers.tick(0);for(let i=0;i<12;i++)await Promise.resolve();};
  return {run,advance,events,instances};
}
test("Native recording lasts 2500ms after the actual start event and preserves exact bytes",async t=>{
  const clock=fakeRecorder(t),pending=clock.run({id:"modeled-owned-stream"});
  await clock.advance(0);await clock.advance(750);
  assert.equal(clock.events.filter(e=>e.action==="api-stop").length,0);
  await clock.advance(2499);assert.equal(clock.events.filter(e=>e.action==="api-stop").length,0);
  await clock.advance(1);const sample=await pending;
  assert.equal(sample.recorderTiming.apiStartMs,0);assert.equal(sample.recorderTiming.startEventMs,750);
  assert.equal(sample.recorderTiming.stopCallMs,3250);assert.equal(sample.recorderTiming.stopEventMs,3250);
  assert.equal(sample.recorderTiming.stopCallMs-sample.recorderTiming.startEventMs,2500);
  assert.deepEqual(Array.from(sample.bytes),[71,72,73]);assert.equal(sample.nativeRecordStatus,"passed");
  assert.equal(clock.instances.length,1);assert.equal(clock.instances[0].ondataavailable,null);
});
test("A missing native start event fails at its bounded deadline and drains its original bytes once",async t=>{
  const clock=fakeRecorder(t,{neverStart:true}),pending=clock.run({id:"modeled-owned-stream"});
  await clock.advance(2000);const sample=await pending;
  assert.equal(sample.nativeRecordStatus,"failed");assert.match(sample.recordingFailure,/start event timed out/u);
  assert.equal(sample.recorderTiming.startEventMs,null);assert.equal(sample.recorderTiming.stopCallMs,2000);
  assert.deepEqual(Array.from(sample.bytes),[71,72,73]);assert.equal(clock.events.filter(e=>e.action==="api-start").length,1);
});
test("A missing native stop event fails without extending the recording or silently retrying",async t=>{
  const clock=fakeRecorder(t,{startDelay:0,neverStop:true}),pending=clock.run({id:"modeled-owned-stream"});
  await clock.advance(0);await clock.advance(2500);await clock.advance(2000);const sample=await pending;
  assert.equal(sample.nativeRecordStatus,"failed");assert.match(sample.recordingFailure,/stop event timed out/u);
  assert.equal(sample.recorderTiming.stopCallMs,2500);assert.equal(sample.recorderTiming.stopEventMs,null);
  assert.equal(clock.instances.length,1);assert.equal(clock.events.filter(e=>e.action==="api-stop").length,1);
});
test("A native encoder error before start is retained without an unhandled second rejection",async t=>{
  const clock=fakeRecorder(t,{startDelay:750,errorAt:100}),pending=clock.run({id:"modeled-owned-stream"});
  await clock.advance(100);const sample=await pending;
  assert.equal(sample.nativeRecordStatus,"failed");assert.match(sample.recordingFailure,/modeled native recorder fault/u);
  assert.deepEqual(Array.from(sample.bytes),[71,72,73]);
  await clock.advance(650);assert.equal(sample.recorderTiming.startEventMs,null,"Late start cannot change the captured receipt");
});
test("A native recording failure is saved before rejection and never mislabeled as a decode attempt",async t=>{
  const parent=fs.realpathSync(os.tmpdir()),out=fs.mkdtempSync(path.join(parent,"v103-native-clock-"));
  t.after(()=>{const actual=fs.realpathSync(out);assert.equal(path.dirname(actual),parent);assert.ok(path.basename(actual).startsWith("v103-native-clock-"));fs.rmSync(actual,{recursive:true});});
  let calls=0;const recordings=[];
  await assert.rejects(()=>persistThenDecodeNativeAudio({sample:{bytes:[71,72,73],mimeType:"audio/mp4",nativeRecordStatus:"failed",recordingFailure:"Error: modeled native recorder fault"},out,file:"partial.m4a",label:"partial",recordings,decode:async()=>{calls++;}}),/modeled native recorder fault/u);
  assert.equal(calls,0);assert.equal(recordings.length,1);
  assert.deepEqual([...fs.readFileSync(path.join(out,"partial.m4a"))],[71,72,73]);
  const sidecar=JSON.parse(fs.readFileSync(path.join(out,"partial.m4a.json"),"utf8"));
  assert.equal(sidecar.nativeRecordStatus,"failed");assert.equal(sidecar.nativeDecodeStatus,"not-attempted");
  assert.equal(sidecar.nativeDecodeFailure,undefined);
});
test("The real battle and file-source capture callbacks use the same native event clock",()=>{
  const source=fs.readFileSync(new URL("../scripts/v103-audio-output-browser.mjs",import.meta.url),"utf8");
  assert.equal((source.match(/await globalThis\.__V103_RECORD_NATIVE_AUDIO__\(stream\)/gu)??[]).length,2);
  assert.equal((source.match(/await installNativeRecordingClock\(page\)/gu)??[]).length,3);
  assert.match(source,/recordNativeEncodedAudio\.toString\(\)/u);
  assert.doesNotMatch(source,/recorder\.start\(\); await new Promise/u);
  assert.match(source,/if \(failures\.length\).*throw failures\[0\]/u);
  assert.match(source,/signal\.duration >= 1\.8 && signal\.duration <= 3\.5/u);
  assert.match(source,/signal\.rms > \.0001 && signal\.peak > \.001/u);
});

test("An encoder error waits for actual final data and stop, rather than its already-rejected stop promise",async t=>{
  const clock=fakeRecorder(t,{startDelay:750,errorAt:100,stopDelay:50}),pending=clock.run({id:"modeled-owned-stream"});let completed=false;
  void pending.then(()=>{completed=true;});await clock.advance(100);assert.equal(completed,false);
  await clock.advance(49);assert.equal(completed,false);await clock.advance(1);const sample=await pending;
  assert.equal(sample.nativeRecordStatus,"failed");assert.equal(sample.recorderTiming.stopEventMs,150);
  assert.deepEqual(Array.from(sample.bytes),[71,72,73]);assert.match(sample.recordingFailure,/modeled native recorder fault/u);
});

test("An encoder error after stop() retains final native bytes inside the original stop deadline",async t=>{
  const clock=fakeRecorder(t,{startDelay:0,errorAt:2510,stopDelay:50}),pending=clock.run({id:"modeled-owned-stream"});let completed=false;
  void pending.then(()=>{completed=true;});await clock.advance(0);await clock.advance(2500);
  await clock.advance(10);assert.equal(completed,false,"The encoder error is not the native final-data event");
  await clock.advance(39);assert.equal(completed,false);await clock.advance(1);const sample=await pending;
  assert.equal(sample.nativeRecordStatus,"failed");assert.equal(sample.recorderTiming.stopCallMs,2500);
  assert.equal(sample.recorderTiming.stopEventMs,2550);assert.deepEqual(Array.from(sample.bytes),[71,72,73]);
  assert.match(sample.recordingFailure,/modeled native recorder fault/u);
  assert.equal(clock.events.filter(e=>e.action==="api-stop").length,1);
});
test("An encoder error during stop drains only the remaining original deadline, without extending it",async t=>{
  const clock=fakeRecorder(t,{startDelay:0,errorAt:2510,stopDelay:2100}),pending=clock.run({id:"modeled-owned-stream"});let completed=false;
  void pending.then(()=>{completed=true;});await clock.advance(0);await clock.advance(2500);await clock.advance(10);
  assert.equal(completed,false);await clock.advance(1989);assert.equal(completed,false);
  await clock.advance(1);const sample=await pending;assert.equal(completed,true);
  assert.equal(sample.nativeRecordStatus,"failed");assert.equal(sample.recorderTiming.stopCallMs,2500);
  assert.equal(sample.recorderTiming.stopEventMs,null);assert.deepEqual(Array.from(sample.bytes),[]);
  await clock.advance(100);assert.equal(sample.recorderTiming.stopEventMs,null,"Data beyond the original bound cannot mutate the receipt");
  assert.equal(clock.events.filter(e=>e.action==="api-stop").length,1);
});
