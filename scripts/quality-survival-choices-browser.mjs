import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,serializeV100Save,validateV100SavePayload} from '../app/v100Save.js';
import {V100_BOSSES,V100_UNITS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {beginV100Survival,checkpointV100Survival,selectV100SurvivalUpgrade} from '../app/v100SurvivalTransactions.js';
import {beginSurvivalWave,completeSurvivalWave,SURVIVAL_UPGRADE_BY_ID} from '../app/survival.js';
import {survivalWaveReward,SURVIVAL_NORMAL_ENEMY_KINDS} from '../app/survivalBattleRuntime.js';
import {seedV100BrowserSaveOnce,enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const before=process.env.QUALITY_SURVIVAL_BEFORE==='1',engine=process.env.QUALITY_SURVIVAL_ENGINE??'chromium';
const out=path.resolve(process.env.QUALITY_SURVIVAL_OUT);await mkdir(out,{recursive:true});
const report={before,engine,build:await productionBuildIdentity(),scope:'Synthetic paid wave-5 checkpoint (wave-10 for wave11 scenario) in isolated save, then normal title/selection/reload. Not earned wave progression or balance acceptance.',cases:[],errors:[]};
function fixture(scenario){
 let seed=createDefaultV100Save({playerName:'防衛確認',settings:{bgmEnabled:false,sfxEnabled:false}});
 seed.campaignStarted=true;seed.caps=2000;seed.flowState={...seed.flowState,phase:'map',destination:'map'};
 seed.receipts=[V100_BOSSES[0].firstDefeatReceipt];seed.completedStageIds=V100_STAGE_IDS.slice(0,3);seed.availableStageIds=V100_STAGE_IDS.slice(0,4);
 seed.ownedUnitIds=V100_UNITS.map(u=>u.id);seed.registeredUnitIds=[...seed.ownedUnitIds];
 seed.formationSlots=['unit-paisen',scenario==='healer'?'unit-nao':'unit-babayaga',null,null,null,null,null];
 const start=beginV100Survival(seed,{runId:'quality-useful-'+scenario});assert.ok(start.applied);seed=start.save;
 let run=seed.survival.active.run;
 for(let wave=1;wave<=(scenario==='wave11'?10:5);wave++){
  const bossWave=wave%5===0;
  run=beginSurvivalWave(run);if(bossWave)run={...run,lastBossKind:'takuya'};
  run=completeSurvivalWave(run,{kills:3,bossKills:bossWave?1:0,crawlerHp:scenario==='repair'?300:run.crawler.maxHp,battleSeconds:10,
   enemyDefeatsByKind:bossWave?{takuya:1}:{walker:3},reward:survivalWaveReward(wave)});
  if(wave===5&&scenario==='wave11'){
   const paid=checkpointV100Survival(seed,run);assert.ok(paid.applied);
   const selected=selectV100SurvivalUpgrade(paid.save,run.runId,paid.save.survival.active.run.pendingUpgradeChoices[0]);assert.ok(selected.applied);
   seed=selected.save;run=seed.survival.active.run;
  }
 }
 const checkpoint=checkpointV100Survival(seed,run);assert.ok(checkpoint.applied);seed=JSON.parse(serializeV100Save(checkpoint.save));
 // Preserve a historical candidate list in the raw fixture: the running game
 // must normalize it itself. No live game state or storage is patched later.
 seed.survival.active.run.temporaryUpgradeStacks={'field-triage':3,'layered-armor':14,'rapid-redeployment':10};
 seed.survival.active.run.pendingUpgradeChoices=[scenario==='repair'?'crawler-field-repair':'field-triage','boss-breaker','assault-drill'];
 assert.ok(validateV100SavePayload(seed).ok);return seed;
}
const browser=await({chromium,webkit}[engine]).launch({headless:true});
try{for(const viewport of process.env.QUALITY_SURVIVAL_WAVE11==='1'?[{width:844,height:340}]:[{width:844,height:340},{width:1280,height:720}])for(const scenario of process.env.QUALITY_SURVIVAL_WAVE11==='1'?['wave11']:before?['no-healer']:['no-healer','healer','repair']){
 const label=`${viewport.width}x${viewport.height}-${scenario}`,seed=fixture(scenario),row={label};report.cases.push(row);
 const context=await browser.newContext({viewport,hasTouch:true,recordVideo:{dir:path.join(out,label),size:viewport}});
 try{
  await context.addInitScript(seedV100BrowserSaveOnce,JSON.stringify(seed));const page=await context.newPage();page.setDefaultTimeout(25000);
  page.on('pageerror',e=>report.errors.push(String(e)));await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);
  await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
  const choices=page.locator('.survival-upgrade-choices');await choices.waitFor();
  row.names=await choices.locator('button b').allTextContents();row.preview=await choices.innerText();
  await page.screenshot({path:path.join(out,label+'-choices.png')});
  if(before){assert.ok(row.names.includes('野戦救護'));continue;}
  assert.equal(row.names.length,3);assert.equal(row.names.includes('野戦救護'),scenario==='healer');
  assert.equal(row.names.includes('移動拠点応急修理'),scenario==='repair');
  const selectedId=scenario==='healer'?'field-triage':scenario==='repair'?'crawler-field-repair':'range-calibration';
  const control=choices.getByRole('button',{name:new RegExp(SURVIVAL_UPGRADE_BY_ID[selectedId].displayName)});
  for(const card of await choices.locator('button').all()){
   const box=await card.boundingBox();assert.ok(box&&box.height>=44&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,'all choices must fit');
   assert.ok(await card.evaluate(el=>el.scrollHeight<=el.clientHeight+1),'choice copy must not be clipped');
  }
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
  await control.click();await choices.waitFor({state:'hidden'});
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')).survival.active.run.temporaryUpgradeStacks[id]>0,selectedId);
  const result=await saved();row.selectedId=selectedId;row.savedRun=result.survival.active.run;
  assert.equal(result.caps,seed.caps);assert.deepEqual(result.equipment,seed.equipment);assert.deepEqual(result.ownedUnitIds,seed.ownedUnitIds);
  assert.equal(result.receipts.length,seed.receipts.length+1);
  assert.equal(result.survival.active.run.temporaryUpgradeStacks[selectedId],(seed.survival.active.run.temporaryUpgradeStacks[selectedId]??0)+1);
  if(scenario==='repair')assert.equal(result.survival.active.run.crawler.hp,Math.min(seed.survival.active.run.crawler.maxHp,300+Math.round(seed.survival.active.run.crawler.maxHp*.12)));
  await page.reload();await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
  await page.waitForFunction(wave=>window.__ASHFALL_BATTLE_QA__?.getSnapshot().survivalRun?.currentWave===wave,scenario==='wave11'?11:6);
  const reloaded=await saved();assert.deepEqual(reloaded.receipts,result.receipts);assert.equal(reloaded.caps,result.caps);
  assert.deepEqual(reloaded.survival.active.run.temporaryUpgradeStacks,result.survival.active.run.temporaryUpgradeStacks);
  await page.screenshot({path:path.join(out,label+'-resumed.png')});
  if(scenario==='wave11'){
   const expected=['walker','runner','spitter','grappler','ooze','sprinter','crusher'];
   assert.ok(expected.every(kind=>SURVIVAL_NORMAL_ENEMY_KINDS.includes(kind)));
   const seen=new Set(),deadline=Date.now()+55000;row.spawnObservations=[];
   while(Date.now()<deadline&&seen.size<expected.length){
    const state=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__.getSnapshot();return{time:s.time,kinds:s.fighters.filter(f=>f.side==='zombie').map(f=>f.kind)}});
    for(const kind of state.kinds)if(SURVIVAL_NORMAL_ENEMY_KINDS.includes(kind)&&!seen.has(kind)){seen.add(kind);row.spawnObservations.push({kind,time:state.time});}
    if(seen.size<expected.length)await page.waitForTimeout(250);
   }
   await page.screenshot({path:path.join(out,label+'-enemy-variety.png')});
   assert.deepEqual([...seen].sort(),expected.sort(),'all seven unlocked enemy kinds must actually spawn');
  }
  row.status='passed';
 }catch(error){row.status='failed';row.error=String(error);throw error;}
 finally{await context.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
}assert.deepEqual(report.errors,[]);}finally{await browser.close();}
console.log(JSON.stringify({engine,before,cases:report.cases.length,status:'passed'}));
