import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {load} from 'js-yaml';
import {ciChangeScope,dependencyInputs,laneFingerprints,validationPlan,previousLaneEvidence,
 assertValidationResults,LANE_JOBS,JOB_LANES,framePerformanceRuntimes,workflowJobChanges,workflowRuntimeContracts,readOnlyBaseCompatibility} from '../scripts/ci-change-scope.mjs';
import {nativeCaseSelection} from '../scripts/v177-native-allunit-selection.mjs';
import {correctionCaseSelection,correctionCases} from '../scripts/v105-five-corrections-capture.mjs';
import {provenanceFixture} from './helpers/ci-pr-provenance.mjs';

const head='a'.repeat(40),base='b'.repeat(40),merge='d'.repeat(40),fp='1'.repeat(64);
const fingerprints=Object.fromEntries(Object.keys(LANE_JOBS).map(k=>[k,fp]));
const scopes=paths=>ciChangeScope(paths,{draft:false});
const changed=['scripts/v177-native-allunit-browser.mjs'];
const planFor=paths=>validationPlan(scopes(paths),{head,base,merge,fingerprints});

test('whole PR docs are outside product acceptance on Draft and Ready, never reused or newly passed',()=>{
 for(const draft of [true,false]){
  const s=ciChangeScope(['README.md','AGENTS.md','docs/PROJECT_STATE.md'],{draft});
  for(const key of Object.keys(LANE_JOBS))assert.equal(s[key],false);
  assert.equal(s.code_checks,false);assert.equal(s.wholeGameAccepted,false);
  for(const gate of Object.values(validationPlan(s,{head,base,merge,fingerprints}).gates))assert.equal(gate.state,'outside');
 }
 for(const file of ['app/new-shared.js','public/asset-manifest.json','package-lock.json','unclassified.config.js',
  'docs/story/v10/全脚本_R9.md','docs/story/v10/PRODUCER_DECISIONS_FINAL_RELEASE.md','docs/story/new-dialogue.md']){
  const s=scopes([file,'docs/PROJECT_STATE.md']);
  for(const key of Object.keys(LANE_JOBS))assert.equal(s[key],true,file+' must retain '+key);
 }
});
test('story sources stay bound to runtime evidence while known development guides remain documentation',()=>{
 const sets=Object.fromEntries(Object.keys(LANE_JOBS).map(k=>[k,new Set()]));
 const entries=[['docs/story/v10/全脚本_R9.md','a'.repeat(40)],['docs/story/v10/README.md','b'.repeat(40)]];
 const before=laneFingerprints(entries,sets,{base});
 const changed=laneFingerprints(entries.map(([f,h])=>[f,f.endsWith('全脚本_R9.md')?'c'.repeat(40):h]),sets,{base});
 for(const k of Object.keys(LANE_JOBS))assert.notEqual(changed[k],before[k]);
 assert.deepEqual(before,laneFingerprints(entries.map(([f,h])=>[f,f.endsWith('README.md')?'d'.repeat(40):h]),sets,{base}));
 assert.notDeepEqual(before,laneFingerprints(entries,sets,{base,historicalDocs:true}));
 assert.equal(planFor(['docs/story/v10/README.md']).fingerprintAlgorithm,'runtime-source-v3');
});
test('known QA changes target their dependants; shared and unknown helpers fail closed',()=>{
 for(const [file,lane] of [['scripts/v100-r9-full-story-browser.mjs','r9'],
  ['scripts/v177-native-allunit-browser.mjs','allunit'],['.github/workflows/native-allunit-capture.yml','allunit'],
  ['.github/workflows/v1-quality-acceptance.yml','quality'],['scripts/v105-five-corrections-capture.mjs','five']]){
  const s=scopes([file]);assert.equal(s[lane],true);assert.equal(s.full,false);
 }
 for(const file of ['scripts/unknown-helper.mjs','scripts/run-browser-qa-with-server.mjs','scripts/browser-qa-entry.mjs'])
  assert.equal(scopes([file]).full,true);
 const s=ciChangeScope(['app/new.js'],{draft:true});assert.equal(s.performance,false);assert.equal(s.quality,false);assert.equal(s.allunit,true);
 assert.deepEqual(framePerformanceRuntimes(['docs/PROJECT_STATE.md']),[]);
 assert.deepEqual(framePerformanceRuntimes(['package-lock.json']).map(r=>r.runtime),['formal','native-recording-control']);
});
test('actual import closure reaches shared browser identity, launcher and quiet-output consumers',()=>{
 const list=execFileSync('git',['ls-files'],{encoding:'utf8',maxBuffer:8*1024*1024}).trim().split(/\r?\n/u);
 const files=new Set(list),read=f=>readFileSync(f,'utf8').replaceAll('\r\n','\n');
 const {dependencies,sets}=dependencyInputs(files,read);
 for(const file of ['scripts/run-browser-qa-with-server.mjs','scripts/browser-qa-entry.mjs','scripts/browser-qa-build-identity.mjs']){
  assert.ok(dependencies[file]?.includes('allunit'),file+' must reach native motion');
  assert.equal(ciChangeScope([file],{draft:false,dependencies}).allunit,true);
 }
 assert.ok(dependencies['scripts/silent-browser-output.mjs']?.includes('phaseg'));
 assert.ok(dependencies['scripts/silent-browser-output.mjs']?.includes('quality'));
 assert.deepEqual(dependencies['scripts/v105-five-corrections-capture.mjs'],['five'],
  'Reading correction selection must not import the recorder into native/performance');
 const importing=dependencyInputs(files,file=>read(file)+(file==='scripts/v177-native-allunit-browser.mjs'
  ?"\nimport '../tests/v105-original-av.test.mjs';\n":''));
 assert.ok(importing.dependencies['scripts/v105-five-corrections-capture.mjs'].includes('allunit'),
  'An actually imported test is executable and cannot be discarded as provenance');
 const entries=list.map(file=>[file,'a'.repeat(40)]);
 const before=laneFingerprints(entries,sets,{base});
 const recordingChange=laneFingerprints(entries.map(([f,h])=>[f,f==='scripts/v105-five-corrections-capture.mjs'?'c'.repeat(40):h]),sets,{base});
 assert.notEqual(recordingChange.five,before.five);
 assert.equal(recordingChange.performance,before.performance);assert.equal(recordingChange.allunit,before.allunit);
 assert.ok(sets.allunit.has('scripts/v177-native-allunit-recovery.json'),'JSON data itself remains bound');
 const recoveryChange=laneFingerprints(entries.map(([f,h])=>[f,f==='scripts/v177-native-allunit-recovery.json'?'d'.repeat(40):h]),sets,{base});
 assert.notEqual(recoveryChange.allunit,before.allunit,'Changing the actual selection data still invalidates its consumers');
 const after=laneFingerprints(entries.map(([f,h])=>[f,f==='scripts/silent-browser-output.mjs'?'b'.repeat(40):h]),sets,{base});
 assert.notEqual(before.phaseg,after.phaseg);assert.notEqual(before.quality,after.quality);
 assert.notEqual(laneFingerprints(entries,sets,{base:'c'.repeat(40)}).normal,before.normal);
 const docs=laneFingerprints([...entries,['docs/new-note.md','c'.repeat(40)]],sets,{base});assert.deepEqual(docs,before);
});

