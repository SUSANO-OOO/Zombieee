import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {normalCampaignDeployOrder,normalCampaignAirstrikeTarget} from '../scripts/v100-normal-play-contract.mjs';
import {AIRSTRIKE_DEF,createEmergencySupportRuntime,requestAirstrike} from '../app/gameRules.js';

const source=fs.readFileSync(new URL('../scripts/v100-normal-campaign-playthrough.mjs',import.meta.url),'utf8');
const tree=ts.createSourceFile('normal-campaign.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const battle=tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name.text==='battle');
const blocks=[];
function visit(node){if(ts.isIfStatement(node)&&node.expression.getText(tree).includes('airstrike.isEnabled'))blocks.push(node);ts.forEachChild(node,visit);}
visit(battle);assert.equal(blocks.length,1,'exercise the actual hosted-only normal input block without importing a browser');

test('the visible equipped roster opens with a front unit, ranged cover and healer without losing or adding a kind',()=>{
  const kinds=['medic','babayaga','scout','kumaverson','brawler'];
  const ordered=normalCampaignDeployOrder(kinds);
  assert.deepEqual(ordered,['scout','babayaga','medic','kumaverson','brawler']);
  assert.deepEqual([...ordered].sort(),[...kinds].sort());
  assert.deepEqual(kinds,['medic','babayaga','scout','kumaverson','brawler']);
  assert.deepEqual(normalCampaignDeployOrder(['future-unit','ranger']),['ranger','future-unit']);
  assert.throws(()=>normalCampaignDeployOrder(['scout','scout']));
});

test('visible anchors, vehicle health and real world transforms keep every aim inside the production airstrike range',()=>{
  for(const width of [1280,844,667])for(const worldOffsetX of [0,-40,30]) {
    const canvas={x:11,y:23,width,height:340,worldScale:width/960,worldOffsetX,worldOffsetY:-30};
    for(const anchors of [[],[{x:width-1,y:330}],[{x:0,y:0}],[{x:width*.6,y:150},{x:width*.7,y:140}]]) {
      const aim=normalCampaignAirstrikeTarget(canvas,anchors,'西新防衛線\n耐久\n650 / 680');
      assert.ok(aim.defensive);
      assert.ok(aim.point.x>canvas.x&&aim.point.x<canvas.x+width&&aim.point.y>canvas.y&&aim.point.y<canvas.y+canvas.height);
      assert.ok(aim.worldPoint.x>=AIRSTRIKE_DEF.minX&&aim.worldPoint.x<=AIRSTRIKE_DEF.maxX);
      const request=requestAirstrike({running:true,paused:false,over:false,supportGauge:100,lane:1,...aim.worldPoint,runtime:createEmergencySupportRuntime(true)});
      assert.equal(request.ok,true);assert.equal(request.supportGauge,15);assert.equal(request.runtime.cooldownRemaining,50);
    }
  }
  for(const canvas of [null,{x:0,y:0,width:844,height:340},{x:0,y:0,width:844,height:340,worldScale:0,worldOffsetX:0,worldOffsetY:0}])assert.equal(normalCampaignAirstrikeTarget(canvas,[]),null);
});

async function fire({seconds=122,gauge=100,visible=true,clear=true,cooldown=0,canvasMissing=false,ignoreAim=false}={}) {
  const box={x:0,y:0,width:960,height:540,worldScale:1,worldOffsetX:0,worldOffsetY:0};
  const canvas={dataset:{worldScale:'1',worldOffsetX:'0',worldOffsetY:'0'},getBoundingClientRect:()=>box};
  const anchors=[{x:420,y:180}],record={inputs:[]},clicks=[];
  let runtime={...createEmergencySupportRuntime(true),cooldownRemaining:cooldown},selected=false;
  const request=point=>requestAirstrike({running:true,paused:false,over:false,supportGauge:gauge,lane:1,x:point.x,y:point.y,runtime});
  const button={getAttribute(name){if(name==='aria-disabled')return runtime.phase==='idle'&&gauge>=85&&runtime.cooldownRemaining===0?'false':'true';if(name==='data-state')return runtime.phase==='idle'?'ready':'cooldown';return null;}};
  const airstrike={isVisible:async()=>visible,isEnabled:async()=>request({x:500,y:180}).ok,async click(){selected=true;clicks.push('select');},evaluateAll:async read=>read([button])};
  const page={locator(selector){
    if(selector==='.game-shell canvas')return{evaluate:async read=>canvasMissing?null:read(canvas)};
    if(selector==='button.manual-ability-ready')return{evaluateAll:async read=>read(anchors.map(p=>({getAttribute:name=>String(name.endsWith('-x')?p.x:p.y)})))};
    if(selector==='.game-shell')return{innerText:async()=>'西新防衛線\n耐久\n650 / 680'};
    throw Error('Unexpected normal UI read '+selector);
  },evaluate:async read=>{assert.equal(typeof read,'function');return clear;},mouse:{async click(x,y){
    assert.equal(selected,true);clicks.push('aim');if(ignoreAim)return;
    const result=request({x,y});assert.equal(result.ok,true,'production placement and resource rules authorize every request');runtime=result.runtime;gauge=result.supportGauge;
  }},async waitForFunction(read,arg,options){assert.equal(options.timeout,2_000);if(!read())throw Error('native request not acknowledged');}};
  const run=vm.runInNewContext('(async()=>{let airstrikeRequested=false;'+blocks[0].getText(tree)+';return airstrikeRequested;})()',{
    page,airstrike,normalCampaignAirstrikeTarget,record,start:0,Date:{now:()=>seconds*1000},
    document:{querySelector:()=>button,elementFromPoint:()=>clear?canvas:null},
  });
  const requested=await run;return{record,clicks,gauge,runtime,requested};
}

test('the actual normal route requests and acknowledges V100 air support before a boss using the real85cost and50s cooldown',async()=>{
  const result=await fire();assert.deepEqual(result.clicks,['select','aim']);assert.equal(result.requested,true);
  assert.equal(result.gauge,15);assert.equal(result.runtime.phase,'radio');assert.equal(result.runtime.cooldownRemaining,50);
  assert.equal(result.record.inputs[0].action,'airstrike');assert.equal(result.record.inputs[0].acknowledgment.disabled,'true');
});

test('disabled, cooling, obscured, missing-transform and opening states never consume support or fabricate an airstrike',async()=>{
  for(const options of [{seconds:24},{gauge:84},{visible:false},{clear:false},{cooldown:1},{canvasMissing:true}]) {
    const result=await fire(options);assert.deepEqual(result.clicks,[]);assert.equal(result.record.inputs.length,0);assert.equal(result.requested,false);
  }
  await assert.rejects(()=>fire({ignoreAim:true}),/native request not acknowledged/u);
});
