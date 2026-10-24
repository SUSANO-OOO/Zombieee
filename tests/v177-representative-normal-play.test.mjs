import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { load as loadYaml } from 'js-yaml';
import { V100_STAGE_IDS } from '../app/v100Registry.js';
import { normalPlayStageLimit, representativeNormalPlayScope, representativeNormalPlayScopeWithExit } from '../scripts/v177-representative-normal-play.mjs';
import {normalPlayPlatform} from '../scripts/v177-representative-normal-play.mjs';

const candidateSha = 'a'.repeat(40);
function fixture(defeatedAt = null) {
  const count = defeatedAt ?? 3;
  const stages = Array.from({ length: count }, (_, index) => {
    const number = index + 1, id = V100_STAGE_IDS[index], won = number !== defeatedAt;
    return { number, id, openingSave: { revision: number * 11 }, status: won ? 'won' : 'lost', result: { battleRunId: `v100:${id}:${number * 11}`, won } };
  });
  return {
    engine: 'webkit', provenance: { head: candidateSha, platform: 'darwin' }, build: { combinedSha256: 'b'.repeat(64) },
    normalPlayScope: { kind: 'representative-opening', stageLimit: 3, wholeCampaignAcceptance: false },
    errors: [], requestAudit: { unexpectedFailures: [] }, videoBytes: 1234, stages,
    status: defeatedAt ? 'failed' : 'passed',
    ...(defeatedAt ? { error: `Error: Normal-play defeat at Stage ${defeatedAt}; preserve the result and diagnose before a new attempt` } : {}),
    finalSave: { completedStageIds: V100_STAGE_IDS.slice(0, defeatedAt ? defeatedAt - 1 : 3), lastResult: stages.at(-1).result },
  };
}
const observe = report => representativeNormalPlayScope({ candidateSha, engine: 'webkit', reportBytes: Buffer.from(JSON.stringify(report)) });

test('normal-route limits are finite, with the original full route still available explicitly', () => {
  assert.equal(normalPlayStageLimit(), 30);
  for (const limit of [1, 3, 30]) assert.equal(normalPlayStageLimit(String(limit)), limit);
  for (const bad of ['0', '31', '3.5', '', 'NaN']) assert.throws(() => normalPlayStageLimit(bad));
});

test('three actual opening wins are a bounded observation, not whole-game or balance acceptance', () => {
  const scope = observe(fixture());
  assert.equal(scope.observationStatus, 'opening-observed');
  assert.equal(scope.normalReportStatus, 'passed');
  assert.deepEqual(scope.unobservedOpeningStages, []);
  assert.equal(scope.wholeCampaignAcceptance, false);
  assert.equal(scope.balanceAcceptance, false);
  assert.equal(scope.releaseAcceptance, false);
});

test('a genuine defeat retains failed status and original bytes without blocking later developer fixtures', () => {
  for (const stage of [1, 2, 3]) {
    const bytes = Buffer.from(JSON.stringify(fixture(stage))), original = Buffer.from(bytes);
    const scope = representativeNormalPlayScope({ candidateSha, engine: 'webkit', reportBytes: bytes });
    assert.equal(scope.observationStatus, 'defeat-requires-review');
    assert.equal(scope.normalReportStatus, 'failed');
    assert.equal(scope.normalReportSha256, createHash('sha256').update(original).digest('hex'));
    assert.deepEqual(bytes, original);
    assert.deepEqual(scope.unobservedOpeningStages, [1, 2, 3].slice(stage));
    assert.equal(scope.balanceAcceptance, false);
  }
});

test('browser faults, missing coverage, forged results and old candidate reports cannot become ordinary defeat observations', () => {
  const mutations = [
    p => { p.errors.push('pageerror'); }, p => { p.requestAudit.unexpectedFailures.push({ url: '/missing' }); },
    p => { p.error = 'Error: timeout'; }, p => { p.saveCaptureError = 'capture failed'; },
    p => { p.storageCaptureError = 'capture failed'; }, p => { p.videoCaptureError = 'capture failed'; },
    p => { p.videoBytes = 0; }, p => { p.provenance.head = 'c'.repeat(40); },
    p => { p.provenance.platform = 'linux'; }, p => { p.engine = 'chromium'; },
    p => { p.resumeFrom = {}; }, p => { p.exploratoryContinuation = {}; },
    p => { delete p.normalPlayScope; }, p => { p.normalPlayScope.stageLimit = 30; },
    p => { p.stages[0].status = 'lost'; }, p => { p.stages[2].result.won = true; },
    p => { p.stages[2].result.battleRunId = 'unrelated'; }, p => { p.stages[2].number = 4; },
    p => { p.finalSave.completedStageIds = [...V100_STAGE_IDS]; },
  ];
  for (const mutate of mutations) { const report = fixture(3); mutate(report); assert.throws(() => observe(report)); }
  const incomplete = fixture(); incomplete.stages.pop(); assert.throws(() => observe(incomplete));
});

