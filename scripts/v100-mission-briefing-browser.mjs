import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {V100_STAGES} from '../app/v100Registry.js';
import {v100MissionObjectiveFor} from '../app/v100BattleAdapter.js';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const source=process.env.V100_BRIEFING_SOURCE,bytes=await readFile(source),seed=JSON.parse(bytes).finalSave;
assert.equal(seed.completedStageIds.length,30);assert.equal(seed.postGameAvailable,true);
const origin=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));
const out=process.env.V100_BRIEFING_EVIDENCE_DIR??'outputs/v100-mission-briefings';await mkdir(out,{recursive:false});
const report={status:'running',scope:'Exact naturally earned postgame save copied into separate profiles. Native chapter/stage selection and scrolled briefing visibility for all30. No progression, clock or combat setters; this is briefing content/layout evidence only.',source:{path:source,sha256:createHash('sha256').update(bytes).digest('hex')},build:await productionBuildIdentity(),cases:[]};
const persist=()=>writeFile(out+'/report.json',JSON.stringify(report,null,2));
for(const [engine,type]of Object.entries({chromium,webkit})){
 const browser=await type.launch(),page=await browser.newPage({viewport:{width:844,height:340},hasTouch:true,isMobile:true});
 const record={engine,status:'running',errors:[],stages:[]};report.cases.push(record);
 page.on('pageerror',e=>record.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')record.errors.push(m.text());});page.on('requestfailed',r=>record.errors.push(r.url()+': '+r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400)record.errors.push(r.status()+': '+r.url());});
 try{
  await page.addInitScript(({origin,seed})=>{if(location.origin===origin&&!localStorage.getItem('nishijin-campaign-v100'))localStorage.setItem('nishijin-campaign-v100',JSON.stringify(seed));},{origin:origin.origin,seed});
  await page.goto(origin.href);await page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true}).click();await page.locator('.v100-map-hero-copy').waitFor();
  for(const stage of V100_STAGES){
   const chapter=stage.number<=6?0:stage.number<=12?1:stage.number<=20?2:stage.number<=25?3:stage.number<=29?4:5;
   await page.locator('.v100-chapter-tabs button').nth(chapter).click();
   const name=stage.number<27?stage.displayName.replaceAll('RED PANTHER','赤レンズ部隊'):stage.displayName;
   await page.getByRole('button',{name:name+' 制圧済み',exact:true}).click();
   const objective=page.locator('.v100-stage-intel p'),expected=v100MissionObjectiveFor(stage.id);
   assert.equal(await objective.innerText(),expected);assert.ok((await page.locator('.v100-map-hero-copy > p').innerText()).includes(expected));
   await objective.scrollIntoViewIfNeeded();
   const observed=await objective.evaluate(el=>{const r=el.getBoundingClientRect();return {text:el.textContent,width:r.width,height:r.height,top:r.top,bottom:r.bottom,viewport:innerHeight,overflow:el.scrollWidth-el.clientWidth};});
   assert.ok(observed.width>0&&observed.height>0);assert.ok(observed.top>=-1&&observed.bottom<=observed.viewport+1,'Briefing must be reachable by normal scrolling');assert.ok(observed.overflow<=2,'Briefing text must wrap within its column');
   const category=await page.locator('.v100-stage-intel > strong').innerText();
   if(stage.number===26)assert.equal(category,'車列停止・確保');if(stage.number===28)assert.equal(category,'散布装置停止');
   record.stages.push({number:stage.number,category,...observed});
   if([3,7,14,16,21,24,26,28,29,30].includes(stage.number))await page.screenshot({path:out+'/'+engine+'-s'+stage.number+'.png'});
   assert.deepEqual(record.errors,[]);await persist();
  }
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')));
  for(const key of ['completedStageIds','caps','receipts','unitLevels','formationSlots','vehicle'])assert.deepEqual(saved[key],seed[key]);
  record.status='passed';
 }catch(e){record.status='failed';record.error=String(e.stack??e);report.status='failed';process.exitCode=1;await page.screenshot({path:out+'/'+engine+'-failure.png'}).catch(()=>{});}
 finally{await persist();await browser.close();}
 if(record.status==='failed')break;
}
if(report.cases.length===2&&report.cases.every(c=>c.status==='passed'))report.status='passed';await persist();console.log(JSON.stringify({status:report.status,cases:report.cases.map(c=>({engine:c.engine,status:c.status,stages:c.stages.length,error:c.error?.slice(0,450)}))}));
