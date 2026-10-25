import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {selectNativeCases,nativeCaseSelection,nativeCaptureHostControl} from '../scripts/v177-native-allunit-selection.mjs';

test('host preparation is restricted to the unfinished PR case and never injected into manual remaining or full capture',()=>{
 const s={mode:'remaining',caseIds:['forms-4:mayo-chan:attack:1280x720'],outcomeCaseIds:[],manualCaseIds:[]};
 for(const draft of [false,true])assert.equal(nativeCaptureHostControl({pull_request:{draft}},s),'mayo-attack-1280');
 assert.equal(nativeCaptureHostControl({inputs:{capture_mode:'remaining'}},s),'none');
 for(const patch of [{mode:'full'},{caseIds:[]},{caseIds:[...s.caseIds,'forms-4:mayo-chan:move:1280x720']},{manualCaseIds:['unexpected']},{outcomeCaseIds:['unexpected']}])assert.equal(nativeCaptureHostControl({pull_request:{draft:false}},{...s,...patch}),'none');
 const brute={...s,caseIds:['forms-2:brute:attack:1280x720']};
 assert.equal(nativeCaptureHostControl({pull_request:{draft:true}},brute),'brute-attack-1280');
 assert.equal(nativeCaptureHostControl({pull_request:{draft:false}},brute),'none');
});
import {SHARDS,planShard} from '../scripts/v177-native-allunit-manifest.mjs';

const current=JSON.parse(readFileSync('scripts/v177-native-allunit-recovery.json','utf8'));
// The new baseline owns its own raw reports. Old clock closures and failed
// manual contracts keep their original immutable profile in Git, without
// acquiring the new baseline's head or being dropped from negative tests.
const historical=(()=>{
 let profile=current;const seen=new Set();
 for(let depth=0;!Array.isArray(profile.historicalRawClockAudits);depth++){
  assert.ok(depth<8,'Historical negative tests require a bounded original profile chain');
  const reference=profile.previousProfile;assert.ok(reference,'Original strict-clock failures must remain reachable');
  assert.equal(reference.file,'scripts/v177-native-allunit-recovery.json');
  assert.equal(seen.has(reference.gitHead),false,'Historical profile cycle');seen.add(reference.gitHead);
  const raw=execFileSync('git',['show',reference.gitHead+':'+reference.file],{maxBuffer:8*1024*1024});
  assert.equal(createHash('sha256').update(raw).digest('hex'),reference.sha256);
  assert.equal(execFileSync('git',['rev-parse',reference.gitHead+':'+reference.file],{encoding:'utf8'}).trim(),reference.gitBlob);
  profile=JSON.parse(raw);
 }
 return profile;
})();
const originalCaseIds=SHARDS.flatMap(s=>planShard(s.id)).filter(r=>r.viewport.width===1280).slice(0,54).map(r=>r.caseId);
const recovery={schema:'v177-native-allunit-recovery/v1',head:'1'.repeat(40),runId:'39422404651',originalCaseIds,
 caseIds:originalCaseIds.slice(30),retainedEvidence:{caseIds:originalCaseIds.slice(0,30)},
 changedBlobs:{'scripts/v177-native-allunit-cases.mjs':'2'.repeat(40)}};
function profileRoot(profile){const root=mkdtempSync(path.join(tmpdir(),'v177-selection-'));mkdirSync(path.join(root,'scripts'));
 writeFileSync(path.join(root,'scripts','v177-native-allunit-recovery.json'),JSON.stringify(profile));return root;}
const originalRoot=profileRoot(recovery);