function evidenceApi({mutate=()=>{},offline=false}={}){
 const p=planFor(changed);
 const provenance=provenanceFixture({runId:72,head,base,merge,artifactId:92});
 const jobs=[{id:90,run_id:72,run_attempt:1,head_sha:head,name:'Native Motion Build',status:'completed',conclusion:'success',
  steps:[{name:'Verify exact checkout',status:'completed',conclusion:'success'}]},
 ...Array.from({length:12},(_,i)=>({id:100+i,run_id:72,run_attempt:1,head_sha:head,name:'All units / Native Motion (forms-'+(i+1)+')',
  status:'completed',conclusion:'success',steps:[{name:'Verify exact checkout',status:'completed',conclusion:'success'}]}))];
 const run={id:72,head_sha:head,event:'pull_request',run_attempt:1,status:'completed',conclusion:'failure',pull_requests:[{number:182}]};
 const x={p,run,jobs,provenance};mutate(x);
 const scope=provenanceFixture({runId:72,head,base,artifactId:93,entryName:'validation-scope.json',body:JSON.stringify(p)});
 const artifacts=[provenance.artifact,scope.artifact];
 return async url=>{
  if(offline)throw Error('offline');
  let value,bytes;
  if(url.includes('workflows/ci.yml/runs?'))value={workflow_runs:[run]};
  else if(url.endsWith('/artifacts?per_page=100'))value={total_count:artifacts.length,artifacts};
  else if(url.endsWith('/jobs?filter=latest&per_page=100'))value={total_count:jobs.length,jobs};
  else if(url.endsWith('/runs/72'))value=run;
  else if(url.endsWith('/artifacts/92/zip'))bytes=provenance.zip;
  else if(url.endsWith('/artifacts/93/zip'))bytes=scope.zip;
  else throw Error('Unexpected request '+url);
  return {ok:true,json:async()=>value,arrayBuffer:async()=>bytes};
 };
}
const options={repository:'SUSANO-OOO/Zombieee',previousHead:head,base,prNumber:182,fingerprints,token:'test-only'};
test('reuse requires every actual matrix job, original ZIP digest and both head/merge provenance',async()=>{
 const evidence=await previousLaneEvidence({...options,request:evidenceApi()});
 assert.equal(evidence.allunit.runId,72);assert.equal(evidence.allunit.jobs.length,13);
 assert.equal(evidence.allunit.provenance.head,head);assert.equal(evidence.allunit.provenance.merge,merge);
 assert.equal(evidence.normal,null,'unexecuted lanes cannot be borrowed from a failed run');
 for(const mutate of [
  x=>{x.jobs.pop();},x=>{x.jobs[0].conclusion='skipped';},
  x=>{x.jobs[0].conclusion='cancelled';},x=>{x.jobs[0].status='in_progress';},
  x=>{x.jobs[0].steps=[];},x=>{x.jobs[0].head_sha='f'.repeat(40);},x=>{x.jobs[0].run_attempt=2;},
  x=>{x.run.run_attempt=2;},x=>{x.run.pull_requests=[];},x=>{x.p.base='f'.repeat(40);},
  x=>{x.p.merge='f'.repeat(40);},x=>{x.p.gates.allunit.fingerprint='f'.repeat(64);},
  x=>{x.p.gates.allunit.state='outside';},x=>{x.provenance.artifact.expired=true;},
  x=>{x.provenance.artifact.digest='sha256:'+'f'.repeat(64);},
 ]){
  const rejected=await previousLaneEvidence({...options,request:evidenceApi({mutate})});
  assert.equal(rejected.allunit,null);
 }
 await assert.rejects(previousLaneEvidence({...options,request:evidenceApi({offline:true})}),/CI evidence transport unavailable/u);
 assert.equal((await previousLaneEvidence({...options,token:'',request:()=>assert.fail('no token')})).allunit,null);
});

