import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {V100_STORY_EVENTS} from '../app/v100StoryEvents.js';
import {v100StoryPageFor} from '../app/v100StoryPages.js';
import {v100EventPresentationFor} from '../app/v100EventPresentation.js';
import {v100StoryInsertFor} from '../app/v100StoryInserts.js';
import {serializeV100Save} from '../app/v100Save.js';
import {createV100DialogueFixture} from './v100-dialogue-fixture.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';

const engine=process.env.QUALITY_MATERIAL_ENGINE??'chromium';
const out=path.resolve(process.env.QUALITY_MATERIAL_OUT);await mkdir(out,{recursive:true});
const variants=new Map();
for(const [eventId,event] of Object.entries(V100_STORY_EVENTS))for(let i=0;i<event.nodes.length;i++){
 const page=v100StoryPageFor(eventId,event.nodes,i);i=page.nodeIndex;
 const node=event.nodes[i],presentation=v100EventPresentationFor({eventId,node,nodeIndex:i});
 if(!presentation.insertId)continue;
 const material=v100StoryInsertFor(presentation.insertId,node.sourceLine);
 const key=JSON.stringify(material);
 if(!variants.has(key))variants.set(key,{eventId,nodeIndex:i,id:presentation.insertId,sourceLine:node.sourceLine});
}
assert.ok(variants.size>=20,'authored material coverage unexpectedly disappeared');
const report={engine,build:await productionBuildIdentity(),scope:'All reachable authored material variants in prepared story checkpoints; ordinary browser rendering and native reader controls. Not campaign victories, native PWA storage, audio listening or physical-device acceptance.',variants:[...variants.values()],cases:[],errors:[]};
const browser=await ({chromium,webkit}[engine]).launch({headless:true});
try{
 for(const viewport of [{width:844,height:340},{width:1280,height:720}]){
  const label=viewport.width+'x'+viewport.height;
  for(const [index,fixture] of [...variants.values()].entries()){
   const context=await browser.newContext({viewport,hasTouch:true,...(index===0?{recordVideo:{dir:path.join(out,label),size:viewport}}:{})});
   const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
   try{
   const raw=serializeV100Save(createV100DialogueFixture(fixture));
   await page.addInitScript(raw=>{
    for(const key of ['nishijin-campaign-v100','nishijin-campaign-v100:mirror','nishijin-campaign-v100:last-known-good'])localStorage.setItem(key,raw);
   },raw);
   const url=new URL('v100',process.env.V100_CAMPAIGN_QA_BASE_URL);
   await page.goto(url.href);await dismissInstallOffer(page,{timeout:20000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
   const loaded=await page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
   assert.equal(loaded.flowState.eventId,fixture.eventId,'the prepared event was actually loaded');
   assert.equal(loaded.flowState.nodeIndex,fixture.nodeIndex,'the prepared material variant was actually loaded');
   const stage=page.locator('[data-v100-event-id="'+fixture.eventId+'"]');
   const diagram=stage.locator('[data-v100-insert="'+fixture.id+'"]');await diagram.waitFor();
   await page.evaluate(()=>document.fonts.ready);
   const geometry=await diagram.evaluate(el=>{
    const stage=el.closest('.v100-event-layout'),heading=stage.querySelector('.v100-event-heading').getBoundingClientRect(),copy=stage.querySelector('.v100-node-copy').getBoundingClientRect();
    const title=el.querySelector('.v100-insert-heading').getBoundingClientRect(),caption=el.querySelector('figcaption').getBoundingClientRect();
    return {headingBottom:heading.bottom,titleTop:title.top,captionBottom:caption.bottom,copyTop:copy.top};
   });
   assert.ok(geometry.titleTop>=geometry.headingBottom+1,JSON.stringify(geometry));
   assert.ok(geometry.captionBottom<=geometry.copyTop-4,JSON.stringify(geometry));
   const beforeCopy=await stage.locator('.v100-node-copy').innerText(),beforeSave=await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100'));
   if(index===0)await page.screenshot({path:path.join(out,label+'-preview.png')});
   await diagram.getByRole('button',{name:'資料を拡大',exact:true}).click();
   const reader=page.getByRole('dialog');await reader.waitFor({state:'visible'});
   const expanded=await reader.evaluate(el=>{const r=el.getBoundingClientRect(),t=el.querySelector('.v100-insert-heading').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,headingHeight:t.height};});
   assert.ok(expanded.x>=0&&expanded.y>=0&&expanded.x+expanded.width<=viewport.width+1&&expanded.y+expanded.height<=viewport.height+1);
   assert.ok(expanded.headingHeight>=12,JSON.stringify(expanded));
   await page.screenshot({path:path.join(out,label+'-'+index+'-'+fixture.id+'-expanded.png')});
   if(index%2===0)await page.keyboard.press('Escape');else await reader.getByRole('button',{name:'閉じる',exact:true}).click();
   await reader.waitFor({state:'hidden'});
   assert.equal(await stage.locator('.v100-node-copy').innerText(),beforeCopy);
   assert.equal(await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100')),beforeSave);
   report.cases.push({viewport,fixture,geometry,expanded,close:index%2===0?'Escape':'button',status:'passed'});
   await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
   }catch(error){report.failedFixture=fixture;report.observed=await page.evaluate(()=>({body:document.body.innerText,flow:JSON.parse(localStorage.getItem('nishijin-campaign-v100')??'null')?.flowState}));throw error;}
   finally{await context.close();}
  }
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.error=String(error);throw error;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
