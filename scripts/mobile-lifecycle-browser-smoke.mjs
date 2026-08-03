import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { dismissInstallOffer } from "./pwa-gate-qa.mjs";
import {
  classifyRequestFailure,
  isExpectedNavigationTeardownPageError,
  normalizeLifecycleDiagnostics,
} from "./mobile-lifecycle-diagnostics.mjs";

const baseUrl = new URL(process.env.MOBILE_LIFECYCLE_QA_BASE_URL
  ?? process.env.COMBAT_PRESENTATION_QA_BASE_URL
  ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Mobile lifecycle QA is local-only; refusing ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const engines = (process.env.MOBILE_LIFECYCLE_QA_ENGINES ?? "chromium,webkit")
  .split(",")
  .map((engine) => engine.trim())
  .filter(Boolean);
const unknownEngines = engines.filter((engine) => !browserTypes[engine]);
if (unknownEngines.length > 0) {
  throw new Error(`Unknown MOBILE_LIFECYCLE_QA_ENGINES: ${unknownEngines.join(", ")}`);
}
const runMode = process.env.MOBILE_LIFECYCLE_QA_MODE ?? "gate";
if (!["gate", "diagnostic"].includes(runMode)) {
  throw new Error(`Unknown MOBILE_LIFECYCLE_QA_MODE: ${runMode}`);
}

const viewports = [
  { width: 844, height: 390 },
  { width: 844, height: 340 },
];
const timeout = Math.max(8_000, Number(process.env.MOBILE_LIFECYCLE_QA_TIMEOUT_MS) || 24_000);
const backgroundHoldMs = Math.max(
  800,
  Math.min(5_000, Number(process.env.MOBILE_LIFECYCLE_QA_BACKGROUND_MS) || 1_200),
);
const deviceScaleFactor = Math.max(
  1,
  Math.min(4, Number(process.env.MOBILE_LIFECYCLE_QA_DEVICE_SCALE_FACTOR) || 3),
);
const evidenceDir = path.resolve(
  process.env.MOBILE_LIFECYCLE_QA_EVIDENCE_DIR ?? "outputs/mobile-lifecycle-browser-smoke",
);
const results = [];

await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function caseUrl() {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({
    qa: "mission",
    stage: "3",
    state: "start",
    safe: "iphone-landscape",
  }).toString();
  return String(url);
}

function diagnosticsFor(page) {
  const diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    rawRequestFailures: [],
    rawRequestFailureDetails: [],
    navigationTeardownRequestFailures: [],
    httpErrors: [],
    warnings: [],
    rawWarnings: [],
    expectedNavigationTeardownPageErrors: [],
    navigationWindows: [],
    navigation: {
      nextId: 0,
      nextGeneration: 0,
      currentGeneration: 0,
      active: null,
      inFlightRequestIds: [],
    },
  };
  const requestMetadataByObject = new WeakMap();
  const requestMetadataById = new Map();
  const frameIds = new WeakMap();
  const frameGenerations = new Map();
  let nextRequestId = 0;
  let nextFrameId = 0;
  const frameIdFor = (frame) => {
    if (!frame) return null;
    const existing = frameIds.get(frame);
    if (existing) return existing;
    const id = `frame-${++nextFrameId}`;
    frameIds.set(frame, id);
    return id;
  };
  const frameForRequest = (request) => {
    try {
      return request.frame();
    } catch {
      return null;
    }
  };
  const requestIsNavigation = (request) => {
    try {
      return request.isNavigationRequest() === true;
    } catch {
      return false;
    }
  };
  const requestInitiator = (request) => {
    try {
      return typeof request.initiator === "function" ? request.initiator() : null;
    } catch {
      return null;
    }
  };
  const syncInFlightRequestIds = () => {
    diagnostics.navigation.inFlightRequestIds = [...requestMetadataById.values()]
      .filter((metadata) => metadata.inFlight)
      .map((metadata) => metadata.requestId);
  };
  const addStartedRequest = (navigationWindow, requestId) => {
    if (!navigationWindow || !requestId || navigationWindow.startedRequestIds.includes(requestId)) return;
    navigationWindow.startedRequestIds.push(requestId);
  };
  const markFrameNavigationCommit = (frame) => {
    const frameId = frameIdFor(frame);
    if (!frameId) return;
    const active = diagnostics.navigation.active;
    if (active && active.targetFrameId === frameId) {
      frameGenerations.set(frameId, active.generation);
      diagnostics.navigation.currentGeneration = active.generation;
      for (const metadata of requestMetadataById.values()) {
        if (metadata.inFlight
          && metadata.navigationWindowIdAtStart === active.id
          && metadata.frameId === frameId) {
          addStartedRequest(active, metadata.requestId);
        }
      }
      return;
    }
    const generation = diagnostics.navigation.nextGeneration + 1;
    diagnostics.navigation.nextGeneration = generation;
    diagnostics.navigation.currentGeneration = generation;
    frameGenerations.set(frameId, generation);
  };
  Object.defineProperty(diagnostics, "frameIdFor", { value: frameIdFor });
  page.on("framenavigated", markFrameNavigationCommit);
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
    if (message.type() === "warning") {
      const text = message.text();
      diagnostics.rawWarnings.push(text);
      diagnostics.warnings.push(text);
    }
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error)));
  page.on("request", (request) => {
    const frame = frameForRequest(request);
    const frameId = frameIdFor(frame);
    const active = diagnostics.navigation.active;
    const frameGenerationAtStart = frameId ? frameGenerations.get(frameId) ?? null : null;
    const isNavigationRequest = requestIsNavigation(request);
    const metadata = {
      requestId: `request-${++nextRequestId}`,
      url: request.url(),
      resourceType: request.resourceType(),
      startedAt: Date.now(),
      navigationGeneration: active?.generation ?? frameGenerationAtStart ?? diagnostics.navigation.currentGeneration,
      navigationWindowIdAtStart: active?.id ?? null,
      frameId,
      frameUrlAtStart: frame?.url?.() ?? null,
      frameGenerationAtStart,
      isNavigationRequest,
      initiator: requestInitiator(request),
      inFlight: true,
    };
    requestMetadataByObject.set(request, metadata);
    requestMetadataById.set(metadata.requestId, metadata);
    if (active
      && active.targetFrameId === frameId
      && (isNavigationRequest || frameGenerationAtStart === active.generation)) {
      addStartedRequest(active, metadata.requestId);
    }
    syncInFlightRequestIds();
  });
  const markRequestSettled = (request) => {
    const metadata = requestMetadataByObject.get(request);
    if (!metadata) return;
    metadata.inFlight = false;
    syncInFlightRequestIds();
  };
  page.on("requestfinished", markRequestSettled);
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    const entry = String(request.url()) + " :: " + failure;
    const occurredAt = Date.now();
    const navigationWindow = diagnostics.navigation.active;
    const metadata = requestMetadataByObject.get(request) ?? null;
    const details = {
      requestId: metadata?.requestId ?? null,
      url: request.url(),
      failure,
      resourceType: request.resourceType(),
      startedAt: metadata?.startedAt ?? null,
      occurredAt,
      navigationGeneration: metadata?.navigationGeneration ?? null,
      navigationIdAtStart: metadata?.navigationWindowIdAtStart ?? null,
      frameId: metadata?.frameId ?? null,
      frameUrlAtStart: metadata?.frameUrlAtStart ?? null,
      isNavigationRequest: metadata?.isNavigationRequest ?? false,
      initiator: metadata?.initiator ?? null,
    };
    diagnostics.rawRequestFailures.push(entry);
    diagnostics.rawRequestFailureDetails.push(details);
    const classification = classifyRequestFailure({
      failure,
      occurredAt,
      requestId: details.requestId,
      requestMetadata: metadata,
      navigationWindow,
    });
    if (classification === "navigation-teardown") {
      diagnostics.navigationTeardownRequestFailures.push({ ...details, classification });
    } else {
      diagnostics.requestFailures.push(entry);
    }
    markRequestSettled(request);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

