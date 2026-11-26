import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,applyV100SaveMutation,serializeV100Save,validateV100SavePayload} from '../app/v100Save.js';
import {V100_UNITS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {createV100BattleResult} from '../app/v100Transactions.js';
import {V100_STORY_EVENTS,V100_STORY_SCRIPT_VERSION,V100_STORY_SOURCE_SHA256} from '../app/v100StoryEvents.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const before=process.env.QUALITY_RECRUIT_BEFORE==='1',engine=process.env.QUALITY_RECRUIT_ENGINE??'webkit';
const out=path.resolve(process.env.QUALITY_RECRUIT_OUT);await mkdir(out,{recursive:true});
const development = process.argv.includes('--dev');
if (development) assert.ok(['localhost','127.0.0.1'].includes(new URL(process.env.V100_CAMPAIGN_QA_BASE_URL).hostname));
const build = development
  ? {mode:'local-development-server',storySourceSha256:V100_STORY_SOURCE_SHA256}
  : await productionBuildIdentity(process.env.QUALITY_RECRUIT_BUILD_ROOT??'.');
const report={before,engine,build,scope:'Isolated prepared post-battle saves, normal event advance, log/reload, unit readiness purchase and formation. Not played victories, continuous motion review, listening or physical-device acceptance.',cases:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true});
try{
 const oldNoticeCursor = {'unit-nao':24,'unit-mayo-chan':8,'unit-tky':24};
 for(const viewport of [{width:667,height:375},{width:844,height:340}])for(const unitId of ['unit-nao','unit-mayo-chan','unit-tky']){
  const unit=V100_UNITS.find(u=>u.id===unitId),stageNumber=unit.availabilityStageNumber,stageId=V100_STAGE_IDS[stageNumber-1];
  const eventId=`v100:event:s${String(stageNumber).padStart(2,'0')}:post`,event=V100_STORY_EVENTS[eventId];
  const nodeIndex=oldNoticeCursor[unitId];
  const finalLine=event.nodes.at(-1).text;
  const label=`${unitId}-${viewport.width}x${viewport.height}`;
  if(process.env.QUALITY_RECRUIT_CASES&&!process.env.QUALITY_RECRUIT_CASES.split(',').includes(label))continue;
  const pendingResult=createV100BattleResult({stageId,battleRunId:'quality:recruit:'+label,won:true,objectiveComplete:true,bossDefeated:true,vehicleHp:680});
  const seed=applyV100SaveMutation(createDefaultV100Save(),s=>({...s,campaignStarted:true,playerName:'案内確認',caps:1000,pendingResult,
   settings:{...s.settings,autoSkipReadStory:false,masterVolume:0},availableStageIds:V100_STAGE_IDS.slice(0,stageNumber),
   eventCursor:{eventId,nodeIndex,scriptVersion:V100_STORY_SCRIPT_VERSION},
   flowState:{...s.flowState,phase:'post',destination:'post',firstClear:true,eventId,nodeIndex,stageId,stageNumber,scriptVersion:V100_STORY_SCRIPT_VERSION}})).save;
  assert.ok(validateV100SavePayload(JSON.parse(serializeV100Save(seed))).ok);
  const row={label,unitId,eventId,nodeIndex};report.cases.push(row);
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,recordVideo:{dir:path.join(out,label),size:viewport}});
  try{
   await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));const page=await context.newPage();page.setDefaultTimeout(25000);
   page.on('pageerror',e=>report.errors.push(String(e)));
   const saved=async()=>JSON.parse(await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100')));
   const enter=async()=>{await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);};
   await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);await enter();
   const copy=page.locator('.v100-event-panel .v100-node-copy').first();await copy.waitFor();
   row.text=await copy.innerText();
   if(before)assert.match(row.text,/育成画面でCAPS|「ユニット」でCAPS/u);
   else {
     assert.ok(row.text.includes(finalLine));
     assert.doesNotMatch(row.text,/CAPS|編成に加えよう/u);
   }
   row.bounds=await copy.evaluate(el=>({clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,clientWidth:el.clientWidth,scrollWidth:el.scrollWidth}));
   assert.ok(row.bounds.scrollHeight<=row.bounds.clientHeight+1&&row.bounds.scrollWidth<=row.bounds.clientWidth+1,'notice must fit without internal scrolling');
   if(!before && unitId==='unit-nao'){
    const ikura=page.locator('.v100-portrait-frame[data-portrait-owner="guide-ikura"] img.v100-portrait');
    await ikura.waitFor();
    row.portrait=await ikura.evaluate(async image=>{
      await image.decode();
      const bounds=image.getBoundingClientRect();
      return {width:bounds.width,height:bounds.height,imageWidth:image.naturalWidth};
    });
    assert.ok(row.portrait.width>0 && row.portrait.height>0 && row.portrait.imageWidth>0);
   }
   await page.screenshot({path:path.join(out,label+'-scene.png'),animations:'disabled'});
   if(before){row.status='before-captured';continue;}
   const checkpoint=await saved();await page.getByRole('button',{name:'会話ログ',exact:true}).click();
   assert.ok((await page.locator('.v100-current-transcript').innerText()).includes(finalLine));
   await page.getByRole('dialog').getByRole('button',{name:'閉じる',exact:true}).click();assert.deepEqual(await saved(),checkpoint);
   await page.reload();await enter();assert.ok((await copy.innerText()).includes(finalLine));
   // Follow the actual remaining post-event and reward screens to the map.
   row.advances=[];
   let sawReward=false;
   for(let n=0;n<15;n++){
    const state=await saved();if(state.flowState.phase==='map')break;
    if(state.flowState.phase==='first-clear-post') {
      const reward = page.locator('.v100-reward-summary');
      const expected = unitId==='unit-mayo-chan' ? 'マヨちゃんが参戦（支度費 145 CAPS）' : unit.displayName+'が合流';
      await reward.getByText(expected,{exact:true}).waitFor();
      assert.ok((await reward.locator('li').allTextContents()).includes(expected));
      await page.screenshot({path:path.join(out,label+'-reward.png')});
      sawReward=true;
    }
    row.advances.push({flow:state.flowState,cursor:state.eventCursor,pending:state.pendingResult});
    await page.waitForFunction(()=>document.documentElement.dataset.pwaSaveMutationPending==='false');
    const actions=page.locator('.v100-event-actions');await actions.getByRole('button').last().click();
    try{await page.waitForFunction(previous=>{const s=JSON.parse(localStorage.getItem('nishijin-campaign-v100'));return s.flowState.phase!==previous.phase||s.eventCursor?.nodeIndex!==previous.index;},{phase:state.flowState.phase,index:state.eventCursor?.nodeIndex});}
    catch(error){row.failure={save:await saved(),screen:await page.locator('body').innerText()};await page.screenshot({path:path.join(out,label+'-failed.png')});throw error;}
   }
   assert.ok(sawReward,'the finalized reward must be visible before returning to the map');
   const settled=await saved();assert.equal(settled.flowState.phase,'map');assert.ok(settled.registeredUnitIds.includes(unitId));assert.ok(!settled.ownedUnitIds.includes(unitId));
   const offer=page.getByRole('dialog',{name:unit.displayName,exact:true});
   await offer.waitFor();
   await offer.getByRole('button',{name:'後で決める',exact:true}).click();
   await offer.waitFor({state:'hidden'});
   await page.locator('.v100-command-tabs').getByRole('button',{name:'ユニット',exact:true}).click();
   await page.locator(`[data-personnel-unit="${unitId}"]`).click();
   const focus=page.locator(`.v100-personnel-focus[data-unit-id="${unitId}"]`);await focus.waitFor();
   await page.screenshot({path:path.join(out,label+'-prepare.png')});
   const prePurchase=await saved();await focus.getByRole('button',{name:'支度を整える / '+unit.registrationCostCaps+' CAPS',exact:true}).click();
   await page.waitForFunction(id=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')).ownedUnitIds.includes(id),unitId);
   const purchased=await saved();assert.equal(purchased.caps,prePurchase.caps-unit.registrationCostCaps);assert.deepEqual(purchased.formationSlots,prePurchase.formationSlots);
   await focus.locator('.v100-unit-prepare').click();
   await page.waitForFunction(()=>document.querySelector('#v100-campaign')?.dataset.v100Phase!=='map');
   // Starting the selected operation may show its already-authored pre-event.
   for(let n=0;n<90;n++){
    if(await page.locator('#v100-campaign').getAttribute('data-v100-phase')==='formation')break;
    await page.waitForFunction(()=>document.documentElement.dataset.pwaSaveMutationPending==='false');
    const shell=page.locator('section[data-v100-event-id]');
    const previous=await shell.evaluate(el=>[el.dataset.v100EventId,el.dataset.v100NodeIndex]);
    await page.locator('.v100-event-actions .v100-primary').click();
    await page.waitForFunction(([id,index])=>{
      const panel=document.querySelector('section[data-v100-event-id]');
      return panel?.dataset.v100EventId!==id || panel?.dataset.v100NodeIndex!==index;
    },previous);
   }
   await page.locator('[data-v100-surface="formation"]').waitFor();await page.getByRole('button',{name:/^編成枠1 /u}).click();
   await page.waitForFunction(id=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')).formationSlots[0]===id,unitId);
   await page.screenshot({path:path.join(out,label+'-formation.png')});
   const final=await saved();assert.equal(final.caps,purchased.caps);assert.deepEqual(final.ownedUnitIds,purchased.ownedUnitIds);
   row.transaction={cost:unit.registrationCostCaps,capsBefore:prePurchase.caps,capsAfter:final.caps,formationSlot1:final.formationSlots[0],receiptsAdded:final.receipts.filter(id=>!seed.receipts.includes(id))};row.status='passed';
  }finally{await context.close();}
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.error=String(error);throw error;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,cases:report.cases.map(row=>({label:row.label,status:row.status,transaction:row.transaction}))}));
