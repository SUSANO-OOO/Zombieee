import test from 'node:test';
import assert from 'node:assert/strict';
import {ciChangeScope,framePerformanceRuntimes,previousFullCiEvidence,previousQualityEvidence,
 previousAbilityNameEvidence,reviewedAbilityNamePaths,reviewedAbilityContinuationPaths,ABILITY_NAME_BASELINE,ABILITY_NAME_PREDECESSOR,ABILITY_NAME_BLOBS,ABILITY_NAME_REUSED_JOBS,RANGER_BUFFER_FILE,RANGER_BUFFER_BLOB} from '../scripts/ci-change-scope.mjs';
import {assertEphemeralPerformanceHost} from '../scripts/v100-macos-indexing-control.mjs';
import {readFileSync} from 'node:fs';
import {load} from 'js-yaml';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {provenanceFixture} from './helpers/ci-pr-provenance.mjs';

test('the exact reviewed QA continuation keeps original6a owners, requires product ancestry and never adopts failed predecessor gates',async()=>{
 const old=ABILITY_NAME_BASELINE,prev=ABILITY_NAME_PREDECESSOR,
   paths=['scripts/ci-change-scope.mjs','scripts/v177-normal-browser-deadline.mjs','scripts/v100-phase-g-production-matrix.mjs',
     'scripts/v105-five-corrections-capture.mjs','scripts/v177-native-allunit-recovery.json','docs/qa/v105/five-corrections-6a-evidence.json'],
   sourceBlobs={...ABILITY_NAME_BLOBS},owner={run_id:old.runId,head_sha:old.head,run_attempt:1},
   jobs=ABILITY_NAME_REUSED_JOBS.map((name,i)=>({id:700+i,name,...owner,status:'completed',conclusion:'success'})),
   oldRun={id:old.runId,head_sha:old.head,status:'completed',conclusion:'failure',run_attempt:1,event:'pull_request',pull_requests:[{number:181}]},
   predecessor={...oldRun,id:prev.runId,head_sha:prev.head},
   original=provenanceFixture({runId:old.runId,head:old.head,base:old.base,artifactId:91}),
   previous=provenanceFixture({runId:prev.runId,head:prev.head,base:old.base,artifactId:92});
 const api=({previousRun=predecessor,rows=jobs,previousProof=previous}={})=>async url=>({ok:true,
   arrayBuffer:async()=>url.includes('/92/')?previousProof.zip:original.zip,
   json:async()=>url.includes('/artifacts?')?(url.includes('/'+prev.runId+'/')?previousProof.artifacts:original.artifacts)
     :url.includes('/jobs?')?{total_count:rows.length,jobs:rows}:url.endsWith('/'+prev.runId)?previousRun:oldRun});
 const options={repository:'SUSANO-OOO/Zombieee',previousHead:prev.head,base:old.base,prNumber:181,action:'synchronize',draft:false,
   paths,sourceBlobs,productUnchanged:true,originalAncestor:true,token:'fixture-only'};
 const evidence=await previousAbilityNameEvidence({...options,request:api()});assert.equal(evidence.passed,true);
 assert.equal(evidence.head,old.head);assert.equal(evidence.runId,old.runId);assert.equal(evidence.predecessor.head,prev.head);
 assert.equal(evidence.predecessor.conclusion,'failure');assert.equal(evidence.predecessor.measurementOwnersAdopted,false);
 assert.equal(evidence.predecessor.provenance.head,prev.head);assert.equal(evidence.provenance.head,old.head);
 assert.equal(evidence.reusedJobs.length,43);assert.ok(evidence.reusedJobs.every(j=>j.head_sha===old.head&&j.run_id===old.runId));
 for(const field of ['freshVerifyRequired','freshPerformanceRequired','freshPhaseGRequired','freshNormalRequired'])assert.equal(evidence[field],true);
 const scope=ciChangeScope(paths,{draft:false,sourceBlobs,reuseAbilityNames:true,freshNormal:true});
 assert.equal(scope.full,false);for(const field of ['verify_full','performance','phaseg','normal'])assert.equal(scope[field],true);
 assert.equal(scope.r9,false);assert.equal(scope.wholeGameAccepted,false);
 assert.equal(reviewedAbilityNamePaths(paths,sourceBlobs),false);assert.equal(reviewedAbilityContinuationPaths(paths,sourceBlobs),true);
 for(const bad of [{productUnchanged:false},{originalAncestor:false},{previousHead:'f'.repeat(40)},
   {base:'f'.repeat(40)},{prNumber:180},{action:'ready_for_review'},{draft:true},
   {paths:[...paths,'app/AshfallGame.tsx']},{paths:[...paths,'package-lock.json']},
   {sourceBlobs:{...sourceBlobs,'app/AshfallGame.tsx':'f'.repeat(40)}},
   {sourceBlobs:{...sourceBlobs,'.github/workflows/ci.yml':null}}])
  assert.equal((await previousAbilityNameEvidence({...options,...bad,request:()=>assert.fail('Reject unknown continuation before network')})).passed,false);
 for(const patch of [{id:1},{head_sha:old.head},{status:'in_progress'},{conclusion:'cancelled'},{run_attempt:2},{pull_requests:[]}])
  assert.equal((await previousAbilityNameEvidence({...options,request:api({previousRun:{...predecessor,...patch}})})).passed,false);
 const rangerPaths=[...paths,RANGER_BUFFER_FILE],rangerOptions={...options,paths:rangerPaths,productUnchanged:false,rangerBufferDelta:true};
 const rangerEvidence=await previousAbilityNameEvidence({...rangerOptions,request:api()});assert.equal(rangerEvidence.passed,true);
 assert.equal(rangerEvidence.productUnchanged,false);assert.equal(rangerEvidence.rangerBufferDelta,true);
 assert.equal(rangerEvidence.reusedJobs.length,42);assert.equal(rangerEvidence.reusedJobs.some(j=>j.name==='Ranger Turn Regression'),false);
 assert.equal(sourceBlobs[RANGER_BUFFER_FILE],RANGER_BUFFER_BLOB);
 const oldNormalJobs=['chromium','webkit'].map((engine,i)=>({id:900+i,name:'V1 Representative Normal Play ('+engine+')',...owner,status:'completed',conclusion:'success'}));
 const stillFresh=await previousAbilityNameEvidence({...rangerOptions,request:api({rows:[...jobs,...oldNormalJobs]})});assert.equal(stillFresh.passed,true);assert.equal(stillFresh.freshNormalRequired,true);assert.equal(stillFresh.reusedJobs.length,42);
 const rangerScope=ciChangeScope(rangerPaths,{draft:false,sourceBlobs,reuseAbilityNames:true,freshNormal:true});
 assert.equal(rangerScope.full,false);for(const f of ['verify_full','performance','phaseg','normal','ranger','allunit'])assert.equal(rangerScope[f],true);
 for(const bad of [{rangerBufferDelta:false},{productUnchanged:true},{sourceBlobs:{...sourceBlobs,[RANGER_BUFFER_FILE]:'f'.repeat(40)}},{paths:[...rangerPaths,'app/unknown.js']}])
  assert.equal((await previousAbilityNameEvidence({...rangerOptions,...bad,request:()=>assert.fail('Reject unrelated product changes before network')})).passed,false);
 assert.equal(reviewedAbilityNamePaths([...Object.keys(ABILITY_NAME_BLOBS)],sourceBlobs),false,'The old display-only entry cannot adopt a new Ranger renderer');
 const wrongProof=provenanceFixture({runId:prev.runId,head:prev.head,base:'f'.repeat(40),artifactId:92});
 assert.equal((await previousAbilityNameEvidence({...options,request:api({previousProof:wrongProof})})).passed,false);
 const lost=jobs.map((j,i)=>i?j:{...j,conclusion:'failure'});
 assert.equal((await previousAbilityNameEvidence({...options,request:api({rows:lost})})).passed,false);
});

