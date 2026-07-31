import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ASSET_LOAD_SESSION_DEADLINE_MS,
  OPTIONAL_ASSET_LOAD_DEADLINE_MS,
  runAssetLoadSession,
  selectRetryAssetJobs,
} from "../app/assetLoadSession.js";
import { IMAGE_LOAD_TIMEOUT_MS } from "../app/boundedImageLoader.js";

const job = (path, run, category = "unit") => ({ path, category, run });

test("only the asset session clears the readiness flag it owns", async () => {
  // selectStage used to clear assetsReady directly. The session effect keys on
  // activeOperationId and activeBattlefieldStageId, not on selectedStageId, so
  // choosing a stage that resolves to the same asset set started no session and
  // nothing set the flag back. The loadout then sat at assetReadiness "ready"
  // with every asset loaded, the deploy button disabled, and no retry control
  // rendered, because that state is neither an error nor retry-available.
  const source = await readFile(new URL("../app/AshfallGame.tsx", import.meta.url), "utf8");
  const start = source.indexOf("const selectStage = useCallback(");
  assert.ok(start > 0, "selectStage must exist");
  const body = source.slice(start, source.indexOf("const selectFormation = useCallback(", start));
  assert.doesNotMatch(
    body,
    /setAssetsReady\s*\(/,
    "selectStage must leave assetsReady to the asset session, or it can never be set back",
  );
});

test("the session budget outlasts the per-image timeout it supervises", () => {
  // These were 12s and 15s, so the session abandoned every job before a single
  // image was allowed to reach its own timeout. On the published origin the
  // eleven critical unit sheets are 14.1MB and took 28.5s at this concurrency,
  // which left the deploy button disabled on a healthy connection.
  assert.ok(
    ASSET_LOAD_SESSION_DEADLINE_MS > IMAGE_LOAD_TIMEOUT_MS,
    `session budget ${ASSET_LOAD_SESSION_DEADLINE_MS}ms must exceed the image timeout ${IMAGE_LOAD_TIMEOUT_MS}ms`,
  );
  // Enough headroom for the measured public transfer, so a slow-but-working
  // network is not reported as a failure.
  assert.ok(ASSET_LOAD_SESSION_DEADLINE_MS >= 60_000);
  // Optional assets never gate play, but they still must not wait forever.
  assert.ok(OPTIONAL_ASSET_LOAD_DEADLINE_MS < ASSET_LOAD_SESSION_DEADLINE_MS);
  assert.ok(OPTIONAL_ASSET_LOAD_DEADLINE_MS >= 20_000);
});

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

test("deduplicated shared paths notify every image consumer", async () => {
  let loadCount = 0;
  let cachedImage = null;
  const assigned = [];
  const sharedRun = (kind) => async () => {
    if (!cachedImage) {
      loadCount += 1;
      cachedImage = { src: "/shared-atlas.webp" };
    }
    assigned.push([kind, cachedImage]);
  };
  const result = await runAssetLoadSession({
    jobs: [
      { path: "/shared-atlas.webp", category: "enemy", run: sharedRun("walker") },
      { path: "/shared-atlas.webp", category: "enemy", run: sharedRun("runner") },
    ],
    generation: 1,
    reason: "shared-atlas",
  });
  assert.equal(result.status, "ready");
  assert.equal(result.total, 1);
  assert.equal(loadCount, 1);
  assert.deepEqual(assigned.map(([kind]) => kind), ["walker", "runner"]);
  assert.equal(assigned[0][1], assigned[1][1]);
});