function resolvedWalkerFixture(){
 const p=structuredClone(historical),closure=p.additionalRawClockClosures?.[0]??p.historicalAdditionalRawClockClosures?.[0];
 assert.ok(closure,'the original strict-clock closure remains available as historical evidence');
 p.caseIds=p.caseIds.filter(id=>id!==closure.caseId);
 if(!p.retainedEvidence.caseIds.includes(closure.caseId))p.retainedEvidence.caseIds.push(closure.caseId);
 const report=p.retainedEvidence.additionalReports.find(r=>r.head===closure.head&&r.runId===closure.runId&&r.sha256===closure.reportSha256);
 assert.ok(report);if(!report.caseIds.includes(closure.caseId))report.caseIds.push(closure.caseId);
 p.additionalRawClockClosures=[structuredClone(closure)];return p;
}
test('unfinished selection never substitutes an unknown or duplicate case and leaves the full inventory intact',()=>{
  const selection=selectNativeCases(recovery.caseIds);
  assert.equal(selection.caseIds.length,24);
  assert.equal(selection.shards.length,3);
  assert.equal(recovery.originalCaseIds.length,54);assert.equal(recovery.retainedEvidence.caseIds.length,30);
  assert.equal(SHARDS.flatMap(s=>planShard(s.id)).length,432);
  for(const ids of [[],['unknown'],[recovery.caseIds[0],recovery.caseIds[0]]])assert.throws(()=>selectNativeCases(ids));
});

test('an isolated codec dispatch keeps the exact original Brute case and cannot replace a PR inventory',()=>{
 const event={inputs:{capture_mode:'brute-codec-control'}};
 const result=nativeCaseSelection({event,root:'not-read',git:()=>{throw Error('A codec control must not invent retained evidence');}});
 assert.equal(result.mode,'codec-control');assert.deepEqual(result.caseIds,['forms-2:brute:attack:1280x720']);
 assert.deepEqual(result.shards,['forms-2']);assert.deepEqual(result.manualCaseIds,[]);assert.deepEqual(result.outcomeCaseIds,[]);
 assert.equal(result.retainedEvidence,undefined);
 assert.throws(()=>nativeCaseSelection({event:{...event,pull_request:{draft:false}}}),/dispatch-only/u);
});

test('the acquisition probe selects only the original duplicate-PTS case without claiming retained evidence',()=>{
 const event={inputs:{capture_mode:'abomination-acquisition-control'}};
 const result=nativeCaseSelection({event,root:'not-read',git:()=>{throw Error('No evidence adoption in an acquisition probe');}});
 assert.equal(result.mode,'acquisition-control');assert.deepEqual(result.caseIds,['forms-6:abomination:attack:844x340']);
 assert.deepEqual(result.shards,['forms-6']);assert.deepEqual(result.manualCaseIds,[]);assert.deepEqual(result.outcomeCaseIds,[]);
 assert.equal(result.retainedEvidence,undefined);
 assert.throws(()=>nativeCaseSelection({event:{...event,pull_request:{draft:false}}}),/dispatch-only/u);
});
test('reuse requires exact reviewed blobs; changes to product, thresholds, driver or deleted paths restore full capture',()=>{
  const file='scripts/v177-native-allunit-cases.mjs',blob=recovery.changedBlobs[file];
  const select=(changes,observed=blob,event={pull_request:{draft:true}})=>nativeCaseSelection({event,root:originalRoot,git:args=>args[0]==='diff'?changes:observed});
  assert.equal(select(file).mode,'remaining');
  assert.equal(select(file,'f'.repeat(40)).caseIds.length,432);
  for(const path of ['app/AshfallGame.tsx','public/art/v100/joints/walker-r1.webp','scripts/v177-native-allunit-contract.mjs','deleted.file'])
    assert.equal(select(path).mode,'full');
  assert.equal(select(file,blob,{pull_request:{draft:false}}).mode,'full');
  assert.equal(select(file,blob,{inputs:{capture_mode:'full'}}).mode,'full');
});

