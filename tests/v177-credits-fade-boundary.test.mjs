import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {V100_CREDITS_DURATION,v100CreditsOutroOvershoot,v100CreditsOutroFrame,v100StaffRollFrame} from '../app/v100StaffRoll.js';
import {installEndingAudioGainObserver,assertEndingGainFadeOnset} from '../scripts/ending-audio-gain-observer.mjs';

const source=fs.readFileSync(new URL('../app/V100EndingRoll.tsx',import.meta.url),'utf8');
const parsed=ts.createSourceFile('EndingRoll.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let callback;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(parsed)==='beginOutro')callback=node.initializer.arguments[0];ts.forEachChild(node,visit);}
visit(parsed);assert.ok(callback);
const code=ts.transpileModule('('+callback.getText(parsed)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;

test('outro elapsed retains the boundary overshoot at every film speed without changing music rate',()=>{
  for(const speed of [1,2,4])assert.ok(Math.abs(v100CreditsOutroOvershoot(106.33291585,speed)-.33291585/speed)<1e-12);
  for(const elapsed of [0,105,106,NaN,Infinity])assert.equal(v100CreditsOutroOvershoot(elapsed),0);
  assert.equal(v100CreditsOutroOvershoot(107,0),1);
});

function beginFixture({paused=false}={}) {
  const writes=[],events=[],audio={currentTime:106.33291585,playbackRate:1,paused,ended:false,pause(){this.paused=true;events.push('pause');}};
  const stage={dataset:{},style:{setProperty(name,value){events.push([name,value]);}}};
  const refs={outroRef:{current:null},endedRef:{current:false},elapsedRef:{current:106.33291585},stageRef:{current:stage},audioRef:{current:audio},musicVolumeRef:{current:.12},
    mixRef:{current:{setVolume(element,gain){assert.equal(element,audio);writes.push({gain,phase:stage.dataset.v100CreditOutroStarted});}}}};
  const begin=vm.runInNewContext(code,{...refs,Number,Math,V100_CREDITS_DURATION,v100CreditsOutroFrame,v100StaffRollFrame,nodes:{length:11},setFrame:frame=>events.push(['frame',frame.progress]),setOutro:value=>events.push(['outro',value]),play:()=>events.push('play')});
  return{begin,refs,audio,stage,writes,events};
}

test('the actual component applies the crossed fade immediately before a deferred React class commit',()=>{
  const f=beginFixture(),overshoot=v100CreditsOutroOvershoot(f.audio.currentTime);
  f.begin(overshoot);
  assert.equal(f.refs.outroRef.current,overshoot);assert.equal(f.refs.elapsedRef.current,106);
  assert.equal(f.writes.length,1);assert.equal(f.writes[0].phase,'true');
  assert.equal(f.writes[0].gain,.12*v100CreditsOutroFrame(overshoot).gain);
  assert.ok(f.writes[0].gain<.12);
  assert.equal(f.audio.currentTime,106.33291585);assert.equal(f.audio.playbackRate,1);
  assert.equal(f.events.includes('play'),false);assert.equal(f.events.includes('pause'),false);
  f.begin(1);assert.equal(f.writes.length,1,'duplicate begin cannot restart the fade');
});

test('manual skip starts at the current nominal gain and a fully elapsed fade cannot restart paused audio',()=>{
  const skip=beginFixture();skip.begin();assert.equal(skip.refs.outroRef.current,0);assert.equal(skip.writes[0].gain,.12);
  const late=beginFixture({paused:true});late.begin(2.4);assert.equal(late.writes[0].gain,0);assert.equal(late.events.includes('play'),false);assert.equal(late.audio.paused,true);
});

async function observed({freeze=false,accessor=true}={}) {
  let script;await installEndingAudioGainObserver({addInitScript:async read=>{script=read;}});
  let nativeWrites=0,connections=0;
  class NativeParam {constructor(){this.intrinsic=.12;}get value(){return this.intrinsic;}set value(value){nativeWrites++;if(!freeze)this.intrinsic=Math.fround(value);}}
  const param=accessor?new NativeParam():{value:.12},sentinel={nativeResult:true};
  class NativeContext {createMediaElementSource(audio){assert.ok(audio);return{connect(destination,...args){connections++;assert.equal(destination.gain,param);assert.deepEqual(args,[0,0]);return sentinel;}};}}
  const stage={dataset:{v100CreditOutroStarted:'true'}},window={AudioContext:NativeContext};
  const context=vm.createContext({window,document:{querySelector:()=>stage},performance:{now:()=>1234},WeakMap,WeakSet,Object,Reflect,Number,String});
  vm.runInContext('('+script.toString()+')()',context);
  const audio={currentTime:106.33291585,volume:1,playbackRate:1,paused:false};
  const source=new window.AudioContext().createMediaElementSource(audio);
  assert.equal(source.connect({gain:param},0,0),sentinel);
  return{window,audio,param,stage,nativeWrites:()=>nativeWrites,connections:()=>connections,trace:()=>window.__endingOutputGainTrace(audio)};
}

test('gain observation delegates the native setter once and records its actual quantized value rather than the requested value',async()=>{
  const f=await observed();f.param.value=.114;
  assert.equal(f.nativeWrites(),1);assert.equal(f.connections(),1);assert.equal(f.window.__endingOutputGain(f.audio),f.param.value);
  const trace=f.trace();assert.equal(trace.writes[0].gain,Math.fround(.114));assert.notEqual(trace.writes[0].gain,trace.writes[0].requested);
  assert.equal(trace.writes[0].time,106.33291585);assert.equal(trace.writes[0].at,1234);
  const onset=assertEndingGainFadeOnset(trace,.12,106);assert.equal(onset.startedAtMusicSeconds,106.33291585);
  trace.writes[0].gain=0;assert.equal(f.trace().writes[0].gain,Math.fround(.114),'returned data cannot mutate the saved trace');
});

test('missing, unchanged, early and late actual gain writes cannot satisfy the unchanged106s timing gate',async()=>{
  const frozen=await observed({freeze:true});frozen.param.value=.1;assert.equal(frozen.trace().writes[0].requested,.1);
  assert.equal(frozen.trace().writes[0].gain,.12);assert.throws(()=>assertEndingGainFadeOnset(frozen.trace(),.12,106));
  for(const time of [105.8,106.35,106.441566835]){const f=await observed();f.audio.currentTime=time;f.param.value=.1;assert.throws(()=>assertEndingGainFadeOnset(f.trace(),.12,106));}
  const noPhase=await observed();noPhase.stage.dataset.v100CreditOutroStarted='false';noPhase.param.value=.1;assert.throws(()=>assertEndingGainFadeOnset(noPhase.trace(),.12,106));
  const missing=await observed({accessor:false});assert.throws(()=>assertEndingGainFadeOnset(missing.trace(),.12,106));
});

test('a bounded trace still delegates every native write and cannot be promoted after truncation',async()=>{
  const f=await observed();for(let i=0;i<1025;i++)f.param.value=.1;
  assert.equal(f.nativeWrites(),1025);assert.equal(f.trace().writes.length,1024);assert.equal(f.trace().truncated,true);
  assert.throws(()=>assertEndingGainFadeOnset(f.trace(),.12,106));
});
