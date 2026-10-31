import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {chromium,webkit} from 'playwright';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save,deserializeV100Save,V100_PRIMARY_STORAGE_KEY} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {finishV100TitleIntro,enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';

const origin=new URL(process.env.QUALITY_SETTINGS_URL),out=path.resolve(process.env.QUALITY_SETTINGS_OUT);
assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));
await mkdir(out,{recursive:false});
const engine=process.env.QUALITY_SETTINGS_ENGINE??'chromium',after=process.env.QUALITY_SETTINGS_AFTER==='1',campaign=process.env.QUALITY_SETTINGS_CONTEXT==='campaign';
assert.ok(['chromium','webkit'].includes(engine));
const sourceRef=process.env.QUALITY_SETTINGS_SOURCE_REF??null,buildRoot=process.env.QUALITY_SETTINGS_BUILD_ROOT??null;
const build=buildRoot?await productionBuildIdentity(buildRoot):null;
if(buildRoot){const snapshot=JSON.parse(await readFile(path.join(buildRoot,'snapshot.json'),'utf8'));assert.equal(snapshot.sourceHead,sourceRef);assert.equal(snapshot.combinedSha256,build.combinedSha256);}
const report={engine,after,context:campaign?'campaign':'title',url:origin.href,sourceRef,runtime:build?'frozen-production':'working-development',build,scope:'Isolated prepared save; actual title/menu controls and reload. UI and persistence only; no physical touch, listening or natural progression claim.',source:{},cases:[],errors:[]};
for(const file of ['app/V100PlayerMenu.tsx','app/v100ExperiencePolish.css'])report.source[file]=createHash('sha256').update(sourceRef?execFileSync('git',['show',sourceRef+':'+file]):await readFile(file)).digest('hex');
const browser=await({chromium,webkit}[engine]).launch({headless:true,...(engine==='chromium'?{args:['--mute-audio']}:{})});
const context=await browser.newContext({viewport:{width:1280,height:720},hasTouch:true,serviceWorkers:'block'});
const seed=normalizeV100Save({...createDefaultV100Save({settings:{bgmEnabled:false,sfxEnabled:false}}),campaignStarted:true,caps:123,completedStageIds:V100_STAGE_IDS.slice(0,2),...(campaign?{flowState:{phase:'map',stageId:V100_STAGE_IDS[1],stageNumber:2,eventId:null,destination:'map',nodeIndex:0,firstClear:false,finalized:true}}:{})});
await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(String(e)));
const persist=()=>writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
async function enter(){await dismissInstallOffer(page,{timeout:30000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await finishV100TitleIntro(page);await page.evaluate(()=>document.fonts.ready);const n=page.getByText('オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。',{exact:true});if(await n.isVisible())await n.locator('..').getByRole('button',{name:'閉じる',exact:true}).click();if(campaign)await enterV100FromTitle(page);}
async function readSave(){const raw=await page.evaluate(key=>localStorage.getItem(key),V100_PRIMARY_STORAGE_KEY),r=deserializeV100Save(raw);assert.ok(r.ok);return r.save;}
const progress=s=>Object.fromEntries(Object.entries(s).filter(([key])=>!['settings','updatedAt','revision','saveRevision','createdAt'].includes(key)));
try{
 await page.goto(origin.href);await enter();const before=await readSave();await page.getByRole('button',{name:campaign?'メニュー':'設定',exact:true}).click();
 const menu=page.getByRole('dialog',{name:'メニュー',exact:true});await menu.waitFor({state:'visible'});
 for(const viewport of [{width:1280,height:720},{width:844,height:390},{width:844,height:340}]){
  await page.setViewportSize(viewport);const select=menu.getByRole('combobox');
  for(const mode of ['auto','high','power-save']){
   await select.selectOption(mode);if(after){const help=menu.locator('#v100-menu-quality-help');assert.ok((await help.innerText()).length>5);assert.equal(await select.getAttribute('aria-describedby'),'v100-menu-quality-help');}
   const layout=await menu.evaluate(el=>{const r=el.getBoundingClientRect(),q=el.querySelector('select').getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,selectHeight:q.height,selectAppearance:getComputedStyle(el.querySelector('select')).appearance,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,contentHeight:el.querySelector('.v100-menu-scroll').scrollHeight,visibleHeight:el.querySelector('.v100-menu-scroll').clientHeight,text:el.textContent};});
   assert.ok(layout.left>=-1&&layout.top>=-1&&layout.right<=viewport.width+1&&layout.bottom<=viewport.height+1);assert.equal(layout.pageOverflow,false);if(after){assert.ok(layout.selectHeight>=44,'Full-height quality selector');assert.equal(layout.selectAppearance,'none','Native white picker face must not cover the dark field');assert.ok(layout.contentHeight<=layout.visibleHeight+1,'All settings and help must fit without a clipped inner panel');}
   if(mode!=='high'){const file=`${viewport.width}x${viewport.height}-${mode}.png`;await page.screenshot({path:path.join(out,file)});report.cases.push({viewport,mode,layout,file});}
  }
 }
 await menu.getByRole('checkbox',{name:/演出の動きを抑える|会話・ムービーの動きを抑える/}).check();
 await menu.getByRole('checkbox',{name:'読んだ会話を自動でスキップ',exact:true}).check();
 for(const [slider,value] of [[menu.getByRole('slider',{name:'BGMの音量',exact:true}),41],[menu.getByRole('slider',{name:/効果音と.*ボイスの音量/}),32]]){await slider.press('Home');for(let n=0;n<value;n++)await slider.press('ArrowRight');}
 await menu.getByRole('button',{name:'設定を保存',exact:true}).click();await menu.getByRole('status').filter({hasText:'設定を保存しました。'}).waitFor();
 const saved=await readSave();assert.deepEqual(progress(saved),progress(before));assert.deepEqual(saved.settings,{...before.settings,bgmVolume:.41,sfxVolume:.32,graphicsQuality:'power-save',reducedMotion:true,autoSkipReadStory:true});
 await page.reload();await enter();assert.equal(await page.locator(campaign?'#v100-campaign':'.v100-start-screen').getAttribute(campaign?'data-v100-reduced-motion':'data-reduced-motion'),'true');await page.getByRole('button',{name:campaign?'メニュー':'設定',exact:true}).click();
 assert.equal(await menu.getByRole('combobox').inputValue(),'power-save');assert.equal(await menu.getByRole('checkbox',{name:/演出の動きを抑える|会話・ムービーの動きを抑える/}).isChecked(),true);assert.equal(await menu.getByRole('checkbox',{name:'読んだ会話を自動でスキップ',exact:true}).isChecked(),true);const reloaded=await readSave();assert.deepEqual(progress(reloaded),progress(saved));assert.deepEqual(reloaded.settings,saved.settings);await page.screenshot({path:path.join(out,'saved-reloaded.png')});
 assert.deepEqual(report.errors,[]);report.status='passed';report.persistedSettings=saved.settings;
}catch(e){report.status='failed';report.failure=String(e);report.visibleButtons=await page.getByRole('button').allTextContents().catch(()=>[]);await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}finally{await persist();await context.close();await browser.close();}
console.log(JSON.stringify({engine,after,status:report.status,cases:report.cases.length,out}));
