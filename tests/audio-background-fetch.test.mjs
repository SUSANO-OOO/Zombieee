import assert from 'node:assert/strict';
import test from 'node:test';
import {createAudioMixer} from '../app/audioMixer.js';
import {createAudioManifest} from '../app/audioManifest.js';

function fixture({bodyFailure=false}={}){
 const windowTarget=new EventTarget(),documentTarget=new EventTarget();
 documentTarget.visibilityState='visible';
 let rejectFirst,first=true;
 const requests=[];
 const interrupted=new Promise((_,reject)=>{rejectFirst=reject;});
 const mixer=createAudioMixer({
  manifest:createAudioManifest({assets:[{id:'score',category:'bgm',sources:[{src:'/score.mp3'},{src:'/score.ogg'}]}]}),logger:null,
  fetcher:async src=>{
   requests.push(src);
   if(first){first=false;return bodyFailure?{ok:true,arrayBuffer:()=>interrupted}:interrupted;}
   return{ok:true,arrayBuffer:async()=>new Uint8Array([1,2]).buffer};
  },
 });
 mixer.attachLifecycle({windowTarget,documentTarget});
 return{mixer,requests,reject:()=>rejectFirst(new TypeError('Explicit navigation interruption')),navigate(){const event=new Event('beforeunload',{cancelable:true});windowTarget.dispatchEvent(event);return event;},input(type='pointerdown'){windowTarget.dispatchEvent(new Event(type));},hide(){documentTarget.visibilityState='hidden';windowTarget.dispatchEvent(new Event('pagehide'));},show(){documentTarget.visibilityState='visible';windowTarget.dispatchEvent(new Event('pageshow'));}};
}
for(const bodyFailure of [false,true])test(`hidden interrupted ${bodyFailure?'body':'request'} pauses format fallback and retries the same source on return`,async()=>{
 const f=fixture({bodyFailure});
 try{
  const pending=f.mixer.preloadAssets(['score']);
  await new Promise(resolve=>setImmediate(resolve));
  f.hide();f.reject();await pending;
  assert.deepEqual(f.requests,['/score.mp3']);
  assert.equal(f.mixer.getDiagnostics().cache.failed,0);
  assert.equal(f.mixer.getDiagnostics().warningTotal,0);
  await f.mixer.preloadAssets(['score']);assert.equal(f.requests.length,1);
  f.show();
  assert.deepEqual((await f.mixer.preloadAssets(['score'])).loaded,['score']);
  assert.deepEqual(f.requests,['/score.mp3','/score.mp3']);
 }finally{await f.mixer.dispose();}
});
test('a disposed mixer never starts fallback after its in-flight response fails',async()=>{
 const f=fixture(),pending=f.mixer.preloadAssets(['score']);
 await f.mixer.dispose();f.reject();await pending;await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(f.requests,['/score.mp3']);assert.equal(f.mixer.getDiagnostics().warningTotal,0);
});
test('visible load failures still try the alternate format',async()=>{
 const f=fixture();
 try{const pending=f.mixer.preloadAssets(['score']);f.reject();assert.deepEqual((await pending).loaded,['score']);assert.deepEqual(f.requests,['/score.mp3','/score.ogg']);}
 finally{await f.mixer.dispose();}
});
test('navigation blocks new fetches before pagehide without requesting a confirmation dialog',async()=>{
 const f=fixture();
 try{
  assert.equal(f.navigate().defaultPrevented,false);
  await f.mixer.preloadAssets(['score']);assert.deepEqual(f.requests,[]);
  f.input('keydown');
  const pending=f.mixer.preloadAssets(['score']);f.reject();
  assert.deepEqual((await pending).loaded,['score']);
  assert.deepEqual(f.requests,['/score.mp3','/score.ogg']);
 }finally{await f.mixer.dispose();}
});
test('a failed in-flight source stays retryable after navigation is cancelled by the user',async()=>{
 const f=fixture();
 try{
  const pending=f.mixer.preloadAssets(['score']);f.navigate();f.reject();await pending;
  assert.deepEqual(f.requests,['/score.mp3']);assert.equal(f.mixer.getDiagnostics().cache.failed,0);
  f.input();assert.deepEqual((await f.mixer.preloadAssets(['score'])).loaded,['score']);
  assert.deepEqual(f.requests,['/score.mp3','/score.mp3']);
 }finally{await f.mixer.dispose();}
});
test('hidden input cannot release a navigation gate but pageshow can',async()=>{
 const f=fixture();
 try{
  f.navigate();f.hide();f.input();await f.mixer.preloadAssets(['score']);assert.deepEqual(f.requests,[]);
  f.show();const pending=f.mixer.preloadAssets(['score']);f.reject();
  assert.deepEqual((await pending).loaded,['score']);
 }finally{await f.mixer.dispose();}
});
