import assert from "node:assert/strict";
import { mkdir,writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium,webkit } from "playwright";
import { createDefaultV100Save,normalizeV100Save,serializeV100Save } from "../app/v100Save.js";
import { V100_STAGE_IDS } from "../app/v100Registry.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const origin=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(["localhost","127.0.0.1"].includes(origin.hostname));
const out=path.resolve(process.env.V100_VEHICLE_BROWSER_DIR??"outputs/v100-mission-vehicle-browser");
await mkdir(path.dirname(out),{recursive:true});await mkdir(out,{recursive:false});
const report={build:await productionBuildIdentity(),scope:"Explicit Stage12/19/26 Level30 save fixture, native entry and deployment, read-only actual final-canvas draw observation; no battle-state mutation or victory shortcut",cases:[]};
const requested=(process.env.V100_VEHICLE_BROWSER_STAGES??"12,19,26").split(",").map(Number);
assert.ok(requested.length&&requested.every(number=>[12,19,26].includes(number)),"Unknown vehicle stage selection");
report.requestedStageNumbers=requested;
try {
 for(const [engine,type]of Object.entries({chromium,webkit}))for(const viewport of [{width:1280,height:720},{width:844,height:340}])for(const [number,count,label]of [[12,1,"密閉搬送車"],[19,1,"証拠搬送車"],[26,3,"冷蔵車"]].filter(([number])=>requested.includes(number))) {
  const browser=await type.launch({headless:true}),context=await browser.newContext({viewport,hasTouch:true,isMobile:viewport.width<1000}),page=await context.newPage();
  const item={engine,viewport,number,count,status:"running",errors:[]};report.cases.push(item);
  const seed=normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,playerName:"車両表示検証",levelCap:30,availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,25),unitLevels:{"unit-hachi":30},formationSlots:Array(7).fill("unit-hachi"),readStoryEventIds:["v100:event:prologue",`v100:event:s${String(number).padStart(2,"0")}:pre`],flowState:{phase:"formation",stageId:V100_STAGE_IDS[number-1],stageNumber:number,destination:"formation"}});
  page.on("pageerror",error=>item.errors.push(String(error)));page.on("console",message=>{if(message.type()==="error")item.errors.push(message.text());});
  page.on("requestfailed",request=>item.errors.push(`${request.url()}: ${request.failure()?.errorText}`));page.on("response",response=>{if(response.status()>=400)item.errors.push(`${response.status()}: ${response.url()}`);});
  try {
   await page.addInitScript(({origin,seed})=>{
    if(location.origin===origin&&!localStorage.getItem("nishijin-campaign-v100"))localStorage.setItem("nishijin-campaign-v100",seed);
    const prototype=CanvasRenderingContext2D.prototype,nativeDraw=prototype.drawImage,nativeClear=prototype.clearRect,maskSources=new WeakMap();
    window.__VEHICLE_FRAME__=[];
    prototype.clearRect=function(...args){if(this.canvas===document.querySelector(".game-shell canvas"))window.__VEHICLE_FRAME__=[];return nativeClear.apply(this,args);};
    prototype.drawImage=function(source,...args){
      const url=source?.src??maskSources.get(source)??"";
      if(url.includes("sealed-transport-")) {
        if(this.canvas===document.querySelector(".game-shell canvas"))window.__VEHICLE_FRAME__.push({url,rect:args.slice(-4),arguments:args.length});
        else if(url.includes("damaged"))maskSources.set(this.canvas,url);
      }
      return nativeDraw.call(this,source,...args);
    };
   },{origin:origin.origin,seed:serializeV100Save(seed)});
   await page.goto(origin.href);await page.getByRole("button",{name:"ブラウザで遊ぶ",exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.v100-shell[aria-busy="false"][data-v100-phase="formation"]'));
   await page.getByRole("button",{name:"戦闘へ",exact:true}).click();
   await page.waitForFunction(count=>window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running&&window.__VEHICLE_FRAME__?.length===count,count);
   item.start=await page.evaluate(()=>({draws:window.__VEHICLE_FRAME__,mission:window.__ASHFALL_BATTLE_QA__.getSnapshot().escortMissionObject,formation:window.__ASHFALL_BATTLE_QA__.getSnapshot().escortFormation}));
   const card=page.locator('button.unit-card[data-kind="scout"]').first();await card.click();
   await page.waitForFunction(x=>window.__ASHFALL_BATTLE_QA__.getSnapshot().escortFormation.cartX>x+2,item.start.formation.cartX,{timeout:30_000});
   item.moving=await page.evaluate(()=>({draws:window.__VEHICLE_FRAME__,mission:window.__ASHFALL_BATTLE_QA__.getSnapshot().escortMissionObject,formation:window.__ASHFALL_BATTLE_QA__.getSnapshot().escortFormation}));
   item.hud=await page.locator(".game-shell").innerText();assert.match(item.hud,new RegExp(label));assert.doesNotMatch(item.hud,/保守台車/);
   for(const sample of [item.start,item.moving]) {
     assert.equal(sample.draws.length,count);assert.equal(sample.mission.vehicleCount,count);assert.equal(sample.mission.assetLoaded,true);
     assert.ok(sample.draws.every(draw=>draw.url.includes("sealed-transport-intact-v1.webp")&&draw.arguments===8));
   }
   item.screenshot=path.join(out,`${engine}-${viewport.width}x${viewport.height}-s${number}.png`);await page.screenshot({path:item.screenshot});
   assert.deepEqual(item.errors,[]);item.status="passed";
  }catch(error){item.error=String(error.stack??error);await page.screenshot({path:path.join(out,`${engine}-${viewport.width}-s${number}-failure.png`)}).catch(()=>{});throw error;}
  finally{await writeFile(path.join(out,"report.json"),JSON.stringify(report,null,2));await browser.close();}
 }
 report.status="passed";
}catch(error){report.status="failed";report.error=String(error);process.exitCode=1;}
finally{await writeFile(path.join(out,"report.json"),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,cases:report.cases.length,error:report.error}));}
