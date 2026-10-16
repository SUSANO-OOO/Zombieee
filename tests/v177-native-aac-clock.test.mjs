import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createHash} from "node:crypto";
import {nativeAacClockEvidence,nativeAacProbeCases,runNativeAacProbe} from "../scripts/v177-native-aac-probe.mjs";
const fixture=JSON.parse(fs.readFileSync(new URL("./fixtures/v103-native-audio/v177-11843-clock-observations.json",import.meta.url),"utf8"));
test("Actual native clocks expose two Managed freezes and the previously missed standard BGM delay",()=>{
  assert.equal(fixture.cases.length,4);
  for(const c of fixture.cases){const result=nativeAacClockEvidence(c);assert.equal(result.accepted,c.expectedContinuousBudgetPass,c.route+" "+c.mix);assert.equal(result.budgetMs,150);assert.equal(result.observedSamples,c.playheads.length);
    if(c.route==="ManagedMediaSource")assert.ok(result.maximumDelayMs>2000);
    else if(c.mix==="bgm")assert.ok(result.maximumDelayMs>200 && result.maximumDelayMs<220);
    else assert.ok(result.maximumDelayMs<150);
  }
});
test("A final advancing clock and empty waiting-event list cannot turn a frozen stream into a pass",()=>{
  const base=fixture.cases.find(c=>c.route==="ManagedMediaSource"&&c.mix==="bgm-se");
  const result=nativeAacClockEvidence({...base,events:[],playheads:[...base.playheads,{ms:7000,time:4,finalDrain:true}]});
  assert.equal(result.accepted,false);assert.ok(result.outsideBudget>0);
});
test("Invalid clocks, backwards motion and excessive queued input fail closed",()=>{
  const good={sampleRate:48000,playheads:[{ms:20,time:0,encodedFrames:1024},{ms:40,time:.02,encodedFrames:2048}]};
  assert.equal(nativeAacClockEvidence(good).accepted,true);
  for(const bad of [{...good,sampleRate:0},{...good,sampleRate:undefined},
    {...good,playheads:[{ms:NaN,time:0,encodedFrames:1024}]},
    {...good,playheads:[{ms:0,time:0,encodedFrames:48000}]},
    {...good,playheads:[{ms:0,time:0,encodedFrames:1.5}]},
    {...good,playheads:[{ms:40,time:.04,encodedFrames:1024},{ms:50,time:.01,encodedFrames:2048}]}])
    assert.equal(nativeAacClockEvidence(bad).accepted,false);
});
test("Both original routes and mixes remain, with separately labeled live and bounded-prime comparisons",()=>{
  const cases=nativeAacProbeCases();assert.equal(cases.length,8);
  const original=cases.filter(c=>c.variant==="original");
  assert.deepEqual(original.map(c=>[c.route,c.mix,c.live,c.primeFrames]),[
    ["ManagedMediaSource","bgm",false,0],["ManagedMediaSource","bgm-se",false,0],
    ["MediaSource","bgm",false,0],["MediaSource","bgm-se",false,0]]);
  const primed=cases.filter(c=>c.variant==="live-primed");assert.equal(primed.length,2);
  assert.ok(primed.every(c=>c.route==="ManagedMediaSource"&&c.live&&c.primeFrames===3072));
});
test("The private comparisons keep the actual original PCM mix and AudioData body exactly",()=>{
  const source=fs.readFileSync(new URL("../scripts/v177-native-aac-probe.mjs",import.meta.url),"utf8").replaceAll("\r\n","\n");
  const start=source.indexOf("      const pcm ="),end=source.indexOf("      if (observe)",start);assert.ok(start>=0&&end>start);
  const code=source.slice(start,end).trim();
  assert.equal(createHash("sha256").update(code).digest("hex"),fixture.expectedPcmInputCodeSha256);
  const prime=source.slice(source.indexOf("    if (primeFrames) {"),source.indexOf('    document.documentElement.dataset.probeReady = "1";'));
  assert.doesNotMatch(prime,/encoder\.flush|\.play\(|currentTime\s*=|timestampOffset/u);
  assert.match(prime,/mediaPaused:audio\.paused/u);
});
test("Invalid priming is rejected before any codec, media source or audio device is constructed",async()=>{
  let constructed=0;
  class Encoder{static async isConfigSupported(){constructed++;throw Error("Must not reach encoder");}}
  const run=vm.runInNewContext("("+runNativeAacProbe.toString()+")",{AudioEncoder:Encoder,AudioData:function(){},Float32Array,Uint8Array,setTimeout});
  for(const primeFrames of [-1,1025,4096]){const result=await run({sourceUrls:[],muxerSource:"",route:"ManagedMediaSource",mix:"bgm",primeFrames});
    assert.equal(result.status,"failed");assert.match(result.errors[0],/Invalid bounded priming/u);}
  assert.equal(constructed,0);
});
