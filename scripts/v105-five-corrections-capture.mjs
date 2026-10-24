import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {nativeGameCaptureBinding,withNativeGameCaseDeadline,closeNativeGameContext} from './v177-native-game-capture-browser.mjs';
import {pwaBrowserType,PWA_WEBKIT_RUNTIME} from './pwa-browser-runtime.mjs';
import {enterNativeAllUnitSurface} from './v177-native-allunit-browser.mjs';
import {seedV100BrowserSaveOnce,enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_UNITS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {MANUAL_ABILITY_REGISTRY as manual} from '../app/manualAbilities.js';
import {installRequestFailureAudit} from './browser-request-failure-audit.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function correctionCases(scope){
  assert.ok(['desktop','mobile390','mobile340'].includes(scope));
  if(scope!=='desktop')return [...['brawler','crazy-king','guardian','gunner','zakimiya','mrs-chiha'].map(kind=>({kind,mode:'manual'})),{kind:'brawler',mode:'duet'}];
  return [...Object.keys(manual).map(kind=>({kind,mode:'manual'})),
    ...['grappler','ooze','sprinter','gate-eater','spindle','resonator','cagewalker','choir-knot','pall-manta','anchor-bloom',
      'kurome','mother','ooguchi','gairen','mugarian-president-mutated','takuya-omega','takuya'].map(kind=>({kind,mode:'enemy'})),
    ...['brute','guardian','tky','takuya','takuya-omega','crazy-king','kumaverson','babayaga','brawler'].map(kind=>({kind,mode:'engage'}))];
}

// Original native AV stream, actual game mixer after limiter, original PTS.
// No microphone, clock override, animation sampling, re-encoding or FPS repair.
export async function startCorrectionRecording({ids,durationMs}){
  if(durationMs>15000)throw Error('Original15s capture limit');
  const q=window.__ASHFALL_BATTLE_QA__,audio=window.__ASHFALL_AUDIO_QA__;
  await audio.unlock();const tap=audio.createLocalRecordingTap();
  const canvas=document.querySelector('.game-shell canvas'),stream=canvas.captureStream(60);
  for(const track of tap.stream.getAudioTracks())stream.addTrack(track);
  const mime=['video/mp4','video/webm;codecs=vp8,opus'].find(type=>MediaRecorder.isTypeSupported(type));
  if(!mime){tap.release();stream.getTracks().forEach(t=>t.stop());throw Error('Native original AV encoding unavailable');}
  const state={rows:[],chunks:[],startAt:null,stopAt:null,failed:null,raf:null,bytes:0,
    mime,durationMs,initial:q.getV105CorrectionAudit(ids),clockOrigin:performance.timeOrigin};
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5000000,audioBitsPerSecond:128000});
  const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=e=>{state.failed=String(e.error??e);reject(Error(state.failed));};});
  void stopped.catch(()=>{});
  recorder.ondataavailable=e=>{if(e.data.size){state.bytes+=e.data.size;state.chunks.push(e.data);if(state.bytes>8388608)state.failed='Original8MiB limit exceeded';}};
  let startTimer;
  await Promise.race([new Promise(resolve=>{recorder.onstart=()=>{state.startAt=performance.now();resolve();};recorder.start(250);}),
    new Promise((_,reject)=>{startTimer=setTimeout(()=>reject(Error('Native start exceeded3s')),3000);})]).finally(()=>clearTimeout(startTimer));
  const observe=at=>{if(state.stopAt!==null)return;
    if(state.rows.length>=4096){state.failed='Original4096-frame receipt limit';return;}
    state.rows.push({at,enteredAt:performance.now(),...q.getV105CorrectionAudit(ids)});state.raf=requestAnimationFrame(observe);};
  state.raf=requestAnimationFrame(observe);
  const watchdog=setTimeout(()=>{state.failed??='Original15s real recorder deadline exceeded';
    state.stopAt??=performance.now();cancelAnimationFrame(state.raf);if(recorder.state!=='inactive')recorder.stop();},15000);
  window.__V105_RECORDING__={state,recorder,stopped,tap,stream,watchdog};
  return {mime,startAt:state.startAt,initial:state.initial};
}
export async function stopCorrectionRecording(){
  const owned=window.__V105_RECORDING__;if(!owned)throw Error('No owned AV recording');
  const {state,recorder,stopped,tap,stream,watchdog}=owned;let stopTimer;clearTimeout(watchdog);
  try{
    state.stopAt??=performance.now();cancelAnimationFrame(state.raf);
    if(state.stopAt-state.startAt>15000)state.failed??='Original15s actual capture bound exceeded';
    state.final=window.__ASHFALL_BATTLE_QA__.getV105CorrectionAudit(state.initial.fighters.map(f=>f.id));
    state.cues=window.__ASHFALL_AUDIO_QA__.getCueRequests();
    if(recorder.state!=='inactive')recorder.stop();await Promise.race([stopped,new Promise((_,reject)=>{stopTimer=setTimeout(()=>reject(Error('Native stop exceeded3s')),3000);})]);
    const blob=new Blob(state.chunks,{type:recorder.mimeType});
    const validBytes=blob.size>0&&blob.size<=8388608;
    if(!validBytes)state.failed??='Original encoded byte limit';
    const data=validBytes?await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split('base64,')[1]);reader.onerror=reject;reader.readAsDataURL(blob);}):'';
    const receipt={...state};delete receipt.chunks;
    return {data,...receipt,canvas:{width:document.querySelector('.game-shell canvas').width,height:document.querySelector('.game-shell canvas').height}};
  }finally{clearTimeout(stopTimer);tap.release();stream.getTracks().forEach(t=>t.stop());delete window.__V105_RECORDING__;}
}

