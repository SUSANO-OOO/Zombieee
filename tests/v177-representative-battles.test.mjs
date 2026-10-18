import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { UNIT_CONTENT } from '../app/content/unitCatalog.js';
import { s25FireDeploymentPriorities } from '../scripts/v100-normal-tactical-input.mjs';
import { createV177RepresentativeBudget } from '../scripts/v177-representative-budget.mjs';
import { assertRepresentativeBattleObservation, V177_REPRESENTATIVE_WINDOW_MS } from '../scripts/v177-representative-battles.mjs';

function observed(outcome, number = 14) {
  const fixture = createV177RepresentativeBudget(number);
  const openingSave = structuredClone(fixture.save);
  openingSave.flowState.phase = 'battle';
  const finalSave = structuredClone(openingSave);
  if (outcome !== 'observed-window') finalSave.pendingResult = { battleRunId: `v100:${fixture.budget.stageId}:${openingSave.revision}`, won: outcome === 'won' };
  return { number, budget: fixture.budget, openingSave, finalSave, outcome, wallElapsedMs: V177_REPRESENTATIVE_WINDOW_MS,
    inputs: [{ action: 'deploy' }], snapshots: [{ humans: 2, enemies: 3 }], errors: [], requestAudit: { unexpectedFailures: [] },
    nativeClip: { status: 'recorded', errors: [], bytes: 2048, originalSpeedAccepted: false }, videoBytes: 4096 };
}

test('independent representative observations finish on a real defeat or the bounded window without requiring victory', () => {
  for (const number of [14, 25, 30]) for (const outcome of ['lost', 'won', 'observed-window']) {
    const row = observed(outcome, number), before = structuredClone(row);
    const result = assertRepresentativeBattleObservation(row);
    assert.equal(result.observationStatus, outcome);
    assert.equal(result.earnedCampaignAcceptance, false);
    assert.equal(result.balanceAcceptance, false);
    assert.equal(result.originalSpeedAccepted, false);
    assert.equal(result.releaseAcceptance, false);
    assert.deepEqual(row, before, 'do not rewrite the actual outcome');
  }
});

test('faults, unearned money, absent combat/video and forced results cannot be accepted as representative observations', () => {
  const mutations = [
    row => { row.errors.push('pageerror'); }, row => { row.requestAudit.unexpectedFailures.push('asset404'); },
    row => { row.captureError = 'native recorder failed'; }, row => { row.saveCaptureError = 'save failed'; },
    row => { row.videoCaptureError = 'video failed'; }, row => { row.budget.earnedCaps += 1; },
    row => { row.openingSave.caps += 1; row.finalSave.caps += 1; }, row => { row.finalSave.caps += 1; },
    row => { row.finalSave.completedStageIds.push(row.budget.stageId); }, row => { row.openingSave.unitLevels['unit-gantetsu'] = 30; },
    row => { row.inputs.length = 0; }, row => { row.snapshots[0].enemies = 0; },
    row => { row.nativeClip.status = 'invalid'; }, row => { row.nativeClip.errors.push('clip-time-limit'); },
    row => { row.nativeClip.bytes = 0; }, row => { row.videoBytes = 0; },
    row => { row.finalSave.pendingResult.won = true; }, row => { row.finalSave.pendingResult.battleRunId = 'forged'; },
  ];
  for (const mutate of mutations) { const row = observed('lost'); mutate(row); assert.throws(() => assertRepresentativeBattleObservation(row)); }
  const early = observed('observed-window'); early.wallElapsedMs = 100; assert.throws(() => assertRepresentativeBattleObservation(early));
  const forced = observed('observed-window'); forced.finalSave.pendingResult = { won: true }; assert.throws(() => assertRepresentativeBattleObservation(forced));
});

// Captured S25 DOM, original report SHA256
// 8f29f55b31fc032beb5a577ade50c7399ad4e1fda8b295b12a4884c4b04a9c3e.
// Display names and save aliases differ from these real data-kind values.
const s25Cards=[
  ['brute','タタラ',70],['gunner','レイダー',60],['zakimiya','ザキミヤ',52],
  ['mayo-chan','マヨちゃん',46],['kumaverson','クマバーソン',62],
  ['medic','ナオ',35],['guardian','ガンテツ',48],
].map(([kind,name,cost],slot)=>({kind,slot:String(slot),disabled:false,ariaDisabled:'false',
  state:'ready',blockReason:'ready',costText:'指揮'+cost,ariaLabel:name+' / 出撃可能 / コスト '+cost}));
