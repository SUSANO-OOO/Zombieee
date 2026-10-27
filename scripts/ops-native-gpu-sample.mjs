import assert from 'node:assert/strict';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import path from 'node:path';
const execute=promisify(execFile),args=['-A','-ww','-o','pid=,ppid=,comm='];
function inventory(stdout){
  return stdout.trim().split(/\r?\n/u).map(line=>{const m=/^\s*(\d+)\s+(\d+)\s+(.+)$/u.exec(line);
    assert.ok(m,'Malformed process inventory');return {pid:Number(m[1]),ppid:Number(m[2]),comm:m[3]};
  }).filter(row=>row.comm.includes('/webkit-2380/'));
}
export async function createGpuSampleOwner({run=execute}={}){
  const result=await run('/bin/ps',args,{timeout:1500,maxBuffer:1024*1024});assert.equal(result.stderr.trim(),'');
  const before=inventory(result.stdout);assert.deepEqual(before,[],'No pre-existing pinned process may be attributed');
  return {schema:'single-ephemeral-gpu-owner/v1',pinnedBefore:before,uiPid:null};
}
export async function beginGpuSample(prefix,{owner,run=execute,read=readFile,now=Date.now,isCanceled=()=>false}={}){
  assert.equal(owner?.schema,'single-ephemeral-gpu-owner/v1');assert.deepEqual(owner.pinnedBefore,[]);
  assert.equal(isCanceled(),false,'GPU sampling cancelled before setup');
  const result=await run('/bin/ps',args,{timeout:1500,maxBuffer:1024*1024});assert.equal(result.stderr.trim(),'');
  assert.equal(isCanceled(),false,'GPU sampling cancelled before child launch');
  const all=inventory(result.stdout),ui=all.filter(r=>r.comm.endsWith('/Playwright.app/Contents/MacOS/Playwright'));
  const gpu=all.filter(r=>r.comm.endsWith('/com.apple.WebKit.GPU.Development'));
  assert.equal(ui.length,1,'Exactly one newly owned UI process required');assert.equal(gpu.length,1,'Exactly one owned GPU required');
  if(owner.uiPid===null)owner.uiPid=ui[0].pid;else assert.equal(owner.uiPid,ui[0].pid,'UI owner changed');
  const row={...gpu[0],role:'GPU',file:prefix+'-GPU-'+gpu[0].pid+'.txt',requestedAtUnixMs:now(),
    durationSeconds:1,intervalMs:2,timeoutMs:4500,status:'started',inventory:all,
    clockNote:'Requested/finished are subprocess bounds, not exact stack-sample timestamps. Original sample header is retained.'};
  const completed=(async()=>{
    let processSucceeded=false;
    try{
      assert.equal(isCanceled(),false,'GPU sampling cancelled before child launch');
      const captured=await run('/usr/bin/sample',[String(row.pid),'1','2','-file',row.file],
        {timeout:4500,killSignal:'SIGKILL',maxBuffer:64*1024});
      row.stdout=captured.stdout;row.stderr=captured.stderr;processSucceeded=true;
      const bytes=await read(row.file);assert.ok(bytes.length>0&&bytes.length<=4*1024*1024,'Bounded original sample report required');
      row.bytes=bytes.length;row.sha256=createHash('sha256').update(bytes).digest('hex');row.status='retained';
    }catch(error){
      row.status='failed';row.error=String(error);row.code=error.code??null;row.signal=error.signal??null;row.killed=error.killed??null;
      row.failureStage=processSucceeded?'sample-file-validation':'sample-process';row.processExitedSuccessfully=processSucceeded;
      row.stdout=error.stdout??row.stdout??'';row.stderr=error.stderr??row.stderr??'';
      try{const bytes=await read(row.file);row.partialFile={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),complete:false};}
      catch(readError){row.partialFile={available:false,error:String(readError)};}
    }finally{row.finishedAtUnixMs=now();}
    return row;
  })();
  return {record:row,completed};
}

