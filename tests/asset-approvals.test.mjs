import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifestUrl = new URL("../docs/ASSET_APPROVALS_0.7.0.json", import.meta.url);
const repositoryRoot = new URL("../", import.meta.url);
const allowedStatuses = new Set([
  "pending_producer_approval",
  "approved",
  "rejected_by_producer",
]);

async function loadManifest() {
  return JSON.parse(await readFile(manifestUrl, "utf8"));
}

test("0.7.0 asset approval manifest has unique revision records", async () => {
  const manifest = await loadManifest();

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.release, "0.7.0");
  assert.equal(manifest.reviewPolicy.mode, "producer_delegated_internal_quality_gate");
  assert.equal(manifest.reviewPolicy.individualApprovalRequired, false);
  assert.equal(manifest.reviewPolicy.preserveHistoricalIndividualReviews, true);
  assert.ok(Array.isArray(manifest.assets));

  const revisionKeys = manifest.assets.map((asset) => `${asset.assetId}@${asset.revision}`);
  assert.equal(new Set(revisionKeys).size, revisionKeys.length);

  for (const asset of manifest.assets) {
    assert.ok(allowedStatuses.has(asset.status), `${asset.assetId}@${asset.revision} has an unknown status`);
    assert.match(asset.previewSha256, /^[a-f0-9]{64}$/);
  }
});

test("approved image revisions have an identity lock and an exact formal artifact", async () => {
  const manifest = await loadManifest();
  const approvedAssets = manifest.assets.filter((asset) => asset.status === "approved");

  assert.ok(approvedAssets.length > 0);

  for (const asset of approvedAssets) {
    if (asset.reviewMode === "producer_delegated_internal_quality_gate") {
      assert.equal(asset.approvalUrl, null);
      assert.ok(asset.qualityEvidence && typeof asset.qualityEvidence === "object");
    } else {
      assert.match(asset.approvalUrl, /^https:\/\/github\.com\/SUSANO-OOO\/Zombieee\//);
    }
    assert.ok(asset.approvalResponse);
    assert.ok(asset.approvedAt);
    assert.ok(asset.identityLock && typeof asset.identityLock === "object");
    assert.ok(asset.finalPath?.startsWith("public/art/v070/"));

    const bytes = await readFile(new URL(asset.finalPath, repositoryRoot));
    const digest = createHash("sha256").update(bytes).digest("hex");
    assert.equal(digest, asset.previewSha256, `${asset.assetId}@${asset.revision} differs from its approved preview`);
  }
});

test("each approved asset id resolves to one active revision", async () => {
  const manifest = await loadManifest();
  const approvedByAssetId = Map.groupBy(
    manifest.assets.filter((asset) => asset.status === "approved"),
    (asset) => asset.assetId,
  );

  for (const [assetId, revisions] of approvedByAssetId) {
    const supersededRevisions = new Set(
      revisions
        .map((asset) => asset.supersedesRevision)
        .filter((revision) => typeof revision === "string"),
    );
    const active = revisions.filter((asset) => !supersededRevisions.has(asset.revision));
    assert.equal(active.length, 1, `${assetId} must have exactly one active approved revision`);
  }
});

test("rejected image revisions retain the rejection reason and cannot be final artifacts", async () => {
  const manifest = await loadManifest();
  const rejectedAssets = manifest.assets.filter((asset) => asset.status === "rejected_by_producer");

  assert.ok(rejectedAssets.length > 0);

  for (const asset of rejectedAssets) {
    assert.ok(asset.rejectionReason);
    assert.equal(asset.approvedAt, null);
    assert.equal(asset.identityLock, null);
    assert.equal(asset.finalPath, null);
  }
});
