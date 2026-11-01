import test from 'node:test';
import assert from 'node:assert/strict';
import {SURVIVAL_LATE_ENEMY_GROUPS,survivalWaveSpawnPlan,survivalNextWavePreview} from '../app/survivalBattleRuntime.js';
import {createSurvivalRun,SURVIVAL_RUN_PHASES} from '../app/survival.js';
import {v100SurvivalSession,v100SurvivalEnemyKinds} from '../app/v100Survival.js';
import {beginV100Survival} from '../app/v100SurvivalTransactions.js';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save,deserializeV100Save} from '../app/v100Save.js';
import {V100_BOSSES} from '../app/v100Registry.js';
import {ENEMY_CONTENT} from '../app/content/enemyCatalog.js';

const bossPool=['takuya','kurome','futago'];
const options={bossPool,strictBossPool:true};
const late=SURVIVAL_LATE_ENEMY_GROUPS.flatMap(group=>group.kinds);

test('late enemies require both the completed campaign region and its survival wave',()=>{
  for(let wave=1;wave<=60;wave++) {
    const early=survivalWaveSpawnPlan(wave,{bossPool:['takuya'],strictBossPool:true});
    assert.ok(!early.units.some(kind=>late.includes(kind)));
    const full=survivalWaveSpawnPlan(wave,options);
    for(const group of SURVIVAL_LATE_ENEMY_GROUPS) {
      assert.equal(full.units.filter(kind=>group.kinds.includes(kind)).length,wave>=group.firstWave?1:0);
    }
    const legacy=survivalWaveSpawnPlan(wave,{bossPool});
    assert.ok(!legacy.units.some(kind=>late.includes(kind)));
  }
});

test('each late enemy appears, with at most two replacements and unchanged bosses and totals',()=>{
  const seen=new Set();
  for(let wave=1;wave<=120;wave++) {
    const plan=survivalWaveSpawnPlan(wave,options);
    const baseline=survivalWaveSpawnPlan(wave,{...options,bossPool:['takuya']});
    const expectedBossBodies=wave%5===0?(plan.bossKind==='futago'?2:1):0;
    const expectedNormal=Math.min(32-expectedBossBodies,4+Math.floor(wave*1.35));
    assert.equal(plan.units.length,expectedNormal+expectedBossBodies);
    assert.equal(plan.units.filter(kind=>bossPool.includes(kind)).length,expectedBossBodies);
    assert.equal(plan.units.filter(kind=>late.includes(kind)).length,(wave>=16?1:0)+(wave>=21?1:0));
    for(const kind of plan.units.filter(kind=>late.includes(kind)))seen.add(kind);
    if(wave<16)assert.deepEqual(plan.units.filter(kind=>!bossPool.includes(kind)),baseline.units.filter(kind=>!bossPool.includes(kind)));
    assert.deepEqual(survivalWaveSpawnPlan(wave,options),plan);
    assert.ok(plan.units.every(kind=>ENEMY_CONTENT.some(enemy=>enemy.id===kind)));
  }
  assert.deepEqual([...seen].sort(),[...late].sort());
});

test('early starts do not decode future specialists even after the campaign is complete',()=>{
  for(const completed of [0,5,10]) {
    const kinds=v100SurvivalEnemyKinds({bossPool,lastBossKind:null,lastCompletedWave:completed});
    assert.ok(!kinds.some(kind=>late.includes(kind)));
  }
  assert.deepEqual(bossPool,['takuya','kurome','futago']);
});

test('V1 session preloads every possible spawn and preserves saved loadout, rewards and receipts',()=>{
  const source=createDefaultV100Save();source.campaignStarted=true;source.flowState.phase="map";source.formationSlots=Array(7).fill(source.ownedUnitIds[0]);
  source.receipts=V100_BOSSES.map(b=>b.firstDefeatReceipt);
  const begun=beginV100Survival(normalizeV100Save(source),{runId:'late-roster-roundtrip'});
  assert.equal(begun.applied,true);
  const saved=deserializeV100Save(serializeV100Save(begun.save)).save;
  const original=structuredClone(saved),session=v100SurvivalSession(saved.survival.active,saved.settings);
  let lastBossKind=null;
  for(let checkpoint=0;checkpoint<120;checkpoint+=5) {
    const run={...saved.survival.active.run,currentWave:checkpoint+1,lastCompletedWave:checkpoint,lastBossKind};
    const block=v100SurvivalSession({...saved.survival.active,run},saved.settings);
    for(let wave=checkpoint+1;wave<=checkpoint+5;wave++) {
      const plan=survivalWaveSpawnPlan(wave,{bossPool:run.bossPool,lastBossKind:run.lastBossKind,strictBossPool:true});
      assert.ok(plan.units.every(kind=>block.enemyKinds.includes(kind)));
      if(plan.bossKind)lastBossKind=plan.bossKind;
    }
    assert.ok(block.enemyKinds.filter(kind=>run.bossPool.includes(kind)).length<=2,'only current/next bosses need decoding');
    if(checkpoint===15)assert.ok(!block.enemyKinds.some(kind=>kind.startsWith('red-panther-')));
    if(checkpoint===20)assert.ok(block.enemyKinds.includes('pall-manta'),'previous wave corpse still has its art');
  }
  assert.deepEqual(session.equipmentSnapshot,saved.survival.active.run.formation);
  assert.deepEqual(saved,original);
  assert.deepEqual(saved.receipts,begun.save.receipts);
  assert.deepEqual(saved.equipment,begun.save.equipment);
  assert.equal(saved.caps,begun.save.caps);
});

test('checkpoint preview names the specialist that actually joins the next wave',()=>{
  for(const [wave,names] of [[16,['裂声体']],[21,['掌根','RED PANTHER・ナイフ']]]) {
    const run={...createSurvivalRun({runId:'preview',bossPool,modePolicy:'v100'}),phase:SURVIVAL_RUN_PHASES.UPGRADE_SELECTION,lastCompletedWave:wave-1,currentWave:wave};
    const preview=survivalNextWavePreview(run);assert.equal(preview.wave,wave);
    for(const name of names)assert.ok(preview.threats.includes(name),preview.threats);
    assert.equal(preview.total,survivalWaveSpawnPlan(wave,options).units.length);
  }
});
