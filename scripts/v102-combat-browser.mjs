import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spriteKinds,spriteFrameFor} from '../app/spriteManifest.js';
import {PLAYABLE_COMBAT_KINDS} from '../app/combatPresentation.js';
import {V100_UNITS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {pwaBrowserType} from './pwa-browser-runtime.mjs';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {installRequestFailureAudit} from './browser-request-failure-audit.mjs';

if(process.platform==='win32')throw new Error('Combat QA is hosted-only; local game, browser and audio playback are disabled');
const engine=process.env.V102_COMBAT_ENGINE??'chromium';
const origin=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));
const out=process.env.V102_COMBAT_OUT??`outputs/v102-combat-${engine}`;
await mkdir(out,{recursive:true});
const report={engine,build:await productionBuildIdentity(),scope:'All 48 authored render forms in paused developer fixtures, plus real simulation damage/corpse effects. Not physical iPhone recording or campaign difficulty acceptance.',cases:[],errors:[]};
const owned=V100_UNITS.map(u=>u.id),base=createDefaultV100Save();
const save=normalizeV100Save({...base,campaignStarted:true,revision:3,ownedUnitIds:owned,registeredUnitIds:owned,
  formationSlots:owned.slice(0,7),flowState:{phase:'formation',stageId:V100_STAGE_IDS[0],stageNumber:1,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
const browser=await(await pwaBrowserType(engine)).launch();
try{
  for(const [width,height]of [[1280,720],[844,390],[844,340]]){
    const context=await browser.newContext({viewport:{width,height},isMobile:width===844,hasTouch:true});
    const page=await context.newPage(),row={width,height,motion:[],gore:[]};report.cases.push(row);
    const requests=installRequestFailureAudit(page);
    page.on('pageerror',e=>report.errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
    try{
      await page.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(save));
      await page.goto(new URL('v100?qa=mission',origin).href);
      const play=page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true});
      await play.or(page.locator('.v100-start-screen')).first().waitFor();
      if(await play.isVisible())await play.click();
      await enterV100FromTitle(page);
      await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
      await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
      for(const kind of spriteKinds){
        const baseKind=kind==='mayo-chan-feral'?'mayo-chan':kind.startsWith('futago-separated-')?'futago':kind;
        const side=PLAYABLE_COMBAT_KINDS.includes(baseKind)?'human':'zombie';
        const proof=await page.evaluate(async({kind,baseKind,side})=>{
          const qa=window.__ASHFALL_BATTLE_QA__;
          await(side==='human'?qa.ensureUnitRenderProofAsset(kind):qa.ensureEnemyFacingProofAsset(kind));
          return qa.prepareAnimationFoundationProof(baseKind,side,kind);
        },{kind,baseKind,side});
        const samples=[];
        for(const action of ['move-right','move-left','wind-up','attack','recovery','hit-light','stop']){
          const previous=await page.evaluate(id=>window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(f=>f.id===id)?.renderAudit?.renderSequence??0,proof.fighterId);
          await page.evaluate(({id,action})=>window.__ASHFALL_BATTLE_QA__.stepAnimationFoundationProof(id,action,.06),{id:proof.fighterId,action});
          await page.waitForFunction(({id,previous})=>window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(f=>f.id===id)?.renderAudit?.renderSequence>previous,{id:proof.fighterId,previous});
          const sample=await page.evaluate(id=>window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(f=>f.id===id),proof.fighterId);
          const r=sample.renderAudit;
          assert.ok(r.assetReady&&r.renderWidth>0&&r.renderHeight>0,`${kind}/${action}: actual sprite renderer`);
          assert.ok(Number.isFinite(r.poseScaleX)&&Number.isFinite(r.poseScaleY),`${kind}/${action}: finite pose`);
          // Authored special guards and boss poses retain their own transforms.
          // The generic action adapter and all movement retain rigid anatomy.
          if(['move-right','move-left'].includes(action)){
            assert.equal(r.poseScaleX,1,`${kind}/${action}: horizontal anatomy`);
            assert.equal(r.poseScaleY,1,`${kind}/${action}: vertical anatomy`);
            assert.equal(r.direction,action==='move-right'?'right':'left');
          }
          const frame=spriteFrameFor(kind,r.spriteState,r.direction);
          samples.push({action,render:r,pixelScale:r.renderHeight/frame.sourceRect.h});
        }
        row.motion.push({kind,side,id:proof.fighterId,samples});
        if(['gunner','scout','crazy-king','spindle','takuya-omega','futago-separated-b'].includes(kind)){
          await page.screenshot({path:`${out}/${width}x${height}-${kind}.png`});
        }
      }
      assert.equal(row.motion.length,48);
      for(const kind of ['walker','crusher','spindle','red-panther-knife']){
        await page.evaluate(kind=>window.__ASHFALL_BATTLE_QA__.ensureEnemyFacingProofAsset(kind),kind);
        const proof=await page.evaluate(kind=>window.__ASHFALL_BATTLE_QA__.prepareEnemyFacingRuntimeProof({kind,phase:'die'}),kind);
        const id=proof.fighterId??proof.enemyId;
        assert.ok(Number.isFinite(id),JSON.stringify(proof));
        await page.waitForFunction(id=>window.__ASHFALL_BATTLE_QA__.getPhaseGCombatSnapshot().combatGore.wounds.some(w=>w.targetId===id&&w.lethal&&w.severed),id);
        const gore=await page.evaluate(id=>({effects:window.__ASHFALL_BATTLE_QA__.getPhaseGCombatSnapshot().combatGore,body:window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(id)}),id);
        assert.equal(gore.effects.impacts.filter(e=>e.targetId===id).length,1,'one actual damage receipt produces one spray');
        assert.ok(gore.body.corpse,'real defeat owns the severed body');
        await page.screenshot({path:`${out}/${width}x${height}-gore-${kind}.png`});
        row.gore.push({kind,id,...gore});
      }
      // Replacing the battlefield clears the old effects; merely returning to
      // an active actor cannot resurrect gore from a previous fixture.
      await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.prepareAnimationFoundationProof('scout','human'));
      const cleared=await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.getPhaseGCombatSnapshot().combatGore);
      assert.deepEqual(cleared,{impacts:[],pools:[],wounds:[],pending:false});
    }catch(error){
      await page.screenshot({path:`${out}/${width}x${height}-failure.png`}).catch(()=>{});
      throw error;
    }finally{
      await requests.closeContext(context);
      row.requests=requests.report;
      assert.deepEqual(requests.report.unexpectedFailures,[]);
    }
  }
  assert.deepEqual(report.errors,[]);
  report.status='pass';
}catch(error){report.status='failed';report.error=String(error);}
finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify({status:report.status,engine,error:report.error,cases:report.cases.map(r=>({viewport:`${r.width}x${r.height}`,forms:r.motion.length,gore:r.gore.length}))}));
if(report.status==='failed')process.exitCode=1;
