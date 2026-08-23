import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { CANONICAL_DEPLOYMENT_KINDS, runCanonicalDeploymentUnits } from "../scripts/run-v099-deployment-units-bounded.mjs";

const boundedSource = await readFile(new URL("../scripts/run-v099-deployment-units-bounded.mjs", import.meta.url), "utf8");

const passingSummary = (kind) => ({
  total: 1, passed: 1, failed: 0, caseTypes: ["deployment"], deploymentUnits: [{ kind }],
  results: [{ type: "deployment", status: "passed", diagnostics: { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] }, units: [{ kind, status: "passed", checkpoints: Array.from({ length: 6 }, (_, index) => ({ index })), contactSheet: `${kind}.png` }] }],
});

test("deployment aggregator runs every canonical kind exactly once and treats target-close as terminal", async () => {
  assert.match(boundedSource, /const attempt = 1/u);
  assert.doesNotMatch(boundedSource, /isRetryableTargetClosedLog|Retrying|attempt <= 2/u);
  const root = await mkdtemp(path.join(os.tmpdir(), "deployment-units-"));
  const calls = [];
  const report = await runCanonicalDeploymentUnits({ evidenceRoot: root, runAttempt: async ({ kind, attempt, attemptDir }) => {
    calls.push({ kind, attempt });
    await mkdir(attemptDir, { recursive: true });
    await writeFile(path.join(attemptDir, "summary.json"), JSON.stringify(passingSummary(kind)));
    return { code: 0, output: "passed\n" };
  } });
  assert.equal(report.status, "passed");
  assert.deepEqual(report.units.map(({ kind }) => kind), CANONICAL_DEPLOYMENT_KINDS);
  assert.equal(calls.length, CANONICAL_DEPLOYMENT_KINDS.length);
  assert.deepEqual(calls.map(({ attempt }) => attempt), CANONICAL_DEPLOYMENT_KINDS.map(() => 1));
  assert.ok(report.units.every(({ attempts }) => attempts.length === 1 && attempts[0].attempt === 1));

  const crashRoot = await mkdtemp(path.join(os.tmpdir(), "deployment-target-close-"));
  let crashCalls = 0;
  await assert.rejects(() => runCanonicalDeploymentUnits({ evidenceRoot: crashRoot, runAttempt: async ({ attemptDir }) => {
    crashCalls += 1;
    await mkdir(attemptDir, { recursive: true });
    await writeFile(path.join(attemptDir, "summary.json"), JSON.stringify({ total: 1, passed: 0, failed: 1, results: [{ error: "Error: page.screenshot: Target page, context or browser has been closed" }] }));
    return { code: 1, output: "page.screenshot: Target page, context or browser has been closed\n" };
  } }), /failed at scout/u);
  assert.equal(crashCalls, 1);
});

test("deployment aggregator stops without retry on product assertion", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "deployment-product-fail-"));
  let calls = 0;
  await assert.rejects(() => runCanonicalDeploymentUnits({ evidenceRoot: root, runAttempt: async ({ kind, attemptDir }) => {
    calls += 1;
    await mkdir(attemptDir, { recursive: true });
    await writeFile(path.join(attemptDir, "summary.json"), JSON.stringify({ total: 1, passed: 0, failed: 1, results: [{ error: "maskIoU assertion failed" }] }));
    return { code: 1, output: `${kind}: maskIoU assertion failed\n` };
  } }), /failed at scout/u);
  assert.equal(calls, 1);
});

test("deployment aggregator rejects duplicate or incomplete inventory before running", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "deployment-inventory-"));
  await assert.rejects(() => runCanonicalDeploymentUnits({ evidenceRoot: root, kinds: ["scout", "scout"] }), /exactly once/u);
});
