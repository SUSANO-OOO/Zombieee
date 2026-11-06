import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_BOSSES,V100_UNITS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {nativeBattleTap} from './v100-normal-tactical-input.mjs';
const engine=process.env.QUALITY_BOSS_ENGINE??'chromium',before=process.env.QUALITY_BOSS_BEFORE==='1';
const readability=process.env.QUALITY_BOSS_READABILITY==='1';
const out=path.resolve(process.env.QUALITY_BOSS_OUT);await mkdir(out,{recursive:true});
await writeFile(path.join(out,'harness.mjs'),await readFile(new URL(import.meta.url)),{flag:'wx'});
const base=process.env.V100_CAMPAIGN_QA_BASE_URL;
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'prepared boss QA is local only');
const build=await productionBuildIdentity(path.resolve(process.env.QUALITY_BOSS_BUILD_ROOT??'.'));
const sizes=(process.env.QUALITY_BOSS_SIZES??'844x340,1280x720').split(',').map(s=>{const [width,height]=s.split('x').map(Number);return{width,height};});
const bosses=V100_BOSSES.filter(b=>!process.env.QUALITY_BOSS_ONLY||process.env.QUALITY_BOSS_ONLY.split(',').includes(b.id));
const report={engine,before,build,scope:'Prepared V1 stage/owned-unit fixtures. Existing QA boss setup adjusts time, actors, entry and warning positions; not natural progression, difficulty or performance evidence. Native title, deployment and ability controls; canvas text observation preserves the original paint calls. Silent video; no physical-device/listening acceptance.',
 scriptSha256:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),cases:[],errors:[]};
const browserType={chromium,webkit}[engine];assert.ok(browserType,'known rendering engine');
const browser=await browserType.launch({headless:true});
report.browser={version:browser.version(),executable:browserType.executablePath(),
 playwrightVersion:JSON.parse(await readFile(new URL('../node_modules/playwright/package.json',import.meta.url),'utf8')).version,
 scope:'Existing rendering baseline; service workers blocked for isolation. Not persistent PWA storage evidence.'};