// The owning root worker collects raw stackshots only. Reporting happens in a
// separate workflow step after the original case and browser have ended.
export async function beginRawStackshot({owner,admissionDeadlineUnixMs,run=execute,read=readFile,isCanceled=()=>false,
  uid=process.getuid?.(),gid=process.getgid?.(),head=process.env.V177_EXPECTED_HEAD_SHA,runId=process.env.GITHUB_RUN_ID}={}){
  assert.equal(owner?.schema,'single-ephemeral-gpu-owner/v1');assert.deepEqual(owner.pinnedBefore,[]);
  assert.match(head??'',/^[a-f0-9]{40}$/u);assert.match(runId??'',/^\d+$/u);
  assert.ok(Number.isInteger(uid)&&uid>0&&Number.isInteger(gid)&&gid>=0&&Number.isFinite(admissionDeadlineUnixMs));
  assert.equal(isCanceled(),false,'Stackshot admission closed before setup');
  const result=await run('/bin/ps',args,{timeout:1500,maxBuffer:1024*1024});assert.equal(result.stderr.trim(),'');
  assert.equal(isCanceled(),false,'Stackshot admission closed before root worker');
  const all=inventory(result.stdout),roles={ui:'/Playwright.app/Contents/MacOS/Playwright',gpu:'/com.apple.WebKit.GPU.Development',webContent:'/com.apple.WebKit.WebContent.Development'},targets={};
  for(const [role,suffix]of Object.entries(roles)){const matches=all.filter(r=>r.comm.endsWith(suffix));
    assert.equal(matches.length,1,'Exactly one owned '+role+' required');targets[role]=matches[0];}
  if(owner.uiPid===null)owner.uiPid=targets.ui.pid;else assert.equal(owner.uiPid,targets.ui.pid,'UI owner changed');
  const out=path.resolve('outputs/ops-f5-recorder-control'),receipt=path.join(out,'0-native-stackshot-collection.json'),raw=path.join(out,'0-native-stackshot.spindump');
  const argv=['-n','/usr/bin/python3',path.resolve('scripts/ops-spindump-self-preflight.py'),'--collect-worker',process.cwd(),String(uid),String(gid),head,runId,
    String(targets.ui.pid),String(targets.gpu.pid),String(targets.webContent.pid),String(Math.floor(admissionDeadlineUnixMs))];
  const row={method:'owned-gpu-and-webcontent-raw-stackshot',targets,rawFile:raw,receiptFile:receipt,status:'started',
    rawChildLimitMs:4500,rootWorkerOwnsAndReapsChild:true,sudoWrapperKilled:false,accepted:false};
  const completed=(async()=>{
    let workerExited=false;
    try{
      assert.equal(isCanceled(),false,'Stackshot admission closed before root worker');
      // Never SIGKILL a sudo monitor. The worker enforces the direct child's
      // bound and cannot return before it has reaped that child.
      const r=await run('/usr/bin/sudo',argv,{maxBuffer:64*1024});workerExited=true;row.stdout=r.stdout;row.stderr=r.stderr;
      const record=JSON.parse(await read(receipt,'utf8'));row.worker=record;
      assert.equal(record.schema,'owned-webkit-stackshot/v1');assert.equal(record.phase,'collect');assert.equal(record.head,head);assert.equal(record.run,runId);
      assert.equal(record.status,'raw-retained');assert.equal(record.accepted,false);assert.equal(record.collection.timedOut,false);assert.equal(record.collection.code,0);
      for(const [role,target]of Object.entries(targets))assert.equal(record.targets[role].pid,target.pid,'Root worker target differs');
      assert.equal(record.raw.file,path.basename(raw));const bytes=await read(raw);
      assert.ok(bytes.length>0&&bytes.length<=4*1024*1024);assert.equal(bytes.length,record.raw.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),record.raw.sha256,'Retained original raw bytes changed');row.status='retained';
    }catch(error){
      row.status='failed';row.error=String(error);row.workerExitedSuccessfully=workerExited;
      row.code=error.code??null;row.signal=error.signal??null;row.stdout=error.stdout??row.stdout??'';row.stderr=error.stderr??row.stderr??'';
      if(!row.worker)try{row.worker=JSON.parse(await read(receipt,'utf8'));}catch(e){row.receiptReadError=String(e);}
    }
    return row;
  })();
  return {record:row,completed};
}
