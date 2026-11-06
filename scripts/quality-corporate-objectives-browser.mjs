import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';

const before=process.env.QUALITY_OBJECTIVE_BEFORE==='1';
const out=path.resolve(`output/quality-20261028/corporate-objectives-${before?'before':'after'}-r1`);
await mkdir(out,{recursive:true});
const report={scope:'Prepared valid formation saves; normal title continue and battle start. Unmodified battle clock, no combat-state mutation. Opening HUD only, not earned progression or victory.',build:await productionBuildIdentity(),cases:[],errors:[]};
const browser=await chromium.launch({headless:true});
try {
  for(const stage of before?[23]:[21,23,24,25,27]) {
    const base=createDefaultV100Save(),owned=[...new Set([...base.ownedUnitIds,'unit-gantetsu','unit-babayaga'])];
    const seed=normalizeV100Save({...base,campaignStarted:true,playerName:'目標表示確認',availableStageIds:V100_STAGE_IDS,
      completedStageIds:V100_STAGE_IDS.slice(0,stage-1),ownedUnitIds:owned,registeredUnitIds:owned,
      formationSlots:['unit-gantetsu','unit-babayaga',null,null,null,null,null],eventCursor:null,
      flowState:{phase:'formation',stageId:V100_STAGE_IDS[stage-1],stageNumber:stage,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
    const context=await browser.newContext({viewport:{width:844,height:340},recordVideo:{dir:path.join(out,`s${stage}`),size:{width:844,height:340}}});
    try {
      const page=await context.newPage();page.setDefaultTimeout(20000);
      page.on('pageerror',e=>report.errors.push({stage,error:String(e)}));
      await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
      await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);
      await dismissInstallOffer(page,{timeout:20000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});
      await enterV100FromTitle(page);
      const briefing=await page.locator('.v100-field-map-intel').innerText();
      await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
      await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
      await page.waitForTimeout(1800);
      const objective=await page.locator('.battle-objective').innerText();
      const state=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__.getSnapshot();return {time:s.time,objective:s.objective,barricadeHp:s.barricadeHp,barricadeVulnerable:s.barricadeVulnerable};});
      if(before)assert.match(objective,/異常個体/u);
      else if(stage===24)assert.match(objective,/フタゴを倒し、中央制御盤を破壊/u);
      else if(stage===25)assert.match(objective,/変異ムガリアン社長を倒し、研究室制御盤を破壊/u);
      else assert.match(objective,/警備部隊を迎撃（最終ウェーブで防護解除）/u);
      const geometry=await page.locator('.battle-objective').evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,height:el.clientHeight,scrollHeight:el.scrollHeight}));
      assert.ok(geometry.scrollWidth<=geometry.width+1,`S${stage}: clipped objective`);
      assert.ok(geometry.scrollHeight<=geometry.height+1,`S${stage}: clipped objective height`);
      await page.screenshot({path:path.join(out,`s${stage}.png`)});
      await context.close();
      report.cases.push({stage,briefing,objective,state,geometry,video:await page.video().path()});
    } finally {await context.close();}
  }
  assert.equal(report.errors.length,0);report.status='passed';
} catch(error){report.status='failed';report.error=String(error);throw error;}
finally {await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,cases:report.cases.length,out}));
