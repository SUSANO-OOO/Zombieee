import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';

const out=path.resolve(process.env.QUALITY_PARTICIPATION_OUT ?? 'output/quality-20261028/participation-ui-r1');await mkdir(out,{recursive:true});
const report={scope:'Prepared valid saves and normal UI. Save preservation and sortie availability, not earned stage progression or difficulty acceptance.',build:await productionBuildIdentity(),cases:[],errors:[]};
const browser=await chromium.launch({headless:true});
try {
  for(const config of [{stage:1},{stage:2},{stage:3},{stage:1,onlyPaisen:true},{stage:2,onlyPaisen:true,phase:'battle'}]) {
    const {stage,onlyPaisen=false,phase='formation'}=config,label=`s${stage}-${onlyPaisen?'only-paisen':'default'}-${phase}`;
    if(process.env.QUALITY_PARTICIPATION_CASE && process.env.QUALITY_PARTICIPATION_CASE!==label)continue;
    const base=createDefaultV100Save();
    const seed=normalizeV100Save({...base,campaignStarted:true,playerName:'救助担当確認',availableStageIds:V100_STAGE_IDS,
      completedStageIds:V100_STAGE_IDS.slice(0,stage-1),eventCursor:null,
      ...(onlyPaisen?{formationSlots:['unit-paisen',null,null,null,null,null,null]}:{}),
      flowState:{phase,stageId:V100_STAGE_IDS[stage-1],stageNumber:stage,destination:phase,nodeIndex:0,firstClear:false,finalized:true}});
    const context=await browser.newContext({viewport:{width:844,height:340},recordVideo:{dir:path.join(out,label),size:{width:844,height:340}}});
    try {
      const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
      await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
      await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);
      await dismissInstallOffer(page,{timeout:20000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});
      await enterV100FromTitle(page);
      const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
      if(await page.getByRole('heading',{name:'出撃する仲間を選び直そう',exact:true}).isVisible()){
        await page.screenshot({path:path.join(out,label+'-recovery.png')});
        await page.getByRole('button',{name:'編成を見直す',exact:true}).click();
      }
      await page.locator('.v100-formation-panel').waitFor();
      const snapshot=await stored();
      assert.deepEqual(snapshot.formationSlots,seed.formationSlots);
      for(const key of ['ownedUnitIds','registeredUnitIds','unitLevels','equipment','caps','receipts'])assert.deepEqual(snapshot[key],seed[key],key);
      if(stage<3){assert.match(await page.locator('.v100-stage-absence').innerText(),/救助中/u);assert.equal(await page.locator('.v100-sortie-count').innerText(),`${onlyPaisen?0:3}/ 7 呼び出し枠`);}
      await page.screenshot({path:path.join(out,label+'-formation.png')});
      await page.locator('.v100-slot-track button').first().click();
      const candidate=page.locator('.v100-roster-card').filter({hasText:'パイセン'});
      assert.equal(await candidate.isDisabled(),stage<3);
      await page.getByRole('button',{name:'編成に戻る',exact:true}).click();
      const start=page.getByRole('button',{name:'戦闘へ',exact:true});
      assert.equal(await start.isDisabled(),onlyPaisen);
      if(onlyPaisen){
        await page.locator('.v100-slot-track button').first().click();
        await page.getByRole('button',{name:'ハチを枠1へ配置',exact:true}).click();
        await page.waitForFunction(()=>!document.querySelector('.v100-shell[aria-busy="true"]') && JSON.parse(localStorage.getItem('nishijin-campaign-v100')).formationSlots[0]==='unit-hachi');
        assert.equal(await start.isEnabled(),true);
      }
      await start.click();await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
      await page.waitForTimeout(1200);
      const cards=await page.locator('button.unit-card[data-kind]').evaluateAll(items=>items.map(el=>el.dataset.kind));
      assert.equal(cards.includes('brawler'),stage===3);
      await page.screenshot({path:path.join(out,label+'-battle.png')});
      const final=await stored();
      for(const key of ['ownedUnitIds','registeredUnitIds','unitLevels','equipment','caps','receipts'])assert.deepEqual(final[key],snapshot[key],key);
      if(!onlyPaisen)assert.deepEqual(final.formationSlots,snapshot.formationSlots);
      await context.close();report.cases.push({...config,cards,video:await page.video().path(),preserved:true});
    } finally {await context.close();}
  }
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.error=String(error);throw error;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,cases:report.cases.length,out}));
