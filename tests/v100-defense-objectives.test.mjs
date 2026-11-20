import assert from "node:assert/strict";
import test from "node:test";
import { V100_DEFENSE_OBJECTIVES, v100DefenseStatus } from "../app/v100DefenseObjectives.js";
import { v100BattleDefinitionFor } from "../app/v100BattleAdapter.js";
import { hasArchiveExtraction } from "../app/v100ArchiveExtraction.js";
import { createStationMissionRuntime } from "../app/stationStageMechanics.js";
import { advanceClinicalRescue, clinicalRescueReadout, stopClinicalDisposal, V100_CLINICAL_STAGE } from "../app/v100ClinicalRescue.js";
import { V100_BAY_EVACUATION_ART } from "../app/v100BayEvacuation.js";
import { objectiveForBattle, battleOutcomeFor } from "../app/battleDefinitions.js";
import { v100ClinicalControlState, drawV100ClinicalControl, V100_CLINICAL_CONTROL_ART } from "../app/v100ClinicalControl.js";
import { requiredBattleAssetPlan } from "../app/battleAssetPlan.js";
import { drawV100DefensePerimeter, V100_DEFENSE_PERIMETER_ART } from "../app/v100DefensePerimeter.js";

test("all authored defense phases follow real threats, crawler impact and the unchanged outcome boundary",()=>{
  for(const stageId of Object.keys(V100_DEFENSE_OBJECTIVES)){
    const definition=v100BattleDefinitionFor(stageId),image={complete:true,naturalWidth:1983},frames=[];
    assert.ok(requiredBattleAssetPlan({stageId}).paths.includes(V100_DEFENSE_PERIMETER_ART));
    assert.ok(!requiredBattleAssetPlan({stageId,includeV100Sprites:false}).paths.includes(V100_DEFENSE_PERIMETER_ART));
    const context=new Proxy({drawImage:(_image,left)=>frames.push(left)},{get:(target,key)=>key in target?target[key]:()=>{}});
    const game={definition,time:definition.prepSeconds+10,baseHp:920,baseMaxHp:920,fighters:[]};
    const draw=()=>{const before=JSON.stringify(game);assert.equal(drawV100DefensePerimeter(context,game,{'v100-defense-perimeter':image},340,382),true);assert.equal(JSON.stringify(game),before);};
    draw();game.fighters=[{side:'zombie',hp:100,x:400,combatReady:true,gateEntering:false}];draw();game.crawlerHitFlash=.1;draw();
    game.time=definition.defenseEndAt;draw();
    if (hasArchiveExtraction(definition.missionType,definition.missionConfig) || stageId===V100_CLINICAL_STAGE) {
      assert.equal(battleOutcomeFor(definition,game),null);
      game.stageMission={completed:true};
    }
    assert.equal(battleOutcomeFor(definition,game),'won');
    game.baseHp=0;draw();assert.equal(battleOutcomeFor(definition,game),'lost');
    assert.deepEqual(frames,[0,392,770,1158,1535]);
    assert.throws(()=>drawV100DefensePerimeter(context,game,{},340,382),/decoded/);
    game.definition={...definition,missionConfig:{}};assert.equal(drawV100DefensePerimeter(null,game,null,340,382),false);
  }
});

