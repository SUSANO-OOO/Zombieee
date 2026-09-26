import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const useCurrentWebKit=process.env.NEW_V100_NATIVE_CURRENT_WEBKIT==='1';
const {chromium,webkit}=await import(useCurrentWebKit?'./pwa-native-runtime/node_modules/playwright/index.mjs':'playwright');
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_INITIAL_UNIT_IDS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {normalTacticalInput,nativeBattleTap} from './v100-normal-tactical-input.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {installMuzzleCanvasAudit} from './v100-muzzle-canvas-audit.mjs';
import {installContactCanvasAudit} from './v100-contact-canvas-audit.mjs';
import {installMetalCanvasAudit} from './v100-metal-canvas-audit.mjs';
import {installClawCanvasAudit} from './v100-claw-canvas-audit.mjs';
import {installManualFirearmCanvasAudit} from './v100-manual-firearm-canvas-audit.mjs';
import {installGuardianContactTrace} from './v100-guardian-contact-trace.mjs';
const origin=process.env.V100_CAMPAIGN_QA_BASE_URL;
const out=process.env.V100_BATTLE_IMPROVEMENT_OUT??'outputs/v100-battle-improvement-r1';
const engine=process.env.V100_BATTLE_IMPROVEMENT_ENGINE??'chromium';
const numbers=(process.env.V100_BATTLE_IMPROVEMENT_STAGES??'2,3,6').split(',').map(Number);
const includeMayo=process.env.V100_BATTLE_IMPROVEMENT_MAYO==='1';
const manualFirearmCheck=process.env.V100_MANUAL_FIREARM_CHECK==='1';
const guardianCheck=process.env.V100_GUARDIAN_CHECK==='1';
const kumaGuardCheck=process.env.V100_KUMA_GUARD_CHECK==='1';
const requiredMusic=['music-v100-score-normal','music-boss','music-v100-score-pressure'];
function assertBattleMusicGate(result){
 const samples=result.musicSamples;
 assert.ok(Array.isArray(samples)&&samples.length>0,'Native music gate requires real mixer samples');
 assert.ok(samples.every(s=>s?.audio&&Array.isArray(s.audio.activeBgm)&&typeof s.audio.contextState==='string'&&typeof s.audio.audioState==='string'&&typeof s.audio.unlocked==='boolean'&&Array.isArray(s.audio.duplicateLoopInstanceKeys)&&s.shellAudio&&typeof s.shellAudio.activeBgmVoices==='number'),'Native music gate rejects missing mixer or shell diagnostics');
 assert.ok(samples.some(s=>s.audio.activeBgm.some(v=>v.assetId==='music-v100-score-normal'&&s.audio.contextState==='running'&&s.audio.audioState==='running'&&s.audio.unlocked===true&&v.voiceGain>0)),'Normal music lacks running-context positive mixer evidence');
 for(const sample of samples){assert.equal(sample.shellAudio.activeBgmVoices,0,'Preparation owner stops throughout battle');assert.deepEqual(sample.audio.duplicateLoopInstanceKeys,[]);}
 if(result.number!==3)return;
 const normalIndex=samples.findIndex(s=>s.audio.activeBgm.some(v=>v.assetId==='music-v100-score-normal'));
 const bossIndex=samples.findIndex(s=>s.audio.activeBgm.some(v=>v.assetId==='music-boss'));
 assert.ok(normalIndex>=0&&bossIndex>normalIndex,`Stage 3 must start normal music before boss music: ${normalIndex}, ${bossIndex}`);
 for(const assetId of requiredMusic){assert.ok(samples.some(s=>s.audio.contextState==='running'&&s.audio.audioState==='running'&&s.audio.unlocked===true&&s.audio.activeBgm.some(v=>v.assetId===assetId&&v.voiceGain>0)),`${assetId} lacks running-context positive mixer evidence`);}
 assert.ok(result.boss?.firstObservedTime!==undefined&&result.bossDefeatedAt!==undefined,'Stage 3 must observe boss arrival and natural defeat');
 assert.equal(result.lastReadableBattleSnapshot?.bossDefeated,true,'Stage 3 must record the actual boss-defeated state');
 assert.ok(samples[bossIndex].time>=result.boss.firstObservedTime&&samples[bossIndex].time<result.bossDefeatedAt,'Boss music must play during the observed boss fight');
 assert.ok(samples.some(s=>s.time>result.bossDefeatedAt&&s.audio.contextState==='running'&&s.audio.audioState==='running'&&s.audio.unlocked===true&&s.audio.activeBgm.some(v=>v.assetId==='music-v100-score-pressure'&&v.voiceGain>0)),'Audible pressure music must follow natural boss defeat');
 assert.ok(result.finalRequestFailures&&Array.isArray(result.finalRequestFailures.events)&&result.finalRequestFailures.overflow===0,'Native music failure events must be present and structurally complete');
 assert.deepEqual(result.finalRequestFailures.events,[],'Native music must not report audio failure events');
 assert.ok(Array.isArray(result.networkRequestFailures),'Native music request failure collection is missing');
 assert.deepEqual(result.networkRequestFailures,[],'Native music must not report failed network requests');
}
function assertNaturalBattleOutcome(result){
 const outcome=result.actualResult;
 assert.ok(outcome&&typeof outcome.won==='boolean'&&typeof outcome.loss==='boolean'&&outcome.won!==outcome.loss,'Native music gate needs one real win or loss result');
}
if(process.env.V100_BATTLE_MUSIC_GATE_FIXTURES==='1'){
 const sample=(assetId,time)=>({time,audio:{activeBgm:[{assetId,voiceGain:1}],contextState:'running',audioState:'running',unlocked:true,duplicateLoopInstanceKeys:[]},shellAudio:{activeBgmVoices:0}});
 const ownerFailureEvents=[];const ownerQa={getFailureEvents:()=>({events:ownerFailureEvents,overflow:0})};const retainedFailureGetter=ownerQa.getFailureEvents;ownerFailureEvents.push({assetId:'transient'});assert.deepEqual(retainedFailureGetter().events,[{assetId:'transient'}]);ownerFailureEvents.length=0;
 const valid={number:3,musicSamples:[sample('music-v100-score-normal',1),sample('music-boss',2),sample('music-v100-score-pressure',4)],boss:{firstObservedTime:2},bossDefeatedAt:3,lastReadableBattleSnapshot:{bossDefeated:true},finalRequestFailures:retainedFailureGetter(),networkRequestFailures:[]};
 assert.doesNotThrow(()=>assertBattleMusicGate(valid));
 assert.doesNotThrow(()=>assertBattleMusicGate({...valid,musicSamples:[sample('music-v100-score-normal',1),sample('music-v100-score-pressure',1.5),sample('music-boss',2),sample('music-v100-score-pressure',4)]}));
 for(const invalid of [
  {...valid,musicSamples:valid.musicSamples.slice(0,2)},
  {...valid,musicSamples:[sample('music-boss',2),sample('music-v100-score-normal',3),sample('music-v100-score-pressure',4)]},
  {...valid,musicSamples:valid.musicSamples.map(s=>s===valid.musicSamples[1]?{...s,audio:{...s.audio,contextState:'suspended'}}:s)},
  {...valid,musicSamples:valid.musicSamples.map(s=>s===valid.musicSamples[1]?{...s,audio:null}:s)},
  {...valid,finalRequestFailures:null},
  {...valid,finalRequestFailures:{events:[],overflow:1}},
  {...valid,networkRequestFailures:[{url:'/audio.ogg'}]},
  {...valid,bossDefeatedAt:5},
  {...valid,lastReadableBattleSnapshot:{bossDefeated:false}},
  {...valid,musicSamples:[sample('music-v100-score-normal',1),sample('music-v100-score-pressure',1.5),sample('music-boss',2)]},
  {...valid,musicSamples:[sample('music-v100-score-normal',1),sample('music-v100-score-pressure',1.5),sample('music-boss',2),{...sample('music-v100-score-pressure',4),audio:{...sample('music-v100-score-pressure',4).audio,activeBgm:[{assetId:'music-v100-score-pressure',voiceGain:0}]}}]},
 ])assert.throws(()=>assertBattleMusicGate(invalid));
  assert.doesNotThrow(()=>assertNaturalBattleOutcome({actualResult:{won:true,loss:false}}));
  assert.doesNotThrow(()=>assertNaturalBattleOutcome({actualResult:{won:false,loss:true}}));
  for(const actualResult of [null,{won:false,loss:false},{won:true,loss:true}])assert.throws(()=>assertNaturalBattleOutcome({actualResult}));
 console.log('v100 battle music gate negative fixtures passed');
 process.exit(0);
}
await mkdir(dirname(out),{recursive:true});
await mkdir(out,{recursive:false});
const playwrightPackageUrl=new URL(useCurrentWebKit?'./pwa-native-runtime/node_modules/playwright/package.json':'../node_modules/playwright/package.json',import.meta.url);
const playwrightPackage=JSON.parse(await readFile(playwrightPackageUrl,'utf8'));
const report={scope:'Isolated owned-roster stage fixtures. Native deploy/support/ability input only after battle starts; no clock/actor/HP/result setters. Not earned campaign or physical-device acceptance. MUSIC_CHECK Stage 3 uses an attainable first-two-stage budget: Nao plus four initial units at level 2, without a vehicle upgrade. It requires natural boss defeat, all three running-context BGM phases and one natural battle result; the final win/loss is recorded separately. BGM active voice is native mixer evidence; cue requests are request-only and do not prove audible output.',build:await productionBuildIdentity(),engine,runtimeChoice:useCurrentWebKit?'current-webkit-runtime':'default-playwright-runtime',provenance:{head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),node:process.version,platform:`${process.platform}-${process.arch}`,playwrightModulePath:fileURLToPath(new URL(useCurrentWebKit?'./pwa-native-runtime/node_modules/playwright/index.mjs':'../node_modules/playwright/index.js',import.meta.url)),playwrightPackageVersion:playwrightPackage.version},results:[]};
const browser=await ({chromium,webkit}[engine]).launch({headless:true});
report.provenance.browserVersion=await browser.version();
try{for(const number of numbers){
 const viewport={width:844,height:340};
 const context=await browser.newContext({viewport,hasTouch:true,isMobile:true,recordVideo:{dir:out+'/videos',size:viewport}});
 const page=await context.newPage();page.setDefaultTimeout(15000);
 const result={number,status:'running',fixture:null,inputs:[],samples:[],errors:[],networkRequestFailures:[],captures:[]};report.results.push(result);
 page.on('pageerror',e=>result.errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)result.errors.push(r.status()+' '+r.url());});
 page.on('requestfailed',r=>result.networkRequestFailures.push({url:r.url(),method:r.method(),failure:r.failure()?.errorText??null}));
 const screenshot=async name=>{await page.screenshot({path:`${out}/s${number}-${name}.png`});result.captures.push(name);};
 try{
  const base=createDefaultV100Save({playerName:'戦場改善確認'}),stageId=V100_STAGE_IDS[number-1];
  const musicStage3=process.env.V100_BATTLE_MUSIC_CHECK==='1'&&number===3;
  const earnedStage3=(process.env.V100_EARNED_STAGE3_FIXTURE==='1'||musicStage3)&&number===3;
  const earnedStage5=process.env.V100_EARNED_STAGE5_FIXTURE==='1'&&number===5;
  const owned=kumaGuardCheck?['unit-kumaverson']:[...base.ownedUnitIds,...(earnedStage3||earnedStage5?['unit-nao']:[]),...(number>=6||earnedStage5?['unit-mizuchi']:[]),...(includeMayo?['unit-mayo-chan']:[])];
  const contactCheck=process.env.V100_CONTACT_CHECK==='1';
  if(!kumaGuardCheck&& (manualFirearmCheck||guardianCheck))for(const id of ['unit-gantetsu','unit-mizuchi','unit-raider'])if(!owned.includes(id))owned.push(id);
  if(contactCheck)owned.push('unit-tatara');
  const formation=kumaGuardCheck?['unit-kumaverson',null,null,null,null,null,null]:manualFirearmCheck||guardianCheck?['unit-gantetsu','unit-babayaga','unit-mizuchi','unit-raider',null,null,null]:contactCheck?['unit-paisen','unit-tatara','unit-kumaverson','unit-babayaga',null,null,null]:[...owned, ...Array(Math.max(0,7-owned.length)).fill(null)].slice(0,7);
  // Stage 1+2 three-star receipts yield 231 CAPS. Nao (85) plus four
  // level-2 upgrades (4*30) are affordable with 26 CAPS left.
  const unitLevels=earnedStage3||earnedStage5?{...base.unitLevels,...Object.fromEntries(V100_INITIAL_UNIT_IDS.map(id=>[id,2]))}:base.unitLevels;
  const vehicle=base.vehicle;
  if(musicStage3)assert.deepEqual(owned,[...V100_INITIAL_UNIT_IDS,'unit-nao'],'Stage 3 music fixture must stay within the attainable first-two-stage roster');
  result.fixture={musicStage3,earnedStage3,earnedStage5,earnedBudgetCaps:earnedStage3?231:earnedStage5?490:null,earnedSpentCaps:earnedStage3?205:earnedStage5?410:null,ownedUnitIds:owned,formationSlots:formation,unitLevels:Object.fromEntries(owned.map(id=>[id,unitLevels[id]])),vehicle:{upgradeLevel:vehicle.upgradeLevel,maxHp:vehicle.maxHp}};
  const save=normalizeV100Save({...base,campaignStarted:true,revision:7,availableStageIds:V100_STAGE_IDS.slice(0,number),completedStageIds:V100_STAGE_IDS.slice(0,number-1),ownedUnitIds:owned,registeredUnitIds:owned,unitLevels,vehicle,formationSlots:formation,
   ...(number>=6||earnedStage5?{ownedSupportIds:['support-healing'],equippedSupportId:'support-healing',supportPurchaseUnlockedIds:['support-healing']}:{}),
   flowState:{phase:'formation',stageId,stageNumber:number,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
  await page.addInitScript(value=>{for(const key of ['nishijin-campaign-v100','nishijin-campaign-v100:mirror','nishijin-campaign-v100:last-known-good'])localStorage.setItem(key,value);},serializeV100Save(save));
  if(process.env.V100_MUZZLE_CHECK==='1')await page.addInitScript(installMuzzleCanvasAudit);
  if(contactCheck)await page.addInitScript(installContactCanvasAudit);
  if(process.env.V100_METAL_CHECK==='1'||guardianCheck||kumaGuardCheck)await page.addInitScript(installMetalCanvasAudit);
  if(process.env.V100_CLAW_CHECK==='1')await page.addInitScript(installClawCanvasAudit);
  if(manualFirearmCheck)await page.addInitScript(installManualFirearmCanvasAudit);
  if(process.env.V100_GUARDIAN_TRACE==='1')await page.addInitScript(installGuardianContactTrace);
  await page.goto(new URL('v100',origin).href);
  const play=page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true}),start=page.getByRole('button',{name:'戦闘へ',exact:true});
  await play.or(start).first().waitFor();if(await play.isVisible())await play.click();
  await start.click();await page.locator('.game-shell canvas').waitFor();
  await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
  if(process.env.V100_BATTLE_MUSIC_CHECK==='1'){
   result.musicFailureObserverInstalled=await page.evaluate(()=>{
    const getter=window.__ASHFALL_AUDIO_QA__?.getFailureEvents;
    if(typeof getter!=='function')return false;
    window.__V100_MUSIC_FAILURE_OBSERVER__={getFailureEvents:getter};
    return typeof window.__V100_MUSIC_FAILURE_OBSERVER__.getFailureEvents==='function';
   });
   assert.equal(result.musicFailureObserverInstalled,true,'Native music failure observer must retain the original QA getter');
  }
  // The combat ref can start before React commits its deployment tray. Observe
  // the requested native control, using the existing setup timeout, before tap.
  if(process.env.V100_METAL_CHECK==='1'||kumaGuardCheck)await page.locator('button.unit-card[data-kind="kumaverson"]').waitFor({state:'visible'});
  result.initialFormation={savedSlots:save.formationSlots,cards:await page.locator('button.unit-card[data-kind]').evaluateAll(els=>els.map(el=>({kind:el.dataset.kind,slot:el.dataset.slotIndex,blocked:el.dataset.blockReason})))};
  if(process.env.V100_METAL_CHECK==='1'||kumaGuardCheck){
   assert.ok(await nativeBattleTap(page,page.locator('button.unit-card[data-kind="kumaverson"]')),'Observe Kuma through an ordinary initial deployment');
   result.inputs.push({action:'deploy',kind:'kumaverson',reason:'initial native guard-contact observation'});
  }
  if(process.env.V100_MUZZLE_CHECK==='1'){
   assert.ok(await nativeBattleTap(page,page.locator('button.unit-card[data-kind="babayaga"]')),'Begin the muzzle observation with an ordinary firearm deployment');
   result.inputs.push({action:'deploy',kind:'babayaga',reason:'initial native firearm deployment for the muzzle observation'});
  }
  if(process.env.V100_CLAW_CHECK==='1'){
   await page.locator('button.unit-card[data-kind="brawler"]').waitFor({state:'visible'});
   assert.ok(await nativeBattleTap(page,page.locator('button.unit-card[data-kind="brawler"]')),'Observe body contact through an ordinary front-line deployment');
   result.inputs.push({action:'deploy',kind:'brawler',reason:'initial native claw-contact observation'});
  }
  if(includeMayo){
   assert.ok(result.initialFormation.cards.some(card=>card.kind==='mayo-chan'),'The requested Mayo fixture must reach the actual deployment tray');
   // The general campaign input policy continually replaces its front line.
   // Reserve the initial command budget for the unit under observation using
   // the same native deployment button, with no actor/resource setters.
   assert.ok(await nativeBattleTap(page,page.locator('button.unit-card[data-kind="mayo-chan"]')),'Mayo must accept an ordinary initial deployment tap');
   result.inputs.push({action:'deploy',kind:'mayo-chan',reason:'bounded Mayo observation: initial native deployment'});
  }
  // macOS WebKit advanced only 127 simulation seconds in the prior 240-second
  // wall budget after the Producer-requested later, stronger Stage 3 boss.
  // Keep the natural boss defeat and music gates while allowing the attainable
  // early-campaign roster enough wall time to finish on that host.
  const deadline=Date.now()+(musicStage3?420000:240000);
  let last=null,emptySince=null,maxEmpty=0;
  while(Date.now()<deadline){
   last=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();return s?{time:s.time,over:s.over,running:s.running,bossDefeated:s.bossDefeated,baseHp:s.baseHp,baseMaxHp:s.baseMaxHp,objective:s.objective,stageMission:s.stageMission,enemySpawn:s.enemySpawn,fighters:s.fighters.map(f=>({id:f.id,kind:f.kind,side:f.side,hp:f.hp,x:f.x,y:f.y,lane:f.lane,assignedLane:f.assignedLane,targetId:f.targetId,attack:f.attack,attackSequence:f.attackSequence,combatReady:f.combatReady,gateEntering:f.gateEntering}))}:null;});
   if(!last)break;
   if(process.env.V100_BATTLE_MUSIC_CHECK==='1')result.lastReadableBattleSnapshot=last;
   if(guardianCheck){
    const guards=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__.getSnapshot();return s.fighters.filter(f=>f.kind==='guardian'&&f.hp>0&&f.manualAbility?.phase==='active').map(f=>({time:s.time,id:f.id,hp:f.hp,phase:f.manualAbility?.phase,activationId:f.manualAbility?.activationId,remaining:f.manualAbility.activeRemaining,pose:f.renderAudit?.spriteState,render:f.renderAudit,attack:f.attack,attackWindup:f.attackWindup,abilityWindup:f.abilityWindup,aiMoveDirection:f.aiMoveDirection,gateEntering:f.gateEntering,animationState:f.animationPresentation?.state}));});
    (result.guardSamples??=[]).push(...guards);
    if(guards.some(f=>f.remaining<5.5&&f.pose==='attack-a')&&!result.captures.includes('guard-brace'))await screenshot('guard-brace');
   }
   if(kumaGuardCheck){
    const guards=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__.getSnapshot();return s.fighters.filter(f=>f.kind==='kumaverson'&&f.hp>0).map(f=>({time:s.time,id:f.id,hp:f.hp,phase:f.manualAbility?.phase,activationId:f.manualAbility?.activationId,remaining:f.manualAbility?.activeRemaining,pose:f.renderAudit?.spriteState,render:f.renderAudit,attack:f.attack,attackWindup:f.attackWindup,abilityWindup:f.abilityWindup,aiMoveDirection:f.aiMoveDirection,flash:f.flash,gateEntering:f.gateEntering,animationState:f.animationPresentation?.state}));});
    (result.kumaGuardSamples??=[]).push(...guards);
   }
   if(process.env.V100_SAMPLING_CHECK==='1'){
    (result.samplingSamples??=[]).push(await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.getPerformanceSnapshot()));
    if(last.time>=20&&!result.samplingViewports){
     result.samplingViewports=[];
     for(const size of [{width:1280,height:720},{width:844,height:390},{width:844,height:340}]){
      await page.setViewportSize(size);await page.waitForTimeout(120);
      await screenshot('sampling-'+size.width+'x'+size.height);
      result.samplingViewports.push({size,performance:await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.getPerformanceSnapshot())});
     }
    }
   }
   if(contactCheck){
    (result.contactSamples??=[]).push(await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();return {time:s.time,receipts:s.manualAbilityReceipts.filter(e=>['brawler','scout','brute'].includes(e.kind)),fighters:s.fighters.filter(f=>f.kind==='brawler'||f.kind==='brute').map(f=>({id:f.id,kind:f.kind,x:f.x,y:f.y,hp:f.hp,manualAbility:f.manualAbility}))};}));
    // Spend ordinary command points on the two units whose native effects
    // this fixture observes, instead of adding a fifth rear-line copy first.
    if(!last.fighters.some(f=>f.kind==='brute'&&f.hp>0)&&await nativeBattleTap(page,page.locator('button.unit-card[data-kind="brute"]')))result.inputs.push({time:last.time,action:'deploy',kind:'brute',reason:'native ground-impact observation'});
   }
  if(process.env.V100_BATTLE_MUSIC_CHECK==='1'){
    const audio=await page.evaluate(()=>{const battle=window.__ASHFALL_AUDIO_QA__,shell=window.__V100_EVENT_AUDIO_QA__,diagnostics=battle?.getDiagnostics?.()??null,status=battle?.getAudioStatus?.()??null;return{audio:diagnostics?{activeBgm:diagnostics.activeBgm,duplicateLoopInstanceKeys:diagnostics.duplicateLoopInstanceKeys,contextState:diagnostics.contextState??status?.contextState??null,audioState:diagnostics.audioState??status?.state??null,unlocked:diagnostics.unlocked??null,activeBgmVoices:diagnostics.activeBgmVoices??0}:null,audioStatus:status,shellAudio:shell?.getDiagnostics?.()??null,cueRequests:battle?.getCueRequests?.()??[]};});
    (result.musicSamples??=[]).push({time:last.time,...audio});
   }
   const enemies=last.fighters.filter(f=>f.side==='zombie'&&f.hp>0);
   if((number===3||number===5)&&result.boss&&!result.bossDefeatedAt&&!enemies.some(f=>f.kind===(number===3?'takuya':'gate-eater'))&&last.time>result.boss.firstObservedTime)result.bossDefeatedAt=last.time;
   if(includeMayo){
    const boss=enemies.find(f=>f.kind==='gate-eater'||f.kind==='takuya');
    for(const mayo of last.fighters.filter(f=>f.kind==='mayo-chan'&&f.hp>0)){
     (result.mayoSamples??=[]).push({time:last.time,mayo,boss});
     if(boss&&mayo.targetId===boss.id&&mayo.lane!==boss.lane&&mayo.attack>0){
      (result.mayoFlankAttacks??=[]).push({time:last.time,mayo,boss});
      if(!result.captures.includes('mayo-flank'))await screenshot('mayo-flank');
     }
    }
   }
   if(!enemies.length&&last.time>20){emptySince??=last.time;maxEmpty=Math.max(maxEmpty,last.time-emptySince);}else emptySince=null;
   assert.equal(await page.locator('.manual-ability-label,.manual-ability-legend').count(),0);
   if(number===3||number===5){
    const bossKind=number===3?'takuya':'gate-eater';
    if(last.time<(number===3?37:39))assert.ok(!enemies.some(f=>f.kind===bossKind));
    if(enemies.some(f=>f.kind===bossKind)&&!result.boss){
     const hud=page.locator('.battle-message-stack .v100-boss-center');await hud.waitFor();
     const r=await hud.boundingBox();assert.ok(r&&r.x>viewport.width*.25&&r.x+r.width<viewport.width*.77&&r.y<80);
     await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.v100-boss-center')).opacity)>.99);
     assert.equal(await page.locator('.barrier-health').count(),0,'Boss combat uses one health focus, keeping its body clear');
     result.boss={firstObservedTime:last.time,rect:r};await screenshot('boss-arrival');
     for(const size of [{width:844,height:390},{width:1280,height:720},viewport]){
      await page.setViewportSize(size);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const rect=await hud.boundingBox();
      assert.ok(rect&&rect.x>size.width*.2&&rect.x+rect.width<size.width*.79&&rect.y>=0&&rect.y+rect.height<100);
      await screenshot('boss-hud-'+size.width+'x'+size.height);
     }
    }
   }
   for(const time of [20,45,75,105,135])if(last.time>=time&&!result.captures.includes(time+'s'))await screenshot(time+'s');
   if(last.over||!last.running)break;
   if(includeMayo&&enemies.some(f=>f.kind==='gate-eater'||f.kind==='takuya')&&!last.fighters.some(f=>f.kind==='mayo-chan'&&f.hp>0)){
    // Save command points for the observed unit instead of repeatedly spending
    // them on the helper's generic front-line replacement priority.
    if(await nativeBattleTap(page,page.locator('button.unit-card[data-kind="mayo-chan"]')))result.inputs.push({time:last.time,action:'deploy',kind:'mayo-chan',reason:'native boss-flank observation'});
    await page.waitForTimeout(350);continue;
   }
   if(kumaGuardCheck&&!result.kumaObservationComplete){
    const observation=await page.evaluate((trigger)=>{const s=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();const kuma=s?.fighters?.find(f=>f.kind==='kumaverson'&&f.side==='human'&&f.hp>0);const enemies=s?.fighters?.filter(f=>f.side==='zombie'&&f.hp>0)??[];const incoming=enemies.find(e=>e.targetId===kuma?.id&&e.attackWindup>0);const close=enemies.find(e=>e.targetId===kuma?.id&&(e.attackWindup>0||e.attack>0));const audit=window.__V100_METAL_QA__?.draws??[];const groups=new Map();for(const d of audit)if(d.contact?.ownerKind==='kumaverson'&&d.contact?.resolvedSocket===true){const frames=groups.get(d.contact.key)??new Set();frames.add(d.frame);groups.set(d.contact.key,frames);}const contact=[...groups].find(([,frames])=>frames.size>=3);const complete=trigger&&kuma&&trigger.activationId===kuma.manualAbility?.activationId&&['recovery','cooldown','ready'].includes(kuma.manualAbility?.phase);return{time:s?.time,kumaId:kuma?.id,incoming:incoming?{id:incoming.id,range:incoming.range,attackWindup:incoming.attackWindup}:null,close:close?{id:close.id,range:close.range,attack:close.attack,attackWindup:close.attackWindup}:null,contactKey:contact?.[0]??null,contactFrames:contact?[...contact[1]]:[],phase:kuma?.manualAbility?.phase,activationId:kuma?.manualAbility?.activationId,complete};},result.kumaObservationTrigger??null);
    if(observation?.contactKey&&observation.complete){result.kumaContactObserved=true;result.kumaObservationComplete=true;result.kumaContactEvidence={key:observation.contactKey,frames:observation.contactFrames};}
    else if(observation?.kumaId&&(observation.incoming||observation.close)&&!result.kumaObservationTrigger){
     const ability=page.locator('button.manual-ability-ready[data-fighter-id="'+observation.kumaId+'"][aria-disabled="false"]');
     if(await nativeBattleTap(page,ability)){result.inputs.push({time:observation.time,action:'ability',kind:'kumaverson',ownerId:observation.kumaId,reason:observation.incoming?'read-only incoming attack windup':'read-only target attack reach',triggerObservation:observation.incoming??observation.close});result.kumaObservationTrigger={activationId:(observation.activationId??0)+1};}
    }
    if(!result.kumaObservationComplete){await page.waitForTimeout(350);continue;}
   }
   await normalTacticalInput(page,result);await page.waitForTimeout(350);
  }
  result.last=last;result.maxEmptyAfter20Seconds=maxEmpty;
  if(process.env.V100_BATTLE_MUSIC_CHECK==='1'){
   await page.locator('[data-v100-surface="result-win"],[data-v100-surface="result-lose"]').waitFor();
   result.actualResult={won:await page.locator('[data-v100-surface="result-win"]').count()===1,loss:await page.locator('[data-v100-surface="result-lose"]').count()===1};
  }
  if(process.env.V100_BATTLE_MUSIC_CHECK==='1')result.finalRequestFailures=await page.evaluate(()=>window.__V100_MUSIC_FAILURE_OBSERVER__?.getFailureEvents?.()??null);
  if(process.env.V100_GUARDIAN_TRACE==='1')result.guardianTrace=await page.evaluate(()=>window.__V100_GUARDIAN_TRACE__);
  if(manualFirearmCheck){
   const {captures,...audit}=await page.evaluate(()=>window.__V100_MANUAL_FIREARM_QA__);result.manualFirearmAudit=audit;
   for(const [key,data]of Object.entries(captures))if(data.startsWith('data:'))await writeFile(out+'/s'+number+'-'+key+'.png',Buffer.from(data.split(',')[1],'base64'));
   for(const kind of ['ranger','babayaga','gunner'])for(const type of ['muzzle','contact'])assert.ok(audit.records.some(record=>record.kind===kind&&record.type===type),kind+' '+type+' must be drawn for a real manual skill receipt');
   for(const record of audit.records){assert.equal(record.alpha,1);assert.equal(record.composite,record.type==='muzzle'?'lighter':'source-over');assert.equal(record.shadowBlur,0);}
  }
  if(process.env.V100_METAL_CHECK==='1'||guardianCheck||kumaGuardCheck){
   await page.evaluate(()=>window.__V100_METAL_EXPORT_CAPTURES__());
   const {captures,...audit}=await page.evaluate(()=>window.__V100_METAL_QA__);result.metalAudit=audit;
   for(const [frame,data]of Object.entries(captures))if(data.startsWith('data:'))await writeFile(`${out}/s${number}-metal-frame-${frame}.png`,Buffer.from(data.split(',')[1],'base64'));
   assert.ok(audit.draws.length>0,'Real incoming attacks must emit metal contact during native guard use');
   const sequences=new Map();for(const draw of audit.draws)if(draw.contact){const frames=sequences.get(draw.contact.key)??new Set();frames.add(draw.frame);sequences.set(draw.contact.key,frames);}
   result.metalSequences=[...sequences].map(([key,frames])=>({key,frames:[...frames]}));
   // A valid burst can outlive its owner/guard. Such draws remain diagnostic;
   // acceptance requires three correctly timed frames of the same actual hit.
   assert.ok(result.metalSequences.some(s=>s.frames.length>=3),'One real incoming hit must produce at least three correctly phased metal frames beside its active owner');
   for(const d of audit.draws){assert.equal(d.alpha,1);assert.equal(d.composite,'source-over');assert.equal(d.shadowBlur,0);}
   if(guardianCheck||kumaGuardCheck){
    const samples=kumaGuardCheck?(result.kumaGuardSamples??[]):result.guardSamples;
    const settled=samples.filter(f=>f.phase==='active'&&f.remaining<5.9&&f.remaining>.1);
    assert.ok(settled.some(f=>f.remaining<2&&f.pose===(kumaGuardCheck?'guard':'attack-a')),'The guard must still hold its brace late in the six-second skill');
    const stationary=settled.filter(f=>f.render&&f.animationState!=='move'&&f.attack<=0&&f.attackWindup<=0&&f.abilityWindup<=0);
    assert.ok(stationary.length>0,'Observe actual stationary intervals during the guard');
    assert.ok(stationary.every(f=>(kumaGuardCheck?['guard','hit']:['attack-a','hit']).includes(f.pose)),'A stationary guard must keep its brace between real moves and attacks');
    const expectedOwnerKind=kumaGuardCheck?'kumaverson':'guardian';
    assert.ok(audit.draws.some(d=>d.contact?.ownerKind===expectedOwnerKind&&d.contact?.resolvedSocket&&d.owner?.render?.spriteState==='hit'),'Real guard contact must coincide with a resolved socket and authored impact reaction');
    if(kumaGuardCheck){
     assert.ok(samples.some(f=>(f.pose==='guard'||f.pose==='hit')&&f.render?.spritePath==='/art/v100/characters/kumaverson-guard-v1.png'&&f.render?.renderedPanSocket),'Kuma guard must expose the actual guard sprite path and pan socket');
      const isAction=f=>f.phase==='active'&&f.flash<=.04&&!f.gateEntering&&(f.animationState==='move'||f.attack>0||f.attackWindup>0||f.abilityWindup>0);
      const actionSamples=samples.filter(isAction);
      result.kumaUndrawnActionSamples=actionSamples.filter(f=>!f.render?.spritePath).length;
      const realActions=actionSamples.filter(f=>Boolean(f.render?.spritePath));
      assert.ok(realActions.length>0,'Kuma must show a real active movement or normal attack sample with an actual rendered frame');
      assert.ok(realActions.every(f=>f.render?.spritePath?.includes('/art/v060/')),'Kuma active movement/normal attacks must preserve the original atlas');
    }
   }
  }
  if(process.env.V100_CLAW_CHECK==='1'){
   const {captures,...audit}=await page.evaluate(()=>window.__V100_CLAW_QA__);result.clawAudit=audit;
   for(const [frame,data]of Object.entries(captures))if(data.startsWith('data:'))await writeFile(out+'/s'+number+'-claw-frame-'+frame+'.png',Buffer.from(data.split(',')[1],'base64'));
   const sequences=new Map();
   for(const draw of audit.draws)if(draw.contact){const frames=sequences.get(draw.contact.key)??new Set();frames.add(draw.frame);sequences.set(draw.contact.key,frames);}
   result.clawSequences=[...sequences].map(([key,frames])=>({key,frames:[...frames]}));
   assert.equal(audit.frames.filter(count=>count>0).length,6,'The native battle must draw all six authored claw frames');
   assert.ok(result.clawSequences.some(sequence=>sequence.frames.length>=3),'One applied hit must draw at least three correctly timed contact frames');
   for(const draw of audit.draws){assert.equal(draw.alpha,1);assert.equal(draw.composite,'source-over');assert.equal(draw.shadowBlur,0);}
  }
  if(process.env.V100_SAMPLING_CHECK==='1'){
   assert.equal(result.samplingViewports?.length,3,'Native rendering must cover all three required viewports');
   assert.ok(result.samplingSamples.some(s=>s.imageSamplingCache?.hits>s.imageSamplingCache?.builds&&s.imageSamplingCache.builds>0),'Actual battle rendering must reuse decoded half-size textures');
   for(const s of result.samplingSamples)assert.ok(s.imageSamplingCache.bytes<=s.imageSamplingCache.maxBytes,'Actual resident texture memory is bounded');
  }
  if(contactCheck){
   const {captures,...audit}=await page.evaluate(()=>window.__V100_CONTACT_QA__);result.contactAudit=audit;
   for(const [kind,data]of Object.entries(captures))if(data.startsWith('data:'))await writeFile(`${out}/s${number}-${kind}-canvas.png`,Buffer.from(data.split(',')[1],'base64'));
   assert.ok(audit.frames.contact.filter(n=>n>0).length>=4,'Actual contacts must show the authored sequence');
   assert.ok(audit.frames.ground.filter(n=>n>0).length>=4,'An ordinary Tatara skill tap must show the authored ground impact');
   for(const d of audit.draws){assert.equal(d.composite,'source-over');assert.equal(d.alpha,1);assert.equal(d.shadowBlur,0);}
   const combos=new Map();for(const hit of Object.values(audit.comboContacts??{})){const key=hit.ownerId+':'+hit.activationId;const sequence=combos.get(key)??[];sequence.push(hit);combos.set(key,sequence);}
   result.completeVisibleCombos=[...combos.values()].filter(sequence=>new Set(sequence.map(h=>h.index)).size===5);
   assert.ok(result.completeVisibleCombos.length,'At least one native combo must produce all five actual target-local contact bursts, not only timeline receipts');
  }
  if(process.env.V100_MUZZLE_CHECK==='1'){
   const {image,...audit}=await page.evaluate(()=>window.__V100_MUZZLE_QA__);
   result.muzzleAudit=audit;
   assert.ok(audit.draws.length>=6,'Native deployment and firing must draw the authored muzzle');
   assert.ok(audit.frameCounts.filter(n=>n>0).length>=4,'Native rendering must advance multiple muzzle frames');
   for(const draw of audit.draws){assert.equal(draw.composite,'lighter');assert.equal(draw.alpha,1);assert.equal(draw.shadowBlur,0);}
   assert.ok(image,'The expanded authored flash must be captured after normal rendering');
   await writeFile(out+'/s'+number+'-muzzle-canvas.png',Buffer.from(image.split(',')[1],'base64'));
  }
  if(process.env.V100_BATTLE_MUSIC_CHECK==='1'){
   assertNaturalBattleOutcome(result);
   assertBattleMusicGate(result);
  }
  assert.ok(last?.over||await page.locator('[data-v100-surface="result-win"],[data-v100-surface="result-lose"]').count(),'Battle must reach its natural result before bounded QA deadline');
  await page.locator('[data-v100-surface="result-win"],[data-v100-surface="result-lose"]').waitFor();
  result.won=process.env.V100_BATTLE_MUSIC_CHECK==='1'?result.actualResult.won:await page.locator('[data-v100-surface="result-win"]').count()===1;
  await screenshot('result');
  if(number===3||number===5)assert.ok(result.boss,'Actual boss arrival must be observed');
  if(includeMayo)assert.ok(result.mayoFlankAttacks?.length,'Mayo must actually attack a living boss from an adjacent physical lane');
  assert.deepEqual(result.errors,[]);result.status='observed';
 }catch(e){result.status='failed';result.error=String(e);result.failureSnapshot=await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.()).catch(()=>null);await screenshot('failure').catch(()=>{});}
 finally{await context.close();result.video=await page.video()?.path();await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({number,status:result.status,won:result.won,error:result.error}));}
}}finally{await browser.close();}
report.status=report.results.every(r=>r.status==='observed')?'observed':'failed';
await writeFile(out+'/report.json',JSON.stringify(report,null,2));
if(report.status==='failed')process.exitCode=1;
