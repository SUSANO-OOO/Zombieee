import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  classifyPwaUpdatePaths,
  readChangedPaths,
  writeGitHubScopeResult,
} from "../scripts/classify-pwa-update-scope.mjs";

const BASE = "a".repeat(40);
const HEAD = "b".repeat(40);

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
