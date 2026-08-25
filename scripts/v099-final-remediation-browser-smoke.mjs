import { createHash } from "node:crypto";
import { appendFile, readFile, readdir, stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import {
  MOBILE_BATTLE_HUD_TYPOGRAPHY,
  mobileBattleHudLayout,
} from "../app/battleHudLayout.js";
import {
  CRAWLER_DEPLOYMENT_CHECKPOINTS,
  CRAWLER_FOREGROUND_CLEAR_PROGRESS,
  crawlerDeploymentUnitFamily,
} from "../app/crawlerDeployment.js";
import {
  CRAWLER_AIRSTRIKE_SPRITE_PHASES,
  CRAWLER_BARRAGE_SPRITE_PHASES,
  V099_CRAWLER_RUNTIME_PROFILE,
  crawlerAirstrikeSpritePhase,
  crawlerBarrageSpritePhase,
  resolveCrawlerEquipmentFrame,
} from "../app/crawlerEquipmentSprites.js";
import { AIRSTRIKE_DEF, CRAWLER_BARRAGE_DEF } from "../app/gameRules.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { dismissInstallOffer } from "./pwa-gate-qa.mjs";
import { createWebKitHostResourceTelemetry } from "./webkit-host-resource-telemetry.mjs";
import {
  classifySupersededAssetRequestFailures,
  reconcilePageClockRequestFailures,
} from "./v0995-qa-evidence-contract.mjs";

const baseUrl = new URL(
  process.env.V099_FINAL_REMEDIATION_QA_BASE_URL
    ?? process.env.V099_PRESENTATION_QA_BASE_URL
    ?? "http://127.0.0.1:4177/",
);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error(`Version 0.9.9.0 final-remediation QA is local-only; refusing ${baseUrl}`);
}

const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const browserTypes = { chromium: playwright.chromium, webkit: playwright.webkit };
const canonicalEngines = ["chromium", "webkit"];
const canonicalCaseTypes = ["hud", "crawler-equipment", "deployment"];
const canonicalHudStates = Object.freeze([
  "stage1-normal",
  "five-units",
  "deployment-banner",
  "manual-ability-banner",
  "objective-full",
  "support-disabled",
  "banner-bark-boss",
  "stage3-boss",
]);
const canonicalViewports = [
  { width: 667, height: 375 },
  { width: 736, height: 414 },
  { width: 844, height: 390 },
  { width: 844, height: 340 },
  { width: 932, height: 430 },
  { width: 1280, height: 720 },
];
const canonicalDeploymentUnits = Object.freeze([
  Object.freeze({ family: "hachi", kind: "scout" }),
  Object.freeze({ family: "mizuchi", kind: "ranger" }),
  Object.freeze({ family: "paisen", kind: "brawler" }),
  Object.freeze({ family: "crazy-king", kind: "crazy-king" }),
  Object.freeze({ family: "standard-human", kind: "kumaverson" }),
  Object.freeze({ family: "mayo-chan", kind: "mayo-chan" }),
  Object.freeze({ family: "tatara", kind: "brute" }),
  Object.freeze({ family: "standard-human", kind: "medic" }),
]);

function parseUniqueAxis(name, rawValue, allowedValues) {
  const values = rawValue.split(",").map((value) => value.trim()).filter(Boolean);
  if (values.length === 0) throw new Error(`${name} must not be empty`);
  if (new Set(values).size !== values.length) throw new Error(`${name} contains duplicate entries`);
  const unsupported = values.filter((value) => !allowedValues.includes(value));
  if (unsupported.length > 0) throw new Error(`${name} contains unsupported entries: ${unsupported.join(",")}`);
  return values;
}

const engines = parseUniqueAxis(
  "V099_FINAL_REMEDIATION_QA_ENGINES",
  process.env.V099_FINAL_REMEDIATION_QA_ENGINES ?? canonicalEngines.join(","),
  canonicalEngines,
);
const viewportKeys = parseUniqueAxis(
  "V099_FINAL_REMEDIATION_QA_VIEWPORTS",
  process.env.V099_FINAL_REMEDIATION_QA_VIEWPORTS ?? "667x375,736x414,844x390,844x340,932x430,1280x720",
  canonicalViewports.map(({ width, height }) => `${width}x${height}`),
);
const viewports = viewportKeys.map((key) => {
  const [width, height] = key.split("x").map(Number);
  return { width, height };
});
const deploymentKinds = parseUniqueAxis(
  "V099_FINAL_REMEDIATION_QA_DEPLOYMENT_UNITS",
  process.env.V099_FINAL_REMEDIATION_QA_DEPLOYMENT_UNITS
    ?? canonicalDeploymentUnits.map(({ kind }) => kind).join(","),
  canonicalDeploymentUnits.map(({ kind }) => kind),
);
const deploymentUnits = canonicalDeploymentUnits.filter(({ kind }) => deploymentKinds.includes(kind));
const caseTypes = parseUniqueAxis(
  "V099_FINAL_REMEDIATION_QA_CASES",
  process.env.V099_FINAL_REMEDIATION_QA_CASES ?? canonicalCaseTypes.join(","),
  canonicalCaseTypes,
);
const hudStateFilterActive = Object.hasOwn(process.env, "V099_FINAL_REMEDIATION_QA_HUD_STATES");
const hudStates = parseUniqueAxis(
  "V099_FINAL_REMEDIATION_QA_HUD_STATES",
  process.env.V099_FINAL_REMEDIATION_QA_HUD_STATES ?? canonicalHudStates.join(","),
  canonicalHudStates,
);
const timeout = Math.max(
  10_000,
  Number(process.env.V099_FINAL_REMEDIATION_QA_TIMEOUT_MS) || 30_000,
);
const DIAGNOSTIC_TRACE_INTERVAL_MS = 250;
const DIAGNOSTIC_TRACE_MAX_SAMPLES = 160;
const DEPLOYMENT_FIRST_FRAME_SAMPLE_INTERVAL_MS = 100;
const evidenceDir = path.resolve(
  process.env.V099_FINAL_REMEDIATION_QA_EVIDENCE_DIR
    ?? "docs/qa/v099/final-remediation/browser",
);
const results = [];
await mkdir(evidenceDir, { recursive: true });

function noOpLifecycleDiagnostics() {
  return {
    file: null,
    hostResourceTelemetry: null,
    setPhase: () => {},
    beginOperation: () => {},
    endOperation: () => {},
    event: () => {},
    attachBrowser: () => {},
    attachContext: () => {},
    attachPage: () => {},
    markPageCloseBegin: () => {},
    markContextCloseBegin: () => {},
    markBrowserCloseBegin: () => {},
    flush: async () => {},
  };
}

