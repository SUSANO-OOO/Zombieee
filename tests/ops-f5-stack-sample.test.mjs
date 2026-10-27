import test from 'node:test';
import assert from 'node:assert/strict';
import {beginStackSamples,selectSampleProcesses} from '../scripts/ops-f5-stack-sample.mjs';
const processRow=(pid,role,rev='2380')=>`${pid} 1 /Users/runner/ms-playwright/webkit-${rev}/com.apple.WebKit.${role}.xpc/Contents/MacOS/com.apple.WebKit.${role}.Development`;
const inventory=[processRow(101,'WebContent'),processRow(102,'GPU'),processRow(103,'WebContent','2359')].join('\n');
test('the two exact pinned processes are selected without matching another browser revision',()=>{
  assert.deepEqual(selectSampleProcesses(inventory).map(r=>r.pid),[101,102]);
});
test('absent, ambiguous and malformed inventories fail instead of sampling an unrelated process',()=>{
  for(const value of ['',inventory+'\n'+processRow(104,'WebContent'),'malformed'])assert.throws(()=>selectSampleProcesses(value));
});
test('both owned samplers finish and retain their original bytes',async()=>{
  const calls=[];let clock=0;
  const samples=await beginStackSamples('owned',{run:async(file,args,options)=>{
    calls.push({file,args,options});return file==='/bin/ps'?{stdout:inventory,stderr:''}:{stdout:'',stderr:'sample complete'};
  },read:async()=>Buffer.from('original stack report'),now:()=>++clock});
  const records=await samples.completed;assert.ok(records.every(r=>r.status==='retained'&&r.bytes===21&&r.finishedAtMs>r.requestedAtMs));
  assert.equal(calls.length,3);assert.ok(calls.slice(1).every(c=>c.options.timeout===4500&&c.options.killSignal==='SIGKILL'));
  assert.equal(calls[1].file,'/usr/bin/sample');
  assert.deepEqual(calls[1].args,['101','3','2','-file','owned-WebContent.txt']);
});
test('sampler failure is retained once and the other owned sampler is still awaited',async()=>{
  let calls=0;
  const samples=await beginStackSamples('owned',{run:async(file,args)=>{
    if(file==='/bin/ps')return {stdout:inventory,stderr:''};calls++;
    if(args.includes('101'))throw Error('sample denied');return {stdout:'',stderr:''};
  },read:async()=>Buffer.from('raw')});
  const records=await samples.completed;assert.equal(calls,2);assert.equal(records[0].status,'failed');
  assert.match(records[0].error,/sample denied/u);assert.equal(records[1].status,'retained');
});
test('a sampler timeout remains a diagnostic failure with no second attempt',async()=>{
  const observed=[];
  const samples=await beginStackSamples('owned',{run:async(file,args,options)=>{
    if(file==='/bin/ps')return {stdout:inventory,stderr:''};
    observed.push({file,args,options});throw Object.assign(Error('owned sampler killed'),{killed:true,signal:'SIGKILL'});
  },read:async()=>{throw Error('Failed sampler must not read a report');}});
  const records=await samples.completed;assert.equal(observed.length,2);
  assert.ok(observed.every(r=>r.file==='/usr/bin/sample'&&r.options.timeout===4500&&r.options.killSignal==='SIGKILL'));
  assert.ok(records.every(r=>r.status==='failed'&&/owned sampler killed/u.test(r.error)));
});
