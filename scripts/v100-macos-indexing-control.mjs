import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {isRangerCaptureSelection,isFullNativeCaptureSelection} from './v177-native-allunit-selection.mjs';

import {correctionCases} from './v105-five-corrections-cases.mjs';

function assertFreshFullCaptureHost(env,platform,arch){
 assert.equal(platform,'darwin');assert.equal(arch,'arm64');
 for(const [key,value] of Object.entries({GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'macOS',
  GITHUB_REPOSITORY:'SUSANO-OOO/Zombieee',GITHUB_EVENT_NAME:'pull_request',GITHUB_JOB:'capture',CI_CAPTURE_FRESH:'true'}))
  assert.equal(env[key],value,'Full recording preparation forbidden: '+key);
 for(const key of ['GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT'])assert.match(env[key]??'',/^\d+$/u);
 for(const key of ['GITHUB_SHA','V177_EXPECTED_HEAD_SHA'])assert.match(env[key]??'',/^[a-f0-9]{40}$/u);
}

export function assertEphemeralPerformanceHost(env, platform, arch) {
  assert.equal(platform, "darwin", "Spotlight control requires macOS");
  assert.equal(arch, "arm64", "the authoritative performance host must remain Apple Silicon");
  for (const [key, value] of Object.entries({ GITHUB_ACTIONS: "true", RUNNER_ENVIRONMENT: "github-hosted", RUNNER_OS: "macOS", GITHUB_REPOSITORY: "SUSANO-OOO/Zombieee", GITHUB_EVENT_NAME: "pull_request", GITHUB_JOB: "v100-webkit-frame-control" })) {
    assert.equal(env[key], value, `Spotlight control forbidden outside the ephemeral performance job: ${key}`);
  }
  assert.match(env.GITHUB_RUN_ID ?? "", /^\d+$/u);
  assert.match(env.GITHUB_SHA ?? "", /^[a-f0-9]{40}$/u);
}

export function assertEphemeralNativeCaptureHost(env, platform, arch, selection) {
  if(env.V177_NATIVE_HOST_INDEXING_CONTROL==='full-native-motion'){
    assertFreshFullCaptureHost(env,platform,arch);
    assert.equal(isFullNativeCaptureSelection(selection),true);
    assert.ok(selection.shards.includes(env.V177_CAPTURE_SHARD));
    return;
  }
  assert.equal(platform, "darwin"); assert.equal(arch, "arm64");
  const mayo = env.V177_NATIVE_HOST_INDEXING_CONTROL === "mayo-attack-1280";
  const ranger = env.V177_NATIVE_HOST_INDEXING_CONTROL === "ranger-motion";
  for (const [key, value] of Object.entries({ GITHUB_ACTIONS: "true", RUNNER_ENVIRONMENT: "github-hosted", RUNNER_OS: "macOS", GITHUB_REPOSITORY: "SUSANO-OOO/Zombieee", GITHUB_EVENT_NAME: "pull_request", GITHUB_JOB: "capture", V177_CAPTURE_SHARD: ranger?"forms-1":mayo ? "forms-4" : "forms-2", V177_NATIVE_HOST_INDEXING_CONTROL: ranger?"ranger-motion":mayo ? "mayo-attack-1280" : "brute-attack-1280" })) assert.equal(env[key], value, `Native capture control forbidden: ${key}`);
  assert.match(env.GITHUB_RUN_ID ?? "", /^\d+$/u); assert.match(env.GITHUB_RUN_ATTEMPT ?? "", /^\d+$/u);
  assert.match(env.GITHUB_SHA ?? "", /^[a-f0-9]{40}$/u); assert.match(env.V177_EXPECTED_HEAD_SHA ?? "", /^[a-f0-9]{40}$/u);
  assert.equal(selection.mode, "remaining");
  if(ranger){assert.equal(isRangerCaptureSelection(selection),true);return;}
  assert.deepEqual(selection.caseIds, [mayo ? "forms-4:mayo-chan:attack:1280x720" : "forms-2:brute:attack:1280x720"]);
  assert.deepEqual(selection.outcomeCaseIds, []); assert.deepEqual(selection.manualCaseIds, []);
  assert.deepEqual(selection.shards, [mayo ? "forms-4" : "forms-2"]);
}

