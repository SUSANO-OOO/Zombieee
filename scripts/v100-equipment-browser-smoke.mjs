import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium, webkit } from 'playwright';
import { productionBuildIdentity } from './browser-qa-build-identity.mjs';
import { createDefaultV100Save, serializeV100Save, V100_PRIMARY_STORAGE_KEY as key } from '../app/v100Save.js';
import { campaignUnitIdToCombatKind } from '../app/campaign.js';
import { UNIT_CARDS } from '../app/gameRules.js';
const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(['127.0.0.1','localhost'].includes(origin.hostname));
const out = path.resolve(process.env.V100_EQUIPMENT_EVIDENCE_DIR ?? "outputs/v100-equipment-runtime");
await fs.mkdir(out, {recursive:false});
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const report = { host:process.platform, node:process.version, build:await productionBuildIdentity(), fullAcceptance:false,
  scope:'Synthetic funded Stage1 map. Actual UI/CAPS/native IDB/reload/production equipment; audio disabled, no audio or natural progression acceptance.', cases:[] };
const engines=(process.env.V100_EQUIPMENT_ENGINES ?? 'chromium,webkit').split(',');
assert.ok(engines.length>0 && engines.every(engine=>['chromium','webkit'].includes(engine)));
report.engines=engines;
const seed = createDefaultV100Save({ playerName:'装備監査', settings:{ bgmEnabled:false, sfxEnabled:false } });
seed.caps=2000; seed.campaignStarted=true; seed.flowState={...seed.flowState,phase:'map',destination:'map'};
const unitId=seed.ownedUnitIds[0], kind=campaignUnitIdToCombatKind(unitId), card=UNIT_CARDS.find(c=>c.kind===kind);
assert.ok(card);
const ready = page => page.waitForFunction(() => document.querySelector('.v100-shell[data-v100-phase]') && document.documentElement.dataset.pwaSaveMutationPending==='false');
const saved = page => page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
async function action(page, fn) { await ready(page); const before=(await saved(page)).revision; await fn(); await page.waitForFunction(({key,before})=>JSON.parse(localStorage.getItem(key)).revision>before && document.documentElement.dataset.pwaSaveMutationPending==='false',{key,before}); }
async function arrive(page) { await page.goto(new URL('/v100',origin).href,{waitUntil:'domcontentloaded'}); await page.waitForFunction(()=>document.querySelector('.v100-shell')||document.querySelector('[role=dialog][aria-label="ゲームデータの準備"] button')); const offer=page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true}); if(await offer.isVisible())await offer.click(); await ready(page); }
async function openEquipment(page) { await page.getByRole('button',{name:'出撃装備を選ぶ',exact:true}).click(); await page.getByRole('button',{name:'隊員・部隊装備 / 購入・装着・強化',exact:true}).click(); await page.locator('section[data-v100-surface="equipment"]').waitFor(); }
async function snap(page,record,label) { const file=path.join(out,`${record.name}-${label}.png`); const bytes=await page.screenshot({path:file,timeout:45000,animations:'disabled'}); record.images.push({file,sha256:hash(bytes),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)}); }
try {
for(const [engine,type] of Object.entries({chromium,webkit}).filter(([engine])=>engines.includes(engine))) {
 const browser=await type.launch();
 try { for(const viewport of [{width:1280,height:720},{width:844,height:390},{width:844,height:340}]) {
  const record={name:`${engine}-${viewport.width}x${viewport.height}`,engine,version:browser.version(),viewport,images:[],errors:[],status:'running'}; report.cases.push(record);
  const context=await browser.newContext({viewport,hasTouch:viewport.width<1000});
  await context.addInitScript(({key,seed,origin})=>{
    if(location.origin!==origin)return;
    if(!localStorage.getItem(key))localStorage.setItem(key,seed);
    const transaction=IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction=function(stores,mode){const tx=Reflect.apply(transaction,this,arguments);if(this.name===key&&mode==='readwrite'&&window.__GEAR_ABORT__)tx.abort();return tx;};
  },{key,seed:serializeV100Save(seed),origin:origin.origin});
  const page=await context.newPage();page.setDefaultTimeout(45000);
  page.on('console',m=>{if(m.type()==='error')record.errors.push({type:'console',message:m.text()});});
  page.on('pageerror',e=>record.errors.push({type:'page',message:String(e)}));
  page.on('requestfailed',r=>record.errors.push({type:'request',url:r.url(),error:r.failure()}));
  page.on('response',r=>{if(r.status()>=400)record.errors.push({type:'http',status:r.status(),url:r.url()});});
  try {
    await arrive(page);await openEquipment(page);
    await page.getByRole('button',{name:'補給所',exact:true}).click();
    assert.equal(await page.locator('.v100-equipment-card').count(),12);
    assert.equal(await page.getByText('防衛線補修キット',{exact:true}).count(),0);
    await snap(page,record,'shop');
    const machete=page.locator('[data-equipment-id="field-machete"]');
    const before=await saved(page);await page.evaluate(()=>{window.__GEAR_ABORT__=true;});
    await machete.getByRole('button',{name:'240 CAPSで購入',exact:true}).click();
    await page.getByText('セーブを書き込めませんでした。現在の画面と進行を保持します。',{exact:true}).waitFor();await ready(page);
    assert.deepEqual(await saved(page),before);assert.match(await machete.innerText(),/所持 0/);
    record.aborted={revision:before.revision,caps:before.caps,inventory:before.equipment.inventory};
    await page.evaluate(()=>{window.__GEAR_ABORT__=false;});
    await action(page,()=>machete.getByRole('button',{name:'240 CAPSで購入',exact:true}).click());
    await action(page,()=>machete.getByRole('button',{name:'100 CAPSで強化',exact:true}).click());
    await action(page,()=>page.locator('[data-equipment-id="tactical-supply-cache"]').getByRole('button',{name:'420 CAPSで購入',exact:true}).click());
    await action(page,()=>page.locator('[data-equipment-id="tactical-flare-controller"]').getByRole('button',{name:'410 CAPSで購入',exact:true}).click());
    await page.getByRole('button',{name:'個人装備',exact:true}).click();
    await action(page,()=>page.getByLabel('装備枠 1',{exact:true}).selectOption('field-machete'));
    await snap(page,record,'personal');
    const beforeDuplicate=await saved(page);await page.getByLabel('装備枠 2',{exact:true}).selectOption('field-machete');
    await page.getByText('同じ装備を重ねて装着できません。別の隊員が使用中の場合は追加購入するか外してください。',{exact:true}).waitFor();
    assert.deepEqual(await saved(page),beforeDuplicate);assert.equal(await page.getByLabel('装備枠 2',{exact:true}).inputValue(),'');
    await page.getByRole('button',{name:'部隊装備',exact:true}).click();
    await action(page,()=>page.getByLabel('装備枠 1',{exact:true}).selectOption('tactical-supply-cache'));
    await action(page,()=>page.getByLabel('装備枠 2',{exact:true}).selectOption('tactical-flare-controller'));
    await snap(page,record,'tactical');record.save=await saved(page);assert.equal(record.save.caps,830);
    record.native=await page.evaluate(async key=>new Promise((resolve,reject)=>{const r=indexedDB.open(key);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('saves','readonly'),q=tx.objectStore('saves').get('current');let value;q.onsuccess=()=>{value=JSON.parse(q.result.serialized);};tx.oncomplete=()=>{db.close();resolve(value);};tx.onabort=()=>reject(tx.error);};}),key);
    assert.deepEqual(record.native,record.save);
    await arrive(page);assert.deepEqual(await saved(page),record.save);await openEquipment(page);
    assert.equal(await page.getByLabel('装備枠 1',{exact:true}).inputValue(),'field-machete');
    await page.getByRole('button',{name:'出撃装備へ',exact:true}).click();await page.getByRole('button',{name:'作戦地図へ',exact:true}).click();
    await action(page,()=>page.getByRole('button',{name:'この作戦を編成',exact:true}).click());
    for(let n=0;n<40;n++){await ready(page);if(await page.locator('.v100-formation-panel').isVisible())break;const skip=page.getByRole('button',{name:'スキップ',exact:true});await action(page,()=>skip.isVisible().then(visible=>visible?skip.click():page.locator('.v100-event-actions .v100-primary').click()));}
    await action(page,()=>page.getByRole('button',{name:'戦闘へ',exact:true}).click());
    await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot().running);
    record.opening=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__.getSnapshot();return {time:s.time,energy:s.energy,supportGauge:s.supportGauge,baseHp:s.baseHp,baseMaxHp:s.baseMaxHp};});
    assert.equal(record.opening.supportGauge,92);assert.equal(record.opening.baseMaxHp,680);assert.equal(record.opening.baseHp,680);
    assert.ok(Math.abs(record.opening.energy-3*record.opening.time-78)<0.001);
    await page.locator(`.unit-card[data-kind="${kind}"]`).first().click();
    await page.waitForFunction(kind=>window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.some(f=>f.side==='human'&&f.kind===kind),kind);
    await page.getByRole('button',{name:'一時停止',exact:true}).click();
    record.fighter=await page.evaluate(kind=>{const f=window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(f=>f.side==='human'&&f.kind===kind);return {kind:f.kind,damage:f.damage,maxHp:f.maxHp};},kind);
    assert.ok(Math.abs(record.fighter.damage-card.damage*1.065)<0.00001);
    await snap(page,record,'battle');assert.deepEqual(record.errors,[]);record.status='passed-storage-runtime-audio-disabled';
    console.log(JSON.stringify({name:record.name,status:record.status,images:record.images.length}));
  } catch(error){record.status='failed';record.error=String(error);record.stack=error.stack;await snap(page,record,'failure').catch(()=>{});throw error;}
  finally{await context.close();await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
 }} finally {await browser.close();}
}
} finally {await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
