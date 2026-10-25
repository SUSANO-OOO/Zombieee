// ADHOC REFERENCE ONLY. No automatic entry point or production adoption.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,open,realpath,lstat,writeFile} from 'node:fs/promises';
import path from 'node:path';

const CASE='forms-4:mayo-chan:attack:1280x720';
const RUNTIME={packageVersion:'1.65.0-alpha-2026-10-23',revision:'2380',browserVersion:'27.2'};
const PS=['-A','-o','pid=,ppid=,uid=,lstart=,comm='];
const sha=b=>createHash('sha256').update(b).digest('hex');
const mono=()=>Number(process.hrtime.bigint())/1e6;
const inside=(root,file)=>{const r=path.relative(root,file);return r!==''&&!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r);};
const unavailable=reason=>Object.assign(Error(reason),{name:'DiagnosticUnavailable'});

// Same lifecycle shape as readOwnedNativeProcesses: signal ONLY the spawned
// observer handle; actual close<=250ms; frozen receipts; no next process after
// unconfirmed close. The original helper's literal ps whitelist is untouched.
function owned(file,args,{signal,timeoutMs,allowHelpExit=false}={}){
  assert.ok(file==='/bin/ps'||file==='/usr/bin/sample');
  if(file==='/bin/ps')assert.deepEqual(args,PS);
  else assert.ok(args.length===0||(args.length===5&&/^[1-9][0-9]*$/u.test(args[0])&&args[1]==='2'&&args[2]==='10'&&args[3]==='-file'&&path.isAbsolute(args[4])));
  if(signal?.aborted)return Promise.reject(Object.assign(Error('Original owner closed before spawn'),{name:'AbortError'}));
  return new Promise((resolve,reject)=>{
    const child=spawn(file,args,{shell:false,stdio:['ignore','pipe','pipe'],env:{...process.env,LC_ALL:'C',TZ:'UTC'},windowsHide:true});
    const receipt={file,args,pid:child.pid??null,startedAtMs:Date.now(),startedMonoMs:mono(),closeSeen:false,hardStop:null};
    const stdout=[],stderr=[];let bytes=0,finished=false,primary,timer,closeTimer;
    const finish=()=>{
      if(finished)return;finished=true;clearTimeout(timer);clearTimeout(closeTimer);signal?.removeEventListener('abort',abort);
      receipt.finishedAtMs=Date.now();receipt.finishedMonoMs=mono();
      child.stdout?.destroy();child.stderr?.destroy();
      if(!receipt.closeSeen){child.unref();primary??=unavailable('Owned observer close unconfirmed');}
      if(receipt.finishedMonoMs-receipt.startedMonoMs>=timeoutMs)primary??=unavailable('Observer completed after its absolute deadline');
      const frozen=structuredClone(receipt),result={receipt:frozen,stdout:Buffer.concat(stdout).toString(),stderr:Buffer.concat(stderr).toString()};
      if(primary)reject(Object.assign(primary,{ownedResult:result}));else resolve(result);
    };
    const stop=error=>{
      if(finished||receipt.hardStop)return;primary??=error;
      receipt.hardStop={atMs:Date.now(),signal:'SIGKILL',sent:false};
      try{receipt.hardStop.sent=child.kill('SIGKILL');}catch(e){receipt.hardStop.error=String(e).slice(0,500);}
      closeTimer=setTimeout(finish,250);
    };
    const abort=()=>stop(Object.assign(Error('Original owner completed/failed/expired'),{name:'AbortError'}));
    const receive=list=>chunk=>{if(finished||receipt.hardStop)return;bytes+=chunk.length;if(bytes>1048576){stop(unavailable('Observer stdout/stderr exceeded1MiB'));return;}list.push(Buffer.from(chunk));};
    child.stdout?.on('data',receive(stdout));child.stderr?.on('data',receive(stderr));
    child.once('error',e=>stop(e));
    child.once('close',(code,signalName)=>{
      if(finished)return;receipt.closeSeen=true;receipt.code=code;receipt.signal=signalName;
      if(code!==0&&!(allowHelpExit&&file==='/usr/bin/sample'&&args.length===0&&code===255))primary??=unavailable('Observer exit '+code+'/'+signalName);
      finish();
    });
    timer=setTimeout(()=>stop(unavailable('Observer wall timeout')),timeoutMs);
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  });
}

