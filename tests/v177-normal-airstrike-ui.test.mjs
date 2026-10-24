import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import ts from 'typescript';
import {normalCampaignDeployOrder,normalCampaignCanSpendVehicleGauge} from '../scripts/v100-normal-play-contract.mjs';
import {observeVisibleBattleHealthBars,visibleAirstrikeTarget} from '../scripts/v100-normal-visible-aim.mjs';
import {AIRSTRIKE_DEF,createEmergencySupportRuntime,requestAirstrike,createCrawlerAbilityRuntime,requestCrawlerBarrage} from '../app/gameRules.js';

const source=fs.readFileSync(new URL('../scripts/v100-normal-campaign-playthrough.mjs',import.meta.url),'utf8');
const tree=ts.createSourceFile('normal-campaign.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const battle=tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name.text==='battle');
const blocks=[];
const deployBlocks=[];
const barrageBlocks=[];
function visit(node){if(ts.isIfStatement(node)&&node.expression.getText(tree).startsWith('!airstrikeRequested&&'))barrageBlocks.push(node);if(ts.isIfStatement(node)&&node.expression.getText(tree).startsWith('airVisible&&'))blocks.push(node);if(ts.isIfStatement(node)&&node.expression.getText(tree).includes('Date.now()-lastAction>500'))deployBlocks.push(node);ts.forEachChild(node,visit);}
visit(battle);assert.equal(blocks.length,1,'exercise the actual hosted-only normal input block without importing a browser');
assert.equal(deployBlocks.length,1);assert.equal(barrageBlocks.length,1);

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
  const result=await vm.runInNewContext('(async()=>{let cursor=0,lastAction=0,lastEmergency=0,lastEmergencyCursor=-1;'+deployBlocks[0].getText(tree)+';return {cursor,lastAction,lastEmergency};})()',{
    cards,count:kinds.length,normalCampaignDeployOrder,record,Date:{now:()=>2_000},start:0,deploymentCount:{active:0,limit:7},
    page:{locator:()=>{throw Error('An enabled selected card needs no emergency replacement');}},
  });
  assert.deepEqual(clicks,['medic']);assert.equal(record.inputs[0].kind,'medic');
  assert.equal(result.cursor,1);assert.equal(result.lastAction,2_000);assert.equal(result.lastEmergency,0);
});

test('the actual caller waits for an unavailable selected card without silently advancing the formation',async()=>{
  const kinds=['medic','babayaga','scout','kumaverson','brawler'],clicks=[],record={inputs:[]};
  const cards={evaluateAll:async read=>read(kinds.map(kind=>({getAttribute:()=>kind}))),nth:index=>({isEnabled:async()=>index!==0,getAttribute:async()=>kinds[index],click:async()=>clicks.push(kinds[index])})};
  const result=await vm.runInNewContext('(async()=>{let cursor=0,lastAction=0,lastEmergency=0,lastEmergencyCursor=-1;'+deployBlocks[0].getText(tree)+';return {cursor,lastAction,lastEmergency};})()',{
    cards,count:kinds.length,normalCampaignDeployOrder,record,Date:{now:()=>20_000},start:0,deploymentCount:{active:1,limit:7},
    page:{locator:()=>{throw Error('The occupied line does not authorize an emergency replacement');}},
  });
  assert.deepEqual(clicks,[]);assert.equal(record.inputs.length,0);
  assert.equal(result.cursor,0);assert.equal(result.lastAction,0);assert.equal(result.lastEmergency,0);
});

test('visible enemy bars and real world transforms keep the aim inside production placement bounds',()=>{
  for(const width of [1280,844,667])for(const worldOffsetX of [0,-40,30]) {
    const canvas={x:11,y:23,width,height:340,worldScale:width/960,worldOffsetX,worldOffsetY:-30};
    for(const x of [0,width*.6,width-1]) {
      const frame={status:'read',bars:[{kind:'enemy',x,y:120},{kind:'enemy',x:x+8,y:121}]};
      const aim=visibleAirstrikeTarget(canvas,frame);
      assert.ok(aim.point.x>canvas.x&&aim.point.x<canvas.x+width);
      assert.ok(aim.point.y>canvas.y&&aim.point.y<canvas.y+canvas.height);
      assert.ok(aim.worldPoint.x>=AIRSTRIKE_DEF.minX&&aim.worldPoint.x<=AIRSTRIKE_DEF.maxX);
      const request=requestAirstrike({running:true,paused:false,over:false,supportGauge:100,lane:1,...aim.worldPoint,runtime:createEmergencySupportRuntime(true)});
      assert.equal(request.ok,true);assert.equal(request.supportGauge,15);assert.equal(request.runtime.cooldownRemaining,50);
    }
  }
  const frame={status:'read',bars:[{kind:'enemy',x:500,y:180}]};
  for(const canvas of [null,{x:0,y:0,width:844,height:340},{x:0,y:0,width:844,height:340,worldScale:0,worldOffsetX:0,worldOffsetY:0}])assert.equal(visibleAirstrikeTarget(canvas,frame),null);
});