test('the exact boss-label deletion retains successful browser owners but repeats Verify, performance and unfinished normal play',async()=>{
 const old=ABILITY_NAME_BASELINE,paths=[...Object.keys(ABILITY_NAME_BLOBS).filter(f=>f!==RANGER_BUFFER_FILE),'scripts/ci-change-scope.mjs','tests/ci-combat-qa-reuse.test.mjs'];
 const sourceBlobs={...ABILITY_NAME_BLOBS},options={repository:'SUSANO-OOO/Zombieee',previousHead:old.head,base:old.base,prNumber:181,
  action:'synchronize',draft:false,paths,sourceBlobs,token:'fixture-only'};
 const fixture=provenanceFixture({runId:old.runId,head:old.head,base:old.base});
 const run={id:old.runId,head_sha:old.head,status:'completed',conclusion:'failure',run_attempt:1,event:'pull_request',pull_requests:[{number:181}]};
 const owner={run_id:old.runId,head_sha:old.head,run_attempt:1};
 const jobs=ABILITY_NAME_REUSED_JOBS.map((name,i)=>({id:700+i,name,...owner,status:'completed',conclusion:'success'}));
 jobs.push({id:900,name:'PR Verify',status:'completed',conclusion:'failure'},
  {id:901,name:'V1 Representative Normal Play (chromium)',status:'completed',conclusion:'failure'},
  {id:902,name:'V1 Representative Normal Play (webkit)',status:'completed',conclusion:'success'});
 for(const job of jobs)Object.assign(job,owner);
 const api=(r=run,rows=jobs)=>async url=>({ok:true,arrayBuffer:async()=>fixture.zip,
  json:async()=>url.includes('/artifacts?')?fixture.artifacts:url.includes('/jobs?')?{total_count:rows.length,jobs:rows}:r});
 assert.equal(ABILITY_NAME_REUSED_JOBS.includes('V1 Phase G Production Matrix'),false,'Failed input QA needs a new real run');
 assert.ok(ABILITY_NAME_REUSED_JOBS.includes('R9 Story (webkit, full-story, 844x340)'));
 assert.ok(ABILITY_NAME_REUSED_JOBS.includes('V1 Native WebKit PWA Update and Recovery'));
 const evidence=await previousAbilityNameEvidence({...options,request:api()});assert.equal(evidence.passed,true);
 assert.equal(evidence.head,old.head);assert.equal(evidence.provenance.base,old.base);
 assert.equal(evidence.freshVerifyRequired,true);assert.equal(evidence.freshPerformanceRequired,true);assert.equal(evidence.freshNormalRequired,true);
 assert.equal(evidence.freshPhaseGRequired,true);
 assert.equal(evidence.reusedJobs.some(j=>j.name==='PR Verify'),false,'A failed Verify is never an accepted old owner');
 const scope=ciChangeScope(paths,{draft:false,sourceBlobs,reuseAbilityNames:true,freshNormal:evidence.freshNormalRequired});
 assert.equal(scope.full,false);assert.equal(scope.verify_full,true);assert.equal(scope.performance,true);assert.equal(scope.normal,true);
 assert.equal(scope.phaseg,true);
 assert.equal(scope.r9,false);assert.equal(scope.wholeGameAccepted,false);
 const completedNormal=jobs.map(j=>j.name==='V1 Representative Normal Play (chromium)'?{...j,conclusion:'success'}:j);
 assert.equal((await previousAbilityNameEvidence({...options,request:api(run,completedNormal)})).freshNormalRequired,true,'Changed phase reader requires fresh observation even after an old success');
 const normalEvidence=await previousAbilityNameEvidence({...options,paths:paths.filter(p=>p!=='scripts/v177-representative-battles.mjs'),request:api(run,completedNormal)});
 assert.equal(normalEvidence.freshNormalRequired,false);
 assert.deepEqual(normalEvidence.reusedJobs.filter(j=>j.name.startsWith('V1 Representative Normal Play'))
  .map(j=>({id:j.id,run_id:j.run_id,head_sha:j.head_sha,run_attempt:j.run_attempt})),[{id:901,...owner},{id:902,...owner}]);
 for(const conclusion of ['failure','cancelled','skipped']){
  const rows=jobs.map((j,i)=>i===0?{...j,conclusion}:j);
  assert.equal((await previousAbilityNameEvidence({...options,request:api(run,rows)})).passed,false);
 }
 for(const rows of [jobs.slice(1),[...jobs,jobs[0]]])assert.equal((await previousAbilityNameEvidence({...options,request:api(run,rows)})).passed,false);
 for(const bad of [{run_id:1},{head_sha:'b'.repeat(40)},{run_attempt:2},{id:0},{id:-1},{id:jobs[1].id}]){
  const rows=jobs.map((j,i)=>i===0?{...j,...bad}:j);assert.equal((await previousAbilityNameEvidence({...options,request:api(run,rows)})).passed,false);
 }
 for(const key of ['run_id','head_sha','run_attempt']){const rows=structuredClone(jobs);delete rows[0][key];
  assert.equal((await previousAbilityNameEvidence({...options,request:api(run,rows)})).passed,false);}
 const wrongNormal=completedNormal.map(j=>j.id===901?{...j,run_attempt:2}:j);
 assert.equal((await previousAbilityNameEvidence({...options,request:api(run,wrongNormal)})).passed,false);
 for(const r of [{...run,id:1},{...run,status:'in_progress'},{...run,run_attempt:2},{...run,head_sha:'b'.repeat(40)},{...run,pull_requests:[]}])
  assert.equal((await previousAbilityNameEvidence({...options,request:api(r)})).passed,false);
 for(const bad of [{base:'b'.repeat(40)},{action:'ready_for_review'},{previousHead:'b'.repeat(40)},
  {paths:[...paths,'app/v100Save.js']},{sourceBlobs:{...sourceBlobs,'app/AshfallGame.tsx':'f'.repeat(40)}}]){
  assert.equal((await previousAbilityNameEvidence({...options,...bad,request:()=>assert.fail('Unknown delta must reject before network')})).passed,false);
 }
 assert.equal(reviewedAbilityNamePaths(paths,sourceBlobs),true);
 for(const j of jobs)Object.assign(j,{started_at:'2026-10-24T18:00:00Z',completed_at:'2026-10-24T18:01:00Z',runner_id:1,runner_name:'fixture-host',
   steps:[{name:'original',number:1,status:'completed',conclusion:'success',started_at:'2026-10-24T18:00:00Z',completed_at:'2026-10-24T18:01:00Z'}]});
 const hudName='WebKit Canonical Viewport Evidence (844x340)',hud=jobs.find(j=>j.name===hudName),
   step=(name,conclusion)=>({name,status:'completed',conclusion,number:name.startsWith('Setup')?1:name.startsWith('Capture')?2:3,
    started_at:'2026-10-24T18:00:00Z',completed_at:'2026-10-24T18:00:00Z'}),
   failedHud={...hud,id:120981969541,conclusion:'failure',steps:[step('Setup Node.js','failure'),step('Capture canonical HUD evidence','skipped')]},
   originalJobs=[...jobs.map(j=>j===hud?failedHud:j),{id:120949556263,name:'V1 Guardian Control Diagnostic',...owner,status:'completed',conclusion:'skipped',
     runner_id:null,runner_name:null,steps:[],started_at:'2026-10-24T18:01:01Z',completed_at:'2026-10-24T18:01:00Z'}],
   retryHud={...hud,id:120999999999,run_attempt:2,started_at:'2026-10-24T19:00:00Z',completed_at:'2026-10-24T19:01:00Z',steps:[step('Setup Node.js','success'),step('Capture canonical HUD evidence','success'),step('Upload canonical WebKit viewport evidence','success')]},
   aliases=originalJobs.filter(j=>j.name!==hudName).map((j,i)=>({...structuredClone(j),id:130000000000+i,run_attempt:2,
     ...(j.conclusion==='skipped'?{started_at:'2026-10-24T19:00:01Z'}:{})})),
   recoveredJobs=[...aliases,retryHud];
 const retryApi=(retry=recoveredJobs,original=originalJobs)=>async url=>({ok:true,arrayBuffer:async()=>fixture.zip,
   json:async()=>url.includes('/artifacts?')?fixture.artifacts:url.includes('/attempts/2/jobs?')?{total_count:retry.length,jobs:retry}
    :url.includes('/attempts/1/jobs?')?{total_count:original.length,jobs:original}:{...run,run_attempt:2}});
 const recovered=await previousAbilityNameEvidence({...options,request:retryApi()});assert.equal(recovered.passed,true);
 assert.equal(recovered.originalRunConclusion,'failure');assert.equal(recovered.infrastructureRecovery.original.id,failedHud.id);
 assert.deepEqual(recovered.reusedJobs.filter(j=>j.name===hudName).map(j=>({id:j.id,attempt:j.run_attempt})),[{id:retryHud.id,attempt:2}]);
 assert.ok(recovered.reusedJobs.filter(j=>j.name!==hudName).every(j=>j.run_attempt===1),'Earlier successes keep their actual attempt1 owners');
 for(const bad of [{run_id:1},{head_sha:'f'.repeat(40)},{run_attempt:1},{id:failedHud.id},{name:'other'},
   {conclusion:'skipped'},{status:'in_progress'},{steps:[]},{started_at:failedHud.started_at}])
   assert.equal((await previousAbilityNameEvidence({...options,request:retryApi([...aliases,{...retryHud,...bad}])})).passed,false);
 for(const retry of [[],[...aliases,retryHud,retryHud],recoveredJobs.slice(1)])assert.equal((await previousAbilityNameEvidence({...options,request:retryApi(retry)})).passed,false);
 for(const bad of [{started_at:'2026-10-24T19:00:00Z'},{runner_id:999},{steps:[step('other','success')]},{conclusion:'failure'},{head_sha:'f'.repeat(40)}]){
   const changed=recoveredJobs.map((j,i)=>i===0?{...j,...bad}:j);assert.equal((await previousAbilityNameEvidence({...options,request:retryApi(changed)})).passed,false,'Another execution cannot be hidden as a carried result');
 }
 assert.equal((await previousAbilityNameEvidence({...options,request:retryApi(recoveredJobs,jobs)})).passed,false,'An unrelated failure cannot use the known DNS recovery');
 for(const key of ['started_at','completed_at','runner_id','runner_name','steps']){
   const first=originalJobs[0].name,missingOriginal=structuredClone(originalJobs),missingRetry=structuredClone(recoveredJobs);
   delete missingOriginal[0][key];delete missingRetry.find(j=>j.name===first)[key];
   assert.equal((await previousAbilityNameEvidence({...options,request:retryApi(missingRetry,missingOriginal)})).passed,false,
     'Missing execution metadata cannot prove that a new-ID record is only a carried copy');
 }
 for(const key of ['name','number','status','conclusion','started_at','completed_at']){
   const missingOriginal=structuredClone(originalJobs),missingRetry=structuredClone(recoveredJobs);
   delete missingOriginal[0].steps[0][key];delete missingRetry.find(j=>j.name===originalJobs[0].name).steps[0][key];
   assert.equal((await previousAbilityNameEvidence({...options,request:retryApi(missingRetry,missingOriginal)})).passed,false);
 }
 for(const key of ['runner_id','runner_name']){
   const missingRetry=structuredClone(recoveredJobs);delete missingRetry.find(j=>j.name===hudName)[key];
   assert.equal((await previousAbilityNameEvidence({...options,request:retryApi(missingRetry)})).passed,false);
 }
 for(const patch of [{runner_id:1},{steps:[step('unexpected','success')]},{conclusion:'success'},{completed_at:'2026-10-24T19:00:00Z'}]){
   const changed=recoveredJobs.map(j=>j.name==='V1 Guardian Control Diagnostic'?{...j,...patch}:j);
   assert.equal((await previousAbilityNameEvidence({...options,request:retryApi(changed)})).passed,false);
 }
 assert.equal(ciChangeScope([...paths,'app/unknown.js'],{draft:false,sourceBlobs,reuseAbilityNames:true}).full,true);
 assert.equal(ciChangeScope(paths,{draft:false,sourceBlobs}).full,true,'No verified preceding browser owners means full regression');
});
test('a ready candidate always gets full regression, including governance-only changes',()=>{
 for(const paths of [['AGENTS.md'],['tests/ci-contract.test.mjs'],['app/v177RangerFootPlacement.js']]){
  const scope=ciChangeScope(paths,{draft:false});assert.equal(scope.full,true);assert.equal(scope.ranger,true);assert.equal(scope.normal,true);
  assert.equal(scope.wholeGameAccepted,false);
 }
});

