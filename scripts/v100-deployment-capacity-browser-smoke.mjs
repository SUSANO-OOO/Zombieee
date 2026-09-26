import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, webkit } from "playwright";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { V100_STAGE_IDS } from "../app/v100Registry.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const origin=new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(["localhost","127.0.0.1"].includes(origin.hostname));
const out=path.resolve(process.env.V100_DEPLOYMENT_CAP_EVIDENCE_DIR??"outputs/v100-deployment-capacity");
await mkdir(out,{recursive:false});
const report={build:await productionBuildIdentity(),evidenceKind:"explicit Stage6 Level30 save fixture; native UI deployments and real time; no runtime mutation or forced result",cases:[]};
const seed=normalizeV100Save({...createDefaultV100Save(),campaignStarted:true,playerName:"召喚枠検証",levelCap:30,
  availableStageIds:V100_STAGE_IDS,completedStageIds:V100_STAGE_IDS.slice(0,25),
  unitLevels:{"unit-hachi":30},formationSlots:Array(7).fill("unit-hachi"),
  readStoryEventIds:["v100:event:prologue","v100:event:s06:pre"],
  flowState:{phase:"formation",stageId:V100_STAGE_IDS[5],stageNumber:6,destination:"formation"}});
const snapshot=page=>page.evaluate(()=>{const s=window.__ASHFALL_BATTLE_QA__.getSnapshot();return {
  time:s.time,energy:s.energy,over:s.over,queue:s.deployQueue,cooldowns:s.deployCooldowns,
  humans:s.fighters.filter(f=>f.side==="human"&&f.hp>0).map(f=>({id:f.id,kind:f.kind,hp:f.hp,gateEntering:f.gateEntering})),
};});
try {
 for(const [engine,type] of [["chromium",chromium],["webkit",webkit]]) {
  const browser=await type.launch({headless:true});const context=await browser.newContext({viewport:{width:844,height:340},hasTouch:true,isMobile:true});
  const page=await context.newPage();const item={engine,status:"running",errors:[],samples:[]};report.cases.push(item);
  page.on("pageerror",e=>item.errors.push(String(e)));
  page.on("console",m=>{if(m.type()==="error")item.errors.push(m.text());});
  page.on("requestfailed",r=>item.errors.push(`${r.url()}: ${r.failure()?.errorText}`));
  page.on("response",r=>{if(r.status()>=400)item.errors.push(`${r.status()}: ${r.url()}`);});
  try {
   await page.addInitScript(({origin,seed})=>{if(location.origin===origin&&!localStorage.getItem("nishijin-campaign-v100"))localStorage.setItem("nishijin-campaign-v100",seed);},{origin:origin.origin,seed:serializeV100Save(seed)});
   await page.goto(origin.href);await page.getByRole("button",{name:"ブラウザで遊ぶ",exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.v100-shell[aria-busy="false"][data-v100-phase="formation"]'));
   await page.getByRole("button",{name:"戦闘へ",exact:true}).click();
   await page.waitForFunction(()=>window.__ASHFALL_ASSET_QA__?.getBattleMountState?.().battleMounted===true&&window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running);
   const card=page.locator('button.unit-card[data-kind="scout"]').first();
   const started=Date.now();
   while(Date.now()-started<150_000) {
    assert.deepEqual(item.errors,[]);const s=await snapshot(page);item.samples.push(s);
    assert.ok(s.humans.length+s.queue.length<=7,"Paid queue plus live units exceeded seven");
    assert.equal(s.over,false,"Fixture ended before seven live copies were observed");
    if(s.humans.length===7&&s.queue.length===0)break;
    if(await card.isEnabled())await card.click();
    await page.waitForTimeout(250);
   }
   item.before=await snapshot(page);assert.equal(item.before.humans.length,7);assert.equal(item.before.queue.length,0);
   assert.ok(item.before.humans.every(f=>f.kind==="scout"));
   await page.waitForFunction(()=>document.querySelector('button.unit-card[data-kind="scout"]')?.getAttribute("data-block-reason")==="召喚限度到達");
   assert.equal(await card.isEnabled(),false);
   // An actual pointer still reaches an aria-disabled button's handler. It
   // must reject without charging, even if React's HUD is a frame behind.
   const box=await card.boundingBox();assert.ok(box);await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
   item.after=await snapshot(page);
   assert.equal(item.after.humans.length,7);assert.deepEqual(item.after.queue,item.before.queue);
   assert.ok(item.after.energy>=item.before.energy,"Rejected eighth deployment spent command resource");
   assert.ok(item.after.cooldowns.scout<=item.before.cooldowns.scout,"Rejected deployment reset cooldown");
   await page.screenshot({path:path.join(out,`${engine}-seven-live.png`)});
   assert.deepEqual(item.errors,[]);item.status="passed";
  } catch(error) {item.error=String(error);await page.screenshot({path:path.join(out,`${engine}-failure.png`)}).catch(()=>{});throw error;}
  finally {await writeFile(path.join(out,"report.json"),JSON.stringify(report,null,2));await browser.close();}
 }
} catch(error) {report.error=String(error);process.exitCode=1;}
await writeFile(path.join(out,"report.json"),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.cases.filter(c=>c.status==="passed").length,total:report.cases.length,error:report.error}));
