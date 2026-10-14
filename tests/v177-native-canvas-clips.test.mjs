import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {mkdtemp,readFile} from 'node:fs/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import {startNativeCanvasClip,finishNativeCanvasClip,beginV177NativeCanvasClip} from '../scripts/v177-native-canvas-clips.mjs';

const metadata={form:'ranger',phase:'move',fighterId:42,fixtureGroup:'authored-form'};
function fixture({supported=true,supportedTypes=['video/webm;codecs=vp8'],constructorError=false,stopEvent=true,nativeError=false,chunks=['native-a','native-b']}={}){
  let now=100,captures=0,stops=0,disposed=0;
  const track={getSettings:()=>({width:844,height:304,frameRate:59.94}),stop:()=>{stops++;}};
  const stream={getVideoTracks:()=>[track],getAudioTracks:()=>[],getTracks:()=>[track]};
  class Recorder{
    static isTypeSupported(type){return supported&&supportedTypes.includes(type);}
    constructor(input,{mimeType}){assert.equal(input,stream);if(constructorError)throw Error('Native encoder unavailable');this.mimeType=mimeType;this.state='inactive';this.listeners=new Map();}
    addEventListener(type,fn){this.listeners.set(type,fn);}
    removeEventListener(type,fn){if(this.listeners.get(type)===fn)this.listeners.delete(type);}
    start(){this.state='recording';this.listeners.get('start')?.();}
    stop(){this.state='inactive';queueMicrotask(()=>{
      for(const chunk of chunks)this.listeners.get('dataavailable')?.({data:new Blob([chunk]),timecode:now-100});
      if(nativeError)this.listeners.get('error')?.({error:new Error('Native encode failure')});
      if(stopEvent)this.listeners.get('stop')?.();
    });}
  }
  const canvas={width:844,height:304,isConnected:true,captureStream(...args){assert.equal(args.length,0,'do not override capture FPS');captures++;return stream;}};
  const globals={MediaRecorder:Recorder,performance:{timeOrigin:1_000_000,now:()=>now+=5},Blob,Uint8Array,btoa,setTimeout,clearTimeout};
  Object.defineProperty(globals,'AudioContext',{get(){assert.fail('Never change or create audio');}});
  Object.defineProperty(globals,'navigator',{get(){assert.fail('Never request camera or microphone');}});
  const run=fn=>vm.runInNewContext('('+fn.toString()+')',globals);
  const start=options=>run(startNativeCanvasClip)(canvas,{metadata,...options});
  const finish=(state,options={completed:true})=>run(finishNativeCanvasClip)(state,options);
  const page={locator(selector){assert.equal(selector,'.game-shell canvas');return{async evaluateHandle(fn,args){
    const state=run(fn)(canvas,args);return{evaluate:async(fn,args)=>run(fn)(state,args),dispose:async()=>{disposed++;}};
  }};}};
  return{canvas,globals,page,start,finish,get captures(){return captures;},get stops(){return stops;},get disposed(){return disposed;}};
}

test('native recording preserves supplied bytes, track rate and event times without granting original-speed acceptance',async()=>{
  const f=fixture(),state=f.start(),receipt=await f.finish(state);
  assert.equal(receipt.status,'recorded');assert.equal(Buffer.from(receipt.videoBase64,'base64').toString(),'native-anative-b');
  assert.equal(receipt.trackSettings.frameRate,59.94);assert.equal(receipt.dataEvents.length,2);
  assert.ok(receipt.stoppedAt>receipt.startedAt);assert.equal(receipt.timeOrigin,1_000_000);
  assert.equal(receipt.originalSpeedAccepted,false);assert.equal(receipt.encodedPtsVerified,false);
  assert.equal(f.captures,1);assert.equal(f.stops,1);assert.equal(state.chunks.length,0);
});