async function fire({seconds=122,gauge=100,visible=true,clear=true,cooldown=0,canvasMissing=false,ignoreAim=false,lastReadSeconds=-Infinity,previousAirReady=false,priorVisibleEnemy=false,includeVehicle=false,bossVisible=false,frameStatus='read',bars=[{kind:'enemy',x:500,y:120},{kind:'enemy',x:510,y:124}],inputs=[]}={}) {
  const box={x:0,y:0,width:960,height:540,worldScale:1,worldOffsetX:0,worldOffsetY:0};
  const canvas={dataset:{worldScale:'1',worldOffsetX:'0',worldOffsetY:'0'},getBoundingClientRect:()=>box};
  const frame={status:frameStatus,canvas:box,png:Buffer.from('native-aim-png'),pngSha256:'native-image-hash',bars};
  const record={inputs:[...inputs]},clicks=[],captures=[];let observations=0;
  let runtime={...createEmergencySupportRuntime(true),cooldownRemaining:cooldown},selected=false;
  let vehicleRuntime=createCrawlerAbilityRuntime(1,true);
  const request=point=>requestAirstrike({running:true,paused:false,over:false,supportGauge:gauge,lane:1,x:point.x,y:point.y,runtime});
  const vehicleRequest=()=>requestCrawlerBarrage({running:true,paused:false,over:false,runtime:vehicleRuntime,supportGauge:gauge});
  const button={getAttribute(name){if(name==='aria-disabled')return runtime.phase==='idle'&&gauge>=85&&runtime.cooldownRemaining===0?'false':'true';if(name==='data-state')return runtime.phase==='idle'?'ready':'cooldown';return null;}};
  const airstrike={isVisible:async()=>visible,isEnabled:async()=>request({x:500,y:180}).ok,async click(){selected=true;clicks.push('select');},evaluateAll:async read=>read([button])};
  const barrage={isVisible:async()=>true,isEnabled:async()=>vehicleRequest().ok,async click(){const result=vehicleRequest();assert.equal(result.ok,true,'production70cost and reload rules authorize every vehicle input');gauge=result.supportGauge;vehicleRuntime=result.runtime;clicks.push('barrage');}};
  const page={locator(selector){
    if(selector==='.game-shell canvas')return{nativeCanvas:true};
    if(selector==='.boss-hud')return{isVisible:async()=>bossVisible};
    if(selector==='.game-shell')return{innerText:async()=>'西新防衛線\n耐久\n650 / 680'};
    throw Error('Unexpected normal UI read '+selector);
  },evaluate:async read=>{assert.equal(typeof read,'function');return clear;},mouse:{async click(x,y){
    assert.equal(selected,true);clicks.push('aim');if(ignoreAim)return;
    const result=request({x,y});assert.equal(result.ok,true,'production placement and resource rules authorize every request');runtime=result.runtime;gauge=result.supportGauge;
  }},async waitForFunction(read,arg,options){assert.equal(options.timeout,2_000);if(!read())throw Error('native request not acknowledged');}};
  const run=vm.runInNewContext('(async()=>{let airstrikeRequested=false,visibleAirTarget=null,lastVisibleAirTarget=null,visibleEnemyTarget=initialReadAt>=now-2_000&&initialVisibleEnemy,lastVisibleEnemyTarget=initialVisibleEnemy,lastAimReadAt=initialReadAt,lastAirReady=initialAirReady;'+blocks[0].getText(tree)+';'+(includeVehicle?barrageBlocks[0].getText(tree):'')+';return {requested:airstrikeRequested,visibleEnemyTarget};})()',{
    page,airstrike,barrage,barrageReady:vehicleRequest().ok,bossVisible,observeVisibleBattleHealthBars:async locator=>{assert.equal(typeof observeVisibleBattleHealthBars,'function');assert.equal(locator.nativeCanvas,true);observations++;return canvasMissing?{status:'unavailable',bars:[]}:frame;},visibleAirstrikeTarget,normalCampaignCanSpendVehicleGauge,
    initialReadAt:lastReadSeconds*1000,initialAirReady:previousAirReady,initialVisibleEnemy:priorVisibleEnemy,now:seconds*1000,stage:{number:3,missionType:'boss'},path,out:'/evidence',writeFile:async(file,bytes)=>captures.push({file,bytes}),airVisible:seconds>12&&visible,airReady:seconds>12&&visible&&request({x:500,y:180}).ok,record,start:0,Date:{now:()=>seconds*1000},
    document:{querySelector:()=>button,elementFromPoint:()=>clear?canvas:null},
  });
  const result=await run;return{record,clicks,captures,gauge,runtime,vehicleRuntime,...result,observations};
}

