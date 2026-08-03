import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import sharp from "sharp";

const root = new URL("../assets/source/brand/candidates/v099/v2/", import.meta.url);
const ledger = JSON.parse(await readFile(new URL("candidate-ledger.json", root), "utf8"));
const prompts = JSON.parse(await readFile(new URL("generation-prompts.json", root), "utf8"));
const digest = (value) => createHash("sha256").update(value).digest("hex");

test("Gate A v2 icon contract is complete, project-original, and unapproved", async () => {
  assert.equal(ledger.status, "gate-a-icon-v2-candidates-only");
  assert.deepEqual(ledger.gateA, { audio: "approved", vfx: "approved", iconV1: "rejected", iconV2: "pending", decisionDate: "2026-08-04", decisionSource: "Producer decision in the Sol Lead chat" });
  assert.equal(ledger.distribution, false);
  assert.equal(ledger.runtimeReferences, 0);
  assert.equal(ledger.publicFiles, 0);
  assert.deepEqual(ledger.provenance.thirdPartySources, []);
  assert.equal(ledger.provenance.approvedCandidateId, null);
  assert.equal(ledger.provenance.approvedMasterSha256, null);
  assert.equal(ledger.provenance.approvalCommentUrl, null);
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

test("v2 candidates have no production icon, manifest, or service-worker references", async () => {
  const production = (await Promise.all([
    "../public/favicon.svg",
    "../public/manifest.webmanifest",
    "../public/asset-manifest.json",
    "../public/sw.js",
    "../app/layout.tsx",
    "../scripts/build-app-icons.mjs",
  ].map((relative) => readFile(new URL(relative, import.meta.url), "utf8")))).join("\n");
  for (const candidate of ledger.candidates) {
    assert.doesNotMatch(production, new RegExp(candidate.id, "u"));
    assert.doesNotMatch(production, new RegExp(candidate.master.replaceAll(".", "\\."), "u"));
  }
  assert.doesNotMatch(production, /candidates\/v099\/v2|v099-icon-candidates-v2/u);
});
