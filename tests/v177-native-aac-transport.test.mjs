import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import { normalizeAacDescription, AacFragmentMuxer, splitAdtsAac } from "../scripts/v177-aac-fragment-muxer.mjs";
import { runNativeAacProbe, assertNativeAacHostedPlatform, analyseNativeAacContent } from "../scripts/v177-native-aac-probe.mjs";
const parameters = { codec: "mp4a.40.2", sampleRate: 48000, numberOfChannels: 2 }, description = Uint8Array.of(17,144);
const esds = Uint8Array.from([3,128,128,128,34,0,0,0,4,128,128,128,20,64,20,0,24,0,0,0,0,0,0,0,0,0,5,128,128,128,2,17,136,6,128,128,128,1,2]);
const packet = (i, bytes = [i+1,6,9]) => ({ timestampSamples: i*1024, durationSamples: 1024, data: Uint8Array.from(bytes) });
function boxes(input) {
  const bytes=Buffer.from(input),result=[]; let offset=0;
  while(offset<bytes.length) { const size=bytes.readUInt32BE(offset); assert.ok(size>=8&&offset+size<=bytes.length);
    result.push({type:bytes.toString("ascii",offset+4,offset+8),size,bytes:bytes.subarray(offset+8,offset+size)}); offset+=size; }
  assert.equal(offset,bytes.length); return result;
}
test("AAC LC preserves ASC and rejects declared channel or rate disagreement", () => {
  assert.deepEqual([...normalizeAacDescription(description,parameters).asc],[17,144]);
  assert.throws(()=>normalizeAacDescription(description,{...parameters,sampleRate:44100}),/disagree/u);
  assert.throws(()=>normalizeAacDescription(description,{...parameters,numberOfChannels:1}),/disagree/u);
});
test("Native WebKit ESDS example is structurally parsed, including a complete esds wrapper", () => {
  const mono={...parameters,numberOfChannels:1};
  assert.deepEqual([...normalizeAacDescription(esds,mono).asc],[17,136]);
  const wrapped=Buffer.alloc(esds.length+12); wrapped.writeUInt32BE(wrapped.length); wrapped.write("esds",4); wrapped.set(esds,12);
  assert.deepEqual([...normalizeAacDescription(wrapped,mono).asc],[17,136]);
  assert.throws(()=>normalizeAacDescription(esds.subarray(0,-1),mono),/Truncated|Expected/u);
  const forged=esds.slice(); forged[13]=127; assert.throws(()=>normalizeAacDescription(forged,mono),/configuration/u);
});
test("Extended ASC, HE-AAC, descriptor flags and malformed wrapper are rejected", () => {
  assert.throws(()=>normalizeAacDescription(Uint8Array.of(17,144,0,0,0),parameters),/Expected|Truncated/u);
  assert.throws(()=>normalizeAacDescription(Uint8Array.of(41,144),parameters),/Unsupported/u);
  const flags=esds.slice(); flags[7]=128;
  assert.throws(()=>normalizeAacDescription(flags,{...parameters,numberOfChannels:1}),/flags/u);
  const wrapped=Buffer.alloc(esds.length+12); wrapped.writeUInt32BE(wrapped.length-1); wrapped.write("esds",4); wrapped.set(esds,12);
  assert.throws(()=>normalizeAacDescription(wrapped,{...parameters,numberOfChannels:1}),/box size/u);
});
test("Fragmented MP4 preserves payload, sample clock, sequence and data offsets", () => {
  const mux=new AacFragmentMuxer(description,parameters);
  assert.deepEqual(boxes(mux.initializationSegment).map(b=>b.type),["ftyp","moov"]);
  mux.segment([packet(0),packet(1)]);
  const top=boxes(mux.segment([packet(2,[91,92]),packet(3,[93,94,95])]));
  assert.deepEqual(top.map(b=>b.type),["moof","mdat"]); assert.deepEqual([...top[1].bytes],[91,92,93,94,95]);
  const traf=boxes(boxes(top[0].bytes).find(b=>b.type==="traf").bytes);
  assert.equal(traf.find(b=>b.type==="tfdt").bytes.readBigUInt64BE(4),2048n);
  assert.equal(traf.find(b=>b.type==="trun").bytes.readUInt32BE(8),top[0].size+8);
  assert.deepEqual(mux.snapshot(),{nextSample:4096,nextSequence:3,sampleRate:48000,channels:2});
});
test("Dropped, duplicate, reordered, empty and variable-duration packets cannot advance the clock", () => {
  const mux=new AacFragmentMuxer(description,parameters); mux.segment([packet(0)]); const before=mux.snapshot();
  for(const bad of [[packet(2)],[packet(0)],[packet(1),packet(3)],[{...packet(1),durationSamples:960}],[packet(1,[])]]) {
    assert.throws(()=>mux.segment(bad)); assert.deepEqual(mux.snapshot(),before); }
  mux.segment([packet(1)]); assert.equal(mux.snapshot().nextSample,2048);
});
test("AAC initialization defensively copies input and output bytes", () => {
  const config=description.slice(),mux=new AacFragmentMuxer(config,parameters);
  const first=mux.initializationSegment,original=Buffer.from(first); first.fill(0); config.fill(0);
  assert.deepEqual(Buffer.from(mux.initializationSegment),original); assert.deepEqual([...mux.configuration.asc],[17,144]);
});
test("ADTS splitter retains payload and rejects truncation and multiple raw-data blocks", () => {
  const bytes=Uint8Array.from([255,241,76,128,1,95,252,11,22,33]),parsed=splitAdtsAac(bytes);
  assert.equal(parsed.configuration.sampleRate,48000); assert.equal(parsed.configuration.numberOfChannels,2);
  assert.deepEqual([...parsed.packets[0].data],[11,22,33]);
  assert.throws(()=>splitAdtsAac(bytes.subarray(0,-1)),/Truncated/u);
  const multi=bytes.slice(); multi[6]|=1; assert.throws(()=>splitAdtsAac(multi),/Unsupported/u);
});
test("Unsupported native encoder is recorded without constructing a media element or context", async () => {
  let constructors=0;
  class Encoder { static async isConfigSupported(){return{supported:false};} constructor(){constructors++;} }
  const run=vm.runInNewContext("("+runNativeAacProbe.toString()+")",{AudioEncoder:Encoder,AudioData:function(){},Float32Array,Uint8Array,setTimeout});
  const result=await run({sourceUrls:[],muxerSource:"",route:"ManagedMediaSource",mix:"bgm"});
  assert.equal(result.status,"unsupported-encoder"); assert.equal(constructors,0);
  assert.equal(result.packets.length,0); assert.equal(result.realtimeAudioContexts,0);
  assert.equal(result.physicalRecordingAccepted,false); assert.equal(result.gameBackendChanged,false);
});
test("Missing WebCodecs retains a failed diagnostic instead of claiming the recording is fixed", async () => {
  const run=vm.runInNewContext("("+runNativeAacProbe.toString()+")",{AudioEncoder:undefined,Float32Array,Uint8Array,setTimeout});
  const result=await run({sourceUrls:[],muxerSource:"",route:"ManagedMediaSource",mix:"bgm"});
  assert.equal(result.status,"failed"); assert.match(result.errors[0],/WebCodecs audio is unavailable/u);
  assert.equal(result.physicalRecordingAccepted,false);
});
test("Windows browser and audio launch are rejected before hosted work", () => {
  assert.throws(()=>assertNativeAacHostedPlatform("win32"),/hosted-only/u);
  assert.doesNotThrow(()=>assertNativeAacHostedPlatform("linux")); assert.doesNotThrow(()=>assertNativeAacHostedPlatform("darwin"));
  const host=fs.readFileSync(new URL("../scripts/v177-native-aac-browser.mjs",import.meta.url),"utf8");
  assert.ok(host.indexOf("assertNativeAacHostedPlatform(process.platform)")<host.indexOf(".launch()"));
});
test("AAC diagnostic preserves the required media step and can run after native decode fails", () => {
  const workflow=fs.readFileSync(new URL("../.github/workflows/ci.yml",import.meta.url),"utf8").replaceAll("\r\n","\n");
  const job=workflow.split("  v103-audio-output:\n")[1].split("\n  v102-enemy-contacts:")[0];
  assert.match(job,/run: node scripts\/run-browser-qa-with-server\.mjs scripts\/v103-audio-output-browser\.mjs/u);
  assert.doesNotMatch(job,/continue-on-error/u);
  assert.match(job,/always\(\).*steps\.native_engine\.outcome == 'success'.*steps\.production_build\.outcome == 'success'/u);
  assert.match(job,/timeout-minutes: 30/u);
});

