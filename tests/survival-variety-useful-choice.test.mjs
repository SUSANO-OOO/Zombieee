import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSurvivalRun,selectSurvivalUpgrade,completeSurvivalWave,SURVIVAL_RUN_PHASES,survivalUpgradeHasEffect} from '../app/survival.js';
import {survivalWaveSpawnPlan,survivalUpgradePreview} from '../app/survivalBattleRuntime.js';

test('waves 11 and 12 cycle through all seven unlocked kinds without changing spawn totals',()=>{
  for(const [wave,total] of [[11,18],[12,20]]) {
    const plan=survivalWaveSpawnPlan(wave),counts={};
    for(const kind of plan.units)counts[kind]=(counts[kind]??0)+1;
    assert.equal(plan.units.length,total);assert.equal(Object.keys(counts).length,7);
    assert.ok(Math.max(...Object.values(counts))-Math.min(...Object.values(counts))<=1);
    assert.deepEqual(survivalWaveSpawnPlan(wave),plan);
  }
});
test('loaded checkpoints replace only useless choices without taking away earned upgrades or rewards',()=>{
  for(const [id,stack] of [['crawler-field-repair',0],['layered-armor',14],['rapid-redeployment',10]]) {
    const source={runId:'review-2',phase:SURVIVAL_RUN_PHASES.UPGRADE_SELECTION,lastCompletedWave:10,currentWave:11,
      crawler:{hp:700,maxHp:700},temporaryUpgradeStacks:{[id]:stack},pendingUpgradeChoices:[id,'boss-breaker','assault-drill']};
    const original=structuredClone(source),run=normalizeSurvivalRun(source);
    assert.equal(run.pendingUpgradeChoices.includes(id),false);
    assert.deepEqual(run.pendingUpgradeChoices.slice(1),['boss-breaker','assault-drill']);
    assert.equal(new Set(run.pendingUpgradeChoices).size,3);
    assert.equal(run.temporaryUpgradeStacks[id]??0,stack);
    assert.deepEqual(normalizeSurvivalRun(run),run);assert.deepEqual(source,original);
    const rejected=selectSurvivalUpgrade(run,id);assert.equal(rejected.phase,SURVIVAL_RUN_PHASES.UPGRADE_SELECTION);
    assert.deepEqual(rejected.temporaryUpgradeStacks,run.temporaryUpgradeStacks);
    for(const choice of run.pendingUpgradeChoices){const preview=survivalUpgradePreview(run,choice);assert.notEqual(preview.before,preview.after);}
  }
});
test('new boss choices use the actual end-of-wave crawler health',()=>{
  const active=normalizeSurvivalRun({runId:'review-2',phase:SURVIVAL_RUN_PHASES.IN_WAVE,lastCompletedWave:9,currentWave:10,crawler:{hp:300,maxHp:700}});
  const complete=completeSurvivalWave(active,{crawlerHp:700,kills:1,bossKills:1});
  assert.equal(complete.phase,SURVIVAL_RUN_PHASES.UPGRADE_SELECTION);
  for(const id of complete.pendingUpgradeChoices)assert.equal(survivalUpgradeHasEffect(complete,id),true);
  assert.equal(complete.pendingUpgradeChoices.includes('crawler-field-repair'),false);
});

test('a fixed formation without Nao replaces healing choices but preserves earned stacks and other slots',()=>{
  const source={runId:'no-healer',modePolicy:'v100',phase:SURVIVAL_RUN_PHASES.UPGRADE_SELECTION,
    lastCompletedWave:10,currentWave:11,crawler:{hp:700,maxHp:700},
    formation:{unitIds:['unit-paisen','unit-babayaga','unit-paisen']},
    temporaryUpgradeStacks:{'field-triage':3,'layered-armor':14,'rapid-redeployment':10},
    pendingUpgradeChoices:['boss-breaker','field-triage','assault-drill']};
  const copy=structuredClone(source),run=normalizeSurvivalRun(source);
  assert.deepEqual(source,copy);
  assert.deepEqual(run.pendingUpgradeChoices,['boss-breaker','range-calibration','assault-drill']);
  assert.equal(run.temporaryUpgradeStacks['field-triage'],3);
  assert.deepEqual(normalizeSurvivalRun(run),run);
  const healer=normalizeSurvivalRun({...source,formation:{unitIds:['unit-nao','unit-nao']}});
  assert.deepEqual(healer.pendingUpgradeChoices,source.pendingUpgradeChoices);
  assert.equal(survivalUpgradeHasEffect(healer,'field-triage'),true);
  assert.equal(survivalUpgradeHasEffect(run,'field-triage'),false);
});
