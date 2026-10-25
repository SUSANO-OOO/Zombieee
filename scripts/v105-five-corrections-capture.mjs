import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import {nativeEncodedTimeline,NATIVE_ENCODED_LIMITS} from './v177-native-encoded-clips.mjs';
import {nativeGameCaptureBinding,withNativeGameCaseDeadline,closeNativeGameContext} from './v177-native-game-capture-browser.mjs';
import {nativeRecordingBrowserType,NATIVE_RECORDING_WEBKIT_RUNTIME} from './v177-native-allunit-recording-runtime.mjs';
import {enterNativeAllUnitSurface,waitForNativeCaptureAudio} from './v177-native-allunit-browser.mjs';
import {seedV100BrowserSaveOnce,enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_UNITS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {MANUAL_ABILITY_REGISTRY as manual} from '../app/manualAbilities.js';
import {installRequestFailureAudit} from './browser-request-failure-audit.mjs';
import {nativeCaseSelection} from './v177-native-allunit-selection.mjs';
import {validateCapturePreparationRecord,correctionPreparationNeeded} from './v100-macos-indexing-control.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function correctionCases(scope){
  assert.ok(['desktop','mobile390','mobile340'].includes(scope));
  if(scope!=='desktop')return [...['brawler','crazy-king','guardian','gunner','zakimiya','mrs-chiha'].map(kind=>({kind,mode:'manual'})),{kind:'brawler',mode:'duet'}];
  return [...Object.keys(manual).map(kind=>({kind,mode:'manual'})),
    ...['grappler','ooze','sprinter','gate-eater','spindle','resonator','cagewalker','choir-knot','pall-manta','anchor-bloom',
      'kurome','mother','ooguchi','gairen','mugarian-president-mutated','takuya-omega','takuya'].map(kind=>({kind,mode:'enemy'})),
    ...['brute','guardian','tky','takuya','takuya-omega','crazy-king','kumaverson','babayaga','brawler'].map(kind=>({kind,mode:'engage'}))];
}

// Reuse is limited by the same exact-source guard as the original motion
// inventory. Unknown revisions run the whole original plan. Earlier failures
// and the boss whose name changed remain fresh observations, never old passes.
export async function correctionCaseSelection(scope,{event,root=process.cwd(),select=nativeCaseSelection}={}){
  const plan=correctionCases(scope),full={mode:'full',plan,retained:[]};
  const selection=select({event,root});if(selection.mode!=='remaining')return full;
  const profile=JSON.parse(await readFile(path.join(root,'scripts/v177-native-allunit-recovery.json'),'utf8'));
  const source=profile.fiveCorrections;if(!source)return full;
  const bytes=await readFile(path.join(root,source.file));assert.equal(sha(bytes),source.sha256);
  const inventory=JSON.parse(bytes),all=['desktop','mobile390','mobile340'].flatMap(s=>correctionCases(s).map(r=>s+':'+r.kind+':'+r.mode));
  assert.equal(inventory.head,source.head);assert.equal(inventory.runId,source.runId);
  assert.equal(inventory.schema,'v105-five-corrections-retained/v1');
  assert.deepEqual([...new Set(inventory.reports.map(r=>r.scope))].sort(),['desktop','mobile340','mobile390']);
  assert.equal(new Set(inventory.reports.map(r=>r.head+':'+r.runId+':'+r.scope)).size,inventory.reports.length,
    'One report identity per original candidate and scope');
  const kept=inventory.retained.map(r=>r.caseId),pending=inventory.pending;
  assert.deepEqual([...kept,...pending].sort(),[...all].sort(),'All original correction cases need one owner or a fresh recording');
  assert.equal(new Set([...kept,...pending]).size,all.length);
  for(const row of inventory.retained){
    const report=inventory.reports.find(r=>r.scope===row.caseId.split(':')[0] && r.head===row.head && r.runId===row.runId);
    assert.ok(report&&report.head===row.head&&report.runId===row.runId&&report.reportSha256===row.reportSha256
      &&report.artifactId===row.artifactId,'Retained AV must belong to its original scope report');
    assert.match(row.reportSha256,/^[a-f0-9]{64}$/u);assert.match(row.clipSha256,/^[a-f0-9]{64}$/u);
    assert.ok(Number.isSafeInteger(row.artifactId)&&row.artifactId>0&&row.bytes>0&&row.bytes<=8388608);
    assert.equal(row.originalStatus,'recorded');assert.equal(row.encodedPtsVerified,true);
    assert.equal(row.fullAvDecode.completed,true);assert.equal(row.fullAvDecode.requiredMixerAudioStream,true);assert.equal(row.fullAvDecode.errors,0);
    assert.ok(Number.isFinite(row.driftMs)&&Math.abs(row.driftMs)<=120);
    assert.ok(Number.isFinite(row.maxGapMs)&&row.maxGapMs<=250&&row.maxGapMs>0);
    assert.ok(Number.isFinite(row.caseElapsedMs)&&row.caseElapsedMs<30000);
  }
  return{mode:'remaining',source:{file:source.file,sha256:source.sha256,head:inventory.head,runId:inventory.runId},
    plan:plan.filter(r=>pending.includes(scope+':'+r.kind+':'+r.mode)),retained:inventory.retained.filter(r=>r.caseId.startsWith(scope+':'))};
}

