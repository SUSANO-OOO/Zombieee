import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_UNITS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {v100UnitPresentation,formatV100Number} from '../app/v100UnitPresentation.js';
const out=path.resolve(process.env.QUALITY_SURVIVOR_UI_OUT);await mkdir(out,{recursive:true});
const engine=process.env.QUALITY_PREPARATION_ENGINE??'chromium';
const before=false;
const surfacesOnly=process.env.QUALITY_SURVIVOR_UI_SURFACES_ONLY==='1';
const ids=V100_UNITS.map(u=>u.id);
const seed=normalizeV100Save({...createDefaultV100Save(),caps:2000,campaignStarted:true,ownedUnitIds:ids,registeredUnitIds:ids,formationSlots:ids.slice(0,7),availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,22),flowState:{phase:'formation',stageId:V100_STAGE_IDS[22],stageNumber:23,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
const report={engine,before,surfacesOnly,build:await productionBuildIdentity(),scope:'Prepared all-owned S23 phone interface; all16 selection, cost/advice/readability, shared portrait and optional full view, unrelated save preserved. Not earned progression, physical-device or aesthetic acceptance.',cases:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true});
try{
 for(const viewport of [{width:844,height:340},{width:844,height:390},{width:740,height:360}]){
  const label=`${viewport.width}x${viewport.height}`,row={label};report.cases.push(row);
  const context=await browser.newContext({viewport,hasTouch:true,recordVideo:{dir:path.join(out,label),size:viewport}});
  try{
   await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
   const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
   await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
   if(!surfacesOnly){
   await page.waitForFunction(()=>[...document.querySelectorAll('.v100-slot-track img')].every(i=>i.complete&&i.naturalWidth>0&&i.dataset.loaded==='true'));
   await page.screenshot({path:path.join(out,label+'-formation.png')});
   await page.getByRole('button',{name:/編成枠1 /}).click();
   await page.waitForFunction(()=>[...document.querySelectorAll('.v100-roster-card-art img')].every(i=>i.complete&&i.naturalWidth>0));
   row.cards=await page.locator('.v100-roster-card').allTextContents();assert.equal(row.cards.length,16);
   await page.screenshot({path:path.join(out,label+'-picker.png')});
   if(!before){
    row.cardChecks=[];
    for(const unit of V100_UNITS){
     const card=page.locator(`[data-roster-unit="${unit.id}"]`),info=v100UnitPresentation(seed,unit.id);
     assert.ok(info.abilityAdvice,unit.id+' must have concrete advice');
     await card.scrollIntoViewIfNeeded();
     assert.equal(await card.locator('.v100-roster-advice').innerText(),'固有技：'+info.abilityAdvice);
     assert.equal((await card.locator('.v100-roster-callin').innerText()).trim(),`指揮 ${info.commandCost}\n次の出撃まで ${formatV100Number(info.redeploySeconds)}秒`);
     const bounds=await card.evaluate(el=>{
      const c=el.getBoundingClientRect(),grid=el.closest('.v100-roster-grid').getBoundingClientRect();
      return {height:c.height,width:c.width,visible:c.top>=grid.top-1&&c.bottom<=grid.bottom+1,
       contents:[...el.querySelectorAll('.v100-roster-card-copy strong,.v100-roster-role,.v100-roster-advice,.v100-roster-callin')].map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent,display:getComputedStyle(n).display,fits:r.width>0&&r.height>0&&r.left>=c.left&&r.right<=c.right+1&&r.top>=c.top&&r.bottom<=c.bottom+1,noClip:n.scrollWidth<=n.clientWidth+1&&n.scrollHeight<=n.clientHeight+1};})};
     });
     assert.ok(bounds.visible,unit.id+' card must fit its scroll viewport');
     assert.ok(bounds.contents.every(n=>n.display!=='none'&&n.fits&&n.noClip),JSON.stringify({unit:unit.id,bounds}));
     row.cardChecks.push({id:unit.id,...bounds});
     await card.click();await page.locator(`[data-v100-focused-unit="${unit.id}"]`).waitFor();
     assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')).formationSlots[0]),unit.id);
     await page.getByRole('button',{name:/編成枠1 /}).click();
    }
    await page.locator('[data-roster-unit="unit-miyamoto-musashi"]').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(out,label+'-last-row.png')});
   }
   await page.getByRole('button',{name:'ナオを枠1へ配置',exact:true}).click();
   await page.locator('[data-v100-focused-unit="unit-nao"]').waitFor();
   await page.screenshot({path:path.join(out,label+'-nao.png')});
   const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
   assert.equal(stored.formationSlots[0],'unit-nao');for(const key of ['caps','receipts','unitLevels','equipment'])assert.deepEqual(stored[key],seed[key]);
   await page.getByRole('button',{name:'ユニットの育成',exact:true}).click();
   await page.locator('.v100-personnel-focus[data-unit-id="unit-nao"]').waitFor();
   await page.screenshot({path:path.join(out,label+'-growth.png')});
   row.growth=await page.locator('.v100-personnel-focus-copy').evaluate(el=>{const c=el.getBoundingClientRect();return [...el.querySelectorAll('.v100-unit-stat strong,.v100-unit-stat small')].map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent,visible:r.width>0&&r.height>0&&getComputedStyle(n).visibility!=="hidden"&&r.top>=c.top&&r.bottom<=c.bottom+1&&r.right<=c.right+1};});});
   assert.ok(row.growth.length>=6&&row.growth.every(n=>n.visible),JSON.stringify(row.growth));
   await page.locator('[data-portrait-view="upper"]').waitFor();
   await page.getByRole('button',{name:'全体',exact:true}).click();
   await page.locator('[data-portrait-view="whole"]').waitFor();
   await page.getByRole('button',{name:'腰上',exact:true}).click();
   await page.locator('[data-portrait-view="upper"]').waitFor();
   const unchanged=await page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
   for(const key of ['caps','receipts','unitLevels','equipment'])assert.deepEqual(unchanged[key],seed[key]);
   await page.locator('.v100-personnel-detail-back').click();
   await page.locator('.v100-command-tabs').getByRole('button',{name:'ユニット',exact:true}).click();
   await page.locator('.v100-personnel-screen:not(.detail-open)').waitFor();
   await page.screenshot({path:path.join(out,label+'-personnel.png')});
   row.portraits=[];
   for(const unit of V100_UNITS){
     const card=page.locator('[data-personnel-unit="'+unit.id+'"]');
     await card.scrollIntoViewIfNeeded();
     await card.screenshot({path:path.join(out,label+'-'+unit.id+'.png')});
     const image=card.locator('img');
     await image.waitFor();
     assert.ok(await image.evaluate(i=>i.complete&&i.naturalWidth>0),unit.id+' portrait decoded');
     const copyFits=await card.evaluate(el=>{const c=el.getBoundingClientRect();return [...el.querySelectorAll('.v100-personnel-copy h3,.v100-crew-skill,.v100-crew-state')].map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent,fits:r.right<=c.right+1&&r.bottom<=c.bottom+1&&r.left>=c.left&&r.top>=c.top,noClip:n.scrollHeight<=n.clientHeight+1&&n.scrollWidth<=n.clientWidth+1};});});
     assert.ok(copyFits.every(n=>n.fits&&n.noClip),JSON.stringify({unit:unit.id,copyFits}));
     row.portraits.push({id:unit.id,path:await image.getAttribute('src'),copyFits});
   }
   }
   for(const [tab,surface] of [['支援','support'],['装備','equipment'],['車両','vehicle']]){
     await page.locator('.v100-command-tabs').getByRole('button',{name:tab,exact:true}).click();
     if(tab==='装備'){
       await page.locator('.v100-equipment-tabs').getByRole('button',{name:'補給所',exact:true}).click();
       row.equipmentEffect=await page.locator('.v100-equipment-focus-heading p').evaluate(n=>{const r=n.getBoundingClientRect(),b=n.closest('.v100-equipment-focus-body').getBoundingClientRect();return {text:n.textContent,visible:r.width>0&&r.height>0&&r.top>=b.top&&r.bottom<=b.bottom+1};});
       assert.ok(row.equipmentEffect.text&&row.equipmentEffect.visible,JSON.stringify(row.equipmentEffect));
     }
     await page.screenshot({path:path.join(out,label+'-'+surface+'.png')});
   }
   await page.getByRole('button',{name:'メニュー',exact:true}).click();
   await page.locator('.v100-player-menu').waitFor();
   await page.screenshot({path:path.join(out,label+'-menu.png')});
   await page.locator('.v100-player-menu .v100-panel-heading button').click();
   await page.locator('.v100-command-tabs').getByRole('button',{name:'編成',exact:true}).click();
   await page.getByRole('button',{name:'ステージ選択へ',exact:true}).click();
   await page.locator('.v100-command-map').waitFor();
   await page.screenshot({path:path.join(out,label+'-map.png')});
   row.status='captured';
  }finally{await context.close();}
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.error=String(error);throw error;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,cases:report.cases.map(c=>({label:c.label,status:c.status}))}));
