import test from 'node:test';
import assert from 'node:assert/strict';
import {ciChangeScope,framePerformanceRuntimes,previousFullCiEvidence} from '../scripts/ci-change-scope.mjs';
import {assertEphemeralPerformanceHost} from '../scripts/v100-macos-indexing-control.mjs';
import {readFileSync} from 'node:fs';
import {load} from 'js-yaml';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {provenanceFixture} from './helpers/ci-pr-provenance.mjs';
test('a ready candidate always gets full regression, including governance-only changes',()=>{
 for(const paths of [['AGENTS.md'],['tests/ci-contract.test.mjs'],['app/v177RangerFootPlacement.js']]){
  const scope=ciChangeScope(paths,{draft:false});assert.equal(scope.full,true);assert.equal(scope.ranger,true);assert.equal(scope.normal,true);
  assert.equal(scope.wholeGameAccepted,false);
 }
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
 const workflowBlob=execFileSync('git',['hash-object',file],{encoding:'utf8',windowsHide:true}).trim();
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
  assert.ok(Object.values(gate.jobs).some(job=>job.if?.includes('!github.event.pull_request.draft')));
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
 assert.deepEqual(current,original,'all jobs, inputs, limits, permissions and acceptance assertions remain identical');
});
