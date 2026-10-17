import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {request} from 'node:http';
import {PCM_ASSETS,PCM_STREAM,pcmWaveHeader,pcmByteRange,createPcmStream,startNativePcmOrigin} from '../scripts/v177-native-pcm-origin.mjs';
import {nativePcmClockEvidence} from '../scripts/v177-native-pcm-probe.mjs';
import {pcmProbeCases,evaluateNativePcm,runHostedNativePcmDiagnostic} from '../scripts/v177-native-pcm-browser.mjs';
import {assertNativeOpusHost} from '../scripts/v177-native-opus-probe.mjs';

const music=()=>new Float32Array(384000).fill(.2),effect=()=>new Float32Array(9600).fill(.3);
test('finite native WAV carries exactly4s of48k stereo16bit PCM with no fabricated codec clock',()=>{
  const b=pcmWaveHeader();assert.equal(b.length,44);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt32LE(4),768036);
  assert.equal(b.toString('ascii',8,16),'WAVEfmt ');assert.equal(b.readUInt16LE(20),1);assert.equal(b.readUInt16LE(22),2);
  assert.equal(b.readUInt32LE(24),48000);assert.equal(b.readUInt32LE(28),192000);assert.equal(b.readUInt16LE(32),4);
  assert.equal(b.readUInt16LE(34),16);assert.equal(b.readUInt32LE(40),768000);
  for(const value of [0,-1,Infinity,192001,1.5])assert.throws(()=>pcmWaveHeader(value));
});
test('all absolute byte ranges including tiny/non-frame-aligned/suffix queries retain exact bounds',()=>{
  const n=768044;for(const [value,start,end,status]of [[undefined,0,n-1,200],['bytes=0-1',0,1,206],['bytes=45-50',45,50,206],
    ['bytes=100-',100,n-1,206],['bytes=-2',n-2,n-1,206],['bytes=-999999',0,n-1,206],['bytes=768040-999999',768040,n-1,206]])
    assert.deepEqual(pcmByteRange(value,n),{start,end,status});
  for(const v of ['bytes=-0','bytes=-','bytes=1-0','bytes=768044-','bytes=0-1,4-5','foo','bytes=999999999999999999-'])assert.throws(()=>pcmByteRange(v,n));
});
test('trusted effect starts in the first ungenerated frame and never rewrites a served prefix',()=>{
  let now=0;const s=createPcmStream({music:music(),effect:effect(),mix:'bgm-se',now:()=>now});
  assert.equal(s.available(),44);assert.throws(()=>s.effect());s.start();assert.equal(s.frames(),480);
  for(let i=1;i<10;i++){now=i*10;s.tick();}const prefix=Buffer.from(s.bytes().subarray(0,s.available()));
  const cue=s.effect();assert.equal(cue.firstInputFrame,4800);assert.throws(()=>s.effect());now=100;s.tick();
  assert.ok(prefix.equals(s.bytes().subarray(0,prefix.length)));const b=s.bytes();
  assert.equal(b.readInt16LE(44+4799*4),Math.round(Math.fround(.2)*.18*32767));
  assert.equal(b.readInt16LE(44+4800*4),Math.round((Math.fround(.2)*.18+Math.fround(.3)*.5)*32767));
  assert.equal(s.snapshot().rows.length,11);assert.equal(s.snapshot().pcmSources.length,2);s.close();assert.throws(()=>s.tick());
});
test('invalid inputs and repeated/late producers cannot fabricate a complete PCM stream',()=>{
  const bad=music();bad[19]=NaN;assert.throws(()=>createPcmStream({music:bad,effect:effect()}));
  assert.throws(()=>createPcmStream({music:new Float32Array(2),effect:effect()}));
  const s=createPcmStream({music:music(),effect:effect(),variant:'static'});assert.throws(()=>s.tick());s.start();
  assert.equal(s.frames(),192000);assert.equal(s.snapshot().rows.length,400);assert.throws(()=>s.start());assert.throws(()=>s.tick());assert.throws(()=>s.effect());
});

const good=()=>({variant:'live',mix:'bgm-se',status:'complete',startTrusted:true,errors:[],cleanupErrors:[],activity:{realtimeAudioContextAttempts:0,microphoneAttempts:0},
  playheads:Array.from({length:401},(_,i)=>({ms:i*10,time:Math.max(0,i*10-30)/1000})),
  events:[{event:'playing',ms:30,time:0}],effect:{requestedAtMs:1000,trusted:true,server:{firstInputFrame:48000}},
  finalMedia:{time:4,duration:4,ended:true,playbackRate:1,muted:false,volume:1}});
