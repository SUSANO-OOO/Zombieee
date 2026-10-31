import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {createDefaultV100Save, normalizeV100Save, serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {enterV100FromTitle, seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';

const before=process.env.QUALITY_HINT_BEFORE==='1';
const out=path.resolve(process.env.QUALITY_HINT_OUT ?? `output/quality-20261028/formation-hint-${before?'before':'after'}-r4`);
await mkdir(out,{recursive:true});
const report={scope:'Prepared formation screen via title and native details control; no campaign progression or combat acceptance.',build:await productionBuildIdentity(),cases:[],errors:[]};
const browser=await chromium.launch({headless:true});
try {
  for(const stage of before?[1]:[1,2,3]) {
    if(process.env.QUALITY_HINT_STAGES && !process.env.QUALITY_HINT_STAGES.split(',').includes(String(stage)))continue;
    const seed=normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,eventCursor:null,availableStageIds:V100_STAGE_IDS,
      flowState:{phase:'formation',stageId:V100_STAGE_IDS[stage-1],stageNumber:stage,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
    const context=await browser.newContext({viewport:{width:844,height:390}});
    try {
      await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
      const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
      await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);
      await dismissInstallOffer(page,{timeout:20000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});
      await enterV100FromTitle(page);
      let details;
      if(before){details=page.locator('.v100-briefing-details');await details.locator('summary').click();}
      else {await page.getByRole('button',{name:'作戦と戦い方',exact:true}).click();details=page.getByRole('dialog',{name:'作戦と戦い方',exact:true});await details.getByRole('button',{name:'作戦',exact:true}).click();}
      const text=await details.innerText();
      if(before)assert.match(text,/射撃と回復/u);
      else if(stage===1){assert.match(text,/鉄鍋仁王立ち/u);assert.match(text,/自分のHP/u);assert.doesNotMatch(text,/射撃と回復で/u);}
      else assert.doesNotMatch(text,/回復支援で持ちこたえる|射撃と回復で/u);
      if(!before)assert.doesNotMatch(text,/逃がそう|後ろに射撃役を置いて/u);
      const hint=details.locator('p').filter({hasText:/鉄鍋仁王立ち|大技の予告|クロメの照準|前衛が敵|前衛と射撃役|射撃と回復/u}).first();
      await hint.scrollIntoViewIfNeeded();
      const visibility=await hint.evaluate(el=>{
        const r=el.getBoundingClientRect(),panel=(el.closest('.v100-briefing-page')??el.closest('details').querySelector(':scope > div')).getBoundingClientRect();
        return {visible:r.top>=panel.top && r.bottom<=panel.bottom && r.left>=panel.left && r.right<=panel.right,top:r.top,bottom:r.bottom,panelTop:panel.top,panelBottom:panel.bottom};
      });
      assert.equal(visibility.visible,true,JSON.stringify(visibility));
      await page.screenshot({path:path.join(out,`s${stage}-briefing.png`)});
      const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
      for(const key of ['caps','ownedUnitIds','registeredUnitIds','formationSlots','receipts'])assert.deepEqual(saved[key],seed[key],key);
      report.cases.push({stage,text,visibility,savePreserved:true});
    } finally {await context.close();}
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
} catch(error){report.status='failed';report.error=String(error);throw error;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,cases:report.cases.length,out}));
