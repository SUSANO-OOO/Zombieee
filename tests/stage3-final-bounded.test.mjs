import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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

test("historical Stage 3 classifier recognizes a clean stable navigation target-close", () => {
  assert.equal(isRetryableTargetClosed(navigationFailure()), true);
});

test("Stage 3 candidate and exact-base never relaunch even a formerly retryable clean crash", async () => {
  for (const baseRoot of [null, "/fixture/exact-base"]) {
    const root = await mkdtemp(path.join(os.tmpdir(), "stage3-no-retry-"));
    let calls = 0;
    await assert.rejects(runStage3AudioBounded({
      baseRoot, mode: "final", evidenceRoot: root,
      executeAttempt: async (_base, attemptDir) => {
        calls += 1;
        await writeFile(path.join(attemptDir, "summary.json"), JSON.stringify(navigationFailure()));
        return { code: 1, signal: null };
      },
      createHostResourceTelemetry: async ({ metadata }) => {
        assert.equal(metadata.maximumAttemptCount, 1);
        return { event() {}, reference: () => ({ supported: false }), stop: async () => ({ supported: false }) };
      },
    }), /failed after 1 attempt/u);
    assert.equal(calls, 1);
    const report = JSON.parse(await readFile(path.join(root, "bounded-summary.json"), "utf8"));
    assert.equal(report.status, "failed");
    assert.equal(report.attempts.length, 1);
    assert.equal(report.attempts[0].retryableTargetClosed, true);
  }
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
  assert.match(runner, /attempt <= 1/);
  assert.doesNotMatch(runner, /attempt <= 2|Retrying once/);
  assert.match(runner, /attempts\.push\(\{ attempt, attemptDir, \.\.\.execution, retryableTargetClosed, summary \}\)/);
});

test("r7 final-cut waiting is Node-owned with the unchanged predicate and deadline", async () => {
  const smoke = await readFile(new URL("../scripts/p5-browser-smoke.mjs", import.meta.url), "utf8");
  const waiter = smoke.match(/async function waitForFinalCutPredicateFromNode[\s\S]*?\nasync function closePlaywrightResource/u)?.[0] ?? "";
  const finalCutBlock = smoke.match(/result\.phase = "final-cut";[\s\S]*?const pauseEvidence/u)?.[0] ?? "";
  assert.match(smoke, /class TimeoutError extends Error/);
  assert.match(waiter, /await page\.evaluate/);
  assert.match(waiter, /activeScriptedFinalCue/);
  assert.match(waiter, /const bossDefeatedIsFalse = bossDefeated === false/);
  assert.match(waiter, /document\.documentElement\.dataset\.audioScene/);
  assert.match(waiter, /matched: activeScriptedFinalCue && bossDefeatedIsFalse && audioSceneMatches/);
  assert.match(waiter, /setTimeout\(resolve, Math\.min\(50, remainingMs\)\)/);
  assert.match(waiter, /timeoutMs = timeout/);
  assert.match(waiter, /new TimeoutError/);
  assert.match(smoke, /this\.evidence = evidence/);
  assert.doesNotMatch(waiter, /Promise\.all|setInterval/);
  assert.match(finalCutBlock, /waitForFinalCutPredicateFromNode/);
  assert.doesNotMatch(finalCutBlock, /page\.waitForFunction/);
  assert.match(finalCutBlock, /timeoutMs: timeout/);
  assert.match(smoke, /FINAL_CUT_TRACE_INTERVAL_MS = 1_000/);
  assert.match(smoke, /FINAL_CUT_TRACE_MAX_SAMPLES = 75/);
  assert.match(smoke, /const timeout = Math\.max\(5_000, Number\(process\.env\.P5_QA_TIMEOUT_MS\) \|\| 45_000\)/);
});

test("r34 Stage 3 parent telemetry is serialized and fails closed without replacing product acceptance", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "stage3-r34-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const executeAttempt = async (_baseRoot, attemptDir) => {
    await writeFile(path.join(attemptDir, "summary.json"), `${JSON.stringify({
      total: 1,
      failed: 0,
      results: [{ status: "passed" }],
    })}\n`, "utf8");
    return { code: 0, signal: null };
  };
  const telemetryFactory = (summary) => async () => ({
    supported: summary.supported,
    event() {},
    reference: () => ({ schema: "v100-webkit-host-resource-telemetry/v1", supported: summary.supported }),
    stop: async () => summary,
  });

  const passed = await runStage3AudioBounded({
    mode: "final",
    evidenceRoot: path.join(root, "valid"),
    executeAttempt,
    createHostResourceTelemetry: telemetryFactory({
      supported: true,
      status: "complete",
      valid: true,
      invalidReason: null,
    }),
  });
  assert.equal(passed.status, "passed");
  assert.equal(passed.hostResourceTelemetryStatus, "complete");
  assert.equal(passed.hostResourceTelemetryValidity, true);
  assert.equal(passed.attempts.length, 1);

  await assert.rejects(runStage3AudioBounded({
    mode: "final",
    evidenceRoot: path.join(root, "invalid"),
    executeAttempt,
    createHostResourceTelemetry: telemetryFactory({
      supported: true,
      status: "invalid",
      valid: false,
      invalidReason: "webkit-web-content-never-observed",
    }),
  }), /failed at host-resource-telemetry/u);
  const failed = JSON.parse(await readFile(path.join(root, "invalid", "bounded-summary.json"), "utf8"));
  assert.equal(failed.status, "failed");
  assert.equal(failed.hostResourceTelemetryValidity, false);
  assert.equal(failed.hostResourceTelemetryInvalidReason, "webkit-web-content-never-observed");
  assert.equal(failed.attempts[0].code, 0);
});
