import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  normalizeReleaseContract,
  readReleaseContract,
  releaseContractFromEnvironment,
} from "../scripts/release-contract.mjs";

const validContract = Object.freeze({
  operation: "release",
  deploy: false,
  version: "0.9.5",
  release_ref: "v0.9.5",
  release_sha: "1".repeat(40),
  issue_number: 96,
  request_id: "v0.9.5-formal-release-20260730",
});

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

function bashExecutable() {
  if (process.platform !== "win32") return "bash";
  const candidates = [
    process.env.GIT_BASH_EXE,
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
  ].filter(Boolean);
  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) throw new Error("Git Bash is required for strict-shell release contract tests on Windows");
  return executable;
}

test("release contract normalizes exactly the seven immutable request fields", () => {
  assert.deepEqual(normalizeReleaseContract(validContract), validContract);
  assert.deepEqual(normalizeReleaseContract({ ...validContract, release_ref: validContract.release_sha }), {
    ...validContract,
    release_ref: validContract.release_sha,
  });
});

test("release contract accepts redeploy with explicit deployment", () => {
  assert.deepEqual(normalizeReleaseContract({
    ...validContract,
    operation: "redeploy",
    deploy: true,
    version: "0.9.5.1",
    release_ref: "v0.9.5.1",
    issue_number: 111,
    request_id: "v0.9.5.1-formal-release-20260731",
  }), {
    ...validContract,
    operation: "redeploy",
    deploy: true,
    version: "0.9.5.1",
    release_ref: "v0.9.5.1",
    issue_number: 111,
    request_id: "v0.9.5.1-formal-release-20260731",
  });
});

test("release contract rejects missing, extra, mutable, and unsafe identities", () => {
  assert.throws(() => normalizeReleaseContract({ ...validContract, request_id: undefined }), /request_id/u);
  assert.throws(() => normalizeReleaseContract({ ...validContract, extra: true }), /unknown: extra/u);
  assert.throws(() => normalizeReleaseContract({ ...validContract, operation: "preview" }), /release or redeploy/u);
  assert.throws(() => normalizeReleaseContract({ ...validContract, deploy: "false" }), /boolean/u);
  assert.throws(() => normalizeReleaseContract({ ...validContract, version: "v0.9.5" }), /release version/u);
  assert.throws(() => normalizeReleaseContract({ ...validContract, release_ref: "main" }), /release_ref/u);
  assert.throws(() => normalizeReleaseContract({ ...validContract, release_sha: "A".repeat(40) }), /lowercase/u);
  assert.throws(() => normalizeReleaseContract({ ...validContract, issue_number: 0 }), /positive integer/u);
  assert.throws(() => normalizeReleaseContract({ ...validContract, request_id: "short" }), /8-128/u);
});

test("manual dispatch environment uses the same validator", () => {
  assert.deepEqual(releaseContractFromEnvironment({
    RELEASE_OPERATION: validContract.operation,
    RELEASE_DEPLOY: String(validContract.deploy),
    RELEASE_VERSION: validContract.version,
    RELEASE_REF: validContract.release_ref,
    RELEASE_SHA: validContract.release_sha,
    RELEASE_ISSUE_NUMBER: String(validContract.issue_number),
    RELEASE_REQUEST_ID: validContract.request_id,
  }), validContract);
});