// Every independent fixture owns its page and native recorder resources.
// Cold entry, capture, decode and cleanup share the existing30s case budget.
export async function withCorrectionCaseContext(browser,options,operation,{onFatal=()=>{},onRequests=()=>{},onDeadline=()=>{},
  audit=installRequestFailureAudit,deadline=withNativeGameCaseDeadline,closeContext=closeNativeGameContext}={}){
  let context,page,requests,closing,expired=false,primary,cleanupReported=false;
  const close=()=>{
    if(!context)return;
    return closing??=(async()=>{
      const pageClosedBeforeCleanup=page?.isClosed()??true;let completed=false;
      try{await closeContext(context,requests);completed=true;}
      finally{if(requests){onRequests({audit:requests.report,pageClosedBeforeCleanup,completed});
        assert.equal(requests.report.unexpectedFailures.length,0,'Unexpected case request failure');}}
    })();
  };
  const active=()=>{if(expired)throw Error('Late correction case cannot resume after its original deadline');};
  const cleanup=async()=>{try{await close();}catch(error){if(!primary)throw error;
    primary.cleanupError=String(error);if(!cleanupReported){cleanupReported=true;onFatal('Case cleanup: '+String(error));}}};
  try{return await deadline(async()=>{try{
    context=await browser.newContext(options);active();page=await context.newPage();active();page.setDefaultTimeout(30000);
    requests=audit(page);
    page.on('pageerror',e=>onFatal(e.stack??String(e)));page.on('console',m=>{if(m.type()==='error')onFatal(m.text());});
    page.on('response',r=>{if(r.status()>=400)onFatal(`${r.status()} ${r.url()}`);});
    return await operation(page);
  }catch(error){primary??=error;throw error;}finally{await cleanup();}
  },close,{onDeadline:error=>{expired=true;primary??=error;onDeadline(error);}});}
  catch(error){primary=error;throw error;}
  finally{await cleanup();}
}
export function canContinueCompletedCorrection(row,{pageClosed,fatalErrors=0,errorsBefore,errorsAfter}){
  return fatalErrors===0&&!row.deadlineExpired&&!pageClosed&&row.bytes>0&&typeof row.file==='string'
    &&row.capture?.failed===null&&Number.isFinite(row.capture.startAt)&&Number.isFinite(row.capture.stopAt)
    &&row.capture.stopAt>row.capture.startAt&&errorsAfter===errorsBefore+1;
}
export function assertCorrectionCaseDeadline(row,startedAt,now=performance.now()){
  row.caseElapsedMs=now-startedAt;
  assert.ok(Number.isFinite(row.caseElapsedMs)&&row.caseElapsedMs>=0,'Actual case clock required');
  // Synchronous native demux/decode must never outrun the original timer and
  // then cancel it as success. A late case stops the loop and owns cleanup.
  if(row.deadlineExpired||row.caseElapsedMs>=30000){
    row.deadlineExpired=true;throw Error('Native game case exceeded its30s owned operation deadline');
  }
}
export function completeCorrectionCase(row,startedAt,{fatalErrors,now=performance.now()}){
  assertCorrectionCaseDeadline(row,startedAt,now);
  assert.equal(row.status,'verified-awaiting-owned-cleanup');
  assert.equal(row.context?.completed,true);assert.equal(row.context?.pageClosedBeforeCleanup,false);
  assert.equal(fatalErrors,0,'A product/page error during cleanup invalidated the fixture');
  row.status='recorded';
}
export function assertCurrentCorrectionPaints(capture,ownerIds,atlasPaths){
  const seen=new Set(),owners=new Set();
  for(const row of capture.rows)for(const owner of row.fighters){
    if(!ownerIds.includes(owner.id)||!(owner.hp>0))continue;
    const d=owner.draw,key=owner.id+':'+d?.renderSequence;if(seen.has(key))continue;seen.add(key);
    assert.ok(d?.jointDrawSucceeded,`${owner.kind} missing current-model paint at ${row.time}`);
    assert.ok(d.renderKind===owner.kind||owner.kind==='mayo-chan'&&d.renderKind==='mayo-chan-feral',`${owner.kind} unexpected body ${d.renderKind}`);
    assert.ok(atlasPaths[d.renderKind]&&d.jointAtlasPath===atlasPaths[d.renderKind],`${owner.kind} used an unexpected atlas at ${row.time}`);
    owners.add(owner.id);
  }
  assert.ok(ownerIds.every(id=>owners.has(id)),'Every original owner must actually paint its current body');
  return {actualDistinctOwnerPaints:seen.size,ownerCount:owners.size};
}

