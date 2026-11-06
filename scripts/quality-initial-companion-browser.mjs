import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,applyV100SaveMutation,serializeV100Save,validateV100SavePayload} from '../app/v100Save.js';
import {V100_STORY_EVENTS,V100_STORY_SCRIPT_VERSION} from '../app/v100StoryEvents.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';

const engine=process.env.QUALITY_INITIAL_ENGINE??'webkit';
const before=process.env.QUALITY_INITIAL_BEFORE==='1';
const out=path.resolve(process.env.QUALITY_INITIAL_OUT);
const url=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.ok(['chromium','webkit'].includes(engine));
await mkdir(out,{recursive:false});
await writeFile(path.join(out,'executed-driver.mjs'),await readFile(new URL(import.meta.url)),{flag:'wx'});
const eventId='v100:event:prologue',event=V100_STORY_EVENTS[eventId];
const nodeIndex=event.nodes.findIndex(n=>n.kind==='system'&&n.text.startsWith('西新商店街の薬局へ向かえ。'));
assert.ok(nodeIndex>=0);
const seed=applyV100SaveMutation(createDefaultV100Save(),s=>({...s,campaignStarted:true,
 settings:{...s.settings,masterVolume:0},
 eventCursor:{eventId,nodeIndex,scriptVersion:V100_STORY_SCRIPT_VERSION},
 flowState:{...s.flowState,phase:'event',destination:'event',eventId,nodeIndex,scriptVersion:V100_STORY_SCRIPT_VERSION}})).save;
assert.ok(validateV100SavePayload(JSON.parse(serializeV100Save(seed))).ok);
const report={engine,before,build:await productionBuildIdentity(process.env.QUALITY_INITIAL_BUILD_ROOT),
 scope:'Prepared prologue-end cursor with unchanged initial roster and zero CAPS. Normal dialogue/log/reload/formation UI. Muted; not full prologue viewing, story acceptance, natural victories or physical-device QA.',cases:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true});
try{
 for(const viewport of [{width:1280,height:720},{width:844,height:340}]){
  const label=`${viewport.width}x${viewport.height}`,row={label};report.cases.push(row);
  const context=await browser.newContext({viewport,recordVideo:{dir:path.join(out,label),size:viewport}});
  const page=await context.newPage();page.setDefaultTimeout(25000);
  page.on('pageerror',e=>report.errors.push(String(e)));
  try{
   await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
   const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
   const enter=async()=>{await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);};
   await page.goto(url.href);await enter();
   const copy=page.locator('.v100-event-panel .v100-node-copy').first();await copy.waitFor();
   row.text=await copy.innerText();
   assert.ok(row.text.includes(before?'西新商店街の薬局へ向かえ。':event.nodes[nodeIndex].text));
   if(before)assert.ok(!row.text.includes('ハチ'));else assert.ok(row.text.includes('ハチ'));
   row.bounds=await copy.evaluate(el=>({clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth}));
   assert.ok(row.bounds.scrollHeight<=row.bounds.clientHeight+1&&row.bounds.scrollWidth<=row.bounds.clientWidth+1);
   await page.screenshot({path:path.join(out,label+'-notice.png')});
   if(before){row.status='before-captured';continue;}
   const checkpoint=await saved();await page.getByRole('button',{name:'会話ログ',exact:true}).click();
   assert.ok((await page.locator('.v100-current-transcript').innerText()).includes(event.nodes[nodeIndex].text));
   await page.getByRole('dialog').getByRole('button',{name:'閉じる',exact:true}).click();assert.deepEqual(await saved(),checkpoint);
   await page.reload();await enter();assert.ok((await copy.innerText()).includes(event.nodes[nodeIndex].text));
   for(let n=0;n<80;n++){
    await page.waitForFunction(()=>document.documentElement.dataset.pwaSaveMutationPending==='false');
    const previous=await saved();
    await page.waitForFunction(phase=>document.querySelector('#v100-campaign')?.getAttribute('data-v100-phase')===phase,previous.flowState.phase);
    if(previous.flowState.phase==='formation'){
     await page.locator('[data-v100-surface="formation"]').waitFor();break;
    }
    if(previous.flowState.phase==='map')await page.getByRole('button',{name:'編成して出撃',exact:true}).click();
    else await page.locator('.v100-event-actions').getByRole('button').last().click();
    await page.waitForFunction(old=>JSON.stringify(JSON.parse(localStorage.getItem('nishijin-campaign-v100')).flowState)!==old,JSON.stringify(previous.flowState));
   }
   await page.locator('[data-v100-surface="formation"]').waitFor();
   const settled=await saved();assert.ok(settled.ownedUnitIds.includes('unit-hachi'));assert.ok(settled.formationSlots.includes('unit-hachi'));
   row.saveBefore=checkpoint;row.saveAfter=settled;
   for(const key of ['caps','ownedUnitIds','registeredUnitIds','formationSlots','unitLevels','receipts','vehicle','equipment','completedStageIds']){
    assert.ok(Object.hasOwn(checkpoint,key),key+' must exist');
    assert.deepEqual(settled[key],checkpoint[key],key);
   }
   assert.ok((await page.locator('[data-v100-surface="formation"]').innerText()).includes('ハチ'));
   await page.waitForFunction(()=>{
    const images=[...document.querySelectorAll('.v100-slot-portrait img')];
    return images.length===4&&images.every(img=>img.complete&&img.naturalWidth>0&&img.dataset.loaded==='true'&&Number(getComputedStyle(img).opacity)>.98);
   });
   await page.screenshot({path:path.join(out,label+'-formation.png')});
   row.initialCompanionAvailable=true;row.caps=settled.caps;row.status='passed';
  }catch(error){row.status='failed';row.error=String(error);await page.screenshot({path:path.join(out,label+'-failure.png')}).catch(()=>{});throw error;}
  finally{await context.close();row.video=await page.video().path();}
 }
 assert.deepEqual(report.errors,[]);
}finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({cases:report.cases.map(({label,status})=>({label,status})),out}));
