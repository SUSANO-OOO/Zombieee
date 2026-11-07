import assert from "node:assert/strict";
import test from "node:test";
import { validatePublicQaSourceRun, validatePublicQaContractMode } from "../scripts/github-pages-public-qa-source.mjs";

const run = { id: 42, repository: { full_name: "owner/game" }, path: ".github/workflows/github-pages-release.yml", name: "GitHub Pages Release", event: "workflow_dispatch", head_branch: "main", status: "completed", conclusion: "success", head_sha: "1".repeat(40) };
const options = { requestedId: "42", repository: "owner/game", qaToolSha: "2".repeat(40) };
test("recheck binds a successful deployment separately from the reviewed QA tool commit", () => {
  assert.deepEqual(validatePublicQaSourceRun(run, options), { id: 42, url: "https://github.com/owner/game/actions/runs/42", controlPlaneSha: run.head_sha, qaToolSha: options.qaToolSha });
});
test("manual checks cannot turn a dry-run into a public success", () => {
  assert.doesNotThrow(() => validatePublicQaContractMode({ deploy: true }, "workflow_dispatch"));
  assert.throws(() => validatePublicQaContractMode({ deploy: false }, "workflow_dispatch"));
  assert.doesNotThrow(() => validatePublicQaContractMode({ deploy: false }, "workflow_run"));
  assert.throws(() => validatePublicQaContractMode({ deploy: true }, "pull_request"));
});
test("previews, failed runs, foreign repositories and untrusted identifiers fail closed", () => {
  for (const change of [{ id: 43 }, { repository: { full_name: "other/game" } }, { path: ".github/workflows/ci.yml" }, { name: "other" }, { event: "pull_request" }, { head_branch: "feature" }, { status: "in_progress" }, { conclusion: "failure" }, { head_sha: "main" }]) {
    assert.throws(() => validatePublicQaSourceRun({ ...run, ...change }, options));
  }
  for (const change of [{ requestedId: "42\ncommand" }, { requestedId: "9007199254740993" }, { repository: "bad\nrepo/game" }, { qaToolSha: "main" }]) {
    assert.throws(() => validatePublicQaSourceRun(run, { ...options, ...change }));
  }
});
