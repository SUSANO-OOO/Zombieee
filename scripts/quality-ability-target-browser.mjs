import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save,validateV100SavePayload} from '../app/v100Save.js';
import {V100_STAGE_IDS,V100_UNITS} from '../app/v100Registry.js';
import {MANUAL_ABILITY_REGISTRY} from '../app/manualAbilities.js';
const base=new URL(process.env.QUALITY_ABILITY_URL);assert.ok(['localhost','127.0.0.1'].includes(base.hostname));
const root=path.resolve(process.env.QUALITY_ABILITY_ROOT),out=path.resolve(process.env.QUALITY_ABILITY_OUT);
const engine=process.env.QUALITY_ABILITY_ENGINE??'webkit',before=process.env.QUALITY_ABILITY_BEFORE==='1';
const viewport=engine==='webkit'?{width:844,height:340}:{width:1280,height:720};
await mkdir(out,{recursive:false});
const driver=await readFile(new URL(import.meta.url));await writeFile(out+'/executed-driver.mjs',driver);
const report={engine,before,viewport,build:await productionBuildIdentity(root),scriptSha256:createHash('sha256').update(driver).digest('hex'),
 scope:'Prepared paired target choices using the same local-only fixture in both builds. Owner ordinary attacks and enemy attacks held for isolation; enemy movement and manual ability use run on ordinary simulation/native buttons. Not natural difficulty, human playback/audio or whole-game acceptance.',cases:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true});
try{for(const [kind,gunman] of [['ranger','red-panther-smg'],['ranger','red-panther-commander'],['babayaga','red-panther-smg'],['babayaga','red-panther-commander'],['scout','red-panther-smg'],['engineer','red-panther-smg']]){
 const label=kind+'-'+gunman,row={kind,gunman,label,requests:[]};report.cases.push(row);
 const ids=V100_UNITS.map(u=>u.id),seed=normalizeV100Save({...createDefaultV100Save({settings:{bgmEnabled:false}}),campaignStarted:true,
  ownedUnitIds:ids,registeredUnitIds:ids,formationSlots:[MANUAL_ABILITY_REGISTRY[kind].unitId,null,null,null,null,null,null],
  completedStageIds:V100_STAGE_IDS.slice(0,22),availableStageIds:V100_STAGE_IDS,
  flowState:{phase:'formation',destination:'formation',stageId:V100_STAGE_IDS[0],stageNumber:1,eventId:null,nodeIndex:0,firstClear:false,finalized:true}});
 assert.ok(validateV100SavePayload(seed).ok);
 const context=await browser.newContext({viewport,hasTouch:true,recordVideo:{dir:path.join(out,label),size:viewport}});
 await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
 const page=await context.newPage();page.setDefaultTimeout(30000);
 page.on('pageerror',e=>report.errors.push(label+': '+String(e)));page.on('requestfailed',r=>row.requests.push({url:r.url(),error:r.failure()}));
 try{
  await page.goto(base.href,{waitUntil:'domcontentloaded'});
  await dismissInstallOffer(page,{timeout:30000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
  await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
  await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running&&document.documentElement.dataset.assetLoadState==='ready');
  const kinds=['ranger','babayaga'].includes(kind)?[kind,'runner',gunman]:[kind,'pall-manta','red-panther-knife'];
  for(const k of kinds)await page.evaluate(k=>window.__ASHFALL_BATTLE_QA__.ensureUnitRenderProofAsset(k),k);
  row.setup=await page.evaluate(({kind,gunman})=>window.__ASHFALL_BATTLE_QA__.prepareManualAbilityTargetChoiceProof(kind,gunman),{kind,gunman});
  const notice=page.getByText('オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。',{exact:true});
  if(await notice.isVisible())await notice.locator('..').getByRole('button',{name:'閉じる',exact:true}).click();
  row.beforeSave=await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100'));
  await page.getByRole('button',{name:'戦闘を再開',exact:true}).click();
  const button=page.locator(`.manual-ability-ready[data-fighter-id="${row.setup.ownerId}"]`);
  await button.waitFor();await page.screenshot({path:path.join(out,label+'-before-input.png')});
  await button.click();
  await page.waitForFunction(id=>window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(f=>f.id===id)?.manualAbility?.activationId>0,row.setup.ownerId);
  row.activated=await page.evaluate(id=>{const s=window.__ASHFALL_BATTLE_QA__.getSnapshot();return{time:s.time,owner:s.fighters.find(f=>f.id===id)};},row.setup.ownerId);
  assert.equal(row.activated.owner.manualAbility.target.targetId,row.setup.targets[before?0:1].id,'Actual runtime primary target');
  await page.waitForTimeout(2600);
  row.final=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__.getSnapshot();return{time:s.time,fighters:s.fighters,receipts:s.manualAbilityReceipts};});
  row.draw=await page.evaluate(ids=>window.__ASHFALL_BATTLE_QA__.getV105CorrectionAudit(ids),[row.setup.ownerId,...row.setup.targets.map(t=>t.id)]);
  await page.screenshot({path:path.join(out,label+'-after-input.png')});
  assert.equal(await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100')),row.beforeSave);
  assert.deepEqual(row.requests,[]);row.status='passed';
 }catch(e){row.status='failed';row.error=String(e);await page.screenshot({path:path.join(out,label+'-failure.png')}).catch(()=>{});throw e;}
 finally{await context.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}
}assert.deepEqual(report.errors,[]);report.status='passed';}
finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,engine,before,cases:report.cases.map(c=>({label:c.label,status:c.status,target:c.activated?.owner?.manualAbility?.target?.targetId}))}));
