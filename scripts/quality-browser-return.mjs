import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {finishV100TitleIntro,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';

const before=process.env.QUALITY_RETURN_BEFORE==='1';
const out=path.resolve(process.env.QUALITY_RETURN_OUT??`output/quality-20261028/browser-return-${before?'before':'after'}-r1`);
const choiceKey='nishijin:pwa-browser-choice:v1';
const engine=process.env.QUALITY_RETURN_ENGINE??'chromium',iphone=process.env.QUALITY_RETURN_IPHONE==='1';
assert.ok(['chromium','webkit'].includes(engine));
await mkdir(out,{recursive:true});
const report={engine,iphoneUserAgent:iphone,build:await productionBuildIdentity(),scope:'Native notice, install-offer choice, title, reload and data-screen controls. Prepared existing save separately from fresh origin. Not physical PWA installation or title audio listening.',cases:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true});
try{
 for(const profile of before||iphone?['fresh']:['fresh','existing','preference-storage-denied']){
  const context=await browser.newContext({viewport:{width:844,height:340},hasTouch:true,...(iphone?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{}),recordVideo:{dir:path.join(out,'video'),size:{width:844,height:340}}});
  try{
   if(profile==='existing')await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,caps:123})));
   if(profile==='preference-storage-denied')await context.addInitScript(key=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('QA preference storage denied','QuotaExceededError');return original.call(this,k,v);};},choiceKey);
   const page=await context.newPage();page.setDefaultTimeout(25000);page.on('pageerror',error=>report.errors.push(String(error)));
   const notice=async()=>{await page.locator('.fiction-notice').waitFor({state:'visible'});await page.getByRole('button',{name:'続ける',exact:true}).click();await page.locator('.fiction-notice').waitFor({state:'detached'});};
   await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);await notice();
   await page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true}).waitFor();await page.screenshot({path:path.join(out,`${profile}-first-offer.png`)});
   await page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true}).click();await finishV100TitleIntro(page);
   const initialSave=await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100'));
   const choice=await page.evaluate(key=>localStorage.getItem(key),choiceKey);
   if(!before)assert.equal(choice,profile==='preference-storage-denied'?null:'browser');
   await page.reload();await notice();
   const repeatedOffer=before||profile==='preference-storage-denied';
   if(repeatedOffer){await page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true}).waitFor();await page.screenshot({path:path.join(out,`${profile}-return-offer.png`)});await page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true}).click();}
   await finishV100TitleIntro(page);assert.equal(await page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true}).count(),0);await page.screenshot({path:path.join(out,`${profile}-return-title.png`)});
   if(!before){
    await page.getByRole('button',{name:'データ管理',exact:true}).click();
    await page.getByText('ホーム画面で遊ぶ',{exact:true}).click();await page.getByText(iphone?'右上の「追加」を押す':'「インストール」または「ホーム画面に追加」を押す',{exact:true}).waitFor();
    await page.locator('.pwa-return-install-help').scrollIntoViewIfNeeded();
    const help=await page.locator('.pwa-return-install-help').evaluate(el=>{const r=el.getBoundingClientRect(),frame=el.closest('.v100-data-scroll').getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,frameTop:frame.top,frameBottom:frame.bottom};});
    assert.ok(help.top>=help.frameTop-1&&help.bottom<=help.frameBottom+1,`install instructions must fit the data panel: ${JSON.stringify(help)}`);
    assert.equal(await page.getByText('オフライン未保存',{exact:true}).count(),1);assert.equal(await page.getByText('不足・破損',{exact:true}).count(),0);
    await page.screenshot({path:path.join(out,`${profile}-install-help.png`)});
   }
   const saved=await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100'));assert.equal(saved,initialSave,'navigation preserves the complete save bytes');
   await context.close();report.cases.push({profile,repeatedOffer,choice,saveBytesUnchanged:true,video:await page.video().path()});
  }finally{await context.close();}
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.error=String(error);throw error;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,cases:report.cases.length,out}));
