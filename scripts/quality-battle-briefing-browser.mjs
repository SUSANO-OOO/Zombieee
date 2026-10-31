import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {enterV100FromTitle,finishV100TitleIntro,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const engine=process.env.QUALITY_BRIEFING_ENGINE??'chromium';assert.ok(['chromium','webkit'].includes(engine));
const out=path.resolve(process.env.QUALITY_BRIEFING_OUT??`output/quality-20261028/briefing-${engine}-r1`);await mkdir(out,{recursive:true});
const report={engine,scope:'Prepared S01/S02/S25 formation fixtures; native help controls, viewport resize, focus and save preservation. Not natural campaign, gameplay victory or physical touch acceptance.',build:await productionBuildIdentity(),cases:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true});
try{
 for(const stage of [1,2,25]){
  const seed=normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,availableStageIds:V100_STAGE_IDS,flowState:{phase:'formation',stageId:V100_STAGE_IDS[stage-1],stageNumber:stage,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
  const context=await browser.newContext({viewport:{width:844,height:340},hasTouch:true,recordVideo:{dir:path.join(out,'video'),size:{width:844,height:390}}});
  try{
   await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
   await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);await dismissInstallOffer(page,{timeout:20000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
   const saveBefore=await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100'));
   const opener=page.getByRole('button',{name:'作戦と戦い方',exact:true});await opener.click();
   const dialog=page.getByRole('dialog',{name:'作戦と戦い方',exact:true});await dialog.waitFor();
   assert.equal(await dialog.getByRole('button',{name:stage===1?'戦い方':'作戦',exact:true}).getAttribute('aria-pressed'),'true');
   await dialog.getByRole('button',{name:'戦い方',exact:true}).click();
   const geometry=[];
   for(const viewport of [{width:844,height:340},{width:844,height:390},{width:1280,height:720},{width:667,height:375}]){
    await page.setViewportSize(viewport);await page.waitForTimeout(150);
    const measured=await dialog.evaluate(el=>{const r=el.getBoundingClientRect(),body=el.querySelector('.v100-briefing-page');return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,bodyHeight:body.clientHeight,bodyScroll:body.scrollHeight,buttons:[...el.querySelectorAll('button')].map(b=>{const p=b.getBoundingClientRect();return {label:b.textContent,width:p.width,height:p.height};})};});
    assert.ok(measured.left>=0&&measured.top>=0&&measured.right<=viewport.width&&measured.bottom<=viewport.height,JSON.stringify(measured));assert.ok(measured.bodyScroll<=measured.bodyHeight+1,'all three controls should fit without an inner scroll');assert.ok(measured.buttons.every(b=>b.width>=44&&b.height>=44));geometry.push({viewport,...measured});
    await page.screenshot({path:path.join(out,`s${stage}-controls-${viewport.width}x${viewport.height}.png`)});
   }
   await page.setViewportSize({width:844,height:340});await dialog.getByRole('button',{name:'作戦',exact:true}).click();
   const planText=await dialog.locator('.v100-briefing-plan').innerText();
   if(stage===1){assert.match(planText,/鉄鍋仁王立ち/u);assert.match(planText,/自分のHP/u);}
   if(stage===25)assert.match(planText,/変異ムガリアン社長/u);
   assert.doesNotMatch(planText,/射撃と回復で|回復支援で持ちこたえる/u);
   const diagram=await dialog.locator('.v100-mission-diagram').evaluate(el=>{const r=el.getBoundingClientRect(),parent=el.parentElement.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,parent:{top:parent.top,bottom:parent.bottom,left:parent.left,right:parent.right}};});
   assert.ok(diagram.top>=diagram.parent.top&&diagram.bottom<=diagram.parent.bottom&&diagram.left>=diagram.parent.left&&diagram.right<=diagram.parent.right,'mission diagram must stay in its plan column, outside the modal header');
   await page.screenshot({path:path.join(out,`s${stage}-plan.png`)});
   await dialog.locator('.v100-briefing-advice').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`s${stage}-advice.png`)});
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('.v100-battle-briefing')),true);
   await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await opener.evaluate(el=>el===document.activeElement),true,'restore opener focus');
   await opener.click();await dialog.getByRole('button',{name:'閉じる',exact:true}).click();await dialog.waitFor({state:'detached'});assert.equal(await page.getByRole('button',{name:'戦闘へ',exact:true}).evaluate(el=>!!el.closest('[inert]')),false);
   assert.equal(await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100')),saveBefore);
   await context.close();report.cases.push({stage,geometry,planText,saveBytesUnchanged:true,video:await page.video().path()});
  }finally{await context.close();}
 }
 const modeSeed=normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,flowState:{phase:'map',stageId:null,stageNumber:1,eventId:null,destination:'map',nodeIndex:0,firstClear:false,finalized:true}});
 const modeContext=await browser.newContext({viewport:{width:844,height:340},hasTouch:true});
 try{
  await modeContext.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(modeSeed));const page=await modeContext.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);await dismissInstallOffer(page,{timeout:20000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await finishV100TitleIntro(page);
  await page.locator('.v100-start-modes').click();await page.locator('.v100-mode-outbreak').click();await page.getByRole('button',{name:'出撃編成を変更',exact:true}).click();
  const saveBefore=await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100'));
  const opener=page.getByRole('button',{name:'編成の確認',exact:true});await opener.click();const dialog=page.getByRole('dialog',{name:'編成の確認',exact:true});await dialog.waitFor();
  assert.equal(await dialog.getByRole('button',{name:'戦い方',exact:true}).count(),0);assert.equal(await dialog.locator('.v100-battle-instructions').count(),0);
  await page.screenshot({path:path.join(out,'mode-preparation.png')});await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await opener.evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100')),saveBefore);report.cases.push({modePreparation:true,normalBattleInstructionsAbsent:true,saveBytesUnchanged:true});
 }finally{await modeContext.close();}
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.error=String(error);throw error;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,cases:report.cases.length,out}));
