export function onlyAbortedStaticStreams(summary) {
  if (!(summary.total > 0 && summary.failed === summary.total)) return false;
  return summary.results.every((result) => result.status === "failed"
    && /^Browser diagnostics were not clean:/u.test(result.error ?? "")
    && (result.diagnostics?.consoleErrors ?? []).length === 0
    && (result.diagnostics?.pageErrors ?? []).length === 0
    && (result.diagnostics?.httpErrors ?? []).length === 0
    && (result.diagnostics?.requestFailures ?? []).length > 0
    && result.diagnostics.requestFailures.every((failure) => / :: net::ERR_ABORTED$/u.test(failure)));
}
