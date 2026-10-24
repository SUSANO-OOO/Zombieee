import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {immutablePrProvenance} from './ci-pr-provenance.mjs';
import {COMBAT_QA_BASELINE,COMBAT_QA_BLOBS,reviewedCombatQaPaths,previousCombatQaEvidence,
  COMBAT_FIXTURE_BASELINE,reviewedCombatFixturePaths,previousCombatFixtureEvidence,BASELINE_JOB_NAMES} from './ci-combat-qa-reuse.mjs';

const governance=new Set(['AGENTS.md','docs/PROJECT_STATE.md','docs/CODEX_SOL_ROLE.md','docs/CODEX_LUNA_ROLE.md',
  'docs/CODEX_TWO_THREAD_WORKFLOW.md','docs/PRODUCER_DECISIONS_1.0.3.md',
  'docs/design/v1.0.0/DESIGN_LOCK.md','docs/design/v1.0.0/LUNA_HANDOFF.md']);
const ranger=new Set(['app/v177RangerFootPlacement.js','app/v177RangerLowerMotion.js','assets/source/v177/ranger/lower-r3/provenance.json','scripts/silent-browser-output.mjs']);
const normal=new Set(['scripts/v100-normal-campaign-playthrough.mjs','scripts/v100-normal-play-contract.mjs',
  'scripts/v177-representative-normal-play.mjs','scripts/v177-representative-battles.mjs',
  'scripts/v177-normal-audio-unlock-observation.mjs','tests/fixtures/v177-native-auto-unlocked-audio.json',
  'tests/fixtures/v177-native-success-control-audio.json','scripts/v100-normal-visible-aim.mjs']);
const allunit=new Set(['.github/workflows/native-allunit-capture.yml','scripts/v177-native-allunit-build.mjs',
  'scripts/v177-native-allunit-browser.mjs','scripts/v177-native-allunit-cases.mjs',
  'scripts/v177-native-allunit-manifest.mjs','scripts/v177-native-allunit-contract.mjs',
  'scripts/v177-native-allunit-selection.mjs','scripts/v177-native-allunit-recovery.json',
  'scripts/v177-native-allunit-ranger-manual.mjs','scripts/v177-native-canvas-clips.mjs']);
const nativeQaTests=new Set(['tests/v177-native-allunit.test.mjs','tests/v177-native-allunit-build.test.mjs',
  'tests/v177-native-allunit-selection.test.mjs','tests/v177-native-allunit-outcomes.test.mjs',
  'tests/v177-native-allunit-ranger-manual.test.mjs','tests/v177-native-canvas-clips.test.mjs',
  'tests/v177-native-realm-owner.test.mjs','tests/v177-native-capture-realm.test.mjs',
  'tests/v177-native-encoded-clips.test.mjs','tests/v177-native-frame-timing.test.mjs',
  'tests/v177-native-setup-overlap.test.mjs','tests/v177-native-incoming-stun.test.mjs',
  'tests/v177-native-turned-getup.test.mjs','tests/v177-native-born-readiness.test.mjs']);
// Only these independently reviewed five-correction recording revisions are QA-only.
const reviewedCorrectionQaBlobs=Object.freeze({
  ".github/workflows/five-corrections-capture.yml": "de854ae8d30599ef1dc13806c9ac3089ad587145",
  "scripts/v105-five-corrections-capture.mjs": "bcef5dd74c3ef17fde504d1ffc07522c747224dd",
  "tests/v177-native-allunit-recording-runtime.test.mjs": "30ac4642f2b1c2f4728c0fcc08f9b7321cb2ec3b"
});
const nativeQaOnlyPaths=(paths,sourceBlobs)=>paths.length>0&&paths.every(file=>
  allunit.has(file)||file==='docs/PROJECT_STATE.md'||nativeQaTests.has(file)
  ||(reviewedCorrectionQaBlobs[file]&&sourceBlobs[file]===reviewedCorrectionQaBlobs[file]));

// One reviewed display-only delta. All reused browser jobs must have actually
// completed on the immutable preceding candidate. Verify and performance run
// afresh; a failed normal-play lane also runs again. Unknown changes stay full.
export const ABILITY_NAME_BASELINE=Object.freeze({head:'6a5226647ebf9ba7692c69b9c64af4ce32059d1b',
 base:'e22b134a38409b9d2f86660ee351e616c28fbf44',runId:40120044446,prNumber:181});
