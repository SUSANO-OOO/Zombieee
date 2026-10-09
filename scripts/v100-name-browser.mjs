import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {readNativeIndexedDb} from './native-indexeddb-evidence.mjs';
import {deserializeV100Save,serializeV100Save} from '../app/v100Save.js';

const origin=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);assert.ok(['127.0.0.1','localhost'].includes(origin.hostname));
const out=process.env.V100_NAME_EVIDENCE_DIR??'outputs/v100-name-browser';await mkdir(out,{recursive:false});
const source=process.env.V100_NAME_EARNED_SAVE,sourceBytes=await readFile(source),earned=JSON.parse(sourceBytes);
const report={status:'running',scope:'Fresh native name input plus exact earned save in separate profiles. Real UI rename/cancel/export/import/reload; no native-prompt replacement or save/actor setters. Reduced-height layout is not a physical keyboard test.',build:await productionBuildIdentity(),source:{path:source,sha256:createHash('sha256').update(sourceBytes).digest('hex')},cases:[]};
const keys=['nishijin-campaign-v100','nishijin-campaign-v100:mirror','nishijin-campaign-v100:last-known-good'];
const saveAt=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
const ready=page=>page.waitForFunction(()=>!document.querySelector('.v100-shell[aria-busy="true"]'));
async function click(page,name){await ready(page);await page.getByRole('button',{name,exact:true}).click();await ready(page);}
async function arrive(page){await page.goto(origin.href);await click(page,'ブラウザで遊ぶ');}
function unchangedExceptName(before,after){for(const key of Object.keys(before).filter(k=>!['playerName','revision','updatedAt'].includes(k)))assert.deepEqual(after[key],before[key],key);}
async function durable(page,expected){
 const evidence=await readNativeIndexedDb(page,'nishijin-campaign-v100');const current=evidence.database.stores.saves.find(r=>r.key==='current').value;
 assert.equal(current.format,1);const read=deserializeV100Save(current.serialized);assert.equal(read.ok,true);assert.deepEqual(read.save,expected);
 const mirrors=await page.evaluate(keys=>keys.map(key=>JSON.parse(localStorage.getItem(key))),keys);for(const mirror of mirrors)assert.deepEqual(mirror,expected);
 return {version:evidence.database.version,stores:Object.keys(evidence.database.stores),mirrorCount:mirrors.length,playerName:read.save.playerName,revision:read.save.revision};
}
try{for(const [engine,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch({headless:true});
 try{for(const [width,height] of [[1280,720],[844,390],[844,340]])for(const kind of ['fresh','rename']){
  const record={engine,width,height,kind,errors:[]};report.cases.push(record);
  const storageState=kind==='rename'?{cookies:[],origins:[{origin:origin.origin,localStorage:keys.map(name=>({name,value:serializeV100Save(earned)}))}]}:undefined;
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:width===844,storageState});const page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>record.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')record.errors.push(m.text());});page.on('requestfailed',r=>record.errors.push(r.url()+': '+r.failure()?.errorText));
  try{
   await arrive(page);const field=page.getByLabel('呼ばれたい名前',{exact:true});
   // The PWA offer can finish before the campaign's initial durable load.
   await (kind==='fresh'?field:page.getByRole('button',{name:'表示名を変更',exact:true})).waitFor();await ready(page);
   const before=await saveAt(page);
   if(kind==='rename'){await click(page,'表示名を変更');assert.equal(await page.locator('html').getAttribute('data-pwa-screen'),'event');}
   assert.equal(await field.getAttribute('maxlength'),null,'UTF-16 maxlength must not truncate valid 12-grapheme names');
   const submit=kind==='fresh'?'この名前で作戦を始める':'この名前に変更';
   await field.fill('👩‍🚒'.repeat(13));await click(page,submit);assert.match(await page.getByRole('alert').innerText(),/名前は12文字以内/u);assert.deepEqual(await saveAt(page),before);
   await field.fill('西新\u200D指揮官');await click(page,submit);assert.match(await page.getByRole('alert').innerText(),/使用できない文字/u);assert.deepEqual(await saveAt(page),before);
   if(kind==='fresh'){
    const name='👩‍🚒'.repeat(12);await field.fill(name);await click(page,submit);await page.locator('[data-v100-event-id="v100:event:prologue"]').waitFor();assert.equal((await saveAt(page)).playerName,name);
    await click(page,'次へ');await click(page,'次へ');assert.ok((await page.locator('[data-v100-event-id="v100:event:prologue"]').innerText()).includes(name));record.playerName=name;
   }else{
    await field.fill('変更を取消');await click(page,'変更せず戻る');assert.deepEqual(await saveAt(page),before);
    await click(page,'表示名を変更');assert.equal(await field.inputValue(),before.playerName);await click(page,'この名前に変更');assert.deepEqual(await saveAt(page),before,'Unchanged name does not create a mutation');
    await click(page,'表示名を変更');const name='西新👩‍🚒の指揮官';await field.fill(name);
    if(height===340){await page.setViewportSize({width,height:200});await field.scrollIntoViewIfNeeded();record.reducedHeightLayout=200;}
    await click(page,'この名前に変更');await page.getByRole('button',{name:'表示名を変更',exact:true}).waitFor();const after=await saveAt(page);assert.equal(after.playerName,name);unchangedExceptName(before,after);
    await page.setViewportSize({width,height});await page.reload();await click(page,'ブラウザで遊ぶ');await page.getByRole('button',{name:'表示名を変更',exact:true}).waitFor();assert.deepEqual(await saveAt(page),after);record.durable=await durable(page,after);
    await click(page,'データ管理');assert.ok((await page.getByRole('dialog',{name:'データ管理',exact:true}).innerText()).includes(name));
    if(height===340){
     const downloaded=page.waitForEvent('download');await click(page,'セーブを書き出す');const download=await downloaded;const file=out+'/'+engine+'-earned-name-export.json';await download.saveAs(file);const envelope=JSON.parse(await readFile(file,'utf8'));assert.deepEqual(JSON.parse(envelope.serialized),after);
     await page.locator('.v100-data-actions input[type=file]').setInputFiles(file);await page.getByText('選んだバックアップの残高と進行を復元しました。',{exact:true}).waitFor();await ready(page);const restored=await saveAt(page);unchangedExceptName(after,restored);assert.equal(restored.playerName,name);record.imported=await durable(page,restored);
    }
    record.completed=after.completedStageIds.length;record.caps=after.caps;
   }
   await page.screenshot({path:out+'/'+engine+'-'+width+'x'+height+'-'+kind+'.png'});assert.deepEqual(record.errors,[]);record.status='passed';
  }catch(error){record.status='failed';record.error=String(error);await page.screenshot({path:out+'/'+engine+'-'+kind+'-failure.png'}).catch(()=>{});throw error;}finally{await context.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
 }}finally{await browser.close();}
}report.status='passed';}catch(error){report.status='failed';report.error=String(error);process.exitCode=1;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,cases:report.cases.length,passed:report.cases.filter(c=>c.status==='passed').length,error:report.error}));}