function beginNavigationWindow(diagnostics, kind, { targetFrameId = null } = {}) {
  const window = {
    id: diagnostics.navigation.nextId + 1,
    kind,
    generation: diagnostics.navigation.nextGeneration + 1,
    startedAt: Date.now(),
    endedAt: null,
    targetFrameId,
    inFlightRequestIds: [...diagnostics.navigation.inFlightRequestIds],
    startedRequestIds: [],
  };
  diagnostics.navigation.nextId = window.id;
  diagnostics.navigation.nextGeneration = window.generation;
  diagnostics.navigation.currentGeneration = window.generation;
  diagnostics.navigation.active = window;
  return window.id;
}

function endNavigationWindow(diagnostics, id) {
  const active = diagnostics.navigation.active;
  if (!active || active.id !== id) return;
  active.endedAt = Date.now();
  diagnostics.navigationWindows.push({
    ...active,
    inFlightRequestIds: [...active.inFlightRequestIds],
    startedRequestIds: [...active.startedRequestIds],
  });
  diagnostics.navigation.active = null;
}

function normalizedDiagnostics(diagnostics, audioCapability = {}) {
  const normalized = normalizeLifecycleDiagnostics(diagnostics, {
    audioContextConstructorAvailable: audioCapability.constructorAvailable === true,
    decodeApiAvailable: audioCapability.decodeApiAvailable === true,
    expectedNavigationTeardownPageErrors: diagnostics.expectedNavigationTeardownPageErrors ?? [],
  });
  return {
    ...normalized,
    warnings: normalized.warnings.filter(
      (warning) => !warning.includes("was preloaded using link preload but not used")
        && !warning.includes("The AudioContext was not allowed to start."),
    ),
  };
}

