import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {nativeGameCaptureBinding,withNativeGameCaseDeadline,closeNativeGameContext,
  NATIVE_GAME_CAPTURE_SOURCES} from './v177-native-game-capture-browser.mjs';
import {SHARDS,VIEWPORTS,FORM_BINDINGS,LIMITS,planShard,assertRetainedBindings} from './v177-native-allunit-manifest.mjs';
import {captureAllUnitCase} from './v177-native-allunit-cases.mjs';
import {planRangerManualShard,rangerManualEnvelopeReference} from './v177-native-allunit-ranger-manual-contract.mjs';
import {captureNativeRangerManualCase} from './v177-native-allunit-ranger-manual.mjs';
import {nativeCaseSelection} from './v177-native-allunit-selection.mjs';
import {planOutcomeShard,captureNativeOutcomeCase} from './v177-native-allunit-outcomes.mjs';
import {combatKindToCampaignUnitId} from '../app/campaign.js';

const git=args=>execFileSync('git',args,{encoding:'utf8',maxBuffer:8*1024*1024,windowsHide:true}).trim();
const sha=b=>createHash('sha256').update(b).digest('hex');
const acceptance=()=>({originalSpeedAccepted:false,naturalnessAccepted:false,
  physicalSavedAudioAccepted:false,normalCampaignAccepted:false,wholeGameAccepted:false});

export function nativeContextFormation(rows){
  assert.ok(Array.isArray(rows)&&rows.length);
  const kinds=[...new Set(rows.map(r=>r.binding.side==='human'?r.binding.kind:'guardian'))];
  const slots=kinds.map(combatKindToCampaignUnitId);
  assert.ok(slots.length<=7&&slots.every(id=>typeof id==='string'&&id.startsWith('unit-')));
  return slots;
}

// Host-owned progress survives a pending page RPC and the existing setup
// deadline. These wall-clock receipts do not assert readiness or game timing.
export async function ensureNativeAllUnitAssets(page,forms,owner,{now=Date.now}={}){
  owner.assetReadiness=[];
  for(const form of forms){
    const receipt={form,status:'starting',hostStartedAtMs:now()};owner.assetReadiness.push(receipt);
    try{
      if(owner.cleanup!=='open')throw Error('Asset setup owner is closed');
      await page.evaluate(async form=>{await window.__ASHFALL_BATTLE_QA__.ensureEnemyFacingProofAsset(form);},form);
      if(owner.cleanup!=='open')throw Error('Asset setup owner closed before readiness returned');
      receipt.status='completed';receipt.hostCompletedAtMs=now();
    }catch(error){receipt.status='failed';receipt.hostFailedAtMs=now();receipt.error=String(error);throw error;}
  }
}

export async function prepareNativeAllUnitBattle(page,forms,owner,enterBattle,setupStage=()=>{}){
  // Asset decode owns no battle/clock state. Start it as soon as the original
  // bridge exists while the real title and battle controls finish entering.
  // Both operations must finish inside the unchanged outer30s deadline.
  await Promise.all([
    (async()=>{
      await page.waitForFunction(()=>typeof window.__ASHFALL_BATTLE_QA__?.ensureEnemyFacingProofAsset==='function');
      setupStage('asset-readiness');await ensureNativeAllUnitAssets(page,forms,owner);
    })(),
    Promise.resolve().then(enterBattle),
  ]);
}