test('qualified unchanged failures block a docs push without another recording; explicit revalidation needs fresh success',async()=>{
 const evidence=await previousLaneEvidence({...options,request:evidenceApi({mutate:x=>{x.jobs[1].conclusion='failure';}})});
 assert.equal(evidence.allunit.conclusion,'failure');assert.equal(evidence.allunit.jobs.filter(j=>j.conclusion==='failure').length,1);
 const args={head,base,merge,fingerprints,evidence},p=validationPlan(scopes([...changed,'docs/extra.md']),args);
 const needs={...Object.fromEntries(Object.keys(JOB_LANES).map(k=>[k,{result:'skipped'}])),scope:{result:'success'},verify:{result:'success'}};
 assert.equal(p.gates.allunit.state,'blocked');assert.throws(()=>assertValidationResults(p,needs),/Unresolved unchanged allunit failure.*72/u);
 const forged=structuredClone(p);forged.gates.allunit.state='reused';
 assert.throws(()=>assertValidationResults(forged,needs),/failed owner/u);
 const retry=validationPlan(scopes(changed),{...args,attempt:2});
 assert.equal(retry.gates.allunit.state,'blocked');assert.equal(retry.retry.priorFailures.allunit.runId,72);
 assert.equal(retry.retry.resolutionClaimed,false);assert.equal(retry.retry.failuresRetained,true);
 assert.throws(()=>assertValidationResults(retry,needs),/Unresolved unchanged allunit failure/u);
 assert.throws(()=>assertValidationResults(retry,{...needs,allunit:{result:'success'}}),'A retry cannot replace the unchanged failed owner with a successful job');
 for(const attempt of [0,1.5,NaN])assert.throws(()=>validationPlan(scopes(changed),{...args,attempt}));
 const changedInput=await previousLaneEvidence({...options,fingerprints:{...fingerprints,allunit:'2'.repeat(64)},
  request:evidenceApi({mutate:x=>{x.jobs[1].conclusion='failure';}})});
 assert.equal(changedInput.allunit,null,'A relevant input change requires a new execution');
});

