import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {load} from 'js-yaml';
import {COMBAT_QA_BASELINE as old,COMBAT_QA_BLOBS,COMBAT_QA_WORKFLOW_BLOB,COMBAT_QA_QUALITY_WORKFLOW_BLOB,BASELINE_JOB_NAMES,reviewedCombatQaPaths,previousCombatQaEvidence} from '../scripts/ci-combat-qa-reuse.mjs';
import {COMBAT_FIXTURE_BASELINE as repair,COMBAT_FIXTURE_BLOB,COMBAT_FIXTURE_SKIPPED_JOBS,
  reviewedCombatFixturePaths,previousCombatFixtureEvidence} from '../scripts/ci-combat-qa-reuse.mjs';
import {ciChangeScope} from '../scripts/ci-change-scope.mjs';import {provenanceFixture} from './helpers/ci-pr-provenance.mjs';
const paths=[...Object.keys(COMBAT_QA_BLOBS),'.github/workflows/ci.yml','scripts/ci-change-scope.mjs','scripts/ci-combat-qa-reuse.mjs',
  'tests/ci-combat-qa-reuse.test.mjs','scripts/v177-native-allunit-recovery.json','docs/PROJECT_STATE.md','.github/workflows/v1-quality-acceptance.yml'];
const sourceBlobs={...COMBAT_QA_BLOBS,'.github/workflows/ci.yml':COMBAT_QA_WORKFLOW_BLOB,'.github/workflows/v1-quality-acceptance.yml':COMBAT_QA_QUALITY_WORKFLOW_BLOB};
const options={repository:'SUSANO-OOO/Zombieee',previousHead:old.head,base:old.base,prNumber:old.prNumber,action:'synchronize',draft:false,
  productUnchanged:true,paths,sourceBlobs,token:'fixture-only'};
const fixture=provenanceFixture({runId:old.runId,head:old.head,base:old.base});
const originalRun={id:old.runId,head_sha:old.head,run_attempt:1,event:'pull_request',status:'completed',conclusion:'failure',pull_requests:[{number:180}]};
const originalJobs=BASELINE_JOB_NAMES.map((name,i)=>({id:1000+i,run_id:old.runId,run_attempt:1,head_sha:old.head,name,status:'completed',
  conclusion:['V1.0.2 Combat (webkit phone-short)','V1.0.2 Combat (webkit)'].includes(name)?'failure':name==='WebKit Compact Shadow Diagnostic'?'skipped':'success'}));
const originalQuality={...originalRun,id:old.qualityRunId,conclusion:'success'};
const originalQualityJobs=['chromium','webkit'].map((engine,i)=>({id:2000+i,run_id:old.qualityRunId,run_attempt:1,head_sha:old.head,
  name:`V1 Quality UI and Play (${engine})`,status:'completed',conclusion:'success'}));
const api=({run=originalRun,jobs=originalJobs,quality=originalQuality,qualityJobs=originalQualityJobs,artifacts=fixture.artifacts,zip=fixture.zip,count=jobs.length,calls=[]}={})=>async url=>{
  const isQuality=url.includes('/runs/'+old.qualityRunId);
  calls.push(url);return{ok:true,arrayBuffer:async()=>zip,json:async()=>isQuality?(url.includes('/jobs?')?{total_count:qualityJobs.length,jobs:qualityJobs}:quality)
    :url.includes('/jobs?')?{total_count:count,jobs}:url.includes('/artifacts?')?artifacts:run};};

test('unchanged completed product gates are retained while all affected combat groups run again',async()=>{
  const calls=[],result=await previousCombatQaEvidence({...options,request:api({calls})});assert.equal(result.passed,true);
  assert.equal(result.originalRunConclusion,'failure');assert.equal(result.originalFailures.length,2);assert.ok(result.originalFailures.every(j=>j.conclusion==='failure'));
  assert.equal(result.retainedJobs.length,46);assert.equal(result.wholeGameAccepted,false);assert.equal(result.provenance.head,old.head);assert.equal(calls.length,6);
  assert.equal(result.qualityEvidence.runId,old.qualityRunId);assert.equal(result.qualityEvidence.jobs.length,2);
  const scope=ciChangeScope(paths,{draft:false,sourceBlobs,reuseCombatQa:result.passed});
  assert.equal(scope.full,false);assert.equal(scope.combat,true);for(const key of ['ranger','normal','r9','wholeGameAccepted'])assert.equal(scope[key],false);
  assert.equal(scope.finalIntegrationRequiresFullRegression,true);assert.equal(scope.scope,'combat-qa-update-product-unchanged');
});

