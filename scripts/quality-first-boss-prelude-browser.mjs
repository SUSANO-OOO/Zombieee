import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {seedV100BrowserSaveOnce,enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {normalTacticalInput} from './v100-normal-tactical-input.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {createNormalBrowserDeadline,normalCleanupWithin,normalProtocolTimeoutReceipt} from './v177-normal-browser-deadline.mjs';

const out=path.resolve(process.env.QUALITY_PRELUDE_OUT),engine=process.env.QUALITY_PRELUDE_ENGINE??'webkit';
await fs.mkdir(out,{recursive:false});
const origin=new URL(process.env.QUALITY_PRELUDE_URL);assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));
const source='output/quality-20261028/integrated-s03-retry-r1/report.json',bytes=await fs.readFile(source),original=JSON.parse(bytes);
const seed=structuredClone(original.stages.filter(s=>s.number===3).at(-1).openingSave);
// Restore the actually earned retry loadout. The title offers interrupted battle recovery.
seed.settings={...seed.settings,bgmEnabled:false,sfxEnabled:false};
const viewport={width:844,height:390},record={number:3,inputs:[]};
const report={engine,origin:origin.href,build:await productionBuildIdentity(process.env.QUALITY_PRELUDE_BUILD_ROOT),
 scope:'One restored earned S03 loadout, identical native tactical policy on each build, real time. No actor/HP/time/result setters. Silent UI video; not a fresh campaign, listening or physical-device acceptance.',
 source:{path:source,sha256:createHash('sha256').update(bytes).digest('hex')},seed,record,observations:[],errors:[],status:'running'};
await fs.writeFile(path.join(out,'harness.mjs'),await fs.readFile(new URL(import.meta.url)),{flag:'wx'});
const browser=await({chromium,webkit}[engine]).launch({headless:true}),context=await browser.newContext({viewport,hasTouch:true,serviceWorkers:'block',recordVideo:{dir:path.join(out,'video'),size:viewport}});
const deadlineGuard=createNormalBrowserDeadline({timeoutMs:15000,onTimeout:error=>{report.operationTimeout=normalProtocolTimeoutReceipt(error);}});
const rawPage=await context.newPage(),page=deadlineGuard.wrap(rawPage,'page');page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(String(e)));
const persist=()=>fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
let lastShot=-30,lastWave=null;
try{
 await context.addInitScript(seedV100BrowserSaveOnce,JSON.stringify(seed));
 await page.goto(new URL('?phase-g=1',origin).href,{waitUntil:'domcontentloaded'});
 await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
 const notice=page.locator('.pwa-notice');if(await notice.isVisible())await notice.getByRole('button',{name:'閉じる',exact:true}).click();
 // An interrupted battle returns to formation through the product recovery path.
 if(await page.getByRole('button',{name:'戦闘へ',exact:true}).isVisible())await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
 await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running&&document.documentElement.dataset.assetLoadState==='ready');
 report.openingSave=await saved();
 for(const key of ['caps','ownedUnitIds','unitLevels','equipment','formationSlots','receipts','completedStageIds'])assert.deepEqual(report.openingSave[key],seed[key],key);
 const deadline=Date.now()+240000;
 while(Date.now()<deadline){
  const observed=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();return{phase:document.querySelector('.v100-shell')?.dataset.v100Phase,s:s?{time:s.time,wave:s.wave,over:s.over,baseHp:s.baseHp,boss:s.fighters.find(f=>f.kind==='takuya'&&f.hp>0),enemyCount:s.fighters.filter(f=>f.side==='zombie'&&f.hp>0).length}:null};});
  if(observed.phase!=='battle'){report.finalSave=await saved();report.result=report.finalSave.pendingResult??report.finalSave.lastResult;assert.ok(report.result?.battleRunId);report.status=report.result.won?'observed-victory':'observed-defeat';break;}
  const s=observed.s;assert.ok(s,'read-only snapshot');
  if(s.boss&&!report.bossArrival){report.bossArrival={time:s.time,baseHp:s.baseHp,hp:s.boss.hp,maxHp:s.boss.maxHp};record.boss=true;await page.screenshot({path:path.join(out,'boss-arrival.png')});}
  const slim={time:s.time,wave:s.wave,baseHp:s.baseHp,bossHp:s.boss?.hp??null,enemyCount:s.enemyCount};report.observations.push(slim);
  if(s.wave!==lastWave){console.log(JSON.stringify(slim));lastWave=s.wave;}
  if(s.time-lastShot>=30){await page.screenshot({path:path.join(out,`battle-${Math.floor(s.time)}.png`)});lastShot=s.time;await persist();}
  if(!s.over)await normalTacticalInput(page,record);
  await page.waitForTimeout(350);
 }
 assert.notEqual(report.status,'running','bounded observation must reach an actual result');
 await page.screenshot({path:path.join(out,'result.png')});assert.deepEqual(report.errors,[]);
 console.log(JSON.stringify({status:report.status,bossArrival:report.bossArrival,result:report.result}));
}catch(error){report.status='failed';report.error=String(error);await persist();process.exitCode=1;}
finally{
 await normalCleanupWithin(()=>context.close(),'context.close').catch(error=>{report.cleanupError=String(error);});
 await normalCleanupWithin(async()=>{report.video=await rawPage.video().path();},'video.path').catch(error=>{report.videoCaptureError=String(error);});
 await normalCleanupWithin(()=>browser.close(),'browser.close').catch(error=>{report.browserCloseError=String(error);});
 await persist();
}
