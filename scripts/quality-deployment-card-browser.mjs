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
await mkdir(out,{recursive:false});
const engine=process.env.QUALITY_CARD_ENGINE??'chromium';assert.ok(['chromium','webkit'].includes(engine));
const report={scope:'Prepared muted S03 formation; native deployment, pause and resize, service workers blocked. No combat result, time or resource injection; not physical touch or installed-PWA acceptance.',engine,build:await productionBuildIdentity(process.env.QUALITY_CARD_BUILD_ROOT??process.cwd()),cases:[],errors:[]};
const groups=[['unit-babayaga','unit-hachi','unit-kumaverson','unit-crazy-king','unit-miyamoto-musashi','unit-paisen','unit-mayo-chan'],['unit-nao','unit-mizuchi','unit-monkey','unit-raider','unit-tatara','unit-gantetsu','unit-zakimiya'],['unit-tky','unit-mrs-chiha']];
let browser;
try{
 browser=await({chromium,webkit}[engine]).launch({headless:true});
 for(const [group,ids] of (before?groups.slice(0,1):groups).entries()) {
 const seed=normalizeV100Save({...createDefaultV100Save({settings:{bgmEnabled:false,sfxEnabled:false}}),campaignStarted:true,ownedUnitIds:ids,registeredUnitIds:ids,formationSlots:ids,availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,2),flowState:{phase:'formation',stageId:V100_STAGE_IDS[2],stageNumber:3,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
 const context=await browser.newContext({viewport:{width:844,height:340},hasTouch:true,serviceWorkers:'block',recordVideo:{dir:path.join(out,'video'),size:{width:844,height:390}}});
 try{
  await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);await dismissInstallOffer(page,{timeout:20000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
  const offline=page.getByText('オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。',{exact:true});if(await offline.isVisible())await offline.locator('..').getByRole('button',{name:'閉じる',exact:true}).click();
  await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
  await page.waitForFunction(()=>{const state=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();return state?.running&&state.time>=.5&&document.documentElement.dataset.assetLoadState==='ready';});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.evaluate(()=>document.fonts.ready);
  const readCards=()=>page.locator('button.unit-card').evaluateAll(elements=>elements.map(el=>{
    const r=el.getBoundingClientRect();
    const pieces=[...el.querySelectorAll('.v100-deploy-name,.v100-deploy-cost,.v100-deploy-status,.v100-deploy-shortage')].map(piece=>{
     const b=piece.getBoundingClientRect(),style=getComputedStyle(piece),range=document.createRange();range.selectNodeContents(piece);const ink=range.getBoundingClientRect();return{text:piece.textContent,left:b.left-r.left,top:b.top-r.top,right:b.right-r.left,bottom:b.bottom-r.top,width:b.width,height:b.height,clipped:piece.scrollWidth>piece.clientWidth+1,font:style.font,lineHeight:style.lineHeight,flexShrink:style.flexShrink,textRange:{top:ink.top-r.top,bottom:ink.bottom-r.top,left:ink.left-r.left,right:ink.right-r.left}};
    });
    const image=el.querySelector('img');
    return{kind:el.dataset.kind,state:el.dataset.state,label:el.getAttribute('aria-label'),width:r.width,height:r.height,text:el.innerText,pieces,imageLoaded:!!image?.complete&&image.naturalWidth>0};
   }));
  const checkLayout=cards=>{
   for(const card of cards){
    assert.ok(card.width>=44&&card.height>=44,`${card.kind} touch target`);assert.equal(card.imageLoaded,true,`${card.kind} image`);
    for(const piece of card.pieces){assert.equal(piece.clipped,false,`${card.kind} clipped text: ${piece.text}`);assert.ok(piece.top>=0&&piece.left>=0&&piece.bottom<=card.height&&piece.right<=card.width,`${card.kind} text outside card: ${JSON.stringify(piece)}`);}
    for(let i=0;i<card.pieces.length;i++)for(let j=i+1;j<card.pieces.length;j++){
     const a=card.pieces[i],b=card.pieces[j],width=Math.min(a.right,b.right)-Math.max(a.left,b.left),height=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
     assert.ok(width<=1||height<=1,`${card.kind} overlapping text: ${a.text} / ${b.text}`);
    }
   }
  };
  const capture=async label=>{
   const cards=await readCards();
   const field=await page.locator('canvas').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}).filter(r=>r.width>0&&r.height>0).sort((a,b)=>b.width*b.height-a.width*a.height)[0]);
   const png=await page.screenshot({path:path.join(out,`g${group}-${label}.png`)});report.cases.push({group,label,cards,field});
   if(label==='844x340-ready'){
    const r=await page.locator('button.unit-card').first().boundingBox();
    const stats=await sharp(png).extract({left:Math.ceil(r.x)+2,top:Math.ceil(r.y)+2,width:Math.floor(r.width)-4,height:Math.floor(r.height)-4}).stats();
    assert.ok(stats.channels.slice(0,3).some(c=>c.stdev>1),'Initial screenshot did not paint the card; DOM readiness alone is insufficient');
   }
   if(!before)checkLayout(cards);
  };
  await capture('844x340-ready');
  if(group===0){const baba=page.locator('button.unit-card[data-kind="babayaga"]');await baba.click();await page.waitForFunction(()=>document.querySelector('button.unit-card[data-kind="babayaga"]')?.dataset.state==='cooldown');await capture('844x340-cooldown');}
  for(const kind of await page.locator('button.unit-card').evaluateAll(nodes=>nodes.map(el=>el.dataset.kind))){
   const card=page.locator(`button.unit-card[data-kind="${kind}"]`);await card.evaluate(el=>el.scrollIntoView({block:'nearest',inline:'center',behavior:'auto'}));
   await page.waitForFunction(kind=>{const r=document.querySelector(`button.unit-card[data-kind="${kind}"]`).getBoundingClientRect(),rail=document.querySelector('.unit-cards').getBoundingClientRect();return r.x>=rail.x-1&&r.right<=rail.right+1;},kind,{timeout:2000});
   const box=await card.boundingBox(),rail=await page.locator('.unit-cards').boundingBox();assert.ok(box.x>=rail.x-1&&box.x+box.width<=rail.x+rail.width+1,`${kind}: full card visible`);await capture(`focus-${kind}`);
  }
  await page.locator('button.unit-card').first().scrollIntoViewIfNeeded();
  if(!before){
   if(group===0)for(const [id,css,expected]of[
    ['overlap','.v100-shell .game-frame .v100-deploy-cost{position:absolute!important;left:2px!important;top:1px!important}',/overlapping text/u],
    ['outside','.v100-shell .game-frame .v100-deploy-status{transform:translateX(400px)!important}',/text outside card/u],
   ]){
    const style=await page.addStyleTag({content:css});try{const badCards=await readCards();assert.throws(()=>checkLayout(badCards),expected);}
    finally{await style.evaluate(el=>el.remove());}
    (report.negativeControls??=[]).push({id,status:'rejected'});await capture('restored-'+id);
   }
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
