import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { diagnosticCase, coreStatus, assertDiagnosticOnlyDiff, DIAGNOSTIC_PATHS } from "../../scripts/native-diagnostic/observe.mjs";

test("diagnostic cannot change candidate sources or harnesses", () => {
  assert.doesNotThrow(() => assertDiagnosticOnlyDiff([...DIAGNOSTIC_PATHS]));
  for (const file of ["app/AshfallGame.tsx", "scripts/v100-phase-g-production-matrix.mjs", ".github/workflows/ci.yml", "package-lock.json"]) {
    assert.throws(() => assertDiagnosticOnlyDiff([file]));
  }
  assert.throws(() => assertDiagnosticOnlyDiff([]));
});
test("native core status distinguishes missing, live and dumping", () => {
  assert.equal(coreStatus("").coreDumping, null);
  assert.equal(coreStatus("CoreDumping:\t0\n").coreDumping, 0);
  assert.equal(coreStatus("CoreDumping:\t1\nState:\tD (disk sleep)\nNSpid:\t1323\n").coreDumping, 1);
});
test("enemy is one unchanged direct four-phase harness invocation", () => {
  const lane = diagnosticCase("enemy", "/evidence");
  assert.equal(lane.script, "scripts/v0995-enemy-runtime-browser-smoke.mjs");
  assert.equal(lane.env.V0995_ENEMY_QA_VIEWPORTS, "844x340");
  assert.equal(lane.env.V0995_ENEMY_QA_KINDS, "red-panther-smg");
  assert(!Object.keys(lane.env).some((key) => /TIMEOUT|ATTEMPT/u.test(key)));
});
test("deployment is one unchanged direct six-checkpoint invocation", () => {
  const lane = diagnosticCase("deployment", "/evidence");
  assert.equal(lane.script, "scripts/v099-final-remediation-browser-smoke.mjs");
  assert.equal(lane.env.V099_FINAL_REMEDIATION_QA_DEPLOYMENT_UNITS, "kumaverson");
  assert.equal(lane.env.V099_FINAL_REMEDIATION_QA_VIEWPORTS, "667x375");
  assert.equal(lane.env.V099_FINAL_REMEDIATION_QA_TIMEOUT_MS, "60000");
});
test("phase G keeps its ordered trio with no stage/viewport/time/attempt override", () => {
  const lane = diagnosticCase("phase-g", "/evidence");
  assert.equal(lane.script, "scripts/v100-phase-g-production-matrix.mjs");
  assert.equal(lane.env.V100_PHASE_G_ONLY, "battle-extra");
  assert(!Object.keys(lane.env).some((key) => /STAGE|VIEWPORT|TIMEOUT|ATTEMPT/u.test(key)));
  assert.throws(() => diagnosticCase("unknown", "/evidence"));
});
test("debugger retains signals, bounded stacks, no memory dump or instruction repair", async () => {
  const source = await readFile(new URL("../../scripts/native-diagnostic/webprocess.gdb", import.meta.url), "utf8");
  for (const signal of ["SIGSEGV", "SIGABRT", "SIGBUS", "SIGILL", "SIGFPE"]) assert(source.includes(`handle ${signal} stop print pass`));
  assert(source.includes("range(1, 9)"));
  assert(source.includes("thread apply all bt 12"));
  assert(!/generate-core|set \$pc|jump |return /u.test(source));
});
