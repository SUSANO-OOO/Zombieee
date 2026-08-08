import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("operating-model documents preserve the Sol/Luna handoff and review boundary", async () => {
  const agents = await readFile("AGENTS.md", "utf8");
  const workflow = await readFile("docs/CODEX_TWO_THREAD_WORKFLOW.md", "utf8");
  const luna = await readFile("docs/CODEX_LUNA_ROLE.md", "utf8");
  const runbook = await readFile("docs/RELEASE_BACKUP_RECOVERY.md", "utf8");
  const assetPolicy = await readFile("docs/ASSET_STORAGE_POLICY.md", "utf8");

  assert.match(agents, /ASSET_STORAGE_POLICY\.md/u);
  assert.match(agents, /AshfallGame\.tsx.*before\/after contract test/u);
  assert.match(agents, /operation.*release.*redeploy/u);
  assert.match(agents, /deploy.*boolean/u);
  assert.match(workflow, /元のSol threadのFinal Reviewを最終技術review/u);
  assert.match(workflow, /同じSol threadのFinal Reviewを、独立監査と誤記しない/u);
  assert.match(luna, /READY_FOR_SOL_REVIEW/u);
  assert.match(luna, /Design Lock/u);
  assert.match(runbook, /Luna self-reviewと元のSol threadのSol Final Review/u);
  assert.match(runbook, /fresh independent Sol Auditorは対象Issue、Producer、risk\/release policyが明示した場合だけ追加する/u);
  assert.match(runbook, /同じSol threadのFinal Reviewを独立reviewとは呼ばない/u);
  assert.match(assetPolicy, /production runtime/u);
  assert.match(assetPolicy, /provenance/u);
  assert.match(assetPolicy, /100 MiB/u);
});