export async function enterNativeAllUnitSurface(page,setupStage=()=>{}){
  const play=page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true});
  const title=page.locator('.v100-start-screen');
  const noticeRoot=page.locator('.fiction-notice');
  const notice=noticeRoot.getByRole('button',{name:'続ける',exact:true});
  const receipt={noticeContinue:'not-present',interruptedClick:null};
  setupStage('entry-surface');await play.or(title).or(notice).first().waitFor();
  const state=await notice.evaluateAll(elements=>({present:elements.length===1,enabled:elements.length===1&&!elements[0].disabled}));
  if(state.present){
    // Use the existing player control instead of spending 6s+500ms waiting
    // for its automatic dismissal. No DOM, title clock or readiness bypass.
    setupStage('fiction-continue');receipt.noticeContinue='already-leaving';
    if(state.enabled){
      try{await notice.click({timeout:LIMITS.readinessMs});receipt.noticeContinue='clicked';}
      catch(error){
        if(error.name!=='TimeoutError'||await noticeRoot.count()!==0)throw error;
        receipt.noticeContinue='dismissed-during-click';receipt.interruptedClick=String(error);
      }
    }
    await noticeRoot.waitFor({state:'hidden'});
  }
  await play.or(title).first().waitFor();setupStage('entry-play-button');
  if(await play.isVisible())await play.click();
  return receipt;
}

