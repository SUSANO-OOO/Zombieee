import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'playwright';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save,deserializeV100Save,V100_PRIMARY_STORAGE_KEY} from '../app/v100Save.js';
import {V100_UNITS,V100_STAGE_IDS,V100_BOSSES} from '../app/v100Registry.js';
import {purchaseV100Unit} from '../app/v100Transactions.js';
import {campaignUnitIdToCombatKind} from '../app/campaign.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';

const url=new URL(process.env.QUALITY_PERSONNEL_URL),out=path.resolve(process.env.QUALITY_PERSONNEL_OUT);
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
await mkdir(out,{recursive:false});
const engine=process.env.QUALITY_PERSONNEL_ENGINE??'chromium',before=process.env.QUALITY_PERSONNEL_BEFORE==='1';
assert.ok(['chromium','webkit'].includes(engine));
const requestedCases=(process.env.QUALITY_PERSONNEL_CASES??'').split(',').filter(Boolean),runCase=id=>!requestedCases.length||requestedCases.includes(id);
const sourceRef=process.env.QUALITY_PERSONNEL_SOURCE_REF??null,root=path.resolve(process.env.QUALITY_PERSONNEL_BUILD_ROOT??'.');
const build=await productionBuildIdentity(root),source={};
if(process.env.QUALITY_PERSONNEL_BUILD_ROOT){const snapshot=JSON.parse(await readFile(path.join(root,'snapshot.json'),'utf8'));assert.equal(snapshot.sourceHead,sourceRef);assert.equal(snapshot.combinedSha256,build.combinedSha256);}
for(const file of ['app/V100Campaign.tsx','app/v100CommandPolish.css'])source[file]=createHash('sha256').update(sourceRef?execFileSync('git',['show',sourceRef+':'+file],{maxBuffer:4*1024*1024}):await readFile(file)).digest('hex');
const earnedPath=path.resolve(process.env.QUALITY_PERSONNEL_EARNED??'tests/fixtures/quality-earned-s01-bf1a2.json');
const earnedReport=JSON.parse(await readFile(earnedPath,'utf8')),earned=normalizeV100Save(earnedReport.finalSave??earnedReport.save);
assert.equal(earnedReport.technicalStatus??earnedReport._source?.technicalStatus,'passed');if(earnedReport.errors)assert.deepEqual(earnedReport.errors,[]);assert.equal(earned.completedStageIds.length,1);assert.equal(earned.caps,112);
const report={qaScriptSha256:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),engine,before,requestedCases,url:url.href,runtime:sourceRef?'frozen-production':'uncommitted-production-diagnostic',sourceRef,source,build,earnedSource:{file:earnedPath,build:earnedReport.build??earnedReport._source,sha256:createHash('sha256').update(await readFile(earnedPath)).digest('hex')},scope:'Isolated UI scenarios. Earned S01 save is resumed through real controls; full-party/all-met/initial-map/mode-unlock variants are explicit prepared cases. Only the final case deploys through an ordinary battle card. No debugging spawn, victory, clock or currency mutation; no physical-device or human playback acceptance.',cases:[],errors:[],physicalAcceptance:false,wholeCampaignAcceptance:false};
const browser=await({chromium,webkit}[engine]).launch({headless:true,...(engine==='chromium'?{args:['--mute-audio']}:{})});
const stable=s=>Object.fromEntries(Object.entries(s).filter(([k])=>!['updatedAt','revision','saveRevision'].includes(k)));
let activePage;
async function saveAt(page){const raw=await page.evaluate(key=>localStorage.getItem(key),V100_PRIMARY_STORAGE_KEY),r=deserializeV100Save(raw);assert.ok(r.ok);return r.save;}
async function canonicalSaveAt(page){return await page.evaluate(async key=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{return await new Promise((resolve,reject)=>{const r=db.transaction('saves','readonly').objectStore('saves').get('current');r.onsuccess=()=>resolve(JSON.parse(r.result.serialized));r.onerror=()=>reject(r.error);});}finally{db.close();}},V100_PRIMARY_STORAGE_KEY);}
async function open(seed,{video=false}={}){
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,serviceWorkers:'block',...(video?{recordVideo:{dir:path.join(out,'videos'),size:{width:844,height:390}}}:{})});
 await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));const page=await context.newPage();activePage=page;
 page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(url.href);await dismissInstallOffer(page,{timeout:30000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
 await dismissOfflineNotice(page);
 await page.evaluate(()=>document.fonts.ready);return{context,page};
}
async function dismissOfflineNotice(page){
 const notice=page.getByText('オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。',{exact:true});
 if(await notice.isVisible()&&!await page.locator('.v100-recruit-modal[role="dialog"]').isVisible())await notice.locator('..').getByRole('button',{name:'閉じる',exact:true}).click();
}
const roster=page=>page.locator('button.v100-personnel-card');
const focus=page=>page.locator('.v100-personnel-focus');
async function unitScreen(page){await page.getByRole('navigation').getByRole('button',{name:'ユニット',exact:true}).click();await page.locator('section[data-v100-surface="personnel"]').waitFor();}
async function shot(page,name){await page.waitForFunction(()=>Array.from(document.images).filter(im=>im.getClientRects().length>0).every(im=>im.complete&&im.naturalWidth>0&&(!im.closest('.v100-slot-portrait')||im.dataset.loaded==='true')),null,{timeout:15000});await page.screenshot({path:path.join(out,name)});}
async function formationAfterStory(page,record){
 for(let i=0;i<80;i++){
  const phase=await page.locator('#v100-campaign').getAttribute('data-v100-phase');
  if(phase==='formation')return;
  assert.ok(['event','briefing'].includes(phase),'Preserve the ordinary briefing: '+phase);
  const shell=page.locator('section[data-v100-event-id]'),cursor=await shell.getAttribute('data-v100-node-index'),id=await shell.getAttribute('data-v100-event-id');
  const next=page.locator('.v100-event-actions .v100-primary');await next.waitFor();record.storyInputs.push(await next.innerText());await next.click();
  await page.waitForFunction(({phase,cursor,id})=>{const shell=document.querySelector('section[data-v100-event-id]');return document.querySelector('#v100-campaign')?.dataset.v100Phase!==phase||shell?.getAttribute('data-v100-node-index')!==cursor||shell?.getAttribute('data-v100-event-id')!==id;},{phase,cursor,id});
 }
 throw Error('Briefing exceeded finite UI budget');
}
try{
 // All 16 records are exercised, including hidden mobile details, rather than sampling one card.
 if(runCase('initial-16-records')){
 const initial=normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,flowState:{phase:'map',stageId:V100_STAGE_IDS[0],stageNumber:1,destination:'map',nodeIndex:0,firstClear:false,finalized:true}});
 const {context,page}=await open(initial);
 try{
  await unitScreen(page);const saveBefore=await saveAt(page),record={case:'initial-16-records',records:[]};report.cases.push(record);assert.equal(await roster(page).count(),16);
  await shot(page,'initial-roster.png');
  for(let i=0;i<V100_UNITS.length;i++){
   const unit=V100_UNITS[i],known=initial.ownedUnitIds.includes(unit.id)||initial.registeredUnitIds.includes(unit.id),card=roster(page).nth(i),text=await card.innerText(),images=await card.locator('img').count();
   if(!before&&!known){assert.equal(images,0);assert.ok(!text.includes(unit.displayName));assert.match(text,/まだ見ぬ仲間/u);}else{assert.ok(text.includes(unit.displayName));assert.equal(images,1);}
   await card.click();const detailText=await focus(page).innerText();
   if(!before&&!known){assert.ok(!detailText.includes(unit.displayName));assert.equal(await focus(page).locator('img,.v100-unit-skill,.v100-unit-record-heading,.v100-unit-transaction').count(),0);assert.ok(detailText.includes('S'+String(unit.availabilityStageNumber).padStart(2,'0')));}
   else assert.ok(detailText.includes(unit.displayName));
   record.records.push({id:unit.id,known,cardImages:images,identityVisible:text.includes(unit.displayName),detailIdentityVisible:detailText.includes(unit.displayName)});
   if(!known&&!record.unknownScreens){record.unknownScreens=[];for(const viewport of [{width:844,height:340},{width:1280,height:720}]){await page.setViewportSize(viewport);const file=`unmet-${viewport.width}x${viewport.height}.png`;await shot(page,file);record.unknownScreens.push(file);}await page.setViewportSize({width:844,height:390});}
   await page.getByRole('button',{name:'ユニット一覧へ',exact:true}).click();
  }
  assert.deepEqual(stable(await saveAt(page)),stable(saveBefore));record.savePreserved=true;
 }catch(error){await shot(page,'case-failure-'+report.cases.length+'.png').catch(()=>{});report.caseFailureButtons=await page.getByRole('button').allTextContents().catch(()=>[]);throw error;}finally{await context.close();}

 }
 // Registered but unpaid units remain identifiable; owning one does not spend twice or change a slot.
 for(const full of before?[false]:[true,false]){
  if(!runCase(full?'earned-full-party':'earned-free-slot'))continue;
  const seed=structuredClone(earned);if(full)seed.formationSlots=Array.from({length:7},(_,i)=>earned.formationSlots.filter(Boolean)[i%earned.formationSlots.filter(Boolean).length]);
  const {context,page}=await open(seed,{video:!full&&!before});const record={case:full?'earned-full-party':'earned-free-slot',storyInputs:[]};report.cases.push(record);
  try{
   const prior=await saveAt(page),expected=purchaseV100Unit(prior,'unit-nao');assert.equal(expected.applied,true);
   const dialog=page.locator('.v100-recruit-modal[role="dialog"]');await dialog.waitFor();
   record.offerText=await dialog.innerText();await shot(page,`recruit-offer-${full?'full':'free'}.png`);
   await dialog.getByRole('button',{name:/支度を整える/}).click();await dialog.waitFor({state:'hidden'});await dismissOfflineNotice(page);
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')).ownedUnitIds.includes('unit-nao'));
   const purchased=await saveAt(page);assert.deepEqual(stable(purchased),stable(expected.save));assert.deepEqual(purchased.formationSlots,prior.formationSlots);
   record.purchase={beforeCaps:prior.caps,afterCaps:purchased.caps,owned:purchased.ownedUnitIds,slotsUnchanged:true};
   if(before){record.purchaseOpenedPersonnel=await page.locator('section[data-v100-surface="personnel"]').isVisible();await shot(page,'purchase-result-before.png');await unitScreen(page);await roster(page).filter({has:page.getByRole('heading',{name:V100_UNITS.find(u=>u.id==='unit-nao').displayName,exact:true})}).click();record.prepareControls=await page.locator('.v100-unit-prepare').count();await shot(page,'owned-nao-before.png');continue;}
   await page.locator('section[data-v100-surface="personnel"]').waitFor();assert.ok((await focus(page).innerText()).includes(V100_UNITS.find(u=>u.id==='unit-nao').displayName));
   record.purchaseOpenedPersonnel=true;await page.setViewportSize({width:844,height:340});await shot(page,`owned-nao-${full?'full':'free'}-844x340.png`);
   const prepare=page.locator('.v100-unit-prepare');assert.equal(await prepare.count(),1);const box=await prepare.boundingBox();assert.ok(box&&box.height>=44&&box.y>=0&&box.y+box.height<=340);record.prepareLabel=await prepare.innerText();
   await prepare.click();await page.waitForFunction(()=>document.querySelector('#v100-campaign')?.dataset.v100Phase!=='map');await formationAfterStory(page,record);const panel=page.locator('section[data-v100-surface="formation"]');await panel.waitFor();assert.equal(await panel.getAttribute('data-v100-requested-unit'),'unit-nao');
   assert.deepEqual((await saveAt(page)).formationSlots,purchased.formationSlots);await shot(page,`pick-slot-${full?'full':'free'}.png`);
   const index=full?2:purchased.formationSlots.indexOf(null),slot=panel.getByRole('button',{name:new RegExp('^編成枠'+(index+1)+'(?: |$)')});assert.equal(await slot.count(),1);
   if(full){
    const beforeFailure=await saveAt(page);
    await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;window.__qualityBlockedWrites=0;IDBObjectStore.prototype.put=function(...args){if(this.name==='saves'){window.__qualityBlockedWrites++;throw new DOMException('QA injected write failure','QuotaExceededError');}return original.apply(this,args);};window.__qualityRestoreWrites=()=>{IDBObjectStore.prototype.put=original;};});
    try{await slot.click();await page.waitForFunction(()=>window.__qualityBlockedWrites>0);await page.waitForFunction(()=>!document.querySelector('#v100-campaign[aria-busy="true"]'));assert.deepEqual(stable(await saveAt(page)),stable(beforeFailure));assert.equal(await panel.getAttribute('data-v100-requested-unit'),'unit-nao');record.failedWrite={blockedWrites:await page.evaluate(()=>window.__qualityBlockedWrites),savePreserved:true,intentRetained:true};await shot(page,'slot-save-failure.png');}
    finally{await page.evaluate(()=>window.__qualityRestoreWrites());}
   }
   await slot.click();await page.waitForFunction(({index})=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')).formationSlots[index]==='unit-nao',{index});await page.waitForFunction(()=>!document.querySelector('[data-v100-requested-unit="unit-nao"]'));
   const assigned=await saveAt(page),expectedSlots=[...purchased.formationSlots];expectedSlots[index]='unit-nao';assert.deepEqual(assigned.formationSlots,expectedSlots);assert.equal(assigned.caps,purchased.caps);assert.deepEqual(assigned.ownedUnitIds,purchased.ownedUnitIds);assert.deepEqual(assigned.unitLevels,purchased.unitLevels);if(full){assert.equal(await page.getByText('セーブを書き込めませんでした。現在の画面と進行を保持します。',{exact:true}).isVisible(),false);record.failedWrite.errorClearedAfterSuccessfulRetry=true;}record.assignment={index,slots:assigned.formationSlots,onlySelectedSlotChanged:true};await shot(page,`assigned-${full?'full':'free'}.png`);
   if(full){
    const beforeMirrorFailure=await saveAt(page),slotIndex=index;
    await page.evaluate(key=>{const original=Storage.prototype.setItem;window.__qualityMirrorFailures=0;Storage.prototype.setItem=function(...args){if(String(args[0]).startsWith(key)){window.__qualityMirrorFailures++;throw new DOMException('QA injected mirror-only failure','QuotaExceededError');}return original.apply(this,args);};window.__qualityRestoreMirrors=()=>{Storage.prototype.setItem=original;};},V100_PRIMARY_STORAGE_KEY);
    try{await panel.getByRole('button',{name:'枠を空ける',exact:true}).click();await page.waitForFunction(()=>window.__qualityMirrorFailures>0&&!document.querySelector('#v100-campaign[aria-busy="true"]'));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     const warning=page.getByText('セーブは保存済みです。予備コピーを作れませんでした。データ管理から書き出してください。',{exact:true});assert.equal(await warning.isVisible(),true);
     const canonical=await canonicalSaveAt(page);
     const expected=structuredClone(beforeMirrorFailure);expected.formationSlots[slotIndex]=null;assert.deepEqual(stable(canonical),stable(expected));assert.deepEqual(stable(await saveAt(page)),stable(beforeMirrorFailure));expectedSlots[slotIndex]=null;record.mirrorFailure={canonicalCommitted:true,backupWarningRetained:true,oldMirrorPreserved:true,writeFailures:await page.evaluate(()=>window.__qualityMirrorFailures)};await shot(page,'mirror-failure-warning.png');
    }finally{await page.evaluate(()=>window.__qualityRestoreMirrors());}
    await page.reload();await dismissInstallOffer(page,{timeout:30000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);await panel.waitFor();assert.deepEqual((await saveAt(page)).formationSlots,expectedSlots);record.reloadPreserved=true;}
   else{
    await page.setViewportSize({width:844,height:390});await page.getByRole('button',{name:'戦闘へ',exact:true}).click();await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running&&document.documentElement.dataset.assetLoadState==='ready');
    const kind=campaignUnitIdToCombatKind('unit-nao'),card=page.locator(`button.unit-card[data-kind="${kind}"]`);await card.waitFor();await page.waitForFunction(kind=>{const card=document.querySelector(`button.unit-card[data-kind="${kind}"]`);return card&&!card.disabled;},kind,{timeout:20000});await card.click();record.afterDeployClick=await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.getSnapshot());
    await page.waitForFunction(kind=>window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.some(f=>f.side==='human'&&f.kind===kind&&f.hp>0&&f.combatReady&&f.animationPresentation?.deployCompleted),kind);
    const readyTime=await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.getSnapshot().time);await page.waitForFunction(time=>window.__ASHFALL_BATTLE_QA__.getSnapshot().time>=time+2,readyTime);
    record.deployed=await page.evaluate(kind=>{const s=window.__ASHFALL_BATTLE_QA__.getSnapshot();return{time:s.time,kind,fighters:s.fighters.filter(f=>f.side==='human'&&f.kind===kind),baseHp:s.baseHp};},kind);await shot(page,'joined-nao-deployed.png');record.video=await page.video()?.path();
   }
  }catch(error){await shot(page,'case-failure-'+report.cases.length+'.png').catch(()=>{});report.caseFailureButtons=await page.getByRole('button').allTextContents().catch(()=>[]);throw error;}finally{await context.close();}
 }
 if(!before&&runCase('paisen-rescue-restriction')){
  const seed=normalizeV100Save({...earned,receipts:[...earned.receipts,'v100:recruit-offer:unit-nao:seen']});const {context,page}=await open(seed);const record={case:'paisen-rescue-restriction',storyInputs:[]};report.cases.push(record);
  try{await unitScreen(page);await roster(page).filter({has:page.getByRole('heading',{name:V100_UNITS.find(u=>u.id==='unit-paisen').displayName,exact:true})}).click();await page.locator('.v100-unit-prepare').click();await page.waitForFunction(()=>document.querySelector('#v100-campaign')?.dataset.v100Phase!=='map');await formationAfterStory(page,record);const panel=page.locator('section[data-v100-surface="formation"]');assert.equal(await panel.getAttribute('data-v100-requested-unit'),'unit-paisen');assert.match(await panel.locator('.v100-callin-heading').innerText(),/救助中/u);assert.deepEqual((await saveAt(page)).formationSlots,seed.formationSlots);await shot(page,'paisen-still-rescuing.png');const beforeCancel=await saveAt(page);await panel.getByRole('button',{name:'あとで選ぶ',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-v100-requested-unit="unit-paisen"]'));assert.deepEqual(stable(await saveAt(page)),stable(beforeCancel));record.formationPreserved=true;record.cancelDoesNotWriteSave=true;
  }catch(error){await shot(page,'paisen-failure.png').catch(()=>{});throw error;}finally{await context.close();}
 }
 if(!before&&runCase('mode-preparation-placement')){
  const seed=normalizeV100Save({...earned,completedStageIds:V100_STAGE_IDS.slice(0,3),availableStageIds:V100_STAGE_IDS.slice(0,4),receipts:[...earned.receipts,V100_BOSSES[0].firstDefeatReceipt,'v100:recruit-offer:unit-nao:seen']});const {context,page}=await open(seed);const record={case:'mode-preparation-placement',preparedBossUnlock:true};report.cases.push(record);
  try{await page.getByRole('button',{name:'モード選択',exact:true}).click();await page.getByRole('button',{name:/^異常発生/}).click();await page.getByRole('button',{name:'出撃編成を変更',exact:true}).click();await page.locator('section[data-v100-surface="formation"]').waitFor();await unitScreen(page);await roster(page).filter({has:page.getByRole('heading',{name:V100_UNITS.find(u=>u.id==='unit-paisen').displayName,exact:true})}).click();assert.match(await page.locator('.v100-unit-prepare').innerText(),/迎撃の編成へ/u);await page.locator('.v100-unit-prepare').click();const panel=page.locator('section[data-v100-surface="formation"]');await panel.waitFor();assert.equal(await panel.getAttribute('data-v100-requested-unit'),'unit-paisen');assert.doesNotMatch(await panel.locator('.v100-callin-heading').innerText(),/救助中/u);const beforeSlot=await saveAt(page),index=beforeSlot.formationSlots.indexOf(null);await panel.getByRole('button',{name:new RegExp('^編成枠'+(index+1)+'(?: |$)')}).click();await page.waitForFunction(index=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')).formationSlots[index]==='unit-paisen',index);const expected=structuredClone(beforeSlot);expected.formationSlots[index]='unit-paisen';assert.deepEqual(stable(await saveAt(page)),stable(expected));record.onlySelectedSlotChanged=true;record.stageRestrictionNotAppliedToOtherModes=true;await shot(page,'mode-paisen-assigned.png');
  }catch(error){await page.screenshot({path:path.join(out,'mode-failure.png')}).catch(()=>{});throw error;}finally{await context.close();}
 }
 if(!before&&runCase('locked-stage-request-does-not-leak')){
  const seed=normalizeV100Save({...earned,formationSlots:earned.formationSlots.map(id=>id==='unit-babayaga'?null:id),receipts:[...earned.receipts,'v100:recruit-offer:unit-nao:seen']});const {context,page}=await open(seed);const record={case:'locked-stage-request-does-not-leak',storyInputs:[]};report.cases.push(record);
  try{await page.locator('button.v100-map-node[data-stage-number="3"]').click();await unitScreen(page);await roster(page).filter({has:page.getByRole('heading',{name:V100_UNITS.find(u=>u.id==='unit-babayaga').displayName,exact:true})}).click();assert.match(await page.locator('.v100-unit-prepare').innerText(),/S03の編成へ/u);const prior=await saveAt(page);await page.locator('.v100-unit-prepare').click();await page.getByText('ひとつ前の作戦をクリアすると、ここへ進める。',{exact:true}).waitFor();assert.deepEqual(stable(await saveAt(page)),stable(prior));await page.getByRole('navigation').getByRole('button',{name:'ステージ',exact:true}).click();await page.locator('button.v100-map-node[data-stage-number="2"]').click();await page.getByRole('button',{name:'編成して出撃',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#v100-campaign')?.dataset.v100Phase!=='map');await formationAfterStory(page,record);const panel=page.locator('section[data-v100-surface="formation"]');assert.equal(await panel.getAttribute('data-v100-requested-unit'),null);const beforeSlot=await saveAt(page);await panel.getByRole('button',{name:/^編成枠1(?: |$)/}).click();assert.equal(await panel.locator('.v100-formation-workspace').isVisible(),true);assert.deepEqual(stable(await saveAt(page)),stable(beforeSlot));record.rejectedRequestDidNotPersist=true;record.ordinarySlotOpensPickerWithoutAssignment=true;await shot(page,'locked-request-cleared.png');
  }catch(error){await page.screenshot({path:path.join(out,'locked-stage-failure.png')}).catch(()=>{});report.caseFailureButtons=await page.getByRole('button').allTextContents().catch(()=>[]);throw error;}finally{await context.close();}
 }
 if(!before&&runCase('purchase-mirror-warning')){
  const {context,page}=await open(earned),record={case:'purchase-mirror-warning'};report.cases.push(record);
  try{const prior=await saveAt(page),expected=purchaseV100Unit(prior,'unit-nao');assert.equal(expected.applied,true);await page.evaluate(key=>{const original=Storage.prototype.setItem;window.__qualityMirrorFailures=0;Storage.prototype.setItem=function(...args){if(String(args[0]).startsWith(key)){window.__qualityMirrorFailures++;throw new DOMException('QA purchase mirror failure','QuotaExceededError');}return original.apply(this,args);};window.__qualityRestoreMirrors=()=>{Storage.prototype.setItem=original;};},V100_PRIMARY_STORAGE_KEY);
   try{const dialog=page.locator('.v100-recruit-modal[role="dialog"]');await dialog.getByRole('button',{name:/支度を整える/}).click();await page.locator('section[data-v100-surface="personnel"]').waitFor();await dismissOfflineNotice(page);await page.waitForFunction(()=>window.__qualityMirrorFailures>0&&!document.querySelector('#v100-campaign[aria-busy="true"]'));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await page.getByText('セーブは保存済みです。予備コピーを作れませんでした。データ管理から書き出してください。',{exact:true}).isVisible(),true);assert.deepEqual(stable(await canonicalSaveAt(page)),stable(expected.save));assert.deepEqual(stable(await saveAt(page)),stable(prior));assert.ok((await focus(page).innerText()).includes(V100_UNITS.find(u=>u.id==='unit-nao').displayName));record.backupWarningSurvivesAutomaticNavigation=true;record.canonicalPurchaseCommittedOnce=true;await shot(page,'purchase-mirror-warning.png');}finally{await page.evaluate(()=>window.__qualityRestoreMirrors());}
   await page.reload();await dismissInstallOffer(page,{timeout:30000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);await page.locator('#v100-campaign').waitFor();assert.deepEqual(stable(await saveAt(page)),stable(expected.save));record.reloadRecoveredCanonicalPurchase=true;
  }catch(error){await page.screenshot({path:path.join(out,'purchase-mirror-failure.png')}).catch(()=>{});throw error;}finally{await context.close();}
 }
 if(!before&&runCase('all-16-met')){
  const seed=normalizeV100Save({...earned,registeredUnitIds:V100_UNITS.map(u=>u.id),receipts:[...earned.receipts,'v100:recruit-offer:unit-nao:seen']});const {context,page}=await open(seed);
  try{await unitScreen(page);assert.equal(await roster(page).count(),16);const saveBefore=await saveAt(page);for(let i=0;i<16;i++){const card=roster(page).nth(i);assert.ok((await card.innerText()).includes(V100_UNITS[i].displayName));assert.equal(await card.locator('img').count(),1);await card.click();assert.ok((await focus(page).innerText()).includes(V100_UNITS[i].displayName));assert.ok(await focus(page).locator('img').count()>0);assert.equal(await focus(page).locator('.v100-unit-record-meta').count(),1);await page.getByRole('button',{name:'ユニット一覧へ',exact:true}).click();}assert.deepEqual(stable(await saveAt(page)),stable(saveBefore));report.cases.push({case:'all-16-met',known:16});await shot(page,'all-met-roster.png');}catch(error){await shot(page,'case-failure-'+report.cases.length+'.png').catch(()=>{});report.caseFailureButtons=await page.getByRole('button').allTextContents().catch(()=>[]);throw error;}finally{await context.close();}
 }
 assert.ok(report.cases.length>0);for(const id of requestedCases)assert.ok(report.cases.some(c=>c.case===id),'Requested case did not execute: '+id);assert.deepEqual(report.errors,[]);report.status=before?'observed-before':'passed';
}catch(e){report.status='failed';report.failure=String(e);report.buttons=await activePage?.getByRole('button').allTextContents().catch(()=>[]);await activePage?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({engine,before,status:report.status,cases:report.cases.length,out}));
