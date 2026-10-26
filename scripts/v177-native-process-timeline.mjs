import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

export const PROCESS_TIMELINE_CASE='forms-2:gunner:engage:844x340';
export const PROCESS_TIMELINE_LIMITS=Object.freeze({intervalMs:200,childTimeoutMs:1500,closeWaitMs:250,maxSnapshots:150,maxErrors:16,maxBytes:4*1024*1024});

export function readOwnedNativeProcesses(file,args,{signal,spawnProcess=spawn,schedule=setTimeout,cancel=clearTimeout,
  now=Date.now,maxBuffer=1024*1024}={}){
  assert.equal(file,'/bin/ps');assert.ok([['-A','-o','pid=,ppid=,state=,time=,comm='],['-A','-ww','-o','pid=,ppid=,state=,time=,comm=']].some(a=>JSON.stringify(a)===JSON.stringify(args)));
  if(signal?.aborted)return Promise.reject(Object.assign(Error('Process observation owner is already closed'),{name:'AbortError'}));
  return new Promise((resolve,reject)=>{
    const child=spawnProcess(file,args,{stdio:['ignore','pipe','pipe'],windowsHide:true}),stdout=[],stderr=[];
    const observation={pid:child.pid??null,startedAtMs:now(),closeSeen:false,hardStop:null,code:null,signal:null};
    let bytes=0,finished=false,primary,timeout,closeTimer;
    const finish=()=>{
      if(finished)return;finished=true;cancel(timeout);cancel(closeTimer);signal?.removeEventListener('abort',abort);
      observation.finishedAtMs=now();child.stdout?.destroy();child.stderr?.destroy();
      if(!observation.closeSeen){child.unref?.();primary??=Error('Owned ps close was not confirmed within250ms of SIGKILL');}
      const receipt=structuredClone(observation);
      if(primary)reject(Object.assign(primary,{processObservation:receipt}));
      else resolve({stdout:Buffer.concat(stdout).toString('utf8'),stderr:Buffer.concat(stderr).toString('utf8'),processObservation:receipt});
    };
    const stop=error=>{
      if(finished||observation.hardStop)return;primary??=error;
      // Kill only the exact child handle created above, without a PID lookup or
      // broad process-name signal. Abort and timeout use the same hard stop.
      observation.hardStop={atMs:now(),signal:'SIGKILL',sent:false};
      try{observation.hardStop.sent=child.kill('SIGKILL');}catch(killError){observation.hardStop.error=String(killError).slice(0,500);}
      closeTimer=schedule(finish,PROCESS_TIMELINE_LIMITS.closeWaitMs);
    };
    const abort=()=>stop(Object.assign(Error('Process observation owner closed'),{name:'AbortError'}));
    const receive=target=>chunk=>{
      if(finished||observation.hardStop)return;bytes+=chunk.length;
      if(bytes>maxBuffer){stop(Error('Owned ps output exceeded its1MiB bound'));return;}target.push(Buffer.from(chunk));
    };
    child.stdout?.on('data',receive(stdout));child.stderr?.on('data',receive(stderr));
    child.once('error',error=>{primary??=error;if(!child.pid){observation.spawnFailed=true;observation.closeSeen=true;finish();}else stop(error);});
    child.once('close',(code,childSignal)=>{
      observation.closeSeen=true;observation.code=code;observation.signal=childSignal;
      if(code!==0&&!primary)primary=Error('Owned ps exited unsuccessfully: '+code+'/'+childSignal);finish();
    });
    timeout=schedule(()=>stop(Error('Owned ps exceeded its1500ms observation timeout')),PROCESS_TIMELINE_LIMITS.childTimeoutMs);
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  });
}

export function selectNativeProcessTimeline(selection,row){
  if(selection.mode==='ops-guardian-process-diagnostic')return /^ops-guardian-manual-844x340-[0-5]$/u.test(row.caseId);
  return selection.mode==='remaining'&&row.caseId===PROCESS_TIMELINE_CASE
    &&selection.caseIds.length===1&&selection.caseIds[0]===PROCESS_TIMELINE_CASE
    &&selection.manualCaseIds.length===0&&selection.outcomeCaseIds.length===0;
}

