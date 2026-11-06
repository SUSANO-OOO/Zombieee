import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium, webkit } from 'playwright';
import { productionBuildIdentity } from './browser-qa-build-identity.mjs';
import { enterV100FromTitle, seedV100BrowserSaveOnce } from './v100-title-qa-entry.mjs';
import { dismissInstallOffer } from './pwa-gate-qa.mjs';
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from '../app/v100Save.js';
import { V100_STAGE_IDS } from '../app/v100Registry.js';

const url = new URL(process.env.QUALITY_HUD_URL), out = path.resolve(process.env.QUALITY_HUD_OUT);
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
url.searchParams.set('qaResourcePressure','1');
const engine = process.env.QUALITY_HUD_ENGINE ?? 'chromium';
assert.ok(['chromium','webkit'].includes(engine));
const buildRoot = process.env.QUALITY_HUD_BUILD_ROOT;
const build = await productionBuildIdentity(buildRoot);
const snapshot = JSON.parse(await readFile(path.join(buildRoot,'snapshot.json'),'utf8'));
assert.equal(build.combinedSha256,snapshot.combinedSha256);
await mkdir(out,{recursive:false});
const override = process.env.QUALITY_HUD_CSS ? await readFile(process.env.QUALITY_HUD_CSS,'utf8') : null;
const seed = normalizeV100Save({...createDefaultV100Save({settings:{bgmEnabled:false}}),campaignStarted:true,playerName:'検証',
  flowState:{phase:'formation',stageId:V100_STAGE_IDS[0],stageNumber:1,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
const scenarios = [
  {width:844,height:390}, {width:844,height:340}, {width:667,height:375},
  {width:667,height:375,inset:44}, {width:1280,height:720}, {width:340,height:220,extraSmall:true},
].filter(s => !process.env.QUALITY_HUD_ONLY || `${s.width}x${s.height}-inset${s.inset??0}` === process.env.QUALITY_HUD_ONLY);
assert.ok(scenarios.length);
const report = {scope:'Actual S01 entry and HUD geometry in isolated profiles; no victory/clock/resource mutation. Insets are CSS emulation, not physical-device proof. Optional CSS override is a prototype, not built product.',engine,build,snapshot,
  scriptSha256:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),
  overrideSha256:override ? createHash('sha256').update(override).digest('hex') : null,cases:[],errors:[]};
const browser = await ({chromium,webkit}[engine]).launch({headless:true});
try {
  for (const scenario of scenarios) {
    const id=`${scenario.width}x${scenario.height}-inset${scenario.inset??0}`;
    const viewport={width:scenario.width,height:scenario.height};
    const context=await browser.newContext({viewport,hasTouch:scenario.width<1000,serviceWorkers:'block',...(process.env.QUALITY_HUD_VIDEO==='1'?{recordVideo:{dir:path.join(out,id+'-video'),size:viewport}}:{})});
    await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
    const page=await context.newPage(); page.on('pageerror',e=>report.errors.push(String(e)));
    try {
      const caseUrl=new URL(url);if(scenario.inset)caseUrl.searchParams.set('safe','iphone-landscape');
      await page.goto(caseUrl.href);
      await dismissInstallOffer(page,{timeout:30000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});
      await enterV100FromTitle(page);
      const notice=page.getByText('オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。',{exact:true});
      if(await notice.isVisible()) await notice.locator('..').getByRole('button',{name:'閉じる',exact:true}).click();
      await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
      await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running&&document.documentElement.dataset.assetLoadState==='ready');
      if(override) await page.addStyleTag({content:override});
      await page.waitForTimeout(180);
      const geometry=await page.evaluate(()=>{
        const rect=el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
        const nodes=[['name','.brand-block b','.battle-brand-zone'],['health','.crawler-health','.battle-brand-zone'],['phase','.battle-controls-zone .phase-block','.battle-controls-zone'],['message','.battle-message-stack','.top-hud']];
        const items=nodes.map(([id,sel,owner])=>{const el=document.querySelector(sel),parent=document.querySelector(owner),style=getComputedStyle(el);const b=rect(el),p=rect(parent);
          const range=document.createRange();range.selectNodeContents(el);const ink=rect(range);
          return {id,text:el.textContent,box:b,owner:p,ink,fontSize:style.fontSize,owned:b.left>=p.left-.5&&b.right<=p.right+.5&&b.top>=p.top-.5&&b.bottom<=p.bottom+.5,inkContained:ink.left>=b.left-.5&&ink.right<=b.right+.5&&ink.top>=b.top-.5&&ink.bottom<=b.bottom+.5};});
        const buttons=[...document.querySelectorAll('.battle-controls-zone button')].map(el=>({label:el.getAttribute('aria-label'),box:rect(el)}));
        const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5;
        const collisions=items.flatMap((a,i)=>items.slice(i+1).filter(b=>overlap(a.box,b.box)).map(b=>[a.id,b.id]));
        const rootStyle=getComputedStyle(document.documentElement);
        return {layout:document.querySelector('.game-frame').dataset.battleHudLayout,items,buttons,collisions,safeArea:{source:document.documentElement.dataset.safeAreaSource,left:parseFloat(rootStyle.getPropertyValue('--app-viewport-safe-left'))||0,right:parseFloat(rootStyle.getPropertyValue('--app-viewport-safe-right'))||0},viewport:{width:innerWidth,height:innerHeight},state:window.__ASHFALL_BATTLE_QA__.getV100ResourcePressureProof()};
      });
      await page.screenshot({path:path.join(out,id+'.png')});
      const row={id,scenario,geometry,operations:[]};report.cases.push(row);
      assert.equal(geometry.safeArea.left,scenario.inset??0);
      assert.equal(geometry.safeArea.right,scenario.inset??0);
      if(scenario.inset)assert.equal(geometry.safeArea.source,'local-qa-iphone-landscape');
      if(process.env.QUALITY_HUD_ASSERT === '1'){
        assert.deepEqual(geometry.collisions,[],id+' HUD overlap');
        assert.deepEqual(geometry.items.filter(i=>!i.owned).map(i=>i.id),[],id+' ownership');
        assert.ok(geometry.buttons.every(b=>b.box.width>=43.5&&b.box.height>=43.5),id+' 44px control bounds');
      }
      await page.getByRole('button',{name:'一時停止',exact:true}).click();
      await page.getByRole('dialog',{name:'一時停止メニュー',exact:true}).waitFor({state:'visible'});
      row.operations.push('native pause accepted');
      await page.getByRole('dialog',{name:'一時停止メニュー',exact:true}).getByRole('button',{name:'戦闘を再開',exact:true}).click();
      await page.getByRole('button',{name:'一時停止',exact:true}).waitFor({state:'visible'});
      row.operations.push('native resume accepted');
      const sound=page.locator('.battle-controls-zone button').last();
      const muted=await sound.getAttribute('data-muted');await sound.click();
      await page.waitForFunction(previous=>document.querySelector('.battle-controls-zone button:last-child')?.getAttribute('data-muted')!==previous,muted,{timeout:10000});
      assert.notEqual(await sound.getAttribute('data-muted'),muted);
      await sound.click();
      await page.waitForFunction(previous=>document.querySelector('.battle-controls-zone button:last-child')?.getAttribute('data-muted')===previous,muted,{timeout:10000});
      assert.equal(await sound.getAttribute('data-muted'),muted);
      row.operations.push('native SFX toggle and restore accepted; audibility not assessed');
      row.video=page.video()?await page.video().path():null;
    } finally {await context.close();}
    await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  }
  assert.deepEqual(report.errors,[]);report.status='observed';
} catch(error){report.status='failed';report.failure=String(error);throw error;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({out,cases:report.cases.map(c=>({id:c.id,collisions:c.geometry.collisions,unowned:c.geometry.items.filter(i=>!i.owned).map(i=>i.id),inkOverflow:c.geometry.items.filter(i=>!i.inkContained).map(i=>i.id)}))}));
