import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { CAMPAIGN_STAGES } from "../app/campaign.js";
import { requiredBattleAssetPlan } from "../app/battleAssetPlan.js";
import { productionBuildIdentity } from "./browser-qa-build-identity.mjs";
import { dismissInstallOffer } from "./pwa-gate-qa.mjs";
import { createWebKitHostResourceTelemetry } from "./webkit-host-resource-telemetry.mjs";
import sharp from "sharp";

const baseUrl = new URL(process.env.V0995_VISUAL_QA_BASE_URL ?? "http://127.0.0.1:4177/");
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) throw new Error("v0995 visual QA is local-only");
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href)
  : await import("playwright");
const engines = (process.env.V0995_VISUAL_QA_ENGINES ?? "chromium,webkit").split(",");
const selectedFaultClasses = new Set((process.env.V0995_VISUAL_QA_FAULT_CLASSES ?? "background,unit,later-enemy,mission,support").split(","));
const selectedFaultModes = new Set((process.env.V0995_VISUAL_QA_FAULT_MODES ?? "delay,404,corrupt,decode-reject,decode-timeout").split(","));
const viewports = (process.env.V0995_VISUAL_QA_VIEWPORTS ?? "844x340,844x390,1280x720")
  .split(",").map((entry) => {
    const [width, height] = entry.split("x").map(Number);
    return { width, height };
  });
const evidenceDir = path.resolve(process.env.V0995_VISUAL_QA_EVIDENCE_DIR ?? "outputs/v0995-visual-integrity");
const compactDir = path.resolve(process.env.V0995_VISUAL_QA_COMPACT_DIR ?? "docs/qa/v0995/visual-integrity");
const VISUAL_INTEGRITY_SCREENSHOT_TIMEOUT_MS = 10_000;
const VISUAL_INTEGRITY_PRESENTATION_TIMEOUT_MS = 2_000;
const FIGHTER_UNIT_LAYER_AUDIT_TOTAL_TIMEOUT_MS = 10_000;
const FIGHTER_UNIT_LAYER_AUDIT_TRANSACTION_TIMEOUT_MS = 2_000;
const FIGHTER_UNIT_LAYER_AUDIT_HOST_TURN_MS = 100;
const FIGHTER_UNIT_LAYER_AUDIT_PASSES = Object.freeze([
  "actual-unit",
  "forced-opaque-unit",
  "rendered-foreground",
  "expected-foreground",
  "final-production-canvas",
  "authored-composite",
]);
await mkdir(evidenceDir, { recursive: true });
await mkdir(compactDir, { recursive: true });

const invariant = (condition, message) => { if (!condition) throw new Error(message); };
const hostTurn = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function boundedFighterUnitLayerAuditTransaction(operation, deadlineAt, label) {
  const transactionTimeoutMs = Math.min(
    FIGHTER_UNIT_LAYER_AUDIT_TRANSACTION_TIMEOUT_MS,
    deadlineAt - Date.now(),
  );
  if (transactionTimeoutMs <= 0) throw new Error(`${label}: unit-layer audit exhausted its existing 10000 ms budget`);
  let timeoutId;
  try {
    const result = await Promise.race([
      operation.then(
        (value) => ({ status: "fulfilled", value }),
        (error) => ({ status: "rejected", error }),
      ),
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve({ status: "timeout" }), transactionTimeoutMs);
      }),
    ]);
    if (result.status === "fulfilled") return result.value;
    if (result.status === "rejected") throw result.error;
    throw new Error(`${label}: unit-layer audit page transaction exceeded ${transactionTimeoutMs} ms`);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runFighterUnitLayerAuditSession(page, fighterId, label) {
  const deadlineAt = Date.now() + FIGHTER_UNIT_LAYER_AUDIT_TOTAL_TIMEOUT_MS;
  const begin = await boundedFighterUnitLayerAuditTransaction(
    page.evaluate((id) => window.__ASHFALL_BATTLE_QA__.beginFighterUnitLayerAuditSession(id), fighterId),
    deadlineAt,
    `${label}/begin`,
  );
  invariant(begin?.schema === "v100-fighter-unit-layer-audit-session/v1"
    && typeof begin.token === "string"
    && begin.fighterId === fighterId
    && begin.passCount === FIGHTER_UNIT_LAYER_AUDIT_PASSES.length,
  `${label}: unit-layer audit session did not bind exact fighter ownership ${JSON.stringify(begin)}`);
  const steps = [];
  for (const [index, expectedPass] of FIGHTER_UNIT_LAYER_AUDIT_PASSES.entries()) {
    const step = await boundedFighterUnitLayerAuditTransaction(
      page.evaluate((token) => window.__ASHFALL_BATTLE_QA__.advanceFighterUnitLayerAuditSession(token), begin.token),
      deadlineAt,
      `${label}/${expectedPass}`,
    );
    invariant(step?.schema === "v100-fighter-unit-layer-audit-session-step/v1"
      && step.token === begin.token
      && step.step === index + 1
      && step.pass === expectedPass
      && step.complete === (index === FIGHTER_UNIT_LAYER_AUDIT_PASSES.length - 1),
    `${label}: unit-layer audit step order drifted ${JSON.stringify(step)}`);
    steps.push(step);
    if (index < FIGHTER_UNIT_LAYER_AUDIT_PASSES.length - 1) {
      invariant(deadlineAt - Date.now() > FIGHTER_UNIT_LAYER_AUDIT_HOST_TURN_MS,
        `${label}: unit-layer audit lacks its existing host-turn budget`);
      await hostTurn(FIGHTER_UNIT_LAYER_AUDIT_HOST_TURN_MS);
    }
  }
  const audit = await boundedFighterUnitLayerAuditTransaction(
    page.evaluate((token) => window.__ASHFALL_BATTLE_QA__.finalizeFighterUnitLayerAuditSession(token), begin.token),
    deadlineAt,
    `${label}/finalize`,
  );
  invariant(audit?.scratchSurface?.schema === "v100-fighter-unit-layer-audit-scratch/v1"
    && audit.scratchSurface.surfaceCount === 1
    && audit.scratchSurface.contextCount === 1
    && audit.scratchSurface.passCount === 6
    && audit.transportSession?.schema === "v100-fighter-unit-layer-audit-session/v1"
    && audit.transportSession.token === begin.token
    && audit.transportSession.passCount === 6
    && JSON.stringify(audit.transportSession.completedPasses) === JSON.stringify(FIGHTER_UNIT_LAYER_AUDIT_PASSES)
    && audit.transportSession.finalizedWithoutCanvasDraw === true
    && Date.now() <= deadlineAt,
  `${label}: unit-layer audit final receipt is incomplete ${JSON.stringify(audit?.transportSession)}`);
  return { ...audit, transportSteps: steps };
}

