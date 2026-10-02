import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pwaBrowserType } from "./pwa-browser-runtime.mjs";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { normalTacticalInput } from "./v100-normal-tactical-input.mjs";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save, V100_PRIMARY_STORAGE_KEY } from "../app/v100Save.js";
import { exportV100BrowserSave } from "../app/v100CampaignStorage.js";
import { createV100BattleResult, recordV100PendingResult, finalizeV100PendingResult, purchaseV100Unit } from "../app/v100Transactions.js";
import { V100_STAGE_IDS } from "../app/v100Registry.js";

const git = (...args) => execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
const head = git("rev-parse", "HEAD");
assert.equal(git("diff", "--name-only"), "");
assert.equal(git("diff", "--cached", "--name-only"), "");
const base = new URL(process.env.V100_CAMPAIGN_QA_BASE_URL);
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname), "Owned local contexts only");
const out = path.resolve(process.env.V100_QUALITY_LOOP_OUT ?? "outputs/v100-quality-loop");
await mkdir(out, { recursive: false });
let early = createDefaultV100Save({ playerName: "西新確認" });
for (const index of [0, 1]) {
  const result = createV100BattleResult({ stageId: V100_STAGE_IDS[index], battleRunId: "quality-budget-" + index, won: true, objectiveComplete: true, vehicleHp: 408, vehicleMaxHp: 680 });
  const pending = recordV100PendingResult(early, result);
  assert.equal(pending.applied, true);
  const settled = finalizeV100PendingResult(pending.save);
  assert.equal(settled.applied, true);
  early = settled.save;
  if (index === 0) { const purchase = purchaseV100Unit(early, "unit-nao"); assert.equal(purchase.applied, true); early = purchase.save; }
}
early = normalizeV100Save({ ...early, campaignStarted: true, flowState: { phase: "map", eventId: null, stageId: V100_STAGE_IDS[2], stageNumber: 3, destination: "map", nodeIndex: 0, firstClear: false, finalized: true } });
const budgetBackup = exportV100BrowserSave(early);
await writeFile(path.join(out, "two-stage-budget-fixture.json"), budgetBackup);
const report = { status: "running", head, tree: git("rev-parse", "HEAD^{tree}"), build: await productionBuildIdentity(), physicalDevice: false,
  scope: "Phone rendering and native inputs. Two early victories are developer-synthetic, one-star production receipts; Nao purchased with those CAPS. Subsequent upgrade/formation/battle inputs are native. Visual late-stage/event fixtures do not prove unlocks or difficulty. No AI campaign-clear gate, physical iPhone, external-game play or speaker-listening claim.",
  budget: { caps: early.caps, levels: early.unitLevels, owned: early.ownedUnitIds, receipts: early.receipts, sha256: createHash("sha256").update(budgetBackup).digest("hex") }, cases: [] };