test('changed product, unknown paths, source drift and different integration context cannot reuse gates',async()=>{
  for(const changed of [{repository:'elsewhere/repo'},{previousHead:'f'.repeat(40)},{base:'f'.repeat(40)},{prNumber:181},{action:'ready_for_review'},
    {draft:true},{productUnchanged:false},{token:''},{paths:[...paths,'app/AshfallGame.tsx']},{paths:[...paths,'scripts/unknown.mjs']},
    {sourceBlobs:{...sourceBlobs,'scripts/v177-mayo-native-samples.mjs':'f'.repeat(40)}},
    {sourceBlobs:{...sourceBlobs,'.github/workflows/ci.yml':'f'.repeat(40)}},
    {sourceBlobs:{...sourceBlobs,'.github/workflows/v1-quality-acceptance.yml':'f'.repeat(40)}}]){
    const result=await previousCombatQaEvidence({...options,...changed,request:()=>assert.fail('ineligible changes must not query old evidence')});assert.equal(result.passed,false);
  }
  assert.equal(reviewedCombatQaPaths(paths.filter(p=>p!=='scripts/v102-combat-browser.mjs'),sourceBlobs),false);
  assert.equal(ciChangeScope(paths,{draft:false,sourceBlobs}).full,true);
  assert.equal(ciChangeScope([...paths,'app/AshfallGame.tsx'],{draft:false,sourceBlobs,reuseCombatQa:true}).full,true);
});

test('incomplete, cancelled, missing, duplicate and unrelated failing original gates restore full validation',async()=>{
  const index=originalJobs.findIndex(j=>j.name==='V1 WebKit Frame and Boss Performance');
  for(const conclusion of ['failure','cancelled','timed_out','skipped']){
    const jobs=originalJobs.map((j,i)=>i===index?{...j,conclusion}:j);
    assert.equal((await previousCombatQaEvidence({...options,request:api({jobs})})).passed,false);
  }
  for(const jobs of [originalJobs.slice(1),[...originalJobs,originalJobs[0]],originalJobs.map((j,i)=>i===index?{...j,status:'in_progress'}:j),
    originalJobs.map((j,i)=>i===index?{...j,head_sha:'f'.repeat(40)}:j),originalJobs.map((j,i)=>i===index?{...j,id:originalJobs[0].id}:j),
    ...[2,undefined].map(run_attempt=>originalJobs.map((j,i)=>i===index?{...j,run_attempt}:j))])
    assert.equal((await previousCombatQaEvidence({...options,request:api({jobs})})).passed,false);
  for(const run of [{...originalRun,status:'in_progress'},{...originalRun,run_attempt:2},{...originalRun,head_sha:'f'.repeat(40)},
    {...originalRun,conclusion:'cancelled'},{...originalRun,pull_requests:[]}])
    assert.equal((await previousCombatQaEvidence({...options,request:api({run})})).passed,false);
  assert.equal((await previousCombatQaEvidence({...options,request:api({count:51})})).passed,false);
});

test('immutable artifact digest and original PR base remain required',async()=>{
  for(const bad of [provenanceFixture({runId:old.runId,head:'f'.repeat(40),base:old.base}),provenanceFixture({runId:old.runId,head:old.head,base:'f'.repeat(40)})])
    assert.equal((await previousCombatQaEvidence({...options,request:api({artifacts:bad.artifacts,zip:bad.zip})})).passed,false);
  const zip=Buffer.from(fixture.zip);zip[zip.length-1]^=1;
  assert.equal((await previousCombatQaEvidence({...options,request:api({zip})})).passed,false);
  assert.equal((await previousCombatQaEvidence({...options,request:async()=>{throw Error('offline');}})).passed,false);
});

test('Quality reuse requires both original engine jobs to pass on the same exact candidate and attempt',async()=>{
  for(const quality of [{...originalQuality,status:'in_progress'},{...originalQuality,conclusion:'failure'},{...originalQuality,run_attempt:2},
    {...originalQuality,head_sha:'f'.repeat(40)},{...originalQuality,pull_requests:[]}])
    assert.equal((await previousCombatQaEvidence({...options,request:api({quality})})).passed,false);
  for(const field of [{conclusion:'failure'},{conclusion:'skipped'},{status:'in_progress'},{run_attempt:2},{run_attempt:undefined},{head_sha:'f'.repeat(40)}]){
    const qualityJobs=originalQualityJobs.map((j,i)=>i===0?{...j,...field}:j);
    assert.equal((await previousCombatQaEvidence({...options,request:api({qualityJobs})})).passed,false);
  }
  for(const qualityJobs of [originalQualityJobs.slice(1),[originalQualityJobs[0],originalQualityJobs[0]]])
    assert.equal((await previousCombatQaEvidence({...options,request:api({qualityJobs})})).passed,false);
});

