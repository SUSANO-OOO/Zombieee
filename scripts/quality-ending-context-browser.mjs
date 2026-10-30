import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium,webkit } from 'playwright';
import { createDefaultV100Save,normalizeV100Save,serializeV100Save } from '../app/v100Save.js';
import { V100_STAGE_IDS } from '../app/v100Registry.js';
import { seedV100BrowserSaveOnce,enterV100FromTitle } from './v100-title-qa-entry.mjs';
import { dismissInstallOffer } from './pwa-gate-qa.mjs';
import { productionBuildIdentity } from './browser-qa-build-identity.mjs';
import {V100_CREDITS_FILM} from '../app/v100CreditsFilm.js';
import sharp from 'sharp';
import {inspectScenePaintContrast} from './quality-scene-paint.mjs';

const engine=process.env.QUALITY_ENDING_ENGINE??'chromium';
const out=path.resolve(process.env.QUALITY_ENDING_OUT);await mkdir(out,{recursive:true});
const provenance=JSON.parse(await readFile('assets/source/quality-20261028/scenes/runtime-provenance-r1.json'));
const sceneRecords=[...provenance.records,...(provenance.reusedScenes??[]).map(scene=>({...scene,reused:true}))];
const recordsById=new Map(sceneRecords.map(scene=>[scene.id,scene]));
const filmAssetIds=new Map(sceneRecords.map(scene=>[scene.path,scene.id]));
const filmSceneIds=V100_CREDITS_FILM.map(shot=>{
 const id=filmAssetIds.get(shot.src);assert.ok(id,'Unreviewed film image: '+shot.id);return id;
});
assert.equal(filmSceneIds.length,25,'all actual movie images, including retained art, are included in the native playback check');
assert.equal(new Set(filmSceneIds).size,25);
const report={engine,build:await productionBuildIdentity(),scope:'Prepared finale and postgame saves; native UI and real-time credits. Not a natural all-30 clear, physical-device or listening acceptance.',cases:[],errors:[]};
const browser=await({chromium,webkit}[engine]).launch({headless:true});
const persist=()=>writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
const completeBase={...createDefaultV100Save(),campaignStarted:true,caps:137,availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS,postGameAvailable:true,bestStars:Object.fromEntries(V100_STAGE_IDS.map(id=>[id,1])),readStoryEventIds:['v100:event:ending','v100:event:credits'],flowState:{phase:'map',stageId:V100_STAGE_IDS[29],stageNumber:30,eventId:null,destination:'postgame-map',nodeIndex:0,firstClear:false,finalized:true}};
async function open(seed,viewport,label,video=false){
  const context=await browser.newContext({viewport,hasTouch:true,...(video?{recordVideo:{dir:path.join(out,label),size:viewport}}:{})});
  await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(normalizeV100Save(seed)));
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);
  await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});
  await enterV100FromTitle(page);
  await page.waitForFunction(()=>document.querySelector('#v100-campaign')?.getAttribute('aria-busy')==='false');
  return {context,page};
}
const save=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
try{
 for(const viewport of [{width:844,height:340},{width:1280,height:720}]){
  for(const state of ['complete','finale-unread','one-stage-missing']){
   const label=`${state}-${viewport.width}x${viewport.height}`;
   const seed={...completeBase,...(state==='finale-unread'?{readStoryEventIds:['v100:event:ending']}:{}),...(state==='one-stage-missing'?{completedStageIds:V100_STAGE_IDS.slice(0,29)}:{})};
   const {context,page}=await open(seed,viewport,label);const row={label};report.cases.push(row);
   try{
    const before=await save(page),hero=page.locator('.v100-regional-progress');
    await hero.waitFor({state:'visible'});
    assert.ok((await hero.boundingBox())?.height>0);
    assert.equal(await hero.getAttribute('data-story-complete'),String(state==='complete'));
    row.text=await hero.innerText();
    if(state==='complete'){
      assert.match(row.text,/物語クリア/u);assert.match(row.text,/自由に再戦・星集め/u);
      row.fits=await hero.evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return r.height>0&&r.width>0&&r.top>=p.top&&r.bottom<=p.bottom+1&&r.width<=p.width&&el.scrollWidth<=el.clientWidth+1;});assert.equal(row.fits,true);
      await page.screenshot({path:path.join(out,`${label}.png`)});
      await page.getByRole('navigation',{name:'エリアを選ぶ'}).getByRole('button').first().click();
      assert.equal(await hero.getAttribute('data-story-complete'),'true');
      await page.screenshot({path:path.join(out,`${label}-first-area.png`)});
    }else assert.doesNotMatch(row.text,/物語クリア/u);
    const after=await save(page);
    for(const key of ['caps','receipts','bestStars','completedStageIds','ownedUnitIds','equipment','readStoryEventIds'])assert.deepEqual(after[key],before[key],key);
    row.status='passed';
   }finally{await context.close();await persist();}
  }
  if(process.env.QUALITY_ENDING_MAP_ONLY === "1") continue;
  const label=`credits-${viewport.width}x${viewport.height}`;
  const seed={...completeBase,readStoryEventIds:['v100:event:ending'],flowState:{...completeBase.flowState,phase:'credits',eventId:'v100:event:credits',destination:'credits'}};
  const {context,page}=await open(seed,viewport,label,true);const row={label,status:'running'};report.cases.push(row);
  try{
    const start=Date.now(),roll=page.locator('.v100-staff-roll');await roll.waitFor();
    const audio=page.getByRole('button',{name:'曲を再生して始める',exact:true});if(await audio.isVisible())await audio.click();
    row.modelSceneFrames=[];
    const captureModelScene=async id=>{
      const record=recordsById.get(id),expected=record.path;
      await page.waitForFunction(expected=>[...document.querySelectorAll('img.v100-credit-shot:not(.v100-credit-shot-next)')].some(img=>img.complete&&img.naturalWidth>0&&getComputedStyle(img).opacity==='1'&&new URL(img.currentSrc||img.src).pathname.endsWith(expected)),expected,{timeout:115000});
      const image=await page.locator('img.v100-credit-shot:not(.v100-credit-shot-next)').evaluateAll((images,expected)=>{
        const img=images.find(img=>new URL(img.currentSrc||img.src).pathname.endsWith(expected));
        if(!img)return null;const rect=img.getBoundingClientRect();
        return {src:img.currentSrc||img.src,complete:img.complete,width:img.naturalWidth,height:img.naturalHeight,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}};
      },expected);
      assert.ok(image?.complete&&image.width>0&&image.height>0,id);
      const locator=page.locator('img.v100-credit-shot:not(.v100-credit-shot-next)');
      await locator.evaluate(async img=>{await img.decode();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
      const source=await locator.evaluate(async img=>{
        const response=await fetch(img.currentSrc||img.src,{cache:'force-cache'});if(!response.ok)throw Error('Current film image fetch failed: '+response.status);
        const bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
        return {bytes:bytes.byteLength,sha256:[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('')};
      });
      assert.equal(source.bytes,record.bytes);assert.equal(source.sha256,record.sha256);
      const screenshot=await page.screenshot({path:path.join(out,`${label}-${id}.png`)});
      const sample={left:Math.round(viewport.width*.08),top:Math.round(viewport.height*.25),width:Math.floor(viewport.width*.45),height:Math.floor(viewport.height*.5)};
      const {data,info}=await sharp(screenshot).extract(sample).removeAlpha().raw().toBuffer({resolveWithObject:true});
      assert.equal(info.channels,3);const paintContrast=inspectScenePaintContrast(data,info.width,info.height);
      assert.equal(paintContrast.painted,true,'current film image is actually painted');
      const layout=await page.evaluate(()=>{
        const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,height:r.height};};
        const movie=document.querySelector('.v100-credit-landscape'),credits=document.querySelector('.v100-credit-roll-window');
        return {movie:rect(movie),credits:rect(credits),overflowX:getComputedStyle(movie).overflowX,overflowY:getComputedStyle(movie).overflowY};
      });
      assert.ok(layout.movie.width>0&&layout.movie.height>0&&layout.movie.right<=layout.credits.x-6,'the film stays clear of all scrolling credits');
      assert.equal(layout.overflowX,'hidden');assert.equal(layout.overflowY,'hidden');
      row.modelSceneFrames.push({id,reused:record.reused===true,image,source,paintContrast,layout,elapsedSeconds:(Date.now()-start)/1000});
      await persist();
    };
    const earlyFilmSceneIds=filmSceneIds.filter(id=>V100_CREDITS_FILM.slice(0,3).some(shot=>shot.src===recordsById.get(id).path));
    const captionTask=(async()=>{
      await page.waitForFunction(()=>{const el=document.querySelector('.v100-credit-time-context'),win=document.querySelector('.v100-credit-roll-window');if(!el||!win)return false;const r=el.getBoundingClientRect(),w=win.getBoundingClientRect();return r.top>=w.top+4&&r.bottom<=w.bottom-4;},null,{timeout:30000});
      row.caption=await page.locator('.v100-credit-time-context').innerText();assert.equal(row.caption,'その後の西新');
      row.captionAtSeconds=(Date.now()-start)/1000;
      await page.screenshot({path:path.join(out,`${label}-caption.png`)});
      return true;
    })().catch(error=>{row.captionError=String(error);return false;});
    for(const id of earlyFilmSceneIds)await captureModelScene(id);
    assert.ok(await captionTask,row.captionError);
    row.speed=viewport.width===844?1:4;
    if(row.speed===4){await page.getByRole('button',{name:'映像と文字の速さ：通常。曲は通常速度',exact:true}).click();await page.getByRole('button',{name:'映像と文字の速さ：2倍。曲は通常速度',exact:true}).click();}
    row.speedChangeAtSeconds=(Date.now()-start)/1000;
    await persist();
    for(const id of filmSceneIds.filter(id=>!earlyFilmSceneIds.includes(id)))await captureModelScene(id);
    assert.deepEqual(row.modelSceneFrames.map(frame=>frame.id),filmSceneIds);
    await page.locator('.v100-shell[data-v100-phase="map"]').waitFor({timeout:140000});
    row.transitionSeconds=(Date.now()-start)/1000;
    assert.ok(row.transitionSeconds>=(row.speed===1?100:25)&&row.transitionSeconds<140);
    assert.equal(await page.locator('.v100-regional-progress').getAttribute('data-story-complete'),'true');
    row.status='passed';await page.screenshot({path:path.join(out,`${label}-postgame.png`)});
  }finally{await context.close();await persist();}
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.error=String(error);throw error;}
finally{await browser.close();await persist();}
