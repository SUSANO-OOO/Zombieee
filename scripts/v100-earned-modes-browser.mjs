import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {normalTacticalInput} from './v100-normal-tactical-input.mjs';
import {readNativeIndexedDb} from './native-indexeddb-evidence.mjs';
import {deserializeV100Save} from '../app/v100Save.js';
import {survivalWaveSpawnPlan} from '../app/survivalBattleRuntime.js';
import {V100_BOSSES} from '../app/v100Registry.js';

const origin=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);assert.ok(['127.0.0.1','localhost'].includes(origin.hostname));
const engine=process.env.V100_EARNED_MODES_ENGINE??'chromium',out=process.env.V100_EARNED_MODES_EVIDENCE_DIR??'outputs/v100-earned-modes-'+engine;
const source=process.env.V100_EARNED_MODES_SOURCE,bytes=await readFile(source),seed=JSON.parse(bytes),boss=V100_BOSSES.find(b=>b.stageNumber===3);
assert.equal(seed.completedStageIds.length,3);assert.ok(seed.receipts.includes(boss.firstDefeatReceipt));
await mkdir(out,{recursive:false});
const report={status:'running',operatorChange:'Ordinary native inputs use actual enabled ability buttons. Read-only battle observations guide tactics. No scenario, clock, actor or result setters.',scope:'Exact save earned through Stage3 on the frozen candidate, copied to a separate browser profile. No level/CAPS/formation/receipt/clock/actor/result changes. Ordinary native mode entry, combat, checkpoint and withdrawal. Read-only battle observations guide UI tactics. This is a branch from natural campaign unlock, not physical-device or listening acceptance.',source:{path:source,sha256:createHash('sha256').update(bytes).digest('hex')},build:await productionBuildIdentity(),engine,errors:[],modes:[]};
report.driver=await Promise.all(['scripts/v100-earned-modes-browser.mjs','scripts/v100-normal-tactical-input.mjs','scripts/native-indexeddb-evidence.mjs'].map(async path=>({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')})));
const browser=await({chromium,webkit}[engine]).launch({headless:true}),context=await browser.newContext({viewport:{width:844,height:340},hasTouch:true,isMobile:true}),page=await context.newPage();
page.setDefaultTimeout(15000);
const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100'))),persist=()=>writeFile(out+'/report.json',JSON.stringify(report,null,2)),button=name=>page.getByRole('button',{name,exact:true});
const ready=()=>page.waitForFunction(()=>!document.querySelector('.v100-shell[aria-busy="true"]'));
async function click(name){await ready();await button(name).click();await ready();}
async function shot(name){await page.screenshot({path:out+'/'+name+'.png'});await persist();}
function campaignPreserved(s){for(const key of ['completedStageIds','availableStageIds','ownedUnitIds','registeredUnitIds','unitLevels','formationSlots','vehicle'])assert.deepEqual(s[key],seed[key],key);}
async function durableReadback(expected){
 const evidence=await readNativeIndexedDb(page,'nishijin-campaign-v100');
 assert.equal(evidence.database.version,1);assert.deepEqual(Object.keys(evidence.database.stores).sort(),['entitlements','saves']);
 const current=evidence.database.stores.saves.find(row=>row.key==='current')?.value;
 assert.equal(current?.format,1);const parsed=deserializeV100Save(current.serialized);assert.equal(parsed.ok,true);assert.deepEqual(parsed.save,expected);
 evidence.mirrors=await page.evaluate(()=>Object.fromEntries(['nishijin-campaign-v100','nishijin-campaign-v100:mirror','nishijin-campaign-v100:last-known-good'].map(key=>[key,localStorage.getItem(key)])));
 for(const raw of Object.values(evidence.mirrors))assert.deepEqual(JSON.parse(raw),expected);
 return evidence;
}
page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('requestfailed',r=>report.errors.push(r.url()+': '+r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+': '+r.url());});
try{
 await page.addInitScript(({origin,raw})=>{if(location.origin===origin&&!localStorage.getItem('nishijin-campaign-v100'))localStorage.setItem('nishijin-campaign-v100',raw);},{origin:origin.origin,raw:bytes.toString()});
 await page.goto(origin.href);await click('ブラウザで遊ぶ');await page.waitForFunction(()=>document.querySelector('.v100-shell[data-v100-phase="map"][aria-busy="false"]'));assert.deepEqual(await save(),seed);
 await click('異常発生・記録');
 for(const label of ['異常発生','ボス図鑑','戦績']){await click(label);assert.equal(await page.locator('[data-outbreak-boss-id]').count(),1);assert.equal(await page.locator('[data-outbreak-boss-id]').getAttribute('data-outbreak-boss-id'),boss.id);}
 await shot('natural-unlock-records');await click('異常発生');await click('この異常個体と再戦');
 const outbreak={mode:'outbreak',status:'running',inputs:[],opening:await save()};report.modes.push(outbreak);await persist();
 const start=Date.now();let last=0;
 while(!await page.getByRole('region',{name:'異常発生の戦果',exact:true}).isVisible()){
   assert.ok(Date.now()-start<15*60_000,'bounded ordinary outbreak battle');assert.deepEqual(report.errors,[]);
   try{await normalTacticalInput(page,outbreak);}catch(e){if(!await page.getByRole('region',{name:'異常発生の戦果',exact:true}).isVisible())throw e;}
   if(Date.now()-last>30000){await shot('outbreak-'+Math.floor((Date.now()-start)/1000));last=Date.now();}await page.waitForTimeout(300);
 }
 outbreak.result=(await save()).outbreak.lastResult;assert.equal(outbreak.result.won,true,'Preserve and diagnose a normal-play defeat');
 const afterOutbreak=await save();campaignPreserved(afterOutbreak);assert.equal(afterOutbreak.caps,seed.caps+outbreak.result.rewardCaps);assert.equal(afterOutbreak.bosses.defeatCounts[boss.id],seed.bosses.defeatCounts[boss.id]+1);
 await shot('outbreak-result');await page.reload();await click('ブラウザで遊ぶ');await page.getByRole('region',{name:'異常発生の戦果',exact:true}).waitFor();assert.deepEqual(await save(),afterOutbreak);outbreak.status='passed';
 await click('異常発生一覧へ');await click('サバイバル');await shot('survival-hub');await click('防衛継続作戦へ出撃');
 const survival={mode:'survival',status:'running',inputs:[],waves:[],opening:await save()};report.modes.push(survival);assert.deepEqual(survival.opening.survival.active.run.bossPool,['takuya']);await persist();
 const survivalStart=Date.now();last=0;
 while(!await page.getByRole('dialog',{name:'ボス撃破強化選択',exact:true}).isVisible()){
   assert.ok(Date.now()-survivalStart<20*60_000,'bounded first five ordinary survival waves');assert.deepEqual(report.errors,[]);
   assert.equal(await page.getByRole('region',{name:'防衛継続作戦の戦果',exact:true}).isVisible(),false,'Preserve and diagnose a normal survival defeat');
   const wave=await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().survivalRun?.currentWave);if(wave&&!survival.waves.includes(wave))survival.waves.push(wave);
   try{await normalTacticalInput(page,survival);}catch(e){if(!await page.getByRole('dialog',{name:'ボス撃破強化選択',exact:true}).isVisible())throw e;}
   if(Date.now()-last>30000){await shot('survival-'+Math.floor((Date.now()-survivalStart)/1000));last=Date.now();}await page.waitForTimeout(300);
 }
 await ready();
 survival.incoming=await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.getSnapshot().survivalRun);
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')).survival.active?.run.lastCompletedWave===5||document.querySelector('.survival-save-retry'),null,{timeout:15000});
 survival.checkpoint=await save();assert.equal(survival.checkpoint.survival.active.run.lastCompletedWave,5);campaignPreserved(survival.checkpoint);
 survival.expectedDefeats={};for(let wave=1;wave<=5;wave++)for(const kind of survivalWaveSpawnPlan(wave,{bossPool:survival.opening.survival.active.run.bossPool,strictBossPool:true}).units)survival.expectedDefeats[kind]=(survival.expectedDefeats[kind]??0)+1;
 assert.deepEqual(survival.checkpoint.survival.active.run.stats.enemyDefeatsByKind,survival.expectedDefeats,'Every actual spawned enemy must reach the checkpoint ledger');
 assert.equal(survival.checkpoint.survival.active.run.stats.kills,Object.values(survival.expectedDefeats).reduce((a,b)=>a+b,0));
 await shot('survival-checkpoint');
 await page.reload();await click('ブラウザで遊ぶ');await page.getByRole('dialog',{name:'ボス撃破強化選択',exact:true}).waitFor();assert.deepEqual(await save(),survival.checkpoint);
 survival.checkpointReadback=await durableReadback(survival.checkpoint);await persist();
 survival.choice=await page.locator('.survival-upgrade-choices button').first().innerText();await page.locator('.survival-upgrade-choices button').first().click();await ready();survival.upgraded=await save();
 await click('一時停止');await click('エリアマップへ撤退');await click('実行する');await page.getByRole('region',{name:'防衛継続作戦の戦果',exact:true}).waitFor();
 const final=await save();survival.result=final.survival.lastResult;campaignPreserved(final);assert.equal(final.survival.active,null);assert.equal(final.survival.totalRuns,seed.survival.totalRuns+1);assert.equal(final.caps,afterOutbreak.caps+survival.result.totalCaps);
 await shot('survival-result');await page.reload();await click('ブラウザで遊ぶ');await page.getByRole('region',{name:'防衛継続作戦の戦果',exact:true}).waitFor();assert.deepEqual(await save(),final);survival.finalReadback=await durableReadback(final);survival.status='passed';assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.error=String(e.stack??e);await shot('failure').catch(()=>{});process.exitCode=1;}
finally{
 report.finalSave=await save().catch(()=>null);await persist();
 try{await context.storageState({path:out+'/browser-storage.json'});report.storageEvidence='All native V1 stores and three local mirrors are read back after checkpoint/result reload in this report. browser-storage.json contains cookies/localStorage; other database names/versions are inventory only.';}
 catch(e){report.storageCaptureError=String(e);report.status='failed';process.exitCode=1;}
 finally{await persist();await browser.close();}
 console.log(JSON.stringify({status:report.status,error:report.error?.slice(0,900),storageCaptureError:report.storageCaptureError}));
}
