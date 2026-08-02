import assert from "node:assert/strict";
import test from "node:test";

import { finalizePwaDownload } from "../app/pwaInstallFinalize.js";
import { evaluateUpdate } from "../app/pwaUpdatePlanner.js";

const manifest = (version, releaseSha) => ({
  version,
  releaseSha,
  assets: [{ path: "/a.webp", bytes: 1, hash: `sha256-${releaseSha.padEnd(64, "a")}`, pack: "app-shell", category: "app", criticality: "critical" }],
});

function harness({ commitResponses = [{ type: "pwa:committed" }] } = {}) {
  const calls = { refresh: 0, commit: 0, persist: 0, incomplete: 0, commitFailed: 0, committed: 0 };
  const state = { installed: null, updateDismissed: true, diagnostics: { stale: true }, save: { currency: 100, stages: ["stage-1"] } };
  const responseQueue = [...commitResponses];
  return {
    calls,
    state,
    options: {
      registration: { scope: "https://example.test/Zombieee/" },
      refreshStored: async () => { calls.refresh += 1; },
      commitManifest: async () => { calls.commit += 1; return responseQueue.shift() ?? null; },
      persistStorage: async () => { calls.persist += 1; },
      onIncomplete: async () => { calls.incomplete += 1; },
      onCommitFailed: async () => { calls.commitFailed += 1; },
      onCommitted: async (next) => {
        calls.committed += 1;
        state.installed = next;
        state.updateDismissed = false;
        state.diagnostics = null;
      },
    },
  };
}

test("failed first install followed by retry commits exactly once and updates installed state", async () => {
  const next = manifest("0.9.8.2", "candidate");
  const { calls, state, options } = harness();

  const failed = await finalizePwaDownload({ final: { state: "failed" }, manifest: next, ...options });
  assert.equal(failed.committed, false);
  assert.equal(calls.commit, 0);

  const retried = await finalizePwaDownload({ final: { state: "complete" }, manifest: next, ...options });
  assert.equal(retried.committed, true);
  assert.equal(calls.commit, 1);
  assert.equal(calls.persist, 1);
  assert.equal(calls.committed, 1);
  assert.equal(state.installed, next);
  assert.equal(state.updateDismissed, false);
  assert.equal(state.diagnostics, null);
});

test("a retry-successful update is installed, so the same update is not re-offered after restart", async () => {
  const old = manifest("0.9.8.1", "old");
  const next = manifest("0.9.8.2", "new");
  const { state, options } = harness();
  state.installed = old;

  const outcome = await finalizePwaDownload({ final: { state: "complete" }, manifest: next, ...options });
  assert.equal(outcome.state, "complete");
  assert.equal(state.installed, next);
  assert.equal(evaluateUpdate({ installedManifest: state.installed, publishedManifest: next, storedHashes: new Set([next.assets[0].hash]) }).available, false);
});

test("a missing commit acknowledgement is commit-failed, not a download success", async () => {
  const { calls, state, options } = harness({ commitResponses: [null] });
  const outcome = await finalizePwaDownload({ final: { state: "complete" }, manifest: manifest("0.9.8.2", "new"), ...options });
  assert.equal(outcome.state, "commit-failed");
  assert.equal(calls.commit, 1);
  assert.equal(calls.commitFailed, 1);
  assert.equal(calls.persist, 0);
  assert.equal(state.installed, null);
});

test("an unavailable worker cannot turn verified Cache Storage bytes into an installed game", async () => {
  const { calls, state, options } = harness();
  const outcome = await finalizePwaDownload({
    final: { state: "complete" }, manifest: manifest("0.9.8.2", "new"), ...options, registration: null,
  });
  assert.equal(outcome.state, "commit-failed");
  assert.equal(calls.commit, 0);
  assert.equal(calls.persist, 0);
  assert.equal(state.installed, null);
});

test("a commit failure can retry the verified pack without mutating save data", async () => {
  const next = manifest("0.9.8.2", "new");
  const { calls, state, options } = harness({ commitResponses: [{ type: "pwa:commit-failed" }, { type: "pwa:committed" }] });
  const saveBefore = structuredClone(state.save);

  const first = await finalizePwaDownload({ final: { state: "complete" }, manifest: next, ...options });
  const retry = await finalizePwaDownload({ final: { state: "complete" }, manifest: next, ...options });
  assert.equal(first.state, "commit-failed");
  assert.equal(retry.state, "complete");
  assert.equal(calls.commit, 2);
  assert.equal(calls.persist, 1);
  assert.deepEqual(state.save, saveBefore);
});
