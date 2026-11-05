// Real game UI with a deliberately unavailable service worker. This is a
// notice visibility regression, not an installed-pack or victory test.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {seedV100BrowserSaveOnce,enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const engine=process.env.QUALITY_NOTICE_ENGINE??'webkit';
const baseline=process.env.QUALITY_NOTICE_BASELINE==='1';
const out=path.resolve(process.env.QUALITY_NOTICE_OUT),url=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(['127.0.0.1','localhost'].includes(url.hostname));assert.ok(['chromium','webkit'].includes(engine));
await mkdir(out,{recursive:false});await writeFile(path.join(out,'driver.mjs'),await readFile(new URL(import.meta.url)));
const original=createDefaultV100Save();
const seed=normalizeV100Save({...original,campaignStarted:true,settings:{...original.settings,masterVolume:0},
 flowState:{phase:'formation',stageId:V100_STAGE_IDS[0],stageNumber:1,destination:'formation',eventId:null,nodeIndex:0,firstClear:false,finalized:true}});
const report={engine,baseline,build:await productionBuildIdentity(process.env.QUALITY_NOTICE_BUILD_ROOT),
 scope:'Prepared S01 formation, blocked SW registration, ordinary battle/pause/retreat. Muted; no installed pack, natural progression, full-speed human or physical-device acceptance.',cases:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true});
try{
 for(const viewport of [{width:844,height:340},{width:1280,height:720}]){
  const label=`${viewport.width}x${viewport.height}`,row={label,checks:[]};report.cases.push(row);
  const context=await browser.newContext({viewport,hasTouch:true,serviceWorkers:'block',recordVideo:{dir:path.join(out,label),size:viewport}});
  const page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',e=>report.errors.push(String(e)));
  try{
   await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
   const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
   const notice=page.locator('.pwa-notice').filter({hasText:'オフライン用の設定に失敗しました'});
   const shot=async suffix=>page.screenshot({path:path.join(out,label+'-'+suffix+'.png')});
   await page.goto(url.href);await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});
   await notice.waitFor({state:'visible'});row.checks.push('title notice visible');
   await enterV100FromTitle(page);await page.locator('.v100-formation-panel').waitFor();
   await notice.waitFor({state:'visible'});row.checks.push('formation notice visible');
   await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
   await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot().running&&document.documentElement.dataset.pwaSaveMutationPending==='false');
   await notice.waitFor({state:baseline?'visible':'hidden'});
   row.battleSave=await saved();await shot('battle');
   row.checks.push(baseline?'baseline overlap reproduced':'battle notice hidden');
   if(baseline){row.status='reproduced';continue;}
   const beforeTime=await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.getSnapshot().time);
   await page.waitForTimeout(1100);
   assert.ok(await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.getSnapshot().time)>beforeTime);
   assert.deepEqual(await saved(),row.battleSave);
   await page.getByRole('button',{name:'一時停止',exact:true}).click();
   await page.getByRole('dialog',{name:'一時停止メニュー',exact:true}).waitFor();assert.equal(await notice.isVisible(),false);
   await shot('pause');row.checks.push('paused battle notice hidden');
   await page.getByRole('button',{name:'ステージ選択へ撤退',exact:true}).click();
   await page.getByRole('alertdialog').getByRole('button',{name:'撤退する',exact:true}).click();
   await page.locator('.v100-shell[data-v100-phase="map"]').waitFor();await notice.waitFor({state:'visible'});
   row.mapSave=await saved();
   for(const key of ['caps','receipts','completedStageIds','ownedUnitIds','registeredUnitIds','formationSlots','unitLevels','vehicle','equipment']){
    assert.ok(Object.hasOwn(row.battleSave,key));assert.deepEqual(row.mapSave[key],row.battleSave[key],key);
   }
   await shot('map');row.checks.push('pending notice returns after ordinary retreat; resources unchanged');
   // Same-tick bridge checks cover observer lag and save/result transitions.
   // They change only published UI safety attributes, never game/save state.
   for(const attrs of [{pwaScreen:'event'},{pwaScreen:'result'},{pwaBattleActive:'true'},{pwaResultSaving:'true'},{pwaSaveMutationPending:'true'},{pwaMaintenancePending:'true'}]){
    const immediate=await notice.evaluate((el,attrs)=>{
     const data=document.documentElement.dataset,previous={};for(const [key,value] of Object.entries(attrs)){previous[key]=data[key];data[key]=value;}
     const hidden=getComputedStyle(el).display==='none';for(const [key,value] of Object.entries(previous)){if(value===undefined)delete data[key];else data[key]=value;}return hidden;
    },attrs);assert.equal(immediate,true,JSON.stringify(attrs));
   }
   assert.deepEqual(await saved(),row.mapSave);row.checks.push('synchronous unsafe-screen and saving bridge hides notice');
   await notice.getByRole('button',{name:'閉じる',exact:true}).click();await notice.waitFor({state:'hidden'});
   assert.deepEqual(await saved(),row.mapSave);row.checks.push('explicit close preserves complete save');row.status='passed';
  }catch(error){row.status='failed';row.error=String(error);await page.screenshot({path:path.join(out,label+'-failure.png')}).catch(()=>{});throw error;}
  finally{await context.close();row.video=await page.video().path();}
 }
 assert.deepEqual(report.errors,[]);
}finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({cases:report.cases.map(({label,status})=>({label,status})),out}));
