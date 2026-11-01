import test from 'node:test';
import assert from 'node:assert/strict';
import {V100_STAGES} from '../app/v100Registry.js';
import {v100BattleDefinitionFor} from '../app/v100BattleAdapter.js';
import {objectiveForBattle,battleOutcomeFor} from '../app/battleDefinitions.js';
import {createStationMissionRuntime,advanceStationMissionRuntime} from '../app/stationStageMechanics.js';
test('all four escort destinations keep the remaining defence visible until the battle result',()=>{
 for(const number of [6,12,19,26]){
  const definition=v100BattleDefinitionFor(V100_STAGES[number-1].id);
  const stageMission={...createStationMissionRuntime('escort',definition.missionConfig),progress:1,completed:true,integrity:300};
  const state={stageMission,baseHp:680,wavesResolved:false,over:false};
  assert.equal(battleOutcomeFor(definition,state),null);
  assert.match(objectiveForBattle(definition,state),number===26 ? /^冷蔵車3台を確保。敵を倒して守れ$/ : /は到着。残る敵を倒して守れ$/);
  assert.equal(battleOutcomeFor(definition,{...state,wavesResolved:true}),'won');
  assert.doesNotMatch(objectiveForBattle(definition,{...state,wavesResolved:true,over:true}),/倒して守れ/);
  assert.doesNotMatch(objectiveForBattle(definition,{...state,stageMission:{...stageMission,failed:true,completed:false,integrity:0}}),/倒して守れ/);
 }
});
test('S26 remains vulnerable after arrival; clearer wording changes neither damage nor defeat',()=>{
 const definition=v100BattleDefinitionFor(V100_STAGES[25].id);
 let runtime={...createStationMissionRuntime('escort',definition.missionConfig),progress:1,completed:true,integrity:1};
 runtime=advanceStationMissionRuntime({runtime,missionType:'escort',config:definition.missionConfig,seconds:1,baseHp:680,humanCount:3,escortCount:1,nearbyThreats:10});
 assert.equal(runtime.failed,true);assert.equal(runtime.integrity,0);
 assert.equal(battleOutcomeFor(definition,{stageMission:runtime,baseHp:680,wavesResolved:false,over:false}),'lost');
});