async function readRuntime(page) {
  return page.evaluate(() => ({
    visibility: document.visibilityState,
    performance: window.__ASHFALL_BATTLE_QA__?.getPerformanceSnapshot?.() ?? null,
    battle: window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null,
    audio: window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.() ?? null,
  }));
}

async function exerciseGraphicsQuality(page, label) {
  await page.keyboard.press("p");
  const control = page.locator("[data-graphics-quality-control='true']");
  await control.waitFor({ state: "visible", timeout });
  const initialMode = await control.getAttribute("data-graphics-quality-requested");
  invariant(initialMode === "high",
    `${label} player-facing graphics control did not start at High`);
  const firstNextMode = initialMode === "auto" ? "high" : initialMode === "high" ? "power-save" : "auto";
  await control.click();
  await page.waitForFunction(
    (mode) => document.documentElement.dataset.graphicsQualityRequested === mode,
    firstNextMode,
    { timeout },
  );
  await page.keyboard.press("p");
  await page.waitForFunction(
    () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().paused === false,
    undefined,
    { timeout },
  );

  const samples = [];
  for (const requestedMode of ["high", "power-save", "auto"]) {
    await page.evaluate((mode) => {
      window.__ASHFALL_BATTLE_QA__?.setGraphicsQuality?.(mode);
    }, requestedMode);
    await page.waitForFunction(
      (mode) => document.documentElement.dataset.graphicsQualityRequested === mode,
      requestedMode,
      { timeout },
    );
    const before = await readRuntime(page);
    await page.waitForTimeout(700);
    const after = await readRuntime(page);
    const canvas = await page.locator("canvas").evaluate((element) => ({
      dpr: Number(element.dataset.dpr),
      graphicsQuality: element.dataset.graphicsQuality,
      renderHz: Number(element.dataset.renderHz),
    }));
    const profile = after.performance.graphicsProfile;
    const simulationDelta = after.performance.simulationTicks - before.performance.simulationTicks;
    const renderDelta = after.performance.renderFrames - before.performance.renderFrames;
    invariant(profile.requestedMode === requestedMode,
      `${label} ${requestedMode} request resolved from stale settings`);
    invariant(profile.simulationHz === 60,
      `${label} ${requestedMode} changed simulation cadence to ${profile.simulationHz}`);
    invariant(profile.renderHz <= 60,
      `${label} ${requestedMode} exceeded the 60fps render ceiling`);
    invariant(canvas.dpr <= profile.dprCap,
      `${label} ${requestedMode} canvas DPR ${canvas.dpr} exceeded ${profile.dprCap}`);
    invariant(simulationDelta > 0 && renderDelta > 0,
      `${label} ${requestedMode} did not advance simulation/render`);
    invariant(renderDelta <= simulationDelta + 2,
      `${label} ${requestedMode} rendered ${renderDelta} frames for ${simulationDelta} simulation ticks`);
    const renderObjectPools = after.performance.renderObjectPools;
    invariant(renderObjectPools && Object.values(renderObjectPools).every((pool) => (
      pool.active >= 0
      && pool.active <= pool.capacity
      && pool.available >= 0
      && pool.available <= pool.capacity
    )), `${label} ${requestedMode} render object pool exceeded its bound`);
    if (requestedMode === "power-save") {
      invariant(profile.renderHz === 30 && profile.dprCap === 1,
        `${label} power-save profile was not bounded to 30fps/DPR1`);
      invariant(simulationDelta >= renderDelta * 1.55,
        `${label} power-save did not decouple 60Hz simulation from rendering (${simulationDelta}/${renderDelta})`);
    }
    samples.push({
      requestedMode,
      profile,
      canvas,
      simulationDelta,
      renderDelta,
      staticBackgroundCache: after.performance.staticBackgroundCache,
      renderObjectPools,
    });
  }
  invariant(samples.at(-1).staticBackgroundCache.ready === true,
    `${label} static battlefield cache was not created`);
  invariant(samples.at(-1).staticBackgroundCache.hits > 0,
    `${label} static battlefield cache had no reuse hits`);
  return samples;
}

