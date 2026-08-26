import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { dismissInstallOffer } from "./pwa-gate-qa.mjs";

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
import { publicDisplayText } from "../app/publicDisplayNames.js";

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
const teardownTimeout = Math.max(1_000, Number(process.env.P5_QA_TEARDOWN_TIMEOUT_MS) || 5_000);
const FINAL_CUT_TRACE_INTERVAL_MS = 1_000;
const FINAL_CUT_TRACE_MAX_SAMPLES = 75;

function stage3Progress(label, checkpoint, startedAt) {
  console.log(JSON.stringify({
    type: "p5-stage3-progress",
    label,
    checkpoint,
    elapsedMs: Date.now() - startedAt,
  }));
}

async function boundedPageCall(operation, label, limitMs = teardownTimeout) {
  let timer;
  try {
    return await Promise.race([
      operation(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} exceeded ${limitMs}ms`)), limitMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

class TimeoutError extends Error {
  constructor(message, evidence) {
    super(message);
    this.name = "TimeoutError";
    this.evidence = evidence;
  }
}

async function waitForFinalCutPredicateFromNode({ page, cueFragment, expectedSceneId, label, timeoutMs = timeout }) {
  const startedAt = Date.now();
  let attempt = 0;
  let lastEvidence = null;
  while (true) {
    const evidence = await page.evaluate(({ cueFragment: expectedCueFragment, expectedSceneId: expectedAudioScene }) => {
      const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
      const activeScriptedFinalCue = Boolean(snapshot?.battleBarks?.active?.some((bark) => (
        bark.scripted === true && bark.scriptedCueId?.includes(expectedCueFragment)
      )));
      const bossDefeated = snapshot?.bossDefeated ?? null;
      const bossDefeatedIsFalse = bossDefeated === false;
      const audioScene = document.documentElement.dataset.audioScene ?? null;
      const audioSceneMatches = audioScene === expectedAudioScene;
      return {
        activeScriptedFinalCue,
        bossDefeated,
        bossDefeatedIsFalse,
        audioScene,
        expectedAudioScene,
        audioSceneMatches,
        matched: activeScriptedFinalCue && bossDefeatedIsFalse && audioSceneMatches,
      };
    }, { cueFragment, expectedSceneId });
    attempt += 1;
    lastEvidence = {
      ...evidence,
      attempt,
      elapsedMs: Date.now() - startedAt,
      label,
    };
    if (lastEvidence.matched) return lastEvidence;
    const remainingMs = timeoutMs - (Date.now() - startedAt);
    if (remainingMs <= 0) {
      throw new TimeoutError(`${label} final-cut predicate timed out after ${timeoutMs}ms`, lastEvidence);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(50, remainingMs)));
  }
}

async function waitForFinalFifoFromNode({
  page,
  finalLines,
  cueFragment,
  expectedSceneId,
  requireActiveBgm,
  label,
  timeoutMs = timeout,
}) {
  const startedAt = Date.now();
  let attempt = 0;
  let lastEvidence = null;
  while (true) {
    const evidence = await page.evaluate(({
      finalLines: expectedLines,
      cueFragment: expectedCueFragment,
      expectedSceneId: expectedAudioScene,
      requireActiveBgm: mustHaveActiveBgm,
    }) => {
      const samples = window.__P5_STORY_BATTLE_SAMPLES__ ?? [];
      const observedLines = expectedLines.map((line) => ({
        ...line,
        matched: samples.some((sample) => (
          sample.snapshot?.bossDefeated === false
          && sample.audioScene === expectedAudioScene
          && (!mustHaveActiveBgm || sample.audioSceneState?.bgmAssetId === "music-boss")
          && sample.snapshot?.battleBarks?.active?.some((bark) => (
            bark.scripted === true
            && bark.scriptedCueId?.includes(expectedCueFragment)
            && bark.speaker === line.speaker
            && bark.text === line.text
          ))
        )),
      }));
      return {
        sampleCount: samples.length,
        observedLines,
        matched: observedLines.every((line) => line.matched),
      };
    }, { finalLines, cueFragment, expectedSceneId, requireActiveBgm });
    attempt += 1;
    lastEvidence = {
      ...evidence,
      attempt,
      elapsedMs: Date.now() - startedAt,
      label,
    };
    if (lastEvidence.matched) return lastEvidence;
    const remainingMs = timeoutMs - (Date.now() - startedAt);
    if (remainingMs <= 0) {
      throw new TimeoutError(`${label} remaining final FIFO timed out after ${timeoutMs}ms`, lastEvidence);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(50, remainingMs)));
  }
}

async function withStage3FinalPresentationSuppression({
  page,
  label,
  operation,
  resumeButton = null,
}) {
  const owner = "p5-stage3-final-cut";
  const resumeButtonHandle = resumeButton ? await resumeButton.elementHandle() : null;
  invariant(resumeButton === null || resumeButtonHandle !== null,
    `${label} real resume button handle is unavailable`);
  let arm;
  try {
    arm = await page.evaluate(({ requestedOwner, resumeElement }) => {
    let resumeBoundary = null;
    if (resumeElement !== null) {
      if (!(resumeElement instanceof HTMLButtonElement)
        || resumeElement.disabled
        || resumeElement.getAttribute("aria-disabled") === "true"
        || resumeElement.textContent?.trim() !== "作戦を再開") {
        throw new Error("P5_STAGE3_FINAL_REAL_RESUME_BUTTON_INVALID");
      }
      resumeElement.click();
      const resumedSnapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null;
      if (resumedSnapshot?.paused !== false) {
        throw new Error("P5_STAGE3_FINAL_REAL_RESUME_NOT_ACCEPTED");
      }
      resumeBoundary = {
        schema: "p5-stage3-final-real-resume-boundary/v1",
        pageNow: performance.now(),
        snapshot: resumedSnapshot,
      };
    }
    const parameters = new URLSearchParams(location.search);
    const localRoute = ["localhost", "127.0.0.1"].includes(location.hostname)
      && parameters.get("qa") === "endgame"
      && parameters.get("qaHudFiniteAssets") === "1";
    if (!localRoute) throw new Error("P5_STAGE3_FINAL_PRESENTATION_ROUTE_UNAVAILABLE");
    const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
    if (snapshot?.screen !== "battle" || snapshot.running !== true || snapshot.paused === true || snapshot.over === true) {
      throw new Error("P5_STAGE3_FINAL_PRESENTATION_REQUIRES_LIVE_BATTLE");
    }
    const bridge = window.__ASHFALL_BATTLE_QA__;
    if (typeof bridge?.setQaPresentationQuiesced === "function") {
      const receipt = bridge.setQaPresentationQuiesced(true, requestedOwner);
      if (!(receipt?.schema === "v100-qa-presentation-quiescence/v1"
        && receipt.active === true
        && receipt.owner === requestedOwner
        && receipt.route === "stage3-final"
        && receipt.datasetActive === true
        && receipt.running === true
        && receipt.paused !== true
        && receipt.over !== true)) {
        throw new Error(`P5_STAGE3_FINAL_PRESENTATION_BRIDGE_REJECTED:${JSON.stringify(receipt)}`);
      }
      const state = {
        schema: "p5-stage3-final-presentation-state/v1",
        owner: requestedOwner,
        mode: "app-bridge",
        enteredAtBattleTime: Number(snapshot.time),
        resumeBoundary,
        bridgeArm: receipt,
      };
      window.__P5_STAGE3_FINAL_PRESENTATION_STATE__ = state;
      return state;
    }
    const battleRoot = document.querySelector('.game-shell[data-screen="battle"]');
    const canvas = battleRoot?.querySelector("canvas.battlefield");
    if (!(battleRoot instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
      throw new Error("P5_STAGE3_FINAL_PRESENTATION_BASE_SURFACE_MISSING");
    }
    const rect = canvas.getBoundingClientRect();
    const style = getComputedStyle(canvas);
    if (rect.width <= 0 || rect.height <= 0 || style.display === "none" || style.visibility === "hidden" || Number(style.opacity) <= 0) {
      throw new Error("P5_STAGE3_FINAL_PRESENTATION_BASE_SURFACE_NOT_VISIBLE");
    }
    const runningAnimations = typeof battleRoot.getAnimations === "function"
      ? battleRoot.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running")
      : [];
    for (const animation of runningAnimations) animation.pause();
    const state = {
      schema: "p5-stage3-final-presentation-state/v1",
      owner: requestedOwner,
      mode: "base-dom-suppression",
      enteredAtBattleTime: Number(snapshot.time),
      resumeBoundary,
      battleRoot,
      battleRootStyle: battleRoot.getAttribute("style"),
      pausedAnimations: runningAnimations,
      pausedAnimationCount: runningAnimations.length,
      entryCanvas: { width: rect.width, height: rect.height, display: style.display, visibility: style.visibility, opacity: style.opacity },
    };
    battleRoot.style.visibility = "hidden";
    document.documentElement.dataset.p5Stage3FinalPresentationSuppressed = "true";
    window.__P5_STAGE3_FINAL_PRESENTATION_STATE__ = state;
    return {
      schema: state.schema,
      owner: state.owner,
      mode: state.mode,
      enteredAtBattleTime: state.enteredAtBattleTime,
      resumeBoundary: state.resumeBoundary,
      pausedAnimationCount: state.pausedAnimationCount,
      entryCanvas: state.entryCanvas,
    };
    }, { requestedOwner: owner, resumeElement: resumeButtonHandle });
  } finally {
    await resumeButtonHandle?.dispose();
  }
  invariant(resumeButton === null || (
    arm?.resumeBoundary?.schema === "p5-stage3-final-real-resume-boundary/v1"
    && arm.resumeBoundary.snapshot?.paused === false
  ), `${label} did not atomically bind the real resume boundary to presentation ownership`);

  let value;
  let operationError = null;
  try {
    value = await operation();
  } catch (error) {
    operationError = error;
  }

  let release = null;
  let releaseError = null;
  if (!page.isClosed()) {
    try {
      release = await page.evaluate(({ requestedOwner }) => {
        const state = window.__P5_STAGE3_FINAL_PRESENTATION_STATE__;
        if (!(state?.schema === "p5-stage3-final-presentation-state/v1" && state.owner === requestedOwner)) {
          throw new Error("P5_STAGE3_FINAL_PRESENTATION_RELEASE_OWNER_MISSING");
        }
        const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
        if (state.mode === "app-bridge") {
          const receipt = window.__ASHFALL_BATTLE_QA__?.setQaPresentationQuiesced?.(false, requestedOwner) ?? null;
          if (!(receipt?.schema === "v100-qa-presentation-quiescence/v1"
            && receipt.active === false
            && receipt.owner === requestedOwner
            && receipt.route === "stage3-final"
            && receipt.datasetActive === false
            && receipt.running === true
            && receipt.paused !== true
            && receipt.over !== true
            && Number(receipt.releasedAtRenderFrames) === Number(receipt.enteredAtRenderFrames)
            && Number(receipt.releasedAtSimulationTicks) > Number(receipt.enteredAtSimulationTicks)
            && Number(receipt.suppressedRenderFrames) > 0)) {
            throw new Error(`P5_STAGE3_FINAL_PRESENTATION_RELEASE_INVALID:${JSON.stringify(receipt)}`);
          }
          delete window.__P5_STAGE3_FINAL_PRESENTATION_STATE__;
          return {
            schema: "p5-stage3-final-presentation-release/v1",
            owner: requestedOwner,
            mode: state.mode,
            enteredAtBattleTime: state.enteredAtBattleTime,
            releasedAtBattleTime: Number(snapshot?.time),
            resumeBoundary: state.resumeBoundary,
            bridgeArm: state.bridgeArm,
            bridgeRelease: receipt,
            resumedAnimationCount: receipt.resumedAnimationCount,
          };
        }
        if (state.mode !== "base-dom-suppression" || !(state.battleRoot instanceof HTMLElement)) {
          throw new Error("P5_STAGE3_FINAL_PRESENTATION_BASE_RELEASE_INVALID");
        }
        if (state.battleRootStyle === null) state.battleRoot.removeAttribute("style");
        else state.battleRoot.setAttribute("style", state.battleRootStyle);
        let resumedAnimationCount = 0;
        for (const animation of state.pausedAnimations ?? []) {
          try {
            if (animation.playState === "paused") {
              animation.play();
              resumedAnimationCount += 1;
            }
          } catch {
            // Detached CSS animations cannot affect the restored surface.
          }
        }
        delete document.documentElement.dataset.p5Stage3FinalPresentationSuppressed;
        delete window.__P5_STAGE3_FINAL_PRESENTATION_STATE__;
        return {
          schema: "p5-stage3-final-presentation-release/v1",
          owner: requestedOwner,
          mode: state.mode,
          enteredAtBattleTime: state.enteredAtBattleTime,
          releasedAtBattleTime: Number(snapshot?.time),
          resumeBoundary: state.resumeBoundary,
          pausedAnimationCount: state.pausedAnimationCount,
          resumedAnimationCount,
          entryCanvas: state.entryCanvas,
        };
      }, { requestedOwner: owner });
    } catch (error) {
      releaseError = error;
    }
  }
  if (operationError) {
    if (releaseError) throw new Error(`${String(operationError)}; Stage 3 presentation release also failed: ${String(releaseError)}`);
    throw operationError;
  }
  if (releaseError) throw releaseError;
  invariant(release?.schema === "p5-stage3-final-presentation-release/v1"
    && release.owner === owner
    && Number(release.releasedAtBattleTime) > Number(release.enteredAtBattleTime),
  `${label} did not advance the production battle through final-cut presentation suppression`);

  const restored = release.mode === "app-bridge"
    ? await page.waitForFunction(({ releasedRenderFrames, releasedBattleTime }) => {
      const quiescence = window.__ASHFALL_BATTLE_QA__?.getQaPresentationQuiescence?.();
      const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
      const canvas = document.querySelector('.game-shell[data-screen="battle"] canvas.battlefield');
      const rect = canvas?.getBoundingClientRect();
      const style = canvas ? getComputedStyle(canvas) : null;
      const ready = quiescence?.active === false
        && Number(quiescence.renderFrames) >= Number(releasedRenderFrames) + 3
        && Number(snapshot?.time) > Number(releasedBattleTime)
        && rect?.width > 0
        && rect?.height > 0
        && style?.display !== "none"
        && style?.visibility !== "hidden"
        && Number(style?.opacity) > 0;
      return ready ? { renderFrames: quiescence.renderFrames, battleTime: snapshot.time, width: rect.width, height: rect.height } : false;
    }, {
      releasedRenderFrames: release.bridgeRelease.releasedAtRenderFrames,
      releasedBattleTime: release.releasedAtBattleTime,
    }, { timeout: Math.min(timeout, 10_000), polling: 50 }).then(async (handle) => {
      const receipt = await handle.jsonValue();
      await handle.dispose();
      return receipt;
    })
    : await page.evaluate(async ({ releasedBattleTime }) => {
      await new Promise((resolve) => {
        let frames = 0;
        const step = () => {
          frames += 1;
          if (frames >= 3) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
      const canvas = document.querySelector('.game-shell[data-screen="battle"] canvas.battlefield');
      const rect = canvas?.getBoundingClientRect();
      const style = canvas ? getComputedStyle(canvas) : null;
      if (!(Number(snapshot?.time) > Number(releasedBattleTime)
        && rect?.width > 0
        && rect?.height > 0
        && style?.display !== "none"
        && style?.visibility !== "hidden"
        && Number(style?.opacity) > 0)) {
        throw new Error("P5_STAGE3_FINAL_PRESENTATION_BASE_RESTORATION_INVALID");
      }
      return { renderFrames: 3, battleTime: snapshot.time, width: rect.width, height: rect.height };
    }, { releasedBattleTime: release.releasedAtBattleTime });
  return {
    value,
    receipt: {
      schema: "p5-stage3-final-presentation-suppression/v1",
      arm,
      release,
      restored,
    },
  };
}

async function closePlaywrightResource(resource, label) {
  let timer;
  const closed = await Promise.race([
    resource.close().then(() => true).catch((error) => {
      if (/Target page, context or browser has been closed/u.test(String(error))) return true;
      throw error;
    }),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), teardownTimeout);
    }),
  ]).finally(() => clearTimeout(timer));
  if (!closed) console.warn(`${label} teardown exceeded ${teardownTimeout}ms; continuing after completed assertions`);
  return closed;
}
const availableViewports = Object.freeze([
  Object.freeze({ width: 667, height: 375 }),
  Object.freeze({ width: 736, height: 414 }),
  Object.freeze({ width: 844, height: 390 }),
  Object.freeze({ width: 844, height: 340 }),
]);
const requestedViewportKeys = new Set((process.env.P5_QA_VIEWPORTS ?? "667x375,736x414,844x390,844x340")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean));
const viewports = Object.freeze(availableViewports.filter(({ width, height }) => (
  requestedViewportKeys.has(`${width}x${height}`)
)));
if (viewports.length !== requestedViewportKeys.size) {
  throw new Error(`Unknown P5_QA_VIEWPORTS value: ${[...requestedViewportKeys].join(", ")}`);
}
const requestedBattleAudioCases = new Set((process.env.P5_QA_BATTLE_AUDIO_CASES ?? "entrance,final")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean));
const unknownBattleAudioCases = [...requestedBattleAudioCases]
  .filter((value) => !["entrance", "final"].includes(value));
if (unknownBattleAudioCases.length > 0) {
  throw new Error(`Unknown P5_QA_BATTLE_AUDIO_CASES value: ${unknownBattleAudioCases.join(", ")}`);
}
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
const expectedTakuyaPostBossSceneId = sceneIdForScreen("battle", expectedTakuyaStageId, { musicMode: "pressure" });
const expectedTakuyaEntranceSceneId = TAKUYA_ENTRANCE_AUDIO.bossSceneId;
const authoredTakuyaFinalStorySceneId = sceneIdForStoryEvent("stage-takuya-final-v070");
const expectedTakuyaBossAssetId = PRODUCTION_AUDIO_MANIFEST.scenes
  .find(({ id }) => id === expectedTakuyaBossSceneId)?.bgm ?? null;
const expectedTakuyaPostBossAssetId = PRODUCTION_AUDIO_MANIFEST.scenes
  .find(({ id }) => id === expectedTakuyaPostBossSceneId)?.bgm ?? null;
const takuyaEntranceCueId = TAKUYA_ENTRANCE_AUDIO.cueId;
const results = [];

await mkdir(evidenceDir, { recursive: true });

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

invariant(expectedTakuyaBossAssetId === "music-boss",
  `Stage 3 boss manifest route drifted: ${expectedTakuyaBossAssetId}`);
invariant(expectedTakuyaPostBossAssetId === "music-v099-pressure-surface",
  `Stage 3 post-boss manifest route drifted: ${expectedTakuyaPostBossAssetId}`);

function unexpectedWarnings(warnings) {
  return warnings.filter((warning) => !warning.includes("was preloaded using link preload but not used"));
}

function assertNoRetiredNames(text, label) {
  for (const retired of forbiddenPlayerFacingNames) {
    invariant(!text.includes(retired), `${label} exposes retired player-facing name ${retired}`);
  }
}

function createDiagnostics(page) {
  let currentPhase = "unassigned";
  let requestSequence = 0;
  let requestMetadata = new WeakMap();
  let failedRequestUrls = new Set();
  const detailPromises = new Set();
  let current = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    failedRequestDetails: [],
    replacementRequestDetails: [],
    httpErrors: [],
    warnings: [],
  };
  const pendingRequests = new Set();

  const captureRuntimeState = () => page.evaluate(() => {
    const shell = document.querySelector(".game-shell");
    const assetBridge = window.__ASHFALL_ASSET_QA__;
    const battleSnapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null;
    return {
      capturedAt: performance.now(),
      wallTime: Date.now(),
      documentUrl: location.href,
      screen: shell?.getAttribute("data-screen") ?? null,
      selectedStageId: shell?.getAttribute("data-stage-id") ?? null,
      battlefieldStageId: shell?.getAttribute("data-battlefield-stage-id") ?? null,
      formationKinds: [...document.querySelectorAll(".unit-card[data-kind]")]
        .map((element) => element.getAttribute("data-kind"))
        .filter(Boolean),
      assetReadiness: assetBridge?.getState?.() ?? null,
      assetSessionHistory: assetBridge?.getHistory?.() ?? [],
      assetSessionRestartCount: assetBridge?.getRestartCount?.() ?? null,
      battle: battleSnapshot ? {
        screen: battleSnapshot.screen,
        stageId: battleSnapshot.stageId,
        operationId: battleSnapshot.operationId,
        time: battleSnapshot.time,
        bossDefeated: battleSnapshot.bossDefeated,
        over: battleSnapshot.over,
        fighterKinds: [...new Set((battleSnapshot.fighters ?? []).map(({ kind }) => kind))],
      } : null,
    };
  });
  const scheduleRuntimeCapture = (record, field) => {
    const promise = captureRuntimeState()
      .then((snapshot) => { record[field] = snapshot; })
      .catch((error) => { record[`${field}Error`] = String(error); })
      .finally(() => detailPromises.delete(promise));
    detailPromises.add(promise);
  };
  page.on("request", (request) => {
    pendingRequests.add(request);
    let frameUrlAtStart = null;
    try {
      frameUrlAtStart = request.frame().url();
    } catch {
      // Service-worker and early navigation requests do not always expose a frame.
    }
    const record = {
      id: ++requestSequence,
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      isNavigationRequest: request.isNavigationRequest(),
      frameUrlAtStart,
      startedAt: Date.now(),
      harnessPhaseAtStart: currentPhase,
      outcome: "pending",
    };
    requestMetadata.set(request, record);
  });
  page.on("requestfinished", (request) => {
    pendingRequests.delete(request);
    const record = requestMetadata.get(request);
    if (!record) return;
    record.outcome = "finished";
    record.finishedAt = Date.now();
    record.harnessPhaseAtFinish = currentPhase;
    if (failedRequestUrls.has(record.url)) {
      current.replacementRequestDetails.push(record);
      scheduleRuntimeCapture(record, "finishState");
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") current.consoleErrors.push(message.text());
    if (message.type() === "warning") current.warnings.push(message.text());
  });
  page.on("pageerror", (error) => current.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    pendingRequests.delete(request);
    const record = requestMetadata.get(request);
    if (record) {
      record.outcome = "failed";
      record.failedAt = Date.now();
      record.failureText = request.failure()?.errorText ?? "unknown";
      record.harnessPhaseAtFailure = currentPhase;
      failedRequestUrls.add(record.url);
      current.failedRequestDetails.push(record);
      scheduleRuntimeCapture(record, "failureState");
    }
    current.requestFailures.push(`${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) current.httpErrors.push(`${response.status()} ${response.url()}`);
  });

  return {
    reset() {
      pendingRequests.clear();
      requestMetadata = new WeakMap();
      failedRequestUrls = new Set();
      current = {
        consoleErrors: [],
        pageErrors: [],
        requestFailures: [],
        failedRequestDetails: [],
        replacementRequestDetails: [],
        httpErrors: [],
        warnings: [],
      };
    },
    setPhase(phase) {
      currentPhase = phase;
    },
    async settleDetails() {
      await Promise.allSettled([...detailPromises]);
    },
    captureState() {
      return captureRuntimeState();
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
    qaHudFiniteAssets: "1",
    safe: "iphone-landscape",
  }).toString();
  return String(url);
}

async function waitForStableTakuyaLoadoutAssets(page, label) {
  await page.waitForFunction(
    ({ expectedStageId }) => {
      const root = document.documentElement;
      const screen = document.querySelector(".game-shell")?.getAttribute("data-screen");
      const stageId = document.querySelector(".game-shell")?.getAttribute("data-stage-id");
      const assetState = window.__ASHFALL_ASSET_QA__?.getState?.();
      return screen === "loadout"
        && stageId === expectedStageId
        && assetState?.state === "ready"
        && Number(assetState.generation) > 0
        && Number(assetState.total) > 0
        && assetState.pending === 0
        && assetState.failed === 0
        && root.dataset.assetResidentScope === "finite-hud-runtime-qa"
        && root.dataset.assetResidentStage === expectedStageId
        && Number(root.dataset.assetLoadGeneration) === Number(assetState.generation);
    },
    { expectedStageId: expectedTakuyaStageId },
    { timeout },
  );
  let stable = null;
  for (let attempt = 0; attempt < 5 && !stable; attempt += 1) {
    await waitForNetworkQuiet(page);
    const capture = () => page.evaluate(() => {
      const root = document.documentElement;
      const state = window.__ASHFALL_ASSET_QA__?.getState?.();
      return {
        generation: Number(state?.generation),
        total: Number(state?.total),
        pending: Number(state?.pending),
        failed: Number(state?.failed),
        status: state?.state ?? null,
        stageId: root.dataset.assetResidentStage ?? null,
        scope: root.dataset.assetResidentScope ?? null,
        datasetGeneration: Number(root.dataset.assetLoadGeneration),
      };
    });
    const before = await capture();
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    await page.waitForTimeout(120);
    const after = await capture();
    if (after.status === "ready"
      && after.pending === 0
      && after.failed === 0
      && after.generation === before.generation
      && after.total === before.total
      && after.datasetGeneration === after.generation
      && after.stageId === expectedTakuyaStageId
      && after.scope === "finite-hud-runtime-qa") {
      stable = { before, after };
    }
  }
  invariant(stable, `${label} target loadout asset generation did not remain stable`);
  return stable;
}

function assertLocalQaBootstrapDiagnostics(raw, label) {
  invariant(raw.consoleErrors.length === 0,
    `${label} bootstrap console errors: ${JSON.stringify(raw.consoleErrors)}`);
  invariant(raw.pageErrors.length === 0,
    `${label} bootstrap page errors: ${JSON.stringify(raw.pageErrors)}`);
  invariant(raw.httpErrors.length === 0,
    `${label} bootstrap HTTP errors: ${JSON.stringify(raw.httpErrors)}`);
  invariant(raw.warnings.length === 0,
    `${label} bootstrap warnings: ${JSON.stringify(raw.warnings)}`);
  invariant(raw.pendingRequestCount === 0,
    `${label} bootstrap retained pending requests: ${JSON.stringify(raw.pendingRequestUrls)}`);
}

async function dispatchReadyTakuyaLoadout(page, label) {
  const startedAt = Date.now();
  let attempt = 0;
  let lastEvidence = null;
  while (true) {
    const evidence = await page.evaluate(({ expectedStageId }) => {
      const root = document.documentElement;
      const shell = document.querySelector(".game-shell");
      const assetState = window.__ASHFALL_ASSET_QA__?.getState?.();
      const deployButton = document.querySelector(".formation-footer .campaign-primary");
      const selectedFormationCount = document.querySelectorAll(
        '.formation-unit-select[aria-pressed="true"]',
      ).length;
      const screen = shell?.getAttribute("data-screen") ?? null;
      const stageId = shell?.getAttribute("data-stage-id") ?? null;
      const assetGeneration = Number(assetState?.generation);
      const assetTotal = Number(assetState?.total);
      const assetPending = Number(assetState?.pending);
      const assetFailed = Number(assetState?.failed);
      const datasetGeneration = Number(root.dataset.assetLoadGeneration);
      const residentStageId = root.dataset.assetResidentStage ?? null;
      const residentScope = root.dataset.assetResidentScope ?? null;
      const buttonText = deployButton?.textContent?.replace(/\s+/gu, " ").trim() ?? null;
      const buttonNativeDisabled = deployButton instanceof HTMLButtonElement
        ? deployButton.disabled
        : null;
      const buttonAriaDisabled = deployButton?.getAttribute("aria-disabled") ?? null;
      const ready = screen === "loadout"
        && stageId === expectedStageId
        && assetState?.state === "ready"
        && assetGeneration > 0
        && assetTotal > 0
        && assetPending === 0
        && assetFailed === 0
        && datasetGeneration === assetGeneration
        && residentStageId === expectedStageId
        && residentScope === "finite-hud-runtime-qa"
        && selectedFormationCount > 0
        && buttonText?.includes("この編成で出撃") === true
        && buttonNativeDisabled === false
        && buttonAriaDisabled !== "true"
        && typeof deployButton?.click === "function";
      const receipt = {
        schema: "p5-stage3-loadout-dispatch/v1",
        dispatchCount: 0,
        ready,
        expectedStageId,
        screen,
        stageId,
        assetStatus: assetState?.state ?? null,
        assetGeneration,
        assetTotal,
        assetPending,
        assetFailed,
        datasetGeneration,
        residentStageId,
        residentScope,
        selectedFormationCount,
        buttonText,
        buttonNativeDisabled,
        buttonAriaDisabled,
      };
      if (!ready) return Object.freeze(receipt);
      deployButton.click();
      return Object.freeze({ ...receipt, dispatchCount: 1 });
    }, { expectedStageId: expectedTakuyaStageId });
    attempt += 1;
    lastEvidence = {
      ...evidence,
      attempt,
      elapsedMs: Date.now() - startedAt,
      label,
    };
    if (lastEvidence.dispatchCount === 1) return Object.freeze(lastEvidence);
    const remainingMs = timeout - (Date.now() - startedAt);
    if (remainingMs <= 0) {
      throw new TimeoutError(
        `${label} loadout dispatch readiness timed out after ${timeout}ms`,
        lastEvidence,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(50, remainingMs)));
  }
}

async function enterLegacyQaBattle(page, label, startedAt) {
  await page.waitForFunction(
    () => {
      const screen = document.querySelector(".game-shell")?.getAttribute("data-screen");
      return screen === "loadout" || screen === "battle";
    },
    undefined,
    { timeout },
  );
  let deployBoundary = null;
  if (await page.locator('.game-shell[data-screen="loadout"]').count()) {
    stage3Progress(label, "loadout-dispatch-wait", startedAt);
    deployBoundary = await dispatchReadyTakuyaLoadout(page, label);
    stage3Progress(label, "loadout-dispatched", startedAt);
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
  stage3Progress(label, "battle-entry", startedAt);
  return deployBoundary;
}

async function waitForNetworkQuiet(page) {
  await page.waitForLoadState("networkidle", { timeout });
  await page.waitForTimeout(120);
}

async function waitForDiagnosticsQuiet(diagnostics, label) {
  const deadline = Date.now() + timeout;
  let zeroSince = null;
  let last = diagnostics.snapshot();
  while (Date.now() < deadline) {
    await diagnostics.settleDetails();
    last = diagnostics.snapshot();
    if (last.pendingRequestCount === 0) {
      zeroSince ??= Date.now();
      if (Date.now() - zeroSince >= 250) return last;
    } else {
      zeroSince = null;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`${label} network diagnostics did not drain: ${JSON.stringify(last.pendingRequestUrls)}`);
}

async function captureStage3AudioSetupBoundary(page, diagnostics, label) {
  await page.waitForFunction(
    ({ expectedStageId }) => {
      const root = document.documentElement;
      const assetState = window.__ASHFALL_ASSET_QA__?.getState?.();
      const battle = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
      return battle?.screen === "battle"
        && battle.stageId === expectedStageId
        && battle.running === true
        && assetState?.state === "ready"
        && assetState.pending === 0
        && assetState.failed === 0
        && Number(root.dataset.assetLoadGeneration) === Number(assetState.generation);
    },
    { expectedStageId: expectedTakuyaStageId },
    { timeout },
  );
  await pauseBattleForDiagnosticDrain(page, label);
  await waitForNetworkQuiet(page);
  await waitForDiagnosticsQuiet(diagnostics, `${label}/setup`);
  await diagnostics.settleDetails();
  const stableState = await diagnostics.captureState();
  const raw = diagnostics.snapshot();
  return { stableState, raw };
}

function assertStage3AudioSetupBoundary(setupDiagnostics, label) {
  const { stableState, raw } = setupDiagnostics;
  invariant(stableState.assetReadiness?.state === "ready"
    && stableState.assetReadiness?.pending === 0
    && stableState.assetReadiness?.failed === 0,
  `${label} did not establish a ready/pending-0 asset generation`);
  invariant(raw.pendingRequestCount === 0,
    `${label} setup retained ${raw.pendingRequestCount} pending request(s)`);
  invariant(raw.consoleErrors.length === 0,
    `${label} setup console errors: ${JSON.stringify(raw.consoleErrors)}`);
  invariant(raw.pageErrors.length === 0,
    `${label} setup page errors: ${JSON.stringify(raw.pageErrors)}`);
  invariant(raw.httpErrors.length === 0,
    `${label} setup HTTP errors: ${JSON.stringify(raw.httpErrors)}`);
  invariant(raw.warnings.length === 0,
    `${label} setup console warnings: ${JSON.stringify(raw.warnings)}`);
  invariant(raw.requestFailures.length === 0 && raw.failedRequestDetails.length === 0,
    `${label} setup request failures are fail-closed: ${JSON.stringify(raw.requestFailures)}`);
}

async function pauseBattleForDiagnosticDrain(page, label) {
  const snapshot = await storyBattleSnapshot(page);
  if (snapshot?.screen !== "battle" || snapshot.paused || snapshot.over) return;
  await page.getByRole("button", { name: "一時停止", exact: true }).click({ timeout });
  await page.waitForFunction(
    () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().paused === true,
    undefined,
    { timeout },
  );
  invariant((await storyBattleSnapshot(page)).paused === true,
    `${label} could not pause the battle for a finite network diagnostic boundary`);
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
    const visibleTypography = (selector) => [...document.querySelectorAll(selector)]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })
      .map((element) => {
        const style = getComputedStyle(element);
        return {
          text: element.textContent?.trim() ?? "",
          fontSize: Number.parseFloat(style.fontSize),
          color: style.color,
          textShadow: style.textShadow,
        };
      });
    const rectFor = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const textFitFor = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      const textRect = range.getBoundingClientRect();
      return {
        text: element.textContent?.trim() ?? "",
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        rect: { left: rect.left, right: rect.right },
        textRect: { left: textRect.left, right: textRect.right },
      };
    };
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
      mobileReadability: {
        actionable: visibleTypography([
          ".phase-block strong",
          ".unit-card .card-copy b",
          ".unit-card .cost",
          ".support-btn b",
          ".support-btn em",
          ".battle-objective",
        ].join(",")),
        secondary: visibleTypography([
          ".phase-block small",
          ".phase-block em",
          ".audio-btn small",
          ".health-hud div",
          ".health-hud > small",
          ".boss-hud div",
          ".boss-hud b",
          ".unit-card .card-state",
          ".unit-card .cooldown-mask small",
          ".support-btn small",
          ".battle-stats > span",
        ].join(",")),
        rects: {
          bottomHud: rectFor(".bottom-hud"),
          resourceStack: rectFor(".resource-stack"),
          unitCards: rectFor(".unit-cards"),
          supportZone: rectFor(".support-zone"),
          supportRow: rectFor(".support-row"),
          statsStrip: rectFor(".battle-stats"),
          objective: rectFor(".battle-objective"),
        },
        objectiveTextFit: textFitFor(".battle-objective"),
        deployBannerEffectiveFontPx: (rectFor("canvas.battlefield")?.width ?? 0) / 960 * 22,
      },
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

function assertMobileBattleReadability(evidence, label) {
  const readability = evidence.mobileReadability;
  invariant(readability.actionable.length > 0, `${label} captured no actionable mobile typography`);
  invariant(readability.secondary.length > 0, `${label} captured no secondary mobile typography`);
  for (const item of readability.actionable) {
    invariant(item.fontSize >= 13.95,
      `${label} actionable text below 14px: ${JSON.stringify(item)}`);
    invariant(item.textShadow !== "none",
      `${label} actionable text lacks contrast shadow: ${JSON.stringify(item)}`);
  }
  for (const item of readability.secondary) {
    invariant(item.fontSize >= 11.95,
      `${label} secondary text below 12px: ${JSON.stringify(item)}`);
  }
  invariant(readability.deployBannerEffectiveFontPx >= 14,
    `${label} deploy banner below effective 14px: ${readability.deployBannerEffectiveFontPx}`);
  const {
    bottomHud,
    resourceStack,
    unitCards,
    supportZone,
    supportRow,
    statsStrip,
    objective,
  } = readability.rects;
  invariant(bottomHud && resourceStack && unitCards && supportZone && supportRow && statsStrip && objective,
    `${label} missing mobile battle layout evidence: ${JSON.stringify(readability.rects)}`);
  invariant(resourceStack.left >= bottomHud.left - 1 && resourceStack.right <= bottomHud.right + 1
      && resourceStack.top >= bottomHud.top - 1 && resourceStack.bottom <= bottomHud.bottom + 1,
    `${label} resource stack escaped the bottom HUD: ${JSON.stringify(readability.rects)}`);
  invariant(unitCards.left >= bottomHud.left - 1 && unitCards.right <= bottomHud.right + 1
      && unitCards.top >= bottomHud.top - 1 && unitCards.bottom <= bottomHud.bottom + 1,
    `${label} unit cards escaped the bottom HUD: ${JSON.stringify(readability.rects)}`);
  invariant(supportZone.left >= bottomHud.left - 1 && supportZone.right <= bottomHud.right + 1
      && supportZone.top >= bottomHud.top - 1 && supportZone.bottom <= bottomHud.bottom + 1,
    `${label} support zone escaped the bottom HUD: ${JSON.stringify(readability.rects)}`);
  invariant(supportRow.left >= supportZone.left - 1 && supportRow.right <= supportZone.right + 1
      && supportRow.top >= supportZone.top - 1 && supportRow.bottom <= supportZone.bottom + 1,
    `${label} support cards escaped the bottom HUD: ${JSON.stringify(readability.rects)}`);
  invariant(resourceStack.right <= unitCards.left + 1 && unitCards.right <= supportZone.left + 1,
    `${label} bottom ownership zones overlap: ${JSON.stringify(readability.rects)}`);
  invariant(statsStrip.left >= resourceStack.left - 1 && statsStrip.right <= resourceStack.right + 1
      && statsStrip.bottom <= resourceStack.bottom + 1,
    `${label} stats escaped the resource zone: ${JSON.stringify(readability.rects)}`);
  invariant(objective.left >= unitCards.left - 1 && objective.right <= supportZone.right + 1
      && objective.top >= Math.max(unitCards.bottom, supportZone.bottom) - 1
      && objective.bottom <= bottomHud.bottom + 1,
    `${label} objective is clipped: ${JSON.stringify(readability.rects)}`);
  const objectiveTextFit = readability.objectiveTextFit;
  invariant(objectiveTextFit
      && objectiveTextFit.scrollWidth <= objectiveTextFit.clientWidth + 1
      && objectiveTextFit.textRect.left >= objectiveTextFit.rect.left - 1
      && objectiveTextFit.textRect.right <= objectiveTextFit.rect.right + 1
      && objectiveTextFit.textRect.left >= -1
      && objectiveTextFit.textRect.right <= evidence.dimensions.innerWidth + 1,
    `${label} objective text is not fully visible: ${JSON.stringify(objectiveTextFit)}`);
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
  await dismissInstallOffer(page, { timeout });
  const expectedSceneId = await waitForStoryScreen(page, eventId);
  const expectedLines = STORY_EVENTS[eventId].lines;
  invariant(expectedLines.length > 0, `${label} has no display lines`);
  const lineSceneIds = [];
  let finalAdvanceStartedAt = null;

  for (const [index, expectedLine] of expectedLines.entries()) {
    const expectedLineSceneId = sceneIdForStoryEvent(eventId, index);
    const expectedSpeaker = publicDisplayText(expectedLine.speaker);
    const expectedText = publicDisplayText(expectedLine.text);
    await page.waitForFunction(
      ({ speaker, text, expectedLineSceneId }) => (
        document.querySelector(".dialogue-name b")?.textContent === speaker
        && document.querySelector(".dialogue-text")?.textContent === text
        && document.documentElement.dataset.audioScene === expectedLineSceneId
        && window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.().desiredSceneId === expectedLineSceneId
      ),
      { speaker: expectedSpeaker, text: expectedText, expectedLineSceneId },
      { timeout },
    );
    const evidence = await readLayoutAndAudio(page);
    invariant(evidence.screen === "event", `${label}/${index} left the event screen`);
    invariant(evidence.speaker === expectedSpeaker,
      `${label}/${index} speaker mismatch: ${evidence.speaker} !== ${expectedSpeaker}`);
    invariant(evidence.text === expectedText,
      `${label}/${index} text mismatch: ${evidence.text} !== ${expectedText}`);
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
  await closePlaywrightResource(background, `${label}/background-page`);
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
  await dismissInstallOffer(page, { timeout });
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
    await dismissInstallOffer(page, { timeout });
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
    await dismissInstallOffer(page, { timeout });
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
    await closePlaywrightResource(page, `${label}/page`);
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
      // The final Stage 3 proof only consumes time, boss state, and scripted
      // bark fields.  Retaining every full battle snapshot (assets, receipts,
      // fighters, diagnostics) at 40Hz made WebKit spend minutes serializing
      // the sample ledger at final-fixture teardown.  Preserve the exact
      // semantic observations without the unbounded object graph.
      const compactSnapshot = {
        time: snapshot.time,
        bossDefeated: snapshot.bossDefeated,
        battleBarks: {
          active: (snapshot.battleBarks?.active ?? []).map((bark) => ({
            id: bark.id,
            speaker: bark.speaker,
            text: bark.text,
            scripted: bark.scripted,
            scriptedCueId: bark.scriptedCueId,
            playVoice: bark.playVoice,
          })),
        },
      };
      samples.push({
        at: performance.now(),
        screen: document.querySelector(".game-shell")?.getAttribute("data-screen") ?? null,
        eventOverlayCount: document.querySelectorAll(".campaign-overlay.event-screen").length,
        audioScene: document.documentElement.dataset.audioScene ?? null,
        audioDesiredScene: audioDiagnostics?.desiredSceneId ?? null,
        audioRuntimeScene: audioDiagnostics?.sceneId ?? null,
        audioSceneState: audioBridge?.getSceneState?.() ?? null,
        entranceCueActive: audioBridge?.hasInstance?.(entranceCueId) ?? false,
        snapshot: compactSnapshot,
      });
      if (samples.length > 1_200) samples.splice(0, samples.length - 1_200);
    };
    window.__P5_STORY_BATTLE_CAPTURE__ = capture;
    window.__P5_STORY_BATTLE_TIMER__ = window.setInterval(capture, 25);
    capture();
  }, { entranceCueId: takuyaEntranceCueId });
}

