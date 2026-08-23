import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CANONICAL_HUD_STATES,
  runCanonicalHudStates,
  runOneHudStateBounded,
} from "../scripts/run-v099-hud-states-bounded.mjs";

function passedSummary(stateId) {
  return {
    total: 1,
    passed: 1,
    failed: 0,
    caseTypes: ["hud"],
    hudStateFilterActive: true,
    hudStates: [stateId],
    results: [{
      type: "hud",
      status: "passed",
      states: [{ id: stateId, screenshot: `${stateId}.png` }],
      diagnostics: { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] },
    }],
  };
}

const EMPTY_DIAGNOSTICS = Object.freeze({
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  httpErrors: [],
});

function failedHudSummary(stateId, lifecycleLog, overrides = {}) {
  return {
    total: 1,
    passed: 0,
    failed: 1,
    caseTypes: ["hud"],
    hudStateFilterActive: true,
    hudStates: [stateId],
    buildIdentityAtStart: { combinedSha256: "stable-build" },
    buildIdentityAtEnd: { combinedSha256: "stable-build" },
    buildIdentityStable: true,
    results: [{
      type: "hud",
      status: "failed",
      error: "battle messages did not clear: page.waitForFunction: Target page, context or browser has been closed",
      lifecycleLog,
      diagnostics: { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] },
      ...overrides.result,
    }],
    ...overrides.summary,
  };
}

async function writeCleanCrashLifecycle(attemptDir, mode = "clean") {
  const lifecyclePath = path.join(attemptDir, "stage3-boss-hud-lifecycle.jsonl");
  const diagnostics = { ...EMPTY_DIAGNOSTICS };
  const entries = [
    { event: "case start", normalCleanupStarted: false, pageDiagnostics: diagnostics },
    { event: "battle readiness complete", milestone: "battle readiness complete", normalCleanupStarted: false, pageDiagnostics: diagnostics },
  ];
  if (mode !== "page-close-only") {
    entries.push({
      event: "page crash",
      unexpected: true,
      normalCleanupStarted: mode === "cleanup-owned",
      pageDiagnostics: diagnostics,
    });
  }
  entries.push({
    event: "page close",
    unexpected: mode !== "cleanup-owned",
    normalCleanupStarted: mode === "cleanup-owned",
    pageDiagnostics: diagnostics,
  });
  if (mode === "cleanup-owned") entries.push({ event: "context close begin", normalCleanupStarted: true, pageDiagnostics: diagnostics });
  await writeFile(lifecyclePath, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
  return lifecyclePath;
}

async function writeSummary(attemptDir, summary) {
  await mkdir(attemptDir, { recursive: true });
  await writeFile(path.join(attemptDir, "summary.json"), `${JSON.stringify(summary)}\n`);
}

test("HUD state aggregator requires every canonical state and actual evidence", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hud-states-pass-"));
  const calls = [];
  const report = await runCanonicalHudStates({
    evidenceRoot: root,
    runAttempt: async ({ stateId, attemptDir }) => {
      calls.push(stateId);
      await writeSummary(attemptDir, passedSummary(stateId));
      return { code: 0, output: `${stateId} passed\n` };
    },
  });
  assert.equal(report.status, "passed");
  assert.deepEqual(calls, CANONICAL_HUD_STATES);
});

test("HUD state aggregator rejects missing and duplicate inventory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hud-states-inventory-"));
  await assert.rejects(() => runCanonicalHudStates({
    evidenceRoot: root,
    stateIds: CANONICAL_HUD_STATES.slice(1),
    runAttempt: async () => ({ code: 0, output: "" }),
  }), /every canonical state exactly once/u);
  await assert.rejects(() => runCanonicalHudStates({
    evidenceRoot: root,
    stateIds: [...CANONICAL_HUD_STATES.slice(0, -1), CANONICAL_HUD_STATES[0]],
    runAttempt: async () => ({ code: 0, output: "" }),
  }), /every canonical state exactly once/u);
});

test("HUD state aggregator retries only exact target-close and still requires a real pass", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hud-states-retry-"));
  let firstCalls = 0;
  const report = await runCanonicalHudStates({
    evidenceRoot: root,
    runAttempt: async ({ stateId, attempt, attemptDir }) => {
      if (stateId === CANONICAL_HUD_STATES[0] && attempt === 1) {
        firstCalls += 1;
        const lifecycleLog = await writeCleanCrashLifecycle(attemptDir);
        await writeSummary(attemptDir, failedHudSummary(stateId, lifecycleLog));
        return { code: 1, output: "page.screenshot: Target page, context or browser has been closed\n" };
      }
      await writeSummary(attemptDir, passedSummary(stateId));
      return { code: 0, output: "passed\n" };
    },
  });
  assert.equal(report.status, "passed");
  assert.equal(firstCalls, 1);
  assert.equal(report.states[0].attempts.length, 2);
});