async function createLifecycleDiagnostics({ engine, viewport, caseType, name }) {
  if (engine !== "webkit") return noOpLifecycleDiagnostics();

  const filePath = path.join(evidenceDir, `${name}-${caseType}-lifecycle.jsonl`);
  await writeFile(filePath, "", "utf8");
  const hostResourceTelemetry = caseType === "deployment"
    ? await createWebKitHostResourceTelemetry({
      evidenceDir,
      label: `${name}-${caseType}`,
      referenceRoot: process.cwd(),
      metadata: {
        owner: "deployment-child",
        engine,
        viewport: `${viewport.width}x${viewport.height}`,
        caseType,
      },
    })
    : null;
  const startedAt = Date.now();
  const expectedPages = new WeakSet();
  const expectedContexts = new WeakSet();
  const pageDiagnostics = new WeakMap();
  let lastPage = null;
  let currentPhase = "initialization";
  let currentOperation = null;
  let lastSuccessfulMilestone = null;
  let normalCleanupStarted = false;
  let expectedBrowserClose = false;
  let writeQueue = Promise.resolve();
  let writeError = null;

  function pageIsClosed(page) {
    try {
      return page && typeof page.isClosed === "function" ? page.isClosed() : null;
    } catch {
      return null;
    }
  }

  function diagnosticsSnapshot(page) {
    const diagnostics = pageDiagnostics.get(page ?? lastPage);
    return diagnostics
      ? {
        consoleErrors: [...diagnostics.consoleErrors],
        pageErrors: [...diagnostics.pageErrors],
        requestFailures: [...diagnostics.requestFailures],
        httpErrors: [...diagnostics.httpErrors],
      }
      : null;
  }

  function record(event, { page = null, phase = currentPhase, milestone = null, ...fields } = {}) {
    if (milestone) lastSuccessfulMilestone = milestone;
    const entry = {
      timestamp: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
      engine,
      viewport: `${viewport.width}x${viewport.height}`,
      caseType,
      phase,
      currentPhase,
      event,
      pageIsClosed: pageIsClosed(page),
      pageDiagnostics: diagnosticsSnapshot(page),
      runnerResourceEvidenceDir: relativeEvidencePath(evidenceDir),
      normalCleanupStarted,
      lastSuccessfulMilestone,
      ...fields,
    };
    const line = `${JSON.stringify(entry)}\n`;
    writeQueue = writeQueue.then(() => appendFile(filePath, line, "utf8")).catch((error) => {
      writeError ??= error;
    });
    hostResourceTelemetry?.setContext({
      owner: "deployment-child",
      engine,
      viewport: `${viewport.width}x${viewport.height}`,
      caseType,
      phase: currentPhase,
      operationId: currentOperation?.operationId ?? "deployment-idle",
      operationStatus: currentOperation?.status ?? "idle",
      ...(currentOperation?.details ?? {}),
    });
    hostResourceTelemetry?.event(event, {
      phase,
      currentPhase,
      milestone,
      normalCleanupStarted,
      expected: fields.expected ?? null,
      unexpected: fields.unexpected ?? null,
    });
  }

  function setPhase(phase, milestone = null) {
    currentPhase = phase;
    record("phase changed", { phase, milestone });
  }

  function beginOperation(operationId, details = {}) {
    currentOperation = { operationId, status: "running", details };
    record("operation-begin", { operationId, operationStatus: "running", ...details });
  }

  function endOperation(operationId, status, details = {}) {
    if (currentOperation?.operationId !== operationId) {
      throw new Error(`deployment telemetry operation mismatch ${currentOperation?.operationId ?? "none"}/${operationId}`);
    }
    currentOperation = { ...currentOperation, status };
    record("operation-end", { operationId, operationStatus: status, ...details });
    if (status === "completed") {
      currentOperation = null;
      hostResourceTelemetry?.setContext({
        owner: "deployment-child",
        engine,
        viewport: `${viewport.width}x${viewport.height}`,
        caseType,
        phase: currentPhase,
        operationId: "deployment-idle",
        operationStatus: "idle",
      });
    }
  }

  function attachBrowser(browser) {
    expectedBrowserClose = false;
    normalCleanupStarted = false;
    browser.on("disconnected", () => {
      record("browser disconnected", {
        expected: expectedBrowserClose,
        unexpected: !expectedBrowserClose,
      });
    });
    record("browser launched");
  }

  function attachContext(context) {
    context.on("close", () => {
      const expected = expectedContexts.has(context) || normalCleanupStarted;
      record("context closed", { expected, unexpected: !expected });
    });
    record("context created");
  }

  function attachPage(page, diagnostics = null) {
    pageDiagnostics.set(page, diagnostics);
    lastPage = page;
    page.on("close", () => {
      const expected = expectedPages.has(page) || normalCleanupStarted;
      record("page close", { page, expected, unexpected: !expected });
    });
    page.on("crash", () => {
      record("page crash", { page, expected: false, unexpected: true });
    });
    page.on("pageerror", (error) => {
      record("pageerror", { page, error: String(error) });
    });
    record("page created", { page });
  }

  function markPageCloseBegin(page) {
    expectedPages.add(page);
    record("page close begin", { page, expected: true });
  }

  function markContextCloseBegin(context) {
    expectedContexts.add(context);
    normalCleanupStarted = true;
    record("context close begin");
  }

  function markBrowserCloseBegin() {
    expectedBrowserClose = true;
    normalCleanupStarted = true;
    record("browser close begin");
  }

  record("case start");
  return {
    file: relativeEvidencePath(filePath),
    hostResourceTelemetry: hostResourceTelemetry?.reference() ?? null,
    setPhase,
    beginOperation,
    endOperation,
    event: record,
    attachBrowser,
    attachContext,
    attachPage,
    markPageCloseBegin,
    markContextCloseBegin,
    markBrowserCloseBegin,
    flush: async () => {
      await writeQueue;
      if (writeError) throw new Error(`Lifecycle diagnostics could not be written: ${writeError}`);
      return await hostResourceTelemetry?.stop({
        event: "deployment-child-cleanup-complete",
        caseType,
      }) ?? null;
    },
  };
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function hostTurn(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function withDeploymentDiagnosticOperation(lifecycle, operationId, details, operation) {
  lifecycle?.beginOperation(operationId, details);
  try {
    const result = await operation();
    lifecycle?.endOperation(operationId, "completed", details);
    return result;
  } catch (error) {
    lifecycle?.endOperation(operationId, "failed", { ...details, error: String(error) });
    throw error;
  }
}

function relativeEvidencePath(filePath) {
  return path.relative(process.cwd(), filePath).replaceAll("\\", "/");
}

function safeAreaForViewport(viewport) {
  return viewport.width <= 960
    ? { top: 0, right: 44, bottom: 21, left: 44, preset: "iphone-landscape" }
    : { top: 0, right: 0, bottom: 0, left: 0, preset: null };
}

function caseUrl(qaMode, { stageNumber = 3, safeAreaPreset = null, finiteAssets = false } = {}) {
  const url = new URL(baseUrl);
  const parameters = { qa: qaMode };
  if (safeAreaPreset) parameters.safe = safeAreaPreset;
  if (qaMode === "mission") Object.assign(parameters, { stage: String(stageNumber), state: "start" });
  if (finiteAssets || (caseTypes.length === 1 && caseTypes[0] === "hud")) {
    parameters.qaHudFiniteAssets = "1";
  }
  url.search = new URLSearchParams(parameters).toString();
  return String(url);
}

function diagnosticsFor(page, lifecycle = null) {
  let active = true;
  let phase = "setup";
  const pageClockCalibrations = [];
  const requestStartedAt = new WeakMap();
  const pendingRequests = new Set();
  const diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    requestFailureDetails: [],
    httpErrors: [],
  };
  page.on("console", (message) => {
    if (active && message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    if (active) diagnostics.pageErrors.push(String(error));
  });
  page.on("request", (request) => {
    if (active) {
      requestStartedAt.set(request, Date.now());
      pendingRequests.add(request);
    }
  });
  page.on("requestfinished", (request) => {
    pendingRequests.delete(request);
  });
  page.on("requestfailed", (request) => {
    pendingRequests.delete(request);
    if (!active) return;
    const detail = {
      url: request.url(),
      errorText: request.failure()?.errorText ?? "unknown",
      startedAt: requestStartedAt.get(request) ?? Date.now(),
      failedAt: Date.now(),
      phase,
    };
    diagnostics.requestFailures.push(
      `${detail.url} :: ${detail.errorText}`,
    );
    diagnostics.requestFailureDetails.push(detail);
  });
  page.on("response", (response) => {
    if (active && response.status() >= 400) {
      diagnostics.httpErrors.push(`${response.status()} ${response.url()}`);
    }
  });
  lifecycle?.attachPage(page, diagnostics);
  return {
    diagnostics,
    calibratePageClock: async (label) => {
      const nodeBefore = Date.now();
      const pageNow = await page.evaluate(() => Date.now());
      const nodeAfter = Date.now();
      const sample = { label, nodeBefore, nodeAfter, pageNow };
      pageClockCalibrations.push(sample);
      return sample;
    },
    beginPostReadyObservation: async () => {
      const nodeBefore = Date.now();
      const pageNow = await page.evaluate(() => Date.now());
      const nodeAfter = Date.now();
      pageClockCalibrations.push({ label: "terminal-ready", nodeBefore, nodeAfter, pageNow });
      const setup = Object.fromEntries(Object.entries(diagnostics).map(([key, entries]) => [key, [...entries]]));
      const reconciled = reconcilePageClockRequestFailures({
        failures: setup.requestFailureDetails,
        calibrations: pageClockCalibrations,
      });
      setup.requestFailureDetails = reconciled.failures;
      for (const entries of Object.values(diagnostics)) entries.length = 0;
      phase = "post-ready";
      return {
        boundaryAt: pageNow,
        diagnostics: setup,
        pageClockCalibrations: reconciled.calibrations,
      };
    },
    traceCounts: () => ({
      consoleErrorCount: diagnostics.consoleErrors.length,
      pageErrorCount: diagnostics.pageErrors.length,
      requestFailureCount: diagnostics.requestFailures.length,
      httpErrorCount: diagnostics.httpErrors.length,
      pendingRequestCount: pendingRequests.size,
    }),
    stop: () => { active = false; },
  };
}

function diagnosticsClean(diagnostics) {
  return Object.values(diagnostics).every((entries) => entries.length === 0);
}

function createBoundedTrace({ page, readSample, automaticInterval = true }) {
  const startedAt = Date.now();
  const samples = [];
  let active = true;
  let inFlight = null;
  let lastAttemptAt = null;
  let timer = null;
  let lastSampleError = null;
  let lastReadableSnapshot = null;
  let captureAttemptCount = 0;
  let overlapWaitCount = 0;
  const pageSignals = {
    close: false,
    crash: false,
    closeAtElapsedMs: null,
    crashAtElapsedMs: null,
  };

  const capture = async () => {
    if (!active || samples.length >= DIAGNOSTIC_TRACE_MAX_SAMPLES) return;
    captureAttemptCount += 1;
    if (inFlight) {
      overlapWaitCount += 1;
      await inFlight;
      return;
    }
    const attemptAt = Date.now();
    if (lastAttemptAt !== null && attemptAt - lastAttemptAt < DIAGNOSTIC_TRACE_INTERVAL_MS) return;
    lastAttemptAt = attemptAt;
    inFlight = (async () => {
      try {
        const sample = await readSample({ elapsedWallMs: attemptAt - startedAt });
        if (sample) {
          samples.push(sample);
          if (sample.readableSnapshot) lastReadableSnapshot = sample.readableSnapshot;
        }
      } catch (error) {
        lastSampleError = String(error);
      } finally {
        inFlight = null;
      }
    })();
    await inFlight;
  };

  page.on("close", () => {
    pageSignals.close = true;
    pageSignals.closeAtElapsedMs ??= Date.now() - startedAt;
  });
  page.on("crash", () => {
    pageSignals.crash = true;
    pageSignals.crashAtElapsedMs ??= Date.now() - startedAt;
  });
  if (automaticInterval) {
    void capture();
    timer = setInterval(() => { void capture(); }, DIAGNOSTIC_TRACE_INTERVAL_MS);
  }

  return {
    async stop() {
      active = false;
      if (timer) clearInterval(timer);
      timer = null;
      if (inFlight) await inFlight;
      return {
        sampleIntervalMs: DIAGNOSTIC_TRACE_INTERVAL_MS,
        maxSamples: DIAGNOSTIC_TRACE_MAX_SAMPLES,
        samples,
        sampleCount: samples.length,
        lastSample: samples.at(-1) ?? null,
        lastReadableSnapshot,
        lastSampleError,
        pageSignals,
        captureMode: automaticInterval ? "automatic-interval" : "cooperative-main-flow",
        captureAttemptCount,
        overlapWaitCount,
      };
    },
    capture,
  };
}

function setupRuntimeState(page) {
  return page.evaluate(() => {
    const shell = document.querySelector(".game-shell");
    const battleApi = window.__ASHFALL_BATTLE_QA__;
    const assetApi = window.__ASHFALL_ASSET_QA__;
    const rawSnapshot = battleApi?.getSnapshot?.() ?? null;
    const rawAssetState = assetApi?.getState?.() ?? null;
    const snapshot = rawSnapshot ? {
      screen: rawSnapshot.screen ?? null,
      running: rawSnapshot.running ?? null,
      paused: rawSnapshot.paused ?? null,
      over: rawSnapshot.over ?? null,
      time: rawSnapshot.time ?? null,
    } : null;
    const asset = rawAssetState ? {
      state: rawAssetState.state ?? null,
      generation: rawAssetState.generation ?? null,
      completed: rawAssetState.completed ?? null,
      total: rawAssetState.total ?? null,
      pending: rawAssetState.pending ?? null,
      failed: rawAssetState.failed ?? null,
      reason: rawAssetState.reason ?? rawAssetState.failureReason ?? null,
    } : null;
    const storyLine = document.querySelector(".dialogue-box")?.textContent?.trim() || null;
    const storyScreen = document.querySelector(".campaign-overlay.event-screen")
      ? document.querySelector(".campaign-overlay.event-screen")?.getAttribute("data-screen") ?? "event"
      : (shell?.getAttribute("data-screen") === "event" ? "event" : null);
    return {
      url: location.href,
      documentVisibility: document.visibilityState,
      screen: shell?.getAttribute("data-screen") ?? null,
      battleApiPresent: Boolean(battleApi),
      snapshot,
      assetApiPresent: Boolean(assetApi),
      asset,
      storyLine,
      storyScreen,
      readableSnapshot: snapshot,
    };
  });
}

function createSetupTrace(page, diagnosticControl) {
  let lifecyclePhase = "page creation";
  const trace = createBoundedTrace({
    page,
    readSample: async ({ elapsedWallMs }) => {
      const runtime = await setupRuntimeState(page);
      const counts = diagnosticControl.traceCounts();
      return {
        elapsedWallMs,
        lifecyclePhase,
        ...runtime,
        ...counts,
        diagnostics: counts,
      };
    },
  });
  return {
    setPhase(phase) {
      lifecyclePhase = phase;
    },
    stop: () => trace.stop(),
    capture: () => trace.capture(),
  };
}

async function sealAssetSetupBoundary(page, diagnosticControl, label) {
  const asset = await page.evaluate(() => ({
    state: window.__ASHFALL_ASSET_QA__?.getState?.() ?? null,
    requiredSprites: window.__ASHFALL_ASSET_QA__?.getRequiredPlan?.().sprites ?? [],
    loadedSpriteKeys: window.__ASHFALL_ASSET_QA__?.getLoadedSpriteKeys?.() ?? [],
    failedPaths: window.__ASHFALL_ASSET_QA__?.getFailedPaths?.() ?? [],
    pendingPaths: window.__ASHFALL_ASSET_QA__?.getPendingPaths?.() ?? [],
  }));
  if (new URL(page.url()).searchParams.get("qaHudFiniteAssets") === "1") {
    for (const requiredKind of ["ranger", "medic"]) {
      invariant(asset.requiredSprites.some(({ kind }) => kind === requiredKind),
        `${label}: finite HUD resident plan omitted ${requiredKind}`);
      invariant(asset.loadedSpriteKeys.includes(requiredKind),
        `${label}: terminal finite HUD generation did not load ${requiredKind}`);
    }
  }
  const setup = await diagnosticControl.beginPostReadyObservation();
  const historyRequired = setup.diagnostics.requestFailureDetails.length > 0;
  const history = historyRequired
    ? await page.evaluate(() => window.__ASHFALL_ASSET_QA__?.getHistory?.() ?? [])
    : [];
  const classification = classifySupersededAssetRequestFailures({
    failures: setup.diagnostics.requestFailureDetails,
    history,
    requiredSprites: asset.requiredSprites,
    loadedSpriteKeys: asset.loadedSpriteKeys,
    terminalState: asset.state,
  });
  invariant(setup.diagnostics.consoleErrors.length === 0
    && setup.diagnostics.pageErrors.length === 0
    && setup.diagnostics.httpErrors.length === 0,
  `${label}: setup emitted non-cancellable diagnostics ${JSON.stringify(setup.diagnostics)}`);
  invariant(classification.rejected.length === 0,
    `${label}: unmatched setup request failure ${JSON.stringify(classification.rejected)}`);
  return {
    label,
    boundaryAt: setup.boundaryAt,
    asset: { ...asset, historyRead: historyRequired, historyEntryCount: history.length },
    rawDiagnostics: setup.diagnostics,
    pageClockCalibrations: setup.pageClockCalibrations,
    acceptedSupersededFailures: classification.accepted,
  };
}

async function waitForBattleReadiness(page, label) {
  const startedAt = Date.now();
  let lastState = null;
  while (Date.now() - startedAt < timeout) {
    lastState = await page.evaluate(() => {
      const battle = window.__ASHFALL_BATTLE_QA__;
      const assets = window.__ASHFALL_ASSET_QA__;
      const snapshot = battle?.getCrawlerDeploymentProofSnapshot?.() ?? null;
      const asset = assets?.getState?.() ?? null;
      return {
        screen: snapshot?.screen ?? document.querySelector(".game-shell")?.getAttribute("data-screen") ?? null,
        running: snapshot?.running ?? null,
        asset: asset ? {
          state: asset.state ?? null,
          generation: asset.generation ?? null,
          completed: asset.completed ?? null,
          total: asset.total ?? null,
          pending: asset.pending ?? null,
          failed: asset.failed ?? null,
          reason: asset.reason ?? asset.failureReason ?? null,
        } : null,
        failedPaths: asset?.state === "error" ? assets?.getFailedPaths?.() ?? [] : [],
      };
    });
    if (lastState.asset?.state === "error") {
      throw new Error(`${label}: asset readiness failed ${JSON.stringify(lastState)}`);
    }
    if (lastState.screen === "battle"
      && lastState.running === true
      && ["ready", "degraded-ready"].includes(lastState.asset?.state)) {
      return lastState;
    }
    await hostTurn(DEPLOYMENT_FIRST_FRAME_SAMPLE_INTERVAL_MS);
  }
  throw new Error(`${label}: battle readiness timed out ${JSON.stringify(lastState)}`);
}

async function nextRender(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function screenshot(page, filename) {
  await nextRender(page);
  const screenshotPath = path.join(evidenceDir, filename);
  await page.screenshot({ path: screenshotPath, animations: "allow" });
  return relativeEvidencePath(screenshotPath);
}

async function deploymentCanvasPng(page, filename, label) {
  const serialized = await page.evaluate(() => {
    const canvas = document.querySelector("canvas.battlefield.active");
    if (!(canvas instanceof HTMLCanvasElement) || !canvas.isConnected) {
      throw new Error("active production battlefield canvas unavailable");
    }
    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    };
  });
  invariant(serialized.dataUrl.startsWith("data:image/png;base64,"),
    `${label}: production canvas did not serialize PNG data`);
  const bytes = Buffer.from(serialized.dataUrl.slice("data:image/png;base64,".length), "base64");
  invariant(bytes.length > 0, `${label}: production canvas PNG is empty`);
  const metadata = await sharp(bytes, { failOn: "error" }).metadata();
  invariant(metadata.format === "png",
    `${label}: production canvas evidence is not PNG (${metadata.format})`);
  invariant(metadata.width === serialized.width && metadata.height === serialized.height,
    `${label}: production canvas dimensions drifted ${JSON.stringify({
      serialized: { width: serialized.width, height: serialized.height },
      decoded: { width: metadata.width, height: metadata.height },
    })}`);
  const screenshotPath = path.join(evidenceDir, filename);
  await writeFile(screenshotPath, bytes);
  return {
    path: relativeEvidencePath(screenshotPath),
    bytes: bytes.length,
    width: serialized.width,
    height: serialized.height,
    format: metadata.format,
    source: "canvas.battlefield.active",
  };
}

async function crawlerRuntimeContactSheet(name, kind, viewport, entries) {
  invariant(entries.length === 7, `${name}/${kind}: runtime contact sheet requires seven phases`);
  const crop = {
    left: 0,
    top: Math.max(0, Math.round(viewport.height * .14)),
    width: Math.min(248, viewport.width),
    height: Math.min(250, viewport.height - Math.max(0, Math.round(viewport.height * .14))),
  };
  const tiles = [];
  for (const entry of entries) {
    const buffer = await sharp(path.resolve(entry.screenshot))
      .extract(crop)
      .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
      .toBuffer();
    tiles.push(buffer);
  }
  const outputPath = path.join(evidenceDir, `${name}-crawler-${kind}-runtime-contact-sheet.png`);
  await sharp({
    create: {
      width: crop.width * tiles.length,
      height: crop.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(tiles.map((input, index) => ({ input, left: index * crop.width, top: 0 })))
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toFile(outputPath);
  const relativePath = relativeEvidencePath(outputPath);
  return {
    path: relativePath,
    sha256: await evidenceSha256(relativePath),
    crop,
    columns: entries.length,
    phases: entries.map(({ phase }) => phase),
  };
}

async function deploymentRuntimeContactSheet(name, family, kind, viewport, entries) {
  invariant(entries.length === CRAWLER_DEPLOYMENT_CHECKPOINTS.length,
    `${name}/${family}/${kind}: deployment contact sheet is incomplete`);
  const crop = {
    left: 0,
    top: Math.max(0, Math.round(viewport.height * .1)),
    width: Math.min(Math.round(viewport.width * .52), viewport.width),
    height: Math.min(Math.round(viewport.height * .72), viewport.height),
  };
  const tiles = [];
  for (const entry of entries) {
    tiles.push(await sharp(path.resolve(entry.screenshot))
      .extract(crop)
      .resize({ width: 320, height: 180, fit: "contain", background: "#080a0b" })
      .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
      .toBuffer());
  }
  const outputPath = path.join(evidenceDir, `${name}-deployment-${family}-${kind}-contact-sheet.png`);
  await sharp({
    create: {
      width: 320 * entries.length,
      height: 180,
      channels: 4,
      background: { r: 8, g: 10, b: 11, alpha: 1 },
    },
  }).composite(tiles.map((input, index) => ({ input, left: index * 320, top: 0 })))
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toFile(outputPath);
  const relativePath = relativeEvidencePath(outputPath);
  return {
    path: relativePath,
    sha256: await evidenceSha256(relativePath),
    crop,
    columns: entries.length,
    checkpoints: entries.map(({ checkpoint }) => checkpoint),
  };
}

async function evidenceSha256(relativePath) {
  return createHash("sha256")
    .update(await readFile(path.resolve(relativePath)))
    .digest("hex");
}

function collectDeploymentArtifactInventory(resultsToInspect) {
  const checkpoints = [];
  const contactSheets = [];
  for (const result of resultsToInspect) {
    if (result.type !== "deployment") continue;
    for (const unit of result.units ?? []) {
      for (const checkpoint of unit.checkpoints ?? []) {
        if (typeof checkpoint.screenshot !== "string"
          || typeof checkpoint.screenshotSha256 !== "string") continue;
        checkpoints.push({
          type: "checkpoint",
          family: unit.family,
          kind: unit.kind,
          checkpoint: checkpoint.checkpoint,
          path: checkpoint.screenshot,
          recordedSha256: checkpoint.screenshotSha256,
        });
      }
      if (typeof unit.contactSheet?.path === "string"
        && typeof unit.contactSheet?.sha256 === "string") {
        contactSheets.push({
          type: "contact-sheet",
          family: unit.family,
          kind: unit.kind,
          path: unit.contactSheet.path,
          recordedSha256: unit.contactSheet.sha256,
        });
      }
    }
  }
  return { checkpoints, contactSheets };
}

async function inspectDeploymentArtifactIntegrity(resultsToInspect) {
  const inventory = collectDeploymentArtifactInventory(resultsToInspect);
  const combined = [...inventory.checkpoints, ...inventory.contactSheets];
  const pathOccurrences = new Map();
  for (const entry of combined) {
    pathOccurrences.set(entry.path, (pathOccurrences.get(entry.path) ?? 0) + 1);
  }
  const duplicatePaths = [...pathOccurrences.entries()]
    .filter(([, occurrences]) => occurrences > 1)
    .map(([artifactPath, occurrences]) => ({ path: artifactPath, occurrences }));
  const invalidFiles = [];
  const hashMismatches = [];
  const diskShaVerifiedCount = { checkpoint: 0, "contact-sheet": 0 };
  for (const entry of combined) {
    try {
      const file = await stat(path.resolve(entry.path));
      if (!file.isFile() || file.size <= 0) {
        invalidFiles.push({
          type: entry.type,
          path: entry.path,
          reason: file.isFile() ? "empty-file" : "not-regular-file",
        });
        continue;
      }
      const diskSha256 = await evidenceSha256(entry.path);
      if (diskSha256 !== entry.recordedSha256) {
        hashMismatches.push({
          type: entry.type,
          path: entry.path,
          recordedSha256: entry.recordedSha256,
          diskSha256,
        });
        continue;
      }
      diskShaVerifiedCount[entry.type] += 1;
    } catch (error) {
      invalidFiles.push({
        type: entry.type,
        path: entry.path,
        reason: "unreadable-file",
        error: String(error),
      });
    }
  }
  const diagnosticLimit = 64;
  const checkpointUniquePathCount = new Set(inventory.checkpoints.map(({ path: artifactPath }) => artifactPath)).size;
  const contactSheetUniquePathCount = new Set(inventory.contactSheets.map(({ path: artifactPath }) => artifactPath)).size;
  const combinedUniquePathCount = pathOccurrences.size;
  const rawOk = duplicatePaths.length === 0
    && invalidFiles.length === 0
    && hashMismatches.length === 0
    && diskShaVerifiedCount.checkpoint === inventory.checkpoints.length
    && diskShaVerifiedCount["contact-sheet"] === inventory.contactSheets.length;
  return {
    schema: "v099-deployment-artifact-integrity/v1",
    ok: rawOk,
    checkpoint: {
      logicalCount: inventory.checkpoints.length,
      uniquePathCount: checkpointUniquePathCount,
      diskShaVerifiedCount: diskShaVerifiedCount.checkpoint,
    },
    contactSheet: {
      logicalCount: inventory.contactSheets.length,
      uniquePathCount: contactSheetUniquePathCount,
      diskShaVerifiedCount: diskShaVerifiedCount["contact-sheet"],
    },
    combined: {
      logicalCount: combined.length,
      uniquePathCount: combinedUniquePathCount,
      diskShaVerifiedCount: diskShaVerifiedCount.checkpoint + diskShaVerifiedCount["contact-sheet"],
    },
    diagnostics: {
      limit: diagnosticLimit,
      duplicatePaths: duplicatePaths.slice(0, diagnosticLimit),
      invalidFiles: invalidFiles.slice(0, diagnosticLimit),
      hashMismatches: hashMismatches.slice(0, diagnosticLimit),
      omitted: {
        duplicatePaths: Math.max(0, duplicatePaths.length - diagnosticLimit),
        invalidFiles: Math.max(0, invalidFiles.length - diagnosticLimit),
        hashMismatches: Math.max(0, hashMismatches.length - diagnosticLimit),
      },
    },
  };
}

async function enterLegacyQaBattle(page, qaMode) {
  if (qaMode === "mission") return;
  await page.waitForFunction(
    () => ["loadout", "event", "battle"].includes(
      document.querySelector(".game-shell")?.getAttribute("data-screen") ?? "",
    ),
    undefined,
    { timeout },
  );
  if (await page.locator('.game-shell[data-screen="loadout"]').count()) {
    await page.waitForFunction(
      () => {
        const state = window.__ASHFALL_ASSET_QA__?.getState?.();
        return ["ready", "degraded-ready"].includes(state?.state)
          && state.pending === 0;
      },
      undefined,
      { timeout },
    );
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeout, 12_000) });
    const deployButton = page.getByRole("button", { name: /この編成で出撃/u });
    await deployButton.waitFor({ state: "visible", timeout });
    await page.waitForFunction(
      () => [...document.querySelectorAll("button")].some((button) => (
        button.textContent?.includes("この編成で出撃") && !button.disabled
      )),
      undefined,
      { timeout },
    );
    await deployButton.click({ timeout });
  }
  for (let advance = 0; advance < 48; advance += 1) {
    const screen = await page.locator(".game-shell").getAttribute("data-screen");
    if (screen === "battle") return;
    invariant(screen === "event", `${qaMode}: unexpected legacy QA screen ${screen}`);
    const dialogue = page.locator(".dialogue-box");
    await dialogue.waitFor({ state: "visible", timeout });
    // Each authored event line can introduce its portrait/sprite lazily.  Wait
    // for that request to finish before advancing the deterministic QA story;
    // otherwise the harness itself would cancel a valid image request when it
    // tears the line down 30ms later.
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeout, 12_000) });
    await dialogue.click({ timeout });
    await page.waitForTimeout(30);
  }
  throw new Error(`${qaMode}: story queue did not reach battle within 48 advances`);
}

