import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {seedV100BrowserSaveOnce,enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';

const engine=process.env.QUALITY_DEFEAT_ENGINE??'webkit',before=process.env.QUALITY_DEFEAT_BEFORE==='1';
const out=path.resolve(process.env.QUALITY_DEFEAT_OUT);await fs.mkdir(out,{recursive:false});
const originalPath='output/quality-20261028/integrated-s03-retry-r1/report.json',originalBytes=await fs.readFile(originalPath),original=JSON.parse(originalBytes);
const victory=JSON.parse(await fs.readFile('tests/fixtures/quality-earned-replay-result-s01-e412.json','utf8'));
const report={engine,before,build:await productionBuildIdentity(process.env.QUALITY_DEFEAT_BUILD_ROOT),source:{path:originalPath,sha256:createHash('sha256').update(originalBytes).digest('hex')},
 scope:'Restore recorded S03 losses/S01 win through normal title controls. Sound disabled in isolated fixture. Missing-report case deliberately removes legacy telemetry. Not a new natural play victory or physical touch.',cases:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true});
const specs=before?[{width:844,height:340,scenario:'active'}]:[
 {width:1280,height:720,scenario:'active'},{width:844,height:390,scenario:'active'},{width:844,height:340,scenario:'active'},
 {width:844,height:340,scenario:'preboss'},{width:844,height:340,scenario:'legacy'},{width:844,height:340,scenario:'win'}];
const key='nishijin-campaign-v100';
try{for(const {scenario,...viewport} of specs){
 const label=`${viewport.width}x${viewport.height}-${scenario}`,row={label};report.cases.push(row);
 const seed=structuredClone(scenario==='win'?victory.save:original.finalSave);
 seed.settings={...seed.settings,bgmEnabled:false,sfxEnabled:false};
 if(scenario==='preboss')seed.lastResult=structuredClone(original.stages.find(s=>s.number===3&&s.result.battleReport.bossProgress.state==='not-encountered').result);
 if(scenario==='legacy')delete seed.lastResult.battleReport;
 const context=await browser.newContext({viewport,hasTouch:true,serviceWorkers:'block',recordVideo:{dir:path.join(out,label),size:viewport}}),page=await context.newPage();page.setDefaultTimeout(20000);
 const panel=page.locator('.v100-result-panel'),saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 const ready=()=>page.waitForFunction(()=>document.querySelector('#v100-campaign')?.getAttribute('aria-busy')==='false');
 const enter=async()=>{await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);await ready();};
 const closeNotice=async()=>{const notice=page.locator('.pwa-notice').filter({hasText:'オフライン用の設定に失敗しました。'});if(await notice.isVisible())await notice.getByRole('button',{name:'閉じる',exact:true}).click();};
 const shot=async suffix=>{await closeNotice();await page.screenshot({path:path.join(out,label+'-'+suffix+'.png')});};
 const fits=async locator=>{const box=await locator.boundingBox();assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,'primary progress and actions fit without scrolling');assert.ok(await locator.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'visible center');};
 page.on('pageerror',e=>report.errors.push(String(e)));
 try{
  await context.addInitScript(seedV100BrowserSaveOnce,JSON.stringify(seed));await page.goto(process.env.QUALITY_DEFEAT_URL);await enter();await panel.waitFor();await closeNotice();
  const initial=await saved();row.initial={caps:initial.caps,revision:initial.revision,flow:initial.flowState};
  await shot('entry');
  if(before){assert.equal(await panel.locator('.v100-defeat-progress').count(),0);row.bossBox=await panel.locator('.v100-result-boss').boundingBox();row.status='observed';continue;}
  if(scenario==='win'){
   assert.equal(await panel.locator('.v100-defeat-progress').count(),0);assert.ok(await panel.locator('.has-earned-stars').isVisible());assert.ok(await panel.getByRole('button',{name:/報酬を受け取る|次の場面へ/}).isVisible());assert.deepEqual(await saved(),initial);row.status='passed';continue;
  }
  const progress=panel.getByLabel('今回どこまで進めたか',{exact:true});await fits(progress);row.progress=await progress.innerText();
  assert.equal(await panel.locator('.v100-result-highlight').count(),0);
  if(scenario==='active'){assert.match(row.progress,/TAKUYAに到達/);assert.match(row.progress,/1033 \/ 2400（43%）/);assert.match(row.progress,/第8波・46体撃破 \/ 戦闘不能 9回/);}
  if(scenario==='preboss'){assert.match(row.progress,/TAKUYAの出現前に終了/);assert.match(row.progress,/第6波・38体撃破/);assert.doesNotMatch(row.progress,/残りHP/);}
  if(scenario==='legacy'){assert.match(row.progress,/到達地点の記録なし/);assert.doesNotMatch(row.progress,/第0波|0体撃破|TAKUYA/);}
  for(const button of await panel.locator('.v100-result-actions button').all()){await fits(button);assert.ok((await button.boundingBox()).height>=44);}
  const disclosure=panel.locator('.v100-battle-report');
  if(scenario!=='legacy'){
   await disclosure.locator('summary').click();row.unitRecords=await disclosure.locator('table').innerText();assert.match(row.unitRecords,/ナオ/);await shot('records');await disclosure.locator('summary').click();
  }
  assert.deepEqual(await saved(),initial,'reading result and contribution must be readonly');
  if(scenario==='active'&&viewport.height===340){
   const retry=panel.getByRole('button',{name:'同じ編成で再挑戦',exact:true});
   await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;window.__qualityBlockedWrites=0;IDBObjectStore.prototype.put=function(...args){if(this.name==='saves'){window.__qualityBlockedWrites++;throw new DOMException('QA retry save failure','QuotaExceededError');}return original.apply(this,args);};window.__qualityRestoreWrites=()=>{IDBObjectStore.prototype.put=original;};});
   await retry.click();await page.waitForFunction(()=>window.__qualityBlockedWrites>0);await ready();assert.deepEqual(await saved(),initial);assert.ok(await panel.isVisible());await shot('retry-save-failed');
   await page.evaluate(()=>window.__qualityRestoreWrites());await retry.click();
   await page.waitForFunction(()=>document.querySelector('#v100-campaign')?.dataset.v100Phase==='battle');await ready();
   const next=await saved();assert.equal(next.revision,initial.revision+1);assert.equal(next.flowState.phase,'battle');
   for(const name of ['caps','unitLevels','equipment','formationSlots','ownedUnitIds','registeredUnitIds','receipts','bestStars','completedStageIds'])assert.deepEqual(next[name],initial[name],name+' retained by retry');
   row.retry={failedWritePreserved:true,battleEntered:true,revision:next.revision,preservedFields:true};await shot('retry');
  }else if(scenario==='active'){
   await panel.getByRole('button',{name:'編成を見直す',exact:true}).click();await page.locator('[data-v100-surface="formation"]').waitFor();await ready();
   const next=await saved();for(const name of ['caps','unitLevels','equipment','formationSlots','receipts','bestStars'])assert.deepEqual(next[name],initial[name]);row.formationReturn=true;await shot('formation');
  }else{
   await page.reload();await enter();await panel.waitFor();assert.deepEqual(await saved(),initial);row.reloadPreserved=true;
  }
  row.status='passed';
 }catch(e){row.status='failed';row.error=String(e);await shot('failure').catch(()=>{});throw e;}
 finally{await context.close();row.video=await page.video().path();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
}assert.deepEqual(report.errors,[]);report.status=before?'observed':'passed';}
catch(e){report.status='failed';report.error=String(e);throw e;}
finally{await browser.close();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,engine,cases:report.cases.length,out}));
