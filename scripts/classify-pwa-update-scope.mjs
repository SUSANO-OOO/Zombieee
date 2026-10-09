import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import ts from "typescript";

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
  "tests/station-mission-native-pixels.test.mjs",
]);

const STATION_AUDIT_APP_PATH = "app/AshfallGame.tsx";
const STATION_AUDIT_TEST_PATH = "tests/station-mission-native-pixels.test.mjs";
const STATION_AUDIT_BASE_FUNCTION_SHA256 = "8e04c566df962e77c81d31b338653eda37d069581ae6cd8d2d8613394a6dadc2";
const STATION_AUDIT_APPROVED_FUNCTION_SHA256 = "7739a897c5e1ff77525a59acd0b1634a4222de03984d28478d1f2d1182502e6d";
const STATION_AUDIT_ASSET_MANIFEST_PATH = "public/asset-manifest.json";

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

function stationAuditFunctionRange(sourceBytes) {
  const sourceText = sourceBytes.toString("utf8");
  if (!Buffer.from(sourceText, "utf8").equals(sourceBytes)) return null;
  const sourceFile = ts.createSourceFile("app/AshfallGame.tsx", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (sourceFile.parseDiagnostics.length > 0) return null;
  const matches = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "stationMissionFinalCanvasAudit") matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (matches.length !== 1) return null;
  const start = Buffer.byteLength(sourceText.slice(0, matches[0].getStart(sourceFile)), "utf8");
  const end = Buffer.byteLength(sourceText.slice(0, matches[0].end), "utf8");
  return {
    prefix: sourceBytes.subarray(0, start),
    body: sourceBytes.subarray(start, end),
    suffix: sourceBytes.subarray(end),
  };
}

async function readCommitBlob(commitSha, filePath, runExecFile) {
  const { stdout } = await runExecFile("git", ["show", `${commitSha}:${filePath}`], {
    encoding: "buffer",
    maxBuffer: 32 * 1024 * 1024,
    shell: false,
    windowsHide: true,
  });
  return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
}

async function isExactStationAuditException(baseSha, headSha, runExecFile) {
  await verifyCommitSha(baseSha, "PR_BASE_SHA", runExecFile);
  await verifyCommitSha(headSha, "PR_HEAD_SHA", runExecFile);
  const [baseApp, candidateApp, baseManifest, candidateManifest] = await Promise.all([
    readCommitBlob(baseSha, STATION_AUDIT_APP_PATH, runExecFile),
    readCommitBlob(headSha, STATION_AUDIT_APP_PATH, runExecFile),
    readCommitBlob(baseSha, STATION_AUDIT_ASSET_MANIFEST_PATH, runExecFile),
    readCommitBlob(headSha, STATION_AUDIT_ASSET_MANIFEST_PATH, runExecFile),
  ]);
  const before = stationAuditFunctionRange(baseApp);
  const after = stationAuditFunctionRange(candidateApp);
  if (!before || !after) return false;
  const beforeSha256 = createHash("sha256").update(before.body).digest("hex");
  const afterSha256 = createHash("sha256").update(after.body).digest("hex");
  return beforeSha256 === STATION_AUDIT_BASE_FUNCTION_SHA256
    && afterSha256 === STATION_AUDIT_APPROVED_FUNCTION_SHA256
    && before.prefix.equals(after.prefix)
    && before.suffix.equals(after.suffix)
    && baseManifest.equals(candidateManifest);
}

export async function classifyPwaUpdateCandidate(baseSha, headSha, changedPaths, runExecFile = execFileAsync) {
  if (!Array.isArray(changedPaths) || changedPaths.length === 0 || changedPaths.some((changedPath) => typeof changedPath !== "string" || changedPath.length === 0)) {
    throw new Error("PWA update scope cannot classify an empty diff or empty path");
  }
  const appPathCount = changedPaths.filter((changedPath) => changedPath === STATION_AUDIT_APP_PATH).length;
  if (appPathCount === 0) return classifyPwaUpdatePaths(changedPaths);
  if (appPathCount !== 1 || !changedPaths.includes(STATION_AUDIT_TEST_PATH)) {
    return Object.freeze({ applicable: true, changedPaths: Object.freeze([...changedPaths]) });
  }
  const otherApplicablePaths = changedPaths.filter((changedPath) => changedPath !== STATION_AUDIT_APP_PATH)
    .filter(isPwaUpdatePathApplicable);
  if (otherApplicablePaths.length > 0) {
    return Object.freeze({ applicable: true, changedPaths: Object.freeze([...changedPaths]) });
  }
  const exactException = await isExactStationAuditException(baseSha, headSha, runExecFile);
  return Object.freeze({ applicable: !exactException, changedPaths: Object.freeze([...changedPaths]) });
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
  const result = await classifyPwaUpdateCandidate(baseSha, headSha, paths);
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
