import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import sharp from "sharp";

import { PRODUCTION_VISUALS } from "../app/productionVisuals.js";
import { V075_VISUAL_PROFILES } from "../app/visualProfiles.js";

const manifestUrl = new URL("../docs/ASSET_APPROVALS_0.7.5.json", import.meta.url);
const repositoryRoot = new URL("../", import.meta.url);
const appRoot = new URL("../app/", import.meta.url);

async function loadManifest() {
  return JSON.parse(await readFile(manifestUrl, "utf8"));
}

async function sourceFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryUrl = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directoryUrl);
    if (entry.isDirectory()) return sourceFiles(entryUrl);
    return /\.(?:js|mjs|ts|tsx)$/.test(entry.name) ? [entryUrl] : [];
  }));
  return nested.flat();
}

function runtimeDescriptors() {
  return [
    ["V075-IKURA-IDENTITY", V075_VISUAL_PROFILES.ikura.identityMaster],
    ["V075-IKURA-EVENT-PORTRAIT", V075_VISUAL_PROFILES.ikura.eventPortrait],
    ["V075-CRAWLER-IDENTITY", V075_VISUAL_PROFILES.crawler.identityMaster],
    ["V075-CRAWLER-CLOSED", V075_VISUAL_PROFILES.crawler.closed],
    ["V075-CRAWLER-OPEN", V075_VISUAL_PROFILES.crawler.open],
    ["V075-ENEMY-BASE-IDENTITY", V075_VISUAL_PROFILES.enemyBase.identityMaster],
    ["V075-ENEMY-BASE-INTACT", V075_VISUAL_PROFILES.enemyBase.intact],
  ];
}

test("0.7.5 approval ledger is fail-closed, unique, and records free project provenance", async () => {
  const manifest = await loadManifest();

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.release, "0.7.5");
  assert.equal(manifest.reviewPolicy.mode, "producer_checkpoint");
  assert.equal(manifest.reviewPolicy.authority, "producer");
  assert.equal(manifest.reviewPolicy.individualApprovalRequired, true);
  assert.deepEqual(manifest.reviewPolicy.approvedSubjects, ["いくらちゃん", "CRAWLER", "敵拠点"]);
  assert.deepEqual(manifest.reviewPolicy.requiredEvidence, [
    "identity_lock",
    "source_chain",
    "asset_hash",
    "844x390_in_game",
    "844x340_in_game",
    "crawler_closed_open_deployment",
  ]);
  assert.equal(manifest.rightsProvenance.thirdPartyDownloadedVisuals, false);
  assert.equal(manifest.rightsProvenance.realPersonLikenessRequested, false);
  assert.equal(manifest.rightsProvenance.trademarkedCharacterRequested, false);
  assert.equal(
    manifest.rightsProvenance.publicRedistribution,
    "approved_for_project_repository_and_game_distribution",
  );
  assert.match(manifest.rightsProvenance.openAiTermsUrl, /^https:\/\/openai\.com\/policies\/terms-of-use\/$/);

  const keys = manifest.assets.map((asset) => `${asset.assetId}@${asset.revision}`);
  assert.equal(new Set(keys).size, keys.length, "asset revisions must be unique");
  assert.equal(manifest.assets.length, runtimeDescriptors().length);
  for (const asset of manifest.assets) {
    assert.equal(asset.status, "approved", `${asset.assetId} must fail closed unless approved`);
    assert.equal(asset.active, true, `${asset.assetId} must be the active approved revision`);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    assert.match(asset.finalPath, /^public\/art\/v075\/[a-z0-9./-]+\.(?:png|webp)$/);
    assert.ok(Array.isArray(asset.identityLock) && asset.identityLock.length >= 4);
  }
});

test("0.7.5 derivative source chains resolve to an approved identity lock", async () => {
  const manifest = await loadManifest();
  const byRevision = new Map(
    manifest.assets.map((asset) => [`${asset.assetId}@${asset.revision}`, asset]),
  );

  for (const asset of manifest.assets) {
    if (asset.sourceApprovedAssetId === null) {
      assert.equal(asset.sourceApprovedRevision, null);
      assert.match(asset.type, /identity_master$/);
      continue;
    }
    const source = byRevision.get(`${asset.sourceApprovedAssetId}@${asset.sourceApprovedRevision}`);
    assert.ok(source, `${asset.assetId} has an unresolved approved source`);
    assert.equal(source.status, "approved");
    assert.equal(source.active, true);
    assert.match(source.type, /identity_master$/);
    assert.deepEqual(asset.identityLock, source.identityLock, `${asset.assetId} identity drifted from its source`);
  }
});

test("0.7.5 approved files exactly match ledger hashes, byte sizes, dimensions, and runtime revisions", async () => {
  const manifest = await loadManifest();
  const byAssetId = new Map(manifest.assets.map((asset) => [asset.assetId, asset]));

  for (const [assetId, runtime] of runtimeDescriptors()) {
    const asset = byAssetId.get(assetId);
    assert.ok(asset, `${assetId} is missing from the approval ledger`);
    assert.equal(asset.finalPath, `public${runtime.path}`, `${assetId} runtime path drifted`);
    assert.equal(asset.revision, runtime.revision, `${assetId} runtime revision drifted`);

    const fileUrl = new URL(asset.finalPath, repositoryRoot);
    const bytes = await readFile(fileUrl);
    const metadata = await sharp(fileURLToPath(fileUrl), { failOn: "error" }).metadata();
    assert.equal(bytes.length, asset.bytes, `${assetId} byte size drifted`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256, `${assetId} hash drifted`);
    assert.equal(metadata.width, asset.width, `${assetId} width drifted`);
    assert.equal(metadata.height, asset.height, `${assetId} height drifted`);
  }

  assert.equal(PRODUCTION_VISUALS.guide, V075_VISUAL_PROFILES.ikura.eventPortrait.path);
  assert.deepEqual(byAssetId.get("V075-IKURA-IDENTITY").identityLock, V075_VISUAL_PROFILES.ikura.identityLock);
  assert.deepEqual(byAssetId.get("V075-CRAWLER-IDENTITY").identityLock, V075_VISUAL_PROFILES.crawler.identityLock);
  assert.deepEqual(byAssetId.get("V075-ENEMY-BASE-IDENTITY").identityLock, V075_VISUAL_PROFILES.enemyBase.identityLock);
});

test("every 0.7.5 runtime art literal is covered by the approval ledger", async () => {
  const manifest = await loadManifest();
  const approvedPaths = manifest.assets
    .filter((asset) => asset.status === "approved" && asset.active === true)
    .map((asset) => asset.finalPath)
    .sort();
  const literals = new Set();

  for (const fileUrl of await sourceFiles(appRoot)) {
    const source = await readFile(fileUrl, "utf8");
    for (const match of source.matchAll(/["'`](\/art\/v075\/[a-z0-9./-]+\.(?:png|webp))["'`]/g)) {
      literals.add(`public${match[1]}`);
    }
  }

  assert.deepEqual([...literals].sort(), approvedPaths);
});
