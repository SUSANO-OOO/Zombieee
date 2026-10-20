import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { load as loadYaml } from 'js-yaml';
import { NORMAL_DIAGNOSTIC_NEEDS, normalDiagnosticScope } from '../scripts/v177-normal-diagnostic-scope.mjs';

const { jobs } = loadYaml(fs.readFileSync('.github/workflows/ci.yml', 'utf8'));

test('normal observation starts independently and retains technical failure controls',()=>{
 const job=jobs['v177-normal-campaign'];
 assert.deepEqual(job.needs,['scope']);
 assert.equal(jobs['v177-normal-campaign-diagnostic'],undefined,'a second full replay after an unrelated failure is unnecessary');
 assert.equal(job['continue-on-error'],undefined);assert.equal(job['timeout-minutes'],240);
 assert.deepEqual(job.strategy.matrix.include.map(row=>row.engine),['chromium','webkit']);
 assert.equal(job.steps[0].with.ref,'${{ github.event.pull_request.head.sha }}');
 const play=job.steps.find(step=>step.run?.endsWith('scripts/v177-representative-normal-play.mjs'));
 assert.equal(play.env.V100_NORMAL_PLAY_STAGE_LIMIT,'3');assert.equal(play.env.V100_NORMAL_PLAY_RESUME_DIR,undefined);
 assert.equal(play['continue-on-error'],undefined);assert.ok(!play.run.includes('|| true'));
 assert.equal(job.steps.at(-1).if,'always()');assert.equal(job.steps.at(-1).with['if-no-files-found'],'error');
});

test('diagnostic receipts retain failed or passed original reports without becoming release acceptance', () => {
  const needs = Object.fromEntries(NORMAL_DIAGNOSTIC_NEEDS.map(job => [job, { result: job === 'v100-phase-g-production' ? 'failure' : 'success' }]));
  const report = status => ({ status, engine: 'webkit', provenance: { head: 'a'.repeat(40) }, build: { combinedSha256: 'b'.repeat(64) }, earnedStages: status === 'passed' ? 30 : 4 });
  for (const status of ['passed', 'failed']) {
    const reportBytes = Buffer.from(JSON.stringify(report(status))), original = Buffer.from(reportBytes);
    const scope = normalDiagnosticScope({ candidateSha: 'a'.repeat(40), engine: 'webkit', needs, reportBytes });
    assert.equal(scope.releaseAcceptance, false);assert.equal(scope.normalReportStatus, status);
    assert.equal(scope.normalReportSha256, createHash('sha256').update(original).digest('hex'));
    assert.deepEqual(reportBytes, original, 'never rewrite the original result or failed save');
  }
  for (const mutate of [
    p => { p.needs.verify.result = 'failure'; },
    p => { p.needs['v102-combat'].result = 'cancelled'; },
    p => { p.needs['v102-combat'].result = 'in_progress'; },
    p => { p.needs['v100-phase-g-production'].result = 'success'; },
    p => { delete p.needs['v102-combat']; },
    p => { p.candidateSha = 'not-a-fixed-candidate'; },
    p => { p.reportBytes = Buffer.from('{"status":"pending"}'); },
    p => { p.reportBytes = Buffer.from(JSON.stringify({ ...report('passed'), engine: 'chromium' })); },
    p => { p.reportBytes = Buffer.from(JSON.stringify({ ...report('passed'), provenance: { head: 'c'.repeat(40) } })); },
    p => { p.reportBytes = Buffer.from(JSON.stringify({ ...report('passed'), build: { combinedSha256: 'not-the-build' } })); },
    p => { p.reportBytes = Buffer.from(JSON.stringify({ ...report('passed'), resumeFrom: { previousStatus: 'passed' } })); },
    p => { p.reportBytes = Buffer.from(JSON.stringify({ ...report('passed'), exploratoryContinuation: {} })); },
  ]) {
    const input = { candidateSha: 'a'.repeat(40), engine: 'webkit', needs: structuredClone(needs), reportBytes: Buffer.from(JSON.stringify(report('passed'))) };
    mutate(input);assert.throws(() => normalDiagnosticScope(input));
  }
});
