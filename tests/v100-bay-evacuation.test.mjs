import assert from "node:assert/strict";
import test from "node:test";
import { requiredBattleAssetPlan } from "../app/battleAssetPlan.js";
import { battleOutcomeFor, objectiveForBattle } from "../app/battleDefinitions.js";
import { stageVisualFor } from "../app/productionVisuals.js";
import { v100AssaultObjectProfile } from "../app/v100AssaultObjects.js";
import { v100BasePresentationFor } from "../app/v100BasePresentation.js";
import { v100BattleDefinitionFor, V100_ENEMY_PACKS } from "../app/v100BattleAdapter.js";
import { v100BattleReportFor, v100DeviceResultText } from "../app/v100BattleReport.js";
import { createStationMissionRuntime } from "../app/stationStageMechanics.js";
import {
  advanceBayEvacuationRuntime, bayEvacuationReadout, drawV100BayEvacuees,
  V100_BAY_EVACUATION_ART, V100_BAY_EVACUATION_STAGE, V100_BAY_BACKGROUND, V100_BAY_ROUTE_Y,
} from "../app/v100BayEvacuation.js";

const stageId = V100_BAY_EVACUATION_STAGE;
const definition = v100BattleDefinitionFor(stageId);
const create = () => createStationMissionRuntime(definition.missionType, definition.missionConfig);
const ally = { side:"human", hp:100, combatReady:true, x:360, y:V100_BAY_ROUTE_Y };
const enemy = { side:"zombie", kind:"cagewalker", hp:100, x:680, y:V100_BAY_ROUTE_Y };
const advance = (runtime, fighters, extra = {}) => advanceBayEvacuationRuntime({
  runtime, fighters, dt:1, eventIndex:1, baseHp:840, routeY:V100_BAY_ROUTE_Y, ...extra,
});

test("the corridor retains the story boss and all six enemies, with a decoded civilian atlas",()=>{
  assert.equal(definition.bossEnemyKind,"kurome");
  assert.deepEqual(new Set(definition.timeline.flatMap(x=>x.units).filter(kind=>kind!=="kurome")),new Set(V100_ENEMY_PACKS.D));
  assert.deepEqual(definition.timeline.at(-1).units,["kurome"]);
  assert.ok(definition.timeline.at(-1).waitForPriorWaveClear);
  assert.equal(v100AssaultObjectProfile(stageId),null);
  assert.equal(v100BasePresentationFor(17).healthLabel,"避難口耐久");
  assert.equal(stageVisualFor(stageId),V100_BAY_BACKGROUND);
  assert.notEqual(stageVisualFor("outbreak-mother-brood-vault"),V100_BAY_BACKGROUND);
  const plan=requiredBattleAssetPlan({stageId,basePresentationStageNumber:17});
  assert.ok(plan.paths.includes(V100_BAY_EVACUATION_ART.path)&&plan.paths.includes(V100_BAY_BACKGROUND));
});

test("the group shelters when a living enemy or an aimed beam threatens its crossing",()=>{
  const start=create();
  assert.deepEqual(advance(start,[ally],{eventIndex:0}),start);
  assert.equal(advance(start,[]).evacuationDistances[0],0);
  const blocked=advance(start,[ally,enemy]);
  assert.equal(blocked.evacuationDistances[0],0);
  assert.equal(bayEvacuationReadout(blocked).phase,"sheltering");
  const sight={...enemy,kind:"kurome",x:946,y:390,stationAbility:{phase:"locked",targetY:V100_BAY_ROUTE_Y}};
  assert.equal(advance(start,[ally,sight]).evacuationDistances[0],0);
  assert.ok(advance(blocked,[ally,{...enemy,y:V100_BAY_ROUTE_Y+100}]).evacuationDistances[0]>0);
  assert.match(objectiveForBattle(definition,{stageMission:blocked}),/避難路を開ける/u);
});

test("twelve measured arrivals, Kurome, surviving defenses and resolved enemies are required for a win",()=>{
  let runtime=create();
  for(let tick=0;tick<26;tick++) runtime=advance(runtime,[ally]);
  assert.equal(runtime.evacuatedCount,8);
  assert.equal(runtime.completed,false);
  const state=()=>({stageMission:runtime,bossDefeated:true,baseHp:840,baseMaxHp:840,wavesResolved:true});
  assert.equal(battleOutcomeFor(definition,state()),null);
  for(let tick=0;tick<20;tick++) runtime=advance(runtime,[],{bossDefeated:true});
  assert.equal(runtime.evacuatedCount,12);
  assert.equal(battleOutcomeFor(definition,{...state(),bossDefeated:false}),null);
  assert.equal(battleOutcomeFor(definition,{...state(),bossDefeatPending:true}),null);
  assert.equal(battleOutcomeFor(definition,{...state(),wavesResolved:false}),null);
  assert.equal(battleOutcomeFor(definition,{...state(),baseHp:0}),"lost");
  assert.equal(battleOutcomeFor(definition,state()),"won");
  const report=v100BattleReportFor({stageId,wave:4,kills:20,missionRuntime:runtime,
    unitStats:{damageByUnit:{},damageTakenByUnit:{},healingByUnit:{}}});
  assert.deepEqual(report.bayEvacuation,{stageId,evacuatedCount:12});
  assert.match(v100DeviceResultText({stageId,won:false,battleReport:report}).progress,/12\/12/u);
});

test("the draw uses a crouch when waiting and actual running poses anchored to the route",()=>{
  const image={complete:true,naturalWidth:488};
  const calls=[];
  const context=new Proxy({drawImage:(...args)=>calls.push(args)},{get:(target,key)=>target[key]??(()=>{})});
  const art={[V100_BAY_EVACUATION_ART.id]:image};
  const start=create();
  drawV100BayEvacuees(context,start,art,236);
  assert.equal(calls.length,4);
  assert.ok(calls.every(args=>args[2]===296));
  const earlierX=calls[0][5];calls.length=0;
  drawV100BayEvacuees(context,advance(start,[ally]),art,236);
  assert.equal(calls.length,4);
  assert.ok(calls.every(args=>args[2]<296));
  assert.ok(calls[0][5]<earlierX);
});