test('display-only continuation retains Quality only with its own two exact-head engine owners',async()=>{
 const b=ABILITY_NAME_BASELINE,displayEvidence={passed:true,head:b.head,base:b.base,prNumber:181,
  freshVerifyRequired:true,freshPerformanceRequired:true,freshPhaseGRequired:true};
 const run={id:40120044478,head_sha:b.head,status:'completed',conclusion:'success',event:'pull_request',run_attempt:1,pull_requests:[{number:181}]};
 const jobs=['chromium','webkit'].map((engine,i)=>({id:100+i,name:`V1 Quality UI and Play (${engine})`,
  status:'completed',conclusion:'success',run_id:run.id,head_sha:b.head,run_attempt:1}));
 const api=(r=run,rows=jobs)=>async url=>({ok:true,json:async()=>url.includes('/jobs?')?{total_count:rows.length,jobs:rows}:{workflow_runs:[r]}});
 const options={repository:'SUSANO-OOO/Zombieee',head:b.head,prNumber:181,token:'fixture-only',displayEvidence};
 assert.equal((await previousQualityEvidence({...options,request:api()})).passed,true);
 for(const bad of [{run_id:1},{head_sha:'f'.repeat(40)},{run_attempt:2},{conclusion:'failure'},{id:0}])
  assert.equal((await previousQualityEvidence({...options,request:api(run,jobs.map((j,i)=>i?j:{...j,...bad}))})).passed,false);
 for(const rows of [jobs.slice(1),[jobs[0],jobs[0]],[]])assert.equal((await previousQualityEvidence({...options,request:api(run,rows)})).passed,false);
 assert.equal((await previousQualityEvidence({...options,displayEvidence:{...displayEvidence,freshPhaseGRequired:false},
  request:()=>assert.fail('Unverified source owner cannot request Quality reuse')})).passed,false);
});

test('WebKit mirror preparation is QA-only on Draft and retains full Ready checks',()=>{
 const paths=['scripts/v177-quality-apt-mirror.mjs','.github/workflows/v1-quality-acceptance.yml',
  'scripts/ci-change-scope.mjs','tests/v177-quality-apt-mirror.test.mjs'];
 const draft=ciChangeScope(paths,{draft:true});assert.equal(draft.full,false);
 assert.equal(draft.wholeGameAccepted,false);assert.equal(draft.finalIntegrationRequiresFullRegression,true);
 assert.equal(ciChangeScope(paths,{draft:false}).full,true);
 assert.equal(ciChangeScope([...paths,'scripts/unknown.mjs'],{draft:true}).full,true);
});