async function awaitVisualIntegrityPresentationSuppression(page, owner, generation, label) {
  const handle = await page.waitForFunction(({ requestedOwner, requestedGeneration }) => {
    const receipt = window.__ASHFALL_BATTLE_QA__?.getQaPresentationQuiescence?.() ?? null;
    return receipt?.schema === "v100-qa-presentation-quiescence/v1"
      && receipt.active === true
      && receipt.owner === requestedOwner
      && receipt.route === "visual-integrity"
      && receipt.generation === requestedGeneration
      && receipt.datasetActive === true
      && receipt.running === true
      && receipt.over !== true
      && Number(receipt.suppressedRenderFrames) > 0
      ? receipt
      : false;
  }, { requestedOwner: owner, requestedGeneration: generation }, {
    timeout: VISUAL_INTEGRITY_PRESENTATION_TIMEOUT_MS,
    polling: 16,
  });
  const receipt = await handle.jsonValue();
  await handle.dispose();
  invariant(receipt?.owner === owner && receipt.generation === generation,
    `${label}: visual-integrity presentation suppression ownership drifted`);
  return receipt;
}

async function releaseVisualIntegrityPresentation(page, arm, label) {
  const owner = "visual-integrity-evidence-capture";
  const release = await page.evaluate((requestedOwner) => (
    window.__ASHFALL_BATTLE_QA__.setQaPresentationQuiesced(false, requestedOwner)
  ), owner);
  invariant(release?.schema === "v100-qa-presentation-quiescence/v1"
    && release.active === false
    && release.owner === owner
    && release.route === "visual-integrity"
    && release.generation === arm.generation
    && release.datasetActive === false
    && release.running === true
    && release.over !== true
    && Number(release.suppressedRenderFrames) > 0,
  `${label}: visual-integrity presentation release drifted ${JSON.stringify(release)}`);
  const handle = await page.waitForFunction(({ requestedOwner, requestedGeneration, releasedAtRenderFrames }) => {
    const receipt = window.__ASHFALL_BATTLE_QA__?.getQaPresentationQuiescence?.() ?? null;
    return receipt?.schema === "v100-qa-presentation-quiescence/v1"
      && receipt.active === false
      && receipt.owner === requestedOwner
      && receipt.route === "visual-integrity"
      && receipt.generation === requestedGeneration
      && receipt.datasetActive === false
      && receipt.running === true
      && receipt.over !== true
      && Number(receipt.renderFrames) >= Number(releasedAtRenderFrames) + 3
      ? receipt
      : false;
  }, {
    requestedOwner: owner,
    requestedGeneration: arm.generation,
    releasedAtRenderFrames: release.releasedAtRenderFrames,
  }, { timeout: VISUAL_INTEGRITY_PRESENTATION_TIMEOUT_MS, polling: 16 });
  const restored = await handle.jsonValue();
  await handle.dispose();
  return { release, restored };
}

