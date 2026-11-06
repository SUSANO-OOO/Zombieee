import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {nativeBattleTap} from './v100-normal-tactical-input.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {QUALITY_CHARACTER_ATLASES} from '../app/qualityCharacterAtlases.js';
const out=path.resolve(process.env.QUALITY_RANGER_OUT);await mkdir(out,{recursive:true});
const engine=process.env.QUALITY_RANGER_ENGINE??'chromium';assert.ok(['chromium','webkit'].includes(engine));
const viewport=(process.env.QUALITY_RANGER_VIEWPORT??'844x340')==='1280x720'?{width:1280,height:720}:{width:844,height:340};
assert.ok(['844x340','1280x720'].includes(process.env.QUALITY_RANGER_VIEWPORT??'844x340'));
const report={engine,viewport,build:await productionBuildIdentity(process.env.QUALITY_RANGER_BUILD_ROOT??process.cwd()),scope:'Prepared muted level-1 Mizuchi and Paisen at S03, fixed viewport, native deployment/ability input, ordinary simulation speed, service workers blocked. No actor/time/HP/result setter. Not natural progression, full-speed human review, installed PWA or physical-device acceptance.',rows:[],inputs:[],errors:[]};
const ids=['unit-mizuchi','unit-paisen'];
const seed=normalizeV100Save({...createDefaultV100Save({settings:{bgmEnabled:false,sfxEnabled:false}}),campaignStarted:true,ownedUnitIds:ids,registeredUnitIds:ids,formationSlots:ids,availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,2),flowState:{phase:'formation',stageId:V100_STAGE_IDS[2],stageNumber:3,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
const browser=await({chromium,webkit}[engine]).launch({headless:true});
const context=await browser.newContext({viewport,hasTouch:true,serviceWorkers:'block',recordVideo:{dir:path.join(out,'video'),size:viewport}});let page;
try{
 await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
 page=await context.newPage();page.setDefaultTimeout(25000);page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
 const offline=page.getByText('オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。',{exact:true});if(await offline.isVisible())await offline.locator('..').getByRole('button',{name:'閉じる',exact:true}).click();
 await page.getByRole('button',{name:'戦闘へ',exact:true}).click();await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot().running&&document.documentElement.dataset.assetLoadState==='ready');
 const seen=new Set(),deployed=new Set(),deadline=Date.now()+90000;let ability=false;
 while(Date.now()<deadline){
  const s=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__?.getSnapshot();return s?{time:s.time,running:s.running,fighters:s.fighters.filter(f=>f.side==='human').map(f=>({id:f.id,kind:f.kind,hp:f.hp,x:f.x,y:f.y,render:f.renderAudit,manual:f.manualAbility}))}:null;});
  if(!s||!s.running)break;
  for(const f of s.fighters)deployed.add(f.kind);
  for(const kind of ['ranger','brawler'])if(!deployed.has(kind)&&await nativeBattleTap(page,page.locator(`button.unit-card[data-kind="${kind}"]`).first()))report.inputs.push({time:s.time,action:'deploy',kind});
  for(const f of s.fighters.filter(f=>f.hp>0&&f.render?.assetReady)){assert.equal(f.render.jointDrawSucceeded,true);report.rows.push({time:s.time,...f});}
  for(const f of s.fighters.filter(f=>f.kind==='ranger'&&f.hp>0&&f.render?.assetReady)){
   const state=f.render.resolvedState;
   if(!seen.has(state)){seen.add(state);await page.screenshot({path:path.join(out,state+'.png')});}
   if(!ability&&seen.has('active')&&await nativeBattleTap(page,page.locator(`button[data-fighter-id="${f.id}"][data-ability-kind]`).first())){ability=true;report.inputs.push({time:s.time,action:'ability',kind:'ranger'});}
  }
  if(ability&&seen.has('special')&&s.time>30)break;
  await page.waitForTimeout(120);
 }
 report.states=[...seen];assert.ok(deployed.has('ranger'));assert.ok(seen.has('move'));assert.ok(seen.has('active'));assert.ok(seen.has('recovery'));assert.ok(seen.has('special'));
 const rangerRows=report.rows.filter(row=>row.kind==='ranger'),paisenRows=report.rows.filter(row=>row.kind==='brawler');
 assert.ok(rangerRows.every(row=>row.render.jointAtlasPath===QUALITY_CHARACTER_ATLASES.ranger.path&&row.render.jointWeightedLowerDrawSucceeded),'all observed poses retain the continuous lower body');
 assert.ok(rangerRows.some(row=>row.render.resolvedState==='special'&&row.render.jointRangerManualDrawSucceeded),'manual input must reach the dedicated renderer');
 assert.ok(paisenRows.some(row=>row.render.requestedState==='move'),'Paisen must actually deploy and walk');
 report.paisenStates=[...new Set(paisenRows.map(row=>row.render.requestedState))];
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
 for(const key of ['ownedUnitIds','registeredUnitIds','caps','receipts'])assert.deepEqual(saved[key],seed[key]);
 assert.deepEqual(report.errors,[]);report.status='captured-not-visual-acceptance';
}catch(error){report.status='failed';report.error=String(error);throw error;}
finally{await context.close();if(page)report.video=await page.video().path();await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,states:report.states,rows:report.rows.length}));
