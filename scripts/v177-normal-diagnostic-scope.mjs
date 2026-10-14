import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const NORMAL_DIAGNOSTIC_NEEDS = Object.freeze([
  'verify', 'v102-combat', 'v103-audio-output', 'v102-enemy-contacts',
  'r9-story', 'v100-native-webkit-pwa', 'v100-phase-g-production',
]);

export function normalDiagnosticScope({ candidateSha, engine, needs, reportBytes }) {
  assert.match(candidateSha, /^[0-9a-f]{40}$/u);
  assert.ok(['chromium', 'webkit'].includes(engine));
  assert.deepEqual(Object.keys(needs).sort(), [...NORMAL_DIAGNOSTIC_NEEDS].sort());
  const prerequisites = NORMAL_DIAGNOSTIC_NEEDS.map(job => ({ job, result: needs[job].result }));
  assert.equal(needs.verify.result, 'success', 'the exact candidate must build before diagnostic play');
  assert.ok(prerequisites.every(p => ['success', 'failure', 'skipped'].includes(p.result)), 'cancelled or unresolved prerequisites cannot start diagnostic play');
  assert.ok(prerequisites.some(p => p.result === 'failure'), 'successful candidates use the original required normal-play job');
  const report = JSON.parse(reportBytes.toString('utf8'));
  assert.ok(['passed', 'failed'].includes(report.status), 'retain a terminal normal-play result');
  assert.equal(report.engine, engine, 'retain the actual native engine');
  assert.equal(report.provenance?.head, candidateSha, 'diagnostic evidence must belong to the exact candidate');
  assert.match(report.build?.combinedSha256, /^[0-9a-f]{64}$/u);
  assert.equal(report.resumeFrom, undefined, 'diagnostic play must begin with the original fresh save');
  assert.equal(report.exploratoryContinuation, undefined, 'do not relabel a continuation across builds');
  return {
    schema: 'v177-normal-play-diagnostic/v1',
    evidenceKind: 'earned normal play after a focused QA failure',
    releaseAcceptance: false,
    candidateSha, engine, prerequisites,
    normalReportStatus: report.status,
    normalReportBuildSha256: report.build.combinedSha256,
    normalReportSha256: createHash('sha256').update(reportBytes).digest('hex'),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const engine = process.env.V100_NORMAL_PLAY_ENGINE;
  const directory = process.env.V100_NORMAL_PLAY_EVIDENCE_DIR;
  assert.equal(directory, 'outputs/v177-normal-campaign-diagnostic-' + engine);
  const bytes = await readFile(path.join(directory, 'report.json'));
  const scope = normalDiagnosticScope({
    candidateSha: process.env.GITHUB_PAGES_RELEASE_SHA,
    engine,
    needs: JSON.parse(process.env.V177_NORMAL_DIAGNOSTIC_NEEDS),
    reportBytes: bytes,
  });
  await writeFile(path.join(directory, 'diagnostic-scope.json'), JSON.stringify(scope, null, 2) + '\n');
}
