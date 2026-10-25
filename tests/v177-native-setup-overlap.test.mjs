import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {prepareNativeAllUnitBattle,readNativeCaptureAudioReadiness,waitForNativeCaptureAudio} from '../scripts/v177-native-allunit-browser.mjs';

test('native motion readiness requires the actual running BGM and completed original audio preparation',()=>{
 const diagnostic={unlocked:true,contextState:'running',activeBgmVoices:1,duplicateLoopInstanceKeys:[],activePreloads:0,queuedPreloads:0,
  cache:{loading:0,fetched:0,failed:0}};
 const read=d=>vm.runInNewContext(`(${readNativeCaptureAudioReadiness.toString()})({readyOnly:true})`,{
  window:{__ASHFALL_AUDIO_QA__:{getDiagnostics:()=>d}},performance:{now:()=>123}});
 assert.equal(read(diagnostic).at,123);
 for(const mutate of [d=>{d.unlocked=false;},d=>{d.contextState='suspended';},d=>{d.activeBgmVoices=0;},
  d=>{d.duplicateLoopInstanceKeys=['same-loop'];},d=>{d.activePreloads=1;},d=>{d.queuedPreloads=1;},
  d=>{d.cache.loading=1;},d=>{d.cache.fetched=1;},d=>{d.cache.failed=1;}]){
  const d=structuredClone(diagnostic);mutate(d);assert.equal(read(d),false);
 }
});

test('audio readiness keeps its5s bound, returns its original receipt and disposes the read handle',async()=>{
 const owner={},before={at:1,queuedPreloads:31},after={at:1300,queuedPreloads:0},events=[];
 const page={evaluate:async()=>before,waitForFunction:async(_read,args,options)=>{
  assert.deepEqual(args,{readyOnly:true});assert.deepEqual(options,{timeout:5000,polling:100});
  return{jsonValue:async()=>after,dispose:async()=>events.push('dispose')};}};
 assert.equal((await waitForNativeCaptureAudio(page,owner)).after,after);assert.equal(owner.audioReadiness.before,before);
 assert.equal(owner.audioReadiness.status,'ready');assert.deepEqual(events,['dispose']);
 const failed={};await assert.rejects(waitForNativeCaptureAudio({...page,waitForFunction:async()=>{throw Error('original readiness timeout');}},failed),/original readiness timeout/);
 assert.equal(failed.audioReadiness.status,'failed');
});

test('title/battle entry and original asset decode both finish before setup returns',async()=>{
 const calls=[],owner={cleanup:'open'};let hook,decoded;
 const hookReady=new Promise(resolve=>{hook=resolve;}),decodeReady=new Promise(resolve=>{decoded=resolve;});
 const page={waitForFunction:async()=>{calls.push('wait-original-bridge');await hookReady;},
  evaluate:async(_fn,form)=>{calls.push('decode-'+form);await decodeReady;}};
 await prepareNativeAllUnitBattle(page,['turned','guardian'],owner,async()=>{
  calls.push('real-title-entry');hook();await Promise.resolve();await Promise.resolve();
  calls.push('real-battle-entry');decoded();
 });
 assert.ok(calls.indexOf('real-title-entry')<calls.indexOf('decode-turned'));
 assert.deepEqual(calls.filter(c=>c.startsWith('decode-')),['decode-turned','decode-guardian']);
 assert.equal(owner.assetReadiness.length,2);assert.ok(owner.assetReadiness.every(r=>r.status==='completed'));
});

test('either original setup failure still rejects and a closed owner cannot receive a completed asset',async()=>{
 const failure=Error('original title entry failed'),owner={cleanup:'open'};
 const page={waitForFunction:async()=>{},evaluate:async()=>{}};
 await assert.rejects(prepareNativeAllUnitBattle(page,['guardian'],owner,async()=>{throw failure;}),e=>e===failure);
 const assetFailure=Error('original asset decode failed');
 await assert.rejects(prepareNativeAllUnitBattle({waitForFunction:async()=>{},evaluate:async()=>{throw assetFailure;}},
  ['guardian'],{cleanup:'open'},async()=>{}),e=>e===assetFailure);
 const closed={cleanup:'pending'};let evaluated=false;
 await assert.rejects(prepareNativeAllUnitBattle({waitForFunction:async()=>{},evaluate:async()=>{evaluated=true;}},['guardian'],closed,async()=>{}),/owner is closed/u);
 assert.equal(evaluated,false);assert.equal(closed.assetReadiness[0].status,'failed');
});
