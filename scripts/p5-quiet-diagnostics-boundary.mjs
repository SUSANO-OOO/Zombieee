const ERROR_KEYS = ["consoleErrors", "pageErrors", "requestFailures", "failedRequestDetails", "httpErrors", "warnings"];

// Capture the paused setup state inside the same quiet interval. Background
// fetches may begin while the browser is answering the state read.
export async function captureQuietDiagnosticsBoundary({
  diagnostics, label, timeoutMs, waitForNetworkIdle,
  now = Date.now, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const startedAt = now();
  const deadline = startedAt + timeoutMs;
  const samples = [];
  let last = null;
  let zeroSince = null;
  let quietRevision = null;
  const timeoutError = () => Object.assign(
    new Error(`${label} setup diagnostics deadline reached: ${JSON.stringify(last?.pendingRequestUrls ?? [])}`),
    { evidence: { timeoutMs, elapsedMs: now() - startedAt, samples, last } },
  );
  const bounded = async (operation) => {
    const remaining = deadline - now();
    if (remaining <= 0) throw timeoutError();
    let timer;
    try {
      const result = await Promise.race([
        operation(remaining),
        new Promise((_, reject) => { timer = setTimeout(() => reject(timeoutError()), remaining); }),
      ]);
      if (now() >= deadline) throw timeoutError();
      return result;
    } finally { clearTimeout(timer); }
  };
  const observe = () => {
    last = diagnostics.snapshot();
    if (!Number.isSafeInteger(last.networkActivityRevision) || last.networkActivityRevision < 0) {
      throw new Error(`${label} missing network activity revision`);
    }
    const sample = { elapsedMs: now() - startedAt, revision: last.networkActivityRevision, pending: last.pendingRequestCount, urls: last.pendingRequestUrls };
    const previous = samples.at(-1);
    if (!previous || previous.revision !== sample.revision || previous.pending !== sample.pending) {
      if (samples.length < 256) samples.push(sample);
    }
    for (const key of ERROR_KEYS) {
      if (last[key]?.length) throw Object.assign(new Error(`${label} setup ${key}: ${JSON.stringify(last[key])}`), { evidence: { samples, last } });
    }
    return last;
  };
  await bounded(waitForNetworkIdle);
  while (now() < deadline) {
    await bounded(() => diagnostics.settleDetails());
    const before = observe();
    if (before.pendingRequestCount === 0) {
      if (quietRevision !== before.networkActivityRevision) {
        zeroSince = now(); quietRevision = before.networkActivityRevision;
      }
      if (now() - zeroSince >= 250) {
        const stableState = await bounded(() => diagnostics.captureState());
        await bounded(() => diagnostics.settleDetails());
        const raw = observe();
        if (raw.pendingRequestCount === 0 && raw.networkActivityRevision === before.networkActivityRevision) {
          return { stableState, raw, quietBoundary: { timeoutMs, elapsedMs: now() - startedAt, quietMs: now() - zeroSince, samples } };
        }
        zeroSince = null; quietRevision = null;
      }
    } else { zeroSince = null; quietRevision = null; }
    await bounded((remaining) => wait(Math.min(50, remaining)));
  }
  throw timeoutError();
}
