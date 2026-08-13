import assert from "node:assert/strict";
import test from "node:test";

import { isRetryableTargetClosed } from "../scripts/run-stage3-final-bounded.mjs";

function cleanDiagnostics() {
  return {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    failedRequestDetails: [],
    httpErrors: [],
    pendingRequestCount: 0,
  };
}

function navigationFailure(overrides = {}) {
  const failure = {
    kind: "takuya-final-audio",
    phase: "navigation",
    status: "failed",
    error: "page.evaluate: Target page, context or browser has been closed",
    setupDiagnostics: {
      stableState: {
        screen: "battle",
        assetReadiness: { state: "ready", pending: 0, failed: 0 },
        battle: { screen: "battle", over: false },
      },
      raw: cleanDiagnostics(),
    },
    diagnostics: cleanDiagnostics(),
    ...overrides,
  };
  return { total: 1, failed: 1, results: [failure] };
}

test("Stage 3 bounded final retries a navigation target-close only from a clean stable battle", () => {
  assert.equal(isRetryableTargetClosed(navigationFailure()), true);
});

test("Stage 3 bounded final rejects navigation target-close without the exact stable boundary", () => {
  for (const mutate of [
    (failure) => { failure.setupDiagnostics.stableState.screen = "campaign"; },
    (failure) => { failure.setupDiagnostics.stableState.assetReadiness.pending = 1; },
    (failure) => { failure.setupDiagnostics.stableState.assetReadiness.failed = 1; },
    (failure) => { failure.setupDiagnostics.stableState.battle.over = true; },
    (failure) => { failure.setupDiagnostics.raw.pageErrors.push("boom"); },
    (failure) => { failure.setupDiagnostics.raw.pendingRequestCount = 1; },
    (failure) => { failure.diagnostics.httpErrors.push("500"); },
  ]) {
    const summary = navigationFailure();
    mutate(summary.results[0]);
    assert.equal(isRetryableTargetClosed(summary), false);
  }
});

test("Stage 3 bounded final never retries a product assertion or unknown phase", () => {
  assert.equal(isRetryableTargetClosed(navigationFailure({ error: "boss scene assertion failed" })), false);
  assert.equal(isRetryableTargetClosed(navigationFailure({ phase: "runtime-start" })), false);
});
