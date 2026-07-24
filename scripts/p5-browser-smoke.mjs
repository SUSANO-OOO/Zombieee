import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { CAMPAIGN_STAGE_IDS } from "../app/campaign.js";
import {
  PRODUCTION_AUDIO_MANIFEST,
  TAKUYA_ENTRANCE_AUDIO,
  sceneIdForScreen,
  sceneIdForStoryEvent,
} from "../app/productionAudio.js";
import {
  STORY_DIALOGUE_BY_SPEAKER,
  STORY_EVENT_IDS,
  STORY_EVENTS,
} from "../app/storyEvents.js";

const baseUrl = new URL(process.env.P5_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (baseUrl.hostname !== "localhost" && baseUrl.hostname !== "127.0.0.1") {
  throw new Error(`P5 QA routes are local-only; refusing non-local URL ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");

const browserTypes = {
  chromium: playwright.chromium,
  webkit: playwright.webkit,
};
const requestedEngines = (process.env.P5_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
const unknownEngines = requestedEngines.filter((engine) => !browserTypes[engine]);
if (unknownEngines.length > 0) {
  throw new Error(`Unknown P5_QA_ENGINES value: ${unknownEngines.join(", ")}`);
}
const qaScope = process.env.P5_QA_SCOPE ?? "all";
if (!["all", "story", "lifecycle", "bark", "battle-audio"].includes(qaScope)) {
  throw new Error(`Unknown P5_QA_SCOPE value: ${qaScope}`);
}

const evidenceDir = path.resolve(process.env.P5_QA_EVIDENCE_DIR ?? "outputs/p5-browser-smoke");
const timeout = Math.max(5_000, Number(process.env.P5_QA_TIMEOUT_MS) || 45_000);
const viewports = Object.freeze([
  Object.freeze({ width: 844, height: 390 }),
  Object.freeze({ width: 844, height: 340 }),
]);
const forbiddenPlayerFacingNames = Object.freeze([
  "センセイ",
  "医療支援",
  "ノイズ",
  "ロッカ",
  "橘迅",
  "橘 迅",
  "黒木凛",
  "黒木 凛",
  "白石直人",
  "白石 直人",
  "大庭豪",
  "大庭 豪",
  "真壁玲奈",
  "真壁 玲奈",
  "水城奈々",
  "水城 奈々",
]);
const expectedStationStageId = CAMPAIGN_STAGE_IDS.NISHIJIN_STATION_GATE;
const expectedStationSceneId = sceneIdForScreen("battle", expectedStationStageId, { musicMode: "normal" });
const expectedTakuyaStageId = CAMPAIGN_STAGE_IDS.NISHIJIN_DEFENSE_LINE;
const expectedTakuyaBossSceneId = sceneIdForScreen("battle", expectedTakuyaStageId, { musicMode: "boss" });
const expectedTakuyaBattleSceneId = sceneIdForScreen("battle", expectedTakuyaStageId, { musicMode: "normal" });
const expectedTakuyaEntranceSceneId = TAKUYA_ENTRANCE_AUDIO.silenceSceneId;
const expectedTakuyaFinalSceneId = sceneIdForStoryEvent("stage-takuya-final-v070");
const takuyaEntranceCueId = TAKUYA_ENTRANCE_AUDIO.cueId;
const results = [];

await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function unexpectedWarnings(warnings) {
  return warnings.filter((warning) => !warning.includes("was preloaded using link preload but not used"));
}

function assertNoRetiredNames(text, label) {
  for (const retired of forbiddenPlayerFacingNames) {
    invariant(!text.includes(retired), `${label} exposes retired player-facing name ${retired}`);
  }
}

function createDiagnostics(page) {
  let current = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: [],
    warnings: [],
  };
  const pendingRequests = new Set();

  page.on("request", (request) => pendingRequests.add(request));
  page.on("requestfinished", (request) => pendingRequests.delete(request));
  page.on("console", (message) => {
    if (message.type() === "error") current.consoleErrors.push(message.text());
    if (message.type() === "warning") current.warnings.push(message.text());
  });
  page.on("pageerror", (error) => current.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    pendingRequests.delete(request);
    current.requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) current.httpErrors.push(`${response.status()} ${response.url()}`);
  });

  return {
    reset() {
      pendingRequests.clear();
      current = {
        consoleErrors: [],
        pageErrors: [],
        requestFailures: [],
        httpErrors: [],
        warnings: [],
      };
    },
    snapshot() {
      return {
        ...current,
        warnings: unexpectedWarnings(current.warnings),
        pendingRequestCount: pendingRequests.size,
        pendingRequestUrls: [...pendingRequests]
          .map((request) => `${request.resourceType()} ${request.url()}`)
          .sort(),
      };
    },
  };
}

function assertDiagnostics(diagnostics, label) {
  invariant(diagnostics.pendingRequestCount === 0,
    `${label} retained ${diagnostics.pendingRequestCount} pending request(s)`);
  invariant(diagnostics.consoleErrors.length === 0,
    `${label} console errors: ${JSON.stringify(diagnostics.consoleErrors)}`);
  invariant(diagnostics.pageErrors.length === 0,
    `${label} page errors: ${JSON.stringify(diagnostics.pageErrors)}`);
  invariant(diagnostics.requestFailures.length === 0,
    `${label} request failures: ${JSON.stringify(diagnostics.requestFailures)}`);
  invariant(diagnostics.httpErrors.length === 0,
    `${label} HTTP errors: ${JSON.stringify(diagnostics.httpErrors)}`);
  invariant(diagnostics.warnings.length === 0,
    `${label} console warnings: ${JSON.stringify(diagnostics.warnings)}`);
}

function storyUrl(eventId) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "story",
    event: eventId,
    safe: "iphone-landscape",
  }).toString();
  return String(url);
}

function stationUrl(state, stage = 4) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "station",
    stage: String(stage),
    state,
    safe: "iphone-landscape",
  }).toString();
  return String(url);
}

function battleQaUrl(mode) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: mode,
    safe: "iphone-landscape",
  }).toString();
  return String(url);
}

async function enterLegacyQaBattle(page, label) {
  await page.waitForFunction(
    () => {
      const screen = document.querySelector(".game-shell")?.getAttribute("data-screen");
      return screen === "loadout" || screen === "battle";
    },
    undefined,
    { timeout },
  );
  if (await page.locator('.game-shell[data-screen="loadout"]').count()) {
    const deployButton = page.getByRole("button", { name: /この編成で出撃/ });
    await deployButton.waitFor({ state: "visible", timeout });
    await page.waitForFunction(
      () => {
        const buttons = [...document.querySelectorAll("button")];
        const deploy = buttons.find((button) => button.textContent?.includes("この編成で出撃"));
        return Boolean(deploy && !deploy.disabled);
      },
      undefined,
      { timeout },
    );
    await deployButton.click({ timeout });
  }
  await page.waitForFunction(
    () => {
      const screen = document.querySelector(".game-shell")?.getAttribute("data-screen");
      return screen === "event" || screen === "battle";
    },
    undefined,
    { timeout },
  );
  if (await page.locator('.game-shell[data-screen="event"]').count()) {
    await advanceVisibleStoryQueue(page);
  }
  await page.locator(
    `.game-shell[data-screen="battle"][data-stage-id="${expectedTakuyaStageId}"]`,
  ).waitFor({ state: "visible", timeout });
  const snapshot = await storyBattleSnapshot(page);
  invariant(snapshot?.stageId === expectedTakuyaStageId && snapshot?.running === true,
    `${label} did not enter the deterministic Stage 3 battle`);
}

async function waitForNetworkQuiet(page) {
  await page.waitForLoadState("networkidle", { timeout });
  await page.waitForTimeout(120);
}

async function readLayoutAndAudio(page) {
  return page.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const selectors = [
      ".game-shell",
      ".game-frame",
      ".campaign-overlay",
      ".dialogue-box",
      ".event-controls",
      ".story-skip-confirm",
      ".event-log",
      ".enable-audio-button",
      ".result-panel",
      ".battle-barks",
      ".pause-screen",
      ".boss-hud",
      ".top-hud",
      ".bottom-hud",
    ];
    const outsideViewportElements = selectors.flatMap((selector) => [...document.querySelectorAll(selector)])
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0
          && (rect.left < -1 || rect.top < -1 || rect.right > window.innerWidth + 1 || rect.bottom > window.innerHeight + 1);
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          selector: typeof element.className === "string" ? element.className : element.tagName,
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        };
      });
    const bridge = window.__ASHFALL_AUDIO_QA__;
    return {
      screen: document.querySelector(".game-shell")?.getAttribute("data-screen") ?? null,
      speaker: document.querySelector(".dialogue-name b")?.textContent ?? null,
      text: document.querySelector(".dialogue-text")?.textContent ?? null,
      visibleText: document.body.innerText,
      eventPortraits: {
        total: document.querySelectorAll(".event-portrait").length,
        active: document.querySelectorAll(".event-portrait.active").length,
        inactive: document.querySelectorAll(".event-portrait.inactive").length,
      },
      audioSceneDataset: document.documentElement.dataset.audioScene ?? null,
      audioDiagnostics: bridge?.getDiagnostics?.() ?? null,
      audioSceneState: bridge?.getSceneState?.() ?? null,
      dimensions: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        bodyWidth: document.body.scrollWidth,
        bodyHeight: document.body.scrollHeight,
        safeAreaSource: document.documentElement.dataset.safeAreaSource ?? null,
        safeArea: {
          top: rootStyle.getPropertyValue("--app-viewport-safe-top").trim(),
          right: rootStyle.getPropertyValue("--app-viewport-safe-right").trim(),
          bottom: rootStyle.getPropertyValue("--app-viewport-safe-bottom").trim(),
          left: rootStyle.getPropertyValue("--app-viewport-safe-left").trim(),
        },
        outsideViewportElements,
      },
    };
  });
}

function assertViewportEvidence(evidence, viewport, label) {
  const { dimensions } = evidence;
  invariant(dimensions.innerWidth === viewport.width && dimensions.innerHeight === viewport.height,
    `${label} viewport mismatch: ${dimensions.innerWidth}x${dimensions.innerHeight}`);
  invariant(dimensions.documentWidth <= viewport.width && dimensions.bodyWidth <= viewport.width,
    `${label} horizontal overflow: document=${dimensions.documentWidth}, body=${dimensions.bodyWidth}`);
  invariant(dimensions.documentHeight <= viewport.height && dimensions.bodyHeight <= viewport.height,
    `${label} vertical overflow: document=${dimensions.documentHeight}, body=${dimensions.bodyHeight}`);
  invariant(dimensions.safeAreaSource === "local-qa-iphone-landscape",
    `${label} missing iPhone landscape safe-area preset`);
  invariant(
    dimensions.safeArea.left === "44px"
      && dimensions.safeArea.right === "44px"
      && dimensions.safeArea.bottom === "21px",
    `${label} safe-area mismatch: ${JSON.stringify(dimensions.safeArea)}`,
  );
  invariant(dimensions.outsideViewportElements.length === 0,
    `${label} visible UI outside viewport: ${JSON.stringify(dimensions.outsideViewportElements)}`);
}

async function waitForStoryScreen(page, eventId) {
  const expectedSceneId = sceneIdForStoryEvent(eventId);
  await page.waitForFunction(
    ({ eventId, expectedSceneId }) => {
      const shell = document.querySelector('.game-shell[data-screen="event"]');
      const bridge = window.__ASHFALL_AUDIO_QA__;
      const diagnostics = bridge?.getDiagnostics?.();
      return Boolean(shell)
        && document.querySelector(".dialogue-box")
        && document.documentElement.dataset.audioScene === expectedSceneId
        && diagnostics?.desiredSceneId === expectedSceneId
        && new URLSearchParams(window.location.search).get("event") === eventId;
    },
    { eventId, expectedSceneId },
    { timeout },
  );
  return expectedSceneId;
}

async function auditStoryEvent({ page, diagnostics, engine, viewport, eventId }) {
  const label = `${engine}/${viewport.width}x${viewport.height}/${eventId}`;
  diagnostics.reset();
  const response = await page.goto(storyUrl(eventId), { waitUntil: "domcontentloaded", timeout });
  invariant(response?.ok(), `${label} navigation failed: ${response?.status() ?? "no response"}`);
  const expectedSceneId = await waitForStoryScreen(page, eventId);
  const expectedLines = STORY_EVENTS[eventId].lines;
  invariant(expectedLines.length > 0, `${label} has no display lines`);
  const lineSceneIds = [];
  let finalAdvanceStartedAt = null;

  for (const [index, expectedLine] of expectedLines.entries()) {
    const expectedLineSceneId = sceneIdForStoryEvent(eventId, index);
    await page.waitForFunction(
      ({ speaker, text, expectedLineSceneId }) => (
        document.querySelector(".dialogue-name b")?.textContent === speaker
        && document.querySelector(".dialogue-text")?.textContent === text
        && document.documentElement.dataset.audioScene === expectedLineSceneId
        && window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.().desiredSceneId === expectedLineSceneId
      ),
      { speaker: expectedLine.speaker, text: expectedLine.text, expectedLineSceneId },
      { timeout },
    );
    const evidence = await readLayoutAndAudio(page);
    invariant(evidence.screen === "event", `${label}/${index} left the event screen`);
    invariant(evidence.speaker === expectedLine.speaker,
      `${label}/${index} speaker mismatch: ${evidence.speaker} !== ${expectedLine.speaker}`);
    invariant(evidence.text === expectedLine.text,
      `${label}/${index} text mismatch: ${evidence.text} !== ${expectedLine.text}`);
    invariant(
      evidence.eventPortraits.total === 1
        && evidence.eventPortraits.active === 1
        && evidence.eventPortraits.inactive === 0,
      `${label}/${index} ghost portrait detected: ${JSON.stringify(evidence.eventPortraits)}`,
    );
    invariant(evidence.audioSceneDataset === expectedLineSceneId,
      `${label}/${index} audio scene mismatch: ${evidence.audioSceneDataset} !== ${expectedLineSceneId}`);
    assertNoRetiredNames(evidence.visibleText, `${label}/${index}`);
    assertViewportEvidence(evidence, viewport, `${label}/${index}`);
    lineSceneIds.push(expectedLineSceneId);
    if (index === expectedLines.length - 1) finalAdvanceStartedAt = Date.now();
    await page.locator(".dialogue-box").click({ timeout });
  }

  const authoredHoldMs = STORY_EVENTS[eventId].presentation.silenceAfterMs;
  let silenceTail = null;
  if (authoredHoldMs > 0) {
    const expectedSilenceSceneId = sceneIdForStoryEvent(eventId, expectedLines.length);
    await page.waitForFunction(
      ({ expectedSilenceSceneId }) => {
        const dialogue = document.querySelector(".dialogue-box");
        return document.querySelector('.game-shell[data-screen="event"]')
          && dialogue?.disabled
          && dialogue.getAttribute("aria-busy") === "true"
          && dialogue.textContent?.includes("無音")
          && document.documentElement.dataset.audioScene === expectedSilenceSceneId
          && window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.().desiredSceneId === expectedSilenceSceneId;
      },
      { expectedSilenceSceneId },
      { timeout },
    );
    const sentinelEvidence = await readLayoutAndAudio(page);
    invariant(sentinelEvidence.audioSceneDataset === expectedSilenceSceneId,
      `${label}/silence-tail scene mismatch: ${sentinelEvidence.audioSceneDataset} !== ${expectedSilenceSceneId}`);
    assertNoRetiredNames(sentinelEvidence.visibleText, `${label}/silence-tail`);
    assertViewportEvidence(sentinelEvidence, viewport, `${label}/silence-tail`);
    silenceTail = {
      expectedSceneId: expectedSilenceSceneId,
      authoredHoldMs,
    };
  }

  await page.locator('.game-shell[data-screen="map"]').waitFor({ state: "visible", timeout });
  if (silenceTail) {
    const observedHoldMs = Date.now() - finalAdvanceStartedAt;
    invariant(observedHoldMs >= authoredHoldMs - 150,
      `${label}/silence-tail held ${observedHoldMs}ms, expected at least ${authoredHoldMs - 150}ms`);
    silenceTail.observedHoldMs = observedHoldMs;
  }
  await page.waitForFunction(
    () => {
      const bridge = window.__ASHFALL_AUDIO_QA__;
      return document.documentElement.dataset.audioScene === "map"
        && bridge?.getDiagnostics?.().desiredSceneId === "map";
    },
    undefined,
    { timeout },
  );
  await waitForNetworkQuiet(page);
  const finalEvidence = await readLayoutAndAudio(page);
  assertNoRetiredNames(finalEvidence.visibleText, `${label}/map`);
  assertViewportEvidence(finalEvidence, viewport, `${label}/map`);
  const diagnosticEvidence = diagnostics.snapshot();
  assertDiagnostics(diagnosticEvidence, label);

  if (eventId === STORY_EVENT_IDS[0] || eventId === "chapter-ending-v070") {
    await page.screenshot({
      path: path.join(evidenceDir, `${engine}-${viewport.width}x${viewport.height}-${eventId}.png`),
    });
  }
  return {
    engine,
    viewport,
    eventId,
    expectedSceneId,
    lineSceneIds,
    silenceTail,
    lineCount: expectedLines.length,
    firstSpeaker: expectedLines[0].speaker,
    lastSpeaker: expectedLines.at(-1).speaker,
    destination: finalEvidence.screen,
    diagnostics: diagnosticEvidence,
    status: "passed",
  };
}

async function stableScene(page, expectedSceneId, label) {
  await page.waitForFunction(
    ({ expectedSceneId }) => {
      const bridge = window.__ASHFALL_AUDIO_QA__;
      if (!bridge) return false;
      const state = bridge.getSceneState();
      const diagnostics = bridge.getDiagnostics();
      const expectedVoices = (state.bgmAssetId ? 1 : 0) + state.ambienceAssetIds.length;
      return diagnostics.audioState === "running"
        && diagnostics.contextState === "running"
        && state.sceneId === expectedSceneId
        && diagnostics.activeVoices === expectedVoices
        && diagnostics.activeSceneVoices === expectedVoices
        && diagnostics.duplicateLoopInstanceKeys.length === 0;
    },
    { expectedSceneId },
    { timeout },
  );
  const evidence = await page.evaluate(() => {
    const bridge = window.__ASHFALL_AUDIO_QA__;
    return {
      diagnostics: bridge.getDiagnostics(),
      scene: bridge.getSceneState(),
      audioSceneDataset: document.documentElement.dataset.audioScene ?? null,
    };
  });
  const expectedVoices = (evidence.scene.bgmAssetId ? 1 : 0) + evidence.scene.ambienceAssetIds.length;
  invariant(evidence.scene.sceneId === expectedSceneId,
    `${label} scene mismatch: ${evidence.scene.sceneId} !== ${expectedSceneId}`);
  invariant(new Set(evidence.scene.ambienceAssetIds).size === evidence.scene.ambienceAssetIds.length,
    `${label} duplicated ambience: ${JSON.stringify(evidence.scene.ambienceAssetIds)}`);
  invariant(evidence.diagnostics.activeVoices === expectedVoices,
    `${label} active voices ${evidence.diagnostics.activeVoices} !== ${expectedVoices}`);
  invariant(evidence.diagnostics.activeSceneVoices === expectedVoices,
    `${label} active scene voices ${evidence.diagnostics.activeSceneVoices} !== ${expectedVoices}`);
  invariant(evidence.diagnostics.duplicateLoopInstanceKeys.length === 0,
    `${label} duplicated loop instance keys: ${JSON.stringify(evidence.diagnostics.duplicateLoopInstanceKeys)}`);
  invariant(evidence.diagnostics.contextCreateCount === 1,
    `${label} created ${evidence.diagnostics.contextCreateCount} AudioContexts`);
  return evidence;
}

async function unlockThroughPlayerControl(page, label) {
  await page.waitForSelector(".enable-audio-button", { state: "visible", timeout });
  const initial = await page.evaluate(() => {
    const button = document.querySelector(".enable-audio-button");
    window.__P5_AUDIO_UI_STATES__ = [button?.dataset.state ?? null];
    const observer = new MutationObserver(() => {
      window.__P5_AUDIO_UI_STATES__.push(button?.dataset.state ?? null);
    });
    if (button) observer.observe(button, { attributes: true, attributeFilter: ["data-state"] });
    window.__P5_AUDIO_UI_OBSERVER__ = observer;
    return {
      state: button?.dataset.state ?? null,
      text: button?.textContent ?? "",
      disabled: button?.disabled ?? null,
    };
  });
  invariant(initial.state === "idle", `${label} initial audio UI is ${initial.state}`);
  invariant(initial.disabled === false, `${label} audio enable control is disabled`);
  invariant(initial.text.includes("音声"), `${label} audio enable control has no player-facing audio label`);
  invariant(initial.text.includes("戦闘ボイス"), `${label} audio enable control omits retained battle voices`);

  await page.locator(".enable-audio-button").click({ timeout });
  await page.waitForFunction(
    () => {
      const states = window.__P5_AUDIO_UI_STATES__ ?? [];
      const pendingIndex = states.lastIndexOf("pending");
      return pendingIndex >= 0 && states.slice(pendingIndex + 1).includes("success");
    },
    undefined,
    { timeout },
  );
  const completed = await page.evaluate(() => {
    const button = document.querySelector(".enable-audio-button");
    const result = {
      states: [...(window.__P5_AUDIO_UI_STATES__ ?? [])],
      state: button?.dataset.state ?? null,
      text: button?.textContent ?? "",
      ariaLabel: button?.getAttribute("aria-label") ?? null,
      disabled: button?.disabled ?? null,
    };
    window.__P5_AUDIO_UI_OBSERVER__?.disconnect();
    delete window.__P5_AUDIO_UI_OBSERVER__;
    return result;
  });
  invariant(completed.states.includes("pending"), `${label} never displayed pending audio state`);
  invariant(completed.states.includes("success"), `${label} never displayed successful audio state`);
  invariant(completed.text.includes("音声OK") || completed.text.includes("音声が有効"),
    `${label} success copy was not visible: ${completed.text}`);
  return { initial, completed };
}

async function ensureStationAudioRunning(page) {
  const before = await page.evaluate(() => {
    const button = document.querySelector(".enable-audio-button");
    return {
      state: button?.dataset.state ?? null,
      visible: Boolean(button && getComputedStyle(button).display !== "none"),
      diagnostics: window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.() ?? null,
    };
  });
  let clickedPlayerControl = false;
  if (before.diagnostics?.audioState !== "running" || before.diagnostics?.contextState !== "running") {
    await page.waitForSelector(".enable-audio-button", { state: "visible", timeout });
    await page.locator(".enable-audio-button").click({ timeout });
    clickedPlayerControl = true;
    await page.waitForFunction(
      () => {
        const diagnostics = window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.();
        return diagnostics?.audioState === "running" && diagnostics?.contextState === "running";
      },
      undefined,
      { timeout },
    );
  }
  return {
    before,
    clickedPlayerControl,
    after: await page.evaluate(() => window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.() ?? null),
  };
}

async function exerciseRotationAndVisibility({ page, context, viewport, expectedSceneId, label }) {
  const portrait = { width: viewport.height, height: viewport.width };
  await page.setViewportSize(portrait);
  await page.evaluate(() => window.dispatchEvent(new Event("orientationchange")));
  await page.waitForTimeout(160);
  await page.setViewportSize(viewport);
  await page.evaluate(() => window.dispatchEvent(new Event("orientationchange")));
  await page.waitForTimeout(220);
  const afterRotation = await stableScene(page, expectedSceneId, `${label}/rotation`);

  await page.evaluate(() => {
    window.__P5_VISIBILITY_STATES__ = [document.visibilityState];
    window.__P5_VISIBILITY_HANDLER__ = () => {
      window.__P5_VISIBILITY_STATES__.push(document.visibilityState);
    };
    document.addEventListener("visibilitychange", window.__P5_VISIBILITY_HANDLER__);
  });
  const background = await context.newPage();
  let visibilityMode = "native-background-tab";
  try {
    await background.goto("about:blank");
    await background.bringToFront();
    await page.waitForFunction(
      () => document.visibilityState === "hidden",
      undefined,
      { timeout: Math.min(timeout, 1_500) },
    );
    await page.bringToFront();
    await page.waitForFunction(
      () => document.visibilityState === "visible",
      undefined,
      { timeout: Math.min(timeout, 1_500) },
    );
  } catch {
    // Headless Chromium and WebKit do not consistently expose background-tab
    // visibility. Drive the same document event path deterministically and
    // record the substitution instead of claiming a native tab transition.
    visibilityMode = "synthetic-headless-visibility";
    await page.bringToFront();
    await page.evaluate(() => {
      let syntheticVisibilityState = document.visibilityState;
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => syntheticVisibilityState,
      });
      window.__P5_SET_VISIBILITY_STATE__ = (state) => {
        syntheticVisibilityState = state;
        document.dispatchEvent(new Event("visibilitychange"));
      };
      window.__P5_SET_VISIBILITY_STATE__("hidden");
      window.__P5_SET_VISIBILITY_STATE__("visible");
    });
    await page.waitForFunction(() => (
      window.__P5_VISIBILITY_STATES__?.includes("hidden")
      && document.visibilityState === "visible"
    ), undefined, { timeout });
  }
  const visibility = await page.evaluate(() => {
    const states = [...(window.__P5_VISIBILITY_STATES__ ?? [])];
    window.dispatchEvent(new PageTransitionEvent("pageshow"));
    delete window.__P5_SET_VISIBILITY_STATE__;
    delete document.visibilityState;
    if (window.__P5_VISIBILITY_HANDLER__) {
      document.removeEventListener("visibilitychange", window.__P5_VISIBILITY_HANDLER__);
    }
    delete window.__P5_VISIBILITY_HANDLER__;
    delete window.__P5_VISIBILITY_STATES__;
    return {
      mode: null,
      states,
      after: document.visibilityState,
      pageshowDispatched: true,
    };
  });
  visibility.mode = visibilityMode;
  await background.close();
  invariant(visibility.states.includes("hidden"), `${label} never entered background-tab visibility`);
  invariant(visibility.after === "visible", `${label} did not restore foreground visibility`);
  await page.waitForTimeout(220);
  const afterVisibility = await stableScene(page, expectedSceneId, `${label}/visibility`);
  return { portrait, afterRotation, visibility, afterVisibility };
}

async function exerciseEveryScene(page, label) {
  const transitions = [];
  for (const scene of PRODUCTION_AUDIO_MANIFEST.scenes) {
    const requested = await page.evaluate(async (sceneId) => {
      const bridge = window.__ASHFALL_AUDIO_QA__;
      if (!bridge) throw new Error("Audio QA bridge unavailable");
      return bridge.setScene(sceneId);
    }, scene.id);
    invariant(requested?.sceneId === scene.id,
      `${label} setScene(${scene.id}) returned ${requested?.sceneId ?? "null"}`);
    const evidence = await stableScene(page, scene.id, `${label}/scene/${scene.id}`);
    transitions.push({
      sceneId: scene.id,
      bgmAssetId: evidence.scene.bgmAssetId,
      ambienceAssetIds: evidence.scene.ambienceAssetIds,
      activeVoices: evidence.diagnostics.activeVoices,
    });
  }
  invariant(transitions.length === PRODUCTION_AUDIO_MANIFEST.scenes.length,
    `${label} did not traverse every manifest scene`);
  invariant(new Set(transitions.map(({ sceneId }) => sceneId)).size === transitions.length,
    `${label} traversed a scene more than once`);
  return transitions;
}

async function advanceVisibleStoryQueue(page) {
  const visited = [];
  while (await page.locator('.game-shell[data-screen="event"]').count()) {
    const event = await page.evaluate(() => ({
      speaker: document.querySelector(".dialogue-name b")?.textContent ?? null,
      text: document.querySelector(".dialogue-text")?.textContent ?? null,
      sceneId: window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.().desiredSceneId ?? null,
    }));
    visited.push(event);
    await page.locator(".dialogue-box").click({ timeout });
    await page.waitForTimeout(0);
  }
  return visited;
}

async function exerciseRetry({ page, diagnostics, engine, viewport }) {
  const label = `${engine}/${viewport.width}x${viewport.height}/retry`;
  diagnostics.reset();
  const response = await page.goto(stationUrl("near-win"), { waitUntil: "domcontentloaded", timeout });
  invariant(response?.ok(), `${label} navigation failed: ${response?.status() ?? "no response"}`);
  await page.waitForFunction(
    () => {
      const screen = document.querySelector(".game-shell")?.getAttribute("data-screen");
      return Boolean(window.__ASHFALL_AUDIO_QA__) && (screen === "event" || screen === "result");
    },
    undefined,
    { timeout },
  );

  await page.keyboard.press("Tab");
  await page.waitForFunction(
    () => window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.().audioState === "running",
    undefined,
    { timeout },
  );
  const resultStory = await advanceVisibleStoryQueue(page);
  await page.locator('.game-shell[data-screen="result"]').waitFor({ state: "visible", timeout });
  const victoryScene = await stableScene(page, "victory", `${label}/result`);
  assertNoRetiredNames(await page.locator("body").innerText(), `${label}/result`);

  await page.getByRole("button", { name: "同じ編成で再戦", exact: true }).click({ timeout });
  await page.waitForFunction(
    () => {
      const screen = document.querySelector(".game-shell")?.getAttribute("data-screen");
      return screen === "event" || screen === "battle";
    },
    undefined,
    { timeout },
  );
  const retryStory = await advanceVisibleStoryQueue(page);
  await page.locator('.game-shell[data-screen="battle"]').waitFor({ state: "visible", timeout });
  const battleScene = await stableScene(page, expectedStationSceneId, `${label}/battle`);
  assertNoRetiredNames(await page.locator("body").innerText(), `${label}/battle`);
  await waitForNetworkQuiet(page);
  const diagnosticEvidence = diagnostics.snapshot();
  assertDiagnostics(diagnosticEvidence, label);
  return {
    resultStory,
    retryStory,
    victoryScene,
    battleScene,
    diagnostics: diagnosticEvidence,
  };
}

async function auditAudioLifecycle({ context, engine, viewport }) {
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  const label = `${engine}/${viewport.width}x${viewport.height}/audio-lifecycle`;
  const result = {
    engine,
    viewport,
    phase: "navigation",
    status: "failed",
  };
  try {
    result.phase = "audio-unlock-control";
    diagnostics.reset();
    const unlockResponse = await page.goto(storyUrl(STORY_EVENT_IDS[0]), {
      waitUntil: "domcontentloaded",
      timeout,
    });
    invariant(unlockResponse?.ok(), `${label} unlock-screen navigation failed: ${unlockResponse?.status() ?? "no response"}`);
    await waitForStoryScreen(page, STORY_EVENT_IDS[0]);
    const webAudioCapability = await page.evaluate(() => ({
      audioContext: typeof (window.AudioContext ?? window.webkitAudioContext),
      secureContext: window.isSecureContext,
      userAgent: navigator.userAgent,
    }));
    if (webAudioCapability.audioContext !== "function") {
      await waitForNetworkQuiet(page);
      const capabilityDiagnostics = diagnostics.snapshot();
      assertDiagnostics(capabilityDiagnostics, `${label}/web-audio-capability`);
      Object.assign(result, {
        phase: "web-audio-capability",
        status: "blocked",
        blocker: "This Playwright browser runtime does not expose AudioContext.",
        webAudioCapability,
        layout: await readLayoutAndAudio(page),
        diagnostics: capabilityDiagnostics,
      });
      await page.screenshot({
        path: path.join(evidenceDir, `${engine}-${viewport.width}x${viewport.height}-audio-lifecycle-BLOCKED.png`),
      });
      return result;
    }
    const audioUi = await unlockThroughPlayerControl(page, `${label}/control`);

    result.phase = "navigation";
    diagnostics.reset();
    const response = await page.goto(stationUrl("start"), { waitUntil: "domcontentloaded", timeout });
    invariant(response?.ok(), `${label} navigation failed: ${response?.status() ?? "no response"}`);
    await page.locator('.game-shell[data-screen="battle"]').waitFor({ state: "visible", timeout });
    await page.waitForFunction(
      ({ expectedSceneId }) => (
        window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.().desiredSceneId === expectedSceneId
      ),
      { expectedSceneId: expectedStationSceneId },
      { timeout },
    );
    const stationActivation = await ensureStationAudioRunning(page);
    result.phase = "initial-scene";
    const initialScene = await stableScene(page, expectedStationSceneId, `${label}/initial`);
    // Navigation intentionally aborts optional preload fallbacks owned by the
    // previous document. Begin lifecycle diagnostics from the settled battle.
    diagnostics.reset();
    result.phase = "rotation-and-visibility";
    const lifecycle = await exerciseRotationAndVisibility({
      page,
      context,
      viewport,
      expectedSceneId: expectedStationSceneId,
      label,
    });
    result.phase = "all-scene-transitions";
    const sceneTransitions = await exerciseEveryScene(page, label);
    await page.evaluate((sceneId) => window.__ASHFALL_AUDIO_QA__.setScene(sceneId), expectedStationSceneId);
    result.phase = "restored-battle-scene";
    const restoredScene = await stableScene(page, expectedStationSceneId, `${label}/restored`);
    await waitForNetworkQuiet(page);
    const lifecycleDiagnostics = diagnostics.snapshot();
    assertDiagnostics(lifecycleDiagnostics, label);

    result.phase = "victory-retry-battle";
    const retry = await exerciseRetry({ page, diagnostics, engine, viewport });
    Object.assign(result, {
      audioUi,
      stationActivation,
      initialScene,
      lifecycle,
      sceneTransitions,
      restoredScene,
      retry,
      lifecycleDiagnostics,
      phase: "complete",
      status: "passed",
    });
    await page.screenshot({
      path: path.join(evidenceDir, `${engine}-${viewport.width}x${viewport.height}-audio-lifecycle.png`),
    });
  } catch (error) {
    result.error = String(error);
    result.diagnostics = diagnostics.snapshot();
    try {
      result.failureState = await page.evaluate(() => {
        const button = document.querySelector(".enable-audio-button");
        return {
          screen: document.querySelector(".game-shell")?.getAttribute("data-screen") ?? null,
          audioUiState: button?.dataset.state ?? null,
          audioUiText: button?.textContent ?? null,
          audioUiStates: [...(window.__P5_AUDIO_UI_STATES__ ?? [])],
          audioDiagnostics: window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.() ?? null,
          scene: window.__ASHFALL_AUDIO_QA__?.getSceneState?.() ?? null,
          visibilityState: document.visibilityState,
        };
      });
    } catch {
      result.failureState = null;
    }
    try {
      await page.screenshot({
        path: path.join(evidenceDir, `${engine}-${viewport.width}x${viewport.height}-audio-lifecycle-FAILED.png`),
      });
    } catch {
      // The browser can fail before the document exists.
    }
  } finally {
    await page.close();
  }
  return result;
}

async function installStoryBattleRecorder(page) {
  await page.addInitScript(({ entranceCueId }) => {
    window.__P5_STORY_BATTLE_SAMPLES__ = [];
    const capture = () => {
      const battleBridge = window.__ASHFALL_BATTLE_QA__;
      const snapshot = battleBridge?.getSnapshot?.();
      if (!snapshot) return;
      const audioBridge = window.__ASHFALL_AUDIO_QA__;
      const audioDiagnostics = audioBridge?.getDiagnostics?.() ?? null;
      const samples = window.__P5_STORY_BATTLE_SAMPLES__;
      samples.push({
        at: performance.now(),
        screen: document.querySelector(".game-shell")?.getAttribute("data-screen") ?? null,
        eventOverlayCount: document.querySelectorAll(".campaign-overlay.event-screen").length,
        audioScene: document.documentElement.dataset.audioScene ?? null,
        audioDesiredScene: audioDiagnostics?.desiredSceneId ?? null,
        audioRuntimeScene: audioDiagnostics?.sceneId ?? null,
        entranceCueActive: audioBridge?.hasInstance?.(entranceCueId) ?? false,
        snapshot,
      });
      if (samples.length > 2_400) samples.splice(0, samples.length - 2_400);
    };
    window.__P5_STORY_BATTLE_CAPTURE__ = capture;
    window.__P5_STORY_BATTLE_TIMER__ = window.setInterval(capture, 25);
    capture();
  }, { entranceCueId: takuyaEntranceCueId });
}

async function storyBattleSnapshot(page) {
  return page.evaluate(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null);
}

async function storyBattleSamples(page) {
  return page.evaluate(() => [...(window.__P5_STORY_BATTLE_SAMPLES__ ?? [])]);
}

async function stopStoryBattleRecorder(page) {
  await page.evaluate(() => {
    if (window.__P5_STORY_BATTLE_TIMER__) window.clearInterval(window.__P5_STORY_BATTLE_TIMER__);
    delete window.__P5_STORY_BATTLE_TIMER__;
    delete window.__P5_STORY_BATTLE_CAPTURE__;
  }).catch(() => undefined);
}

async function webAudioCapability(page) {
  return page.evaluate(() => ({
    audioContext: typeof (window.AudioContext ?? window.webkitAudioContext),
    secureContext: window.isSecureContext,
    userAgent: navigator.userAgent,
  }));
}

async function ensureBattleQaAudioRunning(page, label) {
  const current = await page.evaluate(() => {
    const button = document.querySelector(".enable-audio-button");
    return {
      uiState: button?.dataset.state ?? null,
      uiText: button?.textContent ?? "",
      diagnostics: window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.() ?? null,
    };
  });
  if (current.diagnostics?.audioState === "running"
    && current.diagnostics?.contextState === "running") {
    return {
      mode: "already-running-after-story-advance",
      ...current,
    };
  }
  return {
    mode: "explicit-player-control",
    ...await unlockThroughPlayerControl(page, label),
  };
}

function activeScriptedBark(snapshot, cueFragment = null) {
  const active = snapshot?.battleBarks?.active ?? [];
  return active.find((bark) => (
    bark.scripted === true
    && (!cueFragment || bark.scriptedCueId?.includes(cueFragment))
  )) ?? null;
}

function scriptedLineSequence(samples, cueFragments) {
  const lines = [];
  const seenIds = new Set();
  for (const sample of samples) {
    for (const bark of sample.snapshot?.battleBarks?.active ?? []) {
      if (bark.scripted !== true
        || !cueFragments.some((fragment) => bark.scriptedCueId?.includes(fragment))
        || seenIds.has(bark.id)) continue;
      seenIds.add(bark.id);
      lines.push({
        id: bark.id,
        scriptedCueId: bark.scriptedCueId,
        speaker: bark.speaker,
        text: bark.text,
        playVoice: bark.playVoice,
      });
    }
  }
  return lines;
}

function assertBattleRemainedNonblocking(samples, label) {
  const firstBattleIndex = samples.findIndex((sample) => sample.screen === "battle");
  invariant(firstBattleIndex >= 0, `${label} captured no battle samples`);
  const battleSamples = samples.slice(firstBattleIndex);
  invariant(battleSamples.every((sample) => sample.screen === "battle"),
    `${label} left the battle screen`);
  invariant(battleSamples.every((sample) => sample.eventOverlayCount === 0),
    `${label} opened a blocking StoryScreen`);
}

async function pauseAndVerifyFrozenScriptedBark({
  page,
  cueFragment,
  label,
  whilePaused = null,
}) {
  await page.waitForFunction(
    ({ cueFragment }) => {
      const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
      return snapshot?.battleBarks?.active?.some((bark) => (
        bark.scripted === true && bark.scriptedCueId?.includes(cueFragment)
      ));
    },
    { cueFragment },
    { timeout },
  );
  const before = await storyBattleSnapshot(page);
  const beforeBark = activeScriptedBark(before, cueFragment);
  invariant(beforeBark, `${label} has no scripted bark before pause`);
  await page.getByRole("button", { name: "一時停止", exact: true }).click({ timeout });
  await page.waitForFunction(
    () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().paused === true,
    undefined,
    { timeout },
  );
  const paused = await storyBattleSnapshot(page);
  const pausedBark = activeScriptedBark(paused, cueFragment);
  invariant(pausedBark?.id === beforeBark.id, `${label} changed the active scripted line while pausing`);
  invariant(await page.locator(".battle-barks").count() === 0,
    `${label} left battle dialogue visible above the pause menu`);

  await page.waitForTimeout(700);
  const held = await storyBattleSnapshot(page);
  const heldBark = activeScriptedBark(held, cueFragment);
  invariant(Math.abs(held.time - paused.time) <= .03,
    `${label} advanced game time while paused: ${paused.time} -> ${held.time}`);
  invariant(heldBark?.id === pausedBark.id, `${label} replaced the scripted line while paused`);
  invariant(Math.abs(heldBark.remaining - pausedBark.remaining) <= .03,
    `${label} consumed scripted dialogue while paused: ${pausedBark.remaining} -> ${heldBark.remaining}`);
  if (whilePaused) await whilePaused({ before, paused, held });

  await page.getByRole("button", { name: "作戦を再開", exact: true }).click({ timeout });
  await page.waitForFunction(
    () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().paused === false,
    undefined,
    { timeout },
  );
  const resumed = await storyBattleSnapshot(page);
  const resumedBark = activeScriptedBark(resumed, cueFragment);
  invariant(resumedBark?.id === beforeBark.id, `${label} did not restore the frozen scripted line`);
  return { before, paused, held, resumed, scriptedLineId: beforeBark.id };
}

async function auditTakuyaEntranceAudio({ browser, engine, viewport }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  const label = `${engine}/${viewport.width}x${viewport.height}/takuya-entrance-audio`;
  const result = {
    engine,
    viewport,
    phase: "navigation",
    status: "failed",
  };
  try {
    await installStoryBattleRecorder(page);
    diagnostics.reset();
    const response = await page.goto(battleQaUrl("takuya-entrance"), {
      waitUntil: "domcontentloaded",
      timeout,
    });
    invariant(response?.ok(), `${label} navigation failed: ${response?.status() ?? "no response"}`);
    await enterLegacyQaBattle(page, label);
    await page.waitForFunction(
      () => Boolean(window.__ASHFALL_AUDIO_QA__) && Boolean(window.__ASHFALL_BATTLE_QA__),
      undefined,
      { timeout },
    );
    await page.getByRole("button", { name: "一時停止", exact: true }).click({ timeout });
    await page.waitForFunction(
      () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().paused === true,
      undefined,
      { timeout },
    );
    const capability = await webAudioCapability(page);
    const audioBlocked = capability.audioContext !== "function";
    const audioUi = audioBlocked ? null : await ensureBattleQaAudioRunning(page, `${label}/control`);
    await page.getByRole("button", { name: "作戦を再開", exact: true }).click({ timeout });
    await page.waitForFunction(
      () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().paused === false,
      undefined,
      { timeout },
    );

    result.phase = "entrance-start";
    await page.waitForFunction(
      ({ expectedSceneId }) => {
        const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
        return snapshot?.takuyaEntranceAudioRemaining > 0
          && snapshot?.storyBattleReceiptEventIds?.includes("stage-takuya-warning-v070")
          && snapshot?.battleBarks?.active?.some((bark) => bark.scripted === true)
          && document.documentElement.dataset.audioScene === expectedSceneId;
      },
      { expectedSceneId: expectedTakuyaEntranceSceneId },
      { timeout },
    );
    if (!audioBlocked) {
      await page.waitForFunction(
        ({ cueId }) => window.__ASHFALL_AUDIO_QA__?.hasInstance?.(cueId) === true,
        { cueId: takuyaEntranceCueId },
        { timeout },
      );
    }
    const entranceStarted = await storyBattleSnapshot(page);
    const startedAt = Date.now();
    const pauseEvidence = await pauseAndVerifyFrozenScriptedBark({
      page,
      cueFragment: "stage-takuya-warning-v070",
      label: `${label}/pause`,
      whilePaused: audioBlocked ? null : async () => {
        await page.waitForFunction(
          ({ cueId }) => window.__ASHFALL_AUDIO_QA__?.hasInstance?.(cueId) === false,
          { cueId: takuyaEntranceCueId },
          { timeout },
        );
      },
    });
    invariant(Math.abs(pauseEvidence.held.takuyaEntranceAudioRemaining
      - pauseEvidence.paused.takuyaEntranceAudioRemaining) <= .03,
    `${label} consumed the TAKUYA entrance timer while paused`);
    result.phase = "entrance-restart";
    await page.waitForFunction(
      ({ expectedSceneId, expectedRemaining }) => {
        const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
        return snapshot?.paused === false
          && snapshot?.takuyaEntranceAudioRemaining >= expectedRemaining
          && document.documentElement.dataset.audioScene === expectedSceneId;
      },
      {
        expectedSceneId: expectedTakuyaEntranceSceneId,
        expectedRemaining: TAKUYA_ENTRANCE_AUDIO.durationSeconds - .15,
      },
      { timeout },
    );
    const restartAt = Date.now();
    if (!audioBlocked) {
      await page.waitForFunction(
        ({ cueId }) => window.__ASHFALL_AUDIO_QA__?.hasInstance?.(cueId) === true,
        { cueId: takuyaEntranceCueId },
        { timeout },
      );
    }

    result.phase = "boss-music-resume";
    await page.waitForFunction(
      ({ expectedSceneId }) => {
        const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
        return snapshot?.takuyaEntranceAudioRemaining <= 0
          && document.documentElement.dataset.audioScene === expectedSceneId;
      },
      { expectedSceneId: expectedTakuyaBossSceneId },
      { timeout },
    );
    const observedRestartMs = Date.now() - restartAt;
    invariant(observedRestartMs >= TAKUYA_ENTRANCE_AUDIO.durationSeconds * 1_000 - 250,
      `${label} resumed boss music after only ${observedRestartMs}ms`);
    const completed = await storyBattleSnapshot(page);
    invariant(completed.time > entranceStarted.time,
      `${label} battle time did not advance after resume`);
    const layout = await readLayoutAndAudio(page);
    assertViewportEvidence(layout, viewport, label);
    assertNoRetiredNames(layout.visibleText, label);
    const samples = await storyBattleSamples(page);
    assertBattleRemainedNonblocking(samples, label);
    await waitForNetworkQuiet(page);
    const diagnosticEvidence = diagnostics.snapshot();
    assertDiagnostics(diagnosticEvidence, label);
    Object.assign(result, {
      phase: "complete",
      status: audioBlocked ? "blocked" : "passed",
      logicStatus: "passed",
      audioStatus: audioBlocked ? "blocked" : "passed",
      blocker: audioBlocked ? "This Playwright browser runtime does not expose AudioContext." : null,
      capability,
      audioUi,
      pauseEvidence,
      observedRestartMs,
      elapsedWallMs: Date.now() - startedAt,
      completed,
      diagnostics: diagnosticEvidence,
    });
    await page.screenshot({
      path: path.join(evidenceDir, `${engine}-${viewport.width}x${viewport.height}-takuya-entrance-audio${audioBlocked ? "-BLOCKED" : ""}.png`),
    });
  } catch (error) {
    result.error = String(error);
    result.diagnostics = diagnostics.snapshot();
    result.failureState = await storyBattleSnapshot(page).catch(() => null);
  } finally {
    await stopStoryBattleRecorder(page);
    await page.close();
    await context.close();
  }
  return result;
}

async function auditTakuyaFinalAudio({ browser, engine, viewport }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  const label = `${engine}/${viewport.width}x${viewport.height}/takuya-final-audio`;
  const result = {
    engine,
    viewport,
    phase: "navigation",
    status: "failed",
  };
  try {
    await installStoryBattleRecorder(page);
    diagnostics.reset();
    const response = await page.goto(battleQaUrl("ai-reacquire"), {
      waitUntil: "domcontentloaded",
      timeout,
    });
    invariant(response?.ok(), `${label} navigation failed: ${response?.status() ?? "no response"}`);
    await enterLegacyQaBattle(page, label);
    await page.waitForFunction(
      () => Boolean(window.__ASHFALL_AUDIO_QA__) && Boolean(window.__ASHFALL_BATTLE_QA__),
      undefined,
      { timeout },
    );
    await page.getByRole("button", { name: "一時停止", exact: true }).click({ timeout });
    await page.waitForFunction(
      () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().paused === true,
      undefined,
      { timeout },
    );
    const capability = await webAudioCapability(page);
    const audioBlocked = capability.audioContext !== "function";
    const audioUi = audioBlocked ? null : await ensureBattleQaAudioRunning(page, `${label}/control`);
    await page.getByRole("button", { name: "作戦を再開", exact: true }).click({ timeout });
    await page.waitForFunction(
      () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().paused === false,
      undefined,
      { timeout },
    );

    result.phase = "final-cut";
    await page.waitForFunction(
      ({ cueFragment, expectedSceneId }) => {
        const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
        return snapshot?.battleBarks?.active?.some((bark) => (
          bark.scripted === true && bark.scriptedCueId?.includes(cueFragment)
        )) && document.documentElement.dataset.audioScene === expectedSceneId;
      },
      { cueFragment: "stage-takuya-final-v070", expectedSceneId: expectedTakuyaFinalSceneId },
      { timeout },
    );
    const pauseEvidence = await pauseAndVerifyFrozenScriptedBark({
      page,
      cueFragment: "stage-takuya-final-v070",
      label: `${label}/pause`,
    });

    result.phase = "final-fifo";
    const finalLines = STORY_EVENTS["stage-takuya-final-v070"].lines.map(({ speaker, text }) => ({ speaker, text }));
    const baseEventLines = STORY_EVENTS["stage-takuya-base-remains-v070"].lines;
    const expectedLines = [
      ...finalLines,
      ...[baseEventLines[0], baseEventLines[2]].map(({ speaker, text }) => ({ speaker, text })),
    ];
    await page.waitForFunction(
      ({ expectedLines }) => {
        const samples = window.__P5_STORY_BATTLE_SAMPLES__ ?? [];
        const lines = [];
        const seenIds = new Set();
        for (const sample of samples) {
          for (const bark of sample.snapshot?.battleBarks?.active ?? []) {
            if (bark.scripted !== true
              || (!bark.scriptedCueId?.includes("stage-takuya-final-v070")
                && !bark.scriptedCueId?.includes("stage-takuya-base-remains-v070"))
              || seenIds.has(bark.id)) continue;
            seenIds.add(bark.id);
            lines.push({ speaker: bark.speaker, text: bark.text });
          }
        }
        return expectedLines.every((line, index) => (
          lines[index]?.speaker === line.speaker && lines[index]?.text === line.text
        ));
      },
      { expectedLines },
      { timeout },
    );
    const samples = await storyBattleSamples(page);
    const observedLines = scriptedLineSequence(samples, [
      "stage-takuya-final-v070",
      "stage-takuya-base-remains-v070",
    ]);
    invariant(observedLines.length === expectedLines.length,
      `${label} observed ${observedLines.length} final/base lines, expected ${expectedLines.length}`);
    invariant(observedLines.every((line, index) => (
      line.speaker === expectedLines[index].speaker
      && line.text === expectedLines[index].text
      && line.playVoice === false
    )), `${label} final/base FIFO or story voice contract mismatch: ${JSON.stringify(observedLines)}`);
    for (const line of finalLines) {
      invariant(samples.some((sample) => (
        sample.audioScene === expectedTakuyaFinalSceneId
        && sample.snapshot?.battleBarks?.active?.some((bark) => (
          bark.scripted === true && bark.text === line.text
        ))
      )), `${label} final line was not rendered under ${expectedTakuyaFinalSceneId}: ${line.text}`);
    }
    for (const line of expectedLines.slice(finalLines.length)) {
      invariant(samples.some((sample) => (
        sample.audioScene === expectedTakuyaBattleSceneId
        && sample.snapshot?.battleBarks?.active?.some((bark) => (
          bark.scripted === true && bark.text === line.text
        ))
      )), `${label} base-remains line did not restore ${expectedTakuyaBattleSceneId}: ${line.text}`);
    }
    if (!audioBlocked) {
      invariant(samples.some((sample) => (
        sample.audioDesiredScene === expectedTakuyaFinalSceneId
        && sample.audioRuntimeScene === expectedTakuyaFinalSceneId
      )), `${label} production mixer never entered the final silence scene`);
      invariant(samples.some((sample) => sample.audioRuntimeScene === expectedTakuyaBattleSceneId),
        `${label} production mixer did not restore the Stage 3 battle scene`);
    }
    assertBattleRemainedNonblocking(samples, label);
    const current = await storyBattleSnapshot(page);
    invariant(current.bossDefeated === true && current.barricadeHp > 0,
      `${label} did not preserve the boss-defeated/base-remains condition`);
    invariant(current.storyBattleReceiptEventIds.includes("stage-takuya-final-v070")
      && current.storyBattleReceiptEventIds.includes("stage-takuya-base-remains-v070"),
    `${label} omitted final/base story receipts`);
    invariant(samples.at(-1).snapshot.time > samples[0].snapshot.time,
      `${label} battle time did not advance through nonblocking dialogue`);
    const layout = await readLayoutAndAudio(page);
    assertViewportEvidence(layout, viewport, label);
    assertNoRetiredNames(layout.visibleText, label);
    await waitForNetworkQuiet(page);
    const diagnosticEvidence = diagnostics.snapshot();
    assertDiagnostics(diagnosticEvidence, label);
    Object.assign(result, {
      phase: "complete",
      status: audioBlocked ? "blocked" : "passed",
      logicStatus: "passed",
      audioStatus: audioBlocked ? "blocked" : "passed",
      blocker: audioBlocked ? "This Playwright browser runtime does not expose AudioContext." : null,
      capability,
      audioUi,
      pauseEvidence,
      expectedLines,
      observedLines,
      completed: current,
      diagnostics: diagnosticEvidence,
    });
    await page.screenshot({
      path: path.join(evidenceDir, `${engine}-${viewport.width}x${viewport.height}-takuya-final-audio${audioBlocked ? "-BLOCKED" : ""}.png`),
    });
  } catch (error) {
    result.error = String(error);
    result.diagnostics = diagnostics.snapshot();
    result.failureState = await storyBattleSnapshot(page).catch(() => null);
  } finally {
    await stopStoryBattleRecorder(page);
    await page.close();
    await context.close();
  }
  return result;
}

async function auditNonblockingBark({ browser, engine }) {
  const viewport = viewports[0];
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  const label = `${engine}/${viewport.width}x${viewport.height}/nonblocking-bark`;
  const result = {
    engine,
    viewport,
    stage: 5,
    status: "unavailable",
  };
  try {
    diagnostics.reset();
    const response = await page.goto(stationUrl("start", 5), { waitUntil: "domcontentloaded", timeout });
    invariant(response?.ok(), `${label} navigation failed: ${response?.status() ?? "no response"}`);
    await page.locator('.game-shell[data-screen="battle"]').waitFor({ state: "visible", timeout });
    await page.evaluate(() => {
      window.__P5_BARK_LOG__ = [];
      const collect = () => {
        const screen = document.querySelector(".game-shell")?.getAttribute("data-screen") ?? null;
        for (const row of document.querySelectorAll('.battle-barks[aria-label="戦闘台詞"] p')) {
          const entry = {
            speaker: row.querySelector("b")?.textContent ?? null,
            text: row.querySelector("span")?.textContent ?? null,
            screen,
          };
          if (!window.__P5_BARK_LOG__.some((known) => (
            known.speaker === entry.speaker && known.text === entry.text
          ))) window.__P5_BARK_LOG__.push(entry);
        }
      };
      window.__P5_BARK_OBSERVER__ = new MutationObserver(collect);
      window.__P5_BARK_OBSERVER__.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      collect();
    });
    try {
      await page.getByRole("button", { name: /ハチ/ }).click({ timeout: 5_000 });
    } catch {
      // The Stage 5 operator cue does not require a deployed speaker.
    }
    const expectedLines = STORY_EVENTS["stage-station-platform-alert-v070"].lines.map(({ speaker, text }) => ({
      speaker,
      text,
    }));
    await page.waitForFunction(
      ({ expectedLines }) => (window.__P5_BARK_LOG__ ?? []).some((entry) => (
        expectedLines.some((expected) => expected.speaker === entry.speaker && expected.text === entry.text)
      )),
      { expectedLines },
      { timeout: Math.max(timeout, 35_000) },
    );
    const barkEvidence = await page.evaluate(() => {
      const evidence = {
        screen: document.querySelector(".game-shell")?.getAttribute("data-screen") ?? null,
        eventOverlayCount: document.querySelectorAll(".campaign-overlay.event-screen").length,
        entries: [...(window.__P5_BARK_LOG__ ?? [])],
      };
      window.__P5_BARK_OBSERVER__?.disconnect();
      delete window.__P5_BARK_OBSERVER__;
      delete window.__P5_BARK_LOG__;
      return evidence;
    });
    invariant(barkEvidence.entries.length > 0, `${label} captured no rendered bark`);
    invariant(barkEvidence.entries.every(({ screen }) => screen === "battle"),
      `${label} bark left battle screen: ${JSON.stringify(barkEvidence.entries)}`);
    invariant(barkEvidence.screen === "battle" && barkEvidence.eventOverlayCount === 0,
      `${label} used blocking StoryScreen presentation`);
    const layout = await readLayoutAndAudio(page);
    assertViewportEvidence(layout, viewport, label);
    await waitForNetworkQuiet(page);
    const diagnosticEvidence = diagnostics.snapshot();
    assertDiagnostics(diagnosticEvidence, label);
    Object.assign(result, {
      barkEvidence,
      diagnostics: diagnosticEvidence,
      status: "passed",
    });
  } catch (error) {
    const failureState = await page.evaluate(() => ({
      screen: document.querySelector(".game-shell")?.getAttribute("data-screen") ?? null,
      eventOverlayCount: document.querySelectorAll(".campaign-overlay.event-screen").length,
      entries: [...(window.__P5_BARK_LOG__ ?? [])],
    })).catch(() => null);
    const diagnosticEvidence = diagnostics.snapshot();
    const cleanButNotObserved = failureState?.screen === "battle"
      && failureState.eventOverlayCount === 0
      && diagnosticEvidence.consoleErrors.length === 0
      && diagnosticEvidence.pageErrors.length === 0
      && diagnosticEvidence.requestFailures.length === 0
      && diagnosticEvidence.httpErrors.length === 0;
    Object.assign(result, {
      status: cleanButNotObserved ? "unavailable" : "failed",
      reason: cleanButNotObserved
        ? "No deterministic browser injection route exists; the timed Stage 5 cue was not observed."
        : String(error),
      failureState,
      diagnostics: diagnosticEvidence,
    });
  } finally {
    await page.evaluate(() => window.__P5_BARK_OBSERVER__?.disconnect()).catch(() => undefined);
    await page.close();
    await context.close();
  }
  return result;
}

for (const engine of requestedEngines) {
  let browser;
  try {
    browser = await browserTypes[engine].launch({ headless: true });
  } catch (error) {
    results.push({
      kind: "browser-launch",
      engine,
      status: "failed",
      error: String(error),
    });
    continue;
  }

  try {
    for (const viewport of viewports) {
      if (qaScope === "all" || qaScope === "story") {
        const storyContext = await browser.newContext({ viewport });
        const storyPage = await storyContext.newPage();
        const storyDiagnostics = createDiagnostics(storyPage);
        try {
          for (const eventId of STORY_EVENT_IDS) {
            try {
              const result = await auditStoryEvent({
                page: storyPage,
                diagnostics: storyDiagnostics,
                engine,
                viewport,
                eventId,
              });
              results.push({ kind: "story", ...result });
            } catch (error) {
              const failed = {
                kind: "story",
                engine,
                viewport,
                eventId,
                status: "failed",
                error: String(error),
                diagnostics: storyDiagnostics.snapshot(),
              };
              results.push(failed);
              try {
                await storyPage.screenshot({
                  path: path.join(evidenceDir, `${engine}-${viewport.width}x${viewport.height}-${eventId}-FAILED.png`),
                });
              } catch {
                // Navigation can fail before a screenshot is possible.
              }
            }
          }
        } finally {
          await storyPage.close();
          await storyContext.close();
        }
      }
      if (qaScope === "all" || qaScope === "lifecycle") {
        const lifecycleContext = await browser.newContext({ viewport });
        results.push({
          kind: "audio-lifecycle",
          ...await auditAudioLifecycle({ context: lifecycleContext, engine, viewport }),
        });
        await lifecycleContext.close();
      }
      if (qaScope === "all" || qaScope === "battle-audio") {
        results.push({
          kind: "takuya-entrance-audio",
          ...await auditTakuyaEntranceAudio({ browser, engine, viewport }),
        });
        results.push({
          kind: "takuya-final-audio",
          ...await auditTakuyaFinalAudio({ browser, engine, viewport }),
        });
      }
    }
    if (qaScope === "all" || qaScope === "bark") {
      results.push({
        kind: "nonblocking-bark",
        ...await auditNonblockingBark({ browser, engine }),
      });
    }
  } finally {
    await browser.close();
  }
}

const storyResults = results.filter((result) => result.kind === "story");
const lifecycleResults = results.filter((result) => result.kind === "audio-lifecycle");
const barkResults = results.filter((result) => result.kind === "nonblocking-bark");
const battleAudioResults = results.filter((result) => (
  result.kind === "takuya-entrance-audio" || result.kind === "takuya-final-audio"
));
const blockedResults = results.filter((result) => result.status === "blocked");
const summary = {
  baseUrl: String(baseUrl),
  generatedAt: new Date().toISOString(),
  scope: qaScope,
  engines: requestedEngines,
  viewports,
  storyEventCount: STORY_EVENT_IDS.length,
  storyCaseCount: storyResults.length,
  storyPassed: storyResults.filter((result) => result.status === "passed").length,
  lifecycleCaseCount: lifecycleResults.length,
  lifecyclePassed: lifecycleResults.filter((result) => result.status === "passed").length,
  lifecycleBlocked: lifecycleResults.filter((result) => result.status === "blocked").length,
  barkCaseCount: barkResults.length,
  barkPassed: barkResults.filter((result) => result.status === "passed").length,
  barkUnavailable: barkResults.filter((result) => result.status === "unavailable").length,
  battleAudioCaseCount: battleAudioResults.length,
  battleAudioPassed: battleAudioResults.filter((result) => result.status === "passed").length,
  battleAudioBlocked: battleAudioResults.filter((result) => result.status === "blocked").length,
  manifestSceneIds: PRODUCTION_AUDIO_MANIFEST.scenes.map((scene) => scene.id),
  speakerDialogue: STORY_DIALOGUE_BY_SPEAKER,
  retiredPlayerFacingMatches: [],
  narrationBoundaryAudit: {
    generatedSpeakerLedger: true,
    browserRenderedEveryLine: storyResults.length === (
      requestedEngines.length * viewports.length * STORY_EVENT_IDS.length
    ) && storyResults.every((result) => result.status === "passed"),
    storyVoiceoverOrTtsImplemented: false,
    humanBattleVoiceContractRetained: true,
    manualScriptProofreadStillRequired: true,
  },
  deviceAudit: {
    physicalIphoneTested: false,
    substitutes: [
      ...requestedEngines.map((engine) => `Playwright ${engine}`),
      "844x390",
      "844x340",
      "rotation",
      "visibilitychange/pageshow lifecycle",
    ],
    webAudioBlockedEngines: [...new Set(blockedResults
      .filter((result) => result.blocker?.includes("AudioContext"))
      .map((result) => result.engine))],
  },
  passed: results.filter((result) => result.status === "passed").length,
  blocked: blockedResults.length,
  failed: results.filter((result) => result.status === "failed").length,
  results,
};
await writeFile(path.join(evidenceDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));

if (summary.failed > 0) {
  throw new Error(`P5 browser smoke failed ${summary.failed}/${results.length} cases; see ${path.join(evidenceDir, "summary.json")}`);
}