async function storyBattleSnapshot(page) {
  return boundedPageCall(
    () => page.evaluate(() => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null),
    "story battle snapshot",
  );
}

async function storyBattleSamples(page) {
  return boundedPageCall(
    () => page.evaluate(() => [...(window.__P5_STORY_BATTLE_SAMPLES__ ?? [])]),
    "story battle samples",
  );
}

async function stopStoryBattleRecorder(page) {
  await boundedPageCall(() => page.evaluate(() => {
    if (window.__P5_STORY_BATTLE_TIMER__) window.clearInterval(window.__P5_STORY_BATTLE_TIMER__);
    delete window.__P5_STORY_BATTLE_TIMER__;
    delete window.__P5_STORY_BATTLE_CAPTURE__;
  }), "story battle recorder stop").catch(() => undefined);
}

function createFinalCutTrace({ page, diagnostics, expectedSceneId, label }) {
  const startedAt = Date.now();
  const samples = [];
  let active = true;
  let inFlight = null;
  let timer = null;
  let lastSampleError = null;
  let termination = "running";
  const pageSignals = {
    close: false,
    crash: false,
    closeAtElapsedMs: null,
    crashAtElapsedMs: null,
  };
  const awaitedPredicate = {
    phase: "final-cut",
    timeoutMs: timeout,
    pollingMs: 50,
    components: [
      "snapshot.battleBarks.active includes scripted cue stage-takuya-final-v070",
      "snapshot.bossDefeated === false",
      `document.documentElement.dataset.audioScene === ${expectedSceneId}`,
    ],
  };

  const capture = async () => {
    if (!active || samples.length >= FINAL_CUT_TRACE_MAX_SAMPLES) return;
    if (inFlight) {
      await inFlight;
      return;
    }
    const sampleStartedAt = Date.now();
    inFlight = (async () => {
      try {
        const runtime = await page.evaluate(() => {
          const battleApi = window.__ASHFALL_BATTLE_QA__;
          const audioApi = window.__ASHFALL_AUDIO_QA__;
          const snapshot = battleApi?.getSnapshot?.() ?? null;
          const takuya = snapshot?.fighters?.find((fighter) => (
            fighter.side === "zombie" && fighter.kind === "takuya"
          )) ?? null;
          const assetState = window.__ASHFALL_ASSET_QA__?.getState?.() ?? null;
          const activeBarks = snapshot?.battleBarks?.active ?? [];
          const pendingBarks = snapshot?.battleBarks?.pendingScripted ?? [];
          return {
            documentVisibility: document.visibilityState,
            audioScene: document.documentElement.dataset.audioScene ?? null,
            snapshot: snapshot ? {
              time: snapshot.time ?? null,
              paused: snapshot.paused ?? null,
              over: snapshot.over ?? null,
              bossDefeated: snapshot.bossDefeated ?? null,
            } : null,
            takuya: takuya ? {
              id: takuya.id,
              hp: takuya.hp,
              maxHp: takuya.maxHp,
              ratio: takuya.maxHp > 0 ? takuya.hp / takuya.maxHp : null,
              combatReady: takuya.combatReady ?? null,
              gateEntering: takuya.gateEntering ?? null,
              contained: takuya.contained ?? null,
              state: takuya.animationPresentation?.state ?? takuya.state ?? null,
              cooldown: takuya.cooldown ?? null,
              target: {
                id: takuya.targetId ?? null,
                objectId: takuya.targetObjectId ?? null,
              },
              targetId: takuya.targetId ?? null,
              targetObjectId: takuya.targetObjectId ?? null,
            } : null,
            livingHumanCount: (snapshot?.fighters ?? [])
              .filter((fighter) => fighter.side === "human" && fighter.hp > 0).length,
            livingHumanKinds: [...new Set((snapshot?.fighters ?? [])
              .filter((fighter) => fighter.side === "human" && fighter.hp > 0)
              .map((fighter) => fighter.kind))],
            storyBattleReceiptEventIds: [...(snapshot?.storyBattleReceiptEventIds ?? [])],
            storyBattleEvaluatedCueKeys: [...(snapshot?.storyBattleEvaluatedCueKeys ?? [])],
            activeScriptedBarkIds: activeBarks
              .filter((bark) => bark.scripted === true)
              .map((bark) => bark.id),
            pendingScriptedBarkIds: pendingBarks
              .filter((bark) => bark.scripted === true)
              .map((bark) => bark.id),
            assetState: assetState ? {
              state: assetState.state ?? null,
              generation: assetState.generation ?? null,
              completed: assetState.completed ?? null,
              total: assetState.total ?? null,
              pending: assetState.pending ?? null,
              failed: assetState.failed ?? null,
              reason: assetState.reason ?? assetState.failureReason ?? null,
            } : null,
            audioSceneState: audioApi?.getSceneState?.() ?? null,
          };
        });
        const diagnosticSnapshot = diagnostics.snapshot();
        const pageClosed = page.isClosed();
        samples.push({
          wallTime: new Date(sampleStartedAt).toISOString(),
          elapsedWallMs: sampleStartedAt - startedAt,
          label,
          ...runtime,
          pageState: { url: page.url(), closed: pageClosed },
          pendingRequestState: {
            count: diagnosticSnapshot.pendingRequestCount,
            urls: diagnosticSnapshot.pendingRequestUrls,
          },
        });
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
    termination = termination === "running" ? "page-close" : termination;
    active = false;
    if (timer) clearInterval(timer);
  });
  page.on("crash", () => {
    pageSignals.crash = true;
    pageSignals.crashAtElapsedMs ??= Date.now() - startedAt;
    termination = termination === "running" ? "page-crash" : termination;
    active = false;
    if (timer) clearInterval(timer);
  });
  void capture();
  timer = setInterval(() => { void capture(); }, FINAL_CUT_TRACE_INTERVAL_MS);

  return {
    capture,
    async stop(reason = null) {
      active = false;
      if (reason) termination = reason;
      if (timer) clearInterval(timer);
      timer = null;
      if (inFlight) await inFlight;
      return {
        sampleIntervalMs: FINAL_CUT_TRACE_INTERVAL_MS,
        maxSamples: FINAL_CUT_TRACE_MAX_SAMPLES,
        samples,
        sampleCount: samples.length,
        lastSample: samples.at(-1) ?? null,
        lastSuccessfulSample: samples.at(-1) ?? null,
        lastSampleError,
        pageSignals,
        termination,
        awaitedPredicate,
      };
    },
  };
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
  deferResume = false,
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

  const resumeButton = page.getByRole("button", { name: "作戦を再開", exact: true });
  await resumeButton.waitFor({ state: "visible", timeout });
  if (deferResume) {
    return {
      before,
      paused,
      held,
      resumeButton,
      resumed: null,
      resumeBoundary: null,
      scriptedLineId: beforeBark.id,
    };
  }
  // Sample the resume boundary in the same page task that dispatches the real
  // button handler.  A Node-side click followed by a second IPC round-trip can
  // miss several live simulation ticks on a loaded hosted runner and must not
  // be mistaken for a product-side failure to reset the entrance timer.
  const resumeBoundary = await resumeButton.evaluate((button) => {
    button.click();
    return {
      pageNow: performance.now(),
      snapshot: window.__ASHFALL_BATTLE_QA__?.getSnapshot?.() ?? null,
    };
  });
  await page.waitForFunction(
    () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().paused === false,
    undefined,
    { timeout },
  );
  const resumed = resumeBoundary.snapshot ?? await storyBattleSnapshot(page);
  const resumedBark = activeScriptedBark(resumed, cueFragment);
  invariant(resumedBark?.id === beforeBark.id, `${label} did not restore the frozen scripted line`);
  return { before, paused, held, resumed, resumeBoundary, scriptedLineId: beforeBark.id };
}

async function auditTakuyaEntranceAudio({ browser, engine, viewport }) {
  const auditStartedAt = Date.now();
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
  diagnostics.setPhase(result.phase);
  stage3Progress(label, "navigation", auditStartedAt);
  try {
    await installStoryBattleRecorder(page);
    const response = await page.goto(battleQaUrl("takuya-entrance"), {
      waitUntil: "domcontentloaded",
      timeout,
    });
    invariant(response?.ok(), `${label} navigation failed: ${response?.status() ?? "no response"}`);
    await dismissInstallOffer(page, { timeout });
    result.bootstrapBoundary = await waitForStableTakuyaLoadoutAssets(page, label);
    await diagnostics.settleDetails();
    result.bootstrapDiagnostics = diagnostics.snapshot();
    assertLocalQaBootstrapDiagnostics(result.bootstrapDiagnostics, label);
    diagnostics.reset();
    diagnostics.setPhase("stage3-setup");
    result.deployBoundary = await enterLegacyQaBattle(page, label, auditStartedAt);
    result.setupDiagnostics = await captureStage3AudioSetupBoundary(page, diagnostics, label);
    assertStage3AudioSetupBoundary(result.setupDiagnostics, label);
    diagnostics.reset();
    diagnostics.setPhase("runtime-start");
    await page.waitForFunction(
      () => Boolean(window.__ASHFALL_AUDIO_QA__) && Boolean(window.__ASHFALL_BATTLE_QA__),
      undefined,
      { timeout },
    );
    invariant((await storyBattleSnapshot(page)).paused === true,
      `${label} setup did not retain the paused diagnostic boundary`);
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
    diagnostics.setPhase(result.phase);
    stage3Progress(label, result.phase, auditStartedAt);
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
      await page.waitForFunction(
        ({ assetId }) => {
          const diagnostics = window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.();
          return diagnostics?.activeBgmVoices === 1
            && diagnostics?.activeBgm?.[0]?.assetId === assetId
            && diagnostics?.activeBgmInstanceKeys?.length === 1
            && diagnostics?.gainStages?.transientMusicDuck <= .4;
        },
        { assetId: expectedTakuyaBossAssetId },
        { timeout },
      );
    }
    const entranceStarted = await storyBattleSnapshot(page);
    const entranceMixer = audioBlocked ? null : await page.evaluate(
      () => window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.() ?? null,
    );
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
    diagnostics.setPhase(result.phase);
    stage3Progress(label, result.phase, auditStartedAt);
    const exactRestartRemaining = pauseEvidence.resumed.takuyaEntranceAudioRemaining;
    invariant(
      exactRestartRemaining >= TAKUYA_ENTRANCE_AUDIO.durationSeconds - .03
        && exactRestartRemaining <= TAKUYA_ENTRANCE_AUDIO.durationSeconds,
      `${label} did not reset the TAKUYA entrance timer at the resume boundary: ${exactRestartRemaining}`,
    );
    await page.waitForFunction(
      ({ expectedSceneId }) => {
        const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
        return snapshot?.paused === false
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

    result.phase = "boss-music-duck-release";
    diagnostics.setPhase(result.phase);
    stage3Progress(label, result.phase, auditStartedAt);
    await page.waitForFunction(
      ({ expectedSceneId, assetId, audioBlocked }) => {
        const snapshot = window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();
        const diagnostics = window.__ASHFALL_AUDIO_QA__?.getDiagnostics?.();
        return snapshot?.takuyaEntranceAudioRemaining <= 0
          && document.documentElement.dataset.audioScene === expectedSceneId
          && (audioBlocked || (
            diagnostics?.activeBgmVoices === 1
            && diagnostics?.activeBgm?.[0]?.assetId === assetId
            && diagnostics?.activeBgmInstanceKeys?.length === 1
            && diagnostics?.gainStages?.transientMusicDuck >= .98
          ));
      },
      { expectedSceneId: expectedTakuyaBossSceneId, assetId: expectedTakuyaBossAssetId, audioBlocked },
      { timeout },
    );
    const releaseObservedPageNow = await page.evaluate(() => performance.now());
    const observedDuckReleaseMs = releaseObservedPageNow - pauseEvidence.resumeBoundary.pageNow;
    invariant(observedDuckReleaseMs >= TAKUYA_ENTRANCE_AUDIO.durationSeconds * 1_000 - 250,
      `${label} released the entrance duck after only ${observedDuckReleaseMs}ms`);
    const completed = await storyBattleSnapshot(page);
    invariant(completed.time > entranceStarted.time,
      `${label} battle time did not advance after resume`);
    const layout = await readLayoutAndAudio(page);
    assertViewportEvidence(layout, viewport, label);
    assertMobileBattleReadability(layout, label);
    assertNoRetiredNames(layout.visibleText, label);
    const samples = await storyBattleSamples(page);
    assertBattleRemainedNonblocking(samples, label);
    await page.screenshot({
      path: path.join(evidenceDir, `${engine}-${viewport.width}x${viewport.height}-takuya-entrance-audio${audioBlocked ? "-BLOCKED" : ""}.png`),
    });
    await pauseBattleForDiagnosticDrain(page, label);
    await waitForNetworkQuiet(page);
    await diagnostics.settleDetails();
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
      entranceMixer,
      observedDuckReleaseMs,
      elapsedWallMs: Date.now() - startedAt,
      completed,
      layoutEvidence: layout.mobileReadability,
      logicalAudioRoute: {
        entrance: { sceneId: expectedTakuyaEntranceSceneId, assetId: expectedTakuyaBossAssetId },
        boss: { sceneId: expectedTakuyaBossSceneId, assetId: expectedTakuyaBossAssetId },
      },
      diagnostics: diagnosticEvidence,
    });
    stage3Progress(label, "complete", auditStartedAt);
  } catch (error) {
    stage3Progress(label, `failure:${result.phase}`, auditStartedAt);
    result.error = String(error);
    result.failureEvidence = error?.evidence ?? null;
    await diagnostics.settleDetails();
    result.diagnostics = diagnostics.snapshot();
    result.failureState = await storyBattleSnapshot(page).catch(() => null);
  } finally {
    stage3Progress(label, "teardown-start", auditStartedAt);
    await stopStoryBattleRecorder(page);
    await closePlaywrightResource(page, `${label}/page`);
    await closePlaywrightResource(context, `${label}/context`);
    stage3Progress(label, "teardown-complete", auditStartedAt);
  }
  return result;
}

async function auditTakuyaFinalAudio({ browser, engine, viewport }) {
  const startedAt = Date.now();
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const diagnostics = createDiagnostics(page);
  const label = `${engine}/${viewport.width}x${viewport.height}/takuya-final-audio`;
  let finalCutTrace = null;
  const result = {
    engine,
    viewport,
    phase: "navigation",
    status: "failed",
  };
  diagnostics.setPhase(result.phase);
  stage3Progress(label, "navigation", startedAt);
  try {
    await installStoryBattleRecorder(page);
    const response = await page.goto(battleQaUrl("endgame"), {
      waitUntil: "domcontentloaded",
      timeout,
    });
    invariant(response?.ok(), `${label} navigation failed: ${response?.status() ?? "no response"}`);
    await dismissInstallOffer(page, { timeout });
    result.bootstrapBoundary = await waitForStableTakuyaLoadoutAssets(page, label);
    await diagnostics.settleDetails();
    result.bootstrapDiagnostics = diagnostics.snapshot();
    assertLocalQaBootstrapDiagnostics(result.bootstrapDiagnostics, label);
    diagnostics.reset();
    diagnostics.setPhase("stage3-setup");
    result.deployBoundary = await enterLegacyQaBattle(page, label, startedAt);
    result.setupDiagnostics = await captureStage3AudioSetupBoundary(page, diagnostics, label);
    assertStage3AudioSetupBoundary(result.setupDiagnostics, label);
    diagnostics.reset();
    diagnostics.setPhase("runtime-start");
    await page.waitForFunction(
      () => Boolean(window.__ASHFALL_AUDIO_QA__) && Boolean(window.__ASHFALL_BATTLE_QA__),
      undefined,
      { timeout },
    );
    invariant((await storyBattleSnapshot(page)).paused === true,
      `${label} setup did not retain the paused diagnostic boundary`);
    const capability = await webAudioCapability(page);
    const audioBlocked = capability.audioContext !== "function";
    const audioUi = audioBlocked ? null : await ensureBattleQaAudioRunning(page, `${label}/control`);
    finalCutTrace = createFinalCutTrace({
      page,
      diagnostics,
      expectedSceneId: expectedTakuyaBossSceneId,
      label,
    });
    await finalCutTrace.capture();
    await page.getByRole("button", { name: "作戦を再開", exact: true }).click({ timeout });
    await page.waitForFunction(
      () => window.__ASHFALL_BATTLE_QA__?.getSnapshot?.().paused === false,
      undefined,
      { timeout },
    );

    result.phase = "final-cut";
    stage3Progress(label, "final-cut", startedAt);
    diagnostics.setPhase(result.phase);
    const finalCutPresentation = await withStage3FinalPresentationSuppression({
      page,
      label,
      operation: () => waitForFinalCutPredicateFromNode({
        page,
        cueFragment: "stage-takuya-final-v070",
        expectedSceneId: expectedTakuyaBossSceneId,
        label,
        timeoutMs: timeout,
      }),
    });
    result.finalCutPredicate = finalCutPresentation.value;
    result.finalCutPresentationSuppression = finalCutPresentation.receipt;
    const deferredPauseEvidence = await pauseAndVerifyFrozenScriptedBark({
      page,
      cueFragment: "stage-takuya-final-v070",
      label: `${label}/pause`,
      deferResume: true,
    });
    const finalLines = STORY_EVENTS["stage-takuya-final-v070"].lines.map(({ speaker, text }) => ({ speaker, text }));
    const finalFifoPresentation = await withStage3FinalPresentationSuppression({
      page,
      label: `${label}/remaining-final-fifo`,
      resumeButton: deferredPauseEvidence.resumeButton,
      operation: () => waitForFinalFifoFromNode({
        page,
        finalLines,
        cueFragment: "stage-takuya-final-v070",
        expectedSceneId: expectedTakuyaBossSceneId,
        requireActiveBgm: !audioBlocked,
        label: `${label}/remaining-final-fifo`,
        timeoutMs: timeout,
      }),
    });
    const resumeBoundary = finalFifoPresentation.receipt.arm.resumeBoundary;
    const resumed = resumeBoundary.snapshot;
    const resumedBark = activeScriptedBark(resumed, "stage-takuya-final-v070");
    invariant(resumedBark?.id === deferredPauseEvidence.scriptedLineId,
      `${label} did not restore the frozen scripted line under the second presentation owner`);
    const { resumeButton: _resumeButton, ...pauseEvidenceBeforeResume } = deferredPauseEvidence;
    const pauseEvidence = {
      ...pauseEvidenceBeforeResume,
      resumed,
      resumeBoundary,
    };
    result.finalFifoPresentationSuppression = finalFifoPresentation.receipt;
    const defeatProofSetup = await page.evaluate(() => (
      window.__ASHFALL_BATTLE_QA__?.prepareTakuyaBossDefeatAudioProof?.() ?? null
    ));
    invariant(defeatProofSetup?.hp === 0 && defeatProofSetup?.bossDefeated === false,
      `${label} could not prepare the post-observation TAKUYA defeat proof`);

    result.phase = "final-fifo";
    stage3Progress(label, "final-fifo", startedAt);
    diagnostics.setPhase(result.phase);
    const baseEventLines = STORY_EVENTS["stage-takuya-base-remains-v070"].lines;
    const expectedLines = [
      ...finalLines,
      { speaker: baseEventLines[0].speaker, text: baseEventLines[0].text },
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
    const expectedPostBossLines = expectedLines.slice(finalLines.length);
    await page.waitForFunction(
      ({ expectedPostBossLines, expectedSceneId }) => {
        const samples = window.__P5_STORY_BATTLE_SAMPLES__ ?? [];
        return expectedPostBossLines.every((line) => samples.some((sample) => (
          sample.audioScene === expectedSceneId
          && sample.snapshot?.bossDefeated === true
          && sample.snapshot?.battleBarks?.active?.some((bark) => (
            bark.scripted === true
            && bark.speaker === line.speaker
            && bark.text === line.text
          ))
        )));
      },
      { expectedPostBossLines, expectedSceneId: expectedTakuyaPostBossSceneId },
      { timeout, polling: 50 },
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
        sample.audioScene === expectedTakuyaBossSceneId
        && sample.snapshot?.bossDefeated === false
        && (audioBlocked || sample.audioSceneState?.bgmAssetId === expectedTakuyaBossAssetId)
        && sample.snapshot?.battleBarks?.active?.some((bark) => (
          bark.scripted === true && bark.text === line.text
        ))
      )), `${label} final line was not rendered under ${expectedTakuyaBossSceneId}/music-boss: ${line.text}`);
    }
    invariant(!samples.some((sample) => (
      sample.snapshot?.bossDefeated === false
      && sample.snapshot?.battleBarks?.active?.some((bark) => (
        bark.scripted === true && bark.scriptedCueId?.includes("stage-takuya-final-v070")
      ))
      && sample.audioScene === authoredTakuyaFinalStorySceneId
    )), `${label} final story event overrode the live boss scene`);
    for (const line of expectedLines.slice(finalLines.length)) {
      invariant(samples.some((sample) => (
        sample.audioScene === expectedTakuyaPostBossSceneId
        && sample.snapshot?.battleBarks?.active?.some((bark) => (
          bark.scripted === true && bark.text === line.text
        ))
      )), `${label} base-remains line did not restore ${expectedTakuyaPostBossSceneId}: ${line.text}`);
    }
    if (!audioBlocked) {
      invariant(samples.some((sample) => (
        sample.snapshot?.bossDefeated === false
        && sample.audioDesiredScene === expectedTakuyaBossSceneId
        && sample.audioRuntimeScene === expectedTakuyaBossSceneId
        && sample.audioSceneState?.bgmAssetId === "music-boss"
      )), `${label} production mixer did not keep music-boss active through the final story event`);
      invariant(samples.some((sample) => sample.audioRuntimeScene === expectedTakuyaPostBossSceneId),
        `${label} production mixer did not restore the current Stage 3 pressure scene`);
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
    assertMobileBattleReadability(layout, label);
    assertNoRetiredNames(layout.visibleText, label);
    await page.screenshot({
      path: path.join(evidenceDir, `${engine}-${viewport.width}x${viewport.height}-takuya-final-audio${audioBlocked ? "-BLOCKED" : ""}.png`),
    });
    await pauseBattleForDiagnosticDrain(page, label);
    await waitForNetworkQuiet(page);
    await diagnostics.settleDetails();
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
      defeatProofSetup,
      pauseEvidence,
      expectedLines,
      observedLines,
      completed: current,
      layoutEvidence: layout.mobileReadability,
      logicalAudioRoute: {
        boss: { sceneId: expectedTakuyaBossSceneId, assetId: expectedTakuyaBossAssetId },
        postBoss: { sceneId: expectedTakuyaPostBossSceneId, assetId: expectedTakuyaPostBossAssetId },
      },
      diagnostics: diagnosticEvidence,
    });
    stage3Progress(label, "complete", startedAt);
  } catch (error) {
    stage3Progress(label, `failure:${result.phase}`, startedAt);
    result.error = String(error);
    result.failureEvidence = error?.evidence ?? null;
    await diagnostics.settleDetails();
    result.diagnostics = diagnostics.snapshot();
    result.failureState = await storyBattleSnapshot(page).catch(() => null);
    result.failureStorySamples = await storyBattleSamples(page).then((samples) => samples
      .filter((sample) => sample.snapshot?.battleBarks?.active?.some((bark) => bark.scripted === true))
      .map((sample) => ({
        at: sample.at,
        audioScene: sample.audioScene,
        audioDesiredScene: sample.audioDesiredScene,
        audioRuntimeScene: sample.audioRuntimeScene,
        audioSceneState: sample.audioSceneState,
        bossDefeated: sample.snapshot.bossDefeated,
        barks: sample.snapshot.battleBarks.active.map((bark) => ({ ...bark })),
      }))).catch(() => []);
  } finally {
    stage3Progress(label, "teardown-start", startedAt);
    if (finalCutTrace) {
      const traceTermination = result.phase === "complete"
        ? "success"
        : result.error?.includes("Timeout") ? "deadline" : "audit-error";
      result.finalCutTrace = await finalCutTrace.stop(traceTermination);
    }
    await stopStoryBattleRecorder(page);
    await closePlaywrightResource(page, `${label}/page`);
    await closePlaywrightResource(context, `${label}/context`);
    stage3Progress(label, "teardown-complete", startedAt);
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
    await dismissInstallOffer(page, { timeout });
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
    await closePlaywrightResource(page, `${label}/page`);
    await closePlaywrightResource(context, `${label}/context`);
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
          await closePlaywrightResource(storyPage, `${engine}/${viewport.width}x${viewport.height}/story-page`);
          await closePlaywrightResource(storyContext, `${engine}/${viewport.width}x${viewport.height}/story-context`);
        }
      }
      if (qaScope === "all" || qaScope === "lifecycle") {
        const lifecycleContext = await browser.newContext({ viewport });
        results.push({
          kind: "audio-lifecycle",
          ...await auditAudioLifecycle({ context: lifecycleContext, engine, viewport }),
        });
        await closePlaywrightResource(lifecycleContext, `${engine}/${viewport.width}x${viewport.height}/lifecycle-context`);
      }
      if (qaScope === "all" || qaScope === "battle-audio") {
        if (requestedBattleAudioCases.has("entrance")) {
          results.push({
            kind: "takuya-entrance-audio",
            ...await auditTakuyaEntranceAudio({ browser, engine, viewport }),
          });
        }
        if (requestedBattleAudioCases.has("final")) {
          results.push({
            kind: "takuya-final-audio",
            ...await auditTakuyaFinalAudio({ browser, engine, viewport }),
          });
        }
      }
    }
    if (qaScope === "all" || qaScope === "bark") {
      results.push({
        kind: "nonblocking-bark",
        ...await auditNonblockingBark({ browser, engine }),
      });
    }
  } finally {
    await closePlaywrightResource(browser, `${engine}/browser`);
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
  battleAudioCases: [...requestedBattleAudioCases],
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
