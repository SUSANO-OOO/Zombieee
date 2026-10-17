import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import sharp from 'sharp';
import ts from 'typescript';
import {V100_UNITS} from '../app/v100Registry.js';
import {readVisibleBattleHealthBars,visibleAirstrikeTarget,observeVisibleBattleHealthBars} from '../scripts/v100-normal-visible-aim.mjs';
import {normalCampaignCanSpendVehicleGauge} from '../scripts/v100-normal-play-contract.mjs';

const fixtures=new URL('./fixtures/v177-normal-visible-aim/',import.meta.url);
const provenance=JSON.parse(fs.readFileSync(new URL('provenance.json',fixtures)));
const projection={x:0,y:0,width:844,height:390,worldScale:844/960,worldOffsetX:0,worldOffsetY:(390-540*844/960)/2};
async function nativeFrame(file,{dpr=1,occluded=false,geometryChanged=false,screenshotFailure=false}={}) {
  const original=fs.readFileSync(new URL(file,fixtures));
  const pin=provenance.records.find(record=>record.file===file);
  assert.equal(original.length,pin.bytes);
  assert.equal(crypto.createHash('sha256').update(original).digest('hex'),pin.sha256);
  const pipeline=sharp(original);
  if(dpr!==1)pipeline.resize(844*dpr,390*dpr,{kernel:'nearest'});
  const png=dpr===1?original:await pipeline.png().toBuffer();
  let geometryReads=0,screenshotCalls=0,contextReads=0;
  const canvas={tagName:'CANVAS',
    dataset:Object.fromEntries(Object.entries(projection).filter(([key])=>key.startsWith('world')).map(([key,value])=>[key,String(value)])),
    getBoundingClientRect:()=>({...projection,x:projection.x+(geometryChanged&&++geometryReads>1?1:0)}),
    getContext(){contextReads++;throw Error('A live canvas context is forbidden');}};
  const document={elementFromPoint:(x,y)=>y>70&&y<307&&!(occluded&&x>600&&y<180)?canvas:null};
  const locator={evaluate:async(fn,args)=>vm.runInNewContext('('+fn.toString()+')',{document})(canvas,args),
    screenshot:async options=>{screenshotCalls++;assert.deepEqual(options,{type:'png',animations:'allow',scale:'css',timeout:2_000});
      if(screenshotFailure)throw Error('native screenshot failed');return png;}};
  try {
    const frame=await observeVisibleBattleHealthBars(locator);
    assert.equal(contextReads,0);assert.equal(screenshotCalls,1);
    if(frame.status==='read')assert.equal(frame.pngSha256,crypto.createHash('sha256').update(png).digest('hex'));
    return frame;
  } finally {assert.equal(contextReads,0);assert.equal(screenshotCalls,1);}
}

test('the original stage3 frame aims at both visible enemy bars, using only painted pixels',async()=>{
  const frame=await nativeFrame('s3-31s.png'),aim=visibleAirstrikeTarget(frame.canvas,frame);
  assert.equal(frame.bars.filter(bar=>bar.kind==='human').length,3);
  assert.equal(aim.visibleEnemyBars,2);assert.equal(aim.expectedVisibleBarsInRadius,2);
  assert.ok(aim.point.x>600&&aim.point.x<650);assert.ok(aim.point.y>190&&aim.point.y<230);
  assert.ok(aim.worldPoint.x>680&&aim.worldPoint.x<735);
  assert.ok(aim.worldPoint.y>270&&aim.worldPoint.y<300);
  assert.ok(aim.worldPoint.x>326.399876+300,'do not resurrect the fixed empty-air target from the failed run');
});

test('empty, human-only and occluded original frames have no aircraft target',async()=>{
  for(const file of ['s3-1s.png','s3-61s.png']) {
    const frame=await nativeFrame(file);assert.equal(visibleAirstrikeTarget(frame.canvas,frame),null);
  }
  const frame=await nativeFrame('s3-31s.png',{occluded:true});
  assert.equal(frame.bars.filter(bar=>bar.kind==='enemy').length,0);
  assert.equal(visibleAirstrikeTarget(frame.canvas,frame),null);
});

test('native bitmap scale changes preserve the observed CSS target',async()=>{
  const normal=await nativeFrame('s3-31s.png'),retina=await nativeFrame('s3-31s.png',{dpr:2});
  const a=visibleAirstrikeTarget(normal.canvas,normal),b=visibleAirstrikeTarget(retina.canvas,retina);
  assert.equal(b.expectedVisibleBarsInRadius,2);
  assert.ok(Math.abs(a.point.x-b.point.x)<2);assert.ok(Math.abs(a.point.y-b.point.y)<2);
});

test('unreadable pixels and incomplete transforms fail closed without inventing a target',()=>{
  let contextReads=0;const frame=readVisibleBattleHealthBars({getContext(){contextReads++;throw Error('unreadable');}});
  assert.equal(frame.status,'invalid');assert.equal(contextReads,0);assert.equal(visibleAirstrikeTarget(projection,frame),null);
  for(const input of [undefined,null,{}, {data:new Uint8Array(4),width:2,height:2}])assert.equal(readVisibleBattleHealthBars(input).status,'invalid');
  assert.equal(visibleAirstrikeTarget({...projection,worldOffsetY:NaN},{status:'read',bars:[{kind:'enemy',x:600,y:100}]}),null);
});

test('the actual ordinary-UI formation keeps the measured starters and its earned healer behind ranged/scout',()=>{
  const source=fs.readFileSync(new URL('../scripts/v100-normal-campaign-playthrough.mjs',import.meta.url),'utf8');
  const tree=ts.createSourceFile('campaign.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const declaration=tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name.text==='plannedFormation');
  const plan=vm.runInNewContext('('+declaration.getText(tree)+')');
  const owned=[...provenance.openingOwnedIds],formation=Array.from(plan({ownedUnitIds:owned}));
  assert.deepEqual(formation.slice(0,3),['unit-babayaga','unit-hachi','unit-nao']);
  assert.deepEqual(formation.slice(3),['unit-kumaverson','unit-paisen']);
  const evidence=JSON.parse(fs.readFileSync(new URL('formation-native-provenance.json',fixtures)));
  const initial=Array.from(plan({ownedUnitIds:evidence.stage1OwnedIds}));
  assert.deepEqual(initial,evidence.measuredWinningStage1Ids);assert.equal(formation.length,5);
  assert.deepEqual([...formation].sort(),[...owned].sort());assert.deepEqual(owned,provenance.openingOwnedIds);
  assert.ok(plan({ownedUnitIds:V100_UNITS.map(unit=>unit.id)}).length<=7);
});

test('an observed target preserves first-aircraft funding; absent targets release legal defense',()=>{
  assert.equal(normalCampaignCanSpendVehicleGauge([],true),false);
  assert.equal(normalCampaignCanSpendVehicleGauge([],false),true);
  assert.equal(normalCampaignCanSpendVehicleGauge([{action:'airstrike',acknowledgment:{disabled:'false'}}],true),false);
  assert.equal(normalCampaignCanSpendVehicleGauge([{action:'airstrike',acknowledgment:{disabled:'true'}}],true),true);
});

test('a changed native projection discards the observed frame before any aim',async()=>{
  const frame=await nativeFrame('s3-31s.png',{geometryChanged:true});
  assert.equal(frame.status,'stale');assert.equal(visibleAirstrikeTarget(projection,frame),null);
});

test('a failed native screenshot propagates once without a context read or retry',async()=>{
  await assert.rejects(()=>nativeFrame('s3-31s.png',{screenshotFailure:true}),/native screenshot failed/);
});
