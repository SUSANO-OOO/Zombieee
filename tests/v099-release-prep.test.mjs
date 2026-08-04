import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { RELEASE_VERSION } from "../app/releaseIdentity.js";
import { RELEASE_SHA_PLACEHOLDER } from "../app/pwaAssetManifest.js";
import { evaluateUpdate, verifyUpdatePayload } from "../app/pwaUpdatePlanner.js";

const PUBLISHED_V0982_SHA = "662ec6103a769846343e60dacf19dd36adeafdde";
const publishedSource = JSON.parse(execFileSync("git", [
  "show",
  `${PUBLISHED_V0982_SHA}:public/asset-manifest.json`,
], { encoding: "utf8" }));
const published = { ...publishedSource, releaseSha: PUBLISHED_V0982_SHA };
const candidate = JSON.parse(await readFile(new URL("../public/asset-manifest.json", import.meta.url), "utf8"));

test("the Version 0.9.9.0 release candidate has one immutable identity and complete manifest", () => {
  assert.equal(RELEASE_VERSION, "0.9.9.0");
  assert.equal(candidate.version, RELEASE_VERSION);
  assert.equal(candidate.releaseSha, RELEASE_SHA_PLACEHOLDER);
  assert.equal(candidate.assets.length, 416);
  assert.equal(candidate.assets.reduce((sum, asset) => sum + asset.bytes, 0), 89_712_221);

  const distinct = new Map(candidate.assets.map((asset) => [asset.hash, asset.bytes]));
  assert.equal([...distinct.values()].reduce((sum, bytes) => sum + bytes, 0), 89_172_318);
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
  assert.equal(update.toVersion, "0.9.9.0");
  assert.equal(update.downloadCount, 49);
  assert.equal(update.downloadBytes, 10_116_796);
  assert.equal(update.unchangedCount, 367);
  assert.equal(update.reusedCount, 0);
  assert.equal(update.removedCount, 7);

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
