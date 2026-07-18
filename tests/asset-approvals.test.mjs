import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";

import { PRODUCTION_VISUALS } from "../app/productionVisuals.js";
import { CHARACTER_PORTRAIT_ART, SPRITE_MANIFEST } from "../app/spriteManifest.js";
import { STAGE_OBJECT_MANIFEST } from "../app/stageObjectManifest.js";

const manifestUrl = new URL("../docs/ASSET_APPROVALS_0.7.0.json", import.meta.url);
const repositoryRoot = new URL("../", import.meta.url);
const allowedStatuses = new Set([
  "pending_producer_approval",
  "approved",
  "rejected_by_producer",
]);
const delegatedReviewMode = "producer_delegated_internal_quality_gate";
const delegatedEvidenceKeys = Object.freeze([
  "identity_lock_comparison",
  "visual_integrity_review",
  "844x390_in_game",
  "844x340_in_game",
  "asset_hash_and_final_path",
]);
const expectedActiveCharacterAssets = Object.freeze([
  { assetId: "V070-CHAR-IKURA-BASE", revision: "r7", finalPath: "public/art/v070/characters/reference/ikura-base-r7.png" },
  { assetId: "V070-CHAR-IKURA-PORTRAIT", revision: "r3", finalPath: "public/art/v070/characters/portraits/guide-portrait-v1.webp" },
  { assetId: "V070-CHAR-MIZUCHI-BASE", revision: "r3", finalPath: "public/art/v070/characters/reference/mizuchi-base-r3.png" },
  { assetId: "V070-CHAR-MIZUCHI-PORTRAIT", revision: "r1", finalPath: "public/art/v070/characters/portraits/ranger-portrait-v1.webp" },
  { assetId: "V070-CHAR-MIZUCHI-BATTLE", revision: "r1", finalPath: "public/art/v070/characters/ranger-battle-v1.png" },
  { assetId: "V070-CHAR-NAO-BASE", revision: "r1", finalPath: "public/art/v070/characters/reference/nao-base-r1.png" },
  { assetId: "V070-CHAR-NAO-PORTRAIT", revision: "r1", finalPath: "public/art/v070/characters/portraits/medic-portrait-v1.webp" },
  { assetId: "V070-CHAR-NAO-BATTLE", revision: "r1", finalPath: "public/art/v070/characters/medic-battle-v1.png" },
  { assetId: "V070-CHAR-TATARA-BASE", revision: "r8", finalPath: "public/art/v070/characters/reference/tatara-base-r8.png" },
  { assetId: "V070-CHAR-TATARA-PORTRAIT", revision: "r1", finalPath: "public/art/v070/characters/portraits/brute-portrait-v1.webp" },
  { assetId: "V070-CHAR-TATARA-BATTLE", revision: "r1", finalPath: "public/art/v070/characters/brute-battle-v1.png" },
  { assetId: "V070-CHAR-RAIDER-BASE", revision: "r10", finalPath: "public/art/v070/characters/reference/raider-base-r10.png" },
  { assetId: "V070-CHAR-RAIDER-PORTRAIT", revision: "r1", finalPath: "public/art/v070/characters/portraits/gunner-portrait-v1.webp" },
  { assetId: "V070-CHAR-RAIDER-BATTLE", revision: "r3", finalPath: "public/art/v070/characters/gunner-battle-v1.png" },
  { assetId: "V070-CHAR-GANTETSU-BASE", revision: "r7", finalPath: "public/art/v070/characters/reference/gantetsu-base-r7.png" },
  { assetId: "V070-CHAR-GANTETSU-PORTRAIT", revision: "r1", finalPath: "public/art/v070/characters/portraits/guardian-portrait-v1.webp" },
  { assetId: "V070-CHAR-GANTETSU-BATTLE", revision: "r1", finalPath: "public/art/v070/characters/guardian-battle-v1.png" },
  { assetId: "V070-CHAR-MONKEY-BASE", revision: "r11", finalPath: "public/art/v070/characters/reference/monkey-base-r11.png" },
  { assetId: "V070-CHAR-MONKEY-PORTRAIT", revision: "r2", finalPath: "public/art/v070/characters/portraits/engineer-portrait-v1.webp" },
  { assetId: "V070-CHAR-MONKEY-BATTLE", revision: "r4", finalPath: "public/art/v070/characters/engineer-battle-v1.png" },
]);

