import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {nativeCaseSelection} from './v177-native-allunit-selection.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
import {MANUAL_ABILITY_REGISTRY as manual} from '../app/manualAbilities.js';
export function correctionCases(scope){
  assert.ok(['desktop','mobile390','mobile340'].includes(scope));
  if(scope!=='desktop')return [...['brawler','crazy-king','guardian','gunner','zakimiya','mrs-chiha'].map(kind=>({kind,mode:'manual'})),{kind:'brawler',mode:'duet'}];
  return [...Object.keys(manual).map(kind=>({kind,mode:'manual'})),
    ...['grappler','ooze','sprinter','gate-eater','spindle','resonator','cagewalker','choir-knot','pall-manta','anchor-bloom',
      'kurome','mother','ooguchi','gairen','mugarian-president-mutated','takuya-omega','takuya'].map(kind=>({kind,mode:'enemy'})),
    ...['brute','guardian','tky','takuya','takuya-omega','crazy-king','kumaverson','babayaga','brawler'].map(kind=>({kind,mode:'engage'}))];
}

// Divide only the work, never the original cases or their acceptance limits.
export function correctionCapturePart(scope,part='all'){
  const plan=correctionCases(scope);
  assert.ok(part==='all'||scope==='desktop'&&['1','2'].includes(part),'Unknown correction partition');
  return part==='all'?plan:plan.filter((_,i)=>i%2===Number(part)-1);
}
export function correctionCaptureFolder(scope,part='all'){
  correctionCapturePart(scope,part);
  return scope+(part==='all'?'':'-'+part);
}

// Reuse is limited by the same exact-source guard as the original motion
// inventory. Unknown revisions run the whole original plan. Earlier failures
// and the boss whose name changed remain fresh observations, never old passes.
export async function correctionCaseSelection(scope,{event,root=process.cwd(),select=nativeCaseSelection,part=process.env.V105_CAPTURE_PART??'all'}={}){
  const plan=correctionCapturePart(scope,part),full={mode:'full',plan,retained:[],...(part==='all'?{}:{part})};
  const selection=select({event,root});if(selection.mode!=='remaining')return full;
  const profile=JSON.parse(await readFile(path.join(root,'scripts/v177-native-allunit-recovery.json'),'utf8'));
  const source=profile.fiveCorrections;if(!source)return full;
  const bytes=await readFile(path.join(root,source.file));assert.equal(sha(bytes),source.sha256);
  const inventory=JSON.parse(bytes),all=['desktop','mobile390','mobile340'].flatMap(s=>correctionCases(s).map(r=>s+':'+r.kind+':'+r.mode));
  assert.equal(inventory.head,source.head);assert.equal(inventory.runId,source.runId);
  assert.equal(inventory.schema,'v105-five-corrections-retained/v1');
  assert.deepEqual([...new Set(inventory.reports.map(r=>r.scope))].sort(),['desktop','mobile340','mobile390']);
  assert.equal(new Set(inventory.reports.map(r=>r.head+':'+r.runId+':'+r.scope)).size,inventory.reports.length,
    'One report identity per original candidate and scope');
  const kept=inventory.retained.map(r=>r.caseId),pending=inventory.pending;
  assert.deepEqual([...kept,...pending].sort(),[...all].sort(),'All original correction cases need one owner or a fresh recording');
  assert.equal(new Set([...kept,...pending]).size,all.length);
  for(const row of inventory.retained){
    const report=inventory.reports.find(r=>r.scope===row.caseId.split(':')[0] && r.head===row.head && r.runId===row.runId);
    assert.ok(report&&report.head===row.head&&report.runId===row.runId&&report.reportSha256===row.reportSha256
      &&report.artifactId===row.artifactId,'Retained AV must belong to its original scope report');
    assert.match(row.reportSha256,/^[a-f0-9]{64}$/u);assert.match(row.clipSha256,/^[a-f0-9]{64}$/u);
    assert.ok(Number.isSafeInteger(row.artifactId)&&row.artifactId>0&&row.bytes>0&&row.bytes<=8388608);
    assert.equal(row.originalStatus,'recorded');assert.equal(row.encodedPtsVerified,true);
    assert.equal(row.fullAvDecode.completed,true);assert.equal(row.fullAvDecode.requiredMixerAudioStream,true);assert.equal(row.fullAvDecode.errors,0);
    assert.ok(Number.isFinite(row.driftMs)&&Math.abs(row.driftMs)<=120);
    assert.ok(Number.isFinite(row.maxGapMs)&&row.maxGapMs<=250&&row.maxGapMs>0);
    assert.ok(Number.isFinite(row.caseElapsedMs)&&row.caseElapsedMs<30000);
  }
  return{mode:'remaining',...(part==='all'?{}:{part}),source:{file:source.file,sha256:source.sha256,head:inventory.head,runId:inventory.runId},
    plan:plan.filter(r=>pending.includes(scope+':'+r.kind+':'+r.mode)),retained:inventory.retained.filter(r=>r.caseId.startsWith(scope+':'))};
}
