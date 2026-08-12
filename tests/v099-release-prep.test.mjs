import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { RELEASE_VERSION } from "../app/releaseIdentity.js";
import { RELEASE_SHA_PLACEHOLDER } from "../app/pwaAssetManifest.js";
import { evaluateUpdate, verifyUpdatePayload } from "../app/pwaUpdatePlanner.js";

const PUBLISHED_V0982_SHA = "662ec6103a769846343e60dacf19dd36adeafdde";
const PUBLISHED_V0993_SHA = "827e1b7942221d24901332bdaa543704fbc730cc";
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

test("the Version 0.9.9.5 release candidate has one immutable identity and complete manifest", () => {
  assert.equal(RELEASE_VERSION, "0.9.9.5");
  assert.equal(candidate.version, RELEASE_VERSION);
  assert.equal(candidate.releaseSha, RELEASE_SHA_PLACEHOLDER);
  assert.equal(candidate.assets.length, 416);
  assert.equal(candidate.assets.reduce((sum, asset) => sum + asset.bytes, 0), 90_917_375);

  const distinct = new Map(candidate.assets.map((asset) => [asset.hash, asset.bytes]));
  assert.equal([...distinct.values()].reduce((sum, bytes) => sum + bytes, 0), 90_377_472);
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
  assert.equal(update.downloadCount, 64);
  assert.equal(update.downloadBytes, 16_690_448);
  assert.equal(update.unchangedCount, 349);
  assert.equal(update.reusedCount, 3);
  assert.equal(update.removedCount, 25);

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
  assert.equal(update.downloadCount, 15);
  assert.equal(update.downloadBytes, 6_315_754);
  assert.equal(update.unchangedCount, 398);
  assert.equal(update.reusedCount, 3);
  assert.equal(update.removedCount, 18);

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
