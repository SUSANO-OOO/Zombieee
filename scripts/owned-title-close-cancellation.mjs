// A browser owner may cancel an unfinished, already stopped title stream when
// closing its context. Keep the raw failure and accept only that exact boundary.
// Runtime cancellations and missing observations remain failures.
export function isOwnedTitleCloseCancellation(failure, close) {
  const request = failure?.request;
  const native = close?.titleMedia;
  return Boolean(
    failure?.kind === "request" && failure.text === "net::ERR_ABORTED"
    && failure.phase === "context-closing"
    && Number.isFinite(failure.at)
    && close?.captureComplete === true && close.runtimeErrorsBeforeClose === 0
    && close.pageWasOpen === true && close.unexpectedPageLoss === false
    && close.succeeded === true && close.error === null
    && Number.isFinite(close.startedAt) && Number.isFinite(close.completedAt)
    && close.completedAt >= close.startedAt
    && failure.at >= close.startedAt && failure.at <= close.completedAt
    && typeof request?.id === "string" && request.id.length > 0
    && close.pendingRequestIds?.includes(request.id)
    && request.resourceType === "media" && request.frame === "main"
    && Number.isFinite(request.startedAt) && request.startedAt <= close.startedAt
    && typeof close.expectedTitleUrl === "string"
    && failure.url === close.expectedTitleUrl && request.url === failure.url
    && close.titleMediaCount === 1 && native?.src === failure.url
    && Number.isFinite(native.observedAt) && native.observedAt <= close.startedAt
    && native.paused === true && native.connected === false
    && native.error === null && native.rate === 1
    && (native.nativeVolume === 0 || native.gain === 0)
  );
}
