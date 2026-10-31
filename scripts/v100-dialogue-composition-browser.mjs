import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {pwaBrowserType} from './pwa-browser-runtime.mjs';
import {V100_STORY_EVENTS} from '../app/v100StoryEvents.js';
import {v100StoryDirectionFor} from '../app/v100StoryDirection.js';
import {isV100StoryBackdropReady} from './v100-story-backdrop-ready.mjs';
import {v100StoryInsertFor} from '../app/v100StoryInserts.js';
import {v100StoryPageFor} from '../app/v100StoryPages.js';
import {enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {publicDisplayText} from '../app/publicDisplayNames.js';
import {serializeV100Save} from '../app/v100Save.js';
import {createV100DialogueFixture} from './v100-dialogue-fixture.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {readV100IdentityFrames,assertV100IdentityFrames,assertV100IdentitySizingControl} from './v100-identity-frame-geometry.mjs';
import {v177StoryDetailShotFor} from '../app/v177StoryDetailShots.js';
import {readV177StoryPortraitPaint} from './v177-story-portrait-paint.mjs';
import {readV177PaintedSceneImage,readV177PaintedSceneSource,inspectV177PaintedSceneFaces} from './v177-painted-scene-geometry.mjs';
function readDetailShots(element){
 const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
 return [...element.querySelectorAll('.v177-story-detail-shot:not(.v177-story-detail-previous)')].map(figure=>{
  const svg=figure.querySelector('svg'),clip=svg.querySelector('clipPath'),crop=clip?.querySelector('rect'),image=svg.querySelector('image');
  const style=getComputedStyle(figure),ancestorFilters=[];
  for(let parent=figure.parentElement;parent&&element.contains(parent);parent=parent.parentElement){
   const filter=getComputedStyle(parent).filter;if(filter!=='none')ancestorFilters.push({className:parent.className,filter});
  }
  return{id:figure.dataset.v177StoryDetail,frame:rect(figure),viewBox:svg.getAttribute('viewBox').split(/\s+/u).map(Number),clipRect:crop?['x','y','width','height'].map(key=>Number(crop.getAttribute(key))):null,clipId:clip?.id??null,imageClip:image?.getAttribute('clip-path')??null,href:image?.getAttribute('href')??null,pointerEvents:style.pointerEvents,filter:style.filter,ancestorFilters,insideBackdrop:Boolean(figure.closest('.v100-event-backdrop')),layerIndex:Number(style.zIndex),veilIndex:Number(getComputedStyle(element,'::before').zIndex)};
 });
}
const origin=process.env.V100_CAMPAIGN_QA_BASE_URL;
const out=process.env.V100_DIALOGUE_QA_OUT??'outputs/v100-dialogue-improvement-r1';
await mkdir(dirname(out),{recursive:true});
await mkdir(out,{recursive:false});
const ownerCase=(owner)=>{
 for(const [eventId,event] of Object.entries(V100_STORY_EVENTS)){
  const nodeIndex=event.nodes.findIndex(n=>n.portraitOwner===owner);
  if(nodeIndex>=0)return {id:owner,eventId,nodeIndex};
 }
 throw new Error('Missing canonical portrait '+owner);
};
const all=Object.entries(V100_STORY_EVENTS).flatMap(([eventId,event])=>event.nodes.map((node,nodeIndex)=>({eventId,nodeIndex,node})));
const longest=all.filter(x=>x.node.kind==='dialogue').sort((a,b)=>b.node.text.length-a.node.text.length)[0];
// Every new illustrated cut and explanatory insert is inspected. Fixtures
// bind to the current producer script, rather than obsolete R5 node indices.
const currentCuts=new Map();
for(const {eventId,nodeIndex,node}of all){
 const direction=v100StoryDirectionFor(eventId,nodeIndex,node);
 if(direction.cut&&!currentCuts.has(direction.cut))currentCuts.set(direction.cut,{id:direction.cut,eventId,nodeIndex,backdrop:direction.backgroundPath});
}
const cutCases=[...currentCuts.values()];
const insertIds=[...new Set(all.map(({node})=>node.insertId).filter(Boolean))];
const insertCases=insertIds.map(insertId=>{
 const found=all.find(({node})=>node.insertId===insertId);
 return {id:'insert-'+insertId,eventId:found.eventId,nodeIndex:found.nodeIndex,insertId};
});
assert.equal(cutCases.length,23,'all active R9 and retained R5 story cuts, including the three new Babayaga scenes');
assert.equal(insertCases.length,18);
const insertStateCases=[
 {id:'message-backlog-received',insertId:'message-backlog',matches:state=>state.messageVisible&&!state.dated},
 {id:'message-backlog-dated',insertId:'message-backlog',matches:state=>state.dated},
 {id:'family-ledger-confirmed',insertId:'family-ledger',matches:state=>state.familyConfirmed},
 {id:'medical-observation-followup',insertId:'medical-observation',matches:state=>state.observed},
].map(({id,insertId,matches})=>{
 const found=all.find(({node})=>node.insertId===insertId&&matches(v100StoryInsertFor(insertId,node.sourceLine)));
 assert.ok(found,`Unbound R9 insert state: ${id}`);
 return {id:'insert-'+id,eventId:found.eventId,nodeIndex:found.nodeIndex,insertId};
});
const phoneMessage=all.find(({node})=>node.insertId==='message-backlog'&&node.sourceLine===604)?.node.text;
assert.ok(phoneMessage,'the phone graphic must retain the received producer message');
const cases=[{id:'pair',eventId:'v100:event:prologue',nodeIndex:2},ownerCase('guide-ikura'),ownerCase('red-panther-commander'),ownerCase('mugarian-president'),{id:'longest-dialogue',eventId:longest.eventId,nodeIndex:longest.nodeIndex},...cutCases,...insertCases,...insertStateCases];
// Validate every checkpoint before starting a browser, including the settled
// reward-confirmation phase. A malformed seed must not become a UI timeout.
const fixtureSaves=new Map(cases.map(fixture=>[fixture.id,serializeV100Save(createV100DialogueFixture(fixture))]));
const requestedIds=process.env.V100_DIALOGUE_QA_ONLY_IDS?.split(',');
if(requestedIds)assert.equal(new Set(requestedIds).size,requestedIds.length,'explicit scene selection cannot repeat');
const selectedCases=requestedIds?cases.filter(fixture=>requestedIds.includes(fixture.id)):cases;
assert.equal(selectedCases.length,requestedIds?.length??cases.length,'each selected scene must resolve exactly once');
const report={scope:'Explicit isolated story fixtures; visual composition and native next controls, not whole-campaign acceptance',selectedCaseIds:selectedCases.map(fixture=>fixture.id),build:await productionBuildIdentity(),results:[]};
const engines=(process.env.V100_DIALOGUE_QA_ENGINES??'chromium,webkit').split(',');
for(const engine of engines){
 const browserType=await pwaBrowserType(engine);
 const browser=await browserType.launch({headless:true,...(engine==='chromium'?{args:['--mute-audio']} : {}),...(process.env.V100_DIALOGUE_QA_EXECUTABLE?{executablePath:process.env.V100_DIALOGUE_QA_EXECUTABLE}:{})});
 try{for(const viewport of [{width:844,height:340},{width:844,height:390},{width:1280,height:720}])for(const fixture of selectedCases){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:true});
  const page=await context.newPage();page.setDefaultTimeout(20000);
  const result={engine,viewport,fixture,errors:[],status:'running'};report.results.push(result);
  page.on('pageerror',error=>result.errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')result.errors.push(message.text());});
  page.on('requestfailed',request=>result.errors.push(request.failure()?.errorText+' '+request.url()));
  page.on('response',response=>{if(response.status()>=400)result.errors.push(response.status()+' '+response.url());});
  try{
   const storyPage=v100StoryPageFor(fixture.eventId,V100_STORY_EVENTS[fixture.eventId].nodes,fixture.nodeIndex);
   await page.addInitScript(value=>{for(const key of ['nishijin-campaign-v100','nishijin-campaign-v100:mirror','nishijin-campaign-v100:last-known-good'])localStorage.setItem(key,value);},fixtureSaves.get(fixture.id));
   await page.goto(new URL('v100',origin).href);
   const play=page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true}),scene=page.locator('[data-v100-event-id="'+fixture.eventId+'"]');
   await play.or(page.locator('.v100-start-screen')).or(scene).first().waitFor({state:'visible'});if(await play.isVisible())await play.click();
   await enterV100FromTitle(page);
   await scene.waitFor({state:'visible'});
   if(fixture.backdrop)await page.waitForFunction(isV100StoryBackdropReady,{selector:'[data-v100-event-id="'+fixture.eventId+'"]',background:fixture.backdrop});
   await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
   const portraitPaint = await page.waitForFunction(readV177StoryPortraitPaint, '[data-v100-event-id="'+fixture.eventId+'"]');
   try { result.portraitPaint = await portraitPaint.jsonValue(); }
   finally { await portraitPaint.dispose(); }
   if(fixture.insertId==='takuya-identity')await scene.locator('[data-v100-insert="takuya-identity"] image').evaluateAll(async images=>{
    await Promise.all(images.map(async element=>{const image=new Image();image.src=element.getAttribute('href');await image.decode();}));
   });
   const geometry=await scene.evaluate(element=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const box=element.querySelector('.v100-node-copy');
    const insertTitle=element.querySelector('.v100-insert-heading');
    const caption=element.querySelector('.v100-story-insert figcaption');
    const insertCaption=caption?{...rect(caption),text:caption.textContent,visibility:getComputedStyle(caption).visibility,opacity:Number(getComputedStyle(caption).opacity)}:null;
    const insertLabels=[...element.querySelectorAll('.v100-story-insert svg text')].map(rect);
    const phoneMessage=element.querySelector('.v100-insert-phone-message');
    const phone=phoneMessage?{text:phoneMessage.textContent,lines:[...phoneMessage.querySelectorAll('tspan')].map(rect),panel:rect(element.querySelector('[data-v100-insert="message-backlog"] .v100-insert-arrival'))}:null;
      return {scene:rect(element),copy:rect(box),text:rect(box.querySelector('p')),textValue:[...box.querySelectorAll('p')].map(p=>p.innerText).join(''),backdrop:getComputedStyle(element.querySelector('.v100-event-backdrop')).backgroundImage,imageSource:element.querySelector('.v100-event-image:not(.v100-event-image-previous)')?.currentSrc,actions:rect(box.querySelector('.v100-event-actions')),heading:element.querySelector('.v100-event-heading .v100-kicker').innerText,headingBox:rect(element.querySelector('.v100-event-heading')),insertTitle:insertTitle?rect(insertTitle):null,insertCaption,insertLabels,phone,portraits:[...element.querySelectorAll('.v100-portrait-frame')].map(e=>({owner:e.dataset.portraitOwner,side:e.dataset.portraitSide,rect:rect(e),image:rect(e.querySelector('img'))}))};
   });
   geometry.identityFrames=await scene.evaluate(readV100IdentityFrames);
   geometry.detailShots=await scene.evaluate(readDetailShots);
   result.geometry=geometry;
   const detail=v177StoryDetailShotFor(fixture.backdrop);
   const checkDetail=shots=>{
    assert.equal(shots.length,detail?1:0,'only the authored action close-up may appear');
    for(const shot of shots){
     assert.equal(shot.id,detail.id);assert.deepEqual(shot.viewBox,detail.rect);assert.deepEqual(shot.clipRect,detail.rect);
     assert.ok(shot.clipId&&shot.imageClip===`url(#${shot.clipId})`,'the source image must use the explicit authored crop');
     assert.ok(shot.href.endsWith(fixture.backdrop));assert.equal(shot.pointerEvents,'none','the close-up cannot intercept native controls');
     assert.equal(shot.filter,'none','the action close-up must remain unfiltered');
     assert.deepEqual(shot.ancestorFilters,[],'the action close-up must remain outside filtered background ancestors');
     assert.equal(shot.insideBackdrop,false,'the action close-up must be separate from the background grading');
     assert.ok(Number.isFinite(shot.layerIndex)&&Number.isFinite(shot.veilIndex)&&shot.layerIndex>shot.veilIndex,'the action close-up must remain above the scene veil');
     const r=shot.frame;assert.ok(Object.values(r).every(Number.isFinite)&&r.width>0&&r.height>0);
     assert.ok(r.x>=geometry.scene.x+1&&r.right<=geometry.scene.right-1,'the complete close-up must fit inside the scene');
     assert.ok(r.y>=geometry.headingBox.bottom+1&&r.bottom<=geometry.copy.y-4,'the action close-up must clear the heading and dialogue panel');
    }
   };
   checkDetail(geometry.detailShots);
   if(detail?.landmarks){
    geometry.paintedImage=await scene.evaluate(readV177PaintedSceneImage);
    geometry.paintedSource=await scene.evaluate(readV177PaintedSceneSource);
    assert.equal(geometry.paintedSource.sha256,detail.landmarkSourceHash,'critical face coordinates must refer to the actual served revised painting');
    geometry.paintedFaces=inspectV177PaintedSceneFaces(detail,geometry);
    assert.deepEqual(geometry.paintedFaces.issues,[],'critical painted faces must clear the frame, heading, dialogue and action close-up');
    if(viewport.height<=430){
     const image=scene.locator('.v100-event-image:not(.v100-event-image-previous)'),originalStyle=await image.getAttribute('style');
     const panorama=Boolean(detail.landmarkSourcePath);
     try{
      await image.evaluate((element,panorama)=>{
       if(panorama)element.style.setProperty('object-fit','cover','important');
       element.style.setProperty('object-position',panorama?'50% 100%':'50% 50%','important');
      },panorama);
      const centered=await scene.evaluate(readV177PaintedSceneImage);
      const rejected=inspectV177PaintedSceneFaces(detail,{...geometry,paintedImage:centered});
      assert.ok(rejected.issues.length>0,'the actual wrong compact image fit/crop must be rejected');
      geometry.paintedFaceCropControl={operation:panorama?'actual-css-cover-bottom':'actual-css-object-position-center',rejected:true,issues:rejected.issues};
     }finally{
      await image.evaluate((element,value)=>value===null?element.removeAttribute('style'):element.setAttribute('style',value),originalStyle);
      assert.equal(await image.getAttribute('style'),originalStyle);
      assert.deepEqual(inspectV177PaintedSceneFaces(detail,{...geometry,paintedImage:await scene.evaluate(readV177PaintedSceneImage)}).issues,[]);
     }
     const figure=scene.locator('.v177-story-detail-shot:not(.v177-story-detail-previous)'),originalInsetStyle=await figure.getAttribute('style');
     try{
      const face=geometry.paintedFaces.faces[0];
      await figure.evaluate((element,target)=>{
       const r=element.getBoundingClientRect(),css=getComputedStyle(element),sx=r.width/parseFloat(css.width),sy=r.height/parseFloat(css.height);
       element.style.setProperty('transform',`translate(${(target.x-r.x)/sx}px,${(target.y-r.y)/sy}px)`,'important');
      },face.rect);
      const shifted=await scene.evaluate(readDetailShots);
      const rejected=inspectV177PaintedSceneFaces(detail,{...geometry,detailShots:shifted});
      assert.ok(rejected.issues.some(issue=>issue.includes('covered by detail:')),'moving the actual close-up over a painted face must be rejected');
      geometry.paintedFaceInsetControl={operation:'actual-css-translate-inset-over-painted-face',target:face.id,rejected:true,issues:rejected.issues};
     }finally{
      await figure.evaluate((element,value)=>value===null?element.removeAttribute('style'):element.setAttribute('style',value),originalInsetStyle);
      assert.equal(await figure.getAttribute('style'),originalInsetStyle);
      const restored=await scene.evaluate(readDetailShots);checkDetail(restored);assert.deepEqual(restored,geometry.detailShots);
      assert.deepEqual(inspectV177PaintedSceneFaces(detail,{...geometry,detailShots:restored}).issues,[]);
     }
    }
   }
   if(detail){
    const figure=scene.locator('.v177-story-detail-shot:not(.v177-story-detail-previous)'),style=await figure.getAttribute('style');
    try{
     await figure.evaluate(element=>element.style.setProperty('filter','brightness(.25)','important'));
     const dimmed=await scene.evaluate(readDetailShots);
     assert.throws(()=>checkDetail(dimmed),/must remain unfiltered/u,'actual CSS dimming must be rejected');
     geometry.detailDimmingControl={operation:'actual-css-brightness-quarter',rejected:true};
    }finally{
     await figure.evaluate((element,value)=>value===null?element.removeAttribute('style'):element.setAttribute('style',value),style);
     assert.equal(await figure.getAttribute('style'),style);const restored=await scene.evaluate(readDetailShots);checkDetail(restored);assert.deepEqual(restored,geometry.detailShots);
    }
    try{
     await figure.evaluate(element=>element.style.setProperty('bottom','0px','important'));
     const shifted=await scene.evaluate(readDetailShots);
     assert.throws(()=>checkDetail(shifted),/clear the heading and dialogue/u,'an actual CSS move into dialogue must be rejected');
     geometry.detailOverlapControl={operation:'actual-css-bottom-zero',rejected:true};
    }finally{
     await figure.evaluate((element,value)=>value===null?element.removeAttribute('style'):element.setAttribute('style',value),style);
     assert.equal(await figure.getAttribute('style'),style);const restored=await scene.evaluate(readDetailShots);checkDetail(restored);assert.deepEqual(restored,geometry.detailShots);
    }
   }
   const expectedText=[...storyPage.leadingActions,storyPage.node].map(node=>publicDisplayText(node.text.replaceAll('{{PLAYER_NAME}}','構図確認'))).join('');
   assert.ok(geometry.textValue.replace(/\s/gu,'').includes(expectedText.replace(/\s/gu,'')),`${fixture.id} authored text missing`);
   if(fixture.backdrop)assert.ok(geometry.imageSource?.endsWith(fixture.backdrop),`${fixture.id} actual image ${geometry.imageSource}`);
   if(fixture.insertId)assert.equal(await scene.locator('[data-v100-insert="'+fixture.insertId+'"]').count(),1,'the explanatory diagram must be visible');
   if(geometry.insertTitle)assert.ok(geometry.insertTitle.y>=geometry.headingBox.bottom+1,'diagram title must sit below the location heading and its rule');
   if(geometry.insertTitle){
    const caption=geometry.insertCaption;
    assert.ok(caption&&caption.text.trim()&&caption.visibility==='visible'&&caption.opacity===1,'the explanatory caption must stay visible');
    assert.ok([caption.x,caption.y,caption.right,caption.bottom].every(Number.isFinite)&&caption.x>=0&&caption.y>=0&&caption.right<=viewport.width&&caption.bottom<=viewport.height,'the complete diagram caption must fit in the viewport');
    assert.ok(caption.bottom<=geometry.copy.y-4,'the diagram caption must clear the dialogue panel by at least 4px');
    assert.ok(geometry.insertLabels.every(label=>caption.y>=label.bottom+1),'the diagram caption must not cover labels inside the diagram');
   }
   if(fixture.id==='insert-message-backlog-received'||fixture.id==='insert-message-backlog-dated'){
    assert.ok(geometry.phone,'the received message must be visible');
    assert.equal(geometry.phone.text,phoneMessage,'the diagram must preserve the producer message, including the request');
    assert.equal(geometry.phone.lines.length,4);
    for(const line of geometry.phone.lines)assert.ok(line.x>=geometry.phone.panel.x+1&&line.right<=geometry.phone.panel.right-1&&line.y>=geometry.phone.panel.y+1&&line.bottom<=geometry.phone.panel.bottom-1,'each complete message line must fit inside the phone panel');
   }
   if(fixture.insertId==='takuya-identity'){
    assertV100IdentityFrames(geometry.identityFrames);
    const figures=scene.locator('[data-v100-insert="takuya-identity"] svg svg > g[clip-path]');
    const styles=await figures.evaluateAll(frames=>frames.map(frame=>frame.getAttribute('style')));
    const control=geometry.identitySizingControl={operation:'painted-content-css-transform-scale',scale:1.1,before:geometry.identityFrames};
    try{
     await figures.evaluateAll(async frames=>{
      for(const frame of frames)frame.setAttribute('style',(frame.getAttribute('style')??'')+';transform-origin:0 0!important;transform:scale(1.1)!important;');
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
     });
     control.scaled=await scene.evaluate(readV100IdentityFrames);
     control.changedFrames=assertV100IdentitySizingControl(control.before,control.scaled);
     control.cssScaleRejected=true;
    }catch(error){
     control.primaryError=String(error);throw error;
    }finally{
     try{
      await figures.evaluateAll(async(frames,styles)=>{
       frames.forEach((frame,i)=>styles[i]===null?frame.removeAttribute('style'):frame.setAttribute('style',styles[i]));
       await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      },styles);
      assert.deepEqual(await figures.evaluateAll(frames=>frames.map(frame=>frame.getAttribute('style'))),styles,'the sizing control must restore the exact original inline styles');
      control.restored=await scene.evaluate(readV100IdentityFrames);assertV100IdentityFrames(control.restored);
      control.restoredGeometryValid=true;
     }catch(error){
      control.restorationError=String(error);if(!control.primaryError)throw error;
     }
    }
   }
   assert.ok(!/会話|\s\/\s\d/.test(geometry.heading));
   for(const rect of [geometry.copy,geometry.text,geometry.actions]){assert.ok(rect.x>=0&&rect.y>=0&&rect.right<=viewport.width&&rect.bottom<=viewport.height);}
   assert.ok(geometry.actions.x>=geometry.text.right,'Actions must not overlap the dialogue');
   assert.ok(geometry.actions.bottom<=geometry.copy.bottom&&geometry.actions.y>=geometry.copy.y);
   await page.screenshot({path:out+'/'+engine+'-'+viewport.width+'x'+viewport.height+'-'+fixture.id+'.png'});
   // Read the fixture material before any explicit next-page input.
   if(await scene.locator('.v100-insert-expand').count()){
    const opener=scene.getByRole('button',{name:'資料を拡大',exact:true});
    const copyBefore=await scene.locator('.v100-node-copy').innerText();
    const saveBefore=await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100'));
    await opener.click();const reader=page.getByRole('dialog');await reader.waitFor({state:'visible'});
    const material=await reader.evaluate(el=>{const b=el.getBoundingClientRect(),heading=el.querySelector('.v100-insert-heading').getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,headingHeight:heading.height};});
    assert.ok(material.x>=0&&material.y>=0&&material.x+material.width<=viewport.width+1&&material.y+material.height<=viewport.height+1,'material reader fits viewport');
    assert.ok(material.headingHeight>=12,'expanded diagram heading is readable');
    await page.screenshot({path:out+'/'+engine+'-'+viewport.width+'x'+viewport.height+'-'+fixture.id+'-expanded.png'});
    if(fixture.id==='insert-message-backlog')await page.keyboard.press('Escape');
    else await reader.getByRole('button',{name:'閉じる',exact:true}).click();
    await reader.waitFor({state:'hidden'});
    assert.equal(await scene.locator('.v100-node-copy').innerText(),copyBefore,'material reading does not advance story');
    assert.equal(await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100')),saveBefore,'material reading preserves save');
    result.insertReader=material;
   }
   const beforeSides=Object.fromEntries(geometry.portraits.map(p=>[p.owner,p.side]));
   await page.getByRole('button',{name:'次へ',exact:true}).click();
   if(fixture.id==='pair'){
    const afterSides=await page.locator('.v100-portrait-frame').evaluateAll(xs=>Object.fromEntries(xs.map(x=>[x.dataset.portraitOwner,x.dataset.portraitSide])));
    for(const owner of Object.keys(beforeSides))if(afterSides[owner])assert.equal(afterSides[owner],beforeSides[owner]);
   }
   assert.deepEqual(result.errors,[]);result.status='passed';
  }catch(error){result.status='failed';result.error=String(error);await page.screenshot({path:out+'/'+engine+'-'+viewport.width+'x'+viewport.height+'-'+fixture.id+'-failure.png'}).catch(()=>{});}
  finally{await context.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({engine,viewport,fixture:fixture.id,status:result.status,error:result.error}));}
 }}finally{await browser.close();}
}
report.status=report.results.every(r=>r.status==='passed')?'passed':'failed';
await writeFile(out+'/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,cases:report.results.length,failures:report.results.filter(r=>r.status!=='passed').map(({engine,fixture,error})=>({engine,fixture,error}))}));
if(report.status!=='passed')process.exitCode=1;