try{
 for(const viewport of sizes)for(const boss of bosses){
  const kind=boss.id.slice(5),label=engine+'-'+kind+'-'+viewport.width+'x'+viewport.height;
  const row={label,kind,stage:boss.stageNumber,status:'running',observations:[]};report.cases.push(row);
  const save=normalizeV100Save({...createDefaultV100Save({playerName:'予告確認',settings:{bgmEnabled:false}}),revision:4,campaignStarted:true,caps:9999,
   availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,boss.stageNumber-1),
   registeredUnitIds:V100_UNITS.map(u=>u.id),ownedUnitIds:V100_UNITS.map(u=>u.id),
   formationSlots:['unit-kumaverson','unit-hachi','unit-babayaga','unit-gantetsu','unit-nao','unit-miyamoto-musashi','unit-zakimiya'],
   flowState:{phase:'formation',stageId:V100_STAGE_IDS[boss.stageNumber-1],stageNumber:boss.stageNumber,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
  const context=await browser.newContext({viewport,hasTouch:viewport.width<1000,serviceWorkers:'block',recordVideo:{dir:path.join(out,label),size:viewport}});
  await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(save));
  await context.addInitScript(({captureRay,readability})=>{
   window.__BOSS_LABEL_PAINTS__=[];window.__ALLY_HP_PAINTS__=[];
   const paintedRect=(ctx,x,y,w,h)=>{
    const m=ctx.getTransform(),r=ctx.canvas.getBoundingClientRect(),sx=r.width/ctx.canvas.width,sy=r.height/ctx.canvas.height;
    const points=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([px,py])=>({x:r.left+(m.a*px+m.c*py+m.e)*sx,y:r.top+(m.b*px+m.d*py+m.f)*sy}));
    return{x:Math.min(...points.map(p=>p.x)),y:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y))};
   };
   if(readability){
    const fill=CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect=function(x,y,w,h){
     if(this.fillStyle==='#e9c65a'&&w>0&&h>0){window.__ALLY_HP_PAINTS__.push({at:performance.now(),rect:paintedRect(this,x,y,w,h)});if(window.__ALLY_HP_PAINTS__.length>128)window.__ALLY_HP_PAINTS__.shift();}
     return fill.call(this,x,y,w,h);
    };
   }
   window.__BOSS_POINTER_EVENTS__=[];
   for(const type of ['pointerdown','pointerup','pointercancel','click'])document.addEventListener(type,event=>{
    const button=event.target.closest?.('button');
    window.__BOSS_POINTER_EVENTS__.push({type,at:performance.now(),x:event.clientX,y:event.clientY,
     target:event.target.className,button:button?.className,fighterId:button?.dataset.fighterId});
   },true);
   const original=CanvasRenderingContext2D.prototype.fillText;window.__BOSS_HINT_PAINTS__=[];
   CanvasRenderingContext2D.prototype.fillText=function(text,...args){
    const name=this[Symbol.for('Zombieee.actualAbilityNamePaint')];
    if(readability&&name&&this.globalAlpha>=.1){
     const w=this.measureText(text).width+16,h=Number(/\s([\d.]+)px/.exec(this.font)?.[1]??32)+10;
     window.__BOSS_LABEL_PAINTS__.push({name:text,ownerId:name.ownerId,at:performance.now(),rect:paintedRect(this,args[0]-w/2,args[1]-h/2,w,h)});
     if(window.__BOSS_LABEL_PAINTS__.length>128)window.__BOSS_LABEL_PAINTS__.shift();
    }
    if(typeof text==='string'&&(text.includes('！')||text.includes(' // '))){
     window.__BOSS_HINT_PAINTS__.push({text,at:performance.now()});
     if(window.__BOSS_HINT_PAINTS__.length>100)window.__BOSS_HINT_PAINTS__.shift();
    }
    return original.call(this,text,...args);
   };
   if(captureRay){
    const proto=CanvasRenderingContext2D.prototype,paths=new WeakMap();
    const begin=proto.beginPath,move=proto.moveTo,line=proto.lineTo,stroke=proto.stroke;
    window.__BOSS_RAYS__=[];
    proto.beginPath=function(...args){paths.set(this,this.strokeStyle==='#55e6ef'?[]:null);return begin.call(this,...args);};
    proto.moveTo=function(x,y){const p=paths.get(this);if(p&&p.length<3)p.push({x,y});return move.call(this,x,y);};
    proto.lineTo=function(x,y){const p=paths.get(this);if(p&&p.length<3)p.push({x,y});return line.call(this,x,y);};
    proto.stroke=function(...args){
     const p=paths.get(this);
     if(p?.length===2&&this.strokeStyle==='#55e6ef'&&[3,5].includes(this.lineWidth)&&this.getLineDash().join(',')==='9,6'){
      window.__BOSS_RAYS__.push({at:performance.now(),start:p[0],end:p[1]});
      if(window.__BOSS_RAYS__.length>64)window.__BOSS_RAYS__.shift();
     }
     return stroke.call(this,...args);
    };
   }
  },{captureRay:kind==='kurome',readability});
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(label+': '+String(e)));
  const dismissIsolationNotice=async()=>{
   const notice=page.getByText('オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。',{exact:true});
   if(await notice.isVisible()){await notice.locator('..').getByRole('button',{name:'閉じる',exact:true}).click();row.isolationNoticeDismissed=true;}
  };
  try{
   await page.goto(new URL('?phase-g=1',base).href,{waitUntil:'domcontentloaded'});
   await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
   await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
   await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running&&document.documentElement.dataset.assetLoadState==='ready');
   row.setup=await page.evaluate(kind=>window.__ASHFALL_BATTLE_QA__.prepareBossFoundationProof(kind),kind);
   await page.waitForFunction(kind=>!!window.__ASHFALL_BATTLE_QA__.getBossFoundationProof(kind).bossId,kind);
   row.entry=await page.evaluate(kind=>window.__ASHFALL_BATTLE_QA__.getBossFoundationProof(kind),kind);
   await page.evaluate(id=>window.__ASHFALL_BATTLE_QA__.accelerateBossFoundationEntry(id),row.entry.bossId);
   await page.waitForFunction(kind=>window.__ASHFALL_BATTLE_QA__.getBossFoundationProof(kind).combatReady,kind);
   await dismissIsolationNotice();
   row.entryDraw=await page.evaluate(bossId=>({audit:window.__ASHFALL_BATTLE_QA__.getV105CorrectionAudit([bossId]),
    resources:performance.getEntriesByType('resource').filter(r=>r.name.includes('kurome')).map(r=>r.name)}),row.entry.bossId);
   const arm=async humanId=>{
    const armed=await page.evaluate(({bossId,humanId})=>{
     const result=window.__ASHFALL_BATTLE_QA__.armBossFoundationTelegraph(bossId,humanId);
     window.__BOSS_DRAW_TRACE__=[];let traceCount=0;
     const trace=setInterval(()=>{
      const audit=window.__ASHFALL_BATTLE_QA__.getV105CorrectionAudit([bossId]).fighters[0];
      window.__BOSS_DRAW_TRACE__.push({at:performance.now(),phase:audit?.stationAbility.phase,
       draw:audit?.draw,text:document.querySelector('.v100-boss-telegraph-warning')?.textContent,
       painted:window.__BOSS_HINT_PAINTS__.slice(-2)});
      if(++traceCount>=40)clearInterval(trace);
     },50);
     return{result,at:performance.now()};
    },{bossId:row.entry.bossId,humanId});assert.ok(armed.result?.warningSeconds>0);
    await page.waitForFunction(kind=>!!window.__ASHFALL_BATTLE_QA__.getBossFoundationProof(kind).telegraph,kind);
    await page.waitForFunction(({kind,at})=>{
     const p=window.__ASHFALL_BATTLE_QA__.getBossFoundationProof(kind);
     const name=p.telegraph?.displayName;if(!name)return false;
     return document.querySelector('.v100-boss-telegraph-warning')?.textContent.includes(name)
      ||window.__BOSS_HINT_PAINTS__.some(x=>x.at>=at&&x.text.startsWith(name));
    },{kind,at:armed.at});return armed;
   };
   const observe=async(tag,at)=>{
    await dismissIsolationNotice();
    const result=await page.evaluate(({kind,at})=>{
     const proof=window.__ASHFALL_BATTLE_QA__.getBossFoundationProof(kind),s=window.__ASHFALL_BATTLE_QA__.getSnapshot();
     const el=document.querySelector('.v100-boss-telegraph-warning'),rect=el?.getBoundingClientRect();
     const painted=window.__BOSS_HINT_PAINTS__.filter(x=>x.at>=at&&x.text.startsWith(proof.telegraph?.displayName??'')).at(-1);
     return{proof,ray:window.__BOSS_RAYS__?.at(-1),draw:window.__ASHFALL_BATTLE_QA__.getV105CorrectionAudit([proof.bossId]).fighters[0]?.draw,
      text:el?.textContent??painted?.text??null,rect:rect?{x:rect.x,y:rect.y,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height}:null,
      available:[...document.querySelectorAll('.manual-ability-ready')].map(e=>{const r=e.getBoundingClientRect(),v=e.querySelector('span').getBoundingClientRect();return{id:e.dataset.fighterId,kind:e.dataset.abilityKind,disabled:e.getAttribute('aria-disabled'),
       rect:{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height},
       visibleRect:{x:v.x,y:v.y,right:v.right,bottom:v.bottom}};}),
      humans:s.fighters.filter(f=>f.side==='human').map(f=>({id:f.id,kind:f.kind,hp:f.hp,manualAbility:f.manualAbility}))};
    },{kind,at});
    if(readability){
     result.readability=await page.evaluate(async at=>{
      // Observe a new real canvas frame after React's DOM layout has committed;
      // never compare an earlier canvas paint to later DOM button positions.
      const frameStart=performance.now();
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const field=document.querySelector('.battlefield'),r=field.getBoundingClientRect(),ctx=field.getContext('2d');
      const hp=window.__ALLY_HP_PAINTS__.filter(p=>p.at>=Math.max(at,frameStart)).at(-1);
      const hpPixel=hp?[...ctx.getImageData(Math.floor(((hp.rect.x+hp.rect.right)/2-r.left)*field.width/r.width),Math.floor(((hp.rect.y+hp.rect.bottom)/2-r.top)*field.height/r.height),1,1).data]:null;
      const names=window.__BOSS_LABEL_PAINTS__.filter(p=>p.at>=Math.max(at,frameStart)),latest=names.at(-1)?.at??0;
      return{hp,hpPixel,names:[...new Map(names.filter(p=>p.at>=latest-100).map(p=>[p.ownerId,p])).values()],
       hud:[...document.querySelectorAll('.top-hud,.bottom-hud,.v100-boss-telegraph-warning,.manual-ability-ready')].map(e=>{const q=e.getBoundingClientRect();return{kind:e.className,x:q.x,y:q.y,right:q.right,bottom:q.bottom};})};
     },at);
     row.observations.push({tag,...result});
     if(!before){
      assert.ok(result.readability.names.length,'real ability-name paint must be observed');
      for(const {rect:a} of result.readability.names)assert.ok(a.x>=0&&a.y>=0&&a.right<=viewport.width&&a.bottom<=viewport.height,'name stays in the actually visible cropped canvas');
      for(const a of result.readability.names.map(n=>n.rect))for(const b of result.readability.hud)assert.ok(!(a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y),'ability name must avoid live HUD rectangles');
      if(tag==='initial')assert.ok(result.readability.hpPixel?.slice(0,3).every((v,i)=>Math.abs(v-[233,198,90][i])<=12),'allied HP remains visible in the final canvas after boss paint');
      if(tag==='initial')for(const b of result.readability.hud){const a=result.readability.hp.rect;assert.ok(!(a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y),'allied HP is also clear of the DOM HUD and skill buttons');}
     }
    }
    if(!readability)row.observations.push({tag,...result});
    assert.ok(result.text,label+': missing rendered warning');
    if(!before&&kind==='kurome'){
     assert.ok(result.ray?.at>=at,'the real targeting ray is painted during this warning');
     const origin=result.draw.renderedWeaponSocket;
     assert.ok(origin&&Math.hypot(result.ray.start.x-origin.x,result.ray.start.y-origin.y)<.001,'ray begins at this frame painted eye');
     assert.ok(Math.hypot(result.ray.end.x-result.proof.trackingTarget.targetX,result.ray.end.y-(result.proof.trackingTarget.targetY-38))<.001,'ray ends at actual committed target');
    }
    if(result.rect)assert.ok(result.rect.x>=0&&result.rect.right<=viewport.width&&result.rect.y>=0&&result.rect.bottom<=viewport.height,'warning inside viewport');
    if(!before&&result.rect)for(const marker of result.available){
     assert.ok(marker.rect.width>=44&&marker.rect.height>=44,'native skill hit target stays at least 44px');
     const a=result.rect,b=marker.visibleRect;
     assert.ok(!(a.x<b.right-1&&a.right>b.x+1&&a.y<b.bottom-1&&a.bottom>b.y+1),'ability marker must not cover the warning');
    }
    await page.screenshot({path:path.join(out,label+'-'+tag+'.png')});return result;
   };
   const armed=await arm(row.setup.humanId),initial=await observe('initial',armed.at);
   if(!before&&kind!=='kurome')assert.doesNotMatch(initial.text,/防御技|回復|砲撃|ガンテツ|クマバーソン|ムサシ/u,'the only prepared actor is an attacking scout');
   if(kind==='kurome'){
    const evadeArmed=await arm(row.setup.humanId);
    await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__.getBossFoundationProof('kurome').stationPhase==='tracking');
    row.evadeBefore=await page.evaluate(()=>{
     const proof=window.__ASHFALL_BATTLE_QA__.getBossFoundationProof('kurome');
     const field=document.querySelector('.battlefield'),r=field.getBoundingClientRect(),scale=Number(field.dataset.worldScale);
     const point={x:r.left+Number(field.dataset.worldOffsetX)+proof.humanX*scale,
      y:r.top+Number(field.dataset.worldOffsetY)+(proof.humanY-30)*scale};
     return{proof,point,ownsPoint:document.elementFromPoint(point.x,point.y)===field};
    });
    assert.equal(row.evadeBefore.ownsPoint,true,'actual canvas must own the targeted ally tap');
    const {x,y}=row.evadeBefore.point;
    if(viewport.width<1000)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
    await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__.getBossFoundationProof('kurome').lastCounterplay?.input==='battlefield-pointer');
    row.evadePointerEvents=await page.evaluate(at=>window.__BOSS_POINTER_EVENTS__.filter(e=>e.at>=at),evadeArmed.at);
    if(!before){
     await page.waitForFunction(()=>document.querySelector('.v100-boss-telegraph-warning')?.textContent.includes('照準線を外れた')||window.__BOSS_HINT_PAINTS__.at(-1)?.text.includes('照準線を外れた'));
     await observe('evade-clear',evadeArmed.at);
    }
    await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__.getBossFoundationProof('kurome').stationPhase==='recovery');
    row.evadeAfter=await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.getBossFoundationProof('kurome'));
    assert.equal(row.evadeAfter.humanHp,row.evadeBefore.proof.humanHp,'native evade avoids the locked beam');
    assert.equal(row.evadeAfter.visionDisruptedRemaining,0);
    row.nativeEvadeActivated=true;await page.screenshot({path:path.join(out,label+'-evade-result.png')});
   }
   if(kind==='takuya'){
    const card=page.locator('.unit-card[data-kind="kumaverson"]');assert.equal(await nativeBattleTap(page,card),true);
    await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.some(f=>f.kind==='kumaverson'&&f.hp>0&&f.combatReady&&!f.gateEntering));
    const owner=await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(f=>f.kind==='kumaverson'&&f.hp>0&&f.combatReady));
    const defense=await arm(owner.id);
    if(!before)await page.waitForFunction(()=>document.querySelector('.v100-boss-telegraph-warning')?.textContent.includes('クマバーソン')||window.__BOSS_HINT_PAINTS__.at(-1)?.text.includes('クマバーソン'));
    await observe('defense-ready',defense.at);
    const marker=page.locator('.manual-ability-ready[data-fighter-id="'+owner.id+'"]');
    assert.equal(await nativeBattleTap(page,marker),true);
    await page.waitForFunction(id=>window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.some(f=>f.id===id&&f.manualAbility?.activationId>0),owner.id);
    row.nativeDefenseActivated=true;await page.screenshot({path:path.join(out,label+'-defense-activated.png')});
    await page.waitForFunction(id=>window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.some(f=>f.id===id&&f.manualAbility?.phase==='active'&&f.manualAbility.activeRemaining>0),owner.id);
    row.defenseGuard=await page.evaluate(id=>window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(f=>f.id===id),owner.id);
    await page.waitForFunction(()=>!window.__ASHFALL_BATTLE_QA__.getBossFoundationProof('takuya').telegraph);
    row.defenseAfter=await page.evaluate(id=>window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(f=>f.id===id),owner.id);
    assert.ok(row.defenseAfter?.hp>0&&row.defenseAfter.manualAbility.activeRemaining>0,'guard remains active at the attack');
    await page.screenshot({path:path.join(out,label+'-defense-result.png')});
   }
   row.status='passed';
  }catch(error){row.status='failed';row.error=String(error);row.body=await page.locator('body').innerText().catch(()=>null);
   row.failureState=await page.evaluate(()=>({pointerEvents:window.__BOSS_POINTER_EVENTS__,drawTrace:window.__BOSS_DRAW_TRACE__,snapshot:window.__ASHFALL_BATTLE_QA__?.getSnapshot(),
    layouts:document.documentElement.dataset.manualAbilityLayoutDebug})).catch(()=>null);
   await page.screenshot({path:path.join(out,label+'-failure.png')}).catch(()=>{});throw error;}
  finally{await context.close();row.video=await page.video().path();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=String(error);throw error;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