test('the reviewed Ranger readback split targets affected draft lanes while Ready and unknown sources stay full',()=>{
 const file='app/v177RangerLowerPaint.js',blob=execFileSync('git',['rev-parse','e22b134a38409b9d2f86660ee351e616c28fbf44:'+file],{encoding:'utf8',windowsHide:true}).trim();
 const paths=[file,'assets/source/v177/ranger/lower-r3/provenance.json','scripts/v177-native-allunit-recovery.json',
  'scripts/ci-change-scope.mjs','tests/ci-change-scope.test.mjs','tests/v177-ranger-continuous-lower.test.mjs','docs/PROJECT_STATE.md'];
 const options={draft:true,sourceBlobs:{[file]:blob}},scope=ciChangeScope(paths,options);
 assert.equal(scope.full,false);assert.equal(scope.ranger,true);assert.equal(scope.normal,true);assert.equal(scope.allunit,true);assert.equal(scope.r9,false);
 assert.equal(scope.finalIntegrationRequiresFullRegression,true);assert.equal(scope.wholeGameAccepted,false);
 assert.equal(ciChangeScope(paths,{...options,draft:false}).full,true);
 for(const sourceBlobs of [{},{[file]:'f'.repeat(40)}])assert.equal(ciChangeScope(paths,{draft:true,sourceBlobs}).full,true);
 const current=execFileSync('git',['hash-object',file],{encoding:'utf8',windowsHide:true}).trim();
 assert.notEqual(current,blob);assert.equal(ciChangeScope(paths,{draft:true,sourceBlobs:{[file]:current}}).full,true,'A new raster algorithm must reopen full regression');
 for(const unknown of ['app/v100Save.js','public/future-asset.webp','unknown'])assert.equal(ciChangeScope([...paths,unknown],options).full,true);
 assert.equal(framePerformanceRuntimes(paths).find(r=>r.runtime==='formal').runtime,'formal');
});

test('completed full evidence may retain only the exact reviewed correction QA or status paths',()=>{
 const files=['.github/workflows/five-corrections-capture.yml','scripts/v105-five-corrections-capture.mjs','tests/v177-native-allunit-recording-runtime.test.mjs'];
 const sourceBlobs=Object.fromEntries(files.map(file=>[file,execFileSync('git',['rev-parse','c4e146f664a9c6801c2e404c59f0d3b8a1f5a1ce:'+file],{encoding:'utf8',windowsHide:true}).trim()]));
 for(const paths of [files,['docs/PROJECT_STATE.md']]){
  const scope=ciChangeScope(paths,{draft:false,reuseNativeQa:true,sourceBlobs});
  for(const lane of ['full','ranger','normal','allunit','r9','combat','wholeGameAccepted'])assert.equal(scope[lane],false);
  assert.equal(ciChangeScope(paths,{draft:false,sourceBlobs}).full,true,'No previous successful full owner means no reuse');
  for(const extra of ['app/v177RangerLowerPaint.js','public/asset-manifest.json','package-lock.json','unknown','scripts/ci-change-scope.mjs'])
    assert.equal(ciChangeScope([...paths,extra],{draft:false,reuseNativeQa:true,sourceBlobs}).full,true);
 }
 for(const file of files)assert.equal(ciChangeScope(files,{draft:false,reuseNativeQa:true,sourceBlobs:{...sourceBlobs,[file]:'f'.repeat(40)}}).full,true);
 const native=load(readFileSync('.github/workflows/native-allunit-capture.yml','utf8'));
 assert.equal(native.jobs.scope.outputs.full,'${{ steps.scope.outputs.full }}');assert.equal(native.jobs.scope.permissions.actions,'read');
 const condition=native.jobs.build.if;assert.ok(condition.includes("github.event_name == 'workflow_dispatch'"));
 assert.ok(condition.includes("needs.scope.outputs.full == 'true' || needs.scope.outputs.allunit == 'true'"));
 assert.ok(!condition.includes('!github.event.pull_request.draft'));
 const quality=load(readFileSync('.github/workflows/v1-quality-acceptance.yml','utf8'));
 assert.ok(quality.concurrency.group.includes('github.event.pull_request.head.sha'));assert.equal(quality.concurrency['cancel-in-progress'],false);
});

test('Quality reuse keeps its own successful two-engine owner and never inherits a missing, partial or failed result',async()=>{
 const head='a'.repeat(40),prNumber=181,options={repository:'SUSANO-OOO/Zombieee',head,prNumber,token:'test-only',fullEvidence:{passed:true,head,prNumber}};
 const run={id:81,head_sha:head,status:'completed',conclusion:'success',pull_requests:[{number:prNumber}]};
 const jobs=['chromium','webkit'].map((name,i)=>({id:101+i,name:`V1 Quality UI and Play (${name})`,status:'completed',conclusion:'success'}));
 const request=(runs,rows)=>async url=>({ok:true,json:async()=>url.includes('workflows/')?{workflow_runs:runs}:{jobs:rows}});
 assert.deepEqual(await previousQualityEvidence({...options,request:request([run],jobs)}),{passed:true,head,prNumber,runId:81,jobIds:[101,102]});
 for(const bad of [{...run,head_sha:'b'.repeat(40)},{...run,status:'in_progress'},{...run,conclusion:'failure'},{...run,conclusion:'cancelled'},{...run,pull_requests:[]}])
  assert.equal((await previousQualityEvidence({...options,request:request([bad],jobs)})).passed,false);
 for(const rows of [[],jobs.slice(0,1),[...jobs,jobs[0]],[jobs[0],{...jobs[1],conclusion:'skipped'}],[jobs[0],{...jobs[1],conclusion:'failure'}]])
  assert.equal((await previousQualityEvidence({...options,request:request([run],rows)})).passed,false);
 for(const fullEvidence of [null,{passed:false},{passed:true,head:'b'.repeat(40),prNumber}])
  assert.equal((await previousQualityEvidence({...options,fullEvidence,request:()=>assert.fail('Unverified full must not query or inherit Quality')})).passed,false);
 assert.equal((await previousQualityEvidence({...options,request:async()=>{throw Error('offline');}})).passed,false);
});

test('native-only synchronize updates retain product lanes without waiving their unfinished gates',()=>{
 const paths=['scripts/v177-native-canvas-clips.mjs','scripts/v177-native-allunit-recovery.json',
  'tests/v177-native-realm-owner.test.mjs','docs/PROJECT_STATE.md'];
 const scoped=ciChangeScope(paths,{draft:false,reuseNativeQa:true});
 assert.equal(scoped.full,false);assert.equal(scoped.allunit,true);
 for(const lane of ['ranger','normal','r9','wholeGameAccepted'])assert.equal(scoped[lane],false);
 assert.equal(scoped.finalIntegrationRequiresFullRegression,true);
 assert.equal(ciChangeScope(paths,{draft:false}).full,true,'Ready transitions keep full regression');
 for(const file of ['app/AshfallGame.tsx','public/asset-manifest.json','package-lock.json','unknown',
  '.github/workflows/ci.yml','scripts/ci-change-scope.mjs','docs/PRODUCER_DECISIONS_1.0.3.md',
  'tests/v100-r9-full-story.test.mjs','tests/ci-change-scope.test.mjs','tests/future-unknown.test.mjs'])
   assert.equal(ciChangeScope([...paths,file],{draft:false,reuseNativeQa:true}).full,true,file);
 const workflow=load(readFileSync('.github/workflows/ci.yml','utf8'));
 assert.equal(workflow.jobs.scope.steps.find(step=>step.id==='scope').env.CI_SCOPE_ACTION,'${{ github.event.action }}');
 assert.equal(workflow.jobs.scope.steps.find(step=>step.id==='scope').env.CI_SCOPE_PREVIOUS_HEAD,'${{ github.event.before }}');
 assert.equal(workflow.jobs.scope.steps.find(step=>step.id==='scope').env.CI_SCOPE_PR_BASE,'${{ github.event.pull_request.base.sha }}');
 assert.equal(workflow.jobs.scope.steps.find(step=>step.id==='scope').env.CI_SCOPE_PR_NUMBER,'${{ github.event.pull_request.number }}');
});

