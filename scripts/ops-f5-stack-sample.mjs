import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const execute=promisify(execFile);
export function selectSampleProcesses(stdout){
  const rows=stdout.trim().split(/\r?\n/u).map(line=>{
    const match=/^\s*(\d+)\s+(\d+)\s+(.+)$/u.exec(line);
    assert.ok(match,'Malformed original process row');
    return {pid:Number(match[1]),ppid:Number(match[2]),comm:match[3]};
  });
  return ['WebContent','GPU'].map(role=>{
    const matches=rows.filter(row=>row.comm.includes('/webkit-2380/')
      &&row.comm.endsWith('/com.apple.WebKit.'+role+'.Development'));
    assert.equal(matches.length,1,'A unique pinned WebKit '+role+' process is required');
    return {...matches[0],role};
  });
}

// Diagnostic-only stack sampling. The sampler never supplies or changes game,
// capture or packet timestamps. Await all owned children before context cleanup.
export async function beginStackSamples(prefix,{run=execute,read=readFile,now=Date.now}={}){
  const inventory=await run('/bin/ps',['-A','-ww','-o','pid=,ppid=,comm='],{timeout:1500,maxBuffer:1024*1024});
  assert.equal(inventory.stderr.trim(),'');
  const processes=selectSampleProcesses(inventory.stdout);
  const records=processes.map(process=>({...process,file:prefix+'-'+process.role+'.txt',
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
