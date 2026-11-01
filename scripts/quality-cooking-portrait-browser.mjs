import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {serializeV100Save,deserializeV100Save} from '../app/v100Save.js';
import {v100StoryEventView} from '../app/v100StoryEvents.js';
import {createV100DialogueFixture} from './v100-dialogue-fixture.mjs';
import {v100StoryPageFor} from '../app/v100StoryPages.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';

const engine=process.env.QUALITY_COOKING_ENGINE??'chromium',before=process.env.QUALITY_COOKING_BEFORE==='1';
const out=path.resolve(process.env.QUALITY_COOKING_OUT);await mkdir(out,{recursive:false});
const harness=await readFile(new URL(import.meta.url));await writeFile(path.join(out,'harness-used.mjs'),harness);
const report={engine,before,build:await productionBuildIdentity(path.resolve(process.env.QUALITY_COOKING_BUILD_ROOT)),driverSha256:createHash('sha256').update(harness).digest('hex'),scope:'Prepared isolated prologue and S25 soup checkpoints, native Next through all applicable pages. Silent browser recordings, not full campaign progression or human likeness acceptance.',cases:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true});
try{
 for(const viewport of before?[{width:844,height:340}]:[{width:844,height:340},{width:1280,height:720}])for(const [eventId,start,last]of [['v100:event:prologue',0,29],['v100:event:s25:post',4,12]]){
  const label=`${viewport.width}x${viewport.height}-${eventId.split(':').slice(2).join('-')}`;
  const seed=createV100DialogueFixture({eventId,nodeIndex:start,playerName:'会話確認'});
  seed.settings={...seed.settings,autoSkipReadStory:false,bgmEnabled:false,sfxEnabled:false};
  assert.equal(deserializeV100Save(serializeV100Save(seed)).ok,true);
  const event=v100StoryEventView(eventId,seed.playerName),row={label,eventId,pages:[],screens:[]};report.cases.push(row);
  const context=await browser.newContext({viewport,recordVideo:{dir:path.join(out,label),size:viewport}});
  let page;
  try{
   await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
   page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
   await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);
   await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
   const seen=new Set();
   for(let index=start;index<=last;){
    const group=v100StoryPageFor(eventId,event.nodes,index);
    const panel=page.locator('.v100-event-panel');await panel.waitFor();
    // Saving the durable cursor precedes React's visual commit. Observe the
    // actual page text as well, so the previous frame cannot satisfy this row.
    await page.waitForFunction(text=>document.querySelector('.v100-event-panel .v100-node-copy')?.textContent.includes(text),group.node.text);
    await page.waitForFunction(()=>[...document.querySelectorAll('.v100-event-panel .v100-portrait-frame img')].every(img=>img.complete&&img.naturalWidth>0));
    const portraits=await panel.locator('[data-portrait-owner="unit-kumaverson"]').evaluateAll(els=>els.map(el=>{const img=el.querySelector('img'),r=el.getBoundingClientRect(),s=getComputedStyle(el);return{path:new URL(img.currentSrc||img.src).pathname,role:el.classList.contains('v100-portrait-frame-secondary')?'listener':'speaker',bounds:{x:r.x,y:r.y,width:r.width,height:r.height},camera:{top:s.getPropertyValue('--portrait-top-factor'),width:s.getPropertyValue('--portrait-width-factor'),center:s.getPropertyValue('--portrait-face-center')}};}));
    if(!before&&eventId==='v100:event:s25:post'&&group.node.sourceKey==='r9:2036'){
      assert.deepEqual((await panel.locator('[data-portrait-owner]').evaluateAll(els=>els.map(el=>el.dataset.portraitOwner))).sort(),['unit-kumaverson','unit-zakimiya']);
    }
    for(const p of portraits){
     assert.ok(p.path.endsWith(before?'/kumaverson-warm-stage-r1.webp':'/kumaverson-cooking-warm-stage-r1.webp'),`${label}:${index}: ${p.path}`);
     assert.ok(p.bounds.width>0&&p.bounds.height>0);
     if(!seen.has(p.role)){
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(()=>[...document.querySelectorAll('.v100-event-panel .v100-portrait-frame img')].every(img=>img.getAnimations().every(a=>a.playState==='finished')));
      const screenshot=`${label}-${p.role}.png`;await page.screenshot({path:path.join(out,screenshot)});row.screens.push(screenshot);seen.add(p.role);
     }
    }
    row.pages.push({start:index,end:group.endIndex,portraits});
    index=group.endIndex+1;if(index>last)break;
    await panel.getByRole('button',{name:'次へ',exact:true}).click();
    await page.waitForFunction(expected=>JSON.parse(localStorage.getItem('nishijin-campaign-v100'))?.eventCursor?.nodeIndex===expected,index);
   }
   assert.ok(row.pages.some(p=>p.portraits.length),'Kuma must be visible in this authored scene');
   row.status='passed';row.video=await page.video().path();
  }catch(e){row.status='failed';row.error=String(e);if(page&&!page.isClosed()){await page.screenshot({path:path.join(out,label+'-failure.png')});row.failureText=await page.locator('body').innerText();}throw e;}
  finally{await context.close();}
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.error=String(e);throw e;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,engine,before,cases:report.cases.map(c=>({label:c.label,pages:c.pages.length,visible:c.pages.filter(p=>p.portraits.length).length}))}));