async function transitionVisualIntegrityMutablePresentation(page, {
  state = null,
  previousArm = null,
  finalRelease = false,
  label,
}) {
  const owner = "visual-integrity-evidence-capture";
  invariant(finalRelease === (state === null),
    `${label}: mutable presentation transition must request exactly one state or the final release`);
  const transition = await page.evaluate(async ({
    requestedOwner,
    requestedState,
    previousGeneration,
    releaseOnly,
    transitionTimeoutMs,
  }) => {
    const bridge = window.__ASHFALL_BATTLE_QA__;
    if (typeof bridge?.setStationMissionPixelAuditState !== "function"
      || typeof bridge?.setQaPresentationQuiesced !== "function"
      || typeof bridge?.getQaPresentationQuiescence !== "function") {
      throw new Error("visual-integrity mutable presentation bridge is unavailable");
    }
    const before = bridge.getQaPresentationQuiescence();
    const initialPrearm = previousGeneration === null;
    const transitionPhase = initialPrearm ? "initial-prearm" : "predecessor-released";
    let release = null;
    if (initialPrearm) {
      if (releaseOnly) {
        throw new Error("visual-integrity final mutable release lacks its exact predecessor generation");
      }
      if (!(before?.schema === "v100-qa-presentation-quiescence/v1"
        && before.active === false
        && before.owner === null
        && before.route === null
        && before.datasetActive === false
        && before.running === true
        && before.paused === false
        && before.over !== true
        && Number(before.generation) === 0)) {
        throw new Error(`visual-integrity initial prearm state drifted ${JSON.stringify(before)}`);
      }
    } else {
      if (!(before?.schema === "v100-qa-presentation-quiescence/v1"
        && before.active === true
        && before.owner === requestedOwner
        && before.route === "visual-integrity"
        && before.datasetActive === true
        && before.running === true
        && before.paused === false
        && before.over !== true
        && Number(before.generation) === Number(previousGeneration))) {
        throw new Error(`visual-integrity mutable predecessor ownership drifted ${JSON.stringify(before)}`);
      }
      release = bridge.setQaPresentationQuiesced(false, requestedOwner);
      if (!(release?.schema === "v100-qa-presentation-quiescence/v1"
        && release.active === false
        && release.owner === requestedOwner
        && release.route === "visual-integrity"
        && release.datasetActive === false
        && release.running === true
        && release.paused === false
        && release.over !== true
        && Number(release.generation) === Number(previousGeneration))) {
        throw new Error(`visual-integrity mutable predecessor release drifted ${JSON.stringify(release)}`);
      }
    }

    const baselineRenderFrames = Number(release?.releasedAtRenderFrames ?? before?.renderFrames);
    if (!Number.isFinite(baselineRenderFrames)) {
      throw new Error("visual-integrity mutable transition lacks a finite render baseline");
    }
    if (!releaseOnly) bridge.setStationMissionPixelAuditState(requestedState);
    const requiredRenderFrameDelta = previousGeneration === null ? 2 : 3;
    const restored = await new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const timer = setTimeout(() => {
        reject(new Error(`visual-integrity mutable transition exceeded ${transitionTimeoutMs} ms`));
      }, transitionTimeoutMs);
      const observe = () => {
        const quiescence = bridge.getQaPresentationQuiescence();
        const renderFrameDelta = Number(quiescence?.renderFrames) - baselineRenderFrames;
        const canvas = document.querySelector("canvas.battlefield.active");
        const rect = canvas?.getBoundingClientRect?.() ?? null;
        const style = canvas ? getComputedStyle(canvas) : null;
        const inactivePresentationReady = quiescence?.schema === "v100-qa-presentation-quiescence/v1"
          && quiescence.active === false
          && quiescence.datasetActive === false
          && quiescence.running === true
          && quiescence.paused === false
          && quiescence.over !== true;
        const phaseIdentityReady = initialPrearm
          ? quiescence?.owner === null
            && quiescence?.route === null
            && Number(quiescence?.generation) === 0
          : quiescence?.owner === requestedOwner
            && quiescence?.route === "visual-integrity"
            && Number(quiescence?.generation) === Number(previousGeneration);
        const canvasReady = rect?.width > 0
          && rect?.height > 0
          && style?.display !== "none"
          && style?.visibility !== "hidden"
          && Number(style?.opacity) > 0;
        if (renderFrameDelta > requiredRenderFrameDelta) {
          clearTimeout(timer);
          const terminalObservation = {
            transitionPhase,
            requiredRenderFrameDelta,
            actualRenderFrameDelta: renderFrameDelta,
            quiescence: {
              schema: quiescence?.schema ?? null,
              active: quiescence?.active ?? null,
              owner: quiescence?.owner ?? null,
              route: quiescence?.route ?? null,
              datasetActive: quiescence?.datasetActive ?? null,
              generation: quiescence?.generation ?? null,
              running: quiescence?.running ?? null,
              paused: quiescence?.paused ?? null,
              over: quiescence?.over ?? null,
              renderFrames: quiescence?.renderFrames ?? null,
            },
            phaseIdentityReady,
            inactivePresentationReady,
            canvasReady,
          };
          reject(new Error(`visual-integrity mutable transition missed its exact production-frame checkpoint ${JSON.stringify(terminalObservation)}`));
          return;
        }
        const ready = inactivePresentationReady
          && phaseIdentityReady
          && renderFrameDelta === requiredRenderFrameDelta
          && canvasReady;
        if (ready) {
          clearTimeout(timer);
          resolve({
            transitionPhase,
            quiescence,
            renderFrameDelta,
            requiredRenderFrameDelta,
            elapsedMs: performance.now() - startedAt,
            canvas: {
              width: rect.width,
              height: rect.height,
              display: style.display,
              visibility: style.visibility,
              opacity: style.opacity,
            },
          });
          return;
        }
        requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
    });
    if (releaseOnly) {
      return {
        schema: "v100-visual-integrity-mutable-state-owner-handoff/v1",
        transitionPhase,
        requestedState: null,
        previousOwner: requestedOwner,
        previousGeneration,
        release,
        restored,
        nextArm: null,
      };
    }
    const nextArm = bridge.setQaPresentationQuiesced(true, requestedOwner);
    if (!(nextArm?.schema === "v100-qa-presentation-quiescence/v1"
      && nextArm.active === true
      && nextArm.owner === requestedOwner
      && nextArm.route === "visual-integrity"
      && nextArm.datasetActive === true
      && nextArm.running === true
      && nextArm.paused === false
      && nextArm.over !== true
      && Number(nextArm.generation) === Number(before.generation) + 1
      && Number(nextArm.enteredAtRenderFrames) === Number(restored.quiescence.renderFrames))) {
      throw new Error(`visual-integrity mutable successor owner did not atomically acquire the rendered state ${JSON.stringify(nextArm)}`);
    }
    return {
      schema: "v100-visual-integrity-mutable-state-owner-handoff/v1",
      transitionPhase,
      requestedState,
      previousOwner: previousGeneration === null ? null : requestedOwner,
      previousGeneration,
      release,
      restored,
      nextArm,
    };
  }, {
    requestedOwner: owner,
    requestedState: state,
    previousGeneration: previousArm?.generation ?? null,
    releaseOnly: finalRelease,
    transitionTimeoutMs: VISUAL_INTEGRITY_PRESENTATION_TIMEOUT_MS,
  });
  const expectedTransitionPhase = previousArm ? "predecessor-released" : "initial-prearm";
  invariant(transition?.schema === "v100-visual-integrity-mutable-state-owner-handoff/v1"
    && transition.transitionPhase === expectedTransitionPhase
    && transition.requestedState === state
    && transition.previousGeneration === (previousArm?.generation ?? null)
    && transition.restored?.transitionPhase === expectedTransitionPhase
    && transition.restored?.requiredRenderFrameDelta === (previousArm ? 3 : 2)
    && transition.restored?.renderFrameDelta === transition.restored.requiredRenderFrameDelta,
  `${label}: mutable presentation transition receipt drifted ${JSON.stringify(transition)}`);
  if (finalRelease) {
    invariant(transition.release?.generation === previousArm.generation
      && transition.nextArm === null,
    `${label}: final mutable presentation owner did not restore exactly three frames`);
    return transition;
  }
  const suppressed = await awaitVisualIntegrityPresentationSuppression(
    page,
    owner,
    transition.nextArm.generation,
    label,
  );
  return { ...transition, suppressed };
}

async function withPrearmedVisualIntegrityScreenshotQuiescence(page, label, transition, operation) {
  const owner = "visual-integrity-evidence-capture";
  const arm = transition?.nextArm;
  const suppressed = transition?.suppressed;
  invariant(transition?.schema === "v100-visual-integrity-mutable-state-owner-handoff/v1"
    && arm?.schema === "v100-qa-presentation-quiescence/v1"
    && arm.active === true
    && arm.owner === owner
    && arm.route === "visual-integrity"
    && suppressed?.generation === arm.generation
    && Number(suppressed?.suppressedRenderFrames) > 0,
  `${label}: mutable screenshot lacks its pre-armed presentation owner`);
  const value = await operation();
  return {
    value,
    receipt: {
      schema: "v100-visual-integrity-screenshot-quiescence/v1",
      owner,
      arm,
      suppressed,
      release: null,
      restored: null,
    },
  };
}

function completeVisualIntegrityScreenshotReceipt(receipt, successorTransition, label) {
  invariant(receipt?.schema === "v100-visual-integrity-screenshot-quiescence/v1"
    && successorTransition?.schema === "v100-visual-integrity-mutable-state-owner-handoff/v1"
    && successorTransition.previousOwner === receipt.owner
    && successorTransition.previousGeneration === receipt.arm.generation
    && successorTransition.release?.generation === receipt.arm.generation
    && successorTransition.restored?.renderFrameDelta === 3,
  `${label}: mutable screenshot release/restoration receipt is incomplete`);
  receipt.release = successorTransition.release;
  receipt.restored = successorTransition.restored;
  return receipt;
}