async function unlockAudio(page) {
  const current = await readRuntime(page);
  const capability = await page.evaluate(() => {
    const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
    return {
      constructorType: typeof AudioContextConstructor,
      constructorAvailable: typeof AudioContextConstructor === "function",
      decodeApiAvailable: typeof AudioContextConstructor === "function"
        && typeof AudioContextConstructor.prototype?.decodeAudioData === "function",
    };
  });
  if (current.audio?.audioState === "running" && current.audio?.contextState === "running") {
    return {
      available: true,
      ...capability,
      diagnostics: current.audio,
    };
  }
  const button = page.locator(".enable-audio-button");
  await button.waitFor({ state: "visible", timeout });
  await button.click({ timeout });
  try {
    await page.waitForFunction(
      () => {
        const audio = window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.();
        return audio?.audioState === "running" && audio?.contextState === "running";
      },
      undefined,
      { timeout: Math.min(timeout, 5_000) },
    );
  } catch {
    // Windows headless WebKit can expose the constructor while refusing to
    // create a usable AudioContext. Record that capability gap; Chromium and
    // mixer unit tests remain the executable audio lifecycle gates.
  }
  const diagnostics = (await readRuntime(page)).audio;
  return {
    available: diagnostics?.audioState === "running" && diagnostics?.contextState === "running",
    ...capability,
    diagnostics,
  };
}

async function waitForInitialSceneAudio(page, { requireAudio }) {
  if (!requireAudio) return;
  await page.waitForFunction(
    () => {
      const audio = window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.();
      return audio?.desiredSceneId
        && audio.sceneId === audio.desiredSceneId
        && audio.activeSceneVoices > 0;
    },
    undefined,
    { timeout },
  );
}

