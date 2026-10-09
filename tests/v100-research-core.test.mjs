import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createBattleDefinition,battleOutcomeFor,objectiveForBattle } from "../app/battleDefinitions.js";
import { createResearchCoreTargets,applyEnemyBaseDamage,researchCoreAttackTarget,drawResearchCoreTargets,V100_RESEARCH_CORE_STAGE,V100_RESEARCH_CORE_ART } from "../app/v100ResearchCore.js";
import { requiredBattleAssetPlan } from "../app/battleAssetPlan.js";
import { createV100BattleResult,recordV100PendingResult } from "../app/v100Transactions.js";
import { createDefaultV100Save,serializeV100Save } from "../app/v100Save.js";
const definition=createBattleDefinition(V100_RESEARCH_CORE_STAGE,{v100:true});
const fresh=()=>({definition,baseHp:680,barricadeHp:1000,barricadeVulnerable:true,researchCoreTargets:createResearchCoreTargets(definition),wavesResolved:false});

test("both real research targets and all six enemy waves must resolve; aggregate HP cannot substitute",()=>{
 const game=fresh();assert.equal(definition.timeline.length,6);
 assert.match(objectiveForBattle(definition,game),/0\/2/);
 const first=researchCoreAttackTarget(game,{x:875,y:250});
 assert.equal(first.researchTargetId,"overseas-activation-line");
 assert.equal(applyEnemyBaseDamage(game,900,first.researchTargetId),500);
 assert.equal(game.barricadeHp,500);assert.equal(game.researchCoreTargets[1].hp,500);
 assert.match(objectiveForBattle(definition,game),/1\/2.*感染源原株/);
 // An in-flight projectile owns the now-dead first target, not the next one.
 assert.equal(applyEnemyBaseDamage(game,80,first.researchTargetId),0);
 const second=researchCoreAttackTarget(game,{x:875,y:250});assert.equal(second.researchTargetId,"source-stock");
 assert.equal(applyEnemyBaseDamage(game,500,second.researchTargetId),500);
 assert.equal(battleOutcomeFor(definition,game),null,"six elite waves still unresolved");
 game.wavesResolved=true;assert.equal(battleOutcomeFor(definition,game),"won");
 game.baseHp=0;assert.equal(battleOutcomeFor(definition,game),"lost");
 assert.equal(battleOutcomeFor(definition,{...fresh(),barricadeHp:0,wavesResolved:true}),null,"aggregate HP alone must never win");
});

test("source damage preserves legacy base behavior and does not cross a shield",()=>{
 const game={barricadeHp:70,barricadeVulnerable:false};
 assert.equal(applyEnemyBaseDamage(game,100),0);assert.equal(game.barricadeHp,70);
 game.barricadeVulnerable=true;assert.equal(applyEnemyBaseDamage(game,100),70);assert.equal(game.barricadeHp,0);
 assert.equal(createResearchCoreTargets({missionConfig:{}}),null);
});

test("the actual objective evidence survives result conversion and save serialization",()=>{
 const game=fresh();applyEnemyBaseDamage(game,500,"overseas-activation-line");applyEnemyBaseDamage(game,500,"source-stock");
 const result=createV100BattleResult({stageId:definition.stageId,battleRunId:"v100:core-save-proof",won:true,objectiveComplete:true,vehicleHp:680,researchCoreTargets:game.researchCoreTargets});
 const pending=recordV100PendingResult(createDefaultV100Save(),result);
 assert.equal(pending.applied,true);
 const stored=JSON.parse(serializeV100Save(pending.save));
 assert.deepEqual(stored.pendingResult.researchCoreTargets,[{id:"overseas-activation-line",hp:0,maxHp:500},{id:"source-stock",hp:0,maxHp:500}]);
});

test("all eight authored cells render from each target's independent actual HP",async()=>{
 const game=fresh(),draws=[];
 const context=new Proxy({drawImage:(...args)=>draws.push(args)}, {get:(target,key)=>target[key]??(()=>{})});
 const art={complete:true,naturalWidth:1774,naturalHeight:887};
 const sprites={"v100-research-core-targets":art};
 for (const [hp,state] of [[500,0],[350,1],[150,2],[0,3]]) {
   game.researchCoreTargets.forEach(target=>target.hp=hp);
   drawResearchCoreTargets(context,game,sprites,{attackX:875},[212,282,352]);
   const [line,stock]=draws.slice(-2);
   assert.equal(line[1],state*443.5);assert.equal(line[2],0);
   assert.equal(stock[1],state*443.5);assert.equal(stock[2],443.5);
   assert.ok(stock[5]+stock[7]<=960,"source stock fits the battlefield");
 }
 assert.throws(()=>drawResearchCoreTargets(context,game,{}, {attackX:875},[212,282,352]),/decoded/);
 const plan=requiredBattleAssetPlan({stageId:V100_RESEARCH_CORE_STAGE});
 assert.ok(plan.paths.includes(V100_RESEARCH_CORE_ART));
 const source=await readFile("app/AshfallGame.tsx","utf8");
 assert.match(source,/researchCoreTargets: createResearchCoreTargets\(definition\)/);
 assert.match(source,/drawResearchCoreTargets\(ctx, g, stageObjects, barrier, activeLaneCenters\)/);
 assert.match(source,/applyEnemyBaseDamage\(g, hit\.damage, hit\.researchTargetId\)/);
 assert.match(source,/applyEnemyBaseDamage\(g, structureDamage, enemyBaseTarget\.researchTargetId\)/);
 assert.match(source,/applyEnemyBaseDamage\(g, structureDamage, structureTargetId\.split/);
 assert.equal((source.match(/researchTargetId: enemyBaseTarget\.researchTargetId/g)??[]).length,3,"all deferred structure weapon families preserve the selected target");
});
