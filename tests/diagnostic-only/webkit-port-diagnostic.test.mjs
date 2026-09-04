import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SOURCE_HEAD, SOURCE_TREE, DIAGNOSTIC_PATHS, assertDiagnosticDiff, assertPortSnapshot, diagnosticCases, runFiniteCases } from "../../scripts/webkit-port-diagnostic.mjs";

const valid = () => ({ platform: "darwin", arch: "x64", osVersion: "15.7.1", node: "v22.13.0", playwright: "1.56.1", revision: "2215", browserVersion: "26.0", sourceHead: SOURCE_HEAD, sourceTree: SOURCE_TREE, parentHead: SOURCE_HEAD, env: {} });
test("port preflight requires exact supported host/browser/source before cases", () => {
  assert.doesNotThrow(() => assertPortSnapshot(valid()));
  for (const [key, value] of Object.entries({ platform: "linux", arch: "arm64", osVersion: "26.0", node: "v24.18.0", playwright: "1.56.2", revision: "2140", browserVersion: "25.0", sourceHead: "other", sourceTree: "other", parentHead: "other" })) assert.throws(() => assertPortSnapshot({ ...valid(), [key]: value }));
  for (const key of ["WEBKIT_SKIA_ENABLE_CPU_RENDERING", "WEBKIT_SKIA_CPU_PAINTING_THREADS", "WEBKIT_SKIA_GPU_PAINTING_THREADS", "PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH", "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD", "PLAYWRIGHT_HOST_PLATFORM_OVERRIDE"]) assert.throws(() => assertPortSnapshot({ ...valid(), env: { [key]: "1" } }));
});
test("only three diagnostic-owned files may differ from candidate", () => {
  assert.doesNotThrow(() => assertDiagnosticDiff(DIAGNOSTIC_PATHS));
  assert.throws(() => assertDiagnosticDiff([]));
  for (const path of ["app/AshfallGame.tsx", "scripts/v100-phase-g-production-matrix.mjs", ".github/workflows/ci.yml", "package-lock.json"]) assert.throws(() => assertDiagnosticDiff([...DIAGNOSTIC_PATHS, path]));
});
test("phase G is one original ordered process, never retries or changes stage budgets", () => {
  const cases = diagnosticCases("phase-g", "/evidence");
  assert.equal(cases.length, 1);
  assert.deepEqual(cases[0].args, ["scripts/run-browser-qa-with-server.mjs", "scripts/v100-phase-g-production-matrix.mjs"]);
  assert.equal(cases[0].env.V100_PHASE_G_ONLY, "battle-extra");
  assert.equal(cases[0].env.V100_PHASE_G_ONLY_ENGINE, "webkit");
  assert(!Object.keys(cases[0].env).some(k => /STAGES|TIMEOUT|DURATION|ATTEMPT|VIEWPORT/u.test(k)));
});
test("enemy counterexamples use existing single-attempt bounded runner", () => {
  const cases = diagnosticCases("enemy", "/evidence");
  assert.deepEqual(cases.map(c => [c.env.V0995_ENEMY_QA_KINDS, c.env.V0995_ENEMY_QA_VIEWPORTS]), [["red-panther-smg", "844x340"], ["takuya-omega", "844x390"]]);
  for (const c of cases) { assert.deepEqual(c.args, ["scripts/run-v0995-enemy-runtime-bounded.mjs"]); assert(!Object.keys(c.env).some(k => /TIMEOUT|ATTEMPT/u.test(k))); }
});
test("deployment preserves original complete six-checkpoint cases and timeout", () => {
  const cases = diagnosticCases("deployment", "/evidence");
  assert.deepEqual(cases.map(c => [c.env.V099_FINAL_REMEDIATION_QA_DEPLOYMENT_UNITS, c.env.V099_FINAL_REMEDIATION_QA_VIEWPORTS]), [["kumaverson", "667x375"], ["brawler", "932x430"]]);
  for (const c of cases) { assert.equal(c.env.V099_FINAL_REMEDIATION_QA_TIMEOUT_MS, "60000"); assert.equal(c.env.V099_FINAL_REMEDIATION_QA_CASES, "deployment"); }
  assert.throws(() => diagnosticCases("unplanned", "/evidence"));
});
test("first red ends a lane without retry or next case, and no result is acceptance", async () => {
  const cases = diagnosticCases("enemy", "/evidence"); let count = 0;
  const failed = await runFiniteCases(cases, async () => { count++; return { code: 1, signal: null }; });
  assert.equal(count, 1); assert.equal(failed.length, 1); assert.equal(failed[0].acceptanceEligible, false);
  const green = await runFiniteCases(cases, async () => ({ code: 0, signal: null }));
  assert.equal(green.length, 2); assert(green.every(r => r.acceptanceEligible === false));
});
test("workflow is isolated push-only diagnostic and cannot publish or run required CI", async () => {
  const y = await readFile(new URL("../../.github/workflows/v100-webkit-port-comparison.yml", import.meta.url), "utf8");
  assert(y.includes('branches: ["codex/v100-webkit-port-comparison"]'));
  assert(y.includes("runs-on: macos-15-intel")); assert(y.includes("contents: read"));
  assert(y.includes("lane: [phase-g, enemy, deployment]")); assert(y.includes("max-parallel: 1"));
  assert(!/pull_request:|workflow_dispatch:|deploy-pages|write-all|SYS_PTRACE|WEBKIT_SKIA/u.test(y));
});
