// One-off adhoc QA-branch reference; replace scripts/pwa-official-existing-profile.mjs only on that branch.
// No save seed, worker-byte modification, OS installation, game setter, or release operation.
// Hosted Chromium's retained origin/profile proof only. Root workflow owns the verified prepare artifact transfer.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,readdir,lstat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {isDeepStrictEqual} from 'node:util';
import {V100_PRIMARY_STORAGE_KEY} from '../app/v100Save.js';
import {pwaBrowserType} from './pwa-browser-runtime.mjs';
import {installRequestFailureAudit} from './browser-request-failure-audit.mjs';
import {enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {inspectV177InstalledSaveTransition} from './v177-installed-save-contract.mjs';

const mode=process.env.PWA_OFFICIAL_PROFILE_MODE;
const browserName=process.env.PWA_OFFICIAL_PROFILE_BROWSER??'chromium';
const officialUrl=new URL(process.env.PWA_OFFICIAL_PROFILE_URL??'https://susano-ooo.github.io/Zombieee/');
const expected={version:process.env.PWA_OFFICIAL_PROFILE_EXPECTED_VERSION?.trim(),releaseSha:process.env.PWA_OFFICIAL_PROFILE_EXPECTED_SHA?.trim(),requestId:process.env.PWA_OFFICIAL_PROFILE_EXPECTED_REQUEST_ID?.trim(),issue:process.env.PWA_OFFICIAL_PROFILE_EXPECTED_ISSUE?.trim()};
assert.ok(['prepare','verify'].includes(mode));
assert.equal(browserName,'chromium');
assert.equal(officialUrl.href,'https://susano-ooo.github.io/Zombieee/');
assert.equal(process.platform,'linux'); assert.equal(process.arch,'x64');
assert.equal(process.env.GITHUB_ACTIONS,'true'); assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
assert.ok(process.env.PWA_OFFICIAL_PROFILE_DIR&&process.env.PWA_OFFICIAL_PROFILE_EVIDENCE_DIR);
assert.equal(expected.version,mode==='prepare'?'1.0.3':'1.0.5');
assert.match(expected.releaseSha??'',/^[0-9a-f]{40}$/u);
if(mode==='prepare')assert.equal(expected.releaseSha,'99f9c193ab1e35531db39225c839138cdb1c33cd');
if(mode==='verify'){assert.ok(expected.requestId);assert.match(expected.issue??'',/^[1-9]\d*$/u);}
const profileDir=path.resolve(process.env.PWA_OFFICIAL_PROFILE_DIR);
const evidenceDir=path.resolve(process.env.PWA_OFFICIAL_PROFILE_EVIDENCE_DIR);
const contractPath=path.resolve(process.env.PWA_OFFICIAL_PROFILE_CONTRACT??profileDir+'.contract.json');
const inside=(parent,child)=>{const r=path.relative(parent,child);return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));};
assert.ok(!inside(profileDir,evidenceDir)&&!inside(profileDir,contractPath),'Evidence and contract must be outside the closed profile');
const entries=p=>readdir(p).catch(e=>e.code==='ENOENT'?[]:Promise.reject(e));
assert.equal((await entries(evidenceDir)).length,0,'Evidence must be new or empty');
await mkdir(evidenceDir,{recursive:true});
await mkdir(path.dirname(profileDir),{recursive:true});
const sha256=value=>createHash('sha256').update(value).digest('hex');
const legacySaveKey='nishijin-campaign-v1',v100SaveKey=V100_PRIMARY_STORAGE_KEY;
const browserType=await pwaBrowserType(browserName);
const report={mode,status:'running',officialUrl:officialUrl.href,profileDir,contractPath,emulatedStandaloneOnly:true,physicalInstallAccepted:false,physicalAudioAccepted:false,humanListeningAccepted:false,wholeGameAccepted:false,seedSaveUsed:false,legacyWriteObservationEnabled:false,archiveReady:false,steps:[],errors:[],cleanup:[],diagnostics:{consoleErrors:[],pageErrors:[],httpErrors:[],requestFailures:[],teardown:[]},owner:{head:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,ref:process.env.GITHUB_REF}};
const reportPath=path.join(evidenceDir,'pwa-official-existing-profile-'+mode+'-chromium.json');
let context=null,page=null,requestAudit=null,phase='preflight',closeUnconfirmed=false,contract=null;
report.requestAudits=[];
const persist=()=>writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
const git=args=>execFileSync('git',args,{encoding:'utf8',timeout:5000,maxBuffer:1024*1024}).trim();
async function qaSourceIdentity(){
  const head=git(['rev-parse','HEAD']);assert.equal(head,process.env.GITHUB_SHA);assert.equal(head,process.env.EXPECTED_HEAD);
  const files=['scripts/pwa-browser-runtime.mjs','scripts/v100-title-qa-entry.mjs','scripts/v177-installed-save-contract.mjs',
    'scripts/browser-request-failure-audit.mjs','app/v100Save.js'];
  git(['diff','--exit-code','HEAD','--','app',...files]);
  const dependencies={appTree:git(['rev-parse','HEAD:app']),files:{}};
  for(const file of files)dependencies.files[file]=sha256(await readFile(new URL('../'+file,import.meta.url)));
  return {head,dependencies};
}
// Original official-profile bounds: action/API30s, navigation/save/UI90s,
// initial pack420s, worker-state message5s, active/update180s, poll250ms.
// Outer owner also bounds original navigator.serviceWorker.ready / IDB / close promises.
async function bounded(label,ms,operation){let timer;const started=performance.now();try{const result=await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' exceeded '+ms+'ms')),ms);})]);if(performance.now()-started>=ms)throw Error(label+' completed after '+ms+'ms');return result;}finally{clearTimeout(timer);report.steps.push({phase,label,budgetMs:ms,elapsedMs:performance.now()-started});}}
async function runtimeIdentity(){
  const pkg=JSON.parse(await readFile(new URL('../node_modules/playwright/package.json',import.meta.url)));
  const bytes=await readFile(new URL('../node_modules/playwright-core/browsers.json',import.meta.url));
  const browsers=JSON.parse(bytes).browsers;
  const chromium=browsers.find(b=>b.name==='chromium'),shell=browsers.find(b=>b.name==='chromium-headless-shell');
  assert.equal(pkg.version,'1.56.1');assert.equal(chromium.revision,'1194');assert.equal(shell.revision,'1194');
  return {platform:process.platform,arch:process.arch,osRelease:os.release(),osReleaseFileSha256:sha256(await readFile('/etc/os-release')),node:process.version,playwright:pkg.version,browsersSha256:sha256(bytes),chromium,shell,packageLockSha256:sha256(await readFile(new URL('../package-lock.json',import.meta.url)))};
}
async function openProfile(){
  try{context=await bounded('persistent Chromium launch',30000,()=>browserType.launchPersistentContext(profileDir,{headless:true,viewport:{width:844,height:390},deviceScaleFactor:3,hasTouch:true,serviceWorkers:'allow'}));}
  catch(error){closeUnconfirmed=true;throw error;}
  context.setDefaultTimeout(30000);context.setDefaultNavigationTimeout(90000);
  assert.equal(context.browser().version(),report.runtime.chromium.browserVersion);
  // Existing official-profile standalone fixture, explicitly emulated; no Storage/IDB seeding or product setter.
  await bounded('standalone fixture',30000,()=>context.addInitScript(()=>{Object.defineProperty(navigator,'standalone',{value:true,configurable:true});}));
  page=context.pages()[0]??await bounded('new page',30000,()=>context.newPage());
  requestAudit=installRequestFailureAudit(page);report.requestAudits.push(requestAudit.report);
  page.on('console',m=>{if(m.type()==='error')report.diagnostics.consoleErrors.push({phase,message:m.text()});});
  page.on('pageerror',e=>report.diagnostics.pageErrors.push({phase,error:String(e)}));
  page.on('response',r=>{if(r.status()>=400)report.diagnostics.httpErrors.push({phase,url:r.url(),status:r.status()});});
}
async function closeProfile(){
  if(!context)return;const owned=context,audit=requestAudit;
  try{await bounded('persistent context close',30000,()=>audit?audit.closeContext(owned):owned.close());context=null;requestAudit=null;report.cleanup.push({phase,closed:true});}
  catch(e){closeUnconfirmed=true;report.cleanup.push({phase,closed:false,error:String(e)});throw e;}

}

