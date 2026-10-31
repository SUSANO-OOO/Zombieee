import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createDefaultV100Save,applyV100SaveMutation,serializeV100Save} from '../app/v100Save.js';
import {createV100BattleResult} from '../app/v100Transactions.js';
import {pwaBrowserType} from './pwa-browser-runtime.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const out=path.resolve(process.env.QUALITY_RETRY_OUTPUT??'output/quality-20261028/retry-r2');await mkdir(out,{recursive:true});
const initial=createDefaultV100Save();
const loss=createV100BattleResult({stageId:initial.availableStageIds[0],battleRunId:'quality:prepared-defeat',won:false});
const seed=applyV100SaveMutation(initial,draft=>({...draft,campaignStarted:true,playerName:'再挑戦確認',eventCursor:null,pendingResult:null,lastResult:loss,
  flowState:{...draft.flowState,phase:'result',eventId:null,stageId:loss.stageId,stageNumber:loss.stageNumber,nodeIndex:0,finalized:false}})).save;
const browser=await (await pwaBrowserType('chromium')).launch({headless:true});
const report={scope:'Prepared defeat fixture, native double click and reload starting the same stage again. This is not a naturally played defeat, saved battlefield restoration or a save-failure test.',build:await productionBuildIdentity(),errors:[]};
const context=await browser.newContext({viewport:{width:844,height:340},recordVideo:{dir:out,size:{width:844,height:340}}});
try {
  await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
  await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);
  await dismissInstallOffer(page,{timeout:20000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});
  await enterV100FromTitle(page);await page.locator('[data-v100-surface="result-lose"]').waitFor();
  const before=await read();await page.screenshot({path:path.join(out,'defeat.png')});
  await page.getByRole('button',{name:'同じ編成で再挑戦',exact:true}).dblclick({delay:30});
  await page.locator('#v100-campaign[data-v100-phase="battle"]').waitFor();
  const after=await read();assert.equal(after.revision,before.revision+1);
  for(const k of ['formationSlots','caps','receipts','bestStars','ownedUnitIds','unitLevels','equipment','vehicle'])assert.deepEqual(after[k],before[k],k);
  assert.equal(after.pendingResult,null);await page.screenshot({path:path.join(out,'retried-battle.png')});
  await page.reload();await dismissInstallOffer(page,{timeout:20000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});
  await enterV100FromTitle(page);await page.locator('#v100-campaign[data-v100-phase="battle"]').waitFor();
  const restored=await read();for(const k of ['formationSlots','caps','receipts','bestStars','ownedUnitIds','unitLevels','equipment','vehicle'])assert.deepEqual(restored[k],before[k],k);
  assert.equal(restored.flowState.phase,'battle');assert.equal(restored.flowState.stageId,after.flowState.stageId);
  assert.equal(restored.revision,after.revision);assert.equal(restored.pendingResult,null);
  await page.screenshot({path:path.join(out,'reload-battle.png')});
  assert.equal(report.errors.length,0);report.status='passed';report.revisions={before:before.revision,after:after.revision,restored:restored.revision};
}catch(error){report.status='failed';report.error=String(error);throw error;}
finally{await context.close();await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,out}));