test('transport failures stop scope resolution instead of launching costly replacement product checks',async()=>{
 const recoveredApi=evidenceApi(),notices=[];let acquisitionCalls=0;
 const recovered=await previousLaneEvidence({...options,onAcquisitionRetry:note=>notices.push(note),request:async url=>{
  if(++acquisitionCalls===1)return {ok:false,status:502};return recoveredApi(url);
 }});
 assert.equal(recovered.allunit.runId,72,'One idempotent metadata retry still requires the original ZIP and provenance');
 assert.equal(notices.length,1);assert.ok(notices[0].includes('retry 1/1'));
 for(const status of [403,429,502]){
  let attempts=0;
  await assert.rejects(previousLaneEvidence({...options,request:async()=>{attempts++;return {ok:false,status};}}),/CI evidence transport HTTP/u);
  assert.equal(attempts,status===502?2:1,'Retry is bounded and excludes authorization/rate-limit failures');
 }
 const outside=await previousLaneEvidence({...options,requiredLanes:[],request:()=>assert.fail('Outside lanes need no evidence API')});
 assert.ok(Object.values(outside).every(value=>value===null));
 const selected=await previousLaneEvidence({...options,requiredLanes:['allunit'],request:evidenceApi()});
 assert.equal(selected.allunit.conclusion,'success');assert.equal(selected.performance,null);
 for(const status of [401,403,429,500,502,503])
  await assert.rejects(previousLaneEvidence({...options,request:async()=>({ok:false,status})}),/CI evidence transport HTTP/u);
 await assert.rejects(previousLaneEvidence({...options,request:async()=>{throw Error('offline');}}),/CI evidence transport unavailable/u);
 const api=evidenceApi();
 await assert.rejects(previousLaneEvidence({...options,request:url=>url.endsWith('/artifacts?per_page=100')
  ?Promise.resolve({ok:false,status:502}):api(url)}),/CI evidence transport HTTP 502/u);
 await assert.rejects(previousLaneEvidence({...options,request:async()=>({ok:true,json:async()=>{throw TypeError('body disconnected');}})}),/CI evidence body transport unavailable/u);
 const zipApi=evidenceApi();
 await assert.rejects(previousLaneEvidence({...options,request:async url=>url.endsWith('/artifacts/92/zip')
  ?{ok:true,arrayBuffer:async()=>{throw Error('body disconnected');}}:zipApi(url)}),/CI evidence body transport unavailable/u);
 const malformed=await previousLaneEvidence({...options,request:async()=>({ok:true,json:async()=>{throw SyntaxError('invalid JSON');}})});
 assert.ok(Object.values(malformed).every(value=>value===null),'Completed invalid content remains invalid evidence');
 const missing=await previousLaneEvidence({...options,request:async()=>({ok:false,status:404})});
 assert.ok(Object.values(missing).every(value=>value===null),'Absent evidence requires fresh checks; it is not a passed owner');
});

