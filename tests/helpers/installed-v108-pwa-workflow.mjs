import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { load } from "js-yaml";

const introducedAt = "ffb10d5966cd7ff671480172e798d168e7808a97";
const jobName = "v100-native-webkit-pwa";
const addedNames = [
  "Build the installed 1.0.8 baseline for native WebKit update recovery",
  "Verify native WebKit partial-download recovery from installed 1.0.8",
];
const introduced = load(execFileSync("git", ["show", `${introducedAt}:.github/workflows/ci.yml`], {
  encoding: "utf8", windowsHide: true,
}));
const expected = introduced.jobs[jobName].steps.filter((step) => addedNames.includes(step.name));
assert.equal(expected.length, 2);

// The historical guards still compare every original command and deadline.
// Exclude only these two exact, immutable additions after validating them.
export function assertAndRemoveV108StepsForLegacyComparison(workflow) {
  const job = workflow.jobs[jobName];
  assert.equal(job["timeout-minutes"], 90);
  const index = job.steps.findIndex((step) => step.name === addedNames[0]);
  assert.ok(index > 0);
  assert.deepEqual(job.steps.slice(index, index + 2), expected);
  assert.equal(job.steps[index - 1].name, "Verify native WebKit partial-download failure and recovery");
  assert.equal(job.steps[index + 2].name, "Preserve active play when an installed asset needs repair");
  job.steps.splice(index, 2);
}