function metaValue(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`<meta\\s+name=["']${escaped}["']\\s+content=["']([^"']*)["']`, "iu").exec(html)?.[1] ?? null;
}

async function readPublishedIdentity(openedContext) {
  const nonce = `official-profile-${Date.now()}`;
  const headers = { "cache-control": "no-cache", pragma: "no-cache" };
  const [htmlResponse, manifestResponse] = await Promise.all([
    openedContext.request.get(`${officialUrl.toString()}?${nonce}`, { headers }),
    openedContext.request.get(new URL(`asset-manifest.json?${nonce}`, officialUrl).toString(), { headers }),
  ]);
  const htmlBytes = await htmlResponse.body();
  const manifestBytes = await manifestResponse.body();
  const html = htmlBytes.toString("utf8");
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  return {
    htmlStatus: htmlResponse.status(),
    manifestStatus: manifestResponse.status(),
    htmlBytes: htmlBytes.byteLength,
    htmlSha256: sha256(htmlBytes),
    manifestBytes: manifestBytes.byteLength,
    manifestSha256: sha256(manifestBytes),
    version: metaValue(html, "github-pages-version"),
    releaseSha: metaValue(html, "github-pages-release"),
    requestId: metaValue(html, "github-pages-request-id"),
    issue: metaValue(html, "github-pages-issue"),
    base: metaValue(html, "github-pages-base"),
    manifest,
  };
}

