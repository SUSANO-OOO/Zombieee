import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {nativeBattleTap} from './v100-normal-tactical-input.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const engine=process.env.V100_ENEMY_MOTION_ENGINE??'chromium',out=process.env.V100_ENEMY_MOTION_OUT;
assert.ok(out);await mkdir(out,{recursive:false});
const report={engine,build:await productionBuildIdentity(),inputs:[],errors:[],scope:'S1 native deployment only, level-1 owned Guardian fixture. Observe real ordinary walker and crusher attacks, without actor/time/HP/result setters. Not a campaign or win acceptance.'};
const browser=await ({chromium,webkit}[engine]).launch();
try {
 const context=await browser.newContext({viewport:{width:844,height:340},isMobile:true,hasTouch:true,recordVideo:{dir:out+'/videos',size:{width:844,height:340}}});
 const page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());});
 const base=createDefaultV100Save({playerName:'感染者動作確認'}),owned=[...base.ownedUnitIds,'unit-gantetsu'];
 const save=normalizeV100Save({...base,campaignStarted:true,revision:3,ownedUnitIds:owned,registeredUnitIds:owned,formationSlots:['unit-gantetsu',null,null,null,null,null,null],flowState:{phase:'formation',stageId:V100_STAGE_IDS[0],stageNumber:1,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
 await page.addInitScript(value=>{for(const key of ['nishijin-campaign-v100','nishijin-campaign-v100:mirror','nishijin-campaign-v100:last-known-good'])localStorage.setItem(key,value);},serializeV100Save(save));
 await page.addInitScript(()=>{
  const audit={rows:[],captures:{}};window.__ENEMY_CONTACT_MOTION__=audit;const seen=new Map(),copies=new Map();
  window.__ENEMY_CONTACT_EXPORT__=()=>{for(const [key,c]of copies){audit.captures[key]=c.toDataURL('image/png');c.width=c.height=0;}copies.clear();};
  function observe(){const s=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.(),canvas=document.querySelector('.game-shell canvas');
   if(s?.running&&canvas)for(const f of s.fighters.filter(f=>['walker','crusher'].includes(f.kind)&&f.hp>0&&f.combatReady)) {
    const r=f.renderAudit;if(!r?.assetReady||seen.get(f.id)===r.renderSequence||audit.rows.length>=5000)continue;seen.set(f.id,r.renderSequence);
    const target=s.fighters.find(t=>t.id===f.targetId);
    audit.rows.push({time:s.time,pageSeconds:performance.now()/1000,id:f.id,kind:f.kind,hp:f.hp,x:f.x,y:f.y,depthScale:f.renderDepthScale,attack:f.attack,windup:f.attackWindup,sequence:f.attackSequence,flash:f.flash,targetId:f.targetId,targetHp:target?.hp??null,render:{...r}});
    const phase=f.attackWindup>.08?'windup':f.attack>.065&&f.attack<.13?'contact':null;
    const key=f.kind+'-'+phase;
    if(phase&&f.flash<=0&&!audit.captures[key]){const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;c.getContext('2d').drawImage(canvas,0,0);copies.set(key,c);audit.captures[key]='pending';}
   }
   requestAnimationFrame(observe);
  }requestAnimationFrame(observe);
 });
 try {
  await page.goto(new URL('v100',process.env.V100_CAMPAIGN_QA_BASE_URL).href);
  const play=page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true}),start=page.getByRole('button',{name:'戦闘へ',exact:true});await play.or(start).first().waitFor();if(await play.isVisible())await play.click();await start.click();
  await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
  const deadline=Date.now()+80000;let observed=false;
  while(Date.now()<deadline){
   const state=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__.getSnapshot(),a=window.__ENEMY_CONTACT_MOTION__;return {time:s.time,running:s.running,humans:s.fighters.filter(f=>f.side==='human'&&f.hp>0).length,ready:['walker','crusher'].every(kind=>a.rows.some(r=>r.kind===kind&&r.windup>.08)&&a.rows.filter(r=>r.kind===kind&&r.attack>.065&&r.attack<.13&&r.flash<=0).length>=2)};});
   if(state.ready){observed=true;break;}if(!state.running)break;
   if(state.humans<2&&await nativeBattleTap(page,page.locator('button.unit-card[data-kind="guardian"]').first()))report.inputs.push({time:state.time,action:'deploy',kind:'guardian'});
   await page.waitForTimeout(350);
  }
  await page.evaluate(()=>window.__ENEMY_CONTACT_EXPORT__());report.audit=await page.evaluate(()=>window.__ENEMY_CONTACT_MOTION__);
  for(const [name,data]of Object.entries(report.audit.captures))if(data.startsWith('data:'))await writeFile(out+'/'+name+'.png',Buffer.from(data.split(',')[1],'base64'));delete report.audit.captures;
  assert.ok(observed,'Both enemies must perform real windup and contact');assert.deepEqual(report.errors,[]);
  if(process.env.V100_ENEMY_MOTION_ASSERT==='1')for(const kind of ['walker','crusher']){
   const contact=report.audit.rows.filter(r=>r.kind===kind&&r.attack>.065&&r.attack<.13&&r.flash<=0);
   assert.ok(contact.every(r=>r.render.spriteState==='attack-b'),kind+' keeps the contact pose in the actual attack window');
   const owners=[...new Set(contact.map(r=>r.id))];
   assert.ok(owners.some(id=>{const rows=report.audit.rows.filter(r=>r.id===id&&r.flash<=0&&(r.attack>0||r.windup>0));const sizes=rows.map(r=>r.render.renderHeight/r.depthScale);return sizes.every(Number.isFinite)&&rows.some(r=>r.windup>0)&&Math.max(...sizes)-Math.min(...sizes)<.001;}),kind+' keeps the same cell scale through windup and strike while respecting lane depth');
  }
  report.status='observed-native-attacks';
 }catch(e){report.status='failed';report.error=String(e);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}
 finally{await context.close();report.video=await page.video()?.path();}
}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify({status:report.status,error:report.error,inputs:report.inputs.length,rows:report.audit?.rows.length}));if(report.status==='failed')process.exitCode=1;
