import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {immutablePrProvenance} from './ci-pr-provenance.mjs';
import {COMBAT_QA_BASELINE,COMBAT_QA_BLOBS,reviewedCombatQaPaths,previousCombatQaEvidence} from './ci-combat-qa-reuse.mjs';

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

export function ciChangeScope(paths,{draft,sourceBlobs={},reuseNativeQa=false,reuseCombatQa=false}={}){
  assert.equal(typeof draft,'boolean');
  assert.equal(typeof reuseNativeQa,'boolean');
  assert.equal(typeof reuseCombatQa,'boolean');
  assert.ok(Array.isArray(paths)&&paths.length>0&&paths.every(p=>typeof p==='string'&&p&&!p.includes('\\')));
  // A synchronize update containing only native QA, its tests and the status
  // ledger cannot change the shipped app. Keep the prior full product run and
  // run the changed QA; Ready transitions and any product/unknown path stay full.
  const nativeQaOnly=reuseNativeQa&&paths.some(file=>allunit.has(file))
    &&paths.every(file=>allunit.has(file)||file==='docs/PROJECT_STATE.md'||nativeQaTests.has(file));
  const combatQaOnly=reuseCombatQa&&reviewedCombatQaPaths(paths,sourceBlobs);
  let full=!draft&&!nativeQaOnly&&!combatQaOnly,rangerChanged=false,normalChanged=false,allunitChanged=false,r9Changed=false,combatChanged=false;
  for(const file of paths){
    if(ranger.has(file))rangerChanged=true;
    else if(normal.has(file))normalChanged=true;
    else if(allunit.has(file))allunitChanged=true;
    else if(r9.has(file))r9Changed=true;
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
  return {full,ranger:full||rangerChanged,normal:full||normalChanged,allunit:full||allunitChanged,r9:full||r9Changed,combat:full||combatChanged,
    scope:full?'full-regression':draft?'targeted-draft':combatQaOnly?'combat-qa-update-product-unchanged':'native-qa-update-product-unchanged',wholeGameAccepted:false,
    finalIntegrationRequiresFullRegression:true};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const {CI_SCOPE_BASE:base,CI_SCOPE_HEAD:head,CI_SCOPE_DRAFT:draft,CI_SCOPE_ACTION:action,CI_SCOPE_PREVIOUS_HEAD:previousHead}=process.env;
  for(const sha of [base,head])assert.match(sha??'',/^[0-9a-f]{40}$/u);
  assert.ok(['true','false'].includes(draft));
  const comparisonBase=execFileSync('git',['merge-base',base,head],{encoding:'utf8',windowsHide:true}).trim();
  assert.match(comparisonBase,/^[0-9a-f]{40}$/u);
  const paths=execFileSync('git',['diff','--no-renames','--name-only',`${comparisonBase}..${head}`],{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/u).filter(Boolean);
  const sourceFiles=new Set([...paths.filter(file=>reviewedValidationBlobs[file]||reviewedMotionBlobs[file]||reviewedLifecycleBlobs[file]||reviewedBruteBlobs[file]||reviewedNativeControlBlobs[file]||reviewedSupportBlobs[file]||reviewedRawClockBlobs[file]||COMBAT_QA_BLOBS[file]),
    ...(Object.keys(COMBAT_QA_BLOBS).every(file=>paths.includes(file))?['.github/workflows/ci.yml','.github/workflows/v1-quality-acceptance.yml']:[])]);
  const sourceBlobs=Object.fromEntries([...sourceFiles].map(file=>{
    try{return[file,execFileSync('git',['rev-parse',`${head}:${file}`],{encoding:'utf8',windowsHide:true}).trim()];}
    catch{return[file,null];}
  }));
  const eligibleNativeReuse=action==='synchronize'&&previousHead===base&&comparisonBase===base
    &&/^[0-9a-f]{40}$/u.test(previousHead??'');
  const proposed=ciChangeScope(paths,{draft:draft==='true',sourceBlobs,reuseNativeQa:eligibleNativeReuse});
  const previousFullEvidence=draft==='false'&&proposed.scope==='native-qa-update-product-unchanged'
    ?await previousFullCiEvidence({repository:process.env.GITHUB_REPOSITORY,head:previousHead,
      base:process.env.CI_SCOPE_PR_BASE,prNumber:Number(process.env.CI_SCOPE_PR_NUMBER),token:process.env.CI_SCOPE_ACTIONS_TOKEN}):null;
  const reuseNativeQa=previousFullEvidence?.passed===true;
  const productPaths=['app','public','assets','package.json','package-lock.json','scripts/pwa-native-runtime/package.json','scripts/pwa-native-runtime/package-lock.json'];
  const eligibleCombatReuse=eligibleNativeReuse&&previousHead===COMBAT_QA_BASELINE.head&&reviewedCombatQaPaths(paths,sourceBlobs);
  const productUnchanged=eligibleCombatReuse&&productPaths.every(file=>execFileSync('git',['rev-parse',`${previousHead}:${file}`],{encoding:'utf8',windowsHide:true}).trim()
    ===execFileSync('git',['rev-parse',`${head}:${file}`],{encoding:'utf8',windowsHide:true}).trim());
  const combatQaEvidence=await previousCombatQaEvidence({repository:process.env.GITHUB_REPOSITORY,previousHead,
    base:process.env.CI_SCOPE_PR_BASE,prNumber:Number(process.env.CI_SCOPE_PR_NUMBER),action,draft:draft==='true',productUnchanged,
    paths,sourceBlobs,token:process.env.CI_SCOPE_ACTIONS_TOKEN});
  const scope=ciChangeScope(paths,{draft:draft==='true',sourceBlobs,reuseNativeQa,reuseCombatQa:combatQaEvidence.passed});
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,['full','ranger','normal','allunit','r9','combat'].map(k=>`${k}=${scope[k]}\n`).join(''));
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`reuse_quality=${combatQaEvidence.passed}\n`);
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `Validation: ${scope.scope}. Ready transitions, product and unknown changes run full regression. Source-unchanged QA recovery retains only completed original gates; affected combat groups run again, and original failures remain failures.\n`);
  console.log(JSON.stringify({...scope,base,comparisonBase,head,eligibleNativeReuse,previousFullEvidence,combatQaEvidence,changedPaths:paths}));
}
