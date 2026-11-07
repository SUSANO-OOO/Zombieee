import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {silenceBrowserOutput} from './silent-browser-output.mjs';
const base=process.env.PWA_FINAL_CACHE_RETRY_BASE_URL ?? process.env.PWA_REGISTRATION_FALLBACK_BASE_URL ?? process.env.V096_PWA_QA_BASE_URL;
assert.ok(base);
const out=process.env.PWA_FINAL_CACHE_RETRY_OUTPUT ? path.resolve(process.env.PWA_FINAL_CACHE_RETRY_OUTPUT) : null;
if(out) await fs.mkdir(out,{recursive:false});
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:844,height:340},hasTouch:true,isMobile:true});
const page=await context.newPage();await silenceBrowserOutput(page);
const shipped=await(await fetch(new URL('asset-manifest.json',base))).json();
const small={...shipped,assets:[...shipped.assets].sort((a,b)=>a.bytes-b.bytes).slice(0,3).map(a=>Object.fromEntries(Object.entries(a).filter(([k])=>!k.startsWith('bundle'))))};
await page.addInitScript(({small,base})=>{
 Object.defineProperty(navigator,'standalone',{configurable:true,get:()=>true});
 const fetchOriginal=window.fetch.bind(window),assetUrls=new Set(small.assets.map(a=>new URL(a.path.replace(/^\/+/,''),base).href));
 window.__pwaAssetFetches=0;window.__pwaCacheReadFailures=0;
 window.fetch=(...args)=>{
  const url=new URL(typeof args[0]==='string'?args[0]:args[0].url,location.href);
  if(url.pathname.endsWith('/asset-manifest.json'))return Promise.resolve(new Response(JSON.stringify(small),{headers:{'content-type':'application/json'}}));
  if(assetUrls.has(url.href))window.__pwaAssetFetches++;
  return fetchOriginal(...args);
 };
 const keys=Cache.prototype.keys;
 Cache.prototype.keys=function(...args){
  if(window.__pwaCacheReadFailures>0){window.__pwaCacheReadFailures--;return Promise.reject(new Error('simulated final cache read failure'));}
  return keys.apply(this,args);
 };
},{small,base});
const errors=[];page.on('pageerror',error=>errors.push(String(error)));
let failure,beforeRetry,result;
try{
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
 const start=page.getByRole('button',{name:'ダウンロードを開始',exact:true});await start.waitFor({timeout:30000});
 await page.evaluate(()=>{window.__pwaCacheReadFailures=1;});await start.click();
 await page.getByRole('button',{name:/失敗した項目だけ再試行|保存済みデータを反映し直す/}).waitFor({timeout:15000});
 beforeRetry=await page.evaluate(()=>({gate:document.querySelector('.pwa-gate')?.innerText??null,fetches:window.__pwaAssetFetches,remainingFailures:window.__pwaCacheReadFailures,gameMounted:!!document.querySelector('.v100-shell')}));
 assert.match(beforeRetry.gate,/simulated final cache read failure/);assert.equal(beforeRetry.gameMounted,false);assert.equal(beforeRetry.remainingFailures,0);assert.ok(beforeRetry.fetches>0);
 if(out) await page.screenshot({path:path.join(out,'retry.png')});
 await page.getByRole('button',{name:/失敗した項目だけ再試行|保存済みデータを反映し直す/}).click();
 await page.getByRole('heading',{name:'ダウンロードが完了しました',exact:true}).waitFor({timeout:60000});
 result=await page.evaluate(async base=>{
  const registration=await navigator.serviceWorker.getRegistration(base),channel=new MessageChannel();
  const state=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('state timeout')),10000);channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data);};registration.active.postMessage({type:'pwa:get-state'},[channel.port2]);});
  return {fetches:window.__pwaAssetFetches,active:state.active?.releaseSha,assets:state.active?.assets?.length};
 },base);
 assert.equal(result.fetches,beforeRetry.fetches,'retry must reuse verified game assets');assert.equal(result.active,small.releaseSha);assert.equal(result.assets,3);assert.deepEqual(errors,[]);
}catch(error){failure=String(error.stack??error);}
finally{
 const terminal=await page.evaluate(()=>({gate:document.querySelector('.pwa-gate')?.innerText??null,gameMounted:!!document.querySelector('.v100-shell'),fetches:window.__pwaAssetFetches,remainingFailures:window.__pwaCacheReadFailures})).catch(()=>null);
 if(out) await page.screenshot({path:path.join(out,'terminal.png')}).catch(()=>{});
 const report={at:new Date().toISOString(),sourceHead:shipped.releaseSha,status:failure?'failed':'passed',beforeRetry,result,terminal,errors,failure,syntheticPack:true,physicalPhone:false};
 if(out) await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report));await browser.close();
}
if(failure)process.exitCode=1;
