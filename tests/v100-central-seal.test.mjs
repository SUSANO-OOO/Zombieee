import assert from "node:assert/strict";
import test from "node:test";
import { requiredBattleAssetPlan } from "../app/battleAssetPlan.js";
import { battleOutcomeFor, objectiveForBattle } from "../app/battleDefinitions.js";
import { advanceStationMissionRuntime, createStationMissionRuntime, currentPowerNode } from "../app/stationStageMechanics.js";
import { stationSpatialSnapshot } from "../app/stationSpatialMechanics.js";
import { v100BattleDefinitionFor, V100_ENEMY_PACKS } from "../app/v100BattleAdapter.js";
import { v100MissionBriefingFor } from "../app/v100MissionBriefing.js";
import { campaignWaveReady } from "../app/wavePacing.js";
import {
  V100_CENTRAL_SEAL_ART, V100_CENTRAL_SEAL_STAGE, centralSealCanReinforce, centralSealGateDescent,
  centralSealIngressPoint, drawV100CentralSealGates,
} from "../app/v100CentralSeal.js";

const definition = v100BattleDefinitionFor(V100_CENTRAL_SEAL_STAGE);
const { missionType, missionConfig: config, timeline } = definition;
const laneCenters = [208, 268, 328];
const initial = () => createStationMissionRuntime(missionType, config);

test("the three tunnels keep the stage enemy pack and have actual gate art and ordered arrivals", () => {
  assert.equal(definition.enemyBaseMode, "scenery");
  assert.equal(v100MissionBriefingFor(V100_CENTRAL_SEAL_STAGE).label, "地下道のゲート");
  assert.deepEqual(timeline.map(wave => wave.requiredPowerCount ?? 0), [0, 1, 2]);
  assert.deepEqual(new Set(timeline.flatMap(wave => wave.units)), new Set(V100_ENEMY_PACKS[config.v100EnemyPack]));
  const plan = requiredBattleAssetPlan({ stageId: definition.stageId });
  assert.ok(plan.paths.includes(V100_CENTRAL_SEAL_ART.path));
  assert.ok(!requiredBattleAssetPlan({ stageId: "stage-t-plan-outer-core" }).paths.includes(V100_CENTRAL_SEAL_ART.path));
  const game = { definition, stageMission: initial(), eventIndex: 1, time: 50, enemySpawn: {pending: []}, fighters: [] };
  assert.equal(campaignWaveReady(game,timeline[1]),false);
  for(const [index,name] of ["central-tunnel-gate-1","central-tunnel-gate-2","central-tunnel-gate-3"].entries()){
    const entry=centralSealIngressPoint(index,laneCenters,35);
    assert.equal(entry.portalId,name);
    assert.equal(entry.y,laneCenters[index]);
    assert.ok(entry.x-35>entry.revealX && entry.combatReadyX+35<entry.revealX);
  }
});

test("the engaged open tunnel can send fresh enemies until it is physically sealed", () => {
  const game = { eventIndex: 1, time: 21, centralSealLastIngressAt: 7, stageMission: initial(),
    enemySpawn: {pending: []}, fighters: [] };
  assert.equal(centralSealCanReinforce(game),true);
  assert.equal(centralSealCanReinforce({...game,time:20}),false);
  assert.equal(centralSealCanReinforce({...game,enemySpawn:{pending:[{}]}}),false);
  assert.equal(centralSealCanReinforce({...game,stageMission:{...game.stageMission,powerOperating:true}}),false);
  assert.equal(centralSealCanReinforce({...game,fighters:[{side:"zombie",hp:1},{side:"zombie",hp:1}]}),false);
  const oneShut={...game,stageMission:{...game.stageMission,powerActivated:1}};
  assert.equal(centralSealCanReinforce(oneShut),false);
  assert.equal(centralSealCanReinforce({...oneShut,eventIndex:2}),true);
  assert.equal(centralSealCanReinforce({...game,eventIndex:3,stageMission:{...game.stageMission,powerActivated:3}}),false);
});

test("a living operator finishes the metal descent after arrivals and local threats clear", () => {
  let runtime = initial(), elapsed = 0;
  const step = (seconds, events, {pending=0,threat=false,stunned=0,hp=840}={}) => {
    elapsed+=seconds;
    const node=currentPowerNode(runtime,config);
    const mate=node?{id:1,side:"human",x:node.x,y:laneCenters[node.lane],hp:80,combatReady:true,stunned}:null;
    const enemies=threat&&mate?[{...mate,id:2,side:"zombie"}]:[];
    const spatial=stationSpatialSnapshot({missionType,missionRuntime:runtime,config,laneCenters,
      fighters:[...(mate?[mate]:[]),...enemies],eventIndex:events,timelineLength:timeline.length,pendingSpawnCount:pending});
    runtime=advanceStationMissionRuntime({...spatial,runtime,missionType,config,seconds,battleElapsedSeconds:elapsed,baseHp:hp});
  };
  const state=()=>({stageMission:runtime,baseHp:840,baseMaxHp:840,wavesResolved:true});
  step(6,0);
  step(6,1,{pending:1});
  step(6,1,{stunned:1});
  step(6,1,{threat:true});
  assert.equal(runtime.powerHold,0);
  assert.match(objectiveForBattle(definition,state()),/閉鎖盤1の周囲/u);
  step(4,1);
  assert.equal(runtime.powerActivated,0);
  assert.ok(centralSealGateDescent(runtime,0)>0&&centralSealGateDescent(runtime,0)<1);
  step(.5,1);
  assert.equal(runtime.powerActivated,1);
  assert.equal(centralSealGateDescent(runtime,0),1);
  step(4.5,2);
  step(4.5,3);
  assert.equal(runtime.powerActivated,3);
  assert.equal(battleOutcomeFor(definition,state()),null);
  step(1.2,3);
  assert.equal(battleOutcomeFor(definition,state()),"won");
  assert.equal(runtime.transitions.at(-1),"central-seal-secured");
  assert.ok(!runtime.transitions.includes("return-window-open"));
  assert.equal(battleOutcomeFor(definition,{...state(),baseHp:0}),"lost");
});

test("the drawn plates start above the entrances and cover each gate at completion", () => {
  const draws=[];
  const context=new Proxy({drawImage(_image,...args){draws.push(args);}},{
    get(target,key){return target[key]??(()=>{});},
  });
  const art={[V100_CENTRAL_SEAL_ART.id]:{complete:true,naturalWidth:812}};
  drawV100CentralSealGates(context,initial(),art,y=>y);
  assert.equal(draws.length,3);
  assert.ok(draws.every(rect=>rect[0]===0 && rect[2]===460));
  draws.length=0;
  drawV100CentralSealGates(context,{powerActivated:1,powerHold:4},art,y=>y);
  const plates=draws.filter(rect=>rect[0]===476);
  assert.equal(plates.length,2);
  assert.equal(plates[0][3],251);
  assert.ok(plates[1][3]>0&&plates[1][3]<251);
  assert.ok(plates[0][7]>plates[1][7]);
});
