import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { createBattleDefinition } from "../app/battleDefinitions.js";
import { battleOutcomeFor } from "../app/battleDefinitions.js";
import { V100_STAGES } from "../app/v100Registry.js";
import { isBossFighter } from "../app/bossFoundation.js";
import { v100AssaultObjectProfile } from "../app/v100AssaultObjects.js";

const source=await readFile("app/AshfallGame.tsx","utf8");
const ast=ts.createSourceFile("AshfallGame.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let consumer;
const visit=node=>{
  if(ts.isWhileStatement(node)&&node.expression.getText(ast).startsWith("g.eventIndex < g.definition.timeline.length")) consumer=node.getText(ast);
  ts.forEachChild(node,visit);
};
visit(ast);assert.ok(consumer,"Test must exercise Ashfall's production timeline consumer");
const code=ts.transpileModule(consumer,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;

test("the actual consumer establishes combat before Omega, then emits both A reinforcements",()=>{
  const definition=createBattleDefinition(V100_STAGES[29].id,{v100:true});
  const g={definition,eventIndex:0,time:definition.timeline[0].at,fighters:[],enemySpawn:{nextEntryId:1,pending:[]}};
  const queued=[],announced=[];
  const fixture={g,isBossFighter,v100AssaultObjectProfile,isBossEnemyKind:kind=>kind==="takuya-omega",activeStageViewportId:"844x340",
    enqueueEnemyWave:(runtime,event)=>{queued.push(event);return {...runtime,nextEntryId:runtime.nextEntryId+event.units.length,pending:event.units.map((kind,index)=>({kind,entryId:runtime.nextEntryId+index}))};},
    enemySpawnPortalPoint:()=>({legacyLane:1}),announceBossEntrance:(_game,kind)=>announced.push(kind),playCue:()=>{},emitBattleBark:()=>{},
  };
  vm.runInNewContext(code,fixture);
  assert.deepEqual(queued.flatMap(event=>event.units),["walker","runner","spitter"]);
  assert.deepEqual(announced,[]);
  g.time=definition.timeline[4].at-0.01;vm.runInNewContext(code,fixture);assert.deepEqual(announced,[]);
  g.time=definition.timeline[4].at;vm.runInNewContext(code,fixture);assert.deepEqual(announced,[],"Prelude guards must clear first");
  g.enemySpawn.pending=[];vm.runInNewContext(code,fixture);assert.deepEqual(announced,["takuya-omega"]);
  g.fighters.push({kind:"takuya-omega",hp:9200});
  g.enemySpawn.pending=[];
  g.time=definition.timeline.at(-1).at;
  vm.runInNewContext(code,fixture);
  assert.deepEqual(queued.map(event=>event.wave),[1,2,3,4,5,6,7]);
  assert.deepEqual(queued.slice(5).flatMap(event=>event.units),["walker","runner","crusher","spitter","spitter","crusher","walker","runner"]);
  vm.runInNewContext(code,fixture);
  assert.equal(queued.length,7,"Every real event is consumed once");
});

test("no V1 boss entrance requires that same boss to be alive already",()=>{
  for(const stage of V100_STAGES){
    const definition=createBattleDefinition(stage.id,{v100:true});
    for(const event of definition.timeline.filter(event=>event.units.includes(definition.bossEnemyKind))) assert.notEqual(event.bossOnly,true,stage.id);
  }
});

test("escort waves wait for travelled distance even after a long stall, then finish with late pressure", () => {
  const definition=createBattleDefinition(V100_STAGES[5].id,{v100:true});
  const g={definition,eventIndex:0,time:1000,stageMission:{progress:0},fighters:[],enemySpawn:{nextEntryId:1,pending:[]}};
  const queued=[];
  const fixture={g,isBossFighter,isBossEnemyKind:()=>false,activeStageViewportId:"844x340",
    enqueueEnemyWave:(runtime,event)=>{queued.push(event);return {...runtime,nextEntryId:runtime.nextEntryId+event.units.length,pending:[]};},
    enemySpawnPortalPoint:()=>({legacyLane:1}),playCue:()=>{},emitBattleBark:()=>{},announceBossEntrance:()=>{throw new Error("Escort cannot introduce a boss");},
  };
  const advance=()=>vm.runInNewContext(code,fixture);
  advance();assert.equal(queued.length,2,"A stalled convoy cannot exhaust its distance-owned waves");
  g.stageMission.progress=.69;advance();assert.equal(queued.length,4);
  g.stageMission.progress=.87;advance();assert.equal(queued.length,5);
  g.stageMission.progress=.88;advance();assert.equal(queued.length,6);
  advance();assert.equal(queued.length,6,"Late contact remains a one-time wave");
  assert.ok(definition.missionConfig.durationSeconds<105);
});

test("TAKUYA's two actual reinforcement waves follow HP phases, including a burst defeat", () => {
  for (const burstDefeat of [false, true]) {
    const definition = createBattleDefinition(V100_STAGES[2].id, { v100: true });
    const g = { definition, eventIndex: 0, time: 1000, fighters: [], enemySpawn: { nextEntryId: 1, pending: [] } };
    const queued = [];
    const context = { g, isBossFighter, isBossEnemyKind: kind => kind === "takuya", activeStageViewportId: "844x340",
      enqueueEnemyWave: (runtime, event) => { queued.push(event); return { ...runtime, nextEntryId: runtime.nextEntryId + event.units.length, pending: [] }; },
      enemySpawnPortalPoint: () => ({}), announceBossEntrance: () => {}, playCue: () => {}, emitBattleBark: () => {},
    };
    const advance = () => vm.runInNewContext(code, context);
    advance(); assert.equal(queued.length, 5, "pending entrance cannot consume a phase wave");
    g.fighters.push({ kind: "takuya", hp: 2400, maxHp: 2400 });
    advance(); assert.equal(queued.length, 5, "elapsed time alone cannot activate HP reinforcements");
    if (burstDefeat) {
      g.fighters = []; g.bossDefeated = true;
      advance(); assert.equal(queued.length, 7, "burst defeat cannot discard either reinforcement");
    } else {
      g.fighters[0].hp = 2400 * .70; advance(); assert.equal(queued.length, 6);
      g.fighters[0].hp = 2400 * .35; advance(); assert.equal(queued.length, 7);
    }
    advance(); assert.equal(queued.length, 7, "phase waves commit once");
    assert.deepEqual(queued.slice(5).map(event => event.units), [["walker", "runner", "shade", "walker"], ["spitter", "crusher", "abomination", "runner"]]);
    assert.equal(battleOutcomeFor(definition, { baseHp: 680, barricadeHp: 0, bossDefeated: true, wavesResolved: false }), null);
  }
});

test("Gate Eater follows two infection waves and still requires their clearance", () => {
  const definition = createBattleDefinition(V100_STAGES[4].id, { v100: true });
  assert.equal(definition.timeline.length,7);
  assert.equal(definition.timeline[4].units[0],"gate-eater");
  assert.ok(definition.timeline[4].at-definition.prepSeconds>=100);
  assert.ok(definition.timeline.slice(0,4).flatMap(event=>event.units).length>=15);
  assert.deepEqual(definition.timeline.slice(5).map(event=>event.bossHpRatio),[.75,.4]);
  assert.equal(battleOutcomeFor(definition, { baseHp: 680, barricadeHp: 0, bossDefeated: true, wavesResolved: false }), null);
});

test("S30 Omega victory waits for real boss defeat and waves, independent of gate HP", () => {
  const definition = createBattleDefinition(V100_STAGES[29].id, { v100: true });
  const complete = { baseHp: definition.baseMaxHp, barricadeHp: 350, bossDefeated: true, bossDefeatPending: false, barricadeVulnerable: true, wavesResolved: true };
  assert.equal(battleOutcomeFor(definition, complete), "won");
  assert.equal(battleOutcomeFor(definition, { ...complete, bossDefeated: false }), null);
  assert.equal(battleOutcomeFor(definition, { ...complete, bossDefeatPending: true }), null);
  assert.equal(battleOutcomeFor(definition, { ...complete, wavesResolved: false }), null);
  assert.equal(battleOutcomeFor(definition, { ...complete, baseHp: 1 }), "lost");
  assert.equal(battleOutcomeFor(definition, { ...complete, baseHp: 0 }), "lost");
});

test("all campaign bosses have ordinary combat before their entrance",()=>{
 for(const stage of V100_STAGES.filter(s=>s.missionType==='boss')){
  const d=createBattleDefinition(stage.id,{v100:true}),entrance=d.timeline.findIndex(e=>e.units.includes(d.bossEnemyKind));
  assert.ok(entrance>=2,stage.id);assert.ok(d.timeline[entrance].at-d.prepSeconds>=30,stage.id);
  assert.ok(d.timeline.slice(0,entrance).flatMap(e=>e.units).length>=4,stage.id);
 }
});

test("Futago retains both bodies and its final group cannot overlap surviving prior guards", () => {
  const definition=createBattleDefinition(V100_STAGES[23].id,{v100:true});
  assert.deepEqual(definition.timeline.map(e=>e.units.filter(kind=>kind!=="futago").length),[2,2,3,3]);
  assert.deepEqual(definition.timeline.map(e=>e.at),[5,29,53,77]);
  assert.ok(definition.timeline.slice(0,3).flatMap(e=>e.units).every(kind=>["red-panther-shield","red-panther-commander"].includes(kind)));
  assert.deepEqual(definition.timeline[3].units.slice(-2),["futago","futago"]);
  assert.equal(definition.timeline[3].waitForPriorWaveClear,true);
  const g={definition,eventIndex:3,time:definition.timeline[3].at,fighters:[{id:1,side:"zombie",kind:"red-panther-shield",hp:1}],enemySpawn:{nextEntryId:8,pending:[]}};
  const queued=[],announced=[];
  const context={g,isBossFighter,isBossEnemyKind:kind=>kind==="futago",activeStageViewportId:"844x340",
    enqueueEnemyWave:(runtime,event)=>{queued.push(event);return{...runtime,nextEntryId:runtime.nextEntryId+event.units.length,pending:[]};},
    enemySpawnPortalPoint:()=>({}),announceBossEntrance:(_game,kind)=>announced.push(kind),playCue:()=>{},emitBattleBark:()=>{}};
  const advance=()=>vm.runInNewContext(code,context);
  advance();assert.equal(g.eventIndex,3);assert.equal(queued.length,0);assert.deepEqual(announced,[]);
  g.time=140;advance();assert.equal(g.eventIndex,3,"time cannot discard a surviving prior guard");
  g.fighters[0].hp=0;g.enemySpawn.pending=[{entryId:7,kind:"red-panther-commander"}];
  advance();assert.equal(g.eventIndex,3,"an offscreen queued guard also prevents the final group");
  g.enemySpawn.pending=[];advance();
  assert.equal(g.eventIndex,4);assert.equal(queued.length,1);assert.deepEqual(queued[0].units,definition.timeline[3].units);
  assert.deepEqual(announced,["futago"]);advance();assert.equal(queued.length,1,"the complete final group is committed once without another timer");
});

test("the president uses the same prior-guard clearance boundary without removing Panther guards or changing the boss",()=>{
  const definition=createBattleDefinition(V100_STAGES[24].id,{v100:true});
  assert.deepEqual(definition.timeline.map(e=>e.at),[5,29,53,77]);
  assert.deepEqual(definition.timeline.map(e=>e.units.filter(kind=>kind!=="mugarian-president-mutated").length),[2,2,3,3]);
  assert.ok(definition.timeline.slice(0,3).flatMap(e=>e.units).every(kind=>kind.startsWith("red-panther-")));
  assert.equal(definition.timeline.at(-1).units.filter(kind=>kind==="mugarian-president-mutated").length,1);
  assert.deepEqual(definition.timeline.map(e=>e.waitForPriorWaveClear===true),[false,false,false,true]);
  for(const number of [3,5,11,14,17,20,30]){
    const d=createBattleDefinition(V100_STAGES[number-1].id,{v100:true});
    assert.equal(d.timeline.find(e=>e.units.includes(d.bossEnemyKind)).waitForPriorWaveClear,true);
  }
});
