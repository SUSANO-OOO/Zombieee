import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,rename,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pwaBrowserType} from './pwa-browser-runtime.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {createV100DialogueFixture} from './v100-dialogue-fixture.mjs';
import {serializeV100Save} from '../app/v100Save.js';
import {V100_STORY_SOURCE_SHA256,V100_STORY_SCRIPT_VERSION} from '../app/v100StoryEvents.js';
import {r9StoryPlan,readR9PageGeometry,assertR9PageGeometry} from './v100-r9-story-plan.mjs';
import {enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {installRequestFailureAudit} from './browser-request-failure-audit.mjs';
import {readV177StoryPortraitPaint} from './v177-story-portrait-paint.mjs';
import {isV100StoryBackdropReady} from './v100-story-backdrop-ready.mjs';

const origin=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL??'http://127.0.0.1:4177/');
assert.ok(['localhost','127.0.0.1'].includes(origin.hostname),'Story QA is local-only');
const out=path.resolve(process.env.V100_R9_OUT??'outputs/r9-full-story');
await mkdir(path.dirname(out),{recursive:true});await mkdir(out,{recursive:false});
const playerName='全編確認',plan=r9StoryPlan(playerName),engines=(process.env.V100_R9_ENGINES??'chromium,webkit').split(',');
const allowedSizes=['1280x720','844x390','844x340'];
const sizes=(process.env.V100_R9_VIEWPORT??allowedSizes.join(',')).split(',');
for(const size of sizes)assert.ok(allowedSizes.includes(size));
const selected=process.env.V100_R9_EVENT_IDS?.split(',')??plan.events.map(e=>e.eventId);
assert.ok(selected.length&&selected.every(id=>plan.events.some(e=>e.eventId===id)));
assert.equal(new Set(selected).size,selected.length,'One event can appear only once');
const report={scope:'All selected R9 text pages through real Next controls in isolated canonical save fixtures; not normal-play or listening acceptance',
 head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),platform:process.platform,
 storySourceSha256:V100_STORY_SOURCE_SHA256,scriptVersion:V100_STORY_SCRIPT_VERSION,build:await productionBuildIdentity(),
 fullStorySelection:selected.length===plan.events.length,finalizers:plan.finalizers,creditsCoveredBy:'v100-story-bookends-browser-smoke.mjs',
 physicalAudioAccepted:false,normalCampaignAccepted:false,wholeGameAccepted:false,status:'running',cases:[],sources:[]};
