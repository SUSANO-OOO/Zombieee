import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const VERIFICATION_ONLY_PATHS = new Set([
  "scripts/classify-pwa-update-scope.mjs",
  "scripts/verify-playwright-container-runtime.mjs",
  "scripts/run-v0995-enemy-runtime-bounded.mjs",
  "scripts/run-v099-deployment-units-bounded.mjs",
  "scripts/run-v099-hud-states-bounded.mjs",
  "scripts/run-stage3-audio-bounded.mjs",
  "tests/pwa-update-scope-classifier.test.mjs",
  "tests/playwright-container-runtime.test.mjs",
  "tests/v0995-enemy-runtime-bounded.test.mjs",
  "tests/v099-deployment-units-bounded.test.mjs",
  "tests/v099-hud-states-bounded.test.mjs",
  "tests/stage3-final-bounded.test.mjs",
  "tests/ci-contract.test.mjs",
]);

function assertFullCommitSha(value, name) {
  assert.match(value ?? "", /^[0-9a-f]{40}$/iu, `${name} must be a full 40-character commit SHA`);
}

async function verifyCommitSha(sha, name, runExecFile = execFileAsync) {
  assertFullCommitSha(sha, name);
  const { stdout } = await runExecFile("git", ["rev-parse", "--verify", `${sha}^{commit}`], {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  const resolved = String(stdout).trim();
  assert.equal(resolved.toLowerCase(), sha.toLowerCase(), `${name} did not resolve to the supplied commit SHA`);
}

export function isPwaUpdatePathApplicable(changedPath) {
  if (changedPath.startsWith("docs/")) return false;
  if (changedPath === ".github/workflows/ci.yml") return false;
  if (VERIFICATION_ONLY_PATHS.has(changedPath)) return false;
  return true;
}

export function classifyPwaUpdatePaths(changedPaths) {
  if (!Array.isArray(changedPaths) || changedPaths.length === 0 || changedPaths.some((path) => path.length === 0)) {
    throw new Error("PWA update scope cannot classify an empty diff or empty path");
  }
  return Object.freeze({
    applicable: changedPaths.some(isPwaUpdatePathApplicable),
    changedPaths: Object.freeze([...changedPaths]),
  });
}

export async function readChangedPaths(baseSha, headSha, runExecFile = execFileAsync) {
  await verifyCommitSha(baseSha, "PR_BASE_SHA", runExecFile);
  await verifyCommitSha(headSha, "PR_HEAD_SHA", runExecFile);
  const { stdout } = await runExecFile("git", ["diff", "--no-renames", "--name-only", "-z", `${baseSha}...${headSha}`], {
    encoding: "buffer",
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
    windowsHide: true,
  });
  const paths = (Buffer.isBuffer(stdout) ? stdout.toString("utf8") : String(stdout)).split("\0").filter(Boolean);
  if (paths.length === 0) throw new Error("PR has no changed paths");
  return paths;
}

export function writeGitHubScopeResult({ applicable, changedPaths, outputPath, summaryPath }) {
  assert.equal(typeof applicable, "boolean");
  assert.ok(Array.isArray(changedPaths) && changedPaths.length > 0, "changed paths are required");
  assert.ok(outputPath, "GITHUB_OUTPUT is required");
  assert.ok(summaryPath, "GITHUB_STEP_SUMMARY is required");
  appendFileSync(outputPath, `applicable=${applicable}\n`, "utf8");
  if (!applicable) {
    const docsWorkflowOnly = changedPaths.every((changedPath) => (
      changedPath.startsWith("docs/") || changedPath === ".github/workflows/ci.yml"
    ));
    const message = docsWorkflowOnly
      ? "PWA asset-update QA is inapplicable to a docs/workflow-only PR; the production build and browser checks still run.\n"
      : "PWA asset-update QA is inapplicable to a verification-only PR; the production build and browser checks still run.\n";
    appendFileSync(summaryPath, message, "utf8");
  }
}

async function main() {
  const baseSha = process.env.PR_BASE_SHA;
  const headSha = process.env.PR_HEAD_SHA;
  const paths = await readChangedPaths(baseSha, headSha);
  const result = classifyPwaUpdatePaths(paths);
  writeGitHubScopeResult({
    applicable: result.applicable,
    changedPaths: result.changedPaths,
    outputPath: process.env.GITHUB_OUTPUT,
    summaryPath: process.env.GITHUB_STEP_SUMMARY,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
