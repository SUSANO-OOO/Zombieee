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

export function nativeCaseSelection({event,forceFull=process.env.CI_CAPTURE_FRESH==='true',root=process.cwd(),git=args=>execFileSync('git',args,
  {cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024}).trim()}={}){
  const all=SHARDS.flatMap(s=>planShard(s.id)),full={mode:'full',...selectNativeCases(all.map(r=>r.caseId))};
  assert.equal(typeof forceFull,'boolean');
  if(forceFull||event.inputs?.capture_mode==='full')return full;
  if(event.inputs?.capture_mode==='abomination-acquisition-control'){
    assert.equal(event.pull_request,undefined,'An isolated acquisition comparison is dispatch-only');
    return{mode:'acquisition-control',...selectNativeCases(['forms-6:abomination:attack:844x340']),manualCaseIds:[],outcomeCaseIds:[],
      scope:'One unchanged original Abomination case with a 60Hz canvas acquisition-request timer; no retained, all-unit or release acceptance'};
  }
  if(event.inputs?.capture_mode==='brute-codec-control'){
    assert.equal(event.pull_request,undefined,'An isolated recorder comparison is dispatch-only');
    return{mode:'codec-control',...selectNativeCases(['forms-2:brute:attack:1280x720']),manualCaseIds:[],outcomeCaseIds:[],
      scope:'One unchanged original Brute case for native codec comparison; not all-unit, performance or release acceptance'};
  }
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
    const inventories=[...(recovery.additionalEvidenceInventory?[recovery.additionalEvidenceInventory]:[]),
      ...(recovery.additionalEvidenceInventories??[])];
    const inventory=inventories.length>0;
    if((retained.additionalReports?.length??0)>0||(recovery.additionalRawClockClosures?.length??0)>0
      ||retained.reports.some(r=>Array.isArray(r.caseIds)))assert.ok(inventory,'Later report ownership requires its source inventory');
    assert.equal(new Set(inventories.map(r=>r.head+':'+r.runId)).size,inventories.length,'Duplicate source inventory');
    for(const source of inventories){
      assert.match(source.head??'',/^[a-f0-9]{40}$/u);assert.match(source.runId??'',/^[1-9][0-9]+$/u);
      assert.match(source.sha256??'',/^[a-f0-9]{64}$/u);
      assert.ok(Array.isArray(source.reports)&&new Set(source.reports.map(r=>r.shard)).size===source.reports.length);
    }
    const additionalIds=new Set();
    for(const report of retained.additionalReports??[]){
      assert.match(report.head??'',/^[a-f0-9]{40}$/u);assert.match(String(report.runId??''),/^[1-9][0-9]+$/u);
      assert.match(report.sha256??'',/^[a-f0-9]{64}$/u);assert.ok(Number.isSafeInteger(report.artifactId)&&report.artifactId>0);
      if(inventory){
        const source=inventories.find(r=>r.head===report.head&&r.runId===report.runId);
        assert.ok(source?.reports.some(r=>r.shard===report.shard&&r.sha256===report.sha256&&r.artifactId===report.artifactId),
          'Additional report identity must match its immutable source inventory');
        const sourceCorrectedIds=(source.contractCorrections??[]).flatMap(r=>r.caseIds??[]);
        if(report.manualCaseIds?.length&&(report.originalReportStatus==='failed'||report.reportStatus==='failed'
          ||report.manualCaseIds.some(id=>sourceCorrectedIds.includes(id)))){
          const corrected=report.validationGroups?.correctedContractRevalidation;
          assert.ok(corrected,'Original failed manual rows require separate corrected-contract evidence');
          assert.deepEqual([...corrected.manualCaseIds].sort(),[...report.manualCaseIds].sort());
          assert.deepEqual(corrected.caseIds,[]);assert.deepEqual(corrected.outcomeCaseIds,[]);
          const closure=source.contractCorrections?.find(r=>r.sha256===corrected.correctionSidecarSha256);
          assert.ok(closure,'Manual correction must bind its immutable source sidecar');
          for(const key of ['sha256','originalContractSha256','correctedContractSourceSha256'])assert.match(closure[key]??'',/^[a-f0-9]{64}$/u);
          assert.equal(closure.correctedContractSourceSha256,corrected.correctedContractSourceSha256);
          assert.deepEqual([...closure.caseIds].sort(),[...report.manualCaseIds].sort());
          assert.equal(closure.conditions.windupSeconds,.5);assert.equal(closure.conditions.recoverySeconds,.18);
          assert.equal(closure.conditions.impactDamage,92);assert.equal(closure.conditions.stepSeconds,1/60);
          assert.deepEqual(closure.conditions.allowedTicks,[29,30,31]);
          for(const key of ['numericToleranceAdded','deadlineChanged','sourceRafConditionsChanged','clipConditionsChanged'])assert.equal(closure.conditions[key],false);
        }
      }
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
    if(inventory){
      const baselineIds=new Set();
      for(const report of retained.reports)for(const key of ['caseIds','manualCaseIds','outcomeCaseIds']){
        assert.ok(Array.isArray(report[key]));
        for(const id of report[key]){
          assert.ok(retained[key].includes(id)&&id.startsWith(report.shard+':'),'Baseline report must own a retained observation in its shard');
          assert.ok(!baselineIds.has(id)&&!additionalIds.has(id),'A retained observation needs exactly one original report owner');
          baselineIds.add(id);
        }
      }
      assert.deepEqual([...baselineIds,...additionalIds].sort(),[...retained.caseIds,...retained.manualCaseIds,...retained.outcomeCaseIds].sort(),
        'Every retained observation needs a source-bound baseline or additional report');
    }
    const clockClosures=new Set();
    for(const closure of recovery.additionalRawClockClosures??[]){
      assert.ok(!clockClosures.has(closure.caseId),'Duplicate later clock closure');clockClosures.add(closure.caseId);
      for(const key of ['reportSha256','rawClipSha256','clockAuditSha256'])assert.match(closure[key]??'',/^[a-f0-9]{64}$/u);
      assert.equal(closure.historyRewritten,false);
      const report=retained.additionalReports?.find(r=>r.head===closure.head&&r.runId===closure.runId&&r.sha256===closure.reportSha256);
      assert.ok(report&&[...report.caseIds,...report.manualCaseIds,...report.outcomeCaseIds].includes(closure.caseId),
        'A later clock closure must bind its own successful retained report');
      const historical=recovery.historicalRawClockAudits?.find(r=>r.head===closure.resolves?.historicalHead
        &&r.runId===closure.resolves?.historicalRunId&&r.sha256===closure.resolves?.historicalAuditSha256);
      assert.ok(historical?.closures.some(r=>r.caseId===closure.caseId&&r.clockClosure==='unresolved-needs-new-recording'),
        'A later clock closure must resolve an unchanged historical open clock');
      assert.equal(closure.resolves.previousBaselineHead,recovery.head);assert.equal(closure.resolves.previousBaselineRunId,recovery.runId);
      const validation=closure.strictClockValidation;
      for(const key of ['passed','rawReportsUnmodified','nativeClockStrictlyIncreasing','simulationClockNondecreasing',
        'realmOwnerAndOrderedMembers','sourceRafClockStrictlyIncreasing','overflowFree'])assert.equal(validation?.[key],true);
      assert.equal(validation.duplicateRowsRemoved,false);assert.equal(validation.sourceHead,closure.head);
      assert.equal(validation.postpaintContract,'passed');
    }
    const pendingIds=new Set([...selected.caseIds,...recovery.manualCaseIds,...recovery.outcomeCaseIds]);
    for(const historical of recovery.historicalRawClockAudits??[])for(const closure of historical.closures??[]){
      if(closure.clockClosure==='unresolved-needs-new-recording'&&!pendingIds.has(closure.caseId))
        assert.ok(clockClosures.has(closure.caseId),'A retained historical open clock requires its separately bound new recording');
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

export function isRangerCaptureSelection(selection){
  const normal=planShard('forms-1').filter(r=>r.form==='ranger'),engage=normal.filter(r=>r.phase==='engage');
  const allowed={caseIds:normal.map(r=>r.caseId),outcomeCaseIds:engage.map(r=>r.caseId.replace(':engage:',':controlled-outcome:')),
    manualCaseIds:engage.map(r=>r.caseId.replace(':engage:',':ranger-manual-precision:'))};
  return selection.mode==='remaining'&&JSON.stringify(selection.shards)===JSON.stringify(['forms-1'])
    &&Object.keys(allowed).every(k=>Array.isArray(selection[k])&&new Set(selection[k]).size===selection[k].length&&selection[k].every(id=>allowed[k].includes(id)))
    &&Object.keys(allowed).some(k=>selection[k].length>0);
}
export function nativeCaptureHostControl(event,selection){
  if(event.pull_request&&isRangerCaptureSelection(selection))return 'ranger-motion';
  return event.pull_request?.draft===true&&selection.mode==='remaining'&&selection.caseIds.length===1
    &&selection.caseIds[0]==='forms-2:brute:attack:1280x720'&&selection.outcomeCaseIds.length===0
    &&selection.manualCaseIds.length===0?'brute-attack-1280':event.pull_request&&selection.mode==='remaining'
    &&selection.caseIds.length===1&&selection.caseIds[0]==='forms-4:mayo-chan:attack:1280x720'
    &&selection.outcomeCaseIds.length===0&&selection.manualCaseIds.length===0?'mayo-attack-1280':'none';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  const selection=nativeCaseSelection({event});
  assert.ok(process.env.GITHUB_OUTPUT);
  appendFileSync(process.env.GITHUB_OUTPUT,'shards='+JSON.stringify(selection.shards)+'\n');
  appendFileSync(process.env.GITHUB_OUTPUT,'native_host_control='+nativeCaptureHostControl(event,selection)+'\n');
  console.log(JSON.stringify(selection));
}