for(const file of ['scripts/v100-r9-full-story-browser.mjs','scripts/v100-r9-story-plan.mjs','scripts/v177-story-portrait-paint.mjs','app/v100StoryEvents.js','app/v100EventAudio.js']){
 const bytes=await readFile(file);report.sources.push({file,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const persist=()=>writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
await persist();
try{
for(const engine of engines){
 assert.ok(['chromium','webkit'].includes(engine));
 const browser=await (await pwaBrowserType(engine)).launch({headless:true,...(engine==='chromium'?{args:['--mute-audio']}:{})});
 try{for(const size of sizes){
  const [width,height]=size.split('x').map(Number),viewport={width,height};
  for(const event of plan.events.filter(e=>selected.includes(e.eventId))){
   const id=`${engine}-${size}-${event.eventId.replaceAll(':','-')}`;
   const row={eventId:event.eventId,engine,viewport,status:'running',pages:[],errors:[],cleanup:'pending'};report.cases.push(row);
   const context=await browser.newContext({viewport,isMobile:width<1000,hasTouch:width<1000,
    recordVideo:{dir:path.join(out,'video'),size:viewport}});
   const page=await context.newPage(),video=page.video(),requests=installRequestFailureAudit(page);page.setDefaultTimeout(15000);
   page.on('pageerror',e=>row.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')row.errors.push(m.text());});
   page.on('response',r=>{if(r.status()>=400)row.errors.push(r.status()+' '+r.url());});
   try{
    const value=serializeV100Save(createV100DialogueFixture({eventId:event.eventId,nodeIndex:0,playerName}));
    await page.addInitScript(({origin,value})=>{if(location.origin===origin)for(const key of ['nishijin-campaign-v100','nishijin-campaign-v100:mirror','nishijin-campaign-v100:last-known-good'])localStorage.setItem(key,value);},{origin:origin.origin,value});
    const url=new URL('v100?event-audio-qa=1',origin);await page.goto(url.href,{waitUntil:'domcontentloaded'});
    const play=page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true});
    await play.or(page.locator('.v100-start-screen')).first().waitFor();if(await play.isVisible())await play.click();
    await enterV100FromTitle(page);
    for(const expected of event.pages){
     const selector=`[data-v100-event-id="${event.eventId}"][data-v100-node-index="${expected.nodeIndex}"]`,surface=page.locator(selector);
     await surface.waitFor({state:'visible'});
     if(expected.presentation.backgroundPath)await page.waitForFunction(isV100StoryBackdropReady,{selector,background:expected.presentation.backgroundPath});
     await page.waitForFunction(({eventId,nodeIndex,sceneId,cueId,requiresAudio,sceneAudio})=>{
      const a=window.__V100_EVENT_AUDIO_QA__?.getSnapshot?.();
      return a?.desired?.sceneId===sceneId&&a?.sceneState?.sceneId===sceneId&&a?.diagnostics?.contextState==='running'
       &&(!requiresAudio||a.active?.sceneId===sceneId)
       &&a.sceneState.bgmAssetId===sceneAudio.bgmAssetId
       &&JSON.stringify([...a.sceneState.ambienceAssetIds].sort())===JSON.stringify([...sceneAudio.ambienceAssetIds].sort())
       &&(!cueId||a.receipts.some(r=>r.action==='cue-started'&&r.eventId===eventId&&r.nodeIndex===nodeIndex&&r.cueId===cueId));
     },{eventId:event.eventId,nodeIndex:expected.nodeIndex,sceneId:expected.presentation.sceneId,cueId:expected.presentation.cueId,requiresAudio:expected.requiresAudio,sceneAudio:expected.sceneAudio});
     const painted=await page.waitForFunction(readV177StoryPortraitPaint,selector);
     let portraitPaint;try{portraitPaint=await painted.jsonValue();}finally{await painted.dispose();}
     const state=await surface.evaluate(readR9PageGeometry);assertR9PageGeometry(state,expected);
     row.pages.push({nodeIndex:expected.nodeIndex,sourceIndices:expected.sourceIndices,sourceLines:expected.sourceLines,
      text:state.text,scene:state.audio.sceneState,receipts:state.audio.receipts.filter(r=>r.nodeIndex===expected.nodeIndex),bounds:state.bounds,portraitPaint});
     if(expected.startIndex===0||expected.nodeIndex===event.pages.at(-1).nodeIndex||expected.presentation.cutId||expected.presentation.insertId)
      await page.screenshot({path:path.join(out,`${id}-${expected.nodeIndex}.png`)});
     await surface.locator('.v100-event-actions .v100-primary').click();
    }
    await page.waitForFunction(id=>!document.querySelector(`[data-v100-event-id="${id}"]`),event.eventId);
    assert.deepEqual(row.pages.flatMap(p=>p.sourceIndices),Array.from({length:event.nodeCount},(_,i)=>i));
    assert.deepEqual(row.errors,[]);assert.deepEqual(requests.report.unexpectedFailures,[]);row.status='passed';
   }catch(error){row.status='failed';row.error=String(error);await page.screenshot({path:path.join(out,id+'-failure.png')}).catch(()=>{});}
   finally{
    try{await requests.closeContext(context);row.cleanup='completed';const file=path.join(out,'video',id+'.webm');await rename(await video.path(),file);row.video={path:file,bytes:(await stat(file)).size};assert.ok(row.video.bytes>0);}
    catch(error){row.cleanup='failed';row.status='failed';row.cleanupError=String(error);}
    row.requestFailures=requests.report;
    if(row.errors.length||requests.report.unexpectedFailures.length)row.status='failed';
    await persist();console.log(JSON.stringify({engine,size,event:event.eventId,status:row.status,pages:row.pages.length,error:row.error}));
   }
  }
 }}finally{await browser.close();}
}
}catch(error){report.error=String(error);}
report.status=!report.error&&report.cases.length===selected.length*engines.length*sizes.length&&report.cases.every(r=>r.status==='passed')?'passed':'failed';
report.coveredNodes=report.cases.reduce((n,c)=>n+c.pages.reduce((n,p)=>n+p.sourceIndices.length,0),0);
await persist();console.log(JSON.stringify({status:report.status,cases:report.cases.length,coveredNodes:report.coveredNodes,fullStorySelection:report.fullStorySelection}));
if(report.status!=='passed')process.exitCode=1;