async function loadManifest() {
  return JSON.parse(await readFile(manifestUrl, "utf8"));
}

function activeApprovedAssets(manifest) {
  const approvedByAssetId = Map.groupBy(
    manifest.assets.filter((asset) => asset.status === "approved"),
    (asset) => asset.assetId,
  );
  const active = [];
  for (const [assetId, revisions] of approvedByAssetId) {
    const supersededRevisions = new Set(
      revisions
        .map((asset) => asset.supersedesRevision)
        .filter((revision) => typeof revision === "string"),
    );
    const current = revisions.filter((asset) => !supersededRevisions.has(asset.revision));
    assert.equal(current.length, 1, `${assetId} must have exactly one active approved revision`);
    active.push(current[0]);
  }
  return active;
}

test("0.7.0 asset approval manifest has unique revision records", async () => {
  const manifest = await loadManifest();

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.release, "0.7.0");
  assert.equal(
    manifest.rightsProvenance.publicRedistribution,
    "approved_for_project_repository_and_game_distribution",
  );
  assert.equal(manifest.rightsProvenance.reviewedAt, "2026-07-19");
  assert.match(manifest.rightsProvenance.openAiTermsUrl, /^https:\/\/openai\.com\/policies\/terms-of-use\/$/);
  assert.equal(manifest.rightsProvenance.thirdPartyDownloadedVisuals, false);
  assert.deepEqual(
    manifest.rightsProvenance.producerProvidedInputs.map(({ assetRevision, finalPath }) => ({
      assetRevision,
      finalPath,
    })),
    [{
      assetRevision: "V070-CHAR-MIZUCHI-BASE@r3",
      finalPath: "public/art/v070/characters/reference/mizuchi-base-r3.png",
    }],
  );
  assert.equal(manifest.reviewPolicy.mode, delegatedReviewMode);
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
    if (asset.reviewMode === delegatedReviewMode) {
      assert.equal(asset.approvalUrl, null);
      assert.ok(asset.qualityEvidence && typeof asset.qualityEvidence === "object");
    } else {
      assert.match(asset.approvalUrl, /^https:\/\/github\.com\/SUSANO-OOO\/Zombieee\//);
    }
    assert.ok(asset.approvalResponse);
    assert.ok(asset.approvedAt);
    assert.ok(asset.identityLock && typeof asset.identityLock === "object");
    assert.ok(asset.finalPath?.startsWith("public/art/v070/"));
    assert.match(asset.commit, /^[a-f0-9]{40}$/, `${asset.assetId}@${asset.revision} is missing commit provenance`);
    assert.ok(
      manifest.rightsProvenance.scope.includes("public/art/v070/"),
      "rights provenance must cover every approved formal visual",
    );

    const bytes = await readFile(new URL(asset.finalPath, repositoryRoot));
    const digest = createHash("sha256").update(bytes).digest("hex");
    assert.equal(digest, asset.previewSha256, `${asset.assetId}@${asset.revision} differs from its approved preview`);
  }
});

test("each approved asset id resolves to one active revision", async () => {
  const manifest = await loadManifest();
  assert.ok(activeApprovedAssets(manifest).length > 0);
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
    assert.equal(asset.commit, null);
  }
});

test("the twenty 0.7.0 character deliverables resolve to exact active revisions and paths", async () => {
  const manifest = await loadManifest();
  const scopedSubjects = new Set(["いくらちゃん", "ミズチ", "ナオ", "タタラ", "レイダー", "ガンテツ", "モンキー"]);
  const scopedActive = activeApprovedAssets(manifest).filter((asset) => scopedSubjects.has(asset.subject));
  const activeByAssetId = new Map(scopedActive.map((asset) => [asset.assetId, asset]));

  assert.equal(expectedActiveCharacterAssets.length, 20);
  assert.equal(scopedActive.length, 20);
  assert.deepEqual(
    [...activeByAssetId.keys()].sort(),
    expectedActiveCharacterAssets.map(({ assetId }) => assetId).sort(),
  );
  for (const expected of expectedActiveCharacterAssets) {
    const active = activeByAssetId.get(expected.assetId);
    assert.ok(active, `${expected.assetId} is missing an active approved revision`);
    assert.equal(active.revision, expected.revision, `${expected.assetId} active revision drifted`);
    assert.equal(active.finalPath, expected.finalPath, `${expected.assetId} final path drifted`);
  }
});

