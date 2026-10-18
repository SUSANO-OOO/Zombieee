import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {spriteKinds} from '../app/spriteManifest.js';
import {animationClipFor,PLAYABLE_COMBAT_KINDS} from '../app/combatPresentation.js';
import {V100_UNITS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {pwaBrowserType} from './pwa-browser-runtime.mjs';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {installRequestFailureAudit} from './browser-request-failure-audit.mjs';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
import {V177_CORPSE_JOINT_DATA} from '../app/v177CorpseJointData.js';
import {assertV177EnemyLiveRender,v177EnemyRuntimeRenderIdentity} from './v177-enemy-live-render-contract.mjs';
import {renderedSourcePixelScale} from './v102-render-source-scale.mjs';
import {V177_ADDITIONAL_CONTINUOUS_FORMS,assertV177AuthoredLiveRender,assertV177ContinuousFormCoverage,assertV177EngagementFormCoverage} from './v177-continuous-render-contract.mjs';
import {hasV177ContinuousDraw} from './v177-continuous-draw-readiness.mjs';
import {V177_NATIVE_ACTION_PLAN} from './v177-native-action-plan.mjs';
import {stepV177PaintedFoundationInput} from './v177-painted-foundation-input.mjs';
import {assertV177ReactionRender,assertV177ReactionCoverage,assertJointCorpsePaint} from './v177-reaction-render-contract.mjs';
import {createV177VideoFrameClock} from './v177-video-frame-clock.mjs';
import {beginV177NativeCanvasClip} from './v177-native-canvas-clips.mjs';
import {v177CombatViewports,closeV177CombatReport} from './v177-combat-workload.mjs';
import {prepareMayoEngagement,releaseReadyMayoForRecording,activateRecordedMayo,fenceRecordedMayoSample} from './v177-mayo-engagement-capture.mjs';

if(process.platform==='win32')throw new Error('Combat QA is hosted-only; local game, browser and audio playback are disabled');
const engine=process.env.V102_COMBAT_ENGINE??'chromium';
const viewportGroup=process.env.V102_COMBAT_VIEWPORT_GROUP??'all';
const requestedViewports=v177CombatViewports(viewportGroup);
const origin=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));
const out=process.env.V102_COMBAT_OUT??`outputs/v102-combat-${engine}`;
await mkdir(out,{recursive:true});
const report={engine,build:await productionBuildIdentity(),scope:'All 48 authored render forms in all 11 supported paused foundation inputs and continuous move/attack and approach-to-attack transitions at 844x340, plus an applied-damage outcome for every form at all three viewports. Each paused input uses a fresh fighter; non-deployment inputs first finish that fixture\'s initial deployment. Reaction fixtures queue one controlled incoming hit at original actor HP; normal damage/lifecycle produces the corpse or Mayo\'s dedicated retreat. No HP, corpse or retreat pose is fabricated. All movement/attack fixtures retain original actor stats and use an inert durable opponent at a controlled distance. Legacy fused twin art is an explicit art fixture, not a natural V1 encounter. These fixtures do not accept normal campaign tempo, all 21 animation states, original-speed naturalness, difficulty or physical recording.',pausedActions:V177_NATIVE_ACTION_PLAN.map(p=>p.action),cases:[],errors:[]};
const owned=V100_UNITS.map(u=>u.id),base=createDefaultV100Save();
report.viewportGroup=viewportGroup;report.requestedViewports=requestedViewports;
report.provenance={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),platform:process.platform};
report.scope=report.scope.replace('at all three viewports','at every viewport in the requested group; the two WebKit groups together cover all three viewports');
const save=normalizeV100Save({...base,campaignStarted:true,revision:3,ownedUnitIds:owned,registeredUnitIds:owned,
  formationSlots:owned.slice(0,7),flowState:{phase:'formation',stageId:V100_STAGE_IDS[0],stageNumber:1,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
const browser=await(await pwaBrowserType(engine)).launch();
const frameClocks=new WeakMap();
const canvasClips=new WeakMap();
async function captureContinuousSamples(page,proof,metadata){
  const mayo=proof.owner==='mayo-activation'&&metadata.form==='mayo-chan-feral'&&metadata.phase==='engage';
  if(mayo)proof.readyRelease=await releaseReadyMayoForRecording(page,proof);
  else await page.waitForFunction(hasV177ContinuousDraw,proof,{timeout:5_000});
  const owner=canvasClips.get(page),clip=owner?await beginV177NativeCanvasClip(page,{...metadata,fighterId:proof.fighterId,preparedRenderKind:mayo?'mayo-chan':proof.renderKind??metadata.form,v100TwinPart:proof.v100TwinPart??null,legacyFusedFixture:proof.legacyFusedFixture??false,...(mayo?{recordedActivationPrefix:true}:{})},owner):null;
  const clock=frameClocks.get(page);let section;
  const samples=[],sampleCount=proof.phase==='engage'?30:15;
  try{
  if(mayo)await activateRecordedMayo(page,proof,clip);
  section=clock?.beginSection({...metadata,fighterId:proof.fighterId,...(mayo?{feralBoundary:proof.arm}:{})});
  if(mayo)await page.waitForFunction(hasV177ContinuousDraw,proof,{timeout:5_000});
  for(let i=0;i<sampleCount;i++){
    await page.waitForTimeout(120);
    const sample=await page.evaluate(id=>{
      const qa=window.__ASHFALL_BATTLE_QA__,snapshot=qa.getSnapshot(),audit=qa.getEnemyFacingRuntimeAudit(id);
      return {at:performance.now(),simulationTime:snapshot.time,running:snapshot.running,paused:snapshot.paused,route:location.pathname,visible:document.visibilityState==='visible',fighter:audit.fighter,
        renders:audit.renderHistory.map(r=>({renderSequence:r.renderSequence,renderKind:r.renderKind,assetReady:r.assetReady,x:r.x,y:r.y,renderWidth:r.renderWidth,renderHeight:r.renderHeight,poseScaleX:r.poseScaleX,poseScaleY:r.poseScaleY,requestedState:r.requestedState,actualXDelta:r.actualXDelta,jointAtlasPath:r.jointAtlasPath,jointLowerFrame:r.jointLowerFrame,jointWeightedLowerDrawSucceeded:r.jointWeightedLowerDrawSucceeded,jointWeightedLower:r.jointWeightedLower,jointUpperFrame:r.jointUpperFrame,renderedWeaponSocket:r.renderedWeaponSocket}))};
    },proof.fighterId);
    samples.push(mayo?fenceRecordedMayoSample(sample,proof.captureBoundary):sample);
  }
  return samples;
  }finally{
    if(section)clock?.endSection(section,{completed:samples.length===sampleCount});
    if(clip)owner.receipts.push(await clip.finish({completed:samples.length===sampleCount}));
  }
}
try{
  for(const [width,height]of requestedViewports){
    const context=await browser.newContext({viewport:{width,height},isMobile:width===844,hasTouch:true,
      recordVideo:{dir:`${out}/videos`,size:{width,height}}});
    const page=await context.newPage(),row={width,height,motion:[],liveEnemyMotion:[],liveAdditionalMotion:[],liveEngagementMotion:[],nativeCanvasClips:[],gore:[],reactions:[]};report.cases.push(row);
    const frameClock=createV177VideoFrameClock(page,{engine,label:`${width}x${height}`});frameClocks.set(page,frameClock);
    if(width===844&&height===340)canvasClips.set(page,{directory:`${out}/native-canvas-clips`,engine,receipts:row.nativeCanvasClips});
    const requests=installRequestFailureAudit(page);
    page.on('pageerror',e=>report.errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
    try{
      await page.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(save));
      // Enter the actual V1 route. The generic qa=mission parameter selects
      // the legacy exhaustive asset plan, which excludes V1 assault objects.
      // The localhost bridge remains available without changing that plan.
      await page.goto(new URL('v100',origin).href);
      const play=page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true});
      await play.or(page.locator('.v100-start-screen')).first().waitFor();
      if(await play.isVisible())await play.click();
      await enterV100FromTitle(page);
      await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
      await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
      for(const kind of spriteKinds){
        const baseKind=kind==='mayo-chan-feral'?'mayo-chan':kind.startsWith('futago-separated-')?'futago':kind;
        const side=PLAYABLE_COMBAT_KINDS.includes(baseKind)?'human':'zombie';
        await page.evaluate(async({kind,side})=>{
          const qa=window.__ASHFALL_BATTLE_QA__;
          await(side==='human'?qa.ensureUnitRenderProofAsset(kind):qa.ensureEnemyFacingProofAsset(kind));
        },{kind,side});
        const samples=[];
        row.motion.push({kind,side,samples});
        for(const {action,expectedState,joint,attackOrigin} of V177_NATIVE_ACTION_PLAN){
          // Fresh fighters keep these states independent. Paint the initial
          // body before applying a hit so its actual last drawn rig is known.
          const proof=await page.evaluate(({kind,baseKind,side,expectedState,action})=>{
            const qa=window.__ASHFALL_BATTLE_QA__;
            const prepared=qa.prepareAnimationFoundationProof(baseKind,side,kind);
            if(expectedState!=='deploy')qa.stepAnimationFoundationProof(prepared.fighterId,'stop',.5);
            // This paused fixture owns one isolated action, not a timed turn.
            // Establish its left-facing start before its first actual paint;
            // live turning keeps the original unpaused stepping/foot guards.
            if(kind==='ranger'&&action==='move-left')qa.stepAnimationFoundationProof(prepared.fighterId,'move-left',.05);
            const previous=qa.getSnapshot().fighters.find(f=>f.id===prepared.fighterId)?.renderAudit?.renderSequence??0;
            return {...prepared,previous};
          },{kind,baseKind,side,expectedState,action});
          await page.waitForFunction(({fighterId,previous})=>{
            const r=window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(f=>f.id===fighterId)?.renderAudit;
            return r?.renderSequence>previous&&r.assetReady;
          },proof);
          const {previous,beforeRender}=await page.evaluate(stepV177PaintedFoundationInput,
            {fighterId:proof.fighterId,previous:proof.previous,action});
          proof.previous=previous;
          await page.waitForFunction(({fighterId,previous})=>window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(f=>f.id===fighterId)?.renderAudit?.renderSequence>previous,proof);
          const sample=await page.evaluate(id=>window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(f=>f.id===id),proof.fighterId);
          const r=sample.renderAudit;
          samples.push({action,fighterId:proof.fighterId,render:r,pixelScale:renderedSourcePixelScale(r),
            ...(action.startsWith('hit-')?{beforeRender}:{})});
          assert.ok(r.assetReady&&r.renderWidth>0&&r.renderHeight>0,`${kind}/${action}: actual sprite renderer`);
          assert.ok(Number.isFinite(r.poseScaleX)&&Number.isFinite(r.poseScaleY),`${kind}/${action}: finite pose`);
          if(expectedState)assert.equal(r.requestedState,expectedState,`${kind}/${action}: paint follows the requested action`);
          if(action.startsWith('hit-')){
            assert.equal(r.jointLowerFrame,beforeRender.jointLowerFrame,`${kind}/${action}: feet retain the last actually painted rig`);
            assert.equal(r.jointUpperFrame,beforeRender.jointUpperFrame,`${kind}/${action}: head, hands and weapon retain the last actually painted rig`);
          }
          if(V177_JOINT_ATLASES[kind]&&joint){
            assert.equal(r.jointAtlasPath,V177_JOINT_ATLASES[kind].path,`${kind}/${action}: actual joint draw connection`);
            assert.ok(Number.isInteger(r.jointLowerFrame)&&Number.isInteger(r.jointUpperFrame));
            if(attackOrigin)assert.ok(Number.isFinite(r.renderedWeaponSocket?.x)&&Number.isFinite(r.renderedWeaponSocket?.y),`${kind}/${action}: attack origin follows drawn weapon or mouth`);
          }
          // Authored special guards and boss poses retain their own transforms.
          // The generic action adapter and all movement retain rigid anatomy.
          if(['move-right','move-left'].includes(action)){
            assert.equal(r.poseScaleX,1,`${kind}/${action}: horizontal anatomy`);
            assert.equal(r.poseScaleY,1,`${kind}/${action}: vertical anatomy`);
            assert.equal(r.direction,action==='move-right'?'right':'left',`${kind}/${action}: movement facing`);
          }
          if(action==='attack'&&(V177_JOINT_ATLASES[kind]||['ranger','mayo-chan','gunner','scout','crazy-king','spindle','takuya-omega','futago-separated-b'].includes(kind))){
            await page.screenshot({path:`${out}/${width}x${height}-${kind}-attack.png`});
          }
        }
        const scale=samples[0].pixelScale;
        assert.ok(samples.every(s=>Math.abs(s.pixelScale-scale)<1e-8),`${kind}: ordinary movement, attack and hit keep one source-pixel scale`);
        if(V177_JOINT_ATLASES[kind]||['ranger','mayo-chan','gunner','scout','crazy-king','spindle','takuya-omega','futago-separated-b'].includes(kind)){
          await page.screenshot({path:`${out}/${width}x${height}-${kind}.png`});
        }
      }
      assert.equal(row.motion.length,48);
      if(width===844&&height===340){
        const enemies=spriteKinds.filter(kind=>!PLAYABLE_COMBAT_KINDS.includes(kind)&&kind!=='mayo-chan-feral'&&!kind.startsWith('futago-separated-'));
        assert.equal(enemies.length,29,'all base enemy kinds need V1 live coverage');
        for(const kind of enemies){
          await page.evaluate(kind=>window.__ASHFALL_BATTLE_QA__.ensureEnemyFacingProofAsset(kind),kind);
          for(const phase of ['move','attack']){
            const proof=await page.evaluate(({kind,phase})=>window.__ASHFALL_BATTLE_QA__.prepareV177ContinuousActorProof({form:kind==='futago'?'futago-separated-a':kind,phase}),{kind,phase});
            const evidence={kind,phase,proof,...v177EnemyRuntimeRenderIdentity(proof),samples:[],status:'pending'};row.liveEnemyMotion.push(evidence);
            try{
              evidence.samples=await captureContinuousSamples(page,proof,{form:evidence.renderKind,requestedKind:kind,phase,fixtureGroup:'base-enemy'});
              if(kind==='futago'){
                const panel=page.locator('.boss-hud.v100-boss-center');assert.equal(await panel.count(),1);
                evidence.compactBossHud=await panel.evaluate(element=>{
                  const r=element.getBoundingClientRect();return {at:performance.now(),rect:{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom},text:element.innerText,
                    twinLabels:[...element.querySelectorAll('.boss-twin-hp [data-twin-part]')].map(t=>({part:t.getAttribute('data-twin-part'),text:t.innerText}))};
                });
              }
              evidence.summary=assertV177EnemyLiveRender({...evidence,fighterId:proof.fighterId});evidence.status='passed';
              await page.screenshot({path:`${out}/${width}x${height}-${kind}-live-${phase}.png`});
            }catch(error){evidence.status='failed';evidence.error=String(error);throw error;}
            finally{await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(true));}
          }
        }
        assert.equal(row.liveEnemyMotion.length,58);
        for(const form of V177_ADDITIONAL_CONTINUOUS_FORMS)for(const phase of ['move','attack']){
          const proof=await page.evaluate(({form,phase})=>window.__ASHFALL_BATTLE_QA__.prepareV177ContinuousActorProof({form,phase}),{form,phase});
          const evidence={form,phase,proof,samples:[],status:'pending'};row.liveAdditionalMotion.push(evidence);
          try{
            evidence.samples=await captureContinuousSamples(page,proof,{form,phase,fixtureGroup:'authored-form'});
            evidence.summary=assertV177AuthoredLiveRender(evidence);evidence.status='passed';
            await page.screenshot({path:`${out}/${width}x${height}-${form}-continuous-${phase}.png`});
          }catch(error){evidence.status='failed';evidence.error=String(error);throw error;}
          finally{await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(true));}
        }
        row.continuousCoverage=assertV177ContinuousFormCoverage(row.liveEnemyMotion,row.liveAdditionalMotion);
        for(const form of spriteKinds){
          const phase='engage',proof=form==='mayo-chan-feral'?await prepareMayoEngagement(page)
            :await page.evaluate(form=>window.__ASHFALL_BATTLE_QA__.prepareV177ContinuousActorProof({form,phase:'engage'}),form);
          const evidence={form,phase,proof,samples:[],status:'pending'};row.liveEngagementMotion.push(evidence);
          try{
            evidence.samples=await captureContinuousSamples(page,proof,{form,phase,fixtureGroup:'approach-to-attack'});
            evidence.summary=assertV177AuthoredLiveRender(evidence);evidence.status='passed';
            await page.screenshot({path:`${out}/${width}x${height}-${form}-continuous-engage.png`});
          }catch(error){evidence.status='failed';evidence.error=String(error);throw error;}
          finally{await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(true));}
        }
        row.engagementCoverage=assertV177EngagementFormCoverage(row.liveEngagementMotion);
      }
      for(const kind of ['walker','crusher','spindle','red-panther-knife',...Object.keys(V177_CORPSE_JOINT_DATA)]){
        await page.evaluate(kind=>window.__ASHFALL_BATTLE_QA__.ensureEnemyFacingProofAsset(kind),kind);
        const proof=await page.evaluate(({kind,jointCut})=>{
          const qa=window.__ASHFALL_BATTLE_QA__;
          const proof=jointCut
            ? qa.prepareV177ContinuousActorProof({form:kind,phase:'defeat',sourceKind:'tky'})
            : qa.prepareEnemyFacingRuntimeProof({kind,phase:'die'});
          // A delayed frame can advance the 80ms hit before the first paint.
          // Hold the existing fixture until its living body is actually drawn.
          qa.setEnemyVfxProofPaused(true);
          return proof;
        },{kind,jointCut:Boolean(V177_CORPSE_JOINT_DATA[kind])});
        const id=proof.fighterId??proof.enemyId;
        assert.ok(Number.isFinite(id),JSON.stringify(proof));
        await page.waitForFunction(id=>{const a=window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(id);return a.fighter?.hp>0&&a.renderHistory.length>0;},id);
        const liveBeforeDamage=await page.evaluate(id=>window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(id),id);
        assert.equal(liveBeforeDamage.fighter.hp,proof.originalActorStats?.hp??proof.initial.enemyHp,'the living paint precedes any applied damage');
        await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(false));
        await page.waitForFunction(id=>{const qa=window.__ASHFALL_BATTLE_QA__;return qa.getPhaseGCombatSnapshot().combatGore.wounds.some(w=>w.targetId===id&&w.lethal&&w.severed)&&qa.getEnemyFacingRuntimeAudit(id).corpseRenderHistory.length>0;},id);
        const gore=await page.evaluate(id=>({effects:window.__ASHFALL_BATTLE_QA__.getPhaseGCombatSnapshot().combatGore,body:window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(id)}),id);
        row.gore.push({kind,id,proof,liveBeforeDamage,...gore});
        assert.equal(gore.effects.impacts.filter(e=>e.targetId===id).length,1,'one actual damage receipt produces one spray');
        assert.ok(gore.body.corpse,'real defeat owns the severed body');
        const live=gore.body.renderHistory.at(-1),dead=gore.body.corpseRenderHistory.at(-1);
        assert.ok(live&&dead,'live and dead bodies must both have actual paint receipts');
        assert.ok(Math.abs(renderedSourcePixelScale(live)-renderedSourcePixelScale(dead))<1e-8,`${kind}: defeat keeps the same source-pixel scale`);
        await page.screenshot({path:`${out}/${width}x${height}-gore-${kind}.png`});
        if(V177_CORPSE_JOINT_DATA[kind]){
          assert.equal(proof.incomingHit.weapon,'tky');
          assert.equal(gore.effects.wounds.find(w=>w.targetId===id)?.style,'cut');
          await page.waitForFunction(id=>{
            const qa=window.__ASHFALL_BATTLE_QA__,a=qa.getEnemyFacingRuntimeAudit(id),rows=a.corpseRenderHistory.slice(-3);
            const ready=rows.length===3&&rows.every(r=>r.corpseJointPose&&r.fallProgress===1
              &&r.corpseJointOwnedParts?.length&&Number.isFinite(r.corpseJointFragmentGroundError)&&Math.abs(r.corpseJointFragmentGroundError)<1e-8);
            if(ready)qa.setEnemyVfxProofPaused(true);return ready;
          },id);
          const late=await page.evaluate(id=>({effects:window.__ASHFALL_BATTLE_QA__.getPhaseGCombatSnapshot().combatGore,
            body:window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(id)}),id);
          for(const receipt of late.body.corpseRenderHistory.slice(-3))assertJointCorpsePaint(kind,receipt,late.body.corpse,
            late.effects.wounds.find(w=>w.targetId===id),true);
          row.gore.at(-1).late=late;
          await page.screenshot({path:`${out}/${width}x${height}-gore-${kind}-settled.png`});
        }
      }
      assert.equal(row.gore.length,4+Object.keys(V177_CORPSE_JOINT_DATA).length);
      for(const form of spriteKinds){
        const proof=await page.evaluate(form=>window.__ASHFALL_BATTLE_QA__.prepareV177ContinuousActorProof({form,phase:'defeat'}),form);
        const evidence={form,proof,status:'pending'};row.reactions.push(evidence);
        const observe=()=>page.evaluate(id=>{
          const qa=window.__ASHFALL_BATTLE_QA__,s=qa.getSnapshot(),combat=qa.getPhaseGCombatSnapshot();
          return {at:performance.now(),simulationTime:s.time,running:s.running,paused:s.paused,
            route:location.pathname,visible:document.visibilityState==='visible',
            body:qa.getEnemyFacingRuntimeAudit(id),effects:combat.combatGore,receipts:combat.manualAbilityReceipts};
        },proof.fighterId);
        try{
          // The pending incoming hit stays held until this exact living body
          // has a native paint. No direct HP, corpse or retreat-pose injection.
          await page.waitForFunction(id=>{
            const a=window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(id);
            return a.fighter?.hp>0&&a.renderHistory.length>0;
          },proof.fighterId);
          evidence.before=await observe();
          await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(false));
          await page.waitForFunction(({fighterId,outcome,initial})=>{
            const qa=window.__ASHFALL_BATTLE_QA__,a=qa.getEnemyFacingRuntimeAudit(fighterId);
            const ready=outcome==='retreat'
              ? a.fighter?.mayoRetreat?.phase==='run'&&a.fighter.x<initial.actorX-20
                &&a.renderHistory.filter(r=>r.requestedState==='retreat').length>=2
              : a.corpse&&a.corpseRenderHistory.length>=3;
            if(ready)qa.setEnemyVfxProofPaused(true);
            return Boolean(ready);
          },proof);
          evidence.after=await observe();
          await page.screenshot({path:`${out}/${width}x${height}-reaction-${form}.png`});
          await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(false));
          await page.waitForFunction(({fighterId,outcome,deathSeconds})=>{
            const qa=window.__ASHFALL_BATTLE_QA__,a=qa.getEnemyFacingRuntimeAudit(fighterId);
            const settled=a.corpseRenderHistory.slice(-3);
            const completed=qa.getPhaseGCombatSnapshot().manualAbilityReceipts?.some(r=>r.ownerId===fighterId&&r.eventType==='retreat-complete');
            const ready=outcome==='retreat'
              ? !a.fighter&&!a.corpse&&completed
              : a.corpse?.deathAge>=deathSeconds&&settled.length===3&&settled.every(r=>r.fallProgress===1
                &&(!r.corpseJointOwnedParts?.length || r.corpseJointPose
                  &&Number.isFinite(r.corpseJointFragmentGroundError)&&Math.abs(r.corpseJointFragmentGroundError)<1e-8));
            if(ready)qa.setEnemyVfxProofPaused(true);
            return Boolean(ready);
          },{fighterId:proof.fighterId,outcome:proof.outcome,deathSeconds:animationClipFor(form,'death').durationSeconds});
          evidence.late=await observe();
          evidence.summary=assertV177ReactionRender(evidence);evidence.status='passed';
          await page.screenshot({path:`${out}/${width}x${height}-reaction-settled-${form}.png`});
        }catch(error){evidence.status='failed';evidence.error=String(error);throw error;}
        finally{await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.setEnemyVfxProofPaused(true));}
      }
      row.reactionCoverage=assertV177ReactionCoverage(row.reactions);
      // Replacing the battlefield clears the old effects; merely returning to
      // an active actor cannot resurrect gore from a previous fixture.
      await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.prepareAnimationFoundationProof('scout','human'));
      const cleared=await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.getPhaseGCombatSnapshot().combatGore);
      assert.deepEqual(cleared,{impacts:[],pools:[],wounds:[],pending:false});
    }catch(error){
      await page.screenshot({path:`${out}/${width}x${height}-failure.png`}).catch(()=>{});
      throw error;
    }finally{
      const video=page.video();
      await requests.closeContext(context);
      row.videoClock=await frameClock.finish({file:`${out}/${width}x${height}-video-clock.json`,videoPath:video?await video.path():null});
      row.requests=requests.report;
      assert.deepEqual(requests.report.unexpectedFailures,[]);
    }
  }
  assert.deepEqual(report.errors,[]);
  assert.deepEqual(report.cases.map(row=>[row.width,row.height]),requestedViewports);
  report.status='pass';
}catch(error){report.status='failed';report.error=String(error);}
finally{await closeV177CombatReport(report,()=>browser.close(),()=>writeFile(`${out}/report.json`,JSON.stringify(report,null,2)));}
console.log(JSON.stringify({status:report.status,engine,error:report.error??report.cleanupError,cases:report.cases.map(r=>({viewport:`${r.width}x${r.height}`,forms:r.motion.length,liveEnemyPhases:r.liveEnemyMotion.length,gore:r.gore.length,reactions:r.reactions.length}))}));
if(report.status==='failed')process.exitCode=1;
