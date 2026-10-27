import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,realpath} from 'node:fs/promises';import path from 'node:path';
import {nativeRecordingBrowserType,NATIVE_RECORDING_WEBKIT_RUNTIME} from './v177-native-allunit-recording-runtime.mjs';
import {planShard} from './v177-native-allunit-manifest.mjs';import {captureAllUnitCase} from './v177-native-allunit-cases.mjs';
import {nativeContextFormation,enterNativeAllUnitSurface,prepareNativeAllUnitBattle,waitForNativeCaptureAudio} from './v177-native-allunit-browser.mjs';
import {withCorrectionCaseContext,assertCorrectionCaseDeadline} from './v105-five-corrections-capture.mjs';
import {seedV100BrowserSaveOnce,enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_UNITS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {auditNativeEncodedReport} from './v177-native-encoded-clips.mjs';import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {nativeCaptureRafWindow} from './v177-native-canvas-clips.mjs';

export async function runBrowserQa(){
  assert.equal(process.platform,'darwin');assert.equal(process.arch,'arm64');
  for(const [k,v]of Object.entries({GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'macOS',GITHUB_REPOSITORY:'SUSANO-OOO/Zombieee',
    GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_JOB:'f5-recorder-control'}))assert.equal(process.env[k],v,k);
  assert.equal(await realpath(process.cwd()),await realpath(process.env.GITHUB_WORKSPACE));
  const git=args=>execFileSync('git',args,{encoding:'utf8',timeout:30000}).trim(),head=git(['rev-parse','HEAD']);
  assert.equal(head,process.env.V177_EXPECTED_HEAD_SHA);
  for(const file of ['app','public','package.json','package-lock.json','scripts/v177-native-encoded-clips.mjs'])
    assert.equal(git(['rev-parse','HEAD:'+file]),git(['rev-parse','2052a789809ed405e107afab124fc3d42043a93d:'+file]),file);
  const selected=planShard('forms-7').find(r=>r.caseId==='forms-7:gate-eater:attack:844x390');assert.ok(selected);
  const out=path.resolve('outputs/ops-native-postpaint-control');await mkdir(out,{recursive:true});
  const report={head,run:process.env.GITHUB_RUN_ID,runtime:NATIVE_RECORDING_WEBKIT_RUNTIME,build:await productionBuildIdentity(),
    diagnosticOnly:true,accepted:false,plan:['timer60','postpaint0','postpaint0','timer60'],caseId:selected.caseId,
    question:'Same native VP8 writer and original canvas; do requests after complete game draws change encoded gaps compared with the original60Hz timer?',
    limitations:'B adds a small RAF counter observer while A keeps the original timer path, so compare the whole acquisition method including that observer, not flag phase alone. requestFrame is a flag, not a synchronous frame or encoded receipt. No copies, catch-up, PTS changes or acceptance from request counts. No root-cause or global correction claim from one condition.',
    cases:[],errors:[],status:'starting'};
  const persist=()=>writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  const browser=await(await nativeRecordingBrowserType()).launch({headless:true});let fatalErrors=0;
  try{
    assert.equal(browser.version(),NATIVE_RECORDING_WEBKIT_RUNTIME.browserVersion);
    const owned=V100_UNITS.map(u=>u.id),base=createDefaultV100Save(),stageId=V100_STAGE_IDS[0];
    const save=normalizeV100Save({...base,campaignStarted:true,revision:3,ownedUnitIds:owned,registeredUnitIds:owned,
      availableStageIds:V100_STAGE_IDS,formationSlots:nativeContextFormation([selected]),
      flowState:{phase:'formation',stageId,stageNumber:1,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
    for(const [index,mode]of report.plan.entries()){
      const row={...selected,index,mode,samples:[],status:'starting',diagnosticOnly:true,originalSpeedAccepted:false,naturalnessAccepted:false,accepted:false};
      report.cases.push(row);await persist();const startedAt=performance.now(),trial=path.join(out,index+'-'+mode);await mkdir(trial);
      try{
        assert.equal(fatalErrors,0,'A prior page failure invalidated the diagnostic');
        await withCorrectionCaseContext(browser,{viewport:selected.viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true},async(page,closeOwned)=>{
          await page.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(save));const url=new URL('v100',process.env.V100_CAMPAIGN_QA_BASE_URL);url.searchParams.set('phase-g','1');await page.goto(url.href);
          await enterNativeAllUnitSurface(page);const owner={cleanup:'open'};
          await prepareNativeAllUnitBattle(page,[selected.form,selected.binding.kind,'guardian'],owner,async()=>{
            await enterV100FromTitle(page);await page.getByRole('button',{name:'戦闘へ',exact:true}).click();await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot().running);
          });await waitForNativeCaptureAudio(page,row);
          await captureAllUnitCase(page,row,{out:trial,requestedCaptureHz:mode==='postpaint0'?0:60,postpaintControl:true});
          await closeOwned();owner.cleanup='closed';
          const file=path.join(trial,'source-report.json');await writeFile(file,JSON.stringify({head,cases:[row]},null,2)+'\n',{flag:'wx'});
          row.encoded=await auditNativeEncodedReport(file);
          if(row.encoded.summary.failed)report.errors.push('Encoded failure '+index+': '+JSON.stringify(row.encoded.results[0].failures));
          assertCorrectionCaseDeadline(row,startedAt);
        },{onFatal:error=>{fatalErrors++;report.errors.push(String(error));},onRequests:receipt=>{row.context=receipt;},onDeadline:()=>{row.deadlineExpired=true;}});
        row.sourceCaptureRaf=nativeCaptureRafWindow(row.sourceRaf.rows,row.nativeClip);
        row.status='retained-diagnostic';
      }catch(error){row.status='failed';row.error=String(error);report.errors.push(String(error));
        await persist();if(row.deadlineExpired||fatalErrors||row.context?.completed!==true
          ||row.nativeClip?.status!=='recorded'||row.nativeClip?.completed!==true)throw error;}
      await persist();console.log(JSON.stringify({index,mode,status:row.status,sourceCaptureRaf:row.sourceCaptureRaf,
        encoded:row.encoded?.results[0]?.timeline,errors:row.encoded?.results[0]?.failures,accepted:false}));
    }
    assert.equal((await productionBuildIdentity()).combinedSha256,report.build.combinedSha256,'One unchanged production build throughout ABBA');
    report.status=report.errors.length?'diagnostic-with-failures':'diagnostic-complete';
  }catch(error){report.status='protocol-failed';report.errors.push(String(error));throw error;}
  finally{try{await browser.close();}finally{await persist();}}
  if(report.errors.length)process.exitCode=1;
}