export async function runBrowserQa(){
  const binding=await nativeGameCaptureBinding(),scope=process.env.V105_CAPTURE_SCOPE;
  const plan=correctionCases(scope),viewport=scope==='desktop'?{width:1280,height:720}:{width:844,height:scope==='mobile390'?390:340};
  const out=path.resolve(process.env.V105_CAPTURE_OUT??'outputs/v105-five-corrections/'+scope);await mkdir(out,{recursive:true});
  const report={...binding,architecture:process.arch,scope,viewport,runtime:PWA_WEBKIT_RUNTIME,cases:[],errors:[],status:'starting',
    acceptance:{physicalIphone:false,humanVisualAndListening:false,normalCampaign:false,wholeGame:false}};
  const persist=()=>writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  let browser,context,requests,primary;
  try{
    browser=await(await pwaBrowserType('webkit')).launch({headless:true});assert.equal(browser.version(),PWA_WEBKIT_RUNTIME.browserVersion);
    context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:viewport.width<1000,hasTouch:viewport.width<1000});
    const page=await context.newPage();page.setDefaultTimeout(30000);requests=installRequestFailureAudit(page);
    page.on('pageerror',e=>report.errors.push(e.stack??String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    page.on('response',r=>{if(r.status()>=400)report.errors.push(`${r.status()} ${r.url()}`);});
    const close=()=>closeNativeGameContext(context,requests);
    const owned=V100_UNITS.map(u=>u.id),base=createDefaultV100Save();
    const save=normalizeV100Save({...base,campaignStarted:true,revision:3,ownedUnitIds:owned,registeredUnitIds:owned,formationSlots:owned.slice(0,7),
      flowState:{phase:'formation',stageId:V100_STAGE_IDS[0],stageNumber:1,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
    await withNativeGameCaseDeadline(async()=>{
      await page.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(save));
      await page.goto(new URL('v100',process.env.V100_CAMPAIGN_QA_BASE_URL).href);await enterNativeAllUnitSurface(page);await enterV100FromTitle(page);
      await page.getByRole('button',{name:'戦闘へ',exact:true}).click();await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot().running);
      await page.evaluate(async()=>{await window.__ASHFALL_BATTLE_QA__.ensureUnitRenderProofAsset('guardian');await window.__ASHFALL_BATTLE_QA__.ensureEnemyFacingProofAsset('walker');});
    },close);
    for(const item of plan){
      const row={...item,status:'starting'};report.cases.push(row);await persist();
      await withNativeGameCaseDeadline(async()=>{
        const proof=await page.evaluate(async({kind,mode})=>{
          const q=window.__ASHFALL_BATTLE_QA__;
          await q.ensureEnemyFacingProofAsset(kind);
          const p=mode==='manual'||mode==='duet'?q.prepareManualAbilityProof(mode==='duet'?[kind,kind]:kind):q.prepareV177ContinuousActorProof({form:kind,phase:mode==='enemy'?'ability':'engage'});
          q.setEnemyVfxProofPaused(true);window.__ASHFALL_AUDIO_QA__.resetCueRequests();
          return {...p,trackedIds:q.getSnapshot().fighters.map(f=>f.id)};
        },item);row.proof=proof;
        const manualCase=['manual','duet'].includes(item.mode),ids=manualCase?proof.ownerIds:[proof.fighterId];
        await page.waitForFunction(ids=>ids.every(id=>window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(id).renderHistory.at(-1)?.jointDrawSucceeded),ids,{timeout:5000});
        const d=manual[item.kind],durationMs=manualCase?Math.ceil(Math.max(3,(d.windupSeconds??0)+(d.activeSeconds??d.guardSeconds??0)+(d.recoverySeconds??0)+1.2)*1000):item.mode==='enemy'?8000:6500;
        row.start=await page.evaluate(startCorrectionRecording,{ids:proof.trackedIds,durationMs});
        row.release=await page.evaluate(()=>{const q=window.__ASHFALL_BATTLE_QA__;q.setEnemyVfxProofPaused(false);
          return {at:performance.now(),time:q.getV105CorrectionAudit([]).time};});
        if(manualCase){
          for(const id of ids){const button=page.locator(`.manual-ability-ready[data-fighter-id="${id}"]`);
            if(viewport.width<1000)await button.tap({timeout:5000});else await button.click({timeout:5000});}
          row.input='actual enabled player buttons; once per owner';
        }
        await page.waitForTimeout(durationMs);
        const capture=await page.evaluate(stopCorrectionRecording),bytes=Buffer.from(capture.data,'base64');delete capture.data;
        const file=`${String(report.cases.length).padStart(2,'0')}-${item.kind}-${item.mode}.${capture.mime.startsWith('video/mp4')?'mp4':'webm'}`;
        await writeFile(path.join(out,file),bytes,{flag:'wx'});Object.assign(row,{file,sha256:sha(bytes),bytes:bytes.length,capture,status:'retained-pending-checks'});await persist();
        assert.equal(capture.failed,null);assert.ok(capture.rows.length>=30,'actual continuous paint receipts missing');
        const actual=(capture.final.time-row.release.time)*1000,wall=capture.stopAt-row.release.at;
        assert.ok(Math.abs(actual-wall)<=120,'Original120ms game/native clock bound');
        if(item.mode!=='engage'){
          const starts=capture.rows.flatMap(r=>r.abilityNames.starts).filter(r=>ids.includes(r.ownerId));
          assert.ok(ids.every(id=>starts.some(r=>r.ownerId===id)),'No accepted real ability start/name for an owner');
          assert.ok(capture.rows.some(r=>r.abilityNames.active.some(a=>ids.includes(a.ownerId)&&a.lastPaint)),'No actual name paint');
        }
        if(item.kind==='brawler'&&item.mode==='manual'){
          const receipts=capture.final.fistWave.receipts,launch=receipts.find(r=>r.type==='launch'),contact=receipts.find(r=>r.type==='contact');
          assert.ok(launch&&contact&&contact.at>launch.at,'Actual flight before collision required');
          assert.ok(capture.rows.some(r=>r.fistWave.waves.length),'No native flight frames');
          const victimId=contact.targetId,before=capture.initial.fighters.find(f=>f.id===victimId),after=capture.final.fighters.find(f=>f.id===victimId);
          assert.ok(before&&after&&Math.abs(before.hp-after.hp-manual.brawler.impactDamage)<.0001,'One real contact owns exactly the original total damage');
          assert.ok(capture.rows.filter(r=>r.time<contact.at).every(r=>r.fighters.find(f=>f.id===victimId)?.hp===before.hp),'No early old-combo damage');
        }
        if((item.kind==='brute'&&item.mode==='manual')||(item.kind==='takuya'&&item.mode==='enemy')){
          assert.ok(capture.rows.some(r=>r.fighters.some(f=>ids.includes(f.id)&&f.draw?.jointGroundStrike?.contactReady)),'No actual floor strike paint');
          assert.ok(capture.rows.some(r=>r.contacts.some(c=>ids.includes(c.ownerId)&&c.resolvedSocket)),'Ground impact must bind an actual painted weapon point');
        }
        row.status='recorded';
      },close,{onDeadline:e=>{row.deadlineExpired=true;row.error=String(e);}});
      console.log(scope,item.kind,item.mode,row.status);
    }
    report.status=report.errors.length?'failed':'recorded-awaiting-visual-and-pts-review';
  }catch(error){primary=error;report.errors.push(String(error));report.status='failed';
    const row=report.cases.at(-1);if(row&&row.status!=='recorded'){row.status='failed';row.error=String(error);}}
  finally{
    if(context)try{await closeNativeGameContext(context,requests);}catch(error){report.errors.push(String(error));}
    if(browser)try{await browser.close();}catch(error){report.errors.push('Browser cleanup: '+String(error));}
    report.requests=requests?.report??null;
    if(report.requests?.unexpectedFailures?.length)report.errors.push('Unexpected retained request failures');
    if(report.errors.length)report.status='failed';await persist();
  }
  if(primary)throw primary;assert.equal(report.errors.length,0,JSON.stringify(report.errors));
}
export async function main(){
  await nativeGameCaptureBinding();const original=process.argv[2],length=process.argv.length;
  process.argv[2]=fileURLToPath(import.meta.url);
  try{await import('./run-browser-qa-with-server.mjs');}finally{if(length<3)process.argv.length=length;else process.argv[2]=original;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error);process.exitCode=1;});