test('engine-specific container preference preserves the native track and cannot grant a speed or performance pass',async()=>{
  for(const [engine,mime] of [['webkit','video/mp4'],['chromium','video/webm;codecs=vp8']]){
    const f=fixture({supportedTypes:['video/mp4','video/webm;codecs=vp8']}),receipt=await f.finish(f.start({engine}));
    assert.equal(receipt.status,'recorded');assert.equal(receipt.mimeType,mime);assert.equal(receipt.mimePreferences[0],mime);
    assert.equal(receipt.trackSettings.frameRate,59.94);assert.equal(receipt.originalSpeedAccepted,false);assert.equal(receipt.encodedPtsVerified,false);
    assert.equal(Buffer.from(receipt.videoBase64,'base64').toString(),'native-anative-b');assert.equal(f.captures,1);assert.equal(f.stops,1);
  }
  const fallback=fixture(),receipt=await fallback.finish(fallback.start({engine:'webkit'}));
  assert.equal(receipt.mimeType,'video/webm;codecs=vp8','unsupported MP4 keeps an explicitly supported original native container');
});

test('host persistence forwards engine selection and retains the actual MP4 container without transcoding',async()=>{
  const f=fixture({supportedTypes:['video/mp4','video/webm;codecs=vp8']}),directory=await mkdtemp(path.join(os.tmpdir(),'v177-native-mp4-'));
  const clip=await beginV177NativeCanvasClip(f.page,metadata,{directory,engine:'webkit'}),receipt=await clip.finish({completed:true});
  assert.equal(receipt.status,'recorded');assert.equal(receipt.mimeType,'video/mp4');assert.ok(receipt.file.endsWith('.mp4'));
  assert.equal((await readFile(receipt.file)).toString(),'native-anative-b');assert.equal(receipt.originalSpeedAccepted,false);assert.equal(f.disposed,1);
});

test('an interrupted original sampler retains its native payload but cannot become a completed clip',async()=>{
  const f=fixture(),receipt=await f.finish(f.start(),{completed:false});
  assert.equal(receipt.status,'invalid');assert.ok(receipt.errors.includes('Sampling window interrupted'));
  assert.equal(Buffer.from(receipt.videoBase64,'base64').toString(),'native-anative-b');assert.equal(f.stops,1);
});

test('unsupported encoding never starts a track or falls back to permissions or copied frames',async()=>{
  const f=fixture({supported:false}),receipt=await f.finish(f.start());
  assert.equal(receipt.status,'unsupported');assert.equal(f.captures,0);assert.equal(f.stops,0);assert.equal(receipt.originalSpeedAccepted,false);
});

test('a native constructor failure releases only the owned canvas track',async()=>{
  const f=fixture({constructorError:true}),receipt=await f.finish(f.start());
  assert.equal(receipt.status,'invalid');assert.ok(receipt.errors.some(e=>e.includes('Native encoder unavailable')));
  assert.equal(f.captures,1);assert.equal(f.stops,1);
});

test('the byte bound is fail closed and never retains an oversized native chunk',async()=>{
  const f=fixture({chunks:['aa','bb']}),receipt=await f.finish(f.start({maxBytes:3}));
  assert.equal(receipt.status,'invalid');assert.ok(receipt.errors.includes('clip-byte-limit'));
  assert.equal(Buffer.from(receipt.videoBase64,'base64').length,2);assert.equal(f.stops,1);
});

test('missing native stop events terminate observation and release the stream',async()=>{
  const f=fixture({stopEvent:false}),receipt=await f.finish(f.start({stopMs:15}));
  assert.equal(receipt.status,'invalid');assert.ok(receipt.errors.includes('native-stop-timeout'));
  assert.equal(receipt.stoppedAt,null);assert.equal(receipt.encodedPtsVerified,false);assert.equal(f.stops,1);
});

test('canvas resize or detachment cannot validate a different picture as the original capture',async()=>{
  for(const change of [canvas=>canvas.width++,canvas=>{canvas.isConnected=false;}]){
    const f=fixture(),state=f.start();change(f.canvas);const receipt=await f.finish(state);
    assert.equal(receipt.status,'invalid');assert.ok(receipt.errors.includes('Original canvas changed during capture'));assert.equal(f.stops,1);
  }
});

