// A normal campaign route: fresh save, earned CAPS, real time and UI inputs.
// Read-only save inspection records progress; no seed, QA bridge or forced result.
import assert from "node:assert/strict";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { chromium } from "playwright";
import { V100_STAGES, V100_UNITS, V100_VEHICLE, v100LevelCost } from "../app/v100Registry.js";
import { v100StoryEventView } from "../app/v100StoryEvents.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
assert.equal(origin.search, "");
const out = path.resolve(process.env.V100_NORMAL_PLAY_EVIDENCE_DIR ?? "outputs/v100-normal-campaign");
await mkdir(out, { recursive: false });
const report = { evidenceKind:"automated normal UI playthrough; manual feel and physical-device acceptance remain separate", origin:origin.href, build:await productionBuildIdentity(), stages:[], events:{}, transactions:[], errors:[], status:"running" };
const resumeDir = process.env.V100_NORMAL_PLAY_RESUME_DIR && path.resolve(process.env.V100_NORMAL_PLAY_RESUME_DIR);
let restoredStorage;
if (resumeDir) {
  const previousBytes = await readFile(path.join(resumeDir,"report.json"));
  const storageBytes = await readFile(path.join(resumeDir,"browser-storage.json"));
  const previous = JSON.parse(previousBytes);
  assert.equal(previous.origin, origin.href, "Resume the same isolated origin");
  assert.deepEqual(previous.build, report.build, "A different product build needs a separately identified continuation");
  assert.deepEqual(previous.errors, [], "Do not resume unclassified browser diagnostics");
  restoredStorage = JSON.parse(storageBytes);
  report.resumeFrom = { path:resumeDir, reportSha256:createHash("sha256").update(previousBytes).digest("hex"), storageSha256:createHash("sha256").update(storageBytes).digest("hex"), previousStatus:previous.status, previousError:previous.error };
  report.stages = previous.stages; report.events = previous.events; report.transactions = previous.transactions;
}
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,...(restoredStorage ? {storageState:restoredStorage} : {})});
const page = await context.newPage();
page.setDefaultTimeout(15_000);
const saveAt = () => page.evaluate(() => JSON.parse(localStorage.getItem("nishijin-campaign-v100")));
const phaseAt = () => page.locator(".v100-shell").getAttribute("data-v100-phase");
const normalizeText = text => String(text ?? "").replaceAll("**", "").replace(/\s+/gu, "").trim();
const persist = async () => writeFile(path.join(out,"report.json"), JSON.stringify(report,null,2));
async function continueRequested() {
  const stop = await readFile(path.join(out,"stop-request.txt"),"utf8").catch(error => { if (error.code === "ENOENT") return null; throw error; });
  if (stop !== null) throw new Error(`Normal play stopped for diagnosis: ${stop.trim()}`);
}
page.on("console",m=>{if(m.type()==="error")report.errors.push({kind:"console",message:m.text()});});
page.on("pageerror",e=>report.errors.push({kind:"page",message:String(e)}));
page.on("requestfailed",r=>report.errors.push({kind:"request",url:r.url(),message:r.failure()?.errorText}));
page.on("response",r=>{if(r.status()>=400)report.errors.push({kind:"http",url:r.url(),status:r.status()});});
async function ready() {
  await page.waitForFunction(() => !document.querySelector('.v100-shell[aria-busy="true"]'));
  await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
}
async function uiClick(locator) { await ready(); await locator.click(); await ready(); }
const button = name => page.getByRole("button",{name,exact:true});
const selectPersonnel = unit => page.locator("button.v100-personnel-card").filter({has:page.getByRole("heading",{name:unit.displayName,exact:true})});
function plannedFormation(save) {
  const preference=["unit-gantetsu","unit-tatara","unit-kumaverson","unit-babayaga","unit-nao","unit-mizuchi","unit-hachi","unit-monkey","unit-paisen"];
  return preference.filter(id=>save.ownedUnitIds.includes(id)).slice(0,7);
}
async function prepareEconomy(stageNumber) {
  let save=await saveAt();
  await uiClick(button("隊員を編成"));
  for(const id of ["unit-nao","unit-mizuchi","unit-monkey","unit-tatara","unit-gantetsu"]) {
    const unit=V100_UNITS.find(unit=>unit.id===id);
    if(!save.ownedUnitIds.includes(id)&&save.registeredUnitIds.includes(id)&&save.caps>=unit.registrationCostCaps) {
      await uiClick(selectPersonnel(unit));
      await uiClick(button(`配備登録 ${unit.registrationCostCaps} CAPS`));
      save=await saveAt(); report.transactions.push({stageNumber,action:"register",id,caps:save.caps});
    }
  }
  await uiClick(button("作戦地図へ"));
  // Reserve a modest vehicle progression and the first unlocked healing supply.
  await uiClick(button("出撃装備を選ぶ"));
  if(save.supportPurchaseUnlockedIds.includes("support-healing")) {
    const healing=page.locator(".v100-support-management-card").filter({has:page.getByRole("heading",{name:"回復支援",exact:true})});
    if(!save.ownedSupportIds.includes("support-healing")&&save.caps>=50) {
      await uiClick(healing.getByRole("button",{name:"50 CAPSで取得",exact:true})); save=await saveAt();
      report.transactions.push({stageNumber,action:"buy-healing",caps:save.caps});
    }
    if(save.ownedSupportIds.includes("support-healing")&&save.equippedSupportId!=="support-healing") {
      await uiClick(healing.getByRole("button",{name:"装備",exact:true})); save=await saveAt();
    }
  }
  const desiredVehicleLevel=Math.min(5,Math.floor(stageNumber/5));
  const cost=V100_VEHICLE.upgradeCosts[save.vehicle.upgradeLevel]??Infinity;
  if(save.vehicle.upgradeLevel<desiredVehicleLevel&&save.caps>=cost) {
    await uiClick(button("装甲車両を強化"));
    await uiClick(button(`HPを強化 / ${cost} CAPS`)); save=await saveAt();
    report.transactions.push({stageNumber,action:"vehicle",level:save.vehicle.upgradeLevel,caps:save.caps});
    await uiClick(button("出撃装備へ"));
  }
  await uiClick(button("作戦地図へ"));
  await uiClick(button("隊員を編成"));
  const targetLevel=Math.min(save.levelCap,Math.max(1,Math.ceil(stageNumber*.8)));
  for(let n=0;n<210;n++) {
    const ids=plannedFormation(save).filter(id=>save.unitLevels[id]<targetLevel).sort((a,b)=>save.unitLevels[a]-save.unitLevels[b]);
    const id=ids.find(id=>save.caps>=v100LevelCost(save.unitLevels[id]+1));
    if(!id)break;
    const unit=V100_UNITS.find(unit=>unit.id===id);
    const cost=v100LevelCost(save.unitLevels[id]+1);
    await uiClick(selectPersonnel(unit));await uiClick(button(`強化 ${cost} CAPS`));
    save=await saveAt();report.transactions.push({stageNumber,action:"level",id,level:save.unitLevels[id],caps:save.caps});
  }
  await uiClick(button("作戦地図へ"));
}
async function configureFormation() {
  const save=await saveAt();const wanted=plannedFormation(save);
  for(let index=0;index<7;index++) {
    if((save.formationSlots[index]??null)===(wanted[index]??null))continue;
    const slot=page.locator(".v100-slot-track button").nth(index);
    await uiClick(slot);
    if(wanted[index]) {
      const unit=V100_UNITS.find(unit=>unit.id===wanted[index]);
      await uiClick(button(`${unit.displayName}を枠${index+1}へ配置`));
    } else await uiClick(button("枠を空ける"));
  }
  await uiClick(button("戦闘へ"));
}
async function battle(stage) {
  const record={number:stage.number,id:stage.id,startedAt:new Date().toISOString(),openingSave:await saveAt(),inputs:[],status:"running"};
  report.stages.push(record); await persist();
  const start=Date.now();let lastShot=0;let cursor=0;let lastAction=0;
  while(await phaseAt()==="battle") {
    await continueRequested();
    const countText = await page.locator(".bay-status").allTextContents();
    const count = countText.join(" ").match(/召喚限度\s+(\d+)\/(\d+)/u);
    if (count) {
      record.maximumObservedActive = Math.max(record.maximumObservedActive ?? 0,Number(count[1]));
      assert.equal(Number(count[2]),7);assert.ok(Number(count[1])<=7,`Live deployment cap exceeded: ${count[0]}`);
    }
    try {
    if(report.errors.length)throw new Error("Browser diagnostics during normal battle");
    if(Date.now()-start>15*60_000)throw new Error(`Stage ${stage.number} exceeded the observation window; no victory or clock change injected`);
    const audio=page.getByRole("button",{name:"音声を有効にする",exact:true});
    if(await audio.isVisible())await audio.click();
    if(Date.now()-lastShot>30_000) {
      await page.screenshot({path:path.join(out,`s${stage.number}-${Math.floor((Date.now()-start)/1000)}s.png`)});
      lastShot=Date.now();
      record.lastHud=await page.locator(".game-shell").innerText();await persist();
    }
    const cards=page.locator("button.unit-card[data-kind]");
    const count=await cards.count();
    if(count&&Date.now()-lastAction>500) {
      const card=cards.nth(cursor%count);
      if(await card.isEnabled()) {
        const kind=await card.getAttribute("data-kind"); await card.click();
        record.inputs.push({seconds:(Date.now()-start)/1000,action:"deploy",kind});cursor++;lastAction=Date.now();
      }
    }
    const barrage=page.getByRole("button",{name:/^装甲車両一斉砲撃/});
    if(await barrage.isVisible()&&await barrage.isEnabled()) {
      await barrage.click();record.inputs.push({seconds:(Date.now()-start)/1000,action:"barrage"});
    }
    const icons=page.locator('button.manual-ability-ready.available[aria-disabled="false"]');
    for(const icon of (await icons.all()).slice(0,2)) {
      // Sample the visible hit target once. A moving/disappearing target is
      // observed again on the next game frame; no force or hidden input.
      const hit=await icon.evaluate(el=>{const r=el.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;const top=document.elementFromPoint(x,y);return top&&(top===el||el.contains(top))?{x,y,kind:el.getAttribute("data-ability-kind")}:null;}).catch(error => { if (/not attached|detached|Failed to find element/iu.test(String(error))) return null; throw error; });
      if(hit){await page.mouse.click(hit.x,hit.y);record.inputs.push({seconds:(Date.now()-start)/1000,action:"ability",kind:hit.kind});}
    }
    const healing=page.locator('button[data-support-id="support-healing"]');
    if(await healing.count()&&await healing.isEnabled()) {
      await healing.click();
      const canvas=await page.locator(".game-shell canvas").boundingBox();
      if(canvas)await page.mouse.click(canvas.x+canvas.width*.35,canvas.y+canvas.height*.48);
      record.inputs.push({seconds:(Date.now()-start)/1000,action:"healing-supply"});
    }
    await page.waitForTimeout(300);
    } catch (error) {
      const saved = await saveAt();
      const result = saved?.pendingResult;
      if (await phaseAt() !== "result" || !await page.getByLabel("作戦結果",{exact:true}).isVisible()
        || result?.battleRunId !== `v100:${stage.id}:${record.openingSave.revision}`) throw error;
      record.completedResultHandoff = {error:String(error),battleRunId:result.battleRunId};
      break;
    }
  }
  await acceptResult(record);
}
async function acceptResult(record) {
  await ready();record.result=(await saveAt()).pendingResult??(await saveAt()).lastResult;
  assert.equal(record.result?.battleRunId, `v100:${record.id}:${record.openingSave.revision}`, "Result must belong to this recorded normal battle");
  record.resultText=await page.getByLabel("作戦結果",{exact:true}).innerText();
  record.status=record.result?.won===true?"won":"lost";
  await page.screenshot({path:path.join(out,`s${record.number}-result.png`)});await persist();
  if(record.status!=="won")throw new Error(`Normal-play defeat at Stage ${record.number}; preserve the result and diagnose before a new attempt`);
  await uiClick(button("次の場面へ"));
}
try {
 await page.goto(origin.href);await button("ブラウザで遊ぶ").click();
 if (!resumeDir) {
   await page.getByLabel("呼ばれたい名前",{exact:true}).fill("西新通し確認");
   await uiClick(button("この名前で作戦を始める"));
 } else {
   await ready();
   const previous = JSON.parse(await readFile(path.join(resumeDir,"report.json")));
   const restored = await saveAt();
   assert.equal(restored.caps, previous.finalSave.caps);
   assert.deepEqual(restored.receipts, previous.finalSave.receipts);
   assert.deepEqual(restored.pendingResult, previous.finalSave.pendingResult);
   report.restoredSave = restored;
 }
 let preparedStage=0;
 for(let steps=0;steps<6000;steps++) {
  await continueRequested();
  if(report.errors.length)throw new Error("Browser diagnostics on normal route");
  const phase=await phaseAt();const save=await saveAt();
  if(phase==="map") {
    await writeFile(path.join(out,`save-after-${save.completedStageIds.length}.json`),JSON.stringify(save,null,2));
    await context.storageState({path:path.join(out,"browser-storage-checkpoint.json"),indexedDB:true});
    if(save.readStoryEventIds.includes("v100:event:epilogue")) {assert.equal(save.completedStageIds.length,30);assert.equal(save.postGameAvailable,true);report.status="passed";break;}
    const stage=V100_STAGES.find(stage=>save.availableStageIds.includes(stage.id)&&!save.completedStageIds.includes(stage.id));assert.ok(stage,"No next unfinished stage");
    if(preparedStage!==stage.number){await prepareEconomy(stage.number);preparedStage=stage.number;}
    await uiClick(button("この作戦を編成"));
  } else if(phase==="formation") await configureFormation();
  else if(phase==="battle") await battle(V100_STAGES.find(stage=>stage.id===save.flowState.stageId));
  else if(phase==="result") await acceptResult(report.stages.at(-1));
  else if(["event","post","first-clear-post","ending","credits","epilogue"].includes(phase)) {
    await ready();await page.waitForLoadState("networkidle");
    const shell=page.locator("section[data-v100-event-id]");
    const id=await shell.getAttribute("data-v100-event-id"), index=Number(await shell.getAttribute("data-v100-node-index")??0);
    const text=await shell.innerText();const event=v100StoryEventView(id,save.playerName);const node=event?.nodes[index];
    if(node?.text)assert.ok(normalizeText(text).includes(normalizeText(node.text)),`${id}:${index} text missing`);
    report.events[id]=Math.max(report.events[id]??0,index+1);
    await appendFile(path.join(out,"story-observations.jsonl"),JSON.stringify({id,index,text})+"\n");
    if(index===0)await page.screenshot({path:path.join(out,`${id.replaceAll(":","-")}.png`)});
    await uiClick(page.locator(".v100-event-actions .v100-primary"));
  } else throw new Error(`Unexpected phase ${phase}`);
 }
 if(report.status!=="passed")throw new Error("Normal route did not reach completed epilogue within its finite event count");
} catch(error) {report.status="failed";report.error=String(error);await page.screenshot({path:path.join(out,"failure.png")}).catch(()=>{});process.exitCode=1;}
finally {
  try { report.finalSave=await saveAt(); } catch(error) { report.saveCaptureError=String(error);process.exitCode=1; }
  try { await context.storageState({path:path.join(out,"browser-storage.json"),indexedDB:true}); } catch(error) { report.storageCaptureError=String(error);process.exitCode=1; }
  await persist();await browser.close();console.log(JSON.stringify({status:report.status,stages:report.stages.length,error:report.error}));
}