export function assertMayoCorrectionRetreat(capture,ownerIds){
  const phases=new Set(),seen=new Set();
  for(const row of capture.rows)for(const owner of row.fighters){
    const draw=owner.draw,painted=draw?.mayoRetreatAtPaint,key=owner.id+':'+draw?.renderSequence;
    if(!ownerIds.includes(owner.id)||!painted||seen.has(key))continue;
    seen.add(key);const phase=painted.phase;phases.add(phase);
    assert.equal(owner.draw?.jointDrawSucceeded,true,'Retreat keeps the current articulated body');
    assert.equal(owner.draw.renderKind,'mayo-chan-feral','The completed ability keeps its feral form throughout retreat');
    if(phase==='fall'||phase==='rise'){
      const pose=owner.draw.jointMayoRetreat;
      assert.equal(pose?.phase,phase);assert.equal(pose?.sourceAtlas,owner.draw.jointAtlasPath);
      assert.equal(pose?.elapsed,painted.phaseElapsed);
    }
  }
  assert.deepEqual([...phases],['fall','rise','run'],'Observe the real protected fall, rise and return run');
  for(const id of ownerIds){
    assert.ok(!capture.final.fighters.some(f=>f.id===id),'Continue through actual withdrawal, not a truncated run');
    const receipt=capture.final.retreatCompletions.find(r=>r.ownerId===id&&r.mode==='ability');
    assert.ok(receipt,'The real gameplay must complete the protected withdrawal');
    assert.equal(receipt.x,receipt.baseX);
  }
  return {phases:[...phases],completedOwnerIds:[...ownerIds]};
}

// Verify the retained native bytes, never repair or replace their timeline.
// The limits and decoder contract are the existing all-unit native contract.
export async function auditCorrectionEncodedClip(file,capture,{execute=spawnSync,ffmpegPath=ffmpeg.path}={}){
  const result={failures:[],thresholdRelaxed:false,retimed:false,reencoded:false};
  const run=args=>{
    const r=execute(ffmpegPath,args,{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024,timeout:5000});
    assert.equal(r.error,undefined,String(r.error));assert.equal(r.status,0,r.stderr);
    assert.equal(r.stderr.trim(),'','Original demux/decode errors must remain zero');return r.stdout;
  };
  try{
    assert.ok(capture.bytes>0&&capture.bytes<=NATIVE_ENCODED_LIMITS.maxBytes,'Original8MiB limit');
    const crc=run(['-hide_banner','-v','error','-copyts','-i',file,'-map','0:v:0','-c','copy','-f','framecrc','pipe:1']);
    await writeFile(file+'.framecrc',crc,{flag:'wx'});
    result.timeline=nativeEncodedTimeline(crc,capture.stopAt-capture.startAt);
    result.failures.push(...result.timeline.failures);
    const progress=run(['-hide_banner','-v','error','-copyts','-threads','1','-i',file,'-map','0:v:0','-map','0:a:0','-vsync','0','-enc_time_base:v','1:1000','-threads','1','-progress','pipe:1','-nostats','-f','null','-']);
    const frames=Number([...progress.matchAll(/^frame=(\d+)$/gmu)].at(-1)?.[1]);
    assert.ok(progress.includes('progress=end'));assert.equal(frames,result.timeline.frames,'Decoded frames must match original packets');
    result.decode={videoFrames:frames,requiredMixerAudioStream:true,completed:true,errors:0};
  }catch(error){result.failures.push(String(error));}
  result.encodedPtsVerified=result.failures.length===0;return result;
}