test('a native recorder error remains explicit even when encoded chunks and a stop event arrive',async()=>{
  const f=fixture({nativeError:true}),receipt=await f.finish(f.start());
  assert.equal(receipt.status,'invalid');assert.ok(receipt.errors.some(e=>e.includes('Native encode failure')));assert.equal(f.stops,1);
});

test('host persistence writes exact native payload and compact metadata, then disposes its handle',async()=>{
  // Fixture bytes exercise transport only; they are not an encoded-video oracle.
  const f=fixture(),directory=await mkdtemp(path.join(os.tmpdir(),'v177-canvas-clips-'));
  const clip=await beginV177NativeCanvasClip(f.page,metadata,{directory,engine:'webkit'}),receipt=await clip.finish({completed:true});
  assert.equal(receipt.status,'recorded');assert.equal((await readFile(receipt.file)).toString(),'native-anative-b');
  assert.ok(receipt.file.endsWith('authored-form-ranger-move-42.webm'));assert.equal(receipt.originalSpeedAccepted,false);
  const saved=JSON.parse(await readFile(path.join(directory,'authored-form-ranger-move-42.json'),'utf8'));
  assert.equal(saved.sha256,receipt.sha256);assert.equal('videoBase64' in saved,false);assert.equal(f.disposed,1);
  await assert.rejects(clip.finish({completed:true}),/already finalized/u);
});

test('campaign twin and authored twin clips remain distinct even when their form and fighter ID match',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'v177-twin-clips-')),files=[];
  for(const fixtureGroup of ['base-enemy','authored-form']){
    const f=fixture(),clip=await beginV177NativeCanvasClip(f.page,{...metadata,form:'futago-separated-a',fixtureGroup},{directory,engine:'webkit'});
    const receipt=await clip.finish({completed:true});assert.equal(receipt.status,'recorded');files.push(receipt.file);
  }
  assert.equal(new Set(files).size,2,'the second native encounter must never overwrite or lose the first');
});

const source=fs.readFileSync(new URL('../scripts/v102-combat-browser.mjs',import.meta.url),'utf8');
const tree=ts.createSourceFile('v102-combat-browser.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const sampler=tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='captureContinuousSamples');
for(const failsAt of [null,4]){
  test(`actual continuous sampler preserves15 observations and finalizes capture on ${failsAt?'original failure':'completion'}`,async()=>{
    const receipts=[],waits=[],clockEnds=[],sentinel=new Error('Original sample failure');let reads=0,finished=0;
    const page={waitForFunction:async(fn,proof,options)=>{assert.equal(options.timeout,5000);},waitForTimeout:async ms=>waits.push(ms),evaluate:async()=>{reads++;if(reads===failsAt)throw sentinel;return{fighter:{id:42}};}};
    const owners=new WeakMap([[page,{receipts,directory:'/unused',engine:'webkit'}]]),clocks=new WeakMap([[page,{beginSection:()=>({}),endSection:(section,result)=>clockEnds.push(result.completed)}]]);
    const run=vm.runInNewContext('('+sampler.getText(tree)+')',{
      hasV177ContinuousDraw:()=>{},canvasClips:owners,frameClocks:clocks,
      beginV177NativeCanvasClip:async(p,m)=>{assert.equal(p,page);assert.equal(m.fighterId,42);return{finish:async result=>{finished++;return{completed:result.completed,originalSpeedAccepted:false};}};},
    });
    if(failsAt)await assert.rejects(()=>run(page,{fighterId:42},metadata),error=>error===sentinel);
    else assert.equal((await run(page,{fighterId:42},metadata)).length,15);
    assert.equal(reads,failsAt??15);assert.ok(waits.every(ms=>ms===120));assert.equal(finished,1);
    assert.equal(receipts[0].completed,!failsAt);assert.deepEqual(clockEnds,[!failsAt]);
  });
}
