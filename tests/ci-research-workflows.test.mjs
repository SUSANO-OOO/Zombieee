import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {load} from 'js-yaml';
import {assertNativeOpusHost} from '../scripts/v177-native-opus-probe.mjs';
import {nativeGameCaptureBinding} from '../scripts/v177-native-game-capture-browser.mjs';
import {ciChangeScope} from '../scripts/ci-change-scope.mjs';

const names=['native-aac-graph-probe','native-audio-capabilities','native-opus-streaming',
 'native-pcm-streaming','native-capture-comparison','native-game-capture'];
test('diagnostics cannot repeat from the cumulative PR diff and retain immutable candidate binding',()=>{
 const actual=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 for(const name of names){
  const file=`.github/workflows/${name}.yml`,workflow=load(readFileSync(file,'utf8'));
  assert.deepEqual(Object.keys(workflow.on),['workflow_dispatch']);
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.expected_head,
   {description:'Exact 40-character candidate SHA for this diagnostic',required:true,type:'string'});
  assert.deepEqual(workflow.permissions,{contents:'read'});
  const job=Object.values(workflow.jobs)[0],binding=job.steps.find(s=>s.env?.EXPECTED_HEAD);
  assert.equal(job.steps[0].with.ref,'${{ inputs.expected_head }}');
  assert.equal(job['timeout-minutes'],15);
  const match=binding.run.match(/^node --input-type=module -e '(.+)'$/u);assert.ok(match);
  for(const [head,passes]of [[actual,true],['main',false],['0'.repeat(40),false]]){
   const r=spawnSync(process.execPath,['--input-type=module','-e',match[1]],
    {env:{...process.env,EXPECTED_HEAD:head},encoding:'utf8',windowsHide:true});
   assert.equal(r.status===0,passes,r.stderr);
  }
  assert.equal(ciChangeScope([file],{draft:true}).full,false);
 }
});

test('manual diagnostic host and original dispatch input still bind the checked-out source',async()=>{
 const sha='a'.repeat(40),env={GITHUB_ACTIONS:'true',RUNNER_OS:'macOS',GITHUB_EVENT_NAME:'workflow_dispatch',
  GITHUB_EVENT_PATH:'event.json',V177_EXPECTED_HEAD_SHA:sha};
 assert.doesNotThrow(()=>assertNativeOpusHost('darwin',env));
 for(const override of [{GITHUB_EVENT_NAME:'push'},{V177_EXPECTED_HEAD_SHA:'main'},{GITHUB_ACTIONS:'false'}])
  assert.throws(()=>assertNativeOpusHost('darwin',{...env,...override}));
 const guard={platform:'darwin',env,read:async()=>JSON.stringify({inputs:{expected_head:sha}}),head:()=>sha};
 const result=await nativeGameCaptureBinding(guard);assert.equal(result.head,sha);assert.equal(result.pullRequest,null);
 for(const override of [{head:()=>'b'.repeat(40)},{read:async()=>JSON.stringify({inputs:{expected_head:'b'.repeat(40)}})},
  {read:async()=>JSON.stringify({pull_request:{head:{sha}}})},{platform:'win32'}])
  await assert.rejects(nativeGameCaptureBinding({...guard,...override}));
});