test('current recovery partitions all original observations and never reuses an invalid clock without a new recording',()=>{
 assert.equal(current.schema,'v177-native-allunit-recovery/v2');
 const selected=nativeCaseSelection({event:{pull_request:{draft:true}},git:()=>''});
 assert.deepEqual(selected.caseIds,current.caseIds);assert.deepEqual(selected.outcomeCaseIds,current.outcomeCaseIds);
 assert.deepEqual(selected.manualCaseIds,current.manualCaseIds);
 for(const [pending,kept,total]of [[selected.caseIds,selected.retainedEvidence.caseIds,432],
  [selected.outcomeCaseIds,selected.retainedEvidence.outcomeCaseIds,144],
  [selected.manualCaseIds,selected.retainedEvidence.manualCaseIds,3]]){
  assert.equal(pending.length+kept.length,total);assert.equal(new Set([...pending,...kept]).size,total);
 }
 const pending=[...selected.caseIds,...selected.manualCaseIds,...selected.outcomeCaseIds];
 assert.deepEqual(selected.shards,SHARDS.filter(s=>pending.some(id=>id.startsWith(s.id+':'))).map(s=>s.id));
 assert.equal(current.rawClockAudit.sourceReportCount,12);assert.equal(current.rawClockAudit.rawReportsUnmodified,true);
 assert.equal(current.rawClockAudit.duplicateRowsRemoved,false);
 assert.equal(current.rawClockAudit.head,current.head);assert.equal(current.rawClockAudit.runId,current.runId);
 assert.deepEqual(current.rawClockAudit.normalInvalidClock,[]);assert.deepEqual(current.rawClockAudit.outcomeInvalidClock,[]);assert.deepEqual(current.rawClockAudit.manualInvalidClock,[]);
 const resolutions=(selected.retainedEvidence.additionalReports??[]).flatMap(r=>[...r.caseIds??[],...r.manualCaseIds??[],...r.outcomeCaseIds??[]]);
 for(const id of [...current.rawClockAudit.normalInvalidClock,...current.rawClockAudit.outcomeInvalidClock,...current.rawClockAudit.manualInvalidClock,
  ...current.rawClockAudit.normalFailed,...current.rawClockAudit.manualFailed,...current.rawClockAudit.outcomeFailed,...current.rawClockAudit.normalNotClockAuditable])
  assert.ok(pending.includes(id)||resolutions.includes(id),'An invalid original clock needs a selected case or a separately bound new recording');
 const archived=nativeCaseSelection({root:profileRoot(historical),event:{pull_request:{draft:true}},git:()=>''});
 const archivePending=[...archived.caseIds,...archived.manualCaseIds,...archived.outcomeCaseIds];
 for(const audit of historical.historicalRawClockAudits){
  assert.equal(audit.rawReportsUnmodified,true);assert.equal(audit.duplicateRowsRemoved,false);
  const invalid=[...audit.normalInvalidClock,...audit.outcomeInvalidClock];
  assert.deepEqual(audit.closures.map(r=>r.caseId).sort(),invalid.sort());
  for(const closure of audit.closures){
   if(closure.clockClosure==='new-original-recording-clock-verified'){
    assert.equal(closure.currentHead,historical.head);assert.equal(closure.currentRunId,historical.runId);assert.match(closure.rawClipSha256,/^[a-f0-9]{64}$/u);
    assert.ok(archived.retainedEvidence.reports.some(r=>r.sha256===closure.reportSha256));
   }else{
    const later=historical.additionalRawClockClosures?.find(r=>r.caseId===closure.caseId);
    assert.ok(archivePending.includes(closure.caseId)||later,'An unresolved historical clock needs a pending case or a separately bound new original recording');
    if(later){
     assert.equal(later.historyRewritten,false);assert.equal(later.strictClockValidation.passed,true);
     assert.equal(later.resolves.historicalAuditSha256,audit.sha256);
     assert.ok(archived.retainedEvidence.additionalReports.some(r=>r.head===later.head&&r.runId===later.runId
      &&r.sha256===later.reportSha256&&r.caseIds.includes(closure.caseId)));
    }
   }
  }
 }
 for(const gate of ['originalSpeedAccepted','naturalnessAccepted','wholeGameAccepted'])assert.equal(current[gate],false);
 for(const mutate of [p=>{p.retainedEvidence.caseIds.pop();},p=>{p.retainedEvidence.caseIds.push(p.retainedEvidence.caseIds[0]);},
  p=>{p.retainedEvidence.outcomeCaseIds.pop();},p=>{(p.manualCaseIds.length?p.manualCaseIds:p.retainedEvidence.manualCaseIds).pop();},p=>{p.retainedEvidence.reports.pop();}]){
  const invalid=structuredClone(current);mutate(invalid);assert.throws(()=>nativeCaseSelection({root:profileRoot(invalid),event:{pull_request:{draft:true}},git:()=>''}));
 }
 const file=Object.keys(current.changedBlobs).find(file=>file.startsWith('app/')),blob=current.changedBlobs[file];assert.match(blob,/^[a-f0-9]{40}$/u);
 assert.equal(nativeCaseSelection({event:{pull_request:{draft:true}},git:args=>args[0]==='diff'?file:blob}).mode,'remaining');
 assert.equal(nativeCaseSelection({event:{pull_request:{draft:true}},git:args=>args[0]==='diff'?file:'f'.repeat(40)}).mode,'full');
});

