import assert from "node:assert/strict";
import test from "node:test";
import { isExpectedPartialBundleAbort } from "../scripts/pwa-expected-abort.mjs";
test("macOS cancellation must match the fixture URL, phase and independently observed server abort", () => {
  const url = "http://127.0.0.1:1234/Zombieee/pwa-bundles/audio-v1.bin";
  const failure = { error: "cancelled", url, phase: "candidate-unqualified-recovery-entry", at: 31_025 };
  const request = { mode: "recovery", aborted: true, startedAt: 1000, durationMs: 30_000 };
  assert.equal(isExpectedPartialBundleAbort(failure, [request], url), true);
  for (const change of [{ url: url.replace("audio-v1.bin", "art.webp") }, { error: "connection reset" },
    { phase: "candidate-relaunch" }, { at: undefined }, { at: 40_000 }]) {
    assert.equal(isExpectedPartialBundleAbort({ ...failure, ...change }, [request], url), false);
  }
  for (const change of [{ aborted: false }, { mode: "incident" }, { durationMs: null }]) {
    assert.equal(isExpectedPartialBundleAbort(failure, [{ ...request, ...change }], url), false);
  }
  assert.equal(isExpectedPartialBundleAbort(failure, [], url), false);
});
