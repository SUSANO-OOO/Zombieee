import vm from 'node:vm';
import nodeTest from 'node:test';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';
import {assertGraphHostedPlatform,assertGraphEventBinding,graphClockEvidence,assertGraphObservation,GRAPH_LIMITS as L} from '../scripts/v177-native-aac-graph-contract.mjs';
import {buildGraphRoutes,makeGraphHandler,DI_WRAPPER,runGraphProbe} from '../scripts/v177-native-aac-graph-browser.mjs';
import {prepareGraphOutput,createGraphState,graphOutputForContext} from '../scripts/v177-native-aac-graph-output.mjs';
import {createPcmPacketFramer} from '../scripts/v177-graph-pcm-framer.mjs';

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
  pcm:[{}],pcmBytes:8192,packets:[{}],encodedBytes:10,finished:{status:'framed',snapshot:{partialFrames:0,acceptedFrames:1024}},inputFrames:1024,transportOverflow:0,pendingPcmPackets:0,peakPendingPcmPackets:0,peakEncoderQueue:1,peakPendingSegments:1,peakPendingBytes:100,
  events:[{event:'playing',ms:10,time:0}],playheads:[{ms:20,time:.02,encodedFrames:1024}],finalMedia:{muted:false,volume:1,time:1024/48000},content:{correlation:.99,rms:.1,peak:.4},cleanup:{completed:true}};}