async function openBattlePage(context, qaMode, options = {}, lifecycle = null) {
  lifecycle?.setPhase("page creation");
  const page = await context.newPage();
  const diagnosticControl = diagnosticsFor(page, lifecycle);
  const setupTrace = options.setupTrace === true ? createSetupTrace(page, diagnosticControl) : null;
  const setPhase = (phase) => {
    setupTrace?.setPhase(phase);
    lifecycle?.setPhase(phase);
  };
  setPhase("page creation");
  setPhase("navigation");
  lifecycle?.event("navigation start", { page });
  const viewport = page.viewportSize();
  try {
    const response = await page.goto(caseUrl(qaMode, {
      ...options,
      safeAreaPreset: options.safeAreaPreset ?? safeAreaForViewport(viewport).preset,
    }), {
      waitUntil: "domcontentloaded",
      timeout,
    });
    lifecycle?.event("navigation complete", { page, status: response?.status(), milestone: "navigation complete" });
    invariant(response?.ok(), `${qaMode}: navigation returned HTTP ${response?.status()}`);
    await diagnosticControl.calibratePageClock("post-navigation");
    setPhase("battle setup");
    await dismissInstallOffer(page, { timeout });
    setPhase("legacy screen advancement");
    await enterLegacyQaBattle(page, qaMode);
    setPhase("battle readiness");
    lifecycle?.event("battle readiness start", { page });
    await waitForBattleReadiness(page, `${qaMode}/${viewport.width}x${viewport.height}`);
    lifecycle?.event("battle readiness complete", { page, milestone: "battle readiness complete" });
    setPhase("post-readiness settling");
    try {
      await page.waitForLoadState("networkidle", { timeout: Math.min(timeout, 12_000) });
    } catch (error) {
      // Hosted WebKit can keep a decoded audio request alive after the battle,
      // complete pack, and asset gate are all ready. This boundary is not a
      // product readiness condition; diagnostics and every later visual/runtime
      // assertion remain fail-closed. Do not extend this allowance to the
      // loadout/story waits above, where tearing down a request is causal.
      if (!String(error).includes("page.waitForLoadState: Timeout")) throw error;
      lifecycle?.event("post-readiness network idle exceeded", {
        page,
        milestone: "battle and asset gate already ready",
      });
    }
    setPhase("asset-boundary sealing");
    const assetSetupBoundary = await sealAssetSetupBoundary(
      page,
      diagnosticControl,
      `${qaMode}/${viewport.width}x${viewport.height}`,
    );
    await setupTrace?.capture();
    const setupTraceResult = setupTrace ? await setupTrace.stop() : null;
    return { page, ...diagnosticControl, assetSetupBoundary, setupTrace: setupTraceResult };
  } catch (error) {
    if (setupTrace) {
      setupTrace.setPhase("failure");
      let failureScreenshot = null;
      try {
        if (!page.isClosed()) {
          const screenshotPath = path.join(
            evidenceDir,
            `chromium-${viewport.width}x${viewport.height}-${qaMode}-setup-failed.png`,
          );
          await page.screenshot({ path: screenshotPath, animations: "allow" });
          failureScreenshot = relativeEvidencePath(screenshotPath);
        }
      } catch {
        // Preserve the original setup failure and whatever trace was readable.
      }
      const setupTraceResult = await setupTrace.stop();
      Object.assign(error, {
        setupTrace: setupTraceResult,
        setupTraceFailureScreenshot: failureScreenshot,
        setupTraceLastReadableSnapshot: setupTraceResult.lastReadableSnapshot,
        setupTracePageSignals: setupTraceResult.pageSignals,
      });
    }
    throw error;
  }
}

async function clientPointForWorld(page, point) {
  const box = await page.locator("canvas.battlefield.active").boundingBox();
  invariant(box, "battlefield canvas has no display box");
  const scale = Math.max(box.width / 960, box.height / 540);
  return {
    x: box.x + (box.width - 960 * scale) / 2 + point.x * scale,
    y: box.y + (box.height - 540 * scale) / 2 + point.y * scale,
  };
}

async function recursiveLatestMtimeMs(directory) {
  let latest = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    latest = Math.max(
      latest,
      entry.isDirectory()
        ? await recursiveLatestMtimeMs(entryPath)
        : entry.isFile() ? (await stat(entryPath)).mtimeMs : 0,
    );
  }
  return latest;
}

async function staticRuntimeEvidence() {
  const ashfallSource = await readFile(path.resolve("app/AshfallGame.tsx"), "utf8");
  const equipmentFunctionStart = ashfallSource.indexOf("function drawCrawlerEquipmentFrame(");
  const equipmentFunctionEnd = ashfallSource.indexOf("function crawlerAuthoredWorldPoint(", equipmentFunctionStart);
  invariant(equipmentFunctionStart >= 0 && equipmentFunctionEnd > equipmentFunctionStart,
    "CRAWLER authored-equipment renderer is missing");
  const equipmentRenderer = ashfallSource.slice(equipmentFunctionStart, equipmentFunctionEnd);
  invariant(equipmentRenderer.includes("ctx.drawImage("),
    "CRAWLER equipment renderer does not draw the authored raster sheet");
  invariant(!/(?:beginPath|moveTo|lineTo|arc|fillRect|strokeRect|Path2D)\s*\(/u.test(equipmentRenderer),
    "CRAWLER equipment renderer contains Canvas body geometry");
  invariant(!ashfallSource.includes("function drawAirstrikeObserver("),
    "legacy Canvas airstrike observer body remains in the runtime");

  const provenance = JSON.parse(await readFile(
    path.resolve("assets/source/v099/crawler/provenance.json"),
    "utf8",
  ));
  invariant(provenance.generation?.runtimeCanvasGeometry === false,
    "CRAWLER provenance does not prohibit runtime Canvas geometry");
  const runtimePaths = [
    V099_CRAWLER_RUNTIME_PROFILE.equipmentHost.closed.path,
    V099_CRAWLER_RUNTIME_PROFILE.deployment.baseInterior.path,
    V099_CRAWLER_RUNTIME_PROFILE.deployment.foregroundMask.path,
    V099_CRAWLER_RUNTIME_PROFILE.equipment.barrage.sheet.path,
    V099_CRAWLER_RUNTIME_PROFILE.equipment.airstrike.sheet.path,
  ];
  invariant(new Set(runtimePaths).size === 5, "CRAWLER runtime profile collapsed physical assets");
  for (const assetPath of runtimePaths) {
    invariant((await stat(path.resolve(`public${assetPath}`))).size > 0,
      `CRAWLER runtime asset is missing: ${assetPath}`);
  }
  for (const [kind, phases] of [
    ["barrage", CRAWLER_BARRAGE_SPRITE_PHASES],
    ["airstrike", CRAWLER_AIRSTRIKE_SPRITE_PHASES],
  ]) {
    invariant(phases.length === 7, `${kind} authored phase count drifted`);
    for (const phase of phases) {
      invariant(resolveCrawlerEquipmentFrame(kind, phase), `${kind}:${phase} frame is unresolved`);
    }
  }
  return {
    renderer: "drawCrawlerEquipmentFrame",
    rendererUsesDrawImage: true,
    rendererCanvasBodyGeometry: false,
    provenanceRuntimeCanvasGeometry: provenance.generation.runtimeCanvasGeometry,
    runtimePaths,
    barragePhases: [...CRAWLER_BARRAGE_SPRITE_PHASES],
    airstrikePhases: [...CRAWLER_AIRSTRIKE_SPRITE_PHASES],
  };
}

async function measureHud(page, viewport, label) {
  const safeArea = safeAreaForViewport(viewport);
  const expectedLayout = mobileBattleHudLayout({
    ...viewport,
    safeAreaTop: safeArea.top,
    safeAreaRight: safeArea.right,
    safeAreaBottom: safeArea.bottom,
    safeAreaLeft: safeArea.left,
  });
  const desktopRegression = expectedLayout === null && viewport.width === 1280 && viewport.height === 720;
  invariant(expectedLayout || desktopRegression,
    `${label}: no canonical HUD contract for ${viewport.width}x${viewport.height}`);
  const measured = await page.evaluate(({ expectedTypography }) => {
    const rect = (element) => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return {
        left: value.left,
        top: value.top,
        right: value.right,
        bottom: value.bottom,
        width: value.width,
        height: value.height,
      };
    };
    const visible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden"
        && Number(style.opacity) > 0 && box.width > 0 && box.height > 0;
    };
    const fontRules = [
      [".battle-banner", expectedTypography.banner.minPx],
      [".battle-barks p", 12],
      [".battle-brand-zone .brand-block b", 14],
      [".battle-brand-zone .crawler-health span", expectedTypography.detail.minPx],
      [".battle-brand-zone .crawler-health b", expectedTypography.detail.minPx],
      [".battle-controls-zone .phase-block small", expectedTypography.detail.minPx],
      [".battle-controls-zone .phase-block strong", 14],
      [".battle-controls-zone .phase-block em", expectedTypography.detail.minPx],
      [".resource > span", expectedTypography.detail.minPx],
      [".resource small", expectedTypography.detail.minPx],
      [".battle-stats span", expectedTypography.stats.minPx],
      [".unit-card .card-copy b", expectedTypography.unitName.minPx],
      [".unit-card .cost", expectedTypography.unitCost.minPx],
      [".unit-card .card-state", expectedTypography.disabledReason.minPx],
      [".unit-card .cooldown-mask small", expectedTypography.disabledReason.minPx],
      [".support-btn b", expectedTypography.supportName.minPx],
      [".support-btn small", expectedTypography.disabledReason.minPx],
      [".support-btn em", expectedTypography.supportCost.minPx],
      [".support-detail-compact", expectedTypography.supportCost.minPx],
      [".battle-objective", expectedTypography.objective.minPx],
      [".boss-hud div", expectedTypography.detail.minPx],
      [".boss-hud b", expectedTypography.detail.minPx],
    ];
    const fontChecks = fontRules.flatMap(([selector, minimum]) => (
      [...document.querySelectorAll(selector)].filter(visible).map((element) => ({
        selector,
        text: element.textContent?.trim() ?? "",
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        minimum,
        fits: element.scrollWidth <= element.clientWidth + 2
          && element.scrollHeight <= element.clientHeight + 2,
        rect: rect(element),
      }))
    ));
    const top = document.querySelector(".top-hud");
    const bottom = document.querySelector(".bottom-hud");
    const topZones = [
      document.querySelector(".battle-brand-zone"),
      document.querySelector(".top-hud > .battle-message-stack"),
      document.querySelector(".battle-controls-zone"),
    ];
    const bottomZones = [
      document.querySelector(".resource-stack"),
      document.querySelector(".bottom-hud > .unit-cards"),
      document.querySelector(".support-zone"),
    ];
    const normalizedWidths = (elements) => {
      const widths = elements.map((element) => rect(element)?.width ?? 0);
      const total = widths.reduce((sum, width) => sum + width, 0);
      return widths.map((width) => total > 0 ? width / total : 0);
    };
    const overlap = (left, right) => {
      const a = rect(left);
      const b = rect(right);
      return Boolean(a && b
        && Math.min(a.right, b.right) - Math.max(a.left, b.left) > .5
        && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > .5);
    };
    const pairOverlaps = (elements) => elements.flatMap((element, index) => (
      elements.slice(index + 1).map((other, offset) => ({
        pair: [index, index + offset + 1],
        overlaps: overlap(element, other),
      }))
    ));
    const banner = document.querySelector(".battle-banner");
    const bark = document.querySelector(".battle-barks");
    const boss = document.querySelector(".boss-hud");
    const bossHeading = boss?.querySelector("div") ?? null;
    const bossLabel = bossHeading?.querySelector("span") ?? null;
    const bossValue = bossHeading?.querySelector("b") ?? null;
    const crawlerAlert = document.querySelector(".crawler-alert");
    const brandBlock = document.querySelector(".battle-brand-zone .brand-block");
    const crawlerHealth = document.querySelector(".battle-brand-zone .crawler-health");
    const unitStrip = document.querySelector(".unit-cards");
    const supportRow = document.querySelector(".support-row");
    const objective = document.querySelector(".battle-objective");
    const unitStripRect = rect(unitStrip);
    const unitSlots = [...document.querySelectorAll(".unit-cards > .unit-card")];
    const unitSlotRects = unitSlots.map((element) => rect(element));
    const disabled = [...document.querySelectorAll("button[aria-disabled='true']")]
      .filter(visible)
      .map((button) => {
        const style = getComputedStyle(button);
        return {
          className: button.className,
          label: button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "",
          opacity: Number.parseFloat(style.opacity),
          cursor: style.cursor,
          rect: rect(button),
        };
      });
    const rootStyle = getComputedStyle(document.documentElement);
    const safeInsets = Object.fromEntries(["top", "right", "bottom", "left"].map((edge) => [
      edge,
      Math.max(0, Number.parseFloat(rootStyle.getPropertyValue(`--app-viewport-safe-${edge}`)) || 0),
    ]));
    const visual = window.visualViewport;
    const visualViewport = {
      left: visual?.offsetLeft ?? 0,
      top: visual?.offsetTop ?? 0,
      width: visual?.width ?? innerWidth,
      height: visual?.height ?? innerHeight,
    };
    visualViewport.right = visualViewport.left + visualViewport.width;
    visualViewport.bottom = visualViewport.top + visualViewport.height;
    const ownedRects = [top, bottom, ...topZones, ...bottomZones].map(rect).filter(Boolean);
    const insideViewport = (box) => box.left >= visualViewport.left - .5
      && box.top >= visualViewport.top - .5
      && box.right <= visualViewport.right + .5
      && box.bottom <= visualViewport.bottom + .5;
    const controlGroups = [
      [...document.querySelectorAll(".battle-controls-zone button")].filter(visible),
      [...document.querySelectorAll(".support-row > button")].filter(visible),
    ];
    const contentCollisions = [
      {
        owner: "battle-brand-zone",
        pair: "brand-health",
        overlaps: visible(brandBlock) && visible(crawlerHealth) ? overlap(brandBlock, crawlerHealth) : false,
        left: rect(brandBlock),
        right: rect(crawlerHealth),
      },
      ...[...document.querySelectorAll(".unit-card")].flatMap((card, cardIndex) => {
        const title = card.querySelector(".card-copy b");
        const state = card.querySelector(".card-state");
        const cost = card.querySelector(".cost");
        return [["title-state", title, state], ["title-cost", title, cost], ["state-cost", state, cost]]
          .filter(([, left, right]) => visible(left) && visible(right))
          .map(([pair, left, right]) => ({
            owner: `unit-${cardIndex}`,
            pair,
            overlaps: overlap(left, right),
            left: rect(left),
            right: rect(right),
          }));
      }),
      ...[...document.querySelectorAll(".support-btn")].flatMap((button, buttonIndex) => {
        const title = button.querySelector("b");
        const detail = [...button.querySelectorAll(".support-detail-full,.support-detail-compact")]
          .find(visible) ?? button.querySelector("small");
        const cost = button.querySelector("em");
        return [["title-detail", title, detail], ["title-cost", title, cost], ["detail-cost", detail, cost]]
          .filter(([, left, right]) => visible(left) && visible(right))
          .map(([pair, left, right]) => ({
            owner: `support-${buttonIndex}`,
            pair,
            overlaps: overlap(left, right),
            left: rect(left),
            right: rect(right),
          }));
      }),
      {
        owner: "support-zone",
        pair: "support-row-objective",
        overlaps: visible(supportRow) && visible(objective) ? overlap(supportRow, objective) : false,
      },
    ];
    const requiredHudInformation = {
      brand: visible(document.querySelector(".battle-brand-zone")),
      phase: visible(document.querySelector(".phase-block")),
      resources: visible(document.querySelector(".resource-stack")),
      stats: visible(document.querySelector(".battle-stats")),
      units: visible(document.querySelector(".unit-cards"))
        && document.querySelectorAll(".unit-cards > .unit-card").length > 0,
      support: visible(document.querySelector(".support-zone")),
      objective: visible(document.querySelector(".battle-objective")),
      controls: visible(document.querySelector(".battle-controls-zone")),
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      visualViewport,
      layoutMode: document.querySelector(".game-frame")?.getAttribute("data-battle-hud-layout") ?? null,
      safeInsets,
      top: rect(top),
      bottom: rect(bottom),
      topZones: topZones.map(rect),
      bottomZones: bottomZones.map(rect),
      unitStrip: rect(unitStrip),
      supportRow: rect(supportRow),
      objective: rect(objective),
      topRatios: normalizedWidths(topZones),
      bottomRatios: normalizedWidths(bottomZones),
      topPairOverlaps: pairOverlaps(topZones),
      bottomPairOverlaps: pairOverlaps(bottomZones),
      banner: rect(banner),
      bark: rect(bark),
      bannerBarkOverlap: overlap(banner, bark),
      boss: rect(boss),
      bossHeading: rect(bossHeading),
      bossLabel: rect(bossLabel),
      bossValue: rect(bossValue),
      crawlerAlert: rect(crawlerAlert),
      bossCrawlerAlertOverlap: overlap(boss, crawlerAlert),
      unitSlots: {
        logical: unitSlots.length,
        placeholders: unitSlots.filter((element) => element.classList.contains("unit-card-placeholder")).length,
        placeholderButtons: unitSlots.filter((element) => element.classList.contains("unit-card-placeholder") && element instanceof HTMLButtonElement).length,
        visible: unitSlotRects.filter((slot) => Boolean(slot)
          && slot.left >= (rect(unitStrip)?.left ?? 0) - 1
          && slot.right <= (rect(unitStrip)?.right ?? 0) + 1).length,
        allPainted: unitSlotRects.every((slot) => Boolean(slot) && slot.width > 0 && slot.height > 0),
        finalOffset: unitSlotRects.at(-1) && unitStripRect
          ? unitSlotRects.at(-1).right - unitStripRect.left
          : 0,
        scrollWidth: unitStrip?.scrollWidth || 0,
        clientWidth: unitStrip?.clientWidth || 0,
      },
      publicBattleText: document.body.innerText,
      fontChecks,
      disabled,
      disabledUnitCount: disabled.filter(({ className }) => String(className).includes("unit-card")).length,
      disabledSupportCount: disabled.filter(({ className }) => String(className).includes("support-btn")).length,
      ownedZonesInViewport: ownedRects.every(insideViewport),
      controlPairOverlaps: controlGroups.flatMap(pairOverlaps),
      contentCollisions,
      requiredHudInformation,
      documentOverflow: {
        horizontal: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1,
        vertical: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) > innerHeight + 1,
      },
    };
  }, { expectedTypography: MOBILE_BATTLE_HUD_TYPOGRAPHY });

  const ratioClose = (actual, expected) => Math.abs(actual - expected) <= .008;
  invariant(measured.top && measured.bottom, `${label}: top or bottom HUD is missing`);
  invariant(measured.topZones.every(Boolean) && measured.bottomZones.every(Boolean),
    `${label}: one or more owned HUD zones are missing`);
  invariant(measured.topPairOverlaps.every(({ overlaps }) => !overlaps),
    `${label}: top HUD zones overlap`);
  invariant(measured.bottomPairOverlaps.every(({ overlaps }) => !overlaps),
    `${label}: bottom HUD zones overlap`);
  invariant(measured.controlPairOverlaps.every(({ overlaps }) => !overlaps),
    `${label}: HUD controls collide`);
  invariant(measured.contentCollisions.every(({ overlaps }) => !overlaps),
    `${label}: HUD text/content overlaps ${JSON.stringify(measured.contentCollisions.filter(({ overlaps }) => overlaps))}`);
  const clearBattlefieldHeight = measured.bottom.top - measured.top.bottom;
  let expectedSafeAreaAdjusted = null;
  if (expectedLayout) {
    invariant(measured.layoutMode === "mobile", `${label}: physical-phone HUD contract was not activated`);
    invariant(measured.ownedZonesInViewport,
      `${label}: mobile HUD is clipped by the visual viewport ${JSON.stringify(measured.visualViewport)}`);
    invariant(!measured.documentOverflow.horizontal && !measured.documentOverflow.vertical,
      `${label}: mobile document overflow ${JSON.stringify(measured.documentOverflow)}`);
    invariant(Object.values(measured.requiredHudInformation).every(Boolean),
      `${label}: required mobile HUD information is missing ${JSON.stringify(measured.requiredHudInformation)}`);
    invariant(measured.topRatios.every((value, index) => ratioClose(value, [.28, .38, .34][index])),
      `${label}: top 28/38/34 ownership drift ${JSON.stringify(measured.topRatios)}`);
    const expectedBottomRatios = [
      expectedLayout.bottom.resources.width / expectedLayout.content.width,
      expectedLayout.bottom.units.width / expectedLayout.content.width,
      expectedLayout.bottom.support.width / expectedLayout.content.width,
    ];
    invariant(measured.bottomRatios.every((value, index) => ratioClose(value, expectedBottomRatios[index])),
      `${label}: bottom ownership drift ${JSON.stringify({
        actual: measured.bottomRatios,
        expected: expectedBottomRatios,
      })}`);
    const expectedTopHeight = expectedLayout.topHeight;
    const expectedBottomHeight = expectedLayout.bottomHeight;
    const expectedBattlefieldHeight = expectedLayout.battlefield.height;
    invariant(Math.abs(measured.top.height - expectedTopHeight) <= 2,
      `${label}: top HUD height ${measured.top.height}/${expectedTopHeight}`);
    invariant(Math.abs(measured.bottom.height - expectedBottomHeight) <= 2,
      `${label}: bottom HUD height ${measured.bottom.height}/${expectedBottomHeight}`);
    invariant(clearBattlefieldHeight >= expectedBattlefieldHeight - 2,
      `${label}: battlefield band ${clearBattlefieldHeight}/${expectedBattlefieldHeight}`);
    const rectClose = (actual, expected) => actual && expected
      && Math.abs(actual.left - expected.x) <= 2
      && Math.abs(actual.top - expected.y) <= 2
      && Math.abs(actual.width - expected.width) <= 2
      && Math.abs(actual.height - expected.height) <= 2;
    invariant(rectClose(measured.unitStrip, expectedLayout.bottomContent.units),
      `${label}: unit content row drift ${JSON.stringify({ actual: measured.unitStrip, expected: expectedLayout.bottomContent.units })}`);
    invariant(rectClose(measured.supportRow, expectedLayout.bottomContent.support),
      `${label}: support content row drift ${JSON.stringify({ actual: measured.supportRow, expected: expectedLayout.bottomContent.support })}`);
    invariant(rectClose(measured.objective, expectedLayout.bottomContent.objective),
      `${label}: objective row drift ${JSON.stringify({ actual: measured.objective, expected: expectedLayout.bottomContent.objective })}`);
    expectedSafeAreaAdjusted = {
      topHeight: expectedTopHeight,
      bottomHeight: expectedBottomHeight,
      battlefieldHeight: expectedBattlefieldHeight,
    };
  } else {
    invariant(measured.viewport.width === 1280 && measured.viewport.height === 720,
      `${label}: desktop regression viewport drifted ${JSON.stringify(measured.viewport)}`);
    invariant(measured.ownedZonesInViewport, `${label}: desktop HUD is clipped by the viewport`);
    invariant(!measured.documentOverflow.horizontal && !measured.documentOverflow.vertical,
      `${label}: desktop document overflow ${JSON.stringify(measured.documentOverflow)}`);
    invariant(Object.values(measured.requiredHudInformation).every(Boolean),
      `${label}: required desktop HUD information is missing ${JSON.stringify(measured.requiredHudInformation)}`);
    invariant(clearBattlefieldHeight > 0, `${label}: desktop HUD leaves no visible battlefield`);
  }
  invariant(measured.fontChecks.length > 0, `${label}: no visible HUD typography was audited`);
  if (expectedLayout) {
    invariant(measured.fontChecks.every(({ fontSize, minimum }) => fontSize + .01 >= minimum),
      `${label}: undersized HUD text ${JSON.stringify(measured.fontChecks.filter(({ fontSize, minimum }) => fontSize + .01 < minimum))}`);
    invariant(measured.fontChecks.every(({ fits }) => fits),
      `${label}: truncated HUD text ${JSON.stringify(measured.fontChecks.filter(({ fits }) => !fits))}`);
  }
  invariant(measured.unitSlots.logical === 7 && measured.unitSlots.allPainted,
    `${label}: seven logical unit slots were not rendered ${JSON.stringify(measured.unitSlots)}`);
  invariant(measured.unitSlots.visible >= 4,
    `${label}: fewer than four unit slots are visible ${JSON.stringify(measured.unitSlots)}`);
  invariant(measured.unitSlots.finalOffset <= measured.unitSlots.scrollWidth + 1,
    `${label}: unit strip cannot reach its final logical slot ${JSON.stringify(measured.unitSlots)}`);
  invariant(measured.unitSlots.placeholderButtons === 0,
    `${label}: empty unit placeholders became interactive ${JSON.stringify(measured.unitSlots)}`);
  invariant(!/CRAWLER|クローラー/iu.test(measured.publicBattleText),
    `${label}: internal CRAWLER wording leaked into player-facing battle text`);
  if (measured.banner && measured.bark) {
    invariant(!measured.bannerBarkOverlap, `${label}: battle banner overlaps battle bark`);
  }
  if (measured.boss) {
    invariant(measured.boss.top >= measured.top.bottom - 1
      && measured.boss.bottom <= measured.bottom.top + 1,
    `${label}: boss HUD escaped the battlefield band`);
    invariant(measured.bossHeading && measured.bossLabel && measured.bossValue,
      `${label}: boss HUD semantic fields are missing`);
    if (expectedLayout) {
      invariant(Math.abs(measured.bossLabel.top - measured.bossValue.top) <= 2
        && Math.abs(measured.bossLabel.bottom - measured.bossValue.bottom) <= 2
        && measured.bossLabel.right <= measured.bossValue.left + .5,
      `${label}: boss phase or current/max is semantically wrapped or overlapping`);
    }
  }
  if (measured.boss && measured.crawlerAlert) {
    invariant(!measured.bossCrawlerAlertOverlap,
      `${label}: boss HUD overlaps crawler threat alert`);
  }
  return {
    ...measured,
    contract: expectedLayout ? "mobile" : "desktop-regression",
    expected: expectedLayout,
    expectedSafeAreaAdjusted,
    clearBattlefieldHeight,
  };
}

