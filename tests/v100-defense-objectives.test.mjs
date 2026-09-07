import assert from "node:assert/strict";
import test from "node:test";
import { V100_DEFENSE_OBJECTIVES, v100DefenseStatus } from "../app/v100DefenseObjectives.js";
import { v100BattleDefinitionFor } from "../app/v100BattleAdapter.js";
import { objectiveForBattle, battleOutcomeFor } from "../app/battleDefinitions.js";

test("the real 100-second clinical operation opens exactly 43 records and shares the production completion boundary", () => {
  const definition = v100BattleDefinitionFor("stage-mugarian-clinical-trial-wing");
  const duration = definition.defenseEndAt - definition.prepSeconds;
  assert.equal(duration, 100);
  const state = {time:0,baseHp:920,baseMaxHp:920,fighters:[]};
  assert.equal(v100DefenseStatus(definition,state).openedRecords,0);
  for(let record=1;record<=43;record++) {
    state.time=definition.prepSeconds+duration*record/43;
    const before=JSON.stringify(state),view=v100DefenseStatus(definition,state);
    assert.equal(view.openedRecords,record);
    assert.equal(view.completed,record===43);
    assert.equal(battleOutcomeFor(definition,state),record===43?"won":null);
    assert.ok(objectiveForBattle(definition,state).includes(`${record}/43`));
    assert.equal(JSON.stringify(state),before,"presentation never changes combat or save state");
  }
  state.time=definition.defenseEndAt-.001;
  assert.equal(v100DefenseStatus(definition,state).openedRecords,42);
  state.time=definition.defenseEndAt;
  for(const hp of [0,1]) {
    state.baseHp=hp;
    assert.equal(v100DefenseStatus(definition,state).completed,false);
    assert.equal(v100DefenseStatus(definition,state).phase,"failed");
    assert.equal(battleOutcomeFor(definition,state),"lost");
  }
});

test("V1 defense objectives reflect live contact and damage, preserve all four durations and exclude legacy operations", () => {
  const durations=[90,85,95,100];
  for(const [index,stageId] of Object.keys(V100_DEFENSE_OBJECTIVES).entries()) {
    const definition=v100BattleDefinitionFor(stageId);
    assert.equal(definition.defenseEndAt-definition.prepSeconds,durations[index]);
    const state={time:definition.prepSeconds+10,baseHp:680,baseMaxHp:680,fighters:[]};
    assert.equal(v100DefenseStatus(definition,state).phase,"perimeter");
    state.fighters=[{side:"zombie",hp:100,x:400,combatReady:false,gateEntering:true}];
    assert.equal(v100DefenseStatus(definition,state).phase,"perimeter");
    state.fighters[0]={...state.fighters[0],combatReady:true,gateEntering:false};
    assert.equal(v100DefenseStatus(definition,state).phase,"incoming");
    state.crawlerHitFlash=.1;
    assert.equal(v100DefenseStatus(definition,state).phase,"impact");
    const progress=v100DefenseStatus(definition,state).progress;
    assert.equal(v100DefenseStatus(definition,state).progress,progress,"a paused battle cannot advance records");
    assert.equal(v100DefenseStatus({...definition,missionConfig:{}},state),null);
  }
});
