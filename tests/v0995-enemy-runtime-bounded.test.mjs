import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  isRetryableTargetClosedLog,
  runBoundedEnemyRuntime,
} from "../scripts/run-v0995-enemy-runtime-bounded.mjs";

test("target-closed classifier accepts only exact infrastructure failure lines", () => {
  assert.equal(isRetryableTargetClosedLog("page.screenshot: Target page, context or browser has been closed\n"), true);
  assert.equal(isRetryableTargetClosedLog("Error: webkit-844x390/brawler: Error: page.evaluate: Target page, context or browser has been closed\n"), true);
  assert.equal(isRetryableTargetClosedLog("Error: webkit-667x375/stage3-boss/settle: Error: page.waitForFunction: Target page, context or browser has been closed\n"), true);
  assert.equal(isRetryableTargetClosedLog("Error: webkit-667x375-stage3-boss/settle: Error: page.waitForFunction: Target page, context or browser has been closed\n"), false);
  assert.equal(isRetryableTargetClosedLog("Error: webkit-1280x720/tatara/three-quarters: Error: page.evaluate: Target page, context or browser has been closed\n"), true);
  assert.equal(isRetryableTargetClosedLog("Error: webkit/1280x720/tatara/three-quarters/final-canvas: Error: page.evaluate: Target page, context or browser has been closed\n"), true);
  assert.equal(isRetryableTargetClosedLog("Error: Target crashed\n"), true);
  assert.equal(isRetryableTargetClosedLog("geometry assertion failed; Target page looked wrong\n"), false);
  assert.equal(isRetryableTargetClosedLog("request failure: net::ERR_ABORTED\n"), false);
  assert.equal(isRetryableTargetClosedLog("product assertion: webkit-1280x720/tatara/three-quarters: Error: page.evaluate: Target page, context or browser has been closed\n"), false);
  assert.equal(isRetryableTargetClosedLog("Error: webkit-1280x720/tatara/three-quarters: Error: page.evaluate: Target page, context or browser has been closed after geometry failed\n"), false);
});

test("bounded enemy runner records target-closed and does not retry the failed evidence", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "enemy-bounded-fail-"));
  const calls = [];
  await assert.rejects(() => runBoundedEnemyRuntime({
    evidenceRoot: root,
    runAttempt: async ({ attempt, attemptDir }) => {
      calls.push({ attempt, attemptDir });
      return { code: 1, output: "page.screenshot: Target page, context or browser has been closed\n" };
    },
  }), /failed after 1 attempt/u);
  const report = JSON.parse(await readFile(path.join(root, "bounded-summary.json"), "utf8"));
  assert.equal(report.status, "failed");
  assert.equal(report.attempts.length, 1);
  assert.deepEqual(calls.map(({ attempt }) => attempt), [1]);
  assert.equal(report.attempts[0].retryableTargetClosed, true);
  assert.match(await readFile(path.join(root, "attempt-1", "runner.log"), "utf8"), /Target page/u);
});

test("bounded enemy runner never retries a product assertion failure", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "enemy-bounded-fail-"));
  let calls = 0;
  await assert.rejects(() => runBoundedEnemyRuntime({
    evidenceRoot: root,
    runAttempt: async () => {
      calls += 1;
      return { code: 1, output: "Error: maskIoU assertion failed\n" };
    },
  }), /failed after 1 attempt/u);
  assert.equal(calls, 1);
  const report = JSON.parse(await readFile(path.join(root, "bounded-summary.json"), "utf8"));
  assert.equal(report.attempts.length, 1);
  assert.equal(report.attempts[0].retryableTargetClosed, false);
});
