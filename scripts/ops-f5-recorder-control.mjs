import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,realpath,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {startCorrectionRecording,stopCorrectionRecording,withCorrectionCaseContext,assertCorrectionCaseDeadline} from './v105-five-corrections-capture.mjs';
import {nativeRecordingBrowserType,NATIVE_RECORDING_WEBKIT_RUNTIME} from './v177-native-allunit-recording-runtime.mjs';
import {enterNativeAllUnitSurface,waitForNativeCaptureAudio} from './v177-native-allunit-browser.mjs';
import {seedV100BrowserSaveOnce,enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_UNITS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {MANUAL_ABILITY_REGISTRY as manual} from '../app/manualAbilities.js';
import {parseIndexingStatus,pauseEnabledVolumes,restoreEnabledVolumes} from './v100-macos-indexing-control.mjs';
import {omitEncoderAndSelectCanvasSource} from './ops-canvas-source-adapter.mjs';

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
    plan:['canvas-source','no-canvas-source','canvas-source-light','no-canvas-source-light',
      'no-canvas-source-light','canvas-source-light','no-canvas-source','canvas-source'],kind:'brawler',viewport:{width:844,height:340},
    hypothesis:'The old encoder A/B retained a real canvas source and full per-frame snapshots in both conditions; its no-encoder rows were still23-26Hz. Separate those two remaining harness costs in one fixed2x2 comparison.',
    decision:'Eight fixed ABCDDCBA windows, never repeat-until-pass. All modes have NO real encoder and NO media. Source omission uses a labelled interface placeholder. Light observation omits only per-frame QA payload, with no replacement game timestamps; initial/release/final snapshots remain actual. Observer RAF cadence is not game-render or encoded FPS: compare actual frameCpu/draw/simulation receipts too. Separated results support a harness path, not GPU or GC ownership. Overlap remains inconclusive; none replaces recording or formal performance acceptance.',
    cases:[],errors:[],status:'starting'};
  const persist=()=>writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  const browser=await(await nativeRecordingBrowserType()).launch({headless:true});
  try{
    assert.equal(browser.version(),NATIVE_RECORDING_WEBKIT_RUNTIME.browserVersion);
    const owned=V100_UNITS.map(u=>u.id),base=createDefaultV100Save();
    const save=normalizeV100Save({...base,campaignStarted:true,revision:3,ownedUnitIds:owned,registeredUnitIds:owned,formationSlots:owned.slice(0,7),
      flowState:{phase:'formation',stageId:V100_STAGE_IDS[0],stageNumber:1,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
    for(const [index,mode] of report.plan.entries()){
      const row={index,mode,status:'starting',accepted:false};report.cases.push(row);await persist();
      const caseStartedAt=performance.now();
      await withCorrectionCaseContext(browser,{viewport:report.viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true},async(page,closeOwned)=>{
        await page.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(save));
        await page.goto(new URL('v100',process.env.V100_CAMPAIGN_QA_BASE_URL).href);await enterNativeAllUnitSurface(page);await enterV100FromTitle(page);
        await page.getByRole('button',{name:'戦闘へ',exact:true}).click();await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot().running);
        await page.evaluate(async()=>{await window.__ASHFALL_BATTLE_QA__.ensureUnitRenderProofAsset('guardian');await window.__ASHFALL_BATTLE_QA__.ensureEnemyFacingProofAsset('walker');});
        await waitForNativeCaptureAudio(page,row);
        row.proof=await page.evaluate(async()=>{const q=window.__ASHFALL_BATTLE_QA__;await q.ensureUnitRenderProofAsset('brawler');
          const p=q.prepareManualAbilityProof('brawler');q.setEnemyVfxProofPaused(true);window.__ASHFALL_AUDIO_QA__.resetCueRequests();
          return {...p,trackedIds:q.getSnapshot().fighters.map(f=>f.id)};});
        await page.waitForFunction(ids=>ids.every(id=>window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(id).renderHistory.at(-1)?.jointDrawSucceeded),row.proof.ownerIds,{timeout:5000});
        row.document=await page.evaluate(()=>({visibility:document.visibilityState,focus:document.hasFocus()}));
        await page.evaluate(omitEncoderAndSelectCanvasSource,mode);
        const d=manual.brawler,durationMs=Math.ceil(Math.max(3,(d.windupSeconds??0)+(d.activeSeconds??d.guardSeconds??0)+(d.recoverySeconds??0)+1.2)*1000);
        row.start=await page.evaluate(startCorrectionRecording,{ids:row.proof.trackedIds,durationMs,preferMp4:true});
        row.release=await page.evaluate(()=>{const q=window.__ASHFALL_BATTLE_QA__;q.setEnemyVfxProofPaused(false);return {at:performance.now(),time:q.getV105CorrectionAudit([]).time};});
        await page.locator(`.manual-ability-ready[data-fighter-id="${row.proof.ownerIds[0]}"]`).tap({timeout:5000});
        row.input='one actual enabled tap for this independent fixture';
        await page.waitForTimeout(durationMs);
        const capture=await page.evaluate(stopCorrectionRecording),bytes=Buffer.from(capture.data,'base64');delete capture.data;row.capture=capture;
        row.encoder=await page.evaluate(()=>window.__OPS_ENCODER_CONTROL__??{encoderCreated:true});
        assert.equal(bytes.length,0);assert.equal(capture.failed,'Original encoded byte limit');assert.equal(row.encoder.encoderCreated,false);
        assert.equal(row.encoder.constructorCalls,1);assert.equal(row.encoder.stopCalls,1);
        assert.equal(row.encoder.realCanvasSourceCalls,mode.startsWith('no-')?0:1);
        assert.equal(row.encoder.sourceOmitted,mode.startsWith('no-'));
        await closeOwned();
        assertCorrectionCaseDeadline(row,caseStartedAt);
        row.driftMs=(capture.final.time-row.release.time)*1000-(capture.stopAt-row.release.at);
        row.droppedSimulationSeconds=capture.final.timing.droppedSimulationSeconds-capture.initial.timing.droppedSimulationSeconds;
        row.maxRafIntervalMs=Math.max(...capture.rows.slice(1).map((r,i)=>r.at-capture.rows[i].at));
        const live=capture.rows.filter(r=>r.at>=row.release.at&&r.at<=capture.stopAt),intervals=live.slice(1).map((r,i)=>r.at-live[i].at).sort((a,b)=>a-b);
        row.liveCadence={rows:live.length,hz:1000*(live.length-1)/(live.at(-1).at-live[0].at),
          medianMs:intervals[Math.floor(intervals.length*.5)],p95Ms:intervals[Math.floor(intervals.length*.95)]};
        assert.ok(capture.final.abilityNames.starts.some(a=>row.proof.ownerIds.includes(a.ownerId)),'One accepted real ability must occur');
        row.status='observed-diagnostic';
      },{onFatal:error=>{report.errors.push(String(error));},onRequests:receipt=>{row.context=receipt;},onDeadline:()=>{row.deadlineExpired=true;}});
      assertCorrectionCaseDeadline(row,caseStartedAt);
      await persist();console.log(JSON.stringify({index,mode,driftMs:row.driftMs,maxRafIntervalMs:row.maxRafIntervalMs,liveCadence:row.liveCadence,noEncodedMedia:true,accepted:false}));
      assert.deepEqual(report.errors,[]);
    }
    report.status='diagnostic-complete';
  }catch(error){report.errors.push(String(error));report.status='protocol-failed';throw error;}
  finally{try{await browser.close();}finally{await persist();}}
}

if(process.argv[2]==='prepare'||process.argv[2]==='restore')await host(process.argv[2]);
