import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  CAMPAIGN_STAGES,
  computeCampaignSaveIntegrity,
  createDefaultCampaignSave,
} from "../app/campaign.js";

const baseUrl = new URL(process.env.V0952_HOTFIX_QA_BASE_URL ?? "");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Version 0.9.5.2 hotfix QA is local-only: ${baseUrl}`);
}
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.V0952_HOTFIX_QA_ENGINES ?? "chromium,webkit")
  .split(",").map((value) => value.trim()).filter(Boolean);
const onlyScenarios = new Set((process.env.V0952_HOTFIX_QA_ONLY ?? "")
  .split(",").map((value) => value.trim()).filter(Boolean));
const shouldRun = (scenario) => onlyScenarios.size === 0 || onlyScenarios.has(scenario);
const evidenceDir = path.resolve(process.env.V0952_HOTFIX_QA_EVIDENCE_DIR ?? "outputs/v0952-hotfix");
const timeout = 45_000;
const saveKey = "nishijin-campaign-v1";
const results = [];
await mkdir(evidenceDir, { recursive: true });

const currentSave = {
  ...createDefaultCampaignSave(),
  campaignStarted: true,
  readStoryEventIds: ["prologue-opening-v070", "prologue-summary-v070"],
  unlockedStageIds: CAMPAIGN_STAGES.map((stage) => stage.id),
  revision: 52,
  updatedAt: "2026-07-31T00:00:00.000Z",
};
currentSave.integrity = computeCampaignSaveIntegrity(currentSave);
const serializedCurrentSave = JSON.stringify(currentSave);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function diagnosticsFor(page) {
  const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    if (failure !== "net::ERR_ABORTED") diagnostics.requestFailures.push(`${request.url()} :: ${failure}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

async function skipEventsUntil(page, selector) {
  for (let step = 0; step < 16; step += 1) {
    if (await page.locator(selector).isVisible()) return;
    if (await page.locator(".event-screen").isVisible()) {
      await page.getByRole("button", { name: "スキップ", exact: true }).click();
      await page.getByRole("button", { name: "この会話をスキップ", exact: true }).click();
      await page.waitForTimeout(80);
      continue;
    }
    await page.waitForTimeout(80);
  }
  await page.locator(selector).waitFor({ state: "visible", timeout });
}

async function reachLoadout(page, stageNumber = 1) {
  await page.locator('.game-shell:not([data-save-persistence="checking"])').waitFor({ state: "visible", timeout });
  await page.locator(".title-start").click();
  await skipEventsUntil(page, ".map-screen");
  if (stageNumber !== 1) {
    const stage = CAMPAIGN_STAGES.find((candidate) => candidate.stageNumber === stageNumber);
    invariant(stage, `unknown Stage ${stageNumber}`);
    const regionIds = [...new Set(CAMPAIGN_STAGES.map((candidate) => candidate.regionId))];
    const regionIndex = regionIds.indexOf(stage.regionId);
    invariant(regionIndex >= 0, `unknown region for Stage ${stageNumber}`);
    await page.locator(".map-region-tabs button").nth(regionIndex).click();
    await page.getByRole("button", { name: new RegExp(stage.displayName) }).click();
  }
  await page.getByRole("button", { name: "この作戦を編成", exact: true }).click();
  await page.locator(".formation-screen").waitFor({ state: "visible", timeout });
}

async function enterBattle(page) {
  await page.locator('.game-shell[data-assets-state="ready"],.game-shell[data-assets-state="degraded-ready"]').waitFor({ state: "visible", timeout });
  const deploy = page.locator(".formation-footer .campaign-primary");
  invariant(await deploy.isEnabled(), "deploy stayed disabled after a terminal ready state");
  await deploy.click();
  await skipEventsUntil(page, '.game-shell[data-screen="battle"]');
}

async function enableAudio(page) {
  const button = page.locator(".enable-audio-button");
  await button.waitFor({ state: "visible", timeout });
  await button.click();
  await page.locator('.game-shell[data-audio-context="ready"][data-audio-test-tone="ready"]').waitFor({ state: "visible", timeout });
}

