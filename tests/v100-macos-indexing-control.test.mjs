import assert from "node:assert/strict";
import test from "node:test";
import { assertEphemeralPerformanceHost, assertEphemeralNativeCaptureHost, parseIndexingStatus, restoreEnabledVolumes, pauseEnabledVolumes, validateBenchmarkPreparationRecord, assertEphemeralCorrectionCaptureHost, validateCapturePreparationRecord, correctionPreparationNeeded } from "../scripts/v100-macos-indexing-control.mjs";

const env = { GITHUB_ACTIONS: "true", RUNNER_ENVIRONMENT: "github-hosted", RUNNER_OS: "macOS", GITHUB_REPOSITORY: "SUSANO-OOO/Zombieee", GITHUB_EVENT_NAME: "pull_request", GITHUB_JOB: "v100-webkit-frame-control", GITHUB_RUN_ID: "36935406773", GITHUB_SHA: "0284f0f616c695e45a7e73c5b9979c1d1c15b1d1" };

test('preparation requests each enabled volume once and verifies a transitioning request without retrying it',async()=>{
  const before=[{mount:'/',enabled:true},{mount:'/Preboot',enabled:false}],after=before.map(v=>({...v,enabled:false}));
  let time=0,reads=0;const calls=[];
  const transition='/:\nError: invalid operation.\nError: unexpected indexing state.  kMDConfigSearchLevelTransitioning\n';
  const result=await pauseEnabledVolumes(before,mount=>{calls.push(mount);throw Object.assign(Error('transition'),{stdout:transition,status:1,
    stderr:'2026-10-26 09:19:47.430 mdutil[1933:8012] mdutil disabling Spotlight: / -> kMDConfigSearchLevelFSSearchOnly\n'});},
    ()=>{if(reads++===0)throw Object.assign(Error('transition'),{mdutilOutput:transition,mdutilStatus:0});return after;},
    {now:()=>time,sleep:async ms=>{time+=ms;}});
  assert.deepEqual(calls,['/']);assert.deepEqual(result.after,after);assert.equal(result.commands[0].transitioning,true);
  assert.equal(time,100);
  for(const failure of [Error('permission denied'),Error('unrecognized volume')])
    await assert.rejects(pauseEnabledVolumes(before,()=>{throw failure;},()=>after),e=>e===failure);
  for(const change of [{stdout:transition+'Permission denied\n'},{stderr:'Permission denied'},
    {status:2},{signal:'SIGTERM'},{stdout:undefined,message:transition}]){
    const failure=Object.assign(Error('fixture'),{stdout:transition,status:1},change);
    await assert.rejects(pauseEnabledVolumes(before,()=>{throw failure;},()=>after),e=>e===failure);
  }
  time=0;
  await assert.rejects(pauseEnabledVolumes(before,()=>{},()=>before,{now:()=>time,sleep:async ms=>{time+=ms;}}),/exceeded30s/);
  assert.equal(time,30000);
  time=0;
  await assert.rejects(pauseEnabledVolumes(before,()=>{},()=>{time=30000;return after;},{now:()=>time}),/exceeded30s/);
  await assert.rejects(pauseEnabledVolumes(before,()=>{},()=>[{mount:'/wrong',enabled:false}]),/deep-equal/);
  await assert.rejects(pauseEnabledVolumes(before,()=>{},()=>after,{timeoutMs:30001}),/cannot extend30s/);
});

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


test('Ranger continuation uses the same prepared-host ownership without permitting other units or a full capture',()=>{
 const e={...env,GITHUB_JOB:'capture',GITHUB_RUN_ATTEMPT:'1',V177_EXPECTED_HEAD_SHA:'a'.repeat(40),V177_CAPTURE_SHARD:'forms-1',V177_NATIVE_HOST_INDEXING_CONTROL:'ranger-motion'};
 const selection={mode:'remaining',shards:['forms-1'],caseIds:['forms-1:ranger:move:1280x720'],manualCaseIds:[],outcomeCaseIds:[]};
 assert.doesNotThrow(()=>assertEphemeralNativeCaptureHost(e,'darwin','arm64',selection));
 for(const patch of [{mode:'full'},{caseIds:[]},{caseIds:['forms-1:brawler:move:1280x720']},{manualCaseIds:['unexpected']}])assert.throws(()=>assertEphemeralNativeCaptureHost(e,'darwin','arm64',{...selection,...patch}));
 const c={...e,V105_CAPTURE_SCOPE:'desktop'},s={mode:'remaining',plan:[{kind:'ranger',mode:'manual'}]};
 assert.equal(correctionPreparationNeeded(s),true);assert.doesNotThrow(()=>assertEphemeralCorrectionCaptureHost(c,'darwin','arm64',s));
});

