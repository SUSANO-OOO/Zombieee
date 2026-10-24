import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {nativeGameCaptureBinding,withNativeGameCaseDeadline,closeNativeGameContext} from './v177-native-game-capture-browser.mjs';
import {nativeRecordingBrowserType,NATIVE_RECORDING_WEBKIT_RUNTIME} from './v177-native-allunit-recording-runtime.mjs';
import {startCorrectionRecording,stopCorrectionRecording,auditCorrectionEncodedClip,assertCurrentCorrectionPaints,assertCorrectionCaseDeadline} from './v105-five-corrections-capture.mjs';
import {enterNativeAllUnitSurface} from './v177-native-allunit-browser.mjs';
import {seedV100BrowserSaveOnce,enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_UNITS,V100_STAGE_IDS} from '../app/v100Registry.js';
import {MANUAL_ABILITY_REGISTRY as manual} from '../app/manualAbilities.js';
import {V177_JOINT_ATLASES as atlases} from '../app/v177JointPresentation.js';
import {installRequestFailureAudit} from './browser-request-failure-audit.mjs';
const productHead='f7f6f7ce46844eaefc4bb519fa80d591e2607407';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function runBrowserQa(){
 const binding=await nativeGameCaptureBinding();
 const changed=execFileSync('git',['diff','--name-only',productHead,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
 assert.deepEqual(changed.sort(),['.github/workflows/native-capture-comparison.yml','scripts/v105-av-clock-control.mjs']);
 const report={...binding,productHead,sourceDiff:changed,runtime:NATIVE_RECORDING_WEBKIT_RUNTIME,
   diagnosticOnly:true,acceptance:{physicalIphone:false,humanListening:false,wholeGame:false,release:false},cases:[]};
 const out=path.resolve('outputs/v105-av-clock-control');await mkdir(out,{recursive:true});
 const persist=()=>writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 const cases=[...[true,false,false,true].map((headless,i)=>({id:`mrs340-${i+1}`,kind:'mrs-chiha',mode:'manual',headless,width:844,height:340})),
   {id:'anchor-desktop',kind:'anchor-bloom',mode:'enemy',headless:true,width:1280,height:720}];
 for(const item of cases){
  const row={...item,status:'starting'};report.cases.push(row);await persist();
  let browser,context,requests,fatal=[];
  const close=async()=>{if(context){await closeNativeGameContext(context,requests);context=null;}if(browser){await browser.close();browser=null;}};
  try{
   browser=await(await nativeRecordingBrowserType()).launch({headless:item.headless});assert.equal(browser.version(),NATIVE_RECORDING_WEBKIT_RUNTIME.browserVersion);
   context=await browser.newContext({viewport:{width:item.width,height:item.height},deviceScaleFactor:1,isMobile:item.width<1000,hasTouch:item.width<1000});
   const page=await context.newPage();requests=installRequestFailureAudit(page);
   page.on('pageerror',e=>fatal.push(String(e)));page.on('console',m=>{if(m.type()==='error')fatal.push(m.text());});page.on('response',r=>{if(r.status()>=400)fatal.push(`${r.status()} ${r.url()}`);});
   const owned=V100_UNITS.map(u=>u.id),base=createDefaultV100Save();
   const save=normalizeV100Save({...base,campaignStarted:true,revision:3,ownedUnitIds:owned,registeredUnitIds:owned,formationSlots:owned.slice(0,7),
    flowState:{phase:'formation',stageId:V100_STAGE_IDS[0],stageNumber:1,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
   await withNativeGameCaseDeadline(async()=>{
    await page.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(save));await page.goto(new URL('v100',process.env.V100_CAMPAIGN_QA_BASE_URL).href);
    await enterNativeAllUnitSurface(page);await enterV100FromTitle(page);await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
    await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot().running);
    await page.evaluate(async()=>{await window.__ASHFALL_BATTLE_QA__.ensureUnitRenderProofAsset('guardian');await window.__ASHFALL_BATTLE_QA__.ensureEnemyFacingProofAsset('walker');});
   },close);
   const started=performance.now();
   await withNativeGameCaseDeadline(async()=>{
    row.proof=await page.evaluate(async({kind,mode})=>{const q=window.__ASHFALL_BATTLE_QA__;
     if(mode==='manual')await q.ensureUnitRenderProofAsset(kind);else await q.ensureEnemyFacingProofAsset(kind);
     const p=mode==='manual'?q.prepareManualAbilityProof(kind):q.prepareV177ContinuousActorProof({form:kind,phase:'ability'});
     q.setEnemyVfxProofPaused(true);window.__ASHFALL_AUDIO_QA__.resetCueRequests();return{...p,trackedIds:q.getSnapshot().fighters.map(f=>f.id)};
    },item);
    const ids=item.mode==='manual'?row.proof.ownerIds:[row.proof.fighterId];
    await page.waitForFunction(ids=>ids.every(id=>window.__ASHFALL_BATTLE_QA__.getEnemyFacingRuntimeAudit(id).renderHistory.at(-1)?.jointDrawSucceeded),ids,{timeout:5000});
    const d=manual[item.kind],durationMs=item.mode==='manual'?Math.ceil(Math.max(3,d.windupSeconds+(d.activeSeconds??d.guardSeconds??0)+(d.recoverySeconds??0)+1.2)*1000):8000;
    row.start=await page.evaluate(startCorrectionRecording,{ids:row.proof.trackedIds,durationMs,preferMp4:item.width<1000});
    row.release=await page.evaluate(()=>{const q=window.__ASHFALL_BATTLE_QA__;q.setEnemyVfxProofPaused(false);return{at:performance.now(),time:q.getV105CorrectionAudit([]).time};});
    if(item.mode==='manual')await page.locator(`.manual-ability-ready[data-fighter-id="${ids[0]}"]`).tap({timeout:5000});
    await page.waitForTimeout(durationMs);const capture=await page.evaluate(stopCorrectionRecording),bytes=Buffer.from(capture.data,'base64');delete capture.data;
    const file=item.id+(capture.mime.startsWith('video/mp4')?'.mp4':'.webm');await writeFile(path.join(out,file),bytes,{flag:'wx'});
    Object.assign(row,{file,sha256:sha(bytes),bytes:bytes.length,capture});
    // The actual original recorder and every observation have stopped before
    // releasing this browser. A running synthetic battle must not compete
    // with the original5s decoder. No retained frame or clock is modified.
    await close();row.browserClosedBeforeDecode=true;row.requests=requests.report;await persist();
    assert.equal(capture.failed,null);assert.equal(capture.bytes,bytes.length);
    row.originalAv=await auditCorrectionEncodedClip(path.join(out,file),capture);assertCorrectionCaseDeadline(row,started);
    assert.equal(row.originalAv.encodedPtsVerified,true,JSON.stringify(row.originalAv.failures));
    row.currentModelPaints=assertCurrentCorrectionPaints(capture,ids,Object.fromEntries(Object.entries(atlases).map(([k,a])=>[k,a.path])));
    const starts=capture.rows.flatMap(r=>r.abilityNames.starts).filter(r=>ids.includes(r.ownerId));
    assert.ok(ids.every(id=>starts.some(r=>r.ownerId===id)),'A real accepted ability start is mandatory');
    assert.ok(capture.rows.some(r=>r.abilityNames.active.some(a=>ids.includes(a.ownerId)&&a.lastPaint)),'The name must actually paint');
    row.driftMs=(capture.final.time-row.release.time)*1000-(capture.stopAt-row.release.at);
    assert.ok(Math.abs(row.driftMs)<=120,`Original120ms clock: ${row.driftMs}`);
    assert.deepEqual(fatal,[]);assert.deepEqual(requests.report.unexpectedFailures,[]);assertCorrectionCaseDeadline(row,started);row.status='recorded';
   },close,{onDeadline:()=>{row.deadlineExpired=true;}});
  }catch(error){row.status='failed';row.error=String(error);}
  finally{try{await close();}catch(e){row.cleanupError=String(e);row.status='failed';}row.productErrors=fatal;await persist();}
  console.log(JSON.stringify({id:item.id,headless:item.headless,status:row.status,driftMs:row.driftMs,error:row.error,caseElapsedMs:row.caseElapsedMs}));
 }
 report.complete=report.cases.length===cases.length;await persist();assert.ok(report.complete);assert.ok(report.cases.every(r=>r.status==='recorded'),'Retain every original strict control failure');
}
async function main(){await nativeGameCaptureBinding();process.argv[2]=fileURLToPath(import.meta.url);await import('./run-browser-qa-with-server.mjs');}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e);process.exitCode=1;});
