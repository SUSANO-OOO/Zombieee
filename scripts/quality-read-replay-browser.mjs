import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save,V100_PRIMARY_STORAGE_KEY} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {V100_STORY_SCRIPT_VERSION,v100StoryEventIdsForStage} from '../app/v100StoryEvents.js';
import {v100StoryFlowCheckpoint} from '../app/v100StoryFlow.js';
import {createV100BattleResult,recordV100PendingResult,finalizeV100PendingResult,collectV100ReadReplayReward} from '../app/v100Transactions.js';

const url=new URL(process.env.QUALITY_READ_REPLAY_URL),out=path.resolve(process.env.QUALITY_READ_REPLAY_OUT),engine=process.env.QUALITY_READ_REPLAY_ENGINE??'chromium';
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));assert.ok(['chromium','webkit'].includes(engine));await mkdir(out,{recursive:false});
const root=path.resolve(process.env.QUALITY_READ_REPLAY_BUILD_ROOT??'.'),sourceRef=process.env.QUALITY_READ_REPLAY_SOURCE_REF??null,build=await productionBuildIdentity(root);
if(sourceRef){const snapshot=JSON.parse(await readFile(path.join(root,'snapshot.json'),'utf8'));assert.equal(snapshot.sourceHead,sourceRef);assert.equal(snapshot.combinedSha256,build.combinedSha256);}
const fixturePath='tests/fixtures/quality-earned-replay-result-s01-e412.json',fixture=JSON.parse(await readFile(fixturePath,'utf8')),source={};
for(const file of ['app/V100Campaign.tsx','app/v100StoryFlow.js','app/v100Transactions.js','app/v100CommandPolish.css'])source[file]=createHash('sha256').update(sourceRef?execFileSync('git',['show',sourceRef+':'+file],{maxBuffer:4*1024*1024}):await readFile(file)).digest('hex');
const requested=(process.env.QUALITY_READ_REPLAY_CASES??'').split(',').filter(Boolean),report={engine,url:url.href,sourceRef,source,build,requested,runtime:sourceRef?'frozen-production':'uncommitted-production-diagnostic',earnedFixture:{file:fixturePath,source:fixture._source},scope:'Same legitimately earned pre-collection S01 result, resumed in isolated browser profiles. Auto-skip/star/version/storage and S30/first-clear boundary variants are explicit prepared cases. No battle win, currency or clock injected into a running game. No physical-device or human original-speed/listening acceptance.',cases:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true,...(engine==='chromium'?{args:['--mute-audio']}:{})});let activePage;
const saveAt=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),V100_PRIMARY_STORAGE_KEY);
async function canonicalAt(page){return page.evaluate(async key=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{return await new Promise((resolve,reject)=>{const r=db.transaction('saves','readonly').objectStore('saves').get('current');r.onsuccess=()=>resolve(JSON.parse(r.result.serialized));r.onerror=()=>reject(r.error);});}finally{db.close();}},V100_PRIMARY_STORAGE_KEY);}
function business(save){const copy=structuredClone(save);delete copy.revision;delete copy.updatedAt;if(copy.lastResult)delete copy.lastResult.finalizedAt;return copy;}
async function boot(page){await page.goto(url.href);await dismissInstallOffer(page,{timeout:30000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);const notice=page.getByText('オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。',{exact:true});if(await notice.isVisible())await notice.locator('..').getByRole('button',{name:'閉じる',exact:true}).click();await page.evaluate(()=>document.fonts.ready);}
async function shot(page,file){await page.waitForFunction(()=>Array.from(document.images).filter(i=>i.getClientRects().length).every(i=>i.complete&&i.naturalWidth>0),null,{timeout:15000});await page.screenshot({path:path.join(out,file)});}
const resultPanel=page=>page.locator('section[aria-label="戦闘結果"]'),claim=page=>resultPanel(page).getByRole('button',{name:/^報酬を受け取る/});
const phase=page=>page.locator('#v100-campaign').getAttribute('data-v100-phase');
async function stableWrite(page){await page.waitForFunction(()=>!document.querySelector('#v100-campaign[aria-busy="true"]'));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function readConversation(page,record){const before=await saveAt(page);await resultPanel(page).getByRole('button',{name:'会話を読み返す',exact:true}).click();const dialog=page.getByRole('dialog',{name:'会話記録',exact:true});await dialog.waitFor();await claim(page).press('Enter');await stableWrite(page);assert.deepEqual(await saveAt(page),before);assert.equal(await dialog.isVisible(),true);record.backgroundCollectionBlocked=true;record.readNodes=[];
 for(let i=0;i<100&&await dialog.isVisible();i++){const index=await dialog.getAttribute('data-v100-replay-index');record.readNodes.push(index);if(i===0)await shot(page,record.case+'-conversation.png');await dialog.locator('.v100-primary').click();await page.waitForFunction(index=>{const d=document.querySelector('[data-v100-replay-index]');return !d||d.getAttribute('data-v100-replay-index')!==index;},index);}
 assert.equal(await dialog.isVisible(),false);assert.equal(await phase(page),'result');assert.deepEqual(await saveAt(page),before);record.readOnlyConversationPreservedSave=true;
}
function result(number,run,hp=680){return createV100BattleResult({stageId:V100_STAGE_IDS[number-1],battleRunId:run,won:true,objectiveComplete:true,bossDefeated:true,vehicleHp:hp,vehicleMaxHp:680});}
function resultCheckpoint(save,value,firstClear){const pending=recordV100PendingResult(save,value);assert.equal(pending.applied,true);const ids=v100StoryEventIdsForStage(value.stageNumber).filter(id=>!id.endsWith(':pre'));return normalizeV100Save({...pending.save,campaignStarted:true,playerName:'西新',readStoryEventIds:[...new Set([...pending.save.readStoryEventIds,...ids])],readStoryVersions:{...pending.save.readStoryVersions,...Object.fromEntries(ids.map(id=>[id,V100_STORY_SCRIPT_VERSION]))},flowState:{phase:'result',eventId:null,stageId:value.stageId,stageNumber:value.stageNumber,nodeIndex:0,firstClear,finalized:false,scriptVersion:V100_STORY_SCRIPT_VERSION},eventCursor:null});}
function preparedS30(firstClear){let save=normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,playerName:'西新'});for(let n=1;n<=(firstClear?29:30);n++){const p=recordV100PendingResult(save,result(n,'prepared-first-'+n));assert.equal(p.applied,true);const r=finalizeV100PendingResult(p.save);assert.equal(r.applied,true);save=r.save;}return resultCheckpoint(save,result(30,'prepared-s30-'+(firstClear?'first':'replay')),firstClear);}
function starImprovement(){let save=normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,playerName:'西新'});const p=recordV100PendingResult(save,result(1,'one-star-first',400)),paid=finalizeV100PendingResult(p.save);assert.equal(paid.applied,true);return resultCheckpoint(paid.save,result(1,'three-star-replay'),false);}
const scenarios=[
 {id:'earned-one-step',seed:()=>structuredClone(fixture.save),read:true,layouts:true,video:true},
 {id:'auto-skip-reading',seed:()=>({...structuredClone(fixture.save),settings:{...fixture.save.settings,autoSkipReadStory:true}}),read:true},
 {id:'double-confirm',seed:()=>structuredClone(fixture.save),double:true},
 {id:'main-write-failure',seed:()=>structuredClone(fixture.save),fault:'main'},
 {id:'mirror-write-failure',seed:()=>structuredClone(fixture.save),fault:'mirror'},
 {id:'unread-post',seed:()=>{const s=structuredClone(fixture.save);s.readStoryEventIds=s.readStoryEventIds.filter(id=>id!=='v100:event:s01:post');return s;},ordinary:true},
 {id:'stale-script',seed:()=>{const s=structuredClone(fixture.save);s.readStoryVersions['v100:event:s01:first-clear-post']='older-script';return s;},ordinary:true},
 {id:'first-clear',seed:()=>resultCheckpoint(normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,playerName:'西新'}),result(1,'prepared-first-clear'),true),ordinary:true,finishOrdinary:true},
 {id:'s30-replay',seed:()=>preparedS30(false)},
 {id:'s30-first-clear',seed:()=>preparedS30(true),ordinary:true},
 {id:'new-star',seed:()=>starImprovement()},
];
try{for(const scenario of scenarios){if(requested.length&&!requested.includes(scenario.id))continue;const seed=normalizeV100Save(scenario.seed()),record={case:scenario.id,preparedVariant:scenario.id!=='earned-one-step'},context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,serviceWorkers:'block',...(scenario.video?{recordVideo:{dir:path.join(out,'videos'),size:{width:844,height:390}}}:{})});report.cases.push(record);await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));const page=await context.newPage();activePage=page;page.on('pageerror',e=>report.errors.push(String(e)));
 try{await boot(page);await resultPanel(page).waitFor();const before=await saveAt(page);assert.equal(await phase(page),'result');record.beforeCaps=before.caps;
  if(scenario.ordinary){assert.equal(await claim(page).count(),0);const expected=finalizeV100PendingResult(before,{result:before.pendingResult});assert.equal(expected.applied,true);await shot(page,scenario.id+'-result.png');await resultPanel(page).getByRole('button',{name:'次の場面へ',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#v100-campaign')?.dataset.v100Phase==='post');assert.equal((await saveAt(page)).caps,before.caps);record.firstOrUnreadStoryPreserved=true;
   if(scenario.finishOrdinary){for(let n=0;n<100&&await phase(page)!=='map';n++){const shell=page.locator('section[data-v100-event-id]'),cursor={phase:await phase(page),id:await shell.getAttribute('data-v100-event-id'),index:await shell.getAttribute('data-v100-node-index')};await shell.locator('.v100-event-actions .v100-primary').click();await page.waitForFunction(c=>{const s=document.querySelector('section[data-v100-event-id]');return document.querySelector('#v100-campaign')?.dataset.v100Phase!==c.phase||s?.dataset.v100EventId!==c.id||s?.dataset.v100NodeIndex!==c.index;},cursor);}assert.equal(await phase(page),'map');assert.equal((await saveAt(page)).caps,expected.save.caps);record.ordinaryFirstClearRewardPreserved=true;}
   continue;
  }
  assert.equal(await claim(page).count(),1);const expected=collectV100ReadReplayReward(before,before.pendingResult);assert.equal(expected.applied,true);const expectedSave={...expected.save,...v100StoryFlowCheckpoint(expected.flow)};const displayedReward=expected.save.caps-before.caps;assert.equal(Number(await claim(page).getAttribute('data-v100-reward-caps')),displayedReward);assert.ok((await claim(page).innerText()).includes('+'+displayedReward+' CAPS'));record.displayedReward=displayedReward;
  if(scenario.layouts){record.layouts=[];for(const viewport of [{width:1280,height:720},{width:844,height:390},{width:844,height:340}]){await page.setViewportSize(viewport);for(const button of [claim(page),resultPanel(page).getByRole('button',{name:'会話を読み返す',exact:true})]){const r=await button.boundingBox();assert.ok(r&&r.height>=44&&r.x>=0&&r.y>=0&&r.x+r.width<=viewport.width+1&&r.y+r.height<=viewport.height+1,JSON.stringify(r));}record.layouts.push(viewport);await shot(page,scenario.id+`-${viewport.width}x${viewport.height}.png`);}await page.setViewportSize({width:844,height:390});}
  if(scenario.read)await readConversation(page,record);
  if(scenario.fault==='main'){
   await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;window.__replayFaults=0;IDBObjectStore.prototype.put=function(...args){if(this.name==='saves'){window.__replayFaults++;throw new DOMException('QA main save failure','QuotaExceededError');}return original.apply(this,args);};window.__restoreReplayWrites=()=>{IDBObjectStore.prototype.put=original;};});
   try{await claim(page).click();await page.waitForFunction(()=>window.__replayFaults>0);await stableWrite(page);assert.equal(await phase(page),'result');assert.deepEqual(await saveAt(page),before);assert.deepEqual(business(await canonicalAt(page)),business(before));await page.getByText('セーブを書き込めませんでした。現在の画面と進行を保持します。',{exact:true}).waitFor();record.failedSavePreservedPendingAndCurrency=true;await shot(page,'main-write-failure.png');}finally{await page.evaluate(()=>window.__restoreReplayWrites());}
  }
  if(scenario.fault==='mirror')await page.evaluate(key=>{const original=Storage.prototype.setItem;window.__replayFaults=0;Storage.prototype.setItem=function(...args){if(String(args[0]).startsWith(key)){window.__replayFaults++;throw new DOMException('QA mirror save failure','QuotaExceededError');}return original.apply(this,args);};window.__restoreReplayWrites=()=>{Storage.prototype.setItem=original;};},V100_PRIMARY_STORAGE_KEY);
  try{if(scenario.double){await claim(page).focus();await page.keyboard.press('Enter');await page.keyboard.press('Enter');record.confirmKeyPresses=2;}else{await claim(page).click();record.collectInputs=1;}await page.waitForFunction(()=>document.querySelector('#v100-campaign')?.dataset.v100Phase==='map');await stableWrite(page);
   const paid=await canonicalAt(page);assert.deepEqual(business(paid),business(expectedSave));assert.equal(paid.pendingResult,null);assert.equal(paid.receipts.filter(id=>id===`v100:s${String(seed.pendingResult.stageNumber).padStart(2,'0')}:replay:${seed.pendingResult.battleRunId}`).length,1);record.afterCaps=paid.caps;record.rewardCaps=paid.caps-before.caps;record.paidOnce=true;record.returnedToMap=true;
   if(scenario.id==='earned-one-step')assert.equal(paid.caps,fixture._source.settledCaps);
   if(scenario.fault==='mirror'){assert.deepEqual(await saveAt(page),before);await page.getByText('セーブは保存済みです。予備コピーを作れませんでした。データ管理から書き出してください。',{exact:true}).waitFor();record.canonicalPaidOldMirrorPreserved=true;record.backupWarningRetained=true;await shot(page,'mirror-write-failure.png');}
   else{assert.deepEqual(business(await saveAt(page)),business(expectedSave));await shot(page,scenario.id+'-map.png');}
  }finally{if(scenario.fault==='mirror')await page.evaluate(()=>window.__restoreReplayWrites());}
  await page.reload();await dismissInstallOffer(page,{timeout:30000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);await page.waitForFunction(()=>document.querySelector('#v100-campaign')?.dataset.v100Phase==='map');assert.deepEqual(business(await saveAt(page)),business(expectedSave));assert.equal(await claim(page).count(),0);record.reloadPreservedSettledReward=true;record.video=await page.video()?.path();
 }catch(error){record.failure=String(error);await page.screenshot({path:path.join(out,scenario.id+'-failure.png')}).catch(()=>{});report.visibleButtons=await page.getByRole('button').allTextContents().catch(()=>[]);throw error;}finally{await context.close();}
}
 assert.ok(report.cases.length>0);for(const id of requested)assert.ok(report.cases.some(c=>c.case===id));assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=String(error);if(activePage&&!activePage.isClosed())await activePage.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({engine,status:report.status,cases:report.cases.length,out}));
