import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

import {
  classifyPwaUpdateCandidate,
  classifyPwaUpdatePaths,
  readChangedPaths,
  writeGitHubScopeResult,
} from "../scripts/classify-pwa-update-scope.mjs";

const BASE = "a".repeat(40);
const HEAD = "b".repeat(40);
const STATION_BASE = "044024d94d98c939930ef17f813b05a3fd33eee8";
const STATION_BASE_APP = execFileSync("git", ["show", `${STATION_BASE}:app/AshfallGame.tsx`], { maxBuffer: 32 * 1024 * 1024 });
const STATION_APPROVED_APP = execFileSync("git", ["show", "88bea5f0515bffa63b054e27f553cd818be46a9b:app/AshfallGame.tsx"], { maxBuffer: 32 * 1024 * 1024 });
const STATION_BASE_MANIFEST = execFileSync("git", ["show", `${STATION_BASE}:public/asset-manifest.json`], { maxBuffer: 4 * 1024 * 1024 });
const STATION_PATHS = [
  "app/AshfallGame.tsx",
  "tests/station-mission-native-pixels.test.mjs",
  "scripts/classify-pwa-update-scope.mjs",
];

function stationAuditRange(sourceBytes) {
  const sourceText = sourceBytes.toString("utf8");
  const sourceFile = ts.createSourceFile("fixture.tsx", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "stationMissionFinalCanvasAudit") matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  assert.equal(matches.length, 1);
  const start = Buffer.byteLength(sourceText.slice(0, matches[0].getStart(sourceFile)), "utf8");
  const end = Buffer.byteLength(sourceText.slice(0, matches[0].end), "utf8");
  return { start, end, body: sourceBytes.subarray(start, end) };
}

const approvedAuditFunction = stationAuditRange(STATION_APPROVED_APP).body;
const baseAuditRange = stationAuditRange(STATION_BASE_APP);
const STATION_CANDIDATE_APP = Buffer.concat([
  STATION_BASE_APP.subarray(0, baseAuditRange.start),
  approvedAuditFunction,
  STATION_BASE_APP.subarray(baseAuditRange.end),
]);

function stationGitFixture({ candidateApp = STATION_CANDIDATE_APP, candidateManifest = STATION_BASE_MANIFEST } = {}) {
  const blobs = new Map([
    [`${BASE}:app/AshfallGame.tsx`, STATION_BASE_APP],
    [`${HEAD}:app/AshfallGame.tsx`, candidateApp],
    [`${BASE}:public/asset-manifest.json`, STATION_BASE_MANIFEST],
    [`${HEAD}:public/asset-manifest.json`, candidateManifest],
  ]);
  let blobReads = 0;
  const runExecFile = async (file, args) => {
    if (args[0] === "rev-parse") return { stdout: `${args[2].slice(0, 40)}\n` };
    assert.equal(file, "git");
    assert.equal(args[0], "show");
    blobReads += 1;
    const result = blobs.get(args[1]);
    if (!result) throw new Error(`Unexpected test blob request: ${args[1]}`);
    return { stdout: result };
  };
  return { runExecFile, blobReads: () => blobReads };
}

test("only documentation, the existing CI workflow, and exact verification-only paths are inapplicable", () => {
  const excluded = [
    "docs/story/v10/PRODUCER_DECISIONS_FINAL_RELEASE.md",
    ".github/workflows/ci.yml",
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
  ];
  assert.equal(classifyPwaUpdatePaths(excluded).applicable, false);
});

test("runtime, near-match, unknown, and mixed changes remain applicable", () => {
  for (const changedPath of [
    "app/main.tsx",
    "public/assets/game.webp",
    "package.json",
    "package-lock.json",
    "vite.config.ts",
    "scripts/run-v0995-enemy-runtime-bounded-extra.mjs",
    "tests/playwright-container-runtime-copy.test.mjs",
    "scripts/unclassified-check.mjs",
  ]) {
    assert.equal(classifyPwaUpdatePaths([changedPath]).applicable, true, changedPath);
  }
  assert.equal(classifyPwaUpdatePaths([
    "scripts/run-v099-hud-states-bounded.mjs",
    "public/assets/game.webp",
  ]).applicable, true);
});

test("the one approved native-grid audit function change is inapplicable only with exact source and unchanged assets", async () => {
  const fixture = stationGitFixture();
  const result = await classifyPwaUpdateCandidate(BASE, HEAD, STATION_PATHS, fixture.runExecFile);
  assert.equal(result.applicable, false);
  assert.equal(fixture.blobReads(), 4);
});

test("runtime and unknown paths stay applicable even beside the approved station-audit delta", async () => {
  const fixture = stationGitFixture();
  for (const extraPath of ["public/assets/game.webp", "app/other-runtime.tsx", "scripts/unclassified.mjs"]) {
    const result = await classifyPwaUpdateCandidate(BASE, HEAD, [...STATION_PATHS, extraPath], fixture.runExecFile);
    assert.equal(result.applicable, true, extraPath);
  }
  assert.equal(fixture.blobReads(), 0, "mixed changes are rejected before checking the exception");
});

test("function edits outside the exact audited body keep PWA update QA applicable", async () => {
  const changedOutside = Buffer.from(STATION_CANDIDATE_APP.toString("utf8").replace(
    '"use client";', '"use client";\n// unrelated app change',
  ), "utf8");
  const fixture = stationGitFixture({ candidateApp: changedOutside });
  const result = await classifyPwaUpdateCandidate(BASE, HEAD, STATION_PATHS, fixture.runExecFile);
  assert.equal(result.applicable, true);
});