// Original native AV stream, actual game mixer after limiter, original PTS.
// No microphone, clock override, animation sampling, re-encoding or FPS repair.
export async function startCorrectionRecording({ids,durationMs,preferMp4=false}){
  if(durationMs>15000)throw Error('Original15s capture limit');
  const q=window.__ASHFALL_BATTLE_QA__,audio=window.__ASHFALL_AUDIO_QA__;
  await audio.unlock();const tap=audio.createLocalRecordingTap();
  const canvas=document.querySelector('.game-shell canvas'),stream=canvas.captureStream(60);
  for(const track of tap.stream.getAudioTracks())stream.addTrack(track);
  // Keep successful desktop VP8 acquisition. On mobile WebKit the VP8/Opus
  // stream dropped whole intervals; use its native MP4 AV encoder first.
  // Both encoders must pass the same original-byte/PTS/audio checks below.
  const mimePreferences=preferMp4?['video/mp4','video/webm;codecs=vp8,opus']:['video/webm;codecs=vp8,opus','video/mp4'];
  const mime=mimePreferences.find(type=>MediaRecorder.isTypeSupported(type));
  if(!mime){tap.release();stream.getTracks().forEach(t=>t.stop());throw Error('Native original AV encoding unavailable');}
  const state={rows:[],chunks:[],startAt:null,stopAt:null,failed:null,raf:null,bytes:0,
    videoTrackSettings:{...stream.getVideoTracks()[0].getSettings()},audioTracks:stream.getAudioTracks().length,
    mime,mimePreferences,durationMs,initial:q.getV105CorrectionAudit(ids),clockOrigin:performance.timeOrigin};
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5000000,audioBitsPerSecond:128000});
  const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=e=>{state.failed=String(e.error??e);reject(Error(state.failed));};});
  void stopped.catch(()=>{});
  recorder.ondataavailable=e=>{if(e.data.size){state.bytes+=e.data.size;state.chunks.push(e.data);if(state.bytes>8388608)state.failed='Original8MiB limit exceeded';}};
  let startTimer;
  // Match the existing native recorder's single original stream. WebKit's
  // MP4 timeslices produced repeated packet timestamps and missing frames.
  await Promise.race([new Promise(resolve=>{recorder.onstart=()=>{state.startAt=performance.now();resolve();};recorder.start();}),
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
  const {V177_JOINT_ATLASES:currentAtlases}=await import('../app/v177JointPresentation.js');
  const atlasPaths=Object.fromEntries(Object.entries(currentAtlases).map(([kind,atlas])=>[kind,atlas.path]));
  const selection=await correctionCaseSelection(scope,{event:JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'))});
  const {plan}=selection,viewport=scope==='desktop'?{width:1280,height:720}:{width:844,height:scope==='mobile390'?390:340};
  const out=path.resolve(process.env.V105_CAPTURE_OUT??'outputs/v105-five-corrections/'+scope);await mkdir(out,{recursive:true});
  const report={...binding,architecture:process.arch,scope,viewport,runtime:NATIVE_RECORDING_WEBKIT_RUNTIME,selection,cases:[],contexts:[],errors:[],status:'starting',
    recordingConditions:{independentContextPerCase:true,actualAudioReadinessBeforeRecording:true,caseDeadlineMs:30000,
      retainedObservationsKeepTheirOriginalConditions:true,coldStartupAccepted:false,formalPerformanceAccepted:false},
    acceptance:{physicalIphone:false,humanVisualAndListening:false,normalCampaign:false,wholeGame:false}};
  const persist=()=>writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  if(scope==='desktop'&&process.env.GITHUB_EVENT_NAME==='pull_request'&&correctionPreparationNeeded(selection)){
    const file=path.join(out,'native-host-indexing-prepared.json'),bytes=await readFile(file);
    const prepared=JSON.parse(bytes);validateCapturePreparationRecord(prepared,{selection,binding,correction:true});
    report.hostPreparation={purpose:prepared.purpose,file,sha256:sha(bytes),diagnosticOnly:false,acceptanceOverride:false};
  }
  let browser,primary,fatalErrors=0;
  const fatal=error=>{fatalErrors++;report.errors.push(String(error));};
  try{
    if(!plan.length){report.status='retained-original-evidence-awaiting-review';await persist();return;}
    browser=await(await nativeRecordingBrowserType()).launch({headless:true});assert.equal(browser.version(),NATIVE_RECORDING_WEBKIT_RUNTIME.browserVersion);
    const owned=V100_UNITS.map(u=>u.id),base=createDefaultV100Save();
    const save=normalizeV100Save({...base,campaignStarted:true,revision:3,ownedUnitIds:owned,registeredUnitIds:owned,formationSlots:owned.slice(0,7),
      flowState:{phase:'formation',stageId:V100_STAGE_IDS[0],stageNumber:1,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
    for(const item of plan){
      const row={...item,status:'starting'};report.cases.push(row);await persist();
      assert.equal(fatalErrors,0,'A prior product/page error invalidated the recording context');
      const errorsBefore=report.errors.length;
      const caseStartedAt=performance.now();
      try{await withCorrectionCaseContext(browser,{viewport,deviceScaleFactor:1,isMobile:viewport.width<1000,hasTouch:viewport.width<1000},async page=>{
      await page.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(save));
      await page.goto(new URL('v100',process.env.V100_CAMPAIGN_QA_BASE_URL).href);await enterNativeAllUnitSurface(page);await enterV100FromTitle(page);
      await page.getByRole('button',{name:'戦闘へ',exact:true}).click();await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot().running);
      await page.evaluate(async()=>{await window.__ASHFALL_BATTLE_QA__.ensureUnitRenderProofAsset('guardian');await window.__ASHFALL_BATTLE_QA__.ensureEnemyFacingProofAsset('walker');});
      await waitForNativeCaptureAudio(page,row);

        const proof=await page.evaluate(async({kind,mode})=>{
          const q=window.__ASHFALL_BATTLE_QA__;
          if(['manual','duet'].includes(mode)){
            await q.ensureUnitRenderProofAsset(kind);
            // Match the production asset plan: Mayo can change body during
            // this same real activation, so both actual forms must be ready.
            if(kind==='mayo-chan')await q.ensureUnitRenderProofAsset('mayo-chan-feral');
          }else await q.ensureEnemyFacingProofAsset(kind);
          const p=mode==='manual'||mode==='duet'?q.prepareManualAbilityProof(mode==='duet'?[kind,kind]:kind):q.prepareV177ContinuousActorProof({form:kind,phase:mode==='enemy'?'ability':'engage'});
          q.setEnemyVfxProofPaused(true);window.__ASHFALL_AUDIO_QA__.resetCueRequests();
          return {...p,trackedIds:q.getSnapshot().fighters.map(f=>f.id)};
        },item);row.proof=proof;
        const manualCase=['manual','duet'].includes(item.mode),ids=manualCase?proof.ownerIds:[proof.fighterId];
        await page.waitForFunction(ids=>ids.every(id=>window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(id).renderHistory.at(-1)?.jointDrawSucceeded),ids,{timeout:5000});
        const d=manual[item.kind],durationMs=item.kind==='mayo-chan'&&manualCase?15000:
          manualCase?Math.ceil(Math.max(3,(d.windupSeconds??0)+(d.activeSeconds??d.guardSeconds??0)+(d.recoverySeconds??0)+1.2)*1000):item.mode==='enemy'?8000:6500;
        row.start=await page.evaluate(startCorrectionRecording,{ids:proof.trackedIds,durationMs,preferMp4:viewport.width<1000});
        row.release=await page.evaluate(()=>{const q=window.__ASHFALL_BATTLE_QA__;q.setEnemyVfxProofPaused(false);
          return {at:performance.now(),time:q.getV105CorrectionAudit([]).time};});
        if(manualCase){
          for(const id of ids){const button=page.locator(`.manual-ability-ready[data-fighter-id="${id}"]`);
            if(viewport.width<1000)await button.tap({timeout:5000});else await button.click({timeout:5000});}
          row.input='actual enabled player buttons; once per owner';
        }
        if(item.kind==='mayo-chan'&&manualCase){
          // The old fixed window cut off the same real retreat before exit.
          // Observe its actual completion inside the unchanged15s recorder
          // and30s operation limits; never extend either deadline.
          const elapsed=await page.evaluate(start=>performance.now()-start,row.start.startAt);
          await page.waitForFunction(ids=>{
            const state=window.__V105_RECORDING__?.state,last=state?.rows.at(-1);
            return last&&ids.every(id=>!last.fighters.some(f=>f.id===id)
              &&last.retreatCompletions.some(r=>r.ownerId===id&&r.mode==='ability'));
          },ids,{timeout:Math.max(1,14500-elapsed),polling:100});
          await page.waitForTimeout(100);
        }else await page.waitForTimeout(durationMs);
        const capture=await page.evaluate(stopCorrectionRecording),bytes=Buffer.from(capture.data,'base64');delete capture.data;
        const file=`${String(report.cases.length).padStart(2,'0')}-${item.kind}-${item.mode}.${capture.mime.startsWith('video/mp4')?'mp4':'webm'}`;
        await writeFile(path.join(out,file),bytes,{flag:'wx'});Object.assign(row,{file,sha256:sha(bytes),bytes:bytes.length,capture,status:'retained-pending-checks'});await persist();
        assert.equal(capture.failed,null);assert.ok(capture.rows.length>=30,'actual continuous paint receipts missing');
        assert.equal(capture.bytes,bytes.length,'Original encoded bytes must remain intact');
        row.originalAv=await auditCorrectionEncodedClip(path.join(out,file),capture);
        assertCorrectionCaseDeadline(row,caseStartedAt);
        assert.ok(row.originalAv.encodedPtsVerified,JSON.stringify(row.originalAv.failures));
        row.currentModelPaints=assertCurrentCorrectionPaints(capture,ids,atlasPaths);
        if(item.kind==='mayo-chan'&&manualCase)row.retreat=assertMayoCorrectionRetreat(capture,ids);
        const actual=(capture.final.time-row.release.time)*1000,wall=capture.stopAt-row.release.at;
        assert.ok(Math.abs(actual-wall)<=120,`Original120ms game/native clock bound: drift=${actual-wall}ms, dropped=${capture.final.timing?.droppedSimulationSeconds-capture.initial.timing?.droppedSimulationSeconds}s`);
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
        assert.equal(fatalErrors,0,'A product/page error invalidated this recording');
        assertCorrectionCaseDeadline(row,caseStartedAt);
        row.status='verified-awaiting-owned-cleanup';
      },{onFatal:fatal,onRequests:receipt=>{row.context=receipt;report.contexts.push({kind:item.kind,mode:item.mode,...receipt});},
        onDeadline:e=>{row.deadlineExpired=true;row.error=String(e);}});
      completeCorrectionCase(row,caseStartedAt,{fatalErrors});
      }catch(error){
        row.status='failed';row.error=String(error);report.errors.push(`${item.kind}/${item.mode}: ${row.error}`);await persist();
        // A retained, completed stream can fail its assertions without
        // invalidating independent next fixtures. Preserve that failure;
        // an exception, missing stream or expired context still stops here.
        if(!canContinueCompletedCorrection(row,{pageClosed:row.context?.pageClosedBeforeCleanup!==false||row.context?.completed!==true,fatalErrors,errorsBefore,errorsAfter:report.errors.length}))throw error;
      }
      console.log(scope,item.kind,item.mode,row.status);
    }
    report.status=report.errors.length?'failed':'recorded-awaiting-visual-and-listening-review';
  }catch(error){primary=error;report.errors.push(String(error));report.status='failed';
    const row=report.cases.at(-1);if(row&&row.status!=='recorded'){row.status='failed';row.error=String(error);}}
  finally{
    if(browser)try{await browser.close();}catch(error){report.errors.push('Browser cleanup: '+String(error));}
    report.requests={unexpectedFailures:report.contexts.flatMap(r=>r.audit.unexpectedFailures),
      teardownAborts:report.contexts.flatMap(r=>r.audit.teardownAborts),rawFailures:report.contexts.flatMap(r=>r.audit.rawFailures)};
    if(report.requests.unexpectedFailures.length)report.errors.push('Unexpected retained request failures');
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
