import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const origin=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));
const out=process.env.V100_TONE_OUT??'outputs/v100-event-unlock-tone-before';
await mkdir(out,{recursive:false});
const report={scope:'Native production prologue actions; observing actual Web Audio oscillator starts without changing sound routing, frequency, gain or game state.',build:await productionBuildIdentity(),steps:[],errors:[]};
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true}),page=await context.newPage();
await context.addInitScript(()=>{
 window.__V100_OSCILLATOR_TRACE__=[];
 window.__V100_BUFFER_TRACE__=[];
 const type=window.AudioContext??window.webkitAudioContext,original=type.prototype.createOscillator;
 type.prototype.createOscillator=function(...args){
  const node=Reflect.apply(original,this,args),start=node.start;
  node.start=function(...params){window.__V100_OSCILLATOR_TRACE__.push({frequency:node.frequency.value,at:performance.now()});return Reflect.apply(start,this,params);};
  return node;
 };
 const sourceOriginal=type.prototype.createBufferSource;
 type.prototype.createBufferSource=function(...args){
  const node=Reflect.apply(sourceOriginal,this,args),start=node.start;
  node.start=function(...params){window.__V100_BUFFER_TRACE__.push({duration:node.buffer?.duration,loop:node.loop,at:performance.now()});return Reflect.apply(start,this,params);};
  return node;
 };
});
page.on('pageerror',e=>report.errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
try{
 await page.goto(new URL('/v100',origin).href);
 const play=page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true});await play.or(page.locator('#v100-player-name')).first().waitFor();if(await play.isVisible())await play.click();
 await page.locator('#v100-player-name').fill('音確認');
 await page.getByRole('button',{name:'この名前で作戦を始める',exact:true}).click();
 await page.locator('.v100-event-actions .v100-primary').waitFor();
 await page.waitForFunction(()=>window.__V100_EVENT_AUDIO_QA__?.getSnapshot()?.audioStatus.state==='running');
 report.initialToneCount=await page.evaluate(()=>window.__V100_OSCILLATOR_TRACE__.length);
 for(let i=0;i<12;i++){
  await page.waitForFunction(()=>document.documentElement.dataset.pwaSaveMutationPending==='false');
  const before=await page.evaluate(()=>({count:window.__V100_OSCILLATOR_TRACE__.length,buffers:window.__V100_BUFFER_TRACE__.length,revision:JSON.parse(localStorage.getItem('nishijin-campaign-v100')).revision}));
  await page.locator('.v100-event-actions .v100-primary').click();
  await page.waitForFunction(revision=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')).revision>revision,before.revision);
  await page.waitForTimeout(120);
  const after=await page.evaluate(()=>({oscillators:window.__V100_OSCILLATOR_TRACE__,buffers:window.__V100_BUFFER_TRACE__,audio:window.__V100_EVENT_AUDIO_QA__.getSnapshot()}));
  const tapSounds=after.buffers.slice(before.buffers).filter(b=>!b.loop&&b.duration>0&&b.duration<.3);
  assert.ok(tapSounds.length>0,'Native short UI sound must remain audible after removing unlock tones');
  report.steps.push({step:i+1,newTones:after.oscillators.slice(before.count),tapSounds,scene:after.audio.active?.sceneId,audioState:after.audio.audioStatus.state,activeBgmVoices:after.audio.diagnostics.activeBgmVoices});
 }
 assert.deepEqual(report.errors,[]);
 report.repeatedToneCount=report.steps.reduce((sum,step)=>sum+step.newTones.length,0);
 if(process.env.V100_TONE_EXPECT_QUIET==='1'){
  assert.equal(report.initialToneCount,0,'Menu entry must use its authored tap sound without a diagnostic unlock tone');
  assert.equal(report.repeatedToneCount,0,'Ordinary dialogue actions must not replay audio-unlock test tones');
  assert.equal(report.steps.at(-1).activeBgmVoices,1,'The scene music must still be playing');
  // Explicit diagnostic fixture for a user cancelling navigation. Production
  // audio never creates this confirmation dialog.
  const beforeCancel=await page.evaluate(()=>({raw:localStorage.getItem('nishijin-campaign-v100'),tones:window.__V100_OSCILLATOR_TRACE__.length,buffers:window.__V100_BUFFER_TRACE__.length}));
  await page.evaluate(()=>addEventListener('beforeunload',event=>{event.preventDefault();event.returnValue='fixture';},{once:true}));
  let dialogCount=0,navigationError=null;
  page.once('dialog',async dialog=>{dialogCount++;await dialog.dismiss();});
  try{await page.goto(new URL('/?cancelled-navigation-fixture',origin).href);}catch(error){navigationError=String(error);}
  assert.equal(dialogCount,1);assert.match(navigationError??'',/ERR_ABORTED/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('nishijin-campaign-v100')),beforeCancel.raw);
  const revision=JSON.parse(beforeCancel.raw).revision;
  await page.locator('.v100-event-actions .v100-primary').click();
  await page.waitForFunction(previous=>JSON.parse(localStorage.getItem('nishijin-campaign-v100')).revision>previous,revision);
  await page.waitForTimeout(120);
  const resumed=await page.evaluate(()=>({tones:window.__V100_OSCILLATOR_TRACE__,buffers:window.__V100_BUFFER_TRACE__,audio:window.__V100_EVENT_AUDIO_QA__.getSnapshot()}));
  report.cancelledNavigation={fixture:'One cancellable beforeunload prompt, dismissed by native browser dialog control; no production prompt',dialogCount,navigationError,newTones:resumed.tones.length-beforeCancel.tones,newTapSounds:resumed.buffers.slice(beforeCancel.buffers).filter(b=>!b.loop&&b.duration>0&&b.duration<.3).length,audioState:resumed.audio.audioStatus.state};
  assert.equal(report.cancelledNavigation.newTones,0);assert.ok(report.cancelledNavigation.newTapSounds>0);assert.equal(report.cancelledNavigation.audioState,'running');
 }
 report.status='observed';
}catch(error){report.status='failed';report.error=String(error);}
finally{await context.close();await browser.close();report.buildAfter=await productionBuildIdentity();assert.equal(report.build.combinedSha256,report.buildAfter.combinedSha256);await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify({status:report.status,repeatedToneCount:report.repeatedToneCount,error:report.error,steps:report.steps.map(s=>({step:s.step,tones:s.newTones.map(t=>t.frequency)}))}));
if(report.status==='failed')process.exitCode=1;
