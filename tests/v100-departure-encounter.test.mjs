import assert from 'node:assert/strict';
import test from 'node:test';
import {v100DepartureCrewKind, v100DepartureEncounter} from '../app/v100DepartureEncounter.js';
import {V100_STAGES, V100_BOSSES} from '../app/v100Registry.js';
import {v100BossObservationFor} from '../app/bossFoundation.js';
import {survivalWaveSpawnPlan} from '../app/survivalBattleRuntime.js';

const formationKinds=['scout','ranger','medic'];
test('campaign load screens use the encounter for the actual stage and all nine rematches use that same boss',()=>{
  const notes=new Set();
  for(const stage of V100_STAGES){
    const session={stageId:stage.id,formationKinds};
    const expected=V100_BOSSES.find(b=>b.stageNumber===stage.number);
    const story=v100DepartureEncounter(session);
    assert.equal(story.boss,expected);
    assert.equal(story.number,'S'+String(stage.number).padStart(2,'0'));
    assert.equal(v100DepartureCrewKind(session),formationKinds[(stage.number-1)%formationKinds.length]);
    if(!expected)continue;
    const rematch=v100DepartureEncounter({...session,battleMode:'outbreak'});
    assert.equal(rematch.boss,expected);assert.equal(rematch.label,'異常発生');assert.equal(rematch.number,null);
    const note=v100BossObservationFor(expected.id);assert.ok(note);notes.add(note);
  }
  assert.equal(notes.size,9);
});
test('survival introduces the current wave rather than a boss from an earlier or later wave in the preload list',()=>{
  const base={stageId:V100_STAGES[0].id,formationKinds,enemyKinds:['walker','takuya','gairen']};
  const run={phase:'wave-ready',bossPool:['takuya','gairen'],currentWave:6,lastCompletedWave:5,lastBossKind:'takuya'};
  const at=changes=>v100DepartureEncounter({...base,survivalRun:{...run,...changes}});
  assert.equal(at({}).stage,null);assert.equal(at({}).number,'第6波');assert.ok(!at({}).boss);
  assert.equal(v100DepartureCrewKind({...base,survivalRun:run}),'medic');
  assert.equal(at({phase:'upgrade-selection'}).number,'第5波突破');
  const wave=10;
  const selection=survivalWaveSpawnPlan(wave,{bossPool:run.bossPool,lastBossKind:'takuya',strictBossPool:true});
  assert.equal(at({currentWave:wave}).boss.id,'boss-'+selection.bossKind);
  assert.equal(at({currentWave:wave,phase:'in-wave',lastBossKind:'takuya'}).boss.id,'boss-takuya');
});