async function enterBackground(page, context, { requireAudio }) {
  const background = await context.newPage();
  try {
    await background.goto("about:blank");
    await background.bringToFront();
    try {
      await page.waitForFunction(
        () => document.visibilityState === "hidden",
        undefined,
        { timeout: Math.min(timeout, 1_500) },
      );
      const hiddenStart = await readRuntime(page);
      await background.waitForTimeout(backgroundHoldMs);
      return {
        mode: "native-background-tab",
        background,
        hiddenStart,
        hiddenEnd: await readRuntime(page),
      };
    } catch {
      await page.bringToFront();
      await page.evaluate(() => {
        let syntheticVisibilityState = document.visibilityState;
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => syntheticVisibilityState,
        });
        window.__MOBILE_LIFECYCLE_SET_VISIBILITY__ = (state) => {
          syntheticVisibilityState = state;
          document.dispatchEvent(new Event("visibilitychange"));
        };
        window.__MOBILE_LIFECYCLE_SET_VISIBILITY__("hidden");
      });
      await page.waitForFunction(
        (audioRequired) => {
          const performanceSnapshot = window.__ASHFALL_BATTLE_QA__?.getPerformanceSnapshot?.();
          const audio = window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.();
          return document.visibilityState === "hidden"
            && performanceSnapshot?.backgroundStartedAt !== null
            && audio?.lifecycleHidden === true
            && (!audioRequired || audio?.contextState === "suspended");
        },
        requireAudio,
        { timeout },
      );
      const hiddenStart = await readRuntime(page);
      await page.waitForTimeout(backgroundHoldMs);
      return {
        mode: "synthetic-headless-visibility",
        background,
        hiddenStart,
        hiddenEnd: await readRuntime(page),
      };
    }
  } catch (error) {
    await background.close().catch(() => undefined);
    throw error;
  }
}

async function returnToForeground(page, backgroundState, { requireAudio }) {
  const { mode, background } = backgroundState;
  if (mode === "native-background-tab") {
    await page.bringToFront();
    await page.waitForFunction(
      () => document.visibilityState === "visible",
      undefined,
      { timeout },
    );
  } else {
    await page.evaluate(() => {
      window.__MOBILE_LIFECYCLE_SET_VISIBILITY__?.("visible");
    });
  }
  await page.waitForFunction(
    (audioRequired) => {
      const audio = window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.();
      return document.visibilityState === "visible"
        && audio?.lifecycleHidden === false
        && (!audioRequired || audio?.contextState === "running");
    },
    requireAudio,
    { timeout },
  );
  await page.waitForTimeout(350);
  const foreground = await readRuntime(page);
  if (mode !== "native-background-tab") {
    await page.evaluate(() => {
      delete window.__MOBILE_LIFECYCLE_SET_VISIBILITY__;
      delete document.visibilityState;
    });
  }
  await background.close();
  return foreground;
}

async function exercisePageTransition(page, { requireAudio }) {
  const before = await readRuntime(page);
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
  });
  await page.waitForFunction(
    (audioRequired) => {
      const performanceSnapshot = window.__ASHFALL_BATTLE_QA__?.getPerformanceSnapshot?.();
      const audio = window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.();
      return performanceSnapshot?.backgroundStartedAt !== null
        && audio?.lifecycleHidden === true
        && (!audioRequired || audio?.contextState === "suspended");
    },
    requireAudio,
    { timeout },
  );
  const hiddenStart = await readRuntime(page);
  await page.waitForTimeout(Math.min(backgroundHoldMs, 600));
  const hiddenEnd = await readRuntime(page);
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await page.waitForFunction(
    (audioRequired) => {
      const performanceSnapshot = window.__ASHFALL_BATTLE_QA__?.getPerformanceSnapshot?.();
      const audio = window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.();
      return performanceSnapshot?.backgroundStartedAt === null
        && audio?.lifecycleHidden === false
        && (!audioRequired || audio?.contextState === "running");
    },
    requireAudio,
    { timeout },
  );
  await page.waitForTimeout(250);
  const after = await readRuntime(page);
  return {
    before,
    hiddenStart,
    hiddenEnd,
    after,
    deltas: {
      hiddenSimulationDelta: hiddenEnd.performance.simulationTicks - hiddenStart.performance.simulationTicks,
      hiddenRenderDelta: hiddenEnd.performance.renderFrames - hiddenStart.performance.renderFrames,
      hiddenBattleTimeDelta: hiddenEnd.battle.time - hiddenStart.battle.time,
      resumedSimulationDelta: after.performance.simulationTicks - hiddenEnd.performance.simulationTicks,
      resumedBattleTimeDelta: after.battle.time - hiddenEnd.battle.time,
      contextCreateDelta: after.audio.contextCreateCount - before.audio.contextCreateCount,
    },
  };
}

