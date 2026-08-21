import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { isRetryableTargetClosed } from "../scripts/run-stage3-audio-bounded.mjs";

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

test("Stage 3 bounded entrance retries only its exact clean semantic phases", () => {
  for (const phase of ["navigation", "entrance-start", "entrance-restart", "boss-music-duck-release"]) {
    assert.equal(isRetryableTargetClosed(navigationFailure({
      kind: "takuya-entrance-audio",
      phase,
    }), "entrance"), true);
  }
  assert.equal(isRetryableTargetClosed(navigationFailure({
    kind: "takuya-final-audio",
    phase: "boss-music-duck-release",
  }), "entrance"), false);
  assert.equal(isRetryableTargetClosed(navigationFailure({
    kind: "takuya-entrance-audio",
    phase: "boss-music-duck-release",
    error: "boss music asset assertion failed",
  }), "entrance"), false);
});

test("Stage 3 bounded entrance rejects dirty or unstable target-close incidents", () => {
  for (const mutate of [
    (failure) => { failure.setupDiagnostics.stableState.screen = "campaign"; },
    (failure) => { failure.setupDiagnostics.stableState.assetReadiness.pending = 1; },
    (failure) => { failure.setupDiagnostics.stableState.assetReadiness.failed = 1; },
    (failure) => { failure.setupDiagnostics.stableState.battle.over = true; },
    (failure) => { failure.setupDiagnostics.raw.requestFailures.push("aborted"); },
    (failure) => { failure.diagnostics.pageErrors.push("boom"); },
  ]) {
    const summary = navigationFailure({
      kind: "takuya-entrance-audio",
      phase: "boss-music-duck-release",
    });
    mutate(summary.results[0]);
    assert.equal(isRetryableTargetClosed(summary, "entrance"), false);
  }
});

test("r6 final-cut diagnostics are bounded, serialized by the child summary, and non-mutating", async () => {
  const smoke = await readFile(new URL("../scripts/p5-browser-smoke.mjs", import.meta.url), "utf8");
  const runner = await readFile(new URL("../scripts/run-stage3-audio-bounded.mjs", import.meta.url), "utf8");
  assert.match(smoke, /FINAL_CUT_TRACE_INTERVAL_MS = 1_000/);
  assert.match(smoke, /FINAL_CUT_TRACE_MAX_SAMPLES = 75/);
  assert.match(smoke, /function createFinalCutTrace\(/);
  assert.match(smoke, /snapshot\.bossDefeated/);
  assert.match(smoke, /storyBattleReceiptEventIds/);
  assert.match(smoke, /storyBattleEvaluatedCueKeys/);
  assert.match(smoke, /activeScriptedBarkIds/);
  assert.match(smoke, /pendingScriptedBarkIds/);
  assert.match(smoke, /lastSuccessfulSample/);
  assert.match(smoke, /awaitedPredicate/);
  assert.match(smoke, /await finalCutTrace\.capture\(\)/);
  assert.match(smoke, /result\.finalCutTrace = await finalCutTrace\.stop/);
  assert.match(smoke, /P5_QA_TIMEOUT_MS/);
  assert.match(runner, /attempt <= 2/);
  assert.match(runner, /if \(attempt !== 1 \|\| !retryableTargetClosed\) break/);
  assert.match(runner, /attempts\.push\(\{ attempt, attemptDir, \.\.\.execution, retryableTargetClosed, summary \}\)/);
});
