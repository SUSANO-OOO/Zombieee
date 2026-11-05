import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {createV100BattleResult} from '../app/v100Transactions.js';
import {v100BattleDefinitionFor} from '../app/v100BattleAdapter.js';
import {v100DefenseResultSnapshot} from '../app/v100DefenseObjectives.js';
import {v100BattleReportFor,v100DefenseResultText} from '../app/v100BattleReport.js';
import {seedV100BrowserSaveOnce,enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {createNormalBrowserDeadline,normalCleanupWithin} from './v177-normal-browser-deadline.mjs';

const engine=process.env.QUALITY_DEFENSE_ENGINE??'webkit',out=path.resolve(process.env.QUALITY_DEFENSE_OUT);
const url=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
assert.ok(['webkit','chromium'].includes(engine));await fs.mkdir(out,{recursive:false});
await fs.writeFile(path.join(out,'driver.mjs'),await fs.readFile(new URL(import.meta.url)));
const sourcePath='output/quality-20261028/defense-s22-webkit-r1/report.json',source=await fs.readFile(sourcePath),observed=JSON.parse(source).cases[0];
const specs=engine==='webkit'?[2,7,18,22,'legacy'].map(scenario=>({scenario,viewport:{width:844,height:340}}))
 :[{scenario:22,viewport:{width:844,height:340}},{scenario:22,viewport:{width:1280,height:720}}];
const report={engine,build:await productionBuildIdentity(process.env.QUALITY_DEFENSE_ROOT),source:{path:sourcePath,sha256:createHash('sha256').update(source).digest('hex')},
 scope:'Prepared defeat-result saves. S22 time matches the observed loss, but its final save was not captured; this is a constructed display fixture, not recovery of that save or another battle. Three other clocks and legacy data are synthetic. Silent UI/reload checks, not natural campaign or human/physical acceptance.',cases:[],errors:[]};
const browser=await({webkit,chromium}[engine]).launch({headless:true});
const persist=()=>fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
try{for(const {scenario,viewport} of specs){
 const number=typeof scenario==='number'?scenario:22,stageId=V100_STAGE_IDS[number-1],time=number===22?observed.snapshots.at(-1).time:35;
 const raw={stageId,time,wave:5,kills:5,unitStats:{damageByUnit:{},damageTakenByUnit:{},healingByUnit:{}},
  defenseProgress:v100DefenseResultSnapshot(v100BattleDefinitionFor(stageId),{time})};
 const battleReport=v100BattleReportFor(raw);if(scenario==='legacy')delete raw.defenseProgress;
 const result=createV100BattleResult({stageId,battleRunId:`prepared-defense-${scenario}`,won:false,vehicleHp:0,vehicleMaxHp:840,
  elapsedSeconds:time,unitDeaths:6,battleReport:scenario==='legacy'?v100BattleReportFor(raw):battleReport});
 const seed=normalizeV100Save({...observed.openingFixture,lastResult:result,pendingResult:null,
  flowState:{phase:'result',stageId,stageNumber:number,destination:'result',eventId:null,nodeIndex:0,firstClear:false,finalized:false}});
 const label=`${scenario}-${viewport.width}x${viewport.height}`,row={label,scenario,viewport,fixture:seed};report.cases.push(row);
 const context=await browser.newContext({viewport,hasTouch:true,serviceWorkers:'block',recordVideo:{dir:path.join(out,label),size:viewport}});
 const rawPage=await context.newPage(),page=createNormalBrowserDeadline().wrap(rawPage);page.setDefaultTimeout(15000);
 page.on('pageerror',e=>report.errors.push(String(e)));
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
 const enter=async()=>{await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);await page.locator('.v100-result-panel').waitFor();};
 try{
  await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));await page.goto(url.href);await enter();
  const initial=await saved(),panel=page.locator('.v100-result-panel'),progress=panel.getByLabel('今回どこまで進めたか',{exact:true});
  row.initial=initial;row.progress=await progress.innerText();const expected=v100DefenseResultText(result);
  if(expected){assert.ok(row.progress.includes(expected.progress));assert.ok(row.progress.includes(expected.detail));assert.deepEqual(initial.lastResult.battleReport.defenseProgress,result.battleReport.defenseProgress);}
  else{assert.ok(row.progress.includes('第5波まで到達'));assert.doesNotMatch(row.progress,/室を開放|防衛完了まで|秒維持/);}
  for(const locator of [progress,...await panel.locator('.v100-result-actions button').all()]){
   const box=await locator.boundingBox();assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1);
   assert.ok(await locator.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
  }
  await page.screenshot({path:path.join(out,label+'.png')});assert.deepEqual(await saved(),initial);
  await page.reload();await enter();assert.deepEqual(await saved(),initial);assert.equal(await progress.innerText(),row.progress);
  row.reloadPreserved=true;row.status='passed';
 }catch(e){row.status='failed';row.error=String(e);await rawPage.screenshot({path:path.join(out,label+'-failure.png'),timeout:5000}).catch(()=>{});throw e;}
 finally{await normalCleanupWithin(()=>context.close(),'context.close');row.video=await rawPage.video().path();await persist();}
}assert.deepEqual(report.errors,[]);report.status='passed';}
catch(e){report.status='failed';report.error=String(e);process.exitCode=1;}
finally{await normalCleanupWithin(()=>browser.close(),'browser.close');await persist();}
console.log(JSON.stringify({engine,status:report.status,cases:report.cases.length,error:report.error}));
