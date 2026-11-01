import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';import {V100_STAGE_IDS,V100_UNITS} from '../app/v100Registry.js';
import {MANUAL_ABILITY_REGISTRY,selectManualAbilityTarget,canActivateManualAbility} from '../app/manualAbilities.js';
const base=new URL(process.env.QUALITY_TACTICS_URL);assert.ok(['localhost','127.0.0.1'].includes(base.hostname));
const root=path.resolve(process.env.QUALITY_TACTICS_ROOT),out=path.resolve(process.env.QUALITY_TACTICS_OUT),engine=process.env.QUALITY_TACTICS_ENGINE??'webkit',before=process.env.QUALITY_TACTICS_BEFORE==='1';
const viewport=engine==='webkit'?{width:844,height:340}:{width:1280,height:720};await mkdir(out,{recursive:false});
const driver=await readFile(new URL(import.meta.url));await writeFile(out+'/executed-driver.mjs',driver);
const report={engine,before,viewport,build:await productionBuildIdentity(root),scriptSha256:createHash('sha256').update(driver).digest('hex'),scope:'Prepared groups of four using existing localhost proof. Native pause, open/scroll, resume and ability click. Read-only paused inspection; not natural progression, performance or physical acceptance.',cases:[],errors:[]};
const groups=Object.keys(MANUAL_ABILITY_REGISTRY).reduce((groups,kind,index)=>{if(index%4===0)groups.push([]);groups.at(-1).push(kind);return groups;},[]);
const browser=await({chromium,webkit}[engine]).launch({headless:true});
try{for(const [index,kinds] of (before?groups.slice(0,1):groups).entries()){
 const row={index,kinds,requests:[]};report.cases.push(row);const ids=V100_UNITS.map(u=>u.id);
 const seed=normalizeV100Save({...createDefaultV100Save({settings:{bgmEnabled:false}}),campaignStarted:true,ownedUnitIds:ids,registeredUnitIds:ids,
  formationSlots:[...kinds.map(k=>MANUAL_ABILITY_REGISTRY[k].unitId),null,null,null],completedStageIds:V100_STAGE_IDS.slice(0,22),availableStageIds:V100_STAGE_IDS,
  flowState:{phase:'formation',destination:'formation',stageId:V100_STAGE_IDS[0],stageNumber:1,eventId:null,nodeIndex:0,firstClear:false,finalized:true}});
 const context=await browser.newContext({viewport,hasTouch:true,recordVideo:{dir:path.join(out,'video-'+index),size:viewport}});await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
 const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(String(e)));page.on('requestfailed',r=>row.requests.push({url:r.url(),error:r.failure()}));
 try{
 await page.goto(base.href,{waitUntil:'domcontentloaded'});await dismissInstallOffer(page,{timeout:30000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
 await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running&&document.documentElement.dataset.assetLoadState==='ready');
 for(const kind of [...kinds,'walker','runner','spitter','crusher'])await page.evaluate(k=>window.__ASHFALL_BATTLE_QA__.ensureUnitRenderProofAsset(k),kind);
 row.setup=await page.evaluate(k=>window.__ASHFALL_BATTLE_QA__.prepareManualAbilityProof(k),kinds);
 const notice=page.getByText('オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。',{exact:true});if(await notice.isVisible())await notice.locator('..').getByRole('button',{name:'閉じる',exact:true}).click();
 await page.getByRole('button',{name:'一時停止',exact:true}).click();await page.getByRole('dialog',{name:'一時停止メニュー',exact:true}).waitFor();
 row.saveBefore=await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100'));
 row.paused=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__.getSnapshot();return{time:s.time,paused:s.paused,fighters:s.fighters.map(({id,kind,side,hp,maxHp,x,y,lane,speed,stunned,combatReady,gateEntering,contained,manualAbility})=>({id,kind,side,hp,maxHp,x,y,lane,speed,stunned,combatReady,gateEntering,contained,manualAbility})),receipts:s.manualAbilityReceipts};});
 assert.equal(row.paused.paused,true);
 if(before){assert.equal(await page.locator('.manual-tactics').count(),0);await page.screenshot({path:out+'/before-pause.png'});}
 else{
  const summary=page.locator('.manual-tactics > summary');await summary.click();row.rows=[];
  for(const id of row.setup.ownerIds){const article=page.locator('[data-tactics-owner="'+id+'"]');await article.scrollIntoViewIfNeeded();
   const observed=await article.evaluate(e=>({text:e.innerText,kind:e.getAttribute('data-tactics-kind'),rect:{x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height},overflow:e.scrollWidth>e.clientWidth+1}));
   const owner=row.paused.fighters.find(f=>f.id===id),available=canActivateManualAbility({fighter:owner,fighters:row.paused.fighters});
   const resumeRect=await page.getByRole('button',{name:'戦闘を再開',exact:true}).boundingBox();assert.ok(resumeRect&&resumeRect.y>=0&&resumeRect.y+resumeRect.height<=viewport.height);assert.ok(resumeRect.height>=44);
   assert.equal(observed.kind,owner.kind);assert.ok(observed.text.includes(MANUAL_ABILITY_REGISTRY[owner.kind].summary));assert.equal(observed.overflow,false);assert.ok(observed.rect.x>=0&&observed.rect.x+observed.rect.width<=viewport.width);
   if(available)assert.ok(observed.text.includes('再開後に使える'));row.rows.push({id,kind:owner.kind,text:observed.text,available,target:selectManualAbilityTarget({owner,fighters:row.paused.fighters}),rect:observed.rect});
   await page.screenshot({path:out+'/'+index+'-'+owner.kind+'-inspection.png'});
  }
  const later=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__.getSnapshot();return{time:s.time,receipts:s.manualAbilityReceipts};});assert.equal(later.time,row.paused.time);assert.deepEqual(later.receipts,row.paused.receipts);
  await page.getByRole('button',{name:'戦闘を再開',exact:true}).click();assert.equal(await page.locator('.manual-tactics').count(),0);
  const ownerId=row.setup.ownerIds[0];await page.locator('.manual-ability-ready[data-fighter-id="'+ownerId+'"]').click();
  await page.waitForFunction(id=>window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(f=>f.id===id)?.manualAbility?.activationId>0,ownerId);
  await page.waitForTimeout(900);await page.getByRole('button',{name:'一時停止',exact:true}).click();await page.locator('.manual-tactics > summary').click();
  const actor=page.locator('[data-tactics-owner="'+ownerId+'"]');await actor.scrollIntoViewIfNeeded();row.afterUse=await actor.innerText();assert.match(row.afterUse,/あと\d+秒|発動中/);assert.ok(!row.afterUse.includes('再開後に使える'));
  await page.screenshot({path:out+'/'+index+'-after-use.png'});
  if(index===0){
   await page.getByRole('button',{name:'戦闘を再開',exact:true}).click();await page.locator('.support-btn.airstrike').click();
   await page.getByRole('button',{name:'一時停止',exact:true}).click();await page.locator('.manual-tactics > summary').click();
   const scout=page.locator('[data-tactics-kind="scout"]');await scout.scrollIntoViewIfNeeded();row.supportSelected=await scout.innerText();assert.ok(row.supportSelected.includes('先に支援の狙いを取り消す'));assert.equal(await page.locator('.manual-tactics .ready').count(),0);
   await page.screenshot({path:out+'/support-selected.png'});
   await page.getByRole('button',{name:'戦闘を再開',exact:true}).click();await page.locator('.support-btn.airstrike').click();
   await page.getByRole('button',{name:'一時停止',exact:true}).click();await page.locator('.manual-tactics > summary').click();
   await scout.scrollIntoViewIfNeeded();row.supportCancelled=await scout.innerText();assert.ok(row.supportCancelled.includes('再開後に使える'));await page.screenshot({path:out+'/support-cancelled.png'});
  }
 }
 assert.equal(await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100')),row.saveBefore);assert.deepEqual(row.requests,[]);row.status='passed';
 }catch(e){row.status='failed';row.error=String(e);await page.screenshot({path:out+'/'+index+'-failure.png'}).catch(()=>{});throw e;}
 finally{await context.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}
}assert.deepEqual(report.errors,[]);report.status='passed';}
finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,engine,before,cases:report.cases.length,kinds:report.cases.flatMap(c=>c.kinds)}));