export const ABILITY_NAME_BLOBS=Object.freeze({
 "app/AshfallGame.tsx": "004c5f5e25a6ff63c029d6f06d4c29f92efbd859",
 ".github/workflows/ci.yml": "bbfb51296e72de4c83ea993ce6341f39fbd098a4",
 "scripts/v177-representative-battles.mjs": "c5359ed5edf24403c427c64832e5d140806eb9c8",
 "scripts/v100-device-runtime-browser.mjs": "445b9aaa783128b764623a2d40cc3e194587c94e",
 "scripts/v100-phase-g-production-matrix.mjs": "e879eca860f4bf9e5531e75c29bea79c209cb57f",
 "scripts/v105-five-corrections-capture.mjs": "f187ea4d816abc25272673d880cc15fe7d5b686b",
 "scripts/v177-native-allunit-browser.mjs": "536ff62a6e277ab2dd602d95ed9737b1da66b416",
 "docs/qa/v105/five-corrections-6a-evidence.json": "30027698e152d5e49c5d03f2f4c2212571a3e2c9"
});
const abilityNameFiles=new Set([...Object.keys(ABILITY_NAME_BLOBS),'scripts/ci-change-scope.mjs',
 'tests/ci-change-scope.test.mjs','tests/ci-contract.test.mjs','tests/ci-combat-qa-reuse.test.mjs',
 'scripts/v177-native-allunit-recovery.json','tests/v177-representative-battles.test.mjs',
 'scripts/v105-five-corrections-capture.mjs','tests/v105-original-av.test.mjs',
 'scripts/v177-native-allunit-browser.mjs','tests/v177-native-setup-overlap.test.mjs',
 'tests/v177-ranger-performance-receipts.test.mjs',
 'scripts/v100-phase-g-production-matrix.mjs','tests/v100-phase-g-sustain-pointer.test.mjs',
 'docs/qa/v105/five-corrections-6a-evidence.json','docs/qa/v105/ci-6a-infrastructure-failure.json',
 'docs/PROJECT_STATE.md','docs/qa/v105/native-6a-evidence.json']);
export const ABILITY_NAME_REUSED_JOBS=Object.freeze(BASELINE_JOB_NAMES.filter(name=>
 !['PR Verify','V1 Guardian Control Diagnostic','WebKit Compact Shadow Diagnostic','V1 WebKit Frame and Boss Performance',
 'V1 Phase G Production Matrix','V1 Representative Normal Play (chromium)','V1 Representative Normal Play (webkit)'].includes(name)));
