import assert from 'node:assert/strict';
import test from 'node:test';
import {V100_STAGES} from '../app/v100Registry.js';
import {v100BattleDefinitionFor} from '../app/v100BattleAdapter.js';
import {STATION_MISSION_TYPES,createStationMissionRuntime,advanceStationMissionRuntime,stationPowerNodes,stationHumanMoveSpeed,stationMissionOutcome} from '../app/stationStageMechanics.js';

const missions=V100_STAGES.map(s=>v100BattleDefinitionFor(s.id)).filter(d=>d.missionType===STATION_MISSION_TYPES.SEQUENTIAL_SEAL);
function progress(definition,runtime,values={}){
 return advanceStationMissionRuntime({runtime,config:definition.missionConfig,seconds:6,battleElapsedSeconds:6,humanCount:2,powerOperatorCount:1,powerLaneThreats:0,activeUnitIds:[11,12],returnedUnitIds:[],wavesResolved:false,...values});
}
function armedReturn(definition){
 let runtime=createStationMissionRuntime(definition.missionType,definition.missionConfig);
 for(let i=0;i<definition.missionConfig.powerCount;i++)runtime=progress(definition,runtime,{battleElapsedSeconds:(i+1)*6});
 assert.equal(runtime.sealed,false,'unresolved waves still prevent sealing');
 return progress(definition,runtime,{seconds:0,wavesResolved:true});
}

test('V1 sequential nodes advance by physical operation and threat clearance without an absolute-clock wait',()=>{
 assert.ok(missions.length>=2);
 for(const definition of missions){
  const initial=createStationMissionRuntime(definition.missionType,definition.missionConfig);
  assert.ok(stationPowerNodes(definition.missionConfig).every(n=>n.readyAtSeconds===0));
  assert.equal(progress(definition,initial,{powerOperatorCount:0}).powerHold,0,'remote actors cannot operate');
  let hold=progress(definition,initial,{seconds:4,battleElapsedSeconds:4});assert.equal(hold.powerActivated,0);assert.equal(hold.powerHold,4);
  hold=progress(definition,hold,{seconds:2,powerLaneThreats:1});assert.equal(hold.powerActivated,0);assert.equal(hold.powerHold,3,'threat still interrupts and decays hold');
  const first=progress(definition,initial);assert.equal(first.powerActivated,1);assert.equal(first.powerHold,0,'one hold never skips multiple nodes');
  const sealed=armedReturn(definition);assert.equal(sealed.sealed,true);assert.equal(sealed.escapeRemaining,45);
 }
 assert.deepEqual(stationPowerNodes().map(n=>n.readyAtSeconds),[24,62,104],'legacy timing stays unchanged');
});

test('faster return preserves the original required identities, threat check and failure deadline',()=>{
 for(const definition of missions){
  const sealed=armedReturn(definition);
  assert.deepEqual(sealed.returnTargetIds,['11','12']);
  const substitute=progress(definition,sealed,{seconds:2,wavesResolved:true,activeUnitIds:[11,12,13],returnedUnitIds:[11,13],returnedCount:2});
  assert.equal(substitute.completed,false,'newly deployed actor cannot substitute a required returning actor');
  const threatened=progress(definition,sealed,{seconds:2,wavesResolved:true,returnedUnitIds:[11,12],returnedCount:2,escapeRouteThreats:1});
  assert.equal(threatened.completed,false);
  const complete=progress(definition,sealed,{seconds:2,wavesResolved:true,returnedUnitIds:[11,12],returnedCount:2});
  assert.equal(complete.completed,true);assert.equal(stationMissionOutcome({runtime:complete,baseHp:680}),'won');
  const lost=progress(definition,sealed,{seconds:1,wavesResolved:true,activeUnitIds:[11],returnedUnitIds:[11],returnedCount:1});
  assert.equal(lost.failed,true);
  const timeout=progress(definition,sealed,{seconds:45,wavesResolved:true});assert.equal(timeout.failed,true);
 }
});

test('return sprint is isolated to the sealed V1 return and still honors slowing effects',()=>{
 const definition=missions[0],config=definition.missionConfig,initial=createStationMissionRuntime(definition.missionType,config),sealed=armedReturn(definition);
 assert.equal(stationHumanMoveSpeed({baseSpeed:20,runtime:initial,config}),20);
 assert.equal(stationHumanMoveSpeed({baseSpeed:20,runtime:sealed,config}),64);
 assert.equal(stationHumanMoveSpeed({baseSpeed:20,slowMultiplier:.5,runtime:sealed,config}),32);
 assert.equal(stationHumanMoveSpeed({baseSpeed:20,runtime:{...sealed,completed:true},config}),20);
 assert.equal(stationHumanMoveSpeed({baseSpeed:20,runtime:sealed}),36,'legacy sealed movement remains 1.8');
});

