import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

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
  'scripts/v177-native-allunit-ranger-manual.mjs']);
const r9=new Set(['scripts/v100-dialogue-composition-browser.mjs','scripts/v100-story-bookends-browser-smoke.mjs',
  'scripts/v100-r9-full-story-browser.mjs','scripts/v100-r9-story-plan.mjs']);
const orchestration=new Set(['.github/workflows/ci.yml','scripts/ci-change-scope.mjs',
  '.github/workflows/native-aac-probe.yml','.github/workflows/normal-campaign-observation.yml',
  '.github/workflows/native-allunit-capture.yml','.github/workflows/v1-quality-acceptance.yml',
  '.github/workflows/native-aac-graph-probe.yml','.github/workflows/native-audio-capabilities.yml',
  '.github/workflows/native-opus-streaming.yml','.github/workflows/native-pcm-streaming.yml',
  '.github/workflows/native-capture-comparison.yml','.github/workflows/native-game-capture.yml',
  'scripts/v177-native-opus-probe.mjs','scripts/v177-native-audio-capabilities.mjs',
  'scripts/v177-native-game-capture-browser.mjs']);
// Reviewed raw-data validation repair only; capture code and product inputs
// are unchanged. A different blob restores full regression automatically.
const reviewedValidationBlobs=Object.freeze({
  'scripts/v177-native-allunit-outcomes.mjs':'15b01dfa46d964c86e87268838c9c9b0aba96645',
  'tests/helpers/v177-corpse-joint-render.mjs':'08f7a664e7df6ef71f208ebdc202ac8fb4ada748',
});
const reviewedMotionBlobs=Object.freeze({
  'app/combatPresentation.js':'327c7a1dd55707c16385d01d28030a37dc4b27c7',
  'app/AshfallGame.tsx':'a8c7dfee11aee1a95f1873ad799ee8cf0795c5d4',
  'app/v177JointPresentation.js':'6b529c553a38a643f5431dae7cd8a2b16dda81b1',
  'app/v177HumanCorpsePresentation.js':'0422000720875df12b57c9c721fa4c13a8317869',
  'scripts/v177-native-allunit-outcomes.mjs':'3044d3a932b23e74eecc5e6a937aec1b5f36e7d1',
  'scripts/v177-human-corpse-contract.mjs':'17568cb76138783d88365660e1ef04e23be26008',
});

export function ciChangeScope(paths,{draft,sourceBlobs={}}={}){
  assert.equal(typeof draft,'boolean');
  assert.ok(Array.isArray(paths)&&paths.length>0&&paths.every(p=>typeof p==='string'&&p&&!p.includes('\\')));
  let full=!draft,rangerChanged=false,normalChanged=false,allunitChanged=false,r9Changed=false;
  for(const file of paths){
    if(ranger.has(file))rangerChanged=true;
    else if(normal.has(file))normalChanged=true;
    else if(allunit.has(file))allunitChanged=true;
    else if(r9.has(file))r9Changed=true;
    else if(governance.has(file)||orchestration.has(file)||/^tests\/[^/]+\.test\.mjs$/u.test(file))continue;
    else if(reviewedValidationBlobs[file]&&sourceBlobs[file]===reviewedValidationBlobs[file])continue;
    else if(reviewedMotionBlobs[file]&&sourceBlobs[file]===reviewedMotionBlobs[file]){normalChanged=true;allunitChanged=true;}
    else full=true; // Unclassified changes retain the complete regression.
  }
  return {full,ranger:full||rangerChanged,normal:full||normalChanged,allunit:full||allunitChanged,r9:full||r9Changed,
    scope:full?'full-regression':'targeted-draft',wholeGameAccepted:false,
    finalIntegrationRequiresFullRegression:true};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const {CI_SCOPE_BASE:base,CI_SCOPE_HEAD:head,CI_SCOPE_DRAFT:draft}=process.env;
  for(const sha of [base,head])assert.match(sha??'',/^[0-9a-f]{40}$/u);
  assert.ok(['true','false'].includes(draft));
  const comparisonBase=execFileSync('git',['merge-base',base,head],{encoding:'utf8',windowsHide:true}).trim();
  assert.match(comparisonBase,/^[0-9a-f]{40}$/u);
  const paths=execFileSync('git',['diff','--no-renames','--name-only',`${comparisonBase}..${head}`],{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/u).filter(Boolean);
  const sourceBlobs=Object.fromEntries(paths.filter(file=>reviewedValidationBlobs[file]||reviewedMotionBlobs[file]).map(file=>{
    try{return[file,execFileSync('git',['rev-parse',`${head}:${file}`],{encoding:'utf8',windowsHide:true}).trim()];}
    catch{return[file,null];}
  }));
  const scope=ciChangeScope(paths,{draft:draft==='true',sourceBlobs});
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,['full','ranger','normal','allunit','r9'].map(k=>`${k}=${scope[k]}\n`).join(''));
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `Validation: ${scope.scope}. Full regression runs when the PR becomes ready. Skipped lanes are not acceptance or replacements for earlier failures.\n`);
  console.log(JSON.stringify({...scope,base,comparisonBase,head,changedPaths:paths}));
}
