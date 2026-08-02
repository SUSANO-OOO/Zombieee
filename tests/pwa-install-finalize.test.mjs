import assert from "node:assert/strict";
import test from "node:test";

import { finalizePwaDownload, recoverVerifiedPwaManifest } from "../app/pwaInstallFinalize.js";
import { evaluateUpdate } from "../app/pwaUpdatePlanner.js";

const manifest = (version, releaseSha) => ({
  version,
  releaseSha,
  assets: [{ path: "/a.webp", bytes: 1, hash: `sha256-${releaseSha.padEnd(64, "a")}`, pack: "app-shell", category: "app", criticality: "critical" }],
});

function harness({ commitResponses = [{ type: "pwa:committed" }], activeStates = null } = {}) {
  const calls = { refresh: 0, commit: 0, readActive: 0, persist: 0, incomplete: 0, commitFailed: 0, committed: 0 };
  const state = {
    installed: null,
    active: null,
    previous: null,
    updateDismissed: true,
    diagnostics: { stale: true },
    save: { currency: 100, stages: ["stage-1"] },
  };
  const responseQueue = [...commitResponses];
  const activeQueue = activeStates ? [...activeStates] : null;
  return {
    calls,
    state,
    options: {
      registration: { scope: "https://example.test/Zombieee/" },
      refreshStored: async () => { calls.refresh += 1; return new Set(state.cacheHashes ?? []); },
      commitManifest: async (_registration, candidate) => {
        calls.commit += 1;
        const response = responseQueue.shift() ?? null;
        if (response?.type === "pwa:committed") {
          state.previous = state.active;
          state.active = candidate;
        }
        return response;
      },
      readActiveState: async () => {
        calls.readActive += 1;
        return activeQueue?.length ? activeQueue.shift() : { active: state.active, previous: state.previous };
      },
      persistStorage: async () => { calls.persist += 1; },
      onIncomplete: async () => { calls.incomplete += 1; },
      onCommitFailed: async () => { calls.commitFailed += 1; },
      onCommitted: async (next, _response, activeState) => {
        calls.committed += 1;
        state.installed = next;
        state.previous = activeState?.previous ?? state.previous;
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
  assert.equal(calls.readActive, 1);
  assert.equal(calls.persist, 1);
  assert.equal(calls.committed, 1);
  assert.equal(state.installed, next);
  assert.equal(state.updateDismissed, false);
  assert.equal(state.diagnostics, null);
});

test("a retry-successful update is installed, keeps the old generation for rollback, and is not re-offered after restart", async () => {
  const old = manifest("0.9.8.1", "old");
  const next = manifest("0.9.8.2", "new");
  const { state, options } = harness();
  state.installed = old;
  state.active = old;

  const outcome = await finalizePwaDownload({ final: { state: "complete" }, manifest: next, ...options });
  assert.equal(outcome.state, "complete");
  assert.equal(state.installed, next);
  assert.equal(state.previous, old);
  assert.equal(evaluateUpdate({ installedManifest: state.installed, publishedManifest: next, storedHashes: new Set([next.assets[0].hash]) }).available, false);
});

test("a missing commit acknowledgement is commit-failed, not a download success", async () => {
  const { calls, state, options } = harness({ commitResponses: [null] });
  const outcome = await finalizePwaDownload({ final: { state: "complete" }, manifest: manifest("0.9.8.2", "new"), ...options });
  assert.equal(outcome.state, "commit-failed");
  assert.equal(calls.commit, 1);
  assert.equal(calls.readActive, 0);
  assert.equal(calls.commitFailed, 1);
  assert.equal(calls.persist, 0);
  assert.equal(state.installed, null);
});

test("an acknowledgement without a matching active generation is commit-failed", async () => {
  const next = manifest("0.9.8.2", "new");
  const old = manifest("0.9.8.1", "old");
  const { calls, state, options } = harness({ activeStates: [{ active: old, previous: null }] });
  const outcome = await finalizePwaDownload({ final: { state: "complete" }, manifest: next, ...options });
  assert.equal(outcome.state, "commit-failed");
  assert.equal(outcome.response.reason, "active-mismatch");
  assert.equal(calls.commit, 1);
  assert.equal(calls.readActive, 1);
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

test("a failed commit can retry the verified pack without mutating save data", async () => {
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

test("reload recovery commits a complete verified pack once without creating a download or changing save", async () => {
  const old = manifest("0.9.8.1", "old");
  const next = manifest("0.9.8.2", "new");
  const { calls, state, options } = harness();
  state.active = old;
  state.cacheHashes = new Set(next.assets.map((asset) => asset.hash));
  const saveBefore = structuredClone(state.save);

  const outcome = await recoverVerifiedPwaManifest({
    manifest: next,
    storedHashes: state.cacheHashes,
    ...options,
  });
  assert.equal(outcome.state, "complete");
  assert.equal(calls.refresh, 1);
  assert.equal(calls.commit, 1);
  assert.equal(calls.readActive, 1);
  assert.equal(calls.persist, 1);
  assert.equal(calls.committed, 1);
  assert.equal(state.previous, old);
  assert.deepEqual(state.save, saveBefore);
});

test("reload recovery refuses a partial pack and does not send a manifest commit", async () => {
  const next = manifest("0.9.8.2", "new");
  const { calls, options } = harness();
  const outcome = await recoverVerifiedPwaManifest({
    manifest: next,
    storedHashes: new Set(),
    ...options,
  });
  assert.equal(outcome.state, "failed");
  assert.equal(outcome.reason, "cache-incomplete");
  assert.equal(calls.commit, 0);
  assert.equal(calls.persist, 0);
  assert.equal(calls.incomplete, 1);
});
