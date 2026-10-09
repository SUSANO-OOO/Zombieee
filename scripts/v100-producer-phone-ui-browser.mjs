import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { createDefaultV100Save, normalizeV100Save, serializeV100Save } from "../app/v100Save.js";
import { V100_STAGE_IDS } from "../app/v100Registry.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";

const origin = process.env.V100_CAMPAIGN_QA_BASE_URL ?? "http://127.0.0.1:52407/";
const out = process.env.V100_PRODUCER_PHONE_UI_OUT ?? "outputs/completion/v100-producer-phone-ui";
await mkdir(out, { recursive: true });
const report = { scope: "phone landscape title credits, name/prologue resume, stage-1 recruitment and personnel stats; browser emulation, not physical device", build: await productionBuildIdentity(), results: [] };

for (const [engine, browserType] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await browserType.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const row = { engine, browserVersion: browser.version(), errors: [], requestFailures: [], captures: [] };
    report.results.push(row);
    page.on("pageerror", (error) => row.errors.push(String(error)));
    page.on("console", (message) => { if (message.type() === "error") row.errors.push(message.text()); });
    page.on("response", (response) => { if (response.status() >= 400) row.errors.push(`${response.status()} ${response.url()}`); });
    page.on("requestfailed", (request) => row.requestFailures.push(`${request.failure()?.errorText ?? "failed"} ${request.url()}`));
    const capture = async (name) => { await page.screenshot({ path: `${out}/${engine}-${name}.png` }); row.captures.push(name); };

    await page.goto(new URL("v100", origin).href);
    const play = page.getByRole("button", { name: "ブラウザで遊ぶ", exact: true });
    const credits = page.getByRole("button", { name: "権利・クレジット", exact: true });
    await play.or(credits).first().waitFor();
    if (await play.isVisible()) await play.tap();
    await credits.waitFor();
    await capture("title-844x390");
    await page.setViewportSize({ width: 844, height: 340 });
    await capture("title-844x340");
    for (const locator of [credits, page.locator("#v100-player-name"), page.getByRole("button", { name: "この名前で作戦を始める" })]) {
      const rect = await locator.boundingBox();
      assert.ok(rect && rect.y >= 0 && rect.y + rect.height <= 340, "title action must be visible in the first short phone viewport");
    }
    await page.setViewportSize({ width: 844, height: 390 });
    await credits.tap();
    const dialog = page.getByRole("dialog", { name: "権利・クレジット" });
    await dialog.waitFor();
    assert.ok((await dialog.innerText()).length > 200, "legal credits should contain real content");
    await capture("credits-844x390");
    await page.setViewportSize({ width: 844, height: 340 });
    await capture("credits-844x340");
    const box = await dialog.boundingBox();
    assert.ok(box && box.width <= 844 && box.height <= 340, "credits dialog must fit short phone viewport");
    await dialog.getByRole("button", { name: "閉じる" }).tap();
    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator("#v100-player-name").fill("試遊指揮官");
    await page.getByRole("button", { name: "この名前で作戦を始める" }).tap();
    const prologue = page.locator('[data-v100-event-id="v100:event:prologue"]');
    await prologue.waitFor();
    await capture("prologue-844x390");
    row.prologueNameVisible = (await prologue.innerText()).includes("試遊指揮官");
    assert.equal(row.prologueNameVisible, true, "the entered name must be visible in the opening prologue scene");
    await page.reload();
    await play.or(prologue).first().waitFor();
    if (await play.isVisible()) await play.tap();
    await prologue.waitFor();
    assert.equal(await page.locator("#v100-player-name").count(), 0, "reload must resume prologue rather than ask for name again");
    row.prologueResumed = true;
    await context.close();

    const recruitContext = await browser.newContext({ viewport: { width: 844, height: 340 }, hasTouch: true, isMobile: true });
    const recruitPage = await recruitContext.newPage();
    recruitPage.on("pageerror", (error) => row.errors.push(String(error)));
    recruitPage.on("console", (message) => { if (message.type() === "error") row.errors.push(message.text()); });
    recruitPage.on("response", (response) => { if (response.status() >= 400) row.errors.push(`${response.status()} ${response.url()}`); });
    recruitPage.on("requestfailed", (request) => row.requestFailures.push(`${request.failure()?.errorText ?? "failed"} ${request.url()}`));
    const base = createDefaultV100Save({ playerName: "試遊指揮官" });
    const recruitSave = normalizeV100Save({
      ...base, campaignStarted: true, caps: 87,
      availableStageIds: V100_STAGE_IDS.slice(0, 2), completedStageIds: V100_STAGE_IDS.slice(0, 1),
      registeredUnitIds: [...base.registeredUnitIds, "unit-nao"],
      lastResult: { stageId: V100_STAGE_IDS[0], stageNumber: 1, won: true, stars: 1, firstClear: true, rewardCaps: 87, finalizedAt: "2026-09-26T00:00:00.000Z" },
      flowState: { phase: "map", eventId: null, stageId: V100_STAGE_IDS[0], stageNumber: 1, destination: "map", nodeIndex: 0, firstClear: true, finalized: true },
    });
    await recruitPage.addInitScript((value) => {
      for (const key of ["nishijin-campaign-v100", "nishijin-campaign-v100:mirror", "nishijin-campaign-v100:last-known-good"]) localStorage.setItem(key, value);
    }, serializeV100Save(recruitSave));
    await recruitPage.goto(new URL("v100", origin).href);
    const recruitPlay = recruitPage.getByRole("button", { name: "ブラウザで遊ぶ", exact: true });
    const offer = recruitPage.getByRole("dialog", { name: /ナオ/ });
    await recruitPlay.or(offer).first().waitFor();
    if (await recruitPlay.isVisible()) await recruitPlay.tap();
    await offer.waitFor();
    assert.match(await offer.innerText(), /85 CAPS/);
    await recruitPage.waitForFunction(() => {
      const button = document.querySelector(".v100-recruit-actions .v100-primary");
      return button instanceof HTMLButtonElement && !button.disabled;
    });
    for (const name of [/85 CAPSで配備登録/, "後で決める"]) {
      const rect = await offer.getByRole("button", { name }).boundingBox();
      assert.ok(rect && rect.y >= 0 && rect.y + rect.height <= 340, "recruit choice must be visible without scrolling on a short phone viewport");
    }
    await recruitPage.screenshot({ path: `${out}/${engine}-recruit-844x340.png` });
    row.captures.push("recruit-844x340");
    await offer.getByRole("button", { name: /85 CAPSで配備登録/ }).tap();
    await offer.waitFor({ state: "hidden" });
    const persisted = await recruitPage.evaluate(() => JSON.parse(localStorage.getItem("nishijin-campaign-v100") || "null"));
    assert.ok(persisted?.ownedUnitIds?.includes("unit-nao"), "recruit purchase must be saved");
    assert.equal(persisted.caps, 2);
    row.recruitedNao = true;
    const mapDetails = recruitPage.locator(".v100-map-detail");
    if (await mapDetails.getAttribute("open") === null) await mapDetails.locator(":scope > summary").tap();
    await recruitPage.getByRole("button", { name: "隊員を編成" }).tap();
    const stats = recruitPage.getByLabel("戦闘能力と強化後の値");
    await stats.waitFor();
    for (const label of ["HP", "防御力", "近接ダメージ", "射撃ダメージ", "移動速度", "攻撃間隔"]) assert.match(await stats.innerText(), new RegExp(label));
    row.personnelLayout = await recruitPage.evaluate(() => {
      const workspace = document.querySelector(".v100-personnel-workspace");
      return { innerWidth, visualWidth: visualViewport?.width, max980: matchMedia("(max-width: 980px)").matches,
        columns: workspace ? getComputedStyle(workspace).gridTemplateColumns : null,
        rect: workspace?.getBoundingClientRect().toJSON() ?? null };
    });
    await stats.scrollIntoViewIfNeeded();
    await recruitPage.screenshot({ path: `${out}/${engine}-personnel-stats-844x340.png` });
    row.captures.push("personnel-stats-844x340");
    await recruitContext.close();
    assert.deepEqual(row.errors, []);
    assert.deepEqual(row.requestFailures, []);
  } finally {
    await browser.close();
  }
}
report.status = "passed";
await writeFile(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: report.status, engines: report.results.map((item) => item.engine), out })}\n`);
