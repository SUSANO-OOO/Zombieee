import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { RELEASE_VERSION } from "../app/releaseIdentity.js";
import { RELEASE_SHA_PLACEHOLDER } from "../app/pwaAssetManifest.js";
import { evaluateUpdate, verifyUpdatePayload } from "../app/pwaUpdatePlanner.js";
import { V100_RELEASE_ASSET_CONTRACT as assetContract, V100_COMPLETION_ASSET_ADDITIONS } from "../scripts/v100-release-asset-contract.mjs";
import { V100_MOTION_ATLAS_REPLACEMENTS as motionReplacements } from "../scripts/v100-phone-review-asset-contract.mjs";

const PUBLISHED_V0982_SHA = "662ec6103a769846343e60dacf19dd36adeafdde";
const PUBLISHED_V0993_SHA = "827e1b7942221d24901332bdaa543704fbc730cc";
const PUBLISHED_V0995_SHA = "55d796cc577d1d9f903a4d2c6b4382196511db27";
const APPROVED_V100_ATLAS_TRANSPORT_BYTE_REDUCTION = 640_306;
const APPROVED_SIZE_SNAPSHOTS = Object.freeze({
  candidateTotalBytes: assetContract.candidateTotalBytes,
  candidateDistinctHashBytes: assetContract.candidateDistinctHashBytes,
  updateFromV0982Bytes: assetContract.updateFromV0982Bytes,
  updateFromV0993Bytes: assetContract.updateFromV0993Bytes,
});
const publishedSource = JSON.parse(execFileSync("git", [
  "show",
  `${PUBLISHED_V0982_SHA}:public/asset-manifest.json`,
], { encoding: "utf8" }));
const published = { ...publishedSource, releaseSha: PUBLISHED_V0982_SHA };
const publishedV0993Source = JSON.parse(execFileSync("git", [
  "show",
  `${PUBLISHED_V0993_SHA}:public/asset-manifest.json`,
], { encoding: "utf8" }));
const publishedV0993 = { ...publishedV0993Source, releaseSha: PUBLISHED_V0993_SHA };
const publishedV0995 = { ...JSON.parse(execFileSync("git", ["show", `${PUBLISHED_V0995_SHA}:public/asset-manifest.json`], { encoding: "utf8" })), releaseSha: PUBLISHED_V0995_SHA };
const candidate = JSON.parse(await readFile(new URL("../public/asset-manifest.json", import.meta.url), "utf8"));
const v100ApprovedAssets = candidate.assets.filter(({ path }) => path.startsWith("/art/v100/"));

test("the six motion atlas replacements preserve source-bound old/new transport accounting", () => {
  assert.equal(motionReplacements.length, 6);
  const oldBytes = motionReplacements.reduce((sum, asset) => sum + asset.oldBytes, 0);
  const newBytes = motionReplacements.reduce((sum, asset) => sum + asset.newBytes, 0);
  assert.equal(oldBytes, 8_825_958);
  assert.equal(newBytes, 8_185_652);
  assert.equal(newBytes - oldBytes, -640_306);
  for (const replacement of motionReplacements) {
    const oldBytesOnDisk = readFileSync(new URL(`../public${replacement.oldSourcePath}`, import.meta.url));
    const oldHashOnDisk = `sha256-${createHash("sha256").update(oldBytesOnDisk).digest("hex")}`;
    const next = candidate.assets.find((asset) => asset.path === replacement.newPath);
    assert.deepEqual({ bytes: oldBytesOnDisk.length, hash: oldHashOnDisk }, { bytes: replacement.oldBytes, hash: replacement.oldHash });
    assert.deepEqual({ bytes: next?.bytes, hash: next?.hash }, { bytes: replacement.newBytes, hash: replacement.newHash });
    assert.equal(candidate.assets.some((asset) => asset.path === replacement.oldPath), false);
  }
});

test("the published0.9.9.5 pack reuses415 assets and requires the complete source-bound V1 additions", () => {
  assert.equal(publishedV0995.version, "0.9.9.5"); assert.equal(publishedV0995.assets.length, 415);
  const retainedHashes = new Set(publishedV0995.assets.map(asset => asset.hash));
  const update = evaluateUpdate({ installedManifest: publishedV0995, publishedManifest: candidate, storedHashes: retainedHashes });
  assert.equal(update.available, true); assert.equal(update.fromVersion, "0.9.9.5"); assert.equal(update.toVersion, "1.0.0");
  assert.equal(update.downloadCount, assetContract.additionsFromV0995); assert.equal(update.downloadBytes, assetContract.bytesFromV0995);
  assert.equal(update.unchangedCount, 415); assert.equal(update.reusedCount, 0); assert.equal(update.removedCount, 0);
  assert.ok(update.diff.downloadable.every(asset => asset.path.startsWith("/art/v100/") || V100_COMPLETION_ASSET_ADDITIONS.some(expected=>expected.path===asset.path)));
  const incomplete = verifyUpdatePayload({ manifest: candidate, storedHashes: retainedHashes, expectedVersion: RELEASE_VERSION, expectedReleaseSha: RELEASE_SHA_PLACEHOLDER });
  assert.equal(incomplete.verified, false); assert.equal(incomplete.missingPaths.length, assetContract.additionsFromV0995);
  const completed = verifyUpdatePayload({ manifest: candidate, storedHashes: new Set([...retainedHashes, ...update.diff.downloadable.map(asset => asset.hash)]), expectedVersion: RELEASE_VERSION, expectedReleaseSha: RELEASE_SHA_PLACEHOLDER });
  assert.deepEqual(completed, { verified: true, errors: [], missingPaths: [] });
});

