import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import ts from 'typescript';
import {V100_STAGES} from '../app/v100Registry.js';
import {createCrawlerAbilityRuntime,requestCrawlerBarrage} from '../app/gameRules.js';

const source=fs.readFileSync(new URL('../scripts/v100-normal-campaign-playthrough.mjs',import.meta.url),'utf8');
const tree=ts.createSourceFile('normal-campaign.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const functions=new Map(tree.statements.filter(ts.isFunctionDeclaration).map(node=>[node.name.text,node]));
const fire=[];
const find=node=>{if(ts.isIfStatement(node)&&node.getText(tree).includes('await barrage.click()'))fire.push(node);ts.forEachChild(node,find);};
find(functions.get('battle'));
assert.equal(fire.length,1,'exercise the actual normal-play barrage input, without importing its hosted browser entry point');

async function runFire({stageNumber=3,bossVisible=false,seconds=122,visible=true,gauge=100,ready=true}={}){
  const stage=V100_STAGES.find(stage=>stage.number===stageNumber);
  let runtime=createCrawlerAbilityRuntime(ready?1:0,true),supportGauge=gauge;
  const record={inputs:[]},clicks=[];
  const request=()=>requestCrawlerBarrage({running:true,paused:false,over:false,runtime,supportGauge});
  const barrage={isVisible:async()=>visible,isEnabled:async()=>request().ok,async click(){
    const result=request();assert.equal(result.ok,true,'the real production support rule must authorize every input');
    runtime=result.runtime;supportGauge=result.supportGauge;clicks.push('vehicle-barrage');
  }};
  await vm.runInNewContext('(async()=>{'+fire[0].getText(tree)+'})()',{
    stage,bossVisible,barrage,record,start:0,Date:{now:()=>seconds*1000},
  });
  return {record,clicks,supportGauge,runtime};
}

for(const scenario of [{stageNumber:1,bossVisible:false},{stageNumber:3,bossVisible:false},{stageNumber:3,bossVisible:true},{stageNumber:3,bossVisible:true,seconds:4}]){
  test(`normal UI uses an enabled vehicle barrage at stage ${scenario.stageNumber}, boss visible=${scenario.bossVisible}, time=${scenario.seconds??122}s`,async()=>{
    const result=await runFire(scenario);
    assert.deepEqual(result.clicks,['vehicle-barrage']);
    assert.equal(result.supportGauge,30,'the normal production cost remains 70 from the observed full gauge');
    assert.equal(result.runtime.phase,'deploying');
    assert.equal(result.record.inputs.length,1);assert.equal(result.record.inputs[0].action,'barrage');
  });
}

test('boss approach still respects the visible button, real support cost, cooldown and existing opening delay',async()=>{
  for(const scenario of [{visible:false},{gauge:69},{ready:false},{seconds:12}]){
    const result=await runFire(scenario);assert.deepEqual(result.clicks,[]);assert.equal(result.record.inputs.length,0);
  }
});

test('a genuine stage3 defeat is saved and still stops the normal route before advancing',async()=>{
  const stage=V100_STAGES.find(stage=>stage.number===3),record={number:3,id:stage.id,openingSave:{revision:218}};
  const result={battleRunId:`v100:${stage.id}:218`,won:false,vehicleHp:0};
  const events=[];
  const accept=vm.runInNewContext('('+functions.get('acceptResult').getText(tree)+')',{
    Date,assert,path,out:'/evidence',ready:async()=>{},saveAt:async()=>({pendingResult:result}),
    page:{getByLabel:()=>({innerText:async()=>'ステージ失敗'}),screenshot:async()=>events.push('failure-screenshot')},
    persist:async()=>events.push('persist-defeat'),uiClick:async()=>{throw Error('A defeat must never advance');},button:()=>null,
  });
  await assert.rejects(()=>accept(record),/Normal-play defeat at Stage 3/u);
  assert.equal(record.status,'lost');assert.equal(record.result.won,false);
  assert.deepEqual(events,['failure-screenshot','persist-defeat']);
});
