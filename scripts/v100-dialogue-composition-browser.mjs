import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {pwaBrowserType} from './pwa-browser-runtime.mjs';
import {V100_STORY_EVENTS} from '../app/v100StoryEvents.js';
import {V100_R9_SCENE_ASSETS} from '../app/v100R9SceneAssets.js';
import {v100StoryPageFor} from '../app/v100StoryPages.js';
import {enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {publicDisplayText} from '../app/publicDisplayNames.js';
import {serializeV100Save} from '../app/v100Save.js';
import {createV100DialogueFixture} from './v100-dialogue-fixture.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
if(process.platform==='win32')throw new Error('R9 visual QA is hosted-only; local game/browser/audio playback is disabled');
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
const cutCases=Object.entries(V100_R9_SCENE_ASSETS).map(([cutId,asset])=>{
 const found=all.find(({node})=>node.cutId===cutId);
 assert.ok(found,`Unbound R9 cut: ${cutId}`);
 return {id:cutId,eventId:found.eventId,nodeIndex:found.nodeIndex,backdrop:asset.path};
});
const insertIds=[...new Set(all.map(({node})=>node.insertId).filter(Boolean))];
const insertCases=insertIds.map(insertId=>{
 const found=all.find(({node})=>node.insertId===insertId);
 return {id:'insert-'+insertId,eventId:found.eventId,nodeIndex:found.nodeIndex,insertId};
});
assert.equal(cutCases.length,17);
assert.equal(insertCases.length,18);
const cases=[{id:'pair',eventId:'v100:event:prologue',nodeIndex:2},ownerCase('guide-ikura'),ownerCase('red-panther-commander'),ownerCase('mugarian-president'),{id:'longest-dialogue',eventId:longest.eventId,nodeIndex:longest.nodeIndex},...cutCases,...insertCases];
// Validate every checkpoint before starting a browser, including the settled
// reward-confirmation phase. A malformed seed must not become a UI timeout.
const fixtureSaves=new Map(cases.map(fixture=>[fixture.id,serializeV100Save(createV100DialogueFixture(fixture))]));
const report={scope:'Explicit isolated story fixtures; visual composition and native next controls, not whole-campaign acceptance',build:await productionBuildIdentity(),results:[]};
const engines=(process.env.V100_DIALOGUE_QA_ENGINES??'chromium,webkit').split(',');
for(const engine of engines){
 const browserType=await pwaBrowserType(engine);
 const browser=await browserType.launch({headless:true,...(process.env.V100_DIALOGUE_QA_EXECUTABLE?{executablePath:process.env.V100_DIALOGUE_QA_EXECUTABLE}:{})});
 try{for(const viewport of [{width:844,height:340},{width:844,height:390},{width:1280,height:720}])for(const fixture of cases){
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
   if(fixture.backdrop)await page.waitForFunction(({selector,path})=>getComputedStyle(document.querySelector(selector+' .v100-event-backdrop')).backgroundImage.includes(path),{selector:'[data-v100-event-id="'+fixture.eventId+'"]',path:fixture.backdrop});
   await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
   const geometry=await scene.evaluate(element=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const box=element.querySelector('.v100-node-copy');
      return {scene:rect(element),copy:rect(box),text:rect(box.querySelector('p')),textValue:[...box.querySelectorAll('p')].map(p=>p.innerText).join(''),backdrop:getComputedStyle(element.querySelector('.v100-event-backdrop')).backgroundImage,actions:rect(box.querySelector('.v100-event-actions')),heading:element.querySelector('.v100-event-heading').innerText,portraits:[...element.querySelectorAll('.v100-portrait-frame')].map(e=>({owner:e.dataset.portraitOwner,side:e.dataset.portraitSide,rect:rect(e),image:rect(e.querySelector('img'))}))};
   });
   result.geometry=geometry;
   const expectedText=[...storyPage.leadingActions,storyPage.node].map(node=>publicDisplayText(node.text.replaceAll('{{PLAYER_NAME}}','構図確認'))).join('');
   assert.ok(geometry.textValue.replace(/\s/gu,'').includes(expectedText.replace(/\s/gu,'')),`${fixture.id} authored text missing`);
   if(fixture.backdrop)assert.ok(geometry.backdrop.includes(fixture.backdrop),`${fixture.id} backdrop ${geometry.backdrop}`);
   if(fixture.insertId)assert.equal(await scene.locator('[data-v100-insert="'+fixture.insertId+'"]').count(),1,'the explanatory diagram must be visible');
   assert.ok(!/会話|\s\/\s\d/.test(geometry.heading));
   for(const rect of [geometry.copy,geometry.text,geometry.actions]){assert.ok(rect.x>=0&&rect.y>=0&&rect.right<=viewport.width&&rect.bottom<=viewport.height);}
   assert.ok(geometry.actions.x>=geometry.text.right,'Actions must not overlap the dialogue');
   assert.ok(geometry.actions.bottom<=geometry.copy.bottom&&geometry.actions.y>=geometry.copy.y);
   await page.screenshot({path:out+'/'+engine+'-'+viewport.width+'x'+viewport.height+'-'+fixture.id+'.png'});
   const beforeSides=Object.fromEntries(geometry.portraits.map(p=>[p.owner,p.side]));
   await page.getByRole('button',{name:'次へ',exact:true}).click();
   if(fixture.id==='pair'){
    const afterSides=await page.locator('.v100-portrait-frame').evaluateAll(xs=>Object.fromEntries(xs.map(x=>[x.dataset.portraitOwner,x.dataset.portraitSide])));
    for(const owner of Object.keys(beforeSides))if(afterSides[owner])assert.equal(afterSides[owner],beforeSides[owner]);
   }
   assert.deepEqual(result.errors,[]);result.status='passed';
  }catch(error){result.status='failed';result.error=String(error);await page.screenshot({path:out+'/'+engine+'-'+fixture.id+'-failure.png'}).catch(()=>{});}
  finally{await context.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({engine,viewport,fixture:fixture.id,status:result.status,error:result.error}));}
 }}finally{await browser.close();}
}
report.status=report.results.every(r=>r.status==='passed')?'passed':'failed';
await writeFile(out+'/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,cases:report.results.length,failures:report.results.filter(r=>r.status!=='passed').map(({engine,fixture,error})=>({engine,fixture,error}))}));
if(report.status!=='passed')process.exitCode=1;