export const correctionPreparationNeeded = (selection,scope) => selection.mode==='full'
 ?(scope?[scope]:['desktop','mobile390','mobile340']).some(s=>
  ['desktop','mobile390','mobile340'].includes(s)&&JSON.stringify(selection.plan)===JSON.stringify(correctionCases(s)))
 :selection.mode==='remaining'
  &&[JSON.stringify([{kind:'miyamoto-musashi',mode:'manual'},{kind:'mayo-chan',mode:'manual'}]),
     JSON.stringify([{kind:'ranger',mode:'manual'}])].includes(JSON.stringify(selection.plan));

export function assertEphemeralCorrectionCaptureHost(env, platform, arch, selection) {
  if(selection.mode==='full'){
    assertFreshFullCaptureHost(env,platform,arch);
    assert.deepEqual(selection.plan,correctionCases(env.V105_CAPTURE_SCOPE));
    return;
  }
  assert.equal(platform, "darwin"); assert.equal(arch, "arm64");
  for (const [key, value] of Object.entries({ GITHUB_ACTIONS: "true", RUNNER_ENVIRONMENT: "github-hosted", RUNNER_OS: "macOS", GITHUB_REPOSITORY: "SUSANO-OOO/Zombieee", GITHUB_EVENT_NAME: "pull_request", GITHUB_JOB: "capture", V105_CAPTURE_SCOPE: "desktop" })) assert.equal(env[key], value, `Correction preparation forbidden: ${key}`);
  for (const key of ["GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT"]) assert.match(env[key] ?? "", /^\d+$/u);
  for (const key of ["GITHUB_SHA", "V177_EXPECTED_HEAD_SHA"]) assert.match(env[key] ?? "", /^[a-f0-9]{40}$/u);
  assert.equal(selection.mode, "remaining");
  assert.equal(correctionPreparationNeeded(selection),true);
}

export function validateCapturePreparationRecord(record, {env=process.env,platform=process.platform,arch=process.arch,selection,binding,correction=false}={}) {
  if(correction) assertEphemeralCorrectionCaptureHost(env,platform,arch,selection);
  else assertEphemeralNativeCaptureHost(env,platform,arch,selection);
  assert.equal(record.run,env.GITHUB_RUN_ID);assert.equal(record.head,env.GITHUB_SHA);
  assert.equal(record.attempt,env.GITHUB_RUN_ATTEMPT);assert.equal(record.candidateHead,binding.head);
  if(isFullNativeCaptureSelection(selection))assert.equal(record.selectionMode,"full");
  assert.equal(record.arch,arch);assert.equal(record.state,"paused");assert.equal(record.acceptanceOverride,false);
  const diagnostic=!correction&&env.V177_NATIVE_HOST_INDEXING_CONTROL==='brute-attack-1280';
  assert.equal(record.diagnosticOnly,diagnostic);
  assert.equal(record.purpose,correction?'correction-capture-preparation':diagnostic?'native-capture-diagnostic':'native-capture-preparation');
  if(correction){assert.equal(record.scope,env.V105_CAPTURE_SCOPE);assert.deepEqual(record.plan,selection.plan);}
  else {assert.equal(record.shard,binding.shardId);if(isRangerCaptureSelection(selection)||isFullNativeCaptureSelection(selection)){
    for(const k of ['caseIds','manualCaseIds','outcomeCaseIds'])assert.deepEqual(record[k],selection[k]);
  }else assert.equal(record.caseId,selection.caseIds[0]);}
  assert.ok(Array.isArray(record.before)&&record.before.length>0&&Array.isArray(record.after));
  for(const volumes of [record.before,record.after]){
    assert.equal(new Set(volumes.map(v=>v.mount)).size,volumes.length);
    assert.ok(volumes.every(v=>typeof v.mount==='string'&&v.mount.startsWith('/')&&typeof v.enabled==='boolean'));
  }
  assert.deepEqual(record.before.map(v=>v.mount).sort(),record.after.map(v=>v.mount).sort());
  assert.ok(record.after.every(v=>!v.enabled));assert.ok(Number.isFinite(Date.parse(record.pausedAt)));
  return record;
}