test('an incomplete failed child retains its saved primary error and the strict scope rejection as cause',()=>{
  const report=fixture();report.status='failed';report.error='TimeoutError: locator.click: Timeout 15000ms exceeded';
  report.stages=[{number:1,id:V100_STAGE_IDS[0],status:'running',openingSave:{revision:105},inputs:[],result:null}];
  const reportBytes=Buffer.from(JSON.stringify(report)),original=Buffer.from(reportBytes);
  assert.throws(()=>representativeNormalPlayScopeWithExit({childCode:1,candidateSha,engine:'webkit',reportBytes}),failure=>{
    assert.equal(failure.message,report.error);assert.equal(failure.cause?.code,'ERR_ASSERTION');return true;
  });
  assert.deepEqual(reportBytes,original);
  for(const childCode of [0,null])assert.throws(()=>representativeNormalPlayScopeWithExit({childCode,candidateSha,engine:'webkit',reportBytes}),
    failure=>failure.code==='ERR_ASSERTION'&&failure.cause===undefined);
  for(const error of [undefined,'','  ',12]) {
    const bad={...report,error};assert.throws(()=>representativeNormalPlayScopeWithExit({childCode:1,candidateSha,engine:'webkit',
      reportBytes:Buffer.from(JSON.stringify(bad))}),failure=>failure.code==='ERR_ASSERTION'&&failure.cause===undefined);
  }
  assert.throws(()=>representativeNormalPlayScopeWithExit({childCode:1,candidateSha,engine:'webkit',reportBytes:Buffer.from('{')}),SyntaxError);
});

test('the child-exit wrapper preserves successful and actual defeat observations and rejects inconsistent exits',()=>{
  for(const defeatedAt of [null,1,2,3]) {
    const reportBytes=Buffer.from(JSON.stringify(fixture(defeatedAt))),binding={candidateSha,engine:'webkit',reportBytes};
    assert.deepEqual(representativeNormalPlayScopeWithExit({childCode:defeatedAt?1:0,...binding}),representativeNormalPlayScope(binding));
    assert.throws(()=>representativeNormalPlayScopeWithExit({childCode:defeatedAt?0:1,...binding}),/unexpected child failure/u);
  }
});

test('CI keeps full developer progression separate from bounded normal observation', () => {
  const { jobs } = loadYaml(fs.readFileSync('.github/workflows/ci.yml', 'utf8'));
  assert.ok(jobs.verify.steps.some(step => step.run === 'node scripts/v100-devmode-full-campaign.mjs'));
  assert.equal(jobs.verify.needs?.includes('v177-normal-campaign') ?? false, false);
  for (const id of ['v177-normal-campaign']) {
    const play = jobs[id].steps.find(step => step.run?.includes('scripts/v177-representative-normal-play.mjs'));
    assert.equal(play.env.V100_NORMAL_PLAY_STAGE_LIMIT, '3');
    assert.equal(jobs[id]['continue-on-error'], undefined, 'unexpected failures remain hard CI failures');
  }
});

test('authorized Windows Chromium observation remains distinct from native macOS WebKit acceptance', () => {
  for(const platform of ['win32','linux','darwin'])normalPlayPlatform('chromium',platform);
  normalPlayPlatform('webkit','darwin');
  for(const platform of ['win32','linux'])assert.throws(()=>normalPlayPlatform('webkit',platform));
});

test('new defeat observations succeed technically while faults and malformed outcomes remain failures',()=>{
 const report=fixture(2);report.status='observed-defeat';report.technicalStatus='passed';delete report.error;
 const binding={candidateSha,engine:'webkit',reportBytes:Buffer.from(JSON.stringify(report))};
 const scope=representativeNormalPlayScopeWithExit({childCode:0,...binding});
 assert.equal(scope.observationStatus,'defeat-requires-review');assert.equal(scope.balanceAcceptance,false);
 assert.throws(()=>representativeNormalPlayScopeWithExit({childCode:1,...binding}));
 for(const mutate of [p=>{p.errors.push('RangeError');},p=>{p.videoCaptureError='timeout';},p=>{p.error='failure';},p=>{p.technicalStatus='failed';}]){
  const bad=structuredClone(report);mutate(bad);assert.throws(()=>observe(bad));
 }
});