async function waitForQuietBattleMessages(page, label) {
  await page.waitForFunction(
    () => !document.querySelector(".battle-banner") && !document.querySelector(".battle-barks"),
    undefined,
    { timeout },
  ).catch((error) => {
    throw new Error(`${label}: battle messages did not clear: ${String(error)}`);
  });
}

async function captureHudState(page, viewport, axisName, stateId, lifecycle = null) {
  lifecycle?.setPhase(`HUD state capture/${stateId}`);
  lifecycle?.event("HUD state capture start", { page, stateId });
  const layout = await measureHud(page, viewport, `${axisName}/${stateId}`);
  const semantic = await page.evaluate(() => {
    const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
    const banner = document.querySelector(".battle-banner");
    const bark = document.querySelector(".battle-barks");
    const boss = document.querySelector(".boss-hud");
    const objective = document.querySelector(".battle-objective");
    return {
      stageId: snapshot.stageId,
      time: snapshot.time,
      paused: snapshot.paused,
      humanCount: snapshot.fighters.filter((fighter) => fighter.side === "human" && fighter.hp > 0).length,
      bossKinds: snapshot.fighters
        .filter((fighter) => fighter.side === "zombie" && ["takuya", "gate-eater", "kurome", "mother", "ooguchi", "gairen", "futago"].includes(fighter.kind))
        .map((fighter) => fighter.kind),
      manualAbilityReceiptCount: snapshot.manualAbilityReceipts?.length ?? 0,
      bannerText: banner?.textContent?.trim() ?? "",
      barkText: bark?.textContent?.trim() ?? "",
      bossText: boss?.textContent?.trim() ?? "",
      objectiveText: objective?.textContent?.trim() ?? "",
      objectiveFits: objective
        ? objective.scrollWidth <= objective.clientWidth + 2
          && objective.scrollHeight <= objective.clientHeight + 2
        : false,
    };
  });
  const screenshotPath = await screenshot(page, `${axisName}-hud-${stateId}.png`);
  lifecycle?.event("HUD state capture complete", {
    page,
    stateId,
    milestone: `${stateId} HUD state capture complete`,
  });
  return {
    id: stateId,
    semantic,
    layout,
    screenshot: screenshotPath,
    screenshotSha256: await evidenceSha256(screenshotPath),
  };
}

async function createDisabledHudState(page, label, { minimumOpacity = .72 } = {}) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = await page.evaluate(() => (
      [...document.querySelectorAll("button.unit-card")]
        .filter((button) => !button.disabled && button.getAttribute("aria-disabled") !== "true")
        .map((button) => ({
          kind: button.getAttribute("data-kind"),
          cost: Number((button.querySelector(".cost")?.textContent ?? "").match(/\d+/u)?.[0] ?? 0),
        }))
        .sort((left, right) => right.cost - left.cost)[0] ?? null
    ));
    if (!candidate?.kind) {
      await page.waitForTimeout(60);
      continue;
    }
    const clicked = await page.evaluate((kind) => {
      const button = document.querySelector(`button.unit-card[data-kind='${kind}']`);
      if (!(button instanceof HTMLButtonElement)
        || button.disabled
        || button.getAttribute("aria-disabled") === "true") return false;
      button.click();
      return true;
    }, candidate.kind);
    if (!clicked) {
      await page.waitForTimeout(60);
      continue;
    }
    await page.waitForTimeout(60);
    if (await page.locator("button.unit-card[aria-disabled='true']").count() > 0) break;
  }
  await page.waitForFunction(
    () => document.querySelectorAll("button.unit-card[aria-disabled='true']").length > 0
      && document.querySelectorAll("button.support-btn[aria-disabled='true']").length > 0,
    undefined,
    { timeout },
  );
  const disabled = await page.evaluate(() => (
    [...document.querySelectorAll("button[aria-disabled='true']")].map((button) => ({
      className: button.className,
      label: button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "",
      reason: button.getAttribute("data-block-reason"),
      opacity: Number.parseFloat(getComputedStyle(button).opacity),
      cursor: getComputedStyle(button).cursor,
    }))
  ));
  invariant(disabled.some(({ className }) => String(className).includes("unit-card")),
    `${label}: no unit-card disabled state was produced`);
  invariant(disabled.some(({ className }) => String(className).includes("support-btn")),
    `${label}: no support disabled state was produced`);
  const disabledTextControls = disabled.filter(({ className }) => (
    String(className).includes("unit-card") || String(className).includes("support-btn")
  ));
  if (minimumOpacity !== null) {
    invariant(disabledTextControls.every(({ opacity }) => opacity >= minimumOpacity),
      `${label}: disabled text control opacity fell below ${minimumOpacity}`
      + ` ${JSON.stringify(disabledTextControls)}`);
  }
  return disabled;
}

async function runIsolatedHudState(browserType, engine, viewport, stateId) {
  const axisName = `${engine}-${viewport.width}x${viewport.height}`;
  const name = `${axisName}/${stateId}`;
  const lifecycleName = `${axisName}-${stateId}`;
  const lifecycle = await createLifecycleDiagnostics({
    engine, viewport, caseType: "hud", name: lifecycleName,
  });
  let browser = null;
  let context = null;
  let page = null;
  const diagnosticControls = [];
  const result = { type: "hud", engine, viewport, status: "failed", states: [] };
  try {
    lifecycle.setPhase("browser launch");
    browser = await browserType.launch({ headless: true });
    lifecycle.attachBrowser(browser);
    lifecycle.setPhase("context creation");
    context = await browser.newContext({ viewport });
    lifecycle.attachContext(context);
    const stageNumber = ["stage1-normal", "five-units", "deployment-banner", "manual-ability-banner"]
      .includes(stateId) ? 1 : 3;
    const battle = await openBattlePage(context, "mission", { stageNumber }, lifecycle);
    diagnosticControls.push(battle);
    page = battle.page;
    lifecycle?.setPhase("HUD initial message settle");
    await waitForQuietBattleMessages(page, `${name}/settle`);

    if (stateId === "stage1-normal") {
      await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
      const state = await captureHudState(page, viewport, axisName, stateId, lifecycle);
      invariant(state.semantic.stageId.includes("shopping-street")
        && !state.semantic.bannerText && !state.semantic.barkText
        && state.semantic.bossKinds.length === 0,
      `${name}: Stage 1 normal HUD fixture drifted ${JSON.stringify(state.semantic)}`);
      result.states.push(state);
    } else if (stateId === "five-units") {
      const proof = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.prepareManualAbilityProof([
        "scout", "ranger", "brawler", "medic", "gunner",
      ]));
      invariant(proof?.ownerIds?.length === 5, `${name}: five-unit fixture was not created`);
      await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
      const state = await captureHudState(page, viewport, axisName, stateId, lifecycle);
      invariant(state.semantic.humanCount === 5,
        `${name}: five-unit HUD state has ${state.semantic.humanCount} live humans`);
      result.states.push(state);
    } else if (stateId === "deployment-banner") {
      const prepared = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.prepareCrawlerDefenseProof({
        attackerKind: "walker", lane: 1, existingClaim: false,
      }));
      invariant(Number.isInteger(prepared?.attackerId), `${name}: deployment fixture is unavailable`);
      const start = await queueAndPauseAtFirstDeploymentFrame(page, "kumaverson", name);
      invariant(start.audit?.deploymentPlan?.checkpoint === "fully-inside",
        `${name}: deployment banner did not freeze the production progress-0 frame`);
      await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
      const visible = await pauseAtDeploymentCheckpoint(
        page, start.fighter.id, "first-visible", CRAWLER_DEPLOYMENT_CHECKPOINTS[1].progress, name,
      );
      invariant(visible.audit?.deploymentPlan?.unitPass === "after-foreground-mask",
        `${name}: the first visible Kumaverson frame is still hidden behind the vehicle`);
      const state = await captureHudState(page, viewport, axisName, stateId, lifecycle);
      invariant(state.semantic.bannerText.includes("移動拠点から出撃"),
        `${name}: deployment banner copy is missing`);
      result.states.push(state);
    } else if (stateId === "manual-ability-banner") {
      const proof = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.prepareManualAbilityProof("medic"));
      invariant(proof?.ownerIds?.length === 1, `${name}: manual-ability fixture is unavailable`);
      const button = page.locator("button.manual-ability-ready:not([aria-disabled='true'])").first();
      await button.waitFor({ state: "visible", timeout });
      await button.click({ timeout });
      await page.waitForFunction(
        () => document.querySelector(".battle-banner")?.textContent?.includes("//")
          && (window.__ASHFALL_BATTLE_QA__.getSnapshot().manualAbilityReceipts?.length ?? 0) === 1,
        undefined, { timeout },
      );
      await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
      const state = await captureHudState(page, viewport, axisName, stateId, lifecycle);
      invariant(state.semantic.manualAbilityReceiptCount === 1
        && state.semantic.bannerText.includes("緊急処置"),
      `${name}: manual ability banner did not use the production activation path`);
      result.states.push(state);
    } else if (stateId === "objective-full") {
      await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
      const state = await captureHudState(page, viewport, axisName, stateId, lifecycle);
      invariant(state.semantic.objectiveFits && state.semantic.objectiveText.startsWith("目標：")
        && state.semantic.objectiveText.length >= 8,
      `${name}: full objective is missing or truncated ${JSON.stringify(state.semantic)}`);
      result.states.push(state);
    } else if (stateId === "support-disabled") {
      await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
      const disabledControls = await createDisabledHudState(page, name, {
        minimumOpacity: mobileBattleHudLayout(viewport) ? .72 : null,
      });
      await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
      const state = await captureHudState(page, viewport, axisName, stateId, lifecycle);
      invariant(state.layout.disabledUnitCount > 0 && state.layout.disabledSupportCount > 0,
        `${name}: disabled unit/support state did not remain visible`);
      result.states.push({ ...state, disabledControls });
    } else {
      lifecycle?.setPhase("boss fixture preparation");
      const prepared = await page.evaluate(
        () => window.__ASHFALL_BATTLE_QA__.prepareBossFoundationProof("takuya"),
      );
      invariant(prepared?.kind === "takuya", `${name}: TAKUYA HUD fixture is unavailable`);
      lifecycle?.setPhase("boss entrance wait");
      const entry = await page.waitForFunction(
        () => {
          const proof = window.__ASHFALL_BATTLE_QA__.getBossFoundationProof("takuya");
          return proof?.bossId && proof.gateEntering === true ? proof : null;
        }, undefined, { timeout, polling: 10 },
      ).then((handle) => handle.jsonValue());
      invariant(Number.isInteger(entry?.bossId), `${name}: TAKUYA entrance did not start`);
      await page.evaluate(
        (bossId) => window.__ASHFALL_BATTLE_QA__.accelerateBossFoundationEntry(bossId), entry.bossId,
      );
      lifecycle?.setPhase("boss combat-ready wait");
      await page.waitForFunction(
        () => {
          const proof = window.__ASHFALL_BATTLE_QA__.getBossFoundationProof("takuya");
          return proof?.combatReady === true && document.querySelector(".battle-banner")
            && document.querySelector(".battle-barks") && document.querySelector(".boss-hud");
        }, undefined, { timeout, polling: 10 },
      );
      if (stateId === "banner-bark-boss") {
        const state = await captureHudState(page, viewport, axisName, stateId, lifecycle);
        invariant(state.layout.banner && state.layout.bark && state.layout.boss,
          `${name}: simultaneous banner, bark, and boss HUD state was not rendered`);
        result.states.push(state);
      } else {
        lifecycle?.setPhase("boss message settle");
        await waitForQuietBattleMessages(page, name);
        await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
        const state = await captureHudState(page, viewport, axisName, stateId, lifecycle);
        invariant(state.layout.boss && state.semantic.bossKinds.includes("takuya")
          && !state.semantic.bannerText && !state.semantic.barkText,
        `${name}: clean Stage 3 boss HUD state was not retained`);
        result.states.push(state);
      }
    }

    invariant(result.states.length === 1 && result.states[0].id === stateId,
      `${name}: isolated HUD state evidence is incomplete`);
    result.status = "passed";
  } catch (error) {
    result.error = String(error);
    if (page && !page.isClosed()) {
      try {
        result.failureScreenshot = await screenshot(page, `${lifecycleName}-hud-failed.png`);
      } catch {
        // Preserve the original failure.
      }
    }
  } finally {
    for (const control of diagnosticControls) control.stop();
    result.diagnostics = {
      consoleErrors: diagnosticControls.flatMap(({ diagnostics }) => diagnostics.consoleErrors),
      pageErrors: diagnosticControls.flatMap(({ diagnostics }) => diagnostics.pageErrors),
      requestFailures: diagnosticControls.flatMap(({ diagnostics }) => diagnostics.requestFailures),
      httpErrors: diagnosticControls.flatMap(({ diagnostics }) => diagnostics.httpErrors),
    };
    result.assetSetupBoundaries = diagnosticControls.map(({ assetSetupBoundary }) => assetSetupBoundary);
    if (result.status === "passed" && !diagnosticsClean(result.diagnostics)) {
      result.status = "failed";
      result.error = `Browser diagnostics were not clean: ${JSON.stringify(result.diagnostics)}`;
    }
    lifecycle.event("case complete", { status: result.status, error: result.error ?? null });
    if (context) {
      lifecycle.markContextCloseBegin(context);
      await context.close().catch(() => {});
    }
    if (browser) {
      lifecycle.markBrowserCloseBegin();
      await browser.close().catch(() => {});
    }
    await lifecycle.flush();
    result.lifecycleLog = lifecycle.file;
  }
  return result;
}

