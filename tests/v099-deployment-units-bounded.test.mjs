import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { CANONICAL_DEPLOYMENT_KINDS, runCanonicalDeploymentUnits } from "../scripts/run-v099-deployment-units-bounded.mjs";

const passingSummary = (kind) => ({
  total: 1, passed: 1, failed: 0, caseTypes: ["deployment"], deploymentUnits: [{ kind }],
  results: [{ type: "deployment", status: "passed", diagnostics: { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] }, units: [{ kind, status: "passed", checkpoints: Array.from({ length: 6 }, (_, index) => ({ index })), contactSheet: `${kind}.png` }] }],
});

test("deployment aggregator runs every canonical kind once in fresh bounded attempts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "deployment-units-"));
  const calls = [];
  const report = await runCanonicalDeploymentUnits({ evidenceRoot: root, runAttempt: async ({ kind, attempt, attemptDir }) => {
    calls.push({ kind, attempt });
    await mkdir(attemptDir, { recursive: true });
    if (kind === "ranger" && attempt === 1) {
      await writeFile(path.join(attemptDir, "summary.json"), JSON.stringify({ total: 1, passed: 0, failed: 1, results: [{ error: "Error: page.screenshot: Target page, context or browser has been closed" }] }));
      return { code: 1, output: "page.screenshot: Target page, context or browser has been closed\n" };
    }
    await writeFile(path.join(attemptDir, "summary.json"), JSON.stringify(passingSummary(kind)));
    return { code: 0, output: "passed\n" };
  } });
  assert.equal(report.status, "passed");
  assert.deepEqual(report.units.map(({ kind }) => kind), CANONICAL_DEPLOYMENT_KINDS);
  assert.deepEqual(calls.filter(({ kind }) => kind === "ranger").map(({ attempt }) => attempt), [1, 2]);
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