async function withVisualIntegrityScreenshotQuiescence(page, label, operation) {
  const owner = "visual-integrity-evidence-capture";
  const arm = await page.evaluate((requestedOwner) => (
    window.__ASHFALL_BATTLE_QA__.setQaPresentationQuiesced(true, requestedOwner)
  ), owner);
  invariant(arm?.schema === "v100-qa-presentation-quiescence/v1"
    && arm.active === true
    && arm.owner === owner
    && arm.route === "visual-integrity"
    && arm.datasetActive === true
    && arm.running === true
    && arm.paused === false
    && arm.over !== true,
  `${label}: visual-integrity screenshot quiescence did not arm ${JSON.stringify(arm)}`);
  const suppressed = await awaitVisualIntegrityPresentationSuppression(page, owner, arm.generation, label);
  let value;
  let operationError = null;
  try {
    value = await operation();
  } catch (error) {
    operationError = error;
  }
  let restoration = null;
  let releaseError = null;
  if (!page.isClosed()) {
    try {
      restoration = await releaseVisualIntegrityPresentation(page, arm, label);
    } catch (error) {
      releaseError = error;
    }
  }
  if (operationError) {
    if (releaseError) throw new Error(`${String(operationError)}; visual-integrity release also failed: ${String(releaseError)}`);
    throw operationError;
  }
  if (releaseError) throw releaseError;
  return {
    value,
    receipt: {
      schema: "v100-visual-integrity-screenshot-quiescence/v1",
      owner,
      arm,
      suppressed,
      release: restoration.release,
      restored: restoration.restored,
    },
  };
}
const diagnostics = [];
const faultDiagnostics = [];
const transportRetries = [];
const hostResourceTelemetryResults = [];
const missionStage = CAMPAIGN_STAGES.find(({ missionType }) => missionType === "sequential-seal");
const lateEnemyStage = CAMPAIGN_STAGES.find(({ waves }) => waves?.some(({ groups }, index) => (
  index > 0 && groups.length > 0
)));
invariant(missionStage && lateEnemyStage, "fault fixtures require mission and multi-wave stages");
const missionPlan = requiredBattleAssetPlan({
  stageId: missionStage.id,
  formationKinds: ["brawler"],
  enemyKinds: missionStage.enemyKinds,
});
const lateFirstWave = new Set(lateEnemyStage.waves[0].groups.map(({ kind }) => kind));
const laterEnemy = lateEnemyStage.enemyKinds.find((kind) => !lateFirstWave.has(kind)) ?? lateEnemyStage.enemyKinds.at(-1);
const latePlan = requiredBattleAssetPlan({
  stageId: lateEnemyStage.id,
  formationKinds: ["brawler"],
  enemyKinds: lateEnemyStage.enemyKinds,
});
const faultClasses = [
  { className: "background", stageId: missionStage.id, path: missionPlan.background.path, plan: missionPlan },
  { className: "unit", stageId: missionStage.id, path: missionPlan.sprites.find(({ kind }) => kind === "brawler").path, plan: missionPlan },
  { className: "later-enemy", stageId: lateEnemyStage.id, path: latePlan.sprites.find(({ kind }) => kind === laterEnemy).path, plan: latePlan },
  { className: "mission", stageId: missionStage.id, path: missionPlan.stageObjects.find(({ category }) => category === "mission").path, plan: missionPlan },
  { className: "support", stageId: missionStage.id, path: missionPlan.persistent.find(({ category }) => category === "support").path, plan: missionPlan },
];
const runEngine = async (engineName, browserType) => {
  const hostResourceTelemetry = engineName === "webkit"
    ? await createWebKitHostResourceTelemetry({
      evidenceDir,
      label: `${engineName}-visual-integrity`,
      referenceRoot: process.cwd(),
      metadata: { owner: "hosted-visual-integrity", engine: engineName },
    })
    : null;
  const hostResourceTelemetryRecord = hostResourceTelemetry?.reference() ?? null;
  if (hostResourceTelemetryRecord) hostResourceTelemetryResults.push(hostResourceTelemetryRecord);
  let browser = null;
  let activeCaseDetails = null;
  let primaryFailure = null;
  const setTelemetryIdle = (details = activeCaseDetails ?? {}) => hostResourceTelemetry?.setContext({
    owner: "hosted-visual-integrity",
    engine: engineName,
    ...details,
    operationId: "hosted-visual-idle",
    operationStatus: "idle",
  });
  const runHostTelemetryOperation = async (operationId, details, operation) => {
    const operationContext = {
      owner: "hosted-visual-integrity",
      engine: engineName,
      ...(activeCaseDetails ?? {}),
      ...details,
      operationId,
      operationStatus: "running",
    };
    hostResourceTelemetry?.setContext(operationContext);
    hostResourceTelemetry?.event("operation-begin", operationContext);
    try {
      const result = await operation();
      hostResourceTelemetry?.event("operation-end", { ...operationContext, operationStatus: "completed" });
      setTelemetryIdle();
      return result;
    } catch (error) {
      const failedContext = { ...operationContext, operationStatus: "failed", error: String(error) };
      hostResourceTelemetry?.event("operation-end", failedContext);
      hostResourceTelemetry?.setContext(failedContext);
      throw error;
    }
  };
  const attachPageTelemetry = (page, details) => {
    hostResourceTelemetry?.event("page-created", details);
    page.on("crash", () => hostResourceTelemetry?.event("page-crash", details));
    page.on("close", () => hostResourceTelemetry?.event("page-close", details));
  };
  const launchCaseBrowser = async (details) => {
    invariant(browser === null, `${engineName}: previous case browser was not closed`);
    hostResourceTelemetry?.setContext({ owner: "hosted-visual-integrity", engine: engineName, ...details, operationId: "browser-launch", operationStatus: "running" });
    hostResourceTelemetry?.event("browser-launch-begin", { engine: engineName, ...details });
    browser = await browserType.launch({ headless: true });
    activeCaseDetails = details;
    hostResourceTelemetry?.event("browser-launched", { engine: engineName, ...details });
    browser.on("disconnected", () => hostResourceTelemetry?.event("browser-disconnect", { engine: engineName, ...details }));
    setTelemetryIdle(details);
    return browser;
  };
  const closeCaseBrowser = async (details) => {
    const caseBrowser = browser;
    browser = null;
    activeCaseDetails = null;
    if (!caseBrowser) return;
    hostResourceTelemetry?.setContext({ owner: "hosted-visual-integrity", engine: engineName, ...details, operationId: "browser-cleanup", operationStatus: "running" });
    hostResourceTelemetry?.event("browser-cleanup-begin", { engine: engineName, ...details });
    await caseBrowser.close();
    hostResourceTelemetry?.event("browser-cleanup-complete", { engine: engineName, ...details });
    setTelemetryIdle(details);
  };
  try {
    for (const viewport of viewports) {
      const caseDetails = { phase: "ready-case", viewport: `${viewport.width}x${viewport.height}` };
      await launchCaseBrowser(caseDetails);
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      attachPageTelemetry(page, caseDetails);
      const errors = [];
      page.on("console", (message) => { if (message.type() === "error") errors.push(`console:${message.text()}`); });
      page.on("pageerror", (error) => errors.push(`page:${error.message}`));
      page.on("requestfailed", (request) => errors.push(`request:${request.url()}:${request.failure()?.errorText}`));
      const url = new URL(baseUrl);
      url.search = new URLSearchParams({
        qa: "mission",
        stage: CAMPAIGN_STAGES[0].id,
        state: "start",
        qaVisualIntegrity: "1",
      }).toString();
      await runHostTelemetryOperation("hosted/asset-boundary", { caseKind: "ready" }, async () => {
        await page.goto(url.href, { waitUntil: "domcontentloaded" });
        await dismissInstallOffer(page);
        await page.waitForFunction(() => document.documentElement.dataset.assetLoadState === "ready", null, { timeout: 120_000 });
        await page.waitForFunction(() => window.__ASHFALL_ASSET_QA__?.getBattleMountState?.().battleMounted === true, null, { timeout: 30_000 });
      });
      const audit = await runHostTelemetryOperation(
        "hosted/final-canvas-audit",
        { caseKind: "ready", auditKind: "required-assets" },
        () => page.evaluate(() => {
          const bridge = window.__ASHFALL_ASSET_QA__;
          const state = bridge.getState();
          const plan = bridge.getRequiredPlan();
          const sprites = new Set(bridge.getLoadedSpriteKeys());
          const stageObjects = new Set(bridge.getLoadedStageObjectKeys());
          return {
            state,
            plan: { stageId: plan.stageId, paths: plan.paths, sprites: plan.sprites, stageObjects: plan.stageObjects },
            missingSprites: plan.sprites.filter(({ kind }) => !sprites.has(kind)).map(({ kind }) => kind),
            missingStageObjects: plan.stageObjects.filter(({ id }) => !stageObjects.has(id)).map(({ id }) => id),
            mount: bridge.getBattleMountState(),
          };
        }),
      );
      invariant(audit.state.state === "ready" && audit.state.failed === 0, JSON.stringify(audit.state));
      invariant(audit.missingSprites.length === 0, `missing sprites ${audit.missingSprites}`);
      invariant(audit.missingStageObjects.length === 0, `missing stage objects ${audit.missingStageObjects}`);
      let monkeyRenderProof = null;
      if (viewport.width === 844 && viewport.height === 390) {
        monkeyRenderProof = await runHostTelemetryOperation(
          "hosted/final-canvas-audit",
          { caseKind: "ready", auditKind: "engineer-render" },
          async () => {
            const preparedProof = await page.evaluate(async () => {
              const qa = window.__ASHFALL_BATTLE_QA__;
              const asset = await qa.ensureUnitRenderProofAsset("engineer");
              const prepared = qa.prepareCrawlerDefenseProof({ attackerKind: "walker", lane: 1, existingClaim: false });
              if (!Number.isInteger(prepared?.attackerId) || qa.queueCrawlerDefenseUnit("engineer", 1) !== true) {
                throw new Error("Monkey production deployment fixture is unavailable");
              }
              const startedAt = performance.now();
              let released = false;
              let lastObservation = null;
              while (performance.now() - startedAt < 20_000) {
                const fighter = qa.getSnapshot().fighters.find((candidate) => (
                  candidate.kind === "engineer"
                  && candidate.side === "human"
                  && candidate.spawnPortalId === "crawler-door"
                ));
                lastObservation = fighter ? { id: fighter.id, renderAudit: fighter.renderAudit } : null;
                if (fighter && !released) {
                  qa.setRepresentativeSixProofPaused(false);
                  released = true;
                }
                if (fighter?.renderAudit?.assetReady === true
                  && fighter.renderAudit.spriteState
                  && fighter.renderAudit.effectiveOpacity === 1) {
                  const presentationArm = qa.setQaPresentationQuiesced(
                    true,
                    "visual-integrity-evidence-capture",
                  );
                  qa.setRepresentativeSixProofPaused(true);
                  const frozen = qa.getSnapshot().fighters.find((candidate) => candidate.id === fighter.id);
                  return { asset, fighter: frozen, presentationArm };
                }
                await new Promise((resolve) => requestAnimationFrame(resolve));
              }
              throw new Error(`Monkey never reached the production battle renderer ${JSON.stringify(lastObservation)}`);
            });
            const arm = preparedProof.presentationArm;
            invariant(arm?.schema === "v100-qa-presentation-quiescence/v1"
              && arm.active === true
              && arm.owner === "visual-integrity-evidence-capture"
              && arm.route === "visual-integrity"
              && arm.paused === false,
            `${engineName}: Monkey presentation quiescence did not arm ${JSON.stringify(arm)}`);
            let unitLayer = null;
            let suppression = null;
            let operationError = null;
            try {
              suppression = await awaitVisualIntegrityPresentationSuppression(
                page,
                arm.owner,
                arm.generation,
                `${engineName}/Monkey`,
              );
              unitLayer = await runFighterUnitLayerAuditSession(
                page,
                preparedProof.fighter.id,
                `${engineName}/Monkey`,
              );
            } catch (error) {
              operationError = error;
            }
            let restoration = null;
            let releaseError = null;
            if (!page.isClosed()) {
              try {
                restoration = await releaseVisualIntegrityPresentation(page, arm, `${engineName}/Monkey`);
              } catch (error) {
                releaseError = error;
              }
            }
            if (operationError) {
              if (releaseError) throw new Error(`${String(operationError)}; Monkey presentation release also failed: ${String(releaseError)}`);
              throw operationError;
            }
            if (releaseError) throw releaseError;
            return {
              asset: preparedProof.asset,
              fighter: preparedProof.fighter,
              unitLayer,
              presentationQuiescence: {
                schema: "v100-visual-integrity-unit-layer-quiescence/v1",
                arm,
                suppression,
                release: restoration.release,
                restored: restoration.restored,
              },
            };
          },
        );
        invariant(monkeyRenderProof.asset?.path === "/art/v070/characters/engineer-battle-v1.png",
          `${engineName}: Monkey renderer resolved ${monkeyRenderProof.asset?.path}`);
        invariant(monkeyRenderProof.fighter?.renderAudit?.assetReady === true,
          `${engineName}: Monkey approved atlas was not consumed by the production renderer`);
        invariant(monkeyRenderProof.unitLayer?.alphaOneFromFirstVisibleFrame === true
          && monkeyRenderProof.unitLayer?.finalCompositePixels?.pass === true
          && monkeyRenderProof.unitLayer?.finalCompositePixels?.singleUnitSilhouette === true,
        `${engineName}: Monkey final-canvas render proof failed ${JSON.stringify(monkeyRenderProof.unitLayer)}`);
      }
      invariant(errors.length === 0, `${engineName}/${viewport.width}x${viewport.height}: ${errors.join("\n")}`);
      const screenshot = path.join(evidenceDir, `${engineName}-${viewport.width}x${viewport.height}-required-assets.png`);
      await runHostTelemetryOperation(
        "hosted/page-screenshot",
        { caseKind: "ready", screenshotKind: "required-assets" },
        () => page.screenshot({ path: screenshot, fullPage: true }),
      );
      diagnostics.push({ engine: engineName, viewport, audit, monkeyRenderProof, errors, screenshot: path.relative(process.cwd(), screenshot).replaceAll("\\", "/") });
      await context.close();
      await closeCaseBrowser(caseDetails);
    }
    for (const fixture of faultClasses.filter(({ className }) => selectedFaultClasses.has(className))) {
      for (const mode of ["delay", "404", "corrupt", "decode-reject", "decode-timeout"].filter((entry) => selectedFaultModes.has(entry))) {
        const faultViewports = fixture.className === "mission" ? viewports : [{ width: 844, height: 390 }];
        for (const faultViewport of faultViewports) {
        const caseDetails = {
          phase: "fault-case",
          viewport: `${faultViewport.width}x${faultViewport.height}`,
          faultClass: fixture.className,
          faultMode: mode,
        };
        await launchCaseBrowser(caseDetails);
        const context = await browser.newContext({ viewport: faultViewport });
        const page = await context.newPage();
        attachPageTelemetry(page, caseDetails);
        const requestCounts = new Map();
        page.on("request", (request) => {
          const pathname = new URL(request.url()).pathname;
          requestCounts.set(pathname, (requestCounts.get(pathname) ?? 0) + 1);
        });
        const url = new URL(baseUrl);
        url.search = new URLSearchParams({
          qa: "mission",
          stage: fixture.stageId,
          state: "start",
          qaVisualIntegrity: "1",
          faultNonce: `${engineName}-${fixture.className}-${mode}`,
        }).toString();
        const faultOperationDetails = {
          caseKind: "fault",
          faultClass: fixture.className,
          faultMode: mode,
          faultPath: fixture.path,
        };
        await runHostTelemetryOperation("hosted/asset-boundary", faultOperationDetails, async () => {
          await page.goto(url.href, { waitUntil: "domcontentloaded" });
          await dismissInstallOffer(page);
          await page.waitForFunction(({ expectedPath }) => document.documentElement.dataset.assetLoadState === "ready"
            && window.__ASHFALL_ASSET_QA__?.getRequiredPlan?.().background.path === expectedPath,
          { expectedPath: fixture.plan.background.path }, { timeout: 120_000 }).catch(async (error) => {
            const debug = await page.evaluate(() => ({
              state: window.__ASHFALL_ASSET_QA__?.getState?.() ?? null,
              history: window.__ASHFALL_ASSET_QA__?.getHistory?.() ?? null,
              requiredBackground: window.__ASHFALL_ASSET_QA__?.getRequiredPlan?.().background.path ?? null,
            }));
            throw new Error(`${engineName}/${fixture.className}/${mode}: baseline ready timeout ${JSON.stringify(debug)}`, { cause: error });
          });
        });
        await runHostTelemetryOperation("hosted/fault-start", faultOperationDetails, async () => {
          if (mode === "decode-reject" || mode === "decode-timeout") {
            await page.evaluate(({ faultPath, faultMode }) => {
              const originalDecode = HTMLImageElement.prototype.decode;
              window.__ASHFALL_QA_RESTORE_DECODE__ = () => {
                Object.defineProperty(HTMLImageElement.prototype, "decode", { configurable: true, value: originalDecode });
                delete window.__ASHFALL_QA_RESTORE_DECODE__;
              };
              Object.defineProperty(HTMLImageElement.prototype, "decode", {
                configurable: true,
                value() {
                  const sourcePath = (() => {
                    try { return new URL(this.currentSrc || this.src, location.href).pathname; } catch { return ""; }
                  })();
                  if (sourcePath === faultPath) {
                    if (faultMode === "decode-timeout") return new Promise(() => {});
                    return Promise.reject(new DOMException("QA decode rejection", "EncodingError"));
                  }
                  return originalDecode.call(this);
                },
              });
            }, { faultPath: fixture.path, faultMode: mode });
          }
          await page.evaluate(({ path: faultPath, mode: faultMode }) => {
            const next = new URL(window.location.href);
            next.searchParams.set("assetTimeout", "400");
            next.searchParams.set("assetFaultPath", faultPath);
            if (["delay", "404", "corrupt"].includes(faultMode)) next.searchParams.set("assetFaultMode", faultMode);
            else next.searchParams.delete("assetFaultMode");
            history.replaceState(history.state, "", next);
            window.__ASHFALL_ASSET_QA__.startAssetFaultProof();
          }, { path: fixture.path, mode });
        });
        const blocked = await runHostTelemetryOperation("hosted/blocked-state-readback", faultOperationDetails, async () => {
          await page.waitForFunction(({ expectedPath, faultPath }) => {
            if (document.documentElement.dataset.assetLoadState !== "error") return false;
            const bridge = window.__ASHFALL_ASSET_QA__;
            return bridge?.getRequiredPlan?.().background.path === expectedPath
              && bridge?.getFailedPaths?.().includes(faultPath);
          }, { expectedPath: fixture.plan.background.path, faultPath: fixture.path }, { timeout: 20_000 }).catch(async (error) => {
            const debug = await page.evaluate(() => ({
              state: document.documentElement.dataset.assetLoadState,
              asset: window.__ASHFALL_ASSET_QA__?.getState?.() ?? null,
            }));
            throw new Error(`${engineName}/${fixture.className}/${mode}: terminal timeout ${JSON.stringify(debug)}`, { cause: error });
          });
          return page.evaluate(() => ({
            state: window.__ASHFALL_ASSET_QA__.getState(),
            failedPaths: window.__ASHFALL_ASSET_QA__.getFailedPaths(),
            history: window.__ASHFALL_ASSET_QA__.getHistory(),
            mount: window.__ASHFALL_ASSET_QA__.getBattleMountState(),
            assetsState: document.querySelector(".game-frame")?.getAttribute("data-assets-state") ?? null,
            href: window.location.href,
            planBackground: window.__ASHFALL_ASSET_QA__.getRequiredPlan().background.path,
          }));
        });
        invariant(blocked.state.state === "error" && blocked.state.retryAvailable === true, `${engineName}/${fixture.className}/${mode}: not blocked ${JSON.stringify(blocked)}`);
        invariant(blocked.failedPaths.includes(fixture.path), `${engineName}/${fixture.className}/${mode}: fault path absent ${JSON.stringify(blocked)}`);
        const terminalSession = blocked.history.at(-1);
        invariant(terminalSession?.status === "error"
          && terminalSession.failures.length === 1
          && terminalSession.failures[0].path === fixture.path,
        `${engineName}/${fixture.className}/${mode}: unrelated required asset failed ${JSON.stringify(terminalSession)}`);
        const expectedFailureReason = mode.startsWith("decode-")
          ? "decode"
          : mode === "delay" ? "timeout" : "http";
        invariant(terminalSession.failures[0].reason === expectedFailureReason,
          `${engineName}/${fixture.className}/${mode}: wrong failure reason ${JSON.stringify(terminalSession.failures[0])}`);
        invariant(blocked.mount.canPlay === false && blocked.mount.battleMounted === false,
          `${engineName}/${fixture.className}/${mode}/${faultViewport.width}x${faultViewport.height}: fault mounted battle ${JSON.stringify(blocked.mount)}`);
        invariant(blocked.mount.fallbackDrawCount === 0,
          `${engineName}/${fixture.className}/${mode}: production diagnostic fallback drew pixels`);
        const recovery = await runHostTelemetryOperation("hosted/same-screen-recovery", faultOperationDetails, async () => {
          const decodedBeforeRetry = await page.evaluate(() => window.__ASHFALL_ASSET_QA__.getDecodedRequiredPaths());
          await page.evaluate(() => {
            const url = new URL(window.location.href);
            url.searchParams.delete("assetFaultPath");
            url.searchParams.delete("assetFaultMode");
            history.replaceState(history.state, "", url);
            window.__ASHFALL_QA_RESTORE_DECODE__?.();
            window.__ASHFALL_ASSET_QA__.retry();
          });
          await page.waitForFunction(() => document.documentElement.dataset.assetLoadState === "ready", null, { timeout: 120_000 }).catch(async (error) => {
            const debug = await page.evaluate(() => ({
              dataset: { ...document.documentElement.dataset },
              state: window.__ASHFALL_ASSET_QA__?.getState?.() ?? null,
              history: window.__ASHFALL_ASSET_QA__?.getHistory?.() ?? null,
              failedPaths: window.__ASHFALL_ASSET_QA__?.getFailedPaths?.() ?? null,
              pendingPaths: window.__ASHFALL_ASSET_QA__?.getPendingPaths?.() ?? null,
            }));
            throw new Error(`${engineName}/${fixture.className}/${mode}: recovery timeout ${JSON.stringify(debug)}`, { cause: error });
          });
          const decodedAfterRetry = await page.evaluate(() => window.__ASHFALL_ASSET_QA__.getDecodedRequiredPaths());
          const recovered = await page.evaluate(() => ({
            mount: window.__ASHFALL_ASSET_QA__.getBattleMountState(),
            state: window.__ASHFALL_ASSET_QA__.getState(),
            history: window.__ASHFALL_ASSET_QA__.getHistory(),
            failedPaths: window.__ASHFALL_ASSET_QA__.getFailedPaths(),
            pendingPaths: window.__ASHFALL_ASSET_QA__.getPendingPaths(),
          }));
          await page.waitForFunction(() => window.__ASHFALL_ASSET_QA__.getBattleMountState().battleMounted === true, null, { timeout: 30_000 });
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          return { decodedBeforeRetry, decodedAfterRetry, recovered };
        });
        const { decodedBeforeRetry, decodedAfterRetry, recovered } = recovery;
        const finalCanvas = fixture.className === "mission"
          ? await runHostTelemetryOperation(
            "hosted/final-canvas-audit",
            faultOperationDetails,
            () => page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getStationMissionFinalCanvasAudit()),
          )
          : null;
        const mutableMissionStates = [];
        if (finalCanvas) {
          invariant(finalCanvas.pass === true, `${engineName}/${mode}/${faultViewport.width}x${faultViewport.height}: final mission canvas did not contain authored pixels ${JSON.stringify(finalCanvas)}`);
          let previousMutableTransition = null;
          let previousMutableState = null;
          for (const state of ["start", "power-1", "power-3"]) {
            const stateTransition = await runHostTelemetryOperation(
              "hosted/mutable-state-owner-handoff",
              { ...faultOperationDetails, mutableState: state },
              () => transitionVisualIntegrityMutablePresentation(page, {
                state,
                previousArm: previousMutableTransition?.nextArm ?? null,
                label: `${engineName}/${mode}/${state}`,
              }),
            );
            if (previousMutableState) {
              completeVisualIntegrityScreenshotReceipt(
                previousMutableState.screenshotQuiescence,
                stateTransition,
                `${engineName}/${mode}/${previousMutableState.state}`,
              );
              previousMutableState.successorTransition = stateTransition;
            }
            const pixelAudit = await runHostTelemetryOperation(
              "hosted/mutable-canvas-audit",
              { ...faultOperationDetails, mutableState: state },
              () => page.evaluate(() => window.__ASHFALL_BATTLE_QA__.getStationMissionFinalCanvasAudit()),
            );
            invariant(pixelAudit.pass === true, `${engineName}/${mode}/${state}: authored state missing from final canvas ${JSON.stringify(pixelAudit)}`);
            const screenshot = path.join(evidenceDir, `${engineName}-${faultViewport.width}x${faultViewport.height}-${mode}-${state}.png`);
            const screenshotEnvelope = await runHostTelemetryOperation(
              "hosted/page-screenshot",
              { ...faultOperationDetails, mutableState: state },
              () => withPrearmedVisualIntegrityScreenshotQuiescence(
                page,
                `${engineName}/${mode}/${state}`,
                stateTransition,
                () => page.screenshot({ path: screenshot, timeout: VISUAL_INTEGRITY_SCREENSHOT_TIMEOUT_MS }),
              ),
            );
            stateTransition.screenshot = path.relative(process.cwd(), screenshot).replaceAll("\\", "/");
            const mutableState = {
              state,
              pixelAudit,
              screenshot: path.relative(process.cwd(), screenshot).replaceAll("\\", "/"),
              screenshotQuiescence: screenshotEnvelope.receipt,
              stateTransition,
              successorTransition: null,
              finalRelease: null,
            };
            mutableMissionStates.push(mutableState);
            previousMutableTransition = stateTransition;
            previousMutableState = mutableState;
          }
          const finalMutableRelease = await runHostTelemetryOperation(
            "hosted/mutable-final-owner-release",
            { ...faultOperationDetails, mutableState: "power-3" },
            () => transitionVisualIntegrityMutablePresentation(page, {
              previousArm: previousMutableTransition?.nextArm ?? null,
              finalRelease: true,
              label: `${engineName}/${mode}/power-3/final-release`,
            }),
          );
          completeVisualIntegrityScreenshotReceipt(
            previousMutableState?.screenshotQuiescence,
            finalMutableRelease,
            `${engineName}/${mode}/power-3`,
          );
          previousMutableState.finalRelease = finalMutableRelease;
          invariant(new Set(mutableMissionStates.map(({ pixelAudit }) => pixelAudit.authoredStateSignature)).size === mutableMissionStates.length,
            `${engineName}/${mode}: mutable mission states collapsed to the same authored pixels`);
        }
        const intendedFailurePaths = new Set(blocked.failedPaths);
        const missingDecodedSuccesses = decodedBeforeRetry
          .filter((assetPath) => !intendedFailurePaths.has(assetPath) && !decodedAfterRetry.includes(assetPath));
        invariant(missingDecodedSuccesses.length === 0,
          `${engineName}/${fixture.className}/${mode}: retry discarded a decoded successful asset ${JSON.stringify(missingDecodedSuccesses)}`);
        const retrySession = recovered.history.at(-1);
        invariant(retrySession?.reason === "same-screen-retry"
          && retrySession.total === intendedFailurePaths.size
          && retrySession.status === "ready",
        `${engineName}/${fixture.className}/${mode}: failed-only recovery session missing ${JSON.stringify(retrySession)}`);
        faultDiagnostics.push({ engine: engineName, viewport: faultViewport, fixture: { className: fixture.className, stageId: fixture.stageId, path: fixture.path }, mode, blocked, recovered, finalCanvas, mutableMissionStates, decodedBeforeRetry, decodedAfterRetry, missingDecodedSuccesses, requestCounts: Object.fromEntries(requestCounts) });
        await context.close();
        await closeCaseBrowser(caseDetails);
        }
      }
    }
  } catch (error) {
    primaryFailure = error;
    hostResourceTelemetry?.event("engine-failure", { engine: engineName, error: String(error) });
    throw error;
  } finally {
    hostResourceTelemetry?.event("engine-cleanup-begin", { engine: engineName });
    let browserCleanupFailure = null;
    try {
      await closeCaseBrowser({ ...(activeCaseDetails ?? {}), cleanupReason: "engine-finally" });
    } catch (cleanupError) {
      if (primaryFailure) primaryFailure.browserCleanupError = String(cleanupError);
      else browserCleanupFailure = cleanupError;
    }
    let telemetrySummary = null;
    try {
      telemetrySummary = await hostResourceTelemetry?.stop({ event: "hosted-visual-cleanup-complete", engine: engineName });
    } catch (telemetryError) {
      const priorFailure = primaryFailure ?? browserCleanupFailure;
      if (priorFailure) {
        priorFailure.hostResourceTelemetryFailure = {
          code: "WEBKIT_HOST_TELEMETRY_PERSISTENCE_FAILED",
          error: String(telemetryError),
        };
      } else {
        throw telemetryError;
      }
    }
    if (telemetrySummary && hostResourceTelemetryRecord) {
      Object.assign(hostResourceTelemetryRecord, {
        status: telemetrySummary.status,
        valid: telemetrySummary.valid,
        invalidReason: telemetrySummary.invalidReason ?? null,
      });
    }
    if (telemetrySummary?.supported === true && telemetrySummary.status !== "complete") {
      const telemetryFailure = {
        code: "WEBKIT_HOST_TELEMETRY_INVALID",
        status: telemetrySummary.status,
        invalidReason: telemetrySummary.invalidReason ?? null,
      };
      const priorFailure = primaryFailure ?? browserCleanupFailure;
      if (priorFailure) priorFailure.hostResourceTelemetryFailure = telemetryFailure;
      else throw Object.assign(new Error(`hosted visual telemetry invalid: ${JSON.stringify(telemetryFailure)}`), telemetryFailure);
    }
    if (browserCleanupFailure) throw browserCleanupFailure;
  }
};