test('supplement-only recovery can finish its original context without recapturing a normal case',()=>{
 // Synthetic report membership exercises an empty-normal partition only;
 // it never changes the checked-in source inventory or claims new evidence.
 const profile=structuredClone(historical);profile.retainedEvidence.caseIds.push(...profile.caseIds);profile.caseIds=[];
 profile.retainedEvidence.outcomeCaseIds.push(...profile.outcomeCaseIds);profile.outcomeCaseIds=[];
 const manual=[...profile.manualCaseIds,...profile.retainedEvidence.manualCaseIds];profile.manualCaseIds=manual.slice(0,1);profile.retainedEvidence.manualCaseIds=manual.slice(1);
 for(const report of [...profile.retainedEvidence.reports,...profile.retainedEvidence.additionalReports])for(const key of ['caseIds','manualCaseIds','outcomeCaseIds']){
  report[key]=report[key].filter(id=>profile.retainedEvidence[key].includes(id));
  if(report.validationGroups?.correctedContractRevalidation)report.validationGroups.correctedContractRevalidation[key]=report.validationGroups.correctedContractRevalidation[key].filter(id=>report[key].includes(id));
 }
 for(const inventory of profile.additionalEvidenceInventories??[])for(const correction of inventory.contractCorrections??[])correction.caseIds=correction.caseIds.filter(id=>profile.retainedEvidence.manualCaseIds.includes(id));
 for(const key of ['caseIds','manualCaseIds','outcomeCaseIds'])for(const id of profile.retainedEvidence[key]){
  const owned=[...profile.retainedEvidence.reports,...profile.retainedEvidence.additionalReports].some(r=>r[key].includes(id));
  if(!owned)profile.retainedEvidence.reports.find(r=>id.startsWith(r.shard+':'))[key].push(id);
 }
 profile.additionalRawClockClosures=resolvedWalkerFixture().additionalRawClockClosures;
 const walker=profile.additionalRawClockClosures[0];
 const originalOwner=profile.retainedEvidence.additionalReports.find(r=>r.head===walker.head&&r.sha256===walker.reportSha256);
 for(const r of profile.retainedEvidence.reports)r.caseIds=r.caseIds.filter(id=>id!==walker.caseId);
 if(!originalOwner.caseIds.includes(walker.caseId))originalOwner.caseIds.push(walker.caseId);
 const result=nativeCaseSelection({root:profileRoot(profile),event:{pull_request:{draft:true}},git:()=>''});
 assert.equal(result.caseIds.length,0);assert.deepEqual(result.shards,['forms-1']);assert.equal(result.manualCaseIds.length,1);assert.equal(result.outcomeCaseIds.length,0);
});

