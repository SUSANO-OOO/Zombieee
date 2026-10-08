import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {FORMATION_CARD_ART} from '../app/spriteManifest.js';
import {campaignUnitIdToCombatKind} from '../app/campaign.js';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {enterV100FromTitle} from './v100-title-qa-entry.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();
const base=new URL(process.env.V100_CARD_RESIZE_BASE_URL??process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(['localhost','127.0.0.1'].includes(base.hostname),'Isolated local QA origin required');
const engine=process.env.V100_CARD_RESIZE_ENGINE??'all';assert.ok(['all','chromium','webkit'].includes(engine));
const out=path.resolve(process.env.V100_CARD_RESIZE_OUT??'outputs/v100-card-resize');
await mkdir(out,{recursive:false});
const initial=createDefaultV100Save({playerName:'画面切替確認'});
const fixture=normalizeV100Save({...initial,campaignStarted:true,caps:0,
 availableStageIds:V100_STAGE_IDS.slice(0,3),completedStageIds:V100_STAGE_IDS.slice(0,2),
 formationSlots:[...initial.ownedUnitIds,null,null,null],
 flowState:{phase:'formation',stageId:V100_STAGE_IDS[2],stageNumber:3,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
const raw=serializeV100Save(fixture);await writeFile(path.join(out,'fixture.json'),raw,{flag:'wx'});
const kinds=initial.ownedUnitIds.map(campaignUnitIdToCombatKind);
const sourceFiles=['app/AshfallGame.tsx','app/globals.css','app/v100BattlePresentation.css','app/battleAssetPlan.js','app/campaign.js','scripts/v100-card-resize-browser.mjs'];
const report={schema:'v100-card-resize-fidelity/v2',status:'running',head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),
 dirty:git('status','--porcelain=v1'),build:await productionBuildIdentity(),
 sourceFiles:Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,hash((await readFile(file,'utf8')).replaceAll('\r\n','\n'))]))),
 scope:'Fresh isolated Stage3 fixture, four early identities at their default levels. Native formation-to-battle input and 844x340→844x390→1280x720→844x340 viewport transitions. No clock/actor/HP/result setters, CSS/image hiding, animation disabling or visual-quality overrides. Native PNG comparison covers unchanged ready portrait pixels; not difficulty, natural campaign victory or physical-device acceptance.',
 fixtureSha256:hash(raw),maximumChangedFraction:.01,minimumChannelDelta:12,cases:[],errors:[],physicalDeviceVerified:false};