export function reviewedAbilityNamePaths(paths,sourceBlobs={}){
 return Array.isArray(paths)&&paths.length>0&&paths.every(file=>abilityNameFiles.has(file))
  &&['app/AshfallGame.tsx','.github/workflows/ci.yml'].every(file=>paths.includes(file))
  &&Object.entries(ABILITY_NAME_BLOBS).every(([file,blob])=>!paths.includes(file)||sourceBlobs[file]===blob);
}
export async function previousAbilityNameEvidence({repository,previousHead,base,prNumber,action,draft,paths,sourceBlobs,token,request=fetch}={}){
 const old=ABILITY_NAME_BASELINE;
 if(repository!=='SUSANO-OOO/Zombieee'||previousHead!==old.head||base!==old.base||prNumber!==old.prNumber
  ||action!=='synchronize'||draft!==false||!token||!reviewedAbilityNamePaths(paths,sourceBlobs))
  return{passed:false,reason:'not-the-reviewed-ability-name-display-delta'};
 const get=async(suffix,binary=false)=>{const response=await request(`https://api.github.com/repos/${repository}/${suffix}`,{
  headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Original browser evidence unavailable');return binary?response.arrayBuffer():response.json();};
 try{
  const run=await get(`actions/runs/${old.runId}`);
  if(run.id!==old.runId||run.head_sha!==old.head||run.status!=='completed'||![1,2].includes(run.run_attempt)||run.event!=='pull_request'
   ||!run.pull_requests?.some(pr=>pr.number===old.prNumber))return{passed:false,reason:'original-candidate-not-complete'};
  const data=await get(run.run_attempt===1?`actions/runs/${old.runId}/jobs?filter=latest&per_page=100`
    :`actions/runs/${old.runId}/attempts/1/jobs?per_page=100`);
  if(!Array.isArray(data.jobs)||!Number.isSafeInteger(data.total_count)||data.total_count>100||data.total_count!==data.jobs.length)
   return{passed:false,reason:'original-jobs-pagination-or-count-mismatch'};
  if(new Set(data.jobs.map(j=>j.id)).size!==data.jobs.length||!data.jobs.every(j=>Number.isSafeInteger(j.id)&&j.id>0
   &&j.run_id===old.runId&&j.head_sha===old.head&&j.run_attempt===1&&j.status==='completed'))
   return{passed:false,reason:'original-job-owner-mismatch'};
  const adoptedJobs=[...data.jobs];let infrastructureRecovery=null;
  if(run.run_attempt===2){
   // Only this original host's DNS failure is eligible. No game or HUD test
   // ran there. Preserve all attempt1 owners and require the one replacement
   // job to run its actual capture and upload under the unchanged workflow.
   const name='WebKit Canonical Viewport Evidence (844x340)',original=data.jobs.filter(j=>j.name===name),step=(j,n,c)=>
    j.steps?.some(s=>s.name===n&&s.status==='completed'&&s.conclusion===c);
   if(original.length!==1||original[0].id!==120981969541||original[0].conclusion!=='failure'
     ||!step(original[0],'Setup Node.js','failure')||!step(original[0],'Capture canonical HUD evidence','skipped'))
    return{passed:false,reason:'not-the-original-unexecuted-dns-failure'};
   const retry=await get(`actions/runs/${old.runId}/attempts/2/jobs?per_page=100`);
   // GitHub also emits new-ID copies of unchanged results in attempt2. They
   // are not new measurements and never replace their original owners.
   const names=rows=>rows.map(j=>j.name).sort();
   if(!Array.isArray(retry.jobs)||retry.total_count!==data.jobs.length||retry.jobs.length!==data.jobs.length
     ||new Set(data.jobs.map(j=>j.name)).size!==data.jobs.length||new Set(retry.jobs.map(j=>j.id)).size!==retry.jobs.length
     ||JSON.stringify(names(retry.jobs))!==JSON.stringify(names(data.jobs)))return{passed:false,reason:'specific-retry-inventory-mismatch'};
   const execution=j=>[j.status,j.conclusion,j.started_at,j.completed_at,j.runner_id,j.runner_name,
    j.steps?.map(s=>[s.name,s.number,s.status,s.conclusion,s.started_at,s.completed_at])];
   const clock=(start,end)=>typeof start==='string'&&typeof end==='string'
    &&Number.isFinite(Date.parse(start))&&Date.parse(end)>=Date.parse(start);
   const executed=j=>clock(j.started_at,j.completed_at)&&Number.isSafeInteger(j.runner_id)&&j.runner_id>0
    &&typeof j.runner_name==='string'&&j.runner_name.length>0&&Array.isArray(j.steps)&&j.steps.length>0
    &&new Set(j.steps.map(s=>s.number)).size===j.steps.length&&j.steps.every(s=>
      typeof s.name==='string'&&s.name.length>0&&Number.isSafeInteger(s.number)&&s.number>0&&s.status==='completed'
      &&['success','failure','cancelled','skipped','neutral','timed_out','action_required'].includes(s.conclusion)
      &&clock(s.started_at,s.completed_at));
   for(const alias of retry.jobs){
    if(!Number.isSafeInteger(alias.id)||alias.id<=0||data.jobs.some(j=>j.id===alias.id)||alias.head_sha!==old.head
      ||alias.run_id!==old.runId||alias.run_attempt!==2||alias.status!=='completed')
     return{passed:false,reason:'specific-retry-owner-mismatch'};
    if(alias.name===name)continue;
    const source=data.jobs.find(j=>j.name===alias.name);
    // This optional diagnostic never executed. GitHub changes its synthetic
    // start timestamp on retry, although it still has no runner or steps.
    // It is not in the adopted gate inventory and supplies no measurement.
    if(source.id===120949556263&&source.name==='V1 Guardian Control Diagnostic'
      &&!ABILITY_NAME_REUSED_JOBS.includes(source.name)){
     const unexecuted=j=>j.conclusion==='skipped'&&j.runner_id===null&&j.runner_name===null
      &&Array.isArray(j.steps)&&j.steps.length===0&&typeof j.started_at==='string'&&Number.isFinite(Date.parse(j.started_at))
      &&typeof j.completed_at==='string'&&Number.isFinite(Date.parse(j.completed_at));
     if(!unexecuted(source)||!unexecuted(alias)||source.completed_at!==alias.completed_at)
      return{passed:false,reason:'unexecuted-diagnostic-copy-mismatch'};
     continue;
    }
    if(!executed(source)||!executed(alias)||JSON.stringify(execution(source))!==JSON.stringify(execution(alias)))
     return{passed:false,reason:'another-job-executed-in-the-recovery'};
   }
   const j=retry.jobs.find(j=>j.name===name);
   if(!Number.isSafeInteger(j?.id)||j.id<=0||data.jobs.some(old=>old.id===j.id)
     ||j.name!==name||j.run_id!==old.runId||j.head_sha!==old.head||j.run_attempt!==2||j.status!=='completed'||j.conclusion!=='success'
     ||!executed(original[0])||!executed(j)
     ||!(Date.parse(j.started_at)>Date.parse(original[0].completed_at))||!(Date.parse(j.completed_at)>=Date.parse(j.started_at))
     ||!step(j,'Setup Node.js','success')||!step(j,'Capture canonical HUD evidence','success')
     ||!step(j,'Upload canonical WebKit viewport evidence','success'))return{passed:false,reason:'specific-hud-recovery-not-successful'};
   adoptedJobs.splice(adoptedJobs.findIndex(j=>j.name===name),1,j);
   infrastructureRecovery={original:{id:original[0].id,run_attempt:1,conclusion:'failure',capture:'skipped'},unchangedCopiesNotAdopted:retry.jobs.length-1,
    replacement:{id:j.id,run_attempt:2,conclusion:'success',capture:'success'},head:old.head,runId:old.runId,name};
  }
  const successful=name=>{const rows=adoptedJobs.filter(j=>j.name===name);return rows?.length===1&&rows[0].status==='completed'
   &&rows[0].conclusion==='success'&&Number.isSafeInteger(rows[0].id);};
  if(!ABILITY_NAME_REUSED_JOBS.every(successful))return{passed:false,reason:'an-unchanged-browser-gate-is-not-successful'};
  const provenance=await immutablePrProvenance({get,runId:old.runId,head:old.head,base:old.base});
  const normalNames=['chromium','webkit'].map(engine=>`V1 Representative Normal Play (${engine})`),
    normalComplete=!paths.includes('scripts/v177-representative-battles.mjs')&&normalNames.every(successful);
  return{passed:true,head:old.head,base:old.base,prNumber:old.prNumber,runId:old.runId,provenance,infrastructureRecovery,
   originalRunConclusion:run.conclusion,
   reusedJobs:[...ABILITY_NAME_REUSED_JOBS,...(normalComplete?normalNames:[])].map(name=>{const j=adoptedJobs.find(j=>j.name===name);
    return{name,id:j.id,head_sha:j.head_sha,run_id:j.run_id,run_attempt:j.run_attempt};}),
   freshVerifyRequired:true,freshPerformanceRequired:true,freshPhaseGRequired:true,
   freshNormalRequired:!normalComplete};
 }catch{return{passed:false,reason:'original-browser-evidence-unavailable'};}
}
const r9=new Set(['scripts/v100-dialogue-composition-browser.mjs','scripts/v100-story-bookends-browser-smoke.mjs',
  'scripts/v100-r9-full-story-browser.mjs','scripts/v100-r9-story-plan.mjs']);
const orchestration=new Set(['.github/workflows/ci.yml','scripts/ci-change-scope.mjs',
  'scripts/ci-combat-qa-reuse.mjs',
  '.github/workflows/targeted-frame-performance.yml','scripts/v100-device-runtime-browser.mjs',
  '.github/workflows/native-aac-probe.yml','.github/workflows/normal-campaign-observation.yml',
  '.github/workflows/native-allunit-capture.yml','.github/workflows/v1-quality-acceptance.yml',
  '.github/workflows/native-aac-graph-probe.yml','.github/workflows/native-audio-capabilities.yml',
  '.github/workflows/native-opus-streaming.yml','.github/workflows/native-pcm-streaming.yml',
  '.github/workflows/native-capture-comparison.yml','.github/workflows/native-game-capture.yml',
  'scripts/v177-native-opus-probe.mjs','scripts/v177-native-audio-capabilities.mjs',
  'scripts/v177-native-game-capture-browser.mjs','scripts/v177-quality-apt-mirror.mjs']);
// Reviewed validation and QA-only observation revisions. Gameplay, rendering
// and limits are unchanged; a different blob restores full regression.
const reviewedValidationBlobs=Object.freeze({
  'scripts/v177-ranger-performance-receipts.mjs':'5b7edbda4231ae997eee17876805e449d95242dc',
  'scripts/v177-reaction-render-contract.mjs':'fb84ffd008b65864539c914c84a0f9b910c9acd7',
  // Preparation plus living/corpse observation and synchronous sample timing.
  'app/AshfallGame.tsx':'4445d531b03a44a1147a3ae44d74a8e869d7ba37',
  'scripts/v177-native-allunit-ranger-manual-contract.mjs':'5ef03bf92c4a8bcf455bf263e22aeeee6f1ba2b6',
  'scripts/v177-native-allunit-outcomes.mjs':'12e9ee396cc426db1a46d942de515c14a54b774b',
  'tests/helpers/v177-corpse-joint-render.mjs':'62813dcbd9eb06cd1ccf82ce38cf232da36b4f4c',
});
// These exact lifecycle revisions preserve existing paints until an actual
// registered boss phase increase. Down/rise reuse their original lifecycle clocks.
const reviewedLifecycleBlobs=Object.freeze({
  "app/AshfallGame.tsx": "36a0e8f329b34a778938d1a4fe0ee6c19c6712a6",
  "app/v177JointPresentation.js": "05ff9ad9def6c050c29eb7f81650aca6cddc6e37",
  "app/v177LifecyclePresentation.js": "dc13038fa0a3a9bb35f6aef0c06eca80eed4d760"
});
// Only Brute's knee solution changes. Native Brute cases are reopened by the
// source-pinned recovery profile; other forms keep identical draw matrices.
const reviewedBruteBlobs=Object.freeze({
  'app/v177JointPresentation.js':'e2e63704e18e43718fb9a332b689bc0f3c55987e',
});
const reviewedNativeControlBlobs=Object.freeze({
  'scripts/v100-macos-indexing-control.mjs':'31de4d8198b09346c728135887f38f42136968bf',
});
// Analytic vertical support preserves every original outline and floor value.
const reviewedSupportBlobs=Object.freeze({
  'app/v177CorpseJointPresentation.js':'b339f6379b252c2687e16361004e184d3029a85b',
});
// This stricter raw-RAF validation changes observation acceptance only. Its
// failed or missing recordings are selected by the source-pinned recovery.
const reviewedRawClockBlobs=Object.freeze({
  'scripts/v177-native-allunit-outcomes.mjs':'6d10a2beb094414f8b9b941d964962a3cc3f9f72',
});

export function framePerformanceRuntimes(paths,{workflowBlob}={}){
  const formal={runtime:'formal',host:'macos-15'},native={runtime:'native-recording-control',host:'macos-15-intel'};
  const workflow='.github/workflows/targeted-frame-performance.yml';
  const relevant=paths.some(p=>/^(app\/|public\/|package(-lock)?\.json$)/u.test(p)
    ||[workflow,'scripts/v100-device-runtime-browser.mjs','scripts/v177-ranger-performance-receipts.mjs'].includes(p));
  if(!relevant)return[];
  // Exact job-name/dispatch correction only. The recorded/native commands and
  // product are identical to2746; its running comparison must not be duplicated.
  if(workflowBlob==='774c4b1f8589ea83b407ef385bb09b1904519645'&&paths.includes(workflow)
    &&paths.every(p=>[workflow,'scripts/ci-change-scope.mjs','tests/ci-change-scope.test.mjs'].includes(p)))return[formal];
  return[formal,native];
}
const reviewedMotionBlobs=Object.freeze({
  'app/v177RangerLowerPaint.js':'463a8d228e93e722713af8d3e09a2809ea4e0255',
  'app/v177WeaponChoreography.js':'a01def970c07107bf764a1b0eecf8eeafea4e08e',
  'app/combatPresentation.js':'327c7a1dd55707c16385d01d28030a37dc4b27c7',
  'app/AshfallGame.tsx':'95df06a678e2be79ec076059df910dc95c33298c',
  'app/v177HitReaction.js':'6e7dc3705b3fa8ee8095c675b4046571a085e5af',
  'app/v100SoukiCollision.js':'bbb80fe0b36ff9c6ea2c37aa2d4de617be75b7be',
  'app/v100SoukiPresentation.js':'9769a43da24230afe829f9a423a2b8cd706f95b1',
  'app/v177JointPresentation.js':'46309033f92f10577af7135f34d1215fa8292466',
  'app/v177HumanCorpsePresentation.js':'0422000720875df12b57c9c721fa4c13a8317869',
  'scripts/v177-native-allunit-outcomes.mjs':'3044d3a932b23e74eecc5e6a937aec1b5f36e7d1',
  'scripts/v177-human-corpse-contract.mjs':'17568cb76138783d88365660e1ef04e23be26008',
});

export async function previousFullCiEvidence({repository,head,base,prNumber,token,request=fetch}={}){
  if(!/^[\w.-]+\/[\w.-]+$/u.test(repository??'')||!/^[a-f0-9]{40}$/u.test(head??'')
    ||!/^[a-f0-9]{40}$/u.test(base??'')||!Number.isSafeInteger(prNumber)||prNumber<1||!token)
    return{passed:false,reason:'previous-full-evidence-unavailable'};
  const get=async(suffix,binary=false)=>{
    const response=await request(`https://api.github.com/repos/${repository}/${suffix}`,{
      headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'},
      signal:AbortSignal.timeout(10_000),
    });
    if(!response.ok)throw Error('Actions evidence unavailable');return binary?response.arrayBuffer():response.json();
  };
  try{
    const data=await get(`actions/workflows/ci.yml/runs?head_sha=${head}&event=pull_request&per_page=10`);
    for(const run of data.workflow_runs??[]){
      if(run.head_sha!==head||run.status!=='completed'||run.conclusion!=='success'||!Number.isSafeInteger(run.id))continue;
      // PR associations expose the live branch tips. Only the original run
      // head and its digest-verified checkout provenance bind the old snapshot.
      if(!run.pull_requests?.some(pr=>pr.number===prNumber))continue;
      const data=await get(`actions/runs/${run.id}/jobs?filter=latest&per_page=100`);
      const phaseG=data.jobs?.find(job=>job.name==='V1 Phase G Production Matrix'&&job.status==='completed'
        &&job.conclusion==='success'&&Number.isSafeInteger(job.id));
      if(phaseG){
        const provenance=await immutablePrProvenance({get,runId:run.id,head,base});
        return{passed:true,head,base,prNumber,runId:run.id,fullOnlyJobId:phaseG.id,provenance};
      }
    }
    return{passed:false,reason:'no-successful-full-ci-for-previous-head'};
  }catch{return{passed:false,reason:'previous-full-evidence-unavailable'};}
}

// A completed CI does not establish the separate Quality result. Retain its
// own exact-head owner only when both original engine jobs actually passed.
export async function previousQualityEvidence({repository,head,prNumber,token,fullEvidence,displayEvidence,request=fetch}={}){
  const displayOnly=displayEvidence?.passed===true&&displayEvidence.head===ABILITY_NAME_BASELINE.head
    &&displayEvidence.base===ABILITY_NAME_BASELINE.base&&displayEvidence.freshVerifyRequired===true
    &&displayEvidence.freshPerformanceRequired===true&&displayEvidence.freshPhaseGRequired===true;
  const sourceOwner=displayOnly?displayEvidence:fullEvidence;
  if(sourceOwner?.passed!==true||sourceOwner.head!==head||sourceOwner.prNumber!==prNumber
    ||!/^[\w.-]+\/[\w.-]+$/u.test(repository??'')||!/^[a-f0-9]{40}$/u.test(head??'')||!Number.isSafeInteger(prNumber)||prNumber<1||!token)
    return{passed:false,reason:'verified-full-owner-required'};
  const get=async suffix=>{
    const response=await request(`https://api.github.com/repos/${repository}/${suffix}`,{
      headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'},
      signal:AbortSignal.timeout(10_000)});
    if(!response.ok)throw Error('Quality evidence unavailable');return response.json();
  };
  try{
    const data=await get(`actions/workflows/v1-quality-acceptance.yml/runs?head_sha=${head}&event=pull_request&per_page=10`);
    for(const run of data.workflow_runs??[]){
      if(run.head_sha!==head||run.status!=='completed'||run.conclusion!=='success'||!Number.isSafeInteger(run.id)
        ||!run.pull_requests?.some(pr=>pr.number===prNumber))continue;
      if(displayOnly&&(run.run_attempt!==1||run.event!=='pull_request'))continue;
      const data=await get(`actions/runs/${run.id}/jobs?filter=latest&per_page=100`);
      const names=['V1 Quality UI and Play (chromium)','V1 Quality UI and Play (webkit)'];
      const jobs=names.map(name=>data.jobs?.filter(job=>job.name===name));
      if(!jobs.every(rows=>rows?.length===1&&rows[0].status==='completed'&&rows[0].conclusion==='success'&&Number.isSafeInteger(rows[0].id)))continue;
      if(displayOnly&&(!Number.isSafeInteger(data.total_count)||data.total_count!==data.jobs.length||data.total_count>100
        ||!jobs.every(rows=>rows[0].id>0&&rows[0].run_id===run.id&&rows[0].head_sha===head&&rows[0].run_attempt===1)
        ||new Set(jobs.map(rows=>rows[0].id)).size!==jobs.length))continue;
      return{passed:true,head,prNumber,runId:run.id,jobIds:jobs.map(rows=>rows[0].id)};
    }
    return{passed:false,reason:'no-completed-original-quality-engines'};
  }catch{return{passed:false,reason:'quality-evidence-unavailable'};}
}

export function ciChangeScope(paths,{draft,sourceBlobs={},reuseNativeQa=false,reuseCombatQa=false,reuseCombatFixture=false,reuseAbilityNames=false,freshNormal=false}={}){
  assert.equal(typeof draft,'boolean');
  assert.equal(typeof reuseNativeQa,'boolean');
  assert.equal(typeof reuseCombatQa,'boolean');
  assert.equal(typeof reuseCombatFixture,'boolean');
  assert.equal(typeof reuseAbilityNames,'boolean');assert.equal(typeof freshNormal,'boolean');
  assert.ok(Array.isArray(paths)&&paths.length>0&&paths.every(p=>typeof p==='string'&&p&&!p.includes('\\')));
  // A synchronize update containing only native QA, its tests and the status
  // ledger cannot change the shipped app. Keep the prior full product run and
  // run the changed QA; Ready transitions and any product/unknown path stay full.
  const nativeQaOnly=reuseNativeQa&&nativeQaOnlyPaths(paths,sourceBlobs);
  const combatQaOnly=reuseCombatQa&&reviewedCombatQaPaths(paths,sourceBlobs);
  const combatFixtureOnly=reuseCombatFixture&&reviewedCombatFixturePaths(paths,sourceBlobs);
  const abilityNameOnly=reuseAbilityNames&&reviewedAbilityNamePaths(paths,sourceBlobs);
  let full=!draft&&!nativeQaOnly&&!combatQaOnly&&!combatFixtureOnly&&!abilityNameOnly,rangerChanged=false,
    normalChanged=abilityNameOnly&&freshNormal,allunitChanged=false,r9Changed=false,combatChanged=false;
  for(const file of paths){
    if(abilityNameOnly&&abilityNameFiles.has(file)){if(allunit.has(file))allunitChanged=true;continue;}
    if(ranger.has(file))rangerChanged=true;
    else if(normal.has(file))normalChanged=true;
    else if(allunit.has(file))allunitChanged=true;
    else if(r9.has(file))r9Changed=true;
    else if(reviewedCorrectionQaBlobs[file]){
      if(sourceBlobs[file]!==reviewedCorrectionQaBlobs[file])full=true;
    }
    else if(COMBAT_QA_BLOBS[file]&&sourceBlobs[file]===COMBAT_QA_BLOBS[file])combatChanged=true;
    else if(governance.has(file)||orchestration.has(file)||/^tests\/[^/]+\.test\.mjs$/u.test(file))continue;
    else if(reviewedBruteBlobs[file]&&sourceBlobs[file]===reviewedBruteBlobs[file])allunitChanged=true;
    else if(reviewedNativeControlBlobs[file]&&sourceBlobs[file]===reviewedNativeControlBlobs[file])allunitChanged=true;
    else if(reviewedSupportBlobs[file]&&sourceBlobs[file]===reviewedSupportBlobs[file])continue;
    else if(reviewedRawClockBlobs[file]&&sourceBlobs[file]===reviewedRawClockBlobs[file])continue;
    else if(reviewedLifecycleBlobs[file]&&sourceBlobs[file]===reviewedLifecycleBlobs[file]){normalChanged=true;allunitChanged=true;}
    else if(reviewedValidationBlobs[file]&&sourceBlobs[file]===reviewedValidationBlobs[file])continue;
    else if(reviewedMotionBlobs[file]&&sourceBlobs[file]===reviewedMotionBlobs[file]){
      normalChanged=true;allunitChanged=true;
      if(file==='app/v177JointPresentation.js'||file==='app/v177RangerLowerPaint.js')rangerChanged=true;
    }
    else full=true; // Unclassified changes retain the complete regression.
  }
  return {full,verify_full:full||abilityNameOnly,performance:full||abilityNameOnly,phaseg:full||abilityNameOnly,ranger:full||rangerChanged,normal:full||normalChanged,allunit:full||allunitChanged,r9:full||r9Changed,combat:full||combatChanged,
    scope:full?'full-regression':abilityNameOnly?'ability-name-display-delta':draft?'targeted-draft':combatQaOnly?'combat-qa-update-product-unchanged':combatFixtureOnly?'combat-fixture-update-product-unchanged':'native-qa-update-product-unchanged',wholeGameAccepted:false,
    finalIntegrationRequiresFullRegression:true};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const {CI_SCOPE_BASE:base,CI_SCOPE_HEAD:head,CI_SCOPE_DRAFT:draft,CI_SCOPE_ACTION:action,CI_SCOPE_PREVIOUS_HEAD:previousHead}=process.env;
  for(const sha of [base,head])assert.match(sha??'',/^[0-9a-f]{40}$/u);
  assert.ok(['true','false'].includes(draft));
  const comparisonBase=execFileSync('git',['merge-base',base,head],{encoding:'utf8',windowsHide:true}).trim();
  assert.match(comparisonBase,/^[0-9a-f]{40}$/u);
  const paths=execFileSync('git',['diff','--no-renames','--name-only',`${comparisonBase}..${head}`],{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/u).filter(Boolean);
  const sourceFiles=new Set([...paths.filter(file=>ABILITY_NAME_BLOBS[file]||reviewedCorrectionQaBlobs[file]||reviewedValidationBlobs[file]||reviewedMotionBlobs[file]||reviewedLifecycleBlobs[file]||reviewedBruteBlobs[file]||reviewedNativeControlBlobs[file]||reviewedSupportBlobs[file]||reviewedRawClockBlobs[file]||COMBAT_QA_BLOBS[file]),
    ...(Object.keys(COMBAT_QA_BLOBS).every(file=>paths.includes(file))?['.github/workflows/ci.yml','.github/workflows/v1-quality-acceptance.yml']:[]),
    ...(paths.includes('tests/v177-native-canvas-clips.test.mjs')?[...Object.keys(COMBAT_QA_BLOBS),
      '.github/workflows/ci.yml','.github/workflows/v1-quality-acceptance.yml','tests/v177-native-canvas-clips.test.mjs']:[])]);
  const sourceBlobs=Object.fromEntries([...sourceFiles].map(file=>{
    try{return[file,execFileSync('git',['rev-parse',`${head}:${file}`],{encoding:'utf8',windowsHide:true}).trim()];}
    catch{return[file,null];}
  }));
  const eligibleNativeReuse=action==='synchronize'&&previousHead===base&&comparisonBase===base
    &&/^[0-9a-f]{40}$/u.test(previousHead??'');
  const nativeQaOnlyCandidate=eligibleNativeReuse&&nativeQaOnlyPaths(paths,sourceBlobs);
  const previousFullEvidence=draft==='false'&&nativeQaOnlyCandidate
    ?await previousFullCiEvidence({repository:process.env.GITHUB_REPOSITORY,head:previousHead,
      base:process.env.CI_SCOPE_PR_BASE,prNumber:Number(process.env.CI_SCOPE_PR_NUMBER),token:process.env.CI_SCOPE_ACTIONS_TOKEN}):null;
  const reuseNativeQa=previousFullEvidence?.passed===true;
  const qualityPathsUnchanged=paths.every(file=>file==='docs/PROJECT_STATE.md'
    ||(reviewedCorrectionQaBlobs[file]&&sourceBlobs[file]===reviewedCorrectionQaBlobs[file]));
  let qualityEvidence=qualityPathsUnchanged?await previousQualityEvidence({repository:process.env.GITHUB_REPOSITORY,
    head:previousHead,prNumber:Number(process.env.CI_SCOPE_PR_NUMBER),token:process.env.CI_SCOPE_ACTIONS_TOKEN,fullEvidence:previousFullEvidence})
    :{passed:false,reason:'quality-dependencies-not-proven-unchanged'};
  const productPaths=['app','public','assets','package.json','package-lock.json','scripts/pwa-native-runtime/package.json','scripts/pwa-native-runtime/package-lock.json'];
  const eligibleCombatReuse=eligibleNativeReuse&&previousHead===COMBAT_QA_BASELINE.head&&reviewedCombatQaPaths(paths,sourceBlobs);
  const eligibleFixtureReuse=eligibleNativeReuse&&previousHead===COMBAT_FIXTURE_BASELINE.head&&reviewedCombatFixturePaths(paths,sourceBlobs);
  const productUnchanged=(eligibleCombatReuse||eligibleFixtureReuse)&&productPaths.every(file=>{
    const blob=execFileSync('git',['rev-parse',`${head}:${file}`],{encoding:'utf8',windowsHide:true}).trim();
    return [previousHead,...(eligibleFixtureReuse?[COMBAT_QA_BASELINE.head]:[])].every(ref=>
      execFileSync('git',['rev-parse',`${ref}:${file}`],{encoding:'utf8',windowsHide:true}).trim()===blob);
  });
  const combatQaEvidence=await previousCombatQaEvidence({repository:process.env.GITHUB_REPOSITORY,previousHead,
    base:process.env.CI_SCOPE_PR_BASE,prNumber:Number(process.env.CI_SCOPE_PR_NUMBER),action,draft:draft==='true',productUnchanged,
    paths,sourceBlobs,token:process.env.CI_SCOPE_ACTIONS_TOKEN});
  const combatFixtureEvidence=await previousCombatFixtureEvidence({repository:process.env.GITHUB_REPOSITORY,previousHead,
    base:process.env.CI_SCOPE_PR_BASE,prNumber:Number(process.env.CI_SCOPE_PR_NUMBER),action,draft:draft==='true',productUnchanged,
    paths,sourceBlobs,token:process.env.CI_SCOPE_ACTIONS_TOKEN});
  const abilityNameEvidence=eligibleNativeReuse?await previousAbilityNameEvidence({repository:process.env.GITHUB_REPOSITORY,previousHead,
    base:process.env.CI_SCOPE_PR_BASE,prNumber:Number(process.env.CI_SCOPE_PR_NUMBER),action,draft:draft==='true',paths,sourceBlobs,token:process.env.CI_SCOPE_ACTIONS_TOKEN})
    :{passed:false,reason:'previous-head-not-exact-ancestor'};
  if(abilityNameEvidence.passed)qualityEvidence=await previousQualityEvidence({repository:process.env.GITHUB_REPOSITORY,
    head:previousHead,prNumber:Number(process.env.CI_SCOPE_PR_NUMBER),token:process.env.CI_SCOPE_ACTIONS_TOKEN,displayEvidence:abilityNameEvidence});
  const scope=ciChangeScope(paths,{draft:draft==='true',sourceBlobs,reuseNativeQa,reuseCombatQa:combatQaEvidence.passed,reuseCombatFixture:combatFixtureEvidence.passed,
    reuseAbilityNames:abilityNameEvidence.passed,freshNormal:abilityNameEvidence.freshNormalRequired??false});
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,['full','verify_full','performance','phaseg','ranger','normal','allunit','r9','combat'].map(k=>`${k}=${scope[k]}\n`).join(''));
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`reuse_quality=${combatQaEvidence.passed||combatFixtureEvidence.passed||qualityEvidence.passed}\n`);
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `Validation: ${scope.scope}. Ready transitions and unknown product changes run full regression. Exact reviewed deltas retain only completed original gates with their source owners. The ability-name display delta reruns all19 conditional Verify browser/audit steps, tests, lint, content, build and formal performance; failed or missing normal-play evidence also runs again. Original failures remain failures.\n`);
  console.log(JSON.stringify({...scope,base,comparisonBase,head,eligibleNativeReuse,previousFullEvidence,qualityEvidence,combatQaEvidence,combatFixtureEvidence,abilityNameEvidence,changedPaths:paths}));
}
