import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {chromium} from 'playwright';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {deferNormalRecruitOffer} from './v100-normal-recruit-offer.mjs';
import {normalCampaignDeploymentCount,normalCampaignDeployOrder,normalCampaignCanSpendVehicleGauge} from './v100-normal-play-contract.mjs';
import {observeVisibleBattleHealthBars,visibleAirstrikeTarget} from './v100-normal-visible-aim.mjs';
import {V100_PRIMARY_STORAGE_KEY,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {finalizeV100PendingResult} from '../app/v100Transactions.js';

const url=new URL(process.env.QUALITY_REPLAY_URL),out=path.resolve(process.env.QUALITY_REPLAY_OUT),root=path.resolve(process.env.QUALITY_REPLAY_BUILD_ROOT);
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));await mkdir(out,{recursive:false});
const snapshot=JSON.parse(await readFile(path.join(root,'snapshot.json'),'utf8')),build=await productionBuildIdentity(root);assert.equal(build.combinedSha256,snapshot.combinedSha256);
const fixture=JSON.parse(await readFile('tests/fixtures/quality-earned-s01-bf1a2.json','utf8')),report={scope:'One ordinary S01 replay resumed from the retained earned S01 save. No victory, currency, clock or fighter injection. Read-only HUD/canvas observations choose normal controls. Raw context video has no audio/human playback acceptance.',sourceHead:snapshot.sourceHead,build,inputs:[],transactions:[],errors:[],manualStoryInputs:[]};
const browser=await chromium.launch({headless:true,args:['--mute-audio']}),context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,serviceWorkers:'block',recordVideo:{dir:path.join(out,'videos'),size:{width:844,height:390}}});
await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(fixture.save));const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
const saveAt=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),V100_PRIMARY_STORAGE_KEY),phase=()=>page.locator('#v100-campaign').getAttribute('data-v100-phase');
const persist=()=>writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
async function click(control){await control.click();await page.waitForFunction(()=>document.querySelector('#v100-campaign')?.getAttribute('aria-busy')!=='true');}
async function storyUntil(destination){for(let i=0;i<100;i++){const p=await phase();if(p===destination)return;assert.ok(['event','post','first-clear-post'].includes(p),'Unexpected story phase '+p);const shell=page.locator('section[data-v100-event-id]'),cursor={phase:p,id:await shell.getAttribute('data-v100-event-id'),index:await shell.getAttribute('data-v100-node-index')};report.manualStoryInputs.push(cursor);await click(page.locator('.v100-event-actions .v100-primary'));await page.waitForFunction(c=>{const s=document.querySelector('section[data-v100-event-id]');return document.querySelector('#v100-campaign')?.dataset.v100Phase!==c.phase||s?.dataset.v100EventId!==c.id||s?.dataset.v100NodeIndex!==c.index;},cursor);}throw Error('Story input budget exceeded');}
try{
 await page.goto(url.href);await dismissInstallOffer(page,{timeout:30000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
 await deferNormalRecruitOffer(page,{saveAt,uiClick:click,stageNumber:1,transactions:report.transactions});
 const offline=page.getByText('オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。',{exact:true});if(await offline.isVisible())await offline.locator('..').getByRole('button',{name:'閉じる',exact:true}).click();
 report.openingSave=await saveAt();assert.equal(report.openingSave.caps,112);assert.ok(report.openingSave.completedStageIds.includes(V100_STAGE_IDS[0]));
 await page.locator('button.v100-map-node[data-stage-number="1"]').click();await click(page.getByRole('button',{name:'再出撃',exact:true}));await page.waitForFunction(()=>document.querySelector('#v100-campaign')?.dataset.v100Phase!=='map');await storyUntil('formation');
 await click(page.getByRole('button',{name:'戦闘へ',exact:true}));await page.waitForFunction(()=>document.querySelector('.v100-deployed-count')&&document.documentElement.dataset.assetLoadState==='ready');
 const started=Date.now();let cursor=0,lastDeploy=0,lastAim=0,lastShot=0,lastEmergency=0;report.maxActive=0;
 while(await phase()==='battle'){
  if(Date.now()-started>300000)throw Error('S01 replay exceeded the five-minute observation budget');
  const counter=page.locator('.v100-deployed-count');if(!await counter.isVisible())break;const count=normalCampaignDeploymentCount(await counter.getAttribute('aria-label'));report.maxActive=Math.max(report.maxActive,count.active);
  const cards=page.locator('button.unit-card[data-kind]'),kinds=await cards.evaluateAll(es=>es.map(e=>e.dataset.kind)),order=normalCampaignDeployOrder(kinds);
  if(order.length&&Date.now()-lastDeploy>500){const kind=order[cursor%order.length],card=cards.nth(kinds.indexOf(kind));if(await card.isEnabled()){await card.click();report.inputs.push({seconds:(Date.now()-started)/1000,action:'deploy',kind});cursor++;lastDeploy=Date.now();}else if(count.active===0&&Date.now()-started>15000&&Date.now()-lastEmergency>12000){const ready=page.locator('button.unit-card[data-kind="scout"]');if(await ready.count()&&await ready.isEnabled()){await ready.click();report.inputs.push({seconds:(Date.now()-started)/1000,action:'emergency-deploy',kind:'scout'});lastEmergency=Date.now();lastDeploy=Date.now();}}}
  if(Date.now()-lastAim>2000&&Date.now()-started>12000){lastAim=Date.now();const air=page.locator('button.support-btn.airstrike'),barrage=page.locator('button.support-btn[data-category="vehicle"]');if((await air.isVisible()&&await air.isEnabled())||(await barrage.isVisible()&&await barrage.isEnabled())){const frame=await observeVisibleBattleHealthBars(page.locator('.game-shell canvas'),{page}),aim=frame?.canvas&&visibleAirstrikeTarget(frame.canvas,frame),visible=frame.status==='read'&&frame.bars.some(b=>b.kind==='enemy'||b.kind==='clone');if(aim&&aim.expectedVisibleBarsInRadius>=2&&await air.isEnabled()&&await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.tagName==='CANVAS',aim.point)){await air.click();await page.mouse.click(aim.point.x,aim.point.y);report.inputs.push({seconds:(Date.now()-started)/1000,action:'airstrike',point:aim.point,pngSha256:frame.pngSha256});}else if(visible&&normalCampaignCanSpendVehicleGauge(report.inputs,true)&&await barrage.isEnabled()){await barrage.click();report.inputs.push({seconds:(Date.now()-started)/1000,action:'barrage'});}}}
  const hits=await page.locator('button.manual-ability-ready.available[aria-disabled="false"]').evaluateAll(es=>es.slice(0,2).map(el=>{const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,top=document.elementFromPoint(x,y);return top&&(top===el||el.contains(top))?{x,y,kind:el.dataset.abilityKind}:null;}).filter(Boolean));for(const hit of hits){await page.mouse.click(hit.x,hit.y);report.inputs.push({seconds:(Date.now()-started)/1000,action:'ability',kind:hit.kind});}
  if(Date.now()-lastShot>30000){lastShot=Date.now();await page.screenshot({path:path.join(out,`battle-${Math.floor((Date.now()-started)/1000)}s.png`)});report.lastHud=await page.locator('.game-shell').innerText();await persist();}
  await page.waitForTimeout(120);
 }
 await page.locator('[data-v100-surface^="result-"]').waitFor();const pending=await saveAt();report.resultText=await page.locator('[aria-label="戦闘結果"]').innerText();await page.screenshot({path:path.join(out,'result-before.png')});
 if(!pending.pendingResult?.won){report.status='observed-defeat';report.finalSave=pending;}
 else{
  assert.equal(pending.pendingResult.stageId,V100_STAGE_IDS[0]);assert.equal(pending.caps,report.openingSave.caps);assert.equal(await page.getByRole('button',{name:'報酬を受け取る',exact:true}).count(),0);
  const raw=JSON.stringify(pending,null,2)+'\n';await writeFile(path.join(out,'pending-result-save.json'),raw);assert.equal(await readFile(path.join(out,'pending-result-save.json'),'utf8'),raw);report.earnedResult=pending.pendingResult;report.pendingSaveSha256=createHash('sha256').update(raw).digest('hex');
  const expected=finalizeV100PendingResult(pending,{result:pending.pendingResult});assert.equal(expected.applied,true);report.expectedCaps=expected.save.caps;report.manualStoryInputs=[];
  await click(page.getByRole('button',{name:'次の場面へ',exact:true}));await page.waitForFunction(()=>document.querySelector('#v100-campaign')?.dataset.v100Phase!=='result');await storyUntil('map');report.after=await saveAt();assert.equal(report.after.caps,expected.save.caps);assert.equal(report.after.pendingResult,null);report.manualCollectInputs=1+report.manualStoryInputs.length;assert.ok(report.manualCollectInputs>1);await page.screenshot({path:path.join(out,'map-after-manual-collection.png')});report.status='passed';
 }
 assert.deepEqual(report.errors,[]);
}catch(error){report.status='failed';report.failure=String(error);await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});report.finalSave=await saveAt().catch(()=>null);throw error;}
finally{report.video=await page.video()?.path();await context.close();await browser.close();await persist();}
console.log(JSON.stringify({status:report.status,inputs:report.inputs.length,manualCollectInputs:report.manualCollectInputs,expectedCaps:report.expectedCaps,out}));
