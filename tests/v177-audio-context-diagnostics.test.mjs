import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudioManifest} from '../app/audioManifest.js';
import {createAudioMixer} from '../app/audioMixer.js';
const make=()=>createAudioMixer({manifest:createAudioManifest({assets:[],pools:[],scenes:[]}),logger:{warn(){},error(){}}});
test('the actual owner diagnostics report current context timing after creation and after it changes',()=>{
 const owner=make();assert.equal(owner.getDiagnostics().contextTiming.sampleRate,null);
 owner.context={state:'running',sampleRate:44100,baseLatency:.003,outputLatency:.02};
 const first=owner.getDiagnostics();assert.equal(first.contextTiming.sampleRate,44100);assert.equal(first.contextTiming.baseLatencySeconds,.003);
 owner.context.baseLatency=0;owner.context.outputLatency=NaN;const next=owner.getDiagnostics();assert.equal(next.contextTiming.baseLatencySeconds,0);assert.equal(next.contextTiming.outputLatencySeconds,null);assert.equal(first.contextTiming.baseLatencySeconds,.003);
});
test('two independent audio owners publish their own timing and never use a constructor-time stale snapshot',()=>{
 const battle=make(),ui=make();battle.context={state:'running',sampleRate:48000,baseLatency:.004,outputLatency:.01};ui.context={state:'running',sampleRate:44100,baseLatency:.008,outputLatency:.03};
 const a=battle.getDiagnostics().contextTiming,b=ui.getDiagnostics().contextTiming;assert.equal(a.sampleRate,48000);assert.equal(b.sampleRate,44100);assert.notEqual(a,b);
 assert.match(a.scope,/not speaker or saved Control Center/);assert.equal(Object.hasOwn(battle.getAudioStatus(),'contextTiming'),false,'live timing belongs to getDiagnostics rather than the initial locked status');
});
