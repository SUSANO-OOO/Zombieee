import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_UNITS,V100_INITIAL_UNIT_IDS,V100_STAGE_IDS,v100StageReward,v100LevelCapForStage} from '../app/v100Registry.js';
import {purchaseV100Unit,upgradeV100Unit} from '../app/v100Transactions.js';
import {campaignUnitIdToCombatKind} from '../app/campaign.js';
import {seedV100BrowserSaveOnce,enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {nativeBattleTap} from './v100-normal-tactical-input.mjs';
import {createNormalBrowserDeadline,normalCleanupWithin,normalProtocolTimeoutReceipt} from './v177-normal-browser-deadline.mjs';

const engine=process.env.QUALITY_RECRUIT_ENGINE??'webkit',before=process.env.QUALITY_RECRUIT_BEFORE==='1',out=path.resolve(process.env.QUALITY_RECRUIT_OUT);
await fs.mkdir(out,{recursive:false});
const oldPrices={'unit-monkey':190,'unit-crazy-king':220,'unit-raider':240,'unit-tatara':260,'unit-gantetsu':280,'unit-mayo-chan':300,'unit-zakimiya':320,'unit-tky':340,'unit-mrs-chiha':370,'unit-miyamoto-musashi':400};
const report={engine,before,build:await productionBuildIdentity(process.env.QUALITY_RECRUIT_BUILD_ROOT),cases:[],errors:[],
 scope:'Prepared minimum-first-clear budget, not naturally earned campaign victories. Ordinary title, purchase, formation and deployment controls; unchanged stats/levels/equipment and real persistence. Silent video, no physical-device acceptance.'};
await fs.writeFile(path.join(out,'harness.mjs'),await fs.readFile(new URL(import.meta.url)),{flag:'wx'});
const browser=await({chromium,webkit}[engine]).launch({headless:true}),persist=()=>fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
try{for(const [stage,width,height] of before?[[10,844,340]]:[[10,844,340],[20,1280,720]]){
 const label=`s${stage}-${width}x${height}`,row={label,purchases:[],status:'running'};report.cases.push(row);
 const income=Array.from({length:stage},(_,i)=>v100StageReward(i+1,'first-clear')).reduce((a,b)=>a+b,0);
 let seed=normalizeV100Save({...createDefaultV100Save({settings:{bgmEnabled:false,sfxEnabled:false}}),campaignStarted:true,caps:income-50,
  levelCap:v100LevelCapForStage(stage),completedStageIds:V100_STAGE_IDS.slice(0,stage),availableStageIds:V100_STAGE_IDS.slice(0,stage+1),
  registeredUnitIds:V100_UNITS.filter(u=>u.availabilityStageNumber<=stage).map(u=>u.id),
  ownedSupportIds:['support-healing'],equippedSupportId:'support-healing',supportPurchaseUnlockedIds:['support-healing'],
  flowState:{phase:'formation',stageId:V100_STAGE_IDS[stage],stageNumber:stage+1,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
 for(const id of ['unit-nao','unit-mizuchi']){const r=purchaseV100Unit(seed,id);assert.equal(r.applied,true);seed=r.save;}
 for(const id of V100_INITIAL_UNIT_IDS){const r=upgradeV100Unit(seed,id,{targetLevel:3});assert.equal(r.applied,true);seed=r.save;}
 row.budget={minimumFirstClearIncome:income,reservedHealing:50,starterTraining:260,naoAndMizuchi:150,available:seed.caps};row.seed=seed;
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,serviceWorkers:'block',recordVideo:{dir:path.join(out,label),size:{width,height}}});
 const raw=await context.newPage(),guard=createNormalBrowserDeadline({timeoutMs:15000,onTimeout:error=>{row.operationTimeout=normalProtocolTimeoutReceipt(error);}}),page=guard.wrap(raw,'page');page.setDefaultTimeout(15000);
 page.on('pageerror',e=>report.errors.push({label,message:String(e)}));
 const ready=()=>page.waitForFunction(()=>document.querySelector('#v100-campaign')?.getAttribute('aria-busy')==='false'),saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
 const enter=async()=>{await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);await ready();};
 const focus=page.locator('.v100-unit-focus'),closeNotice=async()=>{const n=page.locator('.pwa-notice');if(await n.isVisible())await n.getByRole('button',{name:'閉じる',exact:true}).click();};
 try{
  await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));await page.goto(new URL('?phase-g=1',process.env.QUALITY_RECRUIT_URL).href);await enter();await closeNotice();
  await page.locator('.v100-command-tabs').getByRole('button',{name:'ユニット',exact:true}).click();
  const initial=await saved();let current=initial;
  const units=V100_UNITS.filter(u=>u.availabilityStageNumber>=4&&u.availabilityStageNumber<=stage);
  for(const unit of units){
   const back=focus.getByRole('button',{name:'ユニット一覧へ',exact:true});if(await back.isVisible())await back.click();
   await page.locator(`[data-personnel-unit="${unit.id}"]`).click();await ready();
   const price=before?oldPrices[unit.id]:unit.registrationCostCaps,canBuy=current.caps>=price;
   const button=focus.getByRole('button',{name:canBuy?`支度を整える / ${price} CAPS`:`あと ${price-current.caps} CAPS必要`,exact:true});
   assert.equal(await button.isEnabled(),canBuy);await button.scrollIntoViewIfNeeded();
   if(unit===units.at(-1))await page.screenshot({path:path.join(out,label+'-last-before.png')});
   if(canBuy){await button.click();await ready();const next=await saved();assert.equal(next.caps,current.caps-price);assert.equal(next.revision,current.revision+1);assert.ok(next.ownedUnitIds.includes(unit.id));current=next;}
   row.purchases.push({unitId:unit.id,price,purchased:canBuy,capsAfter:current.caps});await persist();
  }
  row.finalPurchaseSave=current;assert.equal(current.ownedUnitIds.length,before?9:stage===10?12:16);
  assert.equal(current.caps,before?75:stage===10?30:1165);
  for(const key of ['unitLevels','equipment','formationSlots','completedStageIds','bestStars','vehicle'])assert.deepEqual(current[key],initial[key],key);
  await page.screenshot({path:path.join(out,label+'-last-after.png')});
  await page.reload();await enter();assert.deepEqual(await saved(),current);row.reloadPreserved=true;await closeNotice();
  if(!before){
   await page.locator('.v100-command-tabs').getByRole('button',{name:'編成',exact:true}).click();
   await page.getByRole('button',{name:/^編成枠7 /}).click();
   const available=await page.locator('button[data-roster-unit]').evaluateAll(els=>els.map(e=>e.dataset.rosterUnit));
   for(const unit of units)assert.ok(available.includes(unit.id),unit.id+' can be assigned');row.available=available;
   const chosen=units.at(-1);await page.locator(`[data-roster-unit="${chosen.id}"]`).click();await ready();assert.equal((await saved()).formationSlots[6],chosen.id);
   await page.screenshot({path:path.join(out,label+'-formation.png')});await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
   await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running&&document.documentElement.dataset.assetLoadState==='ready');
   const kind=campaignUnitIdToCombatKind(chosen.id),card=page.locator(`button.unit-card[data-kind="${kind}"]`);
   await page.waitForFunction(kind=>{const card=document.querySelector(`button.unit-card[data-kind="${kind}"]`);return card&&!card.disabled&&card.getAttribute('aria-disabled')!=='true';},kind,{timeout:25000});
   assert.equal(await nativeBattleTap(page,card),true);await page.waitForFunction(kind=>window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.some(f=>f.kind===kind&&f.hp>0&&f.combatReady),kind);
   await page.waitForTimeout(2000);row.deployed=await page.evaluate(kind=>{const s=window.__ASHFALL_BATTLE_QA__.getSnapshot();const f=s.fighters.find(f=>f.kind===kind&&f.hp>0);return{time:s.time,kind:f?.kind,hp:f?.hp,combatReady:f?.combatReady};},kind);
   assert.equal(row.deployed.combatReady,true);await page.screenshot({path:path.join(out,label+'-deployed.png')});
  }
  row.status='passed';
 }catch(error){row.status='failed';row.error=String(error);await persist();throw error;}
 finally{await normalCleanupWithin(()=>context.close(),'context.close').catch(e=>{row.cleanupError=String(e);});await normalCleanupWithin(async()=>{row.video=await raw.video().path();},'video.path').catch(e=>{row.videoError=String(e);});await persist();}
 console.log(JSON.stringify({label,status:row.status,purchased:row.purchases.filter(p=>p.purchased).length,caps:row.finalPurchaseSave?.caps,deployed:row.deployed}));
}assert.deepEqual(report.errors,[]);report.status='passed';}
catch(error){report.status='failed';report.error=String(error);process.exitCode=1;}
finally{await normalCleanupWithin(()=>browser.close(),'browser.close').catch(e=>{report.cleanupError=String(e);});await persist();}
