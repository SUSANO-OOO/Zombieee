import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const origin=process.env.V100_CAMPAIGN_QA_BASE_URL;
const out=process.env.V100_PREPARATION_QA_OUT??'outputs/v100-preparation-r1';
await mkdir(out,{recursive:false});
const report={scope:'Isolated S3 purchase fixture; native selection and transactions. Not earned campaign or physical device evidence.',build:await productionBuildIdentity(),results:[]};
for(const [engine,browserType] of Object.entries({chromium,webkit})){
 if(process.env.V100_PREPARATION_QA_ENGINES&&!process.env.V100_PREPARATION_QA_ENGINES.split(',').includes(engine))continue;
 const browser=await browserType.launch({headless:true});
 try{for(const viewport of [{width:844,height:340},{width:844,height:390},{width:1280,height:720}]){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:true});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const result={engine,viewport,errors:[],status:'running'};report.results.push(result);
  page.on('pageerror',error=>result.errors.push(String(error)));
  page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)result.errors.push(r.status()+' '+r.url());});
  const shot=async label=>page.screenshot({path:`${out}/${engine}-${viewport.width}x${viewport.height}-${label}.png`});
  const visibleControl=async locator=>{
   const r=await locator.boundingBox();assert.ok(r&&r.x>=0&&r.y>=0&&r.x+r.width<=viewport.width+1&&r.y+r.height<=viewport.height+1,'Control is fully visible: '+await locator.innerText()+' '+JSON.stringify(r));
   assert.ok(await locator.evaluate(e=>{const r=e.getBoundingClientRect();return [[.5,.5],[.08,.08],[.92,.08],[.08,.92],[.92,.92]].every(([x,y])=>e.contains(document.elementFromPoint(r.x+r.width*x,r.y+r.height*y)));}),'Control is unoccluded at its center and all four corners');
  };
  try{
   const base=createDefaultV100Save({playerName:'準備画面確認'});
   const save=normalizeV100Save({...base,campaignStarted:true,revision:7,caps:500,readStoryEventIds:['v100:event:prologue'],availableStageIds:V100_STAGE_IDS.slice(0,4),completedStageIds:V100_STAGE_IDS.slice(0,3),registeredUnitIds:[...base.registeredUnitIds,'unit-nao'],supportPurchaseUnlockedIds:['support-healing'],flowState:{phase:'map'}});
   await page.addInitScript(value=>{for(const k of ['nishijin-campaign-v100','nishijin-campaign-v100:mirror','nishijin-campaign-v100:last-known-good'])localStorage.setItem(k,value);},serializeV100Save(save));
   await page.addInitScript(()=>{
    window.audioStartEvidence=[];
    if(!globalThis.AudioBufferSourceNode)return;
    const original=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){window.audioStartEvidence.push({at:performance.now(),loop:this.loop,duration:this.buffer?.duration});return original.apply(this,args);};
   });
   await page.goto(new URL('v100',origin).href);
   const play=page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true}),nav=page.getByRole('navigation',{name:'作戦準備メニュー'});
   await play.or(nav).first().waitFor({state:'visible'});if(await play.isVisible())await play.click();
   await nav.waitFor();await visibleControl(page.getByRole('button',{name:'この作戦を編成',exact:true}));await shot('map');
   await page.getByRole('button',{name:'会話記録',exact:true}).click();
   await page.getByRole('dialog',{name:'会話記録',exact:true}).getByRole('button',{name:'プロローグ',exact:true}).click();
   const replay=page.locator('[data-v100-replay-index]');
   await visibleControl(replay.getByRole('button',{name:'次へ',exact:true}));
   await replay.getByRole('button',{name:'次へ',exact:true}).click();
   assert.equal(await replay.getAttribute('data-v100-replay-index'),'1');await shot('replay');
   await page.waitForFunction(()=>window.__V100_EVENT_AUDIO_QA__?.getSnapshot().desired?.nodeIndex===1);
   result.replayAudio=await page.evaluate(()=>window.__V100_EVENT_AUDIO_QA__.getSnapshot());
   if(viewport.height===340){
    await page.waitForTimeout(1000);
    const starts=await page.evaluate(()=>window.audioStartEvidence.length);
    await page.waitForTimeout(30000);
    const held=await page.evaluate(()=>({starts:window.audioStartEvidence.length,audio:window.__V100_EVENT_AUDIO_QA__.getSnapshot()}));
    assert.equal(held.starts,starts,'A held dialogue node must not trigger periodic cues or restart its loop');
    assert.deepEqual(held.audio.diagnostics.duplicateLoopInstanceKeys,[]);
    result.heldDialogue={...held,status:held.audio.diagnostics.contextCreateCount>0?'passed':'unverified-web-audio-unavailable'};
   }
   await replay.getByRole('button',{name:'閉じる',exact:true}).click();
   await page.waitForFunction(()=>window.__V100_EVENT_AUDIO_QA__?.getSnapshot().desired?.sceneId==='map');
   await nav.getByRole('button',{name:'隊員',exact:true}).click();
   await page.locator('.v100-personnel-card').filter({has:page.getByRole('heading',{name:'ナオ',exact:true})}).click();
   const purchase=page.getByRole('button',{name:/配備登録 \d+ CAPS/});
   await visibleControl(purchase);await visibleControl(page.locator('.v100-personnel-focus h3'));
   assert.equal(await page.locator('.v100-personnel-screen').evaluate(e=>e.scrollTop),0,'Only roster scrolls');
   result.personnelStyle=await page.locator('.v100-personnel-grid,.v100-personnel-card,.v100-personnel-copy,.v100-personnel-copy h3').evaluateAll(es=>es.slice(0,5).map(e=>({name:e.className,rect:e.getBoundingClientRect().toJSON(),style:Object.fromEntries(['display','height','min-height','grid-template-rows','position','line-height','margin','transform','align-items'].map(p=>[p,getComputedStyle(e).getPropertyValue(p)]))})));
   await shot('nao-registration');
   const price=Number((await purchase.innerText()).match(/\d+/)[0]);
   await page.waitForTimeout(500);
   const audioBeforePurchase=await page.evaluate(()=>window.audioStartEvidence.filter(e=>!e.loop).length);
   await purchase.click();
   await page.getByRole('button',{name:/強化/}).waitFor();
   await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
   const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
   const actual=stored.save??stored.payload??stored;
   await page.waitForTimeout(500);
   const audioAfterPurchase=await page.evaluate(()=>window.audioStartEvidence.filter(e=>!e.loop).length);
   result.purchaseAudio={starts:audioAfterPurchase-audioBeforePurchase,
    status:audioAfterPurchase-audioBeforePurchase===1?'passed':'unverified',
    diagnostics:await page.evaluate(()=>window.__V100_EVENT_AUDIO_QA__.getSnapshot().diagnostics)};
   if(result.purchaseAudio.diagnostics.contextCreateCount>0)assert.equal(result.purchaseAudio.starts,1,'A purchase emits exactly one confirmation sound');
   result.purchase={price,caps:actual.caps,owned:actual.ownedUnitIds};
   assert.equal(actual.caps,500-price);assert.ok(actual.ownedUnitIds.includes('unit-nao'));
   for(const tab of ['支援','装備','車両']){
    await nav.getByRole('button',{name:tab,exact:true}).click();
    await page.waitForFunction(()=>[...document.images].filter(i=>i.offsetParent).every(i=>i.complete&&i.naturalWidth));
    await shot(tab);await visibleControl(nav.getByRole('button',{name:tab,exact:true}));
    if(tab==='支援'){assert.equal(await page.locator('.v100-vehicle-upgrade-hero').count(),0);await visibleControl(page.getByRole('button',{name:'50 CAPSで取得',exact:true}));}
    if(tab==='車両')assert.equal(await page.locator('.v100-support-management-list').count(),0);
    if(tab==='装備'){
     const focus=page.getByRole('complementary',{name:'選択中の装備'});
     await visibleControl(focus.getByRole('button',{name:'240 CAPSで購入',exact:true}));
     await page.locator('[data-equipment-id="survey-scope"]').click();
     assert.equal(await focus.getByRole('button',{name:'未解放',exact:true}).isDisabled(),true);await visibleControl(focus.getByRole('heading',{name:'測距照準器',exact:true}));await shot('equipment-locked');
     await page.locator('[data-equipment-id="field-machete"]').click();await focus.getByRole('button',{name:'240 CAPSで購入',exact:true}).click();
     await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');
     await page.getByRole('navigation',{name:'装備の種類'}).getByRole('button',{name:'個人装備',exact:true}).click();
     await page.getByLabel('装備枠 1',{exact:true}).selectOption('field-machete');
     await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');await shot('equipment-equipped');
     await visibleControl(focus.getByRole('button',{name:/CAPSで強化/}));
    }
   }
   await nav.getByRole('button',{name:'作戦',exact:true}).click();await page.getByRole('button',{name:'この作戦を編成',exact:true}).click();
   await page.getByRole('button',{name:'スキップ',exact:true}).click();await page.locator('section[data-v100-surface="formation"]').waitFor();
   await visibleControl(page.getByRole('button',{name:'戦闘へ',exact:true}));await visibleControl(page.getByRole('button',{name:/編成枠7/}));
   await page.getByRole('button',{name:/編成枠5/}).click();await page.getByRole('button',{name:'ナオを枠5へ配置',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');await shot('formation');
   await visibleControl(page.getByRole('button',{name:'戦闘へ',exact:true}));
   const rosterBox=await page.locator('.v100-formation-panel .v100-roster-grid').boundingBox();
   assert.ok(rosterBox && rosterBox.height>=64,'At least one whole row of units must fit without collapsing the roster');
   await page.locator('.v100-formation-panel .v100-roster-grid').evaluate(e=>e.scrollTop=0);
   await visibleControl(page.getByRole('button',{name:'ハチを枠5へ配置',exact:true}));
   assert.deepEqual(result.errors,[]);result.status='passed';
  }catch(error){result.status='failed';result.error=String(error);await shot('failure').catch(()=>{});}
  finally{await context.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
 }}finally{await browser.close();}
}
report.status=report.results.every(r=>r.status==='passed')?'passed':'failed';
report.audioStatus=report.results.every(r=>r.purchaseAudio?.status==='passed')?'passed':'partially-unverified';
report.audioLimitation='Windows WebKit has neither AudioContext nor webkitAudioContext in the independent game-free probe outputs/completion/probe-native-audio.json. Its UI results do not certify sound playback.';
await writeFile(out+'/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report.results.map(({engine,viewport,status,error})=>({engine,viewport,status,error}))));
if(report.status!=='passed')process.exitCode=1;