test('legacy runtime evidence is recomputed from its immutable source, not re-pinned to a new expected hash',async()=>{
 const old='2'.repeat(64),request=()=>evidenceApi({mutate:x=>{delete x.p.fingerprintAlgorithm;x.p.gates.allunit.fingerprint=old;}});
 assert.equal((await previousLaneEvidence({...options,request:request()})).allunit,null);
 let calls=0;
 const sourceFingerprints=revision=>{calls++;assert.equal(revision,head);return {legacy:{...fingerprints,allunit:old},current:fingerprints};};
 const e=await previousLaneEvidence({...options,request:request(),sourceFingerprints});
 assert.equal(e.allunit.sourceFingerprint,old);assert.equal(e.allunit.fingerprint,fp);assert.equal(calls,1);
 const v2=()=>evidenceApi({mutate:x=>{x.p.fingerprintAlgorithm='runtime-source-v2';x.p.gates.allunit.fingerprint=old;}});
 assert.equal((await previousLaneEvidence({...options,request:v2()})).allunit,null,'A v2 owner needs its immutable source proof');
 const upgraded=await previousLaneEvidence({...options,request:v2(),sourceFingerprints:()=>({v2:{...fingerprints,allunit:old},current:fingerprints})});
 assert.equal(upgraded.allunit.sourceFingerprintAlgorithm,'runtime-source-v2');
 assert.equal(upgraded.allunit.fingerprint,fp);
 for(const proof of [{v2:fingerprints,current:fingerprints},{v2:{...fingerprints,allunit:old},current:{...fingerprints,allunit:'3'.repeat(64)}}])
  assert.equal((await previousLaneEvidence({...options,request:v2(),sourceFingerprints:()=>proof})).allunit,null);
 for(const proof of [{legacy:fingerprints,current:fingerprints},{legacy:{...fingerprints,allunit:old},current:{...fingerprints,allunit:'3'.repeat(64)}}])
  assert.equal((await previousLaneEvidence({...options,request:request(),sourceFingerprints:()=>proof})).allunit,null);
 assert.equal((await previousLaneEvidence({...options,request:evidenceApi({mutate:x=>{x.p.fingerprintAlgorithm='unknown';}})})).allunit,null);
 const entries=[['scripts/ci-change-scope.mjs','a'.repeat(40)],['.gitattributes','b'.repeat(40)],['app/shared.js','c'.repeat(40)]],sets=Object.fromEntries(Object.keys(LANE_JOBS).map(k=>[k,new Set()]));
 const a=laneFingerprints(entries,sets,{base}),b=laneFingerprints(entries.map(([f,h])=>[f,f==='scripts/ci-change-scope.mjs'?'d'.repeat(40):h]),sets,{base});
 assert.deepEqual(a,b,'Read-only orchestration changes do not change runtime acquisition conditions');
 assert.notDeepEqual(a,laneFingerprints(entries.map(([f,h])=>[f,f==='.gitattributes'?'e'.repeat(40):h]),sets,{base}),'Checkout byte conditions remain runtime inputs');
 sets.allunit.add('scripts/ci-change-scope.mjs');
 assert.notEqual(laneFingerprints(entries,sets,{base}).allunit,laneFingerprints(entries.map(([f,h])=>[f,f==='scripts/ci-change-scope.mjs'?'d'.repeat(40):h]),sets,{base}).allunit,'An actual runtime import remains bound');
});
test('a metadata-only scope failure retains the nearest qualified ancestor but never skips an executed product attempt',async()=>{
 const recent='e'.repeat(40),api=evidenceApi(),rows=[
  {name:'Validation Scope',status:'completed',conclusion:'failure'},
  {name:'PR Verify',status:'completed',conclusion:'failure'},
  {name:'Build and Node Checks',status:'completed',conclusion:'skipped'}];
 const recentRun={id:71,head_sha:recent,status:'completed',conclusion:'failure',run_attempt:1,pull_requests:[{number:182}]};
 const request=(jobs=rows,run=recentRun)=>async url=>{
  if(url.includes('head_sha='+recent))return {ok:true,json:async()=>({workflow_runs:[run]})};
  if(url.endsWith('/runs/71'))return {ok:true,json:async()=>run};
  if(url.endsWith('/runs/71/artifacts?per_page=100'))return {ok:true,json:async()=>({total_count:0,artifacts:[]})};
  if(url.endsWith('/runs/71/jobs?filter=latest&per_page=100'))return {ok:true,json:async()=>({total_count:jobs.length,jobs})};
  return api(url);
 };
 const opts={...options,previousHead:recent,previousHeads:[recent,head]};
 assert.equal((await previousLaneEvidence({...opts,request:request()})).allunit.runId,72);
 for(const conclusion of ['success','failure','cancelled','in_progress']){
  const executed=rows.map(j=>j.name==='Build and Node Checks'?{...j,conclusion}:j);
  assert.equal((await previousLaneEvidence({...opts,request:request(executed)})).allunit,null);
 }
 assert.equal((await previousLaneEvidence({...opts,request:request(rows,{...recentRun,conclusion:'cancelled'})})).allunit,null);
 for(const name of ['Validation Scope','PR Verify']){
  const cancelled=rows.map(j=>j.name===name?{...j,conclusion:'cancelled'}:j);
  assert.equal((await previousLaneEvidence({...opts,request:request(cancelled)})).allunit,null,'A cancelled '+name+' cannot authorize ancestor reuse');
 }
 await assert.rejects(previousLaneEvidence({...opts,request:request(rows,{...recentRun,status:'in_progress'})}),/still running/u);
});