test("different old or candidate station-audit function hashes keep PWA update QA applicable", async () => {
  const wrongBase = Buffer.from(STATION_BASE_APP.toString("utf8").replace(
    "finalPaintedCount += 1;", "finalPaintedCount += 2;",
  ), "utf8");
  const oldFixture = stationGitFixture();
  const oldResult = await classifyPwaUpdateCandidate(BASE, HEAD, STATION_PATHS, async (file, args, options) => {
    if (args[0] === "show" && args[1] === `${BASE}:app/AshfallGame.tsx`) return { stdout: wrongBase };
    return oldFixture.runExecFile(file, args, options);
  });
  assert.equal(oldResult.applicable, true, "an unapproved base function is never exempted");

  const wrongCandidate = Buffer.from(STATION_CANDIDATE_APP.toString("utf8").replace(
    "scale: finalTransform.scale * dpr,", "scale: finalTransform.scale * dpr + 0,",
  ), "utf8");
  const candidateFixture = stationGitFixture({ candidateApp: wrongCandidate });
  const candidateResult = await classifyPwaUpdateCandidate(BASE, HEAD, STATION_PATHS, candidateFixture.runExecFile);
  assert.equal(candidateResult.applicable, true, "only the exact approved candidate function hash is exempted");
});

test("changed PWA asset manifest bytes keep the station-audit candidate applicable", async () => {
  const fixture = stationGitFixture({ candidateManifest: Buffer.concat([STATION_BASE_MANIFEST, Buffer.from(" ")]) });
  const result = await classifyPwaUpdateCandidate(BASE, HEAD, STATION_PATHS, fixture.runExecFile);
  assert.equal(result.applicable, true);
});

test("empty diffs and empty paths fail closed", () => {
  assert.throws(() => classifyPwaUpdatePaths([]), /empty diff/u);
  assert.throws(() => classifyPwaUpdatePaths([""]), /empty diff/u);
});

test("git receives only validated full commit SHAs and a NUL-delimited diff request", async () => {
  const calls = [];
  const fakeExecFile = async (file, args, options) => {
    calls.push({ file, args, options });
    if (args[0] === "rev-parse") return { stdout: `${args[2].slice(0, 40)}\n` };
    return { stdout: Buffer.from("docs/decision.md\0scripts/verify-playwright-container-runtime.mjs\0") };
  };
  const paths = await readChangedPaths(BASE, HEAD, fakeExecFile);
  assert.deepEqual(paths, ["docs/decision.md", "scripts/verify-playwright-container-runtime.mjs"]);
  assert.deepEqual(calls.map(({ file, args }) => [file, args]), [
    ["git", ["rev-parse", "--verify", `${BASE}^{commit}`]],
    ["git", ["rev-parse", "--verify", `${HEAD}^{commit}`]],
    ["git", ["diff", "--no-renames", "--name-only", "-z", `${BASE}...${HEAD}`]],
  ]);
  assert.equal(calls.every(({ options }) => (options.encoding === "utf8" || options.encoding === "buffer") && options.shell === false), true);
  await assert.rejects(() => readChangedPaths("HEAD", HEAD, fakeExecFile), /full 40-character/u);
});

test("a runtime-to-allowlisted-path rename still reports the runtime deletion", async () => {
  const renameDiff = async (file, args) => args[0] === "rev-parse"
    ? { stdout: `${args[2].slice(0, 40)}\n` }
    : { stdout: Buffer.from("app/runtime-entry.ts\0scripts/run-stage3-audio-bounded.mjs\0") };
  const changedPaths = await readChangedPaths(BASE, HEAD, renameDiff);
  assert.equal(classifyPwaUpdatePaths(changedPaths).applicable, true);
});

test("git diff errors and empty git diffs are reported instead of skipped", async () => {
  const noPaths = async (file, args) => args[0] === "rev-parse"
    ? { stdout: `${args[2].slice(0, 40)}\n` }
    : { stdout: Buffer.from("") };
  await assert.rejects(() => readChangedPaths(BASE, HEAD, noPaths), /no changed paths/u);

  const gitFailure = async (file, args) => {
    if (args[0] === "rev-parse") return { stdout: `${args[2].slice(0, 40)}\n` };
    throw new Error("git diff failed");
  };
  await assert.rejects(() => readChangedPaths(BASE, HEAD, gitFailure), /git diff failed/u);
});

test("GitHub outputs retain the expected output and summary formats", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "pwa-scope-"));
  try {
    const outputPath = path.join(directory, "output");
    const summaryPath = path.join(directory, "summary");
    writeGitHubScopeResult({ applicable: false, changedPaths: ["docs/decision.md"], outputPath, summaryPath });
    assert.equal(readFileSync(outputPath, "utf8"), "applicable=false\n");
    assert.equal(readFileSync(summaryPath, "utf8"), "PWA asset-update QA is inapplicable to a docs/workflow-only PR; the production build and browser checks still run.\n");

    writeGitHubScopeResult({
      applicable: false,
      changedPaths: ["scripts/verify-playwright-container-runtime.mjs"],
      outputPath,
      summaryPath,
    });
    assert.equal(readFileSync(outputPath, "utf8"), "applicable=false\napplicable=false\n");
    assert.match(readFileSync(summaryPath, "utf8"), /inapplicable to a verification-only PR/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
