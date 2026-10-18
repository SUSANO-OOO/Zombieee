import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import ts from 'typescript';
import {V100_STAGES} from '../app/v100Registry.js';
import {createCrawlerAbilityRuntime,requestCrawlerBarrage} from '../app/gameRules.js';
import {normalCampaignCanSpendVehicleGauge} from '../scripts/v100-normal-play-contract.mjs';

const source=fs.readFileSync(new URL('../scripts/v100-normal-campaign-playthrough.mjs',import.meta.url),'utf8');
const tree=ts.createSourceFile('normal-campaign.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const functions=new Map(tree.statements.filter(ts.isFunctionDeclaration).map(node=>[node.name.text,node]));
const fire=[];
const find=node=>{if(ts.isIfStatement(node)&&node.getText(tree).includes('await barrage.click()'))fire.push(node);ts.forEachChild(node,find);};
find(functions.get('battle'));
assert.equal(fire.length,1,'exercise the actual normal-play barrage input, without importing its hosted browser entry point');

async function runFire({stageNumber=3,bossVisible=false,seconds=122,visible=true,gauge=100,ready=true,airstrikeRequested=false,firstAirstrike=true,observedEnemy=true}={}){
  const stage=V100_STAGES.find(stage=>stage.number===stageNumber);
  let runtime=createCrawlerAbilityRuntime(ready?1:0,true),supportGauge=gauge;
  const record={inputs:firstAirstrike?[{action:'airstrike',acknowledgment:{state:'cooldown',disabled:'true'}}]:[]},clicks=[];
  const request=()=>requestCrawlerBarrage({running:true,paused:false,over:false,runtime,supportGauge});
  const barrage={isVisible:async()=>visible,isEnabled:async()=>request().ok,async click(){
    const result=request();assert.equal(result.ok,true,'the real production support rule must authorize every input');
    runtime=result.runtime;supportGauge=result.supportGauge;clicks.push('vehicle-barrage');
  }};
  await vm.runInNewContext('(async()=>{'+fire[0].getText(tree)+'})()',{
    normalCampaignCanSpendVehicleGauge,visibleEnemyTarget:observedEnemy,barrageReady:visible&&request().ok,stage,bossVisible,barrage,record,start:0,Date:{now:()=>seconds*1000},airstrikeRequested,
  });
  return {record,clicks,supportGauge,runtime};
}

for(const scenario of [{stageNumber:1,bossVisible:false},{stageNumber:3,bossVisible:false},{stageNumber:3,bossVisible:true},{stageNumber:3,bossVisible:true,seconds:4}]){
  test(`normal UI uses an enabled vehicle barrage at stage ${scenario.stageNumber}, boss visible=${scenario.bossVisible}, time=${scenario.seconds??122}s`,async()=>{
    const result=await runFire(scenario);
    assert.deepEqual(result.clicks,['vehicle-barrage']);
    assert.equal(result.supportGauge,30,'the normal production cost remains 70 from the observed full gauge');
    assert.equal(result.runtime.phase,'deploying');
    assert.equal(result.record.inputs.length,2);assert.equal(result.record.inputs[1].action,'barrage');
  });
}

test('boss approach still respects the visible button, real support cost, cooldown and existing opening delay',async()=>{
  for(const scenario of [{visible:false},{gauge:69},{ready:false},{seconds:12},{airstrikeRequested:true}]){
    const result=await runFire(scenario);assert.deepEqual(result.clicks,[]);assert.equal(result.record.inputs.filter(input=>input.action==='barrage').length,0);
  }
});

for(const slot of ['pendingResult','lastResult'])test('a genuine stage3 defeat in '+slot+' is saved and still stops the normal route before advancing',async()=>{
  const stage=V100_STAGES.find(stage=>stage.number===3),record={number:3,id:stage.id,openingSave:{revision:218}};
  const result={battleRunId:`v100:${stage.id}:218`,won:false,vehicleHp:0};
  const events=[];let saveReads=0;
  const accept=vm.runInNewContext('('+functions.get('acceptResult').getText(tree)+')',{
    Date,assert,path,out:'/evidence',ready:async()=>{},saveAt:async()=>{saveReads++;return{[slot]:result};},
    page:{getByLabel:()=>({innerText:async()=>'ステージ失敗'}),screenshot:async()=>events.push('failure-screenshot')},
    persist:async()=>events.push('persist-defeat'),uiClick:async()=>{throw Error('A defeat must never advance');},button:()=>null,
  });
  await assert.rejects(()=>accept(record),/Normal-play defeat at Stage 3/u);
  assert.equal(record.status,'lost');assert.equal(record.result.won,false);
  assert.equal(saveReads,1,'Read pending and committed result from the same save snapshot');
  assert.deepEqual(events,['failure-screenshot','persist-defeat']);
});

test('actual normal battle handoff recognizes its committed loss and preserves unrelated input failures',async()=>{
  const catches=[];
  const visit=node=>{if(ts.isCatchClause(node)&&node.block.getText(tree).includes('record.completedResultHandoff'))catches.push(node);ts.forEachChild(node,visit);};
  visit(functions.get('battle'));assert.equal(catches.length,1);
  const actual='(async()=>{for(;;)'+catches[0].block.getText(tree)+'})()';
  const stage=V100_STAGES.find(stage=>stage.number===4),result={battleRunId:`v100:${stage.id}:257`,won:false,vehicleHp:0};
  for(const scenario of [{slot:'pendingResult'},{slot:'lastResult'},{slot:'lastResult',phase:'battle'},
    {slot:'lastResult',visible:false},{slot:'lastResult',runId:'old-unrelated-battle'},{slot:'missing'}]){
    const error=new Error('Original detached unit-card timeout'),record={openingSave:{revision:257}},saved=scenario.slot==='missing'?{}:
      {[scenario.slot]:{...result,...(scenario.runId?{battleRunId:scenario.runId}:{})}};
    let reads=0;
    const execution=vm.runInNewContext(actual,{stage,record,error,saveAt:async()=>{reads++;return saved;},phaseAt:async()=>scenario.phase??'result',
      page:{getByLabel(name,options){assert.equal(name,'戦闘結果');assert.equal(options.exact,true);return{isVisible:async()=>scenario.visible!==false};}}});
    if(scenario.phase||scenario.visible===false||scenario.runId||scenario.slot==='missing'){
      await assert.rejects(execution,actualError=>actualError===error);assert.equal(record.completedResultHandoff,undefined);
    }else{
      await execution;assert.equal(record.completedResultHandoff.battleRunId,result.battleRunId);
      assert.equal(record.completedResultHandoff.error,String(error));
    }
    assert.equal(reads,1);assert.equal(saved[scenario.slot]?.won,scenario.slot==='missing'?undefined:false);
  }
});

test('the actual caller reserves the first airstrike even when production vehicle fire is enabled',async()=>{
  for(const stageNumber of [1,3,5,30]){const r=await runFire({stageNumber,firstAirstrike:false});assert.deepEqual(r.clicks,[]);assert.equal(r.supportGauge,100);assert.equal(r.runtime.phase,'ready');}
});

test('an unobserved field never spends vehicle support before or after the first aircraft',async()=>{
  for(const stageNumber of [1,3,5,30])for(const firstAirstrike of [false,true]) {
    const r=await runFire({stageNumber,firstAirstrike,observedEnemy:false});
    assert.deepEqual(r.clicks,[]);assert.equal(r.supportGauge,100);assert.equal(r.runtime.phase,'ready');
  }
});