test("delegated approvals have complete evidence and every evidence file exists", async () => {
  const manifest = await loadManifest();
  const delegated = manifest.assets.filter(
    (asset) => asset.status === "approved" && asset.reviewMode === delegatedReviewMode,
  );
  const evidencePaths = new Set();

  assert.equal(delegated.length, 33);
  for (const asset of delegated) {
    assert.deepEqual(
      Object.keys(asset.qualityEvidence).sort(),
      [...delegatedEvidenceKeys].sort(),
      `${asset.assetId}@${asset.revision} has incomplete evidence keys`,
    );
    for (const evidenceKey of delegatedEvidenceKeys.slice(0, 4)) {
      const paths = asset.qualityEvidence[evidenceKey];
      assert.ok(Array.isArray(paths) && paths.length > 0, `${asset.assetId}@${asset.revision}/${evidenceKey} is empty`);
      paths.forEach((path) => {
        assert.ok(
          path.startsWith("docs/qa/v070/") || path.startsWith("public/art/v070/"),
          `${asset.assetId}@${asset.revision}/${evidenceKey} must use tracked QA or formal-art evidence`,
        );
        evidencePaths.add(path);
      });
    }
    assert.deepEqual(asset.qualityEvidence.asset_hash_and_final_path, {
      finalPath: asset.finalPath,
      sha256: asset.previewSha256,
    });
  }

  const missing = [];
  for (const evidencePath of [...evidencePaths].sort()) {
    try {
      await access(new URL(evidencePath, repositoryRoot));
    } catch {
      missing.push(evidencePath);
    }
  }
  assert.deepEqual(missing, [], `missing delegated quality evidence: ${missing.join(", ")}`);
});

test("active approved portrait and battle paths exactly cover every runtime v070 mapping", async () => {
  const manifest = await loadManifest();
  const activeRuntimeArtifacts = activeApprovedAssets(manifest)
    .filter((asset) => asset.type === "character_portrait" || asset.type === "character_battle_atlas")
    .map((asset) => asset.finalPath)
    .sort();
  const runtimePaths = [
    ...Object.values(CHARACTER_PORTRAIT_ART),
    ...Object.values(SPRITE_MANIFEST).map((entry) => entry.path),
  ]
    .filter((path) => path.startsWith("/art/v070/"))
    .map((path) => `public${path}`)
    .sort();

  assert.deepEqual(activeRuntimeArtifacts, runtimePaths);
});

test("active approved stage art exactly covers every runtime v070 stage mapping", async () => {
  const manifest = await loadManifest();
  const activeStageArtifacts = activeApprovedAssets(manifest)
    .filter((asset) => (
      asset.type === "stage_background"
      || asset.type === "stage_object_overlay"
      || asset.type === "event_cut"
    ))
    .map((asset) => asset.finalPath)
    .sort();
  const runtimePaths = [
    ...Object.values(PRODUCTION_VISUALS.stages),
    ...Object.values(PRODUCTION_VISUALS.eventCuts),
    ...Object.values(STAGE_OBJECT_MANIFEST)
      .flatMap((stage) => stage.objects.map((entry) => entry.path)),
  ]
    .filter((path) => path.startsWith("/art/v070/"))
    .map((path) => `public${path}`);

  assert.deepEqual(activeStageArtifacts, [...new Set(runtimePaths)].sort());
});

test("the 0.7.0 approval ledger has no pending producer approval", async () => {
  const manifest = await loadManifest();
  assert.equal(
    manifest.assets.filter((asset) => asset.status === "pending_producer_approval").length,
    0,
  );
});

test("active v070 portraits and battle atlases have exact production geometry and alpha", async () => {
  const manifest = await loadManifest();
  const activeArtifacts = activeApprovedAssets(manifest).filter(
    (asset) => asset.type === "character_portrait" || asset.type === "character_battle_atlas",
  );

  for (const asset of activeArtifacts) {
    const metadata = await sharp(await readFile(new URL(asset.finalPath, repositoryRoot))).metadata();
    assert.equal(metadata.hasAlpha, true, `${asset.assetId}@${asset.revision} must retain alpha`);
    if (asset.type === "character_portrait") {
      assert.equal(metadata.format, "webp");
      assert.equal(metadata.width, 512);
      assert.equal(metadata.height, 640);
    } else {
      assert.equal(metadata.format, "png");
      assert.equal(metadata.width, 3360);
      assert.equal(metadata.height, 896);
    }
  }
});
