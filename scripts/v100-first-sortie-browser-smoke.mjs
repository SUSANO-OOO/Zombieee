import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, webkit } from "playwright";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { V100_STAGE_IDS } from "../app/v100Registry.js";
import { createV100BattleResult, recordV100PendingResult } from "../app/v100Transactions.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(["127.0.0.1", "localhost"].includes(origin.hostname));
const out = path.resolve(process.env.V100_FIRST_SORTIE_EVIDENCE_DIR ?? "outputs/v100-first-sortie");
await mkdir(out, { recursive: true });
const report = { evidenceKind: "seeded UI/save-boundary fixtures; not normal combat acceptance", build: await productionBuildIdentity(), cases: [] };
const sizes = [{width:1280,height:720},{width:844,height:390},{width:844,height:340}];
const readSave = page => page.evaluate(() => JSON.parse(localStorage.getItem("nishijin-campaign-v100")));
const phase = (page, value) => page.locator(`.v100-shell[data-v100-phase="${value}"]`).waitFor({state:"visible"});
async function openFixture(page, save) {
  await page.addInitScript(({origin, save}) => {
    if(location.origin !== origin || localStorage.getItem("nishijin-campaign-v100")) return;
    localStorage.setItem("nishijin-campaign-v100", save);
    localStorage.setItem("nishijin-campaign-v1", "legacy-preservation-sentinel");
  }, {origin:origin.origin,save:serializeV100Save(save)});
  await page.goto(origin.href);
  const browserPlay=page.getByRole("button", {name:"ブラウザで遊ぶ",exact:true});
  await browserPlay.click();
}
async function renderedImagesReady(page) { await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0)); }
async function click(page, name) { await page.waitForFunction(() => !document.querySelector('.v100-shell[aria-busy="true"]')); await renderedImagesReady(page); await page.getByRole("button",{name,exact:true}).click(); await page.waitForFunction(() => !document.querySelector('.v100-shell[aria-busy="true"]')); }
try {
 for(const [engine, type] of [["chromium",chromium],["webkit",webkit]]) {
  const browser=await type.launch({headless:true});
  try {
   for(const viewport of sizes) for(const scenario of ["preparation", "reward-order"]) {
    const name=`${engine}-${viewport.width}x${viewport.height}-${scenario}`;
    const context=await browser.newContext({viewport,hasTouch:viewport.width===844,isMobile:viewport.width===844});
    const page=await context.newPage();
    const item={name,status:"failed",errors:[]}; report.cases.push(item);
    page.on("pageerror",error=>item.errors.push(String(error)));
    page.on("console",message=>{if(message.type()==="error")item.errors.push(message.text());});
    page.on("requestfailed",request=>item.errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on("response",response=>{if(response.status()>=400)item.errors.push(`${response.status()}: ${response.url()}`);});
    try {
     const initial=normalizeV100Save({...createDefaultV100Save(),playerName:"通常導線テスト", campaignStarted:true, readStoryEventIds:["v100:event:prologue","v100:event:s01:pre"]});
     if(scenario==="preparation") {
      await openFixture(page,normalizeV100Save({...initial,flowState:{phase:"formation",stageId:V100_STAGE_IDS[0],stageNumber:1}}));
      await phase(page,"formation");
      await page.screenshot({path:path.join(out,`${name}-first.png`)});
      await click(page,"出撃装備");
      await page.locator('section[data-v100-surface="support-vehicle"]').waitFor({state:"visible"});
      assert.equal(await page.locator('[data-v100-surface="formation"]').count(),0);
      await click(page,"出撃編成へ");
      await page.locator('[data-v100-surface="formation"]').waitFor({state:"visible"});
      await click(page,"隊員を育成");
      await page.locator('section[data-v100-surface="personnel"]').waitFor({state:"visible"});
      await click(page,"出撃編成へ");
      await click(page,"枠を空ける");
      await click(page,"パイセンを枠1へ配置");
      await renderedImagesReady(page); await page.reload(); await click(page,"ブラウザで遊ぶ"); await phase(page,"formation");
      assert.equal((await readSave(page)).formationSlots[0],"unit-paisen");
      await click(page,"作戦地図へ"); await phase(page,"map");
      const saved=await readSave(page);
      assert.equal(saved.caps,0); assert.deepEqual(saved.completedStageIds,[]); assert.equal(saved.pendingResult,null);
      assert.ok(saved.readStoryEventIds.includes("v100:event:s01:pre"));
      item.savedFormation=saved.formationSlots;
     } else {
      const result=createV100BattleResult({stageId:V100_STAGE_IDS[0],battleRunId:name,won:true,vehicleHp:408,vehicleMaxHp:680,objectiveComplete:true,elapsedSeconds:132,unitDeaths:3});
      const pending=recordV100PendingResult(initial,result); assert.equal(pending.applied,true);
      await openFixture(page,normalizeV100Save({...pending.save,flowState:{phase:"result",stageId:V100_STAGE_IDS[0],stageNumber:1,firstClear:true}}));
      await phase(page,"result");
      const resultCopy=await page.locator('[aria-label="作戦結果"]').innerText();
      assert.doesNotMatch(resultCopy,/獲得CAPS|初回解放|ナオ/);
      assert.equal((await readSave(page)).caps,0);
      await click(page,"次の場面へ"); await phase(page,"post");
      const post=page.locator('.v100-shell[data-v100-phase="post"]');
      let nodes=0;
      while(await post.count()) {
       assert.equal((await readSave(page)).caps,0);
       await page.locator('.v100-event-actions .v100-primary').click();
       await page.waitForFunction(()=>document.querySelector('.v100-shell')?.getAttribute('aria-busy')==='false');
       if(++nodes>80)throw new Error("post-event did not finish");
      }
      await phase(page,"first-clear-post");
      const reward=page.getByLabel("確定した作戦報酬");
      assert.match(await reward.innerText(),/\+90/); assert.match(await reward.innerText(),/ナオの配備登録/);
      assert.equal((await readSave(page)).caps,90);
      await page.screenshot({path:path.join(out,`${name}-reward.png`)});
      item.rewardFits=await reward.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;});
      assert.equal(item.rewardFits,true);
      await renderedImagesReady(page); await page.reload(); await click(page,"ブラウザで遊ぶ"); await phase(page,"first-clear-post");
      assert.equal((await readSave(page)).caps,90);
      await page.locator('.v100-event-actions .v100-primary').click(); await phase(page,"map");
      assert.equal((await readSave(page)).caps,90);
      assert.equal(await page.locator(".v100-map-side h3").innerText(), "早良区役所・最後の一台"); item.postNodes=nodes;
     }
     assert.equal(await page.evaluate(()=>localStorage.getItem("nishijin-campaign-v1")),"legacy-preservation-sentinel");
     assert.deepEqual(item.errors,[]);item.status="passed";
    } catch(error) {item.error=String(error);await page.screenshot({path:path.join(out,`${name}-failure.png`)}).catch(()=>{});throw error;}
    finally {await context.close();await writeFile(path.join(out,"report.json"),JSON.stringify(report,null,2));}
   }
  } finally {await browser.close();}
 }
 report.status="passed";
} catch(error) {report.status="failed";report.error=String(error);process.exitCode=1;}
finally {await writeFile(path.join(out,"report.json"),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,cases:report.cases.length,error:report.error}));}
