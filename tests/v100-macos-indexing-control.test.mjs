import assert from "node:assert/strict";
import test from "node:test";
import { assertEphemeralPerformanceHost, assertEphemeralNativeCaptureHost, parseIndexingStatus, restoreEnabledVolumes, validateBenchmarkPreparationRecord, assertEphemeralCorrectionCaptureHost, validateCapturePreparationRecord, correctionPreparationNeeded } from "../scripts/v100-macos-indexing-control.mjs";

const env = { GITHUB_ACTIONS: "true", RUNNER_ENVIRONMENT: "github-hosted", RUNNER_OS: "macOS", GITHUB_REPOSITORY: "SUSANO-OOO/Zombieee", GITHUB_EVENT_NAME: "pull_request", GITHUB_JOB: "v100-webkit-frame-control", GITHUB_RUN_ID: "36935406773", GITHUB_SHA: "0284f0f616c695e45a7e73c5b9979c1d1c15b1d1" };

test("native single-case diagnostic cannot authorize the formal host or any broader capture selection", () => {
  const native={...env,GITHUB_JOB:"capture",GITHUB_RUN_ATTEMPT:"1",V177_CAPTURE_SHARD:"forms-2",V177_NATIVE_HOST_INDEXING_CONTROL:"brute-attack-1280",V177_EXPECTED_HEAD_SHA:"a".repeat(40)};
  const selection={mode:"remaining",caseIds:["forms-2:brute:attack:1280x720"],outcomeCaseIds:[],manualCaseIds:[],shards:["forms-2"]};
  assert.doesNotThrow(()=>assertEphemeralNativeCaptureHost(native,"darwin","arm64",selection));
  assert.throws(()=>assertEphemeralPerformanceHost(native,"darwin","arm64"));
  for(const key of Object.keys(native))assert.throws(()=>assertEphemeralNativeCaptureHost({...native,[key]:""},"darwin","arm64",selection));
  for(const patch of [{mode:"full"},{caseIds:[]},{caseIds:[...selection.caseIds,"forms-2:brute:move:1280x720"]},
    {outcomeCaseIds:["forms-2:brute:controlled-outcome:1280x720"]},{manualCaseIds:["unexpected"]},{shards:["forms-1"]}])
    assert.throws(()=>assertEphemeralNativeCaptureHost(native,"darwin","arm64",{...selection,...patch}));
  assert.throws(()=>assertEphemeralNativeCaptureHost(native,"win32","arm64",selection));
  assert.throws(()=>assertEphemeralNativeCaptureHost(native,"darwin","x64",selection));
});
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


test('only the exact unfinished native and correction cases can prepare their own ephemeral ARM host',()=>{
 const base={...env,GITHUB_JOB:'capture',GITHUB_RUN_ATTEMPT:'1',V177_EXPECTED_HEAD_SHA:'a'.repeat(40)};
 const native={...base,V177_CAPTURE_SHARD:'forms-4',V177_NATIVE_HOST_INDEXING_CONTROL:'mayo-attack-1280'};
 const selection={mode:'remaining',caseIds:['forms-4:mayo-chan:attack:1280x720'],outcomeCaseIds:[],manualCaseIds:[],shards:['forms-4']};
 assert.doesNotThrow(()=>assertEphemeralNativeCaptureHost(native,'darwin','arm64',selection));
 for(const patch of [{V177_CAPTURE_SHARD:'forms-2'},{V177_NATIVE_HOST_INDEXING_CONTROL:'other'},{RUNNER_ENVIRONMENT:'self-hosted'},{GITHUB_EVENT_NAME:'workflow_dispatch'}])assert.throws(()=>assertEphemeralNativeCaptureHost({...native,...patch},'darwin','arm64',selection));
 const correction={...base,V105_CAPTURE_SCOPE:'desktop'},s={mode:'remaining',plan:[{kind:'miyamoto-musashi',mode:'manual'},{kind:'mayo-chan',mode:'manual'}]};
 assert.equal(correctionPreparationNeeded(s),true);assert.doesNotThrow(()=>assertEphemeralCorrectionCaptureHost(correction,'darwin','arm64',s));
 for(const key of Object.keys(correction))assert.throws(()=>assertEphemeralCorrectionCaptureHost({...correction,[key]:''},'darwin','arm64',s));
 assert.throws(()=>assertEphemeralCorrectionCaptureHost(correction,'win32','arm64',s));assert.throws(()=>assertEphemeralCorrectionCaptureHost(correction,'darwin','x64',s));
 for(const patch of [{mode:'full'},{plan:[]},{plan:[...s.plan,{kind:'brawler',mode:'manual'}]},{plan:[s.plan[0]]}]){
  const unknown={...s,...patch};assert.equal(correctionPreparationNeeded(unknown),false);assert.throws(()=>assertEphemeralCorrectionCaptureHost(correction,'darwin','arm64',unknown));
 }
 for(const [e,sel,isCorrection,binding]of [[native,selection,false,{head:base.V177_EXPECTED_HEAD_SHA,shardId:'forms-4'}],[correction,s,true,{head:base.V177_EXPECTED_HEAD_SHA}]]){
  const record={run:e.GITHUB_RUN_ID,head:e.GITHUB_SHA,attempt:'1',candidateHead:binding.head,arch:'arm64',state:'paused',diagnosticOnly:false,acceptanceOverride:false,
   purpose:isCorrection?'correction-capture-preparation':'native-capture-preparation',...(isCorrection?{scope:'desktop',plan:s.plan}:{shard:'forms-4',caseId:selection.caseIds[0]}),
   before:[{mount:'/',enabled:true}],after:[{mount:'/',enabled:false}],pausedAt:'2026-10-25T00:00:00Z'};
  const validate=r=>validateCapturePreparationRecord(r,{env:e,platform:'darwin',arch:'arm64',selection:sel,binding,correction:isCorrection});
  assert.equal(validate(record),record);
  for(const patch of [{run:'other'},{head:'other'},{candidateHead:'f'.repeat(40)},{attempt:'2'},{arch:'x64'},{state:'restored'},{purpose:'benchmark-preparation'},{diagnosticOnly:true},{acceptanceOverride:true},{after:[]},{after:[{mount:'/',enabled:true}]},{after:[{mount:'/other',enabled:false}]},{pausedAt:'invalid'},isCorrection?{plan:[]}:{caseId:'forms-2:brute:attack:1280x720'}])assert.throws(()=>validate({...record,...patch}));
 }
});
