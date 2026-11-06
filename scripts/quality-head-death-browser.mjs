import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {hasPreparedAllUnitPaint} from './v177-native-allunit-cases.mjs';
import {assertContinuousHumanCorpse} from './v177-human-corpse-contract.mjs';
const engine=process.env.QUALITY_DEATH_ENGINE??'chromium',observe=process.env.QUALITY_DEATH_OBSERVE==='1',checkInfection=process.env.QUALITY_DEATH_INFECTION!=='0';
const kinds=observe?['brawler']:['brawler','tky','zakimiya','babayaga','kumaverson'];
const out=path.resolve(process.env.QUALITY_DEATH_OUT);await mkdir(out,{recursive:true});
const report={engine,observe,checkInfection,build:await productionBuildIdentity(),scope:'Controlled lethal incoming damage on original actors. Real free-running fall and source paint; infection continuation only when checkInfection is true. Prepared fixture, not natural campaign, full-speed viewing or physical acceptance.',cases:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true});
try{
 for(const viewport of [{width:1280,height:720},{width:844,height:340}]){
  const context=await browser.newContext({viewport,serviceWorkers:'block',recordVideo:{dir:path.join(out,`${viewport.width}x${viewport.height}`),size:viewport}});
  try{
   const seed=normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,2),flowState:{phase:'formation',stageId:V100_STAGE_IDS[2],stageNumber:3,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
   await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
   const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
   await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);await dismissInstallOffer(page,{timeout:20000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
   const offline=page.getByText('オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。',{exact:true});if(await offline.isVisible())await offline.locator('..').getByRole('button',{name:'閉じる',exact:true}).click();
   await page.getByRole('button',{name:'戦闘へ',exact:true}).click();await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running&&document.documentElement.dataset.assetLoadState==='ready');
   for(const kind of kinds){
    const row={kind,viewport,draws:[],corpseDraws:[]};report.cases.push(row);
    for(const form of [kind,'walker'])await page.evaluate(async form=>window.__ASHFALL_BATTLE_QA__.ensureEnemyFacingProofAsset(form),form);
    const proof=await page.evaluate(form=>{const q=window.__ASHFALL_BATTLE_QA__,p=q.prepareV177ContinuousActorProof({form,phase:'engage'});q.setEnemyVfxProofPaused(true);return p;},kind);row.proof=proof;
    await page.waitForFunction(hasPreparedAllUnitPaint,proof,{timeout:5000});
    row.outcome=await page.evaluate(p=>window.__ASHFALL_BATTLE_QA__.queueV177ControlledOutcome(p),proof);
    const prefix=`${viewport.width}x${viewport.height}-${kind}`;
    await page.screenshot({path:path.join(out,prefix+'-live.png')});
    await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(false));
    const deadline=Date.now()+10000;
    while(Date.now()<deadline){
     const audit=await page.evaluate(id=>window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(id),proof.fighterId);
     for(const [to,from] of [['draws','renderHistory'],['corpseDraws','corpseRenderHistory']])for(const r of audit[from]??[])if(!row[to].some(d=>d.renderSequence===r.renderSequence))row[to].push(r);
     if(audit.corpse&&row.corpseDraws.filter(d=>d.fallProgress===1).length>=3){row.corpse=audit.corpse;break;}
     await page.waitForTimeout(80);
    }
    assert.ok(row.corpse,'actual death must occur');
    await page.screenshot({path:path.join(out,prefix+'-dead.png')});
    const live=row.draws.at(-1);assert.ok(live?.jointDrawSucceeded);assert.equal(live.jointAtlasPath,`/art/v100/joints/${kind}-quality-head-r1.webp`);
    if(!observe)assertContinuousHumanCorpse(kind,row.corpseDraws,live,row.corpse);
    if(!observe&&checkInfection&&kind==='brawler'&&viewport.width===1280){
     row.infectionWaitStart=await page.evaluate(()=>({at:performance.now(),time:window.__ASHFALL_BATTLE_QA__.getSnapshot().time}));
     try{await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.some(f=>f.kind==='turned'),undefined,{timeout:16000});}
     catch(error){row.infectionWaitFailure=await page.evaluate(()=>({at:performance.now(),snapshot:window.__ASHFALL_BATTLE_QA__.getSnapshot()}));throw error;}
     const id=await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(f=>f.kind==='turned').id);
     await page.waitForTimeout(1100);
     row.infection=await page.evaluate(id=>window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(id),id);
     assert.ok(row.infection.renderHistory.some(r=>r.jointGetupDrawSucceeded),'infection must use the actual rising rig');
     assert.ok(row.infection.renderHistory.some(r=>r.jointDrawSucceeded&&r.jointGetupProgress===null),'the newborn must finish rising');
     await page.screenshot({path:path.join(out,prefix+'-turned.png')});
    }
    row.status=observe?'observed':'passed';
   }
   assert.deepEqual(report.errors,[]);await context.close();report.cases.at(-1).video=await page.video().path();
  }finally{await context.close();}
 }
 report.status=observe?'observed':'passed';
}catch(e){report.status='failed';report.error=String(e);throw e;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,cases:report.cases.length,out}));
