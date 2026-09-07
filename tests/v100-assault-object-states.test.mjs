import test from 'node:test';
import assert from 'node:assert/strict';
import {V100_STAGES} from '../app/v100Registry.js';
import {v100BattleDefinitionFor} from '../app/v100BattleAdapter.js';
import {requiredBattleAssetPlan} from '../app/battleAssetPlan.js';
import {applyEnemyBaseDamage} from '../app/v100ResearchCore.js';
import {drawV100AssaultObject,v100AssaultObjectProfile,V100_ASSAULT_OBJECT_ART} from '../app/v100AssaultObjects.js';
import {v100VehicleSprite,v100EscortDestinationState} from '../app/v100MissionVehicleSprites.js';

test('authored assault states consume applied damage and preserve protected bases, special objectives and legacy rendering',()=>{
  assert.deepEqual(V100_STAGES.filter(s=>v100AssaultObjectProfile(s.id)).map(s=>s.number),[1,3,4,5,8,10,11,13,14,17,20,30]);
  for(const stage of V100_STAGES){
    const profile=v100AssaultObjectProfile(stage.id),definition=v100BattleDefinitionFor(stage.id);
    if(!profile){assert.equal(drawV100AssaultObject(null,{definition},null,null,null),false);continue;}
    const plan=requiredBattleAssetPlan({stageId:stage.id});assert.ok(plan.paths.includes(V100_ASSAULT_OBJECT_ART[profile]));
    const old=requiredBattleAssetPlan({stageId:stage.id,includeV100Sprites:false});
    assert.ok(Object.values(V100_ASSAULT_OBJECT_ART).every(path=>!old.paths.includes(path)));
    assert.equal(drawV100AssaultObject(null,{definition:{...definition,missionConfig:{}}},null,null,null),false);
    const game={definition,barricadeHp:1000,barricadeMaxHp:1000,barricadeVulnerable:false},frames=[];
    const context=new Proxy({drawImage:(_image,left)=>frames.push(left)},{get:(target,key)=>key in target?target[key]:()=>{}});
    const image={complete:true,naturalWidth:2172},objects={[`v100-assault-${profile}`]:image};
    const draw=()=>{const before=JSON.stringify(game);assert.equal(drawV100AssaultObject(context,game,objects,{attackX:875},[212,282,352]),true);assert.equal(JSON.stringify(game),before);};
    applyEnemyBaseDamage(game,1000);draw();assert.equal(game.barricadeHp,1000);
    game.barricadeVulnerable=true;applyEnemyBaseDamage(game,300);draw();applyEnemyBaseDamage(game,400);draw();applyEnemyBaseDamage(game,300);draw();
    assert.deepEqual(frames,profile==='relay'?[0,540,1060,1590]:[0,510,1030,1540]);
    assert.throws(()=>drawV100AssaultObject(context,game,{}, {attackX:875},[212,282,352]),/decoded/);
  }
});
test('escort damage frames and arrival signal reflect actual integrity and confirmed mission completion',()=>{
  for(const number of [6,12,19,26]){
    const stageId=V100_STAGES[number-1].id;
    assert.deepEqual([100,59,29,0].map(integrity=>v100VehicleSprite(stageId,{integrity,maxIntegrity:100}).state),['intact','damaged','critical','destroyed']);
    const game={stageMission:{integrity:100,completed:false},baseHp:680};
    assert.equal(v100EscortDestinationState(game),0);game.stageMission.completed=true;assert.equal(v100EscortDestinationState(game),1);
    game.stageMission.integrity=0;assert.equal(v100EscortDestinationState(game),0);
    game.stageMission.integrity=100;game.stageMission.failed=true;assert.equal(v100EscortDestinationState(game),0);
    game.stageMission.failed=false;game.baseHp=0;assert.equal(v100EscortDestinationState(game),0);
  }
});