test("the Version 1.0.0 release candidate has one immutable identity and complete manifest", () => {
  assert.equal(APPROVED_V100_ATLAS_TRANSPORT_BYTE_REDUCTION, 640_306);
  assert.deepEqual(APPROVED_SIZE_SNAPSHOTS, {
    candidateTotalBytes: 139_365_619,
    candidateDistinctHashBytes: 138_825_716,
    updateFromV0982Bytes: 66_314_502,
    updateFromV0993Bytes: 55_939_808,
  });
  assert.equal(RELEASE_VERSION, "1.0.0");
  assert.equal(candidate.version, RELEASE_VERSION);
  assert.equal(candidate.releaseSha, RELEASE_SHA_PLACEHOLDER);
  assert.equal(v100ApprovedAssets.length, assetContract.artAdditionsFromV0995);
  assert.equal(candidate.assets.length, assetContract.count);
  for (const expected of V100_COMPLETION_ASSET_ADDITIONS) {
    const actual = candidate.assets.find(asset => asset.path === expected.path);
    assert.ok(actual, expected.path);
    assert.equal(actual.hash, expected.hash);
    assert.equal(actual.bytes, expected.bytes);
    assert.equal(actual.criticality, expected.criticality ?? "critical");
  }
  assert.equal(candidate.assets.reduce((sum, asset) => sum + asset.bytes, 0), APPROVED_SIZE_SNAPSHOTS.candidateTotalBytes);

  const distinct = new Map(candidate.assets.map((asset) => [asset.hash, asset.bytes]));
  assert.equal([...distinct.values()].reduce((sum, bytes) => sum + bytes, 0), APPROVED_SIZE_SNAPSHOTS.candidateDistinctHashBytes);
});

test("the real Version 0.9.8.2 pack updates by hash without re-downloading unchanged assets", () => {
  assert.equal(published.version, "0.9.8.2");
  assert.equal(publishedSource.releaseSha, RELEASE_SHA_PLACEHOLDER);
  assert.equal(published.releaseSha, PUBLISHED_V0982_SHA);
  assert.equal(published.assets.length, 374);

  const retainedHashes = new Set(published.assets.map((asset) => asset.hash));
  const update = evaluateUpdate({
    installedManifest: published,
    publishedManifest: candidate,
    storedHashes: retainedHashes,
  });

  assert.equal(update.available, true);
  assert.equal(update.fromVersion, "0.9.8.2");
  assert.equal(update.toVersion, "1.0.0");
  assert.equal(update.downloadCount, 108 + V100_COMPLETION_ASSET_ADDITIONS.length);
  assert.equal(update.downloadBytes, APPROVED_SIZE_SNAPSHOTS.updateFromV0982Bytes);
  assert.equal(update.unchangedCount, 348);
  assert.equal(update.reusedCount, 3);
  assert.equal(update.removedCount, 26);

  const completedHashes = new Set([
    ...retainedHashes,
    ...update.diff.downloadable.map((asset) => asset.hash),
  ]);
  const verified = verifyUpdatePayload({
    manifest: candidate,
    storedHashes: completedHashes,
    expectedVersion: RELEASE_VERSION,
    expectedReleaseSha: RELEASE_SHA_PLACEHOLDER,
  });
  assert.deepEqual(verified, { verified: true, errors: [], missingPaths: [] });
});

test("the published Version 0.9.9.3 pack updates to 1.0.0 while reusing unchanged runtime assets", () => {
  assert.equal(publishedV0993.version, "0.9.9.3");
  assert.equal(publishedV0993Source.releaseSha, RELEASE_SHA_PLACEHOLDER);
  assert.equal(publishedV0993.releaseSha, PUBLISHED_V0993_SHA);
  assert.equal(publishedV0993.assets.length, 416);

  const retainedHashes = new Set(publishedV0993.assets.map((asset) => asset.hash));
  const update = evaluateUpdate({
    installedManifest: publishedV0993,
    publishedManifest: candidate,
    storedHashes: retainedHashes,
  });

  assert.equal(update.available, true);
  assert.equal(update.fromVersion, "0.9.9.3");
  assert.equal(update.toVersion, "1.0.0");
  assert.equal(update.downloadCount, 59 + V100_COMPLETION_ASSET_ADDITIONS.length);
  assert.equal(update.downloadBytes, APPROVED_SIZE_SNAPSHOTS.updateFromV0993Bytes);
  assert.equal(update.unchangedCount, 397);
  assert.equal(update.reusedCount, 3);
  assert.equal(update.removedCount, 19);

  const completedHashes = new Set([
    ...retainedHashes,
    ...update.diff.downloadable.map((asset) => asset.hash),
  ]);
  const verified = verifyUpdatePayload({
    manifest: candidate,
    storedHashes: completedHashes,
    expectedVersion: RELEASE_VERSION,
    expectedReleaseSha: RELEASE_SHA_PLACEHOLDER,
  });
  assert.deepEqual(verified, { verified: true, errors: [], missingPaths: [] });
});
