import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {CAMPAIGN_UNITS} from '../app/campaign.js';
import {QUALITY_CHARACTER_ATLASES,QUALITY_CHARACTER_BASE_ATLASES} from '../app/qualityCharacterAtlases.js';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save,V100_PRIMARY_STORAGE_KEY} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {nativeBattleTap} from './v100-normal-tactical-input.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';

const engine=process.env.QUALITY_MODEL_ROSTER_ENGINE??'chromium',before=process.env.QUALITY_MODEL_ROSTER_BEFORE==='1';
assert.ok(['chromium','webkit'].includes(engine));
const origin=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));
const out=path.resolve(process.env.QUALITY_MODEL_ROSTER_OUT);await mkdir(out,{recursive:false});
const groups=[['brawler','tky','zakimiya','kumaverson'],['babayaga','scout','brute','guardian'],
 ['ranger','gunner','medic','engineer'],['mrs-chiha','miyamoto-musashi','crazy-king','mayo-chan']];
const selected=(process.env.QUALITY_MODEL_ROSTER_GROUPS??'0,1,2,3').split(',').map(Number);
assert.ok(selected.length&&new Set(selected).size===selected.length&&selected.every(i=>Number.isInteger(i)&&i>=0&&i<groups.length));
const only=process.env.QUALITY_MODEL_ROSTER_ONLY_KINDS?.split(',');
if(only)assert.ok(only.length&&new Set(only).size===only.length&&only.every(kind=>selected.some(index=>groups[index].includes(kind))),'Focused kinds must belong to the selected canonical groups');
assert.deepEqual(groups.flat().sort(),Object.keys(QUALITY_CHARACTER_ATLASES).sort());
const report={engine,before,build:await productionBuildIdentity(process.env.QUALITY_MODEL_ROSTER_BUILD_ROOT??process.cwd()),scope:'Prepared owned level-1 groups or focused members at S03. Native title, deployment and available ability controls; ordinary simulation speed, muted. Before substitutes twelve retained previous textures on the same build with service workers blocked, including Babayaga\'s previous photo head; four integrated heads stay unchanged. Not natural unlocks, all 48 forms, continuous human viewing, audio listening, body/movement acceptance or physical QA.',cases:[],errors:[]};
const headSources=JSON.parse(await readFile('assets/source/quality-20261028/identity/battle-heads-r3/runtime-provenance.json','utf8')).entries;
const browser=await({chromium,webkit}[engine]).launch({headless:true,...(engine==='chromium'?{args:['--mute-audio']}:{})});
try{
 for(const index of selected){
  const kinds=groups[index].filter(kind=>!only||only.includes(kind));if(!kinds.length)continue;
  const ids=kinds.map(kind=>{const unit=CAMPAIGN_UNITS.find(u=>u.combatKind===kind);assert.ok(unit,kind);return unit.id;});
  const record={group:index,kinds,inputs:[],rows:[],overrides:[],screenshots:[],states:[],abilityKinds:[]};report.cases.push(record);
  const context=await browser.newContext({viewport:{width:1280,height:720},hasTouch:true,serviceWorkers:'block',recordVideo:{dir:path.join(out,`group-${index}-video`),size:{width:1280,height:720}}});
  const page=await context.newPage();page.setDefaultTimeout(25000);page.on('pageerror',e=>report.errors.push(String(e)));
  try{
   const seed=normalizeV100Save({...createDefaultV100Save({settings:{bgmEnabled:false,sfxEnabled:false}}),campaignStarted:true,ownedUnitIds:ids,registeredUnitIds:ids,formationSlots:ids,availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,2),flowState:{phase:'formation',stageId:V100_STAGE_IDS[2],stageNumber:3,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
   await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
   if(before){
    const changes=new Map(Object.entries(QUALITY_CHARACTER_ATLASES).filter(([,a])=>a.path.endsWith('-quality-model-r3.webp')).map(([kind,a])=>[a.path,kind]));
    await context.route(url=>changes.has(url.pathname),async route=>{const kind=changes.get(new URL(route.request().url()).pathname),file='public'+(headSources.find(row=>row.kind===kind)?.beforeAssetPath??QUALITY_CHARACTER_BASE_ATLASES[kind].path),body=await readFile(file);if(!record.overrides.some(r=>r.kind===kind))record.overrides.push({kind,file,sha256:createHash('sha256').update(body).digest('hex')});await route.fulfill({body,contentType:'image/webp'});});
   }
   await page.goto(origin.href);await dismissInstallOffer(page,{timeout:25000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
   const offline=page.getByText('オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。',{exact:true});if(await offline.isVisible())await offline.locator('..').getByRole('button',{name:'閉じる',exact:true}).click();
   await page.getByRole('button',{name:'戦闘へ',exact:true}).click();await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running&&document.documentElement.dataset.assetLoadState==='ready');
   const started=Date.now(),deadline=started+105000,seen=new Set(),painted=new Set(),smallPainted=new Set(),largeShots=new Set(),deployed=new Set(),abilities=new Set();let smallAt=null,last=null;
   while(Date.now()<deadline){
    const s=await page.evaluate(kinds=>{const q=window.__ASHFALL_BATTLE_QA__;if(!q)return null;const s=q.getSnapshot();return{time:s.time,running:s.running,fighters:s.fighters.filter(f=>f.side==='human'&&kinds.includes(f.kind)).map(f=>({id:f.id,kind:f.kind,hp:f.hp,x:f.x,y:f.y,state:f.renderAudit?.requestedState,manual:f.manualAbility,render:f.renderAudit}))};},kinds);
    if(!s){record.battleEnded=true;record.terminalText=(await page.locator('body').innerText()).slice(0,3000);break;}last=s;
    for(const f of s.fighters){deployed.add(f.kind);if(f.hp<=0||!f.render?.assetReady)continue;record.rows.push({time:s.time,viewport:smallAt?'844x340':'1280x720',...f});
     const transformed=f.kind==='mayo-chan'&&f.render.jointAtlasPath?.includes('feral');
     assert.equal(f.render.jointDrawSucceeded,true,f.kind+' articulated paint');
     if(!transformed){assert.equal(f.render.jointAtlasPath,QUALITY_CHARACTER_ATLASES[f.kind].path);painted.add(f.kind);}
     const key=f.kind+':'+f.state+':'+(smallAt?'small':'large');seen.add(key);
     if(!smallAt&&!largeShots.has(f.kind)){largeShots.add(f.kind);const file=path.join(out,`group-${index}-${f.kind}-large-first.png`);await page.screenshot({path:file});record.screenshots.push(file);}
     // Verify each actor at both sizes before a legitimate combat death can
     // remove it. Do not change HP, stats, clock, AI or the battle outcome.
     if(!smallAt&&!transformed&&!smallPainted.has(f.kind)){
      await page.setViewportSize({width:844,height:340});
      await page.waitForFunction(id=>{const f=window.__ASHFALL_BATTLE_QA__.getSnapshot().fighters.find(f=>f.id===id);return innerWidth===844&&f?.hp>0&&f.renderAudit?.assetReady&&f.renderAudit?.jointDrawSucceeded&&f.renderAudit?.requestedState!=='deploy';},f.id,{timeout:3500});
      const small=await page.evaluate(id=>{const s=window.__ASHFALL_BATTLE_QA__.getSnapshot(),f=s.fighters.find(f=>f.id===id);return{time:s.time,id:f.id,kind:f.kind,hp:f.hp,x:f.x,y:f.y,state:f.renderAudit?.requestedState,manual:f.manualAbility,render:f.renderAudit};},f.id);
      assert.equal(small.render.jointAtlasPath,QUALITY_CHARACTER_ATLASES[f.kind].path);
      record.rows.push({...small,viewport:'844x340'});smallPainted.add(f.kind);seen.add(f.kind+':'+small.state+':small');
      const file=path.join(out,`group-${index}-${f.kind}-small-first.png`);await page.screenshot({path:file});record.screenshots.push(file);
      await page.setViewportSize({width:1280,height:720});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     }
    }
    if(kinds.every(kind=>painted.has(kind)&&smallPainted.has(kind))&&s.time>=12)break;
    for(const kind of kinds)if(!deployed.has(kind)&&await nativeBattleTap(page,page.locator(`button.unit-card[data-kind="${kind}"]`).first()))record.inputs.push({time:s.time,action:'deploy',kind});
    for(const f of s.fighters)if(f.hp>0&&!abilities.has(f.kind)&&await nativeBattleTap(page,page.locator(`button[data-fighter-id="${f.id}"][data-ability-kind]`).first())){abilities.add(f.kind);record.inputs.push({time:s.time,action:'ability',kind:f.kind});}
    if(kinds.every(kind=>painted.has(kind)&&smallPainted.has(kind))&&s.time>24&&!smallAt){await page.setViewportSize({width:844,height:340});smallAt=Date.now();}
    if(smallAt&&Date.now()-smallAt>=9000)break;
    if(!s.running)break;await page.waitForTimeout(150);
   }
   record.states=[...seen];record.abilityKinds=[...abilities];record.painted=[...painted];record.smallPainted=[...smallPainted];record.last=last;record.wallSeconds=(Date.now()-started)/1000;
   assert.ok(kinds.every(kind=>painted.has(kind)),'every normal head painted on its original actor');assert.ok(kinds.every(kind=>smallPainted.has(kind)),'both viewport sizes recorded for every actor');
   for(const kind of kinds)assert.ok(record.rows.some(r=>r.kind===kind&&r.viewport==='844x340'),'small viewport paint '+kind);
   const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),V100_PRIMARY_STORAGE_KEY);
   for(const key of ['ownedUnitIds','registeredUnitIds','caps','receipts'])assert.deepEqual(saved[key],seed[key],key);
   record.status='passed-normal-head-integration';
  }catch(error){record.status='failed';record.error=String(error);await page.screenshot({path:path.join(out,`group-${index}-failure.png`)}).catch(()=>{});throw error;}
  finally{await context.close();record.video=await page.video().path();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
 }
 assert.ok(report.cases.length>0,'At least one actual group must run');assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.error=String(error);throw error;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({engine,before,status:report.status,groups:report.cases.length,out}));
