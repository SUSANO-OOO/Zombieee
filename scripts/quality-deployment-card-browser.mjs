import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import sharp from 'sharp';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';

const before=process.env.QUALITY_CARD_BEFORE==='1',out=path.resolve(process.env.QUALITY_CARD_OUT??`output/quality-20261028/deployment-card-${before?'before-r1':'after-r2'}`);
await mkdir(out,{recursive:true});
const engine=process.env.QUALITY_CARD_ENGINE??'chromium';assert.ok(['chromium','webkit'].includes(engine));
const report={scope:'Prepared S03 formation; native deployment, pause and resize. No combat result, time or resource injection; not physical touch acceptance.',engine,build:await productionBuildIdentity(),cases:[],errors:[]};
const groups=[['unit-babayaga','unit-hachi','unit-kumaverson','unit-crazy-king','unit-miyamoto-musashi','unit-paisen','unit-mayo-chan'],['unit-nao','unit-mizuchi','unit-monkey','unit-raider','unit-tatara','unit-gantetsu','unit-zakimiya'],['unit-tky','unit-mrs-chiha']];
let browser;
try{
 browser=await({chromium,webkit}[engine]).launch({headless:true});
 for(const [group,ids] of (before?groups.slice(0,1):groups).entries()) {
 const seed=normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,ownedUnitIds:ids,registeredUnitIds:ids,formationSlots:ids,availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,2),flowState:{phase:'formation',stageId:V100_STAGE_IDS[2],stageNumber:3,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
 const context=await browser.newContext({viewport:{width:844,height:340},hasTouch:true,recordVideo:{dir:path.join(out,'video'),size:{width:844,height:390}}});
 try{
  await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);await dismissInstallOffer(page,{timeout:20000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
  await page.waitForFunction(()=>{const state=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();return state?.running&&state.time>=.5&&document.documentElement.dataset.assetLoadState==='ready';});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const capture=async label=>{
   const cards=await page.locator('button.unit-card').evaluateAll(elements=>elements.map(el=>{
    const r=el.getBoundingClientRect();
    const pieces=[...el.querySelectorAll('.v100-deploy-name,.v100-deploy-cost,.v100-deploy-status,.v100-deploy-shortage')].map(piece=>{
     const b=piece.getBoundingClientRect();return{text:piece.textContent,left:b.left-r.left,top:b.top-r.top,right:b.right-r.left,bottom:b.bottom-r.top,width:b.width,height:b.height,clipped:piece.scrollWidth>piece.clientWidth+1};
    });
    const image=el.querySelector('img');
    return{kind:el.dataset.kind,state:el.dataset.state,label:el.getAttribute('aria-label'),width:r.width,height:r.height,text:el.innerText,pieces,imageLoaded:!!image?.complete&&image.naturalWidth>0};
   }));
   const png=await page.screenshot({path:path.join(out,`g${group}-${label}.png`)});report.cases.push({group,label,cards});
   if(label==='844x340-ready'){
    const r=await page.locator('button.unit-card').first().boundingBox();
    const stats=await sharp(png).extract({left:Math.ceil(r.x)+2,top:Math.ceil(r.y)+2,width:Math.floor(r.width)-4,height:Math.floor(r.height)-4}).stats();
    assert.ok(stats.channels.slice(0,3).some(c=>c.stdev>1),'Initial screenshot did not paint the card; DOM readiness alone is insufficient');
   }
   if(!before)for(const card of cards){
    assert.ok(card.width>=44&&card.height>=44,`${card.kind} touch target`);assert.equal(card.imageLoaded,true,`${card.kind} image`);
    for(const piece of card.pieces){assert.equal(piece.clipped,false,`${card.kind} clipped text: ${piece.text}`);assert.ok(piece.top>=0&&piece.left>=0&&piece.bottom<=card.height&&piece.right<=card.width,`${card.kind} text outside card: ${JSON.stringify(piece)}`);}
    for(let i=1;i<card.pieces.length;i++)assert.ok(card.pieces[i].top>=card.pieces[i-1].bottom-1,`${card.kind} overlapping rows`);
   }
  };
  await capture('844x340-ready');
  if(group===0){const baba=page.locator('button.unit-card[data-kind="babayaga"]');await baba.click();await page.waitForFunction(()=>document.querySelector('button.unit-card[data-kind="babayaga"]')?.dataset.state==='cooldown');await capture('844x340-cooldown');}
  if(!before){
   for(const viewport of [{width:844,height:390},{width:1280,height:720},{width:667,height:375},{width:844,height:340}]){
    await page.setViewportSize(viewport);await page.waitForTimeout(350);await capture(`${viewport.width}x${viewport.height}-resized`);
   }
   if(ids.length>3){
    await page.locator('.unit-cards').hover();await page.mouse.wheel(1000,0);
    await page.waitForFunction(()=>{const rail=document.querySelector('.unit-cards');return rail.scrollLeft>=rail.scrollWidth-rail.clientWidth-1;});await capture('scrolled-to-last');
    const last=await page.locator('button.unit-card').last().boundingBox(),rail=await page.locator('.unit-cards').boundingBox();assert.ok(last.x>=rail.x&&last.x+last.width<=rail.x+rail.width+1,'last card is reachable');
    await page.mouse.wheel(-1000,0);await page.waitForFunction(()=>document.querySelector('.unit-cards').scrollLeft===0);
   }
   await page.getByRole('button',{name:'一時停止',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('button.v100-deploy-card')].every(el=>el.dataset.state==='blocked'));await capture('paused');
   await page.getByRole('button',{name:'戦闘を再開',exact:true}).click();await capture('resumed');
   if(group===0){
    const baba=page.locator('button.unit-card[data-kind="babayaga"]');
    await page.waitForFunction(()=>Number(document.querySelector('button.unit-card[data-kind="babayaga"]')?.dataset.cooldown)===0,{},{timeout:30000});
    await capture('cooldown-finished');
    assert.ok(['insufficient','ready'].includes(await baba.getAttribute('data-state')));
    await page.waitForFunction(()=>document.querySelector('button.unit-card[data-kind="babayaga"]')?.dataset.state==='ready',{},{timeout:70000});
    await capture('command-recovered');await baba.click();
    await page.waitForFunction(()=>document.querySelector('button.unit-card[data-kind="babayaga"]')?.dataset.state==='cooldown');await capture('redeployed');
   }
  }
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
  for(const key of ['caps','ownedUnitIds','registeredUnitIds','formationSlots','receipts'])assert.deepEqual(saved[key],seed[key],key);
  await context.close();(report.videos??=[]).push(await page.video().path());report.savePreserved=true;
 }finally{await context.close();}
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.error=String(e);throw e;}
finally{await browser?.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,out,cases:report.cases.length}));
