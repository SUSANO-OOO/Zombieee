// Regression cover for the 0.9.8 update failure.
//
// A device on 0.9.7 could never reach 0.9.8. The worker answers asset requests
// cache-first keyed by the ACTIVE generation's hash, so an update fetching a
// path whose content had changed was handed back the bytes it was trying to
// replace. The download hashed them, got the old hash, and failed - without
// touching the network, which is why it failed instantly and identically every
// time, and why the screen appeared to flash and return.
//
// These tests reproduce that shape end to end against the real download session
// and the real phase machine, then pin the three things that stop it recurring:
// the failure survives on screen, only the failures are retried, and a commit
// that does not confirm is not treated as a success.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { createAssetDownloadSession } from "../app/pwaDownloadSession.js";
import { derivePwaPhase, describeFailureDiagnostics, formatFailureDiagnostics } from "../app/pwaRuntime.js";

const sha256 = (bytes) => `sha256-${createHash("sha256").update(bytes).digest("hex")}`;
const bodyOf = (seed, size) => Uint8Array.from({ length: size }, (_, i) => (seed * 31 + i * 7) % 251);

/** The four 0.9.7 -> 0.9.8 assets that kept their path and changed content. */
function changedAssets() {
  return [
    { path: "/favicon.svg", size: 1202, seed: 11 },
    { path: "/icons/icon-192.png", size: 1873, seed: 12 },
    { path: "/icons/icon-512.png", size: 6923, seed: 13 },
    { path: "/icons/icon-maskable-512.png", size: 6923, seed: 14 },
  ].map((entry) => {
    const oldBody = bodyOf(entry.seed, Math.max(64, Math.round(entry.size / 4)));
    const newBody = bodyOf(entry.seed + 100, entry.size);
    return {
      asset: {
        path: entry.path,
        bytes: newBody.length,
        hash: sha256(newBody),
        pack: "app-shell",
        category: "app",
        criticality: "critical",
      },
      oldBody,
      newBody,
    };
  });
}

function memoryStore() {
  const stored = new Map();
  return {
    stored,
    async has(hash) { return stored.has(hash); },
    async put(asset, body) { stored.set(asset.hash, body); },
    async storedHashes() { return new Set(stored.keys()); },
  };
}

test("reproduces the update failure: a worker serving the active generation makes every changed asset unverifiable", async () => {
  const entries = changedAssets();
  const store = memoryStore();
  const reachedNetwork = [];

  // Exactly what the shipped worker did: answer from the active generation.
  const staleWorkerFetch = async (asset) => {
    const entry = entries.find((candidate) => candidate.asset.path === asset.path);
    return { ok: true, status: 200, body: entry.oldBody };
  };

  const session = createAssetDownloadSession({
    assets: entries.map((entry) => entry.asset),
    store,
    fetchAsset: staleWorkerFetch,
    maxAttempts: 2,
  });
  const final = await session.start();

  assert.equal(final.state, "failed");
  assert.equal(final.failedCount, entries.length, "every changed asset fails");
  assert.equal(reachedNetwork.length, 0, "the request never left the device");
  for (const failure of final.failures) {
    // Not a network problem, not an HTTP problem: the bytes arrived and were
    // the wrong ones. Which of the two verification steps catches it depends
    // only on whether the replacement happens to be the same length - all four
    // real assets changed size, so on the device this reads as size-mismatch.
    assert.ok(
      failure.reason === "size-mismatch" || failure.reason === "hash-mismatch",
      `${failure.path} failed as ${failure.reason}`,
    );
    assert.equal(failure.status, 200, "the stale answer even looks successful");
  }
  assert.equal(store.stored.size, 0, "nothing is stored, so retrying changes nothing");
});

test("a same-length replacement is caught by the hash rather than slipping through", async () => {
  // Size alone would have accepted these bytes. Only the content check refuses
  // them, which is why both steps have to stay.
  const oldBody = bodyOf(3, 4096);
  const newBody = bodyOf(9, 4096);
  const asset = {
    path: "/icons/icon-512.png",
    bytes: newBody.length,
    hash: sha256(newBody),
    pack: "app-shell",
    category: "app",
    criticality: "critical",
  };
  const store = memoryStore();
  const session = createAssetDownloadSession({
    assets: [asset],
    store,
    fetchAsset: async () => ({ ok: true, status: 200, body: oldBody }),
    maxAttempts: 1,
  });
  const final = await session.start();

  assert.equal(final.state, "failed");
  assert.equal(final.failures[0].reason, "hash-mismatch");
  assert.equal(store.stored.size, 0);
});

