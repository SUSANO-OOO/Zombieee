import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STORY_EVENTS} from '../app/v100StoryEvents.js';
import {v100EventPresentationFor} from '../app/v100EventPresentation.js';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
const origin=process.env.V100_CAMPAIGN_QA_BASE_URL,out=process.env.V100_MUSIC_QA_OUT??'outputs/v100-music-runtime-r1';
await mkdir(out,{recursive:false});
const report={scope:'Native Chromium preparation/replay input, then isolated source-bound audio-owner scene probes. No campaign progression acceptance or physical-speaker audition.',build:await productionBuildIdentity(),errors:[],checks:[]};
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:844,height:340},hasTouch:true,isMobile:true});
const page=await context.newPage();page.setDefaultTimeout(20000);
page.on('pageerror',e=>report.errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());});
const snap=()=>page.evaluate(()=>window.__V100_EVENT_AUDIO_QA__.getSnapshot());
const check=async(role)=>{
  await page.waitForFunction(id=>window.__V100_EVENT_AUDIO_QA__?.getDiagnostics().activeBgm?.some(v=>v.assetId===id),'music-v100-score-'+role);
  await page.waitForTimeout(1900);
  const s=await snap();
  assert.equal(s.diagnostics.activeBgmVoices,1,role);
  assert.deepEqual(s.diagnostics.duplicateLoopInstanceKeys,[]);
  assert.equal(s.diagnostics.cache.failed,0);
  report.checks.push({role,snapshot:s});
};
try{
  const base=createDefaultV100Save({playerName:'音響確認'});
  const save=normalizeV100Save({...base,campaignStarted:true,readStoryEventIds:['v100:event:prologue'],flowState:{phase:'map'}});
  await page.addInitScript(value=>{for(const key of ['nishijin-campaign-v100','nishijin-campaign-v100:mirror','nishijin-campaign-v100:last-known-good'])localStorage.setItem(key,value);},serializeV100Save(save));
  await page.addInitScript(()=>{
    window.musicStarts=[];
    const original=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){window.musicStarts.push({at:performance.now(),loop:this.loop,duration:this.buffer?.duration});return original.apply(this,args);};
  });
  await page.goto(new URL('v100',origin).href);
  const nav=page.getByRole('navigation',{name:'作戦準備メニュー'}),play=page.getByRole('button',{name:'ブラウザで遊ぶ',exact:true});
  await play.or(nav).first().waitFor();if(await play.isVisible())await play.click();
  await nav.getByRole('button',{name:'隊員',exact:true}).click();
  await check('preparation');
  const before=await page.evaluate(()=>window.musicStarts.filter(s=>s.loop&&s.duration>60).length);
  for(const name of ['支援','装備','車両','作戦'])await nav.getByRole('button',{name,exact:true}).click();
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>window.musicStarts.filter(s=>s.loop&&s.duration>60).length),before,'Preparation tabs never restart the score');
  await page.getByRole('button',{name:'異常発生・記録',exact:true}).click();
  await check('preparation');
  await page.getByRole('button',{name:'作戦地図へ',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.musicStarts.filter(s=>s.loop&&s.duration>60).length),before,'Optional-mode hub keeps preparation music running');
  await page.getByRole('button',{name:'会話記録',exact:true}).click();
  await page.getByRole('dialog',{name:'会話記録',exact:true}).getByRole('button',{name:'プロローグ',exact:true}).click();
  const replay=page.locator('[data-v100-replay-index]');
  await replay.getByRole('button',{name:'次へ',exact:true}).click();await check('daily');
  const heldStarts=await page.evaluate(()=>window.musicStarts.length);
  await page.waitForTimeout(30000);
  assert.equal(await page.evaluate(()=>window.musicStarts.length),heldStarts,'Held dialogue creates no periodic sound or loop restarts');
  for(let i=0;i<5;i++)await replay.getByRole('button',{name:'次へ',exact:true}).click();
  await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>window.musicStarts.filter(s=>s.loop&&s.duration>60).length),before+1,'Daily dialogue continues the original music source');
  await page.screenshot({path:out+'/daily.png'});
  await replay.getByRole('button',{name:'閉じる',exact:true}).click();await check('preparation');
  // Probe real canonical presentation metadata in the same runtime owner.
  const cases=[['v100:event:s01:pre',null,'tension'],['v100:event:s03:pre',null,'horror'],
    ['v100:event:s01:post',null,'relief'],['v100:event:s03:post',526,'loss'],
    ['v100:event:ending',null,'ending']];
  for(const [eventId,line,role] of cases){
    const node=V100_STORY_EVENTS[eventId].nodes.find(n=>line?n.sourceLine===line:n.kind==='dialogue');
    assert.ok(node);
    const view=v100EventPresentationFor({eventId,node,phase:eventId.endsWith(':post')?'post':'event'});
    await page.evaluate(view=>window.__V100_EVENT_AUDIO_QA__.present(view),view);await check(role);
  }
  for(const role of ['normal','pressure']){
    const sceneId=role==='normal'?'stage1':'pressure-surface';
    await page.evaluate(sceneId=>window.__V100_EVENT_AUDIO_QA__.present({eventId:'isolated-score-probe',nodeIndex:0,sceneId}),sceneId);await check(role);
  }
  await page.evaluate(()=>window.__V100_EVENT_AUDIO_QA__.present({eventId:'isolated-boss-probe',nodeIndex:0,sceneId:'boss'}));
  await page.waitForFunction(()=>window.__V100_EVENT_AUDIO_QA__?.getDiagnostics().activeBgm?.some(v=>v.assetId==='music-boss'));
  await page.waitForTimeout(1900);report.boss=await snap();
  assert.equal(report.boss.diagnostics.activeBgmVoices,1);
  await page.evaluate(()=>window.__V100_EVENT_AUDIO_QA__.stop('probe-complete'));
  await page.waitForTimeout(300);
  assert.equal((await snap()).diagnostics.activeLoopVoices,0);
  report.starts=await page.evaluate(()=>window.musicStarts);
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=String(e);await page.screenshot({path:out+'/failure.png'});process.exitCode=1;}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await context.close();await browser.close();}
console.log(JSON.stringify({out,status:report.status,checks:report.checks.length,failure:report.failure}));
