import test from 'node:test';
import assert from 'node:assert/strict';
import {ciChangeScope} from '../scripts/ci-change-scope.mjs';
import {readFileSync} from 'node:fs';
import {load} from 'js-yaml';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
test('a ready candidate always gets full regression, including governance-only changes',()=>{
 for(const paths of [['AGENTS.md'],['tests/ci-contract.test.mjs'],['app/v177RangerFootPlacement.js']]){
  const scope=ciChangeScope(paths,{draft:false});assert.equal(scope.full,true);assert.equal(scope.ranger,true);assert.equal(scope.normal,true);
  assert.equal(scope.wholeGameAccepted,false);
 }
});
test('ready events run integration gates and research cannot block representative observation',()=>{
 const workflow=load(readFileSync('.github/workflows/ci.yml','utf8'));
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
 const blob='883d3129d163bf62f4baba76647d16d8a14650db';
 const options={draft:true,sourceBlobs:{[file]:blob}};
 const scoped=ciChangeScope([file,'tests/v177-native-allunit-outcomes.test.mjs'],options);
 assert.equal(scoped.full,false);assert.equal(scoped.allunit,false);assert.equal(scoped.r9,false);
 for(const sourceBlobs of [{},{[file]:'f'.repeat(40)}])assert.equal(ciChangeScope([file],{draft:true,sourceBlobs}).full,true);
 assert.equal(ciChangeScope([file,'app/v177JointPresentation.js'],options).full,true);
 assert.equal(ciChangeScope([file],{...options,draft:false}).full,true);
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
 const file='app/combatPresentation.js',blob=execFileSync('git',['hash-object',file],{encoding:'utf8',windowsHide:true}).trim();
 const options={draft:true,sourceBlobs:{[file]:blob}},scope=ciChangeScope([file],options);
 assert.equal(scope.full,false);assert.equal(scope.allunit,true);assert.equal(scope.normal,true);assert.equal(scope.r9,false);
 for(const sourceBlobs of [{},{[file]:'f'.repeat(40)}])assert.equal(ciChangeScope([file],{draft:true,sourceBlobs}).full,true);
 assert.equal(ciChangeScope([file,'app/v100Save.js'],options).full,true);
 assert.equal(ciChangeScope([file],{...options,draft:false}).full,true);
});

test('the exact reviewed human death owner runs motion and normal play without repeating unchanged R9',()=>{
 const paths=['app/AshfallGame.tsx','app/v177JointPresentation.js','app/v177HumanCorpsePresentation.js',
  'scripts/v177-native-allunit-outcomes.mjs','scripts/v177-human-corpse-contract.mjs'];
 const sourceBlobs=Object.fromEntries(paths.map(file=>[file,execFileSync('git',['hash-object',file],{encoding:'utf8',windowsHide:true}).trim()]));
 const scope=ciChangeScope(paths,{draft:true,sourceBlobs});
 assert.equal(scope.full,false);assert.equal(scope.normal,true);assert.equal(scope.allunit,true);assert.equal(scope.r9,false);
 for(const file of paths)assert.equal(ciChangeScope(paths,{draft:true,sourceBlobs:{...sourceBlobs,[file]:'f'.repeat(40)}}).full,true);
 assert.equal(ciChangeScope(paths,{draft:false,sourceBlobs}).full,true);
 assert.equal(ciChangeScope([...paths,'app/v100Save.js'],{draft:true,sourceBlobs}).full,true);
});

test('only the exact Souki contact repair selects normal play and motion without unrelated story capture',()=>{
 const paths=['app/AshfallGame.tsx','app/v100SoukiCollision.js'];
 const sourceBlobs=Object.fromEntries(paths.map(file=>[file,execFileSync('git',['hash-object',file],{encoding:'utf8',windowsHide:true}).trim()]));
 const scope=ciChangeScope(paths,{draft:true,sourceBlobs});
 assert.equal(scope.full,false);assert.equal(scope.normal,true);assert.equal(scope.allunit,true);assert.equal(scope.r9,false);
 for(const file of paths)assert.equal(ciChangeScope(paths,{draft:true,sourceBlobs:{...sourceBlobs,[file]:'f'.repeat(40)}}).full,true);
 assert.equal(ciChangeScope(paths,{draft:false,sourceBlobs}).full,true);
});

test('the exact local QA preparation change reuses unchanged normal-play evidence in Draft',()=>{
 const file='app/AshfallGame.tsx',blob='196ad0a43b13632ed7d228e1a37a5018c4407456';
 const options={draft:true,sourceBlobs:{[file]:blob}},scope=ciChangeScope([file],options);
 assert.equal(scope.full,false);assert.equal(scope.normal,false);assert.equal(scope.allunit,false);assert.equal(scope.r9,false);
 for(const sourceBlobs of [{},{[file]:'f'.repeat(40)}])assert.equal(ciChangeScope([file],{draft:true,sourceBlobs}).full,true);
 assert.equal(ciChangeScope([file],{...options,draft:false}).full,true);
 assert.equal(ciChangeScope([file,'app/manualAbilities.js'],options).full,true);
});

test('the exact hit strength repair reruns motion and normal play while reusing unchanged story evidence',()=>{
 const paths=['app/AshfallGame.tsx','app/v177HitReaction.js'];
 const sourceBlobs=Object.fromEntries(paths.map(file=>[file,execFileSync('git',['hash-object',file],{encoding:'utf8',windowsHide:true}).trim()]));
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
