import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const candidateRoot = new URL("../assets/source/brand/candidates/v099/", import.meta.url);
const ledger = JSON.parse(await readFile(new URL("candidate-ledger.json", candidateRoot), "utf8"));

test("Gate A icon candidates remain project-original and outside distribution", async () => {
  assert.equal(ledger.version, "0.9.9.0");
  assert.equal(ledger.status, "gate-a-candidates-only");
  assert.equal(ledger.distribution, false);
  assert.equal(ledger.runtimeReferences, 0);
  assert.equal(ledger.publicFiles, 0);
  assert.equal(ledger.provenance.type, "project-original");
  assert.deepEqual(ledger.provenance.thirdPartySources, []);
  assert.deepEqual(ledger.provenance.externalFonts, []);
  assert.equal(ledger.provenance.tracedArtwork, false);
  assert.equal(ledger.provenance.approvedCandidateId, null);
  assert.equal(ledger.provenance.approvedMasterSha256, null);
  assert.equal(ledger.provenance.approvalCommentUrl, null);
  assert.equal(ledger.candidates.length, 3);
  assert.equal(new Set(ledger.candidates.map(({ id }) => id)).size, 3);

  for (const candidate of ledger.candidates) {
    const master = await readFile(new URL(candidate.master, candidateRoot), "utf8");
    assert.match(candidate.id, /^v099-infected-face-[a-c]$/u);
    assert.match(master, /viewBox="0 0 1024 1024"/u);
    assert.match(master, new RegExp(`data-candidate-id="${candidate.id}"`, "u"));
    assert.match(master, /<g id="backdrop">/u);
    assert.match(master, /<g id="mark"/u);
    assert.doesNotMatch(master, /<image\b|(?:href|xlink:href)="https?:\/\//u);
  }
});

test("candidate IDs and source paths are absent from the production icon references", async () => {
  const productionFiles = await Promise.all([
    "../assets/source/brand/app-icon-master.svg",
    "../public/favicon.svg",
    "../public/manifest.webmanifest",
    "../public/asset-manifest.json",
    "../app/layout.tsx",
    "../scripts/build-app-icons.mjs",
  ].map((relative) => readFile(new URL(relative, import.meta.url), "utf8")));
  const productionText = productionFiles.join("\n");
  for (const candidate of ledger.candidates) {
    assert.doesNotMatch(productionText, new RegExp(candidate.id, "u"));
    assert.doesNotMatch(productionText, new RegExp(candidate.master.replaceAll(".", "\\."), "u"));
  }
});
