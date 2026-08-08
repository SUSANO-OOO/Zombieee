import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("CI is a pull-request-only, fail-closed PR Verify workflow", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8");
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
  assert.doesNotMatch(workflow, /contents:\s*write/u);
  assert.doesNotMatch(workflow, /gh pr merge|gh pr edit|github-script/u);
});
