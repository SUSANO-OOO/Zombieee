import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { isRetryableTargetClosed, runStage3AudioBounded } from "../scripts/run-stage3-audio-bounded.mjs";

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

test("Stage 3 runner preserves a clean target-close failure without retrying", async () => {
  const evidenceRoot = await mkdtemp(path.join(os.tmpdir(), "stage3-single-attempt-"));
  const calls = [];
  await assert.rejects(() => runStage3AudioBounded({
    evidenceRoot,
    executeAttempt: async (_baseRoot, attemptDir) => {
      calls.push(attemptDir);
      await writeFile(path.join(attemptDir, "summary.json"), JSON.stringify(navigationFailure()));
      return { code: 1, signal: null };
    },
  }), /failed after 1 attempt/u);
  const report = JSON.parse(await readFile(path.join(evidenceRoot, "bounded-summary.json"), "utf8"));
  assert.equal(report.status, "failed");
  assert.equal(report.attempts.length, 1);
  assert.equal(report.attempts[0].retryableTargetClosed, true);
  assert.deepEqual(calls, [path.join(evidenceRoot, "attempt-1")]);
});
