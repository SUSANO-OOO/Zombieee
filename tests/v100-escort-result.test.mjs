import test from 'node:test';
import assert from 'node:assert/strict';
import {v100BattleReportFor,normalizeV100BattleReport,v100EscortResultText} from '../app/v100BattleReport.js';
import {V100_MISSION_VEHICLES} from '../app/v100MissionVehicles.js';
import {createV100BattleResult} from '../app/v100Transactions.js';
import {createDefaultV100Save,serializeV100Save,deserializeV100Save} from '../app/v100Save.js';

const raw=(stageId)=>({stageId,wave:3,kills:5,unitStats:{damageByUnit:{scout:12},damageTakenByUnit:{scout:10},healingByUnit:{}},
  missionRuntime:{progress:.253148,integrity:0,maxIntegrity:500,failed:true,completed:false}});
const result=(stageId,battleReport)=>createV100BattleResult({stageId,battleRunId:'escort-result',won:false,vehicleHp:760,vehicleMaxHp:760,battleReport});

test('all four mission vehicles retain measured destruction and progress through result/save',()=>{
 for(const [stageId,vehicle] of Object.entries(V100_MISSION_VEHICLES)){
  const input=raw(stageId),copy=structuredClone(input),report=v100BattleReportFor(input);
  assert.deepEqual(input,copy);
  const value=result(stageId,report),without=result(stageId,null);
  const {battleReport,...facts}=value;assert.deepEqual(facts,without,'presentation cannot alter victory/stars');
  const seed={...createDefaultV100Save(),lastResult:value};
  const parsed=deserializeV100Save(serializeV100Save(seed));assert.equal(parsed.ok,true);
  assert.deepEqual(parsed.save.lastResult.battleReport,battleReport);
  const text=v100EscortResultText(parsed.save.lastResult);
  assert.ok(text.outcome.includes(vehicle.targetLabel));assert.match(text.outcome,/破壊された/);assert.match(text.progress,/25%/);
  assert.equal(parsed.save.caps,seed.caps);assert.deepEqual(parsed.save.receipts,seed.receipts);
 }
});

test('legacy, mismatched, missing and malformed measurements do not invent an escort loss',()=>{
 const id='stage-coastal-link-bridge',report=v100BattleReportFor(raw(id)),base=result(id,report);
 for(const change of [null,{...report.escortProgress,progress:NaN},{...report.escortProgress,progress:1.1},
  {...report.escortProgress,integrity:-1},{...report.escortProgress,maxIntegrity:0},
  {...report.escortProgress,completed:true},{...report.escortProgress,failed:'true'},
  {...report.escortProgress,stageId:'toString'}]){
  const normalized=normalizeV100BattleReport({...report,escortProgress:change});
  assert.equal(normalized.escortProgress,undefined);assert.equal(v100EscortResultText({...base,battleReport:normalized}),null);
 }
 assert.equal(v100EscortResultText({...base,stageId:'stage-research-freight-passage'}),null);
 assert.equal(v100EscortResultText({...base,won:true}),null);
 assert.equal(v100EscortResultText({...base,battleReport:undefined}),null);
 assert.equal(v100BattleReportFor({...raw(id),missionRuntime:undefined}).escortProgress,undefined);
});

test('destroyed player base and reached destination do not imply a destroyed mission vehicle',()=>{
 const id='stage-coastal-link-bridge',input=raw(id);
 input.missionRuntime={progress:1,integrity:280,maxIntegrity:500,failed:true,completed:false};
 const text=v100EscortResultText({...result(id,v100BattleReportFor(input)),vehicleHp:0});
 assert.equal(text.outcome,null);assert.equal(text.advice,null);assert.equal(text.progress,'証拠搬送車は目的地に到着');
});
