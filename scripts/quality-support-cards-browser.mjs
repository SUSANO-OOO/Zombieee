import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createDefaultV100Save,applyV100SaveMutation,serializeV100Save,validateV100SavePayload} from '../app/v100Save.js';
import {V100_STORY_SCRIPT_VERSION} from '../app/v100StoryEvents.js';
import {pwaBrowserType} from './pwa-browser-runtime.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const out=path.resolve(process.env.QUALITY_SUPPORT_CARDS_OUT??'output/quality-20261028/support-cards-r4');await mkdir(out,{recursive:true});
const selectedKind=process.env.QUALITY_SUPPORT_CARDS_KIND;
assert.ok(!selectedKind||['mizuchi','monkey','tatara','raider','gantetsu','chiha','musashi','mayo','king'].includes(selectedKind));
const ownerFor=kind=>({chiha:'mrs-chiha',musashi:'miyamoto-musashi',mayo:'mayo-chan',king:'crazy-king'})[kind]??kind;
const initial=createDefaultV100Save(),stageId=initial.availableStageIds[0];
const seed=applyV100SaveMutation(initial,draft=>({...draft,campaignStarted:true,playerName:'立ち絵確認',eventCursor:null,
  flowState:{...draft.flowState,phase:'formation',stageId,stageNumber:1,eventId:null,nodeIndex:0,scriptVersion:V100_STORY_SCRIPT_VERSION}})).save;
const validation=validateV100SavePayload(JSON.parse(serializeV100Save(seed)));assert.ok(validation.ok,JSON.stringify(validation));
const report={scope:'Prepared S01 formation. Same current UI with previous retained images (before-assets) vs new images (after-assets). Service workers deliberately blocked for controlled byte replacement; resulting offline-setup notice is dismissed through its button. Not PWA/offline acceptance, a previous release build, played campaign progression, physical device or Producer acceptance.',build:await productionBuildIdentity(),cases:[],errors:[]};
const browser=await (await pwaBrowserType('chromium')).launch({headless:true});
try{
  for(const viewport of [{width:844,height:340},{width:1280,height:720}])for(const mode of ['before-assets','after-assets']){
    const label=`${viewport.width}x${viewport.height}-${mode}`;
    const overrides=[];
    const context=await browser.newContext({viewport,serviceWorkers:'block',recordVideo:{dir:path.join(out,label),size:viewport}});
    try{
      await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
      if(mode==='before-assets')await context.route(/\/art\/v100\/portraits\/(hachi|nao|mizuchi|monkey|tatara|raider|gantetsu|chiha|musashi|mayo|king)-(.+)-quality-r1\.webp(?:\?.*)?$/,async route=>{
        const [,kind,variant]=/\/portraits\/(hachi|nao|mizuchi|monkey|tatara|raider|gantetsu|chiha|musashi|mayo|king)-(.+)-quality-r1\.webp$/.exec(new URL(route.request().url()).pathname);
        const combat={hachi:'scout',nao:'medic',mizuchi:'ranger',monkey:'engineer',tatara:'brute',raider:'gunner',gantetsu:'guardian',king:'crazy-king'}[kind]??ownerFor(kind);
        const newer=['chiha','musashi','mayo'].includes(kind);
        const file=newer?(variant==='formation-card'?`public/art/v0995/characters/cards/${combat}-formation-card-r2.webp`:`public/art/v0995/characters/portraits/${combat}-event-portrait-r2.webp`):variant==='formation-card'?(kind==='monkey'?'public/art/v0995/characters/cards/monkey-formation-card-r3.webp':`public/art/v080/characters/cards/${combat}-formation-card-r2.webp`):kind==='king'?'public/art/v060/characters/portraits/crazy-king-portrait-v2.webp':`public/art/v070/characters/portraits/${combat}-portrait-v1.webp`;
        const body=await readFile(path.resolve(file));
        overrides.push({kind,variant,file,sha256:createHash('sha256').update(body).digest('hex')});
        await route.fulfill({body,contentType:'image/webp'});
      });
      const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>report.errors.push(String(error)));
      const imagesReady=selector=>page.waitForFunction(s=>[...document.querySelectorAll(s)].length>0&&[...document.querySelectorAll(s)].every(img=>img.complete&&img.naturalWidth>0),selector);
      const shot=async(name,selector)=>{
        await imagesReady(selector);
        const offlineNotice=page.getByText('オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。',{exact:true});
        if(await offlineNotice.isVisible())await offlineNotice.locator('..').getByRole('button',{name:'閉じる',exact:true}).click();
        await page.screenshot({path:path.join(out,`${label}-${name}.png`)});
        report.cases.push({viewport,mode,name,images:await page.locator(selector).evaluateAll(images=>images.map(img=>({src:img.getAttribute('src'),width:img.getBoundingClientRect().width,height:img.getBoundingClientRect().height})))});
      };
      await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);await dismissInstallOffer(page,{timeout:20000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
      await page.locator('[data-v100-surface="formation"]').waitFor();
      if(!selectedKind)await shot('hachi-formation','[data-v100-focused-unit="unit-hachi"] img');
      const before=await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100'));
      await page.locator('.v100-command-tabs').getByRole('button',{name:'ユニット',exact:true}).click();
      if(selectedKind){
        await page.locator('.v100-personnel-card').filter({has:page.getByRole('heading',{name:{mizuchi:'ミズチ',monkey:'モンキー',tatara:'タタラ',raider:'レイダー',gantetsu:'ガンテツ',chiha:'Mrs.チハ',musashi:'宮本武蔵',mayo:'マヨちゃん',king:'クレイジーキング'}[selectedKind],exact:true})}).click();
        await shot(`${selectedKind}-personnel`,`[data-unit-id="unit-${ownerFor(selectedKind)}"] .v100-personnel-focus-art img`);
      }else{
      await page.locator('.v100-personnel-card').filter({has:page.getByRole('heading',{name:'ハチ',exact:true})}).click();
      await shot('hachi-personnel','[data-unit-id="unit-hachi"] .v100-personnel-focus-art img');
      const backToRoster=page.getByRole('button',{name:'ユニット一覧へ',exact:true});
      if(await backToRoster.isVisible())await backToRoster.click();
      await page.locator('.v100-personnel-card').filter({has:page.getByRole('heading',{name:'ナオ',exact:true})}).click();
      await shot('nao-personnel','[data-unit-id="unit-nao"] .v100-personnel-focus-art img');
      }
      if(mode==='before-assets')for(const [kind,variant] of (selectedKind?[[selectedKind,'formation-card']]:[['hachi','determined'],['hachi','formation-card'],['nao','formation-card']]))
        assert.ok(overrides.some(row=>row.kind===kind&&row.variant===variant),`Old image bytes were not served: ${kind}/${variant}`);
      report.cases.at(-1).oldImageOverrides=overrides;
      assert.equal(await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100')),before,'Viewing cards must not change progression or purchases');
    }finally{await context.close();}
  }
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.status='passed';
}catch(error){report.status='failed';report.error=String(error);throw error;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,cases:report.cases.length,out}));
