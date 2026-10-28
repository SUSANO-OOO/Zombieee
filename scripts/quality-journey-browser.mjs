import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pwaBrowserType} from './pwa-browser-runtime.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {finishV100TitleIntro} from './v100-title-qa-entry.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';

const url=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
const out=path.resolve(process.env.QUALITY_JOURNEY_OUT??'output/quality-20261028/journey-r1');
await mkdir(out,{recursive:true});
const report={scope:'Automated Chromium normal UI, fresh isolated saves. Not physical touch or subjective audio acceptance.',build:await productionBuildIdentity(),cases:[],errors:[]};
const browser=await (await pwaBrowserType('chromium')).launch({headless:true});
try {
  for(const viewport of [{width:844,height:390},{width:844,height:340},{width:1280,height:720}]) {
    const label=`${viewport.width}x${viewport.height}`;
    const context=await browser.newContext({viewport,hasTouch:viewport.width===844,recordVideo:{dir:path.join(out,label),size:viewport}});
    const page=await context.newPage();page.setDefaultTimeout(15000);
    page.on('pageerror',e=>report.errors.push(String(e)));
    page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
    const row={viewport,screens:[]};report.cases.push(row);
    const shot=async name=>{await page.screenshot({path:path.join(out,`${label}-${name}.png`)});row.screens.push(name);};
    const ready=()=>page.locator('#v100-campaign[aria-busy="false"]').waitFor();
    const click=async name=>{await ready();await page.getByRole('button',{name,exact:true}).click();};
    const stored=()=>page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100'));
    try {
      await page.goto(url.href);await dismissInstallOffer(page,{timeout:20000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});
      await finishV100TitleIntro(page);await shot('title');
      const original=await stored();await click('クレジット');
      await page.getByRole('dialog').getByRole('heading',{name:'権利・クレジット',exact:true}).waitFor();
      assert.equal(await page.getByRole('button',{name:'スタッフロールをもう一度見る',exact:true}).count(),0);
      await shot('rights');await page.getByRole('dialog').getByRole('button',{name:'閉じる',exact:true}).click();
      assert.equal(await stored(),original,'Reading rights must not alter a save');
      await click('初めから');await page.getByLabel('呼ばれたい名前',{exact:true}).fill('品質確認');
      await click('この名前でステージを始める');
      for(let i=0;i<3;i++){await ready();await page.locator('.v100-event-actions .v100-primary').click();}
      await ready();await page.waitForFunction(()=>[...document.querySelectorAll('.v100-event-panel img')].every(img=>img.complete));
      await shot('story');
      const before=await stored();const cursor=await page.locator('.v100-event-layout').getAttribute('data-v100-node-index');
      await click('読み返す');await page.getByRole('heading',{name:'ここまでの会話',exact:true}).waitFor();
      assert.ok(await page.locator('.v100-current-transcript li').count()>0);await shot('transcript');
      await page.getByRole('dialog').getByRole('button',{name:'閉じる',exact:true}).click();
      assert.equal(await stored(),before,'Transcript must not change cursor, receipts, settings, or revision');
      assert.equal(await page.locator('.v100-event-layout').getAttribute('data-v100-node-index'),cursor);
      row.portraits=[];
      for(let steps=0;steps<85 && row.portraits.length<2;steps++) {
        await ready();
        const images=await page.locator('.v100-event-panel img').evaluateAll(items=>items.map(img=>({src:img.getAttribute('src'),naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight})));
        for(const kind of ['kumaverson','babayaga']) {
          const found=images.find(img=>img.src?.includes(`/portraits/${kind}-`)&&img.src?.includes('-r3.webp')&&img.naturalWidth>0);
          if(found&&!row.portraits.some(img=>img.kind===kind)){
            await page.waitForFunction(k=>[...document.querySelectorAll('.v100-event-panel img')].some(img=>
              img.getAttribute('src')?.includes(`/portraits/${k}-`) && img.naturalWidth>0
              && Number(getComputedStyle(img).opacity)>.98 && img.getAnimations().every(a=>a.playState==='finished')
              && img.getBoundingClientRect().height>100),kind);
            row.portraits.push({kind,...found});await shot(kind);
          }
        }
        if(row.portraits.length<2)await page.locator('.v100-event-actions .v100-primary').click();
      }
      assert.equal(row.portraits.length,2,'Both new identities must actually load in the dialogue UI');
      row.status='passed';
    } catch(error) {row.status='failed';row.error=String(error);await shot('failure');}
    finally {await context.close();}
  }
} finally {await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
assert.equal(report.errors.length,0,report.errors.join('\n'));
assert.ok(report.cases.every(row=>row.status==='passed'),JSON.stringify(report.cases.filter(row=>row.status!=='passed')));
console.log(JSON.stringify({status:'passed',cases:report.cases.length,out}));
