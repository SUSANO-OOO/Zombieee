import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readFile } from "node:fs/promises";

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
        await writeSummary(attemptDir, {
          total: 1, passed: 0, failed: 1, results: [{ status: "failed", error: "page.screenshot: Target page, context or browser has been closed" }],
        });
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
