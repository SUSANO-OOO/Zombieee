import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {V100_STORY_EVENTS} from '../app/v100StoryEvents.js';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const origin=process.env.V100_CAMPAIGN_QA_BASE_URL;
const out=process.env.V100_DIALOGUE_QA_OUT??'outputs/v100-dialogue-improvement-r1';
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
const cases=[{id:'pair',eventId:'v100:event:prologue',nodeIndex:5},ownerCase('guide-ikura'),ownerCase('red-panther-commander'),ownerCase('mugarian-president'),{id:'longest-dialogue',eventId:longest.eventId,nodeIndex:longest.nodeIndex}];
const report={scope:'Explicit isolated story fixtures; visual composition and native next controls, not whole-campaign acceptance',build:await productionBuildIdentity(),results:[]};
for(const [engine,browserType] of Object.entries({chromium,webkit})){
 const browser=await browserType.launch({headless:true});
 try{for(const viewport of [{width:844,height:340},{width:1280,height:720}])for(const fixture of cases){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:true});
  const page=await context.newPage();page.setDefaultTimeout(20000);
  const result={engine,viewport,fixture,errors:[],status:'running'};report.results.push(result);
  page.on('pageerror',error=>result.errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')result.errors.push(message.text());});
  page.on('requestfailed',request=>result.errors.push(request.failure()?.errorText+' '+request.url()));
  page.on('response',response=>{if(response.status()>=400)result.errors.push(response.status()+' '+response.url());});
  try{
   const phase=fixture.eventId.endsWith(':post')?'post':fixture.eventId.endsWith(':ending')?'ending':'event';
   const save=normalizeV100Save({...createDefaultV100Save({playerName:'構図確認'}),campaignStarted:true,revision:7,availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,-1),flowState:{phase,eventId:fixture.eventId,stageId:V100_STAGE_IDS[2],stageNumber:3,destination:phase,nodeIndex:fixture.nodeIndex,firstClear:false,finalized:true}});
   await page.addInitScript(value=>{for(const key of ['nishijin-campaign-v100','nishijin-campaign-v100:mirror','nishijin-campaign-v100:last-known-good'])localStorage.setItem(key,value);},serializeV100Save(save));
   await page.goto(new URL('v100',origin).href);
   const play=page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true}),scene=page.locator('[data-v100-event-id="'+fixture.eventId+'"]');
   await play.or(scene).first().waitFor({state:'visible'});if(await play.isVisible())await play.click();
   await scene.waitFor({state:'visible'});
   await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));
   const geometry=await scene.evaluate(element=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const box=element.querySelector('.v100-node-copy');
    return {scene:rect(element),copy:rect(box),text:rect(box.querySelector('p')),actions:rect(box.querySelector('.v100-event-actions')),heading:element.querySelector('.v100-event-heading').innerText,portraits:[...element.querySelectorAll('.v100-portrait-frame')].map(e=>({owner:e.dataset.portraitOwner,side:e.dataset.portraitSide,rect:rect(e),image:rect(e.querySelector('img'))}))};
   });
   result.geometry=geometry;
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
  finally{await context.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
 }}finally{await browser.close();}
}
report.status=report.results.every(r=>r.status==='passed')?'passed':'failed';
await writeFile(out+'/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,cases:report.results.length,failures:report.results.filter(r=>r.status!=='passed').map(({engine,fixture,error})=>({engine,fixture,error}))}));
if(report.status!=='passed')process.exitCode=1;
