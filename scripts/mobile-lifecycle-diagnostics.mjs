const CAPABILITY_MESSAGES = [
  /\bAudioContext(?:\s+constructor)?\s+(?:is\s+)?unavailable\b/i,
  /\b(?:decodeAudioData|audio\s+decode(?:\s+API)?)\s+(?:API\s+)?(?:is\s+)?unavailable\b/i,
];

export const EXPECTED_NAVIGATION_TEARDOWN_FAILURES = new Set([
  "net::ERR_ABORTED",
  "Load request cancelled",
]);

export function classifyRequestFailure({
  failure,
  occurredAt = Date.now(),
  requestId = null,
  requestMetadata = null,
  navigationWindow = null,
} = {}) {
  if (!EXPECTED_NAVIGATION_TEARDOWN_FAILURES.has(String(failure ?? ""))) return "failure";
  if (!navigationWindow || !requestMetadata || requestMetadata.requestId !== requestId) {
    return "failure";
  }
  const inFlightAtNavigationStart = navigationWindow.inFlightRequestIds?.includes(requestId) === true;
  const startedByNavigation = navigationWindow.startedRequestIds?.includes(requestId) === true;
  if (!inFlightAtNavigationStart && !startedByNavigation) {
    return "failure";
  }
  if (requestMetadata.frameId === null || requestMetadata.frameId !== navigationWindow.targetFrameId) {
    return "failure";
  }
  if (startedByNavigation && requestMetadata.navigationWindowIdAtStart !== navigationWindow.id) {
    return "failure";
  }
  if (!Number.isFinite(Number(requestMetadata.startedAt))) return "failure";
  const startedAt = Number(navigationWindow.startedAt);
  const endedAt = navigationWindow.endedAt === null || navigationWindow.endedAt === undefined
    ? Number.POSITIVE_INFINITY
    : Number(navigationWindow.endedAt);
  if (!Number.isFinite(startedAt) || occurredAt < startedAt || occurredAt > endedAt) return "failure";
  return "navigation-teardown";
}

// WebKit reports a fetch that is torn down by a real away/back-forward
// navigation as a malformed-origin CORS pageerror. This exact browser string
// is only eligible for causal classification when the lifecycle probe observed
// it during that intentional teardown; an ordinary CORS error remains a
// product failure.
const WEBKIT_NAVIGATION_TEARDOWN_PAGE_ERROR = /^Fetch API cannot load http: \/\S+\/audio\/\S+ due to access control checks\.$/i;

export function isExpectedNavigationTeardownPageError(message) {
  return WEBKIT_NAVIGATION_TEARDOWN_PAGE_ERROR.test(String(message ?? ""));
}

export function classifyAudioDiagnostic(message, {
  audioContextConstructorAvailable = false,
  decodeApiAvailable = false,
} = {}) {
  const text = String(message ?? "");
  const capabilityMessage = CAPABILITY_MESSAGES.some((pattern) => pattern.test(text));
  if (capabilityMessage && (!audioContextConstructorAvailable || !decodeApiAvailable)) {
    return "capability-gap";
  }
  return "failure";
}

export function normalizeLifecycleDiagnostics(diagnostics, {
  audioContextConstructorAvailable = false,
  decodeApiAvailable = false,
  expectedNavigationTeardownPageErrors = [],
} = {}) {
  const rawPageErrors = [...(diagnostics.pageErrors ?? [])];
  const expectedTeardownErrors = new Set(expectedNavigationTeardownPageErrors);
  const audioCapabilityGaps = [];
  const audioFailures = [];
  const pageErrors = [];
  for (const error of rawPageErrors) {
    if (expectedTeardownErrors.has(error)) continue;
    const classification = classifyAudioDiagnostic(error, {
      audioContextConstructorAvailable,
      decodeApiAvailable,
    });
    if (classification === "capability-gap") {
      audioCapabilityGaps.push(error);
      continue;
    }
    if (/audio|AudioContext|decodeAudioData/i.test(error)) audioFailures.push(error);
    pageErrors.push(error);
  }
  return {
    ...diagnostics,
    pageErrors,
    rawPageErrors,
    rawWarnings: [...(diagnostics.rawWarnings ?? diagnostics.warnings ?? [])],
    expectedNavigationTeardownPageErrors: [...expectedTeardownErrors],
    audioCapabilityGaps,
    audioFailures,
  };
}