test('native Ready reuse requires a successful exact-head CI and its full-only production job',async()=>{
 const head='a'.repeat(40),base='c'.repeat(40),prNumber=180,options={repository:'SUSANO-OOO/Zombieee',head,base,prNumber,token:'test-only'},calls=[];
 const run={id:51,head_sha:head,status:'completed',conclusion:'success',pull_requests:[{number:prNumber,head:{sha:head},base:{sha:base}}]};
 const phaseG={id:73,name:'V1 Phase G Production Matrix',status:'completed',conclusion:'success'};
 const fixture=provenanceFixture({runId:51,head,base});
 const request=(runs,jobs)=>async url=>{calls.push(url);return{ok:true,arrayBuffer:async()=>fixture.zip,
  json:async()=>url.includes('workflows/')?{workflow_runs:runs}:url.includes('/artifacts?')?fixture.artifacts:{jobs}};};
 const {provenance,...accepted}=await previousFullCiEvidence({...options,request:request([run],[phaseG])});
 assert.deepEqual(accepted,{passed:true,head,base,prNumber,runId:51,fullOnlyJobId:73});
 assert.equal(provenance.head,head);assert.equal(provenance.base,base);assert.equal(provenance.artifactDigest,fixture.artifact.digest);
 for(const bad of [{...run,head_sha:'b'.repeat(40)},{...run,status:'in_progress'},{...run,conclusion:'failure'},{...run,conclusion:'cancelled'},
  {...run,pull_requests:[]},{...run,pull_requests:[{number:181,head:{sha:head},base:{sha:base}}]},
  ])
   assert.equal((await previousFullCiEvidence({...options,request:request([bad],[phaseG])})).passed,false);
 const live={...run,pull_requests:[{number:prNumber,head:{sha:'b'.repeat(40)},base:{sha:'d'.repeat(40)}}]};
 assert.equal((await previousFullCiEvidence({...options,request:request([live],[phaseG])})).passed,true,'live PR tips cannot replace immutable checkout provenance');
 assert.equal((await previousFullCiEvidence({...options,base:'d'.repeat(40),request:request([live],[phaseG])})).passed,false,'a changed actual base is not reusable');
 for(const jobs of [[],[{...phaseG,conclusion:'skipped'}],[{...phaseG,conclusion:'failure'}],[{...phaseG,name:'PR Verify'}]])
   assert.equal((await previousFullCiEvidence({...options,request:request([run],jobs)})).passed,false);
 assert.equal((await previousFullCiEvidence({...options,request:async()=>{throw Error('offline');}})).passed,false);
 assert.equal((await previousFullCiEvidence({...options,token:'',request:()=>assert.fail('No token must not issue a request')})).passed,false);
 assert.ok(calls.every(url=>url.startsWith('https://api.github.com/repos/SUSANO-OOO/Zombieee/')));
});

test('only the exact formal job correction avoids duplicating its unchanged running native control',()=>{
 const file='.github/workflows/targeted-frame-performance.yml';
 const workflowBlob='774c4b1f8589ea83b407ef385bb09b1904519645';
 assert.deepEqual(framePerformanceRuntimes([file,'scripts/ci-change-scope.mjs','tests/ci-change-scope.test.mjs'],{workflowBlob}).map(r=>r.runtime),['formal']);
 for(const paths of [[file,'app/AshfallGame.tsx'],[file,'scripts/v100-device-runtime-browser.mjs'],[file,'unknown']])assert.equal(framePerformanceRuntimes(paths,{workflowBlob}).length,2);
 assert.equal(framePerformanceRuntimes([file],{workflowBlob:'f'.repeat(40)}).length,2);
 assert.deepEqual(framePerformanceRuntimes(['docs/PROJECT_STATE.md','tests/v177-melee-joints.test.mjs'],{workflowBlob}),[]);
 const workflow=load(readFileSync(file,'utf8'));
 const job='v100-webkit-frame-control';assert.ok(workflow.jobs[job]);assert.equal(workflow.on.workflow_dispatch,undefined);
 assert.doesNotThrow(()=>assertEphemeralPerformanceHost({GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'macOS',
  GITHUB_REPOSITORY:'SUSANO-OOO/Zombieee',GITHUB_EVENT_NAME:'pull_request',GITHUB_JOB:job,GITHUB_RUN_ID:'39589154684',GITHUB_SHA:'1'.repeat(40)},'darwin','arm64'));
});

test('native host control is source-pinned and never repeats unchanged formal performance or story',()=>{
 const file='scripts/v100-macos-indexing-control.mjs',blob=execFileSync('git',['hash-object',file],{encoding:'utf8',windowsHide:true}).trim();
 const options={draft:true,sourceBlobs:{[file]:blob}},scope=ciChangeScope([file],options);
 assert.equal(scope.full,false);assert.equal(scope.allunit,true);assert.equal(scope.normal,false);assert.equal(scope.r9,false);
 assert.deepEqual(framePerformanceRuntimes([file]),[]);
 for(const sourceBlobs of [{},{[file]:'f'.repeat(40)}])assert.equal(ciChangeScope([file],{draft:true,sourceBlobs}).full,true);
 assert.equal(ciChangeScope([file],{...options,draft:false}).full,true);
});

test('the reviewed hammer knee repair reopens motion without repeating unchanged normal play or R9',()=>{
 const paths=['app/v177JointPresentation.js','app/v177CorpseJointPresentation.js'];
 const sourceBlobs={'app/v177JointPresentation.js':'e2e63704e18e43718fb9a332b689bc0f3c55987e',
  'app/v177CorpseJointPresentation.js':'b339f6379b252c2687e16361004e184d3029a85b'};
 const scope=ciChangeScope(paths,{draft:true,sourceBlobs});
 assert.equal(scope.full,false);assert.equal(scope.allunit,true);
 assert.equal(scope.normal,false);assert.equal(scope.ranger,false);assert.equal(scope.r9,false);
 for(const file of paths)assert.equal(ciChangeScope(paths,{draft:true,sourceBlobs:{...sourceBlobs,[file]:'f'.repeat(40)}}).full,true);
 assert.equal(ciChangeScope(paths,{draft:false,sourceBlobs}).full,true);
 assert.equal(ciChangeScope([...paths,'app/v100Save.js'],{draft:true,sourceBlobs}).full,true);
});
test('ready events run integration gates and research cannot block representative observation',()=>{
 const workflow=load(readFileSync('.github/workflows/ci.yml','utf8'));
 assert.equal(workflow.concurrency['cancel-in-progress'],false,'Preserve running source-bound observation across QA/documentation pushes');
 assert.ok(workflow.on.pull_request.types.includes('ready_for_review'));
 assert.ok(workflow.jobs['v177-normal-campaign'].needs.every(id=>id==='scope'));
 assert.ok(workflow.jobs['ranger-turn-smoke'].if.includes('needs.scope.outputs.ranger'));
 assert.ok(workflow.jobs.verify.steps.some(step=>step.run==='node --test tests/*.test.mjs'));
 for(const job of Object.values(workflow.jobs))assert.equal(job['continue-on-error'],undefined);
 const research=load(readFileSync('.github/workflows/native-aac-probe.yml','utf8'));
 assert.equal(research.on.pull_request,undefined,'unchanged unadopted research runs only when requested');
 assert.ok(research.jobs['native-aac'].steps.some(step=>step.run?.endsWith('scripts/v177-native-aac-browser.mjs')));
 assert.ok(!JSON.stringify(workflow.jobs).includes('scripts/v177-native-aac-browser.mjs'));
 for(const path of ['native-allunit-capture','v1-quality-acceptance']){
  const gate=load(readFileSync(`.github/workflows/${path}.yml`,'utf8'));
  assert.ok(gate.on.pull_request.types.includes('ready_for_review'));
  if(path==='native-allunit-capture'){
    assert.ok(gate.jobs.build.if.includes("needs.scope.outputs.full == 'true' || needs.scope.outputs.allunit == 'true'"));
    const ready=ciChangeScope(['docs/PROJECT_STATE.md'],{draft:false});assert.equal(ready.full,true);assert.equal(ready.allunit,true);
  }else assert.ok(Object.values(gate.jobs).some(job=>job.if?.includes('!github.event.pull_request.draft')));
 }
});
test('draft changes select affected observation while unknown/shared/runtime inputs keep full regression',()=>{
 assert.equal(ciChangeScope(['docs/PROJECT_STATE.md'],{draft:true}).full,false);
 const motion=ciChangeScope(['app/v177RangerFootPlacement.js','tests/v177-ranger-foot-placement.test.mjs'],{draft:true});
 assert.equal(motion.ranger,true);assert.equal(motion.normal,false);assert.equal(motion.full,false);
 const guard=ciChangeScope(['scripts/silent-browser-output.mjs'],{draft:true});assert.equal(guard.ranger,true);assert.equal(guard.normal,false);
 const normal=ciChangeScope(['scripts/v100-normal-campaign-playthrough.mjs'],{draft:true});assert.equal(normal.normal,true);assert.equal(normal.ranger,false);
 const audio=ciChangeScope(['scripts/v177-normal-audio-unlock-observation.mjs'],{draft:true});
 assert.equal(audio.full,false);assert.equal(audio.normal,true);assert.equal(audio.allunit,false);assert.equal(audio.r9,false);
 for(const file of ['app/v177JointPresentation.js','app/audioOutput.js','app/v100Save.js','public/art/unit.webp','package-lock.json','unknown/path','docs/story/v10/全脚本_R9.md'])
  assert.equal(ciChangeScope([file],{draft:true}).full,true,file);
 for(const options of [{},{draft:undefined}])assert.throws(()=>ciChangeScope(['app/a.js'],options));
 for(const paths of [[],[''],['app\\a.js']])assert.throws(()=>ciChangeScope(paths,{draft:true}));
});