async function persist(bytes,file){await writeFile(path.join(out,file),bytes,{flag:'wx'});return{file,bytes:bytes.length,sha256:hash(bytes)};}
const cropPortrait=(bytes,clip)=>sharp(bytes).extract({left:clip.x,top:clip.y,width:clip.width,height:clip.height}).png().toBuffer();
async function changedPixels(first,last,masks){
 const a=await sharp(first).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const b=await sharp(last).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual(a.info,b.info);
 let compared=0,changed=0;const {width,height,channels}=a.info;
 for(let y=3;y<height-3;y++)for(let x=3;x<width-3;x++){
  if(masks.some(m=>x>=m.x-3&&x<=m.x+m.width+3&&y>=m.y-3&&y<=m.y+m.height+3))continue;
  const p=(y*width+x)*channels;compared++;
  if(Math.max(...[0,1,2].map(c=>Math.abs(a.data[p+c]-b.data[p+c])))>=12)changed++;
 }
 assert.ok(compared>300,'Too few uncovered native portrait pixels');
 return{compared,changed,fraction:changed/compared,minimumChannelDelta:12,maximumChangedFraction:.01};
}
async function imageGeometry(page,kind){
 return page.locator(`button.unit-card[data-kind="${kind}"] .portrait > img`).evaluate(async img=>{
  await img.decode();const card=img.closest('button'),r=img.getBoundingClientRect(),c=card.getBoundingClientRect();
  const x=Math.ceil(Math.max(r.left,c.left+3)),y=Math.ceil(r.top+3);
  const clip={x,y,width:Math.floor(Math.min(r.right,c.right-3)-x),height:Math.floor(r.bottom-y-3)};
  return{kind:card.dataset.kind,state:card.dataset.state,src:img.getAttribute('src'),complete:img.complete,
   naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,imageRendering:getComputedStyle(img).imageRendering,
   optimizeQualitySupported:CSS.supports('image-rendering','optimizeQuality'),
   opacity:{image:getComputedStyle(img).opacity,portrait:getComputedStyle(img.parentElement).opacity,card:getComputedStyle(card).opacity},clip,
   unroundedRects:{image:{x:r.x,y:r.y,width:r.width,height:r.height},card:{x:c.x,y:c.y,width:c.width,height:c.height}},
   masks:[...card.querySelectorAll('.cost,.card-state,.cooldown-mask small')].map(e=>{const b=e.getBoundingClientRect();return{x:b.x-x,y:b.y-y,width:b.width,height:b.height};}).concat([{x:c.x-x,y:c.bottom-y-13,width:c.width,height:13}])};
 });
}
async function capture(page,row,name){
 const bytes=await page.screenshot();const image=await persist(bytes,row.engine+'-'+name+'.png');
 row.images.push({...image,name,viewport:page.viewportSize()});
 const native=await page.evaluate(()=>{const canvas=document.querySelector('canvas.battlefield');if(!(canvas instanceof HTMLCanvasElement))throw new Error('Missing production battlefield canvas');const r=canvas.getBoundingClientRect();return{png:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height,css:{width:r.width,height:r.height,imageRendering:getComputedStyle(canvas).imageRendering},battleTime:window.__ASHFALL_BATTLE_QA__?.getSnapshot?.()?.time??null};});
 const bitmap=await persist(Buffer.from(native.png.split(',')[1],'base64'),row.engine+'-'+name+'-canvas.png');
 row.canvasCaptures.push({...bitmap,name,width:native.width,height:native.height,css:native.css,battleTime:native.battleTime,scope:'Separate read-only native canvas sample after the page PNG, not asserted to be the same gameplay frame.'});return bytes;
}
function readStartBoundary(){
 const shell=document.querySelector('.v100-shell'),snapshot=window.__ASHFALL_BATTLE_QA__?.getPhaseGCombatSnapshot?.();
 return{phase:shell?.getAttribute('data-v100-phase'),stage:shell?.getAttribute('data-v100-stage'),assetLoadState:document.documentElement.dataset.assetLoadState,
  snapshot:snapshot?{screen:snapshot.screen,stageId:snapshot.stageId,time:snapshot.time,running:snapshot.running,paused:snapshot.paused,over:snapshot.over}:null,
  cards:[...document.querySelectorAll('button.unit-card')].map(card=>({kind:card.dataset.kind,state:card.dataset.state}))};
}
const matrix=engine==='all'?['chromium','webkit']:[engine];
for(const browserName of matrix){
 const row={engine:browserName,status:'running',images:[],canvasCaptures:[],probes:[],noResizeControl:[],fidelityViolations:[],errors:[],inputs:[],geometry:{}};report.cases.push(row);
 const browser=await({chromium,webkit}[browserName]).launch({headless:true});let context,page;
 try{
  row.browserVersion=browser.version();context=await browser.newContext({viewport:{width:844,height:340},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await context.addInitScript(value=>{for(const key of ['nishijin-campaign-v100','nishijin-campaign-v100:mirror','nishijin-campaign-v100:last-known-good'])localStorage.setItem(key,value);},raw);
  page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('console',m=>{if(m.type()==='error')row.errors.push({kind:'console',text:m.text()});});
  page.on('pageerror',e=>row.errors.push({kind:'page',text:String(e)}));
  page.on('requestfailed',r=>row.errors.push({kind:'request',url:r.url(),text:r.failure()?.errorText}));
  page.on('response',r=>{if(r.status()>=400)row.errors.push({kind:'http',url:r.url(),status:r.status()});});
  assert.equal((await page.goto(new URL('v100',base).href,{waitUntil:'domcontentloaded'})).status(),200);
  await page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true}).click();
  await enterV100FromTitle(page);
  row.beforeStart=await page.evaluate(readStartBoundary);
  await page.getByRole('button',{name:'戦闘へ',exact:true}).click();row.inputs.push({action:'native-start-battle'});
  // A ready flag can still belong to preparation while its save and the
  // battlefield mount are pending. Require the actual fresh battle controls.
  await page.waitForFunction(expected=>{
   const shell=document.querySelector('.v100-shell'),snapshot=window.__ASHFALL_BATTLE_QA__?.getPhaseGCombatSnapshot?.(),cards=[...document.querySelectorAll('button.unit-card')];
   return shell?.getAttribute('data-v100-phase')==='battle'&&shell.getAttribute('data-v100-stage')==='3'&&snapshot?.screen==='battle'&&snapshot.running===true&&snapshot.paused===false&&snapshot.over===false&&document.documentElement.dataset.assetLoadState==='ready'&&cards.length===expected.length&&cards.every((card,index)=>card.dataset.kind===expected[index]);
  },kinds,{timeout:30000});
  row.startBoundary=await page.evaluate(readStartBoundary);
  const actualKinds=await page.locator('button.unit-card').evaluateAll(cards=>cards.map(c=>c.dataset.kind));
  assert.deepEqual(actualKinds,kinds);
  await page.waitForFunction(()=>[...document.querySelectorAll('button.unit-card')].every(c=>c.dataset.state==='ready'));
  await page.waitForLoadState('networkidle',{timeout:45000});
  const decoded=await page.evaluate(()=>window.__ASHFALL_ASSET_QA__?.getDecodedRequiredPaths?.());assert.ok(Array.isArray(decoded));
  const before=await capture(page,row,'before');const baseline=new Map();
  for(const kind of kinds){const g=await imageGeometry(page,kind);assert.equal(g.src,FORMATION_CARD_ART[kind]);assert.ok(decoded.includes(g.src));assert.ok(g.complete&&g.naturalWidth>0&&g.naturalHeight>0);assert.equal(g.state,'ready');if(browserName==='webkit'){assert.equal(g.optimizeQualitySupported,true);assert.equal(g.imageRendering.toLowerCase(),'optimizequality');}row.geometry[kind]=g;baseline.set(kind,await cropPortrait(before,g.clip));}
  // Keep a native control before any resize. It distinguishes unstable
  // sampling from a resize regression without changing the fidelity gate.
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const control=await capture(page,row,'no-resize-control');
  for(const kind of kinds){const g=await imageGeometry(page,kind),original=row.geometry[kind];assert.deepEqual(g.clip,original.clip);const comparison=await changedPixels(baseline.get(kind),await cropPortrait(control,g.clip),original.masks);row.noResizeControl.push({kind,geometry:g,comparison});}
  for(const size of [{width:844,height:390},{width:1280,height:720},{width:844,height:340}]){
   await page.setViewportSize(size);row.inputs.push({action:'native-setViewportSize',...size});
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   if(size.height!==340)await capture(page,row,'transition-'+size.width+'x'+size.height);
  }
  let previousDelay=0;
  for(const delay of [0,200,1000,3000]){
   if(delay>previousDelay)await page.waitForTimeout(delay-previousDelay);previousDelay=delay;
   const bytes=await capture(page,row,'returned-'+delay+'ms');
   for(const kind of kinds){
    const g=await imageGeometry(page,kind),original=row.geometry[kind];assert.equal(g.state,'ready');assert.deepEqual(g.clip,original.clip,'Native portrait geometry did not return');assert.deepEqual(g.opacity,original.opacity,'Native state opacity changed');assert.equal(g.imageRendering,original.imageRendering);
    const after=await cropPortrait(bytes,g.clip),comparison=await changedPixels(baseline.get(kind),after,original.masks);
    row.probes.push({kind,delay,geometry:g,comparison});
    if(comparison.fraction>.01)row.fidelityViolations.push({kind,delay,fraction:comparison.fraction});
   }
  }
  // Preserve all four original observations before reporting a failed gate.
  assert.deepEqual(row.fidelityViolations,[],`${browserName} portrait fidelity changed after resize`);
  await page.waitForFunction(()=>['__ASHFALL_AUDIO_QA__','__V100_EVENT_AUDIO_QA__'].every(key=>{const d=window[key]?.getDiagnostics?.();return !d||d.activePreloads===0&&d.queuedPreloads===0;}),undefined,{timeout:45000});
  await page.waitForLoadState('networkidle',{timeout:45000});assert.deepEqual(row.errors,[]);row.status='captured';
 }catch(error){row.status='failed';row.error=String(error);report.errors.push(row.error);process.exitCode=1;if(page){row.failureBoundary=await page.evaluate(readStartBoundary).catch(()=>null);row.failureImage=await page.screenshot().then(bytes=>persist(bytes,row.engine+'-failure.png')).catch(()=>null);}}
 finally{try{await context?.close();}finally{await browser.close();}}
 if(row.errors.length){row.status='failed';process.exitCode=1;}else if(row.status==='captured')row.status='passed';
 console.log(JSON.stringify({engine:row.engine,status:row.status,images:row.images.length,probes:row.probes.length,errors:row.errors.length,error:row.error}));
 if(row.status==='failed')break;
}
report.status=report.cases.length===matrix.length&&report.cases.every(c=>c.status==='passed')?'passed':'failed';
assert.equal((await productionBuildIdentity()).combinedSha256,report.build.combinedSha256);
await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:report.status,cases:report.cases.length,images:report.cases.reduce((n,c)=>n+c.images.length,0),probes:report.cases.reduce((n,c)=>n+c.probes.length,0)}));
if(report.status==='failed')process.exitCode=1;