async function getWorkerState(page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const ask = (message) => new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 5000);
      channel.port1.onmessage = (event) => { clearTimeout(timer); resolve(event.data ?? null); };
      const worker = registration.active ?? registration.waiting ?? registration.installing;
      if (!worker) { clearTimeout(timer); resolve(null); return; }
      worker.postMessage(message, [channel.port2]);
    });
    return {
      scope: registration.scope,
      activeState: await ask({ type: "pwa:get-state" }),
      activeScriptURL: registration.active?.scriptURL ?? null,
      activeWorkerState: registration.active?.state ?? null,
      waitingScriptURL: registration.waiting?.scriptURL ?? null,
      waitingWorkerState: registration.waiting?.state ?? null,
    };
  });
}

async function cacheState(page, manifest) {
  return page.evaluate(async (assets) => {
    const cache = await caches.open("zombieee-assets-v1");
    const keys = await cache.keys();
    const hashes = new Set(keys
      .filter((request) => new URL(request.url).pathname.includes("/__pwa-asset__/"))
      .map((request) => new URL(request.url).pathname.split("/").pop()));
    return {
      assetEntries: hashes.size,
      logicalSatisfied: assets.filter((asset) => hashes.has(asset.hash)).length,
      allEntries: keys.length,
    };
  }, manifest.assets);
}

async function v100State(page) {
  return page.evaluate(async ({ key, oldKey }) => {
    const raw = localStorage.getItem(key);
    const mirror = raw ? JSON.parse(raw) : null;
    const native = await new Promise((resolve, reject) => {
      const request = indexedDB.open(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("saves", "readonly");
        const get = transaction.objectStore("saves").get("current");
        let record = null;
        get.onsuccess = () => { record = get.result ?? null; };
        transaction.oncomplete = () => { db.close(); resolve({ database: db.name, record }); };
        transaction.onabort = () => reject(transaction.error);
      };
    });
    return {
      raw,
      mirror,
      native,
      oldRaw: localStorage.getItem(oldKey),
      legacyWrites: [...(window.__PWA_OFFICIAL_LEGACY_WRITES__ ?? [])],
    };
  }, { key: v100SaveKey, oldKey: legacySaveKey });
}

