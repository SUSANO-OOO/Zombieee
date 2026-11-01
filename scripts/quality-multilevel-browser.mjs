import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_UNITS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {v100UnitPresentation,formatV100Number} from '../app/v100UnitPresentation.js';
import {seedV100BrowserSaveOnce,enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';

const engine=process.env.QUALITY_LEVEL_ENGINE??'webkit',before=process.env.QUALITY_LEVEL_BEFORE==='1';
const out=path.resolve(process.env.QUALITY_LEVEL_OUT),baseUrl=process.env.V100_CAMPAIGN_QA_BASE_URL;
await mkdir(out,{recursive:true});
const report={engine,before,url:baseUrl,build:await productionBuildIdentity(process.env.QUALITY_LEVEL_BUILD_ROOT),
 scope:'Prepared isolated stage-14 save, normal title/personnel controls and real persistence. Not earned economy balance, physical touch or human acceptance.',cases:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true});
const specs=before?[{width:1280,height:720,scenario:'upgrade'}]:[
 {width:1280,height:720,scenario:'upgrade'},{width:844,height:340,scenario:'upgrade'},
 {width:844,height:390,scenario:'upgrade'},{width:844,height:340,scenario:'failed-save'},
 {width:844,height:340,scenario:'budget'}];
const unitId='unit-zakimiya';
try{for(const {scenario,...viewport} of specs){
 const label=`${viewport.width}x${viewport.height}-${scenario}`,row={label,checks:[]};report.cases.push(row);
 const seed=normalizeV100Save({...createDefaultV100Save({settings:{bgmEnabled:false,sfxEnabled:false}}),
  campaignStarted:true,caps:scenario==='budget'?300:1800,levelCap:15,completedStageIds:V100_STAGE_IDS.slice(0,14),availableStageIds:V100_STAGE_IDS.slice(0,15),
  ownedUnitIds:V100_UNITS.map(u=>u.id),registeredUnitIds:V100_UNITS.map(u=>u.id),
  flowState:{phase:'map',stageId:null,stageNumber:null,eventId:null,destination:'map',nodeIndex:0,firstClear:false,finalized:true}});
 const context=await browser.newContext({viewport,hasTouch:true,serviceWorkers:'block',recordVideo:{dir:path.join(out,label),size:viewport}});
 const videoStartedAt=Date.now(),page=await context.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',e=>report.errors.push({label,error:String(e)}));
 const ready=()=>page.waitForFunction(()=>document.querySelector('#v100-campaign')?.getAttribute('aria-busy')==='false');
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
 const focus=page.locator('.v100-unit-focus'),target=focus.getByLabel('育成するレベル',{exact:true});
 const dismissOfflineNotice=async()=>{const notice=page.locator('.pwa-notice').filter({hasText:'オフライン用の設定に失敗しました。'});if(await notice.isVisible())await notice.getByRole('button',{name:'閉じる',exact:true}).click();};
 const shot=async suffix=>{await dismissOfflineNotice();await page.screenshot({path:path.join(out,label+'-'+suffix+'.png')});};
 const enter=async()=>{await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);await ready();};
 const selectUnit=async id=>{
  const back=focus.getByRole('button',{name:'ユニット一覧へ',exact:true});
  if(await back.isVisible())await back.click();
  await page.locator(`[data-personnel-unit="${id}"]`).click();
  await page.waitForFunction(id=>document.querySelector('.v100-unit-focus')?.dataset.unitId===id,id);
 };
 const visibleControl=async locator=>{
  await dismissOfflineNotice();
  await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox();
  assert.ok(box&&box.height>=44&&box.x>=0&&box.x+box.width<=viewport.width+1&&box.y>=0&&box.y+box.height<=viewport.height+1,'scrolled control fits and has a 44px target');
  assert.ok(await locator.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'control can receive pointer');
 };
 try{
  await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));await page.goto(baseUrl);await enter();
  await page.locator('.v100-command-tabs').getByRole('button',{name:'ユニット',exact:true}).click();await selectUnit(unitId);await ready();
  const initial=await saved();row.initial={level:initial.unitLevels[unitId],caps:initial.caps,revision:initial.revision};
  row.personnelAtSeconds=(Date.now()-videoStartedAt)/1000;
  const quote=v100UnitPresentation(initial,unitId,{targetLevel:10});row.quote={level:quote.nextLevel,cost:quote.upgradeCost,hp:quote.next.hp,damage:quote.next.damage};
  assert.equal(quote.upgradeCost,590);
  if(before){
   assert.equal(await target.count(),0);await shot('before');
   for(let level=2;level<=10;level++){
    await focus.getByRole('button',{name:new RegExp(`^Lv\\.${level}へ強化 /`)}).click();
    await page.waitForFunction(({id,level})=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')).unitLevels[id]===level,{id:unitId,level});await ready();
   }
   row.purchaseClicks=9;row.targetSelections=0;
  }else{
   await visibleControl(target);assert.equal(await target.inputValue(),'2');
   assert.deepEqual(await target.locator('option').evaluateAll(options=>options.map(o=>Number(o.value))),Array.from({length:14},(_,i)=>i+2));
   await target.selectOption('10');assert.deepEqual(await saved(),initial,'quote must not write save');
   assert.match(await focus.locator('.v100-unit-level').innerText(),/Lv\.1 → 10/);
   assert.match(await focus.locator('.v100-unit-transaction').innerText(),/必要 590/);
   row.displayedStats=await focus.locator('.v100-personnel-stats').innerText();
   const statPairs=await focus.locator('.v100-unit-stat').evaluateAll(els=>els.map(el=>({label:el.querySelector('span').textContent,current:el.querySelector('strong').textContent,next:el.querySelector('small')?.textContent??null})));
   for(const [label,current,next] of [['HP',String(quote.current.hp),String(quote.next.hp)],['ダメージ軽減',(quote.current.defense*100).toFixed(2)+'%',(quote.next.defense*100).toFixed(2)+'%'],['近接ダメージ',formatV100Number(quote.current.damage),formatV100Number(quote.next.damage)]]){
    assert.deepEqual(statPairs.find(s=>s.label===label),{label,current,next:'→ '+next});
   }
   for(const stat of await focus.locator('.v100-personnel-stats > div').all()){
    await stat.scrollIntoViewIfNeeded();
    assert.ok(await stat.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'a purchase panel cannot cover ability values');
   }
   await shot('stats');await visibleControl(target);
   await shot('selected');
   if(scenario==='budget'){
    const disabled=focus.getByRole('button',{name:'あと 290 CAPS必要',exact:true});assert.ok(await disabled.isDisabled());
    await target.selectOption('2');assert.ok(await focus.getByRole('button',{name:'Lv.2へ強化 / 30 CAPS',exact:true}).isEnabled());
    assert.deepEqual(await saved(),initial);row.checks.push('total-price-blocks-purchase','affordable-single-level-remains-available');row.status='passed';continue;
   }
   if(scenario==='upgrade'){
    await selectUnit('unit-nao');assert.equal(await target.inputValue(),'2','target cannot leak to another unit');
    await selectUnit(unitId);assert.equal(await target.inputValue(),'10');assert.deepEqual(await saved(),initial);
    row.checks.push('unit-switch-target-isolation');
   }
   const buy=focus.getByRole('button',{name:'Lv.10へ強化 / 590 CAPS',exact:true});await visibleControl(buy);await shot('ready');
   if(scenario==='failed-save'){
    await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;window.__qualityBlockedWrites=0;IDBObjectStore.prototype.put=function(...args){if(this.name==='saves'){window.__qualityBlockedWrites++;throw new DOMException('QA injected write failure','QuotaExceededError');}return original.apply(this,args);};window.__qualityRestoreWrites=()=>{IDBObjectStore.prototype.put=original;};});
    await buy.click();await page.waitForFunction(()=>window.__qualityBlockedWrites>0);await ready();
    assert.deepEqual(await saved(),initial,'failed batch must not spend or partially upgrade');
    assert.equal(await target.inputValue(),'10');assert.match(await page.locator('#v100-campaign').innerText(),/セーブを書き込めませんでした/);await shot('save-failed');
    await page.evaluate(()=>window.__qualityRestoreWrites());row.checks.push('failed-write-keeps-caps-level-receipts-and-selected-target');
   }
   await buy.click();await page.waitForFunction(id=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')).unitLevels[id]===10,unitId);await ready();
   assert.equal(await target.inputValue(),'11');row.purchaseClicks=scenario==='failed-save'?2:1;row.targetSelections=1;
  }
  const upgraded=await saved();row.result={level:upgraded.unitLevels[unitId],caps:upgraded.caps,revision:upgraded.revision,newReceipts:upgraded.receipts.filter(r=>!initial.receipts.includes(r))};
  row.upgradeSavedAtSeconds=(Date.now()-videoStartedAt)/1000;
  assert.equal(upgraded.caps,initial.caps-590);assert.equal(upgraded.unitLevels[unitId],10);assert.equal(row.result.newReceipts.length,9);
  assert.equal(upgraded.revision-initial.revision,before?9:1);
  for(const key of ['formationSlots','completedStageIds','equipment','vehicle','ownedUnitIds','registeredUnitIds'])assert.deepEqual(upgraded[key],initial[key],key+' preserved');
  for(const id of Object.keys(initial.unitLevels).filter(id=>id!==unitId))assert.equal(upgraded.unitLevels[id],initial.unitLevels[id]);
  assert.deepEqual(v100UnitPresentation(upgraded,unitId).current,quote.next);await shot('upgraded');
  await page.reload();await enter();const reloaded=await saved();
  for(const key of ['caps','unitLevels','receipts','equipment','formationSlots'])assert.deepEqual(reloaded[key],upgraded[key],'reload '+key);
  row.checks.push('exact-original-total-price','nine-original-receipts','other-progress-preserved','reload-preserves-purchase');row.status='passed';
 }catch(e){row.status='failed';row.error=String(e);await shot('failure').catch(()=>{});throw e;}
 finally{await context.close();row.video=await page.video().path();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
}assert.deepEqual(report.errors,[]);report.status='passed';}
catch(e){report.status='failed';report.error=String(e);throw e;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,engine,before,cases:report.cases.length,out}));
