import test from 'node:test';
import assert from 'node:assert/strict';
import {V100_STAGES} from '../app/v100Registry.js';
import {v100BattleDefinitionFor} from '../app/v100BattleAdapter.js';
import {V100_DEFENSE_OBJECTIVES,v100DefenseStatus,v100DefenseResultSnapshot} from '../app/v100DefenseObjectives.js';
import {v100BattleReportFor,normalizeV100BattleReport,v100DefenseResultText} from '../app/v100BattleReport.js';
import {createV100BattleResult} from '../app/v100Transactions.js';
import {createDefaultV100Save,serializeV100Save,deserializeV100Save} from '../app/v100Save.js';

const measured=(stageId,time)=>{
 const definition=v100BattleDefinitionFor(stageId);
 return {stageId,wave:5,kills:5,time,unitStats:{damageByUnit:{medic:10},damageTakenByUnit:{medic:5},healingByUnit:{}},
  defenseProgress:v100DefenseResultSnapshot(definition,{time})};
};
const result=(raw,battleReport=v100BattleReportFor(raw))=>createV100BattleResult({stageId:raw.stageId,battleRunId:'defense-result',
 won:false,vehicleHp:0,vehicleMaxHp:840,elapsedSeconds:raw.time,unitDeaths:6,battleReport});

test('all four defense clocks retain measured progress through result and reload without changing defeat or economy',()=>{
 for(const stageId of Object.keys(V100_DEFENSE_OBJECTIVES)){
  const raw=measured(stageId,74.66666666666372),original=structuredClone(raw),value=result(raw),without=result(raw,null);
  assert.deepEqual(raw,original);
  const {battleReport,...facts}=value;assert.deepEqual(facts,without);
  const seed={...createDefaultV100Save(),lastResult:value};
  const parsed=deserializeV100Save(serializeV100Save(seed));assert.equal(parsed.ok,true);
  assert.deepEqual(parsed.save.lastResult.battleReport,battleReport);
  for(const key of ['caps','receipts','bestStars','completedStageIds','formationSlots','equipment','unitLevels'])assert.deepEqual(parsed.save[key],seed[key]);
  const text=v100DefenseResultText(parsed.save.lastResult);assert.ok(text);
  const live=v100DefenseStatus(v100BattleDefinitionFor(stageId),{time:raw.time,baseHp:0,baseMaxHp:840});
  assert.equal(Math.ceil(raw.defenseProgress.durationSeconds-raw.defenseProgress.elapsedSeconds),live.remaining);
  assert.equal(text.detail,`防衛完了まであと${live.remaining}秒`);
  if(live.recordCount)assert.equal(text.progress,`収容室 ${live.openedRecords}/${live.recordCount}室を開放`);
  else assert.equal(text.progress,`${live.label}を69秒維持`);
 }
});

test('S22 shows the actual 34 of 43 rooms and 19 seconds remaining, excluding preparation time',()=>{
 const id='stage-mugarian-clinical-trial-wing',raw=measured(id,74.66666666666372);
 assert.deepEqual(v100DefenseResultText(result(raw)),{progress:'収容室 34/43室を開放',detail:'防衛完了まであと19秒'});
 const early=measured(id,2);assert.equal(early.defenseProgress.elapsedSeconds,0);
 assert.equal(v100DefenseResultText(result(early)).progress,'収容室 0/43室を開放');
 const late=measured(id,200);assert.equal(late.defenseProgress.elapsedSeconds,late.defenseProgress.durationSeconds);
 assert.deepEqual(v100DefenseResultText(result(late)),{progress:'収容室 43/43室を開放',detail:'防衛時間は経過・作戦目標は未達'});
});

test('legacy, malformed and other-stage reports never invent timed-defense progress',()=>{
 const id='stage-mugarian-clinical-trial-wing',raw=measured(id,75),report=v100BattleReportFor(raw),base=result(raw);
 for(const patch of [null,{...raw.defenseProgress,stageId:'toString'},{...raw.defenseProgress,elapsedSeconds:-1},
  {...raw.defenseProgress,elapsedSeconds:Infinity},{...raw.defenseProgress,elapsedSeconds:89},
  {...raw.defenseProgress,durationSeconds:0},{...raw.defenseProgress,durationSeconds:'88'}]){
  const normalized=normalizeV100BattleReport({...report,defenseProgress:patch});
  assert.equal(normalized.defenseProgress,undefined);assert.equal(v100DefenseResultText({...base,battleReport:normalized}),null);
 }
 assert.equal(v100DefenseResultText({...base,won:true}),null);
 assert.equal(v100DefenseResultText({...base,stageId:'stage-civic-archive-route'}),null);
 assert.equal(v100DefenseResultText({...base,battleReport:undefined}),null);
 assert.equal(v100BattleReportFor({...raw,defenseProgress:undefined}).defenseProgress,undefined);
 assert.equal(v100BattleReportFor({...raw,stageId:'stage-civic-archive-route'}).defenseProgress,undefined);
});

test('snapshot belongs only to the four V1 timed-defense stages and does not mutate live battle state',()=>{
 for(const stage of V100_STAGES){
  const definition=v100BattleDefinitionFor(stage.id),state={time:30},before=structuredClone({definition,state});
  const snapshot=v100DefenseResultSnapshot(definition,state);
  assert.equal(!!snapshot,Object.hasOwn(V100_DEFENSE_OBJECTIVES,stage.id));
  assert.deepEqual({definition,state},before);
 }
 const d=v100BattleDefinitionFor('stage-mugarian-clinical-trial-wing');
 for(const definition of [{...d,missionConfig:{}},{...d,defenseEndAt:NaN},{...d,defenseEndAt:d.prepSeconds}])assert.equal(v100DefenseResultSnapshot(definition,{time:30}),null);
 assert.equal(v100DefenseResultSnapshot(d,{time:NaN}),null);
});