async function waitForV100Ready(page) {
  await page.waitForFunction(() => (
    document.querySelector(".v100-shell")
    && document.documentElement.dataset.pwaSaveMutationPending === "false"
  ), null, { timeout: 90_000 });
}

async function publishedIdentity(){
  const identity=await bounded('official HTML and manifest identity',30000,()=>readPublishedIdentity(context));
  assert.equal(identity.htmlStatus,200);assert.equal(identity.manifestStatus,200);
  for(const key of ['version','releaseSha']){assert.equal(identity[key],expected[key]);assert.equal(identity.manifest[key],expected[key]);}
  assert.ok(identity.requestId);assert.match(identity.issue??'',/^[1-9]\d*$/u);
  for(const key of ['requestId','issue'])if(expected[key])assert.equal(identity[key],expected[key]);
  assert.equal(identity.base,'/Zombieee/');assert.ok(identity.manifest.assets.length>0);
  const sw=await bounded('unmodified public SW bytes',30000,()=>context.request.get(new URL('sw.js',officialUrl).href,{headers:{'cache-control':'no-cache',pragma:'no-cache'}}));
  assert.equal(sw.status(),200);identity.workerBytesSha256=sha256(await bounded('SW response body',30000,()=>sw.body()));
  return identity;
}
async function activeVersion(identity){
  return bounded('active manifest exact identity',180000,async()=>{
    for(;;){const state=await getWorkerState(page);if(state?.activeWorkerState==='activated'&&state.activeState?.active?.version===identity.version&&state.activeState.active.releaseSha===identity.releaseSha)return state;await page.waitForTimeout(250);}
  });
}
async function ready(){await bounded('V100 save/UI ready',90000,()=>waitForV100Ready(page));}
async function snapshot(label,identity,{requirePageIdentity=true}={}){
  const result=await bounded(label+' storage/worker/UI snapshot',30000,async()=>{
    const worker=await getWorkerState(page),cache=await cacheState(page,identity.manifest),save=await v100State(page);
    const ui=await page.evaluate(()=>({url:location.href,title:document.title,version:document.querySelector('meta[name="github-pages-version"]')?.content??null,releaseSha:document.querySelector('meta[name="github-pages-release"]')?.content??null,standaloneFixture:navigator.standalone===true,displayModeStandalone:matchMedia('(display-mode: standalone)').matches,controllerURL:navigator.serviceWorker.controller?.scriptURL??null,controllerState:navigator.serviceWorker.controller?.state??null,savePending:document.documentElement.dataset.pwaSaveMutationPending??null,shell:!!document.querySelector('.v100-shell'),map:!!document.querySelector('.v100-map-layout'),titleScreen:!!document.querySelector('.v100-start-screen')}));
    return {label,worker,cache,save,ui};
  });
  report.steps.push(result);await persist();
  assert.equal(result.worker.scope,officialUrl.href);assert.equal(result.worker.activeWorkerState,'activated');
  assert.equal(result.worker.activeState?.active?.version,identity.version);assert.equal(result.worker.activeState.active.releaseSha,identity.releaseSha);
  assert.equal(result.cache.logicalSatisfied,identity.manifest.assets.length);
  assert.ok(result.ui.controllerURL);assert.equal(result.ui.controllerState,'activated');assert.equal(result.ui.standaloneFixture,true);
  assert.equal(result.ui.savePending,'false');assert.equal(result.ui.shell,true);
  if(requirePageIdentity){assert.equal(result.ui.version,identity.version);assert.equal(result.ui.releaseSha,identity.releaseSha);}
  if(requirePageIdentity&&result.ui.map){
    result.ui.displayedReleaseLabel=await page.locator('.v100-save-meta > span').first().textContent();
    assert.equal(result.ui.displayedReleaseLabel?.trim(),'Version '+identity.version,'Visible product version must match the published release');
  }
  assert.ok(result.save.raw&&result.save.mirror&&result.save.native?.record,'Real durable player save is required');
  assert.equal(result.save.native.database,v100SaveKey);
  // An R5 durable record may omit only the empty R9 metadata which the
  // production read adds to the mirror. Use the existing strict transition
  // contract here as well as between snapshots; keep both raw records.
  const durable={raw:result.save.native.record.serialized,
    mirror:JSON.parse(result.save.native.record.serialized),native:result.save.native};
  if(isDeepStrictEqual(durable.mirror,result.save.mirror)){
    result.durableMirrorTransition={preserved:true,durablePreserved:true,addedFields:[],changedPaths:[],comparison:'exact-json'};
  }else{
    result.durableMirrorTransition=inspectV177InstalledSaveTransition(durable,result.save);
    assert.equal(result.durableMirrorTransition.preserved,true,'Durable save and mirror may differ only by absent empty R9 metadata');
    assert.equal(result.durableMirrorTransition.durablePreserved,true);
  }
  result.screenshot=label+'.png';
  await bounded(label+' actual player screen',30000,()=>page.screenshot({path:path.join(evidenceDir,result.screenshot)}));
  return result;
}
function preserveSave(before,after,label){
  const exact=before.raw===after.raw&&JSON.stringify(before.native.record)===JSON.stringify(after.native.record);
  const transition=exact?{preserved:true,rawPreserved:true,durablePreserved:true,addedFields:[],changedPaths:[]}:inspectV177InstalledSaveTransition(before,after);
  report.steps.push({label,transition});assert.equal(transition.preserved,true,label);
  assert.equal(before.oldRaw,after.oldRaw,'Legacy key must not be synthesized or modified');
}
async function mapThroughPlayerUi({create=false}={}){
  await bounded(create?'player creates name/story/map save':'player resumes retained map',90000,async()=>{
    await waitForV100Ready(page);
    if(await page.locator('.v100-start-screen').isVisible())await enterV100FromTitle(page);
    await waitForV100Ready(page);
    // prepare is pinned to public1.0.3/99f9, whose real accessible label predates the stage-wording update.
    if(create){assert.equal(expected.version,'1.0.3');await page.locator('#v100-player-name').fill('公開更新確認');await page.getByRole('button',{name:'この名前で作戦を始める',exact:true}).click();}
    for(let i=0;i<220;i++){
      await waitForV100Ready(page);
      if(await page.locator('.v100-map-layout').isVisible())return;
      const skip=page.getByRole('button',{name:'スキップ',exact:true});
      await(await skip.isVisible()?skip:page.locator('.v100-event-actions .v100-primary')).click();
    }
    throw Error('Did not reach map within 220 ordinary player story transitions');
  });
}
async function profileFiles(){
  assert.equal(context,null,'Never seal/read profile while Chromium is open');assert.equal(closeUnconfirmed,false);
  const files=[];
  async function walk(dir){for(const name of(await readdir(dir)).sort()){const file=path.join(dir,name),s=await lstat(file);assert.equal(s.isSymbolicLink(),false,'Closed profile must have no unresolved link '+file);if(s.isDirectory())await walk(file);else{assert.equal(s.isFile(),true);const bytes=await readFile(file);files.push({file:path.relative(profileDir,file).split(path.sep).join('/'),bytes:bytes.length,sha256:sha256(bytes)});}}}
  await walk(profileDir);assert.ok(files.length>0);return files;
}
try{
  const source=await qaSourceIdentity();report.owner.head=source.head;report.owner.checkedOutHead=source.head;
  report.qaDependencies=source.dependencies;
  report.referenceSourceSha256=sha256(await readFile(new URL('./pwa-official-existing-profile.mjs',import.meta.url)));
  report.runtime=await runtimeIdentity();
  if(mode==='prepare'){
    assert.equal((await entries(profileDir)).length,0,'Prepare requires a new dedicated test profile');
    assert.equal(await lstat(contractPath).catch(e=>e.code==='ENOENT'?null:Promise.reject(e)),null,'Prepare refuses to replace a contract');
  }else{
    contract=JSON.parse(await readFile(contractPath,'utf8'));
    assert.equal(contract.officialUrl,officialUrl.href);assert.equal(contract.emulatedStandaloneOnly,true);assert.equal(contract.seedSaveUsed,false);
    if(report.referenceSourceSha256!==contract.referenceSourceSha256){
      // Retain the immutable prepare script and contract. The sole compatible
      // verification revision is separately pinned by the owning workflow.
      assert.equal(contract.referenceSourceSha256,'38a0421efbf5d260a5b4f6ae8aabffef16ddd62e4298e5179faddda05768b954');
      assert.match(process.env.PWA_OFFICIAL_PROFILE_VERIFY_SOURCE_SHA256??'',/^[a-f0-9]{64}$/u);
      assert.equal(report.referenceSourceSha256,process.env.PWA_OFFICIAL_PROFILE_VERIFY_SOURCE_SHA256,'Unreviewed verify source must not reuse the original profile');
      report.referenceSourceCompatibility={prepareSha256:contract.referenceSourceSha256,verifySha256:report.referenceSourceSha256,
        scope:'snapshot storage consistency uses the existing strict empty-R9-metadata contract; all other helpers, runtime, profile and bounds unchanged',
        originalFailureRun:40223535470,originalFailureArtifact:12610372770};
    }
    assert.deepEqual(report.qaDependencies,contract.qaDependencies,'Prepare and verify must use identical imported QA helpers and app source');
    assert.equal(contract.prepareOwner.checkedOutHead,contract.prepareOwner.head);
    assert.match(contract.prepareOwner.head,/^[a-f0-9]{40}$/u);
    assert.equal(contract.oldIdentity.version,'1.0.3');assert.equal(contract.oldIdentity.releaseSha,'99f9c193ab1e35531db39225c839138cdb1c33cd');
    assert.deepEqual(report.runtime,contract.runtime,'The same browser revision, lock, OS, architecture and Node runtime are required');
    assert.deepEqual(await profileFiles(),contract.closedProfileFiles,'Restore the exact closed prepare profile, not storageState or a recreated save');
    report.prepareOwner=contract.prepareOwner;report.profileId=contract.profileId;
    report.restoredProfileFilesSha256=sha256(JSON.stringify(contract.closedProfileFiles));
  }
  await openProfile();phase=mode+'-live-entry';
  await page.goto(officialUrl.href,{waitUntil:'domcontentloaded',timeout:90000});
  const published=await publishedIdentity();report.publishedIdentity=published;await persist();
  if(mode==='prepare'){
    const download=page.getByRole('button',{name:'ダウンロードを開始',exact:true});
    await download.waitFor({state:'visible',timeout:90000});await download.click();
    const start=page.getByRole('button',{name:'ゲームを始める',exact:true});
    await start.waitFor({state:'visible',timeout:420000});await activeVersion(published);await start.click();
    await mapThroughPlayerUi({create:true});const created=await snapshot('player-created-installed-map',published);
    assert.equal(created.save.mirror.playerName,'公開更新確認');assert.ok(created.save.mirror.readStoryEventIds.length>0);
    phase='prepare-first-close';await closeProfile();await openProfile();phase='prepare-reopen';
    await page.goto(officialUrl.href,{waitUntil:'domcontentloaded',timeout:90000});await ready();
    const reopened=await snapshot('old-profile-reopened-before-resume',published);preserveSave(created.save,reopened.save,'old reopen preserves player save');
    await mapThroughPlayerUi();const baseline=await snapshot('old-profile-resumed-map',published);preserveSave(created.save,baseline.save,'old resume preserves player save');
    phase='prepare-final-close';await closeProfile();
    contract={schema:1,profileId:randomUUID(),preparedAt:new Date().toISOString(),officialUrl:officialUrl.href,emulatedStandaloneOnly:true,physicalInstallAccepted:false,seedSaveUsed:false,runtime:report.runtime,prepareOwner:report.owner,oldIdentity:published,baseline,closedProfileFiles:await profileFiles()};
  }else{
    report.serviceWorkerBytesSame=published.workerBytesSha256===contract.oldIdentity.workerBytesSha256;
    await ready();
    const before=await snapshot('old-active-profile-before-update',contract.oldIdentity,{requirePageIdentity:false});preserveSave(contract.baseline.save,before.save,'restored pre-update save');
    const update=page.getByRole('button',{name:'更新をダウンロード',exact:true});
    const commit=page.getByRole('button',{name:'保存済みデータを反映',exact:true});
    await update.or(commit).first().waitFor({state:'visible',timeout:90000});
    if(await update.isVisible()){await update.click();report.updateControl='更新をダウンロード';}else{await commit.click();report.updateControl='保存済みデータを反映';}
    // No registration.update(), waiting-worker assertion, QA SW comment, skipWaiting, or rollback mutation.
    await activeVersion(published);
    const start=page.getByRole('button',{name:'ゲームを始める',exact:true});await start.waitFor({state:'visible',timeout:180000});await start.click();
    // PwaGate's completion button changes React state; it does not reload the old document.
    // Active pack is candidate here; require candidate HTML/UI only after the real browser reopen below.
    await ready();const updated=await snapshot('updated-active-pack-before-reopen',published,{requirePageIdentity:false});preserveSave(before.save,updated.save,'real public update preserves save');
    phase='verify-first-close';await closeProfile();await openProfile();phase='verify-reopen';
    await page.goto(officialUrl.href,{waitUntil:'domcontentloaded',timeout:90000});await ready();
    const reopened=await snapshot('updated-profile-reopened',published);preserveSave(updated.save,reopened.save,'updated reopen preserves save');
    await mapThroughPlayerUi();const final=await snapshot('updated-profile-reopened-map',published);preserveSave(reopened.save,final.save,'reopened resume preserves save');
    phase='verify-final-close';await closeProfile();
  }
  for(const [kind,values]of Object.entries(report.diagnostics))assert.deepEqual(values,[],kind+' diagnostics');
  assert.ok(report.requestAudits.every(r=>r.unexpectedFailures.length===0),'Unexpected request failures remain failures');
  report.status='passed';
  if(mode==='prepare'){
    contract.referenceSourceSha256=report.referenceSourceSha256;
    contract.qaDependencies=report.qaDependencies;
    contract.closedProfileFilesSha256=sha256(JSON.stringify(contract.closedProfileFiles));
    await writeFile(contractPath,JSON.stringify(contract,null,2)+'\n',{flag:'wx'});
    report.contractSha256=sha256(await readFile(contractPath));report.profileId=contract.profileId;report.closedProfileFilesSha256=contract.closedProfileFilesSha256;
    report.archiveReady=true; // Workflow may tar the ENTIRE closed profile + this contract + this receipt only after exit0.
  }
}catch(error){report.status='failed';report.errors.push({phase,error:String(error),stack:error?.stack??null});}
finally{
  if(context)try{await closeProfile();}catch(error){report.status='failed';report.errors.push({phase:'cleanup',error:String(error)});}
  if(Object.values(report.diagnostics).some(a=>a.length)||report.requestAudits.some(r=>r.unexpectedFailures.length)){report.status='failed';report.archiveReady=false;}
  report.closeConfirmed=context===null&&!closeUnconfirmed;
  report.publicOriginInstalledUpdateAccepted=mode==='verify'&&report.status==='passed'&&report.closeConfirmed;
  if(report.status!=='passed'||!report.closeConfirmed)report.archiveReady=false;
  await persist();
}
console.log(JSON.stringify({mode,status:report.status,reportPath,contractPath,archiveReady:report.archiveReady,emulatedStandaloneOnly:true,physicalInstallAccepted:false}));
// Fail-stop after bounded close failure. A failed or unconfirmed profile must never be archived/adopted.
if(report.status!=='passed'||!report.closeConfirmed)process.exit(1);
