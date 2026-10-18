import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {nativeGameCaptureBinding,withNativeGameCaseDeadline,closeNativeGameContext,
  NATIVE_GAME_CAPTURE_SOURCES} from './v177-native-game-capture-browser.mjs';
import {SHARDS,VIEWPORTS,FORM_BINDINGS,planShard,assertRetainedBindings} from './v177-native-allunit-manifest.mjs';
import {captureAllUnitCase} from './v177-native-allunit-cases.mjs';

const git=args=>execFileSync('git',args,{encoding:'utf8',maxBuffer:8*1024*1024,windowsHide:true}).trim();
const sha=b=>createHash('sha256').update(b).digest('hex');
const acceptance=()=>({originalSpeedAccepted:false,naturalnessAccepted:false,
  physicalSavedAudioAccepted:false,normalCampaignAccepted:false,wholeGameAccepted:false});
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
  'scripts/v177-native-allunit-cases.mjs','scripts/v177-native-allunit-manifest.mjs',
  'scripts/v177-native-allunit-contract.mjs','scripts/v177-native-allunit-owners.mjs',
  'tests/v177-native-allunit.test.mjs','scripts/v100-normal-tactical-input.mjs',
  'scripts/ordered-native-pointer.mjs','scripts/v100-phase-g-runtime-evidence.mjs',
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
  const binding=await nativeAllUnitBinding(),plan=planShard(binding.shardId);
  const deps=Object.assign({},...await Promise.all([
    import('./pwa-browser-runtime.mjs'),import('./browser-qa-build-identity.mjs'),
    import('./browser-request-failure-audit.mjs'),import('./v100-title-qa-entry.mjs'),
    import('../app/v100Registry.js'),import('../app/v100Save.js'),
  ]));
  const out=process.env.V177_NATIVE_ALLUNIT_OUT??'outputs/v177-native-allunit';
  const origin=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
  assert.equal(origin.protocol,'http:');assert.equal(origin.hostname,'127.0.0.1');
  const report={at:new Date().toISOString(),...binding,tree:git(['rev-parse','HEAD^{tree}']),
    engine:'webkit',runtime:deps.PWA_WEBKIT_RUNTIME,build:await deps.productionBuildIdentity(),
    status:'running-diagnostic',plan,sources:[],contexts:[],cases:[],errors:[],persistenceErrors:[],...acceptance(),
    scope:'One of six all48 native VP8 shards. Original free RAF/simulation after actual recorder start. Ordinary actors use original stats; Mayo uses real trusted activation/self-drain; turned continues the actual infection newborn; split twins use their real S24 pair constructors with a deliberately partial encounter. Legacy fused art is an explicit fixture. Controlled target diagnostics are not campaign, balance, original-speed naturalness or physical audio acceptance.'};
  await mkdir(out,{recursive:true});report.sources=await retainAllUnitSources(out);
  for(const row of plan)assertRetainedBindings(row,{...report,expectedHead:binding.head,files:report.sources});
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
        const rows=plan.filter(r=>r.viewport.width===viewport.width&&r.viewport.height===viewport.height
          &&(r.owner==='futago-pair'?24:1)===stageNumber);
        if(!rows.length)continue;
        const contextOptions={viewport,isMobile:viewport.width<1000,hasTouch:viewport.width<1000,deviceScaleFactor:1};
        const owner={viewport,stageNumber,contextOptions,cleanup:'not-created',requests:null};report.contexts.push(owner);
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
          page.on('pageerror',fail);page.on('console',m=>{if(m.type()==='error')fail(Error(m.text()));});
          page.on('response',r=>{if(r.status()>=400)fail(Error(r.status()+' '+r.url()));});
          const base=deps.createDefaultV100Save(),owned=deps.V100_UNITS.map(u=>u.id),stageId=deps.V100_STAGE_IDS[stageNumber-1];
          const save=deps.normalizeV100Save({...base,campaignStarted:true,revision:3,ownedUnitIds:owned,
            registeredUnitIds:owned,availableStageIds:deps.V100_STAGE_IDS,formationSlots:owned.slice(0,7),
            flowState:{phase:'formation',stageId,stageNumber,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
          await withNativeGameCaseDeadline(async()=>{
            await page.addInitScript(deps.seedV100BrowserSaveOnce,deps.serializeV100Save(save));
            const url=new URL('v100',origin);url.searchParams.set('phase-g','1');await page.goto(url.href);
            const play=page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true});
            await play.or(page.locator('.v100-start-screen')).first().waitFor();if(await play.isVisible())await play.click();
            await deps.enterV100FromTitle(page);await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
            await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
            const forms=[...new Set(rows.flatMap(r=>[r.form,r.binding.kind,r.binding.side==='human'?'walker':'guardian',
              ...(r.owner==='turned-birth'?['brawler','turned']:[])]))];
            await page.evaluate(async forms=>{
              const qa=window.__ASHFALL_BATTLE_QA__;
              for(const form of forms)await qa.ensureEnemyFacingProofAsset(form);
            },forms);
          },closeOwned,{onDeadline:fail});
          for(const planned of rows){
            const row={...planned,status:'starting',samples:[],...acceptance()};report.cases.push(row);
            try{await withNativeGameCaseDeadline(()=>captureAllUnitCase(page,row,{out,onFailure:fail}),closeOwned,
              {onDeadline:error=>{row.deadlineExpired=true;fail(error);}});}
            catch(error){row.status='failed';row.error=String(error);row.operationSettledAtOwnerReturn=error.operationSettledAtOwnerReturn??null;fail(error);await persist();break;}
            await persist();
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
    report.status=report.errors.length||report.unexecuted.length||report.cases.some(r=>r.status!=='observed-diagnostic')
      ||report.contexts.some(c=>c.cleanup!=='completed')?'failed':'completed-diagnostic';
    await persist();
  }
  console.log(JSON.stringify({head:report.head,shard:binding.shardId,status:report.status,
    attempted:report.cases.length,unexecuted:report.unexecuted.length,errors:report.errors,...acceptance()}));
  if(primary)throw primary;assert.equal(report.status,'completed-diagnostic');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  setImmediate(()=>main().catch(error=>{console.error(error);process.exitCode=1;}));
}
