import assert from "node:assert/strict";
import test from "node:test";
import { captureQuietDiagnosticsBoundary } from "../scripts/p5-quiet-diagnostics-boundary.mjs";

function fixture(onCapture = () => {}, timeoutMs = 1_000) {
  let time = 0; let captures = 0;
  const raw = { networkActivityRevision: 0, pendingRequestCount: 0, pendingRequestUrls: [], httpErrors: [] };
  const diagnostics = {
    snapshot: () => ({ ...raw, httpErrors: [...raw.httpErrors] }),
    settleDetails: async () => {},
    captureState: async () => { captures += 1; await onCapture(raw, captures); return { capturedAt: time }; },
  };
  return { raw, get captures() { return captures; }, get time() { return time; },
    run: () => captureQuietDiagnosticsBoundary({ diagnostics, label: "control", timeoutMs,
      now: () => time, wait: async (ms) => { time += ms; }, waitForNetworkIdle: async () => {}, }),
  };
}

test("setup capture waits again when a fetch starts and completes during the browser read", async () => {
  const control = fixture((raw, count) => { if (count === 1) raw.networkActivityRevision += 2; });
  const result = await control.run();
  assert.equal(control.captures, 2);
  assert.ok(result.quietBoundary.elapsedMs >= 550);
  assert.equal(result.raw.pendingRequestCount, 0);
  assert.equal(result.raw.networkActivityRevision, 2);
  assert.equal(result.quietBoundary.samples.length, 2);
});

test("a fetch that remains pending fails within the original setup deadline", async () => {
  const control = fixture((raw) => { raw.networkActivityRevision += 1; raw.pendingRequestCount = 1; raw.pendingRequestUrls = ["fetch /late.mp3"]; });
  await assert.rejects(control.run(), (error) => {
    assert.match(error.message, /deadline reached/);
    assert.equal(error.evidence.last.pendingRequestCount, 1);
    assert.equal(error.evidence.elapsedMs, 1_000); return true;
  });
  assert.equal(control.captures, 1);
});

test("late HTTP errors are kept and rejected even after pending returns to zero", async () => {
  const control = fixture((raw) => { raw.networkActivityRevision += 2; raw.httpErrors.push("503 /late.mp3"); });
  await assert.rejects(control.run(), /setup httpErrors.*503/);
  assert.equal(control.captures, 1);
});

test("a stuck browser state read cannot extend the setup deadline", async () => {
  const control = fixture(() => new Promise(() => {}), 300);
  const start = Date.now();
  await assert.rejects(control.run(), /deadline reached/);
  assert.ok(Date.now() - start < 1_000);
});