const s25Human=(kind,id)=>({kind,id,side:'human',hp:100});
const s25Snapshot=()=>({fighters:[s25Human('guardian',1)],
  s25DeploymentObservation:{cards:structuredClone(s25Cards),queuedKinds:[]}});
const s25UnitFor=id=>UNIT_CONTENT.find(unit=>unit.aliases.includes(id));
const s25Required=['unit-raider','unit-tatara','unit-zakimiya'].map(id=>s25UnitFor(id).kind);

test('S25 real cards deploy the formally mapped fire units and wait for actual actors',()=>{
  assert.equal(s25UnitFor('unit-raider').displayName,'レイダー');
  assert.equal(s25UnitFor('unit-tatara').displayName,'タタラ');
  const snapshot=s25Snapshot(),baseline=['kumaverson'],humans=[s25Human('guardian',1),s25Human('medic',2)];
  const before=structuredClone(snapshot);
  for(const [index,kind]of s25Required.entries()){
    assert.deepEqual(s25FireDeploymentPriorities(snapshot,humans,baseline),[kind]);
    humans.push(s25Human(kind,index+3));
  }
  assert.equal(s25FireDeploymentPriorities(snapshot,humans,baseline),baseline);
  assert.deepEqual(snapshot,before);
  const allQueued=s25Snapshot();allQueued.s25DeploymentObservation.queuedKinds=[...s25Required];
  assert.deepEqual(s25FireDeploymentPriorities(allQueued,humans.slice(0,2),baseline),[]);
  assert.deepEqual(s25FireDeploymentPriorities(snapshot,[...humans.slice(0,2),s25Human('zakimiya',9)],baseline),['gunner']);
});

test('S25 preserves guardian/medic prerequisites and real card readiness instead of spending reserved command',()=>{
  const baseline=['guardian'],seen=[s25Human('guardian',1),s25Human('medic',2)];
  const check=(mutate,humans,expected)=>{
    const s=s25Snapshot();mutate(s);const before=structuredClone(s);
    assert.deepEqual(s25FireDeploymentPriorities(s,humans,baseline),expected);assert.deepEqual(s,before);
  };
  check(s=>{s.fighters=[];},seen,['guardian']);
  check(()=>{},seen.slice(0,1),['medic']);
  check(s=>{s.s25DeploymentObservation.queuedKinds=['medic'];},seen.slice(0,1),[]);
  check(s=>{s.s25DeploymentObservation.queuedKinds=['gunner'];},seen,['brute']);
  check(s=>{s.s25DeploymentObservation.cards.find(c=>c.kind==='gunner').ariaDisabled='true';},seen,['brute']);
  check(s=>{s.s25DeploymentObservation.cards.push(structuredClone(s25Cards[1]));},seen,['brute']);
  check(s=>{s.s25DeploymentObservation.cards.forEach(c=>{c.disabled=true;});},seen,[]);
  const invalid=s25Snapshot();invalid.s25DeploymentObservation.queuedKinds=[1];
  assert.throws(()=>s25FireDeploymentPriorities(invalid,seen,baseline));
});

test('the actual S25 completion branch still requires every real request and observed actor, retaining defeat',()=>{
  const source=fs.readFileSync('scripts/v177-representative-battles.mjs','utf8');
  const tree=ts.createSourceFile('representative.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),matches=[];
  const visit=node=>{if(ts.isIfStatement(node)&&node.expression.getText(tree)==='s25FireComparison'
    &&ts.isForOfStatement(node.thenStatement))matches.push(node);ts.forEachChild(node,visit);};visit(tree);
  assert.equal(matches.length,1);
  const verify=new Function('row','assert','s25FireComparison',matches[0].getText(tree));
  const row={outcome:'lost',inputs:s25Required.map(kind=>({action:'deploy',kind})),
    s25ObservedHumans:s25Required.map((kind,i)=>s25Human(kind,i+1))};
  const before=structuredClone(row);verify(row,assert,true);assert.deepEqual(row,before);
  for(const mutate of [r=>{r.inputs=[];},r=>{r.s25ObservedHumans=[];},
    r=>{r.inputs[0].kind='raider';},r=>{r.s25ObservedHumans[1].kind='tatara';}]){
    const invalid=structuredClone(row);mutate(invalid);assert.throws(()=>verify(invalid,assert,true));
    assert.equal(invalid.outcome,'lost');
  }
});
