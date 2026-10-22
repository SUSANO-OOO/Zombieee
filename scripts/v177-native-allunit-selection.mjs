import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,appendFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {SHARDS,planShard} from './v177-native-allunit-manifest.mjs';

export function selectNativeCases(ids,{allowEmpty=false}={}){
  const all=SHARDS.flatMap(s=>planShard(s.id));
  assert.ok(Array.isArray(ids)&&(ids.length>0||allowEmpty));
  assert.equal(new Set(ids).size,ids.length,'Duplicate selected native case');
  assert.ok(ids.every(id=>all.some(row=>row.caseId===id)),'Unknown selected native case');
  return {caseIds:all.filter(r=>ids.includes(r.caseId)).map(r=>r.caseId),
    shards:SHARDS.filter(s=>ids.some(id=>id.startsWith(s.id+':'))).map(s=>s.id)};
}

export function nativeCaseSelection({event,root=process.cwd(),git=args=>execFileSync('git',args,
  {cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024}).trim()}={}){
  const all=SHARDS.flatMap(s=>planShard(s.id)),full={mode:'full',...selectNativeCases(all.map(r=>r.caseId))};
  if(event.inputs?.capture_mode==='full')return full;
  const bytes=readFileSync(path.join(root,'scripts/v177-native-allunit-recovery.json'));
  const recovery=JSON.parse(bytes);assert.ok(['v177-native-allunit-recovery/v1','v177-native-allunit-recovery/v2'].includes(recovery.schema));
  // Ready PRs may reuse only the v2 profile which partitions every original
  // normal, outcome and manual case and pins every reviewed changed blob.
  // Legacy partial-inventory profiles still require a full Ready capture.
  if(event.pull_request?.draft===false&&recovery.schema!=='v177-native-allunit-recovery/v2')return full;
  assert.match(recovery.head,/^[0-9a-f]{40}$/u);assert.match(recovery.runId,/^[1-9][0-9]+$/u);
  const selected=selectNativeCases(recovery.caseIds,{allowEmpty:recovery.schema==='v177-native-allunit-recovery/v2'});let baseline;
  if(recovery.schema==='v177-native-allunit-recovery/v2'){
    const retained=recovery.retainedEvidence;
    assert.equal(retained.head,recovery.head);assert.equal(retained.runId,recovery.runId);
    const partition=(pending,kept,expected)=>{
      for(const list of [pending,kept])assert.ok(Array.isArray(list)&&new Set(list).size===list.length);
      assert.deepEqual([...pending,...kept].sort(),[...expected].sort(),'Pending and retained observations must partition their original inventory');
    };
    partition(selected.caseIds,retained.caseIds,all.map(r=>r.caseId));
    const outcomes=all.filter(r=>r.phase==='engage').map(r=>r.caseId.replace(':engage:',':controlled-outcome:'));
    const manual=all.filter(r=>r.form==='ranger'&&r.phase==='engage').map(r=>r.caseId.replace(':engage:',':ranger-manual-precision:'));
    partition(recovery.outcomeCaseIds,retained.outcomeCaseIds,outcomes);
    partition(recovery.manualCaseIds,retained.manualCaseIds,manual);
    assert.deepEqual(retained.reports.map(r=>r.shard).sort(),SHARDS.map(s=>s.id).sort());
    for(const report of retained.reports)assert.match(report.sha256,/^[a-f0-9]{64}$/u);
    // Later successful observations keep their own immutable report and head;
    // the twelve baseline reports above never acquire a newer candidate's label.
    const additionalIds=new Set();
    for(const report of retained.additionalReports??[]){
      assert.match(report.head??'',/^[a-f0-9]{40}$/u);assert.match(String(report.runId??''),/^[1-9][0-9]+$/u);
      assert.match(report.sha256??'',/^[a-f0-9]{64}$/u);assert.ok(Number.isSafeInteger(report.artifactId)&&report.artifactId>0);
      assert.ok(SHARDS.some(s=>s.id===report.shard));let count=0;
      for(const key of ['caseIds','manualCaseIds','outcomeCaseIds']){
        assert.ok(Array.isArray(report[key]));
        for(const id of report[key]){
          assert.ok(retained[key].includes(id)&&id.startsWith(report.shard+':'),'Additional report must own a retained case in its original shard');
          assert.ok(!additionalIds.has(id),'A retained case must have only one additional report owner');
          additionalIds.add(id);count++;
        }
      }
      assert.ok(count>0,'An additional report must retain an actual observation');
    }
    selected.outcomeCaseIds=recovery.outcomeCaseIds;selected.manualCaseIds=recovery.manualCaseIds;
    selected.shards=SHARDS.filter(s=>[...selected.caseIds,...selected.outcomeCaseIds,...selected.manualCaseIds].some(id=>id.startsWith(s.id+':'))).map(s=>s.id);
    baseline={head:recovery.head,runId:recovery.runId,successfulCases:retained.caseIds.length,
      pendingCandidateCases:selected.caseIds.length,scope:recovery.scope};
  }else{
    assert.equal(recovery.runId,'39422404651');assert.ok(selected.caseIds.length<=54);
    if(recovery.originalCaseIds){
    const original=selectNativeCases(recovery.originalCaseIds),retained=selectNativeCases(recovery.retainedEvidence.caseIds);
    assert.equal(original.caseIds.length,54);
    assert.equal(new Set([...selected.caseIds,...retained.caseIds]).size,54);
    assert.deepEqual([...selected.caseIds,...retained.caseIds].sort(),[...original.caseIds].sort(),
      'Selected and retained cases must partition the original54');
    }else assert.equal(selected.caseIds.length,54);
    baseline={head:recovery.head,runId:recovery.runId,successfulCases:378,failedCases:1,unexecutedCases:53};
  }
  const changes=git(['diff','--no-renames','--name-only',recovery.head,'HEAD']).split(/\r?\n/u).filter(Boolean);
  for(const file of changes){
    if(file==='scripts/v177-native-allunit-recovery.json')continue;
    if(!recovery.changedBlobs[file]||git(['rev-parse','HEAD:'+file])!==recovery.changedBlobs[file])return full;
  }
  // Exact reviewed revisions only. Any later product/contract/driver
  // change falls back to all432; earlier successes retain their original head.
  return {mode:'remaining',baseline,retainedEvidence:recovery.retainedEvidence??null,
    profileSha256:createHash('sha256').update(bytes).digest('hex'),...selected};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  const selection=nativeCaseSelection({event});
  assert.ok(process.env.GITHUB_OUTPUT);
  appendFileSync(process.env.GITHUB_OUTPUT,'shards='+JSON.stringify(selection.shards)+'\n');
  const nativeHostControl=event.pull_request?.draft===true&&selection.mode==='remaining'&&selection.caseIds.length===1
    &&selection.caseIds[0]==='forms-2:brute:attack:1280x720'&&selection.outcomeCaseIds.length===0
    &&selection.manualCaseIds.length===0?'brute-attack-1280':'none';
  appendFileSync(process.env.GITHUB_OUTPUT,'native_host_control='+nativeHostControl+'\n');
  console.log(JSON.stringify(selection));
}
