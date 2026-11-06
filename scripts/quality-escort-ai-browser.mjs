import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_UNITS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {nativeBattleTap} from './v100-normal-tactical-input.mjs';
const out=path.resolve(process.env.QUALITY_ESCORT_OUT),base=process.env.V100_CAMPAIGN_QA_BASE_URL;
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const engine=process.env.QUALITY_ESCORT_ENGINE??'chromium';
const stages=(process.env.QUALITY_ESCORT_STAGES??'6').split(',').map(Number);
const seconds=Number(process.env.QUALITY_ESCORT_SECONDS??85);
const sizes=(process.env.QUALITY_ESCORT_SIZES??'844x340').split(',').map(s=>{const[width,height]=s.split('x').map(Number);return{width,height};});
await mkdir(out,{recursive:true});const harness=await readFile(new URL(import.meta.url));
await writeFile(path.join(out,'harness.mjs'),harness,{flag:'wx'});
const report={engine,build:await productionBuildIdentity(path.resolve(process.env.QUALITY_ESCORT_BUILD_ROOT)),
 scriptSha256:createHash('sha256').update(harness).digest('hex'),scope:'Prepared unlocked save, ordinary title/battle/card inputs. Unmodified combat clock, actors, stats, waves and objectives. No forced outcome. Silent original-speed context video; not earned progression or human/physical/performance acceptance.',cases:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true});
try{for(const viewport of sizes)for(const stage of stages){
 const label=engine+'-s'+stage+'-'+viewport.width+'x'+viewport.height,row={label,stage,samples:[],inputs:[]};report.cases.push(row);
 const save=normalizeV100Save({...createDefaultV100Save({playerName:'目的確認',settings:{bgmEnabled:false}}),revision:4,campaignStarted:true,
  availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,stage-1),registeredUnitIds:V100_UNITS.map(u=>u.id),ownedUnitIds:V100_UNITS.map(u=>u.id),
  formationSlots:['unit-hachi','unit-kumaverson','unit-nao',null,null,null,null],
  flowState:{phase:'formation',stageId:V100_STAGE_IDS[stage-1],stageNumber:stage,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
 const context=await browser.newContext({viewport,hasTouch:true,serviceWorkers:'block',recordVideo:{dir:path.join(out,label),size:viewport}});
 const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
 await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(save));
 try{
  await page.goto(new URL('?phase-g=1',base).href,{waitUntil:'domcontentloaded'});
  await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
  await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
  await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running&&document.documentElement.dataset.assetLoadState==='ready');
  // React removes the global QA owner on the normal result transition. Keep
  // its original read-only function, which still reads that battle's ref.
  await page.evaluate(()=>{window.__OBJECTIVE_READ__=window.__ASHFALL_BATTLE_QA__.getPhaseGCombatSnapshot;window.__ESCORT_READ__=window.__ASHFALL_BATTLE_QA__.getSnapshot;});
  row.snapshotOwnership='Original public read-only function retained across normal React teardown; no state setter or synthetic outcome.';
  const notice=page.getByText('オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。',{exact:true});
  if(await notice.isVisible())await notice.locator('..').getByRole('button',{name:'閉じる',exact:true}).click();
  if(process.env.QUALITY_ESCORT_PREPARED==='1'){
   row.prepared=await page.evaluate(mode=>window.__ASHFALL_BATTLE_QA__.prepareEscortCombatProof(mode),process.env.QUALITY_ESCORT_MODE??'solo');
   report.scope=row.prepared.scope+' Silent native video. Not natural progression, human or physical acceptance.';
   const t=await page.evaluate(()=>window.__OBJECTIVE_READ__().time);
   await page.waitForFunction(t=>window.__OBJECTIVE_READ__().time>t+.15,t);
  }else for(const name of ['ハチ','クマバーソン','ナオ']){
   const phases=[],tapped=await nativeBattleTap(page,page.locator('.unit-card').filter({hasText:name}).first(),phases);
   const actual=await page.evaluate(()=>{const s=window.__ESCORT_READ__();return{energy:s.energy,queue:s.deployQueue,banner:s.banner,fighters:s.fighters.map(f=>({id:f.id,kind:f.kind,side:f.side}))};});
   row.inputs.push({name,tapped,phases,actual});
  }
  const start=Date.now();let shot=0;
  while(Date.now()-start<seconds*1000){
   const sample=await page.evaluate(()=>{const s=window.__OBJECTIVE_READ__();return{time:s.time,over:s.over,won:s.won,baseHp:s.baseHp,eventIndex:s.eventIndex,mission:s.stageMission,escort:window.__ESCORT_READ__().escortFormation,
    fighters:s.fighters.map(f=>({id:f.id,kind:f.kind,side:f.side,x:f.x,y:f.y,lane:f.lane,hp:f.hp,targetId:f.targetId,destinationX:f.aiDestinationX,attackSequence:f.attackSequence,ready:f.combatReady,stunned:f.stunned}))};});
   row.samples.push(sample);
   if(row.samples.length===1||Date.now()-start>shot*5000||sample.over){await page.screenshot({path:path.join(out,label+'-'+shot+'.png')});shot++;}
   if(sample.over)break;
   await page.waitForTimeout(1000);
  }
  assert.equal(report.errors.length,0);assert.ok(row.samples.length>5,'real battle samples');
  if(process.env.QUALITY_ESCORT_ASSERT==='1'){
   assert.ok(row.prepared,'acceptance assertions require the documented prepared scene');
   const first=row.samples[0],last=row.samples.at(-1),guardId=row.prepared.humanIds[0];
   assert.ok(row.samples.some(s=>s.time<first.time+8&&s.fighters.some(f=>f.id===guardId&&f.attackSequence>0)),'escort attacks the nearby blocking enemy');
   assert.ok(row.samples.some(s=>s.fighters.some(f=>f.id===row.prepared.enemyId&&f.hp<first.fighters.find(f=>f.id===row.prepared.enemyId).hp)),'ordinary attacks damage the actual enemy');
   assert.ok(last.over&&last.won&&last.mission.completed,'actual escort completion without forcing outcome');
   assert.ok(last.mission.progress>=1,'actual cart reached destination');
   assert.ok(row.samples.some(s=>s.mission.progress>first.mission.progress),'escort resumes after clearing obstruction');
   if(row.prepared.mode==='handoff'){
    assert.equal(first.escort.units.find(u=>u.duty==='escort-anchor')?.id,guardId,'available scout takes over during medic stun');
    assert.ok(row.samples.some(s=>s.escort.units.some(u=>u.id===row.prepared.humanIds[1]&&u.duty==='escort-anchor')),'recovered medic resumes escort coverage');
   }
   row.status='passed';
  }else row.status='observed';
 }finally{await context.close();row.video=await page.video().path();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
}report.status=report.cases.every(c=>c.status==='passed')?'passed':'observed';}catch(e){report.status='failed';report.error=String(e);throw e;}finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,cases:report.cases.length,out}));
