import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_UNITS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {V100_EQUIPMENT_CATALOG} from '../app/v100Equipment.js';
import {v100EquipmentComparison} from '../app/v100EquipmentComparison.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const engine=process.env.QUALITY_FITTING_ENGINE??'chromium',before=process.env.QUALITY_FITTING_BEFORE==='1';
const out=path.resolve(process.env.QUALITY_FITTING_OUT);await mkdir(out,{recursive:true});
const report={engine,before,build:await productionBuildIdentity(),scope:'Prepared isolated initial and owned-equipment saves; UI comparison and real purchase/equip/reload. Not earned progression or physical touch.',cases:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true});
try{
 for(const viewport of [{width:844,height:340},{width:844,height:390},{width:1280,height:720}])for(const scenario of ['empty','owned']){
  const base=createDefaultV100Save();
  const seed=normalizeV100Save({...base,campaignStarted:true,caps:scenario==='empty'?500:20000,
   ...(scenario==='owned'?{ownedUnitIds:V100_UNITS.map(u=>u.id),registeredUnitIds:V100_UNITS.map(u=>u.id),completedStageIds:V100_STAGE_IDS,availableStageIds:V100_STAGE_IDS,equipment:{inventory:Object.fromEntries(V100_EQUIPMENT_CATALOG.map(i=>[i.id,i.slotType==='personal'?2:1])),personalByUnit:{'unit-paisen':['reinforced-vest',null]},tacticalIds:[null,null],enhancementLevels:{'reinforced-vest':2}}}:{}),
   flowState:{phase:'map',stageId:null,stageNumber:null,eventId:null,destination:'map',nodeIndex:0,firstClear:false,finalized:true}});
  const label=`${viewport.width}x${viewport.height}-${scenario}`,row={label,checks:[]};report.cases.push(row);
  const context=await browser.newContext({viewport,hasTouch:true,recordVideo:{dir:path.join(out,label),size:viewport}});
  try{
   await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
   await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);await dismissInstallOffer(page,{timeout:20000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
   const nav=page.locator('.v100-command-tabs');await nav.getByRole('button',{name:'装備',exact:true}).click();
   const panel=page.locator('[data-v100-surface="equipment"]'),tabs=panel.getByRole('navigation',{name:'装備の種類'});
   const fitting=page.getByRole('dialog');
   const openFitting=async()=>{
    await panel.getByRole('button',{name:'装備を比べる',exact:true}).click();await fitting.waitFor();
    for(const el of await fitting.locator('button,select').all()){
     const box=await el.boundingBox();assert.ok(box&&box.height>=44&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,'fitting control must fit at 44px');
     assert.ok(await el.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'control center must receive the pointer');
    }
    assert.ok(await fitting.evaluate(el=>el.contains(document.activeElement)),'dialog receives focus');
   };
   const closeFitting=async()=>{await fitting.getByRole('button',{name:'閉じる',exact:true}).click();await fitting.waitFor({state:'hidden'});assert.ok(await panel.getByRole('button',{name:'装備を比べる',exact:true}).evaluate(e=>e===document.activeElement),'close returns focus');};
   const ready=()=>page.waitForFunction(()=>document.querySelector('#v100-campaign')?.getAttribute('aria-busy')==='false');
   const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
   const shot=async suffix=>{await page.waitForFunction(()=>[...document.images].filter(i=>i.offsetParent).every(i=>i.complete&&i.naturalWidth));await page.screenshot({path:path.join(out,label+'-'+suffix+'.png')});};
   await ready();const initial=await saved();await shot('entry');
   await tabs.getByRole('button',{name:'個人装備',exact:true}).click();await shot('personal');
   if(before){row.status='observed';continue;}
   if(scenario==='empty'){
    await panel.getByRole('button',{name:'補給所で装備を探す',exact:true}).click();
    await panel.locator('[data-equipment-id="reinforced-vest"]').click();
    await openFitting();await fitting.getByLabel('効果を比べる仲間',{exact:true}).selectOption('unit-paisen');
    const expected=v100EquipmentComparison(seed,{unitId:'unit-paisen',itemId:'reinforced-vest',slot:0});
    assert.equal(await fitting.locator('[data-stat="hp"] strong').innerText(),expected.changes.find(c=>c.key==='hp').afterLabel);
    assert.deepEqual(await saved(),initial,'comparison alone cannot mutate save');await shot('preview');await closeFitting();
    await panel.getByRole('button',{name:'280 CAPSで購入',exact:true}).click();await ready();
    await openFitting();await fitting.getByRole('button',{name:'枠1に装備する',exact:true}).click();await ready();await closeFitting();
    const equipped=await saved();assert.equal(equipped.caps,220);assert.equal(equipped.equipment.personalByUnit['unit-paisen'][0],'reinforced-vest');assert.equal(equipped.equipment.inventory['reinforced-vest'],1);assert.deepEqual(equipped.receipts,[...initial.receipts,'v100:equipment:reinforced-vest:purchase:1']);
    await shot('equipped');await page.reload();await dismissInstallOffer(page,{timeout:20000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
    assert.deepEqual((await saved()).equipment,equipped.equipment);row.checks.push('preview-readonly','purchase-280','equip-without-extra-charge','reload-preserves-gear');
   }else{
    for(const item of V100_EQUIPMENT_CATALOG){
     await tabs.getByRole('button',{name:item.slotType==='personal'?'個人装備':'部隊装備',exact:true}).click();await panel.locator(`[data-equipment-id="${item.id}"]`).click();
     await openFitting();await fitting.getByLabel('効果を比べる仲間',{exact:true}).selectOption('unit-paisen');
     const expected=v100EquipmentComparison(seed,{unitId:'unit-paisen',itemId:item.id,slot:0});
     assert.equal(await fitting.locator('[data-stat]').count(),expected.changes.length,item.id+' exact changed stats');
     for(const change of expected.changes){
      assert.equal(await fitting.locator(`[data-stat="${change.key}"] dd span`).first().innerText(),change.beforeLabel,item.id+':'+change.key+' before');
      assert.equal(await fitting.locator(`[data-stat="${change.key}"] strong`).innerText(),change.afterLabel,item.id+':'+change.key+' after');
     }
     await closeFitting();
     row.checks.push(item.id);
    }
    await tabs.getByRole('button',{name:'個人装備',exact:true}).click();await panel.locator('[data-equipment-id="field-machete"]').click();await openFitting();await shot('replacement');await page.keyboard.press('Escape');await fitting.waitFor({state:'hidden'});
    assert.deepEqual(await saved(),initial,'all catalog browsing and fitting must preserve save');
   }
   row.status='passed';
  }finally{await context.close();}
 }
 assert.deepEqual(report.errors,[]);report.status=before?'observed':'passed';
}catch(e){report.status='failed';report.error=String(e);throw e;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,cases:report.cases.length,out}));