export function assertNativeProcessTimelineHost(env,platform,arch,opsDiagnostic=false){
  assert.equal(platform,'darwin');assert.equal(arch,'arm64');
  for(const [key,value]of Object.entries({GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'macOS',
    GITHUB_REPOSITORY:'SUSANO-OOO/Zombieee',GITHUB_EVENT_NAME:opsDiagnostic?'workflow_dispatch':'pull_request',GITHUB_JOB:opsDiagnostic?'f5-recorder-control':'capture',...(opsDiagnostic?{}:{V177_CAPTURE_SHARD:'forms-2'})}))
    assert.equal(env[key],value,'Native process observation is restricted to the owned ephemeral capture job: '+key);
  assert.match(env.GITHUB_RUN_ID??'',/^[1-9][0-9]*$/u);
  assert.match(env.GITHUB_RUN_ATTEMPT??'',/^[1-9][0-9]*$/u);
  assert.match(env.GITHUB_SHA??'',/^[a-f0-9]{40}$/u);
  assert.match(env.V177_EXPECTED_HEAD_SHA??'',/^[a-f0-9]{40}$/u);
}

// Keep the literal counter as well as its decoded value. ps %cpu is a lifetime
// average; a later reviewer must use differences of cumulative counters instead.
export function parseProcessCpuTime(value){
  const match=/^(?:(\d+)-)?(\d+(?::\d{2}){1,2})(?:\.(\d{1,6}))?$/u.exec(value);
  assert.ok(match,'Unknown ps cumulative CPU time: '+value);
  const parts=match[2].split(':').map(Number),count=parts.length,seconds=parts.pop(),minutes=parts.pop(),hours=parts.pop()??0;
  assert.ok(seconds<60&&(count===2||minutes<60));
  const ms=(((Number(match[1]??0)*24+hours)*60+minutes)*60+seconds)*1000+Number(('0.'+(match[3]??'0')))*1000;
  assert.ok(Number.isSafeInteger(ms)&&ms>=0);return ms;
}

export function parseNativeProcessRows(text){
  return text.split(/\r?\n/u).filter(line=>line.trim()).map(line=>{
    const match=/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.+?)\s*$/u.exec(line);
    assert.ok(match,'Unknown ps process row');
    const [,pid,ppid,state,cpuTime,comm]=match;
    return {pid:Number(pid),ppid:Number(ppid),state,cpuTime,cpuMs:parseProcessCpuTime(cpuTime),comm};
  });
}

