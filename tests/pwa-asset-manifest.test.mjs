import assert from "node:assert/strict";
import test from "node:test";

import {
  ASSET_MANIFEST_SCHEMA,
  audioChannelFor,
  diffAssetManifests,
  distinctDownloadBytes,
  formatBytes,
  isDistributionPath,
  planInstall,
  summarizeByAudioChannel,
  summarizeByCategory,
  validateAssetManifest,
} from "../app/pwaAssetManifest.js";

const hashOf = (seed) => `sha256-${String(seed).repeat(64).slice(0, 64)}`;

const asset = (path, seed, overrides = {}) => ({
  path,
  bytes: 1024,
  hash: hashOf(seed),
  pack: "units",
  category: "unit",
  criticality: "critical",
  ...overrides,
});

const manifest = (assets, overrides = {}) => ({
  schema: ASSET_MANIFEST_SCHEMA,
  version: "0.9.6",
  releaseSha: "a0dd0b3207f81060745a19b3f6666a9999aa3e53",
  assets,
  ...overrides,
});

test("distribution paths reject traversal, protocol, and query forms", () => {
  assert.equal(isDistributionPath("/art/unit.webp"), true);
  assert.equal(isDistributionPath("//evil.example/x.webp"), false);
  assert.equal(isDistributionPath("/art/../secret.webp"), false);
  assert.equal(isDistributionPath("/art/unit.webp?v=2"), false);
  assert.equal(isDistributionPath("art/unit.webp"), false);
  assert.equal(isDistributionPath("C:\\art\\unit.webp"), false);
});

test("a well-formed manifest validates and a malformed one reports every fault", () => {
  assert.deepEqual(validateAssetManifest(manifest([asset("/a.webp", 1)])), { valid: true, errors: [] });

  const broken = validateAssetManifest(manifest([
    { path: "relative.webp", bytes: 0, hash: "nope", pack: "unknown", category: "nope", criticality: "maybe" },
  ]));
  assert.equal(broken.valid, false);
  assert.ok(broken.errors.some((message) => message.includes("path")));
  assert.ok(broken.errors.some((message) => message.includes("bytes")));
  assert.ok(broken.errors.some((message) => message.includes("hash")));
  assert.ok(broken.errors.some((message) => message.includes("pack")));
  assert.ok(broken.errors.some((message) => message.includes("category")));
  assert.ok(broken.errors.some((message) => message.includes("criticality")));
});

test("duplicate paths and conflicting sizes for one hash are rejected", () => {
  const duplicated = validateAssetManifest(manifest([asset("/a.webp", 1), asset("/a.webp", 2)]));
  assert.equal(duplicated.valid, false);
  assert.ok(duplicated.errors.some((message) => message.includes("duplicate asset path")));

  const conflicting = validateAssetManifest(manifest([
    asset("/a.webp", 1),
    asset("/b.webp", 1, { bytes: 2048 }),
  ]));
  assert.equal(conflicting.valid, false);
  assert.ok(conflicting.errors.some((message) => message.includes("conflicting byte sizes")));
});

test("audio assets require a channel and non-audio assets must not carry one", () => {
  const missingChannel = validateAssetManifest(manifest([
    asset("/audio/a.ogg", 1, { category: "audio", pack: "audio" }),
  ]));
  assert.equal(missingChannel.valid, false);
  assert.ok(missingChannel.errors.some((message) => message.includes("audioChannel")));

  const strayChannel = validateAssetManifest(manifest([asset("/a.webp", 1, { audioChannel: "bgm" })]));
  assert.equal(strayChannel.valid, false);

  const good = validateAssetManifest(manifest([
    asset("/audio/a.ogg", 1, { category: "audio", pack: "audio", audioChannel: "bgm" }),
  ]));
  assert.equal(good.valid, true);
});

test("audio manifest categories map onto player-facing BGM, SE, and voice", () => {
  assert.equal(audioChannelFor("bgm"), "bgm");
  assert.equal(audioChannelFor("humanVoices"), "voice");
  assert.equal(audioChannelFor("monsters"), "voice");
  for (const category of ["ambience", "ui", "weapons", "melee", "support"]) {
    assert.equal(audioChannelFor(category), "se");
  }
  assert.equal(audioChannelFor("unrecognised"), "se");
});

test("shared content hashes are counted and downloaded exactly once", () => {
  const assets = [asset("/a.webp", 1), asset("/b.webp", 1), asset("/c.webp", 2)];
  assert.equal(distinctDownloadBytes(assets), 2048);
});

