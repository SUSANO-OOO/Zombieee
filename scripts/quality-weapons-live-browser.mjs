import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {seedV100BrowserSaveOnce,enterV100FromTitle} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {nativeBattleTap} from './v100-normal-tactical-input.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {RECORDED_WEAPON_TAKES} from '../app/weaponRecordingRecipes.js';
const out=path.resolve(process.env.QUALITY_WEAPONS_OUT);
await mkdir(out,{recursive:true});
const url=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
const baseline=process.env.QUALITY_WEAPONS_BASELINE==='1';
const report={build:await productionBuildIdentity(),baseline,scope:'Prepared S23 formation, native deployment, ordinary simulation. Local canvas + production mixer tap recording at 15fps; not physical recording, full-speed visual review or subjective listening acceptance.',baselineScope:baseline?'Same candidate game with the seven changed firearm response bodies substituted by their prior audio sources. Not a historical executable or equal-loudness playback.':'Unmodified candidate runtime responses.',substitutions:[],requests:[],cues:[],snapshots:[],errors:[]};
const ids=['unit-mizuchi','unit-raider','unit-babayaga'];
const seed=normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,ownedUnitIds:ids,registeredUnitIds:ids,formationSlots:ids,availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,22),flowState:{phase:'formation',stageId:V100_STAGE_IDS[22],stageNumber:23,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:844,height:340},hasTouch:true});
try{
 if(baseline)await context.route('**/audio/weapons/recorded/*.mp3',async route=>{
  const id=path.basename(new URL(route.request().url()).pathname,'.mp3'),take=RECORDED_WEAPON_TAKES[id];
  assert.ok(take,`Unknown replacement ${id}`);
  const body=await readFile(path.join('public',take.reference));
  report.substitutions.push({id,source:take.reference,sha256:createHash('sha256').update(body).digest('hex')});
  await route.fulfill({status:200,contentType:'audio/mpeg',body});
 });
 await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
 const page=await context.newPage();page.setDefaultTimeout(25000);
 page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('response',r=>{if(r.url().includes('/audio/weapons/recorded/'))report.requests.push({url:new URL(r.url()).pathname,status:r.status()});});
 await page.goto(url.href);await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
 await page.getByRole('button',{name:'戦闘へ',exact:true}).click();
 await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot().running&&window.__ASHFALL_AUDIO_QA__?.getDiagnostics().contextState==='running');
 report.audioBefore=await page.evaluate(()=>window.__ASHFALL_AUDIO_QA__.getDiagnostics());
 await page.evaluate(()=>{
  const canvas=document.querySelector('canvas');if(!canvas)throw Error('No battle canvas');
  const tap=window.__ASHFALL_AUDIO_QA__.createLocalRecordingTap();
  const video=canvas.captureStream(15),stream=new MediaStream([...video.getVideoTracks(),...tap.stream.getAudioTracks()]);
  const mimeType=['video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  if(!mimeType)throw Error('No native audiovisual encoder');
  const recorder=new MediaRecorder(stream,{mimeType}),chunks=[];
  const state={tap,video,recorder,chunks,mimeType,started:null,stopped:null,error:null};
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  state.done=new Promise(resolve=>{recorder.onstop=()=>{state.stopped=performance.now();resolve();};});
  recorder.onerror=e=>{state.error=String(e.error);};
  recorder.onstart=()=>{state.started=performance.now();};
  window.__weaponRecording=state;recorder.start(1000);
 });
 const deployed=new Set(),cues=new Map(),deadline=Date.now()+45000;let lastTap=0;
 while(Date.now()<deadline){
  const snapshot=await page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__?.getSnapshot();return s?{time:s.time,running:s.running,fighters:s.fighters.map(f=>({id:f.id,kind:f.kind,side:f.side,hp:f.hp}))}:null;});
  if(!snapshot?.running)break;
  report.snapshots.push(snapshot);
  for(const fighter of snapshot.fighters)if(fighter.side==='human')deployed.add(fighter.kind);
  // A dispatched pointer is not proof that command was sufficient at commit.
  // Confirm the actor and reserve command for one missing unit at a time.
  const next=['gunner','ranger','babayaga'].find(kind=>!deployed.has(kind));
  if(next&&Date.now()-lastTap>1500&&await nativeBattleTap(page,page.locator(`button.unit-card[data-kind="${next}"]`).first()))lastTap=Date.now();
  for(const cue of await page.evaluate(()=>window.__ASHFALL_AUDIO_QA__.getCueRequests()))cues.set(JSON.stringify(cue),cue);
  await page.waitForTimeout(200);
 }
 report.cues=[...cues.values()];report.deployed=[...deployed];
 const encoded=await page.evaluate(async()=>{
  const r=window.__weaponRecording;r.recorder.stop();
  await Promise.race([r.done,new Promise((_,reject)=>setTimeout(()=>reject(Error('Recorder stop deadline')),5000))]);
  const bytes=Array.from(new Uint8Array(await new Blob(r.chunks,{type:r.mimeType}).arrayBuffer()));
  r.tap.release();r.video.getTracks().forEach(t=>t.stop());
  return {bytes,mimeType:r.mimeType,started:r.started,stopped:r.stopped,error:r.error};
 });
 const bytes=Buffer.from(encoded.bytes);await writeFile(path.join(out,'battle.webm'),bytes);
 const {bytes:ignored,...metadata}=encoded;void ignored;
 report.recording={...metadata,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 assert.equal(createHash('sha256').update(await readFile(path.join(out,'battle.webm'))).digest('hex'),report.recording.sha256);
 assert.equal(encoded.error,null);assert.ok(bytes.length>10000);
 report.audioAfter=await page.evaluate(()=>window.__ASHFALL_AUDIO_QA__?.getDiagnostics());
 report.cueCounts=Object.fromEntries([...new Set(report.cues.map(c=>c.cueId))].map(id=>[id,report.cues.filter(c=>c.cueId===id).length]));
 assert.ok(report.cueCounts['weapon-rifle']>0);assert.ok(report.cueCounts['weapon-gunner']>0);
 assert.ok(report.requests.some(r=>r.url.includes('weapon-rifle')&&r.status===200));
 assert.ok(report.requests.some(r=>r.url.includes('weapon-gunner')&&r.status===200));
 assert.deepEqual(report.errors,[]);report.status='captured-not-listening-accepted';
}catch(error){report.status='failed';report.error=String(error);throw error;}
finally{await context.close();await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,cues:report.cueCounts,recording:report.recording}));
