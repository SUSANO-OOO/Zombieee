import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { onlyAbortedStaticStreams } from "../scripts/v099-final-bounded-contract.mjs";

test("CI is a pull-request-only, fail-closed PR Verify workflow", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  const finalBoundedRunner = await readFile("scripts/run-v099-final-bounded.mjs", "utf8");
  const pagesBoundedRunner = await readFile("scripts/run-v099-final-bounded-against-pages.mjs", "utf8");
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
  assert.match(workflow, /run-v099-final-bounded-against-pages\.mjs _site/u);
  assert.match(workflow, /for viewport in 667x375 736x414 844x390 844x340 932x430 1280x720/u);
  assert.match(workflow, /V099_FINAL_REMEDIATION_QA_VIEWPORTS="\$viewport"/u);
  assert.match(workflow, /ISSUE156_WEBKIT_DEPLOYMENT_EVIDENCE_ROOT:/u);
  assert.match(workflow, /node scripts\/run-v099-deployment-units-bounded\.mjs/u);
  assert.match(workflow, /ISSUE156_WEBKIT_HUD_EVIDENCE_ROOT:/u);
  assert.match(workflow, /node scripts\/run-v099-hud-states-bounded\.mjs/u);
  const hudJob = workflow.match(/  webkit-viewport:\n([\s\S]*?)\n  webkit-deployment-viewport:/u)?.[1] ?? "";
  const hudViewports = hudJob.match(/viewport:\r?\n([\s\S]*?)\r?\n        hud_state:/u)?.[1]
    .match(/^\s+- ([0-9]+x[0-9]+)$/gmu)?.map((line) => line.trim().slice(2)) ?? [];
  const hudStates = hudJob.match(/hud_state:\r?\n([\s\S]*?)\r?\n\r?\n    steps:/u)?.[1]
    .match(/^\s+- ([a-z0-9-]+)$/gmu)?.map((line) => line.trim().slice(2)) ?? [];
  assert.deepEqual(hudViewports, ["667x375", "736x414", "844x390", "844x340", "932x430", "1280x720"]);
  assert.deepEqual(hudStates, [
    "stage1-normal", "five-units", "deployment-banner", "manual-ability-banner",
    "objective-full", "support-disabled", "banner-bark-boss", "stage3-boss",
  ]);
  assert.equal(hudViewports.length * hudStates.length, 48);
  assert.match(hudJob, /ISSUE156_WEBKIT_HUD_STATE: \$\{\{ matrix\.hud_state \}\}/u);
  assert.match(hudJob, /needs: webkit-deployment-viewport/u);
  assert.match(hudJob, /fail-fast: false/u);
  assert.match(hudJob, /max-parallel: 4/u);
  assert.doesNotMatch(hudJob, /continue-on-error:/u);
  const deploymentJob = workflow.match(/  webkit-deployment-viewport:\n([\s\S]*?)\n  webkit-stage3-audio:/u)?.[1] ?? "";
  const deploymentViewports = deploymentJob.match(/viewport:\r?\n([\s\S]*?)\r?\n    steps:/u)?.[1]
    .match(/^\s+- ([0-9]+x[0-9]+)$/gmu)?.map((line) => line.trim().slice(2)) ?? [];
  assert.deepEqual(deploymentViewports, ["667x375", "736x414", "844x390", "844x340", "932x430", "1280x720"]);
  assert.match(deploymentJob, /needs: webkit-stage3-audio/u);
  assert.match(deploymentJob, /fail-fast: false/u);
  assert.match(deploymentJob, /max-parallel: 2/u);
  assert.doesNotMatch(deploymentJob, /continue-on-error:/u);
  const enemyJob = workflow.match(/  webkit-enemy-runtime-shard:\n([\s\S]*?)\n  webkit-viewport:/u)?.[1] ?? "";
  assert.match(enemyJob, /fail-fast: false/u);
  assert.match(enemyJob, /max-parallel: 2/u);
  assert.doesNotMatch(enemyJob, /continue-on-error:/u);
  const hostedJob = workflow.match(/  webkit-hosted:\n([\s\S]*?)\n  webkit-enemy-runtime-shard:/u)?.[1] ?? "";
  assert.match(hostedJob, /needs: webkit-enemy-runtime-shard/u);
  assert.doesNotMatch(hostedJob, /continue-on-error:/u);
  const stage3Job = workflow.match(/  webkit-stage3-audio:\n([\s\S]*)$/u)?.[1] ?? "";
  assert.match(stage3Job, /needs: webkit-hosted/u);
  assert.match(stage3Job, /fail-fast: false/u);
  assert.match(stage3Job, /max-parallel: 1/u);
  assert.doesNotMatch(stage3Job, /continue-on-error:/u);
  assert.doesNotMatch(stage3Job, /npm run qa:p5/u);
  assert.equal((stage3Job.match(/node scripts\/run-stage3-audio-bounded\.mjs/gmu) ?? []).length, 2);
  assert.match(await readFile("scripts/v099-final-remediation-browser-smoke.mjs", "utf8"), /qaHudFiniteAssets/);
  assert.match(workflow, /name: WebKit Enemy Runtime Evidence \(\$\{\{ matrix\.shard\.name \}\}\)/);
  assert.match(workflow, /viewports=\(844x340 844x390 1280x720\)/);
  assert.match(workflow, /for viewport in "\$\{viewports\[@\]\}"; do/);
  assert.match(workflow, /V0995_ENEMY_QA_KINDS="\$kind"/);
  assert.match(workflow, /V0995_ENEMY_QA_VIEWPORTS="\$viewport"/);
  assert.match(workflow, /enemy-runtime\/webkit\/\$\{\{ matrix\.shard\.name \}\}\/\$kind\/\$viewport/);
  assert.match(workflow, /node scripts\/run-v0995-enemy-runtime-bounded\.mjs/u);
  assert.doesNotMatch(workflow, /V0995_ENEMY_QA_KINDS="\$\{batches\[\$index\]\}"/);
  assert.match(finalBoundedRunner, /attempt <= 2/u);
  assert.match(finalBoundedRunner, /V099_FINAL_REMEDIATION_QA_BASE_URL/u);
  assert.match(pagesBoundedRunner, /github-pages-version/u);
  assert.match(pagesBoundedRunner, /github-pages-release/u);
  assert.match(pagesBoundedRunner, /github-pages-base/u);
  assert.match(pagesBoundedRunner, /manifest\.releaseSha !== expectedReleaseSha/u);
  assert.match(pagesBoundedRunner, /V099_FINAL_REMEDIATION_QA_BASE_URL: baseUrl/u);
  const finalBoundedContract = await readFile("scripts/v099-final-bounded-contract.mjs", "utf8");
  assert.match(finalBoundedContract, /summary\.failed === summary\.total/u);
  assert.match(finalBoundedContract, / :: net::ERR_ABORTED\$\/u/u);
  assert.match(finalBoundedContract, /consoleErrors[\s\S]*pageErrors[\s\S]*httpErrors/u);
  assert.doesNotMatch(finalBoundedRunner, /status:\s*"(?:skipped|unavailable)"/u);
  const shardJob = workflow.match(/  webkit-enemy-runtime-shard:\n([\s\S]*?)\n  webkit-viewport:/u)?.[1] ?? "";
  const shardKindLists = [...shardJob.matchAll(/^\s+kinds: "([^"]+)"$/gmu)]
    .map((match) => match[1].trim().split(/\s+/u));
  assert.equal(shardKindLists.length, 6);
  assert.ok(shardKindLists.every((kinds) => kinds.length > 0 && kinds.length <= 4));
  const kindList = shardKindLists.flat();
  assert.deepEqual(kindList, [
    "walker", "runner", "spitter", "crusher", "shade", "abomination",
    "turned", "takuya", "grappler", "ooze", "sprinter", "gate-eater",
    "kurome", "mother", "ooguchi", "gairen", "futago", "resonator",
    "cagewalker", "spindle", "choir-knot", "pall-manta", "anchor-bloom",
  ]);
  assert.equal(new Set(kindList).size, kindList.length);
  assert.match(shardJob, /fail-fast: false/u);
  assert.doesNotMatch(shardJob, /continue-on-error:/u);
  assert.match(shardJob, /name: issue165-webkit-enemy-runtime-\$\{\{ matrix\.shard\.name \}\}/u);
  const enemyBoundedRunner = await readFile("scripts/run-v0995-enemy-runtime-bounded.mjs", "utf8");
  assert.match(enemyBoundedRunner, /attempt <= maxAttempts/u);
  assert.match(enemyBoundedRunner, /maxAttempts !== 2/u);
  assert.match(enemyBoundedRunner, /isRetryableTargetClosedLog/u);
  assert.match(enemyBoundedRunner, /attempt-\$\{attempt\}/u);
  assert.doesNotMatch(enemyBoundedRunner, /status:\s*"(?:skipped|unavailable)"|continue-on-error/u);
  const deploymentBoundedRunner = await readFile("scripts/run-v099-deployment-units-bounded.mjs", "utf8");
  for (const kind of ["scout", "ranger", "brawler", "crazy-king", "kumaverson", "mayo-chan", "brute", "medic"]) {
    assert.match(deploymentBoundedRunner, new RegExp(`"${kind}"`, "u"));
  }
  assert.match(deploymentBoundedRunner, /attempt <= 2/u);
  assert.match(deploymentBoundedRunner, /isRetryableTargetClosedLog/u);
  assert.match(deploymentBoundedRunner, /checkpoints\?\.length === 6/u);
  assert.match(deploymentBoundedRunner, /new Set\(kinds\)\.size !== kinds\.length/u);
  assert.doesNotMatch(deploymentBoundedRunner, /status:\s*"(?:skipped|unavailable)"|continue-on-error/u);
  const hudBoundedRunner = await readFile("scripts/run-v099-hud-states-bounded.mjs", "utf8");
  for (const stateId of [
    "stage1-normal", "five-units", "deployment-banner", "manual-ability-banner",
    "objective-full", "support-disabled", "banner-bark-boss", "stage3-boss",
  ]) {
    assert.match(hudBoundedRunner, new RegExp(`"${stateId}"`, "u"));
  }
  assert.match(hudBoundedRunner, /attempt <= 2/u);
  assert.match(hudBoundedRunner, /isRetryableTargetClosedLog/u);
  assert.match(hudBoundedRunner, /new Set\(stateIds\)\.size !== stateIds\.length/u);
  assert.match(hudBoundedRunner, /result\.states\?\.length === 1/u);
  assert.doesNotMatch(hudBoundedRunner, /status:\s*"(?:skipped|unavailable)"|continue-on-error/u);
  assert.match(workflow, /V0995_ENEMY_QA_KINDS/u);
  assert.match(workflow, /name: issue165-visual-remediation-evidence[\s\S]*retention-days: 14/u);
  assert.match(workflow, /name: issue165-webkit-visual-remediation-evidence[\s\S]*retention-days: 14/u);
});

