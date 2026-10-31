import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {V100_STORY_EVENTS} from '../app/v100StoryEvents.js';
import {v100StoryPageFor} from '../app/v100StoryPages.js';
import {v100EventPresentationFor} from '../app/v100EventPresentation.js';
import {v100EventPhaseForId} from '../app/v100Registry.js';
import {serializeV100Save} from '../app/v100Save.js';
import {createV100DialogueFixture} from './v100-dialogue-fixture.mjs';
import {enterV100FromTitle, seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';

const before=process.env.QUALITY_LOCATION_BEFORE==='1';
const out=path.resolve(process.env.QUALITY_LOCATION_OUT??`output/quality-20261028/story-location-${before?'before':'after'}-r1`);
await mkdir(out,{recursive:true});
const cases=before||process.env.QUALITY_LOCATION_COMPARISON==='1'?[['prologue',167,1],['s26:post',2084,1]]:[['prologue',165,4],['s01:post',269,3],['s12:pre',996,3],['s20:post',1748,3],['s26:post',2098,2]];
const report={build:await productionBuildIdentity(),scope:'Prepared story checkpoints, real Next controls. No natural campaign progression, listening or physical-device acceptance.',cases:[],errors:[]};
const browser=await chromium.launch({headless:true});
try {
 for(const [suffix,line,count] of cases){
  const eventId=`v100:event:${suffix}`,nodes=V100_STORY_EVENTS[eventId].nodes;
  let index=nodes.findIndex(n=>n.sourceLine===line);assert.ok(index>=0);
  const seed=createV100DialogueFixture({eventId,nodeIndex:index});
  const context=await browser.newContext({viewport:{width:844,height:390},recordVideo:{dir:path.join(out,suffix.replaceAll(':','-')),size:{width:844,height:390}}});
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
  try{
   await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
   await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);
   await dismissInstallOffer(page,{timeout:20000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
   const frames=[];
   for(let step=0;step<count;step++){
    const current=v100StoryPageFor(eventId,nodes,index),presentation=v100EventPresentationFor({eventId,phase:v100EventPhaseForId(eventId),node:current.node,nodeIndex:current.nodeIndex});
    await page.locator(`.v100-event-layout[data-v100-node-index="${current.nodeIndex}"]`).waitFor();
    if(presentation.backgroundPath)await page.waitForFunction(src=>document.querySelector('.v100-event-backdrop')?.getAttribute('data-v100-background')===src,presentation.backgroundPath);
    await page.waitForFunction(()=>[...document.querySelectorAll('.v100-event-backdrop img')].every(i=>i.complete&&i.naturalWidth>0));
    await page.waitForTimeout(750);
    const background=await page.locator('.v100-event-backdrop').getAttribute('data-v100-background');
    await page.screenshot({path:path.join(out,`${suffix.replaceAll(':','-')}-${current.node.sourceLine}.png`)});
    frames.push({nodeIndex:current.nodeIndex,sourceLine:current.node.sourceLine,background});
    if(step<count-1){await page.locator('#v100-campaign[aria-busy="false"]').waitFor();await page.locator('.v100-event-actions .v100-primary').click();index=current.endIndex+1;}
   }
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
   for(const key of ['caps','ownedUnitIds','registeredUnitIds','formationSlots','receipts','pendingResult'])assert.deepEqual(saved[key],seed[key],key);
   await context.close();report.cases.push({eventId,frames,savePreserved:true,video:await page.video().path()});
  }finally{await context.close();}
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.error=String(e);throw e;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,cases:report.cases.length,out}));