test('the reviewed outcome validator can recheck retained raw footage without reshooting successful cases',()=>{
 const file='scripts/v177-native-allunit-outcomes.mjs';
 const blob='12e9ee396cc426db1a46d942de515c14a54b774b';
 const options={draft:true,sourceBlobs:{[file]:blob}};
 const scoped=ciChangeScope([file,'tests/v177-native-allunit-outcomes.test.mjs'],options);
 assert.equal(scoped.full,false);assert.equal(scoped.allunit,false);assert.equal(scoped.r9,false);
 for(const sourceBlobs of [{},{[file]:'f'.repeat(40)}])assert.equal(ciChangeScope([file],{draft:true,sourceBlobs}).full,true);
 assert.equal(ciChangeScope([file,'app/v177JointPresentation.js'],options).full,true);
 assert.equal(ciChangeScope([file],{...options,draft:false}).full,true);
});

test('only the reviewed stricter raw-clock validator reuses untouched product performance and story',()=>{
 const file='scripts/v177-native-allunit-outcomes.mjs',blob='6d10a2beb094414f8b9b941d964962a3cc3f9f72';
 const sourceBlobs={[file]:blob},scope=ciChangeScope([file,'scripts/v177-native-game-capture-browser.mjs'],{draft:true,sourceBlobs});
 for(const gate of ['full','ranger','normal','r9'])assert.equal(scope[gate],false);
 assert.deepEqual(framePerformanceRuntimes([file,'scripts/v177-native-game-capture-browser.mjs']),[]);
 for(const sourceBlobs of [{},{[file]:'f'.repeat(40)}])assert.equal(ciChangeScope([file],{draft:true,sourceBlobs}).full,true);
 assert.equal(ciChangeScope([file],{draft:false,sourceBlobs}).full,true);
 assert.equal(ciChangeScope([file,'app/v100Save.js'],{draft:true,sourceBlobs}).full,true);
});

test('only the reviewed fixed-tick validator reuses raw Ranger footage without another capture',()=>{
 const file='scripts/v177-native-allunit-ranger-manual-contract.mjs',blob=execFileSync('git',['hash-object',file],{encoding:'utf8',windowsHide:true}).trim();
 const options={draft:true,sourceBlobs:{[file]:blob}},scope=ciChangeScope([file],options);
 assert.equal(scope.full,false);assert.equal(scope.allunit,false);assert.equal(scope.normal,false);assert.equal(scope.r9,false);
 for(const sourceBlobs of [{},{[file]:'f'.repeat(40)}])assert.equal(ciChangeScope([file],{draft:true,sourceBlobs}).full,true);
 assert.equal(ciChangeScope([file,'app/v100Save.js'],options).full,true);
 assert.equal(ciChangeScope([file],{...options,draft:false}).full,true);
});

test('the reviewed reload movement change runs native motion and normal play while retaining unchanged story evidence',()=>{
 const file='app/combatPresentation.js',blob='327c7a1dd55707c16385d01d28030a37dc4b27c7';
 const options={draft:true,sourceBlobs:{[file]:blob}},scope=ciChangeScope([file],options);
 assert.equal(scope.full,false);assert.equal(scope.allunit,true);assert.equal(scope.normal,true);assert.equal(scope.r9,false);
 for(const sourceBlobs of [{},{[file]:'f'.repeat(40)}])assert.equal(ciChangeScope([file],{draft:true,sourceBlobs}).full,true);
 assert.equal(ciChangeScope([file,'app/v100Save.js'],options).full,true);
 assert.equal(ciChangeScope([file],{...options,draft:false}).full,true);
});

test('the exact reviewed human death owner runs motion and normal play without repeating unchanged R9',()=>{
 const paths=['app/AshfallGame.tsx','app/v177JointPresentation.js','app/v177HumanCorpsePresentation.js',
  'scripts/v177-native-allunit-outcomes.mjs','scripts/v177-human-corpse-contract.mjs'];
 const sourceBlobs={'app/AshfallGame.tsx':'95df06a678e2be79ec076059df910dc95c33298c',
  'app/v177JointPresentation.js':'46309033f92f10577af7135f34d1215fa8292466',
  'app/v177HumanCorpsePresentation.js':'0422000720875df12b57c9c721fa4c13a8317869',
  'scripts/v177-native-allunit-outcomes.mjs':'3044d3a932b23e74eecc5e6a937aec1b5f36e7d1',
  'scripts/v177-human-corpse-contract.mjs':'17568cb76138783d88365660e1ef04e23be26008'};
 const scope=ciChangeScope(paths,{draft:true,sourceBlobs});
 assert.equal(scope.full,false);assert.equal(scope.normal,true);assert.equal(scope.allunit,true);assert.equal(scope.r9,false);
 for(const file of paths)assert.equal(ciChangeScope(paths,{draft:true,sourceBlobs:{...sourceBlobs,[file]:'f'.repeat(40)}}).full,true);
 assert.equal(ciChangeScope(paths,{draft:false,sourceBlobs}).full,true);
 assert.equal(ciChangeScope([...paths,'app/v100Save.js'],{draft:true,sourceBlobs}).full,true);
});

test('only the exact Souki contact repair selects normal play and motion without unrelated story capture',()=>{
 const paths=['app/AshfallGame.tsx','app/v100SoukiCollision.js'];
 const sourceBlobs={'app/AshfallGame.tsx':'95df06a678e2be79ec076059df910dc95c33298c',
  'app/v100SoukiCollision.js':'bbb80fe0b36ff9c6ea2c37aa2d4de617be75b7be'};
 const scope=ciChangeScope(paths,{draft:true,sourceBlobs});
 assert.equal(scope.full,false);assert.equal(scope.normal,true);assert.equal(scope.allunit,true);assert.equal(scope.r9,false);
 for(const file of paths)assert.equal(ciChangeScope(paths,{draft:true,sourceBlobs:{...sourceBlobs,[file]:'f'.repeat(40)}}).full,true);
 assert.equal(ciChangeScope(paths,{draft:false,sourceBlobs}).full,true);
});

test('the exact local QA preparation change reuses unchanged normal-play evidence in Draft',()=>{
 const file='app/AshfallGame.tsx',blob='4445d531b03a44a1147a3ae44d74a8e869d7ba37';
 const options={draft:true,sourceBlobs:{[file]:blob}},scope=ciChangeScope([file],options);
 assert.equal(scope.full,false);assert.equal(scope.normal,false);assert.equal(scope.allunit,false);assert.equal(scope.r9,false);
 for(const sourceBlobs of [{},{[file]:'f'.repeat(40)}])assert.equal(ciChangeScope([file],{draft:true,sourceBlobs}).full,true);
 assert.equal(ciChangeScope([file],{...options,draft:false}).full,true);
 assert.equal(ciChangeScope([file,'app/manualAbilities.js'],options).full,true);
});

