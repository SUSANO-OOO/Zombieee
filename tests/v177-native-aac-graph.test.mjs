import vm from 'node:vm';
import nodeTest from 'node:test';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';
import {assertGraphHostedPlatform,assertGraphEventBinding,graphClockEvidence,assertGraphObservation,GRAPH_LIMITS as L} from '../scripts/v177-native-aac-graph-contract.mjs';
import {buildGraphRoutes,makeGraphHandler,DI_WRAPPER,runGraphProbe} from '../scripts/v177-native-aac-graph-browser.mjs';
import {prepareGraphOutput,createGraphState,graphOutputForContext} from '../scripts/v177-native-aac-graph-output.mjs';

// Only the8 actual-driver fault cases require VM modules. The standard project
// runner executes ordinary cases here and forwards these8 from one explicitly
// flagged pure child. Its child mode never registers ordinary cases, so none run twice.
const driverVmChild=process.env.V177_GRAPH_DRIVER_VM_CHILD==='1';
const hasDriverVm=typeof vm.SourceTextModule==='function'&&typeof vm.SyntheticModule==='function';
if(driverVmChild&&!hasDriverVm)throw new Error('Graph driver test child requires --experimental-vm-modules');
const test=driverVmChild?()=>{}:nodeTest;
const driverTestNames=[];let driverChildResult,driverChildLaunches=0;
function runDriverVmChild(){
 if(driverChildResult)return driverChildResult;
 assert.equal(driverVmChild,false,'Child may not recursively spawn itself');
 assert.equal(++driverChildLaunches,1,'Exactly one VM driver child');
 const env={...process.env,V177_GRAPH_DRIVER_VM_CHILD:'1'};delete env.NODE_TEST_CONTEXT;
 const child=spawnSync(process.execPath,['--experimental-vm-modules','--test','--test-reporter=tap',fileURLToPath(import.meta.url)],
   {cwd:process.cwd(),env,encoding:'utf8',timeout:10000,maxBuffer:1024*1024,windowsHide:true});
 const details=[child.error?.stack,child.stdout,child.stderr].filter(Boolean).join('\n');
 assert.equal(child.error,undefined,details);assert.equal(child.signal,null,details);assert.equal(child.status,0,details);
 const stdout=child.stdout??'',rows=[...stdout.matchAll(/^(not )?ok \d+ - (.+)$/gmu)].map(m=>({passed:!m[1],name:m[2]}));
 assert.equal(rows.length,8,details);assert.equal(driverTestNames.length,8);assert.equal(new Set(rows.map(row=>row.name)).size,8,details);
 assert.deepEqual(rows.map(row=>row.name).sort(),[...driverTestNames].sort(),details);
 assert(rows.every(row=>row.passed),details);assert.doesNotMatch(stdout,/# (?:SKIP|TODO)/u,details);
 assert.match(stdout,/^# tests 8$/mu,details);assert.match(stdout,/^# pass 8$/mu,details);assert.match(stdout,/^# fail 0$/mu,details);assert.match(stdout,/^# skipped 0$/mu,details);
 driverChildResult=new Map(rows.map(row=>[row.name,row]));return driverChildResult;
}
function driverTest(name,fn){
 driverTestNames.push(name);
 if(hasDriverVm)return nodeTest(name,fn);
 return nodeTest(name,t=>{const result=runDriverVmChild();assert.equal(result.get(name)?.passed,true,name);assert.equal(driverChildLaunches,1);if(name===driverTestNames[0])t.diagnostic('One flagged pure VM child executed all8 actual-driver faults;8pass0fail0skip.');});
}

const repo=process.env.V177_GRAPH_REPO??process.cwd();
const {nativeAacClockEvidence}=await import(pathToFileURL(path.join(repo,'scripts/v177-native-aac-probe.mjs')).href);
function valid(){return{status:'complete',errors:[],primaryError:null,sampleRate:48000,realtimeAudioContexts:1,mixerContextSame:true,warmDiagnostics:{contextCreateCount:1,contextTiming:{sampleRate:48000}},processorReady:{sampleRate:48000},startedFromTrustedWarmClick:true,
  initialization:{acknowledged:true,confirmedByActualMetadata:true},
  bgm:{trusted:true,assetId:'music-v100-score-normal',voiceId:'voice-1'},effect:{trusted:true,assetId:'weapon-rifle-01',voiceId:'voice-2',firstInputFrame:1,latencyMs:15},
  pcm:[{}],pcmBytes:8192,packets:[{}],encodedBytes:10,finished:{status:'framed',snapshot:{partialFrames:0,acceptedFrames:1024}},inputFrames:1024,transportOverflow:0,peakEncoderQueue:1,peakPendingSegments:1,peakPendingBytes:100,
  events:[{event:'playing',ms:10,time:0}],playheads:[{ms:20,time:.02,encodedFrames:1024}],finalMedia:{muted:false,volume:1,time:1024/48000},content:{correlation:.99,rms:.1,peak:.4},cleanup:{completed:true}};}
class Target{constructor(){this.listeners=new Map();}addEventListener(n,f){const set=this.listeners.get(n)??new Set();set.add(f);this.listeners.set(n,set);}removeEventListener(n,f){this.listeners.get(n)?.delete(f);}emit(n,event={}){for(const f of this.listeners.get(n)??[])f(event);}}
function fakeEnvironment({rate=48000,playError=null,encoderQueue=0,omitConfig=false,deferInitialization=false}={}){
  const env=new Target(),clock={now:0},sent=[],encoded=[],nodes=[];let currentSource,audio;
  env.performance={now:()=>clock.now};env.matchMedia=()=>Object.assign(new Target(),{matches:false});
  env.URL={createObjectURL:s=>{currentSource=s;return'blob:owned';},revokeObjectURL:()=>{env.revoked=true;}};
  const doc=new Target();doc.visibilityState='visible';doc.body={appendChild:a=>{audio=a;}};doc.createElement=()=>{const a=new Target();Object.assign(a,{currentTime:0,duration:NaN,ended:false,readyState:4,paused:true,volume:1,muted:false,src:'',setAttribute(){},removeAttribute(){this.src='';},remove(){this.removed=true;},load(){if(this.src)queueMicrotask(()=>{currentSource.readyState='open';currentSource.emit('sourceopen');});},play(){if(playError)return Promise.reject(playError);this.paused=false;this.emit('playing');return Promise.resolve();},pause(){this.paused=true;this.emit('pause');}});return a;};env.document=doc;
  class Source extends Target{static isTypeSupported(){return true;}constructor(){super();this.readyState='closed';this.duration=NaN;}addSourceBuffer(){this.buffer=new Target();let appends=0;Object.assign(this.buffer,{updating:false,appendBuffer:()=>{this.buffer.updating=true;if(++appends===1&&deferInitialization)return;queueMicrotask(()=>{this.buffer.updating=false;this.buffer.emit('updateend');});}});return this.buffer;}endOfStream(){this.readyState='ended';audio.ended=true;}}
  env.MediaSource=Source;
  env.AudioData=class{constructor(options){Object.assign(this,options);this.copied=new Float32Array(options.data);}close(){this.closed=true;}};
  env.AudioEncoder=class{static async isConfigSupported(config){return{supported:true,config};}constructor(callbacks){this.callbacks=callbacks;this.state='unconfigured';this.encodeQueueSize=encoderQueue;this.count=0;}configure(config){this.config=config;this.state='configured';}encode(data){assert.equal(data.closed,undefined);encoded.push(data.copied);const index=this.count++,description=new Uint8Array(rate===48000?[0x11,0x90]:[0x12,0x10]);this.callbacks.output({byteLength:4,timestamp:data.timestamp,duration:Math.round(1024/rate*1e6),type:'key',copyTo:d=>d.set([1,2,3,index%256])},index===0&&!omitConfig?{decoderConfig:{codec:'mp4a.40.2',sampleRate:rate,numberOfChannels:2,description}}:{});}async flush(){}close(){this.state='closed';}};
  env.AudioWorkletNode=class{constructor(context,name,options){this.options=options;this.port={onmessage:null,close(){this.closed=true;},postMessage:(message,transfer)=>{const copy=structuredClone(message,{transfer});sent.push(copy);if(copy.type==='finish')queueMicrotask(()=>this.port.onmessage?.({data:{type:'pcm-finished',generation:1,status:'framed',snapshot:{partialFrames:0,acceptedFrames:encoded.length*1024}}}));}};nodes.push(this);}disconnect(){this.disconnected=true;}};
  const context={sampleRate:rate,currentTime:0,state:'suspended',audioWorklet:{async addModule(url){assert.match(url,/worklet/u);}},createGain(){return{connect:node=>{this.connected=node;},disconnect(){this.disconnected=true;}};}};
  return{env,context,clock,sent,encoded,nodes,get audio(){return audio;},get source(){return currentSource;},completeInitialization(){currentSource.buffer.updating=false;currentSource.buffer.emit('updateend');},packet(index=0){const buffer=new ArrayBuffer(8192),values=new Float32Array(buffer);for(let i=0;i<values.length;i++)values[i]=Math.sin(i*.1)*.2;return{type:'pcm-packet',generation:1,id:index%4,packetIndex:index,sampleRate:rate,channels:2,numberOfFrames:1024,firstSourceFrame:65536+index*1024,timestampUs:Math.round(index*1024/rate*1e6),durationUs:Math.round((index+1)*1024/rate*1e6)-Math.round(index*1024/rate*1e6),buffer};}};
}
test('local Windows/Linux guards reject before repository/output/server/browser work',async()=>{
  for(const platform of ['win32','linux'])await assert.rejects(runGraphProbe({platform,env:{GITHUB_ACTIONS:'true',RUNNER_OS:'macOS',V177_GRAPH_EXPECTED_HEAD:'a'.repeat(40)},repo:'this-path-must-not-be-read'}),/Hosted macOS/u);
  assert.throws(()=>assertGraphHostedPlatform('darwin',{GITHUB_ACTIONS:'false',RUNNER_OS:'macOS',V177_GRAPH_EXPECTED_HEAD:'a'.repeat(40)}),/Hosted/u);
  assert.throws(()=>assertGraphHostedPlatform('darwin',{GITHUB_ACTIONS:'true',RUNNER_OS:'macOS',V177_GRAPH_EXPECTED_HEAD:'HEAD'}),/Exact40/u);
});
test('150ms arithmetic matches the unchanged original helper, including invalid/backward and boundary cases',()=>{
  const cases=[valid(),{sampleRate:48000,playheads:[]},{sampleRate:0,playheads:[]},...[150,150.00001,-150,-150.00001].map(delay=>({sampleRate:48000,playheads:[{ms:1000,time:(1000-delay)/1000,encodedFrames:48000}]})),{sampleRate:48000,playheads:[{ms:20,time:.02,encodedFrames:1024},{ms:19,time:.01,encodedFrames:2048}]},{sampleRate:48000,playheads:[{ms:NaN,time:0,encodedFrames:1024}]}];
  for(const value of cases)assert.deepEqual(graphClockEvidence(value),nativeAacClockEvidence(value));
});
test('clock/result contract accepts the finite positive control only within its narrow scope',()=>{const result=assertGraphObservation(valid());assert.equal(result.clock.budgetMs,150);assert.match(result.scope,/not accepted/u);});
const faults={startup:s=>s.events[0].ms=150.00001,lag:s=>s.playheads[0]={ms:200,time:.049,encodedFrames:9600},queued:s=>s.playheads[0]={ms:1,time:.001,encodedFrames:8192},effect:s=>s.effect.latencyMs=150.00001,
  fakeInput:s=>s.effect.trusted=false,wrongId:s=>s.effect.assetId='borrowed-rifle',missingVoice:s=>s.effect.voiceId=null,tail:s=>s.finished.status='partial-tail-retained-not-encoded',gap:s=>s.finished.snapshot.acceptedFrames=1025,
  overflow:s=>s.transportOverflow=1,encoderBacklog:s=>s.peakEncoderQueue=L.encoderQueue+1,mseBacklog:s=>s.peakPendingBytes=L.pendingBytes+1,cleanup:s=>s.cleanup.completed=false,
  synthetic:s=>s.realtimeAudioContexts=0,mixerContext:s=>s.mixerContextSame=false,rate:s=>s.sampleRate=96000,missingRaw:s=>s.pcm=[],error:s=>s.primaryError='original failure',content:s=>s.content.correlation=.7,
  initializationAck:s=>s.initialization.acknowledged=false,unconfirmedMetadata:s=>s.initialization.confirmedByActualMetadata=false};
for(const [name,mutate]of Object.entries(faults))test('fail-closed result fault '+name,()=>{const state=valid();mutate(state);assert.throws(()=>assertGraphObservation(state));});
test('raw route construction serves original bytes with only the audioOutput factory replaced; no listening socket',async()=>{
  const bundle=await buildGraphRoutes(repo,{requireExactHead:false});for(const name of ['audioMixer.js','audioManifest.js','audioSession.js','endingAudioMix.js'])assert.ok(bundle.routes.get('/__v177-aac-graph/app/'+name).bytes.equals(await fs.readFile(path.join(repo,'app',name))));
  assert.ok(bundle.routes.get('/__v177-aac-graph/app/audioOutput-original.js').bytes.equals(await fs.readFile(path.join(repo,'app/audioOutput.js'))));assert.equal(bundle.routes.get('/__v177-aac-graph/app/audioOutput.js').bytes.toString(),DI_WRAPPER);assert.equal(bundle.routes.get('/__v177-aac-graph/probe/v177-aac-fragment-muxer.mjs').bytes.toString(),await fs.readFile(path.join(repo,'scripts/v177-aac-fragment-muxer.mjs'),'utf8'));
  assert.equal(bundle.assets.filter(a=>a.id==='music-v100-score-normal').length,2);assert.equal(bundle.assets.filter(a=>a.id==='weapon-rifle-01').length,2);assert.equal(bundle.routes.has('/'),false);
  const log={requests:[],errors:[],artifacts:[]},handler=makeGraphHandler(bundle,'unused-output',log),parts=[];const response={writeHead(code){this.code=code;return this;},end(value){if(value)parts.push(Buffer.from(value));}};
  await handler({method:'GET',url:'/__v177-aac-graph/app/audioMixer.js'},response);assert.equal(response.code,200);assert.ok(Buffer.concat(parts).equals(await fs.readFile(path.join(repo,'app/audioMixer.js'))));
});
test('actual experimental output callback retains actual PCM and native AAC before transfer/recycle and uses no destination edge',async()=>{
  const f=fakeEnvironment(),state=createGraphState(),output=await prepareGraphOutput(f.context,{state,workletUrl:'/actual-worklet.mjs',env:f.env});const api=graphOutputForContext(f.context,{canPlay:()=>true});
  assert.equal(f.context.connected,f.nodes[0]);assert.ok(api.destination);assert.equal(f.nodes[0].options.numberOfOutputs,0);assert.equal(f.nodes[0].options.channelCountMode,'explicit');assert.equal(f.context.destination,undefined);
  await api.prepare();f.nodes[0].port.onmessage({data:{type:'pcm-processor-ready',generation:1,sampleRate:48000}});const packet=f.packet(),original=new Uint8Array(packet.buffer).slice();f.clock.now=22;f.context.currentTime=.022;f.audio.currentTime=.022;f.nodes[0].port.onmessage({data:packet});
  assert.equal(packet.buffer.byteLength,0,'Raw Worklet transfer must detach only after retaining/encoding');assert.deepEqual(output.evidence().pcmParts[0],original);assert.equal(state.pcmBytes,8192);assert.equal(state.inputFrames,1024);assert.equal(state.packets.length,1);assert.equal(state.primaryError,null);assert.equal(state.configurations[0].sampleRate,48000);await output.finish();await output.cleanup();assert.equal(state.finished.status,'framed');assert.equal(state.cleanup.completed,true);
});
test('native original play rejection identity and first error survive later callbacks',async()=>{
  const original=new Error('original native play failure'),f=fakeEnvironment({playError:original}),state=createGraphState(),output=await prepareGraphOutput(f.context,{state,workletUrl:'/actual-worklet.mjs',env:f.env});graphOutputForContext(f.context,{});
  await assert.rejects(output.api.prepare(),error=>error===original);const first=state.primaryError;output.fail(new Error('secondary'));assert.equal(state.primaryError,first);await output.cleanup();
});
test('actual output preserves an encoder queue fault and does not fabricate encoded success',async()=>{
  const f=fakeEnvironment({encoderQueue:4}),state=createGraphState(),output=await prepareGraphOutput(f.context,{state,workletUrl:'/actual-worklet.mjs',env:f.env});await output.api.prepare();f.nodes[0].port.onmessage({data:f.packet()});assert.match(state.primaryError,/queue exhausted/u);assert.equal(state.pcm.length,1);assert.equal(state.packets.length,0);await output.cleanup();
});
test('actual output retains encoded raw bytes even when decoder configuration is absent',async()=>{
  const f=fakeEnvironment({omitConfig:true}),state=createGraphState(),output=await prepareGraphOutput(f.context,{state,workletUrl:'/actual-worklet.mjs',env:f.env});await output.api.prepare();f.nodes[0].port.onmessage({data:f.packet()});assert.match(state.primaryError,/omitted decoder/u);assert.equal(state.packets.length,1);assert.equal(output.evidence().encodedParts[0].length,4);await output.cleanup();
});
test('actual unsupported rate fails before any fake browser primitive is constructed',async()=>{const f=fakeEnvironment({rate:96000});await assert.rejects(prepareGraphOutput(f.context,{state:createGraphState(),workletUrl:'/worklet.mjs',env:f.env}),/no resampling/u);assert.equal(f.nodes.length,0);});
let Processor;const originalGlobals=new Map();
function installWorkletGlobals(){for(const key of ['AudioWorkletProcessor','sampleRate','currentFrame','registerProcessor'])originalGlobals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));globalThis.sampleRate=48000;globalThis.currentFrame=0;
  globalThis.AudioWorkletProcessor=class{constructor(){this.messages=[];this.port={onmessage:null,postMessage:(data,transfer=[])=>this.messages.push(structuredClone(data,{transfer}))};}};globalThis.registerProcessor=(name,ctor)=>{assert.equal(name,'v177-graph-pcm-framer');Processor=ctor;};}
