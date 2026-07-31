import assert from "node:assert/strict";
import test from "node:test";

import { ASSET_MANIFEST_SCHEMA, formatBytes } from "../app/pwaAssetManifest.js";
import {
  SAFE_ACTIVATION_SCREENS,
  describeUpdate,
  evaluateActivationSafety,
  evaluateUpdate,
  selectBootManifest,
  verifyUpdatePayload,
} from "../app/pwaUpdatePlanner.js";

const hashOf = (seed) => `sha256-${String(seed).repeat(64).slice(0, 64)}`;

const asset = (path, seed, overrides = {}) => ({
  path,
  bytes: 1048576,
  hash: hashOf(seed),
  pack: "units",
  category: "unit",
  criticality: "critical",
  ...overrides,
});

const manifest = (version, releaseSha, assets) => ({
  schema: ASSET_MANIFEST_SCHEMA,
  version,
  releaseSha,
  assets,
});

test("activation is blocked outside safe screens and during unsafe work", () => {
  for (const screen of SAFE_ACTIVATION_SCREENS) {
    assert.deepEqual(evaluateActivationSafety({ screen }), { safe: true, blockers: [] });
  }

  assert.deepEqual(
    evaluateActivationSafety({ screen: "battle" }),
    { safe: false, blockers: ["unsafe-screen"] },
  );
  assert.deepEqual(
    evaluateActivationSafety({ screen: "survival" }),
    { safe: false, blockers: ["unsafe-screen"] },
  );
  assert.deepEqual(
    evaluateActivationSafety({ screen: "survival-result" }),
    { safe: false, blockers: ["unsafe-screen"] },
  );
});

test("a battle, a saving result, or a pending save mutation each block activation", () => {
  assert.deepEqual(
    evaluateActivationSafety({ screen: "map", battleActive: true }),
    { safe: false, blockers: ["battle-active"] },
  );
  assert.deepEqual(
    evaluateActivationSafety({ screen: "map", resultSaving: true }),
    { safe: false, blockers: ["result-saving"] },
  );
  assert.deepEqual(
    evaluateActivationSafety({ screen: "map", saveMutationPending: true }),
    { safe: false, blockers: ["save-mutation-pending"] },
  );
  assert.deepEqual(
    evaluateActivationSafety({ screen: "map", downloadActive: true }),
    { safe: false, blockers: ["download-active"] },
  );
});

test("every blocking condition is reported together", () => {
  const result = evaluateActivationSafety({
    screen: "battle",
    battleActive: true,
    resultSaving: true,
    saveMutationPending: true,
    downloadActive: true,
  });
  assert.equal(result.safe, false);
  assert.deepEqual(result.blockers, [
    "unsafe-screen",
    "battle-active",
    "result-saving",
    "save-mutation-pending",
    "download-active",
  ]);
});

test("an update reports only the added and changed download size", () => {
  const installed = manifest("0.9.6", "aaa", [asset("/keep.webp", 1), asset("/change.webp", 2)]);
  const published = manifest("0.9.7", "bbb", [
    asset("/keep.webp", 1),
    asset("/change.webp", 3),
    asset("/new.webp", 4),
  ]);

  const evaluation = evaluateUpdate({ installedManifest: installed, publishedManifest: published });
  assert.equal(evaluation.available, true);
  assert.equal(evaluation.toVersion, "0.9.7");
  assert.equal(evaluation.downloadCount, 2);
  assert.equal(evaluation.downloadBytes, 2097152);
  assert.equal(evaluation.unchangedCount, 1);
});

test("an identical release offers no update and no download", () => {
  const installed = manifest("0.9.6", "aaa", [asset("/a.webp", 1)]);
  const evaluation = evaluateUpdate({
    installedManifest: installed,
    publishedManifest: manifest("0.9.6", "aaa", [asset("/a.webp", 1)]),
  });
  assert.equal(evaluation.available, false);
  assert.equal(evaluation.reason, "already-current");
});

test("a same-version rebuild with a new SHA is still offered", () => {
  const evaluation = evaluateUpdate({
    installedManifest: manifest("0.9.6", "aaa", [asset("/a.webp", 1)]),
    publishedManifest: manifest("0.9.6", "bbb", [asset("/a.webp", 2)]),
  });
  assert.equal(evaluation.available, true);
  assert.equal(evaluation.downloadCount, 1);
});

