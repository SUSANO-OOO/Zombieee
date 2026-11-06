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
const out=path.resolve('output/quality-20261028/panther-battle-r1');await mkdir(out,{recursive:true});
const base=createDefaultV100Save(),owned=[...new Set([...base.ownedUnitIds,'unit-gantetsu','unit-babayaga'])];
const seed=normalizeV100Save({...base,campaignStarted:true,playerName:'部隊表示確認',availableStageIds:V100_STAGE_IDS,
 completedStageIds:V100_STAGE_IDS.slice(0,22),ownedUnitIds:owned,registeredUnitIds:owned,
 formationSlots:['unit-gantetsu','unit-babayaga',null,null,null,null,null],eventCursor:null,
 flowState:{phase:'formation',stageId:V100_STAGE_IDS[22],stageNumber:23,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
const report={scope:'Isolated prepared S23 checkpoint, default unit levels, native title/formation/deployment inputs and unmodified battle clock. Not earned campaign progression, victory acceptance or physical-device testing.',build:await productionBuildIdentity(),errors:[],inputs:[],samples:[]};
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:844,height:340},recordVideo:{dir:out,size:{width:844,height:340}}});
try {
 const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
 await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
 await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);
 await dismissInstallOffer(page,{timeout:20000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});
 await enterV100FromTitle(page);await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
 await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
 const seen=new Set(),deadline=Date.now()+65000;let shot=false;
 while(Date.now()<deadline) {
  const state=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__.getSnapshot();return {time:s.time,running:s.running,baseHp:s.baseHp,
   humans:s.fighters.filter(f=>f.side==='human'&&f.hp>0).length,queued:s.deployQueue?.length??0,
   enemies:s.fighters.filter(f=>f.kind.startsWith('red-panther')&&f.hp>0).map(f=>({id:f.id,kind:f.kind,x:f.x,y:f.y,hp:f.hp,attack:f.attack,windup:f.attackWindup,render:f.renderAudit}))};});
  report.samples.push(state);for(const f of state.enemies)if(f.render?.jointDrawSucceeded)seen.add(f.kind);
  if(state.humans+state.queued<3)for(const kind of ['guardian','babayaga']) {
    const button=page.locator('button.unit-card[data-kind="'+kind+'"]').first();
    if(await button.count()&&await nativeBattleTap(page,button))report.inputs.push({time:state.time,kind});
  }
  if(!shot&&state.enemies.some(f=>f.kind==='red-panther-shield'&&f.x<700)&&state.enemies.some(f=>f.kind==='red-panther-knife'&&f.x<700)){
   await page.screenshot({path:path.join(out,'knife-shield.png')});shot=true;
  }
  if(!state.running||state.time>45)break;
  await page.waitForTimeout(250);
 }
 report.seen=[...seen];await page.screenshot({path:path.join(out,'battle.png')});
 for(const kind of ['red-panther-knife','red-panther-shield'])assert.ok(seen.has(kind),kind+' must actually be painted');
 assert.equal(report.errors.length,0);report.status='observed';await context.close();report.video=await page.video().path();
}catch(e){report.status='failed';report.error=String(e);throw e;}
finally{await context.close();await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,seen:report.seen,samples:report.samples.length,inputs:report.inputs.length,video:report.video}));
