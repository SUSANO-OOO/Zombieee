import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { onlyAbortedStaticStreams } from "../scripts/v099-final-bounded-contract.mjs";

test("CI is a pull-request-only, fail-closed PR Verify workflow", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  const finalBoundedRunner = await readFile("scripts/run-v099-final-bounded.mjs", "utf8");
  const trigger = workflow.split("permissions:", 1)[0];
  assert.match(trigger, /pull_request:/u);
  assert.match(trigger, /- main/u);
  assert.match(trigger, /- "integration\/\*\*"/u);
  assert.doesNotMatch(trigger, /^\s+push:/mu);
  assert.doesNotMatch(trigger, /workflow_dispatch/u);
  assert.match(workflow, /name: PR Verify/u);
  assert.match(workflow, /fetch-depth: 0/u);
  assert.match(workflow, /PR_BASE_SHA/u);
  assert.match(workflow, /PR_HEAD_SHA/u);
  assert.match(workflow, /PR_BASE_REF/u);
  assert.match(workflow, /git merge-base --is-ancestor "\$PR_BASE_SHA" "\$PR_MERGE_SHA"/u);
  assert.match(workflow, /git merge-base --is-ancestor "\$PR_HEAD_SHA" "\$PR_MERGE_SHA"/u);
  assert.match(workflow, /git diff --check "\$PR_BASE_SHA\.\.\.\$PR_HEAD_SHA"/u);
  const install = workflow.indexOf("run: npm ci");
  const lint = workflow.indexOf("run: npm run lint");
  const content = workflow.indexOf("run: npm run content:validate");
  const tests = workflow.indexOf("run: npm test");
  assert.ok(install >= 0 && install < lint && lint < content && content < tests);
  assert.match(workflow, /name: pr-verify-provenance/u);
  assert.match(workflow, /932x430/u);
  assert.doesNotMatch(workflow, /PWA_PARTIAL_UPDATE_OLD_VERSION:\s*0\.9\.9\.\d+/u);
  assert.doesNotMatch(workflow, /contents:\s*write/u);
  assert.doesNotMatch(workflow, /gh pr merge|gh pr edit|github-script/u);
  assert.match(workflow, /v0995-enemy-runtime-browser-smoke\.mjs/u);
  assert.match(workflow, /v0995-visual-integrity-browser-smoke\.mjs/u);
  assert.match(workflow, /V0995_ENEMY_QA_ENGINES: chromium/u);
  assert.match(workflow, /V0995_VISUAL_QA_ENGINES: chromium/u);
  assert.match(workflow, /V0995_ENEMY_QA_ENGINES: webkit/u);
  assert.match(workflow, /V0995_VISUAL_QA_ENGINES: webkit/u);
  assert.match(workflow, /run-v099-final-bounded\.mjs/u);
  assert.match(finalBoundedRunner, /attempt <= 2/u);
  const finalBoundedContract = await readFile("scripts/v099-final-bounded-contract.mjs", "utf8");
  assert.match(finalBoundedContract, /summary\.failed === summary\.total/u);
  assert.match(finalBoundedContract, / :: net::ERR_ABORTED\$\/u/u);
  assert.match(finalBoundedContract, /consoleErrors[\s\S]*pageErrors[\s\S]*httpErrors/u);
  assert.doesNotMatch(finalBoundedRunner, /status:\s*"(?:skipped|unavailable)"/u);
  const enemyBatches = [...workflow.matchAll(/"([a-z-]+(?:,[a-z-]+){4,5})"/gu)]
    .map(([, batch]) => batch).filter((batch) => batch.includes(","));
  assert.deepEqual(enemyBatches.flatMap((batch) => batch.split(",")), [
    "walker", "runner", "spitter", "crusher", "shade", "abomination",
    "turned", "takuya", "grappler", "ooze", "sprinter", "gate-eater",
    "kurome", "mother", "ooguchi", "gairen", "futago", "resonator",
    "cagewalker", "spindle", "choir-knot", "pall-manta", "anchor-bloom",
  ]);
  assert.match(workflow, /V0995_ENEMY_QA_KINDS/u);
  assert.match(workflow, /name: issue165-visual-remediation-evidence[\s\S]*retention-days: 14/u);
  assert.match(workflow, /name: issue165-webkit-visual-remediation-evidence[\s\S]*retention-days: 14/u);
});

test("Stage 3 final uses one bounded fixture for candidate and exact PR base", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  const p5Smoke = await readFile("scripts/p5-browser-smoke.mjs", "utf8");
  const boundedRunner = await readFile("scripts/run-stage3-final-bounded.mjs", "utf8");
  assert.match(workflow, /Build exact PR base for the same bounded final fixture/);
  assert.match(workflow, /git worktree add --detach "\$base_source" "\$PR_BASE_SHA"/);
  assert.match(workflow, /npm ci[\s\S]*npm run build/);
  assert.match(workflow, /run-stage3-final-bounded\.mjs "\$RUNNER_TEMP\/stage3-final-base"/);
  assert.match(boundedRunner, /attempt <= 2/);
  assert.match(boundedRunner, /Target page, context or browser has been closed/);
  assert.match(boundedRunner, /failure\.failureState \?\? failure\.setupDiagnostics\?\.stableState/);
  assert.match(boundedRunner, /state\?\.assetReadiness\?\.state === "ready"/);
  assert.match(boundedRunner, /emptyDiagnostics\(failure\.diagnostics\)/);
  assert.doesNotMatch(boundedRunner, /P5_QA_TIMEOUT_MS.*\+|status:\s*"(?:skipped|unavailable)"/u);
  assert.match(p5Smoke, /const compactSnapshot = \{/);
  assert.match(p5Smoke, /if \(samples\.length > 1_200\)/);
  assert.match(p5Smoke, /stage3Progress\(label, "complete"/);
  assert.match(p5Smoke, /boundedPageCall\([\s\S]*story battle samples/);
  assert.doesNotMatch(p5Smoke, /samples\.push\(\{[\s\S]{0,400}\bsnapshot,\s*\}\)/);
});

test("bounded HUD retry is fail-closed to an all-axis request-abort incident", () => {
  const aborted = {
    total: 2,
    failed: 2,
    results: ["ranger", "medic"].map((asset) => ({
      status: "failed",
      error: "Browser diagnostics were not clean: {...}",
      diagnostics: {
        consoleErrors: [], pageErrors: [], httpErrors: [],
        requestFailures: [`http://127.0.0.1/art/${asset}.png :: net::ERR_ABORTED`],
      },
    })),
  };
  assert.equal(onlyAbortedStaticStreams(aborted), true);
  assert.equal(onlyAbortedStaticStreams({ ...aborted, failed: 1 }), false);
  assert.equal(onlyAbortedStaticStreams({
    ...aborted,
    results: [{ ...aborted.results[0], diagnostics: { ...aborted.results[0].diagnostics, consoleErrors: ["product"] } }, aborted.results[1]],
  }), false);
  assert.equal(onlyAbortedStaticStreams({
    ...aborted,
    results: [{ ...aborted.results[0], diagnostics: { ...aborted.results[0].diagnostics, requestFailures: ["asset :: net::ERR_FAILED"] } }, aborted.results[1]],
  }), false);
});
