import assert from "node:assert/strict";
import { mkdir,writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium,webkit } from "playwright";
import { createDefaultV100Save,normalizeV100Save,serializeV100Save } from "../app/v100Save.js";
import { V100_STAGE_IDS } from "../app/v100Registry.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const origin=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(["localhost","127.0.0.1"].includes(origin.hostname));
const out=path.resolve(process.env.V100_CORE_BROWSER_DIR??"outputs/v100-research-core-browser");
await mkdir(path.dirname(out),{recursive:true});await mkdir(out,{recursive:false});
const engines=(process.env.V100_CORE_BROWSER_ENGINES??"chromium,webkit").split(",");
assert.ok(engines.every(engine=>["chromium","webkit"].includes(engine)));
const report={build:await productionBuildIdentity(),scope:"Explicit Stage29 Level30/vehicle5 fixture; native UI deployment/abilities, real time and real hits. Read-only battle telemetry and final-canvas observer; no state/result/clock injection. Audio disabled; not normal economy or audio acceptance.",cases:[]};
const roles=["unit-gantetsu","unit-mrs-chiha","unit-nao","unit-mizuchi","unit-babayaga","unit-gantetsu","unit-mrs-chiha"];
async function run(engine) {
 const viewport={width:844,height:340},type={chromium,webkit}[engine];
 const browser=await type.launch({headless:true}),context=await browser.newContext({viewport,hasTouch:true}),page=await context.newPage();
 const item={engine,viewport,status:"running",errors:[],samples:[],inputs:[]};report.cases.push(item);
 const persist=()=>writeFile(path.join(out,`${engine}-report.json`),JSON.stringify(item,null,2));
 const seed=normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,playerName:"二目標実戦検証",levelCap:30,
   availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,28),ownedUnitIds:[...new Set([...roles,"unit-hachi","unit-paisen","unit-kumaverson"])],
   unitLevels:Object.fromEntries(roles.map(id=>[id,30])),formationSlots:roles,vehicle:{upgradeLevel:5,maxHp:1080,upgradeReceipts:[]},
   ownedSupportIds:["support-healing"],equippedSupportId:"support-healing",settings:{bgmEnabled:false,sfxEnabled:false},
   readStoryEventIds:["v100:event:prologue","v100:event:s29:pre"],flowState:{phase:"formation",stageId:V100_STAGE_IDS[28],stageNumber:29,destination:"formation"}});
 item.fixture=seed;
 page.on("pageerror",error=>item.errors.push(String(error)));page.on("console",message=>{if(message.type()==="error")item.errors.push(message.text());});
 page.on("requestfailed",request=>item.errors.push(`${request.url()}: ${request.failure()?.errorText}`));page.on("response",response=>{if(response.status()>=400)item.errors.push(`${response.status()}: ${response.url()}`);});
 try {
  await page.addInitScript(({origin,seed})=>{
   if(location.origin===origin&&!localStorage.getItem("nishijin-campaign-v100"))localStorage.setItem("nishijin-campaign-v100",seed);
   const p=CanvasRenderingContext2D.prototype,draw=p.drawImage,clear=p.clearRect;
   window.__CORE_FRAME__=[];
   p.clearRect=function(...args){if(this.canvas===document.querySelector(".game-shell canvas"))window.__CORE_FRAME__=[];return clear.apply(this,args);};
   p.drawImage=function(source,...args){if(this.canvas===document.querySelector(".game-shell canvas")&&source?.src?.includes("research-core-targets-v1.webp"))window.__CORE_FRAME__.push(args);return draw.call(this,source,...args);};
  },{origin:origin.origin,seed:serializeV100Save(seed)});
  await page.goto(origin.href);await page.getByRole("button",{name:"ブラウザで遊ぶ",exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.v100-shell[aria-busy="false"][data-v100-phase="formation"]'));
  await page.getByRole("button",{name:"戦闘へ",exact:true}).click();
  await page.waitForFunction(()=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running&&window.__CORE_FRAME__.length===2);
  let cursor=0,lastSample=-10,lastScreenshot=-30,lastDestroyed=-1;
  const deadline=Date.now()+7*60_000;
  while(Date.now()<deadline) {
   const sample=await page.evaluate(()=>({snapshot:window.__ASHFALL_BATTLE_QA__?.getSnapshot?.(),draws:window.__CORE_FRAME__}));
   const s=sample.snapshot;if(!s)break;
   assert.equal(s.researchCoreTargets.length,2);assert.equal(s.timelineLength,6);assert.deepEqual(item.errors,[]);
   const destroyed=s.researchCoreTargets.filter(target=>target.hp<=0).length;
   if(s.time-lastSample>=2||destroyed!==lastDestroyed||s.over){item.samples.push({time:s.time,wave:s.wave,eventIndex:s.eventIndex,pendingSpawnCount:s.pendingSpawnCount,baseHp:s.baseHp,barricadeHp:s.barricadeHp,targets:s.researchCoreTargets,draws:sample.draws,over:s.over,won:s.won,fighters:s.fighters.map(f=>({id:f.id,kind:f.kind,side:f.side,x:f.x,y:f.y,hp:f.hp,maxHp:f.maxHp,range:f.range,attack:f.attack}))});lastSample=s.time;await persist();}
   if(s.time-lastScreenshot>=30||destroyed!==lastDestroyed){await page.screenshot({path:path.join(out,`${engine}-${Math.floor(s.time)}s-${destroyed}-destroyed.png`)});lastScreenshot=s.time;lastDestroyed=destroyed;}
   if(s.over){item.result=s;break;}
   const cards=page.locator("button.unit-card[data-kind]");
   const card=cards.nth(cursor%await cards.count());
   if(await card.isEnabled()){item.inputs.push({time:s.time,action:"deploy",kind:await card.getAttribute("data-kind")});await card.click();cursor++;}
   const enemies=s.fighters.filter(f=>f.side==="zombie"&&f.hp>0),humans=s.fighters.filter(f=>f.side==="human"&&f.hp>0&&f.combatReady);
   const barrage=page.locator("button.support-btn.barrage");
   if(enemies.some(f=>f.x<520)&&await barrage.isVisible()&&await barrage.isEnabled()){await barrage.click();item.inputs.push({time:s.time,action:"barrage"});}
   const icons=await page.locator('button.manual-ability-ready.available[aria-disabled="false"]').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,kind:el.getAttribute("data-ability-kind")};}));
   for(const icon of icons)if(humans.some(h=>h.kind===icon.kind&&enemies.some(e=>Math.abs(e.x-h.x)<h.range+70))) {
    const clear=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('button.manual-ability-ready')!==null,icon);
    if(clear){await page.mouse.click(icon.x,icon.y);item.inputs.push({time:s.time,action:"ability",kind:icon.kind});}
   }
   const heal=page.locator('button[data-support-id="support-healing"]');
   if(humans.some(h=>h.hp/h.maxHp<.65)&&await heal.count()&&await heal.isEnabled()) {
    const anchors=await page.locator("button.manual-ability-ready").evaluateAll(els=>els.map(el=>({x:Number(el.getAttribute("data-owner-anchor-x")),y:Number(el.getAttribute("data-owner-anchor-y"))})));
    if(anchors.length){anchors.sort((a,b)=>a.x-b.x);const a=anchors[Math.floor(anchors.length/2)],canvas=await page.locator(".game-shell canvas").boundingBox(),point={x:canvas.x+a.x,y:canvas.y+a.y+20};
     if(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.tagName==="CANVAS",point)){await heal.click();await page.mouse.click(point.x,point.y);item.inputs.push({time:s.time,action:"heal",point});}
    }
   }
   await page.waitForTimeout(300);
  }
  assert.ok(item.result?.over,"Real battle did not finish within the observation window");assert.equal(item.result.won,true);
  assert.ok(item.samples.some(s=>s.targets[0].hp===0&&s.targets[1].hp>0),"Both targets were not independently resolved");
  assert.ok(item.result.researchCoreTargets.every(target=>target.hp===0));assert.equal(item.result.eventIndex,6);
  await page.getByLabel("作戦結果",{exact:true}).waitFor({timeout:20_000});
  item.savedResult=await page.evaluate(()=>JSON.parse(localStorage.getItem("nishijin-campaign-v100"))?.pendingResult);
  assert.ok(item.savedResult?.won);assert.equal(item.savedResult.researchCoreTargets.length,2);assert.ok(item.savedResult.researchCoreTargets.every(target=>target.hp===0));
  await page.screenshot({path:path.join(out,`${engine}-result.png`)});assert.deepEqual(item.errors,[]);item.status="passed";
 }catch(error){item.status="failed";item.error=String(error.stack??error);await page.screenshot({path:path.join(out,`${engine}-failure.png`)}).catch(()=>{});throw error;}
 finally{await persist();await browser.close();}
}
const results=await Promise.allSettled(engines.map(run));
report.status=results.every(r=>r.status==="fulfilled")?"passed":"failed";
await writeFile(path.join(out,"report.json"),JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,cases:report.cases.map(({engine,status,error})=>({engine,status,error}))}));
if(report.status!=="passed")process.exitCode=1;