function parsePs(text){
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return text.split(/\r?\n/u).filter(s=>s.trim()).map(line=>{
    const m=/^\s*(\d+)\s+(\d+)\s+(\d+)\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4}))\s+(.+)\s*$/u.exec(line);
    assert.ok(m,'Unknown ps UID/lstart/comm format');
    const [,pid,ppid,uid,startRaw,month,day,hour,minute,second,year,comm]=m;
    const startMs=Date.UTC(+year,months.indexOf(month),+day,+hour,+minute,+second);
    const d=new Date(startMs);assert.ok(months.indexOf(month)>=0&&d.getUTCFullYear()===+year&&d.getUTCMonth()===months.indexOf(month)&&d.getUTCDate()===+day&&+hour<24&&+minute<60&&+second<60);
    return {pid:+pid,ppid:+ppid,uid:+uid,startRaw,startMs,startPrecisionMs:1000,comm:comm.trim()};
  });
}

export async function prepareMayoOwnedSample({out,selection,binding,browserType,runtime,signal:lifecycleSignal,env=process.env}={}){
  out=path.resolve(out);assert.ok(inside(process.cwd(),out),'Diagnostic output must stay in this workspace');
  await mkdir(out); // exclusive new subdirectory; never replace an earlier attempt
  const record={schema:'native-mayo-owned-sample/adhoc-v1',caseId:CASE,status:'preflight',runtime,
    head:binding?.head,runId:env.GITHUB_RUN_ID,runAttempt:env.GITHUB_RUN_ATTEMPT,
    host:{platform:process.platform,arch:process.arch,runnerArch:env.RUNNER_ARCH,imageOS:env.ImageOS,imageVersion:env.ImageVersion},
    requestedSample:{seconds:2,intervalMs:10,attempts:1,wallMs:10000,closeMs:250},
    originalCase:{caseMs:30000,samples:15,sampleDelayMs:120,mime:'video/webm;codecs=vp8',captureHz:60,clipBytes:8388608},
    diagnosticOnly:true,formalAccepted:false,releaseAccepted:false,exactPagePid:false,
    ownershipScope:'new pinned WebContent observed only after this browser launch in one single-job ephemeral GitHub VM',
    commands:[],errors:[],ps:{},sampler:null,rawSample:null,unconfirmedClose:false};
  const receiptFile=path.join(out,'receipt.json'),rawFile=path.join(out,'sample.txt');
  let baseline=[],target=null,caseDone=null,used=false;
  const persist=()=>writeFile(receiptFile,JSON.stringify(record,null,2)+'\n');
  const command=async(label,file,args,options)=>{
    if(record.unconfirmedClose)throw unavailable('Previous observer close unconfirmed');
    let result;
    try{result=await owned(file,args,options);return result;}
    catch(e){result=e.ownedResult;throw e;}
    finally{if(result){record.commands.push(result.receipt);if(!result.receipt.closeSeen)record.unconfirmedClose=true;
      const raw=result.stdout+'\n--- STDERR ---\n'+result.stderr;
      const file=path.join(out,label+'.txt');await writeFile(file,raw,{flag:'wx'});
      record[label]={file,bytes:Buffer.byteLength(raw),sha256:sha(raw)};await persist();}}
  };
  const ps=async(label,signal)=>{
    const result=await command(label,'/bin/ps',PS,{signal,timeoutMs:1500});
    const rows=parsePs(result.stdout);record.ps[label]={rows:rows.length,uid:process.getuid(),timezone:'TZ=UTC',locale:'LC_ALL=C'};
    const candidates=[];
    for(const row of rows.filter(r=>/^(?:WebKitWebProcess|com\.apple\.WebKit\.WebContent(?:\.Development)?)$/u.test(path.basename(r.comm)))){
      if(!path.isAbsolute(row.comm))throw unavailable('WebContent comm is not an absolute executable path');
      const executable=await realpath(row.comm);
      if(inside(record.bundleRoot,executable))candidates.push({...row,executable});
    }
    record.ps[label].candidates=candidates;await persist();return {rows,candidates};
  };
  try{
    assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');
    for(const [key,value]of Object.entries({GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'macOS',RUNNER_ARCH:'ARM64',GITHUB_REPOSITORY:'SUSANO-OOO/Zombieee',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_JOB:'capture',V177_CAPTURE_SHARD:'forms-4',GITHUB_RUN_ATTEMPT:'1'}))assert.equal(env[key],value,key);
    assert.match(env.GITHUB_RUN_ID??'',/^[1-9][0-9]*$/u);assert.match(env.GITHUB_SHA??'',/^[a-f0-9]{40}$/u);
    assert.equal(binding.head,env.GITHUB_SHA);assert.equal(binding.head,env.V177_EXPECTED_HEAD_SHA);
    assert.deepEqual(runtime,RUNTIME);assert.deepEqual(selection.caseIds,[CASE]);assert.deepEqual(selection.manualCaseIds,[]);assert.deepEqual(selection.outcomeCaseIds,[]);assert.deepEqual(selection.shards,['forms-4']);
    assert.equal(process.getuid(),process.geteuid());
    record.executable=await realpath(browserType.executablePath());record.bundleRoot=await realpath(path.dirname(browserType.executablePath()));
    assert.equal(path.basename(record.bundleRoot),'webkit-2380');assert.ok(inside(record.bundleRoot,record.executable));
    const help=await command('sample-help','/usr/bin/sample',[],{signal:lifecycleSignal,timeoutMs:1500,allowHelpExit:true});
    const usage=help.stdout+'\n'+help.stderr;
    if(!/\bpid\b|process\s+id/iu.test(usage)||!/duration/iu.test(usage)||!/interval/iu.test(usage)||!/-file\b/u.test(usage)||!/\bseconds\b/iu.test(usage)||!/milliseconds|millisecond|msec/iu.test(usage))throw unavailable('Builtin sample positional syntax/units unverified');
    const first=await ps('before',lifecycleSignal);baseline=first.rows;
    if(first.candidates.length!==0)throw unavailable('Pinned WebContent already present before launch');
    record.status='baseline-ready';
  }catch(e){record.status='unavailable';record.errors.push(String(e));await persist();}
  await persist();
  return {
    record,
    markBrowserLaunch(){
      if(lifecycleSignal?.aborted||record.status!=='baseline-ready'||record.launch)throw unavailable('Mayo sampler baseline/CLI unavailable');
      record.launch={wallMs:Date.now(),monotonicMs:mono()};
    },
    async admit(){
      try{
        if(!record.launch)throw unavailable('Missing owned browser launch marker');
        const pre=await ps('pre',lifecycleSignal);if(pre.candidates.length!==1)throw unavailable('Expected exactly one new pinned WebContent');
        target=pre.candidates[0];
        if(target.uid!==process.getuid()||baseline.some(p=>p.pid===target.pid)||target.startMs>Date.now())throw unavailable('WebContent UID/new PID/start time guard failed');
        const strictAfterLaunch=target.startMs>=Math.ceil(record.launch.wallMs/1000)*1000;
        const definitelyBefore=target.startMs+1000<=record.launch.wallMs;
        record.creationTiming={launchMs:record.launch.wallMs,startSecondMs:target.startMs,precisionMs:1000,
          strictAfterLaunch:strictAfterLaunch?true:null,subsecondBirthUnproved:!strictAfterLaunch,definitelyBeforeLaunch:definitelyBefore,
          claim:'First observed after launch; exact subsecond birth is unproved when the start-second overlaps the launch marker'};
        if(definitelyBefore)throw unavailable('WebContent creation-second is wholly before launch');
        record.target=target;record.status='ready';
      }catch(e){record.status='unavailable';record.errors.push(String(e));}
      await persist();if(record.status!=='ready')throw unavailable('Mayo sampler ownership unavailable; see saved receipt');
    },
    async run(operation,{signal,row}={}){
      assert.equal(record.status,'ready');assert.equal(used,false);used=true;
      assert.equal(row.caseId,CASE);assert.equal(row.owner,'ordinary');assert.equal(row.phase,'attack');assert.deepEqual(row.viewport,{width:1280,height:720});
      const stop=new AbortController(),abort=()=>{record.ownerAbortedAtMs=Date.now();stop.abort();};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      record.status='sampling';record.caseStartedAtMs=Date.now();
      // Spawn synchronously, then immediately run the unchanged original case.
      const sample=command('sample-process','/usr/bin/sample',[String(target.pid),'2','10','-file',rawFile],{signal:stop.signal,timeoutMs:10000});
      caseDone=(async()=>{
        try{const result=await sample;record.sampler=result.receipt;
          if(result.receipt.finishedMonoMs-result.receipt.startedMonoMs<2000)throw unavailable('Sample returned before the requested2s');
          record.status='sampled';}
        catch(e){record.sampler??=e.ownedResult?.receipt??null;record.errors.push(String(e));record.status=e.name==='AbortError'?'partial':'unavailable';}
        // Persist independently even if the original page RPC never settles.
        const stat=await lstat(rawFile).catch(e=>e.code==='ENOENT'?null:Promise.reject(e));
        if(stat){
          record.rawSample={file:rawFile,bytes:stat.size,complete:record.status==='sampled'&&!record.unconfirmedClose,sha256:null};
          if(!record.unconfirmedClose){const hash=createHash('sha256');for await(const chunk of createReadStream(rawFile))hash.update(chunk);record.rawSample.sha256=hash.digest('hex');}
          if(record.status==='sampled'){
            let handle;try{
              handle=await open(rawFile,'r');const prefix=Buffer.alloc(8192);const read=await handle.read(prefix,0,prefix.length,0);const header=prefix.subarray(0,read.bytesRead).toString();
              const pid=/^Process:\s+.*\[(\d+)\]/mu.exec(header)?.[1],file=/^Path:\s+(.+)$/mu.exec(header)?.[1]?.trim();
              if(Number(pid)!==target.pid||!file||!path.isAbsolute(file)||await realpath(file)!==target.executable)throw unavailable('Unknown/mismatched sample PID/Path header');
              record.rawSample.headerIdentityConfirmed=true;
            }catch(e){record.status='unavailable';record.errors.push(String(e));}finally{if(handle)await handle.close();}
          }
        }else record.rawSample={file:rawFile,bytes:0,complete:false,sha256:null};
        await persist();
        if(!signal?.aborted&&!record.unconfirmedClose){
          try{const post=await ps('post',signal),p=post.candidates.find(p=>p.pid===target.pid);
            if(post.candidates.length!==1||!p||p.uid!==target.uid||p.startRaw!==target.startRaw||p.executable!==target.executable)throw unavailable('Post-sample target identity changed');
            record.postIdentityConfirmed=true;
          }catch(e){record.status='unavailable';record.errors.push(String(e));}
        }else{record.postIdentityConfirmed=false;record.postUnavailable='Original owner closed or observer close unconfirmed';}
        if(record.status==='sampled'&&record.postIdentityConfirmed&&record.rawSample.complete&&record.rawSample.bytes>0)record.status='completed';
        else if(record.status==='sampled')record.status='unavailable';
        await persist();
        row.nativeOwnedSample={receiptFile,status:record.status,exactPagePid:false,requestedSeconds:2,extendedCaptureWindow:false};
      })();
      // Attach rejection handling now, so persistence errors do not become an
      // unhandled rejection while a deadline-owned page RPC is still pending.
      let observerError;caseDone.catch(e=>{observerError=e;record.status='unavailable';record.errors.push(String(e));});
      let primary,result;
      try{result=await operation();}catch(e){primary=e;record.originalOperationError=String(e);}
      finally{
        record.caseFinishedAtMs=Date.now();
        record.originalCaptureOperationFinishedAtMs=record.caseFinishedAtMs;
        record.analysisOwner='Original30s case owner and10s sampler wall bound; capture/media already stopped unchanged';
        // A completed capture does not expire the outer case owner. Native
        // symbol analysis is read-only and may finish inside that original
        // remaining budget. Product failure/deadline still aborts immediately.
        if(primary||signal?.aborted)stop.abort();
        try{await caseDone;}catch(e){observerError=e;}
        finally{stop.abort();signal?.removeEventListener('abort',abort);}
        try{await persist();}catch(e){observerError??=e;}
      }
      if(primary)throw primary;if(observerError)throw observerError;
      if(record.status!=='completed')throw unavailable('Sampler partial/unavailable; original capture remains preserved');
      return result;
    },
    async settled(){try{if(caseDone)await caseDone;}finally{await persist();}},
  };
}
