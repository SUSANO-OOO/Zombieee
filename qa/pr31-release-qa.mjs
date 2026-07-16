import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.QA_BASE_URL ?? "http://127.0.0.1:3001";
const OUT_DIR = process.env.QA_OUT_DIR ?? "qa-output";
await fs.mkdir(OUT_DIR, { recursive: true });

const summary = {
  sourceHead: "cc4eb3a62925f1a3167062344819278fe978cd40",
  startedAt: new Date().toISOString(),
  scenarios: {},
};

function diagnosticsFor(page, label) {
  const diagnostics = { label, consoleWarnings: [], consoleErrors: [], pageErrors: [], requestFailures: [] };
  page.on("console", (message) => {
    if (message.type() === "warning") diagnostics.consoleWarnings.push(message.text());
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const failure = request.failure();
    diagnostics.requestFailures.push(`${request.method()} ${request.url()} :: ${failure?.errorText ?? "unknown"}`);
  });
  return diagnostics;
}

async function isVisible(locator) {
  return (await locator.count()) > 0 && await locator.first().isVisible().catch(() => false);
}

async function enableAudio(page) {
  const button = page.locator(".enable-audio-button");
  if (!(await isVisible(button))) return "hidden";
  await button.click({ force: true });
  await page.waitForTimeout(350);
  await page.waitForFunction(() => {
    const node = document.querySelector(".enable-audio-button");
    return !node || !["idle", "pending"].includes(node.getAttribute("data-state") ?? "");
  }, { timeout: 15_000 }).catch(() => undefined);
  if (!(await button.count())) return "hidden-after-click";
  return await button.getAttribute("data-state") ?? "unknown";
}

async function skipStoryIfPresent(page) {
  const event = page.locator(".event-screen");
  if (!(await isVisible(event))) return false;
  const skip = page.getByRole("button", { name: "スキップ", exact: true });
  if (await isVisible(skip)) {
    await skip.click({ force: true });
    const confirm = page.getByRole("button", { name: "この会話だけスキップ", exact: true });
    await confirm.waitFor({ state: "visible", timeout: 5_000 });
    await confirm.click({ force: true });
  } else {
    const advance = page.getByRole("button", { name: "セリフを送る", exact: true });
    if (await isVisible(advance)) await advance.click({ force: true });
    else {
      const proceed = page.getByRole("button", { name: "地図へ進む", exact: true });
      if (await isVisible(proceed)) await proceed.click({ force: true });
    }
  }
  await page.waitForTimeout(120);
  return true;
}

async function waitForFormationReady(page) {
  await page.locator(".formation-screen").waitFor({ state: "visible", timeout: 120_000 });
  const start = page.locator(".formation-footer .campaign-primary");
  await page.waitForFunction(() => {
    const button = document.querySelector(".formation-footer .campaign-primary");
    return button && !button.disabled && button.textContent?.includes("この編成で出撃");
  }, { timeout: 120_000 });
  return start;
}

async function openStage2Battle(page) {
  await page.goto(`${BASE_URL}/?qa=flow&screen=formation&stage=2`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const start = await waitForFormationReady(page);
  const audioState = await enableAudio(page);
  await start.click({ force: true });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await skipStoryIfPresent(page);
    if (await isVisible(page.locator("canvas.battlefield.active"))) return { audioState };
    await page.waitForTimeout(120);
  }
  throw new Error("Stage 2 battle did not start within 60 seconds");
}

async function bodyOverflow(page) {
  return await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
    bodyWidth: document.body.scrollWidth,
    bodyHeight: document.body.scrollHeight,
  }));
}

async function visualStage2(browser, viewport, label) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page, label);
  const { audioState } = await openStage2Battle(page);
  for (let index = 0; index < 3; index += 1) {
    const enabled = page.locator(".unit-card:not([disabled])").first();
    if (!(await isVisible(enabled))) break;
    await enabled.click({ force: true });
    await page.waitForTimeout(180);
  }
  await page.waitForTimeout(6_500);
  await skipStoryIfPresent(page);
  const canvas = page.locator("canvas.battlefield.active");
  const canvasBox = await canvas.boundingBox();
  const overflow = await bodyOverflow(page);
  await page.screenshot({ path: path.join(OUT_DIR, `${label}.png`), fullPage: true });
  await context.close();
  return { viewport, audioState, canvasBox, overflow, diagnostics };
}

async function visualOoba(browser, viewport, label) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page, label);
  await page.goto(`${BASE_URL}/?qa=story&event=stage-nishijin-post`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator(".event-screen").waitFor({ state: "visible", timeout: 120_000 });
  const audioState = await enableAudio(page);
  const dialogue = page.locator(".dialogue-box");
  for (let index = 0; index < 20; index += 1) {
    const speaker = (await page.locator(".dialogue-name b").textContent())?.trim();
    if (speaker === "大庭豪") break;
    await dialogue.click({ force: true });
    await page.waitForTimeout(80);
  }
  const speaker = (await page.locator(".dialogue-name b").textContent())?.trim();
  if (speaker !== "大庭豪") throw new Error(`Ooba dialogue not reached; current speaker=${speaker}`);
  const portrait = page.locator(".event-portrait.active");
  const portraitBox = await portrait.boundingBox();
  const backgroundImage = await portrait.evaluate((node) => getComputedStyle(node).backgroundImage);
  if (!backgroundImage.includes("brute-portrait-v2.webp")) throw new Error(`Unexpected Ooba portrait: ${backgroundImage}`);
  const overflow = await bodyOverflow(page);
  await page.screenshot({ path: path.join(OUT_DIR, `${label}.png`), fullPage: true });
  await context.close();
  return { viewport, audioState, speaker, backgroundImage, portraitBox, overflow, diagnostics };
}