let terminalFailure = null;
for (const engineName of engines) {
  const browserType = playwright[engineName];
  invariant(browserType, `unknown browser ${engineName}`);
  try {
    await runEngine(engineName, browserType);
  } catch (error) {
    terminalFailure = {
      engine: engineName,
      attempt: 1,
      error: String(error),
      code: error?.code ?? null,
      hostResourceTelemetryFailure: error?.hostResourceTelemetryFailure ?? null,
      browserCleanupError: error?.browserCleanupError ?? null,
    };
    break;
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  build: await productionBuildIdentity(),
  diagnostics,
  faultDiagnostics,
  transportRetries,
  attemptCount: 1,
  hostResourceTelemetry: hostResourceTelemetryResults,
  terminalFailure,
};
const reportFile = path.join(evidenceDir, "visual-integrity-report.json");
await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
const compactFile = path.join(compactDir, "summary.json");
await writeFile(compactFile, `${JSON.stringify({
  generatedAt: report.generatedAt,
  build: report.build,
  readyCases: diagnostics.length,
  faultCases: faultDiagnostics.length,
  missionFinalCanvasCases: faultDiagnostics.filter(({ finalCanvas }) => finalCanvas?.pass).length,
  missionFallbackPixelCount: faultDiagnostics.reduce((sum, { blocked }) => sum + Number(blocked.mount?.fallbackDrawCount ?? 0), 0),
  transportRetries,
  hostResourceTelemetry: hostResourceTelemetryResults,
  failures: terminalFailure ? [terminalFailure] : [],
}, null, 2)}\n`);
const representativeMissionImages = faultDiagnostics
  .flatMap(({ mutableMissionStates }) => mutableMissionStates ?? [])
  .slice(0, 3)
  .map(({ screenshot }) => path.resolve(screenshot));
if (representativeMissionImages.length === 3) {
  const panels = await Promise.all(representativeMissionImages.map(async (file) => {
    const image = sharp(file).resize({ width: 640, height: 360, fit: "cover" });
    return { input: await image.png().toBuffer() };
  }));
  await sharp({ create: { width: 640 * panels.length, height: 360, channels: 4, background: "#070a0b" } })
    .composite(panels.map((panel, index) => ({ ...panel, left: index * 640, top: 0 })))
    .png({ compressionLevel: 9 })
    .toFile(path.join(compactDir, "station-mission-state-contact-sheet.png"));
}
if (terminalFailure) {
  throw new Error(`v0995 visual QA failed on first attempt: ${JSON.stringify(terminalFailure)}`);
}
const digest = createHash("sha256").update(await readFile(reportFile)).digest("hex");
console.log(JSON.stringify({ status: "passed", cases: diagnostics.length, faultCases: faultDiagnostics.length, report: path.relative(process.cwd(), reportFile).replaceAll("\\", "/"), digest }, null, 2));