test('a read-only main advance preserves the original base and needs both source and base-delta proof',async()=>{
 const nextBase='c'.repeat(40),current=Object.fromEntries(Object.keys(LANE_JOBS).map(k=>[k,'7'.repeat(64)]));
 const compatible=Object.fromEntries(Object.keys(LANE_JOBS).map(k=>[k,true]));
 const proof={v3:fingerprints,current,baseCompatible:compatible,baseDeltaPaths:['README.md','docs/notes.md']};
 const opts={...options,base:nextBase,fingerprints:current};
 const e=await previousLaneEvidence({...opts,request:evidenceApi(),sourceFingerprints:(revision,originalBase)=>{
  assert.equal(revision,head);assert.equal(originalBase,base);return proof;
 }});
 assert.equal(e.allunit.base,base);assert.equal(e.allunit.provenance.base,base);assert.equal(e.allunit.validationBase,nextBase);
 const p=validationPlan(scopes(changed),{head,base:nextBase,merge,fingerprints:current,evidence:e});
 const needs={...Object.fromEntries(Object.keys(JOB_LANES).map(k=>[k,{result:'skipped'}])),scope:{result:'success'},verify:{result:'success'}};
 assert.equal(assertValidationResults(p,needs),true);
 for(const invalid of [{...proof,v3:current},{...proof,current:fingerprints},
  {...proof,baseCompatible:{...compatible,allunit:false}},{...proof,baseDeltaPaths:['app/new.js']}])
  assert.equal((await previousLaneEvidence({...opts,request:evidenceApi(),sourceFingerprints:()=>invalid})).allunit,null);
 assert.equal((await previousLaneEvidence({...options,base:nextBase,request:evidenceApi()})).allunit,null,'Base mismatch cannot be waived without immutable source proof');
 const failed=await previousLaneEvidence({...opts,request:evidenceApi({mutate:x=>{x.jobs[1].conclusion='failure';}}),sourceFingerprints:()=>proof});
 assert.equal(validationPlan(scopes(changed),{head,base:nextBase,merge,fingerprints:current,evidence:failed}).gates.allunit.state,'blocked');
 const sets=Object.fromEntries(Object.keys(LANE_JOBS).map(k=>[k,new Set()]));
 assert.ok(Object.values(readOnlyBaseCompatibility(proof.baseDeltaPaths,sets,sets)).every(Boolean));
 for(const file of ['app/new.js','package-lock.json','.gitattributes','.github/workflows/ci.yml','scripts/unknown.mjs','docs/story/v10/全脚本_R9.md'])
  assert.ok(Object.values(readOnlyBaseCompatibility([file],sets,sets)).every(value=>!value),file);
 const imported=structuredClone(sets);imported.allunit.add('scripts/ci-change-scope.mjs');
 assert.equal(readOnlyBaseCompatibility(['scripts/ci-change-scope.mjs'],sets,imported).allunit,false,'Imported control files remain runtime inputs');
});

