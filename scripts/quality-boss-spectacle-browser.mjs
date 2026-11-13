import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_BOSSES,V100_STAGE_IDS,V100_UNITS} from '../app/v100Registry.js';
import {seedV100BrowserSaveOnce,enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const out=path.resolve(process.env.QUALITY_BOSS_SPECTACLE_OUT);
await mkdir(out,{recursive:false});
const requested=(process.env.QUALITY_BOSS_SPECTACLE_KINDS??'mother,ooguchi,gairen,futago,mugarian-president-mutated,takuya-omega,takuya').split(',');
const base=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(['127.0.0.1','localhost'].includes(base.hostname));
const report={build:await productionBuildIdentity(),scope:'Prepared boss actors and committed telegraphs; normal simulation and real death pipeline after the existing local HP-boundary helper. Not natural progression, difficulty, listening or physical-device acceptance.',cases:[],errors:[]};
const browser=await chromium.launch({headless:true});
async function record(page){
 await page.evaluate(async()=>{
  const audio=window.__ASHFALL_AUDIO_QA__,tap=audio.createLocalRecordingTap(),video=document.querySelector('canvas').captureStream(30);
  audio.resetCueRequests();
  const recorder=new MediaRecorder(new MediaStream([...video.getVideoTracks(),...tap.stream.getAudioTracks()]),{mimeType:'video/webm;codecs=vp8,opus'});
  const r={tap,video,recorder,chunks:[],samples:[],active:true,error:null};
  recorder.ondataavailable=e=>{if(e.data.size)r.chunks.push(e.data);};recorder.onerror=e=>r.error=String(e.error);
  r.done=new Promise(resolve=>recorder.onstop=resolve);
  const started=new Promise(resolve=>recorder.onstart=resolve);
  window.__SPECTACLE_RECORDING__=r;recorder.start(250);await started;
  const tick=()=>{
   if(!r.active)return;
   const s=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
   if(s)r.samples.push({at:performance.now(),time:s.time,effects:s.battlePresentation?.effects??[],fighters:s.fighters.filter(f=>f.side==='zombie').map(f=>({id:f.id,kind:f.kind,x:f.x,y:f.y,hp:f.hp,phase:f.stationAbility?.phase}))});
   requestAnimationFrame(tick);
  };tick();
 });
}
async function finish(page,name){
 const data=await page.evaluate(async()=>{
  const r=window.__SPECTACLE_RECORDING__;r.active=false;r.recorder.stop();await r.done;
  const bytes=Array.from(new Uint8Array(await new Blob(r.chunks,{type:r.recorder.mimeType}).arrayBuffer()));
  r.tap.release();r.video.getTracks().forEach(t=>t.stop());
  return {bytes,samples:r.samples,error:r.error,cues:window.__ASHFALL_AUDIO_QA__?.getCueRequests?.()??[]};
 });
 const {bytes,...rest}=data,buffer=Buffer.from(bytes),file=path.join(out,name+'.webm');await writeFile(file,buffer);
 assert.ok((await readFile(file)).equals(buffer));assert.equal(rest.error,null);
 return {...rest,recording:{file,bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex')}};
}
try{
 for(const kind of requested){
  const boss=V100_BOSSES.find(b=>b.id==='boss-'+kind);assert.ok(boss,kind);
  const ids=V100_UNITS.map(u=>u.id),stageId=V100_STAGE_IDS[boss.stageNumber-1];
  const seed=normalizeV100Save({...createDefaultV100Save({settings:{bgmEnabled:false,sfxEnabled:true}}),campaignStarted:true,caps:2000,ownedUnitIds:ids,registeredUnitIds:ids,availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,boss.stageNumber-1),formationSlots:ids.slice(0,7),flowState:{phase:'formation',stageId,stageNumber:boss.stageNumber,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
  const row={kind,stageId,status:'running'};report.cases.push(row);
  const context=await browser.newContext({viewport:{width:844,height:340},hasTouch:true});
  await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(kind+':'+e));
  try{
   await page.goto(base.href);
   await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});
   await enterV100FromTitle(page);await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
   await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot().running&&window.__ASHFALL_AUDIO_QA__?.getDiagnostics().contextState==='running');
   row.setup=await page.evaluate(k=>window.__ASHFALL_BATTLE_QA__.prepareBossFoundationProof(k),kind);
   const proof=await page.evaluate(k=>window.__ASHFALL_BATTLE_QA__.getBossFoundationProof(k),kind);
   row.bossId=proof.bossId;
   await page.evaluate(id=>window.__ASHFALL_BATTLE_QA__.accelerateBossFoundationEntry(id),row.bossId);
   await page.waitForFunction(k=>window.__ASHFALL_BATTLE_QA__.getBossFoundationProof(k).combatReady,kind);
   if(kind!=='takuya'){
    await record(page);
    row.armed=await page.evaluate(({bossId,humanId})=>window.__ASHFALL_BATTLE_QA__.armBossFoundationTelegraph(bossId,humanId),{bossId:row.bossId,humanId:row.setup.humanId});
    await page.waitForFunction(k=>window.__ASHFALL_BATTLE_QA__.getBossFoundationProof(k).stationPhase==='active',kind);
    await page.waitForTimeout(180);await page.screenshot({path:path.join(out,kind+'-active.png')});
    await page.waitForFunction(k=>window.__ASHFALL_BATTLE_QA__.getBossFoundationProof(k).stationPhase==='recovery',kind);
    await page.waitForTimeout(150);await page.screenshot({path:path.join(out,kind+'-recovery.png')});
    row.attack=await finish(page,kind+'-attack');
    const phases=new Set(row.attack.samples.flatMap(s=>s.fighters.filter(f=>f.id===row.bossId).map(f=>f.phase)));
    assert.ok(phases.has('active')&&phases.has('recovery'),kind+' real active and recovery observed');
   }
   if(['takuya','takuya-omega'].includes(kind)){
    await record(page);
    row.deathBoundary=await page.evaluate(()=>window.__ASHFALL_BATTLE_QA__.defeatV100BossForObjectiveProof());
    assert.ok(row.deathBoundary?.hp>0,'existing proof crosses the live boss HP boundary');
    await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot().battlePresentation.effects.some(e=>e.kind==='boss-defeat'));
    await page.waitForTimeout(1250);await page.screenshot({path:path.join(out,kind+'-defeat.png')});
    await page.waitForTimeout(1550);row.defeat=await finish(page,kind+'-defeat');
    const effects=row.defeat.samples.flatMap(s=>s.effects.filter(e=>e.kind==='boss-defeat'));
    assert.ok(effects.length>0&&effects.every(e=>e.label===kind),kind+' semantic collapse uses the actual boss identity');
    assert.equal(new Set(effects.map(e=>e.receiptId)).size,1);
   }
   row.status='passed';
  }catch(error){row.status='failed';row.failure=String(error);row.body=await page.locator('body').innerText().catch(()=>null);await page.screenshot({path:path.join(out,kind+'-failure.png')}).catch(()=>{});throw error;}
  finally{await context.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=String(error);throw error;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({status:report.status,cases:report.cases.map(c=>({kind:c.kind,status:c.status}))}));
