import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_UNITS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {v100UnitPresentation} from '../app/v100UnitPresentation.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const engine=process.env.QUALITY_GROWTH_ENGINE??'chromium',before=process.env.QUALITY_GROWTH_BEFORE==='1';
const out=path.resolve(process.env.QUALITY_GROWTH_OUT);await mkdir(out,{recursive:true});
const report={engine,before,build:await productionBuildIdentity(),scope:'Prepared owned roster; native selection, purchase and reload; not natural campaign affordability or physical-device acceptance.',cases:[],errors:[]};
const ids=V100_UNITS.map(u=>u.id);
const seed=normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,caps:20000,levelCap:25,ownedUnitIds:ids,registeredUnitIds:ids,unitLevels:Object.fromEntries(ids.map(id=>[id,7])),availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,22),flowState:{phase:'map',stageId:V100_STAGE_IDS[22],stageNumber:23,destination:'map',nodeIndex:0,firstClear:false,finalized:true}});
assert.equal(seed.levelCap,25);
const browser=await({chromium,webkit}[engine]).launch({headless:true});
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
const ready=page=>page.waitForFunction(()=>document.querySelector('#v100-campaign')?.getAttribute('aria-busy')==='false');
try{
 for(const viewport of [{width:844,height:340},{width:1280,height:720}]){
  const label=viewport.width+'x'+viewport.height,context=await browser.newContext({viewport,hasTouch:true,recordVideo:{dir:path.join(out,label),size:viewport}});
  await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
  try{
   await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);await ready(page);
   await page.getByRole('button',{name:'ユニット',exact:true}).click();
   const initial=await stored(page);
   for(const unit of V100_UNITS){
    const back=page.getByRole('button',{name:'ユニット一覧へ',exact:true});if(await back.isVisible())await back.click();
    await page.locator('.v100-personnel-card').filter({has:page.getByRole('heading',{name:unit.displayName,exact:true})}).click();
    const focus=page.locator('.v100-personnel-focus[data-unit-id="'+unit.id+'"]');await focus.waitFor({state:'visible'});const saved=await stored(page),info=v100UnitPresentation(saved,unit.id);const row={viewport,label:unit.id};report.cases.push(row);
    if(!before){
     const effect=focus.locator('.v100-unit-level-effect');await effect.scrollIntoViewIfNeeded();assert.equal(await effect.innerText(),info.skill.levelEffect);row.effect=await effect.innerText();
     assert.equal(await effect.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
     const gain=focus.locator('.v100-upgrade-preview');await gain.scrollIntoViewIfNeeded();assert.match(await gain.innerText(),/今回の強化/u);row.gain=await gain.innerText();
     await focus.locator('.v100-personnel-focus-copy').hover();await page.mouse.wheel(0,600);
     await page.waitForFunction(id=>{const root=document.querySelector('.v100-personnel-focus[data-unit-id="'+id+'"]');const stat=root?.querySelector('.v100-unit-stat:last-child'),footer=root?.querySelector('.v100-unit-transaction'),body=root?.querySelector('.v100-personnel-focus-copy');if(!stat||!footer||!body)return false;const s=stat.getBoundingClientRect(),f=footer.getBoundingClientRect(),b=body.getBoundingClientRect();return s.top>=b.top&&s.bottom<=f.top+1;},unit.id,{timeout:5000});row.lastStatReadable=true;
    }
    if(['unit-paisen','unit-nao','unit-kumaverson','unit-crazy-king'].includes(unit.id))await page.screenshot({path:path.join(out,label+'-'+unit.id+'.png')});
    if(!before){
     await focus.getByRole('button',{name:'Lv.'+info.nextLevel+'へ強化 / '+info.upgradeCost+' CAPS',exact:true}).click();await ready(page);await page.waitForFunction(id=>document.querySelector('.v100-personnel-focus[data-unit-id="'+id+'"]')?.getAttribute('data-unit-level')==='8',unit.id);
     const next=await stored(page);assert.equal(next.caps,saved.caps-info.upgradeCost);assert.equal(next.unitLevels[unit.id],8);assert.equal(next.receipts.filter(x=>x==='v100:unit:'+unit.id+':level:8').length,1);for(const key of ['completedStageIds','ownedUnitIds','equipment','bestStars'])assert.deepEqual(next[key],saved[key]);row.cost=info.upgradeCost;
    }row.status='passed';
   }
   const final=await stored(page);if(before)assert.deepEqual(final,initial);else{await page.reload();await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);await ready(page);const reloaded=await stored(page);for(const key of ['caps','receipts','unitLevels','equipment'])assert.deepEqual(reloaded[key],final[key]);}
  }finally{await context.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.error=String(error);throw error;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