test("an update downloads only added and changed assets", () => {
  const current = manifest([
    asset("/keep.webp", 1),
    asset("/change.webp", 2),
    asset("/drop.webp", 3),
  ]);
  const next = manifest([
    asset("/keep.webp", 1),
    asset("/change.webp", 4),
    asset("/new.webp", 5),
  ], { version: "0.9.7" });

  const diff = diffAssetManifests(current, next);
  assert.deepEqual(diff.unchanged.map((entry) => entry.path), ["/keep.webp"]);
  assert.deepEqual(diff.changed.map((entry) => entry.path), ["/change.webp"]);
  assert.deepEqual(diff.added.map((entry) => entry.path), ["/new.webp"]);
  assert.deepEqual(diff.removed.map((entry) => entry.path), ["/drop.webp"]);
  assert.equal(diff.downloadCount, 2);
  assert.equal(diff.downloadBytes, 2048);
});

test("an identical manifest produces a zero-byte, zero-request update", () => {
  const current = manifest([asset("/a.webp", 1), asset("/b.webp", 2)]);
  const diff = diffAssetManifests(current, manifest([asset("/a.webp", 1), asset("/b.webp", 2)]));
  assert.equal(diff.downloadCount, 0);
  assert.equal(diff.downloadBytes, 0);
  assert.equal(diff.unchanged.length, 2);
});

test("a renamed asset whose bytes are already stored costs no download", () => {
  const current = manifest([asset("/old-name.webp", 1)]);
  const next = manifest([asset("/new-name.webp", 1)]);
  const diff = diffAssetManifests(current, next);
  assert.deepEqual(diff.reused.map((entry) => entry.path), ["/new-name.webp"]);
  assert.equal(diff.downloadCount, 0);
  assert.equal(diff.downloadBytes, 0);
  assert.deepEqual(diff.removed.map((entry) => entry.path), ["/old-name.webp"]);
});

test("install planning separates missing, mismatched, and satisfied assets", () => {
  const target = manifest([asset("/a.webp", 1), asset("/b.webp", 2), asset("/c.webp", 3)]);
  const plan = planInstall(target, {
    storedHashesByPath: new Map([["/a.webp", hashOf(1)], ["/b.webp", hashOf(9)]]),
  });
  assert.deepEqual(plan.satisfied.map((entry) => entry.path), ["/a.webp"]);
  assert.deepEqual(plan.mismatched.map((entry) => entry.path), ["/b.webp"]);
  assert.deepEqual(plan.missing.map((entry) => entry.path), ["/c.webp"]);
  assert.equal(plan.complete, false);
  assert.equal(plan.pendingCount, 2);
  assert.equal(plan.pendingBytes, 2048);
  assert.equal(plan.totalCount, 3);
});

test("an explicitly corrupt path is re-fetched even when its stored hash matches", () => {
  const target = manifest([asset("/a.webp", 1)]);
  const plan = planInstall(target, {
    storedHashesByPath: new Map([["/a.webp", hashOf(1)]]),
    corruptPaths: new Set(["/a.webp"]),
  });
  assert.deepEqual(plan.mismatched.map((entry) => entry.path), ["/a.webp"]);
  assert.equal(plan.complete, false);
});

test("a fully stored manifest plans no work", () => {
  const target = manifest([asset("/a.webp", 1), asset("/b.webp", 2)]);
  const plan = planInstall(target, {
    storedHashesByPath: new Map([["/a.webp", hashOf(1)], ["/b.webp", hashOf(2)]]),
  });
  assert.equal(plan.complete, true);
  assert.equal(plan.pendingCount, 0);
  assert.equal(plan.pendingBytes, 0);
});

test("category and audio-channel summaries drive the progress display", () => {
  const assets = [
    asset("/unit.webp", 1),
    asset("/enemy.webp", 2, { category: "enemy" }),
    asset("/bgm.ogg", 3, { category: "audio", pack: "audio", audioChannel: "bgm" }),
    asset("/voice.ogg", 4, { category: "audio", pack: "audio", audioChannel: "voice" }),
  ];
  assert.deepEqual(summarizeByCategory(assets).audio, { count: 2, bytes: 2048 });
  assert.deepEqual(summarizeByAudioChannel(assets), {
    bgm: { count: 1, bytes: 1024 },
    voice: { count: 1, bytes: 1024 },
  });
});

test("byte formatting stays readable across the sizes players actually see", () => {
  assert.equal(formatBytes(0), "0MB");
  assert.equal(formatBytes(-5), "0MB");
  assert.equal(formatBytes(512 * 1024), "512KB");
  assert.equal(formatBytes(5 * 1048576), "5.0MB");
  assert.equal(formatBytes(150 * 1048576), "150MB");
  assert.equal(formatBytes(2 * 1024 * 1048576), "2.00GB");
});
