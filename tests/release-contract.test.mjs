import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeReleaseContract,
  readReleaseContract,
  releaseContractFromEnvironment,
} from "../scripts/release-contract.mjs";

const validContract = Object.freeze({
  version: "0.7.1",
  release_ref: "v0.7.1",
  release_sha: "1".repeat(40),
  issue_number: 43,
  request_id: "v0.7.1-release-20260722",
});

test("release contract normalizes the five exact immutable release fields", () => {
  assert.deepEqual(normalizeReleaseContract(validContract), validContract);
  assert.deepEqual(normalizeReleaseContract({ ...validContract, release_ref: validContract.release_sha }), {
    ...validContract,
    release_ref: validContract.release_sha,
  });
});

test("release contract rejects missing, extra, mutable, and unsafe identities", () => {
  assert.throws(() => normalizeReleaseContract({ ...validContract, request_id: undefined }), /request_id/u);
  assert.throws(() => normalizeReleaseContract({ ...validContract, extra: true }), /unknown: extra/u);
  assert.throws(() => normalizeReleaseContract({ ...validContract, version: "v0.7.1" }), /semantic version/u);
  assert.throws(() => normalizeReleaseContract({ ...validContract, release_ref: "main" }), /release_ref/u);
  assert.throws(() => normalizeReleaseContract({ ...validContract, release_sha: "A".repeat(40) }), /lowercase/u);
  assert.throws(() => normalizeReleaseContract({ ...validContract, issue_number: 0 }), /positive integer/u);
  assert.throws(() => normalizeReleaseContract({ ...validContract, request_id: "short" }), /8-128/u);
});

test("manual dispatch environment uses the same validator", () => {
  assert.deepEqual(releaseContractFromEnvironment({
    RELEASE_VERSION: validContract.version,
    RELEASE_REF: validContract.release_ref,
    RELEASE_SHA: validContract.release_sha,
    RELEASE_ISSUE_NUMBER: String(validContract.issue_number),
    RELEASE_REQUEST_ID: validContract.request_id,
  }), validContract);
});

test("checked-in immutable request remains valid", async () => {
  const contract = await readReleaseContract(".github/pages-release-request.json");
  assert.equal(contract.version, "0.7.0");
  assert.equal(contract.release_ref, "v0.7.0");
  assert.equal(contract.issue_number, 37);
});

test("workflows enforce explicit deployment and pass one request identity into public QA", async () => {
  const releaseWorkflow = await readFile(".github/workflows/github-pages-release.yml", "utf8");
  const publicWorkflow = await readFile(".github/workflows/github-pages-public-qa.yml", "utf8");
  const publicSmoke = await readFile("scripts/github-pages-public-smoke.mjs", "utf8");
  const pagesBuilder = await readFile("scripts/build-github-pages.mjs", "utf8");
  const pagesIdentity = await readFile("scripts/pages-release-identity.mjs", "utf8");

  assert.match(releaseWorkflow, /push:\s+branches:\s+- main\s+paths:\s+- "\.github\/pages-release-request\.json"/u);
  assert.doesNotMatch(releaseWorkflow, /paths-ignore:/u);
  for (const field of ["version", "release_ref", "release_sha", "issue_number", "request_id"]) {
    assert.match(releaseWorkflow, new RegExp(`^      ${field}:`, "mu"));
  }
  assert.match(releaseWorkflow, /needs\.build\.outputs\.requested == 'true'/u);
  assert.match(releaseWorkflow, /manual release dispatch must run from refs\/heads\/main/u);
  assert.match(releaseWorkflow, /select\(\.draft == false and \.prerelease == false\)/u);
  assert.doesNotMatch(releaseWorkflow.split("\njobs:", 1)[0], /\bwrite\b/u);
  assert.match(releaseWorkflow, /build:\s+permissions:\s+contents: read\s+issues: read\s+pages: read/u);
  assert.match(releaseWorkflow, /deploy:[\s\S]*?permissions:\s+contents: read\s+pages: write\s+id-token: write/u);
  assert.match(releaseWorkflow, /name: github-pages-release-contract/u);
  assert.match(publicWorkflow, /actions\/download-artifact@v4/u);
  assert.match(publicWorkflow, /run-id: \$\{\{ github\.event\.workflow_run\.id \}\}/u);
  assert.match(publicWorkflow, /ISSUE_NUMBER: \$\{\{ steps\.release\.outputs\.issue_number \}\}/u);
  assert.doesNotMatch(publicWorkflow, /gh issue comment 37/u);
  assert.doesNotMatch(publicWorkflow, /0\.7\.0 GitHub Pages/u);
  assert.match(publicSmoke, /github-pages-version/u);
  assert.match(publicSmoke, /github-pages-request-id/u);
  assert.match(publicSmoke, /pageTitle\.includes\(expectedVersion\)/u);
  assert.match(publicSmoke, /httpErrors/u);
  assert.match(releaseWorkflow, /<title>西新世紀末物語｜アーリーアクセス版 \$VERSION<\/title>/u);
  assert.match(releaseWorkflow, /GITHUB_PAGES_EXPECTED_VERSION: \$\{\{ steps\.release\.outputs\.requested == 'true' && steps\.release\.outputs\.version \|\| '' \}\}/u);
  assert.match(pagesBuilder, /normalizeReleaseTitle\(html, releaseVersion\)/u);
  assert.match(pagesIdentity, /VERSIONED_PRODUCT_TITLE_PATTERN/u);
  assert.match(pagesIdentity, /source\.replace\(VERSIONED_PRODUCT_TITLE_PATTERN, expectedTitle\)/u);
  assert.match(await readFile("scripts/github-pages-smoke.mjs", "utf8"), /postInteractionTitle !== expectedTitle/u);
  assert.match(pagesBuilder, /github-pages-version/u);
  assert.match(pagesBuilder, /github-pages-request-id/u);
});
