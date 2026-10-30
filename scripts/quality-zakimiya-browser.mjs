import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {createDefaultV100Save,applyV100SaveMutation,serializeV100Save,validateV100SavePayload} from '../app/v100Save.js';
import {v100EventPhaseForId,V100_EVENT_BY_ID,V100_STAGE_IDS} from '../app/v100Registry.js';
import {createV100BattleResult} from '../app/v100Transactions.js';
import {V100_STORY_SCRIPT_VERSION,V100_STORY_EVENTS} from '../app/v100StoryEvents.js';
import {v100StoryExpressionFor} from '../app/v100StoryDirection.js';
import {v100EventPresentationFor} from '../app/v100EventPresentation.js';
import {chromium,webkit} from 'playwright';
import {dismissInstallOffer} from './pwa-gate-qa.mjs';
import {enterV100FromTitle,seedV100BrowserSaveOnce} from './v100-title-qa-entry.mjs';
import {productionBuildIdentity} from './browser-qa-build-identity.mjs';
import {V100_PORTRAIT_LANDMARKS} from '../app/v100DialogueComposition.js';
const kind=process.env.QUALITY_PORTRAIT_KIND??'zakimiya';
assert.ok(['zakimiya','tky','paisen','nao','mizuchi','monkey','ikura','tatara','raider','gantetsu','chiha','musashi','king','babayaga','kumaverson','segawa','president','commander'].includes(kind));
const owner=({ikura:'guide-ikura',segawa:'segawa',president:'mugarian-president',commander:'red-panther-commander'})[kind]??`unit-${({chiha:'mrs-chiha',musashi:'miyamoto-musashi',king:'crazy-king'})[kind]??kind}`;
const out=path.resolve(process.env.QUALITY_ZAKIMIYA_OUT??`output/quality-20261028/${kind}-runtime-r2`);
await mkdir(out,{recursive:true});
const engine=process.env.QUALITY_PORTRAIT_ENGINE??'chromium';
const report={engine,scope:'Prepared dialogue checkpoint in isolated browser, normal title continue. Visual rendering evidence only, not campaign progression or Producer acceptance.',kind,build:await productionBuildIdentity(),cases:[],errors:[]};
const initial=createDefaultV100Save();
let checkpoints=kind==='paisen' ? [
  {eventId:'v100:event:prologue',nodeIndex:2,expression:'warm'},
  {eventId:'v100:event:prologue',nodeIndex:32,expression:'alarm'},
  {eventId:'v100:event:prologue',nodeIndex:65,expression:'determined'},
  {eventId:'v100:event:s03:post',nodeIndex:3,expression:'grief'},
] : kind==='nao' ? [
  {eventId:'v100:event:s01:post',nodeIndex:5,expression:'warm'},
  {eventId:'v100:event:s07:pre',nodeIndex:2,expression:'determined'},
  {eventId:'v100:event:s08:pre',nodeIndex:4,expression:'grief'},
] : kind==='mizuchi' ? [
  {eventId:'v100:event:s02:post',nodeIndex:6,expression:'determined'},
] : kind==='monkey' ? [
  {eventId:'v100:event:s04:post',nodeIndex:8,expression:'warm'},
] : kind==='chiha' ? [
  {eventId:'v100:event:s17:pre',nodeIndex:2,expression:'determined'},
  {eventId:'v100:event:s17:post',nodeIndex:2,expression:'alarm'},
  {eventId:'v100:event:s17:post',nodeIndex:11,expression:'warm'},
  {eventId:'v100:event:s18:post',nodeIndex:8,expression:'grief'},
] : kind==='musashi' ? [
  {eventId:'v100:event:s20:post',nodeIndex:26,expression:'determined'},
] : kind==='king' ? [
  {eventId:'v100:event:s05:post',nodeIndex:2,expression:'warm'},
] : kind==='tatara' ? [
  {eventId:'v100:event:s07:post',nodeIndex:2,expression:'warm'},
] : kind==='raider' ? [
  {eventId:'v100:event:s06:post',nodeIndex:2,expression:'determined'},
] : kind==='gantetsu' ? [
  {eventId:'v100:event:s08:post',nodeIndex:2,expression:'warm'},
] : kind==='ikura' ? [
  {eventId:'v100:event:s03:post',nodeIndex:9,expression:'grief'},
  {eventId:'v100:event:s06:pre',nodeIndex:1,expression:'determined'},
  {eventId:'v100:event:s09:post',nodeIndex:3,expression:'alarm',insertId:'seg-lab-transfer'},
  {eventId:'v100:event:s01:post',nodeIndex:10,expression:'warm'},
] : [{eventId:kind==='tky'?'v100:event:s14:pre':'v100:event:s12:pre',nodeIndex:kind==='tky'?2:4,expression:'determined'}];
if(['tky','babayaga','kumaverson','segawa','president','commander'].includes(kind)) {
  checkpoints=[];
  for(const [eventId,event] of Object.entries(V100_STORY_EVENTS))for(const [nodeIndex,node] of event.nodes.entries()) {
    if(node.kind!=='dialogue'||node.portraitOwner!==owner)continue;
    if(v100EventPresentationFor({eventId,node,nodeIndex}).cinematic)continue;
    const expression=v100StoryExpressionFor(eventId,nodeIndex,node,owner);
    if(!checkpoints.some(p=>p.expression===expression))checkpoints.push({eventId,nodeIndex,expression});
  }
  assert.ok(checkpoints.length>0,'No actual authored dialogue for this owner');
}
if(process.env.QUALITY_PORTRAIT_FIRST_ONLY==='1')checkpoints=checkpoints.slice(0,1);
// This checks dialogue rendering only; persistent PWA storage uses its separate native gate.
assert.ok(['chromium','webkit'].includes(engine));
const browser=await ({chromium,webkit}[engine]).launch({headless:true});
const alphaBottoms=new Map();
const viewports=[{width:844,height:340},{width:1280,height:720}];
if(process.env.QUALITY_STAGE_LARGE==='1')viewports.push({width:1920,height:1080});
try {
  for(const viewport of viewports)for(const {eventId,nodeIndex,expression,insertId} of checkpoints) {
    const label=`${viewport.width}x${viewport.height}${checkpoints.length>1?'-'+expression:''}`;
    if(process.env.QUALITY_PORTRAIT_CASES&&!process.env.QUALITY_PORTRAIT_CASES.split(',').includes(label))continue;
    const phase=v100EventPhaseForId(eventId),stageNumber=V100_EVENT_BY_ID[eventId].stageNumber;
    const stageId=stageNumber?V100_STAGE_IDS[stageNumber-1]:null;
    // A post-battle checkpoint needs a valid pending victory transaction.
    // This is isolated fixture data, never evidence of a played victory.
    const pendingResult=phase==='post'?createV100BattleResult({stageId,battleRunId:'quality:portrait:'+label,
      won:true,objectiveComplete:true,bossDefeated:true,vehicleHp:680}):null;
    const seed=applyV100SaveMutation(initial,draft=>({...draft,campaignStarted:true,playerName:'立ち絵確認',
      ...(pendingResult?{pendingResult,availableStageIds:V100_STAGE_IDS.slice(0,stageNumber)}:{}),
      eventCursor:{eventId,nodeIndex,scriptVersion:V100_STORY_SCRIPT_VERSION},
      flowState:{...draft.flowState,phase,eventId,nodeIndex,stageId,stageNumber,scriptVersion:V100_STORY_SCRIPT_VERSION}})).save;
    const validation=validateV100SavePayload(JSON.parse(serializeV100Save(seed)));
    assert.ok(validation.ok,JSON.stringify(validation));
    const context=await browser.newContext({viewport,recordVideo:{dir:path.join(out,label),size:viewport}});
    try {
      await context.addInitScript(seedV100BrowserSaveOnce,serializeV100Save(seed));
      const page=await context.newPage();page.setDefaultTimeout(20000);
      page.on('pageerror',e=>report.errors.push(String(e)));
      await page.goto(process.env.V100_CAMPAIGN_QA_BASE_URL);
      await dismissInstallOffer(page,{timeout:20000,readySelector:'.v100-start-screen',waitForFictionDismissal:true});
      await enterV100FromTitle(page);
      if(insertId){
        await page.locator(`[data-v100-insert="${insertId}"]`).waitFor();
        assert.equal(await page.locator('.v100-portrait-frame').count(),0,'Cinematic inserts intentionally hide portraits');
        await page.screenshot({path:path.join(out,`${label}.png`)});
        report.cases.push({viewport,eventId,nodeIndex,expression,insertId,scope:'Cinematic insert retained; this does not prove an alarm portrait was displayed.'});
        continue;
      }
      const selector=`.v100-portrait-frame[data-portrait-owner="${owner}"] img`;
      const portrait=page.locator(selector).first();
      await portrait.waitFor();
      await page.waitForFunction(s=>[...document.querySelectorAll(s)].some(img=>img.complete&&img.naturalWidth>0&&Number(getComputedStyle(img).opacity)>.98&&img.getAnimations().every(a=>a.playState==='finished')),selector);
      const shown=await portrait.evaluate(img=>({src:img.getAttribute('src'),width:img.getBoundingClientRect().width,height:img.getBoundingClientRect().height,naturalWidth:img.naturalWidth}));
      const assetExpression=['gantetsu','king'].includes(kind)?'determined':expression;
      const revision=['babayaga','kumaverson','tatara','gantetsu','musashi','ikura','segawa','president','commander'].includes(kind)?'stage-r1':'quality-r1';
      const expected=`/art/v100/portraits/${kind}-${assetExpression}-${revision}.webp`;
      assert.equal(shown.src,expected);
      assert.ok(shown.width>100&&shown.height>100);
      await page.screenshot({path:path.join(out,`${label}.png`)});
      const composition=await page.evaluate(landmarks=>{
        const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
        const copy=document.querySelector('.v100-node-copy');
        return {copy:rect(copy),copyBackground:getComputedStyle(copy).backgroundColor,
          portraits:[...document.querySelectorAll('.v100-portrait-frame')].map(frame=>{
            const owner=frame.dataset.portraitOwner,img=frame.querySelector('img'),r=rect(img),m=landmarks[owner],scale=r.width/(m.width??512);
            return {owner,src:img.getAttribute('src'),rect:r,naturalWidth:img.naturalWidth,projectedCrown:r.y+m.top*scale,projectedHeadHeight:m.height*scale,frame:rect(frame)};
          }),buttons:[...document.querySelectorAll('.v100-event-heading button,.v100-node-copy button')].map(b=>({label:b.textContent,...rect(b)}))};
      },V100_PORTRAIT_LANDMARKS);
      for(const p of composition.portraits)assert.ok(p.projectedCrown+p.projectedHeadHeight<composition.copy.y,'Dialogue hides the face');
      for(const p of composition.portraits) {
        if(!alphaBottoms.has(p.src)) {
          const {data,info}=await sharp(await readFile(path.join('public',p.src))).ensureAlpha().raw().toBuffer({resolveWithObject:true});
          let bottom=-1;
          for(let y=info.height-1;y>=0&&bottom<0;y--) {
            let solid=0;
            for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>128)solid++;
            if(solid>=20)bottom=y;
          }
          alphaBottoms.set(p.src,bottom);
        }
        p.projectedBodyBottom=p.rect.y+alphaBottoms.get(p.src)*p.rect.width/p.naturalWidth;
        assert.ok(p.projectedBodyBottom>=composition.copy.y+8,`${p.owner}: torso ends above dialogue (${p.projectedBodyBottom} < ${composition.copy.y+8})`);
      }
      if(composition.portraits.length===2){
        assert.ok(Math.abs(composition.portraits[0].projectedCrown-composition.portraits[1].projectedCrown)<1,'Different crown camera');
        assert.ok(Math.abs(composition.portraits[0].projectedHeadHeight-composition.portraits[1].projectedHeadHeight)<1,'Different head scale');
      }
      for(const b of composition.buttons)assert.ok(b.height>=44&&b.width>=44,`Small touch target: ${b.label}`);
      const interactions=[];
      if(process.env.QUALITY_STAGE_INTERACTIONS==='1') {
        await page.waitForTimeout(1200); // Readable dwell in the operation recording.
        const original=await page.locator('.v100-node-copy').innerText();
        await page.getByRole('button',{name:'会話ログ',exact:true}).click();
        await page.getByRole('dialog',{name:'会話記録',exact:true}).waitFor();
        await page.waitForTimeout(1200);
        await page.screenshot({path:path.join(out,`${label}-log.png`)});
        await page.getByRole('dialog',{name:'会話記録',exact:true}).getByRole('button',{name:'閉じる',exact:true}).click();
        assert.equal(await page.locator('.v100-node-copy').innerText(),original);
        interactions.push('Log opens and closes without advancing dialogue');
        await page.locator('.v100-node-copy .v100-primary').click();
        await page.waitForFunction(old=>document.querySelector('.v100-node-copy')?.innerText!==old,original);
        await page.waitForTimeout(1200);
        interactions.push('Next advances the visible story page');
        await page.screenshot({path:path.join(out,`${label}-advanced.png`)});
      }
      report.cases.push({viewport,eventId,nodeIndex,expression,assetExpression,shown,composition,interactions});
    }finally{await context.close();}
  }
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.status='passed';
}catch(error){report.status='failed';report.error=String(error);throw error;}
finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,out}));