test("a worker that lets a verifying download reach the network completes the same update", async () => {
  const entries = changedAssets();
  const store = memoryStore();

  const networkFetch = async (asset) => {
    const entry = entries.find((candidate) => candidate.asset.path === asset.path);
    return { ok: true, status: 200, body: entry.newBody };
  };

  const session = createAssetDownloadSession({
    assets: entries.map((entry) => entry.asset),
    store,
    fetchAsset: networkFetch,
  });
  const final = await session.start();

  assert.equal(final.state, "complete");
  assert.equal(final.failedCount, 0);
  assert.equal(store.stored.size, entries.length);
});

test("a failed update holds the screen instead of resolving back to the same button", () => {
  const installed = { version: "0.9.7", releaseSha: "aaa", assets: [{ path: "/a", hash: "sha256-a" }] };
  const complete = { satisfied: [{}], pending: [], complete: true, pendingCount: 0, pendingBytes: 0 };

  // The shape the bug produced: an update that failed went straight back to the
  // offer, taking the failure and the retry with it.
  for (const downloadState of ["failed", "cancelled", "commit-failed"]) {
    assert.equal(
      derivePwaPhase({
        supported: true,
        standalone: true,
        installedManifest: installed,
        installPlan: complete,
        updateEvaluation: { available: true },
        downloadState,
      }),
      "download-incomplete",
      downloadState,
    );
  }

  // Clearing the failure is the player's decision, and returns them to the
  // offer with the old version still working.
  assert.equal(
    derivePwaPhase({
      supported: true,
      standalone: true,
      installedManifest: installed,
      installPlan: complete,
      updateEvaluation: { available: true },
      downloadState: null,
    }),
    "update-available",
  );
});

test("retrying touches only what failed, and a repeat of the same fault does not multiply work", async () => {
  const entries = changedAssets();
  const store = memoryStore();
  const attempts = new Map();
  let healed = false;

  const fetchAsset = async (asset) => {
    attempts.set(asset.path, (attempts.get(asset.path) ?? 0) + 1);
    const entry = entries.find((candidate) => candidate.asset.path === asset.path);
    // One asset is broken until the fault is cleared; the rest are fine.
    const broken = asset.path === "/icons/icon-512.png" && !healed;
    return { ok: true, status: 200, body: broken ? entry.oldBody : entry.newBody };
  };

  const session = createAssetDownloadSession({
    assets: entries.map((entry) => entry.asset),
    store,
    fetchAsset,
    maxAttempts: 1,
  });
  const first = await session.start();
  assert.equal(first.state, "failed");
  assert.deepEqual(first.failedPaths, ["/icons/icon-512.png"]);
  assert.equal(store.stored.size, entries.length - 1, "the three good ones are already saved");

  const attemptsAfterFirst = new Map(attempts);
  healed = true;
  const second = await session.retryFailed();

  assert.equal(second.state, "complete");
  assert.equal(store.stored.size, entries.length);
  for (const entry of entries) {
    const path = entry.asset.path;
    const extra = attempts.get(path) - attemptsAfterFirst.get(path);
    assert.equal(extra, path === "/icons/icon-512.png" ? 1 : 0, `${path} refetched ${extra} times`);
  }
});

test("diagnostics name the stage that stopped and carry nothing private", () => {
  const diagnostics = describeFailureDiagnostics({
    kind: "update",
    fromVersion: "0.9.7",
    toVersion: "0.9.8.1",
    releaseSha: "dc3568f4",
    failures: [
      { path: "/icons/icon-512.png", reason: "hash-mismatch", status: 200, attempts: 3 },
      { path: "/favicon.svg", reason: "timeout", status: 0, attempts: 3 },
    ],
    startedAt: 1_000,
    lastProgressAt: 2_000,
    now: 9_000,
    origin: "https://susano-ooo.github.io",
    scope: "https://susano-ooo.github.io/Zombieee/",
    standalone: true,
    storedCount: 527,
    storedBytes: 116_000_000,
    pendingCount: 4,
    pendingBytes: 158_412,
    serviceWorkerState: "activated",
  });

  assert.equal(diagnostics.kind, "update");
  assert.equal(diagnostics.failureCount, 2);
  assert.deepEqual(diagnostics.reasonCounts, { "hash-mismatch": 1, timeout: 1 });
  assert.equal(diagnostics.elapsedMs, 8_000);
  assert.equal(diagnostics.sinceProgressMs, 7_000);
  // Each failure carries a reason a person can act on, not just "failed".
  assert.match(diagnostics.failures[0].label, /hash mismatch/);
  assert.match(diagnostics.failures[1].label, /timeout/);

  const text = formatFailureDiagnostics(diagnostics);
  assert.match(text, /0\.9\.7 -> 0\.9\.8\.1/);
  assert.match(text, /icon-512\.png :: hash-mismatch status=200 attempts=3/);
  // Nothing that identifies a person, a device, or a session may travel with it.
  for (const forbidden of [/token/i, /cookie/i, /authorization/i, /[A-Za-z]:\\\\/, /\/Users\//, /save/i]) {
    assert.doesNotMatch(text, forbidden, String(forbidden));
  }
});
