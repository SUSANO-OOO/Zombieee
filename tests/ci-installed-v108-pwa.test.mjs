import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { load } from "js-yaml";
import { assertAndRemoveV108StepsForLegacyComparison } from "./helpers/installed-v108-pwa-workflow.mjs";

const current = () => load(readFileSync(".github/workflows/ci.yml", "utf8"));

test("the installed 1.0.8 checks are explicit additions and keep the old recovery checks", () => {
  const workflow = current();
  const originalCount = workflow.jobs["v100-native-webkit-pwa"].steps.length;
  assertAndRemoveV108StepsForLegacyComparison(workflow);
  const job = workflow.jobs["v100-native-webkit-pwa"];
  assert.equal(job.steps.length, originalCount - 2);
  assert.ok(job.steps.some((step) => step.name === "Verify native WebKit partial-download failure and recovery"));
  assert.ok(job.steps.some((step) => step.name === "Preserve active play when an installed asset needs repair"));
});

test("missing checks, changed baseline, weakened commands and raised limits reject normalization", () => {
  for (const change of [
    (job, index) => job.steps.splice(index, 1),
    (job, index) => { job.steps[index].run = job.steps[index].run.replace("9868f75a", "00000000"); },
    (job, index) => { job.steps[index].run = job.steps[index].run.replace('cmp package-lock.json "$old_source/package-lock.json"', "true"); },
    (job, index) => { job.steps[index + 1].env.PWA_PARTIAL_UPDATE_OLD_VERSION = "1.0.7"; },
    (job) => { job["timeout-minutes"] = 91; },
  ]) {
    const workflow = current();
    const job = workflow.jobs["v100-native-webkit-pwa"];
    const index = job.steps.findIndex((step) => step.id === "build_v108_partial_pwa_site");
    change(job, index);
    assert.throws(() => assertAndRemoveV108StepsForLegacyComparison(workflow));
  }
});