async function runFullHudCase(browserType, engine, viewport) {
  const name = `${engine}-${viewport.width}x${viewport.height}`;
  const lifecycle = await createLifecycleDiagnostics({
    engine,
    viewport,
    caseType: "hud",
    name,
  });
  let browser = null;
  let context = null;
  let page = null;
  const diagnosticControls = [];
  const result = { type: "hud", engine, viewport, status: "failed", states: [] };
  try {
    lifecycle.setPhase("browser launch");
    browser = await browserType.launch({ headless: true });
    lifecycle.attachBrowser(browser);
    lifecycle.setPhase("context creation");
    context = await browser.newContext({ viewport });
    lifecycle.attachContext(context);
    const stage1 = await openBattlePage(context, "mission", { stageNumber: 1 }, lifecycle);
    diagnosticControls.push(stage1);
    page = stage1.page;

    lifecycle.setPhase("stage1-normal message settle");
    await waitForQuietBattleMessages(page, `${name}/stage1-normal`);
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
    const normal = await captureHudState(page, viewport, name, "stage1-normal", lifecycle);
    invariant(normal.semantic.stageId.includes("shopping-street")
      && !normal.semantic.bannerText
      && !normal.semantic.barkText
      && normal.semantic.bossKinds.length === 0,
    `${name}: Stage 1 normal HUD fixture drifted ${JSON.stringify(normal.semantic)}`);
    result.states.push(normal);

    const fiveUnitProof = await page.evaluate(() => (
      window.__ASHFALL_BATTLE_QA__.prepareManualAbilityProof([
        "scout",
        "ranger",
        "brawler",
        "medic",
        "gunner",
      ])
    ));
    invariant(fiveUnitProof?.ownerIds?.length === 5, `${name}: five-unit fixture was not created`);
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
    const fiveUnits = await captureHudState(page, viewport, name, "five-units", lifecycle);
    invariant(fiveUnits.semantic.humanCount === 5,
      `${name}: five-unit HUD state has ${fiveUnits.semantic.humanCount} live humans`);
    result.states.push(fiveUnits);

    const deploymentPrepared = await page.evaluate(() => (
      window.__ASHFALL_BATTLE_QA__.prepareCrawlerDefenseProof({
        attackerKind: "walker",
        lane: 1,
        existingClaim: false,
      })
    ));
    invariant(Number.isInteger(deploymentPrepared?.attackerId),
      `${name}: deployment-banner fixture is unavailable`);
    const deploymentStart = await queueAndPauseAtFirstDeploymentFrame(
      page,
      "kumaverson",
      `${name}/deployment-banner`,
    );
    invariant(deploymentStart.audit?.deploymentPlan?.checkpoint === "fully-inside",
      `${name}: deployment banner did not freeze the production progress-0 frame`);
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
    const deploymentFrame = await pauseAtDeploymentCheckpoint(
      page,
      deploymentStart.fighter.id,
      "first-visible",
      CRAWLER_DEPLOYMENT_CHECKPOINTS[1].progress,
      `${name}/deployment-banner-visible`,
    );
    invariant(deploymentFrame.audit?.deploymentPlan?.unitPass === "after-foreground-mask",
      `${name}: the first visible Kumaverson frame is still hidden behind the vehicle`);
    const deploymentBanner = await captureHudState(page, viewport, name, "deployment-banner", lifecycle);
    invariant(deploymentBanner.semantic.bannerText.includes("移動拠点から出撃"),
      `${name}: deployment banner copy is missing`);
    result.states.push(deploymentBanner);
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));

    const abilityProof = await page.evaluate(() => (
      window.__ASHFALL_BATTLE_QA__.prepareManualAbilityProof("medic")
    ));
    invariant(abilityProof?.ownerIds?.length === 1,
      `${name}: manual-ability fixture is unavailable`);
    const abilityButton = page.locator("button.manual-ability-ready:not([aria-disabled='true'])").first();
    await abilityButton.waitFor({ state: "visible", timeout });
    await abilityButton.click({ timeout });
    await page.waitForFunction(
      () => document.querySelector(".battle-banner")?.textContent?.includes("//")
        && (window.__ASHFALL_BATTLE_QA__.getSnapshot().manualAbilityReceipts?.length ?? 0) === 1,
      undefined,
      { timeout },
    );
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
    const abilityBanner = await captureHudState(page, viewport, name, "manual-ability-banner", lifecycle);
    invariant(abilityBanner.semantic.manualAbilityReceiptCount === 1
      && abilityBanner.semantic.bannerText.includes("緊急処置"),
    `${name}: manual ability banner did not use the production activation path`);
    result.states.push(abilityBanner);

    stage1.stop();
    lifecycle.markPageCloseBegin(page);
    await page.close();

    const stage3 = await openBattlePage(context, "mission", { stageNumber: 3 }, lifecycle);
    diagnosticControls.push(stage3);
    page = stage3.page;
    await waitForQuietBattleMessages(page, `${name}/objective-full`);
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
    const objective = await captureHudState(page, viewport, name, "objective-full", lifecycle);
    invariant(objective.semantic.objectiveFits && objective.semantic.objectiveText.startsWith("目標：")
      && objective.semantic.objectiveText.length >= 8,
    `${name}: full objective is missing or truncated ${JSON.stringify(objective.semantic)}`);
    result.states.push(objective);

    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
    const disabledControls = await createDisabledHudState(page, `${name}/support-disabled`, {
      minimumOpacity: mobileBattleHudLayout(viewport) ? .72 : null,
    });
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
    const disabled = await captureHudState(page, viewport, name, "support-disabled", lifecycle);
    invariant(disabled.layout.disabledUnitCount > 0 && disabled.layout.disabledSupportCount > 0,
      `${name}: disabled unit/support state did not remain visible`);
    result.states.push({ ...disabled, disabledControls });

    stage3.stop();
    lifecycle.setPhase("first browser teardown");
    lifecycle.markContextCloseBegin(context);
    await context.close();
    context = null;
    lifecycle.markBrowserCloseBegin();
    await browser.close();
    browser = null;
    page = null;

    lifecycle.setPhase("browser relaunch");
    browser = await browserType.launch({ headless: true });
    lifecycle.attachBrowser(browser);
    lifecycle.setPhase("context recreation");
    context = await browser.newContext({ viewport });
    lifecycle.attachContext(context);
    const bossStage3 = await openBattlePage(context, "mission", { stageNumber: 3 }, lifecycle);
    diagnosticControls.push(bossStage3);
    page = bossStage3.page;
    await waitForQuietBattleMessages(page, `${name}/boss-fixture`);
    const bossPrepared = await page.evaluate(
      () => window.__ASHFALL_BATTLE_QA__.prepareBossFoundationProof("takuya"),
    );
    invariant(bossPrepared?.kind === "takuya", `${name}: TAKUYA HUD fixture is unavailable`);
    const bossEntry = await page.waitForFunction(
      () => {
        const proof = window.__ASHFALL_BATTLE_QA__.getBossFoundationProof("takuya");
        return proof?.bossId && proof.gateEntering === true ? proof : null;
      },
      undefined,
      { timeout, polling: 10 },
    ).then((handle) => handle.jsonValue());
    invariant(Number.isInteger(bossEntry?.bossId), `${name}: TAKUYA entrance did not start`);
    await page.evaluate(
      (bossId) => window.__ASHFALL_BATTLE_QA__.accelerateBossFoundationEntry(bossId),
      bossEntry.bossId,
    );
    await page.waitForFunction(
      () => {
        const proof = window.__ASHFALL_BATTLE_QA__.getBossFoundationProof("takuya");
        return proof?.combatReady === true
          && document.querySelector(".battle-banner")
          && document.querySelector(".battle-barks")
          && document.querySelector(".boss-hud");
      },
      undefined,
      { timeout, polling: 10 },
    );
    const simultaneous = await captureHudState(page, viewport, name, "banner-bark-boss", lifecycle);
    invariant(simultaneous.layout.banner && simultaneous.layout.bark && simultaneous.layout.boss,
      `${name}: simultaneous banner, bark, and boss HUD state was not rendered`);
    result.states.push(simultaneous);

    await waitForQuietBattleMessages(page, `${name}/stage3-boss`);
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
    const boss = await captureHudState(page, viewport, name, "stage3-boss", lifecycle);
    invariant(boss.layout.boss && boss.semantic.bossKinds.includes("takuya")
      && !boss.semantic.bannerText && !boss.semantic.barkText,
    `${name}: clean Stage 3 boss HUD state was not retained`);
    result.states.push(boss);

    const expectedStateIds = canonicalHudStates;
    invariant(result.states.length === expectedStateIds.length
      && result.states.every((state, index) => state.id === expectedStateIds[index]),
    `${name}: eight-state HUD matrix is incomplete`);
    invariant(new Set(result.states.map(({ screenshotSha256 }) => screenshotSha256)).size === expectedStateIds.length,
      `${name}: HUD state screenshots are not semantically distinct`);
    result.status = "passed";
  } catch (error) {
    result.error = String(error);
    if (page && !page.isClosed()) {
      try {
        result.failureScreenshot = await screenshot(page, `${name}-hud-failed.png`);
      } catch {
        // Preserve the original failure.
      }
    }
  } finally {
    for (const control of diagnosticControls) control.stop();
    result.diagnostics = {
      consoleErrors: diagnosticControls.flatMap(({ diagnostics }) => diagnostics.consoleErrors),
      pageErrors: diagnosticControls.flatMap(({ diagnostics }) => diagnostics.pageErrors),
      requestFailures: diagnosticControls.flatMap(({ diagnostics }) => diagnostics.requestFailures),
      httpErrors: diagnosticControls.flatMap(({ diagnostics }) => diagnostics.httpErrors),
    };
    result.assetSetupBoundaries = diagnosticControls.map(({ assetSetupBoundary }) => assetSetupBoundary);
    if (result.status === "passed" && !diagnosticsClean(result.diagnostics)) {
      result.status = "failed";
      result.error = `Browser diagnostics were not clean: ${JSON.stringify(result.diagnostics)}`;
    }
    lifecycle.event("case complete", { status: result.status, error: result.error ?? null });
    if (context) {
      lifecycle.markContextCloseBegin(context);
      await context.close().catch(() => {});
    }
    if (browser) {
      lifecycle.markBrowserCloseBegin();
      await browser.close().catch(() => {});
    }
    await lifecycle.flush();
    result.lifecycleLog = lifecycle.file;
  }
  return result;
}

async function pauseAtEquipmentPhase(page, kind, expectedPhase, label) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const runtime = await page.evaluate((runtimeKind) => {
      const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
      return runtimeKind === "barrage" ? snapshot.crawlerAbility : snapshot.airstrike;
    }, kind);
    const resolved = kind === "barrage"
      ? crawlerBarrageSpritePhase(runtime, CRAWLER_BARRAGE_DEF)
      : crawlerAirstrikeSpritePhase(runtime, AIRSTRIKE_DEF);
    if (resolved === expectedPhase) {
      await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true));
      const frozenRuntime = await page.evaluate((runtimeKind) => {
        const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
        return runtimeKind === "barrage" ? snapshot.crawlerAbility : snapshot.airstrike;
      }, kind);
      const frozenPhase = kind === "barrage"
        ? crawlerBarrageSpritePhase(frozenRuntime, CRAWLER_BARRAGE_DEF)
        : crawlerAirstrikeSpritePhase(frozenRuntime, AIRSTRIKE_DEF);
      if (frozenPhase === expectedPhase) return { runtime: frozenRuntime, authoredPhase: frozenPhase };
      await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
    }
    await page.waitForTimeout(3);
  }
  throw new Error(`${label}: timed out waiting for authored ${kind} phase ${expectedPhase}`);
}

async function loadedCrawlerAssets(page, label) {
  const loadedKeys = await page.evaluate(() => window.__ASHFALL_ASSET_QA__.getLoadedSpriteKeys());
  const requiredKeys = [
    "crawlerHostClosed",
    "crawlerDeploymentBase",
    "crawlerForegroundMask",
    "crawlerBarrageEquipment",
    "crawlerAirstrikeEquipment",
  ];
  invariant(requiredKeys.every((key) => loadedKeys.includes(key)),
    `${label}: CRAWLER sprites are not resident ${JSON.stringify({ requiredKeys, loadedKeys })}`);
  return { requiredKeys, loadedKeys };
}

