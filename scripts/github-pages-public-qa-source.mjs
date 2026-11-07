import assert from "node:assert/strict";

export function validatePublicQaSourceRun(run, { requestedId, repository, qaToolSha }) {
  assert.match(String(requestedId), /^[1-9]\d*$/u, "Invalid deployment run ID");
  assert.ok(Number.isSafeInteger(Number(requestedId)));
  assert.equal(run.id, Number(requestedId), "Source run ID mismatch");
  assert.match(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u);
  assert.equal(run.repository?.full_name?.toLowerCase(), repository.toLowerCase(), "Source repository mismatch");
  assert.equal(run.path, ".github/workflows/github-pages-release.yml", "Source must be the release workflow");
  assert.equal(run.name, "GitHub Pages Release");
  assert.equal(run.event, "workflow_dispatch", "PR previews cannot be rechecked as deployments");
  assert.equal(run.head_branch, "main");
  assert.equal(run.status, "completed");
  assert.equal(run.conclusion, "success", "Source deployment did not succeed");
  assert.match(run.head_sha, /^[0-9a-f]{40}$/u);
  assert.match(qaToolSha, /^[0-9a-f]{40}$/u);
  return { id: run.id, url: `https://github.com/${repository}/actions/runs/${run.id}`, controlPlaneSha: run.head_sha, qaToolSha };
}

export function validatePublicQaContractMode(contract, eventName) {
  assert.ok(["workflow_run", "workflow_dispatch"].includes(eventName));
  if (eventName === "workflow_dispatch") assert.equal(contract.deploy, true, "Manual recheck requires an actual deployment");
}
