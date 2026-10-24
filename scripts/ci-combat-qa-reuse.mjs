import assert from 'node:assert/strict';
import {immutablePrProvenance} from './ci-pr-provenance.mjs';

// This exact QA repair does not alter the product. Its affected combat matrix
// runs again; every other original gate must already have completed successfully.
export const COMBAT_QA_BASELINE=Object.freeze({head:'d62d67615fb1d5e551528cde2a384cdae2018ef8',
  base:'99f9c193ab1e35531db39225c839138cdb1c33cd',runId:40049820342,qualityRunId:40049820295,prNumber:180});
export const COMBAT_QA_BLOBS=Object.freeze({
  'scripts/v102-combat-browser.mjs':'526d852a97fe760fb85ebafeb9e5b95da5ade110',
  'scripts/v177-mayo-native-samples.mjs':'6a079c6d10c3ed4c8c305a737a9a88f507b5f25e',
  'tests/v177-mayo-native-samples.test.mjs':'45778d068db0bfeed3719ae24601f71d7e585b1f',
});
export const COMBAT_QA_WORKFLOW_BLOB='3823b8ed8587d4f60cbc45ada6e9811a8302dd7e';
export const COMBAT_QA_QUALITY_WORKFLOW_BLOB='75921d4d91ddcd23bd152d65fc4197c454a42763';
const allowed=new Set([...Object.keys(COMBAT_QA_BLOBS),'.github/workflows/ci.yml','scripts/ci-change-scope.mjs',
  'scripts/ci-combat-qa-reuse.mjs','tests/ci-combat-qa-reuse.test.mjs','tests/ci-change-scope.test.mjs',
  'scripts/v177-native-allunit-recovery.json','docs/PROJECT_STATE.md','.github/workflows/v1-quality-acceptance.yml']);
export const BASELINE_JOB_NAMES=Object.freeze([
  'Validation Scope','PR Verify','Ranger Turn Regression','V1 Guardian Control Diagnostic',
  'V1 WebKit Frame and Boss Performance','WebKit Compact Shadow Diagnostic','V1 Phase G Production Matrix',
  'V1 Native WebKit PWA Update and Recovery','WebKit Hosted Runner Evidence',
  ...['chromium','webkit'].flatMap(engine=>[
    ...['composition','bookends'].map(phase=>`R9 Story (${engine}, ${phase}, )`),
    ...['1280x720','844x390','844x340'].map(view=>`R9 Story (${engine}, full-story, ${view})`),
    `V1.0.3 Media Output (${engine})`,`V1 Ordinary Enemy Contacts (${engine})`,`V1 Representative Normal Play (${engine})`,
  ]),
  ...['chromium','webkit desktop-phone','webkit phone-short','webkit'].map(label=>`V1.0.2 Combat (${label})`),
  ...['01','02','03','04','05','06'].map(shard=>`WebKit Enemy Runtime Evidence (${shard})`),
  ...['667x375','736x414','844x390','844x340','932x430','1280x720'].flatMap(view=>[
    `WebKit Deployment Viewport Evidence (${view})`,`WebKit Canonical Viewport Evidence (${view})`,
  ]),
  ...['entrance-candidate','final-candidate','final-base'].map(name=>`WebKit Stage 3 Audio Route (${name})`),
]);
const originalFailures=['V1.0.2 Combat (webkit phone-short)','V1.0.2 Combat (webkit)'];
export function reviewedCombatQaPaths(paths,sourceBlobs={}){
  return Array.isArray(paths)&&paths.length>0&&paths.every(file=>allowed.has(file))
    &&Object.keys(COMBAT_QA_BLOBS).every(file=>paths.includes(file)&&sourceBlobs[file]===COMBAT_QA_BLOBS[file])
    &&sourceBlobs['.github/workflows/ci.yml']===COMBAT_QA_WORKFLOW_BLOB
    &&sourceBlobs['.github/workflows/v1-quality-acceptance.yml']===COMBAT_QA_QUALITY_WORKFLOW_BLOB;
}
export async function previousCombatQaEvidence({repository,previousHead,base,prNumber,action,draft,productUnchanged,
  paths,sourceBlobs,token,request=fetch}={}){
  const old=COMBAT_QA_BASELINE;
  if(repository!=='SUSANO-OOO/Zombieee'||previousHead!==old.head||base!==old.base||prNumber!==old.prNumber
    ||action!=='synchronize'||draft!==false||productUnchanged!==true||!token||!reviewedCombatQaPaths(paths,sourceBlobs))
    return{passed:false,reason:'not-the-reviewed-product-unchanged-combat-qa-repair'};
  const get=async(suffix,binary=false)=>{
    const response=await request(`https://api.github.com/repos/${repository}/${suffix}`,{
      headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(10000)});
    assert.equal(response.ok,true);return binary?response.arrayBuffer():response.json();
  };
  try{
    const run=await get(`actions/runs/${old.runId}`);
    assert.equal(run.id,old.runId);assert.equal(run.head_sha,old.head);assert.equal(run.run_attempt,1);
    assert.equal(run.event,'pull_request');assert.equal(run.status,'completed');assert.equal(run.conclusion,'failure');
    assert.ok(run.pull_requests?.some(pr=>pr.number===old.prNumber));
    const data=await get(`actions/runs/${old.runId}/jobs?filter=latest&per_page=100`),jobs=data.jobs;
    assert.ok(Array.isArray(jobs));assert.equal(jobs.length,data.total_count);
    assert.deepEqual(jobs.map(j=>j.name).sort(),[...BASELINE_JOB_NAMES].sort());
    assert.equal(new Set(jobs.map(j=>j.id)).size,jobs.length);
    const failures=[];
    for(const job of jobs){
      assert.ok(Number.isSafeInteger(job.id)&&job.id>0);assert.equal(job.run_id,old.runId);assert.equal(job.run_attempt,1);assert.equal(job.head_sha,old.head);assert.equal(job.status,'completed');
      if(originalFailures.includes(job.name)){assert.equal(job.conclusion,'failure');failures.push(job);}
      else if(job.name==='WebKit Compact Shadow Diagnostic')assert.equal(job.conclusion,'skipped');
      else assert.equal(job.conclusion,'success',`Unresolved original gate: ${job.name}`);
    }
    assert.equal(failures.length,2);
    const quality=await get(`actions/runs/${old.qualityRunId}`);
    assert.equal(quality.id,old.qualityRunId);assert.equal(quality.head_sha,old.head);assert.equal(quality.run_attempt,1);
    assert.equal(quality.event,'pull_request');assert.equal(quality.status,'completed');assert.equal(quality.conclusion,'success');
    assert.ok(quality.pull_requests?.some(pr=>pr.number===old.prNumber));
    const qualityData=await get(`actions/runs/${old.qualityRunId}/jobs?filter=latest&per_page=100`),qualityJobs=qualityData.jobs;
    assert.equal(qualityData.total_count,2);assert.ok(Array.isArray(qualityJobs));assert.equal(qualityJobs.length,2);
    assert.deepEqual(qualityJobs.map(j=>j.name).sort(),['V1 Quality UI and Play (chromium)','V1 Quality UI and Play (webkit)']);
    assert.notEqual(qualityJobs[0].id,qualityJobs[1].id);
    for(const job of qualityJobs){assert.ok(Number.isSafeInteger(job.id)&&job.id>0);assert.equal(job.run_id,old.qualityRunId);
      assert.equal(job.head_sha,old.head);assert.equal(job.run_attempt,1);assert.equal(job.status,'completed');assert.equal(job.conclusion,'success');}
    const provenance=await immutablePrProvenance({get,runId:old.runId,head:old.head,base:old.base});
    return{passed:true,...old,provenance,originalRunConclusion:'failure',
      originalFailures:failures.map(({id,name,conclusion})=>({id,name,conclusion})),
      qualityEvidence:{runId:old.qualityRunId,head:old.head,conclusion:'success',jobs:qualityJobs.map(({id,name,conclusion})=>({id,name,conclusion}))},
      retainedJobs:jobs.filter(j=>!j.name.startsWith('V1.0.2 Combat (')).map(({id,name,conclusion})=>({id,name,conclusion})),
      rerun:'All three original combat viewport groups and their original summary',wholeGameAccepted:false};
  }catch{return{passed:false,reason:'original-gates-or-immutable-provenance-not-complete'};}
}