test("assets already on the device are excluded from the update download", () => {
  const installed = manifest("0.9.6", "aaa", [asset("/a.webp", 1)]);
  const published = manifest("0.9.7", "bbb", [asset("/a.webp", 1), asset("/b.webp", 2)]);

  const withoutStore = evaluateUpdate({ installedManifest: installed, publishedManifest: published });
  assert.equal(withoutStore.downloadCount, 1);

  const withStore = evaluateUpdate({
    installedManifest: installed,
    publishedManifest: published,
    storedHashes: new Set([hashOf(1), hashOf(2)]),
  });
  assert.equal(withStore.downloadCount, 0);
  assert.equal(withStore.downloadBytes, 0);
  assert.equal(withStore.reusedCount, 1);
});

test("a malformed published manifest is refused rather than offered", () => {
  const evaluation = evaluateUpdate({
    installedManifest: manifest("0.9.6", "aaa", [asset("/a.webp", 1)]),
    publishedManifest: { schema: "wrong", version: "", releaseSha: "", assets: [] },
  });
  assert.equal(evaluation.available, false);
  assert.equal(evaluation.reason, "invalid-published-manifest");
  assert.ok(evaluation.errors.length > 0);
});

test("verification requires structure, identity, and every asset present", () => {
  const target = manifest("0.9.7", "bbb", [asset("/a.webp", 1), asset("/b.webp", 2)]);

  const verified = verifyUpdatePayload({
    manifest: target,
    storedHashes: new Set([hashOf(1), hashOf(2)]),
    expectedVersion: "0.9.7",
    expectedReleaseSha: "bbb",
  });
  assert.equal(verified.verified, true);
  assert.deepEqual(verified.errors, []);
});

test("a version or release SHA mismatch fails verification", () => {
  const target = manifest("0.9.7", "bbb", [asset("/a.webp", 1)]);
  const stored = new Set([hashOf(1)]);

  const wrongVersion = verifyUpdatePayload({
    manifest: target, storedHashes: stored, expectedVersion: "0.9.8", expectedReleaseSha: "bbb",
  });
  assert.equal(wrongVersion.verified, false);
  assert.ok(wrongVersion.errors.some((message) => message.includes("version mismatch")));

  const wrongSha = verifyUpdatePayload({
    manifest: target, storedHashes: stored, expectedVersion: "0.9.7", expectedReleaseSha: "ccc",
  });
  assert.equal(wrongSha.verified, false);
  assert.ok(wrongSha.errors.some((message) => message.includes("release SHA mismatch")));
});

test("a missing asset fails verification and is named", () => {
  const target = manifest("0.9.7", "bbb", [asset("/a.webp", 1), asset("/missing.webp", 9)]);
  const result = verifyUpdatePayload({
    manifest: target,
    storedHashes: new Set([hashOf(1)]),
    expectedVersion: "0.9.7",
    expectedReleaseSha: "bbb",
  });
  assert.equal(result.verified, false);
  assert.deepEqual(result.missingPaths, ["/missing.webp"]);
});

test("an unverified release boots the retained previous generation", () => {
  const active = manifest("0.9.7", "bbb", [asset("/a.webp", 2)]);
  const previous = manifest("0.9.6", "aaa", [asset("/a.webp", 1)]);

  assert.deepEqual(
    selectBootManifest({ active, previous, activeVerified: true }),
    { manifest: active, source: "active" },
  );
  assert.deepEqual(
    selectBootManifest({ active, previous, activeVerified: false }),
    { manifest: previous, source: "rollback" },
  );
});

test("with no rollback generation the app still boots rather than blocking", () => {
  const active = manifest("0.9.7", "bbb", [asset("/a.webp", 2)]);
  assert.deepEqual(
    selectBootManifest({ active, previous: null, activeVerified: false }),
    { manifest: active, source: "active-unverified" },
  );
  assert.deepEqual(selectBootManifest({}), { manifest: null, source: "none" });
});

test("the update prompt states version, size, and what is not re-downloaded", () => {
  const evaluation = evaluateUpdate({
    installedManifest: manifest("0.9.6", "aaa", [asset("/keep.webp", 1), asset("/change.webp", 2)]),
    publishedManifest: manifest("0.9.7", "bbb", [asset("/keep.webp", 1), asset("/change.webp", 3)]),
  });
  const described = describeUpdate(evaluation, { formatBytes });

  assert.equal(described.headline, "Version 0.9.7を利用できます");
  assert.equal(described.downloadLine, "追加データ 1.0MBをダウンロードします");
  assert.match(described.fileLine, /1件を更新・1件は再ダウンロードしません/);
  assert.match(described.wifiHint, /Wi-Fi/);
  assert.equal(describeUpdate({ available: false }, { formatBytes }), null);
});
