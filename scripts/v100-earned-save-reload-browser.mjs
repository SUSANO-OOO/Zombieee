import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {exportV100BrowserSave,importV100BrowserSave} from '../app/v100CampaignStorage.js';
import {V100_PRIMARY_STORAGE_KEY} from '../app/v100Save.js';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';

const origin=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(['localhost','127.0.0.1'].includes(origin.hostname),'Isolated local QA only');
const out=process.env.V100_EARNED_SAVE_OUT??'outputs/v100-earned-save-reload-r1';
await mkdir(out,{recursive:false});
const sourcePath='outputs/v100-feedback-normal-campaign-r2/report.json';
const sourceBytes=await readFile(sourcePath),baseline=JSON.parse(sourceBytes);
assert.equal(baseline.status,'completed-feedback-diagnostic');
const earned=baseline.finalSave;
assert.equal(earned.completedStageIds.length,30);
assert.equal(earned.postGameAvailable,true);
assert.equal(new Set(earned.receipts).size,earned.receipts.length);
const preservedKeys=Object.keys(earned).filter(key=>!['revision','updatedAt'].includes(key));
const stable=save=>Object.fromEntries(preservedKeys.map(key=>[key,save[key]]));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const backup=exportV100BrowserSave(earned);
await writeFile(out+'/earned-input-backup.json',backup);
const report={scope:'Native import, export and reload of the completed 30-stage diagnostic save from an earlier build. Fresh isolated storage per browser; no direct storage writes or gameplay state setters. This does not replay the campaign on the current build.',source:{path:sourcePath,sha256:sha(sourceBytes),build:baseline.build,backupSha256:sha(backup)},build:await productionBuildIdentity(),preservedKeys,cases:[]};
const rawSave=page=>page.evaluate(key=>localStorage.getItem(key),V100_PRIMARY_STORAGE_KEY);
const ready=page=>page.waitForFunction(()=>document.documentElement.dataset.pwaSaveMutationPending==='false'&&document.querySelector('.v100-shell'));
async function acknowledgeOffer(page){
 const play=page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true});
 await play.or(page.locator('.v100-shell')).first().waitFor();
 if(await play.isVisible())await play.click();
 await ready(page);
}
async function enter(page){
 await page.goto(new URL('/v100',origin).href,{waitUntil:'networkidle'});
 await acknowledgeOffer(page);
}
async function openData(page){
 const details=page.locator('.v100-map-detail');
 if(await details.isVisible()&&await details.getAttribute('open')===null)await details.locator(':scope > summary').click();
 await page.locator('.v100-shell').getByRole('button',{name:'データ管理',exact:true}).click();
 return page.getByRole('dialog',{name:'データ管理',exact:true});
}
async function restore(page,content){
 const dialog=await openData(page),before=JSON.parse(await rawSave(page)).revision;
 await dialog.locator('.v100-data-actions input[type=file]').setInputFiles({name:'earned-backup.json',mimeType:'application/json',buffer:Buffer.from(content)});
 await page.waitForFunction(({key,before})=>JSON.parse(localStorage.getItem(key)).revision>before,{key:V100_PRIMARY_STORAGE_KEY,before});
 await ready(page);await page.locator('.v100-map-layout').waitFor();
}
for(const [engine,type]of Object.entries({chromium,webkit})){
 const browser=await type.launch({headless:true}),context=await browser.newContext({viewport:{width:844,height:340},isMobile:true,hasTouch:true,acceptDownloads:true});
 const record={engine,status:'running',errors:[],navigationAborts:[],teardownAborts:[]};report.cases.push(record);
 let navigation=false,teardown=false,page;
 context.on('page',p=>{
  p.setDefaultTimeout(45000);
  p.on('pageerror',e=>record.errors.push({type:'page',message:String(e)}));
  p.on('console',m=>{if(m.type()==='error')record.errors.push({type:'console',message:m.text()});});
  p.on('response',r=>{if(r.status()>=400)record.errors.push({type:'http',url:r.url(),status:r.status()});});
  p.on('requestfailed',r=>{const failure={url:r.url(),message:r.failure()?.errorText};if(/abort|cancel/i.test(failure.message??'')&&(navigation||teardown))(teardown?record.teardownAborts:record.navigationAborts).push(failure);else record.errors.push({type:'request',...failure});});
 });
 try{
  page=await context.newPage();await enter(page);
  await restore(page,backup);
  const importedRaw=await rawSave(page),imported=JSON.parse(importedRaw);
  assert.deepEqual(stable(imported),stable(earned));
  record.imported={completed:imported.completedStageIds.length,caps:imported.caps,readEvents:imported.readStoryEventIds.length,receipts:imported.receipts.length,revision:imported.revision};
  await page.screenshot({path:out+'/'+engine+'-imported.png'});
  record.step='reload';navigation=true;await page.reload({waitUntil:'networkidle'});await acknowledgeOffer(page);navigation=false;
  assert.equal(await rawSave(page),importedRaw,'Reload must preserve exact saved bytes');
  record.step='close-and-reopen';navigation=true;await page.close();page=await context.newPage();await enter(page);navigation=false;
  assert.equal(await rawSave(page),importedRaw,'Close and reopen must preserve exact saved bytes');
  record.step='native-export';const dialog=await openData(page);
  const pending=page.waitForEvent('download');await dialog.getByRole('button',{name:'セーブを書き出す',exact:true}).click();
  const download=await pending,exportPath=out+'/'+engine+'-native-export.json';await download.saveAs(exportPath);
  const exported=importV100BrowserSave(await readFile(exportPath,'utf8'));
  assert.equal(exported.ok,true);assert.deepEqual(stable(exported.save),stable(earned));
  await dialog.getByRole('button',{name:'閉じる',exact:true}).click();
  record.step='repeated-import';await restore(page,backup);
  const second=JSON.parse(await rawSave(page));assert.deepEqual(stable(second),stable(earned));
  assert.equal(new Set(second.receipts).size,second.receipts.length);
  record.repeatedImport={caps:second.caps,receipts:second.receipts.length,revision:second.revision};
  record.step='invalid-import';const invalidDialog=await openData(page),beforeInvalid=await rawSave(page);
  const previousNotice=await page.evaluate(()=>document.querySelector('[role="status"]')?.textContent??'');
  await invalidDialog.locator('.v100-data-actions input[type=file]').setInputFiles({name:'invalid-backup.json',mimeType:'application/json',buffer:Buffer.from('{"format":"broken"}')});
  await page.waitForFunction(previous=>{const text=document.querySelector('[role="status"]')?.textContent;return Boolean(text&&text!==previous);},previousNotice);await ready(page);
  record.invalidImportNotice=await page.getByRole('status').innerText();
  assert.ok(!record.invalidImportNotice.includes('復元しました'));
  assert.equal(await rawSave(page),beforeInvalid,'Rejected import must preserve exact saved bytes');
  await page.screenshot({path:out+'/'+engine+'-invalid-import-keeps-save.png'});
  assert.deepEqual(record.errors,[]);record.status='passed';
 }catch(error){record.status='failed';record.error=String(error);record.stack=error.stack;await page?.screenshot({path:out+'/'+engine+'-failure.png'}).catch(()=>{});}
 finally{teardown=true;await context.close();await browser.close();if(record.errors.length){record.status='failed';record.error??='Browser diagnostics';}await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
}
report.buildAfter=await productionBuildIdentity();
assert.equal(report.build.combinedSha256,report.buildAfter.combinedSha256);
report.status=report.cases.every(c=>c.status==='passed')?'passed':'failed';
await writeFile(out+'/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,cases:report.cases,build:report.build.combinedSha256}));
if(report.status==='failed')process.exitCode=1;