test("HUD state aggregator classifies target-close errors from the canonical cases envelope", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hud-states-cases-retry-"));
  let calls = 0;
  const report = await runCanonicalHudStates({
    evidenceRoot: root,
    runAttempt: async ({ stateId, attempt, attemptDir }) => {
      calls += 1;
      if (stateId === CANONICAL_HUD_STATES[0] && attempt === 1) {
        const lifecycleLog = await writeCleanCrashLifecycle(attemptDir);
        await writeSummary(attemptDir, {
          ...failedHudSummary(stateId, lifecycleLog),
          cases: [{ error: "Error: webkit-667x375/stage3-boss/settle: Error: page.waitForFunction: Target page, context or browser has been closed" }],
        });
        return { code: 1, output: "Final-remediation QA failed 1/1 cases\nTarget page, context or browser has been closed\n" };
      }
      await writeSummary(attemptDir, passedSummary(stateId));
      return { code: 0, output: "passed\n" };
    },
  });
  assert.equal(report.status, "passed");
  assert.equal(calls, CANONICAL_HUD_STATES.length + 1);
  assert.equal(report.states[0].attempts.length, 2);
});

test("HUD state aggregator never retries a product assertion", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hud-states-product-fail-"));
  let calls = 0;
  await assert.rejects(() => runCanonicalHudStates({
    evidenceRoot: root,
    runAttempt: async ({ attemptDir }) => {
      calls += 1;
      await writeSummary(attemptDir, {
        total: 1, passed: 0, failed: 1, results: [{ status: "failed", error: "objective is clipped" }],
      });
      return { code: 1, output: "Error: objective is clipped\n" };
    },
  }), /failed at stage1-normal/u);
  assert.equal(calls, 1);
});

test("single HUD state job is bounded and requires the selected real state", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hud-state-single-"));
  const stateId = "stage3-boss";
  const report = await runOneHudStateBounded({
    stateId,
    evidenceRoot: root,
    runAttempt: async ({ attemptDir }) => {
      await writeSummary(attemptDir, passedSummary(stateId));
      return { code: 0, output: "passed\n" };
    },
  });
  assert.equal(report.status, "passed");
  assert.equal(report.stateId, stateId);
  assert.equal(report.attempts.length, 1);
  await assert.rejects(() => runOneHudStateBounded({
    stateId: "not-canonical",
    evidenceRoot: root,
  }), /unsupported isolated HUD state/u);
});

test("isolated HUD runtime labels preserve exact slash ownership for target-close classification", async () => {
  const source = await readFile("scripts/v099-final-remediation-browser-smoke.mjs", "utf8");
  assert.match(source, /const name = `\$\{axisName\}\/\$\{stateId\}`/u);
  assert.match(source, /const lifecycleName = `\$\{axisName\}-\$\{stateId\}`/u);
  assert.doesNotMatch(source, /const name = `\$\{axisName\}-\$\{stateId\}`/u);
});

for (const mode of [
  "missing-lifecycle",
  "malformed-lifecycle",
  "outside-evidence-root",
  "dirty-diagnostics",
  "cleanup-owned",
  "assertion-only",
  "timeout-only",
  "page-close-only",
]) {
  test(`clean unexpected HUD crash proof rejects ${mode} without a second attempt`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), `hud-crash-${mode}-`));
    let calls = 0;
    await assert.rejects(() => runOneHudStateBounded({
      stateId: "stage3-boss",
      evidenceRoot: root,
      runAttempt: async ({ attemptDir }) => {
        calls += 1;
        let lifecycleLog = null;
        if (mode !== "missing-lifecycle") {
          lifecycleLog = mode === "outside-evidence-root"
            ? await writeCleanCrashLifecycle(root, "clean")
            : await writeCleanCrashLifecycle(attemptDir, mode === "page-close-only" ? "page-close-only" : mode);
          if (mode === "malformed-lifecycle") await writeFile(lifecycleLog, "not-json\n");
        }
        const summary = failedHudSummary("stage3-boss", lifecycleLog);
        if (mode === "dirty-diagnostics") summary.results[0].diagnostics.consoleErrors.push("unexpected console error");
        if (mode === "assertion-only") summary.results[0].error = "objective is clipped";
        if (mode === "timeout-only") summary.results[0].error = "page.waitForFunction: Timeout 45000ms exceeded";
        await writeSummary(attemptDir, summary);
        return {
          code: 1,
          output: mode === "assertion-only"
            ? "objective is clipped\n"
            : mode === "timeout-only"
            ? "page.waitForFunction: Timeout 45000ms exceeded\n"
            : "battle messages did not clear\n",
        };
      },
    }), /bounded HUD evidence failed/u);
    assert.equal(calls, 1);
  });
}
