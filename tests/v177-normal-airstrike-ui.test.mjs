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
const deployBlocks=[];
function visit(node){if(ts.isIfStatement(node)&&node.expression.getText(tree).includes('airstrike.isEnabled'))blocks.push(node);if(ts.isIfStatement(node)&&node.expression.getText(tree).includes('Date.now()-lastAction>500'))deployBlocks.push(node);ts.forEachChild(node,visit);}
visit(battle);assert.equal(blocks.length,1,'exercise the actual hosted-only normal input block without importing a browser');
assert.equal(deployBlocks.length,1);

test('normal deployment preserves the formation prepared through the UI without a hidden role sort',()=>{
  const kinds=['medic','babayaga','scout','kumaverson','brawler'];
  const ordered=normalCampaignDeployOrder(kinds);
  // The D28 originals lost with medic delayed to the third card. The earlier
  // 2e583 WebKit control won with this same earned roster and the UI order.
  // That control is diagnostic evidence, not fresh-candidate acceptance.
  assert.deepEqual(ordered,['medic','babayaga','scout','kumaverson','brawler']);
  assert.deepEqual([...ordered].sort(),[...kinds].sort());
  assert.deepEqual(kinds,['medic','babayaga','scout','kumaverson','brawler']);
  assert.notEqual(ordered,kinds,'the observer must not expose a mutable formation alias');
  assert.deepEqual(normalCampaignDeployOrder(['future-unit','ranger']),['future-unit','ranger']);
  assert.throws(()=>normalCampaignDeployOrder(['scout','scout']));
});

test('every selected unit role retains its UI slot, including later and unfamiliar units',()=>{
  for(const kinds of [['scout','kumaverson','medic'],['scout','guardian','medic'],['scout','miyamoto-musashi','medic'],['zakimiya','scout','medic'],['medic','scout'],[]]) {
    assert.deepEqual(normalCampaignDeployOrder(kinds),kinds);
  }
});

test('the actual normal deployment caller taps the first selected card from the recorded Stage 3 roster',async()=>{
  const kinds=['medic','babayaga','scout','kumaverson','brawler'],clicks=[],record={inputs:[]};
  const cards={evaluateAll:async read=>read(kinds.map(kind=>({getAttribute:()=>kind}))),nth:index=>({isEnabled:async()=>true,getAttribute:async()=>kinds[index],click:async()=>clicks.push(kinds[index])})};
  const result=await vm.runInNewContext('(async()=>{let cursor=0,lastAction=0,lastEmergency=0;'+deployBlocks[0].getText(tree)+';return {cursor,lastAction,lastEmergency};})()',{
    cards,count:kinds.length,normalCampaignDeployOrder,record,Date:{now:()=>2_000},start:0,deploymentCount:{active:0,limit:7},
    page:{locator:()=>{throw Error('An enabled selected card needs no emergency replacement');}},
  });
  assert.deepEqual(clicks,['medic']);assert.equal(record.inputs[0].kind,'medic');
  assert.equal(result.cursor,1);assert.equal(result.lastAction,2_000);assert.equal(result.lastEmergency,0);
});

test('the actual caller waits for an unavailable selected card without silently advancing the formation',async()=>{
  const kinds=['medic','babayaga','scout','kumaverson','brawler'],clicks=[],record={inputs:[]};
  const cards={evaluateAll:async read=>read(kinds.map(kind=>({getAttribute:()=>kind}))),nth:index=>({isEnabled:async()=>index!==0,getAttribute:async()=>kinds[index],click:async()=>clicks.push(kinds[index])})};
  const result=await vm.runInNewContext('(async()=>{let cursor=0,lastAction=0,lastEmergency=0;'+deployBlocks[0].getText(tree)+';return {cursor,lastAction,lastEmergency};})()',{
    cards,count:kinds.length,normalCampaignDeployOrder,record,Date:{now:()=>20_000},start:0,deploymentCount:{active:1,limit:7},
    page:{locator:()=>{throw Error('The occupied line does not authorize an emergency replacement');}},
  });
  assert.deepEqual(clicks,[]);assert.equal(record.inputs.length,0);
  assert.equal(result.cursor,0);assert.equal(result.lastAction,0);assert.equal(result.lastEmergency,0);
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