test("the clinical rescue counts actual arrivals after the control is used and keeps the defense boundary", () => {
  const definition = v100BattleDefinitionFor(V100_CLINICAL_STAGE);
  assert.equal(definition.defenseEndAt - definition.prepSeconds, 88);
  assert.equal(definition.timeline[0].units.length, 3);
  assert.ok(definition.timeline.slice(1).every(event => event.waitForPriorWaveClear));
  const start = createStationMissionRuntime(definition.missionType, definition.missionConfig);
  const routeY = 270;
  const escort = {side:"human",hp:100,x:615,y:270,combatReady:true};
  const enemy = {side:"zombie",hp:100,x:600,y:270,combatReady:true};
  const late = {time:definition.defenseEndAt,baseHp:840,baseMaxHp:840};
  assert.equal(battleOutcomeFor(definition, {...late, stageMission:start}), null);
  assert.equal(stopClinicalDisposal(start, [], routeY), start);
  assert.equal(stopClinicalDisposal(start, [escort, enemy], routeY), start);
  const advance = (runtime, fighters, dt = .2) => advanceClinicalRescue({ runtime, fighters, dt, routeY });
  const ready = advance(start, [escort]);
  assert.equal(clinicalRescueReadout(ready).phase, "ready");
  const opened = stopClinicalDisposal(ready, [escort], routeY);
  assert.equal(stopClinicalDisposal(opened, [escort], routeY), opened);
  const delayed = advance(opened, [escort, enemy], 15);
  assert.equal(clinicalRescueReadout(delayed).phase, "sheltering");
  assert.equal(delayed.clinical.arrived, 0);
  assert.equal(battleOutcomeFor(definition, {...late, stageMission:delayed}), null);
  let runtime = delayed;
  const counted = new Set();
  for (let step = 0; step < 600 && !runtime.completed; step += 1) {
    const previous = runtime.clinical.arrived;
    runtime = advance(runtime, [escort]);
    assert.ok(runtime.clinical.arrived >= previous);
    counted.add(runtime.clinical.arrived);
  }
  assert.ok(counted.has(7));
  assert.ok(counted.has(43));
  assert.equal(runtime.clinical.groupsArrived, 6);
  assert.equal(clinicalRescueReadout(runtime).phase, "rescued");
  assert.equal(battleOutcomeFor(definition, {...late, time:definition.defenseEndAt - .1, stageMission:runtime}), null);
  assert.equal(battleOutcomeFor(definition, {...late, stageMission:runtime}), "won");
  assert.equal(battleOutcomeFor(definition, {...late, baseHp:0, stageMission:runtime}), "lost");
  assert.match(objectiveForBattle(definition,{...late, stageMission:runtime}), /全員救出/u);
});

test("V1 defense objectives reflect live contact and damage, use the shortened four durations and exclude legacy operations", () => {
  const durations=[78,73,83,88];
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

test("the clinical cabinet draws four distinct complete frames from real preparation, defense and outcome states", () => {
  const definition = v100BattleDefinitionFor("stage-mugarian-clinical-trial-wing");
  const plan = requiredBattleAssetPlan({stageId:definition.stageId});
  assert.ok(plan.paths.includes(V100_CLINICAL_CONTROL_ART));
  assert.ok(plan.paths.includes(V100_BAY_EVACUATION_ART.path));
  assert.equal(plan.background.path,"/art/v100/stages/s22-clinical-clean-v1.webp");
  assert.ok(!plan.paths.includes("/art/v100/mission-objects/clinical-trial-wing-v1.png"));
  const frames=[];
  const sealed = createStationMissionRuntime(definition.missionType, definition.missionConfig);
  const releasing = stopClinicalDisposal(sealed, [{side:"human", hp:1, x:600, y:240, combatReady:true}], 240);
  const complete = { ...releasing, completed: true, clinical: { ...releasing.clinical, arrived: 43 }};
  for(const [time,hp,expected,outcome,stageMission] of [
    [0,920,"sealed",null,sealed], [definition.prepSeconds,920,"sealed",null,sealed],
    [definition.prepSeconds+.1,920,"releasing",null,releasing],
    [definition.defenseEndAt,920,"complete","won",complete],
    [definition.prepSeconds+10,0,"failed","lost",releasing],
    [definition.defenseEndAt,1,"failed","lost",complete],
  ]) {
    const game={definition,time,baseHp:hp,baseMaxHp:920,fighters:[],stageMission,over:outcome!==null,won:outcome==="won"};
    const before=JSON.stringify(game);
    assert.equal(v100ClinicalControlState(definition,game),expected);
    assert.equal(battleOutcomeFor(definition,game),outcome);
    let frame;
    const context=new Proxy({}, {get:(_target,key)=>key==="drawImage"?(_image,...args)=>{frame=args;}:()=>{}});
    assert.equal(drawV100ClinicalControl(context,game,{clinicalControlStates:{complete:true,naturalWidth:2010}},810,240),true);
    assert.equal(frame[1],0);assert.equal(frame[3],782);
    assert.ok(frame[0]>=0&&frame[0]+frame[2]<=2010,"no crop extends outside the source");
    frames.push({expected,x:frame[0]});
    assert.equal(JSON.stringify(game),before,"drawing never advances time, rewards or health");
  }
  assert.equal(new Set(frames.map(frame=>frame.x)).size,4);
  assert.equal(v100ClinicalControlState({...definition,missionConfig:{}},{time:0}),null);
});
