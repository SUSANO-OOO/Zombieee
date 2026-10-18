// Output-only runnable proposal. Guard runs before any server/browser/output creation.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {assertGraphHostedPlatform,assertGraphEventBinding,assertGraphObservation,GRAPH_LIMITS as L} from './v177-native-aac-graph-contract.mjs';
const ROOT='/__v177-aac-graph',HERE=path.dirname(fileURLToPath(import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(repo,args)=>execFileSync('git',args,{cwd:repo,encoding:'buffer',maxBuffer:10*1024*1024});
export const DI_WRAPPER=`export {usesNativeMediaOutput,audioContextTimingSnapshot} from './audioOutput-original.js';\nimport {graphOutputForContext} from '../probe/v177-native-aac-graph-output.mjs';\nexport function createAudioOutput(context,options={}){return graphOutputForContext(context,options);}\n`;
export async function buildGraphRoutes(repo,{requireExactHead=true}={}){
  const head=git(repo,['rev-parse','HEAD']).toString().trim(),tree=git(repo,['rev-parse','HEAD^{tree}']).toString().trim();
  const originalPins=JSON.parse(await fs.readFile(path.join(HERE,'v177-native-aac-graph-pins.json'),'utf8'));
  const routes=new Map(),sourcePins=[];
  async function add(url,relative,type='text/javascript'){
    const bytes=await fs.readFile(path.join(repo,relative)),committed=git(repo,['show','HEAD:'+relative]);
    if(requireExactHead)assert.ok(bytes.equals(committed),'Raw served file differs from exact HEAD: '+relative);
    const expected=originalPins.audio7.find(row=>row.path===relative);if(expected)assert.equal(sha(committed),expected.gitSha256,'Scoped original audio source changed: '+relative);
    const row={path:relative,url,bytes:bytes.length,sha256:sha(bytes),gitBlob:createHash('sha1').update(Buffer.from(`blob ${committed.length}\0`)).update(committed).digest('hex')};
    sourcePins.push(row);if(url)routes.set(url,{bytes,type,source:relative,sha256:row.sha256});return bytes;
  }
  for(const name of ['audioMixer.js','audioManifest.js','audioSession.js','endingAudioMix.js'])await add(ROOT+'/app/'+name,'app/'+name);
  await add(ROOT+'/app/audioOutput-original.js','app/audioOutput.js');routes.set(ROOT+'/app/audioOutput.js',{bytes:Buffer.from(DI_WRAPPER),type:'text/javascript',source:'experimental factory wrapper only'});
  for(const name of ['v177-native-aac-graph-page.mjs','v177-native-aac-graph-output.mjs','v177-native-aac-graph-contract.mjs','v177-native-aac-graph-worklet.mjs','v177-graph-pcm-framer.mjs']){
    const bytes=await fs.readFile(path.join(HERE,name));if(requireExactHead)assert.ok(bytes.equals(git(repo,['show','HEAD:scripts/'+name])),'Proposal module is not exact HEAD: '+name);routes.set(ROOT+'/probe/'+name,{bytes,type:'text/javascript',source:'scripts/'+name,sha256:sha(bytes)});sourcePins.push({path:'scripts/'+name,bytes:bytes.length,sha256:sha(bytes),proposal:true});
  }
  for(const name of ['v177-native-aac-graph-browser.mjs','v177-native-aac-graph-pins.json']){const bytes=await fs.readFile(path.join(HERE,name));if(requireExactHead)assert.ok(bytes.equals(git(repo,['show','HEAD:scripts/'+name])),'Driver/pins are not exact HEAD: '+name);sourcePins.push({path:'scripts/'+name,bytes:bytes.length,sha256:sha(bytes),proposal:true});}
  await add(ROOT+'/probe/v177-aac-fragment-muxer.mjs','scripts/v177-aac-fragment-muxer.mjs');
  for(const p of ['scripts/v177-native-aac-browser.mjs','scripts/v177-native-aac-probe.mjs'])await add(null,p);
  for(const p of ['app/productionAudio.js','scripts/pwa-native-runtime/package-lock.json','scripts/browser-request-failure-audit.mjs'])await add(null,p);
  const {V100_AUDIO_MANIFEST}=await import(pathToFileURL(path.join(repo,'app/productionAudio.js')).href);
  const manifest=Buffer.from(JSON.stringify(V100_AUDIO_MANIFEST));routes.set(ROOT+'/manifest.json',{bytes:manifest,type:'application/json',source:'serialized original V100_AUDIO_MANIFEST',sha256:sha(manifest)});
  const assets=[];
  for(const id of ['music-v100-score-normal','weapon-rifle-01']){
    const asset=V100_AUDIO_MANIFEST.assetById[id];assert.ok(asset,'Original diagnostic asset is missing');
    for(const item of asset.sources){assert.ok(item.src.startsWith('/audio/')&&!item.src.includes('..'));const bytes=await add(item.src,'public'+item.src,item.type??'application/octet-stream');assets.push({id,src:item.src,bytes:bytes.length,sha256:sha(bytes)});}
  }
  const html=Buffer.from('<!doctype html><meta charset="utf-8"><title>One prewarmed original audio graph</title><button id="warm" disabled>Warm original graph</button><button id="start" disabled>Start original BGM</button><button id="rifle" disabled>Fire original rifle</button><script type="module" src="'+ROOT+'/probe/v177-native-aac-graph-page.mjs"></script>');
  routes.set(ROOT,{bytes:html,type:'text/html',source:'diagnostic-only blank page'});
  return{routes,sourcePins,assets,head,tree,manifest:{bytes:manifest.length,sha256:sha(manifest)},originalPins};
}
export function makeGraphHandler(bundle,out,log){
  const httpError=error=>{if(log.errors.length<16)log.errors.push(String(error));else log.errorOverflow=(log.errorOverflow??0)+1;};
  const files=new Map([['postbus-pcm.f32-planar.bin',L.pcmBytes],['native-packets.aac.bin',L.encodedBytes],['native-stream.m4a',L.muxedBytes],['raw.json',2*1024*1024]]),written=new Set();
  return async(req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1').pathname;
    if(log.requests.length>=256){httpError('Bounded HTTP request evidence exhausted');res.writeHead(503).end();return;}
    log.requests.push({path:url,method:req.method,at:new Date().toISOString()});
    try{
      if(req.method==='GET'&&url==='/favicon.ico'){res.writeHead(204).end();return;}
      const entry=bundle.routes.get(url);if(req.method==='GET'&&entry){res.writeHead(200,{'Content-Type':entry.type,'Content-Length':entry.bytes.length,'Cache-Control':'no-store'});res.end(entry.bytes);return;}
      if(req.method==='POST'&&url.startsWith(ROOT+'/evidence/')){
        const name=url.slice((ROOT+'/evidence/').length),cap=files.get(name);assert.ok(cap,'Unexpected evidence path');assert.ok(!written.has(name),'Duplicate evidence cannot overwrite original bytes');written.add(name);
        let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;assert.ok(size<=cap,'Bounded evidence body exhausted: '+name);chunks.push(chunk);}
        const bytes=Buffer.concat(chunks),receipt={file:name,bytes:bytes.length,sha256:sha(bytes)};await fs.writeFile(path.join(out,name),bytes,{flag:'wx'});log.artifacts.push(receipt);res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(receipt));return;
      }
      httpError('Unexpected HTTP route '+req.method+' '+url);res.writeHead(404).end('Not found');
    }catch(error){log.errors.push(String(error));if(!res.headersSent)res.writeHead(500);res.end('Diagnostic request failed');}
  };
}
async function deadline(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' exceeded '+ms+'ms')),ms);})]);}finally{clearTimeout(timer);}}
export async function runGraphProbe({platform=process.platform,env=process.env,repo=process.cwd()}={}){
  assertGraphHostedPlatform(platform,env); // No output, server or browser before this guard.
  const head=git(repo,['rev-parse','HEAD']).toString().trim();assert.equal(head,env.V177_GRAPH_EXPECTED_HEAD,'Checkout is not the exact requested candidate');
  let event=null;if(env.GITHUB_EVENT_NAME==='pull_request'){assert.ok(env.GITHUB_EVENT_PATH,'PR event file is required');event=JSON.parse(await fs.readFile(env.GITHUB_EVENT_PATH,'utf8'));}
  const eventBinding=assertGraphEventBinding(env,head,event);
  git(repo,['diff','--quiet','HEAD','--']);
  const bundle=await buildGraphRoutes(repo);const out=path.resolve(repo,env.V177_GRAPH_OUT??'outputs/v177-native-aac-graph');assert.ok(out.startsWith(path.resolve(repo)+path.sep),'Output must stay inside this checkout');
  await fs.mkdir(path.dirname(out),{recursive:true});await fs.mkdir(out,{recursive:false});
  const report={schema:'v177-one-real-graph-native-probe/v1',at:new Date().toISOString(),status:'running',terminal:false,reportRole:'progress',eventBinding,head:bundle.head,tree:bundle.tree,platform,hosted:true,scope:'One prewarmed original AudioMixer BGM+rifle; no game/build/default backend change',sourcePins:bundle.sourcePins,manifest:bundle.manifest,assets:bundle.assets,errors:[],cleanupErrors:[],http:{requests:[],errors:[],artifacts:[]},physicalRecordingAccepted:false,coldAccepted:false,endingAccepted:false,lifecycleAccepted:false,productionBackendAccepted:false,wholeGameAccepted:false};
  report.diWrapper={bytes:Buffer.byteLength(DI_WRAPPER),sha256:sha(Buffer.from(DI_WRAPPER))};await fs.writeFile(path.join(out,'source__app__audioOutput-DI.js'),DI_WRAPPER,{flag:'wx'});
  for(const row of bundle.sourcePins){const bytes=row.proposal?await fs.readFile(path.join(HERE,path.basename(row.path))):await fs.readFile(path.join(repo,row.path));await fs.writeFile(path.join(out,'source__'+row.path.replaceAll('/','__')),bytes,{flag:'wx'});}
  await fs.writeFile(path.join(out,'original-manifest.json'),bundle.routes.get(ROOT+'/manifest.json').bytes,{flag:'wx'});
  const write=(name)=>fs.writeFile(path.join(out,name),JSON.stringify(report,null,2)+'\n');await write('report-progress.json');
  const addError=error=>{if(report.errors.length<64)report.errors.push(String(error));else report.errorOverflow=(report.errorOverflow??0)+1;};
  let server,browser,context,page,audit,primaryError=null;const ownerDeadline=Date.now()+L.rowDeadlineMs;
  const step=(promise,label,max=L.rowDeadlineMs)=>{const left=ownerDeadline-Date.now();if(left<=0)throw new Error('Original30s row deadline expired before '+label);return deadline(promise,Math.min(left,max),label).then(value=>{assert.ok(Date.now()<=ownerDeadline,'Late result cannot promote an expired row');return value;});};
  // Trusted input is invoked lazily only after the original owner deadline check.
  // Recheck at dispatch and pass the current residual to Playwright itself.
  const actionStep=(action,label,max=L.readyMs)=>{
    const left=ownerDeadline-Date.now();if(left<=0)throw new Error('Original30s row deadline expired before '+label);
    const pending=Promise.resolve().then(()=>{
      const remaining=ownerDeadline-Date.now();if(remaining<=0)throw new Error('Original30s row deadline expired before '+label);
      return action(Math.min(remaining,max));
    });
    return deadline(pending,Math.min(left,max),label).then(value=>{assert.ok(Date.now()<=ownerDeadline,'Late result cannot promote an expired row');return value;});
  };
  try{
    const root=path.join(repo,'scripts/pwa-native-runtime/node_modules');const pkg=JSON.parse(await fs.readFile(path.join(root,'playwright/package.json'),'utf8')),browsers=JSON.parse(await fs.readFile(path.join(root,'playwright-core/browsers.json'),'utf8'));
    const record=browsers.browsers.find(row=>row.name==='webkit');assert.equal(pkg.version,'1.63.0');assert.equal(record.revision,'2359');assert.equal(record.browserVersion,'26.6');report.runtime={packageVersion:pkg.version,...record};
    const {webkit}=await import(pathToFileURL(path.join(root,'playwright/index.mjs')).href);assert.ok(webkit.executablePath().includes('webkit-2359'),'Pinned WebKit2359 is required');
    server=createServer(makeGraphHandler(bundle,out,report.http));await step(new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);}), 'Source-only HTTP listen',L.readyMs);
    report.origin='http://127.0.0.1:'+server.address().port;
    // Process boot has its own budget. It still belongs to the original30s
    // row, and must never pass timeout0 (unbounded) to Playwright after expiry.
    const launchState={status:'pending',resource:null},launchPromise=Promise.resolve().then(()=>{
      const remaining=ownerDeadline-Date.now();
      if(remaining<=0)throw new Error('Original30s row deadline expired before Pinned hosted WebKit launch');
      return webkit.launch({timeout:Math.min(remaining,L.browserLaunchMs)});
    });
    let abandonedLaunch=false,lateCloseStarted=false;
    async function saveLateOwnership(){try{await fs.writeFile(path.join(out,'late-browser-cleanup.json'),JSON.stringify({head:report.head,tree:report.tree,primaryError:report.primaryError??String(primaryError),ownership:report.lateBrowserOwnership},null,2)+'\n');}catch(error){report.lateOwnershipPersistenceError=String(error);console.error(JSON.stringify({scope:'late-browser-cleanup-persistence',primaryError:report.primaryError,secondary:String(error)}));}}
    function closeLateBrowser(resource){if(lateCloseStarted)return;lateCloseStarted=true;report.lateBrowserOwnership={owner:'late-browser',status:'closing',cleanupDeadlineMs:L.cleanupMs};void(async()=>{try{await deadline(Promise.resolve().then(()=>resource.close()),L.cleanupMs,'Late owned browser cleanup');report.lateBrowserOwnership.status='closed';}catch(error){report.lateBrowserOwnership.status='close-failed';report.lateBrowserOwnership.secondaryError=String(error);report.cleanupErrors.push({owner:'late-browser',error:String(error),secondary:true});}finally{await saveLateOwnership();}})();}
    void launchPromise.then(resource=>{launchState.status='resolved';launchState.resource=resource;if(abandonedLaunch)closeLateBrowser(resource);},error=>{launchState.status='rejected';if(abandonedLaunch){report.lateBrowserOwnership={owner:'late-browser',status:'launch-rejected-no-resource',secondaryLaunchError:String(error)};void saveLateOwnership();}});
    try{browser=await step(launchPromise,'Pinned hosted WebKit launch',L.browserLaunchMs);}catch(error){abandonedLaunch=true;if(launchState.resource)closeLateBrowser(launchState.resource);else report.lateBrowserOwnership={owner:'late-browser',status:launchState.status==='pending'?'awaiting-late-settlement':'launch-rejected-no-resource',evidenceFile:'late-browser-cleanup.json'};throw error;}
    report.browserVersion=browser.version();
    context=await step(browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_7_1 like Mac OS X) AppleWebKit/605.1.15 Version/26.7 Mobile/15E148 Safari/604.1'}),'Owned browser context',L.readyMs);
    page=await step(context.newPage(),'Owned blank page',L.readyMs);const {installRequestFailureAudit}=await import(pathToFileURL(path.join(repo,'scripts/browser-request-failure-audit.mjs')).href);audit=installRequestFailureAudit(page);
    page.on('pageerror',addError);page.on('console',message=>{if(message.type()==='error')addError(message.text());});page.on('response',response=>{if(response.status()>=400)addError(response.status()+' '+response.url());});
    await step(page.goto(report.origin+ROOT),'Raw module diagnostic navigation',L.readyMs);
    await step(page.waitForFunction(()=>document.documentElement.dataset.graphPrepared==='1'||document.documentElement.dataset.graphComplete==='1',null,{timeout:L.readyMs}),'Raw module setup',L.readyMs);
    await actionStep(timeout=>page.getByRole('button',{name:'Warm original graph',exact:true}).click({timeout}),'Trusted warm click',L.readyMs);
    await actionStep(timeout=>page.getByRole('button',{name:'Start original BGM',exact:true}).click({timeout}),'Trusted original BGM click',L.readyMs);
    await step(new Promise(resolve=>setTimeout(resolve,1000)),'One-second rifle interval',1500);
    await actionStep(timeout=>page.getByRole('button',{name:'Fire original rifle',exact:true}).click({timeout}),'Trusted original rifle click',L.readyMs);
    const completion=await step(page.evaluate(()=>globalThis.__graphCompletion),'Original graph completion',L.completionMs);
    report.pageCompletion=completion;
    const originalError=value=>value&&typeof value==='object'&&typeof value.message==='string'?value:new Error(String(value));
    const completionError=completion?.primaryError?originalError(completion.primaryError):completion?.status==='failed'?new Error('Page reported failed without its original error'):null;
    if(completionError)report.pagePrimaryError=typeof completion.primaryError==='string'?completion.primaryError:String(completionError.stack??completionError);
    let raw;
    try{const bytes=await fs.readFile(path.join(out,'raw.json'));report.rawSha256=sha(bytes);raw=JSON.parse(bytes.toString());report.rawStatus=raw.status;report.rawPrimaryError=raw.primaryError;}catch(error){report.rawReadFailure=String(error.stack??error);if(!completionError)throw error;}
    if(completionError)throw completionError;
    if(raw.primaryError)throw originalError(raw.primaryError);
    report.observation=assertGraphObservation(raw);
    for(const row of report.http.artifacts){const bytes=await fs.readFile(path.join(out,row.file));assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);}
    assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert.equal(report.http.errors.length,0,JSON.stringify(report.http.errors));report.status='limited-prewarmed-graph-clock-pass';
  }catch(error){primaryError=error;report.primaryError=report.pagePrimaryError??report.rawPrimaryError??String(error?.stack??error);report.status='failed';
    if(page){try{const partial=await deadline(page.evaluate(()=>globalThis.__graphState??null),1000,'Partial graph read');await fs.writeFile(path.join(out,'partial-raw.json'),JSON.stringify({lateDiagnosticOnly:true,state:partial},null,2),{flag:'wx'});}catch(partialError){report.partialReadFailure=String(partialError);}}
  }finally{
    for(const [name,close]of [['context',()=>audit?audit.closeContext(context):context?.close()],['browser',()=>browser?.close()],['server',()=>server?new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())):Promise.resolve()]]){
      try{await deadline(Promise.resolve().then(close),L.cleanupMs,'Owned '+name+' cleanup');}catch(error){report.cleanupErrors.push({owner:name,error:String(error)});primaryError??=error;if(name==='server')server?.closeAllConnections();}
    }
    try{for(const row of bundle.sourcePins){const bytes=await fs.readFile(row.proposal?path.join(HERE,path.basename(row.path)):path.join(repo,row.path));assert.equal(sha(bytes),row.sha256,'Source changed during owned observation: '+row.path);}report.sourceBytesUnchangedAfter=true;}catch(error){addError(error);primaryError??=error;}
    report.requests=audit?.report??null;if(report.errors.length||report.errorOverflow||report.http.errors.length||report.http.errorOverflow||report.cleanupErrors.length||audit?.report.unexpectedFailures.length){primaryError??=new Error('Original errors/requests/cleanup failed');report.status='failed';}
    if(primaryError){report.status='failed';report.primaryError??=String(primaryError.stack??primaryError);}
    report.finishedAt=new Date().toISOString();report.terminal=true;report.reportRole='terminal';
    try{await write('report.json');}catch(error){
      primaryError??=error;report.status='failed';report.primaryError??=String(primaryError.stack??primaryError);report.persistenceErrors??=[];report.persistenceErrors.push({file:'report.json',error:String(error),secondary:primaryError!==error});
      try{await write('report-failed.json');}catch(fallbackError){report.persistenceErrors.push({file:'report-failed.json',error:String(fallbackError),secondary:true});console.error(JSON.stringify({scope:'terminal-report-persistence-failed',status:'failed',primaryError:report.primaryError,persistenceErrors:report.persistenceErrors}));}
    }
  }
  if(primaryError)throw primaryError;return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))runGraphProbe().then(report=>console.log(JSON.stringify({status:report.status,head:report.head,physicalRecordingAccepted:false,productionBackendAccepted:false})),error=>{console.error(error?.stack??error);process.exitCode=1;});