async function balancedVictory(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page, "stage2-balanced-victory");
  const { audioState } = await openStage2Battle(page);
  const tacticLabel = await page.locator(".tactic-cycle").getAttribute("aria-label");
  if (!tacticLabel?.includes("現在：均衡")) throw new Error(`Stage 2 did not start in balanced tactic: ${tacticLabel}`);
  const actions = { deployments: 0, barrages: 0, airstrikes: 0, storySkips: 0 };
  let battleShotTaken = false;
  const deadline = Date.now() + 270_000;
  while (Date.now() < deadline) {
    if (await skipStoryIfPresent(page)) {
      actions.storySkips += 1;
      continue;
    }
    if (await isVisible(page.locator(".result-screen"))) break;
    if (await isVisible(page.locator("canvas.battlefield.active"))) {
      for (let index = 0; index < 3; index += 1) {
        const unit = page.locator(".unit-card:not([disabled])").first();
        if (!(await isVisible(unit))) break;
        await unit.click({ force: true });
        actions.deployments += 1;
        await page.waitForTimeout(90);
      }
      const barrage = page.locator(".support-btn.barrage:not([disabled])");
      if (await isVisible(barrage)) {
        await barrage.click({ force: true });
        actions.barrages += 1;
      }
      const airstrike = page.locator(".support-btn.airstrike:not([disabled])");
      if (await isVisible(airstrike)) {
        await airstrike.click({ force: true });
        const center = page.getByRole("button", { name: /中央レーン中央へ緊急航空支援を指定/ });
        if (await isVisible(center)) {
          await center.click({ force: true });
          actions.airstrikes += 1;
        }
      }
      if (!battleShotTaken) {
        await page.waitForTimeout(5_500);
        await page.screenshot({ path: path.join(OUT_DIR, "stage2-balanced-battle-pc.png"), fullPage: true });
        battleShotTaken = true;
      }
    }
    await page.waitForTimeout(280);
  }
  while (await skipStoryIfPresent(page)) actions.storySkips += 1;
  const result = page.locator(".result-screen");
  await result.waitFor({ state: "visible", timeout: 15_000 });
  const resultText = await result.innerText();
  if (!resultText.includes("作戦成功")) throw new Error(`Balanced Stage 2 did not win: ${resultText}`);
  await page.screenshot({ path: path.join(OUT_DIR, "stage2-balanced-victory-result.png"), fullPage: true });
  const overflow = await bodyOverflow(page);
  await context.close();
  return { audioState, tacticLabel, actions, resultText, overflow, diagnostics };
}

async function noActionDefeat(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page, "stage2-no-action-defeat");
  const { audioState } = await openStage2Battle(page);
  const actions = { deployments: 0, supports: 0, storySkips: 0 };
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (await skipStoryIfPresent(page)) {
      actions.storySkips += 1;
      continue;
    }
    if (await isVisible(page.locator(".result-screen"))) break;
    await page.waitForTimeout(300);
  }
  while (await skipStoryIfPresent(page)) actions.storySkips += 1;
  const result = page.locator(".result-screen");
  await result.waitFor({ state: "visible", timeout: 15_000 });
  const resultText = await result.innerText();
  if (!resultText.includes("戦線崩壊")) throw new Error(`No-action Stage 2 did not lose: ${resultText}`);
  await page.screenshot({ path: path.join(OUT_DIR, "stage2-no-action-defeat-result.png"), fullPage: true });
  const overflow = await bodyOverflow(page);
  await context.close();
  return { audioState, actions, resultText, overflow, diagnostics };
}

const browser = await chromium.launch({ headless: true });
try {
  summary.scenarios.stage2VisualPc = await visualStage2(browser, { width: 1280, height: 720 }, "stage2-visual-pc");
  summary.scenarios.stage2VisualMobile = await visualStage2(browser, { width: 844, height: 390 }, "stage2-visual-844x390");
  summary.scenarios.oobaPc = await visualOoba(browser, { width: 1280, height: 720 }, "ooba-dialogue-pc");
  summary.scenarios.oobaMobile = await visualOoba(browser, { width: 844, height: 390 }, "ooba-dialogue-844x390");
  summary.scenarios.balancedVictory = await balancedVictory(browser);
  summary.scenarios.noActionDefeat = await noActionDefeat(browser);
  const allDiagnostics = Object.values(summary.scenarios).map((scenario) => scenario.diagnostics).filter(Boolean);
  const errors = allDiagnostics.flatMap((diag) => [...diag.consoleErrors, ...diag.pageErrors]);
  const warnings = allDiagnostics.flatMap((diag) => diag.consoleWarnings);
  summary.diagnostics = { errors, warnings };
  if (errors.length || warnings.length) throw new Error(`Browser diagnostics not clean: ${JSON.stringify({ errors, warnings })}`);
  summary.status = "success";
} catch (error) {
  summary.status = "failure";
  summary.error = error instanceof Error ? `${error.stack ?? error.message}` : String(error);
  throw error;
} finally {
  summary.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  await browser.close();
}