// Only the reviewed VM fixture changes after the three repaired combat groups.
// The failed PR Verify is never inherited: all tests, lint and build run afresh.
// Its unchanged conditional browser steps retain their original d62 owners.
export const COMBAT_FIXTURE_BASELINE=Object.freeze({head:'773678dd6fd663bb3a9066ed9ec08f54acbf8832',runId:40061577855});
export const COMBAT_FIXTURE_BLOB='26055a5a0b08f55eef5683f8cdb05e8ffeb64783';
const fixturePath='tests/v177-native-canvas-clips.test.mjs';
const fixtureAllowed=new Set([fixturePath,'scripts/ci-change-scope.mjs','scripts/ci-combat-qa-reuse.mjs',
  'tests/ci-combat-qa-reuse.test.mjs','scripts/v177-native-allunit-recovery.json','docs/PROJECT_STATE.md']);
export const COMBAT_FIXTURE_SKIPPED_JOBS=Object.freeze([
  'Ranger Turn Regression','WebKit Enemy Runtime Evidence (${{ matrix.shard.name }})','V1 Guardian Control Diagnostic',
  'R9 Story (${{ matrix.engine }}, ${{ matrix.phase }}, ${{ matrix.viewport }})',
  'V1 Representative Normal Play (${{ matrix.engine }})','WebKit Compact Shadow Diagnostic',
  'V1 WebKit Frame and Boss Performance','WebKit Hosted Runner Evidence','V1.0.3 Media Output (${{ matrix.engine }})',
  'V1 Ordinary Enemy Contacts (${{ matrix.engine }})','V1 Native WebKit PWA Update and Recovery',
  'WebKit Stage 3 Audio Route (${{ matrix.audio_case }})','V1 Phase G Production Matrix',
  'WebKit Deployment Viewport Evidence (${{ matrix.viewport }})','WebKit Canonical Viewport Evidence (${{ matrix.viewport }})',
]);
const fixtureCombatJobs=['chromium','webkit desktop-phone','webkit phone-short','webkit'].map(label=>`V1.0.2 Combat (${label})`);
export function reviewedCombatFixturePaths(paths,sourceBlobs={}){
  return Array.isArray(paths)&&paths.includes(fixturePath)&&paths.every(file=>fixtureAllowed.has(file))
    &&sourceBlobs[fixturePath]===COMBAT_FIXTURE_BLOB
    &&Object.entries(COMBAT_QA_BLOBS).every(([file,blob])=>sourceBlobs[file]===blob)
    &&sourceBlobs['.github/workflows/ci.yml']===COMBAT_QA_WORKFLOW_BLOB
    &&sourceBlobs['.github/workflows/v1-quality-acceptance.yml']===COMBAT_QA_QUALITY_WORKFLOW_BLOB;
}
export async function previousCombatFixtureEvidence(options={}){
  const {repository,previousHead,base,prNumber,action,draft,productUnchanged,paths,sourceBlobs,token,request=fetch}=options;
  const old=COMBAT_QA_BASELINE,repair=COMBAT_FIXTURE_BASELINE;
  if(repository!=='SUSANO-OOO/Zombieee'||previousHead!==repair.head||base!==old.base||prNumber!==old.prNumber
    ||action!=='synchronize'||draft!==false||productUnchanged!==true||!token||!reviewedCombatFixturePaths(paths,sourceBlobs))
    return{passed:false,reason:'not-the-reviewed-combat-vm-fixture-repair'};
  // Revalidate the original owners instead of treating skipped follow-up jobs
  // as successful measurements. The CLI also compares all three product trees.
  const original=await previousCombatQaEvidence({...options,previousHead:old.head,
    paths:[...Object.keys(COMBAT_QA_BLOBS),'.github/workflows/ci.yml','.github/workflows/v1-quality-acceptance.yml']});
  if(!original.passed)return{passed:false,reason:'original-product-gates-unavailable'};
  const get=async(suffix,binary=false)=>{
    const response=await request(`https://api.github.com/repos/${repository}/${suffix}`,{
      headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(10000)});
    assert.equal(response.ok,true);return binary?response.arrayBuffer():response.json();
  };
  try{
    const run=await get(`actions/runs/${repair.runId}`);
    assert.equal(run.id,repair.runId);assert.equal(run.head_sha,repair.head);assert.equal(run.run_attempt,1);
    assert.equal(run.event,'pull_request');assert.equal(run.status,'completed');assert.equal(run.conclusion,'failure');
    assert.ok(run.pull_requests?.some(pr=>pr.number===old.prNumber));
    const data=await get(`actions/runs/${repair.runId}/jobs?filter=latest&per_page=100`),jobs=data.jobs;
    assert.ok(Array.isArray(jobs));assert.equal(jobs.length,data.total_count);
    assert.deepEqual(jobs.map(j=>j.name).sort(),['Validation Scope','PR Verify',...fixtureCombatJobs,...COMBAT_FIXTURE_SKIPPED_JOBS].sort());
    assert.equal(new Set(jobs.map(j=>j.id)).size,jobs.length);
    for(const job of jobs){
      assert.ok(Number.isSafeInteger(job.id)&&job.id>0);assert.equal(job.run_id,repair.runId);assert.equal(job.run_attempt,1);
      assert.equal(job.head_sha,repair.head);assert.equal(job.status,'completed');
      assert.equal(job.conclusion,job.name==='PR Verify'?'failure':COMBAT_FIXTURE_SKIPPED_JOBS.includes(job.name)?'skipped':'success');
    }
    const failedVerify=jobs.find(j=>j.name==='PR Verify');assert.equal(failedVerify.id,120776216487);
    assert.ok(Array.isArray(failedVerify.steps)&&failedVerify.steps.every(s=>s.status==='completed'));
    assert.deepEqual(failedVerify.steps.filter(s=>s.conclusion==='failure').map(s=>s.name),['Test']);
    for(const name of ['Verify PR provenance','Upload PR provenance','Check patch whitespace','Install dependencies','Lint',
      'Validate production content','Build production application'])
      assert.equal(failedVerify.steps.find(s=>s.name===name)?.conclusion,'success');
    const provenance=await immutablePrProvenance({get,runId:repair.runId,head:repair.head,base:old.base});
    return{passed:true,head:repair.head,runId:repair.runId,base:old.base,provenance,originalEvidence:original,
      retainedCombatJobs:jobs.filter(j=>fixtureCombatJobs.includes(j.name)).map(({id,name,conclusion})=>({id,name,conclusion})),
      originalVerifyFailure:{id:failedVerify.id,conclusion:failedVerify.conclusion,failedStep:'Test'},
      rerun:'PR Verify: all unit tests, lint, content validation and production build; unchanged conditional browser steps retain their original owners',wholeGameAccepted:false};
  }catch{return{passed:false,reason:'repaired-combat-gates-or-immutable-provenance-not-complete'};}
}
