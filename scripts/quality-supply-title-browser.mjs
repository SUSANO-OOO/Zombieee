import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {finishV100TitleIntro,enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {silenceBrowserOutput} from './silent-browser-output.mjs';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save,V100_PRIMARY_STORAGE_KEY} from '../app/v100Save.js';
import {V100_SUPPORTS,V100_VEHICLE,V100_STAGE_IDS} from '../app/v100Registry.js';
import {upgradeV100Vehicle} from '../app/v100Transactions.js';

const base=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(['127.0.0.1','localhost'].includes(base.hostname));
const out=path.resolve(process.env.QUALITY_SUPPLY_TITLE_OUT),engine=process.env.QUALITY_SUPPLY_TITLE_ENGINE??'chromium';
assert.ok(['chromium','webkit'].includes(engine));await mkdir(out,{recursive:false});
const sources=['app/V100Campaign.tsx','app/V100TitleScreen.tsx','app/v100SupplyTitleFinish.css'];
const sourceHashes=async()=>Object.fromEntries(await Promise.all(sources.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
const report={engine,scope:'Prepared phone UI saves, native inputs and durable purchase/equip/vehicle transactions. Includes blocked/locked/cap states. No earned progression, subjective audio or physical-phone acceptance.',build:await productionBuildIdentity(),sourceHashes:await sourceHashes(),cases:[],errors:[]};
await writeFile(path.join(out,'harness.mjs'),await readFile(new URL(import.meta.url)));
const noticeOnly=process.env.QUALITY_SUPPLY_TITLE_NOTICE_ONLY==='1';
report.selection=noticeOnly?'registration-failure notice layout only':'support transactions, title entry and notice layout';
const settings={bgmEnabled:false,sfxEnabled:true,reducedMotion:true};
const funded=normalizeV100Save({...createDefaultV100Save({settings}),caps:2000,campaignStarted:true,
  supportPurchaseUnlockedIds:V100_SUPPORTS.map(s=>s.id),ownedSupportIds:[],equippedSupportId:null,
  availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,22),
  flowState:{phase:'formation',stageId:V100_STAGE_IDS[22],stageNumber:23,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
let capped=normalizeV100Save({...funded,caps:100000});
for(let i=0;i<V100_VEHICLE.maxUpgradeLevel;i++){const next=upgradeV100Vehicle(capped);assert.equal(next.applied,true);capped=next.save;}
capped=normalizeV100Save({...capped,caps:0,supportPurchaseUnlockedIds:[V100_SUPPORTS[0].id]});
const ready=page=>page.waitForFunction(()=>document.documentElement.dataset.pwaSaveMutationPending==='false'&&!document.querySelector('.v100-shell[aria-busy="true"]'));
const save=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),V100_PRIMARY_STORAGE_KEY);
const shot=(page,id,suffix)=>page.screenshot({path:path.join(out,id+'-'+suffix+'.png')});
async function bounds(locator,min=0){
  const b=await locator.boundingBox();assert.ok(b&&b.width>=min-.5&&b.height>=min-.5,'Control or art exists at its required size');
  const viewport=locator.page().viewportSize();assert.ok(b.x>=-.5&&b.y>=-.5&&b.x+b.width<=viewport.width+.5&&b.y+b.height<=viewport.height+.5,JSON.stringify(b));return b;
}
async function titleGeometry(page){
  const geometry=await page.locator('.v100-start-screen').evaluate(screen=>{
    const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
    const controls=[...screen.querySelectorAll('button')].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(n).visibility!=='hidden';}).map(n=>({text:n.textContent,box:rect(n),noClip:n.scrollWidth<=n.clientWidth+1&&n.scrollHeight<=n.clientHeight+1}));
    const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>.5&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>.5;
    return {controls,overlaps:controls.flatMap((a,i)=>controls.slice(i+1).filter(b=>overlap(a.box,b.box)).map(b=>[a.text,b.text]))};
  });
  assert.ok(geometry.controls.length>=6);assert.deepEqual(geometry.overlaps,[]);
  const v=page.viewportSize();assert.ok(geometry.controls.every(c=>c.box.w>=43.5&&c.box.h>=43.5&&c.noClip&&c.box.x>=-.5&&c.box.y>=-.5&&c.box.x+c.box.w<=v.width+.5&&c.box.y+c.box.h<=v.height+.5),JSON.stringify(geometry));return geometry;
}
async function supportGeometry(page){
  await page.waitForFunction(()=>{const images=[...document.querySelectorAll('.v100-support-art img')];return images.length===3&&images.every(i=>i.complete&&i.naturalWidth>0);});
  const rows=await page.locator('[data-support-id][data-stock-state]').evaluateAll(cards=>cards.map(card=>{
    const r=card.getBoundingClientRect(),parts=[...card.querySelectorAll('h3,.v100-support-purpose,.v100-support-use,.v100-unlock-condition,.v100-support-card-footer')];
    return {id:card.dataset.supportId,state:card.dataset.stockState,parts:parts.map(n=>{const b=n.getBoundingClientRect();return {text:n.textContent,metrics:{clientWidth:n.clientWidth,scrollWidth:n.scrollWidth,clientHeight:n.clientHeight,scrollHeight:n.scrollHeight,display:getComputedStyle(n).display,lineHeight:getComputedStyle(n).lineHeight,flexShrink:getComputedStyle(n).flexShrink},withinCard:b.left>=r.left-.5&&b.right<=r.right+.5&&b.top>=r.top-.5&&b.bottom<=r.bottom+.5,noClip:n.scrollWidth<=n.clientWidth+1&&n.scrollHeight<=n.clientHeight+1};})};
  }));
  assert.equal(rows.length,3);assert.ok(rows.every(row=>row.parts.length>=4&&row.parts.every(p=>p.withinCard&&p.noClip)),JSON.stringify(rows));
  for(const button of await page.locator('.v100-support-card-footer button').all())await bounds(button,44);
  return rows;
}
const browser=await({chromium,webkit}[engine]).launch({headless:true});
async function run(id,viewport,seed,work,{registrationFailure=false}={}){
  const row={id,viewport,status:'running'};report.cases.push(row);
  const context=await browser.newContext({viewport,hasTouch:true}),page=await context.newPage();page.setDefaultTimeout(25000);
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  try{
    await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
    if(registrationFailure)await context.addInitScript(()=>{
      Object.defineProperty(navigator,'standalone',{configurable:true,get:()=>true});
      Object.defineProperty(navigator.serviceWorker,'register',{configurable:true,value:()=>Promise.reject(new Error('simulated registration rejection'))});
    });
    await silenceBrowserOutput(page);
    await page.goto(base.href,{waitUntil:'domcontentloaded'});
    if(registrationFailure){
      await page.getByRole('heading',{name:'スマホに保存する準備ができませんでした',exact:true}).waitFor();
      await page.getByRole('button',{name:'保存せずに試す',exact:true}).click();await page.locator('.pwa-notice').waitFor();
    }else await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});
    await finishV100TitleIntro(page);row.title=await titleGeometry(page);await shot(page,id,'title');
    await work(page,row);row.status='passed';
  }catch(error){row.status='failed';row.error=String(error);row.screen=await page.locator('body').innerText().catch(()=>null);await shot(page,id,'failure').catch(()=>{});throw error;}
  finally{await context.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
}
try{
  if(!noticeOnly){
  for(const viewport of [{width:844,height:340},{width:844,height:390},{width:740,height:360}]){
    const id=viewport.width+'x'+viewport.height+'-funded';
    await run(id,viewport,funded,async(page,row)=>{
      await page.getByRole('button',{name:'続きから',exact:true}).click();await page.locator('.v100-command-tabs').getByRole('button',{name:'支援',exact:true}).click();await ready(page);
      row.initialSupport=await supportGeometry(page);await shot(page,id,'shelf');
      const original=await save(page);let expectedCaps=original.caps;
      for(const support of V100_SUPPORTS){
        const card=page.locator(`[data-support-id="${support.id}"][data-stock-state]`);
        await card.getByRole('button',{name:support.unlockCostCaps+' CAPSで購入',exact:true}).click();
        await card.locator('button',{hasText:'装備'}).waitFor();await ready(page);expectedCaps-=support.unlockCostCaps;
        assert.equal((await save(page)).caps,expectedCaps);
        await card.getByRole('button',{name:'装備',exact:true}).click();await ready(page);await page.waitForFunction(id=>document.querySelector(`[data-support-id="${id}"][data-stock-state]`)?.dataset.stockState==='equipped',support.id);
        await card.getByRole('button',{name:'外す',exact:true}).click();await ready(page);assert.equal((await save(page)).equippedSupportId,null);
      }
      const first=page.locator(`[data-support-id="${V100_SUPPORTS[0].id}"][data-stock-state]`);await first.getByRole('button',{name:'装備',exact:true}).click();await ready(page);
      row.ownedSupport=await supportGeometry(page);await shot(page,id,'equipped');
      await page.locator('.v100-command-tabs').getByRole('button',{name:'車両',exact:true}).click();await page.locator('.v100-command-garage').waitFor();
      const upgrade=page.locator('.v100-vehicle-upgrade-copy > button');await bounds(upgrade,44);await bounds(page.locator('.v100-vehicle-upgrade-art img'));
      assert.equal(await page.locator('.v100-vehicle-abilities > div').count(),2);await shot(page,id,'garage');
      const old=await save(page),cost=V100_VEHICLE.upgradeCosts[old.vehicle.upgradeLevel];await upgrade.click();await ready(page);const changed=await save(page);
      assert.equal(changed.vehicle.upgradeLevel,old.vehicle.upgradeLevel+1);assert.equal(changed.vehicle.maxHp,old.vehicle.maxHp+V100_VEHICLE.hpPerUpgrade);assert.equal(changed.caps,expectedCaps-cost);
      for(const key of ['playerName','unitLevels','equipment','formationSlots','bestStars','completedStageIds','availableStageIds'])assert.deepEqual(changed[key],original[key]);
      const snapshot=structuredClone(changed);await page.reload({waitUntil:'domcontentloaded'});await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);await ready(page);
      const restored=await save(page);assert.equal(restored.caps,snapshot.caps);assert.deepEqual(restored.receipts,snapshot.receipts);assert.deepEqual(restored.vehicle,snapshot.vehicle);assert.equal(restored.equippedSupportId,V100_SUPPORTS[0].id);
      row.transactions={allThreePurchased:true,equipAndRemove:true,vehicleUpgraded:true,reloaded:true,noDuplicatePayout:true,caps:restored.caps};
    });
  }
  await run('740x360-limits',{width:740,height:360},capped,async(page,row)=>{
    await page.getByRole('button',{name:'続きから',exact:true}).click();await page.locator('.v100-command-tabs').getByRole('button',{name:'支援',exact:true}).click();await ready(page);
    row.support=await supportGeometry(page);assert.equal(row.support.filter(c=>c.state==='unaffordable').length,1);assert.equal(row.support.filter(c=>c.state==='locked').length,2);
    assert.equal(await page.locator('.v100-support-card-footer button:disabled').count(),1);await shot(page,row.id,'locked');
    const before=await save(page);await page.locator('.v100-command-tabs').getByRole('button',{name:'車両',exact:true}).click();await page.locator('.v100-command-garage').waitFor();
    const button=page.getByRole('button',{name:'強化上限',exact:true});assert.equal(await button.isDisabled(),true);await bounds(button,44);await shot(page,row.id,'garage-cap');assert.equal((await save(page)).caps,before.caps);
  });
  await run('740x360-fresh-title',{width:740,height:360},createDefaultV100Save({settings}),async(page,row)=>{
    assert.equal(await page.getByRole('button',{name:'続きから',exact:true}).isDisabled(),true);
    assert.equal(await page.getByRole('button',{name:/モード選択/}).isDisabled(),true);
    await page.getByRole('button',{name:'設定',exact:true}).click();await page.locator('.v100-player-menu').waitFor();await page.locator('.v100-player-menu .v100-panel-heading button').click();
    await page.getByRole('button',{name:'クレジット',exact:true}).click();const credits=page.getByRole('dialog',{name:'権利・クレジット',exact:true});await credits.waitFor();await credits.getByRole('button',{name:'閉じる',exact:true}).click();
    await page.getByRole('button',{name:'データ管理',exact:true}).click();const data=page.getByRole('dialog',{name:'データ管理',exact:true});await data.waitFor();await data.getByRole('button',{name:'閉じる',exact:true}).click();
    await page.getByRole('button',{name:'初めから',exact:true}).click();await page.waitForFunction(()=>{const root=document.querySelector('#v100-campaign');return root&&typeof root.dataset.v100Phase==='string'&&root.dataset.v100Phase!=='title';});row.entryAccepted=true;
  });
  }
  for(const viewport of [{width:844,height:340},{width:740,height:360}]){
    await run(viewport.width+'x'+viewport.height+'-notice',viewport,funded,async(page,row)=>{
      await page.evaluate(()=>document.fonts.ready);
      const notice=page.locator('.pwa-notice');await notice.waitFor();row.notice=await bounds(notice);
      row.warning=await notice.innerText();assert.match(row.warning,/オフライン用の設定に失敗しました/u);
      const overlap=(a,b)=>Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>.5&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>.5;
      for(const button of await page.locator('.v100-start-screen button:visible').all())assert.equal(overlap(await bounds(button,44),row.notice),false,'Notice must not cover a title control');
      const heading=page.locator('.v100-start-heading h1');row.heading=await bounds(heading);assert.equal(overlap(row.heading,row.notice),false,'Notice must not cover the wordmark');
      assert.equal(await heading.evaluate(n=>n.scrollWidth<=n.clientWidth+1&&n.scrollHeight<=n.clientHeight+1),true,'Wordmark must fit');
      const titleMenu=await page.locator('.v100-start-menu').boundingBox();assert.equal(overlap(row.heading,titleMenu),false,'Wordmark must not enter the menu');
      row.glyphs=await heading.evaluate(n=>{const range=document.createRange();range.selectNodeContents(n);const r=range.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
      assert.equal(overlap(row.glyphs,titleMenu),false);assert.equal(overlap(row.glyphs,row.notice),false);
      const close=notice.getByRole('button',{name:'閉じる',exact:true});await bounds(close,44);assert.equal(await close.evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true);
      const beforeDismiss=await page.evaluate(key=>localStorage.getItem(key),V100_PRIMARY_STORAGE_KEY);
      await shot(page,row.id,'warning');await close.click();await notice.waitFor({state:'hidden'});row.afterDismiss=await titleGeometry(page);
      assert.equal(await page.evaluate(key=>localStorage.getItem(key),V100_PRIMARY_STORAGE_KEY),beforeDismiss,'Closing an install notice must not change the save');await shot(page,row.id,'dismissed');
    },{registrationFailure:true});
  }
  assert.deepEqual(report.errors,[]);report.afterBuild=await productionBuildIdentity();assert.equal(report.afterBuild.combinedSha256,report.build.combinedSha256);assert.deepEqual(await sourceHashes(),report.sourceHashes);report.status='passed';
}catch(error){report.status='failed';report.failure=String(error);throw error;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,cases:report.cases.map(c=>({id:c.id,status:c.status}))}));