async function exerciseRealBackForward(page, { requireAudio, diagnostics }) {
  const before = await readRuntime(page);
  const pageErrorsBeforeNavigation = diagnostics.pageErrors.length;
  const targetFrameId = diagnostics.frameIdFor?.(page.mainFrame()) ?? null;
  const navigationId = beginNavigationWindow(diagnostics, "away-back-forward", { targetFrameId });
  try {
  const marker = `bfcache-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await page.evaluate((value) => {
    window.__ASHFALL_BFCACHE_PROBE__ = {
      marker: value,
      pagehidePersisted: null,
      pageshowPersisted: null,
    };
    window.addEventListener("pagehide", (event) => {
      if (window.__ASHFALL_BFCACHE_PROBE__?.marker === value) {
        window.__ASHFALL_BFCACHE_PROBE__.pagehidePersisted = event.persisted;
      }
    }, { once: true });
    window.addEventListener("pageshow", (event) => {
      if (window.__ASHFALL_BFCACHE_PROBE__?.marker === value) {
        window.__ASHFALL_BFCACHE_PROBE__.pageshowPersisted = event.persisted;
      }
    });
  }, marker);
  const awayUrl = new URL(baseUrl);
  awayUrl.search = new URLSearchParams({ qa: "title", lifecycle: "away" }).toString();
  await page.goto(String(awayUrl), { waitUntil: "domcontentloaded", timeout });
  await dismissInstallOffer(page, { timeout: Math.min(timeout, 5_000) });
  await page.goBack({ waitUntil: "domcontentloaded", timeout });
  await dismissInstallOffer(page, { timeout: Math.min(timeout, 5_000) });
  await page.waitForFunction(
    () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().screen === "battle",
    undefined,
    { timeout },
  );
  await page.waitForTimeout(300);
  const probe = await page.evaluate((value) => ({
    state: window.__ASHFALL_BFCACHE_PROBE__?.marker === value
      ? window.__ASHFALL_BFCACHE_PROBE__
      : null,
    navigationType: performance.getEntriesByType("navigation")[0]?.type ?? null,
  }), marker);
  const after = await readRuntime(page);
  const navigationPageErrors = diagnostics.pageErrors.slice(pageErrorsBeforeNavigation)
    .filter(isExpectedNavigationTeardownPageError);
  diagnostics.expectedNavigationTeardownPageErrors.push(...navigationPageErrors);
  const persisted = probe.state?.pagehidePersisted === true
    && probe.state?.pageshowPersisted === true;
  if (persisted) {
    invariant(after.performance.simulationTicks > before.performance.simulationTicks,
      "BFCache pageshow did not resume simulation");
    invariant(after.audio.contextCreateCount === before.audio.contextCreateCount,
      "BFCache pageshow created a replacement AudioContext");
    if (requireAudio) {
      invariant(after.audio.contextState === "running", "BFCache pageshow did not resume AudioContext");
      invariant(after.audio.activeSceneVoices === before.audio.activeSceneVoices,
        "BFCache pageshow changed scene voice count");
    }
  }
  return {
    persisted,
    pagehidePersisted: probe.state?.pagehidePersisted ?? null,
    pageshowPersisted: probe.state?.pageshowPersisted ?? null,
    navigationType: probe.navigationType,
    contextCreateDelta: after.audio.contextCreateCount - before.audio.contextCreateCount,
  };
  } finally {
    endNavigationWindow(diagnostics, navigationId);
  }
}

for (const engine of engines) {
  let browser;
  try {
    browser = await browserTypes[engine].launch({ headless: true });
  } catch (error) {
    results.push({ engine, status: "failed", error: `browser launch failed: ${String(error)}` });
    continue;
  }

  try {
    for (const viewport of viewports) {
      const label = `${engine}-${viewport.width}x${viewport.height}`;
      const context = await browser.newContext({ viewport, deviceScaleFactor });
      const page = await context.newPage();
      const diagnostics = diagnosticsFor(page);
      const result = {
        engine,
        viewport,
        deviceScaleFactor,
        url: caseUrl(),
        status: "failed",
      };
      try {
        const response = await page.goto(result.url, { waitUntil: "domcontentloaded", timeout });
        invariant(response?.ok(), `navigation failed: HTTP ${response?.status()}`);
        await dismissInstallOffer(page, { timeout: Math.min(timeout, 5_000) });
        await page.waitForFunction(
          () => {
            const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
            return snapshot?.screen === "battle" && snapshot?.running === true;
          },
          undefined,
          { timeout },
        );
        const audioCapability = await unlockAudio(page);
        const requireAudio = audioCapability.available;
        invariant(engine !== "chromium" || requireAudio,
          `${label} Chromium AudioContext lifecycle capability unavailable`);
        await waitForInitialSceneAudio(page, { requireAudio });
        await page.waitForTimeout(250);
        const before = await readRuntime(page);
        invariant(before.performance && before.battle && before.audio, "QA diagnostics unavailable");
        const graphicsQuality = await exerciseGraphicsQuality(page, label);

        const backgroundState = await enterBackground(page, context, { requireAudio });
        const hiddenStart = backgroundState.hiddenStart;
        const hidden = backgroundState.hiddenEnd;
        const after = await returnToForeground(page, backgroundState, { requireAudio });
        const pageTransition = await exercisePageTransition(page, { requireAudio });
        const backForward = await exerciseRealBackForward(page, { requireAudio, diagnostics });

        const hiddenSimulationDelta = hidden.performance.simulationTicks - hiddenStart.performance.simulationTicks;
        const hiddenRenderDelta = hidden.performance.renderFrames - hiddenStart.performance.renderFrames;
        const hiddenBattleTimeDelta = hidden.battle.time - hiddenStart.battle.time;
        const resumedSimulationDelta = after.performance.simulationTicks - hidden.performance.simulationTicks;
        const resumedBattleTimeDelta = after.battle.time - hidden.battle.time;
        const backgroundDurationDelta = after.performance.backgroundDurationMs
          - before.performance.backgroundDurationMs;

        invariant(hidden.visibility === "hidden", `${label} did not remain hidden during hold`);
        invariant(hidden.audio.lifecycleHidden === true, `${label} mixer did not enter hidden lifecycle`);
        if (requireAudio) {
          invariant(hidden.audio.contextState === "suspended", `${label} AudioContext was not suspended`);
        }
        invariant(hiddenSimulationDelta <= 1, `${label} advanced ${hiddenSimulationDelta} simulation ticks while hidden`);
        invariant(hiddenRenderDelta <= 1, `${label} rendered ${hiddenRenderDelta} frames while hidden`);
        invariant(hiddenBattleTimeDelta <= 0.05, `${label} advanced ${hiddenBattleTimeDelta}s of battle time while hidden`);
        invariant(backgroundDurationDelta >= backgroundHoldMs * 0.75,
          `${label} recorded only ${backgroundDurationDelta}ms of ${backgroundHoldMs}ms background time`);
        invariant(after.performance.visibilityTransitions >= before.performance.visibilityTransitions + 2,
          `${label} did not record hide/show lifecycle transitions`);
        invariant(resumedSimulationDelta > 0, `${label} simulation did not resume`);
        invariant(resumedBattleTimeDelta > 0, `${label} battle time did not resume`);
        invariant(after.audio.contextCreateCount === before.audio.contextCreateCount,
          `${label} changed AudioContext count after foregrounding`);
        invariant(after.audio.duplicateLoopInstanceKeys.length === 0,
          `${label} duplicated audio loops: ${JSON.stringify(after.audio.duplicateLoopInstanceKeys)}`);
        if (requireAudio) {
          invariant(after.audio.activeSceneVoices === before.audio.activeSceneVoices,
            `${label} changed scene voice count ${before.audio.activeSceneVoices} -> ${after.audio.activeSceneVoices}`);
        }
        invariant(pageTransition.deltas.hiddenSimulationDelta <= 1,
          `${label} pagehide advanced ${pageTransition.deltas.hiddenSimulationDelta} simulation ticks`);
        invariant(pageTransition.deltas.hiddenRenderDelta <= 1,
          `${label} pagehide rendered ${pageTransition.deltas.hiddenRenderDelta} frames`);
        invariant(pageTransition.deltas.hiddenBattleTimeDelta <= 0.05,
          `${label} pagehide advanced ${pageTransition.deltas.hiddenBattleTimeDelta}s of battle time`);
        invariant(pageTransition.deltas.resumedSimulationDelta > 0,
          `${label} pageshow did not resume simulation`);
        invariant(pageTransition.deltas.resumedBattleTimeDelta > 0,
          `${label} pageshow did not resume battle time`);
        invariant(pageTransition.deltas.contextCreateDelta === 0,
          `${label} pageshow created a new AudioContext`);
        invariant(pageTransition.after.audio.duplicateLoopInstanceKeys.length === 0,
          `${label} pageshow duplicated audio loops`);

        const cleanDiagnostics = normalizedDiagnostics(diagnostics, audioCapability);
        for (const kind of ["consoleErrors", "pageErrors", "requestFailures", "httpErrors", "audioFailures"]) {
          const entries = cleanDiagnostics[kind];
          invariant(entries.length === 0, `${label} ${kind}: ${JSON.stringify(entries)}`);
        }
        await page.screenshot({ path: path.join(evidenceDir, `${label}.png`) });
        const coverageGaps = [];
        if (!requireAudio) coverageGaps.push("headless-audio-context-unavailable");
        if (backgroundState.mode !== "native-background-tab") {
          coverageGaps.push("native-visibility-transition-unavailable");
        }
        if (!backForward.persisted) coverageGaps.push("native-bfcache-not-observed");
        if (!backForward.persisted && requireAudio) {
          coverageGaps.push("non-bfcache-reload-requires-new-audio-gesture");
        }
        Object.assign(result, {
          status: coverageGaps.length === 0 ? "passed" : "passed-with-capability-gaps",
          mode: backgroundState.mode,
          coverageGaps,
          backgroundHoldMs,
          audioCapability: {
            constructorType: audioCapability.constructorType,
            constructorAvailable: audioCapability.constructorAvailable,
            decodeApiAvailable: audioCapability.decodeApiAvailable,
            lifecycleExecutable: requireAudio,
            initialFailureState: requireAudio ? null : audioCapability.diagnostics,
          },
          deltas: {
            hiddenSimulationDelta,
            hiddenRenderDelta,
            hiddenBattleTimeDelta,
            resumedSimulationDelta,
            resumedBattleTimeDelta,
            backgroundDurationDelta,
          },
          graphicsQuality,
          pageTransition: pageTransition.deltas,
          backForward,
          audio: {
            contextCreateCount: after.audio.contextCreateCount,
            activeSceneVoices: after.audio.activeSceneVoices,
            duplicateLoopInstanceKeys: after.audio.duplicateLoopInstanceKeys,
          },
          diagnostics: cleanDiagnostics,
        });
      } catch (error) {
        result.error = String(error);
        result.diagnostics = normalizedDiagnostics(diagnostics);
        try {
          result.failureState = await readRuntime(page);
          await page.screenshot({ path: path.join(evidenceDir, `${label}-FAILED.png`) });
        } catch {
          // The page may have failed before the QA bridges were ready.
        }
      } finally {
        results.push(result);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

const summary = {
  baseUrl: String(baseUrl),
  generatedAt: new Date().toISOString(),
  runMode,
  passed: results.filter(({ status }) => status === "passed").length,
  passedWithCapabilityGaps: results.filter(({ status }) => status === "passed-with-capability-gaps").length,
  failed: results.filter(({ status }) => status === "failed").length,
  results,
};
await writeFile(path.join(evidenceDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));

if (summary.failed > 0 || (runMode === "gate" && summary.passedWithCapabilityGaps > 0)) {
  throw new Error(
    `Mobile lifecycle browser smoke failed or was capability-blocked `
    + `(failed=${summary.failed}, gaps=${summary.passedWithCapabilityGaps}, mode=${runMode}); `
    + `see ${path.join(evidenceDir, "summary.json")}`,
  );
}