test('workflow preserves every command/deadline and current script drift rejects reuse and requires full validation',async()=>{
  const current=readFileSync('.github/workflows/ci.yml','utf8'),before=load(execFileSync('git',['show',old.head+':.github/workflows/ci.yml'],{encoding:'utf8',windowsHide:true}));
  before.jobs.scope.outputs.combat='${{ steps.scope.outputs.combat }}';
  before.jobs['v102-combat'].if="${{ needs.scope.outputs.full == 'true' || needs.scope.outputs.combat == 'true' }}";
  before.jobs['v102-combat-webkit-summary'].if="${{ (needs.scope.outputs.full == 'true' || needs.scope.outputs.combat == 'true') && (always()) }}";
  before.jobs.scope.outputs.performance='${{ steps.scope.outputs.performance }}';
  before.jobs.scope.outputs.verify_full='${{ steps.scope.outputs.verify_full }}';
  before.jobs.scope.outputs.phaseg='${{ steps.scope.outputs.phaseg }}';
  // Audio-owner changes require both native media-output jobs. Only their
  // selection changes; the full comparison below still freezes every command.
  before.jobs.scope.outputs.audio='${{ steps.scope.outputs.audio }}';
  before.jobs['v103-audio-output'].if="${{ needs.scope.outputs.full == 'true' || needs.scope.outputs.audio == 'true' }}";
  before.jobs['v100-phase-g-production'].if="${{ needs.scope.outputs.full == 'true' || needs.scope.outputs.phaseg == 'true' }}";
  const verify=before.jobs.verify.steps.filter(step=>step.if?.includes("needs.scope.outputs.full == 'true'"));assert.equal(verify.length,19);
  for(const step of verify)step.if=step.if.replaceAll("needs.scope.outputs.full == 'true'","(needs.scope.outputs.full == 'true' || needs.scope.outputs.verify_full == 'true')");
  before.jobs['v100-webkit-frame-control'].if="${{ needs.scope.outputs.full == 'true' || needs.scope.outputs.performance == 'true' }}";
  const command='node scripts/run-browser-qa-with-server.mjs scripts/v100-device-runtime-browser.mjs';
  const formal=before.jobs['v100-webkit-frame-control'].steps.filter(step=>step.run===command);
  assert.equal(formal.length,4);
  for(const step of formal){assert.equal(step.env.V100_DEVICE_RUNTIME_CALLBACK_DIAGNOSTIC,'1');step.env.V100_DEVICE_RUNTIME_CALLBACK_DIAGNOSTIC='0';}
  const currentFormal=load(current).jobs['v100-webkit-frame-control'].steps.filter(step=>step.run===command);
  assert.equal(currentFormal.length,4);for(const step of currentFormal)assert.equal(step.env.V100_DEVICE_RUNTIME_CALLBACK_DIAGNOSTIC,'0');
  assert.deepEqual(load(current),before);
  const workflowBlob=execFileSync('git',['hash-object','.github/workflows/ci.yml'],{encoding:'utf8',windowsHide:true}).trim();
  if(workflowBlob!==COMBAT_QA_WORKFLOW_BLOB)assert.equal(reviewedCombatQaPaths(paths,{...sourceBlobs,'.github/workflows/ci.yml':workflowBlob}),false,
    'Changed workflow must not inherit the old exact-workflow QA owner');
  for(const [file,blob]of Object.entries(COMBAT_QA_BLOBS)){
    const actual=execFileSync('git',['hash-object',file],{encoding:'utf8',windowsHide:true}).trim();
    if(actual===blob)assert.equal(actual,blob);
    else{
      // Keep the immutable reuse hash and inspect the CURRENT file. Its drift
      // must reject the old receipts and select full regression, even if a
      // caller incorrectly asks to reuse them. Never repin an old QA owner.
      const currentBlobs={...sourceBlobs,[file]:actual};
      assert.equal(reviewedCombatQaPaths(paths,currentBlobs),false,file);
      const currentScope=ciChangeScope(paths,{draft:false,sourceBlobs:currentBlobs,reuseCombatQa:true});
      assert.equal(currentScope.full,true,file);assert.equal(currentScope.scope,'full-regression');
      let requests=0;
      assert.equal((await previousCombatQaEvidence({...options,sourceBlobs:currentBlobs,
        request:()=>{requests++;assert.fail('Changed current scripts cannot query or inherit old QA');}})).passed,false);
      assert.equal(requests,0,'Changed current scripts must fail before requesting old QA');
    }
  }
  const qualityFile='.github/workflows/v1-quality-acceptance.yml',quality=load(readFileSync(qualityFile,'utf8'));
  const oldQuality=load(execFileSync('git',['show',old.head+':'+qualityFile],{encoding:'utf8',windowsHide:true}));
  oldQuality.concurrency={group:'${{ github.workflow }}-${{ github.event.pull_request.number }}-${{ github.event.pull_request.head.sha }}','cancel-in-progress':false};
  oldQuality.jobs['quality-ui-play'].needs='scope';oldQuality.jobs['quality-ui-play'].if="${{ !github.event.pull_request.draft && needs.scope.outputs.reuse_quality != 'true' }}";
  const scope=quality.jobs.scope;delete quality.jobs.scope;assert.deepEqual(quality,oldQuality);
  assert.equal(scope['timeout-minutes'],5);assert.deepEqual(scope.permissions,{contents:'read',actions:'read'});
  assert.deepEqual(scope.steps.find(s=>s.id==='scope').env,before.jobs.scope.steps.find(s=>s.id==='scope').env);
  assert.equal(scope.steps.find(s=>s.id==='scope').run,'node scripts/ci-change-scope.mjs');
  const qualityBlob=execFileSync('git',['hash-object',qualityFile],{encoding:'utf8',windowsHide:true}).trim();
  if(qualityBlob!==COMBAT_QA_QUALITY_WORKFLOW_BLOB){
    const currentBlobs={...sourceBlobs,[qualityFile]:qualityBlob};
    assert.equal(reviewedCombatQaPaths(paths,currentBlobs),false);
    assert.equal(ciChangeScope(paths,{draft:false,sourceBlobs:currentBlobs,reuseCombatQa:true}).full,true);
    let requests=0;
    assert.equal((await previousCombatQaEvidence({...options,sourceBlobs:currentBlobs,
      request:()=>{requests++;assert.fail('The changed workflow cannot inherit the old combat QA owner');}})).passed,false);
    assert.equal(requests,0);
  }
});

