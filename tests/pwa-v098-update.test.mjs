import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { evaluateUpdate, verifyUpdatePayload } from "../app/pwaUpdatePlanner.js";

const BASELINE_SHA = "79e139f5b78be4fe4ac389941fbd280b93d29a58";
const baseline = JSON.parse(execFileSync("git", ["show", `${BASELINE_SHA}:public/asset-manifest.json`], { encoding: "utf8" }));
const candidate = JSON.parse(await readFile(new URL("../public/asset-manifest.json", import.meta.url), "utf8"));

test("the real 0.9.8.1 to 0.9.8.2 update preserves reusable hashes and verifies the committed candidate", () => {
  assert.equal(baseline.version, "0.9.8.1");
  assert.equal(candidate.version, "0.9.8.2");
  const retainedHashes = new Set(baseline.assets.map((asset) => asset.hash));
  const update = evaluateUpdate({
    installedManifest: baseline,
    publishedManifest: candidate,
    storedHashes: retainedHashes,
  });

  assert.equal(update.available, true);
  assert.equal(update.fromVersion, "0.9.8.1");
  assert.equal(update.toVersion, "0.9.8.2");
  assert.ok(update.diff.downloadCount > 0, "the candidate must download its new transport bytes");
  assert.ok(update.unchangedCount > 0, "unchanged assets must remain reusable");
  assert.ok(update.removedCount > 0, "the optimized candidate intentionally removes obsolete transport paths");

  const completedHashes = new Set([
    ...retainedHashes,
    ...update.diff.downloadable.map((asset) => asset.hash),
  ]);
  const verified = verifyUpdatePayload({
    manifest: candidate,
    storedHashes: completedHashes,
    expectedVersion: "0.9.8.2",
    expectedReleaseSha: candidate.releaseSha,
  });
  assert.equal(verified.verified, true, verified.errors.join("; "));
});
