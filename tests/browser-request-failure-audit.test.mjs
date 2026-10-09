import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { installRequestFailureAudit, isInjectedMedia503Console, finalizeRequestFailureEvidence } from '../scripts/browser-request-failure-audit.mjs';

function fixture(onClose = () => {}) {
  const page = new EventEmitter();
  const context = { close: async () => onClose(page) };
  page.context = () => context;
  const audit = installRequestFailureAudit(page);
  return { page, context, audit };
}
function request(reason = 'net::ERR_ABORTED', url = 'http://127.0.0.1/audio/owned.mp3') {
  return { url: () => url, method: () => 'GET', resourceType: () => 'media', failure: () => ({ errorText: reason }) };
}

test('an active cancellation is retained and fails the request gate', () => {
  const { page, audit } = fixture();
  const req = request(); page.emit('request', req); page.emit('requestfailed', req);
  assert.equal(audit.report.rawFailures.length, 1);
  assert.equal(audit.report.unexpectedFailures.length, 1);
  assert.equal(audit.report.teardownAborts.length, 0);
  assert.equal(audit.report.rawFailures[0].phase, 'case');
  assert.equal(audit.report.rawFailures[0].reason, 'net::ERR_ABORTED');
});

test('an exact pending request aborted during its owned close is retained separately', async () => {
  const req = request();
  const { page, context, audit } = fixture(p => p.emit('requestfailed', req));
  page.emit('request', req); await audit.closeContext(context);
  assert.equal(audit.report.rawFailures.length, 1);
  assert.equal(audit.report.unexpectedFailures.length, 0);
  assert.equal(audit.report.teardownAborts.length, 1);
  const row = audit.report.rawFailures[0];
  assert.equal(row.classification, 'owned-context-teardown');
  assert.equal(row.requestId, audit.report.teardown.pendingRequests[0].id);
  assert.equal(row.url, audit.report.teardown.pendingRequests[0].url);
  assert.ok(row.failedAt >= audit.report.teardown.startedAt);
  assert.ok(row.failedAt <= audit.report.teardown.completedAt);
});

test('the same URL does not transfer ownership to a request started during close', async () => {
  const first = request(), later = request();
  const { page, context, audit } = fixture(p => { p.emit('request', later); p.emit('requestfailed', later); });
  page.emit('request', first); await audit.closeContext(context);
  assert.equal(audit.report.unexpectedFailures.length, 1);
  assert.notEqual(audit.report.rawFailures[0].requestId, audit.report.teardown.pendingRequests[0].id);
});

test('a non-cancellation transport failure during close still fails', async () => {
  const req = request('net::ERR_FAILED');
  const { page, context, audit } = fixture(p => p.emit('requestfailed', req));
  page.emit('request', req); await audit.closeContext(context);
  assert.equal(audit.report.unexpectedFailures.length, 1);
  assert.equal(audit.report.teardownAborts.length, 0);
});

test('late cancellations after the owned close boundary still fail', async () => {
  const req = request(); const { page, context, audit } = fixture();
  page.emit('request', req); await audit.closeContext(context); page.emit('requestfailed', req);
  assert.equal(audit.report.unexpectedFailures.length, 1);
  assert.equal(audit.report.rawFailures[0].phase, 'case');
});

test('a failure without a request-start observation cannot become an expected abort', async () => {
  const req = request();
  const { context, audit } = fixture(p => p.emit('requestfailed', req));
  await audit.closeContext(context);
  assert.equal(audit.report.rawFailures[0].requestId, null);
  assert.equal(audit.report.unexpectedFailures.length, 1);
});

test('a finished request is not pending at the close boundary', async () => {
  const req = request();
  const { page, context, audit } = fixture(p => p.emit('requestfailed', req));
  page.emit('request', req); page.emit('requestfinished', req); await audit.closeContext(context);
  assert.deepEqual(audit.report.teardown.pendingRequests, []);
  assert.equal(audit.report.unexpectedFailures.length, 1);
});

test('a different context cannot authorize request cancellations', async () => {
  const { audit } = fixture();
  await assert.rejects(audit.closeContext({ close: async () => {} }), /own page context/);
  assert.equal(audit.report.teardown, null);
});

test('only the exact injected song and native 503 message are expected console errors', () => {
  const song = 'http://127.0.0.1/audio/owned.mp3';
  const message = (url, text) => ({ location: () => ({ url }), text: () => text });
  const native503 = 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)';
  assert.equal(isInjectedMedia503Console(message(song, native503), song), true);
  assert.equal(isInjectedMedia503Console(message(song, native503), undefined), false);
  assert.equal(isInjectedMedia503Console(message(song + '?other', native503), song), false);
  assert.equal(isInjectedMedia503Console(message('', native503), song), false);
  assert.equal(isInjectedMedia503Console(message(song, native503.replace('503', '404')), song), false);
  assert.equal(isInjectedMedia503Console(message(song, 'Unexpected error 503'), song), false);
});

test('a late failure during browser shutdown changes both saved status and the process result', async () => {
  const report = { status: 'failed', cases: [{ name: 'last case', status: 'passed', errors: [], requestFailures: [] }] };
  let saved;
  await assert.rejects(finalizeRequestFailureEvidence({ report,
    browser: { close: async () => report.cases[0].requestFailures.push({ reason: 'late failure' }) },
    transport: { close: async () => {} }, writeReport: async value => { saved = JSON.parse(JSON.stringify(value)); },
  }), /Native audio diagnostics failed/);
  assert.equal(saved.status, 'failed');
  assert.equal(saved.cases[0].status, 'failed');
  assert.equal(saved.cases[0].requestFailures[0].reason, 'late failure');
});

test('both cleanup owners and evidence writing run even when stopping throws', async () => {
  const calls = []; const original = new Error('original case failure'); let saved;
  const report = { status: 'failed', cases: [] };
  await assert.rejects(finalizeRequestFailureEvidence({ report, error: original,
    browser: { close: async () => { calls.push('browser'); throw new Error('browser close failed'); } },
    transport: { close: async () => { calls.push('transport'); throw new Error('transport close failed'); } },
    writeReport: async value => { calls.push('write'); saved = JSON.parse(JSON.stringify(value)); },
  }), error => error === original);
  assert.deepEqual(calls, ['browser', 'transport', 'write']);
  assert.equal(saved.status, 'failed');
  assert.equal(saved.error, String(original));
  assert.equal(saved.cleanupErrors.length, 2);
});

test('a successful verdict is written only after both owners stop', async () => {
  const calls = []; const report = { status: 'failed', cases: [{ name: 'case', status: 'passed', errors: [], requestFailures: [], teardownAborts: [{}] }] };
  await finalizeRequestFailureEvidence({ report,
    browser: { close: async () => { assert.equal(report.status, 'failed'); calls.push('browser'); } },
    transport: { close: async () => { assert.equal(report.status, 'failed'); calls.push('transport'); } },
    writeReport: async value => { assert.equal(value.status, 'passed'); calls.push('write'); },
  });
  assert.deepEqual(calls, ['browser', 'transport', 'write']);
});
