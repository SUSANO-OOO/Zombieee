// Retain every failure. Only a known, still-pending request cancelled while
// this driver closes its own context is a teardown cancellation.
export function installRequestFailureAudit(page) {
  const report = { rawFailures: [], unexpectedFailures: [], teardownAborts: [], teardown: null };
  const pending = new Map();
  let nextId = 1;
  let closingRequests = null;
  page.on('request', request => {
    pending.set(request, { id: nextId++, url: request.url(), method: request.method(),
      resourceType: request.resourceType(), startedAt: Date.now() });
  });
  page.on('requestfinished', request => pending.delete(request));
  page.on('requestfailed', request => {
    const started = pending.get(request);
    const reason = request.failure()?.errorText ?? 'unknown';
    const closing = report.teardown !== null && report.teardown.completedAt === null;
    const owned = closing && started !== undefined && closingRequests.has(request);
    const expected = owned && ['net::ERR_ABORTED', 'cancelled'].includes(reason);
    const row = { requestId: started?.id ?? null, url: request.url(), method: request.method(),
      resourceType: request.resourceType(), startedAt: started?.startedAt ?? null, failedAt: Date.now(), reason,
      phase: closing ? 'context-teardown' : 'case',
      classification: expected ? 'owned-context-teardown' : 'unexpected' };
    report.rawFailures.push(row);
    (expected ? report.teardownAborts : report.unexpectedFailures).push(row);
    pending.delete(request);
  });
  return {
    report,
    async closeContext(context) {
      if (context !== page.context()) throw new Error('Request audit can only close its own page context');
      if (report.teardown !== null) throw new Error('Request audit context already closed');
      closingRequests = new Set(pending.keys());
      report.teardown = { owner: 'owned-case-context', startedAt: Date.now(), completedAt: null,
        pendingRequests: [...pending.values()].map(row => ({ ...row })) };
      try {
        await context.close();
        // Drain events delivered by the awaited native close before ending the
        // boundary. A later failure remains unexpected.
        await new Promise(resolve => setImmediate(resolve));
      } finally {
        report.teardown.completedAt = Date.now();
      }
    },
  };
}

export function isInjectedMedia503Console(message, expectedUrl) {
  return Boolean(expectedUrl && message.location().url === expectedUrl
    && /^Failed to load resource:/u.test(message.text()) && /\b503\b/u.test(message.text()));
}

export async function finalizeRequestFailureEvidence({ report, browser, transport, error = null, writeReport }) {
  let failure = error;
  report.cleanupErrors = [];
  for (const [name, owner] of [['browser', browser], ['transport', transport]]) {
    try { await owner.close(); }
    catch (closeError) {
      report.cleanupErrors.push({ owner: name, error: String(closeError) });
      failure ??= closeError;
    }
  }
  await new Promise(resolve => setImmediate(resolve));
  for (const row of report.cases) {
    if (row.errors.length > 0 || row.requestFailures.length > 0) row.status = 'failed';
    if (row.status !== 'passed') failure ??= new Error(`Native audio diagnostics failed: ${row.name}; ${JSON.stringify({errors:row.errors,requestFailures:row.requestFailures})}`);
  }
  report.status = failure ? 'failed' : 'passed';
  if (failure) report.error = String(failure);
  await writeReport(report);
  if (failure) throw failure;
}
