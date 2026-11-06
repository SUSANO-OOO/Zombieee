import test from "node:test";
import assert from "node:assert/strict";
import {drawV100CorporateControl,V100_CORPORATE_CONTROLS,V100_CORPORATE_CONTROL_ART,V100_LURE_CONTROL_ART} from "../app/v100CorporateControl.js";
import {applyEnemyBaseDamage} from "../app/v100ResearchCore.js";
import {requiredBattleAssetPlan} from "../app/battleAssetPlan.js";
import {objectiveForBattle,battleOutcomeFor} from "../app/battleDefinitions.js";
import {v100BattleDefinitionFor} from "../app/v100BattleAdapter.js";
test("corporate objectives explain actual protection and destruction while legacy objectives remain intact",()=>{
  for(const [stageId,label] of Object.entries(V100_CORPORATE_CONTROLS)){
    const definition=v100BattleDefinitionFor(stageId);
    assert.equal(objectiveForBattle(definition,{barricadeHp:1000,barricadeVulnerable:true}),`${label}を破壊`);
    const protectedObjective=objectiveForBattle(definition,{barricadeHp:1000,barricadeVulnerable:false});
    if ([21,23,27].includes(definition.missionConfig.v100StageNumber)) {
      assert.equal(definition.bossEnemyKind,null);
      assert.equal(definition.bossUnlocksEnemyBase,false);
      assert.equal(protectedObjective,"警備部隊を迎撃（最終ウェーブで防護解除）");
    } else {
      assert.equal(definition.bossUnlocksEnemyBase,true);
      assert.match(protectedObjective,definition.missionConfig.v100StageNumber===24?/フタゴを倒し/u:/変異ムガリアン社長を倒し/u);
      assert.ok(protectedObjective.endsWith(`${label}を破壊`));
    }
    const finished={baseHp:680,baseMaxHp:680,barricadeHp:0,barricadeVulnerable:true,bossDefeated:true};
    assert.equal(battleOutcomeFor(definition,finished),"won");
    assert.equal(objectiveForBattle(definition,finished),`${label}を破壊した`);
  }
  assert.equal(objectiveForBattle({stageId:"stage-mugarian-logistics-hq",missionType:"assault",missionConfig:{target:"infected-relay"}},{barricadeHp:1000,barricadeVulnerable:true}),"感染中継点を破壊");
});
test("authored corporate damage states follow actual protected and applied base damage without owning results",()=>{
  for(const stageId of Object.keys(V100_CORPORATE_CONTROLS)){
    const lure=stageId==="stage-mugarian-logistics-hq";
    assert.ok(requiredBattleAssetPlan({stageId}).paths.includes(lure?V100_LURE_CONTROL_ART:V100_CORPORATE_CONTROL_ART));
    const game={definition:{stageId},barricadeHp:1000,barricadeMaxHp:1000,barricadeVulnerable:false};
    const frames=[],context=new Proxy({drawImage:(_image,left)=>frames.push(left)},{get:(target,key)=>key in target?target[key]:()=>{}});
    const draw=()=>{const before=JSON.stringify(game);assert.equal(drawV100CorporateControl(context,game,{corporateControlStates:{complete:true,naturalWidth:2172},lureControlStates:{complete:true,naturalWidth:2172}},{attackX:875},[212,282,352]),true);assert.equal(JSON.stringify(game),before);};
    applyEnemyBaseDamage(game,1000);draw();assert.equal(game.barricadeHp,1000);
    game.barricadeVulnerable=true;applyEnemyBaseDamage(game,300);draw();applyEnemyBaseDamage(game,400);draw();applyEnemyBaseDamage(game,300);draw();
    assert.deepEqual(frames,lure?[0,530,1060,1560]:[0,530,1030,1530]);
    assert.throws(()=>drawV100CorporateControl(context,game,{}, {attackX:875},[212,282,352]),/decoded/);
  }
});