async function runEquipmentCase(browser, engine, viewport, runtimeEvidence, lifecycle = null) {
  const name = `${engine}-${viewport.width}x${viewport.height}`;
  const context = await browser.newContext({ viewport });
  lifecycle?.attachContext(context);
  let page;
  let stopDiagnostics = () => {};
  let diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  const result = { type: "crawler-equipment", engine, viewport, status: "failed" };
  try {
    lifecycle?.setPhase("crawler equipment setup");
    ({ page, stop: stopDiagnostics, diagnostics } = await openBattlePage(context, "mission", {}, lifecycle));
    const assets = await loadedCrawlerAssets(page, name);

    const barrage = [];
    await page.evaluate(() => {
      window.__ASHFALL_BATTLE_QA__.prepareV099CrawlerInputProof();
      window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true);
    });
    for (const [index, phase] of CRAWLER_BARRAGE_SPRITE_PHASES.entries()) {
      lifecycle?.setPhase(`crawler barrage/${phase}`);
      if (index === 1) {
        await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
        await page.keyboard.press("g");
      }
      const evidence = await pauseAtEquipmentPhase(page, "barrage", phase, name);
      lifecycle?.event("equipment phase complete", { page, equipment: "barrage", phase });
      const screenshotPath = await screenshot(page, `${name}-crawler-barrage-${index}-${phase}.png`);
      barrage.push({
        phase,
        ...evidence,
        screenshot: screenshotPath,
        screenshotSha256: await evidenceSha256(screenshotPath),
      });
      if (index < CRAWLER_BARRAGE_SPRITE_PHASES.length - 1) {
        await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
      }
    }

    const airstrike = [];
    const airstrikePrepared = await page.evaluate(() => {
      const prepared = window.__ASHFALL_BATTLE_QA__.prepareV099AirstrikeInputProof();
      window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true);
      return prepared;
    });
    for (const [index, phase] of CRAWLER_AIRSTRIKE_SPRITE_PHASES.entries()) {
      lifecycle?.setPhase(`crawler airstrike/${phase}`);
      if (index === 1) {
        await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
        await page.keyboard.press("q");
        invariant(await page.locator("button.support-btn.airstrike").evaluate(
          (button) => button.classList.contains("selected"),
        ), `${name}: Q did not select the production airstrike input`);
        const prepared = await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getSnapshot().airstrike);
        invariant(prepared.phase === "idle", `${name}: airstrike changed before battlefield placement`);
        const point = await clientPointForWorld(page, {
          x: airstrikePrepared.targetX,
          y: airstrikePrepared.targetY,
        });
        await page.mouse.click(point.x, point.y);
      }
      const evidence = await pauseAtEquipmentPhase(page, "airstrike", phase, name);
      lifecycle?.event("equipment phase complete", { page, equipment: "airstrike", phase });
      const screenshotPath = await screenshot(page, `${name}-crawler-airstrike-${index}-${phase}.png`);
      airstrike.push({
        phase,
        ...evidence,
        screenshot: screenshotPath,
        screenshotSha256: await evidenceSha256(screenshotPath),
      });
      if (index < CRAWLER_AIRSTRIKE_SPRITE_PHASES.length - 1) {
        await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
      }
    }

    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
    await page.waitForFunction(
      () => window.__ASHFALL_BATTLE_QA__.getSnapshot().airstrike.phase === "idle",
      undefined,
      { timeout, polling: 5 },
    );
    const simultaneousTarget = await page.evaluate(
      () => window.__ASHFALL_BATTLE_QA__.prepareV099AirstrikeInputProof(),
    );
    await page.keyboard.press("q");
    const simultaneousPoint = await clientPointForWorld(page, {
      x: simultaneousTarget.targetX,
      y: simultaneousTarget.targetY,
    });
    await page.mouse.click(simultaneousPoint.x, simultaneousPoint.y);
    await page.waitForFunction(
      () => window.__ASHFALL_BATTLE_QA__.getSnapshot().airstrike.phase !== "idle",
      undefined,
      { timeout, polling: 5 },
    );
    await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.prepareV099CrawlerInputProof());
    await nextRender(page);
    await page.keyboard.press("g");
    const simultaneous = await page.evaluate(async (maximumMs) => {
      const startedAt = performance.now();
      while (performance.now() - startedAt < maximumMs) {
        const snapshot = window.__ASHFALL_BATTLE_QA__.getSnapshot();
        if (snapshot.crawlerAbility.phase !== "ready"
          && snapshot.crawlerAbility.phase !== "cooldown"
          && snapshot.airstrike.phase !== "idle") {
          window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(true);
          return { crawlerAbility: snapshot.crawlerAbility, airstrike: snapshot.airstrike };
        }
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      throw new Error("simultaneous CRAWLER equipment state timed out");
    }, timeout);
    const simultaneousPhases = {
      barrage: crawlerBarrageSpritePhase(simultaneous.crawlerAbility, CRAWLER_BARRAGE_DEF),
      airstrike: crawlerAirstrikeSpritePhase(simultaneous.airstrike, AIRSTRIKE_DEF),
    };
    invariant(simultaneousPhases.barrage !== "stowed" && simultaneousPhases.airstrike !== "stowed",
      `${name}: simultaneous authored equipment did not deploy ${JSON.stringify(simultaneousPhases)}`);
    const simultaneousScreenshot = await screenshot(page, `${name}-crawler-equipment-simultaneous.png`);

    invariant(new Set(barrage.map(({ phase }) => phase)).size === 7,
      `${name}: barrage phase evidence is incomplete`);
    invariant(new Set(airstrike.map(({ phase }) => phase)).size === 7,
      `${name}: airstrike phase evidence is incomplete`);
    invariant(new Set(barrage.map(({ screenshotSha256 }) => screenshotSha256)).size === 7,
      `${name}: barrage runtime phase screenshots are not distinct`);
    invariant(new Set(airstrike.map(({ screenshotSha256 }) => screenshotSha256)).size === 7,
      `${name}: airstrike runtime phase screenshots are not distinct`);
    const contactSheets = {
      barrage: await crawlerRuntimeContactSheet(name, "barrage", viewport, barrage),
      airstrike: await crawlerRuntimeContactSheet(name, "airstrike", viewport, airstrike),
    };
    Object.assign(result, {
      status: "passed",
      assets,
      runtimeEvidence,
      barrage,
      airstrike,
      contactSheets,
      simultaneous: { ...simultaneous, authoredPhases: simultaneousPhases },
      screenshots: {
        idle: barrage[0].screenshot,
        simultaneous: simultaneousScreenshot,
      },
    });
  } catch (error) {
    result.error = String(error);
    if (page && !page.isClosed()) {
      try {
        result.failureScreenshot = await screenshot(page, `${name}-crawler-equipment-failed.png`);
      } catch {
        // Preserve the original failure.
      }
    }
  } finally {
    stopDiagnostics();
    result.diagnostics = diagnostics;
    if (result.status === "passed" && !diagnosticsClean(diagnostics)) {
      result.status = "failed";
      result.error = `Browser diagnostics were not clean: ${JSON.stringify(diagnostics)}`;
    }
    lifecycle?.event("case complete", { status: result.status, error: result.error ?? null });
    lifecycle?.markContextCloseBegin(context);
    await context.close();
    if (lifecycle?.file) result.lifecycleLog = lifecycle.file;
  }
  return result;
}

function validDeploymentAuditScratchReceipt(audit) {
  return audit?.scratchSurface?.schema === "v100-fighter-unit-layer-audit-scratch/v1"
    && audit.scratchSurface.kind === "detached-dom-canvas"
    && audit.scratchSurface.surfaceCount === 1
    && audit.scratchSurface.contextCount === 1
    && audit.scratchSurface.passCount === 6;
}

async function withDeploymentPresentationQuiescence(
  page,
  owner,
  label,
  captureTrace,
  operation,
  checkpointArmRequest = null,
) {
  const armEnvelope = await page.evaluate(({ requestedOwner, requestedCheckpointArm }) => {
    const bridge = window.__ASHFALL_BATTLE_QA__;
    if (typeof bridge?.setQaPresentationQuiesced !== "function"
      || typeof bridge?.getQaPresentationQuiescence !== "function") {
      throw new Error("deployment presentation quiescence bridge is unavailable");
    }
    let checkpointArm = null;
    if (requestedCheckpointArm !== null) {
      if (typeof bridge.armCrawlerDeploymentCheckpoint !== "function") {
        throw new Error("deployment checkpoint arm bridge is unavailable");
      }
      checkpointArm = bridge.armCrawlerDeploymentCheckpoint(
        requestedCheckpointArm.fighterId,
        requestedCheckpointArm.checkpoint,
      );
      if (!(checkpointArm?.schema === "v099-crawler-deployment-checkpoint-arm/v1"
        && checkpointArm.armed === true
        && checkpointArm.fighterId === requestedCheckpointArm.fighterId
        && checkpointArm.checkpoint === requestedCheckpointArm.checkpoint
        && Math.abs(checkpointArm.minimumProgress - requestedCheckpointArm.minimumProgress) <= 1e-6)) {
        throw new Error(`deployment checkpoint arm rejected or changed the canonical minimum ${JSON.stringify(checkpointArm)}`);
      }
    }
    return {
      checkpointArm,
      presentation: bridge.setQaPresentationQuiesced(true, requestedOwner),
    };
  }, { requestedOwner: owner, requestedCheckpointArm: checkpointArmRequest });
  const arm = armEnvelope.presentation;
  if (captureTrace) await captureTrace();
  invariant(arm?.schema === "v100-qa-presentation-quiescence/v1"
    && arm.active === true
    && arm.owner === owner
    && arm.route === "deployment"
    && arm.datasetActive === true
    && arm.running === true
    && arm.paused !== true
    && arm.over !== true,
  `${label}: deployment presentation quiescence did not arm ${JSON.stringify(arm)}`);

  let value;
  let operationError = null;
  try {
    value = await operation(armEnvelope.checkpointArm);
  } catch (error) {
    operationError = error;
  }

  let release = null;
  let releaseError = null;
  if (!page.isClosed()) {
    try {
      release = await page.evaluate((requestedOwner) => (
        window.__ASHFALL_BATTLE_QA__?.setQaPresentationQuiesced?.(false, requestedOwner) ?? null
      ), owner);
      if (captureTrace) await captureTrace();
    } catch (error) {
      releaseError = error;
    }
  }
  if (operationError) {
    if (releaseError) {
      throw new Error(`${String(operationError)}; presentation release also failed: ${String(releaseError)}`);
    }
    throw operationError;
  }
  if (releaseError) throw releaseError;
  invariant(release?.schema === "v100-qa-presentation-quiescence/v1"
    && release.active === false
    && release.owner === owner
    && release.route === "deployment"
    && release.datasetActive === false
    && release.running === true
    && release.paused === true
    && release.over !== true,
  `${label}: deployment presentation quiescence did not release at the semantic pause ${JSON.stringify(release)}`);
  invariant(Number(release.releasedAtRenderFrames) === Number(release.enteredAtRenderFrames),
    `${label}: a production render escaped the deployment quiescence window ${JSON.stringify(release)}`);
  invariant(Number(release.releasedAtSimulationTicks) > Number(release.enteredAtSimulationTicks),
    `${label}: deployment simulation did not advance while presentation was quiesced ${JSON.stringify(release)}`);
  invariant(Number(release.suppressedRenderFrames) > 0,
    `${label}: deployment quiescence suppressed no scheduled render ${JSON.stringify(release)}`);

  const restoredHandle = await page.waitForFunction(({ requestedOwner, releasedRenderFrames }) => {
    const bridge = window.__ASHFALL_BATTLE_QA__;
    const quiescence = bridge?.getQaPresentationQuiescence?.();
    const canvas = document.querySelector("canvas.battlefield");
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const style = getComputedStyle(canvas);
    const restored = quiescence?.schema === "v100-qa-presentation-quiescence/v1"
      && quiescence.active === false
      && quiescence.owner === requestedOwner
      && quiescence.route === "deployment"
      && quiescence.datasetActive === false
      && quiescence.running === true
      && quiescence.paused === true
      && quiescence.over !== true
      && Number(quiescence.renderFrames) >= Number(releasedRenderFrames) + 3
      && style.display !== "none"
      && style.visibility !== "hidden"
      && Number(style.opacity) > 0
      && rect.width > 0
      && rect.height > 0;
    return restored ? {
      quiescence,
      canvas: {
        width: rect.width,
        height: rect.height,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
      },
    } : false;
  }, { requestedOwner: owner, releasedRenderFrames: release.releasedAtRenderFrames }, {
    timeout: Math.min(timeout, 10_000),
    polling: 50,
  });
  const restored = await restoredHandle.jsonValue();
  await restoredHandle.dispose();
  if (captureTrace) await captureTrace();
  return {
    value,
    presentationQuiescence: {
      schema: "v100-deployment-presentation-quiescence-receipt/v1",
      owner,
      checkpointArm: armEnvelope.checkpointArm,
      arm,
      release,
      restored,
    },
  };
}

async function refreshDeploymentEvidenceAfterRestoredFrames(
  page,
  evidence,
  fighterId,
  unitKind,
  expectedCheckpoint,
  expectedProgress,
  label,
) {
  const presentation = evidence?.presentationQuiescence;
  invariant(presentation?.schema === "v100-deployment-presentation-quiescence-receipt/v1"
    && Number(presentation.restored?.quiescence?.renderFrames)
      >= Number(presentation.release?.releasedAtRenderFrames) + 3,
  `${label}: post-restoration readback started before three production frames`);
  const refreshed = await page.evaluate(({ id }) => {
    const bridge = window.__ASHFALL_BATTLE_QA__;
    const snapshot = bridge?.getCrawlerDeploymentProofSnapshot?.({ fighterId: id }) ?? null;
    return {
      schema: snapshot?.schema ?? null,
      screen: snapshot?.screen ?? null,
      running: snapshot?.running ?? null,
      paused: snapshot?.paused ?? null,
      over: snapshot?.over ?? null,
      computedProgress: snapshot?.computedProgress ?? null,
      checkpointReceipt: snapshot?.checkpointReceipt ?? null,
      fighter: snapshot?.fighter ?? null,
    };
  }, { id: fighterId });
  const previousFighter = evidence?.fighter;
  const fighter = refreshed.fighter;
  invariant(refreshed.schema === "v099-crawler-deployment-snapshot/v1"
    && refreshed.screen === "battle"
    && refreshed.running === true
    && refreshed.paused === true
    && refreshed.over !== true,
  `${label}: post-restoration production snapshot is not the frozen live battle`);
  invariant(fighter?.id === fighterId
    && fighter.kind === unitKind
    && fighter.x === previousFighter?.x
    && fighter.y === previousFighter?.y
    && fighter.gateEntering === previousFighter?.gateEntering
    && fighter.combatReady === previousFighter?.combatReady
    && fighter.entryRampCleared === previousFighter?.entryRampCleared
    && refreshed.computedProgress === evidence?.observedProgress,
  `${label}: post-restoration production snapshot drifted from the accepted semantic pause`);
  if (expectedCheckpoint === "fully-inside") {
    invariant(expectedProgress === 0
      && refreshed.computedProgress === 0
      && refreshed.checkpointReceipt === null,
    `${label}: fully-inside post-restoration readback acquired a noncanonical receipt`);
  } else {
    const receipt = refreshed.checkpointReceipt;
    invariant(receipt?.schema === "v099-crawler-deployment-checkpoint-receipt/v1"
      && receipt.fighterId === fighterId
      && receipt.kind === unitKind
      && receipt.checkpoint === expectedCheckpoint
      && receipt.x === fighter.x
      && receipt.y === fighter.y
      && receipt.computedProgress === refreshed.computedProgress
      && receipt.computedProgress + 1e-6 >= expectedProgress,
    `${label}: post-restoration checkpoint receipt lost exact semantic ownership`);
  }
  invariant(fighter.renderAudit?.drawCount >= 1
    && fighter.renderAudit?.renderSequence >= 1
    && fighter.renderAudit?.x === fighter.x
    && fighter.renderAudit?.y === fighter.y
    && fighter.renderAudit?.deploymentPlan?.checkpoint === expectedCheckpoint
    && fighter.renderAudit?.poseOpacity === 1
    && fighter.renderAudit?.effectiveOpacity === 1
    && fighter.animationPose?.opacity === 1,
  `${label}: restored production frames did not record an opaque fighter render`);
  return {
    ...evidence,
    fighter,
    observedProgress: refreshed.computedProgress,
    checkpointReceipt: refreshed.checkpointReceipt,
    postRestorationReadback: {
      schema: "v100-deployment-post-restoration-readback/v1",
      restoredRenderFrames: presentation.restored.quiescence.renderFrames,
      releasedAtRenderFrames: presentation.release.releasedAtRenderFrames,
      fighterId,
      unitKind,
      checkpoint: expectedCheckpoint,
      computedProgress: refreshed.computedProgress,
      renderSequence: fighter.renderAudit.renderSequence,
    },
  };
}

async function pauseAtDeploymentCheckpoint(
  page,
  fighterId,
  checkpoint,
  minimumProgress,
  label,
  captureTrace = null,
  prearmedCheckpoint = null,
) {
  try {
    const arm = prearmedCheckpoint ?? await page.evaluate(({ id, expectedCheckpoint }) => (
      window.__ASHFALL_BATTLE_QA__.armCrawlerDeploymentCheckpoint(id, expectedCheckpoint)
    ), { id: fighterId, expectedCheckpoint: checkpoint });
    if (captureTrace) await captureTrace();
    invariant(arm?.schema === "v099-crawler-deployment-checkpoint-arm/v1"
      && arm.armed === true
      && arm.fighterId === fighterId
      && arm.checkpoint === checkpoint
      && Math.abs(arm.minimumProgress - minimumProgress) <= 1e-6,
    `${label}: deployment checkpoint arm rejected or changed the canonical minimum`);
    const startedAt = Date.now();
    let lastSnapshot = null;
    while (Date.now() - startedAt < timeout) {
      await hostTurn(DEPLOYMENT_FIRST_FRAME_SAMPLE_INTERVAL_MS);
      const candidate = await page.evaluate(({ id, expectedCheckpoint }) => {
        const qa = window.__ASHFALL_BATTLE_QA__;
        const snapshot = qa.getCrawlerDeploymentProofSnapshot({ fighterId: id });
        const receipt = snapshot?.checkpointReceipt ?? null;
        return {
          ready: snapshot?.schema === "v099-crawler-deployment-snapshot/v1"
            && snapshot.paused === true
            && receipt?.schema === "v099-crawler-deployment-checkpoint-receipt/v1"
            && receipt.fighterId === id
            && receipt.checkpoint === expectedCheckpoint,
          snapshot,
        };
      }, { id: fighterId, expectedCheckpoint: checkpoint });
      if (captureTrace) await captureTrace();
      lastSnapshot = candidate.snapshot;
      if (candidate.snapshot?.checkpointReceipt
        && (candidate.snapshot.checkpointReceipt.fighterId !== fighterId
          || candidate.snapshot.checkpointReceipt.checkpoint !== checkpoint)) {
        throw new Error(`deployment checkpoint receipt mismatch ${JSON.stringify(candidate.snapshot.checkpointReceipt)}`);
      }
      if (candidate.ready === true) {
        await hostTurn(DEPLOYMENT_FIRST_FRAME_SAMPLE_INTERVAL_MS);
        const frozen = await page.evaluate(({ id, expectedCheckpoint }) => {
          const qa = window.__ASHFALL_BATTLE_QA__;
          const snapshot = qa.getCrawlerDeploymentProofSnapshot({ fighterId: id });
          const audit = snapshot?.fighter ? qa.auditFighterUnitLayer(id) : null;
          return {
            fighter: snapshot?.fighter ?? null,
            audit,
            observedProgress: snapshot?.computedProgress ?? null,
            checkpointReceipt: snapshot?.checkpointReceipt ?? null,
            paused: snapshot?.paused === true,
            exactReceipt: snapshot?.checkpointReceipt?.schema === "v099-crawler-deployment-checkpoint-receipt/v1"
              && snapshot.checkpointReceipt.fighterId === id
              && snapshot.checkpointReceipt.checkpoint === expectedCheckpoint,
          };
        }, { id: fighterId, expectedCheckpoint: checkpoint });
        if (captureTrace) await captureTrace();
        const receipt = frozen.checkpointReceipt;
        if (frozen.paused === true
          && frozen.exactReceipt === true
          && frozen.fighter?.id === receipt?.fighterId
          && frozen.fighter?.x === receipt?.x
          && frozen.fighter?.y === receipt?.y
          && frozen.observedProgress === receipt?.computedProgress
          && frozen.audit?.deploymentPlan?.checkpoint === checkpoint
          && validDeploymentAuditScratchReceipt(frozen.audit)
          && frozen.observedProgress + 1e-6 >= minimumProgress) {
          return frozen;
        }
        throw new Error(`deployment checkpoint receipt was not stable ${JSON.stringify(frozen)}`);
      }
    }
    throw new Error(`deployment checkpoint ${checkpoint} timed out; last=${JSON.stringify(lastSnapshot)}`);
  } catch (error) {
    throw new Error(`${label}: ${String(error)}`);
  }
}

