import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {nativeBattleTap} from './v100-normal-tactical-input.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {STATION_ENEMY_TUNING} from '../app/stationEnemyMechanics.js';
const engine=process.env.V100_STATION_MOTION_ENGINE??'chromium',out=process.env.V100_STATION_MOTION_OUT;
const stage=Number(process.env.V100_STATION_MOTION_STAGE??5);assert.ok([4,5].includes(stage));
const requirements=stage===4?[['grappler','windup'],['grappler','pulling']]:[['gate-eater','windup'],['gate-eater','charging'],['gate-eater','exposed']];
assert.ok(out);await mkdir(out,{recursive:false});
const report={engine,stage,build:await productionBuildIdentity(),inputs:[],errors:[],scope:'Native S4 grapple or S5 boss charge with owned level-1 Guardians. No actor/time/HP/result setters. Not a campaign or win acceptance.'};
const browser=await ({chromium,webkit}[engine]).launch();
try{
 const context=await browser.newContext({viewport:{width:844,height:340},isMobile:true,hasTouch:true,recordVideo:{dir:out+'/videos',size:{width:844,height:340}}});const page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());});
 const base=createDefaultV100Save({playerName:'駅敵動作確認'}),owned=[...base.ownedUnitIds,'unit-gantetsu'];
 const save=normalizeV100Save({...base,campaignStarted:true,revision:7,availableStageIds:V100_STAGE_IDS.slice(0,stage),completedStageIds:V100_STAGE_IDS.slice(0,stage-1),ownedUnitIds:owned,registeredUnitIds:owned,formationSlots:['unit-gantetsu',null,null,null,null,null,null],flowState:{phase:'formation',stageId:V100_STAGE_IDS[stage-1],stageNumber:stage,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
 await page.addInitScript(value=>{for(const key of ['nishijin-campaign-v100','nishijin-campaign-v100:mirror','nishijin-campaign-v100:last-known-good'])localStorage.setItem(key,value);},serializeV100Save(save));
 await page.addInitScript(()=>{
  const audit={rows:[],captures:{}};window.__STATION_ABILITY_MOTION__=audit;const seen=new Map(),copies=new Map();
  window.__STATION_ABILITY_EXPORT__=()=>{for(const [key,c]of copies){audit.captures[key]=c.toDataURL('image/png');c.width=c.height=0;}copies.clear();};
  function observe(){const s=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.(),canvas=document.querySelector('.game-shell canvas');
   if(s?.running&&canvas)for(const f of s.fighters.filter(f=>['grappler','gate-eater'].includes(f.kind)&&f.hp>0&&f.combatReady&&f.stationAbility.phase!=='idle')){
    const r=f.renderAudit;if(!r?.assetReady||seen.get(f.id)===r.renderSequence||audit.rows.length>=3000)continue;seen.set(f.id,r.renderSequence);
    const a=f.stationAbility,target=s.fighters.find(t=>String(t.id)===String(a.targetId));
    audit.rows.push({time:s.time,pageSeconds:performance.now()/1000,id:f.id,kind:f.kind,x:f.x,y:f.y,hp:f.hp,flash:f.flash,depth:f.renderDepthScale,runtime:{...a},target:target?{id:target.id,x:target.x,y:target.y,hp:target.hp}:null,render:{...r},hud:{bossText:document.querySelector('.v100-boss-center')?.textContent??null,message:document.querySelector('.top-hud .battle-message-stack')?.textContent??null,combatReady:f.combatReady,gateEntering:f.gateEntering,contained:f.contained}});
    const key=f.kind+'-'+a.phase,ready=(a.phase!=='windup'||a.remainingSeconds<.5)&&f.flash<=0;
    if(ready&&!audit.captures[key]&&copies.size<5){const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;c.getContext('2d').drawImage(canvas,0,0);copies.set(key,c);audit.captures[key]='pending';}
   }
   requestAnimationFrame(observe);
  }requestAnimationFrame(observe);
 });
 try{
  await page.goto(new URL('v100',process.env.V100_CAMPAIGN_QA_BASE_URL).href);
  const play=page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true}),start=page.getByRole('button',{name:'戦闘へ',exact:true});await play.or(start).first().waitFor();if(await play.isVisible())await play.click();await start.click();await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
  const deadline=Date.now()+95000;let completionDeadline=deadline,observed=false;
  while(Date.now()<completionDeadline){
   const s=await page.evaluate(({requirements,stage})=>{const s=window.__ASHFALL_BATTLE_QA__.getSnapshot(),rows=window.__STATION_ABILITY_MOTION__.rows;return{time:s.time,running:s.running,humans:s.fighters.filter(f=>f.side==='human'&&f.hp>0).length,activeGrapples:s.fighters.filter(f=>f.kind==='grappler'&&f.hp>0&&f.stationAbility.phase==='windup').map(f=>({id:f.id,remaining:f.stationAbility.remainingSeconds})),ready:requirements.every(([kind,phase])=>rows.some(r=>r.kind===kind&&r.runtime.phase===phase&&r.flash<=0))&&(stage===4?rows.some(r=>r.kind==='grappler'&&r.runtime.phase==='pulling'&&r.runtime.remainingSeconds<1&&r.flash<=0):rows.some(r=>r.kind==='gate-eater'&&r.runtime.phase==='exposed'&&r.runtime.remainingSeconds<1.1&&r.flash<=0))};},{requirements,stage});
   // Keep the 95-second discovery limit. A windup already observed inside it
   // can finish its bounded real hold, rather than cutting the clip mid-action.
   if(stage===4&&Date.now()<deadline)for(const cycle of s.activeGrapples){
    const finish=Date.now()+Math.ceil((cycle.remaining+STATION_ENEMY_TUNING.karamite.holdSeconds)*1000)+350;
    if(finish>completionDeadline){completionDeadline=finish;report.completionGrace={ownerId:cycle.id,observedAt:s.time,remainingWindup:cycle.remaining,holdSeconds:STATION_ENEMY_TUNING.karamite.holdSeconds,discoveryLimitMs:95000,extraMs:finish-deadline};}
   }
   if(s.ready){
    const eligible=Date.now()<deadline||await page.evaluate(id=>window.__STATION_ABILITY_MOTION__.rows.some(r=>r.id===id&&r.runtime.phase==='pulling'&&r.runtime.remainingSeconds<1&&r.flash<=0),report.completionGrace?.ownerId??null);
    if(eligible){observed=true;break;}
   }
   if(!s.running)break;
   if(s.humans<2&&await nativeBattleTap(page,page.locator('button.unit-card[data-kind="guardian"]').first()))report.inputs.push({time:s.time,action:'deploy',kind:'guardian'});
   await page.waitForTimeout(350);
  }
  await page.evaluate(()=>window.__STATION_ABILITY_EXPORT__());report.audit=await page.evaluate(()=>window.__STATION_ABILITY_MOTION__);
  for(const [name,data]of Object.entries(report.audit.captures))if(data.startsWith('data:'))await writeFile(out+'/'+name+'.png',Buffer.from(data.split(',')[1],'base64'));delete report.audit.captures;
  assert.ok(observed,'Real grapple and boss charge cycles must occur');assert.deepEqual(report.errors,[]);
  if(report.completionGrace)assert.ok(report.completionGrace.extraMs<=Math.ceil((STATION_ENEMY_TUNING.karamite.windupSeconds+STATION_ENEMY_TUNING.karamite.holdSeconds)*1000)+350,'Grace is bounded by one already observed ability cycle');
  if(process.env.V100_STATION_MOTION_ASSERT==='1'){
   for(const kind of [...new Set(requirements.map(r=>r[0]))]){
    const rows=report.audit.rows.filter(r=>r.kind===kind&&r.flash<=0);
    assert.ok(rows.filter(r=>r.runtime.phase==='windup'&&r.runtime.remainingSeconds<.5).every(r=>r.render.spriteState==='attack-a'),kind+' holds the late windup pose');
    const active=rows.filter(r=>r.runtime.phase===(kind==='grappler'?'pulling':'charging'));
    assert.ok(active.length>=2&&active.every(r=>r.render.spriteState==='attack-b'),kind+' performs the actual ability pose');
    assert.ok(active.every(r=>r.render.direction===(r.runtime.direction<0?'left':'right')),kind+' faces the locked ability direction');
    const sizes=rows.map(r=>r.render.renderHeight/r.depth);assert.ok(sizes.every(Number.isFinite)&&Math.max(...sizes)-Math.min(...sizes)<.001,kind+' keeps the authored cell scale');
   }
   if(stage===5)assert.ok(report.audit.rows.some(r=>r.kind==='gate-eater'&&r.runtime.phase==='exposed'&&r.runtime.remainingSeconds<1.1&&r.flash<=0&&r.render.spriteState==='idle'),'Boss settles after charging');
  }
  if(stage===5&&process.env.V100_STATION_HUD_ASSERT==='1'){
   const rows=report.audit.rows.filter(r=>r.kind==='gate-eater'),first=rows[0].time;
   assert.ok(rows.every(r=>r.render.healthBarVisible===false),'Central boss health replaces the bar over the attack pose');
   assert.ok(rows.filter(r=>r.time>first+.25).every(r=>r.hud.bossText?.includes('改札喰い')),'Boss health remains present throughout the observed ability');
   report.hudLayout=await page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};return {boss:rect('.v100-boss-center'),brand:rect('.battle-brand-zone'),controls:rect('.battle-controls-zone'),viewport:{width:innerWidth,height:innerHeight}};});
   const {boss,brand,controls,viewport}=report.hudLayout;
   assert.ok(boss.x>=brand.right&&boss.right<=controls.x&&boss.y>=0&&boss.bottom<viewport.height*.25,'Boss health stays in the top-center space');
   await page.screenshot({path:out+'/gate-eater-hud.png'});
  }
  report.status='observed-native-abilities';
 }catch(e){report.status='failed';report.error=String(e);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}
 finally{await context.close();report.video=await page.video()?.path();}
}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify({status:report.status,error:report.error,inputs:report.inputs.length,rows:report.audit?.rows.length}));if(report.status==='failed')process.exitCode=1;
