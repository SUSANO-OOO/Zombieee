import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import path from "node:path";

const repositoryRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

test("Phase G checkpoint recorder negative mode names the unresolved predicate and lifecycle", () => {
  const result = spawnSync(process.execPath, ["scripts/v100-phase-g-production-matrix.mjs"], {
    cwd: repositoryRoot,
    env: { ...process.env, V100_PHASE_G_CHECKPOINT_NEGATIVE: "1" },
    encoding: "utf8",
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0, output);
  assert.match(output, /unresolvedCheckpoint=deployment-attempts-recorded/u);
  assert.match(output, /lastCompletedCheckpoint=combat-observer-started/u);
  assert.match(output, /lifecycleStatus=attached/u);
});