async function queueAndPauseAtFirstDeploymentFrame(page, unitKind, label, captureTrace = null) {
  try {
    await page.evaluate((kind) => {
      const qa = window.__ASHFALL_BATTLE_QA__;
      if (qa.queueCrawlerDefenseUnit(kind, 1) !== true) {
        throw new Error(`CRAWLER queue rejected ${kind}`);
      }
    }, unitKind);
    if (captureTrace) await captureTrace();
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
      const candidate = await page.evaluate((kind) => {
        const qa = window.__ASHFALL_BATTLE_QA__;
        const snapshot = qa.getCrawlerDeploymentProofSnapshot({ kind });
        const fighter = snapshot?.fighter ?? null;
        if (!fighter) return null;
        const battleLive = snapshot?.schema === "v099-crawler-deployment-snapshot/v1"
          && snapshot.screen === "battle"
          && snapshot.running === true
          && snapshot.paused !== true
          && snapshot.over !== true;
        if (!battleLive) {
          return {
            ready: false,
            terminal: true,
            state: snapshot ? {
              screen: snapshot.screen,
              running: snapshot.running,
              paused: snapshot.paused,
              over: snapshot.over,
            } : null,
          };
        }
        const bannerReady = snapshot.banner?.includes("移動拠点から出撃") === true;
        const progress = snapshot.computedProgress;
        if (!(fighter.kind === kind && bannerReady && progress === 0)) return { ready: false };
        qa.setRepresentativeSixProofPaused(true);
        return { ready: true, fighterId: fighter.id, fighterX: fighter.x, observedProgress: progress };
      }, unitKind);
      if (captureTrace) await captureTrace();
      if (candidate?.terminal === true) {
        throw new Error(`production battle ended before the first deployment frame ${JSON.stringify(candidate.state)}`);
      }
      if (candidate?.ready === true) {
        await hostTurn(DEPLOYMENT_FIRST_FRAME_SAMPLE_INTERVAL_MS);
        const frozen = await page.evaluate(({ fighterId, expectedX }) => {
          const qa = window.__ASHFALL_BATTLE_QA__;
          const snapshot = qa.getCrawlerDeploymentProofSnapshot({ fighterId });
          const fighter = snapshot?.fighter ?? null;
          const audit = fighter ? qa.auditFighterUnitLayer(fighterId) : null;
          return {
            fighter,
            audit,
            observedProgress: snapshot?.computedProgress ?? null,
            frozen: fighter?.x === expectedX,
          };
        }, { fighterId: candidate.fighterId, expectedX: candidate.fighterX });
        if (captureTrace) await captureTrace();
        if (frozen.frozen === true
          && frozen.audit?.deploymentPlan?.checkpoint === "fully-inside"
          && validDeploymentAuditScratchReceipt(frozen.audit)) {
          return frozen;
        }
        await page.evaluate(() => window.__ASHFALL_BATTLE_QA__.setRepresentativeSixProofPaused(false));
        if (captureTrace) await captureTrace();
      }
      await hostTurn(DEPLOYMENT_FIRST_FRAME_SAMPLE_INTERVAL_MS);
    }
    throw new Error(`first deployment frame for ${unitKind} timed out`);
  } catch (error) {
    throw new Error(`${label}: ${String(error)}`);
  }
}

function createDeploymentTrace(page, diagnosticControl, unit, getLifecyclePhase) {
  let expectedCheckpoint = null;
  let expectedProgress = null;
  let fighterId = null;
  let fixtureResult = null;
  let queueResult = null;
  const trace = createBoundedTrace({
    page,
    automaticInterval: false,
    readSample: async ({ elapsedWallMs }) => {
      const runtime = await page.evaluate(({ kind, id, checkpoint, progress }) => {
        const battleApi = window.__ASHFALL_BATTLE_QA__;
        const snapshot = battleApi?.getCrawlerDeploymentProofSnapshot?.({
          ...(id !== null ? { fighterId: id } : { kind }),
        }) ?? null;
        const fighter = snapshot?.fighter ?? null;
        return {
          documentVisibility: document.visibilityState,
          snapshot: snapshot ? {
            time: snapshot.time ?? null,
            paused: snapshot.paused ?? null,
            over: snapshot.over ?? null,
          } : null,
          fighterPresent: Boolean(fighter),
          fighterId: fighter?.id ?? id,
          fighter: fighter ? { id: fighter.id, x: fighter.x, y: fighter.y } : null,
          doorX: snapshot?.doorX ?? null,
          rampX: snapshot?.rampX ?? null,
          computedProgress: snapshot?.computedProgress ?? null,
          gateEntering: fighter?.gateEntering ?? null,
          combatReady: fighter?.combatReady ?? null,
          entryRampCleared: fighter?.entryRampCleared ?? null,
          checkpointArm: snapshot?.checkpointArm ?? null,
          checkpointReceipt: snapshot?.checkpointReceipt ?? null,
          readableSnapshot: snapshot ? {
            time: snapshot.time ?? null,
            paused: snapshot.paused ?? null,
            over: snapshot.over ?? null,
            screen: snapshot.screen ?? null,
          } : null,
          expectedCheckpoint: checkpoint,
          expectedProgress: progress,
        };
      }, {
        kind: unit.kind,
        id: fighterId,
        checkpoint: expectedCheckpoint,
        progress: expectedProgress,
      });
      const counts = diagnosticControl.traceCounts();
      return {
        elapsedWallMs,
        lifecyclePhase: getLifecyclePhase(),
        unitKind: unit.kind,
        unitFamily: unit.family,
        ...runtime,
        ...counts,
        diagnostics: counts,
      };
    },
  });
  return {
    setExpected(checkpoint, progress) {
      expectedCheckpoint = checkpoint;
      expectedProgress = progress;
    },
    setFighterId(id) {
      fighterId = id;
    },
    setFixtureResult(result) {
      fixtureResult = result;
    },
    setQueueResult(result) {
      queueResult = result;
    },
    capture: trace.capture,
    async stop() {
      const result = await trace.stop();
      return {
        ...result,
        unitKind: unit.kind,
        unitFamily: unit.family,
        expectedCheckpoint,
        expectedProgress,
        fixtureResult,
        queueResult,
        lifecyclePhase: getLifecyclePhase(),
        diagnostics: diagnosticControl.traceCounts(),
      };
    },
  };
}

function validateDeploymentCheckpoint(evidence, expectedFamily, expectedCheckpoint, label) {
  const { audit, fighter } = evidence;
  invariant(audit.deploymentPlan?.family === expectedFamily,
    `${label}: deployment family ${audit.deploymentPlan?.family}/${expectedFamily}`);
  invariant(audit.deploymentPlan?.checkpoint === expectedCheckpoint,
    `${label}: checkpoint ${audit.deploymentPlan?.checkpoint}/${expectedCheckpoint}`);
  if (expectedCheckpoint === "fully-inside") {
    invariant(evidence.observedProgress === 0,
      `${label}: fully-inside frame advanced to ${evidence.observedProgress}`);
  }
  invariant(audit.actual?.nonzeroPixels > 0 && audit.actual?.bounds,
    `${label}: production unit layer disappeared`);
  invariant(audit.opaque?.nonzeroPixels > 0 && audit.opaque?.bounds,
    `${label}: opaque reference unit layer disappeared`);
  invariant(audit.alphaOneFromFirstVisibleFrame === true,
    `${label}: deployment unit was not alpha 1`);
  invariant(audit.opacityComparison?.maskIoU >= .999
    && audit.opacityComparison?.normalizedAlphaL1 <= .001,
  `${label}: deployment alpha differs from the opaque reference`);
  invariant(audit.clipRect === null && audit.clipMode === "none",
    `${label}: legacy deployment clip remains`);
  invariant(audit.unitDrawCount === 1, `${label}: unit draw count ${audit.unitDrawCount}`);
  invariant(audit.finalCompositePixels?.pass === true,
    `${label}: final battle canvas RGBA failed ${JSON.stringify(audit.finalCompositePixels)}`);
  invariant(audit.finalCompositePixels?.fractionalForegroundPixels === 0,
    `${label}: CRAWLER foreground has fractional global alpha`);
  invariant(audit.finalCompositePixels?.singleUnitSilhouette === true,
    `${label}: duplicate or ghost unit silhouette detected`);
  invariant(audit.finalCompositePixels?.finalCanvasKeepsUnitOpaque === true,
    `${label}: final canvas does not retain opaque unit pixels`);
  invariant(fighter?.renderAudit?.poseOpacity === 1
    && fighter?.renderAudit?.effectiveOpacity === 1
    && fighter?.animationPose?.opacity === 1,
  `${label}: live fighter render remained translucent`);
  if (expectedCheckpoint === "fully-outside") {
    invariant(audit.deploymentPlan.active === false
      && audit.deploymentPlan.checkpoint === "fully-outside",
    `${label}: fully-outside unit retained an interior pass`);
  } else {
    invariant(audit.deploymentPlan.active === true,
      `${label}: deployment plan became inactive before the ramp exit`);
    const expectedUnitPass = evidence.observedProgress >= CRAWLER_FOREGROUND_CLEAR_PROGRESS
      ? "after-foreground-mask"
      : "before-foreground-mask";
    invariant(audit.deploymentPlan.unitPass === expectedUnitPass,
      `${label}: physical CRAWLER door-plane ownership is incorrect`);
  }
}

async function runDeploymentCase(browser, engine, viewport, lifecycle = null) {
  const name = `${engine}-${viewport.width}x${viewport.height}`;
  const context = await browser.newContext({ viewport });
  lifecycle?.attachContext(context);
  let page;
  let stopDiagnostics = () => {};
  let diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  let traceCounts = () => ({
    consoleErrorCount: diagnostics.consoleErrors.length,
    pageErrorCount: diagnostics.pageErrors.length,
    requestFailureCount: diagnostics.requestFailures.length,
    httpErrorCount: diagnostics.httpErrors.length,
    pendingRequestCount: 0,
  });
  let setupTrace = null;
  let assetSetupBoundary = null;
  let deploymentLifecyclePhase = "deployment setup";
  let activeDeploymentTrace = null;
  let activeUnitResult = null;
  let activeFixtureResult = null;
  let activeQueueResult = null;
  const setDeploymentPhase = (phase) => {
    deploymentLifecyclePhase = phase;
    lifecycle?.setPhase(phase);
  };
  const result = { type: "deployment", engine, viewport, status: "failed", units: [] };
  try {
    setDeploymentPhase("deployment setup");
    await withDeploymentDiagnosticOperation(
      lifecycle,
      "deployment/navigation-readiness-asset-boundary",
      { caseIdentity: name },
      async () => {
        ({ page, stop: stopDiagnostics, diagnostics, traceCounts, setupTrace, assetSetupBoundary } = await openBattlePage(
          context,
          "mission",
          { setupTrace: engine === "chromium", finiteAssets: true },
          lifecycle,
        ));
        if (setupTrace) result.setupTrace = setupTrace;
        result.assetSetupBoundary = assetSetupBoundary;
        await loadedCrawlerAssets(page, name);
      },
    );
    for (const unit of deploymentUnits) {
      invariant(crawlerDeploymentUnitFamily(unit.kind) === unit.family,
        `${name}/${unit.kind}: static deployment family mapping drifted`);
      const unitResult = { ...unit, checkpoints: [], status: "failed" };
      activeUnitResult = unitResult;
      activeFixtureResult = null;
      activeQueueResult = null;
      setDeploymentPhase(`deployment/${unit.family}/fixture`);
      activeDeploymentTrace = createDeploymentTrace(
        page,
        { traceCounts },
        unit,
        () => deploymentLifecyclePhase,
      );
      const unitDetails = { caseIdentity: name, unitFamily: unit.family, unitKind: unit.kind };
      const unitAsset = await withDeploymentDiagnosticOperation(
        lifecycle,
        "deployment/unit-asset-proof",
        unitDetails,
        () => page.evaluate(
          (kind) => window.__ASHFALL_BATTLE_QA__.ensureUnitRenderProofAsset(kind),
          unit.kind,
        ),
      );
      await withDeploymentDiagnosticOperation(
        lifecycle,
        "deployment/trace-capture",
        { ...unitDetails, traceBoundary: "unit-asset-proof" },
        () => activeDeploymentTrace.capture(),
      );
      invariant(unitAsset?.kind === unit.kind
        && typeof unitAsset.path === "string"
        && unitAsset.width > 0
        && unitAsset.height > 0,
      `${name}/${unit.kind}: strict unit asset decode failed ${JSON.stringify(unitAsset)}`);
      unitResult.asset = unitAsset;
      const prepared = await withDeploymentDiagnosticOperation(
        lifecycle,
        "deployment/fixture-preparation",
        unitDetails,
        () => page.evaluate((kind) => (
          window.__ASHFALL_BATTLE_QA__.prepareCrawlerDefenseProof({
            attackerKind: kind === "crazy-king" ? "crusher" : "walker",
            lane: 1,
            existingClaim: false,
          })
        ), unit.kind),
      );
      activeFixtureResult = prepared;
      activeDeploymentTrace.setFixtureResult(prepared);
      await withDeploymentDiagnosticOperation(
        lifecycle,
        "deployment/trace-capture",
        { ...unitDetails, traceBoundary: "fixture-preparation" },
        () => activeDeploymentTrace.capture(),
      );
      invariant(Number.isInteger(prepared?.attackerId),
        `${name}/${unit.kind}: deployment fixture is unavailable`);
      activeQueueResult = { requested: true, result: null };
      activeDeploymentTrace.setQueueResult(activeQueueResult);
      const firstFrameEnvelope = await withDeploymentDiagnosticOperation(
        lifecycle,
        "deployment/first-frame-queue-readback",
        unitDetails,
        () => withDeploymentPresentationQuiescence(
          page,
          "deployment-first-frame",
          `${name}/${unit.kind}/fully-inside`,
          activeDeploymentTrace.capture,
          () => queueAndPauseAtFirstDeploymentFrame(
            page,
            unit.kind,
            `${name}/${unit.kind}`,
            activeDeploymentTrace.capture,
          ),
        ),
      );
      const firstFrameBeforeProductionReadback = {
        ...firstFrameEnvelope.value,
        presentationQuiescence: firstFrameEnvelope.presentationQuiescence,
      };
      const firstFrame = await withDeploymentDiagnosticOperation(
        lifecycle,
        "deployment/post-restoration-readback",
        {
          ...unitDetails,
          requestedCheckpoint: "fully-inside",
          requestedProgress: 0,
        },
        () => refreshDeploymentEvidenceAfterRestoredFrames(
          page,
          firstFrameBeforeProductionReadback,
          firstFrameBeforeProductionReadback.fighter?.id ?? null,
          unit.kind,
          "fully-inside",
          0,
          `${name}/${unit.family}/fully-inside`,
        ),
      );
      activeQueueResult = { requested: true, result: firstFrame };
      activeDeploymentTrace.setQueueResult(activeQueueResult);
      const fighterId = firstFrame.fighter?.id ?? null;
      invariant(Number.isInteger(fighterId), `${name}/${unit.kind}: fighter identity is unavailable`);
      activeDeploymentTrace.setFighterId(fighterId);
      for (const [checkpointIndex, checkpoint] of CRAWLER_DEPLOYMENT_CHECKPOINTS.entries()) {
        let evidence = firstFrame;
        const label = `${name}/${unit.family}/${checkpoint.id}`;
        const checkpointDetails = {
          ...unitDetails,
          fighterId,
          requestedCheckpoint: checkpoint.id,
          requestedProgress: checkpoint.progress,
        };
        activeDeploymentTrace.setExpected(checkpoint.id, checkpoint.progress);
        setDeploymentPhase(`deployment checkpoint/${unit.family}/${checkpoint.id}`);
        lifecycle?.event("deployment checkpoint start", {
          page,
          family: unit.family,
          checkpoint: checkpoint.id,
          requestedCheckpoint: checkpoint.id,
          requestedProgress: checkpoint.progress,
        });
        if (checkpointIndex > 0) {
          const checkpointEnvelope = await withDeploymentDiagnosticOperation(
            lifecycle,
            "deployment/checkpoint-advance",
            checkpointDetails,
            () => withDeploymentPresentationQuiescence(
              page,
              "deployment-checkpoint-advance",
              label,
              activeDeploymentTrace.capture,
              (checkpointArm) => pauseAtDeploymentCheckpoint(
                page,
                fighterId,
                checkpoint.id,
                checkpoint.progress,
                label,
                activeDeploymentTrace.capture,
                checkpointArm,
              ),
              {
                fighterId,
                checkpoint: checkpoint.id,
                minimumProgress: checkpoint.progress,
              },
            ),
          );
          const checkpointBeforeProductionReadback = {
            ...checkpointEnvelope.value,
            presentationQuiescence: checkpointEnvelope.presentationQuiescence,
          };
          evidence = await withDeploymentDiagnosticOperation(
            lifecycle,
            "deployment/post-restoration-readback",
            checkpointDetails,
            () => refreshDeploymentEvidenceAfterRestoredFrames(
              page,
              checkpointBeforeProductionReadback,
              fighterId,
              unit.kind,
              checkpoint.id,
              checkpoint.progress,
              label,
            ),
          );
        }
        await withDeploymentDiagnosticOperation(
          lifecycle,
          "deployment/checkpoint-validation",
          checkpointDetails,
          async () => validateDeploymentCheckpoint(evidence, unit.family, checkpoint.id, label),
        );
        const receipt = checkpointIndex === 0 ? null : evidence.checkpointReceipt;
        if (checkpointIndex > 0) {
          invariant(receipt?.schema === "v099-crawler-deployment-checkpoint-receipt/v1"
            && receipt.fighterId === fighterId
            && receipt.kind === unit.kind
            && receipt.checkpoint === checkpoint.id
            && receipt.x === evidence.fighter?.x
            && receipt.y === evidence.fighter?.y
            && receipt.computedProgress === evidence.observedProgress
            && receipt.computedProgress + 1e-6 >= checkpoint.progress,
          `${label}: accepted checkpoint receipt was not serializable`);
        }
        const serializedCheckpointReceipt = receipt ? {
          schema: receipt.schema,
          fighterId: receipt.fighterId,
          kind: receipt.kind,
          checkpoint: receipt.checkpoint,
          x: receipt.x,
          y: receipt.y,
          computedProgress: receipt.computedProgress,
          battleTime: receipt.battleTime,
          gateEntering: receipt.gateEntering,
          combatReady: receipt.combatReady,
          entryRampCleared: receipt.entryRampCleared,
        } : null;
        const canvasCapture = await withDeploymentDiagnosticOperation(
          lifecycle,
          "deployment/final-canvas-png",
          checkpointDetails,
          () => deploymentCanvasPng(
            page,
            `${name}-deployment-${unit.family}-${unit.kind}-${checkpointIndex}-${checkpoint.id}.png`,
            label,
          ),
        );
        await withDeploymentDiagnosticOperation(
          lifecycle,
          "deployment/trace-capture",
          { ...checkpointDetails, traceBoundary: "final-canvas-png" },
          () => activeDeploymentTrace.capture(),
        );
        const screenshotPath = canvasCapture.path;
        const screenshotSha256 = await withDeploymentDiagnosticOperation(
          lifecycle,
          "deployment/hash-persistence",
          checkpointDetails,
          () => evidenceSha256(screenshotPath),
        );
        unitResult.checkpoints.push({
          checkpoint: checkpoint.id,
          requestedProgress: checkpoint.progress,
          observedCheckpoint: evidence.audit.deploymentPlan?.checkpoint ?? null,
          observedProgress: evidence.observedProgress ?? null,
          fighter: evidence.fighter,
          audit: evidence.audit,
          checkpointReceipt: serializedCheckpointReceipt,
          presentationQuiescence: evidence.presentationQuiescence ?? null,
          postRestorationReadback: evidence.postRestorationReadback ?? null,
          screenshot: screenshotPath,
          screenshotSha256,
          canvasCapture,
        });
        lifecycle?.event("deployment checkpoint complete", {
          page,
          family: unit.family,
          checkpoint: checkpoint.id,
          milestone: `${unit.family}/${checkpoint.id} deployment checkpoint complete`,
        });
      }
      const fullyInside = unitResult.checkpoints[0];
      const firstVisible = unitResult.checkpoints[1];
      invariant(fullyInside.observedCheckpoint === "fully-inside"
        && fullyInside.observedProgress === 0,
      `${name}/${unit.family}: production progress-0 frame was not retained`);
      invariant(firstVisible.observedCheckpoint === "first-visible"
        && firstVisible.observedProgress >= CRAWLER_DEPLOYMENT_CHECKPOINTS[1].progress
        && firstVisible.fighter.x > fullyInside.fighter.x,
      `${name}/${unit.family}: first-visible frame did not advance monotonically`);
      invariant(firstVisible.screenshotSha256 !== fullyInside.screenshotSha256,
        `${name}/${unit.family}: fully-inside and first-visible screenshots are identical`);
      invariant(unitResult.checkpoints.every((entry, index, entries) => (
        index === 0 || entry.fighter.x + 1e-6 >= entries[index - 1].fighter.x
      )), `${name}/${unit.family}: deployment position regressed between checkpoints`);
      const midpoint = unitResult.checkpoints.find(({ checkpoint }) => checkpoint === "half");
      const rampClear = unitResult.checkpoints.at(-1);
      invariant(midpoint?.observedProgress >= .5,
        `${name}/${unit.family}: midpoint evidence is missing`);
      invariant(rampClear?.observedCheckpoint === "fully-outside"
        && rampClear.fighter.entryRampCleared === true
        && rampClear.fighter.gateEntering === false
        && rampClear.fighter.combatReady === true,
      `${name}/${unit.family}: ramp-clear/combat-ready boundary is incomplete`);
      // Production intentionally flips ramp-cleared and combat-ready atomically.
      // Name the five acceptance keyframes explicitly while retaining the six
      // sampled frames and their original receipt/checkpoint data.
      unitResult.requiredKeyframes = {
        doorInside: fullyInside,
        firstVisible,
        midpoint,
        rampClear,
        combatReady: rampClear,
      };
      unitResult.contactSheet = await withDeploymentDiagnosticOperation(
        lifecycle,
        "deployment/contact-sheet",
        unitDetails,
        () => deploymentRuntimeContactSheet(
          name,
          unit.family,
          unit.kind,
          viewport,
          unitResult.checkpoints,
        ),
      );
      unitResult.deploymentTrace = await activeDeploymentTrace.stop();
      invariant(unitResult.deploymentTrace.captureMode === "cooperative-main-flow"
        && unitResult.deploymentTrace.overlapWaitCount === 0,
      `${name}/${unit.kind}: deployment trace page I/O was not cooperative`);
      activeDeploymentTrace = null;
      unitResult.status = "passed";
      unitResult.fighterId = fighterId;
      result.units.push(unitResult);
      activeUnitResult = null;
      activeFixtureResult = null;
      activeQueueResult = null;
    }
    invariant(result.units.length === deploymentUnits.length
      && result.units.every(({ status, checkpoints }) => (
        status === "passed" && checkpoints.length === CRAWLER_DEPLOYMENT_CHECKPOINTS.length
      )), `${name}: deployment matrix is incomplete`);
    result.status = "passed";
  } catch (error) {
    result.error = String(error);
    if (error?.setupTrace) result.setupTrace = error.setupTrace;
    if (error?.setupTracePageSignals) result.setupTracePageSignals = error.setupTracePageSignals;
    if (error?.setupTraceLastReadableSnapshot) {
      result.setupTraceLastReadableSnapshot = error.setupTraceLastReadableSnapshot;
    }
    if (error?.setupTraceFailureScreenshot) result.failureScreenshot = error.setupTraceFailureScreenshot;
    if (page && !page.isClosed() && !result.failureScreenshot) {
      try {
        result.failureScreenshot = await screenshot(page, `${name}-deployment-failed.png`);
      } catch {
        // Preserve the original failure.
      }
    }
  } finally {
    if (activeDeploymentTrace) {
      const deploymentTrace = await activeDeploymentTrace.stop();
      result.failedUnit = activeUnitResult ? {
        ...activeUnitResult,
        fixtureResult: activeFixtureResult,
        queueResult: activeQueueResult,
        deploymentTrace: {
          ...deploymentTrace,
          failureScreenshot: result.failureScreenshot ?? null,
        },
      } : {
        deploymentTrace: {
          ...deploymentTrace,
          failureScreenshot: result.failureScreenshot ?? null,
        },
      };
      activeDeploymentTrace = null;
    }
    stopDiagnostics();
    result.diagnostics = diagnostics;
    if (result.status === "passed" && !diagnosticsClean(diagnostics)) {
      result.status = "failed";
      result.error = `Browser diagnostics were not clean: ${JSON.stringify(diagnostics)}`;
    }
    lifecycle?.event("case complete", { status: result.status, error: result.error ?? null });
    lifecycle?.markContextCloseBegin(context);
    await context.close();
    if (lifecycle?.file) result.lifecycleLog = lifecycle.file;
    if (lifecycle?.hostResourceTelemetry) result.hostResourceTelemetry = lifecycle.hostResourceTelemetry;
  }
  return result;
}

