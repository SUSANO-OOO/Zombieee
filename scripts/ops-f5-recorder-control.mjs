import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,realpath,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {startCorrectionRecording,stopCorrectionRecording,withCorrectionCaseContext,assertCorrectionCaseDeadline,auditCorrectionEncodedClip,assertCurrentCorrectionPaints} from './v105-five-corrections-capture.mjs';
import {nativeRecordingBrowserType,NATIVE_RECORDING_WEBKIT_RUNTIME} from './v177-native-allunit-recording-runtime.mjs';
import {enterNativeAllUnitSurface,waitForNativeCaptureAudio} from './v177-native-allunit-browser.mjs';
import {seedV100BrowserSaveOnce,enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_UNITS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {MANUAL_ABILITY_REGISTRY as manual} from '../app/manualAbilities.js';
import {parseIndexingStatus,pauseEnabledVolumes,restoreEnabledVolumes} from './v100-macos-indexing-control.mjs';
import {selectCanvasReadbackMode,readCanvasReadbackReceipt} from './ops-canvas-readback-adapter.mjs';
import {withNativeGameCaseDeadline,closeNativeGameContext} from './v177-native-game-capture-browser.mjs';
import {startAvailabilityProbe,stopAvailabilityProbe} from './ops-timer-availability-probe.mjs';

const out=path.resolve('outputs/ops-f5-recorder-control');
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim();
async function guard(){
  assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');
  for(const [key,value] of Object.entries({GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'macOS',
    GITHUB_REPOSITORY:'SUSANO-OOO/Zombieee',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_JOB:'f5-recorder-control'}))assert.equal(process.env[key],value,key);
  assert.match(process.env.V177_EXPECTED_HEAD_SHA??'',/^[a-f0-9]{40}$/u);
  assert.equal(git(['rev-parse','HEAD']),process.env.V177_EXPECTED_HEAD_SHA);
  assert.equal(await realpath(process.cwd()),await realpath(process.env.GITHUB_WORKSPACE));
  for(const part of ['app','public','package.json','package-lock.json','scripts/v105-five-corrections-capture.mjs'])
    assert.equal(git(['rev-parse','HEAD:'+part]),git(['rev-parse','7cb606f033bf2472f330b6def52b6329b48bdd4c:'+part]),part);
}

// Only this ephemeral diagnostic job can prepare its host. Keep every original
// volume state before mutation and restore all enabled volumes even on failure.
async function host(mode){
  await guard();await mkdir(out,{recursive:true});
  const file=path.join(out,'host.json'),options={encoding:'utf8',timeout:30000,env:{...process.env,LC_ALL:'C'}};
  const status=(timeout=30000)=>parseIndexingStatus(execFileSync('/usr/bin/mdutil',['-a','-s'],{...options,timeout}));
  if(mode==='prepare'){
    const record={head:git(['rev-parse','HEAD']),run:process.env.GITHUB_RUN_ID,before:status(),state:'pause-attempted'};
    await writeFile(file,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
    record.pause=await pauseEnabledVolumes(record.before,(mount,timeout)=>execFileSync('/usr/bin/sudo',['-n','/usr/bin/mdutil','-i','off',mount],{...options,timeout}),status);
    record.state='paused';await writeFile(file,JSON.stringify(record,null,2)+'\n');
  }else{
    const record=JSON.parse(await readFile(file,'utf8'));
    assert.equal(record.head,git(['rev-parse','HEAD']));assert.equal(record.run,process.env.GITHUB_RUN_ID);
    const result=restoreEnabledVolumes(record.before,mount=>execFileSync('/usr/bin/sudo',['-n','/usr/bin/mdutil','-i','on',mount],options));
    Object.assign(record,{restoration:result.attempts,state:result.errors.length?'restoration-incomplete':'restored'});
    try{record.restored=status();assert.deepEqual(record.restored,record.before);}catch(error){result.errors.push(error);record.state='restoration-incomplete';}
    await writeFile(file,JSON.stringify(record,null,2)+'\n');
    if(result.errors.length)throw new AggregateError(result.errors,'Original host restoration failed');
  }
}

export async function runBrowserQa(){
  await guard();await mkdir(out,{recursive:true});
  const report={head:git(['rev-parse','HEAD']),productHead:'7cb606f033bf2472f330b6def52b6329b48bdd4c',
    diagnosticOnly:true,accepted:false,run:process.env.GITHUB_RUN_ID,runtime:NATIVE_RECORDING_WEBKIT_RUNTIME,
    plan:['unobserved','timer-observed','timer-observed','unobserved'],kind:'mrs-chiha',viewport:{width:844,height:340},
    hypothesis:'Readback hint and browser lifetime did not repair or consistently reproduce failures. Existing failed rows contain218ms RAF gaps but only7ms from that RAF timestamp through the observer. Observe whether actual JS timer callbacks continue inside the unaccounted interval, separating RAF dispatch-only delay from whole-thread unavailability without assigning GPU/GC/OS ownership prematurely.',
    decision:'One fixed ABBA comparison on the original failed Mrs-Chiha/mobile340 ability condition. Same shared browser, independent contexts, original default canvas and real AV. B alone adds a16ms timer retaining only actual performance.now values; no replacement clocks, RAF changes, interpolation, media or snapshot omission. Include all original120ms/250ms/8MiB/30s/15m checks. Compare A/B disturbance; never treat this as formal performance or a recording repair. If no long unaccounted RAF interval occurs, classify as not reproduced, not fixed. For each original outside-CPU interval, retain the actual timer callbacks inside it; callbacks demonstrate JS availability, their absence alone does not prove GPU/GC/OS ownership.',
    cases:[],errors:[],status:'starting'};
  const persist=()=>writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  const browserType=await nativeRecordingBrowserType(),browser=await browserType.launch({headless:true});
  const processes=()=>execFileSync('/bin/ps',['-axo','pid,ppid,comm'],{encoding:'utf8',timeout:2000}).split('\n')
    .filter(line=>/Playwright|WebKit|WebProcess|GPUProcess|NetworkProcess/u.test(line));
  try{
    assert.equal(browser.version(),NATIVE_RECORDING_WEBKIT_RUNTIME.browserVersion);
    const {V177_JOINT_ATLASES:atlases}=await import('../app/v177JointPresentation.js');
    const atlasPaths=Object.fromEntries(Object.entries(atlases).map(([kind,atlas])=>[kind,atlas.path]));
    const owned=V100_UNITS.map(u=>u.id),base=createDefaultV100Save();
    const save=normalizeV100Save({...base,campaignStarted:true,revision:3,ownedUnitIds:owned,registeredUnitIds:owned,formationSlots:owned.slice(0,7),
      flowState:{phase:'formation',stageId:V100_STAGE_IDS[0],stageNumber:1,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
    for(const [index,mode] of report.plan.entries()){
      const row={index,mode,status:'starting',accepted:false};report.cases.push(row);await persist();
      const caseStartedAt=performance.now();
      let caseBrowser=browser,primary;
      await withNativeGameCaseDeadline(async()=>{
      try{
      assertCorrectionCaseDeadline(row,caseStartedAt);
      assert.equal(caseBrowser,browser);assert.equal(caseBrowser.version(),NATIVE_RECORDING_WEBKIT_RUNTIME.browserVersion);
      row.processesBefore=processes();
      await withCorrectionCaseContext(caseBrowser,{viewport:report.viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true},async(page,closeOwned)=>{
        await page.addInitScript(selectCanvasReadbackMode,'default');
        await page.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(save));
        await page.goto(new URL('v100',process.env.V100_CAMPAIGN_QA_BASE_URL).href);await enterNativeAllUnitSurface(page);await enterV100FromTitle(page);
        await page.getByRole('button',{name:'戦闘へ',exact:true}).click();await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot().running);
        await page.evaluate(async()=>{await window.__ASHFALL_BATTLE_QA__.ensureUnitRenderProofAsset('guardian');await window.__ASHFALL_BATTLE_QA__.ensureEnemyFacingProofAsset('walker');});
        await waitForNativeCaptureAudio(page,row);
        row.proof=await page.evaluate(async kind=>{const q=window.__ASHFALL_BATTLE_QA__;await q.ensureUnitRenderProofAsset(kind);
          const p=q.prepareManualAbilityProof(kind);q.setEnemyVfxProofPaused(true);window.__ASHFALL_AUDIO_QA__.resetCueRequests();
          return {...p,trackedIds:q.getSnapshot().fighters.map(f=>f.id)};},report.kind);
        await page.waitForFunction(ids=>ids.every(id=>window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(id).renderHistory.at(-1)?.jointDrawSucceeded),row.proof.ownerIds,{timeout:5000});
        row.document=await page.evaluate(()=>({visibility:document.visibilityState,focus:document.hasFocus()}));
        row.contextMode=await page.evaluate(readCanvasReadbackReceipt);
        row.probeStart=await page.evaluate(startAvailabilityProbe,mode==='timer-observed');
        const d=manual[report.kind],durationMs=Math.ceil(Math.max(3,(d.windupSeconds??0)+(d.activeSeconds??d.guardSeconds??0)+(d.recoverySeconds??0)+1.2)*1000);
        row.start=await page.evaluate(startCorrectionRecording,{ids:row.proof.trackedIds,durationMs,preferMp4:true});
        row.release=await page.evaluate(()=>{const q=window.__ASHFALL_BATTLE_QA__;q.setEnemyVfxProofPaused(false);return {at:performance.now(),time:q.getV105CorrectionAudit([]).time};});
        await page.locator(`.manual-ability-ready[data-fighter-id="${row.proof.ownerIds[0]}"]`).tap({timeout:5000});
        row.input='one actual enabled tap for this independent fixture';
        await page.waitForTimeout(durationMs);
        const capture=await page.evaluate(stopCorrectionRecording),bytes=Buffer.from(capture.data,'base64');delete capture.data;row.capture=capture;
        row.file=`${index}-${mode}.${capture.mime.startsWith('video/mp4')?'mp4':'webm'}`;
        await writeFile(path.join(out,row.file),bytes,{flag:'wx'});
        row.bytes=bytes.length;row.sha256=createHash('sha256').update(bytes).digest('hex');await persist();
        row.timerProbe=await page.evaluate(stopAvailabilityProbe);assert.equal(row.timerProbe.overflow,false);
        row.contextModeAfter=await page.evaluate(readCanvasReadbackReceipt);
        assert.deepEqual(row.contextModeAfter,row.contextMode,'Actual canvas owner, mode and dimensions must remain unchanged throughout capture');
        // Observe the original canvas after timing has ended; do not add a
        // readback/screenshot to the live interval under comparison.
        row.canvasPng=`${index}-${mode}-actual-canvas.png`;
        await page.locator('.game-shell canvas').screenshot({path:path.join(out,row.canvasPng)});
        await closeOwned();
        assert.equal(capture.failed,null);assert.equal(capture.bytes,bytes.length);assert.ok(capture.rows.length>=30);
        row.originalAv=await auditCorrectionEncodedClip(path.join(out,row.file),capture);
        row.currentModelPaints=assertCurrentCorrectionPaints(capture,row.proof.ownerIds,atlasPaths);
        assertCorrectionCaseDeadline(row,caseStartedAt);
        row.driftMs=(capture.final.time-row.release.time)*1000-(capture.stopAt-row.release.at);
        row.droppedSimulationSeconds=capture.final.timing.droppedSimulationSeconds-capture.initial.timing.droppedSimulationSeconds;
        row.maxRafIntervalMs=Math.max(...capture.rows.slice(1).map((r,i)=>r.at-capture.rows[i].at));
        const live=capture.rows.filter(r=>r.at>=row.release.at&&r.at<=capture.stopAt),intervals=live.slice(1).map((r,i)=>r.at-live[i].at).sort((a,b)=>a-b);
        row.liveCadence={rows:live.length,hz:1000*(live.length-1)/(live.at(-1).at-live[0].at),
          medianMs:intervals[Math.floor(intervals.length*.5)],p95Ms:intervals[Math.floor(intervals.length*.95)]};
        row.acceptedRealAbility=capture.final.abilityNames.starts.some(a=>row.proof.ownerIds.includes(a.ownerId));
        row.originalFailures=[...row.originalAv.failures];
        if(Math.abs(row.driftMs)>120)row.originalFailures.push('Original120ms game/native clock bound');
        assert.ok(row.acceptedRealAbility&&capture.rows.some(r=>r.abilityNames.active.some(a=>row.proof.ownerIds.includes(a.ownerId)&&a.lastPaint)),'Actual accepted ability and owner name paint required');
        row.outsideIntervals=capture.rows.slice(1).flatMap((r,i)=>{
          const previous=capture.rows[i],from=previous.frameCpu?.[6],to=r.frameCpu?.[2];
          if(!(Number.isFinite(from)&&Number.isFinite(to)&&to-from>1000/60*5&&previous.at>=row.release.at&&r.at<=capture.stopAt))return [];
          return [{from,to,ms:to-from,previousRaf:previous.at,raf:r.at,actualTimerCallbacks:row.timerProbe.rows.filter(at=>at>from&&at<to)}];
        });
        row.status=row.originalFailures.length?'diagnostic-with-original-failures':'observed-diagnostic';
      },{onFatal:error=>{report.errors.push(String(error));},onRequests:receipt=>{row.context=receipt;},onDeadline:()=>{row.deadlineExpired=true;}});
      }catch(error){primary=error;row.primaryError=String(error);throw error;}
      finally{
        const cleanupErrors=[];
        if(caseBrowser!==browser)try{await closeNativeGameContext(caseBrowser);}catch(error){cleanupErrors.push('Owned browser close: '+String(error));}
        try{row.processesAfter=processes();}catch(error){cleanupErrors.push('Post-cleanup process observation: '+String(error));}
        if(cleanupErrors.length){row.browserCleanupErrors=cleanupErrors;
          if(primary)report.errors.push(...cleanupErrors.map(e=>'Secondary cleanup: '+e));
          else throw new AggregateError(cleanupErrors.map(e=>Error(e)),'Recording browser cleanup failed');}
      }
      },()=>closeNativeGameContext(caseBrowser),{onDeadline:()=>{row.deadlineExpired=true;}});
      assertCorrectionCaseDeadline(row,caseStartedAt);
      await persist();console.log(JSON.stringify({index,mode,driftMs:row.driftMs,maxRafIntervalMs:row.maxRafIntervalMs,liveCadence:row.liveCadence,
        contextMode:row.contextMode,encoded:row.originalAv.timeline,originalFailures:row.originalFailures,accepted:false}));
      assert.deepEqual(report.errors,[]);
    }
    report.status=report.cases.some(r=>r.originalFailures.length)?'diagnostic-with-original-failures':'diagnostic-complete';
  }catch(error){report.errors.push(String(error));report.status='protocol-failed';throw error;}
  finally{try{await browser.close();}finally{await persist();}}
}

if(process.argv[2]==='prepare'||process.argv[2]==='restore')await host(process.argv[2]);