class Target{constructor(){this.listeners=new Map();}addEventListener(n,f){const set=this.listeners.get(n)??new Set();set.add(f);this.listeners.set(n,set);}removeEventListener(n,f){this.listeners.get(n)?.delete(f);}emit(n,event={}){for(const f of this.listeners.get(n)??[])f(event);}}
function fakeEnvironment({rate=48000,playError=null,encoderQueue=0,omitConfig=false,deferInitialization=false,durationError=null}={}){
  const env=new Target(),clock={now:0},sent=[],encoded=[],nodes=[],durationChanges=[];let currentSource,audio;
  env.performance={now:()=>clock.now};env.matchMedia=()=>Object.assign(new Target(),{matches:false});
  env.URL={createObjectURL:s=>{currentSource=s;return'blob:owned';},revokeObjectURL:()=>{env.revoked=true;}};
  const doc=new Target();doc.visibilityState='visible';doc.body={appendChild:a=>{audio=a;}};doc.createElement=()=>{const a=new Target();Object.assign(a,{currentTime:0,duration:NaN,ended:false,readyState:4,paused:true,volume:1,muted:false,src:'',setAttribute(){},removeAttribute(){this.src='';},remove(){this.removed=true;},load(){if(this.src)queueMicrotask(()=>{currentSource.readyState='open';currentSource.emit('sourceopen');});},play(){if(playError)return Promise.reject(playError);this.paused=false;this.emit('playing');return Promise.resolve();},pause(){this.paused=true;this.emit('pause');}});return a;};env.document=doc;
  class Source extends Target{static isTypeSupported(){return true;}constructor(){super();this.readyState='closed';this.durationValue=NaN;}get duration(){return this.durationValue;}set duration(value){durationChanges.push({value,readyState:this.readyState,updating:this.buffer?.updating??null});if(durationError)throw durationError;this.durationValue=value;}addSourceBuffer(){this.buffer=new Target();let appends=0;Object.assign(this.buffer,{updating:false,appendBuffer:()=>{this.buffer.updating=true;if(++appends===1&&deferInitialization)return;queueMicrotask(()=>{this.buffer.updating=false;this.buffer.emit('updateend');});}});return this.buffer;}endOfStream(){this.readyState='ended';audio.ended=true;}}
  env.MediaSource=Source;
  env.AudioData=class{constructor(options){Object.assign(this,options);this.copied=new Float32Array(options.data);}close(){this.closed=true;}};
  env.AudioEncoder=class extends Target{static async isConfigSupported(config){return{supported:true,config};}constructor(callbacks){super();this.callbacks=callbacks;this.state='unconfigured';this.encodeQueueSize=encoderQueue;this.count=0;}configure(config){this.config=config;this.state='configured';}encode(data){assert.equal(data.closed,undefined);encoded.push(data.copied);const index=this.count++,description=new Uint8Array(rate===48000?[0x11,0x90]:[0x12,0x10]);this.callbacks.output({byteLength:4,timestamp:data.timestamp,duration:Math.round(1024/rate*1e6),type:'key',copyTo:d=>d.set([1,2,3,index%256])},index===0&&!omitConfig?{decoderConfig:{codec:'mp4a.40.2',sampleRate:rate,numberOfChannels:2,description}}:{});}async flush(){}close(){this.state='closed';}};
  env.AudioWorkletNode=class{constructor(context,name,options){this.options=options;this.port={onmessage:null,close(){this.closed=true;},postMessage:(message,transfer)=>{const copy=structuredClone(message,{transfer});sent.push(copy);if(copy.type==='finish')queueMicrotask(()=>this.port.onmessage?.({data:{type:'pcm-finished',generation:1,status:'framed',snapshot:{partialFrames:0,acceptedFrames:encoded.length*1024}}}));}};nodes.push(this);}disconnect(){this.disconnected=true;}};
  const context={sampleRate:rate,currentTime:0,state:'suspended',audioWorklet:{async addModule(url){assert.match(url,/worklet/u);}},createGain(){return{connect:node=>{this.connected=node;},disconnect(){this.disconnected=true;}};}};
  return{env,context,clock,sent,encoded,nodes,durationChanges,get audio(){return audio;},get source(){return currentSource;},completeInitialization(){currentSource.buffer.updating=false;currentSource.buffer.emit('updateend');},packet(index=0){const buffer=new ArrayBuffer(8192),values=new Float32Array(buffer);for(let i=0;i<values.length;i++)values[i]=Math.sin(i*.1)*.2;return{type:'pcm-packet',generation:1,id:index%4,packetIndex:index,sampleRate:rate,channels:2,numberOfFrames:1024,firstSourceFrame:65536+index*1024,timestampUs:Math.round(index*1024/rate*1e6),durationUs:Math.round((index+1)*1024/rate*1e6)-Math.round(index*1024/rate*1e6),buffer};}};
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
  overflow:s=>s.transportOverflow=1,encoderBacklog:s=>s.peakEncoderQueue=L.encoderQueue+1,pcmPoolBacklog:s=>s.peakPendingPcmPackets=L.pcmPoolPackets+1,undrainedPcm:s=>s.pendingPcmPackets=1,mseBacklog:s=>s.peakPendingBytes=L.pendingBytes+1,cleanup:s=>s.cleanup.completed=false,
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
  assert.equal(packet.buffer.byteLength,0,'Raw Worklet transfer must detach after retaining and AudioData copy');assert.deepEqual(output.evidence().pcmParts[0],original);assert.equal(state.pcmBytes,8192);assert.equal(state.inputFrames,1024);assert.equal(state.packets.length,1);assert.equal(state.primaryError,null);assert.equal(state.configurations[0].sampleRate,48000);await output.finish();await output.cleanup();assert.equal(state.finished.status,'framed');assert.equal(state.cleanup.completed,true);
});
test('PCM is returned before encoding and immediate Worklet reuse cannot change retained or encoded samples',async()=>{
  const f=fakeEnvironment(),state=createGraphState(),packet=f.packet(),original=new Float32Array(packet.buffer).slice();
  const Encoder=f.env.AudioEncoder;
  f.env.AudioEncoder=class extends Encoder{encode(data){
    assert.equal(packet.buffer.byteLength,0,'The native encoder cannot hold a scarce Worklet buffer');
    const returned=f.sent.find(row=>row.type==='recycle');assert.ok(returned);assert.equal(returned.id,packet.id);
    new Float32Array(returned.buffer).fill(.75);
    assert.deepEqual(data.copied,original,'AudioData must own the samples after the transferred Worklet buffer is reused');
    super.encode(data);
  }};
  const output=await prepareGraphOutput(f.context,{state,workletUrl:'/actual-worklet.mjs',env:f.env});await output.api.prepare();
  const ranges={length:7,start:i=>i*2,end:i=>i*2+1};f.audio.buffered=ranges;f.source.buffer.buffered=ranges;
  f.clock.now=22;f.nodes[0].port.onmessage({data:packet});
  assert.equal(state.primaryError,null);assert.deepEqual(f.encoded[0],original);
  assert.deepEqual(new Float32Array(output.evidence().pcmParts[0].buffer),original);
  assert.equal(state.pcm[0].recyclePostedAtMs,22);assert.equal(state.pcm[0].encodeCallAtMs,22);assert.equal(state.pcm[0].encodeReturnedAtMs,22);
  assert.deepEqual(state.playheads[0].audioBuffered,{length:7,ranges:[[0,1],[2,3],[4,5],[6,7]]});
  assert.deepEqual(state.playheads[0].sourceBuffered,state.playheads[0].audioBuffered);
  assert.equal(state.pcm[0].recycleAcknowledgedAtMs,undefined,'A sent transfer is not a Worklet ACK');
  await output.cleanup();
});

