import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {assertNativeProcessTimelineHost,parseProcessCpuTime,parseNativeProcessRows,selectNativeProcessTimeline,
  withNativeProcessTimeline,readOwnedNativeProcesses,PROCESS_TIMELINE_CASE,MATERIAL_PROCESS_TIMELINE_CASES} from '../scripts/v177-native-process-timeline.mjs';
const env={GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'macOS',GITHUB_REPOSITORY:'SUSANO-OOO/Zombieee',
  GITHUB_EVENT_NAME:'pull_request',GITHUB_JOB:'capture',V177_CAPTURE_SHARD:'forms-2',GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'b'.repeat(40),V177_EXPECTED_HEAD_SHA:'a'.repeat(40)};
const selection={mode:'remaining',caseIds:[PROCESS_TIMELINE_CASE],manualCaseIds:[],outcomeCaseIds:[]};
const psArgs=['-A','-o','pid=,ppid=,state=,time=,comm='];

function ownedChild(){
  const child=new EventEmitter();child.pid=420;child.stdout=new PassThrough();child.stderr=new PassThrough();
  child.signals=[];child.kill=signal=>{child.signals.push(signal);return true;};child.unref=()=>{child.unreferenced=true;};return child;
}

test('abort hard-stops only its owned ps and waits for actual close',async()=>{
  const child=ownedChild(),owner=new AbortController(),timers=[];
  const pending=readOwnedNativeProcesses('/bin/ps',psArgs,{signal:owner.signal,spawnProcess:()=>child,
    schedule:(callback,ms)=>{const timer={callback,ms};timers.push(timer);return timer;},cancel:timer=>{if(timer)timer.cancelled=true;}});
  owner.abort();assert.deepEqual(child.signals,['SIGKILL']);
  let settled=false;pending.catch(()=>{settled=true;});await Promise.resolve();assert.equal(settled,false);
  child.emit('close',null,'SIGKILL');
  await assert.rejects(pending,error=>error.name==='AbortError'&&error.processObservation.closeSeen===true);
  assert.ok(timers.every(timer=>timer.cancelled));
});

test('timeout records an unconfirmed hard stop without waiting beyond its close budget',async()=>{
  const child=ownedChild(),timers=[];
  const pending=readOwnedNativeProcesses('/bin/ps',psArgs,{spawnProcess:()=>child,
    schedule:(callback,ms)=>{const timer={callback,ms};timers.push(timer);return timer;},cancel:timer=>{if(timer)timer.cancelled=true;}});
  timers.find(t=>t.ms===1500).callback();assert.deepEqual(child.signals,['SIGKILL']);
  timers.find(t=>t.ms===250).callback();
  let receipt;await assert.rejects(pending,error=>{receipt=error.processObservation;return receipt.closeSeen===false&&receipt.hardStop.sent===true;});
  assert.equal(child.unreferenced,true);assert.equal(child.stdout.destroyed,true);assert.equal(child.stderr.destroyed,true);
  child.emit('close',null,'SIGKILL');assert.equal(receipt.closeSeen,false,'late events cannot rewrite the bounded cleanup receipt');
});