const fixtureFile='tests/v177-native-canvas-clips.test.mjs';
const fixturePaths=[fixtureFile,'scripts/ci-change-scope.mjs','scripts/ci-combat-qa-reuse.mjs',
  'tests/ci-combat-qa-reuse.test.mjs','scripts/v177-native-allunit-recovery.json'];
const fixtureBlobs={...sourceBlobs,[fixtureFile]:COMBAT_FIXTURE_BLOB};
const fixtureOptions={...options,previousHead:repair.head,paths:fixturePaths,sourceBlobs:fixtureBlobs};
const repairProvenance=provenanceFixture({runId:repair.runId,head:repair.head,base:old.base,artifactId:92});
const repairRun={...originalRun,id:repair.runId,head_sha:repair.head};
const repairJobs=['Validation Scope','PR Verify',...['chromium','webkit desktop-phone','webkit phone-short','webkit'].map(label=>`V1.0.2 Combat (${label})`),
  ...COMBAT_FIXTURE_SKIPPED_JOBS].map((name,i)=>({id:name==='PR Verify'?120776216487:5000+i,run_id:repair.runId,run_attempt:1,
    head_sha:repair.head,name,status:'completed',conclusion:name==='PR Verify'?'failure':COMBAT_FIXTURE_SKIPPED_JOBS.includes(name)?'skipped':'success',
    ...(name==='PR Verify'?{steps:[...['Verify PR provenance','Upload PR provenance','Check patch whitespace','Install dependencies','Lint',
      'Validate production content','Build production application'].map(name=>({name,status:'completed',conclusion:'success'})),
      {name:'Test',status:'completed',conclusion:'failure'}]}:{})}));
const fixtureApi=({run=repairRun,jobs=repairJobs,artifacts=repairProvenance.artifacts,zip=repairProvenance.zip,calls=[],original={}}={})=>{
  const prior=api({...original,calls});
  return async url=>{
    if(!url.includes('/runs/'+repair.runId)&&!url.includes('/artifacts/'+repairProvenance.artifacts.artifacts[0].id+'/zip'))return prior(url);
    calls.push(url);return{ok:true,arrayBuffer:async()=>zip,json:async()=>url.includes('/jobs?')?{total_count:jobs.length,jobs}:
      url.includes('/artifacts?')?artifacts:run};
  };
};