test('the exact hit strength repair reruns motion and normal play while reusing unchanged story evidence',()=>{
 const paths=['app/AshfallGame.tsx','app/v177HitReaction.js'];
 const sourceBlobs={'app/AshfallGame.tsx':'95df06a678e2be79ec076059df910dc95c33298c',
  'app/v177HitReaction.js':'6e7dc3705b3fa8ee8095c675b4046571a085e5af'};
 const scope=ciChangeScope(paths,{draft:true,sourceBlobs});
 assert.equal(scope.full,false);assert.equal(scope.normal,true);assert.equal(scope.allunit,true);assert.equal(scope.r9,false);
 for(const file of paths)assert.equal(ciChangeScope(paths,{draft:true,sourceBlobs:{...sourceBlobs,[file]:'f'.repeat(40)}}).full,true);
 assert.equal(ciChangeScope(paths,{draft:false,sourceBlobs}).full,true);
 assert.equal(ciChangeScope([...paths,'app/v100Save.js'],{draft:true,sourceBlobs}).full,true);
});

test('only the reviewed corpse fixture injection preserves already completed story evidence',()=>{
 const file='tests/helpers/v177-corpse-joint-render.mjs';
 const blob=execFileSync('git',['hash-object',file],{encoding:'utf8',windowsHide:true}).trim();
 const options={draft:true,sourceBlobs:{[file]:blob}};
 const scoped=ciChangeScope([file,'tests/v177-turned-getup.test.mjs'],options);
 assert.equal(scoped.full,false);assert.equal(scoped.r9,false);
 for(const sourceBlobs of [{},{[file]:'f'.repeat(40)}])
  assert.equal(ciChangeScope([file],{draft:true,sourceBlobs}).full,true);
 assert.equal(ciChangeScope([file,'tests/helpers/unknown.mjs'],options).full,true);
 assert.equal(ciChangeScope([file],{...options,draft:false}).full,true);
});

test('the exact Ranger knock repair rechecks Ranger, motion and normal play while retaining unchanged R9',()=>{
 const file='app/v177JointPresentation.js',blob='46309033f92f10577af7135f34d1215fa8292466';
 const options={draft:true,sourceBlobs:{[file]:blob}},scope=ciChangeScope([file],options);
 assert.equal(scope.full,false);assert.equal(scope.ranger,true);assert.equal(scope.normal,true);
 assert.equal(scope.allunit,true);assert.equal(scope.r9,false);
 for(const sourceBlobs of [{},{[file]:'f'.repeat(40)}])assert.equal(ciChangeScope([file],{draft:true,sourceBlobs}).full,true);
 assert.equal(ciChangeScope([file],{...options,draft:false}).full,true);
 assert.equal(ciChangeScope([file,'app/v100Save.js'],options).full,true);
});

test('the CLI handles a PR whose base branch advanced without requiring another merge',()=>{
 const directory=mkdtempSync(join(tmpdir(),'zombieee-ci-scope-'));
 const git=(...args)=>execFileSync('git',args,{cwd:directory,encoding:'utf8',windowsHide:true}).trim();
 const commit=()=>git('-c','user.name=scope-test','-c','user.email=scope-test@example.invalid','-c','commit.gpgsign=false','commit','-qm','fixture');
 git('init','-q');writeFileSync(join(directory,'AGENTS.md'),'fixture');git('add','.');commit();
 const base=git('rev-parse','HEAD');git('checkout','-qb','feature');mkdirSync(join(directory,'app'));
 writeFileSync(join(directory,'app/v177RangerFootPlacement.js'),'fixture');git('add','.');commit();const head=git('rev-parse','HEAD');
 git('checkout','-qb','advanced-base',base);writeFileSync(join(directory,'AGENTS.md'),'advanced');git('add','.');commit();
 const advanced=git('rev-parse','HEAD');
 const result=JSON.parse(execFileSync(process.execPath,[resolve('scripts/ci-change-scope.mjs')],{
  cwd:directory,encoding:'utf8',windowsHide:true,env:{...process.env,CI_SCOPE_BASE:advanced,CI_SCOPE_HEAD:head,CI_SCOPE_DRAFT:'false',GITHUB_OUTPUT:'',GITHUB_STEP_SUMMARY:''}}));
 assert.equal(result.comparisonBase,base);assert.equal(result.full,true);
 assert.equal(result.abilityNameEvidence.reason,'previous-head-not-exact-ancestor');
 assert.deepEqual(result.changedPaths,['app/v177RangerFootPlacement.js']);
});


test('the real CLI collects the native control blob and restores full regression for an unknown revision',()=>{
 const script=resolve('scripts/ci-change-scope.mjs'),file='scripts/v100-macos-indexing-control.mjs';
 const directory=mkdtempSync(join(tmpdir(),'zombieee-native-scope-'));
 const git=(...args)=>execFileSync('git',args,{cwd:directory,encoding:'utf8',windowsHide:true}).trim();
 const commit=()=>git('-c','user.name=scope-test','-c','user.email=scope-test@example.invalid','-c','commit.gpgsign=false','commit','-qm','fixture');
 git('init','-q');writeFileSync(join(directory,'AGENTS.md'),'fixture');git('add','.');commit();const base=git('rev-parse','HEAD');
 mkdirSync(join(directory,'scripts'));const bytes=readFileSync(file);writeFileSync(join(directory,file),bytes);git('add','.');commit();
 const run=head=>JSON.parse(execFileSync(process.execPath,[script],{cwd:directory,encoding:'utf8',windowsHide:true,
  env:{...process.env,CI_SCOPE_BASE:base,CI_SCOPE_HEAD:head,CI_SCOPE_DRAFT:'true',GITHUB_OUTPUT:'',GITHUB_STEP_SUMMARY:''}}));
 const scoped=run(git('rev-parse','HEAD'));
 assert.equal(scoped.full,false);assert.equal(scoped.allunit,true);assert.equal(scoped.normal,false);assert.equal(scoped.r9,false);
 writeFileSync(join(directory,file),Buffer.concat([bytes,Buffer.from('\n')]));git('add','.');commit();
 assert.equal(run(git('rev-parse','HEAD')).full,true);
});

test('CLI native synchronize reuse requires the exact ancestor and preserves Ready and unknown-path full regression',()=>{
 const script=resolve('scripts/ci-change-scope.mjs'),directory=mkdtempSync(join(tmpdir(),'zombieee-native-ready-scope-'));
 const git=(...args)=>execFileSync('git',args,{cwd:directory,encoding:'utf8',windowsHide:true}).trim();
 const commit=()=>{git('add','.');git('-c','user.name=scope-test','-c','user.email=scope-test@example.invalid','-c','commit.gpgsign=false','commit','-qm','fixture');return git('rev-parse','HEAD');};
 git('init','-q');writeFileSync(join(directory,'AGENTS.md'),'fixture');const base=commit();
 mkdirSync(join(directory,'scripts'));writeFileSync(join(directory,'scripts/v177-native-allunit-recovery.json'),'fixture');const head=commit();
 const run=(extra={})=>JSON.parse(execFileSync(process.execPath,[script],{cwd:directory,encoding:'utf8',windowsHide:true,
  env:{...process.env,CI_SCOPE_BASE:base,CI_SCOPE_HEAD:head,CI_SCOPE_DRAFT:'false',CI_SCOPE_ACTION:'synchronize',CI_SCOPE_PREVIOUS_HEAD:base,CI_SCOPE_ACTIONS_TOKEN:'',GITHUB_OUTPUT:'',GITHUB_STEP_SUMMARY:'',...extra}}));
 const reused=run();assert.equal(reused.eligibleNativeReuse,true);assert.equal(reused.full,true,'missing prior-full evidence must fail closed');assert.equal(reused.previousFullEvidence.passed,false);
 assert.equal(reused.wholeGameAccepted,false);assert.equal(reused.finalIntegrationRequiresFullRegression,true);
 assert.equal(run({CI_SCOPE_ACTION:'ready_for_review'}).full,true);
 assert.equal(run({CI_SCOPE_PREVIOUS_HEAD:head}).full,true);
 const output=join(directory,'.git','scope-output');run({GITHUB_OUTPUT:output});
 assert.equal(Object.fromEntries(readFileSync(output,'utf8').trim().split('\n').map(line=>line.split('='))).phaseg,'true',
  'The real CLI must publish the fresh Phase G flag to the workflow');
 writeFileSync(join(directory,'unknown'),'fixture');const unknown=commit();assert.equal(run({CI_SCOPE_HEAD:unknown}).full,true);
 git('checkout','--detach',base);writeFileSync(join(directory,'AGENTS.md'),'advanced');const advanced=commit();
 assert.equal(run({CI_SCOPE_BASE:advanced,CI_SCOPE_PREVIOUS_HEAD:advanced}).full,true,'an unmerged advanced base cannot authorize reuse');
});

