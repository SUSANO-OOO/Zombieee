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
  };
  for (const resourceType of ["audio", "image", "script", "stylesheet"]) {
    assert.equal(classifyRequestFailure({
      failure: "Load request cancelled",
      occurredAt: 1_500,
      requestNavigationId: 7,
      navigationWindow,
    }), "navigation-teardown", resourceType);
    assert.equal(classifyRequestFailure({
      failure: "net::ERR_ABORTED",
      occurredAt: 1_500,
      requestNavigationId: null,
      navigationWindow: null,
    }), "failure", resourceType + " cancellation outside navigation");
  }
  assert.equal(classifyRequestFailure({
    failure: "net::ERR_ABORTED",
    occurredAt: 1_500,
    requestNavigationId: 8,
    navigationWindow,
  }), "failure", "navigation ID mismatch must not be whitelisted");
  assert.equal(classifyRequestFailure({
    failure: "net::ERR_ABORTED",
    occurredAt: 2_001,
    requestNavigationId: 7,
    navigationWindow,
  }), "failure", "cancellation after the explicit window must fail");
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
      requestNavigationId: 7,
      navigationWindow: { id: 7, startedAt: 1_000, endedAt: 2_000 },
    }), "failure", failure);
  }
});
