import assert from "node:assert/strict";
import test from "node:test";

import {
  runAssetLoadSession,
  selectRetryAssetJobs,
} from "../app/assetLoadSession.js";

const job = (path, run, category = "unit") => ({ path, category, run });

test("asset sessions deduplicate paths and cap mobile load concurrency", async () => {
  let active = 0;
  let peak = 0;
  const release = [];
  const jobs = ["/a", "/b", "/a", "/c"].map((path) => job(path, async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => release.push(resolve));
    active -= 1;
  }));
  const running = runAssetLoadSession({ jobs, concurrency: 2, deadlineMs: 100 });
  while (release.length < 2) await Promise.resolve();
  assert.equal(peak, 2);
  release.splice(0).forEach((resolve) => resolve());
  while (release.length < 1) await Promise.resolve();
  release.splice(0).forEach((resolve) => resolve());
  const result = await running;
  assert.equal(result.status, "ready");
  assert.equal(result.total, 3);
  assert.equal(result.completed, 3);
});

test("an outer deadline forces every unresolved critical job to a timeout terminal", async () => {
  const controller = new AbortController();
  const result = await runAssetLoadSession({
    jobs: [
      job("/ready", async () => {}),
      job("/hang", () => new Promise(() => {}), "enemy"),
    ],
    generation: 4,
    reason: "selection-change",
    signal: controller.signal,
    abort: () => controller.abort(),
    deadlineMs: 10,
  });
  assert.equal(result.status, "error");
  assert.equal(result.deadlineReached, true);
  assert.equal(result.completed, 2);
  assert.deepEqual(result.failures, [
    { path: "/hang", category: "enemy", reason: "timeout" },
  ]);
  assert.equal(controller.signal.aborted, true);
});

test("retry selection contains only failed or pending paths", () => {
  const jobs = [
    job("/background", async () => {}, "background"),
    job("/unit", async () => {}, "unit"),
    job("/enemy", async () => {}, "enemy"),
  ];
  assert.deepEqual(
    selectRetryAssetJobs(jobs, new Set(["/unit", "/enemy"])).map(({ path }) => path),
    ["/unit", "/enemy"],
  );
});