for(const stage of ['recycle','encode'])test('owned AudioData closes if '+stage+' throws after its copy',async()=>{
  const f=fakeEnvironment(),state=createGraphState(),original=new Error('original '+stage+' failure'),owned=[];let closes=0;
  const AudioData=f.env.AudioData,Encoder=f.env.AudioEncoder;
  f.env.AudioData=class extends AudioData{constructor(options){super(options);owned.push(this);}close(){closes++;super.close();}};
  if(stage==='encode')f.env.AudioEncoder=class extends Encoder{encode(){throw original;}};
  const output=await prepareGraphOutput(f.context,{state,workletUrl:'/actual-worklet.mjs',env:f.env});await output.api.prepare();
  if(stage==='recycle'){const post=f.nodes[0].port.postMessage;f.nodes[0].port.postMessage=(message,transfer)=>{if(message.type==='recycle')throw original;return post(message,transfer);};}
  const packet=f.packet();f.nodes[0].port.onmessage({data:packet});
  assert.match(state.primaryError,new RegExp('original '+stage+' failure'));assert.equal(closes,1);assert.equal(owned[0].closed,true);
  assert.equal(state.pcmBytes,8192);assert.equal(state.packets.length,0);assert.equal(f.encoded.length,0);
  assert.equal(packet.buffer.byteLength,stage==='encode'?0:8192);await output.cleanup();
});

test('live MSE duration is declared once after the metadata ACK while SourceBuffer is idle',async()=>{
  const f=fakeEnvironment({deferInitialization:true}),state=createGraphState();
  const preparing=prepareGraphOutput(f.context,{state,workletUrl:'/actual-worklet.mjs',env:f.env});
  for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.source.buffer.updating,true);assert.deepEqual(f.durationChanges,[]);
  f.completeInitialization();const output=await preparing;
  assert.deepEqual(f.durationChanges,[{value:Infinity,readyState:'open',updating:false}]);
  assert.equal(f.source.duration,Infinity);assert.equal(state.durationInitialization.assignedInfinity,true);
  assert.equal(state.durationInitialization.afterInitialization,'Infinity');assert.equal(state.pcm.length,0);
  await output.cleanup();
});
test('a native live-duration rejection preserves its original Error and releases the prewarmed resources',async()=>{
  const original=new Error('original duration assignment failure'),f=fakeEnvironment({durationError:original}),state=createGraphState();
  await assert.rejects(prepareGraphOutput(f.context,{state,workletUrl:'/actual-worklet.mjs',env:f.env}),error=>error===original);
  assert.match(state.primaryError,/original duration assignment failure/u);assert.equal(state.pcm.length,0);assert.equal(f.nodes.length,0);
  assert.equal(state.cleanup.completed,true);assert.equal(f.audio.removed,true);assert.equal(f.env.revoked,true);
});