function restoreWorkletGlobals(){for(const [name,descriptor]of originalGlobals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
test('actual Worklet callback frames128-input quanta and finishes only at an exact1024 boundary',async()=>{installWorkletGlobals();try{await import('../scripts/v177-native-aac-graph-worklet.mjs');const p=new Processor({processorOptions:{generation:1}}),planes=[new Float32Array(128).fill(.1),new Float32Array(128).fill(-.1)];
  for(let i=0;i<9;i++){globalThis.currentFrame=i*128;assert.equal(p.process([planes]),true);}assert.equal(p.messages.filter(m=>m.type==='pcm-packet').length,1);const first=p.messages.find(m=>m.type==='pcm-packet');p.port.onmessage({data:{type:'recycle',generation:1,id:first.id,packetIndex:first.packetIndex,buffer:first.buffer}});p.port.onmessage({data:{type:'finish',generation:1}});
  for(let i=9;i<16;i++){globalThis.currentFrame=i*128;assert.equal(p.process([planes]),i===15?false:true);}const finish=p.messages.find(m=>m.type==='pcm-finished');assert.equal(finish.status,'framed');assert.equal(finish.snapshot.acceptedFrames,2048);assert.equal(finish.snapshot.partialFrames,0);
  const broken=new Processor();globalThis.currentFrame=0;assert.equal(broken.process([planes]),true);globalThis.currentFrame=256;assert.equal(broken.process([planes]),false);assert.match(broken.messages.find(m=>m.type==='pcm-framing-error').code,/gap/u);
  const saturated=new Processor();for(let i=0;i<32;i++){globalThis.currentFrame=i*128;assert.equal(saturated.process([planes]),true);}globalThis.currentFrame=4096;assert.equal(saturated.process([planes]),false);assert.equal(saturated.messages.find(m=>m.type==='pcm-framing-error').code,'pcm-backpressure');
 }finally{restoreWorkletGlobals();}});
test('actual Worklet stops explicitly at the8s cap instead of silently extending collection',()=>{installWorkletGlobals();try{const p=new Processor(),planes=[new Float32Array(128),new Float32Array(128)];let last=0,result=true;while(result&&last<4000){globalThis.currentFrame=last*128;result=p.process([planes]);for(const m of p.messages.filter(m=>m.type==='pcm-packet'&&!m.recycled)){m.recycled=true;p.port.onmessage({data:{type:'recycle',generation:1,id:m.id,packetIndex:m.packetIndex,buffer:m.buffer}});}last++;}assert.equal(result,false);assert.equal(last,3000);assert.equal(p.messages.find(m=>m.type==='pcm-framing-error').code,'eight-second-capture-cap');}finally{restoreWorkletGlobals();}});
test('proposal source keeps exact raw imports, trusted input, original cue APIs, clock owners and finite hosted workflow',async()=>{
  const base=new URL('../scripts/',import.meta.url),page=await fs.readFile(new URL('v177-native-aac-graph-page.mjs',base),'utf8'),driver=await fs.readFile(new URL('v177-native-aac-graph-browser.mjs',base),'utf8'),workflow=await fs.readFile(new URL('../.github/workflows/native-aac-graph-probe.yml',import.meta.url),'utf8');
  for(const text of [page,driver])assert.doesNotMatch(text,/\beval\s*\(|new Function\s*\(/u);assert.match(page,/enableAcknowledgementTone:false/u);assert.match(page,/mixer\.play\('music-v100-score-normal'\)/u);assert.match(page,/mixer\.play\('weapon-rifle-01'\)/u);assert.match(page,/voice\.startedAt/u);assert.doesNotMatch(page,/setSettings\(|\.connect\(.*destination/u);
  assert.match(workflow,/workflow_dispatch/u);assert.doesNotMatch(workflow,/schedule:|npm run build|cancel-in-progress: true/u);assert.match(workflow,/timeout-minutes: 15/u);assert.match(workflow,/macos-15-intel/u);assert.match(driver,/record\.revision,'2359'/u);assert.match(driver,/assertGraphHostedPlatform\(platform,env\)/u);
});
test('actual output bounds an obstructed MSE append queue and retains the raw failing prefix',async()=>{const f=fakeEnvironment(),state=createGraphState(),output=await prepareGraphOutput(f.context,{state,workletUrl:'/actual-worklet.mjs',env:f.env});await output.api.prepare();for(let index=0;index<L.pendingSegments+2;index++)f.nodes[0].port.onmessage({data:f.packet(index)});assert.match(state.primaryError,/MSE append queue exhausted/u);assert.equal(state.peakPendingSegments,8);assert.equal(state.pcm.length,L.pendingSegments+2);assert.equal(state.packets.length,L.pendingSegments+2);await output.cleanup();});

test('slow container initialization finishes before actual PCM starts, at both original native rates',async()=>{
  for(const rate of [44100,48000]){
    const f=fakeEnvironment({rate,deferInitialization:true}),state=createGraphState();
    const pending=prepareGraphOutput(f.context,{state,workletUrl:'/actual-worklet.mjs',env:f.env});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(f.source.buffer.updating,true);assert.equal(f.nodes.length,0);
    assert.equal(f.encoded.length,0);assert.equal(state.inputFrames,0);assert.equal(state.startedAt,null);
    assert.equal(state.peakPendingSegments,1);assert.equal(f.audio.paused,true);
    f.clock.now=384;f.completeInitialization();const output=await pending;
    assert.equal(state.initialization.acknowledged,true);assert.equal(state.initialization.acknowledgedAt,384);
    assert.equal(state.initialization.confirmedByActualMetadata,false);assert.equal(f.nodes.length,1);
    await output.api.prepare();assert.equal(state.startedAt,384);
    for(let i=0;i<13;i++){
      f.nodes[0].port.onmessage({data:f.packet(i)});await new Promise(resolve=>setImmediate(resolve));
    }
    assert.equal(state.inputFrames,13*1024);assert.equal(state.packets.length,13);
    assert.equal(state.initialization.confirmedByActualMetadata,true);assert.equal(state.primaryError,null);
    await output.cleanup();
  }
});

test('an initialization error fails before any actual encoder input or Worklet starts',async()=>{
  const f=fakeEnvironment({deferInitialization:true}),state=createGraphState();
  const pending=prepareGraphOutput(f.context,{state,workletUrl:'/actual-worklet.mjs',env:f.env});
  const rejected=assert.rejects(pending,/Native SourceBuffer error/u);
  await new Promise(resolve=>setImmediate(resolve));f.source.buffer.emit('error');await rejected;
  assert.equal(f.nodes.length,0);assert.equal(state.inputFrames,0);assert.equal(f.encoded.length,0);
  assert.equal(state.cleanup.completed,true);assert.equal(f.env.revoked,true);
});

test('manual and selective PR bindings require actual exact candidate/event head before owned setup',()=>{
 const head='a'.repeat(40),manual={GITHUB_EVENT_NAME:'workflow_dispatch',V177_GRAPH_EXPECTED_HEAD:head};assert.equal(assertGraphEventBinding(manual,head).exact,true);
 const pr={...manual,GITHUB_EVENT_NAME:'pull_request'},event={number:180,pull_request:{head:{sha:head}}};assert.equal(assertGraphEventBinding(pr,head,event).pullRequestNumber,180);
 for(const [env,actual,payload]of [[{...manual,GITHUB_EVENT_NAME:'push'},head,null],[manual,'b'.repeat(40),null],[pr,head,null],[pr,head,{...event,number:0}],[pr,head,{number:180,pull_request:{head:{sha:'b'.repeat(40)}}}]])assert.throws(()=>assertGraphEventBinding(env,actual,payload));
});
async function actualDriverFault({rawMissing=false,writeFailure=false,allFinalWritesFail=false,lateLaunch=false,lateCloseFailure=false,pageErrorObject=true,goodPage=false}={}){
 const source=await fs.readFile(new URL('../scripts/v177-native-aac-graph-browser.mjs',import.meta.url),'utf8'),begin=source.indexOf('export async function runGraphProbe('),end=source.indexOf('\nif(process.argv[1]',begin);assert.ok(begin>=0&&end>begin);
 const expected='a'.repeat(40),stored=new Map(),writes=[],calls={launch:0,close:0,contextClose:0,serverClose:0,partialRead:0,deadlines:[],console:[]};
 const pageError=new Error('Original page encoder failure'),saveError=new Error('Original final report write failure'),fallbackError=new Error('Secondary fallback report write failure'),rawError=Object.assign(new Error('ENOENT raw.json interrupted upload'),{code:'ENOENT'}),launchError=new Error('Pinned hosted WebKit launch exceeded 5000ms'),lateCloseError=new Error('Secondary late browser close failure');
 const virtualRepo=path.join(repo,'uncreated-pure-driver-fixture'),virtualOut=path.join(virtualRepo,'outputs/v177-native-aac-graph'),pageFailure=pageErrorObject?pageError:pageError.message;
 const fakePage={on(){},async goto(){},async waitForFunction(){},getByRole(){return{async click(){}};},async evaluate(fn){if(String(fn).includes('__graphState')){calls.partialRead++;return goodPage?valid():{status:'failed',primaryError:pageError.message,errors:[pageError.message]};}return goodPage?{status:'complete',primaryError:null}:{status:'failed',primaryError:pageFailure};}};
 const fakeContext={async newPage(){return fakePage;},async close(){calls.contextClose++;}};
 const fakeBrowser={version:()=> '26.6',async newContext(){return fakeContext;},async close(){calls.close++;if(lateCloseFailure)throw lateCloseError;}};
 const fakeServer={once(){return this;},listen(_port,_host,done){done();},address(){return{port:12345};},close(done){calls.serverClose++;done();},closeAllConnections(){}};
 const fakeFs={async readFile(file,encoding){const normalized=file.replaceAll('\\','/');let value;
   if(normalized.endsWith('playwright/package.json'))value=JSON.stringify({version:'1.63.0'});else if(normalized.endsWith('playwright-core/browsers.json'))value=JSON.stringify({browsers:[{name:'webkit',revision:'2359',browserVersion:'26.6'}]});
   else if(file===path.join(virtualOut,'raw.json')){if(rawMissing)throw rawError;value=JSON.stringify(goodPage?valid():{status:'failed',primaryError:pageError.message});}
   else if(stored.has(file))value=stored.get(file);else throw new Error('Unexpected pure fake read '+file);
   return encoding?String(value):Buffer.from(value);
 },async mkdir(){},async writeFile(file,bytes){const text=Buffer.isBuffer(bytes)?bytes.toString():String(bytes);writes.push(path.basename(file));if(file===path.join(virtualOut,'report.json')&&writeFailure)throw saveError;if(file===path.join(virtualOut,'report-failed.json')&&allFinalWritesFail)throw fallbackError;stored.set(file,text);}};
 const sandbox=vm.createContext({assert,fs:fakeFs,path,L,assertGraphHostedPlatform,assertGraphEventBinding,assertGraphObservation,Buffer,sha:b=>String(b.length),ROOT:'/__v177-aac-graph',HERE:path.join(repo,'unused-draft-scripts'),DI_WRAPPER:'pure wrapper fixture',
  git:(_repo,args)=>Buffer.from(args[0]==='diff'?'':expected),buildGraphRoutes:async()=>({head:expected,tree:'b'.repeat(40),sourcePins:[],assets:[],manifest:{bytes:2,sha256:'2'},routes:new Map([['/__v177-aac-graph/manifest.json',{bytes:Buffer.from('{}')} ]])}),
  deadline:async(promise,ms,label)=>{calls.deadlines.push({ms,label});if(lateLaunch&&label==='Pinned hosted WebKit launch')return await Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(launchError),5))]);return await promise;},
  createServer:()=>fakeServer,makeGraphHandler:()=>()=>{},pathToFileURL,Date,setTimeout:(fn,ms)=>setTimeout(fn,ms===1000?0:ms),clearTimeout,console:{error:value=>calls.console.push(String(value))}});
 const runtime=new vm.SyntheticModule(['webkit'],function(){this.setExport('webkit',{executablePath:()=>'/pinned/webkit-2359/Playwright',launch:options=>{calls.launch++;assert.equal(options.timeout,5000);return lateLaunch?new Promise(resolve=>setTimeout(()=>resolve(fakeBrowser),20)):Promise.resolve(fakeBrowser);}});},{context:sandbox});
 const audit=new vm.SyntheticModule(['installRequestFailureAudit'],function(){this.setExport('installRequestFailureAudit',()=>({report:{unexpectedFailures:[]},closeContext:c=>c.close()}));},{context:sandbox});
 const mod=new vm.SourceTextModule(source.slice(begin,end),{context:sandbox,identifier:'file:///actual-r2-runGraphProbe.mjs',importModuleDynamically:async specifier=>{const value=specifier.includes('playwright/index.mjs')?runtime:audit;if(value.status==='unlinked')await value.link(()=>{throw Error('No nested import');});if(value.status==='linked')await value.evaluate();return value;}});
 await mod.link(()=>{throw Error('No static import');});await mod.evaluate();let thrown;
 try{await mod.namespace.runGraphProbe({platform:'darwin',env:{GITHUB_ACTIONS:'true',RUNNER_OS:'macOS',GITHUB_EVENT_NAME:'workflow_dispatch',V177_GRAPH_EXPECTED_HEAD:expected},repo:virtualRepo});}catch(error){thrown=error;}
 if(lateLaunch)await new Promise(resolve=>setTimeout(resolve,50));
 const read=name=>{const text=stored.get(path.join(virtualOut,name));return text?JSON.parse(text):null;};
 return{thrown,pageError,saveError,fallbackError,rawError,launchError,lateCloseError,calls,writes,canonical:read('report.json'),progress:read('report-progress.json'),fallback:read('report-failed.json'),partial:read('partial-raw.json'),late:read('late-browser-cleanup.json')};
}
driverTest('actual driver preserves page Error identity over missing raw upload and retains partial/secondary evidence',async()=>{const f=await actualDriverFault({rawMissing:true});assert.equal(f.thrown,f.pageError);assert.equal(f.canonical.status,'failed');assert.match(f.canonical.rawReadFailure,/ENOENT/u);assert.match(f.canonical.primaryError,/Original page encoder failure/u);assert.doesNotMatch(f.canonical.primaryError,/ENOENT/u);assert.equal(f.partial.state.primaryError,f.pageError.message);});
driverTest('actual driver preserves serialized page error text over missing raw upload',async()=>{const f=await actualDriverFault({rawMissing:true,pageErrorObject:false});assert.equal(f.thrown.message,f.pageError.message);assert.equal(f.canonical.primaryError,f.pageError.message);assert.equal(f.canonical.status,'failed');});
driverTest('actual driver keeps true raw read Error identity when page reported no prior failure',async()=>{const f=await actualDriverFault({rawMissing:true,goodPage:true});assert.equal(f.thrown,f.rawError);assert.equal(f.canonical.status,'failed');assert.match(f.canonical.primaryError,/ENOENT/u);});
driverTest('actual driver final write failure is secondary to original page Error and cannot leave canonical running',async()=>{const f=await actualDriverFault({writeFailure:true});assert.equal(f.thrown,f.pageError);assert.equal(f.canonical,null);assert.equal(f.progress.terminal,false);assert.equal(f.progress.reportRole,'progress');assert.equal(f.fallback.status,'failed');assert.equal(f.fallback.terminal,true);assert.equal(f.fallback.persistenceErrors[0].secondary,true);assert.match(f.fallback.primaryError,/Original page encoder failure/u);assert.equal(f.partial.state.primaryError,f.pageError.message);});
driverTest('actual driver final write Error remains primary by identity if no earlier error occurred',async()=>{const f=await actualDriverFault({writeFailure:true,goodPage:true});assert.equal(f.thrown,f.saveError);assert.equal(f.fallback.status,'failed');assert.equal(f.fallback.persistenceErrors[0].secondary,false);assert.equal(f.canonical,null);});
driverTest('actual driver retains primary Error even when terminal and fallback persistence both fail',async()=>{const f=await actualDriverFault({writeFailure:true,allFinalWritesFail:true});assert.equal(f.thrown,f.pageError);assert.equal(f.canonical,null);assert.equal(f.fallback,null);assert.equal(f.progress.terminal,false);assert.ok(f.calls.console.some(row=>row.includes('terminal-report-persistence-failed')&&row.includes('Original page encoder failure')&&row.includes('Secondary fallback report write failure')));});
driverTest('actual driver closes a late browser once without extending the5s readiness or promoting the timed-out result',async()=>{const f=await actualDriverFault({lateLaunch:true});assert.equal(f.thrown,f.launchError);assert.equal(f.calls.launch,1);assert.equal(f.calls.close,1);assert.equal(f.calls.contextClose,0);assert.equal(f.canonical.status,'failed');assert.equal(f.late.ownership.status,'closed');assert.ok(f.calls.deadlines.some(row=>row.label==='Pinned hosted WebKit launch'&&row.ms===5000));assert.ok(f.calls.deadlines.some(row=>row.label==='Late owned browser cleanup'&&row.ms===2000));});
driverTest('actual driver late close failure is secondary, persisted, and cannot replace original timeout Error',async()=>{const f=await actualDriverFault({lateLaunch:true,lateCloseFailure:true});assert.equal(f.thrown,f.launchError);assert.equal(f.calls.close,1);assert.equal(f.canonical.status,'failed');assert.equal(f.late.ownership.status,'close-failed');assert.match(f.late.ownership.secondaryError,/Secondary late browser close failure/u);assert.match(f.late.primaryError,/launch exceeded 5000ms/u);});
test('selective PR workflow uses exact PR head plus manual fallback and keeps original single job controls',async()=>{
 const text=await fs.readFile(new URL('../.github/workflows/native-aac-graph-probe.yml',import.meta.url),'utf8');
 const paths=[...text.matchAll(/^      - '([^']+)'$/gmu)].map(match=>match[1]);
 assert.equal(paths.length,18);for(const name of ['.github/workflows/native-aac-graph-probe.yml','scripts/v177-native-aac-graph-*','scripts/v177-graph-pcm-framer.mjs','tests/v177-native-aac-graph.test.mjs','app/audioMixer.js','app/audioOutput.js','public/audio/v100/foley/rifle.mp3'])assert.ok(paths.includes(name));
 assert.ok(paths.every(name=>!['app/**','scripts/**','public/**','**'].includes(name)));assert.equal((text.match(/github\.event\.pull_request\.head\.sha \|\| inputs\.expected_head/gu)??[]).length,2);
 assert.match(text,/group: v177-one-prewarmed-native-audio-graph\n  cancel-in-progress: false/u);assert.match(text,/--experimental-vm-modules --test/u);assert.equal((text.match(/^  graph:/gmu)??[]).length,1);assert.doesNotMatch(text,/matrix:|schedule:|pull_request_target:/u);
});

// Execute the actual nested actionStep and actual3 trusted input statements.
// These Node VM mocks neither create a browser nor invoke game/media APIs.
async function actualTrustedAction({index=0,guardAt=0,dispatchAt=guardAt,completeAt=dispatchAt,actionError=null}={}){
 const text=(await fs.readFile(new URL('../scripts/v177-native-aac-graph-browser.mjs',import.meta.url),'utf8')).replaceAll('\r\n','\n');
 const lines=text.split('\n'),deadlineLines=lines.filter(line=>line.startsWith('async function deadline(promise,ms,label){'));
 assert.equal(deadlineLines.length,1,'one actual deadline definition');const bound=deadlineLines[0];
 const startMarker='  const actionStep=(action,label,max=L.readyMs)=>{',endMarker='\n  };\n  try{';
 assert.equal(text.split(startMarker).length,2,'one actual trusted-action wrapper');
 const start=text.indexOf(startMarker),end=text.indexOf(endMarker,start);
 assert.ok(end>start&&end-start<2048,'one bounded wrapper immediately before owned try');
 const wrapper=text.slice(start,end+'\n  };'.length).trimStart();
 const inputs=lines.filter(line=>line.trimStart().startsWith('await actionStep('));
 assert.equal(inputs.length,3);assert.equal(text.split("page.getByRole('button'").length,4);
 const input=/^\s*await actionStep\(timeout=>page\.getByRole\('button',\{name:'([^']+)',exact:true\}\)\.click\(\{timeout\}\),'([^']+)',L\.readyMs\);$/u;
 const matches=inputs.map(line=>{const match=input.exec(line);assert.ok(match,'one actual trusted click statement');return match;});
 assert.deepEqual(matches.map(match=>match[1]),['Warm original graph','Start original BGM','Fire original rifle']);
 assert.deepEqual(matches.map(match=>match[2]),['Trusted warm click','Trusted original BGM click','Trusted original rifle click']);
 const calls={locators:[],clicks:[],timers:[],cleared:[]},clock={now:guardAt},context=vm.createContext({
  L,assert,ownerDeadline:30000,Date:{now:()=>clock.now},
  setTimeout(_callback,ms){calls.timers.push(ms);clock.now=dispatchAt;return calls.timers.length;},
  clearTimeout(id){calls.cleared.push(id);},
  page:{getByRole(role,options){calls.locators.push({role,...options});return{click({timeout}){
   calls.clicks.push({name:options.name,timeout,at:clock.now});clock.now=completeAt;
   return actionError?Promise.reject(actionError):Promise.resolve('actual click result');
  }};}}
 });
 const run=vm.runInContext(bound+'\n'+wrapper+'\n(async()=>{'+inputs[index]+'})',context);
 let value,error;try{value=await run();}catch(original){error=original;}
 return{calls,value,error,sourceStatement:inputs[index]};
}
test('actual trusted warm/start/fire are lazy and dispatch0 inputs at or beyond the unchanged30s deadline',async()=>{
 for(let index=0;index<3;index++)for(const guardAt of [30000,30001]){
  const r=await actualTrustedAction({index,guardAt});assert.match(String(r.error),/Original30s row deadline expired before/u);
  assert.equal(r.calls.locators.length,0);assert.equal(r.calls.clicks.length,0);assert.equal(r.calls.timers.length,0);
 }
});
test('actual trusted input timeout uses remaining owner time capped by the original5s and preserves native Error identity',async()=>{
 const original=new Error('Original trusted input failure');
 for(let index=0;index<3;index++){
  for(const [guardAt,dispatchAt,expected]of [[0,0,5000],[29000,29000,1000],[29900,29950,50]]){
   const r=await actualTrustedAction({index,guardAt,dispatchAt});assert.equal(r.error,undefined);assert.equal(r.calls.clicks.length,1);
   assert.equal(r.calls.locators.length,1);assert.equal(r.calls.locators[0].role,'button');assert.equal(r.calls.locators[0].exact,true);
   assert.equal(r.calls.clicks[0].timeout,expected);assert(r.calls.timers[0]<=5000&&r.calls.timers[0]<=30000-guardAt);
   assert.equal(r.calls.cleared.length,1);
  }
  const r=await actualTrustedAction({index,actionError:original});assert.equal(r.error,original);assert.equal(r.calls.clicks.length,1);
 }
});
test('actual lazy dispatch crosses the deadline without input or unhandled rejection and rejects late completion',async()=>{
 const unhandled=[];const observe=error=>unhandled.push(error);process.on('unhandledRejection',observe);
 try{
  for(let index=0;index<3;index++)for(const dispatchAt of [30000,30001]){
   const r=await actualTrustedAction({index,guardAt:29999,dispatchAt});assert.match(String(r.error),/Original30s row deadline expired before/u);
   assert.equal(r.calls.locators.length,0);assert.equal(r.calls.clicks.length,0);assert.equal(r.calls.timers[0],1);assert.equal(r.calls.cleared.length,1);
  }
  for(let index=0;index<3;index++){
   const r=await actualTrustedAction({index,guardAt:29999,dispatchAt:29999,completeAt:30001});
   assert.match(String(r.error),/Late result cannot promote an expired row/u);assert.equal(r.calls.clicks.length,1);assert.equal(r.calls.clicks[0].timeout,1);
  }
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(unhandled,[]);
 }finally{process.removeListener('unhandledRejection',observe);}
});
