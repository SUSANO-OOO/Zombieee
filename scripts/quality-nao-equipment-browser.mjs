import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {equipV100Equipment} from '../app/v100Transactions.js';
import {v100UnitPresentation,formatV100Number} from '../app/v100UnitPresentation.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const engine=process.env.QUALITY_NAO_EQUIPMENT_ENGINE??'webkit',baseline=process.env.QUALITY_NAO_EQUIPMENT_BASELINE==='1';
const out=path.resolve(process.env.QUALITY_NAO_EQUIPMENT_OUT),url=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(['127.0.0.1','localhost'].includes(url.hostname));assert.ok(['chromium','webkit'].includes(engine));
await mkdir(out,{recursive:false});await writeFile(path.join(out,'driver.mjs'),await readFile(new URL(import.meta.url)));
const base=createDefaultV100Save(),seed=normalizeV100Save({...base,campaignStarted:true,ownedUnitIds:['unit-nao','unit-paisen'],registeredUnitIds:['unit-nao','unit-paisen'],formationSlots:['unit-nao','unit-paisen'],
 equipment:{inventory:{'field-machete':1,'rescue-pouch':1},personalByUnit:{},tacticalIds:[],enhancementLevels:{}},
 flowState:{phase:'map',eventId:null,nodeIndex:0,stageId:null,stageNumber:null,destination:'map',firstClear:false,finalized:true}});
const report={engine,baseline,build:await productionBuildIdentity(process.env.QUALITY_NAO_EQUIPMENT_ROOT),scope:baseline?'Prepared owned-equipment save; comparison only, no assignment or reload. Not earned purchase, battle or whole-game acceptance.':'Prepared owned-equipment save. Real comparison, equipment assignment and reload; no earned purchase, battle, listening, physical or whole-game acceptance.',cases:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true});
try{for(const viewport of [{width:844,height:340},{width:1280,height:720}]){
 const label=viewport.width+'x'+viewport.height,row={label};report.cases.push(row);
 const context=await browser.newContext({viewport,hasTouch:true,serviceWorkers:'block',recordVideo:{dir:path.join(out,label),size:viewport}}),page=await context.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',e=>report.errors.push(String(e)));
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
 try{
  await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));await page.goto(url.href);
  await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
  const notice=page.locator('.pwa-notice').getByRole('button',{name:'閉じる',exact:true});if(await notice.isVisible())await notice.click();
  await page.locator('.v100-command-tabs').getByRole('button',{name:'装備',exact:true}).click();
  const panel=page.locator('[data-v100-surface="equipment"]'),dialog=page.getByRole('dialog');
  const initial=await saved();row.saveBefore=initial;
  const open=async(id,unit)=>{if(await notice.isVisible())await notice.click();await panel.locator(`[data-equipment-id="${id}"]`).click();await panel.getByRole('button',{name:'装備を比べる',exact:true}).click();await dialog.waitFor();await dialog.getByLabel('効果を比べる仲間',{exact:true}).selectOption(unit);};
  const close=async()=>{await dialog.getByRole('button',{name:'閉じる',exact:true}).click();await dialog.waitFor({state:'hidden'});};
  await open('field-machete','unit-nao');
  const expected=equipV100Equipment(initial,{unitId:'unit-nao',equipmentId:'field-machete',slot:0});assert.ok(expected.applied);
  row.before=v100UnitPresentation(initial,'unit-nao').current;row.after=v100UnitPresentation(expected.save,'unit-nao').current;
  row.text=await dialog.innerText();row.damageRows=await dialog.locator('[data-stat="damage"]').count();
  if(baseline){assert.equal(row.damageRows,0);assert.ok(row.text.includes('この仲間の戦闘能力は変わりません。'));}
  else{assert.equal(row.damageRows,1);assert.equal(await dialog.locator('[data-stat="damage"] dd span').first().innerText(),formatV100Number(row.before.damage));assert.equal(await dialog.locator('[data-stat="damage"] strong').innerText(),formatV100Number(row.after.damage));assert.equal(row.text.includes('この仲間の戦闘能力は変わりません。'),false);}
  assert.equal(await dialog.locator('[data-stat="healing"]').count(),0);
  await page.screenshot({path:path.join(out,label+'-shooting.png')});await close();
  await open('rescue-pouch','unit-nao');assert.equal(await dialog.locator('[data-stat="healing"]').count(),1);assert.equal(await dialog.locator('[data-stat="damage"]').count(),0);
  await page.screenshot({path:path.join(out,label+'-healing.png')});await dialog.getByLabel('効果を比べる仲間',{exact:true}).selectOption('unit-paisen');assert.equal(await dialog.locator('[data-stat]').count(),0);await close();
  row.saveAfterComparison=await saved();assert.deepEqual(row.saveAfterComparison,initial,'comparison is read-only');
  if(!baseline){await open('field-machete','unit-nao');await dialog.getByRole('button',{name:'枠1に装備する',exact:true}).click();
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')).equipment.personalByUnit['unit-nao']?.[0]==='field-machete'&&document.documentElement.dataset.pwaSaveMutationPending==='false');
   row.equipped=await saved();assert.deepEqual(row.equipped.equipment,expected.save.equipment);
   for(const key of ['caps','receipts','unitLevels','ownedUnitIds','registeredUnitIds','formationSlots','completedStageIds','vehicle'])assert.deepEqual(row.equipped[key],initial[key],key);
   await close();await page.reload();await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);assert.deepEqual((await saved()).equipment,row.equipped.equipment);
  }
  row.status=baseline?'reproduced':'passed';
 }catch(e){row.error=String(e);await page.screenshot({path:path.join(out,label+'-failure.png')}).catch(()=>{});throw e;}
 finally{await context.close();row.video=await page.video().path();}
}assert.deepEqual(report.errors,[]);report.status='passed';}
catch(e){report.error=String(e);throw e;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({engine,baseline,status:report.status,cases:report.cases.map(r=>({label:r.label,status:r.status,damageRows:r.damageRows}))}));
