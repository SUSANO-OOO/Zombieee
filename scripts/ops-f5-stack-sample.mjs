import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const execute=promisify(execFile);
function pinnedProcesses(stdout){
  return stdout.trim().split(/\r?\n/u).map(line=>{
    const match=/^\s*(\d+)\s+(\d+)\s+(.+)$/u.exec(line);
    assert.ok(match,'Malformed original process row');
    return {pid:Number(match[1]),ppid:Number(match[2]),comm:match[3]};
  }).filter(row=>row.comm.includes('/webkit-2380/'));
}
const inventoryArgs=['-A','-ww','-o','pid=,ppid=,comm='];
export async function createProfilerOwner({run=execute,now=Date.now}={}){
  const result=await run('/bin/ps',inventoryArgs,{timeout:1500,maxBuffer:1024*1024});
  assert.equal(result.stderr.trim(),'');assert.deepEqual(pinnedProcesses(result.stdout),[],
    'A pre-existing pinned browser cannot be attributed to this diagnostic');
  return {schema:'single-ephemeral-browser-owner/v1',beforeLaunchAtMs:now(),pinnedBefore:[],browserPid:null};
}
export function selectSampleProcesses(stdout,owner){
  assert.equal(owner?.schema,'single-ephemeral-browser-owner/v1');assert.deepEqual(owner.pinnedBefore,[]);
  const rows=pinnedProcesses(stdout),ui=rows.filter(row=>row.comm.endsWith('/Playwright.app/Contents/MacOS/Playwright'));
  assert.equal(ui.length,1,'A unique newly launched pinned browser UI is required');
  if(owner.browserPid===null)owner.browserPid=ui[0].pid;else assert.equal(ui[0].pid,owner.browserPid,'Browser owner changed');
  return ['WebContent','GPU'].flatMap(role=>{
    const matches=rows.filter(row=>row.comm.includes('/webkit-2380/')
      &&row.comm.endsWith('/com.apple.WebKit.'+role+'.Development'));
    // WebKit keeps a spare/cached WebContent process. Sample both rather than
    // guessing which owns the page. Neither one is attributed on PID age alone.
    assert.ok(matches.length>=1&&matches.length<=(role==='WebContent'?2:1),'Bounded pinned WebKit '+role+' processes required');
    return matches.map(row=>({...row,role}));
  });
}

// Diagnostic-only stack sampling. The sampler never supplies or changes game,
// capture or packet timestamps. Await all owned children before context cleanup.
export async function beginStackSamples(prefix,{owner,run=execute,read=readFile,now=Date.now}={}){
  const inventory=await run('/bin/ps',inventoryArgs,{timeout:1500,maxBuffer:1024*1024});
  assert.equal(inventory.stderr.trim(),'');
  const processes=selectSampleProcesses(inventory.stdout,owner);
  const records=processes.map(process=>({...process,file:prefix+'-'+process.role+'-'+process.pid+'.txt',
    requestedAtMs:now(),durationSeconds:3,intervalMs:2,status:'started'}));
  const completed=Promise.all(records.map(async row=>{
    try{
      const result=await run('/usr/bin/sample',[String(row.pid),'3','2','-file',row.file],
        {timeout:4500,killSignal:'SIGKILL',maxBuffer:64*1024});
      row.stdout=result.stdout;row.stderr=result.stderr;
      const bytes=await read(row.file);
      assert.ok(bytes.length>0&&bytes.length<=4*1024*1024,'Bounded original stack report required');
      row.bytes=bytes.length;row.sha256=createHash('sha256').update(bytes).digest('hex');row.status='retained';
    }catch(error){row.status='failed';row.error=String(error);}
    finally{row.finishedAtMs=now();}
  })).then(()=>records);
  // Every child failure remains in its record; no retry or unhandled rejection.
  return {processes,completed};
}