export function parseIndexingStatus(output) {
  const volumes = [];
  let mount = null;
  for (const raw of output.split(/\r?\n/u)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("/") && line.endsWith(":")) { assert.equal(mount, null, "mdutil volume has no status before the next header"); mount = line.slice(0, -1); continue; }
    assert.ok(mount, "mdutil status did not identify its volume");
    assert.ok(["Indexing enabled.", "Indexing disabled.", "Spotlight server is disabled."].includes(line), `Unrecognized mdutil status for ${mount}`);
    volumes.push({ mount, enabled: line === "Indexing enabled.", status: line });
    mount = null;
  }
  assert.equal(mount, null, "mdutil volume has no status");
  assert.ok(volumes.length > 0, "mdutil returned no volumes");
  assert.equal(new Set(volumes.map(v => v.mount)).size, volumes.length, "mdutil repeated a volume");
  return volumes;
}

export function restoreEnabledVolumes(volumes, restore) {
  const attempts = [], errors = [];
  for (const volume of volumes.filter(v => v.enabled)) {
    try { restore(volume.mount); attempts.push({ mount: volume.mount, ok: true }); }
    catch (error) { errors.push(error); attempts.push({ mount: volume.mount, ok: false, code: error.code ?? null, status: error.status ?? null }); }
  }
  return { attempts, errors };
}

export function validateBenchmarkPreparationRecord(record, env, platform, arch) {
  assertEphemeralPerformanceHost(env, platform, arch);
  assert.equal(record.run, env.GITHUB_RUN_ID); assert.equal(record.head, env.GITHUB_SHA);
  assert.equal(record.purpose, "benchmark-preparation"); assert.equal(record.state, "paused");
  assert.equal(record.diagnosticOnly, false);
  assert.equal(record.acceptanceOverride, false);
  assert.equal(record.basis.run, 36944517519);
  assert.equal(record.basis.primaryDigest, "fa3a2bf9a5c3ece6ddc63bcaf77c0c03308c7b6d7b6e37bb4699539c6c20f83b");
  assert.equal(record.basis.controlDigest, "41e03d4975a2504984a5f1b98804a3c4aed248186e3f67a0c5bfeeccfcca5b94");
  assert.ok(Array.isArray(record.before) && record.before.length > 0);
  assert.ok(Array.isArray(record.after) && record.after.length > 0);
  for (const volumes of [record.before, record.after]) {
    assert.equal(new Set(volumes.map(v => v.mount)).size, volumes.length);
    assert.ok(volumes.every(v => typeof v.mount === "string" && v.mount.startsWith("/") && typeof v.enabled === "boolean"));
  }
  assert.deepEqual(record.after.map(v => v.mount).sort(), record.before.map(v => v.mount).sort());
  assert.ok(record.after.every(v => !v.enabled), "benchmark preparation left indexing enabled");
  assert.ok(Number.isFinite(Date.parse(record.pausedAt)));
  return record;
}