test('full capture preparation stays within exact hosted ARM plans and binds every scope',async()=>{
 const {nativeCaseSelection,nativeCaptureHostControl}=await import('../scripts/v177-native-allunit-selection.mjs');
 const {correctionCases}=await import('../scripts/v105-five-corrections-cases.mjs');
 const full=nativeCaseSelection({event:{},forceFull:true});
 const owned={...env,GITHUB_JOB:'capture',GITHUB_RUN_ATTEMPT:'1',CI_CAPTURE_FRESH:'true',
  V177_EXPECTED_HEAD_SHA:'a'.repeat(40),V177_NATIVE_HOST_INDEXING_CONTROL:'full-native-motion',V177_CAPTURE_SHARD:'forms-1'};
 assert.equal(nativeCaptureHostControl({pull_request:{}},full,{fresh:true}),'full-native-motion');
 assert.equal(nativeCaptureHostControl({pull_request:{}},full,{fresh:false}),'none');
 for(const shard of full.shards)assert.doesNotThrow(()=>assertEphemeralNativeCaptureHost({...owned,V177_CAPTURE_SHARD:shard},'darwin','arm64',full));
 for(const change of [{caseIds:full.caseIds.slice(1)},{caseIds:[...full.caseIds,full.caseIds[0]]},{shards:['forms-1']}])
  assert.throws(()=>assertEphemeralNativeCaptureHost(owned,'darwin','arm64',{...full,...change}));
 const nativeRecord=JSON.parse(JSON.stringify({run:owned.GITHUB_RUN_ID,head:owned.GITHUB_SHA,attempt:owned.GITHUB_RUN_ATTEMPT,
 candidateHead:owned.V177_EXPECTED_HEAD_SHA,arch:'arm64',state:'paused',acceptanceOverride:false,diagnosticOnly:false,
 purpose:'native-capture-preparation',shard:'forms-1',selectionMode:'full',caseIds:full.caseIds,
 before:[{mount:'/',enabled:true}],after:[{mount:'/',enabled:false}],pausedAt:'2026-10-26T00:00:00Z'}));
 const nativeOptions={env:owned,platform:'darwin',arch:'arm64',selection:full,binding:{head:owned.V177_EXPECTED_HEAD_SHA,shardId:'forms-1'}};
 assert.doesNotThrow(()=>validateCapturePreparationRecord(nativeRecord,nativeOptions));
 for(const change of [{selectionMode:'remaining'},{shard:'forms-2'},{caseIds:full.caseIds.slice(1)},{manualCaseIds:['unexpected']}])
  assert.throws(()=>validateCapturePreparationRecord({...nativeRecord,...change},nativeOptions));
 for(const scope of ['desktop','mobile390','mobile340']){
  const selection={mode:'full',plan:correctionCases(scope),retained:[]},e={...owned,V105_CAPTURE_SCOPE:scope};
  assert.equal(correctionPreparationNeeded(selection,scope),true);
  assert.doesNotThrow(()=>assertEphemeralCorrectionCaptureHost(e,'darwin','arm64',selection));
  for(const [key,value] of [['CI_CAPTURE_FRESH',''],['RUNNER_ENVIRONMENT','self-hosted'],['GITHUB_EVENT_NAME','workflow_dispatch'],
   ['GITHUB_JOB','other'],['GITHUB_RUN_ATTEMPT',''],['GITHUB_SHA','main'],['V105_CAPTURE_SCOPE','../elsewhere']])
   assert.throws(()=>assertEphemeralCorrectionCaptureHost({...e,[key]:value},'darwin','arm64',selection));
  for(const plan of [[],selection.plan.slice(1),[...selection.plan,selection.plan[0]]])
   assert.throws(()=>assertEphemeralCorrectionCaptureHost(e,'darwin','arm64',{...selection,plan}));
  const r={run:e.GITHUB_RUN_ID,head:e.GITHUB_SHA,attempt:e.GITHUB_RUN_ATTEMPT,candidateHead:e.V177_EXPECTED_HEAD_SHA,
   arch:'arm64',state:'paused',acceptanceOverride:false,diagnosticOnly:false,purpose:'correction-capture-preparation',
   scope,plan:selection.plan,before:[{mount:'/',enabled:true}],after:[{mount:'/',enabled:false}],pausedAt:'2026-10-26T00:00:00Z'};
  assert.doesNotThrow(()=>validateCapturePreparationRecord(r,{env:e,platform:'darwin',arch:'arm64',selection,binding:{head:e.V177_EXPECTED_HEAD_SHA},correction:true}));
  for(const change of [{scope:'wrong'},{run:'wrong'},{attempt:'2'},{candidateHead:'b'.repeat(40)},{acceptanceOverride:true}])
   assert.throws(()=>validateCapturePreparationRecord({...r,...change},{env:e,platform:'darwin',arch:'arm64',selection,binding:{head:e.V177_EXPECTED_HEAD_SHA},correction:true}));
 }
 const {correctionCapturePart}=await import('../scripts/v105-five-corrections-cases.mjs');
 for(const part of ['1','2']){
  const selection={mode:'full',part,plan:correctionCapturePart('desktop',part)},e={...owned,V105_CAPTURE_SCOPE:'desktop',V105_CAPTURE_PART:part};
  assert.doesNotThrow(()=>assertEphemeralCorrectionCaptureHost(e,'darwin','arm64',selection));
  assert.throws(()=>assertEphemeralCorrectionCaptureHost({...e,V105_CAPTURE_PART:part==='1'?'2':'1'},'darwin','arm64',selection));
  assert.throws(()=>assertEphemeralCorrectionCaptureHost(e,'darwin','arm64',{...selection,plan:correctionCases('desktop')}));
 }
 for(const patch of [{CI_CAPTURE_FRESH:''},{GITHUB_EVENT_NAME:'workflow_dispatch'},{V177_CAPTURE_SHARD:'forms-99'},{GITHUB_JOB:'other'}])
  assert.throws(()=>assertEphemeralNativeCaptureHost({...owned,...patch},'darwin','arm64',full));
});