test('reviewed Mayo VM fixture repair retains completed combat groups and runs the complete PR Verify afresh',async()=>{
  const calls=[],result=await previousCombatFixtureEvidence({...fixtureOptions,request:fixtureApi({calls})});assert.equal(result.passed,true);
  assert.equal(result.originalEvidence.originalRunConclusion,'failure');assert.equal(result.originalEvidence.originalFailures.length,2);
  assert.equal(result.originalVerifyFailure.conclusion,'failure');assert.equal(result.retainedCombatJobs.length,4);
  assert.ok(result.retainedCombatJobs.every(j=>j.conclusion==='success'));assert.equal(result.wholeGameAccepted,false);
  assert.equal(calls.length,10);assert.equal(result.provenance.head,repair.head);
  const scope=ciChangeScope(fixturePaths,{draft:false,sourceBlobs:fixtureBlobs,reuseCombatFixture:result.passed});
  assert.equal(scope.full,false);assert.equal(scope.combat,false);assert.equal(scope.scope,'combat-fixture-update-product-unchanged');
  for(const key of ['ranger','normal','r9','wholeGameAccepted'])assert.equal(scope[key],false);
  assert.equal(scope.finalIntegrationRequiresFullRegression,true);
  assert.equal(execFileSync('git',['hash-object',fixtureFile],{encoding:'utf8',windowsHide:true}).trim(),COMBAT_FIXTURE_BLOB);
});

test('fixture continuation rejects different sources, product, context or unknown paths before reading old gates',async()=>{
  for(const changed of [{repository:'another/repo'},{previousHead:old.head},{base:'f'.repeat(40)},{prNumber:181},{action:'ready_for_review'},
    {draft:true},{productUnchanged:false},{token:''},{paths:fixturePaths.filter(p=>p!==fixtureFile)},
    {paths:[...fixturePaths,'app/AshfallGame.tsx']},{paths:[...fixturePaths,'scripts/unknown.mjs']},
    ...Object.keys(fixtureBlobs).map(file=>({sourceBlobs:{...fixtureBlobs,[file]:'f'.repeat(40)}}))])
    assert.equal((await previousCombatFixtureEvidence({...fixtureOptions,...changed,request:()=>assert.fail('ineligible fixture repair must fail closed')})).passed,false);
  assert.equal(reviewedCombatFixturePaths(fixturePaths,fixtureBlobs),true);
  assert.equal(ciChangeScope(fixturePaths,{draft:false,sourceBlobs:fixtureBlobs}).full,true);
  assert.equal(ciChangeScope([...fixturePaths,'app/AshfallGame.tsx'],{draft:false,sourceBlobs:fixtureBlobs,reuseCombatFixture:true}).full,true);
});

test('fixture continuation cannot adopt an unfinished, failed or missing combat group or an altered failed Verify',async()=>{
  const index=repairJobs.findIndex(j=>j.name==='V1.0.2 Combat (webkit phone-short)'),verify=repairJobs.findIndex(j=>j.name==='PR Verify');
  for(const field of [{conclusion:'failure'},{conclusion:'skipped'},{conclusion:'cancelled'},{status:'in_progress'},
    {run_attempt:2},{run_attempt:undefined},{head_sha:old.head},{run_id:old.runId},{id:repairJobs[0].id}]){
    const jobs=repairJobs.map((j,i)=>i===index?{...j,...field}:j);
    assert.equal((await previousCombatFixtureEvidence({...fixtureOptions,request:fixtureApi({jobs})})).passed,false);
  }
  for(const jobs of [repairJobs.slice(1),[...repairJobs,repairJobs[0]],repairJobs.map((j,i)=>i===verify?{...j,conclusion:'success'}:j),
    repairJobs.map((j,i)=>i===verify?{...j,steps:j.steps.map(s=>s.name==='Lint'?{...s,conclusion:'failure'}:s)}:j)])
    assert.equal((await previousCombatFixtureEvidence({...fixtureOptions,request:fixtureApi({jobs})})).passed,false);
  for(const run of [{...repairRun,status:'in_progress'},{...repairRun,run_attempt:2},{...repairRun,head_sha:old.head},
    {...repairRun,conclusion:'cancelled'},{...repairRun,pull_requests:[]}])
    assert.equal((await previousCombatFixtureEvidence({...fixtureOptions,request:fixtureApi({run})})).passed,false);
  const zip=Buffer.from(repairProvenance.zip);zip[zip.length-1]^=1;
  assert.equal((await previousCombatFixtureEvidence({...fixtureOptions,request:fixtureApi({zip})})).passed,false);
  assert.equal((await previousCombatFixtureEvidence({...fixtureOptions,request:fixtureApi({original:{run:{...originalRun,conclusion:'cancelled'}}})})).passed,false);
});
