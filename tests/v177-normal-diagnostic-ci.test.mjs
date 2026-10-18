import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { load as loadYaml } from 'js-yaml';
import { NORMAL_DIAGNOSTIC_NEEDS, normalDiagnosticScope } from '../scripts/v177-normal-diagnostic-scope.mjs';

const { jobs } = loadYaml(fs.readFileSync('.github/workflows/ci.yml', 'utf8'));

function assertDiagnostic(job) {
  const required = jobs['v177-normal-campaign'];
  assert.ok(job, 'failed focused QA must not prevent ordinary campaign investigation');
  assert.deepEqual(job.needs, required.needs);
  assert.deepEqual(job.needs, [...NORMAL_DIAGNOSTIC_NEEDS]);
  assert.equal(job.if, "always() && needs.verify.result == 'success' && contains(needs.*.result, 'failure') && !contains(needs.*.result, 'cancelled')");
  const marker = job.steps.filter(s => s.run === 'node scripts/v177-normal-diagnostic-scope.mjs');
  assert.equal(marker.length, 1);assert.equal(marker[0].if, 'always()');
  assert.deepEqual(marker[0].env, {
    V100_NORMAL_PLAY_ENGINE: '${{ matrix.engine }}',
    V100_NORMAL_PLAY_EVIDENCE_DIR: 'outputs/v177-normal-campaign-diagnostic-${{ matrix.engine }}',
    GITHUB_PAGES_RELEASE_SHA: '${{ github.event.pull_request.head.sha }}',
    V177_NORMAL_DIAGNOSTIC_NEEDS: '${{ toJSON(needs) }}',
  });
  const directory = 'outputs/v177-normal-campaign-diagnostic-${{ matrix.engine }}';
  const play = job.steps.find(s => s.run?.includes('v177-representative-normal-play.mjs'));
  assert.equal(play.env.V100_NORMAL_PLAY_EVIDENCE_DIR, directory);
  assert.equal(play.env.V100_NORMAL_PLAY_STAGE_LIMIT, '3');
  assert.equal(play.env.V177_S25_FIRE_INPUT_COMPARISON, "${{ matrix.engine == 'chromium' && '1' || '0' }}",
    'only the explicit Chromium diagnostic adds the S25 input comparison');
  assert.equal(job.steps.at(-1).with.name, 'v177-normal-campaign-diagnostic-${{ matrix.engine }}');
  assert.equal(job.steps.at(-1).with.path, directory);
  const actual = structuredClone(job), expected = structuredClone(required);
  delete actual.name;delete actual.if;delete expected.name;
  actual.steps = actual.steps.filter(s => s.run !== 'node scripts/v177-normal-diagnostic-scope.mjs');
  const comparison = actual.steps.find(s => s.run?.includes('v177-representative-normal-play.mjs'));
  const baseline = expected.steps.find(s => s.run?.includes('v177-representative-normal-play.mjs'));
  assert.equal(Object.hasOwn(baseline.env, 'V177_S25_FIRE_INPUT_COMPARISON'), false, 'original normal-play baseline remains unchanged');
  delete comparison.env.V177_S25_FIRE_INPUT_COMPARISON;
  actual.steps = JSON.parse(JSON.stringify(actual.steps).replaceAll('v177-normal-campaign-diagnostic-', 'v177-normal-campaign-'));
  assert.deepEqual(actual, expected, 'all checkout/build/engines/route/240min/no-retry/artifact controls remain the original normal-play controls');
}

test('diagnostic normal play keeps the bounded observation and all technical failure controls', () => {
  assertDiagnostic(jobs['v177-normal-campaign-diagnostic']);
  for (const mutate of [
    j => j.needs.pop(),
    j => { delete j.steps.find(s => s.run?.includes('v177-representative-normal-play.mjs')).env.V177_S25_FIRE_INPUT_COMPARISON; },
    j => { j.steps.find(s => s.run?.includes('v177-representative-normal-play.mjs')).env.V177_S25_FIRE_INPUT_COMPARISON = '1'; },
    j => { j['continue-on-error'] = true; },
    j => { j['timeout-minutes'] += 1; },
    j => j.strategy.matrix.include.pop(),
    j => { j.steps.find(s => s.run?.includes('v177-representative-normal-play.mjs')).run += ' || true'; },
    j => { j.steps.find(s => s.env?.V100_NORMAL_PLAY_ENGINE && s.run?.includes('v177-representative-normal-play.mjs')).env.V100_NORMAL_PLAY_RESUME_DIR = 'stale-win'; },
    j => { j.steps.at(-1).with.name = 'v177-normal-campaign-${{ matrix.engine }}'; },
    j => { j.steps = j.steps.filter(s => s.run !== 'node scripts/v177-normal-diagnostic-scope.mjs'); },
  ]) {
    const job = structuredClone(jobs['v177-normal-campaign-diagnostic']);
    mutate(job);assert.throws(() => assertDiagnostic(job));
  }
});

test('the actual job condition runs only for a built candidate with failed, uncancelled focused QA', () => {
  const expression = jobs['v177-normal-campaign-diagnostic'].if
    .replaceAll('needs.verify.result', 'verify').replaceAll('needs.*.result', 'results');
  const condition = vm.runInNewContext('(verify,results)=>' + expression, {
    always: () => true, contains: (values, value) => values.includes(value),
  });
  const statuses = ['success', 'failure', 'skipped', 'cancelled'];
  for (let n = 0; n < 4 ** NORMAL_DIAGNOSTIC_NEEDS.length; n++) {
    let value = n;const results = NORMAL_DIAGNOSTIC_NEEDS.map(() => { const status = statuses[value % 4];value = Math.floor(value / 4);return status; });
    assert.equal(condition(results[0], results), results[0] === 'success' && results.includes('failure') && !results.includes('cancelled'));
  }
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
