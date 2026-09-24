// Regression evidence for the live cleanup phase after Stage 29's two cores fall.
// Starts from the earned Stage 28 save and uses ordinary UI inputs only.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { nativeBattleTap, normalTacticalInput } from "./v100-normal-tactical-input.mjs";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const origin = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
const source = path.resolve(process.env.V100_STAGE29_EARNED_SAVE ?? "outputs/v100-final-normal-140396b-resume-stage24-r1/save-after-28.json");
const sourceBytes = await readFile(source);
const seed = JSON.parse(sourceBytes);
assert.equal(seed.completedStageIds.length, 28);
assert.equal(seed.flowState.phase, "map");
assert.ok(seed.availableStageIds.includes("stage-segawa-research-core"));
const out = path.resolve(process.env.V100_STAGE29_BREACH_DIR ?? "outputs/v100-earned-stage29-breach");
await mkdir(out, { recursive: false });
const report = {
  scope: "Earned Stage 28 save, ordinary Stage 29 UI battle and input after both cores fall; targeted regression only",
  sourceSave: { path: source, sha256: createHash("sha256").update(sourceBytes).digest("hex"), revision: seed.revision },
  build: await productionBuildIdentity(),
  inputs: [], samples: [], errors: [], status: "running",
};
const persist = () => writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
const page = await context.newPage();
page.setDefaultTimeout(15_000);
page.on("console", message => { if (message.type() === "error") report.errors.push({ kind: "console", text: message.text() }); });
page.on("pageerror", error => report.errors.push({ kind: "page", text: String(error) }));
page.on("requestfailed", request => report.errors.push({ kind: "request", url: request.url(), text: request.failure()?.errorText }));
page.on("response", response => { if (response.status() >= 400) report.errors.push({ kind: "http", url: response.url(), status: response.status() }); });
const phase = () => page.locator(".v100-shell").getAttribute("data-v100-phase");
const save = () => page.evaluate(() => JSON.parse(localStorage.getItem("nishijin-campaign-v100")));
const snapshot = () => page.evaluate(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.());
const button = name => page.getByRole("button", { name, exact: true });
const ready = () => page.waitForFunction(() => !document.querySelector('.v100-shell[aria-busy="true"]'));
try {
  await page.addInitScript(({ expectedOrigin, value }) => {
    if (location.origin === expectedOrigin && !localStorage.getItem("nishijin-campaign-v100")) {
      localStorage.setItem("nishijin-campaign-v100", value);
    }
  }, { expectedOrigin: origin.origin, value: JSON.stringify(seed) });
  await page.goto(origin.href);
  await button("ブラウザで遊ぶ").click();
  await ready();
  assert.equal(await phase(), "map");
  assert.deepEqual((await save()).completedStageIds, seed.completedStageIds);
  await button("この作戦を編成").click();
  for (let step = 0; step < 80; step++) {
    await ready();
    const current = await phase();
    if (current === "formation") break;
    assert.equal(current, "event", "Expected Stage 29 pre-battle story");
    await page.locator(".v100-event-actions .v100-primary").click();
  }
  assert.equal(await phase(), "formation");
  await button("戦闘へ").click();
  await page.waitForFunction(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().running === true);
  const battleStart = Date.now();
  let lastSample = -10;
  const record = { number: 29, inputs: report.inputs, samples: report.samples };
  while (Date.now() - battleStart < 6 * 60_000) {
    assert.deepEqual(report.errors, []);
    const s = await snapshot();
    if (s.time - lastSample >= 5 || s.barricadeHp <= 0 || s.over) {
      report.samples.push({ time: s.time, running: s.running, over: s.over, won: s.won,
        baseHp: s.baseHp, barricadeHp: s.barricadeHp, energy: s.energy,
        enemyCount: s.fighters.filter(f => f.side === "zombie" && f.hp > 0).length,
        humanCount: s.fighters.filter(f => f.side === "human" && f.hp > 0).length,
        objective: s.objective });
      lastSample = s.time;
      await persist();
    }
    if (s.barricadeHp <= 0 && s.running && !s.over) {
      const cards = await page.locator("button.unit-card[data-kind]").evaluateAll(elements => elements.map(el => ({
        kind: el.dataset.kind, blockReason: el.dataset.blockReason, ariaDisabled: el.getAttribute("aria-disabled"),
      })));
      const support = await page.locator("button.support-btn").evaluateAll(elements => elements.map(el => ({
        className: el.className, ariaDisabled: el.getAttribute("aria-disabled"),
      })));
      report.liveCleanup = { time: s.time, barricadeHp: s.barricadeHp, over: s.over,
        enemyCount: s.fighters.filter(f => f.side === "zombie" && f.hp > 0).length, cards, support };
      assert.ok(report.liveCleanup.enemyCount > 0, "Cleanup phase must still have enemies");
      assert.ok(cards.length > 0);
      assert.ok(cards.every(card => card.blockReason !== "作戦終了"), "Live Stage 29 cards were locked as battle ended");
      const enabled = page.locator('button.unit-card[data-kind][aria-disabled="false"]').first();
      if (await enabled.count()) {
        const before = await snapshot();
        const kind = await enabled.getAttribute("data-kind");
        if (await nativeBattleTap(page, enabled)) {
          await page.waitForTimeout(150);
          const after = await snapshot();
          report.liveCleanup.acceptedDeployment = { kind, beforeEnergy: before.energy, afterEnergy: after.energy,
            beforeQueue: before.deployQueue, afterQueue: after.deployQueue, afterOver: after.over };
          assert.ok(after.energy < before.energy, "Post-breach native deployment must spend command");
          report.status = "passed";
          await page.screenshot({ path: path.join(out, "live-cleanup-deployment.png") });
          break;
        }
      }
    }
    if (s.over) throw new Error("Stage 29 ended before an accepted post-breach deployment was observed");
    await nativeBattleTap(page, button("音声を有効にする"));
    await normalTacticalInput(page, record);
    await page.waitForTimeout(300);
  }
  assert.equal(report.status, "passed", "Post-breach live deployment was not observed before timeout");
} catch (error) {
  report.status = "failed"; report.error = String(error.stack ?? error);
  await page.screenshot({ path: path.join(out, "failure.png") }).catch(() => {});
  process.exitCode = 1;
} finally {
  report.finalSave = await save().catch(() => null);
  await persist();
  await browser.close();
  console.log(JSON.stringify({ status: report.status, liveCleanup: report.liveCleanup, error: report.error }));
}
