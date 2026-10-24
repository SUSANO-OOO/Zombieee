import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load as loadYaml } from 'js-yaml';
import { v177CombatViewports, closeV177CombatReport } from '../scripts/v177-combat-workload.mjs';

test('the native WebKit groups partition the complete original viewport set without gaps or duplicates', () => {
  const all = [[1280, 720], [844, 390], [844, 340]];
  assert.deepEqual(v177CombatViewports(), all);
  assert.deepEqual([...v177CombatViewports('desktop-phone'), ...v177CombatViewports('phone-short')], all);
  for (const bad of ['unknown', '', '844x340', '__proto__']) assert.throws(() => v177CombatViewports(bad));
  assert.throws(() => v177CombatViewports('phone-short').push([1, 1]));
});

test('a stalled shutdown first persists incomplete evidence and cannot become a successful report', async () => {
  const report = { status: 'pass', cases: [{ width: 844, height: 340 }] }, saved = [];
  let release, entered;
  const closing = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { entered = resolve; });
  const pending = closeV177CombatReport(report, () => { entered(); return closing; }, async () => { saved.push(structuredClone(report)); });
  await ready;
  assert.equal(report.status, 'closing'); assert.equal(report.cleanupStatus, 'pending');
  assert.equal(saved[0].verificationStatus, 'pass'); assert.equal(saved[0].status, 'closing');
  assert.deepEqual(saved[0].cases, report.cases);
  release(); await pending;
  assert.equal(saved[1].status, 'pass'); assert.equal(saved[1].cleanupStatus, 'completed');
});

test('runtime and shutdown failures remain failures without losing the original error', async () => {
  for (const verification of ['pass', 'failed']) {
    const report = { status: verification, error: 'original runtime finding' }, saved = [];
    await closeV177CombatReport(report, async () => { throw Error('close failed'); }, async () => { saved.push(structuredClone(report)); });
    assert.equal(report.status, 'failed'); assert.equal(report.cleanupStatus, 'failed');
    assert.equal(report.error, 'original runtime finding'); assert.match(report.cleanupError, /close failed/);
    assert.equal(saved[0].status, 'closing');
  }
  const report = { status: 'failed', error: 'runtime failed' };
  await closeV177CombatReport(report, async () => {}, async () => {});
  assert.equal(report.status, 'failed'); assert.equal(report.error, 'runtime failed');
});

test('CI retains native hosts, exact checkout, the 30-minute deadline and an all-groups-required WebKit check', () => {
  const { jobs } = loadYaml(fs.readFileSync('.github/workflows/ci.yml', 'utf8'));
  const job = jobs['v102-combat'], groups = job.strategy.matrix.include;
  assert.deepEqual(groups.filter(row => row.engine === 'chromium').map(row => row.viewportGroup), ['all']);
  assert.deepEqual(groups.filter(row => row.engine === 'webkit').map(row => row.viewportGroup), ['desktop-phone', 'phone-short']);
  assert.ok(groups.filter(row => row.engine === 'webkit').every(row => row.os === 'macos-15-intel'));
  assert.equal(job['timeout-minutes'], 30); assert.equal(job['continue-on-error'], undefined);
  assert.equal(job.steps[0].with.ref, '${{ github.event.pull_request.head.sha }}');
  const play = job.steps.find(step => step.run?.includes('scripts/v102-combat-browser.mjs'));
  assert.equal(play.env.V102_COMBAT_VIEWPORT_GROUP, '${{ matrix.viewportGroup }}');
  const summary = jobs['v102-combat-webkit-summary'];
  assert.ok(summary.needs.includes('v102-combat'));assert.ok(summary.if.includes('always()'));
  assert.equal(summary['continue-on-error'], undefined);
  assert.equal(summary.steps[0].env.V177_COMBAT_MATRIX_RESULT, '${{ needs.v102-combat.result }}');
  assert.equal(summary.steps[0].run, 'test "$V177_COMBAT_MATRIX_RESULT" = success');
});