test("strict shell preserves validated false and true deploy booleans with exit zero", async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "zombieee-release-contract-shell-"));
  try {
    for (const deploy of [false, true]) {
      const contractPath = path.join(tempRoot, `deploy-${deploy}.json`);
      await writeFile(contractPath, `${JSON.stringify({ ...validContract, deploy })}\n`, "utf8");
      const result = spawnSync(bashExecutable(), ["-c", [
        "set -euo pipefail",
        "deploy=\"$(node scripts/release-contract.mjs --file \"$CONTRACT_FILE\" --print-deploy)\"",
        "test \"$deploy\" = \"$EXPECTED_DEPLOY\"",
        "printf 'deploy=%s\\n' \"$deploy\"",
      ].join("; ")], {
        cwd: repositoryRoot,
        env: {
          ...process.env,
          CONTRACT_FILE: contractPath,
          EXPECTED_DEPLOY: String(deploy),
        },
        encoding: "utf8",
      });
      assert.equal(result.status, 0, `deploy=${deploy} failed strict shell: ${result.stderr}`);
      assert.equal(result.signal, null);
      assert.equal(result.stdout.trim(), `deploy=${deploy}`);
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("legacy checked-in request file is removed", () => {
  assert.equal(existsSync(".github/pages-release-request.json"), false);
});

test("release workflow is explicit, immutable, and deploy-gated", async () => {
  const releaseWorkflow = (await readFile(".github/workflows/github-pages-release.yml", "utf8")).replaceAll("\r\n", "\n");
  const publicWorkflow = (await readFile(".github/workflows/github-pages-public-qa.yml", "utf8")).replaceAll("\r\n", "\n");
  const releaseTrigger = releaseWorkflow.split("permissions:", 1)[0];
  const publicTrigger = publicWorkflow.split("permissions:", 1)[0];
  const publicSmoke = await readFile("scripts/github-pages-public-smoke.mjs", "utf8");
  const pagesBuilder = await readFile("scripts/build-github-pages.mjs", "utf8");
  const pagesIdentity = await readFile("scripts/pages-release-identity.mjs", "utf8");

  assert.match(releaseTrigger, /pull_request:/u);
  assert.match(releaseTrigger, /workflow_dispatch:/u);
  assert.doesNotMatch(releaseTrigger, /^\s+push:/mu);
  assert.doesNotMatch(releaseWorkflow, /pages-release-request\.json/u);
  for (const field of ["operation", "deploy", "version", "release_ref", "release_sha", "issue_number", "request_id"]) {
    assert.match(releaseWorkflow, new RegExp(`^      ${field}:`, "mu"));
  }
  assert.match(releaseWorkflow, /manual release dispatch must run from refs\/heads\/main/u);
  assert.match(releaseWorkflow, /select\(\.draft == false and \.prerelease == false\)/u);
  assert.match(releaseWorkflow, /source_dir=release-source/u);
  assert.match(releaseWorkflow, /--print-deploy/u);
  assert.match(publicWorkflow, /--print-deploy/u);
  assert.doesNotMatch(`${releaseWorkflow}\n${publicWorkflow}`, /jq -e[^\n]*\.deploy/u);
  assert.match(releaseWorkflow, /path: release-source/u);
  assert.match(releaseWorkflow, /node "\$GITHUB_WORKSPACE\/\$SOURCE_DIR\/scripts\/build-github-pages\.mjs"/u);
  assert.doesNotMatch(releaseWorkflow, /node scripts\/(?:build|github-pages)-/u);
  assert.match(releaseWorkflow, /- name: Verify GitHub Pages uses Actions\n\s+if: steps\.release\.outputs\.deploy == 'true'/u);
  assert.match(releaseWorkflow, /- name: Configure GitHub Pages\n\s+if: steps\.release\.outputs\.deploy == 'true'/u);
  assert.match(releaseWorkflow, /- name: Upload GitHub Pages artifact\n\s+if: steps\.release\.outputs\.deploy == 'true'/u);
  assert.match(releaseWorkflow, /\n  deploy:\n\s+if: needs\.build\.outputs\.deploy == 'true'/u);
  assert.match(releaseWorkflow, /name: github-pages-release-contract/u);
  assert.doesNotMatch(releaseTrigger, /\bwrite\b/u);

  assert.match(publicTrigger, /workflow_run:/u);
  assert.doesNotMatch(publicTrigger, /^\s+push:/mu);
  assert.match(publicWorkflow, /github\.event\.workflow_run\.event == 'workflow_dispatch'/u);
  assert.match(publicWorkflow, /actions\/download-artifact@v4/u);
  assert.match(publicWorkflow, /run-id: \$\{\{ github\.event\.workflow_run\.id \}\}/u);
  assert.match(publicWorkflow, /path: release-source/u);
  assert.match(publicWorkflow, /- name: Skip public QA for a validated dry-run\n\s+if: steps\.release\.outputs\.deploy != 'true'/u);
  assert.match(publicWorkflow, /- name: Checkout immutable deployed source\n\s+if: steps\.release\.outputs\.deploy == 'true'/u);
  assert.match(publicWorkflow, /- name: Install locked application dependencies\n\s+if: steps\.release\.outputs\.deploy == 'true'/u);
  assert.match(publicWorkflow, /- name: Install isolated browser runtime\n\s+if: steps\.release\.outputs\.deploy == 'true'/u);
  assert.match(publicWorkflow, /- name: Run published-site QA\n(?:\s+[^\n]+\n){0,2}\s+if: steps\.release\.outputs\.deploy == 'true'/u);
  assert.match(publicWorkflow, /node "\$GITHUB_WORKSPACE\/release-source\/scripts\/github-pages-public-smoke\.mjs"/u);
  assert.doesNotMatch(publicWorkflow, /node scripts\/github-pages-public-smoke\.mjs/u);
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

test("release contract file round-trips through the checked-in CLI shape", async () => {
  const tempPath = ".tmp-release-contract-test.json";
  try {
    await writeFile(tempPath, `${JSON.stringify(validContract)}\n`, "utf8");
    assert.deepEqual(await readReleaseContract(tempPath), validContract);
  } finally {
    await rm(tempPath, { force: true });
  }
});
