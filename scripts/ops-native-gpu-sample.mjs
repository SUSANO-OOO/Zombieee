import assert from 'node:assert/strict';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
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
export async function beginGpuSample(prefix,{owner,run=execute,read=readFile,now=Date.now}={}){
  assert.equal(owner?.schema,'single-ephemeral-gpu-owner/v1');assert.deepEqual(owner.pinnedBefore,[]);
  const result=await run('/bin/ps',args,{timeout:1500,maxBuffer:1024*1024});assert.equal(result.stderr.trim(),'');
  const all=inventory(result.stdout),ui=all.filter(r=>r.comm.endsWith('/Playwright.app/Contents/MacOS/Playwright'));
  const gpu=all.filter(r=>r.comm.endsWith('/com.apple.WebKit.GPU.Development'));
  assert.equal(ui.length,1,'Exactly one newly owned UI process required');assert.equal(gpu.length,1,'Exactly one owned GPU required');
  if(owner.uiPid===null)owner.uiPid=ui[0].pid;else assert.equal(owner.uiPid,ui[0].pid,'UI owner changed');
  const row={...gpu[0],role:'GPU',file:prefix+'-GPU-'+gpu[0].pid+'.txt',requestedAtUnixMs:now(),
    durationSeconds:1,intervalMs:2,timeoutMs:4500,status:'started',inventory:all,
    clockNote:'Requested/finished are subprocess bounds, not exact stack-sample timestamps. Original sample header is retained.'};
  const completed=(async()=>{
    try{
      const captured=await run('/usr/bin/sample',[String(row.pid),'1','2','-file',row.file],
        {timeout:4500,killSignal:'SIGKILL',maxBuffer:64*1024});
      row.stdout=captured.stdout;row.stderr=captured.stderr;
      const bytes=await read(row.file);assert.ok(bytes.length>0&&bytes.length<=4*1024*1024,'Bounded original sample report required');
      row.bytes=bytes.length;row.sha256=createHash('sha256').update(bytes).digest('hex');row.status='retained';
    }catch(error){
      row.status='failed';row.error=String(error);row.code=error.code??null;row.signal=error.signal??null;row.killed=error.killed??null;
      row.stdout=error.stdout??'';row.stderr=error.stderr??'';
      try{const bytes=await read(row.file);row.partialFile={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),complete:false};}
      catch(readError){row.partialFile={available:false,error:String(readError)};}
    }finally{row.finishedAtUnixMs=now();}
    return row;
  })();
  return {record:row,completed};
}
