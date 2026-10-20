import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,appendFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {SHARDS,planShard} from './v177-native-allunit-manifest.mjs';

export function selectNativeCases(ids){
  const all=SHARDS.flatMap(s=>planShard(s.id));
  assert.ok(Array.isArray(ids)&&ids.length>0);
  assert.equal(new Set(ids).size,ids.length,'Duplicate selected native case');
  assert.ok(ids.every(id=>all.some(row=>row.caseId===id)),'Unknown selected native case');
  return {caseIds:all.filter(r=>ids.includes(r.caseId)).map(r=>r.caseId),
    shards:SHARDS.filter(s=>ids.some(id=>id.startsWith(s.id+':'))).map(s=>s.id)};
}

export function nativeCaseSelection({event,root=process.cwd(),git=args=>execFileSync('git',args,
  {cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024}).trim()}={}){
  const all=SHARDS.flatMap(s=>planShard(s.id)),full={mode:'full',...selectNativeCases(all.map(r=>r.caseId))};
  if(event.pull_request?.draft===false||event.inputs?.capture_mode==='full')return full;
  const bytes=readFileSync(path.join(root,'scripts/v177-native-allunit-recovery.json'));
  const recovery=JSON.parse(bytes);assert.equal(recovery.schema,'v177-native-allunit-recovery/v1');
  assert.match(recovery.head,/^[0-9a-f]{40}$/u);assert.equal(recovery.runId,'39422404651');
  const selected=selectNativeCases(recovery.caseIds);assert.ok(selected.caseIds.length<=54);
  if(recovery.originalCaseIds){
    const original=selectNativeCases(recovery.originalCaseIds),retained=selectNativeCases(recovery.retainedEvidence.caseIds);
    assert.equal(original.caseIds.length,54);
    assert.equal(new Set([...selected.caseIds,...retained.caseIds]).size,54);
    assert.deepEqual([...selected.caseIds,...retained.caseIds].sort(),[...original.caseIds].sort(),
      'Selected and retained cases must partition the original54');
  }else assert.equal(selected.caseIds.length,54);
  const changes=git(['diff','--no-renames','--name-only',recovery.head,'HEAD']).split(/\r?\n/u).filter(Boolean);
  for(const file of changes){
    if(file==='scripts/v177-native-allunit-recovery.json')continue;
    if(!recovery.changedBlobs[file]||git(['rev-parse','HEAD:'+file])!==recovery.changedBlobs[file])return full;
  }
  // Exact reviewed harness revisions only. Any later product/contract/driver
  // change falls back to all432; earlier successes retain their original head.
  return {mode:'remaining',baseline:{head:recovery.head,runId:recovery.runId,
    successfulCases:378,failedCases:1,unexecutedCases:53},retainedEvidence:recovery.retainedEvidence??null,
    profileSha256:createHash('sha256').update(bytes).digest('hex'),...selected};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  const selection=nativeCaseSelection({event});
  assert.ok(process.env.GITHUB_OUTPUT);
  appendFileSync(process.env.GITHUB_OUTPUT,'shards='+JSON.stringify(selection.shards)+'\n');
  console.log(JSON.stringify(selection));
}
