import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {nativeBattleTap} from './v100-normal-tactical-input.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const engine=process.env.QUALITY_HEAD_ENGINE??'chromium',before=process.env.QUALITY_HEAD_BEFORE==='1';
assert.ok(['chromium','webkit'].includes(engine));
const out=path.resolve(process.env.QUALITY_HEAD_OUT);await mkdir(out,{recursive:true});
const kinds=['brawler','tky','zakimiya'],ids=['unit-paisen','unit-tky','unit-zakimiya'];
const report={engine,before,build:await productionBuildIdentity(),scope:'Prepared owned level-1 trio at S03; native deployment and ability controls, no actor/time/HP/result setter. Before uses retained original head atlas bytes on the same build with service workers blocked. Not natural unlock progression, physical device, listening or likeness acceptance.',inputs:[],rows:[],overrides:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:720},hasTouch:true,serviceWorkers:'block',recordVideo:{dir:path.join(out,'video'),size:{width:1280,height:720}}});
 try{
  const seed=normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,ownedUnitIds:ids,registeredUnitIds:ids,formationSlots:ids,availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,2),flowState:{phase:'formation',stageId:V100_STAGE_IDS[2],stageNumber:3,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
  await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
  if(before)await context.route(/\/art\/v100\/joints\/(brawler|tky|zakimiya)-quality-head-r1\.webp(?:\?.*)?$/,async route=>{const kind=kinds.find(k=>route.request().url().includes('/'+k+'-quality-head'));const file='public/art/v100/joints/'+(kind==='brawler'?'brawler-photo-r2':kind+'-r1')+'.webp',body=await readFile(file);report.overrides.push({kind,file,sha256:createHash('sha256').update(body).digest('hex')});await route.fulfill({body,contentType:'image/webp'});});
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);await dismissInstallOffer(page,{timeout:20000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
  const offline=page.getByText('オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。',{exact:true});if(await offline.isVisible())await offline.locator('..').getByRole('button',{name:'閉じる',exact:true}).click();
  await page.getByRole('button',{name:'戦闘へ',exact:true}).click();await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running&&document.documentElement.dataset.assetLoadState==='ready');
  const seen=new Set(),deployed=new Set(),abilities=new Set(),deadline=Date.now()+105000;let resized=false;
  while(Date.now()<deadline){
   const s=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();if(!s)return null;return{time:s.time,running:s.running,fighters:s.fighters.filter(f=>['brawler','tky','zakimiya'].includes(f.kind)).map(f=>({id:f.id,kind:f.kind,hp:f.hp,x:f.x,y:f.y,state:f.renderAudit?.requestedState,lifecycleState:f.animationPresentation.state,manual:f.manualAbility,render:f.renderAudit}))};});
   if(!s)break;
   for(const f of s.fighters){deployed.add(f.kind);if(f.hp<=0||!f.render?.assetReady)continue;const key=f.kind+':'+f.state;const row={time:s.time,...f};report.rows.push(row);assert.equal(f.render.jointDrawSucceeded,true,f.kind+' articulated draw');assert.equal(f.render.jointAtlasPath,'/art/v100/joints/'+f.kind+'-quality-head-r1.webp');if(!seen.has(key)){seen.add(key);await page.screenshot({path:path.join(out,`${resized?'small':'large'}-${f.kind}-${f.state}.png`)});}}
   for(const kind of kinds)if(!deployed.has(kind)&&await nativeBattleTap(page,page.locator(`button.unit-card[data-kind="${kind}"]`).first()))report.inputs.push({time:s.time,action:'deploy',kind});
   for(const f of s.fighters)if(f.hp>0&&!abilities.has(f.kind)&&await nativeBattleTap(page,page.locator(`button[data-fighter-id="${f.id}"][data-ability-kind]`).first())){abilities.add(f.kind);report.inputs.push({time:s.time,action:'ability',kind:f.kind});}
   const attacked=kinds.every(k=>['active','recovery'].some(state=>seen.has(k+':'+state)));
   if(attacked&&abilities.size===3&&!resized){await page.screenshot({path:path.join(out,'trio-1280x720.png')});await page.setViewportSize({width:844,height:340});resized=true;}
   if(resized&&s.time>45){await page.screenshot({path:path.join(out,'trio-844x340.png')});break;}
   if(!s.running)break;await page.waitForTimeout(150);
  }
  report.states=[...seen];report.abilityInputs=[...abilities];assert.ok(kinds.every(k=>deployed.has(k)),'all three deployed');assert.ok(kinds.every(k=>report.rows.some(r=>r.kind===k&&r.state==='active'&&r.render.resolvedState==='active')),'all three normal attacks painted');assert.equal(abilities.size,3,'native ability input for every character');assert.ok(kinds.every(k=>report.rows.some(r=>r.kind===k&&r.manual?.activationId>0&&r.render.resolvedState==='special')),'each manual ability actually painted with the same head atlas');assert.equal(resized,true,'both viewport sizes captured');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));for(const key of ['ownedUnitIds','registeredUnitIds','caps','receipts'])assert.deepEqual(saved[key],seed[key],key);
  assert.deepEqual(report.errors,[]);report.status='passed';await context.close();report.video=await page.video().path();
 }finally{await context.close();}
}catch(e){report.status='failed';report.error=String(e);throw e;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,states:report.states,inputs:report.inputs.length,out}));