test('native original play rejection identity and first error survive later callbacks',async()=>{
  const original=new Error('original native play failure');original.stack='nativePlay@/actual-output.mjs:12:34';
  const f=fakeEnvironment({playError:original}),state=createGraphState(),output=await prepareGraphOutput(f.context,{state,workletUrl:'/actual-worklet.mjs',env:f.env});graphOutputForContext(f.context,{});
  await assert.rejects(output.api.prepare(),error=>error===original);const first=state.primaryError;assert.match(first,/original native play failure/u);assert.match(first,/nativePlay@/u);output.fail(new Error('secondary'));assert.equal(state.primaryError,first);await output.cleanup();
});
test('actual output bounds waiting PCM and never fabricates encoding when the native queue stays full',async()=>{
 const f=fakeEnvironment({encoderQueue:4}),state=createGraphState(),output=await prepareGraphOutput(f.context,{state,workletUrl:'/actual-worklet.mjs',env:f.env});await output.api.prepare();
 for(let i=0;i<L.pcmPoolPackets;i++)f.nodes[0].port.onmessage({data:f.packet(i)});
 assert.equal(state.primaryError,null);assert.equal(state.pendingPcmPackets,16);assert.equal(state.packets.length,0);assert.equal(f.sent.filter(r=>r.type==='recycle').length,0);
 f.nodes[0].port.onmessage({data:f.packet(16)});assert.match(state.primaryError,/pending PCM pool exhausted/u);
 assert.equal(state.pcm.length,17);assert.equal(state.peakPendingPcmPackets,16);assert.equal(state.packets.length,0);await output.cleanup();
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
  const saturated=new Processor();for(let i=0;i<L.pcmPoolPackets*8;i++){globalThis.currentFrame=i*128;assert.equal(saturated.process([planes]),true);}globalThis.currentFrame=L.pcmPoolPackets*1024;assert.equal(saturated.process([planes]),false);assert.equal(saturated.messages.find(m=>m.type==='pcm-framing-error').code,'pcm-backpressure');
 }finally{restoreWorkletGlobals();}});