test('Ready reuse requires complete v2 inventory and exact reviewed source; explicit full always wins',()=>{
 const root=profileRoot(current),file=Object.keys(current.changedBlobs)[0],blob=current.changedBlobs[file],ready={pull_request:{draft:false}};
 const select=(event,changes=file,observed=blob)=>nativeCaseSelection({root,event,git:args=>args[0]==='diff'?changes:observed});
 assert.equal(select(ready).mode,'remaining');
 assert.equal(select(ready,file,'f'.repeat(40)).mode,'full');
 assert.equal(select(ready,'unreviewed-file').mode,'full');
 assert.equal(select({inputs:{capture_mode:'full'},pull_request:{draft:false}}).mode,'full');
 const broken=structuredClone(current);broken.retainedEvidence.caseIds.pop();
 assert.throws(()=>nativeCaseSelection({root:profileRoot(broken),event:ready,git:()=>''}));
});

test('additional successful reports retain their own head and can only bind unique kept observations',()=>{
 const profile=structuredClone(historical),report=profile.retainedEvidence.additionalReports[0],id=report.caseIds[0];
 const select=p=>nativeCaseSelection({root:profileRoot(p),event:{pull_request:{draft:false}},git:()=>''});
 assert.deepEqual(select(profile).retainedEvidence.additionalReports[0],report);
 for(const mutate of[
  r=>{r.head='unbound';},r=>{r.runId='';},r=>{r.sha256='unbound';},r=>{r.artifactId=0;},
  r=>{r.caseIds=[profile.caseIds[0]];},r=>{r.shard='forms-unknown';},
  r=>{r.caseIds.push(id);},r=>{r.manualCaseIds.push(id);},r=>{r.caseIds=[];},
  r=>{r.head='f'.repeat(40);},r=>{r.sha256='f'.repeat(64);},r=>{r.artifactId+=1;},
 ]){const broken=structuredClone(profile);mutate(broken.retainedEvidence.additionalReports[0]);assert.throws(()=>select(broken));}
 const repeated=structuredClone(profile);repeated.retainedEvidence.additionalReports.push(structuredClone(report));assert.throws(()=>select(repeated));
});

test('later raw-clock closures fail closed if their report, original audit or strict clock proof is unbound',()=>{
 const resolved=resolvedWalkerFixture();
 const select=p=>nativeCaseSelection({root:profileRoot(p),event:{pull_request:{draft:false}},git:()=>''});
 for(const mutate of[
  r=>{r.reportSha256='f'.repeat(64);},r=>{r.rawClipSha256='';},r=>{r.clockAuditSha256='';},
  r=>{r.head='f'.repeat(40);},r=>{r.runId='999999';},r=>{r.historyRewritten=true;},
  r=>{r.resolves.historicalAuditSha256='f'.repeat(64);},r=>{r.resolves.previousBaselineHead='f'.repeat(40);},
  r=>{r.strictClockValidation.nativeClockStrictlyIncreasing=false;},r=>{r.strictClockValidation.duplicateRowsRemoved=true;},
 ]){
  const broken=structuredClone(resolved);mutate(broken.additionalRawClockClosures[0]);assert.throws(()=>select(broken));
 }
 const broken=structuredClone(resolved);broken.retainedEvidence.additionalReports=broken.retainedEvidence.additionalReports.filter(r=>r.shard!=='forms-4');
 assert.throws(()=>select(broken));
});

test('every retained observation and historical open clock keeps its exact source owner',()=>{
 const resolved=resolvedWalkerFixture();
 const select=p=>nativeCaseSelection({root:profileRoot(p),event:{pull_request:{draft:false}},git:()=>''});
 for(const mutate of[
  p=>{p.retainedEvidence.additionalReports.shift();},
  p=>{p.retainedEvidence.reports[0].caseIds.pop();},
  p=>{p.additionalRawClockClosures=[];},
  p=>{delete p.additionalEvidenceInventory;},
 ]){
  const broken=structuredClone(resolved);mutate(broken);assert.throws(()=>select(broken));
 }
});

