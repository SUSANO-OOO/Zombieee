import assert from "node:assert/strict";
import test from "node:test";
import { assertEphemeralPerformanceHost, parseIndexingStatus, restoreEnabledVolumes, validateBenchmarkPreparationRecord } from "../scripts/v100-macos-indexing-control.mjs";

const env = { GITHUB_ACTIONS: "true", RUNNER_ENVIRONMENT: "github-hosted", RUNNER_OS: "macOS", GITHUB_REPOSITORY: "SUSANO-OOO/Zombieee", GITHUB_EVENT_NAME: "pull_request", GITHUB_JOB: "v100-webkit-frame-control", GITHUB_RUN_ID: "36935406773", GITHUB_SHA: "0284f0f616c695e45a7e73c5b9979c1d1c15b1d1" };
test("Spotlight control rejects user computers, self-hosted runners and other jobs before mutation", () => {
  assert.doesNotThrow(() => assertEphemeralPerformanceHost(env, "darwin", "arm64"));
  for (const key of Object.keys(env)) assert.throws(() => assertEphemeralPerformanceHost({ ...env, [key]: "" }, "darwin", "arm64"));
  assert.throws(() => assertEphemeralPerformanceHost({ ...env, RUNNER_ENVIRONMENT: "self-hosted" }, "darwin", "arm64"));
  assert.throws(() => assertEphemeralPerformanceHost(env, "win32", "arm64"));
  assert.throws(() => assertEphemeralPerformanceHost(env, "darwin", "x64"));
});
test("mdutil records each original enabled state without erasing any index", () => {
  assert.deepEqual(parseIndexingStatus("/:\n\tIndexing enabled.\n/System/Volumes/Data:\n\tIndexing disabled.\n/Volumes/Other Disk:\n\tSpotlight server is disabled.\n"), [
    { mount: "/", enabled: true, status: "Indexing enabled." },
    { mount: "/System/Volumes/Data", enabled: false, status: "Indexing disabled." },
    { mount: "/Volumes/Other Disk", enabled: false, status: "Spotlight server is disabled." },
  ]);
});
test("unknown, absent or ambiguous mdutil status fails closed", () => {
  for (const output of ["", "Indexing enabled.\n", "/:\n", "/:\nunknown\n", "/:\n/Volumes/X:\nIndexing enabled.\n", "/:\nIndexing enabled.\n/:\nIndexing disabled.\n"]) assert.throws(() => parseIndexingStatus(output));
});
test("a failed volume restoration does not prevent later original enabled volumes from being restored", () => {
  const calls=[],failure=Object.assign(new Error("fixture command failed"),{status:1});
  const result=restoreEnabledVolumes([{mount:"/",enabled:true},{mount:"/disabled",enabled:false},{mount:"/System/Volumes/Data",enabled:true}],mount=>{calls.push(mount);if(mount==="/")throw failure;});
  assert.deepEqual(calls,["/","/System/Volumes/Data"]);assert.deepEqual(result.errors,[failure]);
  assert.deepEqual(result.attempts,[{mount:"/",ok:false,code:null,status:1},{mount:"/System/Volumes/Data",ok:true}]);
});

test("benchmark preparation requires its recorded causal basis and the current ephemeral run and head", () => {
  const record = { run: env.GITHUB_RUN_ID, head: env.GITHUB_SHA, purpose: "benchmark-preparation", state: "paused", diagnosticOnly: false, acceptanceOverride: false,
    basis: { run: 36944517519, primaryDigest: "fa3a2bf9a5c3ece6ddc63bcaf77c0c03308c7b6d7b6e37bb4699539c6c20f83b", controlDigest: "41e03d4975a2504984a5f1b98804a3c4aed248186e3f67a0c5bfeeccfcca5b94" },
    before: [{ mount: "/", enabled: true }], after: [{ mount: "/", enabled: false }], pausedAt: "2026-10-02T00:00:00Z" };
  const validate = value => validateBenchmarkPreparationRecord(value, env, "darwin", "arm64");
  assert.equal(validate(record), record);
  for (const patch of [{run:"other"},{head:"other"},{purpose:"causal-diagnostic"},{state:"restored"},{diagnosticOnly:true},{acceptanceOverride:true},{basis:{...record.basis,run:0}},
    {before:[]},{after:[]},{after:[{mount:"/other",enabled:false}]},{after:[{mount:"/",enabled:true}]},{after:[...record.after,...record.after]},{pausedAt:"invalid"}]) assert.throws(() => validate({...record,...patch}));
  assert.throws(() => validateBenchmarkPreparationRecord(record, env, "win32", "arm64"));
});
