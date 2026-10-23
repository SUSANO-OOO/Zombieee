
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {
 createNativeAllUnitRealmOwner,readNativeAllUnitRealmOwner,readNativeAllUnitSample,
 releasePreparedShardClock,assertNativeRealmMember,postpaintCaptureBoundary,assertShardPostpaintContract,assertShardProof
} from '../scripts/v177-native-allunit-contract.mjs';
import {startNativeCanvasClip,finishNativeCanvasClip,beginV177NativeCanvasClip} from '../scripts/v177-native-canvas-clips.mjs';
import {startNativeGameRafObservation,stopNativeGameRafObservation} from '../scripts/v177-native-game-capture-browser.mjs';
import {assertAllUnitClip} from '../scripts/v177-native-allunit-cases.mjs';
import {SHARDS,planShard,LIMITS,assertPlannedCase} from '../scripts/v177-native-allunit-manifest.mjs';
import {MANUAL_ABILITY_REGISTRY} from '../app/manualAbilities.js';

const root=process.cwd(),fixtureDirectory=process.env.V177_REALM_OWNER_TEST_OUTPUT??path.join(os.tmpdir(),'v177-realm-owner-node');
const require=createRequire(path.join(root,'package.json'));
const ts=require('typescript');
const {JSHandle,evaluateExpression}=require(path.join(root,'node_modules/playwright-core/lib/server/javascript.js'));
const {parseEvaluationResultValue}=require(path.join(root,'node_modules/playwright-core/lib/utils/isomorphic/utilityScriptSerializers.js'));
const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const proposed=name=>fs.readFileSync(new URL('../scripts/'+name+'.mjs',import.meta.url),'utf8');
function declaration(source,name){
 const tree=ts.createSourceFile('source.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const node=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
 assert.ok(node,name);return node.getText(tree).replace(/^export\s+/u,'');
}
function callback(realm,fn){return vm.runInContext('('+fn.toString()+')',realm.context);}
function fixture({form='medic',origin=1000000,startEvent=true,stopEvent=true,chunks=['pure-node-fixture'],nativeError=false,failAtSample=null,cleanupFailure=false,manualSampleTimer=false,sampleTransportMs=0,sampleHandleTransportMs=0}={}){
 const plan=SHARDS.flatMap(s=>planShard(s.id)).find(r=>r.form===form&&r.phase==='move'&&r.viewport.height===390);
 const row={...clone(plan),samples:[],status:'starting'};
 const stats={speed:38,laneSpeed:20,damage:10,range:180,attackEvery:1,hp:100,maxHp:100};
 const proof={schema:'v177-native-shard-proof/v1',proofId:'2:medic:4:move',battleGeneration:2,route:'/v100',
  owner:plan.owner,kind:plan.binding.kind,side:'human',renderKind:form,v100TwinPart:null,
  legacyFusedFixture:false,phase:'move',fighterId:4,targetId:5,originalActorStats:stats,ownerEvidence:{constructorFixture:true}};
 const log=[],raf=new Map(),scheduled=[];let now=1000,rawOrigin=origin,paused=true,simulation=0,seq=1,reads=0,nextRaf=0,streamStops=0;
 function advanceClock(ms){
  now+=ms;if(!paused){simulation+=ms/1000;seq++;}
  const frameAt=now;
  for(const [id,fn]of [...raf]){raf.delete(id);fn(frameAt);}
  rawOrigin++;
 }
 const sentinel=Error('Original sample transport failure'),cleanupSentinel=Error('Owner disposal failure');
 const fighter=()=>({...stats,id:4,kind:proof.kind,side:'human',renderKind:form,v100TwinPart:null,x:330+simulation*38,attackSequence:0,
  ...(plan.owner==='mayo-activation'?{manualAbilityPhase:'feral'}:{})});
 const paints=()=>[{renderSequence:seq,renderKind:form,assetReady:true,renderWidth:60,renderHeight:90,
  x:330+simulation*38,y:220,poseScaleX:1,poseScaleY:1,requestedState:'move',actualXDelta:simulation?4.56:0,
  jointAtlasPath:row.binding.atlas.path,jointLowerFrame:seq%30,jointUpperFrame:0,
  jointDrawSucceeded:true,jointPaintedAt:simulation,renderedWeaponSocket:{x:350,y:200}}];
 const qa={
  prepareV177ContinuousActorProof:()=>{log.push('prepare');return clone(proof);},
  getSnapshot:()=>({time:simulation,running:true,paused}),
  setEnemyVfxProofPaused:value=>{paused=value;log.push(value?'pause':'release');},
  getEnemyFacingRuntimeAudit:id=>id===4?{fighter:fighter(),renderHistory:paints()}:{fighter:{id:5}},
  getPhaseGCombatSnapshot:()=>({battleGeneration:2,completedAttackImpacts:[]}),
  getPerformanceSnapshot:()=>({simulationTicks:seq,renderFrames:seq,hiddenFrameCallbacks:0,visibilityTransitions:0,
   backgroundDurationMs:0,droppedSimulationSeconds:0,scheduledSimulationSteps:seq,rafRequests:seq,rafCancellations:0})
 };
 const track={getSettings:()=>({width:844,height:304,frameRate:59.94}),stop:()=>{streamStops++;log.push('track-stop');}};
 const stream={getTracks:()=>[track],getVideoTracks:()=>[track],getAudioTracks:()=>[]};
 const window={__ASHFALL_BATTLE_QA__:qa};
 const document={defaultView:window,visibilityState:'visible',querySelector:selector=>{assert.equal(selector,'.game-shell canvas');return canvas;}};
 const canvas={width:844,height:304,isConnected:true,ownerDocument:document,
  getBoundingClientRect:()=>({x:0,y:0,width:844,height:304}),
  captureStream(...args){assert.equal(args.length,0);log.push('capture-stream');return stream;}};
 const performance={get timeOrigin(){return rawOrigin;},now:()=>now+=.001};
 class Recorder{
  static isTypeSupported(type){return type==='video/webm;codecs=vp8';}
  constructor(input,{mimeType}){assert.equal(input,stream);this.state='inactive';this.mimeType=mimeType;this.listeners=new Map();}
  addEventListener(type,listener){this.listeners.set(type,listener);}
  removeEventListener(type,listener){if(this.listeners.get(type)===listener)this.listeners.delete(type);}
  start(){this.state='recording';log.push('recorder-start');if(startEvent)this.listeners.get('start')?.();}
  stop(){this.state='inactive';log.push('recorder-stop');queueMicrotask(()=>{
   for(const bytes of chunks)this.listeners.get('dataavailable')?.({data:new Blob([bytes]),timecode:now-1000});
   if(nativeError)this.listeners.get('error')?.({error:Error('Native failure retained')});
   if(stopEvent)this.listeners.get('stop')?.();
  });}
 }
 const globals={window,document,performance,location:{pathname:'/v100'},crypto:{randomUUID},
  innerWidth:844,innerHeight:390,devicePixelRatio:1,MediaRecorder:Recorder,structuredClone,
  Blob,Uint8Array,btoa,setTimeout(fn,ms,...args){
   if(fn.name!=='readNativeSampleOnSchedule')return setTimeout(fn,ms,...args);
   const timer={fn,ms};scheduled.push(timer);
   if(!manualSampleTimer)queueMicrotask(()=>{advanceClock(ms);fn();});
   return timer;
  },clearTimeout,
  requestAnimationFrame:fn=>{raf.set(++nextRaf,fn);return nextRaf;},
  cancelAnimationFrame:id=>raf.delete(id)};
 Object.defineProperty(globals,'AudioContext',{get(){assert.fail('No AudioContext');}});
 Object.defineProperty(globals,'navigator',{get(){assert.fail('No microphone or media permissions');}});
 const context=vm.createContext(globals,{codeGeneration:{strings:false,wasm:false}});
 // These are the installed Playwright serializer and JSHandle execution gates,
 // with only the transport/browser delegate replaced by a pure Node VM.
 const transport={
  adoptIfNeeded:()=>null,
  async evaluateWithArguments(_expression,returnByValue,values,handles){
   const [,,expression,count,...serialized]=values;
   const args=serialized.slice(0,count).map(v=>parseEvaluationResultValue(v,handles.map(h=>h.mockValue)));
   const fn=vm.runInContext('('+expression+')',context),value=await fn(...args);
   return returnByValue?clone(value):handle(value);
  },
  releaseHandle:async h=>{log.push(h.mockValue?.schema==='v177-native-realm-owner/v1'?'owner-dispose':'member-dispose');},
  doSlowMo:async()=>{}
 };
 function handle(value){
  const h=Object.create(JSHandle.prototype);
  Object.assign(h,{_context:transport,_objectId:randomUUID(),_disposed:false,mockValue:value});
  const dispose=h.dispose.bind(h);h.dispose=async()=>{
   if(cleanupFailure&&value?.schema==='v177-native-realm-owner/v1'){log.push('owner-dispose');throw cleanupSentinel;}
   dispose();
  };
  const evaluate=h.evaluate.bind(h);h.evaluate=async(fn,arg)=>{
   if(fn.name==='readNativeAllUnitSample'&&++reads===failAtSample)throw sentinel;
   const result=await evaluate(fn,arg);
   if(result?.schema==='v177-native-shard-postpaint/v1'&&result.readTiming?.sampleAt!==null&&sampleTransportMs){
    log.push('sample-export');advanceClock(sampleTransportMs);
   }
   return result;
  };
  const evaluateHandle=h.evaluateHandle.bind(h);h.evaluateHandle=async(fn,arg)=>{
   if(fn.name==='readNativeAllUnitSample'&&++reads===failAtSample)throw sentinel;
   const result=await evaluateHandle(fn,arg);
   if(fn.name==='readNativeAllUnitSample'&&arg?.sampleAt!==undefined&&sampleHandleTransportMs)advanceClock(sampleHandleTransportMs);
   return result;
  };
  return h;
 }
 const page={
  isClosed:()=>false,
  evaluate:async(fn,arg)=>evaluateExpression(transport,fn.toString(),{isFunction:true,returnByValue:true},arg),
  evaluateHandle:async(fn,arg)=>evaluateExpression(transport,fn.toString(),{isFunction:true,returnByValue:false},arg),
  waitForFunction:async(fn,arg,options)=>{assert.equal(options.timeout,LIMITS.readinessMs);assert.equal(await page.evaluate(fn,arg),true);},
  waitForTimeout:async ms=>{
   assert.equal(ms,120);log.push('host-wait');advanceClock(ms);
  },
  locator:selector=>{assert.equal(selector,'.game-shell canvas');return{
   evaluateHandle:async(fn,arg)=>handle(canvas).evaluateHandle(fn,arg)
  };}
 };
 return{context,globals,window,document,canvas,performance,qa,proof,row,log,page,transport,handle,sentinel,cleanupSentinel,scheduled,advanceClock,
  get now(){return now;},set now(v){now=v;},get origin(){return rawOrigin;},set origin(v){rawOrigin=v;},
  get simulation(){return simulation;},get streamStops(){return streamStops;},
  advance:()=>page.waitForTimeout(120),
  flushRaf:()=>{const frameAt=now;for(const [id,fn]of [...raf]){raf.delete(id);fn(frameAt);}},
  run(fn,...args){return callback(this,fn)(...args);},
  owner(){log.push('owner-create');return callback(this,createNativeAllUnitRealmOwner)();}
 };
}
function refs(f){return{window:f.globals.window,document:f.globals.document,performance:f.globals.performance,canvas:f.globals.document.querySelector('.game-shell canvas')};}

test('actual owner closure keeps real objects private, rejects a copied owner and locks its counter',()=>{
 const f=fixture(),owner=f.owner(),a=f.run(readNativeAllUnitRealmOwner,owner);
 assert.equal(owner.document,f.document);assert.equal(owner.performance,f.performance);assert.equal(owner.canvas,f.canvas);
 assert.equal(a.member,'owner-created');assert.equal(a.sequence,1);assert.match(a.ownerId,/^[a-f0-9-]{36}$/u);
 assert.throws(()=>{owner.sequence=0;},TypeError);
 assert.throws(()=>owner.member.call({...owner},refs(f),'sample'),/reference mismatch/u);
 assert.throws(()=>vm.runInContext('eval("1")',f.context),/Code generation/u);
 assert.throws(()=>vm.runInContext('new Function("return 1")',f.context),/Code generation/u);
});
test('each fresh raw timeOrigin remains unchanged by stable same-realm owner receipts',()=>{
 const f=fixture(),owner=f.owner();f.run(readNativeAllUnitRealmOwner,owner);
 const samples=[];
 for(const origin of [1000000,1000001,1000002,999999]){
  f.origin=origin;samples.push(clone(f.run(readNativeAllUnitSample,owner,f.proof)));
 }
 assert.deepEqual(samples.map(s=>s.timeOrigin),[1000000,1000001,1000002,999999]);
 for(let i=1;i<samples.length;i++)assertNativeRealmMember(samples[0].realm,samples[i].realm,'sample',samples[i-1].realm);
 assert.ok(samples.every(s=>s.realm.rawOriginAtCreation===1000000));
});

test('scheduled source reads wait in the original clock without issuing an early sample receipt',async()=>{
 const f=fixture({manualSampleTimer:true}),owner=f.owner(),first=f.run(readNativeAllUnitRealmOwner,owner);
 const due=f.now+120,pending=f.run(readNativeAllUnitSample,owner,{...f.proof,sampleAt:due});
 assert.equal(owner.sequence,first.sequence);assert.equal(f.scheduled.length,1);
 // A timer firing early must wait again; it cannot stamp the planned time onto a read.
 f.advanceClock(60);f.scheduled[0].fn();
 assert.equal(owner.sequence,first.sequence);assert.equal(f.scheduled.length,2);
 f.advanceClock(f.scheduled[1].ms);f.scheduled[1].fn();
 const sample=await pending;
 assert.ok(sample.at>=due&&sample.at<due+.1);assert.equal(owner.sequence,first.sequence+1);
 assertNativeRealmMember(first,sample.realm,'sample');assert.equal(sample.timeOrigin,f.origin);
});

test('scheduled source reads reject a lost realm during the wait and retain the previous receipt',async()=>{
 for(const change of [
  f=>{f.globals.document={...f.document};},
  f=>{f.globals.performance={now:f.performance.now,timeOrigin:f.origin};},
  f=>{f.globals.window={...f.window};},
  f=>{f.document.querySelector=()=>({...f.canvas});},
  f=>{f.canvas.isConnected=false;},
 ]){
  const f=fixture({manualSampleTimer:true}),owner=f.owner(),first=f.run(readNativeAllUnitRealmOwner,owner);
  const pending=f.run(readNativeAllUnitSample,owner,{...f.proof,sampleAt:f.now+120});
  change(f);f.advanceClock(f.scheduled[0].ms);f.scheduled[0].fn();
  await assert.rejects(pending,/reference mismatch/u);assert.equal(owner.sequence,first.sequence);
 }
});

test('scheduled input requires its owner and a finite time; late reads report their actual time immediately',()=>{
 const f=fixture(),owner=f.owner(),first=f.run(readNativeAllUnitRealmOwner,owner);
 for(const sampleAt of [NaN,Infinity,-Infinity,null,'120'])
  assert.throws(()=>f.run(readNativeAllUnitSample,owner,{...f.proof,sampleAt}),/finite time/u);
 assert.throws(()=>f.run(readNativeAllUnitSample,{...f.proof,sampleAt:f.now+120}),/original realm/u);
 assert.equal(owner.sequence,first.sequence);assert.equal(f.scheduled.length,0);
 const actual=f.now,sample=f.run(readNativeAllUnitSample,owner,{...f.proof,sampleAt:actual-500});
 assert.equal(sample.then,undefined);assert.ok(sample.at>actual);assert.equal(f.scheduled.length,0);
 assert.equal(owner.sequence,first.sequence+1);
});
test('new Document, Performance, Window, canvas, canvas-owner and detachment are rejected by actual callback refs',()=>{
 for(const change of [
  f=>{f.globals.document={...f.document};},
  f=>{f.globals.performance={now:f.performance.now,timeOrigin:f.origin};},
  f=>{f.globals.window={...f.window};},
  f=>{f.document.querySelector=()=>({...f.canvas});},
  f=>{f.canvas.ownerDocument={...f.document};},
  f=>{f.canvas.isConnected=false;},
 ]){
  const f=fixture(),owner=f.owner();change(f);
  assert.throws(()=>f.run(readNativeAllUnitSample,owner,f.proof),/reference mismatch/u);
 }
 const a=fixture(),b=fixture(),owner=a.owner();
 assert.throws(()=>b.run(readNativeAllUnitSample,owner,b.proof),/reference mismatch/u);
});
test('installed Playwright gates preserve nested actual JSHandle values and reject another context before callback',async()=>{
 const a=fixture(),b=fixture(),owner=await a.page.evaluateHandle(createNativeAllUnitRealmOwner);
 const receipt=await owner.evaluate(readNativeAllUnitRealmOwner);
 const sample=await owner.evaluate(readNativeAllUnitSample,a.proof);
 assertNativeRealmMember(receipt,sample.realm,'sample');
 const raf=await a.page.evaluateHandle(startNativeGameRafObservation,{...a.proof,realmOwner:owner});
 a.flushRaf();const stop=await raf.evaluate(stopNativeGameRafObservation);
 assert.equal(stop.realm.failure,null);assert.equal(stop.realm.started.ownerId,receipt.ownerId);
 await assert.rejects(b.page.evaluateHandle(startNativeGameRafObservation,{...b.proof,realmOwner:owner}),/context they were created/u);
 await owner.dispose();await assert.rejects(owner.evaluate(readNativeAllUnitSample,a.proof),/disposed/u);
 await raf.dispose();
});
test('different real owner and duplicate/decreasing member sequence fail without consulting raw origin equality',()=>{
 const f=fixture(),a=f.owner(),b=f.owner(),first=f.run(readNativeAllUnitRealmOwner,a);
 const second=f.run(readNativeAllUnitSample,b,f.proof).realm;
 assert.throws(()=>assertNativeRealmMember(first,second,'sample'),/owner changed/u);
 for(const sequence of [0,first.sequence,first.sequence-1]){
  assert.throws(()=>assertNativeRealmMember(first,{...first,member:'sample',sequence},'sample'));
 }
 const next=f.run(readNativeAllUnitSample,a,f.proof).realm;
 for(const patch of [{ownerId:second.ownerId},{createdAt:next.createdAt+1},{rawOriginAtCreation:next.rawOriginAtCreation+1},{member:'release'}])
  assert.throws(()=>assertNativeRealmMember(first,{...next,...patch},'sample'));
});
test('Recorder ACK and completion carry same-state origin and owner start, preserving original fixture bytes',async()=>{
 const f=fixture(),owner=f.owner();f.run(readNativeAllUnitRealmOwner,owner);
 const state=f.run(startNativeCanvasClip,f.canvas,{metadata:{form:'medic'},engine:'webkit',requestedMimeType:'video/webm;codecs=vp8',realmOwner:owner});
 const start=clone(state.realmStarted);f.origin+=2;
 const result=clone(await f.run(finishNativeCanvasClip,state,{completed:true}));
 assert.equal(result.status,'recorded');assert.equal(result.timeOrigin,1000000);
 assert.deepEqual(result.realm.started,start);assertNativeRealmMember(start,result.realm.finished,'recorder-finish');
 assert.equal(Buffer.from(result.videoBase64,'base64').toString(),'pure-node-fixture');assert.equal(f.streamStops,1);
});
test('changed Recorder realm retains native-error and partial fixture bytes and releases its only track',async()=>{
 const f=fixture({nativeError:true}),owner=f.owner();
 const state=f.run(startNativeCanvasClip,f.canvas,{metadata:{form:'medic'},realmOwner:owner});
 f.globals.performance={...f.performance};
 const result=clone(await f.run(finishNativeCanvasClip,state,{completed:true}));
 assert.equal(result.status,'invalid');assert.ok(result.errors.some(s=>s.includes('reference mismatch')));
 assert.ok(result.errors.some(s=>s.includes('Native failure retained')));
 assert.equal(result.realm.finished,null);assert.equal(Buffer.from(result.videoBase64,'base64').toString(),'pure-node-fixture');
 assert.equal(f.streamStops,1);
});
test('RAF realm failure retains partial raw rows, cancels scheduling and cannot produce a valid stop receipt',()=>{
 const f=fixture(),owner=f.owner(),state=f.run(startNativeGameRafObservation,{fighterId:4,realmOwner:owner});
 f.flushRaf();assert.equal(state.rows.length,1);f.globals.performance={...f.performance};f.flushRaf();
 const result=clone(f.run(stopNativeGameRafObservation,state));
 assert.equal(result.rows.length,1);assert.match(result.realm.failure,/reference mismatch/u);assert.equal(result.realm.stopped,null);
});

test('unowned default and explicit-null Recorder/RAF keep matching receipts and never access owner globals',async()=>{
 const outputs=[];
 for(const explicitNull of [false,true]){
  const f=fixture();
  Object.defineProperty(f.globals,'document',{get(){assert.fail('Unowned path must not add Document/owner reads');}});
  const raf=f.run(startNativeGameRafObservation,{fighterId:4,...(explicitNull?{realmOwner:null}:{})});
  f.flushRaf();const rafResult=clone(f.run(stopNativeGameRafObservation,raf));
  assert.deepEqual(Object.keys(rafResult).sort(),['timeOrigin','startedAt','stoppedAt','rows','overflow','timestampClock','observationClock','encodedFrameCount','encodedPtsVerified','scope'].sort());
  assert.equal(rafResult.timestampClock,'native requestAnimationFrame callback');
  assert.equal(rafResult.observationClock,'raw performance.now at callback entry and after audit');
  assert.equal(rafResult.rows[0].at,rafResult.startedAt);
  assert.ok(rafResult.rows[0].observedAt>rafResult.rows[0].enteredAt);
  const state=f.run(startNativeCanvasClip,f.canvas,{metadata:{form:'medic'},...(explicitNull?{realmOwner:null}:{})});
  const clip=clone(await f.run(finishNativeCanvasClip,state,{completed:true}));
  assert.deepEqual(Object.keys(clip).sort(),['schema','metadata','status','mimeType','mimePreferences','requestedMimeType',
   'width','height','timeOrigin','requestedAt','startedAt','stopRequestedAt','stoppedAt','nativeElapsedMs','captureWindowMs',
   'trackSettings','dataEvents','errors','completed','scope','originalSpeedAccepted','encodedPtsVerified','videoBase64'].sort());
  assert.equal(clip.status,'recorded');assert.equal(Buffer.from(clip.videoBase64,'base64').toString(),'pure-node-fixture');
  assert.equal(clip.originalSpeedAccepted,false);assert.equal(clip.encodedPtsVerified,false);outputs.push({rafResult,clip});
 }
 assert.deepEqual(outputs[0],outputs[1]);
});

async function strictRow(){
 const f=fixture(),owner=await f.page.evaluateHandle(createNativeAllUnitRealmOwner);
 f.row.proof=clone(f.proof);f.row.realmOwner=await owner.evaluate(readNativeAllUnitRealmOwner);
 const raf=await f.page.evaluateHandle(startNativeGameRafObservation,{fighterId:4,realmOwner:owner});
 f.origin++;
 const directory=path.join(fixtureDirectory,randomUUID());
 const metadata={form:'medic',phase:'move',fighterId:4,fixtureGroup:'authored-form'};
 f.row.recordingMetadata=metadata;
 const clip=await beginV177NativeCanvasClip(f.page,metadata,{directory,engine:'webkit',requestedMimeType:'video/webm;codecs=vp8',realmOwner:owner});
 f.row.recordingStart=await clip.waitForStart();
 f.origin++;
 f.row.pausedCaptureStart=await owner.evaluate(readNativeAllUnitSample,f.proof);
 f.row.boundary=postpaintCaptureBoundary(f.row,f.proof,f.row.pausedCaptureStart,f.row.recordingStart);
 f.origin++;
 f.row.release=await owner.evaluate(releasePreparedShardClock,f.proof);
 f.row.captureStart=await owner.evaluate(readNativeAllUnitSample,f.proof);
 for(let i=0;i<15;i++){await f.advance();f.row.samples.push(await owner.evaluate(readNativeAllUnitSample,f.proof));}
 f.row.nativeClip=await clip.finish({completed:true});
 f.row.sourceRaf=await raf.evaluate(stopNativeGameRafObservation);await raf.dispose();
 f.row.captureEnd=await owner.evaluate(readNativeAllUnitSample,f.proof);await owner.dispose();
 return f;
}
test('full strict native-member chain accepts only synthetic same-realm evidence despite 1ms raw-origin drift',async()=>{
 const f=await strictRow(),r=f.row,rawOrigins=[r.recordingStart.timeOrigin,r.boundary.timeOrigin,r.release.timeOrigin,...r.samples.map(s=>s.timeOrigin),r.captureEnd.timeOrigin];
 const receipt=assertShardPostpaintContract(r,r.proof,r.boundary,r.release,r.samples);
 assert.equal(receipt.distinctNewPaints,15);assert.equal(receipt.naturalnessAccepted,false);
 assertAllUnitClip(r,fs.readFileSync(r.nativeClip.file));assert.ok(new Set(rawOrigins).size>2);
 assert.equal(r.nativeClip.timeOrigin,r.recordingStart.timeOrigin);assert.notEqual(r.sourceRaf.timeOrigin,r.nativeClip.timeOrigin);assert.deepEqual(r.nativeClip.realm.started,r.recordingStart.realm);
 assert.equal(f.log.at(-1),'owner-dispose');assert.ok(f.log.indexOf('track-stop')<f.log.indexOf('owner-dispose'));
});
test('raw clocks, actualpaint, HP/stats, saved Recorder values and owner-chain faults stay fail closed',async()=>{
 const f=await strictRow(),baseline=f.row,bytes=fs.readFileSync(baseline.nativeClip.file);
 for(const mutate of [
  r=>r.samples[2].at=r.samples[1].at,
  r=>r.samples[2].simulationTime=r.samples[1].simulationTime-1,
  r=>r.samples[2].renders[0].jointDrawSucceeded=false,
  r=>r.samples[2].fighter.hp--,
  r=>r.samples[2].fighter.speed++,
  r=>r.release.afterTime++,
  r=>r.samples[2].realm.sequence=r.samples[1].realm.sequence,
  r=>r.samples[2].realm.ownerId=randomUUID(),
  r=>delete r.samples[2].realm,
 ]){
  const r=clone(baseline);mutate(r);assert.throws(()=>assertShardPostpaintContract(r,r.proof,r.boundary,r.release,r.samples));
 }
 for(const mutate of [
  r=>r.nativeClip.timeOrigin++,
  r=>delete r.sourceRaf.timeOrigin,
  r=>r.nativeClip.realm.started.sequence++,
  r=>r.sourceRaf.realm.started.ownerId=randomUUID(),
  r=>r.sourceRaf.realm.failure='Original RAF failure',
  r=>r.nativeClip.realm.finished.sequence=r.samples.at(-1).realm.sequence,
  r=>r.captureEnd.realm.sequence=r.sourceRaf.realm.stopped.sequence,
  r=>delete r.realmOwner,
 ]){
  const r=clone(baseline);mutate(r);assert.throws(()=>assertAllUnitClip(r,bytes));
 }
});

test('candidate browser callbacks contain no eval or Function construction, and LIMITS remain unchanged with twelve four-form shards',()=>{
 const serializable=[createNativeAllUnitRealmOwner,readNativeAllUnitRealmOwner,readNativeAllUnitSample,releasePreparedShardClock,
  startNativeCanvasClip,finishNativeCanvasClip,startNativeGameRafObservation,stopNativeGameRafObservation];
 for(const fn of serializable)assert.doesNotMatch(fn.toString(),/\beval\s*\(|\b(?:new\s+)?Function\s*\(/u);
 assert.equal(SHARDS.length,12);assert.equal(SHARDS.flatMap(s=>planShard(s.id)).length,432);
 assert.deepEqual(LIMITS,{jobMinutes:15,caseMs:30000,contextCloseMs:5000,readinessMs:5000,
  clipMs:15000,clipStopMs:3000,clipBytes:8388608,moveAttackSamples:15,engageSamples:30,
  sampleDelayMs:120,maxHistoryRows:128,sourceRafRows:4096});
});


function actualCaptureWithExternalControls({preparedFixture,assertMayo}={}){
 const calls=[],performanceRows=[];
 const external=label=>(()=>{calls.push(label);return{scope:'pure Node external-subcontract fixture; no native/acceptance'};});
 const env={assert,path,performance,LIMITS,assertPlannedCase,assertShardProof,hasPreparedAllUnitPaint:()=>true,
  createNativeAllUnitRealmOwner,readNativeAllUnitRealmOwner,startNativeGameRafObservation,stopNativeGameRafObservation,
  beginV177NativeCanvasClip,readNativeAllUnitSample,releasePreparedShardClock,postpaintCaptureBoundary,
  assertShardPostpaintContract,assertAllUnitClip,MANUAL_ABILITY_REGISTRY,
  ...(preparedFixture?{prepareCase:async()=>clone(preparedFixture)}:{}),
  assertMayoFeralReceipt:assertMayo,
  readFile:async file=>fs.readFileSync(file),
  assertV177AuthoredLiveRender:external('motion-damage-existing'),
  nativeGameDamageReceipt:external('normal-damage-existing'),
  nativeGamePerformanceReceipt:row=>{performanceRows.push(row);return external('performance-existing')();},
 };
 const source=proposed('v177-native-allunit-cases');
 const run=vm.runInNewContext((preparedFixture?'':declaration(source,'prepareCase'))+'\n'+declaration(source,'captureAllUnitCase')+'\ncaptureAllUnitCase',env);
 return{run,externalCalls:calls,performanceRows};
}
test('actual capture body creates owner after prepare, routes every sample/release through it and disposes last',async()=>{
 const f=fixture(),{run,externalCalls,performanceRows}=actualCaptureWithExternalControls(),original=f.page.evaluateHandle;
 f.page.evaluateHandle=async(fn,arg)=>{
  const h=await original(fn,arg);
  if(fn.name==='createNativeAllUnitRealmOwner')f.log.push('owner-create');
  return h;
 };
 await run(f.page,f.row,{out:path.join(fixtureDirectory,randomUUID())});
 assert.equal(f.row.status,'observed-diagnostic');assert.equal(f.row.samples.length,15);
 assert.deepEqual(externalCalls,['motion-damage-existing','normal-damage-existing','performance-existing','performance-existing']);
 assert.equal(performanceRows.length,2);assert.equal(performanceRows[0],f.row);
 assert.equal(performanceRows[0].samples,f.row.samples);assert.equal(f.row.samples.length,15);
 assert.equal(performanceRows[1].captureStart,f.row.captureStart);assert.equal(performanceRows[1].sourceRaf,f.row.sourceRaf);
 assert.equal(performanceRows[1].samples.length,1);assert.equal(performanceRows[1].samples[0],f.row.captureEnd);
 assert.ok(f.row.captureEnd.runtimePerformance,'Read actual post-finish counters in addition to the original window');
 assert.match(f.row.captureTailPerformanceReceipt.scope,/Separate.*original sample window.*unchanged/u);
 assert.ok(f.log.indexOf('prepare')<f.log.indexOf('owner-create'));
 assert.ok(f.log.indexOf('owner-create')<f.log.indexOf('recorder-start'));
 assert.ok(f.log.indexOf('recorder-start')<f.log.indexOf('release'));
 assert.equal(f.log.at(-1),'owner-dispose');assert.ok(f.log.indexOf('track-stop')<f.log.indexOf('owner-dispose'));
 assert.equal(f.row.postpaintReceipt.naturalnessAccepted,false);assert.equal(f.row.nativeClip.originalSpeedAccepted,false);
});

test('actual capture transfers large immutable samples only after recording, retaining the original source cadence',async()=>{
 const f=fixture({sampleTransportMs:800}),{run}=actualCaptureWithExternalControls();
 await run(f.page,f.row,{out:path.join(fixtureDirectory,randomUUID())});
 assert.equal(f.row.status,'observed-diagnostic');assert.equal(f.row.samples.length,LIMITS.moveAttackSamples);
 for(let i=0;i<f.row.samples.length;i++){
  const sample=f.row.samples[i],planned=f.row.captureStart.at+(i+1)*LIMITS.sampleDelayMs;
  assert.ok(sample.at>=planned&&sample.at<planned+.1);
  const timing=sample.readTiming;
  assert.equal(timing.sampleAt,planned);assert.ok(timing.startedAt>=planned);
  assert.ok(timing.scheduleLatenessMs>=0&&timing.scheduleLatenessMs<.1);
  const stages=['startedAt','snapshotAt','auditAt','targetAuditAt','phaseGAt','boundaryAt','finishedAt'];
  assert.ok(stages.every((key,j)=>Number.isFinite(timing[key])&&(j===0||timing[key]>=timing[stages[j-1]])));
  const rpc=f.row.sampleRpcTimings[i];assert.equal(rpc.index,i);assert.equal(rpc.sampleAt,planned);
  assert.equal(rpc.status,'completed');assert.ok(rpc.durationMs>=0);assert.equal(rpc.durationMs,rpc.finishedAt-rpc.startedAt);
  if(i)assertNativeRealmMember(f.row.samples[0].realm,sample.realm,'sample',f.row.samples[i-1].realm);
 }
 assert.ok(f.row.samples.at(-1).at-f.row.captureStart.at<1801);
 assert.ok(f.row.captureEnd.at-f.row.captureStart.at<1900);
 assert.equal(f.log.filter(s=>s==='sample-export').length,15);
 assert.ok(f.log.indexOf('track-stop')<f.log.indexOf('sample-export'));
 assert.ok(f.now>f.row.captureEnd.at+11999,'Large transport still happens after the unchanged capture boundary');
 assert.equal(f.log.includes('host-wait'),false);assert.equal(f.row.postpaintReceipt.distinctNewPaints,15);
 assert.equal(f.row.postpaintReceipt.naturalnessAccepted,false);
});

test('actual capture retains a late handle response time instead of fabricating the missed source schedule',async()=>{
 const f=fixture({sampleHandleTransportMs:180}),{run}=actualCaptureWithExternalControls();
 await run(f.page,f.row,{out:path.join(fixtureDirectory,randomUUID())});
 const last=f.row.samples.at(-1),planned=f.row.captureStart.at+LIMITS.moveAttackSamples*LIMITS.sampleDelayMs;
 assert.ok(last.at>planned+700);assert.equal(f.row.samples.length,LIMITS.moveAttackSamples);
 assert.ok(last.readTiming.scheduleLatenessMs>700,'Missed source schedule is reported without retiming it');
 assert.ok(f.row.samples.every(s=>s.at<=f.row.captureEnd.at));
 assert.equal(f.row.postpaintReceipt.naturalnessAccepted,false);
});

test('deferred sample data remains an immutable snapshot of nested geometry at its actual original read',async()=>{
 const f=fixture(),owner=await f.page.evaluateHandle(createNativeAllUnitRealmOwner),audit=f.qa.getEnemyFacingRuntimeAudit;
 const nested={weapon:{x:17,y:23},points:[{x:3,y:5}]};
 f.qa.getEnemyFacingRuntimeAudit=id=>{const result=audit(id);for(const paint of result.renderHistory??[])paint.jointWeaponCycle=nested;return result;};
 const stored=await owner.evaluateHandle(readNativeAllUnitSample,{...f.proof,immutableSnapshot:true});
 nested.weapon.x=999;nested.points[0].y=-999;
 const read=await stored.evaluate(value=>value);assert.deepEqual(read.renders[0].jointWeaponCycle,{weapon:{x:17,y:23},points:[{x:3,y:5}]});
 await stored.dispose();await owner.dispose();
});

test('Mayo orchestration fixes its full owner proof before slow post-recording transfer can expire the active window',async()=>{
 // Preparation, manual lifecycle and damage are separate subcontracts. This
 // pure fixture isolates the actual capture body's full-proof read ordering.
 const f=fixture({form:'mayo-chan-feral',sampleTransportMs:800});f.proof.proofGeneration=1;
 f.qa.releaseV177NativeMayoProof=()=>f.qa.setEnemyVfxProofPaused(false);
 f.qa.getV177NativeMayoProof=(_id,light)=>{
  if(light)return{proofId:f.proof.proofId,proofGeneration:1,simulationTick:1,manualAbility:{phase:'feral',activeRemaining:6.2-f.simulation}};
  f.log.push('mayo-full-proof');return{...clone(f.proof),ledger:[{phase:f.simulation<6.2?'feral':'expired',at:f.simulation}]};
 };
 let fixed;
 const {run}=actualCaptureWithExternalControls({preparedFixture:f.proof,assertMayo:(row,definition)=>{
  assert.equal(definition.activeSeconds,6.2);assert.equal(row.proof.ledger[0].phase,'feral');fixed=row.proof.ledger[0].at;
  assert.ok(f.simulation>6.2,'The later transport really crosses the active deadline');return{scope:'Orchestration only; no manual-owner acceptance'};
 }});
 await run(f.page,f.row,{out:path.join(fixtureDirectory,randomUUID())});
 assert.equal(f.row.status,'observed-diagnostic');assert.ok(fixed<6.2);
 assert.ok(f.log.indexOf('mayo-full-proof')<f.log.indexOf('sample-export'));
 assert.equal(f.row.samples.length,15);assert.equal(f.row.nativeClip.originalSpeedAccepted,false);
});

test('expiry while a source timer is pending cannot append that late sample or pass capture gates',async()=>{
 const f=fixture(),{run,externalCalls}=actualCaptureWithExternalControls(),schedule=f.globals.setTimeout;
 f.globals.setTimeout=(fn,ms,...args)=>{
  if(fn.name==='readNativeSampleOnSchedule')f.row.deadlineExpired=true;
  return schedule(fn,ms,...args);
 };
 await assert.rejects(run(f.page,f.row,{out:path.join(fixtureDirectory,randomUUID())}),/Late capture/u);
 assert.ok(f.row.captureStart);assert.equal(f.row.samples.length,0);assert.equal(f.row.status,'starting');
 assert.equal(f.row.interruptedClip.status,'invalid');assert.equal(externalCalls.length,0);
 assert.equal(f.streamStops,1);assert.equal(f.log.at(-1),'owner-dispose');
});
test('actual capture preserves original sample exception identity before partial clip/RAF/owner cleanup errors',async()=>{
 const f=fixture({failAtSample:2,cleanupFailure:true}),{run,externalCalls}=actualCaptureWithExternalControls(),failures=[];
 await assert.rejects(run(f.page,f.row,{out:path.join(fixtureDirectory,randomUUID()),onFailure:error=>{
  failures.push(error);f.log.push('original-failure');
 }}),error=>error===f.sentinel);
 assert.deepEqual(failures,[f.sentinel]);assert.equal(f.row.originalFailure,String(f.sentinel));
 assert.equal(f.row.interruptedClip.status,'invalid');assert.ok(f.row.interruptedClip.errors.includes('Sampling window interrupted'));
 assert.ok(f.row.cleanupErrors.some(s=>s.includes('Owner disposal failure')));assert.equal(externalCalls.length,0);
 assert.ok(f.log.indexOf('original-failure')<f.log.indexOf('recorder-stop'));assert.equal(f.log.at(-1),'owner-dispose');
 assert.equal(f.row.status,'starting');assert.ok(f.row.pausedCaptureStart);assert.equal(f.row.captureStart,undefined);
});
test('late successful sample cannot promote an expired capture and owner disposal still follows member cleanup',async()=>{
 const f=fixture(),{run,externalCalls}=actualCaptureWithExternalControls(),original=f.page.evaluateHandle;let reads=0;
 f.page.evaluateHandle=async(fn,arg)=>{
  const h=await original(fn,arg);
  if(fn.name==='createNativeAllUnitRealmOwner'){
   const evaluate=h.evaluate.bind(h);h.evaluate=async(fn,arg)=>{
    const result=await evaluate(fn,arg);
    if(fn.name==='readNativeAllUnitSample'&&++reads===2)f.row.deadlineExpired=true;
    return result;
   };
  }
  return h;
 };
 await assert.rejects(run(f.page,f.row,{out:path.join(fixtureDirectory,randomUUID())}),/Late capture/u);
 assert.equal(f.row.status,'starting');assert.equal(f.row.captureStart,undefined);assert.equal(f.row.samples.length,0);
 assert.equal(f.row.interruptedClip.status,'invalid');assert.ok(f.row.originalFailure.includes('Late capture'));
 assert.equal(externalCalls.length,0);assert.equal(f.log.at(-1),'owner-dispose');
});
test('owner disposal as the sole fault is a failure after completed fixture bytes and existing contracts',async()=>{
 const f=fixture({cleanupFailure:true}),{run,externalCalls}=actualCaptureWithExternalControls();
 await assert.rejects(run(f.page,f.row,{out:path.join(fixtureDirectory,randomUUID())}),/Owner disposal failure/u);
 assert.equal(f.row.nativeClip.status,'recorded');assert.ok(f.row.cleanupErrors.length);
 assert.equal(externalCalls.length,4);assert.equal(f.log.at(-1),'owner-dispose');
});
