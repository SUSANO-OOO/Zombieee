import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { V100_STAGE_IDS } from '../app/v100Registry.js';

export function normalPlayStageLimit(value) {
  const limit = value === undefined ? 30 : Number(value);
  assert.ok(Number.isInteger(limit) && limit >= 1 && limit <= 30, 'normal-play stage limit must be 1..30');
  return limit;
}

export function normalPlayPlatform(engine,platform=process.platform){
  assert.ok(['chromium','webkit'].includes(engine));
  assert.ok(['win32','linux','darwin'].includes(platform));
  if(engine==='webkit')assert.equal(platform,'darwin','WebKit acceptance requires the native macOS runtime');
}

// A bounded AI observation can finish with a real defeat. The original report
// preserves its outcome; neither an observed defeat nor three wins accepts game balance.
export function representativeNormalPlayScope({ candidateSha, engine, reportBytes }) {
  assert.match(candidateSha, /^[0-9a-f]{40}$/u);
  assert.ok(['chromium', 'webkit'].includes(engine));
  const report = JSON.parse(reportBytes.toString('utf8'));
  assert.equal(report.engine, engine);
  assert.equal(report.provenance?.head, candidateSha);
  normalPlayPlatform(engine,report.provenance?.platform);
  assert.match(report.build?.combinedSha256, /^[0-9a-f]{64}$/u);
  assert.deepEqual(report.normalPlayScope, { kind: 'representative-opening', stageLimit: 3, wholeCampaignAcceptance: false });
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.requestAudit?.unexpectedFailures, []);
  for (const key of ['resumeFrom', 'exploratoryContinuation', 'saveCaptureError', 'storageCaptureError', 'videoCaptureError']) assert.equal(report[key], undefined, key);
  assert.ok(report.videoBytes > 0, 'preserve the actual normal-play video');
  assert.ok(report.stages.length >= 1 && report.stages.length <= 3);
  for (const [index, stage] of report.stages.entries()) {
    assert.equal(stage.number, index + 1);
    assert.equal(stage.id, V100_STAGE_IDS[index]);
    assert.equal(stage.result?.battleRunId, `v100:${stage.id}:${stage.openingSave.revision}`);
    assert.equal(stage.status, stage.result.won === true ? 'won' : 'lost');
    if (index < report.stages.length - 1) assert.equal(stage.status, 'won');
  }
  const last = report.stages.at(-1);
  const defeated = last.status === 'lost';
  if (defeated) {
    assert.ok(['observed-defeat','failed'].includes(report.status));
    if(report.status==='failed')assert.equal(report.error, `Error: Normal-play defeat at Stage ${last.number}; preserve the result and diagnose before a new attempt`);
    else{assert.equal(report.error,undefined);assert.equal(report.technicalStatus,'passed');}
    assert.equal(last.result.won, false);
  } else {
    assert.equal(report.status, 'passed');
    assert.equal(report.error, undefined);
    assert.equal(report.stages.length, 3, 'a successful opening observation covers all three stages');
  }
  assert.deepEqual(report.finalSave.completedStageIds, V100_STAGE_IDS.slice(0, defeated ? last.number - 1 : 3));
  const savedResult = report.finalSave.pendingResult ?? report.finalSave.lastResult;
  assert.equal(savedResult?.battleRunId, last.result.battleRunId);
  assert.equal(savedResult.won, last.result.won);
  return {
    schema: 'v177-representative-normal-observation/v1', candidateSha, engine,
    scope: 'Opening stages 1..3 with a fresh save, actual earned CAPS and normal UI; later representative battles require separate evidence.',
    observationStatus: defeated ? 'defeat-requires-review' : 'opening-observed',
    normalReportStatus: report.status,
    normalReportSha256: createHash('sha256').update(reportBytes).digest('hex'),
    observedStages: report.stages.map(stage => ({ number: stage.number, status: stage.status })),
    unobservedOpeningStages: [1, 2, 3].slice(report.stages.length),
    wholeCampaignAcceptance: false, balanceAcceptance: false, releaseAcceptance: false,
  };
}

export function representativeNormalPlayScopeWithExit({childCode,...binding}) {
  try {
    const scope=representativeNormalPlayScope(binding);
    assert.equal(childCode,scope.normalReportStatus==='failed'?1:0,'unexpected child failure is not a normal defeat');
    return scope;
  }catch(scopeError) {
    let original;
    try{original=JSON.parse(binding.reportBytes.toString('utf8'));}catch{throw scopeError;}
    if(Number.isInteger(childCode)&&childCode!==0&&original?.status==='failed'
      &&typeof original.error==='string'&&original.error.trim()) {
      // The child Error object cannot cross the process boundary. Reconstruct
      // its saved message as primary, retaining strict validation as cause.
      throw new Error(original.error,{cause:scopeError});
    }
    throw scopeError;
  }
}

export async function runBrowserQa() {
  normalPlayPlatform(process.env.V100_NORMAL_PLAY_ENGINE??'chromium');
  assert.equal(normalPlayStageLimit(process.env.V100_NORMAL_PLAY_STAGE_LIMIT), 3);
  const childCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve('scripts/v100-normal-campaign-playthrough.mjs')], { stdio: 'inherit', env: process.env });
    child.on('error', reject); child.on('exit', resolve);
  });
  const directory = path.resolve(process.env.V100_NORMAL_PLAY_EVIDENCE_DIR);
  const reportBytes = await readFile(path.join(directory, 'report.json'));
  const scope = representativeNormalPlayScopeWithExit({childCode, candidateSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), engine: process.env.V100_NORMAL_PLAY_ENGINE, reportBytes });
  await writeFile(path.join(directory, 'representative-scope.json'), JSON.stringify(scope, null, 2) + '\n');
  console.log(JSON.stringify(scope));
  const fireComparison=process.env.V177_S25_FIRE_INPUT_COMPARISON==='1';
  if(fireComparison)assert.equal(process.env.V100_NORMAL_PLAY_ENGINE,'chromium','one S25 comparison on the Chromium diagnostic only');
  const representativeEnv=fireComparison?{...process.env,V177_S25_DEPLOY_OBSERVATION:'1'}:process.env;
  const representativeCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve('scripts/v177-representative-battles.mjs')], { stdio: 'inherit', env: representativeEnv });
    child.on('error', reject); child.on('exit', resolve);
  });
  assert.equal(representativeCode, 0, 'independent middle/late observations retain all technical failure controls');
  if(fireComparison){
    const comparisonCode=await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[path.resolve('scripts/v177-representative-battles.mjs')],{stdio:'inherit',env:{...representativeEnv,V177_REPRESENTATIVE_INPUT_CASE:'s25-fire-before-repeat-medic'}});
      child.on('error',reject);child.on('exit',resolve);
    });
    assert.equal(comparisonCode,0,'S25 input comparison retains every technical control and requires actual IDs; no win prerequisite');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await runBrowserQa();
}
