// Revisit earned campaign openings through native UI on a separately identified
// build. This is a bounded pacing diagnostic, not a second earned full route.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {normalTacticalInput,nativeBattleTap} from './v100-normal-tactical-input.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {serializeV100Save} from '../app/v100Save.js';

const origin=process.env.V100_CAMPAIGN_QA_BASE_URL;
const out=process.env.V100_SEAL_PACING_OUT??'outputs/v100-seal-pacing-native-r1';
const source='outputs/v100-feedback-normal-campaign-r2/report.json';
const bytes=await readFile(source),baseline=JSON.parse(bytes);
assert.equal(baseline.status,'completed-feedback-diagnostic','Finish and preserve the original route before revisiting these stages');
const report={scope:'S9/S28 earned opening inventories and levels replayed in isolated storage, with only flow returned to formation. Native UI tactics; no battle setters. Cross-build diagnostic, not exact-candidate full campaign acceptance.',source:{path:source,sha256:createHash('sha256').update(bytes).digest('hex'),build:baseline.build},build:await productionBuildIdentity(),results:[],status:'running'};
await mkdir(out,{recursive:false});
const persist=()=>writeFile(out+'/report.json',JSON.stringify(report,null,2));
const browser=await chromium.launch({headless:true});
try{
 for(const number of [9,28]){
  const previous=baseline.stages.find(s=>s.number===number);assert.equal(previous.status,'won');
  const save=structuredClone(previous.openingSave);
  save.flowState={...save.flowState,phase:'formation',destination:'formation',finalized:true};
  const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,recordVideo:{dir:out+'/videos',size:{width:844,height:390}}});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const record={number,priorElapsedSeconds:previous.result.elapsedSeconds,inputs:[],samples:[],transitions:[],errors:[],requestFailures:[],status:'running'};report.results.push(record);await persist();
  page.on('pageerror',e=>record.errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')record.errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)record.errors.push(r.status()+' '+r.url());});
  page.on('requestfailed',r=>record.requestFailures.push({url:r.url(),error:r.failure()?.errorText}));
  try{
   await page.addInitScript(value=>{for(const key of ['nishijin-campaign-v100','nishijin-campaign-v100:mirror','nishijin-campaign-v100:last-known-good'])localStorage.setItem(key,value);},serializeV100Save(save));
   await page.goto(new URL('v100',origin).href);
   const play=page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true}),start=page.getByRole('button',{name:'戦闘へ',exact:true});
   await play.or(start).first().waitFor();if(await play.isVisible())await play.click();await start.click();
   await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
   const deadline=Date.now()+8*60_000;let signature='',last;
   while(Date.now()<deadline){
    last=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();return s?{time:s.time,running:s.running,over:s.over,objective:s.objective,mission:s.stageMission,baseHp:s.baseHp,fighters:s.fighters.map(f=>({id:f.id,kind:f.kind,side:f.side,hp:f.hp,x:f.x,y:f.y})),enemySpawn:s.enemySpawn}:null;});
    if(!last)break;
    const state=JSON.stringify([last.mission.powerActivated,last.mission.sealed,last.mission.completed,last.mission.failed]);
    if(signature!==state){signature=state;record.transitions.push(last);await page.screenshot({path:out+'/s'+number+'-transition-'+record.transitions.length+'.png'});await persist();}
    if(last.over||!last.running)break;
    await nativeBattleTap(page,page.getByRole('button',{name:'音声を有効にする',exact:true}));
    await normalTacticalInput(page,record);await page.waitForTimeout(300);
   }
   record.last=last;
   const result=page.getByLabel('作戦結果',{exact:true});await result.waitFor();
   record.result=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('nishijin-campaign-v100'));return s.pendingResult??s.lastResult;});
   assert.equal(record.result?.stageId,previous.id);assert.equal(record.result?.won,true);
   assert.ok(record.transitions.some(s=>s.mission.powerActivated===(number===28?4:3)),'All physical nodes must be operated');
   assert.ok(record.transitions.some(s=>s.mission.sealed),'Return begins only after sealing');
   record.return=record.transitions.find(s=>s.mission.sealed);
   assert.ok(record.return.mission.returnTargetIds.length>0,'Real deployed identities own return');
   assert.deepEqual(record.errors,[]);assert.deepEqual(record.requestFailures,[]);
   await page.screenshot({path:out+'/s'+number+'-result.png'});record.status='observed';
  }catch(error){record.status='failed';record.error=String(error);await page.screenshot({path:out+'/s'+number+'-failure.png'}).catch(()=>{});}
  finally{await context.close();record.video=await page.video()?.path();await persist();console.log(JSON.stringify({number,status:record.status,elapsed:record.result?.elapsedSeconds,error:record.error}));}
  if(record.status==='failed')break;
 }
}finally{await browser.close();}
report.status=report.results.length===2&&report.results.every(r=>r.status==='observed')?'observed':'failed';
await persist();if(report.status==='failed')process.exitCode=1;