const engines = (process.env.V100_QUALITY_LOOP_ENGINES ?? "chromium,webkit").split(",");
const sizes = (process.env.V100_QUALITY_LOOP_SIZES ?? "844x340,844x390").split(",").map(value => { const [width, height] = value.split("x").map(Number); return { width, height }; });
const ready = page => page.waitForFunction(() => document.querySelector(".v100-shell") && document.documentElement.dataset.pwaSaveMutationPending === "false");
const rawSave = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), V100_PRIMARY_STORAGE_KEY);
const acknowledge = async page => {
  const play = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true });
  await play.or(page.locator(".v100-shell")).first().waitFor();
  if (await play.isVisible()) await play.tap();
  await ready(page);
};
async function within(locator, minimum = 0, requireHit = true) {
  const state = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect(), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight, reachable: hit === element || element.contains(hit) };
  });
  assert.ok(state.x >= 0 && state.y >= 0 && state.right <= state.viewportWidth + 1 && state.bottom <= state.viewportHeight + 1, JSON.stringify(state));
  assert.ok(state.height >= minimum && (!requireHit || state.reachable), JSON.stringify(state));
  const clipped = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
      if (['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowY) && (rect.y < bounds.y - 1 || rect.bottom > bounds.bottom + 1)) return parent.className;
      if (['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX) && (rect.x < bounds.x - 1 || rect.right > bounds.right + 1)) return parent.className;
    }
    return null;
  });
  assert.equal(clipped, null, 'Clipped by ancestor: ' + clipped);
  return state;
}
async function diagramWithin(locator) {
  const bounds = await within(locator, 0, false);
  const diagram = await locator.evaluate(svg => {
    const box = svg.viewBox.baseVal;
    return { pointerEvents: getComputedStyle(svg).pointerEvents, clippedTexts: [...svg.querySelectorAll('text')].filter(text => {
      const rect = text.getBBox(), pad = (parseFloat(getComputedStyle(text).strokeWidth) || 0) / 2;
      return rect.x - pad < box.x || rect.y - pad < box.y || rect.x + rect.width + pad > box.x + box.width || rect.y + rect.height + pad > box.y + box.height;
    }).map(text => text.textContent) };
  });
  assert.equal(diagram.pointerEvents, 'none', 'The mission diagram is static, not a touch control');
  assert.deepEqual(diagram.clippedTexts, []);
  return { ...bounds, ...diagram };
}
async function capture(page, row, name) {
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  const file = row.id + "-" + name + ".png";
  await page.screenshot({ path: path.join(out, file) });
  row.captures.push({ file, sha256: createHash("sha256").update(await readFile(path.join(out, file))).digest("hex") });
}
async function runCase(browser, engine, viewport, id, seed, work) {
  const row = { id: engine + "-" + viewport.width + "x" + viewport.height + "-" + id, status: "running", errors: [], navigationAborts: [], captures: [] };
  report.cases.push(row);
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, acceptDownloads: true });
  let navigating = false;
  if (seed) await context.addInitScript(raw => {
    for (const key of ["nishijin-campaign-v100", "nishijin-campaign-v100:mirror", "nishijin-campaign-v100:last-known-good"]) localStorage.setItem(key, raw);
  }, serializeV100Save(seed));
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", error => row.errors.push({ kind: "page", message: String(error) }));
  page.on("console", message => { if (message.type() === "error") row.errors.push({ kind: "console", message: message.text() }); });
  page.on("response", response => { if (response.status() >= 400) row.errors.push({ kind: "http", url: response.url(), status: response.status() }); });
  page.on("requestfailed", request => { const failure = { kind: "request", url: request.url(), message: request.failure()?.errorText }; if (navigating && /abort|cancel/i.test(failure.message ?? "")) row.navigationAborts.push(failure); else row.errors.push(failure); });
  try {
    await page.goto(new URL("v100", base).href, { waitUntil: "networkidle" });
    assert.equal(await page.locator('meta[name="github-pages-release"]').getAttribute("content"), head);
    await acknowledge(page);
    await work(page, row, async () => { navigating = true; try { await page.reload({ waitUntil: "networkidle" }); await acknowledge(page); } finally { navigating = false; } });
    assert.deepEqual(row.errors, []);
    row.status = "passed";
  } catch (error) { row.status = "failed"; row.error = String(error); await page.screenshot({ path: path.join(out, row.id + "-failure.png") }).catch(() => {}); }
  finally { navigating = true; await context.close(); await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2)); }
}
for (const engine of engines) {
  const type = await pwaBrowserType(engine);
  const browser = await type.launch({ headless: true });
  try {
    for (const viewport of sizes) {
      for (const number of [1, 2, 5, 6, 9, 16, 25, 26, 28, 29]) {
        const stageId = V100_STAGE_IDS[number - 1];
        const fixture = normalizeV100Save({ ...early, availableStageIds: V100_STAGE_IDS, formationSlots: [...early.formationSlots.slice(0, 4), "unit-nao", "unit-hachi", "unit-paisen"], flowState: { phase: "formation", eventId: null, stageId, stageNumber: number, destination: "battle", nodeIndex: 0, firstClear: false, finalized: false } });
        await runCase(browser, engine, viewport, "briefing-s" + number, fixture, async (page, row) => {
          await page.locator(".v100-mission-diagram").waitFor();
          row.mission = await page.locator(".v100-mission-diagram").getAttribute("data-v100-mission-mode");
          row.diagram = await diagramWithin(page.locator(".v100-mission-diagram"));
          await within(page.getByRole("button", { name: "戦闘へ", exact: true }), 44);
          await capture(page, row, "board");
          const summary = page.locator(".v100-briefing-details > summary");
          await within(summary, 44); await summary.tap();
          const popup = page.locator(".v100-briefing-details > div");
          await within(popup);
          row.briefing = await popup.innerText();
          await popup.evaluate(element => { element.scrollTop = element.scrollHeight; });
          await capture(page, row, "intel");
          await summary.tap();
        });
      }
      for (const [eventId, index, count] of [["v100:event:s17:post", 3, 2], ["v100:event:s23:pre", 10, 2], ["v100:event:s28:pre", 3, 0], ["v100:event:s30:pre", 18, 2]]) {
        const fixture = normalizeV100Save({ ...early, flowState: { phase: "event", eventId, stageId: null, stageNumber: null, destination: "map", nodeIndex: index, firstClear: false, finalized: true } });
        await runCase(browser, engine, viewport, eventId.replaceAll(":", "-"), fixture, async (page, row) => {
          await page.locator(".v100-story-node").waitFor();
          row.owners = await page.locator(".v100-portrait-frame").evaluateAll(elements => elements.map(element => ({ owner: element.dataset.portraitOwner, side: element.dataset.portraitSide })));
          assert.equal(row.owners.length, count);
          if (eventId.includes("s17") || eventId.includes("s23")) assert.deepEqual(row.owners.map(owner => owner.owner).sort(), ["unit-babayaga", "unit-mrs-chiha"]);
          await within(page.locator(".v100-node-copy p"));
          await within(page.getByRole("button", { name: "次へ", exact: true }), 44);
          await capture(page, row, "scene");
        });
      }
    }
    await runCase(browser, engine, { width: 844, height: 340 }, "early-budget-native", null, async (page, row, reload) => {
      await page.locator(".v100-shell").getByRole("button", { name: "データ管理", exact: true }).tap();
      await page.getByRole("dialog", { name: "データ管理", exact: true }).locator("input[type=file]").first().setInputFiles({ name: "budget.json", mimeType: "application/json", buffer: Buffer.from(budgetBackup) });
      await page.locator(".v100-map-layout").waitFor(); await ready(page);
      assert.equal((await rawSave(page)).caps, early.caps);
      const restoredNotice = page.locator('.v100-notice button');
      if (await restoredNotice.isVisible()) { await restoredNotice.tap(); await ready(page); }
      const offer = page.getByRole('button', { name: '後で決める', exact: true });
      if (await offer.isVisible()) { await offer.tap(); await ready(page); }
      await page.getByRole("button", { name: "この作戦を編成", exact: true }).tap();
      for (let n = 0; n < 60 && !await page.locator(".v100-formation-panel").isVisible(); n++) await page.locator(".v100-event-actions .v100-primary").tap();
      await page.locator(".v100-slot-track .v100-slot").nth(4).tap();
      await page.getByRole("button", { name: "ナオを枠5へ配置", exact: true }).tap();
      await page.locator(".v100-sortie-selected").tap();
      assert.equal(await page.locator(".v100-personnel-focus").getAttribute("data-unit-id"), "unit-nao");
      await page.getByRole("button", { name: "隊員一覧へ", exact: true }).tap();
      await page.locator(".v100-personnel-card").first().tap();
      const growth = page.locator(".v100-unit-growth-notes summary");
      await within(growth, 44); await growth.tap(); await within(page.locator(".v100-unit-growth-notes p"));
      await capture(page, row, "growth"); await growth.tap();
      await page.locator(".v100-personnel-focus .v100-primary").tap(); await ready(page);
      row.afterUpgrade = await rawSave(page);
      assert.equal(row.afterUpgrade.unitLevels["unit-hachi"], 2);
      assert.equal(row.afterUpgrade.caps, early.caps - 30);
      await page.getByRole("button", { name: "出撃編成へ", exact: true }).tap();
      await page.getByRole("button", { name: "戦闘へ", exact: true }).tap();
      row.native = { inputs: [], samples: [] };
      const deadline = Date.now() + 125000;
      while (Date.now() < deadline && !await page.locator(".v100-result-panel").isVisible()) {
        await normalTacticalInput(page, row.native);
        await page.waitForTimeout(250);
      }
      if (await page.locator(".v100-result-panel").isVisible()) {
        row.nativeResult = true;
        const summary = page.locator(".v100-battle-report summary");
        await within(summary, 44); await summary.tap(); await within(page.locator(".v100-battle-report > div"));
        row.resultText = await page.locator(".v100-result-panel").innerText();
        row.won = await page.locator(".v100-result-panel").getAttribute("data-v100-surface") === "result-win";
        await capture(page, row, "native-result");
        await summary.tap();
        const saved = await rawSave(page);
        await reload();
        assert.deepEqual(await rawSave(page), saved);
        if (row.won) {
          await page.getByRole("button", { name: "次の場面へ", exact: true }).tap();
          for (let index = 0; index < 80 && !await page.locator(".v100-map-layout").isVisible(); index++) await page.locator(".v100-event-actions .v100-primary").tap();
          await page.locator(".v100-map-layout").waitFor();
          row.finalResult = (await rawSave(page)).lastResult;
          assert.ok(row.finalResult.rewardBreakdown);
        } else {
          await page.getByRole("button", { name: "編成へ戻る", exact: true }).tap();
          assert.equal(await page.locator(".v100-mission-diagram").getAttribute("data-v100-mission-mode"), "advance");
        }
      } else {
        row.nativeResult = false;
        await capture(page, row, "native-pressure");
        await page.getByRole("button", { name: "一時停止", exact: true }).tap();
      }
      assert.ok(row.native.inputs.length > 0);
    });
  } finally { await browser.close(); }
}
report.status = report.cases.every(row => row.status === "passed") ? "passed" : "failed";
await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
process.stdout.write(JSON.stringify({ status: report.status, cases: report.cases.length, failed: report.cases.filter(row => row.status !== "passed").map(row => ({ id: row.id, error: row.error })) }) + "\n");
if (report.status !== "passed") process.exitCode = 1;
