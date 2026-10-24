// macOS WebKit reports an intentional abort as the bare word "cancelled".
// Match the fixture's URL, phase and independent server-side abort time.
export function isExpectedPartialBundleAbort(failure, requests, bundleUrl) {
  if (failure.error !== "cancelled" || failure.url !== bundleUrl || !Number.isFinite(failure.at)) return false;
  const mode = failure.phase === "candidate-unqualified-incident-entry" ? "incident"
    : failure.phase === "candidate-unqualified-recovery-entry" ? "recovery" : null;
  return mode !== null && requests.some(request => {
    if (request.mode !== mode || request.aborted !== true
      || !Number.isFinite(request.startedAt) || !Number.isFinite(request.durationMs)) return false;
    if (Object.hasOwn(request, 'cancelRequestedAt')) {
      const intent = request.cancelRequestedAt, endedAt = request.startedAt + request.durationMs;
      // The fixture clicked Cancel for this single held incident request.
      // WebKit may close the server socket later than its client notification.
      return mode === 'incident' && Number.isInteger(request.index) && request.index >= 4
        && request.completed === false && Number.isFinite(intent)
        && intent >= request.startedAt && intent <= endedAt
        && failure.at >= intent && failure.at - intent < 5000;
    }
    return Math.abs(failure.at - request.startedAt - request.durationMs) < 5000;
  });
}

export function isCausalPwaIncidentRetry(previous, retry) {
  return previous?.mode === "incident" && previous.index === 4
    && previous.aborted === true && previous.completed === false
    && Number.isFinite(previous.startedAt) && Number.isFinite(previous.durationMs)
    && previous.durationMs >= 30_000
    && retry?.mode === "incident" && retry.index === 5 && retry.completed === false
    && Number.isFinite(retry.startedAt)
    && retry.startedAt >= previous.startedAt + previous.durationMs;
}

export function markPartialBundleCancelIntent(requests, at) {
  if (!Number.isFinite(at)) throw new TypeError('A finite fixture cancellation time is required');
  const held = requests.filter(request => request.mode === 'incident'
    && Number.isInteger(request.index) && request.index >= 4
    && request.completed === false && request.aborted === false
    && Number.isFinite(request.startedAt) && request.startedAt <= at);
  if (held.length !== 1 || Object.hasOwn(held[0], 'cancelRequestedAt')) {
    throw new Error('Cancel must own exactly one currently held incident request');
  }
  held[0].cancelRequestedAt = at;
}
