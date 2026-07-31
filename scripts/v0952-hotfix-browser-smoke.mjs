import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  CAMPAIGN_SAVE_SCHEMA_VERSION,
  CAMPAIGN_STAGES,
  CAMPAIGN_UNIT_IDS,
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
const mayoSave = structuredClone(currentSave);
mayoSave.ownership = [...new Set([...mayoSave.ownership, CAMPAIGN_UNIT_IDS.MAYO_CHAN])];
mayoSave.discovery = [...new Set([...mayoSave.discovery, CAMPAIGN_UNIT_IDS.MAYO_CHAN])];
mayoSave.unlockedUnitIds = [...new Set([...mayoSave.unlockedUnitIds, CAMPAIGN_UNIT_IDS.MAYO_CHAN])];
mayoSave.formationPresets = mayoSave.formationPresets.map((preset, index) => index === 0
  ? { ...preset, unitIds: [...preset.unitIds.slice(0, 6), CAMPAIGN_UNIT_IDS.MAYO_CHAN] }
  : preset);
mayoSave.integrity = computeCampaignSaveIntegrity(mayoSave);
const serializedMayoSave = JSON.stringify(mayoSave);
const legacyV13Save = {
  ...currentSave,
  schemaVersion: 13,
  settings: { ...currentSave.settings },
  survival: { ...currentSave.survival },
};
delete legacyV13Save.employmentNoticeReceipts;
delete legacyV13Save.seenEmploymentNoticeIds;
delete legacyV13Save.settings.graphicsQuality;
delete legacyV13Save.survival.highestReachedWave;
legacyV13Save.integrity = computeCampaignSaveIntegrity(legacyV13Save);
const serializedLegacyV13Save = JSON.stringify(legacyV13Save);

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

async function reachMap(page) {
  await page.locator('.game-shell:not([data-save-persistence="checking"])').waitFor({ state: "visible", timeout });
  await page.locator(".title-start").click();
  await skipEventsUntil(page, ".map-screen");
}

async function reachLoadout(page, stageNumber = 1) {
  await reachMap(page);
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
  const ready = page.locator('.game-shell[data-audio-context="ready"][data-audio-test-tone="ready"]');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await button.click();
    try {
      await ready.waitFor({ state: "visible", timeout: 5_000 });
      return;
    } catch {
      // WebKit can require a second explicit gesture after an interrupted
      // context transition. The retry must remain on the same AudioContext.
    }
  }
  const state = await page.evaluate(() => ({
    availability: window.__ASHFALL_AUDIO_QA__?.getAvailability?.(),
    diagnostics: window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.(),
  }));
  throw new Error(`audio enable did not reach a terminal ready state: ${JSON.stringify(state)}`);
}

async function installWebkitAudioContextSubstitute(page) {
  await page.addInitScript(() => {
    if (window.AudioContext || window.webkitAudioContext) {
      window.__V0952_AUDIO_CONTEXT_MODE__ = "native";
      return;
    }
    class Param {
      constructor(value = 0) { this.value = value; }
      setValueAtTime(value) { this.value = value; }
      linearRampToValueAtTime(value) { this.value = value; }
      cancelScheduledValues() {}
    }
    class Node {
      connect(target) { return target; }
      disconnect() {}
    }
    class Gain extends Node {
      constructor() { super(); this.gain = new Param(1); }
    }
    class Panner extends Node {
      constructor() { super(); this.pan = new Param(0); }
    }
    class Compressor extends Node {
      constructor() {
        super();
        this.threshold = new Param();
        this.knee = new Param();
        this.ratio = new Param();
        this.attack = new Param();
        this.release = new Param();
      }
    }
    class Source extends Node {
      constructor() {
        super();
        this.buffer = null;
        this.loop = false;
        this.playbackRate = { value: 1 };
        this.onended = null;
      }
      start() {}
      stop() { this.onended?.(); }
    }
    class Oscillator extends Node {
      constructor() {
        super();
        this.frequency = new Param(440);
        this.type = "sine";
        this.onended = null;
      }
      start() {}
      stop() { this.onended?.(); }
    }
    class SubstituteAudioContext {
      constructor() {
        this.state = "suspended";
        this.currentTime = 1;
        this.destination = new Node();
        this.listeners = new Set();
      }
      createGain() { return new Gain(); }
      createStereoPanner() { return new Panner(); }
      createDynamicsCompressor() { return new Compressor(); }
      createBufferSource() { return new Source(); }
      createOscillator() { return new Oscillator(); }
      decodeAudioData() {
        return Promise.resolve({ duration: 1, numberOfChannels: 2, sampleRate: 44_100 });
      }
      addEventListener(name, listener) { if (name === "statechange") this.listeners.add(listener); }
      removeEventListener(name, listener) { if (name === "statechange") this.listeners.delete(listener); }
      emitState() { for (const listener of this.listeners) listener({ type: "statechange" }); }
      async resume() { this.state = "running"; this.emitState(); }
      async suspend() { this.state = "suspended"; this.emitState(); }
      async close() { this.state = "closed"; this.emitState(); }
    }
    window.AudioContext = SubstituteAudioContext;
    window.__V0952_AUDIO_CONTEXT_MODE__ = "simulated-webkit-capability";
  });
}

