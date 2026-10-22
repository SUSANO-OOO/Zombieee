import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {selectNativeCases,nativeCaseSelection} from '../scripts/v177-native-allunit-selection.mjs';
import {SHARDS,planShard} from '../scripts/v177-native-allunit-manifest.mjs';

const current=JSON.parse(readFileSync('scripts/v177-native-allunit-recovery.json','utf8'));
const originalCaseIds=SHARDS.flatMap(s=>planShard(s.id)).filter(r=>r.viewport.width===1280).slice(0,54).map(r=>r.caseId);
const recovery={schema:'v177-native-allunit-recovery/v1',head:'1'.repeat(40),runId:'39422404651',originalCaseIds,
 caseIds:originalCaseIds.slice(30),retainedEvidence:{caseIds:originalCaseIds.slice(0,30)},
 changedBlobs:{'scripts/v177-native-allunit-cases.mjs':'2'.repeat(40)}};
function profileRoot(profile){const root=mkdtempSync(path.join(tmpdir(),'v177-selection-'));mkdirSync(path.join(root,'scripts'));
 writeFileSync(path.join(root,'scripts','v177-native-allunit-recovery.json'),JSON.stringify(profile));return root;}
const originalRoot=profileRoot(recovery);
test('unfinished selection never substitutes an unknown or duplicate case and leaves the full inventory intact',()=>{
  const selection=selectNativeCases(recovery.caseIds);
  assert.equal(selection.caseIds.length,24);
  assert.equal(selection.shards.length,3);
  assert.equal(recovery.originalCaseIds.length,54);assert.equal(recovery.retainedEvidence.caseIds.length,30);
  assert.equal(SHARDS.flatMap(s=>planShard(s.id)).length,432);
  for(const ids of [[],['unknown'],[recovery.caseIds[0],recovery.caseIds[0]]])assert.throws(()=>selectNativeCases(ids));
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
 for(const historical of current.historicalRawClockAudits){
  assert.equal(historical.rawReportsUnmodified,true);assert.equal(historical.duplicateRowsRemoved,false);
  const invalid=[...historical.normalInvalidClock,...historical.outcomeInvalidClock];
  assert.deepEqual(historical.closures.map(r=>r.caseId).sort(),invalid.sort());
  for(const closure of historical.closures){
   if(closure.clockClosure==='new-original-recording-clock-verified'){
    assert.equal(closure.currentHead,current.head);assert.equal(closure.currentRunId,current.runId);assert.match(closure.rawClipSha256,/^[a-f0-9]{64}$/u);
    assert.ok(selected.retainedEvidence.reports.some(r=>r.sha256===closure.reportSha256));
   }else{
    const later=current.additionalRawClockClosures?.find(r=>r.caseId===closure.caseId);
    assert.ok(pending.includes(closure.caseId)||later,'An unresolved historical clock needs a pending case or a separately bound new original recording');
    if(later){
     assert.equal(later.historyRewritten,false);assert.equal(later.strictClockValidation.passed,true);
     assert.equal(later.resolves.historicalAuditSha256,historical.sha256);
     assert.ok(selected.retainedEvidence.additionalReports.some(r=>r.head===later.head&&r.runId===later.runId
      &&r.sha256===later.reportSha256&&r.caseIds.includes(closure.caseId)));
    }
   }
  }
 }
 for(const gate of ['originalSpeedAccepted','naturalnessAccepted','wholeGameAccepted'])assert.equal(current[gate],false);
 for(const mutate of [p=>{p.retainedEvidence.caseIds.pop();},p=>{p.retainedEvidence.caseIds.push(p.retainedEvidence.caseIds[0]);},
  p=>{p.retainedEvidence.outcomeCaseIds.pop();},p=>{p.manualCaseIds.pop();},p=>{p.retainedEvidence.reports.pop();}]){
  const invalid=structuredClone(current);mutate(invalid);assert.throws(()=>nativeCaseSelection({root:profileRoot(invalid),event:{pull_request:{draft:true}},git:()=>''}));
 }
 const file='app/AshfallGame.tsx',blob=current.changedBlobs[file];assert.match(blob,/^[a-f0-9]{40}$/u);
 assert.equal(nativeCaseSelection({event:{pull_request:{draft:true}},git:args=>args[0]==='diff'?file:blob}).mode,'remaining');
 assert.equal(nativeCaseSelection({event:{pull_request:{draft:true}},git:args=>args[0]==='diff'?file:'f'.repeat(40)}).mode,'full');
});

test('supplement-only recovery can finish its original context without recapturing a normal case',()=>{
 const profile=structuredClone(current);profile.retainedEvidence.caseIds.push(...profile.caseIds);profile.caseIds=[];
 profile.retainedEvidence.outcomeCaseIds.push(...profile.outcomeCaseIds);profile.outcomeCaseIds=[];
 const manual=[...profile.manualCaseIds,...profile.retainedEvidence.manualCaseIds];profile.manualCaseIds=manual.slice(0,1);profile.retainedEvidence.manualCaseIds=manual.slice(1);
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
 const profile=structuredClone(current),id=profile.retainedEvidence.caseIds[0];
 // Synthetic metadata tests ownership only; it is never an evidence claim.
 const report={head:'a'.repeat(40),runId:'123456',sha256:'b'.repeat(64),artifactId:123,
  shard:id.split(':')[0],caseIds:[id],manualCaseIds:[],outcomeCaseIds:[]};
 profile.retainedEvidence.additionalReports.push(report);
 const select=p=>nativeCaseSelection({root:profileRoot(p),event:{pull_request:{draft:false}},git:()=>''});
 assert.deepEqual(select(profile).retainedEvidence.additionalReports.at(-1),report);
 for(const mutate of[
  r=>{r.head='unbound';},r=>{r.runId='';},r=>{r.sha256='unbound';},r=>{r.artifactId=0;},
  r=>{r.caseIds=[profile.caseIds[0]];},r=>{r.shard='forms-unknown';},
  r=>{r.caseIds.push(id);},r=>{r.manualCaseIds.push(id);},r=>{r.caseIds=[];},
 ]){const broken=structuredClone(profile);mutate(broken.retainedEvidence.additionalReports.at(-1));assert.throws(()=>select(broken));}
 const repeated=structuredClone(profile);repeated.retainedEvidence.additionalReports.push(structuredClone(report));assert.throws(()=>select(repeated));
});

test('later raw-clock closures fail closed if their report, original audit or strict clock proof is unbound',()=>{
 const select=p=>nativeCaseSelection({root:profileRoot(p),event:{pull_request:{draft:false}},git:()=>''});
 for(const mutate of[
  r=>{r.reportSha256='f'.repeat(64);},r=>{r.rawClipSha256='';},r=>{r.clockAuditSha256='';},
  r=>{r.head='f'.repeat(40);},r=>{r.runId='999999';},r=>{r.historyRewritten=true;},
  r=>{r.resolves.historicalAuditSha256='f'.repeat(64);},r=>{r.resolves.previousBaselineHead='f'.repeat(40);},
  r=>{r.strictClockValidation.nativeClockStrictlyIncreasing=false;},r=>{r.strictClockValidation.duplicateRowsRemoved=true;},
 ]){
  const broken=structuredClone(current);mutate(broken.additionalRawClockClosures[0]);assert.throws(()=>select(broken));
 }
 const broken=structuredClone(current);broken.retainedEvidence.additionalReports=broken.retainedEvidence.additionalReports.filter(r=>r.shard!=='forms-4');
 assert.throws(()=>select(broken));
});
