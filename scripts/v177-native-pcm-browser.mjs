import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PCM_ASSETS,startNativePcmOrigin } from './v177-native-pcm-origin.mjs';
import { runNativePcmProbe,nativePcmClockEvidence } from './v177-native-pcm-probe.mjs';
import { assertNativeOpusHost,installNativeOpusGuard,NATIVE_OPUS_CONTEXT,NATIVE_OPUS_RUNTIME } from './v177-native-opus-probe.mjs';
import { analyseNativeAacContent } from './v177-native-aac-probe.mjs';
import { installRequestFailureAudit } from './browser-request-failure-audit.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const acceptance=()=>({physicalRecordingAccepted:false,productionBackendAccepted:false,wholeGameAccepted:false,gameBackendChanged:false});
const describe=e=>String(e?.message??e);
export function pcmProbeCases(){return [{variant:'static',mix:'bgm'},{variant:'live',mix:'bgm'},{variant:'live',mix:'bgm-se'}];}
export async function withNativePcmDeadline(operation,milliseconds,message){
  let timer;try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),milliseconds);})]);}
  finally{clearTimeout(timer);}
}
export function evaluateNativePcm(state,server,content) {
  const errors=[],check=(ok,message)=>{if(!ok)errors.push(message);};
  const clock=nativePcmClockEvidence(state,server),first=state.events?.find(r=>r.event==='playing');
  const firstAdvance=state.playheads?.find(r=>r.time>0),effect=state.effect;
  const lagSamples=content?.lagSamples,positiveLagSamples=Number.isSafeInteger(lagSamples)?Math.max(0,lagSamples):0;
  const reached=effect?.server?state.playheads?.find(r=>r.time>=(effect.server.firstInputFrame+positiveLagSamples)/48000):null;
  const effectLatencyMs=reached?reached.ms-effect.requestedAtMs:null;
  check(state.status==='complete'&&state.startTrusted===true,'Native trusted start did not complete');
  check(state.errors?.length===0&&state.cleanupErrors?.length===0,'Original native/cleanup errors retained');
  check(state.activity?.realtimeAudioContextAttempts===0&&state.activity?.microphoneAttempts===0,'Forbidden realtime or microphone activity');
  check(server.stream?.complete&&server.stream.inputFrames===192000&&server.errors.length===0,'Producer did not complete the original four seconds');
  check(first&&first.ms>=0&&first.ms<=150&&firstAdvance&&firstAdvance.ms<=150,'Native startup exceeds the original150ms budget');
  check(clock.accepted,'Observed native clock exceeds the original150ms budget');
  const contentDelayMs=positiveLagSamples/48,contentAdvanceMs=Number.isSafeInteger(lagSamples)?Math.max(0,-lagSamples)/48:0;
  check(Number.isSafeInteger(lagSamples)&&clock.maximumDelayMs+contentDelayMs<=150&&clock.maximumAdvanceMs+contentAdvanceMs<=150,
    'Content-aligned native clock exceeds the original150ms budget');
  check(state.finalMedia?.ended===true&&state.finalMedia.time>=3.99&&state.finalMedia.time<=4.01
    &&state.finalMedia.duration>=3.99&&state.finalMedia.duration<=4.01&&state.finalMedia.playbackRate===1
    &&!state.finalMedia.muted&&state.finalMedia.volume===1,'Native playback did not reach the original EOF');
  const underflows=(state.events??[]).filter(r=>r.event==='waiting'&&first&&r.ms>first.ms&&r.time<3.95);
  check(underflows.length===0,'Native stream underflowed');
  check(content&&content.duration>=3.99&&content.duration<=4.01&&content.rms>.0001&&content.peak>.001&&content.correlation>.7,'WAV content does not retain original BGM');
  if(state.mix==='bgm-se'){
    check(effect?.trusted===true&&effect.server?.firstInputFrame>0&&effect.server.firstInputFrame<192000,'Trusted future SE input is missing');
    check(content?.effectCorrelation>.6,'Original rifle content absent from mixed WAV');
    check(effectLatencyMs!==null&&effectLatencyMs>=0&&effectLatencyMs<=150,'Rifle native playhead latency exceeds the original150ms budget');
  }
  return {...acceptance(),passed:errors.length===0,errors,clock,startupMs:first?.ms??null,firstAdvanceMs:firstAdvance?.ms??null,
    effectLatencyMs,underflows,contentDelayMs,contentAdvanceMs,scope:'Hosted HTTP native WAV clock and retained content only; no production/SW or physical recording acceptance'};
}