test('reviewed lifecycle bindings select motion/normal while unchanged story and Ranger-only observations remain reusable',()=>{
 const paths=["app/AshfallGame.tsx","app/v177JointPresentation.js","app/v177LifecyclePresentation.js"];
 const sourceBlobs={'app/AshfallGame.tsx':'36a0e8f329b34a778938d1a4fe0ee6c19c6712a6',
  'app/v177JointPresentation.js':'05ff9ad9def6c050c29eb7f81650aca6cddc6e37',
  'app/v177LifecyclePresentation.js':'dc13038fa0a3a9bb35f6aef0c06eca80eed4d760'};
 const result=ciChangeScope(paths,{draft:true,sourceBlobs});
 assert.equal(result.full,false);assert.equal(result.normal,true);assert.equal(result.allunit,true);assert.equal(result.r9,false);assert.equal(result.ranger,false);
 for(const file of paths)assert.equal(ciChangeScope(paths,{draft:true,sourceBlobs:{...sourceBlobs,[file]:'f'.repeat(40)}}).full,true);
 assert.equal(ciChangeScope(paths,{draft:false,sourceBlobs}).full,true);
 assert.equal(ciChangeScope([...paths,'app/v100Save.js'],{draft:true,sourceBlobs}).full,true);
});
test('new source heads do not wait behind a previous head and all original full gates remain intact',()=>{
 const current=load(readFileSync('.github/workflows/ci.yml','utf8'));
 const original=load(execFileSync('git',['show','0d4bf897a2839c147be1767b829cfb2a30181348:.github/workflows/ci.yml'],{encoding:'utf8',windowsHide:true}));
 assert.equal(current.concurrency.group,'${{ github.workflow }}-${{ github.event.pull_request.number }}-${{ github.event.pull_request.head.sha }}');
 assert.equal(current.concurrency['cancel-in-progress'],false);
 current.concurrency.group=original.concurrency.group;
 // The separate combat-QA recovery contract verifies these three reviewed
 // scheduling-only fields. Every original command and deadline stays frozen.
 delete current.jobs.scope.outputs.combat;
 current.jobs['v102-combat'].if=original.jobs['v102-combat'].if;
 current.jobs['v102-combat-webkit-summary'].if=original.jobs['v102-combat-webkit-summary'].if;
 assert.equal(current.jobs.scope.outputs.performance,'${{ steps.scope.outputs.performance }}');delete current.jobs.scope.outputs.performance;
 assert.equal(current.jobs.scope.outputs.verify_full,'${{ steps.scope.outputs.verify_full }}');delete current.jobs.scope.outputs.verify_full;
 assert.equal(current.jobs.scope.outputs.phaseg,'${{ steps.scope.outputs.phaseg }}');delete current.jobs.scope.outputs.phaseg;
 assert.equal(current.jobs['v100-phase-g-production'].if,"${{ needs.scope.outputs.full == 'true' || needs.scope.outputs.phaseg == 'true' }}");
 current.jobs['v100-phase-g-production'].if=original.jobs['v100-phase-g-production'].if;
 const verifyOnly=original.jobs.verify.steps.filter(step=>step.if?.includes("needs.scope.outputs.full == 'true'"));assert.equal(verifyOnly.length,19);
 for(const old of verifyOnly){const step=current.jobs.verify.steps.find(s=>s.name===old.name);
  assert.equal(step.if,old.if.replaceAll("needs.scope.outputs.full == 'true'","(needs.scope.outputs.full == 'true' || needs.scope.outputs.verify_full == 'true')"));step.if=old.if;}
 assert.equal(current.jobs['v100-webkit-frame-control'].if,"${{ needs.scope.outputs.full == 'true' || needs.scope.outputs.performance == 'true' }}");
 current.jobs['v100-webkit-frame-control'].if=original.jobs['v100-webkit-frame-control'].if;
 const formalCommand='node scripts/run-browser-qa-with-server.mjs scripts/v100-device-runtime-browser.mjs';
 const formal=workflow=>workflow.jobs['v100-webkit-frame-control'].steps.filter(step=>step.run===formalCommand);
 assert.equal(formal(current).length,4);assert.equal(formal(original).length,4);
 for(const step of formal(current))assert.equal(step.env.V100_DEVICE_RUNTIME_CALLBACK_DIAGNOSTIC,'0');
 for(const step of formal(original)){
  assert.equal(step.env.V100_DEVICE_RUNTIME_CALLBACK_DIAGNOSTIC,'1');
  step.env.V100_DEVICE_RUNTIME_CALLBACK_DIAGNOSTIC='0';
 }
 const targeted=load(readFileSync('.github/workflows/targeted-frame-performance.yml','utf8'));
 assert.equal(targeted.jobs['v100-webkit-frame-control'].env.V100_DEVICE_RUNTIME_CALLBACK_DIAGNOSTIC,"${{ matrix.runtime == 'formal' && '0' || '1' }}");
 assert.deepEqual(current,original,'all jobs, inputs, limits, permissions and acceptance assertions remain identical');
});

test('exact reviewed Kuma motion, Ranger pool and first-fixed-paint QA target Draft dependencies and preserve every full fallback',()=>{
 const ranger='app/v177RangerLowerPaint.js',kuma='app/v177WeaponChoreography.js',receipts='scripts/v177-ranger-performance-receipts.mjs';
 const blob=file=>execFileSync('git',['rev-parse','e22b134a38409b9d2f86660ee351e616c28fbf44:'+file],{encoding:'utf8',windowsHide:true}).trim();
 for(const paths of [[kuma],[ranger,kuma],[receipts],[ranger,kuma,receipts]]){
  const sourceBlobs=Object.fromEntries(paths.map(file=>[file,blob(file)])),options={draft:true,sourceBlobs},scope=ciChangeScope(paths,options);
  assert.equal(scope.full,false);assert.equal(scope.normal,paths.includes(kuma)||paths.includes(ranger));
  assert.equal(scope.allunit,paths.includes(kuma)||paths.includes(ranger));assert.equal(scope.ranger,paths.includes(ranger));assert.equal(scope.r9,false);
  assert.equal(ciChangeScope(paths,{...options,draft:false}).full,true);
  for(const file of paths){for(const invalid of [null,'f'.repeat(40),'malformed']){
    const bad={...sourceBlobs};if(invalid===null)delete bad[file];else bad[file]=invalid;
    assert.equal(ciChangeScope(paths,{draft:true,sourceBlobs:bad}).full,true);
  }}
  assert.equal(ciChangeScope([...paths,'app/unknown.js'],options).full,true);
 }
 assert.equal(ciChangeScope([ranger],{draft:true,sourceBlobs:{[ranger]:'39dc936236c666ce34009c9e975f4b3a280f4f80'}}).full,true);
 assert.deepEqual(framePerformanceRuntimes([receipts]).map(r=>r.runtime),['formal','native-recording-control']);
 const workflow=load(readFileSync('.github/workflows/targeted-frame-performance.yml','utf8'));
 assert.ok(workflow.on.pull_request.paths.includes(receipts),'changing the transitive workload validator must trigger the real original measurement');
});