test('required PR Verify rejects missing, skipped, cancelled and failed lanes and scope even after a docs push',()=>{
 const p=planFor(changed),needs={...Object.fromEntries(Object.keys(JOB_LANES).map(k=>[k,{result:'skipped'}])),scope:{result:'success'},verify:{result:'success'},allunit:{result:'success'}};
 assert.equal(assertValidationResults(p,needs),true);
 assert.throws(()=>assertValidationResults(p,{...needs,unknown:{result:'failure'}}));
 for(const result of ['failure','cancelled','skipped',undefined]){
  for(const id of ['scope','verify','allunit'])assert.throws(()=>assertValidationResults(p,{...needs,[id]:{result}}));
 }
 const productPlan=planFor(['app/new.js','docs/extra.md']);
 assert.throws(()=>assertValidationResults(productPlan,needs),'a final docs commit must not hide unexecuted product gates');
 const reused=structuredClone(p);reused.gates.allunit.state='reused';
 reused.gates.allunit.owner={runId:72,head,base,fingerprint:fp,provenance:{head,base,merge},jobs:LANE_JOBS.allunit.map((name,i)=>({id:i+1,name}))};
 assert.equal(assertValidationResults(reused,{...needs,allunit:{result:'skipped'}}),true);
 assert.throws(()=>assertValidationResults(reused,{...needs,allunit:{result:'failure'}}));
 reused.gates.allunit.owner.fingerprint='2'.repeat(64);
 assert.throws(()=>assertValidationResults(reused,needs));
});
test('fresh native and correction calls cannot succeed by selecting the old empty retained plan',async()=>{
 const event={pull_request:{draft:false}};
 const selection=nativeCaseSelection({event,forceFull:true});
 assert.equal(selection.mode,'full');assert.equal(selection.caseIds.length,432);assert.equal(selection.shards.length,12);
 for(const scope of ['desktop','mobile390','mobile340']){
  const result=await correctionCaseSelection(scope,{event,select:()=>selection});
  assert.equal(result.mode,'full');assert.deepEqual(result.plan,correctionCases(scope));assert.ok(result.plan.length);
 }
 assert.throws(()=>nativeCaseSelection({event,forceFull:'true'}));
});
test('all called workflows feed one always-run protected check without duplicate public deployment',()=>{
 const read=name=>load(readFileSync('.github/workflows/'+name+'.yml','utf8'));
 const ci=read('ci'),jobs=ci.jobs,final=jobs['required-validation'];
 assert.deepEqual(Object.keys(ci.on),['pull_request']);assert.equal(final.name,'PR Verify');assert.equal(final.if,'always()');
 assert.deepEqual(new Set(final.needs),new Set(Object.keys(jobs).filter(id=>!['required-validation','v177-guardian-control-diagnostic','v177-webkit-shadow-diagnostic'].includes(id))));
 assert.equal(jobs.verify.name,'Build and Node Checks');
 for(const [id,lane] of Object.entries(JOB_LANES))assert.ok(jobs[id]&&final.needs.includes(id),lane+' is missing from aggregation');
 for(const [id,file] of [['quality','v1-quality-acceptance'],['allunit','native-allunit-capture'],['five','five-corrections-capture']]){
  assert.equal(jobs[id].uses,'./.github/workflows/'+file+'.yml');
  const callee=read(file);assert.ok(Object.hasOwn(callee.on,'workflow_call'));assert.equal(callee.on.pull_request,undefined);
  assert.ok(callee.jobs.result.if.includes('always()'));
  for(const j of Object.values(callee.jobs).filter(j=>j.steps?.some(s=>s.uses?.startsWith('actions/checkout')))){
   assert.ok(j.steps.some(s=>s.name==='Verify exact checkout'));
  }
 }
 assert.equal(read('v1-quality-acceptance').concurrency.group.startsWith('quality-acceptance-'),true);
 for(const id of ['allunit','five'])assert.equal(jobs[id].with.fresh,true);
 assert.equal(read('five-corrections-capture').jobs.capture.if,undefined);
 assert.equal(read('native-allunit-capture').jobs.capture.strategy['max-parallel'],2);
 assert.equal(read('five-corrections-capture').jobs.capture.strategy['max-parallel'],1);
 assert.equal(read('targeted-frame-performance').jobs.scope.if,'github.event.pull_request.draft');
 assert.deepEqual(Object.keys(read('github-pages-release').on),['workflow_dispatch']);
 assert.equal(read('github-pages-release').on.workflow_dispatch.inputs.deploy.default,false);
 for(const j of Object.values(jobs))assert.equal(j['continue-on-error'],undefined);
 assert.deepEqual(ci.permissions,{contents:'read'});
});