export async function runHostedNativePcmDiagnostic() {
  // Reject local invocation before opening the HTTP fixture or any browser.
  assertNativeOpusHost(process.platform,process.env);
  const git=args=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim(),head=git(['rev-parse','HEAD']);
  assert.equal(head,process.env.V177_EXPECTED_HEAD_SHA,'Exact PR source required');
  const out=process.env.V177_NATIVE_PCM_OUT??'outputs/v177-native-pcm';await mkdir(path.join(out,'source'),{recursive:true});
  const save=async(name,b)=>{await writeFile(path.join(out,name),b,{flag:'wx'});return {file:name,bytes:b.length,sha256:sha(b)};};
  const report={at:new Date().toISOString(),...acceptance(),diagnosticOnly:true,status:'starting',
    scope:'Finite ordinary HTTP PCM16LE WAV, static BGM control and10ms live BGM/SE. Same original MP3 assets/gains, no game/MSE/srcObject/realtime context. Native macOS is not physical iOS; SW and production integration remain untested.',
    provenance:{head,tree:git(['rev-parse','HEAD^{tree}']),parents:git(['show','-s','--format=%P','HEAD']),platform:process.platform,
      arch:process.arch,node:process.version,runId:process.env.GITHUB_RUN_ID,expectedHead:process.env.V177_EXPECTED_HEAD_SHA},
    runtime:NATIVE_OPUS_RUNTIME,sourcePins:[],originalAssets:[],cases:[],errors:[],cleanup:{browser:'not-created'}};
  let browser,closingBrowser=false;
  try {
    const sourceFiles=['scripts/v177-native-pcm-origin.mjs','scripts/v177-native-pcm-probe.mjs','scripts/v177-native-pcm-browser.mjs',
      'tests/v177-native-pcm.test.mjs','.github/workflows/native-pcm-streaming.yml','scripts/v177-native-opus-probe.mjs',
      'scripts/v177-native-aac-probe.mjs','scripts/browser-request-failure-audit.mjs','scripts/pwa-browser-runtime.mjs','package-lock.json',
      'scripts/pwa-native-runtime/package-lock.json','scripts/pwa-native-runtime/node_modules/playwright/package.json',
      'scripts/pwa-native-runtime/node_modules/playwright-core/browsers.json'];
    for(const source of sourceFiles)report.sourcePins.push({source,...await save('source/repo__'+source.replaceAll('/','__'),await readFile(source))});
    const sources=await Promise.all(PCM_ASSETS.map(async asset=>{const b=await readFile('public'+asset.source);
      assert.equal(b.length,asset.bytes);assert.equal(sha(b),asset.sha256);
      report.originalAssets.push({...asset,...await save('source/repo__public'+asset.source.replaceAll('/','__'),b)});return b;}));
    const {pwaBrowserType,PWA_WEBKIT_RUNTIME}=await import('./pwa-browser-runtime.mjs');assert.deepEqual(PWA_WEBKIT_RUNTIME,NATIVE_OPUS_RUNTIME);
    browser=await(await pwaBrowserType('webkit')).launch({headless:true});assert.equal(browser.version(),NATIVE_OPUS_RUNTIME.browserVersion);
    browser.on('disconnected',()=>{if(!closingBrowser)report.errors.push('Unexpected native browser disconnect');});
    for(const scenario of pcmProbeCases()){
      const label=scenario.variant+'-'+scenario.mix,row={...scenario,...acceptance(),feasibility:'starting',errors:[],artifacts:[],cleanup:{context:'not-created',origin:'not-created'}};report.cases.push(row);
      let origin,context,page,audit,observation,originals,expired=false;
      const caseDeadlineAt=Date.now()+30000;
      const assertActive=()=>{
        const remaining=caseDeadlineAt-Date.now();
        if(expired||remaining<=0)throw new Error('Expired native PCM case cannot continue or send input');
        return remaining;
      };
      const acquire=async(operation,close)=>{
        assertActive();const resource=await operation();
        if(!expired&&Date.now()<caseDeadlineAt)return resource;
        try{await withNativePcmDeadline(()=>close(resource),2000,'Late native PCM resource cleanup deadline exceeded');}
        finally{throw new Error('Late native PCM resource cannot continue an expired case');}
      };
      const retainOriginals=async()=>{
        if(originals||!origin)return originals;
        const server=origin.snapshot(),wav=origin.wav(),pcm=origin.pcmSources();
        row.artifacts.push(await save(label+'-server-before-cleanup.json',Buffer.from(JSON.stringify(server,null,2)+'\n')));
        row.artifacts.push(await save(label+(server.stream?.complete?'-stream.wav':'-produced-prefix.wav'),wav));
        for(let i=0;i<pcm.length;i++)row.artifacts.push(await save(label+'-input'+i+'.f32le',pcm[i]));
        originals={server,wav,pcm};return originals;
      };
      try {
        await withNativePcmDeadline(async()=>{
        origin=await acquire(()=>startNativePcmOrigin({sources,...scenario}),value=>value.close());
        context=await acquire(()=>browser.newContext({...NATIVE_OPUS_CONTEXT}),value=>value.close());
        await context.addInitScript(installNativeOpusGuard);assertActive();
        page=await acquire(()=>context.newPage(),value=>value.close());audit=installRequestFailureAudit(page);
        page.on('pageerror',e=>row.errors.push('page: '+describe(e)));page.on('console',m=>{if(m.type()==='error')row.errors.push('console: '+m.text());});
        page.on('request',r=>{if(new URL(r.url()).origin!==origin.origin)row.errors.push('Unexpected origin: '+r.url());});
        page.on('response',r=>{if(r.status()>=400)row.errors.push('HTTP '+r.status()+' '+r.url());});
        await page.goto(origin.origin,{waitUntil:'domcontentloaded',timeout:10000});
        assertActive();
        observation=page.evaluate(runNativePcmProbe,{...scenario,sourceUrls:PCM_ASSETS.map((a,i)=>({id:a.id,url:origin.origin+'/asset/'+i+'.mp3',expectedSha256:a.sha256}))});
        // Keep the original rejection observed while the driver sends trusted input.
        void observation.catch(()=>{});
        await page.waitForFunction(()=>document.documentElement.dataset.probeReady==='1'||globalThis.__V177_NATIVE_PCM_STATE?.status==='failed',null,{timeout:15000});
        assertActive();
        const ready=await page.evaluate(()=>document.documentElement.dataset.probeReady==='1');assertActive();
        if(ready){
          await page.getByRole('button',{name:'Start native PCM probe',exact:true}).click({timeout:Math.min(2000,assertActive())});
          assertActive();
          if(scenario.mix==='bgm-se'){
            await page.waitForTimeout(1000);assertActive();
            await page.getByRole('button',{name:'Fire existing rifle effect',exact:true}).click({timeout:Math.min(2000,assertActive())});
            assertActive();
          }
        }
        const state=await withNativePcmDeadline(()=>observation,10000,'Native PCM observation deadline exceeded');
        assertActive();
        row.artifacts.push(await save(label+'-raw.json',Buffer.from(JSON.stringify(state,null,2)+'\n')));
        const {server,wav,pcm}=await retainOriginals();
        assert.ok(server.stream?.complete&&pcm.length===2,'Incomplete producer; original evidence retained');
        const reference=new Float32Array(384000),background=new Float32Array(384000),music=new Float32Array(pcm[0].buffer,pcm[0].byteOffset,pcm[0].length/4),
          effect=new Float32Array(pcm[1].buffer,pcm[1].byteOffset,pcm[1].length/4),firstEffect=state.effect?.server?.firstInputFrame??null;
        // Independent original-input mix, not the emitted WAV as its own reference.
        for(let i=0;i<reference.length;i++){background[i]=music[i]*.18;const j=firstEffect===null?-1:i-firstEffect*2;
          reference[i]=background[i]+(j>=0?(effect[j]??0)*.5:0);
          assert.equal(wav.readInt16LE(44+i*2),Math.round((music[i]*.18+(j>=0?(effect[j]??0)*.5:0))*32767),'Generated WAV differs from original input mix');}
        const referenceBytes=Buffer.from(reference.buffer),backgroundBytes=Buffer.from(background.buffer);
        row.artifacts.push(await save(label+'-reference.f32le',referenceBytes));row.artifacts.push(await save(label+'-background.f32le',backgroundBytes));
        assertActive();
        row.content=await withNativePcmDeadline(()=>page.evaluate(analyseNativeAacContent,{encoded:[...wav],reference:[...referenceBytes],background:[...backgroundBytes],
          effect:state.effect?.server?{firstInputFrame:state.effect.server.firstInputFrame}:null}),10000,'Native PCM content deadline exceeded');
        assertActive();
        row.evidence=evaluateNativePcm(state,server,row.content);assert.ok(row.evidence.passed,row.evidence.errors.join('; '));
        row.feasibility='native-probe-passed-not-production-or-physical-acceptance';
        },30000,'Native PCM30s case owner deadline exceeded');
      }catch(error){row.originalFailure=describe(error);row.errors.push(row.originalFailure);row.feasibility='failed';
        expired=true;
        try{await retainOriginals();}catch(e){row.errors.push('original evidence: '+describe(e));}
        if(page){try{const state=await withNativePcmDeadline(()=>page.evaluate(()=>globalThis.__V177_NATIVE_PCM_STATE??null),1000,'Partial native PCM read deadline exceeded');row.artifacts.push(await save(label+'-partial-raw.json',Buffer.from(JSON.stringify(state,null,2)+'\n')));}catch(e){row.errors.push('partial evidence: '+describe(e));}}
      }finally {
        expired=true;
        if(context){try{await withNativePcmDeadline(()=>audit?audit.closeContext(context):context.close(),2000,'Native PCM context cleanup deadline exceeded');row.cleanup.context='completed';}catch(e){row.cleanup.context='failed';row.errors.push('context cleanup: '+describe(e));}}
        if(origin){try{await withNativePcmDeadline(()=>origin.close(),2000,'Native PCM origin cleanup deadline exceeded');row.cleanup.origin='completed';}catch(e){row.cleanup.origin='failed';row.errors.push('origin cleanup: '+describe(e));}
          const final=origin.snapshot();row.artifacts.push(await save(label+'-server-final.json',Buffer.from(JSON.stringify(final,null,2)+'\n')));
          if(final.stream?.producedBytes!==originals?.server?.stream?.producedBytes)
            row.artifacts.push(await save(label+'-final-produced-prefix.wav',origin.wav()));}
        if(audit){row.requests=audit.report;if(audit.report.unexpectedFailures.length)row.errors.push('Unexpected request failure retained');}
        if(row.errors.length)row.feasibility='failed';row.artifacts.push(await save(label+'-case.json',Buffer.from(JSON.stringify(row,null,2)+'\n')));
      }
    }
  }catch(error){report.errors.push(describe(error));}
  finally {if(browser){closingBrowser=true;try{await withNativePcmDeadline(()=>browser.close(),2000,'Native PCM browser cleanup deadline exceeded');report.cleanup.browser='completed';}catch(e){report.cleanup.browser='failed';report.errors.push('browser cleanup: '+describe(e));}}}
  report.status=report.errors.length||report.cases.length!==3||report.cases.some(r=>r.feasibility==='failed')?'failed':'completed-diagnostic';
  await save('report.json',Buffer.from(JSON.stringify(report,null,2)+'\n'));
  console.log(JSON.stringify({head,status:report.status,...acceptance(),cases:report.cases.map(({variant,mix,feasibility,evidence})=>({variant,mix,feasibility,evidence}))}));
  if(report.status==='failed')process.exitCode=1;return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const result=await runHostedNativePcmDiagnostic().catch(e=>{console.error(describe(e));process.exitCode=1;return null;});
  // A failed hosted cleanup stays failed. Do not let its unresolved RPC keep
  // this diagnostic step alive after original evidence/report has been saved.
  if(result&&(result.cleanup.browser==='failed'||result.cases.some(row=>Object.values(row.cleanup).includes('failed'))))process.exit(1);
}
