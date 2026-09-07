import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { createBattleDefinition } from "../app/battleDefinitions.js";
import { V100_STAGES } from "../app/v100Registry.js";

const source=await readFile("app/AshfallGame.tsx","utf8");
const ast=ts.createSourceFile("AshfallGame.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let consumer;
const visit=node=>{
  if(ts.isWhileStatement(node)&&node.expression.getText(ast).startsWith("g.eventIndex < g.definition.timeline.length")) consumer=node.getText(ast);
  ts.forEachChild(node,visit);
};
visit(ast);assert.ok(consumer,"Test must exercise Ashfall's production timeline consumer");
const code=ts.transpileModule(consumer,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;

test("the actual empty-arena consumer enqueues Omega, then both A reinforcements",()=>{
  const definition=createBattleDefinition(V100_STAGES[29].id,{v100:true});
  const g={definition,eventIndex:0,time:definition.timeline[0].at,fighters:[],enemySpawn:{nextEntryId:1,pending:[]}};
  const queued=[],announced=[];
  const fixture={g,isBossEnemyKind:kind=>kind==="takuya-omega",activeStageViewportId:"844x340",
    enqueueEnemyWave:(runtime,event)=>{queued.push(event);return {...runtime,nextEntryId:runtime.nextEntryId+event.units.length,pending:event.units.map((kind,index)=>({kind,entryId:runtime.nextEntryId+index}))};},
    enemySpawnPortalPoint:()=>({legacyLane:1}),announceBossEntrance:(_game,kind)=>announced.push(kind),playCue:()=>{},emitBattleBark:()=>{},
  };
  vm.runInNewContext(code,fixture);
  assert.deepEqual(queued.flatMap(event=>event.units),["takuya-omega"]);
  assert.deepEqual(announced,["takuya-omega"]);
  g.fighters.push({kind:"takuya-omega",hp:9200});
  g.time=definition.timeline.at(-1).at;
  vm.runInNewContext(code,fixture);
  assert.deepEqual(queued.map(event=>event.wave),[1,2,3]);
  assert.deepEqual(queued.slice(1).flatMap(event=>event.units),["walker","runner","spitter","crusher"]);
  vm.runInNewContext(code,fixture);
  assert.equal(queued.length,3,"Every real event is consumed once");
});

test("no V1 boss entrance requires that same boss to be alive already",()=>{
  for(const stage of V100_STAGES){
    const definition=createBattleDefinition(stage.id,{v100:true});
    for(const event of definition.timeline.filter(event=>event.units.includes(definition.bossEnemyKind))) assert.notEqual(event.bossOnly,true,stage.id);
  }
});
