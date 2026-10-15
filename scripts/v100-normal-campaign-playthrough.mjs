import {readVisibleBattleHealthBars,visibleAirstrikeTarget} from './v100-normal-visible-aim.mjs';
// A normal campaign route: fresh save, earned CAPS, real time and UI inputs.
// Read-only save inspection records progress; no seed, QA bridge or forced result.
import assert from "node:assert/strict";
import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { V100_STAGES, V100_UNITS, V100_VEHICLE, v100LevelCost } from "../app/v100Registry.js";
import { v100StoryEventView } from "../app/v100StoryEvents.js";
import { v100StoryPageFor } from "../app/v100StoryPages.js";
import { inspectStaffRoll } from "./v100-staff-roll-audit.mjs";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { pwaBrowserType } from "./pwa-browser-runtime.mjs";
import { installRequestFailureAudit } from "./browser-request-failure-audit.mjs";
import {normalCampaignCanSpendVehicleGauge, normalCampaignDeploymentCount, normalCampaignDeployOrder } from "./v100-normal-play-contract.mjs";
import { dismissInstallOffer } from "./pwa-gate-qa.mjs";
import { enterV100FromTitle } from "./v100-title-qa-entry.mjs";
import { deferNormalRecruitOffer } from "./v100-normal-recruit-offer.mjs";

