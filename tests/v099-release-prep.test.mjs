import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { RELEASE_VERSION } from "../app/releaseIdentity.js";
import { RELEASE_SHA_PLACEHOLDER } from "../app/pwaAssetManifest.js";
import { evaluateUpdate, verifyUpdatePayload } from "../app/pwaUpdatePlanner.js";

const PUBLISHED_V0982_SHA = "662ec6103a769846343e60dacf19dd36adeafdde";
const PUBLISHED_V0993_SHA = "827e1b7942221d24901332bdaa543704fbc730cc";
const APPROVED_V100_ATLAS_TRANSPORT_BYTE_REDUCTION = 6_309_676;
const PRE_REPACK_SIZE_SNAPSHOTS = Object.freeze({
  candidateTotalBytes: 110_872_347,
  candidateDistinctHashBytes: 110_332_444,
  updateFromV0982Bytes: 37_821_230,
  updateFromV0993Bytes: 27_446_536,
});
const APPROVED_SIZE_SNAPSHOTS = Object.freeze({
  candidateTotalBytes: PRE_REPACK_SIZE_SNAPSHOTS.candidateTotalBytes - APPROVED_V100_ATLAS_TRANSPORT_BYTE_REDUCTION, // 104_562_671
  candidateDistinctHashBytes: PRE_REPACK_SIZE_SNAPSHOTS.candidateDistinctHashBytes - APPROVED_V100_ATLAS_TRANSPORT_BYTE_REDUCTION, // 104_022_768
  updateFromV0982Bytes: PRE_REPACK_SIZE_SNAPSHOTS.updateFromV0982Bytes - APPROVED_V100_ATLAS_TRANSPORT_BYTE_REDUCTION, // 31_511_554
  updateFromV0993Bytes: PRE_REPACK_SIZE_SNAPSHOTS.updateFromV0993Bytes - APPROVED_V100_ATLAS_TRANSPORT_BYTE_REDUCTION, // 21_136_860
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
const candidate = JSON.parse(await readFile(new URL("../public/asset-manifest.json", import.meta.url), "utf8"));
const v100ApprovedAssets = candidate.assets.filter(({ path }) => path.startsWith("/art/v100/"));

test("the Version 0.9.9.5 release candidate has one immutable identity and complete manifest", () => {
  assert.equal(APPROVED_V100_ATLAS_TRANSPORT_BYTE_REDUCTION, 6_309_676);
  assert.deepEqual(APPROVED_SIZE_SNAPSHOTS, {
    candidateTotalBytes: 104_562_671,
    candidateDistinctHashBytes: 104_022_768,
    updateFromV0982Bytes: 31_511_554,
    updateFromV0993Bytes: 21_136_860,
  });
  assert.equal(RELEASE_VERSION, "0.9.9.5");
  assert.equal(candidate.version, RELEASE_VERSION);
  assert.equal(candidate.releaseSha, RELEASE_SHA_PLACEHOLDER);
  assert.equal(v100ApprovedAssets.length, 44);
  assert.equal(candidate.assets.length, 459);
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
  assert.equal(update.toVersion, "0.9.9.5");
  assert.equal(update.downloadCount, 108);
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

test("the published Version 0.9.9.3 pack updates to 0.9.9.5 while reusing unchanged runtime assets", () => {
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
  assert.equal(update.toVersion, "0.9.9.5");
  assert.equal(update.downloadCount, 59);
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