async function runCase(browser, engine, viewport, scenario, stageNumber = 1) {
  const context = await browser.newContext({
    viewport,
    hasTouch: true,
    deviceScaleFactor: viewport.width === 1280 ? 1 : 3,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  const requestedPaths = [];
  page.on("request", (request) => requestedPaths.push(new URL(request.url()).pathname));
  await page.addInitScript(({ key, serialized }) => localStorage.setItem(key, serialized), {
    key: saveKey,
    serialized: serializedCurrentSave,
  });

  const criticalPath = "/art/v060/battle-nishijin-shopping-street-v1.webp";
  let releaseHungRoute = null;
  if (scenario === "asset-http-retry") {
    await page.route(`**${criticalPath}`, (route) => route.fulfill({ status: 503, body: "expected hotfix QA failure" }));
  } else if (scenario === "asset-hang-retry") {
    await page.route(`**${criticalPath}`, async (route) => {
      await new Promise((resolve) => { releaseHungRoute = resolve; });
      await route.continue().catch(() => undefined);
    });
  } else if (scenario === "decode-hang") {
    await page.addInitScript(() => {
      HTMLImageElement.prototype.decode = () => new Promise(() => {});
    });
  } else if (scenario === "optional-hang") {
    await page.route("**/tactical-drop-pod-v1.png", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 7000));
      await route.continue().catch(() => undefined);
    });
  } else if (scenario === "audio-bgm-fail") {
    await page.route("**/audio/v060/music/title.*", (route) => route.fulfill({ status: 503, body: "expected BGM failure" }));
  } else if (scenario === "audio-optional-fail") {
    await page.route("**/audio/v060/sfx/ui-cancel.*", (route) => route.fulfill({ status: 503, body: "expected optional failure" }));
  }

  try {
    await page.goto(String(baseUrl), { waitUntil: "domcontentloaded", timeout });
    await page.locator(".title-screen-v060").waitFor({ state: "visible", timeout });
    invariant(await page.locator(".game-shell").getAttribute("data-release-version") === "0.9.5.2", "candidate identity mismatch");

    if (scenario.startsWith("audio-") || scenario === "lifecycle") {
      await enableAudio(page);
      if (scenario === "audio-bgm-fail") {
        await page.locator('.game-shell[data-audio-bgm="failed"][data-audio-sfx="ready"][data-audio-voice="ready"]').waitFor({ state: "visible", timeout });
        const working = await page.evaluate(async () => {
          const qa = window.__ASHFALL_AUDIO_QA__;
          const sfx = qa.assets.find((asset) => asset.category === "weapons")?.id;
          const voice = qa.assets.find((asset) => asset.category === "humanVoices")?.id;
          return {
            sfx: Boolean(sfx && await qa.play(sfx)),
            voice: Boolean(voice && await qa.play(voice)),
            diagnostics: qa.getDiagnostics(),
          };
        });
        invariant(working.sfx && working.voice, "BGM failure suppressed a working SFX or voice category");
        await page.locator(".enable-audio-button").click();
        await page.waitForTimeout(200);
        const afterRetry = await page.evaluate(() => window.__ASHFALL_AUDIO_QA__.getDiagnostics());
        invariant(afterRetry.contextCreateCount === 1, "partial retry created a duplicate AudioContext");
        invariant(afterRetry.duplicateLoopInstanceKeys.length === 0, "partial retry created a duplicate loop");
      } else if (scenario === "audio-optional-fail") {
        await page.evaluate(() => window.__ASHFALL_AUDIO_QA__.play("ui-cancel"));
        await page.locator('.game-shell[data-audio-optional="failed"][data-audio-bgm="ready"]').waitFor({ state: "visible", timeout });
      } else {
        await page.evaluate(() => window.__ASHFALL_AUDIO_QA__.suspend());
        await page.locator(".enable-audio-button").click();
        await page.locator('.game-shell[data-audio-context="ready"]').waitFor({ state: "visible", timeout });
        const lifecycle = await page.evaluate(() => window.__ASHFALL_AUDIO_QA__.getDiagnostics());
        invariant(lifecycle.contextCreateCount === 1, "resume created a second AudioContext");
        invariant(lifecycle.duplicateLoopInstanceKeys.length === 0, "resume duplicated an audio loop");
      }
    } else {
      await reachLoadout(page, stageNumber);
      if (scenario === "asset-http-retry" || scenario === "asset-hang-retry") {
        await page.locator('.game-shell[data-assets-state="error"]').waitFor({ state: "visible", timeout });
        const before = await page.evaluate(() => window.__ASHFALL_ASSET_QA__.getState());
        const failedPaths = await page.evaluate(() => window.__ASHFALL_ASSET_QA__.getFailedPaths());
        invariant(failedPaths.length === 1 && failedPaths[0] === criticalPath, `unexpected failed paths ${JSON.stringify(failedPaths)}`);
        if (releaseHungRoute) releaseHungRoute();
        await page.screenshot({
          path: path.join(evidenceDir, `${engine}-${viewport.width}x${viewport.height}-${scenario}-loadout-error.png`),
          fullPage: true,
        });
        await page.unroute(`**${criticalPath}`);
        const requestsBeforeRetry = requestedPaths.length;
        await page.locator(".asset-retry").click();
        invariant(await page.locator(".formation-screen").isVisible(), "same-screen retry left loadout");
        invariant(!await page.locator(".title-screen-v060").isVisible(), "same-screen retry returned to title");
        await page.locator('.game-shell[data-assets-state="ready"]').waitFor({ state: "visible", timeout });
        const after = await page.evaluate(() => ({
          state: window.__ASHFALL_ASSET_QA__.getState(),
          restarts: window.__ASHFALL_ASSET_QA__.getRestartCount(),
        }));
        invariant(after.state.generation > before.generation && after.restarts === 1, "retry generation/restart diagnostic mismatch");
        const retryRequests = requestedPaths.slice(requestsBeforeRetry).filter((value) => value.endsWith(".png") || value.endsWith(".webp"));
        invariant(retryRequests.every((value) => value === criticalPath), `retry fetched unrelated images ${JSON.stringify(retryRequests)}`);
        await enterBattle(page);
      } else if (scenario === "optional-hang") {
        await page.locator('.game-shell[data-assets-state="degraded-ready"]').waitFor({ state: "visible", timeout });
        await page.screenshot({
          path: path.join(evidenceDir, `${engine}-${viewport.width}x${viewport.height}-${scenario}-loadout-degraded.png`),
          fullPage: true,
        });
        await enterBattle(page);
      } else {
        await enterBattle(page);
      }
    }

    const shell = page.locator(".game-shell");
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    invariant(dimensions.width === dimensions.scrollWidth, `horizontal overflow ${JSON.stringify(dimensions)}`);
    const expectedFailure = scenario === "asset-http-retry" || scenario === "audio-bgm-fail" || scenario === "audio-optional-fail";
    const unexpectedConsoleErrors = expectedFailure
      ? diagnostics.consoleErrors.filter((message) => !message.includes("Failed to load resource"))
      : diagnostics.consoleErrors;
    invariant(unexpectedConsoleErrors.length === 0 && diagnostics.pageErrors.length === 0, `browser errors ${JSON.stringify(diagnostics)}`);
    invariant(expectedFailure || (diagnostics.requestFailures.length === 0 && diagnostics.httpErrors.length === 0), `network errors ${JSON.stringify(diagnostics)}`);
    const name = `${engine}-${viewport.width}x${viewport.height}-${scenario}-stage${stageNumber}`;
    await page.screenshot({ path: path.join(evidenceDir, `${name}.png`), fullPage: true });
    results.push({
      name,
      screen: await shell.getAttribute("data-screen"),
      assetState: await shell.getAttribute("data-assets-state"),
      diagnostics,
      pass: true,
    });
  } finally {
    if (releaseHungRoute) releaseHungRoute();
    await context.close();
  }
}

for (const engine of engines) {
  const browserType = browserTypes[engine];
  invariant(browserType, `unsupported browser engine ${engine}`);
  const browser = await browserType.launch({ headless: true });
  try {
    if (shouldRun("normal")) {
      for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }, { width: 844, height: 340 }]) {
        await runCase(browser, engine, viewport, "normal", 1);
      }
    }
    if (shouldRun("asset-http-retry")) await runCase(browser, engine, { width: 844, height: 390 }, "asset-http-retry", 1);
    if (engine === "chromium") {
      for (const [scenario, stage] of [
        ["asset-hang-retry", 1],
        ["decode-hang", 1],
        ["optional-hang", 1],
        ["audio-bgm-fail", 1],
        ["audio-optional-fail", 1],
        ["lifecycle", 1],
        ["normal", 6],
        ["normal", 13],
      ]) {
        if (shouldRun(scenario)) await runCase(browser, engine, { width: 844, height: 390 }, scenario, stage);
      }
    }
  } finally {
    await browser.close();
  }
}

const summary = { version: "0.9.5.2", total: results.length, passed: results.length, results };
await writeFile(path.join(evidenceDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify(summary, null, 2));
