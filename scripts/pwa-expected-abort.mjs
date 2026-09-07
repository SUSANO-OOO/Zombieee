// macOS WebKit reports an intentional abort as the bare word "cancelled".
// Match the fixture's URL, phase and independent server-side abort time.
export function isExpectedPartialBundleAbort(failure, requests, bundleUrl) {
  if (failure.error !== "cancelled" || failure.url !== bundleUrl || !Number.isFinite(failure.at)) return false;
  const mode = failure.phase === "candidate-unqualified-incident-entry" ? "incident"
    : failure.phase === "candidate-unqualified-recovery-entry" ? "recovery" : null;
  return mode !== null && requests.some(request => request.mode === mode && request.aborted === true
    && Number.isFinite(request.startedAt) && Number.isFinite(request.durationMs)
    && Math.abs(failure.at - request.startedAt - request.durationMs) < 5000);
}