async function runCase(browser, engine, viewport, scenario, stageNumber = 1, saveMode = "current") {
  const context = await browser.newContext({
    viewport,
    hasTouch: true,
    deviceScaleFactor: viewport.width === 1280 ? 1 : 3,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const diagnostics = diagnosticsFor(page);
  if (engine === "webkit" && (scenario.startsWith("audio-") || scenario === "lifecycle")) {
    await installWebkitAudioContextSubstitute(page);
  }
  if (saveMode !== "fresh") {
    await page.addInitScript(({ key, serialized }) => localStorage.setItem(key, serialized), {
      key: saveKey,
      serialized: saveMode === "legacy-v13"
        ? serializedLegacyV13Save
        : scenario === "mayo-critical"
          ? serializedMayoSave
          : serializedCurrentSave,
    });
  }

  const criticalPath = "/art/v060/battle-nishijin-shopping-street-v1.webp";
  let criticalRequestCount = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === criticalPath) criticalRequestCount += 1;
  });
  let releaseHungRoute = null;
  if (scenario === "asset-http-retry" || scenario === "rapid-retry") {
    await page.route(`**${criticalPath}`, (route) => route.fulfill({ status: 503, body: "expected hotfix QA failure" }));
  } else if (scenario === "asset-hang-retry") {
    await page.route(`**${criticalPath}`, async (route) => {
      await new Promise((resolve) => { releaseHungRoute = resolve; });
      await route.continue().catch(() => undefined);
    });
  } else if (scenario === "decode-hang") {
    await page.addInitScript(() => {
      const originalDecode = HTMLImageElement.prototype.decode;
      window.__V0952_RESTORE_IMAGE_DECODE__ = () => {
        HTMLImageElement.prototype.decode = originalDecode;
      };
      HTMLImageElement.prototype.decode = () => new Promise(() => {});
    });
  } else if (scenario === "optional-hang") {
    await page.route("**/tactical-drop-pod-v1.png", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 7000));
      await route.continue().catch(() => undefined);
    });
  } else if (scenario === "audio-bgm-fail" || scenario === "audio-mixed-fail") {
    await page.route("**/audio/v060/music/title.*", (route) => route.fulfill({ status: 503, body: "expected BGM failure" }));
    if (scenario === "audio-mixed-fail") {
      await page.route("**/audio/v060/sfx/ui-cancel.*", (route) => route.fulfill({ status: 503, body: "expected optional failure" }));
    }
  } else if (scenario === "audio-optional-fail") {
    await page.route("**/audio/v060/sfx/ui-cancel.*", (route) => route.fulfill({ status: 503, body: "expected optional failure" }));
  }

  try {
    await page.goto(String(baseUrl), { waitUntil: "domcontentloaded", timeout });
    await page.locator(".title-screen-v060").waitFor({ state: "visible", timeout });
    invariant(await page.locator(".game-shell").getAttribute("data-release-version") === "0.9.5.2", "candidate identity mismatch");
    if (saveMode === "fresh" || saveMode === "legacy-v13") {
      await page.locator('.game-shell:not([data-save-persistence="checking"])').waitFor({ state: "visible", timeout });
      const expectedStarted = saveMode !== "fresh";
      await page.waitForFunction(({ key, schemaVersion, campaignStarted }) => {
        const serialized = localStorage.getItem(key);
        if (!serialized) return false;
        const save = JSON.parse(serialized);
        return save.schemaVersion === schemaVersion && save.campaignStarted === campaignStarted;
      }, {
        key: saveKey,
        schemaVersion: CAMPAIGN_SAVE_SCHEMA_VERSION,
        campaignStarted: expectedStarted,
      });
      const titleAction = await page.locator(".title-start").innerText();
      invariant(
        titleAction.includes(expectedStarted ? "物語を続ける" : "物語を始める"),
        `${saveMode} title action mismatch: ${titleAction}`,
      );
    }

    if (scenario.startsWith("audio-") || scenario === "lifecycle") {
      await enableAudio(page);
      if (scenario === "audio-bgm-fail" || scenario === "audio-mixed-fail") {
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
        if (scenario === "audio-mixed-fail") {
          await page.evaluate(() => window.__ASHFALL_AUDIO_QA__.play("ui-cancel"));
          await page.locator('.game-shell[data-audio-bgm="failed"][data-audio-optional="failed"][data-audio-sfx="ready"][data-audio-voice="ready"]').waitFor({ state: "visible", timeout });
        }
        await page.unroute("**/audio/v060/music/title.*");
        await page.locator(".enable-audio-button").click();
        await page.locator('.game-shell[data-audio-bgm="ready"][data-audio-sfx="ready"][data-audio-voice="ready"]').waitFor({ state: "visible", timeout });
        const afterRetry = await page.evaluate(() => window.__ASHFALL_AUDIO_QA__.getDiagnostics());
        const sceneAfterRetry = await page.evaluate(() => window.__ASHFALL_AUDIO_QA__.getSceneState());
        invariant(afterRetry.failedAssets.every((asset) => asset.category !== "bgm"), "BGM retry remained failed");
        invariant(Boolean(sceneAfterRetry.bgmAssetId), "recovered BGM did not restart its scene loop");
        if (scenario === "audio-mixed-fail") {
          invariant(afterRetry.failedAssets.some((asset) => asset.optional), "mixed failure did not retain its optional failure");
        }
        invariant(afterRetry.contextCreateCount === 1, "partial retry created a duplicate AudioContext");
        invariant(afterRetry.duplicateLoopInstanceKeys.length === 0, "partial retry created a duplicate loop");
      } else if (scenario === "audio-optional-fail") {
        await page.evaluate(() => window.__ASHFALL_AUDIO_QA__.play("ui-cancel"));
        await page.locator('.game-shell[data-audio-optional="failed"][data-audio-bgm="ready"][data-audio-sfx="ready"][data-audio-voice="ready"]').waitFor({ state: "visible", timeout });
      } else {
        await page.evaluate(() => window.__ASHFALL_AUDIO_QA__.suspend());
        await page.locator(".enable-audio-button").click();
        await page.locator('.game-shell[data-audio-context="ready"]').waitFor({ state: "visible", timeout });
        const lifecycle = await page.evaluate(() => window.__ASHFALL_AUDIO_QA__.getDiagnostics());
        invariant(lifecycle.contextCreateCount === 1, "resume created a second AudioContext");
        invariant(lifecycle.duplicateLoopInstanceKeys.length === 0, "resume duplicated an audio loop");
      }
    } else if (scenario === "survival-start") {
      await reachMap(page);
      await page.locator(".survival-entry").click();
      await page.locator(".survival-lobby").waitFor({ state: "visible", timeout });
      await page.locator('.game-shell[data-assets-state="ready"]').waitFor({ state: "visible", timeout });
      const start = page.locator(".survival-start");
      const survivalSprites = await page.evaluate(() => window.__ASHFALL_ASSET_QA__.getLoadedSpriteKeys());
      invariant(
        ["crawlerClosed", "crawlerOpen", "takuya", "gate-eater"].every((kind) => survivalSprites.includes(kind)),
        `Survival critical sprites missing ${JSON.stringify(survivalSprites)}`,
      );
      invariant(await start.isEnabled(), "Survival start stayed disabled after its critical assets were ready");
      await start.click();
      await page.locator('.game-shell[data-screen="battle"]').waitFor({ state: "visible", timeout });
    } else {
      await reachLoadout(page, stageNumber);
      if (scenario === "mayo-critical") {
        await page.locator('.game-shell[data-assets-state="ready"]').waitFor({ state: "visible", timeout });
        const mayoSprites = await page.evaluate(() => window.__ASHFALL_ASSET_QA__.getLoadedSpriteKeys());
        invariant(
          mayoSprites.includes("mayo-chan") && mayoSprites.includes("mayo-chan-feral"),
          `Mayo critical atlases missing ${JSON.stringify(mayoSprites)}`,
        );
      }
      if (scenario === "asset-http-retry" || scenario === "asset-hang-retry" || scenario === "decode-hang" || scenario === "rapid-retry") {
        await page.locator('.game-shell[data-assets-state="error"]').waitFor({ state: "visible", timeout });
        if (scenario === "asset-http-retry" || scenario === "rapid-retry") {
          invariant(criticalRequestCount === 1, `initial generation duplicated critical requests: ${criticalRequestCount}`);
        }
        const before = await page.evaluate(() => window.__ASHFALL_ASSET_QA__.getState());
        const failedPaths = await page.evaluate(() => window.__ASHFALL_ASSET_QA__.getFailedPaths());
        if (scenario === "decode-hang") {
          invariant(before.failureReason === "decode", `decode hang reason mismatch ${JSON.stringify(before)}`);
          invariant(failedPaths.length > 0, "decode hang did not expose failed paths");
          await page.evaluate(() => window.__V0952_RESTORE_IMAGE_DECODE__());
        } else {
          invariant(failedPaths.length === 1 && failedPaths[0] === criticalPath, `unexpected failed paths ${JSON.stringify(failedPaths)}`);
        }
        if (releaseHungRoute) releaseHungRoute();
        await page.screenshot({
          path: path.join(evidenceDir, `${engine}-${viewport.width}x${viewport.height}-${scenario}-loadout-error.png`),
          fullPage: true,
        });
        await page.unroute(`**${criticalPath}`);
        const requestsBeforeRetry = criticalRequestCount;
        if (scenario === "rapid-retry") {
          await page.evaluate(() => {
            window.__ASHFALL_ASSET_QA__.retry();
            window.__ASHFALL_ASSET_QA__.retry();
          });
        } else {
          await page.locator(".asset-retry").click();
        }
        invariant(await page.locator(".formation-screen").isVisible(), "same-screen retry left loadout");
        invariant(!await page.locator(".title-screen-v060").isVisible(), "same-screen retry returned to title");
        await page.locator('.game-shell[data-assets-state="ready"]').waitFor({ state: "visible", timeout });
        const after = await page.evaluate(() => ({
          state: window.__ASHFALL_ASSET_QA__.getState(),
          restarts: window.__ASHFALL_ASSET_QA__.getRestartCount(),
          spriteKeys: window.__ASHFALL_ASSET_QA__.getLoadedSpriteKeys(),
        }));
        const expectedRestarts = scenario === "rapid-retry" ? 2 : 1;
        invariant(after.state.generation > before.generation && after.restarts === expectedRestarts, "retry generation/restart diagnostic mismatch");
        invariant(
          after.spriteKeys.includes("crawlerClosed") && after.spriteKeys.includes("crawlerOpen"),
          `critical retry left CRAWLER fallback active ${JSON.stringify(after.spriteKeys)}`,
        );
        if (scenario === "rapid-retry") {
          invariant(criticalRequestCount - requestsBeforeRetry === 1, `rapid retry duplicated critical requests: ${criticalRequestCount - requestsBeforeRetry}`);
        }
        const history = await page.evaluate(() => window.__ASHFALL_ASSET_QA__.getHistory());
        const retryCritical = history.find((entry) => (
          entry.phase === "critical"
          && entry.reason === "same-screen-retry"
          && entry.status === "ready"
        ));
        invariant(
          retryCritical && retryCritical.total === failedPaths.length,
          `critical retry session missing ${JSON.stringify(history)}`,
        );
        await enterBattle(page);
      } else if (scenario === "optional-hang") {
        await page.locator('.game-shell[data-assets-state="degraded-ready"]').waitFor({ state: "visible", timeout });
        await page.screenshot({
          path: path.join(evidenceDir, `${engine}-${viewport.width}x${viewport.height}-${scenario}-loadout-degraded.png`),
          fullPage: true,
        });
        await enterBattle(page);
      } else {
        if (stageNumber === 13) {
          const stage13Sprites = await page.evaluate(() => window.__ASHFALL_ASSET_QA__.getLoadedSpriteKeys());
          invariant(
            stage13Sprites.includes("walker") && stage13Sprites.includes("runner"),
            `shared Stage 13 atlas did not notify both kinds ${JSON.stringify(stage13Sprites)}`,
          );
        }
        await enterBattle(page);
      }
    }

    const shell = page.locator(".game-shell");
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    invariant(dimensions.width === dimensions.scrollWidth, `horizontal overflow ${JSON.stringify(dimensions)}`);
    const expectedFailure = scenario === "asset-http-retry" || scenario === "rapid-retry" || scenario === "audio-bgm-fail" || scenario === "audio-mixed-fail" || scenario === "audio-optional-fail";
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
      audioContextMode: await page.evaluate(() => window.__V0952_AUDIO_CONTEXT_MODE__ ?? "native"),
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
    if (shouldRun("fresh-save")) await runCase(browser, engine, { width: 844, height: 390 }, "fresh-save", 1, "fresh");
    if (shouldRun("legacy-v13")) await runCase(browser, engine, { width: 844, height: 390 }, "legacy-v13", 1, "legacy-v13");
    if (shouldRun("rapid-retry")) await runCase(browser, engine, { width: 844, height: 390 }, "rapid-retry", 1);
    if (shouldRun("mayo-critical")) await runCase(browser, engine, { width: 844, height: 390 }, "mayo-critical", 1);
    if (shouldRun("survival-start")) await runCase(browser, engine, { width: 844, height: 390 }, "survival-start", 1);
    if (engine === "chromium") {
      for (const [scenario, stage] of [
        ["asset-hang-retry", 1],
        ["decode-hang", 1],
        ["optional-hang", 1],
        ["audio-bgm-fail", 1],
        ["audio-mixed-fail", 1],
        ["audio-optional-fail", 1],
        ["lifecycle", 1],
        ["normal", 6],
        ["normal", 13],
      ]) {
        if (shouldRun(scenario)) await runCase(browser, engine, { width: 844, height: 390 }, scenario, stage);
      }
    } else {
      for (const scenario of [
        "asset-hang-retry",
        "decode-hang",
        "optional-hang",
        "audio-bgm-fail",
        "audio-mixed-fail",
        "audio-optional-fail",
        "lifecycle",
      ]) {
        if (shouldRun(scenario)) await runCase(browser, engine, { width: 844, height: 390 }, scenario, 1);
      }
    }
  } finally {
    await browser.close();
  }
}

const summary = { version: "0.9.5.2", total: results.length, passed: results.length, results };
await writeFile(path.join(evidenceDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
console.log(JSON.stringify(summary, null, 2));
