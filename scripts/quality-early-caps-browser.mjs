import assert from'node:assert/strict';
import{readFile,mkdir,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import path from'node:path';
import{chromium,webkit}from'playwright';
import{normalizeV100Save,serializeV100Save,V100_PRIMARY_STORAGE_KEY}from'../app/v100Save.js';
import{enterV100FromTitle,seedV100BrowserSaveOnce}from'./v100-title-qa-entry.mjs';
import{dismissInstallOffer}from'./pwa-gate-qa.mjs';
import{deferNormalRecruitOffer}from'./v100-normal-recruit-offer.mjs';
import{productionBuildIdentity}from'./browser-qa-build-identity.mjs';

const before=process.env.QUALITY_EARLY_CAPS_BEFORE==='1',price=before?85:55;
const engine=process.env.QUALITY_EARLY_CAPS_ENGINE??'chromium';assert.ok(['chromium','webkit'].includes(engine));
const origin=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);assert.ok(['127.0.0.1','localhost'].includes(origin.hostname));
const out=path.resolve(process.env.QUALITY_EARLY_CAPS_OUT);await mkdir(out,{recursive:false});
const checkpoint='output/quality-20261028/early-caps-normal-s01-s03-r1/save-after-1.json',bytes=await readFile(checkpoint),seed=normalizeV100Save(JSON.parse(bytes));
assert.equal(seed.caps,112);assert.equal(seed.completedStageIds.length,1);assert.ok(seed.registeredUnitIds.includes('unit-nao'));assert.ok(!seed.ownedUnitIds.includes('unit-nao'));
const report={before,expectedPrice:price,build:await productionBuildIdentity(process.env.QUALITY_EARLY_CAPS_BUILD_ROOT??process.cwd()),checkpoint,checkpointSha256:createHash('sha256').update(bytes).digest('hex'),scope:'UI comparison importing the identical actually-earned S01 checkpoint into isolated contexts, without adding CAPS. Prior executable versus preparation-price change, native purchases and level control. Not a second fresh campaign run, all economy, audio listening or physical-device acceptance.',cases:[],errors:[]};
report.engine=engine;report.scope+=' Final layout checks include a single-line growth summary. WebKit audio listening is not part of this protocol.';
const browser=await({chromium,webkit}[engine]).launch({headless:true,...(engine==='chromium'?{args:['--mute-audio']}:{})});
try{
 for(const viewport of[{width:844,height:340},{width:1280,height:720}]){
  const label=viewport.width+'x'+viewport.height,row={label,transactions:[]};report.cases.push(row);
  const context=await browser.newContext({viewport,hasTouch:true,serviceWorkers:'block',recordVideo:{dir:path.join(out,label),size:viewport}});let page;
  try{
   await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
   await page.goto(origin.href);await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
   const saveAt=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),V100_PRIMARY_STORAGE_KEY),uiClick=async control=>{await control.click();await page.waitForFunction(()=>!document.querySelector('.v100-shell[aria-busy="true"]'));};
   await deferNormalRecruitOffer(page,{saveAt,uiClick,stageNumber:2,transactions:row.transactions});
   const offline=page.getByText('オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。',{exact:true});if(await offline.isVisible())await offline.locator('..').getByRole('button',{name:'閉じる',exact:true}).click();
   await uiClick(page.getByRole('navigation',{name:'ステージ準備メニュー',exact:true}).getByRole('button',{name:'ユニット',exact:true}));
   const select=async name=>{const back=page.getByRole('button',{name:'ユニット一覧へ',exact:true});if(await back.isVisible())await uiClick(back);await uiClick(page.locator('button.v100-personnel-card').filter({has:page.getByRole('heading',{name,exact:true})}));};
   await select('ナオ');const purchase=page.getByRole('button',{name:`${before?"出撃を解禁":"支度を整える"} / ${price} CAPS`,exact:true});await purchase.waitFor({state:'visible'});assert.equal(await purchase.isEnabled(),true);
   await page.screenshot({path:path.join(out,label+'-nao-before.png')});await uiClick(purchase);
   const joined=await saveAt();assert.equal(joined.caps,seed.caps-price);assert.ok(joined.ownedUnitIds.includes('unit-nao'));row.afterPurchaseCaps=joined.caps;
   await page.screenshot({path:path.join(out,label+'-nao-after.png')});await select('ババヤガ');
   if(!before){
    await page.evaluate(()=>document.fonts.ready);const summary=page.locator('.v100-unit-growth-notes summary');
    assert.equal(await summary.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);return range.getClientRects().length;}),1,'growth summary must not break across lines');
    const savedBeforeView=await saveAt(),views=page.getByRole('group',{name:'立ち絵の見方',exact:true});
    await uiClick(views.getByRole('button',{name:'全体',exact:true}));assert.equal(await page.locator('.v100-personnel-focus-art').getAttribute('data-portrait-view'),'whole');
    await page.screenshot({path:path.join(out,label+'-babayaga-whole.png')});await uiClick(views.getByRole('button',{name:'顔',exact:true}));
    assert.equal(await page.locator('.v100-personnel-focus-art').getAttribute('data-portrait-view'),'face');assert.deepEqual(await saveAt(),savedBeforeView,'portrait views preserve the exact save');row.portraitViewsPreserveSave=true;
   }
   const upgrade=before?page.getByRole('button',{name:/^あと\s*3\s*CAPS必要$/}):page.getByRole('button',{name:'Lv.2へ強化 / 30 CAPS',exact:true});await upgrade.waitFor({state:'visible'});row.upgradeEnabled=await upgrade.isEnabled();assert.equal(row.upgradeEnabled,!before);
   await page.screenshot({path:path.join(out,label+'-upgrade-before.png')});
   if(!before){await uiClick(upgrade);const upgraded=await saveAt();assert.equal(upgraded.caps,27);assert.equal(upgraded.unitLevels['unit-babayaga'],2);row.afterUpgradeCaps=upgraded.caps;await page.screenshot({path:path.join(out,label+'-upgrade-after.png')});}
   if(!before){
    await uiClick(page.getByRole('button',{name:'ユニット一覧へ',exact:true}));
    const hachi=page.locator('button.v100-personnel-card').filter({has:page.getByRole('heading',{name:'ハチ',exact:true})});assert.match(await hachi.innerText(),/最初から/u);
    const mayo=page.locator('button.v100-personnel-card').filter({has:page.getByRole('heading',{name:'マヨちゃん',exact:true})});assert.match(await mayo.innerText(),/S10クリア後/u);await uiClick(mayo);
    assert.match(await page.locator('.v100-focus-lock').innerText(),/第10作戦クリアで出撃の支度/u);
    await page.screenshot({path:path.join(out,label+'-mayo-locked.png')});row.initialHachiAndMayoStage10=true;
   }
   const saved=await saveAt();for(const key of['completedStageIds','bestStars','settings','equipment'])assert.deepEqual(saved[key],seed[key],key);
   assert.equal(saved.caps,27);assert.equal(saved.unitLevels['unit-babayaga'],before?1:2);row.status='passed';
  }catch(error){row.status='failed';row.error=String(error);if(page)await page.screenshot({path:path.join(out,label+'-failure.png')}).catch(()=>{});throw error;}
  finally{await context.close();if(page)row.video=await page.video().path();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.error=String(error);throw error;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,before,cases:report.cases.length}));
