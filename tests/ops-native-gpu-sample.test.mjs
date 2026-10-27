import test from 'node:test';import assert from 'node:assert/strict';
import {createGpuSampleOwner,beginGpuSample} from '../scripts/ops-native-gpu-sample.mjs';
const ui='/cache/webkit-2380/Playwright.app/Contents/MacOS/Playwright',gpu='/cache/webkit-2380/com.apple.WebKit.GPU.xpc/Contents/MacOS/com.apple.WebKit.GPU.Development';
const processRows=`1 0 /sbin/launchd\n11 5 ${ui}\n12 1 ${gpu}\n`;
test('one owned GPU, one-second samples and the original4.5s child bound; original bytes are retained',async()=>{
  let samples=0;const run=async(command,argv,options)=>{
    if(command==='/bin/ps')return {stdout:processRows,stderr:''};samples++;
    assert.equal(command,'/usr/bin/sample');assert.deepEqual(argv,['12','1','2','-file','/proof/GPU-GPU-12.txt']);
    assert.equal(options.timeout,4500);assert.equal(options.killSignal,'SIGKILL');return {stdout:'sampled',stderr:'original stderr'};
  };
  const owner=await createGpuSampleOwner({run:async()=>({stdout:'1 0 /sbin/launchd\n',stderr:''})});
  const sample=await beginGpuSample('/proof/GPU',{owner,run,read:async()=>Buffer.from('original stacks')});
  const record=await sample.completed;assert.equal(samples,1);assert.equal(record.status,'retained');assert.equal(record.bytes,15);assert.match(record.sha256,/^[a-f0-9]{64}$/u);
});
test('timeout/permission details and partial output remain failed; owner ambiguity starts no sampler',async()=>{
  for(const code of ['ETIMEDOUT','EPERM']){
    const error=Object.assign(Error('original failure'),{code,signal:code==='ETIMEDOUT'?'SIGKILL':null,killed:code==='ETIMEDOUT',stdout:'original stdout',stderr:'original stderr'});
    const sample=await beginGpuSample('/proof/GPU',{owner:{schema:'single-ephemeral-gpu-owner/v1',pinnedBefore:[],uiPid:null},run:async command=>{
      if(command==='/bin/ps')return {stdout:processRows,stderr:''};throw error;
    },read:async()=>Buffer.from('partial')});const record=await sample.completed;
    assert.equal(record.status,'failed');assert.equal(record.code,code);assert.equal(record.stderr,'original stderr');assert.equal(record.partialFile.complete,false);
  }
  await assert.rejects(createGpuSampleOwner({run:async()=>({stdout:processRows,stderr:''})}),/pre-existing/u);
  let sampled=false;await assert.rejects(beginGpuSample('/proof/GPU',{owner:{schema:'single-ephemeral-gpu-owner/v1',pinnedBefore:[],uiPid:null},
    run:async command=>{if(command!=='/bin/ps')sampled=true;return {stdout:processRows+`13 1 ${gpu}\n`,stderr:''};}}),/Exactly one owned GPU/u);
  assert.equal(sampled,false);
});
test('deadline closure during inventory cannot start a late child, and file errors preserve successful child output',async()=>{
  let closed=false,samples=0;const owner={schema:'single-ephemeral-gpu-owner/v1',pinnedBefore:[],uiPid:null};
  await assert.rejects(beginGpuSample('/proof/GPU',{owner,isCanceled:()=>closed,run:async command=>{
    if(command==='/bin/ps'){closed=true;return {stdout:processRows,stderr:''};}samples++;return {stdout:'',stderr:''};
  }}),/cancelled before child launch/u);assert.equal(samples,0);
  const sample=await beginGpuSample('/proof/GPU',{owner:{...owner},run:async command=>command==='/bin/ps'
    ?{stdout:processRows,stderr:''}:{stdout:'successful original stdout',stderr:'successful original stderr'},
  read:async()=>{throw Object.assign(Error('missing original file'),{code:'ENOENT'});}});
  const record=await sample.completed;assert.equal(record.status,'failed');assert.equal(record.failureStage,'sample-file-validation');
  assert.equal(record.processExitedSuccessfully,true);assert.equal(record.stdout,'successful original stdout');assert.equal(record.stderr,'successful original stderr');
});
