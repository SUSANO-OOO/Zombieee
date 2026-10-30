import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import sharp from 'sharp';
import {inspectScenePaintContrast} from './quality-scene-paint.mjs';
import {V100_STORY_EVENTS} from '../app/v100StoryEvents.js';
import {v100StoryDirectionFor} from '../app/v100StoryDirection.js';
import {v100StoryPageFor} from '../app/v100StoryPages.js';
import {V100_QUALITY_SCENE_ASSETS} from '../app/v100QualitySceneAssets.js';
import {serializeV100Save} from '../app/v100Save.js';
import {createV100DialogueFixture} from './v100-dialogue-fixture.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {readV177PaintedSceneImage,readV177PaintedSceneSource,inspectV177PaintedSceneFaces} from './v177-painted-scene-geometry.mjs';
import {v177StoryDetailShotFor} from '../app/v177StoryDetailShots.js';

const engine=process.env.QUALITY_SCENE_ENGINE??'chromium';
const out=path.resolve(process.env.QUALITY_SCENE_OUT);await mkdir(out,{recursive:true});
const provenance=JSON.parse(await readFile('assets/source/quality-20261028/scenes/runtime-provenance-r1.json'));
const nodes=Object.entries(V100_STORY_EVENTS).flatMap(([eventId,event])=>event.nodes.map((node,nodeIndex)=>({eventId,node,nodeIndex})));
const fixtures=Object.entries(V100_QUALITY_SCENE_ASSETS).flatMap(([id,asset])=>{
 const found=nodes.find(({eventId,node,nodeIndex})=>v100StoryDirectionFor(eventId,nodeIndex,node).cut===id);
 return found?[{id,asset,...found}]:[];
});
assert.equal(fixtures.length,23,'all active story illustrations must use their selected model-based scenes');
const requestedIds=process.env.QUALITY_SCENE_ONLY_ID?.split(',');
if(requestedIds)assert.equal(new Set(requestedIds).size,requestedIds.length,'an explicit scene selection cannot repeat an ID');
const selectedFixtures=requestedIds?fixtures.filter(f=>requestedIds.includes(f.id)):fixtures;
assert.equal(selectedFixtures.length,requestedIds?.length??fixtures.length,'each explicitly selected scene must resolve exactly once');
const report={engine,build:await productionBuildIdentity(),selectedIds:selectedFixtures.map(f=>f.id),scope:'Prepared muted story checkpoints; native title continue, real decoded source bytes, log and next controls. Not campaign wins, numeric likeness, listening or physical-device acceptance.',cases:[],errors:[]};
const persist=()=>writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
const browser=await({chromium,webkit}[engine]).launch({headless:true,...(engine==='chromium'?{args:['--mute-audio']}:{})});
report.browser={engine,version:browser.version()};
try{
 for(const viewport of [{width:844,height:340},{width:1280,height:720}])for(const fixture of selectedFixtures){
  const label=`${viewport.width}x${viewport.height}-${fixture.id}`;
  const context=await browser.newContext({viewport,hasTouch:true,...(fixture.asset.newEvent?{recordVideo:{dir:path.join(out,label),size:viewport}}:{})});
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(String(e)));
  const row={label,fixture:{id:fixture.id,eventId:fixture.eventId,nodeIndex:fixture.nodeIndex},status:'running'};report.cases.push(row);
  try{
   const save=createV100DialogueFixture(fixture);
   save.settings={...save.settings,bgmEnabled:false,sfxEnabled:false};
   await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(save));
   await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);
   await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});
   await enterV100FromTitle(page);
   const scene=page.locator(`[data-v100-event-id="${fixture.eventId}"]`);await scene.waitFor();
   const expected=v100StoryPageFor(fixture.eventId,V100_STORY_EVENTS[fixture.eventId].nodes,fixture.nodeIndex);
   await page.waitForFunction(expected=>{
    const scene=document.querySelector(`[data-v100-event-id="${expected.eventId}"]`),img=scene?.querySelector('.v100-event-image:not(.v100-event-image-previous)');
    return img?.complete&&img.naturalWidth>0&&new URL(img.currentSrc||img.src).pathname.endsWith(expected.path)&&getComputedStyle(img).opacity==='1';
   },{eventId:fixture.eventId,path:fixture.asset.path});
   await page.evaluate(()=>document.fonts.ready);
   await scene.locator('.v100-event-image:not(.v100-event-image-previous)').evaluate(async image=>{
    await image.decode();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   });
   row.image=await scene.evaluate(readV177PaintedSceneImage);row.source=await scene.evaluate(readV177PaintedSceneSource);
   const source=provenance.records.find(row=>row.id===fixture.id);
   assert.equal(row.source.sha256,source.sha256,'actual fetched scene bytes');assert.equal(row.source.bytes,source.bytes);
   assert.equal(Number(await scene.getAttribute('data-v100-node-index')),expected.nodeIndex);
   row.copy=await scene.locator('.v100-node-copy').innerText();assert.ok(row.copy.includes(expected.node.text));
   row.geometry=await scene.evaluate(element=>{
    const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const copy=element.querySelector('.v100-node-copy'),button=copy.querySelector('button.v100-primary');
    const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    const details=[...element.querySelectorAll('.v177-story-detail-shot:not(.v177-story-detail-previous)')].map(figure=>({id:figure.dataset.v177StoryDetail,rect:rect(figure),imageWidth:Number(figure.querySelector('image')?.getAttribute('width')),imageHeight:Number(figure.querySelector('image')?.getAttribute('height'))}));
    return {scene:rect(element),heading:rect(element.querySelector('.v100-event-heading')),copy:rect(copy),button:rect(button),details,nextReachable:hit===button||button.contains(hit),overflow:Math.max(document.documentElement.scrollWidth-innerWidth,document.body.scrollWidth-innerWidth)};
   });
   const fits=r=>r.x>=0&&r.y>=0&&r.right<=viewport.width+1&&r.bottom<=viewport.height+1;
   assert.ok(fits(row.geometry.copy)&&fits(row.geometry.button));assert.ok(row.geometry.nextReachable);assert.ok(row.geometry.overflow<=1);
   assert.equal(row.image.objectFit,'contain','the whole painted scene remains visible');
   assert.ok(row.image.rect.y>=row.geometry.heading.bottom+7,'painting clears heading');
   assert.ok(row.image.rect.bottom<=row.geometry.copy.y-7,'painting clears dialogue');
   if(fixture.asset.detail){
    assert.equal(row.geometry.details.length,1);const detail=row.geometry.details[0],authored=fixture.asset.detail;
    assert.equal(detail.imageWidth,row.image.naturalWidth);assert.equal(detail.imageHeight,row.image.naturalHeight);
    assert.ok(Math.abs(detail.rect.width/detail.rect.height-authored.rect[2]/authored.rect[3])<.05,'the action inset follows its painted crop without empty bars');
    assert.ok(fits(detail.rect));
   }
   const authored=v177StoryDetailShotFor(fixture.asset.path);
   if(authored?.landmarks){
    assert.equal(row.source.sha256,authored.landmarkSourceHash);
    row.paintedFaces=inspectV177PaintedSceneFaces(authored,{scene:row.geometry.scene,copy:row.geometry.copy,headingBox:row.geometry.heading,paintedImage:row.image,detailShots:row.geometry.details.map(detail=>({id:detail.id,frame:detail.rect}))});
    assert.deepEqual(row.paintedFaces.issues,[],'current painted face cores clear the heading, dialogue, frame and action inset');
   }
   const screenshot=await page.screenshot({path:path.join(out,label+'.png')});
   const scale=Math.min(row.image.rect.width/row.image.naturalWidth,row.image.rect.height/row.image.naturalHeight);
   const paintedWidth=row.image.naturalWidth*scale,paintedHeight=row.image.naturalHeight*scale;
   row.paintSample={left:Math.round(row.image.rect.x+(row.image.rect.width-paintedWidth)/2+paintedWidth*.1),top:Math.round(row.image.rect.y+(row.image.rect.height-paintedHeight)/2+paintedHeight*.1),width:Math.floor(paintedWidth*.8),height:Math.floor(paintedHeight*.8)};
   const {data,info}=await sharp(screenshot).extract(row.paintSample).removeAlpha().raw().toBuffer({resolveWithObject:true});
   assert.equal(info.channels,3);row.paintContrast=inspectScenePaintContrast(data,info.width,info.height);
   assert.equal(row.paintContrast.painted,true,'the actual screenshot must contain painted scene pixels, not only a decoded image and empty backdrop');
   const before=await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100'));
   await page.getByRole('button',{name:'会話ログ',exact:true}).click();
   await page.getByRole('button',{name:'閉じる',exact:true}).click();
   assert.equal(await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100')),before);
   await page.getByRole('button',{name:'次へ',exact:true}).click();
   await page.waitForFunction(({eventId,nodeIndex})=>{
    const el=document.querySelector(`[data-v100-event-id="${eventId}"]`);return !el||Number(el.dataset.v100NodeIndex)!==nodeIndex;
   },{eventId:fixture.eventId,nodeIndex:expected.nodeIndex});
   row.status='passed';
  }catch(error){row.status='failed';row.error=String(error);await page.screenshot({path:path.join(out,label+'-failure.png')}).catch(()=>{});}
  finally{await context.close();await persist();console.log(JSON.stringify({engine,label,status:row.status,error:row.error}));}
 }
 assert.deepEqual(report.errors,[]);assert.ok(report.cases.every(row=>row.status==='passed'));report.status='passed';
}catch(error){report.status='failed';report.error=String(error);throw error;}
finally{await browser.close();await persist();}