test("Actual native content analyser detects both PCM sources and rejects missing rifle content", async () => {
  // Synthetic PCM exercises only the analyser; it is never played or used as a game asset.
  const frames=24000,bgm=new Float32Array(frames*2),ref=new Float32Array(frames*2),mixed=new Float32Array(frames),music=new Float32Array(frames);
  let noise=123456789;
  for(let i=0;i<frames;i++) { const value=Math.sin(i*.037)*.08; noise^=noise<<13;noise^=noise>>>17;noise^=noise<<5;
    const effect=i>=12000&&i<16000?(noise>>>0)/4294967296*.4-.2:0;
    music[i]=value;mixed[i]=value+effect;bgm[i*2]=bgm[i*2+1]=value;ref[i*2]=ref[i*2+1]=value+effect; }
  const analyse=async values=> { class Decoder { async decodeAudioData(){return{duration:frames/48000,sampleRate:48000,numberOfChannels:1,length:frames,getChannelData:()=>values};} }
    const run=vm.runInNewContext("("+analyseNativeAacContent.toString()+")",{OfflineAudioContext:Decoder,Float32Array,Uint8Array});
    return run({encoded:[],reference:Array.from(new Uint8Array(ref.buffer)),background:Array.from(new Uint8Array(bgm.buffer)),effect:{firstInputFrame:12000}}); };
  const retained=await analyse(mixed),missing=await analyse(music);
  assert.ok(retained.correlation>.99);assert.ok(retained.effectCorrelation>.99);assert.equal(retained.lagSamples,0);
  assert.ok(missing.effectCorrelation<.6,"Music alone must not pass the rifle content gate");
});