test('an unconfirmed child close prevents any subsequent process observation',async()=>{
  const out=await mkdtemp(path.join(os.tmpdir(),'v177-process-unclosed-')),row={caseId:PROCESS_TIMELINE_CASE};let calls=0,release;
  const operation=new Promise(resolve=>{release=resolve;});
  const run=async()=>{calls++;throw Object.assign(Error('close not confirmed'),{processObservation:{pid:420,closeSeen:false,hardStop:{sent:true}}});};
  const pending=withNativeProcessTimeline(()=>operation,{selection,row,out,binding:{head:env.V177_EXPECTED_HEAD_SHA},env,platform:'darwin',arch:'arm64',run});
  for(let i=0;i<50&&!row.nativeProcessTimeline;i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(row.nativeProcessTimeline.limitReached,'unconfirmedProcessClose');assert.equal(calls,1);
  release();await assert.rejects(pending,/cleanup was not confirmed/u);
});

test('the sidecar byte bound includes owned process receipts and final metadata',async()=>{
  const out=await mkdtemp(path.join(os.tmpdir(),'v177-process-capacity-')),row={caseId:PROCESS_TIMELINE_CASE};let calls=0;
  const stdout=Array.from({length:220},(_,i)=>`${100+i} 1 S 0:01.04 /System/Library/Frameworks/Example Framework/Process ${i}\n`).join('');
  const run=async()=>({stdout,stderr:'',processObservation:{pid:420+calls++,startedAtMs:1792750000000,
    closeSeen:true,hardStop:null,code:0,signal:null,finishedAtMs:1792750000020}});
  let release;const operation=new Promise(resolve=>{release=resolve;});
  const pending=withNativeProcessTimeline(()=>operation,{selection,row,out,binding:{head:env.V177_EXPECTED_HEAD_SHA},env,
    platform:'darwin',arch:'arm64',run,pause:async()=>{},now:()=>1792750000000,monotonic:()=>123456.123456});
  for(let i=0;i<100&&!row.nativeProcessTimeline;i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.ok(row.nativeProcessTimeline);const raw=await readFile(row.nativeProcessTimeline.file),saved=JSON.parse(raw);
  assert.ok(raw.length<=4*1024*1024);assert.ok(saved.ownedProcesses.length>100);
  assert.equal(saved.limitReached,'maxBytes');assert.equal(saved.ownedProcesses.length,calls);
  release();await pending;
});

test('native process counters preserve macOS cumulative CPU units and command spaces',()=>{
  assert.equal(parseProcessCpuTime('0:01.04'),1040);assert.equal(parseProcessCpuTime('65:03.20'),3903200);
  assert.equal(parseProcessCpuTime('01:02:03.04'),3723040);assert.equal(parseProcessCpuTime('2-01:02:03.04'),176523040);
  assert.throws(()=>parseProcessCpuTime('x:02'));assert.throws(()=>parseProcessCpuTime('1:99.01'));
  assert.throws(()=>parseProcessCpuTime('0:99:01'));
  const rows=parseNativeProcessRows('  42 1 S 0:01.04 /Applications/WebKit WebProcess\n 43 42 R 01:02:03.04 /bin/ps\n');
  assert.equal(rows[0].comm,'/Applications/WebKit WebProcess');assert.equal(rows[1].cpuMs,3723040);
});

test('owner deadline abort stops observation while the page RPC is still unresolved',async()=>{
  const out=await mkdtemp(path.join(os.tmpdir(),'v177-process-owner-')),row={caseId:PROCESS_TIMELINE_CASE},owner=new AbortController();
  let release,started,aborted=false;
  const ready=new Promise(resolve=>{started=resolve;}),operation=new Promise(resolve=>{release=resolve;});
  const run=(_file,_args,{signal})=>new Promise((_resolve,reject)=>{started();signal.addEventListener('abort',()=>{aborted=true;reject(Error('aborted'));},{once:true});});
  const pending=withNativeProcessTimeline(()=>operation,{selection,row,out,binding:{head:env.V177_EXPECTED_HEAD_SHA},env,platform:'darwin',arch:'arm64',signal:owner.signal,run});
  await ready;owner.abort();
  for(let i=0;i<50&&!row.nativeProcessTimeline;i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(aborted,true);assert.ok(row.nativeProcessTimeline,'sidecar finalizes independently of the unresponsive page RPC');
  release('late completion');assert.equal(await pending,'late completion');
});

test('the original Gunner observer retains its singleton PR ownership',()=>{
  assert.equal(selectNativeProcessTimeline(selection,{caseId:PROCESS_TIMELINE_CASE}),true);
  for(const altered of [{...selection,mode:'full'},{...selection,caseIds:[PROCESS_TIMELINE_CASE,'other']},
    {...selection,outcomeCaseIds:['other']},{...selection,manualCaseIds:['other']}])
    assert.equal(selectNativeProcessTimeline(altered,{caseId:PROCESS_TIMELINE_CASE}),false);
  assertNativeProcessTimelineHost(env,'darwin','arm64');
  for(const [key]of Object.entries(env))assert.throws(()=>assertNativeProcessTimelineHost({...env,[key]:''},'darwin','arm64'));
  assert.throws(()=>assertNativeProcessTimelineHost(env,'win32','arm64'));
  assert.throws(()=>assertNativeProcessTimelineHost(env,'darwin','x64'));
});

test('material gap observers reject another case, partial inventory, event, shard or workflow head',()=>{
  const material={mode:'remaining',caseIds:[...MATERIAL_PROCESS_TIMELINE_CASES],manualCaseIds:[],outcomeCaseIds:[]};
  for(const caseId of MATERIAL_PROCESS_TIMELINE_CASES){
    assert.equal(selectNativeProcessTimeline(material,{caseId}),true);
    for(const altered of [{...material,mode:'full'},{...material,caseIds:[caseId]},
      {...material,caseIds:[...material.caseIds,PROCESS_TIMELINE_CASE]},
      {...material,caseIds:[caseId,caseId]},{...material,manualCaseIds:['other']},{...material,outcomeCaseIds:['other']}])
      assert.equal(selectNativeProcessTimeline(altered,{caseId}),false);
    const owned={...env,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_SHA:env.V177_EXPECTED_HEAD_SHA,V177_CAPTURE_SHARD:caseId.split(':')[0]};
    assertNativeProcessTimelineHost(owned,'darwin','arm64',caseId);
    for(const changed of [{GITHUB_EVENT_NAME:'pull_request'},{V177_CAPTURE_SHARD:'forms-9'},{GITHUB_SHA:'b'.repeat(40)}])
      assert.throws(()=>assertNativeProcessTimelineHost({...owned,...changed},'darwin','arm64',caseId));
  }
  assert.equal(selectNativeProcessTimeline(material,{caseId:PROCESS_TIMELINE_CASE}),false);
});

test('material observers retain their own clocks, CPU units and owned cleanup without replacing the operation',async()=>{
  const out=await mkdtemp(path.join(os.tmpdir(),'v177-material-process-'));
  const material={mode:'remaining',caseIds:[...MATERIAL_PROCESS_TIMELINE_CASES],manualCaseIds:[],outcomeCaseIds:[]};
  for(const caseId of MATERIAL_PROCESS_TIMELINE_CASES){
    const row={caseId},owned={...env,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_SHA:env.V177_EXPECTED_HEAD_SHA,V177_CAPTURE_SHARD:caseId.split(':')[0]};
    let started;const ready=new Promise(resolve=>{started=resolve;});
    const result=await withNativeProcessTimeline(async()=>{await ready;return 'original-result';},{selection:material,row,out,
      binding:{head:owned.V177_EXPECTED_HEAD_SHA},env:owned,platform:'darwin',arch:'arm64',
      run:async()=>{started();return {stdout:' 42 1 S 0:01.04 /Applications/WebKit WebProcess\n',stderr:'',
        processObservation:{pid:420,closeSeen:true,hardStop:null,code:0,signal:null}};}});
    assert.equal(result,'original-result');
    const saved=JSON.parse(await readFile(row.nativeProcessTimeline.file,'utf8'));
    assert.equal(saved.caseId,caseId);assert.equal(saved.nodeProcess.pid,process.pid);
    assert.ok(Number.isFinite(saved.nodeProcess.timeOrigin)&&Number.isFinite(saved.nodeFinishedAtMs));
    assert.ok(Number.isFinite(saved.nodeEventLoopDelta.idle)&&Number.isFinite(saved.nodeCpuDelta.user));
    assert.equal(saved.productVersusBrowserOsCauseResolved,false);
    assert.equal(row.nativeProcessTimeline.unconfirmedProcessClose,0);
    assert.equal(row.nativeProcessTimeline.thresholdsOrDeadlinesChanged,false);
  }
});

test('a failed case aborts its pending read-only child and retains the original failure',async()=>{
  const out=await mkdtemp(path.join(os.tmpdir(),'v177-process-timeline-')),row={caseId:PROCESS_TIMELINE_CASE},primary=Error('original case failed');
  let aborted=false,started;
  const ready=new Promise(resolve=>{started=resolve;});
  const run=(_file,_args,{signal})=>new Promise((_resolve,reject)=>{started();signal.addEventListener('abort',()=>{aborted=true;reject(Error('aborted'));},{once:true});});
  await assert.rejects(withNativeProcessTimeline(async()=>{await ready;throw primary;},
    {selection,row,out,binding:{head:env.V177_EXPECTED_HEAD_SHA},env,platform:'darwin',arch:'arm64',run}),error=>error===primary);
  assert.equal(aborted,true);const saved=JSON.parse(await readFile(row.nativeProcessTimeline.file,'utf8'));
  assert.deepEqual(saved.snapshots,[]);assert.equal(saved.productVersusBrowserOsCauseResolved,false);
  assert.equal(row.nativeProcessTimeline.thresholdsOrDeadlinesChanged,false);
});
