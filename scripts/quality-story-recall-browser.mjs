import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from '../app/v100Save.js';
import { V100_STAGES, V100_STAGE_IDS } from '../app/v100Registry.js';
import { finishV100TitleIntro, seedV100BrowserSaveOnce } from './v100-title-qa-entry.mjs';
import { dismissInstallOffer } from './pwa-gate-qa.mjs';
import { productionBuildIdentity } from './browser-qa-build-identity.mjs';

const out=path.resolve(process.env.QUALITY_RECALL_OUT);
await mkdir(out,{recursive:true});
const engine=process.env.QUALITY_RECALL_ENGINE??'chromium';
const report={engine,build:await productionBuildIdentity(),scope:'Prepared saved progress at S01/S13/S23/S30. Native title recall, read-only log, close/reload; not natural progression or human recall acceptance.',cases:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true});
try {
  for(const number of [1,13,23,30]) for(const viewport of [{width:844,height:340},{width:1280,height:720}]) {
    const stage=V100_STAGES[number-1],previous=V100_STAGES[Math.max(0,number-2)];
    const readStoryEventIds=[...new Set(['v100:event:prologue',...(number>1?[previous.eventIds.pre,previous.eventIds.post]:[]),stage.eventIds.pre])];
    const seed=normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,caps:137,readStoryEventIds,availableStageIds:V100_STAGE_IDS.slice(0,number),completedStageIds:V100_STAGE_IDS.slice(0,number-1),flowState:{phase:'formation',stageId:stage.id,stageNumber:number,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
    const row={number,viewport},label=`s${number}-${viewport.width}x${viewport.height}`;
    report.cases.push(row);
    const context=await browser.newContext({viewport,hasTouch:true});
    try {
      await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
      const page=await context.newPage();page.setDefaultTimeout(15000);
      page.on('pageerror',e=>report.errors.push(String(e)));
      await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);
      await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});
      await finishV100TitleIntro(page);
      const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
      const before=await save();
      const recall=page.getByRole('button',{name:'物語を振り返る',exact:true});
      row.target=await recall.boundingBox();assert.ok(row.target.height>=44);
      await page.screenshot({path:path.join(out,`${label}-title.png`)});
      await recall.click();
      const log=page.getByRole('dialog',{name:'会話記録',exact:true});await log.waitFor();
      row.context=await log.locator('.v100-resume-context').innerText();
      assert.ok(row.context.includes(stage.displayName),row.context);
      const links=log.locator('.v100-log-list button');
      assert.equal(await links.count(),readStoryEventIds.length);
      assert.ok((await links.first().innerText()).includes('出撃前'));
      row.logFits=await log.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&r.left>=0&&r.right<=innerWidth+1&&el.scrollWidth<=el.clientWidth+1;});
      assert.equal(row.logFits,true);
      await page.screenshot({path:path.join(out,`${label}-recall.png`)});
      await links.first().click();
      const replay=page.locator('.v100-replay-layout');await replay.waitFor();
      assert.equal(await replay.getAttribute('data-v100-replay-index'),'0');
      await replay.getByRole('button',{name:'次へ',exact:true}).click();
      await page.waitForFunction(()=>Number(document.querySelector('.v100-replay-layout')?.getAttribute('data-v100-replay-index'))>0);
      row.replayIndex=Number(await replay.getAttribute('data-v100-replay-index'));
      await page.screenshot({path:path.join(out,`${label}-replay.png`)});
      await replay.getByRole('button',{name:'閉じる',exact:true}).click();
      assert.equal(await page.locator('.v100-shell').getAttribute('data-v100-phase'),'formation');
      const after=await save();assert.deepEqual(after,before,'Recall must not alter the game save');
      await page.reload();await finishV100TitleIntro(page);
      assert.deepEqual(await save(),before,'Reload preserves progress and receipts');
      row.status='passed';
    } finally { await context.close(); }
  }
  assert.deepEqual(report.errors,[]);
  report.status='passed';
} catch(error) { report.status='failed';report.error=String(error);throw error; }
finally { await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)); }