if (process.platform === 'win32') throw new Error('Normal-play QA is hosted-only; local game/browser/audio playback is disabled');
const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
const engine=process.env.V100_NORMAL_PLAY_ENGINE??'chromium';
assert.ok(['chromium','webkit'].includes(engine));
if(engine==='webkit')assert.equal(process.platform,'darwin','Normal campaign WebKit acceptance requires the native macOS runtime');
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
assert.equal(origin.search, "");
const out = path.resolve(process.env.V100_NORMAL_PLAY_EVIDENCE_DIR ?? "outputs/v100-normal-campaign");
await mkdir(path.dirname(out), { recursive: true });
await mkdir(out, { recursive: false });
const report = { evidenceKind:"automated normal UI playthrough; manual feel and physical-device acceptance remain separate", engine, origin:origin.href, build:await productionBuildIdentity(), stages:[], events:{}, transactions:[], errors:[], status:"running" };
const resumeDir = process.env.V100_NORMAL_PLAY_RESUME_DIR && path.resolve(process.env.V100_NORMAL_PLAY_RESUME_DIR);
let restoredStorage;
if (resumeDir) {
  const previousBytes = await readFile(path.join(resumeDir,"report.json"));
  const storageBytes = await readFile(path.join(resumeDir,"browser-storage.json"));
  const previous = JSON.parse(previousBytes);
  assert.equal(previous.origin, origin.href, "Resume the same isolated origin");
  if (previous.build.combinedSha256 !== report.build.combinedSha256) {
    const notePath = process.env.V100_NORMAL_PLAY_EXPLORATORY_CHANGE_NOTE;
    assert.ok(notePath, "A different product build needs a separately identified exploratory continuation");
    const noteBytes = await readFile(notePath), note = JSON.parse(noteBytes);
    assert.equal(note.previousBuildSha256, previous.build.combinedSha256);
    assert.equal(note.currentBuildSha256, report.build.combinedSha256);
    assert.ok(note.reason?.length > 0 && note.affectedStageNumbers?.length > 0);
    report.exploratoryContinuation = { ...note, path: notePath, sha256: createHash("sha256").update(noteBytes).digest("hex") };
  } else {
    assert.deepEqual(previous.build, report.build);
    report.exploratoryContinuation = previous.exploratoryContinuation ?? null;
  }
  assert.deepEqual(previous.errors, [], "Do not resume unclassified browser diagnostics");
  restoredStorage = JSON.parse(storageBytes);
  report.resumeFrom = { path:resumeDir, reportSha256:createHash("sha256").update(previousBytes).digest("hex"), storageSha256:createHash("sha256").update(storageBytes).digest("hex"), previousStatus:previous.status, previousError:previous.error };
  report.stages = previous.stages; report.events = previous.events; report.transactions = previous.transactions;
  report.inheritedUnfinishedRecords = previous.stages.flatMap((stage, index) => stage.status === "running"
    ? [{ index, number: stage.number, status: "unfinished in an earlier segment; not a victory", sourceReport: report.resumeFrom.reportSha256 }] : []);
  if (report.exploratoryContinuation) report.evidenceKind = "exploratory normal UI route across identified builds; not final-candidate whole-campaign acceptance";
}
const browserType=await pwaBrowserType(engine),browser=await browserType.launch({headless:true});
report.provenance={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),platform:process.platform,node:process.version,browserVersion:browser.version(),browserExecutable:browserType.executablePath()};
const context = await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,recordVideo:{dir:path.join(out,'videos'),size:{width:844,height:390}},...(restoredStorage ? {storageState:restoredStorage} : {})});
report.videoTimeOrigin={beforePageEpochMs:Date.now()};
const page = await context.newPage();
const video=page.video();assert.ok(video,'Normal campaign must preserve its actual native video');
report.videoTimeOrigin.afterPageEpochMs=Date.now();
const requests=installRequestFailureAudit(page);report.requestAudit=requests.report;
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
page.on("response",r=>{if(r.status()>=400)report.errors.push({kind:"http",url:r.url(),status:r.status()});});
async function ready() {
  await page.waitForFunction(() => !document.querySelector('.v100-shell[aria-busy="true"]'));
  await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
}
async function uiClick(locator) { await ready(); await locator.click(); await ready(); }
const button = name => page.getByRole("button",{name,exact:true});
const preparationTab = name => page.getByRole("navigation",{name:"ステージ準備メニュー",exact:true}).getByRole("button",{name,exact:true});
async function selectPersonnel(unit) {
  const back=button("ユニット一覧へ");
  if(await back.isVisible())await uiClick(back);
  await uiClick(page.locator("button.v100-personnel-card").filter({has:page.getByRole("heading",{name:unit.displayName,exact:true})}));
}
function plannedFormation(save) {
  const preference=["unit-gantetsu","unit-paisen","unit-hachi","unit-kumaverson","unit-nao","unit-babayaga","unit-mizuchi","unit-tatara","unit-monkey"];
  return preference.filter(id=>save.ownedUnitIds.includes(id)).slice(0,7);
}
async function prepareEconomy(stageNumber) {
  await deferNormalRecruitOffer(page,{saveAt,uiClick,stageNumber,transactions:report.transactions});
  let save=await saveAt();
  await uiClick(preparationTab("ユニット"));
  for(const id of ["unit-nao","unit-mizuchi","unit-monkey","unit-tatara","unit-gantetsu"]) {
    const unit=V100_UNITS.find(unit=>unit.id===id);
    if(!save.ownedUnitIds.includes(id)&&save.registeredUnitIds.includes(id)&&save.caps>=unit.registrationCostCaps) {
      await selectPersonnel(unit);
      await uiClick(button(`配備登録 / ${unit.registrationCostCaps} CAPS`));
      save=await saveAt(); report.transactions.push({stageNumber,action:"register",id,caps:save.caps});
    }
  }
  // Reserve a modest vehicle progression and the first unlocked healing supply.
  await uiClick(preparationTab("支援"));
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
    await uiClick(preparationTab("車両"));
    await uiClick(button(`耐久を強化 / ${cost} CAPS`)); save=await saveAt();
    report.transactions.push({stageNumber,action:"vehicle",level:save.vehicle.upgradeLevel,caps:save.caps});
  }
  await uiClick(preparationTab("ユニット"));
  const targetLevel=Math.min(save.levelCap,Math.max(1,Math.ceil(stageNumber*.8)));
  for(let n=0;n<210;n++) {
    const ids=plannedFormation(save).filter(id=>save.unitLevels[id]<targetLevel).sort((a,b)=>save.unitLevels[a]-save.unitLevels[b]);
    const id=ids.find(id=>save.caps>=v100LevelCost(save.unitLevels[id]+1));
    if(!id)break;
    const unit=V100_UNITS.find(unit=>unit.id===id);
    const cost=v100LevelCost(save.unitLevels[id]+1);
    await selectPersonnel(unit);await uiClick(button(`Lv.${save.unitLevels[id]+1}へ強化 / ${cost} CAPS`));
    save=await saveAt();report.transactions.push({stageNumber,action:"level",id,level:save.unitLevels[id],caps:save.caps});
  }
  await uiClick(preparationTab("ステージ"));
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
  const start=Date.now();let lastShot=0;let cursor=0;let lastAction=0;let lastEmergency=0;
  // The outer campaign phase changes before the real asset gate releases the HUD.
  await page.locator('.v100-deployed-count').waitFor({state:'visible',timeout:15_000});
  while(await phaseAt()==="battle") {
    await continueRequested();
    try {
    const deploymentCount=normalCampaignDeploymentCount(await page.locator('.v100-deployed-count').evaluateAll(nodes=>nodes.length===1?nodes[0].getAttribute('aria-label'):null));
    record.maximumObservedActive=Math.max(record.maximumObservedActive??0,deploymentCount.active);
    if(report.errors.length||requests.report.unexpectedFailures.length)throw new Error("Browser diagnostics during normal battle");
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
      const equippedKinds=await cards.evaluateAll(elements=>elements.map(el=>el.getAttribute('data-kind')));
      const deploymentOrder=normalCampaignDeployOrder(equippedKinds);
      record.deploymentOrder??=deploymentOrder;
      const card=cards.nth(equippedKinds.indexOf(deploymentOrder[cursor%count]));
      if(await card.isEnabled()) {
        const kind=await card.getAttribute("data-kind"); await card.click();
        record.inputs.push({seconds:(Date.now()-start)/1000,action:"deploy",kind});cursor++;lastAction=Date.now();
      } else if (deploymentCount.active===0 && Date.now()-start>15_000 && Date.now()-lastEmergency>12_000) {
        // An empty defense line needs an affordable escort while the next
        // expensive role is funded. Keep the ordered role cursor unchanged.
        const scout=page.locator('button.unit-card[data-kind="scout"]');
        if(await scout.count() && await scout.isEnabled()) {
          await scout.click();lastEmergency=Date.now();lastAction=Date.now();
          record.inputs.push({seconds:(Date.now()-start)/1000,action:"emergency-deploy",kind:"scout"});
        }
      }
    }
    let airstrikeRequested=false;
    const airstrike=page.locator('button.support-btn.airstrike');
    const airVisible=Date.now()-start>12_000&&await airstrike.isVisible();
    const airReady=airVisible&&await airstrike.isEnabled();
    let visibleAirTarget=null;
    if(airVisible&&(airReady||!normalCampaignCanSpendVehicleGauge(record.inputs))) {
      const frame=await page.locator('.game-shell canvas').evaluate(readVisibleBattleHealthBars);
      const aim=frame?.canvas&&visibleAirstrikeTarget(frame.canvas,frame);
      const bossSeen=await page.locator('.boss-hud').isVisible();
      if(aim&&(aim.expectedVisibleBarsInRadius>=2||bossSeen)&&await page.evaluate(point=>document.elementFromPoint(point.x,point.y)?.tagName==='CANVAS',aim.point)) {
        visibleAirTarget=aim;
        if(airReady) {
          await airstrike.click();await page.mouse.click(aim.point.x,aim.point.y);
          airstrikeRequested=true;
          const input={seconds:(Date.now()-start)/1000,action:'airstrike',...aim};record.inputs.push(input);
          await page.waitForFunction(()=>{const button=document.querySelector('button.support-btn.airstrike');return !button||button.getAttribute('aria-disabled')==='true';},undefined,{timeout:2_000});
          input.acknowledgment=await airstrike.evaluateAll(elements=>elements.length===1?{state:elements[0].getAttribute('data-state'),disabled:elements[0].getAttribute('aria-disabled')}:null);
        }
      }
    }
    const barrage=page.locator('button.support-btn[data-category="vehicle"]');
    const bossVisible=await page.locator(".boss-hud").isVisible();
    // Preserve funding for the first aircraft only while an enemy target is visible.
    // Its actual acknowledgment or an absent target releases ordinary vehicle fire.
    if(!airstrikeRequested&&normalCampaignCanSpendVehicleGauge(record.inputs,Boolean(visibleAirTarget))&&(Date.now()-start>12_000||(stage.missionType==="boss"&&bossVisible))&&await barrage.isVisible()&&await barrage.isEnabled()) {
      await barrage.click();record.inputs.push({seconds:(Date.now()-start)/1000,action:"barrage"});
    }
    // Take one DOM snapshot of these transient targets. Retaining nth()
    // locators across inputs waited for icons that had already disappeared.
    const hits=await page.locator('button.manual-ability-ready.available[aria-disabled="false"]').evaluateAll(elements=>elements.slice(0,2).map(el=>{
      const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,top=document.elementFromPoint(x,y);
      return top&&(top===el||el.contains(top))?{x,y,kind:el.getAttribute("data-ability-kind")}:null;
    }).filter(Boolean));
    for(const hit of hits) {
      await page.mouse.click(hit.x,hit.y);record.inputs.push({seconds:(Date.now()-start)/1000,action:"ability",kind:hit.kind});
    }
    const healing=page.locator('button[data-support-id="support-healing"]');
    if(Date.now()-start>12_000&&await healing.count()&&await healing.isEnabled()) {
      const canvas=await page.locator(".game-shell canvas").boundingBox();
      // These anchors belong to visible ability markers over the actual
      // squad. The old fixed 35% drop frequently healed empty ground.
      const anchors=await page.locator('button.manual-ability-ready').evaluateAll(elements=>elements.map(el=>({x:Number(el.getAttribute("data-owner-anchor-x")),y:Number(el.getAttribute("data-owner-anchor-y"))})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
      if(canvas&&anchors.length) {
        anchors.sort((a,b)=>a.x-b.x);const anchor=anchors[Math.floor(anchors.length/2)];
        const point={x:canvas.x+anchor.x,y:canvas.y+anchor.y+20};
        const clear=await page.evaluate(point=>document.elementFromPoint(point.x,point.y)?.tagName==="CANVAS",point);
        if(clear) {
          await healing.click();await page.mouse.click(point.x,point.y);
          record.inputs.push({seconds:(Date.now()-start)/1000,action:"healing-supply",point,visibleSquadAnchors:anchors});
        }
      }
    }
    await page.waitForTimeout(300);
    } catch (error) {
      const saved = await saveAt();
      const result = saved?.pendingResult;
      if (await phaseAt() !== "result" || !await page.getByLabel("戦闘結果",{exact:true}).isVisible()
        || result?.battleRunId !== `v100:${stage.id}:${record.openingSave.revision}`) throw error;
      record.completedResultHandoff = {error:String(error),battleRunId:result.battleRunId};
      break;
    }
  }
  await acceptResult(record);
}
async function acceptResult(record) {
  record.endedAt=new Date().toISOString();
  await ready();record.result=(await saveAt()).pendingResult??(await saveAt()).lastResult;
  assert.equal(record.result?.battleRunId, `v100:${record.id}:${record.openingSave.revision}`, "Result must belong to this recorded normal battle");
  record.resultText=await page.getByLabel("戦闘結果",{exact:true}).innerText();
  record.status=record.result?.won===true?"won":"lost";
  await page.screenshot({path:path.join(out,`s${record.number}-result.png`)});await persist();
  if(record.status!=="won")throw new Error(`Normal-play defeat at Stage ${record.number}; preserve the result and diagnose before a new attempt`);
  await uiClick(button("次の場面へ"));
}
try {
 await page.goto(origin.href);
 await dismissInstallOffer(page,{timeout:15000,readySelector:".v100-start-screen",waitForFictionDismissal:true});
 await enterV100FromTitle(page,{timeout:15000});
 if (!resumeDir) {
   await page.getByLabel("呼ばれたい名前",{exact:true}).fill("西新通し確認");
   await uiClick(button("この名前でステージを始める"));
 } else {
   await ready();
   const previous = JSON.parse(await readFile(path.join(resumeDir,"report.json")));
   const restored = await saveAt();
   assert.equal(restored.caps, previous.finalSave.caps);
   assert.deepEqual(restored.receipts, previous.finalSave.receipts);
   assert.deepEqual(restored.pendingResult, previous.finalSave.pendingResult);
   for (const key of ["ownedUnitIds", "registeredUnitIds", "unitLevels", "formationSlots", "equipment", "vehicle", "completedStageIds", "availableStageIds"]) {
     assert.deepEqual(restored[key], previous.finalSave[key], `Resume preserves ${key}`);
   }
   report.restoredSave = restored;
   if (report.stages.at(-1)?.status === "lost") {
     const reasonPath=process.env.V100_NORMAL_PLAY_RETRY_REASON;
     assert.ok(reasonPath,"A recorded defeat requires a reasoned retry note, not an automatic loop");
     const bytes=await readFile(reasonPath),reason=JSON.parse(bytes);
     assert.equal(reason.battleRunId,restored.lastResult?.battleRunId);
     assert.ok(reason.finding?.length && reason.operatorChanges?.length);
     assert.equal(await phaseAt(),"result");
     await uiClick(button("ステージ選択へ"));
     const after=await saveAt();
     for(const key of ["caps","receipts","completedStageIds","unitLevels","ownedUnitIds"])assert.deepEqual(after[key],restored[key],`Defeat return preserves ${key}`);
     report.retry={...reason,path:reasonPath,sha256:createHash("sha256").update(bytes).digest("hex"),defeatReturnPreserved:true};
   }
   if (report.stages.at(-1)?.status === "running" && await phaseAt() === "formation") {
     report.stages.at(-1).status = "interrupted-driver";
     report.stages.at(-1).interruption = { reason: previous.error, recovery: "native reload returned the unfinished battle to formation; completed stages and receipts unchanged" };
   }
 }
 let preparedStage=0;
 for(let steps=0;steps<6000;steps++) {
  await continueRequested();
  if(report.errors.length||requests.report.unexpectedFailures.length)throw new Error("Browser diagnostics on normal route");
  const phase=await phaseAt();const save=await saveAt();
  if(phase==="map") {
    await writeFile(path.join(out,`save-after-${save.completedStageIds.length}.json`),JSON.stringify(save,null,2));
    await context.storageState({path:path.join(out,"browser-storage-checkpoint.json"),indexedDB:true});
    if(save.readStoryEventIds.includes("v100:event:credits")) {assert.equal(save.completedStageIds.length,30);assert.equal(save.postGameAvailable,true);report.status=report.exploratoryContinuation?"completed-exploratory-route":"passed";break;}
    const stage=V100_STAGES.find(stage=>save.availableStageIds.includes(stage.id)&&!save.completedStageIds.includes(stage.id));assert.ok(stage,"No next unfinished stage");
    if(preparedStage!==stage.number){await prepareEconomy(stage.number);preparedStage=stage.number;}
    await uiClick(button("編成して出撃"));
  } else if(phase==="formation") await configureFormation();
  else if(phase==="battle") await battle(V100_STAGES.find(stage=>stage.id===save.flowState.stageId));
  else if(phase==="result") await acceptResult(report.stages.at(-1));
  else if(phase==="credits") {
    report.staffRoll=await inspectStaffRoll(page,{playerName:save.playerName});
    await page.screenshot({path:path.join(out,"staff-roll-start.png")});
    await page.locator('[data-v100-surface="map"]').waitFor({state:"visible",timeout:360000});
    assert.ok((await saveAt()).readStoryEventIds.includes("v100:event:credits"));
    report.events["v100:event:credits"]=11;
  }
  else if(["event","post","first-clear-post","ending","epilogue"].includes(phase)) {
    await ready();await page.waitForLoadState("networkidle");
    const shell=page.locator("section[data-v100-event-id]");
    const id=await shell.getAttribute("data-v100-event-id"), index=Number(await shell.getAttribute("data-v100-node-index")??0);
    const text=await shell.innerText();const event=v100StoryEventView(id,save.playerName);const node=event?.nodes[index];
    const storyPage=v100StoryPageFor(id,event?.nodes??[],save.eventCursor?.nodeIndex??index);
    for(const original of [...storyPage.leadingActions,node].filter(Boolean))if(original.text)assert.ok(normalizeText(text).includes(normalizeText(original.text)),`${id}:${original.sourceLine} text missing`);
    report.events[id]=Math.max(report.events[id]??0,index+1);
    await appendFile(path.join(out,"story-observations.jsonl"),JSON.stringify({id,index,text})+"\n");
    if(index===0)await page.screenshot({path:path.join(out,`${id.replaceAll(":","-")}.png`)});
    await uiClick(page.locator(".v100-event-actions .v100-primary"));
  } else throw new Error(`Unexpected phase ${phase}`);
 }
 if(!["passed", "completed-exploratory-route"].includes(report.status))throw new Error("Normal route did not reach the post-credits map within its finite event count");
} catch(error) {report.status="failed";report.error=String(error);await page.screenshot({path:path.join(out,"failure.png")}).catch(()=>{});process.exitCode=1;}
finally {
  try { report.finalSave=await saveAt(); } catch(error) { report.saveCaptureError=String(error);process.exitCode=1; }
  try { await context.storageState({path:path.join(out,"browser-storage.json"),indexedDB:true}); } catch(error) { report.storageCaptureError=String(error);process.exitCode=1; }
  await persist();
  try { await requests.closeContext(context);report.video=await video.path();report.videoBytes=(await stat(report.video)).size;assert.ok(report.videoBytes>0); }
  catch(error) { report.videoCaptureError=String(error);report.status='failed';process.exitCode=1; }
  if(report.errors.length||requests.report.unexpectedFailures.length){report.status='failed';report.error??='Browser diagnostics on normal route';process.exitCode=1;}
  await persist();await browser.close();console.log(JSON.stringify({engine,status:report.status,stages:report.stages.length,error:report.error}));
}