export async function nativeAllUnitBinding({env=process.env,...guard}={}){
  const binding=await nativeGameCaptureBinding({...guard,env});
  assert.ok(SHARDS.some(s=>s.id===env.V177_CAPTURE_SHARD),'An exact known shard is required');
  return {...binding,shardId:env.V177_CAPTURE_SHARD};
}
export async function main({load=url=>import(url),argv=process.argv,...guard}={}){
  await nativeAllUnitBinding(guard);
  const original=argv[2],length=argv.length;argv[2]=fileURLToPath(import.meta.url);
  try{await load(new URL('./run-browser-qa-with-server.mjs',import.meta.url).href);}
  finally{if(length<3)argv.length=length;else argv[2]=original;}
}
const additions=[
  '.github/workflows/native-allunit-capture.yml','scripts/v177-native-allunit-browser.mjs',
  'scripts/v177-native-allunit-build.mjs',
  'scripts/v100-macos-indexing-control.mjs',
  'scripts/v177-native-allunit-cases.mjs','scripts/v177-native-allunit-manifest.mjs',
  'scripts/v177-native-encoded-clips.mjs','tests/v177-native-encoded-clips.test.mjs',
  'scripts/v177-native-allunit-contract.mjs','scripts/v177-native-allunit-owners.mjs',
  'tests/v177-native-allunit.test.mjs','scripts/v100-normal-tactical-input.mjs',
  'scripts/ordered-native-pointer.mjs','scripts/v100-phase-g-runtime-evidence.mjs',
  'scripts/v177-native-allunit-ranger-manual.mjs','scripts/v177-native-allunit-ranger-manual-contract.mjs',
  'tests/v177-native-allunit-ranger-manual.test.mjs',
  'scripts/v177-native-allunit-selection.mjs','scripts/v177-native-allunit-recovery.json',
  'scripts/v177-native-allunit-outcomes.mjs','tests/v177-native-allunit-outcomes.test.mjs',
  'scripts/v177-human-corpse-contract.mjs','tests/v177-human-corpse-continuity.test.mjs',
];
export async function retainAllUnitSources(out){
  // Retain every committed App file, the old capture contract, this driver,
  // its pinned runtime and all 45 actual atlas files. Each byte is bound to HEAD.
  const appFiles=git(['ls-files','--','app']).split('\n').filter(Boolean);
  const files=[...new Set([...NATIVE_GAME_CAPTURE_SOURCES,...additions,...appFiles,
    ...FORM_BINDINGS.map(f=>'public'+f.atlas.path)])].sort();
  const entries=new Map(git(['ls-tree','-r','--full-tree','HEAD']).split('\n').map(line=>{
    const [meta,file]=line.split('\t');return [file,meta.split(' ')[2]];
  }));
  const sources=[];
  for(const file of files){
    const bytes=await readFile(file),gitBlob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
    assert.equal(gitBlob,entries.get(file),'Capture source must be the exact committed checkout: '+file);
    const retained='repo__'+file.replaceAll('/','__');await writeFile(path.join(out,retained),bytes,{flag:'wx'});
    sources.push({file,retained,bytes:bytes.length,sha256:sha(bytes),gitBlob});
  }
  return sources;
}
export async function runBrowserQa(){
  const binding=await nativeAllUnitBinding();
  const selection=nativeCaseSelection({event:JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'))});
  const requestedMimeType=process.env.V177_NATIVE_VIDEO_MIME??'video/webm;codecs=vp8';
  assert.ok(['video/webm;codecs=vp8','video/mp4'].includes(requestedMimeType),'Unknown native recorder comparison');
  assert.ok(selection.mode==='codec-control'||requestedMimeType==='video/webm;codecs=vp8','Container comparison is isolated from the remaining/full inventory');
  const requestedCaptureHz=60;
  const fullPlan=planShard(binding.shardId),plan=fullPlan.filter(r=>selection.caseIds.includes(r.caseId));
  const manualPlan=planRangerManualShard(binding.shardId).filter(r=>selection.mode==='full'||selection.manualCaseIds?.includes(r.caseId));
  const outcomePlan=planOutcomeShard(binding.shardId).filter(r=>selection.mode==='full'||selection.outcomeCaseIds?.includes(r.caseId));
  assert.ok(plan.length||manualPlan.length||outcomePlan.length,'Selected shard has no requested observations');
  const deps=Object.assign({},...await Promise.all([
    import('./pwa-browser-runtime.mjs'),import('./browser-qa-build-identity.mjs'),
    import('./browser-request-failure-audit.mjs'),import('./v100-title-qa-entry.mjs'),
    import('../app/v100Registry.js'),import('../app/v100Save.js'),
  ]));
  const out=process.env.V177_NATIVE_ALLUNIT_OUT??'outputs/v177-native-allunit';
  const origin=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
  assert.equal(origin.protocol,'http:');assert.equal(origin.hostname,'127.0.0.1');
  const report={at:new Date().toISOString(),...binding,tree:git(['rev-parse','HEAD^{tree}']),
    host:{arch:process.arch,runnerArch:process.env.RUNNER_ARCH??null,imageOS:process.env.ImageOS??null,imageVersion:process.env.ImageVersion??null},
    engine:'webkit',runtime:deps.PWA_WEBKIT_RUNTIME,build:await deps.productionBuildIdentity(),
    status:'running-diagnostic',selection,recording:{requestedMimeType,requestedCaptureHz,codecControl:selection.mode==='codec-control'},fullPlan,excludedCaseIds:fullPlan.filter(r=>!selection.caseIds.includes(r.caseId)).map(r=>r.caseId),
    plan,manualPlan,manualCases:[],outcomePlan,outcomeCases:[],sources:[],contexts:[],cases:[],errors:[],persistenceErrors:[],...acceptance(),
    scope:selection.mode==='acquisition-control'
      ?'One original Abomination attack case with a 60Hz canvas acquisition-request timer. Native VP8 bytes, free RAF/simulation, source clocks, 15x120ms sampling and encoded thresholds stay unchanged. Diagnostic only; no retained, all-unit, performance, release or physical acceptance.'
      :selection.mode==='codec-control'
      ?'One original Brute attack case with a native container comparison. Original scene, free RAF/simulation, source clock and deadlines remain unchanged. This dispatch supplies no all-unit, performance, release, naturalness or physical audio acceptance.'
      :'One of twelve all48 native VP8 shards;432 normal cases remain separate from3 supplemental actual Ranger manual clips. A native60Hz source-acquisition request timer does not guarantee encoded60fps or grant acceptance. Original free RAF/simulation after actual recorder start. Ordinary actors use original stats; Mayo uses real trusted activation/self-drain; turned continues the actual infection newborn; split twins use their real S24 pair constructors with a deliberately partial encounter. Legacy fused art is an explicit fixture. Controlled target diagnostics are not campaign, balance, original-speed naturalness or physical audio acceptance.'};
  if(process.env.V177_NATIVE_HOST_INDEXING_CONTROL==='brute-attack-1280'){
    const file=path.join(out,'native-host-indexing-prepared.json'),bytes=await readFile(file),prepared=JSON.parse(bytes);
    assert.equal(prepared.purpose,'native-capture-diagnostic');assert.equal(prepared.diagnosticOnly,true);
    assert.equal(prepared.acceptanceOverride,false);assert.equal(prepared.state,'paused');
    assert.equal(prepared.candidateHead,binding.head);assert.equal(prepared.run,process.env.GITHUB_RUN_ID);
    assert.equal(prepared.attempt,process.env.GITHUB_RUN_ATTEMPT);assert.equal(prepared.shard,binding.shardId);
    assert.equal(prepared.arch,process.arch);assert.equal(prepared.caseId,'forms-2:brute:attack:1280x720');
    assert.deepEqual(selection.caseIds,[prepared.caseId]);assert.deepEqual(selection.outcomeCaseIds,[]);assert.deepEqual(selection.manualCaseIds,[]);
    report.host.indexingControl={purpose:prepared.purpose,diagnosticOnly:true,file,sha256:createHash('sha256').update(bytes).digest('hex')};
  }
  assert.match(process.env.V177_EXPECTED_BUILD_SHA256??'',/^[a-f0-9]{64}$/u);
  assert.equal(report.build.combinedSha256,process.env.V177_EXPECTED_BUILD_SHA256,'Capture build differs from the producer job');
  report.buildBundle=JSON.parse(await readFile(path.join(out,'build-bundle-consumption.json'),'utf8'));
  for(const [key,value]of Object.entries({head:binding.head,tree:report.tree,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT}))
    assert.equal(report.buildBundle.binding[key],value,'Shared build owner differs: '+key);
  assert.equal(report.buildBundle.receiptSha256,process.env.V177_EXPECTED_BUILD_RECEIPT_SHA256);
  assert.deepEqual(report.buildBundle.build,report.build,'Verified shared build changed before capture');
  await mkdir(out,{recursive:true});report.sources=await retainAllUnitSources(out);
  for(const row of plan)assertRetainedBindings(row,{...report,expectedHead:binding.head,files:report.sources});
  for(const row of manualPlan)assertRetainedBindings(rangerManualEnvelopeReference(row),{...report,expectedHead:binding.head,files:report.sources});
  for(const row of outcomePlan)assertRetainedBindings(row.reference,{...report,expectedHead:binding.head,files:report.sources});
  const reportFile=path.join(out,'report.json');await writeFile(reportFile,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  let primary,browser,closingBrowser=false;
  const fail=error=>{primary??=error;report.errors.push(String(error));};
  const persist=async()=>{
    try{await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');}
    catch(error){report.persistenceErrors.push(String(error));fail(error);}
  };
  try{
    browser=await (await deps.pwaBrowserType('webkit')).launch({headless:true});
    browser.on('disconnected',()=>{if(!closingBrowser)fail(Error('Unexpected native browser disconnect'));});
    report.browserVersion=browser.version();assert.equal(report.browserVersion,deps.PWA_WEBKIT_RUNTIME.browserVersion);
    for(const viewport of VIEWPORTS){
      // S24 gets its own owned save/context; no definition or clock is rewritten
      // to turn an unrelated Stage1 actor into a formal separated twin.
      for(const stageNumber of [1,24]){
        const contextPlan=[...plan,...manualPlan.map(r=>rangerManualEnvelopeReference(r)),...outcomePlan.map(r=>r.reference)];
        const contextRows=contextPlan.filter(r=>r.viewport.width===viewport.width&&r.viewport.height===viewport.height
          &&(r.owner==='futago-pair'?24:1)===stageNumber);
        if(!contextRows.length)continue;
        const rows=plan.filter(r=>contextRows.some(c=>c.caseId===r.caseId));
        const contextOptions={viewport,isMobile:viewport.width<1000,hasTouch:viewport.width<1000,deviceScaleFactor:1};
        const owner={viewport,stageNumber,contextOptions,setupStage:'not-started',cleanup:'not-created',requests:null};report.contexts.push(owner);
        owner.setupPhases=[];owner.pageEvents=[];owner.resourceEvents=[];
        const setupStage=name=>{owner.setupStage=name;owner.setupPhases.push({name,hostAtMs:Date.now()});};
        let context,requests,closing;
        const closeOwned=()=>closing??=(async()=>{
          if(!context)return;owner.cleanup='pending';await persist();
          try{await closeNativeGameContext(context,requests);owner.cleanup='completed';}
          catch(error){owner.cleanup='failed';fail(error);throw error;}
          finally{owner.requests=requests?.report??null;
            if(requests?.report.unexpectedFailures.length)fail(Error('Unexpected native capture request failure'));
            await persist();}
        })();
        try{
          context=await browser.newContext(contextOptions);owner.cleanup='open';
          const page=await context.newPage();page.setDefaultTimeout(30000);requests=deps.installRequestFailureAudit(page);
          for(const type of ['domcontentloaded','load'])page.on(type,()=>owner.pageEvents.push({type,hostAtMs:Date.now()}));
          for(const type of ['request','requestfinished','requestfailed'])page.on(type,request=>{
            if(owner.resourceEvents.length<1000)owner.resourceEvents.push({type,url:request.url(),resourceType:request.resourceType(),hostAtMs:Date.now()});
          });
          page.on('pageerror',fail);page.on('console',m=>{if(m.type()==='error')fail(Error(m.text()));});
          page.on('response',r=>{if(r.status()>=400)fail(Error(r.status()+' '+r.url()));});
          const base=deps.createDefaultV100Save(),owned=deps.V100_UNITS.map(u=>u.id),stageId=deps.V100_STAGE_IDS[stageNumber-1];
          // Only this constructor fixture's actual actors need entry assets.
          // Unrelated formation portraits/bodies otherwise consume the same
          // cold setup deadline before any controlled case can begin.
          owner.formationSlots=nativeContextFormation(contextRows);
          const save=deps.normalizeV100Save({...base,campaignStarted:true,revision:3,ownedUnitIds:owned,
            registeredUnitIds:owned,availableStageIds:deps.V100_STAGE_IDS,formationSlots:owner.formationSlots,
            flowState:{phase:'formation',stageId,stageNumber,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
          await withNativeGameCaseDeadline(async()=>{
            setupStage('seed-save');await page.addInitScript(deps.seedV100BrowserSaveOnce,deps.serializeV100Save(save));
            const url=new URL('v100',origin);url.searchParams.set('phase-g','1');setupStage('navigate');await page.goto(url.href);
            owner.entrySurface=await enterNativeAllUnitSurface(page,setupStage);
            const forms=[...new Set(contextRows.flatMap(r=>[r.form,r.binding.kind,r.binding.side==='human'?'walker':'guardian',
              ...(r.owner==='turned-birth'?['brawler','turned']:[])]))];
            await prepareNativeAllUnitBattle(page,forms,owner,async()=>{
              setupStage('title-entry');await deps.enterV100FromTitle(page);setupStage('battle-button');await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
              setupStage('battle-running');await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
            },setupStage);setupStage('completed');
          },closeOwned,{onDeadline:fail});
          for(const planned of rows){
            const row={...planned,status:'starting',samples:[],...acceptance()};report.cases.push(row);
            try{await withNativeGameCaseDeadline(()=>captureAllUnitCase(page,row,{out,onFailure:fail,requestedMimeType,requestedCaptureHz,codecControl:selection.mode==='codec-control',acquisitionControl:selection.mode==='acquisition-control'}),closeOwned,
              {onDeadline:error=>{row.deadlineExpired=true;fail(error);}});}
            catch(error){row.status='failed';row.error=String(error);row.operationSettledAtOwnerReturn=error.operationSettledAtOwnerReturn??null;fail(error);await persist();break;}
            await persist();
          }
          // Supplemental manual input never supplies a missing normal case.
          // A broken/closed normal context leaves the supplement unexecuted.
          if(stageNumber===1&&!page.isClosed()&&rows.every(p=>report.cases.some(r=>r.caseId===p.caseId&&r.status==='observed-diagnostic'))){
            for(const planned of manualPlan.filter(r=>r.viewport.width===viewport.width&&r.viewport.height===viewport.height)){
              const row={...planned,status:'starting-manual',samples:[],normalEngageAccepted:false,...acceptance()};report.manualCases.push(row);
              try{await withNativeGameCaseDeadline(()=>captureNativeRangerManualCase(page,row,{out,onFailure:fail}),closeOwned,
                {onDeadline:error=>{row.deadlineExpired=true;fail(error);}});}
              catch(error){row.status='failed';row.error=String(error);row.operationSettledAtOwnerReturn=error.operationSettledAtOwnerReturn??null;fail(error);}
              await persist();
            }
          }
          if(!page.isClosed()&&rows.every(p=>report.cases.some(r=>r.caseId===p.caseId&&r.status==='observed-diagnostic'))){
            for(const planned of outcomePlan.filter(r=>r.viewport.width===viewport.width&&r.viewport.height===viewport.height
              &&(r.owner==='futago-pair'?24:1)===stageNumber)){
              const row={...planned,status:'starting-outcome',samples:[],...acceptance()};report.outcomeCases.push(row);
              try{await withNativeGameCaseDeadline(()=>captureNativeOutcomeCase(page,row,{out,onFailure:fail}),closeOwned,
                {onDeadline:error=>{row.deadlineExpired=true;fail(error);}});}
              catch(error){row.status='failed';row.error=String(error);fail(error);}
              await persist();if(page.isClosed())break;
            }
          }
        }catch(error){fail(error);}
        finally{try{await closeOwned();}catch{/* raw failure is already retained */}}
      }
    }
  }catch(error){fail(error);}
  finally{
    if(browser){closingBrowser=true;report.browserCleanup='pending';await persist();
      try{await closeNativeGameContext(browser);report.browserCleanup='completed';}
      catch(error){report.browserCleanup='failed';fail(error);}}
    report.unexecuted=plan.filter(p=>!report.cases.some(r=>r.caseId===p.caseId)).map(p=>p.caseId);
    report.manualUnexecuted=manualPlan.filter(p=>!report.manualCases.some(r=>r.caseId===p.caseId)).map(p=>p.caseId);
    report.outcomeUnexecuted=outcomePlan.filter(p=>!report.outcomeCases.some(r=>r.caseId===p.caseId)).map(p=>p.caseId);
    report.status=report.errors.length||report.unexecuted.length||report.manualUnexecuted.length||report.outcomeUnexecuted.length
      ||report.outcomeCases.some(r=>r.status!=='observed-outcome-diagnostic')
      ||report.manualCases.some(r=>r.status!=='observed-manual-diagnostic')||report.cases.some(r=>r.status!=='observed-diagnostic')
      ||report.contexts.some(c=>c.cleanup!=='completed')?'failed':'completed-diagnostic';
    await persist();
  }
  console.log(JSON.stringify({head:report.head,shard:binding.shardId,status:report.status,
    attempted:report.cases.length,unexecuted:report.unexecuted.length,manualAttempted:report.manualCases.length,manualUnexecuted:report.manualUnexecuted.length,
    outcomeAttempted:report.outcomeCases.length,outcomeUnexecuted:report.outcomeUnexecuted.length,errors:report.errors,...acceptance()}));
  if(primary)throw primary;assert.equal(report.status,'completed-diagnostic');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  setImmediate(()=>main().catch(error=>{console.error(error);process.exitCode=1;}));
}