const server=()=>({errors:[],stream:{complete:true,inputFrames:192000,rows:Array.from({length:400},(_,i)=>({ms:i*10,inputFrames:(i+1)*480}))}});
const content={duration:4,rms:.03,peak:.3,correlation:1,effectCorrelation:1,lagSamples:0};
test('native clock requires full original coverage, monotonic sampling and the unchanged150ms bound',()=>{
  const state=good(),owner=server();assert.equal(nativePcmClockEvidence(state,owner).accepted,true);
  const faults=[s=>{s.playheads=s.playheads.slice(0,100);},s=>{s.playheads=s.playheads.filter(r=>r.ms<1000||r.ms>2000);},
    s=>{s.playheads[190].time=0;},s=>{s.playheads[210].time=9;},s=>{s.playheads[215].ms=NaN;},
    s=>{s.playheads=s.playheads.slice(20);},s=>{s.playheads=s.playheads.slice(0,380);}];
  for(const fault of faults){const s=good();fault(s);assert.equal(nativePcmClockEvidence(s,owner).accepted,false);}
  const ahead=server();ahead.stream.rows[200].inputFrames+=48000;assert.equal(nativePcmClockEvidence(state,ahead).accepted,false);
  const staticState={...state,variant:'static'};assert.equal(nativePcmClockEvidence(staticState,ahead).producerAccepted,null);
});
test('missing SE, EOF, trusted input or content cannot be reported as a native or physical success',()=>{
  assert.equal(evaluateNativePcm(good(),server(),content).passed,true);
  for(const patch of [{finalMedia:{...good().finalMedia,ended:false}},{startTrusted:false},{effect:{...good().effect,trusted:false}},
    {effect:null},{activity:{realtimeAudioContextAttempts:1,microphoneAttempts:0}},{errors:['original failure']}]){
    const evidence=evaluateNativePcm({...good(),...patch},server(),content);assert.equal(evidence.passed,false);assert.equal(evidence.physicalRecordingAccepted,false);
  }
  assert.equal(evaluateNativePcm(good(),server(),{...content,effectCorrelation:0}).passed,false);
  assert.equal(evaluateNativePcm(good(),server(),{...content,correlation:0}).passed,false);
  const delayed=good();delayed.playheads=delayed.playheads.map(r=>({...r,time:Math.max(0,r.ms-100)/1000}));
  assert.equal(evaluateNativePcm(delayed,server(),{...content,lagSamples:4000}).passed,false,'positive decoded content lag must count toward the original150ms clock and SE budgets');
  assert.equal(pcmProbeCases().length,3);
});

test('HTTP HEAD/tiny/future/suffix/abort contracts do not start or advance the producer',async()=>{
  const sources=await Promise.all(PCM_ASSETS.map(a=>readFile('public'+a.source))),origin=await startNativePcmOrigin({sources,variant:'static',mix:'bgm'});
  try{
    const head=await fetch(origin.origin+'/stream.wav',{method:'HEAD',headers:{Range:'bytes=0-1'}});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),'768044');assert.equal((await head.arrayBuffer()).byteLength,0);
    const tiny=await fetch(origin.origin+'/stream.wav',{headers:{Range:'bytes=0-1'}});assert.equal(tiny.status,206);assert.equal(Buffer.from(await tiny.arrayBuffer()).toString(),'RI');
    assert.equal(origin.snapshot().stream,null);
    const future=new Promise((resolve,reject)=>{const req=request(origin.origin+'/stream.wav',{headers:{Range:'bytes=-6'}},res=>{
      assert.equal(res.statusCode,206);const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve(Buffer.concat(chunks)));});req.on('error',reject);req.end();});
    const aborted=request(origin.origin+'/stream.wav',{headers:{Range:'bytes=767000-'}},res=>{res.destroy();});aborted.on('error',()=>{});aborted.end();
    await new Promise(resolve=>setTimeout(resolve,20));assert.equal(origin.snapshot().stream,null);
    for(const [i,pcm]of [music(),effect()].entries()){const r=await fetch(origin.origin+'/pcm/'+i,{method:'POST',body:pcm});assert.equal(r.status,200);}
    const start=await fetch(origin.origin+'/start',{method:'POST'});assert.equal(start.status,200);await start.arrayBuffer();
    const tail=await future;assert.ok(tail.equals(origin.wav().subarray(-6)));
    const middle=await fetch(origin.origin+'/stream.wav',{headers:{Range:'bytes=45-50'}});assert.ok(Buffer.from(await middle.arrayBuffer()).equals(origin.wav().subarray(45,51)));
    const invalid=await fetch(origin.origin+'/stream.wav',{headers:{Range:'bytes=0-1,2-3'}});assert.equal(invalid.status,416);
    assert.equal(origin.snapshot().stream.rows.length,400);assert.equal(origin.snapshot().errors.length,0);
  }finally{await origin.close();}
  assert.equal(origin.snapshot().closing,true);
});
test('the hosted driver rejects local browser/audio invocation before opening any origin',async()=>{
  assert.throws(()=>assertNativeOpusHost('win32',{GITHUB_ACTIONS:'true'}),/local browser/u);
  if(process.platform!=='darwin'||process.env.GITHUB_ACTIONS!=='true')await assert.rejects(runHostedNativePcmDiagnostic,/local browser/u);
  const workflow=await readFile('.github/workflows/native-pcm-streaming.yml','utf8');
  assert.match(workflow,/macos-15-intel/u);assert.match(workflow,/cancel-in-progress: false/u);assert.doesNotMatch(workflow,/continue-on-error/u);
  assert.equal(PCM_STREAM.budgetMs,150);
});