test('a later source keeps its own immutable inventory without relabelling earlier reports',()=>{
 // Synthetic identities test the metadata boundary; no checked-in evidence changes.
 const profile=structuredClone(historical),report=profile.retainedEvidence.additionalReports[0];
 const source={head:'e'.repeat(40),runId:'123456789',sha256:'d'.repeat(64),
  reports:[{shard:report.shard,sha256:report.sha256,artifactId:report.artifactId}]};
 report.head=source.head;report.runId=source.runId;profile.additionalEvidenceInventories=[...(profile.additionalEvidenceInventories??[]),source];
 const select=p=>nativeCaseSelection({root:profileRoot(p),event:{pull_request:{draft:false}},git:()=>''});
 assert.equal(select(profile).retainedEvidence.additionalReports[0].head,source.head);
 for(const mutate of[
  p=>{p.additionalEvidenceInventories.pop();},
  p=>{p.additionalEvidenceInventories.at(-1).reports[0].sha256='f'.repeat(64);},
  p=>{p.additionalEvidenceInventories.at(-1).reports[0].artifactId+=1;},
  p=>{p.additionalEvidenceInventories.push(structuredClone(p.additionalEvidenceInventories.at(-1)));},
 ]){const invalid=structuredClone(profile);mutate(invalid);assert.throws(()=>select(invalid));}
});

test('corrected manual observations retain the original failure and their separately bound unchanged timing contract',()=>{
 const select=p=>nativeCaseSelection({root:profileRoot(p),event:{pull_request:{draft:false}},git:()=>''});
 let fixture=historical;
 if(!fixture.retainedEvidence.additionalReports.some(r=>r.originalReportStatus==='failed'&&r.manualCaseIds.length)){
  // Reopening Ranger removes its active manual owners; their original failure
  // and corrected contract still belong to the immutable preceding profile.
  const previous=fixture.historicalRetainedOwnershipBeforeRangerPairCache?.profile;
  assert.match(previous?.gitHead??'',/^[a-f0-9]{40}$/u);assert.equal(previous.file,'scripts/v177-native-allunit-recovery.json');
  const raw=execFileSync('git',['show',previous.gitHead+':'+previous.file],{maxBuffer:8*1024*1024});
  assert.equal(createHash('sha256').update(raw).digest('hex'),previous.sha256);fixture=JSON.parse(raw);
 }
 const manualSource=p=>{
  const report=p.retainedEvidence.additionalReports.find(r=>r.originalReportStatus==='failed'&&r.manualCaseIds.length);
  const source=p.additionalEvidenceInventories.find(s=>s.head===report.head&&s.runId===report.runId);
  assert.ok(source?.contractCorrections?.length,'the manual correction belongs to its exact original source');return source;
 };
 assert.equal(select(fixture).mode,'remaining');manualSource(fixture);
 for(const mutate of[
  r=>{delete r.retainedEvidence.additionalReports.find(a=>a.originalReportStatus==='failed').validationGroups;},
  r=>{const report=r.retainedEvidence.additionalReports.find(a=>a.originalReportStatus==='failed');delete report.originalReportStatus;delete report.validationGroups;},
  r=>{const report=r.retainedEvidence.additionalReports.find(a=>a.originalReportStatus==='failed');delete report.originalReportStatus;delete report.reportStatus;delete report.validationGroups;},
  r=>{manualSource(r).contractCorrections=[];},
  r=>{manualSource(r).contractCorrections[0].conditions.allowedTicks.push(32);},
  r=>{manualSource(r).contractCorrections[0].conditions.numericToleranceAdded=true;},
 ]){const invalid=structuredClone(fixture);mutate(invalid);assert.throws(()=>select(invalid));}
});
