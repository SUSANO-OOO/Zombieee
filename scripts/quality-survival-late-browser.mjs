import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save,validateV100SavePayload} from '../app/v100Save.js';
import {V100_BOSSES,V100_UNITS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {beginV100Survival,checkpointV100Survival,selectV100SurvivalUpgrade} from '../app/v100SurvivalTransactions.js';
import {beginSurvivalWave,completeSurvivalWave,SURVIVAL_UPGRADE_BY_ID} from '../app/survival.js';
import {survivalWaveReward,selectSurvivalBossKind,SURVIVAL_LATE_ENEMY_GROUPS} from '../app/survivalBattleRuntime.js';
import {seedV100BrowserSaveOnce,enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {nativeBattleTap,normalTacticalInput} from './v100-normal-tactical-input.mjs';
import {v100EquipmentQuantityCap} from '../app/v100Equipment.js';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const out=path.resolve(process.env.QUALITY_LATE_OUT),root=path.resolve(process.env.QUALITY_LATE_ROOT);
const url=new URL(process.env.QUALITY_LATE_URL);assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
const engine=process.env.QUALITY_LATE_ENGINE??'chromium',before=process.env.QUALITY_LATE_BEFORE==='1';
const viewport=engine==='webkit'?{width:844,height:340}:{width:1280,height:720};
const hash=b=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:false});
await writeFile(path.join(out,'executed-driver.mjs'),await readFile(new URL(import.meta.url)));
const report={engine,before,viewport,build:await productionBuildIdentity(root),scriptSha256:hash(await readFile(new URL(import.meta.url))),
 scope:'Prepared postgame level-30 formation, max-level existing equipment and vehicle, and a paid wave-10 checkpoint in an isolated save; then native upgrade/deployment/ability/vehicle support/speed inputs and ordinary simulation. Not naturally earned progression, balance acceptance, physical-device or human motion/audio acceptance.',cases:[],errors:[]};
