import assert from "node:assert/strict";
import test from "node:test";

import {
  classifySupersededAssetRequestFailures,
  reconcilePageClockRequestFailures,
  strictCanvasScreenshotClip,
} from "../scripts/v0995-qa-evidence-contract.mjs";

test("reconciles Node request timestamps into the page asset-history clock", () => {
  const result = reconcilePageClockRequestFailures({
    failures: [failure({ startedAt: 2_100, failedAt: 2_120 })],
    calibrations: [
      { label: "post-navigation", nodeBefore: 1_000, nodeAfter: 1_010, pageNow: 905 },
      { label: "terminal-ready", nodeBefore: 3_000, nodeAfter: 3_010, pageNow: 2_905 },
    ],
  });
  assert.equal(result.failures[0].nodeStartedAt, 2_100);
  assert.equal(result.failures[0].nodeFailedAt, 2_120);
  assert.equal(result.failures[0].startedAt, 2_000);
  assert.equal(result.failures[0].failedAt, 2_020);
});

for (const [name, calibrations] of [
  ["missing second calibration", [{ nodeBefore: 0, nodeAfter: 1, pageNow: 0 }]],
  ["nonfinite calibration", [
    { nodeBefore: 0, nodeAfter: 1, pageNow: Number.NaN },
    { nodeBefore: 2, nodeAfter: 3, pageNow: 2 },
  ]],
  ["slow calibration", [
    { nodeBefore: 0, nodeAfter: 300, pageNow: 150 },
    { nodeBefore: 400, nodeAfter: 401, pageNow: 400 },
  ]],
  ["clock discontinuity", [
    { nodeBefore: 0, nodeAfter: 2, pageNow: 1 },
    { nodeBefore: 100, nodeAfter: 102, pageNow: 201 },
  ]],
]) {
  test(`rejects ${name}`, () => {
    assert.throws(() => reconcilePageClockRequestFailures({ failures: [failure()], calibrations }));
  });
}

const failure = (overrides = {}) => ({
  url: "http://127.0.0.1:4177/Zombieee/art/medic.png",
  errorText: "net::ERR_ABORTED",
  startedAt: 1_200,
  failedAt: 1_510,
  phase: "setup",
  ...overrides,
});

const input = (overrides = {}) => ({
  failures: [failure()],
  history: [
    {
      generation: 2,
      reason: "superseded-by-selection-change",
      status: "cancelled",
      startedAt: new Date(1_000).toISOString(),
      elapsedMs: 500,
      pendingPaths: ["/Zombieee/art/medic.png"],
    },
    {
      generation: 3,
      reason: "selection-change",
      status: "ready",
      startedAt: new Date(1_501).toISOString(),
      completed: 2,
      total: 2,
      failures: [],
      deadlineReached: false,
    },
  ],
  requiredSprites: [{ kind: "medic", path: "/Zombieee/art/medic.png" }],
  loadedSpriteKeys: ["medic"],
  terminalState: { generation: 3, state: "ready", failed: 0, pending: 0, completed: 2, total: 2 },
  ...overrides,
});

test("accepts only a pending request owned by a superseded setup generation and loaded by terminal ready", () => {
  const result = classifySupersededAssetRequestFailures(input());
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.accepted[0].cancelledGeneration, 2);
  assert.equal(result.accepted[0].terminalGeneration, 3);
});

test("accepts a bounded delayed Playwright request notification for the exact pending owner", () => {
  const result = classifySupersededAssetRequestFailures(input({
    failures: [failure({ startedAt: 1_510, failedAt: 1_520 })],
  }));
  assert.equal(result.accepted.length, 1);
  assert.equal(result.accepted[0].cancelledGeneration, 2);
});

test("rejects a delayed request notification outside the bounded cancellation grace", () => {
  const result = classifySupersededAssetRequestFailures(input({
    failures: [failure({ startedAt: 2_501, failedAt: 2_510 })],
  }));
  assert.equal(result.accepted.length, 0);
  assert.match(result.rejected[0].reasons.join(" "), /no temporally owning/);
});

for (const [name, mutate] of [
  ["post-ready", (value) => { value.failures[0].phase = "post-ready"; }],
  ["non-abort", (value) => { value.failures[0].errorText = "net::ERR_FAILED"; }],
  ["missing owner", (value) => { value.history = value.history.slice(1); }],
  ["absent owner pending path", (value) => { value.history[0].pendingPaths = ["/Zombieee/art/ranger.png"]; }],
  ["incomplete terminal", (value) => { value.terminalState.completed = 1; }],
  ["not required", (value) => { value.requiredSprites = []; }],
  ["not loaded", (value) => { value.loadedSpriteKeys = []; }],
]) {
  test(`rejects ${name} request failure`, () => {
    const value = structuredClone(input());
    mutate(value);
    const result = classifySupersededAssetRequestFailures(value);
    assert.equal(result.accepted.length, 0);
    assert.equal(result.rejected.length, 1);
    assert.ok(result.rejected[0].reasons.length > 0);
  });
}

test("returns strict one-attempt page screenshot clip inside the viewport", () => {
  assert.deepEqual(strictCanvasScreenshotClip(
    { x: 10, y: 20, width: 300, height: 200 },
    { width: 844, height: 390 },
  ), { x: 10, y: 20, width: 300, height: 200 });
});

for (const [name, box] of [
  ["null", null],
  ["nonfinite", { x: Number.NaN, y: 0, width: 1, height: 1 }],
  ["empty", { x: 0, y: 0, width: 0, height: 1 }],
  ["negative", { x: -1, y: 0, width: 1, height: 1 }],
  ["out-of-bounds", { x: 800, y: 0, width: 50, height: 1 }],
]) {
  test(`rejects ${name} canvas clip`, () => {
    assert.throws(() => strictCanvasScreenshotClip(box, { width: 844, height: 390 }));
  });
}
