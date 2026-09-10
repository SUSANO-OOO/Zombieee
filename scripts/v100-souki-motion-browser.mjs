import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {normalTacticalInput} from './v100-normal-tactical-input.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const engine=process.env.V100_SOUKI_ENGINE??'chromium',out=process.env.V100_SOUKI_OUT;
assert.ok(out);await mkdir(out,{recursive:false});
const report={engine,build:await productionBuildIdentity(),inputs:[],errors:[],scope:'Native S5 input until a live Souki telegraph/burst/recovery cycle is observed; owned level-1 roster fixture, no actor/clock/HP/result setters. Not full stage/campaign acceptance.'};
const browser=await ({chromium,webkit}[engine]).launch();
try{
 const context=await browser.newContext({viewport:{width:844,height:340},isMobile:true,hasTouch:true,recordVideo:{dir:out+'/videos',size:{width:844,height:340}}});const page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());});
 const base=createDefaultV100Save({playerName:'走鬼動作確認'}),stageId=V100_STAGE_IDS[4];
 const owned=[...base.ownedUnitIds,'unit-gantetsu','unit-mizuchi','unit-raider'];
 const save=normalizeV100Save({...base,campaignStarted:true,revision:7,availableStageIds:V100_STAGE_IDS.slice(0,5),completedStageIds:V100_STAGE_IDS.slice(0,4),ownedUnitIds:owned,registeredUnitIds:owned,formationSlots:['unit-gantetsu','unit-babayaga','unit-mizuchi','unit-raider',null,null,null],flowState:{phase:'formation',stageId,stageNumber:5,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
 await page.addInitScript(value=>{for(const key of ['nishijin-campaign-v100','nishijin-campaign-v100:mirror','nishijin-campaign-v100:last-known-good'])localStorage.setItem(key,value);},serializeV100Save(save));
 await page.addInitScript(()=>{
  const audit={rows:[],owner:null,phases:[],captures:{}};window.__SOUKI_MOTION_AUDIT__=audit;const seen=new Set(),copies=new Map();
  window.__SOUKI_EXPORT__=()=>{for(const [key,c]of copies){audit.captures[key]=c.toDataURL('image/png');c.width=c.height=0;}copies.clear();};
  function observe(){
   const s=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.(),canvas=document.querySelector('.game-shell canvas');
   if(s?.running&&canvas){
    const f=s.fighters.find(f=>f.kind==='sprinter'&&f.hp>0&&f.combatReady&&(audit.owner===null||f.id===audit.owner));
    if(f?.renderAudit&&f.renderAudit.assetReady){
     audit.owner=f.id;const r=f.renderAudit,key=f.id+':'+r.renderSequence;
     if(!seen.has(key)&&audit.rows.length<1000){seen.add(key);const phase=f.stationAbility.phase;
      const row={time:s.time,pageSeconds:performance.now()/1000,id:f.id,hp:f.hp,x:f.x,y:f.y,phase,remaining:f.stationAbility.remainingSeconds,flash:f.flash,render:{...r}};audit.rows.push(row);
      if(!audit.phases.includes(phase))audit.phases.push(phase);
      const captureReady=phase!=='telegraph'||f.stationAbility.remainingSeconds<.3;
      if(captureReady&&['telegraph','burst','recovery'].includes(phase)&&!audit.captures[phase]){const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;copy.getContext('2d').drawImage(canvas,0,0);copies.set(phase,copy);audit.captures[phase]='pending';}
     }
    }
   }
   requestAnimationFrame(observe);
  }requestAnimationFrame(observe);
 });
 try{
  await page.goto(new URL('v100',process.env.V100_CAMPAIGN_QA_BASE_URL).href);
  const play=page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true}),start=page.getByRole('button',{name:'戦闘へ',exact:true});await play.or(start).first().waitFor();if(await play.isVisible())await play.click();await start.click();
  await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
  const deadline=Date.now()+70000;let observed=false;
  while(Date.now()<deadline){
   const phase=await page.evaluate(()=>window.__SOUKI_MOTION_AUDIT__);
   if(['telegraph','burst','recovery'].every(p=>phase.phases.includes(p))&&phase.rows.some(r=>r.phase==='recovery'&&r.remaining<.2)){observed=true;break;}
   await normalTacticalInput(page,report);await page.waitForTimeout(350);
  }
  await page.evaluate(()=>window.__SOUKI_EXPORT__());report.audit=await page.evaluate(()=>window.__SOUKI_MOTION_AUDIT__);
  for(const [phase,data]of Object.entries(report.audit.captures))if(data.startsWith('data:'))await writeFile(out+'/'+phase+'.png',Buffer.from(data.split(',')[1],'base64'));
  delete report.audit.captures;
  assert.ok(observed,'A real spawned Souki must survive one full burst cycle');assert.deepEqual(report.errors,[]);
  if(process.env.V100_SOUKI_ASSERT_POSES==='1'){
   const rows=report.audit.rows.filter(r=>r.flash<=.04);
   assert.ok(rows.some(r=>r.phase==='telegraph'&&r.remaining<.3&&r.render.spriteState==='attack-a'),'Late windup visibly crouches');
   for(const pose of ['attack-b','walk-a','walk-b'])assert.ok(rows.some(r=>r.phase==='burst'&&r.render.spriteState===pose),'Burst uses authored stride '+pose);
   assert.ok(rows.some(r=>r.phase==='recovery'&&r.remaining<.4&&r.render.spriteState==='idle'),'Recovery returns to the ready stance');
   const sizes=rows.filter(r=>['telegraph','burst','recovery'].includes(r.phase)).map(r=>r.render.renderHeight);assert.ok(Math.max(...sizes)-Math.min(...sizes)<.01,'Source-cell scale must remain constant through crouch and stride');
  }
  report.status='observed-native-cycle';
 }catch(e){report.status='failed';report.error=String(e);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}
 finally{await context.close();report.video=await page.video()?.path();}
}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify({status:report.status,phases:report.audit?.phases,error:report.error}));if(report.status==='failed')process.exitCode=1;