function fixture(lastWave){
 const ids=V100_UNITS.map(u=>u.id),formation=['unit-gantetsu','unit-nao','unit-raider','unit-babayaga','unit-tky','unit-hachi','unit-zakimiya'];
 let seed=normalizeV100Save({...createDefaultV100Save({playerName:'後半波確認'}),campaignStarted:true,caps:2000,
  vehicle:{upgradeLevel:5,maxHp:1080,upgradeReceipts:[]},
  equipment:{inventory:{'reinforced-vest':7,'quick-loader':6,'rescue-pouch':1,'tactical-field-radio':1,'tactical-trauma-station':1},
   personalByUnit:Object.fromEntries(formation.map(id=>[id,['reinforced-vest',id==='unit-nao'?'rescue-pouch':'quick-loader']])),
   tacticalIds:['tactical-field-radio','tactical-trauma-station'],enhancementLevels:Object.fromEntries(['reinforced-vest','quick-loader','rescue-pouch','tactical-field-radio','tactical-trauma-station'].map(id=>[id,5]))},
  ownedUnitIds:ids,registeredUnitIds:ids,unitLevels:Object.fromEntries(ids.map(id=>[id,30])),formationSlots:formation,
  receipts:V100_BOSSES.map(b=>b.firstDefeatReceipt),completedStageIds:V100_STAGE_IDS,availableStageIds:V100_STAGE_IDS,
  flowState:{phase:'map',destination:'map',stageId:V100_STAGE_IDS[0],stageNumber:1,eventId:null,nodeIndex:0,firstClear:false,finalized:true}});
 let start=beginV100Survival(seed,{runId:'quality-late-'+lastWave});assert.ok(start.applied);seed=start.save;let run=seed.survival.active.run;
 for(let wave=1;wave<=lastWave;wave++){
  run=beginSurvivalWave(run);const boss=selectSurvivalBossKind({waveNumber:wave,bossPool:run.bossPool,lastBossKind:run.lastBossKind,strictBossPool:true});
  if(boss)run={...run,lastBossKind:boss};
  run=completeSurvivalWave(run,{kills:boss?4:3,bossKills:boss?1:0,crawlerHp:run.crawler.maxHp,battleSeconds:10,
   enemyDefeatsByKind:boss?{[boss]:1,walker:3}:{walker:3},reward:survivalWaveReward(wave)});
  if(wave%5===0){const paid=checkpointV100Survival(seed,run);assert.ok(paid.applied);seed=paid.save;
   if(wave<lastWave){const selected=selectV100SurvivalUpgrade(seed,run.runId,seed.survival.active.run.pendingUpgradeChoices[0]);assert.ok(selected.applied);seed=selected.save;run=seed.survival.active.run;}}
 }
 assert.ok(validateV100SavePayload(seed).ok);return seed;
}
const browser=await({chromium,webkit}[engine]).launch({headless:true});
try{for(const checkpoint of [10]){
 const seed=fixture(checkpoint),bytes=serializeV100Save(seed),row={checkpoint,number:30,tacticalProfile:"late-precision",seedSha256:hash(bytes),observations:[],inputs:[],waves:[],checkpoints:[],status:'running'};report.cases.push(row);
 await writeFile(path.join(out,'seed-'+checkpoint+'.json'),bytes);
 const context=await browser.newContext({viewport,hasTouch:true,recordVideo:{dir:path.join(out,'video-'+checkpoint),size:viewport}});
 let page;
 try{
  await context.addInitScript(seedV100BrowserSaveOnce,bytes);page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',e=>report.errors.push(String(e)));row.requestFailures=[];page.on('requestfailed',r=>row.requestFailures.push({url:r.url(),failure:r.failure()}));await page.goto(url.href);
  await dismissInstallOffer(page,{timeout:30000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
  const choices=page.locator('.survival-upgrade-choices');await choices.waitFor();row.preview=await choices.innerText();
  await page.screenshot({path:path.join(out,'checkpoint-'+checkpoint+'.png')});
  const choice=seed.survival.active.run.pendingUpgradeChoices[0];await choices.getByRole('button',{name:new RegExp(SURVIVAL_UPGRADE_BY_ID[choice].displayName)}).click();await choices.waitFor({state:'hidden'});
  const late=SURVIVAL_LATE_ENEMY_GROUPS.flatMap(g=>g.kinds),required=late;
  const observed=new Set(),deadline=Date.now()+(before?35000:900000);let lastWave=0;
  while(Date.now()<deadline){
   const s=await page.evaluate(()=>{const q=window.__ASHFALL_BATTLE_QA__;if(!q)return null;const s=q.getSnapshot();return{queue:s.deployQueue??[],time:s.time,over:s.over,baseHp:s.baseHp,run:s.survivalRun,
    fighters:s.fighters.map(f=>({id:f.id,kind:f.kind,side:f.side,hp:f.hp,combatReady:f.combatReady})),receipts:s.manualAbilityReceipts??[]};});
   if(!s){row.terminalSave=await page.evaluate(()=>JSON.parse(localStorage.getItem("nishijin-campaign-v100")));break;}
   assert.ok(s.run);if(s.run.currentWave!==lastWave){lastWave=s.run.currentWave;row.waves.push({wave:lastWave,time:s.time,baseHp:s.baseHp});}
   row.latest={time:s.time,over:s.over,baseHp:s.baseHp,run:s.run,receipts:s.receipts};
   for(const f of s.fighters.filter(f=>f.side==='zombie'&&f.hp>0&&f.combatReady&&!observed.has(f.kind))){
    const audit=await page.evaluate(id=>window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(id,{latestDrawOnly:true,includeGeometry:true}),f.id);
    if(!audit.renderHistory?.length)continue;observed.add(f.kind);row.observations.push({time:s.time,wave:lastWave,fighter:f,draw:audit.renderHistory.at(-1)});
    if(late.includes(f.kind))await page.screenshot({path:path.join(out,'wave-'+lastWave+'-'+f.kind+'.png')});
   }
   if(!before&&required.every(kind=>observed.has(kind)))break;
   if(s.over)break;
   if(s.run.phase==='upgrade-selection'){
    const next=page.locator('.survival-upgrade-choices');await next.waitFor();
    // The panel first renders disabled while the transaction is saving.
    // Read durable rewards only after that checkpoint receipt exists.
    await page.waitForFunction(({runId,wave})=>{
     const saved=JSON.parse(localStorage.getItem('nishijin-campaign-v100')??'null');
     return saved?.receipts?.includes(`v100:survival:${runId}:checkpoint:${wave}`);
    },{runId:s.run.runId,wave:s.run.lastCompletedWave},{timeout:30000});
    const paid=await page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
    await writeFile(path.join(out,'earned-checkpoint-'+s.run.lastCompletedWave+'-save.json'),JSON.stringify(paid,null,2)+'\n');
    row.checkpoints.push({wave:s.run.lastCompletedWave,caps:paid.caps,equipment:paid.equipment,receipts:paid.receipts});
    await page.screenshot({path:path.join(out,'earned-checkpoint-'+s.run.lastCompletedWave+'.png')});
    await next.locator('button').first().click();await next.waitFor({state:'hidden'});continue;
   }
   if(lastWave%5!==0)await nativeBattleTap(page,page.locator('.survival-speed button').nth(1));
   await normalTacticalInput(page,row,{barrageWhenOverwhelmed:true});
   await page.waitForTimeout(300);
  }
  await page.screenshot({path:path.join(out,'checkpoint-'+checkpoint+'-last.png')});row.seen=[...observed];
  if(before)assert.ok(!row.seen.some(kind=>late.includes(kind)));
  else assert.ok(required.every(kind=>row.seen.includes(kind)),'Missing late enemy: '+required.filter(kind=>!row.seen.includes(kind)).join(','));
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));row.stored={caps:stored.caps,equipment:stored.equipment,receipts:stored.receipts};
  let expectedCaps=seed.caps;const equipment=structuredClone(seed.equipment);
  for(const earned of row.checkpoints){
   for(let wave=earned.wave-4;wave<=earned.wave;wave++)expectedCaps+=survivalWaveReward(wave).caps;
   for(const grant of survivalWaveReward(earned.wave).equipmentGrants)equipment.inventory[grant.equipmentId]=Math.min(v100EquipmentQuantityCap(grant.equipmentId),(equipment.inventory[grant.equipmentId]??0)+grant.quantity);
  }
  assert.equal(stored.caps,expectedCaps);assert.deepEqual(stored.equipment,equipment);
  assert.deepEqual(row.requestFailures,[]);
  row.status='passed';
 }catch(e){row.status='failed';row.error=String(e);
  if(page){await page.screenshot({path:path.join(out,'failure-'+checkpoint+'.png')}).catch(()=>{});
   row.failureScreen=await page.locator('body').innerText().catch(()=>null);
   row.assetFailure=await page.evaluate(()=>{const a=window.__ASHFALL_ASSET_QA__;return a?{state:a.getState(),failed:a.getFailedPaths(),pending:a.getPendingPaths()}:null;}).catch(()=>null);}
  throw e;}finally{await context.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
}assert.deepEqual(report.errors,[]);report.status='passed';}finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,engine,before,cases:report.cases.map(c=>({checkpoint:c.checkpoint,seen:c.seen,waves:c.waves}))}));
