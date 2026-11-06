import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {chromium} from 'playwright';
import {CAMPAIGN_UNITS} from '../app/campaign.js';
import {createDefaultV100Save,normalizeV100Save,serializeV100Save} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {enemyAiProfileFor,ENEMY_AI_PROFILE_BY_KIND} from '../app/combatAiProfiles.js';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';

const origin=new URL(process.env.QUALITY_ENEMY_RELEASE_URL),out=path.resolve(process.env.QUALITY_ENEMY_RELEASE_OUT);
assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));await mkdir(out,{recursive:false});
const before=process.env.QUALITY_ENEMY_RELEASE_BEFORE==='1',hash=b=>createHash('sha256').update(b).digest('hex');
const sourceRef='29282dcfd6f551539a5e828d45eb64e590da7522',oldSource=execFileSync('git',['show',sourceRef+':app/combatAiProfiles.js']);
await writeFile(path.join(out,'baseline-profile-source.js'),oldSource,{flag:'wx'});
const buildRoot=process.env.QUALITY_ENEMY_RELEASE_BUILD_ROOT??null,head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),build=buildRoot?await productionBuildIdentity(buildRoot):null;
if(buildRoot){const s=JSON.parse(await readFile(path.join(buildRoot,'snapshot.json'),'utf8'));assert.equal(s.sourceHead,head);assert.equal(s.combinedSha256,build.combinedSha256);assert.equal(before,false,'The old-behavior override is a dev comparison, not a frozen-candidate result');}
const report={before,head,build,runtime:build?'frozen-production':'working-development',url:origin.href,scope:'Controlled initial scene through the existing localhost crawler-defense proof; actual simulation/rendering after setup. A live distant old target is seeded. Baseline restores only the old eligibility expression in the served development module. Not natural progression, balance, audio or physical acceptance.',baselineRef:sourceRef,baselineSourceSha256:hash(oldSource),source:{},overrides:[],cases:[],errors:[]};
for(const file of ['app/combatAiProfiles.js','app/AshfallGame.tsx'])report.source[file]=hash(await readFile(file));
const browser=await chromium.launch({headless:true,args:['--mute-audio']});
try{
 for(const kind of ['runner','walker']){
  const id=CAMPAIGN_UNITS.find(u=>u.combatKind==='scout').id;
  const seed=normalizeV100Save({...createDefaultV100Save({settings:{bgmEnabled:false,sfxEnabled:false}}),campaignStarted:true,ownedUnitIds:[id],registeredUnitIds:[id],formationSlots:[id],availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,22),flowState:{phase:'formation',stageId:V100_STAGE_IDS[0],stageNumber:1,eventId:null,destination:'formation',nodeIndex:0,firstClear:false,finalized:true}});
  const context=await browser.newContext({viewport:{width:1280,height:720},hasTouch:true,serviceWorkers:'block',recordVideo:{dir:path.join(out,kind+'-video'),size:{width:1280,height:720}}});
  await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
  if(before)await context.route(url=>url.pathname.endsWith('/combatAiProfiles.js'),async route=>{
   try{
    const response=await route.fetch(),source=(await response.text()).replace(/\r\n/g,'\n');
    const needle='const pursuable = inContact || blocksRoute || profile.humanPursuit';assert.equal(source.split(needle).length,2,'One exact eligibility override');
    const body=source.replace(needle,'const pursuable = inContact || blocksRoute || current || profile.humanPursuit');report.overrides.push({kind,url:route.request().url(),fromSha256:hash(source),toSha256:hash(body)});
    await route.fulfill({status:200,contentType:'text/javascript',body});
   }catch(e){report.errors.push('Baseline route: '+String(e));await route.abort('failed');}
  });
  const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(String(e)));
  const record={kind,profile:ENEMY_AI_PROFILE_BY_KIND[kind],rows:[]};report.cases.push(record);
  try{
   await page.goto(origin.href);await dismissInstallOffer(page,{timeout:30000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});await enterV100FromTitle(page);
   const notice=page.getByText('オフライン用の設定に失敗しました。通信できる状態ではゲームを続けられます。',{exact:true});if(await notice.isVisible())await notice.locator('..').getByRole('button',{name:'閉じる',exact:true}).click();
   await page.getByRole('button',{name:'戦闘へ',exact:true}).click();await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running&&document.documentElement.dataset.assetLoadState==='ready');
   const start=await page.evaluate(kind=>{const q=window.__ASHFALL_BATTLE_QA__,proof=q.prepareCrawlerDefenseProof({attackerKind:kind,lane:1,existingClaim:true,staleLiveTarget:true});return{proof,snapshot:q.getSnapshot(),at:performance.now()};},kind);
   record.setup=start;assert.equal(start.proof.staleLiveTarget,true);const actor=start.snapshot.fighters.find(f=>f.id===start.proof.attackerId),target=start.snapshot.fighters.find(f=>f.id===start.proof.existingClaimId);assert.ok(actor&&target&&target.hp>0);
   assert.ok(Math.hypot(actor.x-target.x,actor.y-target.y)>enemyAiProfileFor(record.profile).engagementRadius+24);assert.equal(actor.targetId,target.id);
   await page.screenshot({path:path.join(out,kind+'-start.png')});
   const deadline=Date.now()+3200;while(Date.now()<deadline){const row=await page.evaluate(id=>{const s=window.__ASHFALL_BATTLE_QA__.getSnapshot();return{time:s.time,baseHp:s.baseHp,fighter:s.fighters.find(f=>f.id===id)};},actor.id);record.rows.push(row);await page.waitForTimeout(100);}
   const end=record.rows.at(-1);assert.ok(Number.isFinite(end.baseHp));
   if(before){assert.equal(end.baseHp,start.snapshot.baseHp);assert.equal(end.fighter.targetId,target.id);}else{assert.equal(end.fighter.targetId,null);assert.ok(end.baseHp<start.snapshot.baseHp,'Released target must let the real enemy attack the crawler');}
   await page.screenshot({path:path.join(out,kind+'-end.png')});record.status='passed';
  }catch(e){record.status='failed';record.failure=String(e);await page.screenshot({path:path.join(out,kind+'-failure.png')}).catch(()=>{});throw e;}finally{await context.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
 }
 if(before)assert.equal(report.overrides.length,2);assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.failure=String(e);throw e;}finally{await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({before,status:report.status,cases:report.cases.map(c=>({kind:c.kind,initialBaseHp:c.setup.snapshot.baseHp,finalBaseHp:c.rows.at(-1)?.baseHp})),out}));
