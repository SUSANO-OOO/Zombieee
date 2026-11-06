import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {seedV100BrowserSaveOnce,finishV100TitleIntro} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const engine=process.env.QUALITY_TITLE_CREDITS_ENGINE??'webkit',out=path.resolve(process.env.QUALITY_TITLE_CREDITS_OUT);
const url=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);assert.ok(['localhost','127.0.0.1'].includes(url.hostname));assert.ok(['webkit','chromium'].includes(engine));
await fs.mkdir(out,{recursive:false});await fs.writeFile(path.join(out,'driver.mjs'),await fs.readFile(new URL(import.meta.url)));
const source=JSON.parse(await fs.readFile('output/quality-20261028/defense-s22-webkit-r1/report.json','utf8')).cases[0].openingFixture;
const seed=normalizeV100Save({...source,readStoryEventIds:[...new Set([...source.readStoryEventIds,'v100:event:credits'])]});
const report={engine,build:await productionBuildIdentity(process.env.QUALITY_TITLE_CREDITS_ROOT),cases:[],errors:[],
 scope:'Prepared read-credits save; actual in-viewport coordinates and hit ownership before native mouse input, title return and full-save reload. One small WebKit case also uses normal skip and 4x completion. Silent UI, not natural finale, physical touch or full-speed human viewing.'};
const browser=await({webkit,chromium}[engine]).launch({headless:true});
try{for(const viewport of [{width:844,height:340},{width:1280,height:720}]){
 const label=`${viewport.width}x${viewport.height}`,row={label};report.cases.push(row);
 const context=await browser.newContext({viewport,hasTouch:true,serviceWorkers:'block',recordVideo:{dir:path.join(out,label),size:viewport}}),page=await context.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',e=>report.errors.push(String(e)));const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
 const title=async()=>{await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await finishV100TitleIntro(page);};
 const open=async()=>{const notice=page.locator('.pwa-notice').getByRole('button',{name:'閉じる',exact:true});if(await notice.isVisible())await notice.click();await page.getByRole('button',{name:'クレジット',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'スタッフロールをもう一度見る',exact:true}).click();await page.locator('.v100-staff-roll').waitFor();};
 const inspect=()=>page.locator('.v100-title-credits-close').evaluate(el=>{const r=el.getBoundingClientRect(),style=getComputedStyle(el);return {x:r.x,y:r.y,width:r.width,height:r.height,position:style.position,zIndex:style.zIndex,centerOwned:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el,scrollTop:el.parentElement.scrollTop};});
 try{
  await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));await page.goto(url.href);await title();row.before=await saved();await open();
  row.geometry=await inspect();const g=row.geometry;assert.equal(g.position,'fixed');assert.equal(g.centerOwned,true);assert.equal(g.scrollTop,0);assert.ok(g.x>=0&&g.y>=0&&g.x+g.width<=viewport.width&&g.y+g.height<=viewport.height&&g.height>=44);
  await page.screenshot({path:path.join(out,label+'-open.png')});await page.mouse.click(g.x+g.width/2,g.y+g.height/2);await page.locator('.v100-start-screen').waitFor();assert.deepEqual(await saved(),row.before);row.coordinateClose=true;
  if(engine==='webkit'&&viewport.height===340){
   await finishV100TitleIntro(page);await open();await page.getByRole('button',{name:'スキップ',exact:true}).click();await page.locator('.v100-start-screen').waitFor();assert.deepEqual(await saved(),row.before);row.skipPreserved=true;
   await finishV100TitleIntro(page);await open();for(let n=0;n<2;n++)await page.getByRole('button',{name:/^映像と文字の速さ：/}).click();assert.equal(await page.locator('.v100-staff-roll').getAttribute('data-v100-credit-speed'),'4');
   await page.locator('.v100-start-screen').waitFor({timeout:45000});assert.deepEqual(await saved(),row.before);row.completionPreserved=true;
  }
  await page.reload();await title();row.after=await saved();assert.deepEqual(row.after,row.before);row.status='passed';
 }catch(e){row.status='failed';row.error=String(e);await page.screenshot({path:path.join(out,label+'-failure.png'),timeout:5000}).catch(()=>{});throw e;}
 finally{await context.close();row.video=await page.video().path();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
}assert.deepEqual(report.errors,[]);report.status='passed';}
catch(e){report.status='failed';report.error=String(e);process.exitCode=1;}
finally{await browser.close();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({engine,status:report.status,cases:report.cases.length,error:report.error}));