export async function withNativeProcessTimeline(operation,{selection,row,out,binding,env=process.env,
  platform=process.platform,arch=process.arch,signal,run=readOwnedNativeProcesses,pause=delay,now=Date.now,monotonic=()=>Number(process.hrtime.bigint())/1e6}={}){
  if(!selectNativeProcessTimeline(selection,row))return operation();
  const opsDiagnostic=selection.mode==='ops-guardian-process-diagnostic';
  assertNativeProcessTimelineHost(env,platform,arch,opsDiagnostic);assert.equal(binding.head,env.V177_EXPECTED_HEAD_SHA);
  const controller=new AbortController(),snapshots=[],errors=[],ownedProcesses=[];
  const record={schema:'v177-native-process-timeline/v1',caseId:row.caseId,head:binding.head,runId:env.GITHUB_RUN_ID,
    runAttempt:env.GITHUB_RUN_ATTEMPT,host:{platform,arch},limits:PROCESS_TIMELINE_LIMITS,
    command:{file:'/bin/ps',args:['-A',...(opsDiagnostic?['-ww']:[]),'-o','pid=,ppid=,state=,time=,comm=']},
    ...(opsDiagnostic?{nodePid:process.pid,nodeTimeOrigin:performance.timeOrigin,diagnosticOnly:true,accepted:false}:{}),
    hostStartedAtMs:now(),monotonicStartedAtMs:monotonic(),snapshots,errors,ownedProcesses,attempts:0,limitReached:null,
    scope:'Read-only cumulative process CPU observations around one original case. No process settings, game clock, recording cadence, sample count, deadline or acceptance threshold changes. No profiler, frame filtering or retry.',
    originalSourceClockRequired:true,productVersusBrowserOsCauseResolved:false};
  let bytes=0,retainedBytes=Buffer.byteLength(JSON.stringify(record));
  const pushTracked=(list,value)=>{retainedBytes+=Buffer.byteLength(JSON.stringify(value))+(list.length?1:0);list.push(value);};
  const stop=()=>controller.abort();
  signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop();
  const worker=(async()=>{
    while(!controller.signal.aborted&&record.attempts<PROCESS_TIMELINE_LIMITS.maxSnapshots){
      // The count includes all three arrays and their commas, not only process
      // snapshots. Reserve8KiB for one bounded cleanup/error receipt and final
      // scalar fields, including an abort that races the last full snapshot.
      if(retainedBytes>PROCESS_TIMELINE_LIMITS.maxBytes-8192){record.limitReached='maxBytes';break;}
      record.attempts++;
      const sample={hostStartedAtMs:now(),monotonicStartedAtMs:monotonic()};
      try{
        const result=await run('/bin/ps',record.command.args,{encoding:'utf8',windowsHide:true,
          timeout:PROCESS_TIMELINE_LIMITS.childTimeoutMs,maxBuffer:1024*1024,signal:controller.signal});
        if(result.processObservation)pushTracked(ownedProcesses,result.processObservation);
        sample.hostFinishedAtMs=now();sample.monotonicFinishedAtMs=monotonic();
        sample.rows=parseNativeProcessRows(result.stdout);sample.rawOutputSha256=createHash('sha256').update(result.stdout).digest('hex');
        if(result.stderr.trim())sample.stderr=result.stderr;
        const size=Buffer.byteLength(JSON.stringify(sample));
        if(retainedBytes+size+(snapshots.length?1:0)>PROCESS_TIMELINE_LIMITS.maxBytes-8192){record.limitReached='maxBytes';break;}
        bytes+=size;pushTracked(snapshots,sample);
      }catch(error){if(error.processObservation)pushTracked(ownedProcesses,error.processObservation);
        if(controller.signal.aborted)break;pushTracked(errors,{hostAtMs:now(),name:error.name,message:String(error.message).slice(0,500),code:error.code??null});
        if(error.processObservation?.closeSeen===false){record.limitReached='unconfirmedProcessClose';break;}
        if(errors.length===PROCESS_TIMELINE_LIMITS.maxErrors){record.limitReached='maxErrors';break;}}
      try{await pause(PROCESS_TIMELINE_LIMITS.intervalMs,undefined,{signal:controller.signal});}catch(error){if(!controller.signal.aborted)throw error;}
    }
    if(record.attempts===PROCESS_TIMELINE_LIMITS.maxSnapshots)record.limitReached='maxSnapshots';
  })();
  // Finalize even when the original page RPC fails to settle after its owner
  // closes the context. The original case deadline remains its sole deadline.
  const finished=worker.then(async()=>{
    record.hostFinishedAtMs=now();record.monotonicFinishedAtMs=monotonic();record.sampleBytes=bytes;
    const file=path.join(out,opsDiagnostic?'process-timeline-'+row.caseId+'.json':'process-timeline-gunner-engage-844x340.json'),text=JSON.stringify(record)+'\n';
    assert.ok(Buffer.byteLength(text)<=PROCESS_TIMELINE_LIMITS.maxBytes);
    await writeFile(file,text,{flag:'wx'});
    row.nativeProcessTimeline={file,sha256:createHash('sha256').update(text).digest('hex'),snapshots:snapshots.length,
      errors:errors.length,limitReached:record.limitReached,readOnly:true,thresholdsOrDeadlinesChanged:false,
      ownedProcesses:ownedProcesses.length,unconfirmedProcessClose:ownedProcesses.filter(p=>!p.closeSeen).length};
    assert.equal(row.nativeProcessTimeline.unconfirmedProcessClose,0,'Owned ps cleanup was not confirmed; original capture gates do not override this diagnostic failure');
  });
  let observationError;finished.catch(error=>{observationError=error;row.nativeProcessTimelineError=String(error);});
  let primary,result;
  try{result=await operation();}catch(error){primary=error;}
  finally{stop();try{await finished;}catch(error){observationError=error;}signal?.removeEventListener('abort',stop);}
  if(primary)throw primary;if(observationError)throw observationError;return result;
}