test('the actual PCM driver refuses expired input after every pending native UI boundary',async t=>{
  // Execute the actual driver with inert native surfaces and an exact manual clock.
  const {createRequire}=await import('node:module'),path=await import('node:path'),{createHash}=await import('node:crypto');
  const ts=createRequire(import.meta.url)('typescript'),driver=await readFile(new URL('../scripts/v177-native-pcm-browser.mjs',import.meta.url),'utf8');
  const sha=b=>createHash('sha256').update(b).digest('hex');
const ast=ts.createSourceFile('fixed-driver.mjs',driver,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),declaration=name=>{const n=ast.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text===name);assert.ok(n,name);return n;};
const make=(name,b)=>new Function(...Object.keys(b),'return '+declaration(name).getText(ast).replace(/^export\s+/u,''))(...Object.values(b));
const guard=await import('../scripts/v177-native-opus-probe.mjs'),auditor=await import('../scripts/browser-request-failure-audit.mjs');
const originalBody=declaration('runHostedNativePcmDiagnostic').body.getText(ast).slice(1,-1),needle="await import('./pwa-browser-runtime.mjs')";assert.equal(originalBody.split(needle).length,2);const body=originalBody.replace(needle,'await mockRuntimeImport()'),AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
async function runLateInputFault(kind){
 let now=0,serial=0,contextIndex=0,settled=false;const timers=new Map(),events=[],saved=new Map(),acquire=deferred(),blocked=deferred(),close=deferred(),observation=deferred();const selected=kind==='fire'?2:0,acquireAt=kind==='goto'?25000:kind==='fire'?29500:20000;
 const flush=async()=>{for(let i=0;i<250;i++)await Promise.resolve();};
 const setTimeout=(fn,ms)=>{const token=++serial;timers.set(token,{at:now+ms,fn});return token;},clearTimeout=token=>timers.delete(token);
 const advance=async value=>{assert.ok(value>=now);for(;;){const due=[...timers.entries()].filter(([,t])=>t.at<=value).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;timers.delete(due[0]);due[1].fn();await flush();}now=value;await flush();};
 const withNativePcmDeadline=make('withNativePcmDeadline',{setTimeout,clearTimeout}),pcmProbeCases=make('pcmProbeCases',{});
 const stats={contextClose:0,originClose:0,browserClose:0},process={platform:'darwin',arch:'x64',version:'v24.inert',env:{GITHUB_ACTIONS:'true',RUNNER_OS:'macOS',GITHUB_EVENT_NAME:'pull_request',V177_EXPECTED_HEAD_SHA:'f456f153a8b83b048464dcc985810aa21ed1bba8',V177_NATIVE_PCM_OUT:'inert'},exitCode:0};
 function runNativePcmProbe(){};function analyseNativeAacContent(){};
 const context={async addInitScript(){},async close(){stats.contextClose++;events.push({event:'context-close-requested',at:now});return close.promise;},async newPage(){return page;}};
 const page={on(){},context:()=>context,async goto(_url,options){if(kind==='goto'){events.push({event:'goto-start',at:now,budget:options.timeout});await blocked.promise;assert.ok(now-acquireAt<options.timeout);events.push({event:'goto-end',at:now});}},async waitForFunction(_fn,_arg,options){if(kind==='ready'){events.push({event:'ready-start',at:now,budget:options.timeout});await blocked.promise;assert.ok(now-acquireAt<options.timeout);events.push({event:'ready-end',at:now});}},async waitForTimeout(ms){if(kind==='fire'){events.push({event:'fire-wait-start',at:now,budget:ms});await blocked.promise;assert.equal(now-acquireAt,ms);}},getByRole:(role,{name})=>({async click(){events.push({event:'trusted-click',at:now,role,name,afterOwnerDeadline:now>=30000});if(kind!=='fire'||name==='Fire existing rifle effect')observation.resolve({status:'complete'});}}),async evaluate(fn){if(fn===runNativePcmProbe){events.push({event:'probe-rpc',at:now});return observation.promise;}if(fn.toString().includes('dataset.probeReady')){if(kind==='ready-query'){events.push({event:'ready-query-start',at:now});await blocked.promise;events.push({event:'ready-query-end',at:now});}return true;}if(fn.toString().includes('__V177_NATIVE_PCM_STATE')){events.push({event:'partial-rpc',at:now});return{status:'starting'};}throw Error('Unexpected inert evaluation');}};
 const browser={version:()=>guard.NATIVE_OPUS_RUNTIME.browserVersion,on(){},async newContext(){const index=contextIndex++;if(index!==selected)throw Error('Inert nonselected context ends before any native input');events.push({event:'context-acquire-start',at:now});return acquire.promise;},async close(){stats.browserClose++;}};
 const acceptance=()=>({physicalRecordingAccepted:false,productionBackendAccepted:false,wholeGameAccepted:false,gameBackendChanged:false});
 const ClockDate=class extends Date {static now(){return now;}};
 const bindings={Date:ClockDate,assert,process,path,sha,acceptance,describe:e=>String(e?.message??e),assertNativeOpusHost:guard.assertNativeOpusHost,NATIVE_OPUS_RUNTIME:guard.NATIVE_OPUS_RUNTIME,NATIVE_OPUS_CONTEXT:guard.NATIVE_OPUS_CONTEXT,installNativeOpusGuard:guard.installNativeOpusGuard,installRequestFailureAudit:auditor.installRequestFailureAudit,PCM_ASSETS:[],withNativePcmDeadline,pcmProbeCases,runNativePcmProbe,analyseNativeAacContent,evaluateNativePcm(){throw Error('Expired owner must not reach success evaluation');},execFileSync(_cmd,args){return args[0]==='rev-parse'&&args[1]==='HEAD'?process.env.V177_EXPECTED_HEAD_SHA:'a'.repeat(40);},mkdir:async()=>{},readFile:async()=>Buffer.from('inert-source-pin'),writeFile:async(file,b)=>{const name=path.basename(file);assert.ok(!saved.has(name));saved.set(name,Buffer.from(b));},startNativePcmOrigin:async()=>({origin:'http://127.0.0.1:1',snapshot:()=>({stream:{complete:false,inputFrames:0,producedBytes:0},errors:[]}),wav:()=>Buffer.alloc(0),pcmSources:()=>[],async close(){stats.originClose++;}}),mockRuntimeImport:async()=>({PWA_WEBKIT_RUNTIME:guard.NATIVE_OPUS_RUNTIME,pwaBrowserType:async()=>({launch:async()=>browser})}),Buffer,console:{log(){},error(){}}};
 const task=new AsyncFunction(...Object.keys(bindings),body)(...Object.values(bindings)).then(r=>{settled=true;return r;});await flush();assert.equal(contextIndex,selected+1);
 await advance(acquireAt);acquire.resolve(context);await flush();assert.ok(events.some(e=>e.event===(kind==='goto'?'goto-start':kind==='ready'?'ready-start':kind==='ready-query'?'ready-query-start':'fire-wait-start')));
 await advance(30000);assert.ok(events.some(e=>e.event==='context-close-requested'));await advance(30500);blocked.resolve();await flush();
 const lateClicks=events.filter(e=>e.event==='trusted-click'&&e.afterOwnerDeadline);assert.equal(lateClicks.length,0,'Expired case must not send Start or Fire while native cleanup is still pending');
 await advance(32000);assert.equal(settled,true,'Failure and report must settle after bounded close');const report=await task;assert.equal(report.status,'failed');assert.equal(saved.has('report.json'),true);assert.equal(stats.browserClose,1);assert.equal(stats.originClose,3);assert.match(report.cases[selected].originalFailure,/30s case owner deadline/);close.resolve();await flush();
 return{kind,selectedCase:selected,virtualClock:'Exact original milliseconds; no real sleeps or native API.',acquireAt,originalOwnerDeadline:30000,pendingNativeClose:true,events,lateClicks,stats,originalFailure:report.cases[selected].originalFailure,finalFeasibility:report.cases[selected].feasibility,reportWritten:true,mockExitCode:process.exitCode};
}

  for(const kind of ['ready','goto','ready-query','fire'])await t.test(kind,async()=>{await runLateInputFault(kind);});
});
