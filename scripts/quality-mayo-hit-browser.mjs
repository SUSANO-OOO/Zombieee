import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {seedV100BrowserSaveOnce,enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const engine=process.env.QUALITY_MAYO_HIT_ENGINE??'webkit',baseline=process.env.QUALITY_MAYO_HIT_BASELINE==='1';
const out=path.resolve(process.env.QUALITY_MAYO_HIT_OUT),url=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(['127.0.0.1','localhost'].includes(url.hostname));assert.ok(['chromium','webkit'].includes(engine));
await mkdir(out,{recursive:false});await writeFile(path.join(out,'driver.mjs'),await readFile(new URL(import.meta.url)));
const original=createDefaultV100Save(),ids=['unit-mayo-chan'];
const seed=normalizeV100Save({...original,campaignStarted:true,settings:{...original.settings,masterVolume:0},ownedUnitIds:ids,registeredUnitIds:ids,formationSlots:ids,
 flowState:{phase:'formation',stageId:V100_STAGE_IDS[0],stageNumber:1,destination:'formation',eventId:null,nodeIndex:0,firstClear:false,finalized:true}});
const report={engine,baseline,build:await productionBuildIdentity(process.env.QUALITY_MAYO_HIT_BUILD_ROOT),
 scope:'Local diagnostic: existing animation fixture sets the feral render form and a first-paint hit in the same browser task, with simulation paused. This reproduces missing current-form paint history, not natural activation timing, frequency, performance, audio or physical acceptance.',cases:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true});
try{
 for(const viewport of [{width:844,height:340},{width:1280,height:720}]){
  const label=`${viewport.width}x${viewport.height}`,context=await browser.newContext({viewport,serviceWorkers:'block',recordVideo:{dir:path.join(out,label),size:viewport}});
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
  try{
   await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));await page.goto(url.href);
   await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
   await page.getByRole('button',{name:'戦闘へ',exact:true}).click();await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot().running&&document.documentElement.dataset.assetLoadState==='ready');
   await page.evaluate(async()=>{const q=window.__ASHFALL_BATTLE_QA__;q.setEnemyVfxProofPaused(true);await q.ensureEnemyFacingProofAsset('mayo-chan-feral');});
   const before=await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100'));
   for(const state of ['hit-light','hit-heavy']){
    const row={label,state};report.cases.push(row);
    row.proof=await page.evaluate(state=>{const q=window.__ASHFALL_BATTLE_QA__,p=q.prepareAnimationFoundationProof('mayo-chan','human','mayo-chan-feral');q.stepAnimationFoundationProof(p.fighterId,state,.04);return p;},state);
    await page.waitForFunction(({id,state})=>window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(id)?.renderHistory.some(r=>r.renderKind==='mayo-chan-feral'&&r.requestedState===state),{id:row.proof.fighterId,state});
    row.hit=await page.evaluate(id=>window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(id),row.proof.fighterId);
    const draws=row.hit.renderHistory.filter(r=>r.renderKind==='mayo-chan-feral'&&r.requestedState===state);
    assert.ok(draws.length);assert.ok(draws.every(r=>r.assetReady));assert.ok(draws.every(r=>Boolean(r.jointDrawSucceeded)===!baseline));
    if(!baseline)assert.ok(draws.every(r=>r.jointAtlasPath==='/art/v100/joints/mayo-feral-r1.webp'));
    await page.screenshot({path:path.join(out,label+'-'+state+'.png')});
    await page.evaluate(id=>window.__ASHFALL_BATTLE_QA__.stepAnimationFoundationProof(id,'move-right',.05),row.proof.fighterId);
    await page.waitForFunction(id=>{const r=window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(id)?.renderHistory.at(-1);return r?.renderKind==='mayo-chan-feral'&&r.jointDrawSucceeded&&['move','start-move'].includes(r.requestedState);},row.proof.fighterId);
    row.recovered=await page.evaluate(id=>window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(id).renderHistory.at(-1),row.proof.fighterId);
    assert.equal(await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100')),before);row.status=baseline?'reproduced-fallback':'passed-current-form';
   }
  }finally{await context.close();report.cases.filter(r=>r.label===label).forEach(r=>r.video=page.video().path());for(const row of report.cases)row.video=await row.video;}
 }
 assert.deepEqual(report.errors,[]);
}catch(error){report.error=String(error);throw error;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({cases:report.cases.map(({label,state,status})=>({label,state,status})),out}));
