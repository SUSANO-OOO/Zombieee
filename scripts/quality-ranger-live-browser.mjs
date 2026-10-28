import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {nativeBattleTap} from './v100-normal-tactical-input.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const out=path.resolve(process.env.QUALITY_RANGER_OUT);await mkdir(out,{recursive:true});
const report={build:await productionBuildIdentity(),scope:'Prepared level-1 Mizuchi and Paisen at S03, native deployment/ability input, ordinary simulation speed. No actor/time/HP/result setter. Not natural progression, full-speed human review or physical-device acceptance.',rows:[],inputs:[],errors:[]};
const ids=['unit-mizuchi','unit-paisen'];
const seed=normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,ownedUnitIds:ids,registeredUnitIds:ids,formationSlots:ids,availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,2),flowState:{phase:'formation',stageId:V100_STAGE_IDS[2],stageNumber:3,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:844,height:340},hasTouch:true,recordVideo:{dir:path.join(out,'video'),size:{width:844,height:340}}});
try{
 await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
 const page=await context.newPage();page.setDefaultTimeout(25000);page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
 await page.getByRole('button',{name:'戦闘へ',exact:true}).click();await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot().running&&document.documentElement.dataset.assetLoadState==='ready');
 const seen=new Set(),deployed=new Set(),deadline=Date.now()+90000;let ability=false;
 while(Date.now()<deadline){
  const s=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__?.getSnapshot();return s?{time:s.time,running:s.running,fighters:s.fighters.filter(f=>f.side==='human').map(f=>({id:f.id,kind:f.kind,hp:f.hp,x:f.x,y:f.y,render:f.renderAudit,manual:f.manualAbility}))}:null;});
  if(!s||!s.running)break;
  for(const kind of ['ranger','brawler'])if(!deployed.has(kind)&&await nativeBattleTap(page,page.locator(`button.unit-card[data-kind="${kind}"]`).first())){deployed.add(kind);report.inputs.push({time:s.time,action:'deploy',kind});}
  for(const f of s.fighters.filter(f=>f.kind==='ranger'&&f.hp>0&&f.render?.assetReady)){
   assert.equal(f.render.jointDrawSucceeded,true);report.rows.push({time:s.time,...f});
   const state=f.render.resolvedState;
   if(!seen.has(state)){seen.add(state);await page.screenshot({path:path.join(out,state+'.png')});}
   if(!ability&&seen.has('active')&&await nativeBattleTap(page,page.locator(`button[data-fighter-id="${f.id}"][data-ability-kind]`).first())){ability=true;report.inputs.push({time:s.time,action:'ability',kind:'ranger'});}
  }
  if(ability&&seen.has('special')&&s.time>30)break;
  await page.waitForTimeout(120);
 }
 report.states=[...seen];assert.ok(deployed.has('ranger'));assert.ok(seen.has('move'));assert.ok(seen.has('active'));assert.ok(seen.has('recovery'));assert.ok(seen.has('special'));
 assert.ok(report.rows.every(row=>row.render.jointAtlasPath==='/art/v100/joints/ranger-r3.webp'&&row.render.jointWeightedLowerDrawSucceeded),'all observed poses retain the continuous lower body');
 assert.ok(report.rows.some(row=>row.render.resolvedState==='special'&&row.render.jointRangerManualDrawSucceeded),'manual input must reach the dedicated renderer');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
 for(const key of ['ownedUnitIds','registeredUnitIds','caps','receipts'])assert.deepEqual(saved[key],seed[key]);
 assert.deepEqual(report.errors,[]);report.status='captured-not-visual-acceptance';
}catch(error){report.status='failed';report.error=String(error);throw error;}
finally{await context.close();await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,states:report.states,rows:report.rows.length}));