const buildIdentityAtStart = await productionBuildIdentity();
const buildSentinel = path.resolve("dist/server/index.js");
const buildMtimeMs = (await stat(buildSentinel)).mtimeMs;
const latestInputMtimeMs = Math.max(
  await recursiveLatestMtimeMs(path.resolve("app")),
  await recursiveLatestMtimeMs(path.resolve("public")),
  (await stat(path.resolve("package.json"))).mtimeMs,
);
invariant(buildMtimeMs >= latestInputMtimeMs,
  "Production build is stale; rebuild before final-remediation browser QA");
const runtimeEvidence = await staticRuntimeEvidence();

for (const engine of engines) {
  const browserType = browserTypes[engine];
  invariant(browserType, `Unsupported browser engine: ${engine}`);
  for (const viewport of viewports) {
    if (caseTypes.includes("hud")) {
      if (hudStateFilterActive) {
        for (const stateId of hudStates) {
          results.push(await runIsolatedHudState(browserType, engine, viewport, stateId));
        }
      } else {
        results.push(await runFullHudCase(browserType, engine, viewport));
      }
    }
    if (caseTypes.includes("crawler-equipment") || caseTypes.includes("deployment")) {
      const lifecycleByCase = new Map();
      for (const caseType of ["crawler-equipment", "deployment"]) {
        if (caseTypes.includes(caseType)) {
          lifecycleByCase.set(caseType, await createLifecycleDiagnostics({
            engine,
            viewport,
            caseType,
            name: `${engine}-${viewport.width}x${viewport.height}`,
          }));
        }
      }
      let browser = null;
      let primaryFailure = null;
      const caseResults = new Map();
      try {
        lifecycleByCase.forEach((lifecycle) => lifecycle.setPhase("browser launch"));
        browser = await browserType.launch({ headless: true });
        lifecycleByCase.forEach((lifecycle) => lifecycle.attachBrowser(browser));
        if (caseTypes.includes("crawler-equipment")) {
          const equipmentResult = await runEquipmentCase(
            browser,
            engine,
            viewport,
            runtimeEvidence,
            lifecycleByCase.get("crawler-equipment"),
          );
          results.push(equipmentResult);
          caseResults.set("crawler-equipment", equipmentResult);
        }
        if (caseTypes.includes("deployment")) {
          const deploymentResult = await runDeploymentCase(
            browser,
            engine,
            viewport,
            lifecycleByCase.get("deployment"),
          );
          results.push(deploymentResult);
          caseResults.set("deployment", deploymentResult);
        }
      } catch (error) {
        primaryFailure = error;
        throw error;
      } finally {
        lifecycleByCase.forEach((lifecycle) => {
          lifecycle.setPhase("browser teardown");
          lifecycle.markBrowserCloseBegin();
        });
        let browserCleanupFailure = null;
        try {
          if (browser) await browser.close();
        } catch (cleanupError) {
          browserCleanupFailure = cleanupError;
          if (primaryFailure) primaryFailure.browserCleanupError = String(cleanupError);
        }
        for (const [caseType, lifecycle] of lifecycleByCase) {
          const caseResult = caseResults.get(caseType) ?? null;
          let telemetrySummary = null;
          try {
            telemetrySummary = await lifecycle.flush();
          } catch (telemetryError) {
            const priorFailure = primaryFailure ?? browserCleanupFailure ?? (caseResult?.status === "failed" ? caseResult : null);
            if (priorFailure) {
              priorFailure.hostResourceTelemetryFailure = {
                code: "WEBKIT_HOST_TELEMETRY_PERSISTENCE_FAILED",
                error: String(telemetryError),
              };
              continue;
            }
            throw telemetryError;
          }
          if (caseResult && telemetrySummary) {
            caseResult.hostResourceTelemetryStatus = telemetrySummary.status;
            caseResult.hostResourceTelemetryValidity = telemetrySummary.valid;
          }
          if (telemetrySummary?.supported === true && telemetrySummary.status !== "complete") {
            const telemetryFailure = {
              code: "WEBKIT_HOST_TELEMETRY_INVALID",
              status: telemetrySummary.status,
              invalidReason: telemetrySummary.invalidReason ?? null,
            };
            const priorFailure = primaryFailure ?? browserCleanupFailure ?? (caseResult?.status === "failed" ? caseResult : null);
            if (priorFailure) priorFailure.hostResourceTelemetryFailure = telemetryFailure;
            else throw Object.assign(new Error(`deployment host telemetry invalid: ${JSON.stringify(telemetryFailure)}`), telemetryFailure);
          }
        }
        if (browserCleanupFailure && !primaryFailure) {
          const failedCase = [...caseResults.values()].find(({ status }) => status === "failed");
          if (failedCase) failedCase.browserCleanupError = String(browserCleanupFailure);
          else throw browserCleanupFailure;
        }
      }
    }
  }
}

const buildIdentityAtEnd = await productionBuildIdentity();
const buildIdentityStable = buildIdentityAtStart.combinedSha256 === buildIdentityAtEnd.combinedSha256;
const casesPerAxis = caseTypes.filter((caseType) => caseType !== "hud").length
  + (caseTypes.includes("hud") ? (hudStateFilterActive ? hudStates.length : 1) : 0);
const expectedCaseCount = engines.length * viewports.length * casesPerAxis;
const canonicalAxes = engines.length === canonicalEngines.length
  && canonicalEngines.every((engine) => engines.includes(engine))
  && viewportKeys.length === canonicalViewports.length
  && canonicalViewports.every(({ width, height }) => viewportKeys.includes(`${width}x${height}`))
  && deploymentUnits.length === canonicalDeploymentUnits.length
  && !hudStateFilterActive
  && caseTypes.length === canonicalCaseTypes.length
  && canonicalCaseTypes.every((caseType) => caseTypes.includes(caseType));
const deploymentScreenshotCount = results.reduce((total, result) => (
  result.type === "deployment"
    ? total + result.units.reduce((sum, unit) => sum + unit.checkpoints.length, 0)
    : total
), 0);
const deploymentContactSheetCount = results.reduce((total, result) => (
  result.type === "deployment"
    ? total + result.units.filter(({ contactSheet }) => Boolean(contactSheet)).length
    : total
), 0);
const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl: String(baseUrl),
  canonicalAxes,
  engines,
  viewports,
  deploymentUnits,
  caseTypes,
  hudStates: caseTypes.includes("hud") ? hudStates : [],
  hudStateFilterActive,
  buildFreshness: {
    sentinel: relativeEvidencePath(buildSentinel),
    buildMtime: new Date(buildMtimeMs).toISOString(),
    latestProductionInputMtime: new Date(latestInputMtimeMs).toISOString(),
    fresh: buildMtimeMs >= latestInputMtimeMs,
  },
  buildIdentityAtStart,
  buildIdentityAtEnd,
  buildIdentityStable,
  runtimeEvidence,
  expectedCaseCount,
  total: results.length,
  passed: results.filter(({ status }) => status === "passed").length,
  failed: results.filter(({ status }) => status !== "passed").length,
  deploymentScreenshotCount,
  deploymentContactSheetCount,
  screenshotCount: results.reduce((total, result) => {
    if (result.type === "hud") return total + (result.status === "passed" ? result.states.length : 0);
    if (result.type === "crawler-equipment") {
      return total + (result.barrage?.length ?? 0) + (result.airstrike?.length ?? 0) + (result.simultaneous ? 1 : 0);
    }
    if (result.type === "deployment") {
      return total + result.units.reduce((sum, unit) => sum + unit.checkpoints.length, 0);
    }
    return total;
  }, 0),
  contactSheetCount: results.reduce((total, result) => (
    total
      + (result.type === "crawler-equipment" && result.contactSheets ? 2 : 0)
      + (result.type === "deployment"
        ? result.units.filter(({ contactSheet }) => Boolean(contactSheet)).length
        : 0)
  ), 0),
  results,
};
const artifactInventoryIntegrity = await inspectDeploymentArtifactIntegrity(results);
const deploymentOnly = caseTypes.length === 1 && caseTypes[0] === "deployment";
const countContract = {
  checkpointMatchesDeploymentSummary:
    artifactInventoryIntegrity.checkpoint.logicalCount === summary.deploymentScreenshotCount,
  contactSheetMatchesDeploymentSummary:
    artifactInventoryIntegrity.contactSheet.logicalCount === summary.deploymentContactSheetCount,
  checkpointMatchesRouteScreenshotCount: deploymentOnly
    ? artifactInventoryIntegrity.checkpoint.logicalCount === summary.screenshotCount
    : null,
  contactSheetMatchesRouteContactSheetCount: deploymentOnly
    ? artifactInventoryIntegrity.contactSheet.logicalCount === summary.contactSheetCount
    : null,
};
summary.deploymentArtifactIntegrity = {
  ...artifactInventoryIntegrity,
  ok: artifactInventoryIntegrity.ok
    && countContract.checkpointMatchesDeploymentSummary
    && countContract.contactSheetMatchesDeploymentSummary
    && countContract.checkpointMatchesRouteScreenshotCount !== false
    && countContract.contactSheetMatchesRouteContactSheetCount !== false,
  countContract,
};
const summaryPath = path.join(evidenceDir, "summary.json");
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  report: relativeEvidencePath(summaryPath),
  canonicalAxes,
  expectedCaseCount,
  total: summary.total,
  passed: summary.passed,
  failed: summary.failed,
  screenshotCount: summary.screenshotCount,
  deploymentArtifactIntegrity: summary.deploymentArtifactIntegrity,
  buildIdentityStable,
  cases: results.map(({ type, engine, viewport, status, error }) => ({
    type,
    engine,
    viewport: `${viewport.width}x${viewport.height}`,
    status,
    error,
  })),
}, null, 2));

invariant(summary.deploymentArtifactIntegrity.ok,
  `Deployment artifact integrity failed; see ${relativeEvidencePath(summaryPath)}`);
invariant(buildIdentityStable, "Production dist changed while final-remediation browser QA was running");
invariant(results.length === expectedCaseCount,
  `Final-remediation QA produced ${results.length}/${expectedCaseCount} cases`);
invariant(summary.failed === 0,
  `Final-remediation QA failed ${summary.failed}/${summary.total} cases; see ${relativeEvidencePath(summaryPath)}`);
if (canonicalAxes) {
  const expectedScreenshotsPerAxis = 8
    + 15
    + CRAWLER_DEPLOYMENT_CHECKPOINTS.length * canonicalDeploymentUnits.length;
  invariant(summary.screenshotCount === (engines.length * viewports.length * expectedScreenshotsPerAxis),
    `Canonical final-remediation screenshot matrix is incomplete: ${summary.screenshotCount}`);
  const expectedContactSheets = engines.length * viewports.length
    * (2 + canonicalDeploymentUnits.length);
  invariant(summary.contactSheetCount === expectedContactSheets,
    `Canonical final-remediation contact-sheet matrix is incomplete: ${summary.contactSheetCount}`);
}
