import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyAudioDiagnostic,
  classifyRequestFailure,
  isExpectedNavigationTeardownPageError,
  normalizeLifecycleDiagnostics,
} from "../scripts/mobile-lifecycle-diagnostics.mjs";

test("AudioContext constructor absence is an explicit capability gap", () => {
  assert.equal(classifyAudioDiagnostic("AudioContext is unavailable", {
    audioContextConstructorAvailable: false,
    decodeApiAvailable: false,
  }), "capability-gap");
});

test("fetch/CORS errors remain failures even when Web Audio is unavailable", () => {
  const error = "Fetch API cannot load http://127.0.0.1:4177/audio/v070/sfx/ui-confirm.mp3 due to access control checks.";
  assert.equal(classifyAudioDiagnostic(error, {
    audioContextConstructorAvailable: false,
    decodeApiAvailable: false,
  }), "failure");
  const diagnostics = normalizeLifecycleDiagnostics({
    pageErrors: [error],
    requestFailures: [],
    httpErrors: [],
  }, {
    audioContextConstructorAvailable: false,
    decodeApiAvailable: false,
  });
  assert.deepEqual(diagnostics.audioCapabilityGaps, []);
  assert.deepEqual(diagnostics.audioFailures, [error]);
  assert.deepEqual(diagnostics.pageErrors, [error]);
  assert.deepEqual(diagnostics.rawPageErrors, [error]);
});

test("HTTP, empty, MIME, length, and decode errors are not capability gaps", () => {
  const errors = [
    "audio HTTP 503",
    "audio empty body",
    "audio MIME mismatch",
    "audio length mismatch",
    "decodeAudioData failed",
  ];
  for (const error of errors) {
    assert.equal(classifyAudioDiagnostic(error, {
      audioContextConstructorAvailable: false,
      decodeApiAvailable: false,
    }), "failure", error);
  }
});

test("only the exact WebKit audio teardown pageerror is causal when navigation observed it", () => {
  const teardownError = "Fetch API cannot load http: /127.0.0.1:4177/audio/v060/music/title.ogg due to access control checks.";
  assert.equal(isExpectedNavigationTeardownPageError(teardownError), true);
  const normalized = normalizeLifecycleDiagnostics({
    pageErrors: [teardownError],
    requestFailures: [],
    httpErrors: [],
  }, {
    audioContextConstructorAvailable: true,
    decodeApiAvailable: true,
    expectedNavigationTeardownPageErrors: [teardownError],
  });
  assert.deepEqual(normalized.pageErrors, []);
  assert.deepEqual(normalized.audioFailures, []);
  assert.deepEqual(normalized.rawPageErrors, [teardownError]);
  assert.deepEqual(normalized.expectedNavigationTeardownPageErrors, [teardownError]);
  assert.equal(isExpectedNavigationTeardownPageError(
    "Fetch API cannot load http://127.0.0.1:4177/audio/v060/music/title.ogg due to access control checks.",
  ), false);
  const ordinary = normalizeLifecycleDiagnostics({ pageErrors: [teardownError] }, {
    audioContextConstructorAvailable: true,
    decodeApiAvailable: true,
  });
  assert.deepEqual(ordinary.audioFailures, [teardownError]);
  assert.deepEqual(ordinary.pageErrors, [teardownError]);
});

test("only a matching explicit navigation window permits request cancellation", () => {
  const navigationWindow = {
    id: 7,
    startedAt: 1_000,
    endedAt: 2_000,
    targetFrameId: "frame-main",
    inFlightRequestIds: ["request-in-flight"],
    startedRequestIds: ["request-started"],
  };
  assert.equal(classifyRequestFailure({
    failure: "Load request cancelled",
    occurredAt: 1_500,
    requestId: "request-in-flight",
    requestMetadata: {
      requestId: "request-in-flight",
      startedAt: 900,
      navigationWindowIdAtStart: null,
      frameId: "frame-main",
    },
    navigationWindow,
  }), "navigation-teardown", "pre-existing in-flight request");
  assert.equal(classifyRequestFailure({
    failure: "net::ERR_ABORTED",
    occurredAt: 1_500,
    requestId: "request-started",
    requestMetadata: {
      requestId: "request-started",
      startedAt: 1_100,
      navigationWindowIdAtStart: 7,
      frameId: "frame-main",
    },
    navigationWindow,
  }), "navigation-teardown", "request started by navigation");
  for (const resourceType of ["audio", "image"]) {
    assert.equal(classifyRequestFailure({
      failure: "net::ERR_ABORTED",
      occurredAt: 1_500,
      requestId: `request-outside-${resourceType}`,
      requestMetadata: {
        requestId: `request-outside-${resourceType}`,
        startedAt: 900,
        navigationWindowIdAtStart: null,
        frameId: "frame-main",
      },
      navigationWindow: null,
    }), "failure", resourceType + " cancellation outside navigation");
  }
  assert.equal(classifyRequestFailure({
    failure: "net::ERR_ABORTED",
    occurredAt: 1_500,
    requestId: "request-started",
    requestMetadata: {
      requestId: "request-started",
      startedAt: 1_100,
      navigationWindowIdAtStart: 8,
      frameId: "frame-main",
    },
    navigationWindow,
  }), "failure", "navigation ID mismatch must not be whitelisted");
  assert.equal(classifyRequestFailure({
    failure: "net::ERR_ABORTED",
    occurredAt: 2_001,
    requestId: "request-started",
    requestMetadata: {
      requestId: "request-started",
      startedAt: 1_100,
      navigationWindowIdAtStart: 7,
      frameId: "frame-main",
    },
    navigationWindow,
  }), "failure", "cancellation after the explicit window must fail");
  assert.equal(classifyRequestFailure({
    failure: "net::ERR_ABORTED",
    occurredAt: 1_500,
    requestId: "request-started",
    requestMetadata: {
      requestId: "request-started",
      startedAt: 1_100,
      navigationWindowIdAtStart: 7,
      frameId: "frame-other",
    },
    navigationWindow,
  }), "failure", "frame mismatch must fail");
  assert.equal(classifyRequestFailure({
    failure: "net::ERR_ABORTED",
    occurredAt: 1_500,
    requestId: "request-without-metadata",
    requestMetadata: null,
    navigationWindow,
  }), "failure", "request metadata absence must fail");
});

test("non-cancellation transport, HTTP, CORS, and decode failures remain failures", () => {
  for (const failure of [
    "net::ERR_FAILED",
    "HTTP 503",
    "CORS access control checks",
    "decodeAudioData failed",
  ]) {
    assert.equal(classifyRequestFailure({
      failure,
      occurredAt: 1_500,
      requestId: "request-transport",
      requestMetadata: {
        requestId: "request-transport",
        startedAt: 1_100,
        navigationWindowIdAtStart: 7,
        frameId: "frame-main",
      },
      navigationWindow: {
        id: 7,
        startedAt: 1_000,
        endedAt: 2_000,
        targetFrameId: "frame-main",
        inFlightRequestIds: [],
        startedRequestIds: ["request-transport"],
      },
    }), "failure", failure);
  }
});
