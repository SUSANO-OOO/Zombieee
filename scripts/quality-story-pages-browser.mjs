import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,applyV100SaveMutation,serializeV100Save,validateV100SavePayload} from '../app/v100Save.js';
import {v100EventPhaseForId,V100_EVENT_BY_ID,V100_STAGE_IDS} from '../app/v100Registry.js';
import {V100_STORY_SCRIPT_VERSION,v100StoryEventView} from '../app/v100StoryEvents.js';
import {v100StoryPageFor} from '../app/v100StoryPages.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const before=process.env.QUALITY_STORY_PAGES_BEFORE==='1',engine=process.env.QUALITY_STORY_PAGES_ENGINE??'chromium';
const out=path.resolve(process.env.QUALITY_STORY_PAGES_OUT);await mkdir(out,{recursive:true});
const report={before,engine,build:await productionBuildIdentity(),scope:'Prepared old-node checkpoints; normal advance, transcript, reload and replay. Not full campaign progression, full-speed video viewing, audio listening or physical-device acceptance.',cases:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true});
try{
 for(const viewport of [{width:844,height:340},{width:1280,height:720}])for(const [eventId,start]of [['v100:event:prologue',1],['v100:event:s23:pre',4]]){
  const label=`${viewport.width}x${viewport.height}-${eventId.split(':').slice(2).join('-')}`,phase=v100EventPhaseForId(eventId),stageNumber=V100_EVENT_BY_ID[eventId].stageNumber??1,stageId=V100_STAGE_IDS[stageNumber-1];
  const seed=applyV100SaveMutation(createDefaultV100Save(),s=>({...s,campaignStarted:true,playerName:'会話確認',settings:{...s.settings,autoSkipReadStory:false},readStoryEventIds:[eventId],readStoryVersions:{[eventId]:V100_STORY_SCRIPT_VERSION},availableStageIds:V100_STAGE_IDS,eventCursor:{eventId,nodeIndex:start,scriptVersion:V100_STORY_SCRIPT_VERSION},flowState:{...s.flowState,phase,eventId,nodeIndex:start,stageId,stageNumber,scriptVersion:V100_STORY_SCRIPT_VERSION}})).save;
  assert.ok(validateV100SavePayload(JSON.parse(serializeV100Save(seed))).ok);
  const event=v100StoryEventView(eventId,seed.playerName),group=v100StoryPageFor(eventId,event.nodes,start),row={label,eventId,start,end:before?start:group.endIndex};report.cases.push(row);
  const context=await browser.newContext({viewport,recordVideo:{dir:path.join(out,label),size:viewport}});
  try{
   await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
   const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
   const enter=async()=>{await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);};
   const saved=()=>page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100'));
   await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);await enter();
   const copy=page.locator('.v100-event-panel .v100-node-copy').first();
   const portraitsReady=()=>page.waitForFunction(()=>{
    const images=[...document.querySelectorAll('.v100-event-panel .v100-portrait-frame img')];
    return images.length>0&&images.every(img=>{
     const r=img.getBoundingClientRect();let visible=true;
     for(let el=img;el;el=el.parentElement){const s=getComputedStyle(el);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)<.98)visible=false;}
     return visible&&img.complete&&img.naturalWidth>0&&img.getAnimations().every(a=>a.playState==='finished')&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight;
    });
   });
   await portraitsReady();
   assert.ok((await copy.innerText()).includes(event.nodes[start].text));
   if(!before){
    for(const node of [...group.leadingNodes,group.node])assert.ok((await copy.innerText()).includes(node.text));
    assert.equal(await copy.locator('.v100-exchange-speaker').count(),2);
    const owners=await page.locator('.v100-portrait-frame').evaluateAll(els=>els.map(el=>el.dataset.portraitOwner));
    for(const node of [...group.leadingNodes,group.node])assert.ok(owners.includes(node.portraitOwner),'both speakers must remain visible');
    row.textBounds=await copy.locator('.v100-story-prose').evaluate(el=>({scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
    assert.ok(row.textBounds.scrollHeight<=row.textBounds.clientHeight+1,'short exchange must not require inner scrolling');
    assert.ok(row.textBounds.scrollWidth<=row.textBounds.clientWidth+1);
   }
   await page.screenshot({path:path.join(out,label+'-page.png')});
   if(before){await copy.getByRole('button',{name:'次へ',exact:true}).click();await page.waitForFunction(index=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')).eventCursor.nodeIndex===index,start+1);assert.ok((await copy.innerText()).includes(event.nodes[start+1].text));await page.screenshot({path:path.join(out,label+'-second.png')});row.status='before-captured';continue;}
   const original=await saved();await page.getByRole('button',{name:'会話ログ',exact:true}).click();
   const log=await page.locator('.v100-current-transcript li p').allTextContents();
   assert.deepEqual(log,event.nodes.slice(0,group.endIndex+1).filter(n=>n.text).map(n=>n.text));
   await page.getByRole('dialog').getByRole('button',{name:'閉じる',exact:true}).click();assert.equal(await saved(),original);
   await page.reload();await enter();for(const node of [...group.leadingNodes,group.node])assert.ok((await copy.innerText()).includes(node.text));
   await copy.getByRole('button',{name:'次へ',exact:true}).click();
   await page.waitForFunction(index=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')).eventCursor.nodeIndex===index,group.endIndex+1);
   const after=JSON.parse(await saved());for(const key of ['caps','receipts','ownedUnitIds','unitLevels','equipment','readStoryEventIds'])assert.deepEqual(after[key],seed[key]);
   const beforeReplay=await saved();await page.getByRole('button',{name:'会話ログ',exact:true}).click();await page.locator('.v100-log-list button').first().click();
   const replay=page.getByRole('dialog',{name:'会話記録',exact:true}),first=v100StoryPageFor(eventId,event.nodes,0);
   await replay.waitFor();assert.equal(await replay.getAttribute('data-v100-replay-index'),String(first.endIndex));
   await replay.getByRole('button',{name:'次へ',exact:true}).click();
   const second=v100StoryPageFor(eventId,event.nodes,first.endIndex+1);
   await page.waitForFunction(index=>document.querySelector('.v100-replay-layout')?.getAttribute('data-v100-replay-index')===String(index),second.endIndex);
   for(const node of [...second.leadingNodes,second.node])assert.ok((await replay.innerText()).includes(node.text));
   await portraitsReady();await page.screenshot({path:path.join(out,label+'-replay.png')});
   await replay.getByRole('button',{name:'閉じる',exact:true}).click();assert.equal(await saved(),beforeReplay);
   row.status='passed';
  }finally{await context.close();}
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.error=String(error);throw error;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,cases:report.cases.map(c=>({label:c.label,status:c.status,bounds:c.textBounds}))}));
