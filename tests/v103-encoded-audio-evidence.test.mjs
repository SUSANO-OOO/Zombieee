import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {decodeNativeEncodedAudio, persistThenDecodeNativeAudio} from '../scripts/v103-encoded-audio-evidence.mjs';

const source=fs.readFileSync(new URL('../scripts/v103-audio-output-browser.mjs',import.meta.url),'utf8');
const tree=ts.createSourceFile('audio-output.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const captures=new Map();
function visit(node) {
  if (ts.isFunctionDeclaration(node) && ['capture','captureNativeMedia'].includes(node.name?.text)) captures.set(node.name.text,node);
  ts.forEachChild(node,visit);
}
visit(tree);assert.equal(captures.size,2);
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/v103-native-audio/v177-a92-decoding-failure.json',import.meta.url),'utf8'));
const failure=()=>new Error(fixture.failure.replace(/^Error: /u,''));
// The archive lost its encoded bytes. This modeled packet checks retention and
// actual caller ordering only; it cannot prove native audio or phone acceptance.
const packet=()=>Array.from({length:1200},(_,i)=>(i*37^163)&255);
function ownedTemp(t) {
  const parent=fs.realpathSync(os.tmpdir()),folder=fs.mkdtempSync(path.join(parent,'v103-encoded-evidence-'));
  t.after(()=>{
    const resolved=fs.realpathSync(folder);
    assert.equal(path.dirname(resolved),parent);assert.ok(path.basename(resolved).startsWith('v103-encoded-evidence-'));
    fs.rmSync(resolved,{recursive:true});
  });
  return folder;
}
function nativeFailure() {assert.equal(fixture.encodedBytesPresent,false);return failure();}
const decodeSignal={rms:.05,peak:.3,duration:2.5,sampleRate:44100,channels:2};

test('a native decode failure preserves the exact modeled packet and sidecar before invoking the decoder',async t=>{
  const out=ownedTemp(t),bytes=packet(),recordings=[],error=nativeFailure();let calls=0;
  await assert.rejects(()=>persistThenDecodeNativeAudio({sample:{bytes,mimeType:'audio/mp4',unitPayloadIsModeled:true},out,file:'failed.m4a',label:'failed',recordings,decode:async data=>{
    calls++;assert.deepEqual(data,bytes);assert.ok(fs.readFileSync(path.join(out,'failed.m4a')).equals(Buffer.from(bytes)));
    const pending=JSON.parse(fs.readFileSync(path.join(out,'failed.m4a.json'),'utf8'));assert.equal(pending.nativeDecodeStatus,'pending');
    throw error;
  }}),e=>e===error);
  assert.equal(calls,1);assert.equal(recordings.length,1);
  const sidecar=JSON.parse(fs.readFileSync(path.join(out,'failed.m4a.json'),'utf8'));
  assert.equal(sidecar.nativeDecodeStatus,'failed');assert.equal(sidecar.nativeDecodeFailure,String(error));
  assert.equal(sidecar.encodedSha256,createHash('sha256').update(Buffer.from(bytes)).digest('hex'));
  assert.equal(sidecar.bytes,bytes.length);assert.equal(sidecar.mimeType,'audio/mp4');
});

test('successful native decoding retains identical encoded data and its metrics without replacing an existing recording',async t=>{
  const out=ownedTemp(t),bytes=packet(),recordings=[];let calls=0;
  const options={sample:{bytes,mimeType:'audio/mp4'},out,file:'once.m4a',label:'once',recordings,decode:async()=>{calls++;return decodeSignal;}};
  const entry=await persistThenDecodeNativeAudio(options);
  assert.equal(entry.nativeDecodeStatus,'passed');assert.equal(entry.rms,decodeSignal.rms);assert.equal(entry.duration,2.5);
  assert.ok(fs.readFileSync(path.join(out,'once.m4a')).equals(Buffer.from(bytes)));
  await assert.rejects(()=>persistThenDecodeNativeAudio({...options,sample:{bytes:[1,2,3],mimeType:'audio/mp4'}}),{code:'EEXIST'});
  assert.equal(calls,1);assert.equal(recordings.length,1);assert.ok(fs.readFileSync(path.join(out,'once.m4a')).equals(Buffer.from(bytes)));
});

test('the serialized native decoder uses one offline context and preserves the original PCM signal calculation',async()=>{
  const calls=[],bytes=packet(),left=Float32Array.from([1,0,-1,0]),right=Float32Array.from([.5,-.5,.25,-.25]);
  class OfflineContext {
    constructor(...args){calls.push({args});}
    async decodeAudioData(encoded){assert.deepEqual(Array.from(new Uint8Array(encoded)),bytes);return{
      numberOfChannels:2,duration:2.5,sampleRate:44100,getChannelData:channel=>channel===0?left:right,
    };}
  }
  const decode=vm.runInNewContext('('+decodeNativeEncodedAudio.toString()+')',{
    OfflineAudioContext:OfflineContext,AudioContext:class {constructor(){throw Error('No hardware audio context is allowed');}},
  });
  const signal=await decode(bytes);assert.equal(calls.length,1);assert.deepEqual(calls[0].args,[2,1,44100]);
  assert.ok(Math.abs(signal.rms-Math.sqrt(2.625/8))<1e-12);assert.equal(signal.peak,1);assert.equal(signal.sampleRate,44100);assert.equal(signal.channels,2);
});

async function actualCaller(t,name,{error=nativeFailure(),signal=decodeSignal,sampleOverrides={}}={}) {
  const out=ownedTemp(t),row={recordings:[]},mediaCase={recordings:[]},events=[];
  const sample={bytes:packet(),mimeType:'audio/mp4',requestedMimeType:'audio/mp4',outputs:2,paused:false,sceneOutputs:1,streamId:'modeled-unit-stream',unitPayloadIsModeled:true,...sampleOverrides};
  const page={
    waitForFunction:async()=>{},
    evaluate:async fn=>{
      if(fn.toString().includes('decodeAudioData')){events.push('native-decode');if(error)throw error;return signal;}
      events.push('native-record');return sample;
    },
  };
  const capture=vm.runInNewContext('('+captures.get(name).getText(tree)+')',{
    page,row,mediaCase,out,width:1280,height:720,assert,Buffer,writeFile:fs.promises.writeFile,persistThenDecodeNativeAudio,decodeNativeEncodedAudio,
  });
  let caught;try{await capture('retention','.v100-staff-roll');}catch(e){caught=e;}
  return{out,row,mediaCase,events,caught,recordings:name==='capture'?row.recordings:mediaCase.recordings,file:name==='capture'?'1280x720-retention.m4a':'native-retention.m4a',sample};
}

for(const name of ['capture','captureNativeMedia']) {
  test('actual '+name+' retains the failed native recording before propagating the archived decoding error',async t=>{
    const error=nativeFailure(),result=await actualCaller(t,name,{error});
    assert.equal(result.caught,error);assert.equal(result.recordings.length,1);
    assert.deepEqual(result.events,['native-record','native-decode']);
    assert.ok(fs.readFileSync(path.join(result.out,result.file)).equals(Buffer.from(result.sample.bytes)));
    const sidecar=JSON.parse(fs.readFileSync(path.join(result.out,result.file+'.json'),'utf8'));
    assert.equal(sidecar.nativeDecodeStatus,'failed');assert.equal(sidecar.nativeDecodeFailure,String(error));
  });
}

test('both actual callers still reject empty duration and silent decoded mixes after retaining their raw evidence',async t=>{
  for(const name of ['capture','captureNativeMedia'])for(const signal of [{...decodeSignal,duration:0},{...decodeSignal,rms:0,peak:0}]) {
    const result=await actualCaller(t,name,{error:null,signal});
    assert.ok(result.caught instanceof Error || result.caught?.name==='AssertionError');
    assert.match(String(result.caught),/invalid encoded duration|invalid native encoding|recorded mix is silent|native file mix is silent/u);
    assert.equal(result.recordings.length,1);assert.equal(result.recordings[0].nativeDecodeStatus,'passed');
    assert.ok(fs.existsSync(path.join(result.out,result.file)));
  }
});

test('the actual battle capture still rejects wrong output ownership and a paused sink after native decoding',async t=>{
  for(const sampleOverrides of [{outputs:1},{paused:true}]) {
    const result=await actualCaller(t,'capture',{error:null,sampleOverrides});
    assert.equal(result.caught?.name,'AssertionError');assert.equal(result.recordings.length,1);
    assert.ok(fs.existsSync(path.join(result.out,result.file)));
  }
});
