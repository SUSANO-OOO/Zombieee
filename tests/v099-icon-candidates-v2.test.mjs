import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import sharp from "sharp";

const root = new URL("../assets/source/brand/candidates/v099/v2/", import.meta.url);
const ledger = JSON.parse(await readFile(new URL("candidate-ledger.json", root), "utf8"));
const prompts = JSON.parse(await readFile(new URL("generation-prompts.json", root), "utf8"));
const digest = (value) => createHash("sha256").update(value).digest("hex");

test("Gate A v2 icon contract records the exact A2 approval", async () => {
  assert.equal(ledger.status, "gate-a-icon-v2-a2-approved");
  assert.deepEqual(ledger.gateA, { audio: "approved", vfx: "approved", iconV1: "rejected", iconV2: "approved", decisionDate: "2026-08-04", decisionSource: "Producer decision in the Sol Lead chat" });
  assert.equal(ledger.distribution, false);
  assert.equal(ledger.runtimeReferences, 0);
  assert.equal(ledger.publicFiles, 0);
  assert.deepEqual(ledger.provenance.thirdPartySources, []);
  assert.equal(ledger.provenance.approvedCandidateId, "v099-infected-face-a2");
  assert.equal(ledger.provenance.approvedMasterSha256, "88b5b3aff7f8a026b3bd9d95433c9363804f4e838d224df4c6298073ea3be38e");
  assert.equal(ledger.provenance.approvalCommentUrl, "https://github.com/SUSANO-OOO/Zombieee/issues/136#issuecomment-5166734506");
  assert.equal(ledger.productionSelection.candidateId, ledger.provenance.approvedCandidateId);
  assert.equal(ledger.productionSelection.masterSha256, ledger.provenance.approvedMasterSha256);
  assert.equal(ledger.productionSelection.legacyPathsDeleted, false);
  assert.deepEqual(prompts.externalSources, []);
  assert.equal(prompts.accepted.length, 3);
  assert.equal(ledger.candidates.length, 3);
  assert.equal(new Set(ledger.candidates.map(({ id }) => id)).size, 3);
  for (const candidate of ledger.candidates) {
    assert.match(candidate.id, /^v099-infected-face-[abc]2$/u);
    assert.ok(candidate.faceCoveragePercent >= 70 && candidate.faceCoveragePercent <= 85);
    const source = await readFile(new URL(candidate.source, root));
    const master = await readFile(new URL(candidate.master, root));
    assert.equal(digest(source), candidate.generatedSourceSha256);
    assert.equal(digest(master), candidate.masterSha256);
    const sourceMeta = await sharp(source).metadata();
    const masterMeta = await sharp(master).metadata();
    assert.equal(sourceMeta.width, sourceMeta.height);
    assert.ok(sourceMeta.width >= 1024);
    assert.equal(masterMeta.width, 1024);
    assert.equal(masterMeta.height, 1024);
    for (const feature of ledger.maskable.requiredFeatures) {
      const point = candidate.featurePoints[feature];
      assert.ok(Math.hypot(point.x - 512, point.y - 512) <= ledger.maskable.safeRadius, `${candidate.id} ${feature}`);
    }
  }
});

test("only approved A2 can enter production references while B2 and C2 remain authoring-only", async () => {
  const production = (await Promise.all([
    "../app/appIconIdentity.js",
    "../public/favicon.svg",
    "../public/manifest.webmanifest",
    "../public/asset-manifest.json",
    "../public/sw.js",
    "../app/layout.tsx",
    "../scripts/build-app-icons.mjs",
  ].map((relative) => readFile(new URL(relative, import.meta.url), "utf8")))).join("\n");
  const approved = ledger.candidates.find(({ id }) => id === ledger.provenance.approvedCandidateId);
  assert.ok(approved);
  assert.match(production, new RegExp(approved.id, "u"));
  assert.match(production, new RegExp(approved.master.replaceAll(".", "\\."), "u"));
  for (const candidate of ledger.candidates.filter(({ id }) => id !== approved.id)) {
    assert.doesNotMatch(production, new RegExp(candidate.id, "u"));
    assert.doesNotMatch(production, new RegExp(candidate.master.replaceAll(".", "\\."), "u"));
  }
  assert.doesNotMatch(production, /generated-originals|infected-face-[bc]2/u);
});