test('the actual normal route requests and acknowledges V100 air support before a boss using the real85cost and50s cooldown',async()=>{
  const result=await fire();assert.deepEqual(result.clicks,['select','aim']);assert.equal(result.requested,true);
  assert.equal(result.gauge,15);assert.equal(result.runtime.phase,'radio');assert.equal(result.runtime.cooldownRemaining,50);
  assert.equal(result.captures.length,1);assert.equal(result.captures[0].file,path.join('/evidence','s3-air-1-aim.png'));assert.ok(result.captures[0].bytes.equals(Buffer.from('native-aim-png')));
  assert.equal(result.record.inputs[0].aimScreenshotSha256,'native-image-hash');
  assert.equal(result.record.inputs[0].action,'airstrike');assert.equal(result.record.inputs[0].acknowledgment.disabled,'true');
});

test('disabled, cooling, obscured, missing-transform and opening states never consume support or fabricate an airstrike',async()=>{
  for(const options of [{seconds:12},{gauge:84},{visible:false},{clear:false},{cooldown:1},{canvasMissing:true}]) {
    const result=await fire(options);assert.deepEqual(result.clicks,[]);assert.equal(result.record.inputs.length,0);assert.equal(result.requested,false);
  }
  await assert.rejects(()=>fire({ignoreAim:true}),/native request not acknowledged/u);
});

test('the actual aircraft caller does not scan or fire again inside the two-second observation interval',async()=>{
 const result=await fire({seconds:122,lastReadSeconds:121.9,previousAirReady:true});
 assert.equal(result.observations,0);assert.deepEqual(result.clicks,[]);assert.equal(result.captures.length,0);
});

test('aircraft becoming ready forces a fresh image and never shoots from a funding observation alone',async()=>{
 const result=await fire({seconds:122,lastReadSeconds:121.9,previousAirReady:false});
 assert.equal(result.observations,1);assert.deepEqual(result.clicks,['select','aim']);assert.equal(result.captures.length,1);
 assert.equal(result.record.inputs[0].aimScreenshot,'s3-air-1-aim.png');assert.equal(result.record.inputs[0].acknowledgment.disabled,'true');
});

test('the actual empty-line caller funds its pending frontliner instead of buying a scout every12s',async()=>{
  const kinds=['kumaverson','brawler','scout'],clicks=[],record={inputs:[]};
  let selectedReady=false,scoutReady=false;
  const cards={evaluateAll:async read=>read(kinds.map(kind=>({getAttribute:()=>kind}))),nth:index=>({
    isEnabled:async()=>selectedReady,getAttribute:async()=>kinds[index],click:async()=>clicks.push(kinds[index]),
  })};
  const context={cards,count:kinds.length,normalCampaignDeployOrder,record,cursor:0,lastAction:0,lastEmergency:0,lastEmergencyCursor:-1,start:0,
    deploymentCount:{active:0,limit:7},now:20_000,Date:{now:()=>context.now},
    page:{locator:selector=>{if(selector==='.crawler-health.critical')return {isVisible:async()=>false};assert.equal(selector,'button.unit-card[data-kind="scout"]');return {
      count:async()=>1,isEnabled:async()=>scoutReady,click:async()=>clicks.push('scout'),
    };}},
  };
  vm.createContext(context);
  const step=()=>vm.runInContext('(async()=>{'+deployBlocks[0].getText(tree)+'})()',context);
  await step();assert.equal(context.lastEmergencyCursor,-1,'a disabled escort must not consume this pending role allowance');
  scoutReady=true;context.now=21_000;await step();
  for(const seconds of [35,49]){context.now=seconds*1000;await step();}
  assert.deepEqual(clicks,['scout']);assert.equal(context.cursor,0);assert.equal(context.lastEmergencyCursor,0);
  assert.equal(record.inputs[0].pendingKind,'kumaverson');assert.equal(record.inputs[0].deploymentCursor,0);
  selectedReady=true;context.now=50_000;await step();assert.equal(context.cursor,1);
  selectedReady=false;context.now=65_000;await step();context.now=80_000;await step();
  assert.deepEqual(clicks,['scout','kumaverson','scout']);assert.equal(context.cursor,1);
  assert.equal(record.inputs[2].pendingKind,'brawler');assert.equal(record.inputs[2].deploymentCursor,1);
});