test("Stage 3 final uses one bounded fixture for candidate and exact PR base", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
  const p5Smoke = await readFile("scripts/p5-browser-smoke.mjs", "utf8");
  const boundedRunner = await readFile("scripts/run-stage3-audio-bounded.mjs", "utf8");
  assert.match(workflow, /Build exact PR base for the same bounded final fixture/);
  assert.match(workflow, /git worktree add --detach "\$base_source" "\$PR_BASE_SHA"/);
  assert.match(workflow, /npm ci[\s\S]*npm run build/);
  assert.match(workflow, /run-stage3-audio-bounded\.mjs "\$RUNNER_TEMP\/stage3-final-base"/);
  const stage3Job = workflow.match(/  webkit-stage3-audio:\r?\n([\s\S]*)$/u)?.[1] ?? "";
  assert.match(stage3Job, /- entrance-candidate[\s\S]*- final-candidate[\s\S]*- final-base/u);
  assert.equal((stage3Job.match(/- final-base/gmu) ?? []).length, 1);
  assert.match(stage3Job, /Build exact PR base[\s\S]*if: matrix\.audio_case == 'final-base'/u);
  assert.doesNotMatch(stage3Job, /continue-on-error:/u);
  assert.match(boundedRunner, /attempt <= 2/);
  assert.match(boundedRunner, /isRetryableTargetClosedLog\(failure\.error/);
  assert.match(boundedRunner, /failure\.phase === "navigation"[\s\S]*setupState/u);
  assert.match(boundedRunner, /state\?\.assetReadiness\?\.state === "ready"/);
  assert.match(boundedRunner, /emptyDiagnostics\(failure\.diagnostics\)/);
  assert.doesNotMatch(boundedRunner, /P5_QA_TIMEOUT_MS.*\+|status:\s*"(?:skipped|unavailable)"/u);
  assert.match(p5Smoke, /const compactSnapshot = \{/);
  assert.match(p5Smoke, /if \(samples\.length > 1_200\)/);
  assert.match(p5Smoke, /stage3Progress\(label, "complete"/);
  assert.match(p5Smoke, /boundedPageCall\([\s\S]*story battle samples/);
  assert.match(p5Smoke, /auditTakuyaEntranceAudio[\s\S]*stage3Progress\(label, "teardown-start"[\s\S]*closePlaywrightResource\(page, `\$\{label\}\/page`\)/);
  assert.doesNotMatch(p5Smoke, /await (?:page|storyPage|storyContext|lifecycleContext)\.close\(\)/);
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