test('actual Worklet stops explicitly at the8s cap instead of silently extending collection',()=>{installWorkletGlobals();try{const p=new Processor(),planes=[new Float32Array(128),new Float32Array(128)];let last=0,result=true;while(result&&last<4000){globalThis.currentFrame=last*128;result=p.process([planes]);for(const m of p.messages.filter(m=>m.type==='pcm-packet'&&!m.recycled)){m.recycled=true;p.port.onmessage({data:{type:'recycle',generation:1,id:m.id,packetIndex:m.packetIndex,buffer:m.buffer}});}last++;}assert.equal(result,false);assert.equal(last,3000);assert.equal(p.messages.find(m=>m.type==='pcm-framing-error').code,'eight-second-capture-cap');}finally{restoreWorkletGlobals();}});
test('actual Worklet failure receipts survive host callback and raw JSON without changing PCM limits',async()=>{
 installWorkletGlobals();try{
  await import('../scripts/v177-native-aac-graph-worklet.mjs?failure-receipt-test');
  for(const code of ['pcm-backpressure','source-frame-gap-or-duplicate','invalid-recycle']){
   const processor=new Processor(),planes=[new Float32Array(128),new Float32Array(128)];
   if(code==='pcm-backpressure')for(let i=0;i<=L.pcmPoolPackets*8;i++){globalThis.currentFrame=i*128;processor.process([planes]);}
   else if(code==='source-frame-gap-or-duplicate'){globalThis.currentFrame=0;processor.process([planes]);globalThis.currentFrame=256;processor.process([planes]);}
   else{for(let i=0;i<8;i++){globalThis.currentFrame=i*128;processor.process([planes]);}processor.port.onmessage({data:{type:'recycle',generation:1,id:99,packetIndex:0,buffer:new ArrayBuffer(8192)}});}
   const packet=processor.messages.find(row=>row.type==='pcm-framing-error');assert.equal(packet.code,code);
   const f=fakeEnvironment(),state=createGraphState(),output=await prepareGraphOutput(f.context,{state,workletUrl:'/worklet.mjs',env:f.env});await output.api.prepare();
   f.clock.now=123;f.nodes[0].port.onmessage({data:packet});
   const saved=JSON.parse(JSON.stringify(state)).pcmFramingFailure;
   assert.deepEqual(saved,{receivedAtMs:123,generation:1,code,snapshot:packet.snapshot,secondary:false});
   assert.match(state.primaryError,new RegExp(code,'u'));assert.equal(state.status,'failed');assert.equal(state.pcm.length,0);
   assert.equal(saved.snapshot.poolPackets,L.pcmPoolPackets);assert(saved.snapshot.inFlightPackets<=L.pcmPoolPackets);assert(JSON.stringify(saved).length<4096);
   const first=state.pcmFramingFailure;f.nodes[0].port.onmessage({data:{...packet,code:'secondary'}});assert.equal(state.pcmFramingFailure,first);await output.cleanup();
  }
 }finally{restoreWorkletGlobals();}
});
test('framing evidence keeps the first owner fault bounded and ignores stale or disposed callbacks',async()=>{
 const f=fakeEnvironment(),state=createGraphState(),output=await prepareGraphOutput(f.context,{state,workletUrl:'/worklet.mjs',env:f.env});await output.api.prepare();
 const callback=f.nodes[0].port.onmessage,packet={type:'pcm-framing-error',generation:2,code:'x'.repeat(100000),snapshot:{arbitrary:{body:'x'.repeat(100000)},failure:{code:'y'.repeat(100000),message:'z'.repeat(100000),acceptedFrames:12}}};
 callback({data:packet});assert.equal(state.pcmFramingFailure,null);assert.match(state.primaryError,/Stale Worklet generation/u);const original=state.primaryError;
 callback({data:{...packet,generation:1}});const receipt=state.pcmFramingFailure;
 assert.equal(receipt.secondary,true);assert.equal(receipt.code.length,128);assert.equal(receipt.snapshot.failure.code.length,128);assert.equal(receipt.snapshot.failure.message.length,512);
 assert.equal(receipt.snapshot.arbitrary,undefined);assert(JSON.stringify(receipt).length<4096);assert.equal(state.primaryError,original);
 await output.cleanup();callback({data:{...packet,generation:1,code:'late'}});assert.equal(state.pcmFramingFailure,receipt);assert.equal(state.primaryError,original);
});

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
 const pageError=new Error('Original page encoder failure'),saveError=new Error('Original final report write failure'),fallbackError=new Error('Secondary fallback report write failure'),rawError=Object.assign(new Error('ENOENT raw.json interrupted upload'),{code:'ENOENT'}),launchError=new Error('Pinned hosted WebKit launch exceeded 15000ms'),lateCloseError=new Error('Secondary late browser close failure');
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
 const runtime=new vm.SyntheticModule(['webkit'],function(){this.setExport('webkit',{executablePath:()=>'/pinned/webkit-2359/Playwright',launch:options=>{calls.launch++;assert.equal(options.timeout,L.browserLaunchMs);return lateLaunch?new Promise(resolve=>setTimeout(()=>resolve(fakeBrowser),20)):Promise.resolve(fakeBrowser);}});},{context:sandbox});
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
driverTest('actual driver closes a late browser once within the named process budget without promoting the timed-out result',async()=>{const f=await actualDriverFault({lateLaunch:true});assert.equal(f.thrown,f.launchError);assert.equal(f.calls.launch,1);assert.equal(f.calls.close,1);assert.equal(f.calls.contextClose,0);assert.equal(f.canonical.status,'failed');assert.equal(f.late.ownership.status,'closed');assert.ok(f.calls.deadlines.some(row=>row.label==='Pinned hosted WebKit launch'&&row.ms===L.browserLaunchMs));assert.ok(f.calls.deadlines.some(row=>row.label==='Late owned browser cleanup'&&row.ms===2000));});
driverTest('actual driver late close failure is secondary, persisted, and cannot replace original timeout Error',async()=>{const f=await actualDriverFault({lateLaunch:true,lateCloseFailure:true});assert.equal(f.thrown,f.launchError);assert.equal(f.calls.close,1);assert.equal(f.canonical.status,'failed');assert.equal(f.late.ownership.status,'close-failed');assert.match(f.late.ownership.secondaryError,/Secondary late browser close failure/u);assert.match(f.late.primaryError,/launch exceeded 15000ms/u);});
test('selective PR workflow uses exact PR head plus manual fallback and keeps original single job controls',async()=>{
 const text=(await fs.readFile(new URL('../.github/workflows/native-aac-graph-probe.yml',import.meta.url),'utf8')).replaceAll('\r\n','\n');
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


// Execute the actual launch dispatch and original row-owner wrapper. Browser
// resources stay fake; the8 full-driver cases above own late-resource cleanup.
async function actualBrowserLaunch({guardAt=0,dispatchAt=guardAt,completeAt=dispatchAt,launchError=null}={}){
 const NL=String.fromCharCode(10),source=(await fs.readFile(new URL('../scripts/v177-native-aac-graph-browser.mjs',import.meta.url),'utf8')).replaceAll(String.fromCharCode(13),'');
 const lines=source.split(NL),bound=lines.filter(line=>line.startsWith('async function deadline(promise,ms,label){')),
  owner=lines.filter(line=>line.trimStart().startsWith('const step=(promise,label,max=L.rowDeadlineMs)=>'));
 assert.equal(bound.length,1);assert.equal(owner.length,1);
 const start=source.indexOf("    const launchState={status:'pending',resource:null},launchPromise="),end=source.indexOf(NL+'    let abandonedLaunch=',start);
 assert.ok(start>=0&&end>start&&end-start<1024);
 const statement=source.slice(start,end),calls={launches:[],timers:[],cleared:[]},clock={now:guardAt};
 const context=vm.createContext({assert,L,ownerDeadline:30000,Date:{now:()=>clock.now},
  setTimeout(_callback,ms){calls.timers.push(ms);clock.now=dispatchAt;return calls.timers.length;},
  clearTimeout(id){calls.cleared.push(id);},
  webkit:{launch(options){calls.launches.push({timeout:options.timeout,at:clock.now});clock.now=completeAt;
   return launchError?Promise.reject(launchError):Promise.resolve('owned fake browser');}}
 });
 const run=vm.runInContext([bound[0],owner[0],'(async()=>{',statement,
  "void launchPromise.catch(()=>{});return step(launchPromise,'Pinned hosted WebKit launch',L.browserLaunchMs);})"].join(NL),context);
 let value,error;try{value=await run();}catch(original){error=original;}
 return{calls,value,error};
}
test('actual process launch is capped by its named15s budget and the unchanged30s owner residual',async()=>{
 assert.equal(L.browserLaunchMs,15000);assert.equal(L.rowDeadlineMs,30000);assert.equal(L.readyMs,5000);
 for(const [guardAt,dispatchAt,expected]of [[0,0,15000],[29000,29000,1000],[29900,29950,50]]){
  const r=await actualBrowserLaunch({guardAt,dispatchAt});assert.equal(r.error,undefined);
  assert.equal(r.value,'owned fake browser');assert.equal(r.calls.launches.length,1);assert.equal(r.calls.launches[0].timeout,expected);
  assert.ok(r.calls.timers[0]<=15000&&r.calls.timers[0]<=30000-guardAt);assert.equal(r.calls.cleared.length,1);
 }
 const original=new Error('Original native process launch failure'),r=await actualBrowserLaunch({launchError:original});
 assert.equal(r.error,original);assert.equal(r.calls.launches.length,1);
});
test('actual process launch never dispatches after row expiry or passes an unbounded timeout0',async()=>{
 for(const guardAt of [30000,30001]){
  const r=await actualBrowserLaunch({guardAt});assert.match(String(r.error),/Original30s row deadline expired before/u);
  assert.equal(r.calls.launches.length,0);assert.equal(r.calls.timers.length,0);
 }
 for(const dispatchAt of [30000,30001]){
  const r=await actualBrowserLaunch({guardAt:29999,dispatchAt});assert.match(String(r.error),/Original30s row deadline expired before/u);
  assert.equal(r.calls.launches.length,0);assert.equal(r.calls.timers[0],1);assert.equal(r.calls.cleared.length,1);
 }
 const late=await actualBrowserLaunch({guardAt:29999,completeAt:30001});
 assert.match(String(late.error),/Late result cannot promote an expired row/u);
 assert.equal(late.calls.launches.length,1);assert.equal(late.calls.launches[0].timeout,1);
});


test('the named16-slot physical pool preserves raw words and rejects its first excess quantum',()=>{
 assert.equal(L.pcmPoolPackets,16);assert.equal(L.encoderQueue,4);
 const emitted=[],framer=createPcmPacketFramer({sampleRate:48000,channels:2,poolPackets:L.pcmPoolPackets,
  emitPacket:(packet,transfer)=>emitted.push(structuredClone(packet,{transfer}))});
 for(let i=0;i<16;i++){
  const planes=[new Float32Array(1024).fill((i+1)/32),new Float32Array(1024).fill(-(i+1)/32)];
  assert.equal(framer.push(planes,i*1024),true);
  assert.deepEqual(new Float32Array(emitted[i].buffer),Float32Array.from([...planes[0],...planes[1]]));
 }
 assert.equal(framer.snapshot().pcmPoolBytes,128*1024);assert.equal(framer.snapshot().inFlightPackets,16);
 assert.equal(framer.push([new Float32Array(128),new Float32Array(128)],16384),false);
 assert.equal(framer.snapshot().failure.code,'pcm-backpressure');assert.equal(framer.snapshot().acceptedFrames,16384);
 assert.throws(()=>createPcmPacketFramer({sampleRate:48000,poolPackets:17,emitPacket(){}}),/bounded framing/u);
 assert.equal(createPcmPacketFramer({sampleRate:48000,emitPacket(){}}).snapshot().poolPackets,4,'Generic default remains4');
});

function queuedEncoderEnvironment(){
 const f=fakeEnvironment({encoderQueue:4}),Encoder=f.env.AudioEncoder;const nativeRef={current:null};let flushes=0,maximum=0;
 f.env.AudioEncoder=class extends Encoder{
  constructor(callbacks){super(callbacks);nativeRef.current=this;}
  encode(data){assert.ok(this.encodeQueueSize<L.encoderQueue);super.encode(data);this.encodeQueueSize++;maximum=Math.max(maximum,this.encodeQueueSize);}
  async flush(){flushes++;await super.flush();}
 };
 return{f,get native(){return nativeRef.current;},get flushes(){return flushes;},get maximum(){return maximum;}};
}
test('native dequeue drains retained PCM in order without crossing encoder4 or copying its pool payload',async()=>{
 const q=queuedEncoderEnvironment(),{f}=q,state=createGraphState(),output=await prepareGraphOutput(f.context,{state,workletUrl:'/worklet.mjs',env:f.env});await output.api.prepare();
 const packets=[],original=[];
 for(let i=0;i<16;i++){const packet=f.packet(i);new Float32Array(packet.buffer).fill(i/32);packets.push(packet);original.push(new Float32Array(packet.buffer).slice());f.clock.now=i*23;f.nodes[0].port.onmessage({data:packet});}
 assert.equal(state.primaryError,null);assert.equal(state.pendingPcmPackets,16);assert.equal(f.encoded.length,0);
 assert.ok(packets.every(p=>p.buffer.byteLength===8192),'Waiting retains the original transferred buffers');
 for(let n=0;n<4;n++){f.clock.now=400+n*10;q.native.encodeQueueSize=0;q.native.emit('dequeue');await new Promise(resolve=>setImmediate(resolve));assert.equal(state.pendingPcmPackets,12-n*4);}
 assert.equal(q.maximum,4);assert.equal(state.peakPendingPcmPackets,16);assert.equal(state.primaryError,null);
 assert.equal(f.encoded.length,16);assert.ok(packets.every(p=>p.buffer.byteLength===0));
 assert.deepEqual(f.sent.filter(p=>p.type==='recycle').map(p=>p.packetIndex),Array.from({length:16},(_,i)=>i));
 for(let i=0;i<16;i++){assert.deepEqual(f.encoded[i],original[i]);assert.deepEqual(new Float32Array(output.evidence().pcmParts[i].buffer),original[i]);assert.equal(state.pcm[i].timestampUs,Math.round(i*1024/48000*1e6));}
 f.audio.currentTime=16*1024/48000;await output.finish();assert.equal(q.flushes,1);await output.cleanup();
});
test('finish waits for actual pending input before its single original2s encoder flush owner',async()=>{
 const q=queuedEncoderEnvironment(),{f}=q,state=createGraphState(),output=await prepareGraphOutput(f.context,{state,workletUrl:'/worklet.mjs',env:f.env});await output.api.prepare();
 for(let i=0;i<3;i++)f.nodes[0].port.onmessage({data:f.packet(i)});
 const finishing=output.finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(q.flushes,0);
 q.native.encodeQueueSize=0;q.native.emit('dequeue');f.audio.currentTime=3*1024/48000;
 await finishing;assert.equal(f.encoded.length,3);assert.equal(q.flushes,1);assert.equal(state.pendingPcmPackets,0);await output.cleanup();
});
test('native error while waiting rejects finish with the original identity and forbids late encoding',async()=>{
 const q=queuedEncoderEnvironment(),{f}=q,state=createGraphState(),output=await prepareGraphOutput(f.context,{state,workletUrl:'/worklet.mjs',env:f.env});await output.api.prepare();
 f.nodes[0].port.onmessage({data:f.packet()});const finishing=output.finish(),caught=finishing.catch(error=>error);
 await new Promise(resolve=>setImmediate(resolve));const original=new Error('Original pending native error');q.native.callbacks.error(original);
 assert.equal(await caught,original);q.native.encodeQueueSize=0;q.native.emit('dequeue');assert.equal(f.encoded.length,0);assert.equal(q.flushes,0);assert.match(state.primaryError,/Original pending native error/u);await output.cleanup();
});
test('disposed or expired input-drain owners cannot encode or flush on a late native dequeue',async()=>{
 for(const expired of [false,true]){
  const q=queuedEncoderEnvironment(),{f}=q,state=createGraphState(),output=await prepareGraphOutput(f.context,{state,workletUrl:'/worklet.mjs',env:f.env});await output.api.prepare();
  f.nodes[0].port.onmessage({data:f.packet()});const caught=output.finish().catch(error=>error);await new Promise(resolve=>setImmediate(resolve));
  if(expired)f.clock.now=2001;else await output.cleanup();q.native.encodeQueueSize=0;q.native.emit('dequeue');
  const error=await caught;assert.match(String(error),expired?/Original2s AAC input drain deadline expired/u:/disposed before drain/u);
  assert.equal(f.encoded.length,0);assert.equal(q.flushes,0);await output.cleanup();
 }
});


test('an encode crossing the drain deadline cannot recycle or encode the next queued packet',async()=>{
 const q=queuedEncoderEnvironment(),{f}=q,state=createGraphState(),output=await prepareGraphOutput(f.context,{state,workletUrl:'/worklet.mjs',env:f.env});await output.api.prepare();
 for(let i=0;i<2;i++)f.nodes[0].port.onmessage({data:f.packet(i)});
 const caught=output.finish().catch(error=>error);await new Promise(resolve=>setImmediate(resolve));
 const encode=q.native.encode.bind(q.native);q.native.encode=data=>{encode(data);f.clock.now=2001;};
 f.clock.now=1999;q.native.encodeQueueSize=0;q.native.emit('dequeue');
 assert.match(String(await caught),/Original2s AAC input drain deadline expired/u);assert.equal(f.encoded.length,1);
 assert.equal(f.sent.filter(row=>row.type==='recycle').length,1);assert.equal(state.pcm.length,2);assert.equal(q.flushes,0);await output.cleanup();
});
test('native flush resolution after the absolute owner deadline cannot publish final media before timer delivery',async()=>{
 const q=queuedEncoderEnvironment(),{f}=q,state=createGraphState(),output=await prepareGraphOutput(f.context,{state,workletUrl:'/worklet.mjs',env:f.env});await output.api.prepare();
 q.native.flush=async()=>{f.clock.now=2001;};
 await assert.rejects(output.finish(),/AAC flush owner expired or was cancelled/u);assert.equal(state.finalMedia,undefined);
 await output.cleanup();
});