test('workflow runtime changes are lane-specific, global conditions and unknown jobs stay conservative',()=>{
 const original=readFileSync('.github/workflows/ci.yml','utf8').replaceAll('\r\n','\n');
 const r9=original.replace("name: R9 Story (","timeout-minutes: 999\n    name: R9 Story (");
 assert.deepEqual(workflowJobChanges(original,r9),['r9']);
 const changedIf=original.replace("    if: needs.scope.outputs.ranger == 'true'","    if: false");
 assert.deepEqual(workflowJobChanges(original,changedIf),['ranger']);
 const global=original.replace('jobs:\n','env:\n  V100_DEVICE_RUNTIME_VIEWPORT: 844x340\njobs:\n');
 assert.deepEqual(new Set(workflowJobChanges(original,global)),new Set(Object.keys(LANE_JOBS)));
 const unknown=original+'\n  unknown-runtime:\n    runs-on: ubuntu-latest\n    steps:\n      - run: false\n';
 assert.equal(workflowJobChanges(original,unknown).length,Object.keys(LANE_JOBS).length);
 const entries=[['.github/workflows/ci.yml','a'.repeat(40)],['.github/workflows/v1-quality-acceptance.yml','b'.repeat(40)],['app/a.js','c'.repeat(40)]];
 const sets=Object.fromEntries(Object.keys(LANE_JOBS).map(k=>[k,new Set(k==='quality'?['.github/workflows/v1-quality-acceptance.yml']:[])]));
 const fp1=laneFingerprints(entries,sets,{base,workflowContracts:workflowRuntimeContracts(original)});
 const fp2=laneFingerprints(entries.map(([f,h])=>[f,f.includes('v1-quality')?'d'.repeat(40):h]),sets,{base,workflowContracts:workflowRuntimeContracts(original)});
 assert.notEqual(fp1.quality,fp2.quality);assert.equal(fp1.normal,fp2.normal);assert.equal(fp1.performance,fp2.performance);
 const fp3=laneFingerprints(entries,sets,{base,workflowContracts:workflowRuntimeContracts(r9)});
 assert.notEqual(fp1.r9,fp3.r9);assert.equal(fp1.normal,fp3.normal);
 const evidence=scopes(['docs/qa/v105/five-corrections-6a-evidence.json']);
 assert.equal(evidence.code_checks,true);assert.equal(evidence.allunit,false,'proof JSON runs its contracts without reshooting identical footage');
});
test('the actual CLI uses the whole PR and NUL-separated Japanese paths, even when before is only a docs commit',()=>{
 const dir=mkdtempSync(join(tmpdir(),'zombieee-ops-scope-'));
 assert.ok(resolve(dir).toLowerCase().startsWith((resolve(tmpdir())+requireSeparator()).toLowerCase()));
 const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',windowsHide:true}).trim();
 const write=(file,body)=>{const full=join(dir,file);execFileSync(process.execPath,['--input-type=module','-e',
  'import fs from "node:fs";import path from "node:path";fs.mkdirSync(path.dirname(process.argv[1]),{recursive:true});fs.writeFileSync(process.argv[1],process.argv[2]);',full,body],{windowsHide:true});};
 try{
  git('init','-q');git('config','user.email','ci-fixture@example.invalid');git('config','user.name','CI Fixture');git('config','commit.gpgsign','false');git('config','core.autocrlf','false');
  write('README.md','base\n');write('package.json',JSON.stringify({scripts:{}}));
  for(const name of ['ci','native-allunit-capture','v1-quality-acceptance','five-corrections-capture'])write('.github/workflows/'+name+'.yml','jobs:\n  verify:\n    steps: []\n');
  git('add','.');git('commit','-qm','base');const rootBase=git('rev-parse','HEAD');
  write('docs/日本語 監査.md','read-only notes\n');git('add','.');git('commit','-qm','Japanese docs');
  const invoke=before=>{
   const current=git('rev-parse','HEAD');
   return JSON.parse(execFileSync(process.execPath,[resolve('scripts/ci-change-scope.mjs')],{cwd:dir,encoding:'utf8',windowsHide:true,
    env:{...process.env,GITHUB_ACTIONS:'false',GITHUB_OUTPUT:'',GITHUB_STEP_SUMMARY:'',GITHUB_REPOSITORY:'SUSANO-OOO/Zombieee',
     CI_SCOPE_BASE:before,CI_SCOPE_PR_BASE:rootBase,CI_SCOPE_HEAD:current,CI_SCOPE_DRAFT:'false',CI_SCOPE_PREVIOUS_HEAD:before,CI_SCOPE_ACTIONS_TOKEN:''}}));
  };
  const docResult=invoke(rootBase);assert.equal(docResult.code_checks,false);assert.ok(docResult.changedPaths.includes('docs/日本語 監査.md'));
  assert.ok(Object.values(docResult.gates).every(g=>g.state==='outside'));
  write('app/runtime.js','export const changed=true;\n');git('add','.');git('commit','-qm','product');
  const before=git('rev-parse','HEAD');write('README.md','base\nfinal docs\n');git('add','.');git('commit','-qm','docs after product');
  const productResult=invoke(before);assert.ok(productResult.changedPaths.includes('app/runtime.js'));
  assert.ok(Object.values(productResult.gates).every(g=>g.state==='fresh'));
 }finally{
  const normalized=resolve(dir),parent=resolve(tmpdir());
  assert.ok(normalized.toLowerCase().startsWith((parent+requireSeparator()).toLowerCase()));
  assert.ok(normalized.includes('zombieee-ops-scope-'));rmSync(normalized,{recursive:true,force:true});
 }
});
function requireSeparator(){return process.platform==='win32'?'\\':'/';}