const firstAircraftAck={action:'airstrike',acknowledgment:{disabled:'true'}};
test('a visibly critical empty line can deploy a ready escort again while its unaffordable role stays pending',async()=>{
  const kinds=['babayaga','scout','medic','kumaverson','brawler'],clicks=[],record={inputs:[]};
  let critical=true,scoutReady=true;
  const cards={evaluateAll:async read=>read(kinds.map(kind=>({getAttribute:()=>kind}))),nth:index=>({
    isEnabled:async()=>false,getAttribute:async()=>kinds[index],click:async()=>{throw Error('The pending role is unaffordable');},
  })};
  const context={cards,count:kinds.length,normalCampaignDeployOrder,record,cursor:13,lastAction:200_451,
    lastEmergency:198_938,lastEmergencyCursor:13,start:0,deploymentCount:{active:0,limit:7},now:213_000,
    Date:{now:()=>context.now},page:{locator:selector=>{
      if(selector==='.crawler-health.critical')return {isVisible:async()=>critical};
      assert.equal(selector,'button.unit-card[data-kind="scout"]');
      return {count:async()=>1,isEnabled:async()=>scoutReady,click:async()=>clicks.push('scout')};
    }},
  };
  vm.createContext(context);
  const step=()=>vm.runInContext('(async()=>{'+deployBlocks[0].getText(tree)+'})()',context);
  await step();assert.deepEqual(clicks,['scout']);
  assert.equal(context.cursor,13);assert.equal(record.inputs[0].pendingKind,'kumaverson');
  assert.equal(record.inputs[0].criticalEmptyLine,true);
  context.now+=300;await step();assert.equal(clicks.length,1,'retain the actual500ms input interval');
  scoutReady=false;context.now+=1_000;await step();assert.equal(clicks.length,1,'never bypass the real disabled card');
  scoutReady=true;context.now+=4_000;await step();assert.equal(clicks.length,2);
  critical=false;context.now+=20_000;await step();assert.equal(clicks.length,2,'healthy vehicles still save for the pending role');
  assert.equal(context.cursor,13);assert.equal(record.inputs.length,2);
});
test('one visible enemy preserves the real85cost first aircraft even before two bars fit its firing radius',async()=>{
  const result=await fire({includeVehicle:true,bars:[{kind:'enemy',x:500,y:120}]});
  assert.equal(result.observations,1);assert.equal(result.visibleEnemyTarget,true);
  assert.deepEqual(result.clicks,[]);assert.equal(result.gauge,100);assert.equal(result.record.inputs.length,0);
});

test('after an actual aircraft acknowledgment, ready vehicle fire refreshes the image even during aircraft cooldown',async()=>{
  const result=await fire({includeVehicle:true,cooldown:50,inputs:[firstAircraftAck],bars:[{kind:'enemy',x:500,y:120}]});
  assert.equal(result.observations,1);assert.deepEqual(result.clicks,['barrage']);
  assert.equal(result.gauge,30);assert.equal(result.vehicleRuntime.phase,'deploying');
  assert.deepEqual(result.record.inputs.map(input=>input.action),['airstrike','barrage']);
});

test('an empty, friendly-only, stale or unavailable observation never spends70 even with a visible boss HUD',async()=>{
  for(const options of [{bars:[]},{bars:[{kind:'human',x:500,y:120}]},{frameStatus:'stale'},{canvasMissing:true}]) {
    const result=await fire({includeVehicle:true,cooldown:50,inputs:[firstAircraftAck],bossVisible:true,...options});
    assert.equal(result.observations,1);assert.equal(result.visibleEnemyTarget,false);
    assert.deepEqual(result.clicks,[]);assert.equal(result.gauge,100);assert.equal(result.record.inputs.length,1);
  }
});

test('funding observations expire after two seconds and never become a cached aircraft shot',async()=>{
  const recent=await fire({includeVehicle:true,cooldown:50,inputs:[firstAircraftAck],lastReadSeconds:121.9,previousAirReady:false,priorVisibleEnemy:true});
  assert.equal(recent.observations,0);assert.deepEqual(recent.clicks,['barrage']);assert.equal(recent.captures.length,0);
  const stale=await fire({includeVehicle:true,cooldown:50,inputs:[firstAircraftAck],lastReadSeconds:119,priorVisibleEnemy:true,bars:[]});
  assert.equal(stale.observations,1);assert.deepEqual(stale.clicks,[]);assert.equal(stale.gauge,100);
});
