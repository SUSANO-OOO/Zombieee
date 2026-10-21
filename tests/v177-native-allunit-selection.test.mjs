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

test('current recovery partitions normal, outcome and manual observations without repeating retained successes',()=>{
 assert.equal(current.schema,'v177-native-allunit-recovery/v2');
 const selected=nativeCaseSelection({event:{pull_request:{draft:true}},git:()=>''});
 assert.deepEqual(selected.caseIds,current.caseIds);assert.deepEqual(selected.outcomeCaseIds,current.outcomeCaseIds);
 assert.deepEqual(selected.manualCaseIds,current.manualCaseIds);
 assert.equal(selected.caseIds.length,9);assert.equal(selected.retainedEvidence.caseIds.length,423);
 assert.equal(selected.outcomeCaseIds.length,3);assert.equal(selected.retainedEvidence.outcomeCaseIds.length,141);
 assert.equal(selected.manualCaseIds.length,0);assert.equal(selected.retainedEvidence.manualCaseIds.length,3);
 assert.deepEqual(selected.shards,['forms-2']);
 assert.ok([...selected.caseIds,...selected.outcomeCaseIds].every(id=>id.includes(':brute:')),'Only the changed hammer legs need fresh native footage');
 const affected=current.affectedDeathForms;
 assert.equal(affected.length,11);
 assert.equal([...selected.retainedEvidence.outcomeCaseIds,...selected.outcomeCaseIds].filter(id=>affected.some(form=>id.includes(':'+form+':'))).length,33);
 assert.ok(!selected.outcomeCaseIds.some(id=>/:(scout|medic|ranger):controlled-outcome:/u.test(id)));
 assert.equal(current.observationGaps.cases.length,32);
 assert.equal(current.unacceptedVisualWindows.previousCases.length,11);
 assert.equal(current.unacceptedVisualWindows.cases.length,0);
 assert.deepEqual([...selected.caseIds,...selected.outcomeCaseIds].sort(),current.reopenedVisualCases.map(g=>g.caseId).sort(),
  'newly reported knee defects reopen their affected footage without repeating other forms');
 assert.equal(selected.retainedEvidence.additionalReports.flatMap(r=>r.caseIds).length,73);
 const hitRepair=selected.retainedEvidence.additionalReports.find(r=>r.runId==='39538653281');
 assert.equal(hitRepair.head,'a2a00a31b9958d9ab1ed2a30c44a56d08837fe12');
 assert.equal(hitRepair.caseIds.length,6);assert.ok(hitRepair.caseIds.every(id=>/:kumaverson:(attack|engage):/u.test(id)));
 assert.equal(selected.retainedEvidence.additionalReports.flatMap(r=>r.outcomeCaseIds).length,58);
 assert.equal(selected.retainedEvidence.additionalReports.flatMap(r=>r.manualCaseIds??[]).length,1);
 assert.ok(selected.retainedEvidence.additionalReports.some(r=>r.runId==='39525887343'&&r.caseIds.includes('forms-1:brawler:attack:844x390')),'The fresh clean context supplies Brawler; the original request failure stays in its original report');
 for(const mutate of [p=>{p.retainedEvidence.caseIds.pop();},p=>{p.retainedEvidence.caseIds.push(p.retainedEvidence.caseIds[0]);},
  p=>{p.retainedEvidence.outcomeCaseIds.pop();},p=>{p.retainedEvidence.manualCaseIds.pop();},p=>{p.retainedEvidence.reports.pop();}]){
  const invalid=structuredClone(current);mutate(invalid);assert.throws(()=>nativeCaseSelection({root:profileRoot(invalid),event:{pull_request:{draft:true}},git:()=>''}));
 }
 const file='app/combatPresentation.js',blob=current.changedBlobs[file];
 assert.equal(nativeCaseSelection({event:{pull_request:{draft:true}},git:args=>args[0]==='diff'?file:blob}).mode,'remaining');
 assert.equal(nativeCaseSelection({event:{pull_request:{draft:true}},git:args=>args[0]==='diff'?file:'f'.repeat(40)}).mode,'full');
});

test('supplement-only recovery can finish its original context without recapturing a normal case',()=>{
 const profile=structuredClone(current);profile.retainedEvidence.caseIds.push(...profile.caseIds);profile.caseIds=[];
 profile.retainedEvidence.outcomeCaseIds.push(...profile.outcomeCaseIds);profile.outcomeCaseIds=[];
 profile.manualCaseIds=[profile.retainedEvidence.manualCaseIds.shift()];
 const result=nativeCaseSelection({root:profileRoot(profile),event:{pull_request:{draft:true}},git:()=>''});
 assert.equal(result.caseIds.length,0);assert.deepEqual(result.shards,['forms-1']);assert.equal(result.manualCaseIds.length,1);assert.equal(result.outcomeCaseIds.length,0);
});
