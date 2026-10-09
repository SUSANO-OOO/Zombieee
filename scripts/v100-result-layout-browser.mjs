import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {serializeV100Save} from '../app/v100Save.js';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const origin=process.env.V100_CAMPAIGN_QA_BASE_URL,out=process.env.V100_RESULT_LAYOUT_OUT??'outputs/v100-result-layout-r1';
const baseline=JSON.parse(await readFile('outputs/v100-feedback-normal-campaign-r2/report.json'));
assert.equal(baseline.status,'completed-feedback-diagnostic');
await mkdir(out,{recursive:false});
const report={scope:'Result-screen layout and native next/retry actions in isolated fixture storage. No new battle outcome evidence. Includes S22 long objective and a defeat layout.',build:await productionBuildIdentity(),results:[]};
for(const [engine,type]of Object.entries({chromium,webkit})){
 const browser=await type.launch({headless:true});
 try{for(const viewport of [{width:1280,height:720},{width:844,height:390},{width:844,height:340}])for(const won of [true,false]){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true}),page=await context.newPage();
  const record={engine,viewport,won,errors:[],status:'running'};report.results.push(record);
  page.on('pageerror',e=>record.errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)record.errors.push(r.status()+' '+r.url());});
  try{
   const source=baseline.stages.find(s=>s.number===(won?22:24)),save=structuredClone(source.openingSave);
   save.pendingResult={...source.result,won,objectiveComplete:won,stars:won?source.result.stars:0};save.flowState={...save.flowState,phase:'result',destination:'result',finalized:false};
   await page.addInitScript(value=>{for(const key of ['nishijin-campaign-v100','nishijin-campaign-v100:mirror','nishijin-campaign-v100:last-known-good'])localStorage.setItem(key,value);},serializeV100Save(save));
   await page.goto(new URL('v100',origin).href);
   const play=page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true}),panel=page.getByLabel('作戦結果',{exact:true});
   await play.or(panel).first().waitFor();if(await play.isVisible())await play.click();await panel.waitFor();
   const controls=panel.locator('.v100-result-actions button');
   record.controls=await controls.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{text:e.textContent,rect:{x:r.x,y:r.y,width:r.width,height:r.height},unoccluded:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};}));
   for(const c of record.controls){assert.ok(c.rect.y>=0&&c.rect.y+c.rect.height<=viewport.height+1&&c.rect.x>=0&&c.rect.x+c.rect.width<=viewport.width+1,JSON.stringify(c));assert.ok(c.rect.height>=44);assert.equal(c.unoccluded,true);}
   record.records=await panel.locator('.v100-result-records').boundingBox();assert.ok(record.records.y+record.records.height<=viewport.height);
   assert.equal(await panel.locator('.v100-result-records > div').count(),4);if(won)await panel.getByText('収容室43室の開放完了',{exact:true}).waitFor();
   await page.screenshot({path:out+'/'+engine+'-'+viewport.width+'x'+viewport.height+'-'+(won?'win':'lose')+'.png'});
   await panel.getByRole('button',{name:won?'次の場面へ':'編成へ戻る',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.v100-shell')?.dataset.v100Phase!=='result');
   record.nextPhase=await page.locator('.v100-shell').getAttribute('data-v100-phase');assert.equal(record.nextPhase,won?'post':'formation');
   assert.deepEqual(record.errors,[]);record.status='observed';
  }catch(error){record.status='failed';record.error=String(error);await page.screenshot({path:out+'/'+engine+'-'+viewport.height+'-'+won+'-failure.png'}).catch(()=>{});}
  finally{await context.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
 }}finally{await browser.close();}
}
report.status=report.results.every(r=>r.status==='observed')?'observed':'failed';await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,results:report.results.map(r=>({engine:r.engine,viewport:r.viewport,won:r.won,status:r.status,error:r.error}))}));if(report.status==='failed')process.exitCode=1;
