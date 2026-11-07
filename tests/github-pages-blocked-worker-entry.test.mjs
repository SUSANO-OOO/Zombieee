import assert from "node:assert/strict";
import test from "node:test";
import { BLOCKED_WORKER_MARKER, assertExpectedBlockedWorkerEntry, acknowledgeBlockedWorkerEntry } from "../scripts/github-pages-blocked-worker-entry.mjs";

const fixture = { policy: "block", warnings: [BLOCKED_WORKER_MARKER], details: "" };
test("only a declared, browser-confirmed worker block allows the browser-play choice", () => {
  assert.doesNotThrow(() => assertExpectedBlockedWorkerEntry(fixture));
  assert.doesNotThrow(() => assertExpectedBlockedWorkerEntry({ ...fixture, details: BLOCKED_WORKER_MARKER }));
  for (const change of [{ policy: "allow" }, { warnings: [] }, { warnings: ["registration failed"] }, { details: "QuotaExceededError" }, { details: "NetworkError" }]) {
    assert.throws(() => assertExpectedBlockedWorkerEntry({ ...fixture, ...change }));
  }
});

function pageFixture(details) {
  let clicks = 0;
  const choice = { isVisible: async () => true, click: async () => { clicks++; } };
  const gate = { getByRole: () => choice, locator: () => ({ allTextContents: async () => details ? [details] : [] }) };
  return { page: { getByRole: () => gate }, clicks: () => clicks };
}
test("the deliberate fixture uses the real control and records the reason", async () => {
  const fixturePage = pageFixture("");
  const record = { serviceWorkerPolicy: "block", diagnostics: { warnings: [BLOCKED_WORKER_MARKER] } };
  assert.equal(await acknowledgeBlockedWorkerEntry(fixturePage.page, record, { phase: "initial-entry" }), true);
  assert.equal(fixturePage.clicks(), 1);
  assert.equal(record.blockedWorkerEntries[0].reason, BLOCKED_WORKER_MARKER);
});
test("a genuine registration failure is never clicked away", async () => {
  const fixturePage = pageFixture("NetworkError");
  const record = { serviceWorkerPolicy: "block", diagnostics: { warnings: [BLOCKED_WORKER_MARKER] } };
  await assert.rejects(acknowledgeBlockedWorkerEntry(fixturePage.page, record, { phase: "initial-entry" }), /Unexpected registration error/u);
  assert.equal(fixturePage.clicks(), 0);
  assert.equal(record.blockedWorkerEntries, undefined);
});