async function main(mode) {
  assert.ok(["pause", "restore", "prepare-benchmark", "restore-benchmark", "prepare-native-capture", "restore-native-capture", "prepare-correction-capture", "restore-correction-capture"].includes(mode), "Unknown indexing control mode");
  const native = mode.endsWith("native-capture");
  const correction = mode.endsWith("correction-capture");
  let nativeBinding = null, selection = null;
  if (native) {
    const { nativeCaseSelection } = await import("./v177-native-allunit-selection.mjs");
    const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
    selection = nativeCaseSelection({ event });
    assertEphemeralNativeCaptureHost(process.env, process.platform, process.arch, selection);
    const { nativeAllUnitBinding } = await import("./v177-native-allunit-browser.mjs");
    nativeBinding = await nativeAllUnitBinding();
  } else if(correction) {
    const { correctionCaseSelection } = await import("./v105-five-corrections-capture.mjs");
    const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,"utf8"));
    selection = await correctionCaseSelection(process.env.V105_CAPTURE_SCOPE,{event});
    if(!correctionPreparationNeeded(selection,process.env.V105_CAPTURE_SCOPE)){
      assert.ok(mode==='prepare-correction-capture','No preparation belongs to this selection');
      console.log('No host mutation: no prepared recording plan was selected.');return;
    }
    assertEphemeralCorrectionCaptureHost(process.env,process.platform,process.arch,selection);
    const { nativeGameCaptureBinding } = await import("./v177-native-game-capture-browser.mjs");
    nativeBinding = await nativeGameCaptureBinding();
  } else assertEphemeralPerformanceHost(process.env, process.platform, process.arch);
  const workspace = await realpath(process.env.GITHUB_WORKSPACE);
  assert.equal(await realpath(process.cwd()), workspace, "owned checkout required");
  const directory = path.join(workspace, "outputs", native ? "v177-native-allunit-"+nativeBinding.shardId : correction ? "v105-five-corrections/"+process.env.V105_CAPTURE_SCOPE : "v100-device-runtime");
  const benchmark = mode.endsWith("benchmark");
  const recordPath = path.join(directory, native||correction ? "native-host-indexing-control.json" : benchmark ? "spotlight-benchmark-preparation.json" : "spotlight-indexing-control.json");
  const diagnosticNative=native&&process.env.V177_NATIVE_HOST_INDEXING_CONTROL==='brute-attack-1280';
  const purpose = native ? diagnosticNative?"native-capture-diagnostic":"native-capture-preparation" : correction ? "correction-capture-preparation" : benchmark ? "benchmark-preparation" : "causal-diagnostic";
  const options = { encoding: "utf8", timeout: 30_000, maxBuffer: 64 * 1024, env: { ...process.env, LC_ALL: "C" } };
  const status = () => parseIndexingStatus(execFileSync("/usr/bin/mdutil", ["-a", "-s"], options));
  if (mode === "pause" || mode.startsWith("prepare-")) {
    await mkdir(directory, { recursive: true });
    const before = status();
    // Preserve the original status before mutation so an always-run step can restore it.
    const record = { run: process.env.GITHUB_RUN_ID, head: process.env.GITHUB_SHA,
      purpose, diagnosticOnly: native?diagnosticNative:!benchmark&&!correction, acceptanceOverride: false,
      ...(native||correction ? { attempt:process.env.GITHUB_RUN_ATTEMPT,candidateHead:nativeBinding.head,
        ...(native?{shard:nativeBinding.shardId,...(isFullNativeCaptureSelection(selection)?{selectionMode:"full"}:{}),...(isRangerCaptureSelection(selection)||isFullNativeCaptureSelection(selection)
          ?Object.fromEntries(['caseIds','manualCaseIds','outcomeCaseIds'].map(k=>[k,selection[k]])):{caseId:selection.caseIds[0]})}:{scope:process.env.V105_CAPTURE_SCOPE,plan:selection.plan}),arch:process.arch,
        processBefore:execFileSync("/bin/ps",["-axo","pid=,comm=,%cpu="],options) } : {}),
      ...(benchmark ? { basis: { run: 36944517519, primaryDigest: "fa3a2bf9a5c3ece6ddc63bcaf77c0c03308c7b6d7b6e37bb4699539c6c20f83b", controlDigest: "41e03d4975a2504984a5f1b98804a3c4aed248186e3f67a0c5bfeeccfcca5b94" } } : {}),
      before, attemptedAt: new Date().toISOString(), state: "pause-attempted" };
    await writeFile(recordPath, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
    if(correction)await writeFile(process.env.GITHUB_OUTPUT,'prepared=true\n',{flag:'a'});
    execFileSync("/usr/bin/sudo", ["-n", "/usr/bin/mdutil", "-a", "-i", "off"], options);
    const after = status();
    assert.deepEqual(after.map(v => v.mount).sort(), before.map(v => v.mount).sort());
    assert.ok(after.every(v => !v.enabled), "indexing remained enabled");
    Object.assign(record, { after, pausedAt: new Date().toISOString(), state: "paused" });
    await writeFile(recordPath, JSON.stringify(record, null, 2) + "\n");
    if (native||correction) await writeFile(path.join(directory,"native-host-indexing-prepared.json"),JSON.stringify(record,null,2)+"\n",{flag:"wx"});
    console.log(JSON.stringify({ mode, state: record.state, originallyEnabled: before.filter(v => v.enabled).length, volumes: after.length }));
  } else {
    const record = JSON.parse(await readFile(recordPath, "utf8"));
    assert.equal(record.run, process.env.GITHUB_RUN_ID); assert.equal(record.head, process.env.GITHUB_SHA);
    assert.equal(record.purpose, purpose);
    if (native||correction) {
      assert.equal(record.attempt,process.env.GITHUB_RUN_ATTEMPT);assert.equal(record.candidateHead,nativeBinding.head);
      if(native){assert.equal(record.shard,nativeBinding.shardId);if(isFullNativeCaptureSelection(selection))assert.equal(record.selectionMode,"full");if(isRangerCaptureSelection(selection)||isFullNativeCaptureSelection(selection)){
        for(const k of ['caseIds','manualCaseIds','outcomeCaseIds'])assert.deepEqual(record[k],selection[k]);
      }else assert.equal(record.caseId,selection.caseIds[0]);}
      else {assert.equal(record.scope,process.env.V105_CAPTURE_SCOPE);assert.deepEqual(record.plan,selection.plan);}
      assert.equal(record.diagnosticOnly,native?diagnosticNative:false);assert.equal(record.acceptanceOverride,false);
    }
    Object.assign(record, { restorationStartedAt: new Date().toISOString(), state: "restoration-attempted" });
    await writeFile(recordPath, JSON.stringify(record, null, 2) + "\n");
    const { attempts, errors } = restoreEnabledVolumes(record.before, mount => execFileSync("/usr/bin/sudo", ["-n", "/usr/bin/mdutil", "-i", "on", mount], options));
    let restored = null;
    try {
      restored = status();
      assert.deepEqual(restored.map(v => ({ mount: v.mount, enabled: v.enabled })).sort((a,b) => a.mount.localeCompare(b.mount)), record.before.map(v => ({ mount: v.mount, enabled: v.enabled })).sort((a,b) => a.mount.localeCompare(b.mount)));
    } catch (error) { errors.push(error); record.restorationVerificationError = { code: error.code ?? null, status: error.status ?? null }; }
    Object.assign(record, { restoreAttempts: attempts, restored, restoredAt: new Date().toISOString(), state: errors.length ? "restoration-incomplete" : "restored" });
    await writeFile(recordPath, JSON.stringify(record, null, 2) + "\n");
    console.log(JSON.stringify({ mode, state: record.state, volumes: restored?.length ?? null }));
    if (errors.length) throw new AggregateError(errors, "Not all original Spotlight states were restored; all enabled volumes were attempted and results saved");
  }
}

// Finish module evaluation before loading capture drivers which use the pure
// validators above; a top-level await here would deadlock those imports.
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  setImmediate(() => { main(process.argv[2]).catch(error => { console.error(error); process.exitCode=1; }); });
}
